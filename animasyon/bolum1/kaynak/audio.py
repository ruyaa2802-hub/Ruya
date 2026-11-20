# -*- coding: utf-8 -*-
"""Ses tasarımı: tamamen sentezlenmiş piyano + yaylılar, sokak ambiyansı,
rüzgâr, ayak sesleri, evlerden gelen boğuk aile sesleri ve tabak tıkırtıları."""
import math
import os

import numpy as np
from scipy import signal
from scipy.io import wavfile

import scenes as S
from core import FPS

SR = 48000
DUR = S.T_END
N = int(DUR * SR)
rng = np.random.default_rng(7)
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'build')


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12.0)


def env_curve(points):
    """[(t, değer), ...] → örnek başına zarf"""
    t = np.arange(N) / SR
    ts = [p[0] for p in points]
    vs = [p[1] for p in points]
    return np.interp(t, ts, vs).astype(np.float32)


def lp(x, f, order=2):
    b, a = signal.butter(order, f / (SR / 2), 'low')
    return signal.lfilter(b, a, x).astype(np.float32)


def hp(x, f, order=2):
    b, a = signal.butter(order, f / (SR / 2), 'high')
    return signal.lfilter(b, a, x).astype(np.float32)


def bp(x, f1, f2, order=2):
    b, a = signal.butter(order, [f1 / (SR / 2), f2 / (SR / 2)], 'band')
    return signal.lfilter(b, a, x).astype(np.float32)


# =============================================================== piyano
def piano_note(m, vel, dur=3.5):
    f = mtof(m)
    n = int((dur + 1.0) * SR)
    t = np.arange(n) / SR
    out = np.zeros(n, np.float32)
    B = 0.00025
    for k in range(1, 10):
        fk = f * k * math.sqrt(1 + B * k * k)
        if fk > 9000:
            break
        amp = (1.0 / k ** 1.25) * (1 + 0.6 * vel * (k > 2))
        dec = 1.2 + 0.9 * k + f / 600
        out += (amp * np.exp(-t * dec / 2.6) * np.sin(2 * math.pi * fk * t + rng.random() * 6)).astype(np.float32)
    # iki aşamalı sönüm (piyano karakteri)
    e = 0.65 * np.exp(-t * 3.0) + 0.35 * np.exp(-t * 0.55)
    att = np.clip(t / 0.004, 0, 1)
    rel = np.clip((dur - t) / 0.35 + 1, 0, 1)
    out *= (e * att * rel).astype(np.float32)
    # çekiç sesi
    h = rng.normal(0, 1, int(0.02 * SR)).astype(np.float32) * np.exp(-np.arange(int(0.02 * SR)) / (0.003 * SR))
    out[:len(h)] += lp(h, 3000) * 0.05
    return out * vel * 0.22


def strings_note(m, t0, t1, amp, attack=1.6, release=2.2):
    f = mtof(m)
    n = int((t1 - t0 + release) * SR)
    t = np.arange(n) / SR
    out = np.zeros(n, np.float32)
    for det in (-0.07, 0.0, 0.065):
        vib = 1 + 0.0035 * np.sin(2 * math.pi * (5.0 + det * 3) * t + rng.random() * 6)
        ph = 2 * math.pi * f * (1 + det / 100) * np.cumsum(vib) / SR
        for k in range(1, 12):
            if f * k > 6000:
                break
            out += (np.sin(k * ph) / k).astype(np.float32)
    e = np.clip(t / attack, 0, 1) ** 1.5
    e = e * np.clip((t1 - t0 + release - t) / release, 0, 1)
    out = lp(out * e.astype(np.float32), 2200)
    return out * amp * 0.03


def place(buf, x, t0, gain=1.0, pan=0.0):
    i = int(t0 * SR)
    if i >= N:
        return
    x = x[:N - i]
    l = math.cos((pan + 1) * math.pi / 4)
    r = math.sin((pan + 1) * math.pi / 4)
    buf[0, i:i + len(x)] += x * gain * l
    buf[1, i:i + len(x)] += x * gain * r


