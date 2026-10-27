"""BATTANİYE – the dramatic, easily offended fleece blanket.

Design: a classic burgundy/green tartan ("ekose") fleece blanket bunched into
a soft heap, skirt spread on the floor with a cream fringe. Two blanket
corners poke out of the sides and work as arms. Big warm amber eyes with
lashes and expressive dark brows sell the drama.
"""
import math

import bpy
from mathutils import Matrix, Vector

from .. import materials as M
from ..face import Face, FaceSpec
from ..util import add_solidify, add_subsurf, mesh_object, set_parent_keep, smoothstep, store_rest
from .base import Character, anchor_on_surface, build_armature, skin

NS, NR = 64, 34
PROFILE = [  # (radius, height) from the top of the heap down to the hem
    (0.0, 0.55), (0.08, 0.543), (0.15, 0.515), (0.2, 0.47), (0.228, 0.41), (0.24, 0.345),
    (0.25, 0.28), (0.268, 0.21), (0.295, 0.145), (0.335, 0.085), (0.37, 0.045), (0.395, 0.02),
    (0.415, 0.01), (0.435, 0.006),
]
HEM_T = 0.8          # profile parameter where the skirt starts


def _profile(t):
    """Catmull-Rom through PROFILE, t in [0, 1]."""
    n = len(PROFILE) - 1
    f = min(t * n, n - 1e-6)
    i = int(f)
    u = f - i
    p = [PROFILE[max(min(k, n), 0)] for k in (i - 1, i, i + 1, i + 2)]
    out = []
    for a in range(2):
        p0, p1, p2, p3 = (q[a] for q in p)
        out.append(0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u +
                          (-p0 + 3 * p1 - 3 * p2 + p3) * u ** 3))
    return out


FOLDS = [(3, 0.6, 0.016), (4, 2.9, 0.011), (5, 1.9, 0.012), (7, 4.0, 0.008), (9, 5.1, 0.005),
         (13, 0.4, 0.003), (2, 2.5, 0.012)]
LEAN = (0.03, 0.018)        # the top of the heap slumps to screen-right and back


def _heap_point(t, th):
    """Surface point (x, y, z) of the heap at profile parameter t, angle th (0 = front, -Y)."""
    rho, z = _profile(t)
    wrapped = (th + math.pi) % (2 * math.pi) - math.pi
    front = math.exp(-(wrapped / 1.0) ** 2)
    amp = (0.3 + 0.7 * smoothstep(0.1, 0.85, t)) * (1 - 0.92 * front * (1 - smoothstep(0.5, 0.72, t)))
    # folds drift around the body as they fall, which makes them run diagonally
    d = sum(a * math.sin(f * th + ph + (2.5 + f * 0.45) * t) for f, ph, a in FOLDS) * amp * 2.6
    # a horizontal sag line where the blanket folds over itself
    d += 0.014 * math.exp(-((t - 0.52) / 0.05) ** 2) * (0.6 + 0.4 * math.sin(2 * th + 0.8)) * (1 - 0.7 * front)
    r = rho * (1 + 0.05 * math.sin(th + 1.1) * t) + d * min(1.0, t * 6)
    zz = z + smoothstep(HEM_T, 1.0, t) * (0.012 + 0.012 * math.sin(5 * th + 0.7)) \
        - smoothstep(0.9, 1.0, t) * 0.004
    # fabric bunched on top: a soft saddle with a crease, slightly off-centre
    top = max(0.0, 1 - t / 0.3) ** 2
    zz += top * (0.022 * math.sin(2 * th + 0.5) + 0.008 * math.sin(5 * th + 2.0))
    lean = (1 - min(t / HEM_T, 1.0)) ** 2
    return (r * math.sin(th) + LEAN[0] * lean, -r * math.cos(th) + LEAN[1] * lean, max(zz, 0.004))


