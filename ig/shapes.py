"""Mesh builders shared by the kitchen cast and set."""
import math

import bmesh
import bpy
from mathutils import Vector

from .util import mesh_object


def _se(t, n):
    """Superellipse cos/sin pair at angle t."""
    c, s = math.cos(t), math.sin(t)
    return math.copysign(abs(c) ** (2 / n), c), math.copysign(abs(s) ** (2 / n), s)


def rounded_tube(name, rings, segs=64, n=6.0, col=None, cap_bottom=True, cap_top=True, mats=None):
    """Stack of superellipse rings: rings = [(z, half_x, half_y), ...] bottom to top.

    Segment 0 faces -Y (the character's front). UVs are in meters: u along the
    perimeter (0 at the front centre, increasing toward +X), v = z.
    mats: optional fn(z_mid, x_mid, y_mid) -> material index per face.
    """
    verts, uvs, faces, fmats = [], [], [], []
    ring_ids = []
    for z, a, b in rings:
        ids, u = [], 0.0
        prev = None
        for j in range(segs):
            t = -math.pi / 2 + 2 * math.pi * j / segs
            c, s = _se(t, n)
            p = (a * c, b * s, z)
            if prev is not None:
                u += math.dist(p[:2], prev[:2])
            prev = p
            ids.append(len(verts))
            verts.append(p)
            uvs.append((u, z))
        ring_ids.append(ids)
    for k in range(len(rings) - 1):
        r0, r1 = ring_ids[k], ring_ids[k + 1]
        for j in range(segs):
            j2 = (j + 1) % segs
            faces.append((r0[j], r0[j2], r1[j2], r1[j]))
    for cap, ids, flip in ((cap_bottom, ring_ids[0], True), (cap_top, ring_ids[-1], False)):
        if cap:
            z = verts[ids[0]][2]
            c = len(verts)
            verts.append((0.0, 0.0, z))
            uvs.append((0.0, z))
            for j in range(segs):
                j2 = (j + 1) % segs
                faces.append((c, ids[j2], ids[j]) if flip else (c, ids[j], ids[j2]))
    if mats:
        for f in faces:
            m = [sum(verts[i][k] for i in f) / len(f) for k in range(3)]
            fmats.append(mats(m[2], m[0], m[1]))
    return mesh_object(name, verts, faces, uvs=uvs, mat_indices=fmats or None, col=col)


def mark_sharp(obj, angle_deg=35.0):
    """Smooth shading with crisp edges where faces meet at more than `angle_deg`."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    lim = math.radians(angle_deg)
    for e in bm.edges:
        if len(e.link_faces) == 2:
            e.smooth = e.link_faces[0].normal.angle(e.link_faces[1].normal, 0.0) < lim
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.shade_smooth()
    return obj


def box_mesh(name, size, center=(0, 0, 0), col=None, cavity=None):
    """Axis-aligned box (bmesh). cavity=(inset, depth): open the -Y face into a recessed compartment."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * size[0] + center[0], v.co.y * size[1] + center[1], v.co.z * size[2] + center[2]))
    if cavity:
        inset, depth = cavity
        bm.faces.ensure_lookup_table()
        front = min(bm.faces, key=lambda f: f.calc_center_median().y)
        res = bmesh.ops.inset_individual(bm, faces=[front], thickness=inset)
        ext = bmesh.ops.extrude_face_region(bm, geom=[front])
        moved = [g for g in ext["geom"] if isinstance(g, bmesh.types.BMVert)]
        bmesh.ops.translate(bm, verts=moved, vec=(0, depth, 0))
        bmesh.ops.delete(bm, geom=[front], context="FACES_ONLY")
        del res
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    (col or bpy.context.scene.collection).objects.link(obj)
    return obj


def bevel(obj, width, segments=3, angle=40.0):
    mod = obj.modifiers.new("Bevel", "BEVEL")
    mod.width = width
    mod.segments = segments
    mod.limit_method = "ANGLE"
    mod.angle_limit = math.radians(angle)
    mod.harden_normals = False
    obj.data.shade_smooth()
    return mod


def nearest_vertex(obj, point):
    p = Vector(point)
    return min(range(len(obj.data.vertices)), key=lambda i: (obj.data.vertices[i].co - p).length)


def text_mesh(name, text, size, font, col=None, extrude=0.0003, align="CENTER", space_line=0.9):
    """Flat text as a mesh (XY plane, +Z out), centred on the origin."""
    cu = bpy.data.curves.new(name + "_curve", "FONT")
    cu.body = text
    cu.font = bpy.data.fonts.load(font, check_existing=True)
    cu.align_x, cu.align_y = align, "CENTER"
    cu.size = size
    cu.space_line = space_line
    cu.extrude = extrude
    cu.resolution_u = 5
    tmp = bpy.data.objects.new(name + "_tmp", cu)
    bpy.context.scene.collection.objects.link(tmp)
    me = bpy.data.meshes.new_from_object(tmp.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    bpy.data.objects.remove(tmp)
    obj = bpy.data.objects.new(name, me)
    if col is not None:
        col.objects.link(obj)
    else:
        bpy.context.scene.collection.objects.link(obj)
    return obj


def prism(name, outline, zs, col=None, mats=None):
    """Extrude a closed 2D outline [(x, y), ...] (counter-clockwise from above) through heights zs.

    Fan caps at the bottom and top. UVs in meters: u along the outline, v = z.
    mats: optional list of material indices per outline segment (side faces); caps get index 0.
    """
    n = len(outline)
    verts, uvs, faces, fmats = [], [], [], []
    per = [0.0]
    for i in range(1, n + 1):
        per.append(per[-1] + math.dist(outline[i - 1], outline[i % n]))
    for z in zs:
        for i, (x, y) in enumerate(outline):
            verts.append((x, y, z))
            uvs.append((per[i], z))
    for k in range(len(zs) - 1):
        for i in range(n):
            a, b = k * n + i, k * n + (i + 1) % n
            faces.append((a, b, b + n, a + n))
            fmats.append(mats[i] if mats else 0)
    cx = sum(p[0] for p in outline) / n
    cy = sum(p[1] for p in outline) / n
    for z, base, flip in ((zs[0], 0, True), (zs[-1], (len(zs) - 1) * n, False)):
        c = len(verts)
        verts.append((cx, cy, z))
        uvs.append((0.0, z))
        for i in range(n):
            j = (i + 1) % n
            faces.append((c, base + j, base + i) if flip else (c, base + i, base + j))
            fmats.append(0)
    return mesh_object(name, verts, faces, uvs=uvs, mat_indices=fmats, col=col)
