"""Özgün müzik + ses efektleri sentezi ve karışım (yalnızca numpy). Çıktı: out/mix.wav ve stem'ler."""
import os, math, wave, json
import numpy as np
from timing import *

SR = 44100
N = int((DUR + 1.0) * SR)
HERE = os.path.dirname(os.path.abspath(__file__))
LINES_DIR = os.path.join(HERE, '..', 'audio', 'lines')
OUT = os.path.join(HERE, '..', 'out')
rng = np.random.RandomState(7)

NOTE = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def nf(n):
    """'A2', 'Bb3', 'F#4' -> Hz"""
    k = NOTE[n[0]]
    i = 1
    while n[i] in 'b#':
        k += -1 if n[i] == 'b' else 1
        i += 1
    o = int(n[i:])
    return 440.0 * 2 ** ((k + 12 * (o + 1) - 69) / 12)


def bus():
    return np.zeros((2, N), np.float32)


def add(b, x, t0, pan=0.0, gain=1.0):
    i0 = int(t0 * SR)
    if i0 < 0:
        x = x[-i0:]; i0 = 0
    n = min(len(x), N - i0)
    if n <= 0:
        return
    th = (pan + 1) * math.pi / 4
    b[0, i0:i0 + n] += x[:n].astype(np.float32) * gain * math.cos(th)
    b[1, i0:i0 + n] += x[:n].astype(np.float32) * gain * math.sin(th)


def fft_filter(x, lo=None, hi=None, lo_w=0.5, hi_w=0.5):
    n = 1 << int(math.ceil(math.log2(len(x))))
    X = np.fft.rfft(x, n)
    f = np.fft.rfftfreq(n, 1 / SR)
    g = np.ones_like(f)
    if lo:
        g *= 1 / (1 + (lo / np.maximum(f, 1e-3)) ** (4 * lo_w + 2))
    if hi:
        g *= 1 / (1 + (f / hi) ** (4 * hi_w + 2))
    return np.fft.irfft(X * g, n)[:len(x)]


def make_ir(seed, tau=0.42, length=2.6, hi=5200):
    r = np.random.RandomState(seed)
    n = int(length * SR)
    t = np.arange(n) / SR
    ir = r.randn(n) * np.exp(-t / tau)
    ir[:int(0.018 * SR)] = 0
    ir = fft_filter(ir, lo=120, hi=hi)
    ir[0] = 0
    return (ir / np.sqrt(np.sum(ir ** 2))).astype(np.float32)


IR = [make_ir(1), make_ir(2)]


def reverb(b, wet=0.2, ir=IR):
    n = 1 << int(math.ceil(math.log2(N + len(ir[0]))))
    out = np.zeros_like(b)
    for c in range(2):
        out[c] = np.fft.irfft(np.fft.rfft(b[c], n) * np.fft.rfft(ir[c], n), n)[:N] * wet
    return out


# ------------------------------------------------------------------ enstrümanlar
def piano(f, dur, vel=0.6):
    L = int((dur + 2.4) * SR)
    t = np.arange(L, dtype=np.float32) / SR
    y = np.zeros(L, np.float32)
    d0 = 0.5 + f / 520
    for n in range(1, 9):
        fn = n * f * math.sqrt(1 + 0.00035 * n * n)
        if fn > 9500:
            break
        a = vel / (n ** 1.08)
        y += a * np.sin(2 * np.pi * fn * t + n * 0.9) * np.exp(-t * d0 * (1 + 0.65 * (n - 1)))
    y *= 1 - np.exp(-t / 0.0035)
    y *= np.where(t > dur, np.exp(-(t - dur) * 2.6), 1.0)
    k = int(0.02 * SR)
    y[:k] += rng.randn(k) * np.exp(-np.arange(k) / (0.004 * SR)) * vel * 0.045
    return y


