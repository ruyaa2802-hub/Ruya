"""Sound for "Deniz Atlarının Şaşırtıcı Dünyası — Erkekler Doğum Yapıyor!".

Stems: narration, music, ambience, sfx  +  final mix (48 kHz stereo).
Inputs:
  audio/narration.wav   — vidIQ voiceover (ElevenLabs premade voice "Jessica", multilingual), pauses tightened, tempo 1.05
                          (made by audio/prep_narration.py from audio/raw/narration_jessica.mp3)
  audio/raw/music_vidiq.wav — original royalty-free track generated with vidIQ (marimba, ukulele, bells)
  out/parts/part*.cues.json — events from the renderer (or audio/events.json)
Sound effects (bubbles, sparkles, pops, whooshes, chimes) are synthesised here with numpy.
Run:   python3 audio/make_audio.py            (full mix)
       python3 audio/make_audio.py --test 16  (first 16 s only → out/audio_test.wav)
"""
import glob
import json
import os
import subprocess
import sys
import wave

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 48000
DUR = 50.0
N_OFF = 0.25          # narration starts here on the video timeline
MUSIC_OFF = 15.38     # music start offset, so the track's own ending lands on the last frame
TEST = float(sys.argv[sys.argv.index('--test') + 1]) if '--test' in sys.argv else None
if TEST:
    DUR = TEST
N = int(SR * DUR)
t_axis = np.arange(N) / SR
rng = np.random.default_rng(21)


def ss(a, b, x):
    u = np.clip((x - a) / (b - a), 0, 1)
    return u * u * (3 - 2 * u)


def db(x):
    return 10 ** (x / 20)


def fft_filter(x, lo=None, hi=None, order=2):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    f[0] = 1e-3
    H = np.ones_like(f)
    if hi:
        H /= np.sqrt(1 + (f / hi) ** (2 * order))
    if lo:
        H /= np.sqrt(1 + (lo / f) ** (2 * order))
    return np.fft.irfft(X * H, len(x))


def norm(x):
    return x / (np.abs(x).max() + 1e-9)


def place(buf, sig, t0, gain=1.0, pan=0.0):
    i0 = int(round(t0 * SR))
    if i0 >= N:
        return
    if i0 < 0:
        sig, i0 = sig[-i0:], 0
    sig = sig[: N - i0]
    a = (np.clip(pan, -1, 1) + 1) * np.pi / 4
    buf[0, i0:i0 + len(sig)] += sig * gain * np.cos(a)
    buf[1, i0:i0 + len(sig)] += sig * gain * np.sin(a)


def place_st(buf, st, t0, gain=1.0):
    """Add a stereo signal (2, n) at t0."""
    i0 = int(round(t0 * SR))
    if i0 >= N:
        return
    st = st[:, : N - i0]
    buf[:, i0:i0 + st.shape[1]] += st * gain


def write_wav(path, x):
    x = np.clip(x, -1, 1)
    with wave.open(path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((x.T * 32767).astype(np.int16).tobytes())


def load(path, ch=1):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', str(ch), '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    x = np.frombuffer(raw, dtype=np.float32).astype(np.float64)
    return x.reshape(-1, ch).T if ch > 1 else x


def conv(x, ir):
    n = len(x) + len(ir) - 1
    m = 1 << (n - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, m) * np.fft.rfft(ir, m), m)[: len(x)]


ir_n = int(1.4 * SR)
ir_t = np.arange(ir_n) / SR
IR = [fft_filter(rng.standard_normal(ir_n), lo=300, hi=6000) * np.exp(-ir_t / 0.35) for _ in range(2)]
IR = [ir / np.sqrt((ir ** 2).sum()) for ir in IR]


def reverb(st):
    return np.stack([conv(st[0] + 0.3 * st[1], IR[0]), conv(st[1] + 0.3 * st[0], IR[1])])


# ---------------------------------------------------------------- narration
v = load(os.path.join(ROOT, 'audio/narration.wav'))
narr_m = np.zeros(N)
i0 = int(N_OFF * SR)
narr_m[i0:i0 + len(v[: N - i0])] = v[: N - i0]
narr_m = fft_filter(narr_m, lo=90)
narr_m += 0.18 * fft_filter(narr_m, lo=3000, hi=7000)  # a little presence so it sits on top of the music
lvl = np.sqrt(np.convolve(narr_m ** 2, np.ones(480) / 480, mode='same')) + 1e-6
narr_m *= np.minimum(1, (lvl / db(-22)) ** -0.3)  # gentle compression
narr_m *= db(-3) / np.abs(narr_m).max()
narr = np.stack([narr_m, narr_m])

