#!/bin/bash
# Kare dizisi + miks ses -> 1080x1920 H.264/AAC MP4
set -e
FR=$1; OUT=$2
HERE=$(cd "$(dirname "$0")" && pwd)
MIX="$HERE/../out/mix.wav"
ffmpeg -y -v error -i "$MIX" -af "acompressor=threshold=0.05:ratio=2.5:attack=15:release=250:makeup=3,loudnorm=I=-15:TP=-1.5:LRA=9" -ar 48000 "$HERE/../out/mix_master.wav"
ffmpeg -y -v error -framerate 30 -i "$FR/f%05d.jpg" -i "$HERE/../out/mix_master.wav" \
  -vf hqdn3d=2:2:6:6 -c:v libx264 -preset medium -crf 20 -maxrate 9M -bufsize 18M -pix_fmt yuv420p -profile:v high -movflags +faststart \
  -c:a aac -b:a 192k -shortest -t 85 "$OUT"