def strings(freqs, dur, att=1.3, rel=1.8, vol=0.1, trem=0.0, bright=1.0):
    L = int((dur + rel) * SR)
    t = np.arange(L, dtype=np.float32) / SR
    y = np.zeros(L, np.float32)
    for f in freqs:
        for det, ph0 in ((-6, 0.0), (7, 1.7)):
            ff = f * 2 ** (det / 1200)
            tt = t + 0.0007 * np.sin(2 * np.pi * 5.2 * t + ph0 + f)
            for n in range(1, 6):
                if ff * n > 9000:
                    break
                y += (bright ** (n - 1)) / n ** 1.25 * np.sin(2 * np.pi * ff * n * tt + ph0 * n)
    e = np.minimum(1, t / att) ** 1.5
    e = e * np.where(t > dur, np.exp(-(t - dur) * 3.2 / rel), 1.0)
    if trem:
        e = e * (1 + trem * np.sin(2 * np.pi * 7.5 * t))
    return y * e * vol / max(1, len(freqs)) ** 0.6


def bass_pluck(f, dur=0.38, vol=0.5):
    L = int((dur + 0.15) * SR)
    t = np.arange(L, dtype=np.float32) / SR
    y = sum(np.sin(2 * np.pi * f * n * t) / n ** 1.4 for n in range(1, 6))
    return (y * np.exp(-t / 0.16) * (1 - np.exp(-t / 0.004)) * vol).astype(np.float32)


def drone(f, dur, vol=0.3, att=2.5, rel=3.0):
    L = int((dur + rel) * SR)
    t = np.arange(L, dtype=np.float32) / SR
    y = np.sin(2 * np.pi * f * t) + 0.45 * np.sin(2 * np.pi * f * 2 * t + 1) + 0.2 * np.sin(2 * np.pi * f * 3 * t)
    y += 0.25 * np.sin(2 * np.pi * f * 1.004 * t)
    e = np.minimum(1, t / att) ** 2 * np.where(t > dur, np.exp(-(t - dur) * 3 / rel), 1.0)
    return (y * e * vol).astype(np.float32)


def noise_sweep(dur, f0, f1, vol=0.3, shape='up', q=0.9):
    """Zamanla kayan bandlı gürültü (yüksek geçiren/alçak geçiren tek kutuplu)."""
    n = int(dur * SR)
    x = rng.randn(n).astype(np.float32)
    t = np.linspace(0, 1, n, dtype=np.float32)
    fc = f0 * (f1 / f0) ** t
    a = 1 - np.exp(-2 * np.pi * fc / SR)
    lp = np.zeros(n, np.float32)
    s = 0.0
    out = np.empty(n, np.float32)
    # iki aşamalı alçak geçiren + yüksek geçiren farkı = bant
    s2 = 0.0
    for i in range(n):
        s += a[i] * (x[i] - s)
        s2 += a[i] * 0.35 * (s - s2)
        out[i] = s - s2
    if shape == 'up':
        env = t ** 1.6 * (1 - 0.0 * t)
        env = env * np.minimum(1, (1 - t) * 14 + 0.0) if False else env
    else:
        env = (1 - t) ** 1.5
    out = out * env
    return out / (np.max(np.abs(out)) + 1e-6) * vol


