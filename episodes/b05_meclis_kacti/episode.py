"""EŞYA MECLİSİ – BÖLÜM 2 "Oy Çokluğu ile Kaçtı" (~37 s, 9:16). Follows "Yastığın Kaçışı".

The audience voted: keep running. The pillow spends the night on a park bench, dreams of
its happiest moments with the blanket (a thought balloon, warm and golden), sheds one tear –
and the camera dives into the falling drop and comes out in the dark bedroom, where the
blanket, hidden behind the wardrobe, misses the pillow. Then: "Şimdi sıra battaniyede…"

Only one spoken line (the pillow, scene 1). Everything else is wordless: faces, bodies,
piano (ig/music.py piano(), scored below to the action), night ambience and small sounds.

Renders:
  episodes/b05_meclis_kacti/memories.py  – the memories (warm living room), a separate 640x640 pass
  this script                             – park + bedroom; post_video() composites the thought
                                            balloon, the drop flash and the final dim; post_ass()
                                            writes the closing question.
Free tools only: Blender/Cycles, Chatterbox (voice, cloned from the B01 pillow voice), numpy, ffmpeg.
"""
import math
import os
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CAST = ("yastik", "battaniye")
TITLE = "EŞYA MECLİSİ – BÖLÜM 2\nOY ÇOKLUĞU İLE KAÇTI"
TITLE_AT = (0.3, 2.5)
SET_OPTS = dict(door=True, wardrobe=True)
LIGHT_OPTS = dict(night=True)
PACING = {}
LINES = {"L01_yastik": "Oy çokluğu ile kaçmama karar verildi. O zaman bu geceyi bankta geçirelim bakalım…"}

# ------------------------------------------------------------------ timing (seconds)
T_LINE = 2.75          # the pillow speaks
T_LIE = 7.05           # lays its head down on the bench
T_BUBBLE = 8.7         # little thought bubbles rise
T_MEM = 9.25           # the balloon with the memories
T_MEM_END = 19.0
T_TEAR = 20.6          # a tear wells up
T_SLIDE = 21.3
T_DETACH = 22.55       # it drips off and falls (slow motion)
T_CUT = 24.6           # into the drop -> the bedroom
T_STROKE = 27.0        # on the bed: strokes the empty spot
T_HIDE = 29.0          # behind the wardrobe, crying
T_REACH = 30.9         # reaches toward the door...
T_SCARED = 31.85       # ...a floorboard creaks, it pulls back
T_FREEZE = 33.2        # looking at the door: the last frame is held
LENGTH = 37.6
RENDER_END = T_FREEZE
T_QUESTION = 34.0
MEM_LEN = T_MEM_END - T_MEM - 0.4          # memories.py renders this much

# park layout (local to ig.sets.park.ORIGIN)
P_START = (0.45, 0.45, 0.0)
P_SEAT_X = -0.3
P_SEAT_Y_OFF = 0.09                        # pillow centre this far behind the seat front edge
HOME = {"yastik": dict(loc=(40.45, 30.45, 0.0), rot=(0, 0, 0)),
        "battaniye": dict(loc=(2.85, 1.0, 0.0), rot=(0, 0, 0))}
BED_SPOT = (-0.3, 0.86, 0.56)              # where the pillow used to lie
B_BED = (0.18, 0.66, 0.545)
B_HIDE = (2.85, 1.0, 0.0)
DOOR = (-1.75, -1.55, 0.9)


def _smooth(a, b, t):
    k = min(max((t - a) / (b - a), 0.0), 1.0)
    return k * k * (3 - 2 * k)


