# KAPI 204 - Bolum 1 : ozgun ses tasarimi (tamamen yerel, numpy/scipy ile sentez)
import numpy as np, json, wave
from scipy import signal
from scipy.signal import fftconvolve, resample_poly, butter, sosfilt

SR = 48000
DUR = 30.0
N = int(SR * DUR)
rng = np.random.default_rng(204)
T = np.arange(N) / SR
import os
OUT = os.path.dirname(os.path.abspath(__file__)) + '/'

def st(): return np.zeros((2, N))

def place(buf, x, t0, gain=1.0, pan=0.0):
    """x: mono (n,) or stereo (2,n)"""
    if x.ndim == 1:
        l = np.cos((pan + 1) * np.pi / 4); r = np.sin((pan + 1) * np.pi / 4)
        x = np.stack([x * l * 1.414, x * r * 1.414])
    i0 = int(t0 * SR)
    if i0 >= N: return
    n = min(x.shape[1], N - i0)
    if i0 < 0:
        x = x[:, -i0:]; n = min(x.shape[1], N); i0 = 0
    buf[:, i0:i0 + n] += x[:, :n] * gain

def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], 'bandpass', fs=SR, output='sos'), x)
def lp(x, f, order=2):
    return sosfilt(butter(order, f, 'lowpass', fs=SR, output='sos'), x)
def hp(x, f, order=2):
    return sosfilt(butter(order, f, 'highpass', fs=SR, output='sos'), x)

def env_keys(keys, n=N, sr=SR):
    """piecewise linear envelope from [(t, v), ...]"""
    ts = np.array([k[0] for k in keys]); vs = np.array([k[1] for k in keys])
    return np.interp(np.arange(n) / sr, ts, vs)

def make_ir(dur, decay, seed, bright=4000, predelay=0.012):
    r = np.random.default_rng(seed)
    n = int(dur * SR); t = np.arange(n) / SR
    out = []
    for c in range(2):
        noise = r.standard_normal(n)
        # karanliklasan kuyruk: iki bant karisimi
        hi = hp(noise, 1500) * np.exp(-t / (decay * 0.35))
        lo = lp(noise, bright) * np.exp(-t / decay)
        ir = lo + 0.5 * hi
        ir = np.concatenate([np.zeros(int(predelay * SR) + c * 37), ir])
        out.append(ir / np.sqrt(np.sum(ir ** 2)))
    L = max(len(o) for o in out)
    return np.stack([np.pad(o, (0, L - len(o))) for o in out])

IR_HALL = make_ir(3.2, 0.9, 1, 3500, 0.03)     # apartman koridoru / merdiven boslugu
IR_ROOM = make_ir(0.9, 0.22, 2, 5000, 0.008)   # kucuk daire odasi
IR_BIG = make_ir(5.0, 1.6, 3, 2500, 0.05)      # sinematik vurus kuyrugu

def reverb(x, ir, wet=0.4, dry=1.0):
    if x.ndim == 1: x = np.stack([x, x])
    y = np.stack([fftconvolve(x[c], ir[c])[: x.shape[1] + ir.shape[1]] for c in range(2)])
    xd = np.pad(x, ((0, 0), (0, y.shape[1] - x.shape[1])))
    return xd * dry + y * wet

def adsr(n, a, d, sr=SR):
    t = np.arange(n) / sr
    return np.minimum(t / max(a, 1e-4), 1.0) * np.exp(-np.maximum(t - a, 0) / d)

def tone(f, dur, phase=0):
    t = np.arange(int(dur * SR)) / SR
    return np.sin(2 * np.pi * f * t + phase)

# ------------------------------------------------------------------ busses
sfx = st(); mus = st(); dlg = st(); amb = st()

# ---------------------------------------------------------------- KAPI ZILI
def bell(f0, dur=3.0):
    n = int(dur * SR); t = np.arange(n) / SR
    parts = [(0.5, 0.5, 2.2), (1.0, 1.0, 1.6), (1.19, 0.35, 1.0), (1.56, 0.25, 0.8),
             (2.0, 0.45, 0.7), (2.76, 0.18, 0.4), (3.4, 0.1, 0.25), (4.1, 0.06, 0.18)]
    x = np.zeros(n)
    for r, a, d in parts:
        x += a * np.sin(2 * np.pi * f0 * r * t * (1 + 0.0007 * np.sin(2 * np.pi * 5 * t))) * np.exp(-t / d)
    x *= np.minimum(t / 0.004, 1)
    click = hp(rng.standard_normal(n), 2000) * np.exp(-t / 0.006) * 0.3
    return (x + click) / 2.2

