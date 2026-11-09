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


# akor yürüyüşü (Re minör): Dm – Bb – Gm – F – Bb/C yükseliş – Dm final
chords = [
    (0.3, 5.2, [38, 45, 50, 53]),      # Dm
    (5.0, 13.2, [38, 45, 50, 53, 57]),
    (13.0, 19.2, [34, 46, 50, 53]),    # Bb
    (19.0, 25.2, [31, 43, 50, 55]),    # Gm
    (25.0, 29.6, [29, 41, 48, 53, 57]),  # F
    (29.4, 30.9, [34, 46, 50, 53, 58]),  # Bb
    (30.8, 32.25, [36, 48, 52, 55, 60]),  # C
    (32.2, 34.65, [26, 38, 45, 50, 53, 57, 62]),  # Dm büyük
]
for k, (a, b, notes) in enumerate(chords):
    n = int((b - a + 0.6) * SR)
    sig = np.zeros(n)
    for nt in notes:
        for det in (-0.08, 0.0, 0.07):
            sig += saw(hz(nt) * 2 ** (det / 12), n, rng.random())
    cutoff = 900 if k < 7 else 2600
    sig = lp(sig, cutoff, 2) / (len(notes) * 3)
    att = 0.9 if k not in (5, 6, 7) else 0.15
    sig *= env_ar(n, att, 0.6)
    g = 0.5
    if k == 0: g = 0.32
    if k == 7: g = 0.9
    pan = -0.25 if k % 2 else 0.25
    madd(sig, a, g, pan * 0.5); madd(np.roll(sig, 900), a, g * 0.7, -pan * 0.5)

# bas nabzı (100 BPM sekizlik)
def bass_line(t0, t1, root):
    step = 0.3; t = t0
    while t < t1:
        n = int(0.28 * SR); s = lp(saw(hz(root), n) + 0.5 * saw(hz(root) * 1.005, n), 420, 2)
        s *= np.exp(-np.arange(n) / SR * 9)
        madd(s, t, 0.55)
        t += step
for a, b, r in [(5.0, 13.0, 38), (25.0, 29.4, 29), (29.4, 30.8, 34), (30.8, 32.2, 36)]:
    bass_line(a, b, r)

# piyano benzeri pluck melodi (hüzünlü)
def pluck(f, dur=1.6):
    n = int(dur * SR); t = np.arange(n) / SR
    s = sum((0.6 ** h) * np.sin(2 * np.pi * f * (h + 1) * t) * np.exp(-t * (2.5 + h * 1.6)) for h in range(5))
    return s * np.minimum(1, t * 400)
mel = [(13.4, 69), (14.0, 65), (14.6, 64), (15.2, 62), (16.4, 69), (17.0, 70), (17.6, 69), (18.2, 65),
       (19.4, 67), (20.0, 62), (20.6, 63), (21.2, 62), (22.4, 60), (23.0, 62), (23.6, 58), (24.2, 57),
       (25.4, 69), (26.2, 72), (27.0, 69), (27.8, 65), (28.6, 64)]
for t, nt in mel:
    madd(pluck(hz(nt)), t, 0.22, rng.uniform(-0.3, 0.3))

# davul vuruşları
def boom(dur=1.8, f0=90, f1=38):
    n = int(dur * SR); t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t * 18)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.2)
    s += lp(noise(n), 2500) * np.exp(-t * 25) * 0.4
    return s
for t, g in [(5.0, 0.6), (9.0, 0.7), (13.0, 0.7), (25.0, 0.6), (29.4, 0.8)]:
    madd(boom(), t, g)
# final yükseliş (riser) + büyük vuruş
n = int(2.8 * SR); tt = np.arange(n) / SR
riser = bp(noise(n), 400, 6000) * (tt / 2.8) ** 2.5
riser += np.sin(2 * np.pi * np.cumsum(200 + 1400 * (tt / 2.8) ** 2) / SR) * (tt / 2.8) ** 3 * 0.4
madd(riser, 29.4, 0.35)
# snare rulosu
for i in range(28):
    t = 30.8 + 1.4 * (1 - (1 - i / 28) ** 1.5)
    m = int(0.12 * SR); s = hp(noise(m), 1200) * np.exp(-np.arange(m) / SR * 40)
    madd(s, t, 0.08 + 0.25 * i / 28, rng.uniform(-0.3, 0.3))
