"""Environment: wet Istanbul street at night (buildings, cobbles, lamps, fog, rain).

Imported by build_scene.py inside Blender. Street runs along +Y, centred on x=0.
"""
import bpy
import math
import random
from mathutils import Vector

STREET_HALF = 4.6      # building facade x position
WALK_X = 3.15          # sidewalk line the man walks on (right side)
CURB_X = 2.35
CURB_H = 0.14


def mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    return m, m.node_tree.nodes, m.node_tree.links


def bsdf(m):
    return m.node_tree.nodes["Principled BSDF"]


# ---------------------------------------------------------------- materials

def wet_ground_material(name, cobble=True):
    m, n, l = mat(name)
    b = bsdf(m)
    tc = n.new("ShaderNodeTexCoord")
    # cobble / tile pattern
    if cobble:
        vor = n.new("ShaderNodeTexVoronoi")
        vor.feature = "DISTANCE_TO_EDGE"
        vor.inputs["Scale"].default_value = 9.0
        vor.inputs["Randomness"].default_value = 0.55
        l.new(tc.outputs["Object"], vor.inputs["Vector"])
        edge = n.new("ShaderNodeMapRange")
        edge.inputs["From Min"].default_value = 0.0
        edge.inputs["From Max"].default_value = 0.09
        l.new(vor.outputs["Distance"], edge.inputs["Value"])
        stone_col = n.new("ShaderNodeTexVoronoi")
        stone_col.inputs["Scale"].default_value = 9.0
        stone_col.inputs["Randomness"].default_value = 0.55
        l.new(tc.outputs["Object"], stone_col.inputs["Vector"])
        pattern = edge.outputs["Result"]
        cvar = stone_col.outputs["Color"]
    else:
        brick = n.new("ShaderNodeTexBrick")
        brick.inputs["Scale"].default_value = 2.2
        brick.inputs["Mortar Size"].default_value = 0.012
        brick.offset = 0.5
        brick.inputs["Color1"].default_value = (1, 1, 1, 1)
        brick.inputs["Color2"].default_value = (0.7, 0.7, 0.7, 1)
        brick.inputs["Mortar"].default_value = (0, 0, 0, 1)
        l.new(tc.outputs["Object"], brick.inputs["Vector"])
        pattern = brick.outputs["Fac"]
        cvar = brick.outputs["Color"]
    inv = n.new("ShaderNodeMath"); inv.operation = "SUBTRACT"
    inv.inputs[0].default_value = 1.0
    l.new(pattern, inv.inputs[1])
    # base colour: dark wet stone with per-stone variation
    sep = n.new("ShaderNodeSeparateColor")
    l.new(cvar, sep.inputs["Color"])
    ramp = n.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (0.018, 0.017, 0.016, 1)
    ramp.color_ramp.elements[1].color = (0.06, 0.055, 0.05, 1)
    l.new(sep.outputs["Red"], ramp.inputs["Fac"])
    # puddle mask from large noise
    pn = n.new("ShaderNodeTexNoise")
    pn.inputs["Scale"].default_value = 0.35
    pn.inputs["Detail"].default_value = 6
    pn.inputs["Roughness"].default_value = 0.6
    l.new(tc.outputs["Object"], pn.inputs["Vector"])
    pm = n.new("ShaderNodeMapRange")
    pm.inputs["From Min"].default_value = 0.5
    pm.inputs["From Max"].default_value = 0.56
    l.new(pn.outputs["Fac"], pm.inputs["Value"])
    # puddles also collect in the mortar gaps
    gap = n.new("ShaderNodeMath"); gap.operation = "MAXIMUM"
    l.new(pm.outputs["Result"], gap.inputs[0])
    gap2 = n.new("ShaderNodeMath"); gap2.operation = "MULTIPLY"
    gap2.inputs[1].default_value = 0.6
    l.new(inv.outputs[0], gap2.inputs[0])
    l.new(gap2.outputs[0], gap.inputs[1])
    # roughness: stone 0.28, water 0.02
    rough = n.new("ShaderNodeMapRange")
    rough.inputs["To Min"].default_value = 0.30
    rough.inputs["To Max"].default_value = 0.015
    l.new(gap.outputs[0], rough.inputs["Value"])
    l.new(rough.outputs["Result"], b.inputs["Roughness"])
    # colour darker in puddles
    mix = n.new("ShaderNodeMix"); mix.data_type = "RGBA"
    mix.inputs["B"].default_value = (0.008, 0.008, 0.009, 1)
    l.new(gap.outputs[0], mix.inputs["Factor"])
    l.new(ramp.outputs["Color"], mix.inputs["A"])
    l.new(mix.outputs["Result"], b.inputs["Base Color"])
    b.inputs["Specular IOR Level"].default_value = 0.6
    # rain ripples: animated voronoi rings in the puddles
    tm = n.new("ShaderNodeValue")
    tm.name = "rain_time"
    fc = tm.outputs[0].driver_add("default_value")
    fc.driver.expression = "frame/30.0"
    comb = n.new("ShaderNodeCombineXYZ")
    l.new(tm.outputs[0], comb.inputs["Z"])
    sc = n.new("ShaderNodeVectorMath"); sc.operation = "MULTIPLY"
    sc.inputs[1].default_value = (1, 1, 0)
    l.new(tc.outputs["Object"], sc.inputs[0])
    add = n.new("ShaderNodeVectorMath"); add.operation = "ADD"
    l.new(sc.outputs[0], add.inputs[0])
    l.new(comb.outputs[0], add.inputs[1])
    rip = n.new("ShaderNodeTexVoronoi")
    rip.voronoi_dimensions = "4D"
    rip.inputs["Scale"].default_value = 9.0
    l.new(add.outputs[0], rip.inputs["Vector"])
    l.new(tm.outputs[0], rip.inputs["W"])
    ring = n.new("ShaderNodeMath"); ring.operation = "SINE"
    rmul = n.new("ShaderNodeMath"); rmul.operation = "MULTIPLY"
    rmul.inputs[1].default_value = 60.0
    l.new(rip.outputs["Distance"], rmul.inputs[0])
    l.new(rmul.outputs[0], ring.inputs[0])
    fade = n.new("ShaderNodeMath"); fade.operation = "MULTIPLY"
    l.new(ring.outputs[0], fade.inputs[0])
    l.new(gap.outputs[0], fade.inputs[1])
    # combine bumps
    bump1 = n.new("ShaderNodeBump")
    bump1.inputs["Strength"].default_value = 0.22 if cobble else 0.2
    bump1.inputs["Distance"].default_value = 0.02
    l.new(pattern, bump1.inputs["Height"])
    bump2 = n.new("ShaderNodeBump")
    bump2.inputs["Strength"].default_value = 0.06
    bump2.inputs["Distance"].default_value = 0.002
    l.new(fade.outputs[0], bump2.inputs["Height"])
    l.new(bump1.outputs["Normal"], bump2.inputs["Normal"])
    l.new(bump2.outputs["Normal"], b.inputs["Normal"])
    return m


