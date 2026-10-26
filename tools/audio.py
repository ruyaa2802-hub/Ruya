#!/usr/bin/env python3
"""Procedural sound design for an episode from its cue sheet.

    python3 tools/audio.py out/ep01.cues.json out/ep01.wav

Everything is synthesised offline with numpy (no external service): room tone,
phone vibration on wood / in a pocket, notification chimes, footsteps, cloth
rustle, kettle pour, sips, keypad taps, decline buzz, breaths and a small
adaptive score. There is NO synthetic voice: dialogue cues are written to
<out>.vo.txt as a recording script (timecodes + lines) for a real actor/TTS.
"""
import json, sys, wave
import numpy as np

SR = 48000
rng = np.random.default_rng(7)


def t_axis(d):
    return np.arange(int(d * SR)) / SR


def env(n, a=0.005, r=0.1, shape=1.0):
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) / max(r, 1e-4))
    return e ** shape


def noise(n):
    return rng.standard_normal(n)


def lp_fast(x, fc):
    # FFT brick-ish lowpass with soft roll-off (fast for long buffers)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 / (1 + (f / fc) ** 4)
    return np.fft.irfft(X, len(x))


def bp_fast(x, lo, hi):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= (1 / (1 + (lo / np.maximum(f, 1)) ** 4)) * (1 / (1 + (f / hi) ** 4))
    return np.fft.irfft(X, len(x))


def tone(freqs, d, decay=0.4, a=0.004):
    t = t_axis(d)
    s = sum(np.sin(2 * np.pi * f * t) * w for f, w in freqs)
    return s * env(len(t), a, decay)


# ---------------- sound library ----------------
def buzz_surface(d=0.55):
    t = t_axis(d)
    gate = ((t % 0.12) < 0.085).astype(float)
    gate[(t > 0.25) & (t < 0.32)] = 0
    motor = np.sin(2 * np.pi * 172 * t) * 0.5 + np.sign(np.sin(2 * np.pi * 172 * t)) * 0.2
    rattle = bp_fast(noise(len(t)), 900, 4000) * 0.35 * (np.sin(2 * np.pi * 172 * t) > 0.6)
    return (motor + rattle) * gate * 0.5


def buzz_pocket(d=0.5):
    t = t_axis(d)
    gate = ((t % 0.14) < 0.1).astype(float)
    return lp_fast(np.sin(2 * np.pi * 150 * t) + 0.3 * noise(len(t)), 400) * gate * 0.45


def notif_good():
    return np.concatenate([tone([(1318.5, 1), (2637, 0.2)], 0.18, 0.12), tone([(1760, 1), (3520, 0.15)], 0.6, 0.35)]) * 0.28


def notif_bad():
    return np.concatenate([tone([(880, 1), (1760, 0.15)], 0.12, 0.08), tone([(698.5, 1), (1397, 0.15)], 0.45, 0.25)]) * 0.26


def tap():
    n = int(0.03 * SR)
    return bp_fast(noise(n), 1500, 6000) * env(n, 0.0008, 0.006) * 0.25


def key():
    n = int(0.05 * SR)
    return (bp_fast(noise(n), 2000, 7000) * env(n, 0.0005, 0.005) * 0.25 + tone([(1200, 1)], 0.05, 0.015) * 0.05)


def step(gain=1.0):
    n = int(0.25 * SR)
    thump = lp_fast(noise(n), 180) * env(n, 0.003, 0.04) * 1.4
    scuff = bp_fast(noise(n), 800, 5000) * env(n, 0.02, 0.06) * 0.15
    return (thump + scuff) * 0.5 * gain


def cloth(d=0.6, gain=1.0):
    n = int(d * SR)
    x = bp_fast(noise(n), 600, 7000)
    e = np.sin(np.linspace(0, np.pi, n)) ** 1.5 * (0.6 + 0.4 * np.abs(np.sin(np.linspace(0, 9, n))))
    return x * e * 0.06 * gain