madd(boom(2.6, 120, 32), 32.2, 1.3)
m = int(2.4 * SR); madd(hp(noise(m), 4000) * np.exp(-np.arange(m) / SR * 2.0), 32.2, 0.25)

# reverb (müziğe)
ir_n = int(2.6 * SR); ir_t = np.arange(ir_n) / SR
ir = noise(ir_n) * np.exp(-ir_t * 2.6); ir[0] = 0; ir = lp(ir, 5000) * 0.02
for c in range(2):
    music[c] += fftconvolve(music[c], ir if c == 0 else np.roll(ir, 37))[:N] * 0.9

# ---------------- SFX ----------------
# kalp atışı + monitör bip (ECG periyodu 0.5 sn)
for k in range(6):
    t = 0.09 + k * 0.5
    if t > 2.6: break
    n = int(0.25 * SR); x = np.arange(n) / SR
    th = np.sin(2 * np.pi * 52 * x) * np.exp(-x * 22)
    add(th, t, 0.9); add(th * 0.6, t + 0.13, 0.6)
    b = np.sin(2 * np.pi * 1320 * np.arange(int(0.09 * SR)) / SR) * env_ar(int(0.09 * SR), 0.004, 0.03)
    add(b, t, 0.12, 0.3)
# zaman atlaması: whoosh + hızlanan saat tikleri + flaş
n = int(0.6 * SR); x = np.arange(n) / SR
add(bp(noise(n), 300, 5000) * (x / 0.6) ** 2, 2.1, 0.35)
add(boom(1.2, 160, 50), 2.7, 0.8)
t = 2.75; dt = 0.16
while t < 4.25:
    m = int(0.03 * SR); s = hp(noise(m), 3000) * np.exp(-np.arange(m) / SR * 160)
    add(s, t, 0.35, 0.4 if int(t * 50) % 2 else -0.4); t += dt; dt = max(0.035, dt * 0.88)
# kilit sesi + çan
m = int(0.06 * SR); add(hp(noise(m), 1500) * np.exp(-np.arange(m) / SR * 90), 4.35, 0.6)
add(pluck(hz(86), 1.2) * 0.8 + pluck(hz(93), 1.2) * 0.5, 4.38, 0.18)
# geçiş whoosh'ları
def whoosh(d=0.45):
    n = int(d * SR); x = np.arange(n) / SR
    e = np.sin(np.pi * x / d) ** 2
    f = np.linspace(600, 3500, n)
    s = bp(noise(n), 300, 6000) * e
    return s
for t in (4.82, 12.78, 20.9, 22.7):
    add(whoosh(), t, 0.45, rng.uniform(-0.5, 0.5))

# şehir ambiyansı: yağmur, trafik uğultusu, kalabalık mırıltısı
def seg_noise(t0, t1, kind, g, fade=0.4):
    n = idx(t1) - idx(t0)
    if kind == 'rain': s = hp(noise(n), 1500) * 0.5 + bp(noise(n), 400, 1200) * 0.3
    elif kind == 'traffic': s = lp(noise(n), 180, 4) * 3
    elif kind == 'crowd':
        s = bp(noise(n), 300, 1800) * (0.6 + 0.4 * lp(np.abs(noise(n)), 4))
    elif kind == 'room': s = lp(noise(n), 250) * 0.6 + 0.04 * np.sin(2 * np.pi * 120 * np.arange(n) / SR) * (1 + 0.3 * np.sin(2 * np.pi * 3 * np.arange(n) / SR))
    s = s * env_ar(n, fade, fade)
    add(s, t0, g, -0.2); add(np.roll(s, 2000), t0, g, 0.2)
