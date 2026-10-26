"""Reusable cartoon face: eyes, eyelids, brows and a viseme-ready mouth.

Every character gets the same face language (glossy eyes with painted
irises, skin-coloured lids, sculpted brows, recessed mouth with a lip roll),
tuned per character through FaceSpec. The face is built in the local frame
of an *anchor* that sits on the body surface (-Y points out of the face,
+Z up, +X to screen right) and is conformed to the body by ray casting, so
it works on any object shape.
"""
import math
from dataclasses import dataclass, field

import bpy
from mathutils import Euler, Matrix, Vector

from . import materials as M
from .util import add_subsurf, clamp, lerp, mesh_object, empty

MOUTH_KEYS = ("open", "wide", "round", "press", "smile", "frown", "sneer")


@dataclass
class FaceSpec:
    skin: object                      # material used for lids
    lip: object                       # material used for the lip roll
    brow: object                      # brow material
    iris: tuple = (0.3, 0.45, 0.6)
    eye_r: float = 0.05
    eye_dx: float = 0.075             # half distance between eye centres
    eye_z: float = 0.05               # eye height above anchor
    eye_embed: float = 0.3            # fraction of radius sunk below the surface
    eye_scale: tuple = (1.0, 1.0, 1.08)
    brow_len: float = 0.07
    brow_th: float = 0.011
    brow_z: float = 0.06              # above eye centre
    brow_arch: float = 0.012
    mouth_z: float = -0.06
    mouth_w: float = 0.05             # half width at rest
    lip_w: float = 0.011              # lip roll width
    lashes: bool = False
    rest_lid_u: float = 0.0           # default upper-lid closure (tired = 0.4)
    rest_lid_l: float = 0.0


# ------------------------------------------------------------------ surface

def surface_depth(body, anchor_mw, x, z, fallback=0.0):
    """Anchor-local Y of the body surface at anchor-local (x, z)."""
    inv = body.matrix_world.inverted()
    origin = inv @ (anchor_mw @ Vector((x, -0.5, z)))
    direction = (inv.to_3x3() @ (anchor_mw.to_3x3() @ Vector((0, 1, 0)))).normalized()
    hit, loc, _n, _i = body.ray_cast(origin, direction, distance=2.0,
                                     depsgraph=bpy.context.evaluated_depsgraph_get())
    if not hit:
        return fallback
    return (anchor_mw.inverted() @ (body.matrix_world @ loc)).y


# ------------------------------------------------------------------ eyes

def _uv_sphere(rings=24, segs=32):
    verts, faces = [], []
    verts.append((0, 0, 1))
    for i in range(1, rings):
        a = math.pi * i / rings
        for j in range(segs):
            b = 2 * math.pi * j / segs
            verts.append((math.sin(a) * math.cos(b), math.sin(a) * math.sin(b), math.cos(a)))
    verts.append((0, 0, -1))
    for j in range(segs):
        faces.append((0, 1 + j, 1 + (j + 1) % segs))
    for i in range(rings - 2):
        for j in range(segs):
            a = 1 + i * segs + j
            b = 1 + i * segs + (j + 1) % segs
            faces.append((a, a + segs, b + segs, b))
    last = len(verts) - 1
    base = 1 + (rings - 2) * segs
    for j in range(segs):
        faces.append((base + j, last, base + (j + 1) % segs))
    return verts, faces


