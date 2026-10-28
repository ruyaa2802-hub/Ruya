"""Sound design for "Köpekler aynadaki görüntülerini neden tanımıyor?" (same workflow as the earlier films).

Stems: narration, music, ambience, sfx  +  final mix (48 kHz stereo).
Inputs: audio/raw/take1.mp3 (ElevenLabs, Uğur, eleven_flash_v2_5), audio/clips.json (sentence placement),
        audio/sfx/sniff.mp3 (ElevenLabs sound effect), out/parts/part*.cues.json (events from the renderer).
The narration is sped up 8 % (pitch kept) so the film fits ~50 s.
Run:   python3 audio/make_audio.py
"""
import glob
import json
import os
import subprocess
import wave

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 48000
DUR = 50.5
SPEED = 1.08
N = int(SR * DUR)
t_axis = np.arange(N) / SR
rng = np.random.default_rng(8)


def ss(a, b, x):
    u = np.clip((x - a) / (b - a), 0, 1)
    return u * u * (3 - 2 * u)


def db(x):
    return 10 ** (x / 20)


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


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


def write_wav(path, x):
    x = np.clip(x, -1, 1)
    with wave.open(path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((x.T * 32767).astype(np.int16).tobytes())


def env(n, a, r):
    e = np.ones(n)
    na, nr = min(int(a * SR), n), min(int(r * SR), n)
    e[:na] = np.linspace(0, 1, na)
    e[n - nr:] *= np.linspace(1, 0, nr)
    return e


def load(path, af=None):
    cmd = ['ffmpeg', '-v', 'error', '-i', path] + (['-af', af] if af else []) + ['-f', 'f32le', '-ac', '1', '-ar', str(SR), '-']
    return np.frombuffer(subprocess.run(cmd, capture_output=True, check=True).stdout, dtype=np.float32).astype(np.float64)


def conv(x, ir):
    n = len(x) + len(ir) - 1
    m = 1 << (n - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, m) * np.fft.rfft(ir, m), m)[: len(x)]


ir_n = int(0.8 * SR)
ir_t = np.arange(ir_n) / SR
IR = [fft_filter(rng.standard_normal(ir_n), lo=150, hi=4500) * np.exp(-ir_t / 0.14) for _ in range(2)]
IR = [ir / np.sqrt((ir ** 2).sum()) for ir in IR]


def reverb(st):
    return np.stack([conv(st[0] + 0.3 * st[1], IR[0]), conv(st[1] + 0.3 * st[0], IR[1])])


# ---------------------------------------------------------------- narration (sped up, placed per sentence)
take = load(os.path.join(ROOT, 'audio/raw/take1.mp3'), f'atempo={SPEED}')
CLIPS = json.load(open(os.path.join(ROOT, 'audio/clips.json')))  # [take_start, take_end, place] in original take time
narr_m = np.zeros(N)
for a, b, p in CLIPS:
    a2, b2 = a / SPEED, b / SPEED
    seg = take[int(max(0, a2 - 0.04) * SR): int((b2 + 0.1) * SR)].copy()
    f = int(0.015 * SR)
    seg[:f] *= np.linspace(0, 1, f)
    seg[-f:] *= np.linspace(1, 0, f)
    i0 = int((p - 0.04) * SR)
    seg = seg[: N - i0]
    narr_m[i0:i0 + len(seg)] += seg
narr_m = fft_filter(narr_m, lo=80)
narr_m *= db(-3) / np.abs(narr_m).max()
narr = np.stack([narr_m, narr_m])

win = int(0.03 * SR)
rms = np.sqrt(np.convolve(narr_m ** 2, np.ones(win) / win, mode='same'))
speech = (rms > db(-42)).astype(float)
ds = 48
sp = speech[::ds]
d_s = np.zeros_like(sp)
acc = 0.0
a_k, r_k = np.exp(-ds / (0.06 * SR)), np.exp(-ds / (0.45 * SR))
for i, v in enumerate(sp):
    acc = (a_k * acc + (1 - a_k) * v) if v > acc else (r_k * acc + (1 - r_k) * v)
    d_s[i] = acc
duck = np.interp(np.arange(N), np.arange(len(d_s)) * ds, d_s)

# ---------------------------------------------------------------- events
events = json.load(open(sorted(glob.glob(os.path.join(ROOT, 'out/parts/part*.cues.json')))[-1]))['events']
WALKS = [[0, 5.9, 'in'], [9.3, 13.4, 'in'], [21.6, 26.2, 'out'], [27.6, 29.6, 'out'], [34.2, 37.8, 'out'], [43.6, 47.0, 'in']]

# ---------------------------------------------------------------- sfx
sfx = np.zeros((2, N))
send = np.zeros((2, N))
sniff = norm(fft_filter(load(os.path.join(ROOT, 'audio/sfx/sniff.mp3')), lo=150))[int(0.35 * SR): int(1.95 * SR)]


