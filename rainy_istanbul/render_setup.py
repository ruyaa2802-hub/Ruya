"""Render settings, compositor fog/glow, camera export. Run on the built .blend:

    blender -b scene.blend -P render_setup.py -- OUT_DIR START END [percent] [samples]
"""
import bpy
import sys
import os
import json

argv = sys.argv[sys.argv.index("--") + 1:]
OUT = argv[0]
START, END = int(argv[1]), int(argv[2])
PCT = int(argv[3]) if len(argv) > 3 else 100
SPP = int(argv[4]) if len(argv) > 4 else 16
os.makedirs(os.path.join(OUT, "beauty"), exist_ok=True)
os.makedirs(os.path.join(OUT, "mist"), exist_ok=True)

scn = bpy.context.scene
r = scn.render
r.engine = "CYCLES"
r.resolution_x, r.resolution_y = 1080, 1920
r.resolution_percentage = PCT
r.fps = 30
r.use_motion_blur = True
r.motion_blur_shutter = 0.5
r.use_persistent_data = True
r.film_transparent = False
r.image_settings.file_format = "PNG"
r.image_settings.color_depth = "16"
r.filepath = os.path.join(OUT, "beauty", "f_")
c = scn.cycles
c.device = "CPU"
c.samples = SPP
c.use_adaptive_sampling = True
c.adaptive_threshold = 0.05
c.denoising_prefilter = "FAST"
c.adaptive_min_samples = 6
c.use_denoising = True
c.denoiser = "OPENIMAGEDENOISE"
c.denoising_input_passes = "RGB_ALBEDO_NORMAL"
c.max_bounces = 4
c.diffuse_bounces = 1
c.glossy_bounces = 2
c.transmission_bounces = 2
c.transparent_max_bounces = 6
c.volume_bounces = 0
c.sample_clamp_indirect = 4.0
c.light_sampling_threshold = 0.02
c.use_light_tree = True
c.caustics_reflective = False
c.caustics_refractive = False
c.blur_glossy = 1.0
scn.view_settings.view_transform = "AgX"
scn.view_settings.look = "AgX - Medium High Contrast"
scn.view_settings.exposure = 0.0

# mist pass = depth for fog + rain occlusion
vl = scn.view_layers[0]
vl.use_pass_mist = True
w = scn.world
w.mist_settings.start = 1.0
w.mist_settings.depth = 120.0
w.mist_settings.falloff = "LINEAR"

# ---------------------------------------------------------------- compositor
scn.use_nodes = True
nt = scn.node_tree
for n in list(nt.nodes):
    nt.nodes.remove(n)
N, L = nt.nodes, nt.links
rl = N.new("CompositorNodeRLayers")
# fog colour = heavily blurred frame (light scattered by the fog) + night base
blur = N.new("CompositorNodeBlur")
blur.filter_type = "FAST_GAUSS"
blur.use_relative = True
blur.factor_x = blur.factor_y = 0.09
L.new(rl.outputs["Image"], blur.inputs["Image"])
scat = N.new("CompositorNodeMixRGB")
scat.blend_type = "ADD"
scat.inputs[0].default_value = 1.0
scat.inputs[2].default_value = (0.010, 0.013, 0.020, 1)
mulb = N.new("CompositorNodeMixRGB")
mulb.blend_type = "MULTIPLY"
mulb.inputs[0].default_value = 1.0
mulb.inputs[2].default_value = (0.8, 0.8, 0.85, 1)
L.new(blur.outputs[0], mulb.inputs[1])
L.new(mulb.outputs[0], scat.inputs[1])
# fog amount from mist
fogamt = N.new("CompositorNodeMath")
fogamt.operation = "POWER"
fogamt.inputs[1].default_value = 0.55
L.new(rl.outputs["Mist"], fogamt.inputs[0])
fogmul = N.new("CompositorNodeMath")
fogmul.operation = "MULTIPLY"
fogmul.inputs[1].default_value = 0.8
fogmul.use_clamp = True
L.new(fogamt.outputs[0], fogmul.inputs[0])
fogmix = N.new("CompositorNodeMixRGB")
L.new(fogmul.outputs[0], fogmix.inputs[0])
L.new(rl.outputs["Image"], fogmix.inputs[1])
L.new(scat.outputs[0], fogmix.inputs[2])
# bloom / halation around lights
glare = N.new("CompositorNodeGlare")
glare.glare_type = "FOG_GLOW"
glare.quality = "MEDIUM"
glare.threshold = 0.8
glare.size = 8
glare.mix = -0.55
L.new(fogmix.outputs[0], glare.inputs["Image"])
lens = N.new("CompositorNodeLensdist")
lens.inputs[1].default_value = -0.008
lens.inputs[2].default_value = 0.006
L.new(glare.outputs[0], lens.inputs["Image"])
comp = N.new("CompositorNodeComposite")
L.new(lens.outputs[0], comp.inputs["Image"])
fo = N.new("CompositorNodeOutputFile")
fo.base_path = os.path.join(OUT, "mist")
fo.format.file_format = "PNG"
fo.format.color_mode = "BW"
fo.format.color_depth = "16"
fo.file_slots[0].path = "m_"
L.new(rl.outputs["Mist"], fo.inputs[0])

# ---------------------------------------------------------------- camera export for the rain pass
cam = scn.camera
cams = {}
for f in range(1, scn.frame_end + 1):
    scn.frame_set(f)
    mw = cam.matrix_world
    cams[f] = dict(m=[list(row) for row in mw], lens=cam.data.lens, sensor=cam.data.sensor_width,
                   focus=cam.data.dof.focus_distance,
                   fstop=cam.data.dof.aperture_fstop)
with open(os.path.join(OUT, "camera.json"), "w") as fh:
    json.dump(cams, fh)

scn.frame_start, scn.frame_end = START, END
bpy.ops.render.render(animation=True)
print("RENDER_DONE")
