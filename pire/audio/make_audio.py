"""Sound design for "Bir Pire Kendi Boyunun 100 Katı Üzerine Nasıl Zıplar?".

Stems: narration, music, ambience, sfx  +  final mix (48 kHz stereo).
Inputs: audio/raw/sNN.wav (one sentence each, local Piper TTS, tr_TR-dfki-medium — see README),
        audio/timeline.py (SPEED, START), out/parts/part*.cues.json (events from the renderer).
All sound effects and the music are synthesised here (numpy), nothing is downloaded.
Run:   python3 audio/make_audio.py
"""
import glob
import json
import os
import subprocess
import sys
import wave

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'audio'))
from timeline import SPEED, START  # noqa: E402

SR = 48000
DUR = 44.5
N = int(SR * DUR)
t_axis = np.arange(N) / SR
rng = np.random.default_rng(12)


def ss(a, b, x):
    u = np.clip((x - a) / (b - a), 0, 1)
    return u * u * (3 - 2 * u)


def db(x):
    return 10 ** (x / 20)


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


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


def write_wav(path, x):
    x = np.clip(x, -1, 1)
    with wave.open(path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((x.T * 32767).astype(np.int16).tobytes())


def env(n, a, r):
    e = np.ones(n)
    na, nr = min(int(a * SR), n), min(int(r * SR), n)
    e[:na] = np.linspace(0, 1, na)
    e[n - nr:] *= np.linspace(1, 0, nr)
    return e


def load(path, af=None):
    cmd = ['ffmpeg', '-v', 'error', '-i', path] + (['-af', af] if af else []) + ['-f', 'f32le', '-ac', '1', '-ar', str(SR), '-']
    return np.frombuffer(subprocess.run(cmd, capture_output=True, check=True).stdout, dtype=np.float32).astype(np.float64)


def conv(x, ir):
    n = len(x) + len(ir) - 1
    m = 1 << (n - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, m) * np.fft.rfft(ir, m), m)[: len(x)]


ir_n = int(1.2 * SR)
ir_t = np.arange(ir_n) / SR
IR = [fft_filter(rng.standard_normal(ir_n), lo=200, hi=5000) * np.exp(-ir_t / 0.3) for _ in range(2)]
IR = [ir / np.sqrt((ir ** 2).sum()) for ir in IR]


def reverb(st):
    return np.stack([conv(st[0] + 0.3 * st[1], IR[0]), conv(st[1] + 0.3 * st[0], IR[1])])


# ---------------------------------------------------------------- narration: one clip per sentence, sped up, placed at START
narr_m = np.zeros(N)
for i, st in enumerate(START):
    x = load(os.path.join(ROOT, f'audio/raw/s{i:02d}.wav'), f'atempo={SPEED}')
    on = np.where(np.abs(x) > 0.02 * np.abs(x).max())[0]
    x = x[max(0, on[0] - int(0.02 * SR)):]  # leading silence off → speech starts at START (subtitle cue)
    f = int(0.01 * SR)
    x[:f] *= np.linspace(0, 1, f)
    x[-f:] *= np.linspace(1, 0, f)
    i0 = int(st * SR)
    narr_m[i0:i0 + len(x[: N - i0])] += x[: N - i0]
# gentle voice shaping: low cut, a little presence, mild compression
narr_m = fft_filter(narr_m, lo=90)
narr_m += 0.25 * fft_filter(narr_m, lo=2500, hi=6000)
lvl = np.sqrt(np.convolve(narr_m ** 2, np.ones(480) / 480, mode='same')) + 1e-6
narr_m *= np.minimum(1, (lvl / db(-20)) ** -0.35)
narr_m *= db(-3) / np.abs(narr_m).max()
narr = np.stack([narr_m, narr_m])

win = int(0.03 * SR)
rms = np.sqrt(np.convolve(narr_m ** 2, np.ones(win) / win, mode='same'))
speech = (rms > db(-42)).astype(float)
ds = 48
sp = speech[::ds]
d_s = np.zeros_like(sp)
acc = 0.0
a_k, r_k = np.exp(-ds / (0.06 * SR)), np.exp(-ds / (0.45 * SR))
for i, v in enumerate(sp):
    acc = (a_k * acc + (1 - a_k) * v) if v > acc else (r_k * acc + (1 - r_k) * v)
    d_s[i] = acc