# ------------------------------------------------------------------ ses efektleri
def sfx(name, dur_hint=1.0):
    t = lambda d: np.arange(int(d * SR), dtype=np.float32) / SR
    if name == 'door':
        tt = t(0.9)
        y = np.sin(2 * np.pi * 70 * tt) * np.exp(-tt / 0.12) * 0.7
        y += fft_filter(rng.randn(len(tt)) * np.exp(-tt / 0.02), lo=500, hi=4000) * 0.9
        y[int(0.18 * SR):] += (fft_filter(rng.randn(len(tt)) * np.exp(-tt / 0.012), lo=1500, hi=6000) * 0.5)[:len(tt) - int(0.18 * SR)]
        return y * 0.45, 0.0
    if name == 'hum_on':
        tt = t(3.5)
        e = np.minimum(1, tt / 0.8) * np.exp(-np.maximum(0, tt - 2.0) / 0.9)
        y = (np.sin(2 * np.pi * 100 * tt) * 0.6 + np.sin(2 * np.pi * 50 * tt) + 0.3 * np.sin(2 * np.pi * 200 * tt)) * e
        return y * 0.018, 0.0
    if name == 'bulb':
        tt = t(0.25)
        y = rng.randn(len(tt)) * np.exp(-tt / 0.0015) * 0.7
        y += np.sin(2 * np.pi * (2600 + rng.rand() * 600) * tt) * np.exp(-tt / 0.03) * 0.35
        y += np.sin(2 * np.pi * 180 * tt) * np.exp(-tt / 0.02) * 0.4
        return y * 0.32, rng.uniform(-0.6, 0.6)
    if name == 'drawer':
        tt = t(1.3)
        n_ = fft_filter(rng.randn(len(tt)), lo=180, hi=900)
        e = np.minimum(1, tt / 0.1) * np.where(tt < 0.95, 1.0, np.exp(-(tt - 0.95) / 0.03))
        y = n_ * e * (0.5 + 0.5 * np.sin(2 * np.pi * 6 * tt) ** 2 * 0.4)
        y[int(0.95 * SR):] += np.sin(2 * np.pi * 95 * tt[int(0.95 * SR):]) * np.exp(-(tt[int(0.95 * SR):] - 0.95) / 0.08) * 0.8
        return y * 0.42, -0.5
    if name == 'thump':
        tt = t(0.5)
        return (np.sin(2 * np.pi * 85 * tt * np.exp(-tt * 3)) * np.exp(-tt / 0.1) * 0.9) * 0.5, -0.3
    if name == 'step':
        tt = t(0.2)
        y = np.sin(2 * np.pi * 220 * tt) * np.exp(-tt / 0.025) + fft_filter(rng.randn(len(tt)) * np.exp(-tt / 0.01), lo=400, hi=3500) * 0.6
        return y * 0.22, 0.2
    if name == 'whoosh':
        return noise_sweep(1.1, 300, 7000, 0.4, 'up'), 0.0
    if name == 'clank':
        tt = t(3.2)
        y = np.zeros(len(tt), np.float32)
        for k, (r, a, d) in enumerate(((1, 1.0, 1.4), (2.76, 0.7, 1.0), (5.4, 0.5, 0.7), (8.93, 0.35, 0.45), (13.3, 0.2, 0.3))):
            y += a * np.sin(2 * np.pi * 610 * r * tt + k) * np.exp(-tt / d * 2.2)
        y += fft_filter(rng.randn(len(tt)) * np.exp(-tt / 0.008), lo=2000, hi=9000) * 0.9
        return y * 0.26, 0.45
    if name == 'rumble':
        tt = t(2.2)
        e = np.minimum(1, tt / 0.4) * np.exp(-tt / 0.9)
        return (np.sin(2 * np.pi * 42 * tt) + 0.5 * np.sin(2 * np.pi * 63 * tt)) * e * 0.35, 0.0
    if name == 'breath':
        tt = t(0.7)
        e = np.sin(np.pi * np.minimum(1, tt / 0.7)) ** 2
        return fft_filter(rng.randn(len(tt)) * e, lo=500, hi=3500) * 0.06, 0.0
    if name == 'phone_unlock':
        tt = t(0.4)
        y = np.sin(2 * np.pi * 880 * tt) * np.exp(-tt / 0.08) * (tt < 0.12)
        y2 = np.sin(2 * np.pi * 1320 * tt) * np.exp(-np.maximum(0, tt - 0.1) / 0.1) * (tt >= 0.1)
        return (y + y2) * 0.2, 0.3
    if name == 'call_blip':
        tt = t(1.4)
        y = np.zeros(len(tt), np.float32)
        for st in (0.0, 0.45):
            m = (tt >= st) & (tt < st + 0.3)
            y[m] = (np.sin(2 * np.pi * 440 * tt[m]) + np.sin(2 * np.pi * 480 * tt[m])) * np.sin(np.pi * (tt[m] - st) / 0.3) ** 0.5
        return y * 0.11, 0.3
    if name == 'flash':
        tt = t(1.8)
        y = np.sin(2 * np.pi * 52 * tt * np.exp(-tt * 1.2)) * np.exp(-tt / 0.45) * 0.9
        y += fft_filter(rng.randn(len(tt)) * np.exp(-tt / 0.09), lo=300, hi=9000) * 0.55
        return y * 0.36, 0.0
    if name == 'wake':
        tt = t(1.5)
        y = np.zeros(len(tt), np.float32)
        for k, f in enumerate((660, 880, 1320, 1760)):
            m = tt >= k * 0.09
            y[m] += np.sin(2 * np.pi * f * (tt[m] - k * 0.09)) * np.exp(-(tt[m] - k * 0.09) / 0.35) * 0.4
        return y * 0.2, 0.0
    if name in ('ping', 'ping2'):
        tt = t(1.8)
        y = (np.sin(2 * np.pi * 1760 * tt) + 0.5 * np.sin(2 * np.pi * 2637 * tt) + 0.2 * np.sin(2 * np.pi * 4186 * tt)) * np.exp(-tt / 0.28)
        if name == 'ping2':
            m = tt >= 0.17
            y2 = np.zeros_like(y)
            y2[m] = (np.sin(2 * np.pi * 2349 * (tt[m] - 0.17)) + 0.5 * np.sin(2 * np.pi * 3520 * (tt[m] - 0.17))) * np.exp(-(tt[m] - 0.17) / 0.3)
            y = y + y2 * 1.1
        return y * 0.17, 0.2
    if name == 'buzz':
        tt = t(0.42)
        y = np.sign(np.sin(2 * np.pi * 155 * tt)) * 0.6 + np.sin(2 * np.pi * 310 * tt) * 0.3
        y = fft_filter(y, lo=80, hi=1200) * np.sin(np.pi * np.minimum(1, tt / 0.42)) ** 0.5
        return y * 0.38, 0.4
    if name == 'sparkle':
        tt = t(1.6)
        y = np.zeros(len(tt), np.float32)
        for k in range(7):
            st = k * 0.07 + rng.rand() * 0.03
            f = 2400 + k * 330 + rng.rand() * 200
            m = tt >= st
            y[m] += np.sin(2 * np.pi * f * (tt[m] - st)) * np.exp(-(tt[m] - st) / 0.22)
        return y * 0.035, 0.1
    if name == 'plink':
        tt = t(0.9)
        y = np.sin(2 * np.pi * (1300 - 700 * np.minimum(1, tt / 0.12)) * tt) * np.exp(-tt / 0.12)
        y += 0.3 * np.sin(2 * np.pi * 2600 * tt) * np.exp(-tt / 0.05)
        return y * 0.22, 0.2
    if name == 'riser':
        dur = 7.0
        y = noise_sweep(dur, 250, 9000, 0.5, 'up')
        tt = t(dur)
        tone = sum(np.sin(2 * np.pi * f * tt * (1 + 0.8 * (tt / dur))) for f in (220, 233.1, 329.6)) * (tt / dur) ** 2.2 * 0.16
        e = np.where(tt > dur - 0.12, np.maximum(0, (dur - tt) / 0.12), 1.0)
        return (y + tone) * e * 0.55, 0.0
    if name == 'flicker':
        tt = t(1.0)
        y = np.zeros(len(tt), np.float32)
        for _ in range(26):
            st = rng.rand() * 0.95
            m = int(st * SR)
            k = int(0.006 * SR)
            y[m:m + k] += rng.randn(min(k, len(y) - m)) * 0.8
        y = fft_filter(y, lo=800, hi=9000) + np.sin(2 * np.pi * 100 * tt) * 0.08 * (rng.rand(len(tt)) > 0.5)
        return y * 0.28, 0.0
    if name == 'boom':
        tt = t(3.6)
        y = np.sin(2 * np.pi * (58 - 24 * np.minimum(1, tt / 1.2)) * tt) * np.exp(-tt / 0.9) * 1.0
        y += fft_filter(rng.randn(len(tt)) * np.exp(-tt / 0.12), lo=40, hi=1800) * 0.7
        y += 0.12 * np.sin(2 * np.pi * 610 * 0.5 * tt) * np.exp(-tt / 0.7)
        return y * 0.5, 0.0
    if name == 'lights_out':
        tt = t(1.3)
        f = 900 * np.exp(-tt * 3.6) + 50
        y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 0.5) * 0.6
        y += fft_filter(rng.randn(len(tt)) * np.exp(-tt / 0.05), lo=500, hi=8000) * 0.3
        return y * 0.25, 0.0
    raise ValueError(name)


