"""EŞYA MECLİSİ – "Demirbaş" (~40 s, 9:16). Comedy, no subtitles.

The pillow and the blanket, made up, hug on the living-room sofa. The mug (the house's
'bardak', the same Kupa as in B02) watches from the coffee table and can't keep out of it.

Same Yastık, Battaniye and Kupa rigs and designs. Stop-motion feel: the animation is shot
"on twos" (every pose held for two frames), like claymation – the characters themselves are
not re-textured, so they stay exactly as designed. Free tools only: Chatterbox voices cloned
from each character's own earlier voice (three distinct voices), numpy music/sfx, Blender,
ffmpeg. No narrator, no subtitles.

Dialogue (exactly as written):
  L01 KUPA       Ben bir şey soracağım. Siz şimdi barıştınız mı, yoksa bu sarılma geçici mi?
  L02 YASTIK     Sanane kardeşim, biz aile meselesini çözdük.
  L03 BATTANİYE  Sen de her şeye burnunu sokma, soğuk çay!
  L04 KUPA       Ulan ben olmasam bu evde kimsenin hayatı yok. Sabah kahve bende, akşam çay bende. Biraz saygı!
  L05 YASTIK     Senin bütün hayatın dolup boşalmak zaten.
  L06 KUPA       En azından içim dolu be kardeşim!
  L11 BATTANİYE  (kahkaha)
  L07 BATTANİYE  Yastığım, bence bunu da aileye alalım. Biraz yalnız kalmış.
  L08 KUPA       Ben aileye girmem. Ben bu ailenin demirbaşıyım!
  L09 YASTIK     Tamam demirbaş, sus da biraz çayını içelim.
  L10 KUPA       İÇİMDE ÇAY YOK ULAN!
  L12 BATTANİYE  (kahkaha) – the pillow shakes its head, the mug fumes.
"""
import math
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CAST = ("yastik", "battaniye", "kupa")
LIGHT_OPTS = dict(night=True)
NO_SUBTITLES = True
ON_TWOS = True
PACING = {}
LINES = {
    "L01_kupa": "Ben bir şey soracağım. Siz şimdi barıştınız mı, yoksa bu sarılma geçici mi?",
    "L02_yastik": "Sanane kardeşim, biz aile meselesini çözdük.",
    "L03_battaniye": "Sen de her şeye burnunu sokma, soğuk çay!",
    "L04_kupa": "Ulan ben olmasam bu evde kimsenin hayatı yok. Sabah kahve bende, akşam çay bende. Biraz saygı!",
    "L05_yastik": "Senin bütün hayatın dolup boşalmak zaten.",
    "L06_kupa": "En azından içim dolu be kardeşim!",
    "L07_battaniye": "Yastığım, bence bunu da aileye alalım. Biraz yalnız kalmış.",
    "L08_kupa": "Ben aileye girmem. Ben bu ailenin demirbaşıyım!",
    "L09_yastik": "Tamam demirbaş, sus da biraz çayını içelim.",
    "L10_kupa": "İÇİMDE ÇAY YOK ULAN!",
}
SO = (-40.0, 0.0, 0.0)                       # ig.sets.salon.ORIGIN
SEAT_Z, SEAT_FRONT = 0.44, 0.15
TABLE_XY, TABLE_Z = (0.15, -0.42), 0.4
MUG_AT = (SO[0] + 0.3, SO[1] - 0.36, TABLE_Z)
HOME = {"yastik": dict(loc=(SO[0] - 0.24, SO[1] + SEAT_FRONT + 0.32, SEAT_Z), rot=(math.radians(-8), 0, 0)),
        "battaniye": dict(loc=(SO[0] + 0.22, SO[1] + SEAT_FRONT + 0.3, SEAT_Z), rot=(0, 0, 0)),
        "kupa": dict(loc=MUG_AT, rot=(0, 0, math.pi - 0.25))}      # facing the sofa


