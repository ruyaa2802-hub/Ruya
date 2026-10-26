"""YASTIK – the exhausted pillow who listens to everything.

Design: plump cream cotton pillowcase with thin dusty-blue pinstripes and a
blue piped seam. Pinched corners double as hands. Heavy, half-lidded grey-blue
eyes and stitched brows give the permanently tired, dry look.
"""
import math

from .. import materials as M
from ..face import Face, FaceSpec
from ..util import add_subsurf, mesh_object, smoothstep
from .base import Character, anchor_on_surface, build_armature, skin

W, H, T = 0.64, 0.44, 0.20
NU, NV = 41, 29
PIPE_R = 0.0065


def _surface(u, v, side):
    sx = 0.075 * (1 - v * v)
    sz = 0.10 * (1 - u * u)
    x = W / 2 * u * (1 - sx)
    z = H / 2 * v * (1 - sz) + H / 2
    puff = max((1 - abs(u) ** 2.3) * (1 - abs(v) ** 2.3), 0.0) ** 0.5
    y = side * T / 2 * puff
    # soft radial creases running out of each corner
    for cu, cv, ph in ((1, 1, 0.3), (-1, 1, 1.7), (1, -1, 2.4), (-1, -1, 4.1)):
        du, dv = u - cu, v - cv
        d = math.hypot(du, dv)
        if d < 0.8:
            a = math.atan2(dv, du)
            y += side * 0.0045 * math.sin(a * 11 + ph) * (1 - d / 0.8) ** 2 * smoothstep(0.02, 0.2, d)
    # gentle overall unevenness so it doesn't look machine-made
    y += side * 0.004 * math.sin(2.1 * u + 1.3) * math.sin(1.7 * v + 0.4) * puff
    return (x, y, z)