def _lid_mesh(r, upper=True, segs=40):
    """Spherical cap over one hemisphere with a rolled rim (material 1 = lash line)."""
    profile = []  # (polar angle from pole, radius factor, material)
    for i in range(0, 13):
        profile.append((math.radians(90) * i / 12, 1.05, 0))
    profile += [(math.radians(91.5), 1.045, 1), (math.radians(93), 1.03, 1),
                (math.radians(92.5), 1.005, 1), (math.radians(90), 0.985, 1)]
    sgn = 1 if upper else -1
    verts, uvs = [], []
    for k, (a, f, _m) in enumerate(profile):
        for j in range(segs):
            b = 2 * math.pi * j / segs
            x = math.sin(a) * math.cos(b) * r * f
            y = math.sin(a) * math.sin(b) * r * f
            zz = math.cos(a) * r * f * sgn
            verts.append((x, y, zz))
            uvs.append((b * r, a * r))
    faces, mats = [], []
    for k in range(len(profile) - 1):
        for j in range(segs):
            a = k * segs + j
            b = k * segs + (j + 1) % segs
            f = (a, b, b + segs, a + segs) if upper else (a, a + segs, b + segs, b)
            faces.append(f)
            mats.append(profile[k + 1][2])
    return verts, faces, uvs, mats


def _lashes_mesh(r, n=5):
    """A few curled lashes along the outer half of the upper lid edge."""
    verts, faces = [], []
    for i in range(n):
        b = math.radians(-95 - i * 14)          # around the front, toward the outer corner
        base = Vector((math.cos(b), math.sin(b), 0)) * r * 1.07
        out = Vector((math.cos(b), math.sin(b), 0))
        length = r * (0.42 - 0.04 * abs(i - 1.5))
        pts = []
        for s in range(5):
            t = s / 4
            p = base + out * (length * 0.55 * t) + Vector((0, 0, length * (t ** 1.6)))
            pts.append((p, (1 - t) * r * 0.05 + r * 0.008))
        side = out.cross(Vector((0, 0, 1))).normalized()
        start = len(verts)
        for p, w in pts:
            verts.append(tuple(p + side * w))
            verts.append(tuple(p - side * w))
        for s in range(4):
            a = start + s * 2
            faces.append((a, a + 1, a + 3, a + 2))
    return verts, faces


class Eye:
    def __init__(self, name, spec, socket):
        self.spec = spec
        self.socket = socket
        r = spec.eye_r
        v, f = _uv_sphere()
        self.ball = mesh_object(f"{name}_ball", v, f)
        self.ball.data.materials.append(M.eye(f"eye_{name.split('_')[0]}", spec.iris))
        self.ball.scale = (r, r, r)
        self.ball.parent = socket
        add_subsurf(self.ball, 1, 1)
        self.lids = []
        for upper in (True, False):
            v, f, uv, mi = _lid_mesh(r, upper)
            lid = mesh_object(f"{name}_lid{'U' if upper else 'D'}", v, f, uvs=uv, mat_indices=mi)
            lid.data.materials.append(spec.skin)
            lid.data.materials.append(spec.brow)
            lid.parent = socket
            add_subsurf(lid, 1, 1)
            self.lids.append(lid)
        self.lashes = None
        if spec.lashes:
            v, f = _lashes_mesh(r)
            self.lashes = mesh_object(f"{name}_lashes", v, f)
            self.lashes.data.materials.append(M.plastic("lash", (0.03, 0.02, 0.02), 0.5))
            self.lashes.parent = self.lids[0]
            if socket.location.x > 0:   # mirror for the screen-right eye
                self.lashes.scale.x = -1

    def apply(self, gaze_x, gaze_y, close_u, close_l):
        self.ball.rotation_euler = (-gaze_y, 0.0, gaze_x)
        meet = math.radians(-12)
        eu = lerp(math.radians(62), meet, clamp(close_u, -0.3, 1.0)) + 0.35 * gaze_y
        el = lerp(math.radians(-70), meet, clamp(close_l, 0.0, 1.0)) + 0.2 * gaze_y
        eu = max(eu, el + math.radians(1))
        self.lids[0].rotation_euler = (-eu, 0.0, 0.0)
        self.lids[1].rotation_euler = (-el, 0.0, 0.0)


# ------------------------------------------------------------------ brows

