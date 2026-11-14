#!/usr/bin/env bash
# CLAY REPLAY - Bölüm 1B: TİTANİK (Martı) — baştan sona ücretsiz üretim hattı.
# Gerekenler (hepsi ücretsiz/açık kaynak): python3, numpy, scipy, pillow, piper-tts, ffmpeg
set -euo pipefail
cd "$(dirname "$0")"
VOICE_DIR=${VOICE_DIR:-voices}
MODEL="$VOICE_DIR/tr_TR-dfki-medium.onnx"
if [ ! -f "$MODEL" ]; then
  mkdir -p "$VOICE_DIR"
  base=https://huggingface.co/rhasspy/piper-voices/resolve/main/tr/tr_TR/dfki/medium
  curl -sSfL -o "$MODEL" "$base/tr_TR-dfki-medium.onnx"
  curl -sSfL -o "$MODEL.json" "$base/tr_TR-dfki-medium.onnx.json"
fi
mkdir -p audio build
# 1) Diyaloglar (Piper TTS, yerel, ücretsiz)
while IFS='|' read -r id txt ls; do
  echo "$txt" | python3 -m piper -m "$MODEL" --length-scale "$ls" -f "audio/raw_$id.wav"
done <<'EOF'
RO1|Cek! Çok güzel!|0.9
JA1|Gözlerini kapat Roz. Bana güven.|0.95
JA2|Şimdi aç kollarını!|0.9
RO2|Uçuyorum Cek! Uçuyorum!|0.85
RO3|Cek, dünyanın en güzel hissi bu!|0.9
JA3|Biliyorum Roz!|0.9
RO4|Cek... Kıpırdama.|1.05
JA4|Neden?|1.0
RO5|Saçında yeni bir yolcu var.|0.95
EOF
# 2) Ses miksajı + dudak senkronu
python3 audio.py
# 3) Kareler (stop-motion, 12 poz/sn, 24 fps)
python3 ../ep01-titanic/episode.py --only 0 >/dev/null 2>&1 || true
python3 episode.py
# 4) Video (H.264 + AAC, 1080x1920, 9:16)
ffmpeg -y -v error -framerate 24 -i build/frames/f%04d.jpg -i build/mix.wav \
  -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest \
  -movflags +faststart CLAY_REPLAY_01B_TITANIK_MARTI.mp4
echo "Hazır: CLAY_REPLAY_01B_TITANIK_MARTI.mp4"
