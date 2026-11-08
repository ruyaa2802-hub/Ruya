"""B05 memories: the pillow and the blanket's happiest moments, rendered square (640x640) for
the thought balloon. Wordless. Five short vignettes in the warm living room (ig/sets/salon.py):

  1  on the sofa, arms round each other, laughing
  2  the blanket wraps the pillow up, warm and snug
  3  watching TV together, falling asleep against each other
  4  the blanket tucked over the pillow, the pillow smiling under it
  5  hugging and hopping for joy on the rug

    .venv/bin/python tools/build_episode.py episodes/b05_meclis_kacti --script memories \\
        --preset final --size 640x640 --out renders/b05_mem
"""
import importlib.util
import math
import os

_spec = importlib.util.spec_from_file_location("b05", os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                                                 "episode.py"))
_b05 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_b05)

CAST = ("yastik", "battaniye")
LIGHT_OPTS = dict(night=True)
LENGTH = _b05.MEM_LEN
SO = (-40.0, 0.0, 0.0)
SEAT_Z, SEAT_FRONT = 0.44, 0.15
HOME = {"yastik": dict(loc=(SO[0] - 0.28, SO[1] + SEAT_FRONT + 0.32, SEAT_Z), rot=(math.radians(-8), 0, 0)),
        "battaniye": dict(loc=(SO[0] + 0.3, SO[1] + SEAT_FRONT + 0.3, SEAT_Z), rot=(0, 0, 0))}


