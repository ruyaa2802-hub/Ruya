"""CLAY REPLAY - Bölüm 1: TİTANİK. Kare kare render.

Kullanım:  python3 episode.py [--preview] [--only t1,t2,...]
"""
import json
import math
import os
import sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'engine'))
sys.path.insert(0, HERE)
from clay import (W, H, Canvas, Light, Xf, Camera, hexc, ellipse_pts, tube_pts, poly_tube, bezier,
                  text_mask_fn, subtitle, clamp, ease, ease_out_back, ramp, lerp, spring, NOISE)
from characters import ruzgar, findik
from timeline import FPS, DURATION, LINES, EVENTS, NAMES, SHOTS

_LP = os.path.join(HERE, 'build', 'lipsync.json')
LIPS = json.load(open(_LP)) if os.path.exists(_LP) else dict(lips={'R': [], 'F': []}, lines=[])
LINE_T = {l[0]: (l[2], l[3]) for l in LIPS['lines']}


def lip(who, t):
    arr = LIPS['lips'][who]
    i = int(t * FPS)
    v = arr[i] if 0 <= i < len(arr) else 0.0
    return clamp(v * 0.9)


def blink(t, period=2.7, off=0.0):
    ph = (t + off) % period
    return 0.0 if ph < 0.09 else 1.0


# ===================================================================== arka plan
SKY_STOPS = [(-1.0, '#2c2f63'), (-0.55, '#5a4a86'), (-0.28, '#c86a7c'), (-0.1, '#f39a6a'), (0.0, '#ffd08a')]


def sky(cv, hy, stops=SKY_STOPS, span=1100):
    ys = (np.arange(H) - hy) / span
    pos = [s[0] for s in stops]
    cols = np.array([hexc(s[1]) for s in stops])
    g = np.stack([np.interp(ys, pos, cols[:, c]) for c in range(3)], -1).astype(np.float32)
    nz = NOISE[:H, :W] * 0.012
    cv.img[:] = g[:, None, :] + nz[..., None]


def sea(cv, hy, t, sun_x, near='#245e78', far='#d98b78', amp=1.0, speed=1.0, glitter=1.0, out=None):
    hy_i = int(max(0, hy))
    if hy_i >= H:
        return
    ys = np.arange(hy_i, H, dtype=np.float32)
    d = (ys - hy + 4)[:, None]
    xs = (np.arange(W, dtype=np.float32) - W / 2)[None, :]
    Z = 900.0 / d
    X = xs / d * 2.2
    ph = t * speed
    hw = (0.55 * np.sin(Z * 0.9 + X * 0.35 + ph * 2.0) + 0.35 * np.sin(Z * 1.7 - X * 0.8 + ph * 2.9)
          + 0.18 * np.sin(Z * 3.1 + X * 1.9 + ph * 4.1))
    hs = hw * d * 0.05 * amp + NOISE[hy_i:H, :W] * 0.8
    gy, gx = np.gradient(hs)
    inv = 1 / np.sqrt(gx * gx + gy * gy + 1)
    nx, ny, nz = -gx * inv, -gy * inv, inv
    k = np.array([0.3, -0.5, 0.8])
    k /= np.linalg.norm(k)
    diff = np.clip(nx * k[0] + ny * k[1] + nz * k[2], 0, 1)
    p = np.clip((ys - hy) / (H - hy), 0, 1)[:, None] ** 0.6
    base = hexc(far)[None, None, :] * (1 - p[..., None]) + hexc(near)[None, None, :] * p[..., None]
    col = base * (0.55 + 0.6 * diff[..., None])
    # güneş parıltı yolu
    gl = np.exp(-((xs + W / 2 - sun_x) / (60 + d * 0.9)) ** 2)
    spec = np.clip(-ny * 0.8 + nz * 0.6, 0, 1) ** 24
    col += glitter * (gl * spec * 1.4)[..., None] * hexc('#ffe2a8')[None, None, :]
    # ufuk pusu
    haze = np.exp(-(ys - hy) / 40.0)[:, None, None]
    col = col * (1 - haze * 0.7) + hexc('#f6b483')[None, None, :] * haze * 0.7
    if out is not None:
        out[hy_i:H] = col
    cv.img[hy_i:H] = col


def clouds(cv, X, t, items, col='#f2a58f', alpha=0.9):
    for (cx, cy, r, sp) in items:
        cx = cx + t * sp
        blobs = [('poly', X(ellipse_pts(cx + dx * r, cy + dy * r, rr * r, rr * r * 0.7)))
                 for dx, dy, rr in ((-1.2, 0.1, 0.7), (-0.4, -0.3, 0.95), (0.5, -0.15, 0.85), (1.3, 0.15, 0.6),
                                    (0.0, 0.25, 1.1))]
        cv.part(blobs, col, bump=0.35, tex=0.6, shadow=False, alpha=alpha, ao=0.05, spec=0.05)


def sun(cv, X, x, y, r):
    sx, sy = X.pt(x, y)
    cv.glow(sx, sy, r * X.s * 5, '#ffb070', 0.5)
    cv.glow(sx, sy, r * X.s * 1.6, '#fff0b0', 0.6)
    cv.part([('poly', X(ellipse_pts(x, y, r, r)))], '#fff0c2', emissive=0.85, shadow=False, tex=0.2)


# ===================================================================== gemi (uzak plan)
HULL = '#1d1b22'
FUNNEL = '#d39a3e'


