"""Bukalemunun Fırlatma Dili — Blender (bpy) scene, built entirely from code.

build()      creates the chameleon, the fly, the tropical branch set, lights and camera.
update(t)    poses everything for time t (seconds); every frame is a pure function of t,
             so frames can be rendered in any order / in parallel.
Units: metres-ish; the chameleon's body (snout–vent) is ~0.6 long. Z is up, the
chameleon faces +X on a branch that runs along X.
"""
import math
import random

import bmesh
import bpy
from mathutils import Euler, Matrix, Quaternion, Vector

V = Vector
D = {}  # handles to everything update() animates
FPS = 30
DURATION = 38.0


# ---------------------------------------------------------------- small helpers
def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def lerp(a, b, t):
    return a + (b - a) * t


def ss(a, b, x):
    u = clamp((x - a) / (b - a))
    return u * u * (3 - 2 * u)


def win(t, a, b, r=0.25):
    return ss(a, a + r, t) * (1 - ss(b - r, b, t))


def ease(t):
    return 4 * t ** 3 if t < 0.5 else 1 - (-2 * t + 2) ** 3 / 2


def spline(keys):
    """Hermite spline through keys [(t, v0, v1, ...)] with zero end tangents."""
    ts = [k[0] for k in keys]
    ps = [k[1:] for k in keys]
    n = len(ts)
    ms = []
    for i in range(n):
        if i in (0, n - 1):
            ms.append([0.0] * len(ps[0]))
        else:
            ms.append([(ps[i + 1][j] - ps[i - 1][j]) / (ts[i + 1] - ts[i - 1]) for j in range(len(ps[0]))])

    def f(t):
        if t <= ts[0]:
            return list(ps[0])
        if t >= ts[-1]:
            return list(ps[-1])
        i = 0
        while t > ts[i + 1]:
            i += 1
        h = ts[i + 1] - ts[i]
        s = (t - ts[i]) / h
        h00, h10, h01, h11 = 2 * s ** 3 - 3 * s ** 2 + 1, s ** 3 - 2 * s ** 2 + s, -2 * s ** 3 + 3 * s ** 2, s ** 3 - s ** 2
        return [h00 * ps[i][j] + h10 * h * ms[i][j] + h01 * ps[i + 1][j] + h11 * h * ms[i + 1][j] for j in range(len(ps[0]))]
    return f


def link(obj, parent=None):
    bpy.context.scene.collection.objects.link(obj)
    if parent is not None:
        obj.parent = parent
    return obj


def mesh_obj(name, bm, mat=None, parent=None, smooth=True, subsurf=0):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    link(ob, parent)
    if mat is not None:
        if isinstance(mat, (list, tuple)):
            for m in mat:
                me.materials.append(m)
        else:
            me.materials.append(mat)
    if subsurf:
        md = ob.modifiers.new('sub', 'SUBSURF')
        md.levels = subsurf
        md.render_levels = subsurf
    return ob


def empty(name, loc=(0, 0, 0), parent=None):
    e = bpy.data.objects.new(name, None)
    e.location = loc
    return link(e, parent)


def sphere_bm(r=1.0, seg=32, rings=16):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=r)
    return bm


def curve_obj(name, n, bevel, mat, parent=None, caps=True, res=6):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = bevel
    cu.bevel_resolution = res
    cu.use_fill_caps = caps
    sp = cu.splines.new('POLY')
    sp.points.add(n - 1)
    ob = bpy.data.objects.new(name, cu)
    ob.data.materials.append(mat)
    return link(ob, parent)


def set_curve(ob, pts, radii=None):
    sp = ob.data.splines[0]
    for i, p in enumerate(sp.points):
        q = pts[min(i, len(pts) - 1)]
        p.co = (q[0], q[1], q[2], 1.0)
        p.radius = radii[min(i, len(radii) - 1)] if radii else 1.0


# ---------------------------------------------------------------- materials
def principled(name, color, rough=0.45, sss=0.0, coat=0.0, emit=None, emit_k=0.0, metal=0.0, alpha=1.0, method='BLENDED'):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    b.inputs['Subsurface Weight'].default_value = sss
    b.inputs['Coat Weight'].default_value = coat
    if emit is not None:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = emit_k
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
        m.surface_render_method = method
    return m


def hexc(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x ** 2.2 for x in c)  # sRGB → linear


def skin_material(ref):
    """Bright green chameleon skin: yellow/orange belly and lips, orange diagonal bands,
    fine scale bump. Coordinates come from an empty on the body so all parts match.
    An 'xray' value node fades the skin to a glassy ghost for the cut-away."""
    m = bpy.data.materials.new('ChamSkin')
    m.use_nodes = True
    nt = m.node_tree
    N, L = nt.nodes, nt.links
    b = N['Principled BSDF']
    tc = N.new('ShaderNodeTexCoord')
    tc.object = ref
    sep = N.new('ShaderNodeSeparateXYZ')
    L.new(tc.outputs['Object'], sep.inputs[0])
    # vertical gradient: green back → yellow-orange belly
    mr = N.new('ShaderNodeMapRange')
    mr.inputs['From Min'].default_value = -0.02
    mr.inputs['From Max'].default_value = 0.22
    L.new(sep.outputs['Z'], mr.inputs['Value'])
    ramp = N.new('ShaderNodeValToRGB')
    cr = ramp.color_ramp
    cr.elements[0].position = 0.0
    cr.elements[0].color = (*hexc('#ffb21f'), 1)
    cr.elements[1].position = 0.55
    cr.elements[1].color = (*hexc('#2fd45a'), 1)
    e = cr.elements.new(0.32)
    e.color = (*hexc('#c8e83a'), 1)
    e2 = cr.elements.new(1.0)
    e2.color = (*hexc('#1fae4a'), 1)
    L.new(mr.outputs['Result'], ramp.inputs['Fac'])
    # orange diagonal bands
    wave = N.new('ShaderNodeTexWave')
    wave.inputs['Scale'].default_value = 3.2
    wave.inputs['Distortion'].default_value = 2.0
    wave.inputs['Detail'].default_value = 1.5
    L.new(tc.outputs['Object'], wave.inputs['Vector'])
    bandr = N.new('ShaderNodeValToRGB')
    bandr.color_ramp.elements[0].position = 0.62
    bandr.color_ramp.elements[0].color = (0, 0, 0, 1)
    bandr.color_ramp.elements[1].position = 0.78
    bandr.color_ramp.elements[1].color = (1, 1, 1, 1)
    L.new(wave.outputs['Fac'], bandr.inputs['Fac'])
    mix = N.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    mix.inputs['B'].default_value = (*hexc('#ff7a1a'), 1)
    L.new(bandr.outputs['Color'], mix.inputs['Factor'])
    L.new(ramp.outputs['Color'], mix.inputs['A'])
    mixk = N.new('ShaderNodeMath')
    mixk.operation = 'MULTIPLY'
    mixk.inputs[1].default_value = 0.55
    L.new(bandr.outputs['Color'], mixk.inputs[0])
    L.new(mixk.outputs[0], mix.inputs['Factor'])
    L.new(mix.outputs['Result'], b.inputs['Base Color'])
    # little bumpy scales
    vor = N.new('ShaderNodeTexVoronoi')
    vor.inputs['Scale'].default_value = 140
    L.new(tc.outputs['Object'], vor.inputs['Vector'])
    bump = N.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.25
    bump.inputs['Distance'].default_value = 0.002
    L.new(vor.outputs['Distance'], bump.inputs['Height'])
    L.new(bump.outputs['Normal'], b.inputs['Normal'])
    b.inputs['Roughness'].default_value = 0.38
    b.inputs['Subsurface Weight'].default_value = 0.12
    b.inputs['Subsurface Radius'].default_value = (0.02, 0.03, 0.01)
    b.inputs['Coat Weight'].default_value = 0.25
    b.inputs['Emission Color'].default_value = (*hexc('#2fd45a'), 1)
    b.inputs['Emission Strength'].default_value = 0.0
    # x-ray: mix with a transparent BSDF
    xr = N.new('ShaderNodeValue')
    xr.name = 'xray'
    xr.outputs[0].default_value = 0.0
    tr = N.new('ShaderNodeBsdfTransparent')
    lw = N.new('ShaderNodeLayerWeight')
    lw.inputs['Blend'].default_value = 0.35
    k = N.new('ShaderNodeMath')
    k.operation = 'MULTIPLY'
    L.new(xr.outputs[0], k.inputs[0])
    inv = N.new('ShaderNodeMath')
    inv.operation = 'SUBTRACT'
    inv.inputs[0].default_value = 1.0
    L.new(lw.outputs['Facing'], inv.inputs[1])  # 1 - facing → keep the rim
    k.inputs[1].default_value = 1.0
    k2 = N.new('ShaderNodeMath')
    k2.operation = 'MULTIPLY'
    L.new(k.outputs[0], k2.inputs[0])
    L.new(inv.outputs[0], k2.inputs[1])
    k3 = N.new('ShaderNodeMath')
    k3.operation = 'MULTIPLY'
    k3.inputs[1].default_value = 0.95
    L.new(k2.outputs[0], k3.inputs[0])
    mixs = N.new('ShaderNodeMixShader')
    L.new(k3.outputs[0], mixs.inputs['Fac'])
    L.new(b.outputs['BSDF'], mixs.inputs[1])
    L.new(tr.outputs['BSDF'], mixs.inputs[2])
    out = N['Material Output']
    L.new(mixs.outputs['Shader'], out.inputs['Surface'])
    m.surface_render_method = 'DITHERED'
    D['xray_nodes'] = D.get('xray_nodes', []) + [xr]
    return m


