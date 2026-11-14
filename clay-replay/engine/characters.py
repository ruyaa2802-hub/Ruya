"""CLAY REPLAY - Bölüm 1 kil kuklaları: RÜZGÂR (uzun, kendinden emin) ve FINDIK (kısa, endişeli).

Tüm ölçüler yerel koordinatlarda: (0,0) = ayakların ortası, yukarı = negatif y.
Karakter sağa bakar (flip=-1 ile aynalanır).
"""
import math
from clay import ellipse_pts, tube_pts, poly_tube, bezier, clamp

# ---------------------------------------------------------------- paletler
R_PAL = dict(skin='#e2a986', skin_dk='#c98468', hair='#8a3c1c', shirt='#efe7d6', susp='#6d3f24',
             pants='#5d5a63', shoe='#3a2a22', white='#f7f3ea', pupil='#1d1716', brow='#5a2612',
             mouth='#5e1e22', teeth='#fbf6e8', tongue='#c95a5a')
F_PAL = dict(skin='#f2c6a4', skin_dk='#d99a82', hair='#9a6230', hair_dk='#7a4a22', dress='#d8697c',
             dress_dk='#b24e63', collar='#fff4e2', shoe='#7d2335', white='#fbf8f1', pupil='#18120f',
             iris='#5b8a5a', brow='#4a2610', mouth='#6b1f2a', blush='#ee8f8f', bow='#f2c84b', tongue='#d8676b', teeth='#fbf6e8')


def ik2(sx, sy, tx, ty, l1, l2, bend=1):
    dx, dy = tx - sx, ty - sy
    d = clamp(math.hypot(dx, dy), 1e-3, l1 + l2 - 1e-3)
    a = math.atan2(dy, dx)
    c = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1)
    a1 = a - bend * math.acos(c)
    ex, ey = sx + l1 * math.cos(a1), sy + l1 * math.sin(a1)
    k = l2 / math.hypot(tx - ex, ty - ey) if (tx, ty) != (ex, ey) else 1
    return (ex, ey), (ex + (tx - ex) * min(1, k), ey + (ty - ey) * min(1, k))


def fk2(sx, sy, a1, a2, l1, l2):
    # açı 0 = aşağı; pozitif = ileri (sağa) doğru kalkar
    ex, ey = sx + l1 * math.sin(a1), sy + l1 * math.cos(a1)
    hx, hy = ex + l2 * math.sin(a1 + a2), ey + l2 * math.cos(a1 + a2)
    return (ex, ey), (hx, hy)


def rot_about(pts, cx, cy, ang):
    c, s = math.cos(ang), math.sin(ang)
    return [(cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c) for x, y in pts]


