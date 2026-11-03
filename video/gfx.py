"""Karakter sprite'ları (pseudo-3D gölgelemeli, PIL + numpy ile çizilir; ücretsiz)."""
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageChops

K = 4            # çıktı sprite'ında dünya birimi başına piksel
SSF = 2          # çizimde süper-örnekleme
D = K * SSF


def bez(p0, p1, p2, n=24):
    pts = []
    for i in range(n + 1):
        t = i / n
        x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0]
        y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]
        pts.append((x, y))
    return pts


class Layer:
    def __init__(self, wu, hu):
        self.wu, self.hu = wu, hu
        self.size = (int(wu * D), int(hu * D))
        self.img = Image.new("RGBA", self.size, (0, 0, 0, 0))

    # --- maskeler -------------------------------------------------
    def new_mask(self):
        return Image.new("L", self.size, 0)

    def ell(self, cx, cy, rx, ry, m=None):
        m = m or self.new_mask()
        ImageDraw.Draw(m).ellipse([(cx - rx) * D, (cy - ry) * D, (cx + rx) * D, (cy + ry) * D], fill=255)
        return m

    def poly(self, pts, m=None):
        m = m or self.new_mask()
        ImageDraw.Draw(m).polygon([(x * D, y * D) for x, y in pts], fill=255)
        return m

    def rrect(self, x0, y0, x1, y1, r, m=None):
        m = m or self.new_mask()
        ImageDraw.Draw(m).rounded_rectangle([x0 * D, y0 * D, x1 * D, y1 * D], radius=r * D, fill=255)
        return m

    def rect(self, x0, y0, x1, y1, m=None):
        m = m or self.new_mask()
        ImageDraw.Draw(m).rectangle([x0 * D, y0 * D, x1 * D, y1 * D], fill=255)
        return m

    def line(self, pts, w, m=None):
        m = m or self.new_mask()
        d = ImageDraw.Draw(m)
        P = [(x * D, y * D) for x, y in pts]
        wpx = max(1, int(w * D))
        if len(P) > 1:
            d.line(P, fill=255, width=wpx, joint="curve")
        r = wpx / 2
        for x, y in (P[0], P[-1]):
            d.ellipse([x - r, y - r, x + r, y + r], fill=255)
        return m

    def stroke_var(self, pts, w0, w1, m=None):
        """değişken kalınlıkta fırça (emzik vb.)"""
        m = m or self.new_mask()
        d = ImageDraw.Draw(m)
        n = len(pts)
        for i, (x, y) in enumerate(pts):
            w = w0 + (w1 - w0) * i / max(1, n - 1)
            r = w * D / 2
            d.ellipse([x * D - r, y * D - r, x * D + r, y * D + r], fill=255)
        return m

    @staticmethod
    def AND(a, b): return ImageChops.multiply(a, b)
    @staticmethod
    def OR(a, b): return ImageChops.lighter(a, b)
    @staticmethod
    def SUB(a, b): return ImageChops.subtract(a, b)

    # --- boyama ---------------------------------------------------
    def flat(self, mask, color, alpha=1.0):
        bb = mask.getbbox()
        if not bb:
            return
        m = mask.crop(bb)
        if alpha < 1.0:
            m = m.point(lambda v: int(v * alpha))
        layer = Image.new("RGBA", m.size, tuple(color) + (255,))
        layer.putalpha(m)
        self.img.alpha_composite(layer, (bb[0], bb[1]))

    def paint(self, mask, stops, center=(0.35, 0.3), rad=0.9, kind="radial", angle=0.0, alpha=1.0):
        bb = mask.getbbox()
        if not bb:
            return
        x0, y0, x1, y1 = bb
        w, h = x1 - x0, y1 - y0
        yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
        if kind == "radial":
            t = np.sqrt((xx - center[0] * w) ** 2 + (yy - center[1] * h) ** 2) / (rad * max(w, h))
        else:
            a = math.radians(angle)
            t = (xx / w - 0.5) * math.sin(a) + (yy / h - 0.5) * math.cos(a) + 0.5
        t = np.clip(t, 0, 1)
        pos = [s[0] for s in stops]
        arr = np.stack([np.interp(t, pos, [s[1][c] for s in stops]) for c in range(3)], -1)
        rgba = np.zeros((h, w, 4), np.uint8)
        rgba[..., :3] = arr.astype(np.uint8)
        rgba[..., 3] = (np.asarray(mask.crop(bb), dtype=np.float32) * alpha).astype(np.uint8)
        self.img.alpha_composite(Image.fromarray(rgba, "RGBA"), (x0, y0))

    def shine(self, base, cx, cy, rx, ry, rot=0, blur=2.0, strength=0.8, color=(255, 255, 255)):
        m = self.new_mask()
        tmp = Image.new("L", self.size, 0)
        ImageDraw.Draw(tmp).ellipse([(cx - rx) * D, (cy - ry) * D, (cx + rx) * D, (cy + ry) * D], fill=255)
        if rot:
            tmp = tmp.rotate(rot, center=(cx * D, cy * D), resample=Image.BICUBIC)
        m = tmp.filter(ImageFilter.GaussianBlur(blur * D))
        m = ImageChops.multiply(m, base)
        self.flat(m, color, strength)

    def shade_edge(self, base, dx, dy, blur, color, strength):
        """tabanın kenarında (ışığın tersi) iç gölge"""
        sh = ImageChops.offset(base, int(dx * D), int(dy * D))
        inv = ImageChops.invert(sh).filter(ImageFilter.GaussianBlur(blur * D))
        m = ImageChops.multiply(inv, base)
        self.flat(m, color, strength)

    def out(self):
        return self.img.resize((int(self.wu * K), int(self.hu * K)), Image.LANCZOS)


