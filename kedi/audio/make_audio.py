"""Sound design for "Kediler Neden İnsanlara Miyavlıyor?" (same workflow as ari-dansi / ahtapot / yarasa).

Stems: narration, music, ambience, sfx  +  final mix (48 kHz stereo).
Inputs: audio/raw/take1.mp3 (ElevenLabs, Uğur), audio/clips.json (sentence placement),
        audio/sfx/*.mp3 (ElevenLabs sound effects: meows, hiss, purr), out/parts/part*.cues.json (events).
Run:   python3 audio/make_audio.py
"""
import glob
import json
import os
import subprocess
import wave

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 48000
DUR = 48.6
N = int(SR * DUR)
t_axis = np.arange(N) / SR
rng = np.random.default_rng(5)


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


def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def resample(x, factor):
    """Play back `factor` times faster (pitch up, shorter); factor < 1 = lower and longer."""
    n = int(len(x) / factor)
    return np.interp(np.arange(n) * factor, np.arange(len(x)), x)


def conv(x, ir):
    n = len(x) + len(ir) - 1
    m = 1 << (n - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, m) * np.fft.rfft(ir, m), m)[: len(x)]


# small-room reverb (indoor) for the sound effects
ir_n = int(0.9 * SR)
ir_t = np.arange(ir_n) / SR
IR = [fft_filter(rng.standard_normal(ir_n), lo=150, hi=5000) * np.exp(-ir_t / 0.16) for _ in range(2)]
IR = [ir / np.sqrt((ir ** 2).sum()) for ir in IR]


def reverb(st):
    return np.stack([conv(st[0] + 0.3 * st[1], IR[0]), conv(st[1] + 0.3 * st[0], IR[1])])


# ---------------------------------------------------------------- narration
take = load(os.path.join(ROOT, 'audio/raw/take1.mp3'))
CLIPS = json.load(open(os.path.join(ROOT, 'audio/clips.json')))  # [take_start, take_end, place]
narr_m = np.zeros(N)
for a, b, p in CLIPS:
    seg = take[int(max(0, a - 0.05) * SR): int((b + 0.12) * SR)].copy()
    f = int(0.015 * SR)
    seg[:f] *= np.linspace(0, 1, f)
    seg[-f:] *= np.linspace(1, 0, f)
    i0 = int((p - 0.05) * SR)
    seg = seg[: N - i0]
    narr_m[i0:i0 + len(seg)] += seg
narr_m = fft_filter(narr_m, lo=80)
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

# ---------------------------------------------------------------- events
CUE_FILES = sorted(glob.glob(os.path.join(ROOT, 'out/parts/part*.cues.json')))
events = json.load(open(CUE_FILES[-1]))['events']

# ---------------------------------------------------------------- sfx
sfx = np.zeros((2, N))
send = np.zeros((2, N))
SFX = os.path.join(ROOT, 'audio/sfx')
meowA = load(os.path.join(SFX, 'meow_a.mp3'))[int(0.06 * SR): int(1.15 * SR)]
meowB = load(os.path.join(SFX, 'meow_b.mp3'))[int(0.04 * SR): int(0.8 * SR)]
hiss = load(os.path.join(SFX, 'hiss.mp3'))
purr = load(os.path.join(SFX, 'purr.mp3'))
meowA, meowB, hiss, purr = (norm(fft_filter(x, lo=120)) for x in (meowA, meowB, hiss, purr))


def shaped(x, dur, fade=0.08):
    """Trim a vocalisation to roughly `dur` seconds with a natural release."""
    n = min(len(x), int((dur + 0.25) * SR))
    y = x[:n].copy()
    f = min(n, int(fade * SR))
    y[-f:] *= np.linspace(1, 0, f) ** 1.5
    y[: int(0.004 * SR)] *= np.linspace(0, 1, int(0.004 * SR))
    return y


