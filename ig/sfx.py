"""Procedural, royalty-free sound effects (numpy). Deterministic per seed.

    .venv/bin/python -m ig.sfx assets/sfx      # writes every effect as 48 kHz wav
"""
import os
import sys

import numpy as np
import soundfile as sf
from scipy.signal import butter, fftconvolve, sosfilt

SR = 48000


def _t(dur):
    return np.arange(int(SR * dur)) / SR


def _band(x, lo=None, hi=None, order=4):
    if lo and hi:
        sos = butter(order, [lo, hi], "bandpass", fs=SR, output="sos")
    elif lo:
        sos = butter(order, lo, "highpass", fs=SR, output="sos")
    else:
        sos = butter(order, hi, "lowpass", fs=SR, output="sos")
    return sosfilt(sos, x)


def _room(x, size=0.35, mix=0.25, seed=0):
    """Small-room reverb by convolving with decaying filtered noise."""
    rng = np.random.default_rng(seed + 99)
    n = int(SR * size * 2.5)
    ir = rng.standard_normal(n) * np.exp(-np.arange(n) / (SR * size / 6.9))
    ir = _band(ir, 200, 6000, 2)
    ir /= np.abs(ir).sum() ** 0.5 * 30
    wet = fftconvolve(x, ir)[: len(x) + n]
    out = np.zeros(len(wet))
    out[: len(x)] += x * (1 - mix)
    out += wet * mix / (np.abs(wet).max() + 1e-9) * np.abs(x).max()
    return out


def _norm(x, peak_db=-3.0):
    return x / (np.abs(x).max() + 1e-9) * 10 ** (peak_db / 20)


def door_slam(seed=1):
    rng = np.random.default_rng(seed)
    t = _t(0.9)
    thud = np.sin(2 * np.pi * (70 + 30 * np.exp(-t * 30)) * t) * np.exp(-t * 14)
    knock = _band(rng.standard_normal(len(t)), 120, 1800) * np.exp(-t * 40)
    rattle = _band(rng.standard_normal(len(t)), 1500, 5000) * np.exp(-((t - 0.03) ** 2) / 0.0008) * 0.25
    x = thud * 1.0 + knock * 0.7 + rattle
    x = _band(x, hi=3500)          # it happens in the hallway, slightly muffled
    return _norm(_room(x, 0.6, 0.45, seed), -2)


def keys(seed=2, dur=0.6):
    rng = np.random.default_rng(seed)
    t = _t(dur)
    x = np.zeros(len(t))
    for _ in range(rng.integers(7, 11)):
        start = rng.uniform(0, dur * 0.65)
        i0 = int(start * SR)
        tt = t[: len(t) - i0]
        clink = sum(np.sin(2 * np.pi * f * tt + rng.uniform(0, 6)) * np.exp(-tt * rng.uniform(25, 60))
                    for f in rng.uniform(2200, 7800, 4))
        x[i0:] += clink * rng.uniform(0.3, 1.0)
    x = _band(x, 1000, 9000)
    return _norm(_room(x, 0.4, 0.35, seed), -9)


def rustle(seed=3, dur=0.7, bright=1.0):
    rng = np.random.default_rng(seed)
    t = _t(dur)
    n = rng.standard_normal(len(t))
    grains = np.zeros(len(t))
    for _ in range(int(40 * dur)):
        c = rng.uniform(0, dur)
        grains += np.exp(-((t - c) ** 2) / (2 * rng.uniform(0.004, 0.02) ** 2)) * rng.uniform(0.2, 1)
    shape = np.sin(np.pi * t / dur) ** 0.7
    x = _band(n, 700 * bright, 6000 * bright) * (0.3 + grains) * shape
    return _norm(x, -12)


def poof(seed=4):
    """Soft fabric thump (pillow flop, blanket landing)."""
    rng = np.random.default_rng(seed)
    t = _t(0.45)
    body = np.sin(2 * np.pi * (110 + 60 * np.exp(-t * 25)) * t) * np.exp(-t * 18)
    air = _band(rng.standard_normal(len(t)), 300, 2500) * np.exp(-t * 22) * 0.6
    return _norm(body + air, -6)


def whoosh(seed=5, dur=0.45):
    rng = np.random.default_rng(seed)
    t = _t(dur)
    n = rng.standard_normal(len(t))
    out = np.zeros(len(t))
    steps = 24
    for i in range(steps):
        a, b = int(i * len(t) / steps), int((i + 1) * len(t) / steps)
        f = 400 + 2600 * np.sin(np.pi * i / steps)
        out[a:b] = _band(n, f * 0.7, f * 1.3, 2)[a:b]
    return _norm(out * np.sin(np.pi * t / dur) ** 1.5, -10)


