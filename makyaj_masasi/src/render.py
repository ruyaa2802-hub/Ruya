"""Kare üretimi: kamera, katmanlar, gölge/yansıma, ışık ve altyazı."""
import os, sys, math, time
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageChops
import chars, world, direct
from timing import *
from style import *

W, H = 1080, 1920
SSUP = 1.35
HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, '..', 'out')
G = {}


def init():
    if G:
        return
    bgp = os.path.join(CACHE, 'bg_cache.png')
    ofp = os.path.join(CACHE, 'orgfront_cache.png')
    if os.path.exists(bgp):
        G['bg'] = Image.open(bgp).convert('RGB')
    else:
        G['bg'] = world.build_bg(); G['bg'].save(bgp)
    if os.path.exists(ofp):
        G['of'] = Image.open(ofp).convert('RGBA')
    else:
        G['of'] = world.build_org_front(2); G['of'].save(ofp)
    G['mm'] = world.mirror_shape((W, H), 1, inset=0)
    G['actors'] = direct.build_actors()
    # ampul parıltı blobları (yarım çözünürlük, dünya/2)
    def blob(r, p):
        n = int(r * 2)
        yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
        d = np.sqrt((xx - n / 2) ** 2 + (yy - n / 2) ** 2) / (n / 2)
        return np.clip(1 - d, 0, 1) ** p
    G['b_halo'] = blob(110, 2.4)
    G['b_core'] = blob(22, 1.6)
    G['bulbs'] = world.bulb_positions()
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    G['r2'] = (((xx - W / 2) / (W / 2)) ** 2 * 0.8 + ((yy - H / 2) / (H / 2)) ** 2 * 0.9).astype(np.float32)
    G['grain'] = np.random.RandomState(3).normal(0, 1, (H + 200, W + 200)).astype(np.float32)
    G['cyan'] = blob(128, 2.0)


# --------------------------------------------------------------------- yardımcılar
class Cam:
    def __init__(self, cx, cy, z):
        self.cx, self.cy, self.z = cx, cy, z
        self.x0 = cx - W / z / 2
        self.y0 = cy - H / z / 2

    def w2s(self, x, y):
        return (x - self.x0) * self.z, (y - self.y0) * self.z


def lut_mul(band, k):
    k = max(0.0, k)
    return band.point([min(255, int(i * k)) for i in range(256)])


def shadow(canvas, cam, st, wspr):
    sx, sy = cam.w2s(st['x'], st['y'])
    z = cam.z * st['sc']
    rw, rh = wspr * 0.5 * z, 22 * z
    a = int(150 * st['alpha'] * (0.35 + 0.65 * min(1, st['dark'] * 3)))
    if a <= 0:
        return
    pad = int(rw * 0.6 + 20)
    box = (int(sx - rw - pad), int(sy - rh * 2 - pad), int(sx + rw + pad), int(sy + rh * 2 + pad))
    if box[2] < 0 or box[0] > W or box[3] < 0 or box[1] > H:
        return
    lay = Image.new('RGBA', (box[2] - box[0], box[3] - box[1]), (0, 0, 0, 0))
    ImageDraw.Draw(lay).ellipse((pad, pad + rh * 1.2, pad + 2 * rw, pad + rh * 3.2), fill=(0, 0, 0, a))
    lay = lay.filter(ImageFilter.GaussianBlur(max(2, 7 * z)))
    canvas.alpha_composite(lay, (box[0], box[1])) if box[0] >= 0 and box[1] >= 0 else canvas.paste(lay, (box[0], box[1]), lay)


