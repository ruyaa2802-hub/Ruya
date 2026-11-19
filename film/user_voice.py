"""Fit the film to a user-recorded narration.

Splits the recording into the five scene lines, processes the voice, computes a
time warp (output time -> story time) so each scene lasts as long as its line,
and builds the soundtrack (music + foley mapped through the same warp).

Usage: python3 user_voice.py <recording> <workdir>
Writes <workdir>/warp.json and <workdir>/soundtrack_user.wav
"""
import json
import math
import os
import subprocess
import sys

import numpy as np
from scipy.io import wavfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import audio as A  # noqa
from timeline import *  # noqa

SR = A.SR
TEMPO = 1.1
# cut points (s) in the recording: middle of the pauses between scene lines
CUTS = [0.0, 8.9, 16.15, 26.68, 33.93, None]


def load_lines(src, work):
    lines = []
    for k in range(5):
        a, b = CUTS[k], CUTS[k + 1]
        out = os.path.join(work, f'u{k + 1}.wav')
        trim = f'atrim=start={a}' + (f':end={b}' if b else '')
        filt = (f'{trim},asetpts=PTS-STARTPTS,'
                'silenceremove=start_periods=1:start_threshold=-34dB:start_silence=0.05,'
                'areverse,silenceremove=start_periods=1:start_threshold=-34dB:start_silence=0.08,areverse,'
                f'rubberband=tempo={TEMPO}:formant=preserved,aresample={SR},'
                'highpass=f=70,equalizer=f=170:t=q:w=1.0:g=2.5,equalizer=f=3000:t=q:w=1.2:g=1.5,'
                'acompressor=threshold=0.15:ratio=2.5:attack=10:release=200:makeup=1.4')
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', src, '-af', filt, '-ac', '1', out], check=True)
        sr, v = wavfile.read(out)
        v = v.astype(np.float64) / 32768.0
        lines.append(v / (np.max(np.abs(v)) + 1e-9) * 0.62)
    return lines


def plan(lines):
    d = [len(v) / SR for v in lines]
    s = [0.3]
    s.append(s[0] + d[0] + 0.45)
    s.append(s[1] + d[1] + 0.45)
    s.append(s[2] + d[2] + 0.5)
    crash = s[3] + d[3] + 0.3
    s.append(crash + 2.5)
    l5_end = s[4] + d[4]
    text = l5_end + 0.55
    end = text + 2.3
    out = [0.0, s[1] - 0.3, s[2] - 0.2, s[3] - 0.6, crash, crash + 2.2, s[4], l5_end, text, end]
    film = [0.0, 6.6, 12.8, 20.2, SLIP[1], 28.8, 29.2, 37.45, TEXT_IN, 40.0]
    return s, out, film, end


def main(src, work):
    lines = load_lines(src, work)
    starts, outk, filmk, end = plan(lines)
    json.dump({'out': outk, 'film': filmk}, open(os.path.join(work, 'warp.json'), 'w'), indent=1)
    for k, (t0, v) in enumerate(zip(starts, lines)):
        print(f'line {k + 1}: {t0:.2f} -> {t0 + len(v) / SR:.2f}')
    print('warp out ', [round(x, 2) for x in outk])
    print('warp film', filmk)

    N = int(end * SR)
    f2o = lambda t: float(np.interp(t, filmk, outk))
    o2f = lambda t: np.interp(t, outk, filmk)
    A.N = N
    orig_place = A.place
    A.place = lambda buf, sig, t, gain=1.0, pan=0.0: orig_place(buf, sig, f2o(t), gain, pan)

    voice = np.zeros((2, N))
    venv = np.zeros(N)
    for t0, v in zip(starts, lines):
        orig_place(voice, v, t0, 1.0, 0.0)
        i0 = int(t0 * SR)
        venv[i0:i0 + len(v)] = 1.0
    voice = A.reverb(voice, A.IR_ROOM, 0.08)

    mus = A.music()
    fol = A.foley()
    # wind, with its level curve following story time
    t = np.arange(N) / SR
    tf = o2f(t)
    rng = np.random.default_rng(3)
    wd = np.zeros((2, N))
    for c in range(2):
        body = A.bp(rng.standard_normal(N), 180, 900)
        hi = A.bp(rng.standard_normal(N), 900, 3200) * 0.35
        lfo = 0.55 + 0.25 * np.sin(2 * np.pi * t / 7.3 + c) + 0.2 * np.sin(2 * np.pi * t / 2.9 + 2 * c)
        gust = 0.5 + 0.5 * np.sin(2 * np.pi * t / 11 + 1.3) ** 2
        wd[c] = (body + hi * gust) * lfo + A.lp(rng.standard_normal(N), 120) * 0.8
    level = np.interp(tf, [0, 1.0, 6.6, 8, 12.8, 20.2, 21, 26, 28.8, 34, 38.5, 40],
                      [0.0, 0.55, 0.5, 0.3, 0.32, 0.42, 0.6, 0.55, 0.4, 0.22, 0.15, 0.0])
    wd *= level * 0.14

    k = int(0.35 * SR)
    sm = np.convolve(venv, np.ones(k) / k, mode='same')
    mus *= 1.0 - 0.45 * sm
    mix = voice + mus * 0.42 + fol * 0.55 + wd * (1.0 - 0.3 * sm)
    mix *= np.minimum(1, t / 0.5)
    mix *= np.clip((end - t) / 0.6, 0, 1) ** 0.5
    mix = np.tanh(mix * 1.1) / 1.1
    mix = mix / np.max(np.abs(mix)) * 0.89
    wavfile.write(os.path.join(work, 'soundtrack_user.wav'), SR, (mix.T * 32767).astype(np.int16))
    print('duration', end)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
