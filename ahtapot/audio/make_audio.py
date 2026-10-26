"""Sound design for "Ahtapotların 3 Kalbi Var, Peki Neden?" (same workflow as ari-dansi).

Stems: narration, music, ambience, sfx  +  final mix (48 kHz stereo).
Inputs: audio/raw/take1.mp3 (ElevenLabs, Uğur), out/parts_v/*.cues.json (renderer cues + events).
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
DUR = 42.5
N = int(SR * DUR)
t_axis = np.arange(N) / SR
rng = np.random.default_rng(11)


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
    a = (pan + 1) * np.pi / 4
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


# ---------------------------------------------------------------- narration
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', os.path.join(ROOT, 'audio/raw/take1.mp3'), '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
take = np.frombuffer(raw, dtype=np.float32).astype(np.float64)
SIL = [(2.850, 3.472), (5.672, 6.211), (8.611, 9.301), (12.166, 12.750), (16.483, 17.007), (20.895, 21.304)]
starts = [0.0] + [e for _, e in SIL]
ends = [s for s, _ in SIL] + [len(take) / SR]
PLACE = [1.2, 8.6, 11.6, 18.2, 22.2, 31.0, 36.0]
TEXT = [
    'Bir ahtapotun tam üç kalbi olduğunu biliyor muydun?',
    'İki kalbi kanı solungaçlara gönderir.',
    'Üçüncü kalbi ise kanı vücuduna pompalar.',
    'Ahtapotlar oksijeni sudan solungaçlarıyla alır.',
    'Üç kalbin görev paylaşımı, kan dolaşımının bu sürecini destekler.',
    'Üstelik yüzmek, ahtapotun sistemik kalbinin atışını yavaşlatabilir.',
    'İşte bu yüzden bu canlılar, okyanusun en ilginç sakinlerinden biri!',
]
narr_m = np.zeros(N)
timing = []
for a, b, p, txt in zip(starts, ends, PLACE, TEXT):
    seg = take[int(max(0, a - 0.06) * SR): int((b + 0.1) * SR)].copy()
    f = int(0.02 * SR)
    seg[:f] *= np.linspace(0, 1, f)
    seg[-f:] *= np.linspace(1, 0, f)
    i0 = int(p * SR)
    seg = seg[: N - i0]
    narr_m[i0:i0 + len(seg)] += seg
    timing.append({'start': p, 'end': round(p + len(seg) / SR, 2), 'text': txt})
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
for f in sorted(glob.glob(os.path.join(ROOT, 'out/parts_v/part*.cues.json'))):
    cues += json.load(open(f))['cues']
cues.sort(key=lambda c: c['t'])
events = json.load(open(sorted(glob.glob(os.path.join(ROOT, 'out/parts_v/part*.cues.json')))[0]))['events']
ct = np.array([c['t'] for c in cues])
ox = np.interp(t_axis, ct, np.clip([c['octo']['x'] for c in cues], -1, 1))
od = np.interp(t_axis, ct, [c['octo']['d'] for c in cues])
ojet = np.interp(t_axis, ct, [c['octo']['jet'] for c in cues])

# ---------------------------------------------------------------- sfx
sfx = np.zeros((2, N))


def bubble(f0=None, dur=None):
    f0 = f0 or rng.uniform(350, 1100)
    dur = dur or rng.uniform(0.025, 0.07)
    n = int(dur * SR)
    tt = np.arange(n) / SR
    fz = f0 * (1 + 2.2 * tt / dur)
    return np.sin(2 * np.pi * np.cumsum(fz) / SR) * np.exp(-tt / (dur * 0.35)) * np.minimum(1, tt / 0.002)


def bell(freq, dur=1.6, partials=((1, 1, 1), (2.76, 0.45, 2.2), (5.4, 0.25, 3.5))):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    y = sum(a * np.sin(2 * np.pi * freq * r * tt) * np.exp(-tt * d * 2.2) for r, a, d in partials)
    return y * np.minimum(1, tt / 0.003) / 1.7


def swish(dur=0.7, lo=200, hi=1600):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    x = fft_filter(rng.standard_normal(n), lo=lo, hi=hi)
    return norm(x) * np.sin(np.pi * tt / dur) ** 2


def thump(f=58, dur=0.22):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    fz = f * (1 + 0.8 * np.exp(-tt * 30))
    return np.sin(2 * np.pi * np.cumsum(fz) / SR) * np.exp(-tt * 18) * np.minimum(1, tt / 0.004)


def sparkle(base=1318.5, notes=(0, 4, 7, 12, 16), step=0.06):
    out = np.zeros(int((step * len(notes) + 1.2) * SR))
    for i, nt in enumerate(notes):
        b = bell(base * 2 ** (nt / 12), 1.0) * (0.8 - 0.08 * i)
        i0 = int(i * step * SR)
        out[i0:i0 + len(b)] += b
    return out


# swim strokes: soft water swishes on each closing stroke while swimming
swim_on = lambda t: (0.9 < t < 4.2) or (17.0 < t < 30.5) or (35.8 < t < 42.3)
tb = 0.3
while tb < DUR:
    if swim_on(tb):
        i = min(int(tb * SR), N - 1)
        g = db(-27) / (1 + od[i] / 6)
        place(sfx, swish(0.6, 150, 1200), tb, g, float(ox[i]) * 0.6)
    tb += 1.35

for e in events:
    t0, ty = e['t'], e['type']
    if ty == 'bubbles':
        for k in range(14):
            place(sfx, bubble(), t0 + k * rng.uniform(0.05, 0.16), db(-24), float(rng.uniform(-0.3, 0.3)))
    elif ty == 'accent':  # soft emphasis on "3 KALBİ VAR?!"
        n = int(0.9 * SR)
        tt = np.arange(n) / SR
        whoomp = np.sin(2 * np.pi * np.cumsum(90 + 60 * np.exp(-tt * 6)) / SR) * np.exp(-tt * 4.5)
        place(sfx, whoomp, t0, db(-14), 0)
        place(sfx, sparkle(1046.5, (0, 4, 7, 12), 0.05), t0 + 0.05, db(-20), 0)
    elif ty == 'xray':
        n = int(1.4 * SR)
        tt = np.arange(n) / SR
        riser = fft_filter(rng.standard_normal(n), lo=1500, hi=8000) * (tt / 1.4) ** 2
        place(sfx, norm(riser), t0 - 0.6, db(-26), 0)
        place(sfx, sparkle(1568, (0, 7, 12, 19), 0.07), t0 + 0.6, db(-22), 0.1)
    elif ty == 'ping':
        place(sfx, bell(1760, 1.4), t0, db(-24), 0)
    elif ty == 'sparkle':
        place(sfx, sparkle(2093, (0, 4, 7, 12, 16, 19), 0.05), t0, db(-25), -0.2)
        for k in range(10):
            place(sfx, bubble(rng.uniform(700, 1400)), t0 + k * 0.12, db(-28), float(rng.uniform(-0.5, 0.5)))
    elif ty == 'jet':
        place(sfx, swish(1.4, 80, 900), t0 - 0.2, db(-12), 0)
        for k in range(30):
            place(sfx, bubble(rng.uniform(300, 900)), t0 + k * rng.uniform(0.02, 0.09), db(-22), float(rng.uniform(-0.6, 0.6)))
    elif ty == 'accent_soft':
        place(sfx, sparkle(1046.5, (0, 7, 12, 16), 0.09), t0, db(-21), 0)
    elif ty == 'beat':  # lub-dub, felt more than heard
        place(sfx, thump(60), t0, db(-17), 0)
        place(sfx, thump(52, 0.18), t0 + 0.2, db(-21), 0)

# ---------------------------------------------------------------- ambience
amb = np.zeros((2, N))
brown = np.cumsum(rng.standard_normal(N))
brown = fft_filter(brown - np.convolve(brown, np.ones(4800) / 4800, mode='same'), lo=25, hi=320)
swell = 0.7 + 0.3 * np.sin(2 * np.pi * 0.09 * t_axis) * np.sin(2 * np.pi * 0.13 * t_axis + 1)
amb += np.stack([norm(brown), np.roll(norm(brown), 2400)]) * swell * db(-17)
hiss = fft_filter(rng.standard_normal((2, N)).reshape(-1), lo=900, hi=3200).reshape(2, N)
amb += norm(hiss) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.07 * t_axis)) * db(-34)
# far-away bubble streams
tb = 0.2
while tb < DUR - 0.2:
    burst = int(rng.integers(1, 5))
    pan = float(rng.uniform(-0.9, 0.9))
    for k in range(burst):
        place(amb, bubble(rng.uniform(500, 1500)), tb + k * rng.uniform(0.03, 0.1), db(rng.uniform(-36, -30)), pan)
    tb += rng.uniform(0.25, 0.9)
# octopus bubble trail while jetting
for i in np.where(np.diff((ojet > 0.3).astype(int)) != 0)[0]:
    pass
tb = 30.6
while tb < 35.4:
    place(amb, bubble(rng.uniform(250, 700)), tb, db(-26), float(ox[int(tb * SR)]))
    tb += rng.uniform(0.03, 0.08)
fade = ss(0, 0.8, t_axis) * (1 - ss(42.0, 42.5, t_axis))
amb *= fade

# ---------------------------------------------------------------- music
music = np.zeros((2, N))
BEAT = 60 / 84
BAR = 4 * BEAT
CH = {  # pad voicing, arpeggio, bass
    'Dm': ([50, 57, 62, 65], [62, 65, 69, 74, 77, 74, 69, 65], 38),
    'Bb': ([50, 53, 58, 62], [58, 62, 65, 70, 74, 70, 65, 62], 34),
    'F': ([53, 57, 60, 65], [60, 65, 69, 72, 77, 72, 69, 65], 41),
    'C': ([52, 55, 60, 64], [60, 64, 67, 72, 76, 72, 67, 64], 36),
    'Gm': ([50, 55, 58, 62], [58, 62, 67, 70, 74, 70, 67, 62], 43),
    'A': ([49, 52, 57, 61], [57, 61, 64, 69, 73, 69, 64, 61], 45),
}
song = ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'Gm', 'A', 'Dm', 'F', 'Bb', 'C', 'F', 'C', 'Bb', 'F']


def pad_note(freq, dur):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    y = sum(2 / np.pi * np.arctan(3 * np.sin(2 * np.pi * freq * (1 + d) * tt)) for d in (-0.005, 0, 0.006))
    return y * env(n, 1.2, 1.2) / 3


def harp(freq, dur=1.8, vel=1.0):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    y = np.sin(2 * np.pi * freq * tt) * np.exp(-tt * 2.6) + 0.3 * np.sin(4 * np.pi * freq * tt) * np.exp(-tt * 5) + 0.12 * np.sin(6 * np.pi * freq * tt) * np.exp(-tt * 9)
    return y * np.minimum(1, tt / 0.003) * vel


pad = np.zeros(N)
arp = np.zeros((2, N))
bass = np.zeros(N)
for b, ch in enumerate(song):
    t0 = b * BAR
    if t0 >= DUR:
        break
    voicing, notes, root = CH[ch]
    final = b == len(song) - 1
    for m in voicing:
        sig = pad_note(mtof(m), (DUR - t0 + 0.5) if final else BAR + 1.2)
        i0 = int(t0 * SR)
        pad[i0:i0 + len(sig[: N - i0])] += sig[: N - i0]
    sec = 0 if t0 < 7 else 1 if t0 < 17 else 2 if t0 < 30 else 3
    step = BEAT / 2
    for i, m in enumerate(notes):
        if sec == 0 and i % 2:
            continue
        place(arp, harp(mtof(m + (12 if sec == 3 and i % 4 == 0 else 0)), 1.8, 0.8 if i % 4 else 1.0), t0 + i * step, 1.0, 0.45 * np.sin(i * 0.8 + b))
    if sec >= 1:
        sig = harp(mtof(root), 2.4, 1.0)
        i0 = int(t0 * SR)
        bass[i0:i0 + len(sig[: N - i0])] += sig[: N - i0]
    if final:
        for k, m in enumerate([65, 69, 72, 77, 81]):
            place(arp, harp(mtof(m), 3.0, 0.9), t0 + 0.4 + k * 0.08, 1.0, -0.4 + 0.2 * k)
        break
pad = fft_filter(pad, lo=80, hi=1400)
music[0] += pad
music[1] += np.roll(pad, 400)
music += arp * 0.5
music += np.stack([fft_filter(bass, hi=500), fft_filter(bass, hi=500)]) * 0.7
music = norm(music)
dyn = 0.55 + 0.2 * ss(6, 8.5, t_axis) - 0.1 * ss(17, 19, t_axis) * (1 - ss(29, 31, t_axis)) + 0.25 * ss(30.5, 33, t_axis)
music *= dyn * ss(0, 1.0, t_axis) * (1 - ss(41.4, 42.5, t_axis) * 0.9)

# ---------------------------------------------------------------- mix
music_st = music * db(-10) * (1 - duck * (1 - db(-10)))
amb_st = amb * (1 - duck * (1 - db(-6)))
sfx_st = sfx * (1 - duck * (1 - db(-4))) * (1 - ss(42.1, 42.5, t_axis))
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
