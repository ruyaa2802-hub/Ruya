#!/usr/bin/env bash
# Bölüm 2 seslendirmesini finale hazırlar.
# Kullanım: ./finalize.sh <ham.mp3 | https://...content.mp3>
# İmzalı indirme bağlantısı ElevenLabs flow'undaki generation'dan alınır (kaynak.json).
set -euo pipefail
cd "$(dirname "$0")"
SRC="${1:?ham mp3 dosyası ya da ElevenLabs indirme bağlantısı verin}"
mkdir -p ham final

if [[ "$SRC" == http* ]]; then
  curl -sSfL -o ham/bolum2_ham.mp3 "$SRC"
  SRC=ham/bolum2_ham.mp3
fi

# 1) Baştaki/sondaki sessizliği kırp, 2) hafif temizlik (80 Hz altı), 
# 3) iki geçişli loudnorm: -14 LUFS / -1 dBTP (YouTube, Reels, TikTok için)
TRIM="silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.1,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.3,areverse,highpass=f=80"

STATS=$(ffmpeg -hide_banner -i "$SRC" -af "$TRIM,loudnorm=I=-14:TP=-1:LRA=11:print_format=json" -f null - 2>&1 | sed -n '/^{/,/^}/p')
get() { echo "$STATS" | grep "\"$1\"" | sed 's/.*: "\(.*\)".*/\1/'; }
LN="loudnorm=I=-14:TP=-1:LRA=11:measured_I=$(get input_i):measured_TP=$(get input_tp):measured_LRA=$(get input_lra):measured_thresh=$(get input_thresh):offset=$(get target_offset):linear=true"

# Başta 0.3 sn, sonda 0.7 sn nefes payı
PAD="adelay=300|300,apad=pad_dur=0.7"

ffmpeg -hide_banner -y -i "$SRC" -af "$TRIM,$LN,$PAD" -ar 48000 -ac 2 final/bolum2_final.wav
ffmpeg -hide_banner -y -i final/bolum2_final.wav -c:a libmp3lame -b:a 192k final/bolum2_final.mp3

echo "--- Final ölçüm ---"
ffmpeg -hide_banner -i final/bolum2_final.wav -af ebur128=peak=true -f null - 2>&1 | grep -E "I:|LRA:|Peak:" | tail -3
ffprobe -v error -show_entries format=duration -of default=nw=1 final/bolum2_final.wav