k_meow = 0
for e in events:
    t0, ty = e['t'], e['type']
    if ty == 'meow':
        src, fac = [(meowA, 1.0), (meowB, 1.06), (meowA, 1.1), (meowB, 0.97), (meowA, 0.94)][k_meow % 5]
        k_meow += 1
        s = shaped(resample(src, fac), e['d'] * 1.2)
        place(sfx, s, t0 - 0.03, db(-14 if src is meowB else -10), 0.05)
        place(send, s, t0 - 0.03, db(-20), 0.05)
    elif ty == 'hungry':  # longer, lower, insistent
        s = shaped(resample(meowB, 0.86), e['d'] * 1.25, 0.15)
        place(sfx, s, t0 - 0.03, db(-11), 0)
        place(send, s, t0 - 0.03, db(-18), 0)
    elif ty == 'call':  # long calling meow at the door
        s = shaped(resample(meowA, 0.82), e['d'] * 1.3, 0.2)
        place(sfx, s, t0 - 0.03, db(-8), 0)
        place(send, s, t0 - 0.03, db(-14), 0)
    elif ty == 'trill':  # short soft chirp asking for attention
        s = shaped(resample(meowB, 1.32), 0.35, 0.1)
        place(sfx, s, t0 - 0.02, db(-17), 0.1)
    elif ty == 'hiss':
        place(sfx, hiss, t0 - 0.06, db(-10), 0.2)
    elif ty == 'pour':  # kibble rattling into a ceramic bowl
        for k in range(150):
            tt = t0 + rng.uniform(0, 0.85) ** 1.2 * 0.95
            n = int(rng.uniform(0.004, 0.012) * SR)
            click = fft_filter(rng.standard_normal(n), lo=1800, hi=7000) * np.exp(-np.arange(n) / (0.002 * SR))
            place(sfx, norm(click), tt, db(rng.uniform(-36, -27)), rng.uniform(-0.3, 0.3))
        n = int(0.6 * SR)
        ring = sum(np.sin(2 * np.pi * f * np.arange(n) / SR) * np.exp(-np.arange(n) / (0.12 * SR)) for f in (2350, 3810))
        place(sfx, ring / 2, t0 + 0.05, db(-36), 0)
    elif ty == 'door':
        n = int(0.05 * SR)
        latch = fft_filter(rng.standard_normal(n), lo=1500, hi=6000) * np.exp(-np.arange(n) / (0.006 * SR))
        place(sfx, norm(latch), t0, db(-20), -0.2)
        place(sfx, norm(latch), t0 + 0.07, db(-25), -0.2)
        n = int(0.9 * SR)
        tt = np.arange(n) / SR
        creak = np.sin(2 * np.pi * np.cumsum(220 + 90 * np.sin(tt * 7) + 40 * tt) / SR) * fft_filter(rng.standard_normal(n), lo=200, hi=1200)
        creak = norm(creak) * np.sin(np.pi * tt / 0.9) ** 2
        place(sfx, creak, t0 + 0.15, db(-30), -0.2)
        place(send, creak, t0 + 0.15, db(-30), -0.2)
    elif ty == 'cut':  # soft whoosh on the cut
        n = int(0.35 * SR)
        tt = np.arange(n) / SR
        w = fft_filter(rng.standard_normal(n), lo=300, hi=3000) * np.sin(np.pi * tt / 0.35) ** 3
        place(sfx, norm(w), t0 - 0.17, db(-30), 0)
    elif ty == 'outro':
        for i, m in enumerate([77, 81, 84, 89]):
            n = int(1.8 * SR)
            tt = np.arange(n) / SR
            b = (np.sin(2 * np.pi * mtof(m) * tt) + 0.3 * np.sin(4 * np.pi * mtof(m) * tt) * np.exp(-tt * 3)) * np.exp(-tt * 2.2) * np.minimum(1, tt / 0.004)
            place(sfx, b, t0 + 0.08 * i, db(-27), -0.3 + 0.2 * i)

