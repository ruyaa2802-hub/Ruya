# Piko & Moko Bölüm 1 — müzik + efektler (tamamen kodla sentezlenir, telifsiz)
import numpy as np, wave, math, sys
SR = 44100; DUR = 30.0; N = int(SR * DUR)
rng = np.random.default_rng(7)
mus = np.zeros(N); sfx = np.zeros(N)
def T(n): return np.arange(n) / SR
def put(buf, t0, sig, g=1.0):
    i = int(t0 * SR); 
    if i >= N: return
    j = min(N, i + len(sig)); buf[i:j] += sig[: j - i] * g
def env(n, a=0.005, d=0.2):
    t = T(n); return np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / d)
def sweep(f0, f1, dur, kind='exp'):
    n = int(dur * SR); t = T(n)
    f = f0 * (f1 / f0) ** (t / dur) if kind == 'exp' else f0 + (f1 - f0) * t / dur
    return np.sin(2 * np.pi * np.cumsum(f) / SR)
def bandnoise(dur, lo, hi):
    n = int(dur * SR); x = rng.standard_normal(n); X = np.fft.rfft(x); f = np.fft.rfftfreq(n, 1 / SR)
    X[(f < lo) | (f > hi)] = 0; y = np.fft.irfft(X, n); return y / (np.abs(y).max() + 1e-9)
def midi(m): return 440 * 2 ** ((m - 69) / 12)

# ------------------------------------------------ MÜZİK — neşeli çizgi film skoru (aksiyonla senkron, 140 BPM)
BPM = 140; b = 60 / BPM; e = b / 2; s16 = b / 4
def adsr(n, a=0.01, r=0.05):
    t = T(n); env_ = np.minimum(1, t / max(a, 1e-4)); rel = int(r * SR)
    if n > rel: env_[-rel:] *= np.linspace(1, 0, rel)
    return env_
def marimba(f, d=0.45):
    n = int(d * SR); t = T(n)
    return (np.sin(2*np.pi*f*t) * np.exp(-t/0.22) + 0.4*np.sin(2*np.pi*f*3.93*t)*np.exp(-t/0.03) + 0.15*np.sin(2*np.pi*f*9.2*t)*np.exp(-t/0.01)) * np.minimum(1, t/0.002)
def ks(f, d=0.3, damp=0.99):
    n = int(d * SR); L = max(2, int(SR / f)); buf = rng.uniform(-1, 1, L); out = np.zeros(n)
    for i in range(n):
        j = i % L; out[i] = buf[j]; buf[j] = 0.5 * (buf[j] + buf[(j + 1) % L]) * damp
    return out * np.exp(-T(n) / (d * 0.5))
_pz = {}
def pizz(m):
    if m not in _pz: _pz[m] = ks(midi(m), 0.32, 0.985)
    return _pz[m]
def tuba(f, d):
    n = int(d * SR); t = T(n); f_t = f * (1 - 0.04 * np.exp(-t / 0.03)); ph = 2 * np.pi * np.cumsum(f_t) / SR
    y = sum(np.sin(k * ph) / k * np.exp(-(k - 1) * 0.35) for k in range(1, 9))
    return y * adsr(n, 0.015, 0.06) * (0.75 + 0.25 * np.exp(-t / 0.15))
def clar(f, d, vib=True):
    n = int(d * SR); t = T(n); v = 1 + (0.006 * np.sin(2 * np.pi * 5.5 * t) * np.minimum(1, np.maximum(0, t - 0.12) / 0.1) if vib else 0)
    ph = 2 * np.pi * np.cumsum(f * v) / SR
    y = np.sin(ph) + 0.45 * np.sin(3 * ph) + 0.25 * np.sin(5 * ph) + 0.12 * np.sin(7 * ph) + 0.06 * np.sin(9 * ph)
    return y * adsr(n, 0.025, 0.05) * 0.6
def bone(f, d, wahs=1):
    n = int(d * SR); t = T(n); w = 0.5 - 0.5 * np.cos(2 * np.pi * np.minimum(t / d, 1) * wahs) if wahs else np.ones(n)
    vib = 1 + 0.02 * np.sin(2 * np.pi * 6 * t) * np.minimum(1, t / d * 1.5)
    ph = 2 * np.pi * np.cumsum(f * vib) / SR
    y = sum(np.sin(k * ph) / k * np.exp(-(k - 1) * (1.4 - 1.2 * w)) for k in range(1, 12))
    return y * adsr(n, 0.04, 0.12) * (0.4 + 0.6 * w)
