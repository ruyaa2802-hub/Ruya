"""'Ya ölümden sonra başka bir gerçeklikte uyanıyorsak?' — müzik + ses efektleri.
Seslendirme YOK (kullanıcı ekleyecek); diyalog anlarında müzik kısılır (ducking).
Çıktı: output/esik/ses.wav (48 kHz stereo)"""
import numpy as np, wave
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48000; DUR = 40.0; N = int(SR * DUR)
rng = np.random.default_rng(11)
def lp(x, f, o=2): return sosfilt(butter(o, f, 'low', fs=SR, output='sos'), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, 'high', fs=SR, output='sos'), x)
def bp(x, a, b, o=2): return sosfilt(butter(o, [a, b], 'band', fs=SR, output='sos'), x)
def hz(n): return 440.0 * 2 ** ((n - 69) / 12)
def idx(t): return int(t * SR)
def noise(n): return rng.standard_normal(n)
def saw(f, n, ph=0.0): t = np.arange(n) / SR; return 2 * ((f * t + ph) % 1.0) - 1
def sine(f, n): return np.sin(2 * np.pi * f * np.arange(n) / SR)
def env(n, a, r):
    e = np.ones(n); na, nr = int(a * SR), int(r * SR)
    if na: e[:na] = np.linspace(0, 1, na)
    if nr: e[-nr:] *= np.linspace(1, 0, nr)
    return e

mus = np.zeros((2, N)); sfx = np.zeros((2, N))
def put(buf, sig, t0, g=1.0, pan=0.0):
    i = idx(t0); j = min(N, i + len(sig))
    if j <= i: return
    s = sig[:j - i] * g
    buf[0, i:j] += s * np.sqrt(0.5 * (1 - pan)); buf[1, i:j] += s * np.sqrt(0.5 * (1 + pan))

# ---------------- MÜZİK ----------------
def pad(t0, t1, notes, g, cut, att=1.2, rel=1.0, det=(-0.1, 0.0, 0.09)):
    n = idx(t1) - idx(t0); s = np.zeros(n)
    for nt in notes:
        for d in det: s += saw(hz(nt) * 2 ** (d / 12), n, rng.random())
    s = lp(s, cut) / (len(notes) * len(det)); s *= env(n, att, rel)
    lfo = 1 + 0.15 * np.sin(2 * np.pi * 0.17 * np.arange(n) / SR)
    put(mus, s * lfo, t0, g, -0.3); put(mus, np.roll(s, 1200) * lfo, t0, g * 0.8, 0.3)
def bell(f, dur=3.0):
    n = int(dur * SR); t = np.arange(n) / SR
    s = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * d) for r, a, d in [(1, 1, 1.2), (2.76, 0.5, 2.0), (5.4, 0.25, 3.5), (8.9, 0.12, 5)])
    return s * np.minimum(1, t * 300)
def boom(dur=2.5, f0=110, f1=30):
    n = int(dur * SR); t = np.arange(n) / SR; f = f1 + (f0 - f1) * np.exp(-t * 14)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.6) + lp(noise(n), 2000) * np.exp(-t * 18) * 0.5

# hastane: yalnız oda uğultusu (müzik yok)
# Eşik: kozmik drone (Re minör → Si bemol → Sol minör → final asılı akor)
pad(2.75, 13.4, [26, 38, 45, 50, 57], 0.55, 600, att=0.3)
pad(13.0, 23.4, [34, 46, 50, 53, 58], 0.45, 700)
pad(23.0, 28.4, [31, 43, 50, 55, 62], 0.5, 900)
pad(28.0, 32.4, [26, 38, 50, 57, 62, 65, 69], 0.75, 2400, att=0.6)          # kapılar: geniş, parlak
pad(32.0, 35.4, [34, 46, 53, 58, 62], 0.4, 900)
pad(35.3, 38.0, [25, 37, 49], 0.35, 300, att=0.3, rel=0.02)                   # sadece alt bölge; 38'de kesilir
# yüksek "koro" katmanı (formant benzeri) — kapılar
n = idx(32.2) - idx(28.0); x = np.arange(n) / SR; choir = np.zeros(n)
for nt in (74, 77, 81, 86):
    v = saw(hz(nt) * (1 + 0.003 * np.sin(2 * np.pi * 5 * x)), n, rng.random()); choir += bp(v, 600, 1400) + 0.6 * bp(v, 2200, 3200)
