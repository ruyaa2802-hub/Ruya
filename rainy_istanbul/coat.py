"""Procedural long overcoat fitted to the MakeHuman body by ray casting (rest A-pose).

Torso: rings around the body axis, first hit from the inside + offset.
Skirt (below the hips): outer hull of the legs, forced to flare monotonically, simulated as cloth.
Sleeves: tubes around the upper/lower arm bones.
"""
import bpy
import bmesh
import math
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

SEG = 40


def _bvh(objs):
    dg = bpy.context.evaluated_depsgraph_get()
    bm = bmesh.new()
    for o in objs:
        eo = o.evaluated_get(dg)
        me = eo.to_mesh()
        tmp = bmesh.new()
        tmp.from_mesh(me)
        tmp.transform(o.matrix_world)
        m2 = bpy.data.meshes.new("tmp")
        tmp.to_mesh(m2)
        bm.from_mesh(m2)
        bpy.data.meshes.remove(m2)
        tmp.free()
        eo.to_mesh_clear()
    return BVHTree.FromBMesh(bm)


def _bone_head(rig, name):
    return rig.matrix_world @ rig.data.bones[name].head_local


def _bone_tail(rig, name):
    return rig.matrix_world @ rig.data.bones[name].tail_local


def coat_material():
    m = bpy.data.materials.new("CoatWool")
    m.use_nodes = True
    n, l = m.node_tree.nodes, m.node_tree.links
    b = n["Principled BSDF"]
    b.inputs["Base Color"].default_value = (0.012, 0.012, 0.013, 1)
    b.inputs["Roughness"].default_value = 0.75
    b.inputs["Sheen Weight"].default_value = 0.35
    b.inputs["Sheen Roughness"].default_value = 0.4
    b.inputs["Sheen Tint"].default_value = (0.5, 0.5, 0.55, 1)
    b.inputs["Coat Weight"].default_value = 0.08   # rain wetness
    b.inputs["Coat Roughness"].default_value = 0.25
    tc = n.new("ShaderNodeTexCoord")
    wave = n.new("ShaderNodeTexNoise")
    wave.inputs["Scale"].default_value = 400
    wave.inputs["Detail"].default_value = 2
    l.new(tc.outputs["Object"], wave.inputs["Vector"])
    bump = n.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.12
    l.new(wave.outputs["Fac"], bump.inputs["Height"])
    l.new(bump.outputs["Normal"], b.inputs["Normal"])
    return m


