"""The outside of the bedroom's house, for shots that leave the room through the window:
a cream plaster wall with the lit window (the bedroom's left wall, x = -1.75), a gabled tile
roof, a flower box, a garden with grass, a tree and a little fence, and a starry night sky
with a moon.

Everything here would block light or get in the way of the indoor cameras, so build()
returns the objects and episodes switch them on (hide_render keys) just before the camera
goes outside; the hallway behind the bedroom door is switched off at the same moment.
"""
import math
import random

import bpy
from mathutils import Vector

from .. import materials as M
from ..materials import _new, _rgba
from ..util import collection, link
from .bedroom import _blobs, box, cylinder

WALL_X = -1.86          # outer face of the window wall
WIN_Y = (-0.65, 0.65)
WIN_Z = (0.88, 2.22)


def _tiles(name):
    mat, nb = _new(name)
    if nb is None:
        return mat
    coord = nb.n("ShaderNodeTexCoord")
    wave = nb.n("ShaderNodeTexWave", {"Scale": 3.2, "Distortion": 0.0, "Detail": 0.0}, wave_type="BANDS",
                bands_direction="Y")
    nb.link(coord.outputs["Object"], wave.inputs["Vector"])
    noise = nb.n("ShaderNodeTexNoise", {"Scale": 6.0})
    nb.link(coord.outputs["Object"], noise.inputs["Vector"])
    c = nb.mix(_rgba((0.36, 0.1, 0.06)), _rgba((0.5, 0.16, 0.08)), noise.outputs[0])
    bump = nb.n("ShaderNodeBump", {"Strength": 0.6, "Distance": 0.02})
    nb.link(wave.outputs[0], bump.inputs["Height"])
    nb.principled(**{"Base Color": c, "Roughness": 0.7, "Normal": bump.outputs[0]})
    return mat


