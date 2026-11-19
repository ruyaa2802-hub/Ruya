"""Ses: Piper TTS anlatım (ücretsiz/açık kaynak) + numpy ile sentezlenen piyano, rüzgâr, adımlar.
Müzik anlatımın altında otomatik kısılır (ducking); çöküş anında bilinçli sessizlik."""
import math
import os
import subprocess
import sys
import wave
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from zaman import DURATION, VO, EV

SR = 48000
N = int(DURATION * SR)
rng = np.random.default_rng(8)


def lp(x, f, o=2):
    return sosfilt(butter(o, f, 'lowpass', fs=SR, output='sos'), x)


def hp(x, f, o=2):
    return sosfilt(butter(o, f, 'highpass', fs=SR, output='sos'), x)


def bp(x, a, b, o=2):
    return sosfilt(butter(o, [a, b], 'bandpass', fs=SR, output='sos'), x)


def put(buf, sig, t, g=1.0):
    i = int(t * SR)
    j = min(len(buf), i + len(sig))
    if j > i > -1:
        buf[i:j] += sig[:j - i] * g


def load_vo(vid):
    af = ('silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,'
          'areverse,asetrate=22050*0.93,aresample=22050,atempo=1.0753,'
          'equalizer=f=140:t=q:w=1:g=3.5,equalizer=f=3200:t=q:w=1.2:g=-2,equalizer=f=7000:t=q:w=1:g=-4,'
          'acompressor=threshold=-20dB:ratio=2.5:attack=8:release=120')
    raw = subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-i', os.path.join(HERE, 'audio', f'raw_{vid}.wav'), '-af', af,
                          '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    v = np.frombuffer(raw, np.float32).copy()
    return v / (np.abs(v).max() + 1e-6)


# ---------------------------------------------------------------- oda yankısı (konvolüsyon)
def make_ir(sec=2.6, damp=2.4, bright=5000):
    n = int(sec * SR)
    t = np.arange(n) / SR
    ir = rng.standard_normal(n).astype(np.float32) * np.exp(-t * damp)
    ir = lp(ir, bright)
    ir[:int(0.012 * SR)] = 0
    return ir / np.sqrt((ir ** 2).sum())


def verb(x, ir, wet):
    y = fftconvolve(x, ir)[:len(x)]
    return x * (1 - wet) + y * wet * 1.6


# ---------------------------------------------------------------- anlatım
voice = np.zeros(N, np.float32)
vo_spans = []
for vid, st in VO:
    v = load_vo(vid)
    put(voice, v, st, 0.72)
    vo_spans.append((st, st + len(v) / SR))
voice = verb(voice, make_ir(1.2, 5.0, 4500), 0.10)


# ---------------------------------------------------------------- piyano (additif, inharmonik, çekiç sesi)
def piano(freq, dur, vel=0.6):
    n = int(dur * SR)
    t = np.arange(n) / SR
    B = 0.0004
    s = np.zeros(n, np.float32)
    for k in range(1, 9):
        fk = freq * k * math.sqrt(1 + B * k * k)
        if fk > SR / 2 - 2000:
            break
        amp = (1.0 / k ** 1.3) * (1 + 0.6 * vel * (k > 2))
        dec = 1.2 + k * 0.9 + freq / 400
        s += amp * np.sin(2 * math.pi * fk * t + rng.uniform(0, 6)) * np.exp(-t * dec)
    # ikinci tel (hafif detune) -> chorus
    s += 0.35 * np.sin(2 * math.pi * freq * 1.0015 * t) * np.exp(-t * (1.0 + freq / 500))
    ham = bp(rng.standard_normal(min(n, 1200)).astype(np.float32), 800, 4000) * np.exp(-np.arange(min(n, 1200)) / 150)
    s[:len(ham)] += 0.15 * ham * vel
    att = min(n, 120)
    s[:att] *= np.linspace(0, 1, att)
    rel = min(n, int(0.25 * SR))
    s[-rel:] *= np.linspace(1, 0, rel)
    return lp(s, 2400 + 3000 * vel) * vel