def build_coat(body, rig, extra_collide):
    targets = [body] + list(extra_collide)
    bvh = _bvh(targets)

    neck = _bone_head(rig, "neck_01")
    sh_l = _bone_head(rig, "upperarm_l")
    sh_r = _bone_head(rig, "upperarm_r")
    pelvis = _bone_head(rig, "pelvis")
    calf_l = _bone_head(rig, "calf_l")
    thigh_l = _bone_head(rig, "thigh_l")

    z_top = neck.z - 0.02
    z_hip = thigh_l.z - 0.06          # below crotch line the coat becomes a skirt
    z_hem = calf_l.z - 0.12           # just below the knee
    cy = pelvis.y
    rings = 34
    zs = [z_top + (z_hem - z_top) * (i / (rings - 1)) ** 1.0 for i in range(rings)]

    def first_hit_from_inside(center, d):
        hit = bvh.ray_cast(center, d, 0.6)
        return hit[3] if hit[0] is not None else None

    def outer_hull(center, d, rmax=0.36):
        start = center + d * rmax
        hit = bvh.ray_cast(start, -d, rmax)
        return (rmax - hit[3]) if hit[0] is not None else 0.0

    radii = []
    for i, z in enumerate(zs):
        row = []
        c = Vector((0, cy, z))
        for k in range(SEG):
            a = -math.pi / 2 + 2 * math.pi * k / SEG
            d = Vector((math.cos(a), math.sin(a), 0))
            if z > z_hip + 0.12:
                r = first_hit_from_inside(c, d)
                if r is None:
                    r = outer_hull(c, d, 0.3)
                r += 0.013
            else:
                r = outer_hull(c, d, 0.34) + 0.035
            row.append(r)
        radii.append(row)
    # shoulders: rays toward the arms at the top rings are capped by shoulder width
    sh_w = abs(sh_l.x - sh_r.x) / 2 + 0.06
    for i, z in enumerate(zs):
        for k in range(SEG):
            a = -math.pi / 2 + 2 * math.pi * k / SEG
            if z > z_hip and abs(math.cos(a)) > 0.05:
                radii[i][k] = min(radii[i][k], sh_w / abs(math.cos(a)))
    # skirt: flare monotonically downwards
    hip_idx = [i for i, z in enumerate(zs) if z <= z_hip + 0.12]
    for i in hip_idx[1:]:
        for k in range(SEG):
            radii[i][k] = max(radii[i][k], radii[i - 1][k]) + 0.004
    # angular + vertical smoothing
    for _ in range(4):
        new = [row[:] for row in radii]
        for i in range(rings):
            for k in range(SEG):
                acc = radii[i][(k - 1) % SEG] + radii[i][(k + 1) % SEG] + 2 * radii[i][k]
                cnt = 4
                if 0 < i < rings - 1:
                    acc += radii[i - 1][k] + radii[i + 1][k]
                    cnt += 2
                new[i][k] = acc / cnt
        radii = new

    bm = bmesh.new()
    verts = []
    for i, z in enumerate(zs):
        row = []
        for k in range(SEG):
            a = -math.pi / 2 + 2 * math.pi * k / SEG
            r = radii[i][k]
            row.append(bm.verts.new((r * math.cos(a), cy + r * math.sin(a), z)))
        verts.append(row)
    z_vb = sh_l.z - 0.26             # bottom of the open V at the chest

    def front_gap(z, k, extra=0):
        # faces around k = SEG-1 -> 0 are at the front
        kk = k if k < SEG / 2 else k - SEG     # signed index around the front seam
        if z < z_hip + 0.04:
            return kk == -1                    # front slit of the skirt
        if z > z_vb:
            half = 1 + extra + int(3.5 * min(1.0, (z - z_vb) / max(0.01, z_top - z_vb)))
            return -half - 1 <= kk <= half
        return False

    for i in range(rings - 1):
        zf = (zs[i] + zs[i + 1]) / 2
        for k in range(SEG):
            if front_gap(zf, k):
                continue
            bm.faces.new((verts[i][k], verts[i][(k + 1) % SEG], verts[i + 1][(k + 1) % SEG], verts[i + 1][k]))
    # upturned collar
    top = verts[0]
    collar = []
    for lvl, (dz, dr) in enumerate([(0.035, 0.0), (0.075, 0.025)]):
        row = []
        for k, v in enumerate(top):
            co = Vector(v.co)
            nr = Vector((co.x, co.y - cy, 0)).normalized()
            target = Vector((0, cy, 0)) + nr * (Vector((co.x, co.y - cy, 0)).length * 0.9 + dr)
            row.append(bm.verts.new((target.x, target.y, co.z + dz)))
        collar.append(row)
    prev = top
    for row in collar:
        for k in range(SEG):
            if front_gap(z_top + 1.0, k, extra=1):
                continue
            bm.faces.new((row[k], row[(k + 1) % SEG], prev[(k + 1) % SEG], prev[k]))
        prev = row

    # sleeves
    sleeve_info = {}
    for side in ("l", "r"):
        p0 = _bone_head(rig, "upperarm_" + side)
        p1 = _bone_head(rig, "lowerarm_" + side)
        p2 = _bone_head(rig, "hand_" + side)
        segs = [(p0, p1, 9), (p1, p2, 9)]
        rows = []
        for si, (a0, a1, nr) in enumerate(segs):
            axis = (a1 - a0).normalized()
            ref = Vector((0, 1, 0))
            u = axis.cross(ref).normalized()
            w = axis.cross(u).normalized()
            for j in range(nr + (1 if si == 1 else 0)):
                t = j / nr
                c = a0.lerp(a1, t)
                if si == 0 and j == 0:
                    c = c - axis * 0.04
                row = []
                for k in range(16):
                    ang = 2 * math.pi * k / 16
                    d = u * math.cos(ang) + w * math.sin(ang)
                    hit = bvh.ray_cast(c, d, 0.2)
                    r = hit[3] if hit[0] is not None else 0.05
                    r = min(max(r, 0.03), 0.062) + 0.016 + (0.008 if si == 1 and j == nr else 0)
                    row.append(bm.verts.new(c + d * r))
                    sleeve_info[row[-1]] = (side, si, t)
                rows.append(row)
        for i in range(len(rows) - 1):
            for k in range(16):
                bm.faces.new((rows[i][k], rows[i][(k + 1) % 16], rows[i + 1][(k + 1) % 16], rows[i + 1][k]))

    bm.verts.index_update()
    sleeve_by_index = {v.index: info for v, info in sleeve_info.items()}
    me = bpy.data.meshes.new("Coat")
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    coat = bpy.data.objects.new("Coat", me)
    bpy.context.collection.objects.link(coat)
    me.materials.append(coat_material())
    for p in me.polygons:
        p.use_smooth = True
    bpy.context.view_layer.objects.active = coat
    bpy.ops.object.select_all(action="DESELECT")
    coat.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")

    # skin weights from the body
    for vg in body.vertex_groups:
        if vg.name in rig.data.bones:
            coat.vertex_groups.new(name=vg.name)
    dt = coat.modifiers.new("WeightsFromBody", "DATA_TRANSFER")
    dt.object = body
    dt.use_vert_data = True
    dt.data_types_verts = {"VGROUP_WEIGHTS"}
    dt.vert_mapping = "POLYINTERP_NEAREST"
    dt.layers_vgroup_select_src = "ALL"
    dt.layers_vgroup_select_dst = "NAME"
    bpy.ops.object.modifier_apply(modifier=dt.name)
    # torso keeps only trunk weights; sleeves and skirt get explicit weights
    trunk = {"pelvis", "spine_01", "spine_02", "spine_03", "neck_01", "clavicle_l", "clavicle_r"}
    groups = {g.name: g for g in coat.vertex_groups}
    for n in trunk | {"upperarm_l", "upperarm_r", "lowerarm_l", "lowerarm_r", "hand_l", "hand_r"}:
        if n not in groups:
            groups[n] = coat.vertex_groups.new(name=n)
    pin = coat.vertex_groups.new(name="pin")
    for v in me.vertices:
        w = {}
        info = sleeve_by_index.get(v.index)
        if info:
            side, si, t = info
            if si == 0:
                w["upperarm_" + side] = 1.0
                if t < 0.25:
                    k = 1 - t / 0.25
                    w["clavicle_" + side] = 0.6 * k
                    w["spine_03"] = 0.25 * k
                if t > 0.75:
                    w["lowerarm_" + side] = (t - 0.75) / 0.5
            else:
                w["lowerarm_" + side] = 1.0
                if t < 0.25:
                    w["upperarm_" + side] = 0.5 * (1 - t / 0.25)
                if t > 0.85:
                    w["hand_" + side] = (t - 0.85) * 2.0
        else:
            for g in v.groups:
                name = coat.vertex_groups[g.group].name
                if name in trunk and g.weight > 0:
                    w[name] = g.weight
            if not w:
                w["spine_03" if v.co.z > 1.3 else "spine_02"] = 1.0
            z = v.co.z
            if z < z_hip + 0.1:
                t = min(1.0, (z_hip + 0.1 - z) / 0.2)
                w = {k2: val * (1 - t) for k2, val in w.items()}
                w["pelvis"] = w.get("pelvis", 0) + t
        tot = sum(w.values())
        for g in list(v.groups):
            coat.vertex_groups[g.group].remove([v.index])
        for name, val in w.items():
            groups[name].add([v.index], val / tot, "REPLACE")
        if not info and v.co.z < z_hip + 0.1:
            pin.add([v.index], max(0.0, 1.0 - (z_hip + 0.1 - v.co.z) / 0.1), "REPLACE")
        else:
            pin.add([v.index], 1.0, "REPLACE")
    coat.parent = rig
    arm = coat.modifiers.new("Armature", "ARMATURE")
    arm.object = rig
    sol = coat.modifiers.new("Solidify", "SOLIDIFY")
    sol.thickness = 0.008
    sol.offset = 1.0
    return coat