def leaf_image(name, seed, hue):
    """Paint a leaf (with veins) into an RGBA image used as an alpha-mapped plane."""
    from PIL import Image, ImageDraw, ImageFilter
    W, H = 256, 512
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    rnd = random.Random(seed)
    pts = []
    for i in range(64):
        a = i / 63 * math.pi
        w = math.sin(a) ** 0.8 * (W * 0.46) * (1 + 0.04 * math.sin(i * 1.7))
        pts.append((W / 2 + w, H * 0.98 - (1 - math.cos(a)) / 2 * H * 0.95))
    pts += [(W - x, y) for x, y in reversed(pts)]
    base = tuple(int(255 * c) for c in hue)
    d.polygon(pts, fill=(*base, 255))
    dark = tuple(int(c * 0.7) for c in base)
    d.line([(W / 2, H * 0.98), (W / 2, H * 0.04)], fill=(*dark, 255), width=5)
    for k in range(9):
        y = H * (0.88 - k * 0.09)
        for s in (-1, 1):
            d.line([(W / 2, y), (W / 2 + s * W * 0.38, y - H * 0.08)], fill=(*dark, 255), width=3)
    light = tuple(min(255, int(c * 1.25)) for c in base)
    d.line([(W * 0.62, H * 0.2), (W * 0.7, H * 0.6)], fill=(*light, 120), width=8)
    im = im.filter(ImageFilter.SMOOTH)
    img = bpy.data.images.new(name, W, H, alpha=True)
    img.pixels = [c / 255 for px in im.transpose(Image.FLIP_TOP_BOTTOM).getdata() for c in px]
    img.pack()
    return img


def leaf_material(name, img):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = img
    nt.links.new(tex.outputs['Color'], b.inputs['Base Color'])
    nt.links.new(tex.outputs['Alpha'], b.inputs['Alpha'])
    b.inputs['Roughness'].default_value = 0.5
    b.inputs['Subsurface Weight'].default_value = 0.2
    b.inputs['Transmission Weight'].default_value = 0.15
    m.surface_render_method = 'DITHERED'
    return m


# ---------------------------------------------------------------- the chameleon
HC = V((0.30, 0.0, 0.205))     # head centre (in head-pivot space it is relative to the neck)
NECK = V((0.17, 0.0, 0.19))
HL, HW, HH = 0.14, 0.066, 0.08
ZM = -0.16                      # mouth line (normalised head space)
HINGE_X = -0.62                 # jaw hinge (normalised)


def head_shape(x, y, z):
    """Normalised sphere point → chameleon head (casque at the back, narrow snout)."""
    y2 = y * (1 - 0.38 * max(0.0, x))
    z2 = z * (1 - 0.3 * max(0.0, x))
    if z > 0:
        z2 += 0.85 * max(0.0, 0.2 - x) * z * max(0.0, 1 - abs(y) * 1.5)  # casque (helmet) rising at the back
    return V((x * HL, y2 * HW, z2 * HH)) + (HC - NECK)


def build_head(skin, mouth_mat, head_piv):
    parts = {}
    for part in ('upper', 'lower'):
        bm = sphere_bm(1.0, 56, 32)
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        res = bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(0, 0, ZM), plane_no=(0, 0, 1), clear_inner=(part == 'upper'), clear_outer=(part == 'lower'))
        cut = [e for e in res['geom_cut'] if isinstance(e, bmesh.types.BMEdge)]
        filled = bmesh.ops.holes_fill(bm, edges=cut, sides=0)
        for f in filled['faces']:
            f.material_index = 1
        for v in bm.verts:
            v.co = head_shape(*v.co)
        if part == 'lower':
            hinge = head_shape(HINGE_X, 0, ZM)
            for v in bm.verts:
                v.co -= hinge
        ob = mesh_obj('Head_' + part, bm, [skin, mouth_mat], head_piv, subsurf=1)
        if part == 'lower':
            jaw = empty('JawPivot', head_shape(HINGE_X, 0, ZM), head_piv)
            ob.parent = jaw
            parts['jaw'] = jaw
        parts[part] = ob
    # inside of the mouth (visible when the jaw opens)
    bm = sphere_bm(1.0, 24, 12)
    bmesh.ops.scale(bm, vec=(0.07, 0.036, 0.012), verts=bm.verts)
    inner = mesh_obj('MouthInside', bm, mouth_mat, head_piv)
    D['mouth_inside'] = inner
    inner.location = head_shape(0.2, 0, ZM - 0.12)
    # smile line along the seam (front half)
    pts = []
    for i in range(25):
        a = -1 + 2 * i / 24
        x = 0.98 - 0.95 * abs(a) * abs(a) ** 0.2
        r = math.sqrt(max(0.0, 1 - x * x - ZM * ZM))
        zc = ZM + 0.06 * abs(a) ** 3  # corners curl up into a smile
        pts.append(head_shape(x, math.copysign(r * 1.01, a), zc) + V((0, 0, 0.001)))
    smile = curve_obj('Smile', len(pts), 0.0028, D['mat_line'], head_piv)
    set_curve(smile, pts)
    parts['smile'] = smile
    return parts