seg_noise(5.0, 13.1, 'rain', 0.10); seg_noise(5.0, 13.1, 'traffic', 0.10); seg_noise(5.0, 9.1, 'crowd', 0.12)
seg_noise(13.0, 21.05, 'room', 0.12)
seg_noise(21.0, 25.1, 'rain', 0.15); seg_noise(21.0, 22.9, 'crowd', 0.08); seg_noise(21.0, 25.1, 'traffic', 0.08)
seg_noise(22.8, 25.1, 'room', 0.05)  # cam arkası
seg_noise(25.0, 29.5, 'traffic', 0.08); seg_noise(25.0, 29.5, 'rain', 0.05)
seg_noise(29.4, 32.3, 'traffic', 0.05)
# korna, uçan araç geçişleri
for t, f in [(6.3, 420), (7.9, 380), (11.2, 450)]:
    n = int(0.35 * SR); x = np.arange(n) / SR
    add(lp(saw(f, n) + saw(f * 1.26, n), 1800) * env_ar(n, 0.01, 0.1), t, 0.05, rng.uniform(-0.7, 0.7))
for t in (5.8, 7.2, 10.1, 11.8):
    n = int(1.2 * SR); x = np.arange(n) / SR
    f = 180 * (1.15 - 0.3 * x / 1.2)
    s = (np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.3 * bp(noise(n), 800, 3000)) * np.sin(np.pi * x / 1.2) ** 2
    add(s, t, 0.12, np.linspace(-0.8, 0.8, 1).item())
# metro geçişi 9.5–13
n = int(3.4 * SR); x = np.arange(n) / SR
metro = (lp(noise(n), 300, 4) * 2.5 + 0.3 * np.sin(2 * np.pi * np.cumsum(95 * (1.1 - 0.2 * x / 3.4)) / SR)) * np.sin(np.pi * x / 3.4) ** 1.5
clack = np.zeros(n)
for k in range(14):
    i = int((0.3 + k * 0.22) * SR); m = int(0.04 * SR)
    if i + m < n: clack[i:i + m] += hp(noise(m), 800) * np.exp(-np.arange(m) / SR * 80)
add(metro + clack * 0.6, 9.5, 0.35, -0.4)
# arayüz bipleri (etiketler), KABUL / RED
def blip(f, d=0.08): n = int(d * SR); return np.sin(2 * np.pi * f * np.arange(n) / SR) * env_ar(n, 0.003, d * 0.6)
add(blip(1500), 13.6, 0.15, -0.3); add(blip(1800), 14.1, 0.15, 0.3)
add(np.concatenate([blip(988, 0.09), blip(1319, 0.18)]), 17.2, 0.22, -0.2)
n = int(0.5 * SR); buzz = lp(saw(110, n) + saw(116, n), 1500) * env_ar(n, 0.005, 0.15)
add(buzz, 17.85, 0.22, 0.2)
add(boom(1.0, 70, 35), 17.85, 0.5)
# sandalye + kapı
n = int(0.5 * SR); add(bp(noise(n), 200, 900) * env_ar(n, 0.05, 0.3) * 0.5, 19.2, 0.4)
n = int(0.5 * SR); x = np.arange(n) / SR
add(bp(noise(n), 500, 3000) * np.sin(np.pi * x / 0.5), 20.4, 0.25, 0.4)
add(boom(0.4, 110, 60), 20.82, 0.35, 0.4)
# ayak sesleri: odada ve sokakta (ıslak)
def step(wet=False):
    m = int(0.12 * SR); x = np.arange(m) / SR
    s = lp(noise(m), 900) * np.exp(-x * 45) + np.sin(2 * np.pi * 75 * x) * np.exp(-x * 40)
    if wet: s += hp(noise(m), 2500) * np.exp(-x * 30) * 0.5
    return s
t = 19.8
while t < 20.95: add(step(), t, 0.25, rng.uniform(-0.2, 0.2)); t += 0.42
t = 21.05
while t < 22.8: add(step(True), t, 0.3, rng.uniform(-0.2, 0.2)); t += 0.436
t = 22.8
while t < 25.0: add(step(True), t, 0.06); t += 0.436
# gün batımı: rüzgâr
n = idx(35) - idx(29.4); x = np.arange(n) / SR
wind = bp(noise(n), 150, 900) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.3 * x)) * env_ar(n, 0.8, 0.5)
add(wind, 29.4, 0.12)

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
