"""Katlanmayanların İsyanı: komik müzik + efekt sentezi ve seslendirme karışımı."""
import os, math, wave
import numpy as np
import audiokit as ak
from audiokit import SR, N, bus, add, fft_filter, reverb, make_ir, piano, strings, bass_pluck, drone, noise_sweep, env_follow, save_wav, nf
import direct
from lines import LINES as TEXTS

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'out')
LD = os.path.join(HERE, '..', 'audio', 'lines')
rng = np.random.RandomState(11)


def T(d):
    return np.arange(int(d * SR), dtype=np.float32) / SR


# ------------------------------------------------------------- enstrümanlar
def marimba(f, vel=0.5):
    t = T(0.9)
    y = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.25) + 0.35 * np.sin(2 * np.pi * f * 3.93 * t) * np.exp(-t / 0.05)
    y += 0.12 * np.sin(2 * np.pi * f * 9.2 * t) * np.exp(-t / 0.02)
    return y * (1 - np.exp(-t / 0.002)) * vel


def tuba(f, dur, vel=0.5):
    t = T(dur + 0.15)
    y = sum(np.sin(2 * np.pi * f * n * t + n) / n ** 1.1 for n in range(1, 7))
    e = np.minimum(1, t / 0.03) * np.exp(-t / (dur * 0.9 + 0.05)) * np.where(t > dur, np.exp(-(t - dur) / 0.05), 1)
    return y * e * vel


def clarinet(f, dur, vel=0.4):
    t = T(dur + 0.1)
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.5 * t) * np.minimum(1, t / 0.3)
    ph = 2 * np.pi * f * np.cumsum(vib) / SR
    y = np.sin(ph) + 0.42 * np.sin(3 * ph) + 0.22 * np.sin(5 * ph) + 0.1 * np.sin(7 * ph)
    e = np.minimum(1, t / 0.04) * np.where(t > dur, np.exp(-(t - dur) / 0.04), 1)
    return y * e * vel


def brass(freqs, dur, vel=0.4, glide=0.0, vib=0.0):
    t = T(dur + 0.2)
    y = np.zeros(len(t), np.float32)
    for f in freqs:
        fr = f * (1 + glide * (t / dur)) * (1 + vib * np.sin(2 * np.pi * 5.2 * t) * np.minimum(1, t / max(0.01, dur * 0.6)))
        ph = 2 * np.pi * np.cumsum(fr) / SR
        for n in range(1, 9):
            y += np.sin(n * ph) / n * (0.9 ** n) * (1.4 if n == 2 else 1)
    e = np.minimum(1, t / 0.05) * np.where(t > dur, np.exp(-(t - dur) / 0.06), 1)
    return y * e * vel / len(freqs) ** 0.5


def snare(vel=0.4):
    t = T(0.3)
    return (fft_filter(rng.randn(len(t)) * np.exp(-t / 0.06), lo=1500, hi=9000) * 0.8 + np.sin(2 * np.pi * 185 * t) * np.exp(-t / 0.05)) * vel


def kick(vel=0.6):
    t = T(0.4)
    return np.sin(2 * np.pi * 55 * t * np.exp(-t * 6) * 2) * np.exp(-t / 0.12) * vel


def cymbal(vel=0.25, d=1.6):
    t = T(d)
    return fft_filter(rng.randn(len(t)) * np.exp(-t / (d * 0.35)), lo=5000) * vel


def slide(f0, f1, dur, vel=0.25):
    t = T(dur)
    fr = f0 * (f1 / f0) ** (t / dur) * (1 + 0.01 * np.sin(2 * np.pi * 6 * t))
    return np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.sin(np.pi * t / dur) ** 0.4 * vel


# ------------------------------------------------------------- müzik
BEAT = 0.5


