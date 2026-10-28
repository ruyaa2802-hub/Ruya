"""Sabit karakter tasarımları: Rüya Ruj, Parfüm Aras, Pudra Lalin, Telefon Mert, Maskara Serra.

Her karakter bir kez tanımlanır (gövde + yüz spesifikasyonu); tüm sahneler aynı çizim
kodunu kullanır, böylece şekil/renk/oran bütün karelerde birebir aynı kalır.
Birim: 1 birim = 1 dünya pikseli (1080 genişlikli dünyada). Çizim ölçeği S ile büyütülür.
"""
import math
from collections import OrderedDict
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageChops
from style import *

CW, CH = 480, 560           # sprite tuvali (birim)
BASE_Y = CH - 30            # taban çizgisi


def P(S, x, y):
    return ((CW / 2 + x) * S, (BASE_Y + y) * S)


def BX(S, x0, y0, x1, y1):
    a, b = P(S, x0, y0), P(S, x1, y1)
    return (a[0], a[1], b[0], b[1])


def canvas(S):
    return Image.new('RGBA', (int(CW * S), int(CH * S)), (0, 0, 0, 0))


def odd(v):
    v = max(3, int(v))
    return v if v % 2 else v + 1


def rrmask(S, size, x0, y0, x1, y1, r):
    m = newmask(size)
    ImageDraw.Draw(m).rounded_rectangle(BX(S, x0, y0, x1, y1), radius=r * S, fill=255)
    return m


def ellmask(S, size, x0, y0, x1, y1):
    m = newmask(size)
    ImageDraw.Draw(m).ellipse(BX(S, x0, y0, x1, y1), fill=255)
    return m


def polymask(S, size, pts, r=0):
    m = newmask(size)
    ImageDraw.Draw(m).polygon([P(S, x, y) for x, y in pts], fill=255)
    return smooth_mask(m, r * S) if r else m


def poly_alpha(S, img, pts, col, a):
    alpha_poly(img, [P(S, x, y) for x, y in pts], col, a)


# ------------------------------------------------------------------ GÖVDELER
def ruya_body(S):
    img = canvas(S); sz = img.size
    # altın metal taban (kılıf)
    m = rrmask(S, sz, -70, -150, 70, 0, 14)
    shade_cyl(img, m, hx('4f320a'), hx('d4a43a'), hx('fff0b4'), hl=.6, hlpos=.2, hlw=.045, rim=hx('ffe08a'))
    for (ya, yb, a) in ((-150, -141, 110), (-24, -19, 90), (-8, 0, 70)):
        poly_alpha(S, img, [(-70, ya), (70, ya), (70, yb), (-70, yb)], (60, 38, 6), a)
    poly_alpha(S, img, [(-66, -146), (66, -146), (66, -143), (-66, -143)], (255, 240, 170), 120)
    # bordo ruj gövdesi (eğik uçlu)
    pts = [(-61, -146), (-61, -372), (-50, -402), (-20, -430), (24, -448), (50, -442), (61, -420), (61, -146)]
    m = polymask(S, sz, pts, 9)
    shade_cyl(img, m, hx('2a030d'), hx('8c1030'), hx('e24a6a'), hl=.55, hlpos=.2, hlw=.05, rim=hx('ff6f8c'))
    poly_alpha(S, img, [(-48, -400), (-18, -427), (24, -444), (42, -439), (-2, -420), (-38, -394)], (255, 150, 170), 120)
    poly_alpha(S, img, [(-61, -146), (61, -146), (61, -160), (-61, -160)], (20, 0, 6), 110)
    return img


def aras_body(S):
    img = canvas(S); sz = img.size
    m = rrmask(S, sz, -92, -332, 92, 0, 24)
    shade_cyl(img, m, hx('030305'), hx('15161d'), hx('545868'), hl=.28, hlpos=.17, hlw=.04, rim=hx('7d86a8'), vgrad=.18)
    # cam kalınlığı (iç gövde)
    m2 = rrmask(S, sz, -78, -318, 78, -36, 14)
    shade_cyl(img, m2, hx('000001'), hx('08080c'), hx('2b2d3a'), hl=.12, hlpos=.2, hlw=.05, vgrad=.1)
    # taban cam bloğu
    m3 = rrmask(S, sz, -92, -36, 92, 0, 12)
    shade_cyl(img, m3, hx('0d0e14'), hx('272a36'), hx('7b8196'), hl=.3, hlpos=.18, hlw=.05)
    poly_alpha(S, img, [(-70, -310), (-62, -310), (-62, -60), (-70, -60)], (255, 255, 255), 70)
    poly_alpha(S, img, [(-56, -310), (-52, -310), (-52, -200), (-56, -200)], (255, 255, 255), 38)
    poly_alpha(S, img, [(72, -300), (76, -300), (76, -90), (72, -90)], (140, 160, 220), 55)
    # gümüş etiket
    m = rrmask(S, sz, -52, -92, 52, -62, 6)
    shade_cyl(img, m, hx('555a68'), hx('c2c6d1'), hx('ffffff'), hl=.4, hlpos=.25, hlw=.06)
    d = ImageDraw.Draw(img)
    cx, cy = P(S, 0, -77)
    d.polygon([(cx, cy - 8 * S), (cx + 6 * S, cy), (cx, cy + 8 * S), (cx - 6 * S, cy)], fill=(70, 74, 88, 255))
    # boyun + gümüş kapak
    m = rrmask(S, sz, -32, -356, 32, -326, 4)
    shade_cyl(img, m, hx('3c404c'), hx('9aa0ae'), hx('e6e9f0'), hl=.3)
    m = rrmask(S, sz, -58, -442, 58, -350, 11)
    shade_cyl(img, m, hx('50556a'), hx('c3c7d3'), hx('ffffff'), hl=.6, hlpos=.2, hlw=.05, rim=hx('ffffff'))
    for yy in (-372, -386):
        poly_alpha(S, img, [(-58, yy), (58, yy), (58, yy + 3), (-58, yy + 3)], (50, 54, 68), 120)
    poly_alpha(S, img, [(-58, -442), (58, -442), (58, -430), (-58, -430)], (255, 255, 255), 70)
    return img


