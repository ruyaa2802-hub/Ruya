"""GECE YARISI BUZDOLABI TOPLANTISI (≈50 s, 9:16, absurd comedy)

02:13. Someone in pyjamas shuffles into the dark kitchen and opens the fridge –
for the fourth time tonight. The fridge has had enough; inside, the milk bottle,
the cheese and the olive compare notes, and the tahini that has been at the
back of the bottom shelf for years wakes up. The door closes... and two
seconds later it opens again. The fridge raises the alarm.

Dialogue (audio/paced/*.wav; ElevenLabs eleven_v4, except ZEYTİN and TAHİN: Piper "fahrettin",
pitch-shifted – the ElevenLabs quota ran out):
  L01 BUZDOLABI (Metehan)  Hayırdır yine? Bu gece dördüncü gelişin.
                           İçeride yeni bir şey mi doğuracağım?
  L02 SÜT (Deniz)          Bence… ne istediğini bilmiyor.
  (el içeri uzanır, peyniri alır, evirip çevirir, geri koyar)
  L03 PEYNİR (JollyBolt)   Beni üç kere eline aldı, üçünde de geri koydu. Ben ürün müyüm, deneme sürümü mü?
  L06 ZEYTİN               Sen yine şanslısın! Bana bakıp "Bu çekirdekli" deyip yüzünü çevirdi.
  (alt rafta toz kalkar: tahin uyanır)
  L07 TAHİN                Gençler… gürültü yapmayın. Ben bu dolaba girdiğimde… süt daha inekteydi.
  L08 ZEYTİN               Amca, senin son kullanma tarihin 2019!
  L09 TAHİN                Evlat… tarih dediğin, sadece bir rakamdır.
  L04 BUZDOLABI            Kardeşim, acıktıysan ye! Beni açıp açıp hayatını sorgulama!
  (kapı kapanır – karanlık – iki saniye sessizlik – kapı yeniden açılır)
  L05 BUZDOLABI            GÜVENLİĞİ ÇAĞIRIN! ŞÜPHELİ GERİ DÖNDÜ!
Music: procedural pizzicato (ig/music.py), sound effects: ig/sfx.py.
"""
import math
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SET = "kitchen"
CAST = ("buzdolabi", "sut", "peynir", "zeytin", "tahin")
TITLE = "GECE YARISI\nBUZDOLABI TOPLANTISI"
PACING = {"L01_buzdolabi": 0.5, "L03_peynir": 0.45, "L07_tahin": 0.7, "L09_tahin": 0.6}
LINES = {
    "L01_buzdolabi": "Hayırdır yine? Bu gece dördüncü gelişin. İçeride yeni bir şey mi doğuracağım?",
    "L02_sut": "Bence… ne istediğini bilmiyor.",
    "L03_peynir": "Beni üç kere eline aldı, üçünde de geri koydu. Ben ürün müyüm, deneme sürümü mü?",
    "L06_zeytin": "Sen yine şanslısın! Bana bakıp “Bu çekirdekli” deyip yüzünü çevirdi.",
    "L07_tahin": "Gençler… gürültü yapmayın. Ben bu dolaba girdiğimde… süt daha inekteydi.",
    "L08_zeytin": "Amca, senin son kullanma tarihin 2019!",
    "L09_tahin": "Evlat… tarih dediğin, sadece bir rakamdır.",
    "L04_buzdolabi": "Kardeşim, acıktıysan ye! Beni açıp açıp hayatını sorgulama!",
    "L05_buzdolabi": "GÜVENLİĞİ ÇAĞIRIN! ŞÜPHELİ GERİ DÖNDÜ!",
}
F = (0.0, 0.88, 0.0)                                   # fridge (= ig.sets.kitchen.FRIDGE)
MILK = (F[0] - 0.13, F[1] - 0.13, 0.806)
CHEESE = (F[0] + 0.07, F[1] - 0.16, 0.806)
OLIVE = (F[0] + 0.24, F[1] - 0.13, 0.806)
TAHINI = (F[0] - 0.17, F[1] - 0.14, 0.456)             # bottom shelf, front left
HOME = {"buzdolabi": dict(loc=F),
        "sut": dict(loc=MILK, rot=(0, 0, math.radians(18))),
        "peynir": dict(loc=CHEESE, rot=(0, 0, math.radians(-12))),
        "zeytin": dict(loc=OLIVE, rot=(0, 0, math.radians(-25))),
        "tahin": dict(loc=TAHINI, rot=(0, 0, math.radians(15)))}
