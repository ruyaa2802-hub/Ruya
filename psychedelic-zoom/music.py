"""Original high-energy electronic track, 30 s, 140 BPM (70 beats), synthesized with numpy.

Usage: python3 music.py <out.wav>

No samples or licensed audio are used. Layers: four-on-the-floor kick, clap on 2 and 4,
off-beat open hats, a resonant acid-style bass that sweeps on each 16th, a rave stab
chord on the bar, and a riser into the loop point. The duration is exactly 30.000 s.
"""
import sys
import wave

import numpy as np

SR = 44100
BPM = 140
BEAT = 60.0 / BPM
LOOP = 30.0
N = int(round(SR * LOOP))
t = np.arange(N) / SR
rng = np.random.default_rng(11)


def env_by_beat(period, decay):
    """Exponential envelope that restarts every `period` seconds."""
    ph = np.mod(t, period)
    return np.exp(-decay * ph / period)


# kick: 160 -> 45 Hz pitch sweep, every beat
kick_ph = np.mod(t, BEAT)
kick_pitch = 45 + 115 * np.exp(-40 * kick_ph)
kick = np.sin(2 * np.pi * np.cumsum(kick_pitch) / SR) * np.exp(-8 * kick_ph / BEAT) * 0.95

# sidechain duck on every kick
duck = 1 - 0.6 * np.exp(-6 * kick_ph / BEAT)

# clap on beats 2 and 4 (band-limited noise burst)
bar = 4 * BEAT
clap_ph = np.mod(t - BEAT, 2 * BEAT)
clap_env = np.where(clap_ph >= 0, np.exp(-22 * clap_ph / BEAT), 0.0)
noise = rng.standard_normal(N)
clap = noise * clap_env * 0.22
clap *= (np.mod(np.floor((t - BEAT) / BEAT), 2) == 0)

# off-beat open hats
hat_ph = np.mod(t - BEAT / 2, BEAT)
hat = rng.standard_normal(N) * np.exp(-9 * hat_ph / BEAT) * 0.09

# acid bass: 16th notes in A minor, a one-pole low-pass whose cutoff sweeps on each note
notes = np.array([55.0, 55.0, 110.0, 55.0, 65.41, 55.0, 98.0, 55.0] * 2)
sixteenth = BEAT / 4
idx = np.floor(t / sixteenth).astype(int) % len(notes)
f_bass = notes[idx]
saw = 2 * np.mod(f_bass * t, 1.0) - 1
bass_ph = np.mod(t, sixteenth) / sixteenth
cutoff = 0.02 + 0.22 * np.exp(-5 * bass_ph)
bass = np.zeros(N)
acc = 0.0
# vectorized one-pole filter is slow in pure numpy; use a short block loop
block = 2048
for start in range(0, N, block):
    seg = saw[start:start + block] * 1.0
    a = cutoff[start:start + block]
    y = np.empty_like(seg)
    for k in range(len(seg)):
        acc = acc + a[k] * (seg[k] - acc)
        y[k] = acc
    bass[start:start + block] = y
bass *= 0.42 * duck

# rave stab: A minor chord on each bar, short and bright
chord = [220.0, 261.63, 329.63]  # A3 C4 E4
stab_ph = np.mod(t, bar)
stab = np.zeros(N)
for f in chord:
    stab += np.sign(np.sin(2 * np.pi * f * t))  # square-ish
stab = stab / len(chord) * np.exp(-4 * stab_ph / bar) * 0.07 * (stab_ph < 0.8 * bar)

mix = kick + clap + hat + bass + stab

# riser over the last beat so the loop point lands on the downbeat
riser_len = BEAT
riser_ph = np.clip((t - (LOOP - riser_len)) / riser_len, 0, 1)
riser = rng.standard_normal(N) * riser_ph ** 2 * 0.08 * (t > LOOP - riser_len)
mix = mix + riser

fade = np.minimum(1, np.minimum(t / 0.01, (LOOP - t) / 0.01))
mix *= fade
peak = np.max(np.abs(mix))
mix = mix / peak * 0.9 if peak > 0 else mix

stereo = np.stack([mix, mix], axis=1)
pcm = (np.clip(stereo, -1, 1) * 32767).astype('<i2')

out = sys.argv[1]
with wave.open(out, 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print(f"wrote {out}: {N / SR:.3f} s, {BPM} BPM, {int(round(LOOP / BEAT))} beats")
