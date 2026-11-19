"""Velun version (closer framing). Procedural hand-drawn 2D animation renderer for the short film
'Güçlü Görünmek'. Renders 1080x1920 frames with Skia and pipes them to ffmpeg.

Usage:
  python3 film.py frames 0 5.5 21.3 ...   # write preview PNGs
  python3 film.py video out.mp4            # render the full silent video
"""
import math
import os
import subprocess
import sys

import numpy as np
import skia
from scipy.interpolate import PchipInterpolator

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from timeline import *  # noqa

W, H = 1080, 1920
HORIZ = -80.0  # world y of the plain's far edge

# ---------------------------------------------------------------- palette
def hx(h):
    return np.array([int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16)], float) / 255


INK = hx('#2b1e18')
PAPER = hx('#ece2cb')
NAVY = hx('#26304a')
TURQ = hx('#6f8f86')
TURQ_L = hx('#8fb0aa')
PINK = hx('#d9b9ad')
DPINK = hx('#c9938e')
ORANGE = hx('#d98f5c')
FORANGE = hx('#dca27a')
EARTH = hx('#8a6a4f')
SAND = hx('#d6b4a0')
SKIN = hx('#d4906c')
YEL1, YEL2 = hx('#f6dc72'), hx('#e2ab27')
BURDEN = hx('#2f3952')
GREEN = hx('#7fa868')


def mix(a, b, t):
    return a + (b - a) * t


def col(c, a=1.0):
    c = np.clip(c, 0, 1)
    return skia.ColorSetARGB(int(clamp(a) * 255), int(c[0] * 255), int(c[1] * 255), int(c[2] * 255))


# ---------------------------------------------------------------- affine
def Tm(x, y):
    return np.array([[1, 0, x], [0, 1, y], [0, 0, 1.0]])


def Sm(a, b=None):
    b = a if b is None else b
    return np.array([[a, 0, 0], [0, b, 0], [0, 0, 1.0]])


def Rm(deg):
    r = math.radians(deg)
    c_, s_ = math.cos(r), math.sin(r)
    return np.array([[c_, -s_, 0], [s_, c_, 0], [0, 0, 1.0]])


def ap(M, p):
    v = M @ np.array([p[0], p[1], 1.0])
    return v[:2]


def inv_ap(M, p):
    return ap(np.linalg.inv(M), p)


G = {'k': 1.0, 'z': 1.0, 'bs': 0, 't': 0.0, 'cam': np.eye(3)}


def setM(c, M):
    c.setMatrix(skia.Matrix.MakeAll(*[float(v) for v in M[0]], *[float(v) for v in M[1]], 0, 0, 1))
    G['k'] = math.sqrt(abs(np.linalg.det(M[:2, :2])))


def px(v):
    return v / G['k']


def lw(v):
    # line widths grow gently with zoom, like a pencil drawn at a larger size
    return px(v) * (G['z'] ** 0.3)


# ---------------------------------------------------------------- drawing kit
def rng(sid, slow=False):
    b = G['bs'] // 2 if slow else G['bs']
    return np.random.default_rng((sid * 2654435761 + b * 40503 + 17) % (2 ** 32))


def wob(pts, sid, amp=1.1, slow=False):
    pts = np.asarray(pts, float)
    if amp <= 0:
        return pts
    return pts + rng(sid, slow).uniform(-1, 1, pts.shape) * px(amp)


def spath(pts, closed=True):
    pts = np.asarray(pts, float)
    p = skia.Path()
    n = len(pts)
    if n < 3:
        p.moveTo(*map(float, pts[0]))
        for q in pts[1:]:
            p.lineTo(*map(float, q))
        return p
    if closed:
        P = pts
        p.moveTo(*map(float, P[0]))
        for i in range(n):
            p0, p1, p2, p3 = P[i - 1], P[i], P[(i + 1) % n], P[(i + 2) % n]
            c1 = p1 + (p2 - p0) / 6
            c2 = p2 - (p3 - p1) / 6
            p.cubicTo(float(c1[0]), float(c1[1]), float(c2[0]), float(c2[1]), float(p2[0]), float(p2[1]))
        p.close()
    else:
        P = np.vstack([pts[0], pts, pts[-1]])
        p.moveTo(*map(float, pts[0]))
        for i in range(1, n):
            p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
            c1 = p1 + (p2 - p0) / 6
            c2 = p2 - (p3 - p1) / 6
            p.cubicTo(float(c1[0]), float(c1[1]), float(c2[0]), float(c2[1]), float(p2[0]), float(p2[1]))
    return p


def fillp(c, a=1.0, blur=0.0):
    p = skia.Paint(AntiAlias=True, Color=col(c, a))
    if blur > 0:
        p.setMaskFilter(skia.MaskFilter.MakeBlur(skia.kNormal_BlurStyle, px(blur)))
    return p


def strokep(w, c=INK, a=1.0, rough=0.7, seed=0, raw=False):
    p = skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style,
                   StrokeWidth=(w if raw else lw(w)), Color=col(c, a),
                   StrokeCap=skia.Paint.kRound_Cap, StrokeJoin=skia.Paint.kRound_Join)
    if rough > 0:
        p.setPathEffect(skia.DiscretePathEffect.Make(px(7), px(rough), seed % 100000))
    return p


def outline(cv, path, w=2.2, a=0.92, sid=0, color=INK):
    cv.drawPath(path, strokep(w, color, a, seed=sid * 7 + G['bs']))
    cv.save()
    cv.translate(px(0.8), px(-0.5))
    cv.drawPath(path, strokep(w * 0.45, color, a * 0.45, rough=1.0, seed=sid * 13 + G['bs'] + 3))
    cv.restore()


def hatch(cv, path, angle=35, spacing=7, color=INK, a=0.3, w=1.0, clip=None, sid=0, slow=False):
    cv.save()
    cv.clipPath(path, skia.ClipOp.kIntersect, True)
    if clip is not None:
        cv.clipPath(clip, skia.ClipOp.kIntersect, True)
    b = path.getBounds()
    cx_, cy_ = b.centerX(), b.centerY()
    r = math.hypot(b.width(), b.height()) / 2 + 2
    sp = max(px(spacing), 2 * r / 260)
    n = int(2 * r / sp) + 1
    ang = math.radians(angle)
    dx, dy = math.cos(ang), math.sin(ang)
    nx, ny = -dy, dx
    jit = rng(sid + 99, slow).uniform(-0.3, 0.3, n) * sp
    p = skia.Path()
    for i in range(n):
        o = -r + i * sp + jit[i]
        x0, y0 = cx_ + nx * o, cy_ + ny * o
        p.moveTo(x0 - dx * r, y0 - dy * r)
        p.lineTo(x0 + dx * r, y0 + dy * r)
    cv.drawPath(p, strokep(w, color, a, rough=0.8, seed=sid + G['bs']))
    cv.restore()


def crayon(cv, path, color, a=0.25, n=60, w=3.0, sid=0, length=14, angle=0, spread=25):
    """Pastel crayon strokes inside a shape (texture)."""
    cv.save()
    cv.clipPath(path, skia.ClipOp.kIntersect, True)
    b = path.getBounds()
    r = np.random.default_rng(sid * 977 + 5)
    xs = r.uniform(b.left(), b.right(), n)
    ys = r.uniform(b.top(), b.bottom(), n)
    angs = np.radians(angle + r.uniform(-spread, spread, n))
    L = r.uniform(0.5, 1.2, n) * length
    p = skia.Path()
    for x, y, an, l in zip(xs, ys, angs, L):
        p.moveTo(float(x), float(y))
        p.lineTo(float(x + math.cos(an) * l), float(y + math.sin(an) * l))
    cv.drawPath(p, strokep(w, color, a, rough=1.2, seed=sid, raw=True))
    cv.restore()


def shape(cv, pts, fill=None, w=2.2, sid=0, closed=True, amp=1.1, slow=False,
          misreg=1.4, fa=1.0, oa=0.92, hatch_kw=None, ocolor=INK):
    q = wob(pts, sid, amp, slow)
    path = spath(q, closed)
    if fill is not None and closed:
        cv.save()
        cv.translate(px(misreg), px(misreg * 0.6))
        cv.drawPath(path, fillp(fill, fa))
        cv.restore()
    if hatch_kw:
        hatch(cv, path, sid=sid, slow=slow, **hatch_kw)
    if w > 0:
        outline(cv, path, w, oa, sid, ocolor)
    return path


def ellipse_pts(cx, cy, rx, ry, n=18, rot=0.0, egg=0.0, lump=0.0, seed=0):
    a = np.linspace(0, 2 * np.pi, n, endpoint=False)
    rr = np.ones(n)
    if lump:
        rr = rr + np.random.default_rng(seed).uniform(-lump, lump, n)
    x = np.cos(a) * rx * rr
    y = np.sin(a) * ry * rr
    x = x * (1 + egg * (-np.sin(a)))  # wider at top when egg>0
    cr, sr = math.cos(rot), math.sin(rot)
    return np.stack([cx + x * cr - y * sr, cy + x * sr + y * cr], 1)


def limb(cv, pts, w, color, sid, alpha=1.0):
    path = spath(wob(pts, sid, 0.6), closed=False)
    cv.drawPath(path, skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=w + px(2.6),
                                 Color=col(INK, 0.9 * alpha), StrokeCap=skia.Paint.kRound_Cap,
                                 StrokeJoin=skia.Paint.kRound_Join,
                                 PathEffect=skia.DiscretePathEffect.Make(px(6), px(0.6), sid + G['bs'])))
    cv.drawPath(path, skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=w,
                                 Color=col(color, alpha), StrokeCap=skia.Paint.kRound_Cap,
                                 StrokeJoin=skia.Paint.kRound_Join))


def ik(a, b, l1, l2, flip=1.0):
    a = np.asarray(a, float)
    b = np.asarray(b, float)
    d = b - a
    D = float(np.hypot(*d))
    if D < 1e-6:
        return a + np.array([0, l1]), b
    u = d / D
    L = min(D, l1 + l2 - 1e-3)
    x = (l1 * l1 - l2 * l2 + L * L) / (2 * L)
    h = math.sqrt(max(0.0, l1 * l1 - x * x))
    n = np.array([-u[1], u[0]])
    knee = a + u * x - n * h * flip
    end = a + u * L
    return knee, end


# ---------------------------------------------------------------- characters
MAIN = dict(robe=TURQ, skin=SKIN, eye='yellow', leg=40, T=44, neck=16, hrx=17, hry=21,
            arm=17, collar=True, hat=None, limbw=3.4, hem=24)
