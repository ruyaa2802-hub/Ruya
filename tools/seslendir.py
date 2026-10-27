#!/usr/bin/env python3
"""Seslendirmeyi ücretsiz ve tamamen yerel üretir, videoyla birleştirir.

Ses motoru: Piper (açık kaynak, çevrimdışı)  https://github.com/rhasspy/piper
Türkçe ses: tr_TR-dfki-medium  (https://huggingface.co/rhasspy/piper-voices)

Kurulum (bir kez):
    python3 -m venv .venv && .venv/bin/pip install piper-tts
    mkdir -p sesler && cd sesler
    curl -LO https://huggingface.co/rhasspy/piper-voices/resolve/main/tr/tr_TR/dfki/medium/tr_TR-dfki-medium.onnx
    curl -LO https://huggingface.co/rhasspy/piper-voices/resolve/main/tr/tr_TR/dfki/medium/tr_TR-dfki-medium.onnx.json

Kullanım:
    .venv/bin/python tools/seslendir.py [--srt bolumler/kedi-seslendirme.srt]
        [--video cikti/kedi-portresi.mp4] [--model sesler/tr_TR-dfki-medium.onnx]

Her cümle SRT'deki başlangıç saniyesinde başlar. Cümle kendi aralığına sığmazsa
konuşma hızı yalnızca o cümle için artırılır. Çıktılar:
    cikti/<bolum>-seslendirme.wav   yalnızca ses
    cikti/<bolum>-portresi-sesli.mp4 ses + video
"""
import argparse, json, re, subprocess, sys, tempfile, wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def parse_srt(path):
    def sec(t):
        h, m, s = t.replace(',', '.').split(':')
        return int(h) * 3600 + int(m) * 60 + float(s)
    cues = []
    for block in re.split(r'\n\s*\n', path.read_text(encoding='utf-8').strip()):
        lines = block.strip().splitlines()
        a, b = lines[1].split(' --> ')
        cues.append((sec(a), sec(b), ' '.join(lines[2:]).strip()))
    return cues


def wav_len(p):
    with wave.open(str(p)) as w:
        return w.getnframes() / w.getframerate()


def synth(piper, model, text, out, scale):
    subprocess.run([piper, '-m', str(model), '-f', str(out), '--length-scale', f'{scale:.3f}',
                    '--sentence-silence', '0.15'], input=text.encode('utf-8'), check=True, capture_output=True)
    # baştaki/sondaki sessizliği kırp, böylece süre ölçümü gerçek konuşmayı yansıtır
    trimmed = out.with_suffix('.trim.wav')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(out), '-af',
                    'silenceremove=start_periods=1:start_threshold=-45dB,areverse,'
                    'silenceremove=start_periods=1:start_threshold=-45dB,areverse', str(trimmed)], check=True)
    return trimmed


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--srt', default='bolumler/kedi-seslendirme.srt')
    ap.add_argument('--video', default='cikti/kedi-portresi.mp4')
    ap.add_argument('--model', default='sesler/tr_TR-dfki-medium.onnx')
    ap.add_argument('--piper', default=str(Path(sys.executable).parent / 'piper'))
    ap.add_argument('--hiz', type=float, default=1.0, help='temel konuşma süresi çarpanı (<1 daha hızlı)')
    a = ap.parse_args()
    srt, video, model = ROOT / a.srt, ROOT / a.video, ROOT / a.model
    bolum = srt.stem.split('-')[0]
    out_wav = ROOT / f'cikti/{bolum}-seslendirme.wav'
    out_mp4 = ROOT / f'cikti/{bolum}-portresi-sesli.mp4'
    out_wav.parent.mkdir(exist_ok=True)

    cues = parse_srt(srt)
    tmp = Path(tempfile.mkdtemp(prefix='seslendir-'))
    parts, report = [], []
    for i, (t0, t1, text) in enumerate(cues):
        window = t1 - t0
        scale = a.hiz
        clip = synth(a.piper, model, text, tmp / f'{i}.wav', scale)
        d = wav_len(clip)
        for _ in range(3):  # sığmıyorsa yalnızca bu cümleyi hızlandır
            if d <= window:
                break
            scale = max(0.8, scale * window / d * 0.97)
            clip = synth(a.piper, model, text, tmp / f'{i}.wav', scale)
            d = wav_len(clip)
        parts.append((t0, clip))
        report.append({'cumle': i + 1, 'baslangic': t0, 'bitis': round(t0 + d, 2), 'aralik_sonu': t1,
                       'hiz_carpani': round(scale, 3), 'sigdi': d <= window + 0.05})

    duration = max(c[1] for c in cues) + 0.5
    if video.exists():
        duration = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0',
                                         str(video)], capture_output=True, text=True, check=True).stdout)
    inputs, filters = [], []
    for k, (t0, clip) in enumerate(parts):
        inputs += ['-i', str(clip)]
        ms = int(round(t0 * 1000))
        filters.append(f'[{k}:a]aresample=48000,aformat=channel_layouts=mono,adelay={ms}:all=1[s{k}]')
    mix = ''.join(f'[s{k}]' for k in range(len(parts)))
    filters.append(f'{mix}amix=inputs={len(parts)}:normalize=0,'
                   f'highpass=f=70,acompressor=threshold=-20dB:ratio=3:attack=5:release=120,'
                   f'loudnorm=I=-14:TP=-1.5:LRA=7,apad,atrim=0:{duration:.3f}[out]')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', *inputs, '-filter_complex', ';'.join(filters),
                    '-map', '[out]', '-ar', '48000', str(out_wav)], check=True)
    print(f'Ses hazır: {out_wav.relative_to(ROOT)}')

    if video.exists():
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(video), '-i', str(out_wav),
                        '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
                        '-movflags', '+faststart', '-shortest', str(out_mp4)], check=True)
        print(f'Sesli video hazır: {out_mp4.relative_to(ROOT)}')
    else:
        print(f'Video bulunamadı ({a.video}); önce: node tools/render-video.mjs')
    print(json.dumps(report, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