def _t_at_height(z):
    lo, hi = 0.0, HEM_T
    for _ in range(30):
        mid = (lo + hi) / 2
        if _profile(mid)[1] > z:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def _heap():
    verts, uvs = [], []
    rows = []
    arc = 0.0
    prev = None
    for k in range(NR + 1):
        t = k / NR
        rho, z = _profile(t)
        if prev is not None:
            arc += math.dist((rho, z), prev)
        prev = (rho, z)
        row = []
        if k == 0:
            p = _heap_point(0.0, 0.0)
            verts.append((LEAN[0], LEAN[1], p[2]))
            uvs.append((0.94, 0.0))
            rows.append([0] * NS)
            continue
        for i in range(NS):
            th = 2 * math.pi * i / NS          # 0 = front (-Y)
            row.append(len(verts))
            verts.append(_heap_point(t, th))
            uvs.append((((th + math.pi) % (2 * math.pi)) * 0.3, arc))
        rows.append(row)
    faces = []
    for i in range(NS):
        faces.append((0, rows[1][i], rows[1][(i + 1) % NS]))
    for k in range(1, NR):
        for i in range(NS):
            a, b = rows[k][i], rows[k][(i + 1) % NS]
            c, d = rows[k + 1][(i + 1) % NS], rows[k + 1][i]
            faces.append((a, d, c, b))
    return verts, faces, uvs, rows


ARM_BASE_Z, ARM_TIP_Z = 0.40, 0.12
ARM_TH_BASE, ARM_TH_TIP = 1.0, 1.2        # radians from the front, base and tip of the corner


def _surface_offset(z, th, lift):
    p = Vector(_heap_point(_t_at_height(z), th))
    return p + Vector((math.sin(th), -math.cos(th), 0)) * lift


def _arm_frame(side):
    """Base, mid and tip points of a blanket-corner arm."""
    sx = -1 if side == "L" else 1
    base = _surface_offset(ARM_BASE_Z, sx * ARM_TH_BASE, 0.014)
    mid = _surface_offset((ARM_BASE_Z + ARM_TIP_Z) / 2, sx * (ARM_TH_BASE + ARM_TH_TIP) / 2, 0.02)
    tip = _surface_offset(ARM_TIP_Z, sx * ARM_TH_TIP, 0.035)
    return base, mid, tip, sx * ARM_TH_BASE


def _flap(side):
    """A blanket corner draped over the front-side of the heap, ending in a point (an arm)."""
    sx = -1 if side == "L" else 1
    nl, nw = 12, 9
    verts, uvs, svals = [], [], []
    for a in range(nl):
        s = a / (nl - 1)
        z = ARM_BASE_Z + (ARM_TIP_Z - ARM_BASE_Z) * s
        th_c = sx * (ARM_TH_BASE + (ARM_TH_TIP - ARM_TH_BASE) * s)
        half = 0.3 * (1 - s) ** 0.9 + 0.012       # angular half-width
        for b in range(nw):
            u = b / (nw - 1) * 2 - 1
            th = th_c + u * half
            # the edge rolls slightly away from the body so it reads as a layer
            lift = 0.013 + 0.022 * s * s + 0.006 * u * u
            zz = z + 0.025 * (1 - s) * (1 - u * u) * 0.5 - 0.02 * s * (u * sx) * 0.5
            p = _surface_offset(zz, th, lift)
            verts.append(tuple(p))
            uvs.append((u * half * 0.25 + 0.5, s * 0.3))
            svals.append(s)
    faces = []
    for a in range(nl - 1):
        for b in range(nw - 1):
            i = a * nw + b
            f = (i, i + 1, i + nw + 1, i + nw)
            faces.append(f if sx > 0 else f[::-1])
    return verts, faces, uvs, svals