FIG_A = dict(robe=DPINK, skin=hx('#c88f73'), eye='white', leg=34, T=36, neck=9, hrx=13, hry=15,
             arm=15, collar=False, hat='cone', limbw=3.0, hem=20)
FIG_B = dict(robe=FORANGE, skin=hx('#b98468'), eye='white', leg=44, T=38, neck=28, hrx=11, hry=16,
             arm=18, collar=False, hat=None, limbw=2.8, hem=17)
FIG_C = dict(robe=TURQ_L, skin=hx('#d39a7a'), eye='white', leg=24, T=28, neck=6, hrx=15, hry=14,
             arm=12, collar=True, hat='bobble', limbw=2.8, hem=16)


def new_pose(style, x, y=0.0, s=1.0, face=1):
    return dict(style=style, x=x, y=y, s=s, face=face, alpha=1.0, stoop=0.0, droop=0.0, kb=0.0,
                sit=0.0, phase=0.0, amp=0.0, bounce=0.0, tryfoot=0.0, tremble=0.0, lid=0.4,
                look=(1.0, 0.0), blink=0.0, burden=None, sack=None, arms=None, theta_add=0.0,
                sid=1, hop=0.0, smile=0.0)


def rig(P):
    st = P['style']
    t = G['tq']
    L = st['leg']
    amp, ph = P['amp'], P['phase']
    hop = P['hop']
    P['Mp'] = Tm(P['x'], P['y'] - hop) @ Sm(P['s'] * P['face'], P['s'])
    bob = amp * (2.6 + 3 * P['bounce']) * abs(math.sin(ph)) - P['bounce'] * amp * 4 * abs(math.cos(ph))
    hip = np.array([0.0, -L + bob + P['kb'] * 17])
    trem = P['tremble']
    if trem:
        hip = hip + np.array([math.sin(t * 47) * 0.6, math.sin(t * 61 + 1) * 0.5]) * trem
    sitpos = np.array([-4.0, -7.0])
    hip = mix(hip, sitpos, P['sit'])
    feet = []
    for i, off in enumerate([0.0, math.pi]):
        p = ph + off
        fx = 13 * amp * math.sin(p) + (2.5 if i == 0 else -2.5)
        lift = 5 * amp * max(0.0, math.cos(p))
        f = np.array([fx, -lift])
        if i == 0 and P['tryfoot'] > 0:
            tf = P['tryfoot']
            f = f + np.array([7 * tf, -6 * tf + math.sin(t * 38) * 0.8 * tf])
        sit_f = np.array([22.0, 0.0]) if i == 0 else np.array([17.0, 0.5])
        feet.append(mix(f, sit_f, P['sit']))
    P['hip'], P['feet'] = hip, feet
    theta = P['stoop'] * 50 + P['theta_add']
    theta = mix(theta, 30.0 + P['theta_add'], P['sit'])
    P['theta'] = theta
    P['Mt'] = P['Mp'] @ Tm(*hip) @ Rm(theta)
    neckang = -P['stoop'] * 40 + P['droop'] * 35
    neckang = mix(neckang, P['droop'] * 52, P['sit'])
    P['Mn'] = P['Mt'] @ Tm(0, -st['T']) @ Rm(neckang)
    P['Mh'] = P['Mn'] @ Tm(0, -st['neck']) @ Rm(P['droop'] * 8) @ Tm(0, -st['hry'] * 0.82)
    return P


def w2t(P, wp):
    return inv_ap(P['Mt'], wp)


def p2t(P, pp):
    return inv_ap(P['Mt'], ap(P['Mp'], pp))


def burden_M(P):
    R = P['burden']['R']
    st = P['style']
    return P['Mt'] @ Tm(-R * 1.0, -st['T'] * 0.45 - R * 0.25)


def draw_burden(cv, M, R, dark=0.0, squash=1.0, alpha=1.0, sid=500):
    setM(cv, G['cam'] @ M @ Sm(1 / squash ** 0.5, squash))
    pts = ellipse_pts(0, 0, R, R * 0.93, n=16, lump=0.06, seed=7)
    c = mix(BURDEN, hx('#151925'), dark)
    path = shape(cv, pts, fill=c, w=2.6, sid=sid, fa=alpha)
    crayon(cv, path, mix(c, TURQ, 0.5), a=0.32 * alpha, n=160, w=px(5), sid=sid, length=R * 0.3, angle=-35, spread=50)
    crayon(cv, path, mix(c, DPINK, 0.35), a=0.18 * alpha, n=60, w=px(4), sid=sid + 1, length=R * 0.2, angle=20, spread=40)
    hatch(cv, path, angle=-40, spacing=5, color=hx('#0d0f16'), a=0.5 * alpha, w=1.0, sid=sid,
          clip=spath(ellipse_pts(-R * 0.35, R * 0.3, R * 0.9, R * 0.8)))
    # rim light from the sky
    rim = skia.Path()
    rim.addArc(skia.Rect.MakeLTRB(-R * 0.92, -R * 0.86, R * 0.92, R * 0.86), -150, 95)
    cv.drawPath(rim, strokep(2.2, mix(TURQ_L, PINK, 0.3), 0.55 * alpha, rough=1.2, seed=sid + G['bs']))
    # a few swirling marks: the weight has an inside
    sw = skia.Path()
    for k in range(3):
        a0 = k * 2.1 + 0.4
        rr = R * (0.35 + 0.15 * k)
        sw.addArc(skia.Rect.MakeLTRB(-rr * 0.7 + 8, -rr + 4, rr * 0.7 + 8, rr + 4), math.degrees(a0), 70)
    cv.drawPath(sw, strokep(1.2, mix(c, PAPER, 0.25), 0.35 * alpha, rough=1.0, seed=sid + 3 + G['bs']))


def draw_straps(cv, P):
    st = P['style']
    R = P['burden']['R']
    setM(cv, G['cam'] @ P['Mt'])
    bc = np.array([-R * 1.0, -st['T'] * 0.45 - R * 0.25])
    rope = hx('#9a6b45')
    for a, b, m in [((5, -st['T'] + 6), bc + np.array([R * 0.55, -R * 0.62]), (14, -st['T'] - 14)),
                    ((-4, 4), bc + np.array([R * 0.72, R * 0.45]), (-2, 14))]:
        pts = np.array([a, m, b], float)
        path = spath(wob(pts, P['sid'] * 50 + int(a[0]), 0.6), closed=False)
        cv.drawPath(path, strokep(4.2, INK, 0.85, rough=0.5, seed=G['bs']))
        cv.drawPath(path, strokep(2.4, rope, 1.0, rough=0.4, seed=G['bs'] + 1))


def draw_leg(cv, P, i, shade):
    st = P['style']
    setM(cv, G['cam'] @ P['Mp'])
    hip = P['hip'] + np.array([2.5 if i == 0 else -2.5, 0])
    foot = P['feet'][i]
    knee, end = ik(hip, foot, st['leg'] / 2, st['leg'] / 2, 1.0)
    c = mix(st['skin'], INK, shade)
    limb(cv, [hip, knee, end], st['limbw'], c, P['sid'] * 10 + i, P['alpha'])
    # small pointed foot
    fp = np.array([[end[0] - 2, end[1] - 1.2], [end[0] + 6, end[1] - 0.6], [end[0] + 6.5, end[1] + 0.8],
                   [end[0] - 2.5, end[1] + 1.0]])
    shape(cv, fp, fill=c, w=1.4, sid=P['sid'] * 10 + 5 + i, amp=0.4, fa=P['alpha'], oa=0.9 * P['alpha'], misreg=0.3)
    return knee


def default_arms(P):
    st = P['style']
    return [(6.0, -6.0), (2.0, -6.0)]


def draw_arm(cv, P, i, target, shade):
    st = P['style']
    setM(cv, G['cam'] @ P['Mt'])
    sh = np.array([3.0 if i == 0 else -2.0, -st['T'] + 6])
    el, hand = ik(sh, target, st['arm'], st['arm'], -1.0)
    c = mix(st['skin'], INK, shade)
    limb(cv, [sh, el, hand], st['limbw'] * 0.9, c, P['sid'] * 20 + i, P['alpha'])
    # hand with long thin fingers (Velun)
    d = hand - el
    d = d / (np.hypot(*d) + 1e-6)
    base = math.atan2(d[1], d[0])
    fp = skia.Path()
    for k, sp in enumerate([-0.55, -0.18, 0.18, 0.5]):
        a = base + sp
        Lf = 7.5 + (1.5 if k in (1, 2) else 0)
        q = hand + np.array([math.cos(a), math.sin(a)]) * Lf
        mid = hand + np.array([math.cos(a - 0.15), math.sin(a - 0.15)]) * Lf * 0.55
        fp.moveTo(*map(float, hand))
        fp.quadTo(float(mid[0]), float(mid[1]), float(q[0]), float(q[1]))
    cv.drawPath(fp, strokep(1.2, INK, 0.85 * P['alpha'], rough=0.3, seed=G['bs'] + i))
    shape(cv, ellipse_pts(hand[0], hand[1], 2.6, 2.2, n=8), fill=c, w=1.2, sid=P['sid'] * 20 + 7 + i,
          amp=0.3, misreg=0.3, fa=P['alpha'], oa=0.85 * P['alpha'])
    return hand


def draw_robe(cv, P):
    st = P['style']
    setM(cv, G['cam'] @ P['Mt'])
    T, hm = st['T'], st['hem']
    sway = math.sin(P['phase']) * 2.0 * P['amp']
    pts = np.array([[-8, -T + 1], [0, -T - 1.5], [8, -T + 1], [12, -T * 0.55], [hm * 0.8, -T * 0.05],
                    [hm + sway, 13], [hm * 0.5 + sway, 15.5], [0 + sway, 14], [-hm * 0.5 + sway, 15.5],
                    [-hm + sway, 13], [-hm * 0.8, -T * 0.05], [-12, -T * 0.55]], float)
    sid = P['sid'] * 30
    path = shape(cv, pts, fill=st['robe'], w=2.3, sid=sid, fa=P['alpha'], oa=0.92 * P['alpha'])
    crayon(cv, path, mix(st['robe'], PAPER, 0.35), a=0.25 * P['alpha'], n=40, w=px(3), sid=sid, length=10, angle=80, spread=10)
    back = spath(np.array([[-40, -T - 5], [-1, -T - 5], [1 + sway, 20], [-40, 20]]))
    hatch(cv, path, angle=55, spacing=5.5, color=INK, a=0.3 * P['alpha'], w=0.9, clip=back, sid=sid)
    # folds
    fp = skia.Path()
    for fx in (-0.45, 0.05, 0.5):
        fp.moveTo(fx * 9, -T * 0.6)
        fp.quadTo(fx * hm * 0.9, 0, fx * hm * 1.02 + sway, 13.5)
    cv.drawPath(fp, strokep(1.1, INK, 0.6 * P['alpha'], rough=0.6, seed=sid + G['bs']))
    if st['collar']:
        for k in range(5):
            cx_ = -9 + k * 4.5
            cy_ = -T - 1 + abs(k - 2) * 0.6
            shape(cv, ellipse_pts(cx_, cy_ + 1.5, 3.0, 2.8, n=8), fill=PAPER, w=1.1, sid=sid + 40 + k,
                  amp=0.25, misreg=0.3, fa=P['alpha'], oa=0.85 * P['alpha'])


