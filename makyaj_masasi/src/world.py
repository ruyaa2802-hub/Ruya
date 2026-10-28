"""Makyaj masası ortamı: sabit arka plan (2x çözünürlük), organizerler, ışık haritası."""
import math, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageChops
from style import *


def odd(v):
    v = max(3, int(v))
    return v if v % 2 else v + 1


WW, WH = 1080, 1920
BGS = 2                      # arka plan çözünürlük katsayısı
TABLE_Y = 1190               # masa üstü arka kenarı
MIRROR = (140, 150, 940, 1150)   # x0,y0,x1,y1 (ayna camı)
FRAME_W = 30

# Organizerler (dünya koordinatı)
ORG_A = (50, 1070, 330, 1460)    # çekmeceli (Rüya burada)
ORG_B = (770, 1050, 1040, 1460)  # sağ kule (Lalin arkasında saklanır)
DRAWER = (62, 1086, 318, 1232)   # üst çekmece ön yüzü (kapalıyken)
SLOT = (62, 1086, 318, 1128)


def _grad(size, c0, c1, vertical=True):
    w, h = size
    t = np.linspace(0, 1, h if vertical else w, dtype=np.float32)
    t = t[:, None, None] if vertical else t[None, :, None]
    arr = mix(hx(c0), hx(c1), t)
    arr = np.broadcast_to(arr, (h, w, 3)).copy()
    return arr


def bulb_positions():
    x0, y0, x1, y1 = MIRROR
    pts = []
    fx0, fy0, fx1, fy1 = x0 - 6, y0 - 6, x1 + 6, y1 + 6
    # üst köşeleri yuvarlak kemer (üstte 7, yanlarda 7 ampul)
    n_side = 8
    for i in range(n_side):
        y = fy0 + 190 + i * ((fy1 - fy0 - 215) / (n_side - 1))
        pts.append((fx0 - 8, y))
    for i in range(9):
        a = math.pi + (math.pi * (i + 0.5) / 9)
        cx, cy, rx, ry = (fx0 + fx1) / 2, fy0 + 156, (fx1 - fx0) / 2 + 8, 156 + 8
        pts.append((cx + rx * math.cos(a), cy + ry * math.sin(a)))
    for i in range(n_side):
        y = fy0 + 190 + i * ((fy1 - fy0 - 215) / (n_side - 1))
        pts.append((fx1 + 8, y))
    return pts


def mirror_shape(size, scale, inset=0):
    x0, y0, x1, y1 = MIRROR
    m = Image.new('L', size, 0)
    d = ImageDraw.Draw(m)
    x0 += inset; y0 += inset; x1 -= inset; y1 -= inset
    r = (x1 - x0) / 2
    d.rounded_rectangle((x0 * scale, (y0 + 150) * scale, x1 * scale, y1 * scale), radius=26 * scale, fill=255)
    d.ellipse((x0 * scale, y0 * scale, x1 * scale, (y0 + 2 * 150) * scale), fill=255)
    return m