# ------------------------------------------------------------------ müzik
BPM = 76.0
BEAT = 60.0 / BPM
BAR = BEAT * 4
T0 = 3.0
CH = {
    'Am': (['A2', 'E3'], ['A3', 'C4', 'E4', 'A4', 'C5']),
    'F': (['F2', 'C3'], ['A3', 'C4', 'F4', 'A4', 'C5']),
    'C': (['C3', 'G3'], ['G3', 'C4', 'E4', 'G4', 'C5']),
    'G': (['G2', 'D3'], ['G3', 'B3', 'D4', 'G4', 'B4']),
    'Dm': (['D2', 'A2'], ['A3', 'D4', 'F4', 'A4', 'D5']),
    'E': (['E2', 'B2'], ['G#3', 'B3', 'E4', 'G#4', 'B4']),
}
MEL = {
    'Am': [(0, 'E5', 1.5), (1.5, 'D5', .5), (2, 'C5', 1), (3, 'D5', 1)],
    'F': [(0, 'C5', 2), (2, 'A4', 1), (3, 'C5', 1)],
    'C': [(0, 'E5', 1.5), (1.5, 'G5', .5), (2, 'E5', 1), (3, 'D5', 1)],
    'G': [(0, 'D5', 2), (2, 'B4', 1), (3, 'D5', 1)],
}


