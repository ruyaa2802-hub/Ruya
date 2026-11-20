# -*- coding: utf-8 -*-
"""Sahneler: sokak dünyası, pencere içleri, ters açı (cam arkası),
hayal odası, perspektif final sokağı, yazı kartları."""
import math
import cairo
import numpy as np
from core import *

GROUND = 1500.0

# =============================================================== zamanlama
T_STOP = 31.6          # kız büyük pencerenin önünde durur
T_REV = 35.2           # ters açıya geçiş (cam arkası yüz)
T_DREAM = 44.0         # hayale geçiş
T_BACK = 52.6          # hayal dağılmaya başlar
T_RET = 54.6           # soğuk sokağa dönüş tamam
T_PERSP = 62.4         # arkadan uzaklaşma
T_FADE = 73.0          # karar
T_QUOTE = 75.5
T_TITLE = 82.5
T_END = 90.0


# =============================================================== kızın yürüyüşü
_DT = 1 / 240.0
_TS = np.arange(0, 40, _DT)


def _speed(t):
    if t < 12.5:
        return 92.0
    if t < 14.0:
        return lerp(92, 84, ease((t - 12.5) / 1.5))
    if t < 30.0:
        return 84.0 - 10.0 * ramp(t, 27.0, 30.0)
    return 74.0 * (1 - ease((t - 30.0) / (T_STOP - 30.0))) if t < T_STOP else 0.0


_V = np.array([_speed(t) for t in _TS])
_X = 600 + np.concatenate([[0], np.cumsum(_V[:-1] * _DT)])


def girl_x(t):
    t = clamp(t, 0, 39.99)
    return float(np.interp(t, _TS, _X))


def girl_v(t):
    return _speed(clamp(t, 0, 39.99))


STEP = 52.0