def ship_far(cv, X, t):
    """3/4 önden Titanik: siyah gövde, beyaz üst yapı, 4 sarı baca."""
    # gövde
    hull = [(-470, -40), (330, 20), (430, 6), (360, 190), (-470, 52)]
    cv.part([('poly', X(hull))], HULL, spec=0.35, gloss=24, shadow=False,
            grooves=[(X([(-470, -30), (340, 30), (418, 18)]), 3)], groove_depth=4, roundness=26)
    cv.part([('poly', X([(-470, 40), (360, 178), (356, 196), (-470, 58)]))], '#9c2f2a', shadow=False, roundness=6)
    # bordo şerit (altın)
    cv.part([('line', X([(-470, -26), (340, 32), (420, 20)]), 4.5 * X.s)], '#d9b45a', shadow=False, roundness=3,
            spec=0.6)
    # lombozlar
    for row, yy in enumerate((0, 30)):
        for i in range(26):
            x = -440 + i * 30
            y = yy - 20 + (x + 470) * 0.075 + row * (x + 470) * 0.03
            if x < 330:
                cv.part([('poly', X(ellipse_pts(x, y, 3.2, 3.2)))], '#ffd27a', emissive=0.9, shadow=False, tex=0)
    # üst yapı
    sup = [(-430, -40), (230, 6), (232, -38), (-430, -88)]
    cv.part([('poly', X(sup))], '#efe8da', shadow_k=0.3, roundness=10,
            grooves=[(X([(-420, -58 + k * 14 - 0), (226, -12 + k * 14)]), 2) for k in range(3)], groove_depth=3)
    cv.part([('poly', X([(-380, -88), (160, -36), (162, -56), (-380, -112)]))], '#efe8da', shadow_k=0.3, roundness=8)
    # bacalar
    for i, fx in enumerate((110, -30, -170, -300)):
        sc = 1 - i * 0.05
        base_y = -50 + (fx + 430) * 0.07 - 20
        fxf = X.child(fx, base_y, rot=-0.13)
        w_, h_ = 26 * sc, 150 * sc
        cv.part([('poly', fxf([(-w_, 0), (w_, 0), (w_ * 0.95, -h_), (-w_ * 0.95, -h_)]))], FUNNEL, shadow_k=0.35,
                roundness=12, grooves=[(fxf([(-w_, -h_ * 0.35), (w_, -h_ * 0.35)]), 2)])
        cv.part([('poly', fxf([(-w_ * 0.95, -h_ * 0.78), (w_ * 0.95, -h_ * 0.78), (w_ * 0.95, -h_),
                               (-w_ * 0.95, -h_)]))], '#1a1716', shadow=False, roundness=8)
        if i < 3:  # duman
            puffs = []
            for k in range(5):
                age = (t * 0.9 + k * 0.22 + i * 0.13) % 1.1
                px_, py_ = -age * 160, -h_ - 10 - age * 70
                r_ = (14 + age * 30) * sc
                puffs.append(('poly', fxf(ellipse_pts(px_, py_, r_, r_ * 0.85))))
            cv.part(puffs, '#8d8487', bump=0.5, shadow=False, alpha=0.85, tex=0.8)
    # direkler
    cv.part([('line', X([(300, 0), (296, -330)]), 5 * X.s)], '#2a201b', shadow=False, roundness=3)
    cv.part([('line', X([(-420, -60), (-424, -330)]), 4 * X.s)], '#2a201b', shadow=False, roundness=3)
    for a, b in (((296, -330), (430, 6)), ((296, -330), (-424, -330)), ((-424, -330), (-470, -40))):
        cv.part([('line', X([a, b]), 1.6 * X.s)], '#3a2f2a', shadow=False, roundness=1, tex=0)
    # pruva köpüğü
    foam = [('poly', X(ellipse_pts(360 + k * 12 - 60 * (k % 3), 190 + 6 * math.sin(t * 8 + k), 20 + 6 * (k % 3), 9)))
            for k in range(9)]
    cv.part(foam, '#f4f1ea', bump=0.5, shadow=False, tex=0.6)
    wake = [('poly', X(ellipse_pts(-200 + k * 60, 62 + (k * 7) % 11, 40, 6))) for k in range(10)]
    cv.part(wake, '#e9eef0', bump=0.3, shadow=False, alpha=0.7, tex=0.5)


# ===================================================================== pruva (yakın plan)
T_TIP = (640.0, 1420.0)
A_FAR_X = -500.0


def y_near(x):
    return 1420 + (x - 640) * 0.279


def y_far(x):
    return 1420 + (x - 640) * 0.365


def persp(x):
    return lerp(1.0, 0.42, clamp((640 - x) / 1140))


def bow_far(cv, X, t):
    """Karakterlerin arkasında kalanlar: üst yapı, bacalar, direk."""
    # ön direk + halatlar
    mx = 300
    cv.part([('line', X([(mx, y_far(mx) - 30), (mx - 6, 360)]), 11 * X.s)], '#2b211c', shadow=False, roundness=5)
    for tgt in ((T_TIP[0], T_TIP[1] - 150), (A_FAR_X, 820)):
        cv.part([('line', X([(mx - 6, 380), tgt]), 2.6 * X.s)], '#3b302a', shadow=False, roundness=1.5, tex=0)
    xs = np.linspace(A_FAR_X, 210, 30)
    top = [(x, (y_near(x) + y_far(x)) / 2 - 150 * persp(x)) for x in xs]
    base = [(x, (y_near(x) + y_far(x)) / 2 + 4) for x in xs[::-1]]
    cv.part([('poly', X(top + base))], '#ece5d6', shadow_k=0.3, roundness=18,
            grooves=[(X([(x, (y_near(x) + y_far(x)) / 2 - 150 * persp(x) * f) for x in xs]), 2.2)
                     for f in (0.3, 0.55, 0.8)], groove_depth=4)
    # pencereler
    for x in np.linspace(A_FAR_X + 20, 190, 22):
        for f in (0.42, 0.68):
            y = (y_near(x) + y_far(x)) / 2 - 150 * persp(x) * f
            cv.part([('poly', X(ellipse_pts(x, y, 5 * persp(x), 6 * persp(x))))], '#ffcf7a', emissive=0.85,
                    shadow=False, tex=0)
    for i, fx in enumerate((130, 0, -135, -270)):
        sc = persp(fx)
        by = (y_near(fx) + y_far(fx)) / 2 - 150 * sc + 6
        fxf = X.child(fx, by, rot=-0.12)
        w_, h_ = 62 * sc, 360 * sc
        cv.part([('poly', fxf([(-w_, 0), (w_, 0), (w_ * 0.96, -h_), (-w_ * 0.96, -h_)]))], FUNNEL,
                shadow_k=0.3, roundness=28 * sc, grooves=[(fxf([(-w_, -h_ * 0.4), (w_, -h_ * 0.4)]), 2.5)])
        cv.part([('poly', fxf([(-w_ * 0.96, -h_ * 0.78), (w_ * 0.96, -h_ * 0.78), (w_ * 0.96, -h_),
                               (-w_ * 0.96, -h_)]))], '#1a1716', shadow=False, roundness=16 * sc)
        if i < 3:
            puffs = []
            for k in range(5):
                age = (t * 0.6 + k * 0.22 + i * 0.13) % 1.1
                r_ = (30 + age * 70) * sc
                puffs.append(('poly', fxf(ellipse_pts(-age * 380, -h_ - 20 - age * 150, r_, r_ * 0.85))))
            cv.part(puffs, '#8f8789', bump=0.5, shadow=False, alpha=0.8, tex=0.8)