def music():
    pf, st, ef = bus(), bus(), bus()
    A_prog = ['Am', 'F', 'C', 'G']
    pat = [0, 2, 1, 3, 2, 4, 3, 2]
    # --- Giriş: tek tük notalar (ampuller yanarken)
    for tt_, n, v in ((1.5, 'A3', .38), (2.25, 'E4', .34), (2.7, 'C5', .32)):
        add(pf, piano(nf(n), 2.0, v), tt_, -0.1)
    # --- A bölümü (romantik) 3.0 – 26.4
    nb = int((26.4 - T0) / BAR) + 1
    for b in range(nb):
        t_b = T0 + b * BAR
        name = A_prog[b % 4]
        lo, up = CH[name]
        grow = min(1.0, 0.55 + b * 0.07)
        add(pf, piano(nf(lo[0]), 3.4, 0.5 * grow), t_b, -0.35)
        add(pf, piano(nf(lo[1]), 1.6, 0.34 * grow), t_b + 2 * BEAT, -0.3)
        for i, ix in enumerate(pat):
            tn = t_b + i * BEAT / 2
            if tn >= 26.4:
                break
            v = (0.36 if i % 2 == 0 else 0.27) * grow
            add(pf, piano(nf(up[ix]), 0.9, v), tn, -0.05 + 0.25 * (ix / 4))
        if b >= 2:
            for (beat, n, ln) in MEL[name]:
                tn = t_b + beat * BEAT
                if tn < 26.2:
                    add(pf, piano(nf(n), ln * BEAT * 1.1, 0.52), tn, 0.2)
        if b >= 3:
            fr = [nf(x) for x in (lo[0], up[0], up[2])] if False else [nf(lo[0]) * 2, nf(up[1]), nf(up[2])]
            end = min(t_b + BAR, 26.4)
            add(st, strings(fr, end - t_b, att=1.4, rel=1.2, vol=0.14 * min(1, (b - 2) / 3.0)), t_b, 0.0)
    # --- B bölümü: gerilim 26.4 – 42
    add(st, drone(nf('A1'), 16.0, 0.32, att=3.0), 26.5, 0.0)
    add(st, strings([nf('A3'), nf('Bb3'), nf('E4')], 6.0, att=2.2, rel=2.5, vol=0.16), 27.6, 0.0)
    add(st, strings([nf('A3'), nf('Bb3'), nf('D#4'), nf('F#4')], 10.0, att=4.0, rel=2.0, vol=0.2, trem=0.35, bright=0.8), 31.0, 0.1)
    for k, (tt_, n) in enumerate(((29.0, 'A2'), (32.2, 'Bb2'), (35.4, 'A2'), (38.2, 'E2'), (40.0, 'F2'))):
        add(pf, piano(nf(n), 2.5, 0.42), tt_, -0.2)
    # --- C bölümü: Mert / ilk hamle 42 – 65
    C_prog = ['Am', 'F', 'Dm', 'E']
    roots = {'Am': 'A1', 'F': 'F1', 'Dm': 'D2', 'E': 'E2'}
    nbar = int((65 - 42.0) / BAR) + 1
    for b in range(nbar):
        t_b = 42.0 + b * BAR
        name = C_prog[b % 4]
        lo, up = CH[name]
        end = min(t_b + BAR, 65.0)
        for i in range(8):
            tn = t_b + i * BEAT / 2
            if tn < 64.9:
                add(pf, bass_pluck(nf(roots[name]), 0.34, 0.5 if i % 2 == 0 else 0.34), tn, -0.1)
        for beat in (0, 1.5, 2, 3.5):
            tn = t_b + beat * BEAT
            if tn < 64.9:
                add(pf, piano(nf(up[1] if beat in (0, 2) else up[3]), 0.35, 0.34), tn, 0.25)
        add(st, strings([nf(lo[0]) * 2, nf(up[0]), nf(up[2])], end - t_b, att=1.0, rel=1.0, vol=0.15 + 0.07 * min(1, (t_b - 42) / 18)), t_b, 0.0)
        if t_b > 52:
            add(st, strings([nf(up[3]) * 2, nf(up[4]) * 2], end - t_b, att=1.5, rel=1.0, vol=0.05, trem=0.5, bright=0.5), t_b, 0.2)
    # hi-hat benzeri tikler
    t = 46.0
    while t < 64.6:
        k = int(0.03 * SR)
        h = fft_filter(rng.randn(k) * np.exp(-np.arange(k) / (0.005 * SR)), lo=6000)
        add(ef, h * 0.07, t, 0.3)
        t += BEAT / 2
    # --- D bölümü: Rüya yalnız 65 – 82
    D_prog = ['Am', 'F', 'Dm', 'E']
    nbar = int((82.0 - 65.0) / BAR) + 1
    for b in range(nbar):
        t_b = 65.0 + b * BAR
        name = D_prog[b % 4]
        lo, up = CH[name]
        if t_b >= 81.0:
            break
        add(pf, piano(nf(lo[0]), 3.6, 0.42), t_b, -0.3)
        for i in range(4):
            tn = t_b + (i * 2 + 1) * BEAT / 2
            if tn < 78.9:
                add(pf, piano(nf(up[(0, 2, 3, 1)[i]]), 1.2, 0.26), tn, 0.1)
        add(st, strings([nf(lo[0]) * 2, nf(up[0]), nf(up[2]) if name != 'E' else nf('B3')], BAR, att=1.8, rel=1.6, vol=0.17), t_b, 0.0)
    for (beat, n, ln) in ((0, 'A4', 1), (1, 'C5', 1), (2, 'E5', 1.5), (3.5, 'D5', .5)):
        add(pf, piano(nf(n), ln * BEAT, 0.46), 66.5 + beat * BEAT, 0.2)
    add(st, drone(nf('A1'), 16.0, 0.3, att=4.0), 65.0, 0.0)
    add(st, strings([nf('E5'), nf('Bb5'), nf('A4')], 6.5, att=5.0, rel=0.6, vol=0.2, trem=0.4, bright=0.7), 72.3, 0.0)
    add(st, drone(nf('A1'), 4.0, 0.34, att=1.0), 79.0, 0.0)
    # --- kalp atışı
    def heart(t0):
        y = np.zeros(int(0.7 * SR), np.float32)
        tt = np.arange(len(y)) / SR
        for st_, amp in ((0, 1.0), (0.27, 0.65)):
            m = tt >= st_
            y[m] += np.sin(2 * np.pi * 62 * (tt[m] - st_) * np.exp(-(tt[m] - st_) * 4)) * np.exp(-(tt[m] - st_) / 0.09) * amp
        return y * 0.5
    t = 36.5
    while t < 41.6:
        add(ef, heart(t), t, 0.0, 0.7); t += 0.95
    t = 67.0
    iv = 1.0
    while t < 80.3:
        add(ef, heart(t), t, 0.0, 0.9); iv = max(0.55, iv - 0.02); t += iv
    return pf, st, ef


