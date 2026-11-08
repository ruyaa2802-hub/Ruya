# BEYIN - IC SES: ozgun ses tasarimi ve muzik (numpy/scipy), anlatim yerlestirme, iki miks (seslendirmeli / seslendirmesiz)
import numpy as np, json, os, soundfile as sf
from scipy import signal
from scipy.signal import fftconvolve, butter, sosfilt

HERE = os.path.dirname(os.path.abspath(__file__)) + '/'
SR = 48000; DUR = 30.0; N = int(SR * DUR); T = np.arange(N) / SR
rng = np.random.default_rng(30)
def st(): return np.zeros((2, N))
def place(buf, x, t0, g=1.0, pan=0.0):
    if x.ndim == 1: x = np.stack([x * np.cos((pan + 1) * np.pi / 4), x * np.sin((pan + 1) * np.pi / 4)]) * 1.414
    i0 = int(t0 * SR)
    if i0 < 0: x = x[:, -i0:]; i0 = 0
    n = min(x.shape[1], N - i0)
    if n > 0: buf[:, i0:i0 + n] += x[:, :n] * g
def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], 'bandpass', fs=SR, output='sos'), x)
def lp(x, f, o=2): return sosfilt(butter(o, f, 'lowpass', fs=SR, output='sos'), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, 'highpass', fs=SR, output='sos'), x)
def env(keys, n=N): ts = np.array([k[0] for k in keys]); vs = np.array([k[1] for k in keys]); return np.interp(np.arange(n) / SR, ts, vs)
def ir(dur, decay, seed, bright=6000):
    r = np.random.default_rng(seed); n = int(dur * SR); t = np.arange(n) / SR; out = []
    for c in range(2):
        x = lp(r.standard_normal(n), bright) * np.exp(-t / decay); x = np.concatenate([np.zeros(300 + c * 41), x]); out.append(x / np.sqrt((x ** 2).sum()))
    L = max(len(o) for o in out); return np.stack([np.pad(o, (0, L - len(o))) for o in out])
IR_BIG = ir(4.5, 1.3, 1, 7000); IR_ROOM = ir(0.8, 0.18, 2, 6000); IR_MID = ir(2.2, 0.6, 3, 8000)
def rev(x, R, wet=0.4, dry=1.0):
    if x.ndim == 1: x = np.stack([x, x])
    y = np.stack([fftconvolve(x[c], R[c]) for c in range(2)])
    return np.pad(x, ((0, 0), (0, y.shape[1] - x.shape[1]))) * dry + y * wet
def nt(n): return 440.0 * 2 ** ((n - 69) / 12)   # MIDI -> Hz
def adsr(n, a, d): t = np.arange(n) / SR; return np.minimum(t / max(a, 1e-4), 1) * np.exp(-np.maximum(t - a, 0) / d)

tm = json.load(open(HERE + 'web/env.json'))['timing']
EV = json.load(open(HERE + 'events.json'))
sfx = st(); mus = st(); amb = st()
T_IN, T_EYE, T_BRAIN, T_WALK, T_SCI, T_OUT, T_FL, T_ROOM = 1.08, 1.8, 2.62, 4.0, 10.0, 19.0, 19.55, 20.0

# ---------------------------------------------------------------- 0 sn: gizemli acilis
n = int(3.0 * SR); t = np.arange(n) / SR
sub = np.sin(2 * np.pi * (55 * np.exp(-t * 0.6) + 28) * t) * np.exp(-t / 1.1)
glass = sum(a * np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) * np.exp(-t / d) for f, a, d in [(1318.5, 0.25, 1.6), (1975.5, 0.18, 1.2), (2637, 0.1, 0.9), (987.8, 0.2, 2.0)])
open_ = sub * 0.9 + glass * 0.5 * np.minimum(t / 0.01, 1)
place(sfx, rev(open_, IR_BIG, 0.6), 0.02, 0.55)
# geri sarilmis isiltili yukselme -> 0.9 sn
n = int(0.9 * SR); t = np.arange(n) / SR
swell = hp(rng.standard_normal(n), 3000) * (t / 0.9) ** 3 + 0.3 * np.sin(2 * np.pi * 659 * t) * (t / 0.9) ** 4
place(sfx, rev(swell, IR_MID, 0.4)[:, :n], 0.15, 0.22)

