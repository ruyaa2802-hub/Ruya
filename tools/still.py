"""Render look-development stills: wide shot + close-ups with expression presets.

    .venv/bin/python tools/still.py OUT_DIR [preset]
"""
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import bpy  # noqa: E402

from ig import render, stage  # noqa: E402
from ig.expressions import EXPR  # noqa: E402

out = sys.argv[1]
preset = sys.argv[2] if len(sys.argv) > 2 else "draft"
shots = sys.argv[3].split(",") if len(sys.argv) > 3 else None
os.makedirs(out, exist_ok=True)
chars = stage.build(preset=preset)
Y, B = chars["yastik"], chars["battaniye"]

SHOTS = {
    "wide": dict(cam=((2.05, -2.9, 1.2), (0.5, 0.2, 0.5), 30, 4.0),
                 y={**EXPR["tired"], "gaze_x": 0.3, "gaze_y": -0.15},
                 b={**EXPR["offended"], "gaze_x": -0.35, "gaze_y": 0.25, "arm_R_raise": 0.6}),
    "cu_yastik": dict(cam=("yastik", 0.95, -15, 0.05, 50, 2.8),
                      y={**EXPR["tired"], "m_open": 0.35}, b={}),
    "cu_yastik_shout": dict(cam=("yastik", 0.95, -15, 0.05, 50, 2.8),
                            y={**EXPR["shout"]}, b={}),
    "cu_battaniye": dict(cam=("battaniye", 1.1, 20, 0.08, 45, 2.8),
                         y={}, b={**EXPR["dramatic"], "m_open": 0.5, "arm_L_raise": 1.2, "arm_L_curl": 0.8}),
    "cu_battaniye_soft": dict(cam=("battaniye", 1.1, 20, 0.08, 45, 2.8),
                              y={}, b={**EXPR["touched"]}),
}

for name, s in SHOTS.items():
    if shots and name not in shots:
        continue
    Y.apply(s["y"])
    B.apply(s["b"])
    if isinstance(s["cam"][0], str):
        who, dist, yaw, height, lens, f = s["cam"]
        loc, tgt = render.face_frame(chars[who], dist, yaw, height, look=(0, 0, -0.04))
    else:
        loc, tgt, lens, f = s["cam"]
    cam = render.camera(f"cam_{name}", loc, tgt, lens, f)
    bpy.context.scene.camera = cam
    Y.apply(s["y"])
    B.apply(s["b"])
    bpy.context.scene.render.filepath = os.path.join(out, f"{name}.png")
    t = time.time()
    bpy.ops.render.render(write_still=True)
    print(f"[still] {name} {time.time() - t:.1f}s", flush=True)