# paw steps (soft) while walking, with grass rustle outdoors
WALKS = [(0.0, 1.3, 0.2, 'in'), (6.5, 7.7, 0.22, 'out'), (12.3, 13.15, 0.22, 'out'), (21.75, 22.2, 0.2, 'in'), (26.35, 27.0, 0.2, 'in'), (30.9, 34.7, 0.36, 'in')]
for a, b, step, where in WALKS:
    tt0 = a + 0.05
    while tt0 < b:
        n = int(0.03 * SR)
        x = fft_filter(rng.standard_normal(n), lo=60, hi=500 if where == 'in' else 2500) * np.exp(-np.arange(n) / (0.006 * SR))
        place(sfx, norm(x), tt0 + rng.uniform(-0.02, 0.02), db(-33 if where == 'in' else -34), rng.uniform(-0.2, 0.2))
        tt0 += step
# eating crunches
for k in range(4):
    n = int(0.05 * SR)
    x = fft_filter(rng.standard_normal(n), lo=900, hi=5000) * np.exp(-np.arange(n) / (0.01 * SR))
    place(sfx, norm(x), 22.22 + k * 0.17, db(-30), 0.2)
# purring through the last shot (seamless loop with crossfades)
pl = np.zeros(int((DUR - 38.9 + 1) * SR))
seg = purr[int(0.3 * SR): int(5.8 * SR)]
L, xf = len(seg), int(0.4 * SR)
pos = 0
while pos < len(pl):
    s = seg.copy()
    s[:xf] *= np.linspace(0, 1, xf)
    s[-xf:] *= np.linspace(1, 0, xf)
    e2 = min(len(pl), pos + L)
    pl[pos:e2] += s[: e2 - pos]
    pos += L - xf
pl = norm(fft_filter(pl, lo=40, hi=3000)) * ss(38.9, 40.0, 38.9 + np.arange(len(pl)) / SR)
place(sfx, pl, 38.9, db(-21), 0.15)

# ---------------------------------------------------------------- ambience
amb = np.zeros((2, N))
indoor = np.ones(N)
outdoor = ((t_axis >= 6.5) & (t_axis < 16.9)).astype(float)
outdoor = np.convolve(outdoor, np.ones(2400) / 2400, mode='same')
indoor = 1 - outdoor
room = fft_filter(rng.standard_normal(N), lo=40, hi=400)
amb += np.stack([room, np.roll(room, 1500)]) / np.abs(room).max() * db(-36) * indoor
hum = np.sin(2 * np.pi * 50 * t_axis) * 0.3 + np.sin(2 * np.pi * 100 * t_axis) * 0.15
amb += hum * db(-52) * indoor
wind = fft_filter(rng.standard_normal(2 * N), lo=150, hi=1400).reshape(2, N)
amb += norm(wind) * db(-30) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.2 * t_axis)) * outdoor
# evening birds + distant crickets in the garden
tb = 6.6
while tb < 16.8:
    n = int(rng.uniform(0.06, 0.16) * SR)
    tt = np.arange(n) / SR
    f0 = rng.uniform(2600, 4200)
    chirp = np.sin(2 * np.pi * np.cumsum(f0 + 900 * np.sin(tt * rng.uniform(30, 60))) / SR) * np.sin(np.pi * tt / tt[-1]) ** 2
    place(amb, chirp, tb, db(rng.uniform(-40, -33)), rng.uniform(-0.9, 0.9))
    tb += rng.uniform(0.25, 1.1)
cr = np.sin(2 * np.pi * 4400 * t_axis) * (np.sin(2 * np.pi * 28 * t_axis) > 0.6) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.7 * t_axis))
amb[0] += cr * db(-50) * outdoor
amb[1] += np.roll(cr, 9000) * db(-52) * outdoor
# evening air through the open door
door_open = ss(25.8, 26.6, t_axis) * (t_axis < 27.0)
amb += np.stack([norm(wind[0]), norm(wind[1])]) * db(-34) * door_open
amb *= ss(0, 0.5, t_axis) * (1 - ss(DUR - 0.6, DUR, t_axis))

