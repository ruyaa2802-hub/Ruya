#!/usr/bin/env bash
# "Güçlü Görünmek" — tamamen ücretsiz üretim hattı (python3, numpy, scipy, pillow, piper-tts, ffmpeg)
set -euo pipefail
cd "$(dirname "$0")"
MODEL=${MODEL:-voices/tr_TR-dfki-medium.onnx}
if [ ! -f "$MODEL" ]; then
  mkdir -p voices; b=https://huggingface.co/rhasspy/piper-voices/resolve/main/tr/tr_TR/dfki/medium
  curl -sSfL -o "$MODEL" "$b/tr_TR-dfki-medium.onnx"; curl -sSfL -o "$MODEL.json" "$b/tr_TR-dfki-medium.onnx.json"
fi
mkdir -p audio build
while IFS='|' read -r id txt; do
  case $id in V1|V5) ls=1.03 ;; *) ls=1.12 ;; esac
  echo "$txt" | python3 -m piper -m "$MODEL" --length-scale $ls --noise-scale 0.72 --noise-w-scale 0.9 --sentence-silence 0.3 -f "audio/raw_$id.wav"
done < vo.txt
python3 film.py          # kareler (12 poz/sn el çizimi, 24 fps)
python3 audio.py         # anlatım + piyano + ortam sesi
ffmpeg -nostdin -y -v error -framerate 24 -i build/frames/f%04d.jpg -i build/mix.wav -c:v libx264 -preset slow -crf 26 \
  -tune grain -pix_fmt yuv420p -c:a aac -b:a 192k -shortest -movflags +faststart GUCLU_GORUNMEK.mp4
echo "Hazır: GUCLU_GORUNMEK.mp4"