# derin, hafif detune edilmis iki tonlu zil (ding-dong) + uzun koridor yankisi
db = st()
place(db, bell(392.0 * 0.985), 0.30, 0.9, -0.1)
place(db, bell(311.1 * 0.985), 0.88, 0.95, 0.1)
db = reverb(db, IR_HALL, wet=0.75, dry=0.8)[:, :N]
sfx += db * 0.9

# --------------------------------------------------- floresan ugultusu + titreme
# gorselle ayni titreme zamanlari (scene.js FLICKERS ile ayni)
FLICK = [(0.55, 0.05), (0.66, 0.04), (1.95, 0.07), (2.12, 0.03), (4.65, 0.06), (7.1, 0.05)]
hum = np.zeros(N)
for h, a in [(100, 1.0), (200, 0.5), (300, 0.3), (400, 0.12), (1200, 0.04)]:
    hum += a * np.sin(2 * np.pi * h * T + h)
hum += 0.15 * bp(rng.standard_normal(N), 3000, 7000)
hum_env = env_keys([(0, 0), (0.54, 0), (0.56, 1), (5.4, 1), (5.6, 0.55), (8.0, 0.5), (8.02, 0), (30, 0)])
for t0, d in FLICK:
    i0, i1 = int(t0 * SR), int((t0 + d) * SR)
    hum_env[i0:i1] *= 0.1
    # elektrik citirtisi
    n = int(0.03 * SR)
    place(sfx, hp(rng.standard_normal(n), 1800) * adsr(n, 0.001, 0.006), t0, 0.12, 0.3)
    place(sfx, hp(rng.standard_normal(n), 1800) * adsr(n, 0.001, 0.006), t0 + d, 0.10, 0.3)
amb += np.stack([hum, np.roll(hum, 40)]) * hum_env * 0.018

# oda tonu (daire ici) + uzak sehir ugultusu
room = lp(np.cumsum(rng.standard_normal(N)) * 0.002, 400)
room = room - lp(room, 20)
room_env = env_keys([(0, 0.0), (0.6, 0.5), (3.0, 0.6), (8.0, 1.0), (15.8, 1.0), (30, 1.0)])
amb += np.stack([room, np.roll(room, 900)]) * room_env * 0.6

# ------------------------------------------------------------- DUSUK DRONE
drone = (np.sin(2 * np.pi * 36.7 * T) * 0.6 + np.sin(2 * np.pi * 36.95 * T + 1) * 0.5 +
         np.sin(2 * np.pi * 55.0 * T) * 0.35 + np.sin(2 * np.pi * 73.6 * T) * 0.18)
drone *= 0.75 + 0.25 * np.sin(2 * np.pi * 0.13 * T)
rumble = lp(rng.standard_normal(N), 110, 4) * 3.0
drone_env = env_keys([(0, 0), (0.5, 0), (1.2, 0.45), (3.0, 0.55), (3.5, 0.75), (8.0, 0.8), (9.2, 0.9),
                      (12.2, 1.0), (15.7, 1.0), (15.85, 0.18), (18.2, 0.3), (20.2, 0.22), (22.0, 0.3),
                      (24.0, 0.6), (27.9, 0.85), (28.05, 1.1), (30, 0.9)])
drone_m = (drone + rumble) * drone_env
mus += np.stack([drone_m, np.roll(drone_m, 120)]) * 0.16

# ------------------------------------------------------- GERILIM PAD (muzik)
def saw_pad(freqs, detune=0.004):
    x = np.zeros(N)
    for f in freqs:
        for d in (-detune, 0, detune):
            ph = rng.uniform(0, 1)
            x += (((T * f * (1 + d) + ph) % 1.0) * 2 - 1)
    return x / (len(freqs) * 3)