# ===================================================================
# Renk paleti
PORC = [(0, (255, 255, 252)), (0.55, (240, 238, 232)), (1, (186, 192, 210))]
GOLD = [(0, (255, 232, 150)), (0.5, (222, 172, 62)), (1, (150, 100, 30))]
DARK = (74, 40, 40)


def gold_ring(L, cx, cy, r_out, r_in, squash=1.0):
    ring = L.SUB(L.ell(cx, cy, r_out, r_out * squash), L.ell(cx, cy, r_in, r_in * squash))
    L.paint(ring, GOLD, kind="linear", angle=40)
    return ring


def flower(L, x, y, r, col=(52, 96, 176), center=(240, 200, 90)):
    for k in range(5):
        a = k * 2 * math.pi / 5 - math.pi / 2
        L.flat(L.ell(x + math.cos(a) * r * 0.9, y + math.sin(a) * r * 0.9, r * 0.62, r * 0.62), col)
    L.flat(L.ell(x, y, r * 0.5, r * 0.5), center)


def dust(L, base, y_top, h=3.0, alpha=0.55, blur=1.2, col=(214, 204, 186)):
    """yüzeyin üstünde hafif toz tabakası"""
    band = L.new_mask()
    ImageDraw.Draw(band).rectangle([0, 0, L.size[0], (y_top + h) * D], fill=255)
    band = band.filter(ImageFilter.GaussianBlur(blur * D))
    m = ImageChops.multiply(band, base)
    L.flat(m, col, alpha)


