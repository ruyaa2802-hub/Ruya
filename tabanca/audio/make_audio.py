"""Sound for "HAYVANİKA – Tabanca Karidesi".

Stems: narration, music, ambience, sfx  +  final mix (48 kHz stereo).
Inputs:
  audio/narration.wav   — free Microsoft Edge neural TTS (tr-TR-AhmetNeural), one take, cut at the pauses and
                          placed on the film timeline (audio/prep_narration.py)
  out/parts/part*.cues.json — events from the renderer
The music (mysterious underwater atmosphere → tension in the slow motion → wide finale) and every sound effect
are synthesised here with numpy — no samples, no paid services.
Run:   python3 audio/make_audio.py            (full mix)
       python3 audio/make_audio.py --test 12  (first 12 s only → out/audio_test.wav)
"""
import glob
import json
import os
import subprocess
import sys
import wave

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 48000
DUR = 33.5
N_OFF = 0.0           # narration.wav is already on the film timeline
TEST = float(sys.argv[sys.argv.index('--test') + 1]) if '--test' in sys.argv else None
if TEST:
    DUR = TEST
N = int(SR * DUR)
t_axis = np.arange(N) / SR
rng = np.random.default_rng(21)


def ss(a, b, x):
    u = np.clip((x - a) / (b - a), 0, 1)
    return u * u * (3 - 2 * u)


def db(x):
    return 10 ** (x / 20)


def fft_filter(x, lo=None, hi=None, order=2):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    f[0] = 1e-3
    H = np.ones_like(f)
    if hi:
        H /= np.sqrt(1 + (f / hi) ** (2 * order))
    if lo:
        H /= np.sqrt(1 + (lo / f) ** (2 * order))
    return np.fft.irfft(X * H, len(x))


def norm(x):
    return x / (np.abs(x).max() + 1e-9)


def place(buf, sig, t0, gain=1.0, pan=0.0):
    i0 = int(round(t0 * SR))
    if i0 >= N:
        return
    if i0 < 0:
        sig, i0 = sig[-i0:], 0
    sig = sig[: N - i0]
    a = (np.clip(pan, -1, 1) + 1) * np.pi / 4
    buf[0, i0:i0 + len(sig)] += sig * gain * np.cos(a)
    buf[1, i0:i0 + len(sig)] += sig * gain * np.sin(a)


def env(n, a, r):
    e = np.ones(n)
    na, nr = min(int(a * SR), n), min(int(r * SR), n)
    e[:na] = np.linspace(0, 1, na)
    e[n - nr:] *= np.linspace(1, 0, nr)
    return e


def place_st(buf, st, t0, gain=1.0):
    """Add a stereo signal (2, n) at t0."""
    i0 = int(round(t0 * SR))
    if i0 >= N:
        return
    st = st[:, : N - i0]
    buf[:, i0:i0 + st.shape[1]] += st * gain


def write_wav(path, x):
    x = np.clip(x, -1, 1)
    with wave.open(path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((x.T * 32767).astype(np.int16).tobytes())


def load(path, ch=1):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', str(ch), '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    x = np.frombuffer(raw, dtype=np.float32).astype(np.float64)
    return x.reshape(-1, ch).T if ch > 1 else x


def conv(x, ir):
    n = len(x) + len(ir) - 1
    m = 1 << (n - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, m) * np.fft.rfft(ir, m), m)[: len(x)]


ir_n = int(1.4 * SR)
ir_t = np.arange(ir_n) / SR
IR = [fft_filter(rng.standard_normal(ir_n), lo=300, hi=6000) * np.exp(-ir_t / 0.35) for _ in range(2)]
IR = [ir / np.sqrt((ir ** 2).sum()) for ir in IR]


def reverb(st):
    return np.stack([conv(st[0] + 0.3 * st[1], IR[0]), conv(st[1] + 0.3 * st[0], IR[1])])


# ---------------------------------------------------------------- narration
v = load(os.path.join(ROOT, 'audio/narration.wav'))
narr_m = np.zeros(N)
i0 = int(N_OFF * SR)
narr_m[i0:i0 + len(v[: N - i0])] = v[: N - i0]
narr_m = fft_filter(narr_m, lo=80)
narr_m += 0.25 * fft_filter(narr_m, lo=120, hi=320)      # a little documentary warmth
narr_m += 0.15 * fft_filter(narr_m, lo=2800, hi=6500)    # presence
lvl = np.sqrt(np.convolve(narr_m ** 2, np.ones(480) / 480, mode='same')) + 1e-6
narr_m *= np.minimum(1, (lvl / db(-22)) ** -0.3)
narr_m *= db(-3) / np.abs(narr_m).max()
# a touch of short room on the voice so it sits in the underwater space
narr = np.stack([narr_m, narr_m]) + reverb(np.stack([narr_m, narr_m])) * db(-24)

