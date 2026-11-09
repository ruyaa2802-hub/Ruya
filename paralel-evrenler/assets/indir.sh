#!/usr/bin/env bash
# 3D modelleri indirir (repoya büyük ikili dosya koymamak için). Hepsi ücretsiz kaynaklardan.
set -e
cd "$(dirname "$0")"
B=https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf
curl -fsSL -o readyplayer.me.glb "$B/readyplayer.me.glb"   # ana karakter tabanı (three.js örnek varlığı)
curl -fsSL -o Xbot.glb "$B/Xbot.glb"                       # Mixamo animasyon kaynağı (idle/walk/run/agree/headShake/sad_pose)
curl -fsSL -o ece_mpfb.glb https://raw.githubusercontent.com/met4citizen/TalkingHead/main/avatars/mpfb.glb  # Ece (MakeHuman/MPFB, CC0)
echo "Modeller indirildi."
