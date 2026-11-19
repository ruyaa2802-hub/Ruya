"""Shared timing for picture and sound: 'Güçlü Görünmek' (40 s, 24 fps)."""
import math
import numpy as np

FPS = 24
DUR = 40.0
NF = int(DUR * FPS)

# scene boundaries
S2, S3, S4, S5 = 6.6, 12.8, 20.2, 28.8

# voice-over start times (seconds) and tempo factors per line
VO = [(0.4, 1.0), (6.9, 1.0), (13.0, 1.0), (21.0, 1.0), (29.2, 1.06)]
TEXT_IN = 37.9

# key story beats
TRY_STEP = (20.9, 21.8)
KNEEL = (22.0, 24.8)
SLIP = (25.2, 25.8)          # burden slips, crash at SLIP[1]
SIT = (25.9, 27.0)
OBJ_FALL = 25.6
TEAR_FORM = 27.2
TEAR_FALL = (27.6, 28.15)
SPROUT = 28.4
OBJ_TIMES = [13.6, 14.8, 16.0, 17.2]   # letter, clock, flower, chair
HELP = (8.6, 9.6)
X0 = -300.0
CYCLE = 44.0


def clamp(x, a=0.0, b=1.0):
    return a if x < a else b if x > b else x


def ss(a, b, x):
    t = clamp((x - a) / (b - a))
    return t * t * (3 - 2 * t)


def lerp(a, b, t):
    return a + (b - a) * t


def bump(t, a, b, c):
    return ss(a, b, t) * (1 - ss(b, c, t))


def speed(t):
    if t < 6.6:
        return 16.0
    if t < 7.3:
        return 16.0 * (1 - ss(6.6, 7.3, t))
    if t < 8.0:
        return 0.0
    if t < 8.7:
        return 18.0 * math.sin(math.pi * (t - 8.0) / 0.7)
    if t < 12.5:
        return 0.0
    if t < 13.2:
        return 13.0 * ss(12.5, 13.2, t)
    if t < 19.6:
        return lerp(13.0, 8.0, (t - 13.2) / 6.4)
    if t < 20.2:
        return 8.0 * (1 - ss(19.6, 20.2, t))
    return 0.0


_DT = 1 / 480
_T = np.arange(0, DUR + 1, _DT)
_V = np.array([speed(t) for t in _T])
_X = X0 + np.concatenate([[0], np.cumsum(_V[:-1]) * _DT])


def charx(t):
    return float(np.interp(t, _T, _X))


def phase(t):
    return 2 * math.pi * (charx(t) - X0) / CYCLE


def footsteps():
    """Times at which a foot plants (for footstep sounds)."""
    ev = []
    ph = 2 * math.pi * (_X - X0) / CYCLE
    k = np.floor((ph - math.pi / 2) / math.pi)
    idx = np.nonzero(np.diff(k) > 0)[0]
    for i in idx:
        t = _T[i]
        if speed(t) > 2.5:
            ev.append((float(t), min(1.0, speed(t) / 14)))
    return ev
