"""Pace dialogue for Shorts: cap long pauses, slight speed-up, cache word timings.

    .venv/bin/python tools/prep_lines.py episodes/b01_yastigin_isyani [--tempo 1.08] [--pause 0.35]

Reads audio/L*.wav, writes audio/paced/L*.wav (+ .words.json for lip sync).
Per-line pause overrides can be given in the episode folder's PACING dict
(episode.py), e.g. {"L01_yastik": 0.55}.
"""
import argparse
import glob
import importlib.util
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
from ig import audio, lipsync  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("episode")
ap.add_argument("--tempo", type=float, default=1.08)
ap.add_argument("--pause", type=float, default=0.35)
args = ap.parse_args()

overrides = {}
script = os.path.join(args.episode, "episode.py")
if os.path.exists(script):
    spec = importlib.util.spec_from_file_location("ep", script)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    overrides = getattr(mod, "PACING", {})

out_dir = os.path.join(args.episode, "audio", "paced")
os.makedirs(out_dir, exist_ok=True)
total = 0.0
for src in sorted(glob.glob(os.path.join(args.episode, "audio", "L*.wav"))):
    lid = os.path.splitext(os.path.basename(src))[0]
    dst = os.path.join(out_dir, lid + ".wav")
    audio.tighten(src, dst, overrides.get(lid, args.pause), args.tempo)
    d = lipsync.duration(dst)
    total += d
    words = lipsync.words(dst)
    print(f"{lid}: {lipsync.duration(src):.2f}s -> {d:.2f}s  " + " ".join(f"{w['word']}@{w['start']:.2f}" for w in words))
print(f"total {total:.2f}s")