HALL = (2.6, -1.5, 1.2)                                 # where the human comes from
STAND = (-0.44, -0.1)                                    # where the human stands at the fridge
DOOR_OPEN = 1.75


def _smooth(a, b, t):
    k = min(max((t - a) / (b - a), 0.0), 1.0)
    return k * k * (3 - 2 * k)


def _path(keys):
    """Piecewise smooth interpolation through [(t, value-tuple), ...]."""
    def at(t):
        if t <= keys[0][0]:
            return keys[0][1]
        for (t0, v0), (t1, v1) in zip(keys, keys[1:]):
            if t <= t1:
                k = _smooth(t0, t1, t)
                return tuple(a + (b - a) * k for a, b in zip(v0, v1))
        return keys[-1][1]
    return at


def _key(socket_or_light, attr, frames_values):
    for f, v in frames_values:
        setattr(socket_or_light, attr, v)
        socket_or_light.keyframe_insert(attr, frame=f)


def build(tl, ep):
    import bpy
    from mathutils import Matrix, Vector

    from ig.characters import insan

    A = lambda lid: os.path.join(ep, "audio", "paced", lid + ".wav")
    S = lambda f: os.path.join(ROOT, "assets", "sfx", f)
    B, M, P, Z, T = "buzdolabi", "sut", "peynir", "zeytin", "tahin"
    fps = tl.fps
    fridge = tl.chars[B]

    # ================================================================ beat sheet (seconds)
    t_clock = 0.0          # 02:13 on the microwave, slippers shuffle closer
    t_wake = 1.0           # the fridge's eye snaps open
    t_walk = (1.7, 3.4)    # legs shuffle in and stop
    t_grab = 3.5           # hand on the handle
    t_open = 3.75          # door swings open, cold light
    l01 = tl.say(B, 4.55, A("L01_buzdolabi"), bob=0.6)
    t_dolly = l01.end + 0.1
    l02 = tl.say(M, t_dolly + 1.25, A("L02_sut"), intensity=0.9, bob=0.6)
    t_reach = l02.end + 0.15                                  # hand comes in for the cheese
    t_lift, t_hold, t_down, t_out = t_reach + 0.45, t_reach + 0.85, t_reach + 1.75, t_reach + 2.25
    l03 = tl.say(P, t_out + 0.25, A("L03_peynir"))
    l06 = tl.say(Z, l03.end + 0.3, A("L06_zeytin"), bob=0.7)
    t_dust = l06.end + 0.3                                    # dust rises on the bottom shelf
    l07 = tl.say(T, t_dust + 0.75, A("L07_tahin"), intensity=0.85, bob=0.4)
    l08 = tl.say(Z, l07.end + 0.3, A("L08_zeytin"), bob=0.8)
    l09 = tl.say(T, l08.end + 0.7, A("L09_tahin"), intensity=0.85, bob=0.4)
    t_roll = l09.end + 0.25                                   # the fridge rolls its eyes
    l04 = tl.say(B, t_roll + 0.6, A("L04_buzdolabi"), intensity=1.05, bob=0.9)
    t_close = l04.end + 0.25                                  # the door closes: dark
    t_pause = t_close + 0.45                                  # two seconds of nothing
    t_again = t_pause + 2.0                                   # ...and it opens again
    t_turn = t_again + 0.75                                   # the fridge turns to the camera
    l05 = tl.say(B, t_turn + 0.3, A("L05_buzdolabi"), intensity=1.2, bob=1.6)
    t_panic = l05.end + 0.1
    tl.duration = t_panic + 2.6

    # ================================================================ the human: legs, torso, one arm
    hu = insan.build(bpy.data.collections.get("Set"))
    start = (1.05, -1.6)
    heading = math.atan2(STAND[0] - start[0], -(STAND[1] - start[1]))       # local -Y along the walk
    root_xy = _path([(t_walk[0], start), (t_walk[1], STAND)])
    root_rot = _path([(t_walk[1] - 0.5, (heading,)), (t_walk[1] + 0.2, (-math.pi,))])

    def walking(t):
        return t_walk[0] <= t <= t_walk[1] + 0.15

    def root_fn(t):
        x, y = root_xy(t)
        bob = 0.012 * abs(math.sin(math.pi * 2.4 * (t - t_walk[0]))) if walking(t) else 0.0
        return {"location": (x, y, bob), "rotation_euler": (0.0, 0.0, root_rot(t)[0])}

    def leg_fn(sign):
        def fn(t):
            if not walking(t):
                return {}
            fade = min(1.0, (t_walk[1] + 0.15 - t) / 0.3)
            return {"rotation_euler": (sign * 0.32 * fade * math.sin(math.pi * 2.4 * (t - t_walk[0])), 0, 0)}
        return fn

    tl.prop(hu["root"], root_fn)
    tl.prop(hu["leg_L"], leg_fn(1))
    tl.prop(hu["leg_R"], leg_fn(-1))

    # the hand: where it should be (world), the arm aims from the shoulder and slides to reach
    hinge = Vector((0.36, F[1] - 0.34, 0.0))
    handle0 = Vector((-0.29, F[1] - 0.34 - 0.105, 0.93))

    def handle_at(angle):
        v = handle0 - hinge
        return hinge + Matrix.Rotation(angle, 3, "Z") @ v

    def door_angle(t):
        return tl.track(B, "door").value(t)

    grip = Vector((0.0, 0.03, 0.05))                        # cheese grip point above its base
    cheese_lift = _path([(t_lift, (0, 0, 0)), (t_hold, (0.0, -0.06, 0.06)), (t_hold + 0.5, (0.01, -0.07, 0.07)),
                         (t_down - 0.1, (0.0, -0.06, 0.055)), (t_down, (0, 0, 0))])
    rest_hand = Vector((STAND[0] - 0.19, STAND[1], 0.75))   # hanging by the side

    def hand_target(t):
        if t < t_grab - 0.35:
            return None
        if t < t_grab:
            return rest_hand.lerp(handle_at(0.0), _smooth(t_grab - 0.35, t_grab, t))
        if t < t_open + 0.45:                                   # rides the handle as the door opens
            return handle_at(door_angle(t))
        if t < t_reach - 0.3:
            return handle_at(door_angle(t_open + 0.45)).lerp(rest_hand, _smooth(t_open + 0.45, t_open + 0.9, t))
        c = Vector(CHEESE) + grip
        if t < t_lift:
            return rest_hand.lerp(c, _smooth(t_reach - 0.3, t_lift, t))
        if t < t_down + 0.05:
            return c + Vector(cheese_lift(t))
        if t < t_close - 0.6:
            return c.lerp(rest_hand, _smooth(t_down + 0.05, t_out, t))
        if t < t_close + 0.4:                                   # pushes the door shut
            a = door_angle(t)
            return rest_hand.lerp(handle_at(a), _smooth(t_close - 0.6, t_close - 0.1, t))
        if t < t_again - 0.4:
            return handle_at(0.0).lerp(rest_hand, _smooth(t_close + 0.4, t_close + 0.8, t))
        if t < t_again + 0.5:
            return rest_hand.lerp(handle_at(door_angle(t)), _smooth(t_again - 0.4, t_again, t))
        return handle_at(door_angle(t_again + 0.5))

    shoulder_local = Vector(insan.SHOULDER)
    reach = 0.68

    def arm_fn(t):
        target = hand_target(t)
        if target is None:
            return {}
        x, y = root_xy(t)
        rz = root_rot(t)[0]
        to_local = Matrix.Rotation(-rz, 3, "Z")
        tgt = to_local @ (target - Vector((x, y, 0.0)))
        d = tgt - shoulder_local
        n = d.normalized()
        loc = tgt - n * reach if d.length > reach else shoulder_local     # the shoulder leans in to reach
        a = math.acos(max(-1.0, min(1.0, -n.z)))
        c = math.atan2(-n.x, n.y)
        return {"location": tuple(loc - shoulder_local), "rotation_euler": (a, 0.0, c)}

    tl.prop(hu["arm"], arm_fn)

    # ================================================================ the fridge
    # 1. asleep in the dark; an eye snaps open at the shuffling
    tl.eyes_closed(B, 0.0, t_wake)
    tl.set(B, t_wake - 0.05, 0.08, lid_u_R=0.95, lid_l_R=0.4)
    tl.sfx(t_wake, S("bloop.wav"), -6)
    tl.set(B, t_wake + 0.35, 0.1, lid_u_R=0.0, lid_l_R=0.0)
    tl.expr(B, t_wake + 0.3, "annoyed", 0.3, lid_u=0.25)
    tl.look(B, t_wake + 0.2, HALL, 0.25, head=0.15)
    tl.look(B, t_walk[1] - 0.3, (STAND[0], STAND[1] - 0.2, 1.6), 0.4, head=0.25)   # glares at the intruder

    # 2. the door opens (the human pulls), light floods out
    tl.set(B, t_open, 0.65, "out", door=DOOR_OPEN)
    tl.sfx(t_open - 0.05, S("fridge_open.wav"), -3)
    tl.expr(B, t_open, "surprised", 0.1, lid_u=0.1)
    tl.expr(B, t_open + 0.35, "deadpan", 0.4, lid_u=0.45)

    # 3. L01: "Hayırdır yine? Bu gece dördüncü gelişin. İçeride yeni bir şey mi doğuracağım?"
    tl.expr(B, l01.t, "deadpan", 0.3, lid_u=0.4, brow_up=0.3)
    tl.look(B, l01.t, (STAND[0], STAND[1] - 0.2, 1.55), 0.3, head=0.25)
    tl.shake(B, l01.find("dördüncü"), 0.9, "twist", 0.05, 2.2, decay=True)          # slow head shake
    tl.expr(B, l01.find("dördüncü"), "tired", 0.3)
    tl.expr(B, l01.find("içeride") - 0.1, "sarcastic", 0.3)
    tl.set(B, l01.find("içeride"), 0.4, tilt=0.06)
    tl.look(B, l01.find("doğur"), (0.3, 0.0, 2.6), 0.35, head=0.1)                   # eyes to heaven
    tl.set(B, l01.end, 0.4, tilt=0.0)

    # 4. inside: the milk knows. 5. the hand takes the cheese... and puts it back
    tl.expr(M, t_dolly, "neutral", 0.3)
    tl.expr(P, t_dolly, "neutral", 0.3)
    tl.look(M, t_dolly + 0.5, (STAND[0], STAND[1], 1.3), 0.3, head=0.3)
    tl.look(P, t_dolly + 0.5, (STAND[0], STAND[1], 1.3), 0.3, head=0.3)
    tl.look(Z, t_dolly + 0.6, (STAND[0], STAND[1], 1.3), 0.3, head=0.3)
    tl.eyes_closed(T, 0.0, t_dust + 0.35)                                            # asleep for years
    tl.expr(M, l02.t - 0.1, "sarcastic", 0.3, lid_u=0.3)
    tl.set(M, l02.t, 0.4, lean_s=-0.08, tilt=-0.1)                                   # leans in to whisper
    tl.look(M, l02.t + 0.2, "peynir", 0.3, head=0.45)
    tl.look(P, l02.t + 0.3, "sut", 0.3, head=0.4)
    tl.set(P, l02.find("istediğini"), 0.25, nod=0.12)
    tl.set(P, l02.find("istediğini") + 0.3, 0.25, nod=0.0)
    tl.set(M, l02.end, 0.4, lean_s=0.0, tilt=0.0)
    # the hand comes: both freeze into products
    for who in (M, P, Z):
        tl.look(who, t_reach - 0.2, (CHEESE[0], CHEESE[1] - 0.5, 1.0), 0.15, head=0.2)
        tl.expr(who, t_reach - 0.1, "surprised", 0.1)
        tl.expr(who, t_reach + 0.15, "neutral", 0.08)
        tl.eyes_closed(who, t_reach + 0.15, t_out + 0.15)
        tl.set(who, t_reach + 0.15, 0.1, gaze_x=0.0, gaze_y=0.0, twist=0.0, tilt=0.0, nod=0.0, lean_s=0.0)
    tl.layer(P, lambda t: dict(zip(("pos_x", "pos_y", "pos_z"), cheese_lift(t))), t_lift, t_down + 0.01)
    tl.layer(P, lambda t: {"turn": 0.35 * math.sin(2 * math.pi * 0.9 * (t - t_hold))
                           * _smooth(t_hold, t_hold + 0.2, t) * (1 - _smooth(t_down - 0.35, t_down - 0.1, t))},
             t_hold, t_down)
    tl.sfx(t_down - 0.02, S("thunk.wav"), -6)

    # 6. L03: "Beni üç kere eline aldı, üçünde de geri koydu. Ben ürün müyüm, deneme sürümü mü?"
    tl.expr(P, l03.t - 0.15, "offended", 0.2, brow_up=0.9)
    tl.look(P, l03.t, (STAND[0], STAND[1] - 0.3, 1.2), 0.25, head=0.35)
    tl.hop(P, l03.t - 0.05, 0.02, 0.26, 0.15)
    tl.expr(P, l03.find("geri") - 0.1, "angry", 0.25)
    tl.shake(P, l03.find("ben", 1), 0.6, "tilt", 0.08, 6)
    tl.expr(P, l03.find("ben", 1) - 0.1, "dramatic", 0.3, m_open=0.1)
    tl.look(P, l03.find("ben", 1), "sut", 0.3, head=0.45)
    tl.expr(P, l03.find("deneme") - 0.1, "shout", 0.15, m_open=0.0)
    tl.hop(P, l03.find("deneme"), 0.025, 0.28, 0.16)
    tl.expr(M, l03.t + 0.4, "offended", 0.3)
    tl.expr(M, l03.find("deneme"), "smug", 0.3, m_smile=0.3)            # can't help a smirk
    tl.set(M, l03.find("deneme"), 0.4, tilt=0.1)
    tl.look(Z, l03.t + 0.3, "peynir", 0.3, head=0.4)

    # 6b. L06: the olive – "Sen yine şanslısın! Bana bakıp 'Bu çekirdekli' deyip yüzünü çevirdi."
    tl.expr(Z, l06.t - 0.1, "sarcastic", 0.25)
    tl.set(Z, l06.t, 0.3, lean_s=0.08, tilt=0.08)                                    # leans toward the cheese
    tl.expr(Z, l06.find("çekirdek") - 0.1, "deadpan", 0.2, lid_u=0.4)               # imitates the owner
    tl.set(Z, l06.find("çekirdek") - 0.1, 0.2, nod=-0.1)
    tl.expr(Z, l06.find("yüzünü") - 0.1, "offended", 0.25, brow_up=1.0)
    tl.set(Z, l06.find("yüzünü"), 0.35, twist=0.5, nod=0.0, lean_s=0.0, tilt=0.0)    # turns her nose up
    tl.set(Z, l06.end + 0.1, 0.4, twist=0.0)
    tl.expr(P, l06.t + 0.3, "deadpan", 0.4)
    tl.look(P, l06.t + 0.2, "zeytin", 0.3, head=0.4)

    # 6c. the tahini wakes up: dust, heavy lids, everyone looks down
    tl.sfx(t_dust, S("poof.wav"), -6)
    tl.pulse(T, t_dust, 0.35, squash=0.06)
    tl.shake(T, t_dust + 0.05, 0.5, "tilt", 0.05, 5)
    tl.set(T, t_dust + 0.35, 0.8, "out", lid_u=-0.15)                                # lids drag open
    tl.look(T, t_dust + 0.6, (OLIVE[0], OLIVE[1], 1.0), 0.5, head=0.3)
    for who, d in ((M, 0.0), (P, 0.1), (Z, 0.05)):
        tl.expr(who, t_dust + 0.1 + d, "surprised", 0.15)
        tl.look(who, t_dust + 0.15 + d, "tahin", 0.3, head=0.45)
        tl.set(who, t_dust + 0.15 + d, 0.4, lean_f=0.06)                             # peer over the shelf edge
    # L07: "Gençler… gürültü yapmayın. Ben bu dolaba girdiğimde… süt daha inekteydi."
    tl.expr(T, l07.t, "tired", 0.5, lid_u=0.15)
    tl.look(T, l07.find("süt"), "sut", 0.4, head=0.35)
    tl.expr(T, l07.find("inek") - 0.1, "smug", 0.4, lid_u=0.25)
    tl.expr(M, l07.find("inek") + 0.1, "offended", 0.2, brow_up=1.1)
    tl.set(M, l07.find("inek") + 0.1, 0.2, "back", lean_f=-0.06, squash=0.05)
    # L08: "Amca, senin son kullanma tarihin 2019!"
    tl.expr(Z, l08.t - 0.1, "smug", 0.25, m_smile=0.3)
    tl.hop(Z, l08.t, 0.02, 0.26, 0.14)
    tl.set(Z, l08.t, 0.3, lean_f=0.1)
    tl.expr(P, l08.end - 0.4, "happy", 0.3, squint=0.5)                              # snickers
    tl.expr(M, l08.end - 0.3, "smug", 0.3)
    # beat... L09: "Evlat… tarih dediğin, sadece bir rakamdır."
    tl.expr(T, l08.end + 0.1, "deadpan", 0.4, lid_u=0.5)
    tl.look(T, l08.end + 0.2, "zeytin", 0.5, head=0.3)
    tl.expr(T, l09.find("tarih"), "fond", 0.5, lid_u=0.45)
    tl.set(T, l09.find("tarih"), 0.6, nod=0.1)
    tl.set(T, l09.find("rakam"), 0.6, nod=0.0, tilt=0.06)
    for who in (M, P, Z):
        tl.expr(who, l09.t + 0.4, "deadpan", 0.4, lid_u=0.3)
        tl.set(who, l09.end, 0.4, lean_f=0.0)

    # 7. eye-roll, then L04 with the door trembling
    tl.expr(B, t_roll, "annoyed", 0.25, lid_u=0.3)
    tl.look(B, t_roll + 0.05, (-1.5, 0.0, 2.4), 0.2, head=0.1)                    # up and left...
    tl.look(B, t_roll + 0.3, (1.5, 0.0, 2.6), 0.25, head=0.1)                     # ...over the top...
    tl.look(B, t_roll + 0.6, (STAND[0], STAND[1] - 0.2, 1.55), 0.2, head=0.3)    # ...and back on him
    tl.expr(B, l04.t - 0.05, "angry", 0.2)
    tl.shake(B, l04.t, 1.6, "door", 0.045, 9, decay=False)
    tl.sfx(l04.t, S("rattle.wav"), -8)
    tl.set(B, l04.find("ye") - 0.1, 0.15, "back", lean_f=-0.08)                   # "ye!" – recoils
    tl.shake(B, l04.find("açıp"), 1.4, "door", 0.06, 10, decay=False)
    tl.sfx(l04.find("açıp"), S("rattle.wav"), -6)
    tl.expr(B, l04.find("hayat") - 0.1, "shout", 0.2, m_open=0.0)
    tl.set(B, l04.find("hayat"), 0.2, "back", lean_f=0.1, squash=0.05)
    tl.set(B, l04.end, 0.4, lean_f=0.0, squash=0.0)

    # 8. door closes – darkness – relief
    tl.set(B, t_close, 0.4, "in", door=0.0)
    tl.sfx(t_close + 0.38, S("fridge_close.wav"), -2)
    tl.expr(B, t_close + 0.5, "relief", 0.6, lid_u=0.4)
    tl.look_cam(B, t_close + 0.5, 0.6)
    tl.set(B, t_close + 0.6, 1.2, "inout", lid_u=0.75, m_smile=0.35)               # drifting off, almost
    for who in (M, P, Z, T):
        tl.expr(who, t_close + 0.4, "relief", 0.5)

    # 9. ...it opens again. eyes pop. turn. ALARM.
    tl.set(B, t_again, 0.5, "out", door=DOOR_OPEN * 0.9)
    tl.sfx(t_again - 0.05, S("fridge_open.wav"), -3)
    tl.expr(B, t_again + 0.12, "surprised", 0.06, lid_u=-0.4, brow_up=1.2)
    tl.sfx(t_again + 0.12, S("bloop.wav"), -4)
    tl.pulse(B, t_again + 0.12, 0.3, squash=0.08)
    tl.set(B, t_turn, 0.18, "back", twist=-0.35, lean_f=0.12)                      # whips round to us
    tl.look_cam(B, t_turn, 0.15)
    tl.expr(B, l05.t - 0.08, "shout", 0.1, brow_ang=1.2)
    tl.shake(B, l05.t, l05.dur, "lean_s", 0.04, 8, decay=False)
    tl.shake(B, l05.t, l05.dur + 1.0, "door", 0.06, 11, decay=False)
    tl.sfx(t_turn + 0.05, S("siren.wav"), -6)
    tl.sfx(t_turn + 3.0, S("siren.wav"), -8)
    for who, d in ((M, 0.0), (P, 0.12), (Z, 0.06), (T, 0.2)):                    # inside: panic
        tl.expr(who, t_again + 0.3 + d, "surprised", 0.1)
        tl.expr(who, t_panic + d, "shout", 0.1, m_open=0.9)
        tl.hop(who, t_panic + 0.1 + d, 0.03, 0.25, 0.16)
        tl.hop(who, t_panic + 0.55 + d, 0.03, 0.25, 0.16)
        tl.look_cam(who, t_panic + d, 0.1)

    # ================================================================ sound bed
    tl.sfx(0.0, S("fridge_hum.wav"), -6)
    tl.sfx(0.1, S("footsteps.wav"), -4)
    tl.sfx(t_walk[0] + 0.2, S("footsteps.wav"), -2)
    tl.sfx(0.6, S("music_sneaky.wav"), -12, dur=t_close + 0.38 - 0.6)   # stops dead as the door shuts

    # ================================================================ lights
    def F_(t):
        return int(round(t * fps))

    prefs = bpy.context.preferences.edit
    interp, prefs.keyframe_new_interpolation_type = prefs.keyframe_new_interpolation_type, "LINEAR"
    lamp, spill = fridge.lamp.data, fridge.spill.data
    em = fridge.glow.node_tree.nodes["Emission"].inputs["Strength"]
    on = [(t_open - 0.02, 0.0), (t_open + 0.05, 0.7), (t_open + 0.12, 0.25), (t_open + 0.2, 1.0),
          (t_close + 0.36, 1.0), (t_close + 0.4, 0.0), (t_again - 0.02, 0.0), (t_again + 0.06, 1.0)]
    for target, peak in ((lamp, 1.0), (spill, 25.0)):
        _key(target, "energy", [(0, 0.0)] + [(F_(t), v * peak) for t, v in on])
    _key(em, "default_value", [(0, 0.0)] + [(F_(t), v * 1.2) for t, v in on])
    # the alarm: everything goes red and flashes
    alarm = bpy.data.lights.new("alarm", "AREA")
    alarm.size = 1.5
    alarm.color = (1.0, 0.08, 0.05)
    alarm_obj = bpy.data.objects.new("alarm", alarm)
    bpy.context.scene.collection.objects.link(alarm_obj)
    alarm_obj.location = (0.4, -1.2, 2.3)
    aim = Vector((0.0, 0.8, 1.2)) - Vector(alarm_obj.location)
    alarm_obj.rotation_euler = aim.to_track_quat("-Z", "Y").to_euler()
    flashes = [(0, 0.0), (F_(t_turn), 0.0)]
    t = t_turn
    while t < tl.duration + 0.5:
        flashes += [(F_(t) + 1, 1.0), (F_(t + 0.2), 1.0), (F_(t + 0.2) + 1, 0.15), (F_(t + 0.38), 0.15)]
        t += 0.38
    _key(alarm, "energy", [(f, v * 140.0) for f, v in flashes])
    red = (1.0, 0.15, 0.1)
    for target in (lamp, spill):
        target.color = (0.85, 0.93, 1.0)
        target.keyframe_insert("color", frame=F_(t_turn))
        target.color = red
        target.keyframe_insert("color", frame=F_(t_turn) + 1)
    prefs.keyframe_new_interpolation_type = interp

    # ================================================================ cameras (9:16)
    tl.shot(t_clock, "cam_clock", (0.62, 0.3, 1.17), (0.92, 0.755, 1.125), lens=45, fstop=2.0,
            to_loc=(0.72, 0.42, 1.16), dur=t_wake - 0.05)
    tl.face_shot(t_wake - 0.08, "cam_wake", B, dist=1.25, yaw=6, height=0.02, lens=30, look=(0, 0, -0.03),
                 push=0.12, dur=t_walk[0] - t_wake)
    tl.shot(t_walk[0] - 0.05, "cam_walk", (-0.75, -1.45, 0.28), (0.3, -0.25, 0.45), lens=20, fstop=5.6,
            dur=t_walk[1] - t_walk[0] + 0.3, to_loc=(-0.7, -1.35, 0.3), to_target=(0.0, 0.2, 0.5))
    tl.shot(t_grab - 0.3, "cam_handle", (0.3, -0.75, 1.02), (-0.22, 0.45, 0.88), lens=26, fstop=4.0,
            dur=l01.t - t_grab, to_loc=(0.26, -0.82, 1.03))
    tl.face_shot(l01.t - 0.12, "cam_l01", B, dist=1.2, yaw=10, height=-0.02, lens=30, look=(0, 0, -0.04),
                 push=0.15, dur=l01.dur)
    tl.shot(t_dolly, "cam_dolly", (0.3, -0.45, 1.02), (-0.03, 0.75, 0.88), lens=24, fstop=4.0,
            to_loc=(-0.02, 0.2, 0.95), dur=1.2, kind="inout")
    tl.face_shot(l02.t - 0.1, "cam_milk", M, dist=0.42, yaw=12, height=0.0, lens=32, look=(0.03, 0, -0.02),
                 push=0.1, dur=l02.dur)
    tl.shot(t_reach - 0.15, "cam_inside", (0.26, 0.24, 0.9), (-0.04, 0.75, 0.88), lens=24, fstop=4.0,
            dur=t_out - t_reach, to_loc=(0.25, 0.27, 0.9))
    tl.face_shot(l03.t - 0.12, "cam_cheese", P, dist=0.42, yaw=-8, height=0.02, lens=32, look=(-0.02, 0, -0.01),
                 push=0.12, dur=l03.find("deneme") - l03.t)
    tl.face_shot(l03.find("deneme") - 0.05, "cam_cheese2", P, dist=0.3, yaw=-4, height=0.01, lens=32,
                 look=(0, 0, -0.01), shake=0.0015)
    tl.face_shot(l06.t - 0.1, "cam_olive", Z, dist=0.4, yaw=-10, height=0.01, lens=32, look=(0, 0, -0.01),
                 push=0.1, dur=l06.dur)
    tl.shot(t_dust - 0.15, "cam_shelves", (0.05, 0.12, 0.72), (-0.08, 0.75, 0.62), lens=22, fstop=4.0,
            to_loc=(0.0, 0.18, 0.66), dur=0.9)                                       # both shelves: who's that?
    tl.face_shot(l07.t - 0.15, "cam_tahin", T, dist=0.42, yaw=8, height=0.02, lens=32, look=(0, 0, -0.012),
                 push=0.12, dur=l07.find("inek") - l07.t)
    tl.face_shot(l07.find("inek") + 0.05, "cam_milk2", M, dist=0.4, yaw=12, height=-0.02, lens=32,
                 look=(0.02, 0, -0.03))
    tl.face_shot(l08.t - 0.1, "cam_olive2", Z, dist=0.36, yaw=-14, height=-0.01, lens=32, look=(0, 0, -0.01))
    tl.face_shot(l08.end + 0.15, "cam_tahin2", T, dist=0.38, yaw=4, height=0.02, lens=32, look=(0, 0, -0.012),
                 push=0.2, dur=l09.end - l08.end)
    tl.face_shot(t_roll - 0.05, "cam_roll", B, dist=1.1, yaw=8, height=0.0, lens=30, look=(0, 0, -0.04),
                 push=0.1, dur=l04.end - t_roll)
    tl.shot(l04.find("açıp") - 0.05, "cam_door", (0.95, -0.55, 0.9), (0.1, 0.35, 0.72), lens=24, fstop=4.0,
            dur=l04.end - l04.find("açıp"), shake=0.004)
    tl.shot(t_close - 0.2, "cam_from_inside", (0.14, 1.02, 1.0), (-0.15, -0.6, 0.55), lens=18, fstop=4.0)
    tl.face_shot(t_pause - 0.2, "cam_pause", B, dist=1.0, yaw=0, height=0.0, lens=32, look=(0, 0, -0.04),
                 push=0.08, dur=t_again - t_pause + 0.6)
    tl.face_shot(t_turn + 0.12, "cam_alarm", B, dist=1.05, yaw=0, height=0.0, lens=32, look=(0, 0, -0.03),
                 push=0.15, dur=0.35, shake=0.006)
    tl.shot(t_panic, "cam_panic", (-0.02, 0.2, 0.95), (-0.03, 0.75, 0.88), lens=24, fstop=4.0, shake=0.003)
    tl.face_shot(t_panic + 1.1, "cam_end", B, dist=1.5, yaw=10, height=0.05, lens=28, look=(0, 0, -0.1),
                 shake=0.004)
