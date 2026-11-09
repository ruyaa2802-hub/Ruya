"""Müzik + ses efektleri (seslendirme yok). Tamamen prosedürel, telifsiz.
Çıktı: output/ses.wav (48 kHz, stereo)"""
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
import wave

SR = 48000
DUR = 35.0
N = int(SR * DUR)
rng = np.random.default_rng(7)
L = np.zeros(N); Rr = np.zeros(N)
T = np.arange(N) / SR


def lp(x, f, o=2): return sosfilt(butter(o, f, 'low', fs=SR, output='sos'), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, 'high', fs=SR, output='sos'), x)
def bp(x, a, b, o=2): return sosfilt(butter(o, [a, b], 'band', fs=SR, output='sos'), x)
def hz(n): return 440.0 * 2 ** ((n - 69) / 12)
def idx(t): return int(t * SR)


def add(sig, t0, gain=1.0, pan=0.0):
    i = idx(t0); j = min(N, i + len(sig))
    if j <= i: return
    s = sig[:j - i] * gain
    L[i:j] += s * np.sqrt(0.5 * (1 - pan)); Rr[i:j] += s * np.sqrt(0.5 * (1 + pan))


def env_ar(n, a, r):
    e = np.ones(n); na, nr = int(a * SR), int(r * SR)
    if na: e[:na] = np.linspace(0, 1, na)
    if nr: e[-nr:] *= np.linspace(1, 0, nr)
    return e


def saw(f, n, ph=0.0):
    t = np.arange(n) / SR
    return 2 * ((f * t + ph) % 1.0) - 1


def noise(n): return rng.standard_normal(n)


# ---------------- MÜZİK ----------------
music = np.zeros((2, N))
def madd(sig, t0, g=1.0, pan=0.0):
    i = idx(t0); j = min(N, i + len(sig))
    if j <= i: return
    s = sig[:j - i] * g
    music[0, i:j] += s * np.sqrt(0.5 * (1 - pan)); music[1, i:j] += s * np.sqrt(0.5 * (1 + pan))

chords = [
    (0.2, 5.2, [50, 57, 62, 65], 0.22, 700),        # Dm (yumuşak, hastane)
    (5.0, 12.2, [38, 50, 57, 62, 65, 69], 0.42, 1100),  # Dm (zaman)
    (12.0, 17.2, [34, 46, 50, 53, 58], 0.5, 900),    # Bb (şehir)
    (17.0, 23.2, [31, 43, 50, 55, 58], 0.42, 800),   # Gm (görüşme)
    (23.0, 28.2, [27, 39, 46, 51, 55], 0.46, 750),   # Eb (ret, hüzün)
    (28.0, 30.6, [34, 46, 50, 53, 58], 0.5, 1400),   # Bb
    (30.5, 32.65, [36, 48, 52, 55, 60], 0.6, 2000),  # C (yükseliş)
    (32.6, 34.65, [26, 38, 45, 50, 53, 57, 62], 0.95, 2800),  # Dm büyük final
]
for k, (a, b, notes, g, cut) in enumerate(chords):
    n = int((b - a + 0.6) * SR); sig = np.zeros(n)
    for nt in notes:
        for det in (-0.08, 0.0, 0.07):
            sig += saw(hz(nt) * 2 ** (det / 12), n, rng.random())
    sig = lp(sig, cut, 2) / (len(notes) * 3)
    sig *= env_ar(n, 0.15 if k >= 6 else 0.9, 0.6)
    pan = -0.25 if k % 2 else 0.25
    madd(sig, a, g, pan * 0.5); madd(np.roll(sig, 900), a, g * 0.7, -pan * 0.5)

def bass_line(t0, t1, root, step=0.3):
    t = t0
    while t < t1:
        n = int(0.28 * SR); s = lp(saw(hz(root), n) + 0.5 * saw(hz(root) * 1.005, n), 420, 2)
        s *= np.exp(-np.arange(n) / SR * 9); madd(s, t, 0.5); t += step
for a, b, r in [(7.0, 12.0, 38), (12.0, 17.0, 34), (28.0, 30.5, 34), (30.5, 32.6, 36)]:
    bass_line(a, b, r)

def pluck(f, dur=1.6):
    n = int(dur * SR); t = np.arange(n) / SR
    s = sum((0.6 ** h) * np.sin(2 * np.pi * f * (h + 1) * t) * np.exp(-t * (2.5 + h * 1.6)) for h in range(5))
    return s * np.minimum(1, t * 400)
