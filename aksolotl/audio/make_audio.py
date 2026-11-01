"""Sound for "Aksolotl – Kendini Yeniden İnşa Eden Canlı".

Stems: narration, music, ambience, sfx  +  final mix (48 kHz stereo).
Inputs:
  audio/narration.wav   — vidIQ voiceover (ElevenLabs premade voice "Jessica", multilingual), pauses tightened, tempo 1.05
                          (made by audio/prep_narration.py from audio/raw/narration_jessica.mp3)
  out/parts/part*.cues.json — events from the renderer (or audio/events.json)
The music (mysterious, enchanting underwater ambience) and all sound effects are synthesised here with numpy.
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
DUR = 48.0
N_OFF = 0.3           # narration starts here on the video timeline
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


def env(n, a, r):
    e = np.ones(n)
    na, nr = min(int(a * SR), n), min(int(r * SR), n)
    e[:na] = np.linspace(0, 1, na)
    e[n - nr:] *= np.linspace(1, 0, nr)
    return e


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
    events = [{'t': 0.0, 'type': 'swell'}, {'t': 4.3, 'type': 'title'}, {'t': 6.3, 'type': 'whoosh'}, {'t': 6.6, 'type': 'regen', 'd': 7.7},
              {'t': 11.08, 'type': 'ping', 'n': 0}, {'t': 11.92, 'type': 'ping', 'n': 1}]
else:
    p = os.path.join(ROOT, 'audio/events.json')
    cues = sorted(glob.glob(os.path.join(ROOT, 'out/parts/part*.cues.json')))
    events = json.load(open(cues[-1]))['events'] if cues else json.load(open(p))


# ---------------------------------------------------------------- sfx (all synthesised)
sfx = np.zeros((2, N))
send = np.zeros((2, N))


def bubble(r_mm=None):
    """One air bubble: a decaying sine whose pitch rises (Minnaert resonance)."""
    r_mm = r_mm or rng.uniform(1.0, 4.0)
    f0 = 3260 / r_mm
    dur = 0.04 + 0.03 * r_mm
    n = int(dur * SR)
    tt = np.arange(n) / SR
    f = f0 * (1 + 2.2 * tt / dur)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / (dur * 0.35)) * np.minimum(1, tt / 0.0015)


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
    y = sum(a * np.sin(2 * np.pi * freq * r * tt) * np.exp(-tt * d) for r, a, d in ((1, 1, 3.0), (2.76, 0.35 * bright, 6), (5.4, 0.18 * bright, 11)))
    return y * np.minimum(1, tt / 0.002)


def whoosh(dur=0.7):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    y = np.zeros(n)
    for k, b in enumerate(np.geomspace(250, 3000, 6)):
        w = np.exp(-((tt / dur - k / 5) ** 2) / 0.04)
        y += fft_filter(rng.standard_normal(n), lo=b * 0.6, hi=b * 2) * w
    return norm(y * np.sin(np.pi * tt / dur) ** 1.5)


def shimmer(dur, f0=1400, rate=18):
    """Sci-fi 'cell' texture: a cloud of short glassy grains drifting in pitch."""
    n = int(dur * SR)
    out = np.zeros((2, n + SR))
    tt = 0.0
    while tt < dur:
        f = f0 * 2 ** (rng.uniform(-1, 1.5)) * (1 + 0.3 * tt / dur)
        gl = rng.uniform(0.05, 0.16)
        m = int(gl * SR)
        x = np.arange(m) / SR
        g = np.sin(2 * np.pi * f * x) * np.sin(np.pi * x / gl) ** 2
        k = int(tt * SR)
        a = (rng.uniform(-0.9, 0.9) + 1) * np.pi / 4
        out[0, k:k + m] += g * np.cos(a)
        out[1, k:k + m] += g * np.sin(a)
        tt += rng.exponential(1 / rate)
    return out[:, :n] / 4


def riser(dur, f0=180, f1=900):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    f = f0 * (f1 / f0) ** (tt / dur)
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = (np.sin(ph) + 0.4 * np.sin(2.01 * ph) + 0.25 * np.sin(3.02 * ph)) * (tt / dur) ** 1.4
    y += 0.3 * fft_filter(rng.standard_normal(n), lo=1500, hi=7000) * (tt / dur) ** 2
    return norm(y) * np.minimum(1, (dur - tt) / 0.08)


def blip(f=900):
    n = int(0.12 * SR)
    tt = np.arange(n) / SR
    return np.sin(2 * np.pi * f * (1 + 0.8 * tt / 0.12) * tt) * np.exp(-tt / 0.035) * np.minimum(1, tt / 0.002)


for e in events:
    t0, ty = e['t'], e['type']
    if ty == 'whoosh':  # scene transitions: soft water whoosh + bubbles
        place(sfx, whoosh(0.8), t0 - 0.4, db(-24), 0)
        place_st(sfx, bubbles(0.7, 20), t0 - 0.15, db(-25))
    elif ty == 'swell':  # dark opening: a low swell
        n = int(3.5 * SR)
        tt = np.arange(n) / SR
        y = fft_filter(rng.standard_normal(n), lo=60, hi=500) * np.sin(np.pi * np.clip(tt / 3.5, 0, 1)) ** 2
        place(sfx, norm(y), t0, db(-26), 0)
    elif ty == 'title':
        place(sfx, bell(1318, 1.2, 0.5), t0, db(-27), 0.15)
        place(sfx, bell(1975, 1.0, 0.3), t0 + 0.06, db(-31), -0.15)
    elif ty == 'sparkle':
        for j in range(7):
            place(sfx, bell(1760 * 2 ** (rng.integers(0, 12) / 12), 0.6, 0.4), t0 + j * 0.07, db(-31), rng.uniform(-0.7, 0.7))
    elif ty == 'regen':  # time-lapse growth: rising glassy tone + shimmer
        place(sfx, riser(e['d'], 220, 660), t0, db(-30), 0)
        place_st(sfx, shimmer(e['d'], 1500, 10), t0, db(-28))
    elif ty == 'ping':  # tissue labels: kemik, kas, sinir, damar
        place(sfx, blip([880, 988, 1175, 1319][e['n']]), t0, db(-22), [-0.3, 0.3, -0.15, 0.15][e['n']])
        place(send, blip([880, 988, 1175, 1319][e['n']]), t0, db(-26), 0)
    elif ty == 'dive':  # diving into the tissue: sweep + whoosh
        place(sfx, riser(e['d'], 300, 2400), t0, db(-25), 0)
        place(sfx, whoosh(e['d']), t0, db(-22), 0)
    elif ty == 'micro':  # cellular world: sci-fi shimmer bed + soft low drone
        place_st(sfx, shimmer(e['d'], 1200, 22), t0, db(-27))
        n = int(e['d'] * SR)
        tt = np.arange(n) / SR
        dr = (np.sin(2 * np.pi * 73.4 * tt) + 0.5 * np.sin(2 * np.pi * 110 * tt + np.sin(2 * np.pi * 0.3 * tt))) * env(n, 0.6, 1.0)
        place(sfx, norm(dr), t0, db(-30), 0)
    elif ty == 'divide':  # cells dividing: soft bubbly blips
        tt0 = t0
        while tt0 < t0 + e['d']:
            place(sfx, blip(rng.uniform(600, 1400)), tt0, db(rng.uniform(-32, -27)), rng.uniform(-0.7, 0.7))
            tt0 += rng.uniform(0.05, 0.14)
    elif ty == 'bubbles':
        place_st(sfx, bubbles(e.get('d', 1.0), e.get('rate', 12)), t0, db(-27))
    elif ty == 'outro':
        for j, m in enumerate([0, 3, 7, 10, 14]):
            place(sfx, bell(587 * 2 ** (m / 12), 2.0, 0.5), t0 + 0.12 * j, db(-27), -0.4 + 0.2 * j)

# ---------------------------------------------------------------- ambience: underwater bed, distant bubbles
amb = np.zeros((2, N))
bed = fft_filter(rng.standard_normal(2 * N), lo=40, hi=380).reshape(2, N)
micro_on = ss(15.9, 16.4, t_axis) * (1 - ss(24.0, 24.6, t_axis))
amb += norm(bed) * db(-30) * (0.85 + 0.15 * np.sin(2 * np.pi * 0.09 * t_axis)) * (1 - 0.7 * micro_on)
far = bubbles(DUR, 3)
amb += np.stack([fft_filter(far[0], hi=2200), fft_filter(far[1], hi=2200)]) * db(-36) * (1 - micro_on)
amb *= ss(0, 0.8, t_axis) * (1 - ss(DUR - 0.8, DUR, t_axis))

# ---------------------------------------------------------------- music: mysterious, enchanting underwater ambience (synthesised)
music = np.zeros((2, N))


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def pad(freq, dur, att=1.8, rel=2.0):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    y = sum(np.sin(2 * np.pi * freq * (1 + d) * tt + 0.3 * np.sin(2 * np.pi * (0.17 + i * 0.05) * tt)) for i, d in enumerate((-0.005, 0, 0.004, 0.0075))) / 4
    y += 0.25 * np.sin(2 * np.pi * freq * 2.0 * tt) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.11 * tt))
    return y * env(n, att, rel)


def glass(freq, dur=2.6, vel=1.0):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    y = np.sin(2 * np.pi * freq * tt) * np.exp(-tt * 1.6) + 0.35 * np.sin(2 * np.pi * freq * 3.0 * tt) * np.exp(-tt * 4) + 0.15 * np.sin(2 * np.pi * freq * 4.2 * tt) * np.exp(-tt * 7)
    return y * np.minimum(1, tt / 0.004) * vel


# chord changes follow the story: dark Dm(add9) → wonder (Bb maj7, F) → cells (Gm9, A sus) → warm ending (Bb, F, Dm add9)
CH = [(0.0, [38, 50, 57, 64, 65]), (6.3, [34, 46, 53, 57, 62]), (11.0, [41, 48, 57, 60, 64]), (15.4, [43, 50, 58, 62, 69]),
      (19.8, [45, 52, 57, 62, 64]), (24.2, [34, 46, 53, 57, 62]), (30.3, [41, 48, 57, 60, 65]), (35.0, [38, 50, 57, 62, 65]),
      (40.4, [34, 46, 53, 58, 62]), (43.4, [41, 53, 57, 60, 65]), (46.0, [38, 50, 57, 62, 64])]
padL = np.zeros(N)
for i, (t0, notes) in enumerate(CH):
    if t0 >= DUR:
        break
    t1 = CH[i + 1][0] if i + 1 < len(CH) else DUR + 1
    for m in notes:
        sig = pad(mtof(m), t1 - t0 + 2.2, 1.6 if t0 > 0 else 3.0, 2.2) * (1.3 if m < 46 else 0.8)
        i0 = int(t0 * SR)
        if i0 < N:
            padL[i0:i0 + len(sig[: N - i0])] += sig[: N - i0]
padL = fft_filter(padL, lo=40, hi=1800)
music += np.stack([padL, np.roll(padL, 900)])
# glassy arpeggio motif (celesta-like), sparse in the opening, busier in the cell scene, gentle at the end
arp = np.zeros((2, N))
for i, (t0, notes) in enumerate(CH):
    t1 = CH[i + 1][0] if i + 1 < len(CH) else DUR
    step = 0.42 if 15.4 <= t0 < 24 else 0.62
    k = 0
    tt0 = t0 + 0.3
    while tt0 < t1 - 0.2:
        m = notes[[2, 3, 4, 3][k % 4]] + 12 + (12 if (k % 7 == 5) else 0)
        place(arp, glass(mtof(m), 2.4, 0.65 - 0.1 * (k % 2)), tt0, 1.0, 0.6 * np.sin(k * 1.3 + t0))
        tt0 += step
        k += 1
music += arp * 0.35 * (0.55 + 0.45 * ss(3, 6, t_axis))
# soft heartbeat-like sub pulse under the regeneration and cell scenes
pulse = np.zeros((2, N))
tt0 = 6.6
while tt0 < 24.0:
    n = int(0.4 * SR)
    x = np.arange(n) / SR
    s1 = np.sin(2 * np.pi * (52 + 30 * np.exp(-x / 0.04)) * x) * np.exp(-x / 0.11)
    place(pulse, s1, tt0, 0.8, 0)
    place(pulse, s1 * 0.5, tt0 + 0.28, 0.8, 0)
    tt0 += 60 / 76
music += pulse * 0.45
music = norm(music)
music *= ss(0, 2.5, t_axis) * (1 - ss(DUR - 2.0, DUR, t_axis) * 0.97)

# ---------------------------------------------------------------- mix
# music −10 dB under the voice and back up in the short gaps; sfx step aside a little under speech
wet = reverb(send) * db(-6)
music_st = music * db(-12) * (1 - duck * (1 - db(-10)))
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