def eye(cv, xf, cx, cy, rx, ry, pal, lid=1.0, px=0.0, py=0.0, lid_col='#e2a986', lid_tilt=0.0,
        pupil_r=0.42, iris=None, closed=False, lower_lid=0.0, refl=None):
    """Kil göz: beyaz top + bebek + kapak. lid=1 tam açık, 0 kapalı."""
    cv.part([('poly', xf(ellipse_pts(cx, cy, rx, ry)))], pal['white'], spec=0.55, gloss=30, tex=0.35,
            shadow_k=0.25)
    if not closed and lid > 0.08:
        pr = min(rx, ry) * pupil_r
        mx, my = rx - pr * 1.05, ry - pr * 1.05
        ppx, ppy = cx + clamp(px, -1, 1) * mx * 0.85, cy + clamp(py, -1, 1) * my * 0.8
        if iris:
            cv.part([('poly', xf(ellipse_pts(ppx, ppy, pr * 1.45, pr * 1.45)))], iris, spec=0.5, gloss=40,
                    tex=0.2, shadow=False, clip=[('poly', xf(ellipse_pts(cx, cy, rx * 0.98, ry * 0.98)))])
        cv.part([('poly', xf(ellipse_pts(ppx, ppy, pr, pr)))], pal['pupil'], spec=0.9, gloss=60, tex=0.15,
                shadow=False)
        # katchlight
        cv.part([('poly', xf(ellipse_pts(ppx - pr * 0.35, ppy - pr * 0.4, pr * 0.28, pr * 0.24)))],
                '#ffffff', emissive=0.85, shadow=False, tex=0)
        if refl is not None:  # gözbebeğinde yansıma (buz dağı!)
            s = pr * 0.55
            cv.part([('poly', xf([(ppx + s * 0.1, ppy - s * 0.9), (ppx + s * 0.9, ppy + s * 0.6),
                                  (ppx - s * 0.6, ppy + s * 0.6)]))], '#cfeaff', emissive=0.7 * refl,
                    alpha=refl, shadow=False, tex=0)
    # üst kapak
    open_ = 0.0 if closed else clamp(lid)
    cut = -ry * 1.12 + (2.24 * ry) * (1 - open_)  # yerel y (göz merkezine göre)
    if open_ < 0.999:
        lp = ellipse_pts(0, 0, rx * 1.1, ry * 1.12, ymax=cut, n=60)
        lp = [(cx + x, cy + y) for x, y in lp]
        lp = rot_about(lp, cx, cy, lid_tilt)
        gr = None
        if open_ < 0.25:  # kapalı göz: kirpik çizgisi
            yl = cy + ry * 0.2
            gr = [(xf(rot_about(bezier((cx - rx * 0.95, yl - ry * 0.05), (cx, yl + ry * 0.35), (cx + rx * 0.95, yl - ry * 0.05)),
                                cx, cy, lid_tilt)), max(2.0, rx * 0.12) * xf.s)]
        cv.part([('poly', xf(lp))], lid_col, tex=0.6, shadow_k=0.3, roundness=rx * 0.5, grooves=gr, groove_depth=7)
        if gr:  # koyu kirpik sosisi
            cv.part([('poly', xf(poly_tube(rot_about(bezier((cx - rx * 1.0, yl - ry * 0.08), (cx, yl + ry * 0.38),
                                                           (cx + rx * 1.0, yl - ry * 0.08)), cx, cy, lid_tilt),
                                            max(1.5, rx * 0.08), max(1.2, rx * 0.06))))], '#3a2316', shadow_k=0.2)
    if lower_lid > 0:
        cutb = ry * 1.12 - 2.24 * ry * lower_lid
        lp = ellipse_pts(0, 0, rx * 1.1, ry * 1.12, n=60)
        lp = [(cx + x, cy + max(y, cutb)) for x, y in lp]
        cv.part([('poly', xf(lp))], lid_col, tex=0.6, shadow_k=0.2, roundness=rx * 0.4)


def mouth(cv, xf, cx, cy, w, open_, smile, pal, lip_col, teeth=True, skew=0.0, shape=None):
    """Ağız: koyu boşluk + dişler + dil + dudak kenarı."""
    if shape == 'shh':  # yuvarlak, büzülmüş
        pts = ellipse_pts(cx, cy, w * 0.22, w * 0.2)
        cv.part([('poly', xf(ellipse_pts(cx, cy, w * 0.34, w * 0.3)))], lip_col, tex=0.5, shadow_k=0.2)
        cv.part([('poly', xf(pts))], pal['mouth'], bump=0.3, shadow=False, ao=0.6)
        return
    hw = w / 2
    o = max(0.0, open_) * w * 0.55
    sm = smile * w * 0.22
    top = []
    bot = []
    n = 14
    for i in range(n + 1):
        u = -1 + 2 * i / n
        x = cx + u * hw
        lift = sm * (u * u) + skew * u * w * 0.12
        top.append((x, cy - lift - o * 0.18 * (1 - u * u)))
        bot.append((x, cy - lift + (o + w * 0.06) * (1 - u * u) ** 0.8))
    pts = top + bot[::-1]
    # dudak (kenar sosisi)
    cv.part([('line', xf(top), w * 0.13 * xf.s), ('line', xf(bot), w * 0.13 * xf.s)], lip_col, tex=0.5,
            shadow_k=0.18)
    cv.part([('poly', xf(pts))], pal['mouth'], bump=0.35, shadow=False, ao=0.7, tex=0.3)
    if open_ > 0.12:
        clipm = [('poly', xf(pts))]
        cv.part([('poly', xf(ellipse_pts(cx + w * 0.08, cy + o * 0.85, w * 0.32, o * 0.45)))], pal['tongue'],
                shadow=False, clip=clipm, tex=0.4)
        if teeth:
            tpts = [(x, y) for x, y in top]
            tb = [(x, y + o * 0.32 + 2) for x, y in top]
            cv.part([('poly', xf(tpts + tb[::-1]))], pal['teeth'], shadow=False, clip=clipm, spec=0.4,
                    bump=0.6, grooves=[(xf([(cx + k * w * 0.11, cy - o), (cx + k * w * 0.11, cy + o * 0.3)]),
                                        1.5) for k in (-2, -1, 0, 1, 2)], groove_depth=3)


