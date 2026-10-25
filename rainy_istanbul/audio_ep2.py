"""Episode 2 sound: tension music, bus engine/brakes/doors, running steps, panting,
interior hum, awkward-silence crickets, the line, comic sting. Procedural (numpy),
same approach as episode 1's audio.py; the dialogue WAV is mixed in from a file.

    python3 audio_ep2.py TRACK.json LINE.wav OUT.wav
"""
import json
import sys
import wave

import numpy as np

SR = 48000
track = json.load(open(sys.argv[1]))
LINE, OUT = sys.argv[2], sys.argv[3]
FR = track["frames"]
DUR = FR / 30.0
N = int(SR * DUR)
t = np.arange(N) / SR
rng = np.random.default_rng(11)


def fft_filter(x, lo, hi, tilt=0.0):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    g = np.ones_like(f)
    if lo:
        g *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1)) ** 4)
    if hi:
        g *= 1 / np.sqrt(1 + (f / hi) ** 4)
    if tilt:
        g *= (np.maximum(f, 20) / 1000.0) ** tilt
    return np.fft.irfft(X * g, len(x))


def stereo(m, pan=0.0):
    pan = np.clip(pan, -1, 1)
    return np.stack([m * np.cos((pan + 1) * np.pi / 4), m * np.sin((pan + 1) * np.pi / 4)], axis=1)


def env(t0, a, hold, r):
    e = np.zeros(N)
    e += np.clip((t - t0) / max(a, 1e-3), 0, 1)
    e *= np.clip(1 - (t - (t0 + a + hold)) / max(r, 1e-3), 0, 1)
    return e


def place(sig, t0, pan=0.0, gain=1.0):
    i0 = int(t0 * SR)
    if i0 >= N:
        return
    m = min(len(sig), N - i0)
    mix[i0:i0 + m] += stereo(sig[:m] * gain, pan)


def saw(f, tt):
    return 2 * ((f * tt) % 1.0) - 1


