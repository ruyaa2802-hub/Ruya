# -*- coding: utf-8 -*-
"""Benim Küçük Dünyam – Bölüm 1
Ortak çizim yardımcıları: renk/ışık derecelendirme, el çizimi titrek hatlar,
suluboya kenarları ve karakter kuklası (küçük kız) + iç mekân figürleri.
"""
import math
import cairo

W, H, FPS = 1080, 1920, 24


# ----------------------------------------------------------------- renk/ışık
class G:
    night = 0.0      # 0..1 soğuk mavi akşam ışığı
    warm = 0.0       # 0..1 sıcak ev ışığı
    boil = 0         # el çizimi çizgi "kaynaması" karesi (8 fps)
    t = 0.0
    nightcol = (0.38, 0.46, 0.70)
    warmcol = (1.18, 0.92, 0.62)
    alpha = 1.0      # global çizim saydamlığı (hayal sahnesi vb.)


def hexc(h):
    if isinstance(h, tuple):
        return h
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))


def grade(c):
    r, g, b = hexc(c)
    n, w = G.night, G.warm
    nc, wc = G.nightcol, G.warmcol
    r = r * (1 - n + n * nc[0]); g = g * (1 - n + n * nc[1]); b = b * (1 - n + n * nc[2])
    r = r * (1 - w + w * wc[0]); g = g * (1 - w + w * wc[1]); b = b * (1 - w + w * wc[2])
    return (min(r, 1), min(g, 1), min(b, 1))


def mix(a, b, k):
    a, b = hexc(a), hexc(b)
    return tuple(a[i] * (1 - k) + b[i] * k for i in range(3))


def shade(c, k):
    c = hexc(c)
    return tuple(max(0, min(1, x * k)) for x in c)


def src(ctx, c, a=1.0):
    r, g, b = grade(c)
    ctx.set_source_rgba(r, g, b, a * G.alpha)


def hn(*args):
    """Deterministik sözde-rastgele 0..1"""
    s = 0.0
    for i, a in enumerate(args):
        s += (a + 0.1234) * (12.9898 + 31.7 * i)
    x = math.sin(s) * 43758.5453
    return x - math.floor(x)


def clamp(x, a=0.0, b=1.0):
    return a if x < a else b if x > b else x


def lerp(a, b, k):
    return a + (b - a) * k


def ease(x):
    x = clamp(x)
    return x * x * (3 - 2 * x)


def ease2(x):
    x = clamp(x)
    return x * x * x * (x * (x * 6 - 15) + 10)


def ramp(t, a, b):
    """t, a..b aralığında 0→1 yumuşak"""
    if b == a:
        return 1.0 if t >= a else 0.0
    return ease((t - a) / (b - a))


def window(t, a, b, c, d):
    return ramp(t, a, b) * (1 - ramp(t, c, d))


# ----------------------------------------------------------------- hatlar
def jitter(pts, amp, seed):
    if amp <= 0:
        return pts
    b = G.boil
    return [(x + amp * (hn(seed, i, b) - 0.5) * 2, y + amp * (hn(seed, i, b, 7.0) - 0.5) * 2)
            for i, (x, y) in enumerate(pts)]


def path(ctx, pts, closed=True, jit=0.0, seed=0):
    pts = jitter(pts, jit, seed)
    n = len(pts)
    if n < 2:
        return
    ctx.move_to(*pts[0])
    if n == 2:
        ctx.line_to(*pts[1])
        return
    rng = range(n) if closed else range(n - 1)
    for i in rng:
        p0 = pts[(i - 1) % n] if (closed or i > 0) else pts[i]
        p1 = pts[i]
        p2 = pts[(i + 1) % n]
        p3 = pts[(i + 2) % n] if (closed or i + 2 < n) else p2
        c1 = (p1[0] + (p2[0] - p0[0]) / 6.0, p1[1] + (p2[1] - p0[1]) / 6.0)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6.0, p2[1] - (p3[1] - p1[1]) / 6.0)
        ctx.curve_to(c1[0], c1[1], c2[0], c2[1], p2[0], p2[1])
    if closed:
        ctx.close_path()