def facade_material(name, base):
    m, n, l = mat(name)
    b = bsdf(m)
    tc = n.new("ShaderNodeTexCoord")
    noise = n.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 1.5
    noise.inputs["Detail"].default_value = 10
    l.new(tc.outputs["Object"], noise.inputs["Vector"])
    ramp = n.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = tuple(c * 0.55 for c in base) + (1,)
    ramp.color_ramp.elements[1].color = tuple(base) + (1,)
    l.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    l.new(ramp.outputs["Color"], b.inputs["Base Color"])
    # rain streaks down the wall: wetter = smoother
    wn = n.new("ShaderNodeTexNoise")
    wn.inputs["Scale"].default_value = 3.0
    mp = n.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (6, 6, 0.4)
    l.new(tc.outputs["Object"], mp.inputs["Vector"])
    l.new(mp.outputs["Vector"], wn.inputs["Vector"])
    rr = n.new("ShaderNodeMapRange")
    rr.inputs["To Min"].default_value = 0.75
    rr.inputs["To Max"].default_value = 0.35
    l.new(wn.outputs["Fac"], rr.inputs["Value"])
    l.new(rr.outputs["Result"], b.inputs["Roughness"])
    bump = n.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.15
    l.new(noise.outputs["Fac"], bump.inputs["Height"])
    l.new(bump.outputs["Normal"], b.inputs["Normal"])
    return m


