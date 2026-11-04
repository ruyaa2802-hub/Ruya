#!/usr/bin/env bash
# Bölüm 1 videosunu baştan üretir (ücretsiz: Python + Chromium + ffmpeg).
set -euo pipefail
cd "$(dirname "$0")"
TMP=$(mktemp -d)
python3 video_olustur.py kareler "$TMP/kareler"
python3 video_olustur.py ses "$TMP/ses.wav"
node kare_render.js "$TMP/kareler" "$TMP/ses.wav" bolum1.mp4
rm -rf "$TMP"
