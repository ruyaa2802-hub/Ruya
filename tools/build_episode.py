"""Bake, render and encode an episode (or a time range of it).

    .venv/bin/python tools/build_episode.py episodes/b01_yastigin_isyani \
        --script test5s --preset test --out renders/b01_test

    --script   python file in the episode folder that defines CAST and build(tl, ep)
               (default: episode)
    --start/--end   seconds to render (default: whole timeline)
    --preset   draft | preview | test | final  (see ig/render.py)
    --size     output video size, e.g. 1080x1920 (frames are upscaled with lanczos)
    --blend    also save the baked .blend next to the video
"""
import argparse
import importlib.util
import os
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

import bpy  # noqa: E402

from ig import anim, audio, stage, subtitles  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("episode")
ap.add_argument("--script", default="episode")
ap.add_argument("--preset", default="test")
ap.add_argument("--start", type=float, default=0.0)
ap.add_argument("--end", type=float, default=None)
ap.add_argument("--out", default=None)
ap.add_argument("--size", default="1080x1920")
ap.add_argument("--blend", action="store_true")
ap.add_argument("--fps", type=int, default=24)
ap.add_argument("--frames", default=None, help="render only these frames, e.g. 0,36,72 (for look checks)")
ap.add_argument("--dry", action="store_true", help="bake and print the line/shot schedule, no render")
ap.add_argument("--resume", action="store_true", help="skip frames that already exist (continue a stopped render)")
ap.add_argument("--no-persistent", action="store_true",
                help="rebuild the render scene every frame (persistent data can drop keyframed props to black)")
args = ap.parse_args()

ep_dir = os.path.abspath(args.episode)
spec = importlib.util.spec_from_file_location("episode_script", os.path.join(ep_dir, args.script + ".py"))
ep = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ep)

out = os.path.abspath(args.out or os.path.join(ROOT, "renders", os.path.basename(ep_dir) + "_" + args.script))
os.makedirs(os.path.join(out, "frames"), exist_ok=True)

t_start = time.time()
chars = stage.build(cast=ep.CAST, preset=args.preset, fps=args.fps, home=getattr(ep, "HOME", None))
tl = anim.Timeline(chars, fps=args.fps)
ep.build(tl, ep_dir)
end = args.end if args.end is not None else tl.duration
f0, f1 = int(round(args.start * args.fps)), int(round(end * args.fps)) - 1
tl.bake(f0, f1)
print(f"[build] baked frames {f0}-{f1} in {time.time() - t_start:.1f}s", flush=True)
for ln in sorted(tl.lines, key=lambda x: x["t"]):
    print(f"[line] {ln['t']:6.2f}-{ln['t'] + ln['dur']:6.2f}  {ln['who']:<10} {os.path.basename(ln['path'])}")
for sh in tl.shots:
    print(f"[shot] {sh['t']:6.2f}  {sh['cam'].name}")
print(f"[build] duration {tl.duration:.2f}s")
if args.dry:
    sys.exit(0)
if args.blend:
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out, "episode.blend"))

sc = bpy.context.scene
if args.no_persistent:
    sc.render.use_persistent_data = False
sc.render.filepath = os.path.join(out, "frames", "f_")
if args.frames:
    for f in [int(x) for x in args.frames.split(",")]:
        sc.frame_set(f)
        sc.render.filepath = os.path.join(out, "frames", f"f_{f:04d}.png")
        t = time.time()
        bpy.ops.render.render(write_still=True)
        print(f"[build] frame {f} {time.time() - t:.1f}s", flush=True)
    sys.exit(0)

sc.render.use_overwrite = not args.resume
t_render = time.time()
bpy.ops.render.render(animation=True)
n = f1 - f0 + 1
print(f"[build] rendered {n} frames in {time.time() - t_render:.0f}s "
      f"({(time.time() - t_render) / n:.1f}s/frame)", flush=True)

wav = audio.mix(tl, os.path.join(out, "mix.wav"), f0 / args.fps, (f1 + 1) / args.fps)
size = tuple(int(x) for x in args.size.split("x")) if args.size else None
mp4 = audio.encode(os.path.join(out, "frames", "f_%04d.png"), args.fps, wav,
                   os.path.join(out, os.path.basename(out) + ".mp4"), size, start_number=f0)
texts = getattr(ep, "LINES", {})
ass = None
if texts:
    audio.srt(tl, os.path.splitext(mp4)[0] + ".srt", texts, f0 / args.fps)
    ass = subtitles.build_ass(tl.lines, texts, os.path.splitext(mp4)[0] + ".ass", f0 / args.fps)
title = getattr(ep, "TITLE", None)
ends_episode = f1 + 1 >= int(tl.duration * args.fps) - 1
final = os.path.splitext(mp4)[0] + "_final.mp4"
audio.finish(mp4, final, ass, title if ends_episode else None, tl.duration - f0 / args.fps - 1.3)
mp4 = final
print(f"[build] wrote {mp4} (total {time.time() - t_start:.0f}s)", flush=True)
