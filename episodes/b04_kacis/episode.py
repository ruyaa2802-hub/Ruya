"""İNSANLAR GİDİNCE – Bölüm 2 "Yastığın Kaçışı" (30 s, 9:16). Continues "Yine mi Barıştılar?".

Night. The owner and the blanket are asleep; the pillow has had enough, sneaks off the bed,
out of the door – and finds itself in a dark, foggy back street with strange shadows on the
wall. It asks the audience to decide: go home, or keep running? (Comments decide episode 3.)

Same Yastık and Battaniye rigs, same bedroom (now at night, with a door in the left wall);
the street is ig/sets/street.py. Free tools only: voices are Chatterbox (tools/chatterbox_lines.py,
cloning the B01 voices in assets/voices), music and sfx are synthesised (ig/music.py, ig/sfx.py),
the vote boxes are ASS drawings burnt in with the captions (post_ass below).

Dialogue (audio/*.wav, paced into audio/paced/):
  L01  YASTIK (fısıltı)  Ben bu evde daha fazla kalamam.
  L02  YASTIK     Her gece aynı kavga… aynı barışma… Benim de bir hayatım var!
  L03  BATTANİYE (uykuda)  Telefonu açma aşkım…
  L04  YASTIK (göz devirir)  Bak, rüyasında bile aynı senaryo!
  (yataktan iner, kapıya gider, kapıyı iter)
  L05  YASTIK     Özgürlük… sonunda!
  (sokak: sis, çöp konteynerleri, duvarda gölgeler)
  L06  YASTIK     Acaba isyan edip kaçmasaydım mı?
  L07  YASTIK     Ne yapsaydım? O adamın toksik ilişkisini yüz yaşıma kadar mı dinleseydim?
  (bir gölge aniden hareket eder)
  L08  YASTIK     Ben sadece huzur istedim…
  L08b YASTIK     BİR DE BU GÖLGELER NEDİR?!
  (yakın plan, iki seçim kutusu belirir)
  L09  YASTIK     Tamam… şimdi ne yapacağım ben?
  L10  YASTIK     Kararı siz verin, yorumlara yazın!
  L10b YASTIK     Ama hızlı olun, şu gölge bana doğru geliyor!
  (gölge üstüne gelirken kesilir)
"""
import math
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CAST = ("yastik", "battaniye")
TITLE = "İNSANLAR GİDİNCE\nYASTIĞIN KAÇIŞI"
TITLE_AT = (0.25, 2.4)
LENGTH = 30.0
SET_OPTS = dict(door=True)
LIGHT_OPTS = dict(night=True)
PACING = {}
LINES = {
    "L01_yastik": "Ben bu evde daha fazla kalamam.",
    "L02_yastik": "Her gece aynı kavga… aynı barışma… Benim de bir hayatım var!",
    "L03_battaniye": "Telefonu açma aşkım…",
    "L04_yastik": "Bak, rüyasında bile aynı senaryo!",
    "L05_yastik": "Özgürlük… sonunda!",
    "L06_yastik": "Acaba isyan edip kaçmasaydım mı?",
    "L07_yastik": "Ne yapsaydım? O adamın toksik ilişkisini yüz yaşıma kadar mı dinleseydim?",
    "L08_yastik": "Ben sadece huzur istedim…",
    "L08b_yastik": "BİR DE BU GÖLGELER NEDİR?!",
    "L09_yastik": "Tamam… şimdi ne yapacağım ben?",
    "L10_yastik": "Kararı siz verin, yorumlara yazın!",
    "L10b_yastik": "Ama hızlı olun, şu gölge bana doğru geliyor!",
}
# B01/B03 blocking: the pillow on the left half of the bed, the blanket asleep on the right half
HOME = {"yastik": dict(loc=(-0.3, 0.86, 0.538), rot=(math.radians(-13), 0, 0)),
        "battaniye": dict(loc=(0.38, 0.62, 0.545), rot=(0, 0, math.radians(28) - 0.8))}
DOOR_FRONT = (-1.38, -1.55, 0.0)             # where the pillow stands to push the door
CHOICE_T = 23.5                               # the vote boxes appear


