"""Renders the 3D stylized host as a transparent PNG sequence.

Run with the bpy venv:
    OUT_DIR=<dir> FRAMES=<start>-<end> python host_layer.py

Frames are indexed by the global video timeline (30 fps), so frame N
is the host at t = N / 30 seconds. The HTML overlay picks frame N for the
same timestamp. Only the host window (18 s to 31 s) is rendered.
"""
import math
import os

import bpy
from mathutils import Vector

FPS = 30
WIDTH, HEIGHT = 1080, 1920  # full video resolution, matches the HTML canvas
OUT = os.environ["OUT_DIR"]
START, END = (int(x) for x in os.environ.get("FRAMES", "540-930").split("-"))


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.render.resolution_x = WIDTH
    scene.render.resolution_y = HEIGHT
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"

    shading = scene.display.shading
    shading.light = "STUDIO"
    shading.color_type = "MATERIAL"
    shading.show_shadows = True
    shading.shadow_intensity = 0.35
    shading.show_cavity = True
    shading.cavity_ridge_factor = 1.0
    shading.cavity_valley_factor = 1.0
    shading.show_object_outline = True
    shading.object_outline_color = (0.05, 0.03, 0.15)
    return scene


def material(name, rgb):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*rgb, 1.0)
    return mat


def add(kind, name, location, scale, mat, **kwargs):
    if kind == "sphere":
        bpy.ops.mesh.primitive_uv_sphere_add(radius=1, location=location, segments=48, ring_count=24)
    elif kind == "cylinder":
        bpy.ops.mesh.primitive_cylinder_add(radius=1, depth=2, location=location, vertices=32)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(mat)
    for key, value in kwargs.items():
        setattr(obj, key, value)
    return obj


def build_host():
    skin = material("skin", (1.00, 0.84, 0.68))
    hair = material("hair", (0.16, 0.08, 0.34))
    shirt = material("shirt", (1.00, 0.36, 0.62))
    pants = material("pants", (0.22, 0.14, 0.46))
    gold = material("gold", (1.00, 0.82, 0.25))
    cyan = material("cyan", (0.24, 0.88, 1.00))
    ink = material("ink", (0.05, 0.03, 0.12))

    parts = {}
    parts["torso"] = add("sphere", "torso", (0, 0, 0.9), (0.62, 0.42, 0.78), shirt)
    parts["head"] = add("sphere", "head", (0, 0, 2.05), (0.5, 0.5, 0.5), skin)
    parts["hair"] = add("sphere", "hair", (0, 0.06, 2.42), (0.52, 0.5, 0.26), hair)
    parts["eye_l"] = add("sphere", "eye_l", (-0.18, -0.45, 2.1), (0.05, 0.05, 0.05), ink)
    parts["eye_r"] = add("sphere", "eye_r", (0.18, -0.45, 2.1), (0.05, 0.05, 0.05), ink)
    parts["leg_l"] = add("cylinder", "leg_l", (-0.2, 0, -0.2), (0.14, 0.14, 0.62), pants)
    parts["leg_r"] = add("cylinder", "leg_r", (0.2, 0, -0.2), (0.14, 0.14, 0.62), pants)
    parts["arm_l"] = add("cylinder", "arm_l", (-0.72, 0, 0.95), (0.14, 0.14, 0.62), shirt)
    parts["arm_r"] = add("cylinder", "arm_r", (0.72, 0, 0.95), (0.14, 0.14, 0.62), shirt)
    parts["mic_handle"] = add("cylinder", "mic_handle", (0.8, -0.12, 1.2), (0.05, 0.05, 0.28), cyan)
    parts["mic_head"] = add("sphere", "mic_head", (0.8, -0.12, 1.55), (0.17, 0.17, 0.17), gold)
    return parts


def set_camera(scene):
    cam_data = bpy.data.cameras.new("cam")
    cam_data.lens = 50
    cam_data.sensor_fit = "VERTICAL"
    cam_data.shift_y = -0.10
    cam = bpy.data.objects.new("cam", cam_data)
    bpy.context.collection.objects.link(cam)
    cam.location = Vector((0, -13.0, 1.5))
    target = Vector((0, 0, 1.2))
    direction = target - cam.location
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam


def add_light():
    light_data = bpy.data.lights.new("sun", type="SUN")
    light_data.energy = 4.5
    light = bpy.data.objects.new("sun", light_data)
    bpy.context.collection.objects.link(light)
    light.rotation_euler = (math.radians(50), 0, math.radians(35))


def pose(parts, t):
    """Idle bob, arm sway and mic hold for time t (seconds)."""
    bob = math.sin(t * 4.0) * 0.06
    for name in ["torso", "head", "hair", "eye_l", "eye_r", "arm_l", "arm_r", "mic_handle", "mic_head"]:
        obj = parts[name]
        base = obj.location.copy()
        base.z = obj.get("base_z", base.z)
        obj["base_z"] = base.z
        obj.location.z = base.z + bob
    parts["arm_r"].rotation_euler = (math.radians(-18 + math.sin(t * 3.0) * 6), 0, math.radians(-30))
    parts["arm_l"].rotation_euler = (math.radians(10 + math.sin(t * 3.0 + 1.5) * 5), 0, math.radians(18))
    parts["head"].rotation_euler = (0, 0, math.radians(math.sin(t * 2.0) * 4))


def main():
    scene = reset_scene()
    parts = build_host()
    set_camera(scene)
    add_light()
    for frame in range(START, END):
        t = frame / FPS
        pose(parts, t - 18.3)  # host enters at 18.3 s; t counts from its entrance
        scene.render.filepath = os.path.join(OUT, f"host_{frame:04d}.png")
        bpy.ops.render.render(write_still=True)
        print("FRAME", frame, flush=True)


if __name__ == "__main__":
    main()