def draw_neck(cv, P):
    st = P['style']
    setM(cv, G['cam'] @ P['Mn'])
    nl = st['neck']
    w = 4.2 if st is MAIN else 3.2
    pts = np.array([[-w, 1], [-w * 0.9, -nl - 2], [w * 0.9, -nl - 2], [w, 1]])
    path = shape(cv, pts, fill=mix(st['skin'], INK, 0.08), w=1.6, sid=P['sid'] * 40, closed=True, amp=0.3,
                 misreg=0.3, fa=P['alpha'], oa=0.85 * P['alpha'])
    if st is MAIN:
        rp = skia.Path()
        for k in range(1, 4):
            y = -k * nl / 4
            rp.moveTo(-w * 0.9, y)
            rp.quadTo(0, y + 1.2, w * 0.9, y)
        cv.drawPath(rp, strokep(1.0, INK, 0.7 * P['alpha'], rough=0.3, seed=G['bs']))


def draw_head(cv, P):
    st = P['style']
    a = P['alpha']
    setM(cv, G['cam'] @ P['Mh'])
    rx, ry = st['hrx'], st['hry']
    sid = P['sid'] * 60
    hp = shape(cv, ellipse_pts(0, 0, rx, ry, n=16, egg=0.06), fill=st['skin'], w=2.3, sid=sid, fa=a, oa=0.92 * a)
    hatch(cv, hp, angle=60, spacing=4.5, color=INK, a=0.28 * a, w=0.8,
          clip=spath(ellipse_pts(-rx * 1.25, 2, rx * 0.65, ry * 1.3)), sid=sid)
    # ear antenna (Velun) on the back side of the head
    if st is MAIN:
        ep = spath(wob(np.array([[-rx + 1, 2], [-rx - 4, 8], [-rx - 3.5, 15]]), sid + 3, 0.3), closed=False)
        cv.drawPath(ep, strokep(1.2, INK, 0.9 * a, rough=0.2, seed=G['bs']))
        shape(cv, ellipse_pts(-rx - 3.5, 16.2, 1.6, 1.6, n=6), fill=hx('#c9785a'), w=1.0, sid=sid + 4, amp=0.2,
              misreg=0.2, fa=a, oa=0.9 * a)
        fp = skia.Path()
        fp.moveTo(-6, -ry * 0.62)
        fp.quadTo(3, -ry * 0.68, 11, -ry * 0.6)
        fp.moveTo(-5, -ry * 0.5)
        fp.quadTo(3, -ry * 0.55, 10, -ry * 0.48)
        cv.drawPath(fp, strokep(0.9, INK, 0.55 * a, rough=0.3, seed=G['bs']))
        shape(cv, ellipse_pts(3, -ry * 0.86, 2.2, 0.9, n=8), fill=hx('#c9785a'), w=0.8, sid=sid + 6, amp=0.1,
              misreg=0.1, fa=a, oa=0.8 * a)
    if st['hat'] == 'cone':
        shape(cv, np.array([[-rx * 0.9, -ry * 0.55], [2, -ry * 2.6], [rx * 0.9, -ry * 0.55], [0, -ry * 0.45]]),
              fill=NAVY, w=1.8, sid=sid + 8, fa=a, oa=0.9 * a)
    if st['hat'] == 'bobble':
        shape(cv, ellipse_pts(0, -ry * 0.75, rx * 0.8, ry * 0.4, n=10), fill=ORANGE, w=1.6, sid=sid + 8, fa=a, oa=0.9 * a)
        shape(cv, ellipse_pts(1, -ry * 1.25, 3, 3, n=8), fill=PAPER, w=1.2, sid=sid + 9, fa=a, oa=0.9 * a)
    # eyes (3/4 view, facing +x)
    lid = clamp(max(P['lid'], P['blink']))
    lx, ly = P['look']
    if st['eye'] == 'yellow':
        eyes = [(-3.0, 1.5, 6.8, 7.8), (10.0, 1.5, 5.0, 7.2)]
    else:
        eyes = [(1.0, 1.0, 3.2, 3.6), (8.5, 1.0, 2.6, 3.3)]
    for k, (ex, ey, erx, ery) in enumerate(eyes):
        ept = ellipse_pts(ex, ey, erx, ery, n=12)
        epath = spath(wob(ept, sid + 20 + k, 0.25))
        if st['eye'] == 'yellow':
            shader = skia.GradientShader.MakeRadial(skia.Point(ex - erx * 0.2, ey - ery * 0.3), erx * 1.3,
                                                    [col(YEL1, a), col(YEL2, a)])
            cv.drawPath(epath, skia.Paint(AntiAlias=True, Shader=shader))
            ring = skia.Path()
            ring.addOval(skia.Rect.MakeXYWH(ex - erx * 0.62 + lx * 1.2, ey - ery * 0.6, erx * 1.2, ery * 1.25))
            cv.drawPath(ring, strokep(0.7, hx('#b8860b'), 0.5 * a, rough=0.3, seed=G['bs']))
        else:
            cv.drawPath(epath, fillp(hx('#f1e8d6'), a))
        # pupil
        pr = 1.15 if st['eye'] == 'yellow' else 0.95
        pxp = ex + lx * erx * 0.45
        pyp = ey + ly * ery * 0.4 + lid * ery * 0.3
        cv.save()
        cv.clipPath(epath, skia.ClipOp.kIntersect, True)
        cv.drawCircle(pxp, pyp, pr, fillp(INK, a))
        cv.drawCircle(pxp - pr * 0.35, pyp - pr * 0.35, pr * 0.3, fillp(PAPER, 0.8 * a))
        # eyelid: heavy, skin coloured, lowered by exhaustion
        if lid > 0.02:
            ytop = ey - ery - 1
            ylid = ey - ery + 2 * ery * lid
            lp = skia.Path()
            lp.moveTo(ex - erx - 2, ytop)
            lp.lineTo(ex + erx + 2, ytop)
            lp.lineTo(ex + erx + 2, ylid - 1)
            lp.quadTo(ex, ylid + 1.8, ex - erx - 2, ylid - 1)
            lp.close()
            cv.drawPath(lp, fillp(mix(st['skin'], INK, 0.12), a))
            hatch(cv, lp, angle=40, spacing=2.6, color=INK, a=0.3 * a, w=0.6, sid=sid + 30 + k)
            ln = skia.Path()
            ln.moveTo(ex - erx - 1, ylid - 1)
            ln.quadTo(ex, ylid + 1.8, ex + erx + 1, ylid - 1)
            cv.drawPath(ln, strokep(1.3, INK, 0.9 * a, rough=0.2, seed=G['bs'] + k))
        cv.restore()
        cv.drawPath(epath, strokep(1.6, INK, 0.92 * a, rough=0.3, seed=sid + k + G['bs']))
    # nose dots and small mouth
    if st['eye'] == 'yellow':
        cv.drawCircle(5.5, 11.0, 0.8, fillp(INK, 0.9 * a))
        cv.drawCircle(8.3, 11.2, 0.75, fillp(INK, 0.9 * a))
        m = skia.Path()
        sm = P['smile']
        m.moveTo(3.2, 15.5)
        m.quadTo(6.5, 15.5 + 1.2 * sm - 0.5 * (1 - sm), 9.6, 15.3)
        cv.drawPath(m, strokep(1.0, INK, 0.8 * a, rough=0.2, seed=G['bs']))
    else:
        m = skia.Path()
        m.moveTo(3, 7)
        m.quadTo(5.5, 7 + 1.5 * P['smile'], 8, 6.8)
        cv.drawPath(m, strokep(0.9, INK, 0.8 * a, rough=0.2, seed=G['bs']))


def draw_sack(cv, M, alpha=1.0, sid=700):
    setM(cv, G['cam'] @ M)
    pts = np.array([[-11, 2], [-10, -7], [-4, -11], [0, -13], [4, -11], [10, -7], [11, 3], [7, 9], [-7, 9]])
    path = shape(cv, pts, fill=ORANGE, w=2.0, sid=sid, fa=alpha, oa=0.9 * alpha)
    hatch(cv, path, angle=-30, spacing=4, color=INK, a=0.25 * alpha, w=0.8, sid=sid,
          clip=spath(np.array([[0, -20], [20, -20], [20, 20], [0, 20]])))
    shape(cv, np.array([[-3, -13], [0, -17], [3, -13]]), fill=None, w=1.6, sid=sid + 1, closed=False)


def draw_person(cv, P, under=None):
    """Draw a rigged person. 'under' is a callback drawn after the far limbs (burden, sack)."""
    rig(P)
    st = P['style']
    arms = P['arms'] or default_arms(P)
    # ground shadow
    if P['y'] > -200:
        setM(cv, G['cam'] @ Tm(P['x'], P['y'] + 1) @ Sm(P['s']))
        cv.drawOval(skia.Rect.MakeXYWH(-24, -3, 50, 6), fillp(hx('#5a3d36'), 0.22 * P['alpha'], blur=3))
    draw_arm(cv, P, 1, arms[1], 0.28)
    draw_leg(cv, P, 1, 0.3)
    if P['burden'] is not None:
        draw_burden(cv, burden_M(P), P['burden']['R'], P['burden'].get('dark', 0.0))
    if under:
        under(cv, P)
    if P['sit'] < 0.5:
        draw_leg(cv, P, 0, 0.0)
    draw_robe(cv, P)
    if P['sit'] >= 0.5:
        draw_leg(cv, P, 0, 0.0)
    if P['burden'] is not None:
        draw_straps(cv, P)
    draw_neck(cv, P)
    draw_head(cv, P)
    hand = draw_arm(cv, P, 0, arms[0], 0.0)
    return P