def sniff(seed=6):
    rng = np.random.default_rng(seed)
    t = _t(0.35)
    env = np.exp(-((t - 0.08) ** 2) / 0.0012) + 0.7 * np.exp(-((t - 0.22) ** 2) / 0.0012)
    return _norm(_band(rng.standard_normal(len(t)), 1500, 7000) * env, -14)


def _ceramic_hit(tt, rng, bright=1.0):
    """One small ceramic tap: a few inharmonic modes with fast decay plus a wooden knock."""
    modes = sum(np.sin(2 * np.pi * f * bright * tt + rng.uniform(0, 6)) * np.exp(-tt * d) * a
                for f, d, a in ((2650, 55, 1.0), (4120, 70, 0.6), (6390, 90, 0.35), (1180, 40, 0.3)))
    knock = np.sin(2 * np.pi * 420 * tt) * np.exp(-tt * 120) * 0.6
    return modes + knock


def chatter(seed=9, dur=1.2):
    """A cold mug's teeth chattering: fast irregular ceramic rattles on the nightstand."""
    rng = np.random.default_rng(seed)
    t = _t(dur)
    x = np.zeros(len(t))
    c = 0.0
    while c < dur - 0.03:
        i0 = int(c * SR)
        tt = t[: len(t) - i0]
        x[i0:] += _ceramic_hit(tt, rng, rng.uniform(0.92, 1.08)) * rng.uniform(0.4, 1.0)
        c += rng.uniform(0.045, 0.075)
    x *= np.minimum(1.0, (dur - t) / 0.25)                  # dies away
    return _norm(_room(_band(x, 300, 9000), 0.3, 0.25, seed), -12)


def clink(seed=10):
    """Mug landing on the nightstand."""
    rng = np.random.default_rng(seed)
    t = _t(0.5)
    x = _ceramic_hit(t, rng, 0.95)
    x[int(0.06 * SR):] += _ceramic_hit(t[: len(t) - int(0.06 * SR)], rng, 1.0) * 0.25   # little bounce
    return _norm(_room(x, 0.3, 0.2, seed), -8)


def ding(seed=11):
    """Microwave bell from the kitchen: bright, inharmonic, a bit far away."""
    rng = np.random.default_rng(seed)
    t = _t(1.6)
    x = sum(np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) * np.exp(-t * d) * a
            for f, d, a in ((2380, 2.6, 1.0), (2392, 2.6, 0.7), (5210, 4.5, 0.35), (6870, 6.0, 0.18)))
    x *= 1 - np.exp(-t * 900)
    x = _band(x, 400, 7000)
    return _norm(_room(x, 0.9, 0.55, seed), -10)


def jitter(seed=12, dur=3.0):
    """Over-caffeinated plant: leaves rattling at a manic, buzzing rate."""
    rng = np.random.default_rng(seed)
    t = _t(dur)
    leaves = _band(rng.standard_normal(len(t)), 1200, 7000)
    trem = 0.55 + 0.45 * np.sign(np.sin(2 * np.pi * 17 * t + 0.4 * np.sin(2 * np.pi * 2.3 * t)))
    trem = np.convolve(trem, np.ones(96) / 96, mode="same")
    shape = np.minimum(1.0, t / 0.08) * np.minimum(1.0, (dur - t) / 0.3)
    return _norm(leaves * trem * shape, -16)


def room_tone(dur, seed=7):
    rng = np.random.default_rng(seed)
    x = np.cumsum(rng.standard_normal(int(SR * dur)))
    x = _band(x - x.mean(), 40, 900, 2)
    return _norm(x, -48)


EFFECTS = {"door_slam": door_slam, "keys": keys, "rustle": rustle, "rustle_long": lambda: rustle(8, 1.4),
           "poof": poof, "whoosh": whoosh, "sniff": sniff, "chatter": chatter, "clink": clink, "ding": ding,
           "jitter": jitter}


def write_all(folder):
    os.makedirs(folder, exist_ok=True)
    for name, fn in EFFECTS.items():
        sf.write(os.path.join(folder, f"{name}.wav"), fn().astype(np.float32), SR)
    sf.write(os.path.join(folder, "room_tone.wav"), room_tone(60).astype(np.float32), SR)


if __name__ == "__main__":
    write_all(sys.argv[1] if len(sys.argv) > 1 else "assets/sfx")
