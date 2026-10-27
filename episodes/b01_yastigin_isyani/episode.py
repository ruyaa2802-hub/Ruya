"""İNSANLAR GİDİNCE – Bölüm 1: "Yastığın İsyanı" (≈38 s, 9:16)

Owner leaves. The pillow drops the act; the blanket, thrown on the floor
again, thinks he has it easy – until he tells her about his night. She hops
up beside him, he admits what really got to him, and she asks the one
question nobody asks a pillow.

Dialogue (audio/paced/*.wav; voices: ElevenLabs eleven_v4 – Yastık = "Orhan",
Battaniye = "Gözde"):
  L01 YASTIK      (fısıltı) Gittiler mi?
  L01b BATTANİYE  (fısıltı, gülümseyerek) Gittiler.
  L01c YASTIK     Oh be…
  L02 BATTANİYE   Sen niye yoruldun? Bütün gece yatan SENSİN!
  L03 YASTIK      Yatmak mı? Ben mesaideydim! Patronu, eski sevgilisi, kredi kartı borcu… hepsini dinledim.
  (Battaniye sözsüz zıplayıp yatağa, yastığın yanına çıkar)
  L08 YASTIK      Dün gece yüzünü bana gömüp ağladı. "Kimse beni anlamıyor" dedi.
  L09 BATTANİYE   Ayy… kıyamam.
  L10 YASTIK      BEN SENİ SEKİZ SAATTİR DİNLİYORUM!
  L11 BATTANİYE   Seni kim dinliyor peki?
  L12 YASTIK      (iç çeker) Kimse… Ama akşam başını bana koyunca… her şeye değiyor.
  L14 YASTIK      Dağınıklar, söylenirler, teşekkür bile etmezler…
  L15 BATTANİYE   …ama bizimkiler.
  (kapıda anahtar sesi)
  L16 BATTANİYE   (fısıltı) Geliyor!   — ikisi de anında "eşya" olur
  Recorded but cut for length (kept in LINES for subtitles if they come back):
  L04–L06 (the blanket's floor/"yo-yo" complaint), L07 "Beni de ters çeviriyor, serin tarafı diye…",
  L13 BATTANİYE "Beni yere atıyor ama… üşüyünce ilk beni arıyor."
"""
import math
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CAST = ("yastik", "battaniye")
PACING = {"L01c_yastik": 0.55}         # max pause per line for tools/prep_lines.py
TITLE = "İNSANLAR GİDİNCE"
LINES = {                               # subtitle text (episode.srt) – the audio is the source of truth
    "L01_yastik": "Gittiler mi?",
    "L01b_battaniye": "Gittiler.",
    "L01c_yastik": "Oh be…",
    "L02_battaniye": "Sen niye yoruldun? Bütün gece yatan SENSİN!",
    "L03_yastik": "Yatmak mı? Ben mesaideydim! Patronu, eski sevgilisi, kredi kartı borcu… hepsini dinledim.",
    "L04_battaniye": "Ben de dinlerdim… beni yere atmasa! Gece üç kere attı. ÜÇ!",
    "L05_yastik": "Terlemiştir.",
    "L06_battaniye": "Sonra üşüdü, geri çekti… AYAĞIYLA! Ben battaniye miyim, yo-yo mu?!",
    "L08_yastik": "Dün gece yüzünü bana gömüp ağladı. “Kimse beni anlamıyor” dedi.",
    "L09_battaniye": "Ayy… kıyamam.",
    "L10_yastik": "BEN SENİ SEKİZ SAATTİR DİNLİYORUM!",
    "L11_battaniye": "Seni kim dinliyor peki?",
    "L12_yastik": "Kimse…",
    "L12b_yastik": "Ama akşam başını bana koyunca… her şeye değiyor.",
    "L13_battaniye": "Beni yere atıyor ama… üşüyünce ilk beni arıyor.",
    "L14_yastik": "Dağınıklar, söylenirler, teşekkür bile etmezler…",
    "L15_battaniye": "…ama bizimkiler.",
    "L16_battaniye": "Geliyor!",
}
DOOR = (2.8, -2.4, 1.0)                # off-screen right: where the owner left
# blocking: the pillow sits on the left half of the bed so the blanket can land beside him
HOME = {"yastik": dict(loc=(-0.3, 0.86, 0.538), rot=(math.radians(-13), 0, 0))}
BED_SPOT = (-0.8, 1.04, 0.545)         # blanket offset from its floor mark to the right half of the bed
BED_TURN = -0.8                        # on the bed she faces the foot of the bed, a little toward him