def lalin_body(S):
    img = canvas(S); sz = img.size
    cy = -168
    m = rrmask(S, sz, -80, -20, 80, 0, 7)
    shade_cyl(img, m, hx('4f320a'), hx('d4a43a'), hx('fff0b4'), hl=.5, hlpos=.2, hlw=.05)
    m = ellmask(S, sz, -152, cy - 152, 152, cy + 152)
    shade_radial(img, m, hx('5a3a0c'), hx('dcae44'), hx('fff1b9'), spec=.5, dome=.35, rim=hx('ffe28c'))
    m = ellmask(S, sz, -137, cy - 137, 137, cy + 137)
    shade_radial(img, m, hx('b46a80'), hx('f1bccb'), hx('fff0f4'), spec=.4, dome=.5, rim=hx('ffd5e0'))
    d = ImageDraw.Draw(img)
    for r, col in ((118, (150, 80, 100, 90)), (116, (255, 255, 255, 60))):
        a = P(S, -r, cy - r + (1 if r == 116 else 0)); b = P(S, r, cy + r + (1 if r == 116 else 0))
        d.ellipse((a[0], a[1], b[0], b[1]), outline=col, width=max(1, int(2.5 * S)))
    # menteşe
    m = rrmask(S, sz, -46, cy - 160, 46, cy - 132, 8)
    shade_cyl(img, m, hx('5a3a0c'), hx('dcae44'), hx('fff1b9'), hl=.5)
    for k in range(10):
        a = math.radians(200 + k * 14)
        x, y = 100 * math.cos(a), cy + 100 * math.sin(a)
        c = P(S, x, y); r = 2.6 * S
        d.ellipse((c[0] - r, c[1] - r, c[0] + r, c[1] + r), fill=(255, 238, 190, 190))
    return img


def mert_body(S):
    img = canvas(S); sz = img.size
    # küçük ayaklar
    for x0, x1 in ((-64, -30), (30, 64)):
        m = rrmask(S, sz, x0, -9, x1, 0, 4)
        shade_cyl(img, m, hx('06060a'), hx('1a1b24'), hx('4a4e5e'), hl=.2)
    m = rrmask(S, sz, -98, -396, 98, -6, 34)
    shade_cyl(img, m, hx('3a3e4b'), hx('a3a8b6'), hx('f7f9ff'), hl=.7, hlpos=.12, hlw=.03, rim=hx('ffffff'), rimw=.03)
    m = rrmask(S, sz, -92, -390, 92, -12, 29)
    shade_cyl(img, m, hx('020204'), hx('0b0b11'), hx('2a2c38'), hl=.1, hlpos=.15)
    for y0, y1 in ((-300, -256), (-240, -212)):
        m = rrmask(S, sz, 96, y0, 103, y1, 3)
        shade_cyl(img, m, hx('50556a'), hx('b5bac8'), hx('ffffff'), hl=.3)
    # ekran
    m = rrmask(S, sz, -83, -381, 83, -21, 21)
    shade_vert(img, m, hx('06101f'), hx('0d3150'))
    # cam yansıması
    poly_alpha(S, img, [(-83, -381), (-10, -381), (-83, -250)], (255, 255, 255), 22)
    poly_alpha(S, img, [(30, -381), (50, -381), (-83, -140), (-83, -176)], (255, 255, 255), 10)
    d = ImageDraw.Draw(img)
    c = P(S, 0, -370); r = 5 * S
    d.ellipse((c[0] - r, c[1] - r, c[0] + r, c[1] + r), fill=(4, 6, 12, 255), outline=(60, 70, 96, 255), width=max(1, int(S)))
    return img


def serra_body(S):
    img = canvas(S); sz = img.size
    m = rrmask(S, sz, -60, -330, 60, 0, 14)
    shade_cyl(img, m, hx('020203'), hx('141418'), hx('50535f'), hl=.3, hlpos=.18, hlw=.045, rim=hx('8a90a8'), vgrad=.2)
    for y0, y1 in ((-338, -318), (-30, -10), (-8, 0)):
        m = rrmask(S, sz, -62, y0, 62, y1, 5)
        shade_cyl(img, m, hx('50556a'), hx('c3c7d3'), hx('ffffff'), hl=.6, hlpos=.2, hlw=.05, rim=hx('ffffff'))
    m = rrmask(S, sz, -44, -452, 44, -336, 22)
    shade_cyl(img, m, hx('010102'), hx('101015'), hx('4b4e5a'), hl=.3, hlpos=.18, hlw=.05, rim=hx('8a90a8'))
    for yy in (-380, -400, -420):
        poly_alpha(S, img, [(-44, yy), (44, yy), (44, yy + 4), (-44, yy + 4)], (140, 146, 164), 150)
    return img