duck = np.interp(np.arange(N), np.arange(len(d_s)) * ds, d_s)

# ---------------------------------------------------------------- events from the renderer
cues = [os.environ['CUES']] if os.environ.get('CUES') else sorted(glob.glob(os.path.join(ROOT, 'out/parts/part*.cues.json')))
events = json.load(open(cues[-1]))['events'] if cues else []

# ---------------------------------------------------------------- sfx (all synthesised)
sfx = np.zeros((2, N))
send = np.zeros((2, N))


def noise(n, lo, hi):
    return fft_filter(rng.standard_normal(n), lo=lo, hi=hi)


def click(dur=0.012, lo=2500, hi=9000, tau=0.002):
    n = int(dur * SR)
    return norm(noise(n, lo, hi) * np.exp(-np.arange(n) / (tau * SR)))


def spring(dur, f0, f1, tau):
    """A metallic 'boing' sweeping f0 → f1 (the released spring)."""
    n = int(dur * SR)
    tt = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-tt / (dur * 0.25))
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = np.sin(ph) + 0.35 * np.sin(2.76 * ph) * np.exp(-tt / (tau * 0.4)) + 0.2 * np.sin(5.4 * ph) * np.exp(-tt / (tau * 0.2))
    return y * np.exp(-tt / tau) * np.minimum(1, tt / 0.002)


def whoosh(dur, lo0, lo1, peak=0.3):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    y = np.zeros(n)
    # band sweeps by crossfading a few filtered noises
    bands = np.geomspace(lo0, lo1, 6)
    for k, b in enumerate(bands):
        w = np.exp(-((tt / dur - k / 5) ** 2) / 0.03)
        y += noise(n, b * 0.7, b * 2.2) * w
    shape = np.minimum(tt / (peak * dur), 1) * np.exp(-np.maximum(0, tt - peak * dur) / (dur * 0.35))
    return norm(y * shape)


def thump(dur=0.35, f=70):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    return np.sin(2 * np.pi * (f + 60 * np.exp(-tt / 0.03)) * tt) * np.exp(-tt / 0.09) * np.minimum(1, tt / 0.002)


