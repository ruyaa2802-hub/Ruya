"""EŞYA MECLİSİ – BÖLÜM 3 "Kavuşma" (~39 s, 9:16). Follows "Oy Çokluğu ile Kaçtı".

The bedroom door opens, the pillow comes home. The blanket plays it cool – then hugs it tight.
Sitting on the bed again they talk about humans (a third of life asleep, the rest complaining
about being sleepy), laugh, and as the pillow starts on its next story the camera pulls back
out of the window, over the house and up into the night sky: EŞYA MECLİSİ.

Same Yastık and Battaniye rigs, same bedroom (night, door and wardrobe as in B04/B05); the
outside of the house is ig/sets/house_ext.py. Free tools only: Chatterbox voices (cloned from
the B01 voices), numpy piano/sfx, Blender/Cycles, ffmpeg.

Dialogue (all lines as written in the script):
  L01 BATTANİYE  Vay vay vay… Kimler gelmiş!
  L02 YASTIK     Beni özlemedin mi?
  L03 BATTANİYE  Yok canım. Sadece üç gündür yüzüm asık geziyordum.
  L04 YASTIK     Ben de seni özledim be!
  (sarılma: battaniye önce naz yapar, sonra sıkıca sarılır)
  L05 YASTIK     Bu arada, insanlarla ilgili çok ilginç bir şey öğrendim.
  L06 BATTANİYE  Yine ne öğrendin?
  L07 YASTIK     İnsanlar hayatlarının yaklaşık üçte birini uyuyarak geçiriyormuş!
  L08 BATTANİYE  Eee?
  L09 YASTIK     Geri kalan üçte ikisinde de uykularının gelmesinden şikâyet ediyorlarmış!
  L10 BATTANİYE  Demek ki insanlık tarihinin en büyük problemi, uyumak için yeterince zaman
                 bulamamak değil… Uyanıkken ne yapacağını bilememek.
  L11 YASTIK     Peki biz ne yapıyoruz?
  L12 BATTANİYE  Biz mi? Biz insanları uyutuyoruz. Kendi hayatlarını çözmek onlara kalmış.
  (kısa sessizlik, uzun kahkaha: L15, L16)
  L13 BATTANİYE  Başka ne öğrendin?
  L14 YASTIK     Dinle! İnsanlar bir de… (anlatmaya başlar, kamera uzaklaşır, ses kısılır)
"""
import math
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CAST = ("yastik", "battaniye")
SET_OPTS = dict(door=True, wardrobe=True)
LIGHT_OPTS = dict(night=True)
PACING = {}
LINES = {
    "L01_battaniye": "Vay vay vay… Kimler gelmiş!",
    "L02_yastik": "Beni özlemedin mi?",
    "L03_battaniye": "Yok canım. Sadece üç gündür yüzüm asık geziyordum.",
    "L04_yastik": "Ben de seni özledim be!",
    "L05_yastik": "Bu arada, insanlarla ilgili çok ilginç bir şey öğrendim.",
    "L06_battaniye": "Yine ne öğrendin?",
    "L07_yastik": "İnsanlar hayatlarının yaklaşık üçte birini uyuyarak geçiriyormuş!",
    "L08_battaniye": "Eee?",
    "L09_yastik": "Geri kalan üçte ikisinde de uykularının gelmesinden şikâyet ediyorlarmış!",
    "L10_battaniye": "Demek ki insanlık tarihinin en büyük problemi, uyumak için yeterince zaman bulamamak "
                     "değil… Uyanıkken ne yapacağını bilememek.",
    "L11_yastik": "Peki biz ne yapıyoruz?",
    "L12_battaniye": "Biz mi? Biz insanları uyutuyoruz. Kendi hayatlarını çözmek onlara kalmış.",
    "L13_battaniye": "Başka ne öğrendin?",
    "L14_yastik": "Dinle! İnsanlar bir de alarmı beş dakika ertelemek için…",
}
HOME = {"yastik": dict(loc=(-0.3, 0.86, 0.538), rot=(math.radians(-13), 0, 0)),
        "battaniye": dict(loc=(0.38, 0.62, 0.545), rot=(0, 0, math.radians(28) - 0.8))}
