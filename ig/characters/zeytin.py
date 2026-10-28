"""ZEYTİN – a big green olive holding court on a bowl of olives.

Design: a glossy, slightly mottled green olive (cartoon-sized), sitting on a
small white bowl of green and black olives. Bright amber eyes, dark green
brows; quick, cheeky, a bit jealous of everyone who gets picked.
"""
import math

import bpy
from mathutils import Vector

from .. import materials as M
from ..face import Face, FaceSpec
from ..sets.bedroom import _blobs, _lathe
from ..shapes import rounded_tube
from ..util import empty, look_rotation, set_parent_keep, smoothstep
from .base import Character, build_armature, skin

RX, RZ = 0.04, 0.05             # olive half width / half height
BASE = 0.045                    # olive bottom sits this high (on the other olives)
FACE_Z = BASE + RZ - 0.002
FACE_SCALE = 0.22


def build(col=None, loc=(0, 0, 0), rot=(0, 0, 0)):
    green = M.mottled("olive_green", (0.42, 0.52, 0.12), (0.26, 0.36, 0.06))
    black = M.mottled("olive_black", (0.09, 0.05, 0.08), (0.03, 0.02, 0.03), scale=40.0)
    rings = []
    for i in range(17):
        a = -math.pi / 2 + math.pi * i / 16
        r = RX * math.cos(a)
        rings.append((BASE + RZ + RZ * math.sin(a), max(r, 0.0015), max(r * 0.95, 0.0015)))
    body = rounded_tube("zeytin_body", rings, segs=40, n=2.0, col=col)
    body.data.materials.append(green)
    stem = _blobs("zeytin_stem", [((0, 0, BASE + 2 * RZ + 0.002), (0.006, 0.006, 0.005))],
                  M.plastic("olive_stem", (0.35, 0.28, 0.12), 0.6), col, rings=6, segs=10)

    arm = build_armature("zeytin_rig", [("root", (0, 0, BASE), (0, 0, BASE + 0.03), None),
                                         ("head", (0, 0, BASE + 0.03), (0, 0, BASE + 2 * RZ), "root")], col)

    def weights(obj):
        hw = [smoothstep(BASE + 0.005, BASE + 0.04, v.co.z) for v in obj.data.vertices]
        return {"head": hw, "root": [1 - w for w in hw]}

    for o in (body, stem):
        skin(o, arm, weights(o))

    # the bowl and the crowd of ordinary olives (props, they ride with the rig object)
    bowl = _lathe("zeytin_bowl", [(0.0, -0.02), (0.035, -0.02), (0.06, 0.0), (0.075, 0.03), (0.07, 0.03),
                                  (0.055, 0.004), (0.0, -0.012)], M.ceramic("bowl_white", (0.92, 0.9, 0.85)),
                  col, (0, 0, 0.0), segs=40)
    bowl.parent = arm
    bowl.location = (0, 0, 0.02)
    crowd = []
    for k, (x, y) in enumerate(((-0.035, -0.02), (0.032, -0.025), (-0.03, 0.03), (0.035, 0.028), (0.0, 0.04),
                                (-0.045, 0.005), (0.048, 0.0))):
        crowd.append(((x, y, 0.035 + 0.004 * (k % 2)), (0.016, 0.014, 0.02)))
    olives_g = _blobs("zeytin_crowd_green", crowd[::2], green, col, rings=10, segs=14, subsurf=1)
    olives_b = _blobs("zeytin_crowd_black", crowd[1::2], black, col, rings=10, segs=14, subsurf=1)
    for o in (olives_g, olives_b):
        o.parent = arm

    arm.location = loc
    arm.rotation_euler = rot
    bpy.context.view_layer.update()
    mw = arm.matrix_world
    p = mw @ Vector((0, -RX * 0.95, FACE_Z))
    anchor = empty("zeytin_face", p, 0.01, col)
    anchor.matrix_world = look_rotation(mw.to_3x3() @ Vector((0, -1, 0))).to_4x4()
    anchor.location = p
    set_parent_keep(anchor, arm, "BONE", bone="head")
    anchor.scale = (FACE_SCALE,) * 3
    bpy.context.view_layer.update()
    spec = FaceSpec(skin=green, lip=M.plastic("zeytin_lip", (0.75, 0.3, 0.25), 0.35),
                    brow=M.plastic("zeytin_brow", (0.12, 0.18, 0.04), 0.4), iris=(0.75, 0.5, 0.12), eye_r=0.05,
                    eye_dx=0.085, eye_z=0.045, eye_embed=0.3, brow_len=0.07, brow_th=0.012, brow_z=0.064,
                    brow_arch=0.016, mouth_z=-0.085, mouth_w=0.05, lip_w=0.01, lashes=True,
                    rest_lid_u=0.05, rest_lid_l=0.05)
    face = Face("zeytin", spec, anchor, body)
    return Zeytin("zeytin", arm, body, face, loc, rot)


class Zeytin(Character):
    rot_map = {
        "lean_f": [("root", 0, 1.0)],
        "lean_s": [("root", 2, 1.0)],
        "nod": [("head", 0, 1.0)],
        "tilt": [("head", 2, 1.0)],
        "twist": [("head", 1, 1.0)],
    }