def bow_deck(cv, X, t):
    # gövde
    A = (A_FAR_X, y_near(A_FAR_X))
    A2 = (A_FAR_X, y_near(A_FAR_X) + 120)
    S = (705, 2400)
    cv.part([('poly', X([T_TIP, A, A2, S, (720, 2400)]))], HULL, spec=0.35, gloss=20, shadow=False, roundness=60,
            grooves=[(X([(T_TIP[0] + 2, T_TIP[1] + 40), (A[0], A[1] + 40)]), 3),
                     (X([(T_TIP[0] + 10, T_TIP[1] + 180), (A[0], A[1] + 100)]), 2)], groove_depth=4)
    cv.part([('line', X([(T_TIP[0] - 4, T_TIP[1] + 22), (A[0], A[1] + 22)]), 7 * X.s)], '#d6b158', shadow=False,
            roundness=4, spec=0.7)
    # lombozlar
    for x in np.linspace(A_FAR_X + 30, 560, 18):
        y = y_near(x) + 75 * persp(x) + 30
        r = 9 * persp(x)
        cv.part([('poly', X(ellipse_pts(x, y, r, r)))], '#c9a24e', shadow=False, roundness=3, spec=0.6)
        cv.part([('poly', X(ellipse_pts(x, y, r * 0.65, r * 0.65)))], '#ffd88a', emissive=0.8, shadow=False, tex=0)
    # çapa
    ax, ay = 590, 1600
    anc = X.child(ax, ay, rot=0.05)
    cv.part([('line', anc([(0, -60), (0, 50)]), 13 * X.s), ('line', anc(bezier((-45, 25), (0, 85), (45, 25))), 13 * X.s),
             ('line', anc([(-26, -38), (26, -38)]), 11 * X.s)], '#4c4a50', spec=0.5, shadow_k=0.5)
    cv.part([('poly', anc(ellipse_pts(0, -72, 14, 14)))], '#4c4a50', spec=0.5, shadow_k=0.4)
    # güverte
    B = (A_FAR_X, y_far(A_FAR_X))
    planks = [(X([T_TIP, (A_FAR_X, lerp(y_near(A_FAR_X), y_far(A_FAR_X), f))]), 1.6) for f in np.linspace(0.12, 0.88, 7)]
    cv.part([('poly', X([T_TIP, A, B]))], '#b98a5a', shadow=False, roundness=8, grooves=planks, groove_depth=3,
            tex=0.8)
    # uzak korkuluk
    rail(cv, X, y_far, 0.0)


def rail(cv, X, yfun, side):
    xs = np.linspace(T_TIP[0] - 8, A_FAR_X, 26)
    top = [(x, yfun(x) - 100 * persp(x)) for x in xs]
    mid = [(x, yfun(x) - 50 * persp(x)) for x in xs]
    cv.part([('line', X(top), 9 * X.s), ('line', X(mid), 6 * X.s)], '#f1ece0', spec=0.35, shadow_k=0.35, roundness=4)
    posts = [('line', X([(x, yfun(x)), (x, yfun(x) - 100 * persp(x))]), 6 * X.s * persp(x)) for x in xs[1::2]]
    cv.part(posts, '#f1ece0', shadow_k=0.3, roundness=3)


def bow_near_rail(cv, X, t):
    rail(cv, X, y_near, 1.0)
    # bayrak direği
    cv.part([('line', X([(T_TIP[0] + 6, T_TIP[1] - 4), (T_TIP[0] + 12, T_TIP[1] - 230)]), 7 * X.s)], '#e9e1d1',
            shadow_k=0.3, roundness=3)


# ===================================================================== yardımcılar
def body_xf(xf, lean):
    return Xf(xf.tx, xf.ty, xf.s, xf.rot + lean, xf.flip)


def shake(t, t0, amp, dur=0.35, f=31):
    if t < t0 or t > t0 + dur:
        return 0.0, 0.0
    k = 1 - (t - t0) / dur
    return amp * k * math.sin((t - t0) * f * 6.28), amp * k * math.cos((t - t0) * f * 4.4)


def ice_cube(cv, X, x, y, s, t, alpha=1.0):
    bob = math.sin(t * 2.6) * 4
    c = X.child(x, y + bob, rot=math.sin(t * 1.9) * 0.05, s=s)
    front = [(-50, -40), (40, -40), (44, 40), (-48, 42)]
    topf = [(-50, -40), (40, -40), (70, -62), (-22, -64)]
    side = [(40, -40), (70, -62), (72, 18), (44, 40)]
    cv.part([('poly', c(side))], '#8fc3dc', spec=0.9, gloss=50, shadow=False, roundness=10, alpha=0.92 * alpha, sss=0.6)
    cv.part([('poly', c(front))], '#b9e2f2', spec=0.9, gloss=50, shadow=False, roundness=14, alpha=0.92 * alpha,
            sss=0.6, grooves=[(c([(-30, -20), (10, 25)]), 2)], groove_depth=2)
    cv.part([('poly', c(topf))], '#e6f7fd', spec=1.0, gloss=60, shadow=False, roundness=10, alpha=0.95 * alpha)


