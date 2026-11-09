"""Sound for "HAYVANİKA – Tabanca Karidesi".

Stems: narration, music, ambience, sfx  +  final mix (48 kHz stereo).
Inputs:
  audio/narration.wav   — the user's narration file (one take), placed at 0.3 s (audio/prep_narration.py)
  out/parts/part*.cues.json — events from the renderer, in FILM time; mapped to video time through
                          scene/timewarp.json (the same monotone warp the renderer uses)
The music is a synthesised piano (gentle, mysterious → tense in the slow motion → warm finale); every sound
effect is synthesised too — no samples, no paid services.
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
DUR = 41.6
N_OFF = 0.0           # narration.wav is already on the film timeline
TEST = float(sys.argv[sys.argv.index('--test') + 1]) if '--test' in sys.argv else None
if TEST:
    DUR = TEST
N = int(SR * DUR)
t_axis = np.arange(N) / SR
rng = np.random.default_rng(21)


WARP = json.load(open(os.path.join(ROOT, 'scene/timewarp.json')))


def _monotone(xs, ys):
    xs, ys = np.asarray(xs, float), np.asarray(ys, float)
    n = len(xs)
    d = np.diff(ys) / np.diff(xs)
    m = np.zeros(n)
    m[0], m[-1] = d[0], d[-1]
    for i in range(1, n - 1):
        m[i] = 0 if d[i - 1] * d[i] <= 0 else 3 * (d[i - 1] + d[i]) / ((2 * d[i] + d[i - 1]) / d[i - 1] + (d[i] + 2 * d[i - 1]) / d[i])

    def f(x):
        x = np.asarray(x, float)
        i = np.clip(np.searchsorted(xs, x) - 1, 0, n - 2)
        h = xs[i + 1] - xs[i]
        u = (x - xs[i]) / h
        u2, u3 = u * u, u * u * u
        return (2 * u3 - 3 * u2 + 1) * ys[i] + (u3 - 2 * u2 + u) * h * m[i] + (-2 * u3 + 3 * u2) * ys[i + 1] + (u3 - u2) * h * m[i + 1]
    return f


_T = np.arange(0, WARP['duration'] + 1e-9, 0.0005)
_t = _monotone([a[1] for a in WARP['anchors']], [a[0] for a in WARP['anchors']])(_T)   # video → film (as the renderer)


def W(t_film):
    """film time → video time"""
    return float(np.interp(t_film, _t, _T))


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
events = [dict(e, t=W(e['t']), d=(W(e['t'] + e['d']) - W(e['t'])) if 'd' in e else None) for e in events]
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
slowmo = np.clip(ss(W(2.95), W(2.95) + 0.15, t_axis) * (1 - ss(W(5.1), W(5.3), t_axis)) + ss(W(8.45), W(8.45) + 0.15, t_axis) * (1 - ss(W(20.9), W(21.2), t_axis)), 0, 1)
amb *= (1 - 0.65 * slowmo)       # the world goes muffled during the slow motion
amb *= ss(0, 0.8, t_axis) * (1 - ss(DUR - 0.8, DUR, t_axis))

# ---------------------------------------------------------------- music: synthesised piano
def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def piano(m, dur, vel=0.7):
    """A felt-ish piano note: inharmonic partials, two detuned strings, two-stage decay, hammer knock."""
    f = mtof(m)
    n = int((dur + 0.6) * SR)
    tt = np.arange(n) / SR
    B = 0.00012 * (f / 261.6) ** 1.2
    tau = 2.4 * (261.6 / f) ** 0.55
    y = np.zeros(n)
    bright = 0.35 + 0.65 * vel
    for k in range(1, 13):
        fk = f * k * np.sqrt(1 + B * k * k)
        if fk > 9000:
            break
        ak = (1 / k ** 1.3) * bright ** (k - 1) * (1 + 0.6 * (k == 2))
        tk = tau / (1 + 0.55 * (k - 1))
        dec = 0.65 * np.exp(-tt / (tk * 0.18)) + 0.35 * np.exp(-tt / tk)
        y += ak * dec * (np.sin(2 * np.pi * fk * tt) + 0.8 * np.sin(2 * np.pi * fk * (1 + 0.00035) * tt + 0.7))
    knock = fft_filter(rng.standard_normal(n), lo=200, hi=2500) * np.exp(-tt / 0.012) * 0.25
    y = (y + knock) * np.minimum(1, tt / 0.003)
    # damper at the end of the note (pedal lets it ring 0.6 s)
    rel = np.ones(n)
    k0 = int(dur * SR)
    rel[k0:] = np.exp(-(tt[k0:] - dur) / 0.18)
    return y * rel * vel


pianoL = np.zeros((2, N))


def play(m, t0, dur, vel):
    sig = piano(m, dur, vel)
    pan = np.clip((m - 60) / 30, -0.6, 0.6)
    place(pianoL, sig, t0, 1.0, pan)


def arp(t0, t1, notes, step, vel, pattern=None, rising=0.0):
    pattern = pattern or list(range(len(notes))) + list(range(len(notes) - 2, 0, -1))
    k, tt0 = 0, t0
    while tt0 < t1 - 0.05:
        m = notes[pattern[k % len(pattern)]]
        v = vel * (1 + rising * (tt0 - t0) / max(0.1, t1 - t0)) * (1.0 if k % len(pattern) == 0 else 0.82)
        play(m, tt0, max(0.4, min(2.2, t1 - tt0 + 0.3)), min(1.0, v))
        tt0 += step
        k += 1


SNAP_A, COL_A, SNAP_B, COL_B, COL_D = W(2.95), W(4.1), W(8.45), W(15.55), W(19.75)
CUT_B, CUT_E = W(5.3), W(21.2)
# A — mysterious, sparse: D minor (add9), then B♭maj7 after the first snap
play(38, 0.2, 4.0, 0.5); arp(0.4, SNAP_A - 0.1, [50, 57, 64, 65, 69], 0.46, 0.38)
play(34, COL_A + 0.25, 3.0, 0.45); arp(COL_A + 0.35, CUT_B + 0.3, [46, 53, 57, 62, 65], 0.43, 0.36)
# B — the claw: Gm9 → A sus, the arpeggio speeds up and climbs while the claw is cocked
play(31, CUT_B + 0.35, 2.6, 0.5); arp(CUT_B + 0.4, W(7.35), [43, 50, 57, 58, 62], 0.38, 0.38)
play(33, W(7.35), 2.0, 0.5); arp(W(7.35), SNAP_B - 0.12, [45, 52, 57, 62, 64, 69], 0.2, 0.36, rising=0.8)
# C — slow motion: low D pulse like a heartbeat, high dissonant bell tones, Neapolitan E♭ colour, hush before the collapse
tt0 = SNAP_B + 0.35
while tt0 < COL_B - 0.5:
    play(26, tt0, 0.8, 0.55); play(38, tt0 + 0.02, 0.8, 0.35)
    tt0 += 0.86
for k, (m, dt) in enumerate([(74, 0.9), (75, 2.4), (74, 3.6), (81, 4.6), (75, 5.6), (82, 6.4), (86, 7.1)]):
    if SNAP_B + dt < COL_B - 0.4:
        play(m, SNAP_B + dt, 1.4, 0.32 + 0.04 * k)
play(51, W(11.95), 3.0, 0.35); play(55, W(11.95) + 0.05, 3.0, 0.3); play(58, W(11.95) + 0.1, 3.0, 0.3)
# D — after the collapse: delicate high G minor add9
arp(COL_B + 0.6, W(18.0) - 0.05, [67, 74, 69, 79, 70, 81], 0.24, 0.3)
# replay: repeated high D accelerating into the flash, then a bright B♭ add9 bloom on "ışık"
tt0, gapd = W(18.0) + 0.1, 0.36
while tt0 < COL_D - 0.18:
    play(86, tt0, 0.3, 0.32)
    tt0 += gapd
    gapd = max(0.11, gapd * 0.86)
for j, m in enumerate([58, 65, 72, 74, 77, 84]):
    play(m, COL_D + 0.03 + 0.04 * j, 2.6, 0.5)
# F — warm finale: B♭ – F – C – Dm – B♭ – F, flowing arpeggio + a simple melody, ending on F (add9)
FIN = [(CUT_E, 34, [46, 53, 57, 62, 65]), (W(22.7), 29, [41, 48, 53, 57, 60]), (W(24.53), 36, [48, 52, 55, 60, 64]), (W(26.56), 38, [45, 50, 53, 57, 62]),
       (W(27.55), 34, [46, 50, 53, 58, 62]), (W(29.58), 29, [41, 48, 53, 55, 57, 60])]
for i, (t0, bass, notes) in enumerate(FIN):
    t1 = FIN[i + 1][0] if i + 1 < len(FIN) else DUR - 0.6
    play(bass, t0, t1 - t0 + 0.5, 0.55); play(bass + 12, t0 + 0.01, t1 - t0 + 0.5, 0.4)
    arp(t0 + 0.05, t1, notes, 0.29, 0.36 + 0.05 * (i >= 4))
MEL = [(0.0, 74), (1.2, 72), (1.75, 70), (2.3, 69), (3.5, 67), (4.1, 69), (5.3, 72), (6.0, 74), (6.6, 77), (8.0, 76), (8.6, 74), (9.4, 72), (10.4, 74), (11.4, 72), (12.4, 69)]
for dt, m in MEL:
    if CUT_E + 0.4 + dt < DUR - 0.8:
        play(m, CUT_E + 0.4 + dt, 1.6, 0.52)
play(77, W(29.58) + 0.4, 3.5, 0.45); play(81, W(29.58) + 0.45, 3.5, 0.4); play(84, W(29.58) + 0.5, 3.5, 0.35)
music = reverb(pianoL) * db(-5) + pianoL
music = np.stack([fft_filter(music[0], lo=45), fft_filter(music[1], lo=45)])
music = norm(music)
# the music holds its breath before each collapse, then returns
gap = np.ones(N)
for c in (COL_A, COL_B, COL_D):
    gap *= 1 - 0.8 * ss(c - 0.3, c - 0.03, t_axis) * (1 - ss(c + 0.4, c + 1.2, t_axis))
music *= gap
music *= ss(0, 1.0, t_axis) * (1 - ss(DUR - 1.5, DUR, t_axis) * 0.97)

# ---------------------------------------------------------------- mix: music −10 dB under the narration
wet = reverb(send) * db(-5)
music_st = music * db(-2) * (1 - duck * (1 - db(-10)))
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