def build_eye(side, head_piv):
    """Eye turret: a skin-covered dome with a big cute iris at its opening. Turrets rotate independently."""
    base = head_shape(0.22, 0.74 * side, 0.36)
    piv = empty('EyePiv%+d' % side, base, head_piv)
    rot = empty('EyeRot%+d' % side, (0, 0, 0), piv)
    bm = sphere_bm(1.0, 32, 16)
    bmesh.ops.scale(bm, vec=(0.046, 0.046, 0.046), verts=bm.verts)
    turret = mesh_obj('Turret%+d' % side, bm, D['skin'], rot)
    turret.modifiers.new('sub', 'SUBSURF').levels = 1
    # aperture looks along local +X of 'rot'
    bm = sphere_bm(1.0, 32, 16)
    bmesh.ops.scale(bm, vec=(0.012, 0.03, 0.03), verts=bm.verts)
    white = mesh_obj('EyeWhite%+d' % side, bm, D['mat_white'], rot)
    white.location = (0.044, 0, 0)
    bm = sphere_bm(1.0, 24, 12)
    bmesh.ops.scale(bm, vec=(0.008, 0.021, 0.021), verts=bm.verts)
    iris = mesh_obj('Iris%+d' % side, bm, D['mat_iris'], rot)
    iris.location = (0.052, 0, 0)
    bm = sphere_bm(1.0, 20, 10)
    bmesh.ops.scale(bm, vec=(0.006, 0.012, 0.012), verts=bm.verts)
    pupil = mesh_obj('Pupil%+d' % side, bm, D['mat_pupil'], rot)
    pupil.location = (0.057, 0, 0)
    bm = sphere_bm(1.0, 12, 6)
    bmesh.ops.scale(bm, vec=(0.004, 0.005, 0.005), verts=bm.verts)
    hl = mesh_obj('Glint%+d' % side, bm, D['mat_glint'], rot)
    hl.location = (0.061, 0.006, 0.007)
    # lids: two skin domes that close over the aperture (blink / squint)
    lids = []
    for k, sgn in enumerate((1, -1)):
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=28, v_segments=14, radius=0.066)
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z * sgn < -0.002], context='VERTS')
        lid = mesh_obj('Lid%+d%d' % (side, k), bm, D['skin'], rot)
        lids.append(lid)
    D['eyes'] = D.get('eyes', []) + [dict(side=side, piv=piv, rot=rot, lids=lids, base=base)]


