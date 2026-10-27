"""İNSANLAR GİDİNCE – Bölüm 2: "Soğudum" (≈35 s, 9:16)

The owner leaves – again without finishing the coffee. The mug on the
nightstand has been waiting since seven in the morning, reheated three times
and forgotten three times. The pillow, everyone's tired therapist, listens.
Then the mug lets slip where yesterday's coffee went: into the plant, which
has not slept for three days.

Dialogue (audio/paced/*.wav; voices: ElevenLabs eleven_v4 – Yastık = "Orhan",
Kupa = "Ali – Mad Man"):
  L01 YASTIK  (fısıltı) Gittiler mi?
  L02 KUPA    (titreyerek) G-gittiler… beni yine unuttular.
  L03 YASTIK  Yine mi soğudun?
  L04 KUPA    Sabah yedide doldurdu. "Bir yudum alıp çıkıyorum" dedi. Bir yudum! Hâlâ bekliyorum!
  L05 YASTIK  Mikrodalgaya koymadı mı?
  L06 KUPA    Üç kere! Isıttı, unuttu. Isıttı, unuttu. Isıttı… UNUTTU!   (her "ısıttı"da mutfaktan ding)
  L07 YASTIK  Kahve değil, çorba olmuşsun.
  L08 KUPA    Arkamda ne yazıyor? "Önce kahve!" Önce! Sonra değil!     (dönüp sırtındaki yazıyı gösterir)
  L09 KUPA    Ama yine de… dolapta on kupa var. Her sabah ilk beni seçiyor.
  L10 YASTIK  En azından seni dökmüyor.
  L11 KUPA    (fısıltı) Dökmüyor mu? Dünkü kahvemi saksıya döktü.
  (köşedeki saksı: yapraklar kafeinden zangır zangır titriyor)
  L12 YASTIK  O yüzden üç gündür uyumuyor.
  (kapıda anahtar: ikisi anında "eşya" olur – saksı titremeye devam eder)
"""
import math
import os
import random

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CAST = ("yastik", "kupa")
TITLE = "İNSANLAR GİDİNCE"
PACING = {"L06_kupa": 0.5, "L09_kupa": 0.6, "L11_kupa": 0.5}
LINES = {
    "L01_yastik": "Gittiler mi?",
    "L02_kupa": "G-gittiler… beni yine unuttular.",
    "L03_yastik": "Yine mi soğudun?",
    "L04_kupa": "Sabah yedide doldurdu. “Bir yudum alıp çıkıyorum” dedi. Bir yudum! Hâlâ bekliyorum!",
    "L05_yastik": "Mikrodalgaya koymadı mı?",
    "L06_kupa": "Üç kere! Isıttı, unuttu. Isıttı, unuttu. Isıttı… UNUTTU!",
    "L07_yastik": "Kahve değil, çorba olmuşsun.",
    "L08_kupa": "Arkamda ne yazıyor? “Önce kahve!” Önce! Sonra değil!",
    "L09_kupa": "Ama yine de… dolapta on kupa var. Her sabah ilk beni seçiyor.",
    "L10_yastik": "En azından seni dökmüyor.",
    "L11_kupa": "Dökmüyor mu? Dünkü kahvemi saksıya döktü.",
    "L12_yastik": "O yüzden üç gündür uyumuyor.",
}
DOOR = (2.8, -2.4, 1.0)                 # off-screen right: where the owner left
KITCHEN = (2.6, -1.2, 1.0)              # the microwave dings from there
# blocking: the pillow on the right half of the bed, turned toward the nightstand; the mug at the bed side
HOME = {"yastik": dict(loc=(0.42, 0.86, 0.538), rot=(math.radians(-13), 0, math.radians(16))),
        "kupa": dict(loc=(1.0, 0.72, 0.55), rot=(0, 0, math.radians(-40)))}


def _jitter(k, t0, amp=0.06, ramp=0.2):
    """Per-frame random shiver for leaf k from t0 on (24 fps: every frame is a new twitch)."""
    def fn(t):
        if t < t0:
            return {}
        r = random.Random(k * 7919 + int(t * 24))
        a = amp * min(1.0, (t - t0) / ramp)
        return {"rotation_euler": (r.uniform(-a, a), r.uniform(-a, a), r.uniform(-0.6 * a, 0.6 * a))}
    return fn


