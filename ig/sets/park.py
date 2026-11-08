"""Quiet park at night: an old wooden bench under a cold park lamp, a gravel path, dark
trees and bushes, a little fog, far-away lamps as bokeh. Cold blue moonlight.

Built away from the bedroom (at ORIGIN) so an episode can cut between them. Local layout
(meters, relative to ORIGIN): the bench stands at BENCH, facing -y (toward the cameras);
its seat top is SEAT_Z high and SEAT_FRONT is the y of the seat's front edge.
"""
import math

import bpy
from mathutils import Vector

from .. import materials as M
from ..materials import _new, _rgba
from ..util import collection, link
from .bedroom import _blobs, box, cylinder

ORIGIN = Vector((40.0, 30.0, 0.0))
BENCH = (0.0, 1.2)
SEAT_Z = 0.46
SEAT_FRONT = 1.0
LAMP = (1.05, 1.75)


def P(x, y, z):
    return tuple(ORIGIN + Vector((x, y, z)))


def _grass(name):
    """Dark night grass: noisy green-blue with a soft bump."""
    mat, nb = _new(name)
    if nb is None:
        return mat
    coord = nb.n("ShaderNodeTexCoord")
    n1 = nb.n("ShaderNodeTexNoise", {"Scale": 60.0, "Detail": 6.0})
    nb.link(coord.outputs["Object"], n1.inputs["Vector"])
    n2 = nb.n("ShaderNodeTexNoise", {"Scale": 1.2, "Detail": 2.0})
    nb.link(coord.outputs["Object"], n2.inputs["Vector"])
    c = nb.mix(_rgba((0.03, 0.07, 0.035)), _rgba((0.08, 0.14, 0.06)), n1.outputs[0])
    c = nb.mix(c, _rgba((0.05, 0.06, 0.04)), nb.math("MULTIPLY", n2.outputs[0], 0.6))
    bump = nb.n("ShaderNodeBump", {"Strength": 0.6, "Distance": 0.02})
    nb.link(n1.outputs[0], bump.inputs["Height"])
    nb.principled(**{"Base Color": c, "Roughness": 0.9, "Normal": bump.outputs[0]})
    return mat


def _gravel(name):
    mat, nb = _new(name)
    if nb is None:
        return mat
    coord = nb.n("ShaderNodeTexCoord")
    vor = nb.n("ShaderNodeTexVoronoi", {"Scale": 90.0})
    nb.link(coord.outputs["Object"], vor.inputs["Vector"])
    noise = nb.n("ShaderNodeTexNoise", {"Scale": 4.0, "Detail": 3.0})
    nb.link(coord.outputs["Object"], noise.inputs["Vector"])
    c = nb.mix(_rgba((0.16, 0.15, 0.14)), _rgba((0.3, 0.28, 0.26)), vor.outputs["Distance"])
    c = nb.mix(c, _rgba((0.1, 0.1, 0.1)), nb.math("MULTIPLY", noise.outputs[0], 0.5))
    bump = nb.n("ShaderNodeBump", {"Strength": 0.8, "Distance": 0.006})
    nb.link(vor.outputs["Distance"], bump.inputs["Height"])
    nb.principled(**{"Base Color": c, "Roughness": 0.85, "Normal": bump.outputs[0]})
    return mat