# ===================================================================
# KARAKTER GÖVDELERİ
def build_plates():
    L = Layer(112, 142)
    # ahşap sehpa
    st = L.rrect(14, 124, 98, 138, 5)
    L.paint(st, [(0, (222, 172, 118)), (1, (134, 84, 46))], kind="linear")
    st2 = L.poly([(30, 118), (82, 118), (92, 126), (20, 126)])
    L.paint(st2, [(0, (206, 156, 104)), (1, (150, 100, 58))], kind="linear")
    cx, cy, R = 48, 68, 46
    for i, (ox, oy, sh) in enumerate([(15, -15, 0.80), (10, -10, 0.86), (5, -5, 0.93)]):
        m = L.ell(cx + ox, cy + oy, R, R)
        c = int(255 * sh)
        L.paint(m, [(0, (c, c, c - 6)), (1, (c - 70, c - 66, c - 40))], center=(.3, .3), rad=1.0)
        gold_ring(L, cx + ox, cy + oy, R, R - 2.8)
    m = L.ell(cx, cy, R, R)
    L.paint(m, PORC, center=(.3, .26), rad=1.0)
    gold_ring(L, cx, cy, R, R - 3.2)
    # kobalt ince halka + çiçek bordürü
    ring = L.SUB(L.ell(cx, cy, 38.5, 38.5), L.ell(cx, cy, 37.2, 37.2))
    L.flat(ring, (60, 98, 172))
    for k in range(12):
        a = k * 2 * math.pi / 12
        flower(L, cx + math.cos(a) * 41.4, cy + math.sin(a) * 41.4, 2.2)
    # iç çukur gölgesi
    well = L.ell(cx, cy, 36, 36)
    L.shade_edge(well, 1.5, 2.0, 2.5, (150, 160, 190), 0.35)
    L.shine(m, 28, 40, 10, 5, rot=-35, blur=2.5, strength=0.75)
    dust(L, m, cy - R, h=4.0)
    return dict(img=L.out(), anchor=(56, 136), face=dict(
        eyes=[(38, 62), (59, 62)], ew=8.6, eh=10.5, iris=(86, 112, 160), lid=(245, 243, 238),
        brow=dict(col=(96, 70, 52), w=10, t=2.3, dy=-12.5), mouth=(48.5, 83, 22), mcol=(112, 36, 46),
        blush=[(27, 76, 6), (70, 76, 6)], bcol=(255, 150, 160)))


def build_cups():
    L = Layer(132, 120)
    # arkadaki kahve ibriği (yüzsüz, minik)
    pot = L.poly([(12, 100), (44, 100), (40, 52), (20, 52)])
    L.paint(pot, PORC, center=(.3, .3), rad=1.1)
    L.flat(L.rect(12, 86, 44, 90, L.new_mask()), (236, 160, 176), 0.0)
    pm = L.AND(pot, L.rect(0, 84, 80, 90))
    L.flat(pm, (240, 170, 186))
    lid = L.ell(30, 52, 12, 5)
    L.paint(lid, PORC)
    L.flat(L.ell(30, 45, 3.2, 3.2), (222, 172, 62))
    sp = L.stroke_var(bez((42, 76), (56, 78), (58, 62)), 6.5, 3.2)
    L.paint(sp, PORC, kind="linear")
    # arkadaki küçük fincan
    bc = L.AND(L.ell(104, 78, 20, 22), L.rect(0, 62, 140, 130))
    L.paint(bc, PORC, center=(.3, .2), rad=1.2)
    L.flat(L.ell(104, 62, 20, 4.6), (252, 244, 232))
    gold_ring(L, 104, 62, 20, 18.6, 0.23)
    # tabak (alt)
    sau = L.ell(62, 106, 54, 11)
    L.paint(sau, PORC, kind="linear", angle=10)
    gold_ring(L, 62, 106, 54, 52, 0.204)
    L.flat(L.ell(62, 104.5, 30, 6), (232, 230, 224), 0.8)
    # kulp (gövdenin arkası)
    h = L.line([(96, 60), (112, 56), (116, 70), (104, 88), (92, 88)], 6.5)
    L.paint(h, PORC, kind="linear", angle=90)
    # gövde
    body = L.AND(L.ell(62, 60, 40, 44), L.rect(0, 46, 140, 130))
    L.paint(body, PORC, center=(.3, .22), rad=1.05)
    band = L.AND(body, L.rect(0, 92, 140, 99))
    L.flat(band, (240, 168, 184))
    for k in range(9):
        L.flat(L.ell(34 + k * 7.0, 95.5, 1.2, 1.2), (222, 172, 62))
    L.flat(L.AND(body, L.rect(0, 53.5, 140, 55)), (222, 172, 62), 0.95)
    foot = L.ell(62, 104, 20, 4.5)
    L.paint(foot, [(0, (230, 228, 222)), (1, (170, 176, 192))])
    rim = L.ell(62, 46, 40, 8.5)
    L.paint(rim, [(0, (255, 250, 240)), (1, (228, 214, 196))], kind="linear")
    inner = L.ell(62, 46.8, 36.5, 6.2)
    L.paint(inner, [(0, (150, 108, 82)), (1, (96, 62, 44))], kind="linear")  # kahve rengi iç
    L.flat(L.ell(56, 45.3, 9, 1.8), (210, 160, 120), 0.6)
    gold_ring(L, 62, 46, 40, 38.3, 0.212)
    L.shade_edge(body, 2, 2, 3, (160, 168, 196), 0.45)
    L.shine(body, 40, 70, 4.5, 12, rot=8, blur=2.0, strength=0.8)
    dust(L, rim, 38, h=3, alpha=0.5)
    return dict(img=L.out(), anchor=(62, 108), face=dict(
        eyes=[(50, 68), (74, 68)], ew=9.8, eh=12.0, iris=(120, 78, 50), lid=(247, 244, 238),
        brow=dict(col=(100, 66, 50), w=11, t=2.4, dy=-14), mouth=(62, 87, 20), mcol=(120, 38, 48),
        blush=[(40, 82, 6.2), (84, 82, 6.2)], bcol=(255, 150, 160)))