def sniff_bed(dur):
    """Loop the recorded sniffs (with small pitch variation) to fill `dur` seconds."""
    out = np.zeros(int(dur * SR) + len(sniff))
    pos = 0
    k = 0
    while pos < int(dur * SR):
        fac = [1.0, 1.06, 0.95, 1.03][k % 4]
        s = np.interp(np.arange(int(len(sniff) / fac)) * fac, np.arange(len(sniff)), sniff)
        xf = int(0.05 * SR)
        s[:xf] *= np.linspace(0, 1, xf)
        s[-xf:] *= np.linspace(1, 0, xf)
        out[pos:pos + len(s)] += s
        pos += len(s) - xf
        k += 1
    out = out[: int(dur * SR)]
    f = int(0.08 * SR)
    out[-f:] *= np.linspace(1, 0, f)
    return out


def shimmer(dur, f0=1600):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    y = sum(np.sin(2 * np.pi * f0 * k * tt + k) * np.exp(-tt * (1.5 + k)) / k for k in (1, 1.5, 2, 3))
    y += fft_filter(rng.standard_normal(n), lo=3000, hi=9000) * 0.25 * np.exp(-tt * 3)
    return norm(y) * np.minimum(1, tt / 0.02)


for e in events:
    t0, ty = e['t'], e['type']
    if ty == 'sniff':
        s = sniff_bed(e['d'])
        place(sfx, s, t0, db(-6), 0.1)
        place(send, s, t0, db(-18), 0.1)
    elif ty == 'xray':
        place(sfx, shimmer(1.6, 1200), t0, db(-25), 0)
        n = int(1.0 * SR)
        riser = fft_filter(rng.standard_normal(n), lo=800, hi=6000) * (np.arange(n) / n) ** 2
        place(sfx, norm(riser), t0 - 0.9, db(-31), 0)
    elif ty == 'dissolve':
        place(sfx, shimmer(2.4, 900), t0 + 0.2, db(-24), 0)
    elif ty == 'cut':
        n = int(0.35 * SR)
        tt = np.arange(n) / SR
        w = fft_filter(rng.standard_normal(n), lo=300, hi=3000) * np.sin(np.pi * tt / 0.35) ** 3
        place(sfx, norm(w), t0 - 0.17, db(-30), 0)
    elif ty == 'pant':  # soft happy panting at the end
        tt0 = t0
        while tt0 < DUR - 0.6:
            n = int(0.16 * SR)
            x = fft_filter(rng.standard_normal(n), lo=500, hi=3500) * np.sin(np.pi * np.arange(n) / n) ** 2
            place(sfx, norm(x), tt0, db(-30), 0.05)
            tt0 += 0.22 + rng.uniform(-0.02, 0.02)
    elif ty == 'outro':
        for i, m in enumerate([72, 76, 79, 84]):
            n = int(1.8 * SR)
            tt = np.arange(n) / SR
            b = (np.sin(2 * np.pi * mtof(m) * tt) + 0.3 * np.sin(4 * np.pi * mtof(m) * tt) * np.exp(-tt * 3)) * np.exp(-tt * 2.2) * np.minimum(1, tt / 0.004)
            place(sfx, b, t0 + 0.08 * i, db(-27), -0.3 + 0.2 * i)
# paw steps: claws ticking on the wooden floor indoors, soft thuds on grass outdoors
for a, b, where in WALKS:
    tt0 = a + 0.1
    k = 0
    while tt0 < b:
        if where == 'in':
            n = int(0.012 * SR)
            x = fft_filter(rng.standard_normal(n), lo=2500, hi=8000) * np.exp(-np.arange(n) / (0.0025 * SR))
            place(sfx, norm(x), tt0, db(rng.uniform(-35, -31)), rng.uniform(-0.2, 0.2))
            place(send, norm(x), tt0, db(-36), 0)
        else:
            n = int(0.06 * SR)
            x = fft_filter(rng.standard_normal(n), lo=600, hi=4000) * np.exp(-np.arange(n) / (0.02 * SR))
            place(sfx, norm(x), tt0, db(rng.uniform(-36, -32)), rng.uniform(-0.2, 0.2))
        tt0 += 0.16 + 0.05 * (k % 2)
        k += 1

# ---------------------------------------------------------------- ambience
amb = np.zeros((2, N))
outdoor = (((t_axis >= 21.6) & (t_axis < 29.6)) | ((t_axis >= 33.0) & (t_axis < 41.5))).astype(float)
outdoor = np.convolve(outdoor, np.ones(9600) / 9600, mode='same')
indoor = 1 - outdoor
room = fft_filter(rng.standard_normal(N), lo=40, hi=350)
amb += np.stack([room, np.roll(room, 1500)]) / np.abs(room).max() * db(-34) * indoor
tick = np.zeros(N)
for k in range(int(DUR)):  # a quiet wall clock
    i = int((k + 0.3) * SR)
    n = int(0.006 * SR)
    tick[i:i + n] += np.exp(-np.arange(n) / (0.001 * SR)) * (1 if k % 2 else 0.7)
