"""Sound design for "Yarasalar Karanlıkta Nasıl Yolunu Buluyor?" (same workflow as ari-dansi / ahtapot).

Stems: narration, music, ambience, sfx  +  final mix (48 kHz stereo).
Inputs: audio/raw/take1.mp3 (ElevenLabs, Uğur), out/parts/part*.cues.json (renderer cues + events).
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
DUR = 45.0
N = int(SR * DUR)
t_axis = np.arange(N) / SR
rng = np.random.default_rng(7)


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


def conv(x, ir):
    n = len(x) + len(ir) - 1
    m = 1 << (n - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, m) * np.fft.rfft(ir, m), m)[: len(x)]


# cave reverb: long dark tail with a few early reflections
ir_n = int(2.6 * SR)
ir_t = np.arange(ir_n) / SR
IR = [fft_filter(rng.standard_normal(ir_n), lo=120, hi=hi) * np.exp(-ir_t / 0.55) for hi in (2600, 2900)]
for k, d in enumerate([0.031, 0.047, 0.083, 0.121]):
    for c in range(2):
        IR[c][int((d + 0.004 * c) * SR)] += 0.6 / (k + 1)
IR = [ir / np.sqrt((ir ** 2).sum()) for ir in IR]


def reverb(st):
    return np.stack([conv(st[0] + st[1] * 0.3, IR[0]), conv(st[1] + st[0] * 0.3, IR[1])])


# ---------------------------------------------------------------- narration
def load(name):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', os.path.join(ROOT, 'audio/raw', name), '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


take = load('take1.mp3')
# sentence boundaries from silencedetect (-38 dB / 0.28 s) and their place on the timeline
CLIPS = [
    (0.16, 4.84, 0.70, 'Göz gözü görmeyen bir karanlıkta, bu yarasa küçücük bir böceği nasıl bulabiliyor?'),
    (5.48, 10.08, 5.70, 'Sırrı, bizim duyamadığımız kadar yüksek frekanslı seslerde: ultrasonlarda!'),
    (10.55, 11.77, 12.50, 'Yarasa ses gönderiyor.'),
    (12.22, 14.09, 13.90, 'Ses bir engele çarpıp geri dönüyor.'),
    (14.54, 15.85, 16.60, 'Yarasa da yankıyı dinliyor.'),
    (16.30, 23.23, 22.20, 'Yankının ne kadar sürede döndüğünü ve nasıl değiştiğini analiz ederek, nesnenin uzaklığını, yönünü ve hareketini anlayabiliyor.'),
    (23.62, 27.19, 33.40, 'Yani yarasa, çevresinin seslerden oluşan bir haritasını çıkarıyor.'),
    (27.56, 30.24, 37.50, 'Karanlık onun için tamamen kör olmak demek değil!'),
]
narr_m = np.zeros(N)
timing = []
for a, b, p, txt in CLIPS:
    seg = take[int(max(0, a - 0.06) * SR): int((b + 0.1) * SR)].copy()
    f = int(0.02 * SR)
    seg[:f] *= np.linspace(0, 1, f)
    seg[-f:] *= np.linspace(1, 0, f)
    i0 = int((p - 0.06) * SR)
    seg = seg[: N - i0]
    narr_m[i0:i0 + len(seg)] += seg
    timing.append({'start': p, 'end': round(p + (b - a), 2), 'text': txt})
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

# ---------------------------------------------------------------- cues
cues = []
CUE_FILES = sorted(glob.glob(os.path.join(ROOT, 'out/parts/part*.cues.json')))
for f in CUE_FILES:
    cues += json.load(open(f))['cues']
cues.sort(key=lambda c: c['t'])
events = json.load(open(CUE_FILES[-1]))['events']
ct = np.array([c['t'] for c in cues])
cph = np.array([c['ph'] for c in cues])
chz = np.array([c['hz'] for c in cues])
cd = np.array([c['d'] for c in cues])
cx = np.clip(np.array([c['x'] for c in cues]), -1, 1)
at = lambda arr, t: float(np.interp(t, ct, arr))

# ---------------------------------------------------------------- sfx
sfx = np.zeros((2, N))
send = np.zeros((2, N))  # reverb send


def chirp(f0, f1, dur, shape=2.0):
    """Short downward FM sweep — an audible stand-in for the bat's ultrasonic call."""
    n = max(8, int(dur * SR))
    tt = np.arange(n) / SR
    u = tt / dur
    fz = f1 + (f0 - f1) * (1 - u) ** shape
    y = np.sin(2 * np.pi * np.cumsum(fz) / SR)
    return y * np.sin(np.pi * np.minimum(1, u)) ** 1.5


def flap(dur, bright):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    x = fft_filter(rng.standard_normal(n), lo=90, hi=600 + 900 * bright)
    e = (tt / dur) ** 0.6 * np.exp(-tt / (dur * 0.35))
    return norm(x * e)