def build_bg():
    S = BGS
    size = (WW * S, WH * S)
    rng = np.random.RandomState(11)
    # --- duvar: koyu mürdüm degrade + hafif damask
    wall = _grad(size, '2a0c18', '12060c')
    yy, xx = np.mgrid[0:size[1], 0:size[0]].astype(np.float32)
    wall += 22 * np.exp(-(((xx - size[0] * .5) / (size[0] * .5)) ** 2 + ((yy - size[1] * .22) / (size[1] * .3)) ** 2))[..., None] * np.array([1.0, .45, .4], np.float32)
    img = Image.fromarray(np.clip(wall, 0, 255).astype(np.uint8), 'RGB').convert('RGBA')
    d = ImageDraw.Draw(img)
    # duvar süsü: ince altın çizgi desen (damask ima)
    for gx in range(-1, 14):
        for gy in range(0, 12):
            cx = gx * 120 * S + (60 * S if gy % 2 else 0); cy = gy * 150 * S
            r = 26 * S
            d.ellipse((cx - r, cy - r * 1.4, cx + r, cy + r * 1.4), outline=(110, 60, 60, 26), width=int(2 * S))
            d.ellipse((cx - r * .45, cy - r * .7, cx + r * .45, cy + r * .7), outline=(110, 60, 60, 20), width=int(2 * S))
    # --- bokeh (duvar arkası ışıkları)
    bok = Image.new('RGBA', size, (0, 0, 0, 0)); bd = ImageDraw.Draw(bok)
    for _ in range(26):
        x = rng.randint(0, WW); y = rng.randint(40, 900); r = rng.randint(22, 60)
        bd.ellipse(((x - r) * S, (y - r) * S, (x + r) * S, (y + r) * S), fill=(255, 190, 110, rng.randint(14, 34)))
    img.alpha_composite(bok.filter(ImageFilter.GaussianBlur(10 * S)))

    # --- masa üstü (cilalı ceviz/mermer)
    ty = TABLE_Y
    top = _grad((size[0], (WH - ty) * S), '2c1519', '170a0d')
    xx2 = np.arange(size[0], dtype=np.float32)[None, :]
    yy2 = np.arange(top.shape[0], dtype=np.float32)[:, None]
    veins = np.sin(xx2 * 0.006 + np.sin(yy2 * 0.01) * 2.0) * np.sin(yy2 * 0.02 + xx2 * 0.002)
    top += (veins * 5)[..., None]
    tab = Image.fromarray(np.clip(top, 0, 255).astype(np.uint8), 'RGB').convert('RGBA')
    img.alpha_composite(tab, (0, ty * S))
    # arka kenar altın şerit + yansıma
    d = ImageDraw.Draw(img)
    d.rectangle((0, ty * S - 6 * S, size[0], ty * S + 4 * S), fill=(190, 140, 70, 255))
    d.rectangle((0, ty * S + 4 * S, size[0], ty * S + 9 * S), fill=(70, 40, 20, 255))

    # --- ayna
    mx0, my0, mx1, my1 = MIRROR
    outer = mirror_shape(size, S, inset=-FRAME_W)
    inner = mirror_shape(size, S, inset=0)
    frame = Image.new('RGBA', size, (0, 0, 0, 0))
    fr = np.zeros((size[1], size[0], 3), np.float32)
    fr[:] = mix(hx('6b4510'), hx('f0cf7a'), (np.abs(((xx - size[0] / 2) / (size[0] / 2)) % 2 - 1) * 0 + (np.sin(xx * 0.004 + yy * 0.002) * .5 + .5))[..., None])
    frame_img = Image.fromarray(np.clip(fr, 0, 255).astype(np.uint8), 'RGB').convert('RGBA')
    frame.paste(frame_img, (0, 0), outer)
    img.alpha_composite(frame)
    # ayna camı: odanın yansıması (koyu, hafif turkuaz-mürdüm)
    glass = _grad(size, '241b2c', '0f0a14')
    glass += 30 * np.exp(-(((xx - size[0] * .75) / (size[0] * .25)) ** 2 + ((yy - size[1] * .22) / (size[1] * .2)) ** 2))[..., None] * np.array([.5, .6, 1.0], np.float32)
    gimg = Image.fromarray(np.clip(glass, 0, 255).astype(np.uint8), 'RGB').convert('RGBA')
    # çapraz cam ışıltısı
    gl = Image.new('RGBA', size, (0, 0, 0, 0)); gd = ImageDraw.Draw(gl)
    for off, w_, a in ((0, 90, 20), (140, 40, 14), (-110, 24, 12)):
        gd.polygon([((mx0 + 120 + off) * S, my0 * S), ((mx0 + 120 + off + w_) * S, my0 * S), ((mx0 - 160 + off + w_) * S, (my0 + 1000) * S), ((mx0 - 160 + off) * S, (my0 + 1000) * S)], fill=(255, 235, 220, a))
    gimg.alpha_composite(gl)
    # aynadaki oda yansıması: uzakta pencere ve lamba silüeti
    rd = ImageDraw.Draw(gimg)
    rd.rounded_rectangle(((mx0 + 90) * S, (my0 + 190) * S, (mx0 + 280) * S, (my0 + 520) * S), radius=10 * S, fill=(50, 52, 78, 255))
    for k in range(3):
        rd.rectangle(((mx0 + 100 + k * 60) * S, (my0 + 200) * S, (mx0 + 140 + k * 60) * S, (my0 + 505) * S), fill=(78, 86, 124, 255))
    rd.polygon([((mx0 + 590) * S, (my0 + 300) * S), ((mx0 + 700) * S, (my0 + 300) * S), ((mx0 + 680) * S, (my0 + 380) * S), ((mx0 + 610) * S, (my0 + 380) * S)], fill=(90, 70, 70, 255))
    rd.rectangle(((mx0 + 640) * S, (my0 + 380) * S, (mx0 + 650) * S, (my0 + 560) * S), fill=(60, 50, 56, 255))
    gimg = gimg.filter(ImageFilter.GaussianBlur(6 * S))
    glass_layer = Image.new('RGBA', size, (0, 0, 0, 0))
    glass_layer.paste(gimg, (0, 0), inner)
    img.alpha_composite(glass_layer)
    # iç gölge (cam kenarı)
    inner_edge = ImageChops.multiply(inner, ImageChops.invert(inner.filter(ImageFilter.GaussianBlur(16 * S))))
    sh = Image.new('RGBA', size, (0, 0, 0, 0)); sh.paste(Image.new('RGBA', size, (0, 0, 0, 120)), (0, 0), inner_edge)
    img.alpha_composite(sh)
    # ampul soketleri
    d = ImageDraw.Draw(img)
    for (bx, by) in bulb_positions():
        r = 17 * S
        d.ellipse(((bx - r) * S / S - 0, (by - r), (bx + r), (by + r)), fill=None) if False else None
        c = (bx * S, by * S)
        d.ellipse((c[0] - 19 * S, c[1] - 19 * S, c[0] + 19 * S, c[1] + 19 * S), fill=(96, 66, 22, 255), outline=(240, 205, 120, 255), width=int(2 * S))
        d.ellipse((c[0] - 13 * S, c[1] - 13 * S, c[0] + 13 * S, c[1] + 13 * S), fill=(120, 108, 92, 255))   # sönük ampul
        d.ellipse((c[0] - 8 * S, c[1] - 9 * S, c[0] - 2 * S, c[1] - 3 * S), fill=(190, 180, 170, 255))

    # --- masa üstü aksesuarları (karakter olmayan dekor)
    props_back(img, S)
    # ayna yansıması masa üstünde (cilalı yüzey): ışıklı band
    rf = Image.new('RGBA', size, (0, 0, 0, 0)); rd2 = ImageDraw.Draw(rf)
    for gx, ga in ((mx0 + 80, 26), (mx0 + 400, 20), (mx0 + 720, 26)):
        rd2.polygon([((gx) * S, ty * S + 10 * S), ((gx + 80) * S, ty * S + 10 * S), ((gx + 140) * S, (ty + 520) * S), ((gx - 60) * S, (ty + 520) * S)], fill=(255, 190, 130, ga))
    img.alpha_composite(rf.filter(ImageFilter.GaussianBlur(26 * S)))
    return img.convert('RGB')


