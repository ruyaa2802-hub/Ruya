"""Ses miksajı: Piper TTS (ücretsiz, açık kaynak) diyalogları + numpy ile sentezlenen
efektler ve özgün müzik. Çıktı: build/mix.wav ve build/lipsync.json"""
import json
import math
import os
import subprocess
import sys
import numpy as np
from scipy.signal import butter, sosfilt

sys.path.insert(0, os.path.dirname(__file__))
from zaman import FPS, DURATION, LINES, EVENTS

SR = 48000
HERE = os.path.dirname(os.path.abspath(__file__))
AUD = os.path.join(HERE, 'audio')
OUT = os.path.join(HERE, 'build')
os.makedirs(OUT, exist_ok=True)
N = int(DURATION * SR)
rng = np.random.default_rng(3)


def load(path, af):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-af', af, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).copy()


TRIM = 'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse'
VOICE = {
    # Rüzgâr: biraz kalın, kendinden emin
    'R': 'asetrate=22050*0.88,aresample=22050,atempo=1.1364,equalizer=f=180:t=q:w=1:g=3,',
    # Fındık: ince, telaşlı
    'F': 'asetrate=22050*1.36,aresample=22050,atempo=0.7353,equalizer=f=3000:t=q:w=1:g=2,',
}


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], 'bandpass', fs=SR, output='sos'), x)


def lp(x, f, order=2):
    return sosfilt(butter(order, f, 'lowpass', fs=SR, output='sos'), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, 'highpass', fs=SR, output='sos'), x)


def env_adsr(n, a, r):
    e = np.ones(n, np.float32)
    na, nr = int(a * SR), int(r * SR)
    if na:
        e[:na] = np.linspace(0, 1, na)
    if nr:
        e[-nr:] *= np.linspace(1, 0, nr)
    return e


def put(buf, sig, t, gain=1.0):
    i = int(t * SR)
    j = min(len(buf), i + len(sig))
    if j > i:
        buf[i:j] += sig[:j - i] * gain


def reverb(x, mix=0.25, room=0.05):
    out = x.copy()
    for k, (d, g) in enumerate([(0.029, 0.5), (0.037, 0.45), (0.051, 0.4), (0.067, 0.33), (0.089, 0.27), (0.113, 0.2)]):
        dd = int((d + room) * SR)
        y = np.zeros_like(x)
        y[dd:] = x[:-dd] * g
        out += mix * lp(y, 3500 - k * 300)
    return out


def tone(freq, dur, harm=(1, .5, .25), vib=0.0, vib_f=5.0):
    t = np.arange(int(dur * SR)) / SR
    f = freq * (1 + vib * np.sin(2 * math.pi * vib_f * t))
    ph = 2 * math.pi * np.cumsum(f) / SR
    return sum(a * np.sin(ph * (k + 1)) for k, a in enumerate(harm)).astype(np.float32)


def note(n):  # MIDI -> Hz
    return 440 * 2 ** ((n - 69) / 12)


# ------------------------------------------------------------------ diyaloglar
L = np.zeros(N, np.float32)
R = np.zeros(N, np.float32)
voice_tracks = {'R': np.zeros(N, np.float32), 'F': np.zeros(N, np.float32)}
line_times = []
for lid, who, st, _ in LINES:
    af = VOICE[who] + TRIM
    v = load(os.path.join(AUD, f'raw_{lid}.wav'), af)
    v = v / (np.abs(v).max() + 1e-6) * 0.62
    put(voice_tracks[who], v, st)
    line_times.append((lid, who, st, st + len(v) / SR))
dlg = voice_tracks['R'] + voice_tracks['F']
dlg = reverb(dlg, 0.12, 0.01)

# ------------------------------------------------------------------ ortam: okyanus + rüzgâr
t = np.arange(N) / SR
noise = rng.standard_normal(N).astype(np.float32)
ocean = lp(noise, 500) * (0.55 + 0.45 * np.sin(2 * math.pi * 0.23 * t) ** 2)
ocean += 0.4 * bp(rng.standard_normal(N).astype(np.float32), 600, 2400) * (0.3 + 0.7 * np.clip(np.sin(2 * math.pi * 0.31 * t + 1), 0, 1) ** 3)
amb_gain = np.full(N, 0.16, np.float32)
wind = bp(rng.standard_normal(N).astype(np.float32), 300, 1400) * 0.35
wind_g = np.full(N, 0.12, np.float32)
g0 = int(EVENTS['gust'] * SR)
wind_g[g0 - 6000:g0 + int(1.2 * SR)] += np.concatenate([np.linspace(0, 0.9, 6000), np.linspace(0.9, 0, int(1.2 * SR))])
amb = ocean * amb_gain + wind * wind_g
L += amb * (1 + 0.15 * np.sin(2 * math.pi * 0.1 * t))
R += amb * (1 - 0.15 * np.sin(2 * math.pi * 0.1 * t))

