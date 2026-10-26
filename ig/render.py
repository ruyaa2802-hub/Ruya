"""Render presets and camera helpers (Cycles CPU, tuned for short render times)."""
import math

import bpy
from mathutils import Vector

from .util import link

PRESETS = {
    # name: (width, height, samples, adaptive threshold)
    # 'final' renders 720x1280 and is upscaled to 1080x1920 at encode time: on a
    # 4-core CPU this keeps a 30 s short to a few hours. Use 'hq' with a GPU.
    "draft": (360, 640, 8, 0.1),
    "preview": (540, 960, 10, 0.08),
    "test": (720, 1280, 12, 0.08),
    "final": (720, 1280, 12, 0.07),
    "hq": (1080, 1920, 64, 0.03),
}


def setup(preset="preview", fps=24):
    sc = bpy.context.scene
    w, h, samples, thresh = PRESETS[preset]
    r = sc.render
    r.engine = "CYCLES"
    r.resolution_x, r.resolution_y, r.resolution_percentage = w, h, 100
    r.fps = fps
    r.use_persistent_data = True
    r.film_transparent = False
    cy = sc.cycles
    cy.device = "CPU"
    cy.samples = samples
    cy.use_adaptive_sampling = True
    cy.adaptive_threshold = thresh
    cy.adaptive_min_samples = 8
    cy.use_denoising = True
    cy.denoiser = "OPENIMAGEDENOISE"
    try:
        cy.denoising_input_passes = "RGB_ALBEDO_NORMAL"
        cy.denoising_prefilter = "ACCURATE" if preset == "hq" else "FAST"
    except (AttributeError, TypeError):
        pass
    cy.max_bounces = 4 if preset == "hq" else 3
    cy.diffuse_bounces = 2
    cy.glossy_bounces = 1
    cy.transmission_bounces = 2
    cy.transparent_max_bounces = 4
    if preset != "hq":
        # approximate the last indirect bounces with AO: big win on CPU, barely visible here
        cy.use_fast_gi = True
        cy.ao_bounces_render = 1
    cy.caustics_reflective = False
    cy.caustics_refractive = False
    cy.sample_clamp_indirect = 6.0
    cy.blur_glossy = 1.0
    cy.use_light_tree = True
    try:
        sc.cycles.texture_limit_render = "2048"
    except (AttributeError, TypeError):
        pass
    vs = sc.view_settings
    vs.view_transform = "AgX"
    for look in ("AgX - Medium High Contrast", "Medium High Contrast", "AgX - Base Contrast"):
        try:
            vs.look = look
            break
        except TypeError:
            continue
    vs.exposure = 0.0
    r.image_settings.file_format = "PNG"
    r.image_settings.color_mode = "RGB"
    return sc


def camera(name, loc, target, lens=35, fstop=2.8, focus=None):
    cam = bpy.data.cameras.new(name)
    cam.lens = lens
    cam.sensor_fit = "VERTICAL"
    cam.sensor_height = 24.0
    cam.dof.use_dof = True
    cam.dof.aperture_fstop = fstop
    cam.clip_start = 0.02
    obj = bpy.data.objects.new(name, cam)
    link(obj)
    aim(obj, loc, target, focus)
    return obj


def aim(obj, loc, target, focus=None, roll=0.0):
    obj.location = loc
    d = Vector(target) - Vector(loc)
    q = d.to_track_quat("-Z", "Y")
    e = q.to_euler()
    if roll:
        e.rotate_axis("Z", roll)
    obj.rotation_euler = e
    obj.data.dof.focus_distance = (Vector(focus or target) - Vector(loc)).length


def face_frame(char, dist=0.8, yaw=0.0, height=0.0, look=(0.0, 0.0, 0.0)):
    """Camera (location, target) framing a character's face.

    yaw: degrees around the character (+ = toward its left / screen right),
    height: camera rise in meters, look: world offset added to the target.
    """
    bpy.context.view_layer.update()
    pos = char.face.anchor.matrix_world.translation.copy()
    fwd = -(char.arm.matrix_world.to_3x3() @ Vector((0, 1, 0)))     # body facing, ignores head turns
    fwd.z = 0
    fwd.normalize()
    a = math.radians(yaw)
    d = Vector((fwd.x * math.cos(a) - fwd.y * math.sin(a), fwd.x * math.sin(a) + fwd.y * math.cos(a), 0))
    loc = pos + d * dist + Vector((0, 0, height))
    return tuple(loc), tuple(pos + Vector(look))