def glk(f, d=0.6):
    n = int(d * SR); t = T(n)
    return (np.sin(2*np.pi*f*t) + 0.3*np.sin(2*np.pi*f*2.76*t)*np.exp(-t/0.08)) * np.exp(-t/0.3) * np.minimum(1, t/0.002)
def snare(g=1.0, d=0.12):
    n = int(d * SR); t = T(n); return (bandnoise(d, 1500, 9000) * np.exp(-t / 0.05) + 0.4 * np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.03)) * g
def wblock(f=900):
    n = int(0.08 * SR); t = T(n); return np.sin(2 * np.pi * f * t) * np.exp(-t / 0.018)
def splash():
    n = int(1.0 * SR); t = T(n); return bandnoise(1.0, 4000, 14000) * np.exp(-t / 0.35)
def M(inst, m, t0, d=None, g=0.3):
    f = midi(m)
    if inst == 'mar': put(mus, t0, marimba(f), g)
    elif inst == 'pz': put(mus, t0, pizz(m), g)
    elif inst == 'tb': put(mus, t0, tuba(f, d or e * 0.9), g)
    elif inst == 'cl': put(mus, t0, clar(f, d or e * 0.9), g)
    elif inst == 'gl': put(mus, t0, glk(f), g)
def seq(inst, notes, t0, step, g=0.3, dur=None):
    for k, m in enumerate(notes):
        if m: M(inst, m, t0 + k * step, dur, g)

# A) 0–4.95 sinsi, meraklı parmak ucu
for k in range(int(4.95 / b)):
    t0 = k * b
    if 1.8 <= t0 < 2.35: continue
    M('pz', [36, 43][k % 2], t0, g=0.55); put(mus, t0 + e, wblock(1000 if k % 2 else 820), 0.12)
    for m in ([48, 52, 55] if k % 4 < 2 else [47, 50, 55]): M('pz', m + 12, t0 + e, g=0.12)
seq('mar', [67, 0, 68, 0, 69, 0, 72, 0], 0.0, e, 0.4)
seq('mar', [72, 76, 79, 84, 88, 91, 96], 1.84, 0.035, 0.28)            # şaşkınlık parıltısı
seq('mar', [71, 0, 69, 0, 67, 0, 0, 0, 72, 74, 76, 0], 2.4, e, 0.4)
for k, m in enumerate([31, 31, 33]): M('tb', m, 3.0 + k * 0.43, 0.2, 0.35)  # Moko'nun gelişi: tombul tuba
seq('mar', [79, 0, 77, 76, 74, 0], 4.1, e * 0.7, 0.3)

# B) 5.0–8.25 zorlanma → kaldırma → TA-DAA
for i in range(5):
    t0 = 5.0 + i * b * 0.85; base = 60 + i
    for k in range(int(b * 0.85 / s16)): M('mar', base if k % 2 == 0 else base + 4, t0 + k * s16, g=0.16 + 0.04 * i)
    M('tb', 36, t0, b * 0.8, 0.25 + 0.05 * i)
    for k in range(4): put(mus, t0 + k * s16, snare(0.05 + 0.03 * i, 0.06), 1)
seq('cl', [72, 74, 76, 77, 79, 81, 83, 84], 6.8, 0.045, 0.32, 0.05)
for m in [72, 76, 79, 84]: M('cl', m, 7.3, 0.85, 0.22)
M('tb', 36, 7.3, 0.85, 0.45); put(mus, 7.3, splash(), 0.25); M('gl', 96, 7.3, g=0.25)
seq('mar', [72, 76, 79, 84, 79, 76], 7.75, e * 0.8, 0.3)

# 9.3–10 davul girişi
for k in range(10): put(mus, 9.3 + k * 0.07, snare(0.1 + 0.03 * k, 0.07), 1)
seq('tb', [31, 33, 35], 9.55, 0.15, 0.4)

# C) 10.0–18.0 dörtnala kovalamaca
prog = [(36, 43, [48, 52, 55], [72, 76, 79, 76, 84, 79, 76, 79]),
        (31, 38, [47, 50, 55], [71, 74, 79, 74, 83, 79, 74, 71]),
        (36, 43, [48, 52, 55], [72, 76, 79, 84, 88, 84, 79, 76]),
        (31, 38, [47, 50, 53], [77, 74, 71, 74, 79, 77, 74, 71]),
        (36, 43, [48, 52, 55], [72, 76, 79, 76, 72, 76, 79, 84])]