win = int(0.03 * SR)
rms = np.sqrt(np.convolve(narr_m ** 2, np.ones(win) / win, mode='same'))
speech = (rms > db(-40)).astype(float)
ds = 48
sp = speech[::ds]
d_s = np.zeros_like(sp)
acc = 0.0
a_k, r_k = np.exp(-ds / (0.05 * SR)), np.exp(-ds / (0.40 * SR))
for i, x in enumerate(sp):
    acc = (a_k * acc + (1 - a_k) * x) if x > acc else (r_k * acc + (1 - r_k) * x)
    d_s[i] = acc
duck = np.interp(np.arange(N), np.arange(len(d_s)) * ds, d_s)

# ---------------------------------------------------------------- events
cues = sorted(glob.glob(os.path.join(ROOT, 'out/parts/part*.cues.json')))
events = json.load(open(cues[-1]))['events'] if cues else json.load(open(os.path.join(ROOT, 'audio/events.json')))
events = [e for e in events if e['t'] < DUR]

sfx = np.zeros((2, N))
send = np.zeros((2, N))


def bubble(r_mm=None):
    """One air bubble: a decaying sine whose pitch rises (Minnaert resonance)."""
    r_mm = r_mm or rng.uniform(1.0, 4.0)
    f0 = 3260 / r_mm
    dur = 0.04 + 0.03 * r_mm
    n = int(dur * SR)
    tt = np.arange(n) / SR
    f = f0 * (1 + 2.2 * tt / dur)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / (dur * 0.35)) * np.minimum(1, tt / 0.0015)


def bubbles(dur, rate=12.0, big=False):
    n = int(dur * SR)
    out = np.zeros((2, n + SR))
    tt = 0.0
    while tt < dur:
        b = bubble(rng.uniform(2.0, 5.0) if big else None)
        k = int(tt * SR)
        a = (rng.uniform(-0.8, 0.8) + 1) * np.pi / 4
        g = rng.uniform(0.3, 1.0)
        out[0, k:k + len(b)] += b * g * np.cos(a)
        out[1, k:k + len(b)] += b * g * np.sin(a)
        tt += rng.exponential(1 / rate)
    return out[:, :n]


def bell(freq, dur=1.2, bright=1.0):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    y = sum(a * np.sin(2 * np.pi * freq * r * tt) * np.exp(-tt * d) for r, a, d in ((1, 1, 3.0), (2.76, 0.35 * bright, 6), (5.4, 0.18 * bright, 11)))
    return y * np.minimum(1, tt / 0.002)


def whoosh(dur=0.7):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    y = np.zeros(n)
    for k, b in enumerate(np.geomspace(250, 3000, 6)):
        w = np.exp(-((tt / dur - k / 5) ** 2) / 0.04)
        y += fft_filter(rng.standard_normal(n), lo=b * 0.6, hi=b * 2) * w
    return norm(y * np.sin(np.pi * tt / dur) ** 1.5)


def shimmer(dur, f0=1400, rate=18):
    """Sci-fi 'cell' texture: a cloud of short glassy grains drifting in pitch."""
    n = int(dur * SR)
    out = np.zeros((2, n + SR))
    tt = 0.0
    while tt < dur:
        f = f0 * 2 ** (rng.uniform(-1, 1.5)) * (1 + 0.3 * tt / dur)
        gl = rng.uniform(0.05, 0.16)
        m = int(gl * SR)
        x = np.arange(m) / SR
        g = np.sin(2 * np.pi * f * x) * np.sin(np.pi * x / gl) ** 2
        k = int(tt * SR)
        a = (rng.uniform(-0.9, 0.9) + 1) * np.pi / 4
        out[0, k:k + m] += g * np.cos(a)
        out[1, k:k + m] += g * np.sin(a)
        tt += rng.exponential(1 / rate)
    return out[:, :n] / 4


