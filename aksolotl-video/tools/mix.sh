#!/usr/bin/env bash
# Usage: tools/mix.sh <silent_video.mp4> <out.mp4>
# Mixes audio/music.wav + audio/sfx.wav. If voice/scene1..5.mp3 (or .wav) exist, adds the narration and ducks the music under it.
set -euo pipefail
cd "$(dirname "$0")/.."
VID="$1"; OUT="$2"
starts=(0.3 7.2 17.4 27.2 36.3)
ins=(-i "$VID" -i audio/music.wav -i audio/sfx.wav)
vf=""; labels=""; n=3
for i in 1 2 3 4 5; do
  f=$(ls voice/scene$i.* 2>/dev/null | head -1 || true)
  if [ -n "${f:-}" ]; then
    ms=$(python3 -c "print(int(${starts[$((i-1))]}*1000))")
    ins+=(-i "$f"); vf+="[$n:a]aresample=44100,adelay=${ms}|${ms},volume=1.3[v$i];"; labels+="[v$i]"; n=$((n+1))
  fi
done
if [ -n "$labels" ]; then
  cnt=$(echo -n "$labels" | grep -o '\[v' | wc -l)
  fc="${vf}${labels}amix=inputs=${cnt}:normalize=0[voice];[voice]asplit=2[vo][sc];[1:a]volume=0.55[m];[m][sc]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[md];[md][2:a]amix=inputs=2:normalize=0:weights=1 0.8[bed];[bed][vo]amix=inputs=2:normalize=0:weights=1 1.2[mix];[mix]loudnorm=I=-16:TP=-1.5:LRA=9[aout]"
else
  fc="[1:a]volume=0.85[m];[2:a]volume=0.9[s];[m][s]amix=inputs=2:normalize=0[mix];[mix]loudnorm=I=-16:TP=-1.5:LRA=9[aout]"
fi
ffmpeg -hide_banner -loglevel error -y "${ins[@]}" -filter_complex "$fc" -map 0:v -map "[aout]" -c:v copy -c:a aac -b:a 192k -ar 44100 -t 47 -movflags +faststart "$OUT"
echo "wrote $OUT"
