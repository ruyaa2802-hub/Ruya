"""Bedroom set shared by every bedroom episode.

A lived-in, colourful room on a two-wall corner (the open sides let soft sky
light in, which keeps Cycles noise low): morning sun through the window,
confetti bedding, fairy lights on the headboard, poster, pin board, shelf
with books and a rubber duck, a big plant, kilim rug and slippers.
"""
import math

import bpy
from mathutils import Vector

from .. import materials as M
from ..util import add_subsurf, collection, link, mesh_object

MATTRESS_TOP = 0.55
BED_X, BED_Y = 0.78, 1.02          # half sizes
HEADBOARD_Y = 1.04
NIGHTSTAND = (BED_X + 0.36, 0.78, 0.55)     # centre x, y and top height
PLANT = (-1.38, 1.22)


def box(name, size, loc, mat, col, bevel=0.0, segs=2, subsurf=False):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    # explicit: in Blender 5.x the defaults would also bake the location, leaving
    # every prop's origin at the world origin
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    for c in obj.users_collection:
        c.objects.unlink(obj)
    link(obj, col)
    obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new("Bevel", "BEVEL")
        mod.width = bevel
        mod.segments = segs
        mod.limit_method = "NONE"
    if subsurf:
        add_subsurf(obj, 1, 2)
    if bevel or subsurf:
        obj.data.shade_smooth()
    return obj


