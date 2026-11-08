"""Warm living room for memories: a big soft sofa, a little TV, a floor lamp, a rug and
golden evening light. Built away from the other sets (at ORIGIN).

Local layout (meters): back wall at y = 1.3; the sofa's seat top is SEAT_Z high, seat front
at y = SEAT_FRONT, its middle at x = 0. The TV stands in front of the sofa at TV (facing +y).
"""
import math

import bpy
from mathutils import Vector

from .. import materials as M
from ..util import collection, link
from .bedroom import _blobs, box, cylinder

ORIGIN = Vector((-40.0, 0.0, 0.0))
SEAT_Z = 0.44
SEAT_FRONT = 0.15
TV = (0.0, -1.55)


def P(x, y, z):
    return tuple(ORIGIN + Vector((x, y, z)))


def build():
    col = collection("Salon")
    floor = M.wood("salon_floor", light=(0.6, 0.4, 0.24), dark=(0.36, 0.2, 0.1), roughness=0.4, planks=True,
                   scale=1.2, coat=0.3)
    wall = M.paint("salon_wall", (0.93, 0.72, 0.5))
    trim = M.paint("salon_trim", (0.95, 0.92, 0.86), roughness=0.45, texture=0.01)
    sofa = M.fabric("sofa_velvet", (0.78, 0.38, 0.22), sheen=0.9, wrinkle=0.02, mapping="object")
    cushion = M.fabric("cushion_mustard", (0.92, 0.66, 0.2), sheen=0.6, wrinkle=0.03, mapping="object")
    rug = M.kilim()

    box("salon_floor", (8, 8, 0.02), P(0, 0, -0.01), floor, col)
    box("salon_wall", (8, 0.1, 3.0), P(0, 1.35, 1.5), wall, col)
    box("salon_wall_l", (0.1, 6, 3.0), P(-2.6, -1.0, 1.5), wall, col)
    box("salon_base", (8, 0.02, 0.1), P(0, 1.295, 0.05), trim, col)
    box("salon_rug", (2.4, 1.7, 0.012), P(0, -0.5, 0.006), rug, col, bevel=0.003)

    # sofa: base, seat cushions, back cushions, rolled arms
    box("sofa_base", (2.1, 0.85, 0.28), P(0, 0.58, 0.2), sofa, col, bevel=0.05, segs=3)
    for k, x in enumerate((-0.5, 0.5)):
        box("sofa_seat", (0.98, 0.72, 0.14), P(x, SEAT_FRONT + 0.36, SEAT_Z - 0.07), sofa, col, bevel=0.05, segs=4)
        b = box("sofa_back", (0.98, 0.22, 0.5), P(x, 1.03, SEAT_Z + 0.24), sofa, col, bevel=0.07, segs=4)
        b.rotation_euler = (math.radians(-8), 0, 0)
    for sx in (-1, 1):
        arm = cylinder("sofa_arm", 0.13, 0.85, P(sx * 1.08, 0.58, 0.52), sofa, col, verts=32, bevel=0.03)
        arm.rotation_euler = (math.pi / 2, 0, 0)
        box("sofa_arm_body", (0.2, 0.85, 0.42), P(sx * 1.08, 0.58, 0.3), sofa, col, bevel=0.05, segs=3)
    _blobs("sofa_cushion", [((0, 0, 0), (0.2, 0.08, 0.18))], cushion, col, rings=8, segs=12, subsurf=1)\
        .location = P(-0.85, 0.85, SEAT_Z + 0.2)
    for x in (-0.85, 0.85):
        cylinder("sofa_foot", 0.025, 0.06, P(x, 0.25, 0.03), M.wood("foot_wood"), col)

    # TV on a low stand, facing the sofa
    stand = M.wood("tv_stand", light=(0.55, 0.36, 0.2), dark=(0.32, 0.18, 0.08))
    tx, ty = TV
    box("tv_stand", (1.1, 0.4, 0.42), P(tx, ty, 0.21), stand, col, bevel=0.015)
    box("tv_body", (0.78, 0.06, 0.48), P(tx, ty, 0.42 + 0.3), M.plastic("tv_black", (0.02, 0.02, 0.02), 0.3), col,
        bevel=0.01)
    screen = box("tv_screen", (0.72, 0.01, 0.42), P(tx, ty + 0.032, 0.72), M.emission("tv_screen", (0.55, 0.7, 1.0), 3.0),
                 col)
    screen.visible_shadow = False
    tvl = bpy.data.lights.new("tv_glow", "AREA")
    tvl.energy = 30
    tvl.size = 0.75
    tvl.color = (0.55, 0.7, 1.0)
    tvo = bpy.data.objects.new("tv_glow", tvl)
    link(tvo, col)
    tvo.location = P(tx, ty + 0.08, 0.72)
    tvo.rotation_euler = (Vector((0, 1, 0)).to_track_quat("-Z", "Y")).to_euler()

    # floor lamp, a plant, a framed photo
    lamp_m = M.metal("lamp_brass", (0.8, 0.6, 0.3), 0.3)
    cylinder("flamp_pole", 0.015, 1.5, P(1.55, 1.0, 0.75), lamp_m, col)
    cylinder("flamp_base", 0.14, 0.03, P(1.55, 1.0, 0.015), lamp_m, col)
    shade = cylinder("flamp_shade", 0.2, 0.28, P(1.55, 1.0, 1.55), M.lampshade("flamp_shade", (1.0, 0.85, 0.6)), col)
    shade.visible_shadow = False
    _blobs("flamp_bulb", [((0, 0, 0), (0.05, 0.05, 0.06))], M.emission("flamp_bulb", (1.0, 0.75, 0.45), 40.0),
           col).location = P(1.55, 1.0, 1.5)
    pl = bpy.data.lights.new("flamp_light", "POINT")
    pl.energy = 120
    pl.color = (1.0, 0.72, 0.42)
    pl.shadow_soft_size = 0.2
    plo = bpy.data.objects.new("flamp_light", pl)
    link(plo, col)
    plo.location = P(1.55, 1.0, 1.45)
    box("photo_frame", (0.42, 0.03, 0.32), P(-0.6, 1.29, 1.45), M.wood("frame_wood"), col, bevel=0.01)
    box("photo", (0.36, 0.01, 0.26), P(-0.6, 1.27, 1.45), M.paint("photo_warm", (0.95, 0.75, 0.5), texture=0.02), col)
    pot = cylinder("plant_pot", 0.16, 0.32, P(-1.7, 0.9, 0.16), M.ceramic("pot_cream", (0.92, 0.88, 0.8)), col)
    _blobs("plant_leaves", [((0, 0, 0), (0.32, 0.3, 0.42)), ((0.1, 0.05, 0.3), (0.22, 0.2, 0.25))],
           M.fabric("salon_leaves", (0.12, 0.3, 0.1), sheen=0.3, wrinkle=0.0, mapping="object"), col,
           rings=8, segs=12, subsurf=1).location = P(-1.7, 0.9, 0.62)

    # golden evening sun through a window on the left, warm bounce
    def area(name, energy, size, loc, target, color):
        light = bpy.data.lights.new(name, "AREA")
        light.energy = energy
        light.size = size
        light.color = color
        obj = bpy.data.objects.new(name, light)
        link(obj, col)
        obj.location = P(*loc)
        obj.rotation_euler = (Vector(P(*target)) - Vector(P(*loc))).to_track_quat("-Z", "Y").to_euler()
        return obj

    area("salon_sun", 260, 1.4, (-2.4, -0.4, 1.9), (0.0, 0.5, 0.5), (1.0, 0.68, 0.36))
    area("salon_fill", 70, 3.0, (0.8, -3.0, 1.6), (0.0, 0.5, 0.6), (1.0, 0.82, 0.62))
    area("salon_rim", 60, 1.5, (1.2, 1.2, 2.3), (0.0, 0.5, 0.6), (1.0, 0.75, 0.5))
    return dict(col=col, screen=screen, tv_light=tvo)