def build(tl, ep):
    import bpy
    from mathutils import Vector

    from ig import render
    from ig.sets import bedroom

    A = lambda lid: os.path.join(ep, "audio", "paced", lid + ".wav")
    S = lambda f: os.path.join(ROOT, "assets", "sfx", f)
    Y, K = "yastik", "kupa"
    PLANT = (*bedroom.PLANT, 0.72)

    # ---------------------------------------------------------------- 1. the door: "Gittiler mi?"
    tl.eyes_closed(Y, 0.0, 0.7)
    tl.sfx(0.0, S("keys.wav"), -4)
    tl.sfx(0.3, S("door_slam.wav"), -1)
    tl.pulse(Y, 0.38, 0.3, squash=-0.05)
    tl.pulse(K, 0.38, 0.3, squash=-0.06)
    tl.set(Y, 0.65, 0.1, lid_u_L=0.95, lid_l_L=0.4)                 # one eye peeks first
    tl.look(Y, 0.75, DOOR, 0.12, head=0.2)
    tl.expr(Y, 0.85, "neutral", 0.25, brow_up=0.35, lid_u=-0.15)
    l01 = tl.say(Y, 0.85, A("L01_yastik"), intensity=0.8, bob=0.5)  # whispered
    tl.set(Y, l01.end, 0.15, lid_u_L=0.0, lid_l_L=0.0)
    tl.look(Y, l01.end + 0.05, K, 0.3, head=0.4)

    # ---------------------------------------------------------------- 2. the mug is freezing
    wake = l01.end + 0.05
    tl.eyes_closed(K, 0.0, wake)
    tl.expr(K, wake, "sad", 0.2, lid_u=-0.15, brow_up=0.8)
    tl.sfx(wake + 0.05, S("chatter.wav"), -5)
    tl.shake(K, wake, 2.2, "lean_s", 0.03, 11, decay=True)                # shivering
    tl.shake(K, wake, 2.2, "tilt", 0.02, 9, decay=True)
    tl.set(K, wake, 0.3, arm_R_fold=0.5, arm_R_raise=-0.1)              # hugs itself with its handle
    l02 = tl.say(K, wake + 0.15, A("L02_kupa"), bob=0.5)
    tl.look(K, l02.find("beni"), Y, 0.3, head=0.45)
    tl.expr(K, l02.find("beni"), "sad", 0.3, brow_up=0.9)
    tl.expr(Y, l02.t + 0.4, "tired", 0.4)

    # ---------------------------------------------------------------- 3. "again?"
    l03 = tl.say(Y, l02.end + 0.15, A("L03_yastik"), bob=0.5)
    tl.set(Y, l03.t, 0.4, nod=0.06)
    tl.expr(K, l03.find("soğu"), "offended", 0.25)
    tl.set(K, l03.find("soğu"), 0.3, arm_R_fold=0.0, arm_R_raise=0.2)

    # ---------------------------------------------------------------- 4. since seven in the morning
    l04 = tl.say(K, l03.end + 0.12, A("L04_kupa"))
    tl.expr(K, l04.t, "annoyed", 0.25, brow_up=0.3)
    tl.set(K, l04.find("yedi") - 0.1, 0.25, "back", arm_R_raise=1.1)       # points: seven!
    tl.set(K, l04.find("doldur"), 0.3, arm_R_raise=0.5)
    q = l04.find("bir")                                                      # imitates the owner
    tl.expr(K, q - 0.1, "sarcastic", 0.2)
    tl.set(K, q - 0.1, 0.25, tilt=0.16, lean_s=0.05)
    tl.look(K, q, (1.0, 0.4, 1.6), 0.25, head=0.3)                          # breezy, eyes up
    tl.shake(K, q, 1.0, "arm_R_raise", 0.25, 3, decay=False)               # waves the handle
    b2 = l04.find("bir", 1)                                                  # "Bir yudum!"
    tl.expr(K, b2 - 0.1, "angry", 0.15, brow_up=0.3)
    tl.set(K, b2 - 0.1, 0.2, tilt=0.0, lean_s=0.0, arm_R_raise=1.3)
    tl.look(K, b2, Y, 0.2, head=0.4)
    tl.hop(K, b2, 0.035, 0.32, 0.16)
    tl.sfx(b2 + 0.32, S("clink.wav"), -8)
    h = l04.find("hâlâ")                                                     # whines, droops
    tl.expr(K, h - 0.1, "sad", 0.35, brow_up=0.7)
    tl.set(K, h, 0.6, "out", squash=-0.06, nod=0.12, arm_R_raise=-0.15)
    tl.look(Y, l04.t, K, 0.3, head=0.4)

    # ---------------------------------------------------------------- 5. "the microwave?"
    l05 = tl.say(Y, l04.end + 0.15, A("L05_yastik"), bob=0.4)
    tl.expr(Y, l05.t, "deadpan", 0.3, brow_up_R=0.4)

    # ---------------------------------------------------------------- 6. three times
    l06 = tl.say(K, l05.end + 0.1, A("L06_kupa"))
    tl.expr(K, l06.t - 0.05, "angry", 0.15)
    tl.set(K, l06.t - 0.05, 0.2, "back", squash=0.0, nod=0.0, arm_R_raise=1.2)    # "Üç kere!"
    tl.hop(K, l06.t, 0.03, 0.3, 0.14)
    tl.sfx(l06.t + 0.3, S("clink.wav"), -10)
    for n in range(3):
        hot = l06.find("ısıttı", n)
        tl.sfx(l06.find("ısıttı", n, edge="end") + 0.04, S("ding.wav"), -6 + 2 * n)
        tl.expr(K, hot - 0.05, "happy", 0.2, squint=0.2)                     # hope: warm again!
        tl.set(K, hot - 0.05, 0.25, lean_f=-0.05, squash=0.04, arm_R_raise=0.8 + 0.2 * n)
        tl.look(K, hot, KITCHEN, 0.2, head=0.35)
        if n < 2:
            cold = l06.find("unuttu", n)                                     # ...and forgotten
            tl.expr(K, cold - 0.05, "sad", 0.25)
            tl.set(K, cold - 0.05, 0.4, "out", lean_f=0.0, squash=-0.05, arm_R_raise=0.0)
            tl.look(K, cold, Y, 0.25, head=0.4)
    yell = l06.find("unuttu", 2)                                             # "UNUTTU!"
    tl.expr(K, yell - 0.08, "shout", 0.1)
    tl.set(K, yell - 0.1, 0.12, "back", lean_f=0.1, squash=0.06, arm_R_raise=1.2)
    tl.look(K, yell, Y, 0.12, head=0.4)
    tl.shake(K, yell, 0.7, "lean_s", 0.05, 8)
    tl.expr(Y, yell, "surprised", 0.1)
    tl.set(Y, yell, 0.12, "back", lean_f=-0.08, squash=0.05)
    tl.set(K, l06.end, 0.4, lean_f=0.0, squash=0.0, arm_R_raise=0.2)
    tl.set(Y, l06.end + 0.1, 0.4, lean_f=0.0, squash=0.0)

    # ---------------------------------------------------------------- 7. "soup, not coffee"
    l07 = tl.say(Y, l06.end + 0.3, A("L07_yastik"), bob=0.5)
    tl.expr(Y, l07.t - 0.1, "deadpan", 0.3, lid_u=0.45)
    tl.expr(K, l07.find("çorba"), "offended", 0.2, brow_up=1.0)
    tl.set(K, l07.find("çorba"), 0.2, "back", squash=0.05, lean_f=-0.06)

    # ---------------------------------------------------------------- 8. reads its own back
    l08 = tl.say(K, l07.end + 0.12, A("L08_kupa"))
    tl.expr(K, l08.t, "angry", 0.2, brow_up=0.4)
    tl.set(K, l08.t, 0.2, squash=0.0, lean_f=0.0)
    spin = l08.find("yazıyor") + 0.05
    tl.set(K, spin, 0.45, "inout", turn=math.pi)                            # shows "ÖNCE KAHVE"
    tl.sfx(spin, S("whoosh.wav"), -12)
    tl.set(K, spin, 0.3, arm_R_raise=0.9)
    back = l08.find("önce", 1) - 0.12                                        # "Önce!" – spins back
    tl.set(K, back, 0.4, "inout", turn=0.0)
    tl.sfx(back, S("whoosh.wav"), -14)
    tl.look(K, back + 0.3, Y, 0.2, head=0.4)
    tl.hop(K, back + 0.42, 0.025, 0.28, 0.12)
    tl.sfx(back + 0.7, S("clink.wav"), -12)
    tl.expr(K, l08.find("sonra") - 0.1, "angry", 0.15, brow_up=0.6)
    tl.shake(K, l08.find("sonra"), 0.8, "arm_R_raise", 0.3, 4, decay=False)  # wags the handle
    tl.look(Y, spin + 0.2, K, 0.3, head=0.3)

    # ---------------------------------------------------------------- 9. ...and yet
    l09 = tl.say(K, l08.end + 0.35, A("L09_kupa"), intensity=0.85, bob=0.6)
    tl.expr(K, l09.t - 0.2, "wistful", 0.5)
    tl.set(K, l09.t - 0.2, 0.5, arm_R_raise=0.0, squash=-0.02)
    tl.look(K, l09.find("dolap"), (0.6, 0.2, 1.5), 0.5, head=0.3)          # pictures the cupboard
    tl.expr(K, l09.find("her") - 0.1, "touched", 0.5, m_smile=0.45)
    tl.set(K, l09.find("her"), 0.5, arm_R_fold=0.6, arm_R_raise=0.3, tilt=-0.12)   # handle on heart
    tl.look(K, l09.find("ilk"), Y, 0.4, head=0.4)
    tl.expr(Y, l09.find("her"), "touched", 0.6, lid_u=0.25)

    # ---------------------------------------------------------------- 10. "at least he doesn't pour you out"
    l10 = tl.say(Y, l09.end + 0.3, A("L10_yastik"), bob=0.5)
    tl.expr(Y, l10.t, "fond", 0.3, lid_u=0.35)
    tl.set(K, l10.t, 0.4, arm_R_fold=0.0, arm_R_raise=0.1, tilt=0.0)

    # ---------------------------------------------------------------- 11. "...doesn't he?"
    tl.expr(K, l10.find("dök"), "surprised", 0.15, m_open=0.0)
    l11 = tl.say(K, l10.end + 0.3, A("L11_kupa"), intensity=0.85, bob=0.4)   # whispered
    tl.expr(K, l11.t, "sad", 0.2, lid_u=-0.3, brow_up=1.0)
    tl.set(K, l11.t, 0.3, lean_f=0.08, lean_s=-0.04)                        # leans in to tell him
    tl.look(K, l11.find("dünkü"), PLANT, 0.25, head=0.15)                   # a guilty glance
    tl.look(K, l11.find("kahve"), Y, 0.2, head=0.4)
    tl.look(K, l11.find("saksı"), PLANT, 0.45, head=0.45)
    tl.look(Y, l11.find("saksı"), PLANT, 0.5, head=0.5)
    tl.expr(Y, l11.find("saksı"), "surprised", 0.3, m_open=0.0)

    # ---------------------------------------------------------------- 12. the plant has not slept for three days
    plant_t = l11.end + 0.15
    leaves = [bpy.data.objects[f"plant_leaf_{k}"] for k in range(9)]
    for k, leaf in enumerate(leaves):
        tl.prop(leaf, _jitter(k, plant_t - 0.3))
    tl.sfx(plant_t - 0.3, S("jitter.wav"), -10)
    l12 = tl.say(Y, plant_t + 1.4, A("L12_yastik"), bob=0.3)
    tl.expr(Y, l12.t - 0.2, "deadpan", 0.3, lid_u=0.5)
    tl.expr(K, l12.t, "deadpan", 0.4, lid_u=0.2)
    tl.set(K, l12.t, 0.4, lean_f=0.0, lean_s=0.0)
    tl.look(K, l12.end + 0.2, Y, 0.35, head=0.4)                            # slow look at him

    # ---------------------------------------------------------------- 13. keys – back to being objects
    keys = l12.end + 0.75
    tl.sfx(keys, S("keys.wav"), -2)
    tl.sfx(keys + 0.4, S("jitter.wav"), -9)                                  # the plant can't stop
    for who in (Y, K):
        tl.expr(who, keys + 0.12, "surprised", 0.1)
        tl.look(who, keys + 0.12, DOOR, 0.12, head=0.3)
        flop = keys + 0.4
        tl.expr(who, flop, "neutral", 0.08)
        tl.eyes_closed(who, flop, flop + 5.0)
        tl.set(who, flop, 0.1, gaze_x=0.0, gaze_y=0.0, twist=0.0, tilt=0.0, nod=0.0, lean_f=0.0, lean_s=0.0,
               arm_R_raise=0.0, arm_R_fold=0.0, arm_L_raise=0.0, arm_L_fold=0.0)
        tl.pulse(who, flop, 0.3, squash=-0.06)
    tl.sfx(keys + 0.45, S("clink.wav"), -12)
    tl.duration = keys + 3.0

    # ---------------------------------------------------------------- cameras (9:16)
    kc = tl.chars[K]
    fy, fk = tl.face_pos(Y), tl.face_pos(K)
    two = ((1.05, -0.55, 0.9), tuple(fk * 0.55 + fy * 0.45 + Vector((0, 0, -0.06))))   # mug at the bed side
    front_loc, front_tgt = render.face_frame(kc, 0.55, 12, 0.03, look=(0, 0, -0.012))
    plant_loc, plant_tgt = (-0.72, 0.05, 1.02), (PLANT[0], PLANT[1], 0.7)
    tl.face_shot(0.0, "cam_cu_y", Y, dist=1.4, yaw=-14, height=0.08, lens=28, push=0.15, dur=l01.end)
    tl.face_shot(wake - 0.1, "cam_cu_k", K, dist=0.5, yaw=14, height=0.03, lens=40, look=(0, 0, -0.012),
                 push=0.12, dur=l02.end - wake)
    tl.shot(l03.t - 0.1, "cam_two", *two, lens=24, fstop=4.0, focus=Y)
    tl.face_shot(l04.t - 0.05, "cam_cu_k2", K, dist=0.55, yaw=16, height=0.04, lens=38, look=(0, 0, -0.012),
                 push=0.1, dur=l04.dur)
    tl.face_shot(l05.t - 0.05, "cam_cu_y2", Y, dist=1.3, yaw=-12, height=0.06, lens=30)
    tl.face_shot(l06.t - 0.05, "cam_cu_k3", K, dist=0.6, yaw=10, height=0.03, lens=36, look=(0, 0, -0.012),
                 push=0.18, dur=l06.dur)
    tl.face_shot(yell - 0.04, "cam_yell", K, dist=0.42, yaw=8, height=0.02, lens=40, look=(0, 0, -0.012),
                 shake=0.002)
    tl.shot(l07.t - 0.1, "cam_two", *two, lens=24, fstop=4.0, focus=Y)
    tl.shot(l08.t - 0.05, "cam_k_front", front_loc, front_tgt, lens=38, fstop=4.0)    # static: the spin reads
    tl.face_shot(l09.t - 0.2, "cam_cu_k4", K, dist=0.6, yaw=14, height=0.04, lens=38, look=(0, 0, -0.012),
                 push=0.22, dur=l09.dur + 0.2)
    tl.face_shot(l10.t - 0.05, "cam_cu_y3", Y, dist=1.3, yaw=-14, height=0.06, lens=30)
    tl.shot(l11.t - 0.1, "cam_two2", *two, lens=24, fstop=4.0,
            to_loc=tuple(Vector(two[0]).lerp(Vector(two[1]), 0.12)), dur=l11.dur, focus=K)
    tl.shot(plant_t, "cam_plant", plant_loc, plant_tgt, lens=24, fstop=4.0,
            to_loc=(-0.85, 0.3, 0.95), dur=1.5)
    tl.shot(l12.t - 0.25, "cam_two3", *two, lens=24, fstop=4.0, focus=Y)
    tl.shot(keys + 0.9, "cam_plant2", (-0.85, 0.3, 0.95), plant_tgt, lens=24, fstop=4.0,
            to_loc=(-0.95, 0.45, 0.92), dur=tl.duration - keys - 0.9)