# ------------------------------------------------------------------ piano score
def _score():
    """Original piece. A minor -> warm C major memories -> thin, falling notes for the tear ->
    lament in A minor -> stop. Returns (main events, closing chord events)."""
    ev = []

    def arp(t0, notes, step, vel, n=None, dur=1.6):
        for i, nm in enumerate(notes if n is None else (notes * 4)[:n]):
            ev.append((t0 + i * step, nm, dur, vel))

    def mel(seq, vel):
        for t0, nm, d in seq:
            ev.append((t0, nm, d, vel))

    # A: the bench (soft, A minor)
    arp(6.5, ["A2", "E3", "A3", "C4"], 0.47, 0.32, n=6)
    mel([(7.45, "E5", 1.3), (8.4, "D5", 0.6), (8.85, "C5", 0.6)], 0.38)
    # B: memories – warm, fuller (C major)
    chords = [["F2", "C3", "A3"], ["E2", "C3", "G3"], ["G2", "D3", "B3"], ["A2", "E3", "C4"],
              ["F2", "C3", "A3"], ["C3", "G3", "E4"], ["G2", "D3", "B3"], ["C3", "G3", "C4"]]
    melody = [["A4", "C5"], ["G4", "E5"], ["D5", "B4"], ["C5", "E5"], ["F5", "A5"], ["G5", "E5"], ["D5", "F5"],
              ["E5", "C5"]]
    step = (T_MEM_END - T_MEM) / len(chords)
    for k, (ch, me) in enumerate(zip(chords, melody)):
        t0 = T_MEM + k * step
        arp(t0, ch, step / 3, 0.42, dur=step * 1.2)
        mel([(t0 + 0.05, me[0], step * 0.55), (t0 + step * 0.55, me[1], step * 0.5)], 0.52)
    ev.append((T_MEM + 8 * step - 0.2, "C6", 1.5, 0.25))
    # C: the smile fades, the tear
    arp(T_MEM_END, ["A2", "E3", "A3", "C4"], 0.6, 0.28, dur=3.0)
    mel([(T_TEAR + 0.3, "E5", 1.4), (T_DETACH - 0.1, "D5", 0.7), (T_DETACH + 0.55, "C5", 0.7),
         (T_DETACH + 1.15, "B4", 0.9)], 0.3)
    ev += [(T_CUT - 0.35, "A1", 3.0, 0.45), (T_CUT - 0.35, "A2", 3.0, 0.4), (T_CUT, "E6", 1.8, 0.2)]
    # D: the blanket alone – lament
    lam = [(25.0, ["A2", "E3", "C4"]), (27.0, ["G2", "E3", "B3"]), (29.0, ["F2", "C3", "A3"]), (30.9, ["E2", "B2", "G#3"])]
    for t0, ch in lam:
        arp(t0, ch, 0.42, 0.33, dur=2.2)
    mel([(25.45, "C5", 0.9), (26.3, "B4", 0.5), (26.75, "A4", 1.2),
         (27.45, "B4", 0.9), (28.3, "G4", 0.5), (28.75, "E4", 1.2),
         (29.4, "A4", 0.5), (29.85, "C5", 0.5), (30.3, "F5", 0.8)], 0.42)
    mel([(30.95, "E5", 0.5), (31.3, "G#4", 0.4), (31.55, "B4", 0.35)], 0.55)       # reaching...
    ev += [(32.25, "E2", 1.0, 0.3), (32.6, "B4", 0.6, 0.22)]                         # ...pulled back
    end = [(T_QUESTION + k * 0.08, nm, 3.4, 0.33) for k, nm in enumerate(["A2", "E3", "B3", "C4", "E4"])]
    return [e for e in ev if e[0] + 0.0 < T_FREEZE], end


def _write_music(ep):
    import numpy as np
    import soundfile as sf

    from ig.music import piano
    from ig.sfx import SR
    main, end = _score()
    a = piano(main, T_FREEZE + 2.5)
    b = piano([(t - T_QUESTION, n, d, v) for t, n, d, v in end], LENGTH - T_QUESTION + 0.5)
    paths = []
    for name, x in (("music_main.wav", a), ("music_end.wav", b)):
        x = x / (np.abs(x).max() + 1e-9) * 0.7
        path = os.path.join(ep, "audio", name)
        sf.write(path, x.astype(np.float32), SR)
        paths.append(path)
    return paths


