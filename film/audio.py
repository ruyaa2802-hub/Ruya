"""Soundtrack for 'Güçlü Görünmek': narration + synthesized felt piano + foley.

Usage: python3 audio.py <voice_dir_with_l1..l5.wav> <out.wav>
"""
import math
import os
import subprocess
import sys

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, fftconvolve, sosfilt

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from timeline import *  # noqa

SR = 44100
N = int(DUR * SR)
rng = np.random.default_rng(7)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], 'bandpass', fs=SR, output='sos'), x)


def lp(x, f, order=2):
    return sosfilt(butter(order, f, 'lowpass', fs=SR, output='sos'), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, 'highpass', fs=SR, output='sos'), x)


def ir(decay=2.2, seed=1, damp=4000):
    r = np.random.default_rng(seed)
    n = int(decay * SR)
    t = np.arange(n) / SR
    out = []
    for ch in range(2):
        nz = r.standard_normal(n) * np.exp(-t * 6.9 / decay)
        nz = lp(nz, damp)
        nz[: int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))
        out.append(nz / np.sqrt(np.sum(nz ** 2)))
    return out


IR_HALL = ir(2.8, 1, 3500)
IR_ROOM = ir(1.2, 2, 5000)


def reverb(st, irs, wet):
    out = np.zeros_like(st)
    for c in range(2):
        out[c] = st[c] * (1 - wet) + fftconvolve(st[c], irs[c])[: st.shape[1]] * wet * 2.2
    return out