def _tassels(points, direction, length=0.055, width=0.0055, seed=0.0):
    """Little yarn tassels: one 4-sided tube per point, drooping along `direction`."""
    fv, ff = [], []
    for n, (p, out) in enumerate(points):
        h1 = 0.5 + 0.5 * math.sin(n * 12.9898 + seed)
        h2 = 0.5 + 0.5 * math.sin(n * 78.233 + seed * 1.7)
        jitter = 0.7 + 0.6 * h1
        out = Vector(out).normalized()
        swing = (h2 - 0.5) * 0.6
        out = Vector((out.x * math.cos(swing) - out.y * math.sin(swing),
                      out.x * math.sin(swing) + out.y * math.cos(swing), out.z)).normalized()
        side = out.cross(Vector((0, 0, 1)))
        if side.length < 1e-3:
            side = Vector((1, 0, 0))
        side.normalize()
        up = side.cross(out).normalized()
        base = len(fv)
        for s in range(5):
            t = s / 4
            curl = side * (0.006 * (h2 - 0.5) * t * t)
            c = Vector(p) + out * (length * jitter * t) + Vector(direction) * (0.008 * t * t) + curl
            c.z = max(c.z, 0.003)
            w = width * (1 - 0.4 * t) * (1.3 if s == 4 else 1.0)
            for k in range(4):
                a = 2 * math.pi * k / 4 + math.pi / 4
                fv.append(tuple(c + side * (w * math.cos(a)) + up * (w * math.sin(a))))
        for s in range(4):
            for k in range(4):
                a = base + s * 4 + k
                b = base + s * 4 + (k + 1) % 4
                ff.append((a, b, b + 4, a + 4))
        ff.append(tuple(base + 16 + k for k in range(4)))
    return fv, ff