# akorlar: (başlangıç, bitiş, notalar[midi], piyano deseni yoğunluğu)
A3, C4, E4, F3, G3, B3, D4 = 57, 60, 64, 53, 55, 59, 62
CHORDS = [
    (0.0, 7.5, [45, 57, 60, 64], 0.4),       # Am
    (7.5, 11.25, [41, 57, 60, 65], 0.8),     # F
    (11.25, 15.0, [48, 55, 60, 64], 0.8),    # C
    (15.0, 18.75, [43, 55, 59, 62], 0.9),    # G
    (18.75, 22.5, [45, 57, 60, 64], 0.9),    # Am
    (22.5, 26.25, [41, 57, 60, 65], 0.9),    # F
    (26.25, 30.0, [48, 55, 60, 64], 0.9),    # C
    (30.0, 33.75, [40, 56, 59, 64], 0.8),    # E
    (33.75, 37.5, [38, 57, 62, 65], 0.7),    # Dm
    (37.5, 40.2, [45, 57, 60, 64], 0.5),     # Am
    (40.2, 43.4, [41, 57, 60, 65], 0.15),    # F (kızın repliği: neredeyse sessiz)
    (43.4, 46.5, [41, 60, 65, 69], 0.9),     # F (hayal: parlak)
    (46.5, 49.5, [43, 62, 67, 71], 1.0),     # G
    (49.5, 52.6, [48, 64, 67, 72], 1.0),     # C
    (52.6, 56.0, [45, 60, 64, 69], 0.4),     # Am (hayal dağılıyor)
    (56.0, 59.5, [41, 57, 60, 65], 0.5),     # F
    (59.5, 63.0, [38, 57, 62, 65], 0.5),     # Dm
    (63.0, 66.5, [40, 56, 59, 64], 0.6),     # E
    (66.5, 70.0, [45, 57, 60, 64], 0.6),     # Am
    (70.0, 75.0, [41, 57, 60, 65], 0.35),    # F
    (75.0, 79.0, [41, 57, 60, 64], 0.45),    # Fmaj7
    (79.0, 83.0, [43, 55, 59, 62], 0.45),    # G
    (83.0, 90.0, [45, 57, 60, 64, 69], 0.3),  # Am (final)
]

MELODY = [  # (zaman, midi, hız)
    (1.0, 76, 0.35), (3.0, 74, 0.3), (4.9, 72, 0.3),
    (16.0, 74, 0.4), (17.0, 72, 0.35), (17.9, 71, 0.35), (19.8, 72, 0.4), (21.6, 76, 0.4),
    (23.5, 77, 0.42), (24.4, 76, 0.38), (25.3, 74, 0.35), (27.2, 72, 0.4), (29.0, 71, 0.35),
    (30.9, 68, 0.38), (32.8, 71, 0.35), (34.5, 69, 0.35), (36.4, 72, 0.3),
    (44.0, 81, 0.35), (44.9, 79, 0.3), (45.8, 77, 0.32), (47.0, 79, 0.38), (47.9, 81, 0.35),
    (48.8, 83, 0.38), (50.0, 84, 0.4), (51.4, 79, 0.3),
    (53.5, 76, 0.3), (57.2, 72, 0.28), (60.8, 74, 0.28), (64.0, 71, 0.3), (67.4, 72, 0.3),
    (68.5, 71, 0.25), (69.4, 69, 0.3),
    (76.0, 72, 0.3), (78.0, 76, 0.28), (80.2, 74, 0.28), (82.4, 71, 0.25), (84.0, 69, 0.38),
]


def music():
    buf = np.zeros((2, N), np.float32)
    beat = 60 / 64.0 / 2  # sekizlik
    for (a, b, notes, dens) in CHORDS:
        # piyano: bas + yumuşak arpej
        place(buf, piano_note(notes[0], 0.45, 3.5), a + 0.02, 1.0, -0.2)
        seq = notes[1:] + notes[1:-1][::-1]
        t = a + beat
        i = 0
        while t < b - 0.05:
            if rng.random() < dens:
                m = seq[i % len(seq)]
                v = 0.22 + 0.1 * rng.random()
                place(buf, piano_note(m, v, 2.2), t + rng.normal(0, 0.008), 1.0, 0.15 * math.sin(i))
            t += beat
            i += 1
        # yaylılar
        sa = 0.9 if a >= 7 else 0.4
        if 43.4 <= a < 52.6:
            sa = 1.5
        if 40.2 <= a < 43.4:
            sa = 0.5
        for j, m in enumerate(notes[1:]):
            place(buf, strings_note(m - 12 if j == 0 else m, a, b, sa), a, 1.0, (-0.4, 0.0, 0.4, 0.2)[j % 4])
        place(buf, strings_note(notes[0], a, b, sa * 0.8), a, 1.0, 0.0)
    for (t, m, v) in MELODY:
        place(buf, piano_note(m, v * 1.1, 3.0), t, 1.0, 0.1)
    return buf


