"""Bedroom set shared by every bedroom episode.

Kept deliberately light: a two-wall corner (the open sides let soft sky
light in, which keeps Cycles noise low), a window with morning sun, bed,
nightstand with a few story props, rug and a framed print.
"""
import math

import bpy
from mathutils import Vector

from .. import materials as M
from ..util import add_subsurf, collection, link, mesh_object

MATTRESS_TOP = 0.55
BED_X, BED_Y = 0.78, 1.02          # half sizes
HEADBOARD_Y = 1.04


def box(name, size, loc, mat, col, bevel=0.0, segs=2, subsurf=False):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(scale=True)
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


def build():
    col = collection("Set")
    floor_m = M.wood("floor_oak", light=(0.62, 0.42, 0.25), dark=(0.36, 0.2, 0.1), roughness=0.4,
                     planks=True, scale=1.2, coat=0.35)
    wall_m = M.paint("wall_sage", (0.55, 0.6, 0.52))
    wall2_m = M.paint("wall_cream", (0.8, 0.74, 0.64))
    bedwood = M.wood("bed_walnut", light=(0.42, 0.24, 0.13), dark=(0.2, 0.1, 0.05), roughness=0.35)
    sheet = M.fabric("sheet_linen", (0.86, 0.87, 0.88), sheen=0.4, wrinkle=0.06, bump=0.3, mapping="object")
    rug = M.fabric("rug_wool", (0.07, 0.2, 0.23), sheen=0.9, weave=0.004, bump=0.6, fuzz=0.3, mapping="object")
    stand_m = M.wood("stand_ash", light=(0.75, 0.6, 0.42), dark=(0.5, 0.36, 0.22), roughness=0.4)

    # floor and walls
    box("floor", (6, 6, 0.02), (0, 0, -0.01), floor_m, col)
    box("wall_back", (6, 0.1, 3.2), (0, 1.6, 1.6), wall_m, col)
    # left wall with a window opening (x = -1.75), window spans y in [-0.6, 0.6], z in [0.9, 2.2]
    wx = -1.75
    box("wall_left_a", (0.1, 2.4, 3.2), (wx, -1.8, 1.6), wall2_m, col)
    box("wall_left_b", (0.1, 1.0, 3.2), (wx, 1.1, 1.6), wall2_m, col)
    box("wall_left_low", (0.1, 1.2, 0.9), (wx, 0.0, 0.45), wall2_m, col)
    box("wall_left_high", (0.1, 1.2, 1.0), (wx, 0.0, 2.7), wall2_m, col)
    frame_m = M.paint("window_frame", (0.92, 0.91, 0.88), roughness=0.4, texture=0.02)
    box("sill", (0.22, 1.3, 0.04), (wx + 0.05, 0.0, 0.9), frame_m, col, bevel=0.008)
    box("mullion", (0.05, 0.04, 1.3), (wx, 0.0, 1.55), frame_m, col)
    box("transom", (0.05, 1.2, 0.04), (wx, 0.0, 1.75), frame_m, col)
    curtain = M.fabric("curtain", (0.82, 0.78, 0.7), sheen=0.6, wrinkle=0.0)
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
        mod = cur.modifiers.new("Solidify", "SOLIDIFY")
        mod.thickness = 0.01
        add_subsurf(cur, 1, 1)

    # bed
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
    # a rumpled sheet corner where the blanket used to be
    verts, faces = [], []
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

    # rug under the blanket
    cylinder("rug", 0.75, 0.012, (1.25, -0.35, 0.006), rug, col, verts=64, bevel=0.004)

    # nightstand with props (x = right side of the bed, near the headboard)
    nx_, ny_ = BED_X + 0.36, 0.78
    box("nightstand", (0.48, 0.42, 0.55), (nx_, ny_, 0.275), stand_m, col, bevel=0.012)
    box("drawer_line", (0.44, 0.005, 0.004), (nx_, ny_ - 0.212, 0.36), M.plastic("gap", (0.05, 0.04, 0.03)),
        col)
    knob = cylinder("knob", 0.016, 0.03, (nx_, ny_ - 0.225, 0.43), M.metal("brass", (0.85, 0.65, 0.35), 0.25),
                    col, verts=16, bevel=0.005)
    knob.rotation_euler = (math.pi / 2, 0, 0)
    lamp_base = M.ceramic("lamp_ceramic", (0.2, 0.32, 0.36))
    _lathe("lamp_base", [(0.0, 0.0), (0.07, 0.0), (0.08, 0.04), (0.065, 0.12), (0.03, 0.2), (0.012, 0.24),
                         (0.012, 0.3), (0.0, 0.3)], lamp_base, col, (nx_ + 0.1, ny_ + 0.06, 0.55))
    shade = _lathe("lamp_shade", [(0.13, 0.0), (0.12, 0.04), (0.108, 0.08), (0.096, 0.12), (0.085, 0.16)], M.lampshade("shade", (0.95, 0.88, 0.75)), col,
                   (nx_ + 0.1, ny_ + 0.06, 0.78))
    shade.modifiers.new("Solidify", "SOLIDIFY").thickness = 0.004
    mug_m = M.ceramic("mug_ceramic", (0.85, 0.42, 0.25))
    mug = _lathe("mug", [(0.0, 0.002), (0.038, 0.0), (0.042, 0.01), (0.043, 0.095), (0.039, 0.098),
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
    cylinder("coffee", 0.034, 0.002, (nx_ - 0.1, ny_ - 0.06, 0.62), M.plastic("coffee", (0.08, 0.04, 0.02), 0.08),
             col, verts=32)
    clock = box("clock", (0.11, 0.06, 0.08), (nx_ + 0.12, ny_ - 0.13, 0.59), M.plastic("clock", (0.9, 0.9, 0.86)),
                col, bevel=0.02, segs=3)
    clock.rotation_euler = (0, 0, math.radians(-25))
    face_m = M.emission("clock_digits", (1.0, 0.3, 0.2), 3.0)
    digits = box("clock_face", (0.07, 0.004, 0.03), (0, 0, 0), face_m, col)
    digits.parent = clock
    digits.location = (0, -0.031, 0.002)

    # framed print above the headboard
    box("frame", (0.62, 0.03, 0.46), (0.0, 1.54, 1.75), M.wood("frame_wood", (0.15, 0.1, 0.07), (0.08, 0.05, 0.03)),
        col, bevel=0.008)
    art = M.paint("art", (0.85, 0.6, 0.35), roughness=0.6, texture=0.0)
    box("art", (0.52, 0.01, 0.36), (0.0, 1.52, 1.75), art, col)
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
