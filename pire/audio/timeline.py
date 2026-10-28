"""Single source of truth for narration timing.

SPEED: atempo applied to the narration; START: when each sentence begins (s).
Writes scene/subtitles.json and out/altyazi_tr.srt (subtitle text = the script
as written, with "100"; the TTS input spells numbers out).
"""
import json, os, re
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SPEED = 1.12
START = [0.45, 4.85, 8.35, 12.95, 14.65, 16.45, 20.6, 25.55, 27.75, 34.4, 39.5]
SUB = [
    ["Bu küçücük canlı, kendi boyunun", "100 katına ulaşan yüksekliklere sıçrayabilir!"],
    ["Bazı pire türleri yalnızca birkaç milimetre uzunluğundadır."],
    ["Buna rağmen sıçrama yükseklikleri", "kendi boylarının yaklaşık 100 katına ulaşabilir."],
    ["Peki bunu nasıl başarıyor?"],
    ["Kasları enerji biriktirir."],
    ["Piredeki esnek yapılar ve dış iskelet,", "bir yaylı mekanizma gibi çalışır."],
    ["Biriken enerji bir anda serbest kalır", "ve pireyi adeta bir mancınık gibi fırlatır."],
    ["Üstelik pirelerin kanatları yoktur!"],
    ["Bir konakçı üzerinde hareket etmek", "ve başka bir noktaya ulaşmak için", "güçlü sıçrama yeteneklerinden yararlanırlar."],
    ["Milimetrelik bir canlı, kendi boyuna göre", "böylesine büyük bir sıçramayı nasıl yapabiliyor?"],
    ["Doğanın mühendisliği gerçekten şaşırtıcı."],
]


def durations():
    p = os.path.join(HERE, 'clips.json')  # trimmed durations written by make_audio.py
    if os.path.exists(p):
        return [c['dur'] for c in json.load(open(p))]
    return [s['dur'] / SPEED for s in json.load(open(os.path.join(HERE, 'sentences.json')))]


def cues():
    out = []
    for st, d, parts in zip(START, durations(), SUB):
        w = [len(p) for p in parts]
        t = st
        for p, n in zip(parts, w):
            dd = d * n / sum(w)
            out.append({'start': round(t, 3), 'end': round(t + dd, 3), 'text': p})
            t += dd
    return out


def srt_time(x):
    ms = int(round(x * 1000))
    return f'{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}'


if __name__ == '__main__':
    c = cues()
    json.dump(c, open(os.path.join(ROOT, 'scene/subtitles.json'), 'w'), ensure_ascii=False, indent=1)
    os.makedirs(os.path.join(ROOT, 'out'), exist_ok=True)
    with open(os.path.join(ROOT, 'out/altyazi_tr.srt'), 'w') as f:
        for i, x in enumerate(c, 1):
            f.write(f"{i}\n{srt_time(x['start'])} --> {srt_time(x['end'])}\n{x['text']}\n\n")
    for x in c:
        print(f"{x['start']:6.2f} {x['end']:6.2f}  {x['text']}")
