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

# ------------------------------------------------ MÜZİK (120 BPM, C–G–Am–F)
BPM = 120; beat = 60 / BPM; bar = 4 * beat
def pluck(f, dur=0.9):
    n = int(dur * SR); L = max(2, int(SR / f)); buf = rng.uniform(-1, 1, L); out = np.zeros(n)
    for i in range(n):
        out[i] = buf[i % L]; buf[i % L] = 0.5 * (buf[i % L] + buf[(i + 1) % L]) * 0.996
    return out * env(n, 0.002, 0.5)
pl_cache = {}
def pl(m):
    if m not in pl_cache: pl_cache[m] = pluck(midi(m))
    return pl_cache[m]
def glock(f, dur=0.6):
    n = int(dur * SR); t = T(n)
    return (np.sin(2*np.pi*f*t) + 0.35*np.sin(2*np.pi*f*2.76*t)*np.exp(-t/0.08) + 0.15*np.sin(2*np.pi*f*5.4*t)*np.exp(-t/0.04)) * env(n, 0.002, 0.28)
def bass(f, dur=0.45):
    n = int(dur * SR); t = T(n); return (np.sin(2*np.pi*f*t) + 0.25*np.sin(2*np.pi*2*f*t)) * env(n, 0.01, 0.25)
chords = [[60, 64, 67], [55, 59, 62, 67], [57, 60, 64], [53, 57, 60, 65]]
roots = [36, 43, 45, 41]
mel = [[72, 76, 79, 76, 77, 76, 74, 72], [71, 74, 79, 74, 72, 71, 69, 67], [69, 72, 76, 72, 74, 72, 71, 69], [69, 72, 77, 76, 74, 72, 71, 67]]
mel2 = [[76, 0, 79, 0, 84, 0, 79, 76], [74, 0, 79, 0, 83, 0, 79, 74], [72, 0, 76, 0, 81, 0, 76, 72], [72, 0, 77, 0, 81, 0, 79, 77]]
nb = int(DUR / bar) + 1
for b in range(nb):
    t0 = b * bar; ci = b % 4
    for k, off in enumerate([0, 1, 1.5, 2, 3, 3.5]):
        for j, m in enumerate(chords[ci]): put(mus, t0 + off * beat + j * 0.012, pl(m), 0.11 if off % 1 == 0 else 0.07)
    for off in [0, 1.5, 2, 3]: put(mus, t0 + off * beat, bass(midi(roots[ci] + (12 if off == 1.5 else 0))), 0.26)
    ml = mel[ci] if (b // 4) % 2 == 0 else mel2[ci]
    for k, m in enumerate(ml):
        if m: put(mus, t0 + k * beat / 2, glock(midi(m)), 0.13 if b >= 1 else 0.0)
    for k in range(8):
        sh = bandnoise(0.05, 6000, 12000) * env(int(0.05 * SR), 0.002, 0.015); put(mus, t0 + k * beat / 2, sh, 0.05 if k % 2 else 0.03)
# patlamada sessizlik (komik duraklama) ve PAT anında kısa duraklama
def duck(a, b, depth, fade=0.05):
    t = T(N); g = np.ones(N)
    m = (t > a) & (t < b); g[m] = depth
    for (x0, x1, y0, y1) in [(a - fade, a, 1, depth), (b, b + fade, depth, 1)]:
        mm = (t >= x0) & (t < x1); g[mm] = y0 + (y1 - y0) * (t[mm] - x0) / fade
    return g
mus *= duck(21.72, 22.75, 0.0, 0.03) * duck(27.72, 28.25, 0.15, 0.03)
# sona doğru yumuşak geçiş ki döngü başa bağlansın
mus *= np.clip((30 - T(N)) / 0.25, 0, 1)

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
for k, m in enumerate([72, 76, 79, 84]): put(sfx, 7.3 + k * 0.08, glock(midi(m)), 0.25)   # ta-da
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
put(sfx, 23.0, glock(midi(91)), 0.18); plop(23.0, 600, 0.1)            # taç konar
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
put(sfx, 29.45, glock(midi(84)), 0.12)

mix = mus * 0.55 + sfx * 0.9
mix = np.tanh(mix * 1.1) ; mix = mix / np.abs(mix).max() * 0.9
mix[:int(0.02 * SR)] *= np.linspace(0, 1, int(0.02 * SR))
out = sys.argv[1] if len(sys.argv) > 1 else 'ep1.wav'
with wave.open(out, 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix * 32767).astype(np.int16).tobytes())
print('ok', out)