def water_over(cv, seabuf, ywl, x0=0, x1=W, wav=6.0, t=0.0, foam=True, X=None):
    """Su seviyesinin altında kalan her şeyi denizle örter (+ köpük çizgisi)."""
    xs = np.arange(W)
    line = ywl + wav * np.sin(xs * 0.035 + t * 4) + wav * 0.5 * np.sin(xs * 0.09 - t * 6)
    yy = np.arange(H)[:, None]
    m = np.clip((yy - line[None, :]) / 3.0, 0, 1).astype(np.float32)
    m[:, :max(0, int(x0))] = 0
    m[:, int(min(W, x1)):] = 0
    cv.img[:] = cv.img * (1 - m[..., None]) + seabuf * m[..., None]
    if foam:
        pts = [(float(x), float(line[int(x)])) for x in range(int(max(0, x0)), int(min(W, x1)), 24)]
        if len(pts) > 2:
            cv.part([('line', pts, 9)], '#eef3f2', bump=0.5, shadow=False, tex=0.7, alpha=0.85)


def splash(cv, cx, cy, k, seed=1, col='#e8f3f6', n=26, spread=1.0):
    rng = np.random.default_rng(seed)
    blobs = []
    for i in range(n):
        a = rng.uniform(-math.pi * 0.95, -math.pi * 0.05)
        sp = rng.uniform(250, 900) * spread
        x = cx + math.cos(a) * sp * k
        y = cy + math.sin(a) * sp * k + 900 * k * k
        r = rng.uniform(18, 60) * (1 - 0.4 * k)
        blobs.append(('poly', ellipse_pts(x, y, r, r * 1.1)))
    cv.part(blobs, col, bump=0.8, spec=0.8, gloss=40, shadow=False, sss=0.4, alpha=0.95)


# ===================================================================== SAHNELER
def shot_S1(cv, t):
    """0-2.4: Gün batımında dev kil gemi. Düdük. Pruvaya doğru itme."""
    k = ease(t / 2.4)
    cam = Camera(520 + 330 * k, 1120 + 60 * k, 1.0 + 0.6 * k ** 1.6, rot=0.01 * math.sin(t * 1.3))
    X = cam.xf()
    hy = X.pt(0, 1150)[1]
    sky(cv, hy)
    sun(cv, Camera(560, 1060, 1.0 + 0.15 * k).xf(), 250, 1085, 70)
    clouds(cv, Camera(560, 1060, 1.0 + 0.2 * k).xf(), t,
           [(150, 700, 70, 6), (820, 560, 90, -5), (420, 380, 60, 4), (950, 860, 55, -3)], '#f0a08e', 0.85)
    seabuf = np.zeros_like(cv.img)
    sea(cv, hy, t, X.pt(250, 0)[0], out=seabuf)
    bob = math.sin(t * 1.4) * 0.012
    ship_far(cv, X.child(470, 1200 + 6 * math.sin(t * 1.4), rot=bob, s=1.35), t)
    cv.light = Light()


def stage_bow(cv, t, cam, dof=2.2):
    X = cam.xf()
    hy = X.pt(0, 1110)[1]
    sky(cv, hy, span=1100 * cam.zoom)
    BG = Camera(cam.cx, cam.cy, 1 + (cam.zoom - 1) * 0.6, cam.rot).xf()
    sun(cv, BG, 980, 1060, 80)
    clouds(cv, BG, t, [(120, 620, 80, 8), (760, 480, 100, -6), (380, 300, 70, 5)], '#f3a891', 0.8)
    sea(cv, hy, t, X.pt(980, 0)[0], amp=1.0)
    bow_far(cv, X, t)
    if dof:
        cv.blur(dof)
    bow_deck(cv, X, t)
    return X


def shot_S2(cv, t):
    """2.4-7.0: İkili plan. Rüzgâr: 'Kollarını aç...' Fındık titrer, minicik kollarını açar."""
    lt = t - 2.4
    k = ease(lt / 4.6)
    cam = Camera(520 + 20 * k, 1070 + 10 * k, 1.02 + 0.1 * k, rot=0.006 * math.sin(t * 1.1))
    X = stage_bow(cv, t, cam)
    # --- Rüzgâr
    r_talk = lip('R', t)
    lean = 0.03 + 0.06 * ramp(t, 3.6, 4.2) - 0.06 * ramp(t, 4.9, 5.4)
    look_down = ramp(t, 5.4, 5.9)
    raise_arm = ramp(t, 2.9, 3.4) * (1 - ramp(t, 4.4, 4.9))
    rx = Xf(*X.pt(458, 1374), s=1.12 * X.s, rot=X.rot)
    ruzgar(cv, rx, lean=lean, armL=(-0.3, -1.6), armR=(lerp(0.3, 2.3, raise_arm), lerp(0.4, 0.3, raise_arm)),
           mo=r_talk, smile=lerp(0.75, 0.0, ramp(t, 6.1, 6.4)), lid=0.55 * blink(t, 3.1, 0.4) + 0.05,
           px=lerp(0.6, 0.3, look_down), py=lerp(-0.1, 0.9, look_down), browL=lerp(0.2, 1.2, ramp(t, 6.1, 6.3)),
           browR=0.9, wind=0.55, phase=t, head=lerp(0.0, 0.12, look_down))
    # --- Fındık
    f_talk = lip('F', t)
    arms_open = ramp(t, 5.15, 5.45)
    deadpan = ramp(t, 5.3, 5.6)
    fx = Xf(*X.pt(590, 1398), s=1.12 * X.s, rot=X.rot)
    shake_amt = 1.0 - ramp(t, 4.9, 5.2)
    look_up = ramp(t, 4.6, 4.95) * (1 - deadpan)
    findik(cv, fx, t=t, shake=shake_amt,
           armL=(lerp(0.3, -1.65, arms_open), lerp(1.4, 0.0, arms_open)),
           armR=(lerp(0.3, 1.65, arms_open), lerp(-1.4, 0.0, arms_open)),
           mo=f_talk, smile=lerp(-0.6, -0.1, deadpan), worry=lerp(1.0, 0.3, deadpan),
           lid=lerp(0.95, 0.6, deadpan) * blink(t, 2.3, 1.0) + 0.02,
           px=lerp(lerp(0.5 * math.sin(t * 9), -0.9, look_up), 0.15, deadpan),
           py=lerp(lerp(0.2, -0.9, look_up), 0.05, deadpan), bun=1.0 - deadpan, head=lerp(-0.08, 0.0, deadpan))
    bow_near_rail(cv, X, t)


