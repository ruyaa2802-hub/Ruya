"""Render frames of the chameleon film with Blender (bpy, EEVEE).

  python3 blender/render.py --stills 1.5,6,15              → out/stills/s_<t>.png
  python3 blender/render.py --from 0 --to 9.5 --part 0     → out/frames/f_<n>.png + out/frames/f_<n>.json
Frames are rendered at 720×1280 (EEVEE on the CPU via Mesa); post.py upscales to
1080×1920 and adds the crisp text layer. Each frame also writes the 2D screen
positions of the points the overlay needs (labels, ruler) as JSON.
"""
import json
import math
import os
import subprocess
import sys
import time

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import scene  # noqa: E402

args = dict(zip(sys.argv[1::2], sys.argv[2::2]))
RES = (int(args.get('--w', 720)), int(args.get('--h', 1280)))


def narration_envelope():
    """100 Hz loudness envelope of the narration for the mouth flaps (0..1)."""
    p = os.path.join(ROOT, 'audio/narration.wav')
    if not os.path.exists(p):
        return None
    import numpy as np
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-f', 'f32le', '-ac', '1', '-ar', '16000', '-'], capture_output=True, check=True).stdout
    x = np.frombuffer(raw, dtype=np.float32)
    hop = 160
    rms = np.array([np.sqrt((x[i:i + 320] ** 2).mean()) for i in range(0, len(x) - 320, hop)])
    rms /= rms.max() + 1e-9
    env = np.clip((rms - 0.08) / 0.5, 0, 1)
    # smooth a little so the jaw does not chatter
    k = np.ones(5) / 5
    return list(np.convolve(env, k, mode='same'))


def project(sc, cam, p):
    v = world_to_camera_view(sc, cam, Vector(p))
    return [round(v.x, 4), round(1 - v.y, 4), round(v.z, 4)]


def render_at(sc, t, path, env):
    info = scene.update(t, env)
    bpy.context.view_layer.update()
    cam = scene.D['cam']
    out = {'t': t, 'shot': info.get('shot')}
    for k in ('energy', 'label_k', 'sticky', 'fast'):
        if k in info:
            out[k] = info[k]
    if info.get('labels'):
        out['labels'] = {k: project(sc, cam, v) for k, v in info['labels'].items()}
    if info.get('ruler'):
        r = info['ruler']
        out['ruler'] = {k: (project(sc, cam, v) if isinstance(v, tuple) else v) for k, v in r.items()}
    if info.get('tip'):
        out['tip'] = project(sc, cam, info['tip'])
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    with open(path.replace('.png', '.json'), 'w') as f:
        json.dump(out, f)


def main():
    sc = scene.build()
    sc.render.resolution_x, sc.render.resolution_y = RES
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = 'PNG'
    env = narration_envelope()
    if '--stills' in args:
        os.makedirs(os.path.join(ROOT, 'out/stills'), exist_ok=True)
        for s in args['--stills'].split(','):
            t = float(s)
            t0 = time.time()
            render_at(sc, t, os.path.join(ROOT, f'out/stills/s_{t:05.2f}.png'), env)
            print('still', t, round(time.time() - t0, 1), 's', flush=True)
        return
    f0 = round(float(args.get('--from', 0)) * scene.FPS)
    f1 = round(float(args.get('--to', scene.DURATION)) * scene.FPS)
    od = os.path.join(ROOT, 'out/frames')
    os.makedirs(od, exist_ok=True)
    t_start = time.time()
    for f in range(f0, f1):
        path = os.path.join(od, f'f_{f:05d}.png')
        if os.path.exists(path) and os.path.exists(path.replace('.png', '.json')):
            continue  # resumable
        render_at(sc, f / scene.FPS, path, env)
        done = f - f0 + 1
        el = time.time() - t_start
        if done % 10 == 0:
            print(f'frame {f}/{f1}  {el / done:.1f}s/frame  eta {(f1 - f - 1) * el / done / 60:.1f} min', flush=True)
    print('done', f0, f1, flush=True)


main()