def riser(dur, f0=180, f1=900):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    f = f0 * (f1 / f0) ** (tt / dur)
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = (np.sin(ph) + 0.4 * np.sin(2.01 * ph) + 0.25 * np.sin(3.02 * ph)) * (tt / dur) ** 1.4
    y += 0.3 * fft_filter(rng.standard_normal(n), lo=1500, hi=7000) * (tt / dur) ** 2
    return norm(y) * np.minimum(1, (dur - tt) / 0.08)


def blip(f=900):
    n = int(0.12 * SR)
    tt = np.arange(n) / SR
    return np.sin(2 * np.pi * f * (1 + 0.8 * tt / 0.12) * tt) * np.exp(-tt / 0.035) * np.minimum(1, tt / 0.002)



def click(f=3500, dur=0.012):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    return (fft_filter(rng.standard_normal(n), lo=f * 0.5, hi=f * 2) + np.sin(2 * np.pi * f * tt)) * np.exp(-tt / (dur * 0.25))


def thump(f0=95, f1=42, dur=0.45):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-tt / 0.05)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / (dur * 0.3)) * np.minimum(1, tt / 0.001)


def crack(dur=0.35):
    """The snap of a collapsing cavitation bubble: an extremely sharp broadband shock + ringing water."""
    n = int(dur * SR)
    tt = np.arange(n) / SR
    y = rng.standard_normal(n) * np.exp(-tt / 0.006)
    y += 0.5 * fft_filter(rng.standard_normal(n), lo=1500, hi=9000) * np.exp(-tt / 0.03)
    y += 0.35 * sum(np.sin(2 * np.pi * f * tt) * np.exp(-tt / 0.08) for f in (2310, 3470, 5180))
    return norm(y)


def boom(dur=2.2):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    f = 34 + 70 * np.exp(-tt / 0.09)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 0.55) + 0.4 * fft_filter(rng.standard_normal(n), hi=180) * np.exp(-tt / 0.4)
    return norm(y) * np.minimum(1, tt / 0.002)


def sweep(dur, f0, f1, noise=0.0):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    f = f0 * (f1 / f0) ** (tt / dur)
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = np.sin(ph) + 0.3 * np.sin(2 * ph + 0.5) + 0.15 * np.sin(3 * ph)
    if noise:
        y += noise * fft_filter(rng.standard_normal(n), lo=600, hi=5000)
    return norm(y)


def warble(dur, f0=320, f1=1250):
    """Bubble growth: an electronic, wobbling, rising tone with a watery shimmer."""
    n = int(dur * SR)
    tt = np.arange(n) / SR
    k = tt / dur
    f = f0 * (f1 / f0) ** (k ** 0.8) * (1 + 0.03 * np.sin(2 * np.pi * (5 + 6 * k) * tt))
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = np.sin(ph) + 0.35 * np.sin(1.5 * ph) + 0.2 * np.sin(2.01 * ph)
    y *= 0.6 + 0.4 * np.sin(2 * np.pi * (3 + 9 * k) * tt)
    return norm(y) * env(n, 0.3, 0.4)


def sucker(dur):
    """Pre-collapse: reversed whoosh + rising whine that ends abruptly at the collapse."""
    n = int(dur * SR)
    tt = np.arange(n) / SR
    k = tt / dur
    y = fft_filter(rng.standard_normal(n), lo=300, hi=4000) * k ** 3
    y += 0.8 * sweep(dur, 400, 2400) * k ** 2
    return norm(y) * np.minimum(1, (dur - tt) / 0.004)


def scuttle(dur, rate=16):
    n = int(dur * SR)
    out = np.zeros((2, n + SR))
    tt = 0.0
    while tt < dur:
        c = click(rng.uniform(3000, 6000), 0.008)
        k = int(tt * SR)
        a = (rng.uniform(-0.5, 0.5) + 1) * np.pi / 4
        out[0, k:k + len(c)] += c * np.cos(a) * rng.uniform(0.3, 1)
        out[1, k:k + len(c)] += c * np.sin(a) * rng.uniform(0.3, 1)
        tt += rng.exponential(1 / rate)
    return out[:, :n] * 0.4