# ------------------------------------------------------------------ gemi düdüğü
dur = 2.2
h = tone(note(43), dur, harm=(1, .7, .55, .4, .3, .2, .12), vib=0.004, vib_f=4) + 0.8 * tone(note(46.5), dur, harm=(1, .6, .4, .3, .2))
h = lp(h, 900) * env_adsr(len(h), 0.18, 0.6)
h = reverb(h, 0.6, 0.12)
put(L, h, 0.05, 0.13)
put(R, h, 0.062, 0.13)

# ------------------------------------------------------------------ müzik: özgün romantik tema (pan flüt + pad)
def flute(freq, dur):
    s = tone(freq, dur, harm=(1, .18, .06), vib=0.006, vib_f=5.2)
    br = bp(rng.standard_normal(len(s)).astype(np.float32), freq * 0.8, freq * 3) * 0.12
    return (s + br) * env_adsr(len(s), 0.06, min(0.25, dur * 0.4))


def pad(freqs, dur):
    s = sum(tone(f, dur, harm=(1, .45, .3, .2, .12)) for f in freqs) / len(freqs)
    return lp(s, 1200) * env_adsr(len(s), 0.5, 0.6)


music = np.zeros(N, np.float32)
# çok sessiz giriş padi (S1-S2)
for i, ch in enumerate([[50, 57, 62, 66], [47, 54, 59, 62], [43, 50, 55, 59]]):
    put(music, pad([note(n) for n in ch], 2.6), 0.4 + i * 2.3, 0.08)
mstart = EVENTS['music_in']
beat = 0.42
# (midi, vuruş) - özgün melodi, Re majör
melody = [(74, 1), (76, 1), (78, 2), (81, 1), (79, 1), (78, 2), (76, 1), (74, 1), (71, 2), (74, 1), (76, 3),
          (78, 1), (79, 1), (81, 2), (83, 2), (81, 4)]
tt = mstart + 0.4
for n, b in melody:
    put(music, flute(note(n), b * beat * 1.05), tt, 0.16)
    tt += b * beat
chords = [[50, 57, 62, 66], [47, 54, 59, 62], [43, 50, 55, 59], [45, 52, 57, 61]] * 2
for i, ch in enumerate(chords):
    st = mstart + i * 4 * beat
    put(music, pad([note(n) for n in ch], 4 * beat + 0.4), st, 0.13)
# martı konunca müzik plak cızırtısıyla kesilir
cut = int(EVENTS['land'] * SR)
fade = int(0.08 * SR)
music[cut:cut + fade] *= np.linspace(1, 0, fade)
music[cut + fade:] = 0
scr_t = np.arange(int(0.35 * SR)) / SR
scr = np.sin(2 * math.pi * np.cumsum(900 * (1 - scr_t / 0.35) ** 2 + 120) / SR) * 0.4
scr += bp(rng.standard_normal(len(scr_t)).astype(np.float32), 800, 5000) * 0.5
scr *= np.exp(-scr_t * 6)
put(music, scr.astype(np.float32), EVENTS['land'] - 0.02, 0.22)
music = reverb(music, 0.35, 0.05)
L += music
R += music * 0.95

# ------------------------------------------------------------------ efektler
def sfx_lift():
    n = int(0.35 * SR)
    tt_ = np.arange(n) / SR
    s = np.sin(2 * math.pi * np.cumsum(300 + 900 * tt_ / 0.35) / SR) * np.exp(-tt_ * 6) * 0.5
    s += bp(rng.standard_normal(n).astype(np.float32), 400, 2000) * np.exp(-tt_ * 12) * 0.5
    return s.astype(np.float32)


def sfx_tik():
    n = int(0.5 * SR)
    tt_ = np.arange(n) / SR
    s = (np.sin(2 * math.pi * 2350 * tt_) * 0.7 + np.sin(2 * math.pi * 3710 * tt_) * 0.4) * np.exp(-tt_ * 22)
    s[:200] += rng.standard_normal(200) * np.linspace(1, 0, 200)
    return s.astype(np.float32)


def sfx_creak():
    n = int(0.9 * SR)
    tt_ = np.arange(n) / SR
    f = 60 + 25 * np.sin(2 * math.pi * 1.3 * tt_) + 40 * tt_
    pulses = (np.sin(2 * math.pi * np.cumsum(f) / SR) > 0.92).astype(np.float32)
    s = bp(pulses * 2, 150, 1800) * env_adsr(n, 0.1, 0.3)
    return s.astype(np.float32)


def sfx_crack():
    n = int(1.2 * SR)
    tt_ = np.arange(n) / SR
    s = np.zeros(n, np.float32)
    for k in range(7):
        st = int(rng.uniform(0, 0.25) * SR)
        ln = int(0.05 * SR)
        s[st:st + ln] += rng.standard_normal(ln) * np.exp(-np.arange(ln) / ln * 5)
    s = hp(s, 300) * 0.8
    thud = np.sin(2 * math.pi * 55 * tt_) * np.exp(-tt_ * 4) * 0.9
    gr = lp(rng.standard_normal(n).astype(np.float32), 300) * np.exp(-tt_ * 2) * 1.2
    return (s + thud + gr).astype(np.float32)