def poly(ctx, pts, closed=True, jit=0.0, seed=0, seg=70.0):
    """Keskin köşeli, elde çizilmiş gibi hafif titrek çokgen"""
    n = len(pts)
    edges = n if closed else n - 1
    first = True
    b = G.boil
    for i in range(edges):
        x0, y0 = pts[i]
        x1, y1 = pts[(i + 1) % n]
        L = math.hypot(x1 - x0, y1 - y0)
        k = max(1, int(L / seg))
        for j in range(k + (1 if (i == edges - 1 and not closed) else 0)):
            u = j / k
            x = x0 + (x1 - x0) * u
            y = y0 + (y1 - y0) * u
            if jit:
                x += jit * (hn(seed, i, j, b) - 0.5) * 2
                y += jit * (hn(seed, i, j, b, 3.0) - 0.5) * 2
            if first:
                ctx.move_to(x, y)
                first = False
            else:
                ctx.line_to(x, y)
    if not closed:
        x, y = pts[-1]
        ctx.line_to(x, y)
    else:
        ctx.close_path()


def ell(cx, cy, rx, ry, n=14, rot=0.0, wob=0.0, seed=0):
    out = []
    cr, sr = math.cos(rot), math.sin(rot)
    for i in range(n):
        a = 2 * math.pi * i / n
        k = 1 + wob * (hn(seed, i) - 0.5)
        x, y = math.cos(a) * rx * k, math.sin(a) * ry * k
        out.append((cx + x * cr - y * sr, cy + x * sr + y * cr))
    return out


OUTLINE = '#3a2a2a'


def paint(ctx, pts, col, a=1.0, line=True, lw=1.4, jit=0.5, seed=0, edge=True,
          closed=True, linecol=OUTLINE, linea=0.55, sharp=None):
    """Suluboya dolgusu + koyulaşan pigment kenarı + kurşun kalem hattı"""
    if sharp is None:
        sharp = len(pts) == 4
    pth = poly if sharp else path
    if col is not None:
        pth(ctx, pts, closed, jit * 0.6, seed)
        if isinstance(col, cairo.Pattern):
            ctx.set_source(col)
        else:
            src(ctx, col, a)
        if edge and not isinstance(col, cairo.Pattern):
            ctx.fill_preserve()
            src(ctx, shade(col, 0.80), 0.30 * a)
            ctx.set_line_width(lw * 2.0)
            ctx.stroke()
        else:
            ctx.fill()
    if line:
        pth(ctx, pts, closed, jit, seed + 101)
        src(ctx, linecol, linea * a)
        ctx.set_line_width(lw)
        ctx.set_line_cap(cairo.LINE_CAP_ROUND)
        ctx.set_line_join(cairo.LINE_JOIN_ROUND)
        ctx.stroke()


def stroke(ctx, pts, col, lw, a=1.0, jit=0.3, seed=0, cap=cairo.LINE_CAP_ROUND):
    path(ctx, pts, False, jit, seed)
    src(ctx, col, a)
    ctx.set_line_width(lw)
    ctx.set_line_cap(cap)
    ctx.set_line_join(cairo.LINE_JOIN_ROUND)
    ctx.stroke()


def glow(ctx, x, y, r, col, a=0.6, add=True):
    rr, gg, bb = hexc(col)
    p = cairo.RadialGradient(x, y, 0, x, y, r)
    p.add_color_stop_rgba(0, rr, gg, bb, a * G.alpha)
    p.add_color_stop_rgba(0.35, rr, gg, bb, a * 0.45 * G.alpha)
    p.add_color_stop_rgba(1, rr, gg, bb, 0)
    ctx.save()
    if add:
        ctx.set_operator(cairo.OPERATOR_ADD)
    ctx.set_source(p)
    ctx.arc(x, y, r, 0, 2 * math.pi)
    ctx.fill()
    ctx.restore()


def lingrad(x0, y0, x1, y1, stops, graded=True):
    p = cairo.LinearGradient(x0, y0, x1, y1)
    for o, c, *a in stops:
        r, g, b = grade(c) if graded else hexc(c)
        p.add_color_stop_rgba(o, r, g, b, (a[0] if a else 1.0) * G.alpha)
    return p