def _build_mesh(col):
    us = [-1 + 2 * i / (NU - 1) for i in range(NU)]
    vs = [-1 + 2 * j / (NV - 1) for j in range(NV)]
    verts, uvs, faces, mats = [], [], [], []
    front = {}
    for j, v in enumerate(vs):
        for i, u in enumerate(us):
            front[(i, j)] = len(verts)
            p = _surface(u, v, -1)
            verts.append(p)
            uvs.append((p[0] + W / 2, p[2]))
    back = {}
    for j, v in enumerate(vs):
        for i, u in enumerate(us):
            if i in (0, NU - 1) or j in (0, NV - 1):
                back[(i, j)] = front[(i, j)]
            else:
                back[(i, j)] = len(verts)
                p = _surface(u, v, 1)
                verts.append(p)
                uvs.append((W / 2 - p[0] + 1.0, p[2]))
    for j in range(NV - 1):
        for i in range(NU - 1):
            faces.append((front[(i, j)], front[(i + 1, j)], front[(i + 1, j + 1)], front[(i, j + 1)]))
            mats.append(0)
            faces.append((back[(i, j)], back[(i, j + 1)], back[(i + 1, j + 1)], back[(i + 1, j)]))
            mats.append(0)
    # piping tube along the seam
    loop = [(i, 0) for i in range(NU - 1)] + [(NU - 1, j) for j in range(NV - 1)] + \
           [(i, NV - 1) for i in range(NU - 1, 0, -1)] + [(0, j) for j in range(NV - 1, 0, -1)]
    pts = [verts[front[k]] for k in loop]
    n, m = len(pts), 8
    start = len(verts)
    arc = 0.0
    for k in range(n):
        p0, p1 = pts[k - 1], pts[(k + 1) % n]
        tx, tz = p1[0] - p0[0], p1[2] - p0[2]
        tl = math.hypot(tx, tz) or 1.0
        ox, oz = tz / tl, -tx / tl          # outward in the xz plane
        if k:
            arc += math.dist(pts[k], pts[k - 1])
        for a in range(m):
            ang = 2 * math.pi * a / m
            c, s = math.cos(ang), math.sin(ang)
            verts.append((pts[k][0] + ox * PIPE_R * c, pts[k][1] + PIPE_R * s, pts[k][2] + oz * PIPE_R * c))
            uvs.append((arc, ang * PIPE_R))
    for k in range(n):
        for a in range(m):
            p = start + k * m + a
            q = start + k * m + (a + 1) % m
            p2 = start + ((k + 1) % n) * m + a
            q2 = start + ((k + 1) % n) * m + (a + 1) % m
            faces.append((p, q, q2, p2))
            mats.append(1)
    obj = mesh_object("yastik_body", verts, faces, uvs=uvs, mat_indices=mats, col=col)
    return obj, front[(NU // 2, NV // 2 + 1)]


def build(col=None, loc=(0, 0, 0), rot=(0, 0, 0)):
    case = M.fabric("yastik_case", (0.90, 0.86, 0.78), pattern="pinstripe", accent=(0.36, 0.5, 0.68),
                    sheen=0.5, wrinkle=0.03)
    piping = M.fabric("yastik_piping", (0.30, 0.42, 0.6), sheen=0.4)
    lip = M.fabric("yastik_lip", (0.3, 0.39, 0.54), sheen=0.3)
    brow = M.fabric("yastik_brow", (0.25, 0.3, 0.4), sheen=0.3, weave=0.0012, bump=0.5)
    lid = M.fabric("yastik_lid", (0.88, 0.82, 0.74), sheen=0.5)

    body, tri = _build_mesh(col)
    body.data.materials.append(case)
    body.data.materials.append(piping)

    arm = build_armature("yastik_rig", [
        ("root", (0, 0, 0), (0, 0, 0.12), None),
        ("head", (0, 0, 0.12), (0, 0, H), "root"),
        ("hand_L", (-0.2, 0, 0.33), (-W / 2, 0, H), "head"),
        ("hand_R", (0.2, 0, 0.33), (W / 2, 0, H), "head"),
        ("foot_L", (-0.2, 0, 0.1), (-W / 2, 0, 0.0), "root"),
        ("foot_R", (0.2, 0, 0.1), (W / 2, 0, 0.0), "root"),
    ], col)

    weights = {k: [] for k in ("root", "head", "hand_L", "hand_R", "foot_L", "foot_R")}
    for vtx in body.data.vertices:
        x, _y, z = vtx.co
        corners = {
            "hand_L": smoothstep(0.2, 0.03, math.hypot(x + W / 2, z - H)),
            "hand_R": smoothstep(0.2, 0.03, math.hypot(x - W / 2, z - H)),
            "foot_L": smoothstep(0.17, 0.03, math.hypot(x + W / 2, z)),
            "foot_R": smoothstep(0.17, 0.03, math.hypot(x - W / 2, z)),
        }
        rest = max(0.0, 1 - sum(corners.values()))
        hw = smoothstep(0.03, 0.11, z)
        weights["head"].append(rest * hw)
        weights["root"].append(rest * (1 - hw))
        for k, w in corners.items():
            weights[k].append(w)
    skin(body, arm, weights)
    add_subsurf(body, 1, 2)

    arm.location = loc
    arm.rotation_euler = rot
    import bpy
    bpy.context.view_layer.update()
    outward = (arm.matrix_world.to_3x3() @ __import__("mathutils").Vector((0, -1, 0)))
    anchor = anchor_on_surface("yastik_face", body, tri, outward, arm, "head", col)

    spec = FaceSpec(skin=lid, lip=lip, brow=brow, iris=(0.33, 0.43, 0.52), eye_r=0.047, eye_dx=0.085,
                    eye_z=0.035, eye_embed=0.3, brow_len=0.075, brow_th=0.010, brow_z=0.058,
                    brow_arch=0.006, mouth_z=-0.075, mouth_w=0.055, lip_w=0.008,
                    rest_lid_u=0.38, rest_lid_l=0.12)
    face = Face("yastik", spec, anchor, body)
    ch = Yastik("yastik", arm, body, face, loc, rot)
    return ch


class Yastik(Character):
    rot_map = {
        "lean_f": [("root", 0, 1.0)],
        "lean_s": [("root", 2, 1.0)],
        "nod": [("head", 0, 1.0)],
        "tilt": [("head", 2, 1.0)],
        "twist": [("head", 1, 1.0)],
        "arm_L_raise": [("hand_L", 2, -1.0)],
        "arm_L_fold": [("hand_L", 0, 1.0)],
        "arm_L_curl": [("hand_L", 1, 1.0)],
        "arm_R_raise": [("hand_R", 2, 1.0)],
        "arm_R_fold": [("hand_R", 0, 1.0)],
        "arm_R_curl": [("hand_R", 1, -1.0)],
    }