amb += np.stack([fft_filter(tick, lo=2000, hi=6000)] * 2) * db(-34) * indoor
wind = fft_filter(rng.standard_normal(2 * N), lo=150, hi=1500).reshape(2, N)
amb += norm(wind) * db(-30) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.17 * t_axis)) * outdoor
tb = 21.7
while tb < 41.4:
    if (21.6 <= tb < 29.6) or (33.0 <= tb < 41.5):
        n = int(rng.uniform(0.06, 0.18) * SR)
        tt = np.arange(n) / SR
        f0 = rng.uniform(2400, 4400)
        chirp = np.sin(2 * np.pi * np.cumsum(f0 + 1000 * np.sin(tt * rng.uniform(25, 60))) / SR) * np.sin(np.pi * tt / tt[-1]) ** 2
        place(amb, chirp, tb, db(rng.uniform(-38, -31)), rng.uniform(-0.9, 0.9))
    tb += rng.uniform(0.25, 1.0)
amb *= ss(0, 0.6, t_axis) * (1 - ss(DUR - 0.6, DUR, t_axis))

# ---------------------------------------------------------------- music: mysterious but warm
music = np.zeros((2, N))


def pad_note(freq, dur, att=1.5):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    y = sum(np.sin(2 * np.pi * freq * (1 + d) * tt + 0.25 * np.sin(2 * np.pi * 0.3 * tt)) for d in (-0.004, 0, 0.005)) / 3
    return y * env(n, att, 1.8)


def celesta(freq, dur=2.2, vel=1.0):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    y = np.sin(2 * np.pi * freq * tt) * np.exp(-tt * 2.4) + 0.4 * np.sin(2 * np.pi * freq * 4 * tt) * np.exp(-tt * 7)
    return y * np.minimum(1, tt / 0.003) * vel


CHORDS = [(0, 7.2, [45, 52, 57, 60, 64]), (7.2, 10, [41, 48, 53, 57, 64]), (17.2, 4.4, [43, 50, 55, 59, 62]),
          (21.6, 8, [48, 55, 60, 64, 67]), (29.6, 4.6, [45, 52, 57, 60, 64]), (34.2, 7.3, [41, 48, 53, 57, 60]),
          (41.5, 5.5, [43, 50, 55, 59, 62]), (47.0, 4, [48, 55, 60, 64, 67, 72])]
pad = np.zeros(N)
for t0, L, voice in CHORDS:
    for m in voice:
        sig = pad_note(mtof(m), L + 1.8, 1.2 if t0 > 0 else 2.0) * (1.25 if m < 46 else 1.0)
        i0 = int(t0 * SR)
        pad[i0:i0 + len(sig[: N - i0])] += sig[: N - i0]
pad = fft_filter(pad, lo=50, hi=1500)
music += np.stack([pad, np.roll(pad, 700)])
cel = np.zeros((2, N))
MOTIF = [76, 79, 81, 79, 76, 72]
for t0 in [1.0, 8.0, 13.5, 22.2, 26.0, 30.2, 35.0, 42.0]:
    for k, m in enumerate(MOTIF[: 4 + (int(t0) % 3)]):
        place(cel, celesta(mtof(m), 2.0, 0.7 - 0.06 * k), t0 + k * 0.32, 1.0, 0.5 * np.sin(k + t0))
music += cel * 0.55
music = norm(music)
dyn = 0.7 + 0.15 * ss(21.6, 23, t_axis) * (1 - ss(29, 30, t_axis)) + 0.2 * ss(46.5, 47.5, t_axis)
music *= dyn * ss(0, 1.2, t_axis) * (1 - ss(DUR - 1.2, DUR, t_axis) * 0.95)

# ---------------------------------------------------------------- mix
wet = reverb(send) * db(-3)
music_st = music * db(-11) * (1 - duck * (1 - db(-10)))
amb_st = amb * db(4) * (1 - duck * (1 - db(-4)))
sfx_st = (sfx + wet) * (1 - ss(DUR - 0.4, DUR, t_axis))
mix = narr + music_st + amb_st + sfx_st
peak = np.abs(mix).max()
scale = db(-1) / peak if peak > db(-1) else 1.0
mix *= scale
out = os.path.join(ROOT, 'out/audio')
os.makedirs(out, exist_ok=True)
write_wav(os.path.join(out, 'stem_narration.wav'), narr * scale)
write_wav(os.path.join(out, 'stem_music.wav'), music_st * scale)
write_wav(os.path.join(out, 'stem_ambience.wav'), amb_st * scale)
write_wav(os.path.join(out, 'stem_sfx.wav'), sfx_st * scale)
write_wav(os.path.join(ROOT, 'out/soundtrack.wav'), mix)
print('peak', round(20 * np.log10(peak), 2), 'dBFS')