# ---------------------------------------------------------------- props
def draw_letter(cv, M, alpha, sid=800):
    setM(cv, G['cam'] @ M)
    pts = np.array([[-11, -14], [11, -15], [12, 14], [-10, 15]], float)
    path = shape(cv, pts, fill=hx('#f1e7d2'), w=1.6, sid=sid, fa=alpha, oa=0.9 * alpha, amp=0.4)
    lp = skia.Path()
    for k in range(5):
        y = -9 + k * 4.2
        x1 = 8 if k < 4 else -2
        lp.moveTo(-7, y)
        xs = np.linspace(-7, x1, 7)
        for j, xx in enumerate(xs[1:]):
            lp.lineTo(float(xx), y + math.sin(j * 2.3 + k) * 0.7)
    cv.drawPath(lp, strokep(0.8, hx('#3d4a6a'), 0.75 * alpha, rough=0.5, seed=G['bs']))
    # the pen stroke stops mid-word
    cv.drawCircle(-1.5, 8.2, 0.9, fillp(hx('#3d4a6a'), 0.8 * alpha))


def draw_clock(cv, M, alpha, t, sid=820):
    setM(cv, G['cam'] @ M)
    path = shape(cv, ellipse_pts(0, 0, 13, 13, n=14), fill=hx('#efe3c4'), w=2.0, sid=sid, fa=alpha, oa=0.9 * alpha)
    shape(cv, ellipse_pts(0, 0, 15.5, 15.5, n=14), fill=None, w=2.4, sid=sid + 1, oa=0.85 * alpha)
    tk = skia.Path()
    for k in range(12):
        a = k * math.pi / 6
        tk.moveTo(math.cos(a) * 10, math.sin(a) * 10)
        tk.lineTo(math.cos(a) * 11.8, math.sin(a) * 11.8)
    cv.drawPath(tk, strokep(0.9, INK, 0.7 * alpha, rough=0.2, seed=G['bs']))
    # broken: the minute hand jerks back and forth
    j = math.floor(t * 2.0)
    mh = -90 + (j % 3) * 6 - (j % 2) * 9
    hh = 40 + math.sin(j * 1.7) * 4
    hp = skia.Path()
    for ang, L in ((mh, 9.5), (hh, 6)):
        r = math.radians(ang)
        hp.moveTo(0, 0)
        hp.lineTo(math.cos(r) * L, math.sin(r) * L)
    cv.drawPath(hp, strokep(1.4, INK, 0.9 * alpha, rough=0.2, seed=G['bs']))
    cr = spath(np.array([[-9, -8], [-4, -3], [-6, 1], [-1, 4], [-2, 9]]), closed=False)
    cv.drawPath(cr, strokep(1.0, INK, 0.85 * alpha, rough=0.6, seed=G['bs'] + 4))


def draw_flower(cv, M, alpha, fade, petals=5, sid=840):
    setM(cv, G['cam'] @ M)
    stem = spath(np.array([[0, 20], [1, 8], [3, -2], [7, -9]]), closed=False)
    cv.drawPath(stem, strokep(1.8, mix(hx('#6b7d4f'), hx('#8c8270'), fade), 0.95 * alpha, rough=0.4, seed=G['bs']))
    shape(cv, ellipse_pts(-3, 7, 5, 2, n=8, rot=-0.5), fill=mix(hx('#6b7d4f'), hx('#9c917c'), fade), w=1.0,
          sid=sid + 1, fa=alpha, oa=0.8 * alpha, amp=0.2)
    cx_, cy_ = 8, -11  # drooping head
    pc = mix(DPINK, hx('#a69c92'), fade)
    for k in range(petals):
        a = k * 2 * math.pi / 5 + 1.0
        shape(cv, ellipse_pts(cx_ + math.cos(a) * 4, cy_ + math.sin(a) * 4 + 1, 4.2, 2.6, n=8, rot=a), fill=pc,
              w=1.0, sid=sid + 5 + k, fa=alpha, oa=0.85 * alpha, amp=0.3, misreg=0.4)
    cv.drawCircle(cx_, cy_ + 1, 2.2, fillp(mix(ORANGE, hx('#8a7a6a'), fade), alpha))


def draw_chair(cv, M, alpha, sid=860):
    setM(cv, G['cam'] @ M)
    wood = hx('#a87452')
    seat = np.array([[-11, -14], [11, -14], [12, -11], [-12, -11]])
    shape(cv, seat, fill=wood, w=1.6, sid=sid, fa=alpha, oa=0.9 * alpha, amp=0.3)
    for k, (x0, x1) in enumerate([(-10, -11), (10, 11), (-6, -6.5), (6, 6.5)]):
        lp = spath(np.array([[x0, -11], [x1, 0]]), closed=False)
        cv.drawPath(lp, strokep(2.0 if k < 2 else 1.4, INK, 0.9 * alpha, rough=0.3, seed=G['bs'] + k))
    back = np.array([[-11, -14], [-12, -34], [-9, -36], [-8, -14]])
    shape(cv, back, fill=wood, w=1.5, sid=sid + 2, fa=alpha, oa=0.9 * alpha, amp=0.3)
    shape(cv, np.array([[-11, -30], [-2, -31], [-2, -27], [-11, -26]]), fill=mix(wood, PAPER, 0.2), w=1.2,
          sid=sid + 3, fa=alpha, oa=0.85 * alpha, amp=0.3)


# ---------------------------------------------------------------- camera
CAMK = [  # t, zoom, offset x (from character), center y
    (0.0, 1.12, 40, 0.75),
    (3.5, 1.40, 40, 0.75),
    (6.6, 1.83, 45, 0.74),
    (8.2, 2.17, 75, 0.72),
    (11.0, 2.22, 80, 0.72),
    (12.8, 2.38, 45, 0.76),
    (16.5, 2.62, 35, 0.78),
    (20.2, 2.99, 22, 0.78),
    (23.0, 3.78, 12, 0.76),
    (25.0, 4.33, 4, 0.76),
    (26.6, 4.70, 6, 0.69),
    (27.6, 5.61, 26, 0.63),
    (28.4, 6.10, 38, 0.57),
    (29.4, 5.61, 34, 0.59),
    (32.5, 3.29, 15, 0.74),
    (36.0, 1.96, -5, 0.80),
    (38.5, 1.68, -12, 0.80),
    (40.0, 1.64, -14, 0.80),
]
_ck = np.array(CAMK)
_cz = PchipInterpolator(_ck[:, 0], np.log(_ck[:, 1]))
_cox = PchipInterpolator(_ck[:, 0], _ck[:, 2])
_coy = PchipInterpolator(_ck[:, 0], _ck[:, 3])
XSTOP = charx(30.0)


def camera(t):
    z = float(np.exp(_cz(t)))
    # follow a softened character position
    xs = np.mean([charx(max(0, t - d)) for d in (0, 0.4, 0.8, 1.2)])
    cx = xs + float(_cox(t))
    cy = -(float(_coy(t)) * H - 960) / z
    # gentle hand-held drift
    cx += math.sin(t * 0.7) * 3 + math.sin(t * 1.3 + 1) * 1.5
    cy += math.sin(t * 0.9 + 2) * 2
    sx = sy = 0.0
    if SLIP[1] <= t < SLIP[1] + 0.5:
        k = (1 - (t - SLIP[1]) / 0.5) ** 2
        sx = math.sin(t * 90) * 9 * k
        sy = math.cos(t * 77) * 12 * k
    return z, cx, cy, sx, sy


# ---------------------------------------------------------------- environment
def warm(t):
    return ss(29.0, 36.0, t)


def draw_sky(cv, t, horizon_y):
    w_ = warm(t)
    dark = bump(t, 19.5, 24.0, 29.0) * 0.35
    top = mix(mix(NAVY, hx('#3a4562'), w_), hx('#1c2233'), dark)
    mid = mix(mix(hx('#5d7f84'), hx('#7d9c9a'), w_), hx('#4b6066'), dark)
    pink = mix(mix(hx('#c9a3a0'), hx('#ddb7aa'), w_), hx('#a88a8a'), dark)
    org = mix(mix(FORANGE, hx('#ecc094'), w_), hx('#c09070'), dark)
    cv.resetMatrix()
    G['k'] = 1.0
    shader = skia.GradientShader.MakeLinear(
        [skia.Point(0, horizon_y - 1900), skia.Point(0, horizon_y + 40)],
        [col(top), col(mid), col(pink), col(org)], [0.0, 0.45, 0.78, 1.0])
    cv.drawRect(skia.Rect.MakeWH(W, H), skia.Paint(Shader=shader))
    # soft glow (stronger at the end)
    g = 0.25 + 0.45 * w_
    sh2 = skia.GradientShader.MakeRadial(skia.Point(W * 0.72, horizon_y - 260), 900,
                                         [col(hx('#f3d9b5'), g), col(hx('#f3d9b5'), 0)])
    cv.drawRect(skia.Rect.MakeWH(W, H), skia.Paint(Shader=sh2))


def layer_M(p, z, cx, horizon_screen, lift=0.0):
    zl = z ** p * 0.95
    base = 960 + (horizon_screen - 960) * (0.5 + 0.5 * p) - lift * zl
    return Tm(540, base) @ Sm(zl) @ Tm(-cx * p, 0)


def draw_moons_clouds(cv, t, z, cx, hs):
    M = layer_M(0.04, z, cx, hs, lift=0)
    a = 1.0
    # moons (Velun's two moons)
    setM(cv, Tm(0, 0) @ M)
    G['z'] = 1.0
    for (mx, my, r, sid) in [(-300, -980, 70, 901), (-205, -1070, 28, 902)]:
        p = shape(cv, ellipse_pts(mx, my + math.sin(t * 0.3 + sid) * 4, r, r, n=18), fill=hx('#ecd9ab'), w=2.0,
                  sid=sid, slow=True, fa=0.95)
        crayon(cv, p, hx('#f7ead0'), a=0.35, n=30, w=3, sid=sid, length=r * 0.4)
    # long drifting clouds
    for k, (y0, L, sp, c) in enumerate([(-900, 520, 6, PINK), (-640, 380, 9, hx('#e8c3a6')),
                                         (-1450, 600, 4, hx('#9fb5b0'))]):
        x0 = ((k * 700 + t * sp) % 2400) - 1200 + cx * 0.04
        pts = np.array([[x0 - L / 2, y0], [x0 - L * 0.2, y0 - 26], [x0 + L * 0.15, y0 - 34], [x0 + L / 2, y0 - 6],
                        [x0 + L * 0.2, y0 + 10], [x0 - L * 0.25, y0 + 8]])
        path = spath(wob(pts, 910 + k, 1.0, slow=True))
        cv.drawPath(path, fillp(c, 0.55, blur=4))
        outline(cv, path, 1.2, 0.35, 910 + k)
    # floating stones
    for k, (sx, sy, r) in enumerate([(380, -760, 22), (470, -840, 11), (-470, -560, 15)]):
        yy = sy + math.sin(t * 0.8 + k * 2) * 10
        p = shape(cv, ellipse_pts(sx, yy, r * 1.3, r * 0.8, n=10, lump=0.15, seed=k), fill=hx('#7a7f86'), w=1.8,
                  sid=920 + k, slow=True)
        hatch(cv, p, angle=-30, spacing=4, a=0.3, w=0.8, sid=920 + k, slow=True,
              clip=spath(ellipse_pts(sx, yy + r * 0.5, r * 1.5, r * 0.6)))


