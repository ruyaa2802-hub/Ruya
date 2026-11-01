"""Oturma odası ortamı: duvar, pencere, koltuk, zemin (sabit, 2x) + hareketli kıyafet yığını."""
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageChops
from style import *

WW, WH = 1080, 1920
BGS = 2
FLOOR_Y = 1420
SEAT_Y = 1250
PILE_BOX = (-60, 700, 840, 1340)   # yığın sprite'ının dünya kutusu


def _grad(size, c0, c1):
    w, h = size
    t = np.linspace(0, 1, h, dtype=np.float32)[:, None, None]
    return np.broadcast_to(mix(hx(c0), hx(c1), t), (h, w, 3)).copy()


def _mask(size):
    return Image.new('L', size, 0)


def shaded(img, S, poly=None, rect=None, ell=None, r=0, cols=('000000', '777777', 'ffffff'), kind='cyl', **kw):
    m = _mask(img.size)
    d = ImageDraw.Draw(m)
    if poly:
        d.polygon([(x * S, y * S) for x, y in poly], fill=255)
        if r:
            m = smooth_mask(m, r * S)
    elif rect:
        d.rounded_rectangle([v * S for v in rect], radius=r * S, fill=255)
    elif ell:
        d.ellipse([v * S for v in ell], fill=255)
    c = [hx(x) for x in cols]
    if kind == 'cyl':
        shade_cyl(img, m, *c, **kw)
    elif kind == 'rad':
        shade_radial(img, m, *c, **kw)
    else:
        shade_vert(img, m, c[0], c[1])
    return m