# ----------------------------------------------------------------- küçük kız
SKIN = '#f6d6c1'
SKIN_SH = '#e9b9a2'
BLUSH = '#f19c97'
HAIR = '#4b2f24'
HAIR_D = '#35211a'
HAIR_L = '#6f4838'
IRIS = '#6b3f22'
PUPIL = '#24130d'
SWEATER = '#f0dc96'
SWEATER_SH = '#d8c07a'
SKIRT = '#8a5a3c'
SKIRT_D = '#6b432d'
SOCK = '#f5f2ea'
SHOE = '#5d4c46'
SHOE_L = '#86746a'


def girl_defaults():
    return dict(view='side', phase=0.0, amt=0.0, run=0.0, sit=0.0,
                yaw=0.42, tilt=0.0, pitch=0.0, lookx=0.25, looky=0.0,
                blink=0.0, smile=0.0, sad=0.25, mouth=0.0, wind=0.5, t=0.0,
                breath=0.0, lean=0.0, hairseed=0, armfold=0.0)


def _leg(ctx, hip, a1, k, far, seed, show_thigh=True):
    L1, L2 = 44.0, 43.0
    kx = hip[0] + L1 * math.sin(a1)
    ky = hip[1] + L1 * math.cos(a1)
    a2 = a1 - k
    ax = kx + L2 * math.sin(a2)
    ay = ky + L2 * math.cos(a2)
    sk = shade(SKIN_SH if far else SKIN, 0.9 if far else 1.0)
    if show_thigh:
        stroke(ctx, [hip, (kx, ky)], sk, 13.5, seed=seed)
    stroke(ctx, [(kx, ky), (ax, ay)], sk, 12.0, seed=seed + 1)
    # çorap: baldırın alt yarısı
    mx, my = lerp(kx, ax, 0.38), lerp(ky, ay, 0.38)
    stroke(ctx, [(mx, my), (ax, ay)], shade(SOCK, 0.86 if far else 1.0), 12.6, seed=seed + 2)
    stroke(ctx, [(mx, my), (ax, ay)], OUTLINE, 0.9, a=0.25, seed=seed + 3)
    # ayakkabı (eski, yıpranmış)
    fa = a2 * 0.6
    sh = ell(ax + 6 * math.cos(fa), ay + 3, 12.5, 6.2, n=12, rot=-fa * 0.5)
    paint(ctx, sh, shade(SHOE, 0.85 if far else 1.0), lw=1.1, seed=seed + 4)
    stroke(ctx, [(ax + 2, ay - 1), (ax + 9, ay - 2)], SHOE_L, 1.6, a=0.7, seed=seed + 5)
    return (ax, ay)


def _arm(ctx, sh, a, bend, far, seed, hand_vis=True):
    L1, L2 = 27.0, 26.0
    ex = sh[0] + L1 * math.sin(a)
    ey = sh[1] + L1 * math.cos(a)
    a2 = a + bend
    hx = ex + L2 * math.sin(a2)
    hy = ey + L2 * math.cos(a2)
    col = shade(SWEATER_SH if far else SWEATER, 0.92 if far else 1.0)
    stroke(ctx, [sh, (ex, ey), (lerp(ex, hx, 0.85), lerp(ey, hy, 0.85))], shade(col, 0.82), 15.5, a=0.5, seed=seed)
    stroke(ctx, [sh, (ex, ey), (lerp(ex, hx, 0.85), lerp(ey, hy, 0.85))], col, 13.5, seed=seed)
    if hand_vis:
        paint(ctx, ell(hx, hy, 6.2, 6.8, n=10), SKIN_SH if far else SKIN, lw=1.0, seed=seed + 3)
    return (hx, hy)


def back_hair(ctx, hx, hy, s):
    t, yaw, wind = s['t'], s['yaw'], s['wind']
    ox = hx - yaw * 6
    def sw(i):
        return math.sin(t * 2.3 + i * 0.9) * 3.0 * wind + math.sin(t * 5.1 + i) * 1.0 * wind - wind * 4
    pts = [(ox + 44, hy - 5), (ox + 47, hy + 22), (ox + 45 + sw(1), hy + 50), (ox + 40 + sw(2), hy + 66),
           (ox + 33 + sw(3), hy + 58), (ox + 28 + sw(4), hy + 68), (ox + 22, hy + 48), (ox + 14, hy + 36),
           (ox, hy + 32), (ox - 14, hy + 36), (ox - 22, hy + 48), (ox - 28 + sw(5), hy + 69),
           (ox - 34 + sw(6), hy + 59), (ox - 41 + sw(7), hy + 67), (ox - 46 + sw(8), hy + 50),
           (ox - 47, hy + 22), (ox - 44, hy - 5), (ox - 38, hy - 31), (ox - 20, hy - 47), (ox, hy - 51),
           (ox + 20, hy - 47), (ox + 38, hy - 31)]
    paint(ctx, pts, HAIR, lw=1.4, seed=11, jit=0.8)
    inner = ell(ox, hy + 14, 30, 26, n=12)
    path(ctx, inner, True, 0.5, 12)
    src(ctx, HAIR_D, 0.4)
    ctx.fill()


