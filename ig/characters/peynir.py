"""PEYNİR – a wedge of yellow cheese with holes, deeply offended.

Design: a thick kaşar wedge lying on one cut side, the other cut face toward
the viewer carries its face; waxy orange rind on the curved back. Green eyes,
expressive brows; dramatic, takes every pick-up personally.
"""
import math

import bpy
from mathutils import Vector

from .. import materials as M
from ..face import Face, FaceSpec
from ..shapes import bevel, mark_sharp, prism
from ..util import empty, look_rotation, set_parent_keep, smoothstep
from .base import Character, build_armature, skin

R, ALPHA, H = 0.15, math.radians(42), 0.095
FACE_Z = 0.05
FACE_SCALE = 0.3


def build(col=None, loc=(0, 0, 0), rot=(0, 0, 0)):
    x0 = -R / 2                                   # apex on the left; the front cut face runs along y = 0
    out, mats = [], []
    nf, na = 12, 18
    for i in range(nf):                           # front cut face (apex -> right)
        out.append((x0 + R * i / nf, 0.0))
        mats.append(0)
    for i in range(na):                           # rind arc
        a = ALPHA * i / na
        out.append((x0 + R * math.cos(a), R * math.sin(a)))
        mats.append(1)
    for i in range(nf):                           # back cut face (-> apex)
        r = R * (1 - i / nf)
        out.append((x0 + r * math.cos(ALPHA), r * math.sin(ALPHA)))
        mats.append(0)
    zs = [H * k / 10 for k in range(11)]
    body = prism("peynir_body", out, zs, col=col, mats=mats)
    body.data.materials.append(M.cheese())
    body.data.materials.append(M.plastic("cheese_rind", (0.88, 0.45, 0.08), 0.35))
    mark_sharp(body, 30)
    bevel(body, 0.004, 2, angle=30)

    arm = build_armature("peynir_rig", [("root", (0, 0.03, 0), (0, 0.03, 0.03), None),
                                         ("head", (0, 0.03, 0.03), (0, 0.03, H), "root")], col)
    hw = [smoothstep(0.005, 0.04, v.co.z) for v in body.data.vertices]
    skin(body, arm, {"head": hw, "root": [1 - w for w in hw]})

    arm.location = loc
    arm.rotation_euler = rot
    bpy.context.view_layer.update()
    mw = arm.matrix_world
    p = mw @ Vector((0.005, 0.0, FACE_Z))
    anchor = empty("peynir_face", p, 0.01, col)
    anchor.matrix_world = look_rotation(mw.to_3x3() @ Vector((0, -1, 0))).to_4x4()
    anchor.location = p
    set_parent_keep(anchor, arm, "BONE", bone="head")
    anchor.scale = (FACE_SCALE,) * 3
    bpy.context.view_layer.update()
    spec = FaceSpec(skin=M.cheese(), lip=M.plastic("peynir_lip", (0.85, 0.42, 0.08), 0.35),
                    brow=M.plastic("peynir_brow", (0.42, 0.22, 0.06), 0.4), iris=(0.3, 0.52, 0.22), eye_r=0.05,
                    eye_dx=0.085, eye_z=0.04, eye_embed=0.3, brow_len=0.075, brow_th=0.012, brow_z=0.062,
                    brow_arch=0.014, mouth_z=-0.085, mouth_w=0.055, lip_w=0.01, rest_lid_u=0.0, rest_lid_l=0.05)
    face = Face("peynir", spec, anchor, body)
    return Peynir("peynir", arm, body, face, loc, rot)


class Peynir(Character):
    rot_map = {
        "lean_f": [("root", 0, 1.0)],
        "lean_s": [("root", 2, 1.0)],
        "nod": [("head", 0, 1.0)],
        "tilt": [("head", 2, 1.0)],
        "twist": [("head", 1, 1.0)],
    }
