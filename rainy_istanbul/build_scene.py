"""Builds the complete 10 s shot and saves it as a .blend.

Usage:  blender -b -P build_scene.py -- OUT.blend [--no-env] [--no-cloth]
"""
import bpy
import sys
import os
import math

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import env          # noqa: E402
import character    # noqa: E402
import coat         # noqa: E402
import animation    # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[0] if argv else os.path.join(HERE, "scene.blend")
NO_ENV = "--no-env" in argv
NO_CLOTH = "--no-cloth" in argv

for o in list(bpy.data.objects):
    bpy.data.objects.remove(o)
scn = bpy.context.scene
scn.frame_start = 1
scn.frame_end = animation.FRAMES
scn.render.fps = animation.FPS

# ---------------------------------------------------------------- character
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
# wet hair
hair = bpy.data.objects.get("Man.short02")
if hair:
    restyle(hair, (0.35, 0.3, 0.27), 0.5, keep_texture=True)

coat_obj = coat.build_coat(body, rig, [suit])

# subtle wet sheen on the skin
for m in body.data.materials:
    if m and m.use_nodes:
        for n in m.node_tree.nodes:
            if n.type == "BSDF_PRINCIPLED":
                n.inputs["Coat Weight"].default_value = 0.15
                n.inputs["Coat Roughness"].default_value = 0.3

# ---------------------------------------------------------------- environment
cam_data = bpy.data.cameras.new("FilmCam")
cam = bpy.data.objects.new("FilmCam", cam_data)
scn.collection.objects.link(cam)
scn.camera = cam
if not NO_ENV:
    lamps, fog = env.build_environment()
    bpy.data.objects.remove(fog)        # fog is done in compositing (mist pass): far cheaper on CPU
else:
    w = bpy.data.worlds.new("W")
    scn.world = w
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[1].default_value = 0.2
    bpy.ops.mesh.primitive_plane_add(size=300)

# ---------------------------------------------------------------- animation
ctrls, steps = animation.animate(rig)

focus = bpy.data.objects.new("FocusHead", None)
scn.collection.objects.link(focus)
focus.parent = rig
focus.parent_type = "BONE"
focus.parent_bone = "head"
focus.location = (0, 0.0, -0.08)   # bone-tail space: roughly the eyes
animation.animate_camera(cam, rig, focus)

# timing data for the sound design (footstep landings, man + camera positions)
import json  # noqa: E402
track = {"steps": steps, "man": [], "cam": []}
for f in range(1, animation.FRAMES + 1):
    scn.frame_set(f)
    track["man"].append(list(rig.matrix_world.translation))
    track["cam"].append(list(cam.matrix_world.translation) + [list(cam.matrix_world.col[0][:3])])
with open(os.path.splitext(OUT)[0] + "_track.json", "w") as fh:
    json.dump(track, fh)

# character lights (motivated: shop window + lamp behind, rim from the street)
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
# warm key from the shop fronts on his right / ahead
key = area("KeyShop", 60, (1.0, 0.7, 0.45), 1.2, (0, 0, 0), face_target)
key.parent = rig
key.location = (-1.1, -1.6, 1.9)       # rig space (front is -Y)
# cool rim from behind-left (sky + distant lamps)
rim = area("RimCool", 80, (0.55, 0.68, 1.0), 0.8, (0, 0, 0), face_target)
rim.parent = rig
rim.location = (1.4, 1.8, 2.3)

# ---------------------------------------------------------------- cloth
if not NO_CLOTH:
    leg_proxy = coat.make_leg_proxy(suit, rig, rig.data.bones["thigh_l"].head_local.z + 0.05)
    cl = coat.add_cloth(coat_obj, [leg_proxy], animation.FRAMES)
    cache_dir = os.path.splitext(OUT)[0] + "_cache"
    os.makedirs(cache_dir, exist_ok=True)
    cl.point_cache.use_disk_cache = True
    bpy.ops.wm.save_as_mainfile(filepath=OUT)
    # simulate frame by frame (works headless, cache goes to disk next to the .blend)
    for f in range(1, animation.FRAMES + 1):
        scn.frame_set(f)
    print("CLOTH_SIM_DONE")
    with bpy.context.temp_override(scene=scn, point_cache=cl.point_cache):
        try:
            bpy.ops.ptcache.bake_from_cache()
        except Exception as e:
            print("bake_from_cache failed", e)

bpy.ops.wm.save_as_mainfile(filepath=OUT)
print("SAVED", OUT)