def swish(dur=0.7, lo=200, hi=1600):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    x = fft_filter(rng.standard_normal(n), lo=lo, hi=hi)
    return norm(x) * np.sin(np.pi * tt / dur) ** 2


def bell(freq, dur=1.6, partials=((1, 1, 1), (2.76, 0.4, 2.2), (5.4, 0.2, 3.5))):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    y = sum(a * np.sin(2 * np.pi * freq * r * tt) * np.exp(-tt * d * 2.2) for r, a, d in partials)
    return y * np.minimum(1, tt / 0.003) / 1.6


# wing flaps: one soft "fwup" per downstroke; quieter far away, slower and deeper in slow motion
k = int(np.ceil(cph[0]))
while k < cph[-1]:
    t0 = float(np.interp(k, cph, ct))
    hz = at(chz, t0)
    d = at(cd, t0)
    if t0 > 0.8:
        slow = hz < 3.5
        g = db(-15 if slow else -19) / (1 + max(0.0, d - 1.0) / 2.2)
        place(sfx, flap(min(0.32, 0.45 / hz), 0.3 if slow else 0.8), t0 - 0.02, g, at(cx, t0) * 0.7)
    k += 1

# bat sweeps past/into frame in scene 1
place(sfx, swish(1.1, 120, 1400), 2.9, db(-17), -0.1)
place(send, swish(1.1, 120, 1400), 2.9, db(-22), -0.1)

for e in events:
    t0, ty, kind = e['t'], e['type'], e.get('kind')
    pan = at(cx, t0) * 0.6
    if ty == 'pulse':
        f0, f1, dur, g = {
            's2': (5200, 2600, 0.012, -27),
            'demo': (4200, 1900, 0.045, -21),  # slow motion: longer, lower
            'hunt': (4800, 2300, 0.016, -26),
            'buzz': (5200, 3000, 0.006, -29),
            'nav': (5000, 2500, 0.010, -31),
        }[kind]
        s = chirp(f0, f1, dur)
        place(sfx, s, t0, db(g), pan)
        place(send, s, t0, db(g - 6), pan)
    elif ty == 'echo':
        f0, f1, dur, g = {'demo': (4200, 1900, 0.045, -29), 'hunt': (4800, 2300, 0.016, -33), 'buzz': (5200, 3000, 0.006, -36)}[kind]
        s = fft_filter(chirp(f0, f1, dur * 1.3), hi=2600)
        place(sfx, s, t0, db(g), -pan)
        place(send, s, t0, db(g - 2), -pan)
    elif ty == 'dart':  # moth wings flutter as it dodges
        n = int(0.8 * SR)
        tt = np.arange(n) / SR
        fl = fft_filter(rng.standard_normal(n), lo=300, hi=2500) * (0.5 + 0.5 * np.sin(2 * np.pi * 22 * tt)) * np.sin(np.pi * tt / 0.8)
        place(sfx, norm(fl), t0, db(-30), 0.4)
    elif ty == 'catch':  # soft snap + low body + a tiny bell, accented but gentle
        n = int(0.004 * SR)
        click = fft_filter(rng.standard_normal(n), lo=1500, hi=7000) * np.hanning(n)
        place(sfx, norm(click), t0, db(-17), 0.1)
        n = int(0.25 * SR)
        tt = np.arange(n) / SR
        body = np.sin(2 * np.pi * np.cumsum(140 * (1 + 0.6 * np.exp(-tt * 40))) / SR) * np.exp(-tt * 22)
        place(sfx, body, t0, db(-16), 0.1)
        place(sfx, swish(0.45, 300, 2500), t0 - 0.25, db(-22), 0.1)
        for i, m in enumerate([86, 90, 93]):
            place(sfx, bell(mtof(m), 1.2), t0 + 0.05 + 0.05 * i, db(-29), 0.1)
        place(send, bell(mtof(86), 1.2), t0 + 0.05, db(-26), 0.1)
    elif ty == 'outro':
        for i, m in enumerate([74, 81, 86, 90]):
            place(sfx, bell(mtof(m), 2.2), t0 + 0.09 * i, db(-26), -0.3 + 0.2 * i)
        place(send, bell(mtof(81), 2.0), t0, db(-24), 0)