CHROME = [(0, (252, 254, 255)), (0.28, (186, 198, 216)), (0.52, (112, 124, 146)), (0.74, (206, 214, 228)), (1, (86, 94, 112))]


def build_teapot():
    L = Layer(134, 122)
    # sap (arkada, koyu parlak)
    hd = L.line([(100, 52), (130, 52), (136, 84), (112, 100), (100, 98)], 7)
    L.paint(hd, [(0, (96, 84, 94)), (0.5, (44, 38, 46)), (1, (22, 18, 24))], kind="linear", angle=90)
    L.shine(hd, 126, 62, 2.2, 10, blur=1.2, strength=0.7)
    # emzik
    sp = L.stroke_var(bez((34, 98), (6, 98), (10, 56), 28), 15, 6.5)
    L.paint(sp, CHROME, kind="linear", angle=90)
    L.flat(L.ell(10.5, 57, 4.2, 2.2), (60, 66, 82))
    L.shine(sp, 14, 70, 1.8, 10, blur=1.0, strength=0.8)
    # gövde
    body = L.ell(66, 80, 44, 36)
    L.paint(body, CHROME, kind="linear", angle=0)
    L.flat(L.AND(body, L.rect(0, 100, 140, 130)), (80, 90, 110), 0.28)
    base = L.rrect(40, 108, 92, 116, 4)
    L.paint(base, [(0, (140, 148, 164)), (1, (50, 54, 68))], kind="linear")
    L.shine(body, 42, 62, 9, 4.2, rot=-28, blur=1.8, strength=0.95)
    L.shine(body, 94, 70, 2.6, 13, blur=1.4, strength=0.55)
    # kapak
    col = L.ell(66, 52, 28, 6.2)
    L.paint(col, CHROME, kind="linear", angle=90)
    dome = L.AND(L.ell(66, 52, 24, 17), L.rect(0, 0, 140, 52))
    L.paint(dome, CHROME, kind="linear", angle=0)
    L.shine(dome, 56, 42, 6, 3, rot=-25, blur=1.4, strength=0.95)
    kn = L.ell(66, 31, 6.6, 6.2)
    L.paint(kn, [(0, (255, 238, 170)), (0.5, (216, 164, 56)), (1, (130, 84, 24))])
    L.flat(L.ell(64, 29, 2, 1.6), (255, 255, 255), 0.9)
    dust(L, dome, 34, h=3, alpha=0.5)
    return dict(img=L.out(), anchor=(66, 116), face=dict(
        eyes=[(54, 77), (79, 77)], ew=9.8, eh=11.0, iris=(60, 112, 98), lid=(176, 188, 206),
        brow=dict(col=(52, 44, 52), w=11, t=2.4, dy=-13), mouth=(66.5, 95, 20), mcol=(110, 34, 46),
        blush=[(44, 91, 5.5), (89, 91, 5.5)], bcol=(255, 160, 170)))