def build(tl, ep):
    import bpy
    from mathutils import Matrix, Vector

    from ig import materials as M
    from ig.face import surface_depth
    from ig.sets import park

    A = lambda lid: os.path.join(ep, "audio", "paced", lid + ".wav")
    S = lambda f: os.path.join(ROOT, "assets", "sfx", f)
    Y, B = "yastik", "battaniye"
    fps = tl.fps
    pk = park.build()
    PO = park.ORIGIN
    cy, cb = tl.chars[Y], tl.chars[B]
    y_home = Vector(cy.base_loc)
    b_home = Vector(cb.base_loc)

    def ry(p):                                           # world -> pillow pos offsets
        d = Vector(p) - y_home
        return dict(pos_x=d.x, pos_y=d.y, pos_z=d.z)

    def rb(p):
        d = Vector(p) - b_home
        return dict(pos_x=d.x, pos_y=d.y, pos_z=d.z)

    def lift(pitch, roll):
        """How far the pillow's origin must rise so its lowest corner rests on the seat."""
        R = Matrix.Rotation(roll, 3, "Y") @ Matrix.Rotation(pitch, 3, "X")
        return -min((R @ Vector((x, y, z))).z for x in (-0.3, 0.3) for y in (-0.09, 0.09) for z in (0.0, 0.42))

    def seat(pitch, roll, dy, dx=0.0):
        return PO + Vector((P_SEAT_X + dx, park.SEAT_FRONT + dy, park.SEAT_Z + lift(pitch, roll) - 0.01))
    # talking: leaning back against the backrest; lying: on its back along the seat, tipped a little to us
    PT_TALK, PT_LIE, RL_LIE = math.radians(-24), math.radians(-72), math.radians(14)

    # ============================================================ PARK
    l01 = tl.say(Y, T_LINE, A("L01_yastik"), intensity=0.7, bob=0.4)
    # slowly onto the bench, half lying against the armrest while it talks
    tl.expr(Y, 0.0, "tired", 0.1)
    tl.look(Y, 0.2, PO + Vector((P_SEAT_X, 1.2, 0.5)), 0.4, head=0.3)
    tl.pulse(Y, 0.55, 0.9, squash=-0.06, nod=-0.04)                          # sigh
    t_up = 1.25
    tl.set(Y, t_up, 0.5, **ry(seat(0.0, 0.0, 0.2)))
    tl.hop(Y, t_up, 0.16, 0.5, 0.14)
    tl.set(Y, t_up + 0.75, 0.9, "inout", pitch=PT_TALK, **ry(seat(PT_TALK, 0.0, 0.26)))
    tl.look_cam(Y, T_LINE - 0.3, 0.3)
    tl.expr(Y, T_LINE - 0.2, "tired", 0.3, brow_up=0.35, brow_ang=-0.4)
    tl.expr(Y, l01.find("karar") - 0.1, "sarcastic", 0.3, lid_u=0.35)
    tl.expr(Y, l01.find("zaman") - 0.1, "tired", 0.3, m_smile=0.15)
    tl.set(Y, l01.find("bank") - 0.1, 0.4, arm_R_raise=0.6, arm_R_fold=0.4)  # pats the bench
    tl.set(Y, l01.end - 0.2, 0.4, arm_R_raise=0.0, arm_R_fold=0.0)
    # head down on the bench
    tl.set(Y, T_LIE, 1.2, "inout", pitch=PT_LIE, roll=RL_LIE, **ry(seat(PT_LIE, RL_LIE, 0.03)))
    tl.expr(Y, T_LIE + 0.2, "sad", 0.8, lid_u=0.45, m_frown=0.25)
    # dreaming: looks up into the balloon, the smile grows
    tl.set(Y, T_BUBBLE - 0.3, 0.6, gaze_x=-0.35, gaze_y=0.25)
    tl.expr(Y, T_MEM - 0.2, "wistful", 0.8, lid_u=0.35)
    tl.expr(Y, T_MEM + 2.0, "fond", 0.8, lid_u=0.3)
    tl.expr(Y, T_MEM + 5.5, "happy", 0.8, squint=0.5, m_open=0.1)
    tl.shake(Y, T_MEM + 6.0, 0.9, "squash", 0.02, 6)                         # a little laugh
    tl.expr(Y, T_MEM + 7.8, "fond", 0.6, lid_u=0.3)
    tl.set(Y, T_MEM_END - 0.6, 0.8, gaze_x=0.0, gaze_y=0.0)
    tl.expr(Y, T_MEM_END - 0.2, "wistful", 0.6, m_smile=0.15)
    tl.expr(Y, T_MEM_END + 0.7, "sad", 0.9, lid_u=0.35, brow_up=0.8)          # the smile fades
    tl.pulse(Y, T_TEAR - 0.1, 0.8, nod=-0.03, squash=-0.03)
    tl.expr(Y, T_TEAR + 0.2, "sad", 0.4, lid_u=0.45, brow_up=1.0, m_frown=0.5)
    tl.blink_off[Y].append((T_TEAR - 0.5, T_CUT))

    # ------------------------------------------------------------ the tear
    water = _tear_material()
    anchor = cy.face.anchor
    spec = cy.face.spec
    tear = _drop("tear_face", water, 0.012)
    tear.parent = anchor
    tear.matrix_parent_inverse = Matrix.Identity(4)
    tear.location = (0, 0, 0)
    bpy.context.view_layer.update()
    m_lie = tl.face_matrix(Y, T_SLIDE)
    g = m_lie.to_3x3().inverted() @ Vector((0, 0, -1))                  # gravity in the face's own axes
    side = 1.0 if g.x > 0 else -1.0                                     # the lower side of the tipped face
    g2 = Vector((0.35 * side, 0.0, -1.0)).normalized()                  # down the face toward the front edge (and us)
    eye_x = spec.eye_dx * side
    start = Vector((eye_x + g2.x * spec.eye_r * 0.9, 0, spec.eye_z + g2.z * spec.eye_r * 0.9))
    rest_mw = anchor.matrix_world.copy()
    pts = []
    for k in range(12):
        q = start + g2 * (0.019 * k)
        y = surface_depth(cy.body, rest_mw, q.x, q.z, fallback=0.0)
        pts.append(Vector((q.x, y - 0.006, q.z)))
    slide_len = len(pts) - 1

    def tear_fn(t):
        if t < T_TEAR or t >= T_DETACH:
            return {"location": tuple(pts[0]), "scale": (-1, -1, -1)}
        grow = _smooth(T_TEAR, T_TEAR + 0.6, t)
        u = _smooth(T_SLIDE, T_DETACH, t) ** 1.3 * slide_len
        i = min(int(u), slide_len - 1)
        p = pts[i].lerp(pts[i + 1], u - i)
        s = 0.35 + 0.65 * grow
        stretch = 1.0 + 0.35 * min(1.0, (t - T_SLIDE) / 0.4) if t > T_SLIDE else 1.0
        return {"location": tuple(p), "scale": (s - 1, s - 1, s * stretch - 1)}

    tl.prop(tear, tear_fn)
    det_local = pts[-1]
    det_world = tl.face_matrix(Y, T_DETACH) @ det_local
    det_world.y = min(det_world.y, PO.y + park.SEAT_FRONT - 0.02)            # clear of the seat's edge
    clear = M.glass("drop_clear", (0.9, 0.96, 1.0), 0.0)               # the macro drop: pure, clear water
    fall = _drop("tear_fall", clear, 0.013)
    fall.location = det_world
    floor_z = PO.z + 0.03
    T_FALL = T_CUT - T_DETACH

    def fall_pos(t):
        u = min(max((t - T_DETACH) / T_FALL, 0.0), 1.0)
        return det_world + Vector((0.0, -0.01 * u, -(det_world.z - floor_z - 0.1) * (0.15 * u + 0.85 * u * u)))

    def fall_fn(t):
        if t < T_DETACH or t > T_CUT + 0.05:
            return {"scale": (-1, -1, -1)}
        w = math.sin((t - T_DETACH) * 9.0) * 0.08 * math.exp(-(t - T_DETACH) * 0.8)   # slow wobble
        return {"location": tuple(fall_pos(t) - det_world), "scale": (w, w, 0.12 - w)}

    tl.prop(fall, fall_fn)

    # ============================================================ BEDROOM (the blanket, alone)
    # no owner tonight; fairy lights almost out, the door shut with the hall light under it
    bulb = bpy.data.materials.get("bulb_warm")
    if bulb:
        bulb.node_tree.nodes["Emission"].inputs["Strength"].default_value = 3.0
    if bpy.data.objects.get("FairyGlow"):
        bpy.data.objects["FairyGlow"].data.energy = 1.0
    def area(name, energy, size, loc, target, color):
        light = bpy.data.lights.new(name, "AREA")
        light.energy, light.size, light.color = energy, size, color
        obj = bpy.data.objects.new(name, light)
        bpy.context.scene.collection.objects.link(obj)
        obj.location = loc
        obj.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        return obj
    # moonlight reaching the wardrobe corner, and a faint warm bounce from the hallway side
    area("CornerMoon", 28, 1.2, (2.2, -1.2, 2.3), (2.8, 1.0, 0.45), (0.5, 0.62, 1.0))
    area("CornerWarm", 6, 1.0, (0.8, -0.6, 0.6), (2.8, 1.0, 0.45), (1.0, 0.7, 0.45))
    area("CornerFill", 10, 1.0, (3.6, -0.6, 1.1), (2.8, 1.0, 0.45), (0.55, 0.65, 1.0))
    # a small catchlight so the tear glints in the park close-ups
    sparkle = bpy.data.lights.new("tear_glint", "POINT")
    sparkle.energy, sparkle.shadow_soft_size, sparkle.color = 0.0, 0.02, (0.8, 0.9, 1.0)
    so = bpy.data.objects.new("tear_glint", sparkle)
    bpy.context.scene.collection.objects.link(so)
    so.location = tl.face_matrix(Y, T_TEAR) @ Vector((0.0, -0.35, 0.15))
    for t, v in ((0.0, 0.0), (T_MEM_END, 0.0), (T_TEAR - 0.3, 2.5), (T_DETACH - 0.05, 0.9), (T_CUT + 0.05, 0.0)):
        sparkle.energy = v
        sparkle.keyframe_insert("energy", frame=int(round(t * fps)))
    hide, bed = Vector(B_HIDE), Vector(B_BED)
    face_room = -1.05                                    # facing the room / the bed
    face_door = -1.25
    tl.set(B, 0.0, 0.01, turn=face_room)
    tl.expr(B, T_CUT - 0.2, "sad", 0.1, brow_up=0.9, lid_u=0.2, m_frown=0.6)
    tl.layer(B, lambda t: {"tilt": 0.012 * math.sin(t * 31), "squash": 0.008 * math.sin(t * 23)},
             T_CUT - 0.2, T_FREEZE + 1)                                     # trembling
    # 1) hidden behind the wardrobe, peeking at the bed
    tl.set(B, T_CUT - 0.2, 0.3, lean_s=0.18, lean_f=0.05)
    tl.look(B, T_CUT, BED_SPOT, 0.4, head=0.35)
    tl.set(B, T_CUT + 1.2, 0.5, lean_s=0.25)
    # 2) on the bed beside the empty spot: looks at it, strokes it
    tl.set(B, T_STROKE - 0.03, 0.01, "linear", turn=-1.35, lean_s=0.0, **rb(bed))
    tl.look(B, T_STROKE, BED_SPOT, 0.3, head=0.6, up=-0.2)
    tl.expr(B, T_STROKE, "sad", 0.3, brow_up=1.0, lid_u=0.3, m_frown=0.5)
    tl.set(B, T_STROKE + 0.15, 0.4, lean_f=0.35, arm_R_raise=1.0, arm_R_fold=0.3, arm_R_curl=0.2)
    tl.layer(B, lambda t: {"arm_R_fold": 0.22 * math.sin((t - T_STROKE) * 5.5), "arm_R_raise": 0.12 * math.sin((t - T_STROKE) * 5.5 + 1.2)},
             T_STROKE + 0.5, T_HIDE - 0.2)
    tl.set(B, T_HIDE - 0.4, 0.3, lean_f=0.1, arm_R_raise=0.0, arm_R_fold=0.0, arm_R_curl=0.0)
    # 3) behind the wardrobe again: crying quietly, waiting
    tl.set(B, T_HIDE - 0.03, 0.01, "linear", turn=face_door, lean_s=0.2, **rb(hide))
    tl.expr(B, T_HIDE, "sad", 0.3, brow_up=1.0, lid_u=0.5, m_frown=0.7, squint=0.3)
    tl.look(B, T_HIDE, DOOR, 0.4, head=0.3)
    for k in range(3):                                                    # sobs shake the body
        tl.pulse(B, T_HIDE + 0.3 + k * 0.55, 0.4, squash=-0.05, nod=-0.06)
    tl.set(B, T_HIDE + 0.2, 0.4, arm_L_raise=0.7, arm_L_fold=1.0, arm_L_curl=0.8)    # wipes the eyes
    tl.set(B, T_HIDE + 1.3, 0.4, arm_L_raise=0.0, arm_L_fold=0.0, arm_L_curl=0.0)
    # 4) reaches toward the door... a creak... pulls back
    tl.expr(B, T_REACH - 0.1, "wistful", 0.4, brow_up=0.9, lid_u=0.1, m_smile=0.0)
    tl.look(B, T_REACH - 0.1, DOOR, 0.3, head=0.5)
    tl.set(B, T_REACH, 0.8, lean_f=0.45, lean_s=0.0, arm_R_raise=1.5, arm_R_fold=0.0, arm_R_curl=0.0,
           **rb(hide + Vector((-0.22, -0.12, 0))))
    tl.expr(B, T_SCARED, "surprised", 0.1, m_open=0.3, brow_up=1.0)
    tl.set(B, T_SCARED + 0.05, 0.35, "out", lean_f=-0.1, lean_s=0.25, arm_R_raise=0.2, arm_L_raise=0.6,
           arm_L_fold=0.8, **rb(hide + Vector((0.05, 0.03, 0))))
    tl.shake(B, T_SCARED + 0.1, 0.7, "tilt", 0.06, 10)
    tl.expr(B, T_SCARED + 0.6, "sad", 0.5, brow_up=1.0, lid_u=0.15, m_frown=0.55)
    tl.set(B, T_SCARED + 0.9, 0.5, lean_f=0.05, arm_L_raise=0.0, arm_L_fold=0.0, arm_R_raise=0.0)
    tl.look(B, T_SCARED + 0.7, DOOR, 0.5, head=0.45)                       # ...and keeps looking at the door
    tl.blink_off[B].append((T_FREEZE - 0.8, LENGTH))

    # blanket tears: two drops that keep running from the eyes
    bspec, banc = cb.face.spec, cb.face.anchor
    btears = []
    for k, side in enumerate((-1, 1)):
        d = _drop(f"tear_b{k}", water, 0.007)
        d.parent = banc
        d.matrix_parent_inverse = Matrix.Identity(4)
        x = side * bspec.eye_dx
        z0 = bspec.eye_z - bspec.eye_r * 0.9
        y0 = surface_depth(cb.body, banc.matrix_world, x, z0, fallback=0.0) - 0.005
        y1 = surface_depth(cb.body, banc.matrix_world, x * 1.08, z0 - 0.09, fallback=0.0) - 0.005
        period, off = 1.25, k * 0.55

        def fn(t, x=x, z0=z0, y0=y0, y1=y1, period=period, off=off):
            if t < T_CUT:
                return {"location": (x, y0, z0), "scale": (-1, -1, -1)}
            u = ((t - T_CUT + off) % period) / period
            s = min(1.0, u / 0.15) * (1 - max(0.0, (u - 0.85) / 0.15))
            return {"location": (x * (1 + 0.08 * u), y0 + (y1 - y0) * u, z0 - 0.09 * u ** 1.4),
                    "scale": (s - 1, s - 1, s * 1.25 - 1)}
        d.location = (0, 0, 0)
        tl.prop(d, fn)
        btears.append(d)

    # the water drop the bedroom camera starts inside
    cam_start = Vector((1.55, 0.05, 0.62))
    look_hide = hide + Vector((0, 0, 0.42))
    dir_in = (look_hide - cam_start).normalized()
    inside = _drop("drop_lens", clear, 0.07, stretch=1.0)
    inside.location = cam_start
    tl.prop(inside, lambda t: {"scale": (0, 0, 0)} if t < T_CUT + 1.2 else {"scale": (-1, -1, -1)})

    # ============================================================ sound
    tl.sfx(0.0, S("park_amb.wav"), -11, dur=T_CUT, fade=0.4)
    tl.sfx(0.55, S("sigh.wav"), -8)
    tl.sfx(t_up + 0.5, S("poof.wav"), -9)
    tl.sfx(t_up + 0.8, S("creak.wav"), -20, dur=0.6, fade=0.2)
    tl.sfx(T_LIE + 0.2, S("sigh.wav"), -11)
    tl.sfx(T_LIE + 0.9, S("rustle_soft.wav"), -8)
    music_main, music_end = _write_music(ep)
    tl.sfx(0.0, music_main, -6, dur=T_FREEZE, fade=0.12)                   # the music stops dead
    tl.sfx(T_QUESTION, music_end, -8)
    tl.sfx(T_TEAR + 0.4, S("ding.wav"), -26)
    tl.sfx(T_CUT - 0.9, S("underwater.wav"), -7)
    tl.sfx(T_CUT - 0.12, S("drip.wav"), -9)
    tl.sfx(T_CUT, S("night_amb.wav"), -15, dur=LENGTH - T_CUT, fade=0.5)
    tl.sfx(T_STROKE + 0.1, S("rustle_soft.wav"), -9)
    tl.sfx(T_STROKE + 1.1, S("rustle_soft.wav"), -11)
    tl.sfx(T_HIDE + 0.15, S("sob.wav"), -12)
    tl.sfx(T_HIDE + 1.6, S("sniff.wav"), -16)
    tl.sfx(T_REACH + 0.1, S("rustle_soft.wav"), -10)
    tl.sfx(T_SCARED - 0.05, S("creak.wav"), -13, dur=0.5, fade=0.15)
    tl.sfx(T_SCARED + 0.1, S("rustle_soft.wav"), -8)
    tl.sfx(T_FREEZE - 0.6, S("sniff.wav"), -18)

    # ============================================================ cameras (9:16)
    PV = lambda x, y, z: tuple(PO + Vector((x, y, z)))
    tl.shot(0.0, "cam_open", PV(0.9, -3.4, 1.15), PV(-0.05, 1.3, 0.75), lens=24, fstop=5.0,
            to_loc=PV(0.6, -2.7, 1.0), dur=T_LINE - 0.3)
    tl.face_shot(T_LINE - 0.3, "cam_talk", Y, dist=1.6, yaw=8, height=0.05, lens=32, push=0.15,
                 dur=T_LIE - T_LINE + 0.3)
    # it lies down; the camera rises over it and slowly closes in on the face
    tl.shot(T_LIE - 0.05, "cam_lie", PV(P_SEAT_X + 0.1, -0.75, 1.0), PV(P_SEAT_X, 1.15, 0.58), lens=30, fstop=2.8,
            to_loc=PV(P_SEAT_X + 0.05, -0.35, 1.18), to_target=PV(P_SEAT_X, 1.2, 0.62), dur=T_BUBBLE - T_LIE,
            focus=Y)
    # dreaming: the pillow low in frame, room above it for the balloon (composited in post)
    tl.shot(T_BUBBLE - 0.2, "cam_dream", PV(P_SEAT_X + 0.05, -0.35, 1.18), PV(P_SEAT_X, 1.35, 0.95), lens=28,
            fstop=2.8, to_loc=PV(P_SEAT_X + 0.03, -0.2, 1.2), dur=T_MEM_END - T_BUBBLE + 0.6, focus=Y)
    tl.face_shot(T_MEM_END + 0.4, "cam_sad", Y, dist=0.75, yaw=0, height=0.04, lens=40, push=0.2,
                 dur=T_TEAR - T_MEM_END)
    eye_world = lambda t: tl.face_matrix(Y, t) @ (start + g2 * 0.07 + Vector((0, -0.01, 0)))
    tl.face_shot(T_TEAR - 0.2, "cam_eye", Y, dist=0.6, yaw=0, height=0.0, lens=55, fstop=2.2, push=0.12,
                 look=tuple(eye_world(T_TEAR) - tl.face_matrix(Y, T_TEAR).translation), dur=T_DETACH - T_TEAR)

    def drop_cam(t):
        """Macro: follow the falling drop, closing in until the camera is inside it."""
        p = fall_pos(t)
        u = _smooth(T_DETACH, T_CUT, t) ** 1.6
        dist = 0.3 * (1 - u) + 0.004 * u
        return (p + Vector((0.02 * (1 - u), -dist, 0.02 * (1 - u))), p, p)
    tl.shot(T_DETACH, "cam_drop", PV(0, -1, 0.5), PV(0, 1, 0.5), lens=60, fstop=1.8, track=drop_cam)
    bpy.data.objects["cam_drop"].data.clip_start = 0.0008

    def room_cam(t):
        """Out of the drop: the camera pulls back through its surface into the dark room."""
        u = _smooth(T_CUT, T_STROKE, t)
        back = 0.004 + 0.11 * _smooth(T_CUT, T_CUT + 0.9, t) + 0.8 * _smooth(T_CUT + 0.6, T_STROKE, t)
        loc = cam_start - dir_in * back + Vector((0, 0, 0.12 * u))
        return (loc, look_hide + Vector((0, 0, -0.05 * u)), look_hide)
    tl.shot(T_CUT, "cam_room", tuple(cam_start), tuple(look_hide), lens=30, fstop=2.8, track=room_cam)
    bpy.data.objects["cam_room"].data.clip_start = 0.0008
    tl.shot(T_STROKE - 0.03, "cam_bed", (-1.2, -0.5, 1.02), (-0.08, 0.78, 0.6), lens=30, fstop=3.2,
            to_loc=(-1.05, -0.35, 0.98), dur=T_HIDE - T_STROKE, focus=B)
    tl.shot(T_HIDE - 0.03, "cam_cry", (1.8, 0.3, 0.66), (2.82, 1.0, 0.55), lens=32, fstop=2.8,
            to_loc=(1.95, 0.4, 0.64), dur=T_REACH - T_HIDE, focus=B)
    # over the shoulder toward the far door: the reach and the retreat
    # from the door's side, low: the arm stretching out toward us (the door), then snatched back
    tl.shot(T_REACH - 0.1, "cam_reach", (1.25, 0.0, 0.38), (2.75, 0.95, 0.5), lens=26, fstop=3.2,
            to_loc=(1.3, 0.04, 0.39), dur=T_SCARED - T_REACH + 0.8, focus=B)
    tl.shot(T_SCARED + 0.75, "cam_last", (2.05, 0.05, 0.64), (2.8, 1.0, 0.5), lens=32, fstop=2.8,
            to_loc=(2.12, 0.15, 0.62), dur=T_FREEZE - T_SCARED - 0.75, focus=B)
    tl.duration = LENGTH