# ---------------------------------------------------------------- ambience
amb = np.zeros((2, N))
brown = np.cumsum(rng.standard_normal(N))
brown = fft_filter(brown - np.convolve(brown, np.ones(4800) / 4800, mode='same'), lo=22, hi=180)
swell = 0.7 + 0.3 * np.sin(2 * np.pi * 0.07 * t_axis) * np.sin(2 * np.pi * 0.11 * t_axis + 1)
amb += np.stack([norm(brown), np.roll(norm(brown), 3100)]) * swell * db(-18)
air = fft_filter(rng.standard_normal(2 * N), lo=400, hi=1800).reshape(2, N)
amb += norm(air) * (0.55 + 0.45 * np.sin(2 * np.pi * 0.05 * t_axis + 2)) * db(-36)
# water drips echoing in the cave
tb = 0.4
while tb < DUR - 0.5:
    n = int(0.06 * SR)
    tt = np.arange(n) / SR
    f0 = rng.uniform(900, 1700)
    drip = np.sin(2 * np.pi * np.cumsum(f0 * (1 + 1.5 * tt / 0.06)) / SR) * np.exp(-tt / 0.012) * np.minimum(1, tt / 0.001)
    p = float(rng.uniform(-0.8, 0.8))
    g = db(rng.uniform(-36, -29))
    place(amb, drip, tb, g, p)
    place(send, drip, tb, g * 1.4, p)
    tb += rng.uniform(0.9, 2.6)
amb *= ss(0, 0.9, t_axis) * (1 - ss(DUR - 0.6, DUR, t_axis))

# ---------------------------------------------------------------- music (dark, sparse ambient)
music = np.zeros((2, N))


def pad_note(freq, dur, att=2.0):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    y = sum(np.sin(2 * np.pi * freq * (1 + d) * tt + 0.3 * np.sin(2 * np.pi * 0.2 * tt)) for d in (-0.004, 0, 0.005))
    return y * env(n, att, 2.0) / 3


def pluck(freq, dur=2.4, vel=1.0):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    y = np.sin(2 * np.pi * freq * tt) * np.exp(-tt * 1.8) + 0.25 * np.sin(4 * np.pi * freq * tt) * np.exp(-tt * 4)
    return y * np.minimum(1, tt / 0.004) * vel


# (start, length, voicing)
CHORDS = [(0, 8, [38, 45, 50, 53, 57]), (8, 6, [34, 46, 50, 53, 58]), (14, 8, [31, 43, 50, 55, 58]), (22, 8.5, [33, 45, 49, 52, 57]),
          (30.5, 2.8, [38, 45, 50, 54, 57]), (33.3, 7.2, [34, 46, 50, 53, 58]), (40.5, 6, [38, 45, 50, 54, 57, 62])]
pad = np.zeros(N)
for t0, L, voice in CHORDS:
    for m in voice:
        sig = pad_note(mtof(m), L + 2.0, 1.6 if t0 > 0 else 3.0) * (1.3 if m < 40 else 1.0)
        i0 = int(t0 * SR)
        pad[i0:i0 + len(sig[: N - i0])] += sig[: N - i0]
pad = fft_filter(pad, lo=40, hi=1200)
music += np.stack([pad, np.roll(pad, 600)])
# sparse high plucks (echo-like, answer each other left/right)
pl = np.zeros((2, N))
for t0, m in [(1.5, 74), (4.2, 77), (8.6, 74), (10.2, 81), (14.6, 79), (18.8, 74), (20.4, 82), (33.8, 77), (35.6, 81), (37.9, 82), (41.0, 86), (41.5, 81)]:
    place(pl, pluck(mtof(m)), t0, 0.5, -0.5)
    place(pl, pluck(mtof(m)), t0 + 0.33, 0.25, 0.5)
music += pl
# a soft heartbeat-like low pulse building tension during the hunt (22–30 s)
tb = 22.2
while tb < 29.9:
    n = int(0.2 * SR)
    tt = np.arange(n) / SR
    thump = np.sin(2 * np.pi * np.cumsum(55 * (1 + 0.5 * np.exp(-tt * 30))) / SR) * np.exp(-tt * 16)
    place(music, thump, tb, 0.9 * (0.6 + 0.4 * (tb - 22) / 8), 0)
    tb += 0.75 - 0.4 * (tb - 22.2) / 7.7
music = norm(music)
dyn = 0.6 + 0.15 * ss(12, 14, t_axis) + 0.2 * ss(24, 29.5, t_axis) * (1 - ss(30.0, 31.5, t_axis)) + 0.15 * ss(40, 41.5, t_axis)
music *= dyn * ss(0, 1.5, t_axis) * (1 - ss(DUR - 1.4, DUR, t_axis) * 0.95)

# ---------------------------------------------------------------- mix
wet = reverb(send) * db(-4)
music_st = music * db(-10) * (1 - duck * (1 - db(-10)))
amb_st = (amb + wet * 0.5) * (1 - duck * (1 - db(-5)))
sfx_st = (sfx + wet * 0.5) * (1 - duck * (1 - db(-3))) * (1 - ss(DUR - 0.4, DUR, t_axis))
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
json.dump(timing, open(os.path.join(out, 'narration_timing.json'), 'w'), ensure_ascii=False, indent=1)
print('peak', round(20 * np.log10(peak), 2), 'dBFS; narration ends', timing[-1]['end'], 's')