def blit_char(canvas, cam, st, tint=None, refl=True, mirror=False, wspr=200):
    if st['alpha'] <= 0.01:
        return
    name = st['name'].replace('_m', '')
    ex = dict(st['expr'])
    if mirror:
        ex['lax'], ex['rax'] = -ex['rax'], -ex['lax']
        ex['lay'], ex['ray'] = ex['ray'], ex['lay']
        ex['lx'] = -ex['lx']
    ex['sil'] = st['sil']
    z = cam.z * st['sc']
    Sq = min(3.2, max(0.5, round(z * SSUP / 0.1) * 0.1))
    spr, (ax, ay) = chars.render(name, Sq, ex)
    th = math.radians(st['tilt'])
    sxk, syk = max(0.2, st['sx']), max(0.2, st['sy'])
    c, s_ = math.cos(th), math.sin(th)
    f = z / Sq
    bb = spr.getbbox()
    if not bb:
        return
    mg = 0.12 * max(bb[2] - bb[0], bb[3] - bb[1]) * (abs(st['tilt']) / 10 + 0.3)
    ox0 = max(0, int((bb[0] - mg) * f)); oy0 = max(0, int((bb[1] - mg) * f))
    ox1 = min(int(spr.size[0] * f), int((bb[2] + mg) * f)); oy1 = min(int(spr.size[1] * f), int((bb[3] + mg) * f))
    nw, nh = max(2, ox1 - ox0), max(2, oy1 - oy0)
    a_ = c / (f * sxk); b_ = s_ / (f * sxk); d_ = -s_ / (f * syk); e_ = c / (f * syk)
    c0 = ax - (c * ax + s_ * ay) / sxk; f0 = ay - (-s_ * ax + c * ay) / syk
    coef = (a_, b_, c0 + a_ * ox0 + b_ * oy0, d_, e_, f0 + d_ * ox0 + e_ * oy0)
    spr = spr.transform((nw, nh), Image.AFFINE, coef, resample=Image.BICUBIC)
    bx, by = cam.w2s(st['x'], st['y'])
    px, py = int(bx - ax * f) + ox0, int(by - ay * f) + oy0
    if px > W or py > H or px + nw < 0 or py + nh < 0:
        return
    r, g, b, a = spr.split()
    k = st['dark']
    tr, tg, tb = tint if tint else (1, 1, 1)
    if k < 0.999 or tint:
        r, g, b = lut_mul(r, k * tr), lut_mul(g, k * tg), lut_mul(b, k * tb)
    if st['alpha'] < 0.999:
        a = lut_mul(a, st['alpha'])
    if st['clip'] < 9000:
        row = int((st['clip'] - cam.y0) * cam.z) - py
        if row < nh:
            a.paste(0, (0, max(0, row), nw, nh))
    spr = Image.merge('RGBA', (r, g, b, a))
    # masa yansıması
    base_row = int(ay * f) - oy0
    if refl and st['y'] > world.TABLE_Y + 40 and not st['sil']:
        hh = int(min(base_row, 170 * z))
        if hh > 4:
            rf = spr.crop((0, base_row - hh, nw, base_row)).transpose(Image.FLIP_TOP_BOTTOM)
            ra = np.array(rf.split()[3], np.float32)
            ramp = np.linspace(0.34, 0.0, hh, dtype=np.float32)[:, None]
            rf.putalpha(Image.fromarray((ra * ramp).astype(np.uint8)))
            rf = rf.filter(ImageFilter.GaussianBlur(1.5))
            canvas.alpha_composite(rf, (px, py + base_row + 2)) if px >= 0 and py + base_row + 2 >= 0 else canvas.paste(rf, (px, py + base_row + 2), rf)
    if st['sil']:
        al = spr.split()[3].filter(ImageFilter.GaussianBlur(10 * z))
        gl = Image.new('RGBA', spr.size, (110, 150, 255, 0))
        gl.putalpha(lut_mul(al, 0.55 * 1.0))
        canvas.alpha_composite(gl, (px, py)) if px >= 0 and py >= 0 else canvas.paste(gl, (px, py), gl)
    if px >= 0 and py >= 0:
        canvas.alpha_composite(spr, (px, py))
    else:
        canvas.paste(spr, (px, py), spr)


def add_blob(frame, blob, cx, cy, size, color, gain):
    """frame float(H,W,3) üzerine ışık lekesi ekler."""
    size = int(size)
    if size < 4 or gain <= 0.001:
        return
    b = np.asarray(Image.fromarray((blob * 255).astype(np.uint8)).resize((size, size), Image.BILINEAR), np.float32) / 255
    x0, y0 = int(cx - size / 2), int(cy - size / 2)
    xa, ya, xb, yb = max(0, x0), max(0, y0), min(W, x0 + size), min(H, y0 + size)
    if xa >= xb or ya >= yb:
        return
    sub = b[ya - y0:yb - y0, xa - x0:xb - x0]
    frame[ya:yb, xa:xb] += sub[..., None] * (np.array(color, np.float32) * gain)


