"""BUZDOLABI – the exhausted retro fridge who gets opened all night long.

Design: a rounded retro two-door fridge in pale ice blue enamel with chrome
handles. The freezer block on top is its head (the face sits on the freezer
door, the gap above the main door reads as its neck); the main door below
opens on a hinge (channel "door", radians), and the inside is a real, lit
compartment with glass shelves and food. Magnets and a note on the door.
"""
import math

import bpy
from mathutils import Vector

from .. import materials as M
from ..audio import FONT
from ..face import Face, FaceSpec
from ..shapes import bevel, box_mesh, text_mesh
from ..util import empty, link, look_rotation, set_parent_keep
from ..sets.bedroom import _blobs, _lathe
from .base import Character, build_armature, skin

W, D = 0.72, 0.68
FRONT = -D / 2
CAB_Z = (0.06, 1.22)            # main compartment (outside)
HEAD_Z = (1.23, 1.85)           # freezer block
FACE_Z = 1.555
FACE_SCALE = 1.55
HINGE = (W / 2, FRONT)          # door hinge on the right front edge (seen from the front)
SHELVES = (0.45, 0.8)           # glass shelf heights (local)


def shelf_point(x, y, shelf):
    """Local position standing on a shelf (for placing food characters)."""
    return Vector((x, y, SHELVES[shelf] + 0.006))


def _part(name, size, center, mat, col, bev=0.0, segs=3):
    obj = box_mesh(name, size, center, col)
    obj.data.materials.append(mat)
    if bev:
        bevel(obj, bev, segs)
    return obj


def _jar(name, x, y, z, r, h, glass_c, fill_c, lid_c, col, fill=0.85):
    """A jar: tinted glass, its contents and a lid."""
    out = [_lathe(name, [(0.0, 0.0), (r, 0.0), (r * 1.02, h * 0.92), (r * 0.85, h), (0.0, h)],
                  M.glass(name + "_glass", glass_c, roughness=0.06), col, (x, y, z), segs=32),
           _lathe(name + "_fill", [(0.0, 0.003), (r * 0.94, 0.003), (r * 0.96, h * fill), (0.0, h * fill)],
                  M.plastic(name + "_fill", fill_c, 0.4), col, (x, y, z), segs=32),
           _lathe(name + "_lid", [(0.0, 0.0), (r * 0.9, 0.0), (r * 0.92, 0.022), (0.0, 0.024)],
                  M.metal(name + "_lid", lid_c, 0.3), col, (x, y, z + h - 0.004), segs=32)]
    return out