barL = 8 * e
for bi, (r1, r2, ch, mel) in enumerate(prog):
    t0 = 10.0 + bi * barL
    for k in range(8):
        tk = t0 + k * e
        if tk >= 17.95: break
        if k % 2 == 0: M('tb', r1 if k % 4 == 0 else r2, tk, e * 0.8, 0.45)
        else:
            for m in ch: M('pz', m + 12, tk, g=0.14)
            put(mus, tk, snare(0.13), 1)
        M('cl', mel[k], tk, e * 0.85, 0.3); M('mar', mel[k] - 12, tk, g=0.16)
put(mus, 17.95, splash(), 0.2); M('tb', 36, 17.95, 0.3, 0.45)

# D) 18.0–21.72 sallanma → kutlama → davul trampası
seq('mar', [79, 0, 78, 0, 79, 0], 18.05, 0.11, 0.25)
seq('cl', [72, 76, 79], 18.75, e, 0.3); M('cl', 84, 18.75 + 3 * e, 0.9, 0.3)
for k in range(6): M('tb', [36, 43][k % 2], 18.75 + k * e, e * 0.8, 0.4); M('pz', 64 + 12, 18.75 + k * e + e / 2, g=0.12)
M('gl', 91, 19.35, g=0.25); M('gl', 96, 19.45, g=0.2)
n_roll = int((21.72 - 20.2) / 0.045)
for k in range(n_roll): put(mus, 20.2 + k * 0.045, snare(0.04 + 0.16 * k / n_roll, 0.05), 1)
for i, m in enumerate([67, 68, 69, 70, 71, 72, 73, 74]):
    t0 = 20.2 + i * 0.19
    for k in range(4): M('cl', m, t0 + k * 0.0475, 0.045, 0.1 + 0.02 * i)

# E) 22.75–25.1 üzgün trombon: wah-wah-wah-waaah
for i, (m, d) in enumerate([(55, 0.42), (54, 0.42), (53, 0.42), (52, 1.05)]):
    put(mus, 22.8 + i * 0.45, bone(midi(m), d, 1 if i < 3 else 2.5), 0.42)

