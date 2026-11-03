"""Müzik + ses efektleri + miksaj (tamamen numpy ile sentezlenir, ücretsiz)."""
import os, math, subprocess, wave
import numpy as np
from scipy.signal import butter, sosfilt, lfilter

from timeline import make_schedule, SPEAKER_TO_CHARS, CHAR_X, DUR

SR = 44100
HERE = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(HERE, "build")
rng = np.random.default_rng(11)


def T(n): return np.arange(n) / SR
def noise(n): return rng.standard_normal(n).astype(np.float32)
def bp(x, lo, hi, order=3): return sosfilt(butter(order, [lo, hi], btype="band", fs=SR, output="sos"), x)
def lp(x, f, order=3): return sosfilt(butter(order, f, btype="low", fs=SR, output="sos"), x)
def hp(x, f, order=3): return sosfilt(butter(order, f, btype="high", fs=SR, output="sos"), x)
def edec(n, tau): return np.exp(-T(n) / tau)
def fade(x, a=0.004, r=0.01):
    n = len(x); na, nr = int(a * SR), int(r * SR)
    g = np.ones(n, np.float32)
    if na: g[:na] = np.linspace(0, 1, na)
    if nr: g[-nr:] = np.linspace(1, 0, nr)
    return x * g


def saw(f_inst):
    ph = np.cumsum(f_inst) / SR
    return (np.mod(ph, 1.0) * 2 - 1).astype(np.float32)


# ---------------------------------------------------------------- SFX
def sfx_creak(dur=0.72):
    n = int(dur * SR); t = T(n)
    f = 170 + 260 * (t / dur) ** 1.7 + 22 * np.sin(2 * np.pi * 11 * t) + 14 * np.sin(2 * np.pi * 29 * t)
    x = saw(f)
    gate = 0.55 + 0.45 * np.sign(np.sin(2 * np.pi * (19 + 9 * t) * t + 2 * np.sin(2 * np.pi * 3 * t)))
    x = bp(x, 520, 1500) * gate * 2.4 + bp(noise(n), 1800, 3600) * 0.10
    env = np.minimum(1, t / 0.08) * (1 - 0.35 * (t / dur) ** 3)
    return fade(x * env, 0.01, 0.06)


def sfx_thud():
    n = int(0.55 * SR); t = T(n)
    f = 52 + 70 * np.exp(-t * 22)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7.5)
    x += lp(noise(n), 500) * np.exp(-t * 34) * 1.4
    x += bp(noise(n), 1800, 4200) * np.exp(-t * 90) * 0.5   # tahta takırtısı
    return x


def sfx_whoosh(dur=0.5, up=True):
    n = int(dur * SR); t = T(n); s = t / dur
    w = noise(n)
    lo, hi = lp(w, 700), bp(w, 1500, 6000)
    mix = (s if up else 1 - s)
    x = lo * (1 - mix) + hi * mix
    return fade(x * np.sin(np.pi * s) ** 2 * 1.6, 0.01, 0.03)


def sfx_boing(f0=220, dur=0.7):
    n = int(dur * SR); t = T(n)
    f = f0 * (1 + 1.4 * np.exp(-t * 9)) * (1 + 0.05 * np.sin(2 * np.pi * 24 * t))
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.3 * np.sin(4 * np.pi * np.cumsum(f) / SR)
    return fade(x * np.exp(-t * 4.2), 0.002, 0.02)


def sfx_clink(f=3200):
    n = int(0.30 * SR); t = T(n)
    x = sum(a * np.sin(2 * np.pi * f * m * t) * np.exp(-t * d)
            for a, m, d in [(1, 1, 18), (0.55, 2.76, 26), (0.3, 5.4, 40)])
    return fade(x.astype(np.float32), 0.0005, 0.02)


def sfx_dong(f=118, dur=1.0):
    n = int(dur * SR); t = T(n)
    x = sum(a * np.sin(2 * np.pi * f * m * t) * np.exp(-t * d)
            for a, m, d in [(1, 1, 4.5), (0.6, 2.01, 6), (0.45, 2.76, 7.5), (0.25, 4.2, 11)])
    x += bp(noise(n), 800, 3000) * np.exp(-t * 60) * 0.3
    return x.astype(np.float32)