# ------------------------------------------------------------------ YÜZ ÖZELLİKLERİ
SPECS = {
    'ruya': dict(body=ruya_body,
                 eye=dict(dx=29, y=-288, w=43, h=55), iris=('3a1608', '8a4a20', 'e0a24a'), pupil='140604',
                 white='fff8f6', lash='170308', lash_th=3.2, lashes=True, wing=False,
                 brow=dict(col='2a0710', w=4.2, gap=10, arch=4, out=0.62), mouth=dict(y=-228, w=34, lip='ff7f9a', inner='3c0613', h=17),
                 shoulders=((-62, -236), (62, -236)), arm=('dcae44', '7a520f'), arm_w=11, blush='ff8fa8', blush_dy=32),
    'aras': dict(body=aras_body,
                 eye=dict(dx=38, y=-205, w=44, h=44), iris=('424858', '8f98ad', 'dfe6f5'), pupil='06070a',
                 white='f4f6fa', lash='050507', lash_th=3.6, lashes=False, wing=False,
                 brow=dict(col='050506', w=7.5, gap=8, arch=-1.5, out=0.7), mouth=dict(y=-148, w=36, lip='454a58', inner='08080c', h=15),
                 shoulders=((-90, -200), (90, -200)), arm=('c3c7d3', '555a68'), arm_w=11, blush=None, blush_dy=0),
    'lalin': dict(body=lalin_body,
                  eye=dict(dx=50, y=-176, w=50, h=47), iris=('4a6a8c', '9fd0ee', 'f2fbff'), pupil='0a1018',
                  white='f6f9fc', lash='08040a', lash_th=4.2, lashes=False, wing=True, lid=0.28,
                  brow=dict(col='1c0a14', w=4.0, gap=9, arch=6, out=0.7), mouth=dict(y=-112, w=34, lip='a8456a', inner='3a0a1c', h=14),
                  shoulders=((-134, -170), (134, -170)), arm=('dcae44', '7a520f'), arm_w=11, blush=None, blush_dy=0),
    'mert': dict(body=mert_body, kind='screen',
                 eye=dict(dx=37, y=-312, w=34, h=48), mouth=dict(y=-262, w=62),
                 shoulders=((-96, -250), (96, -250)), arm=('1e202a', '9aa0b0'), arm_w=10),
    'serra': dict(body=serra_body,
                  eye=dict(dx=26, y=-240, w=33, h=41), iris=('3a2210', '7a4a22', 'd8a050'), pupil='0a0604',
                  white='fbf7f4', lash='050404', lash_th=3.4, lashes=True, wing=False,
                  brow=dict(col='050404', w=5.5, gap=8, arch=-1, out=0.7), mouth=dict(y=-190, w=28, lip='8a8f9e', inner='08080c', h=14),
                  shoulders=((-58, -190), (58, -190)), arm=('c3c7d3', '555a68'), arm_w=10, blush=None, blush_dy=0),
}

DEF = dict(eo=1.0, lx=0.0, ly=0.0, brow=0.0, bang=0.0, mo=0.0, mc=0.25, tear=0.0, drop=-1.0, blush=0.35, lid=None,
           lax=-14, lay=66, rax=14, ray=66, bend=1.0, prop=None, screen=None, talk=0.0, glow=0.0, sil=0.0)


def _edge(m, k):
    er = m.filter(ImageFilter.GaussianBlur(max(0.8, k / 2.4))).point(lambda v: 255 if v > 232 else 0)
    return ImageChops.subtract(m, er)