def music():
    m = bus()
    # giriş: parmak ucu pizzicato
    for i, n in enumerate(['C3', 'G2', 'C3', 'G2', 'Eb3']):
        add(m, bass_pluck(nf(n), 0.25, 0.35), 0.4 + i * 0.42, -0.2)
    # A: komik marş 3.3 – 28.4
    prog = [('C2', ['C4', 'E4', 'G4']), ('G1', ['B3', 'D4', 'G4']), ('A1', ['C4', 'E4', 'A4']), ('F1', ['C4', 'F4', 'A4'])]
    mel = ['G4', 'E4', 'C4', 'E4', 'G4', 'Ab4', 'G4', 'E4', 'F4', 'D4', 'B3', 'D4', 'F4', 'E4', 'D4', 'G3']
    t = 4.0; bar = 0
    while t < 28.3:
        root, ch = prog[bar % 4]
        for b in range(4):
            tb = t + b * BEAT
            if tb >= 28.35:
                break
            if b % 2 == 0:
                add(m, tuba(nf(root), 0.32, 0.55), tb, -0.1)
            else:
                for n in ch:
                    add(m, marimba(nf(n), 0.18), tb, 0.25)
                add(m, marimba(nf(ch[1]) * 2, 0.08), tb + 0.25, 0.3)
        if bar % 2 == 0:
            for k in range(8):
                tn = t + k * BEAT / 2
                if tn < 28.3 and (k % 3 != 2):
                    add(m, clarinet(nf(mel[(bar * 4 + k) % len(mel)]), 0.2, 0.16), tn, 0.1)
        t += 4 * BEAT; bar += 1
    # kaos 28.4 – 32.6: hızlı, trampet, kayan düdük
    t = 28.4
    k = 0
    while t < 32.6:
        add(m, snare(0.22 if k % 2 else 0.32), t, 0.0)
        if k % 2 == 0:
            add(m, tuba(nf(['C2', 'Db2', 'D2', 'Eb2'][(k // 2) % 4]), 0.18, 0.6), t, -0.1)
        add(m, marimba(nf(['C5', 'B4', 'Bb4', 'A4', 'Ab4', 'G4'][k % 6]), 0.16), t + 0.06, 0.3)
        t += 0.25; k += 1
    add(m, slide(500, 1400, 0.8, 0.12), 29.3, 0.4)
    add(m, slide(1400, 400, 0.8, 0.12), 30.9, -0.4)
    # S4: sahte-dramatik yaylılar
    add(m, drone(nf('C2'), 7.8, 0.22, att=1.0, rel=1.5), 35.6, 0.0)
    for tt, ch in ((35.7, ['C3', 'Eb3', 'G3']), (38.3, ['Ab2', 'C3', 'Eb3']), (40.6, ['G2', 'B2', 'D3', 'F3'])):
        add(m, strings([nf(x) for x in ch], 2.4, att=0.6, rel=0.8, vol=0.24), tt, 0.0)
    add(m, brass([nf('G2'), nf('D3')], 0.5, 0.3), 43.0, 0.0)
    # ayak sesi gerilimi
    for tt in (44.0, 44.6, 45.2, 45.8):
        add(m, tuba(nf('C2'), 0.25, 0.5), tt, 0.0)
    # fanfar
    add(m, brass([nf('C4'), nf('E4'), nf('G4'), nf('C5')], 0.35, 0.5), 46.45, 0.0)
    add(m, brass([nf('C4'), nf('E4'), nf('G4'), nf('C5')], 1.3, 0.55), 46.85, 0.0)
    add(m, cymbal(0.3, 2.0), 46.85, 0.2)
    add(m, kick(0.7), 46.85, 0.0)
    # kaldırma/taşıma: tırmanan pizzicato
    seq = ['C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4']
    for i, n in enumerate(seq):
        add(m, bass_pluck(nf(n), 0.18, 0.35), 49.6 + i * 0.25, 0.1 * ((i % 2) * 2 - 1))
    add(m, slide(300, 1200, 0.7, 0.14), 49.6, 0.0)
    add(m, slide(1200, 250, 0.3, 0.14), 52.55, 0.0)
    # final: rimshot + üzgün trombon
    add(m, snare(0.45), 59.55, 0.0); add(m, snare(0.35), 59.68, 0.0); add(m, cymbal(0.35, 1.2), 59.82, 0.1); add(m, kick(0.5), 59.82, 0.0)
    for i, (n, d, v) in enumerate((('Bb3', 0.42, 0.0), ('A3', 0.42, 0.0), ('Ab3', 0.42, 0.0), ('G3', 1.4, 0.03))):
        add(m, brass([nf(n)], d, 0.55, glide=-0.02 if i == 3 else 0.0, vib=v), 60.0 + i * 0.5, 0.0)
    return m


# ------------------------------------------------------------- efektler
def sfx(name):
    if name == 'door':
        y, p = ak.sfx('door'); return y * 1.2, 0.6
    if name == 'door2':
        y, p = ak.sfx('door'); return y * 0.6, 0.8
    if name == 'keys':
        t = T(0.7); y = np.zeros(len(t), np.float32)
        for _ in range(9):
            st = rng.rand() * 0.45; f = rng.uniform(3000, 6500); m_ = t >= st
            y[m_] += np.sin(2 * np.pi * f * (t[m_] - st)) * np.exp(-(t[m_] - st) / 0.06)
        return y * 0.06, 0.6
    if name == 'boing':
        t = T(0.9)
        f = 160 + 140 * np.exp(-t * 3) * np.cos(2 * np.pi * 9 * t) + 60 * t
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.35) * 0.3, 0.0
    if name in ('whoosh', 'zoom'):
        return noise_sweep(0.45, 400, 6000, 0.22, 'up'), 0.0
    if name == 'whip':
        return noise_sweep(0.25, 800, 8000, 0.2, 'up'), 0.0
    if name == 'pop':
        t = T(0.2); return np.sin(2 * np.pi * (900 - 2500 * t) * t) * np.exp(-t / 0.04) * 0.2, 0.0
    if name == 'shake':
        y, _ = ak.sfx('rumble'); return y * 0.18, 0.0
    if name == 'chaos':
        t = T(4.2)
        y = fft_filter(rng.randn(len(t)), lo=300, hi=3000) * (0.5 + 0.5 * np.abs(np.sin(2 * np.pi * 3.1 * t))) * 0.07
        return y * np.minimum(1, t / 0.2) * np.minimum(1, (4.2 - t) / 0.2), 0.0
    if name == 'scratch':
        t = T(0.5)
        f = 300 + 900 * np.abs(np.sin(2 * np.pi * 4 * t))
        y = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.4 + fft_filter(rng.randn(len(t)), lo=800, hi=5000) * 0.5
        return y * np.exp(-t / 0.25) * 0.4, 0.0
    if name == 'stomp':
        t = T(0.6); return (np.sin(2 * np.pi * 70 * t * np.exp(-t * 4)) * np.exp(-t / 0.12) + fft_filter(rng.randn(len(t)) * np.exp(-t / 0.03), lo=200, hi=2000) * 0.5) * 0.22, 0.4
    if name == 'gulp':
        t = T(0.35); f = 300 - 500 * t + 400 * t * t * 4
        return np.sin(2 * np.pi * np.cumsum(np.maximum(80, f)) / SR) * np.sin(np.pi * t / 0.35) * 0.18, 0.0
    if name == 'step':
        t = T(0.7)
        y = np.sin(2 * np.pi * 48 * t * np.exp(-t * 2.5)) * np.exp(-t / 0.15) * 1.0
        y += fft_filter(rng.randn(len(t)) * np.exp(-t / 0.035), lo=80, hi=1500) * 0.6
        return y * 0.6, 0.6
    if name == 'fanfare':
        return np.zeros(10, np.float32), 0.0
    if name == 'rustle':
        t = T(3.4)
        y = fft_filter(rng.randn(len(t)), lo=1200, hi=7000) * (0.4 + 0.6 * np.abs(np.sin(2 * np.pi * 2.3 * t))) * np.minimum(1, t / 0.2)
        return y * 0.09 * np.minimum(1, (3.4 - t) / 0.4), 0.0
    if name == 'thud':
        t = T(0.9)
        y = np.sin(2 * np.pi * 60 * t * np.exp(-t * 3)) * np.exp(-t / 0.18) + fft_filter(rng.randn(len(t)) * np.exp(-t / 0.08), lo=150, hi=2500) * 0.6
        return y * 0.55, 0.2
    if name == 'cricket':
        t = T(2.6); y = np.zeros(len(t), np.float32)
        for st in np.arange(0.0, 2.5, 0.42):
            for k in range(3):
                s0 = st + k * 0.05; m_ = (t >= s0) & (t < s0 + 0.035)
                y[m_] += np.sin(2 * np.pi * 4300 * t[m_]) * np.sin(np.pi * (t[m_] - s0) / 0.035)
        return y * 0.05, 0.5
    if name in ('rimshot', 'trombone'):
        return np.zeros(10, np.float32), 0.0
    raise ValueError(name)


PAN = dict(gomlek=0.0, havlu=-0.4, tisort=0.4, corapA=-0.6, pantolon=0.1, corapB=0.7, sepet=0.45)


def read(code):
    with wave.open(os.path.join(LD, code + '.wav')) as w:
        return np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768


def voices():
    v = bus()
    for code, t0 in direct.SCHED:
        who = TEXTS[code][0]
        x = read(code)
        act = x[np.abs(x) > 0.04 * np.max(np.abs(x))]
        x = x * (0.11 / (math.sqrt(np.mean(act ** 2)) + 1e-6))
        x = fft_filter(x, lo=90)
        x = np.tanh(x * 1.3) / 1.3
        g = 0.62 if code.startswith('a_') else 1.0
        if code in ('s1',):
            g = 1.25
        add(v, x, t0, PAN[who], g)
    return v


def main():
    os.makedirs(OUT, exist_ok=True)
    mus = music()
    seg = mus[:, int(4 * SR):int(28 * SR)]
    mus *= 0.05 / (np.sqrt(np.mean(seg ** 2)) + 1e-9)
    # "YETER" anında müzik kesilir
    i = int(32.65 * SR); r = int(0.05 * SR)
    mus[:, i:i + r] *= np.linspace(1, 0, r)[None, :]
    mus[:, i + r:int(35.5 * SR)] = 0
    sf = bus()
    for name, t0 in direct.SFX:
        y, pan = sfx(name)
        add(sf, y, t0, pan)
    vo = voices()
    venv = env_follow(vo.sum(axis=0))
    venv = np.clip(venv / (np.percentile(venv[venv > 0.01], 85) if np.any(venv > 0.01) else 1), 0, 1)
    venv = np.maximum(venv, np.roll(venv, -int(0.12 * SR)))   # ileri bakış
    duck = 10 ** ((-11 * venv) / 20)
    mus_bus = (mus + reverb(mus, 0.16)) * duck[None, :]
    sfx_bus = sf + reverb(sf, 0.12)
    vo_bus = vo + reverb(vo, 0.05)
    mix = mus_bus + sfx_bus + vo_bus
    mix += fft_filter(rng.randn(N).astype(np.float32) * 0.0008, lo=60, hi=800)[None, :]
    n_out = int(direct.DUR * SR)
    mix = np.tanh(mix[:, :n_out] * 0.95) / 0.95
    mix[:, :int(0.05 * SR)] *= np.linspace(0, 1, int(0.05 * SR))[None, :]
    mix[:, -int(0.5 * SR):] *= np.linspace(1, 0, int(0.5 * SR))[None, :]
    pk = np.max(np.abs(mix))
    mix *= 10 ** (-1.5 / 20) / pk
    save_wav(os.path.join(OUT, 'mix.wav'), mix)
    rep = []
    for code, t0 in direct.SCHED:
        if code.startswith('a_'):
            continue
        a, b = int(t0 * SR), int((t0 + 0.9) * SR)
        v = np.sqrt(np.mean(vo_bus[:, a:b] ** 2)); m = np.sqrt(np.mean((mus_bus[:, a:b] + sfx_bus[:, a:b]) ** 2)) + 1e-9
        rep.append((code, round(20 * math.log10(v / m), 1)))
    print('ses / müzik+efekt (dB):', rep)


if __name__ == '__main__':
    main()
