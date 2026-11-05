"""Night back street: wet asphalt, a curb, a brick wall, two dumpsters under a sodium
street lamp, light fog, and a cold side light that throws strange shadows on the wall.

Built away from the bedroom (at ORIGIN) so one episode can cut between the two.
Local layout (meters, relative to ORIGIN): the wall runs along y = WALL_Y, the
sidewalk is y in [CURB_Y, WALL_Y], the road is y < CURB_Y. Cameras look toward +y.

build() returns a dict with the pieces episodes animate:
    casters   list of shadow-casting shapes (invisible to the camera, see _caster)
    lamp      the street lamp's spot light object (flicker its energy)
    side      the low side light whose beam the casters cross
"""
import math

import bpy
from mathutils import Vector

from .. import materials as M
from ..materials import _new, _rgba
from ..util import collection, link
from .bedroom import _blobs, box, cylinder

ORIGIN = Vector((40.0, 0.0, 0.0))
WALL_Y = 2.6
CURB_Y = 1.0
CURB_H = 0.12
DUMPSTERS = ((-1.25, 2.05), (0.35, 2.1))       # local x, y of the two bins
LAMP_W = 450
LAMP_XY = (0.25, 1.2)                           # under the lamp head


def P(x, y, z):
    return tuple(ORIGIN + Vector((x, y, z)))


def _brick(name):
    mat, nb = _new(name)
    if nb is None:
        return mat
    coord = nb.n("ShaderNodeTexCoord")
    mapping = nb.n("ShaderNodeMapping")
    mapping.inputs["Rotation"].default_value = (math.pi / 2, 0, 0)      # bricks in the x-z plane
    nb.link(coord.outputs["Object"], mapping.inputs["Vector"])
    brick = nb.n("ShaderNodeTexBrick", {"Scale": 1.0, "Mortar Size": 0.012, "Brick Width": 0.24,
                                        "Row Height": 0.075, "Bias": 0.0},
                 offset=0.5, squash_frequency=1)
    brick.inputs["Color1"].default_value = (0.36, 0.13, 0.08, 1)
    brick.inputs["Color2"].default_value = (0.26, 0.1, 0.07, 1)
    brick.inputs["Mortar"].default_value = (0.3, 0.29, 0.27, 1)
    nb.link(mapping.outputs[0], brick.inputs["Vector"])
    grime = nb.n("ShaderNodeTexNoise", {"Scale": 3.0, "Detail": 4.0})
    nb.link(mapping.outputs[0], grime.inputs["Vector"])
    col = nb.mix(brick.outputs["Color"], _rgba((0.08, 0.07, 0.06)), nb.math("MULTIPLY", grime.outputs[0], 0.45))
    bump = nb.n("ShaderNodeBump", {"Strength": 0.5, "Distance": 0.01})
    nb.link(brick.outputs["Fac"], bump.inputs["Height"])
    nb.principled(**{"Base Color": col, "Roughness": 0.85, "Normal": bump.outputs[0]})
    return mat


def _asphalt(name, wet=0.6):
    """Dark asphalt with glossy wet patches (puddles reflect the lamp)."""
    mat, nb = _new(name)
    if nb is None:
        return mat
    coord = nb.n("ShaderNodeTexCoord")
    grain = nb.n("ShaderNodeTexNoise", {"Scale": 180.0, "Detail": 2.0})
    nb.link(coord.outputs["Object"], grain.inputs["Vector"])
    puddle = nb.n("ShaderNodeTexNoise", {"Scale": 0.7, "Detail": 3.0, "Roughness": 0.6})
    nb.link(coord.outputs["Object"], puddle.inputs["Vector"])
    ramp = nb.n("ShaderNodeMapRange", {"From Min": 0.5, "From Max": 0.56, "To Min": 0.0, "To Max": 1.0})
    nb.link(puddle.outputs[0], ramp.inputs[0])
    rough = nb.n("ShaderNodeMapRange", {"From Min": 0.0, "From Max": 1.0, "To Min": 0.75, "To Max": 0.06})
    nb.link(ramp.outputs[0], rough.inputs[0])
    col = nb.mix(_rgba((0.05, 0.05, 0.055)), _rgba((0.1, 0.1, 0.1)), grain.outputs[0])
    bump = nb.n("ShaderNodeBump", {"Strength": 0.25, "Distance": 0.004})
    nb.link(grain.outputs[0], bump.inputs["Height"])
    nb.principled(**{"Base Color": col, "Roughness": rough.outputs[0], "Normal": bump.outputs[0]})
    return mat