# ===================================================================== RÜZGÂR
RUZGAR_DEFAULT = dict(lean=0.0, armL=(0.25, 0.35), armR=(0.2, 0.3), tL=None, tR=None, head=0.0,
                      lid=0.62, closed=False, px=0.35, py=0.0, browL=0.2, browR=0.9, mo=0.0, smile=0.7,
                      shape=None, wind=1.0, phase=0.0, hair_wet=0.0, finger_shh=0.0, hips=0.0, squash=0.0,
                      draw_legs=True, draw_body=True, head_only=False)


def ruzgar(cv, xf, **kw):
    p = dict(RUZGAR_DEFAULT)
    p.update(kw)
    P = R_PAL
    sq = p['squash']
    body = xf.child(0, 0, rot=p['lean'], s=1.0)
    hipy = -250
    hipx = p['hips'] * 20
    shy = -445 * (1 - sq * 0.08)
    # --- kollar (arka kol önce)
    l1, l2 = 115, 105
    shL = (hipx - 30, shy + 22)
    shR = (hipx + 34, shy + 22)

    def arm(sh, ang, tgt, col_sleeve, bend):
        if tgt is not None:
            e, h = ik2(sh[0], sh[1], tgt[0], tgt[1], l1, l2, bend)
        else:
            e, h = fk2(sh[0], sh[1], ang[0], ang[1], l1, l2)
        return e, h

    eL, hL = arm(shL, p['armL'], p['tL'], P['shirt'], -1)
    eR, hR = arm(shR, p['armR'], p['tR'], P['shirt'], 1)

    def draw_arm(sh, e, h, front):
        cv.part([('poly', body(tube_pts(sh, e, 17, 14)))], P['shirt'], shadow_k=0.3)
        # kıvrılmış kol ağzı
        cv.part([('poly', body(ellipse_pts(e[0], e[1], 17, 15)))], P['shirt'], shadow_k=0.25,
                grooves=[(body(bezier((e[0] - 14, e[1]), (e[0], e[1] + 6), (e[0] + 14, e[1]))), 2)])
        cv.part([('poly', body(tube_pts(e, h, 11, 10)))], P['skin'], shadow_k=0.3)
        ang = math.atan2(h[1] - e[1], h[0] - e[0])
        hx, hy = h[0] + 10 * math.cos(ang), h[1] + 10 * math.sin(ang)
        cv.part([('poly', body(ellipse_pts(hx, hy, 21, 15, ang)))], P['skin'], shadow_k=0.3,
                grooves=[(body([(hx + 6 * math.cos(ang + 1.9), hy + 6 * math.sin(ang + 1.9)),
                                (hx + 18 * math.cos(ang + 0.4), hy + 18 * math.sin(ang + 0.4))]), 2)])
        cv.part([('poly', body(ellipse_pts(hx - 8 * math.sin(ang), hy + 8 * math.cos(ang), 11, 7, ang - 0.7)))],
                P['skin'], shadow_k=0.2)

    if not p['head_only']:
        draw_arm(shL, eL, hL, False)
    if p['draw_legs'] and not p['head_only']:
        for sx, fx in ((-16, -38), (16, 30)):
            path = bezier((hipx + sx, hipy), (sx * 1.2 + 6, -125), (fx, -14))
            cv.part([('poly', body(poly_tube(path, 22, 17)))], P['pants'], shadow_k=0.35,
                    grooves=[(body(bezier((hipx + sx + 6, hipy + 40), (sx + 10, -130), (fx + 5, -40))), 1.5)])
            cv.part([('poly', body(ellipse_pts(fx + 18, -10, 40, 17, 0.05)))], P['shoe'], spec=0.45, gloss=30,
                    shadow_k=0.5)
    if p['draw_body'] and not p['head_only']:
        torso = [(hipx - 42, hipy + 15), (hipx + 44, hipy + 15), (hipx + 60, shy + 30), (hipx + 40, shy),
                 (hipx - 38, shy - 4), (hipx - 56, shy + 30)]
        cv.part([('poly', body(torso))], P['shirt'], shadow_k=0.35,
                grooves=[(body(bezier((hipx - 20, shy + 60), (hipx - 10, shy + 120), (hipx - 26, hipy - 10))), 2),
                         (body(bezier((hipx + 26, shy + 80), (hipx + 30, shy + 140), (hipx + 20, hipy - 20))), 2),
                         (body([(hipx + 2, shy + 10), (hipx + 4, hipy)]), 2.5)])
        # pantolon belliği
        cv.part([('poly', body([(hipx - 44, hipy - 8), (hipx + 46, hipy - 8), (hipx + 46, hipy + 26),
                                (hipx - 44, hipy + 26)]))], P['pants'], shadow_k=0.3)
        for sx in (-22, 24):
            cv.part([('poly', body(poly_tube([(hipx + sx, hipy + 2), (hipx + sx * 0.8, shy + 60),
                                              (hipx + sx * 1.2, shy + 4)], 7, 7)))], P['susp'], shadow_k=0.3)
        # yaka
        cv.part([('poly', body([(hipx - 26, shy - 2), (hipx + 4, shy + 30), (hipx - 4, shy - 6)])),
                 ('poly', body([(hipx + 30, shy - 2), (hipx + 4, shy + 30), (hipx + 10, shy - 6)]))],
                P['shirt'], shadow_k=0.3)
    # --- boyun + kafa
    neck = body.child(hipx + 4, shy, rot=p['head'] * 0.5)
    if not p['head_only']:
        cv.part([('poly', neck(tube_pts((0, 4), (0, -42), 15, 13)))], P['skin_dk'], shadow_k=0.3)
    hd = neck.child(4, -48, rot=p['head'] * 0.6)  # kafa pivotu (çene altı)
    # arka saç (rüzgârda dalgalanır)
    w, ph = p['wind'], p['phase']
    wet = p['hair_wet']
    tufts = []
    for i in range(9):
        root = (-38 + i * 7, -118 + abs(i - 4) * 4)
        L = (95 + 45 * math.sin(i * 1.7)) * (0.35 + 0.65 * w) * (1 - 0.55 * wet)
        wav = math.sin(ph * 2 * math.pi * 1.6 + i * 0.9) * 18 * w
        messy = math.radians(-150 + i * 13 + 14 * math.sin(i * 2.3))
        blown = math.radians(-182 + i * 5 + 10 * math.sin(i * 2.3))
        ang = messy + (blown - messy) * clamp(w) + (0.9 - i * 0.05) * wet
        tip = (root[0] + L * math.cos(ang), root[1] + L * math.sin(ang) * (1 - wet * 1.5) + wav * 0.6)
        mid = ((root[0] + tip[0]) / 2 + wav * 0.3, (root[1] + tip[1]) / 2 - 18 * (1 - wet) + wav)
        tufts.append(bezier(root, mid, tip, 10))
    hair_back = [('poly', hd(poly_tube(t, 26, 5))) for t in tufts[::2]]
    cv.part(hair_back, P['hair'], shadow_k=0.35, grooves=[(hd(t), 2) for t in tufts[::2]], groove_depth=5)
    # kafa (küçük kafa + sivri uzun çene)
    head_pts = ellipse_pts(0, -78, 56, 68, n=56)
    chin = ellipse_pts(16, -18, 30, 32, -0.3)
    cv.part([('poly', hd(head_pts)), ('poly', hd(chin)),
             ('poly', hd([(-40, -60), (40, -40), (30, 0), (0, 8), (-20, -20)]))], P['skin'], shadow_k=0.35,
            grooves=[(hd(bezier((-6, -6), (14, 2), (34, -10))), 1.5)], groove_depth=3)
    # kulak
    cv.part([('poly', hd(ellipse_pts(-50, -70, 12, 18, 0.2)))], P['skin_dk'], shadow_k=0.3,
            grooves=[(hd(bezier((-52, -80), (-46, -70), (-52, -60))), 2)])
    # ön saç kepi + rüzgâra uçan perçem
    cap = ellipse_pts(-6, -118, 64, 38, -0.1, n=40)
    front_tufts = [('poly', hd(poly_tube(t, 22, 6))) for t in tufts[1::2]]
    cv.part([('poly', hd(cap))] + front_tufts + [('poly', hd(poly_tube(bezier((20, -140), (-10, -170 + 10 * wet),
                                                                             (-60 - 40 * w, -150 + 60 * wet)), 16, 4)))],
            P['hair'], shadow_k=0.35,
            grooves=[(hd(t), 2) for t in tufts[1::2]] + [(hd(bezier((-50, -120), (-10, -150), (40, -128))), 2),
                                                         (hd(bezier((-40, -105), (0, -132), (44, -112))), 2)],
            groove_depth=5)
    # gözler (asimetrik)
    eye(cv, hd, 14, -86, 15, 17, P, lid=p['lid'], px=p['px'], py=p['py'], lid_col=P['skin'],
        closed=p['closed'], lid_tilt=-0.15)
    eye(cv, hd, 46, -90, 13, 15, P, lid=p['lid'] * 1.05, px=p['px'], py=p['py'], lid_col=P['skin'],
        closed=p['closed'], lid_tilt=0.2)
    # kaşlar
    cv.part([('poly', hd(poly_tube(bezier((2, -106 - 8 * p['browL']), (14, -114 - 10 * p['browL']),
                                          (28, -108 - 6 * p['browL'])), 6, 4)))], P['brow'], shadow_k=0.3)
    cv.part([('poly', hd(poly_tube(bezier((36, -110 - 8 * p['browR']), (48, -118 - 12 * p['browR']),
                                          (60, -110 - 8 * p['browR'])), 5, 4)))], P['brow'], shadow_k=0.3)
    # burun (büyük, sivri)
    cv.part([('poly', hd(ellipse_pts(62, -66, 24, 13, 0.35))), ('poly', hd(ellipse_pts(50, -76, 12, 14)))],
            P['skin'], shadow_k=0.4, grooves=[(hd(bezier((52, -58), (60, -54), (70, -58))), 1.5)])
    # ağız
    mouth(cv, hd, 38, -36, 46, p['mo'], p['smile'], P, P['skin_dk'], skew=0.5, shape=p['shape'])
    if p['finger_shh'] > 0:
        f = p['finger_shh']
        cv.part([('poly', hd(tube_pts((44, 40 - 20 * f), (40, -40 * f), 9, 8)))], P['skin'], shadow_k=0.4)
    if not p['head_only']:
        draw_arm(shR, eR, hR, True)
    return dict(handL=body.pt(*hL), handR=body.pt(*hR), head=hd.pt(0, -78))


