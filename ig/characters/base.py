"""Character base: armature construction, skinning and the channel API.

A character is driven by a flat dict of named channels (see CHANNELS). The
animation layer only ever talks to characters through these names, so new
props (mug, shoes, plant...) plug into the same timeline/lipsync system.
"""
import math

import bpy
from mathutils import Euler, Vector

from ..face import Face
from ..util import link, set_parent_keep

CHANNELS = (
    "pos_x", "pos_y", "pos_z", "turn", "lean_f", "lean_s", "squash",
    "nod", "tilt", "twist",
    "arm_L_raise", "arm_L_fold", "arm_L_curl", "arm_R_raise", "arm_R_fold", "arm_R_curl",
    "gaze_x", "gaze_y", "blink", "lid_u", "lid_l", "lid_u_L", "lid_u_R", "squint",
    "brow_up", "brow_up_L", "brow_up_R", "brow_ang", "brow_ang_L", "brow_ang_R",
    "m_open", "m_wide", "m_round", "m_press", "m_smile", "m_frown", "m_sneer",
)


def build_armature(name, bones, col=None):
    """bones: list of (name, head, tail, parent_name|None)."""
    data = bpy.data.armatures.new(name)
    obj = bpy.data.objects.new(name, data)
    link(obj, col)
    obj.show_in_front = True
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    for bname, head, tail, parent in bones:
        eb = data.edit_bones.new(bname)
        eb.head, eb.tail = Vector(head), Vector(tail)
        eb.align_roll(Vector((0, -1, 0)))   # bone Z = forward on every bone
        if parent:
            eb.parent = data.edit_bones[parent]
            eb.use_connect = False
    bpy.ops.object.mode_set(mode="OBJECT")
    for pb in obj.pose.bones:
        pb.rotation_mode = "XYZ"
    return obj


def skin(mesh_obj, arm_obj, weights):
    """weights: {bone_name: [w per vertex]} – normalised here."""
    n = len(mesh_obj.data.vertices)
    totals = [0.0] * n
    for ws in weights.values():
        for i, w in enumerate(ws):
            totals[i] += w
    for bname, ws in weights.items():
        vg = mesh_obj.vertex_groups.new(name=bname)
        for i, w in enumerate(ws):
            if w > 1e-4 and totals[i] > 0:
                vg.add([i], w / totals[i], "REPLACE")
    mod = mesh_obj.modifiers.new("Armature", "ARMATURE")
    mod.object = arm_obj
    # armature must be evaluated before subsurf/solidify
    idx = list(mesh_obj.modifiers).index(mod)
    if idx:
        mesh_obj.modifiers.move(idx, 0)
    mesh_obj.parent = arm_obj


class Character:
    """Generic rigged prop character."""

    # channel -> list of (bone, euler_axis, factor)
    rot_map = {}
    squash_bone = "root"

    def __init__(self, name, arm, body, face, base_loc, base_rot=(0, 0, 0)):
        self.name = name
        self.arm = arm
        self.body = body
        self.face = face
        self.base_loc = Vector(base_loc)
        self.base_rot = Vector(base_rot)
        self.extra = []

    def place(self, loc=None, rot=None):
        if loc is not None:
            self.base_loc = Vector(loc)
        if rot is not None:
            self.base_rot = Vector(rot)
        self.apply({})

    def apply(self, ch):
        g = lambda k: ch.get(k, 0.0)
        self.arm.location = self.base_loc + Vector((g("pos_x"), g("pos_y"), g("pos_z")))
        self.arm.rotation_euler = (self.base_rot.x, self.base_rot.y, self.base_rot.z + g("turn"))
        pose = self.arm.pose.bones
        rots = {b.name: [0.0, 0.0, 0.0] for b in pose}
        for chan, targets in self.rot_map.items():
            v = g(chan)
            if v:
                for bone, axis, fac in targets:
                    rots[bone][axis] += v * fac
        for b in pose:
            b.rotation_euler = rots[b.name]
        s = 1.0 + g("squash")
        k = 1.0 / math.sqrt(max(s, 0.2))
        pose[self.squash_bone].scale = (k, s, k)
        self.face.apply(ch)

    def keyable(self):
        out = [(self.arm, "location"), (self.arm, "rotation_euler")]
        for b in self.arm.pose.bones:
            out.append((b, "rotation_euler"))
        out.append((self.arm.pose.bones[self.squash_bone], "scale"))
        return out + self.face.keyable()


def anchor_on_surface(name, body, vert_index, outward, arm, bone, col=None):
    """Face anchor placed on a body vertex, carried by `bone`.

    The face region of the body must be weighted rigidly to the same bone so
    the surface and the face move together.
    """
    from ..util import look_rotation, empty
    co = body.matrix_world @ body.data.vertices[vert_index].co
    anc = empty(name, co, 0.03, col)
    anc.matrix_world = look_rotation(outward).to_4x4()
    anc.location = co
    set_parent_keep(anc, arm, "BONE", bone=bone)
    return anc