def _dumpster(name, x, y, col, lid_open=0.0, color=(0.08, 0.3, 0.16)):
    body_m = M.plastic(name + "_green", color, 0.55)
    dark_m = M.plastic("bin_black", (0.03, 0.03, 0.03), 0.6)
    w, d, h = 1.0, 0.75, 0.95
    body = box(name, (w, d, h), P(x, y, 0.13 + h / 2), body_m, col, bevel=0.03)
    for sx in (-1, 1):                                               # wheels
        for sy in (-1, 1):
            wh = cylinder(name + "_wheel", 0.06, 0.04, P(x + sx * (w / 2 - 0.1), y + sy * (d / 2 - 0.1), 0.065),
                          dark_m, col)
            wh.rotation_euler = (0, math.pi / 2, 0)
    box(name + "_rim", (w + 0.04, d + 0.04, 0.05), P(x, y, 0.13 + h), body_m, col, bevel=0.015)
    hinge = bpy.data.objects.new(name + "_lid_hinge", None)
    link(hinge, col)
    hinge.location = P(x, y + d / 2, 0.13 + h + 0.03)
    lid = box(name + "_lid", (w + 0.02, d + 0.02, 0.04), P(x, y, 0.13 + h + 0.05), dark_m, col, bevel=0.012)
    bpy.context.view_layer.update()
    lid.parent = hinge
    lid.matrix_parent_inverse = hinge.matrix_world.inverted()
    hinge.rotation_euler = (lid_open, 0, 0)
    for k, sx in enumerate((-0.32, 0.32)):                            # side handles
        box(name + f"_handle_{k}", (0.18, 0.04, 0.03), P(x + sx, y - d / 2 - 0.03, 0.13 + h - 0.12), dark_m, col)
    return body, hinge


def _fog(col):
    """A low-density volume over the street: the lamp beam and the side light show as shafts."""
    mat = bpy.data.materials.new("street_fog")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    vol = nt.nodes.new("ShaderNodeVolumePrincipled")
    vol.inputs["Density"].default_value = 0.07
    vol.inputs["Color"].default_value = (0.75, 0.8, 0.9, 1)
    vol.inputs["Anisotropy"].default_value = 0.35
    nt.links.new(vol.outputs[0], out.inputs["Volume"])
    fog = box("street_fog", (9.0, 6.2, 3.2), P(0.0, 0.0, 1.6), mat, col)
    fog.visible_shadow = False
    return fog


def _caster(name, parts, col):
    """A shadow shape: casts shadows (and blocks the fog shafts) but the camera never sees it."""
    m = M.plastic("caster_black", (0.0, 0.0, 0.0), 0.9)
    obj = _blobs(name, parts, m, col, rings=8, segs=12, subsurf=1)
    obj.visible_camera = False
    obj.visible_glossy = False
    obj.visible_transmission = False
    obj.visible_diffuse = False
    return obj