def _stock(col, inside):
    """Everything else in a lived-in Turkish fridge (the cast stands in front)."""
    top, low = SHELVES[1] + 0.006, SHELVES[0] + 0.006
    items = []
    # top shelf, back row: jam, kaymak, sucuk, honey, white cheese; a tall water bottle in the corner
    items += _jar("jam", -0.07, 0.17, top, 0.04, 0.1, (0.95, 0.9, 0.9), (0.55, 0.05, 0.08), (0.9, 0.25, 0.2), col)
    items += _jar("honey", 0.27, 0.05, top, 0.034, 0.09, (1.0, 0.95, 0.8), (0.85, 0.5, 0.08), (0.95, 0.75, 0.2), col)
    items.append(_part("kaymak_dish", (0.12, 0.08, 0.035), (0.07, 0.13, top + 0.0175),
                       M.plastic("kaymak_box", (0.92, 0.92, 0.88), 0.35), col, 0.008))
    items.append(_part("beyaz_peynir", (0.09, 0.06, 0.035), (-0.02, 0.03, top + 0.026),
                       M.plastic("white_cheese", (0.96, 0.95, 0.9), 0.55), col, 0.006))
    items.append(_lathe("cheese_plate", [(0.0, 0.0), (0.07, 0.0), (0.075, 0.008), (0.0, 0.006)],
                        M.ceramic("plate_blue", (0.3, 0.5, 0.8)), col, (-0.02, 0.03, top), segs=32))
    items.append(_blobs("sucuk", [((0.17 + 0.03 * math.cos(a), 0.18 + 0.05 * math.sin(a), top + 0.018),
                                   (0.018, 0.018, 0.018)) for a in [i * 0.35 for i in range(9)]],
                        M.plastic("sucuk_red", (0.45, 0.08, 0.06), 0.45), col, rings=6, segs=10, subsurf=1))
    items.append(_lathe("water_bottle", [(0.0, 0.0), (0.04, 0.0), (0.042, 0.22), (0.02, 0.27), (0.015, 0.3),
                                         (0.0, 0.3)], M.glass("water_plastic", (0.75, 0.9, 1.0), roughness=0.1),
                        col, (-0.27, 0.21, top), segs=32))
    # bottom shelf: ayran cups, a plate of dolma, leftovers in a box
    for k, x in enumerate((-0.07, 0.0)):
        items.append(_lathe(f"ayran_{k}", [(0.0, 0.0), (0.026, 0.0), (0.032, 0.075), (0.0, 0.075)],
                            M.plastic("ayran_cup", (0.95, 0.95, 0.97), 0.3), col, (x, -0.17, low), segs=24))
        items.append(_lathe(f"ayran_{k}_lid", [(0.0, 0.0), (0.033, 0.0), (0.033, 0.003), (0.0, 0.003)],
                            M.metal("ayran_foil", (0.2, 0.45, 0.85), 0.35), col, (x, -0.17, low + 0.075), segs=24))
    items.append(_lathe("dolma_plate", [(0.0, 0.0), (0.075, 0.0), (0.08, 0.01), (0.0, 0.008)],
                        M.ceramic("plate_white", (0.93, 0.92, 0.88)), col, (0.22, -0.13, low), segs=32))
    items.append(_blobs("dolma", [((0.22 + dx, -0.13 + dy, low + 0.022), (0.016, 0.034, 0.014))
                                  for dx, dy in ((-0.035, 0.0), (0.0, 0.01), (0.035, 0.0), (-0.018, -0.03),
                                                 (0.018, -0.03))],
                        M.mottled("dolma_leaf", (0.2, 0.3, 0.1), (0.12, 0.2, 0.05), scale=120.0), col, rings=6,
                        segs=12, subsurf=1))
    items.append(_part("leftovers", (0.13, 0.1, 0.07), (0.24, 0.16, low + 0.035),
                       M.glass("box_plastic", (0.95, 0.95, 0.95), roughness=0.3), col, 0.01))
    items.append(_part("leftovers_lid", (0.135, 0.105, 0.012), (0.24, 0.16, low + 0.076),
                       M.plastic("box_lid", (0.25, 0.65, 0.4), 0.4), col, 0.004))
    items.append(_part("leftovers_food", (0.11, 0.08, 0.04), (0.24, 0.16, low + 0.024),
                       M.plastic("pilav", (0.92, 0.85, 0.65), 0.7), col))
    # crisper: cucumbers, a lettuce, lemons; a watermelon wedge on its lid
    items.append(_blobs("cucumbers", [((0.0, -0.02, 0.13), (0.11, 0.022, 0.022)), ((0.02, 0.05, 0.13),
                                                                                    (0.1, 0.02, 0.02))],
                        M.mottled("cucumber", (0.18, 0.35, 0.1), (0.1, 0.22, 0.05)), col, rings=8, segs=12,
                        subsurf=1))
    items.append(_blobs("lettuce", [((0.2, 0.05, 0.17), (0.08, 0.08, 0.07)), ((0.17, 0.0, 0.2), (0.05, 0.05, 0.04))],
                        M.mottled("lettuce", (0.45, 0.7, 0.2), (0.3, 0.5, 0.12), scale=30.0), col, rings=10,
                        segs=14, subsurf=1))
    items.append(_blobs("lemons", [((-0.24, 0.1, 0.13), (0.035, 0.028, 0.028)), ((-0.25, 0.02, 0.13),
                                                                               (0.035, 0.028, 0.028))],
                        M.mottled("lemon_skin", (0.95, 0.8, 0.1), (0.85, 0.65, 0.05)), col, rings=10, segs=14,
                        subsurf=1))
    rind = M.mottled("melon_rind", (0.15, 0.4, 0.12), (0.06, 0.22, 0.05), scale=25.0)
    items.append(_blobs("watermelon", [((0.0, 0.05, 0.312), (0.12, 0.08, 0.1))], rind, col, rings=8, segs=16))
    return items


