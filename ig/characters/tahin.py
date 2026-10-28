"""TAHİN – the jar of tahini that has been in the fridge for years.

Design: a squat glass jar of tahini at the back of the bottom shelf. The oil
has long since separated into a dark layer on top; the lid is dusty and
rusting; the paper label is faded, with an "SKT: 2019" sticker. White bushy
brows, a white moustache and little round glasses: everyone's old uncle.
Speaks slowly, has seen it all.
"""
import math

import bpy
from mathutils import Vector

from .. import materials as M
from ..audio import FONT
from ..face import Face, FaceSpec, surface_depth
from ..sets.bedroom import _blobs
from ..shapes import rounded_tube, text_mesh
from ..util import empty, look_rotation, mesh_object, set_parent_keep, smoothstep
from .base import Character, build_armature, skin

R, H = 0.05, 0.12
LABEL = (0.028, 0.098)          # label band height
FACE_Z = 0.066
FACE_SCALE = 0.3


def _torus(name, r, t, col, segs=40, tsegs=8):
    verts, faces = [], []
    for i in range(segs):
        a = 2 * math.pi * i / segs
        for j in range(tsegs):
            b = 2 * math.pi * j / tsegs
            rr = r + t * math.cos(b)
            verts.append((rr * math.cos(a), t * math.sin(b), rr * math.sin(a)))     # ring in the XZ plane
    for i in range(segs):
        for j in range(tsegs):
            a, b = i * tsegs + j, i * tsegs + (j + 1) % tsegs
            c, d = ((i + 1) % segs) * tsegs + j, ((i + 1) % segs) * tsegs + (j + 1) % tsegs
            faces.append((a, c, d, b))
    return mesh_object(name, verts, faces, col=col)