def eye(img, S, cx, cy, w, h, side, st, sp):
    eo = float(np.clip(st['eo'], 0, 1))
    lidx = st['lid'] if st['lid'] is not None else sp.get('lid', 0.0)
    ceff = 1 - eo * (1 - lidx)
    pad = 16
    bx0 = int((CW / 2 + cx - w / 2 - pad) * S); by0 = int((BASE_Y + cy - h / 2 - pad - 8) * S)
    bw = int((w + 2 * pad) * S); bh = int((h + 2 * pad + 16) * S)

    def L(x, y):
        return ((CW / 2 + x) * S - bx0, (BASE_Y + y) * S - by0)

    ea, eb = L(cx - w / 2, cy - h / 2), L(cx + w / 2, cy + h / 2)
    screen = sp.get('kind') == 'screen'
    m1 = newmask((bw, bh))
    if screen:
        ImageDraw.Draw(m1).rounded_rectangle((ea[0], ea[1], eb[0], eb[1]), radius=w * 0.42 * S, fill=255)
    else:
        ImageDraw.Draw(m1).ellipse((ea[0], ea[1], eb[0], eb[1]), fill=255)
    yl0 = cy - h / 2 - 3 + ceff * (h + 6)
    k = -side * st['bang'] * 0.5
    keep = newmask((bw, bh))
    pl = [L(cx - w, yl0 + k * (-w)), L(cx + w, yl0 + k * w), L(cx + w, cy + h), L(cx - w, cy + h)]
    ImageDraw.Draw(keep).polygon(pl, fill=255)
    vis = ImageChops.multiply(m1, keep)
    if vis.getbbox():
        lay = Image.new('RGBA', (bw, bh), (0, 0, 0, 0))
        d = ImageDraw.Draw(lay)
        if screen:
            msk = vis
            c1 = hx('40d2ff'); c2 = hx('c8f8ff')
            arr = np.zeros((bh, bw, 3), np.float32)
            yy = np.arange(bh, dtype=np.float32)[:, None]
            t = np.clip((yy - ea[1]) / max(1, eb[1] - ea[1]), 0, 1)
            arr[:] = mix(c2, c1, t[..., None] * 0 + (np.abs(t - 0.45) * 1.6)[..., None])
            lay = Image.fromarray(np.dstack([arr.astype(np.uint8), np.full((bh, bw), 255, np.uint8)]), 'RGBA')
            d = ImageDraw.Draw(lay)
            ox = st['lx'] * w * 0.2; oy = st['ly'] * h * 0.16
            pa, pb = L(cx + ox - w * 0.2, cy + oy - h * 0.2), L(cx + ox + w * 0.2, cy + oy + h * 0.2)
            d.rounded_rectangle((pa[0], pa[1], pb[0], pb[1]), radius=w * 0.2 * S, fill=(5, 20, 36, 255))
            ha, hb = L(cx + ox - w * 0.1, cy + oy - h * 0.16), L(cx + ox + w * 0.0, cy + oy - h * 0.06)
            d.ellipse((ha[0], ha[1], hb[0], hb[1]), fill=(255, 255, 255, 255))
        else:
            d.ellipse((ea[0] - 2, ea[1] - 2, eb[0] + 2, eb[1] + 2), fill=rgb('d9d2d8') + (255,))
            wa, wb = L(cx - w / 2, cy - h / 2 + h * 0.1), L(cx + w / 2, cy + h / 2 + 1)
            d.ellipse((wa[0], wa[1], wb[0], wb[1]), fill=rgb(sp['white']) + (255,))
            ri = min(w, h) * 0.44
            ox = st['lx'] * w * 0.36; oy = st['ly'] * h * 0.24 + h * 0.03
            icx, icy = cx + ox, cy + oy
            c0, c1, c2 = [hx(v) for v in sp['iris']]
            for i in range(8):
                t = i / 7
                rr = ri * (1 - 0.8 * t)
                col = mix(c0, c1, min(1, t * 1.6)) if t < .62 else mix(c1, c2, (t - .62) / .38)
                a, b = L(icx - rr, icy - rr * 1.02), L(icx + rr, icy + rr * 1.02)
                d.ellipse((a[0], a[1], b[0], b[1]), fill=tuple(int(v) for v in col) + (255,))
            pr = ri * 0.46
            a, b = L(icx - pr, icy - pr), L(icx + pr, icy + pr)
            d.ellipse((a[0], a[1], b[0], b[1]), fill=rgb(sp['pupil']) + (255,))
            gr = ri * 0.3
            a, b = L(icx - ri * 0.42 - gr, icy - ri * 0.42 - gr), L(icx - ri * 0.42 + gr, icy - ri * 0.42 + gr)
            d.ellipse((a[0], a[1], b[0], b[1]), fill=(255, 255, 255, 255))
            gr = ri * 0.13
            a, b = L(icx + ri * 0.4 - gr, icy + ri * 0.38 - gr), L(icx + ri * 0.4 + gr, icy + ri * 0.38 + gr)
            d.ellipse((a[0], a[1], b[0], b[1]), fill=(255, 255, 255, 215))
            if st['tear'] > 0.02:
                tr = st['tear']
                ya = cy + h / 2 - h * 0.42 * tr
                a, b = L(cx - w, ya), L(cx + w, cy + h)
                lay2 = Image.new('RGBA', (bw, bh), (0, 0, 0, 0))
                ImageDraw.Draw(lay2).rectangle((a[0], a[1], b[0], b[1]), fill=(185, 225, 255, int(120 + 70 * tr)))
                lay.alpha_composite(lay2)
                d = ImageDraw.Draw(lay)
                a, b = L(cx - w * 0.3, ya + 1), L(cx + w * 0.34, ya + 4)
                d.ellipse((a[0], a[1], b[0], b[1]), fill=(255, 255, 255, int(200 * tr)))
                gr = 3.2 * tr
                a, b = L(cx + w * 0.22 - gr, cy + h * 0.2 - gr), L(cx + w * 0.22 + gr, cy + h * 0.2 + gr)
                d.ellipse((a[0], a[1], b[0], b[1]), fill=(255, 255, 255, 230))
        out = Image.new('RGBA', (bw, bh), (0, 0, 0, 0))
        out.paste(lay, (0, 0), vis)
        if not screen:
            col = rgb(sp['lash']) + (255,)
            thin = _edge(vis, 1.7 * S)
            thick = _edge(vis, sp['lash_th'] * S * 2)
            up = newmask((bw, bh)); ImageDraw.Draw(up).rectangle((0, 0, bw, L(0, cy + h * 0.05)[1]), fill=255)
            ln = ImageChops.lighter(thin, ImageChops.multiply(thick, up))
            out.paste(Image.new('RGBA', (bw, bh), col), (0, 0), ln)
        if screen:
            out = out.filter(ImageFilter.GaussianBlur(0.6))
        img.alpha_composite(out, (bx0, by0))
        if screen:
            glow = Image.new('RGBA', (bw, bh), (0, 0, 0, 0))
            glow.paste(Image.new('RGBA', (bw, bh), (70, 200, 255, 90)), (0, 0), vis)
            glow = glow.filter(ImageFilter.GaussianBlur(5 * S))
            img.alpha_composite(glow, (bx0, by0))
    d2 = ImageDraw.Draw(img)
    if not screen:
        col = rgb(sp['lash']) + (255,)
        if eo < 0.12 or not vis.getbbox():
            pts = [P(S, cx - w / 2 * .95 + i * w * .95 / 8, cy + h * .18 + 3.5 * math.sin(math.pi * i / 8) * (1 - eo) + k * (-w / 2 + i * w / 8)) for i in range(9)]
            d2.line(pts, fill=col, width=int(sp['lash_th'] * S), joint='curve')
        if sp['lashes'] and eo > 0.2:
            oxs = cx + side * w / 2
            for i, (ang, ln) in enumerate(((-50, 11), (-25, 13), (-2, 11))):
                a = math.radians(ang)
                sx_, sy_ = oxs - side * 3, cy - h * 0.28 + i * h * 0.17 - (1 - eo) * h * 0.2 + (ceff * h * 0.5 if i == 0 else 0)
                dx, dy = side * math.cos(a) * ln, math.sin(a) * ln
                d2.line([P(S, sx_, sy_), P(S, sx_ + dx, sy_ + dy)], fill=col, width=int(2.6 * S))
        if sp['wing'] and eo > 0.15:
            ox_, oy_ = cx + side * w / 2, yl0 + (side * -1) * 0 + k * (side * w / 2) + 1
            pts = [P(S, ox_ - side * 10, oy_ - 3), P(S, ox_ + side * 18, oy_ - 11), P(S, ox_ + side * 3, oy_ + 3), P(S, ox_ - side * 10, oy_ + 2)]
            d2.polygon(pts, fill=col)