pad = saw_pad([73.42, 110.0, 146.83, 155.56, 174.61])   # D2 A2 D3 Eb3 F3 : kucuk-ikili gerilimi
# yavasca acilan filtre (blok bazli)
pad_f = np.zeros(N)
cut = env_keys([(0, 250), (8.0, 300), (11.5, 900), (12.3, 1500), (15.7, 1200), (15.8, 300), (22, 300), (27.8, 1300), (28.05, 2400), (30, 1600)])
blk = 2400
zi = None
for i in range(0, N, blk):
    sos = butter(2, cut[i], 'lowpass', fs=SR, output='sos')
    if zi is None: zi = signal.sosfilt_zi(sos) * 0
    pad_f[i:i + blk], zi = sosfilt(sos, pad[i:i + blk], zi=zi)
pad_env = env_keys([(0, 0), (3.0, 0), (4.5, 0.25), (8.4, 0.3), (9.3, 0.5), (12.2, 0.85), (15.72, 0.85),
                    (15.82, 0.0), (17.5, 0.0), (19.0, 0.12), (20.2, 0.06), (22.0, 0.1), (24.5, 0.35),
                    (27.95, 0.6), (28.05, 1.0), (30, 0.8)])
pad_s = np.stack([pad_f, np.roll(pad_f, 300)]) * pad_env
mus += pad_s * 0.5

# yuksek "keman armonigi" gerilimi (iki yakin frekans -> vurus)
vib = 1 + 0.004 * np.sin(2 * np.pi * 5.2 * T)
strings = (np.sin(2 * np.pi * 1244.5 * T * vib) + 0.8 * np.sin(2 * np.pi * 1318.5 * T * vib + 0.4) +
           0.3 * np.sin(2 * np.pi * 622.25 * T * vib))
str_env = env_keys([(0, 0), (9.0, 0), (12.15, 0.5), (12.3, 0.25), (15.72, 0.35), (15.8, 0), (24.0, 0),
                    (27.98, 0.55), (28.05, 0), (28.3, 0.25), (30, 0.4)]) ** 1.5
mus += np.stack([strings, np.roll(strings, 200)]) * str_env * 0.035

# kalp atisi (22-28 sn) hizlanan
hb = np.zeros(N)
t = 22.3; bpm = 68
while t < 27.9:
    for off, a in ((0, 1.0), (0.17, 0.6)):
        n = int(0.25 * SR); tt = np.arange(n) / SR
        k = np.sin(2 * np.pi * (52 - 20 * tt) * tt) * np.exp(-tt / 0.07) * a
        i0 = int((t + off) * SR); hb[i0:i0 + n] += k[: max(0, min(n, N - i0))]
    t += 60 / bpm; bpm = min(bpm + 6, 115)
mus += np.stack([hb, hb]) * 0.35

# --------------------------------------------------------------- SFX
def creak(dur, f_res=(480, 1150, 2350), rate=(28, 70), seed=0, amp_shape=None):
    r = np.random.default_rng(seed)
    n = int(dur * SR); t = np.arange(n) / SR
    rate_c = rate[0] + (rate[1] - rate[0]) * (0.5 + 0.5 * np.sin(2 * np.pi * t / dur * 1.3 + 0.5))
    rate_c *= 1 + 0.25 * lp(r.standard_normal(n), 6) * 8
    ph = np.cumsum(np.abs(rate_c)) / SR
    imp = np.zeros(n)
    idx = np.nonzero(np.diff(np.floor(ph)) > 0)[0]
    imp[idx] = r.uniform(0.5, 1.0, len(idx))
    y = np.zeros(n)
    for f in f_res:
        b, a = signal.iirpeak(f * r.uniform(0.95, 1.05), 18, fs=SR)
        y += signal.lfilter(b, a, imp)
    y += 0.15 * bp(r.standard_normal(n), 900, 4000) * (0.3 + 0.7 * np.abs(lp(r.standard_normal(n), 10)) * 6)
    e = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 0.6 if amp_shape is None else amp_shape(t / dur)
    return y * e / (np.max(np.abs(y)) + 1e-9)

