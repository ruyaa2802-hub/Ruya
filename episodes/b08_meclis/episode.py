"""EŞYA MECLİSİ – "Meclis Kuruluyor" (~40 s, 9:16). The episode that names the series.

The pillow and the blanket hug on the living-room sofa. The mug on the coffee table won't let
it go: it voted for the pillow to leave. Everyone has a complaint about the humans, so the mug
founds a council – the Eşya Meclisi – and makes itself president ("the warmest one leads"),
until the blanket points out it has been ice cold all morning. Meeting adjourned. Then the
owner's hand comes in and takes the mug away: "Gördünüz mü? Seçilmiş kişi benim!"

Same Yastık, Battaniye and Kupa rigs; the hand is the owner's arm from B03 (ig/characters/insan.py).
Stop-motion feel ("on twos"). Turkish captions burned in. Free tools only.

  L01 KUPA       Durun durun durun! Üç gün önce “Ben bu evde kalamam” diyen kimdi?
  L02 YASTIK     Oy çokluğuyla döndüm kardeşim. Demokrasi!
  L03 KUPA       Ben de oy verdim. “Gitsin” dedim!
  L04 BATTANİYE  O yüzden mi sabahtan beri soğuk duruyorsun?
  L05 KUPA       Ben soğuk değilim, kahvem soğuk! Üç kere ısıttı, üç kere unuttu!
  L06 YASTIK     Bu evde herkes bir şey çekiyor zaten. Ben yere atılıyorum…
  L07 BATTANİYE  Ben her gece tekmeleniyorum…
  L08 KUPA       Hah! O zaman bir meclis kuralım. Eşya Meclisi!
  L09 YASTIK     Başkan kim olacak?
  L10 KUPA       Tabii ki ben! En sıcak olan başkan olur!
  L11 BATTANİYE  Sen sabahtan beri buz gibisin.
  L12 KUPA       …Toplantı ertelenmiştir.
  L13 BATTANİYE  (kahkaha) – the pillow shakes its head
  (ev sahibinin eli girer, kupayı alır)
  L14 KUPA       Gördünüz mü? Seçilmiş kişi benim!
"""
import math
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CAST = ("yastik", "battaniye", "kupa")
LIGHT_OPTS = dict(night=True)
ON_TWOS = True
PACING = {}
LINES = {
    "L01_kupa": "Durun durun durun! Üç gün önce “Ben bu evde kalamam” diyen kimdi?",
    "L02_yastik": "Oy çokluğuyla döndüm kardeşim. Demokrasi!",
    "L03_kupa": "Ben de oy verdim. “Gitsin” dedim!",
    "L04_battaniye": "O yüzden mi sabahtan beri soğuk duruyorsun?",
    "L05_kupa": "Ben soğuk değilim, kahvem soğuk! Üç kere ısıttı, üç kere unuttu!",
    "L06_yastik": "Bu evde herkes bir şey çekiyor zaten. Ben yere atılıyorum…",
    "L07_battaniye": "Ben her gece tekmeleniyorum…",
    "L08_kupa": "Hah! O zaman bir meclis kuralım. Eşya Meclisi!",
    "L09_yastik": "Başkan kim olacak?",
    "L10_kupa": "Tabii ki ben! En sıcak olan başkan olur!",
    "L11_battaniye": "Sen sabahtan beri buz gibisin.",
    "L12_kupa": "…Toplantı ertelenmiştir.",
    "L14_kupa": "Gördünüz mü? Seçilmiş kişi benim!",
}
SO = (-40.0, 0.0, 0.0)                       # ig.sets.salon.ORIGIN
SEAT_Z, SEAT_FRONT = 0.44, 0.15
TABLE_Z = 0.4
MUG_AT = (SO[0] + 0.3, SO[1] - 0.36, TABLE_Z)
OWNER = (SO[0] + 0.95, SO[1] - 0.3, 1.0)     # bending over the table from the right, out of frame
HOME = {"yastik": dict(loc=(SO[0] - 0.24, SO[1] + SEAT_FRONT + 0.32, SEAT_Z), rot=(math.radians(-8), 0, 0)),
        "battaniye": dict(loc=(SO[0] + 0.22, SO[1] + SEAT_FRONT + 0.3, SEAT_Z), rot=(0, 0, 0)),
        "kupa": dict(loc=MUG_AT, rot=(0, 0, math.pi - 0.25))}      # facing the sofa


def _smooth(a, b, t):
    k = min(max((t - a) / (b - a), 0.0), 1.0)
    return k * k * (3 - 2 * k)