def draw_far(cv, t, z, cx, hs):
    M = layer_M(0.15, z, cx, hs)
    setM(cv, M)
    G['z'] = 1.0
    w_ = warm(t)
    xs = np.linspace(-2600, 2600, 40)
    ys = -40 - 50 * np.sin(xs / 310) ** 2 - 30 * np.sin(xs / 140 + 1) ** 2
    pts = np.vstack([np.stack([xs, ys], 1), [[2600, 3000], [-2600, 3000]]])
    c = mix(hx('#5f7a80'), hx('#7f9694'), w_)
    p = shape(cv, pts, fill=c, w=1.8, sid=930, slow=True, oa=0.7)
    crayon(cv, p, mix(c, PAPER, 0.25), a=0.25, n=160, w=px(3.5), sid=930, length=30, angle=0, spread=8)
    # lonely door frame standing in the distance
    for (dx, sc) in [(520, 1.0)]:
        door = np.array([[dx - 40, 0], [dx - 40, -190], [dx + 40, -190], [dx + 40, 0], [dx + 26, 0],
                         [dx + 26, -176], [dx - 26, -176], [dx - 26, 0]])
        shape(cv, door, fill=hx('#3d4a5e'), w=1.8, sid=931, slow=True, amp=0.8)
        inner = np.array([[dx - 26, 0], [dx - 26, -176], [dx + 26, -176], [dx + 26, 0]])
        cv.drawPath(spath(inner), fillp(hx('#f0cfa8'), 0.35 + 0.25 * w_))
    # thin pillars with balanced stones
    for k, (px_, h) in enumerate([(-640, 260), (-560, 180), (980, 300)]):
        pil = np.array([[px_ - 7, 0], [px_ - 4, -h], [px_ + 4, -h], [px_ + 7, 0]])
        shape(cv, pil, fill=hx('#4b5a6a'), w=1.6, sid=940 + k, slow=True)
        shape(cv, ellipse_pts(px_ + 3, -h - 14, 20, 13, n=10, lump=0.12, seed=k), fill=hx('#56657a'), w=1.6,
              sid=945 + k, slow=True)


def draw_mid(cv, t, z, cx, hs):
    M = layer_M(0.45, z, cx, hs)
    setM(cv, M)
    G['z'] = 1.0
    w_ = warm(t)
    xs = np.linspace(-2400, 2400, 34)
    ys = -6 - 26 * np.sin(xs / 230 + 0.5) ** 2 - 14 * np.sin(xs / 97) ** 2
    pts = np.vstack([np.stack([xs, ys], 1), [[2400, 3000], [-2400, 3000]]])
    c = mix(hx('#c79a8a'), hx('#d6ab98'), w_)
    p = shape(cv, pts, fill=c, w=2.0, sid=950, slow=True, oa=0.8)
    crayon(cv, p, mix(c, FORANGE, 0.4), a=0.28, n=200, w=px(3.5), sid=950, length=26, angle=-5, spread=10)
    hatch(cv, p, angle=20, spacing=9, a=0.12, w=0.8, sid=950, slow=True)
    # odd lollipop trees and a staircase to nowhere
    for k, (tx, h, r) in enumerate([(-420, 150, 30), (-330, 95, 18), (300, 170, 26), (760, 120, 22)]):
        sway = math.sin(t * 0.9 + k) * 3
        tp = spath(wob(np.array([[tx, -10], [tx + 2, -h * 0.5], [tx + sway, -h]]), 960 + k, 0.6, True), closed=False)
        cv.drawPath(tp, strokep(2.4, INK, 0.85, rough=0.6, seed=960 + k))
        pc = shape(cv, ellipse_pts(tx + sway, -h - r * 0.8, r, r * 1.15, n=12, lump=0.08, seed=k),
                   fill=mix(TURQ, NAVY, 0.25), w=1.8, sid=965 + k, slow=True)
        hatch(cv, pc, angle=50, spacing=4.5, a=0.3, w=0.8, sid=965 + k, slow=True,
              clip=spath(ellipse_pts(tx + sway - r * 0.6, -h - r * 0.5, r, r * 1.4)))
    sx = 120
    st_pts = [[sx, -8]]
    for i in range(6):
        st_pts += [[sx + i * 16, -8 - (i + 1) * 16], [sx + (i + 1) * 16, -8 - (i + 1) * 16]]
    st_pts += [[sx + 96, -8]]
    shape(cv, np.array(st_pts), fill=hx('#b07d68'), w=1.8, sid=970, slow=True, amp=0.6)


ROCKS = None


