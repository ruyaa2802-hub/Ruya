"""Procedural, royalty-free background music (numpy). Deterministic.

    .venv/bin/python -m ig.music assets/sfx      # writes music_*.wav

sneaky(): a tiptoeing pizzicato cue in D minor – the 2 a.m. fridge raid.
Plucks are Karplus-Strong strings; a soft woodblock keeps time.
"""
import math
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


PLAYFUL = [  # C major, bouncy
    "E5 - C5 - G4 - C5 -", "D5 - B4 - G4 - B4 -", "C5 E5 G5 - E5 - C5 -", "D5 - - G4 B4 - D5 -",
    "E5 - C5 - A4 - C5 -", "F5 - D5 - A4 - D5 -", "E5 D5 C5 - G4 - C5 -", "D5 - G4 - C5 - - -",
]
PLAYFUL_BASS = ["C3 G2 C3 G2", "G2 D3 G2 D3", "C3 G2 E3 G2", "G2 D3 B2 G2",
                "A2 E3 A2 E3", "D3 A2 F3 A2", "C3 G2 E3 G2", "G2 D3 C3 -"]


def playful(dur=20.0, bpm=126, seed=31):
    """Light comedy cue for gossip scenes: bouncy pizzicato in C major with a soft woodblock."""
    rng = np.random.default_rng(seed)
    beat = 60.0 / bpm
    n = int(SR * dur)
    out = np.zeros(n + SR)
    bar, t0 = 0, 0.0
    while t0 < dur:
        for k, name in enumerate(PLAYFUL[bar % len(PLAYFUL)].split()):
            if name != "-":
                i = int((t0 + k * beat / 2 + rng.uniform(0, 0.006)) * SR)
                _add(out, i, pluck(freq(name), 0.3, decay=0.992, bright=0.65, seed=bar * 16 + k) * 0.45)
        for k, name in enumerate(PLAYFUL_BASS[bar % len(PLAYFUL_BASS)].split()):
            if name != "-":
                _add(out, int((t0 + k * beat) * SR), pluck(freq(name), 0.45, decay=0.995, bright=0.3,
                                                           seed=700 + bar * 4 + k) * 0.8)
        for k in (1, 3):
            _add(out, int((t0 + k * beat) * SR), woodblock() * 0.14)
        t0 += 4 * beat
        bar += 1
    out = out[:n]
    out *= np.minimum(1, (dur - np.arange(n) / SR) / 0.8)
    return _norm(_room(_band(out, 50, 9000), 0.5, 0.2, seed)[:n], -6)


# an original carefree tune (G major); written for the series, not taken from any existing song
HUM_TUNE = [  # (note, beats)
    ("G4", 1), ("B4", 0.5), ("D5", 0.5), ("E5", 1.5), ("D5", 0.5),
    ("B4", 1), ("A4", 0.5), ("G4", 0.5), ("A4", 2),
    ("G4", 1), ("B4", 0.5), ("D5", 0.5), ("G5", 1), ("E5", 0.5), ("D5", 0.5),
    ("B4", 0.5), ("A4", 0.5), ("G4", 0.5), ("E4", 0.5), ("G4", 2),
    ("C5", 1), ("E5", 0.5), ("D5", 0.5), ("C5", 1), ("B4", 1),
    ("A4", 0.5), ("B4", 0.5), ("C5", 0.5), ("A4", 0.5), ("B4", 2),
    ("G4", 0.5), ("A4", 0.5), ("B4", 1), ("D5", 1), ("C5", 0.5), ("A4", 0.5),
    ("G4", 3), (None, 1),
]
HUM_CHORDS = ["G3 B3 D4", "D3 F#3 A3", "G3 B3 D4", "G3 B3 D4", "C3 E3 G3", "D3 F#3 A3", "G3 B3 D4", "G3 B3 D4"]