def fade_cut(b, t_cut, ramp=0.05):
    """Belirli anda müziği aniden keser (clank)."""
    i = int(t_cut * SR); r = int(ramp * SR)
    b[:, i:i + r] *= np.linspace(1, 0, r)[None, :]
    b[:, i + r:] = 0


def read_line(code):
    with wave.open(os.path.join(LINES_DIR, code + '.wav')) as w:
        return np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768


PAN = {'ruya': -0.12, 'aras': 0.12, 'lalin': 0.06, 'mert': -0.05}


def voices():
    v = bus()
    for code, who, t0 in LINES:
        x = read_line(code)
        thr = 0.04 * np.max(np.abs(x))
        act = x[np.abs(x) > thr]
        rms = math.sqrt(np.mean(act ** 2)) + 1e-6
        x = x * (0.105 / rms)
        x = fft_filter(x, lo=85)
        # hafif sunum bölgesi vurgusu + yumuşak sıkıştırma
        pres = fft_filter(x, lo=2200, hi=5200)
        x = np.tanh((x + 0.22 * pres) * 1.25) / 1.25
        add(v, x, t0, PAN[who])
    return v


def env_follow(x, att=0.04, rel=0.35):
    a = np.abs(x)
    n = int(0.01 * SR)
    a = np.convolve(a, np.ones(n) / n, mode='same')
    out = np.zeros_like(a)
    ca, cr = math.exp(-1 / (att * SR)), math.exp(-1 / (rel * SR))
    s = 0.0
    step = 64
    for i in range(0, len(a), step):
        v = a[i:i + step].max()
        s = ca * s + (1 - ca) * v if v > s else cr * s + (1 - cr) * v
        out[i:i + step] = s
    return out