put(mus, choir * env(n, 1.2, 0.8) / 4, 28.0, 0.35)
# kristal çanlar (absürt, düzensiz)
for t, nt in [(3.4, 86), (4.6, 81), (6.2, 89), (8.0, 84), (8.7, 91), (9.9, 86), (12.6, 79), (13.8, 84), (16.4, 88), (22.9, 93), (26.0, 84), (29.0, 93), (29.6, 96), (30.1, 91), (30.7, 98), (31.3, 89), (33.0, 86)]:
    put(mus, bell(hz(nt)), t, 0.07, rng.uniform(-0.8, 0.8))
# ters çan (anı ekranı için müzik kutusu)
for k, nt in enumerate([79, 83, 86, 91, 86, 83, 79, 74, 79, 83]):
    t = 24.7 + k * 0.33; s = bell(hz(nt), 1.2) * 0.8
    put(mus, s, t, 0.09, 0.2 if k % 2 else -0.2)
# riser'lar + darbeler
def riser(d, f0=200, f1=2400):
    n = int(d * SR); tt = np.arange(n) / SR
    return bp(noise(n), 300, 7000) * (tt / d) ** 2.5 + np.sin(2 * np.pi * np.cumsum(f0 + (f1 - f0) * (tt / d) ** 2) / SR) * (tt / d) ** 3 * 0.3
put(mus, riser(1.2), 1.55, 0.25)
put(mus, boom(3.0, 140, 28), 2.75, 1.2)
put(mus, riser(1.4, 300, 3000), 22.8, 0.25)
put(mus, boom(2.0, 90, 30), 24.15, 0.6)
put(mus, boom(2.5, 100, 28), 28.0, 0.9)
put(mus, riser(1.8, 150, 1800), 36.2, 0.4)
# dissonant stinger: donma anı
n = int(1.8 * SR); st = sum(saw(hz(nt), n, rng.random()) for nt in (84, 85, 91)); put(mus, lp(st, 3000) * env(n, 0.02, 0.4) / 3, 36.3, 0.18)
# reverb
ir_n = int(4.0 * SR); ir = noise(ir_n) * np.exp(-np.arange(ir_n) / SR * 1.4); ir[0] = 0; ir = lp(ir, 6000) * 0.02
for c in range(2): mus[c] += fftconvolve(mus[c], ir if c == 0 else np.roll(ir, 51))[:N] * 1.0

# ---------------- SFX ----------------
# 1) monitör: iki atım, sonra düz çizgi
for t in (0.11,):
    put(sfx, sine(1000, int(0.12 * SR)) * env(int(0.12 * SR), 0.003, 0.05), t, 0.18, -0.3)
n = idx(2.75) - idx(0.95); put(sfx, sine(1000, n) * env(n, 0.01, 0.01), 0.95, 0.14, -0.3)   # düz çizgi tonu
n = idx(2.75); put(sfx, lp(noise(n), 200) * 0.6 * env(n, 0.3, 0.05), 0.0, 0.18)               # oda uğultusu
# 2) Eşik ortamı: çok derin rüzgâr + uzak uğultu
n = N - idx(2.75); x = np.arange(n) / SR
amb = bp(noise(n), 60, 400) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.07 * x)) + 0.3 * sine(41, n)
amb *= env(n, 0.5, 0.0); amb[idx(38.0) - idx(2.75):] = 0
put(sfx, amb, 2.75, 0.12)
# dev saat tik-takları (yavaş, biri ters)
for k in range(30):
    t = 3.2 + k * 1.15
    if t > 37.9: break
    m = int(0.25 * SR); xx = np.arange(m) / SR
    tick = (sine(220 if k % 2 else 180, m) * np.exp(-xx * 30) + hp(noise(m), 1500) * np.exp(-xx * 60) * 0.4)
    if k % 5 == 3: tick = tick[::-1]
    put(sfx, tick, t, 0.12, 0.6 if k % 2 else -0.6)
# kalkış: kumaş + derin gürleme
n = int(2.0 * SR); put(sfx, bp(noise(n), 200, 2000) * env(n, 0.3, 0.8) * 0.4, 5.2, 0.25)
# varlıklar: cam şıngırtıları ve fısıltılar
for k in range(14):
    t = 7.6 + k * 0.21 + rng.uniform(0, 0.1); m = int(0.4 * SR)
    put(sfx, bp(noise(m), 3000, 9000) * np.exp(-np.arange(m) / SR * 12), t, 0.05, rng.uniform(-0.9, 0.9))
for t in (8.1, 9.3):
    m = int(1.2 * SR); xx = np.arange(m) / SR
    put(sfx, bp(noise(m), 800, 2500) * (0.5 + 0.5 * np.sin(2 * np.pi * 7 * xx)) * env(m, 0.3, 0.6), t, 0.08, rng.uniform(-0.5, 0.5))
