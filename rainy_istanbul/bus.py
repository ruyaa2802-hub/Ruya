"""City bus for episode 2: exterior shell, lit interior, front door, LED signs, wheels.

Local frame: front of the bus at local y=0, body extends to y=-LENGTH, centred on x=0.
The right side (+x) faces the kerb; the front door is on that side.
"""
import bpy
import math
from mathutils import Vector

import env

LENGTH = 12.0
WIDTH = 2.5
HEIGHT = 3.05
FLOOR = 0.36            # low-floor bus, interior floor height above the road
DOOR_Y = (-1.25, -2.35)  # front door opening (local y range)
X_CENTER = 1.0          # bus centre line in world x (right lane, door side next to the kerb)


def glass_material():
    m, n, l = env.mat("BusGlass")
    n.remove(n["Principled BSDF"])
    tr = n.new("ShaderNodeBsdfTransparent")
    tr.inputs["Color"].default_value = (0.82, 0.86, 0.85, 1)
    gl = n.new("ShaderNodeBsdfGlossy")
    gl.inputs["Roughness"].default_value = 0.03
    fr = n.new("ShaderNodeLayerWeight")
    fr.inputs["Blend"].default_value = 0.25
    mix = n.new("ShaderNodeMixShader")
    l.new(fr.outputs["Fresnel"], mix.inputs[0])
    l.new(tr.outputs[0], mix.inputs[1])
    l.new(gl.outputs[0], mix.inputs[2])
    l.new(mix.outputs[0], n["Material Output"].inputs["Surface"])
    m.blend_method = "BLEND"
    return m


def led_text(name, text, size, loc, rot, parent, strength=6.0, color=(1.0, 0.55, 0.08)):
    cu = bpy.data.curves.new(name, "FONT")
    cu.body = text
    cu.size = size
    cu.align_x = "CENTER"
    cu.align_y = "CENTER"
    o = bpy.data.objects.new(name, cu)
    bpy.context.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = rot
    o.parent = parent
    o.data.materials.append(env.emission_material(name + "Mat", color, strength))
    return o