def build(tl, ep):
    import bpy
    from mathutils import Vector

    from ig.sets import salon

    A = lambda lid: os.path.join(ep, "audio", "paced", lid + ".wav")
    S = lambda f: os.path.join(ROOT, "assets", "sfx", f)
    Y, B, K = "yastik", "battaniye", "kupa"
    salon.build(coffee_table=True)
    if bpy.data.objects.get("Sun"):
        bpy.data.objects["Sun"].data.energy = 0.0
    if bpy.data.objects.get("tv_glow"):
        bpy.data.objects["tv_glow"].data.energy = 0.0
    for name in ("tv_stand", "tv_body", "tv_screen"):                       # no TV in this one
        if bpy.data.objects.get(name):
            bpy.data.objects[name].hide_render = True
    O = Vector(SO)
    P = lambda x, y, z: tuple(O + Vector((x, y, z)))
    mid = O + Vector((0.0, SEAT_FRONT + 0.3, SEAT_Z + 0.25))

    # ============================================================ beats
    l01 = tl.say(K, 1.8, A("L01_kupa"), intensity=1.0, bob=0.9)
    l02 = tl.say(Y, l01.end + 0.35, A("L02_yastik"), intensity=0.85, bob=0.7)
    l03 = tl.say(B, l02.end + 0.25, A("L03_battaniye"), intensity=0.9, bob=0.8)
    l04 = tl.say(K, l03.end + 0.2, A("L04_kupa"), intensity=1.2, bob=1.3)
    l05 = tl.say(Y, l04.end + 0.55, A("L05_yastik"), intensity=0.8, bob=0.6)
    l06 = tl.say(K, l05.end + 0.12, A("L06_kupa"), intensity=1.2, bob=1.2)
    lx = tl.say(B, l06.end + 0.35, A("L11_battaniye"), intensity=1.1, bob=1.3)      # can't stop laughing
    l07 = tl.say(B, lx.end + 0.1, A("L07_battaniye"), intensity=0.9, bob=0.7)
    l08 = tl.say(K, l07.end + 0.12, A("L08_kupa"), intensity=1.15, bob=1.2)
    l09 = tl.say(Y, l08.end + 0.6, A("L09_yastik"), intensity=0.8, bob=0.6)
    l10 = tl.say(K, l09.end + 0.35, A("L10_kupa"), intensity=1.5, bob=2.0)
    lz = tl.say(B, l10.end + 0.25, A("L12_battaniye"), intensity=1.1, bob=1.3)
    LENGTH = lz.end + 2.3
    print(f"[b07] l04 {l04.t:.2f} laugh {lx.t:.2f} l10 {l10.t:.2f} length {LENGTH:.2f}")

    # ============================================================ acting
    # the hug: side by side, leaning into each other, arms round
    for who, side in ((Y, 1), (B, -1)):
        tl.set(who, 0.0, 0.01, lean_s=0.13 * side, tilt=0.08 * side)
        tl.expr(who, 0.0, "fond", 0.01, lid_u=0.4)
    tl.set(B, 0.0, 0.01, arm_R_raise=1.3, arm_R_fold=0.9, arm_R_curl=0.6)
    tl.set(Y, 0.0, 0.01, arm_L_raise=0.9, arm_L_fold=0.6)
    tl.eyes_closed(Y, 0.0, l01.t + 0.6)
    tl.eyes_closed(B, 0.0, l01.t + 0.8)
    tl.layer(Y, lambda t: {"squash": 0.015 * math.sin(t * 2.2)}, 0.0, l01.t + 1.0)       # cosy sway
    tl.layer(B, lambda t: {"squash": 0.015 * math.sin(t * 2.2 + 1)}, 0.0, l01.t + 1.0)
    # the mug, suspicious, leaning in
    tl.expr(K, 0.0, "deadpan", 0.01, lid_u=0.5, brow_ang=0.4)
    tl.set(K, 0.2, 0.8, lean_f=0.12)
    tl.set(K, l01.t, 0.3, lean_f=0.0)
    tl.expr(K, l01.t - 0.05, "sarcastic", 0.3)
    tl.set(K, l01.find("barış") - 0.1, 0.3, arm_R_raise=0.9, arm_R_fold=0.3)          # points with the handle
    tl.expr(K, l01.find("geçici") - 0.1, "smug", 0.3, lid_u=0.35)
    tl.set(K, l01.end, 0.3, arm_R_raise=0.0, arm_R_fold=0.0)
    # L02 / L03: the couple, not impressed
    for who in (Y, B):
        tl.look(who, l01.find("barış"), K, 0.3, head=0.45, up=-0.1)
    tl.expr(Y, l02.t - 0.05, "annoyed", 0.3)
    tl.set(Y, l02.t, 0.3, lean_s=0.05, arm_L_raise=0.0, arm_L_fold=0.0, arm_R_raise=0.8, arm_R_fold=0.3)
    tl.set(Y, l02.find("aile") - 0.1, 0.3, nod=0.08)
    tl.expr(Y, l02.find("çöz"), "smug", 0.3)
    tl.set(Y, l02.end, 0.3, arm_R_raise=0.0, arm_R_fold=0.0, nod=0.0)
    tl.expr(B, l03.t - 0.05, "sarcastic", 0.3)
    tl.set(B, l03.t, 0.3, lean_s=0.0, tilt=0.0, arm_R_raise=0.6, arm_R_fold=0.4, arm_R_curl=0.0)
    tl.set(B, l03.find("burnu") - 0.1, 0.25, arm_L_raise=1.0, arm_L_fold=0.2)          # waves it off
    tl.expr(B, l03.find("soğuk") - 0.05, "smug", 0.25, lid_u=0.4)
    tl.set(B, l03.end, 0.3, arm_L_raise=0.0, arm_L_fold=0.0, arm_R_raise=0.0, arm_R_fold=0.0)
    tl.expr(K, l03.find("soğuk"), "offended", 0.15, brow_up=0.9)
    tl.pulse(K, l03.find("soğuk"), 0.4, squash=0.1)
    # L04: offended, waving its handle, hopping on the table
    tl.expr(K, l04.t - 0.05, "angry", 0.2)
    tl.set(K, l04.t, 0.2, arm_R_raise=1.2, arm_R_fold=0.5)
    tl.layer(K, lambda t: {"arm_R_raise": 0.45 * math.sin((t - l04.t) * 7.0),
                           "arm_R_fold": 0.3 * math.sin((t - l04.t) * 5.0)}, l04.t + 0.2, l04.end)
    tl.hop(K, l04.find("ulan"), 0.04, 0.22, 0.2)
    tl.expr(K, l04.find("sabah") - 0.05, "dramatic", 0.25)
    tl.set(K, l04.find("sabah") - 0.05, 0.25, turn=0.35)
    tl.set(K, l04.find("akşam") - 0.05, 0.25, turn=-0.35)
    tl.expr(K, l04.find("saygı") - 0.1, "shout", 0.15)
    tl.hop(K, l04.find("saygı"), 0.06, 0.25, 0.25)
    tl.set(K, l04.end, 0.3, turn=0.0, arm_R_raise=0.0, arm_R_fold=0.0)
    for who in (Y, B):
        tl.expr(who, l04.t + 0.6, "deadpan", 0.4, lid_u=0.45)
    # L05: the pillow, dry
    tl.expr(Y, l05.t - 0.05, "sarcastic", 0.3, lid_u=0.35)
    tl.set(Y, l05.find("dolup") - 0.1, 0.3, tilt=0.12)
    tl.set(Y, l05.end, 0.3, tilt=0.0)
    tl.expr(K, l05.find("dolup"), "offended", 0.2, brow_up=1.0, m_open=0.3)
    # L06: puffed up
    tl.expr(K, l06.t - 0.05, "smug", 0.2, brow_up=0.6)
    tl.set(K, l06.t, 0.3, lean_f=-0.12, arm_R_raise=0.7, arm_R_fold=0.9)
    tl.pulse(K, l06.find("dolu"), 0.5, squash=0.12)
    tl.set(K, l06.end, 0.3, lean_f=0.0, arm_R_raise=0.0, arm_R_fold=0.0)
    # the blanket can't stop laughing; the pillow smirks; the mug glares
    tl.expr(B, lx.t - 0.05, "happy", 0.15, m_open=0.7, squint=0.8)
    tl.set(B, lx.t, 0.3, lean_f=-0.15, tilt=-0.12, arm_L_raise=1.1, arm_L_fold=1.0)
    tl.shake(B, lx.t, lx.dur, "squash", 0.05, 7, decay=False)
    tl.shake(B, lx.t, lx.dur, "nod", 0.06, 6, decay=False)
    tl.hop(B, lx.t + 0.5, 0.03, 0.25, 0.12)
    tl.set(B, lx.end, 0.3, lean_f=0.0, tilt=0.0, arm_L_raise=0.0, arm_L_fold=0.0)
    tl.expr(Y, lx.t + 0.1, "sarcastic", 0.3, lid_u=0.3, m_smile=0.4)
    tl.look(Y, lx.t + 0.2, K, 0.3, head=0.45)
    tl.expr(K, lx.t + 0.2, "angry", 0.3, lid_u=0.2)
    # L07: the blanket, wiping its eyes, playing the big sister
    tl.look(B, l07.t, Y, 0.3, head=0.45)
    tl.expr(B, l07.t, "fond", 0.3, lid_u=0.2)
    tl.set(B, l07.find("aile") - 0.1, 0.3, arm_R_raise=1.0, arm_R_fold=0.3)           # waves at the mug
    tl.look(B, l07.find("aile"), K, 0.3, head=0.45)
    tl.expr(B, l07.find("yalnız") - 0.1, "sad", 0.3, brow_up=0.7, m_smile=0.3)
    tl.set(B, l07.end, 0.3, arm_R_raise=0.0, arm_R_fold=0.0)
    tl.expr(K, l07.find("aile"), "surprised", 0.2)
    # L08: chest out, offended pride
    tl.expr(K, l08.t - 0.05, "offended", 0.25, brow_up=0.4)
    tl.set(K, l08.t, 0.3, lean_f=-0.15, twist=0.3)
    tl.set(K, l08.find("demir") - 0.1, 0.25, "back", arm_R_raise=1.4, arm_R_fold=0.2, twist=0.0)
    tl.expr(K, l08.find("demir") - 0.1, "smug", 0.25, brow_up=0.7)
    tl.set(K, l08.end, 0.3, lean_f=0.0, arm_R_raise=0.0, arm_R_fold=0.0)
    # L09: the pillow, calmly
    tl.look(Y, l09.t, K, 0.2, head=0.45)
    tl.expr(Y, l09.t - 0.05, "tired", 0.3)
    tl.set(Y, l09.find("sus") - 0.1, 0.3, arm_R_raise=0.7, arm_R_fold=0.3)
    tl.expr(Y, l09.find("çay") - 0.05, "smug", 0.3, lid_u=0.3)
    tl.set(Y, l09.end, 0.3, arm_R_raise=0.0, arm_R_fold=0.0)
    # L10: the explosion
    tl.expr(K, l10.t - 0.08, "shout", 0.1)
    tl.set(K, l10.t, 0.1, lean_f=0.12)
    tl.hop(K, l10.t + 0.05, 0.09, 0.3, 0.3)
    tl.shake(K, l10.t, 1.2, "tilt", 0.12, 11)
    tl.shake(K, l10.t, 1.0, "lean_s", 0.08, 9)
    tl.set(K, l10.t, 0.15, arm_R_raise=1.6, arm_R_fold=0.8, arm_R_curl=0.6)
    for who in (Y, B):
        tl.expr(who, l10.t + 0.05, "surprised", 0.1, brow_up=1.0)
        tl.pulse(who, l10.t + 0.05, 0.35, squash=-0.08, lean_f=-0.08)
    # ending: the blanket laughs again, the pillow shakes its head, the mug fumes
    tl.expr(B, lz.t - 0.05, "happy", 0.15, m_open=0.7, squint=0.8)
    tl.set(B, lz.t, 0.3, lean_f=-0.12, tilt=-0.1, arm_L_raise=1.1, arm_L_fold=1.0)
    tl.shake(B, lz.t, LENGTH - lz.t, "squash", 0.05, 7, decay=False)
    tl.expr(Y, l10.end + 0.3, "tired", 0.3, lid_u=0.55, m_press=0.3)
    tl.layer(Y, lambda t: {"twist": 0.28 * math.sin((t - l10.end - 0.4) * 9.0)}, l10.end + 0.4, l10.end + 1.6)
    tl.expr(K, l10.end + 0.2, "angry", 0.25, lid_u=0.1, m_press=0.6)
    tl.set(K, l10.end + 0.2, 0.3, lean_f=0.0, arm_R_raise=0.9, arm_R_fold=1.2, arm_R_curl=0.0, turn=-0.6)
    tl.layer(K, lambda t: {"squash": 0.03 * math.sin(t * 26), "tilt": 0.02 * math.sin(t * 19)}, l10.end + 0.3,
             LENGTH)                                                                      # quivering with rage

    # ============================================================ sound
    tl.sfx(0.0, S("music_playful.wav"), -21, dur=l10.t - 0.05, fade=0.06)    # stops dead on the shout
    tl.sfx(l10.end + 0.2, S("music_playful.wav"), -20, dur=LENGTH - l10.end - 0.2, fade=0.6)
    tl.sfx(l03.find("soğuk") + 0.2, S("clink.wav"), -14)
    tl.sfx(l04.find("ulan"), S("clink.wav"), -12)
    tl.sfx(l04.find("saygı") + 0.25, S("clink.wav"), -12)
    tl.sfx(l10.t + 0.3, S("clink.wav"), -9)
    tl.sfx(l10.t + 0.05, S("jitter.wav"), -14, dur=1.2, fade=0.2)
    tl.sfx(LENGTH - 0.9, S("rimshot.wav"), -6)

    # ============================================================ cameras (9:16)
    # wide: the couple on the sofa, the mug's back ("ÖNCE KAHVE") on the table in front
    wide = (P(0.05, -1.75, 0.92), P(0.05, 0.35, 0.58))
    tl.shot(0.0, "cam_wide", *wide, lens=26, fstop=4.0, to_loc=P(0.05, -1.5, 0.88), dur=l01.t)
    mug_cu = lambda name, t, dur, dist=0.5, yaw=0.0: tl.face_shot(t, name, K, dist=dist, yaw=yaw, height=0.03,
                                                                    lens=35, push=0.12, dur=dur)
    mug_cu("cam_k1", l01.t - 0.05, l01.dur, 0.6, -55)
    tl.shot(l02.t - 0.05, "cam_two", P(0.08, -1.1, 0.8), P(0.0, 0.42, 0.66), lens=28, fstop=3.2,
            to_loc=P(0.06, -0.95, 0.78), dur=l02.dur + l03.dur + 0.1)
    mug_cu("cam_k2", l04.t - 0.05, l04.dur, 0.68, -40)
    tl.face_shot(l05.t - 0.05, "cam_y1", Y, dist=1.15, yaw=-10, height=0.04, lens=28, push=0.1, dur=l05.dur)
    mug_cu("cam_k3", l06.t - 0.05, l06.dur, 0.5, -50)
    tl.shot(lx.t - 0.05, "cam_three", P(0.75, -1.45, 0.95), P(0.05, 0.05, 0.56), lens=26, fstop=4.0,
            to_loc=P(0.65, -1.3, 0.9), dur=lx.dur + l07.dur)
    mug_cu("cam_k4", l08.t - 0.05, l08.dur, 0.62, -35)
    tl.face_shot(l09.t - 0.05, "cam_y2", Y, dist=1.1, yaw=-14, height=0.04, lens=28, push=0.12, dur=l09.dur)
    mug_cu("cam_k5", l10.t - 0.05, l10.dur, 0.42, -45)
    tl.shot(l10.end + 0.1, "cam_end", P(0.85, -1.55, 0.95), P(0.08, 0.0, 0.55), lens=26, fstop=4.5,
            to_loc=P(0.8, -1.75, 1.0), dur=LENGTH - l10.end)
    tl.duration = LENGTH
