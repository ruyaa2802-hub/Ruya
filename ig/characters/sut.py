"""SÜT – the milk bottle who knows everyone's business.

Design: a classic one-litre glass milk bottle, full of milk, with a blue foil
cap and "SÜT" printed on the glass in blue. Warm brown eyes with lashes,
pink lips; calm, a little gossipy, always one step ahead.
"""
import math

import bpy
from mathutils import Vector

from .. import materials as M
from ..audio import FONT
from ..face import Face, FaceSpec
from ..shapes import rounded_tube, text_mesh
from ..util import empty, look_rotation, set_parent_keep, smoothstep
from .base import Character, build_armature, skin

R = 0.042                      # body radius
H = 0.235                      # glass height (without the cap)
FACE_Z = 0.105
FACE_SCALE = 0.3
MILK_TOP = 0.205

# (z, radius) outside profile of the glass, bottom to top
PROFILE = [(0.0, R - 0.006), (0.004, R - 0.001), (0.012, R), (0.05, R), (0.1, R), (0.14, R), (0.16, R * 0.97),
           (0.175, R * 0.86), (0.19, R * 0.68), (0.2, R * 0.58), (0.212, R * 0.54), (0.222, R * 0.56),
           (0.228, R * 0.6), (H, R * 0.58)]


def _radius_at(z):
    for (z0, r0), (z1, r1) in zip(PROFILE, PROFILE[1:]):
        if z0 <= z <= z1:
            return r0 + (r1 - r0) * (z - z0) / (z1 - z0)
    return PROFILE[-1][1]


def build(col=None, loc=(0, 0, 0), rot=(0, 0, 0)):
    glass = M.glass("milk_glass", (0.95, 0.98, 1.0), roughness=0.02)
    milk = M.milk()
    blue = M.metal("milk_cap", (0.15, 0.38, 0.9), 0.3)
    ink = M.plastic("milk_ink", (0.16, 0.42, 0.85), 0.4)

    body = rounded_tube("sut_body", [(z, r, r) for z, r in PROFILE], segs=48, n=2.0, col=col)
    body.data.materials.append(glass)
    inner = [(z, _radius_at(z) - 0.0035, _radius_at(z) - 0.0035) for z in
             (0.004, 0.012, 0.05, 0.1, 0.14, 0.16, 0.175, 0.19, 0.2, MILK_TOP)]
    contents = rounded_tube("sut_milk", inner, segs=48, n=2.0, col=col)
    contents.data.materials.append(milk)
    cap = rounded_tube("sut_cap", [(H - 0.004, R * 0.6, R * 0.6), (H + 0.004, R * 0.62, R * 0.62),
                                   (H + 0.012, R * 0.6, R * 0.6), (H + 0.014, R * 0.5, R * 0.5)],
                       segs=32, n=2.0, col=col)
    cap.data.materials.append(blue)
    label = text_mesh("sut_label", "SÜT", 0.026, FONT, col, extrude=0.0002)
    label.data.materials.append(ink)
    for v in label.data.vertices:                       # printed on the glass, on the +X side
        x, y, z = v.co
        a = x / R
        rr = R + 0.0004 + z
        v.co = (rr * math.cos(a), rr * math.sin(a), 0.065 + y)

    arm = build_armature("sut_rig", [("root", (0, 0, 0), (0, 0, 0.05), None),
                                      ("head", (0, 0, 0.05), (0, 0, H + 0.015), "root")], col)

    def weights(obj):
        hw = [smoothstep(0.01, 0.07, v.co.z) for v in obj.data.vertices]
        return {"head": hw, "root": [1 - w for w in hw]}

    for o in (body, contents, cap, label):
        skin(o, arm, weights(o))

    arm.location = loc
    arm.rotation_euler = rot
    bpy.context.view_layer.update()
    mw = arm.matrix_world
    p = mw @ Vector((0, -R, FACE_Z))
    anchor = empty("sut_face", p, 0.01, col)
    anchor.matrix_world = look_rotation(mw.to_3x3() @ Vector((0, -1, 0))).to_4x4()
    anchor.location = p
    set_parent_keep(anchor, arm, "BONE", bone="head")
    anchor.scale = (FACE_SCALE,) * 3
    bpy.context.view_layer.update()
    spec = FaceSpec(skin=milk, lip=M.plastic("sut_lip", (0.85, 0.38, 0.45), 0.35),
                    brow=M.plastic("sut_brow", (0.22, 0.27, 0.42), 0.4), iris=(0.45, 0.3, 0.18), eye_r=0.046,
                    eye_dx=0.078, eye_z=0.04, eye_embed=0.25, brow_len=0.065, brow_th=0.01, brow_z=0.06,
                    brow_arch=0.012, mouth_z=-0.08, mouth_w=0.048, lip_w=0.01, lashes=True,
                    rest_lid_u=0.22, rest_lid_l=0.08)
    face = Face("sut", spec, anchor, body)
    return Sut("sut", arm, body, face, loc, rot)


class Sut(Character):
    rot_map = {
        "lean_f": [("root", 0, 1.0)],
        "lean_s": [("root", 2, 1.0)],
        "nod": [("head", 0, 1.0)],
        "tilt": [("head", 2, 1.0)],
        "twist": [("head", 1, 1.0)],
    }