def build_bus(name="Bus"):
    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)
    paint = env.simple_material("BusPaint", (0.78, 0.79, 0.78), 0.18)
    paint.node_tree.nodes["Principled BSDF"].inputs["Coat Weight"].default_value = 0.6
    stripe = env.simple_material("BusStripe", (0.45, 0.03, 0.03), 0.25)
    dark = env.simple_material("BusDark", (0.015, 0.015, 0.017), 0.45)
    rubber = env.simple_material("Tyre", (0.012, 0.012, 0.012), 0.7)
    rim = env.simple_material("Rim", (0.5, 0.5, 0.52), 0.3, 0.8)
    floor_m = env.simple_material("BusFloor", (0.08, 0.08, 0.075), 0.6)
    pole_m = env.simple_material("BusPole", (0.85, 0.62, 0.05), 0.25, 0.3)
    seat_m = env.simple_material("BusSeat", (0.04, 0.07, 0.2), 0.8)
    trim_m = env.simple_material("BusTrim", (0.55, 0.56, 0.58), 0.6)
    glass = glass_material()
    ceiling_light = env.emission_material("BusCeilingLight", (0.85, 0.95, 1.0), 3.0)
    head_m = env.emission_material("Headlight", (1.0, 0.95, 0.85), 30.0)
    tail_m = env.emission_material("Taillight", (1.0, 0.04, 0.02), 25.0)

    parts = []

    def B(size, loc, m):
        o = env.box("BusPart", size, loc, m)
        parts.append(o)
        return o

    L, W, H = LENGTH, WIDTH, HEIGHT
    yc = -L / 2
    # floor slab / underbody and roof
    B((W, L, 0.22), (0, yc, 0.25), dark)
    B((W - 0.08, L - 0.1, 0.02), (0, yc, FLOOR), floor_m)
    B((W, L, 0.3), (0, yc, H - 0.15), paint)
    B((W - 0.1, L - 0.2, 0.02), (0, yc, H - 0.52), trim_m)          # ceiling panel
    for k in range(5):                                               # light strips
        for sx in (-1, 1):
            o = env.box("BusLightStrip", (0.12, 1.6, 0.02), (sx * 0.75, -1.8 - k * 2.0, H - 0.535), ceiling_light)
            o.parent = root
    # side walls: lower panel, window band with pillars, upper band
    for side in (-1, 1):
        x = side * (W / 2 - 0.03)
        door = side == 1
        # lower panel (skip the door opening on the kerb side)
        segs = [(0.0, -L)] if not door else [(0.0, DOOR_Y[0]), (DOOR_Y[1], -L)]
        for (y0, y1) in segs:
            B((0.06, abs(y1 - y0), 0.75), (x, (y0 + y1) / 2, 0.36 + 0.375), paint)
            B((0.065, abs(y1 - y0), 0.14), (x, (y0 + y1) / 2, 0.6), stripe)
            B((0.05, abs(y1 - y0), 1.25), (x * 0.99, (y0 + y1) / 2, 1.115 + 0.625), glass)
        B((0.06, L, 0.48), (x, yc, H - 0.54), paint)
        # pillars
        y = -0.15
        while y > -L:
            if not (door and DOOR_Y[1] - 0.05 < y < DOOR_Y[0] + 0.05):
                B((0.07, 0.09, 1.3), (x, y, 1.75), paint)
            y -= 1.7
    # door frame posts
    for y in DOOR_Y:
        B((0.08, 0.08, H - 0.6), (W / 2 - 0.03, y, (H - 0.6) / 2 + 0.3), trim_m)
    # front: windscreen, lower panel, destination sign housing
    B((W, 0.06, 0.8), (0, -0.03, 0.75), paint)
    B((W - 0.1, 0.04, 1.35), (0, -0.02, 1.85), glass)
    B((W, 0.07, 0.35), (0, -0.03, H - 0.25), dark)
    # rear
    B((W, 0.06, 1.0), (0, -L + 0.03, 0.85), paint)
    B((W - 0.2, 0.04, 1.1), (0, -L + 0.02, 1.95), glass)
    B((W, 0.07, 0.35), (0, -L + 0.03, H - 0.25), dark)
    # driver cab + dashboard (front left)
    B((0.9, 1.0, 0.95), (-0.75, -0.65, FLOOR + 0.47), dark)
    B((0.06, 0.6, 1.5), (-0.28, -1.3, FLOOR + 0.75), trim_m)          # cab partition
    # seats (facing forward) on both sides behind the door area
    for k in range(5):
        y = -3.4 - k * 1.55
        for sx in (-1, 1):
            if sx == 1 and k == 0:
                continue
            B((0.85, 0.45, 0.12), (sx * 0.72, y, FLOOR + 0.45), seat_m)
            B((0.85, 0.1, 0.55), (sx * 0.72, y - 0.22, FLOOR + 0.75), seat_m)
    bodyobj = env.join(parts, "BusBody")
    bodyobj.parent = root
    for p in bodyobj.data.polygons:
        p.use_smooth = False
    bev = bodyobj.modifiers.new("Bevel", "BEVEL")
    bev.width = 0.012
    bev.segments = 2

    # handrails / poles
    poles = []
    for y in (-2.6, -4.2, -5.8, -7.4, -9.0):
        for sx in (-1, 1):
            bpy.ops.mesh.primitive_cylinder_add(radius=0.02, depth=H - 0.9, location=(sx * 0.28, y, FLOOR + (H - 0.9) / 2))
            poles.append(bpy.context.active_object)
    for sx in (-1, 1):
        bpy.ops.mesh.primitive_cylinder_add(radius=0.018, depth=L - 2.4, location=(sx * 0.55, yc - 1.0, H - 0.75),
                                            rotation=(math.pi / 2, 0, 0))
        poles.append(bpy.context.active_object)
    for p in poles:
        p.data.materials.append(pole_m)
    po = env.join(poles, "BusPoles")
    po.parent = root

    # front door leaves (plug doors): animated by the caller via door_open(frac)
    leaves = []
    dw = abs(DOOR_Y[0] - DOOR_Y[1]) / 2
    for i, sgn in enumerate((1, -1)):
        yl = (DOOR_Y[0] + DOOR_Y[1]) / 2 + sgn * dw / 2
        lp = []
        lp.append(env.box("DoorFrame", (0.05, dw - 0.02, H - 0.65), (0, 0, 0), trim_m))
        lp.append(env.box("DoorGlass", (0.055, dw - 0.16, H - 1.05), (0.002, 0, 0.12), glass))
        leaf = env.join(lp, f"DoorLeaf{i}")
        leaf.parent = root
        leaf.location = (W / 2 - 0.02, yl, (H - 0.65) / 2 + 0.32)
        leaf["rest_y"] = yl
        leaf["sgn"] = sgn
        leaves.append(leaf)

    # wheels
    wheels = []
    for y in (-2.6, -8.6):
        for sx in (-1, 1):
            bpy.ops.mesh.primitive_cylinder_add(radius=0.5, depth=0.3, location=(sx * (W / 2 - 0.12), y, 0.5),
                                                rotation=(0, math.pi / 2, 0))
            w = bpy.context.active_object
            w.data.materials.append(rubber)
            bpy.ops.mesh.primitive_cylinder_add(radius=0.3, depth=0.31, location=(sx * (W / 2 - 0.12), y, 0.5),
                                                rotation=(0, math.pi / 2, 0))
            r = bpy.context.active_object
            r.data.materials.append(rim)
            wh = env.join([w, r], "Wheel")
            wh.parent = root
            bpy.context.view_layer.objects.active = wh
            bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY")
            wh.rotation_mode = "XYZ"
            wheels.append(wh)

    # lights
    for sx in (-1, 1):
        o = env.box("Headlamp", (0.35, 0.03, 0.16), (sx * 0.85, 0.005, 0.75), head_m)
        o.parent = root
        o = env.box("Taillamp", (0.18, 0.03, 0.45), (sx * 1.05, -L - 0.005, 1.0), tail_m)
        o.parent = root
        sd = bpy.data.lights.new("HeadBeam", "SPOT")
        sd.energy = 900
        sd.spot_size = math.radians(55)
        sd.spot_blend = 0.6
        sd.color = (1.0, 0.92, 0.8)
        so = bpy.data.objects.new("HeadBeam", sd)
        bpy.context.collection.objects.link(so)
        so.parent = root
        so.location = (sx * 0.85, 0.3, 0.8)
        so.rotation_euler = (math.radians(80), 0, 0)   # spot looks down -Z -> tilt to +Y
        td = bpy.data.lights.new("TailGlow", "POINT")
        td.energy = 25
        td.color = (1.0, 0.05, 0.02)
        td.shadow_soft_size = 0.2
        to = bpy.data.objects.new("TailGlow", td)
        bpy.context.collection.objects.link(to)
        to.parent = root
        to.location = (sx * 1.05, -L - 0.25, 1.0)
    # interior fill lights (cool fluorescent)
    for k, y in enumerate((-2.0, -6.0, -10.0)):
        ad = bpy.data.lights.new("BusInterior", "AREA")
        ad.energy = 45
        ad.size = 1.6
        ad.color = (0.82, 0.92, 1.0)
        ao = bpy.data.objects.new("BusInterior", ad)
        bpy.context.collection.objects.link(ao)
        ao.parent = root
        ao.location = (0, y, H - 0.6)

    # LED destination signs (exterior rear + interior front)
    led_text("RearSign", "13", 0.28, (0, -L - 0.04, H - 0.25), (math.pi / 2, 0, 0), root)
    led_text("FrontSign", "13", 0.24, (0, 0.01, H - 0.25), (math.pi / 2, 0, math.pi), root)
    box_in = env.box("InnerSignBox", (1.25, 0.08, 0.34), (0.0, -1.0, H - 0.72), dark)
    box_in.parent = root
    inner = led_text("InnerSign", "SONRAKİ DURAK:\nÇIKTIĞIN EV", 0.105, (0.0, -1.045, H - 0.72), (math.pi / 2, 0, 0), root,
                     strength=9.0)
    inner.data.space_line = 1.05
    return root, leaves, wheels


def door_open(leaves, frac, frame):
    """Plug doors: swing out a little, then slide apart along the body."""
    out = min(1.0, frac * 3.0) * 0.07
    slide = max(0.0, (frac - 0.2) / 0.8)
    dw = abs(DOOR_Y[0] - DOOR_Y[1]) / 2
    for leaf in leaves:
        leaf.location.x = WIDTH / 2 - 0.02 + out
        leaf.location.y = leaf["rest_y"] + leaf["sgn"] * slide * (dw * 0.92)
        leaf.keyframe_insert("location", frame=frame)
