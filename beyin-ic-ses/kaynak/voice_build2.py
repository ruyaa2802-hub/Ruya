# Akici anlatim (v2): cumleler tek parca, virgul duraklamalari dogal; vokodersiz yakin mikrofon zinciri
# Dogal anlatim zinciri (vokodersiz): ham Piper cekimi + hava katmani + yakin mikrofon EQ + hafif sikistirma
# Dogal (vokodersiz) seslendirme zinciri.
# Ham Piper cekimi korunur (perde/zaman bozulmaz); duygu: secilmis cekim + duraklamalar + nefesler,
# gercekcilik: yakin mikrofon sicakligi, hafif sikistirma, "hava" katmani, oda yansimalari.
# Kullanim: python3 natural.py <stil> <ses>   stil: A (normal) | C (korkuyla alcak, fisiltiya yakin)
import numpy as np, soundfile as sf, json, os, sys
from scipy import signal
from scipy.signal import butter, sosfilt, resample_poly

HERE = os.path.dirname(os.path.abspath(__file__))
TK = os.environ.get('TAKES', HERE + '/takes3') + '/'
SR = 48000
rng = np.random.default_rng(7)
OUT = HERE + '/tts/'
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



def comma_split(y, lo=0.25, hi=0.75):
    """Virguldeki dogal duraklamayi enerji zarfindan bul (saniye)."""
    e = np.sqrt(np.convolve(y ** 2, np.ones(960) / 960, 'same'))
    a, b = int(len(y) * lo), int(len(y) * hi)
    thr = np.percentile(e[a:b], 20)
    low = e[a:b] < thr; best = (0, a)
    i = 0
    while i < len(low):
        if low[i]:
            j = i
            while j < len(low) and low[j]: j += 1
            if j - i > best[0]: best = (j - i, a + i)
            i = j
        else: i += 1
    return (best[1] + best[0] / 2) / SR
SEL = {'hook': [('hk_3', 0.0)], 'sci': [('s1_3', 0.4), ('s2_7', 0.0)], 'fin': [('f1_10', 0.32), ('f2_2', 0.32), ('f3_10', 0.0)]}
meta = {}
for line, seq in SEL.items():
    parts, chunks, pos = [], [], 0
    for take, gap in seq:
        y = segment(take, air=0.025, hush=0.0, gain=1.0)
        chunks.append([take.split('_')[0], pos / SR, (pos + len(y)) / SR, y])
        parts += [y, np.zeros(int(gap * SR))]; pos += len(y) + int(gap * SR)
    y = np.concatenate(parts); y = y / np.max(np.abs(y)) * 0.9
    sf.write(OUT + f'{line}.wav', y.astype(np.float32), SR, subtype='PCM_16')
    # eski anahtar adlariyla zamanlama (sahne ve altyazi bunlari kullanir)
    out = []
    for name, a, b, yy in chunks:
        if name == 'hk': c = comma_split(yy); out += [['h1', a, a + c], ['h2', a + c, b]]
        elif name == 's1': out.append(['a1', a, b])
        elif name == 's2': out.append(['a2', a, b])
        elif name == 'f1': c = comma_split(yy, 0.1, 0.4); out += [['f1a', a, a + c], ['f1b', a + c, b]]
        elif name == 'f2': c = comma_split(yy, 0.3, 0.75); out += [['f2', a, a + c], ['f3', a + c, b]]
        elif name == 'f3': out.append(['f4', a, b])
    meta[line] = dict(dur=round(len(y) / SR, 3), chunks=[[n_, round(a_, 3), round(b_, 3)] for n_, a_, b_ in out])
    print(line, meta[line])
json.dump(meta, open(OUT + 'meta.json', 'w'), indent=1)
START = {'hook': 0.25, 'sci': 10.35, 'fin': 20.05}
tm = {}
for line, st_ in START.items():
    for n_, a_, b_ in meta[line]['chunks']: tm[n_] = [round(st_ + a_, 3), round(st_ + b_, 3)]
envp = HERE + '/web/env.json'; envd = json.load(open(envp)); envd['timing'] = tm; envd['vo_start'] = START
json.dump(envd, open(envp, 'w'), indent=1)
print(tm)