# speech envelope → ducking (fast attack, ~0.4 s release)
win = int(0.03 * SR)
rms = np.sqrt(np.convolve(narr_m ** 2, np.ones(win) / win, mode='same'))
speech = (rms > db(-40)).astype(float)
ds = 48
sp = speech[::ds]
d_s = np.zeros_like(sp)
acc = 0.0
a_k, r_k = np.exp(-ds / (0.05 * SR)), np.exp(-ds / (0.40 * SR))
for i, x in enumerate(sp):
    acc = (a_k * acc + (1 - a_k) * x) if x > acc else (r_k * acc + (1 - r_k) * x)
    d_s[i] = acc
duck = np.interp(np.arange(N), np.arange(len(d_s)) * ds, d_s)

# ---------------------------------------------------------------- events
if TEST:
    events = [{'t': 0.0, 'type': 'whoosh'}, {'t': 1.4, 'type': 'title'}, {'t': 2.3, 'type': 'sparkle'}, {'t': 5.6, 'type': 'whoosh'},
              {'t': 7.0, 'type': 'eggs', 'd': 2.6}, {'t': 10.4, 'type': 'whoosh'}, {'t': 12.0, 'type': 'sparkle'}, {'t': 15.2, 'type': 'births', 'd': 2.0}]
else:
    p = os.path.join(ROOT, 'audio/events.json')
    cues = sorted(glob.glob(os.path.join(ROOT, 'out/parts/part*.cues.json')))
    events = json.load(open(cues[-1]))['events'] if cues else json.load(open(p))

# ---------------------------------------------------------------- sfx (all synthesised)
sfx = np.zeros((2, N))
send = np.zeros((2, N))


def bubble(r_mm=None):
    """One air bubble: a decaying sine whose pitch rises (Minnaert resonance of a shrinking/rising bubble)."""
    r_mm = r_mm or rng.uniform(1.0, 4.0)
    f0 = 3260 / r_mm  # Hz
    dur = 0.04 + 0.03 * r_mm
    n = int(dur * SR)
    tt = np.arange(n) / SR
    f = f0 * (1 + 2.2 * tt / dur)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / (dur * 0.35)) * np.minimum(1, tt / 0.0015)
    return y


def bubbles(dur, rate=12.0, big=False):
    n = int(dur * SR)
    out = np.zeros((2, n + SR))
    tt = 0.0
    while tt < dur:
        b = bubble(rng.uniform(2.0, 5.0) if big else None)
        k = int(tt * SR)
        a = (rng.uniform(-0.8, 0.8) + 1) * np.pi / 4
        g = rng.uniform(0.3, 1.0)
        out[0, k:k + len(b)] += b * g * np.cos(a)
        out[1, k:k + len(b)] += b * g * np.sin(a)
        tt += rng.exponential(1 / rate)
    return out[:, :n]


def bell(freq, dur=1.2, bright=1.0):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    y = sum(a * np.sin(2 * np.pi * freq * r * tt) * np.exp(-tt * d) for r, a, d in ((1, 1, 3.5), (2.76, 0.4 * bright, 7), (5.4, 0.2 * bright, 12), (8.9, 0.1 * bright, 18)))
    return y * np.minimum(1, tt / 0.002)


def sparkle(dur=0.9, base=1800):
    n = int(dur * SR)
    out = np.zeros((2, n + SR))
    for k in range(9):
        f = base * 2 ** (rng.integers(0, 12) / 12) * (2 if k % 3 == 0 else 1)
        b = bell(f, 0.6, 0.6) * (1 - k / 11)
        i = int(k * dur / 11 * SR)
        a = (rng.uniform(-0.9, 0.9) + 1) * np.pi / 4
        out[0, i:i + len(b)] += b * np.cos(a)
        out[1, i:i + len(b)] += b * np.sin(a)
    return out[:, :n] / 3


def whoosh(dur=0.55, up=True):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    y = np.zeros(n)
    for k, b in enumerate(np.geomspace(300, 3500, 6)[:: 1 if up else -1]):
        w = np.exp(-((tt / dur - k / 5) ** 2) / 0.04)
        y += fft_filter(rng.standard_normal(n), lo=b * 0.6, hi=b * 2) * w
    return norm(y * np.sin(np.pi * tt / dur) ** 1.5)


def pop(f=900):
    n = int(0.09 * SR)
    tt = np.arange(n) / SR
    return np.sin(2 * np.pi * f * (1 + 3 * tt / 0.09) * tt) * np.exp(-tt / 0.018) * np.minimum(1, tt / 0.001)