# ---------------------------------------------------------------- gecis: yuze hizla yaklasma + goz bebegi
n = int((T_BRAIN - T_IN) * SR); t = np.arange(n) / SR; k = t / t[-1]
wh = np.zeros(n); x = rng.standard_normal(n); blk = 1200; zi = None
for i in range(0, n, blk):
    f = 300 + 5000 * k[i] ** 2.2
    sos = butter(2, [f * 0.6, min(f * 1.6, 20000)], 'bandpass', fs=SR, output='sos')
    if zi is None: zi = np.zeros((sos.shape[0], 2))
    wh[i:i + blk], zi = sosfilt(sos, x[i:i + blk], zi=zi)
wh *= k ** 2.5 * 3
place(sfx, rev(wh, IR_MID, 0.25)[:, :n], T_IN, 0.28)
# goz bebeginden gecis: guclu "whoosh-boom" + elektrik kivilcimi
n = int(2.5 * SR); t = np.arange(n) / SR
boom = np.sin(2 * np.pi * (90 * np.exp(-t * 5) + 32) * t) * np.exp(-t / 0.6)
zap = hp(rng.standard_normal(n), 2500) * np.exp(-t / 0.05) * (1 + np.sign(np.sin(2 * np.pi * 47 * t))) * 0.5
shim = sum(np.sin(2 * np.pi * f * t) * np.exp(-t / 1.4) for f in (880, 1320, 1760, 2640)) * 0.15
place(sfx, rev(boom * 1.0 + zap * 0.5 + shim, IR_BIG, 0.45), T_BRAIN - 0.02, 0.6)

# ---------------------------------------------------------------- beyin atmosferi (elektronik/atmosferik)
def pad(notes, det=0.006, cut=900):
    x = np.zeros(N)
    for nn in notes:
        for d in (-det, 0, det):
            x += ((T * nt(nn) * (1 + d) + rng.uniform()) % 1.0) * 2 - 1
    x /= len(notes) * 3
    y = np.zeros(N); zi = None
    lfo = cut * (1 + 0.45 * np.sin(2 * np.pi * 0.11 * T))
    for i in range(0, N, 2400):
        sos = butter(2, lfo[i], 'lowpass', fs=SR, output='sos')
        if zi is None: zi = np.zeros((sos.shape[0], 2))
        y[i:i + 2400], zi = sosfilt(sos, x[i:i + 2400], zi=zi)
    return y
padA = pad([45, 52, 59, 60, 67], cut=1100)             # Am(add9) — gizemli
pe = env([(0, 0), (T_BRAIN, 0), (T_BRAIN + 0.3, 0.7), (T_SCI, 0.75), (T_SCI + 2, 0.9), (T_OUT, 1.0), (T_FL, 0.9), (T_ROOM, 0.0), (30, 0)])
mus += np.stack([padA, np.roll(padA, 700)]) * pe * 0.42
air = bp(rng.standard_normal(N), 2000, 9000) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.07 * T))
amb += np.stack([air, np.roll(air, 1500)]) * pe * 0.035
# yumusak arpej (sinus pluck) — sahne 2-3
bpm = 104; step = 60 / bpm / 2; seq = [69, 76, 72, 79, 74, 76, 67, 72]
t0 = T_WALK; i = 0
while t0 < T_OUT:
    n = int(0.6 * SR); tt = np.arange(n) / SR; f = nt(seq[i % len(seq)])
    pl = (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(2 * np.pi * 2 * f * tt)) * np.exp(-tt / 0.22) * np.minimum(tt / 0.004, 1)
    g = 0.05 if t0 < T_SCI else 0.075
    place(mus, rev(pl, IR_MID, 0.5)[:, :int(1.2 * SR)], t0, g, 0.5 * np.sin(i * 0.9))
    t0 += step; i += 1
# sahne 3 bas nabzi
bass = np.sin(2 * np.pi * nt(33) * T) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * (bpm / 60) * T))) ; bass = lp(bass, 200)
mus += np.stack([bass, bass]) * env([(0, 0), (T_SCI, 0), (T_SCI + 1.5, 0.22), (T_OUT, 0.28), (T_FL, 0), (30, 0)])