# hastane ninni motifi + görüşme melodisi
mel = [(0.8, 74), (1.6, 77), (2.4, 76), (3.2, 74), (4.0, 69),
       (17.4, 67), (18.0, 70), (18.6, 69), (19.2, 67), (20.4, 62), (21.0, 67), (21.6, 70), (22.2, 74),
       (23.4, 72), (24.0, 70), (24.6, 67), (25.4, 63), (26.2, 67), (27.0, 62)]
for t, nt in mel: madd(pluck(hz(nt)), t, 0.2, rng.uniform(-0.3, 0.3))

def boom(dur=1.8, f0=90, f1=38):
    n = int(dur * SR); t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t * 18)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.2)
    s += lp(noise(n), 2500) * np.exp(-t * 25) * 0.4
    return s
for t, g in [(5.0, 0.55), (12.0, 0.75), (17.0, 0.5), (23.1, 0.6), (28.0, 0.75)]:
    madd(boom(), t, g)
n = int(2.8 * SR); tt = np.arange(n) / SR
riser = bp(noise(n), 400, 6000) * (tt / 2.8) ** 2.5 + np.sin(2 * np.pi * np.cumsum(200 + 1400 * (tt / 2.8) ** 2) / SR) * (tt / 2.8) ** 3 * 0.4
madd(riser, 29.8, 0.35)
for i in range(28):
    t = 31.2 + 1.4 * (1 - (1 - i / 28) ** 1.5); m = int(0.12 * SR)
    madd(hp(noise(m), 1200) * np.exp(-np.arange(m) / SR * 40), t, 0.08 + 0.25 * i / 28, rng.uniform(-0.3, 0.3))
madd(boom(2.6, 120, 32), 32.6, 1.3)
m = int(2.0 * SR); madd(hp(noise(m), 4000) * np.exp(-np.arange(m) / SR * 2.0), 32.6, 0.25)
ir_n = int(2.6 * SR); ir_t = np.arange(ir_n) / SR
ir = noise(ir_n) * np.exp(-ir_t * 2.6); ir[0] = 0; ir = lp(ir, 5000) * 0.02
for c in range(2):
    music[c] += fftconvolve(music[c], ir if c == 0 else np.roll(ir, 37))[:N] * 0.9

# ---------------- SFX ----------------
def blip(f, d=0.08): n = int(d * SR); return np.sin(2 * np.pi * f * np.arange(n) / SR) * env_ar(n, 0.003, d * 0.6)
def seg_noise(t0, t1, kind, g, fade=0.4):
    n = idx(t1) - idx(t0)
    if kind == 'rain': s = hp(noise(n), 1500) * 0.5 + bp(noise(n), 400, 1200) * 0.3
    elif kind == 'traffic': s = lp(noise(n), 180, 4) * 3
    elif kind == 'crowd': s = bp(noise(n), 300, 1800) * (0.6 + 0.4 * lp(np.abs(noise(n)), 4))
    elif kind == 'room': s = lp(noise(n), 250) * 0.6 + 0.04 * np.sin(2 * np.pi * 120 * np.arange(n) / SR) * (1 + 0.3 * np.sin(2 * np.pi * 3 * np.arange(n) / SR))
    elif kind == 'muffled': s = lp(hp(noise(n), 200), 900) * 0.6
    s = s * env_ar(n, fade, fade)
    add(s, t0, g, -0.2); add(np.roll(s, 2000), t0, g, 0.2)
def step(wet=False):
    m = int(0.12 * SR); x = np.arange(m) / SR
    s = lp(noise(m), 900) * np.exp(-x * 45) + np.sin(2 * np.pi * 75 * x) * np.exp(-x * 40)
    if wet: s += hp(noise(m), 2500) * np.exp(-x * 30) * 0.5
    return s
def whoosh(d=0.45):
    n = int(d * SR); x = np.arange(n) / SR
    return bp(noise(n), 300, 6000) * np.sin(np.pi * x / d) ** 2

# 1) hastane: monitör bipleri, cama vuran yağmur, oda sesi
for t in (0.72, 2.38, 4.05): add(blip(1320, 0.12), t, 0.1, -0.3)
seg_noise(0.0, 5.1, 'muffled', 0.06); seg_noise(0.0, 5.1, 'room', 0.08)
n = int(0.6 * SR); x = np.arange(n) / SR; add(bp(noise(n), 300, 5000) * (x / 0.6) ** 2, 4.45, 0.3)
add(pluck(hz(86), 1.4) * 0.8 + pluck(hz(93), 1.4) * 0.5, 4.95, 0.16)
# 2) zaman koridoru: hızlanan saat tikleri, geçenlerin whoosh'ları
t = 5.2; dt = 0.5
while t < 11.8:
    m = int(0.03 * SR); add(hp(noise(m), 3000) * np.exp(-np.arange(m) / SR * 160), t, 0.22, 0.4 if int(t * 50) % 2 else -0.4)
    t += dt; dt = max(0.06, dt * 0.93)