def draw_drawer(canvas, cam, k):
    x0, y0, x1, y1 = world.DRAWER
    dy = 46 * k
    sc = 1 + 0.07 * k
    cx = (x0 + x1) / 2
    w, h = (x1 - x0) * sc, (y1 - y0) * sc
    box = (cx - w / 2, y0 + dy, cx + w / 2, y0 + dy + h)
    sa = cam.w2s(box[0] - 14, box[1] - 14); sb = cam.w2s(box[2] + 14, box[3] + 14)
    if sb[0] < 0 or sa[0] > W or sb[1] < 0 or sa[1] > H:
        return
    S2 = 2 * cam.z
    bw, bh = int((box[2] - box[0] + 28) * S2), int((box[3] - box[1] + 28) * S2)
    lay = Image.new('RGBA', (bw, bh), (0, 0, 0, 0))
    ox, oy = box[0] - 14, box[1] - 14
    # drawer_front world kutusu*S kullanır: ofset çıkar
    class Off:
        pass
    ld = ImageDraw.Draw(lay)
    bx0, by0, bx1, by1 = (box[0] - ox) * S2, (box[1] - oy) * S2, (box[2] - ox) * S2, (box[3] - oy) * S2
    sh = Image.new('RGBA', lay.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rectangle((bx0, by1, bx1, by1 + 7 * S2), fill=(0, 0, 0, 90))
    lay.alpha_composite(sh.filter(ImageFilter.GaussianBlur(3 * S2)))
    ld.rounded_rectangle((bx0, by0, bx1, by1), radius=9 * S2, fill=(246, 226, 232, 255), outline=(200, 160, 120, 255), width=max(1, int(3 * S2)))
    ld.rounded_rectangle((bx0 + 8 * S2, by0 + 8 * S2, bx1 - 8 * S2, by1 - 8 * S2), radius=6 * S2, outline=(224, 196, 204, 255), width=max(1, int(2 * S2)))
    cxx, cyy = (bx0 + bx1) / 2, (by0 + by1) / 2
    ld.rounded_rectangle((cxx - 22 * S2, cyy - 5 * S2, cxx + 22 * S2, cyy + 5 * S2), radius=5 * S2, fill=(196, 148, 66, 255))
    ld.rounded_rectangle((cxx - 18 * S2, cyy - 4 * S2, cxx + 6 * S2, cyy - 1 * S2), radius=2 * S2, fill=(255, 238, 180, 255))
    lay = lay.resize((max(2, int(lay.size[0] / 2)), max(2, int(lay.size[1] / 2))), Image.LANCZOS)
    px, py = int(sa[0]), int(sa[1])
    canvas.alpha_composite(lay, (px, py)) if px >= 0 and py >= 0 else canvas.paste(lay, (px, py), lay)


def draw_rose_phone(canvas, cam, t):
    on = 0.0
    if 67.3 <= t < 67.7 or 67.95 <= t < 68.35:
        on = 1.0
    elif 68.35 <= t < 74.0:
        on = 0.85
    jx = 0.0
    if 67.3 <= t < 68.35 and (t < 67.7 or t >= 67.95):
        jx = 3 * math.sin(t * 90)
    cxw, cyw = 740 + jx, 1500
    pts_w = [(cxw - 64, cyw - 56), (cxw + 64, cyw - 56), (cxw + 84, cyw + 56), (cxw - 84, cyw + 56)]
    pts = [cam.w2s(*p) for p in pts_w]
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    pad = 20
    box = (int(min(xs)) - pad, int(min(ys)) - pad, int(max(xs)) + pad, int(max(ys)) + pad)
    if box[2] < 0 or box[0] > W or box[3] < 0 or box[1] > H:
        return
    S2 = 2
    lay = Image.new('RGBA', ((box[2] - box[0]) * S2, (box[3] - box[1]) * S2), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    P_ = lambda p, ins=0: ((p[0] - box[0]) * S2, (p[1] - box[1]) * S2)
    d.polygon([P_((p[0], p[1] + 8 * cam.z)) for p in pts], fill=(0, 0, 0, 120))
    d.polygon([P_(p) for p in pts], fill=(214, 150, 140, 255))
    c = (sum(xs) / 4, sum(ys) / 4)
    ins = []
    for p in pts:
        ins.append(P_((c[0] + (p[0] - c[0]) * 0.88, c[1] + (p[1] - c[1]) * 0.9)))
    d.polygon(ins, fill=(8, 8, 14, 255))
    ins2 = [P_((c[0] + (p[0] - c[0]) * 0.8, c[1] + (p[1] - c[1]) * 0.8)) for p in pts]
    col = (int(40 + 150 * on), int(55 + 150 * on), int(90 + 150 * on), 255)
    d.polygon(ins2, fill=col)
    if on > 0.3:
        for i in range(3):
            yy = c[1] + (-14 + i * 12) * cam.z * 0.55
            d.rounded_rectangle((P_((c[0] - 24 * cam.z * 0.55, yy))[0], P_((0, yy))[1], P_((c[0] + (24 - i * 8) * cam.z * 0.55, yy))[0], P_((0, yy + 5 * cam.z * 0.5))[1]), radius=3, fill=(235, 245, 255, 220))
    lay = lay.resize(((box[2] - box[0]), (box[3] - box[1])), Image.LANCZOS)
    if box[0] >= 0 and box[1] >= 0:
        canvas.alpha_composite(lay, (box[0], box[1]))
    else:
        canvas.paste(lay, (box[0], box[1]), lay)


def wrap(text, fnt, maxw, d):
    words, lines, cur = text.split(), [], ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if d.textlength(t, font=fnt) <= maxw:
            cur = t
        else:
            lines.append(cur); cur = w
    lines.append(cur)
    return lines


def spaced(d, xy, text, fnt, fill, spacing, anchor='mm'):
    total = sum(d.textlength(c, font=fnt) for c in text) + spacing * (len(text) - 1)
    x, y = xy
    x -= total / 2
    for c in text:
        d.text((x, y), c, font=fnt, fill=fill, anchor='lm')
        x += d.textlength(c, font=fnt) + spacing


def overlays(img, t):
    """Başlık, altyazı, mesaj kartı, bitiş yazısı."""
    lay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    # başlık
    if 0.5 <= t < 3.7:
        a = ease((t - 0.5) / 0.9) * (1 - ease((t - 2.9) / 0.8))
        al = int(255 * a)
        spaced(d, (W / 2, 330), 'MAKYAJ MASASININ SIRLARI'.replace('I', 'I'), font(F_SERIF_B, 52), (236, 196, 110, al), 6)
        d.line([(W / 2 - 230, 380), (W / 2 + 230, 380)], fill=(236, 196, 110, int(al * 0.7)), width=2)
        spaced(d, (W / 2, 430), 'BÖLÜM 1  ·  BİR DAMLA İHANET', font(F_SERIF_BI, 40), (255, 226, 200, al), 4)
    # altyazı
    sub = direct.subtitle_at(t)
    if sub:
        who, text = sub
        fnt = font(F_SERIF_B, 58)
        lines = wrap(text, fnt, 880, d)
        lh = 74
        hbox = lh * len(lines) + 62
        y0 = 250
        wmax = max(d.textlength(l, font=fnt) for l in lines) + 90
        d.rounded_rectangle((W / 2 - wmax / 2, y0, W / 2 + wmax / 2, y0 + hbox), radius=26, fill=(8, 4, 10, 150))
        col = NAME_COL[who]
        d.text((W / 2, y0 + 30), NAMES[who], font=font(F_SANS_B, 25), fill=col + (255,), anchor='mm')
        for i, l in enumerate(lines):
            d.text((W / 2 + 2, y0 + 62 + lh * i + lh / 2 + 2), l, font=fnt, fill=(0, 0, 0, 200), anchor='mm')
            d.text((W / 2, y0 + 62 + lh * i + lh / 2), l, font=fnt, fill=(255, 250, 244, 255), anchor='mm')
    # S5 mesaj kartı
    if 68.3 <= t < 73.6:
        k = ease_out((t - 68.3) / 0.35) * (1 - ease((t - 72.9) / 0.7))
        sc = 0.88 + 0.12 * ease_out((t - 68.3) / 0.4)
        cw, ch = 900 * sc, 330 * sc
        cx, cy = W / 2, 330
        al = int(255 * k)
        card = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        cd = ImageDraw.Draw(card)
        cd.rounded_rectangle((cx - cw / 2, cy - ch / 2, cx + cw / 2, cy + ch / 2), radius=44, fill=(14, 20, 38, int(215 * k)), outline=(150, 200, 255, int(200 * k)), width=3)
        cd.ellipse((cx - cw / 2 + 36, cy - ch / 2 + 34, cx - cw / 2 + 92, cy - ch / 2 + 90), fill=(60, 80, 120, al))
        cd.text((cx - cw / 2 + 64, cy - ch / 2 + 62), '?', font=font(F_SANS_B, 40), fill=(220, 235, 255, al), anchor='mm')
        cd.text((cx - cw / 2 + 112, cy - ch / 2 + 52), 'BİLİNMEYEN GÖNDERİCİ', font=font(F_SANS_B, 26), fill=(150, 200, 255, al), anchor='lm')
        cd.text((cx + cw / 2 - 36, cy - ch / 2 + 52), 'şimdi', font=font(F_SANS, 24), fill=(150, 170, 200, al), anchor='rm')
        cd.text((cx, cy + 22 * sc), 'Âşık olduğun adam', font=font(F_SERIF_B, 62 * sc), fill=(255, 255, 255, al), anchor='mm')
        cd.text((cx, cy + 96 * sc), 'sana yalan söylüyor.', font=font(F_SERIF_B, 62 * sc), fill=(255, 130, 150, al), anchor='mm')
        lay.alpha_composite(card)
    # bitiş
    if 83.2 <= t:
        a = ease((t - 83.2) / 0.8)
        spaced(d, (W / 2, 960), 'DEVAM EDECEK', font(F_SERIF_BI, 46), (236, 196, 110, int(220 * a)), 8)
    img.alpha_composite(lay)


# --------------------------------------------------------------------- ANA KARE
def render_frame(t, idx=0):
    init()
    cx, cy, z = direct.camera(t)
    cam = Cam(cx, cy, z)
    BG = G['bg']
    bgc = BG.resize((W, H), Image.BICUBIC, box=(cam.x0 * world.BGS, cam.y0 * world.BGS, (cam.x0 + W / z) * world.BGS, (cam.y0 + H / z) * world.BGS))
    canvas = bgc.convert('RGBA')
    A = G['actors']
    sts = {k: direct.state_of(a, t) for k, a in A.items()}

    # ayna içeriği (S5)
    if t >= 64.95:
        ml = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        blit_char(ml, cam, sts['lalin_m'], tint=(0.9, 0.95, 1.1), refl=False, wspr=300)
        rs = direct.state_of(A['ruya'], t - 0.2)
        rs = dict(rs); rs['name'] = 'ruya'; rs['x'] = 596; rs['y'] = 1064; rs['sc'] = 0.72; rs['clip'] = 9999
        rs['alpha'] = rs['alpha'] * 0.8
        blit_char(ml, cam, rs, tint=(0.78, 0.9, 1.15), refl=False, mirror=True, wspr=200)
        shine = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        sp_ = [cam.w2s(*p) for p in ((330, 140), (430, 140), (230, 1160), (110, 1160))]
        ImageDraw.Draw(shine).polygon(sp_, fill=(210, 225, 255, 26))
        ml.alpha_composite(shine)
        mm = G['mm'].resize((W, H), Image.BILINEAR, box=(cam.x0, cam.y0, cam.x0 + W / z, cam.y0 + H / z))
        a = ImageChops.multiply(ml.split()[3], mm)
        ml.putalpha(a)
        canvas.alpha_composite(ml)

    items = []
    for k in ('lalin', 'aras', 'ruya', 'mert'):
        st = sts[k]
        if st['alpha'] > 0.01:
            items.append(st)
    behind = sorted([s for s in items if s['layer'] == 'behind'], key=lambda s: s['y'])
    front = sorted([s for s in items if s['layer'] != 'behind'], key=lambda s: s['y'])
    WS = dict(ruya=150, aras=210, lalin=320, mert=210)
    for st in behind:
        shadow(canvas, cam, st, WS[st['name']])
        blit_char(canvas, cam, st, refl=False, wspr=WS[st['name']])
    # organizer ön yüzleri + çekmece
    of = G['of'].resize((W, H), Image.BICUBIC, box=(cam.x0 * 2, cam.y0 * 2, (cam.x0 + W / z) * 2, (cam.y0 + H / z) * 2))
    canvas.alpha_composite(of)
    dk = ease_io((t - 3.0) / 1.0)
    draw_drawer(canvas, cam, dk)
    for st in front:
        shadow(canvas, cam, st, WS[st['name']])
        blit_char(canvas, cam, st, wspr=WS[st['name']])
    if t >= 64.95 and t < 82.6:
        draw_rose_phone(canvas, cam, t)

    # ---- sayısal aşama: ışık, derecelendirme
    fr = np.asarray(canvas.convert('RGB'), np.float32)
    mult, cold, vig, lift = direct.grade(t)
    fr *= np.array(mult, np.float32)
    # bordo gölge kaldırma
    lt = 1 - fr * (1 / 255.0)
    lt *= lt
    fr += lt * (np.array([60, 6, 24], np.float32) * (lift * (1 - cold * 0.3)))
    del lt
    # ampul parıltısı
    lv = direct.bulb_levels(t)
    gbuf = np.zeros((H // 2, W // 2), np.float32)
    for i, (bx, by) in enumerate(G['bulbs']):
        if lv[i] <= 0.01:
            continue
        for blob, rad, gain in ((G['b_halo'], 110, 0.55), (G['b_core'], 22, 1.6)):
            x0, y0 = int(bx / 2 - rad), int(by / 2 - rad)
            n = blob.shape[0]
            xa, ya, xb, yb = max(0, x0), max(0, y0), min(W // 2, x0 + n), min(H // 2, y0 + n)
            if xa < xb and ya < yb:
                gbuf[ya:yb, xa:xb] += blob[ya - y0:yb - y0, xa - x0:xb - x0] * gain * lv[i]
    g_img = Image.fromarray(np.clip(gbuf * 255, 0, 255).astype(np.uint8))
    gz = g_img.resize((W, H), Image.BILINEAR, box=(cam.x0 / 2, cam.y0 / 2, (cam.x0 + W / z) / 2, (cam.y0 + H / z) / 2))
    gz = np.asarray(gz, np.float32) / 255
    warm = np.array([255, 205, 135], np.float32); coldc = np.array([120, 165, 255], np.float32)
    bcol = warm + (coldc - warm) * cold
    bgain = 0.62 if cold < 0.5 else 0.5
    fr += gz[..., None] * bcol * bgain * (1.0 if t < 82.5 else max(0, 1 - (t - 82.5) * 3))
    # Mert ekran ışığı (camgöbeği)
    ms = sts['mert']
    if ms['alpha'] > 0.01 and ms['expr']['glow'] > 0.01:
        mx, my = cam.w2s(ms['x'], ms['y'] - 190 * ms['sc'])
        pulse = 0.85 + 0.15 * math.sin(t * 5)
        add_blob(fr, G['cyan'], mx, my, 760 * z * ms['sc'], (70, 190, 255), 0.55 * ms['expr']['glow'] * pulse * ms['alpha'])
    # flaş
    if 42.0 <= t < 42.5:
        fr += 255 * ease_out(1 - (t - 42.0) / 0.5) * 0.9 * np.array([0.8, 0.95, 1.0], np.float32)
    # vinyet
    fr *= (1 - vig * G['r2'])[..., None]
    # film greni
    rs = np.random.RandomState(idx)
    gx, gy = rs.randint(0, 200), rs.randint(0, 200)
    fr += G['grain'][gy:gy + H, gx:gx + W][..., None] * 2.6
    # hafif kontrast eğrisi
    np.clip(fr, 0, 255, out=fr)
    out = Image.fromarray(fr.astype(np.uint8), 'RGB').convert('RGBA')
    overlays(out, t)
    return out.convert('RGB')


def save_range(args):
    a, b, outdir = args
    init()
    for i in range(a, b):
        im = render_frame(i / FPS, i)
        im.save(os.path.join(outdir, 'f%05d.jpg' % i), quality=95, subsampling=0)
    return b - a


if __name__ == '__main__':
    t0 = time.time()
    ts = [float(x) for x in sys.argv[2:]] or [5.0]
    outd = sys.argv[1]
    os.makedirs(outd, exist_ok=True)
    for t in ts:
        t1 = time.time()
        im = render_frame(t, int(t * 30))
        im.save(os.path.join(outd, 't%06.2f.png' % t))
        print(t, round(time.time() - t1, 2))