for e in events:
    t0, ty = e['t'], e['type']
    if ty == 'whoosh':  # scene transitions (no black frames)
        w = whoosh(0.6)
        place(sfx, w, t0 - 0.3, db(-24), 0)
        place(sfx, bubbles(0.5, 18)[0], t0 - 0.1, db(-26), 0.3)
    elif ty == 'title':  # big animated text pops in
        place(sfx, pop(700), t0, db(-17), 0)
        place(sfx, bell(1568, 0.8), t0 + 0.04, db(-27), 0.2)
    elif ty == 'sparkle':
        s = sparkle(1.0, e.get('f', 1800))
        place_st(sfx, s, t0, db(-22))
        place(send, s[0], t0, db(-28), 0)
    elif ty == 'eggs':  # egg transfer: a soft stream of tiny bubbles + rising chime
        place_st(sfx, bubbles(e['d'], 22), t0, db(-25))
        for j, m in enumerate([0, 4, 7, 12]):
            place(sfx, bell(1047 * 2 ** (m / 12), 0.9, 0.5), t0 + 0.5 + j * 0.45, db(-30), -0.3 + 0.2 * j)
    elif ty == 'heart':  # embryo / love moments: warm chime
        for j, m in enumerate([0, 7, 12]):
            place(sfx, bell(880 * 2 ** (m / 12), 1.2, 0.4), t0 + j * 0.08, db(-29), 0)
    elif ty == 'contract':  # dad's pouch contraction: low soft "whump"
        n = int(0.35 * SR)
        tt = np.arange(n) / SR
        place(sfx, np.sin(2 * np.pi * (60 + 50 * np.exp(-tt / 0.05)) * tt) * np.exp(-tt / 0.1), t0, db(-20), 0)
    elif ty == 'births':  # babies burst out: playful pops + bubbles
        tt0 = t0
        while tt0 < t0 + e['d']:
            place(sfx, pop(rng.uniform(700, 1500)), tt0, db(rng.uniform(-27, -21)), rng.uniform(-0.6, 0.6))
            tt0 += rng.uniform(0.04, 0.12)
        place_st(sfx, bubbles(e['d'] + 0.4, 25, True), t0, db(-26))
    elif ty == 'bubbles':
        place_st(sfx, bubbles(e.get('d', 1.0), e.get('rate', 10)), t0, db(e.get('g', -30)))
    elif ty == 'outro':
        for j, m in enumerate([0, 4, 7, 12, 16]):
            place(sfx, bell(784 * 2 ** (m / 12), 1.6, 0.6), t0 + 0.07 * j, db(-25), -0.4 + 0.2 * j)

# ---------------------------------------------------------------- ambience: soft underwater bed with distant bubbles
amb = np.zeros((2, N))
bed = fft_filter(rng.standard_normal(2 * N), lo=40, hi=420).reshape(2, N)
amb += norm(bed) * db(-30) * (0.8 + 0.2 * np.sin(2 * np.pi * 0.11 * t_axis))
far = bubbles(DUR, 4)
amb += np.stack([fft_filter(far[0], hi=2500), fft_filter(far[1], hi=2500)]) * db(-36)
amb *= ss(0, 0.4, t_axis) * (1 - ss(DUR - 0.8, DUR, t_axis))

# ---------------------------------------------------------------- music
m = load(os.path.join(ROOT, 'audio/raw/music_vidiq.wav'), ch=2)
m = m[:, int(MUSIC_OFF * SR):]
music = np.zeros((2, N))
music[:, : min(N, m.shape[1])] = m[:, :N]
music *= ss(0, 0.25, t_axis) * (1 - ss(DUR - 1.6, DUR, t_axis))
music /= np.abs(music).max()

# ---------------------------------------------------------------- mix
# music −10 dB under the voice, back up in the short gaps; sfx also step aside a little under speech
wet = reverb(send) * db(-6)
music_st = music * db(-9) * (1 - duck * (1 - db(-10)))
amb_st = amb * (1 - duck * (1 - db(-4)))
sfx_st = (sfx + wet) * (1 - duck * (1 - db(-5))) * (1 - ss(DUR - 0.3, DUR, t_axis))
mix = narr + music_st + amb_st + sfx_st
peak = np.abs(mix).max()
scale = db(-1) / peak if peak > db(-1) else 1.0
mix *= scale
if TEST:
    write_wav(os.path.join(ROOT, 'out/audio_test.wav'), mix)
    print('test mix written, peak', round(20 * np.log10(peak), 2), 'dBFS')
    sys.exit()
out = os.path.join(ROOT, 'out/audio')
os.makedirs(out, exist_ok=True)
write_wav(os.path.join(out, 'stem_narration.wav'), narr * scale)
write_wav(os.path.join(out, 'stem_music.wav'), music_st * scale)
write_wav(os.path.join(out, 'stem_ambience.wav'), amb_st * scale)
write_wav(os.path.join(out, 'stem_sfx.wav'), sfx_st * scale)
write_wav(os.path.join(ROOT, 'out/soundtrack.wav'), mix)
print('peak', round(20 * np.log10(peak), 2), 'dBFS | events', len(events))