for e in events:
    t0, ty = e['t'], e['type']
    g = db(20 * np.log10(e.get('g', 1.0)))
    if ty == 'jump_slow':  # slowed-down launch: snap, deep spring, long air whoosh
        place(sfx, click(0.02, 1500, 7000, 0.004), t0, db(-14) * g, 0)
        place(sfx, thump(0.5, 55), t0, db(-12) * g, 0)
        place(sfx, spring(1.6, 520, 150, 0.45), t0 + 0.01, db(-20) * g, -0.1)
        place(sfx, whoosh(2.2, 120, 2400, 0.25), t0 + 0.05, db(-17) * g, 0.2)
        place(send, spring(1.6, 520, 150, 0.45), t0, db(-22) * g, 0)
    elif ty == 'jump_real':  # real speed: a tiny sharp tick and a very short zip
        place(sfx, click(0.01, 3000, 12000, 0.0012), t0, db(-10), 0)
        place(sfx, whoosh(0.18, 1500, 7000, 0.2), t0, db(-19), 0.3)
        place(send, click(0.01, 3000, 12000, 0.0012), t0, db(-20), 0)
    elif ty == 'release':  # the catch lets go
        place(sfx, click(0.02, 1200, 8000, 0.003), t0 - 0.01, db(-11), 0.1)
        place(sfx, spring(0.9, 900, 300, 0.25), t0, db(-24), 0.1)
        place(send, click(0.02, 1200, 8000, 0.003), t0, db(-16), 0)
    elif ty == 'cock':  # legs folding up: a few tiny chitin clicks
        for k in range(4):
            place(sfx, click(0.008, 3500, 10000, 0.0015), t0 + 0.07 * k + rng.uniform(0, 0.02), db(-28), rng.uniform(-0.3, 0.3))
    elif ty == 'tension':  # stretched string / energy building up until the release
        n = int((e['d'] + 0.2) * SR)
        tt = np.arange(n) / SR
        f = 90 * 2 ** (tt / e['d'] * 1.2)
        ph = 2 * np.pi * np.cumsum(f) / SR
        y = (np.sin(ph) + 0.5 * np.sin(2 * ph) + 0.25 * np.sin(3 * ph + 0.3 * np.sin(2 * np.pi * 6 * tt))) * (tt / e['d']) ** 1.5
        y += 0.4 * noise(n, 2000, 8000) * (tt / e['d']) ** 3
        y *= np.minimum(1, (n / SR - tt) / 0.05)
        place(sfx, norm(y), t0, db(-27), 0)
    elif ty == 'flight':  # slow-motion air rush
        n = int(e['d'] * SR)
        tt = np.arange(n) / SR
        y = noise(n, 150, 900) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.35 * tt)) * env(n, 0.3, 0.8)
        place(sfx, norm(y), t0, db(-27), 0)
    elif ty == 'land':
        place(sfx, click(0.03, 800, 5000, 0.006), t0, db(-20), 0)
        place(sfx, noise(int(0.25 * SR), 2000, 9000) * np.exp(-np.arange(int(0.25 * SR)) / (0.05 * SR)) * 0.4, t0 + 0.01, db(-26), 0.2)
    elif ty == 'steps':  # flea footsteps, stylised tiny ticks (a real flea is inaudible)
        tt0 = t0 + 0.05
        while tt0 < t0 + e['d']:
            place(sfx, click(0.006, 4000, 12000, 0.0008), tt0, db(rng.uniform(-36, -32)), rng.uniform(-0.2, 0.2))
            tt0 += 0.11 + rng.uniform(-0.015, 0.015)
    elif ty == 'cut':
        place(sfx, whoosh(0.35, 400, 3000, 0.5), t0 - 0.17, db(-28), 0)
    elif ty == 'outro':
        for i, m in enumerate([72, 76, 79, 84]):
            n = int(1.8 * SR)
            tt = np.arange(n) / SR
            b = (np.sin(2 * np.pi * mtof(m) * tt) + 0.3 * np.sin(4 * np.pi * mtof(m) * tt) * np.exp(-tt * 3)) * np.exp(-tt * 2.2) * np.minimum(1, tt / 0.004)
            place(sfx, b, t0 + 0.08 * i, db(-27), -0.3 + 0.2 * i)

# ---------------------------------------------------------------- ambience
amb = np.zeros((2, N))
fur_on = ss(29.5, 29.7, t_axis) * (1 - ss(34.0, 34.2, t_axis))
room = noise(N, 40, 400)
amb += np.stack([room, np.roll(room, 1500)]) / np.abs(room).max() * db(-36) * (1 - fur_on)
# in the fur: a cat's soft purr (≈26 Hz pulses of low noise)
purr = noise(N, 60, 500) * (0.5 + 0.5 * np.sin(2 * np.pi * 26 * t_axis)) ** 2 * (0.7 + 0.3 * np.sin(2 * np.pi * 0.5 * t_axis))
amb += np.stack([purr, purr]) / np.abs(purr).max() * db(-26) * fur_on
amb *= ss(0, 0.6, t_axis) * (1 - ss(DUR - 0.6, DUR, t_axis))

# ---------------------------------------------------------------- music: light, tense science documentary
BPM = 104
beat = 60 / BPM
music = np.zeros((2, N))


def pluck(freq, dur=0.32, bright=1.0):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    y = sum(np.sin(2 * np.pi * freq * k * tt) * np.exp(-tt * (9 + 5 * k * bright)) / k for k in (1, 2, 3, 4))
    return y * np.minimum(1, tt / 0.002)


def pad_note(freq, dur, att=1.5):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    y = sum(np.sin(2 * np.pi * freq * (1 + d) * tt + 0.25 * np.sin(2 * np.pi * 0.3 * tt)) for d in (-0.004, 0, 0.005)) / 3
    return y * env(n, att, 1.8)