def emission_material(name, color, strength):
    m, n, l = mat(name)
    for node in list(n):
        if node.type != "OUTPUT_MATERIAL":
            n.remove(node)
    e = n.new("ShaderNodeEmission")
    e.inputs["Color"].default_value = tuple(color) + (1,)
    e.inputs["Strength"].default_value = strength
    l.new(e.outputs[0], n["Material Output"].inputs["Surface"])
    m.cycles.emission_sampling = "NONE"
    return m


def window_material(name, color, strength):
    """Lit window: warm emission behind a slightly glossy pane with curtain variation."""
    m, n, l = mat(name)
    b = bsdf(m)
    b.inputs["Base Color"].default_value = (0.02, 0.02, 0.02, 1)
    b.inputs["Roughness"].default_value = 0.05
    tc = n.new("ShaderNodeTexCoord")
    noise = n.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 3.0
    l.new(tc.outputs["Generated"], noise.inputs["Vector"])
    ramp = n.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = tuple(c * 0.35 for c in color) + (1,)
    ramp.color_ramp.elements[1].color = tuple(color) + (1,)
    l.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    l.new(ramp.outputs["Color"], b.inputs["Emission Color"])
    b.inputs["Emission Strength"].default_value = strength
    m.cycles.emission_sampling = "NONE"
    return m


def simple_material(name, color, rough=0.5, metal=0.0):
    m, n, l = mat(name)
    b = bsdf(m)
    b.inputs["Base Color"].default_value = tuple(color) + (1,)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    return m


# ---------------------------------------------------------------- geometry helpers

def box(name, size, loc, material, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    o.data.materials.append(material)
    return o


def join(objs, name):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.active_object
    o.name = name
    return o


# ---------------------------------------------------------------- street pieces

def build_ground(length):
    road = wet_ground_material("WetCobble", cobble=True)
    walk = wet_ground_material("WetSidewalk", cobble=False)
    curb = simple_material("Curb", (0.08, 0.08, 0.08), 0.25)
    y0, y1 = -30, length
    cy, ly = (y0 + y1) / 2, (y1 - y0)
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, cy, 0))
    r = bpy.context.active_object
    r.name = "Road"
    r.scale = (CURB_X * 2, ly, 1)
    bpy.ops.object.transform_apply(scale=True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.subdivide(number_cuts=20)
    bpy.ops.object.mode_set(mode="OBJECT")
    r.data.materials.append(road)
    for s in (-1, 1):
        w = box("Sidewalk", (STREET_HALF - CURB_X, ly, CURB_H),
                (s * (CURB_X + STREET_HALF) / 2, cy, CURB_H / 2), walk)
        box("CurbStone", (0.16, ly, CURB_H + 0.01), (s * CURB_X, cy, CURB_H / 2), curb)
    # far ground extending to the distant lights
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, y1 + 200, 0))
    f = bpy.context.active_object
    f.name = "FarGround"
    f.scale = (120, 400, 1)
    f.data.materials.append(road)


FACADE_COLORS = [
    (0.42, 0.30, 0.20), (0.35, 0.33, 0.30), (0.40, 0.22, 0.16), (0.30, 0.32, 0.30),
    (0.45, 0.38, 0.28), (0.25, 0.22, 0.20), (0.38, 0.28, 0.25), (0.33, 0.30, 0.24),
]
WARM = [(1.0, 0.62, 0.30), (1.0, 0.72, 0.42), (1.0, 0.55, 0.25), (0.95, 0.80, 0.60)]
COOL = [(0.55, 0.70, 1.0)]


