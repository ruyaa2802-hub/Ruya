"""Re-key only the episode 2 camera on an already built .blend (no cloth re-simulation).

    blender -b ep2.blend -P recam.py
"""
import bpy
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import anim_ep2 as E  # noqa: E402
from mathutils import Vector  # noqa: E402
import bus  # noqa: E402

scn = bpy.context.scene
cam = scn.camera
cam.animation_data_clear()
cam.data.animation_data_clear()
scn.frame_set(E.FRAMES)
sign_world = bpy.data.objects["Bus"].matrix_world @ Vector((0.0, -1.045, bus.HEIGHT - 0.72))
E.animate_camera(cam, bpy.data.objects["ManRig"], sign_world)
bpy.ops.wm.save_mainfile()
print("RECAM_DONE")