def props_back(img, S):
    """Masa üstündeki dekor: tepsi, fırça kabı, şişeler, gül (yüz yok)."""
    sz = img.size
    d = ImageDraw.Draw(img)
    # orta tepsi (altın kenarlı ayna tepsi)
    tray = Image.new('RGBA', sz, (0, 0, 0, 0)); td = ImageDraw.Draw(tray)
    cx, cy, rx, ry = 560, 1440, 330, 70
    td.ellipse(((cx - rx) * S, (cy - ry + 10) * S, (cx + rx) * S, (cy + ry + 10) * S), fill=(0, 0, 0, 90))
    td.ellipse(((cx - rx) * S, (cy - ry) * S, (cx + rx) * S, (cy + ry) * S), fill=(176, 130, 60, 255))
    td.ellipse(((cx - rx + 14) * S, (cy - ry + 8) * S, (cx + rx - 14) * S, (cy + ry - 8) * S), fill=(58, 24, 34, 255))
    td.ellipse(((cx - rx + 40) * S, (cy - ry + 18) * S, (cx + rx - 40) * S, (cy + ry - 18) * S), fill=(70, 30, 42, 255))
    tray = tray.filter(ImageFilter.GaussianBlur(0.6 * S))
    img.alpha_composite(tray)
    # arkada cam şişeler ve gül
    def bottle(x, y, w, h, col, a=255):
        lay = Image.new('RGBA', sz, (0, 0, 0, 0)); ld = ImageDraw.Draw(lay)
        ld.rounded_rectangle((x * S, (y - h) * S, (x + w) * S, y * S), radius=10 * S, fill=col + (a,))
        ld.rectangle(((x + w * .3) * S, (y - h - 40) * S, (x + w * .7) * S, (y - h + 4) * S), fill=(210, 180, 120, 255))
        ld.rounded_rectangle(((x + 6) * S, (y - h + 14) * S, (x + 14) * S, (y - 14) * S), radius=3 * S, fill=(255, 255, 255, 80))
        img.alpha_composite(lay)
    bottle(405, 1250, 52, 130, (210, 130, 150), 200)
    bottle(468, 1250, 40, 96, (150, 190, 205), 190)
    bottle(700, 1262, 46, 112, (120, 40, 70), 220)
    # fırça kabı
    lay = Image.new('RGBA', sz, (0, 0, 0, 0)); ld = ImageDraw.Draw(lay)
    for i, (dx, ang, h_) in enumerate(((-14, -9, 120), (-2, -2, 140), (11, 6, 126), (22, 12, 108))):
        x0 = 588 + dx
        ld.line([(x0 * S, 1256 * S), ((x0 + math.sin(math.radians(ang)) * h_) * S, (1256 - h_) * S)], fill=(210, 170, 90, 255), width=int(5 * S))
        tx = x0 + math.sin(math.radians(ang)) * h_
        ld.ellipse(((tx - 11) * S, (1256 - h_ - 26) * S, (tx + 11) * S, (1256 - h_ + 8) * S), fill=((230, 190, 200) if i % 2 else (160, 100, 100)) + (255,))
    ld.rounded_rectangle((566 * S, 1240 * S, 622 * S, 1300 * S), radius=8 * S, fill=(190, 140, 66, 255))
    ld.rounded_rectangle((570 * S, 1244 * S, 580 * S, 1296 * S), radius=4 * S, fill=(255, 235, 170, 200))
    img.alpha_composite(lay)
    # gül (vazoda)
    lay = Image.new('RGBA', sz, (0, 0, 0, 0)); ld = ImageDraw.Draw(lay)
    ld.rounded_rectangle((866 * S, 1230 * S, 912 * S, 1300 * S), radius=14 * S, fill=(200, 220, 235, 120), outline=(255, 255, 255, 150), width=int(2 * S))
    ld.line([(889 * S, 1236 * S), (889 * S, 1130 * S)], fill=(36, 80, 50, 255), width=int(5 * S))
    for r_, col in ((26, (150, 20, 44)), (19, (190, 30, 60)), (11, (222, 60, 92))):
        ld.ellipse(((889 - r_) * S, (1112 - r_) * S, (889 + r_) * S, (1112 + r_) * S), fill=col + (255,))
    img.alpha_composite(lay)
    # organizerlerin arka planı (gövde)
    org_back(img, S)