def body_bm():
    """Laterally flattened body with a dorsal ridge, lofted from hip (x=-0.34) to neck."""
    bm = bmesh.new()
    rings, seg = 40, 32
    grid = []
    for i in range(rings):
        s = i / (rings - 1)
        x = lerp(-0.36, 0.2, s)
        zc = 0.17 + 0.02 * math.sin(math.pi * s)
        w = 0.03 + 0.05 * math.sin(math.pi * (0.08 + 0.84 * s)) ** 0.8
        ht = 0.035 + 0.085 * math.sin(math.pi * (0.1 + 0.8 * s)) ** 0.9
        hb = 0.03 + 0.06 * math.sin(math.pi * (0.05 + 0.9 * s))
        if s > 0.85:
            k = (s - 0.85) / 0.15
            w, ht, hb = lerp(w, 0.05, k), lerp(ht, 0.06, k), lerp(hb, 0.05, k)
        row = []
        for j in range(seg):
            a = 2 * math.pi * j / seg  # 0 = top
            c, sn = math.cos(a), math.sin(a)
            y = w * sn * (1 - 0.45 * max(0.0, c) ** 3)  # pinched dorsal ridge
            z = zc + (ht if c > 0 else hb) * c
            row.append(bm.verts.new((x, y, z)))
        grid.append(row)
    for i in range(rings - 1):
        for j in range(seg):
            bm.faces.new((grid[i][j], grid[i][(j + 1) % seg], grid[i + 1][(j + 1) % seg], grid[i + 1][j]))
    bm.faces.new(list(reversed(grid[0])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def build_chameleon():
    root = empty('Chameleon')
    ref = empty('SkinRef', (0, 0, 0), root)
    D['skin'] = skin = skin_material(ref)
    D['skin_x'] = skin_material(ref)  # same look, plus the fade used for the x-ray
    D['skin_x'].surface_render_method = 'BLENDED'
    D['skin_x'].use_transparency_overlap = False
    D['mat_line'] = principled('Line', hexc('#1d5a22'), 0.6)
    D['mat_white'] = principled('EyeWhite', (0.95, 0.95, 0.92), 0.2, coat=1.0)
    D['mat_iris'] = principled('Iris', hexc('#ffb000'), 0.25, coat=1.0, emit=hexc('#ff9a00'), emit_k=0.3)
    D['mat_pupil'] = principled('Pupil', (0.01, 0.01, 0.012), 0.08, coat=1.0)
    D['mat_glint'] = principled('Glint', (1, 1, 1), 0.1, emit=(1, 1, 1), emit_k=4.0)
    mouth_mat = principled('MouthInside', hexc('#d24a6a'), 0.35, sss=0.2)
    D['mat_mouth'] = mouth_mat
    D['mat_tongue'] = principled('Tongue', hexc('#ff7da6'), 0.22, sss=0.35, coat=0.9)
    D['mat_tip'] = principled('TonguePad', hexc('#ff4a86'), 0.1, sss=0.3, coat=1.0, emit=hexc('#ff2f6f'), emit_k=0.12)
    body = mesh_obj('Body', body_bm(), skin, root, subsurf=1)
    D['body'] = body
    # dorsal crest spikes
    for k in range(14):
        x = lerp(-0.3, 0.16, k / 13)
        s = (x + 0.36) / 0.56
        zc = 0.17 + 0.02 * math.sin(math.pi * s)
        ht = 0.035 + 0.085 * math.sin(math.pi * (0.1 + 0.8 * s)) ** 0.9
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=0.009, radius2=0.0, depth=0.022)
        sp = mesh_obj('Crest%d' % k, bm, skin, body, smooth=True)
        sp.location = (x, 0, zc + ht - 0.004)
        sp.rotation_euler = (0, -0.4, 0)
    head_piv = empty('HeadPivot', NECK, root)
    D['head'] = head_piv
    D['headparts'] = build_head(skin, mouth_mat, head_piv)
    for side in (1, -1):
        build_eye(side, head_piv)
    # legs: shoulder → elbow → foot, with two toe bundles pinching the branch
    leg_mat = skin
    D['legs'] = []
    for (x, side, front) in ((0.12, 1, True), (0.12, -1, True), (-0.25, 1, False), (-0.25, -1, False)):
        c = curve_obj('Leg', 3, 0.017, leg_mat, root)
        sh = V((x, 0.045 * side, 0.15))
        el = V((x + (0.05 if front else -0.03), 0.105 * side, 0.12))
        ft = V((x + (0.07 if front else -0.01), 0.055 * side, 0.052))
        set_curve(c, [sh, el, ft], [1.2, 0.9, 0.75])
        for k, dirn in enumerate((side, -side)):  # toe bundles pinch the branch from both sides
            tc = curve_obj('Toe', 6, 0.011, leg_mat, root)
            pts = [ft]
            for i in range(5):
                phi = 0.2 + i * 0.3
                pts.append(V((ft.x + (0.01 if k == 0 else -0.01), math.sin(phi) * 0.064 * dirn, math.cos(phi) * 0.064)))
            set_curve(tc, pts, [1.1, 1.0, 1.0, 0.95, 0.85, 0.7])
        D['legs'].append(c)
    # tail (spiral) — updated every frame
    D['tail'] = curve_obj('Tail', 48, 1.0, skin, root, res=4)
    D['tail'].data.bevel_depth = 0.042
    # tongue: base inside the mouth, curve + sticky club tip (world space, not parented)
    # fleshy tongue: radius profile is set per point every frame (bevel_depth = base radius)
    D['tongue'] = curve_obj('Tongue', TONGUE_N, TONGUE_R, D['mat_tongue'], None, res=5)
    D['tongue'].data.splines[0].use_smooth = True
    # sticky club: a bulb whose front is cupped (the pad that wraps around prey)
    bm = sphere_bm(1.0, 32, 18)
    for v in bm.verts:
        x, y, z = v.co
        r2 = min(1.0, y * y + z * z)
        if x > 0:
            v.co.x = x * 0.72 - 0.32 * (1 - r2) ** 1.5   # flatten + dimple the front
        else:
            v.co.x = x * 1.15                             # longer, rounder back that merges into the tongue
    bmesh.ops.scale(bm, vec=(0.034, 0.036, 0.036), verts=bm.verts)
    D['tip'] = mesh_obj('TongueTip', bm, D['mat_tip'], None, smooth=True)
    return root


def build_apparatus(head_piv):
    """Cut-away model of the tongue launcher inside the throat (head-pivot space):
    the hyoid's entoglossal process (a bony rod), elastic collagen sheaths around it,
    and the accelerator muscle wrapped around the sheaths."""
    g = empty('Apparatus', (0, 0, 0), head_piv)
    D['mat_bone'] = principled('Bone', (0.93, 0.9, 0.82), 0.4, emit=(0.9, 0.88, 0.8), emit_k=0.15)
    D['mat_sheath'] = principled('Sheath', hexc('#4fd8ff'), 0.2, emit=hexc('#4fd8ff'), emit_k=1.0)
    D['mat_muscle'] = principled('Muscle', hexc('#ff3b4f'), 0.35, sss=0.3, emit=hexc('#ff2040'), emit_k=1.2)
    rod = curve_obj('Rod', 2, 0.006, D['mat_bone'], g)
    set_curve(rod, [V((0.03, 0, -0.035)), V((0.2, 0, -0.025))])
    D['rod'] = rod
    D['sheaths'] = []
    for k in range(3):
        s = curve_obj('Sheath%d' % k, 2, 0.009 + 0.004 * k, D['mat_sheath'], g, res=3)
        D['sheaths'].append(s)
    D['muscle'] = curve_obj('Muscle', 2, 0.024, D['mat_muscle'], g, res=4)
    D['apparatus'] = g
    g.hide_render = True


def build_fly(name):
    g = empty(name)
    bm = sphere_bm(1.0, 20, 12)
    bmesh.ops.scale(bm, vec=(0.03, 0.019, 0.019), verts=bm.verts)
    mesh_obj(name + 'Body', bm, D['mat_fly'], g)
    bm = sphere_bm(1.0, 16, 10)
    bmesh.ops.scale(bm, vec=(0.014, 0.016, 0.015), verts=bm.verts)
    h = mesh_obj(name + 'Head', bm, D['mat_fly'], g)
    h.location = (0.032, 0, 0.004)
    for s in (1, -1):
        bm = sphere_bm(1.0, 14, 8)
        bmesh.ops.scale(bm, vec=(0.009, 0.009, 0.01), verts=bm.verts)
        e = mesh_obj(name + 'Eye', bm, D['mat_flyeye'], g)
        e.location = (0.038, 0.011 * s, 0.009)
    wings = []
    for s in (1, -1):
        bm = bmesh.new()
        vs = [bm.verts.new(p) for p in ((0, 0, 0), (-0.01, 0.055 * s, 0.004), (-0.04, 0.05 * s, 0.002), (-0.035, 0.012 * s, 0))]
        bm.faces.new(vs if s > 0 else list(reversed(vs)))
        w = mesh_obj(name + 'Wing', bm, D['mat_wing'], g, smooth=False)
        w.location = (0.006, 0.006 * s, 0.017)
        wings.append(w)
    return dict(g=g, wings=wings)


# ---------------------------------------------------------------- set
def build_set():
    sc = bpy.context.scene
    world = bpy.data.worlds.new('Jungle')
    sc.world = world
    world.use_nodes = True
    nt = world.node_tree
    bg = nt.nodes['Background']
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['Generated'], sep.inputs[0])
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = (*hexc('#1d6b3f'), 1)
    ramp.color_ramp.elements[1].color = (*hexc('#bff2c8'), 1)
    ramp.color_ramp.elements[0].position = 0.35
    ramp.color_ramp.elements[1].position = 0.75
    nt.links.new(sep.outputs['Z'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], bg.inputs['Color'])
    bg.inputs['Strength'].default_value = 1.0
    # lights
    sun = bpy.data.objects.new('Sun', bpy.data.lights.new('Sun', 'SUN'))
    sun.data.energy = 3.2
    sun.data.color = (1.0, 0.95, 0.85)
    sun.data.angle = math.radians(6)
    sun.rotation_euler = Euler((math.radians(42), math.radians(18), math.radians(-35)))
    link(sun)
    fill = bpy.data.objects.new('Fill', bpy.data.lights.new('Fill', 'AREA'))
    fill.data.energy = 120
    fill.data.size = 2.5
    fill.data.color = (0.8, 1.0, 0.9)
    fill.location = (0.6, -2.2, 1.2)
    fill.rotation_euler = Euler((math.radians(65), 0, 0))
    link(fill)
    rim = bpy.data.objects.new('Rim', bpy.data.lights.new('Rim', 'AREA'))
    rim.data.energy = 160
    rim.data.size = 1.5
    rim.data.color = (1.0, 0.9, 0.6)
    rim.location = (-0.6, 1.6, 1.4)
    rim.rotation_euler = Euler((math.radians(-55), 0, math.radians(10)))
    link(rim)
    # branch with bark
    bark = bpy.data.materials.new('Bark')
    bark.use_nodes = True
    n = bark.node_tree.nodes
    b = n['Principled BSDF']
    noise = n.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 18
    noise.inputs['Detail'].default_value = 6
    mr = n.new('ShaderNodeValToRGB')
    mr.color_ramp.elements[0].color = (*hexc('#4a2d17'), 1)
    mr.color_ramp.elements[1].color = (*hexc('#9a6a3a'), 1)
    bark.node_tree.links.new(noise.outputs['Fac'], mr.inputs['Fac'])
    bark.node_tree.links.new(mr.outputs['Color'], b.inputs['Base Color'])
    bump = n.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.6
    bark.node_tree.links.new(noise.outputs['Fac'], bump.inputs['Height'])
    bark.node_tree.links.new(bump.outputs['Normal'], b.inputs['Normal'])
    b.inputs['Roughness'].default_value = 0.85
    br = curve_obj('Branch', 9, 0.05, bark, None, res=5)
    set_curve(br, [V((x, 0.04 * math.sin(x * 1.5) * ss(0.8, 1.6, abs(x)), -0.05 * ss(0.8, 2.0, abs(x)))) for x in [-2.4 + i * 0.6 for i in range(9)]])
    D['branch'] = br
    # side twig with the leaf the tongue will stick to in the finale
    twig = curve_obj('Twig', 4, 0.012, bark, None, res=3)
    D['twig'] = twig
    set_curve(twig, [V((0.36, 0.03, 0.03)), V((0.44, 0.2, 0.22)), V((0.52, 0.36, 0.38)), V((0.57, 0.44, 0.46))], [1, 0.8, 0.6, 0.4])
    # leaves
    hues = [(0.28, 0.75, 0.32), (0.2, 0.6, 0.25), (0.42, 0.82, 0.3), (0.15, 0.5, 0.22)]
    imgs = [leaf_image('leaf%d' % i, i, hues[i]) for i in range(4)]
    mats = [leaf_material('LeafMat%d' % i, imgs[i]) for i in range(4)]
    rnd = random.Random(4)

    def leaf(loc, size, rot, mi):
        bm = bmesh.new()
        bmesh.ops.create_grid(bm, x_segments=2, y_segments=4, size=0.5)
        uv = bm.loops.layers.uv.new('UVMap')
        for f in bm.faces:
            for l in f.loops:
                l[uv].uv = (l.vert.co.x + 0.5, l.vert.co.y + 0.5)
        for v in bm.verts:
            v.co.z = 0.08 * (v.co.x ** 2) * 4 - 0.05 * (v.co.y + 0.5) ** 2  # gentle cup and droop
            v.co.x *= 0.5
        ob = mesh_obj('Leaf', bm, mats[mi], None, smooth=True)
        ob.scale = (size, size, size)
        ob.location = loc
        ob.rotation_euler = rot
        return ob
    D['leaves'] = []
    for i in range(46):  # background canopy: behind the branch (+Y) and around
        a = rnd.uniform(-1.2, 1.2)
        r = rnd.uniform(1.2, 4.5)
        loc = (math.sin(a) * r * 1.4 + rnd.uniform(-0.6, 0.6), math.cos(a) * r, rnd.uniform(-1.0, 2.2))
        D['leaves'].append(leaf(loc, rnd.uniform(0.35, 1.1), (rnd.uniform(-1.4, 0.2), rnd.uniform(-0.5, 0.5), rnd.uniform(0, 6.28)), i % 4))
    for i in range(10):  # a few big blurry foreground leaves at the frame edges
        side = 1 if i % 2 else -1
        loc = (side * rnd.uniform(0.7, 1.4), rnd.uniform(-1.6, -1.0), rnd.uniform(-0.8, 0.9))
        D['leaves'].append(leaf(loc, rnd.uniform(0.5, 0.9), (rnd.uniform(-1.2, -0.4), 0, rnd.uniform(0, 6.28)), (i + 1) % 4))
    # the target leaf for the finale
    D['target_leaf'] = leaf((0.58, 0.46, 0.5), 0.36, (1.2, 0.2, 0.6), 0)
    # flowers (hibiscus-like) for colour
    petal_cols = ['#ff3b6b', '#ff8a1f', '#ffd21f', '#d94cff', '#ff5ab0']
    for i in range(16):
        col = principled('Flower%d' % i, hexc(petal_cols[i % 5]), 0.4, sss=0.3)
        g = empty('Flower')
        a = rnd.uniform(-1.3, 1.3)
        r = rnd.uniform(1.0, 3.2)
        g.location = (math.sin(a) * r * 1.4, math.cos(a) * r, rnd.uniform(-0.6, 1.6))
        g.rotation_euler = (rnd.uniform(-1.2, 0.3), rnd.uniform(-0.6, 0.6), rnd.uniform(0, 6))
        for k in range(5):
            bm = sphere_bm(1.0, 12, 8)
            bmesh.ops.scale(bm, vec=(0.09, 0.05, 0.012), verts=bm.verts)
            p = mesh_obj('Petal', bm, col, g)
            p.location = (math.cos(k * 1.2566) * 0.07, math.sin(k * 1.2566) * 0.07, 0)
            p.rotation_euler = (0, 0, k * 1.2566)
        bm = sphere_bm(1.0, 10, 6)
        bmesh.ops.scale(bm, vec=(0.025, 0.025, 0.03), verts=bm.verts)
        mesh_obj('Pistil', bm, principled('Pistil', hexc('#ffe14a'), 0.4, emit=hexc('#ffb000'), emit_k=0.3), g)
    # hanging vines
    vine_mat = principled('Vine', hexc('#3c8a2a'), 0.6)
    for i in range(7):
        x = rnd.uniform(-1.8, 1.8)
        y = rnd.uniform(0.8, 2.5)
        v = curve_obj('Vine', 6, 0.012, vine_mat, None, res=2)
        set_curve(v, [V((x + 0.05 * math.sin(k), y, 2.6 - k * 0.5)) for k in range(6)])
    # sun glints in the canopy (out-of-focus bokeh)
    glow = principled('Glint', (1, 1, 0.9), 0.5, emit=(1.0, 0.97, 0.8), emit_k=3.0)
    for i in range(14):
        bm = sphere_bm(1.0, 10, 6)
        bmesh.ops.scale(bm, vec=(0.03, 0.03, 0.03), verts=bm.verts)
        o = mesh_obj('Bokeh', bm, glow, None)
        o.location = (rnd.uniform(-3.5, 3.5), rnd.uniform(5.0, 8.0), rnd.uniform(0.5, 3.0))


