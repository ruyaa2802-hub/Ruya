"""İNSANLAR GİDİNCE – "Yine mi Barıştılar?" (30 s, 9:16)

The owner is on the phone in the bedroom, out of frame, and breaks up – again.
The phone lands on the bed. The pillow and the blanket gossip in whispers.
Then the phone rings: "Aşkım…". New season.

Same Yastık and Battaniye rigs and the same bedroom as B01. Free tools only:
voices are offline and free: Yastık is Piper "fahrettin" slightly lowered; Battaniye
and the owner are Chatterbox (tools/chatterbox_lines.py, refs in assets/voices); music and sfx are synthesised
in ig/music.py and ig/sfx.py.

Dialogue (audio/*.wav, paced into audio/paced/):
  L01 EV SAHİBİ (kadraj dışı, bağırarak)  Bir daha beni arama!
  (telefon yatağa fırlatılır, meşgul sesi – kısa sessizlik)
  L02 YASTIK      Üçüncü kez ayrıldılar. Bu sefer kesin.
  L03 BATTANİYE   Geçen sefer de kesin demiştin. İki saat sonra üstümde öpüşüyorlardı!
  L04 YASTIK      Ben artık bu ilişkinin sezon finalini bekliyorum.
  L05 BATTANİYE   Ben beklemiyorum. Her barışmalarında üstümde sabaha kadar dönüp duruyorlar!
  (telefon çalar: "AŞKIM ARIYOR" – el uzanır, telefonu alır)
  L06 EV SAHİBİ (yumuşak)  Aşkım… seni çok özledim ben…
  (ikisi birbirine bakar)
  L07 BATTANİYE   Yeni bölüm başladı.
  (ikisi de kameraya bakar – ba-dum-tss)
"""
import math
import os
import random

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CAST = ("yastik", "battaniye")
TITLE = "İNSANLAR GİDİNCE"
LENGTH = 30.0
PACING = {}
LINES = {
    "L01_insan": "BİR DAHA BENİ ARAMA!",
    "L02_yastik": "Üçüncü kez ayrıldılar. Bu sefer kesin.",
    "L03_battaniye": "Geçen sefer de kesin demiştin. İki saat sonra üstümde öpüşüyorlardı!",
    "L04_yastik": "Ben artık bu ilişkinin sezon finalini bekliyorum.",
    "L05_battaniye": "Ben beklemiyorum. Her barışmalarında üstümde sabaha kadar dönüp duruyorlar!",
    "L06_insan": "Aşkım… seni çok özledim ben…",
    "L07_battaniye": "Yeni bölüm başladı.",
}
# B01 blocking: the pillow on the left half of the bed, the blanket sitting on the right half
HOME = {"yastik": dict(loc=(-0.3, 0.86, 0.538), rot=(math.radians(-13), 0, 0)),
        "battaniye": dict(loc=(0.38, 0.62, 0.545), rot=(0, 0, math.radians(28) - 0.8))}
OWNER = (1.45, 0.15, 1.05)              # sitting on the bed edge, off-screen right
PHONE = (-0.1, 0.22, 0.556)             # where the phone lands on the bed, in front of the two


def _smooth(a, b, t):
    k = min(max((t - a) / (b - a), 0.0), 1.0)
    return k * k * (3 - 2 * k)


