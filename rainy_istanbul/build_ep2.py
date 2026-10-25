"""Episode 2 builder: same character, coat, street and look as episode 1 + the bus.

Usage:  blender -b -P build_ep2.py -- OUT.blend
"""
import bpy
import sys
import os
import json
import math

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import env          # noqa: E402
import character    # noqa: E402
import coat         # noqa: E402
import bus          # noqa: E402
import anim_ep2 as E  # noqa: E402
from mathutils import Vector  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[0] if argv else os.path.join(HERE, "ep2.blend")

for o in list(bpy.data.objects):
    bpy.data.objects.remove(o)
scn = bpy.context.scene
scn.frame_start = 1
scn.frame_end = E.FRAMES
scn.render.fps = E.FPS

# ---------------------------------------------------------------- character (identical to episode 1)
body, rig = character.build_character()
suit = bpy.data.objects["Man.male_elegantsuit01"]
shoes = bpy.data.objects["Man.shoes02"]


def restyle(obj, color, rough, coat_w=0.0, keep_texture=False):
    for m in obj.data.materials:
        if not m or not m.use_nodes:
            continue
        nt = m.node_tree
        b = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
        if b is None:
            continue
        if keep_texture and b.inputs["Base Color"].is_linked:
            src = b.inputs["Base Color"].links[0].from_socket
            mul = nt.nodes.new("ShaderNodeMix")
            mul.data_type = "RGBA"
            mul.blend_type = "MULTIPLY"
            mul.inputs["Factor"].default_value = 1.0
            mul.inputs["B"].default_value = tuple(color) + (1,)
            nt.links.new(src, mul.inputs["A"])
            nt.links.new(mul.outputs["Result"], b.inputs["Base Color"])
        else:
            for l in list(b.inputs["Base Color"].links):
                nt.links.remove(l)
            b.inputs["Base Color"].default_value = tuple(color) + (1,)
        b.inputs["Roughness"].default_value = rough
        b.inputs["Coat Weight"].default_value = coat_w


restyle(suit, (0.25, 0.25, 0.27), 0.6, keep_texture=True)
restyle(shoes, (0.01, 0.009, 0.008), 0.25, coat_w=0.6)
hair = bpy.data.objects.get("Man.short02")
if hair:
    restyle(hair, (0.35, 0.3, 0.27), 0.5, keep_texture=True)
coat_obj = coat.build_coat(body, rig, [suit])
for m in body.data.materials:
    if m and m.use_nodes:
        for n in m.node_tree.nodes:
            if n.type == "BSDF_PRINCIPLED":
                n.inputs["Coat Weight"].default_value = 0.15
                n.inputs["Coat Roughness"].default_value = 0.3

# ---------------------------------------------------------------- street (episode 1) + bus
cam_data = bpy.data.cameras.new("FilmCam")
cam = bpy.data.objects.new("FilmCam", cam_data)
scn.collection.objects.link(cam)
scn.camera = cam
lamps, fog = env.build_environment()
bpy.data.objects.remove(fog)
# keep the boarding spot clear of lamp posts
for o in list(bpy.data.objects):
    if o.name.startswith(("LampPole", "LampBulb", "LampLight")):
        p = o.matrix_world.translation if o.type != "MESH" else Vector(o.bound_box[0]).lerp(Vector(o.bound_box[6]), 0.5) + o.location
        if p.x > 0 and abs(p.y - E.DOOR_Y_END) < 2.0:
            bpy.data.objects.remove(o)

bus_root, leaves, wheels = bus.build_bus()
E.animate_bus(bus_root, leaves, wheels)
scn.frame_set(E.FRAMES)
sign_world = bus_root.matrix_world @ Vector((0.0, -1.045, bus.HEIGHT - 0.72))

# ---------------------------------------------------------------- animation + camera
ctrls, steps = E.animate_man(rig, sign_world)
cut_frames = E.animate_camera(cam, rig, sign_world)
scn.render.motion_blur_position = "START"     # with constant keys at cuts: no blur across a cut

# lights that travel with the character (same as episode 1)
def area(name, energy, color, size, loc, target):
    ld = bpy.data.lights.new(name, "AREA")
    ld.energy = energy
    ld.color = color
    ld.size = size
    lo = bpy.data.objects.new(name, ld)
    scn.collection.objects.link(lo)
    lo.location = loc
    c = lo.constraints.new("TRACK_TO")
    c.target = target
    c.track_axis = "TRACK_NEGATIVE_Z"
    c.up_axis = "UP_Y"
    return lo


face_target = bpy.data.objects.new("FaceTarget", None)
scn.collection.objects.link(face_target)
face_target.parent = rig
face_target.location = (0, 0, 1.68)
key = area("KeyShop", 60, (1.0, 0.7, 0.45), 1.2, (0, 0, 0), face_target)
key.parent = rig
key.location = (-1.1, -1.6, 1.9)
rim = area("RimCool", 80, (0.55, 0.68, 1.0), 0.8, (0, 0, 0), face_target)
rim.parent = rig
rim.location = (1.4, 1.8, 2.3)

# ---------------------------------------------------------------- data for sound + post
track = {"steps": {k: [[s[0], s[1], list(s[2]), list(s[3]), s[4], s[5]] for s in v] for k, v in steps.items()},
         "man": [], "cam": [], "interior": [], "bus": [], "shots": E.SHOTS, "t_line": E.T_LINE,
         "t_arrive": E.T_ARRIVE, "bus_stop": E.BUS_T_STOP, "frames": E.FRAMES}
for f in range(1, E.FRAMES + 1):
    scn.frame_set(f)
    track["man"].append(list(rig.matrix_world.translation))
    track["cam"].append(list(cam.matrix_world.translation) + [list(cam.matrix_world.col[0][:3])])
    track["bus"].append(list(bus_root.matrix_world.translation))
    name, _ = E.shot_at(E.ft(f))
    track["interior"].append(name in ("inside", "sign", "closeup"))
with open(os.path.splitext(OUT)[0] + "_track.json", "w") as fh:
    json.dump(track, fh)

# ---------------------------------------------------------------- cloth
leg_proxy = coat.make_leg_proxy(suit, rig, rig.data.bones["thigh_l"].head_local.z + 0.05)
cl = coat.add_cloth(coat_obj, [leg_proxy], E.FRAMES)
cl.settings.quality = 12           # sprinting: more substeps
cl.point_cache.use_disk_cache = True
bpy.ops.wm.save_as_mainfile(filepath=OUT)
for f in range(1, E.FRAMES + 1):
    scn.frame_set(f)
print("CLOTH_SIM_DONE")
bpy.ops.wm.save_as_mainfile(filepath=OUT)
print("SAVED", OUT)