def sfx_scratch(dur=0.38):
    n = int(dur * SR); t = T(n); s = t / dur
    f = 2200 - 1900 * s ** 0.7
    x = bp(saw(f), 400, 4500) * 1.6 + bp(noise(n), 1500, 6000) * 0.5
    return fade(x * np.minimum(1, t / 0.01) * (1 - s ** 3), 0.003, 0.03)


def sfx_gasp():
    n = int(0.28 * SR); t = T(n)
    x = bp(noise(n), 900, 3800) * np.sin(np.pi * t / 0.28) ** 1.3
    return fade(x * 1.2, 0.01, 0.03)


def sfx_dun():
    n = int(0.9 * SR); t = T(n)
    x = np.zeros(n, np.float32)
    for f in (98.0, 146.8, 196.0, 247.0):
        x += saw(f * (1 + 0.04 * np.exp(-t * 9)) * np.ones(n))
    x = lp(x, 1100) * np.exp(-t * 3.3) * 0.5
    x += hp(noise(n), 3500) * np.exp(-t * 5.5) * 0.35     # zil
    x += np.sin(2 * np.pi * 55 * t) * np.exp(-t * 6)
    return fade(x, 0.002, 0.05)


def sfx_trombone(notes=((233, 0.28), (220, 0.28), (208, 0.28), (196, 0.95)), gap=0.04):
    out = []
    for i, (f, d) in enumerate(notes):
        n = int(d * SR); t = T(n)
        vib = 1 + (0.02 + 0.03 * (i == len(notes) - 1)) * np.sin(2 * np.pi * 5.5 * t) * (t > 0.12)
        fi = f * vib
        if i == len(notes) - 1:
            fi = fi * (1 - 0.18 * np.clip((t - 0.25) / 0.6, 0, 1))   # son nota aşağı kayar (wah-wah-waaah)
        sw = saw(fi)
        wv = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 2
        x = lp(sw, 650) * (1 - wv) + lp(sw, 1900) * wv
        x = x * np.minimum(1, t / 0.03) * np.minimum(1, (d - t) / 0.05 + 0.0)
        out.append(fade(x * 0.9, 0.01, 0.03))
        out.append(np.zeros(int(gap * SR), np.float32))
    return np.concatenate(out)


def sfx_ding(f=1318.5, dur=1.8):
    n = int(dur * SR); t = T(n)
    x = sum(a * np.sin(2 * np.pi * f * m * t) * np.exp(-t * d)
            for a, m, d in [(1, 1, 2.2), (0.5, 2.0, 3.2), (0.35, 3.01, 4.5), (0.2, 4.15, 6)])
    return x.astype(np.float32)


def sfx_drone(dur=2.2):
    n = int(dur * SR); t = T(n)
    x = np.sin(2 * np.pi * 55 * t) * 0.8 + np.sin(2 * np.pi * 82.4 * t) * 0.4 + lp(noise(n), 300) * 0.15
    x = x * (0.5 + 0.5 * np.sin(2 * np.pi * 3.2 * t)) * np.minimum(1, t / 0.9)
    return fade(x, 0.01, 0.1)


def sfx_fanfare():
    out = np.zeros(int(0.9 * SR), np.float32)
    for i, (f, off, d) in enumerate([(523.3, 0.0, 0.14), (659.3, 0.14, 0.14), (784.0, 0.28, 0.5)]):
        n = int(d * SR); t = T(n)
        x = lp(saw(f * (1 + 0.01 * np.sin(2 * np.pi * 6 * t))), 2600) * np.minimum(1, t / 0.01) * np.exp(-t * (2 if i == 2 else 5))
        out[int(off * SR): int(off * SR) + n] += x * 0.7
    return out


def sfx_pop():
    n = int(0.09 * SR); t = T(n)
    return np.sin(2 * np.pi * np.cumsum(900 * np.exp(-t * 14)) / SR) * np.exp(-t * 40)


