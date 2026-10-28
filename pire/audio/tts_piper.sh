#!/usr/bin/env bash
# Yerel yedek seslendirme (ElevenLabs kredisi yetmediğinde kullanıldı).
# Gerekenler: pip install piper-tts==1.8.0  ve  tr_TR-dfki-medium.onnx (+ .onnx.json)
#   https://huggingface.co/rhasspy/piper-voices/tree/main/tr/tr_TR/dfki/medium
# Ses verisi lisansı: CC BY-NC-SA 4.0 (ticari olmayan kullanım) — bkz. audio/raw/PIPER_MODEL_CARD.md
set -euo pipefail
MODEL=${1:?kullanım: audio/tts_piper.sh /yol/tr_TR-dfki-medium.onnx}
cd "$(dirname "$0")"
python3 - "$MODEL" <<'PY'
import json, subprocess, sys, wave
model = sys.argv[1]
out = []
for s in json.load(open('sentences.json')):
    f = f"raw/s{s['i']:02d}.wav"
    subprocess.run([sys.executable, '-m', 'piper', '-m', model, '-f', f, '--length-scale', '0.95', '--sentence-silence', '0'],
                   input=s['text'].encode(), check=True)
    w = wave.open(f)
    out.append({**s, 'dur': round(w.getnframes() / w.getframerate(), 2)})
json.dump(out, open('sentences.json', 'w'), ensure_ascii=False, indent=1)
PY
