"""5-second technical test: the opening beat of 'Yastığın İsyanı'.

Checks both character looks, eyelids/gaze/brows, body squash, a camera cut,
SFX and Turkish lip sync on the first real line.
"""
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CAST = ("yastik", "battaniye")
DOOR = (2.8, -2.4, 1.0)     # off-screen right, where the owner just left


def build(tl, ep):
    A = lambda f: os.path.join(ep, "audio", f)
    S = lambda f: os.path.join(ROOT, "assets", "sfx", f)

    # both pretend to sleep
    tl.eyes_closed("yastik", 0.0, 0.8)
    tl.eyes_closed("battaniye", 0.0, 3.1)
    tl.expr("battaniye", 0.0, "neutral", 0.01, m_frown=0.15)

    tl.sfx(0.0, S("keys.wav"), -4)
    tl.sfx(0.35, S("door_slam.wav"), -1)
    tl.pulse("yastik", 0.42, 0.3, squash=-0.05)
    tl.pulse("battaniye", 0.42, 0.3, squash=-0.06)

    # one eye peeks first, then both
    tl.set("yastik", 0.7, 0.1, lid_u_L=0.95, lid_l_L=0.4)
    tl.look("yastik", 0.85, DOOR, 0.12, head=0.2)
    tl.set("yastik", 1.25, 0.15, lid_u_L=0.0, lid_l_L=0.0)
    tl.expr("yastik", 1.0, "neutral", 0.25, brow_up=0.35, lid_u=-0.15)

    # L01: "Gitti mi? ... Gitti. Oh be!"  (whispered, then relieved)
    tl.say("yastik", 1.0, A("L01_yastik.wav"), intensity=0.85)
    tl.set("yastik", 1.1, 0.4, lean_f=0.06)
    tl.look("yastik", 1.9, DOOR, 0.1, head=0.15, up=0.05)
    tl.look("yastik", 2.45, (DOOR[0], DOOR[1], 0.5), 0.12, head=0.15)
    tl.expr("yastik", 3.25, "relief", 0.35)
    tl.look_cam("yastik", 3.3, 0.35)
    tl.set("yastik", 3.3, 0.4, lean_f=0.0)
    # "Oh be!": exhale and deflate, corners flop down
    tl.set("yastik", 4.3, 0.7, "out", squash=-0.08, arm_L_raise=-0.3, arm_R_raise=-0.3, arm_L_fold=0.15,
           arm_R_fold=0.15)
    tl.set("yastik", 4.3, 0.7, "out", nod=-0.14, lid_u=0.35)
    tl.sfx(4.35, S("poof.wav"), -10)

    # the blanket wakes up, annoyed, and glares up at the pillow
    tl.expr("battaniye", 3.1, "annoyed", 0.4)
    tl.look("battaniye", 3.3, "yastik", 0.45, head=0.45)
    tl.set("battaniye", 3.3, 0.6, lean_f=-0.07)
    tl.sfx(3.25, S("rustle.wav"), -8)
    tl.set("battaniye", 4.6, 0.3, lid_u=0.3, brow_ang=0.9)

    # cameras: slow push on the pillow, then cut to the two-shot
    tl.face_shot(0.0, "cam_open", "yastik", dist=1.3, yaw=-12, height=0.1, lens=35, fstop=2.8,
                 push=0.22, dur=3.3)
    tl.shot(3.3, "cam_two", (2.05, -2.9, 1.2), (0.5, 0.2, 0.5), lens=30, fstop=4.0,
            to_loc=(1.9, -2.65, 1.15), dur=2.6, focus="battaniye")
    tl.duration = 5.75