def _tear_material():
    """Water for tears: clear, refractive, with a faint cool glow so a drop reads in the dark."""
    import bpy
    mat = bpy.data.materials.get("tear_water")
    if mat:
        return mat
    mat = bpy.data.materials.new("tear_water")
    mat.use_nodes = True
    p = mat.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (0.9, 0.96, 1.0, 1)
    p.inputs["Roughness"].default_value = 0.0
    p.inputs["IOR"].default_value = 1.33
    p.inputs["Transmission Weight"].default_value = 1.0
    p.inputs["Emission Color"].default_value = (0.75, 0.88, 1.0, 1)
    p.inputs["Emission Strength"].default_value = 0.035
    mat["glass"] = True
    return mat


def _drop(name, mat, r, stretch=1.3):
    """A water drop (slightly pear-shaped), invisible to shadows so it never darkens what it sits on."""
    import bpy
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=24, ring_count=16)
    obj = bpy.context.active_object
    obj.name = name
    for v in obj.data.vertices:
        z = v.co.z / r
        v.co.z *= stretch
        k = 1.0 + 0.25 * max(0.0, z)                     # narrower on top
        v.co.x /= k
        v.co.y /= k
    obj.data.shade_smooth()
    obj.data.materials.append(mat)
    obj.visible_shadow = False
    return obj