def thud(dur=0.4, f=85, seed=0, bright=0.2):
    r = np.random.default_rng(seed)
    n = int(dur * SR); t = np.arange(n) / SR
    return (np.sin(2 * np.pi * f * t * (1 - 0.3 * t)) * np.exp(-t / 0.06) +
            bright * bp(r.standard_normal(n), 300, 3000) * np.exp(-t / 0.015))

def add(a, b):
    L = max(len(a), len(b)); return np.pad(a, (0, L - len(a))) + np.pad(b, (0, L - len(b)))

def click(seed=0, f=(1800, 5000), d=0.01):
    r = np.random.default_rng(seed); n = int(0.08 * SR)
    return bp(r.standard_normal(n), *f) * adsr(n, 0.0005, d)

# Sahne 2 - kilit + kapi acilisi (3.0 - 4.3)
place(sfx, reverb(add(click(1, (900, 4000), 0.012), 0.6 * thud(0.2, 140, 1, 0.5)), IR_HALL, 0.35)[:, :int(1.5 * SR)], 3.02, 0.55)
place(sfx, reverb(creak(1.25, seed=3), IR_HALL, 0.3)[:, :int(3 * SR)], 3.12, 0.22, 0.1)

# Sahne 3 - paket masaya (8.35), kapak acilisi (9.25-10.0), fotograf (11.4)
place(sfx, reverb(thud(0.4, 95, 2, 0.35), IR_ROOM, 0.25), 8.34, 0.55)
n = int(0.75 * SR); tt = np.arange(n) / SR
lid = bp(rng.standard_normal(n), 700, 3200) * np.sin(np.pi * tt / 0.75) ** 2 * (0.6 + 0.4 * np.sin(2 * np.pi * 9 * tt))
place(sfx, reverb(lid * 0.5 + 0.5 * np.pad(thud(0.2, 120, 3, 0.2), (0, n))[:n], IR_ROOM, 0.25), 9.25, 0.35)
place(sfx, reverb(thud(0.3, 110, 9, 0.4), IR_ROOM, 0.3), 10.05, 0.25)   # kapak masaya
n = int(0.5 * SR); tt = np.arange(n) / SR
rustle = hp(rng.standard_normal(n), 2500) * (np.abs(lp(rng.standard_normal(n), 25)) * 8) * np.exp(-tt / 0.2)
place(sfx, reverb(rustle, IR_ROOM, 0.2), 11.35, 0.25, 0.15)

# Fotograf gerilim vurusu (12.2): ters yanki sisirmesi + derin vurus + metalik tini
def impact(seed, boom_f=(70, 34), dur=3.0, metal=True, noise=0.5):
    r = np.random.default_rng(seed)
    n = int(dur * SR); t = np.arange(n) / SR
    f = boom_f[1] + (boom_f[0] - boom_f[1]) * np.exp(-t / 0.25)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.9)
    x = boom * 1.0 + noise * lp(r.standard_normal(n), 1800) * np.exp(-t / 0.08)
    if metal:
        for k, a, d in [(1, 0.25, 1.4), (2.76, 0.18, 1.0), (5.40, 0.10, 0.6), (8.93, 0.05, 0.4)]:
            x += a * np.sin(2 * np.pi * 196 * k * t) * np.exp(-t / d)
    return x

def reverse_swell(dur, seed):
    r = np.random.default_rng(seed); n = int(dur * SR); t = np.arange(n) / SR
    x = bp(r.standard_normal(n), 400, 6000) * (t / dur) ** 3
    return reverb(x, IR_BIG, 0.5)[:, :n]

place(sfx, reverse_swell(0.6, 5), 12.2 - 0.6, 0.35)
place(sfx, reverb(impact(6), IR_BIG, 0.45)[:, :int(4.5 * SR)], 12.2, 0.55)

# Sahne 4 - fotograf cevrilir (15.55) : kagit "fip"
n = int(0.18 * SR); tt = np.arange(n) / SR
flip = hp(rng.standard_normal(n), 1500) * np.sin(np.pi * tt / 0.18) ** 3
place(sfx, reverb(flip, IR_ROOM, 0.2), 15.55, 0.35)
# "BU GECE YALNIZ DEGILSIN" belirdigi an: muzik kesilir, sadece alcak bir "nefes" (15.8)
n = int(1.2 * SR); tt = np.arange(n) / SR
suck = lp(rng.standard_normal(n), 600) * np.exp(-tt / 0.4) * np.minimum(tt / 0.02, 1)
place(sfx, reverb(suck, IR_BIG, 0.4)[:, :int(3 * SR)], 15.78, 0.25)