def hz(m):
    return 440 * 2 ** ((m - 69) / 12)


music = np.zeros(N, np.float32)
# özgün, seyrek, melankolik progresyon (La minör): Am - Fmaj7 - C - G(sus) ...  her akor 3.2 sn
prog = [[45, 52, 57, 60, 64], [41, 48, 57, 60, 64], [48, 55, 60, 64, 67], [43, 50, 55, 59, 62],
        [45, 52, 57, 60, 64], [41, 48, 53, 57, 60], [38, 45, 53, 57, 62], [40, 47, 52, 56, 59]]
melody = {0: [(76, 0.0), (74, 1.6)], 1: [(72, 0.0), (69, 1.6)], 2: [(67, 0.8), (72, 2.0)], 3: [(71, 0.4)],
          4: [(76, 0.0), (79, 1.2), (77, 2.2)], 5: [(76, 0.4), (72, 1.8)], 6: [(74, 0.8)], 7: [(71, 0.0), (68, 1.6)]}
bar = 3.2
t0 = 0.3
silence_a, silence_b = EV['slip'] - 0.2, EV['tear_land'] + 0.6   # çöküş: müzik çekilir
bars = int((DURATION - t0) / bar) + 1
for b in range(bars):
    st = t0 + b * bar
    ch = prog[b % len(prog)]
    if silence_a - 1.0 < st < silence_b:
        continue
    for i, m in enumerate(ch[:3]):  # yavaş arpej
        put(music, piano(hz(m), 3.4, 0.35), st + i * 0.28, 0.5)
    for m in ch[3:]:
        put(music, piano(hz(m), 3.0, 0.3), st + 0.9, 0.35)
    for m, off in melody.get(b % len(prog), []):
        put(music, piano(hz(m), 2.6, 0.45), st + off, 0.42)
# çöküşten sonra tek, uzun nota (gözyaşı) ve finalde açılan akor
put(music, piano(hz(81), 4.0, 0.25), EV['tear_land'], 0.35)
put(music, piano(hz(69), 5.0, 0.3), EV['tear_land'] + 0.02, 0.25)
for i, m in enumerate([57, 64, 69, 72, 76]):
    put(music, piano(hz(m), 5.5, 0.28), EV['text'] - 0.1 + i * 0.32, 0.4)
music = verb(music, make_ir(3.2, 1.8, 3800), 0.45)
# müzik bilinçli sessizlikte kısılır + anlatım altında ducking
gain = np.ones(N, np.float32)
tt = np.arange(N) / SR
sa, sb = int(silence_a * SR), int((silence_b - 0.3) * SR)
gain[sa:sb] = np.linspace(1, 0.08, sb - sa) ** 0.5 * 0 + 0.06
fade = int(0.6 * SR)
gain[sa - fade:sa] = np.linspace(1, 0.06, fade)
for a, b in vo_spans:
    i, j = int((a - 0.15) * SR), int((b + 0.2) * SR)
    gain[max(0, i):j] *= 0.42
gain = lp(gain, 3)  # yumuşak geçişler
music *= gain * 0.55

# ---------------------------------------------------------------- ortam: rüzgâr
wind = bp(rng.standard_normal(N).astype(np.float32), 180, 900) * 0.5 + lp(rng.standard_normal(N).astype(np.float32), 160) * 0.8
wmod = 0.55 + 0.45 * np.sin(2 * math.pi * 0.07 * tt) * np.sin(2 * math.pi * 0.19 * tt + 1)
wg = np.full(N, 0.11, np.float32)
wg[int(13.2 * SR):int(21 * SR)] = 0.14
wg[int(29.6 * SR):] = np.linspace(0.11, 0.07, N - int(29.6 * SR))
wind = wind * wmod * wg
windL = wind * (1 + 0.3 * np.sin(2 * math.pi * 0.05 * tt))
windR = wind * (1 - 0.3 * np.sin(2 * math.pi * 0.05 * tt))