def build(col=None, loc=(0, 0, 0), rot=(0, 0, 0)):
    enamel = M.ceramic("fridge_enamel", (0.6, 0.8, 0.88), roughness=0.18)
    inside = M.plastic("fridge_inside", (0.62, 0.69, 0.74), 0.3)
    chrome = M.metal("chrome", (0.92, 0.92, 0.94), 0.1)
    rubber = M.plastic("gasket", (0.08, 0.09, 0.1), 0.6)
    glass = M.glass("shelf_glass", (0.85, 0.95, 1.0))
    brow = M.plastic("fridge_brow", (0.1, 0.14, 0.24), 0.3)
    lip = M.ceramic("fridge_lip", (0.2, 0.32, 0.45), roughness=0.25)
    glow = M.emission("fridge_light", (0.85, 0.93, 1.0), 0.0)

    arm = build_armature("buzdolabi_rig", [
        ("root", (0, 0, 0), (0, 0, 0.5), None),
        ("head", (0, 0, HEAD_Z[0]), (0, 0, HEAD_Z[1]), "root"),
        ("door", (HINGE[0], HINGE[1], CAB_Z[0] + 0.02), (HINGE[0], HINGE[1], CAB_Z[1] - 0.02), "root"),
    ], col)

    def rigid(obj, bone):
        skin(obj, arm, {bone: [1.0] * len(obj.data.vertices)})
        return obj

    # ---------------------------------------------------------------- body
    cab = box_mesh("buzdolabi_body", (W, D, CAB_Z[1] - CAB_Z[0]), (0, 0, sum(CAB_Z) / 2), col,
                   cavity=(0.035, D - 0.08))
    cab.data.materials.append(enamel)
    cab.data.materials.append(inside)
    for p in cab.data.polygons:
        c = p.center
        p.material_index = 1 if (abs(c.x) < W / 2 - 0.02 and CAB_Z[0] + 0.02 < c.z < CAB_Z[1] - 0.02
                                 and c.y > FRONT + 0.001) else 0
    bevel(cab, 0.02, 3)
    rigid(cab, "root")
    rigid(_part("buzdolabi_plinth", (W - 0.06, D - 0.1, 0.06), (0, 0.02, 0.03), rubber, col), "root")
    head = _part("buzdolabi_head", (W, D, HEAD_Z[1] - HEAD_Z[0]), (0, 0, sum(HEAD_Z) / 2), enamel, col, 0.05, 4)
    rigid(head, "head")
    fh = _part("freezer_handle", (0.022, 0.03, 0.13), (-W / 2 + 0.07, FRONT - 0.03, HEAD_Z[0] + 0.12), chrome, col,
               0.008)
    rigid(fh, "head")

    # ---------------------------------------------------------------- door (+ inner bins with bottles and eggs)
    door_parts = []
    dz0, dz1 = CAB_Z[0] + 0.01, CAB_Z[1] - 0.01
    dc = (dz0 + dz1) / 2
    door_parts.append(_part("buzdolabi_door", (W, 0.065, dz1 - dz0), (0, FRONT - 0.0325, dc), enamel, col, 0.02))
    door_parts.append(_part("door_gasket", (W - 0.06, 0.008, dz1 - dz0 - 0.06), (0, FRONT + 0.002, dc), rubber,
                            col))
    door_parts.append(_part("door_handle", (0.022, 0.03, 0.36), (-W / 2 + 0.07, FRONT - 0.095, 0.93), chrome, col,
                            0.008))
    for z in (0.78, 1.08):
        door_parts.append(_part(f"handle_post_{z}", (0.016, 0.04, 0.016), (-W / 2 + 0.07, FRONT - 0.075, z),
                                chrome, col))
    bin_m = M.glass("door_bin", (0.9, 0.97, 1.0), roughness=0.15)
    for k, z in enumerate((0.3, 0.62, 0.95)):
        door_parts.append(_part(f"bin_{k}_front", (W - 0.12, 0.008, 0.07), (0, FRONT + 0.085, z + 0.035), bin_m,
                                col))
        door_parts.append(_part(f"bin_{k}_floor", (W - 0.12, 0.08, 0.008), (0, FRONT + 0.045, z), inside, col))
    bottles = [((-0.2, 0.3), 0.21, (0.75, 0.08, 0.06)), ((-0.08, 0.3), 0.24, (0.95, 0.95, 0.92)),
               ((0.05, 0.3), 0.19, (0.25, 0.08, 0.35)), ((0.2, 0.3), 0.22, (0.15, 0.4, 0.2))]
    for k, ((x, z), h, c) in enumerate(bottles):
        b = _lathe(f"door_bottle_{k}", [(0.0, 0.0), (0.03, 0.0), (0.032, h * 0.65), (0.014, h * 0.85),
                                        (0.012, h), (0.0, h)],
                   M.ceramic(f"bottle_{k}", c, roughness=0.15), col, (x, FRONT + 0.045, z + 0.005), segs=24)
        door_parts.append(b)
    eggs = _blobs("door_eggs", [((x, FRONT + 0.045, 0.66), (0.022, 0.022, 0.03)) for x in
                                (-0.22, -0.16, -0.1, -0.04, 0.02, 0.08)], M.ceramic("egg", (0.93, 0.85, 0.72), 0.4),
                  col, rings=8, segs=12, subsurf=1)
    door_parts.append(eggs)
    # outside: magnets and a note ("DİYET → PAZARTESİ")
    note = _part("door_note", (0.12, 0.002, 0.11), (0.08, FRONT - 0.066, 0.98), M.plastic("note_paper",
                                                                                    (0.97, 0.93, 0.6), 0.8), col)
    note.rotation_euler = (0, math.radians(-6), 0)
    door_parts.append(note)
    txt = text_mesh("door_note_text", "DİYET\nPAZARTESİ", 0.016, FONT, col, extrude=0.0)
    txt.data.materials.append(M.plastic("note_ink", (0.15, 0.2, 0.55), 0.6))
    for v in txt.data.vertices:
        x, y, _z = v.co
        v.co = (0.08 + x, FRONT - 0.0675, 0.975 + y)
    door_parts.append(txt)
    for k, (x, z, c) in enumerate(((0.08, 1.03, (0.9, 0.2, 0.2)), (-0.12, 0.82, (0.95, 0.75, 0.1)),
                                   (0.2, 0.7, (0.2, 0.6, 0.3)))):
        door_parts.append(_blobs(f"magnet_{k}", [((x, FRONT - 0.072, z), (0.018, 0.008, 0.018))],
                                 M.plastic(f"magnet_{k}", c, 0.3), col, rings=8, segs=12, subsurf=1))
    for p in door_parts:
        rigid(p, "door")

    # ---------------------------------------------------------------- interior (static, rides with the rig object)
    interior = []
    for k, z in enumerate(SHELVES):
        interior.append(_part(f"shelf_{k}", (W - 0.08, D - 0.16, 0.008), (0, 0.02, z), glass, col))
        interior.append(_part(f"shelf_{k}_rim", (W - 0.08, 0.012, 0.02), (0, FRONT + 0.1, z), inside, col, 0.004))
    crisper = M.glass("crisper", (0.85, 0.93, 0.95), roughness=0.35)
    interior.append(_part("crisper", (W - 0.1, D - 0.18, 0.22), (0, 0.02, 0.2), crisper, col, 0.01))
    interior.append(_blobs("tomatoes", [((-0.15, -0.02, 0.15), (0.045, 0.045, 0.04)),
                                        ((-0.06, 0.05, 0.15), (0.045, 0.045, 0.04)),
                                        ((0.12, 0.0, 0.15), (0.03, 0.12, 0.03))],
                           M.plastic("veg", (0.8, 0.12, 0.06), 0.35), col, rings=10, segs=14, subsurf=1))
    strip = _part("fridge_light_strip", (0.3, 0.04, 0.008), (0, FRONT + 0.12, CAB_Z[1] - 0.05), glow, col)
    interior.append(strip)
    # food: pickles, a pot of last night's dinner, yoghurt, half a lemon
    interior.append(_lathe("pickle_jar", [(0.0, 0.0), (0.05, 0.0), (0.052, 0.14), (0.04, 0.16), (0.0, 0.16)],
                           M.glass("pickle_glass", (0.6, 0.85, 0.4), roughness=0.08), col,
                           (-0.2, 0.12, SHELVES[1] + 0.006), segs=32))
    interior.append(_blobs("pickles", [((-0.2 + dx, 0.12 + dy, SHELVES[1] + 0.06), (0.012, 0.012, 0.045))
                                       for dx, dy in ((-0.015, 0.0), (0.015, 0.01), (0.0, -0.018))],
                           M.plastic("pickle", (0.3, 0.45, 0.1), 0.5), col, rings=8, segs=10))
    pot_m = M.metal("pot_steel", (0.7, 0.7, 0.72), 0.25)
    interior.append(_lathe("pot", [(0.0, 0.0), (0.11, 0.0), (0.115, 0.1), (0.118, 0.105), (0.0, 0.105)], pot_m,
                           col, (0.05, 0.06, SHELVES[0] + 0.006), segs=32))
    interior.append(_lathe("pot_lid", [(0.0, 0.0), (0.12, 0.0), (0.08, 0.02), (0.012, 0.03), (0.0, 0.035)], pot_m,
                           col, (0.05, 0.06, SHELVES[0] + 0.11), segs=32))
    interior.append(_lathe("yoghurt", [(0.0, 0.0), (0.06, 0.0), (0.07, 0.1), (0.0, 0.1)],
                           M.plastic("yoghurt_tub", (0.95, 0.95, 0.97), 0.4), col, (-0.22, 0.13, SHELVES[0] + 0.006),
                           segs=32))
    interior += _stock(col, inside)
    for o in interior:
        o.parent = arm

    # ---------------------------------------------------------------- light inside (keyed by the episode)
    lamp = bpy.data.lights.new("fridge_lamp", "AREA")
    lamp.shape = "RECTANGLE"
    lamp.size, lamp.size_y = 0.55, 0.4
    lamp.energy = 0.0
    lamp.color = (0.85, 0.93, 1.0)
    lamp_obj = bpy.data.objects.new("fridge_lamp", lamp)
    link(lamp_obj, col)
    lamp_obj.parent = arm
    lamp_obj.location = (0, -0.05, CAB_Z[1] - 0.07)            # points down (-Z) by default
    spill = bpy.data.lights.new("fridge_spill", "AREA")
    spill.shape = "RECTANGLE"
    spill.size, spill.size_y = 0.6, 1.0
    spill.energy = 0.0
    spill.color = (0.85, 0.93, 1.0)
    spill_obj = bpy.data.objects.new("fridge_spill", spill)
    link(spill_obj, col)
    spill_obj.parent = arm
    spill_obj.location = (0, FRONT + 0.05, 0.65)                 # the open doorway: cold light into the room
    spill_obj.rotation_euler = (math.radians(90), 0, 0)          # -Z -> -Y

    # ---------------------------------------------------------------- face on the freezer door
    arm.location = loc
    arm.rotation_euler = rot
    bpy.context.view_layer.update()
    mw = arm.matrix_world
    anchor = empty("buzdolabi_face", mw @ Vector((0, FRONT, FACE_Z)), 0.03, col)
    anchor.matrix_world = look_rotation(mw.to_3x3() @ Vector((0, -1, 0))).to_4x4()
    anchor.location = mw @ Vector((0, FRONT, FACE_Z))
    set_parent_keep(anchor, arm, "BONE", bone="head")
    anchor.scale = (FACE_SCALE,) * 3
    bpy.context.view_layer.update()
    spec = FaceSpec(skin=enamel, lip=lip, brow=brow, iris=(0.33, 0.56, 0.74), eye_r=0.05, eye_dx=0.09,
                    eye_z=0.035, eye_embed=0.35, brow_len=0.085, brow_th=0.014, brow_z=0.06, brow_arch=0.004,
                    mouth_z=-0.085, mouth_w=0.06, lip_w=0.01, rest_lid_u=0.32, rest_lid_l=0.12)
    face = Face("buzdolabi", spec, anchor, head)
    ch = Buzdolabi("buzdolabi", arm, head, face, loc, rot)
    ch.lamp, ch.spill, ch.glow = lamp_obj, spill_obj, glow
    return ch


class Buzdolabi(Character):
    squash_bone = "head"
    rot_map = {
        "nod": [("head", 0, 1.0)],
        "lean_f": [("head", 0, 0.6)],
        "tilt": [("head", 2, 1.0)],
        "lean_s": [("head", 2, 0.6)],
        "twist": [("head", 1, 1.0)],
        "door": [("door", 1, 1.0)],
    }