def lift_pos(t):
    k = ease_out_back(clamp((t - 7.0) / 0.55), 1.3)
    x = lerp(590, 628, k)
    y = lerp(1398, 1318, k) - 60 * math.sin(math.pi * clamp((t - 7.0) / 0.55))
    return x, y


def hair_curtain(cv, X, t, src, dst):
    """Rüzgârın perçemi Fındık'ın yüzüne yapışır."""
    g = clamp((t - EVENTS['gust']) / 0.25)
    rel = 1 - ramp(t, 10.95, 11.3)
    k = min(1.04, spring(max(0.0, t - EVENTS['gust']), 2.2, 6.0)) * rel if t > EVENTS['gust'] else 0
    if k <= 0.01:
        return
    sx, sy = src
    dx, dy = dst
    paths, gr = [], []
    for j in range(4):
        off = (j - 1.5) * 15 * X.s
        cx_ = dx + 190 * X.s + 10 * math.sin(t * 13 + j)
        cy_ = (sy + dy) / 2 - 20 * X.s
        ex = lerp(cx_, dx - 85 * X.s, k)
        ey = lerp(cy_, dy + off + 6 * math.sin(t * 17 + j), k)
        pth = bezier((sx + off * 0.5, sy), (cx_, cy_ + off), (ex, ey), 16)
        paths.append(('poly', poly_tube(pth, 15 * X.s, 12 * X.s)))
        gr.append((pth, 2.5))
    cv.part(paths, '#8a3c1c', shadow_k=0.4, grooves=gr, groove_depth=6)


def shot_S3(cv, t, cam=None, dof=2.2):
    """7.0-11.4: Kaldırma, 'Uçuyorum!', rüzgâr perçemi yüze yapıştırır."""
    lt = t - 7.0
    if cam is None:
        k = ease(lt / 4.4)
        cam = Camera(560 + 30 * k, 1110 - 40 * k, 1.28 + 0.12 * k, rot=0.012 * math.sin(t * 0.9) - 0.02 * k)
    X = stage_bow(cv, t, cam, dof)
    fxw, fyw = lift_pos(t)
    fx = Xf(*X.pt(fxw, fyw), s=1.12 * X.s, rot=X.rot)
    fly = ramp(t, 7.55, 7.85)
    gust = t > EVENTS['gust']
    flail = ramp(t, 9.3, 9.5) * (1 - ramp(t, 10.9, 11.2))
    rx = Xf(*X.pt(540, 1384), s=1.12 * X.s, rot=X.rot)
    lean = 0.13
    rb = body_xf(rx, lean)
    # Rüzgâr'ın elleri Fındık'ın beline
    wL = fx.pt(-48, -112)
    wR = fx.pt(46, -112)
    tL = rb.inv(*wL)
    tR = rb.inv(*wR)
    r_eyes_closed = t < 10.75
    rinfo = ruzgar(cv, rx, lean=lean, tL=tL, tR=tR, mo=lip('R', t),
                   smile=0.9 if r_eyes_closed else 0.3, closed=r_eyes_closed, lid=0.6, wind=1.0, phase=t,
                   browL=0.6, browR=0.8, head=0.1)
    f_talk = lip('F', t)
    happy = ramp(t, 7.85, 8.0) * (1 - ramp(t, 8.95, 9.1))
    findik(cv, fx, t=t, shake=0.0 if t > 7.6 else 0.5, legs_dangle=1.0 - fly * 0.6,
           armL=(lerp(0.3, -1.75 - 0.5 * flail * math.sin(t * 22), fly), lerp(0.9, 0.1 + 0.6 * flail * math.sin(t * 19), fly)),
           armR=(lerp(0.3, 1.75 + 0.5 * flail * math.sin(t * 21 + 1), fly), lerp(-0.9, -0.1, fly)),
           mo=f_talk, smile=lerp(-0.5, 0.9, happy) if not gust else -0.6,
           closed=happy > 0.5, lid=1.0 if gust else 0.95, worry=lerp(1.0, 0.0, happy) if not gust else 0.2,
           px=0.0, py=-0.2 if gust else 0.0, bun=1.0, blush=0.6 + 0.4 * happy, lower=0.15 if gust else 0)
    # sağ kol öne (Fındık'tan sonra çizilir: önde kalır)
    hb = fx.pt(0, -168 - 4 - 86)
    hair_curtain(cv, X, t, (rinfo['head'][0] - 20 * X.s, rinfo['head'][1] - 70 * X.s), (hb[0] + 5 * X.s, hb[1] + 98 * X.s))
    bow_near_rail(cv, X, t)
    return X, fx, rx


def arm_over(cv, rb, target, X):
    from characters import ik2, R_PAL
    sh = (34, -445 + 22)
    tl = rb.inv(*target)
    e, h = ik2(sh[0], sh[1], tl[0], tl[1], 115, 105, 1)
    cv.part([('poly', rb(tube_pts(sh, e, 17, 14)))], R_PAL['shirt'], shadow_k=0.3)
    cv.part([('poly', rb(ellipse_pts(e[0], e[1], 17, 15)))], R_PAL['shirt'], shadow_k=0.25)
    cv.part([('poly', rb(tube_pts(e, h, 11, 10)))], R_PAL['skin'], shadow_k=0.3)
    ang = math.atan2(h[1] - e[1], h[0] - e[0])
    cv.part([('poly', rb(ellipse_pts(h[0] + 8 * math.cos(ang), h[1] + 8 * math.sin(ang), 21, 15, ang)))],
            R_PAL['skin'], shadow_k=0.35)