# ---------------------------------------------------------------- MÜZİK
def pluck(f, dur=0.5, decay=0.996):
    n = int(dur * SR)
    N = max(2, int(SR / f))
    x = np.zeros(n, np.float32)
    x[:N] = rng.uniform(-1, 1, N)
    a = np.zeros(N + 2, np.float32); a[0] = 1; a[N] = -0.5 * decay; a[N + 1] = -0.5 * decay
    y = lfilter([1.0], a, x)
    return (y * np.minimum(1, (n - np.arange(n)) / (0.04 * SR))).astype(np.float32)


def mallet(f, dur=0.22):
    n = int(dur * SR); t = T(n)
    x = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * f * 3.9 * t) * np.exp(-t * 30)
    return (x * np.exp(-t * 16)).astype(np.float32)


def midi(m): return 440.0 * 2 ** ((m - 69) / 12)


def build_music(total, t_start=0.62, t_end=26.28):
    out = np.zeros(int(total * SR), np.float32)
    bpm = 126
    beat = 60 / bpm
    prog = [(45, (57, 60, 64)), (41, (57, 60, 65)), (43, (59, 62, 67)), (40, (56, 59, 64))]   # Am F G E
    bar = 4 * beat
    t = t_start
    k = 0
    while t < t_end:
        root, tri = prog[k % 4]
        for i in range(8):  # sekizlik bas
            tt = t + i * beat / 2
            if tt >= t_end: break
            nm = root + (0, 0, 7, 0, 12, 0, 7, 0)[i] if i in (0, 2, 4, 6) else None
            if nm is not None and i in (0, 2, 4, 6):
                y = pluck(midi(nm), 0.34)
                idx = int(tt * SR); out[idx: idx + len(y)] += y[: len(out) - idx] * 0.95
        for i in (1, 3, 5, 7):  # ters vuruş akor
            tt = t + i * beat / 2
            if tt >= t_end: break
            for nm in tri:
                y = mallet(midi(nm + 12), 0.2)
                idx = int(tt * SR); out[idx: idx + len(y)] += y[: len(out) - idx] * 0.22
        for i in range(8):  # tahta blok / tıklama
            tt = t + i * beat / 2
            if tt >= t_end: break
            c = bp(noise(int(0.03 * SR)), 1500, 5000) * np.exp(-T(int(0.03 * SR)) * 140)
            idx = int(tt * SR); out[idx: idx + len(c)] += c[: len(out) - idx] * (0.30 if i % 2 else 0.16)
        # her 2 barda sinsi kısa melodi
        if k % 2 == 1:
            for j, nm in enumerate((72, 71, 69, 67)):
                tt = t + (4 + j) * beat / 2 if False else t + 2 * beat + j * beat / 2
                if tt >= t_end: break
                y = mallet(midi(nm), 0.18)
                idx = int(tt * SR); out[idx: idx + len(y)] += y[: len(out) - idx] * 0.28
        t += bar
        k += 1
    # sonda hızlı kesilsin
    ne = int(t_end * SR)
    out[ne - int(0.04 * SR): ne] *= np.linspace(1, 0, int(0.04 * SR))
    out[ne:] = 0
    return out


def smooth_env(x, win=0.06):
    k = int(win * SR)
    return np.convolve(np.abs(x), np.ones(k) / k, mode="same")