# Yatak odasi kapisi kendi kendine kapanir (18.5 - 20.15) + yumusak mandal
place(sfx, reverb(creak(1.6, f_res=(360, 880, 1900), rate=(16, 40), seed=11), IR_HALL, 0.5)[:, :int(4 * SR)], 18.5, 0.17, -0.25)
place(sfx, reverb(add(click(12, (700, 3000), 0.02), 0.8 * thud(0.25, 100, 12, 0.3)), IR_HALL, 0.45)[:, :int(3 * SR)], 20.12, 0.4, -0.25)

# Secim kutulari belirirken yumusak "tik" (25.0 ve 25.35)
for i, t0 in enumerate((25.0, 25.35)):
    n = int(0.6 * SR); tt = np.arange(n) / SR
    tick = np.sin(2 * np.pi * (880 if i == 0 else 660) * tt) * np.exp(-tt / 0.12)
    place(sfx, reverb(tick, IR_ROOM, 0.5)[:, :n * 3], t0, 0.05, -0.3 if i == 0 else 0.3)

# FINAL - golge (28.05): ters sisirme + "braam" + derin vurus; 30.0'da sert kesim
place(sfx, reverse_swell(0.9, 30), 28.05 - 0.9, 0.5)
n = int(2.2 * SR); tt = np.arange(n) / SR
braam = np.zeros(n)
for f in (55.0, 58.27, 82.4, 110.0, 116.5):
    braam += (((tt * f) % 1) * 2 - 1)
bsos_env = 300 + 2200 * np.exp(-tt / 0.35)
bout = np.zeros(n); zi = None
for i in range(0, n, blk):
    sos = butter(2, bsos_env[i], 'lowpass', fs=SR, output='sos')
    if zi is None: zi = np.zeros((sos.shape[0], 2))
    bout[i:i + blk], zi = sosfilt(sos, braam[i:i + blk], zi=zi)
bout *= np.minimum(tt / 0.01, 1) * np.exp(-tt / 1.4) / 5
place(sfx, reverb(bout, IR_BIG, 0.4)[:, :n], 28.05, 0.6)
place(sfx, reverb(impact(31, (80, 30), 2.5, metal=True, noise=0.7), IR_BIG, 0.5)[:, :int(2.5 * SR)], 28.05, 0.6)
# golgenin surunme sesi (dusuk, ic karartici)
n = int(1.95 * SR); tt = np.arange(n) / SR
slither = lp(rng.standard_normal(n), 380) * (0.4 + 0.6 * np.abs(lp(rng.standard_normal(n), 4)) * 10) * np.minimum(tt / 0.3, 1)
place(sfx, slither, 28.05, 0.5, -0.1)

# ----------------------------------------------------------------- DIYALOG
def load_tts(name, trim=True):
    with wave.open(f'{OUT}tts/{name}.wav') as w:
        sr = w.getframerate(); x = np.frombuffer(w.readframes(w.getnframes()), np.int16) / 32768.0
    if sr == 22050: x = resample_poly(x, 320, 147)  # 22050 -> 48000
    if trim:  # kafa basi bosluklarini kirp
        a = np.nonzero(np.abs(x) > 0.01)[0]
        x = x[max(a[0] - 200, 0): a[-1] + 2400]
    return x

def voice_fx(x, ir, wet):
    x = hp(x, 70)
    x = x + 0.1 * bp(x, 2500, 5000)         # hafif netlik (zincir natural.py'de)
    x = x * 0.9 / np.max(np.abs(x))
    return reverb(x, ir, wet)