def build(col=None, loc=(0, 0, 0), rot=(0, 0, 0)):
    plaid = M.fabric("battaniye_plaid", (0.55, 0.04, 0.04), pattern="plaid", accent=(0.03, 0.17, 0.1),
                     accent2=(0.9, 0.72, 0.35), roughness=0.92, sheen=0.35, weave=0.002, bump=0.12,
                     wrinkle=0.03, fuzz=0.15, mapping="triplanar")
    solid = M.fabric("battaniye_lid", (0.5, 0.04, 0.04), roughness=0.92, sheen=0.35, fuzz=0.15)
    lip = M.fabric("battaniye_lip", (0.28, 0.03, 0.04), roughness=0.85, sheen=0.8)
    brow = M.fabric("battaniye_brow", (0.12, 0.05, 0.03), roughness=0.8, sheen=0.5, bump=0.6)
    fringe_mat = M.fabric("battaniye_fringe", (0.93, 0.85, 0.66), roughness=0.9, sheen=0.8)

    verts, faces, uvs, rows = _heap()
    body = mesh_object("battaniye_body", verts, faces, uvs=uvs, col=col)
    body.data.materials.append(plaid)
    store_rest(body)

    flaps, svals = {}, {}
    for side in ("L", "R"):
        v, f, uv, sv = _flap(side)
        fl = mesh_object(f"battaniye_arm{side}", v, f, uvs=uv, col=col)
        fl.data.materials.append(plaid)
        # shift the pattern so the corner doesn't camouflage into the body under it
        store_rest(fl, Matrix.Translation((0.037, 0.051, 0.023)))
        flaps[side], svals[side] = fl, sv

    # fringe: tassels along the hem
    hem = rows[-1]
    pts = []
    for i in range(NS * 3):
        a = i / 3
        i0 = int(a) % NS
        p = Vector(verts[hem[i0]]).lerp(Vector(verts[hem[(i0 + 1) % NS]]), a - int(a))
        pts.append((p, Vector((p.x, p.y, 0))))
    fv, ff = _tassels(pts, (0, 0, -1))
    fringe = mesh_object("battaniye_fringe", fv, ff, col=col)
    fringe.data.materials.append(fringe_mat)
    tips = {}
    for side in ("L", "R"):
        _b, _m, tip, _t = _arm_frame(side)
        sx = -1 if side == "L" else 1
        tv, tf = _tassels([(tip + Vector((dx, 0, 0.004)), Vector((sx * 0.3 + dx * 20, -0.3, -1)))
                           for dx in (-0.007, 0.0, 0.007)], (0, 0, -1), length=0.045, width=0.005, seed=3)
        tips[side] = mesh_object(f"battaniye_tassel{side}", tv, tf, col=col)
        tips[side].data.materials.append(fringe_mat)

    bones = [
        ("root", (0, 0, 0), (0, 0, 0.08), None),
        ("spine", (0, 0, 0.03), (0, 0, 0.13), "root"),
        ("chest", (0, 0, 0.13), (0, 0, 0.23), "spine"),
        ("head", (0, 0, 0.23), (LEAN[0] * 0.5, LEAN[1] * 0.5, 0.58), "chest"),
    ]
    for side in ("L", "R"):
        b, m, tip, _t = _arm_frame(side)
        bones += [(f"arm_{side}1", tuple(b), tuple(m), "head"), (f"arm_{side}2", tuple(m), tuple(tip), f"arm_{side}1")]
    arm = build_armature("battaniye_rig", bones, col)

    weights = {k: [0.0] * len(verts) for k in ("root", "spine", "chest", "head")}
    for k_row, row in enumerate(rows):
        t = k_row / NR
        for idx in set(row):
            z = verts[idx][2]
            wr = smoothstep(HEM_T - 0.12, HEM_T + 0.02, t)
            wh = smoothstep(0.19, 0.27, z)
            wc = smoothstep(0.08, 0.17, z) - wh
            ws = 1 - smoothstep(0.08, 0.17, z)
            weights["root"][idx] = wr
            weights["head"][idx] = (1 - wr) * wh
            weights["chest"][idx] = (1 - wr) * max(wc, 0)
            weights["spine"][idx] = (1 - wr) * ws
    skin(body, arm, weights)
    add_solidify(body, 0.014, 1.0)
    add_subsurf(body, 1, 2)

    for side, fl in flaps.items():
        w0, w1, w2 = [], [], []
        for sv in svals[side]:
            b = smoothstep(0.35, 0.65, sv)
            h = 1 - smoothstep(0.0, 0.15, sv)     # root of the corner stays glued to the body
            w0.append(h)
            w1.append((1 - h) * (1 - b))
            w2.append((1 - h) * b)
        skin(fl, arm, {"head": w0, f"arm_{side}1": w1, f"arm_{side}2": w2})
        add_solidify(fl, 0.012, 0.0)
        add_subsurf(fl, 1, 2)
        set_parent_keep(tips[side], arm, "BONE", bone=f"arm_{side}2")

    set_parent_keep(fringe, arm, "BONE", bone="root")

    arm.location = loc
    arm.rotation_euler = rot
    bpy.context.view_layer.update()

    # face anchor on the front of the heap
    zf = 0.37
    k_face = min(range(NR + 1), key=lambda k: abs(verts[rows[k][0]][2] - zf) if k > 0 else 9)
    outward = arm.matrix_world.to_3x3() @ Vector((0, -1, 0))
    anchor = anchor_on_surface("battaniye_face", body, rows[k_face][0], outward, arm, "head", col)

    spec = FaceSpec(skin=solid, lip=lip, brow=brow, iris=(0.55, 0.3, 0.1), eye_r=0.05, eye_dx=0.074,
                    eye_z=0.05, eye_embed=0.32, eye_scale=(1.0, 1.0, 1.12), brow_len=0.062,
                    brow_th=0.0105, brow_z=0.064, brow_arch=0.012, mouth_z=-0.062, mouth_w=0.05,
                    lip_w=0.011, lashes=True, rest_lid_u=0.05, rest_lid_l=0.0)
    face = Face("battaniye", spec, anchor, body)
    ch = Battaniye("battaniye", arm, body, face, loc, rot)
    ch.extra = [flaps["L"], flaps["R"], fringe, tips["L"], tips["R"]]
    return ch


class Battaniye(Character):
    rot_map = {
        "lean_f": [("spine", 0, 0.45), ("chest", 0, 0.55)],
        "lean_s": [("spine", 2, 0.5), ("chest", 2, 0.5)],
        "nod": [("head", 0, 1.0)],
        "tilt": [("head", 2, 1.0)],
        "twist": [("chest", 1, 0.4), ("head", 1, 0.6)],
        "arm_L_raise": [("arm_L1", 2, -1.0)],
        "arm_L_fold": [("arm_L1", 0, 1.0)],
        "arm_L_curl": [("arm_L2", 2, -1.0)],
        "arm_R_raise": [("arm_R1", 2, 1.0)],
        "arm_R_fold": [("arm_R1", 0, 1.0)],
        "arm_R_curl": [("arm_R2", 2, 1.0)],
    }