def brow(img, S, cx, cy, w, h, side, st, sp):
    b = sp['brow']
    d = ImageDraw.Draw(img)
    base = cy - h / 2 - b['gap'] - st['brow'] * 11
    ix, ox = cx - side * w * 0.5, cx + side * w * b['out']
    iy = base + st['bang'] * 12
    oy = base - st['bang'] * 4 + (3 if st['bang'] < 0 else 0)
    my = (iy + oy) / 2 - b['arch'] - (6 if st['bang'] < -0.3 else 0)
    mx = (ix + ox) / 2
    pts = []
    for i in range(11):
        t = i / 10
        x = (1 - t) ** 2 * ix + 2 * t * (1 - t) * mx + t * t * ox
        y = (1 - t) ** 2 * iy + 2 * t * (1 - t) * my + t * t * oy
        pts.append(P(S, x, y))
    col = rgb(b['col']) + (255,)
    d.line(pts, fill=col, width=int(b['w'] * S), joint='curve')
    r = b['w'] * S / 2
    for p in (pts[0], pts[-1]):
        d.ellipse((p[0] - r, p[1] - r, p[0] + r, p[1] + r), fill=col)


def mouth(img, S, cx, cy, w, st, sp):
    mp = sp['mouth']
    o = float(np.clip(st['mo'], 0, 1)); c = st['mc']
    d = ImageDraw.Draw(img)
    cornery = cy - c * 6.5
    centery = cy + c * 3.2
    N = 14
    up, lo = [], []
    hh = mp.get('h', 15) * (w / 34)
    for i in range(N + 1):
        u = -1 + 2 * i / N
        yc = centery + (cornery - centery) * u * u
        x = cx + u * w / 2
        up.append(P(S, x, yc - o * 2.2 * (1 - u * u)))
        lo.append(P(S, x, yc + o * hh * (1 - u * u) ** 0.8 + 0.5))
    lip = rgb(mp['lip']) + (255,)
    if o > 0.07:
        d.polygon(up + lo[::-1], fill=rgb(mp['inner']) + (255,))
        if o > 0.3:
            tc = P(S, cx, (cy + o * hh * 0.85))
            rw, rh = w * 0.26 * S, o * hh * 0.34 * S
            lay = Image.new('RGBA', img.size, (0, 0, 0, 0))
            ImageDraw.Draw(lay).ellipse((tc[0] - rw, tc[1] - rh, tc[0] + rw, tc[1] + rh), fill=(226, 96, 120, 230))
            msk = newmask(img.size); ImageDraw.Draw(msk).polygon(up + lo[::-1], fill=255)
            tmp = Image.new('RGBA', img.size, (0, 0, 0, 0)); tmp.paste(lay, (0, 0), msk)
            img.alpha_composite(tmp)
        d = ImageDraw.Draw(img)
    d.line(up, fill=lip, width=int(3.4 * S), joint='curve')
    d.line(lo, fill=lip, width=int(4.4 * S), joint='curve')


def mert_mouth(img, S, st, sp):
    d = ImageDraw.Draw(img)
    cy = sp['mouth']['y']; w = sp['mouth']['w']
    o = float(np.clip(st['mo'], 0, 1)); c = st['mc']
    n = 9
    cols = (90, 215, 255, 255)
    ph = st['talk']
    if o < 0.06:
        pts = []
        for i in range(21):
            u = -1 + i / 10
            pts.append(P(S, u * w / 2, cy + c * 4 - (c * 6) * (u * u)))
        d.line(pts, fill=cols, width=int(3.6 * S), joint='curve')
        for p in (pts[0], pts[-1]):
            r = 1.8 * S; d.ellipse((p[0] - r, p[1] - r, p[0] + r, p[1] + r), fill=cols)
    else:
        for i in range(n):
            u = -1 + 2 * i / (n - 1)
            hgt = 2.5 + o * 17 * (0.45 + 0.55 * abs(math.sin(ph * 5.0 + i * 1.9))) * (1 - 0.45 * abs(u))
            x = u * w / 2
            d.rounded_rectangle([*P(S, x - 2.5, cy - hgt), *P(S, x + 2.5, cy + hgt)], radius=2.4 * S, fill=cols)
    # yumuşak parıltı
    gl = img.crop(BX(S, -w, cy - 24, w, cy + 24)).filter(ImageFilter.GaussianBlur(4 * S))
    img.alpha_composite(gl.point(lambda v: int(v * 0.55)), (int(BX(S, -w, cy - 24, w, cy + 24)[0]), int(BX(S, -w, cy - 24, w, cy + 24)[1])))


