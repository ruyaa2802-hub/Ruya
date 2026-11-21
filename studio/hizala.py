#!/usr/bin/env python3
"""Seslendirmeyi senaryo metniyle kelime kelime hizalar (yerel Whisper, ücretsiz).

  HF_HUB_OFFLINE=1 /root/cbx-venv/bin/python studio/hizala.py <video>

videolar/<video>/ses/seslendirme.* dosyasını faster-whisper ile kelime zamanlı yazıya döker,
senaryo.json'daki cümlelerle karakter düzeyinde eşler ve ses/hizalama.json yazar:
  { "cumleler": [ { "metin", "start", "end", "kelimeler": [ {"k","start","end"} ] } ] }   (ses zamanı, sn)
zamanlama.mjs bu dosya varsa cümle sınırlarını ve altyazı kelime zamanlarını buradan alır.
"""
import difflib, json, re, subprocess, sys
from pathlib import Path
import numpy as np
from faster_whisper import WhisperModel

KOK = Path(__file__).resolve().parent.parent
HARF = re.compile(r'[a-zçğıöşüâîû0-9]')


def cumleler(m):
    return [c for c in re.split(r'(?<=[.!?…])\s+', ' '.join(m.split())) if c]


def norm_ch(c):
    c = c.lower().replace('i̇', 'i')
    return c if HARF.match(c) else ''


def main():
    video = sys.argv[1]
    vdir = KOK / 'videolar' / video
    ses = next(p for p in (vdir / 'ses').iterdir() if re.match(r'seslendirme\.(mp3|wav|m4a|aac|ogg|flac)$', p.name, re.I))
    sen = json.loads((vdir / 'senaryo.json').read_text(encoding='utf-8'))
    a = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', str(ses), '-ac', '1', '-ar', '16000', '-f', 's16le', '-'], capture_output=True).stdout
    x = np.frombuffer(a, dtype=np.int16).astype(np.float32) / 32768
    model = WhisperModel('small', device='cpu', compute_type='int8')
    segs, _ = model.transcribe(x, language='tr', word_timestamps=True, initial_prompt=' '.join(b['metin'] for b in sen['bolumler'])[:600])
    # whisper karakter dizisi + her karakterin zamanı
    wch, wt = [], []
    for s in segs:
        for w in s.words:
            harfler = [norm_ch(c) for c in w.word if norm_ch(c)]
            n = max(1, len(harfler))
            for i, c in enumerate(harfler):
                wch.append(c); wt.append(w.start + (w.end - w.start) * (i + 0.5) / n)
    # senaryo karakter dizisi (kelime ve cümle indeksli)
    sch, sidx = [], []   # sidx: (cümle, kelime)
    yapi = []
    for b in sen['bolumler']:
        for c in cumleler(b['metin']):
            ks = c.split(' ')
            yapi.append(ks)
            for ki, k in enumerate(ks):
                for ch in k:
                    n = norm_ch(ch)
                    if n:
                        sch.append(n); sidx.append((len(yapi) - 1, ki))
    sm = difflib.SequenceMatcher(None, sch, wch, autojunk=False)
    zaman = [None] * len(sch)
    for blk in sm.get_matching_blocks():
        for i in range(blk.size):
            zaman[blk.a + i] = wt[blk.b + i]
    # eşleşmeyen karakterleri komşulardan doldur
    bilinen = [i for i, z in enumerate(zaman) if z is not None]
    for i in range(len(zaman)):
        if zaman[i] is None:
            sol = max([j for j in bilinen if j < i], default=None); sag = min([j for j in bilinen if j > i], default=None)
            if sol is not None and sag is not None: zaman[i] = zaman[sol] + (zaman[sag] - zaman[sol]) * (i - sol) / (sag - sol)
            else: zaman[i] = zaman[sol if sol is not None else sag]
    out = []
    for ci, ks in enumerate(yapi):
        kel = []
        for ki, k in enumerate(ks):
            z = [zaman[j] for j, (c, w) in enumerate(sidx) if c == ci and w == ki]
            if not z:
                continue
            kel.append({'k': k, 'start': round(min(z) - 0.06, 3), 'end': round(max(z) + 0.08, 3)})
        out.append({'metin': ' '.join(ks), 'start': kel[0]['start'], 'end': kel[-1]['end'], 'kelimeler': kel})
    (vdir / 'ses' / 'hizalama.json').write_text(json.dumps({'cumleler': out}, ensure_ascii=False, indent=1), encoding='utf-8')
    for c in out:
        print(f"{c['start']:6.2f}–{c['end']:6.2f}  {c['metin']}")


if __name__ == '__main__':
    main()
