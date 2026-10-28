"""Short, synced Turkish subtitles with highlighted keywords.

The script is split by hand into short chunks; *word* marks a highlighted keyword. Chunk timings come from
the real narration: script words are aligned (difflib) to the faster-whisper word timestamps in words.json.
Writes scene/subtitles.json ({start, end, html}) and out/altyazi_tr.srt.
"""
import difflib, html, json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
N_OFF = 0.25  # narration offset on the video timeline (same as make_audio.py)
CHUNKS = [
    "Deniz altında öyle bir *baba* var ki,", "*doğum yapan* taraf o!", "Evet, evet, yanlış duymadın!",
    "Deniz atlarında *dişi*,", "*yumurtalarını* erkeğin karnındaki", "özel bir *keseye* bırakıyor.",
    "*Baba adayımız* da yumurtaları", "burada *taşıyor*,", "*gelişmelerini* sağlıyor",
    "ve *doğum* zamanı gelince…", "*minik deniz atlarını*", "dünyaya getiriyor!",
    "Ama dur, daha bitmedi!", "Bazı türler tek seferde", "*yüzlerce yavru* doğurabiliyor.",
    "Düşünsene,", "koca bir *aile* bir anda ortaya çıkıyor!",
    "Peki ya *aşk* hayatları?", "Bazı deniz atı türleri,", "*aynı eşle* birden fazla", "üreme döneminde birlikte kalabiliyor.",
    "Hatta birbirlerini *selamlamak* için,", "her gün *dans* eder gibi", "hareketler yapabiliyorlar!",
    "Kısacası deniz altında", "hem *sıra dışı babalar*,", "hem de *romantik danslar* var.",
    "Doğanın *sürprizleri* gerçekten bitmiyor!",
    "Peki sence, *yavrulara* bakma işini", "başka hangi hayvan *babalar* üstleniyor?", "*Yorumlara yaz!*",
]


def norm(w):
    return re.sub(r'[^a-zçğıöşü]', '', w.lower().replace('İ', 'i').replace('I', 'ı'))


words = json.load(open(os.path.join(HERE, 'words.json')))  # [start, end, word]
wn = [norm(w[2]) for w in words]
# script words with their chunk index
sw, sc = [], []
for ci, c in enumerate(CHUNKS):
    for w in c.replace('*', '').split():
        sw.append(norm(w))
        sc.append(ci)
# whisper sometimes glues/splits words ("adayımızda" ↔ "adayımız da"): align on characters
s_str, s_idx = '', []
for i, w in enumerate(sw):
    s_idx += [i] * len(w)
    s_str += w
w_str, w_idx = '', []
for i, w in enumerate(wn):
    w_idx += [i] * len(w)
    w_str += w
sm = difflib.SequenceMatcher(None, s_str, w_str, autojunk=False)
start = [None] * len(sw)
end = [None] * len(sw)
for a, b, n in sm.get_matching_blocks():
    for k in range(n):
        si, wi = s_idx[a + k], w_idx[b + k]
        if start[si] is None:
            start[si] = words[wi][0]
        end[si] = words[wi][1]
# fill gaps by interpolation
known = [i for i, v in enumerate(start) if v is not None]
for i in range(len(sw)):
    if start[i] is None:
        lo = max([k for k in known if k < i], default=known[0])
        hi = min([k for k in known if k > i], default=known[-1])
        f = 0 if hi == lo else (i - lo) / (hi - lo)
        start[i] = start[lo] + f * (start[hi] - start[lo])
        end[i] = start[i] + 0.3
out = []
for ci, c in enumerate(CHUNKS):
    idx = [i for i, x in enumerate(sc) if x == ci]
    t0, t1 = start[idx[0]] + N_OFF, end[idx[-1]] + N_OFF
    h = html.escape(c)
    h = re.sub(r'\*([^*]+)\*', r'<b>\1</b>', h)
    out.append({'start': round(t0, 3), 'end': round(t1, 3), 'html': h, 'text': c.replace('*', '')})
# chunks hand over to each other (no flicker between close chunks)
for a, b in zip(out, out[1:]):
    if b['start'] - a['end'] < 0.35:
        a['end'] = b['start'] - 0.02
json.dump(out, open(os.path.join(ROOT, 'scene/subtitles.json'), 'w'), ensure_ascii=False, indent=1)


def srt_time(x):
    ms = int(round(x * 1000))
    return f'{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}'


os.makedirs(os.path.join(ROOT, 'out'), exist_ok=True)
with open(os.path.join(ROOT, 'out/altyazi_tr.srt'), 'w') as f:
    for i, x in enumerate(out, 1):
        f.write(f"{i}\n{srt_time(x['start'])} --> {srt_time(x['end'])}\n{x['text']}\n\n")
for x in out:
    print(f"{x['start']:6.2f} {x['end']:6.2f}  {x['text']}")