def blush(img, S, cx, cy, col, a):
    lay = Image.new('RGBA', img.size, (0, 0, 0, 0))
    c = P(S, cx, cy); rw, rh = 15 * S, 9 * S
    ImageDraw.Draw(lay).ellipse((c[0] - rw, c[1] - rh, c[0] + rw, c[1] + rh), fill=rgb(col) + (int(255 * a),))
    bb = (int(c[0] - rw * 2), int(c[1] - rh * 3), int(c[0] + rw * 2), int(c[1] + rh * 3))
    part = lay.crop(bb).filter(ImageFilter.GaussianBlur(5 * S))
    img.alpha_composite(part, (bb[0], bb[1]))


def arm(img, S, sh, hand, sp, bend, side):
    d = ImageDraw.Draw(img)
    (sx, sy), (hx_, hy_) = sh, hand
    mx, my = (sx + hx_) / 2, (sy + hy_) / 2
    ln = math.hypot(hx_ - sx, hy_ - sy) or 1
    nx, ny = -(hy_ - sy) / ln, (hx_ - sx) / ln
    if nx * side < 0:
        nx, ny = -nx, -ny
    el = (mx + nx * 9 * bend, my + ny * 9 * bend)
    pts = [P(S, sx, sy), P(S, *el), P(S, hx_, hy_)]
    col, dk = rgb(sp['arm'][0]) + (255,), rgb(sp['arm'][1]) + (255,)
    w = sp['arm_w']
    d.line(pts, fill=dk, width=int((w + 3) * S), joint='curve')
    d.line(pts, fill=col, width=int(w * S), joint='curve')
    d.line([(p[0] - 1.6 * S, p[1] - 1.6 * S) for p in pts], fill=tuple(min(255, v + 60) for v in col[:3]) + (130,), width=int(2.4 * S), joint='curve')
    for p, r in ((pts[0], w * .6), (pts[2], w * .95)):
        d.ellipse((p[0] - (r + 1.5) * S, p[1] - (r + 1.5) * S, p[0] + (r + 1.5) * S, p[1] + (r + 1.5) * S), fill=dk)
        d.ellipse((p[0] - r * S, p[1] - r * S, p[0] + r * S, p[1] + r * S), fill=col)


# ------------------------------------------------------------------ TELEFON PROP (Lalin'in telefonu)
def phone_prop(S, mode):
    W_, H_ = 64, 116
    img = Image.new('RGBA', (int(W_ * S), int(H_ * S)), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((0, 0, W_ * S - 1, H_ * S - 1), radius=10 * S, fill=(188, 192, 204, 255))
    d.rounded_rectangle((2 * S, 2 * S, (W_ - 2) * S, (H_ - 2) * S), radius=8.5 * S, fill=(12, 12, 18, 255))
    sc = newmask(img.size); ImageDraw.Draw(sc).rounded_rectangle((5 * S, 5 * S, (W_ - 5) * S, (H_ - 5) * S), radius=6 * S, fill=255)
    scr = Image.new('RGBA', img.size, (0, 0, 0, 255))
    sd = ImageDraw.Draw(scr)
    if mode == 'mert':
        arr = np.zeros((img.size[1], img.size[0], 3), np.float32)
        v = np.linspace(0, 1, img.size[1])[:, None, None]
        arr[:] = mix(hx('14304f'), hx('070d18'), v)
        scr = Image.fromarray(np.dstack([arr.astype(np.uint8), np.full(img.size[::-1], 255, np.uint8)]), 'RGBA')
        sd = ImageDraw.Draw(scr)
        c = (W_ / 2 * S, 34 * S); r = 15 * S
        sd.ellipse((c[0] - r, c[1] - r, c[0] + r, c[1] + r), fill=(25, 60, 92, 255), outline=(110, 220, 255, 255), width=max(1, int(1.6 * S)))
        sd.text(c, 'M', font=font(F_SANS_B, 17 * S), fill=(150, 235, 255, 255), anchor='mm')
        sd.text((W_ / 2 * S, 62 * S), 'Mert', font=font(F_SANS_B, 14 * S), fill=(255, 255, 255, 255), anchor='mm')
        sd.text((W_ / 2 * S, 75 * S), 'aranıyor…', font=font(F_SANS, 7.4 * S), fill=(150, 175, 200, 255), anchor='mm')
        c = (W_ / 2 * S, 96 * S); r = 11 * S
        sd.ellipse((c[0] - r, c[1] - r, c[0] + r, c[1] + r), fill=(52, 199, 89, 255))
        sd.text(c, '✆', font=font('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 13 * S), fill=(255, 255, 255, 255), anchor='mm')
    elif mode == 'sent':
        arr = np.zeros((img.size[1], img.size[0], 3), np.float32)
        v = np.linspace(0, 1, img.size[1])[:, None, None]
        arr[:] = mix(hx('14304f'), hx('070d18'), v)
        scr = Image.fromarray(np.dstack([arr.astype(np.uint8), np.full(img.size[::-1], 255, np.uint8)]), 'RGBA')
        sd = ImageDraw.Draw(scr)
        sd.rounded_rectangle((12 * S, 40 * S, 52 * S, 70 * S), radius=5 * S, fill=(90, 70, 110, 255))
        sd.text((32 * S, 55 * S), '📷', font=font(F_SANS, 1), fill=(0, 0, 0, 0), anchor='mm')
        sd.text((W_ / 2 * S, 86 * S), 'Gönderildi ✓', font=font(F_SANS_B, 7.6 * S), fill=(120, 230, 160, 255), anchor='mm')
    img.paste(scr, (0, 0), sc)
    d.ellipse((W_ / 2 * S - 2 * S, 7 * S, W_ / 2 * S + 2 * S, 11 * S), fill=(0, 0, 0, 255))
    return img


# ------------------------------------------------------------------ MERT EKRAN İÇERİĞİ
_photo = {}


def couple_photo():
    if 'p' in _photo:
        return _photo['p']
    W_, H_ = 480, 400
    yy, xx = np.mgrid[0:H_, 0:W_].astype(np.float32)
    base = np.zeros((H_, W_, 3), np.float32)
    base[:] = mix(hx('f0b068'), hx('2a0f16'), (yy / H_)[..., None] * 0.9)
    base += 40 * np.exp(-(((xx - 360) / 120) ** 2 + ((yy - 90) / 90) ** 2))[..., None]
    img = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8), 'RGB').convert('RGBA')
    rng = np.random.RandomState(5)
    bok = Image.new('RGBA', img.size, (0, 0, 0, 0))
    bd = ImageDraw.Draw(bok)
    for _ in range(22):
        x, y, r = rng.randint(0, W_), rng.randint(0, int(H_ * .55)), rng.randint(10, 30)
        bd.ellipse((x - r, y - r, x + r, y + r), fill=(255, 220, 150, 60))
    img.alpha_composite(bok.filter(ImageFilter.GaussianBlur(4)))
    S = 0.62
    st = dict(DEF); st.update(mc=0.9, blush=0.7, eo=1.0, lx=0.5, ly=0.0, lax=-14, lay=64, rax=-24, ray=34)
    a, _ = render('aras', S, dict(st, lx=-0.6, ly=0.0, mc=0.8, rax=-30, ray=30, lax=-12, lay=60))
    r, _ = render('ruya', S, dict(st, lx=0.6, ly=0.0, lax=24, lay=30, rax=14, ray=60))
    ax_, ay_ = a.size
    ox, oy = int(W_ * 0.5 - CW * S / 2 + 60), int(H_ - (BASE_Y * S) - 6 + 6)
    img.alpha_composite(a, (int(W_ * 0.5 - CW * S / 2 + 58), oy))
    img.alpha_composite(r, (int(W_ * 0.5 - CW * S / 2 - 70), oy))
    # vinyet + dane
    vg = np.clip(1 - 0.55 * (((xx - W_ / 2) / (W_ * .7)) ** 2 + ((yy - H_ / 2) / (H_ * .7)) ** 2), 0.3, 1)[..., None]
    arr = np.array(img.convert('RGB'), np.float32) * vg
    arr += rng.normal(0, 7, arr.shape)
    out = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), 'RGB')
    ImageDraw.Draw(out).text((W_ - 16, H_ - 14), '23:12', font=font(F_SANS_B, 20), fill=(255, 190, 90), anchor='rs')
    _photo['p'] = out
    return out


