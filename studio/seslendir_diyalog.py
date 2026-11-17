#!/usr/bin/env python3
"""Çok karakterli, ücretsiz diyalog seslendirmesi + dudak senkronu verisi.

  /root/cbx-venv/bin/python studio/seslendir_diyalog.py <video> [--deneme 3] [--sadece 2,5]

videolar/<video>/senaryo.json içindeki "diyalog" alanını okur:
  "karakterler": { "neco": { "referans": "fettah", "duygu": 0.85, "cfg": 0.3, "tempo": 1.0,
                             "perde": -3, "filtre": "..." }, ... }
  "replikler":   [ { "kim": "neco", "metin": "...", "okunus": "(isteğe bağlı TTS metni)",
                     "once": 0.6, "duygu": 0.9 }, ... ]

Her karakterin ses rengi için önce açık kaynak Piper sesiyle kısa bir referans kaydı üretilir,
Chatterbox Multilingual (MIT) bu rengi klonlayarak doğal tonlamayla konuşur, Whisper her denemeyi
kontrol eder ve en iyisini seçer. Çıktılar:
  ses/seslendirme.wav  — tüm diyalog (replik araları dahil)
  ses/replikler.json   — her replik: kim, metin, start, end (sn) + 30 fps ağız açıklığı zarfı
Ücretli API yok; modeller yerelde çalışır. --sadece ile yalnızca bazı replikler yeniden üretilir
(diğerleri ses/replikler/ önbelleğinden alınır).
"""
import difflib, json, os, re, subprocess, sys, tempfile
from pathlib import Path

os.environ.setdefault('HF_HUB_DISABLE_XET', '1')
import numpy as np
import torch, torchaudio
from faster_whisper import WhisperModel
from chatterbox.mtl_tts import ChatterboxMultilingualTTS

KOK = Path(__file__).resolve().parent.parent
PIPER = Path(os.environ.get('XDG_CACHE_HOME', Path.home() / '.cache')) / 'ruya-piper'
REF_METIN = ('Bak kardeşim, sana bir şey anlatacağım ama sakın kimseye söyleme. '
             'Dün akşam çarşıda dolaşırken eski bir arkadaşıma rastladım, oturduk iki çay içtik, '
             'havadan sudan konuştuk. Sonra eve döndüm, yattım uyudum.')
SR = 44100
FPS = 30


def norm(x):
    return re.sub(r'[^a-zçğıöşü ]', '', x.lower())


def oku(yol, sr=16000):
    a = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', str(yol), '-ac', '1', '-ar', str(sr), '-f', 's16le', '-'], capture_output=True).stdout
    return np.frombuffer(a, dtype=np.int16).astype(np.float32) / 32768


def secenek(ad, v):
    return sys.argv[sys.argv.index(ad) + 1] if ad in sys.argv else v


def referans(ad, ayar, hedef):
    if hedef.exists():
        return hedef
    model = PIPER / f'tr_TR-{ayar["referans"]}-medium.onnx'
    ham = hedef.with_suffix('.ham.wav')
    subprocess.run(['python3', '-m', 'piper', '-m', str(model), '--length-scale', str(ayar.get('refHiz', 1.0)), '-f', str(ham)],
                   input=REF_METIN.encode(), check=True, capture_output=True)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(ham), '-af', ayar.get('refFiltre', 'anull'), '-ar', '24000', '-ac', '1', str(hedef)], check=True)
    ham.unlink()
    return hedef


def zarf(x, sr):
    """30 fps ağız açıklığı (0..1): 80–3000 Hz enerjisi, yumuşatılmış."""
    n = int(len(x) / sr * FPS) + 1
    hop = sr / FPS
    e = np.zeros(n)
    for i in range(n):
        p = x[int(i * hop):int((i + 1) * hop) + int(hop * 0.5)]
        e[i] = np.sqrt(np.mean(p ** 2)) if len(p) else 0
    if e.max() > 0:
        e = e / np.percentile(e[e > 0], 92)
    e = np.clip((e - 0.08) / 0.92, 0, 1) ** 0.7
    # hafif yumuşatma (açılma hızlı, kapanma biraz yavaş)
    y = np.zeros_like(e)
    for i in range(n):
        o = y[i - 1] if i else 0
        y[i] = o + (e[i] - o) * (0.75 if e[i] > o else 0.45)
    return [round(float(v), 3) for v in y]


