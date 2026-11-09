#!/usr/bin/env bash
# Sahneleri kronolojik sırayla birleştirir (geçişler sahnelerin içinde: beyaz flaş, kapı eşleşme kesmesi, sert kesme)
set -e
cd "$(dirname "$0")"
D=cikti/sahneler
printf "file 'sahne1.mp4'\nfile 'sahne2.mp4'\nfile 'sahne3.mp4'\nfile 'sahne4.mp4'\nfile 'sahne5.mp4'\n" > $D/liste.txt
ffmpeg -y -loglevel error -f concat -safe 0 -i $D/liste.txt -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=48000 \
  -map 0:v -map 1:a -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -r 30 -profile:v high -level 4.2 \
  -c:a aac -b:a 128k -shortest -movflags +faststart \
  -metadata title="Ya Her Kararımız Başka Bir Evren Yaratıyorsa?" cikti/ya_her_kararimiz.mp4
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate:format=duration -of compact cikti/ya_her_kararimiz.mp4
