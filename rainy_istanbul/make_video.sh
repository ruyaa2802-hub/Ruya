#!/usr/bin/env bash
# Full pipeline: build scene -> render -> post (rain/grain) -> sound -> MP4
#   BLENDER=/path/to/blender ./make_video.sh WORKDIR [render_percent] [samples]
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
W="${1:?work dir}"
PCT="${2:-67}"
SPP="${3:-10}"
BLENDER="${BLENDER:-blender}"
mkdir -p "$W"

if [ ! -f "$W/scene.blend" ]; then
  "$BLENDER" -b -P "$HERE/build_scene.py" -- "$W/scene.blend"
fi
if [ "$(ls "$W/render/beauty" 2>/dev/null | wc -l)" -lt 300 ]; then
  "$BLENDER" -b "$W/scene.blend" -P "$HERE/render_setup.py" -- "$W/render" 1 300 "$PCT" "$SPP"
fi
python3 "$HERE/post.py" "$W/render" "$W/post"
python3 "$HERE/audio.py" "$W/scene_track.json" "$W/sound.wav"
ffmpeg -y -framerate 30 -i "$W/post/p_%04d.png" -i "$W/sound.wav" \
  -vf "unsharp=5:5:0.3" \
  -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -profile:v high \
  -c:a aac -b:a 192k -shortest -movflags +faststart "$W/rainy_istanbul_10s.mp4"
echo "done: $W/rainy_istanbul_10s.mp4"