for e in events:
    t0, ty = e['t'], e['type']
    if ty == 'open':
        n = int(4.0 * SR)
        tt = np.arange(n) / SR
        y = fft_filter(rng.standard_normal(n), lo=50, hi=420) * np.sin(np.pi * np.clip(tt / 4.0, 0, 1)) ** 2
        place(sfx, norm(y), t0, db(-24), 0)
        place(sfx, bell(587, 2.5, 0.2), t0 + 0.25, db(-30), -0.3)    # distant sonar-like ping
        place(send, bell(587, 2.5, 0.2), t0 + 0.25, db(-24), 0)
    elif ty == 'cock':  # the claw is cocked open: ratcheting clicks + tension rise
        d = e['d']
        k = 0.0
        while k < d:
            place(sfx, click(rng.uniform(2500, 4200), 0.01), t0 + k, db(-26 + 6 * k / d), rng.uniform(-0.2, 0.2))
            k += 0.11 * (1 - 0.6 * k / d)
        place(sfx, sweep(d, 90, 180) * env(int(d * SR), 0.2, 0.05), t0, db(-30), 0)
        place(sfx, click(5200, 0.02), t0 + d, db(-18), 0)            # the latch
    elif ty == 'snap':  # claw shuts: hard "tok" + jet whoosh + time-slow drop
        place(sfx, thump(160, 60, 0.3), t0, db(-10), 0)
        place(sfx, click(4200, 0.015), t0, db(-14), 0)
        place(send, thump(160, 60, 0.3), t0, db(-14), 0)
        place(sfx, whoosh(0.5), t0 - 0.05, db(-18), 0)
        place(sfx, sweep(1.2, 900, 70) * env(int(1.2 * SR), 0.01, 0.6), t0 + 0.02, db(-20), 0)  # "time slows"
    elif ty == 'jet':
        d = e['d']
        n = int(d * SR)
        tt = np.arange(n) / SR
        y = fft_filter(rng.standard_normal(n), lo=150, hi=1400) * (0.5 + 0.5 * np.sin(2 * np.pi * 1.7 * tt)) * env(n, 0.15, 1.0)
        place(sfx, norm(y), t0, db(-24), 0.1)
    elif ty == 'grow':
        place(sfx, warble(e['d']), t0, db(-25), 0)
        place_st(sfx, shimmer(e['d'], 1700, 9), t0, db(-30))
        place(send, warble(e['d']), t0, db(-30), 0)
    elif ty == 'pre':
        place(sfx, sucker(e['d']), t0, db(-21), 0)
    elif ty == 'collapse':  # the real "bang": shock wave from the collapsing bubble
        k = e.get('k', 1)
        place(sfx, crack(), t0, db(-6) * k, 0)
        place(sfx, boom(), t0, db(-8) * k, 0)
        place(send, crack(), t0, db(-8), 0)
        place_st(sfx, bubbles(1.6, 28), t0 + 0.08, db(-24))          # rebound micro-bubbles fizz
        if e.get('light'):
            for j, f in enumerate((2637, 3520, 4186, 5274)):
                place(sfx, bell(f, 1.6, 0.6), t0 + 0.01 + 0.03 * j, db(-24), (-0.5 + j * 0.33))
                place(send, bell(f, 1.6, 0.6), t0 + 0.01 + 0.03 * j, db(-26), 0)
    elif ty == 'whoosh':
        place(sfx, whoosh(0.7), t0 - 0.35, db(-22), 0)
        place_st(sfx, bubbles(0.6, 18), t0 - 0.1, db(-27))
    elif ty == 'title':
        place(sfx, boom(1.6), t0, db(-20), 0)
        place(sfx, bell(880, 1.6, 0.4), t0, db(-28), 0.15)
        place(send, bell(880, 1.6, 0.4), t0, db(-26), 0)
    elif ty == 'ping':
        place(sfx, blip(1320), t0, db(-24), 0.2)
        place(send, blip(1320), t0, db(-28), 0)
    elif ty == 'walk':
        place_st(sfx, scuttle(e['d']), t0, db(-24))
    elif ty == 'grab':
        place(sfx, click(3000, 0.02), t0, db(-18), -0.1)

# ---------------------------------------------------------------- ambience: deep underwater bed, distant reef crackle
amb = np.zeros((2, N))
bed = fft_filter(rng.standard_normal(2 * N), lo=30, hi=300).reshape(2, N)
amb += norm(bed) * db(-28) * (0.85 + 0.15 * np.sin(2 * np.pi * 0.07 * t_axis))
# snapping-shrimp chorus: the real reef crackle (thousands of distant snaps)
crk = np.zeros((2, N))
tt0 = 0.0
while tt0 < DUR:
    c = click(rng.uniform(2500, 7000), 0.004) * rng.uniform(0.1, 1)
    place(crk, c, tt0, 1.0, rng.uniform(-1, 1))
    tt0 += rng.exponential(1 / 45)