def save_wav(path, b):
    x = np.clip(b.T, -1, 1)
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x * 32767).astype(np.int16).tobytes())


def main():
    os.makedirs(OUT, exist_ok=True)
    pf, st, ef = music()
    # clank anında müzik kesilir, sessizlik + metalik ses
    for b_ in (pf, st):
        pass
    mus = pf + st
    # klank öncesi: piyano/yaylılar aniden kesilir (26.42 sn), ardından B bölümü başlar
    gate = np.ones(N, np.float32)
    i0 = int(26.40 * SR)
    gate[i0:i0 + int(0.05 * SR)] = np.linspace(1, 0, int(0.05 * SR))
    gate[i0 + int(0.05 * SR):int(27.55 * SR)] = 0.0
    r = int(1.2 * SR)
    gate[int(27.55 * SR):int(27.55 * SR) + r] = np.linspace(0, 1, r) ** 2
    pf_g = pf.copy(); st_g = st.copy()
    # A bölümü bittikten sonra çalan B bölümü parçaları (drone/strings @26.5+) kapıdan muaf olmalı
    pf_A = pf.copy(); pf_A[:, int(26.4 * SR):] = 0
    pf_B = pf - pf_A
    st_A = st.copy(); st_A[:, int(26.4 * SR):] = 0
    st_B = st - st_A
    pf_A[:, i0:] = 0; st_A[:, i0:] = 0
    pf_A[:, i0 - int(0.0 * SR):i0] *= 1
    pf_A_tail = pf_A  # A bölümünün uzayan kuyruğu kesilmiş (clank'te sessizlik)
    pf_A_tail[:, i0 - int(0.04 * SR):i0] *= np.linspace(1, 0.0, int(0.04 * SR))[None, :]
    mus = pf_A + st_A + pf_B + st_B * (gate[None, :] * 0 + 1)
    # 82.0 sonrası müzik tamamen kapanır (karartma)
    j = int(81.2 * SR)
    mus[:, j:j + int(1.2 * SR)] *= np.linspace(1, 0, int(1.2 * SR))[None, :]
    mus[:, j + int(1.2 * SR):] = 0
    ef[:, int(82.0 * SR):] *= 0
    # 65.0 kesme: C bölümü anında biter (kalan kuyruk kısa solar)
    k = int(64.95 * SR)
    mus_C_cut = np.ones(N, np.float32)
    mus_C_cut[k:k + int(0.06 * SR)] = np.linspace(1, 0, int(0.06 * SR))
    # D bölümü 65.0'da başlar; C kuyruğunu kesmek için C'ye ait parçalar sadece <65 olacak şekilde zaten sınırlandı

    seg = mus[:, int(12 * SR):int(26 * SR)]
    g = 0.05 / (np.sqrt(np.mean(seg ** 2)) + 1e-9)
    print('müzik kazancı', round(float(g), 3))
    mus = mus * g; ef = ef * g
    # --- SFX
    sfx_dry, sfx_wet = bus(), bus()
    for name, t0 in SFX:
        y, pan = sfx(name)
        if name in ('clank', 'boom', 'rumble', 'flash', 'sparkle', 'plink', 'ping', 'ping2', 'wake', 'phone_unlock'):
            add(sfx_wet, y, t0, pan)
        add(sfx_dry, y, t0, pan, 1.0)
    sfx_dry[:, int(82.6 * SR):] *= 0.0
    # --- Ses
    vo = voices()
    # ducking
    venv = env_follow(vo.sum(axis=0))
    venv = np.clip(venv / (np.percentile(venv[venv > 0.01], 85) if np.any(venv > 0.01) else 1), 0, 1)
    duck = 10 ** ((-10.5 * venv) / 20)
    # --- reverb ve karışım
    mus_rev = reverb(mus, 0.22)
    sfx_rev = reverb(sfx_wet, 0.22, ir=[make_ir(5, 0.7, 3.4), make_ir(6, 0.7, 3.4)])
    vo_rev = reverb(vo, 0.06)
    music_bus = (mus * 0.85 + mus_rev) * duck[None, :] + ef * 0.85 * duck[None, :]
    music_bus *= 0.9
    sfx_bus = sfx_dry + sfx_rev * 0.55
    voice_bus = vo * 1.0 + vo_rev
    mix = music_bus + sfx_bus + voice_bus
    # oda tonu
    mix += (fft_filter(rng.randn(N).astype(np.float32) * 0.0012, lo=60, hi=900))[None, :]
    mix = np.tanh(mix * 0.95) / 0.95
    n_out = int(DUR * SR)
    mix = mix[:, :n_out]
    # fade-in/out
    mix[:, :int(0.15 * SR)] *= np.linspace(0, 1, int(0.15 * SR))[None, :]
    mix[:, -int(0.8 * SR):] *= np.linspace(1, 0, int(0.8 * SR))[None, :]
    pk = np.max(np.abs(mix))
    mix = mix * (10 ** (-1.5 / 20) / pk)
    save_wav(os.path.join(OUT, 'mix.wav'), mix)
    save_wav(os.path.join(OUT, 'stem_muzik.wav'), (music_bus[:, :n_out] / pk))
    save_wav(os.path.join(OUT, 'stem_sfx.wav'), (sfx_bus[:, :n_out] / pk))
    save_wav(os.path.join(OUT, 'stem_ses.wav'), (voice_bus[:, :n_out] / pk))
    # analiz: konuşma anında müzik/ses oranı
    rep = []
    for code, who, t0 in LINES:
        a, b = int(t0 * SR), int((t0 + 1.2) * SR)
        v = np.sqrt(np.mean(voice_bus[:, a:b] ** 2)); m = np.sqrt(np.mean((music_bus[:, a:b] + sfx_bus[:, a:b]) ** 2)) + 1e-9
        rep.append((code, round(20 * math.log10(v / m), 1)))
    print('ses/müzik+efekt oranı (dB):', rep)
    print('tepe', pk)


if __name__ == '__main__':
    main()