def build(col=None, loc=(0, 0, 0), rot=(0, 0, 0)):
    glass = M.glass("tahin_glass", (0.92, 0.9, 0.82), roughness=0.12)
    paste = M.plastic("tahin_paste", (0.72, 0.56, 0.36), 0.6)
    oil = M.plastic("tahin_oil", (0.42, 0.26, 0.08), 0.1)
    lid = M.dusty("tahin_lid", (0.55, 0.35, 0.15), dust=(0.6, 0.58, 0.55), amount=0.6, roughness=0.35,
                  metallic=1.0)
    paper = M.dusty("tahin_label", (0.78, 0.64, 0.4), dust=(0.66, 0.6, 0.5), amount=0.3, roughness=0.8)
    ink = M.plastic("tahin_ink", (0.45, 0.22, 0.1), 0.7)
    white = M.fabric("tahin_white", (0.93, 0.92, 0.9), sheen=0.8, fuzz=0.4, wrinkle=0.0)

    rings = [(0.0, R - 0.005, R - 0.005), (0.004, R, R), (0.11, R, R), (0.115, R - 0.004, R - 0.004)]
    jar = rounded_tube("tahin_jar", rings, segs=48, n=2.0, col=col)
    jar.data.materials.append(glass)
    # contents: paste up to 0.09, then the separated oil on top
    content = rounded_tube("tahin_content", [(0.004, R - 0.003, R - 0.003), (0.088, R - 0.003, R - 0.003),
                                             (0.089, R - 0.003, R - 0.003), (0.1, R - 0.003, R - 0.003)],
                           segs=48, n=2.0, col=col, mats=lambda z, x, y: 1 if z > 0.0885 else 0)
    content.data.materials.append(paste)
    content.data.materials.append(oil)
    lid_o = rounded_tube("tahin_lid", [(0.11, R + 0.003, R + 0.003), (0.13, R + 0.003, R + 0.003),
                                       (0.133, R, R)], segs=48, n=2.0, col=col)
    lid_o.data.materials.append(lid)
    label = rounded_tube("tahin_label", [(LABEL[0], R + 0.0012, R + 0.0012), (LABEL[1], R + 0.0012, R + 0.0012)],
                         segs=48, n=2.0, col=col, cap_bottom=False, cap_top=False)
    label.data.materials.append(paper)
    words = text_mesh("tahin_text", "TAHİN", 0.016, FONT, col, extrude=0.0002)
    words.data.materials.append(ink)
    sticker = text_mesh("tahin_skt", "SKT: 2019", 0.008, FONT, col, extrude=0.0002)
    sticker.data.materials.append(M.plastic("skt_red", (0.75, 0.08, 0.06), 0.5))
    for obj, a0, z0 in ((words, math.radians(55), 0.06), (sticker, math.radians(-60), 0.036)):
        for v in obj.data.vertices:                       # wrapped around the label (sides, the face is in front)
            x, y, z = v.co
            a = a0 + x / R - math.pi / 2
            rr = R + 0.0016 + z
            v.co = (rr * math.cos(a), rr * math.sin(a), z0 + y)

    arm = build_armature("tahin_rig", [("root", (0, 0, 0), (0, 0, 0.03), None),
                                        ("head", (0, 0, 0.03), (0, 0, 0.135), "root")], col)

    def weights(obj):
        hw = [smoothstep(0.005, 0.04, v.co.z) for v in obj.data.vertices]
        return {"head": hw, "root": [1 - w for w in hw]}

    for o in (jar, content, lid_o, label, words, sticker):
        skin(o, arm, weights(o))

    arm.location = loc
    arm.rotation_euler = rot
    bpy.context.view_layer.update()
    mw = arm.matrix_world
    p = mw @ Vector((0, -R - 0.0012, FACE_Z))
    anchor = empty("tahin_face", p, 0.01, col)
    anchor.matrix_world = look_rotation(mw.to_3x3() @ Vector((0, -1, 0))).to_4x4()
    anchor.location = p
    set_parent_keep(anchor, arm, "BONE", bone="head")
    anchor.scale = (FACE_SCALE,) * 3
    bpy.context.view_layer.update()
    spec = FaceSpec(skin=paper, lip=M.plastic("tahin_lip", (0.6, 0.35, 0.28), 0.5), brow=white,
                    iris=(0.4, 0.32, 0.22), eye_r=0.042, eye_dx=0.08, eye_z=0.035, eye_embed=0.3, brow_len=0.085,
                    brow_th=0.018, brow_z=0.06, brow_arch=0.006, mouth_z=-0.085, mouth_w=0.045, lip_w=0.009,
                    rest_lid_u=0.5, rest_lid_l=0.2)
    face = Face("tahin", spec, anchor, label)

    # moustache and little round glasses, carried by the face
    amw = anchor.matrix_world.copy()
    d = surface_depth(label, amw, 0.0, -0.05)
    mou = _blobs("tahin_moustache", [((sx * 0.032, d - 0.012, -0.052 + 0.006 * (1 - abs(sx))), (0.034, 0.014, 0.014))
                                     for sx in (-1, 1)], white, col, rings=8, segs=12, subsurf=1)
    mou.parent = anchor
    wire = M.metal("glasses_wire", (0.7, 0.6, 0.35), 0.25)
    for sx in (-1, 1):
        ex = sx * spec.eye_dx
        ring = _torus(f"tahin_glass_{'LR'[sx > 0]}", spec.eye_r * 1.35, 0.0032, col)
        ring.data.materials.append(wire)
        ring.parent = anchor
        ring.location = (ex, surface_depth(label, amw, ex, spec.eye_z) - spec.eye_r * 1.05, spec.eye_z)
    bridge = _blobs("tahin_glass_bridge", [((0, surface_depth(label, amw, 0, spec.eye_z) - spec.eye_r * 1.05,
                                             spec.eye_z + 0.008), (0.024, 0.003, 0.003))], wire, col, rings=6,
                    segs=8)
    bridge.parent = anchor
    return Tahin("tahin", arm, label, face, loc, rot)


class Tahin(Character):
    rot_map = {
        "lean_f": [("root", 0, 1.0)],
        "lean_s": [("root", 2, 1.0)],
        "nod": [("head", 0, 1.0)],
        "tilt": [("head", 2, 1.0)],
        "twist": [("head", 1, 1.0)],
    }