# ===================================================================== FINDIK
FINDIK_DEFAULT = dict(lean=0.0, armL=(0.4, 0.2), armR=(0.4, 0.2), tL=None, tR=None, head=0.0, lid=0.85,
                      closed=False, closedL=False, closedR=False, px=0.2, py=0.0, worry=0.8, mo=0.0,
                      smile=-0.4, shake=0.0, bun=0.0, blush=0.6, squash=0.0, lower=0.0, refl=None,
                      legs_dangle=0.0, mouth_shape=None, draw_body=True)


def findik(cv, xf, t=0.0, **kw):
    p = dict(FINDIK_DEFAULT)
    p.update(kw)
    P = F_PAL
    sq = p['squash']
    shk = p['shake'] * math.sin(t * 70) * 3
    body = xf.child(shk, 0, rot=p['lean'], s=1.0)
    # bacaklar (minicik)
    if p['draw_body']:
        for sx, sw in ((-22, -1), (22, 1)):
            dang = p['legs_dangle'] * math.sin(t * 9 + sx) * 10
            cv.part([('poly', body(tube_pts((sx, -42), (sx + dang * 0.4, -14), 11, 10)))], P['skin'], shadow_k=0.35)
            cv.part([('poly', body(ellipse_pts(sx + 8 + dang * 0.5, -10, 22, 13)))], P['shoe'], spec=0.5, gloss=30,
                    shadow_k=0.5)
    sh_y = -168 * (1 - sq * 0.1)
    l1, l2 = 34, 30

    def arm(sx, ang, tgt, bend):
        if tgt is not None:
            return ik2(sx, sh_y + 14, tgt[0], tgt[1], l1, l2, bend)
        return fk2(sx, sh_y + 14, ang[0], ang[1], l1, l2)

    eL, hL = arm(-34, p['armL'], p['tL'], -1)
    eR, hR = arm(34, p['armR'], p['tR'], 1)

    def draw_arm(sx, e, h):
        cv.part([('poly', body(tube_pts((sx, sh_y + 14), e, 13, 11)))], P['dress'], shadow_k=0.3)
        cv.part([('poly', body(tube_pts(e, h, 10, 9)))], P['skin'], shadow_k=0.3)
        cv.part([('poly', body(ellipse_pts(h[0], h[1], 12, 11)))], P['skin'], shadow_k=0.3)

    if p['draw_body']:
        draw_arm(-34, eL, hL)
        # elbise (armut / çan)
        dress = []
        for i in range(17):
            u = -1 + 2 * i / 16
            dress.append((u * 84 + math.sin(u * 9 + t * 3) * 3, -38 + 6 * math.sin(u * 12)))
        dress = [(-40, sh_y), (40, sh_y), (58, sh_y + 40)] + dress[::-1][:-1] + [(-84, -38), (-58, sh_y + 40)]
        # dress listesini düzgün sırala
        hem = [(u * 84, -36 + 4 * math.sin(u * 7 + 0.5)) for u in [1 - 2 * i / 16 for i in range(17)]]
        dress = [(-38, sh_y), (38, sh_y), (62, sh_y + 46)] + hem + [(-62, sh_y + 46)]
        cv.part([('poly', body(dress))], P['dress'], shadow_k=0.4,
                grooves=[(body(bezier((-20, sh_y + 30), (-34, -90), (-46, -42))), 2.2),
                         (body(bezier((18, sh_y + 30), (30, -90), (40, -42))), 2.2),
                         (body(bezier((0, sh_y + 40), (2, -90), (0, -40))), 1.6)])
        # yaka
        cv.part([('poly', body(ellipse_pts(-14, sh_y + 6, 22, 12, 0.3))),
                 ('poly', body(ellipse_pts(14, sh_y + 6, 22, 12, -0.3)))], P['collar'], shadow_k=0.25)
    # kafa (kocaman)
    hd = body.child(0, sh_y - 4, rot=p['head'])
    bunw = p['bun'] * math.sin(t * 11) * 0.25
    bun_xf = hd.child(-6, -168, rot=bunw)
    cv.part([('poly', bun_xf(ellipse_pts(0, -10, 40, 36)))], P['hair'], shadow_k=0.35,
            grooves=[(bun_xf(bezier((-30, -10), (0, -40), (30, -12))), 2.2),
                     (bun_xf(bezier((-28, 4), (2, -22), (32, 2))), 2.2)], groove_depth=5)
    # fiyonk
    cv.part([('poly', bun_xf([(0, 22), (-30, 10), (-34, 34), (0, 26)])),
             ('poly', bun_xf([(0, 22), (30, 10), (34, 34), (0, 26)]))], P['bow'], shadow_k=0.3)
    cv.part([('poly', hd(ellipse_pts(0, -86, 90, 84, n=64)))], P['skin'], shadow_k=0.4)
    # saç kepi
    cv.part([('poly', hd(ellipse_pts(-4, -142, 86, 40, -0.05, n=48))),
             ('poly', hd(ellipse_pts(-80, -96, 22, 40, 0.3))), ('poly', hd(ellipse_pts(74, -104, 18, 30, -0.4)))],
            P['hair'], shadow_k=0.35,
            grooves=[(hd(bezier((-70, -120), (-20, -160), (40, -150))), 2), (hd(bezier((-60, -110), (0, -140), (70, -124))), 2),
                     (hd(bezier((-40, -150), (10, -172), (60, -140))), 2)], groove_depth=5)
    # yanaklar
    for bx in (-58, 70):
        cv.part([('poly', hd(ellipse_pts(bx, -46, 20, 12)))], P['blush'], alpha=p['blush'] * 0.7, flat=True,
                shadow=False, tex=0.3)
    # kocaman gözler
    eye(cv, hd, -30, -86, 34, 40, P, lid=p['lid'], px=p['px'], py=p['py'], lid_col=P['skin'],
        closed=p['closed'] or p['closedL'], lid_tilt=0.25 * p['worry'], iris=P['iris'], pupil_r=0.5,
        lower_lid=p['lower'], refl=p['refl'])
    eye(cv, hd, 42, -88, 31, 37, P, lid=p['lid'], px=p['px'], py=p['py'], lid_col=P['skin'],
        closed=p['closed'] or p['closedR'], lid_tilt=-0.25 * p['worry'], iris=P['iris'], pupil_r=0.5,
        lower_lid=p['lower'], refl=p['refl'])
    # endişeli kaşlar
    wv = p['worry']
    cv.part([('poly', hd(poly_tube(bezier((-58, -126 + 2 * wv), (-36, -130 - 6 * wv), (-12, -132 - 14 * wv)), 5, 4)))],
            P['brow'], shadow_k=0.3)
    cv.part([('poly', hd(poly_tube(bezier((70, -128 + 2 * wv), (46, -132 - 6 * wv), (22, -134 - 14 * wv)), 5, 4)))],
            P['brow'], shadow_k=0.3)
    # burun düğmesi
    cv.part([('poly', hd(ellipse_pts(8, -44, 11, 9)))], P['skin'], shadow_k=0.35)
    # ağız (küçük, dalgalı)
    if p['mouth_shape'] == 'O':
        o = 6 + 14 * max(p['mo'], 0.5)
        cv.part([('poly', hd(ellipse_pts(8, -14, o * 0.8 + 3, o + 3)))], P['skin_dk'], shadow_k=0.2)
        cv.part([('poly', hd(ellipse_pts(8, -14, o * 0.8, o)))], P['mouth'], bump=0.3, shadow=False, ao=0.6)
    else:
        mouth(cv, hd, 8, -16, 34, p['mo'] * 1.1, p['smile'], P, P['skin_dk'], teeth=False, skew=-0.3)
    if p['draw_body']:
        draw_arm(34, eR, hR)
    return dict(head=hd.pt(0, -86), handL=body.pt(*hL), handR=body.pt(*hR), waistL=body.pt(-50, -110),
                waistR=body.pt(50, -110))


