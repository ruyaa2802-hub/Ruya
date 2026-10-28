"""Tighten the narration take: every pause longer than MAX_GAP is shortened to KEEP seconds
(the speech itself is untouched), so the voice flows as one continuous, lively read.
In:  raw/narration_jessica.mp3   Out: narration.wav (48 kHz mono, sped up by TEMPO) + gaps.json (old→new time map)
"""
import json, os, re, subprocess
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 48000
MAX_GAP, KEEP = 0.40, 0.30
TEMPO = 1.05  # a touch quicker: medium-fast, still clear (pitch preserved)
src = os.path.join(HERE, 'raw/narration_jessica.mp3')
x = np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', src, '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'],
                                 capture_output=True, check=True).stdout, dtype=np.float32).astype(np.float64)
log = subprocess.run(['ffmpeg', '-i', src, '-af', 'silencedetect=noise=-38dB:d=0.28', '-f', 'null', '-'], capture_output=True, text=True).stderr
starts = [float(v) for v in re.findall(r'silence_start: ([\d.]+)', log)]
ends = [float(v) for v in re.findall(r'silence_end: ([\d.]+)', log)]
segs, pos, tmap, removed = [], 0, [[0.0, 0.0]], 0.0
for a, b in zip(starts, ends):
    if a < 0.05 or b - a <= MAX_GAP:
        continue
    cut0 = a + KEEP / 2  # keep a little air after the phrase…
    cut1 = b - KEEP / 2  # …and before the next one
    segs.append(x[int(pos * SR):int(cut0 * SR)])
    f = int(0.01 * SR)
    segs[-1][-f:] *= np.linspace(1, 0, f)
    removed += cut1 - cut0
    tmap.append([cut1, (cut1 - removed) / TEMPO])
    pos = cut1
tail = x[int(pos * SR):]
tail[:int(0.01 * SR)] *= np.linspace(0, 1, int(0.01 * SR))
segs.append(tail)
y = np.concatenate(segs)
y = y[: np.where(np.abs(y) > 0.01)[0][-1] + int(0.25 * SR)]
y = np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-', '-af', f'atempo={TEMPO}',
                                 '-f', 'f32le', '-'], input=y.astype(np.float32).tobytes(), capture_output=True, check=True).stdout, dtype=np.float32)
import wave
with wave.open(os.path.join(HERE, 'narration.wav'), 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(y, -1, 1) * 32767).astype(np.int16).tobytes())
json.dump(tmap, open(os.path.join(HERE, 'gaps.json'), 'w'))
print(f'{len(x) / SR:.2f}s → {len(y) / SR:.2f}s, removed {removed:.2f}s in {len(tmap) - 1} pauses, tempo {TEMPO}')
