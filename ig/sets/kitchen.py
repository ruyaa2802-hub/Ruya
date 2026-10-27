"""Kitchen at 2 a.m.: dark, moonlit, the oven clock glowing green.

Layout (meters): back wall at y = 1.25, window wall at x = -1.8. The fridge
(a character, see ig/characters/buzdolabi.py) stands against the back wall at
FRIDGE; base cabinets run left of it, a counter with the microwave to its right.
The open side of the room (-Y, +X) is where the cameras and the human come from.
"""
import math

import bpy
from mathutils import Vector

from .. import materials as M
from ..audio import FONT
from ..shapes import bevel, box_mesh, text_mesh
from ..util import collection, link
from .bedroom import _blobs, _lathe

FRIDGE = (0.0, 0.88, 0.0)
BACK_Y = 1.25
CLOCK = "02:13"


def _box(name, size, center, mat, col, bev=0.0):
    obj = box_mesh(name, size, center, col)
    obj.data.materials.append(mat)
    if bev:
        bevel(obj, bev, 2)
    return obj


def build(exclude=()):
    col = collection("Set")
    floor_m = M.tiles("floor_checker", (0.82, 0.8, 0.76), (0.06, 0.06, 0.07), size=0.32, grout=(0.3, 0.3, 0.3))
    wall_m = M.paint("wall_teal", (0.17, 0.33, 0.36))
    splash_m = M.tiles("splash_subway", (0.9, 0.9, 0.86), size=0.15, plane="xz", subway=True,
                       grout=(0.62, 0.62, 0.6))
    cab_m = M.paint("cabinet_cream", (0.84, 0.78, 0.64), roughness=0.5, texture=0.02)
    top_m = M.wood("counter_beech", light=(0.72, 0.5, 0.3), dark=(0.48, 0.3, 0.16), roughness=0.35)
    knob_m = M.metal("knob_brass", (0.85, 0.65, 0.35), 0.25)
    dark_m = M.plastic("appliance_black", (0.02, 0.02, 0.025), 0.25)
    steel_m = M.metal("steel", (0.75, 0.76, 0.78), 0.3)

    # ---------------------------------------------------------------- shell
    _box("floor", (7, 7, 0.02), (0, 0, -0.01), floor_m, col)
    _box("wall_back", (7, 0.1, 3.0), (0, BACK_Y + 0.05, 1.5), wall_m, col)
    wx = -1.8                       # window wall: opening y in [-0.7, 0.3], z in [1.05, 2.05]
    _box("wall_left_a", (0.1, 3.0, 3.0), (wx, -2.2, 1.5), wall_m, col)
    _box("wall_left_b", (0.1, 0.95, 3.0), (wx, 0.775, 1.5), wall_m, col)
    _box("wall_left_low", (0.1, 1.0, 1.05), (wx, -0.2, 0.525), wall_m, col)
    _box("wall_left_high", (0.1, 1.0, 0.95), (wx, -0.2, 2.525), wall_m, col)
    frame_m = M.paint("window_frame", (0.85, 0.85, 0.82), roughness=0.45, texture=0.01)
    _box("sill", (0.2, 1.1, 0.04), (wx + 0.06, -0.2, 1.05), frame_m, col, 0.006)
    _box("mullion", (0.05, 0.04, 1.0), (wx, -0.2, 1.55), frame_m, col)
    _box("transom", (0.05, 1.0, 0.04), (wx, -0.2, 1.6), frame_m, col)
    night = M.emission("night_sky", (0.05, 0.08, 0.2), 0.6)
    _box("sky", (0.02, 3.0, 2.0), (wx - 0.6, -0.2, 1.6), night, col)
    moon = M.emission("moon", (0.9, 0.95, 1.0), 6.0)
    _blobs("moon", [((wx - 0.55, 0.05, 1.85), (0.01, 0.07, 0.07))], moon, col, rings=10, segs=16)
    _box("baseboard", (7, 0.02, 0.09), (0, BACK_Y - 0.01, 0.045), M.paint("trim_dark", (0.1, 0.18, 0.2)), col)

    # ---------------------------------------------------------------- left run: base + wall cabinets
    fx = FRIDGE[0]
    l0, l1 = wx + 0.05, fx - 0.4                  # x span of the left run
    lc = (l0 + l1) / 2
    lw = l1 - l0
    _box("kick_left", (lw, 0.55, 0.1), (lc, BACK_Y - 0.33, 0.05), dark_m, col)
    _box("base_left", (lw, 0.58, 0.78), (lc, BACK_Y - 0.31, 0.49), cab_m, col, 0.006)
    _box("top_left", (lw + 0.02, 0.64, 0.04), (lc, BACK_Y - 0.32, 0.9), top_m, col, 0.004)
    _box("splash_left", (lw, 0.01, 0.55), (lc, BACK_Y - 0.005, 1.195), splash_m, col)
    _box("wall_cab_left", (lw, 0.34, 0.7), (lc, BACK_Y - 0.17, 1.85), cab_m, col, 0.006)
    n = 3
    for i in range(n):                            # door seams + knobs
        x = l0 + lw * (i + 0.5) / n
        _box(f"seam_l{i}", (0.004, 0.005, 0.74), (l0 + lw * i / n, BACK_Y - 0.6, 0.49), dark_m, col)
        k = _box(f"knob_l{i}", (0.03, 0.03, 0.03), (x + 0.12, BACK_Y - 0.61, 0.8), knob_m, col, 0.012)
        k = _box(f"knob_lu{i}", (0.03, 0.03, 0.03), (x + 0.12, BACK_Y - 0.35, 1.56), knob_m, col, 0.012)
    _box("drawer_line", (lw, 0.005, 0.004), (lc, BACK_Y - 0.6, 0.72), dark_m, col)

    # ---------------------------------------------------------------- right run: counter + microwave
    r0, r1 = fx + 0.4, fx + 1.9
    rc, rw = (r0 + r1) / 2, r1 - r0
    _box("kick_right", (rw, 0.55, 0.1), (rc, BACK_Y - 0.33, 0.05), dark_m, col)
    _box("base_right", (rw, 0.58, 0.78), (rc, BACK_Y - 0.31, 0.49), cab_m, col, 0.006)
    _box("top_right", (rw + 0.02, 0.64, 0.04), (rc, BACK_Y - 0.32, 0.9), top_m, col, 0.004)
    _box("splash_right", (rw, 0.01, 0.55), (rc, BACK_Y - 0.005, 1.195), splash_m, col)
    _box("wall_cab_right", (rw, 0.34, 0.7), (rc, BACK_Y - 0.17, 1.85), cab_m, col, 0.006)
    _box("seam_r", (0.004, 0.005, 0.74), (rc, BACK_Y - 0.6, 0.49), dark_m, col)
    mx, my = fx + 0.75, BACK_Y - 0.3
    _box("microwave", (0.5, 0.38, 0.29), (mx, my, 1.065), steel_m, col, 0.015)
    _box("microwave_glass", (0.32, 0.01, 0.2), (mx - 0.06, my - 0.19, 1.065), dark_m, col, 0.004)
    _box("microwave_panel", (0.1, 0.01, 0.22), (mx + 0.17, my - 0.19, 1.065), dark_m, col)
    clock = text_mesh("microwave_clock", CLOCK, 0.03, FONT, col, extrude=0.0)
    clock.data.materials.append(M.emission("clock_green", (0.25, 1.0, 0.45), 6.0))
    clock.rotation_euler = (math.pi / 2, 0, 0)
    clock.location = (mx + 0.17, my - 0.197, 1.13)
    glow = bpy.data.lights.new("clock_glow", "POINT")
    glow.energy = 0.25
    glow.color = (0.3, 1.0, 0.5)
    glow.shadow_soft_size = 0.02
    g = bpy.data.objects.new("clock_glow", glow)
    link(g, col)
    g.location = (mx + 0.17, my - 0.24, 1.13)

    # ---------------------------------------------------------------- counter clutter (reads as a lived-in kitchen)
    _lathe("kettle", [(0.0, 0.0), (0.085, 0.0), (0.095, 0.03), (0.09, 0.15), (0.06, 0.2), (0.025, 0.215),
                      (0.0, 0.22)], M.ceramic("kettle_red", (0.75, 0.12, 0.1)), col, (-0.9, BACK_Y - 0.3, 0.92))
    _lathe("fruit_bowl", [(0.0, 0.0), (0.06, 0.0), (0.13, 0.05), (0.15, 0.09), (0.142, 0.09), (0.12, 0.055),
                          (0.0, 0.02)], M.ceramic("bowl_white", (0.92, 0.9, 0.85)), col, (-1.35, BACK_Y - 0.33, 0.92))
    _blobs("apples", [((-1.38, BACK_Y - 0.33, 1.0), (0.04, 0.04, 0.038)),
                      ((-1.31, BACK_Y - 0.36, 0.995), (0.038, 0.038, 0.036))],
           M.plastic("apple_red", (0.65, 0.05, 0.05), 0.3), col, rings=10, segs=14, subsurf=1)
    _blobs("lemon", [((-1.33, BACK_Y - 0.27, 1.0), (0.035, 0.028, 0.028))], M.plastic("lemon", (0.95, 0.8, 0.1), 0.4),
           col, rings=10, segs=14, subsurf=1)
    _box("cutting_board", (0.36, 0.02, 0.26), (-0.55, BACK_Y - 0.06, 1.05), top_m, col, 0.008).rotation_euler = \
        (math.radians(-8), 0, 0)
    for k, (x, h, c) in enumerate(((1.2, 0.2, (0.5, 0.3, 0.12)), (1.3, 0.17, (0.8, 0.75, 0.6)),
                                   (1.4, 0.24, (0.3, 0.45, 0.2)))):
        _lathe(f"jar_{k}", [(0.0, 0.0), (0.045, 0.0), (0.048, h * 0.9), (0.03, h), (0.0, h)],
               M.ceramic(f"jar_{k}", c, roughness=0.2), col, (x, BACK_Y - 0.15, 0.92))
    _box("kitchen_towel", (0.18, 0.01, 0.3), (0.95, BACK_Y - 0.62, 0.72),
         M.fabric("towel_check", (0.95, 0.94, 0.9), pattern="plaid", accent=(0.75, 0.15, 0.15), sheen=0.3,
                  mapping="object"), col)
    return col