def mert_screen(img, S, st):
    sc = st['screen']
    if not sc:
        sc = dict(mode='idle')
    d = ImageDraw.Draw(img)
    mode = sc.get('mode', 'idle')
    x0, x1, y0, y1 = -75, 75, -226, -34
    if mode == 'idle':
        d.text(P(S, 0, -170), '23:47', font=font(F_SANS_B, 38 * S), fill=(205, 235, 255, 235), anchor='mm')
        d.text(P(S, 0, -135), 'Çarşamba, 22 Ekim', font=font(F_SANS, 10 * S), fill=(130, 170, 200, 220), anchor='mm')
        for i, (txt, a) in enumerate((('● 2 yeni bildirim', 200), ('● Bilinmeyen numara', 140))):
            d.rounded_rectangle([*P(S, -62, -108 + i * 30), *P(S, 62, -86 + i * 30)], radius=7 * S, fill=(30, 70, 105, int(a)))
            d.text(P(S, -52, -97 + i * 30), txt, font=font(F_SANS, 9.5 * S), fill=(200, 230, 255, 230), anchor='lm')
        return
    k = ease_io(sc.get('k', 1.0))
    if mode in ('photo', 'msg'):
        ph = couple_photo()
        k0 = (-50, -50, -170, -100)
        a = (mix(np.array(k0[0]), np.array(x0), k), mix(np.array(k0[1]), np.array(x1), k))
        xa, xb = float(a[0]), float(a[1])
        ya = float(mix(np.array(-205.0), np.array(-250.0 if sc.get('big') else -226.0), k))
        yb = float(mix(np.array(-130.0), np.array(-40.0 if sc.get('big') else -34.0), k))
        pop = sc.get('pop', 1.0)
        if pop < 1.0:
            cxm, cym = (xa + xb) / 2, (ya + yb) / 2
            sk = 0.35 + 0.65 * ease_out(pop)
            xa, xb = cxm + (xa - cxm) * sk, cxm + (xb - cxm) * sk
            ya, yb = cym + (ya - cym) * sk, cym + (yb - cym) * sk
        wpx, hpx = int((xb - xa) * S), int((yb - ya) * S)
        if wpx > 4 and hpx > 4:
            sw_, sh_ = ph.size
            ta = wpx / hpx
            if ta > sw_ / sh_:
                nh_ = sw_ / ta; bx_ = (0, (sh_ - nh_) / 2, sw_, (sh_ + nh_) / 2)
            else:
                nw_ = sh_ * ta; bx_ = ((sw_ - nw_) / 2, 0, (sw_ + nw_) / 2, sh_)
            p2 = ph.crop(tuple(int(v) for v in bx_)).resize((wpx, hpx), Image.LANCZOS)
            msk = newmask((wpx, hpx)); ImageDraw.Draw(msk).rounded_rectangle((0, 0, wpx - 1, hpx - 1), radius=8 * S, fill=255)
            img.paste(p2, (int(P(S, xa, ya)[0]), int(P(S, xa, ya)[1])), msk)
            d.rounded_rectangle([*P(S, xa, ya), *P(S, xb, yb)], radius=8 * S, outline=(255, 255, 255, 190), width=max(1, int(1.6 * S)))
    if mode == 'msg':
        kk = ease_out(sc.get('k2', 1.0))
        yy0 = -118 + (1 - kk) * 40
        lay = Image.new('RGBA', img.size, (0, 0, 0, 0))
        ld = ImageDraw.Draw(lay)
        ld.rounded_rectangle([*P(S, -72, yy0), *P(S, 72, yy0 + 80)], radius=10 * S, fill=(236, 246, 255, int(245 * kk)))
        ld.text(P(S, -64, yy0 + 12), 'Yeni mesaj', font=font(F_SANS_B, 8.4 * S), fill=(40, 100, 150, int(255 * kk)), anchor='lm')
        ld.text(P(S, 0, yy0 + 42), 'Yarın gece.', font=font(F_SANS_B, 15 * S), fill=(20, 40, 70, int(255 * kk)), anchor='mm')
        ld.text(P(S, 0, yy0 + 62), 'Herkes öğrenecek.', font=font(F_SANS_B, 14 * S), fill=(150, 20, 50, int(255 * kk)), anchor='mm')
        img.alpha_composite(lay)