amb += np.stack([fft_filter(crk[0], lo=1500, hi=6000), fft_filter(crk[1], lo=1500, hi=6000)]) * db(-34)
far = bubbles(DUR, 2)
amb += np.stack([fft_filter(far[0], hi=2000), fft_filter(far[1], hi=2000)]) * db(-38)
slowmo = np.clip(ss(2.95, 3.1, t_axis) * (1 - ss(5.1, 5.3, t_axis)) + ss(8.45, 8.6, t_axis) * (1 - ss(20.9, 21.2, t_axis)), 0, 1)
amb *= (1 - 0.65 * slowmo)       # the world goes muffled during the slow motion
amb *= ss(0, 0.8, t_axis) * (1 - ss(DUR - 0.8, DUR, t_axis))

# ---------------------------------------------------------------- music
music = np.zeros((2, N))


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def pad(freq, dur, att=1.8, rel=2.0):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    y = sum(np.sin(2 * np.pi * freq * (1 + d) * tt + 0.3 * np.sin(2 * np.pi * (0.13 + i * 0.05) * tt)) for i, d in enumerate((-0.006, 0, 0.004, 0.008))) / 4
    y += 0.22 * np.sin(2 * np.pi * freq * 2.0 * tt) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.09 * tt))
    return y * env(n, att, rel)


def strings(freq, dur, att=0.8, rel=0.6, trem=0.0):
    """Bowed-string-like tone (band-limited saw) with optional tremolo — for the tension."""
    n = int(dur * SR)
    tt = np.arange(n) / SR
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.2 * tt)
    ph = 2 * np.pi * np.cumsum(freq * vib) / SR
    y = sum(np.sin(k * ph) / k for k in range(1, 9))
    if trem:
        y *= 1 - trem * (0.5 + 0.5 * np.sin(2 * np.pi * 9 * tt))
    return y * env(n, att, rel)


def glass(freq, dur=2.6, vel=1.0):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    y = np.sin(2 * np.pi * freq * tt) * np.exp(-tt * 1.6) + 0.35 * np.sin(2 * np.pi * freq * 3.0 * tt) * np.exp(-tt * 4) + 0.15 * np.sin(2 * np.pi * freq * 4.2 * tt) * np.exp(-tt * 7)
    return y * np.minimum(1, tt / 0.004) * vel


def addmono(buf, sig, t0, gain=1.0, spread=0):
    i0 = int(t0 * SR)
    if i0 >= N:
        return
    s = sig[: N - i0] * gain
    buf[0, i0:i0 + len(s)] += s
    j = i0 + spread
    s2 = sig[: max(0, N - j)] * gain
    buf[1, j:j + len(s2)] += s2


# harmony: dark D minor drone → tension cluster in the slow motion → airy after the collapse → wide finale
CH = [(0.0, [38, 45, 50, 57, 64]), (5.3, [38, 45, 50, 53, 57]), (7.35, [34, 46, 50, 53, 58]),
      (15.6, [43, 50, 55, 58, 65]), (18.0, [38, 45, 50, 52, 57]), (21.2, [34, 46, 53, 57, 62]),
      (25.6, [38, 50, 57, 62, 65]), (27.6, [34, 46, 53, 58, 62]), (29.6, [41, 48, 57, 60, 65]), (31.0, [36, 48, 55, 60, 64]), (32.2, [38, 50, 57, 62, 64])]
padL = np.zeros((2, N))
for i, (t0, notes) in enumerate(CH):
    t1 = CH[i + 1][0] if i + 1 < len(CH) else DUR + 1
    for m in notes:
        sig = pad(mtof(m), t1 - t0 + 2.0, 1.2 if t0 > 0 else 3.0, 2.0) * (1.25 if m < 46 else 0.75)
        addmono(padL, sig, t0, 1.0, 700)