def cylinder(name, r, h, loc, mat, col, verts=40, bevel=0.0):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, vertices=verts, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    for c in obj.users_collection:
        c.objects.unlink(obj)
    link(obj, col)
    obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new("Bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 3
        mod.limit_method = "ANGLE"
        obj.data.shade_smooth()
    return obj


def _lathe(name, profile, mat, col, loc, segs=48):
    """Revolve (radius, z) profile around Z."""
    verts, faces = [], []
    for r, z in profile:
        for j in range(segs):
            a = 2 * math.pi * j / segs
            verts.append((r * math.cos(a), r * math.sin(a), z))
    n = len(profile)
    for i in range(n - 1):
        for j in range(segs):
            a, b = i * segs + j, i * segs + (j + 1) % segs
            faces.append((a, b, b + segs, a + segs))
    obj = mesh_object(name, verts, faces, col=col)
    obj.location = loc
    obj.data.materials.append(mat)
    add_subsurf(obj, 1, 2)
    return obj


def _sphere_mesh(rings=6, segs=10):
    verts, faces = [(0, 0, 1)], []
    for i in range(1, rings):
        a = math.pi * i / rings
        for j in range(segs):
            b = 2 * math.pi * j / segs
            verts.append((math.sin(a) * math.cos(b), math.sin(a) * math.sin(b), math.cos(a)))
    verts.append((0, 0, -1))
    last = len(verts) - 1
    for j in range(segs):
        faces.append((0, 1 + j, 1 + (j + 1) % segs))
        base = 1 + (rings - 2) * segs
        faces.append((base + j, last, base + (j + 1) % segs))
    for i in range(rings - 2):
        for j in range(segs):
            a, b = 1 + i * segs + j, 1 + i * segs + (j + 1) % segs
            faces.append((a, a + segs, b + segs, b))
    return verts, faces


def _blobs(name, items, mat, col, rings=6, segs=10, subsurf=0):
    """Many scaled spheres merged into one mesh: items = [(center, (sx, sy, sz))]."""
    sv, sf = _sphere_mesh(rings, segs)
    verts, faces = [], []
    for c, sc in items:
        o = len(verts)
        verts += [(c[0] + v[0] * sc[0], c[1] + v[1] * sc[1], c[2] + v[2] * sc[2]) for v in sv]
        faces += [tuple(i + o for i in f) for f in sf]
    obj = mesh_object(name, verts, faces, col=col)
    obj.data.materials.append(mat)
    if subsurf:
        add_subsurf(obj, subsurf, subsurf)
    return obj


def _leaf(length, width, bend):
    """One broad leaf (grid), base at origin, pointing +Y, drooping by `bend`."""
    verts, faces = [], []
    nl, nw = 9, 5
    for i in range(nl):
        t = i / (nl - 1)
        w = width * math.sin(math.pi * min(t * 1.05, 1.0)) ** 0.7
        for j in range(nw):
            u = j / (nw - 1) * 2 - 1
            verts.append((u * w, t * length, -bend * t * t * length + 0.15 * w * (1 - abs(u))))
    for i in range(nl - 1):
        for j in range(nw - 1):
            a = i * nw + j
            faces.append((a, a + 1, a + nw + 1, a + nw))
    return verts, faces


def build(exclude=()):
    """exclude: names of props to leave out (e.g. "mug" when the mug is a character)."""
    col = collection("Set")
    floor_m = M.wood("floor_oak", light=(0.66, 0.45, 0.26), dark=(0.38, 0.21, 0.1), roughness=0.4,
                     planks=True, scale=1.2, coat=0.35)
    wall_m = M.paint("wall_sunny", (0.97, 0.66, 0.16))             # warm sunflower yellow
    wall2_m = M.paint("wall_mint", (0.32, 0.74, 0.66))             # mint window wall
    trim_m = M.paint("trim_white", (0.93, 0.92, 0.89), roughness=0.45, texture=0.01)
    bedwood = M.wood("bed_walnut", light=(0.45, 0.26, 0.14), dark=(0.22, 0.11, 0.05), roughness=0.35)
    sheet = M.fabric("sheet_confetti", (0.96, 0.94, 0.88), pattern="confetti", sheen=0.4, wrinkle=0.06, bump=0.3,
                     mapping="object")
    stand_m = M.wood("stand_ash", light=(0.78, 0.62, 0.42), dark=(0.52, 0.37, 0.22), roughness=0.4)

    # ---------------------------------------------------------------- room shell
    box("floor", (6, 6, 0.02), (0, 0, -0.01), floor_m, col)
    box("wall_back", (6, 0.1, 3.2), (0, 1.6, 1.6), wall_m, col)
    box("baseboard_back", (6, 0.02, 0.1), (0, 1.545, 0.05), trim_m, col)
    wx = -1.75     # left wall with a window: y in [-0.6, 0.6], z in [0.9, 2.2]
    box("wall_left_a", (0.1, 2.4, 3.2), (wx, -1.8, 1.6), wall2_m, col)
    box("wall_left_b", (0.1, 1.0, 3.2), (wx, 1.1, 1.6), wall2_m, col)
    box("wall_left_low", (0.1, 1.2, 0.9), (wx, 0.0, 0.45), wall2_m, col)
    box("wall_left_high", (0.1, 1.2, 1.0), (wx, 0.0, 2.7), wall2_m, col)
    box("baseboard_left", (0.02, 6, 0.1), (wx + 0.055, 0, 0.05), trim_m, col)
    box("sill", (0.22, 1.3, 0.04), (wx + 0.05, 0.0, 0.9), trim_m, col, bevel=0.008)
    box("mullion", (0.05, 0.04, 1.3), (wx, 0.0, 1.55), trim_m, col)
    box("transom", (0.05, 1.2, 0.04), (wx, 0.0, 1.75), trim_m, col)
    curtain = M.fabric("curtain_stripes", (0.98, 0.95, 0.88), pattern="stripes", accent=(0.95, 0.45, 0.25),
                       sheen=0.6, wrinkle=0.0)
    for side in (-1, 1):
        verts, faces = [], []
        nz, ny = 12, 16
        for i in range(nz):
            z = 0.75 + 1.6 * i / (nz - 1)
            for j in range(ny):
                y = side * (0.62 + 0.28 * j / (ny - 1))
                x = wx + 0.12 + 0.025 * math.sin(j * 1.9)
                verts.append((x, y, z))
        for i in range(nz - 1):
            for j in range(ny - 1):
                a = i * ny + j
                faces.append((a, a + 1, a + ny + 1, a + ny))
        cur = mesh_object(f"curtain_{side}", verts, faces, uvs=[(v[1], v[2]) for v in verts], col=col)
        cur.data.materials.append(curtain)
        cur.modifiers.new("Solidify", "SOLIDIFY").thickness = 0.01
        add_subsurf(cur, 1, 1)
    plastic_w = M.plastic("switch_white", (0.92, 0.92, 0.9), 0.3)
    box("switch", (0.08, 0.012, 0.08), (1.25, 1.548, 1.1), plastic_w, col, bevel=0.006)
    box("socket", (0.08, 0.012, 0.08), (1.42, 1.548, 0.3), plastic_w, col, bevel=0.006)

    # ---------------------------------------------------------------- bed
    box("bed_frame", (BED_X * 2 + 0.08, BED_Y * 2 + 0.06, 0.2), (0, 0, 0.24), bedwood, col, bevel=0.015)
    for x in (-BED_X, BED_X):
        for y in (-BED_Y, BED_Y):
            box("bed_leg", (0.07, 0.07, 0.16), (x, y, 0.08), bedwood, col, bevel=0.01)
    box("mattress", (BED_X * 2, BED_Y * 2 - 0.04, 0.22), (0, -0.01, MATTRESS_TOP - 0.11), sheet, col,
        bevel=0.05, segs=4)
    box("headboard", (BED_X * 2 + 0.16, 0.07, 1.15), (0, HEADBOARD_Y + 0.04, 0.6), bedwood, col,
        bevel=0.025, segs=3)
    box("headboard_cap", (BED_X * 2 + 0.22, 0.11, 0.06), (0, HEADBOARD_Y + 0.04, 1.2), bedwood, col,
        bevel=0.02, segs=3)
    verts, faces = [], []                                   # rumpled sheet where the blanket used to be
    nx, ny = 18, 14
    for i in range(ny):
        for j in range(nx):
            u, v = j / (nx - 1), i / (ny - 1)
            x = -BED_X + 0.1 + u * (BED_X * 2 - 0.15)
            y = -BED_Y + 0.05 + v * 1.25
            z = MATTRESS_TOP + 0.012 + 0.018 * math.sin(u * 9.0 + v * 4) * math.sin(v * 6.5 + 1) * (1 - v) \
                + 0.025 * math.exp(-((u - 0.7) ** 2 + (v - 0.3) ** 2) / 0.02)
            verts.append((x, y, z))
    for i in range(ny - 1):
        for j in range(nx - 1):
            a = i * nx + j
            faces.append((a, a + 1, a + nx + 1, a + nx))
    rumple = mesh_object("sheet_rumple", verts, faces, uvs=[(v[0], v[1]) for v in verts], col=col)
    rumple.data.materials.append(sheet)
    add_subsurf(rumple, 1, 2)

    # fairy lights draped over the headboard: warm bokeh behind the pillow
    hooks = [(-0.95, 1.25), (-0.35, 1.25), (0.25, 1.25), (0.9, 1.25)]
    pts = []
    for (x0, z0), (x1, z1) in zip(hooks[:-1], hooks[1:]):
        for k in range(10):
            t = k / 10
            pts.append((x0 + (x1 - x0) * t, HEADBOARD_Y - 0.015, z0 - 0.11 * math.sin(math.pi * t)))
    pts.append((hooks[-1][0], HEADBOARD_Y - 0.015, hooks[-1][1]))
    wire = bpy.data.curves.new("fairy_wire", "CURVE")
    wire.dimensions = "3D"
    wire.bevel_depth = 0.0018
    sp = wire.splines.new("POLY")
    sp.points.add(len(pts) - 1)
    for p_, c in zip(sp.points, pts):
        p_.co = (c[0], c[1], c[2], 1.0)
    wobj = bpy.data.objects.new("fairy_wire", wire)
    link(wobj, col)
    wire.materials.append(M.plastic("wire_green", (0.05, 0.12, 0.05), 0.5))
    bulbs = [((c[0], c[1] - 0.006, c[2] - 0.012), (0.011, 0.011, 0.014)) for c in pts[1:-1:2]]
    _blobs("fairy_bulbs", bulbs, M.emission("bulb_warm", (1.0, 0.72, 0.38), 18.0), col)

    # ---------------------------------------------------------------- floor dressing
    box("kilim", (1.7, 1.15, 0.012), (1.25, -0.4, 0.006), M.kilim(), col, bevel=0.003)
    slipper_m = M.fabric("slipper_pink", (0.95, 0.5, 0.62), sheen=1.0, wrinkle=0.0)
    for k, (sx, sy, rz) in enumerate(((-0.55, -1.28, 0.25), (-0.36, -1.33, -0.1))):
        sl = _blobs(f"slipper_{k}", [((0, 0, 0.025), (0.055, 0.13, 0.028)), ((0, 0.04, 0.05), (0.05, 0.07, 0.025))],
                    slipper_m, col, rings=8, segs=12, subsurf=1)
        sl.location = (sx, sy, 0)
        sl.rotation_euler = (0, 0, rz)
    # big leafy plant in the window corner
    pot_m = M.ceramic("pot_terracotta", (0.78, 0.38, 0.22), roughness=0.5)
    _lathe("plant_pot", [(0.0, 0.0), (0.15, 0.0), (0.18, 0.36), (0.2, 0.37), (0.2, 0.4), (0.18, 0.4),
                         (0.17, 0.34), (0.0, 0.34)], pot_m, col, (*PLANT, 0.0))
    leaf_m = M.plastic("leaf_green", (0.12, 0.42, 0.14), 0.45)
    # one object per leaf, origin at its base, so episodes can make the plant move
    px, py = PLANT
    for k in range(9):
        a = 2 * math.pi * k / 9 + 0.3
        lv, lf = _leaf(0.38 + 0.08 * math.sin(k * 2.1), 0.13, 0.5 + 0.2 * math.sin(k))
        tilt = 0.9 - 0.25 * (k % 3)
        verts = []
        for x, y, z in lv:
            # pitch the leaf up by `tilt`, then yaw around the pot
            y2, z2 = y * math.cos(tilt) - z * math.sin(tilt), y * math.sin(tilt) + z * math.cos(tilt)
            verts.append((x * math.cos(a) - y2 * math.sin(a), x * math.sin(a) + y2 * math.cos(a), z2))
        leaf = mesh_object(f"plant_leaf_{k}", verts, lf, col=col)
        leaf.location = (px, py, 0.42 + 0.12 * (k % 3))
        leaf.data.materials.append(leaf_m)
        leaf.modifiers.new("Solidify", "SOLIDIFY").thickness = 0.004
        add_subsurf(leaf, 1, 1)

    # ---------------------------------------------------------------- nightstand + props
    nx_, ny_ = NIGHTSTAND[:2]
    box("nightstand", (0.48, 0.42, 0.55), (nx_, ny_, 0.275), stand_m, col, bevel=0.012)
    box("drawer_line", (0.44, 0.005, 0.004), (nx_, ny_ - 0.212, 0.36), M.plastic("gap", (0.05, 0.04, 0.03)), col)
    knob = cylinder("knob", 0.016, 0.03, (nx_, ny_ - 0.225, 0.43), M.metal("brass", (0.85, 0.65, 0.35), 0.25),
                    col, verts=16, bevel=0.005)
    knob.rotation_euler = (math.pi / 2, 0, 0)
    _lathe("lamp_base", [(0.0, 0.0), (0.07, 0.0), (0.08, 0.04), (0.065, 0.12), (0.03, 0.2), (0.012, 0.24),
                         (0.012, 0.3), (0.0, 0.3)], M.ceramic("lamp_ceramic", (0.15, 0.55, 0.62)), col,
           (nx_ + 0.1, ny_ + 0.06, 0.55))
    shade = _lathe("lamp_shade", [(0.13, 0.0), (0.12, 0.04), (0.108, 0.08), (0.096, 0.12), (0.085, 0.16)],
                   M.lampshade("shade", (0.98, 0.9, 0.72)), col, (nx_ + 0.1, ny_ + 0.06, 0.78))
    shade.modifiers.new("Solidify", "SOLIDIFY").thickness = 0.004
    if "mug" not in exclude:
        mug_m = M.ceramic("mug_ceramic", (0.92, 0.4, 0.22))
        _lathe("mug", [(0.0, 0.002), (0.038, 0.0), (0.042, 0.01), (0.043, 0.095), (0.039, 0.098),
                       (0.036, 0.09), (0.035, 0.02), (0.0, 0.02)], mug_m, col, (nx_ - 0.1, ny_ - 0.06, 0.55))
        bpy.ops.mesh.primitive_torus_add(major_radius=0.026, minor_radius=0.007,
                                         location=(nx_ - 0.1 + 0.045, ny_ - 0.06, 0.6),
                                         rotation=(math.pi / 2, 0, 0))
        handle = bpy.context.active_object
        handle.name = "mug_handle"
        for c in handle.users_collection:
            c.objects.unlink(handle)
        link(handle, col)
        handle.data.materials.append(mug_m)
        handle.data.shade_smooth()
        cylinder("coffee", 0.034, 0.002, (nx_ - 0.1, ny_ - 0.06, 0.62),
                 M.plastic("coffee", (0.08, 0.04, 0.02), 0.08), col, verts=32)
    clock = box("clock", (0.11, 0.06, 0.08), (nx_ + 0.12, ny_ - 0.13, 0.59), M.plastic("clock", (0.98, 0.42, 0.5)),
                col, bevel=0.02, segs=3)
    clock.rotation_euler = (0, 0, math.radians(-25))
    digits = box("clock_face", (0.07, 0.004, 0.03), (0, 0, 0), M.emission("clock_digits", (1.0, 0.3, 0.2), 3.0), col)
    digits.parent = clock
    digits.location = (0, -0.031, 0.002)

    # ---------------------------------------------------------------- wall: poster, pin board, shelf
    frame_wood = M.wood("frame_wood", (0.15, 0.1, 0.07), (0.08, 0.05, 0.03))
    box("poster_frame", (0.56, 0.03, 0.76), (-0.12, 1.54, 1.83), frame_wood, col, bevel=0.008)
    box("poster", (0.5, 0.01, 0.7), (-0.12, 1.522, 1.83), M.poster_sunset(), col)
    box("pinboard", (0.5, 0.025, 0.36), (-1.15, 1.54, 1.45), M.paint("cork", (0.72, 0.52, 0.32), 0.9, 0.3), col,
        bevel=0.006)
    notes = [((-1.32, 1.49), (0.11, 0.13), (0.95, 0.9, 0.4), 0.08), ((-1.17, 1.55), (0.12, 0.09), (0.55, 0.8, 0.95), -0.1),
             ((-1.02, 1.47), (0.1, 0.12), (0.95, 0.55, 0.6), 0.12), ((-1.08, 1.36), (0.13, 0.09), (0.98, 0.98, 0.95), -0.05),
             ((-1.27, 1.36), (0.1, 0.1), (0.6, 0.9, 0.6), 0.04)]
    for k, ((x, z), (w, h), c, r) in enumerate(notes):
        n = box(f"note_{k}", (w, 0.003, h), (x, 1.524, z), M.plastic(f"note_{k}", c, 0.7), col)
        n.rotation_euler = (0, r, 0)
    box("shelf", (0.7, 0.18, 0.025), (1.3, 1.46, 1.32), stand_m, col, bevel=0.004)
    book_cols = [(0.85, 0.2, 0.25), (0.2, 0.45, 0.85), (0.98, 0.75, 0.2), (0.25, 0.65, 0.4), (0.55, 0.3, 0.75),
                 (0.95, 0.5, 0.2), (0.15, 0.2, 0.4)]
    x = 1.0
    for k, c in enumerate(book_cols):
        h, w = 0.17 + 0.05 * math.sin(k * 2.3), 0.025 + 0.012 * (k % 3)
        b = box(f"book_{k}", (w, 0.13, h), (x + w / 2, 1.46, 1.333 + h / 2), M.plastic(f"book_{k}", c, 0.6), col,
                bevel=0.003)
        if k == len(book_cols) - 1:
            b.rotation_euler = (0, 0.35, 0)
            b.location.x += 0.03
        x += w + 0.004
    duck_m = M.plastic("duck_yellow", (1.0, 0.82, 0.1), 0.2)
    _blobs("duck", [((1.52, 1.44, 1.38), (0.045, 0.035, 0.035)), ((1.5, 1.42, 1.43), (0.025, 0.025, 0.025))],
           duck_m, col, rings=10, segs=16, subsurf=1)
    _blobs("duck_beak", [((1.475, 1.4, 1.428), (0.016, 0.01, 0.006))], M.plastic("beak", (1.0, 0.45, 0.1), 0.3), col)
    _blobs("duck_eyes", [((1.488, 1.402, 1.44), (0.004, 0.004, 0.004)), ((1.508, 1.399, 1.44), (0.004, 0.004, 0.004))],
           M.plastic("duck_eye", (0.02, 0.02, 0.02), 0.2), col)
    return col


def lighting(sun_strength=4.0):
    scene = bpy.context.scene
    world = bpy.data.worlds.new("World")
    scene.world = world
    nt = world.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    sky = nt.nodes.new("ShaderNodeTexSky")
    sky.sky_type = "MULTIPLE_SCATTERING"
    sky.sun_elevation = math.radians(28)
    sky.sun_rotation = math.radians(200)
    sky.sun_disc = False
    bg.inputs["Strength"].default_value = 0.045
    nt.links.new(sky.outputs[0], bg.inputs[0])
    nt.links.new(bg.outputs[0], out.inputs[0])

    sun = bpy.data.lights.new("Sun", "SUN")
    sun.energy = sun_strength
    sun.color = (1.0, 0.86, 0.68)
    sun.angle = math.radians(2.0)
    so = bpy.data.objects.new("Sun", sun)
    link(so)
    # light enters through the left window and lands as a warm patch on the bed
    so.rotation_euler = Vector((0.8, 0.22, -0.56)).to_track_quat("-Z", "Y").to_euler()

    def area(name, energy, size, loc, target, color=(1, 1, 1), shape="RECTANGLE", size_y=None):
        light = bpy.data.lights.new(name, "AREA")
        light.energy = energy
        light.size = size
        light.shape = shape
        if size_y:
            light.size_y = size_y
        light.color = color
        obj = bpy.data.objects.new(name, light)
        link(obj)
        obj.location = loc
        d = Vector(target) - Vector(loc)
        obj.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
        return obj

    area("Fill", 55, 2.5, (2.4, -3.0, 1.6), (0.4, 0.2, 0.6), color=(0.8, 0.88, 1.0))
    area("Rim", 60, 1.2, (-1.0, 1.4, 2.2), (0.5, -0.2, 0.5), color=(1.0, 0.85, 0.7))
    area("Window", 90, 1.2, (-1.85, 0.0, 1.5), (0.0, 0.0, 0.6), color=(0.9, 0.95, 1.0), size_y=1.3)
