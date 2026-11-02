"""Sound for "Bukalemunun Fırlatma Dili".

Stems: narration, music, ambience, sfx  +  final mix (48 kHz stereo).
Inputs:
  audio/narration.wav — ElevenLabs, voice "Jessica" (premade), eleven_v4, ONE generation of the whole script
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
DUR = 38.0
N_OFF = 0.4           # narration starts here on the video timeline
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

# ---------------------------------------------------------------- cartoon sfx (all synthesised; timings mirror blender/scene.py)
sfx = np.zeros((2, N))
send = np.zeros((2, N))


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def tone(freqs, dur, shape='sine', decay=None):
    """Sweep through a frequency curve (array or callable over 0..1)."""
    n = int(dur * SR)
    tt = np.arange(n) / SR
    f = freqs(tt / dur) if callable(freqs) else np.full(n, freqs)
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = np.sin(ph) if shape == 'sine' else (2 * ((ph / (2 * np.pi)) % 1) - 1)
    if decay:
        y *= np.exp(-tt / decay)
    return y * env(n, 0.005, 0.02)


def buzz(dur, pan_fn=None):
    """Cartoon fly buzz: a nasal saw tone with fast wobble, band-passed."""
    n = int(dur * SR)
    tt = np.arange(n) / SR
    f = 190 + 25 * np.sin(2 * np.pi * 7 * tt) + 15 * np.sin(2 * np.pi * 2.3 * tt)
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = 2 * ((ph / (2 * np.pi)) % 1) - 1
    y = fft_filter(y, lo=250, hi=2500) * (0.7 + 0.3 * np.sin(2 * np.pi * 37 * tt))
    y = norm(y) * env(n, 0.08, 0.15)
    pan = pan_fn(tt) if pan_fn else np.zeros(n)
    a = (np.clip(pan, -1, 1) + 1) * np.pi / 4
    return np.stack([y * np.cos(a), y * np.sin(a)])


def slide_whistle(dur, f0, f1):
    return norm(tone(lambda u: f0 * (f1 / f0) ** u + 6 * np.sin(2 * np.pi * 5 * u * dur), dur) * (1 + 0.15 * tone(6, dur)))


def thwip(dur=0.14):  # fast tongue shot
    n = int(dur * SR)
    tt = np.arange(n) / SR
    y = tone(lambda u: 300 * 9 ** u, dur) * np.exp(-tt / 0.08)
    y += 0.6 * fft_filter(rng.standard_normal(n), lo=1500, hi=7000) * np.exp(-tt / 0.03)
    return norm(y)


def splat():
    n = int(0.25 * SR)
    tt = np.arange(n) / SR
    y = fft_filter(rng.standard_normal(n), lo=150, hi=1800) * np.exp(-tt / 0.05) + 0.6 * np.sin(2 * np.pi * (180 - 300 * tt) * tt) * np.exp(-tt / 0.07)
    return norm(y)


def boing(dur=0.7, f=220):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    fm = f * (1 + 0.5 * np.exp(-tt / 0.08)) * (1 + 0.08 * np.sin(2 * np.pi * 14 * tt) * np.exp(-tt / 0.3))
    return norm(np.sin(2 * np.pi * np.cumsum(fm) / SR) * np.exp(-tt / 0.25))


def gulp():
    n = int(0.3 * SR)
    tt = np.arange(n) / SR
    return norm(np.sin(2 * np.pi * np.cumsum(260 - 500 * tt + 40 * np.sin(tt * 60)) / SR) * np.sin(np.pi * tt / 0.3) ** 2)


def chime(notes, gap=0.07, dur=1.0):
    out = np.zeros(int((dur + gap * len(notes)) * SR))
    for j, m in enumerate(notes):
        n = int(dur * SR)
        tt = np.arange(n) / SR
        b = (np.sin(2 * np.pi * mtof(m) * tt) + 0.3 * np.sin(2 * np.pi * mtof(m) * 2.76 * tt) * np.exp(-tt * 6)) * np.exp(-tt * 3.5)
        i0 = int(j * gap * SR)
        out[i0:i0 + n] += b
    return norm(out)


def whoosh(dur=0.6):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    y = np.zeros(n)
    for k, b in enumerate(np.geomspace(300, 3500, 6)):
        y += fft_filter(rng.standard_normal(n), lo=b * 0.6, hi=b * 2) * np.exp(-((tt / dur - k / 5) ** 2) / 0.04)
    return norm(y * np.sin(np.pi * tt / dur) ** 1.5)


def riser(dur, f0=200, f1=1200):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    y = tone(lambda u: f0 * (f1 / f0) ** u, dur) + 0.4 * tone(lambda u: 2.01 * f0 * (f1 / f0) ** u, dur)
    y += 0.3 * fft_filter(rng.standard_normal(n), lo=2000, hi=8000) * (tt / dur) ** 2
    return norm(y) * (tt / dur) ** 1.3


EV = []
# flies: buzz (panned with the fly), landing tick, take-off
place_st(sfx, buzz(2.75, lambda tt: 0.6 - 0.5 * tt / 2.75), 0.0, db(-24))
place(sfx, tone(2200, 0.03, decay=0.008), 2.75, db(-24), 0)
place_st(sfx, buzz(0.5, lambda tt: 0.2 + tt), 4.05, db(-24))
place_st(sfx, buzz(1.4, lambda tt: 0.5 + 0 * tt), 22.0, db(-26))
place_st(sfx, buzz(4.2, lambda tt: -0.7 + 0.4 * tt), 29.0, db(-26))
# "Dili!" — a tiny tongue peek
place(sfx, boing(0.35, 420), 3.72, db(-26), 0)
# S2 slow-motion tongue: slide whistle up, down when it reels back
place(sfx, slide_whistle(3.6, 350, 1400), 5.0, db(-27), 0.2)
place(sfx, slide_whistle(0.9, 1400, 350), 10.9, db(-28), 0.2)
place(sfx, chime([84, 88, 91]), 6.0, db(-27), 0)  # title
# S3: energy charging, release, launch
place(sfx, riser(2.4, 160, 900), 14.3, db(-27), 0)
place(sfx, boing(0.9, 160), 17.6, db(-19), 0)
place(sfx, thwip(0.2), 17.65, db(-20), 0.3)
place(sfx, whoosh(0.8), 17.7, db(-23), 0.4)
# S4: strike, sticky hit, slow reel, gulp, happy blink
place(sfx, thwip(), 23.4, db(-18), 0.3)
place(sfx, splat(), 23.52, db(-19), 0.35)
place(sfx, slide_whistle(1.8, 900, 260), 25.6, db(-28), 0.2)
place(sfx, gulp(), 27.45, db(-18), 0)
place(sfx, chime([96]), 28.4, db(-26), 0)
# S5: rear eye swivels, strike, fly dodges, splat on the leaf, rubbery stretch, surprised boing, snap back
place(sfx, tone(lambda u: 900 + 500 * u, 0.18), 32.0, db(-30), -0.3)
place(sfx, thwip(), 32.95, db(-18), 0.2)
place(sfx, tone(lambda u: 600 * 3 ** u, 0.3), 33.0, db(-27), 0.6)  # the fly zips away
place(sfx, splat(), 33.05, db(-19), 0.3)
place(sfx, slide_whistle(1.6, 300, 420), 33.5, db(-29), 0.3)
place(sfx, boing(0.8, 300), 34.45, db(-21), 0)
place(sfx, tone(lambda u: 600 * 0.4 ** u, 0.12), 35.85, db(-24), 0.2)
place(sfx, chime([84, 88, 91, 96]), 35.0, db(-24), 0)
for tc in (4.5, 12.0, 22.0, 29.0):
    place(sfx, whoosh(0.6), tc - 0.3, db(-27), 0)

# ---------------------------------------------------------------- ambience: rainforest (birds, insects, leaves)
amb = np.zeros((2, N))
hum = fft_filter(rng.standard_normal(2 * N), lo=2500, hi=7000).reshape(2, N) * (0.6 + 0.4 * np.sin(2 * np.pi * 3.1 * t_axis))
amb += norm(hum) * db(-46)
air = fft_filter(rng.standard_normal(2 * N), lo=80, hi=600).reshape(2, N)
amb += norm(air) * db(-40)
tb = 0.3
while tb < DUR - 0.5:
    n = int(rng.uniform(0.08, 0.25) * SR)
    tt = np.arange(n) / SR
    f0 = rng.uniform(2200, 4200)
    chirp = np.sin(2 * np.pi * np.cumsum(f0 + 900 * np.sin(tt * rng.uniform(30, 70))) / SR) * np.sin(np.pi * tt / tt[-1]) ** 2
    place(amb, chirp, tb, db(rng.uniform(-40, -33)), rng.uniform(-0.9, 0.9))
    tb += rng.uniform(0.4, 1.6)
amb *= ss(0, 0.6, t_axis) * (1 - ss(DUR - 0.6, DUR, t_axis))

# ---------------------------------------------------------------- music: playful jungle cartoon groove (synthesised)
BPM = 112
beat = 60 / BPM
music = np.zeros((2, N))


def marimba(f, dur=0.5, vel=1.0):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    y = np.sin(2 * np.pi * f * tt) * np.exp(-tt * 9) + 0.35 * np.sin(2 * np.pi * f * 4 * tt) * np.exp(-tt * 30) + 0.1 * np.sin(2 * np.pi * f * 10 * tt) * np.exp(-tt * 60)
    return y * np.minimum(1, tt / 0.002) * vel


def pizz(f, dur=0.35, vel=1.0):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    y = sum(np.sin(2 * np.pi * f * k * tt) * np.exp(-tt * (8 + 4 * k)) / k for k in (1, 2, 3))
    return y * np.minimum(1, tt / 0.003) * vel


def shaker(vel=1.0):
    n = int(0.06 * SR)
    return fft_filter(rng.standard_normal(n), lo=5000, hi=11000) * np.exp(-np.arange(n) / (0.012 * SR)) * vel


def wood(vel=1.0):
    n = int(0.05 * SR)
    tt = np.arange(n) / SR
    return np.sin(2 * np.pi * 1300 * tt) * np.exp(-tt / 0.008) * vel


# sections: (start, end, chord roots + quality, density)
CH = [(0.0, 4.5, [60, 64, 67], 0.6), (4.5, 8.3, [65, 69, 72], 1.0), (8.3, 12.0, [67, 71, 74], 1.0),
      (12.0, 17.6, [57, 60, 64], 0.35),  # curious / tense: sparse
      (17.6, 22.0, [65, 69, 72], 1.0), (22.0, 25.6, [60, 64, 67], 0.8), (25.6, 29.0, [62, 65, 69], 0.8),
      (29.0, 34.4, [60, 64, 67], 1.0), (34.4, 35.0, [61, 65, 68], 0.2),  # the "oops" stop
      (35.0, DUR, [65, 69, 72], 0.9)]
pattern = [0, 2, 1, 2, 0, 2, 1, 0]
for a, b, chord, dens in CH:
    k = int(np.ceil(a / (beat / 2)))
    while k * beat / 2 < b:
        tt0 = k * beat / 2
        step = k % 8
        if dens >= 0.5 or step % 2 == 0:
            m = chord[pattern[step]] + (12 if step in (3, 7) else 0)
            place(music, marimba(mtof(m), 0.45, 0.8 if step % 2 == 0 else 0.55), tt0, 1.0, 0.3 * np.sin(k))
        if step in (0, 4):
            place(music, pizz(mtof(chord[0] - 24), 0.4, 1.0), tt0, 1.0, 0)
        if step in (2, 6) and dens > 0.5:
            place(music, pizz(mtof(chord[2] - 24), 0.3, 0.7), tt0, 1.0, 0)
        if dens > 0.5:
            place(music, shaker(0.7 if step % 2 else 1.0), tt0, 1.0, 0.25)
            place(music, shaker(0.5), tt0 + beat / 4, 1.0, 0.25)
        if step in (2, 6) and dens > 0.7:
            place(music, wood(0.8), tt0, 1.0, -0.3)
        k += 1
# gentle pad underneath for warmth
pad = np.zeros(N)
for a, b, chord, dens in CH:
    if a >= DUR:
        break
    n = int((b - a + 0.6) * SR)
    tt = np.arange(n) / SR
    y = sum(np.sin(2 * np.pi * mtof(m - 12) * tt) for m in chord) * env(n, 0.3, 0.6)
    i0 = int(a * SR)
    pad[i0:i0 + len(y[: N - i0])] += y[: N - i0] * 0.25
pad = fft_filter(pad, lo=80, hi=1200)
music += np.stack([pad, np.roll(pad, 600)])
music = norm(music)
music *= ss(0, 0.6, t_axis) * (1 - ss(DUR - 1.5, DUR, t_axis) * 0.97)

# ---------------------------------------------------------------- mix
wet = reverb(send) * db(-6)
music_st = music * db(-9) * (1 - duck * (1 - db(-10)))
amb_st = amb * (1 - duck * (1 - db(-4)))
sfx_st = (sfx + wet) * (1 - duck * (1 - db(-4))) * (1 - ss(DUR - 0.3, DUR, t_axis))
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
print('peak', round(20 * np.log10(peak), 2), 'dBFS')
