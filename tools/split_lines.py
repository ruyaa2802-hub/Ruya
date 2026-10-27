"""Split a multi-line TTS take into one file per line.

Generate several lines of one character in a single TTS call, separated by
[long pause] tags (cheaper, and friendlier to API rate limits), then:

    .venv/bin/python tools/split_lines.py take.mp3 OUT_DIR L03_yastik L05_yastik L07_yastik ...
    .venv/bin/python tools/split_lines.py take.mp3 OUT_DIR L12_x L13_x --at 6.4   # explicit cut(s)

The N-1 longest silences become the cut points; every piece is trimmed to
its voiced part plus a short pad and written as 48 kHz wav.
"""
import os
import sys

import numpy as np
import soundfile as sf

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from ig.lipsync import load_audio  # noqa: E402

SR = 48000
HOP = 0.01
PAD = 0.07


def silences(env, thresh):
    runs, start = [], None
    for i, v in enumerate(env):
        if v < thresh and start is None:
            start = i
        elif v >= thresh and start is not None:
            runs.append((start, i))
            start = None
    return runs


def main():
    args = sys.argv[1:]
    at = None
    if "--at" in args:                       # explicit cut times in seconds, e.g. --at 2.3,6.4
        i = args.index("--at")
        at = [float(x) for x in args[i + 1].split(",")]
        del args[i:i + 2]
    src, out_dir, ids = args[0], args[1], args[2:]
    os.makedirs(out_dir, exist_ok=True)
    audio = load_audio(src, SR)
    hop = int(SR * HOP)
    n = len(audio) // hop
    env = np.sqrt((audio[: n * hop].reshape(n, hop) ** 2).mean(axis=1))
    env = np.convolve(env, np.ones(5) / 5, mode="same")
    thresh = np.percentile(env, 95) * 0.06
    if at:
        if len(at) != len(ids) - 1:
            sys.exit(f"--at needs {len(ids) - 1} cut times")
        bounds = [0] + [int(t / HOP) for t in at] + [n]
    else:
        runs = [r for r in silences(env, thresh) if r[0] > 0 and r[1] < n]
        cuts = sorted(sorted(runs, key=lambda r: r[1] - r[0], reverse=True)[: len(ids) - 1])
        if len(cuts) != len(ids) - 1:
            sys.exit(f"found {len(cuts) + 1} pieces, expected {len(ids)}")
        bounds = [0] + [(a + b) // 2 for a, b in cuts] + [n]
    for lid, a, b in zip(ids, bounds[:-1], bounds[1:]):
        voiced = np.nonzero(env[a:b] >= thresh)[0]
        s = max(a, a + voiced[0] - int(PAD / HOP))
        e = min(b, a + voiced[-1] + int(PAD / HOP))
        piece = audio[s * hop: e * hop]
        path = os.path.join(out_dir, f"{lid}.wav")
        sf.write(path, piece, SR)
        print(f"{lid}: {s * HOP:6.2f}-{e * HOP:6.2f}s  ({len(piece) / SR:.2f}s) -> {path}")


if __name__ == "__main__":
    main()