# ------------------------------------------------------------------ post: balloon, flash, final dim
def _mask_png(path, w, h, expr):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", f"color=c=white:s={w}x{h}:d=1",
                    "-vf", f"format=rgba,geq=r='255':g='255':b='255':a='{expr}'", "-frames:v", "1", path],
                   check=True)


def post_video(src, t0=0.0):
    """Composite the memory balloon (warm, golden) over the park, a flash into the drop, and
    the dim at the end. Positions are for 1080x1920 output."""
    out_dir = os.path.dirname(src)
    mem = os.path.join(ROOT, "renders", "b05_mem", "b05_mem.mp4")
    if not os.path.exists(mem):
        print("[b05] memories render missing – skipping the balloon")
        return src
    D = 700                                            # balloon diameter (px)
    bx, by = 190, 150                                  # balloon top-left
    ring = os.path.join(out_dir, "balloon_ring.png")
    _mask_png(ring, D + 60, D + 60,
              f"255*0.55*exp(-pow((hypot(X-{(D + 60) / 2},Y-{(D + 60) / 2})-{D / 2})/9,2))")
    bubbles = []
    for k, (cx, cy, r) in enumerate(((600, 1070, 14), (565, 990, 22), (525, 905, 32))):
        p = os.path.join(out_dir, f"bubble_{k}.png")
        _mask_png(p, 2 * r + 20, 2 * r + 20,
                  f"255*(0.35*lt(hypot(X-{r + 10},Y-{r + 10}),{r})+0.6*exp(-pow((hypot(X-{r + 10},Y-{r + 10})-{r})/3,2)))")
        bubbles.append((p, cx - r - 10, cy - r - 10, T_BUBBLE + 0.18 * k))
    t_in, t_out = T_MEM - t0, T_MEM_END - t0
    dst = os.path.splitext(src)[0] + "_comp.mp4"
    args = ["ffmpeg", "-v", "error", "-y", "-i", src, "-i", mem, "-loop", "1", "-i", ring]
    for p, *_ in bubbles:
        args += ["-loop", "1", "-i", p]
    fc = [
        # memories: warm golden grade, soft glow, round soft-edged window, fade in/out
        f"[1:v]setpts=PTS-STARTPTS+{t_in + 0.25}/TB,scale={D}:{D},"
        "colorbalance=rs=0.13:gs=0.06:bs=-0.16:rm=0.08:gm=0.03:bm=-0.1:rh=0.05:bh=-0.08,"
        "eq=saturation=1.08:brightness=0.02,format=gbrp,split[m0][m1];[m1]gblur=sigma=14[mg];"
        "[m0][mg]blend=all_mode=screen:all_opacity=0.35,vignette=PI/5,format=rgba,"
        f"geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='255*0.93*clip(({D / 2 - 6}-hypot(X-{D / 2},Y-{D / 2}))/34,0,1)',"
        f"fade=t=in:st={t_in + 0.25}:d=0.6:alpha=1,fade=t=out:st={t_out - 0.7}:d=0.7:alpha=1[mem]",
        f"[2:v]format=rgba,fade=t=in:st={t_in}:d=0.5:alpha=1,fade=t=out:st={t_out - 0.6}:d=0.6:alpha=1[ring]",
    ]
    for k, (p, x, y, ts) in enumerate(bubbles):
        fc.append(f"[{3 + k}:v]format=rgba,fade=t=in:st={ts - t0}:d=0.25:alpha=1,"
                  f"fade=t=out:st={t_out - 0.6}:d=0.6:alpha=1[b{k}]")
    bob = "8*sin(2*PI*t/3.2)"
    chain = "[0:v]"
    for k, (p, x, y, ts) in enumerate(bubbles):
        fc.append(f"{chain}[b{k}]overlay=x={x}:y='{y}+{bob}*0.5':enable='between(t,{ts - t0},{t_out})'[v{k}]")
        chain = f"[v{k}]"
    fc.append(f"{chain}[ring]overlay=x={bx - 30}:y='{by - 30}+{bob}':enable='between(t,{t_in},{t_out})'[vr]")
    fc.append(f"[vr][mem]overlay=x={bx}:y='{by}+{bob}':enable='between(t,{t_in + 0.25},{t_out})'[vm]")
    # the flash as the camera enters the drop, and the dim before the question
    tc = T_CUT - t0
    fc.append(f"color=c=0xDDEEFF:s=1080x1920:d={LENGTH}:r=24,format=rgba,"
              f"fade=t=in:st={tc - 0.14}:d=0.14:alpha=1,fade=t=out:st={tc}:d=0.35:alpha=1[fl]")
    fc.append(f"[vm][fl]overlay=enable='between(t,{tc - 0.14},{tc + 0.36})'[vf]")
    fc.append(f"color=c=black:s=1080x1920:d={LENGTH}:r=24,format=rgba,colorchannelmixer=aa=0.55,"
              f"fade=t=in:st={T_FREEZE - t0}:d=0.8:alpha=1[dk]")
    fc.append(f"[vf][dk]overlay=enable='gte(t,{T_FREEZE - t0})',format=yuv420p[vout]")
    args += ["-filter_complex", ";".join(fc), "-map", "[vout]", "-map", "0:a", "-c:v", "libx264", "-preset", "slow",
             "-crf", "17", "-c:a", "copy", "-t", f"{LENGTH - t0:.3f}", dst]
    subprocess.run(args, check=True)
    return dst


