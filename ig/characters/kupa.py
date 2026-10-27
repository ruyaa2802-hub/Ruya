"""KUPA – the coffee mug that keeps getting forgotten.

Design: a big glazed stoneware mug, warm orange outside, cream inside and on
the dipped rim, unglazed foot ring. The handle is its one arm. Coffee-brown
eyes, dark brown glaze brows, "ÖNCE KAHVE" printed on the back (it turns
around to show it). Its coffee went cold hours ago: a dull skin on top.

The face is designed at the same scale as the pillow's and shrunk onto the
mug with FACE_SCALE, so viseme sizes and brow travel stay in proportion.
"""
import math

import bpy
from mathutils import Vector

from .. import materials as M
from ..audio import FONT
from ..face import Face, FaceSpec
from ..util import link, mesh_object, smoothstep
from .base import Character, anchor_on_surface, build_armature, skin

R, H = 0.072, 0.155            # outer radius and height
SEGS = 72
FACE_Z = 0.085
FACE_SCALE = 0.45
COFFEE_Z = 0.118
TEXT_Z = 0.08

GLAZE, CREAM, FOOT = 0, 1, 2
# lathe profile (radius, height, material of the band above this point), outside up, over the rim, inside down
PROFILE = [
    (0.0, 0.004, FOOT), (0.05, 0.004, FOOT), (0.056, 0.0, FOOT), (0.0615, 0.002, GLAZE),
    (0.065, 0.007, GLAZE), (0.0685, 0.016, GLAZE), (0.0708, 0.032, GLAZE), (0.0718, 0.055, GLAZE),
    (R, FACE_Z, GLAZE), (0.0718, 0.115, GLAZE), (0.0712, 0.138, CREAM), (0.0708, 0.148, CREAM),
    (0.0698, 0.1535, CREAM), (0.0678, H, CREAM), (0.0656, 0.1538, CREAM), (0.0648, 0.149, CREAM),
    (0.0651, 0.13, CREAM), (0.0652, 0.1, CREAM), (0.0646, 0.06, CREAM), (0.0628, 0.032, CREAM),
    (0.0585, 0.02, CREAM), (0.048, 0.0145, CREAM), (0.0, 0.0135, CREAM),
]


def _angle(j):
    return 2 * math.pi * j / SEGS - math.pi / 2          # j = 0 faces -Y (the face side)


def _body_mesh(col):
    verts, faces, mats = [], [], []
    rings = []
    for r, z, _m in PROFILE:
        if r == 0.0:
            rings.append([len(verts)])
            verts.append((0.0, 0.0, z))
        else:
            ring = []
            for j in range(SEGS):
                a = _angle(j)
                ring.append(len(verts))
                verts.append((r * math.cos(a), r * math.sin(a), z))
            rings.append(ring)
    for k in range(len(rings) - 1):
        a, b = rings[k], rings[k + 1]
        m = PROFILE[k][2]
        for j in range(SEGS):
            j2 = (j + 1) % SEGS
            if len(a) == 1:
                faces.append((a[0], b[j2], b[j]))
            elif len(b) == 1:
                faces.append((a[j], a[j2], b[0]))
            else:
                faces.append((a[j], a[j2], b[j2], b[j]))
            mats.append(m)
    # winding: outer wall faces out, inner wall faces the cavity, bottom faces down
    obj = mesh_object("kupa_body", verts, faces, mat_indices=mats, col=col)
    face_vert = rings[[i for i, p in enumerate(PROFILE) if p[1] == FACE_Z][0]][0]
    return obj, face_vert