def shot_S4(cv, t):
    """11.4-14.8: Fındık'ın gözlerinde buz dağı -> kamera Rüzgâr'a: 'Şşş... anı bozma.'"""
    fxw, fyw = lift_pos(t)
    head_f = (fxw + 2, fyw - (168 + 4 + 86) * 1.12)
    head_r = (530, 1384 - 640 * 1.12)
    pan = ramp(t, 12.45, 12.85)
    z = lerp(3.0, 2.4, pan) + 0.06 * (t - 11.4)
    cx, cy = lerp(head_f[0], head_r[0] + 30, pan), lerp(head_f[1] + 10, head_r[1] + 40, pan)
    sx, sy = shake(t, 11.65, 14, 0.7, 27)
    cam = Camera(cx + sx / z, cy + sy / z, z, rot=lerp(-0.03, 0.02, pan))
    X = stage_bow(cv, t, cam, dof=7)
    fx = Xf(*X.pt(fxw, fyw), s=1.12 * X.s, rot=X.rot)
    rx = Xf(*X.pt(540, 1384), s=1.12 * X.s, rot=X.rot)
    lean = 0.13
    rb = body_xf(rx, lean)
    wL, wR = fx.pt(-48, -112), fx.pt(46, -112)
    shh = ramp(t, 12.7, 12.9)
    ruzgar(cv, rx, lean=lean, tL=rb.inv(*wL), tR=rb.inv(*wR), mo=lip('R', t) * (0.5 if t < 13.4 else 1.0),
           shape='shh' if 12.75 < t < 13.4 else None, smile=0.9, closed=True, wind=1.0, phase=t, browL=0.8,
           browR=0.5, head=0.1, finger_shh=shh * (1 - ramp(t, 13.4, 13.6)))
    terror = ramp(t, 11.45, 11.6)
    refl = ramp(t, 11.4, 11.55)
    findik(cv, fx, t=t, shake=terror, armL=(-1.75, 0.1), armR=(1.75, -0.1), mo=lip('F', t) + 0.3 * terror,
           mouth_shape='O', worry=1.2, lid=1.0, px=0.25, py=-0.1, refl=refl, bun=1.0, blush=0.2, lower=0.0)
    bow_near_rail(cv, X, t)


# --- S5: su hizası
def shot_S5(cv, t):
    """14.8-19.0: Dev gemi minicik buz küpüne 'tık' diye çarpar ... ve kırılır."""
    sx, sy = shake(t, EVENTS['tik'], 10, 0.3, 35)
    sx2, sy2 = shake(t, EVENTS['crack'], 26, 0.8, 22)
    cam = Camera(540 + sx + sx2 + 6 * math.sin(t * 0.7), 960 + sy + sy2, 1.0, rot=0.004 * math.sin(t * 0.8))
    X = cam.xf()
    hy = X.pt(0, 930)[1]
    sky(cv, hy, span=900)
    sun(cv, X, 860, 900, 60)
    clouds(cv, X, t, [(150, 520, 70, 6), (800, 300, 90, -6)], '#f3a891', 0.8)
    seabuf = np.zeros_like(cv.img)
    sea(cv, hy, t, X.pt(860, 0)[0], amp=1.4, out=seabuf)
    ship_x = 650 - 640 * (EVENTS['tik'] - t) if t < EVENTS['tik'] else 650 - 14 * math.sin(clamp((t - EVENTS['tik']) / 0.25) * math.pi)
    WL = 1400
    # gövde iki parça: kıç (sabit) + pruva (kırılır)
    crack_x = -210  # yerel
    crack = [(crack_x + 20, 0), (crack_x - 10, -160), (crack_x + 30, -300), (crack_x - 25, -470), (crack_x + 15, -640),
             (crack_x - 20, -820), (crack_x + 10, -1050)]
    cprog = ramp(t, EVENTS['creak'], EVENTS['crack'] + 0.05)
    fall = clamp((t - EVENTS['crack'] - 0.1) / 0.75)
    fall_e = fall ** 2
    stem_top = (120, -1050)
    rear = [(-1400, 60), (crack[0][0], 60)] + crack + [(-1400, -1050)]
    front = [(crack[0][0], 60)] + crack + [stem_top, (90, -900), (40, -500), (10, -150), (0, 0), (-10, 60)]
    front = [front[0]] + crack[::-1][::-1] + [stem_top, (90, -900), (40, -500), (10, -150), (0, 0), (-10, 60)]
    base = X.child(ship_x, WL)
    piv = (crack[0][0], 0)
    fr = base.child(piv[0], piv[1], rot=0.42 * fall_e)
    fr = Xf(fr.tx, fr.ty + 380 * fall_e, fr.s, fr.rot)
    front_l = [(x - piv[0], y - piv[1]) for x, y in front]

    def hull_piece(xf, pts, local_off):
        cv.part([('poly', xf(pts))], HULL, spec=0.35, gloss=20, shadow=False, roundness=40)
        stripe = [(x, -1000) for x in np.linspace(-1400, 110, 20)]
        stripe = [(x - local_off[0], y - local_off[1]) for x, y in stripe]
        cv.part([('line', xf(stripe), 9)], '#d6b158', shadow=False, roundness=4, spec=0.7,
                clip=[('poly', xf(pts))])
        for row, yy in enumerate((-860, -720)):
            for x in np.arange(-1350, 60, 70):
                if x + 40 > 0 and yy < -600:
                    continue
                cv.part([('poly', xf(ellipse_pts(x - local_off[0], yy - local_off[1], 13, 13)))], '#c9a24e',
                        shadow=False, roundness=3, spec=0.6, clip=[('poly', xf(pts))])
                cv.part([('poly', xf(ellipse_pts(x - local_off[0], yy - local_off[1], 8, 8)))], '#ffd88a',
                        emissive=0.8, shadow=False, tex=0, clip=[('poly', xf(pts))])

    intact = t < EVENTS['creak']
    if intact:
        hull_piece(base, [(-1400, 60), (-10, 60), (0, 0), (10, -150), (40, -500), (90, -900), stem_top,
                          (-1400, -1050)], (0, 0))
    else:
        hull_piece(base, rear, (0, 0))
    # kıç tarafı korkuluk
    rail_pts = [(x, -1130) for x in np.linspace(-1400, crack_x, 12)]
    cv.part([('line', base(rail_pts), 10), ('line', base([(x, -1090) for x in np.linspace(-1400, crack_x, 12)]), 7)] +
            [('line', base([(x, -1050), (x, -1130)]), 7) for x in np.linspace(-1400, crack_x, 12)],
            '#f1ece0', shadow_k=0.3, roundness=4)
    # pruva parçası + kafalar
    peek = ease_out_back(clamp((t - 16.15) / 0.3), 2.0)
    if peek > 0:
        rh = fr.child(-80 - piv[0], -1095 + 160 * (1 - peek), rot=-0.05)
        ruzgar(cv, Xf(rh.tx, rh.ty + 571 * 1.0 * rh.s, rh.s * 1.0, rh.rot), head_only=True, mo=lip('R', t),
               smile=0.8 if t < EVENTS['crack'] else -0.3, lid=0.6 if t < EVENTS['creak'] else 1.0,
               px=0.5, py=0.8 if t < 17.9 else 0.0, wind=0.4, phase=t,
               browR=0.9 if t < EVENTS['creak'] else 1.4, browL=0.2 if t < EVENTS['creak'] else 1.3)
        fh = fr.child(40 - piv[0], -1085 + 180 * (1 - peek), rot=0.05)
        findik(cv, Xf(fh.tx, fh.ty + 258 * 0.95 * fh.s, fh.s * 0.95, fh.rot), t=t, draw_body=False,
               mo=0.6 if t > EVENTS['crack'] else 0.0, mouth_shape='O' if t > EVENTS['creak'] else None,
               worry=1.2, lid=1.0, px=0.6 if t < 17.9 else -0.3, py=0.9 if t < 17.9 else -0.2,
               shake=1.0 if t > EVENTS['creak'] else 0.0)
    if not intact:
        hull_piece(fr, front_l, piv)
    # ad levhası
    cv.part([], '#d6b158', mask_fn=text_mask_fn('TİTANİK', *fr.pt(-55 - piv[0], -960 - piv[1]), 44 * fr.s,
                                                  rot=-math.degrees(fr.rot)), spec=0.7, shadow_k=0.3)
    rp = [(x - piv[0], -1130) for x in np.linspace(crack_x, 120, 6)]
    cv.part([('line', fr(rp), 10), ('line', fr([(x - piv[0], -1090) for x in np.linspace(crack_x, 112, 6)]), 7)] +
            [('line', fr([(x - piv[0], -1050), (x - piv[0], -1130)]), 7) for x in np.linspace(crack_x, 110, 6)],
            '#f1ece0', shadow_k=0.3, roundness=4)
    # çatlak
    if cprog > 0:
        n = max(2, int(len(crack) * cprog + 0.999))
        cp = crack[:n]
        cv.part([('line', base(cp), 8 + 10 * fall)], '#0a0809', shadow=False, roundness=3, bump=0.2, tex=0)
    # su
    sxw, syw = X.pt(0, WL)
    water_over(cv, seabuf, syw, t=t, wav=7)
    ice_cube(cv, X, 720, WL - 6, 1.0, t)
    if t > EVENTS['tik'] and t < EVENTS['tik'] + 0.5:
        k = (t - EVENTS['tik']) / 0.5
        cv.part([], '#ffffff', mask_fn=text_mask_fn('tık', *X.pt(800, WL - 170 - 60 * k), 70), alpha=1 - k,
                emissive=0.4, shadow_k=0.2)
    if t > EVENTS['splash'] - 0.25:
        splash(cv, *X.pt(ship_x - 100, WL), clamp((t - EVENTS['splash'] + 0.25) / 0.5) * 0.9, seed=4, n=40, spread=1.5)