def _box_path(w, h, r):
    k = r * 0.45
    return (f"m {r} 0 l {w - r} 0 b {w - k} 0 {w} {k} {w} {r} l {w} {h - r} b {w} {h - k} {w - k} {h} {w - r} {h} "
            f"l {r} {h} b {k} {h} 0 {h - k} 0 {h - r} l 0 {r} b 0 {k} {k} 0 {r} 0")


def post_ass(path, t0=0.0):
    """The closing question: 'Şimdi sıra battaniyede…' then A / B and the call to comment."""
    from ig.subtitles import _ts
    W, H = 1080, 1920
    end = LENGTH - t0
    a = T_QUESTION + 0.1 - t0
    rows = ["Style: Q,Nunito Black,84,&H00FFFFFF,&H00FFFFFF,&H00140A0A,&H96000000,0,0,0,0,100,100,1,0,1,6,3,5,0,0,0,1",
            "Style: Opt,Nunito Black,52,&H00FFFFFF,&H00FFFFFF,&H00140A0A,&H96000000,0,0,0,0,100,100,0,0,1,5,3,5,0,0,0,1",
            "Style: CTA,Nunito Black,50,&H0040E6FF,&H00FFFFFF,&H00140A0A,&H96000000,0,0,0,0,100,100,1,0,1,5,3,5,0,0,0,1"]
    ev = [f"Dialogue: 5,{_ts(a)},{_ts(end)},Q,,0,0,0,,{{\\pos({W // 2},{int(H * 0.16)})\\fad(500,0)"
          f"\\fscx92\\fscy92\\t(0,900,\\fscx100\\fscy100)}}Şimdi sıra battaniyede…"]
    bw, bh, r = 900, 128, 38
    for k, (label, fill) in enumerate((("A)  Battaniye de evi terk etsin.", "&H002E9BF0&"),
                                       ("B)  Yastık eve geri dönsün.", "&H00FF7A2E&"))):
        y = int(H * 0.235) + k * (bh + 30)
        st = a + 1.0 + k * 0.45
        pop = "\\fscx50\\fscy50\\t(0,170,\\fscx106\\fscy106)\\t(170,280,\\fscx100\\fscy100)"
        ev.append(f"Dialogue: 6,{_ts(st)},{_ts(end)},Opt,,0,0,0,,{{\\an5\\pos({W // 2},{y + bh // 2})\\1c{fill}"
                  f"\\3c&H00FFFFFF&\\bord6\\shad5\\4a&H70&\\fad(150,0){pop}\\p1}}{_box_path(bw, bh, r)}{{\\p0}}")
        ev.append(f"Dialogue: 7,{_ts(st)},{_ts(end)},Opt,,0,0,0,,{{\\an5\\pos({W // 2},{y + bh // 2})\\fad(150,0)"
                  f"{pop}}}{label}")
    ev.append(f"Dialogue: 7,{_ts(a + 2.1)},{_ts(end)},CTA,,0,0,0,,{{\\pos({W // 2},{int(H * 0.235) + 2 * (bh + 30) + 40})"
              f"\\fad(300,0)}}Kararını yorumlara yaz: A mı, B mi?")
    with open(path, encoding="utf-8") as f:
        txt = f.read()
    head, events = txt.split("[Events]", 1)
    head = head.rstrip("\n") + "\n" + "\n".join(rows) + "\n\n"
    with open(path, "w", encoding="utf-8") as f:
        f.write(head + "[Events]" + events.rstrip("\n") + "\n" + "\n".join(ev) + "\n")
    return path