def starry_sky(base=(0.015, 0.022, 0.06), strength=0.25, stars=4.0):
    """Night world: the usual dark blue plus pin-point stars above the horizon."""
    world = bpy.context.scene.world
    nt = world.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Color"].default_value = (*base, 1)
    bg.inputs["Strength"].default_value = strength
    coord = nt.nodes.new("ShaderNodeTexCoord")
    vor = nt.nodes.new("ShaderNodeTexVoronoi")
    vor.inputs["Scale"].default_value = 260.0
    nt.links.new(coord.outputs["Generated"], vor.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeMapRange")
    ramp.inputs[1].default_value = 0.06
    ramp.inputs[2].default_value = 0.0
    nt.links.new(vor.outputs["Distance"], ramp.inputs[0])
    tw = nt.nodes.new("ShaderNodeMath")
    tw.operation = "MULTIPLY"
    nt.links.new(ramp.outputs[0], tw.inputs[0])
    sep = nt.nodes.new("ShaderNodeSeparateColor")
    nt.links.new(vor.outputs["Color"], sep.inputs[0])
    nt.links.new(sep.outputs[0], tw.inputs[1])                       # some stars brighter than others
    sky = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(coord.outputs["Generated"], sky.inputs[0])
    up = nt.nodes.new("ShaderNodeMapRange")
    up.inputs[1].default_value = 0.0
    up.inputs[2].default_value = 0.25
    nt.links.new(sky.outputs[2], up.inputs[0])
    mask = nt.nodes.new("ShaderNodeMath")
    mask.operation = "MULTIPLY"
    nt.links.new(tw.outputs[0], mask.inputs[0])
    nt.links.new(up.outputs[0], mask.inputs[1])
    sbg = nt.nodes.new("ShaderNodeBackground")
    sbg.inputs["Color"].default_value = (0.9, 0.93, 1.0, 1)
    gain = nt.nodes.new("ShaderNodeMath")
    gain.operation = "MULTIPLY"
    gain.inputs[1].default_value = stars
    nt.links.new(mask.outputs[0], gain.inputs[0])
    nt.links.new(gain.outputs[0], sbg.inputs["Strength"])
    add = nt.nodes.new("ShaderNodeAddShader")
    nt.links.new(bg.outputs[0], add.inputs[0])
    nt.links.new(sbg.outputs[0], add.inputs[1])
    nt.links.new(add.outputs[0], out.inputs[0])


def build():
    col = collection("Exterior")
    objs = []
    plaster = M.paint("ext_plaster", (0.86, 0.78, 0.62), roughness=0.85, texture=0.12)
    trim = M.paint("ext_trim", (0.93, 0.92, 0.88), roughness=0.5, texture=0.02)
    t = 0.12
    y0, y1 = WIN_Y
    z0, z1 = WIN_Z
    H = 3.4
    add = lambda o: (objs.append(o), o)[1]
    add(box("ext_wall_a", (t, y0 + 3.05, H), (WALL_X, (y0 - 3.05) / 2, H / 2), plaster, col))
    add(box("ext_wall_b", (t, 3.05 - y1, H), (WALL_X, (y1 + 3.05) / 2, H / 2), plaster, col))
    add(box("ext_wall_low", (t, y1 - y0, z0), (WALL_X, 0, z0 / 2), plaster, col))
    add(box("ext_wall_high", (t, y1 - y0, H - z1), (WALL_X, 0, (H + z1) / 2), plaster, col))
    add(box("ext_wall_front", (4.95, t, H), (0.6, -3.08, H / 2), plaster, col))
    add(box("ext_wall_right", (t, 6.2, H), (3.08, 0.0, H / 2), plaster, col))
    add(box("ext_wall_back", (4.95, t, H), (0.6, 3.08, H / 2), plaster, col))
    add(box("ext_garden_wall", (1.25, 0.2, 3.25), (-2.47, 1.6, 1.625), plaster, col))    # clads the bedroom's back wall end
    # window trim, sill and a flower box
    for k, y in enumerate((y0, y1)):
        add(box(f"ext_win_jamb_{k}", (0.06, 0.08, z1 - z0 + 0.1), (WALL_X - 0.06, y, (z0 + z1) / 2), trim, col))
    add(box("ext_win_head", (0.06, y1 - y0 + 0.16, 0.08), (WALL_X - 0.06, 0, z1 + 0.02), trim, col))
    add(box("ext_sill", (0.16, y1 - y0 + 0.2, 0.05), (WALL_X - 0.09, 0, z0 - 0.02), trim, col, bevel=0.01))
    add(box("flower_box", (0.18, y1 - y0, 0.16), (WALL_X - 0.12, 0, z0 - 0.14),
            M.wood("flowerbox_wood", light=(0.5, 0.3, 0.16), dark=(0.3, 0.16, 0.07)), col, bevel=0.01))
    rng = random.Random(4)
    petals = [((WALL_X - 0.12 + rng.uniform(-0.05, 0.05), rng.uniform(y0 + 0.08, y1 - 0.08), z0 + rng.uniform(-0.02, 0.06)),
               (0.035, 0.035, 0.03)) for _ in range(14)]
    add(_blobs("flowers", petals, M.fabric("flower_pink", (0.95, 0.45, 0.6), sheen=0.5, wrinkle=0.0,
                                            mapping="object"), col))
    leaves = [((WALL_X - 0.12 + rng.uniform(-0.06, 0.06), rng.uniform(y0 + 0.05, y1 - 0.05), z0 - 0.06),
               (0.05, 0.04, 0.03)) for _ in range(16)]
    add(_blobs("flower_leaves", leaves, M.fabric("flower_leaf", (0.12, 0.32, 0.1), sheen=0.3, wrinkle=0.0,
                                                  mapping="object"), col))
    # gabled tile roof (ridge along y)
    tiles = _tiles("roof_tiles")
    span, pitch = 5.4, math.radians(32)
    w = span / 2 / math.cos(pitch) + 0.15
    for sx in (-1, 1):
        r = add(box(f"roof_{sx}", (w, 6.8, 0.12), (0.6 + sx * span / 4, 0.0, H + span / 4 * math.tan(pitch)),
                    tiles, col))
        r.rotation_euler = (0, sx * pitch, 0)
    gable = M.paint("ext_gable", (0.8, 0.72, 0.56), roughness=0.85, texture=0.12)
    for y in (-3.08, 3.08):
        verts = [(-1.92, y, H), (3.12, y, H), (0.6, y, H + span / 2 * math.tan(pitch))]
        me = bpy.data.meshes.new("gable")
        me.from_pydata(verts, [], [(0, 1, 2)])
        ob = bpy.data.objects.new("gable", me)
        link(ob, col)
        me.materials.append(gable)
        ob.modifiers.new("Solidify", "SOLIDIFY").thickness = 0.1
        add(ob)
    add(box("chimney", (0.4, 0.4, 1.3), (1.6, 1.4, H + 1.4), M.paint("chimney_brick", (0.45, 0.2, 0.14)), col))
    # garden
    grass = M.fabric("ext_grass", (0.05, 0.12, 0.05), sheen=0.3, wrinkle=0.0, mapping="object")
    add(box("ext_ground", (40, 40, 0.02), (-22.0, 0, 0.002), grass, col))
    add(box("ext_ground_r", (30, 40, 0.02), (18.2, 0, 0.002), grass, col))
    add(box("ext_ground_f", (6.1, 30, 0.02), (0.0, -18.2, 0.002), grass, col))
    add(box("ext_ground_b", (6.1, 30, 0.02), (0.0, 18.2, 0.002), grass, col))
    fence = M.paint("fence_white", (0.85, 0.85, 0.82), roughness=0.6, texture=0.05)
    for k in range(17):
        add(box("fence_post", (0.05, 0.05, 0.75), (-5.2, -4.0 + k * 0.5, 0.375), fence, col))
    for z in (0.3, 0.6):
        add(box("fence_rail", (0.03, 8.2, 0.05), (-5.18, 0.0, z), fence, col))
    bark = M.wood("ext_bark", light=(0.18, 0.12, 0.08), dark=(0.08, 0.05, 0.03), roughness=0.9, coat=0.0)
    add(cylinder("ext_tree_trunk", 0.14, 2.6, (-4.0, 2.6, 1.3), bark, col, verts=16))
    canopy = [((0, 0, 0), (1.1, 1.0, 0.9)), ((0.5, 0.3, 0.4), (0.7, 0.7, 0.6)), ((-0.5, -0.2, 0.3), (0.75, 0.7, 0.6))]
    c = _blobs("ext_tree_canopy", canopy, M.fabric("ext_leaves", (0.05, 0.13, 0.06), sheen=0.2, wrinkle=0.0,
                                                    mapping="object"), col, rings=8, segs=12, subsurf=1)
    c.location = (-4.0, 2.6, 3.1)
    add(c)
    # the moon
    moon = _blobs("moon", [((0, 0, 0), (2.4, 2.4, 2.4))], M.emission("moon_glow", (1.0, 0.96, 0.85), 6.0), col,
                  rings=16, segs=24)
    moon.location = (32.0, 18.0, 44.0)
    moon.visible_shadow = False
    add(moon)
    for o in objs:
        o.hide_render = True
    return objs