def _brow_mesh(length, th, arch, n=14, m=8):
    verts, faces = [], []
    for i in range(n):
        t = i / (n - 1)
        x = (t - 0.5) * length
        z = arch * (1 - (2 * t - 1) ** 2)
        w = th * (0.35 + 0.65 * math.sin(math.pi * (0.15 + 0.7 * t)) ** 0.6) * (1.15 - 0.3 * t)
        for j in range(m):
            a = 2 * math.pi * j / m
            verts.append((x, -math.sin(a) * w * 0.55, z + math.cos(a) * w))
    for i in range(n - 1):
        for j in range(m):
            a, b = i * m + j, i * m + (j + 1) % m
            faces.append((a, b, b + m, a + m))
    # caps
    faces.append(tuple(range(m))[::-1])
    faces.append(tuple(range((n - 1) * m, n * m)))
    return verts, faces


# ------------------------------------------------------------------ mouth

def _mouth_shape(spec, open_=0.0, wide=0.0, round_=0.0, press=0.0, smile=0.0, frown=0.0, sneer=0.0,
                 ns=48, nc=4):
    """Vertices (anchor-local, flat; surface depth added later) for given params."""
    w = spec.mouth_w * (1 + 0.32 * wide - 0.45 * round_ - 0.12 * press + 0.06 * smile)
    hu = 0.0015 + 0.016 * open_ + 0.006 * round_ + 0.004 * wide * open_ + 0.006 * sneer
    hl = 0.0015 + 0.06 * open_ + 0.016 * round_
    hu *= (1 - press)
    hl *= (1 - press)
    lip = spec.lip_w * (1 + 0.5 * round_ - 0.35 * press)
    protrude = 0.004 + 0.010 * round_ + 0.003 * press
    lift = 0.022 * smile - 0.02 * frown
    sag = -0.006 * smile + 0.004 * frown
    pts = []
    for i in range(ns):
        th = 2 * math.pi * i / ns
        c, s = math.cos(th), math.sin(th)
        x = w * c
        h = hu if s > 0 else hl
        roundness = 0.75 + 0.25 * round_
        z = h * math.copysign(abs(s) ** roundness, s)
        z += lift * c * c + sag * (1 - c * c)
        z += sneer * 0.01 * max(c, 0) * (1 if s > 0 else 0.3)
        pts.append((x, z, c, s))
    cz = sum(p[1] for p in pts) / ns
    # the cavity sits just in front of the body surface (it cannot cut into it);
    # the protruding lip roll and the dark gradient sell the depth
    verts = [(0.0, -0.0016, cz)]
    for k in range(1, nc + 1):
        f = k / nc
        for x, z, _c, _s in pts:
            verts.append((x * f, -0.0016, cz + (z - cz) * f))
    lip_ts = (0.0, 0.18, 0.4, 0.65, 0.85, 1.0)
    for t in lip_ts[1:]:
        for x, z, c, s in pts:
            nx, nz = c * 0.6, s
            ln = math.hypot(nx, nz) or 1.0
            lw = lip * (0.45 + 0.55 * abs(s) ** 0.7)
            px, pz = x + nx / ln * lw * t, z + nz / ln * lw * t
            y = -0.002 - protrude * math.sin(math.pi * min(t / 0.85, 1.0)) ** 0.8 \
                + 0.007 * max(t - 0.85, 0) / 0.15
            verts.append((px, y, pz))
    return verts


def _mouth_topology(ns=48, nc=4, nl=5):
    faces, mats = [], []
    for i in range(ns):
        faces.append((0, 1 + (i + 1) % ns, 1 + i))   # same winding as the ring quads
        mats.append(0)
    rings = nc + nl
    for k in range(rings - 1):
        for i in range(ns):
            a = 1 + k * ns + i
            b = 1 + k * ns + (i + 1) % ns
            faces.append((a, b, b + ns, a + ns))
            mats.append(0 if k < nc - 1 else 1)
    return faces, mats