def org_back(img, S):
    d = ImageDraw.Draw(img)
    x0, y0, x1, y1 = ORG_A
    # çekmece yuvası (koyu içi)
    sx0, sy0, sx1, sy1 = SLOT
    d.rounded_rectangle((x0 * S, y0 * S, x1 * S, y1 * S), radius=14 * S, fill=(40, 16, 24, 255))
    d.rectangle((sx0 * S, sy0 * S, sx1 * S, sy1 * S), fill=(8, 2, 5, 255))
    # sağ kule gövdesi (arka katman: koyu iç)
    bx0, by0, bx1, by1 = ORG_B
    d.rounded_rectangle((bx0 * S, by0 * S, bx1 * S, by1 * S), radius=14 * S, fill=(40, 16, 24, 255))


def build_org_front(S=2):
    """Organizer ön yüzleri (RGBA), karakterlerin önünde çizilir."""
    size = (WW * S, WH * S)
    img = Image.new('RGBA', size, (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # ORG_A: gövde ön yüzü (çekmece hariç)
    x0, y0, x1, y1 = ORG_A
    fa = Image.new('RGBA', size, (0, 0, 0, 0))
    fd = ImageDraw.Draw(fa)
    fd.rounded_rectangle((x0 * S, (DRAWER[3] - 6) * S, x1 * S, y1 * S), radius=14 * S, fill=(236, 214, 220, 255))
    img.alpha_composite(fa)
    for i, yy in enumerate((1250, 1356)):
        drawer_front(img, S, (x0 + 14, yy, x1 - 14, yy + 94))
    # ORG_B: ön yüz
    bx0, by0, bx1, by1 = ORG_B
    fb = Image.new('RGBA', size, (0, 0, 0, 0))
    ImageDraw.Draw(fb).rounded_rectangle((bx0 * S, by0 * S, bx1 * S, by1 * S), radius=14 * S, fill=(236, 214, 220, 255))
    img.alpha_composite(fb)
    for i, yy in enumerate((1062, 1156, 1250, 1344)):
        drawer_front(img, S, (bx0 + 14, yy, bx1 - 14, yy + 84))
    # üst kenarlar için ince parlama
    for (ax0, ay0, ax1, ay1) in (ORG_B,):
        d.rounded_rectangle((ax0 * S, ay0 * S, ax1 * S, (ay0 + 8) * S), radius=6 * S, fill=(255, 250, 250, 200))
    return img


def drawer_front(img, S, box, opened=0.0, draw_to=None):
    x0, y0, x1, y1 = box
    lay = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ld = ImageDraw.Draw(lay)
    ld.rounded_rectangle((x0 * S, y0 * S, x1 * S, y1 * S), radius=9 * S, fill=(246, 226, 232, 255), outline=(200, 160, 120, 255), width=int(3 * S))
    ld.rounded_rectangle(((x0 + 8) * S, (y0 + 8) * S, (x1 - 8) * S, (y1 - 8) * S), radius=6 * S, outline=(224, 196, 204, 255), width=int(2 * S))
    cx = (x0 + x1) / 2; cy = (y0 + y1) / 2
    ld.rounded_rectangle(((cx - 22) * S, (cy - 5) * S, (cx + 22) * S, (cy + 5) * S), radius=5 * S, fill=(196, 148, 66, 255))
    ld.rounded_rectangle(((cx - 18) * S, (cy - 4) * S, (cx + 6) * S, (cy - 1) * S), radius=2 * S, fill=(255, 238, 180, 255))
    # alt gölge
    sh = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rectangle((x0 * S, y1 * S, x1 * S, (y1 + 6) * S), fill=(0, 0, 0, 70))
    img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(3 * S)))
    img.alpha_composite(lay)


def drawer_layer(open_k, S=2):
    """Hareketli üst çekmece ön yüzü: açıldıkça öne/aşağı kayar ve büyür."""
    x0, y0, x1, y1 = DRAWER
    dy = 46 * open_k
    sc = 1 + 0.07 * open_k
    cx = (x0 + x1) / 2
    w = (x1 - x0) * sc; h = (y1 - y0) * sc
    box = (cx - w / 2, y0 + dy, cx + w / 2, y0 + dy + h)
    lay = Image.new('RGBA', (WW * S, WH * S), (0, 0, 0, 0))
    drawer_front(lay, S, box)
    return lay


def build_bulb_glow(S=0.5):
    """Tek bir ampul parıltısı (RGBA'sız L haritası, 0..255)."""
    return None