def _hum_voice(freqs, sr=SR):
    """Closed-mouth humming: a soft harmonic tone shaped by a nasal formant, with vibrato and breath."""
    ph = 2 * np.pi * np.cumsum(freqs) / sr
    x = np.zeros(len(freqs))
    for h in range(1, 14):
        f_h = freqs * h
        # nasal 'mmm': strong low resonance near 250 Hz, a weak one near 2.2 kHz, little else
        amp = 1.0 / h ** 1.2 * (np.exp(-((f_h - 260) / 180) ** 2) * 1.0 + np.exp(-((f_h - 2200) / 500) ** 2) * 0.08
                                + 0.25 * np.exp(-f_h / 900))
        x += amp * np.sin(h * ph)
    return x


def hum(dur=20.0, bpm=96, seed=41):
    """Background humming of an original carefree tune over soft plucked chords."""
    rng = np.random.default_rng(seed)
    beat = 60.0 / bpm
    n = int(SR * dur)
    t = np.arange(n) / SR
    # melody pitch curve with little glides between notes, looping the tune
    f = np.zeros(n)
    env = np.zeros(n)
    pos = 0.0
    k = 0
    prev = None
    while pos < dur:
        name, beats = HUM_TUNE[k % len(HUM_TUNE)]
        a, b = int(pos * SR), min(n, int((pos + beats * beat) * SR))
        if name and a < n:
            fr = freq(name)
            seg = np.full(b - a, fr)
            if prev:                                               # 60 ms portamento from the last note
                g = min(len(seg), int(0.06 * SR))
                seg[:g] = np.geomspace(prev, fr, g) if g > 1 else fr
            f[a:b] = seg
            e = np.ones(b - a)
            ra, rr = min(len(e), int(0.05 * SR)), min(len(e), int(0.08 * SR))
            e[:ra] *= np.linspace(0.3, 1, ra)
            e[-rr:] *= np.linspace(1, 0.55, rr)
            env[a:b] = e
            prev = fr
        elif name is None:
            prev = None
        pos += beats * beat
        k += 1
    f[f == 0] = 196.0
    vib = 1 + 0.012 * np.sin(2 * np.pi * 5.2 * t) * np.clip((t % 2.0) / 0.4, 0, 1)
    voice = _hum_voice(f * vib) * np.convolve(env, np.ones(480) / 480, mode="same")
    voice += _band(rng.standard_normal(n), 300, 3000) * 0.004 * env          # a little breath
    # soft plucked chords on beats 1 and 3, a lazy swing
    gtr = np.zeros(n + SR)
    bar, t0 = 0, 0.0
    while t0 < dur:
        notes = HUM_CHORDS[bar % len(HUM_CHORDS)].split()
        for b_off in (0.0, 2.0):
            for j, name in enumerate(notes):
                _add(gtr, int((t0 + b_off * beat + j * 0.025) * SR),
                     pluck(freq(name), 1.2, decay=0.997, bright=0.25, seed=900 + bar * 8 + j) * 0.35)
        t0 += 4 * beat
        bar += 1
    mix = _norm(voice, -6) * 1.0 + _norm(gtr[:n], -6) * 0.55
    mix *= np.minimum(1, t / 0.6) * np.minimum(1, (dur - t) / 1.0)
    return _norm(_room(_band(mix, 70, 8000), 0.6, 0.3, seed)[:n], -6)