class Face:
    def __init__(self, prefix, spec, anchor, body):
        self.spec = spec
        self.anchor = anchor
        bpy.context.view_layer.update()
        amw = anchor.matrix_world.copy()
        self.eyes = []
        for side, sx in (("L", -1), ("R", 1)):
            ex, ez = sx * spec.eye_dx, spec.eye_z
            sd = surface_depth(body, amw, ex, ez)
            sock = empty(f"{prefix}_eye{side}_socket", (ex, sd + spec.eye_r * spec.eye_embed, ez), 0.02,
                         parent=anchor)
            sock.scale = spec.eye_scale
            self.eyes.append(Eye(f"{prefix}_eye{side}", spec, sock))
        self.brows = []
        for side, sx in (("L", -1), ("R", 1)):
            v, f = _brow_mesh(spec.brow_len, spec.brow_th, spec.brow_arch)
            br = mesh_object(f"{prefix}_brow{side}", v, f)
            br.data.materials.append(spec.brow)
            bx, bz = sx * (spec.eye_dx + 0.004), spec.eye_z + spec.brow_z
            br.location = (bx, surface_depth(body, amw, bx, bz) - 0.004, bz)
            br.parent = anchor
            add_subsurf(br, 1, 1)
            self.brows.append((br, sx, Vector(br.location)))
        # mouth with shape keys, conformed to the surface
        faces, mats = _mouth_topology()
        base = _mouth_shape(spec)
        self.mouth = mesh_object(f"{prefix}_mouth", base, faces, mat_indices=mats)
        self.mouth.data.materials.append(M.mouth_inner())
        self.mouth.data.materials.append(spec.lip)
        self.mouth.location = (0, 0, spec.mouth_z)
        self.mouth.parent = anchor
        depth_cache = {}

        def conform(vs):
            out = []
            for x, y, z in vs:
                key = (round(x, 3), round(z, 3))
                if key not in depth_cache:
                    depth_cache[key] = surface_depth(body, amw, x, z + spec.mouth_z)
                out.append((x, y + depth_cache[key], z))
            return out

        me = self.mouth.data
        basis = conform(base)
        for v, co in zip(me.vertices, basis):
            v.co = co
        self.mouth.shape_key_add(name="Basis")
        for key in MOUTH_KEYS:
            kw = {"round_" if key == "round" else "open_" if key == "open" else key: 1.0}
            sk = self.mouth.shape_key_add(name=key, from_mix=False)
            for d, co in zip(sk.data, conform(_mouth_shape(spec, **kw))):
                d.co = co
        add_subsurf(self.mouth, 1, 2)

    def apply(self, ch):
        g = lambda k, d=0.0: ch.get(k, d)
        blink = g("blink")
        for eye, side in zip(self.eyes, ("L", "R")):
            cu = self.spec.rest_lid_u + g("lid_u") + g(f"lid_u_{side}") + blink
            cl = self.spec.rest_lid_l + g("lid_l") + g(f"lid_l_{side}") + blink + 0.5 * g("squint")
            cu += 0.35 * g("squint")
            eye.apply(g("gaze_x"), g("gaze_y"), cu, cl)
        for br, sx, rest in self.brows:
            side = "L" if sx < 0 else "R"
            up = g("brow_up") + g(f"brow_up_{side}")
            ang = g("brow_ang") + g(f"brow_ang_{side}")   # + = angry (inner end down)
            br.location = rest + Vector((0, 0, up * 0.018 - abs(ang) * 0.002))
            br.rotation_euler = (0, -sx * ang * 0.45, 0)
        kb = self.mouth.data.shape_keys.key_blocks
        for key in MOUTH_KEYS:
            kb[key].value = clamp(g(f"m_{key}"), -0.3, 1.4)
            kb[key].slider_min = -0.3
            kb[key].slider_max = 1.4

    def keyable(self):
        """(id, data_path, index) list of everything apply() writes."""
        out = []
        for eye in self.eyes:
            out.append((eye.ball, "rotation_euler"))
            out += [(lid, "rotation_euler") for lid in eye.lids]
        for br, _sx, _r in self.brows:
            out += [(br, "location"), (br, "rotation_euler")]
        for key in MOUTH_KEYS:
            out.append((self.mouth.data.shape_keys.key_blocks[key], "value"))
        return out
