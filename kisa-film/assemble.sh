#!/usr/bin/env bash
# Assemble "ONE DAY, YOU WON'T HEAR MY VOICE ANYMORE" (9:16, about 40 s).
#
# Inputs (relative to this folder):
#   clips/s1.mp4 … clips/s6.mp4   six generated shots (any resolution; scaled/cropped to 1080x1920)
#   audio/vo.wav                  the whole Turkish narration in one take (starts at VO_START)
#   audio/music.wav               the 40 s piano + strings cue
#   audio/meow.wav                optional, a soft meow placed at MEOW_AT
#
# Output: ONE_DAY_9x16.mp4  (H.264 1080x1920 24 fps, AAC 48 kHz, -14 LUFS)
#
# Settings you can override, e.g.  DURS="7 7 7.5 7 8 6.5" FONT=/path/Font.ttf ./assemble.sh
set -euo pipefail
cd "$(dirname "$0")"

DURS=(${DURS:-7 7 7.5 7 8 6.5})        # length used from each clip (seconds)
XF=${XF:-0.6}                          # cross-dissolve length
TRANS=(fade fade fadewhite fade fade)  # transition into shots 2..6
VO_START=${VO_START:-0.5}
TEXT_IN=${TEXT_IN:-35.0}               # when the closing sentence starts to fade in
MEOW_AT=${MEOW_AT:-4.5}
FONT=${FONT:-/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf}  # must include Turkish glyphs (ı ş ğ â)
OUT=${OUT:-ONE_DAY_9x16.mp4}

for i in 1 2 3 4 5 6; do [[ -f clips/s$i.mp4 ]] || { echo "missing clips/s$i.mp4" >&2; exit 1; }; done
[[ -f audio/vo.wav ]]    || { echo "missing audio/vo.wav" >&2; exit 1; }
[[ -f audio/music.wav ]] || { echo "missing audio/music.wav" >&2; exit 1; }
[[ -f final-text.txt ]]  || { echo "missing final-text.txt" >&2; exit 1; }

# Split the closing sentence after the comma into two centred lines (the text itself is not changed).
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
sentence=$(cat final-text.txt)
printf '%s' "${sentence%%, *},"  > "$tmp/l1.txt"
printf '%s' "${sentence#*, }"    > "$tmp/l2.txt"

TOTAL=$(awk -v xf="$XF" 'BEGIN{s=0} {for(i=1;i<=NF;i++) s+=$i} END{printf "%.3f", s-(NF-1)*xf}' <<<"${DURS[*]}")
FADE_OUT=$(awk -v t="$TOTAL" 'BEGIN{printf "%.3f", t-1.2}')
echo "Total runtime: ${TOTAL}s"

# ---- video graph ----
vf=""
for i in 0 1 2 3 4 5; do
  zoom=""
  # Final photograph: slow push-in (100% -> about 112%) on top of whatever motion the clip already has.
  [[ $i -eq 5 ]] && zoom=",zoompan=z='min(1+0.0008*on\,1.12)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=24"
  vf+="[$i:v]trim=0:${DURS[$i]},setpts=PTS-STARTPTS,fps=24,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1${zoom},format=yuv420p[v$i];"
done
prev="v0"; acc=0
for i in 1 2 3 4 5; do
  acc=$(awk -v a="$acc" -v d="${DURS[$((i-1))]}" -v xf="$XF" 'BEGIN{printf "%.3f", a+d-xf}')
  vf+="[$prev][v$i]xfade=transition=${TRANS[$((i-1))]}:duration=$XF:offset=$acc[x$i];"
  prev="x$i"
done
TEXT_FULL=$(awk -v t="$TEXT_IN" 'BEGIN{printf "%.2f", t+1.2}')
alpha="if(lt(t\,$TEXT_IN)\,0\,min(1\,(t-$TEXT_IN)/1.2))"
common="fontfile=$FONT:fontsize=64:fontcolor=white:shadowcolor=black@0.6:shadowx=0:shadowy=3:borderw=1:bordercolor=black@0.25:x=(w-text_w)/2:alpha='$alpha'"
vf+="[$prev]drawtext=textfile=$tmp/l1.txt:$common:y=h/2-text_h-14,"
vf+="drawtext=textfile=$tmp/l2.txt:$common:y=h/2+14,"
vf+="fade=t=out:st=$FADE_OUT:d=1.2,format=yuv420p[vout];"

# ---- audio graph ----
inputs=(-i clips/s1.mp4 -i clips/s2.mp4 -i clips/s3.mp4 -i clips/s4.mp4 -i clips/s5.mp4 -i clips/s6.mp4 -i audio/vo.wav -i audio/music.wav)
vo_ms=$(awk -v s="$VO_START" 'BEGIN{printf "%d", s*1000}')
af="[6:a]aresample=48000,aformat=channel_layouts=stereo,highpass=f=80,acompressor=threshold=-20dB:ratio=2:attack=10:release=200,adelay=${vo_ms}|${vo_ms},apad,asplit=2[vo][vokey];"
af+="[7:a]aresample=48000,aformat=channel_layouts=stereo,volume=-6dB,apad[mus];"
af+="[mus][vokey]sidechaincompress=threshold=0.03:ratio=6:attack=40:release=600:makeup=1[musd];"
mixn=2; extra=""
if [[ -f audio/meow.wav ]]; then
  inputs+=(-i audio/meow.wav)
  m_ms=$(awk -v s="$MEOW_AT" 'BEGIN{printf "%d", s*1000}')
  af+="[8:a]aresample=48000,aformat=channel_layouts=stereo,volume=-20dB,adelay=${m_ms}|${m_ms},apad[meow];"
  extra="[meow]"; mixn=3
fi
af+="[vo][musd]${extra}amix=inputs=$mixn:normalize=0:duration=first,atrim=0:$TOTAL,"
af+="afade=t=out:st=$FADE_OUT:d=1.2,loudnorm=I=-14:TP=-1:LRA=11,aresample=48000[aout]"

ffmpeg -y -hide_banner -loglevel warning "${inputs[@]}" \
  -filter_complex "${vf}${af}" -map "[vout]" -map "[aout]" -t "$TOTAL" \
  -c:v libx264 -preset slow -crf 17 -profile:v high -pix_fmt yuv420p -r 24 \
  -c:a aac -b:a 256k -ar 48000 -movflags +faststart "$OUT"
echo "Wrote $OUT"