def draw_head(ctx, hx, hy, s, front_hair=True):
    """Baş: yaw (-1..1) ile 3/4 görünüm. (hx,hy) baş merkezi."""
    t = s['t']
    yaw = s['yaw']
    wind = s['wind']
    fx = hx + yaw * 15.0
    if s.get('_backhair', True):
        back_hair(ctx, hx, hy, s)
    # --- yüz
    face = []
    for i in range(18):
        a = math.pi * 2 * i / 18
        rx, ry = 35.5, 40.0
        x = math.cos(a) * rx
        y = math.sin(a) * ry
        if y > 0:   # çene biraz daha yuvarlak/küçük
            x *= 1 - 0.12 * (y / ry)
        x += yaw * 3.0 * (1 - abs(math.cos(a)))
        face.append((hx + yaw * 4 + x, hy + 2 + y))
    paint(ctx, face, SKIN, lw=1.3, seed=21)
    # yüz gölgesi (uzak taraf)
    if abs(yaw) > 0.05:
        sx = hx - math.copysign(24, yaw)
        p = cairo.RadialGradient(sx, hy + 10, 2, sx, hy + 10, 30)
        r, g, b = grade(SKIN_SH)
        p.add_color_stop_rgba(0, r, g, b, 0.55 * G.alpha)
        p.add_color_stop_rgba(1, r, g, b, 0)
        path(ctx, face, True, 0, 21)
        ctx.set_source(p)
        ctx.fill()
    pit = s['pitch']
    ey = hy + 4 - pit * 5
    # --- yanaklar
    for side in (-1, 1):
        cx = fx + side * 21 * (1 - yaw * side * 0.35)
        glow(ctx, cx, ey + 15, 11, BLUSH, a=0.45, add=False)
    # --- gözler
    blink = clamp(s['blink'])
    open_ = 1 - blink
    lx, ly = s['lookx'], s['looky']
    for side in (-1, 1):
        persp = 1 - yaw * side * -0.28   # yakın göz büyük
        persp = clamp(persp, 0.62, 1.25)
        cx = fx + side * 15.5 * (1 - abs(yaw) * 0.18) + yaw * 2
        rx, ry = 8.6 * persp, 10.0
        if open_ > 0.12:
            eye = ell(cx, ey, rx, ry * open_, n=12)
            paint(ctx, eye, '#fbf8f2', lw=0.9, seed=31 + side, linea=0.35)
            ctx.save()
            path(ctx, eye, True, 0, 31 + side)
            ctx.clip()
            ix = cx + lx * 3.2 * persp
            iy = ey + ly * 3.0
            p = cairo.RadialGradient(ix, iy - 2, 1, ix, iy, 7.6)
            r, g, b = grade('#8a5530')
            p.add_color_stop_rgba(0, r, g, b, G.alpha)
            r, g, b = grade(IRIS)
            p.add_color_stop_rgba(1, r * 0.8, g * 0.8, b * 0.8, G.alpha)
            ctx.set_source(p)
            ctx.arc(ix, iy, 7.4 * min(persp, 1.05), 0, 2 * math.pi)
            ctx.fill()
            src(ctx, PUPIL)
            ctx.arc(ix, iy, 3.6, 0, 2 * math.pi)
            ctx.fill()
            ctx.set_source_rgba(1, 1, 1, 0.95 * G.alpha)
            ctx.arc(ix + 2.4, iy - 2.6, 2.3, 0, 2 * math.pi)
            ctx.fill()
            ctx.arc(ix - 2.2, iy + 2.4, 1.1, 0, 2 * math.pi)
            ctx.fill()
            # nemli gözler (duygusal parıltı)
            ctx.set_source_rgba(1, 1, 1, 0.25 * G.alpha * s.get('tear', 0.3))
            ctx.arc(ix, iy + 4, 5, 0, math.pi)
            ctx.fill()
            ctx.restore()
            # üst kapak çizgisi + kirpik
            lid = [(cx - rx * 1.05, ey + 1), (cx - rx * 0.5, ey - ry * open_ * 1.02),
                   (cx + rx * 0.5, ey - ry * open_ * 1.02), (cx + rx * 1.08, ey - 1)]
            stroke(ctx, lid, '#2b1a16', 2.4, a=0.9, jit=0.2, seed=41 + side)
            ox = cx + side * rx * 1.05
            stroke(ctx, [(ox, ey - 1), (ox + side * 3, ey - 4)], '#2b1a16', 1.5, a=0.8, seed=43 + side)
        else:
            lid = [(cx - rx, ey + 1), (cx, ey + 3.5), (cx + rx, ey + 1)]
            stroke(ctx, lid, '#2b1a16', 2.2, a=0.9, jit=0.2, seed=45 + side)
        # kaşlar (hüzünlü: iç uç yukarı)
        sad = s['sad']
        by = ey - 15 - pit * 1
        inner = (cx - side * 6, by - sad * 3.5)
        outer = (cx + side * 7, by + 1 + sad * 1.5)
        stroke(ctx, [inner, ((inner[0] + outer[0]) / 2, by - 1.5), outer], HAIR_D, 2.3, a=0.85, seed=47 + side)
    # --- burun
    nx = fx + yaw * 5
    stroke(ctx, [(nx - 1.5, ey + 11), (nx + 1.5 * (1 if yaw >= 0 else -1), ey + 14), (nx - 1, ey + 15)],
           SKIN_SH, 1.6, a=0.9, seed=51)
    # --- ağız
    mx = fx + yaw * 4
    my = ey + 23.5
    sm = s['smile']
    mo = s['mouth']
    if mo > 0.05:
        paint(ctx, ell(mx, my + 1, 4.2 + sm * 1.5, 1.4 + mo * 3.6, n=10), '#9a4b4b', lw=1.0, seed=53, linea=0.6)
        paint(ctx, ell(mx, my + 1.6 + mo * 1.4, 2.6, 1.0 + mo, n=8), '#d9787a', line=False, seed=54)
    else:
        wdt = 5.2 + max(sm, 0) * 2.2
        stroke(ctx, [(mx - wdt, my - sm * 2.0), (mx, my + sm * 1.8), (mx + wdt, my - sm * 2.0)],
               '#9c5552', 1.9, a=0.9, seed=55)
    # --- ön saç (perçem)
    if front_hair:
        bang = []
        top = hy - 44
        bang.append((hx - 41 - yaw * 4, hy + 6))
        bang.append((hx - 43 - yaw * 5, hy - 18))
        bang.append((hx - 30, top + 2))
        bang.append((hx - 5, top - 4))
        bang.append((hx + 22, top))
        bang.append((hx + 40 - yaw * 3, hy - 20))
        bang.append((hx + 40 - yaw * 2, hy - 2))
        # alt kenar: dağınık perçem uçları
        ws = math.sin(t * 2.0) * 1.2 * wind
        bang.append((hx + 33 + yaw * 2, hy - 12))
        bang.append((fx + 22, hy - 13 + ws))
        bang.append((fx + 12, hy - 20))
        bang.append((fx + 4, hy - 11 + ws))
        bang.append((fx - 6, hy - 19))
        bang.append((fx - 14, hy - 10 + ws))
        bang.append((fx - 24, hy - 18))
        bang.append((hx - 34 + yaw * 3, hy - 8))
        paint(ctx, bang, HAIR, lw=1.3, seed=61, jit=0.7)
        # parlak saç tutamları
        for i in range(3):
            xx = hx - 16 + i * 14
            stroke(ctx, [(xx, top + 8), (xx + 3, top + 14), (xx + 2, top + 19)], HAIR_L, 1.6, a=0.4, seed=63 + i)
        # rüzgârda kalkan tek tel saç
        if wind > 0.05:
            sw = math.sin(t * 3.1) * 6 * wind
            stroke(ctx, [(hx - 20, top + 4), (hx - 32, top - 6 + sw * 0.4), (hx - 46 + sw, top - 2)],
                   HAIR, 1.6, a=0.8, seed=67)