# emo.py ciktilari: nefesler dahil tam replikler; meta.json konusulan (sesli) araliklari verir
LINES = []  # videoda konusma yok (diyalogsuz surum)
timing = {}
mouth_src = np.zeros(N)
for name, t0, sp in LINES:
    x = load_tts(name, trim=False)
    y = voice_fx(x, IR_HALL if sp == 'hall' else IR_ROOM, 0.22 if sp == 'hall' else 0.12)
    place(dlg, y, t0, 0.62)
    # dudak senkronu sadece konusulan bolumlerden (nefesler haric)
    for a, b in META[name]['voiced']:
        i0, i1 = int((t0 + a) * SR), int((t0 + b) * SR)
        seg = x[int(a * SR):int(a * SR) + (i1 - i0)]
        mouth_src[i0:i0 + len(seg)] += seg
    timing[name] = [round(t0 + a, 3) for a, _ in META[name]['voiced']][:1] + [round(t0 + META[name]['voiced'][-1][1], 3)]
    timing[name + '_parts'] = [[round(t0 + a, 3), round(t0 + b, 3)] for a, b in META[name]['voiced']]

# FISILTI: TTS sesinden rastgele-faz STFT ile gercekci insan fisiltisi
def whisperize(x):
    f, t, Z = signal.stft(x, SR, nperseg=1024, noverlap=768)
    mag = np.abs(Z)
    ph = np.exp(1j * rng.uniform(0, 2 * np.pi, mag.shape))
    # fisiltida dusuk frekanslar zayif, nefes bandi guclu
    tilt = np.clip((f / 1200.0), 0.15, 1.6)[:, None]
    _, y = signal.istft(mag * ph * tilt, SR, nperseg=1024, noverlap=768)
    y = lp(hp(y, 350), 9000, 4)
    y += 0.06 * hp(rng.standard_normal(len(y)), 4000) * np.abs(lp(np.abs(y), 30)) * 20
    return y / np.max(np.abs(y))

# fisilti yerine: kapinin arkasinda agir bir adimin dosemeyi gicirdatmasi (20.85) + tok ses (21.3)
place(sfx, reverb(creak(0.55, f_res=(240, 610, 1350), rate=(10, 26), seed=41), IR_HALL, 0.5)[:, :int(2.5 * SR)], 20.85, 0.22, -0.2)
place(sfx, reverb(thud(0.35, 70, 42, 0.15), IR_HALL, 0.55)[:, :int(2.5 * SR)], 21.3, 0.35, -0.2)

# --------------------------------------------------------- DUCKING + MIX
dl_env = np.abs(dlg).max(axis=0)
dl_env = lp(dl_env, 6)
dl_env = np.clip(dl_env / (np.max(dl_env) + 1e-9) * 3, 0, 1)
duck = 1 - 0.65 * dl_env
mus *= duck; amb *= (1 - 0.3 * dl_env)
mix = dlg * 1.0 + sfx * 0.9 + mus * 0.9 + amb * 1.0
# fisilti sirasinda her sey cekilir (ek)
wenv = env_keys([(0, 1), (20.15, 1), (20.3, 0.45), (22.0, 0.45), (22.3, 1), (30, 1)])
mix = dlg + (mix - dlg) * wenv

# yumusak limiter
mix = np.tanh(mix * 1.6) / 1.6
# 0-0.25 sn tam sessizlik (siyah ekran), son 4 ms tiklama onleme (sert kesim hissi korunur)
mix[:, : int(0.25 * SR)] = 0
mix[:, -192:] *= np.linspace(1, 0, 192)
mix = mix / np.max(np.abs(mix)) * 0.89

with wave.open(OUT + 'mix.wav', 'wb') as wf:
    wf.setnchannels(2); wf.setsampwidth(2); wf.setframerate(SR)
    wf.writeframes((mix.T * 32767).astype(np.int16).tobytes())

# ------------------------------------------- dudak senkronu icin agiz zarfi
FPS = 24
hop = SR // FPS
m = np.array([np.sqrt(np.mean(mouth_src[i * hop:(i + 1) * hop] ** 2)) for i in range(int(DUR * FPS))])
m = np.clip(m / (np.percentile(m[m > 0], 90) + 1e-9), 0, 1.2) if (m > 0).any() else m
m = np.convolve(m, [0.25, 0.5, 0.25], 'same')
json.dump({'fps': FPS, 'mouth': [round(float(v), 3) for v in m], 'timing': timing}, open(OUT + 'web/env.json', 'w'))
print('ok', timing)