def build_buildings(length, rng):
    window_mats = [window_material(f"Window{i}", c, rng.uniform(0.35, 1.1)) for i, c in enumerate(WARM * 2)]
    window_mats.append(window_material("WindowTV", COOL[0], 0.6))
    dark_glass = simple_material("DarkGlass", (0.01, 0.012, 0.015), 0.04)
    frame = simple_material("WoodFrame", (0.06, 0.04, 0.03), 0.6)
    shop_mats = [window_material(f"Shop{i}", c, rng.uniform(0.08, 0.18)) for i, c in enumerate(WARM)]
    ledge_mat = simple_material("Ledge", (0.15, 0.14, 0.13), 0.5)
    roof_mat = simple_material("Roof", (0.03, 0.02, 0.02), 0.6)
    facades = [facade_material(f"Facade{i}", c) for i, c in enumerate(FACADE_COLORS)]

    for side in (-1, 1):
        y = -28.0
        while y < length:
            w = rng.uniform(6, 11)
            floors = rng.randint(3, 6)
            fh = 3.1
            h = 0.5 + floors * fh
            depth = 10
            x = side * (STREET_HALF + depth / 2 + rng.uniform(-0.15, 0.25))
            parts = [box("Bldg", (depth, w - 0.05, h), (x, y + w / 2, h / 2), rng.choice(facades))]
            fx = side * (STREET_HALF + rng.uniform(-0.15, 0.25))  # facade plane
            face_x = x - side * depth / 2
            # cornice
            parts.append(box("Cornice", (0.5, w, 0.35), (face_x - side * 0.2, y + w / 2, h - 0.1), ledge_mat))
            parts.append(box("RoofCap", (depth, w, 0.6), (x, y + w / 2, h + 0.3), roof_mat))
            nwin = max(2, int(w / 2.2))
            # bay window (cumba) on upper floors, very Istanbul
            has_cumba = rng.random() < 0.55 and floors >= 3
            cumba_c = y + w / 2
            for f in range(floors):
                z = 0.5 + f * fh
                parts.append(box("Ledge", (0.25, w, 0.12), (face_x - side * 0.1, y + w / 2, z + 0.02), ledge_mat))
                if f == 0:
                    # ground floor shop front
                    if rng.random() < 0.6:
                        sm = rng.choice(shop_mats)
                        box("ShopGlass", (0.05, w * 0.7, 2.2), (face_x - side * 0.03, y + w / 2, 1.35), sm)
                        box("Awning", (1.1, w * 0.75, 0.06), (face_x - side * 0.55, y + w / 2, 2.75),
                            simple_material("Awning", rng.choice([(0.25, 0.03, 0.03), (0.05, 0.12, 0.08), (0.08, 0.06, 0.04)]), 0.35),
                            rot=(0, side * 0.25, 0))
                    continue
                for i in range(nwin):
                    wy = y + (i + 0.5) * w / nwin
                    if has_cumba and f >= 1 and abs(wy - cumba_c) < w * 0.28:
                        continue
                    lit = rng.random() < 0.38
                    wm = rng.choice(window_mats) if lit else dark_glass
                    box("Win", (0.06, 1.0, 1.6), (face_x - side * 0.01, wy, z + 1.4), wm)
                    box("WinFrame", (0.12, 1.15, 0.1), (face_x - side * 0.04, wy, z + 0.55), frame)
                    box("WinTop", (0.12, 1.15, 0.12), (face_x - side * 0.04, wy, z + 2.25), frame)
                    if rng.random() < 0.3:  # shutters
                        for s2 in (-1, 1):
                            box("Shutter", (0.05, 0.45, 1.65), (face_x - side * 0.08, wy + s2 * 0.75, z + 1.4), frame)
            if has_cumba:
                cw = w * 0.5
                ch = (floors - 1) * fh - 0.4
                cz = 0.5 + fh + ch / 2 + 0.1
                parts.append(box("Cumba", (0.9, cw, ch), (face_x - side * 0.45, cumba_c, cz), rng.choice(facades)))
                for f in range(1, floors):
                    z = 0.5 + f * fh
                    lit = rng.random() < 0.5
                    for k in range(3):
                        wy = cumba_c + (k - 1) * cw / 3.2
                        box("CumbaWin", (0.05, cw / 3.8, 1.5), (face_x - side * 0.91, wy, z + 1.45),
                            rng.choice(window_mats) if lit else dark_glass)
            join(parts, "Building")
            y += w + (rng.uniform(0.3, 1.5) if rng.random() < 0.25 else 0.0)