def place(buf, x, t, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i < 0 or i >= buf.shape[1]: return
    n = min(len(x), buf.shape[1] - i)
    gl, gr = gain * (1 - max(pan, 0)), gain * (1 + min(pan, 0))
    buf[0, i:i + n] += x[:n] * gl
    buf[1, i:i + n] += x[:n] * gr


def build_audio(st, out_wav):
    total = DUR
    N = int(total * SR)
    voice = np.zeros((2, N), np.float32)
    sfx = np.zeros((2, N), np.float32)
    # --- konuşmalar
    for lid, d in st.items():
        if lid.startswith("_"): continue
        x = np.load(os.path.join(BUILD, f"{lid}.npy"))
        chars = SPEAKER_TO_CHARS[d["spk"]]
        pan = (np.mean([CHAR_X[c] for c in chars]) - 360) / 360 * 0.35 if chars else 0.0
        place(voice, x, d["start"], 1.0, pan)

    S = lambda t, x, g=1.0, p=0.0: place(sfx, x, t, g, p)
    # --- kanca: gıcırtı + kapak çarpması + panik
    S(0.02, sfx_creak(0.62), 0.55)
    S(0.20, sfx_whoosh(0.7, True), 0.35)
    S(0.55, sfx_thud(), 0.95)
    S(0.56, sfx_dun(), 0.35)
    S(0.66, sfx_gasp(), 0.55)
    for tt, f in [(0.62, 3100), (0.67, 4100), (0.72, 2700), (0.78, 3600), (0.84, 3300), (0.91, 4400)]:
        S(tt, sfx_clink(f), 0.28, (f % 7 - 3) / 8)
    S(0.80, sfx_boing(260), 0.45)
    # --- kamera kaydırma "vuş"ları
    for lid in ("L2", "L3", "L4", "L5", "L7", "L9", "L10"):
        S(st[lid]["start"] - 0.22, sfx_whoosh(0.26, lid in ("L3", "L7", "L10")), 0.30)
    S(st["L4"]["start"] + 0.02, sfx_dong(112), 0.30, 0.2)
    S(st["L7"]["start"] + 0.02, sfx_dong(124), 0.26, 0.2)
    # --- gevezelik anındaki porselen şıngırtıları
    for tt in (13.15, 13.38, 13.56, 13.72, 13.95, 14.2, 14.45):
        S(tt, sfx_clink(float(rng.choice([2900, 3300, 3800, 4300]))), 0.20, float(rng.uniform(-0.3, 0.3)))
    S(st["L5"]["start"] + 0.0, sfx_boing(300), 0.30, -0.1)
    # --- ev sahibi sesi öncesi: gerilim "plak çizilmesi"
    S(st["L8"]["start"] - 0.38, sfx_scratch(0.36), 0.5)
    # --- fincan çığlığı, kazan zafer fanfarı
    S(st["L9"]["start"], sfx_boing(340), 0.45)
    S(st["L10"]["start"] - 0.05, sfx_fanfare(), 0.30, 0.3)
    # --- final: komik vuruş (sad trombone) + merak işareti
    tf = st["_end_speech"] + 0.05
    S(tf, sfx_dun(), 0.75)
    S(tf, sfx_dong(98, 1.2), 0.45, 0.2)
    S(tf + 0.32, sfx_trombone(), 0.6)
    S(28.12, sfx_drone(1.95), 0.55)
    S(28.18, sfx_ding(), 0.34)
    S(28.92, sfx_pop(), 0.30)

    # --- müzik + konuşma altında kısma (ducking)
    music = build_music(total, 0.62, st["_end_speech"] + 0.02)
    ve = smooth_env(voice[0] + voice[1], 0.10)
    thr = 0.012
    on = (ve > thr).astype(np.float32)
    k = int(0.28 * SR)
    on = np.maximum.accumulate(on) if False else np.convolve(on, np.ones(k) / k, mode="same")
    duck = 1.0 - 0.72 * np.clip(on * 1.6, 0, 1)
    music_st = np.stack([music * duck * 0.62, music * duck * 0.62])

    mix = voice * 1.0 + sfx * 0.9 + music_st
    mix = np.tanh(mix * 1.15) / np.tanh(1.15)
    pk = np.max(np.abs(mix))
    mix = mix / pk * 0.93
    pcm = (mix.T * 32767).astype(np.int16)
    with wave.open(out_wav, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    return out_wav


if __name__ == "__main__":
    st = make_schedule()
    for k, v in st.items():
        if not k.startswith("_"):
            print(f"{k:4s} {v['spk']:9s} {v['start']:6.2f} -> {v['end']:6.2f}")
    print("konuşma sonu:", round(st["_end_speech"], 2))
    build_audio(st, os.path.join(BUILD, "audio.wav"))
    print("audio ok")