def build_camera():
    sc = bpy.context.scene
    cd = bpy.data.cameras.new('Cam')
    cd.lens = 40
    cd.sensor_width = 36
    cd.sensor_fit = 'VERTICAL'
    cd.sensor_height = 36
    cd.dof.use_dof = True
    cd.dof.aperture_fstop = 2.4
    cd.clip_start = 0.01
    cd.clip_end = 100
    cam = bpy.data.objects.new('Cam', cd)
    link(cam)
    sc.camera = cam
    D['cam'] = cam
    return cam


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.fps = FPS
    D.clear()
    D['mat_fly'] = principled('Fly', hexc('#1c2340'), 0.25, metal=0.4, coat=1.0)
    D['mat_flyeye'] = principled('FlyEye', hexc('#d01c1c'), 0.2, coat=1.0, emit=hexc('#ff2020'), emit_k=0.3)
    D['mat_wing'] = principled('Wing', (0.85, 0.95, 1.0), 0.1, alpha=0.35, emit=(0.6, 0.8, 1.0), emit_k=0.2)
    build_set()
    root = build_chameleon()
    build_apparatus(D['head'])
    D['root'] = root
    D['skin_objs'] = [o for o in bpy.data.objects if o.type in ('MESH', 'CURVE') and o.material_slots and o.material_slots[0].material == D['skin']]
    D['fly1'] = build_fly('Fly1')
    D['fly2'] = build_fly('Fly2')
    D['fly3'] = build_fly('Fly3')
    build_camera()
    # render settings
    sc.render.engine = 'BLENDER_EEVEE'
    sc.eevee.taa_render_samples = 6
    sc.eevee.use_shadows = True
    for k, v in (('shadow_ray_count', 1), ('shadow_step_count', 2), ('use_raytracing', False), ('shadow_resolution_scale', 0.5)):
        try:
            setattr(sc.eevee, k, v)
        except Exception:
            pass
    sc.render.film_transparent = False
    sc.view_settings.view_transform = 'AgX'
    try:
        sc.view_settings.look = 'AgX - Punchy'
    except Exception:
        pass
    return sc


# ================================================================ animation
N_OFF = 0.4  # narration starts here


def mouth_flap(t, env):
    """Jaw opening driven by the narration loudness (rough lip-sync)."""
    if env is None:
        return 0.0
    i = int((t - N_OFF) * 100)
    return env[i] if 0 <= i < len(env) else 0.0


def tail_points(curl, sway, t):
    """Tail from the hip, curling down into a spiral (ventrally)."""
    pts, radii = [], []
    p = V((-0.34, 0.0, 0.16))
    ang = math.radians(195)  # pointing back and a little down
    n = 48
    L = 0.85
    ds = L / n
    for i in range(n):
        f = i / (n - 1)
        pts.append(p.copy())
        radii.append(lerp(1.0, 0.12, f ** 0.9))
        k = curl * (0.4 + 14.0 * f ** 2.2)  # curvature grows towards the tip → spiral
        ang += k * ds
        p = p + V((math.cos(ang) * ds, 0.012 * math.sin(t * 1.2 + f * 3) * sway, math.sin(ang) * ds))
    return pts, radii