def draw_back_head(ctx, hx, hy, s):
    t, wind = s['t'], s['wind']
    pts = []
    n = 22
    for i in range(n):
        a = math.pi * 2 * i / n
        x = hx + math.cos(a) * 45
        y = hy - 3 + math.sin(a) * 47
        if math.sin(a) > 0.1:
            k = math.sin(a)
            y += 28 * k
            x += (math.sin(t * 2.3 + i * 0.9) * 3.5 * wind - wind * 4) * k
            if i % 2 == 0:
                y += 5 * k
        pts.append((x, y))
    paint(ctx, pts, HAIR, lw=1.4, seed=71, jit=0.8)
    for i in range(5):
        xx = hx - 24 + i * 12
        stroke(ctx, [(xx, hy - 38), (xx + 2, hy - 5), (xx - 1, hy + 40)], HAIR_L, 1.6, a=0.35, seed=73 + i)
    stroke(ctx, [(hx - 2, hy - 46), (hx - 1, hy - 20)], HAIR_D, 1.4, a=0.5, seed=79)


def draw_girl(ctx, x, y, scale, s):
    """(x,y) = ayakların ortası (zemin). Yerel birimler: boy ≈ 265."""
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(scale, scale)
    view = s['view']
    t = s['t']
    p = s['phase']
    amt = s['amt']
    run = s['run']
    sit = s['sit']
    breath = math.sin(t * 2 * math.pi / 3.6) * 1.2
    bob = -3.2 * abs(math.cos(p)) * amt - 5 * abs(math.cos(p)) * run
    ctx.translate(0, bob)
    lean = s['lean'] + run * 0.10
    ctx.rotate(lean)

    hipy = -88.0 + sit * 0
    HS = 0.86
    hx, hy = 3.0, -213.0 + breath * 0.3

    def headspace():
        ctx.translate(0, -178)
        ctx.rotate(s['tilt'])
        ctx.scale(HS, HS)
        ctx.translate(0, 178)
    if view in ('side', 'front'):
        ctx.save(); headspace(); back_hair(ctx, hx, hy - 6 / HS, s); ctx.restore()
        A = 0.40 * amt + 0.70 * run
        K = 0.55 * amt + 1.10 * run
        # uzak bacak + uzak kol (arkada)
        if sit > 0.5:
            sw = math.sin(t * 3.2)
            _leg(ctx, (-3, hipy), 1.45, 1.45 + 0.25 * sw, True, 101)
        else:
            _leg(ctx, (-3, hipy), A * math.sin(p + math.pi), K * max(0, math.cos(p + math.pi)), True, 101)
        armA = -0.32 * amt * math.sin(p) - 0.8 * run * math.sin(p)
        bend = 0.25 + 0.9 * run + s['armfold']
        if view == 'side':
            _arm(ctx, (-7, -160 + breath * 0.3), -armA * 1.0 + 0.05, bend, True, 111)
        if sit > 0.5:
            sw = math.sin(t * 3.2 + 1.7)
            _leg(ctx, (5, hipy), 1.45, 1.45 + 0.25 * sw, False, 121)
        else:
            _leg(ctx, (5, hipy), A * math.sin(p), K * max(0, math.cos(p)), False, 121)
    else:  # arkadan görünüm: bacaklar sırayla kalkar
        for side, ph, sd in ((-1, p, 131), (1, p + math.pi, 141)):
            lift = max(0, math.sin(ph)) * amt
            hip = (side * 8, hipy)
            L = 87 - lift * 12
            ax, ay = hip[0] + side * 1.5, hip[1] + L
            stroke(ctx, [hip, (ax, ay - 30)], SKIN_SH, 13, seed=sd)
            stroke(ctx, [(ax, ay - 34), (ax, ay)], SOCK, 12.6, seed=sd + 1)
            paint(ctx, ell(ax, ay + 1, 9, 6.5, n=10), SHOE, lw=1.0, seed=sd + 2)
            # taban (yıpranmış açık renk)
            if lift > 0.2:
                paint(ctx, ell(ax, ay + 3, 7.5, 3, n=8), SHOE_L, line=False, seed=sd + 3)

    # etek
    sway = math.sin(t * 1.7) * 2 * s['wind'] + math.sin(p * 2) * 1.5 * amt
    sk = [(-17, -121), (17, -121), (21, -100), (26 + sway, -71), (14 + sway, -68), (2 + sway, -71),
          (-12 + sway, -68), (-26 + sway, -71), (-21, -100)]
    if sit > 0.5:
        sk = [(-17, -121), (17, -121), (30, -104), (46, -92), (40, -84), (8, -84), (-20, -86), (-24, -104)]
    paint(ctx, sk, SKIRT, lw=1.3, seed=151, jit=0.6)
    for xx in (-9, 0, 9):
        stroke(ctx, [(xx * 0.8, -116), (xx * 1.25 + sway * 0.6, -74 + (6 if sit > 0.5 else 0))], SKIRT_D, 1.2,
               a=0.5, seed=153 + xx)

    # kazak gövde
    br = breath
    torso = [(-19, -168 - br * 0.4), (-5, -173 - br * 0.5), (6, -173 - br * 0.5), (19, -168 - br * 0.4),
             (21, -145), (20, -120), (10, -114), (-10, -114), (-20, -120), (-21, -145)]
    paint(ctx, torso, SWEATER, lw=1.4, seed=161, jit=0.6)
    # örgü dokusu
    for i in range(4):
        yy = -158 + i * 11
        stroke(ctx, [(-15, yy), (-5, yy + 1.5), (5, yy), (15, yy + 1.2)], SWEATER_SH, 1.1, a=0.55, seed=163 + i)
    stroke(ctx, [(-19, -121), (0, -118), (19, -121)], SWEATER_SH, 3.5, a=0.8, seed=169)  # lastikli bel
    # yaka
    paint(ctx, ell(0, -171, 10, 4.5, n=10), SWEATER_SH, lw=1.0, seed=171)

    if view == 'side':
        armA = -0.32 * amt * math.sin(p) - 0.8 * run * math.sin(p)
        bend = 0.25 + 0.9 * run + s['armfold']
        _arm(ctx, (8, -160 + breath * 0.3), armA - 0.02, bend, False, 181)
    elif view == 'front':
        for side in (-1, 1):
            stroke(ctx, [(side * 18, -162), (side * 23, -136), (side * 22, -114)], SWEATER, 13.5, seed=191 + side)
            paint(ctx, ell(side * 22, -109, 6, 6.5, n=10), SKIN, lw=1.0, seed=195 + side)
    else:
        for side, ph in ((-1, p), (1, p + math.pi)):
            a = 0.25 * amt * math.sin(ph)
            stroke(ctx, [(side * 19, -160), (side * 22, -132 + a * 10), (side * 21, -112 + a * 14)],
                   SWEATER_SH, 13.5, seed=191 + side)
            paint(ctx, ell(side * 21, -108 + a * 14, 6, 6.5, n=10), SKIN_SH, lw=1.0, seed=195 + side)

    # boyun
    stroke(ctx, [(0, -172), (0, -182)], SKIN_SH, 13, seed=199)
    # baş
    ctx.save()
    headspace()
    if view == 'back':
        draw_back_head(ctx, hx - 2, hy - 6 / HS, s)
    else:
        s2 = dict(s); s2['_backhair'] = False
        draw_head(ctx, hx, hy - 6 / HS, s2)
    ctx.restore()
    ctx.restore()


