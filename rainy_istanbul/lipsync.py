"""Adds a jaw-open shape key to the MakeHuman body and keys it from a speech WAV.

    blender -b ep2.blend -P lipsync.py -- LINE.wav T_START_SECONDS
(saves the .blend in place; nothing else in the scene is touched)
"""
import bpy
import sys
import wave
import math
import numpy as np
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index("--") + 1:]
WAV, T0 = argv[0], float(argv[1])
FPS = bpy.context.scene.render.fps
JAW_DEG = 10.0

body = bpy.data.objects["Man"]
me = body.data
keys = me.shape_keys.key_blocks
basis = np.array([v.co for v in keys["Basis"].data])
mix = basis.copy()
for kb in keys[1:]:
    if kb.name == "JawOpen" or kb.mute or kb.value == 0:
        continue
    mix += kb.value * (np.array([v.co for v in kb.data]) - basis)

lips = body.vertex_groups["lips"].index
lip_idx = [v.index for v in me.vertices if any(g.group == lips and g.weight > 0.5 for g in v.groups)]
lp = mix[lip_idx]
mouth_z = float(np.median(lp[:, 2]))
front_y = float(lp[:, 1].min())
pivot = np.array([0.0, front_y + 0.085, mouth_z + 0.03])
print("mouth_z %.3f front_y %.3f" % (mouth_z, front_y))


def ramp(x, a, b):
    return np.clip((x - a) / (b - a), 0.0, 1.0)


x, y, z = mix[:, 0], mix[:, 1], mix[:, 2]
w = (1 - ramp(z, mouth_z - 0.004, mouth_z + 0.002))          # below the mouth line
w *= ramp(-y, -(pivot[1]), -(pivot[1] - 0.035))               # in front of the jaw hinge
w *= 1 - ramp(np.abs(x), 0.055, 0.075)
w *= ramp(z, mouth_z - 0.095, mouth_z - 0.06)                 # not the neck
lip_set = np.zeros(len(mix), bool)
lip_set[lip_idx] = True
w[lip_set & (z > mouth_z)] = 0.0

a = math.radians(JAW_DEG)
rel = mix - pivot
ry = rel[:, 1] * math.cos(a) - rel[:, 2] * math.sin(a)
rz = rel[:, 1] * math.sin(a) + rel[:, 2] * math.cos(a)
rot = np.stack([rel[:, 0], ry, rz], axis=1) + pivot
delta = (rot - mix) * w[:, None]
print("jaw verts", int((w > 0.01).sum()), "max move %.4f" % np.abs(delta).max())

if "JawOpen" in keys:
    body.shape_key_remove(keys["JawOpen"])
kb = body.shape_key_add(name="JawOpen", from_mix=False)
kb.data.foreach_set("co", (basis + delta).astype(np.float32).ravel())

# envelope from the WAV (RMS per frame), mapped to jaw opening
wf = wave.open(WAV)
sr = wf.getframerate()
pcm = np.frombuffer(wf.readframes(wf.getnframes()), np.int16).astype(np.float32)
if wf.getnchannels() == 2:
    pcm = pcm.reshape(-1, 2).mean(axis=1)
hop = sr / FPS
n = int(len(pcm) / hop)
rms = np.array([np.sqrt(np.mean(pcm[int(i * hop):int((i + 1) * hop)] ** 2) + 1e-9) for i in range(n)])
rms /= np.percentile(rms, 95)
open_ = np.clip((rms - 0.12) / 0.75, 0, 1) ** 0.8
# mouths don't snap: attack fast, release a bit slower
sm = np.zeros_like(open_)
for i in range(len(open_)):
    prev = sm[i - 1] if i else 0.0
    k = 0.75 if open_[i] > prev else 0.45
    sm[i] = prev + (open_[i] - prev) * k
f0 = int(round(T0 * FPS)) + 1
kb.value = 0.0
kb.keyframe_insert("value", frame=f0 - 1)
for i, v in enumerate(sm):
    kb.value = float(v) * 0.9
    kb.keyframe_insert("value", frame=f0 + i)
kb.value = 0.0
kb.keyframe_insert("value", frame=f0 + len(sm) + 1)
bpy.ops.wm.save_mainfile()
print("LIPSYNC_DONE frames", f0, "-", f0 + len(sm))
