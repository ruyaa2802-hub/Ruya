"""SÜT – the milk carton who knows everyone's business.

Design: a one-litre gable-top carton, white with a sky-blue gable and a blue
wave at the foot, "SÜT" printed on its side. Warm brown eyes with lashes,
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
from ..sets.bedroom import _blobs
from .base import Character, build_armature, skin

A = 0.04                      # half width / depth
BODY_H, TOP_H = 0.19, 0.235
FACE_Z = 0.118
FACE_SCALE = 0.28
WHITE, BLUE = 0, 1


def build(col=None, loc=(0, 0, 0), rot=(0, 0, 0)):
    carton = M.plastic("carton_white", (0.95, 0.95, 0.97), 0.55)
    blue = M.plastic("carton_blue", (0.16, 0.42, 0.85), 0.5)
    rings = [(0.0, A - 0.002, A - 0.002), (0.004, A, A)] + [(z, A, A) for z in (0.02, 0.035, 0.06, 0.09, 0.12,
                                                                             0.15, 0.175, BODY_H)]
    rings += [(BODY_H + 0.012, A, A * 0.72), (BODY_H + 0.024, A, A * 0.45), (BODY_H + 0.036, A, A * 0.2),
              (TOP_H, A, 0.003)]

    def band(z, x, y):
        return BLUE if z > BODY_H - 0.002 or z < 0.026 else WHITE

    body = rounded_tube("sut_body", rings, segs=48, n=12, col=col, mats=band)
    body.data.materials.append(carton)
    body.data.materials.append(blue)
    fin = _blobs("sut_fin", [((0, 0, TOP_H + 0.008), (A, 0.003, 0.009))], carton, col, rings=6, segs=12)
    label = text_mesh("sut_label", "SÜT", 0.028, FONT, col, extrude=0.0002)
    label.data.materials.append(blue)
    for v in label.data.vertices:                     # on the +X side, reading front-to-back
        x, y, z = v.co
        v.co = (A + 0.0005 + z, x, 0.09 + y)
    spots = _blobs("sut_spots", [((A + 0.0004, 0.022, 0.155), (0.0006, 0.009, 0.007)),
                                 ((A + 0.0004, -0.018, 0.045), (0.0006, 0.007, 0.006))],
                   M.plastic("cow_spot", (0.05, 0.05, 0.06), 0.5), col, rings=6, segs=10)

    arm = build_armature("sut_rig", [("root", (0, 0, 0), (0, 0, 0.05), None),
                                      ("head", (0, 0, 0.05), (0, 0, TOP_H), "root")], col)

    def weights(obj):
        hw = [smoothstep(0.01, 0.07, v.co.z) for v in obj.data.vertices]
        return {"head": hw, "root": [1 - w for w in hw]}

    for o in (body, fin, label, spots):
        skin(o, arm, weights(o))

    arm.location = loc
    arm.rotation_euler = rot
    bpy.context.view_layer.update()
    mw = arm.matrix_world
    p = mw @ Vector((0, -A, FACE_Z))
    anchor = empty("sut_face", p, 0.01, col)
    anchor.matrix_world = look_rotation(mw.to_3x3() @ Vector((0, -1, 0))).to_4x4()
    anchor.location = p
    set_parent_keep(anchor, arm, "BONE", bone="head")
    anchor.scale = (FACE_SCALE,) * 3
    bpy.context.view_layer.update()
    spec = FaceSpec(skin=carton, lip=M.plastic("sut_lip", (0.85, 0.38, 0.45), 0.35),
                    brow=M.plastic("sut_brow", (0.22, 0.27, 0.42), 0.4), iris=(0.45, 0.3, 0.18), eye_r=0.046,
                    eye_dx=0.075, eye_z=0.04, eye_embed=0.35, brow_len=0.065, brow_th=0.01, brow_z=0.06,
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
