# Dogal (vokodersiz) seslendirme zinciri.
# Ham Piper cekimi korunur (perde/zaman bozulmaz); duygu: secilmis cekim + duraklamalar + nefesler,
# gercekcilik: yakin mikrofon sicakligi, hafif sikistirma, "hava" katmani, oda yansimalari.
# Kullanim: python3 natural.py <stil> <ses>   stil: A (normal) | C (korkuyla alcak, fisiltiya yakin)
import numpy as np, soundfile as sf, json, os, sys
from scipy import signal
from scipy.signal import butter, sosfilt, resample_poly

HERE = os.path.dirname(os.path.abspath(__file__))
TK = os.environ.get('TAKES', HERE + '/takes') + '/'
SR = 48000
rng = np.random.default_rng(7)
STYLE = sys.argv[1] if len(sys.argv) > 1 else 'A'
VOICE = sys.argv[2] if len(sys.argv) > 2 else 'fahrettin'
OUT = HERE + f'/tts_{STYLE}_{VOICE}/'
os.makedirs(OUT, exist_ok=True)

def bpf(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], 'bandpass', fs=SR, output='sos'), x)
def hpf(x, f, o=2): return sosfilt(butter(o, f, 'highpass', fs=SR, output='sos'), x)
def lpf(x, f, o=2): return sosfilt(butter(o, f, 'lowpass', fs=SR, output='sos'), x)
def peak(x, f, gain_db, q=0.9):
    A = 10 ** (gain_db / 40); w = 2 * np.pi * f / SR; al = np.sin(w) / (2 * q)
    b = [1 + al * A, -2 * np.cos(w), 1 - al * A]; a = [1 + al / A, -2 * np.cos(w), 1 - al / A]
    return signal.lfilter(np.array(b) / a[0], np.array(a) / a[0], x)

def load(name):
    x, sr = sf.read(TK + name + '.wav'); x = x.astype(np.float64)
    x = resample_poly(x, 320, 147) if sr == 22050 else x
    a = np.nonzero(np.abs(x) > 0.006)[0]
    x = x[max(0, a[0] - 240): a[-1] + 1200]
    f = np.minimum(1, np.arange(len(x)) / 240.0); x *= f * f[::-1]
    return x

def air_layer(x):
    """Ayni cekimden rastgele-faz STFT: konusmaya kilitli nefes/hava (11 kHz ustune de tasir)."""
    f, t, Z = signal.stft(x, SR, nperseg=1024, noverlap=768)
    ph = np.exp(1j * rng.uniform(0, 2 * np.pi, Z.shape))
    _, y = signal.istft(np.abs(Z) * ph, SR, nperseg=1024, noverlap=768)
    y = y[:len(x)]
    env = np.abs(signal.hilbert(lpf(np.abs(x), 40)))
    hiss = hpf(rng.standard_normal(len(x)), 6000) * env  # 11-16 kHz bant genisletme hissi
    return y, hiss

def breath(dur, kind='in', level=0.1, shaky=0.0):
    n = int(dur * SR); t = np.linspace(0, 1, n)
    noise = rng.standard_normal(n)
    if kind == 'in':   # nefes alma: daha parlak, hizli baslar
        y = 0.6 * bpf(noise, 1200, 2600) + 0.4 * bpf(noise, 2800, 6500) + 0.25 * bpf(noise, 500, 1100)
        env = np.sin(np.pi * t ** 0.7) ** 1.2
    else:              # nefes verme: daha karanlik, yavas biter
        y = 0.7 * bpf(noise, 400, 1400) + 0.35 * bpf(noise, 1500, 3200) + 0.1 * bpf(noise, 3500, 6000)
        env = np.sin(np.pi * t ** 1.5) ** 1.1
    if shaky:  # titrek nefes (korku): 7-9 Hz kesik kesik
        env *= 1 - shaky * 0.5 * (0.5 + 0.5 * np.sin(2 * np.pi * 8 * t * dur + 1.3 * np.sin(2 * np.pi * 1.1 * t * dur)))
    y *= env
    return y / (np.max(np.abs(y)) + 1e-9) * level