STEEL = [(0, (246, 249, 252)), (0.32, (200, 208, 220)), (0.62, (140, 150, 168)), (0.82, (190, 198, 212)), (1, (104, 112, 128))]
COPPER = [(0, (255, 190, 140)), (0.5, (206, 112, 66)), (1, (120, 58, 34))]


def build_pot(w, h, eye_sz, lid_h):
    L = Layer(w + 26, h + lid_h + 14)
    ox = 13
    y_body0 = lid_h + 6
    body = L.rrect(ox, y_body0, ox + w, y_body0 + h, 8)
    # yan kulplar
    for sx in (ox - 7, ox + w + 1):
        k = L.rrect(sx, y_body0 + h * 0.18, sx + 6.5, y_body0 + h * 0.34, 3)
        L.paint(k, [(0, (70, 62, 66)), (1, (22, 18, 22))], kind="linear")
    L.paint(body, STEEL, kind="linear", angle=90 + 0)
    # bakır taban
    cu = L.AND(body, L.rect(0, y_body0 + h - 9, 400, 400))
    L.paint(cu, COPPER, kind="linear", angle=0)
    L.flat(L.AND(body, L.rect(0, y_body0 + h - 10, 400, y_body0 + h - 8.7)), (255, 214, 170), 0.8)
    L.shade_edge(body, 1.6, 0, 3, (96, 108, 130), 0.35)
    L.shine(body, ox + w * 0.2, y_body0 + h * 0.4, 2.8, h * 0.28, blur=1.4, strength=0.85)
    # cam kapak (hafif şeffaf mavimsi)
    lidm = L.AND(L.ell(ox + w / 2, y_body0 + 1, w / 2 + 1.5, lid_h + 1), L.rect(0, 0, 400, y_body0 + 1))
    L.paint(lidm, [(0, (232, 246, 252)), (1, (150, 186, 204))], center=(.3, .3), alpha=0.82)
    rim = L.AND(L.ell(ox + w / 2, y_body0 + 1, w / 2 + 1.8, lid_h + 1.8), L.rect(0, 0, 400, y_body0 + 2))
    rim = L.SUB(rim, L.ell(ox + w / 2, y_body0 + 1, w / 2 - 0.3, lid_h - 0.2))
    L.paint(rim, STEEL, kind="linear", angle=90)
    L.shine(lidm, ox + w * 0.3, y_body0 - lid_h * 0.5, w * 0.12, 2.6, rot=-20, blur=1.2, strength=0.9)
    kn = L.ell(ox + w / 2, 2.5, 3.6, 3.4)
    L.paint(kn, [(0, (60, 54, 58)), (1, (14, 12, 14))])
    dust(L, lidm, 0, h=2, alpha=0.45)
    fx = ox + w / 2
    fy = y_body0 + h * 0.42
    return dict(img=L.out(), anchor=(fx, y_body0 + h), face=dict(
        eyes=[(fx - w * 0.2, fy), (fx + w * 0.2, fy)], ew=eye_sz, eh=eye_sz * 1.18, iris=(70, 100, 140), lid=(190, 198, 212),
        brow=dict(col=(70, 56, 52), w=eye_sz * 1.15, t=eye_sz * 0.26, dy=-eye_sz * 1.35),
        mouth=(fx, fy + h * 0.30, w * 0.34), mcol=(110, 34, 46),
        blush=[(fx - w * 0.33, fy + h * 0.18, eye_sz * 0.6), (fx + w * 0.33, fy + h * 0.18, eye_sz * 0.6)], bcol=(255, 160, 170)))


IRON = [(0, (132, 118, 120)), (0.34, (78, 68, 72)), (0.7, (44, 38, 44)), (1, (20, 18, 22))]
PATINA = [(0, (206, 150, 96)), (0.5, (140, 106, 76)), (1, (70, 108, 98))]