# noron ateslenmesi: elektrik tiklamasi + kisa titresim (kadrajdakiler, yakinlik ile)
def click(seed, bright):
    r = np.random.default_rng(seed); n = int(0.12 * SR); tt = np.arange(n) / SR
    c = hp(r.standard_normal(n), 2500 + bright * 3000) * np.exp(-tt / 0.006)
    z = np.sin(2 * np.pi * (1800 + bright * 1500) * tt * (1 - 3 * tt)) * np.exp(-tt / 0.03) * 0.4
    return c + z
for j, e in enumerate(EV):
    if not e['vis']: continue
    g = float(np.clip(1.2 / (0.6 + e['d'] * 0.25), 0.05, 0.7))
    place(sfx, rev(click(j, min(1, g)), IR_MID, 0.3)[:, :int(0.6 * SR)], e['t'], g * (0.18 if 10.3 < e['t'] < 18.0 else 0.35), float(np.clip(e['x'], -0.8, 0.8)))
# dalgalar (sahne 3): isiltili yukselis + elektriksel titresim
for wt in (tm['a1'][0] + 1.6, tm['a2'][0] + 0.3, tm['a2'][0] + 1.6):
    n = int(2.2 * SR); tt = np.arange(n) / SR
    sw = sum(np.sin(2 * np.pi * f * tt * (1 + 0.02 * tt)) for f in (1046.5, 1568, 2093)) / 3
    trem = (0.5 + 0.5 * np.sin(2 * np.pi * 18 * tt))
    buzz = bp(np.sign(np.sin(2 * np.pi * 110 * tt)) * 1.0, 300, 3000) * trem
    e_ = np.minimum(tt / 0.15, 1) * np.exp(-tt / 0.7)
    place(sfx, rev((sw * 0.5 + buzz * 0.25) * e_, IR_BIG, 0.5)[:, :int(4 * SR)], wt - 0.05, 0.3)

# konusma balonu "pop"lari (sahne 2) ve dusunce balonlari (final)
def blip(f, seed=0):
    n = int(0.35 * SR); tt = np.arange(n) / SR
    return (np.sin(2 * np.pi * f * tt * (1 + 1.5 * np.exp(-tt / 0.03))) * np.exp(-tt / 0.09)) * np.minimum(tt / 0.003, 1)
for i, bt in enumerate((4.55, 6.45, 8.35)): place(sfx, rev(blip(660 + 110 * i), IR_MID, 0.3)[:, :int(0.8 * SR)], bt, 0.22, 0.3)
th = [T_ROOM + 1.3, T_ROOM + 2.3, tm['f2'][0] + 0.05, tm['f2'][0] + 0.4, tm['f2'][0] + 0.8, tm['f3'][0] + 0.05, tm['f3'][0] + 0.35, tm['f3'][0] + 0.65]
for i, bt in enumerate(th): place(sfx, rev(blip([784, 880, 988, 1047, 1175, 1319, 1175, 1568][i]), IR_ROOM, 0.3)[:, :int(0.8 * SR)], bt, 0.15, (-1) ** i * 0.4)
# final buyuk balon: yumusak isilti
n = int(2.5 * SR); tt = np.arange(n) / SR
ch = sum(np.sin(2 * np.pi * f * tt) * np.exp(-tt / (0.8 + 0.2 * k)) for k, f in enumerate((1568, 2093, 2637, 3136))) * np.minimum(tt / 0.02, 1)
place(sfx, rev(ch, IR_BIG, 0.5)[:, :int(4 * SR)], tm['f4'][0] + 0.45, 0.12)

# ---------------------------------------------------------------- cikis: beynin disina
n = int((T_FL - T_OUT + 0.1) * SR); tt = np.arange(n) / SR; k = tt / tt[-1]
x = rng.standard_normal(n); y = np.zeros(n); zi = None
for i in range(0, n, 1200):
    f = 400 + 7000 * k[i] ** 2
    sos = butter(2, [f * 0.6, min(f * 1.5, 20000)], 'bandpass', fs=SR, output='sos')
    if zi is None: zi = np.zeros((sos.shape[0], 2))
    y[i:i + 1200], zi = sosfilt(sos, x[i:i + 1200], zi=zi)