def reverb(buf, secs=3.2, wet=0.32):
    n = int(secs * SR)
    t = np.arange(n) / SR
    out = np.zeros_like(buf)
    for ch in range(2):
        ir = np.random.default_rng(100 + ch).normal(0, 1, n).astype(np.float32) * np.exp(-t * 6.9 / secs)
        ir = lp(ir, 5000)
        ir[:int(0.012 * SR)] = 0
        ir /= np.sqrt((ir ** 2).sum())
        out[ch] = signal.fftconvolve(buf[ch], ir)[:N] * 1.0
    return buf * (1 - wet) + out * wet


# =============================================================== ambiyans
def wind():
    w = np.cumsum(rng.normal(0, 1, N)).astype(np.float32)
    w = hp(w, 40)
    w = bp(w, 180, 900)
    w /= np.abs(w).max()
    t = np.arange(N) / SR
    gust = 0.55 + 0.3 * np.sin(2 * math.pi * 0.11 * t) + 0.25 * np.sin(2 * math.pi * 0.23 * t + 1.3)
    whistle = bp(rng.normal(0, 1, N).astype(np.float32), 600, 1100, 2)
    whistle *= (0.5 + 0.5 * np.sin(2 * math.pi * 0.07 * t)) ** 3
    level = env_curve([(0, 0), (2, 0.55), (35, 0.5), (36.2, 0.15), (43.3, 0.18), (44.3, 0.0), (52.6, 0.0),
                       (55, 0.85), (62, 0.8), (73, 0.6), (75, 0.0), (90, 0)])
    x = (w * gust + whistle * 0.12) * level
    buf = np.zeros((2, N), np.float32)
    buf[0] = x
    buf[1] = np.roll(x, 900)
    return buf * 0.22


def city_hum():
    x = lp(rng.normal(0, 1, N).astype(np.float32), 140, 3)
    x /= np.abs(x).max()
    level = env_curve([(0, 0), (2, 0.3), (35, 0.3), (36, 0.1), (44, 0.0), (53, 0.0), (55, 0.3), (73, 0.25),
                       (75, 0), (90, 0)])
    return np.stack([x, x]) * level * 0.10


def footstep():
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    x = rng.normal(0, 1, n).astype(np.float32) * np.exp(-t / 0.018)
    x = bp(x, 350, 3200)
    thump = np.sin(2 * math.pi * (85 + 20 * rng.random()) * t) * np.exp(-t / 0.03)
    return (x * 0.7 + thump * 0.5).astype(np.float32) * (0.8 + 0.4 * rng.random())


def footsteps():
    buf = np.zeros((2, N), np.float32)
    for i, t in enumerate(S.footstep_times()):
        if t >= S.T_REV:
            break
        cx, cy, z = S.street_cam(t)
        g = 0.22 + 0.10 * min(z, 3.5)
        if t > S.T_REV - 1.2:
            g *= 0.5
        place(buf, footstep(), t, g * 0.5, 0.15 if i % 2 else -0.15)
    for i, (t, gz) in enumerate(S.persp_steps()):
        g = 0.55 / (1 + (gz - 3) * 0.28)
        g *= 1 - np.clip((t - (S.T_FADE - 3)) / 3, 0, 1)
        place(buf, lp(footstep(), 2500), t, g * 0.5, 0.08 if i % 2 else -0.08)
    # sahne geçişinde kalkıp yürümeye başlaması (dönüş sahnesi sonu)
    return buf


