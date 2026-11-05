#!/usr/bin/env python3
"""Ücretsiz, açık kaynak Türkçe seslendirme (Piper TTS) — kredi harcamaz.

  python3 studio/seslendir.py <video-klasoru> [--ses fahrettin|dfki|fettah] [--hiz 1.06]

senaryo.json'daki her bölümü ayrı seslendirir, aralarına 0,55 sn sessizlik koyar
(sistem sahne geçişlerini bu sessizliklerden bulur) ve ses/seslendirme.wav yazar.
Gerekenler: pip install piper-tts ; model ilk çalıştırmada Hugging Face'ten indirilir
(ortamda huggingface.co ve us.aws.cdn.hf.co izinli olmalı).
"""
import json, os, subprocess, sys, tempfile, urllib.request
from pathlib import Path

KOK = Path(__file__).resolve().parent.parent
ONBELLEK = Path(os.environ.get('XDG_CACHE_HOME', Path.home() / '.cache')) / 'ruya-piper'
URL = 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/tr/tr_TR/{v}/medium/tr_TR-{v}-medium.{e}'


def arg(ad, varsayilan):
    return sys.argv[sys.argv.index(ad) + 1] if ad in sys.argv else varsayilan


def model(ses):
    ONBELLEK.mkdir(parents=True, exist_ok=True)
    yol = ONBELLEK / f'tr_TR-{ses}-medium.onnx'
    for e in ('onnx', 'onnx.json'):
        hedef = ONBELLEK / f'tr_TR-{ses}-medium.{e}'
        if not hedef.exists():
            print(f'⬇  {hedef.name} indiriliyor…')
            urllib.request.urlretrieve(URL.format(v=ses, e=e), hedef)
    return yol


def main():
    video = next((a for a in sys.argv[1:] if not a.startswith('--') and a not in (arg('--ses', ''), arg('--hiz', ''))), None)
    if not video:
        sys.exit(__doc__)
    ses, hiz = arg('--ses', 'fahrettin'), arg('--hiz', '1.06')
    vdir = KOK / 'videolar' / video
    senaryo = json.loads((vdir / 'senaryo.json').read_text(encoding='utf-8'))
    m = model(ses)
    with tempfile.TemporaryDirectory() as td:
        parcalar = []
        for i, b in enumerate(senaryo['bolumler']):
            out = Path(td) / f'p{i}.wav'
            subprocess.run([sys.executable, '-m', 'piper', '-m', str(m), '--length-scale', hiz, '--sentence-silence', '0.35', '-f', str(out)],
                           input=b['metin'].encode('utf-8'), check=True, stderr=subprocess.DEVNULL)
            parcalar.append(out)
        sessiz = Path(td) / 's.wav'
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'lavfi', '-t', '0.55', '-i', 'anullsrc=r=22050:cl=mono', str(sessiz)], check=True)
        girdiler, n = [], 0
        for i, p in enumerate(parcalar):
            if i:
                girdiler += ['-i', str(sessiz)]; n += 1
            girdiler += ['-i', str(p)]; n += 1
        (vdir / 'ses').mkdir(exist_ok=True)
        hedef = vdir / 'ses' / 'seslendirme.wav'
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', *girdiler, '-filter_complex', f'concat=n={n}:v=0:a=1', '-ar', '44100', str(hedef)], check=True)
    print(f'🎙  {hedef.relative_to(KOK)} hazır (ses: {ses})')


if __name__ == '__main__':
    main()
