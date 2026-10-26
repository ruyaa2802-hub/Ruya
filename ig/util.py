"""Shared helpers: scene reset, mesh construction, math and easing."""
import math

import bpy
from mathutils import Matrix, Vector


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    import addon_utils
    addon_utils.enable("cycles", default_set=True)
    return bpy.context.scene


def collection(name, parent=None):
    col = bpy.data.collections.get(name)
    if col is None:
        col = bpy.data.collections.new(name)
        (parent or bpy.context.scene.collection).children.link(col)
    return col


def link(obj, col=None):
    (col or bpy.context.scene.collection).objects.link(obj)
    return obj


def mesh_object(name, verts, faces, uvs=None, mat_indices=None, smooth=True, col=None):
    """Build a mesh object from python lists.

    uvs: optional per-vertex (u, v) list; it is expanded to per-loop UVs.
    mat_indices: optional per-face material index list.
    """
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], [tuple(f) for f in faces])
    if uvs is not None:
        layer = me.uv_layers.new(name="UVMap")
        for loop in me.loops:
            layer.data[loop.index].uv = uvs[loop.vertex_index]
    if mat_indices is not None:
        me.polygons.foreach_set("material_index", mat_indices)
    me.validate()
    if smooth:
        me.shade_smooth()
    obj = bpy.data.objects.new(name, me)
    return link(obj, col)


def grid_faces(rows, cols, offset=0, wrap_cols=False):
    """Quad faces for a rows x cols vertex grid laid out row-major."""
    faces = []
    cmax = cols if wrap_cols else cols - 1
    for r in range(rows - 1):
        for c in range(cmax):
            c2 = (c + 1) % cols
            a = offset + r * cols + c
            b = offset + r * cols + c2
            faces.append((a, b, b + cols, a + cols))
    return faces


def store_rest(obj, matrix=None):
    """Save rest-pose positions/normals as point attributes `rest` / `rest_n`.

    They ride along through armature, solidify and subsurf, so procedural
    patterns stay glued to the cloth while it deforms.
    """
    me = obj.data
    me.update()
    pos = me.attributes.new("rest", "FLOAT_VECTOR", "POINT")
    nrm = me.attributes.new("rest_n", "FLOAT_VECTOR", "POINT")
    for v in me.vertices:
        co, n = v.co.copy(), v.normal.copy()
        if matrix is not None:
            co = matrix @ co
            n = (matrix.to_3x3() @ n).normalized()
        pos.data[v.index].vector = co
        nrm.data[v.index].vector = n


def add_subsurf(obj, viewport=1, render=2):
    mod = obj.modifiers.new("Subsurf", "SUBSURF")
    mod.levels = viewport
    mod.render_levels = render
    return mod


def add_solidify(obj, thickness, offset=-1.0):
    mod = obj.modifiers.new("Solidify", "SOLIDIFY")
    mod.thickness = thickness
    mod.offset = offset
    return mod


def empty(name, loc=(0, 0, 0), size=0.05, col=None, parent=None):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_size = size
    obj.location = loc
    link(obj, col)
    if parent is not None:
        obj.parent = parent
    return obj


def look_rotation(forward, up=(0, 0, 1)):
    """Rotation matrix whose -Y axis points along `forward` and Z is close to `up`."""
    f = Vector(forward).normalized()
    u = Vector(up)
    x = (-f).cross(u)
    if x.length < 1e-6:
        x = Vector((1, 0, 0))
    x.normalize()
    y = -f
    z = x.cross(y).normalized()
    return Matrix((x, y, z)).transposed()


def set_parent_keep(child, parent, parent_type="OBJECT", vertices=None, bone=None):
    """Parent `child` to `parent` while keeping its current world transform."""
    bpy.context.view_layer.update()
    world = child.matrix_world.copy()
    child.parent = parent
    child.parent_type = parent_type
    if vertices is not None:
        child.parent_vertices = vertices
    if bone is not None:
        child.parent_bone = bone
    child.matrix_parent_inverse = Matrix.Identity(4)
    child.matrix_basis = Matrix.Identity(4)
    bpy.context.view_layer.update()
    frame = child.matrix_world.copy()
    child.matrix_parent_inverse = frame.inverted()
    child.matrix_basis = world


# ---------------------------------------------------------------- math

def clamp(x, a=0.0, b=1.0):
    return a if x < a else b if x > b else x


def lerp(a, b, t):
    return a + (b - a) * t


def smoothstep(e0, e1, x):
    if e0 == e1:
        return 0.0 if x < e0 else 1.0
    t = clamp((x - e0) / (e1 - e0))
    return t * t * (3 - 2 * t)


def ease(t, kind="inout"):
    t = clamp(t)
    if kind == "linear":
        return t
    if kind == "in":
        return t * t * t
    if kind == "out":
        return 1 - (1 - t) ** 3
    if kind == "back":  # overshoot then settle
        c1, c3 = 1.70158, 2.70158
        return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2
    if kind == "elastic":
        if t in (0.0, 1.0):
            return t
        return 2 ** (-10 * t) * math.sin((t * 10 - 0.75) * (2 * math.pi / 3)) + 1
    if kind == "snap":  # very fast in, soft settle
        return 1 - (1 - t) ** 5
    # cubic in-out
    return 4 * t * t * t if t < 0.5 else 1 - (-2 * t + 2) ** 3 / 2
