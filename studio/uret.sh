#!/usr/bin/env bash
# Ücretsiz video üretim hattı — hiçbir ücretli/kredili API çağırmaz.
#
#   ./studio/uret.sh <video-klasoru> onizleme   -> cikti/onizleme_sessiz.mp4  (ses gerekmez)
#   ./studio/uret.sh <video-klasoru> final      -> cikti/final.mp4            (ses/seslendirme.* gerekir)
#   ./studio/uret.sh <video-klasoru> kare 12.5  -> cikti/kare_12.5.png        (tek kare kontrolü)
#
# Seçenekler (ortam değişkeni):  ISCI=4  (paralel render işçisi)   TAHMINI=1 (ses olsa da tahmini zamanlama)
set -euo pipefail
cd "$(dirname "$0")/.."
VIDEO="${1:?video klasörü verin, örn. videolar/01-gidiklama}"
MOD="${2:-onizleme}"
VIDEO="${VIDEO%/}"
CIKTI="$VIDEO/cikti"
mkdir -p "$CIKTI"
ISCI="${ISCI:-$(nproc 2>/dev/null || echo 4)}"

ses_dosyasi() { ls "$VIDEO"/ses/seslendirme.{mp3,wav,m4a,aac} 2>/dev/null | head -1 || true; }

zamanla() {
  if [[ "${TAHMINI:-0}" == "1" ]]; then python3 studio/araclar/zamanla.py "$VIDEO" --tahmini
  else python3 studio/araclar/zamanla.py "$VIDEO"; fi
}

case "$MOD" in
  onizleme)
    zamanla
    node studio/araclar/render.cjs "$VIDEO" "$CIKTI/onizleme_sessiz.mp4" --isci "$ISCI"
    echo "Sessiz önizleme: $CIKTI/onizleme_sessiz.mp4"
    ;;

  kare)
    T="${3:?zaman (sn) verin}"
    node studio/araclar/render.cjs "$VIDEO" "$CIKTI/kare_$T.png" --kare "$T" "$CIKTI/kare_$T.png"
    ;;

  final)
    SES="$(ses_dosyasi)"
    if [[ -z "$SES" ]]; then
      echo "Ses dosyası yok: $VIDEO/ses/seslendirme.mp3 bekleniyor."
      echo "ElevenLabs'te üretip bu klasöre yükleyin (bkz. $VIDEO/elevenlabs.md). Kredi harcanmadı."
      exit 3
    fi
    TAHMINI=0 zamanla
    GEC="$(mktemp -d)"; trap 'rm -rf "$GEC"' EXIT
    node studio/araclar/render.cjs "$VIDEO" "$GEC/goruntu.mp4" --isci "$ISCI"
    python3 studio/araclar/muzik.py "$VIDEO" "$GEC/muzik.wav"
    SURE="$(python3 -c "import json;print(json.load(open('$VIDEO/zamanlama.json'))['sure'])")"

    # Miks: ses netleştirme + müzik ses konuşurken otomatik kısılır (sidechain ducking)
    MIKS="[0:a]aresample=48000,aformat=channel_layouts=stereo,highpass=f=70,acompressor=threshold=-20dB:ratio=2.5:attack=5:release=120:makeup=1.5,asplit=2[ses][yan];\
[1:a]highpass=f=30,volume=-13dB[muz];\
[muz][yan]sidechaincompress=threshold=0.025:ratio=6:attack=40:release=600[muzk];\
[ses][muzk]amix=inputs=2:normalize=0:duration=longest,apad,atrim=0:$SURE"
    OLC="$(ffmpeg -hide_banner -i "$SES" -i "$GEC/muzik.wav" -filter_complex "$MIKS,loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json" -f null - 2>&1 | sed -n '/^{/,/^}/p')"
    al() { echo "$OLC" | grep "\"$1\"" | sed 's/.*: "\(.*\)".*/\1/'; }
    LN="loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=$(al input_i):measured_TP=$(al input_tp):measured_LRA=$(al input_lra):measured_thresh=$(al input_thresh):offset=$(al target_offset):linear=true"
    ffmpeg -hide_banner -loglevel error -y -i "$SES" -i "$GEC/muzik.wav" -filter_complex "$MIKS,$LN,aresample=48000[a]" -map "[a]" -c:a pcm_s16le "$GEC/miks.wav"
    ffmpeg -hide_banner -loglevel error -y -i "$GEC/goruntu.mp4" -i "$GEC/miks.wav" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -t "$SURE" -movflags +faststart "$CIKTI/final.mp4"
    cp "$GEC/muzik.wav" "$CIKTI/muzik.wav"

    echo "--- Kontrol ---"
    ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate:format=duration -of compact "$CIKTI/final.mp4"
    ffmpeg -hide_banner -i "$CIKTI/final.mp4" -af ebur128=peak=true -f null - 2>&1 | grep -E "I:|Peak:" | tail -2
    echo "Final: $CIKTI/final.mp4"
    ;;

  *) echo "Bilinmeyen mod: $MOD (onizleme | final | kare)"; exit 2 ;;
esac