# ayak sesleri (cam zemin)
def step():
    m = int(0.14 * SR); xx = np.arange(m) / SR
    return lp(noise(m), 1200) * np.exp(-xx * 45) + sine(90, m) * np.exp(-xx * 40) + bp(noise(m), 4000, 8000) * np.exp(-xx * 50) * 0.3
for t0, t1 in ((13.0, 15.2), (32.0, 34.1)):
    t = t0
    while t < t1: put(sfx, step(), t, 0.22, rng.uniform(-0.15, 0.15)); t += 0.49
# masa üstündeki minik gezegenler: ince hum
n = idx(23.0) - idx(13.0); x = np.arange(n) / SR; put(sfx, (sine(660, n) * 0.3 + sine(990, n) * 0.2) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.8 * x)) * env(n, 1.0, 1.0), 13.0, 0.03)
# el kalkışı ışık patlaması
n = int(1.0 * SR); x = np.arange(n) / SR; put(sfx, bp(noise(n), 500, 8000) * (x / 1.0) ** 2, 23.15, 0.25); put(sfx, boom(1.5, 200, 60), 24.15, 0.4)
# ekran glitch'leri
for t in (24.6, 25.75, 26.9, 27.6, 28.0):
    m = int(0.18 * SR); g = np.sign(np.sin(2 * np.pi * rng.uniform(80, 400) * np.arange(m) / SR)) * env(m, 0.002, 0.05) * 0.5 + hp(noise(m), 2000) * 0.5 * env(m, 0.002, 0.08)
    put(sfx, g, t, 0.12, rng.uniform(-0.5, 0.5))
# kapılar belirirken kademeli "açılma" sesleri
for k in range(26):
    t = 28.2 + k * 0.12 * (1 + k * 0.03); m = int(0.35 * SR); xx = np.arange(m) / SR
    put(sfx, (sine(rng.uniform(300, 1200), m) * np.exp(-xx * 10) * 0.4 + bp(noise(m), 1000, 5000) * np.exp(-xx * 20)), t, 0.06, rng.uniform(-1, 1))
# kalp atışı (ipucu) — kapıya yürürken hafifçe başlar
for k in range(6):
    t = 32.4 + k * 0.85
    m = int(0.22 * SR); xx = np.arange(m) / SR; th = sine(48, m) * np.exp(-xx * 20)
    put(sfx, th, t, 0.12 + 0.05 * k); put(sfx, th * 0.6, t + 0.15, 0.08 + 0.04 * k)
# el kapı koluna: metal dokunuş
m = int(0.3 * SR); put(sfx, bell(hz(98), 0.3)[:m] * 0.6, 35.05, 0.12)
# 38.0: sert kesme → sessizlik. 39.3: tek monitör bip'i (kalp yeniden atıyor?)
put(sfx, sine(1000, int(0.14 * SR)) * env(int(0.14 * SR), 0.003, 0.06), 39.25, 0.2, -0.2)
m = int(0.25 * SR); xx = np.arange(m) / SR; put(sfx, sine(52, m) * np.exp(-xx * 22), 39.25, 0.5)

# ---------------- MİKS ----------------
# diyalog anlarında müziği kıs (seslendirme sonradan eklenecek)
duck = np.ones(N)
for a, b in [(10.9, 12.6), (15.8, 18.1), (18.3, 20.0), (20.5, 22.9), (35.2, 37.3)]:
    i, j = idx(a), idx(b); r = int(0.25 * SR)
    duck[i:j] = np.minimum(duck[i:j], 0.45)
    duck[max(0, i - r):i] = np.minimum(duck[max(0, i - r):i], np.linspace(1, 0.45, i - max(0, i - r)))
    duck[j:j + r] = np.minimum(duck[j:j + r], np.linspace(0.45, 1, len(duck[j:j + r])))
mix = mus * duck * 0.9 + sfx
cut = idx(38.0); f = int(0.01 * SR)
mix[:, cut:cut + f] *= np.linspace(1, 0, f); mix[:, cut + f:idx(39.2)] = 0
mix[:, :int(0.02 * SR)] *= np.linspace(0, 1, int(0.02 * SR))
mix = mix / np.max(np.abs(mix)) * 0.98; mix = np.tanh(mix * 1.2) / np.tanh(1.2) * 0.89
with wave.open('output/esik/ses.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix.T * 32767).astype(np.int16).tobytes())
print('ses tamam')