place(sfx, rev(y * k ** 2 * 3, IR_MID, 0.3)[:, :n], T_OUT, 0.45)
n = int(2.5 * SR); tt = np.arange(n) / SR
soft = np.sin(2 * np.pi * (70 * np.exp(-tt * 4) + 40) * tt) * np.exp(-tt / 0.5) + hp(rng.standard_normal(n), 3000) * np.exp(-tt / 0.08) * 0.3
place(sfx, rev(soft, IR_BIG, 0.5), T_FL, 0.45)

# ---------------------------------------------------------------- final: duygusal ve merak uyandiran muzik
def piano(f, dur, vel=1.0):
    n = int(dur * SR); tt = np.arange(n) / SR; B = 0.0004; x = np.zeros(n)
    for h in range(1, 9):
        fh = f * h * np.sqrt(1 + B * h * h)
        x += (0.8 ** h) * np.sin(2 * np.pi * fh * tt + rng.uniform(0, 6)) * np.exp(-tt * (0.6 + 0.35 * h))
    ham = lp(rng.standard_normal(n), 3000) * np.exp(-tt / 0.004) * 0.1
    return (x + ham) * np.minimum(tt / 0.003, 1) * vel
chords = [(T_ROOM + 0.2, [53, 60, 64, 69]), (T_ROOM + 2.6, [57, 60, 64, 67]), (T_ROOM + 5.0, [50, 57, 62, 65, 69]), (T_ROOM + 7.0, [46, 53, 58, 62, 65]), (T_ROOM + 8.6, [48, 55, 60, 62, 67])]
for c0, notes in chords:
    for j, nn in enumerate(notes):
        place(mus, rev(piano(nt(nn), 4.0, 0.5 if j else 0.65), IR_BIG, 0.35)[:, :int(5 * SR)], c0 + j * 0.035, 0.14, (j - 2) * 0.15)
# ust ezgi
mel = [(T_ROOM + 1.3, 76), (T_ROOM + 1.9, 74), (T_ROOM + 3.4, 72), (T_ROOM + 4.0, 74), (T_ROOM + 5.6, 77), (T_ROOM + 6.4, 76), (T_ROOM + 7.6, 74), (T_ROOM + 9.2, 79)]
for c0, nn in mel: place(mus, rev(piano(nt(nn), 3.0, 0.45), IR_BIG, 0.45)[:, :int(4 * SR)], c0, 0.12, 0.2)
warm = pad([53, 60, 64, 69], det=0.004, cut=1400)
mus += np.stack([warm, np.roll(warm, 600)]) * env([(0, 0), (T_ROOM, 0), (T_ROOM + 1.5, 0.35), (29.4, 0.4), (30, 0.3)]) * 0.5

# ---------------------------------------------------------------- anlatim
VO = {'hook': 0.25, 'sci': 10.35, 'fin': 20.35}
dlg = st()
for k_, t0 in VO.items():
    x, sr = sf.read(HERE + f'tts/{k_}.wav'); assert sr == SR
    place(dlg, rev(x, IR_ROOM, 0.06), t0, 1.0)
# ducking
de = lp(np.abs(dlg).max(axis=0), 5); de = np.clip(de / (de.max() + 1e-9) * 3, 0, 1)
def master(with_voice):
    d = 1 - 0.72 * de if with_voice else 1.0
    m = (mus * d + sfx * (1 - 0.8 * de if with_voice else 1.0) + amb * (1 - 0.5 * de if with_voice else 1.0)) + (dlg if with_voice else 0)
    m = np.tanh(m * 1.4) / 1.4
    m[:, -int(0.25 * SR):] *= np.linspace(1, 0, int(0.25 * SR))
    return m / np.max(np.abs(m)) * 0.89
sf.write(HERE + 'mix.wav', master(True).T, SR, subtype='PCM_16')
sf.write(HERE + 'mix_seslendirmesiz.wav', master(False).T, SR, subtype='PCM_16')
print('ok')