HUG_SPOT = (-0.06, 0.8, 0.538)          # where the pillow sits after the hug, close to the blanket
HALL = (-2.35, -1.55, 0.0)
DOOR_IN = (-1.25, -1.5, 0.0)
FLOOR_BY_BED = (-1.0, 0.35, 0.0)
TAIL = 4.2                              # pull-back + sky + title after L14 starts


def _smooth(a, b, t):
    k = min(max((t - a) / (b - a), 0.0), 1.0)
    return k * k * (3 - 2 * k)


def build(tl, ep):
    import bpy
    from mathutils import Vector

    from ig.sets import house_ext

    A = lambda lid: os.path.join(ep, "audio", "paced", lid + ".wav")
    S = lambda f: os.path.join(ROOT, "assets", "sfx", f)
    Y, B = "yastik", "battaniye"
    fps = tl.fps
    y_home = Vector(tl.chars[Y].base_loc)
    ext = house_ext.build()
    house_ext.starry_sky()

    def ry(p):
        d = Vector(p) - y_home
        return dict(pos_x=d.x, pos_y=d.y, pos_z=d.z)

    # ============================================================ beats
    t_open = 0.15                                   # the door starts to open
    t_in = 0.9                                      # the pillow hops in
    t_stop = 1.8                                    # inside; they look at each other
    l01 = tl.say(B, 2.35, A("L01_battaniye"), intensity=1.0, bob=0.9)
    l02 = tl.say(Y, l01.end + 0.08, A("L02_yastik"), intensity=0.8, bob=0.6)
    l03 = tl.say(B, l02.end + 0.08, A("L03_battaniye"), intensity=0.9, bob=0.7)
    l04 = tl.say(Y, l03.end + 0.08, A("L04_yastik"), intensity=1.0, bob=0.9)
    t_hug = l04.end + 0.05
    t_naz, t_squeeze = t_hug + 0.15, t_hug + 0.75
    l05 = tl.say(Y, t_hug + 1.25, A("L05_yastik"), intensity=0.9, bob=0.7)
    l06 = tl.say(B, l05.end + 0.06, A("L06_battaniye"), intensity=0.8, bob=0.6)
    l07 = tl.say(Y, l06.end + 0.06, A("L07_yastik"), intensity=1.0, bob=0.9)
    l08 = tl.say(B, l07.end + 0.06, A("L08_battaniye"), intensity=0.9, bob=0.5)
    l09 = tl.say(Y, l08.end + 0.06, A("L09_yastik"), intensity=1.0, bob=1.0)
    l10 = tl.say(B, l09.end + 0.12, A("L10_battaniye"), intensity=0.85, bob=0.6)
    l11 = tl.say(Y, l10.end + 0.08, A("L11_yastik"), intensity=0.8, bob=0.6)
    l12 = tl.say(B, l11.end + 0.08, A("L12_battaniye"), intensity=0.9, bob=0.7)
    t_quiet = l12.end + 0.05                        # they look at each other...
    t_laugh = t_quiet + 0.75                        # ...and burst out laughing
    lx1 = tl.say(Y, t_laugh, A("L15_yastik"), intensity=1.1, bob=1.2)
    lx2 = tl.say(B, t_laugh + 0.1, A("L16_battaniye"), intensity=1.1, bob=1.2)
    t_after = max(lx1.end, lx2.end)
    l13 = tl.say(B, t_after + 0.05, A("L13_battaniye"), intensity=0.85, bob=0.6)
    l14 = tl.say(Y, l13.end + 0.08, A("L14_yastik"), intensity=1.0, bob=1.0)
    t_out = l14.t + 0.35                            # the camera starts to leave
    LENGTH = t_out + TAIL
    t_title = LENGTH - 2.0
    print(f"[b06] hug {t_hug:.2f} laugh {t_laugh:.2f} out {t_out:.2f} length {LENGTH:.2f}")

    # ============================================================ the door, the hallway, the outside
    hinge = bpy.data.objects["door_hinge"]
    tl.prop(hinge, lambda t: {"rotation_euler": (0, 0, -1.6 * _smooth(t_open, t_open + 1.3, t) ** 0.9
                                                  * (1 - _smooth(t_out - 3.0, t_out - 1.5, t)))})   # shut off-screen
    f_out = int(round((t_out - 0.4) * fps))
    for o in ext:                                    # the outside appears only for the pull-back
        o.hide_render = True
        o.keyframe_insert("hide_render", frame=0)
        o.hide_render = False
        o.keyframe_insert("hide_render", frame=f_out)
    for name in ("hall_wall", "hall_side_a", "hall_side_b"):
        o = bpy.data.objects.get(name)
        if o:
            o.hide_render = False
            o.keyframe_insert("hide_render", frame=0)
            o.hide_render = True
            o.keyframe_insert("hide_render", frame=f_out)
    hall = bpy.data.objects.get("HallLight")
    if hall:
        e = hall.data.energy
        for f, v in ((0, e), (f_out, 0.0)):
            hall.data.energy = v
            hall.data.keyframe_insert("energy", frame=f)
    # warmer room for a happy night: fairy lights up
    bulb = bpy.data.materials.get("bulb_warm")
    if bulb:
        bulb.node_tree.nodes["Emission"].inputs["Strength"].default_value = 24.0
    if bpy.data.objects.get("FairyGlow"):
        bpy.data.objects["FairyGlow"].data.energy = 9.0

    # ============================================================ the pillow comes home
    tl.set(Y, 0.0, 0.01, pitch=math.radians(13), turn=1.45, **ry(HALL))
    tl.set(Y, t_in, t_stop - t_in, "linear", **ry(DOOR_IN))
    for k in range(3):
        tl.hop(Y, t_in + k * 0.3, 0.07, 0.28, 0.12)
    tl.set(Y, t_stop - 0.1, 0.4, turn=0.55)                       # turns toward the bed
    tl.expr(Y, 0.0, "sad", 0.1, brow_up=0.6, lid_u=0.2)
    tl.look(Y, t_stop, (0.38, 0.7, 0.85), 0.35, head=0.4)
    tl.expr(Y, t_stop + 0.2, "wistful", 0.4, m_smile=0.25)
    # the blanket, sitting on the bed, staring at the door
    tl.expr(B, 0.0, "sad", 0.1, brow_up=0.6, lid_u=0.25)
    tl.look(B, t_open + 0.3, DOOR_IN, 0.4, head=0.5)
    tl.expr(B, t_in + 0.4, "surprised", 0.25)
    tl.expr(B, t_stop + 0.3, "sarcastic", 0.5, lid_u=0.35)            # plays it cool
    tl.set(B, l01.t, 0.3, arm_L_raise=0.6, arm_L_fold=0.8, arm_R_raise=0.6, arm_R_fold=0.8)   # arms crossed
    tl.set(B, l01.find("kim"), 0.3, tilt=0.1)
    # L02: the pillow, shy, hops closer
    tl.expr(Y, l02.t - 0.1, "touched", 0.3, m_smile=0.3)
    tl.set(Y, l02.t, l02.dur + 0.3, "linear", turn=0.1, **ry(FLOOR_BY_BED))
    for k in range(3):
        tl.hop(Y, l02.t + k * 0.36, 0.06, 0.33, 0.1)
    # L03: "Yok canım…" – looks away, nose up; then sneaks a look back
    tl.expr(B, l03.t - 0.05, "smug", 0.3, lid_u=0.4)
    tl.set(B, l03.t, 0.4, twist=-0.35, tilt=-0.08)
    tl.set(B, l03.find("üç") - 0.1, 0.35, twist=0.0, tilt=0.0)
    tl.expr(B, l03.find("yüz") - 0.1, "sad", 0.3, brow_up=0.8, m_frown=0.4)
    tl.set(B, l03.find("yüz") - 0.1, 0.3, arm_L_raise=0.2, arm_L_fold=0.0, arm_R_raise=0.2, arm_R_fold=0.0)
    # the pillow jumps up onto the bed during L03 and settles next to the blanket
    t_jump = l03.t + 0.5
    tl.set(Y, t_jump, 0.45, "linear", pitch=0.0, turn=0.0, **ry((-0.5, 0.7, 0.538)))
    tl.hop(Y, t_jump, 0.22, 0.45, 0.18)
    tl.sfx(t_jump + 0.45, S("poof.wav"), -8)
    tl.set(Y, t_jump + 0.6, 0.5, **ry(HOME["yastik"]["loc"]))
    tl.look(Y, t_jump + 0.7, B, 0.3, head=0.5)
    # L04: "Ben de seni özledim be!" – and in for a hug
    tl.expr(Y, l04.t - 0.1, "happy", 0.25, m_open=0.3)
    tl.set(Y, l04.find("öz") - 0.1, 0.3, arm_L_raise=1.3, arm_R_raise=1.3)
    tl.set(Y, t_hug, 0.45, "out", **ry(HUG_SPOT))
    tl.hop(Y, t_hug, 0.04, 0.4, 0.1)
    tl.set(Y, t_hug + 0.2, 0.4, arm_L_raise=1.0, arm_L_fold=1.0, arm_R_raise=1.0, arm_R_fold=1.0, lean_s=-0.12,
           tilt=-0.1)
    tl.expr(Y, t_hug + 0.3, "touched", 0.3, m_smile=0.6)
    tl.eyes_closed(Y, t_hug + 0.4, l05.t - 0.3)
    # the blanket's "naz": turns away, chin up... then squeezes tight
    tl.expr(B, t_naz, "smug", 0.25, lid_u=0.5)
    tl.set(B, t_naz, 0.3, twist=0.4, tilt=0.1, arm_L_raise=0.6, arm_L_fold=0.8, arm_R_raise=0.6, arm_R_fold=0.8)
    tl.expr(B, t_squeeze - 0.05, "touched", 0.25, m_smile=0.7)
    tl.set(B, t_squeeze, 0.3, "back", twist=-0.1, tilt=-0.08, lean_s=0.15, lean_f=0.15, arm_L_raise=1.4,
           arm_L_fold=1.1, arm_L_curl=0.9, arm_R_raise=1.4, arm_R_fold=1.1, arm_R_curl=0.9)
    tl.pulse(B, t_squeeze + 0.1, 0.5, squash=-0.08)
    tl.pulse(Y, t_squeeze + 0.12, 0.5, squash=-0.1)
    tl.eyes_closed(B, t_squeeze + 0.2, l05.t - 0.2)
    tl.sfx(t_squeeze, S("rustle.wav"), -10)
    tl.set(B, l05.t - 0.35, 0.45, twist=0.0, tilt=0.0, lean_s=0.0, lean_f=0.0, arm_L_raise=0.15, arm_L_fold=0.0,
           arm_L_curl=0.0, arm_R_raise=0.15, arm_R_fold=0.0, arm_R_curl=0.0)
    tl.set(Y, l05.t - 0.35, 0.45, arm_L_raise=0.0, arm_L_fold=0.0, arm_R_raise=0.0, arm_R_fold=0.0, lean_s=0.0,
           tilt=0.0)

    # ============================================================ the talk
    tl.look(Y, l05.t, B, 0.3, head=0.45)
    tl.look(B, l05.t + 0.1, Y, 0.3, head=0.45)
    tl.expr(Y, l05.t, "smug", 0.3, lid_u=0.1)
    tl.set(Y, l05.find("ilginç") - 0.1, 0.3, arm_R_raise=0.9, arm_R_fold=0.4)
    tl.set(Y, l05.end, 0.3, arm_R_raise=0.0, arm_R_fold=0.0)
    tl.expr(B, l06.t - 0.05, "deadpan", 0.3, lid_u=0.45)                 # "Yine ne öğrendin?"
    tl.expr(Y, l07.t - 0.05, "happy", 0.3, m_open=0.2)
    tl.set(Y, l07.find("üçte") - 0.1, 0.3, "back", arm_L_raise=1.2, arm_R_raise=1.2)
    tl.set(Y, l07.find("uyu") - 0.05, 0.3, tilt=0.15)
    tl.set(Y, l07.end, 0.3, arm_L_raise=0.0, arm_R_raise=0.0, tilt=0.0)
    tl.expr(B, l07.find("uyu"), "surprised", 0.3, m_open=0.0)
    tl.expr(B, l08.t - 0.05, "deadpan", 0.2, lid_u=0.5, brow_up_R=0.6)  # "Eee?"
    tl.set(B, l08.t, 0.2, tilt=0.12)
    tl.set(B, l08.end + 0.2, 0.3, tilt=0.0)
    tl.expr(Y, l09.t - 0.05, "annoyed", 0.25, brow_ang=0.6)
    tl.set(Y, l09.find("şikayet") - 0.1, 0.3, "back", arm_L_raise=1.3, arm_R_raise=1.3, arm_L_curl=0.5,
           arm_R_curl=0.5)
    tl.hop(Y, l09.find("şikayet"), 0.03, 0.25, 0.1)
    tl.set(Y, l09.end, 0.3, arm_L_raise=0.0, arm_R_raise=0.0, arm_L_curl=0.0, arm_R_curl=0.0)
    # L10: the blanket, philosophical
    tl.expr(B, l10.t - 0.1, "wistful", 0.4, lid_u=0.3)
    tl.look(B, l10.t, (0.6, -1.8, 1.4), 0.5, head=0.35)                    # gazing into the distance
    tl.set(B, l10.t + 0.3, 0.6, arm_R_raise=0.7, arm_R_fold=0.6, arm_R_curl=0.4)   # a thinker's pose
    tl.expr(B, l10.find("uyanık") - 0.15, "smug", 0.3, lid_u=0.3)
    tl.look(B, l10.find("uyanık"), Y, 0.3, head=0.45)
    tl.set(B, l10.end, 0.3, arm_R_raise=0.0, arm_R_fold=0.0, arm_R_curl=0.0)
    tl.expr(Y, l10.t + 0.5, "surprised", 0.4, m_open=0.0)
    tl.expr(Y, l10.find("uyanık"), "touched", 0.4)
    tl.expr(Y, l11.t - 0.05, "neutral", 0.3, brow_up=0.4)                  # "Peki biz ne yapıyoruz?"
    tl.set(Y, l11.t, 0.3, tilt=0.12)
    tl.set(Y, l11.end, 0.3, tilt=0.0)
    tl.expr(B, l12.t - 0.05, "smug", 0.3, lid_u=0.25)
    tl.set(B, l12.find("uyut") - 0.1, 0.3, arm_L_raise=1.0, arm_L_fold=0.3, arm_R_raise=1.0, arm_R_fold=0.3)
    tl.set(B, l12.find("onlara") - 0.1, 0.3, arm_L_raise=0.3, arm_R_raise=0.3, arm_L_fold=0.0, arm_R_fold=0.0,
           twist=0.25)
    tl.set(B, l12.end, 0.3, twist=0.0, arm_L_raise=0.0, arm_R_raise=0.0)
    # quiet look... then the laugh
    tl.look(Y, t_quiet, B, 0.3, head=0.5)
    tl.look(B, t_quiet + 0.1, Y, 0.3, head=0.5)
    tl.expr(Y, t_quiet + 0.1, "deadpan", 0.3, lid_u=0.3)
    tl.expr(B, t_quiet + 0.2, "deadpan", 0.3, lid_u=0.3)
    for who, d in ((Y, 0.0), (B, 0.1)):
        tl.expr(who, t_laugh + d - 0.05, "happy", 0.15, m_open=0.6, squint=0.7)
        tl.set(who, t_laugh + d, 0.3, lean_f=-0.1, tilt=0.08 if who == Y else -0.08)
        tl.shake(who, t_laugh + d, t_after - t_laugh, "squash", 0.04, 7, decay=False)
        tl.shake(who, t_laugh + d, t_after - t_laugh, "nod", 0.05, 7, decay=False)
        tl.set(who, t_after - 0.1, 0.3, lean_f=0.0, tilt=0.0)
    tl.set(B, t_laugh + 0.3, 0.3, arm_L_raise=1.1, arm_L_fold=1.0)       # holds her belly
    tl.set(B, t_after, 0.3, arm_L_raise=0.0, arm_L_fold=0.0)
    # L13 / L14: "Başka ne öğrendin?" – and the pillow is off again
    tl.expr(B, l13.t - 0.05, "fond", 0.3, lid_u=0.2)
    tl.expr(Y, l14.t - 0.05, "happy", 0.3, m_open=0.2)
    tl.set(Y, l14.t, 0.3, "back", arm_L_raise=1.2, arm_R_raise=0.6, arm_R_fold=0.5)
    tl.layer(Y, lambda t: {"arm_L_raise": 0.35 * math.sin((t - l14.t) * 4.0),
                           "arm_R_fold": 0.3 * math.sin((t - l14.t) * 3.1 + 1)}, l14.t + 0.3, LENGTH)
    tl.expr(B, l14.t + 0.5, "fond", 0.4, lid_u=0.3, m_smile=0.5)

    # ============================================================ sound
    tl.sfx(0.0, S("night_amb.wav"), -18, dur=LENGTH, fade=1.0)
    tl.sfx(t_open, S("creak.wav"), -9)
    for k in range(3):
        tl.sfx(t_in + 0.25 + k * 0.3, S("poof.wav"), -16)
    for k in range(3):
        tl.sfx(l02.t + 0.3 + k * 0.36, S("poof.wav"), -17)
    tl.sfx(t_hug + 0.4, S("music_hum.wav"), -24,
           dur=t_quiet - t_hug - 0.4, fade=0.6)                           # their tune, softly
    tl.sfx(t_out - 0.6, S("music_hum.wav"), -16, dur=LENGTH - t_out + 0.6, fade=1.2)
    tl.sfx(t_title - 0.2, S("ding.wav"), -16)

    # ============================================================ cameras (9:16)
    tl.shot(0.0, "cam_door", (0.25, -2.5, 0.55), (-1.55, -1.45, 0.55), lens=28, fstop=4.0,
            to_loc=(0.1, -2.35, 0.55), dur=t_stop + 0.2)
    tl.face_shot(t_stop + 0.25, "cam_b_see", B, dist=1.2, yaw=10, height=0.06, lens=30, push=0.12, dur=l01.t - t_stop)
    # the whole room from the open side: the pillow by the door, the blanket on the bed
    tl.shot(l01.t + 0.4, "cam_room", (0.1, -4.0, 1.8), (-0.55, -0.4, 0.42), lens=18, fstop=5.6,
            to_loc=(0.05, -3.7, 1.7), dur=l02.end - l01.t)
    tl.face_shot(l03.t - 0.05, "cam_b1", B, dist=1.2, yaw=12, height=0.08, lens=28, push=0.12, dur=l03.dur)
    bed_two = ((0.04, -1.55, 1.1), (0.04, 0.6, 0.78))
    tl.shot(l04.t - 0.05, "cam_two", *bed_two, lens=24, fstop=4.0, to_loc=(0.04, -1.15, 0.98),
            dur=l05.t - l04.t)
    tl.face_shot(l05.t - 0.05, "cam_y1", Y, dist=1.25, yaw=-12, height=0.06, lens=28, push=0.1, dur=l05.dur)
    tl.face_shot(l06.t - 0.05, "cam_b2", B, dist=1.15, yaw=12, height=0.08, lens=28, push=0.08, dur=l06.dur)
    tl.face_shot(l07.t - 0.05, "cam_y2", Y, dist=1.15, yaw=-8, height=0.05, lens=28, push=0.12, dur=l07.dur)
    tl.face_shot(l08.t - 0.05, "cam_b3", B, dist=0.95, yaw=10, height=0.06, lens=30, dur=l08.dur)
    tl.face_shot(l09.t - 0.05, "cam_y3", Y, dist=1.2, yaw=-14, height=0.05, lens=28, push=0.14, dur=l09.dur)
    tl.shot(l10.t - 0.1, "cam_two2", (0.12, -1.3, 1.02), (0.06, 0.65, 0.76), lens=26, fstop=4.0,
            to_loc=(0.1, -0.95, 0.92), dur=l10.dur)
    tl.face_shot(l11.t - 0.05, "cam_y4", Y, dist=1.15, yaw=-10, height=0.05, lens=28, push=0.08, dur=l11.dur)
    tl.face_shot(l12.t - 0.05, "cam_b4", B, dist=1.2, yaw=14, height=0.08, lens=28, push=0.12, dur=l12.dur)
    tl.shot(t_quiet - 0.05, "cam_two3", (0.04, -1.25, 1.0), (0.04, 0.6, 0.76), lens=24, fstop=4.0,
            to_loc=(0.04, -1.45, 1.06), dur=l13.end - t_quiet)

    # the pull-back: from inside the room, back out through the window, over the house, up to the sky
    p0 = Vector((-1.15, -0.28, 1.28))
    p1 = Vector((-3.7, -0.28, 1.5))
    p2 = Vector((-9.5, -2.6, 3.6))
    p3 = Vector((-10.2, -3.0, 4.2))
    look_in = Vector((0.0, 0.72, 0.7))
    look_house = Vector((0.2, 0.0, 2.0))
    look_sky = Vector((22.0, 12.0, 25.0))

    def pull(t):
        a = _smooth(l14.t - 0.05, t_out + 1.5, t)
        b = _smooth(t_out + 1.2, t_out + 3.0, t)
        c = _smooth(t_out + 2.6, LENGTH - 0.3, t)
        loc = p0.lerp(p1, a).lerp(p2, b).lerp(p3, c)
        tgt = look_in.lerp(look_house, _smooth(t_out + 0.9, t_out + 2.6, t)).lerp(look_sky, c)
        return (loc, tgt, look_in.lerp(look_house, b))
    tl.shot(l14.t - 0.05, "cam_pull", tuple(p0), tuple(look_in), lens=24, fstop=8.0, track=pull)
    tl.duration = LENGTH
    globals()["LENGTH"] = LENGTH
    globals()["T_TITLE"] = t_title


def post_ass(path, t0=0.0):
    """The end card: EŞYA MECLİSİ among the stars."""
    from ig.subtitles import _ts
    W, H = 1080, 1920
    a, b = T_TITLE - t0, LENGTH - t0
    rows = ["Style: EndTitle,Nunito Black,124,&H0070D8FF,&H00FFFFFF,&H00301A08,&H64000000,0,0,0,0,100,100,6,0,1,"
            "7,4,5,0,0,0,1"]
    ev = [f"Dialogue: 8,{_ts(a)},{_ts(b + 1)},EndTitle,,0,0,0,,{{\\pos({W // 2},{int(H * 0.42)})\\fad(900,0)"
          f"\\blur2\\fscx88\\fscy88\\t(0,1800,\\fscx100\\fscy100)}}EŞYA MECLİSİ"]
    with open(path, encoding="utf-8") as f:
        txt = f.read()
    head, events = txt.split("[Events]", 1)
    head = head.rstrip("\n") + "\n" + "\n".join(rows) + "\n\n"
    with open(path, "w", encoding="utf-8") as f:
        f.write(head + "[Events]" + events.rstrip("\n") + "\n" + "\n".join(ev) + "\n")
    return path


LENGTH = 40.0
T_TITLE = 38.0