def creak(d=0.8, f0=210):
    t = t_axis(d)
    f = f0 * (1 + 0.25 * np.sin(2 * np.pi * 2.5 * t))
    ph = np.cumsum(f) / SR * 2 * np.pi
    pulses = (np.sin(ph) > 0.97).astype(float)
    return bp_fast(pulses, 200, 2500) * np.sin(np.linspace(0, np.pi, len(t))) * 0.5


def pour(d=1.3):
    n = int(d * SR)
    t = t_axis(d)
    pitch = np.linspace(900, 520, n)  # cup filling -> resonance drops
    x = bp_fast(noise(n), 300, 6000) * 0.25
    ph = np.cumsum(pitch) / SR * 2 * np.pi
    bubbles = np.sin(ph) * (0.5 + 0.5 * np.sin(2 * np.pi * 7 * t)) * 0.08
    e = np.minimum(1, t / 0.08) * np.minimum(1, (d - t) / 0.12)
    return (x + bubbles) * e * 0.6


def clink(f=2300):
    return tone([(f, 1), (f * 2.76, 0.4), (f * 5.4, 0.2)], 0.35, 0.09) * 0.15


def thud(gain=1.0):
    n = int(0.2 * SR)
    return lp_fast(noise(n), 300) * env(n, 0.002, 0.03) * 0.6 * gain


def sip(d=0.7, gain=1.0):
    n = int(d * SR)
    x = bp_fast(noise(n), 1500, 9000)
    e = np.zeros(n)
    for c in (0.25, 0.5):
        e += np.exp(-((np.arange(n) / SR - c * d) / 0.05) ** 2)
    return x * e * 0.08 * gain


def breath(d=0.6, inhale=True, gain=1.0):
    n = int(d * SR)
    x = bp_fast(noise(n), 400 if inhale else 250, 3500 if inhale else 2200)
    e = np.sin(np.linspace(0, np.pi, n)) ** (1.2 if inhale else 0.8)
    return x * e * 0.05 * gain


def decline():
    t = t_axis(0.55)
    s = (np.sign(np.sin(2 * np.pi * 220 * t)) * 0.5 + np.sin(2 * np.pi * 110 * t)) * ((t < 0.22) | (t > 0.3))
    return lp_fast(s, 1800) * env(len(t), 0.005, 0.5) * 0.2


def loading(d=1.25):
    out = np.zeros(int(d * SR))
    for i in range(int(d / 0.3)):
        k = tone([(1050, 1)], 0.08, 0.03) * 0.05
        s = int(i * 0.3 * SR)
        out[s:s + len(k)] += k[: len(out) - s]
    return out


def deduct():
    t = t_axis(0.18)
    f = np.linspace(900, 600, len(t))
    return np.sin(np.cumsum(f) / SR * 2 * np.pi) * env(len(t), 0.003, 0.05) * 0.12


def result_beep():
    return tone([(523, 1), (1046, 0.2)], 0.4, 0.15) * 0.15


def nose_laugh():
    out = np.zeros(int(0.6 * SR))
    for c in (0.0, 0.22):
        b = breath(0.16, False, 1.8)
        s = int(c * SR)
        out[s:s + len(b)] += b
    return out


def app_open():
    return tone([(1567, 1)], 0.12, 0.05) * 0.06


def room_tone(d):
    n = int(d * SR)
    x = lp_fast(noise(n), 260) * 0.012 + bp_fast(noise(n), 2000, 6000) * 0.0015
    t = t_axis(d)
    x += np.sin(2 * np.pi * 50 * t) * 0.0015  # faint fridge hum
    return x