def chain(x, hush=0.0):
    """Yakin mikrofon: govde (180 Hz), hafif varlik, yumusak sikistirma, cok hafif doygunluk."""
    x = hpf(x, 75)
    x = peak(x, 180, 2.5, 0.8)
    x = peak(x, 3200, -1.5 + 2.0 * hush, 1.0)
    # RMS tabanli yumusak kompresor (yaklasik 3:1, -20 dBFS esik)
    env = np.sqrt(np.maximum(lpf(x ** 2, 20), 0) + 1e-9)
    db = 20 * np.log10(env + 1e-9); over = np.maximum(db - (-20), 0)
    g = 10 ** (-(over * (1 - 1 / 3)) / 20)
    x = x * g
    x = np.tanh(x * 1.3) / 1.3
    return x

def segment(name, air=0.08, hush=0.0, gain=1.0):
    x = load(name); x = x / np.max(np.abs(x))
    w, hiss = air_layer(x)
    if hush > 0:   # korkudan alcak ses: sesli cekirdek kisilir, fisilti katmani one cikar
        y = x * (1 - 0.6 * hush) + hpf(w, 300) * (0.9 * hush) + hiss * 0.02
    else:
        y = x + hpf(w, 3500) * air + hiss * 0.012
    return chain(y, hush) * gain

def pick(voice, chunk):
    """Ayni metnin cekimlerinden: anlasilirlik (Whisper CER) en iyi olanlar icinde ortanca tonlama aralikli
    (asiri aralik genelde perde hatasidir, dusuk aralik tekduzedir)."""
    st = {}
    for f in ('stats.json', 'stats2.json', 'stats_fettah.json'):
        p = TK + f
        if os.path.exists(p): st.update(json.load(open(p)))
    c = [(v['cer'], v['rng'], n) for n, v in st.items() if n.startswith(f'{voice}_{chunk}_') and 'cer' in v]
    best = min(x[0] for x in c); c = sorted([x for x in c if x[0] == best], key=lambda x: x[1])
    return c[len(c) // 2][2]

V = VOICE
H = 1.0 if STYLE == 'C' else 0.0
# (tur, ...): ('v', parca, hush_carpani, kazanc) | ('b', sure, tur, seviye, titrek) | ('p', sure)
LINES = {
    'l1': [('b', 0.40, 'in', 0.09, 0.0), ('v', 'l1', 0.0, 0.95)],
    'l2': [('v', 'l2a', 0.35, 0.8), ('b', 0.45, 'in', 0.10, 0.8), ('v', 'l2b', 0.45, 0.85)],
    'l3': [('v', 'l3a1', 0.7, 0.85), ('p', 0.12), ('v', 'l3a2', 0.7, 0.85), ('b', 0.30, 'in', 0.12, 0.6),
           ('v', 'l3b1', 0.8, 0.8), ('p', 0.16), ('v', 'l3b2', 0.7, 0.9)],
    'l4': [('v', 'l4x', 0.6, 0.85), ('b', 0.5, 'out', 0.07, 0.7)],
}
meta = {}
for line, seq in LINES.items():
    parts, voiced, pos = [], [], 0
    for it in seq:
        if it[0] == 'v':
            take = pick(V, it[1]) if not (V == 'fahrettin' and it[1] == 'l4x') else os.environ.get('L4X', 'fahrettin_l4x_0')
            y = segment(take, hush=H * it[2], gain=it[3]); voiced.append([pos, pos + len(y)])
            meta.setdefault('takes', {})[it[1]] = take
        elif it[0] == 'b':
            y = breath(it[1], it[2], it[3] * (1.3 if STYLE == 'C' else 1.0), it[4])
        else:
            y = np.zeros(int(it[1] * SR))
        parts.append(y); pos += len(y)
    y = np.concatenate(parts); y = y / np.max(np.abs(y)) * 0.9
    sf.write(OUT + f'{line}.wav', y.astype(np.float32), SR, subtype='PCM_16')
    meta[line] = dict(dur=round(len(y) / SR, 3), voiced=[[round(a / SR, 3), round(b / SR, 3)] for a, b in voiced])
json.dump(meta, open(OUT + 'meta.json', 'w'), indent=1, ensure_ascii=False)
print(STYLE, V, {k: v['dur'] for k, v in meta.items() if k != 'takes'}, meta['takes'])