def build(tl, ep):
    import bpy
    from mathutils import Vector

    from ig.sets import salon

    st = salon.build()
    sc = bpy.context.scene
    sc.render.resolution_x, sc.render.resolution_y = 640, 640
    if bpy.data.objects.get("Sun"):
        bpy.data.objects["Sun"].data.energy = 0.0                   # the bedroom's moon stays out of here
    Y, B = "yastik", "battaniye"
    y0, b0 = Vector(tl.chars[Y].base_loc), Vector(tl.chars[B].base_loc)
    O = Vector(SO)
    seg = LENGTH / 5
    T = [k * seg for k in range(6)]

    def put(who, t, p, turn=0.0, **extra):
        base = y0 if who == Y else b0
        d = O + Vector(p) - base
        tl.set(who, t - 0.02, 0.01, "linear", pos_x=d.x, pos_y=d.y, pos_z=d.z, turn=turn, **extra)

    # 1) laughing together on the sofa, arms round each other
    for who, side in ((Y, 1), (B, -1)):
        tl.expr(who, 0.0, "happy", 0.1, m_open=0.55, squint=0.6)
        tl.set(who, 0.0, 0.1, lean_s=0.14 * side, tilt=0.08 * side)
        tl.shake(who, 0.15, seg - 0.2, "squash", 0.035, 7, decay=False)
        tl.shake(who, 0.15, seg - 0.2, "nod", 0.03, 7, decay=False)
    tl.set(B, 0.0, 0.1, arm_R_raise=1.3, arm_R_fold=0.9, arm_R_curl=0.6)
    tl.set(Y, 0.0, 0.1, arm_L_raise=0.9, arm_L_fold=0.6)
    tl.look(Y, 0.0, B, 0.1, head=0.3)
    tl.look(B, 0.0, Y, 0.1, head=0.3)
    tl.shot(0.0, "m1", tuple(O + Vector((0.05, -1.25, 0.78))), tuple(O + Vector((0.0, 0.45, 0.66))), lens=34,
            fstop=2.8, to_loc=tuple(O + Vector((0.05, -1.1, 0.76))), dur=seg)

    # 2) the blanket wraps the pillow up
    put(Y, T[1], (-0.1, SEAT_FRONT + 0.32, SEAT_Z))
    put(B, T[1], (0.12, SEAT_FRONT + 0.42, SEAT_Z + 0.02), turn=0.55)
    tl.set(Y, T[1], 0.01, lean_s=0.0, tilt=0.06, arm_L_raise=0.0, arm_L_fold=0.0)
    tl.expr(Y, T[1], "touched", 0.01, lid_u=0.6)
    tl.eyes_closed(Y, T[1] + 0.35, T[2] - 0.05)
    tl.set(B, T[1], 0.01, lean_s=0.0, tilt=-0.05)
    tl.set(B, T[1] + 0.05, 0.6, lean_f=0.4, arm_L_raise=1.4, arm_L_fold=1.1, arm_L_curl=0.9,
           arm_R_raise=1.4, arm_R_fold=1.1, arm_R_curl=0.9)
    tl.expr(B, T[1], "fond", 0.01, lid_u=0.35)
    tl.shot(T[1], "m2", tuple(O + Vector((-0.25, -0.75, 0.72))), tuple(O + Vector((0.0, 0.5, 0.64))), lens=36,
            fstop=2.4, to_loc=tuple(O + Vector((-0.2, -0.62, 0.72))), dur=seg)

    # 3) TV night: side by side, eyes slowly closing, heads sinking together
    put(Y, T[2], (-0.22, SEAT_FRONT + 0.34, SEAT_Z))
    put(B, T[2], (0.24, SEAT_FRONT + 0.32, SEAT_Z))
    for who, side in ((Y, 1), (B, -1)):
        tl.set(who, T[2], 0.01, lean_f=0.0, lean_s=0.0, tilt=0.0, arm_L_raise=0.0, arm_L_fold=0.0, arm_L_curl=0.0,
               arm_R_raise=0.0, arm_R_fold=0.0, arm_R_curl=0.0, gaze_x=0.0, gaze_y=-0.05)
        tl.expr(who, T[2], "fond", 0.01, lid_u=0.2)
        tl.expr(who, T[2] + 0.5, "tired", 1.0, lid_u=0.75, m_smile=0.3)
        tl.set(who, T[2] + 0.6, 1.0, lean_s=0.2 * side, tilt=0.14 * side)
        tl.eyes_closed(who, T[3] - 0.45, T[3] - 0.02)
    tl.shot(T[2], "m3", tuple(O + Vector((0.35, -1.35, 0.62))), tuple(O + Vector((0.0, 0.45, 0.64))), lens=34,
            fstop=2.8, to_loc=tuple(O + Vector((0.3, -1.2, 0.63))), dur=seg)

    # 4) tucked in: the blanket draped over the pillow, the pillow smiling under it
    put(Y, T[3], (0.0, SEAT_FRONT + 0.3, SEAT_Z), turn=0.0)
    put(B, T[3], (0.0, SEAT_FRONT + 0.55, SEAT_Z + 0.16), turn=0.0)
    tl.set(Y, T[3], 0.01, lean_s=0.0, tilt=-0.05)
    tl.set(B, T[3], 0.01, lean_s=0.0, tilt=0.0, lean_f=0.75, arm_L_raise=1.0, arm_R_raise=1.0, arm_L_fold=0.6,
           arm_R_fold=0.6)
    tl.expr(Y, T[3], "happy", 0.01, squint=0.7, m_open=0.1)
    tl.expr(B, T[3], "fond", 0.01, lid_u=0.6)
    tl.shot(T[3], "m4", tuple(O + Vector((0.08, -0.95, 0.8))), tuple(O + Vector((0.0, 0.5, 0.72))), lens=36,
            fstop=2.4, to_loc=tuple(O + Vector((0.06, -0.82, 0.78))), dur=seg)

    # 5) hugging and hopping for joy on the rug
    put(Y, T[4], (-0.2, -0.4, 0.0))
    put(B, T[4], (0.2, -0.38, 0.0))
    for who, side, ph in ((Y, 1, 0.0), (B, -1, 0.18)):
        tl.set(who, T[4], 0.01, lean_f=0.0, lean_s=0.12 * side, tilt=0.06 * side, arm_L_raise=1.6, arm_R_raise=1.6,
               arm_L_fold=0.3, arm_R_fold=0.3)
        tl.expr(who, T[4], "happy", 0.01, m_open=0.6, squint=0.5)
        for k in range(3):
            tl.hop(who, T[4] + 0.12 + ph + k * 0.5, 0.11, 0.42, 0.16)
    tl.shot(T[4], "m5", tuple(O + Vector((0.0, -2.0, 0.65))), tuple(O + Vector((0.0, -0.3, 0.45))), lens=30,
            fstop=3.2, to_loc=tuple(O + Vector((0.0, -1.85, 0.62))), dur=seg)

    # TV flicker during vignette 3 (keys on the screen and its light)
    scr = st["screen"].data.materials[0].node_tree.nodes["Emission"].inputs["Strength"]
    tvl = st["tv_light"].data
    import random
    rng = random.Random(5)
    for f in range(0, int(LENGTH * tl.fps) + 1, 3):
        t = f / tl.fps
        on = T[2] - 0.1 <= t <= T[3]
        v = rng.uniform(0.6, 1.0) if on else 0.0
        scr.default_value = 4.0 * v
        scr.keyframe_insert("default_value", frame=f)
        tvl.energy = 45 * v
        tvl.keyframe_insert("energy", frame=f)
    tl.duration = LENGTH