def _smooth(a, b, t):
    k = min(max((t - a) / (b - a), 0.0), 1.0)
    return k * k * (3 - 2 * k)


def build(tl, ep):
    import bpy
    from mathutils import Vector

    from ig.characters import insan
    from ig.sets import bedroom, street

    A = lambda lid: os.path.join(ep, "audio", "paced", lid + ".wav")
    S = lambda f: os.path.join(ROOT, "assets", "sfx", f)
    Y, B = "yastik", "battaniye"
    fps = tl.fps
    st = street.build()
    SO = street.ORIGIN
    PILLOW_HOME = Vector(HOME["yastik"]["loc"])
    DOOR_FRONT_V = Vector(DOOR_FRONT)

    def rel(p):                                           # world point -> pillow pos_* offsets
        d = Vector(p) - PILLOW_HOME
        return dict(pos_x=d.x, pos_y=d.y, pos_z=d.z)

    # ================================================================ beats
    t_sigh = 0.3
    l01 = tl.say(Y, 0.62, A("L01_yastik"), intensity=0.6, bob=0.3)          # whispered to the ceiling
    l02 = tl.say(Y, l01.end + 0.12, A("L02_yastik"), intensity=0.85, bob=0.7)
    l03 = tl.say(B, l02.end + 0.1, A("L03_battaniye"), intensity=0.45, bob=0.2)  # talking in her sleep
    l04 = tl.say(Y, l03.end + 0.1, A("L04_yastik"), intensity=0.8, bob=0.6)
    t_go = l04.end + 0.08                                   # the escape
    t_edge = t_go + 0.5                                    # at the edge of the bed
    t_drop = t_edge + 0.15                                  # jumps down
    t_floor = t_drop + 0.4
    t_door = t_floor + 0.95                                 # in front of the door
    t_push = t_door + 0.12
    l05 = tl.say(Y, t_push + 0.3, A("L05_yastik"), intensity=1.0, bob=0.9)
    t_exit = l05.end + 0.02
    t_cut = round((t_exit + 0.42) * fps) / fps             # -> the street (on a frame boundary)
    t_in = t_cut + 0.85                                     # stops under the lamp
    l06 = tl.say(Y, t_in + 0.08, A("L06_yastik"), intensity=0.8, bob=0.6)
    l07 = tl.say(Y, l06.end + 0.1, A("L07_yastik"), intensity=1.0, bob=0.9)
    t_dart = l07.end + 0.08                                 # a shadow darts across the wall
    l08 = tl.say(Y, t_dart + 0.35, A("L08_yastik"), intensity=0.75, bob=0.5)
    l08b = tl.say(Y, l08.end + 0.08, A("L08b_yastik"), intensity=1.25, bob=1.5)
    l09 = tl.say(Y, max(CHOICE_T + 0.1, l08b.end + 0.12), A("L09_yastik"), intensity=0.8, bob=0.5)
    l10 = tl.say(Y, l09.end + 0.1, A("L10_yastik"), intensity=0.95, bob=0.8)
    l10b = tl.say(Y, l10.end + 0.06, A("L10b_yastik"), intensity=1.1, bob=1.0)
    tl.duration = LENGTH
    print(f"[b04] go {t_go:.2f} door {t_door:.2f} cut {t_cut:.2f} dart {t_dart:.2f} "
          f"l09 {l09.t:.2f} end {l10b.end:.2f}")

    # ================================================================ the sleeping owner: one arm off the bed
    hu = insan.build(bpy.data.collections.get("Set"))
    for part in ("leg_L", "leg_R", "torso"):
        for o in [hu[part]] + list(hu[part].children):
            o.hide_render = True
    shoulder_w = Vector((0.86, 0.12, 0.66))
    hu["root"].location = shoulder_w - Vector(insan.SHOULDER)
    hu["arm"].rotation_euler = (0.12, 0.0, 0.0)
    tl.prop(hu["arm"], lambda t: {"rotation_euler": (0.03 * math.sin(2 * math.pi * t / 2.2), 0.0,
                                                     0.02 * math.sin(2 * math.pi * t / 4.4))}, 0.0, t_cut + 0.5)

    # ================================================================ the door
    hinge = bpy.data.objects["door_hinge"]
    tl.prop(hinge, lambda t: {"rotation_euler": (0, 0, -1.9 * _smooth(t_push, t_push + 1.0, t) ** 0.8)})

    # ================================================================ pillow path
    # on the bed it leans back against the headboard (-13°); on the floor it stands up straight
    p_edge = Vector((-0.72, 0.3, PILLOW_HOME.z))
    p_floor = Vector((-1.08, 0.05, 0.0))
    p_hall = Vector((-2.2, -1.55, 0.0))
    s_start = SO + Vector((-3.1, 1.45, street.CURB_H))
    s_stop = SO + Vector((-0.05, 1.5, street.CURB_H))
    tl.set(Y, t_go, 0.3, turn=0.7)                                           # turns toward the bed's edge
    tl.set(Y, t_go, 0.5, pitch=math.radians(13))
    tl.set(Y, t_go, t_edge - t_go, **rel(p_edge))
    tl.hop(Y, t_go, 0.05, 0.25, 0.1)
    tl.hop(Y, t_go + 0.28, 0.05, 0.25, 0.1)
    tl.set(Y, t_drop, t_floor - t_drop, "in", pos_z=rel(p_floor)["pos_z"])
    tl.set(Y, t_drop, t_floor - t_drop, "linear", pos_x=rel(p_floor)["pos_x"], pos_y=rel(p_floor)["pos_y"])
    tl.hop(Y, t_drop, 0.12, t_floor - t_drop, 0.18)
    tl.sfx(t_floor, S("poof.wav"), -9)
    tl.set(Y, t_floor + 0.05, 0.3, turn=0.0)
    tl.set(Y, t_floor + 0.05, t_door - t_floor - 0.05, "linear", **rel(DOOR_FRONT_V))
    for k in range(3):
        tl.hop(Y, t_floor + 0.05 + k * 0.3, 0.06, 0.28, 0.1)
    tl.set(Y, t_door - 0.2, 0.35, turn=-1.1)                                 # faces the door
    tl.pulse(Y, t_push - 0.05, 0.3, lean_f=0.25, squash=-0.06)             # a shove
    tl.set(Y, l05.t - 0.15, 0.4, turn=1.0)                                  # turns to us, the hall glowing behind: "Özgürlük!"
    tl.set(Y, t_exit, 0.25, turn=-1.4)
    tl.set(Y, t_exit, t_cut - t_exit, "in", **rel(p_hall))
    tl.hop(Y, t_exit, 0.07, 0.4, 0.12)
    # cut: the pillow is in the street (teleport), hopping in bravely from the left
    tl.set(Y, t_cut - 0.03, 0.01, "linear", turn=math.radians(70), **rel(s_start))
    tl.set(Y, t_cut, t_in - t_cut, "linear", **rel(s_stop))
    for k in range(3):
        tl.hop(Y, t_cut + k * 0.28, 0.06, 0.26, 0.11)
    tl.set(Y, t_in - 0.25, 0.35, turn=0.0)

    # ================================================================ acting – bedroom
    tl.eyes_closed(B, 0.0, t_cut + 1.0)                                    # the blanket never wakes
    tl.expr(B, 0.0, "sleep", 0.1, m_frown=0.0, m_smile=0.15)
    tl.layer(B, lambda t: {"squash": 0.02 * math.sin(2 * math.pi * t / 2.2), "nod": 0.02 * math.sin(2 * math.pi * t / 2.2)},
             0.0, t_cut)
    tl.expr(Y, 0.0, "tired", 0.1)
    tl.set(Y, 0.0, 0.1, gaze_y=0.42, gaze_x=0.05)                          # staring at the ceiling
    tl.pulse(Y, t_sigh, 0.9, squash=-0.07, nod=-0.05)                      # a long sigh
    tl.expr(Y, l01.t - 0.1, "tired", 0.4, brow_up=0.45, brow_ang=-0.55, m_frown=0.3, gaze_y=0.4)
    tl.look(Y, l02.t, B, 0.35, head=0.35)                                  # glances at the blanket
    tl.expr(Y, l02.t + 0.1, "annoyed", 0.3)
    tl.expr(Y, l02.find("barış") - 0.1, "annoyed", 0.2, brow_ang=0.8)
    tl.set(Y, l02.find("benim") - 0.1, 0.25, "back", arm_L_raise=1.0, arm_R_raise=1.0, arm_L_fold=0.4,
           arm_R_fold=0.4)
    tl.expr(Y, l02.find("benim") - 0.05, "dramatic", 0.2)
    tl.hop(Y, l02.find("hayat"), 0.025, 0.25, 0.1)
    tl.set(Y, l02.end, 0.4, arm_L_raise=0.0, arm_R_raise=0.0, arm_L_fold=0.0, arm_R_fold=0.0)
    # L03: mumbles in her sleep, a little snuggle
    tl.set(B, l03.t, 0.4, tilt=0.06, lean_f=0.04)
    tl.set(B, l03.end + 0.2, 0.6, tilt=0.0, lean_f=0.0)
    tl.expr(Y, l03.t, "surprised", 0.15, m_open=0.0)
    tl.look(Y, l03.t, B, 0.2, head=0.5)
    # L04: eye roll
    tl.expr(Y, l04.t - 0.25, "eyeroll", 0.35, lid_u=0.0, gaze_y=0.5, brow_up_L=0.6)
    tl.set(Y, l04.t - 0.25, 0.4, gaze_x=0.25)
    tl.look(Y, l04.find("rüya"), (0.4, -1.6, 1.0), 0.25, head=0.3)        # to us
    tl.expr(Y, l04.find("rüya"), "sarcastic", 0.25, lid_u=0.0, lid_u_L=0.05)
    tl.set(Y, l04.find("rüya"), 0.3, arm_R_raise=0.8, arm_R_fold=0.5)       # points at her
    tl.set(Y, l04.end, 0.3, arm_R_raise=0.0, arm_R_fold=0.0)
    # escape
    tl.expr(Y, t_go - 0.1, "sneaky", 0.25)
    tl.look(Y, t_go, (-1.5, -1.6, 0.6), 0.3, head=0.2)
    tl.look(Y, t_floor + 0.1, B, 0.25, head=0.6)                            # a last look back at the bed
    tl.look(Y, t_floor + 0.45, DOOR_FRONT_V + Vector((-0.4, 0, 0.6)), 0.25, head=0.3)
    tl.expr(Y, t_push + 0.3, "happy", 0.3, m_open=0.3)
    tl.set(Y, l05.t, 0.4, arm_L_raise=1.5, arm_R_raise=1.5)                 # arms up: freedom!
    tl.look(Y, l05.t + 0.2, (0.15, -2.45, 0.5), 0.3, head=0.2)
    tl.set(Y, l05.end, 0.3, arm_L_raise=0.2, arm_R_raise=0.2)

    # ================================================================ acting – street
    tl.expr(Y, t_cut, "brave", 0.2)
    tl.set(Y, t_cut, 0.2, lean_f=-0.08, arm_L_raise=0.5, arm_R_raise=0.5, arm_L_fold=0.8, arm_R_fold=0.8)
    tl.set(Y, t_in, 0.3, lean_f=0.0, arm_L_raise=0.0, arm_R_raise=0.0, arm_L_fold=0.0, arm_R_fold=0.0)
    wall_patch = SO + Vector((-1.0, street.WALL_Y, 1.4))
    tl.look(Y, t_in - 0.1, wall_patch, 0.3, head=0.45)
    tl.expr(Y, l06.t - 0.15, "scared", 0.3)
    tl.look(Y, l06.t + 0.9, SO + Vector((1.5, 2.0, 0.6)), 0.35, head=0.5)  # glances around
    tl.look(Y, l06.end - 0.2, SO + Vector((0.0, -1.6, 0.6)), 0.3, head=0.3)
    # L07: argues with itself, getting indignant
    tl.expr(Y, l07.t - 0.05, "annoyed", 0.25)
    tl.set(Y, l07.find("adam") - 0.1, 0.25, "back", arm_R_raise=1.0, arm_R_fold=0.4)
    tl.expr(Y, l07.find("toksik") - 0.05, "angry", 0.2)
    tl.set(Y, l07.find("yüz") - 0.1, 0.25, "back", arm_L_raise=1.1, arm_R_raise=1.1, arm_L_curl=0.5, arm_R_curl=0.5)
    tl.hop(Y, l07.find("dinle"), 0.03, 0.25, 0.1)
    tl.set(Y, l07.end, 0.3, arm_L_raise=0.0, arm_R_raise=0.0, arm_L_curl=0.0, arm_R_curl=0.0, arm_R_fold=0.0)
    # the dart: jumps out of its skin
    tl.expr(Y, t_dart + 0.08, "surprised", 0.08, m_open=0.6)
    tl.hop(Y, t_dart + 0.1, 0.1, 0.32, 0.2)
    tl.shake(Y, t_dart + 0.45, 0.6, "tilt", 0.08, 9)
    tl.look(Y, t_dart + 0.1, wall_patch, 0.12, head=0.6)
    # L08 whiny, L08b shouting at the wall
    tl.expr(Y, l08.t - 0.1, "sad", 0.3, brow_up=0.9)
    tl.look(Y, l08.t, SO + Vector((0.1, -1.6, 0.6)), 0.3, head=0.3)
    tl.expr(Y, l08b.t - 0.08, "shout", 0.15)
    tl.look(Y, l08b.t, wall_patch, 0.2, head=0.6)
    tl.set(Y, l08b.t, 0.15, arm_L_raise=1.3, arm_R_raise=1.3, arm_L_curl=0.6, arm_R_curl=0.6)
    tl.set(Y, l08b.end, 0.3, arm_L_raise=0.0, arm_R_raise=0.0, arm_L_curl=0.0, arm_R_curl=0.0)
    # scene 4: to camera, scared but determined; glances at the two boxes above
    tl.look_cam(Y, l08b.end + 0.05, 0.3)
    tl.expr(Y, l09.t - 0.1, "scared", 0.3, m_press=0.2)
    tl.set(Y, l09.t + 0.5, 0.3, gaze_x=-0.25, gaze_y=0.42)                 # up-left: box 1
    tl.set(Y, l09.t + 1.0, 0.3, gaze_x=0.25, gaze_y=0.42)                  # up-right: box 2
    tl.look_cam(Y, l10.t - 0.05, 0.2)
    tl.expr(Y, l10.t, "brave", 0.25)
    tl.set(Y, l10.t, 0.3, arm_R_raise=0.9, arm_R_fold=0.4)
    tl.set(Y, l10.find("yorum") - 0.05, 0.25, gaze_y=0.4, gaze_x=0.0)
    tl.set(Y, l10.end - 0.2, 0.2, gaze_y=0.0, arm_R_raise=0.0, arm_R_fold=0.0)
    tl.expr(Y, l10b.t, "scared", 0.15, m_open=0.3)
    tl.look(Y, l10b.find("gölge") - 0.1, SO + Vector((-2.5, 0.0, 0.6)), 0.2, head=0.55)   # the shadow coming
    tl.shake(Y, l10b.find("gölge"), 1.6, "tilt", 0.05, 11, decay=False)
    tl.look_cam(Y, l10b.find("doğru") + 0.1, 0.15)
    tl.expr(Y, l10b.find("geliyor"), "scared", 0.15, m_open=0.5, brow_up=1.0)

    # ================================================================ shadows (casters cross the cold side beam)
    side = Vector(st["side"].location)
    c0, c1, c2 = st["casters"]

    def on_beam(f, lateral=0.0, up=0.0):
        """A point a fraction f of the way from the side light to the wall patch, nudged sideways/up."""
        p = side.lerp(wall_patch, f)
        d = (wall_patch - side).normalized()
        sideways = d.cross(Vector((0, 0, 1))).normalized()
        return p + sideways * lateral + Vector((0, 0, up))

    parked = Vector((SO.x - 5.0, -6.0, 0.5))
    rest0, rest1, rest2 = (Vector(c.location) for c in (c0, c1, c2))

    def path(rest, keys):
        def fn(t):
            if t < keys[0][0] or t > keys[-1][0]:
                return {"location": tuple(parked - rest)}
            for (ta, pa), (tb, pb) in zip(keys, keys[1:]):
                if ta <= t <= tb:
                    return {"location": tuple(pa.lerp(pb, _smooth(ta, tb, t)) - rest)}
            return {}
        return fn

    # the tall thin one drifts slowly across while the pillow wonders out loud
    tl.prop(c1, path(rest1, [(l06.t - 0.2, on_beam(0.55, -1.2, 0.0)), (l07.t + 1.5, on_beam(0.55, 1.4, 0.0))]))
    # the hunched one with ears: peeks in, then darts across
    tl.prop(c0, path(rest0, [(l07.t + 1.0, on_beam(0.62, -1.3, 0.05)), (t_dart - 0.25, on_beam(0.62, -0.7, 0.05)),
                             (t_dart + 0.3, on_beam(0.62, 1.4, 0.1)), (t_dart + 0.35, on_beam(0.62, 1.5, 0.1))]))
    tl.sfx(t_dart, S("scuttle.wav"), -8)
    tl.sfx(t_dart + 0.02, S("sting.wav"), -6)
    # the big round lump: slides in under the street lamp, between the lamp and the pillow, and its
    # shadow grows over the pillow as it rises toward the light
    lamp_p = Vector(st["lamp"].location)
    pillow_end = s_stop + Vector((0, 0, 0.35))
    under = lambda f, lat: lamp_p.lerp(pillow_end, f) + Vector((lat, 0.0, 0.0))
    tl.prop(c2, path(rest2, [(l10b.t - 0.2, under(0.55, -1.6)), (l10b.find("gölge"), under(0.6, -0.55)),
                             (LENGTH - 0.7, under(0.5, -0.12)), (LENGTH + 0.1, under(0.3, 0.0))]))

    # ================================================================ sound
    tl.sfx(0.0, S("night_amb.wav"), -12, dur=t_cut - 0.05, fade=0.1)
    tl.sfx(0.0, S("snore.wav"), -15, dur=t_cut - 0.05, fade=0.2)
    tl.sfx(4.4, S("snore.wav"), -15, dur=max(0.1, t_cut - 4.45), fade=0.2)
    tl.sfx(8.8, S("snore.wav"), -16, dur=max(0.1, t_cut - 8.85), fade=0.2)
    tl.sfx(t_sigh, S("sigh.wav"), -6)
    tl.sfx(l01.t - 0.2, S("music_hum.wav"), -25, dur=t_go - l01.t + 0.2, fade=0.4)   # the B03 tune, sleepy
    tl.sfx(t_go - 0.05, S("music_sneaky.wav"), -16, dur=t_cut - t_go, fade=0.15)    # tiptoe
    for k in range(2):
        tl.sfx(t_go + 0.25 + k * 0.28, S("poof.wav"), -16)
    for k in range(3):
        tl.sfx(t_floor + 0.33 + k * 0.33, S("poof.wav"), -17)
    tl.sfx(t_push, S("creak.wav"), -8)
    tl.sfx(t_cut, S("street_amb.wav"), -10, dur=LENGTH - t_cut, fade=0.0)
    tl.sfx(t_cut + 0.2, S("music_tension.wav"), -15, dur=LENGTH - t_cut - 0.2, fade=0.0)
    for k in range(3):
        tl.sfx(t_cut + 0.27 + k * 0.31, S("poof.wav"), -18)
    tl.sfx(CHOICE_T, S("ding.wav"), -12)
    tl.sfx(l10b.find("gölge"), S("heartbeat.wav"), -6, dur=LENGTH - l10b.find("gölge"), fade=0.0)
    tl.sfx(LENGTH - 0.55, S("sting.wav"), -4, fade=0.0)

    # ================================================================ lights over time (keys)
    lamp = st["lamp"].data
    prefs = bpy.context.preferences.edit
    interp, prefs.keyframe_new_interpolation_type = prefs.keyframe_new_interpolation_type, "CONSTANT"
    L = street.LAMP_W
    for t, v in ((0.0, L), (t_dart - 0.1, L), (t_dart, 0.2 * L), (t_dart + 0.08, L), (t_dart + 0.16, 0.35 * L),
                 (t_dart + 0.24, L), (LENGTH - 0.9, L), (LENGTH - 0.8, 0.3 * L), (LENGTH - 0.72, 0.9 * L),
                 (LENGTH - 0.3, 0.25 * L)):
        lamp.energy = v
        lamp.keyframe_insert("energy", frame=int(round(t * fps)))
    prefs.keyframe_new_interpolation_type = interp

    # ================================================================ cameras (9:16)
    tl.shot(0.0, "cam_open", (0.35, -1.75, 1.3), (-0.12, 0.65, 0.72), lens=26, fstop=4.0,
            to_loc=(0.2, -1.35, 1.15), dur=l01.t)
    tl.face_shot(l01.t - 0.05, "cam_y1", Y, dist=1.05, yaw=-10, height=-0.06, lens=30, push=0.12, dur=l01.dur)
    tl.shot(l02.t - 0.05, "cam_two", (0.15, -1.25, 1.05), (0.05, 0.7, 0.68), lens=26, fstop=4.0,
            to_loc=(0.1, -1.05, 1.0), dur=l02.dur)
    tl.face_shot(l03.t - 0.1, "cam_b", B, dist=1.1, yaw=14, height=0.08, lens=28, push=0.12, dur=l03.dur)
    tl.face_shot(l04.t - 0.25, "cam_y2", Y, dist=1.0, yaw=-8, height=0.04, lens=30, push=0.1, dur=l04.dur)
    tl.shot(t_go - 0.05, "cam_escape", (0.9, -2.4, 1.05), (-0.55, 0.25, 0.45), lens=22, fstop=5.0,
            to_target=(-1.25, -1.35, 0.35), to_loc=(0.75, -2.5, 0.85), dur=t_door - t_go)
    tl.shot(t_door - 0.35, "cam_door", (0.25, -2.5, 0.52), (-1.5, -1.45, 0.5), lens=28, fstop=4.0,
            to_loc=(0.05, -2.35, 0.5), dur=t_cut - t_door + 0.3)
    tl.shot(t_cut, "cam_street", tuple(SO + Vector((0.6, -2.6, 0.75))), tuple(SO + Vector((-0.7, 2.0, 1.1))),
            lens=22, fstop=5.0, to_loc=tuple(SO + Vector((0.4, -2.2, 0.7))), dur=t_in - t_cut)
    # L06 over the shoulder: the pillow small in the lamp light, the shadow wall behind it
    tl.shot(l06.t - 0.05, "cam_s1", tuple(SO + Vector((1.05, -0.55, 0.42))), tuple(SO + Vector((-0.75, 2.4, 1.05))),
            lens=24, fstop=5.0, to_loc=tuple(SO + Vector((0.9, -0.35, 0.42))), dur=l06.dur)
    tl.face_shot(l07.t - 0.05, "cam_s2", Y, dist=1.15, yaw=18, height=0.06, lens=28, push=0.12, dur=l07.dur)
    tl.shot(t_dart - 0.2, "cam_wall", tuple(SO + Vector((1.05, -0.55, 0.42))), tuple(SO + Vector((-0.75, 2.4, 1.05))),
            lens=24, fstop=5.0, to_loc=tuple(SO + Vector((1.0, -0.45, 0.45))), dur=l08.t + 0.4 - t_dart)
    tl.face_shot(l08.t + 0.35, "cam_s3", Y, dist=1.0, yaw=-12, height=0.04, lens=30, push=0.12, dur=l08.dur)
    tl.face_shot(l08b.t - 0.05, "cam_s4", Y, dist=1.35, yaw=8, height=0.1, lens=26, shake=0.006, dur=l08b.dur)
    tl.face_shot(l08b.end + 0.02, "cam_vote", Y, dist=1.15, yaw=0, height=0.02, lens=30, push=0.35,
                 look=(0, 0, 0.05), dur=LENGTH - l08b.end - 0.02)
    tl.duration = LENGTH


