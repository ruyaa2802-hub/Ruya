"""Procedural, royalty-free background music (numpy). Deterministic.

    .venv/bin/python -m ig.music assets/sfx      # writes music_*.wav

sneaky(): a tiptoeing pizzicato cue in D minor – the 2 a.m. fridge raid.
Plucks are Karplus-Strong strings; a soft woodblock keeps time.
"""
import os
import sys

import numpy as np
import soundfile as sf

from .sfx import SR, _band, _norm, _room

NOTE = {"C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, "F#": 6, "Gb": 6, "G": 7, "G#": 8,
        "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11}


def freq(name):
    """'A4' -> 440 Hz."""
    pitch, octave = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((NOTE[pitch] + 12 * (octave + 1) - 69) / 12)


def pluck(f, dur, decay=0.996, bright=0.5, seed=0):
    rng = np.random.default_rng(seed)
    n = int(SR * dur)
    p = max(2, int(round(SR / f)))
    buf = rng.uniform(-1, 1, p)
    buf = np.convolve(buf, np.ones(3) / 3, mode="same") * (1 - bright) + buf * bright
    out = np.empty(n)
    for i in range(n):
        out[i] = buf[i % p]
        buf[i % p] = decay * 0.5 * (buf[i % p] + buf[(i + 1) % p])
    out *= np.minimum(1, np.arange(n) / (0.002 * SR))
    return out


def woodblock(seed=0):
    t = np.arange(int(SR * 0.12)) / SR
    return np.sin(2 * np.pi * 1250 * t) * np.exp(-t * 60) + 0.4 * np.sin(2 * np.pi * 2400 * t) * np.exp(-t * 90)


MELODY = [  # one bar = 8 eighths; "-" rest
    "D4 - F4 - A4 G#4 A4 -", "D5 - C5 - A4 - F4 -", "E4 - G4 - Bb4 A4 Bb4 -", "C#5 - A4 - E4 - C#4 -",
    "D4 - F4 - A4 G#4 A4 -", "D5 - C5 - A4 - F4 -", "G4 - Bb4 - D5 C#5 D5 -", "A4 - - - A3 - - -",
]
BASS = ["D2 A2 D2 A2", "D2 A2 F2 A2", "G2 D2 G2 D2", "A2 E2 A2 C#2",
        "D2 A2 D2 A2", "D2 A2 F2 A2", "G2 D2 Bb2 G2", "A2 E2 A1 -"]


def _add(out, i, x):
    if 0 <= i < len(out):
        m = min(len(x), len(out) - i)
        out[i:i + m] += x[:m]


def sneaky(dur=26.0, bpm=112, seed=21):
    rng = np.random.default_rng(seed)
    beat = 60.0 / bpm
    n = int(SR * dur)
    out = np.zeros(n + SR)
    bar = 0
    t0 = 0.0
    while t0 < dur:
        mel = MELODY[bar % len(MELODY)].split()
        for k, name in enumerate(mel):
            if name != "-":
                i = int((t0 + k * beat / 2 + rng.uniform(0, 0.008)) * SR)
                _add(out, i, pluck(freq(name), 0.35, decay=0.993, bright=0.6, seed=bar * 16 + k) * 0.55)
        for k, name in enumerate(BASS[bar % len(BASS)].split()):
            if name != "-":
                i = int((t0 + k * beat) * SR)
                _add(out, i, pluck(freq(name), 0.5, decay=0.996, bright=0.3, seed=500 + bar * 4 + k) * 0.9)
        for k in (1, 3):                                    # woodblock on 2 and 4
            i = int((t0 + k * beat) * SR)
            _add(out, i, woodblock() * 0.18)
        t0 += 4 * beat
        bar += 1
    out = out[:n]
    out *= np.minimum(1, (dur - np.arange(n) / SR) / 1.0)     # 1 s fade at the end
    return _norm(_room(_band(out, 50, 9000), 0.5, 0.2, seed)[:n], -6)


def write_all(folder):
    os.makedirs(folder, exist_ok=True)
    sf.write(os.path.join(folder, "music_sneaky.wav"), sneaky().astype(np.float32), SR)


if __name__ == "__main__":
    write_all(sys.argv[1] if len(sys.argv) > 1 else "assets/sfx")