def _handle_mesh(col, n=40, m=16):
    """C-shaped handle on +X (screen right): a cubic Bezier tube in the XZ plane."""
    p0, p1, p2, p3 = (Vector((R - 0.004, 0, 0.126)), Vector((R + 0.06, 0, 0.14)),
                      Vector((R + 0.066, 0, 0.034)), Vector((R - 0.004, 0, 0.042)))
    verts, faces, ts = [], [], []
    for i in range(n):
        t = i / (n - 1)
        c = (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t * t * p2 + t ** 3 * p3
        d = -3 * (1 - t) ** 2 * p0 + 3 * (1 - t) ** 2 * p1 - 6 * (1 - t) * t * p1 \
            + 6 * (1 - t) * t * p2 - 3 * t * t * p2 + 3 * t * t * p3
        d.normalize()
        side = d.cross(Vector((0, 1, 0))).normalized()          # in-plane normal
        th = 0.0062 * (1 + 0.25 * math.sin(math.pi * t))        # a little fuller in the middle
        for k in range(m):
            a = 2 * math.pi * k / m
            verts.append(tuple(c + side * (math.cos(a) * th) + Vector((0, math.sin(a) * 0.0088, 0))))
            ts.append(t)
    for i in range(n - 1):
        for k in range(m):
            a, b = i * m + k, i * m + (k + 1) % m
            faces.append((a, b, b + m, a + m))
    return mesh_object("kupa_handle", verts, faces, col=col), ts


def _coffee_mesh(col, rings=10):
    r0 = 0.0651
    verts, faces = [(0.0, 0.0, COFFEE_Z)], []
    for i in range(1, rings + 1):
        f = i / rings
        z = COFFEE_Z + 0.0012 * f ** 6                         # meniscus at the wall
        for j in range(SEGS):
            a = _angle(j)
            verts.append((r0 * f * math.cos(a), r0 * f * math.sin(a), z))
    for j in range(SEGS):
        faces.append((0, 1 + j, 1 + (j + 1) % SEGS))
    for i in range(rings - 1):
        for j in range(SEGS):
            a, b = 1 + i * SEGS + j, 1 + i * SEGS + (j + 1) % SEGS
            faces.append((a, a + SEGS, b + SEGS, b))               # up, like the centre fan
    return mesh_object("kupa_coffee", verts, faces, col=col)


def _text_mesh(col, text="ÖNCE\nKAHVE", size=0.025):
    """Printed slogan wrapped around the back of the mug."""
    cu = bpy.data.curves.new("kupa_text_curve", "FONT")
    cu.body = text
    cu.font = bpy.data.fonts.load(FONT, check_existing=True)
    cu.align_x, cu.align_y = "CENTER", "CENTER"
    cu.size = size
    cu.space_line = 0.88
    cu.extrude = 0.0004
    cu.resolution_u = 6
    tmp = link(bpy.data.objects.new("kupa_text_tmp", cu), col)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(tmp.evaluated_get(dg))
    bpy.data.objects.remove(tmp)
    rw = R + 0.0003
    for v in me.vertices:
        x, y, z = v.co
        a = math.pi / 2 + x / rw                                # back side; reads left-to-right from behind
        rr = rw + z
        v.co = (rr * math.cos(a), rr * math.sin(a), TEXT_Z + y)
    me.update()
    obj = bpy.data.objects.new("kupa_text", me)
    return link(obj, col)


def build(col=None, loc=(0, 0, 0), rot=(0, 0, 0)):
    glaze = M.ceramic("kupa_glaze", (0.93, 0.3, 0.07))
    cream = M.ceramic("kupa_cream", (0.95, 0.9, 0.8))
    foot = M.bisque("kupa_foot")
    brow = M.ceramic("kupa_brow", (0.16, 0.07, 0.035), roughness=0.2)
    lip = M.ceramic("kupa_lip", (0.48, 0.14, 0.06), roughness=0.2)

    body, face_vert = _body_mesh(col)
    for mat in (glaze, cream, foot):
        body.data.materials.append(mat)
    handle, ts = _handle_mesh(col)
    handle.data.materials.append(glaze)
    coffee = _coffee_mesh(col)
    coffee.data.materials.append(M.coffee_cold())
    text = _text_mesh(col)
    text.data.materials.append(cream)

    arm = build_armature("kupa_rig", [
        ("root", (0, 0, 0), (0, 0, 0.03), None),
        ("head", (0, 0, 0.03), (0, 0, H), "root"),
        ("handle", (R + 0.004, 0, 0.128), (R + 0.04, 0, 0.045), "head"),
    ], col)

    def body_weights(obj):
        hw = [smoothstep(0.004, 0.035, v.co.z) for v in obj.data.vertices]
        return {"head": hw, "root": [1 - w for w in hw]}

    skin(body, arm, body_weights(body))
    skin(text, arm, body_weights(text))
    skin(coffee, arm, {"head": [1.0] * len(coffee.data.vertices)})
    hw = [smoothstep(0.02, 0.22, t) for t in ts]                 # rooted at the top attachment
    skin(handle, arm, {"handle": hw, "head": [1 - w for w in hw]})

    arm.location = loc
    arm.rotation_euler = rot
    bpy.context.view_layer.update()
    outward = arm.matrix_world.to_3x3() @ Vector((0, -1, 0))
    anchor = anchor_on_surface("kupa_face", body, face_vert, outward, arm, "head", col)
    anchor.scale = (FACE_SCALE,) * 3
    bpy.context.view_layer.update()

    spec = FaceSpec(skin=glaze, lip=lip, brow=brow, iris=(0.36, 0.2, 0.09), eye_r=0.045, eye_dx=0.074,
                    eye_z=0.04, eye_embed=0.4, brow_len=0.07, brow_th=0.011, brow_z=0.064, brow_arch=0.01,
                    mouth_z=-0.075, mouth_w=0.05, lip_w=0.009, rest_lid_u=0.05, rest_lid_l=0.08)
    face = Face("kupa", spec, anchor, body)
    return Kupa("kupa", arm, body, face, loc, rot)


class Kupa(Character):
    rot_map = {
        "lean_f": [("root", 0, 1.0)],
        "lean_s": [("root", 2, 1.0)],
        "nod": [("head", 0, 1.0)],
        "tilt": [("head", 2, 1.0)],
        "twist": [("head", 1, 1.0)],
        "arm_R_raise": [("handle", 2, 1.0)],
        "arm_R_fold": [("handle", 0, 1.0)],
        "arm_R_curl": [("handle", 1, -1.0)],
    }