def _bench(col):
    wood = M.wood("bench_wood_old", light=(0.42, 0.3, 0.2), dark=(0.2, 0.13, 0.08), roughness=0.75, coat=0.0)
    iron = M.metal("bench_iron", (0.05, 0.055, 0.06), 0.55)
    bx, by = BENCH
    L = 1.7
    # seat: 5 slats, front edge at SEAT_FRONT
    for k in range(5):
        y = SEAT_FRONT + 0.045 + k * 0.088
        box("bench_seat", (L, 0.075, 0.032), P(bx, y, SEAT_Z - 0.016), wood, col, bevel=0.008)
    # backrest: 3 slats leaning back
    back_y = SEAT_FRONT + 0.46
    for k in range(3):
        z = SEAT_Z + 0.14 + k * 0.13
        slat = box("bench_back", (L, 0.07, 0.03), P(bx, back_y + 0.04 * k, z), wood, col, bevel=0.008)
        slat.rotation_euler = (math.radians(-75), 0, 0)
    # cast-iron ends: legs, a seat bracket and a curled armrest
    for sx in (-1, 1):
        x = bx + sx * (L / 2 - 0.1)
        box("bench_leg_f", (0.05, 0.05, SEAT_Z - 0.03), P(x, SEAT_FRONT + 0.06, (SEAT_Z - 0.03) / 2), iron, col,
            bevel=0.01)
        box("bench_leg_b", (0.05, 0.05, SEAT_Z + 0.52), P(x, back_y + 0.02, (SEAT_Z + 0.52) / 2), iron, col,
            bevel=0.01).rotation_euler = (math.radians(-12), 0, 0)
        box("bench_bracket", (0.045, 0.46, 0.045), P(x, SEAT_FRONT + 0.24, SEAT_Z - 0.055), iron, col, bevel=0.01)
        arm = box("bench_arm", (0.05, 0.42, 0.04), P(x, SEAT_FRONT + 0.2, SEAT_Z + 0.22), iron, col, bevel=0.012)
        arm.rotation_euler = (math.radians(6), 0, 0)
        box("bench_arm_post", (0.04, 0.04, 0.22), P(x, SEAT_FRONT + 0.03, SEAT_Z + 0.11), iron, col, bevel=0.01)
        _blobs("bench_curl", [((0, 0, 0), (0.035, 0.035, 0.035))], iron, col).location = P(x, SEAT_FRONT + 0.0,
                                                                                            SEAT_Z + 0.23)
    # a small brass plaque on the backrest, worn
    box("bench_plaque", (0.12, 0.01, 0.035), P(bx, back_y + 0.04 - 0.045, SEAT_Z + 0.3),
        M.metal("plaque_brass", (0.55, 0.42, 0.22), 0.5), col).rotation_euler = (math.radians(-75), 0, 0)


def _tree(name, x, y, h, r, col, seed):
    bark = M.wood("bark_dark", light=(0.12, 0.09, 0.07), dark=(0.05, 0.04, 0.03), roughness=0.9, coat=0.0)
    leaves = M.fabric("leaves_night", (0.04, 0.09, 0.05), sheen=0.2, wrinkle=0.0, mapping="object")
    trunk = cylinder(name + "_trunk", 0.09 + h * 0.012, h, P(x, y, h / 2), bark, col, verts=16)
    trunk.rotation_euler = (0.04 * math.sin(seed), 0.05 * math.cos(seed), 0)
    import random
    rng = random.Random(seed)
    blobs = [((0, 0, 0), (r, r * 0.9, r * 0.75))]
    for _ in range(7):
        a = rng.uniform(0, 2 * math.pi)
        d = rng.uniform(0.3, 0.75) * r
        s = rng.uniform(0.45, 0.7) * r
        blobs.append(((math.cos(a) * d, math.sin(a) * d * 0.8, rng.uniform(-0.3, 0.45) * r), (s, s, s * 0.85)))
    canopy = _blobs(name + "_canopy", blobs, leaves, col, rings=8, segs=12, subsurf=1)
    canopy.location = P(x, y, h + r * 0.35)
    return trunk, canopy


def _fog(col):
    mat = bpy.data.materials.new("park_fog")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    vol = nt.nodes.new("ShaderNodeVolumePrincipled")
    vol.inputs["Density"].default_value = 0.05
    vol.inputs["Color"].default_value = (0.7, 0.8, 0.95, 1)
    vol.inputs["Anisotropy"].default_value = 0.4
    nt.links.new(vol.outputs[0], out.inputs["Volume"])
    fog = box("park_fog", (10.0, 9.0, 4.0), P(0.0, 2.0, 2.0), mat, col)
    fog.visible_shadow = False
    return fog