def build_lamps(length, rng):
    pole_mat = simple_material("LampPole", (0.02, 0.02, 0.022), 0.35, 0.8)
    glow = emission_material("LampGlow", (1.0, 0.68, 0.36), 40.0)
    lamps = []
    y = -20
    i = 0
    while y < length + 60:
        side = 1 if i % 2 == 0 else -1
        x = side * (CURB_X + 0.45)
        parts = []
        bpy.ops.mesh.primitive_cylinder_add(radius=0.06, depth=4.6, location=(x, y, 2.3 + CURB_H))
        parts.append(bpy.context.active_object)
        bpy.ops.mesh.primitive_cylinder_add(radius=0.035, depth=0.9, location=(x - side * 0.4, y, 4.55 + CURB_H),
                                            rotation=(0, math.pi / 2, 0))
        parts.append(bpy.context.active_object)
        for p in parts:
            p.data.materials.append(pole_mat)
        pole = join(parts, "LampPole")
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.17, location=(x - side * 0.8, y, 4.35 + CURB_H))
        g = bpy.context.active_object
        g.name = "LampBulb"
        g.data.materials.append(glow)
        bpy.ops.object.shade_smooth()
        # actual light source (only where it can matter for the shot)
        if y > 75:
            y += rng.uniform(11, 14)
            i += 1
            continue
        ld = bpy.data.lights.new("LampLight", "POINT")
        ld.energy = rng.uniform(380, 520)
        ld.color = (1.0, 0.66, 0.36)
        ld.shadow_soft_size = 0.2
        lo = bpy.data.objects.new("LampLight", ld)
        lo.location = (x - side * 0.8, y, 4.2 + CURB_H)
        bpy.context.collection.objects.link(lo)
        lamps.append(lo)
        y += rng.uniform(11, 14)
        i += 1
    return lamps


def build_distant_city(length):
    """Distant lights at the end of the street: a mosque silhouette on a hill + city lights."""
    stone = simple_material("MosqueStone", (0.25, 0.22, 0.2), 0.7)
    flood = emission_material("MosqueFlood", (1.0, 0.62, 0.32), 0.35)
    yb = length + 170
    zb = 18
    parts = []
    bpy.ops.mesh.primitive_cylinder_add(radius=16, depth=12, location=(0, yb, zb + 6))
    parts.append(bpy.context.active_object)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=14, location=(0, yb, zb + 12))
    parts.append(bpy.context.active_object)
    for dx in (-17, 17):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=7, location=(dx, yb, zb + 8))
        parts.append(bpy.context.active_object)
    dome = join(parts, "Mosque")
    dome.data.materials.append(flood)
    for dx in (-30, 30, -24, 24):
        bpy.ops.mesh.primitive_cylinder_add(radius=1.0, depth=52, location=(dx, yb + (8 if abs(dx) < 28 else -8), zb + 26))
        mn = bpy.context.active_object
        mn.data.materials.append(flood)
        bpy.ops.mesh.primitive_cone_add(radius1=1.3, depth=7, location=(dx, mn.location.y, zb + 55.5))
        bpy.context.active_object.data.materials.append(flood)
    # hill
    bpy.ops.mesh.primitive_uv_sphere_add(radius=60, location=(0, yb + 15, zb - 52))
    hill = bpy.context.active_object
    hill.scale = (3, 1, 1.15)
    hill.data.materials.append(simple_material("Hill", (0.02, 0.02, 0.025), 0.9))
    # scattered city lights on the hill
    rng = random.Random(7)
    city = [emission_material(f"CityLight{i}", c, rng.uniform(15, 40)) for i, c in enumerate(WARM + COOL)]
    for _ in range(260):
        x = rng.uniform(-150, 150)
        y = yb + rng.uniform(-50, 20)
        z = rng.uniform(1, max(2, 14 - abs(x) * 0.07))
        bpy.ops.mesh.primitive_cube_add(size=rng.uniform(0.5, 1.2), location=(x, y, z))
        bpy.context.active_object.data.materials.append(rng.choice(city))