def add_cloth(coat, colliders, frame_end):
    cl = coat.modifiers.new("Cloth", "CLOTH")
    # cloth must come after the armature and before solidify
    bpy.context.view_layer.objects.active = coat
    while coat.modifiers.find("Cloth") > 1:
        bpy.ops.object.modifier_move_up(modifier="Cloth")
    s = cl.settings
    s.quality = 8
    s.mass = 0.8
    s.tension_stiffness = 40
    s.compression_stiffness = 40
    s.shear_stiffness = 10
    s.bending_stiffness = 6.0
    s.air_damping = 1.5
    s.vertex_group_mass = "pin"
    s.pin_stiffness = 1.0
    cs = cl.collision_settings
    cs.use_collision = True
    cs.distance_min = 0.012
    cs.use_self_collision = False
    cl.point_cache.frame_start = 1
    cl.point_cache.frame_end = frame_end
    for o in colliders:
        m = o.modifiers.new("Collision", "COLLISION")
        o.collision.thickness_outer = 0.015
        o.collision.damping = 0.5
    return cl


def make_leg_proxy(src, rig, z_max):
    """Collision proxy for the coat skirt: only the legs (hands/arms must not push the cloth)."""
    proxy = src.copy()
    proxy.data = src.data.copy()
    proxy.name = "LegCollider"
    bpy.context.collection.objects.link(proxy)
    for m in list(proxy.modifiers):
        if m.type != "ARMATURE":
            proxy.modifiers.remove(m)
    legs = [g.index for g in proxy.vertex_groups if g.name.startswith(("thigh", "calf", "foot", "ball"))]
    bm = bmesh.new()
    bm.from_mesh(proxy.data)
    deform = bm.verts.layers.deform.active
    kill = []
    for v in bm.verts:
        wl = sum(v[deform].get(i, 0.0) for i in legs) if deform else 0.0
        if wl < 0.5 or v.co.z > z_max:
            kill.append(v)
    bmesh.ops.delete(bm, geom=kill, context="VERTS")
    bm.to_mesh(proxy.data)
    bm.free()
    proxy.hide_render = True
    proxy.visible_camera = False
    return proxy