def build(tl, ep):
    import bpy
    from mathutils import Matrix, Vector

    from ig.characters import insan
    from ig.sets import salon

    A = lambda lid: os.path.join(ep, "audio", "paced", lid + ".wav")
    S = lambda f: os.path.join(ROOT, "assets", "sfx", f)
    Y, B, K = "yastik", "battaniye", "kupa"
    salon.build(coffee_table=True)
    for name in ("tv_stand", "tv_body", "tv_screen"):
        if bpy.data.objects.get(name):
            bpy.data.objects[name].hide_render = True
    for name in ("Sun", "tv_glow"):
        if bpy.data.objects.get(name):
            bpy.data.objects[name].data.energy = 0.0
    O = Vector(SO)
    P = lambda x, y, z: tuple(O + Vector((x, y, z)))

    # ============================================================ beats
    l01 = tl.say(K, 0.35, A("L01_kupa"), intensity=1.2, bob=1.3)
    l02 = tl.say(Y, l01.end + 0.15, A("L02_yastik"), intensity=0.9, bob=0.8)
    l03 = tl.say(K, l02.end + 0.12, A("L03_kupa"), intensity=1.15, bob=1.1)
    l04 = tl.say(B, l03.end + 0.15, A("L04_battaniye"), intensity=0.85, bob=0.7)
    l05 = tl.say(K, l04.end + 0.12, A("L05_kupa"), intensity=1.2, bob=1.3)
    l06 = tl.say(Y, l05.end + 0.3, A("L06_yastik"), intensity=0.8, bob=0.6)
    l07 = tl.say(B, l06.end + 0.1, A("L07_battaniye"), intensity=0.8, bob=0.6)
    l08 = tl.say(K, l07.end + 0.2, A("L08_kupa"), intensity=1.2, bob=1.3)
    l09 = tl.say(Y, l08.end + 0.15, A("L09_yastik"), intensity=0.85, bob=0.7)
    l10 = tl.say(K, l09.end + 0.12, A("L10_kupa"), intensity=1.2, bob=1.3)
    l11 = tl.say(B, l10.end + 0.2, A("L11_battaniye"), intensity=0.85, bob=0.6)
    t_freeze = l11.end + 0.1                                 # the mug freezes, thinks...
    l12 = tl.say(K, t_freeze + 0.9, A("L12_kupa"), intensity=0.7, bob=0.4)
    lx = tl.say(B, l12.end + 0.15, A("L13_battaniye"), intensity=1.1, bob=1.3)
    t_reach = lx.t + 0.6                                     # the owner's hand comes in
    t_grab = t_reach + 0.7
    t_lift = t_grab + 0.15
    l14 = tl.say(K, t_lift + 0.1, A("L14_kupa"), intensity=1.3, bob=1.6)
    t_gone = l14.end + 0.15
    LENGTH = t_gone + 0.9
    print(f"[b08] l05 {l05.t:.2f} l08 {l08.t:.2f} l12 {l12.t:.2f} grab {t_grab:.2f} length {LENGTH:.2f}")

    # ============================================================ the owner's hand (only the arm is ever seen)
    hu = insan.build(bpy.data.collections.get("Salon"))
    for part in ("leg_L", "leg_R", "torso"):
        for o in [hu[part]] + list(hu[part].children):
            o.hide_render = True
    root_rot = -math.pi / 2
    root_loc = Vector((OWNER[0], OWNER[1], OWNER[2] - 1.42))
    hu["root"].location = root_loc
    hu["root"].rotation_euler = (0, 0, root_rot)
    shoulder = Vector(insan.SHOULDER)
    mug = Vector(MUG_AT)
    away = O + Vector((1.45, -0.55, 1.15))
    out = O + Vector((1.35, -0.75, 1.3))

    def lift_path(t):                                          # held by the body, up and out to the right
        k = _smooth(t_lift, t_gone, t)
        return mug.lerp(out, k) + Vector((0, 0, 0.25 * math.sin(math.pi * k)))

    def hand_target(t):
        grip = Vector((0.03, -0.02, 0.11))
        if t < t_reach:
            return away
        if t < t_lift:
            return away.lerp(mug + grip, _smooth(t_reach, t_grab, t))
        return lift_path(t) + grip

    def arm_fn(t):
        tgt = Matrix.Rotation(-root_rot, 3, "Z") @ (hand_target(t) - root_loc)
        d = tgt - shoulder
        n = d.normalized()
        loc = tgt - n * 0.68 if d.length > 0.68 else shoulder
        return {"location": tuple(loc - shoulder),
                "rotation_euler": (math.acos(max(-1.0, min(1.0, -n.z))), 0.0, math.atan2(-n.x, n.y))}

    tl.prop(hu["arm"], arm_fn)
    for o in (hu["arm"], hu["hand"]):                          # the arm only exists for the ending
        o.hide_render = True
        o.keyframe_insert("hide_render", frame=0)
        o.hide_render = False
        o.keyframe_insert("hide_render", frame=int((t_reach - 0.3) * tl.fps))

    # the mug rides along with the hand once it's lifted
    def carried(t):
        if t < t_lift:
            return {}
        d = lift_path(t) - mug
        return {"pos_x": d.x, "pos_y": d.y, "pos_z": d.z, "lean_s": 0.25 * _smooth(t_lift, t_lift + 0.4, t)}
    tl.layer(K, carried, t_lift, LENGTH + 1)

    # ============================================================ acting
    # opening: the hug... interrupted
    for who, side in ((Y, 1), (B, -1)):
        tl.set(who, 0.0, 0.01, lean_s=0.13 * side, tilt=0.08 * side)
        tl.expr(who, 0.0, "fond", 0.01, lid_u=0.4)
        tl.expr(who, l01.t + 0.25, "surprised", 0.15)
        tl.set(who, l01.t + 0.3, 0.3, lean_s=0.0, tilt=0.0)
        tl.look(who, l01.t + 0.3, K, 0.25, head=0.45, up=-0.1)
    tl.set(B, 0.0, 0.01, arm_R_raise=1.3, arm_R_fold=0.9, arm_R_curl=0.6)
    tl.set(Y, 0.0, 0.01, arm_L_raise=0.9, arm_L_fold=0.6)
    tl.eyes_closed(Y, 0.0, l01.t + 0.2)
    tl.eyes_closed(B, 0.0, l01.t + 0.25)
    tl.set(B, l01.t + 0.4, 0.3, arm_R_raise=0.0, arm_R_fold=0.0, arm_R_curl=0.0)
    tl.set(Y, l01.t + 0.4, 0.3, arm_L_raise=0.0, arm_L_fold=0.0)
    tl.expr(K, 0.0, "angry", 0.01)
    tl.set(K, 0.0, 0.01, arm_R_raise=1.4, arm_R_fold=0.5)
    tl.layer(K, lambda t: {"arm_R_raise": 0.5 * math.sin((t - l01.t) * 9.0)}, l01.t, l01.find("üç"))   # "durun durun!"
    tl.hop(K, l01.t + 0.05, 0.05, 0.22, 0.2)
    tl.hop(K, l01.t + 0.45, 0.04, 0.2, 0.18)
    tl.expr(K, l01.find("üç") - 0.05, "sarcastic", 0.25)
    tl.set(K, l01.find("kim") - 0.1, 0.25, arm_R_raise=0.8, arm_R_fold=0.2)                       # points
    tl.set(K, l01.end, 0.3, arm_R_raise=0.0, arm_R_fold=0.0)
    # L02: the pillow, proud
    tl.expr(Y, l02.t - 0.05, "smug", 0.3)
    tl.set(Y, l02.find("demo") - 0.1, 0.3, "back", arm_L_raise=1.2, arm_R_raise=1.2)
    tl.set(Y, l02.end, 0.3, arm_L_raise=0.0, arm_R_raise=0.0)
    # L03: the mug, petty
    tl.expr(K, l03.t - 0.05, "smug", 0.25, lid_u=0.3)
    tl.set(K, l03.t, 0.3, lean_f=-0.1, twist=0.25)
    tl.set(K, l03.find("gitsin") - 0.1, 0.2, arm_R_raise=1.2, arm_R_fold=0.6)
    tl.set(K, l03.end, 0.3, lean_f=0.0, twist=0.0, arm_R_raise=0.0, arm_R_fold=0.0)
    tl.expr(Y, l03.find("gitsin"), "offended", 0.2)
    # L04: the blanket, sly
    tl.expr(B, l04.t - 0.05, "sarcastic", 0.3)
    tl.set(B, l04.find("soğuk") - 0.1, 0.3, tilt=0.12)
    tl.set(B, l04.end, 0.3, tilt=0.0)
    # L05: the mug's grievance (B02 callback)
    tl.expr(K, l05.t - 0.05, "offended", 0.2, brow_up=0.9)
    tl.expr(K, l05.find("kahvem") - 0.05, "angry", 0.2)
    tl.set(K, l05.find("üç") - 0.1, 0.2, arm_R_raise=1.2, arm_R_fold=0.4)
    tl.layer(K, lambda t: {"arm_R_raise": 0.4 * math.sin((t - l05.t) * 7.0)}, l05.find("üç"), l05.end)
    tl.hop(K, l05.find("unuttu"), 0.05, 0.22, 0.22)
    tl.set(K, l05.end, 0.3, arm_R_raise=0.0, arm_R_fold=0.0)
    for who in (Y, B):
        tl.expr(who, l05.find("üç"), "deadpan", 0.4, lid_u=0.4)
    # L06 / L07: they join in, gloomy
    tl.look(Y, l06.t, (SO[0], SO[1] - 1.6, 0.9), 0.4, head=0.3)
    tl.expr(Y, l06.t, "sad", 0.4, brow_up=0.7, lid_u=0.3)
    tl.set(Y, l06.find("yere") - 0.1, 0.3, nod=-0.08)
    tl.expr(B, l07.t - 0.05, "sad", 0.4, brow_up=0.8, lid_u=0.25)
    tl.set(B, l07.t, 0.4, tilt=-0.1, nod=-0.06)
    tl.set(B, l07.end + 0.2, 0.3, tilt=0.0, nod=0.0)
    tl.set(Y, l07.end, 0.3, nod=0.0)
    # L08: the mug's big idea
    tl.expr(K, l08.t - 0.1, "surprised", 0.15, brow_up=1.0)
    tl.hop(K, l08.t + 0.05, 0.06, 0.25, 0.22)
    tl.expr(K, l08.find("meclis") - 0.1, "happy", 0.25, m_open=0.3)
    tl.set(K, l08.find("eşya") - 0.1, 0.3, "back", arm_R_raise=1.5, arm_R_fold=0.0, lean_f=-0.12)
    tl.set(K, l08.end + 0.2, 0.3, arm_R_raise=0.0, lean_f=0.0)
    for who in (Y, B):
        tl.look(who, l08.t, K, 0.25, head=0.45, up=-0.1)
        tl.expr(who, l08.find("eşya"), "surprised", 0.3, m_open=0.0)
    # L09 / L10: who's president?
    tl.expr(Y, l09.t - 0.05, "neutral", 0.3, brow_up=0.5)
    tl.set(Y, l09.t, 0.3, tilt=0.1)
    tl.set(Y, l09.end, 0.3, tilt=0.0)
    tl.expr(K, l10.t - 0.05, "smug", 0.25, lid_u=0.3, brow_up=0.6)
    tl.set(K, l10.t, 0.3, lean_f=-0.15, arm_R_raise=0.9, arm_R_fold=1.0)
    tl.set(K, l10.find("sıcak") - 0.1, 0.3, twist=0.3)
    tl.set(K, l10.end, 0.3, twist=0.0)
    # L11: the blanket's deadpan
    tl.expr(B, l11.t - 0.05, "deadpan", 0.3, lid_u=0.5)
    tl.set(B, l11.find("buz") - 0.1, 0.25, arm_R_raise=0.7, arm_R_fold=0.2)
    tl.set(B, l11.end, 0.3, arm_R_raise=0.0, arm_R_fold=0.0)
    # the freeze: the mug realises; then adjourns with dignity
    tl.expr(K, t_freeze, "surprised", 0.1, m_open=0.0, brow_up=0.6)
    tl.set(K, t_freeze, 0.1, arm_R_raise=0.0, arm_R_fold=0.0, lean_f=0.0)
    tl.set(K, t_freeze + 0.35, 0.3, gaze_y=-0.3, gaze_x=0.1)                                     # looks into itself
    tl.expr(K, l12.t - 0.1, "deadpan", 0.3, lid_u=0.45, m_press=0.2)
    tl.set(K, l12.t, 0.3, gaze_y=0.0, gaze_x=0.0, twist=-0.2)
    tl.set(K, l12.end, 0.3, twist=0.0)
    # the blanket laughs, the pillow shakes its head
    tl.expr(B, lx.t - 0.05, "happy", 0.15, m_open=0.7, squint=0.8)
    tl.set(B, lx.t, 0.3, lean_f=-0.15, tilt=-0.12, arm_L_raise=1.1, arm_L_fold=1.0)
    tl.shake(B, lx.t, lx.dur, "squash", 0.05, 7, decay=False)
    tl.set(B, lx.end, 0.3, lean_f=0.0, tilt=0.0, arm_L_raise=0.0, arm_L_fold=0.0)
    tl.expr(Y, l12.end + 0.1, "tired", 0.3, lid_u=0.5, m_smile=0.3)
    tl.layer(Y, lambda t: {"twist": 0.26 * math.sin((t - lx.t) * 9.0)}, lx.t, lx.t + 1.2)
    # grabbed! – flailing, triumphant
    tl.expr(K, t_grab - 0.1, "surprised", 0.1, brow_up=1.0)
    tl.expr(K, l14.t - 0.05, "happy", 0.2, m_open=0.4)
    tl.set(K, l14.t, 0.2, arm_R_raise=1.5)
    tl.layer(K, lambda t: {"arm_R_raise": 0.5 * math.sin((t - l14.t) * 10.0)}, l14.t, LENGTH)
    for who in (Y, B):
        tl.expr(who, t_grab, "surprised", 0.15)
        tl.look(who, t_lift + 0.2, O + Vector((1.2, -0.7, 1.1)), 0.4, head=0.5)
        tl.expr(who, l14.find("seçil"), "deadpan", 0.4, lid_u=0.45)
        tl.look_cam(who, t_gone, 0.3)

    # ============================================================ sound
    tl.sfx(0.0, S("music_playful.wav"), -21, dur=t_freeze, fade=0.06)       # stops dead on the freeze
    tl.sfx(lx.t, S("music_playful.wav"), -20, dur=LENGTH - lx.t, fade=0.6)
    tl.sfx(l01.t + 0.25, S("clink.wav"), -12)
    tl.sfx(l05.find("unuttu") + 0.2, S("clink.wav"), -12)
    tl.sfx(l08.t + 0.25, S("clink.wav"), -12)
    tl.sfx(t_grab, S("clink.wav"), -9)
    tl.sfx(t_lift, S("whoosh.wav"), -12)
    tl.sfx(LENGTH - 0.7, S("rimshot.wav"), -6)

    # ============================================================ cameras (9:16)
    wide = (P(0.05, -1.75, 0.92), P(0.05, 0.35, 0.58))
    mug_cu = lambda name, t, dur, dist=0.6, yaw=-45: tl.face_shot(t, name, K, dist=dist, yaw=yaw, height=0.03,
                                                                  lens=35, push=0.12, dur=dur)
    tl.shot(0.0, "cam_wide", *wide, lens=26, fstop=4.0, to_loc=P(0.05, -1.6, 0.9), dur=l01.dur)
    mug_cu("cam_k1", l01.find("üç") - 0.05, l01.end - l01.find("üç"), 0.6, -50)
    tl.shot(l02.t - 0.05, "cam_two", P(0.08, -1.1, 0.8), P(0.0, 0.42, 0.66), lens=28, fstop=3.2,
            to_loc=P(0.06, -0.95, 0.78), dur=l02.dur)
    mug_cu("cam_k2", l03.t - 0.05, l03.dur, 0.55, -45)
    tl.face_shot(l04.t - 0.05, "cam_b1", B, dist=1.15, yaw=12, height=0.06, lens=28, push=0.1, dur=l04.dur)
    mug_cu("cam_k3", l05.t - 0.05, l05.dur, 0.65, -40)
    tl.shot(l06.t - 0.05, "cam_two2", P(0.06, -1.15, 0.82), P(0.0, 0.42, 0.66), lens=28, fstop=3.2,
            to_loc=P(0.05, -0.9, 0.78), dur=l06.dur + l07.dur + 0.1)
    mug_cu("cam_k4", l08.t - 0.05, l08.dur, 0.55, -50)
    tl.face_shot(l09.t - 0.05, "cam_y1", Y, dist=1.1, yaw=-12, height=0.04, lens=28, push=0.1, dur=l09.dur)
    mug_cu("cam_k5", l10.t - 0.05, l10.dur, 0.6, -40)
    tl.face_shot(l11.t - 0.05, "cam_b2", B, dist=1.1, yaw=12, height=0.06, lens=28, push=0.1, dur=l11.dur)
    mug_cu("cam_k6", t_freeze, l12.end - t_freeze, 0.42, -35)
    # wider and a little to the right, so the owner's arm is seen reaching in for the mug
    tl.shot(lx.t - 0.05, "cam_end", P(0.22, -2.0, 1.0), P(0.2, 0.25, 0.62), lens=24, fstop=4.5,
            to_loc=P(0.24, -2.15, 1.03), dur=LENGTH - lx.t)
    tl.duration = LENGTH