# ---------------- score ----------------
def pad(freqs, d, amp=0.05, warmth=1800, trem=0.0):
    t = t_axis(d)
    s = np.zeros(len(t))
    for f in freqs:
        for det in (-0.6, 0.6):
            s += np.sin(2 * np.pi * (f + det) * t + rng.random() * 6) / len(freqs)
    s = lp_fast(s, warmth)
    e = np.minimum(1, t / 0.8) * np.minimum(1, (d - t) / 0.6)
    if trem:
        e *= 1 - trem * (0.5 + 0.5 * np.sin(2 * np.pi * 4 * t))
    return s * e * amp


def pluck(f, d=1.2, amp=0.08):
    t = t_axis(d)
    s = sum(np.sin(2 * np.pi * f * k * t) * (0.6 ** k) for k in range(1, 5))
    return s * env(len(t), 0.003, 0.45) * amp


def music(mood, d):
    t = t_axis(d)
    if mood == 'hope':  # warm major pad + soft plucks
        s = pad([261.6, 329.6, 392.0, 523.3], d, 0.045)
        for i, f in enumerate([523.3, 659.3, 784.0, 659.3, 587.3, 659.3, 784.0, 1046.5] * 4):
            st = int(i * 0.75 * SR)
            if st >= len(s):
                break
            p = pluck(f, 1.0, 0.03)
            s[st:st + len(p)] += p[: len(s) - st]
        return s
    if mood == 'tension':  # minor, pulse at heartbeat rate
        s = pad([220.0, 261.6, 329.6], d, 0.04, 1200)
        for i in range(int(d / 0.75)):
            st = int(i * 0.75 * SR)
            p = lp_fast(noise(int(0.15 * SR)), 90) * env(int(0.15 * SR), 0.005, 0.05) * 0.25
            s[st:st + len(p)] += p[: len(s) - st]
        return s
    if mood == 'pressure':  # accelerating pulse + rising cluster
        s = pad([196.0, 233.1, 277.2, 293.7], d, 0.05, 1500, trem=0.4)
        x, i = 0.0, 0
        while x < d:
            st = int(x * SR)
            p = lp_fast(noise(int(0.12 * SR)), 110) * env(int(0.12 * SR), 0.004, 0.04) * 0.3
            s[st:st + len(p)] += p[: len(s) - st]
            x += max(0.28, 0.62 - i * 0.03)
            i += 1
        return s * np.linspace(0.8, 1.2, len(s))
    if mood == 'fragile':  # thin, hopeful, about to break
        s = pad([392.0, 493.9, 587.3], d, 0.03, 2500)
        for i, f in enumerate([784.0, 987.8, 1174.7, 987.8]):
            st = int(i * 0.5 * SR)
            p = pluck(f, 0.9, 0.025)
            s[st:st + len(p)] += p[: len(s) - st]
        return s
    if mood == 'ironic':  # small out-of-tune music box resolve
        s = np.zeros(len(t))
        for i, f in enumerate([783.9, 659.3, 523.3, 494.0, 523.3 * 0.985]):
            st = int((0.15 + i * 0.42) * SR)
            if st >= len(s):
                break
            p = pluck(f, 1.4, 0.05)
            s[st:st + len(p)] += p[: len(s) - st]
        return s + pad([130.8, 196.0], d, 0.02, 600)
    return np.zeros(len(t))