for t in (5.8, 6.9, 7.7, 8.6, 9.3, 10.1, 10.8, 11.3): add(whoosh(0.35), t, 0.14, rng.uniform(-0.8, 0.8))
for k in range(int(6.6 / 0.42)):
    add(step(), 5.2 + k * 0.42, 0.12, rng.uniform(-0.1, 0.1))
add(pluck(hz(81), 1.6) * 0.7, 9.6, 0.15)
add(whoosh(0.5), 11.6, 0.5)
# 3) şehir
seg_noise(12.0, 17.1, 'rain', 0.11); seg_noise(12.0, 17.1, 'traffic', 0.11); seg_noise(12.0, 17.1, 'crowd', 0.12)
for t in (12.5, 14.2):
    n = int(1.2 * SR); x = np.arange(n) / SR; f = 180 * (1.15 - 0.3 * x / 1.2)
    add((np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.3 * bp(noise(n), 800, 3000)) * np.sin(np.pi * x / 1.2) ** 2, t, 0.12)
for t, f in [(13.4, 420), (15.6, 380)]:
    n = int(0.35 * SR); add(lp(saw(f, n) + saw(f * 1.26, n), 1800) * env_ar(n, 0.01, 0.1), t, 0.04, rng.uniform(-0.7, 0.7))
k = 0
while 14.8 + k * 0.44 < 17.0: add(step(True), 14.8 + k * 0.44, 0.22); k += 1
# 4) görüşme odası
seg_noise(17.0, 26.65, 'room', 0.1); seg_noise(17.0, 26.65, 'muffled', 0.04)
n = int(0.5 * SR); x = np.arange(n) / SR; add(bp(noise(n), 500, 3000) * np.sin(np.pi * x / 0.5), 16.95, 0.22, 0.4)
k = 0
while 17.1 + k * 0.44 < 18.8: add(step(), 17.1 + k * 0.44, 0.18, 0.2); k += 1
n = int(0.6 * SR); add(bp(noise(n), 200, 900) * env_ar(n, 0.05, 0.3) * 0.5, 20.0, 0.35)   # sandalyeden kalkış
add(np.concatenate([blip(988, 0.09), blip(1319, 0.2)]), 22.6, 0.2)                        # hologram seçer
n = int(1.5 * SR); add(np.sin(2 * np.pi * 110 * np.arange(n) / SR) * (1 + 0.4 * np.sin(2 * np.pi * 5 * np.arange(n) / SR)) * env_ar(n, 0.1, 0.5), 22.6, 0.05)
add(boom(1.0, 70, 35), 23.1, 0.45)
n = int(0.5 * SR); x = np.arange(n) / SR; add(bp(noise(n), 500, 3000) * np.sin(np.pi * x / 0.5), 25.6, 0.22, 0.4)
k = 0
while 25.15 + k * 0.42 < 26.6: add(step(), 25.15 + k * 0.42, 0.18, 0.3); k += 1
seg_noise(26.6, 28.1, 'muffled', 0.12)
add(whoosh(0.45), 27.7, 0.4)
# 5) final
seg_noise(28.0, 34.7, 'crowd', 0.1); seg_noise(28.0, 34.7, 'traffic', 0.06)
n = idx(35) - idx(29.0); x = np.arange(n) / SR
add(bp(noise(n), 150, 900) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.3 * x)) * env_ar(n, 0.8, 0.5), 29.0, 0.12)

# ---------------- MİKS ----------------
sfx = np.stack([L, Rr])
mix = music * 0.85 + sfx
# müzik finalde sert kesilir (34.65 sn)
cut = idx(34.65)
fade = int(0.012 * SR)
mix[:, cut:cut + fade] *= np.linspace(1, 0, fade)
mix[:, cut + fade:] *= 0.0
# kısa bir kuyruk: kesilmeden sonra sadece rüzgârın son nefesi
tail_n = N - (cut + fade)
if tail_n > 0:
    mix[:, cut + fade:] += 0.02 * lp(noise(tail_n), 600) * np.linspace(1, 0, tail_n)
mix[:, :int(0.02 * SR)] *= np.linspace(0, 1, int(0.02 * SR))
# yumuşak limiter
peak = np.max(np.abs(mix))
mix = mix / peak * 0.98
mix = np.tanh(mix * 1.3) / np.tanh(1.3)
mix *= 0.89
data = (mix.T * 32767).astype(np.int16)
with wave.open('output/ses.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(data.tobytes())
print('ses tamam', data.shape)