# ----------------------------------------------------------------- iç mekân figürleri
def person(ctx, x, y, h, body, hair, pose, seed=0, skin='#f0c9a8', hairstyle='short', facing=0.0,
           smile=True, a=1.0):
    """Basit, sıcak, sade figür. (x,y)=bel/oturma noktası değil: baş tepesi için y-h.
    pose: dict(armL, armR açılar; head_tilt; lift)"""
    k = h / 100.0
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(k, k)
    hy = -78 + pose.get('bob', 0)
    tilt = pose.get('tilt', 0)
    # gövde
    bodyp = [(-17, -58), (17, -58), (22, -20), (24, 30), (-24, 30), (-22, -20)]
    paint(ctx, bodyp, body, a=a, lw=1.6, seed=seed + 1, jit=0.6)
    # kollar
    for side, key in ((-1, 'armL'), (1, 'armR')):
        ang = pose.get(key, 0.15)
        sx, sy = side * 16, -52
        ex = sx + side * 22 * math.sin(abs(ang)) * (1 if ang >= 0 else 1)
        ex = sx + 22 * math.sin(ang) * side
        ey = sy + 22 * math.cos(ang)
        fa = ang + pose.get(key + 'b', 0.4)
        hxx = ex + 20 * math.sin(fa) * side
        hyy = ey + 20 * math.cos(fa)
        stroke(ctx, [(sx, sy), (ex, ey), (hxx, hyy)], shade(body, 0.9), 10, a=a, seed=seed + 3 + side)
        paint(ctx, ell(hxx, hyy, 4.5, 4.5, n=8), skin, a=a, lw=1.0, seed=seed + 5 + side)
    # boyun + baş
    ctx.save()
    ctx.translate(0, -60)
    ctx.rotate(tilt)
    ctx.translate(0, 60)
    stroke(ctx, [(0, -58), (0, -66)], shade(skin, 0.9), 9, a=a, seed=seed + 7)
    if hairstyle == 'long':
        paint(ctx, [(-19, hy - 6), (-17, hy - 20), (0, hy - 25), (17, hy - 20), (19, hy - 6), (21, hy + 24),
                    (12, hy + 28), (-12, hy + 28), (-21, hy + 24)], hair, a=a, lw=1.2, seed=seed + 8)
    elif hairstyle == 'bun':
        paint(ctx, ell(0, hy - 22, 9, 8, n=10), hair, a=a, lw=1.2, seed=seed + 8)
    paint(ctx, ell(facing * 3, hy, 15, 17, n=12), skin, a=a, lw=1.2, seed=seed + 9)
    # saç kapağı
    hp = [(-16, hy + 2), (-15, hy - 12), (-4, hy - 18), (10, hy - 17), (16, hy - 8), (16, hy + 1),
          (8 + facing * 4, hy - 8), (-6 + facing * 4, hy - 9)]
    if hairstyle == 'child':
        hp = [(-16, hy + 8), (-16, hy - 12), (0, hy - 19), (16, hy - 12), (16, hy + 8), (8, hy - 6), (-8, hy - 6)]
    paint(ctx, hp, hair, a=a, lw=1.1, seed=seed + 10)
    # yüz: gülümseyen kapalı gözler
    fx = facing * 6
    if smile:
        for side in (-1, 1):
            stroke(ctx, [(fx + side * 6 - 2.5, hy + 1), (fx + side * 6, hy - 1), (fx + side * 6 + 2.5, hy + 1)],
                   '#4a3030', 1.3, a=0.8 * a, seed=seed + 12 + side)
        stroke(ctx, [(fx - 3.5, hy + 8), (fx, hy + 10), (fx + 3.5, hy + 8)], '#8a4a44', 1.3, a=0.8 * a,
               seed=seed + 15)
        glow(ctx, fx - 9, hy + 6, 5, BLUSH, a=0.35 * a, add=False)
        glow(ctx, fx + 9, hy + 6, 5, BLUSH, a=0.35 * a, add=False)
    ctx.restore()
    ctx.restore()