def lighting(moon=60.0):
    scene = bpy.context.scene
    world = bpy.data.worlds.new("World")
    scene.world = world
    nt = world.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Color"].default_value = (0.02, 0.03, 0.07, 1)
    bg.inputs["Strength"].default_value = 0.35
    nt.links.new(bg.outputs[0], out.inputs[0])

    def area(name, energy, size, loc, target, color, size_y=None):
        light = bpy.data.lights.new(name, "AREA")
        light.energy = energy
        light.size = size
        if size_y:
            light.shape = "RECTANGLE"
            light.size_y = size_y
        light.color = color
        obj = bpy.data.objects.new(name, light)
        link(obj)
        obj.location = loc
        obj.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        return obj

    # cold moonlight through the window, a faint blue fill from the open side, a warm hallway spill
    area("Moon", moon, 1.0, (-2.3, -0.4, 2.2), (0.2, 0.6, 0.6), (0.55, 0.68, 1.0), size_y=1.0)
    area("NightFill", 5, 3.0, (1.6, -2.6, 1.8), (0.0, 0.6, 1.0), (0.45, 0.55, 0.85))
    area("Hallway", 25, 0.8, (2.6, -1.2, 1.6), (0.0, 0.3, 0.8), (1.0, 0.72, 0.45))
    area("RimTop", 6, 1.5, (-0.6, 0.4, 2.6), (0.0, 0.5, 1.4), (0.5, 0.6, 0.95))