def build_cauldron():
    L = Layer(166, 152)
    # tutamaç (bail) – arkada
    bail = L.line(bez((12, 62), (80, -18), (154, 62), 28), 4.6)
    L.paint(bail, [(0, (96, 86, 90)), (1, (30, 26, 30))], kind="linear", angle=90)
    # bacaklar
    for lx in (34, 114):
        lg = L.poly([(lx, 120), (lx + 18, 120), (lx + 14, 144), (lx + 4, 144)])
        L.paint(lg, [(0, (84, 74, 78)), (1, (18, 16, 20))], kind="linear")
    lg = L.poly([(74, 124), (92, 124), (88, 146), (78, 146)])
    L.paint(lg, [(0, (84, 74, 78)), (1, (18, 16, 20))], kind="linear")
    # kulaklar
    for ex in (10, 132):
        ear = L.SUB(L.ell(ex + 12, 66, 12, 10), L.ell(ex + 12, 66, 6.6, 5.4))
        L.paint(ear, [(0, (92, 82, 86)), (1, (24, 20, 24))], kind="linear")
    # gövde
    body = L.AND(L.ell(83, 84, 70, 62), L.rect(0, 52, 200, 200))
    L.paint(body, IRON, center=(.3, .22), rad=1.0)
    # çöküntüler, izler, pas
    for (dx, dy, rx, ry, a) in [(40, 98, 11, 7, .35), (126, 104, 12, 8, .3), (112, 76, 6, 4, .3)]:
        L.flat(L.AND(L.ell(dx, dy, rx, ry), body), (14, 12, 16), a)
        L.shine(body, dx - 2, dy - 2, rx * 0.5, ry * 0.4, blur=1.3, strength=0.22)
    for (dx, dy) in [(52, 128), (104, 130), (70, 134)]:
        L.flat(L.AND(L.ell(dx, dy, 9, 4), body), (122, 72, 40), 0.45)
    L.shade_edge(body, 4, 0, 5, (8, 6, 10), 0.5)
    L.shine(body, 40, 82, 6, 20, rot=10, blur=3.0, strength=0.28, color=(255, 236, 214))
    # ağız kenarı (yaşlı bakır)
    rim_o = L.ell(83, 54, 62, 13)
    L.paint(rim_o, PATINA, kind="linear", angle=90)
    inner = L.ell(83, 55.5, 55, 9.4)
    L.paint(inner, [(0, (24, 20, 24)), (1, (6, 4, 8))], kind="linear")
    L.shine(rim_o, 46, 50, 12, 1.6, blur=1.0, strength=0.5, color=(255, 232, 196))
    dust(L, rim_o, 41, h=3.5, alpha=0.55, col=(196, 188, 176))
    dust(L, body, 52, h=3, alpha=0.18, col=(160, 154, 148))
    return dict(img=L.out(), anchor=(83, 146), face=dict(
        eyes=[(62, 94), (104, 94)], ew=13.0, eh=14.4, iris=(122, 86, 40), lid=(52, 44, 50),
        brow=dict(col=(200, 196, 190), w=21, t=5.6, dy=-17.5, bushy=True), mouth=(83.5, 124, 34), mcol=(60, 14, 20),
        blush=[], bcol=(120, 60, 60), wrinkles=True))