padL = np.stack([fft_filter(padL[0], lo=35, hi=1700), fft_filter(padL[1], lo=35, hi=1700)])
finale = ss(25.6, 28.0, t_axis)
music += padL * (0.75 + 0.6 * finale)
# tension strings (tremolo), rising, under the cocking and the slow motion; cut dead at each collapse
ten = np.zeros((2, N))
for (a, b, notes, trem) in ((1.9, 4.1, [62, 63, 69], 0.5), (7.35, 15.55, [62, 63, 69, 74], 0.6), (18.0, 19.75, [63, 69, 74, 75], 0.7)):
    for m in notes:
        sig = strings(mtof(m), b - a, 0.9 if b - a > 3 else 0.4, 0.004, trem)
        n = len(sig)
        sig *= np.linspace(0.35, 1.0, n) ** 1.5                 # crescendo
        addmono(ten, sig, a, 0.5, 500)
ten = np.stack([fft_filter(ten[0], lo=150, hi=4500), fft_filter(ten[1], lo=150, hi=4500)])
music += ten * 0.55
# slow heartbeat under the slow motion
hb = np.zeros((2, N))
tt0 = 8.6
while tt0 < 15.5:
    n = int(0.4 * SR)
    x = np.arange(n) / SR
    s1 = np.sin(2 * np.pi * (48 + 30 * np.exp(-x / 0.04)) * x) * np.exp(-x / 0.12)
    place(hb, s1, tt0, 0.9, 0)
    place(hb, s1 * 0.55, tt0 + 0.3, 0.9, 0)
    tt0 += 60 / 64
music += hb * 0.5
# glass arpeggio: sparse in the opening, flowing in the finale
arp = np.zeros((2, N))
for i, (t0, notes) in enumerate(CH):
    t1 = CH[i + 1][0] if i + 1 < len(CH) else DUR
    if 8.0 < t0 < 21.0:
        continue
    step = 0.3 if t0 >= 25.6 else 0.75
    k = 0
    tt0 = t0 + 0.2
    while tt0 < t1 - 0.1:
        m = notes[[2, 3, 4, 3][k % 4]] + 12 + (12 if (k % 6 == 4 and t0 >= 25.6) else 0)
        place(arp, glass(mtof(m), 2.2, 0.6 - 0.1 * (k % 2)), tt0, 1.0, 0.7 * np.sin(k * 1.3 + t0))
        tt0 += step
        k += 1
music += arp * 0.3 * (0.5 + 0.9 * finale)
# low sub swell for the final reveal
n = int((DUR - 25.6) * SR)
x = np.arange(n) / SR
addmono(music, np.sin(2 * np.pi * mtof(26) * x) * ss(0, 3, x) * (1 - ss(n / SR - 1.5, n / SR, x)), 25.6, 0.5)
music = norm(music)
# the music holds its breath at the collapses (and just before them), then returns
gap = np.ones(N)
for c in (4.1, 15.55, 19.75):
    gap *= 1 - 0.85 * ss(c - 0.25, c - 0.02, t_axis) * (1 - ss(c + 0.5, c + 1.6, t_axis))
music *= gap
music *= ss(0, 2.0, t_axis) * (1 - ss(DUR - 1.2, DUR, t_axis) * 0.97)

# ---------------------------------------------------------------- mix: music −10 dB under the narration
wet = reverb(send) * db(-5)
music_st = music * db(-6) * (1 - duck * (1 - db(-10)))
amb_st = amb * db(7) * (1 - duck * (1 - db(-4)))
sfx_st = (sfx + wet) * (1 - duck * (1 - db(-3))) * (1 - ss(DUR - 0.3, DUR, t_axis))
mix = narr + music_st + amb_st + sfx_st
peak = np.abs(mix).max()
scale = db(-1) / peak if peak > db(-1) else 1.0
mix *= scale
if TEST:
    write_wav(os.path.join(ROOT, 'out/audio_test.wav'), mix)
    print('test mix written, peak', round(20 * np.log10(peak), 2), 'dBFS')
    sys.exit()
out = os.path.join(ROOT, 'out/audio')
os.makedirs(out, exist_ok=True)
write_wav(os.path.join(out, 'stem_narration.wav'), narr * scale)
write_wav(os.path.join(out, 'stem_music.wav'), music_st * scale)
write_wav(os.path.join(out, 'stem_ambience.wav'), amb_st * scale)
write_wav(os.path.join(out, 'stem_sfx.wav'), sfx_st * scale)
write_wav(os.path.join(ROOT, 'out/soundtrack.wav'), mix)
print('peak', round(20 * np.log10(peak), 2), 'dBFS | events', len(events))