def place(buf, sig, t, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i >= buf.shape[1] or i + len(sig) <= 0:
        return
    j = min(buf.shape[1], i + len(sig))
    s = sig[: j - i] * gain
    gl = math.cos((pan + 1) * math.pi / 4)
    gr = math.sin((pan + 1) * math.pi / 4)
    buf[0, i:j] += s * gl * 1.414
    buf[1, i:j] += s * gr * 1.414


# ------------------------------------------------------------- voice
def load_voice(vdir):
    out = np.zeros((2, N))
    env = np.zeros(N)
    for k, (t0, tempo) in enumerate(VO):
        src = os.path.join(vdir, f'l{k + 1}.wav')
        tmp = os.path.join(vdir, f'proc{k + 1}.wav')
        filt = (f'rubberband=pitch=0.93:tempo={tempo}:formant=preserved,aresample={SR},'
                'highpass=f=70,equalizer=f=160:t=q:w=1.0:g=3.5,equalizer=f=2600:t=q:w=1.2:g=2,'
                'equalizer=f=6500:t=q:w=1:g=-3,lowpass=f=10500,'
                'acompressor=threshold=0.12:ratio=3:attack=8:release=180:makeup=1.6')
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', src, '-af', filt, '-ac', '1', tmp], check=True)
        sr, v = wavfile.read(tmp)
        v = v.astype(np.float64) / 32768.0
        v = v / (np.max(np.abs(v)) + 1e-9) * 0.62
        place(out, v, t0, 1.0, 0.0)
        i0 = int(t0 * SR)
        env[i0: i0 + len(v)] = 1.0
        print(f'line {k + 1}: {t0:.2f} -> {t0 + len(v) / SR:.2f}')
    out = reverb(out, IR_ROOM, 0.10)
    return out, env


# ------------------------------------------------------------- felt piano
def mtof(m):
    return 440 * 2 ** ((m - 69) / 12)


def piano_note(m, vel, dur=4.0):
    f = mtof(m)
    n = int((dur + 1.5) * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    B = 0.00035
    for h in range(1, 9):
        fh = f * h * math.sqrt(1 + B * h * h)
        if fh > 9000:
            break
        a = (1 / h ** 1.4) * (vel ** (0.6 + 0.25 * h))
        dec = (0.55 + 0.45 * h) * (f / 260) ** 0.35
        for det in (-0.6, 0.6):
            x += a * 0.5 * np.sin(2 * np.pi * (fh + det * (1 + h * 0.2)) * t + h) * np.exp(-t * dec)
    att = np.minimum(1, t / 0.006)
    rel = np.where(t > dur, np.exp(-(t - dur) * 6), 1.0)
    hammer = lp(rng.standard_normal(n) * np.exp(-t * 90), 1800) * 0.08 * vel
    x = (x * att + hammer) * rel
    return lp(x, 2600 + 1800 * vel) * vel


def chord(notes):
    return notes


def score():
    """Return list of (time, midi, velocity, duration)."""
    ev = []
    # Am  Fmaj7  C  G/B  Am  Fmaj7   (scene 1-3), slow 3.3 s chords
    prog = [(45, [57, 60, 64, 71]), (41, [57, 60, 64, 69]), (48, [55, 60, 64, 67]),
            (47, [55, 59, 62, 67]), (45, [57, 60, 64, 72]), (41, [57, 60, 65, 69])]
    t = 0.3
    L = 3.3
    for i, (bass, up) in enumerate(prog):
        v = 0.30 + 0.05 * (i % 2)
        ev.append((t, bass, v + 0.05, L + 0.5))
        ev.append((t + 0.02, bass + 12, v * 0.6, L))
        for j, nn in enumerate(up[:3]):
            ev.append((t + 0.85 + j * 0.8, nn, v * (0.85 - 0.1 * j), L - 0.8))
        if i in (1, 2, 4):
            ev.append((t + 2.5, up[3] + 12, v * 0.75, 2.2))
        t += L
    # last bar before the stop: a lonely high note that does not resolve
    ev.append((19.2, 76, 0.22, 1.2))
    # after the tear: a single soft note as the plant appears
    ev.append((28.55, 76, 0.28, 3.0))
    ev.append((29.4, 64, 0.22, 3.0))
    # scene 5: Fmaj7 - C - Am - Fmaj9, softer
    prog2 = [(41, [57, 60, 64]), (48, [55, 64, 67]), (45, [57, 60, 64]), (41, [57, 60, 67])]
    t = 30.1
    for i, (bass, up) in enumerate(prog2):
        if t > 37.0:
            break
        ev.append((t, bass, 0.27, 2.4))
        for j, nn in enumerate(up):
            if t + 0.7 + j * 0.65 < 37.2:
                ev.append((t + 0.7 + j * 0.65, nn, 0.22 - 0.03 * j, 1.8))
        t += 1.9 if i < 3 else 2.2
    melody = [(31.2, 74), (33.0, 72), (34.9, 71)]
    for (tm, m) in melody:
        ev.append((tm, m, 0.2, 2.0))
    # final: after a breath of silence, an open chord under the question
    for j, nn in enumerate([41, 53, 60, 64, 67, 72]):
        ev.append((TEXT_IN + 0.05 + j * 0.09, nn, 0.27 - 0.02 * j, 2.6))
    return ev


def music():
    buf = np.zeros((2, N))
    for (t, m, v, d) in score():
        pan = (m - 60) / 40
        place(buf, piano_note(m, v, d), t, 1.0, pan)
    buf = reverb(buf, IR_HALL, 0.38)
    return buf


# ------------------------------------------------------------- foley
def noise(n):
    return rng.standard_normal(n)


def envexp(n, k):
    return np.exp(-np.arange(n) / SR * k)


def footstep(vel, heavy=True):
    n = int(0.22 * SR)
    crunch = bp(noise(n), 250, 2600) * envexp(n, 26) * (np.minimum(1, np.arange(n) / (0.01 * SR)))
    # sand grains: sparse clicks
    gr = np.zeros(n)
    idx = rng.integers(0, int(0.12 * SR), 40)
    gr[idx] = rng.uniform(-1, 1, 40)
    gr = bp(gr, 1500, 6000) * 0.5
    t = np.arange(n) / SR
    thump = np.sin(2 * np.pi * 70 * t) * np.exp(-t * 28) * (1.4 if heavy else 0.4)
    return (crunch * 0.6 + gr + thump) * vel


def crackle(dur, dens=120, gain=1.0):
    n = int(dur * SR)
    x = np.zeros(n)
    k = int(dens * dur)
    idx = np.sort(rng.integers(0, n, k))
    amp = rng.uniform(0.2, 1, k) * np.linspace(1, 0.3, k)
    x[idx] = amp * rng.choice([-1, 1], k)
    x = bp(x, 900, 7000) + lp(x, 400) * 0.6
    return x * gain


def rustle(dur, gain=1.0, lo=500, hi=4000):
    n = int(dur * SR)
    e = np.sin(np.linspace(0, np.pi, n)) ** 1.5
    return bp(noise(n), lo, hi) * e * gain


def tick():
    n = int(0.05 * SR)
    t = np.arange(n) / SR
    return (np.sin(2 * np.pi * 3100 * t) * 0.6 + bp(noise(n), 2000, 6000) * 0.5) * np.exp(-t * 160)


def boom():
    n = int(3.0 * SR)
    t = np.arange(n) / SR
    f = 30 + 32 * np.exp(-t * 3)
    ph = 2 * np.pi * np.cumsum(f) / SR
    low = np.sin(ph) * np.exp(-t * 1.6)
    hit = lp(noise(n), 900) * np.exp(-t * 9) * 0.9
    debris = bp(noise(n), 1500, 7000) * np.exp(-t * 1.4) * 0.12 * np.minimum(1, t / 0.05)
    return low * 1.3 + hit + debris


def ting(f=2150):
    n = int(1.5 * SR)
    t = np.arange(n) / SR
    x = sum(np.sin(2 * np.pi * f * r * t) / (i + 1) * np.exp(-t * (5 + i * 3)) for i, r in enumerate([1, 2.76, 5.4]))
    return x * 0.5


def wood():
    n = int(0.25 * SR)
    t = np.arange(n) / SR
    return (bp(noise(n), 300, 1800) * np.exp(-t * 40) + np.sin(2 * np.pi * 210 * t) * np.exp(-t * 30)) * 0.7


def plink():
    n = int(2.0 * SR)
    t = np.arange(n) / SR
    f = 1500 * (1 + 0.25 * np.exp(-t * 40))
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 14) * 0.9 + np.sin(ph * 2.01) * np.exp(-t * 30) * 0.2


def wind():
    n = N
    t = np.arange(n) / SR
    out = np.zeros((2, n))
    for c in range(2):
        x = noise(n)
        body = bp(x, 180, 900, 2)
        hi = bp(noise(n), 900, 3200, 2) * 0.35
        lfo = 0.55 + 0.25 * np.sin(2 * np.pi * t / 7.3 + c) + 0.2 * np.sin(2 * np.pi * t / 2.9 + 2 * c)
        gust = 0.5 + 0.5 * np.sin(2 * np.pi * t / 11 + 1.3) ** 2
        out[c] = (body + hi * gust) * lfo
        out[c] += lp(noise(n), 120) * 0.8
    level = np.interp(t, [0, 1.0, 6.6, 8, 12.8, 20.2, 21, 26, 28.8, 34, 38.5, 40],
                      [0.0, 0.55, 0.5, 0.3, 0.32, 0.42, 0.6, 0.55, 0.4, 0.22, 0.15, 0.0])
    return out * level * 0.14


def foley():
    import film  # for cracks; heavy imports are fine here
    buf = np.zeros((2, N))
    for (t, v) in footsteps():
        place(buf, footstep(0.35 + 0.35 * v), t + 0.02, 0.55, -0.05)
    # passers-by: light quick steps
    for t in np.arange(6.05, 7.9, 0.31):
        place(buf, footstep(0.25, heavy=False), t, 0.35, 0.45)
    for t in np.arange(10.15, 11.6, 0.27):
        place(buf, footstep(0.22 * (1 - (t - 10.1) / 1.8), heavy=False), t, 0.35, 0.55)
    place(buf, footstep(0.4, heavy=False), 10.12, 0.4, 0.4)  # hop landing
    place(buf, rustle(0.35, 0.25, 1200, 5000), 3.65, 1, 0)   # stumble scrape
    place(buf, rustle(0.6, 0.12), 7.0, 1, 0)                 # straightening up
    place(buf, rustle(0.9, 0.16, 300, 2500), 8.8, 1, 0.2)    # lifting the sack
    place(buf, rustle(0.8, 0.12), 11.8, 1, 0)                # bending again
    # cracks
    for c in film.make_cracks():
        g = 0.5 if c['big'] else 0.28
        place(buf, crackle(c['dur'] + 0.15, 90, 1.0), c['t0'], g, 0.0)
    # objects appearing: soft paper/air swishes
    for k, t in enumerate(OBJ_TIMES):
        place(buf, rustle(0.5, 0.08, 2000, 8000), t, 1, 0.3)
    # broken clock ticking (irregular)
    last = None
    for i in range(int(OBJ_TIMES[1] * 2), int(OBJ_FALL * 2)):
        if i % 5 == 3:
            continue
        place(buf, tick(), i / 2.0 + (0.03 if i % 3 == 0 else 0), 0.07, 0.35)
    # trying to step, kneeling
    place(buf, rustle(0.5, 0.2, 300, 3000), TRY_STEP[0] + 0.1, 1, 0)
    place(buf, rustle(1.8, 0.1), KNEEL[0] + 0.5, 1, 0)
    # slip + crash
    place(buf, rustle(0.6, 0.3, 200, 2500), SLIP[0], 1, -0.2)
    place(buf, boom(), SLIP[1], 0.9, -0.25)
    place(buf, ting(), OBJ_FALL + 0.55, 0.18, 0.4)
    place(buf, wood(), OBJ_FALL + 0.62, 0.35, 0.5)
    place(buf, rustle(1.2, 0.05, 2000, 7000), OBJ_FALL + 0.2, 1, 0.6)
    place(buf, rustle(1.0, 0.1), SIT[0], 1, 0)
    # the tear
    place(buf, plink(), TEAR_FALL[1], 0.22, 0.1)
    buf = reverb(buf, IR_ROOM, 0.2)
    return buf


def main(vdir, out):
    voice, venv = load_voice(vdir)
    mus = music()
    # duck music under narration (smoothed envelope)
    k = int(0.35 * SR)
    sm = np.convolve(venv, np.ones(k) / k, mode='same')
    duck = 1.0 - 0.45 * sm
    mus *= duck
    fol = foley()
    wd = wind()
    mix = voice * 1.0 + mus * 0.42 + fol * 0.55 + wd * (1.0 - 0.3 * sm)
    # fade in/out
    t = np.arange(N) / SR
    mix *= np.minimum(1, t / 0.5)
    mix *= np.clip((DUR - t) / 0.6, 0, 1) ** 0.5
    mix = np.tanh(mix * 1.1) / 1.1
    mix = mix / np.max(np.abs(mix)) * 0.89
    wavfile.write(out, SR, (mix.T * 32767).astype(np.int16))
    print('music rms', np.sqrt(np.mean((mus * 0.42) ** 2)), 'voice rms', np.sqrt(np.mean(voice[:, venv > 0] ** 2)))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
