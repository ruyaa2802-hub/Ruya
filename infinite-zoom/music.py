"""Original 30 s electronic loop at 128 BPM, generated with numpy (no samples, no licensed audio).

Usage: python3 music.py <out.wav>

Layout: 64 beats, kick on every beat, bass on 8th notes (A minor), hats on the off-beats,
a 16th-note arp, and a sidechain-style dip on every kick. The loop is exact: 30.000 s.
"""
import sys
import wave

import numpy as np

SR = 44100
BPM = 128
BEAT = 60.0 / BPM
LOOP = 30.0
N = int(round(SR * LOOP))
t = np.arange(N) / SR
rng = np.random.default_rng(7)

def beat_phase(period):
    return np.mod(t, period) / period

# kick: pitch sweep 120 -> 42 Hz, exponential decay, once per beat
ph_beat = beat_phase(BEAT)
kick_pitch = 42 + 78 * np.exp(-30 * ph_beat)
kick = 0.9 * np.sin(2 * np.pi * np.cumsum(kick_pitch) / SR) * np.exp(-9 * ph_beat)

# sidechain: duck everything else on every kick
duck = 1 - 0.55 * np.exp(-7 * ph_beat)

# bass: A minor 8th notes, soft harmonic saw-ish tone
bass_notes = [55.0, 55.0, 65.41, 55.0, 49.0, 55.0, 73.42, 65.41]  # A1 A1 C2 A1 G1 A1 D2 C2
eighth = BEAT / 2
idx = (np.floor(t / eighth).astype(int)) % len(bass_notes)
f_bass = np.array(bass_notes)[idx]
ph_eighth = beat_phase(eighth)
bass = sum(np.sin(2 * np.pi * f_bass * h * t) / h for h in range(1, 7))
bass *= 0.22 * np.exp(-3.0 * ph_eighth) * duck

# hats: noise bursts on the off-beats (every 8th, offset half a beat)
ph_hat = beat_phase(BEAT / 2)
hat_env = np.exp(-70 * np.mod(t + BEAT / 4, BEAT / 2) / (BEAT / 2))
hat = rng.standard_normal(N) * hat_env * 0.10
hat = np.where(np.mod(np.floor((t + BEAT / 4) / (BEAT / 2)), 2) == 1, hat, 0)

# arp: 16th notes cycling A minor triad, one octave up
arp_notes = np.array([440.0, 523.25, 659.25, 523.25])  # A4 C5 E5 C5
sixteenth = BEAT / 4
ai = (np.floor(t / sixteenth).astype(int)) % len(arp_notes)
f_arp = arp_notes[ai]
ph_16 = beat_phase(sixteenth)
arp = np.sin(2 * np.pi * f_arp * t) * np.exp(-6 * ph_16) * 0.06 * duck

mix = kick + bass + hat + arp
# gentle fade at the loop edges so the audio itself has no click when looped
fade = np.minimum(1, np.minimum(t / 0.02, (LOOP - t) / 0.02))
mix *= fade
peak = np.max(np.abs(mix))
mix = mix / peak * 0.85 if peak > 0 else mix

stereo = np.stack([mix, mix], axis=1)
pcm = (np.clip(stereo, -1, 1) * 32767).astype('<i2')

out = sys.argv[1]
with wave.open(out, 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print(f"wrote {out}: {N / SR:.3f} s, {BPM} BPM, {int(LOOP / BEAT)} beats")