def build_bg():
    S = BGS
    size = (WW * S, WH * S)
    rng = np.random.RandomState(2)
    wall = _grad(size, '33585c', '1d3638')
    yy, xx = np.mgrid[0:size[1], 0:size[0]].astype(np.float32)
    wall += 30 * np.exp(-(((xx - size[0] * 0.92) / (size[0] * 0.35)) ** 2 + ((yy - size[1] * 0.3) / (size[1] * 0.25)) ** 2))[..., None] * np.array([1.0, 0.75, 0.45], np.float32)
    img = Image.fromarray(np.clip(wall, 0, 255).astype(np.uint8), 'RGB').convert('RGBA')
    d = ImageDraw.Draw(img)
    # duvar kağıdı çizgileri
    for x in range(0, WW, 54):
        d.rectangle((x * S, 0, (x + 2) * S, FLOOR_Y * S), fill=(255, 255, 255, 10))
    for gy in range(40, FLOOR_Y, 110):
        for gx in range(27, WW, 108):
            ox = 54 if (gy // 110) % 2 else 0
            c = ((gx + ox) * S, gy * S)
            d.ellipse((c[0] - 9 * S, c[1] - 9 * S, c[0] + 9 * S, c[1] + 9 * S), outline=(200, 230, 225, 22), width=int(2 * S))
    # süpürgelik
    d.rectangle((0, (FLOOR_Y - 36) * S, size[0], FLOOR_Y * S), fill=(232, 222, 205, 255))
    d.rectangle((0, (FLOOR_Y - 36) * S, size[0], (FLOOR_Y - 32) * S), fill=(255, 250, 240, 255))
    # pencere (gece)
    wx0, wy0, wx1, wy1 = 70, 170, 400, 760
    sky = _grad(((wx1 - wx0) * S, (wy1 - wy0) * S), '0c1630', '2a3f6a')
    sk = Image.fromarray(sky.astype(np.uint8), 'RGB').convert('RGBA')
    sd = ImageDraw.Draw(sk)
    for _ in range(40):
        x, y = rng.randint(0, (wx1 - wx0) * S), rng.randint((wy1 - wy0) * S // 2, (wy1 - wy0) * S)
        r = rng.randint(2, 6) * S
        sd.ellipse((x - r, y - r, x + r, y + r), fill=(255, 210, 120, rng.randint(80, 200)))
    sd.ellipse((60 * S, 60 * S, 130 * S, 130 * S), fill=(250, 245, 220, 255))
    for i in range(6):
        bx = rng.randint(0, wx1 - wx0 - 60); bh = rng.randint(140, 300)
        sd.rectangle((bx * S, ((wy1 - wy0) - bh) * S, (bx + 60) * S, (wy1 - wy0) * S), fill=(14, 22, 40, 255))
    img.alpha_composite(sk, (wx0 * S, wy0 * S))
    d = ImageDraw.Draw(img)
    for x in (wx0, (wx0 + wx1) // 2, wx1):
        d.rectangle(((x - 7) * S, wy0 * S, (x + 7) * S, wy1 * S), fill=(236, 230, 215, 255))
    for y in (wy0, (wy0 + wy1) // 2, wy1):
        d.rectangle(((wx0 - 7) * S, (y - 7) * S, (wx1 + 7) * S, (y + 7) * S), fill=(236, 230, 215, 255))
    # perdeler
    for side, (x0, x1) in ((0, (20, 130)), (1, (340, 450))):
        shaded(img, S, poly=[(x0, 130), (x1, 130), (x1 + (10 if side else -10), 900), (x0 + (-6 if side == 0 else 6), 900)], r=6,
               cols=('4a1220', '8e2a3e', 'd46a7e'), hl=.1)
        for k in range(4):
            x = x0 + 15 + k * (x1 - x0 - 30) / 3
            d.line(((x) * S, 140 * S, (x + (6 if side else -6)) * S, 890 * S), fill=(60, 10, 22, 120), width=int(5 * S))
    d.rectangle((0, 118 * S, 480 * S, 132 * S), fill=(200, 170, 100, 255))
    # tablo: kusursuz katlanmış kıyafetler (ironi)
    fx0, fy0, fx1, fy1 = 640, 240, 930, 560
    d.rectangle((fx0 * S, fy0 * S, fx1 * S, fy1 * S), fill=(196, 160, 90, 255))
    d.rectangle(((fx0 + 18) * S, (fy0 + 18) * S, (fx1 - 18) * S, (fy1 - 18) * S), fill=(244, 236, 220, 255))
    cols = [(90, 140, 200), (230, 90, 90), (240, 200, 80), (120, 180, 140), (250, 250, 250)]
    for i, c in enumerate(cols):
        y = fy1 - 60 - i * 38
        d.rounded_rectangle(((fx0 + 70) * S, y * S, (fx1 - 70) * S, (y + 34) * S), radius=8 * S, fill=c + (255,), outline=(90, 80, 70, 255), width=int(2 * S))
    d.text(((fx0 + fx1) / 2 * S, (fy0 + 52) * S), '"Düzen"', font=font(F_SERIF_BI, 30 * S), fill=(90, 70, 50, 255), anchor='mm')
    # lambader
    d.rectangle((1006 * S, 640 * S, 1014 * S, (FLOOR_Y - 10) * S), fill=(60, 50, 40, 255))
    d.polygon([(960 * S, 640 * S), (1060 * S, 640 * S), (1040 * S, 520 * S), (980 * S, 520 * S)], fill=(250, 220, 160, 255))
    glow = Image.new('RGBA', size, (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse((760 * S, 380 * S, 1260 * S, 900 * S), fill=(255, 200, 120, 70))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(70 * S)))
    # zemin: parke
    fl = _grad((size[0], (WH - FLOOR_Y) * S), '6b4224', '3a2212')
    fli = Image.fromarray(fl.astype(np.uint8), 'RGB').convert('RGBA')
    fd = ImageDraw.Draw(fli)
    for k in range(-20, 30):
        x0 = k * 90
        fd.line((x0 * S, 0, (540 + (x0 - 540) * 2.2) * S, (WH - FLOOR_Y) * S), fill=(40, 22, 10, 140), width=int(3 * S))
    for k, y in enumerate((30, 80, 150, 250, 380)):
        fd.line((0, y * S, size[0], y * S), fill=(40, 22, 10, 90), width=int(2 * S))
    img.alpha_composite(fli, (0, FLOOR_Y * S))
    # halı
    d = ImageDraw.Draw(img)
    d.ellipse((40 * S, 1500 * S, 1040 * S, 1880 * S), fill=(150, 60, 50, 255))
    d.ellipse((80 * S, 1530 * S, 1000 * S, 1850 * S), outline=(230, 190, 120, 255), width=int(6 * S))
    d.ellipse((150 * S, 1580 * S, 930 * S, 1800 * S), outline=(230, 190, 120, 160), width=int(3 * S))
    # koltuk
    build_sofa(img, S)
    return img.convert('RGB')


SOFA = ('8a5a0e', 'd99a2b', 'ffd479')


def build_sofa(img, S):
    d = ImageDraw.Draw(img)
    # gölge
    sh = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse((0, 1370 * S, WW * S, 1470 * S), fill=(0, 0, 0, 130))
    img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(18 * S)))
    for x in (60, 1010):
        d.rectangle(((x - 10) * S, 1395 * S, (x + 10) * S, 1440 * S), fill=(50, 30, 15, 255))
    # sırt
    shaded(img, S, rect=(30, 760, 1050, 1200), r=60, cols=SOFA, hl=.12, vgrad=.25)
    for i in range(3):
        x0 = 150 + i * 260
        shaded(img, S, rect=(x0, 820, x0 + 255, 1190), r=50, cols=SOFA, hl=.18, vgrad=.2)
    # oturak + ön yüz
    shaded(img, S, rect=(120, 1150, 960, 1300), r=30, cols=('9a6610', 'e6a83a', 'ffe08f'), hl=.15, vgrad=-.2)
    shaded(img, S, rect=(40, 1270, 1040, 1400), r=24, cols=('6e460a', 'c4861f', 'f2c066'), hl=.1, vgrad=.3)
    for x in (400, 680):
        d.line((x * S, 1160 * S, x * S, 1290 * S), fill=(130, 84, 14, 200), width=int(4 * S))
    # kolçaklar
    for x0, x1 in ((10, 160), (920, 1070)):
        shaded(img, S, rect=(x0, 920, x1, 1400), r=60, cols=SOFA, hl=.2, vgrad=.2)
        d.ellipse(((x0 + 8) * S, 910 * S, (x1 - 8) * S, 990 * S), fill=(240, 186, 90, 255))
    # kadife doku
    tex = Image.new('RGBA', img.size, (0, 0, 0, 0))
    rng = np.random.RandomState(9)
    td = ImageDraw.Draw(tex)
    for _ in range(4000):
        x, y = rng.uniform(15, 1065), rng.uniform(770, 1395)
        td.point((x * S, y * S), fill=(255, 240, 200, 50) if rng.rand() > .5 else (90, 50, 0, 50))
    img.alpha_composite(tex)


CLOTH = [('1d3d6b', '3a6eb4', '9cc0f0'), ('8a8f99', 'd7dbe2', 'ffffff'), ('6e1a22', 'c23a44', 'ff8a90'),
         ('1f5a32', '3f9a5c', 'a2e0b0'), ('2a2a30', '4c4c56', 'a0a0b0'), ('8a4a6a', 'd47aa4', 'ffc4dc'),
         ('6a5a20', 'b8a040', 'f0dc90'), ('3a2a5a', '6a52a0', 'b8a4e8'), ('5a3a24', '9a6a44', 'dcb08a')]


def build_pile():
    """Dev kıyafet yığını (2x, RGBA, PILE_BOX içinde)."""
    S = BGS
    x0, y0, x1, y1 = PILE_BOX
    W, H = (x1 - x0) * S, (y1 - y0) * S
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    rng = np.random.RandomState(21)
    blobs = []
    for _ in range(115):
        x = rng.uniform(90, 710)
        top = 1265 - 400 * math.exp(-((x - 400) / 215) ** 2) - 30 * math.exp(-((x - 640) / 60) ** 2)
        y = rng.uniform(top + 20, 1270)
        blobs.append((y, x))
    blobs.sort()
    for y, x in blobs:
        rx, ry = rng.uniform(55, 115), rng.uniform(26, 52)
        ang = rng.uniform(-0.6, 0.6)
        col = CLOTH[rng.randint(len(CLOTH))]
        pts = []
        for k in range(28):
            a = 2 * math.pi * k / 28
            rr = 1 + 0.12 * math.sin(3 * a + x) + 0.08 * math.sin(5 * a + y)
            px = rx * rr * math.cos(a); py = ry * rr * math.sin(a)
            pts.append(((x + px * math.cos(ang) - py * math.sin(ang) - x0) * S, (y + px * math.sin(ang) + py * math.cos(ang) - y0) * S))
        m = _mask(img.size)
        ImageDraw.Draw(m).polygon(pts, fill=255)
        m = smooth_mask(m, 3 * S)
        shade_radial(img, m, hx(col[0]), hx(col[1]), hx(col[2]), spec=.12, dome=.8)
        er = m.filter(ImageFilter.GaussianBlur(2.2 * S)).point(lambda v: 255 if v > 230 else 0)
        edge = ImageChops.subtract(m, er)
        ol = Image.new('RGBA', img.size, tuple(int(v * 0.4) for v in hx(col[0])) + (0,))
        ol.putalpha(edge.point(lambda v: int(v * 0.8)))
        img.alpha_composite(ol)
        d = ImageDraw.Draw(img)
        for _ in range(2):
            cx = x + rng.uniform(-rx * .5, rx * .5); cy = y + rng.uniform(-ry * .3, ry * .3)
            w_ = rng.uniform(20, 50)
            d.arc(((cx - w_ - x0) * S, (cy - 10 - y0) * S, (cx + w_ - x0) * S, (cy + 10 - y0) * S), 200, 340,
                  fill=tuple(int(v * 0.55) for v in hx(col[0])) + (170,), width=int(3 * S))
        if rng.rand() < 0.25:   # çizgili desen
            lay = Image.new('RGBA', img.size, (0, 0, 0, 0))
            ld = ImageDraw.Draw(lay)
            for k in range(-6, 7):
                ld.line(((x - rx - x0) * S, (y + k * 12 - y0) * S, (x + rx - x0) * S, (y + k * 12 + 10 - y0) * S), fill=(255, 255, 255, 110), width=int(4 * S))
            lay.putalpha(ImageChops.multiply(lay.split()[3], m))
            img.alpha_composite(lay)
    # koltuktan sarkan kollar/paçalar
    d = ImageDraw.Draw(img)
    for (sx, sy, ex, ey, col, w) in ((150, 1240, 120, 1320, CLOTH[0], 34), (560, 1250, 600, 1325, CLOTH[2], 30), (680, 1235, 720, 1300, CLOTH[3], 26)):
        m = _mask(img.size)
        ImageDraw.Draw(m).line(((sx - x0) * S, (sy - y0) * S, (ex - x0) * S, (ey - y0) * S), fill=255, width=int(w * S))
        shade_cyl(img, m, hx(col[0]), hx(col[1]), hx(col[2]), hl=.1)
    # zemin gölgesi (yığının altı)
    return img