def build(tl, ep):
    import bpy
    from mathutils import Matrix, Vector

    from ig import materials as M
    from ig.audio import FONT
    from ig.characters import insan
    from ig.shapes import bevel, box_mesh, text_mesh

    A = lambda lid: os.path.join(ep, "audio", "paced", lid + ".wav")
    S = lambda f: os.path.join(ROOT, "assets", "sfx", f)
    Y, B = "yastik", "battaniye"
    fps = tl.fps

    # ================================================================ beats
    l01 = tl.offscreen("insan", 0.12, A("L01_insan"))
    t_throw, t_land = l01.end + 0.05, l01.end + 0.42
    l02 = tl.say(Y, 3.05, A("L02_yastik"), intensity=0.85, bob=0.5)
    l03 = tl.say(B, l02.end + 0.2, A("L03_battaniye"), bob=0.7)
    l04 = tl.say(Y, l03.end + 0.25, A("L04_yastik"), bob=0.6)
    l05 = tl.say(B, l04.end + 0.25, A("L05_battaniye"), intensity=1.05, bob=0.9)
    t_ring = l05.end + 1.4
    t_grab, t_lift = t_ring + 1.5, t_ring + 1.75
    l06 = tl.offscreen("insan", t_lift + 0.55, A("L06_insan"))
    t_look = l06.end + 0.2                                   # they look at each other
    l07 = tl.say(B, t_look + 1.8, A("L07_battaniye"), intensity=0.8, bob=0.3)
    t_cam = l07.end + 0.1
    tl.duration = LENGTH

    # ================================================================ the phone
    body = box_mesh("phone", (0.075, 0.155, 0.009), (0, 0, 0.0045))
    body.data.materials.append(M.plastic("phone_body", (0.04, 0.04, 0.05), 0.2))
    bevel(body, 0.006, 3)
    screen_m = M.emission("phone_screen", (0.25, 0.55, 1.0), 0.0)
    screen = box_mesh("phone_screen", (0.067, 0.143, 0.0008), (0, 0, 0.0094))
    screen.data.materials.append(screen_m)
    screen.parent = body
    text_m = M.emission("phone_text", (1.0, 1.0, 1.0), 0.0)
    label = text_mesh("phone_text", "AŞKIM\nARIYOR", 0.013, FONT, extrude=0.0)
    label.data.materials.append(text_m)
    label.parent = body
    label.location = (0, 0.01, 0.0099)
    heart = text_mesh("phone_heart", "<3", 0.018, FONT, extrude=0.0)
    heart.data.materials.append(M.emission("phone_heart", (1.0, 0.25, 0.4), 0.0))
    heart.parent = body
    heart.location = (0, -0.035, 0.0099)
    rest = Vector(PHONE)
    start = Vector((1.5, -0.3, 1.25))

    def lift_path(t):                                       # held in the hand, out of frame to the right
        return rest.lerp(Vector((1.1, 0.05, 1.05)), _smooth(t_lift, t_lift + 0.55, t))

    def phone_fn(t):
        if t < t_throw:
            return {"location": tuple(start - rest), "rotation_euler": (0, 0, 0)}
        if t < t_land:                                      # thrown in a tumbling arc
            k = (t - t_throw) / (t_land - t_throw)
            p = start.lerp(rest, k) + Vector((0, 0, 0.35 * math.sin(math.pi * k)))
            return {"location": tuple(p - rest), "rotation_euler": (3.0 * (1 - k), 1.5 * (1 - k), 2.5 * (1 - k))}
        if t < t_land + 0.25:                               # one small bounce on the mattress
            k = (t - t_land) / 0.25
            return {"location": (0, 0, 0.035 * math.sin(math.pi * k)), "rotation_euler": (0, 0, 0)}
        if t_ring <= t < t_grab:                            # vibrating
            r = random.Random(int(t * fps))
            return {"location": (r.uniform(-0.003, 0.003), r.uniform(-0.003, 0.003), 0),
                    "rotation_euler": (0, 0, r.uniform(-0.05, 0.05))}
        if t >= t_lift:
            return {"location": tuple(lift_path(t) - rest), "rotation_euler": (0.8 * _smooth(t_lift, t_lift + 0.5, t),
                                                                              0, 0)}
        return {}

    body.location = rest
    body.rotation_euler = (0, 0, 0.35)
    tl.prop(body, phone_fn)

    # the owner's arm comes in from the right to take it (the rest of the human stays hidden off-screen)
    hu = insan.build(bpy.data.collections.get("Set"))
    for part in ("leg_L", "leg_R", "torso"):
        for o in [hu[part]] + list(hu[part].children):
            o.hide_render = True
    root_rot = -math.pi / 2                                 # facing the bed (-X)
    root_loc = Vector((OWNER[0], OWNER[1], OWNER[2] - 1.42))
    hu["root"].location = root_loc
    hu["root"].rotation_euler = (0, 0, root_rot)
    shoulder = Vector(insan.SHOULDER)
    away = Vector((1.5, 0.3, 0.9))

    def hand_target(t):
        if t < t_grab - 0.5:
            return away
        if t < t_lift:
            return away.lerp(rest + Vector((0, 0, 0.03)), _smooth(t_grab - 0.5, t_grab, t))
        return lift_path(t) + Vector((0, 0, 0.03))

    def arm_fn(t):
        tgt = Matrix.Rotation(-root_rot, 3, "Z") @ (hand_target(t) - root_loc)
        d = tgt - shoulder
        n = d.normalized()
        loc = tgt - n * 0.68 if d.length > 0.68 else shoulder
        return {"location": tuple(loc - shoulder),
                "rotation_euler": (math.acos(max(-1.0, min(1.0, -n.z))), 0.0, math.atan2(-n.x, n.y))}

    tl.prop(hu["arm"], arm_fn)

    # ================================================================ acting
    # 0-3 s: they play dead while the owner shouts; the phone lands; one eye each opens
    for who in (Y, B):
        tl.eyes_closed(who, 0.0, 2.35)
        tl.pulse(who, t_land, 0.3, squash=-0.06)
    tl.set(Y, 2.2, 0.12, lid_u_L=0.95, lid_l_L=0.4)
    tl.look(Y, 2.35, B, 0.3, head=0.2)
    tl.set(Y, 2.8, 0.15, lid_u_L=0.0, lid_l_L=0.0)
    tl.look(B, 2.45, PHONE, 0.3, head=0.2)
    tl.look(B, 2.9, Y, 0.3, head=0.35)

    # L02: the pillow leans in and whispers
    tl.expr(Y, l02.t - 0.1, "sarcastic", 0.3, lid_u=0.25)
    tl.set(Y, l02.t, 0.4, lean_f=0.06, tilt=0.1, twist=0.12)
    tl.set(Y, l02.find("bu") - 0.05, 0.2, "back", arm_R_raise=0.8, arm_R_fold=0.3)      # "Bu sefer kesin."
    tl.set(Y, l02.find("kesin"), 0.3, nod=0.1)
    tl.set(Y, l02.end, 0.4, nod=0.0, arm_R_raise=0.2, arm_R_fold=0.0)
    tl.expr(B, l02.t + 0.5, "deadpan", 0.4, lid_u=0.35)

    # L03: the blanket, unimpressed – and a little scandalised
    tl.expr(B, l03.t - 0.1, "sarcastic", 0.3)
    tl.set(B, l03.t, 0.4, lean_f=0.06, tilt=-0.08)
    tl.expr(B, (l03.find("saat") - 0.3) - 0.1, "offended", 0.25, brow_up=0.9)
    tl.set(B, (l03.find("saat") - 0.3) - 0.1, 0.3, arm_L_raise=1.2, arm_L_fold=0.8, arm_L_curl=0.6)  # points at herself
    tl.expr(B, l03.find("öpüş") - 0.1, "dramatic", 0.2)
    tl.hop(B, l03.find("öpüş"), 0.03, 0.3, 0.14)
    tl.set(B, l03.end, 0.4, arm_L_raise=0.3, arm_L_fold=0.0, arm_L_curl=0.0, tilt=0.0)
    tl.expr(Y, (l03.find("saat") - 0.3), "surprised", 0.2, m_open=0.0)
    tl.expr(Y, l03.find("öpüş"), "smug", 0.3)

    # L04: the pillow, binge-watching their love life
    tl.expr(Y, l04.t - 0.1, "fond", 0.3, lid_u=0.3)
    tl.look(Y, l04.t, (0.0, -1.5, 1.6), 0.4, head=0.25)                                 # dreamy, into space
    tl.set(Y, l04.find("sezon") - 0.1, 0.3, arm_L_raise=0.7, arm_R_raise=0.7)
    tl.expr(Y, l04.find("final") - 0.1, "happy", 0.3, squint=0.3)
    tl.set(Y, l04.end, 0.4, arm_L_raise=0.0, arm_R_raise=0.0, twist=0.0, lean_f=0.0, tilt=0.0)
    tl.look(B, l04.t + 0.3, Y, 0.3, head=0.4)
    tl.expr(B, l04.find("sezon"), "deadpan", 0.4, lid_u=0.45)

    # L05: the blanket has had it – "dönüp duruyorlar" spins her round
    tl.expr(B, l05.t - 0.1, "annoyed", 0.25)
    tl.set(B, l05.t, 0.3, lean_f=0.0)
    tl.look(B, l05.t + 0.1, Y, 0.2, head=0.4)
    tl.expr(B, l05.find("barış") - 0.1, "angry", 0.25)
    tl.set(B, l05.find("barış") - 0.1, 0.25, "back", arm_L_raise=1.4, arm_R_raise=1.4, arm_L_curl=0.5,
           arm_R_curl=0.5)
    tl.expr(B, l05.find("dönüp") - 0.1, "shout", 0.15, m_open=0.0)
    tl.set(B, l05.find("dönüp"), 0.9, "inout", turn=2 * math.pi)                        # spins once
    tl.sfx(l05.find("dönüp"), S("whoosh.wav"), -10)
    tl.shake(B, l05.find("dönüp"), 1.0, "tilt", 0.08, 5)
    tl.set(B, l05.end, 0.4, arm_L_raise=0.2, arm_R_raise=0.2, arm_L_curl=0.0, arm_R_curl=0.0)
    tl.expr(Y, l05.find("dönüp"), "surprised", 0.2)
    tl.expr(Y, l05.end + 0.3, "smug", 0.4, lid_u=0.3)                                    # snickers
    tl.shake(Y, l05.end + 0.4, 0.8, "squash", 0.03, 7)
    tl.expr(B, l05.end + 0.5, "tired", 0.5)
    tl.sfx(l05.end + 0.35, S("sniff.wav"), -10)

    # the phone rings: both stare at it; the hand takes it; the soft voice
    for who, d in ((Y, 0.0), (B, 0.08)):
        tl.expr(who, t_ring + d, "surprised", 0.12)
        tl.look(who, t_ring + d, PHONE, 0.2, head=0.4)
        tl.look(who, t_lift + 0.2 + d, OWNER, 0.4, head=0.45)
        tl.expr(who, l06.t + 0.5 + d, "deadpan", 0.5, lid_u=0.4)
    # ...and slowly turn to each other
    tl.look(Y, t_look, B, 0.8, head=0.5, kind="inout")
    tl.look(B, t_look + 0.3, Y, 0.8, head=0.5, kind="inout")
    tl.expr(Y, t_look + 0.4, "deadpan", 0.5, lid_u=0.5)
    tl.expr(B, t_look + 0.6, "deadpan", 0.5, lid_u=0.5, brow_up_R=0.5)
    # L07: "Yeni bölüm başladı."
    tl.expr(B, l07.t, "sarcastic", 0.3, lid_u=0.4)
    tl.set(B, l07.t, 0.3, tilt=0.06)
    # both turn to us
    for who in (Y, B):
        tl.look_cam(who, t_cam, 0.25)
        tl.expr(who, t_cam, "deadpan", 0.3, lid_u=0.45, m_press=0.3)

    # ================================================================ sound
    tl.sfx(t_throw, S("whoosh.wav"), -10)
    tl.sfx(t_land, S("poof.wav"), -6)
    tl.sfx(l01.end + 0.1, S("hangup.wav"), -2)
    # background: an original carefree tune hummed softly ("mmm") over plucked chords (ig/music.py hum);
    # it stops when the phone rings and comes back once the owner has melted
    tl.sfx(2.95, S("music_hum.wav"), -18, dur=t_ring - 0.1 - 2.95, fade=0.25)
    tl.sfx(t_look, S("music_hum.wav"), -19, dur=LENGTH - t_look, fade=0.6)
    tl.sfx(t_ring, S("ringtone.wav"), -4, dur=t_lift - t_ring + 0.05)
    tl.sfx(t_ring, S("buzz.wav"), -6, dur=t_grab - t_ring)
    tl.sfx(t_cam + 0.25, S("rimshot.wav"), -2)

    # ================================================================ phone screen light (keys)
    prefs = bpy.context.preferences.edit
    interp, prefs.keyframe_new_interpolation_type = prefs.keyframe_new_interpolation_type, "CONSTANT"
    for mat, strength in ((screen_m, 2.5), (text_m, 6.0), (heart.data.materials[0], 6.0)):
        sock = mat.node_tree.nodes["Emission"].inputs["Strength"]
        for t, v in ((0.0, 0.0), (t_ring, strength), (t_lift + 0.4, 0.0)):
            sock.default_value = v
            sock.keyframe_insert("default_value", frame=int(round(t * fps)))
    glow = bpy.data.lights.new("phone_glow", "AREA")
    glow.size = 0.15
    glow.color = (0.4, 0.6, 1.0)
    glow_obj = bpy.data.objects.new("phone_glow", glow)
    bpy.context.scene.collection.objects.link(glow_obj)
    glow_obj.parent = body
    glow_obj.location = (0, 0, 0.05)
    glow_obj.rotation_euler = (math.pi, 0, 0)               # pointing up off the screen
    for t, v in ((0.0, 0.0), (t_ring, 3.0), (t_lift + 0.4, 0.0)):
        glow.energy = v
        glow.keyframe_insert("energy", frame=int(round(t * fps)))
    prefs.keyframe_new_interpolation_type = interp

    # ================================================================ cameras (9:16)
    bed_two = ((0.04, -1.6, 1.1), (0.04, 0.6, 0.8))
    tl.shot(0.0, "cam_open", (0.04, -1.85, 1.2), (0.04, 0.6, 0.78), lens=22, fstop=4.0,
            to_loc=(0.04, -1.6, 1.12), dur=2.9)
    tl.face_shot(l02.t - 0.15, "cam_y", Y, dist=1.35, yaw=-12, height=0.06, lens=28, push=0.18, dur=l02.dur)
    tl.face_shot(l03.t - 0.1, "cam_b", B, dist=1.2, yaw=12, height=0.1, lens=26, push=0.1, dur=l03.dur)
    tl.face_shot(l04.t - 0.1, "cam_y2", Y, dist=1.25, yaw=-6, height=0.05, lens=28, push=0.12, dur=l04.dur)
    tl.shot(l05.t - 0.1, "cam_two", *bed_two, lens=22, fstop=4.0, to_loc=(0.04, -1.35, 1.05), dur=l05.dur + 1.6)
    tl.shot(t_ring - 0.05, "cam_phone", (0.12, -0.05, 0.85), (PHONE[0], PHONE[1], PHONE[2] + 0.01), lens=40,
            fstop=2.8, to_loc=(0.1, 0.02, 0.8), dur=t_grab - t_ring - 0.3)
    tl.shot(t_grab - 0.35, "cam_two2", *bed_two, lens=22, fstop=4.0, dur=l06.end - t_grab)
    tl.face_shot(t_look - 0.05, "cam_look_y", Y, dist=1.3, yaw=-14, height=0.05, lens=28, push=0.08, dur=1.0)
    tl.face_shot(t_look + 0.95, "cam_look_b", B, dist=1.15, yaw=12, height=0.08, lens=26, push=0.1,
                 dur=l07.end - t_look - 0.95)
    tl.shot(t_cam - 0.05, "cam_end", (0.04, -1.65, 1.12), (0.04, 0.6, 0.8), lens=22, fstop=4.0,
            to_loc=(0.04, -1.5, 1.08), dur=LENGTH - t_cam)
