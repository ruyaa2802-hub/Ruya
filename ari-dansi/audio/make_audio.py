"""Sound design for "Arılar Dans Ederek Konuşuyor!".

Builds four stems + a final mix (48 kHz stereo WAV) from:
  * the ElevenLabs Turkish narration take (audio/raw/take2.mp3), split at its pauses
    and placed on the picture timeline,
  * per-frame cues exported by the renderer (out/parts/*.cues.json): Pırıltı's
    screen position and distance drive pan / volume / pitch of her buzz,
  * the timeline events (whoosh, sparkle, landing ...),
  * procedural synthesis (numpy only) for ambience, SFX and music.

Run:  python3 audio/make_audio.py
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
rng = np.random.default_rng(7)

# ---------------------------------------------------------------- helpers
def ss(a, b, x):
    u = np.clip((x - a) / (b - a), 0, 1)
    return u * u * (3 - 2 * u)


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


def pink(n):
    X = np.fft.rfft(rng.standard_normal(n))
    f = np.fft.rfftfreq(n, 1 / SR)
    f[0] = 1
    y = np.fft.irfft(X / np.sqrt(f), n)
    return y / (np.abs(y).max() + 1e-9)


def env_adsr(n, a, d, s_level, r, sr=SR):
    e = np.ones(n) * s_level
    na, nd, nr = int(a * sr), int(d * sr), int(r * sr)
    na = min(na, n)
    e[:na] = np.linspace(0, 1, na, endpoint=False)
    if nd > 0 and na < n:
        k = min(nd, n - na)
        e[na:na + k] = np.linspace(1, s_level, k, endpoint=False)
    if nr > 0:
        k = min(nr, n)
        e[n - k:] *= np.linspace(1, 0, k)
    return e


def place(buf, sig, t0, gain=1.0, pan=0.0):
    """Add mono signal into stereo buf at time t0 with equal-power pan (-1..1)."""
    i0 = int(round(t0 * SR))
    if i0 >= N:
        return
    if i0 < 0:
        sig = sig[-i0:]
        i0 = 0
    sig = sig[: N - i0]
    a = (pan + 1) * np.pi / 4
    buf[0, i0:i0 + len(sig)] += sig * gain * np.cos(a)
    buf[1, i0:i0 + len(sig)] += sig * gain * np.sin(a)


def place_st(buf, sig, t0, gain, pan_arr):
    i0 = int(round(t0 * SR))
    sig = sig[: N - i0]
    pan_arr = pan_arr[: len(sig)]
    a = (pan_arr + 1) * np.pi / 4
    buf[0, i0:i0 + len(sig)] += sig * gain * np.cos(a)
    buf[1, i0:i0 + len(sig)] += sig * gain * np.sin(a)


def write_wav(path, x):
    x = np.clip(x, -1, 1)
    data = (x.T * 32767).astype(np.int16)
    with wave.open(path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())


def db(x):
    return 10 ** (x / 20)


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


# ---------------------------------------------------------------- narration
def load_mp3(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


take = load_mp3(os.path.join(ROOT, 'audio/raw/take2.mp3'))
# pause boundaries measured with ffmpeg silencedetect (-38 dB, 0.28 s)
SIL = [(2.2535, 2.8597), (5.3007, 5.8310), (7.6919, 8.1858), (13.9958, 14.4621), (18.1469, 18.5626), (22.6358, 23.0774), (27.2112, 27.6476)]
cuts = [0.0] + [s for s in SIL for s in s]
segments = []
starts = [0.0] + [e for (_, e) in SIL]
ends = [s for (s, _) in SIL] + [len(take) / SR]
for a, b in zip(starts, ends):
    segments.append((max(0, a - 0.06), b + 0.1))
PLACE = [1.2, 4.2, 9.7, 12.1, 18.8, 24.6, 31.8, 37.0]
TEXT = [
    'Bir arının çiçek tarlası bulduğunu düşün.',
    'Peki, arkadaşlarına yolu nasıl anlatır?',
    'İşte sırrı: Dans ederek!',
    'Bal arıları, özel bir sallanma dansıyla diğer arılara besinin yönü ve uzaklığı hakkında bilgi verir.',
    'Dansın yönü, güneşe göre hangi tarafa uçmaları gerektiğini anlatır.',
    'Dansın süresi ise ne kadar uzağa gitmeleri gerektiği hakkında ipucu verir.',
    'Yani bu minik canlılar, kovanda adeta dans ederek konum paylaşıyor!',
    'Doğanın en şaşırtıcı iletişim yöntemlerinden biri, değil mi?',
]
narr = np.zeros((2, N))
narr_mono = np.zeros(N)
timing = []
for (a, b), p, txt in zip(segments, PLACE, TEXT):
    seg = take[int(a * SR): int(b * SR)].copy()
    f = int(0.02 * SR)
    seg[:f] *= np.linspace(0, 1, f)
    seg[-f:] *= np.linspace(1, 0, f)
    i0 = int(p * SR)
    seg = seg[: N - i0]
    narr_mono[i0:i0 + len(seg)] += seg
    timing.append({'start': p, 'end': round(p + len(seg) / SR, 2), 'text': txt})
# gentle presence EQ: tame lows, slight air
narr_mono = fft_filter(narr_mono, lo=80, order=2)
narr_mono *= db(-3.0) / (np.abs(narr_mono).max() + 1e-9)
narr[0] = narr[1] = narr_mono

# ducking envelope (1 when narration speaks)
win = int(0.03 * SR)
rms = np.sqrt(np.convolve(narr_mono ** 2, np.ones(win) / win, mode='same'))
speech = (rms > db(-42)).astype(float)
# attack 60 ms, release 450 ms smoothing
duck = np.zeros(N)
a_c, r_c = np.exp(-1 / (0.06 * SR)), np.exp(-1 / (0.45 * SR))
# vectorised-enough smoothing via chunked loop (downsample → smooth → upsample)
ds = 48
sp = speech[::ds]
d_s = np.zeros_like(sp)
acc = 0.0
a_k, r_k = a_c ** ds, r_c ** ds
for i, v in enumerate(sp):
    acc = (a_k * acc + (1 - a_k) * v) if v > acc else (r_k * acc + (1 - r_k) * v)
    d_s[i] = acc
duck = np.interp(np.arange(N), np.arange(len(d_s)) * ds, d_s)

# ---------------------------------------------------------------- cues
cues = []
for f in sorted(glob.glob(os.path.join(ROOT, 'out/parts/part*.cues.json'))):
    cues += json.load(open(f))['cues']
cues.sort(key=lambda c: c['t'])
events = json.load(open(sorted(glob.glob(os.path.join(ROOT, 'out/parts/part*.cues.json')))[0]))['events']
ct = np.array([c['t'] for c in cues])
cx = np.array([c['hero']['x'] for c in cues])
cd = np.array([c['hero']['d'] for c in cues])
con = np.array([1.0 if c['hero']['on'] and c['hero']['vis'] else 0.35 for c in cues])
cworld = np.array([0.0 if c['world'] == 'garden' else 1.0 for c in cues])
caer = np.array([c['aerial'] for c in cues])
cdd = np.gradient(cd, ct)
hx = np.interp(t_axis, ct, np.clip(cx, -1, 1))
hd = np.interp(t_axis, ct, cd)
hon = np.interp(t_axis, ct, con)
hdd = np.interp(t_axis, ct, np.clip(cdd, -30, 30))
hive_w = np.interp(t_axis, ct, cworld)
aer = np.interp(t_axis, ct, caer)


def hero_wing(t):
    w = np.ones_like(t)
    m = (t >= 4.7) & (t < 7.65)
    w[m] = 1 - ss(4.7, 5.05, t[m]) + ss(7.35, 7.65, t[m])
    m = (t >= 10.25) & (t < 31.0)
    w[m] = 1 - ss(10.25, 10.55, t[m])
    m = (t >= 31.0) & (t < 38.6)
    w[m] = ss(31.0, 31.35, t[m])
    m = (t >= 38.6) & (t < 39.9)
    w[m] = 1 - ss(38.6, 38.9, t[m]) + ss(39.6, 39.9, t[m])
    return w


# ---------------------------------------------------------------- buzz synthesis
def buzz_tone(f_inst, bright=1.0, nh=16):
    ph = 2 * np.pi * np.cumsum(f_inst) / SR
    y = np.zeros_like(ph)
    for k in range(1, nh + 1):
        y += np.sin(k * ph + 0.3 * k) * (1 / k ** (1.35 - 0.25 * bright))
    # wing-beat amplitude flutter
    y *= 0.75 + 0.25 * np.sin(ph * 0.5)
    return y / 3.0


sfx = np.zeros((2, N))
# Pırıltı's buzz
wing = hero_wing(t_axis)
f0 = 236 * (1 + 0.012 * np.sin(2 * np.pi * 3.1 * t_axis)) * np.clip(1 - hdd / 55, 0.86, 1.14)
hb = buzz_tone(f0)
hb = fft_filter(hb, lo=120, hi=4500)
vol = wing * hon / (1 + hd / 2.2) * (1 - 0.55 * aer)
hb *= vol
place_st(sfx, hb, 0, db(-11), hx * 0.8)

# waggle-run pulses (wing vibration while dancing)
for e in events:
    if e['type'] != 'waggle':
        continue
    n = int(e['dur'] * SR)
    tt = np.arange(n) / SR
    am = np.abs(np.sin(2 * np.pi * 7.5 * tt)) ** 3 * ss(0, 0.08, tt) * (1 - ss(e['dur'] - 0.1, e['dur'], tt))
    tone = fft_filter(buzz_tone(np.full(n, 255.0), bright=1.3), lo=150, hi=3500)
    place(sfx, tone * am, e['t'], db(-15), 0.05)

# swarm buzz (followers flying): hive 31.7–33.45, garden 33.6–40.3
swarm_env = ss(31.6, 32.3, t_axis) * (1 - ss(38.6, 40.4, t_axis))
for i in range(6):
    fz = 214 + i * 9.5 + 3 * np.sin(2 * np.pi * (0.4 + 0.1 * i) * t_axis + i)
    s = fft_filter(buzz_tone(fz, nh=12), lo=120, hi=3800)
    pan = np.sin(2 * np.pi * 0.11 * t_axis + i * 1.1) * 0.7
    place_st(sfx, s * swarm_env, 0, db(-24), pan)

# ---------------------------------------------------------------- sfx library
def noise_burst(dur, lo, hi, a=0.005, r=None):
    n = int(dur * SR)
    x = fft_filter(rng.standard_normal(n), lo=lo, hi=hi, order=3)
    e = env_adsr(n, a, 0, 1, r or dur * 0.8)
    return x * e / (np.abs(x).max() + 1e-9)


def whoosh(dur=0.7, rise=0.45, bright=1.0):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    out = np.zeros(n)
    bands = [(150, 600), (500, 1800), (1500, 5000 * bright)]
    for k, (lo, hi) in enumerate(bands):
        c = rise * (0.6 + 0.3 * k)
        e = np.exp(-((tt - c) / (0.16 + 0.04 * k)) ** 2)
        out += fft_filter(rng.standard_normal(n), lo=lo, hi=hi, order=2) * e * (1 - 0.25 * k)
    return out / (np.abs(out).max() + 1e-9)


def bell(freq, dur=1.6, partials=((1, 1, 1), (2.76, 0.45, 2.2), (5.4, 0.25, 3.5), (8.93, 0.12, 5))):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    y = sum(a * np.sin(2 * np.pi * freq * r * tt) * np.exp(-tt * d * 2.2) for r, a, d in partials)
    y *= np.minimum(1, tt / 0.003)
    return y / 1.8


def thump(freq=120, dur=0.18):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    fz = freq * (1 + 1.5 * np.exp(-tt * 40))
    y = np.sin(2 * np.pi * np.cumsum(fz) / SR) * np.exp(-tt * 28)
    return y + 0.25 * noise_burst(dur, 800, 4000, r=0.05)[:n]


def boing(f1=380, f2=760, dur=0.22):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    fz = f1 + (f2 - f1) * (1 - np.exp(-tt * 18))
    return np.sin(2 * np.pi * np.cumsum(fz) / SR) * np.sin(np.pi * tt / dur) ** 1.5


def sparkle(base=1046.5, notes=(0, 4, 7, 12, 16), step=0.07):
    out = np.zeros(int((step * len(notes) + 1.2) * SR))
    for i, nt in enumerate(notes):
        b = bell(base * 2 ** (nt / 12), 1.0) * (0.8 - 0.08 * i)
        i0 = int(i * step * SR)
        out[i0:i0 + len(b)] += b
    return out


for e in events:
    t0, ty = e['t'], e['type']
    if ty == 'whoosh':
        n = int(0.8 * SR)
        place_st(sfx, whoosh(0.8, 0.42), t0 - 0.4, db(-9), np.linspace(0.8, -0.8, n))
    elif ty == 'swoosh_soft':
        place(sfx, whoosh(1.0, 0.5, 0.7), t0 - 0.5, db(-17), 0)
        place(sfx, sparkle(1568, (0, 7, 12), 0.09), t0 - 0.1, db(-27), 0.2)
    elif ty == 'flash':
        n = int(1.4 * SR)
        tt = np.arange(n) / SR
        riser = fft_filter(rng.standard_normal(n), lo=800, hi=9000) * (tt / 1.4) ** 2.5
        place(sfx, riser / np.abs(riser).max(), t0 - 1.3, db(-16), 0)
        place(sfx, sparkle(1396.9, (0, 4, 7, 12, 16, 19), 0.05), t0 - 0.05, db(-20), 0)
        place(sfx, whoosh(0.9, 0.3, 1.2), t0 - 0.1, db(-14), 0)
    elif ty in ('land', 'land_soft'):
        place(sfx, thump(150 if ty == 'land' else 190), t0, db(-17 if ty == 'land' else -20), 0)
    elif ty == 'land_small':
        place(sfx, thump(210, 0.12), t0, db(-25), float(rng.uniform(-0.5, 0.5)))
    elif ty == 'sparkle':
        place(sfx, sparkle(), t0, db(-21), 0.1)
    elif ty == 'hop':
        place(sfx, boing(), t0, db(-24), 0)
    elif ty == 'chime':
        place(sfx, bell(1318.5, 2.0), t0, db(-19), 0)
        place(sfx, bell(1975.5, 1.6), t0 + 0.05, db(-26), 0.15)
    elif ty == 'pop':
        place(sfx, boing(600, 1100, 0.12), t0, db(-24), 0)
    elif ty == 'zip':
        place(sfx, boing(700, 1500, 0.9) * np.linspace(1, 0.4, int(0.9 * SR)), t0, db(-28), 0.3)
    elif ty == 'tick_fill':
        k = 0
        while k * 0.125 < e['dur']:
            tk = noise_burst(0.02, 2500, 9000, a=0.0005, r=0.015)
            place(sfx, tk, t0 + k * 0.125, db(-23 + (3 if k % 4 == 0 else 0)), 0)
            k += 1
        place(sfx, bell(1760, 1.2), t0 + e['dur'], db(-22), 0)
    elif ty == 'takeoff':
        place(sfx, whoosh(0.6, 0.35, 0.8), t0 - 0.1, db(-22), 0)
    elif ty == 'turn':
        place(sfx, whoosh(0.5, 0.25, 1.1), t0, db(-24), 0)
        place(sfx, sparkle(1568, (0, 4, 7, 12), 0.06), t0 + 0.35, db(-23), 0)
    elif ty == 'blink':
        place(sfx, bell(2637, 0.6), t0, db(-29), 0)

# ---------------------------------------------------------------- ambience
amb = np.zeros((2, N))
garden_w = 1 - hive_w
garden_w = np.maximum(garden_w, aer * 0.7)
garden_w = np.clip(garden_w, 0, 1)
# smooth the world switch
k = int(0.25 * SR)
garden_w = np.convolve(garden_w, np.ones(k) / k, mode='same')
hive_s = np.clip(1 - garden_w, 0, 1)
fade_in = ss(0, 0.8, t_axis)
fade_out = 1 - ss(42.0, 42.5, t_axis)

breeze = np.stack([fft_filter(pink(N), lo=60, hi=1600), fft_filter(pink(N), lo=60, hi=1600)])
breeze *= (0.8 + 0.2 * np.sin(2 * np.pi * 0.07 * t_axis))
breeze /= np.abs(breeze).max()
amb += breeze * garden_w * db(-30)
leaves = np.stack([fft_filter(rng.standard_normal(N), lo=2500, hi=9000), fft_filter(rng.standard_normal(N), lo=2500, hi=9000)])
leaves /= np.abs(leaves).max()
amb += leaves * (0.5 + 0.5 * np.sin(2 * np.pi * 0.13 * t_axis + 1)) ** 2 * garden_w * db(-42)


def chirp_call(kind):
    if kind == 0:  # quick rising tweets
        parts = []
        for i in range(int(rng.integers(2, 5))):
            d = rng.uniform(0.05, 0.09)
            n = int(d * SR)
            tt = np.arange(n) / SR
            fz = rng.uniform(2800, 3600) + rng.uniform(800, 1600) * tt / d
            y = (np.sin(2 * np.pi * np.cumsum(fz) / SR) + 0.2 * np.sin(4 * np.pi * np.cumsum(fz) / SR)) * np.sin(np.pi * tt / d) ** 2
            parts += [y, np.zeros(int(rng.uniform(0.04, 0.09) * SR))]
        return np.concatenate(parts)
    else:  # descending whistle with trill
        d = rng.uniform(0.35, 0.6)
        n = int(d * SR)
        tt = np.arange(n) / SR
        fz = rng.uniform(4200, 5000) - 1600 * tt / d + 220 * np.sin(2 * np.pi * 28 * tt)
        return np.sin(2 * np.pi * np.cumsum(fz) / SR) * np.sin(np.pi * tt / d) ** 1.5


tb = 0.3
while tb < DUR - 0.5:
    c = chirp_call(int(rng.random() < 0.3))
    pos = rng.uniform(-0.9, 0.9)
    g = db(rng.uniform(-36, -29))
    i0 = int(tb * SR)
    w = garden_w[min(i0, N - 1)]
    if w > 0.05:
        place(amb, c, tb, g * w, pos)
    tb += rng.uniform(0.35, 1.3)

# hive: dense low hum of many bees + soft wax room tone
hum = np.zeros(N)
for i in range(14):
    fz = 190 + rng.uniform(0, 90) + 4 * np.sin(2 * np.pi * rng.uniform(0.1, 0.5) * t_axis + i)
    hum += buzz_tone(fz, bright=0.6, nh=8) * (0.6 + 0.4 * np.sin(2 * np.pi * rng.uniform(0.05, 0.3) * t_axis + i))
hum = fft_filter(hum, lo=90, hi=1400)
hum /= np.abs(hum).max()
room = fft_filter(pink(N), lo=40, hi=400)
room /= np.abs(room).max()
hum_st = np.stack([hum, np.roll(hum, 977)])
amb += hum_st * hive_s * db(-27) + np.stack([room, room]) * hive_s * db(-34)
amb *= fade_in * fade_out

# ---------------------------------------------------------------- music
music = np.zeros((2, N))
BPM = 96
BEAT = 60 / BPM
BAR = 4 * BEAT
EIGHTH = BEAT / 2


def marimba(freq, dur=0.9, vel=1.0):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    y = np.sin(2 * np.pi * freq * tt) * np.exp(-tt * 5.5)
    y += 0.35 * np.sin(2 * np.pi * freq * 3.93 * tt) * np.exp(-tt * 22)
    y += 0.12 * np.sin(2 * np.pi * freq * 9.2 * tt) * np.exp(-tt * 45)
    y *= np.minimum(1, tt / 0.002)
    return y * vel


def pluck_bass(freq, dur=0.7, vel=1.0):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    y = (np.sin(2 * np.pi * freq * tt) + 0.4 * np.sin(4 * np.pi * freq * tt) * np.exp(-tt * 8)) * np.exp(-tt * 4.5)
    return y * np.minimum(1, tt / 0.004) * vel


def pad_note(freq, dur, vel=1.0):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    y = np.zeros(n)
    for det in (-0.006, 0.0, 0.0065):
        ph = 2 * np.pi * freq * (1 + det) * tt
        y += 2 / np.pi * np.arctan(4 * np.sin(ph)) * 0.5 + 0.25 * np.sin(2 * ph)
    y *= env_adsr(n, 0.7, 0.4, 0.85, 0.9)
    return y * vel / 3


CH = {  # chord tones as midi notes (pad voicing, arpeggio pool, bass)
    'F': ([53, 57, 60, 65], [65, 69, 72, 77, 72, 69, 67, 69], 41),
    'Dm': ([50, 57, 62, 65], [62, 65, 69, 74, 69, 65, 64, 65], 38),
    'Bb': ([50, 53, 58, 62], [62, 65, 70, 74, 70, 65, 62, 65], 34),
    'C': ([52, 55, 60, 64], [64, 67, 72, 76, 72, 67, 64, 67], 36),
    'Am': ([52, 57, 60, 64], [64, 69, 72, 76, 72, 69, 67, 69], 33),
    'Gm': ([50, 55, 58, 62], [62, 67, 70, 74, 70, 67, 65, 67], 31),
    'Csus': ([53, 55, 60, 65], [65, 67, 72, 77, 72, 67, 65, 67], 36),
}
song = ['F', 'Dm', 'Bb', 'C', 'F', 'Am', 'Bb', 'C', 'Gm', 'Csus', 'Am', 'Dm', 'Bb', 'C', 'Dm', 'C', 'F', 'F']
pad_l = np.zeros(N)
mar = np.zeros((2, N))
bass = np.zeros(N)
bells = np.zeros((2, N))
perc = np.zeros((2, N))


def add(buf, sig, t0, gain=1.0):
    i0 = int(t0 * SR)
    if i0 >= N:
        return
    sig = sig[: N - i0]
    buf[i0:i0 + len(sig)] += sig * gain


for b, ch in enumerate(song):
    tb = b * BAR
    if tb >= DUR:
        break
    voicing, arp, root = CH[ch]
    last = b == len(song) - 1 or tb + BAR > DUR
    for m in voicing:
        add(pad_l, pad_note(mtof(m), BAR + 0.8 if not b >= 16 else DUR - tb + 0.5), tb, 0.55)
    section = 0 if tb < 10 else 1 if tb < 20 else 2 if tb < 30 else 3
    if b >= 16:  # final chord: gentle marimba roll + bells
        for i, m in enumerate([65, 69, 72, 77, 81]):
            place(mar, marimba(mtof(m), 2.5, 0.8), tb + i * 0.09, 1.0, -0.4 + 0.2 * i)
        place(bells, bell(mtof(84), 3.0), tb + 0.5, 0.5, 0.2)
        add(bass, pluck_bass(mtof(root), 2.4), tb, 1.0)
        break
    # arpeggio (8ths); sparser in the explanation section
    for i, m in enumerate(arp):
        if section == 2 and i % 2 == 1:
            continue
        vel = (0.95 if i % 4 == 0 else 0.7) * (0.75 if section == 0 else 1.0)
        place(mar, marimba(mtof(m), 0.9, vel), tb + i * EIGHTH, 1.0, 0.35 * np.sin(i * 0.9 + b))
    if section >= 1:
        add(bass, pluck_bass(mtof(root)), tb, 0.9)
        add(bass, pluck_bass(mtof(root + 7)), tb + 2 * BEAT, 0.6)
        if section == 3:
            add(bass, pluck_bass(mtof(root + 12), 0.4), tb + 3.5 * BEAT, 0.45)
    if section == 2:  # curious bell motif
        for j, (dt, m) in enumerate([(0, 81), (1.5, 79), (2.5, 76)]):
            place(bells, bell(mtof(m + (2 if b % 2 else 0)), 1.6), tb + dt * BEAT, 0.42, 0.4 - 0.4 * j)
    if section == 3:  # light shaker + bright melody
        for i in range(8):
            place(perc, noise_burst(0.06, 5000, 12000, a=0.002, r=0.05), tb + i * EIGHTH, 0.12 if i % 2 else 0.2, 0.3)
        mel = {12: [(0, 77), (1, 79), (2, 81), (3, 84)], 13: [(0, 84), (1.5, 81), (2, 79), (3, 76)],
               14: [(0, 77), (1, 81), (2, 79), (3, 77)], 15: [(0, 79), (1, 76), (2, 79), (3, 84)]}.get(b, [])
        for dt, m in mel:
            place(bells, bell(mtof(m), 1.4, ((1, 1, 1), (2.0, 0.3, 1.6), (3.0, 0.12, 2.5))), tb + dt * BEAT, 0.5, 0.0)

pad = fft_filter(pad_l, lo=90, hi=1800)
music[0] += pad * 0.9
music[1] += np.roll(pad, 311) * 0.9
music += mar * 0.55
music[0] += fft_filter(bass, hi=900) * 0.8
music[1] += fft_filter(bass, hi=900) * 0.8
music += bells * 0.45 + perc
music /= np.abs(music).max()
# arrangement dynamics: soft intro, quieter during the explanation, lift in scene 4
dyn = 0.55 + 0.25 * ss(8.5, 10.5, t_axis) - 0.15 * ss(18, 19.5, t_axis) * (1 - ss(29.5, 31.5, t_axis)) + 0.25 * ss(30.5, 33.5, t_axis)
music *= dyn * fade_in * (1 - ss(41.6, 42.5, t_axis) * 0.85)

# ---------------------------------------------------------------- mix
duck_m = 1 - duck * (1 - db(-10))
duck_a = 1 - duck * (1 - db(-6))
duck_s = 1 - duck * (1 - db(-4))
music_st = music * db(-10) * duck_m
amb_st = amb * duck_a
sfx_st = sfx * db(2) * duck_s * fade_out
mix = narr + music_st + amb_st + sfx_st
peak = np.abs(mix).max()
if peak > db(-1):
    mix *= db(-1) / peak
    scale = db(-1) / peak
else:
    scale = 1.0

out = os.path.join(ROOT, 'out/audio')
os.makedirs(out, exist_ok=True)
write_wav(os.path.join(out, 'stem_narration.wav'), narr * scale)
write_wav(os.path.join(out, 'stem_music.wav'), music_st * scale)
write_wav(os.path.join(out, 'stem_ambience.wav'), amb_st * scale)
write_wav(os.path.join(out, 'stem_sfx.wav'), sfx_st * scale)
write_wav(os.path.join(ROOT, 'out/soundtrack.wav'), mix)
json.dump(timing, open(os.path.join(out, 'narration_timing.json'), 'w'), ensure_ascii=False, indent=1)
print('peak before limit', round(20 * np.log10(peak), 2), 'dBFS; written to', out)