LIB = {
    'buzz_surface': lambda c: buzz_surface(c.get('dur') or 0.55),
    'buzz_pocket': lambda c: buzz_pocket(c.get('dur') or 0.5),
    'notif_good': lambda c: notif_good(), 'notif_bad': lambda c: notif_bad(),
    'tap': lambda c: tap(), 'key': lambda c: key(), 'step': lambda c: step(c.get('gain', 1)),
    'cloth': lambda c: cloth(c.get('dur') or 0.6, c.get('gain', 1)),
    'bed_creak': lambda c: creak(c.get('dur') or 0.8, 180), 'chair_creak': lambda c: creak(c.get('dur') or 0.9, 260),
    'pour': lambda c: pour(c.get('dur') or 1.3), 'kettle_lift': lambda c: clink(1700) * 0.6,
    'kettle_down': lambda c: np.concatenate([thud(0.8), np.zeros(10)]), 'mug_down': lambda c: clink(2300) + np.pad(thud(0.4), (0, int(0.35 * SR) - int(0.2 * SR))),
    'mug_lift': lambda c: clink(2600) * 0.4, 'pickup': lambda c: tap() * 2, 'phone_down': lambda c: thud(0.5) + np.pad(tap() * 2, (0, int(0.2 * SR) - int(0.03 * SR))),
    'sip': lambda c: sip(c.get('dur') or 0.7, c.get('gain', 1)), 'breath_in': lambda c: breath(c.get('dur') or 0.55, True, 1.2),
    'breath_out': lambda c: breath(c.get('dur') or 0.9, False, 1.4 * c.get('gain', 1)), 'sigh': lambda c: breath(c.get('dur') or 1.3, False, 1.8),
    'decline': lambda c: decline(), 'loading': lambda c: loading(c.get('dur') or 1.25), 'deduct': lambda c: deduct(),
    'result_beep': lambda c: result_beep(), 'nose_laugh': lambda c: nose_laugh(), 'app_open': lambda c: app_open(),
}


def main(cue_path, out_path):
    data = json.load(open(cue_path))
    dur = data['duration']
    n = int((dur + 0.5) * SR)
    L = np.zeros(n); R = np.zeros(n)
    vo = []

    def place(sig, t, pan=0.0, gain=1.0, offset=0.0):
        if offset > 0:
            sig = sig[int(offset * SR):]
        s = int(t * SR)
        if s >= n or len(sig) == 0:
            return
        e = min(n, s + len(sig))
        gl, gr = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        L[s:e] += sig[: e - s] * gl * gain * 1.41
        R[s:e] += sig[: e - s] * gr * gain * 1.41

    for c in data['cues']:
        typ = c['type']
        if typ == 'music':
            m = music(c['mood'], c['dur'])
            # small inter-channel delay widens the score
            place(m, c['t'], -0.15, 1.0); place(m * 0.9, c['t'] + 0.013, 0.15, 1.0)
            continue
        if typ == 'room_tone':
            place(room_tone(c['dur']), c['t'], 0, 1.0)
            continue
        if typ == 'voice_marker':
            vo.append(c)
            continue
        fn = LIB.get(typ)
        if not fn:
            continue
        sig = fn(c)
        if c.get('dur') and typ in ('pour', 'loading', 'buzz_surface', 'buzz_pocket'):
            # cue may have been trimmed by the edit
            sig = sig[: int((c['dur'] + c.get('offset', 0)) * SR)]
        pan = {'step': rng.uniform(-0.3, 0.3), 'key': 0.15, 'notif_bad': 0.1, 'notif_good': 0.1}.get(typ, 0.0)
        place(sig, c['t'], pan, c.get('gain', 1.0) if typ not in ('step', 'cloth', 'breath_out', 'sip') else 1.0, c.get('offset', 0.0))

    # gentle master: soft clip + normalise to -1 dBFS peak
    mix = np.stack([L, R], 1)
    mix = np.tanh(mix * 1.6) / 1.6
    mix /= max(1e-6, np.abs(mix).max()) / 0.89
    pcm = (mix * 32767).astype('<i2')
    with wave.open(out_path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    with open(out_path.rsplit('.', 1)[0] + '.vo.txt', 'w') as f:
        f.write('# Seslendirme senaryosu (VO) — dudak senkronu bu zamanlara göre animasyonlandı\n')
        for c in vo:
            f.write(f"{c['t']:7.2f} s  ({c['dur']:.2f} s)  [{c.get('shot', '')}]  {c['text']}\n")
    print('wrote', out_path, f'{dur:.2f}s', len(data['cues']), 'cues,', len(vo), 'VO lines')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