def main():
    degerler = {sys.argv[i + 1] for i, a in enumerate(sys.argv[:-1]) if a.startswith('--')}
    video = next((a for a in sys.argv[1:] if not a.startswith('--') and a not in degerler), None)
    if not video:
        sys.exit(__doc__)
    deneme = int(secenek('--deneme', 3))
    sadece = {int(v) for v in secenek('--sadece', '').split(',') if v}
    vdir = KOK / 'videolar' / video
    senaryo = json.loads((vdir / 'senaryo.json').read_text(encoding='utf-8'))
    D = senaryo['diyalog']
    sdir = vdir / 'ses'; rdir = sdir / 'replikler'; rdir.mkdir(parents=True, exist_ok=True)
    refs = {k: referans(k, a, rdir / f'ref-{k}.wav') for k, a in D['karakterler'].items()}

    torch.set_num_threads(os.cpu_count() or 4)
    tts = ChatterboxMultilingualTTS.from_pretrained(device='cpu')
    stt = WhisperModel('small', device='cpu', compute_type='int8')
    tohum = [11, 23, 37, 53, 77, 91]
    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        for i, r in enumerate(D['replikler']):
            hedef = rdir / f'{i:02d}.wav'
            if hedef.exists() and (not sadece or i not in sadece):
                continue
            a = {**D['karakterler'][r['kim']], **{k: v for k, v in r.items() if k in ('duygu', 'cfg', 'tempo', 'perde', 'filtre')}}
            metin = r.get('okunus', r['metin'])
            en = None
            for k in range(deneme):
                torch.manual_seed(tohum[k % len(tohum)] + i)
                wav = tts.generate(metin, language_id='tr', audio_prompt_path=str(refs[r['kim']]),
                                   exaggeration=a.get('duygu', 0.5) + (k % 2) * 0.05, cfg_weight=a.get('cfg', 0.5) + (k % 3) * 0.04)
                yol = td / f'{i}_{k}.wav'
                torchaudio.save(str(yol), wav, tts.sr)
                segs = list(stt.transcribe(oku(yol), language='tr', word_timestamps=True)[0])
                yazi = ' '.join(s.text.strip() for s in segs)
                skor = max(difflib.SequenceMatcher(None, norm(yazi), norm(m)).ratio() for m in (metin, r['metin']))
                son = (segs[-1].words[-1].end + 0.22) if segs and segs[-1].words else wav.shape[-1] / tts.sr
                bas = max(0.0, segs[0].words[0].start - 0.08) if segs and segs[0].words else 0.0
                print(f'  {i} [{r["kim"]}] deneme {k}: {skor:.3f}  {yazi}', flush=True)
                if en is None or skor > en[0]:
                    en = (skor, yol, bas, son)
                if skor > 0.97:
                    break
            perde = a.get('perde', 0)
            af = [f'atrim=start={en[2]:.2f}:end={en[3]:.2f}', 'asetpts=N/SR/TB', 'afade=t=in:d=0.03',
                  f'afade=t=out:st={max(0, en[3] - en[2] - 0.1):.2f}:d=0.1']
            if perde:
                af.append(f'rubberband=pitch={2 ** (perde / 12):.4f}:formant=shifted')
            if a.get('tempo', 1.0) != 1.0:
                af.append(f'atempo={a["tempo"]}')
            if a.get('filtre'):
                af.append(a['filtre'])
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(en[1]), '-af', ','.join(af), '-ar', str(SR), '-ac', '1', str(hedef)], check=True)
            print(f'✔ {i} seçildi ({en[0]:.3f})', flush=True)

    # birleştir: replik başına sessizlik + ses, zaman ve ağız zarfı
    t, parcalar, bilgi = 0.0, [], []
    for i, r in enumerate(D['replikler']):
        once = r.get('once', 0.35 if i else 0.0)
        parcalar.append(np.zeros(int(once * SR), dtype=np.float32)); t += once
        x = oku(rdir / f'{i:02d}.wav', SR) * r.get('seviye', D['karakterler'][r['kim']].get('seviye', 1.0))
        bilgi.append({'kim': r['kim'], 'metin': r['metin'], 'start': round(t, 3), 'end': round(t + len(x) / SR, 3), 'agiz': zarf(x, SR)})
        parcalar.append(x); t += len(x) / SR
    parcalar.append(np.zeros(int(0.4 * SR), dtype=np.float32))
    tum = np.concatenate(parcalar)
    ham = sdir / '.birlesik.raw'
    (np.clip(tum, -1, 1) * 32767).astype(np.int16).tofile(ham)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 's16le', '-ar', str(SR), '-ac', '1', '-i', str(ham),
                    '-af', 'loudnorm=I=-17:TP=-2', '-ar', str(SR), str(sdir / 'seslendirme.wav')], check=True)
    ham.unlink()
    (sdir / 'replikler.json').write_text(json.dumps({'replikler': bilgi}, ensure_ascii=False), encoding='utf-8')
    print(f'🎙  {(sdir / "seslendirme.wav").relative_to(KOK)} ({t:.1f} sn) + replikler.json hazır')


if __name__ == '__main__':
    main()