# sections: (start, end, root midi, minor?)  — D minor / Bb / F / C …
SECT = [(0, 4.6, 50, True), (4.6, 12.8, 46, False), (12.8, 22.0, 50, True), (22.0, 25.4, 43, True),
        (25.4, 34.1, 46, False), (34.1, 40.2, 50, True), (40.2, DUR, 41, False)]
arp = np.zeros((2, N))
pad = np.zeros(N)
for a, b, root, minor in SECT:
    third = 3 if minor else 4
    chord = [root, root + 7, root + 12, root + 12 + third, root + 19]
    for m in chord[:4]:
        sig = pad_note(mtof(m), b - a + 1.6, 0.8 if a > 0 else 1.5) * (1.2 if m == root else 0.8)
        i0 = int(a * SR)
        pad[i0:i0 + len(sig[: N - i0])] += sig[: N - i0]
    # staccato ostinato in 8ths (the "tick-tock" of a lab documentary)
    pat = [12, 19, 12 + third, 19, 24, 19, 12 + third, 19]
    k = int(np.ceil(a / (beat / 2)))
    while k * beat / 2 < b:
        tt0 = k * beat / 2
        m = root + 12 + pat[k % 8]
        vel = 0.75 if k % 2 == 0 else 0.5
        place(arp, pluck(mtof(m), 0.3) * vel, tt0, 1.0, 0.35 * np.sin(k * 0.9))
        k += 1
pad = fft_filter(pad, lo=50, hi=1400)
music += np.stack([pad, np.roll(pad, 700)]) * 0.9
# arp density: thin at the start, full during the mechanism, airy in flight, gone at the outro
arp_g = 0.55 + 0.45 * ss(12.8, 15.0, t_axis) - 0.35 * ss(25.4, 26.0, t_axis) * (1 - ss(33.6, 34.4, t_axis)) - 0.6 * ss(40.0, 41.0, t_axis)
arp_g *= 1 - 0.85 * ss(21.8, 22.0, t_axis) * (1 - ss(23.2, 24.6, t_axis))  # breath at the release
music += arp * arp_g * 0.55
# soft pulse (kick-ish) under the build-up
pulse = np.zeros((2, N))
k = 0
while k * beat < DUR:
    tt0 = k * beat
    if 12.8 <= tt0 < 21.9 or 34.1 <= tt0 < 39.8:
        place(pulse, thump(0.3, 50), tt0, 0.6 + 0.4 * ss(15, 21.5, tt0), 0)
    if 15.0 <= tt0 < 21.9:  # ticking hats while the muscle loads
        place(pulse, click(0.03, 6000, 14000, 0.006), tt0 + beat / 2, 0.25, 0.2)
    k += 1
music += pulse * 0.5
music = norm(music)
music *= ss(0, 0.8, t_axis) * (1 - ss(DUR - 1.2, DUR, t_axis) * 0.95)

# ---------------------------------------------------------------- mix
wet = reverb(send) * db(-4)
music_st = music * db(-12) * (1 - duck * (1 - db(-10)))
amb_st = amb * db(8) * (1 - duck * (1 - db(-4)))
sfx_st = (sfx + wet) * (1 - ss(DUR - 0.4, DUR, t_axis))
mix = narr + music_st + amb_st + sfx_st
peak = np.abs(mix).max()
scale = db(-1) / peak if peak > db(-1) else 1.0
mix *= scale
out = os.path.join(ROOT, 'out/audio')
os.makedirs(out, exist_ok=True)
write_wav(os.path.join(out, 'stem_narration.wav'), narr * scale)
write_wav(os.path.join(out, 'stem_music.wav'), music_st * scale)
write_wav(os.path.join(out, 'stem_ambience.wav'), amb_st * scale)
write_wav(os.path.join(out, 'stem_sfx.wav'), sfx_st * scale)
write_wav(os.path.join(ROOT, 'out/soundtrack.wav'), mix)
print('peak', round(20 * np.log10(peak), 2), 'dBFS', '| events', len(events))