def build():
    col = collection("Park")
    box("park_ground", (30, 30, 0.02), P(0, 5, -0.01), _grass("grass_night"), col)
    box("park_path", (12, 1.6, 0.012), P(0, 0.2, 0.004), _gravel("gravel_path"), col)
    border = M.paint("path_border", (0.25, 0.25, 0.24), roughness=0.9, texture=0.2)
    for y in (-0.6, 1.0):
        box("path_edge", (12, 0.05, 0.03), P(0, y, 0.015), border, col)
    _bench(col)

    # park lamp: dark green pole, lantern with a frosted globe, cold light
    pole_m = M.metal("lamp_green", (0.05, 0.09, 0.07), 0.5)
    lx, ly = LAMP
    cylinder("plamp_pole", 0.045, 3.0, P(lx, ly, 1.5), pole_m, col)
    cylinder("plamp_base", 0.09, 0.35, P(lx, ly, 0.175), pole_m, col, bevel=0.01)
    cylinder("plamp_cap", 0.16, 0.05, P(lx, ly, 3.33), pole_m, col, bevel=0.01)
    _blobs("plamp_globe", [((0, 0, 0), (0.15, 0.15, 0.19))], M.emission("globe_cold", (0.78, 0.88, 1.0), 14.0),
           col).location = P(lx, ly, 3.15)
    spot = bpy.data.lights.new("plamp_light", "POINT")
    spot.energy = 260
    spot.color = (0.75, 0.86, 1.0)
    spot.shadow_soft_size = 0.15
    lamp = bpy.data.objects.new("plamp_light", spot)
    link(lamp, col)
    lamp.location = P(lx, ly, 3.0)

    # trees and bushes behind, silhouettes against a faint sky
    for k, (x, y, h, r) in enumerate(((-2.4, 3.6, 2.8, 1.3), (2.6, 4.2, 3.2, 1.5), (-0.6, 6.5, 3.6, 1.7),
                                      (4.5, 7.5, 3.0, 1.4), (-4.6, 6.0, 3.3, 1.6))):
        _tree(f"tree_{k}", x, y, h, r, col, seed=k * 3 + 1)
    bush = M.fabric("bush_night", (0.03, 0.07, 0.04), sheen=0.2, wrinkle=0.0, mapping="object")
    _blobs("bushes", [((-1.6, 2.2, 0.3), (0.55, 0.4, 0.38)), ((-1.1, 2.4, 0.25), (0.4, 0.35, 0.3)),
                      ((1.9, 2.5, 0.32), (0.6, 0.45, 0.4)), ((2.5, 2.3, 0.22), (0.35, 0.3, 0.26))],
           bush, col, rings=8, segs=12, subsurf=1).location = ORIGIN
    # fallen leaves on the path
    leaf_m = M.fabric("leaf_dry", (0.35, 0.2, 0.08), sheen=0.1, wrinkle=0.0, mapping="object")
    import random
    rng = random.Random(7)
    items = []
    for _ in range(26):
        x, y = rng.uniform(-2.2, 2.2), rng.uniform(-0.5, 0.95)
        items.append(((x, y, 0.012), (rng.uniform(0.025, 0.04), rng.uniform(0.015, 0.025), 0.004)))
    _blobs("leaves_fallen", items, leaf_m, col, rings=4, segs=8).location = ORIGIN
    # far lamps for bokeh
    far = M.emission("far_lamp", (1.0, 0.8, 0.55), 30.0)
    for k, (x, y, z) in enumerate(((-3.5, 12.0, 2.6), (3.8, 14.0, 2.8), (0.8, 16.0, 2.5), (-6.0, 15.0, 2.7))):
        _blobs(f"far_lamp_{k}", [((0, 0, 0), (0.08, 0.08, 0.1))], far, col).location = P(x, y, z)

    # moonlight: a cold rim from behind-left, a faint blue fill from the front
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

    area("park_moon", 160, 3.0, (-2.5, 5.0, 4.0), (0.0, 1.2, 0.5), (0.5, 0.62, 1.0))
    area("park_fill", 22, 2.5, (0.6, -2.8, 1.4), (0.0, 1.2, 0.5), (0.45, 0.55, 0.95))
    _fog(col)
    return dict(col=col, lamp=lamp)