def pose_chameleon(t, o, env=None):
    """o: dict(jaw, headYaw, headPitch, eyes=[(yaw,pitch)x2], lids, squint, bob, curl, xray)."""
    root = D['root']
    root.location = (0, 0, 0.005 * math.sin(t * 1.4) + o.get('bob', 0.0))
    root.rotation_euler = (0, o.get('lean', 0.0), 0)
    D['body'].scale = (1, 1 + 0.02 * math.sin(t * 2.2), 1 + 0.015 * math.sin(t * 2.2))
    hp = D['head']
    hp.rotation_euler = Euler((o.get('headRoll', 0.0), -o.get('headPitch', 0.0), o.get('headYaw', 0.0)), 'XYZ')
    jaw = clamp(o.get('jaw', 0.0) + 0.55 * mouth_flap(t, env) * o.get('talk', 0.0))
    D['headparts']['jaw'].rotation_euler = (0, jaw * 0.55, 0)
    for k, e in enumerate(D['eyes']):
        yaw, pitch = o.get('eyes', [(0, 0), (0, 0)])[k]
        # neutral: turrets point sideways (+/-Y) and a bit forward; yaw turns toward +X (forward)
        side = e['side']
        e['piv'].rotation_euler = Euler((0, 0, side * math.radians(70)), 'XYZ')  # aperture (+X) → sideways
        e['rot'].rotation_euler = Euler((0, -pitch, -side * yaw), 'XYZ')
        blink = clamp(o.get('blink', 0.0))
        sq = clamp(o.get('squint', 0.0))
        up, lo = e['lids']
        # lids rotate around the aperture axis; open = folded back
        up.rotation_euler = (0, lerp(-1.25, 0.8, max(blink, sq * 0.45)), 0)
        lo.rotation_euler = (0, lerp(1.25, -0.8, max(blink, sq * 0.5)), 0)
    pts, radii = tail_points(o.get('curl', 1.0), o.get('sway', 1.0), t)
    set_curve(D['tail'], pts, radii)
    # x-ray
    xr = o.get('xray', 0.0)
    for n in D['xray_nodes']:
        n.outputs[0].default_value = xr
    m = D['skin_x'] if xr > 0.01 else D['skin']
    for ob in D['skin_objs']:
        if ob.material_slots[0].material != m:
            ob.material_slots[0].material = m
        if len(ob.material_slots) > 1:  # mouth caps of the head halves go glassy too in the x-ray
            ob.material_slots[1].material = D['skin_x'] if xr > 0.01 else D['mat_mouth']
    D['mouth_inside'].hide_render = xr > 0.01
    D['apparatus'].hide_render = o.get('xray', 0.0) < 0.02
    bpy.context.view_layer.update()


def mouth_world():
    hp = D['head']
    return hp.matrix_world @ head_shape(0.92, 0, ZM - 0.02)


TONGUE_N = 56       # points along the tongue
TONGUE_R = 0.034    # base radius (bevel depth); per-point radii scale it


def set_tongue(L, target_dir, tip_open=0.0, wobble=0.0, t=0.0, bend=0.0):
    """Fleshy tongue from the mouth along target_dir, length L (0 = inside).

    Real chameleon tongues are not coiled: they sit bunched (pleated) on the hyoid and
    shoot out straight. So the shape here is
      * thick at the root, tapering, then a short neck that swells into the sticky club;
      * fat and pleated like an accordion while short, smooth and slimmer when stretched;
      * a travelling whip ripple (ends fixed) + a slight sag — the tip position is exactly
        mouth + d·L as before, so prey/ruler/labels stay where they were.
    """
    m = mouth_world()
    tg = D['tongue']
    tip = D['tip']
    if L < 0.005:
        tg.hide_render = True
        tip.hide_render = True
        return m
    tg.hide_render = False
    tip.hide_render = False
    d = target_dir.normalized()
    side = d.cross(V((0, 0, 1)))
    if side.length < 1e-4:
        side = V((0, 1, 0))
    side.normalize()
    up = side.cross(d).normalized()
    n = TONGUE_N
    stretch = clamp((0.4 / max(L, 0.02)) ** 0.3, 0.8, 1.35)    # short = fat, long = slimmer
    pleat = 0.1 * clamp(1 - L / 0.3, 0, 1)                      # accordion rings while bunched
    amp = (0.05 * wobble + 0.006) * min(L, 1.2)                   # whip ripple amplitude
    sag = 0.06 * min(L, 1.2) * clamp((L - 0.15) / 0.4, 0, 1)
    pts, radii = [], []
    for i in range(n):
        f = i / (n - 1)
        env = math.sin(math.pi * f)
        p = m + d * (L * f)
        p += up * (env * (bend * L * 0.15 - sag))
        p += side * (env * amp * math.sin(f * 7.0 - t * 26))
        p += up * (env * amp * 0.6 * math.sin(f * 5.0 - t * 21 + 1.3))
        pts.append(p)
        # radius profile: root 1.0 → 0.62 at the neck (f≈0.9) → 0.85 where it enters the club
        prof = lerp(1.0, 0.55, ss(0.0, 0.9, f)) + 0.2 * ss(0.9, 1.0, f)
        rings = 1 + pleat * math.sin(f * 9 * 2 * math.pi) * ss(0.0, 0.08, f)
        radii.append(prof * stretch * rings)
    set_curve(tg, pts, radii)
    tip.location = pts[-1] + d * 0.012
    tip.rotation_euler = d.to_track_quat('X', 'Z').to_euler()
    s = 1.0 + 0.25 * tip_open
    tip.scale = (s * 0.9, s, s)
    return pts[-1] + d * 0.03


def place_fly(f, pos, heading, t, flap=True, visible=True):
    g = f['g']
    g.hide_render = not visible
    for ch in g.children:
        ch.hide_render = not visible
    if not visible:
        return
    g.location = pos
    g.rotation_euler = (0, 0, heading)
    a = (0.9 * math.sin(t * 2 * math.pi * 7.3)) if flap else 0.15
    for k, w in enumerate(f['wings']):
        w.rotation_euler = ((1 if k == 0 else -1) * a, 0, 0)


def look_at(cam, eye, target, roll=0.0):
    cam.location = eye
    d = (V(target) - V(eye)).normalized()
    q = d.to_track_quat('-Z', 'Y')
    cam.rotation_euler = q.to_euler()
    if roll:
        cam.rotation_euler.rotate_axis('Z', roll)
    cam.data.dof.focus_distance = (V(target) - V(eye)).length


def eye_target_angles(e, target):
    """Yaw/pitch for an eye turret so that its aperture looks at a world point."""
    piv = e['piv']
    m = piv.matrix_world.inverted()
    p = m @ V(target)
    yaw = math.atan2(p.y, p.x) * -e['side']
    pitch = math.atan2(p.z, math.hypot(p.x, p.y))
    return (clamp(yaw, -1.3, 1.3), clamp(pitch, -0.9, 0.9))


# ---------------------------------------------------------------- the timeline
CUTS = [4.5, 12.0, 22.0, 29.0]