# ---------------------------------------------------------------- adımlar (tozlu zemin)
def step(heavy=1.0):
    n = int(0.22 * SR)
    t = np.arange(n) / SR
    s = lp(rng.standard_normal(n).astype(np.float32), 900) * np.exp(-t * 28) * 0.8
    s += np.sin(2 * math.pi * 70 * t) * np.exp(-t * 30) * 0.6 * heavy
    s += bp(rng.standard_normal(n).astype(np.float32), 2000, 6000) * np.exp(-t * 40) * 0.12
    return s


sfx = np.zeros(N, np.float32)
sys.path.insert(0, os.path.join(HERE, '..', 'engine'))
import film  # noqa: E402  (adım zamanları görüntüyle aynı)
prev = None
for t in np.arange(0.0, 21.0, 1 / 96):
    ph = (film.main_x(t) - 300) / (2 * film.STRIDE)
    k = math.floor(ph * 2)
    if prev is not None and k != prev and film.main_v(t) > 5:
        put(sfx, step(1.0 + 0.4 * (t > 13.3)), t, 0.22 + 0.06 * (t > 13.3))
    prev = k
# arkadaşların hafif adımları
for i in range(10):
    put(sfx, step(0.4), EV['friends_in'] + i * 0.36, 0.07)
for i in range(8):
    put(sfx, step(0.3), EV['handoff'] + 0.3 + i * 0.3, 0.05 * (1 - i / 8))
# kutu kaldırma
put(sfx, step(1.4), EV['lift'] + 0.1, 0.18)
# çatlaklar (S3)
for (tc, fx, near) in film.CONTACTS_S3:
    n = int(0.3 * SR)
    t = np.arange(n) / SR
    c = hp(rng.standard_normal(n).astype(np.float32), 1500) * np.exp(-t * 25) * (rng.uniform(size=n) > 0.7)
    put(sfx, c.astype(np.float32), tc + 0.05, 0.06)
# yükün düşüşü: derin, boğuk gümbürtü + toz
n = int(2.5 * SR)
t = np.arange(n) / SR
thud = np.sin(2 * math.pi * (42 + 20 * np.exp(-t * 8)) * t) * np.exp(-t * 3.0) * 1.0
thud += lp(rng.standard_normal(n).astype(np.float32), 400) * np.exp(-t * 2.2) * 0.8
thud += bp(rng.standard_normal(n).astype(np.float32), 300, 2500) * np.exp(-t * 1.4) * 0.12  # toz
put(sfx, verb(thud.astype(np.float32), make_ir(2.0, 2.5, 2000), 0.3), EV['crash'], 0.55)
# dizlerin çökmesi: kumaş hışırtısı
n = int(1.2 * SR)
t = np.arange(n) / SR
cloth = bp(rng.standard_normal(n).astype(np.float32), 500, 3000) * np.sin(np.pi * t / 1.2) * 0.3
put(sfx, cloth, EV['knees'] + 0.2, 0.25)
put(sfx, step(0.8), EV['sat'] - 0.3, 0.15)
# gözyaşı: küçük, cam gibi damla
n = int(0.6 * SR)
t = np.arange(n) / SR
drop = np.sin(2 * math.pi * (1400 + 900 * np.exp(-t * 30)) * t) * np.exp(-t * 14) * 0.5
put(sfx, verb(drop.astype(np.float32), make_ir(1.5, 3.0, 6000), 0.4), EV['tear_land'], 0.32)
# filiz: neredeyse duyulmaz, yumuşak bir çan
put(sfx, piano(hz(88), 2.5, 0.15), EV['sprout'] + 0.4, 0.12)

L = voice + music + windL + sfx
R = voice + music * 0.96 + windR + sfx
# hafif stereo: müziği biraz genişlet
d = int(0.011 * SR)
R[d:] += music[:-d] * 0.15
L += music * 0.0
mix = np.stack([L, R], 1)
mix = np.tanh(mix * 1.1)
mix = mix / np.abs(mix).max() * 0.9
os.makedirs(os.path.join(HERE, 'build'), exist_ok=True)
with wave.open(os.path.join(HERE, 'build', 'mix.wav'), 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype(np.int16).tobytes())
for v, (a, b) in zip(VO, vo_spans):
    print(v[0], round(a, 2), round(b, 2))