def table(ctx, x, y, w, h, cloth='#f3e6cf', seed=0, items=True, t=0.0):
    """Masa (örtülü). (x,y) = masa üstü ön kenar ortası."""
    top = [(x - w / 2, y - 8), (x + w / 2, y - 8), (x + w / 2 + 6, y + 4), (x - w / 2 - 6, y + 4)]
    paint(ctx, top, shade(cloth, 1.0), lw=1.2, seed=seed)
    drape = [(x - w / 2 - 6, y + 4), (x + w / 2 + 6, y + 4), (x + w / 2 + 8, y + h * 0.45),
             (x + w / 4, y + h * 0.42), (x, y + h * 0.46), (x - w / 4, y + h * 0.42), (x - w / 2 - 8, y + h * 0.45)]
    paint(ctx, drape, shade(cloth, 0.93), lw=1.2, seed=seed + 1)
    for i in range(5):
        xx = x - w / 2 + w * (i + 0.5) / 5
        stroke(ctx, [(xx, y + 8), (xx + 2, y + h * 0.42)], shade(cloth, 0.8), 1.0, a=0.5, seed=seed + 3 + i)
    # bacaklar
    for side in (-1, 1):
        stroke(ctx, [(x + side * (w / 2 - 6), y + h * 0.45), (x + side * (w / 2 - 8), y + h)], '#7a5238', 6,
               seed=seed + 9 + side)
