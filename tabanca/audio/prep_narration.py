"""Cut the single edge-tts take into its 8 sentences (at the measured pauses) and
place them on the film's timeline. Word timings come from the TTS word
boundaries, shifted with their sentence → words.json (used by subtitles + timeline)."""
import json, re, subprocess
import numpy as np

SR = 48000
SRC = 'raw/narration_ahmet.wav'
# sentence spans in the raw take (silencedetect -38 dB / 0.28 s) → start on the film timeline
SENT = [  # (src_start, src_end, dst_start)
    (0.427, 2.790, 0.35),    # Denizin dibinde, küçücük bir canlı var…
    (4.000, 5.887, 3.25),    # Ve bu canlının silahı mermi değil!
    (7.292, 12.088, 5.55),   # Tabanca karidesi … su jeti oluşturuyor.
    (13.496, 16.650, 10.95), # Bu hareket, kavitasyon … yol açıyor.
    (18.009, 20.633, 14.85), # Kabarcık çökerken ses ve ısı ortaya çıkıyor.
    (22.036, 25.154, 18.35), # Hatta çok kısa süreli ışık parlamaları bile oluşabiliyor!
    (26.545, 30.405, 22.70), # Üstelik … vücutla yapıyor.
    (31.794, 35.271, 27.55), # Doğa bazen … saklıyor.
]
PRE, POST = 0.05, 0.16
DUR = 33.5

raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', SRC, '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
x = np.frombuffer(raw, dtype=np.float32)
out = np.zeros(int(DUR * SR), dtype=np.float32)
fade = int(0.012 * SR)
for a, b, d in SENT:
    seg = x[int((a - PRE) * SR):int((b + POST) * SR)].copy()
    seg[:fade] *= np.linspace(0, 1, fade)
    seg[-fade:] *= np.linspace(1, 0, fade)
    i = int((d - PRE) * SR)
    out[i:i + len(seg)] += seg
import wave
pcm = (np.clip(out, -1, 1) * 32767).astype(np.int16)
with wave.open('narration.wav', 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())

def ts(s):
    h, m, r = s.split(':'); sec, ms = r.split(',')
    return int(h) * 3600 + int(m) * 60 + int(sec) + int(ms) / 1000
blocks = []
for blk in open('raw/narration_ahmet.srt', encoding='utf-8').read().strip().split('\n\n'):
    lines = blk.strip().split('\n')
    t0, t1 = [ts(v.strip()) for v in lines[1].split('-->')]
    blocks.append((t0, t1, ' '.join(lines[2:]).strip()))
# group words into sentences at the long gaps, then map each group linearly onto the
# measured audio span of its sentence (the TTS boundaries run a little early)
groups, cur = [], [blocks[0]]
for b in blocks[1:]:
    if b[0] - cur[-1][1] > 0.7:
        groups.append(cur); cur = []
    cur.append(b)
groups.append(cur)
assert len(groups) == len(SENT), len(groups)
words = []
for k, (g, (a, b, d)) in enumerate(zip(groups, SENT)):
    g0, g1 = g[0][0], g[-1][1]
    m = lambda t: d + (t - g0) / (g1 - g0) * (b - a)
    for t0, t1, text in g:
        words.append({'w': text, 's': round(m(t0), 3), 'e': round(m(t1), 3), 'sent': k})
json.dump(words, open('words.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
for k in range(len(SENT)):
    ws = [w for w in words if w['sent'] == k]
    print(k, ws[0]['s'], ws[-1]['e'], ' '.join(w['w'] for w in ws))