def update(t, env=None):
    """Pose the whole scene for time t; returns info for overlays (labels, meters)."""
    info = {'t': t, 'labels': {}}
    cam = D['cam']
    for f in ('fly1', 'fly2', 'fly3'):
        place_fly(D[f], V((0, 0, -5)), 0, t, visible=False)
    tongue_L = 0.0
    D['twig'].hide_render = D['target_leaf'].hide_render = t < 29.0  # the finale's twig would only clutter earlier shots
    o = dict(curl=1.0, sway=1.0, eyes=[(0.15, 0.05), (0.15, 0.05)], talk=0.0, blink=0.0, squint=0.0)
    blinks = [1.1, 7.2, 11.5, 13.0, 19.4, 31.0, 36.6]
    o['blink'] = max(math.exp(-((t - b) / 0.07) ** 2) for b in blinks)

    # ---------- S1 0–4.5: looks at us, a fly passes the nose, eyes track it independently, it lands on the nose
    if t < 4.5:
        o['headYaw'] = -0.35 + 0.1 * math.sin(t * 0.8)
        o['headPitch'] = 0.05
        o['talk'] = 1.0 if t < 3.2 else 0.0
        pose_chameleon(t, o, env)
        nose = D['head'].matrix_world @ (head_shape(0.9, 0, 0.42) + V((0, 0, 0.016)))
        fa = spline([(0.0, 0.95, -0.55, 0.42), (1.0, 0.62, -0.35, 0.33), (1.8, 0.5, -0.14, 0.3), (2.4, nose.x + 0.06, 0.04, nose.z + 0.05)])(min(t, 2.4))
        fp = V(fa).lerp(nose, ss(2.4, 2.75, t))
        if t > 4.05:
            fp = nose.lerp(V((0.85, -0.35, 0.5)), ss(4.05, 4.5, t))
        landed = 2.75 <= t < 4.05
        place_fly(D['fly1'], fp, 3.6 if not landed else 2.9, t, flap=not landed)
        # left/right eye: one stares at the camera, the other follows the fly — then both cross onto the nose
        cam_pos = V((0.95, -0.95, 0.32))
        e0, e1 = D['eyes']
        a0 = eye_target_angles(e0, fp if t > 0.7 else cam_pos)
        a1 = eye_target_angles(e1, fp if t > 1.6 else cam_pos)
        o['eyes'] = [a0, a1]
        o['jaw'] = 0.35 * win(t, 3.65, 4.4, 0.12)  # "Dili!" — a peek of the tongue
        pose_chameleon(t, o, env)
        if 3.7 < t < 4.4:
            tongue_L = 0.03 * win(t, 3.7, 4.4, 0.1)
        set_tongue(tongue_L, V((1, -0.3, -0.1)))
        c = spline([(0, 1.7, -1.1, 0.5, 0.12, 0.0, 0.22), (2.2, 1.08, -0.5, 0.32, 0.3, 0.0, 0.24), (4.5, 0.98, -0.42, 0.3, 0.33, 0.0, 0.235)])(t)
        look_at(cam, c[:3], c[3:])
        cam.data.dof.aperture_fstop = 2.0
        info['shot'] = 1
        return info

    # ---------- S2 4.5–12: side view, slow-motion tongue extension to 2× body length, compared with a body ruler
    if t < 12.0:
        o['headYaw'] = 0.0
        o['headPitch'] = 0.55 * ss(4.6, 5.0, t) * (1 - ss(11.4, 11.9, t))  # head up toward the diagonal
        o['jaw'] = ss(4.6, 4.95, t) * (1 - ss(11.4, 11.9, t))
        o['eyes'] = [(0.55, 0.0), (0.55, 0.0)]
        pose_chameleon(t, o, env)
        ext = ease(clamp((t - 5.0) / 3.6))  # slow motion
        ret = ss(10.9, 11.8, t)
        BODY = 0.6
        tongue_L = 2.0 * BODY * ext * (1 - ret)
        TD = V((math.cos(0.85), 0, math.sin(0.85)))
        tip = set_tongue(tongue_L, TD, wobble=0.3 * ext * (1 - ext), t=t)
        D['tongue_tip_world'] = tip
        k = ss(5.0, 8.6, t) * (1 - 0.6 * ret)
        cx, cz = lerp(0.05, 0.42, k), lerp(0.26, 0.62, k)
        dist = lerp(1.25, 2.35, k)
        look_at(cam, (cx, -dist, cz + 0.05), (cx, 0.0, cz))
        cam.data.dof.aperture_fstop = 8.0
        info['shot'] = 2
        m0 = mouth_world()
        info['ruler'] = {'body0': (-0.36, 0.0, 0.06), 'body1': (0.43, 0.0, 0.06), 'mouth': tuple(m0), 'one': tuple(m0 + TD * BODY), 'two': tuple(m0 + TD * 2 * BODY),
                         'tip': tuple(tip), 'k': win(t, 5.6, 11.2, 0.3), 'L': tongue_L / BODY}
        return info

    # ---------- S3 12–22: curious close-up → x-ray of the throat: muscle loads the elastic sheaths → release → launch
    if t < 22.0:
        load = ss(14.3, 16.6, t)
        rel = ss(17.6, 17.9, t)
        xr = ss(13.6, 14.2, t) * (1 - ss(20.6, 21.2, t))
        o['xray'] = xr
        o['headYaw'] = 0.0 if t > 13.6 else 0.25 * math.sin(t * 2)
        o['headPitch'] = 0.06
        o['jaw'] = 0.55 * ss(17.4, 17.6, t) * (1 - ss(21.2, 21.8, t))
        o['eyes'] = [(0.5, 0.05), (0.5, 0.05)]
        o['squint'] = 0.25 * load * (1 - rel)
        pose_chameleon(t, o, env)
        # apparatus pose (head-pivot space): muscle wraps sheaths around the rod; on release they shoot forward
        shoot = clamp((t - 17.6) / 0.35)
        fly_out = 0.35 * shoot ** 0.6
        rod0, rod1 = V((0.03, 0, -0.035)), V((0.2, 0, -0.025))
        mus_r = lerp(0.024, 0.018, load) * (1 - 0.3 * rel)
        mus_len = lerp(0.06, 0.08, load)  # the accelerator muscle squeezes and lengthens
        c0 = rod0 + V((0.02, 0, 0))
        set_curve(D['muscle'], [c0 + V((0.035 + fly_out, 0, 0.002)), c0 + V((0.035 + mus_len + fly_out, 0, 0.004))])
        D['muscle'].data.bevel_depth = mus_r
        for k, s in enumerate(D['sheaths']):
            stretch = 1.0 + 0.25 * load * (1 - rel)
            a = c0 + V((0.005 * k, 0, 0))
            b = a + V((0.13 * stretch - 0.01 * k, 0, 0.003))
            set_curve(s, [a + V((fly_out, 0, 0)), b + V((fly_out, 0, 0))])
        D['mat_sheath'].node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = 1.0 + 9.0 * load * (1 - rel)
        info['energy'] = load * (1 - rel)
        # the real tongue launches after release
        L = 1.1 * ss(17.7, 18.4, t) * (1 - ss(20.8, 21.7, t))
        tip = set_tongue(L, V((1, 0, 0.0)), wobble=0.5 * win(t, 18.2, 19.4, 0.3), t=t)
        hp = D['head'].matrix_world
        info['labels'] = {
            'rod': tuple(hp @ V((0.12, 0, -0.03))), 'sheath': tuple(hp @ V((0.09, 0, -0.022))), 'muscle': tuple(hp @ V((0.06, 0, -0.012))),
        }
        info['label_k'] = xr * (1 - rel)
        if t < 13.6:
            c = spline([(12.0, 0.95, -0.5, 0.32, 0.32, 0.0, 0.24), (13.6, 0.75, -0.42, 0.3, 0.32, 0.0, 0.23)])(t)
            look_at(cam, c[:3], c[3:])
            cam.data.dof.aperture_fstop = 2.2
        elif t < 17.7:
            c = spline([(13.6, 0.75, -0.42, 0.3, 0.32, 0.0, 0.23), (14.6, 0.3, -0.5, 0.13, 0.3, 0.0, 0.165), (17.7, 0.32, -0.46, 0.13, 0.31, 0.0, 0.165)])(t)
            look_at(cam, c[:3], c[3:])
            cam.data.dof.aperture_fstop = 4.0
        else:
            # follow the tongue tip out like a whip-pan
            k = ss(17.7, 18.6, t)
            tx = lerp(0.35, tip.x, k)
            c = spline([(17.7, 0.4, -0.33, 0.19), (18.6, tip.x - 0.1, -0.55, 0.22), (21.0, 0.9, -1.3, 0.3), (22, 0.7, -1.2, 0.3)])(t)
            look_at(cam, c, (tx, 0, 0.19))
            cam.data.dof.aperture_fstop = 3.5
        info['shot'] = 3
        return info

    # ---------- S4 22–29: a fly hovers; aim; strike (real speed), slow-motion sticky catch, reel in, gulp, happy blink
    if t < 29.0:
        fly_pos = V((1.15 + 0.03 * math.sin(t * 5), 0.0 + 0.02 * math.sin(t * 7), 0.33 + 0.03 * math.sin(t * 6)))
        strike = 23.4
        # time remap: real-speed strike, then slow-motion around the hit
        if t < strike:
            L = 0.0
        elif t < strike + 0.12:
            L = (t - strike) / 0.12 * 0.95
        else:
            L = 0.95
        hold = ss(strike + 0.12, strike + 0.13, t)
        reel = ss(25.6, 27.4, t)
        L *= (1 - reel)
        o['eyes'] = [(0.75, 0.15), (0.75, 0.15)] if t > 22.6 else [(0.3, 0.3), (0.1, 0.1)]
        o['lean'] = -0.05 * ss(22.6, 23.2, t) * (1 - ss(strike, strike + 0.2, t))
        o['jaw'] = 0.6 * ss(strike - 0.05, strike, t) * (1 - ss(27.4, 27.7, t)) + 0.15 * win(t, 27.8, 28.3, 0.1)
        o['squint'] = 0.8 * win(t, 28.0, 29.0, 0.2)  # satisfied
        o['blink'] = max(o['blink'], math.exp(-((t - 28.4) / 0.08) ** 2))
        pose_chameleon(t, o, env)
        d = (fly_pos - mouth_world())
        tip = set_tongue(L * d.length / 0.95, d, tip_open=hold * (1 - reel), wobble=0.4 * win(t, strike + 0.1, strike + 1.2, 0.2), t=t)
        caught = t >= strike + 0.12
        if caught:
            fp = tip + d.normalized() * 0.02
            if t > 27.5:
                place_fly(D['fly1'], V((0, 0, -5)), 0, t, visible=False)
            else:
                place_fly(D['fly1'], fp, 3.1, t, flap=False)
        else:
            place_fly(D['fly1'], fly_pos, 3.2, t)
        if t < strike + 0.15:
            c = spline([(22.0, 0.55, -1.15, 0.38, 0.72, 0.0, 0.28), (strike, 0.6, -1.05, 0.36, 0.75, 0.0, 0.28)])(t)
            look_at(cam, c[:3], c[3:])
        elif t < 25.6:  # slow-motion close-up on the sticky tip
            k = ss(strike + 0.15, strike + 0.8, t)
            look_at(cam, (tip.x - 0.12, -0.36 + 0.1 * k, tip.z + 0.06), tip)
        else:
            c = spline([(25.6, 0.9, -0.55, 0.3, 0.75, 0.0, 0.27), (27.6, 0.62, -0.62, 0.3, 0.33, 0.0, 0.23), (29, 0.6, -0.6, 0.3, 0.33, 0.0, 0.24)])(t)
            look_at(cam, c[:3], c[3:])
        cam.data.dof.aperture_fstop = 2.8
        info['shot'] = 4
        info['sticky'] = win(t, 23.6, 25.5, 0.2)
        info['fast'] = win(t, 26.0, 28.7, 0.25)
        info['tip'] = tuple(tip)
        return info

    # ---------- S5 29–38: proud look; a fly sneaks up from behind; the rear eye swivels; miss — tongue sticks to a leaf
    leafp = V((0.57, 0.44, 0.5))
    fp = spline([(29.0, -1.5, 0.5, 0.8), (31.0, -0.6, 0.35, 0.62), (32.4, 0.4, 0.42, 0.52), (32.95, 0.56, 0.42, 0.53), (33.2, 0.62, 0.3, 0.85), (35.0, 1.4, -0.2, 1.6)])(t)
    place_fly(D['fly2'], V(fp), 2.5, t)
    fire = 32.95
    back = ss(31.9, 32.4, t)
    o['headYaw'] = -0.25 * (1 - back) + 0.6 * back * (1 - ss(34.0, 34.6, t)) - 0.3 * ss(34.0, 34.6, t)
    o['headPitch'] = 0.25 * back * (1 - ss(34.0, 34.6, t))
    o['talk'] = 1.0 if (29.3 < t < 31.7 or 32.3 < t < 35.0) and not (fire - 0.1 < t < 34.0) else 0.0
    o['jaw'] = 0.6 * ss(fire - 0.05, fire, t) * (1 - ss(34.2, 34.5, t))
    e0, e1 = D['eyes']
    cam_pos = V((0.9, -0.95, 0.3))
    o['eyes'] = [eye_target_angles(e0, cam_pos), eye_target_angles(e1, V(fp) if 31.4 < t < 33.2 else cam_pos)]
    o['squint'] = 0.4 * win(t, 29.4, 31.2, 0.3)
    surprised = ss(34.4, 34.7, t)
    pose_chameleon(t, o, env)
    if 34.4 < t:
        for e in D['eyes']:
            e['rot'].scale = (1, 1 + 0.15 * surprised, 1 + 0.15 * surprised)
    else:
        for e in D['eyes']:
            e['rot'].scale = (1, 1, 1)
    # the strike goes behind towards the fly, which dodges; the tongue sticks to the leaf and stretches
    m = mouth_world()
    shot = clamp((t - fire) / 0.1)
    stuck = t > fire + 0.1
    target = leafp
    d = target - m
    L = d.length * shot
    pull = 0.08 * win(t, 33.4, 35.6, 0.3) * (0.6 + 0.4 * math.sin(t * 12))
    if t > 35.8:
        L = d.length * (1 - ss(35.8, 36.1, t))
    tip = set_tongue(L, d, tip_open=0.6 if stuck else 0, bend=-0.3 if stuck else 0, wobble=0.6 * win(t, fire + 0.1, fire + 1.0, 0.2), t=t)
    D['target_leaf'].location = leafp + V((0.01, 0, 0)) - d.normalized() * pull + V((0, 0, 0.03))
    if t < 31.6:
        c = spline([(29.0, 0.95, -0.8, 0.32, 0.3, 0.0, 0.23), (31.6, 0.85, -0.75, 0.32, 0.28, 0.0, 0.24)])(t)
    elif t < 34.2:
        c = spline([(31.6, 0.85, -0.75, 0.32, 0.28, 0.0, 0.24), (32.6, 0.35, -1.25, 0.5, 0.25, 0.2, 0.35), (34.2, 0.3, -1.35, 0.5, 0.25, 0.2, 0.36)])(t)
    else:
        c = spline([(34.2, 0.75, -0.7, 0.3, 0.3, 0.0, 0.24), (38, 0.6, -0.55, 0.27, 0.3, 0.0, 0.24)])(t)
    look_at(cam, c[:3], c[3:])
    cam.data.dof.aperture_fstop = 2.6
    info['shot'] = 5
    return info