# F) 25.1–27.7 Moko mutlu mutlu yalar
for k in range(int((27.68 - 25.1) / b)):
    t0 = 25.1 + k * b
    M('tb' if k % 2 == 0 else 'pz', [36, 43][(k // 2) % 2] + (0 if k % 2 == 0 else 24), t0, b * 0.5, 0.35 if k % 2 == 0 else 0.2)
    if k % 2: put(mus, t0, snare(0.06), 1)
seq('mar', [76, 79, 76, 72, 74, 77, 74, 71, 76, 79, 84, 0], 25.1, e, 0.32)
for k in range(5): M('gl', [84, 88][k % 2], 25.45 + k * 0.483 + 0.18, g=0.08)

# G) 28.3–30 komik bakış + mutlu kapanış (döngüye bağlanır)
M('cl', 79, 28.32, 0.12, 0.3); M('cl', 78, 28.5, 0.3, 0.3)
seq('mar', [72, 74, 76, 77, 79, 81, 83], 28.95, s16 * 1.2, 0.3)
for m in [72, 76, 79, 84]: M('mar', m, 29.85, g=0.18)
M('tb', 36, 29.85, 0.14, 0.35); M('gl', 96, 29.85, g=0.15)
mus *= np.clip((30 - T(N)) / 0.12, 0, 1)

# ------------------------------------------------ EFEKTLER
def step(t0, f=260, g=0.25):
    n = int(0.07 * SR); s = sweep(f, f * 0.6, 0.07) * env(n, 0.002, 0.03) + bandnoise(0.07, 800, 3000) * env(n, 0.001, 0.008) * 0.3; put(sfx, t0, s, g)
def boing(t0, f0=180, f1=520, dur=0.35, g=0.35):
    n = int(dur * SR); t = T(n); f = f0 * (f1 / f0) ** (t / dur); f = f * (1 + 0.08 * np.sin(2 * np.pi * 22 * t))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.003, dur * 0.6); put(sfx, t0, s, g)
def thud(t0, f=85, g=0.6, d=0.18):
    n = int(0.4 * SR); s = sweep(f * 1.6, f * 0.7, 0.4) * env(n, 0.002, d) + bandnoise(0.4, 40, 400) * env(n, 0.001, 0.05) * 0.5; put(sfx, t0, s, g)
def plop(t0, f=700, g=0.18):
    n = int(0.09 * SR); s = sweep(f, f * 0.45, 0.09) * env(n, 0.002, 0.04); put(sfx, t0, s, g)
def squelch(t0, dur=0.35, g=0.5):
    n = int(dur * SR); t = T(n); s = bandnoise(dur, 150, 1800) * (0.6 + 0.4 * np.sin(2 * np.pi * 30 * t)) * env(n, 0.005, dur * 0.4) + sweep(420, 160, dur) * env(n, 0.005, dur * 0.3) * 0.5; put(sfx, t0, s, g)
def whoosh(t0, dur, lo, hi, g=0.3, up=True):
    n = int(dur * SR); t = T(n); y = np.zeros(n); steps = 12
    for k in range(steps):
        a, b = int(k * n / steps), int((k + 1) * n / steps); fr = k / steps if up else 1 - k / steps
        y[a:b] = bandnoise((b - a) / SR + 1e-3, lo + (hi - lo) * fr * 0.5, lo + (hi - lo) * fr + 200)[: b - a]
    put(sfx, t0, y * np.sin(np.pi * t / dur), g)
def slide(t0, f0, f1, dur, g=0.25):
    n = int(dur * SR); t = T(n); s = sweep(f0, f1, dur) ; s = np.sin(np.arcsin(np.clip(s,-1,1))) * (0.85 + 0.15*np.sin(2*np.pi*6*t)) * env(n, 0.01, dur); put(sfx, t0, s, g)
def blip(t0, f=1500, g=0.08):
    n = int(0.05 * SR); put(sfx, t0, np.sin(2 * np.pi * f * T(n)) * env(n, 0.001, 0.015), g)
def bonk(t0, g=0.6):
    n = int(0.35 * SR); t = T(n)
    s = (np.sin(2*np.pi*820*t)*np.exp(-t/0.05) + 0.6*np.sin(2*np.pi*1230*t)*np.exp(-t/0.03) + 0.4*np.sin(2*np.pi*410*t)*np.exp(-t/0.09)) + bandnoise(0.35, 2000, 8000)*np.exp(-t/0.004)*0.6
    put(sfx, t0, s, g)

# Sahne 1
for k in range(6): step(0.15 + k * 0.3, 240 + (k % 2) * 30, 0.22)
whoosh(1.78, 0.18, 1500, 5000, 0.15, up=False)            # fren
boing(1.85, 300, 1100, 0.18, 0.3); slide(1.95, 500, 900, 0.25, 0.15)   # şaşkınlık
for k in range(int((4.9 - 2.45) / 0.22)): step(2.45 + k * 0.22, 380 + (k % 2) * 40, 0.13)   # parmak ucu
for k in range(6): step(3.05 + k * 0.21, 170, 0.18)        # Moko gelir
for k in range(10): blip(4.35 + k * 0.06, 300 + 40 * (k % 2), 0.03)   # Moko titrer
# Sahne 2
n = int(1.6 * SR); t = T(n); f = 110 + 90 * t / 1.6
put(sfx, 5.2, np.sign(np.sin(2 * np.pi * np.cumsum(f * (1 + 0.04 * np.sin(2 * np.pi * 9 * t))) / SR)) * 0.25 * np.minimum(1, t / 0.2) * np.exp(-np.maximum(0, t - 1.4) / 0.1), 0.12)
for k in range(14): blip(5.25 + k * 0.11, 220, 0.05)
whoosh(6.8, 0.4, 400, 3000, 0.3)                            # kaldırma
slide(8.3, 1500, 380, 0.55, 0.28)                           # kayma
thud(8.88, 80, 0.75); squelch(8.9, 0.15, 0.25); boing(9.05, 160, 300, 0.2, 0.2); thud(9.27, 120, 0.3)
# Sahne 3 — yuvarlanma gürültüsü
def rollX(tt):
    u = min(max((tt - 9.3) / 8.5, 0), 1); return -3.4 + 18.4 * (1 - math.cos(math.pi * u ** 1.12)) / 2
n = int((17.9 - 9.3) * SR); tt = 9.3 + T(n); xs = np.array([rollX(v) for v in tt[::441]]); xs = np.interp(np.arange(n), np.arange(len(xs)) * 441, xs)
spd = np.abs(np.gradient(xs)) * SR; spd = spd / spd.max()
rum = bandnoise(n / SR, 30, 260) * spd * (0.7 + 0.3 * np.sin(xs / 1.15 * 2 * np.pi)); put(sfx, 9.3, rum, 0.55)
prev = -3.4; ang = 0
for i in range(0, n, 441):
    a = (xs[i] + 3.4) / 1.15
    if int(a / (math.pi / 2)) > ang: ang = int(a / (math.pi / 2)); thud(9.3 + i / SR, 70, 0.2, 0.08)
for c, L in [(3.4, 2.4), (6.4, 2.6), (8.9, 2.2)]:
    i0 = int(np.argmax(xs >= c)); i1 = int(np.argmax(xs >= c + L))
    boing(9.3 + i0 / SR, 150, 420, 0.3, 0.32); thud(9.3 + i1 / SR, 75, 0.45); plop(9.3 + i1 / SR, 300, 0.15)
for k in range(int((18.6 - 9.8) / 0.16)): step(9.8 + k * 0.16, 300 + (k % 2) * 40, 0.16)     # Piko koşar
for k in range(int((19.4 - 10.4) / 0.12)): step(10.4 + k * 0.12, 200 + (k % 3) * 25, 0.13)   # Moko'nun minik bacakları
n = int(1.2 * SR); t = T(n); put(sfx, 17.85, np.sin(2 * np.pi * 190 * t) * (0.5 + 0.5 * np.sin(2 * np.pi * 7 * t)) * np.exp(-t / 0.5), 0.12)   # sallanma
# Sahne 4
boing(18.8, 200, 700, 0.3, 0.3); step(19.3, 200, 0.3); boing(19.35, 220, 760, 0.3, 0.3); step(19.85, 200, 0.3)
for k in range(4): put(sfx, 19.45 + k * 0.27, bandnoise(0.16, 400, 2500) * env(int(0.16 * SR), 0.02, 0.06), 0.12)   # nefes
whoosh(20.2, 0.25, 300, 900, 0.15, up=False)
boing(20.45, 140, 900, 0.5, 0.42)                            # büyük zıplayış
squelch(21.15, 0.3, 0.55)
n = int(0.6 * SR); t = T(n); put(sfx, 21.18, np.sin(2 * np.pi * np.cumsum(140 + 260 * (t / 0.6) ** 2) / SR) * (0.7 + 0.3 * np.sin(2 * np.pi * 35 * t)) * np.minimum(1, t / 0.05), 0.2)   # gerilme
# PATLAMA
n = int(1.2 * SR); t = T(n)
boom = sweep(110, 35, 1.2) * np.exp(-t / 0.25) * 1.0 + bandnoise(1.2, 60, 2500) * np.exp(-t / 0.18) * 0.9 + bandnoise(1.2, 200, 1200) * np.exp(-t / 0.5) * (0.5 + 0.5 * np.sin(2 * np.pi * 14 * t)) * 0.5
put(sfx, 21.75, boom, 0.95)
for k in range(28): plop(21.95 + rng.uniform(0, 0.75), rng.uniform(380, 950), rng.uniform(0.06, 0.16))
thud(22.35, 95, 0.5); squelch(22.36, 0.2, 0.3)
put(sfx, 23.0, glk(midi(91)), 0.18); plop(23.0, 600, 0.1)            # taç konar
blip(23.62, 1800, 0.07); blip(24.62, 1800, 0.07); blip(23.92, 1300, 0.06); blip(24.82, 1300, 0.06)   # göz kırpma
# Sahne 5
for k in range(5):
    t0 = 25.45 + k * 0.483; n = int(0.3 * SR); t = T(n)
    put(sfx, t0, bandnoise(0.3, 300, 2200) * np.sin(np.pi * t / 0.3) * (0.6 + 0.4 * np.sin(2 * np.pi * 18 * t)), 0.22)
    plop(t0 + 0.2, 520, 0.08)
slide(27.0, 1900, 700, 0.75, 0.2)                             # düşme ıslığı
bonk(27.75, 0.75)                                            # PAT!
boing(27.82, 420, 160, 0.6, 0.3)
step(28.35, 500, 0.2); step(28.6, 560, 0.12)
slide(28.1, 300, 900, 0.2, 0.15)                             # Moko'nun komik bakışı

mix = mus * 0.62 + sfx * 0.8
mix = np.tanh(mix * 1.1) ; mix = mix / np.abs(mix).max() * 0.9
mix[:int(0.02 * SR)] *= np.linspace(0, 1, int(0.02 * SR))
out = sys.argv[1] if len(sys.argv) > 1 else 'ep1.wav'
with wave.open(out, 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix * 32767).astype(np.int16).tobytes())
print('ok', out)
