"""İNSANLAR GİDİNCE – Bölüm 1: "Yastığın İsyanı" (≈35 s, 9:16)

Owner leaves. The pillow drops the act; the blanket, thrown on the floor
again, has complaints of her own. The complaints escalate until the pillow
admits what really got to him last night – and the blanket asks the one
question nobody asks a pillow.

Dialogue (audio/paced/*.wav; voices: ElevenLabs eleven_v4 – Yastık = "Orhan",
Battaniye = "Gözde"):
  L01 YASTIK      Gitti mi? … Gitti. Oh be.
  L02 BATTANİYE   Sen niye yoruldun? Bütün gece yatan SENSİN!
  L03 YASTIK      Yatmak mı? Ben mesaideydim! Patronu, eski sevgilisi, kredi kartı borcu… hepsini dinledim.
  L04 BATTANİYE   Ben de dinlerdim… beni yere atmasa! Gece üç kere attı. ÜÇ!
  L05 YASTIK      Terlemiştir.
  L06 BATTANİYE   Sonra üşüdü, geri çekti… AYAĞIYLA! Ben battaniye miyim, yo-yo mu?!
  L08 YASTIK      Dün gece yüzünü bana gömüp ağladı. "Kimse beni anlamıyor" dedi.
  L09 BATTANİYE   Ayy… kıyamam.
  L10 YASTIK      BEN SENİ SEKİZ SAATTİR DİNLİYORUM!
  L11 BATTANİYE   Seni kim dinliyor peki?
  (L07 "Beni de ters çeviriyor, serin tarafı diye…" is recorded but cut for length.)
"""
import math
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CAST = ("yastik", "battaniye")
PACING = {"L01_yastik": 0.55}          # max pause per line for tools/prep_lines.py
TITLE = "İNSANLAR GİDİNCE"
LINES = {                               # subtitle text (episode.srt) – the audio is the source of truth
    "L01_yastik": "Gitti mi?… Gitti. Oh be.",
    "L02_battaniye": "Sen niye yoruldun? Bütün gece yatan SENSİN!",
    "L03_yastik": "Yatmak mı? Ben mesaideydim! Patronu, eski sevgilisi, kredi kartı borcu… hepsini dinledim.",
    "L04_battaniye": "Ben de dinlerdim… beni yere atmasa! Gece üç kere attı. ÜÇ!",
    "L05_yastik": "Terlemiştir.",
    "L06_battaniye": "Sonra üşüdü, geri çekti… AYAĞIYLA! Ben battaniye miyim, yo-yo mu?!",
    "L08_yastik": "Dün gece yüzünü bana gömüp ağladı. “Kimse beni anlamıyor” dedi.",
    "L09_battaniye": "Ayy… kıyamam.",
    "L10_yastik": "BEN SENİ SEKİZ SAATTİR DİNLİYORUM!",
    "L11_battaniye": "Seni kim dinliyor peki?",
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

    # ---------------------------------------------------------------- 1. the owner leaves
    tl.eyes_closed(Y, 0.0, 0.7)
    tl.eyes_closed(B, 0.0, 4.6)
    tl.expr(B, 0.0, "neutral", 0.01, m_frown=0.15)
    tl.sfx(0.0, S("keys.wav"), -4)
    tl.sfx(0.3, S("door_slam.wav"), -1)
    tl.pulse(Y, 0.38, 0.3, squash=-0.05)
    tl.pulse(B, 0.38, 0.3, squash=-0.06)
    tl.set(Y, 0.65, 0.1, lid_u_L=0.95, lid_l_L=0.4)          # one eye peeks first
    tl.look(Y, 0.75, DOOR, 0.12, head=0.2)
    tl.set(Y, 1.1, 0.15, lid_u_L=0.0, lid_l_L=0.0)
    tl.expr(Y, 0.85, "neutral", 0.25, brow_up=0.35, lid_u=-0.15)

    l01 = tl.say(Y, 0.85, A("L01_yastik"), intensity=0.85)
    tl.set(Y, 1.05, 0.4, lean_f=0.06)
    tl.look(Y, l01.find("mi"), DOOR, 0.1, head=0.15, up=0.05)
    tl.expr(Y, l01.find("gitti", 1) - 0.1, "relief", 0.35)
    tl.look(Y, l01.find("gitti", 1), (0.6, -1.5, 0.8), 0.3)
    tl.set(Y, l01.find("gitti", 1), 0.4, lean_f=0.0)
    oh = l01.find("oh")                                            # "Oh be": deflate, corners flop
    tl.set(Y, oh, 0.7, "out", squash=-0.08, arm_L_raise=-0.3, arm_R_raise=-0.3, arm_L_fold=0.15, arm_R_fold=0.15)
    tl.set(Y, oh, 0.7, "out", nod=-0.14, lid_u=0.4)
    tl.sfx(oh + 0.05, S("poof.wav"), -10)

    # ---------------------------------------------------------------- 2. the blanket objects
    t = l01.end + 0.02
    tl.set(B, t - 0.15, 0.12, blink=0.0)
    tl.expr(B, t - 0.1, "offended", 0.25)
    tl.look(B, t, Y, 0.3, head=0.5)
    tl.hop(B, t, 0.03, 0.3, 0.12)
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

    # ---------------------------------------------------------------- 4. the blanket's drama
    l04 = tl.say(B, l03.end + 0.1, A("L04_battaniye"))
    tl.expr(B, l04.t, "dramatic", 0.3)
    tl.set(B, l04.t, 0.5, arm_R_raise=0.0, lean_f=0.0)
    tl.set(B, l04.find("beni") - 0.1, 0.35, "back", arm_L_raise=1.5, arm_L_fold=1.0, arm_L_curl=1.0)  # back of hand to brow
    tl.set(B, l04.find("beni") - 0.1, 0.35, tilt=0.25, nod=-0.15)
    tl.set(B, l04.find("gece") - 0.1, 0.3, arm_L_raise=0.3, arm_L_fold=0.2, arm_L_curl=0.2, tilt=0.0, nod=0.0)
    tl.look(B, l04.find("gece"), Y, 0.2, head=0.5)
    tl.expr(B, l04.find("üç", 1) - 0.15, "angry", 0.15, brow_up=0.3)
    tl.hop(B, l04.find("üç", 1) - 0.05, 0.07, 0.35, 0.18)                           # "ÜÇ!"
    tl.set(B, l04.find("üç", 1) - 0.1, 0.15, "back", arm_R_raise=1.6, arm_R_curl=-0.4)
    tl.shake(B, l04.find("üç", 1), 0.5, "tilt", 0.08, 7)

    l05 = tl.say(Y, l04.end + 0.06, A("L05_yastik"), bob=0.2)   # deadpan: nothing moves
    tl.expr(Y, l05.t - 0.15, "deadpan", 0.2, lid_u=0.5)
    tl.look(Y, l05.t - 0.15, B, 0.1, head=0.0)
    tl.set(B, l05.t + 0.1, 0.3, arm_R_raise=0.6, arm_R_curl=0.0)
    tl.expr(B, l05.end, "offended", 0.2, brow_up=0.8)

    # ---------------------------------------------------------------- 5. yanked by the foot – onto the bed
    l06 = tl.say(B, l05.end + 0.18, A("L06_battaniye"))
    tl.expr(B, l06.t, "annoyed", 0.25)
    tl.move(B, l06.t + 0.1, 0.9, dx=0.25, dy=-0.12, hops=2, height=0.03)    # shuffles back, "geri çekti"
    yank = l06.find("ayağ") - 0.25                                                 # "AYAĞIYLA!"
    tl.expr(B, yank, "surprised", 0.1)
    tl.set(B, yank - 0.12, 0.12, squash=-0.12)
    tl.set(B, yank, 0.55, "inout", pos_x=BED_SPOT[0], pos_y=BED_SPOT[1])
    tl.set(B, yank, 0.55, "linear", turn=BED_TURN)
    tl.layer(B, lambda tt: _arc(tt, yank, 0.55, BED_SPOT[2], 0.45), yank, 1e9)
    tl.set(B, yank, 0.4, arm_L_raise=1.4, arm_R_raise=1.4, arm_L_curl=0.6, arm_R_curl=0.6)
    tl.sfx(yank, S("whoosh.wav"), -4)
    tl.sfx(yank + 0.55, S("poof.wav"), -6)
    tl.set(B, yank + 0.55, 0.3, arm_L_raise=0.4, arm_R_raise=0.4, arm_L_curl=0.0, arm_R_curl=0.0)
    tl.expr(B, yank + 0.6, "angry", 0.2)
    tl.look(B, yank + 0.6, Y, 0.25, head=0.25)
    for k in range(2):                                                      # "yo-yo mu?!" – bounces like one
        tl.hop(B, l06.find("yo") + 0.05 + k * 0.3, 0.09, 0.28, 0.16)
    tl.look(Y, yank + 0.05, B, 0.3, head=0.45)
    tl.expr(Y, yank, "surprised", 0.12)
    tl.expr(Y, yank + 0.8, "deadpan", 0.4)

    # ---------------------------------------------------------------- 6. what really happened last night
    l08 = tl.say(Y, l06.end + 0.3, A("L08_yastik"), intensity=0.9, bob=0.5)
    tl.expr(Y, l08.t - 0.2, "sad", 0.5)
    tl.look(Y, l08.t - 0.2, (0.0, -0.6, 0.55), 0.5, head=0.3)        # looks down at the dent in the bed
    tl.set(Y, l08.t, 0.8, nod=0.12, squash=-0.03)
    tl.look(Y, l08.find("kimse") - 0.1, B, 0.3, head=0.3)
    tl.expr(B, l08.t + 0.4, "touched", 0.6)

    l09 = tl.say(B, l08.end + 0.1, A("L09_battaniye"), bob=0.6)
    tl.set(B, l09.t, 0.5, arm_L_raise=0.9, arm_L_fold=1.2, arm_L_curl=0.8, tilt=-0.18)  # hand on heart

    # ---------------------------------------------------------------- 7. the outburst
    l10 = tl.say(Y, l09.end + 0.05, A("L10_yastik"), intensity=1.15, bob=1.6)
    tl.expr(Y, l10.t - 0.08, "shout", 0.1)
    tl.set(Y, l10.t - 0.12, 0.12, "back", lean_f=0.14, arm_L_raise=0.9, arm_R_raise=0.9, nod=0.0)
    tl.shake(Y, l10.t, l10.dur, "lean_s", 0.04, 9, decay=False)
    tl.expr(B, l10.t + 0.05, "surprised", 0.1)
    tl.set(B, l10.t + 0.05, 0.15, "back", lean_f=-0.18, squash=0.1, arm_L_raise=1.2, arm_L_fold=0.0)
    tl.set(Y, l10.end, 0.35, lean_f=0.0, arm_L_raise=0.0, arm_R_raise=0.0)
    tl.expr(Y, l10.end, "deadpan", 0.3, brow_ang=0.5)
    tl.set(B, l10.end + 0.1, 0.4, lean_f=0.0, squash=0.0, arm_L_raise=0.3)

    # ---------------------------------------------------------------- 8. the question nobody asks a pillow
    l11 = tl.say(B, l10.end + 0.4, A("L11_battaniye"), intensity=0.8, bob=0.4)
    tl.expr(B, l11.t - 0.2, "touched", 0.4, m_smile=0.15)
    tl.set(B, l11.t, 0.6, tilt=-0.15, lean_f=0.06)
    tl.expr(Y, l11.find("dinliyor"), "sad", 0.5, lid_u=-0.1, brow_up=0.9)              # it lands
    tl.look(Y, l11.find("dinliyor"), B, 0.2, head=0.4)
    trem = l11.end + 0.1
    tl.shake(Y, trem, 0.9, "m_frown", 0.25, 11, decay=False)
    tl.sfx(trem + 0.35, S("sniff.wav"), -6)
    hug = trem + 0.45                                                       # she scoots over and hugs him
    tl.move(B, hug, 0.45, dx=-0.12, dy=-0.02, hops=1, height=0.04, turn=BED_TURN - 0.25)
    tl.set(B, hug + 0.2, 0.45, arm_L_raise=1.7, arm_R_raise=0.9, arm_L_fold=1.1, arm_R_fold=1.2, arm_L_curl=0.9,
           arm_R_curl=0.7, lean_f=0.25, tilt=0.15)
    tl.expr(B, hug + 0.2, "happy", 0.4, squint=0.8)
    tl.sfx(hug + 0.2, S("rustle_long.wav"), -6)
    tl.expr(Y, hug + 0.55, "touched", 0.5, squint=0.6, blink=0.85)
    tl.set(Y, hug + 0.55, 0.5, squash=-0.06, tilt=0.12)
    tl.duration = hug + 1.5

    # ---------------------------------------------------------------- cameras (9:16)
    # (angles checked against the 9:16 horizontal field of view: 24 mm ~ 31 deg, 20 mm ~ 37 deg)
    wide = ((2.3, -2.9, 1.25), (0.68, 0.2, 0.55))
    two = ((2.05, -2.9, 1.2), (0.5, 0.2, 0.5))                # blanket in front on the floor, pillow up on the bed
    bed_two = ((0.04, -1.6, 1.1), (0.04, 0.6, 0.8))           # from the foot of the bed: side by side
    tl.face_shot(0.0, "cam_cu_y", Y, dist=1.45, yaw=-12, height=0.1, lens=28, push=0.2, dur=l01.end)
    tl.shot(l01.end, "cam_two", *two, lens=30, fstop=4.0, to_loc=(1.85, -2.6, 1.12), dur=l02.dur + 0.4, focus=B)
    tl.face_shot(l03.t - 0.05, "cam_cu_y", Y, dist=1.45, yaw=-15, height=0.06, lens=28, push=0.12, dur=l03.dur)
    tl.face_shot(l04.t - 0.05, "cam_cu_b", B, dist=1.25, yaw=12, height=0.18, lens=26, push=0.1, dur=l04.dur)
    tl.face_shot(l05.t - 0.1, "cam_cu_y2", Y, dist=1.0, yaw=0, height=0.04, lens=30)
    tl.shot(l06.t - 0.05, "cam_wide", *wide, lens=24, fstop=4.5, to_loc=(2.2, -2.75, 1.28), dur=l06.dur, focus=B)
    tl.face_shot(l08.t - 0.3, "cam_cu_y", Y, dist=1.3, yaw=-14, height=0.06, lens=28, push=0.18, dur=l08.dur)
    tl.shot(l09.t - 0.05, "cam_bed_two", *bed_two, lens=22, fstop=4.0, focus=B)
    tl.face_shot(l10.t - 0.04, "cam_shout", Y, dist=0.8, yaw=-8, height=0.02, lens=30, shake=0.006)
    tl.shot(l10.end + 0.3, "cam_bed_two", *bed_two, lens=22, fstop=4.0,
            to_loc=(0.04, -1.35, 1.06), dur=4.5, focus=Y)
