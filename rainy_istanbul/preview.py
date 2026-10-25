"""Fast motion preview (animatic): Workbench, low resolution, every Nth frame.

    blender -b scene.blend -P preview.py -- OUT_DIR [step] [percent]
Checks timing, camera cuts and character motion in minutes instead of hours.
"""
import bpy
import sys
import os

argv = sys.argv[sys.argv.index("--") + 1:]
OUT = argv[0]
STEP = int(argv[1]) if len(argv) > 1 else 2
PCT = int(argv[2]) if len(argv) > 2 else 25
os.makedirs(OUT, exist_ok=True)
scn = bpy.context.scene
scn.render.engine = "BLENDER_WORKBENCH"
scn.render.resolution_x, scn.render.resolution_y = 1080, 1920
scn.render.resolution_percentage = PCT
scn.frame_step = STEP
sh = scn.display.shading
sh.light = "STUDIO"
sh.color_type = "MATERIAL"
sh.show_shadows = True
sh.show_cavity = False
scn.render.use_motion_blur = False
scn.use_nodes = False
scn.render.image_settings.file_format = "PNG"
scn.render.filepath = os.path.join(OUT, "w_")
bpy.ops.render.render(animation=True)
print("PREVIEW_DONE")
