# Duygulu seslendirme: Piper (CC0 'fahrettin') cekimleri + WORLD vokoder ile duygu isleme.
# Her replik: perde kaydirma, tonlama genisletme, korku titremesi (tremor), nefeslilik,
# cumle sonu egrisi, yavaslatma ve araya konusmacinin kendi ses renginde nefesler.
import numpy as np, pyworld as pw, soundfile as sf, json, os
from scipy.signal import butter, sosfilt

HERE = os.path.dirname(os.path.abspath(__file__))
TK = os.environ.get('TAKES', HERE + '/takes') + '/'
OUT = HERE + '/tts/'
os.makedirs(OUT, exist_ok=True)
FP = 5.0  # WORLD kare araligi (ms)
rng = np.random.default_rng(204)

def load(name):
    x, sr = sf.read(TK + name + '.wav'); x = x.astype(np.float64)
    a = np.nonzero(np.abs(x) > 0.008)[0]
    return x[max(0, a[0] - 80): a[-1] + 400], sr

MEAN_SP = None

def emote(name, shift=0.0, rng_k=1.0, trem_hz=0.0, trem_c=0.0, jitter_c=8.0, breath=0.2,
          stretch=1.0, end_st=0.0, end_frac=0.3, amp_trem=0.0, gain=1.0):
    global MEAN_SP
    x, sr = load(name)
    f0, t = pw.harvest(x, sr, f0_floor=60, f0_ceil=400, frame_period=FP)
    f0 = pw.stonemask(x, f0, t, sr)
    sp = pw.cheaptrick(x, f0, t, sr); ap = pw.d4c(x, f0, t, sr)
    if MEAN_SP is None: MEAN_SP = sp[f0 > 0].mean(axis=0)
    # zaman esnetme (kare tekrari/enterpolasyonu)
    n = len(f0); m = int(round(n * stretch)); idx = np.linspace(0, n - 1, m)
    i0 = np.floor(idx).astype(int); fr = idx - i0; i1 = np.minimum(i0 + 1, n - 1)
    v = f0 > 0
    f0n = np.where(v[i0] & v[i1], f0[i0] * (1 - fr) + f0[i1] * fr, np.where(fr < 0.5, f0[i0], f0[i1]))
    spn = sp[i0] * (1 - fr[:, None]) + sp[i1] * fr[:, None]
    apn = ap[i0] * (1 - fr[:, None]) + ap[i1] * fr[:, None]
    vv = f0n > 0
    tt = np.arange(m) * FP / 1000.0
    # perde: medyan etrafinda genisletme + kaydirma + cumle sonu egrisi + titreme + mikro-titreklik
    med = np.median(f0n[vv])
    st = np.zeros(m); st[vv] = 12 * np.log2(f0n[vv] / med) * rng_k
    st += shift
    if end_st:
        vi = np.nonzero(vv)[0]
        if len(vi):
            a = vi[int(len(vi) * (1 - end_frac))]; b = vi[-1]
            ramp = np.clip((np.arange(m) - a) / max(1, b - a), 0, 1)
            st += end_st * ramp ** 1.5
    if trem_hz:
        ph = 2 * np.pi * trem_hz * tt + 0.6 * np.sin(2 * np.pi * 0.9 * tt)
        st += (trem_c / 100.0) * np.sin(ph)
    jit = np.convolve(rng.standard_normal(m), np.ones(4) / 4, 'same') * (jitter_c / 100.0)
    st += jit
    f0o = np.where(vv, med * 2 ** (st / 12), 0.0)
    # nefeslilik: aperiodikligi ozellikle 1 kHz ustunde yukselt
    freqs = np.linspace(0, sr / 2, apn.shape[1])
    w = np.clip((freqs - 600) / 2500, 0, 1)[None, :] * breath
    apo = np.clip(apn + (1 - apn) * w, 0, 1)
    y = pw.synthesize(f0o, spn, apo, sr, frame_period=FP)
    # genlik titremesi (korku)
    if amp_trem:
        ty = np.arange(len(y)) / sr
        y *= 1 + amp_trem * np.sin(2 * np.pi * trem_hz * ty + 1.0)
    return y * gain, sr