def build():
    col = collection("Street")
    asphalt = _asphalt("asphalt_wet")
    curb_m = M.paint("curb_concrete", (0.32, 0.31, 0.3), roughness=0.85, texture=0.2)
    walk_m = M.tiles("sidewalk", (0.26, 0.26, 0.25), (0.23, 0.23, 0.22), size=0.4, grout=(0.16, 0.16, 0.16), roughness=0.7)
    brick = _brick("brick_dark")
    metal = M.metal("pole_metal", (0.12, 0.13, 0.14), 0.45)

    box("road", (14, 10, 0.02), P(0, CURB_Y - 5.0, -0.01), asphalt, col)
    box("curb", (14, 0.16, CURB_H), P(0, CURB_Y + 0.08, CURB_H / 2), curb_m, col, bevel=0.01)
    box("sidewalk", (14, WALL_Y - CURB_Y - 0.16, CURB_H - 0.01), P(0, (WALL_Y + CURB_Y + 0.16) / 2,
                                                                     (CURB_H - 0.01) / 2), walk_m, col)
    box("wall", (14, 0.3, 4.0), P(0, WALL_Y + 0.15, 2.0), brick, col)
    box("wall_cap", (14, 0.36, 0.08), P(0, WALL_Y + 0.15, 4.02), curb_m, col)
    # a back door with a dim bulb, a drain pipe, a poster
    box("back_door", (0.9, 0.06, 2.0), P(2.2, WALL_Y - 0.01, 1.12), M.metal("door_rust", (0.22, 0.12, 0.08), 0.7),
        col, bevel=0.01)
    box("door_step", (1.1, 0.3, 0.06), P(2.2, WALL_Y - 0.15, CURB_H + 0.03), curb_m, col)
    _blobs("door_bulb", [((0, 0, 0), (0.035, 0.035, 0.05))], M.emission("bulb_dim", (1.0, 0.75, 0.45), 30.0),
           col).location = P(2.2, WALL_Y - 0.08, 2.35)
    pipe = cylinder("drain_pipe", 0.045, 4.0, P(-2.3, WALL_Y - 0.07, 2.0), metal, col)
    box("poster_torn", (0.42, 0.01, 0.58), P(-0.45, WALL_Y - 0.005, 1.95),
        M.paint("poster_faded", (0.3, 0.26, 0.2), roughness=0.9, texture=0.05), col).rotation_euler = (0, 0.06, 0)

    for k, (x, y) in enumerate(DUMPSTERS):
        _dumpster(f"dumpster_{k}", x, y, col, lid_open=(0.0 if k == 0 else -0.16),
                  color=((0.08, 0.3, 0.16) if k == 0 else (0.1, 0.22, 0.34)))
    bag_m = M.plastic("bag_black", (0.015, 0.015, 0.018), 0.15)
    _blobs("trash_bags", [((-0.45, 1.75, 0.3), (0.26, 0.22, 0.2)), ((-0.7, 1.68, 0.25), (0.2, 0.2, 0.16)),
                          ((-0.55, 1.62, 0.44), (0.12, 0.12, 0.1))], bag_m, col, rings=10, segs=14, subsurf=1)\
        .location = ORIGIN
    box("cardboard", (0.45, 0.35, 0.3), P(1.15, 2.25, CURB_H + 0.15),
        M.paint("cardboard", (0.5, 0.36, 0.2), roughness=0.9, texture=0.15), col, bevel=0.005)\
        .rotation_euler = (0, 0, 0.3)
    _blobs("can", [((0, 0, 0), (0.03, 0.03, 0.06))], M.metal("can_red", (0.6, 0.08, 0.06), 0.3), col)\
        .location = P(0.9, 1.25, CURB_H + 0.03)

    # street lamp: pole, arm, head; a warm sodium spot through the fog
    lx, ly, reach = 1.7, 1.2, 1.5
    cylinder("lamp_pole", 0.05, 3.6, P(lx, ly, 1.8 + CURB_H), metal, col)
    arm = cylinder("lamp_arm", 0.03, reach, P(lx - reach / 2, ly, 3.62), metal, col)
    arm.rotation_euler = (0, math.pi / 2, 0)
    hx = lx - reach + 0.05
    box("lamp_head", (0.38, 0.2, 0.08), P(hx, ly, 3.58), metal, col, bevel=0.02)
    box("lamp_glass", (0.32, 0.16, 0.012), P(hx, ly, 3.535), M.emission("sodium", (1.0, 0.62, 0.3), 25.0), col)
    spot = bpy.data.lights.new("lamp_spot", "SPOT")
    spot.energy = LAMP_W
    spot.color = (1.0, 0.62, 0.3)
    spot.spot_size = math.radians(55)
    spot.spot_blend = 0.6
    spot.shadow_soft_size = 0.12
    lamp = bpy.data.objects.new("lamp_spot", spot)
    link(lamp, col)
    lamp.location = P(hx, ly, 3.5)
    lamp.rotation_euler = (math.radians(-15), 0, 0)      # tilted toward the road: the wall stays dark

    # cold low side light from the road (a car park, off screen) – its beam paints the wall,
    # and the casters crossing it make the shadows
    side_l = bpy.data.lights.new("side_spot", "SPOT")
    side_l.energy = 2200
    side_l.color = (0.6, 0.72, 1.0)
    side_l.spot_size = math.radians(30)
    side_l.spot_blend = 0.35
    side_l.shadow_soft_size = 0.05
    side = bpy.data.objects.new("side_spot", side_l)
    link(side, col)
    side.location = P(-3.6, -1.8, 0.5)
    side.rotation_euler = (Vector((-1.0, WALL_Y, 1.4)) - Vector((-3.6, -1.8, 0.5))).to_track_quat("-Z", "Y").to_euler()

    # moon rim from behind the wall
    rim = bpy.data.lights.new("street_rim", "AREA")
    rim.energy = 60
    rim.size = 3.0
    rim.color = (0.45, 0.55, 0.95)
    ro = bpy.data.objects.new("street_rim", rim)
    link(ro, col)
    ro.location = P(0.5, 4.5, 4.5)
    ro.rotation_euler = (Vector((0, 1.2, 0.3)) - Vector((0.5, 4.5, 4.5))).to_track_quat("-Z", "Y").to_euler()

    # a faint cool fill from the road side so faces read in the dark
    fill = bpy.data.lights.new("street_fill", "AREA")
    fill.energy = 25
    fill.size = 2.0
    fill.color = (0.5, 0.6, 1.0)
    fo = bpy.data.objects.new("street_fill", fill)
    link(fo, col)
    fo.location = P(0.8, -2.5, 1.2)
    fo.rotation_euler = (Vector((-0.2, 1.4, 0.4)) - Vector((0.8, -2.5, 1.2))).to_track_quat("-Z", "Y").to_euler()

    _fog(col)

    # shadow casters, parked out of the beam until an episode moves them in
    casters = [
        # a hunched thing with two pointed ears and a long tail (never seen clearly)
        _caster("caster_0", [((0, 0, 0.0), (0.22, 0.12, 0.16)), ((0.2, 0, 0.12), (0.1, 0.08, 0.1)),
                             ((0.17, 0, 0.24), (0.025, 0.02, 0.07)), ((0.26, 0, 0.24), (0.025, 0.02, 0.07)),
                             ((-0.32, 0, 0.12), (0.16, 0.025, 0.025)), ((-0.42, 0, 0.26), (0.025, 0.025, 0.14))],
                col),
        # something tall and thin with spindly arms
        _caster("caster_1", [((0, 0, 0.0), (0.06, 0.06, 0.45)), ((0, 0, 0.52), (0.09, 0.08, 0.1)),
                             ((0.18, 0, 0.25), (0.2, 0.02, 0.02)), ((-0.16, 0, 0.32), (0.18, 0.02, 0.02))], col),
        # a big round lump (for the end, close to the light)
        _caster("caster_2", [((0, 0, 0), (0.18, 0.18, 0.2)), ((0.12, 0, 0.18), (0.06, 0.05, 0.08)),
                             ((-0.1, 0, 0.18), (0.06, 0.05, 0.08))], col),
    ]
    for k, c in enumerate(casters):
        c.location = P(-5.0, -3.0 - k, 0.5)
        c.scale = (1.6, 1.6, 1.6) if k < 2 else (1.0, 1.0, 1.0)
    return dict(col=col, casters=casters, lamp=lamp, side=side)
