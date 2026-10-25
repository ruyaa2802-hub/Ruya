#!/usr/bin/env bash
# Episode 2 "Hayatının En Büyük Kovalamacası": build -> lip sync -> render -> post -> sound -> MP4
#   BLENDER=/path/to/blender ./make_ep2.sh WORKDIR LINE.wav [render_percent] [samples]
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
W="${1:?work dir}"; LINE="${2:?dialogue wav}"
PCT="${3:-50}"; SPP="${4:-6}"
BLENDER="${BLENDER:-blender}"
mkdir -p "$W"
[ -f "$W/ep2.blend" ] || "$BLENDER" -b -P "$HERE/build_ep2.py" -- "$W/ep2.blend"
T_LINE=$(python3 -c "import json;print(json.load(open('$W/ep2_track.json'))['t_line'])")
"$BLENDER" -b "$W/ep2.blend" -P "$HERE/lipsync.py" -- "$LINE" "$T_LINE"
"$BLENDER" -b "$W/ep2.blend" -P "$HERE/render_setup.py" -- "$W/render" 1 426 "$PCT" "$SPP"
python3 "$HERE/post.py" "$W/render" "$W/post" "$W/ep2_track.json"
python3 "$HERE/audio_ep2.py" "$W/ep2_track.json" "$LINE" "$W/sound.wav"
ffmpeg -y -framerate 30 -i "$W/post/p_%04d.png" -i "$W/sound.wav" -vf "unsharp=5:5:0.3" \
  -c:v libx264 -preset medium -crf 21 -pix_fmt yuv420p -profile:v high \
  -c:a aac -b:a 192k -shortest -movflags +faststart "$W/ciddi_bir_mesele_bolum2.mp4"
