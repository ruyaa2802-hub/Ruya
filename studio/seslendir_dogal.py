#!/usr/bin/env python3
"""Doğal, ücretsiz Türkçe seslendirme — Chatterbox Multilingual (MIT lisanslı) + Whisper kalite kontrolü.

  /root/cbx-venv/bin/python studio/seslendir_dogal.py <video-klasoru> [--deneme 3]
      [--duygu 0.5] [--cfg 0.5] [--tempo 1.0] [--cumle-ara 0.3] [--bolum-ara 0.55]

  Duygusal/yavaş ton için örnek: --duygu 0.8 --cfg 0.3 --tempo 0.92 --cumle-ara 0.5 --bolum-ara 0.9

Her cümleyi birkaç farklı ayarla üretir, her denemeyi Whisper ile yazıya döker ve metne en
yakın olanı seçer; modelin sona eklediği anlamsız sesleri konuşmanın bittiği yerden keser.
Cümle arası 0,3 sn, bölüm arası 0,55 sn sessizlik koyar ve ses/seslendirme.wav yazar.

Kurulum (bir kez): python3 -m venv /root/cbx-venv && /root/cbx-venv/bin/pip install chatterbox-tts "setuptools<81" faster-whisper
Ağ: huggingface.co ve us.aws.cdn.hf.co izinli olmalı; HF_HUB_DISABLE_XET=1 ile çalıştır.
Hız: 4 çekirdekte ~5 sn ses ≈ 25 sn; 30 sn'lik metin ve 3 deneme ≈ 8–10 dk.
"""
import difflib, json, os, re, subprocess, sys, tempfile
from pathlib import Path

os.environ.setdefault('HF_HUB_DISABLE_XET', '1')
import numpy as np
import torch, torchaudio
from faster_whisper import WhisperModel
from chatterbox.mtl_tts import ChatterboxMultilingualTTS

KOK = Path(__file__).resolve().parent.parent
AYARLAR = [(11, 0.5, 0.5), (23, 0.45, 0.6), (37, 0.5, 0.7), (53, 0.4, 0.5), (77, 0.5, 0.7)]


def cumleler(m):
    return [c for c in re.split(r'(?<=[.!?…])\s+', ' '.join(m.split())) if c]


def norm(x):
    return re.sub(r'[^a-zçğıöşü ]', '', x.lower())


def oku16k(yol):
    a = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', str(yol), '-ac', '1', '-ar', '16000', '-f', 's16le', '-'], capture_output=True).stdout
    return np.frombuffer(a, dtype=np.int16).astype(np.float32) / 32768


def secenek(ad, v):
    return float(sys.argv[sys.argv.index(ad) + 1]) if ad in sys.argv else v


def main():
    degerler = {sys.argv[i + 1] for i, a in enumerate(sys.argv[:-1]) if a.startswith('--')}
    video = next((a for a in sys.argv[1:] if not a.startswith('--') and a not in degerler), None)
    if not video:
        sys.exit(__doc__)
    deneme = int(secenek('--deneme', 3))
    duygu, cfg0, tempo = secenek('--duygu', None), secenek('--cfg', None), secenek('--tempo', 1.0)
    cumle_ara, bolum_ara = secenek('--cumle-ara', 0.3), secenek('--bolum-ara', 0.55)
    vdir = KOK / 'videolar' / video
    senaryo = json.loads((vdir / 'senaryo.json').read_text(encoding='utf-8'))
    torch.set_num_threads(os.cpu_count() or 4)
    tts = ChatterboxMultilingualTTS.from_pretrained(device='cpu')
    stt = WhisperModel('small', device='cpu', compute_type='int8')
    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        girdiler = []
        for bi, b in enumerate(senaryo['bolumler']):
            for ci, c in enumerate(cumleler(b['metin'])):
                en = None
                for k, (seed, ex, cfg) in enumerate(AYARLAR[:deneme]):
                    if duygu is not None: ex = duygu + (k % 2) * 0.05
                    if cfg0 is not None: cfg = cfg0 + (k % 3) * 0.05
                    torch.manual_seed(seed)
                    wav = tts.generate(c, language_id='tr', exaggeration=ex, cfg_weight=cfg)
                    yol = td / f'{bi}_{ci}_{k}.wav'
                    torchaudio.save(str(yol), wav, tts.sr)
                    segs = list(stt.transcribe(oku16k(yol), language='tr', word_timestamps=True)[0])
                    metin = ' '.join(s.text.strip() for s in segs)
                    skor = difflib.SequenceMatcher(None, norm(metin), norm(c)).ratio()
                    son = (segs[-1].words[-1].end + 0.25) if segs and segs[-1].words else wav.shape[-1] / tts.sr
                    print(f'  {bi}.{ci} deneme {k}: {skor:.3f}  {metin}', flush=True)
                    if en is None or skor > en[0]:
                        en = (skor, yol, son)
                    if skor > 0.985:
                        break
                kes = td / f'k{bi}_{ci}.wav'
                subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(en[1]), '-t', f'{en[2]:.2f}', '-af', f'afade=t=out:st={max(0, en[2] - 0.12):.2f}:d=0.12' + (f',atempo={tempo}' if tempo != 1.0 else ''), '-ar', '44100', '-ac', '1', str(kes)], check=True)
                if girdiler:
                    girdiler.append(('s', cumle_ara if ci else bolum_ara))
                girdiler.append(('d', kes))
                print(f'✔ {bi}.{ci} seçildi ({en[0]:.3f})', flush=True)
        args, n = [], 0
        for tur, v in girdiler:
            if tur == 's':
                args += ['-f', 'lavfi', '-t', str(v), '-i', 'anullsrc=r=44100:cl=mono']
            else:
                args += ['-i', str(v)]
            n += 1
        (vdir / 'ses').mkdir(exist_ok=True)
        hedef = vdir / 'ses' / 'seslendirme.wav'
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', *args, '-filter_complex', f'concat=n={n}:v=0:a=1,loudnorm=I=-18:TP=-2', '-ar', '44100', str(hedef)], check=True)
    print(f'🎙  {hedef.relative_to(KOK)} hazır')


if __name__ == '__main__':
    main()