# ---------------------------------------------------------------- music (warm, light, playful)
music = np.zeros((2, N))
BEAT = 60 / 92
BAR = 4 * BEAT
PROG = [  # (pad voicing, bass, arpeggio)
    ([53, 57, 60, 64], 41, [65, 69, 72, 76]),   # Fmaj7
    ([52, 55, 59, 62], 36, [64, 67, 71, 74]),   # Cmaj7/E-ish
    ([50, 57, 60, 65], 38, [62, 65, 69, 72]),   # Dm7
    ([48, 55, 58, 64], 43, [67, 70, 72, 76]),   # Gm/C (C7sus)
]


def pluck(freq, dur=1.2, vel=1.0):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    y = np.sin(2 * np.pi * freq * tt) * np.exp(-tt * 5) + 0.35 * np.sin(4 * np.pi * freq * tt) * np.exp(-tt * 9) + 0.1 * np.sin(6 * np.pi * freq * tt) * np.exp(-tt * 14)
    return y * np.minimum(1, tt / 0.002) * vel


def pad_note(freq, dur):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    y = sum(np.sin(2 * np.pi * freq * (1 + d) * tt) for d in (-0.003, 0, 0.004)) / 3
    return y * env(n, 0.6, 0.8)


pad = np.zeros(N)
bass = np.zeros(N)
arp = np.zeros((2, N))
nb = int(np.ceil(DUR / BAR)) + 1
for b in range(nb):
    t0 = b * BAR
    if t0 >= DUR:
        break
    voicing, root, notes = PROG[b % 4]
    for m in voicing:
        sig = pad_note(mtof(m), BAR + 0.8)
        i0 = int(t0 * SR)
        pad[i0:i0 + len(sig[: N - i0])] += sig[: N - i0]
    for k in range(2):
        sig = pluck(mtof(root), 1.0, 0.9)
        i0 = int((t0 + k * 2 * BEAT) * SR)
        if i0 < N:
            bass[i0:i0 + len(sig[: N - i0])] += sig[: N - i0]
    # playful pizzicato arpeggio, sparser while the cats meet and during the calm finale
    dense = not (6.5 <= t0 < 12.3) and t0 < 38.5
    pat = [0, 2, 1, 3, 2, 1, 3, 0] if dense else [0, None, 2, None, 3, None, 1, None]
    for i, idx in enumerate(pat):
        if idx is None:
            continue
        place(arp, pluck(mtof(notes[idx] + (12 if (b % 2 and i == 3) else 0)), 0.9, 0.75 if i % 2 else 0.95), t0 + i * BEAT / 2, 1.0, 0.5 * np.sin(i * 1.3 + b))
pad = fft_filter(pad, lo=90, hi=1800)
music += np.stack([pad, np.roll(pad, 500)]) * 0.55
music += arp * 0.6
music += np.stack([fft_filter(bass, hi=400)] * 2) * 0.8
music = norm(music)
dyn = 0.75 - 0.25 * ss(6.5, 7.5, t_axis) * (1 - ss(11.8, 12.6, t_axis)) - 0.3 * ss(11.4, 11.6, t_axis) * (1 - ss(12.2, 12.6, t_axis)) + 0.15 * ss(44.5, 45.5, t_axis)
music *= dyn * ss(0, 0.6, t_axis) * (1 - ss(DUR - 1.2, DUR, t_axis) * 0.95)

# ---------------------------------------------------------------- mix
wet = reverb(send) * db(-2)
music_st = music * db(-9) * (1 - duck * (1 - db(-10)))
amb_st = amb * db(6) * (1 - duck * (1 - db(-4)))
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
print('peak', round(20 * np.log10(peak), 2), 'dBFS')