# --- S6: kapı
def shot_S6(cv, t):
    """19.0-24.6: Kapıda yer var mı? Yok."""
    lt = t - 19.0
    cam = Camera(540 + 4 * math.sin(t * 0.6), 960, 1.0 + 0.012 * lt, rot=0.004 * math.sin(t * 0.5))
    X = cam.xf()
    hy = X.pt(0, 330)[1]
    stops = [(-1.0, '#1b1d45'), (-0.4, '#3d3a72'), (-0.15, '#8a5c8e'), (0.0, '#e7938a')]
    sky(cv, hy, stops, span=400)
    rng = np.random.default_rng(5)
    for i in range(18):
        x, y = rng.uniform(30, 1050), rng.uniform(20, hy - 60)
        r = rng.uniform(2, 4.5) * (0.7 + 0.3 * math.sin(t * 3 + i))
        cv.part([('poly', X(ellipse_pts(x, y, r, r)))], '#fff6da', emissive=0.9, shadow=False, tex=0)
    seabuf = np.zeros_like(cv.img)
    sea(cv, hy, t, 600, near='#1e4d6a', far='#a86f86', amp=0.6, speed=0.6, glitter=0.4, out=seabuf)
    # arkadan süzülen buz küpü (keyifli)
    ice_cube(cv, X, 120 + 55 * lt, 560, 0.55, t * 0.8)
    # kapı
    bob = math.sin(t * 1.6) * 6
    dr = X.child(510, 1170 + bob, rot=-0.06 + 0.02 * math.sin(t * 1.2))
    door = [(-300, -165), (300, -175), (320, 175), (-320, 185)]
    cv.part([('poly', dr(door))], '#8a5a34', shadow_k=0.5, roundness=16,
            grooves=[(dr([(-280, -100 + k * 40), (290, -110 + k * 42)]), 1.4) for k in range(7)] +
            [(dr([(-250, -130), (-20, -134), (-20, -20), (-250, -16), (-250, -130)]), 3),
             (dr([(20, -136), (260, -140), (264, -24), (20, -20), (20, -136)]), 3),
             (dr([(-252, 20), (-20, 18), (-20, 140), (-254, 144), (-252, 20)]), 3),
             (dr([(20, 18), (268, 14), (276, 136), (20, 140), (20, 18)]), 3)], groove_depth=5)
    cv.part([('poly', dr(ellipse_pts(270, 0, 16, 16)))], '#d6b158', spec=0.8, gloss=40, shadow_k=0.4)
    # su halkaları
    for k in range(3):
        a = ((t * 0.5 + k / 3) % 1)
        rp = ellipse_pts(0, 0, 340 + 160 * a, 200 + 90 * a, n=64)
        cv.part([('line', dr(rp + rp[:1]), 4)],
                '#9fc4d4', flat=True, alpha=0.35 * (1 - a), shadow=False, tex=0)
    # Fındık yatıyor (başı solda)
    spread = ease_out_back(clamp((t - EVENTS['spread']) / 0.35), 2.0)
    looks = ramp(t, 21.2, 21.5)
    smug = ramp(t, 22.7, 23.0)
    fl = dr.child(lerp(150, 175, spread), 10, rot=-math.pi / 2, s=1.05)
    findik(cv, fl, t=t, armL=(lerp(-0.25, -2.2, spread), lerp(-0.3, 0.0, spread)),
           armR=(lerp(0.25, 2.2, spread), lerp(0.3, 0.0, spread)), mo=lip('F', t),
           closed=(t < 21.2) or smug > 0.5, closedL=False, lid=lerp(0.5, 0.75, looks), worry=lerp(-0.4, 0.1, looks),
           smile=lerp(0.7, -0.1, looks) if smug < 0.5 else 0.9, px=0.0, py=lerp(0.0, 0.9, looks), blush=0.8,
           head=0.0, bun=0.0)
    # Rüzgâr: sudan kafa
    pop = spring(max(0.0, t - 19.55), 1.6, 4.0) if t > 19.55 else 0
    sink = ease(clamp((t - 22.9) / 1.3))
    hx, hy_ = 870, 1130
    s = 1.45
    dyw = (1 - pop) * 220 + sink * 120
    plead = ramp(t, 20.2, 20.4)
    rxf = Xf(hx - 8 * s, hy_ + dyw + 571 * s, s, 0.08)
    ruzgar(cv, rxf, head_only=True, hair_wet=1.0, wind=0.0, mo=lip('R', t), smile=lerp(0.1, -0.5, plead),
           lid=lerp(0.7, 1.0, plead) * blink(t, 2.4, 0.2) + 0.02, px=-0.8, py=lerp(0.2, 0.4, plead),
           browL=lerp(0.4, 1.5, plead), browR=lerp(0.4, 1.6, plead) - 0.5 * sink, phase=t)
    water_over(cv, seabuf, hy_ + 75, x0=hx - 200, x1=hx + 210, wav=5, t=t, foam=True)
    if lt < 0.5:  # düşen su damlaları
        splash(cv, 540, 900, 0.6 + lt, seed=9, n=30, spread=1.3)
    # final başlığı
    if t > EVENTS['title']:
        k = ease_out_back(clamp((t - EVENTS['title']) / 0.45), 1.6)
        y = lerp(-200, 470, k)
        cv.part([], '#e8574e', mask_fn=text_mask_fn('CLAY', 540, y - 70, 150), spec=0.4, shadow_k=0.5)
        cv.part([], '#f2c84b', mask_fn=text_mask_fn('REPLAY', 540, y + 80, 150), spec=0.4, shadow_k=0.5)
        a = ramp(t, EVENTS['title'] + 0.5, EVENTS['title'] + 0.8)
        if a > 0:
            cv.part([], '#f7f1e3', mask_fn=text_mask_fn('Bölüm 1 · TİTANİK', 540, y + 200, 52), alpha=a,
                    shadow_k=0.4)