def footstep_times():
    """Yürüme adımları (ses için)"""
    out = []
    last = int((_X[0] - 600) // STEP)
    for i in range(1, len(_TS)):
        k = int((_X[i] - 600) // STEP)
        if k != last and _V[i] > 15:
            out.append(float(_TS[i]))
        last = k
    return out


# özel pencereler
XS = girl_x(T_STOP)
SPECIAL = [
    dict(kind='mother', cx=girl_x(16.6) + 70, cy=1000, w=236, h=290),
    dict(kind='father', cx=girl_x(21.8) + 70, cy=690, w=236, h=290),
    dict(kind='family', cx=girl_x(26.0) + 40, cy=820, w=236, h=290),
    dict(kind='big', cx=XS - 105, cy=1150, w=400, h=290),
]


# =============================================================== kamera
def _cam_keys():
    W1, W2, W3, W4 = SPECIAL
    k = [
        (0.0, girl_x(0) + 260, 1010, 0.60),
        (3.0, girl_x(3) + 210, 1060, 0.72),
        (8.5, girl_x(8.5) + 40, 1262, 2.3),
        (12.4, girl_x(12.4) + 10, 1300, 4.1),
        (14.6, girl_x(14.6) + 80, 1150, 1.75),
        (16.8, W1['cx'] + 10, 1130, 1.72),
        (19.4, W1['cx'] + 150, 1120, 1.68),
        (21.9, W2['cx'] + 10, 1085, 1.55),
        (24.2, W2['cx'] + 140, 1090, 1.58),
        (26.4, W3['cx'] + 20, 1105, 1.62),
        (28.8, W3['cx'] + 170, 1120, 1.62),
        (31.4, W4['cx'] + 80, 1150, 1.6),
        (35.5, W4['cx'] + 65, 1190, 1.95),
    ]
    return k


CAMK = _cam_keys()


def _cr(p0, p1, p2, p3, u):
    return 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u +
                  (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u)


def street_cam(t):
    K = CAMK
    if t <= K[0][0]:
        return K[0][1:]
    if t >= K[-1][0]:
        return K[-1][1:]
    for i in range(len(K) - 1):
        if K[i][0] <= t < K[i + 1][0]:
            break
    k0 = K[max(i - 1, 0)]
    k1, k2 = K[i], K[i + 1]
    k3 = K[min(i + 2, len(K) - 1)]
    u = (t - k1[0]) / (k2[0] - k1[0])
    u = u * u * (3 - 2 * u) * 0.35 + u * 0.65   # hafif yumuşatma
    cx = _cr(k0[1], k1[1], k2[1], k3[1], u)
    cy = _cr(k0[2], k1[2], k2[2], k3[2], u)
    z = math.exp(_cr(math.log(k0[3]), math.log(k1[3]), math.log(k2[3]), math.log(k3[3]), u))
    return cx, cy, z


# =============================================================== bina üretimi
PALETTE = ['#8796b8', '#9c90b2', '#86a2ad', '#a5998e', '#9aa6c0', '#8f8aa6', '#a3a0b8', '#7f9aa8']


def _gen_buildings():
    out = []
    x = -1600.0
    i = 0
    while x < 9000:
        w = 480 + hn(i, 1) * 360
        h = 1000 + hn(i, 2) * 420
        for sw in SPECIAL:
            l, r = sw['cx'] - sw['w'] / 2 - 70, sw['cx'] + sw['w'] / 2 + 70
            if l < x + w < r:
                w = r - x
            h = max(h, GROUND - sw['cy'] + sw['h'] / 2 + 150) if x < sw['cx'] < x + w else h
        out.append(dict(x0=x, w=w, h=h, col=PALETTE[int(hn(i, 3) * len(PALETTE))], i=i,
                        roof=int(hn(i, 4) * 3)))
        x += w + 6
        i += 1
    return out


BUILDINGS = _gen_buildings()


def _gen_windows():
    wins = []
    for b in BUILDINGS:
        cols = max(2, int((b['w'] - 80) // 150))
        sp = (b['w'] - 60) / cols
        top = GROUND - b['h'] + 140
        rows = int((GROUND - 300 - top) // 245) + 1
        for r in range(rows):
            for c in range(cols):
                cx = b['x0'] + 30 + sp * (c + 0.5)
                cy = top + r * 245 + 70
                ww, wh = 98, 138
                ok = True
                for sw in SPECIAL:
                    if abs(cx - sw['cx']) < (ww + sw['w']) / 2 + 40 and abs(cy - sw['cy']) < (wh + sw['h']) / 2 + 40:
                        ok = False
                if not ok:
                    continue
                seed = b['i'] * 100 + r * 10 + c
                lit = hn(seed, 9) < 0.34
                wins.append(dict(cx=cx, cy=cy, w=ww, h=wh, lit=lit, seed=seed,
                                 tone=hn(seed, 11), curtain=hn(seed, 12) < 0.5))
    return wins


WINDOWS = _gen_windows()
LAMPS = [50 + 760 * i for i in range(-2, 13)]
for _i, _lx in enumerate(LAMPS):
    for _sw in SPECIAL:
        if _sw['cx'] - _sw['w'] / 2 - 60 < _lx < _sw['cx'] + _sw['w'] / 2 + 60:
            LAMPS[_i] = _sw['cx'] + _sw['w'] / 2 + 100


def lamp_light(x):
    """Sokak lambasına yakınlık 0..1"""
    best = 0.0
    for lx in LAMPS:
        d = (x - (lx + 40)) / 260.0
        best = max(best, math.exp(-d * d))
    return best


# =============================================================== gökyüzü
def draw_sky(ctx, t, cx=0.0, top='#1d2a4f', mid='#3b4f7d', low='#8a8db4'):
    G.night = 0.0; G.warm = 0.0
    p = lingrad(0, 0, 0, H, [(0, top), (0.55, mid), (1.0, low)], graded=False)
    ctx.set_source(p)
    ctx.paint()
    # yıldızlar (titrek)
    for i in range(45):
        sx = (hn(i, 1) * 1400 - cx * 0.02) % 1200 - 60
        sy = hn(i, 2) * 900
        tw = 0.5 + 0.5 * math.sin(t * (1.5 + hn(i, 3) * 2) + i)
        r = 1.2 + hn(i, 4) * 1.6
        ctx.set_source_rgba(1, 0.97, 0.88, (0.25 + 0.5 * tw) * (1 - sy / 1100))
        ctx.arc(sx, sy, r, 0, 2 * math.pi)
        ctx.fill()
    # hilal ay
    mx, my = 820 - cx * 0.01 % 50, 260
    glow(ctx, mx, my, 160, '#c9d4ff', a=0.18)
    ctx.set_source_rgba(0.98, 0.95, 0.85, 0.95)
    ctx.arc(mx, my, 34, 0, 2 * math.pi)
    ctx.fill()
    ctx.set_source_rgba(*hexc(mid), 1)
    r0 = hexc(top); r1 = hexc(mid)
    ctx.set_source_rgba(r0[0] * 0.5 + r1[0] * 0.5, r0[1] * 0.5 + r1[1] * 0.5, r0[2] * 0.5 + r1[2] * 0.5, 1)
    ctx.arc(mx + 14, my - 8, 31, 0, 2 * math.pi)
    ctx.fill()


def apply_cam(ctx, cx, cy, z, par=1.0, cy_par=None):
    ctx.translate(W / 2, H / 2)
    ctx.scale(z, z)
    ctx.translate(-cx * par, -(cy if cy_par is None else cy * cy_par))


# =============================================================== pencere içleri
def room_bg(ctx, x0, y0, w, h, wall='#f2c98a', t=0.0, lampx=0.5):
    p = lingrad(x0, y0, x0, y0 + h, [(0, shade(wall, 1.08)), (0.7, wall), (1, shade(wall, 0.82))])
    ctx.set_source(p)
    ctx.rectangle(x0, y0, w, h)
    ctx.fill()
    # duvar kağıdı deseni
    for i in range(6):
        xx = x0 + w * (i + 0.5) / 6
        stroke(ctx, [(xx, y0), (xx, y0 + h)], shade(wall, 0.93), 2.0, a=0.5, seed=900 + i)
    # sarkan lamba
    lx = x0 + w * lampx + math.sin(t * 0.9) * 2
    stroke(ctx, [(lx, y0), (lx, y0 + h * 0.18)], '#5a4030', 1.5, seed=911)
    shade_pts = [(lx - 22, y0 + h * 0.25), (lx - 10, y0 + h * 0.17), (lx + 10, y0 + h * 0.17), (lx + 22, y0 + h * 0.25)]
    paint(ctx, shade_pts, '#e9a65a', lw=1.1, seed=913)
    glow(ctx, lx, y0 + h * 0.27, h * 0.75, '#ffd58a', a=0.38)


def room_mother(ctx, x0, y0, w, h, t):
    room_bg(ctx, x0, y0, w, h, '#f1c88d', t, 0.42)
    # dolap ve çerçeve
    paint(ctx, [(x0 + w * 0.70, y0 + h * 0.3), (x0 + w * 0.98, y0 + h * 0.3), (x0 + w * 0.98, y0 + h),
                (x0 + w * 0.70, y0 + h)], '#c99a68', lw=1.2, seed=921)
    paint(ctx, [(x0 + w * 0.1, y0 + h * 0.28), (x0 + w * 0.26, y0 + h * 0.28), (x0 + w * 0.26, y0 + h * 0.42),
                (x0 + w * 0.1, y0 + h * 0.42)], '#e8dcc0', lw=1.2, seed=923)
    cyc = (t % 6.0) / 6.0
    # anne: tabakla masaya gelir, koyar, geri döner
    if cyc < 0.4:
        px = lerp(0.82, 0.50, ease(cyc / 0.4)); armh = 1.0; plate_hand = True
    elif cyc < 0.6:
        px = 0.50; armh = 1.0 - ease((cyc - 0.4) / 0.2) * 0.6; plate_hand = cyc < 0.52
    else:
        px = lerp(0.50, 0.82, ease((cyc - 0.6) / 0.4)); armh = 0.4; plate_hand = False
    mx = x0 + w * px
    walkb = math.sin(t * 7) * 1.5 if (cyc < 0.4 or cyc > 0.6) else 0
    lean = 0.12 if 0.4 <= cyc < 0.6 else 0
    ty = y0 + h * 0.80
    ctx.save()
    ctx.translate(mx, ty); ctx.rotate(-lean); ctx.translate(-mx, -ty)
    person(ctx, mx, ty + walkb, 150, '#c4707a', '#5a3428',
           dict(armL=-0.9 * armh - 0.2, armLb=-0.6, armR=-0.4 - 0.5 * armh, armRb=-0.8, tilt=-0.1), seed=931,
           hairstyle='bun', facing=-0.6)
    if plate_hand:
        paint(ctx, ell(mx - 34, ty - 75 + 50 * (1 - armh), 18, 5, n=10), '#fbf6ec', lw=1.0, seed=937)
    ctx.restore()
    # masa
    table(ctx, x0 + w * 0.36, y0 + h * 0.8, w * 0.62, h * 0.4, seed=941)
    paint(ctx, ell(x0 + w * 0.22, y0 + h * 0.79, 16, 4.5, n=10), '#fbf6ec', lw=1.0, seed=951)
    if cyc > 0.5 or cyc < 0.05:
        paint(ctx, ell(x0 + w * 0.40, y0 + h * 0.79, 16, 4.5, n=10), '#fbf6ec', lw=1.0, seed=953)
    # buhar çıkan tencere
    paint(ctx, [(x0 + w * 0.5, y0 + h * 0.77), (x0 + w * 0.6, y0 + h * 0.77), (x0 + w * 0.59, y0 + h * 0.72),
                (x0 + w * 0.51, y0 + h * 0.72)], '#b35e48', lw=1.1, seed=955)
    for i in range(2):
        ph = (t * 0.5 + i * 0.5) % 1
        sx = x0 + w * 0.55 + math.sin(ph * 6 + i) * 5
        stroke(ctx, [(sx, y0 + h * 0.70), (sx + 4, y0 + h * (0.66 - ph * 0.08)), (sx - 2, y0 + h * (0.6 - ph * 0.1))],
               '#ffffff', 2.0, a=0.35 * (1 - ph), seed=957 + i)


def room_father(ctx, x0, y0, w, h, t):
    room_bg(ctx, x0, y0, w, h, '#f3cf95', t, 0.7)
    # kanepe
    paint(ctx, [(x0 - 5, y0 + h * 0.72), (x0 + w * 0.45, y0 + h * 0.72), (x0 + w * 0.45, y0 + h),
                (x0 - 5, y0 + h)], '#9e6f8a', lw=1.2, seed=961)
    paint(ctx, [(x0 + w * 0.05, y0 + h * 0.08), (x0 + w * 0.3, y0 + h * 0.08), (x0 + w * 0.3, y0 + h * 0.3),
                (x0 + w * 0.05, y0 + h * 0.3)], '#d9e2d0', lw=1.2, seed=963)
    lift = 0.5 - 0.5 * math.cos(t * 1.7)
    fx = x0 + w * 0.6
    fy = y0 + h * 1.02
    person(ctx, fx, fy, 175, '#6f8f8a', '#3a2a24',
           dict(armL=-2.4 - 0.4 * lift, armLb=0.5, armR=-2.4 - 0.4 * lift, armRb=0.5, tilt=-0.15 * lift - 0.05),
           seed=971, facing=0.1)
    # kucaktaki çocuk yukarı kalkıyor
    cy = fy - 175 * (0.98 + 0.22 * lift)
    sw = math.sin(t * 1.7) * 0.15
    ctx.save()
    ctx.translate(fx, cy)
    ctx.rotate(sw)
    person(ctx, 0, 0, 70, '#e7a5a0', '#5a3a2a',
           dict(armL=-2.6, armLb=0.2, armR=-2.4, armRb=0.3, tilt=0.2, bob=0), seed=981, hairstyle='child')
    for side in (-1, 1):
        stroke(ctx, [(side * 5, 20), (side * 7 + math.sin(t * 5 + side) * 4, 40)], '#f0c9a8', 6, seed=989 + side)
    ctx.restore()


def _family(ctx, x0, y0, w, h, t, big=False):
    room_bg(ctx, x0, y0, w, h, '#f4c98c', t, 0.5)
    # arka raf ve resim
    paint(ctx, [(x0 + w * 0.08, y0 + h * 0.14), (x0 + w * 0.2, y0 + h * 0.14), (x0 + w * 0.2, y0 + h * 0.3),
                (x0 + w * 0.08, y0 + h * 0.3)], '#dfe6cf', lw=1.1, seed=1001)
    paint(ctx, [(x0 + w * 0.78, y0 + h * 0.16), (x0 + w * 0.92, y0 + h * 0.16), (x0 + w * 0.92, y0 + h * 0.34),
                (x0 + w * 0.78, y0 + h * 0.34)], '#c9d6e6', lw=1.1, seed=1003)
    ty = y0 + h * 0.76
    sc = h / 290.0
    people = [
        (0.22, 128, '#7d9a8e', '#3d2a22', 'short', 0.4, 0.0),
        (0.50, 88, '#efb3a2', '#4a2e22', 'child', 0.0, 1.3),
        (0.78, 120, '#c87a7e', '#5b3426', 'long', -0.4, 2.6),
    ]
    for i, (px, ph, body, hair, hs, facing, off) in enumerate(people):
        ph *= sc * (1.15 if big else 1.0)
        eat = max(0, math.sin(t * 1.3 + off)) ** 3
        laugh = max(0, math.sin(t * 0.6 + off * 0.7)) ** 6
        bob = -math.sin(t * 2.0 + off) * 1.2 - laugh * 3
        face = facing * (0.6 + 0.4 * math.sin(t * 0.4 + off))
        person(ctx, x0 + w * px, ty + 14 * sc, ph, body, hair,
               dict(armL=-0.3 - 1.4 * eat * (i != 2), armLb=-1.2 * eat * (i != 2), armR=-0.3 - 1.4 * eat * (i == 2),
                    armRb=-1.2 * eat * (i == 2), tilt=laugh * 0.15 * (1 if i % 2 else -1) + face * 0.08, bob=bob),
               seed=1011 + i * 20, hairstyle=hs, facing=face)
    table(ctx, x0 + w * 0.5, ty, w * 0.88, h * 0.4, cloth='#f6ead4', seed=1081)
    for i, px in enumerate((0.22, 0.5, 0.78)):
        paint(ctx, ell(x0 + w * px, ty - 2, 18 * sc, 5 * sc, n=10), '#fbf7ee', lw=1.0, seed=1091 + i)
    # ortada çorba ve buhar
    paint(ctx, [(x0 + w * 0.42, ty - 4), (x0 + w * 0.58, ty - 4), (x0 + w * 0.56, ty - 22 * sc),
                (x0 + w * 0.44, ty - 22 * sc)], '#d0704f', lw=1.1, seed=1095)
    for i in range(3):
        ph = (t * 0.45 + i * 0.33) % 1
        sx = x0 + w * (0.46 + 0.04 * i) + math.sin(ph * 6 + i) * 4
        stroke(ctx, [(sx, ty - 26 * sc), (sx + 4, ty - (36 + ph * 25) * sc), (sx - 3, ty - (48 + ph * 35) * sc)],
               '#ffffff', 2.2 * sc, a=0.4 * (1 - ph), seed=1097 + i)
    if big:
        # bardak ve ekmek
        paint(ctx, [(x0 + w * 0.32, ty - 2), (x0 + w * 0.35, ty - 2), (x0 + w * 0.355, ty - 26), (x0 + w * 0.315, ty - 26)],
              '#e5f0f4', a=0.7, lw=1.0, seed=1099)
        paint(ctx, ell(x0 + w * 0.66, ty - 6, 20, 7, n=10), '#d9a35f', lw=1.0, seed=1101)


def room_family(ctx, x0, y0, w, h, t):
    _family(ctx, x0, y0, w, h, t)


def room_big(ctx, x0, y0, w, h, t):
    _family(ctx, x0, y0, w, h, t, big=True)


ROOMS = dict(mother=room_mother, father=room_father, family=room_family, big=room_big)


def draw_window(ctx, sw, t, lit_extra=1.0):
    cx, cy, w, h = sw['cx'], sw['cy'], sw['w'], sw['h']
    x0, y0 = cx - w / 2, cy - h / 2
    # dış ışık hâlesi
    glow(ctx, cx, cy, max(w, h) * 1.1, '#ffcf7a', a=0.22 * lit_extra)
    ctx.save()
    ctx.rectangle(x0, y0, w, h)
    ctx.clip()
    saved = (G.night, G.warm)
    G.night, G.warm = 0.0, 0.08
    ROOMS[sw['kind']](ctx, x0, y0, w, h, t)
    # cam yansıması
    ctx.set_source_rgba(1, 1, 1, 0.07)
    ctx.move_to(x0 + w * 0.1, y0); ctx.line_to(x0 + w * 0.35, y0); ctx.line_to(x0, y0 + h * 0.45); ctx.line_to(x0, y0 + h * 0.2)
    ctx.fill()
    G.night, G.warm = saved
    ctx.restore()
    # perdeler
    for side in (-1, 1):
        sway = math.sin(t * 0.8 + side) * 2
        ex = cx + side * w / 2
        pts = [(ex, y0), (ex - side * w * 0.17, y0), (ex - side * (w * 0.12 + sway), y0 + h * 0.5),
               (ex - side * (w * 0.15), y0 + h), (ex, y0 + h)]
        G_old = (G.night, G.warm)
        G.night, G.warm = 0.05, 0.2
        paint(ctx, pts, '#f0b780', a=0.82, lw=1.2, seed=int(cx) % 97 + side)
        for k in range(2):
            fx = ex - side * w * (0.05 + 0.05 * k)
            stroke(ctx, [(fx, y0 + 4), (fx - side * 2, y0 + h * 0.5), (fx, y0 + h - 4)], '#c98a58', 1.2, a=0.6,
                   seed=int(cx) % 89 + k)
        G.night, G.warm = G_old
    # çerçeve
    fr = '#e6ddd0'
    for pts in ([(x0 - 8, y0 - 8), (x0 + w + 8, y0 - 8), (x0 + w + 8, y0), (x0 - 8, y0)],
                [(x0 - 8, y0 + h), (x0 + w + 8, y0 + h), (x0 + w + 14, y0 + h + 14), (x0 - 14, y0 + h + 14)],
                [(x0 - 8, y0), (x0, y0), (x0, y0 + h), (x0 - 8, y0 + h)],
                [(x0 + w, y0), (x0 + w + 8, y0), (x0 + w + 8, y0 + h), (x0 + w, y0 + h)]):
        paint(ctx, pts, fr, lw=1.2, seed=int(cx + pts[0][1]) % 113, jit=0.3)
    stroke(ctx, [(cx, y0), (cx, y0 + h)], fr, 6, seed=int(cx) % 7)
    stroke(ctx, [(x0, y0 + h * 0.33), (x0 + w, y0 + h * 0.33)], fr, 5, seed=int(cx) % 11)


def draw_plain_window(ctx, wn, t):
    cx, cy, w, h = wn['cx'], wn['cy'], wn['w'], wn['h']
    x0, y0 = cx - w / 2, cy - h / 2
    if wn['lit']:
        flick = 1 + 0.03 * math.sin(t * 3 + wn['seed'])
        glow(ctx, cx, cy, 120, '#ffcc78', a=0.16 * flick)
        tone = mix('#ffd58e', '#ffe9b8', wn['tone'])
        p = lingrad(x0, y0, x0, y0 + h, [(0, shade(tone, 1.0)), (1, shade(tone, 0.85))])
        sv = (G.night, G.warm)
        G.night = 0.05
        ctx.set_source(p)
        G.night = sv[0]
        ctx.rectangle(x0, y0, w, h)
        ctx.fill()
        if wn['curtain']:
            G.night = 0.1
            paint(ctx, [(x0, y0), (x0 + w * 0.3, y0), (x0 + w * 0.2, y0 + h), (x0, y0 + h)], '#e9b483', a=0.8,
                  line=False, seed=wn['seed'])
            G.night = sv[0]
        else:
            # uzakta silüet
            if wn['tone'] > 0.6:
                G.night = 0.1
                paint(ctx, ell(x0 + w * 0.6, y0 + h * 0.62, 12, 14, n=10), '#a7735a', a=0.7, line=False, seed=wn['seed'])
                paint(ctx, [(x0 + w * 0.42, y0 + h), (x0 + w * 0.46, y0 + h * 0.75), (x0 + w * 0.74, y0 + h * 0.75),
                            (x0 + w * 0.78, y0 + h)], '#a7735a', a=0.7, line=False, seed=wn['seed'] + 1)
                G.night = sv[0]
    else:
        p = lingrad(x0, y0, x0, y0 + h, [(0, '#3e4d74'), (1, '#2b3656')])
        ctx.set_source(p)
        ctx.rectangle(x0, y0, w, h)
        ctx.fill()
        ctx.set_source_rgba(0.75, 0.82, 1.0, 0.10)
        ctx.move_to(x0 + w * 0.2, y0); ctx.line_to(x0 + w * 0.5, y0); ctx.line_to(x0, y0 + h * 0.5); ctx.line_to(x0, y0 + h * 0.2)
        ctx.fill()
    fr = '#d9d3cc'
    paint(ctx, [(x0, y0), (x0 + w, y0), (x0 + w, y0 + h), (x0, y0 + h)], None, lw=5, jit=0.4,
          seed=wn['seed'], linecol=fr, linea=0.9)
    stroke(ctx, [(cx, y0), (cx, y0 + h)], fr, 3.5, seed=wn['seed'] + 3)
    paint(ctx, [(x0 - 10, y0 + h), (x0 + w + 10, y0 + h), (x0 + w + 14, y0 + h + 10), (x0 - 14, y0 + h + 10)], fr,
          lw=1.0, seed=wn['seed'] + 5)


def draw_buildings(ctx, t, xmin, xmax):
    G.night = 0.42; G.warm = 0.0
    for b in BUILDINGS:
        if b['x0'] > xmax or b['x0'] + b['w'] < xmin:
            continue
        x0, w, h = b['x0'], b['w'], b['h']
        y0 = GROUND - h
        p = lingrad(0, y0, 0, GROUND, [(0, shade(b['col'], 1.05)), (1, shade(b['col'], 0.8))])
        poly(ctx, [(x0, y0), (x0 + w, y0), (x0 + w, GROUND + 5), (x0, GROUND + 5)], True, 1.0, b['i'])
        ctx.set_source(p)
        ctx.fill()
        # suluboya lekeleri
        for k in range(5):
            bx = x0 + hn(b['i'], k, 1) * w
            by = y0 + hn(b['i'], k, 2) * h
            glow(ctx, bx, by, 120 + hn(b['i'], k) * 120, shade(b['col'], 0.85 + 0.3 * hn(b['i'], k, 3)), a=0.25,
                 add=False)
        # kat çizgileri
        for k in range(1, int(h // 245) + 1):
            yy = GROUND - k * 245 + 40
            stroke(ctx, [(x0, yy), (x0 + w, yy)], shade(b['col'], 0.8), 3, a=0.5, seed=b['i'] * 7 + k)
        # çatı kornişi
        paint(ctx, [(x0 - 12, y0 - 16), (x0 + w + 12, y0 - 16), (x0 + w + 12, y0 + 6), (x0 - 12, y0 + 6)],
              shade(b['col'], 0.75), lw=1.2, seed=b['i'] * 3)
        if b['roof'] == 1:
            # baca
            paint(ctx, [(x0 + w * 0.7, y0 - 90), (x0 + w * 0.78, y0 - 90), (x0 + w * 0.78, y0 - 16),
                        (x0 + w * 0.7, y0 - 16)], shade(b['col'], 0.7), lw=1.2, seed=b['i'] * 5)
        # dış hat
        poly(ctx, [(x0, y0), (x0 + w, y0), (x0 + w, GROUND), (x0, GROUND)], True, 1.2, b['i'] + 50)
        src(ctx, OUTLINE, 0.35)
        ctx.set_line_width(1.6)
        ctx.stroke()
        # kapı
        if b['i'] % 2 == 0:
            dx = x0 + w * 0.78
            if not any(abs(dx - s['cx']) < s['w'] / 2 + 80 and s['kind'] == 'big' for s in SPECIAL):
                paint(ctx, [(dx - 45, GROUND), (dx - 45, GROUND - 210), (dx, GROUND - 235), (dx + 45, GROUND - 210),
                            (dx + 45, GROUND)], '#5a4a5e', lw=1.4, seed=b['i'] * 9)
                glow(ctx, dx, GROUND - 250, 40, '#ffd68a', a=0.35)
    for wn in WINDOWS:
        if xmin - 200 < wn['cx'] < xmax + 200:
            draw_plain_window(ctx, wn, t)
    for sw in SPECIAL:
        if xmin - 400 < sw['cx'] < xmax + 400:
            draw_window(ctx, sw, t)


def draw_far(ctx, t, cx, cy, z):
    """Uzak siluet katmanı (paralaks)"""
    ctx.save()
    apply_cam(ctx, cx, cy, z, par=0.5)
    G.night = 0.0
    xmin = cx * 0.5 - W / z
    xmax = cx * 0.5 + W / z
    i0 = int(xmin // 260) - 1
    for i in range(i0, i0 + int((xmax - xmin) // 260) + 4):
        x = i * 260
        h = 1250 + hn(i, 21) * 500
        y0 = GROUND - h
        poly(ctx, [(x, y0), (x + 250, y0), (x + 250, GROUND), (x, GROUND)], True, 1.5, i)
        ctx.set_source_rgba(0.36, 0.42, 0.62, 0.55)
        ctx.fill()
        for k in range(6):
            if hn(i, k, 5) < 0.3:
                wx = x + 30 + hn(i, k, 6) * 180
                wy = y0 + 60 + hn(i, k, 7) * (h - 300)
                ctx.set_source_rgba(1.0, 0.85, 0.55, 0.45)
                ctx.rectangle(wx, wy, 26, 34)
                ctx.fill()
    ctx.restore()


def draw_lamp(ctx, lx, t, front=False):
    G.night = 0.42
    top = GROUND - 640
    if not front:
        stroke(ctx, [(lx, GROUND), (lx, top + 40), (lx + 6, top), (lx + 40, top - 16)], '#2f3550', 9, seed=int(lx))
        paint(ctx, [(lx + 22, top - 8), (lx + 58, top - 8), (lx + 52, top + 14), (lx + 28, top + 14)], '#3a3f58',
              lw=1.2, seed=int(lx) + 1)
        paint(ctx, [(lx - 14, GROUND), (lx + 14, GROUND), (lx + 9, GROUND - 40), (lx - 9, GROUND - 40)], '#2f3550',
              lw=1.0, seed=int(lx) + 2)
    else:
        flick = 1 + 0.04 * math.sin(t * 13 + lx) * math.sin(t * 3.1 + lx)
        G.night = 0.0
        paint(ctx, ell(lx + 40, top + 16, 13, 6, n=10), '#fff2c8', line=False, seed=int(lx) + 3)
        glow(ctx, lx + 40, top + 18, 180 * flick, '#ffd99a', a=0.42)
        glow(ctx, lx + 40, top + 18, 50, '#fff4d6', a=0.6)
        # ışık konisi
        p = cairo.LinearGradient(0, top + 20, 0, GROUND + 40)
        p.add_color_stop_rgba(0, 1, 0.88, 0.62, 0.20 * flick)
        p.add_color_stop_rgba(1, 1, 0.88, 0.62, 0.0)
        ctx.save()
        ctx.set_operator(cairo.OPERATOR_ADD)
        ctx.move_to(lx + 32, top + 18); ctx.line_to(lx + 48, top + 18)
        ctx.line_to(lx + 260, GROUND + 40); ctx.line_to(lx - 180, GROUND + 40); ctx.close_path()
        ctx.set_source(p)
        ctx.fill()
        ctx.restore()
        # zemindeki ışık havuzu
        ctx.save()
        ctx.translate(lx + 40, GROUND + 18)
        ctx.scale(1, 0.16)
        glow(ctx, 0, 0, 280, '#ffd99a', a=0.30 * flick)
        ctx.restore()


def draw_ground(ctx, xmin, xmax):
    G.night = 0.42
    # kaldırım
    p = lingrad(0, GROUND - 10, 0, GROUND + 70, [(0, '#a8a2b0'), (1, '#8a8598')])
    ctx.set_source(p)
    ctx.rectangle(xmin - 50, GROUND - 4, xmax - xmin + 100, 80)
    ctx.fill()
    k0 = int(xmin // 120) - 1
    for k in range(k0, k0 + int((xmax - xmin) // 120) + 3):
        stroke(ctx, [(k * 120, GROUND + 2), (k * 120 - 14, GROUND + 70)], '#6f6a80', 1.4, a=0.5, seed=k)
    # bordür + yol
    paint(ctx, [(xmin - 50, GROUND + 70), (xmax + 50, GROUND + 70), (xmax + 50, GROUND + 92), (xmin - 50, GROUND + 92)],
          '#c3bfcc', lw=1.0, seed=3, jit=0.4)
    p = lingrad(0, GROUND + 92, 0, GROUND + 1400, [(0, '#4b5274'), (1, '#262c47')])
    ctx.set_source(p)
    ctx.rectangle(xmin - 50, GROUND + 92, xmax - xmin + 100, 1800)
    ctx.fill()
    k0 = int(xmin // 400) - 1
    for k in range(k0, k0 + int((xmax - xmin) // 400) + 3):
        x = k * 400
        paint(ctx, [(x, GROUND + 330), (x + 180, GROUND + 330), (x + 186, GROUND + 342), (x + 6, GROUND + 342)],
              '#b9b6a8', a=0.5, line=False, seed=k)


def draw_leaves(ctx, t, n=9, wind=1.0, seed=0, warm=False):
    G.night = 0.35 if not warm else 0.0
    for i in range(n):
        sp = 120 + hn(i, seed, 1) * 160
        x = (hn(i, seed, 2) * 1500 + t * sp * wind) % 1500 - 200
        y = (hn(i, seed, 3) * 2200 + t * (45 + hn(i, seed, 4) * 40)) % 2200 - 140
        y += math.sin(t * 1.7 + i) * 30
        rot = t * (2 + hn(i, seed, 5) * 3) + i
        sz = 7 + hn(i, seed, 6) * 9
        col = ['#c9925a', '#b5704a', '#d6b26a', '#9d7a58'][i % 4]
        paint(ctx, ell(x, y, sz, sz * 0.45, n=8, rot=rot), col, a=0.75, lw=0.8, seed=i + seed)


def girl_state_street(t):
    s = girl_defaults()
    s['t'] = t
    x = girl_x(t)
    v = girl_v(t)
    s['phase'] = (x - 600) / STEP * math.pi
    s['amt'] = clamp(v / 60.0)
    s['wind'] = 0.6 + 0.3 * math.sin(t * 0.7)
    # göz kırpma
    bl = 0.0
    for bt in (2.1, 5.6, 9.3, 11.6, 14.8, 18.2, 23.3, 27.9, 30.4, 33.8):
        d = abs(t - bt)
        if d < 0.09:
            bl = 1 - d / 0.09
    s['blink'] = bl
    s['sad'] = 0.3
    s['lookx'] = 0.35
    s['looky'] = 0.05
    # pencerelere bakış
    look = 0.0
    for a, b in ((15.6, 19.6), (20.8, 24.4), (25.3, 29.2)):
        look = max(look, window(t, a, a + 0.8, b - 0.8, b))
    s['pitch'] = look * 0.9
    s['looky'] = -0.9 * look + 0.1 * (1 - look)
    s['tilt'] = -0.16 * look
    s['smile'] = 0.15 * look
    # dururken pencereye döner (arkadan görünüm)
    if t > T_STOP - 0.35:
        s['view'] = 'back'
        s['tilt'] = -0.12 * ramp(t, T_STOP, T_STOP + 1.0)
    return s


def scene_street(ctx, t, cam=None, girl=True, girl_override=None):
    cx, cy, z = cam if cam else street_cam(t)
    draw_sky(ctx, t, cx)
    draw_far(ctx, t, cx, cy, z)
    ctx.save()
    apply_cam(ctx, cx, cy, z)
    xmin, xmax = cx - W / z / 2 - 100, cx + W / z / 2 + 100
    draw_buildings(ctx, t, xmin, xmax)
    for lx in LAMPS:
        if xmin - 300 < lx < xmax + 300:
            draw_lamp(ctx, lx, t)
    draw_ground(ctx, xmin, xmax)
    for lx in LAMPS:
        if xmin - 400 < lx < xmax + 400:
            draw_lamp(ctx, lx, t, front=True)
    if girl:
        s = girl_override(t) if girl_override else girl_state_street(t)
        gx = s.pop('_x', None)
        gx = girl_x(t) if gx is None else gx
        ll = lamp_light(gx)
        G.night = 0.42 - 0.22 * ll
        G.warm = 0.12 * ll
        # yumuşak gölge
        ctx.save()
        ctx.translate(gx, GROUND + 6)
        ctx.scale(1, 0.18)
        ctx.set_source_rgba(0.1, 0.1, 0.2, 0.35)
        ctx.arc(0, 0, 40, 0, 2 * math.pi)
        ctx.fill()
        ctx.restore()
        # büyük pencerenin sıcak ışığı (arka plan)
        draw_girl(ctx, gx, GROUND + 4, 1.0, s)
        G.warm = 0.0
    ctx.restore()
    draw_leaves(ctx, t, n=7)


# =============================================================== ters açı: camın arkasındaki yüz
_FG_CACHE = {}


def rev_state(t):
    s = girl_defaults()
    s.update(view='front', yaw=0.0, t=t, wind=0.55, amt=0.0)
    lt = t - T_REV
    # bakış: önce masaya (aşağı-sol), sonra gülümseme, sonra yere düşen bakış
    s['lookx'] = -0.35
    s['looky'] = 0.35
    s['smile'] = 0.75 * window(lt, 1.6, 3.0, 4.4, 5.2)
    down = ramp(lt, 4.4, 5.6)
    s['looky'] = lerp(0.35, 1.0, down)
    s['lookx'] = lerp(-0.35, -0.05, down)
    s['pitch'] = -0.6 * down
    s['tilt'] = 0.04 * down + 0.03 * math.sin(t * 0.5)
    s['sad'] = lerp(0.15, 0.75, down) * (1 - 0.5 * window(lt, 1.6, 3.0, 4.4, 5.2))
    s['tear'] = 0.6 + 1.4 * down
    # hayale geçerken tekrar yukarı bakar
    up = ramp(lt, 7.6, 8.6)
    s['looky'] = lerp(s['looky'], -0.2, up)
    s['lookx'] = lerp(s['lookx'], -0.2, up)
    s['pitch'] = lerp(s['pitch'], 0.1, up)
    s['smile'] = max(s['smile'], 0.35 * up)
    # göz kırpma ve yarı kapalı kapaklar
    bl = 0.32 * down * (1 - up)
    for bt in (0.9, 3.6, 6.9, 8.2):
        d = abs(lt - bt)
        if d < 0.1:
            bl = max(bl, 1 - d / 0.1)
    s['blink'] = bl
    # fısıltı ile konuşma (ağız hareketi)
    from timing import CHILD_LINE
    a, b = CHILD_LINE
    if a < t < b:
        u = (t - a)
        syl = abs(math.sin(u * 11.0)) * (0.55 + 0.45 * math.sin(u * 3.3) ** 2)
        gap = 0.0 if 1.65 < u < 2.05 else 1.0   # "olsaydı… acaba"
        s['mouth'] = 0.55 * syl * gap
    return s


def scene_reverse(ctx, t):
    lt = t - T_REV
    G.night = 0.0; G.warm = 0.0
    z = 1.0 + 0.035 * lt
    dx = -6 * lt
    ctx.save()
    ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-W / 2 + dx, -H / 2)
    # dışarısı: bulanık gece
    p = lingrad(0, 0, 0, H, [(0, '#1c2748'), (0.6, '#34466f'), (1, '#4d5880')], graded=False)
    ctx.set_source(p)
    ctx.paint()
    for i in range(14):
        bx = hn(i, 31) * 1300 - 100
        by = 200 + hn(i, 32) * 900
        col = '#ffd48c' if i % 3 else '#a9c0ff'
        glow(ctx, bx, by, 40 + hn(i, 33) * 70, col, a=0.18 + 0.12 * hn(i, 34))
    # kız: sıcak ışıkla aydınlanan yüz
    s = rev_state(t)
    G.night = 0.18
    G.warm = 0.42
    draw_girl(ctx, 548, 1890, 4.55, s)
    G.night = 0.0; G.warm = 0.0
    glow(ctx, 520, 900, 420, '#ffc677', a=0.16)
    # nefes buğusu (konuşurken)
    from timing import CHILD_LINE
    a, b = CHILD_LINE
    fog = window(t, a + 0.2, a + 1.2, b + 0.4, b + 2.0)
    if fog > 0:
        ctx.save()
        ctx.translate(548, 1110)
        ctx.scale(1.4, 0.75)
        glow(ctx, 0, 0, 110, '#dfe8f2', a=0.22 * fog, add=False)
        ctx.restore()
    ctx.restore()
    # ---- iç mekân: cam, çerçeve, perdeler, ön plandaki masa (bulanık katman önceden)
    ctx.save()
    ctx.translate(W / 2, H / 2); ctx.scale(1 + 0.02 * lt, 1 + 0.02 * lt); ctx.translate(-W / 2, -H / 2)
    # cam parlaması
    ctx.save()
    ctx.set_operator(cairo.OPERATOR_ADD)
    for k, (x1, w1, a1) in enumerate(((120, 90, 0.05), (260, 40, 0.04), (780, 140, 0.035))):
        ctx.set_source_rgba(1, 0.95, 0.85, a1)
        ctx.move_to(x1, 0); ctx.line_to(x1 + w1, 0); ctx.line_to(x1 + w1 - 600, H); ctx.line_to(x1 - 600, H)
        ctx.fill()
    ctx.restore()
    glow(ctx, 230, 330, 160, '#ffcf88', a=0.18)  # lamba yansıması
    G.warm = 0.25
    fr = '#8a5a3a'
    # pencere kasası
    paint(ctx, [(-20, -20), (W + 20, -20), (W + 20, 110), (-20, 110)], fr, lw=2.0, seed=1501)
    paint(ctx, [(-20, -20), (95, -20), (95, H + 20), (-20, H + 20)], fr, lw=2.0, seed=1502)
    paint(ctx, [(W - 95, -20), (W + 20, -20), (W + 20, H + 20), (W - 95, H + 20)], fr, lw=2.0, seed=1503)
    paint(ctx, [(170, 110), (196, 110), (196, 1420), (170, 1420)], fr, lw=1.6, seed=1504)
    paint(ctx, [(95, 400), (W - 95, 400), (W - 95, 424), (95, 424)], fr, lw=1.6, seed=1505)
    # perdeler
    for side in (-1, 1):
        sway = math.sin(t * 0.7 + side) * 6
        ex = 0 if side < 0 else W
        pts = [(ex, -20), (ex - side * 230, -20), (ex - side * (150 + sway), 700), (ex - side * (200 + sway), 1480),
               (ex, 1480)]
        paint(ctx, pts, '#e8a96e', a=0.92, lw=2.0, seed=1510 + side)
        for k in range(4):
            fx = ex - side * (30 + 45 * k)
            stroke(ctx, [(fx, 0), (fx - side * (8 + sway * 0.3), 700), (fx - side * 10, 1470)], '#c47e4c', 3.5, a=0.5,
                   seed=1520 + k + side)
    # pencere pervazı
    paint(ctx, [(-20, 1410), (W + 20, 1410), (W + 20, 1470), (-20, 1470)], shade(fr, 1.15), lw=2, seed=1531)
    G.warm = 0.0
    ctx.restore()


def reverse_fg_layer(t):
    """Ön plandaki masa (sıcak, bulanık) – ayrı katman olarak döndürülür"""
    sf = cairo.ImageSurface(cairo.FORMAT_ARGB32, W // 3, H // 3)
    c = cairo.Context(sf)
    c.scale(1 / 3, 1 / 3)
    G.night, G.warm = 0.0, 0.1
    p = lingrad(0, 1460, 0, H, [(0, '#7a4a2c'), (1, '#4a2c1a')])
    c.set_source(p)
    c.rectangle(0, 1470, W, H)
    c.fill()
    paint(c, [(-30, 1600), (W + 30, 1600), (W + 30, H + 20), (-30, H + 20)], '#a8714a', lw=3, seed=1601)
    paint(c, ell(250, 1640, 150, 34, n=16), '#e8d6bc', a=0.85, lw=3, seed=1603)
    paint(c, ell(250, 1640, 95, 20, n=14), '#c9ab86', a=0.85, lw=2, seed=1604)
    paint(c, [(840, 1650), (940, 1650), (930, 1520), (850, 1520)], '#cfdde4', a=0.45, lw=3, seed=1605)
    for i in range(3):
        ph = (t * 0.35 + i / 3) % 1
        sx = 250 + math.sin(ph * 5 + i) * 30
        stroke(c, [(sx, 1610), (sx + 30, 1540 - ph * 140), (sx - 20, 1450 - ph * 220)], '#ffffff', 16, a=0.25 * (1 - ph),
               seed=1610 + i)
    G.warm = 0.0
    return sf


# =============================================================== hayal odası
def dream_girl(t):
    lt = t - T_DREAM
    s = girl_defaults()
    s['t'] = t
    s['wind'] = 0.15
    s['sad'] = 0.0
    s['smile'] = 0.9
    s['tear'] = 0.2
    run_a, run_b = 1.3, 4.0
    if lt < run_b:
        u = clamp((lt - run_a) / (run_b - run_a))
        x = lerp(-180, 520, 1 - (1 - u) ** 1.6)
        s['run'] = 1.0 if lt < run_b - 0.3 else 0.5
        s['phase'] = lt * 13.0
        s['lookx'] = 0.5
        s['_x'] = x
        s['_y'] = 1335
        s['_sit'] = 0.0
    else:
        hop = clamp((lt - run_b) / 0.45)
        x = lerp(520, 540, hop)
        s['_x'] = x
        s['_y'] = 1335 - math.sin(hop * math.pi) * 40 - 0 * hop
        s['sit'] = 1.0 if hop > 0.5 else 0.0
        s['_sit'] = hop
        s['yaw'] = lerp(0.42, 0.12, ramp(lt, 4.3, 5.2))
        s['lookx'] = lerp(0.4, -0.3, ramp(lt, 5.0, 5.8))
        s['looky'] = -0.3
        s['pitch'] = 0.3
        s['tilt'] = 0.06 * math.sin(lt * 1.5)
    bl = 0.0
    for bt in (5.4, 7.6):
        d = abs(lt - bt)
        if d < 0.1:
            bl = 1 - d / 0.1
    s['blink'] = bl
    return s


def scene_dream(ctx, t, fade_people=1.0):
    lt = t - T_DREAM
    G.night = 0.0; G.warm = 0.1
    z = 1.36 + 0.022 * lt
    ctx.save()
    ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-W / 2, -1060)
    p = lingrad(0, 0, 0, H, [(0, '#e2ad68'), (0.55, '#d4954f'), (1, '#a8653c')])
    ctx.set_source(p)
    ctx.paint()
    # duvar/zemin
    p = lingrad(0, 1160, 0, H, [(0, '#b97546'), (1, '#7e4628')])
    ctx.set_source(p)
    ctx.rectangle(-200, 1160, W + 400, H)
    ctx.fill()
    stroke(ctx, [(-200, 1160), (W + 200, 1160)], '#b9774a', 4, a=0.6, seed=1701)
    # pencere (dışarıda yumuşak gün batımı) ve çerçeveler
    paint(ctx, [(120, 420), (330, 420), (330, 700), (120, 700)], '#fbe6b5', lw=2, seed=1703)
    paint(ctx, [(770, 470), (930, 470), (930, 640), (770, 640)], '#e9c79a', lw=2, seed=1705)
    paint(ctx, ell(850, 555, 46, 52, n=12), '#f6dcbc', lw=1.5, seed=1706)
    # lamba
    stroke(ctx, [(540, -40), (540, 560)], '#6a4630', 2.5, seed=1707)
    paint(ctx, [(470, 640), (500, 560), (580, 560), (610, 640)], '#f0a85a', lw=2, seed=1709)
    glow(ctx, 540, 660, 760, '#ffd690', a=0.26)
    glow(ctx, 540, 650, 120, '#fff0d0', a=0.5)
    # ışık hüzmeleri
    ctx.save()
    ctx.set_operator(cairo.OPERATOR_ADD)
    for k in range(5):
        a = -0.5 + k * 0.25 + 0.03 * math.sin(t * 0.6 + k)
        ctx.set_source_rgba(1, 0.9, 0.65, 0.03)
        ctx.move_to(540, 640)
        ctx.line_to(540 + math.sin(a - 0.05) * 1400, 640 + math.cos(a - 0.05) * 1400)
        ctx.line_to(540 + math.sin(a + 0.05) * 1400, 640 + math.cos(a + 0.05) * 1400)
        ctx.fill()
    ctx.restore()
    # sandalyeler (arkalıklar)
    for i, cxp in enumerate((330, 540, 750)):
        off = 25 if i == 1 else 0
        paint(ctx, [(cxp - 70 - off * 0.3, 1250), (cxp - 62, 1010 + off), (cxp + 62, 1010 + off), (cxp + 70, 1250)],
              '#a8683e', lw=2, seed=1720 + i)
        paint(ctx, [(cxp - 48, 1040 + off), (cxp + 48, 1040 + off), (cxp + 46, 1120 + off), (cxp - 46, 1120 + off)],
              '#c88b5a', lw=1.4, seed=1725 + i)
    # hayali anne ve baba (yumuşak, parlayan)
    ctx.save()
    ctx.rectangle(-500, -500, W + 1000, 1262 + 500)
    ctx.clip()
    G.alpha = 0.9 * fade_people
    gs = dream_girl(t)
    gx = gs['_x']
    toward = ramp(lt, 1.6, 3.2)
    reach = ramp(lt, 4.8, 6.0)
    person(ctx, 330, 1262, 330, '#d58b8f', '#5b3527',
           dict(armL=-0.2, armLb=-0.5, armR=-0.2 - 1.15 * reach, armRb=-0.9 * reach - 0.4, tilt=0.12 * toward,
                bob=math.sin(t * 1.2) * 1.0), seed=1731, hairstyle='long', facing=-0.5 + 0.9 * toward)
    person(ctx, 750, 1262, 345, '#7f9d93', '#3d2a20',
           dict(armL=-0.25 - 0.9 * reach, armLb=-0.6, armR=-0.2, armRb=-0.4, tilt=-0.1 * toward,
                bob=math.sin(t * 1.1 + 1) * 1.0), seed=1751, facing=0.5 - 0.9 * toward)
    G.alpha = 1.0
    ctx.restore()
    for px, py in ((330, 990), (750, 980)):
        glow(ctx, px, py, 200, '#ffe6b0', a=0.10 * fade_people)
    # kız
    G.warm = 0.2
    ctx.save()
    draw_girl(ctx, gx, gs['_y'], 1.28, {k: v for k, v in gs.items() if not k.startswith('_')})
    ctx.restore()
    # masa (önde)
    G.warm = 0.12
    table(ctx, 540, 1262, 640, 260, cloth='#fbf0dc', seed=1771)
    for i, px in enumerate((330, 540, 750)):
        paint(ctx, ell(px, 1258, 46, 10, n=12), '#fffaf2', lw=1.4, seed=1781 + i)
        paint(ctx, ell(px, 1258, 28, 6, n=10), '#f0dcc0', line=False, seed=1785 + i)
    paint(ctx, [(610, 1252), (690, 1252), (685, 1200), (615, 1200)], '#e0784f', lw=1.6, seed=1791)
    for i in range(3):
        ph = (t * 0.4 + i / 3) % 1
        sx = 640 + 10 * i + math.sin(ph * 6 + i) * 8
        stroke(ctx, [(sx, 1190), (sx + 8, 1140 - ph * 50), (sx - 6, 1090 - ph * 90)], '#ffffff', 4, a=0.4 * (1 - ph),
               seed=1795 + i)
    # mum
    paint(ctx, [(432, 1252), (448, 1252), (448, 1196), (432, 1196)], '#fff3dc', lw=1.2, seed=1799)
    fl = 1 + 0.1 * math.sin(t * 17) * math.sin(t * 5)
    paint(ctx, ell(440, 1184, 5, 10 * fl, n=10), '#ffcf6a', line=False, seed=1800)
    glow(ctx, 440, 1184, 90 * fl, '#ffd68a', a=0.4)
    G.warm = 0.0
    ctx.restore()
    # ışık zerreleri
    for i in range(40):
        px = (hn(i, 51) * 1200 + math.sin(t * 0.5 + i) * 40) % 1200 - 60
        py = (hn(i, 52) * 2000 - t * (20 + hn(i, 53) * 25)) % 2000
        tw = 0.5 + 0.5 * math.sin(t * 2 + i * 1.7)
        glow(ctx, px, py, 6 + 10 * hn(i, 54), '#fff1c4', a=0.5 * tw)


def dream_particles(ctx, t, k):
    """Hayal dağılırken yükselen altın zerreler (k: 0..1)"""
    for i in range(140):
        bx = 200 + hn(i, 61) * 700
        by = 900 + hn(i, 62) * 500
        rise = k * (300 + hn(i, 63) * 700)
        px = bx + math.sin(t * 1.3 + i) * 30 * k + (hn(i, 64) - 0.5) * 300 * k
        py = by - rise
        a = math.sin(math.pi * clamp(k * 1.2 - hn(i, 65) * 0.2)) * 0.8
        glow(ctx, px, py, 5 + 10 * hn(i, 66), '#ffe6a6', a=a)


# =============================================================== dönüş: soğuk sokakta yalnız
def return_state(t):
    s = girl_defaults()
    lt = t - T_RET
    s.update(t=t, view='side', amt=0.0, wind=0.85 + 0.25 * math.sin(t * 0.9), sad=0.75, smile=-0.25,
             looky=0.85, lookx=0.25, pitch=-0.5, tilt=0.07, tear=1.4)
    s['blink'] = 0.3
    for bt in (1.2, 4.4, 7.0):
        d = abs(lt - bt)
        if d < 0.1:
            s['blink'] = max(0.3, 1 - d / 0.1)
    # sonunda dönüp yürümeye başlar
    s['_x'] = XS + 10
    return s


def return_cam(t):
    lt = t - T_RET + 2.0
    k = ease(clamp(lt / 9.5))
    cx = lerp(XS + 25, XS - 40, k)
    cy = lerp(1300, 1080, k)
    z = math.exp(lerp(math.log(2.6), math.log(1.0), k))
    return cx, cy, z


# =============================================================== perspektif final
def persp_scene(ctx, t):
    lt = t - T_PERSP
    G.night = 0.0; G.warm = 0.0
    f = 950.0
    hy = 780.0
    camh = 1.35
    camz = 0.0 + 0.6 * ease(clamp(lt / 6))   # kamera biraz takip eder sonra durur
    sway = math.sin(t * 0.4) * 6

    def proj(X, Y, Z):
        Z = max(Z - camz, 0.05)
        return (W / 2 + sway + f * X / Z, hy + f * (camh - Y) / Z)

    # gökyüzü
    p = lingrad(0, 0, 0, hy + 40, [(0, '#18223f'), (0.7, '#34456e'), (1, '#6c739c')], graded=False)
    ctx.set_source(p)
    ctx.rectangle(0, 0, W, H)
    ctx.fill()
    for i in range(35):
        sx, sy = hn(i, 71) * W, hn(i, 72) * 520
        tw = 0.5 + 0.5 * math.sin(t * 2 + i)
        ctx.set_source_rgba(1, 0.97, 0.88, 0.2 + 0.4 * tw)
        ctx.arc(sx, sy, 1.2 + hn(i, 73) * 1.5, 0, 2 * math.pi)
        ctx.fill()
    G.night = 0.45
    # zemin
    p = lingrad(0, hy, 0, H, [(0, '#5f6383'), (1, '#3d4262')])
    ctx.set_source(p)
    ctx.rectangle(0, hy, W, H)
    ctx.fill()
    # kaldırım kenarları
    for X in (-2.2, 2.2):
        a, b = proj(X, 0, 1.0), proj(X, 0, 120)
        stroke(ctx, [a, b], '#8d8aa2', 3, a=0.6, seed=int(X * 10))
    for k in range(1, 60):
        Z = k * 2.0
        a, b = proj(-2.2, 0, Z), proj(2.2, 0, Z)
        if a[1] < H + 50:
            stroke(ctx, [a, b], '#545873', 1.2, a=0.35, seed=k)
    # binalar (iki yan)
    for side in (-1, 1):
        X = side * 3.4
        z0 = 0.5
        bi = 0
        while z0 < 110:
            depth = 5 + hn(bi, side, 1) * 6
            hgt = 9 + hn(bi, side, 2) * 6
            z1 = z0 + depth
            col = PALETTE[int(hn(bi, side, 3) * len(PALETTE))]
            q = [proj(X, 0, z0), proj(X, hgt, z0), proj(X, hgt, z1), proj(X, 0, z1)]
            fogk = clamp(z0 / 90)
            paint(ctx, q, mix(shade(col, 0.85 if side > 0 else 0.75), '#5a6590', fogk), lw=1.2, seed=bi * 3 + side,
                  jit=0.6)
            # pencereler
            nwx = int(depth // 1.6)
            for r in range(int(hgt // 2.6)):
                for c in range(nwx):
                    wz0 = z0 + 0.5 + c * 1.6
                    wy0 = 1.2 + r * 2.6
                    lit = hn(bi, side, r, c) < 0.33
                    wq = [proj(X - side * 0.01, wy0, wz0), proj(X - side * 0.01, wy0 + 1.3, wz0),
                          proj(X - side * 0.01, wy0 + 1.3, wz0 + 0.8), proj(X - side * 0.01, wy0, wz0 + 0.8)]
                    if wq[2][0] < -50 or wq[2][0] > W + 50:
                        continue
                    poly(ctx, wq, True, 0.3, bi + r + c)
                    if lit:
                        sv = G.night
                        G.night = 0.0
                        src(ctx, mix('#ffd48a', '#ffe7b8', hn(bi, r, c)), 0.95)
                        ctx.fill()
                        G.night = sv
                        cxw = sum(p_[0] for p_ in wq) / 4
                        cyw = sum(p_[1] for p_ in wq) / 4
                        glow(ctx, cxw, cyw, 900 / max(wz0 - camz, 1), '#ffcc78', a=0.15)
                    else:
                        src(ctx, '#2e3858', 0.9)
                        ctx.fill()
            z0 = z1 + 0.3
            bi += 1
    # sokak lambaları
    lamps = [3 + 9.0 * k for k in range(12)]
    G.night = 0.45
    for lz in reversed(lamps):
        base = proj(1.9, 0, lz)
        top = proj(1.9, 4.2, lz)
        if base[1] > H + 400:
            continue
        sc = f / max(lz - camz, 0.1)
        stroke(ctx, [base, top], '#2a3048', max(1.2, 0.09 * sc), seed=int(lz))
        hx, hy2 = proj(1.5, 4.1, lz)
        sv = G.night
        G.night = 0.0
        glow(ctx, hx, hy2, 1.6 * sc, '#ffd99a', a=0.38)
        glow(ctx, hx, hy2, 0.25 * sc, '#fff4d6', a=0.7)
        gx, gy = proj(1.0, 0, lz)
        ctx.save()
        ctx.translate(gx, gy)
        ctx.scale(1, 0.22)
        glow(ctx, 0, 0, 2.6 * sc, '#ffd99a', a=0.22)
        ctx.restore()
        G.night = sv
    # kız (arkadan, uzaklaşıyor)
    gz = 3.0 + 0.72 * lt + 0.025 * lt * lt
    gX = 0.3 + 0.15 * math.sin(lt * 0.3)
    s = girl_defaults()
    phase = gz / 0.55 * math.pi
    s.update(view='back', t=t, phase=phase, amt=1.0, wind=0.7)
    gx, gy = proj(gX, 0, gz)
    scale = (f * 1.22 / max(gz - camz, 0.1)) / 265.0
    near = max(math.exp(-((gz - l) / 2.2) ** 2) for l in lamps)
    G.night = 0.5 - 0.3 * near
    G.warm = 0.15 * near
    ctx.save()
    ctx.translate(gx, gy + 4 * scale)
    ctx.scale(1, 0.2)
    ctx.set_source_rgba(0.08, 0.08, 0.16, 0.35)
    ctx.arc(0, 0, 40 * scale, 0, 2 * math.pi)
    ctx.fill()
    ctx.restore()
    draw_girl(ctx, gx, gy, scale, s)
    G.warm = 0.0
    draw_leaves(ctx, t, n=6, wind=0.8, seed=5)
    return gz


def persp_steps():
    out = []
    last = None
    for i in range(int((T_FADE + 1 - T_PERSP) * 240)):
        lt = i / 240.0
        gz = 3.0 + 0.72 * lt + 0.025 * lt * lt
        k = int(gz / 0.55)
        if last is not None and k != last:
            out.append((T_PERSP + lt, gz))
        last = k
    return out