def breath_sound(sr, dur, kind='in', level=0.12, shaky=0.0):
    """Konusmacinin ortalama spektral zarfindan sessiz (gurultu) uyarimla nefes."""
    m = int(dur * 1000 / FP)
    tt = np.linspace(0, 1, m)
    if kind == 'in':
        env = np.sin(np.pi * tt ** 0.8) ** 1.3
        tilt = 1.6
    else:
        env = np.sin(np.pi * tt ** 1.4) ** 1.2
        tilt = 0.8
    if shaky:
        env *= 1 + shaky * np.sign(np.sin(2 * np.pi * 9 * tt * dur)) * 0.5
        env = np.convolve(env, np.ones(6) / 6, 'same')
    freqs = np.linspace(0, sr / 2, MEAN_SP.shape[0])
    shape = (np.clip(freqs / 1800, 0.15, 1.0) ** tilt)
    sp = np.tile(MEAN_SP * shape, (m, 1)) * (env[:, None] ** 2 + 1e-8)
    ap = np.ones_like(sp)
    y = pw.synthesize(np.zeros(m), sp, ap, sr, frame_period=FP)
    sos = butter(2, [250, 7500], 'bandpass', fs=sr, output='sos')
    y = sosfilt(sos, y)
    return y / (np.max(np.abs(y)) + 1e-9) * level

# ------------------------------------------------------------------ replikler
# seq: ('v', cekim, ayarlar) | ('b', sure, tur, seviye, titrek) | ('p', sessizlik)
LINES = {
    # yari uykulu, sasirmis, kisik: "Ben hicbir sey siparis etmedim ki..."
    'l1': [('b', 0.42, 'in', 0.10, 0.0),
           ('v', 'fahrettin_l1_4', dict(shift=-0.6, rng_k=1.15, breath=0.3, stretch=1.04, end_st=-1.8, jitter_c=10, gain=0.9))],
    # donakalmis: "Bu fotograf..." [titrek nefes] "Benim evim."
    'l2': [('v', 'fahrettin_l2a_3', dict(shift=0.0, rng_k=1.1, trem_hz=5.5, trem_c=22, breath=0.5, stretch=1.12, end_st=-1.0, amp_trem=0.06, gain=0.8)),
           ('b', 0.42, 'in', 0.11, 0.7),
           ('v', 'fahrettin_l2b_0', dict(shift=0.8, rng_k=1.2, trem_hz=6.2, trem_c=38, breath=0.45, stretch=1.08, end_st=-2.4, end_frac=0.45, amp_trem=0.1, gain=0.85))],
    # panik, alcak sesle (evde biri var): "Polisi mi... aramaliyim?" [hizli nefes] "Yoksa... o kapiyi mi acmaliyim?"
    'l3': [('v', 'fahrettin_l3a1_1', dict(shift=1.4, rng_k=1.15, trem_hz=7.0, trem_c=30, breath=0.55, stretch=0.98, amp_trem=0.08, gain=0.8)),
           ('p', 0.16),
           ('v', 'fahrettin_l3a2_5', dict(shift=1.6, rng_k=1.2, trem_hz=7.0, trem_c=30, breath=0.55, stretch=0.95, amp_trem=0.08, gain=0.8)),
           ('b', 0.32, 'in', 0.13, 0.5),
           ('v', 'fahrettin_l3b1_11', dict(shift=0.6, rng_k=1.0, trem_hz=6.0, trem_c=25, breath=0.6, stretch=1.0, end_st=-0.8, gain=0.75)),
           ('p', 0.14),
           ('v', 'fahrettin_l3b2_4', dict(shift=2.0, rng_k=1.25, trem_hz=7.2, trem_c=40, breath=0.5, stretch=0.97, amp_trem=0.1, gain=0.85))],
    # kameraya, alcak ve agir: "Karari..." "siz verin." [titrek nefes verme]
    'l4': [('v', 'fahrettin_l4x_1', dict(shift=-1.2, rng_k=1.0, trem_hz=5.0, trem_c=20, breath=0.58, stretch=1.1, end_st=-2.5, end_frac=0.4, gain=0.82)),
           ('b', 0.45, 'out', 0.07, 0.6)],
}

meta = {}
SR = None
for line, seq in LINES.items():
    parts, voiced = [], []
    pos = 0
    for item in seq:
        if item[0] == 'v':
            y, SR = emote(item[1], **item[2]); voiced.append([pos, pos + len(y)])
        elif item[0] == 'b':
            if MEAN_SP is None: emote(LINES['l1'][1][1])  # zarf icin
            y = breath_sound(SR or 22050, item[1], item[2], item[3], item[4])
        else:
            y = np.zeros(int(item[1] * (SR or 22050)))
        parts.append(y); pos += len(y)
    y = np.concatenate(parts)
    y = y / np.max(np.abs(y)) * 0.9
    sf.write(OUT + f'{line}.wav', (y * 32767).astype(np.int16), SR, subtype='PCM_16')
    meta[line] = dict(dur=round(len(y) / SR, 3), voiced=[[round(a / SR, 3), round(b / SR, 3)] for a, b in voiced])
    print(line, meta[line])
json.dump(meta, open(OUT + 'meta.json', 'w'), indent=1)