# ===================================================================== MARTI
G_PAL = dict(white='#f4f1ea', grey='#9aa3ad', grey_dk='#6d7680', tip='#1d1b1f', beak='#f0b630',
             spot='#d8352c', feet='#e8823a', pupil='#141012', eye='#f3e27a')


def marti(cv, xf, t=0.0, fly=0.0, flap=0.0, beak=0.0, look=0.0, lid=0.55, squash=0.0, settle=0.0):
    """Kil martı. fly=1 uçuyor (kanatlar açık, ayaklar toplu). flap = kanat açısı (-1..1)."""
    P = G_PAL
    b = xf.child(0, 0, s=1.0)
    sq = squash
    # bacaklar + perdeli ayaklar (otururken)
    if fly < 0.5:
        for lx in (-10, 12):
            cv.part([('poly', b(tube_pts((lx, -30 + 10 * settle), (lx + 2, -4), 4.5, 4)))], P['feet'], shadow_k=0.3)
            cv.part([('poly', b([(lx - 12, 0), (lx + 18, 0), (lx + 6, -8)]))], P['feet'], shadow_k=0.4)
    sh = (2, -62 * (1 - sq * 0.15))

    def wing(side):
        if fly > 0.5:
            ang = -0.75 + 1.15 * flap
            w = b.child(sh[0], sh[1], rot=ang if side > 0 else ang - 0.3)
            pts = [(0, -8), (60, -22), (125, -12), (150, 4), (110, 10), (55, 10), (0, 10)]
            pts = [(x * (1 if side > 0 else 0.85), y) for x, y in pts]
            cv.part([('poly', w(pts))], P['grey'], shadow_k=0.3 if side > 0 else 0.15,
                    grooves=[(w([(20, 2), (110, -4)]), 2), (w([(40, 8), (120, 6)]), 1.6)])
            cv.part([('poly', w([(105, -14), (150, 4), (112, 10)]))], P['tip'], shadow=False)
        else:
            w = b.child(-4, -50 + 6 * settle, rot=0.12)
            cv.part([('poly', w(ellipse_pts(-6, 0, 46, 18, 0.05)))], P['grey'], shadow_k=0.3,
                    grooves=[(w(bezier((-40, 4), (-5, -4), (36, 2))), 2), (w(bezier((-44, 10), (-10, 4), (30, 10))), 1.6)])
            cv.part([('poly', w([(-50, -4), (-78, 4), (-52, 10)]))], P['tip'], shadow=False)

    if fly > 0.5:
        wing(-1)
    # kuyruk
    cv.part([('poly', b([(-40, -52), (-86, -62), (-90, -44), (-40, -38)]))], P['white'], shadow_k=0.3,
            grooves=[(b([(-48, -48), (-86, -54)]), 1.6)])
    # gövde
    cv.part([('poly', b(ellipse_pts(-2, -50 + 6 * settle, 50, 30 * (1 - sq * 0.2), -0.12)))], P['white'], shadow_k=0.35)
    # kafa
    h = b.child(38, -82 + 6 * settle, rot=look)
    cv.part([('poly', h(ellipse_pts(0, 0, 25, 23)))], P['white'], shadow_k=0.35)
    # gaga (alt çene açılır)
    o = beak * 0.55
    up = [(16, -6), (54, -4), (60, 2), (16, 4)]
    cv.part([('poly', h(up))], P['beak'], spec=0.5, shadow_k=0.3)
    low = rot_about([(16, 4), (52, 4), (48, 11), (16, 10)], 16, 4, o)
    cv.part([('poly', h(low))], P['beak'], spec=0.5, shadow_k=0.3)
    sp = rot_about([(44, 6)], 16, 4, o)[0]
    cv.part([('poly', h(ellipse_pts(sp[0], sp[1], 4, 3)))], P['spot'], shadow=False)
    if beak > 0.2:
        cv.part([('poly', h([(18, 4), (52, 2)] + rot_about([(50, 6), (18, 8)], 16, 4, o)))], '#7a1f22',
                shadow=False, bump=0.3)
    # göz: sarı, öfkeli küçük bebek, kalın kaş
    cv.part([('poly', h(ellipse_pts(6, -6, 7, 7)))], P['eye'], spec=0.6, shadow=False)
    cv.part([('poly', h(ellipse_pts(7, -6, 3.2, 3.2)))], P['pupil'], spec=0.8, shadow=False)
    cv.part([('poly', h(ellipse_pts(6, -6, 8.5, 8.5, ymax=-8.5 + 17 * (1 - lid))))], P['white'], shadow_k=0.2)
    cv.part([('poly', h(poly_tube([(-4, -16), (8, -13), (16, -9)], 3, 2)))], P['grey_dk'], shadow=False)
    if fly > 0.5:
        wing(1)
    return dict(head=h.pt(0, 0))
