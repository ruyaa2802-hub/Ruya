"""İNSANLAR GİDİNCE – Bölüm N: "<Başlık>" (25–35 s, 9:16)

Copy this folder to episodes/bNN_<slug>/, record the lines into audio/, then:
    .venv/bin/python tools/prep_lines.py episodes/bNN_<slug> --tempo 1.12
    .venv/bin/python tools/build_episode.py episodes/bNN_<slug> --dry
    .venv/bin/python tools/build_episode.py episodes/bNN_<slug> --preset draft --frames 24,120,300
    .venv/bin/python tools/build_episode.py episodes/bNN_<slug> --preset final --blend
"""
import math
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CAST = ("yastik", "battaniye")          # names registered in ig/stage.py
TITLE = "İNSANLAR GİDİNCE"
PACING = {}                             # {"L01_x": 0.5} keeps longer comic pauses in a line
HOME = {}                               # per-episode blocking, e.g. {"yastik": dict(loc=(...), rot=(...))}
LINES = {                               # subtitles; audio files are audio/<id>.wav
    "L01_yastik": "…",
    "L02_battaniye": "…",
}


def build(tl, ep):
    A = lambda lid: os.path.join(ep, "audio", "paced", lid + ".wav")
    S = lambda f: os.path.join(ROOT, "assets", "sfx", f)
    Y, B = "yastik", "battaniye"

    # hook in the first 1-2 seconds: a sound + a reaction before any word
    tl.sfx(0.0, S("door_slam.wav"), -1)
    tl.eyes_closed(Y, 0.0, 0.6)

    l01 = tl.say(Y, 0.7, A("L01_yastik"))
    tl.expr(Y, l01.t, "tired", 0.3)
    tl.look(Y, l01.t, B, 0.3, head=0.35)

    l02 = tl.say(B, l01.end + 0.15, A("L02_battaniye"))
    tl.expr(B, l02.t, "dramatic", 0.3)
    tl.hop(B, l02.find("ben"), 0.06)    # gestures land on words: first word starting with "ben"

    tl.face_shot(0.0, "cam_cu_y", Y, dist=1.45, yaw=-12, height=0.1, lens=28)
    tl.face_shot(l02.t - 0.05, "cam_cu_b", B, dist=1.25, yaw=12, height=0.18, lens=26)
    tl.duration = l02.end + 1.5