def _arc(t, t0, dur, rise, height):
    """Jump arc that ends `rise` higher (floor -> bed), stretching in flight."""
    k = min(max((t - t0) / dur, 0.0), 1.0)
    return {"pos_z": rise * k + height * math.sin(k * math.pi), "squash": 0.2 * math.sin(k * math.pi)}


def build(tl, ep):
    A = lambda lid: os.path.join(ep, "audio", "paced", lid + ".wav")
    S = lambda f: os.path.join(ROOT, "assets", "sfx", f)
    Y, B = "yastik", "battaniye"

    # ---------------------------------------------------------------- 1. the owner leaves: "Gittiler mi?"
    tl.eyes_closed(Y, 0.0, 0.7)
    tl.expr(B, 0.0, "neutral", 0.01, m_frown=0.15)
    tl.sfx(0.0, S("keys.wav"), -4)
    tl.sfx(0.3, S("door_slam.wav"), -1)
    tl.pulse(Y, 0.38, 0.3, squash=-0.05)
    tl.pulse(B, 0.38, 0.3, squash=-0.06)
    tl.set(Y, 0.65, 0.1, lid_u_L=0.95, lid_l_L=0.4)          # one eye peeks first
    tl.look(Y, 0.75, DOOR, 0.12, head=0.2)
    tl.expr(Y, 0.85, "neutral", 0.25, brow_up=0.35, lid_u=-0.15)

    l01 = tl.say(Y, 0.85, A("L01_yastik"), intensity=0.8, bob=0.5)      # whispered
    tl.set(Y, 0.95, 0.4, lean_f=0.06)
    tl.look(Y, l01.find("mi"), DOOR, 0.1, head=0.15, up=0.05)

    # the blanket peeks too and whispers back, smiling: "Gittiler."
    tl.eyes_closed(B, 0.0, l01.end - 0.3)
    tl.set(B, l01.end - 0.35, 0.1, lid_u_R=0.95, lid_l_R=0.4)
    tl.look(B, l01.end - 0.3, Y, 0.25, head=0.4)
    tl.set(B, l01.end + 0.05, 0.15, lid_u_R=0.0, lid_l_R=0.0)
    tl.expr(B, l01.end - 0.2, "smug", 0.3, lid_u=0.15)
    l01b = tl.say(B, l01.end + 0.12, A("L01b_battaniye"), intensity=0.8, bob=0.5)
    tl.set(Y, l01.end, 0.15, lid_u_L=0.0, lid_l_L=0.0)
    tl.look(Y, l01b.t - 0.1, B, 0.25, head=0.35)

    # both drop the act: "Oh be…"
    l01c = tl.say(Y, l01b.end + 0.12, A("L01c_yastik"), bob=0.6)
    oh = l01c.find("oh")                                           # deflate, corners flop
    tl.expr(Y, oh - 0.1, "relief", 0.35)
    tl.set(Y, oh, 0.7, "out", squash=-0.08, arm_L_raise=-0.3, arm_R_raise=-0.3, arm_L_fold=0.15, arm_R_fold=0.15)
    tl.set(Y, oh, 0.7, "out", nod=-0.14, lid_u=0.4)
    tl.look_cam(Y, oh, 0.4)
    tl.sfx(oh + 0.05, S("poof.wav"), -10)
    tl.expr(B, oh, "relief", 0.4)
    tl.set(B, oh, 0.6, "out", squash=-0.06)

    # ---------------------------------------------------------------- 2. that sigh was a bit much
    t = l01c.end + 0.02
    tl.expr(B, t - 0.1, "offended", 0.25)
    tl.look(B, t, Y, 0.3, head=0.5)
    tl.hop(B, t, 0.03, 0.3, 0.12)
    tl.set(B, t, 0.3, squash=0.0)
    tl.sfx(t, S("rustle.wav"), -8)
    l02 = tl.say(B, t + 0.15, A("L02_battaniye"))
    tl.set(B, l02.t, 0.3, lean_f=-0.1)
    tl.set(B, l02.find("bütün") - 0.1, 0.25, "back", arm_R_raise=1.3, arm_R_curl=0.5)       # points up at him
    tl.expr(B, l02.find("bütün"), "annoyed", 0.2, brow_up=0.3)
    tl.set(B, l02.find("sensin"), 0.15, "back", squash=0.08, lean_f=-0.16)
    tl.set(B, l02.end, 0.4, squash=0.0, arm_R_raise=0.2, arm_R_curl=0.0)
    tl.look(Y, l02.t + 0.3, B, 0.35, head=0.35)
    tl.set(Y, l02.t + 0.3, 0.4, squash=0.0, arm_L_raise=0.0, arm_R_raise=0.0, arm_L_fold=0.0, arm_R_fold=0.0,
           nod=0.0)

    # ---------------------------------------------------------------- 3. the pillow's shift
    l03 = tl.say(Y, l02.end + 0.12, A("L03_yastik"))
    tl.expr(Y, l03.t, "sarcastic", 0.25)
    tl.set(Y, l03.find("ben"), 0.2, lean_f=0.08)
    tl.expr(Y, l03.find("patron") - 0.1, "deadpan", 0.25, brow_up=0.4)
    for i, w in enumerate(("patron", "sevgili", "kredi")):      # counts the troubles on its corner
        tl.set(Y, l03.find(w) - 0.05, 0.12, "back", arm_R_raise=0.5 + 0.2 * i, arm_R_fold=0.3)
        tl.set(Y, l03.find(w) + 0.25, 0.15, arm_R_raise=0.25 + 0.2 * i)
    tl.look(Y, l03.find("patron"), (0.3, 0.2, 1.6), 0.3, head=0.2)    # eyes roll up remembering
    tl.expr(Y, l03.find("hepsi") - 0.1, "tired", 0.4)
    tl.look(Y, l03.find("hepsi"), B, 0.3, head=0.35)
    tl.set(Y, l03.find("hepsi"), 0.6, "out", arm_R_raise=-0.2, arm_R_fold=0.0, squash=-0.05, lean_f=0.0)

    # ---------------------------------------------------------------- 4. no words: she hops up to sit with him
    up = l03.end + 0.15
    tl.expr(B, up - 0.3, "touched", 0.35, m_smile=0.1)                  # his list softened her
    tl.set(B, up - 0.12, 0.12, squash=-0.12)
    tl.set(B, up, 0.55, "inout", pos_x=BED_SPOT[0], pos_y=BED_SPOT[1])
    tl.set(B, up, 0.55, "linear", turn=BED_TURN)
    tl.layer(B, lambda tt: _arc(tt, up, 0.55, BED_SPOT[2], 0.45), up, 1e9)
    tl.set(B, up, 0.4, arm_L_raise=1.4, arm_R_raise=1.4, arm_L_curl=0.6, arm_R_curl=0.6)
    tl.sfx(up, S("whoosh.wav"), -6)
    tl.sfx(up + 0.55, S("poof.wav"), -6)
    tl.set(B, up + 0.55, 0.3, arm_L_raise=0.4, arm_R_raise=0.4, arm_L_curl=0.0, arm_R_curl=0.0)
    tl.look(B, up + 0.6, Y, 0.25, head=0.25)
    tl.look(Y, up + 0.2, B, 0.3, head=0.45)

    # ---------------------------------------------------------------- 5. what really happened last night
    l08 = tl.say(Y, up + 1.0, A("L08_yastik"), intensity=0.9, bob=0.5)
    tl.expr(Y, l08.t - 0.2, "sad", 0.5)
    tl.look(Y, l08.t - 0.2, (0.0, -0.6, 0.55), 0.5, head=0.3)        # looks down at the dent in the bed
    tl.set(Y, l08.t, 0.8, nod=0.12, squash=-0.03)
    tl.look(Y, l08.find("kimse") - 0.1, B, 0.3, head=0.3)
    tl.expr(B, l08.t + 0.4, "touched", 0.6)

    l09 = tl.say(B, l08.end + 0.1, A("L09_battaniye"), bob=0.6)
    tl.set(B, l09.t, 0.5, arm_L_raise=0.9, arm_L_fold=1.2, arm_L_curl=0.8, tilt=-0.18)  # hand on heart

    # ---------------------------------------------------------------- 6. the outburst
    l10 = tl.say(Y, l09.end + 0.05, A("L10_yastik"), intensity=1.15, bob=1.6)
    tl.expr(Y, l10.t - 0.08, "shout", 0.1)
    tl.set(Y, l10.t - 0.12, 0.12, "back", lean_f=0.14, arm_L_raise=0.9, arm_R_raise=0.9, nod=0.0)
    tl.shake(Y, l10.t, l10.dur, "lean_s", 0.04, 9, decay=False)
    tl.expr(B, l10.t + 0.05, "surprised", 0.1)
    tl.set(B, l10.t + 0.05, 0.15, "back", lean_f=-0.18, squash=0.1, arm_L_raise=1.2, arm_L_fold=0.0)
    tl.set(Y, l10.end, 0.35, lean_f=0.0, arm_L_raise=0.0, arm_R_raise=0.0)
    tl.expr(Y, l10.end, "deadpan", 0.3, brow_ang=0.5)
    tl.set(B, l10.end + 0.1, 0.4, lean_f=0.0, squash=0.0, arm_L_raise=0.3)

    # ---------------------------------------------------------------- 7. the question nobody asks a pillow
    l11 = tl.say(B, l10.end + 0.4, A("L11_battaniye"), intensity=0.8, bob=0.4)
    tl.expr(B, l11.t - 0.2, "touched", 0.4, m_smile=0.15)
    tl.set(B, l11.t, 0.6, tilt=-0.15, lean_f=0.06)
    tl.expr(Y, l11.find("dinliyor"), "sad", 0.5, lid_u=-0.1, brow_up=0.9)              # it lands
    tl.look(Y, l11.find("dinliyor"), B, 0.2, head=0.4)
    tl.shake(Y, l11.end + 0.05, 0.5, "m_frown", 0.25, 11, decay=False)                  # lip wobble
    tl.sfx(l11.end + 0.2, S("sniff.wav"), -8)

    # ---------------------------------------------------------------- 8. ...and yet, it's worth it
    l12 = tl.say(Y, l11.end + 0.4, A("L12_yastik"), intensity=0.8, bob=0.3)            # "Kimse…"
    tl.look(Y, l12.t, (-0.3, -0.3, 0.6), 0.5, head=0.3)                                 # looks down
    tl.set(Y, l12.t, 0.6, nod=0.12, squash=-0.04)
    l12b = tl.say(Y, l12.end + 0.2, A("L12b_yastik"), bob=0.6)                         # "Ama akşam…"
    tl.expr(Y, l12b.t, "wistful", 0.6)
    tl.set(Y, l12b.t, 0.6, nod=0.0, squash=0.0)
    tl.look(Y, l12b.find("akşam"), (-0.3, 0.2, 1.4), 0.5, head=0.25)                   # remembering
    tl.look(Y, l12b.find("her"), B, 0.4, head=0.35)
    tl.expr(Y, l12b.find("değiyor") - 0.2, "touched", 0.5, m_smile=0.5)
    tl.expr(B, l12b.find("koyunca"), "touched", 0.6)
    tl.expr(B, l12b.find("değiyor"), "fond", 0.4)                                       # reaction shot
    tl.set(B, l12b.find("değiyor"), 0.5, arm_L_raise=0.9, arm_L_fold=1.2, arm_L_curl=0.8)  # hand on heart

    l14 = tl.say(Y, l12b.end + 0.35, A("L14_yastik"), bob=0.8)                        # "Dağınıklar, söylenirler…"
    tl.expr(Y, l14.t, "fond", 0.3, lid_u=0.3)
    for i, w in enumerate(("dağınık", "söylen", "teşekkür")):                           # counts on his corner again
        tl.set(Y, l14.find(w) - 0.05, 0.12, "back", arm_R_raise=0.5 + 0.2 * i, arm_R_fold=0.3)
        tl.set(Y, l14.find(w) + 0.25, 0.15, arm_R_raise=0.25 + 0.2 * i)
    tl.look(Y, l14.find("dağınık"), (-0.2, 0.3, 1.5), 0.3, head=0.2)                    # fond eye-roll
    tl.set(Y, l14.end - 0.2, 0.5, arm_R_raise=0.0, arm_R_fold=0.0)
    tl.set(B, l14.t, 0.4, arm_L_raise=0.3, arm_L_fold=0.2, arm_L_curl=0.0)
    tl.expr(B, l14.find("teşekkür"), "smug", 0.3)

    l15 = tl.say(B, l14.end + 0.2, A("L15_battaniye"), intensity=0.85, bob=0.5)       # "…ama bizimkiler."
    tl.move(B, l15.t - 0.1, 0.45, dx=-0.12, dy=-0.02, hops=1, height=0.03, turn=BED_TURN - 0.25)
    tl.set(B, l15.t + 0.15, 0.45, arm_L_raise=1.7, arm_R_raise=0.9, arm_L_fold=1.1, arm_R_fold=1.2, arm_L_curl=0.9,
           arm_R_curl=0.7, lean_f=0.25, tilt=0.15)                                      # leans on him
    tl.expr(B, l15.t, "happy", 0.4, squint=0.6)
    tl.sfx(l15.t, S("rustle_long.wav"), -8)
    tl.look(Y, l15.t, B, 0.3, head=0.4)
    tl.expr(Y, l15.find("bizim"), "happy", 0.4, squint=0.5)
    tl.set(Y, l15.find("bizim"), 0.5, tilt=0.12, squash=-0.03)

    # ---------------------------------------------------------------- 9. ...and they're back
    keys = l15.end + 0.35
    tl.sfx(keys, S("keys.wav"), -2)
    for who in (Y, B):
        tl.expr(who, keys + 0.15, "surprised", 0.12)
        tl.look(who, keys + 0.15, DOOR, 0.12, head=0.3)
    tl.set(B, keys + 0.15, 0.2, arm_L_raise=0.3, arm_R_raise=0.3, arm_L_fold=0.0, arm_R_fold=0.0, arm_L_curl=0.0,
           arm_R_curl=0.0, lean_f=0.0, tilt=0.0)                                         # lets go of him
    l16 = tl.say(B, keys + 0.45, A("L16_battaniye"), intensity=0.8, bob=0.3)           # "Geliyor!"
    flop = l16.end + 0.05                                                               # back to being objects
    for who in (Y, B):
        tl.expr(who, flop, "neutral", 0.08)
        tl.eyes_closed(who, flop, flop + 5.0)
        tl.set(who, flop, 0.1, gaze_x=0.0, gaze_y=0.0, twist=0.0, tilt=0.0, nod=0.0, lean_f=0.0, arm_L_raise=0.0,
               arm_R_raise=0.0, arm_L_fold=0.0, arm_R_fold=0.0)
        tl.pulse(who, flop, 0.35, squash=-0.08)
    tl.sfx(flop, S("poof.wav"), -8)
    tl.set(Y, flop + 0.7, 0.4, m_smile=0.4)                                             # can't help a little smile
    tl.duration = flop + 1.9

    # ---------------------------------------------------------------- cameras (9:16)
    # (angles checked against the 9:16 horizontal field of view: 24 mm ~ 31 deg, 20 mm ~ 37 deg)
    wide = ((2.3, -2.9, 1.25), (0.68, 0.2, 0.55))
    two = ((2.05, -2.9, 1.2), (0.5, 0.2, 0.5))                # blanket in front on the floor, pillow up on the bed
    bed_two = ((0.04, -1.6, 1.1), (0.04, 0.6, 0.8))           # from the foot of the bed: side by side
    tl.face_shot(0.0, "cam_cu_y", Y, dist=1.45, yaw=-12, height=0.1, lens=28, push=0.2, dur=l01.end)
    tl.shot(l01.end - 0.05, "cam_two", *two, lens=30, fstop=4.0, focus=B)                    # "Gittiler."
    tl.face_shot(l01c.t - 0.05, "cam_cu_y0", Y, dist=1.3, yaw=-10, height=0.08, lens=28)    # "Oh be…"
    tl.shot(l02.t - 0.1, "cam_two", *two, lens=30, fstop=4.0, to_loc=(1.85, -2.6, 1.12), dur=l02.dur + 0.4,
            focus=B)
    tl.face_shot(l03.t - 0.05, "cam_cu_y", Y, dist=1.45, yaw=-15, height=0.06, lens=28, push=0.12, dur=l03.dur)
    tl.shot(up - 0.2, "cam_wide", *wide, lens=24, fstop=4.5, to_loc=(2.2, -2.75, 1.28), dur=1.0, focus=B)
    tl.face_shot(l08.t - 0.3, "cam_cu_y", Y, dist=1.3, yaw=-14, height=0.06, lens=28, push=0.18, dur=l08.dur)
    tl.shot(l09.t - 0.05, "cam_bed_two", *bed_two, lens=22, fstop=4.0, focus=B)
    tl.face_shot(l10.t - 0.04, "cam_shout", Y, dist=0.8, yaw=-8, height=0.02, lens=30, shake=0.006)
    tl.shot(l10.end + 0.3, "cam_bed_two", *bed_two, lens=22, fstop=4.0, focus=Y)
    react = l12b.find("her") - 0.1                                     # "…her şeye değiyor" plays on her face
    tl.face_shot(l12.t - 0.1, "cam_cu_y5", Y, dist=1.35, yaw=-12, height=0.06, lens=28, push=0.15,
                 dur=react - l12.t)
    tl.face_shot(react, "cam_cu_b2", B, dist=1.25, yaw=10, height=0.12, lens=26, push=0.08, dur=l14.t - react)
    tl.face_shot(l14.t - 0.05, "cam_cu_y6", Y, dist=1.45, yaw=-15, height=0.06, lens=28)
    tl.shot(l15.t - 0.1, "cam_bed_two", *bed_two, lens=22, fstop=4.0, to_loc=(0.04, -1.25, 1.04),
            dur=tl.duration - l15.t, focus=Y)