SHOT_FN = dict(S1_gemi_genel=shot_S1, S2_pruva_ikili=shot_S2, S3_ucuyorum=shot_S3, S4_buzdagi=shot_S4,
               S5_tik=shot_S5, S6_kapi=shot_S6)


def shot_of(t):
    for name, a, b in SHOTS:
        if a <= t < b:
            return name
    return SHOTS[-1][0]


def subs(img, t):
    for lid, who, st, txt in LINES:
        a, b = LINE_T[lid]
        nxt = [l[2] for l in LINES if l[2] > st]
        end = min(b + 0.45, nxt[0] - 0.05) if nxt else b + 0.6
        if st - 0.03 <= t < end and not (t > EVENTS['title']):
            col = '#ffe08a' if who == 'R' else '#ffb3c4'
            return subtitle(img, txt, y=1580, size=66, who=NAMES[who], who_col=col)
    return img


def render_pose(fi):
    t = fi / FPS
    name = shot_of(t)
    cv = Canvas(Light(key=(0.62, -0.45, 0.66), rim=(1, -0.3, 0.1)), frame_seed=fi // 2)
    if name == 'S6_kapi':
        cv.light = Light(key=(0.35, -0.6, 0.72), key_col='#f3d9e6', amb=0.45, amb_col='#6f78b8', rim_col='#ff9e86',
                         rim=(1, -0.3, 0.1), rim_k=0.35, shadow_off=(-8, 12))
    SHOT_FN[name](cv, t)
    return cv.finish(grain_idx=fi // 2, vignette=0.5)


def pose_index(fi):
    """Stop-motion: her poz 2 kare tutulur (12 poz/sn). Kesmelerde yeni sahnenin ilk pozu kullanılır."""
    pe = (fi // 2) * 2
    if shot_of(pe / FPS) != shot_of(fi / FPS):
        return fi
    return pe


def render_frame(fi):
    return subs(render_pose(pose_index(fi)), fi / FPS)


OUT_DIR = os.path.join(HERE, 'build', 'frames')


def job(fi):
    p = os.path.join(OUT_DIR, f'f{fi:04d}.jpg')
    if os.path.exists(p):
        return fi
    pi = pose_index(fi)
    base = render_pose(pi)
    subs(base, fi / FPS).save(p, quality=95)
    # aynı pozu paylaşan sonraki kare
    nxt = fi + 1
    if nxt < int(DURATION * FPS) and pose_index(nxt) == pi:
        subs(base, nxt / FPS).save(os.path.join(OUT_DIR, f'f{nxt:04d}.jpg'), quality=95)
    return fi


if __name__ == '__main__':
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', default='')
    ap.add_argument('--jobs', type=int, default=os.cpu_count())
    a = ap.parse_args()
    os.makedirs(OUT_DIR, exist_ok=True)
    if a.only:
        pdir = os.path.join(HERE, 'build', 'preview')
        os.makedirs(pdir, exist_ok=True)
        for ts in a.only.split(','):
            fi = int(round(float(ts) * FPS))
            render_frame(fi).save(os.path.join(pdir, f'p_{float(ts):05.2f}.jpg'), quality=90)
            print('ok', ts, flush=True)
    else:
        from multiprocessing import Pool
        nf = int(DURATION * FPS)
        todo = [f for f in range(nf) if pose_index(f) == f]
        with Pool(a.jobs) as pool:
            for i, fi in enumerate(pool.imap_unordered(job, todo, chunksize=1)):
                if i % 24 == 0:
                    print('poz', i, '/', len(todo), flush=True)