def babble(seconds, seed, f0s=(115, 205, 260), cutoff=700):
    r = np.random.default_rng(seed)
    n = int(seconds * SR)
    t = np.arange(n) / SR
    out = np.zeros(n, np.float32)
    for vi, f0 in enumerate(f0s):
        # konuşma sırası: sesler sırayla konuşur
        turn = (np.sin(2 * math.pi * 0.09 * t + vi * 2.1) > 0.2).astype(np.float32)
        turn = lp(turn, 3)
        pitch = f0 * (1 + 0.08 * np.sin(2 * math.pi * 0.7 * t + vi) + 0.04 * np.sin(2 * math.pi * 2.3 * t))
        ph = 2 * math.pi * np.cumsum(pitch) / SR
        src = np.zeros(n, np.float32)
        for k in range(1, 18):
            src += (np.sin(k * ph) / k).astype(np.float32)
        syl = np.clip(np.sin(2 * math.pi * (3.6 + vi * 0.5) * t + r.random() * 6) + 0.2 * r.normal(0, 1), 0, 1)
        syl = lp(syl.astype(np.float32), 12)
        v = bp(src, 300, 900) * 0.6 + bp(src, 1000, 2400) * 0.3
        out += v * syl * turn
    out = lp(out, cutoff, 3)
    out /= np.abs(out).max() + 1e-6
    return out


def clink():
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    f = 2400 + 1600 * rng.random()
    x = (np.sin(2 * math.pi * f * t) + 0.5 * np.sin(2 * math.pi * f * 1.51 * t)) * np.exp(-t / 0.08)
    return x.astype(np.float32)


def households():
    buf = np.zeros((2, N), np.float32)
    # dışarıdan: pencerelere yaklaştıkça duyulan boğuk sesler
    b = babble(DUR, 3, cutoff=650)
    lvl = env_curve([(0, 0), (8, 0.05), (14, 0.15), (16.8, 0.5), (19.4, 0.35), (21.9, 0.5), (24.2, 0.35),
                     (26.4, 0.55), (29, 0.4), (32, 0.6), (35.2, 0.6), (36.2, 0.0), (90, 0)])
    buf += np.stack([b, b]) * lvl * 0.16
    # içeriden (ters açı): daha net, sıcak sofra sesleri
    bi = babble(DUR, 5, f0s=(120, 210, 290), cutoff=1600)
    lvl2 = env_curve([(0, 0), (35.2, 0), (36.2, 0.55), (39.8, 0.5), (40.3, 0.12), (43.4, 0.15), (44.2, 0),
                      (90, 0)])
    buf += np.stack([bi, np.roll(bi, 400)]) * lvl2 * 0.14
    for t in np.sort(rng.uniform(14, 43, 26)):
        if 40.0 < t < 43.6:
            continue
        inside = S.T_REV + 0.8 < t < S.T_DREAM
        c = clink() if inside else lp(clink(), 900)
        place(buf, c, t, 0.06 if inside else 0.05, rng.uniform(-0.5, 0.5))
    # hayalde sıcak oda: yumuşak kahkaha benzeri değil, sadece ışıltı zil sesleri
    for t in np.arange(44.2, 52.5, 0.37):
        if rng.random() < 0.55:
            n = int(1.5 * SR)
            tt = np.arange(n) / SR
            f = mtof(rng.choice([84, 88, 91, 93, 96]))
            x = (np.sin(2 * math.pi * f * tt) * np.exp(-tt / 0.5)).astype(np.float32)
            place(buf, x, t, 0.025, rng.uniform(-0.7, 0.7))
    return buf


def main():
    mus = reverb(music(), 3.4, 0.35)
    mus_level = env_curve([(0, 0.0), (0.5, 0.85), (40.0, 0.85), (40.4, 0.55), (43.4, 0.6), (44.0, 1.0),
                           (52.6, 1.0), (54.5, 0.8), (73, 0.85), (75, 0.9), (88.5, 0.9), (90, 0.0)])
    mus *= mus_level * 0.9
    amb = reverb(wind() + city_hum() + footsteps() + households(), 1.2, 0.18)
    mix = mus + amb
    mix = mix / np.abs(mix).max() * 0.95
    mix = np.tanh(mix * 1.15) / np.tanh(1.15)
    # son 1.5 sn kararma
    mix *= env_curve([(0, 1), (88.4, 1), (90, 0)])
    wavfile.write(os.path.join(OUT, 'ses.wav'), SR, (mix.T * 32000).astype(np.int16))
    print('ses hazır')


if __name__ == '__main__':
    main()