# ==================================================================== vote boxes (ASS overlay)
def _box_path(w, h, r):
    """Rounded rectangle as an ASS drawing (origin top-left)."""
    k = r * 0.45
    return (f"m {r} 0 l {w - r} 0 b {w - k} 0 {w} {k} {w} {r} l {w} {h - r} b {w} {h - k} {w - k} {h} {w - r} {h} "
            f"l {r} {h} b {k} {h} 0 {h - k} 0 {h - r} l 0 {r} b 0 {k} {k} 0 {r} 0")


def post_ass(path, t0=0.0):
    """Two big vote boxes + a 'write it in the comments' header for the last seconds."""
    from ig.subtitles import _ts

    W, H = 1080, 1920
    a, b = CHOICE_T - t0, LENGTH - t0
    bw, bh, r = 860, 150, 42
    x0 = (W - bw) // 2
    rows = []
    rows.append("Style: Vote,Nunito Black,74,&H00FFFFFF,&H00FFFFFF,&H00140A0A,&H96000000,0,0,0,0,100,100,1,0,1,"
                "6,3,5,0,0,0,1")
    rows.append("Style: VoteHead,Nunito Black,64,&H0040E6FF,&H00FFFFFF,&H00140A0A,&H96000000,0,0,0,0,100,100,1,0,1,"
                "6,3,5,0,0,0,1")
    ev = []
    ev.append(f"Dialogue: 5,{_ts(a)},{_ts(b)},VoteHead,,0,0,0,,{{\\pos({W // 2},{int(H * 0.085)})\\fad(150,0)"
              f"\\fscx70\\fscy70\\t(0,180,\\fscx100\\fscy100)}}SEN KARAR VER!")
    ev.append(f"Dialogue: 5,{_ts(a + 0.15)},{_ts(b)},Vote,,0,0,0,,{{\\pos({W // 2},{int(H * 0.125)})\\fad(150,0)"
              f"\\fs54}}Yorumlara 1 ya da 2 yaz!")
    for k, (label, fill) in enumerate((("1  EVE GERİ DÖNSÜN", "&H00FF7A2E&"), ("2  KAÇMAYA DEVAM ETSİN", "&H003C3CF0&"))):
        y = int(H * 0.155) + k * (bh + 34)
        start = a + 0.25 + k * 0.25
        pulse = "".join(f"\\t({int(1000 * (1.2 + j * 1.0 + k * 0.5))},{int(1000 * (1.45 + j * 1.0 + k * 0.5))},"
                        f"\\fscx104\\fscy104)\\t({int(1000 * (1.45 + j * 1.0 + k * 0.5))},"
                        f"{int(1000 * (1.7 + j * 1.0 + k * 0.5))},\\fscx100\\fscy100)" for j in range(5))
        pop = "\\fscx40\\fscy40\\t(0,160,\\fscx108\\fscy108)\\t(160,260,\\fscx100\\fscy100)"
        # the box (drawn around its centre so it can pop), then the label on top
        ev.append(f"Dialogue: 6,{_ts(start)},{_ts(b)},Vote,,0,0,0,,{{\\an5\\pos({W // 2},{y + bh // 2})\\org({W // 2},"
                  f"{y + bh // 2})\\1c{fill}\\3c&H00FFFFFF&\\bord7\\shad5\\4a&H70&\\fad(120,0){pop}{pulse}\\p1}}"
                  f"{_box_path(bw, bh, r)}{{\\p0}}")
        ev.append(f"Dialogue: 7,{_ts(start)},{_ts(b)},Vote,,0,0,0,,{{\\an5\\pos({W // 2},{y + bh // 2})\\fad(120,0)"
                  f"{pop}{pulse}}}{label}")
    with open(path, encoding="utf-8") as f:
        txt = f.read()
    head, events = txt.split("[Events]", 1)
    head = head.rstrip("\n") + "\n" + "\n".join(rows) + "\n\n"
    with open(path, "w", encoding="utf-8") as f:
        f.write(head + "[Events]" + events.rstrip("\n") + "\n" + "\n".join(ev) + "\n")
    return path