# ------------------------------------------------------------------ ANA RENDER
_cache = OrderedDict()


def body(name, S):
    key = (name, round(S, 2))
    if key in _cache:
        _cache.move_to_end(key)
        return _cache[key]
    b = SPECS[name]['body'](S)
    _cache[key] = b
    if len(_cache) > 30:
        _cache.popitem(last=False)
    return b


def render(name, S, st):
    sp = SPECS[name]
    s = dict(DEF); s.update(st)
    img = body(name, S).copy()
    # kollar (gövdenin arkasında değil, önünde)
    sh = sp['shoulders']
    arm(img, S, sh[0], (sh[0][0] + s['lax'], sh[0][1] + s['lay']), sp, s['bend'], -1)
    arm(img, S, sh[1], (sh[1][0] + s['rax'], sh[1][1] + s['ray']), sp, s['bend'], 1)
    if s['prop']:
        pm = phone_prop(S * 1.35, s['prop'])
        hand = P(S, sh[1][0] + s['rax'], sh[1][1] + s['ray'])
        ang = s.get('prop_ang', -10)
        pr = pm.rotate(ang, expand=True, resample=Image.BICUBIC)
        img.alpha_composite(pr, (int(hand[0] - pr.size[0] / 2), int(hand[1] - pr.size[1] * 0.62)))
        arm(img, S, sh[1], (sh[1][0] + s['rax'], sh[1][1] + s['ray']), sp, s['bend'], 1)
    e = sp['eye']
    if s.get('sil'):
        a = img.split()[3]
        dk = Image.new('RGBA', img.size, (7, 6, 12, 255)); dk.putalpha(a)
        img = dk
        for side in (-1, 1):
            eye(img, S, side * e['dx'], e['y'], e['w'], e['h'], side, s, sp)
        return img, (CW / 2 * S, BASE_Y * S)
    if sp.get('kind') == 'screen':
        mert_screen(img, S, s)
        for side in (-1, 1):
            eye(img, S, side * e['dx'], e['y'], e['w'], e['h'], side, s, dict(kind='screen', lash='0', lash_th=1, lashes=False, wing=False))
        mert_mouth(img, S, s, sp)
    else:
        if sp.get('blush') and s['blush'] > 0.02:
            for side in (-1, 1):
                blush(img, S, side * (e['dx'] + 8), e['y'] + sp['blush_dy'], sp['blush'], s['blush'] * 0.55)
        for side in (-1, 1):
            eye(img, S, side * e['dx'], e['y'], e['w'], e['h'], side, s, sp)
            brow(img, S, side * e['dx'], e['y'], e['w'], e['h'], side, s, sp)
        mouth(img, S, 0, sp['mouth']['y'], sp['mouth']['w'], s, sp)
        if s['drop'] >= 0:  # gözyaşı damlası
            dr = s['drop']
            d = ImageDraw.Draw(img)
            for side in (1,):
                x = side * (e['dx'] - 4) - 3 * dr
                y = e['y'] + e['h'] / 2 + 6 + dr * 62
                a = 235 * (1 - dr ** 2.5)
                lay = Image.new('RGBA', img.size, (0, 0, 0, 0))
                ld = ImageDraw.Draw(lay)
                ld.polygon([P(S, x, y - 11), P(S, x - 5.2, y + 1), P(S, x + 5.2, y + 1)], fill=(190, 228, 255, int(a)))
                c = P(S, x, y + 1); r = 5.4 * S
                ld.ellipse((c[0] - r, c[1] - r, c[0] + r, c[1] + r), fill=(190, 228, 255, int(a)))
                c2 = P(S, x - 1.8, y - 1.5); r2 = 1.8 * S
                ld.ellipse((c2[0] - r2, c2[1] - r2, c2[0] + r2, c2[1] + r2), fill=(255, 255, 255, int(a)))
                img.alpha_composite(lay)
    return img, (CW / 2 * S, BASE_Y * S)