def build_fog(length):
    """Low-density volume over the street; gives lamp halos and depth falloff."""
    m, n, l = mat("Fog")
    n.remove(n["Principled BSDF"])
    v = n.new("ShaderNodeVolumePrincipled")
    v.inputs["Density"].default_value = 0.012
    v.inputs["Anisotropy"].default_value = 0.55
    v.inputs["Color"].default_value = (0.75, 0.8, 0.9, 1)
    # drifting fog: animated noise modulates density
    tc = n.new("ShaderNodeTexCoord")
    mp = n.new("ShaderNodeMapping")
    l.new(tc.outputs["Object"], mp.inputs["Vector"])
    fc = mp.inputs["Location"].driver_add("default_value", 0)
    fc.driver.expression = "frame*0.012"
    fc = mp.inputs["Location"].driver_add("default_value", 1)
    fc.driver.expression = "-frame*0.006"
    nz = n.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 0.08
    nz.inputs["Detail"].default_value = 2
    l.new(mp.outputs["Vector"], nz.inputs["Vector"])
    mr = n.new("ShaderNodeMapRange")
    mr.inputs["From Min"].default_value = 0.35
    mr.inputs["From Max"].default_value = 0.7
    mr.inputs["To Min"].default_value = 0.004
    mr.inputs["To Max"].default_value = 0.022
    l.new(nz.outputs["Fac"], mr.inputs["Value"])
    l.new(mr.outputs["Result"], v.inputs["Density"])
    l.new(v.outputs[0], n["Material Output"].inputs["Volume"])
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, length / 2 + 40, 15))
    o = bpy.context.active_object
    o.name = "FogVolume"
    o.scale = (STREET_HALF * 2 + 2, length + 140, 30)
    o.data.materials.append(m)
    o.visible_shadow = False
    return o