def sfx_splash():
    n = int(1.6 * SR)
    tt_ = np.arange(n) / SR
    s = rng.standard_normal(n).astype(np.float32)
    s = lp(s, 4000) * np.exp(-tt_ * 2.5) * (1 - np.exp(-tt_ * 60))
    s += np.sin(2 * math.pi * 70 * tt_) * np.exp(-tt_ * 6) * 0.7
    return s.astype(np.float32)


def sfx_bloop(f=500):
    n = int(0.12 * SR)
    tt_ = np.arange(n) / SR
    return (np.sin(2 * math.pi * np.cumsum(f + 1800 * tt_ / 0.12) / SR) * np.exp(-tt_ * 30)).astype(np.float32)


def sfx_squish():
    n = int(0.3 * SR)
    tt_ = np.arange(n) / SR
    s = bp(rng.standard_normal(n).astype(np.float32), 200, 1200) * np.exp(-tt_ * 10)
    s += np.sin(2 * math.pi * np.cumsum(500 - 900 * tt_) / SR) * np.exp(-tt_ * 9) * 0.4
    return s.astype(np.float32)


def trombone():
    out = []
    for n_, d in [(58, 0.32), (57, 0.32), (56, 0.32), (55, 1.0)]:
        s = tone(note(n_ - 12), d, harm=(1, .8, .7, .5, .35, .2, .1), vib=0.012 if d > 0.5 else 0.002, vib_f=6)
        s = lp(s, 1600) * env_adsr(len(s), 0.03, 0.12 if d < 0.5 else 0.5)
        out.append(s)
    return np.concatenate(out).astype(np.float32)


def sfx_squawk(n_calls=2, base=1100):
    out = []
    for k in range(n_calls):
        d = 0.28 if k < n_calls - 1 else 0.45
        n = int(d * SR)
        tt_ = np.arange(n) / SR
        f = base * (1.25 - 0.45 * tt_ / d) * (1 + 0.04 * np.sin(2 * math.pi * 31 * tt_))
        ph = 2 * math.pi * np.cumsum(f) / SR
        mod = np.sin(ph * 2.01) * 2.4
        s_ = np.sin(ph + mod) * (1 - np.exp(-tt_ * 80)) * np.exp(-tt_ * 2.5)
        s_ = s_ + 0.25 * bp(rng.standard_normal(n).astype(np.float32), 1500, 5000) * np.exp(-tt_ * 6)
        out.append(s_.astype(np.float32))
        out.append(np.zeros(int(0.06 * SR), np.float32))
    return np.concatenate(out)


def sfx_flaps(dur=1.1, rate=7.0):
    n = int(dur * SR)
    tt_ = np.arange(n) / SR
    pulses = np.clip(np.sin(2 * math.pi * rate * tt_), 0, 1) ** 6
    return (bp(rng.standard_normal(n).astype(np.float32), 250, 1500) * pulses * 1.4).astype(np.float32)


def sfx_pop():
    n = int(0.15 * SR)
    tt_ = np.arange(n) / SR
    return (np.sin(2 * math.pi * np.cumsum(300 + 1400 * tt_ / 0.15) / SR) * np.exp(-tt_ * 25)).astype(np.float32)


fx = np.zeros(N, np.float32)
put(fx, sfx_lift(), EVENTS['lift'] + 0.1, 0.35)
put(fx, sfx_squish(), 6.5, 0.22)
put(fx, sfx_flaps(1.15), EVENTS['gull_in'], 0.35)
put(fx, sfx_squish(), EVENTS['land'] - 0.02, 0.4)
put(fx, sfx_squawk(1, 1250), EVENTS['squawk1'] + 0.3, 0.16)
put(fx, sfx_pop(), EVENTS['egg'], 0.4)
put(fx, sfx_squawk(3, 1050), EVENTS['squawk2'], 0.3)
L += fx
R += fx

L += dlg
R += dlg

mix = np.stack([L, R], 1)
mix = np.tanh(mix * 1.15) * 0.92
peak = np.abs(mix).max()
mix = mix / peak * 0.89
import wave
with wave.open(os.path.join(OUT, 'mix.wav'), 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype(np.int16).tobytes())

# ------------------------------------------------------------------ dudak senkronu
lips = {}
spf = SR // FPS
for who, tr in voice_tracks.items():
    env = []
    for f in range(int(DURATION * FPS) + 1):
        seg = tr[f * spf:(f + 1) * spf + spf // 2]
        env.append(float(np.sqrt(np.mean(seg ** 2))) if len(seg) else 0.0)
    env = np.array(env)
    env = np.clip(env / (np.percentile(env[env > 0.01], 90) + 1e-6), 0, 1.2) if (env > 0.01).any() else env
    lips[who] = [round(float(v), 3) for v in env]
json.dump(dict(lips=lips, lines=line_times), open(os.path.join(OUT, 'lipsync.json'), 'w'))
for lt in line_times:
    print(lt[0], lt[1], round(lt[2], 2), round(lt[3], 2))