# ===================================================================
# YÜZLER
def face_layer(spec, wu, hu, eye="open", pupil=(0.0, 0.0), mouth="smile", brow="neutral", pup_scale=1.0):
    L = Layer(wu, hu)
    lid_col = spec["lid"]
    ew, eh = spec["ew"], spec["eh"]
    # yanaklar
    for (bx, by, br) in spec.get("blush", []):
        m = L.ell(bx, by, br * 1.25, br * 0.85).filter(ImageFilter.GaussianBlur(br * 0.45 * D))
        L.flat(m, spec["bcol"], 0.42)
    # yüz çizgileri (kazan)
    if spec.get("wrinkles"):
        for ex in (62, 104):  # göz altı torbaları
            bag = L.line(bez((ex - 10, 109), (ex, 114), (ex + 10, 109)), 1.4)
            L.flat(bag, (16, 12, 16), 0.5)
    for i, (ex, ey) in enumerate(spec["eyes"]):
        sgn = -1 if i == 0 else 1
        s = 1.0
        if eye == "wide":
            s = 1.2
        cx, cy = ex, ey
        rx, ry = ew * s, eh * s
        if eye in ("blink", "happy"):
            if eye == "blink":
                ln = L.line(bez((cx - rx * 0.9, cy), (cx, cy + ry * 0.45), (cx + rx * 0.9, cy)), 1.7)
            else:
                ln = L.line(bez((cx - rx * 0.9, cy + ry * 0.25), (cx, cy - ry * 0.75), (cx + rx * 0.9, cy + ry * 0.25)), 1.9)
            L.flat(ln, (46, 28, 26))
        else:
            scl = L.ell(cx, cy, rx, ry)
            L.paint(scl, [(0, (255, 255, 255)), (0.7, (250, 248, 246)), (1, (206, 202, 204))], center=(.4, .3), rad=0.9)
            ring = L.SUB(scl, L.ell(cx, cy, rx - 0.45, ry - 0.45))
            L.flat(ring, (70, 50, 46), 0.65)
            ir = rx * (0.60 if eye != "wide" else 0.48) * pup_scale
            px = cx + pupil[0] * (rx - ir) * 0.85
            py = cy + pupil[1] * (ry - ir) * 0.85
            irm = L.AND(L.ell(px, py, ir, ir), scl)
            L.paint(irm, [(0, tuple(min(255, int(c * 1.35)) for c in spec["iris"])), (1, tuple(int(c * 0.55) for c in spec["iris"]))], center=(.5, .35), rad=0.7)
            L.flat(L.AND(L.ell(px, py, ir * 0.5, ir * 0.5), scl), (14, 10, 12))
            L.flat(L.ell(px - ir * 0.32, py - ir * 0.36, ir * 0.30, ir * 0.30), (255, 255, 255))
            L.flat(L.ell(px + ir * 0.28, py + ir * 0.30, ir * 0.14, ir * 0.14), (255, 255, 255), 0.8)
            # göz kapakları
            if eye in ("angry", "smug", "sleepy"):
                if eye == "angry":
                    inner_y = cy - ry * 0.0
                    outer_y = cy - ry * 0.55
                    ix = cx - sgn * rx * 1.2
                    ox = cx + sgn * rx * 1.2
                    pts = [(ox, outer_y), (ix, inner_y), (ix, cy - ry * 2), (ox, cy - ry * 2)]
                elif eye == "smug":
                    pts = [(cx - rx * 1.3, cy - ry * 0.12), (cx + rx * 1.3, cy - ry * 0.12), (cx + rx * 1.3, cy - ry * 2), (cx - rx * 1.3, cy - ry * 2)]
                else:
                    pts = [(cx - rx * 1.3, cy - ry * 0.0), (cx + rx * 1.3, cy + ry * 0.12), (cx + rx * 1.3, cy - ry * 2), (cx - rx * 1.3, cy - ry * 2)]
                lm = L.AND(L.poly(pts), L.ell(cx, cy, rx + 0.6, ry + 0.6))
                L.flat(lm, lid_col)
                edge = L.AND(L.line([pts[0], pts[1]], 1.6), L.ell(cx, cy, rx + 0.9, ry + 0.9))
                L.flat(edge, (40, 24, 22))
    # kaşlar
    b = spec["brow"]
    raise_, tilt = {"neutral": (0, 0.0), "up": (-3.2, -1.0), "worried": (-1.8, -5.0), "angry": (2.0, 5.2),
                    "smug": (-1, 0), "flat": (1.0, 0.5), "shock": (-5, -1)}[brow]
    for i, (ex, ey) in enumerate(spec["eyes"]):
        sgn = -1 if i == 0 else 1
        r_, t_ = raise_, tilt
        if brow == "smug":
            r_, t_ = ((-6.5, -1.5) if i == 0 else (1.5, 1.5))
        by = ey + b["dy"] + r_
        outer = (ex + sgn * b["w"] / 2, by - t_ * 0.12 - (0.8 if brow != "angry" else 0))
        innerp = (ex - sgn * b["w"] / 2, by + t_)
        mid = ((outer[0] + innerp[0]) / 2, (outer[1] + innerp[1]) / 2 - 1.2)
        if b.get("bushy"):
            pts = [outer, mid, innerp]
            m = L.line(pts, b["t"])
            for k in range(6):
                u = k / 5
                px = outer[0] + (innerp[0] - outer[0]) * u
                py = outer[1] + (innerp[1] - outer[1]) * u - 2.2
                m = L.line([(px, py), (px + sgn * -1.2, py - 3.0)], 1.6, m)
            L.flat(m, b["col"])
        else:
            m = L.line(bez(outer, mid, innerp, 10), b["t"])
            L.flat(m, b["col"])
    # ağız
    mx, my, mw = spec["mouth"]
    mcol = spec["mcol"]
    def open_mouth(w_, h_, top_flat=False):
        shape = L.ell(mx, my, w_ / 2, h_ / 2)
        if top_flat:
            shape = L.AND(L.ell(mx, my - h_ * 0.25, w_ / 2, h_ * 0.75), L.rect(0, my - h_ * 0.5, 999, 999))
        L.flat(shape, mcol)
        tg = L.AND(L.ell(mx, my + h_ * 0.30, w_ * 0.30, h_ * 0.28), shape)
        L.flat(tg, (236, 112, 124))
        return shape
    if mouth == "smile":
        L.flat(L.line(bez((mx - mw / 2, my - 1), (mx, my + mw * 0.34), (mx + mw / 2, my - 1)), 1.9), mcol)
    elif mouth == "closed":
        L.flat(L.line(bez((mx - mw * 0.32, my), (mx, my + 1.2), (mx + mw * 0.32, my)), 1.8), mcol)
    elif mouth == "a":
        open_mouth(mw * 0.46, mw * 0.30)
    elif mouth == "o":
        open_mouth(mw * 0.34, mw * 0.40)
    elif mouth == "mid":
        open_mouth(mw * 0.66, mw * 0.46)
    elif mouth == "wide":
        open_mouth(mw * 0.96, mw * 0.78, top_flat=True)
    elif mouth == "frown":
        L.flat(L.line(bez((mx - mw * 0.40, my + 2.6), (mx, my - mw * 0.30), (mx + mw * 0.40, my + 2.6)), 2.1), mcol)
    elif mouth == "grumble":
        pts = []
        for k in range(15):
            u = k / 14
            x = mx - mw * 0.46 + mw * 0.92 * u
            y = my + 2.0 - math.sin(u * math.pi) * mw * 0.22 + math.sin(u * math.pi * 5) * 0.8
            pts.append((x, y))
        L.flat(L.line(pts, 2.3), mcol)
    elif mouth == "smirk":
        L.flat(L.line(bez((mx - mw * 0.35, my + 1.5), (mx + mw * 0.1, my + mw * 0.2), (mx + mw * 0.45, my - mw * 0.14)), 1.9), mcol)
    elif mouth == "gritted":
        sh = L.rrect(mx - mw * 0.40, my - 2.6, mx + mw * 0.40, my + 3.2, 2.2)
        L.flat(sh, mcol)
        L.flat(L.rrect(mx - mw * 0.36, my - 1.8, mx + mw * 0.36, my + 2.0, 1.6), (246, 242, 234))
        L.flat(L.line([(mx - mw * 0.36, my + 0.1), (mx + mw * 0.36, my + 0.1)], 0.5), (150, 140, 132))
    return L.out()


CHAR_BUILDERS = {
    "tabak": build_plates,
    "fincan": build_cups,
    "cayd": build_teapot,
    "pot1": lambda: build_pot(62, 50, 5.6, 18),
    "pot2": lambda: build_pot(50, 42, 4.6, 15),
    "pot3": lambda: build_pot(40, 34, 3.8, 12),
    "kazan": build_cauldron,
}