def build_rain(center_obj):
    """Geometry-nodes rain: thin streaks falling in a box that follows the camera."""
    me = bpy.data.meshes.new("RainBox")
    o = bpy.data.objects.new("Rain", me)
    bpy.context.collection.objects.link(o)
    mod = o.modifiers.new("Rain", "NODES")
    ng = bpy.data.node_groups.new("RainNodes", "GeometryNodeTree")
    ng.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    mod.node_group = ng
    n, l = ng.nodes, ng.links
    out = n.new("NodeGroupOutput")
    # points in a box
    grid = n.new("GeometryNodeMeshCube")
    grid.inputs["Size"].default_value = (14, 26, 9)
    dist = n.new("GeometryNodeDistributePointsInVolume") if False else None
    pts = n.new("GeometryNodePoints")
    pts.inputs["Count"].default_value = 26000
    pos_rand = n.new("FunctionNodeRandomValue")
    pos_rand.data_type = "FLOAT_VECTOR"
    pos_rand.inputs["Min"].default_value = (-7, -6, 0)
    pos_rand.inputs["Max"].default_value = (7, 20, 9)
    pos_rand.inputs["Seed"].default_value = 3
    l.new(pos_rand.outputs["Value"], pts.inputs["Position"])
    # animate fall: z = (z0 - t*speed) mod 9
    pos = n.new("GeometryNodeInputPosition")
    sep = n.new("ShaderNodeSeparateXYZ")
    l.new(pos.outputs[0], sep.inputs[0])
    t = n.new("GeometryNodeInputSceneTime")
    spd = n.new("ShaderNodeMath"); spd.operation = "MULTIPLY"
    spd.inputs[1].default_value = 9.0
    l.new(t.outputs["Seconds"], spd.inputs[0])
    sub = n.new("ShaderNodeMath"); sub.operation = "SUBTRACT"
    l.new(sep.outputs["Z"], sub.inputs[0])
    l.new(spd.outputs[0], sub.inputs[1])
    md = n.new("ShaderNodeMath"); md.operation = "FLOORED_MODULO"
    md.inputs[1].default_value = 9.0
    l.new(sub.outputs[0], md.inputs[0])
    # slight wind drift in x
    drift = n.new("ShaderNodeMath"); drift.operation = "MULTIPLY"
    drift.inputs[1].default_value = -0.12
    l.new(md.outputs[0], drift.inputs[0])
    dx = n.new("ShaderNodeMath"); dx.operation = "ADD"
    l.new(sep.outputs["X"], dx.inputs[0])
    l.new(drift.outputs[0], dx.inputs[1])
    comb = n.new("ShaderNodeCombineXYZ")
    l.new(dx.outputs[0], comb.inputs["X"])
    l.new(sep.outputs["Y"], comb.inputs["Y"])
    l.new(md.outputs[0], comb.inputs["Z"])
    setp = n.new("GeometryNodeSetPosition")
    l.new(pts.outputs[0], setp.inputs["Geometry"])
    l.new(comb.outputs[0], setp.inputs["Position"])
    # streak instance: thin elongated cylinder (length ~ motion blur of a 9 m/s drop)
    cyl = n.new("GeometryNodeMeshCylinder")
    cyl.inputs["Vertices"].default_value = 4
    cyl.inputs["Radius"].default_value = 0.0035
    cyl.inputs["Depth"].default_value = 0.32
    inst = n.new("GeometryNodeInstanceOnPoints")
    l.new(setp.outputs[0], inst.inputs["Points"])
    l.new(cyl.outputs["Mesh"], inst.inputs["Instance"])
    rot = n.new("ShaderNodeCombineXYZ")
    rot.inputs["Y"].default_value = 0.0
    rot.inputs["X"].default_value = 0.0
    l.new(rot.outputs[0], inst.inputs["Rotation"])
    smat = n.new("GeometryNodeSetMaterial")
    rm, rn, rl = mat("RainDrop")
    rn.remove(rn["Principled BSDF"])
    # rain: mostly transparent, catches light via emission scaled by a light-path trick
    mix = rn.new("ShaderNodeMixShader")
    tr = rn.new("ShaderNodeBsdfTransparent")
    em = rn.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (0.85, 0.85, 0.9, 1)
    em.inputs["Strength"].default_value = 0.9
    mix.inputs["Fac"].default_value = 0.35
    rl.new(tr.outputs[0], mix.inputs[1])
    rl.new(em.outputs[0], mix.inputs[2])
    rl.new(mix.outputs[0], rn["Material Output"].inputs["Surface"])
    rm.blend_method = "BLEND"
    smat.inputs["Material"].default_value = rm
    l.new(inst.outputs[0], smat.inputs["Geometry"])
    l.new(smat.outputs[0], out.inputs[0])
    o.visible_shadow = False
    o.visible_diffuse = False
    o.visible_glossy = True
    # follow the camera along the street
    c = o.constraints.new("COPY_LOCATION")
    c.target = center_obj
    c.use_z = False
    c.use_x = True
    return o


def build_environment(length=130, seed=11):
    rng = random.Random(seed)
    build_ground(length)
    build_buildings(length, rng)
    lamps = build_lamps(length, rng)
    build_distant_city(length)
    fog = build_fog(length)
    # world: very dark blue night sky
    w = bpy.data.worlds.new("Night")
    bpy.context.scene.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.006, 0.008, 0.014, 1)
    bg.inputs["Strength"].default_value = 1.0
    # faint cool moon/sky fill
    sd = bpy.data.lights.new("SkyFill", "SUN")
    sd.energy = 0.02
    sd.color = (0.6, 0.7, 1.0)
    sd.angle = 0.5
    so = bpy.data.objects.new("SkyFill", sd)
    so.rotation_euler = (math.radians(50), 0, math.radians(30))
    bpy.context.collection.objects.link(so)
    return lamps, fog