mix = np.zeros((N, 2))
inside = np.repeat(np.array(track["interior"], float), SR // 30)[:N]
inside = np.pad(inside, (0, N - len(inside)), mode="edge")
inside = np.convolve(inside, np.ones(2400) / 2400, mode="same")       # 50 ms crossfade at cuts

# ---------------------------------------------------------------- rain (muffled inside the bus)
rain = np.zeros((N, 2))
for ch in range(2):
    b = fft_filter(rng.normal(0, 1, N), 350, 9000, tilt=-0.35)
    rain[:, ch] = b * 0.10 / np.std(b)
ticks = np.zeros(N)
idx = rng.integers(0, N, 11000)
ticks[idx] = rng.uniform(-1, 1, len(idx)) * rng.uniform(0.2, 1, len(idx)) ** 2
ticks = fft_filter(ticks, 2500, 12000)
rain += stereo(ticks * 0.05 / np.std(ticks))
rain_in = np.stack([fft_filter(rain[:, c], 0, 900) for c in range(2)], axis=1) * 0.6
mix += rain * (1 - inside)[:, None] + rain_in * inside[:, None]

# ---------------------------------------------------------------- bus engine
bus = np.array(track["bus"])
cam = np.array([c[:3] for c in track["cam"]])
fi = np.minimum((t * 30).astype(int), FR - 1)
d_bus = np.linalg.norm(bus[fi] + np.array([0, -9.0, 1.0]) - cam[fi], axis=1)     # engine at the rear
vbus = np.gradient(bus[:, 1]) * 30
rpm = 0.35 + np.interp(t, np.arange(FR) / 30, np.clip(vbus / 2.7, 0, 1)) * 0.65
rpm = np.convolve(rpm, np.ones(4800) / 4800, mode="same")
phase = np.cumsum(38 * (0.6 + rpm)) / SR
engine = 0.6 * np.sin(2 * np.pi * phase) + 0.3 * np.sin(4 * np.pi * phase + 0.4) + 0.2 * saw(1.0, 3 * phase)
engine += fft_filter(rng.normal(0, 1, N), 60, 500) * 0.25
engine *= 1 + 0.25 * np.sin(2 * np.pi * phase / 4)
engine = fft_filter(engine, 30, 900)
engine *= np.clip(3.0 / np.maximum(d_bus, 2.0), 0, 1) * (0.5 + 0.5 * rpm) * 0.35
mix += stereo(engine * (1 - 0.3 * inside), 0.0)
# air brake + door hisses
hiss = fft_filter(rng.normal(0, 1, int(0.9 * SR)), 2000, 9000) * np.exp(-np.arange(int(0.9 * SR)) / SR * 4)
place(hiss * 0.18, track["bus_stop"] - 0.05, pan=-0.3)
door = fft_filter(rng.normal(0, 1, int(0.6 * SR)), 1200, 7000) * np.exp(-np.arange(int(0.6 * SR)) / SR * 6)
place(door * 0.16, track["bus_stop"] + 0.1, pan=0.2)
clunk = np.sin(2 * np.pi * 70 * np.arange(int(0.2 * SR)) / SR) * np.exp(-np.arange(int(0.2 * SR)) / SR * 30)
place(clunk * 0.4, track["bus_stop"] + 0.62, pan=0.2)

# ---------------------------------------------------------------- music: action-thriller tension, cut at the sign reveal
T_HIT, T_OST, T_WIN = 0.9, 1.5, track["t_arrive"]
shots = track["shots"]
T_SIGN = [s for s, n in shots if n == "sign"][0]
music = np.zeros(N)
bpm = 150.0
six = 60.0 / bpm / 4
notes = [38, 38, 38, 41, 38, 38, 40, 36] * 4                 # midi, D2 ostinato
k = 0
tt0 = T_OST
while tt0 < T_SIGN:
    f = 440 * 2 ** ((notes[k % len(notes)] - 69) / 12)
    n = int(six * SR * 0.9)
    tn = np.arange(n) / SR
    s = (saw(f, tn) + 0.5 * saw(f * 2.005, tn)) * np.exp(-tn * 18)
    i0 = int(tt0 * SR)
    m = min(n, N - i0)
    music[i0:i0 + m] += s[:m] * (0.8 if k % 4 == 0 else 0.55)
    k += 1
    tt0 += six
music = fft_filter(music, 50, 2600)
# low drone + rising strings-ish pad
drone = (saw(36.7, t) + saw(36.9, t) + 0.5 * saw(73.4, t)) * env(0.4, 1.0, T_SIGN - 1.4, 0.05)
drone = fft_filter(drone, 30, 400) * 0.35
rise = sum(saw(f * (1 + 0.06 * np.clip((t - 2) / 5, 0, 1)), t) for f in (293.7, 349.2, 440.0))
rise = fft_filter(rise, 200, 3000) * env(2.0, 4.5, 0.1, 0.4) * 0.06
# impact on the crash zoom + taiko on the beats
hit_n = int(1.6 * SR)
th = np.arange(hit_n) / SR
hit = (saw(55, th) + saw(82.4, th) + saw(110.5, th)) * np.exp(-th * 2.5)
hit = fft_filter(hit, 40, 1200) * 0.5 + np.sin(2 * np.pi * (50 * th - 30 * th ** 2)) * np.exp(-th * 5) * 0.8
taiko = np.zeros(N)
beat = 60.0 / bpm
tb = T_OST
while tb < T_SIGN:
    n = int(0.5 * SR)
    tn = np.arange(n) / SR
    s = np.sin(2 * np.pi * (70 * tn - 40 * tn ** 2)) * np.exp(-tn * 9) + fft_filter(rng.normal(0, 1, n), 100, 1500) * np.exp(-tn * 30) * 0.3
    i0 = int(tb * SR)
    m = min(n, N - i0)
    taiko[i0:i0 + m] += s[:m] * 0.5
    tb += beat * 2
# victory swell when he makes it
win = sum(saw(f, t) for f in (146.8, 185.0, 220.0, 293.7)) * env(T_WIN, 0.4, 0.8, T_SIGN - T_WIN - 1.2)
win = fft_filter(win, 80, 2500) * 0.08
music_all = music * 0.22 + drone + rise + taiko + win
music_all[: int(T_OST * SR)] *= np.clip(t[: int(T_OST * SR)] / 0.6, 0, 1)
mix += stereo(music_all, 0.0)
place(hit, T_HIT, gain=0.45)
# tape stop at the sign reveal: last 0.45 s of the music slows down and drops in pitch
ts0 = int((T_SIGN - 0.05) * SR)
n_ts = int(0.45 * SR)
src = music_all[ts0 - n_ts: ts0].copy()
pos = np.cumsum(np.linspace(1.0, 0.0, n_ts))
pos = np.clip(pos / pos[-1] * (n_ts - 1) * 0.55, 0, n_ts - 1)
tape = np.interp(pos, np.arange(n_ts), src) * np.linspace(1, 0, n_ts)
mix[ts0 - n_ts: ts0] -= stereo(music_all[ts0 - n_ts: ts0])          # replace with the slowed version
place(tape, (ts0 - n_ts) / SR)
mix[ts0:, :] -= stereo(music_all[ts0:])                                 # silence after

# ---------------------------------------------------------------- footsteps (synced to the animation)
man = np.array(track["man"])
for foot, steps in track["steps"].items():
    for (t_lift, t_land, a, b, yaw, kind) in steps:
        if t_land >= DUR:
            continue
        f = min(FR - 1, int(t_land * 30))
        dist = np.linalg.norm(man[f] - cam[f])
        gain = min(1.0, 3.0 / max(dist, 1.0)) * (1.0 if kind == "run" else 0.6)
        n = int(0.3 * SR)
        tn = np.arange(n) / SR
        s = np.sin(2 * np.pi * 85 * tn) * np.exp(-tn * 40) * 0.6
        s += fft_filter(rng.normal(0, 1, n), 1500, 6000) * np.exp(-tn * 120) * 0.35
        s += fft_filter(rng.normal(0, 1, n), 800, 7000) * np.exp(-tn * (18 if kind == "run" else 28)) * (tn < 0.25) * 0.35
        place(s * gain * 0.55, t_land - 0.005, pan=0.15 if foot == "r" else -0.15)

# ---------------------------------------------------------------- panting after the sprint
tp = T_WIN + 0.1
while tp < 11.0:
    amp = 0.12 * (1 - (tp - T_WIN) / 5.0)
    for inhale, dur in ((True, 0.22), (False, 0.28)):
        n = int(dur * SR)
        tn = np.arange(n) / SR
        b = fft_filter(rng.normal(0, 1, n), 500 if inhale else 350, 2600 if inhale else 1800)
        b *= np.sin(np.pi * tn / dur) ** 1.5
        place(b / (np.std(b) + 1e-9) * amp * (0.6 if inhale else 1.0), tp)
        tp += dur
    tp += 0.03

# ---------------------------------------------------------------- inside: fluorescent hum, awkward crickets
hum = (np.sin(2 * np.pi * 100 * t) * 0.5 + np.sin(2 * np.pi * 200 * t) * 0.2) * 0.02 + fft_filter(rng.normal(0, 1, N), 80, 300) * 0.01
mix += stereo(hum * inside)
for c0 in (10.35, 10.75):
    for k in range(3):
        n = int(0.05 * SR)
        tn = np.arange(n) / SR
        s = np.sin(2 * np.pi * 4300 * tn) * np.sin(np.pi * tn / 0.05) * (0.5 + 0.5 * np.sin(2 * np.pi * 60 * tn))
        place(s * 0.035, c0 + k * 0.075, pan=0.4)

# ---------------------------------------------------------------- the line
lw = wave.open(LINE)
lsr = lw.getframerate()
lp = np.frombuffer(lw.readframes(lw.getnframes()), np.int16).astype(np.float32) / 32768
if lw.getnchannels() == 2:
    lp = lp.reshape(-1, 2).mean(axis=1)
lp = np.interp(np.arange(int(len(lp) * SR / lsr)) * lsr / SR, np.arange(len(lp)), lp)
nz = np.nonzero(np.abs(lp) > 0.05 * np.abs(lp).max())[0]
lp = lp[max(0, nz[0] - 1200): nz[-1] + 4800]                  # trim leading/trailing silence
lp = lp / np.abs(lp).max() * 0.55
place(lp, track["t_line"])
# small room reflection on the voice only (inside a bus)
refl = np.zeros(int(0.03 * SR) + len(lp))
refl[int(0.03 * SR):] = lp * 0.18
place(fft_filter(refl, 200, 4000), track["t_line"])

# ---------------------------------------------------------------- comic sting: "womp womp"
T_STING = track["t_line"] + len(lp) / SR + 0.3
for i, (f, d) in enumerate(((233.1, 0.26), (207.7, 0.34))):
    n = int(d * SR)
    tn = np.arange(n) / SR
    vib = 1 + 0.012 * np.sin(2 * np.pi * 6 * tn) * (tn > 0.15)
    ph = np.cumsum(f * vib * (1 - 0.04 * tn / d)) / SR
    s = saw(1.0, ph) * np.minimum(1, tn / 0.03) * np.minimum(1, (d - tn) / 0.08)
    s = fft_filter(s, 120, 1400) * 0.22
    place(s, T_STING + (0.0 if i == 0 else 0.3))

# ---------------------------------------------------------------- master
fade = np.ones(N)
fade[: int(0.15 * SR)] = np.linspace(0, 1, int(0.15 * SR))
fade[-int(0.12 * SR):] = np.linspace(1, 0, int(0.12 * SR))
mix *= fade[:, None]
mix *= (10 ** (-1 / 20)) / np.max(np.abs(mix))
with wave.open(OUT, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype(np.int16).tobytes())
print("wrote", OUT, "sting at %.2f s, line ends %.2f s" % (T_STING, track["t_line"] + len(lp) / SR))
