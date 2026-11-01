"""İnsanlar Gidince — Katlanmayanların İsyanı: sabit kıyafet karakter tasarımları.

Her karakter tek bir gövde fonksiyonu + yüz spesifikasyonundan çizilir; bütün sahneler
bu kodu kullandığı için şekil, renk ve oran her karede birebir aynıdır.
Birim: 1 birim = 1 dünya pikseli; taban (ayak) y=0, yukarı negatif.
"""
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageChops
import facekit as fk
from facekit import (P, BX, canvas, rrmask, ellmask, polymask, poly_alpha, CW, BASE_Y)
from style import *


def _clip_layer(img, mask, draw_fn):
    """mask içinde kalan bir desen katmanı çizer."""
    lay = Image.new('RGBA', img.size, (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(lay), lay)
    out = Image.new('RGBA', img.size, (0, 0, 0, 0))
    a = ImageChops.multiply(lay.split()[3], mask)
    lay.putalpha(a)
    img.alpha_composite(lay)


def _line(d, S, pts, col, w):
    d.line([P(S, x, y) for x, y in pts], fill=col, width=max(1, int(w * S)), joint='curve')


# ------------------------------------------------------------------ GÖMLEK BEY
def gomlek_body(S):
    img = canvas(S); sz = img.size
    pts = [(-94, -318), (-60, -334), (-22, -336), (22, -336), (60, -334), (94, -318), (90, -120), (86, -24),
           (62, -6), (32, -16), (0, -2), (-32, -16), (-62, -6), (-86, -24), (-90, -120)]
    m = polymask(S, sz, pts, 8)
    shade_cyl(img, m, hx('8d96aa'), hx('e9edf3'), hx('ffffff'), hl=.25, hlpos=.22, hlw=.06, rim=hx('d6e4ff'))
    d = ImageDraw.Draw(img)
    # kırışıklıklar (şikâyetinin sebebi)
    for pts_, a in (([(-74, -112), (-44, -98), (-14, -114)], 150), (([(18, -64), (48, -78), (78, -60)]), 150),
                    ([(-66, -58), (-36, -46), (-12, -54)], 130), ([(-84, -282), (-58, -268), (-40, -276)], 120),
                    ([(52, -290), (72, -272), (86, -278)], 120), ([(-80, -170), (-62, -160)], 110),
                    ([(60, -175), (82, -162)], 110), ([(-30, -26), (-6, -38), (16, -28)], 120)):
        _line(d, S, pts_, (128, 136, 156, a), 3.0)
        _line(d, S, [(x + 1.5, y + 2.5) for x, y in pts_], (255, 255, 255, 140), 1.6)
    # pat ve düğmeler (yüzün altında)
    d.rectangle([*P(S, -9, -146), *P(S, 9, -10)], fill=(222, 228, 238, 255), outline=(176, 184, 202, 255), width=max(1, int(1.2 * S)))
    for yy in (-128, -88, -48):
        c = P(S, 0, yy); r = 5 * S
        d.ellipse((c[0] - r, c[1] - r, c[0] + r, c[1] + r), fill=(240, 242, 248, 255), outline=(150, 158, 178, 255), width=max(1, int(S)))
        for dx in (-1.6, 1.6):
            cc = P(S, dx, yy); rr = 1.1 * S
            d.ellipse((cc[0] - rr, cc[1] - rr, cc[0] + rr, cc[1] + rr), fill=(120, 128, 148, 255))
    # göğüs cebi + kalem
    d.rectangle([*P(S, 52, -150), *P(S, 59, -124)], fill=(40, 70, 170, 255))
    d.rectangle([*P(S, 57, -152), *P(S, 60, -132)], fill=(200, 205, 215, 255))
    d.rounded_rectangle([*P(S, 40, -130), *P(S, 80, -88)], radius=4 * S, fill=(232, 236, 244, 255), outline=(150, 158, 178, 255), width=max(1, int(1.4 * S)))
    # yaka
    d.ellipse([*P(S, -28, -346), *P(S, 28, -326)], fill=(70, 74, 92, 255))
    for side in (-1, 1):
        cp = [(side * 44, -338), (side * 3, -320), (side * 14, -280), (side * 58, -312)]
        d.polygon([P(S, x, y) for x, y in cp], fill=(250, 251, 255, 255), outline=(150, 158, 178, 255))
        _line(d, S, [(side * 40, -332), (side * 12, -290)], (205, 210, 225, 255), 1.4)
    c = P(S, 0, -318); r = 4.2 * S
    d.ellipse((c[0] - r, c[1] - r, c[0] + r, c[1] + r), fill=(240, 242, 248, 255), outline=(150, 158, 178, 255))
    return img


def mustache(img, S, cx, cy, w, col, droop=0.0, thick=9.0, curl=True):
    lay = Image.new('RGBA', img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    for side in (-1, 1):
        up, lo = [], []
        for i in range(13):
            t = i / 12
            th = thick * (1 - t) ** 0.6 + 2.0
            x = cx + side * (3 + t * w)
            yc = cy + droop * t * t * 14 - (0 if droop else 5 * t * t)
            up.append(P(S, x, yc - th * 0.45))
            lo.append(P(S, x, yc + th * 0.65))
        d.polygon(up + lo[::-1], fill=col)
        if curl:
            tip = (cx + side * (w + 4), cy - 9)
            c = P(S, *tip); r = 4.5 * S
            d.ellipse((c[0] - r, c[1] - r, c[0] + r, c[1] + r), outline=col, width=max(1, int(2.6 * S)))
    hl = Image.new('RGBA', img.size, (0, 0, 0, 0))
    img.alpha_composite(lay)


def gomlek_post(img, S, s):
    mustache(img, S, 0, -190, 30, (58, 56, 66, 255), thick=10)


# ------------------------------------------------------------------ TİŞÖRT
def tisort_body(S):
    img = canvas(S); sz = img.size
    for side in (-1, 1):
        sl = [(side * 74, -294), (side * 130, -262), (side * 116, -214), (side * 78, -232)]
        m = polymask(S, sz, sl, 5)
        shade_cyl(img, m, hx('a8730a'), hx('f2b632'), hx('ffe08a'), hl=.15)
        _line(ImageDraw.Draw(img), S, [(side * 130, -262), (side * 116, -214)], (190, 130, 20, 255), 4)
    pts = [(-80, -296), (-30, -302), (30, -302), (80, -296), (86, -12), (-86, -12)]
    m = polymask(S, sz, pts, 10)
    shade_cyl(img, m, hx('a8730a'), hx('f2b632'), hx('ffe08a'), hl=.2, hlpos=.22, rim=hx('ffd27a'))
    d = ImageDraw.Draw(img)
    d.ellipse([*P(S, -32, -308), *P(S, 32, -284)], fill=(196, 132, 18, 255))
    d.ellipse([*P(S, -25, -305), *P(S, 25, -288)], fill=(70, 46, 20, 255))
    _line(d, S, [(-80, -20), (-30, -16), (30, -16), (80, -20)], (190, 130, 20, 255), 3)
    # baskı
    d.text(P(S, 0, -70), 'BOŞVER', font=font(F_SANS_B, 30 * S), fill=(60, 34, 14, 255), anchor='mm')
    bolt = [(-8, -118), (14, -118), (2, -100), (16, -100), (-10, -82), (-2, -98), (-14, -98)]
    d.polygon([P(S, x, y) for x, y in bolt], fill=(220, 50, 50, 255), outline=(255, 245, 230, 255))
    # sağ omuzda unutulmuş gri çorap
    sock = [(40, -306), (78, -300), (96, -276), (92, -238), (84, -212), (104, -196), (100, -180), (74, -186), (68, -230), (56, -276)]
    m = polymask(S, sz, sock, 4)
    shade_cyl(img, m, hx('5e6066'), hx('9da0a8'), hx('d6d8de'), hl=.1)
    _clip_layer(img, m, lambda dd, l: [dd.rectangle([*P(S, 30, y), *P(S, 120, y + 6)], fill=(70, 72, 80, 160)) for y in range(-296, -180, 18)])
    return img


# ------------------------------------------------------------------ ÇORAP KARDEŞLER
def corapA_body(S):
    img = canvas(S); sz = img.size
    pts = [(-44, -332), (44, -332), (44, -78), (98, -66), (114, -36), (104, -6), (40, -2), (-30, -4), (-50, -30), (-46, -66)]
    m = polymask(S, sz, pts, 12)
    shade_cyl(img, m, hx('c9c0c4'), hx('f7f2f2'), hx('ffffff'), hl=.2)

    def stripes(dd, lay):
        for y in range(-292, -60, 46):
            dd.rectangle([*P(S, -60, y), *P(S, 130, y + 20)], fill=(212, 44, 60, 235))
        dd.ellipse([*P(S, -56, -46), *P(S, -6, 8)], fill=(212, 44, 60, 235))
        dd.ellipse([*P(S, 76, -60), *P(S, 124, 4)], fill=(212, 44, 60, 235))
    _clip_layer(img, m, stripes)
    shade_overlay(img, m)
    d = ImageDraw.Draw(img)
    for x in range(-40, 44, 8):
        _line(d, S, [(x, -330), (x, -306)], (200, 190, 196, 220), 2)
    return img


def corapB_body(S):
    img = canvas(S); sz = img.size
    pts = [(-42, -252), (42, -252), (44, -66), (30, -4), (-40, -2), (-100, -6), (-112, -32), (-98, -62), (-44, -72)]
    m = polymask(S, sz, pts, 12)
    shade_cyl(img, m, hx('133a72'), hx('2f6fc4'), hx('93bdf2'), hl=.22)

    def dots(dd, lay):
        for j, y in enumerate(range(-236, 0, 34)):
            for x in range(-120, 60, 36):
                xx = x + (18 if j % 2 else 0)
                if -46 < xx < 46 and -224 < y < -100:
                    continue
                dd.ellipse([*P(S, xx - 8, y - 8), *P(S, xx + 8, y + 8)], fill=(255, 210, 60, 240))
    _clip_layer(img, m, dots)
    shade_overlay(img, m)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([*P(S, -44, -254), *P(S, 44, -228)], radius=5 * S, fill=(80, 140, 220, 255))
    for x in range(-38, 42, 8):
        _line(d, S, [(x, -252), (x, -230)], (50, 100, 180, 220), 2)
    return img


def shade_overlay(img, mask, strength=0.55):
    """Desenin üstüne silindirik gölge katmanı (renkli desenler düz durmasın)."""
    bb = mask.getbbox()
    x0, y0, x1, y1 = bb
    w = x1 - x0
    t = (np.arange(w, dtype=np.float32) + 0.5) / w
    th = (t - 0.5) * np.pi * 0.92
    dd = np.clip(np.cos(th + 0.55), 0, 1)
    a = (1 - dd) * 150 * strength
    lay = np.zeros((y1 - y0, w, 4), np.uint8)
    lay[..., 3] = np.clip(a, 0, 255)[None, :]
    L = Image.fromarray(lay, 'RGBA')
    L.putalpha(ImageChops.multiply(L.split()[3], mask.crop(bb)))
    img.alpha_composite(L, (x0, y0))
    hl = np.exp(-(((t - 0.22) / 0.05) ** 2)) * 90
    lay2 = np.zeros((y1 - y0, w, 4), np.uint8)
    lay2[..., :3] = 255
    lay2[..., 3] = hl[None, :].astype(np.uint8)
    L2 = Image.fromarray(lay2, 'RGBA')
    L2.putalpha(ImageChops.multiply(L2.split()[3], mask.crop(bb)))
    img.alpha_composite(L2, (x0, y0))


# ------------------------------------------------------------------ HAVLU ABİ
def havlu_body(S):
    img = canvas(S); sz = img.size
    pts = [(-102, -362), (102, -362), (104, -40)]
    for i in range(13):
        x = 104 - i * 208 / 12
        pts.append((x, -16 + 8 * math.sin(i * 1.3)))
    pts.append((-104, -40))
    m = polymask(S, sz, pts, 10)
    shade_cyl(img, m, hx('235357'), hx('4a9aa0'), hx('a6dde0'), hl=.12, vgrad=.15)
    rng = np.random.RandomState(3)
    d = ImageDraw.Draw(img)

    def terry(dd, lay):
        for _ in range(900):
            x, y = rng.uniform(-104, 104), rng.uniform(-360, -10)
            c = P(S, x, y); r = 1.3 * S
            dd.ellipse((c[0] - r, c[1] - r, c[0] + r, c[1] + r), fill=(200, 240, 240, 45) if rng.rand() > .5 else (10, 40, 44, 45))
        for y0, h in ((-92, 14), (-70, 6)):
            dd.rectangle([*P(S, -120, y0), *P(S, 120, y0 + h)], fill=(240, 244, 240, 230))
        dd.rectangle([*P(S, -120, -362), *P(S, 120, -322)], fill=(20, 60, 64, 120))
        dd.rectangle([*P(S, -120, -324), *P(S, 120, -320)], fill=(170, 225, 228, 160))
    _clip_layer(img, m, terry)
    for i in range(26):
        x = -100 + i * 8
        y0 = -18 + 8 * math.sin((104 - x) / (208 / 12) * 1.3)
        _line(d, S, [(x, y0), (x + 1, y0 + 14)], (200, 236, 236, 255), 2.2)
    return img


def havlu_post(img, S, s):
    d = ImageDraw.Draw(img)
    for side in (-1, 1):
        ex = side * 34
        pts = [P(S, ex - 14 + i * 3.5, -232 + 3 * math.sin(math.pi * i / 8)) for i in range(9)]
        d.line(pts, fill=(30, 70, 74, 200), width=max(1, int(2.2 * S)), joint='curve')
    mustache(img, S, 0, -200, 42, (246, 246, 244, 255), droop=1.0, thick=13, curl=False)


# ------------------------------------------------------------------ PANTOLON
def pantolon_body(S):
    img = canvas(S); sz = img.size
    for side in (-1, 1):
        leg = [(side * 4, -214), (side * 90, -214), (side * 86, -4), (side * 12, -4)]
        m = polymask(S, sz, leg, 4)
        shade_cyl(img, m, hx('0c142a'), hx('24345e'), hx('6a82c2'), hl=.15, lightx=-0.55 if side < 0 else -0.2)
        _line(ImageDraw.Draw(img), S, [(side * 47, -210), (side * 49, -6)], (110, 132, 190, 200), 1.8)
        poly_alpha(S, img, [(side * 12, -20), (side * 86, -20), (side * 86, -4), (side * 12, -4)], (0, 0, 0), 70)
    m = polymask(S, sz, [(-86, -376), (86, -376), (92, -206), (-92, -206)], 6)
    shade_cyl(img, m, hx('0c142a'), hx('24345e'), hx('6a82c2'), hl=.18)
    d = ImageDraw.Draw(img)
    for side in (-1, 1):
        _line(d, S, [(side * 84, -366), (side * 62, -304)], (12, 20, 40, 220), 2.2)
    _line(d, S, [(0, -236), (0, -208)], (12, 20, 40, 230), 2.2)
    _line(d, S, [(0, -236), (12, -214)], (12, 20, 40, 200), 1.8)
    m = rrmask(S, sz, -88, -404, 88, -374, 5)
    shade_cyl(img, m, hx('2a170a'), hx('6b4226'), hx('b0804e'), hl=.2)
    for x in (-64, -30, 30, 64):
        d.rectangle([*P(S, x - 4, -408), *P(S, x + 4, -370)], fill=(20, 32, 64, 255))
    d.rounded_rectangle([*P(S, -18, -402), *P(S, 18, -376)], radius=3 * S, outline=(236, 196, 90, 255), width=max(1, int(4 * S)))
    _line(d, S, [(-2, -389), (14, -389)], (236, 196, 90, 255), 3)
    return img


def pantolon_post(img, S, s):
    d = ImageDraw.Draw(img)
    e = fk.SPECS['pantolon']['eye']
    cx, cy = e['dx'], e['y']
    r = e['w'] * 0.66
    lay = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ImageDraw.Draw(lay).ellipse([*P(S, cx - r, cy - r), *P(S, cx + r, cy + r)], fill=(220, 235, 255, 40))
    img.alpha_composite(lay)
    d.ellipse([*P(S, cx - r, cy - r), *P(S, cx + r, cy + r)], outline=(232, 192, 86, 255), width=max(1, int(3.6 * S)))
    pts = [P(S, cx + r * 0.7, cy + r * 0.7)]
    for i in range(1, 9):
        t = i / 8
        pts.append(P(S, cx + r * 0.7 + 30 * t, cy + r * 0.7 + 70 * t + 18 * math.sin(math.pi * t)))
    d.line(pts, fill=(232, 192, 86, 255), width=max(1, int(1.6 * S)), joint='curve')


# ------------------------------------------------------------------ ÇAMAŞIR SEPETİ
def sepet_body(S):
    img = canvas(S); sz = img.size
    # içinden sarkan kırmızı kol
    m = polymask(S, sz, [(-130, -316), (-84, -330), (-56, -304), (-82, -232), (-104, -240), (-102, -290)], 6)
    shade_cyl(img, m, hx('7a1020'), hx('c8283c'), hx('ff7a8a'), hl=.15)
    pts = [(-176, -300), (176, -300), (146, -6), (-146, -6)]
    m = polymask(S, sz, pts, 12)
    shade_cyl(img, m, hx('5a3816'), hx('b07a3c'), hx('ecc184'), hl=.12, vgrad=.2)

    def weave(dd, lay):
        for k, y in enumerate(range(-298, 0, 22)):
            dd.rectangle([*P(S, -200, y), *P(S, 200, y + 11)], fill=(70, 40, 12, 70))
            for x in range(-200, 200, 30):
                xx = x + (15 if k % 2 else 0)
                dd.line([P(S, xx, y), P(S, xx + 8, y + 11)], fill=(255, 230, 180, 70), width=max(1, int(2 * S)))
        for x in range(-180, 190, 30):
            dd.line([P(S, x, -300), P(S, x * 0.83, -6)], fill=(60, 34, 10, 90), width=max(1, int(2.2 * S)))
    _clip_layer(img, m, weave)
    d = ImageDraw.Draw(img)
    for side in (-1, 1):
        d.rounded_rectangle([*P(S, side * 150 - 22, -272), *P(S, side * 150 + 22, -252)], radius=9 * S, fill=(52, 30, 10, 255))
    m = rrmask(S, sz, -186, -316, 186, -284, 15)
    shade_cyl(img, m, hx('5a3816'), hx('c48c4c'), hx('f6d29a'), hl=.25)
    for x in range(-180, 186, 12):
        _line(d, S, [(x, -314), (x + 9, -286)], (110, 70, 30, 150), 2)
    # yeşil çorap ucu
    m = polymask(S, sz, [(110, -312), (150, -328), (170, -318), (158, -300)], 4)
    shade_cyl(img, m, hx('1d6a30'), hx('3cae5a'), hx('9ae4a8'), hl=.1)
    return img


def sepet_post(img, S, s):
    d = ImageDraw.Draw(img)
    e = fk.SPECS['sepet']['eye']
    col = (140, 18, 40, 255)
    for side in (-1, 1):
        cx, cy = side * e['dx'], e['y']
        w, h = e['w'] * 0.72, e['h'] * 0.62
        pts = [(cx - w, cy - h * 0.75), (cx + w, cy - h * 0.75), (cx + w * 0.95, cy + h * 0.6), (cx, cy + h * 0.85),
               (cx - w * 0.95, cy + h * 0.6)]
        wing = (cx + side * (w + 14), cy - h * 1.15)
        pts2 = []
        for p in pts:
            pts2.append(p)
        d.line([P(S, *p) for p in pts2 + [pts2[0]]], fill=col, width=max(1, int(4.4 * S)), joint='curve')
        o = (cx + side * w, cy - h * 0.75)
        d.polygon([P(S, *o), P(S, *wing), P(S, o[0] - side * 12, o[1])], fill=col)
    _line(d, S, [(-e['dx'] + e['w'] * 0.72, e['y'] - 6), (0, e['y'] - 12), (e['dx'] - e['w'] * 0.72, e['y'] - 6)], col, 4)


# ------------------------------------------------------------------ SPESİFİKASYONLAR
def _sp(body, eye, iris, brow, mouth, shoulders, arm, arm_w, **kw):
    d = dict(body=body, eye=eye, iris=iris, pupil=kw.pop('pupil', '0b0b10'), white=kw.pop('white', 'ffffff'),
             lash=kw.pop('lash', '15151c'), lash_th=kw.pop('lash_th', 3.4), lashes=kw.pop('lashes', False),
             wing=kw.pop('wing', False), brow=brow, mouth=mouth, shoulders=shoulders, arm=arm, arm_w=arm_w,
             blush=kw.pop('blush', None), blush_dy=kw.pop('blush_dy', 0))
    d.update(kw)
    return d


SPECS = {
    'gomlek': _sp(gomlek_body, dict(dx=31, y=-238, w=42, h=48), ('2c3e5c', '5f7fae', 'b8cff0'),
                  dict(col='3a3a44', w=7.5, gap=9, arch=3, out=0.72), dict(y=-170, w=38, lip='8a4a4a', inner='3a1212', h=20),
                  ((-90, -296), (90, -296)), ('f0f2f7', '8d96aa'), 16, post=gomlek_post),
    'tisort': _sp(tisort_body, dict(dx=30, y=-214, w=40, h=44), ('3a2410', '7a5228', 'c99a5a'),
                  dict(col='5a3a10', w=5.0, gap=8, arch=2, out=0.7), dict(y=-152, w=36, lip='a0502a', inner='3a1406', h=20),
                  ((-122, -238), (122, -238)), ('f2b632', 'a8730a'), 15, lid=0.36),
    'corapA': _sp(corapA_body, dict(dx=23, y=-244, w=36, h=42), ('1d5c2e', '3f9a52', 'a6e0a8'),
                  dict(col='a0262f', w=4.0, gap=8, arch=5, out=0.68), dict(y=-188, w=28, lip='d43a4a', inner='3a0612', h=16),
                  ((-44, -200), (44, -200)), ('f4ecec', 'a0262f'), 9, lashes=True, blush='ff8fa0', blush_dy=28),
    'corapB': _sp(corapB_body, dict(dx=22, y=-176, w=34, h=40), ('3a2410', '6b4a2a', 'c9955a'),
                  dict(col='0c234a', w=4.5, gap=7, arch=2, out=0.68), dict(y=-124, w=28, lip='0f2f63', inner='2a0a10', h=16),
                  ((-42, -140), (42, -140)), ('2f6fc4', '133a72'), 9),
    'havlu': _sp(havlu_body, dict(dx=34, y=-258, w=40, h=36), ('2a3a3a', '5a7a7a', 'a8c8c8'),
                 dict(col='f4f4f2', w=12, gap=3, arch=4, out=0.8), dict(y=-178, w=34, lip='4a2a2a', inner='2a0a0a', h=14),
                 ((-102, -280), (102, -280)), ('4a9aa0', '235357'), 18, lid=0.42, post=havlu_post),
    'pantolon': _sp(pantolon_body, dict(dx=34, y=-322, w=40, h=42), ('3a2a14', '6b5230', 'b8975a'),
                    dict(col='0a0f1e', w=5.0, gap=10, arch=8, out=0.72), dict(y=-262, w=32, lip='7a5560', inner='2a0a14', h=16),
                    ((-88, -360), (88, -360)), ('24345e', '0c142a'), 11, lid=0.22, post=pantolon_post),
    'sepet': _sp(sepet_body, dict(dx=58, y=-206, w=52, h=50), ('3a1a0a', '8a4a1c', 'e0a060'),
                 dict(col='3a1e0a', w=8.5, gap=13, arch=4, out=0.75), dict(y=-104, w=56, lip='c0283c', inner='3a0610', h=24),
                 ((-164, -190), (164, -190)), ('c48c4c', '5a3816'), 15, lashes=True, post=sepet_post),
}
fk.SPECS = SPECS
render = fk.render
NAMES = {'gomlek': 'GÖMLEK BEY', 'tisort': 'TİŞÖRT', 'corapA': 'ÇORAP (KIRMIZI)', 'corapB': 'ÇORAP (MAVİ)',
         'havlu': 'HAVLU ABİ', 'pantolon': 'PANTOLON', 'sepet': 'ÇAMAŞIR SEPETİ'}
WIDTH = dict(gomlek=190, tisort=200, corapA=150, corapB=150, havlu=210, pantolon=190, sepet=350)