def tension(dur=18.0, seed=51):
    """Creeping night tension in D minor: a low drone with a slow swell, a pulsing heartbeat bass,
    sparse high glassy notes and a rising tremolo string, getting tighter toward the end."""
    rng = np.random.default_rng(seed)
    n = int(SR * dur)
    t = np.arange(n) / SR
    grow = (t / dur) ** 1.3
    drone = sum(a * np.sin(2 * np.pi * f * t + rng.random() * 6) for f, a in ((73.4, 1.0), (110.0, 0.5),
                                                                            (146.8, 0.3), (155.6, 0.12 + 0.2 * grow)))
    drone *= 0.6 + 0.4 * np.sin(2 * np.pi * t / 5.7) ** 2
    pulse = np.zeros(n)
    beat = 60 / 84
    k = 0.0
    while k < dur:
        i = int(k * SR)
        tt = np.arange(int(0.3 * SR)) / SR
        hit = np.sin(2 * np.pi * 55 * tt) * np.exp(-tt * 14)
        pulse[i:i + len(tt)] += hit[: n - i]
        k += beat * (1.0 if k < dur * 0.6 else 0.5)                      # doubles up as it closes in
    glass = np.zeros(n + SR * 3)
    for k, name in enumerate(["A5", "F5", "E5", "D6", "C#6", "A5", "Bb5", "A5"]):
        _add(glass, int((1.0 + k * 2.1) * SR), np.sin(2 * np.pi * freq(name) * np.arange(int(2.5 * SR)) / SR)
             * np.exp(-np.arange(int(2.5 * SR)) / SR * 1.6) * 0.5)
    trem = np.sin(2 * np.pi * freq("D5") * (1 + 0.06 * grow) * t) * (0.5 + 0.5 * np.sin(2 * np.pi * 9 * t)) * grow
    mix = _norm(drone, -6) + _norm(pulse, -9) * 0.9 + _norm(glass[:n], -10) * 0.7 + _norm(trem, -12) * 0.8
    mix *= np.minimum(1, t / 1.5)
    return _norm(_room(_band(mix, 35, 9000), 1.2, 0.45, seed)[:n], -6)


def piano_note(f, dur, vel=0.6, sr=SR, seed=0):
    """An acoustic-ish piano note: two slightly detuned strings per partial with stretched
    (inharmonic) overtones, a fast-then-slow decay, a felt hammer thump and a damper release."""
    rng = np.random.default_rng(seed)
    ring = dur + 1.8
    n = int(ring * sr)
    t = np.arange(n) / sr
    B = 0.00025 * (f / 261.6) ** 0.5
    base = 9.0 * (110.0 / f) ** 0.55 + 1.2                    # low notes ring longer
    x = np.zeros(n)
    for k in range(1, 16):
        fk = f * k * math.sqrt(1 + B * k * k)
        if fk > 9000:
            break
        amp = (1.0 / k ** 1.05) * math.exp(-(k - 1) * (0.42 - 0.3 * vel))
        tau = base / (1 + 0.22 * k)
        env = 0.65 * np.exp(-t / (tau * 0.18)) + 0.35 * np.exp(-t / tau)
        for det in (-0.6, 0.6):                                # two strings, a few cents apart
            fd = fk * 2 ** (det / 1200)
            x += 0.5 * amp * env * np.sin(2 * np.pi * fd * t + rng.random() * 6.28)
    att = np.minimum(1, t / 0.004)
    hammer = _band(rng.standard_normal(n), 200, 2500) * np.exp(-t * 90) * 0.04 * vel
    damp = np.ones(n)
    off = int(dur * sr)
    if off < n:
        damp[off:] = np.exp(-(t[off:] - dur) / 0.18)
    return (x * att * vel + hammer) * damp


def piano(events, total, seed=61, room=0.55):
    """events: (time, note name, duration, velocity). Returns a mono mix with a warm hall reverb."""
    n = int(total * SR)
    out = np.zeros(n + 4 * SR)
    for i, (t0, name, dur, vel) in enumerate(events):
        _add(out, int(t0 * SR), piano_note(freq(name), dur, vel, seed=seed + i))
    out = _band(out[: n + 2 * SR], 40, 9000)
    wet = _room(out, 2.2, room, seed)
    return wet[:n]


def write_all(folder):
    os.makedirs(folder, exist_ok=True)
    sf.write(os.path.join(folder, "music_sneaky.wav"), sneaky().astype(np.float32), SR)
    sf.write(os.path.join(folder, "music_playful.wav"), playful().astype(np.float32), SR)
    sf.write(os.path.join(folder, "music_hum.wav"), hum().astype(np.float32), SR)
    sf.write(os.path.join(folder, "music_tension.wav"), tension().astype(np.float32), SR)


if __name__ == "__main__":
    write_all(sys.argv[1] if len(sys.argv) > 1 else "assets/sfx")