def draw_ground(cv, t, cam):
    global ROCKS
    setM(cv, cam)
    w_ = warm(t)
    z = G['z']
    x0 = -540 / z - 400 + G['cx']
    x1 = 540 / z + 400 + G['cx']
    xs = np.linspace(x0, x1, 26)
    ys = HORIZ + 4 * np.sin(xs / 60) + 3 * np.sin(xs / 23 + 1)
    pts = np.vstack([np.stack([xs, ys], 1), [[x1, 4000], [x0, 4000]]])
    c = mix(SAND, hx('#dfbca6'), w_)
    p = shape(cv, pts, fill=c, w=2.0, sid=980, oa=0.85, slow=True)
    # sand depth: darker toward the viewer
    sh = skia.GradientShader.MakeLinear([skia.Point(0, HORIZ), skia.Point(0, 260)],
                                        [col(c, 0), col(hx('#b98f80'), 0.6)])
    cv.save()
    cv.clipPath(p, skia.ClipOp.kIntersect, True)
    cv.drawRect(skia.Rect.MakeLTRB(x0, HORIZ - 10, x1, 4000), skia.Paint(Shader=sh))
    cv.restore()
    if ROCKS is None:
        r = np.random.default_rng(3)
        n = 260
        ROCKS = np.stack([r.uniform(-900, 900, n), r.uniform(HORIZ + 4, 260, n), r.uniform(0, 1, n),
                          r.integers(0, 3, n)], 1)
    # long horizontal pastel strokes = drawn sand
    r = np.random.default_rng(11)
    sp = skia.Path()
    for i in range(140):
        y = r.uniform(HORIZ + 5, 300)
        x = r.uniform(-900, 900)
        L = r.uniform(20, 70) * (0.6 + (y - HORIZ) / 300)
        sp.moveTo(x, y)
        sp.lineTo(x + L, y + r.uniform(-1, 1))
    cv.drawPath(sp, strokep(1.6, mix(c, EARTH, 0.35), 0.35, rough=1.0, seed=981 + G['bs'] // 2))
    for (rx, ry, sz, kind) in ROCKS:
        if rx < x0 or rx > x1:
            continue
        persp = 0.55 + (ry - HORIZ) / 220
        if kind == 0:
            shape(cv, ellipse_pts(rx, ry, 3.5 * persp * (0.6 + sz), 2.2 * persp * (0.6 + sz), n=7, lump=0.2,
                                  seed=int(abs(rx))), fill=hx('#9c7f72'), w=1.0, sid=int(abs(rx) * 10) % 9999, amp=0.3, slow=True)
        elif kind == 1:
            tp = skia.Path()
            for j in range(4):
                tp.moveTo(rx + j * 1.6 * persp, ry)
                tp.lineTo(rx + (j - 1.5) * 3 * persp, ry - (5 + sz * 5) * persp)
            cv.drawPath(tp, strokep(1.0, hx('#6d6a4e'), 0.65, rough=0.5, seed=int(abs(rx)) + G["bs"] // 2))


def draw_footprints(cv, t, steps):
    for (ts, fx) in steps:
        if ts > t:
            break
        age = t - ts
        a = 0.32 * (1 - clamp(age / 9))
        if a <= 0.01:
            continue
        cv.drawOval(skia.Rect.MakeXYWH(fx - 3.5, -1.0, 7.5, 2.4), fillp(hx('#6e4f45'), a, blur=0.6))


def compute_footprints():
    out = []
    for (ts, a) in footsteps():
        P = new_pose(MAIN, charx(ts))
        P['phase'] = phase(ts)
        P['amp'] = clamp(speed(ts) / 9)
        G['tq'] = ts
        rig(P)
        f = P['feet'][0] if math.cos(P['phase']) < 0.1 and abs(math.sin(P['phase']) - 1) < 0.2 else P['feet'][1]
        # pick the foot that is planted at peak forward position
        i = 0 if math.sin(P['phase']) > 0 else 1
        out.append((ts, P['x'] + P['feet'][i][0]))
    return out


CRACKS = None


def make_cracks():
    r = np.random.default_rng(21)
    cr = []
    times = list(np.linspace(14.0, 20.0, 12) + r.uniform(-0.2, 0.2, 12))
    for ti in times:
        cr.append(dict(t0=ti, x=charx(ti) + r.uniform(-14, 18), y=r.uniform(-2, 4), seed=int(r.integers(1e6)),
                       n=int(r.integers(5, 10)), dur=0.7, big=False))
    for ti in np.linspace(22.4, 24.8, 5):
        cr.append(dict(t0=ti, x=charx(ti) + r.uniform(-10, 20), y=r.uniform(-2, 4), seed=int(r.integers(1e6)),
                       n=int(r.integers(6, 11)), dur=0.9, big=False))
    for k in range(7):
        cr.append(dict(t0=SLIP[1] + k * 0.02, x=XSTOP - 126 + r.uniform(-60, 60), y=r.uniform(-4, 8),
                       seed=int(r.integers(1e6)), n=int(r.integers(7, 13)), dur=0.35, big=True))
    for c in cr:
        rr = np.random.default_rng(c['seed'])
        pts = [np.array([c['x'], c['y']])]
        ang = rr.choice([0, math.pi]) + rr.uniform(-0.5, 0.5)
        for i in range(c['n']):
            ang += rr.uniform(-0.7, 0.7)
            L = rr.uniform(4, 9) * (1.5 if c['big'] else 1)
            d = np.array([math.cos(ang) * L, math.sin(ang) * L * 0.35])
            pts.append(pts[-1] + d)
        c['pts'] = np.array(pts)
        bi = int(rr.integers(1, max(2, c['n'] - 1)))
        b = [c['pts'][bi]]
        a2 = ang + rr.choice([-1, 1]) * 0.9
        for i in range(4):
            a2 += rr.uniform(-0.5, 0.5)
            b.append(b[-1] + np.array([math.cos(a2) * 5, math.sin(a2) * 2]))
        c['branch'] = np.array(b)
        c['bi'] = bi
    return cr


def draw_cracks(cv, t):
    global CRACKS
    if CRACKS is None:
        CRACKS = make_cracks()
    for c in CRACKS:
        if t < c['t0']:
            continue
        g = clamp((t - c['t0']) / c['dur'])
        n = len(c['pts'])
        m = max(2, int(math.ceil(g * n)))
        pts = c['pts'][:m]
        path = spath(pts, closed=False)
        cv.drawPath(path, strokep(2.4 if c['big'] else 1.7, hx('#3b2620'), 0.85, rough=0.4, seed=c['seed'] % 999))
        cv.drawPath(path, strokep(0.8, hx('#f0d9c4'), 0.5, rough=0.4, seed=c['seed'] % 999 + 1))
        if m > c['bi'] + 1:
            gb = clamp((m - c['bi']) / 4)
            b = c['branch'][:max(2, int(len(c['branch']) * gb))]
            cv.drawPath(spath(b, closed=False), strokep(1.1, hx('#3b2620'), 0.75, rough=0.4, seed=c['seed'] % 777))


def draw_motes(cv, t, strength):
    cv.resetMatrix()
    G['k'] = 1.0
    r = np.random.default_rng(5)
    n = 46
    x0 = r.uniform(0, W, n)
    y0 = r.uniform(300, H, n)
    sp = r.uniform(18, 60, n)
    sz = r.uniform(1.5, 4.5, n)
    ph = r.uniform(0, 6.28, n)
    wind = 1.0 - 0.6 * warm(t)
    for i in range(n):
        x = (x0[i] + t * sp[i] * wind) % (W + 40) - 20
        y = y0[i] + math.sin(t * 0.8 + ph[i]) * 18 - t * 4 * warm(t)
        c = hx('#f4e6cc')
        cv.drawCircle(x, y, sz[i], fillp(c, 0.25 * strength, blur=1.2))
    # wind streaks
    p = skia.Path()
    for k in range(5):
        y = 380 + k * 230 + math.sin(k * 3.1) * 60
        x = ((t * (260 + k * 40) * wind + k * 517) % (W + 900)) - 450
        p.moveTo(x, y)
        p.cubicTo(x + 90, y - 10, x + 180, y + 8, x + 300, y - 4)
    cv.drawPath(p, strokep(1.4, PAPER, 0.18 * strength * wind, rough=1.5, seed=G['bs'], raw=True))


# ---------------------------------------------------------------- story
OBJ_FALL_TO = [(150, 4), (92, -12), (62, 0), (118, 0)]
OBJ_FLOAT = [(78, -176), (104, -120), (64, -222), (128, -12)]


def burden_R(t):
    return 92 + 26 * ss(13.4, 20.0, t)


def main_pose(t):
    x = charx(t)
    P = new_pose(MAIN, x)
    P['sid'] = 1
    sp = speed(t)
    P['amp'] = clamp(sp / 9)
    P['phase'] = phase(t)
    stoop = 0.82
    stoop = lerp(stoop, 0.04, ss(7.0, 7.7, t))
    stoop = lerp(stoop, 0.95, ss(11.7, 12.4, t))
    stoop = lerp(stoop, 1.02, ss(13.0, 20.0, t))
    stoop += 0.12 * bump(t, 3.5, 3.8, 4.7) + 0.1 * bump(t, 12.0, 12.3, 12.9)
    stoop += math.sin(t * 2 * math.pi / 1.9) * 0.03  # heavy breathing
    stoop = lerp(stoop, 0.85, ss(KNEEL[0], KNEEL[1], t))
    P['stoop'] = stoop
    kb = 0.38 * bump(t, 3.5, 3.8, 4.8) + 0.3 * bump(t, 12.05, 12.35, 13.0) + 0.12 * ss(14, 20, t)
    kb = lerp(kb, 0.9, ss(KNEEL[0], KNEEL[1], t))
    P['kb'] = kb
    P['tremble'] = 0.6 * ss(18.5, 20.2, t) + 0.8 * bump(t, 20.2, 22.5, 25.5)
    P['tryfoot'] = bump(t, TRY_STEP[0], TRY_STEP[0] + 0.35, TRY_STEP[1])
    P['sit'] = ss(SIT[0], SIT[1], t)
    # lurch when the weight leaves the back
    P['theta_add'] = 12 * bump(t, SLIP[0], SLIP[0] + 0.3, SLIP[1] + 0.6) + 2.0 * math.sin(t * 1.4) * ss(27, 29, t)
    P['theta_add'] += 6 * bump(t, 33.6, 35.0, 39.5)
    droop = 0.38
    droop = lerp(droop, -0.05, ss(7.0, 7.6, t))
    droop = lerp(droop, 0.5, ss(11.8, 12.5, t))
    droop = lerp(droop, 0.62, ss(13, 20, t))
    droop -= 0.25 * bump(t, TRY_STEP[0], TRY_STEP[0] + 0.3, TRY_STEP[1] + 0.3)
    droop = lerp(droop, 0.75, ss(KNEEL[0], KNEEL[1], t))
    droop = lerp(droop, 0.6, ss(SIT[0], SIT[1], t))
    droop = lerp(droop, 0.35, ss(32.4, 34.0, t))
    P['droop'] = droop
    lid = 0.55
    lid = lerp(lid, 0.22, ss(7.0, 7.5, t))
    lid = lerp(lid, 0.62, ss(11.8, 12.4, t))
    lid = lerp(lid, 0.7, ss(14, 20, t))
    lid = lerp(lid, 0.82, ss(KNEEL[0], KNEEL[1], t))
    lid = lerp(lid, 0.92, ss(27.0, 27.4, t))
    lid = lerp(lid, 0.6, ss(31.0, 33.5, t))
    P['lid'] = lid
    P['smile'] = 0.8 * bump(t, 7.2, 7.8, 11.8)
    blinks = [2.2, 5.1, 9.2, 10.9, 15.5, 18.4, 31.0, 35.8]
    P['blink'] = max([bump(t, b, b + 0.06, b + 0.16) for b in blinks])
    lx, ly = 0.6, 0.2
    if 6.6 < t < 12.0:
        lx, ly = 1.0, 0.0
    if 10.2 < t < 12.0:
        lx, ly = 1.0, -0.4
    if 13.5 < t < 20:
        k = math.floor((t - 13.5) / 1.2) % 2
        lx, ly = (0.9, -0.8) if k == 0 else (0.7, 0.4)
    if t > KNEEL[0]:
        lx, ly = 0.4, 0.9
    if t > 33:
        lx, ly = 0.8, 0.8
    P['look'] = (lx, ly)
    if t < SLIP[0]:
        P['burden'] = dict(R=burden_R(t), dark=0.5 * ss(13.4, 20.0, t))
    return P


def objects_state(t, P):
    """World transforms & alpha for the four symbolic objects."""
    out = []
    for k in range(4):
        ta = OBJ_TIMES[k]
        if t < ta:
            out.append(None)
            continue
        app = ss(ta, ta + 0.5, t)
        fx, fy = OBJ_FLOAT[k]
        drift = 1 + 0.12 * math.sin(t * 1.3 + k * 1.7)
        bx = P['x'] + fx * drift + math.sin(t * 1.1 + k) * 4
        by = fy + math.sin(t * 1.6 + k * 2.3) * 6 if k != 3 else -10 + math.sin(t * 1.6 + k) * 3
        rot = math.sin(t * 1.4 + k) * (14 if k == 0 else 6)
        alpha = app
        sc = 0.3 + 0.7 * app
        if t > OBJ_FALL:
            g = clamp((t - OBJ_FALL - k * 0.07) / (1.4 if k == 0 else 0.55))
            ge = g * g if k != 0 else ss(0, 1, g)
            px0 = (XSTOP + OBJ_FLOAT[k][0], OBJ_FLOAT[k][1])
            tx, ty = XSTOP + OBJ_FALL_TO[k][0], OBJ_FALL_TO[k][1]
            bx = lerp(charx(OBJ_FALL) + fx, tx, ge)
            by = lerp(fy, ty, ge)
            if k == 0:
                bx += math.sin(g * 9) * 14 * (1 - g)
                rot = math.sin(g * 8) * 30 * (1 - g) + 80 * g
            elif k == 1:
                rot = 0
            elif k == 2:
                rot = 85 * ge
            else:
                rot = 0
            fade_to = 1.0 if k == 3 else 0.3
            alpha = lerp(1.0, fade_to, ss(30.0, 35.0, t))
            sc = 1
        out.append((Tm(bx, by) @ Rm(rot) @ Sm(sc), alpha))
    return out


def arm_targets(t, P, objs, A=None, sack_w=None):
    st = MAIN
    T_ = st['T']
    strap = [(8.0, -T_ + 16), (4.0, -T_ + 15)]
    relax = [(5.0, -5.0), (1.0, -5.0)]
    arms = [np.array(strap[0]), np.array(strap[1])]
    m = ss(7.0, 7.6, t) * (1 - ss(11.8, 12.4, t))
    arms = [mix(arms[i], np.array(relax[i]), m) for i in range(2)]
    if sack_w is not None:
        h = bump(t, 8.2, 8.7, 9.75)
        for i, dx in enumerate([7.0, -5.0]):
            tgt = w2t(P, sack_w + np.array([dx, -2]))
            arms[i] = mix(arms[i], tgt, h)
    wave = bump(t, 10.0, 10.3, 11.1)
    if wave > 0:
        arms[1] = mix(arms[1], np.array([18 + math.sin(t * 14) * 5, -T_ - 22]), wave)
    if t > 13.6 and objs is not None:
        reach = ss(13.6, 14.2, t) * (1 - ss(OBJ_FALL - 0.4, OBJ_FALL, t))
        k0 = int((t - 13.6) / 1.2)
        avail = [i for i in range(4) if objs[i] is not None]
        if avail and reach > 0:
            for arm_i in range(2):
                oi = avail[(k0 + arm_i * 2) % len(avail)]
                Mo, _ = objs[oi]
                tgt = w2t(P, ap(Mo, (0, 0)))
                tgt = tgt + np.array([math.sin(t * 9 + arm_i) * 1.2, math.cos(t * 11) * 1.2])
                arms[arm_i] = mix(arms[arm_i], tgt, reach * (0.85 if arm_i == 0 else 0.7))
    # kneeling: arms drop, then hold the knees while sitting
    drop = ss(KNEEL[0] + 0.8, KNEEL[1], t)
    arms = [mix(arms[i], np.array(relax[i]) + np.array([4, 4]), drop) for i in range(2)]
    if P['sit'] > 0:
        knee_p = np.array([13.0, -18.0])
        for i in range(2):
            arms[i] = mix(arms[i], p2t(P, knee_p + np.array([2 - 3 * i, -1])), P['sit'])
    reach_plant = ss(33.8, 35.6, t)
    if reach_plant > 0:
        arms[0] = mix(arms[0], p2t(P, np.array([37.0, -8.0])), reach_plant)
    return arms


def others(t):
    """Poses of the three passers-by in scene 2."""
    Xm = charx(7.4)
    res = []
    if t < 6.0 or t > 11.9:
        return res, None, None
    enter = ss(6.0, 7.9, t)
    leave = ss(10.1, 11.8, t)
    specs = [(FIG_A, 52, 2), (FIG_B, 98, 3), (FIG_C, 124, 4)]
    sack_w = None
    A = None
    for i, (st, dx, sid) in enumerate(specs):
        x_in = Xm + dx + 230 * (1 - enter) + i * 10 * (1 - enter)
        x = x_in + 150 * leave
        y = -60 * leave
        s = (1 - 0.55 * leave) * (0.78 if st is FIG_C else 1.0)
        P = new_pose(st, x, y, s, face=-1 if leave <= 0 else 1)
        P['sid'] = sid
        P['alpha'] = 1 - ss(11.1, 11.8, t)
        walking = (6.0 < t < 7.9) or (10.1 < t < 11.8)
        P['amp'] = 0.9 if walking else 0.0
        P['phase'] = (t * 2 * math.pi / (1.2 if i != 1 else 1.4)) + i
        P['bounce'] = 1.0 if t > 10.0 else 0.0
        P['lid'] = 0.15
        P['look'] = (1.0, 0.1)
        P['smile'] = 0.3 + 0.7 * ss(9.4, 9.9, t)
        if st is FIG_A:
            P['stoop'] = lerp(0.75, 0.05, ss(9.0, 9.6, t))
            P['hop'] = 8 * bump(t, 9.75, 9.95, 10.15)
            P['droop'] = lerp(0.5, 0.0, ss(9.0, 9.6, t))
            A = P
        elif st is FIG_C:
            P['hop'] = 5 * abs(math.sin(t * 6)) * ss(9.6, 9.8, t) * (1 - ss(10.1, 10.3, t))
            P['droop'] = -0.1
        else:
            P['droop'] = 0.15
        if 9.7 < t < 10.4 and st is not FIG_A:
            P['arms'] = [np.array([10, -st['T'] - 18 + math.sin(t * 16) * 3]), np.array([2, -6])]
        res.append(P)
    # sack: dragged on the ground, lifted onto A's back
    rig(A)
    ground = np.array([A['x'] + 24, -9.0])
    back = ap(A['Mt'] @ Tm(-13, -A['style']['T'] * 0.5), (0, 0))
    h = ss(HELP[0] + 0.2, HELP[1], t)
    pos = mix(ground, back, h) + np.array([0, -18 * math.sin(math.pi * h)])
    sack_w = pos
    if h >= 1:
        sack_w = None
        A['sack'] = 'back'
    else:
        A['sack'] = pos
    if t < 9.0:
        A['arms'] = [np.array([16, -6]), np.array([12, -4])]
    elif t < 9.7:
        A['arms'] = [np.array([-6, -A['style']['T'] + 10]), np.array([-4, -A['style']['T'] + 12])]
    else:
        A['arms'] = [np.array([12 + math.sin(t * 15) * 4, -A['style']['T'] - 16]), np.array([-4, -A['style']['T'] + 12])]
    return res, A, (pos if h < 1 else None)


# ---------------------------------------------------------------- frame
PAPER_TEX = None
GRAINS = None


def make_textures():
    global PAPER_TEX, GRAINS
    from scipy.ndimage import gaussian_filter
    r = np.random.default_rng(1)
    low = gaussian_filter(r.standard_normal((H // 4, W // 4)), 18)
    low = np.kron(low / (np.abs(low).max() + 1e-6), np.ones((4, 4)))[:H, :W]
    mid = gaussian_filter(r.standard_normal((H, W)), 2.2)
    mid /= np.abs(mid).max()
    fib = np.zeros((H, W))
    for _ in range(2500):
        x, y = r.integers(0, W), r.integers(0, H)
        L = r.integers(6, 26)
        a = r.uniform(0, math.pi)
        xs = (x + np.cos(a) * np.arange(L)).astype(int) % W
        ys = (y + np.sin(a) * np.arange(L)).astype(int) % H
        fib[ys, xs] += r.uniform(0.3, 1)
    fib = gaussian_filter(fib, 0.7)
    PAPER_TEX = (1.0 + 0.035 * low + 0.05 * mid - 0.06 * fib).astype(np.float32)[..., None]
    GRAINS = []
    for k in range(6):
        g = r.standard_normal((H, W)).astype(np.float32)
        g = gaussian_filter(g, 0.9)
        GRAINS.append((g * 0.045)[..., None])
    yy, xx = np.mgrid[0:H, 0:W]
    d = np.sqrt(((xx - W / 2) / (W * 0.62)) ** 2 + ((yy - H / 2) / (H * 0.6)) ** 2)
    global VIG
    VIG = np.clip(1.0 - 0.38 * d ** 2.4, 0.45, 1).astype(np.float32)[..., None]


VIG = None
FOOTP = None
FONT_PATH = '/usr/share/fonts/truetype/liberation/LiberationSerif-Italic.ttf'


def draw_text(cv, t):
    a = ss(TEXT_IN, TEXT_IN + 0.9, t)
    if a <= 0:
        return
    cv.resetMatrix()
    G['k'] = 1.0
    tf = skia.Typeface.MakeFromFile(FONT_PATH)
    font = skia.Font(tf, 64)
    lines = ['Sen en son ne zaman', 'gerçekten yorulduğunu', 'söyledin?']
    y = 470
    r = np.random.default_rng(G['bs'] // 2 + 1)
    for li, line in enumerate(lines):
        wline = font.measureText(line)
        x = (W - wline) / 2
        for ch in line:
            cw = font.measureText(ch)
            dx, dy, rot = r.uniform(-0.6, 0.6), r.uniform(-0.8, 0.8), r.uniform(-1.2, 1.2)
            cv.save()
            cv.translate(x + dx, y + dy + (1 - a) * 14)
            cv.rotate(rot)
            cv.drawString(ch, 1.5, 3.0, font, fillp(hx('#1e1828'), 0.75 * a, blur=4.0))
            cv.drawString(ch, 0.8, 1.5, font, fillp(hx('#1e1828'), 0.5 * a, blur=1.2))
            cv.drawString(ch, 0, 0, font, fillp(hx('#f3e9d4'), a))
            cv.restore()
            x += cw
        y += 78


# Optional time warp (output time -> story time) so the picture follows a recorded narration.
WARP = None
if os.environ.get('FILM_WARP'):
    import json
    _w = json.load(open(os.environ['FILM_WARP']))
    WARP = (np.array(_w['out']), np.array(_w['film']))
    NF = int(round(_w['out'][-1] * FPS))


def o2f(t_out):
    if WARP is None:
        return t_out
    return float(np.interp(t_out, WARP[0], WARP[1]))


def render(fi):
    t_out = fi / FPS
    t = o2f(t_out)
    G['t'] = t
    G['bs'] = int(t_out * 12)
    G['tq'] = o2f(math.floor(t_out * 12) / 12)  # characters animated "on twos"
    tq = G['tq']
    global FOOTP
    if FOOTP is None:
        FOOTP = compute_footprints()
    if PAPER_TEX is None:
        make_textures()
    z, cx, cy, sx, sy = camera(t)
    G['z'] = z
    G['cx'] = cx
    cam = Tm(540 + sx, 960 + sy) @ Sm(z) @ Tm(-cx, -cy)
    G['cam'] = cam
    hs = ap(cam, (0, HORIZ))[1]
    arr = np.zeros((H, W, 4), np.uint8)
    surf = skia.Surface(arr)
    cv = surf.getCanvas()
    draw_sky(cv, t, hs)
    zsave = z
    draw_moons_clouds(cv, t, z, cx, hs)
    draw_far(cv, t, z, cx, hs)
    draw_mid(cv, t, z, cx, hs)
    G['z'] = zsave
    G['cam'] = cam
    draw_ground(cv, t, cam)
    setM(cv, cam)
    draw_footprints(cv, t, FOOTP)
    draw_cracks(cv, t)

    # tear wet spot & plant
    P = main_pose(tq)
    rig(P)
    objs = objects_state(tq, P)
    oth, A, sack_w = others(tq)
    # passers-by (behind)
    for Q in oth:
        if Q['style'] is FIG_A:
            def under(cv_, Q_):
                if isinstance(Q_['sack'], str):
                    draw_sack(cv_, Q_['Mt'] @ Tm(-13, -Q_['style']['T'] * 0.5), Q_['alpha'])
            draw_person(cv, Q, under)
            if isinstance(Q['sack'], np.ndarray):
                draw_sack(cv, Tm(*Q['sack']))
                # rope from A's hand to the sack while dragging
                if tq < HELP[0]:
                    setM(cv, cam)
                    hand = ap(Q['Mt'], Q['arms'][0])
                    rp = spath(np.array([hand, (hand + Q['sack']) / 2 + np.array([0, 5]), Q['sack'] + np.array([0, -12])]),
                               closed=False)
                    cv.drawPath(rp, strokep(1.4, INK, 0.8, rough=0.4, seed=G['bs']))
        else:
            draw_person(cv, Q)
    # fallen burden
    fallen_M = None
    if tq >= SLIP[0]:
        Pk = main_pose(SLIP[0] - 1e-3)
        rig(Pk)
        M0 = burden_M(Pk)
        R = Pk['burden']['R']
        c0 = ap(M0, (0, 0))
        land = np.array([XSTOP - 126, -R * 0.86])
        g = clamp((tq - SLIP[0]) / (SLIP[1] - SLIP[0]))
        ge = g * g
        cpos = mix(c0, land, ge) + np.array([-10 * math.sin(math.pi * g), -8 * math.sin(math.pi * g)])
        rot = -25 * ge
        squash = 1.0
        if tq >= SLIP[1]:
            u = tq - SLIP[1]
            squash = 1 - 0.12 * math.exp(-u * 8) * math.cos(u * 30)
        fallen_M = (Tm(*cpos) @ Rm(rot), R, squash)
        draw_burden(cv, Tm(0, R * (1 - squash) * 0.9) @ fallen_M[0], R, 0.5, squash)
        # dust
        if tq >= SLIP[1] - 0.05:
            setM(cv, cam)
            u = t - SLIP[1]
            r = np.random.default_rng(77)
            for k in range(34):
                ang = r.uniform(math.pi * 0.95, math.pi * 2.05)
                spd = r.uniform(40, 150)
                life = r.uniform(1.0, 2.2)
                if u < 0 or u > life:
                    continue
                q = u / life
                ex = land[0] + math.cos(ang) * (R * 0.9 + spd * (1 - math.exp(-u * 2.2)) * 0.9)
                ey = 4 + math.sin(ang) * spd * 0.25 * (1 - math.exp(-u * 2.5)) - u * 8
                rr = 6 + 24 * q * r.uniform(0.6, 1.3)
                cv.drawCircle(ex, ey, rr, fillp(hx('#efdcc6'), 0.5 * (1 - q), blur=rr * 0.35 * z))
    # objects on the ground (behind the character when fallen)
    def draw_obj(k, item):
        if item is None:
            return
        M, a = item
        if k == 0:
            draw_letter(cv, M, a)
        elif k == 1:
            draw_clock(cv, M, a, tq)
        elif k == 2:
            fade = ss(15.5, 20.0, tq)
            draw_flower(cv, M, a, fade, petals=5 if tq < 18.5 else 4)
        else:
            draw_chair(cv, M, a)
    for k in range(4):
        if objs[k] is not None and k == 3:
            draw_obj(k, objs[k])
    # falling petal
    if 18.5 < tq < 22.5 and objs[2] is not None:
        u = tq - 18.5
        M2, _ = objs[2]
        p0 = ap(M2, (12, -8))
        pp = p0 + np.array([math.sin(u * 3) * 10 + u * 8, u * 34])
        if pp[1] > 2:
            pp[1] = 2
        setM(cv, cam @ Tm(*pp) @ Rm(u * 120))
        shape(cv, ellipse_pts(0, 0, 4, 2.4, n=8), fill=mix(DPINK, hx('#a69c92'), 0.7), w=1.0, sid=851, amp=0.3)
    # wet spot and plant
    eye_land = None
    if tq >= TEAR_FORM:
        Pt = main_pose(TEAR_FORM)
        rig(Pt)
        eye_w = ap(Pt['Mh'], (10.0, 6.5))
        eye_land = np.array([eye_w[0], 3.0])
    if eye_land is not None and tq >= TEAR_FALL[1]:
        setM(cv, cam)
        u = tq - TEAR_FALL[1]
        cv.drawOval(skia.Rect.MakeXYWH(eye_land[0] - 6, eye_land[1] - 1.6, 12, 3.4),
                    fillp(hx('#7a5a52'), 0.35 * clamp(u / 0.3), blur=0.8))
        if u < 0.6:
            rr = 3 + u * 22
            cv.drawOval(skia.Rect.MakeXYWH(eye_land[0] - rr, eye_land[1] - rr * 0.3, 2 * rr, rr * 0.6),
                        strokep(1.0, hx('#cfe3e0'), 0.8 * (1 - u / 0.6), rough=0.2, seed=G['bs']))
            for k in range(4):
                ang = math.pi * (1.1 + k * 0.27)
                dx_ = math.cos(ang) * u * 26
                dy_ = -math.sin(ang) * u * 30 + 60 * u * u
                if dy_ < 0:
                    cv.drawCircle(eye_land[0] + dx_, eye_land[1] - abs(dy_) * 0.0 + dy_ * -1 * -1, 0.9,
                                  fillp(hx('#d8ece8'), 0.8 * (1 - u / 0.6)))
    if eye_land is not None and tq >= SPROUT:
        draw_plant(cv, tq, eye_land + np.array([0, -0.5]))
    # main character
    if 6.0 < tq < 11.9:
        arms = arm_targets(tq, P, None, A, sack_w)
    else:
        arms = arm_targets(tq, P, objs)
    P['arms'] = arms
    draw_person(cv, P)
    # floating objects in front
    for k in range(3):
        draw_obj(k, objs[k])
    # tear
    if eye_land is not None and tq < TEAR_FALL[1]:
        Pt = main_pose(TEAR_FORM)
        rig(Pt)
        e = ap(Pt['Mh'], (10.0, 6.5))
        if t < TEAR_FALL[0]:
            g = ss(TEAR_FORM, TEAR_FALL[0], t)
            pos = e + np.array([0, 2 * g])
            sc = 0.3 + 0.7 * g
        else:
            u = (t - TEAR_FALL[0]) / (TEAR_FALL[1] - TEAR_FALL[0])
            pos = np.array([e[0], lerp(e[1] + 2, eye_land[1], u * u)])
            sc = 1.0
        setM(cv, cam @ Tm(*pos) @ Sm(sc))
        tp = np.array([[0, -4.2], [1.9, -0.2], [1.6, 1.6], [0, 2.4], [-1.6, 1.6], [-1.9, -0.2]])
        p = shape(cv, tp, fill=hx('#bfe0dc'), w=1.0, sid=990, amp=0.1, misreg=0.1, fa=0.95, ocolor=hx('#3d5a66'))
        cv.drawCircle(-0.6, 0.2, 0.55, fillp(PAPER, 0.9))
        if t > TEAR_FALL[0]:
            G['k'] = G['k']
            setM(cv, cam)
            sp_ = spath(np.array([pos + np.array([0, -4]), pos + np.array([0, -14])]), closed=False)
            cv.drawPath(sp_, strokep(0.8, hx('#d8ece8'), 0.5, rough=0.2, seed=G['bs']))
    draw_motes(cv, t, 1.0 - 0.5 * bump(t, 26, 27.5, 31))
    draw_text(cv, t)
    img = arr[..., :3].astype(np.float32) / 255.0
    img = img * PAPER_TEX + GRAINS[G['bs'] % 6]
    img = img * VIG
    # warm print-like grade: lift blacks to a brown, soften whites
    img = img * 0.93 + np.array([0.045, 0.032, 0.03], np.float32)
    if t > DUR - 0.5:
        img = mix(img, PAPER * 0.25, ss(DUR - 0.5, DUR, t) * 0.0)
    if t < 0.6:
        img = img * ss(0, 0.6, t) + (1 - ss(0, 0.6, t)) * 0.08
    return (np.clip(img, 0, 1) * 255).astype(np.uint8)


def draw_plant(cv, t, base):
    g1 = ss(SPROUT, SPROUT + 1.6, t)
    g2 = ss(31.0, 37.5, t)
    h = 3 + 12 * g1 + 20 * g2
    sway = math.sin(t * 1.3) * 1.5 * (0.3 + g2)
    setM(cv, G['cam'] @ Tm(*base))
    # soft glow (quiet hope)
    cv.drawCircle(0, -h * 0.6, 10 + h * 0.6, fillp(hx('#f3e2b0'), 0.18 * g1, blur=8 * G['z'] ** 0))
    stem = spath(np.array([[0, 0], [0.5 + sway * 0.3, -h * 0.5], [sway, -h]]), closed=False)
    cv.drawPath(stem, strokep(1.6, hx('#4c6b3a'), 1.0, rough=0.2, seed=G['bs']))
    leaves = [(1.0, -1, 0.0), (1.0, 1, 0.0)]
    if g2 > 0.05:
        leaves += [(0.55, -1, 0.35), (0.55, 1, 0.6)]
    for (f, side, delay) in leaves:
        gg = g1 if delay == 0 else ss(31.0 + delay * 6, 33 + delay * 6, t)
        if gg <= 0:
            continue
        y = -h * f
        L = (6.5 + 5.5 * g2) * gg
        lp = np.array([[0, 0], [side * L * 0.5, -L * 0.45], [side * L, -L * 0.15], [side * L * 0.5, L * 0.15]])
        setM(cv, G['cam'] @ Tm(*base) @ Tm(sway * f, y) @ Rm(side * (-10 + 10 * (1 - gg))))
        shape(cv, lp, fill=GREEN, w=1.1, sid=995 + int(f * 10) + side, amp=0.1, misreg=0.2, ocolor=hx('#2f4526'))


def frames_cmd(times, outdir):
    os.makedirs(outdir, exist_ok=True)
    from PIL import Image
    for tt in times:
        fi = int(round(float(tt) * FPS))
        im = render(fi)
        Image.fromarray(im).save(os.path.join(outdir, f'f_{float(tt):05.2f}.png'))
        print('wrote', tt, flush=True)


def _init():
    make_textures()


def video_cmd(out, start=0, end=None, workers=4):
    end = NF if end is None else end
    from multiprocessing import Pool
    cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}',
           '-r', str(FPS), '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '15',
           '-pix_fmt', 'yuv420p', out]
    ff = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    with Pool(workers, initializer=_init) as pool:
        for i, fr in enumerate(pool.imap(render, range(start, end), chunksize=2)):
            ff.stdin.write(fr.tobytes())
            if i % 48 == 0:
                print('frame', start + i, flush=True)
    ff.stdin.close()
    ff.wait()


if __name__ == '__main__':
    if sys.argv[1] == 'frames':
        frames_cmd(sys.argv[3:], sys.argv[2])
    else:
        a = int(sys.argv[3]) if len(sys.argv) > 3 else 0
        b = int(sys.argv[4]) if len(sys.argv) > 4 else NF
        video_cmd(sys.argv[2], a, b)
