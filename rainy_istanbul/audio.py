"""Procedural sound design (no samples): rain, wet footsteps synced to the
animation's heel strikes, gutter drips, distant city rumble and a ferry horn.

    python3 audio.py TRACK.json OUT.wav
"""
import json
import sys
import wave

import numpy as np

SR = 48000
DUR = 10.0
N = int(SR * DUR)
rng = np.random.default_rng(7)
track = json.load(open(sys.argv[1]))
OUT = sys.argv[2]


def lowpass(x, fc):
    a = np.exp(-2 * np.pi * fc / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):     # small signals only
        acc = (1 - a) * x[i] + a * acc
        y[i] = acc
    return y


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


def stereo(mono, pan):
    pan = np.clip(pan, -1, 1)
    l = mono * np.cos((pan + 1) * np.pi / 4)
    r = mono * np.sin((pan + 1) * np.pi / 4)
    return np.stack([l, r], axis=1)


mix = np.zeros((N, 2))

# --- rain bed: two decorrelated filtered noises + dense droplet ticks
for ch in range(2):
    bed = fft_filter(rng.normal(0, 1, N), 350, 9000, tilt=-0.35)
    bed *= 0.11 / np.std(bed)
    slow = fft_filter(rng.normal(0, 1, N), 0, 0.6)
    bed *= 1 + 0.25 * slow / np.std(slow)
    mix[:, ch] += bed
ticks = np.zeros(N)
idx = rng.integers(0, N, 9000)
ticks[idx] = rng.uniform(-1, 1, len(idx)) * rng.uniform(0.2, 1, len(idx)) ** 2
ticks = fft_filter(ticks, 2500, 12000)
ticks *= 0.05 / (np.std(ticks) + 1e-9)
mix += stereo(ticks, 0.1)
ticks2 = np.zeros(N)
idx = rng.integers(0, N, 9000)
ticks2[idx] = rng.uniform(-1, 1, len(idx)) * rng.uniform(0.2, 1, len(idx)) ** 2
ticks2 = fft_filter(ticks2, 2500, 12000)
ticks2 *= 0.05 / (np.std(ticks2) + 1e-9)
mix += stereo(ticks2, -0.2)
# rain on an awning (heavier, lower drops) on the right side
awn = np.zeros(N)
idx = rng.integers(0, N, 2500)
awn[idx] = rng.uniform(0.3, 1, len(idx))
awn = fft_filter(awn, 300, 2500)
awn *= 0.035 / (np.std(awn) + 1e-9)
mix += stereo(awn, 0.6)

# --- city ambience: low rumble, a passing car far away, a ferry horn
rum = fft_filter(rng.normal(0, 1, N), 25, 180)
rum *= 0.06 / np.std(rum)
mix += stereo(rum, 0.0)
t = np.arange(N) / SR
car_env = np.exp(-((t - 2.0) / 1.6) ** 2)
car = fft_filter(rng.normal(0, 1, N), 80, 1200) * car_env
car *= 0.05 / (np.std(car) + 1e-9)
mix += stereo(car, -0.5)
horn_env = np.clip((t - 5.6) / 0.4, 0, 1) * np.clip((8.4 - t) / 1.2, 0, 1)
horn = sum(a * np.sin(2 * np.pi * f * t + p) for f, a, p in [(98, 1.0, 0), (196, 0.5, 1), (294, 0.25, 2), (392, 0.12, 0.5)])
horn = fft_filter(horn * horn_env, 60, 600) * 0.03
mix += stereo(horn, 0.25)

# --- gutter drips (random plinks)
for _ in range(22):
    t0 = rng.uniform(0, DUR - 0.3)
    f0 = rng.uniform(900, 2200)
    n = int(0.12 * SR)
    tt = np.arange(n) / SR
    s = np.sin(2 * np.pi * (f0 + 900 * np.exp(-tt * 40)) * tt) * np.exp(-tt * 38) * rng.uniform(0.02, 0.06)
    i0 = int(t0 * SR)
    mix[i0:i0 + n] += stereo(s, rng.uniform(-0.8, 0.8))[: N - i0]

# --- footsteps: heel strike + wet splash + toe roll, synced to the animation
man = np.array(track["man"])
cam = track["cam"]
landings = []
for foot, steps in track["steps"].items():
    for (t_lift, t_land, a, b) in steps:
        landings.append((t_land, foot, abs(b - a)))
landings.sort()
for t_land, foot, span in landings:
    f = min(len(man) - 1, int(t_land * 30))
    mp = man[f]
    cp = np.array(cam[f][:3])
    cam_right = np.array(cam[f][3])
    d = np.linalg.norm(mp - cp)
    rel = mp - cp
    pan = float(np.clip(np.dot(rel, cam_right) / max(d, 0.5), -0.9, 0.9))
    gain = min(1.0, 3.0 / max(d, 1.0)) * (0.55 + 0.45 * min(1.0, span / 0.6))
    n = int(0.35 * SR)
    tt = np.arange(n) / SR
    heel = np.sin(2 * np.pi * 95 * tt) * np.exp(-tt * 45) * 0.5
    click = fft_filter(rng.normal(0, 1, n), 1500, 6000) * np.exp(-tt * 140) * 0.35
    splash = fft_filter(rng.normal(0, 1, n), 900, 7000) * np.exp(-tt * 22) * (tt < 0.25) * 0.25
    toe = np.zeros(n)
    k = int(0.07 * SR)
    toe[k:] = fft_filter(rng.normal(0, 1, n - k), 1200, 5000) * np.exp(-tt[: n - k] * 60) * 0.18
    s = (heel + click + splash + toe) * gain * 0.5
    i0 = int(t_land * SR) - int(0.005 * SR)
    m = min(n, N - i0)
    mix[i0:i0 + m] += stereo(s[:m], pan)

# --- small room/street reverb
ir_n = int(0.7 * SR)
ir_t = np.arange(ir_n) / SR
ir = rng.normal(0, 1, ir_n) * np.exp(-ir_t * 7.5)
ir = fft_filter(ir, 200, 5000)
ir /= np.sqrt(np.sum(ir ** 2))
for ch in range(2):
    wet = np.fft.irfft(np.fft.rfft(mix[:, ch], N + ir_n) * np.fft.rfft(ir, N + ir_n), N + ir_n)[:N]
    mix[:, ch] = mix[:, ch] + 0.22 * wet
# fades + normalize to -1 dBFS
fade = np.ones(N)
fi, fo = int(0.4 * SR), int(0.8 * SR)
fade[:fi] = np.linspace(0, 1, fi)
fade[-fo:] = np.linspace(1, 0, fo)
mix *= fade[:, None]
mix *= (10 ** (-1 / 20)) / np.max(np.abs(mix))
pcm = (mix * 32767).astype(np.int16)
with wave.open(OUT, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("wrote", OUT)
