"""Kare üretimi: Katlanmayanların İsyanı."""
import os, sys, math, time
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageChops
import clothes, world, direct
from style import *

W, H = 1080, 1920
SSUP = 1.35
FPS = direct.FPS
HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, '..', 'out')
G = {}


def init():
    if G:
        return
    p = os.path.join(CACHE, 'bg_cache.png')
    G['bg'] = Image.open(p).convert('RGB') if os.path.exists(p) else world.build_bg()
    if not os.path.exists(p):
        G['bg'].save(p)
    p = os.path.join(CACHE, 'pile_cache.png')
    G['pile'] = Image.open(p).convert('RGBA') if os.path.exists(p) else world.build_pile()
    if not os.path.exists(p):
        G['pile'].save(p)
    G['acts'] = direct.build()
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    G['r2'] = (((xx - W / 2) / (W / 2)) ** 2 * 0.8 + ((yy - H / 2) / (H / 2)) ** 2 * 0.9).astype(np.float32)
    G['xr'] = (xx / W).astype(np.float32)
    G['grain'] = np.random.RandomState(3).normal(0, 1, (H + 200, W + 200)).astype(np.float32)


class Cam:
    def __init__(self, cx, cy, z):
        self.cx, self.cy, self.z = cx, cy, z
        self.x0 = cx - W / z / 2; self.y0 = cy - H / z / 2

    def w2s(self, x, y):
        return (x - self.x0) * self.z, (y - self.y0) * self.z


def paste(canvas, im, x, y):
    x, y = int(x), int(y)
    if x >= 0 and y >= 0:
        canvas.alpha_composite(im, (x, y))
    else:
        canvas.paste(im, (x, y), im)


def lut_mul(band, k):
    return band.point([min(255, int(i * max(0, k))) for i in range(256)])


def shadow(canvas, cam, st, wspr):
    sx, sy = cam.w2s(st['x'], st['ground'] if st['name'] == 'sepet' else st['y'])
    z = cam.z
    rw, rh = wspr * 0.48 * z, 16 * z
    pad = int(rw * 0.5 + 16)
    box = (int(sx - rw - pad), int(sy - rh * 2 - pad), int(sx + rw + pad), int(sy + rh * 2 + pad))
    if box[2] < 0 or box[0] > W or box[3] < 0 or box[1] > H:
        return
    lay = Image.new('RGBA', (box[2] - box[0], box[3] - box[1]), (0, 0, 0, 0))
    ImageDraw.Draw(lay).ellipse((pad, pad + rh * 1.2, pad + 2 * rw, pad + rh * 3.2), fill=(0, 0, 0, 120))
    paste(canvas, lay.filter(ImageFilter.GaussianBlur(max(2, 6 * z))), box[0], box[1])


def blit_char(canvas, cam, st):
    if st['alpha'] <= 0.01:
        return
    z = cam.z * st['sc']
    Sq = min(3.2, max(0.5, round(z * SSUP / 0.1) * 0.1))
    spr, (ax, ay) = clothes.render(st['name'], Sq, st['expr'])
    th = math.radians(st['tilt'])
    sxk, syk = max(0.2, st['sx']), max(0.2, st['sy'])
    c, s_ = math.cos(th), math.sin(th)
    f = z / Sq
    bb = spr.getbbox()
    mg = 0.5 * max(bb[2] - bb[0], bb[3] - bb[1]) * min(1.0, abs(math.sin(th)) + 0.15)
    reach = max(abs(bb[0] - ax), abs(bb[2] - ax), abs(bb[1] - ay), abs(bb[3] - ay))
    ox0 = int((ax - reach - 4) * f); oy0 = int((ay - reach - 4) * f)
    ox1 = int((ax + reach + 4) * f); oy1 = int((ay + min(reach, 60 + abs(math.sin(th)) * reach) + 4) * f)
    nw, nh = max(2, ox1 - ox0), max(2, oy1 - oy0)
    a_ = c / (f * sxk); b_ = s_ / (f * sxk); d_ = -s_ / (f * syk); e_ = c / (f * syk)
    c0 = ax - (c * ax + s_ * ay) / sxk; f0 = ay - (-s_ * ax + c * ay) / syk
    spr = spr.transform((nw, nh), Image.AFFINE, (a_, b_, c0 + a_ * ox0 + b_ * oy0, d_, e_, f0 + d_ * ox0 + e_ * oy0), resample=Image.BICUBIC)
    bx, by = cam.w2s(st['x'], st['y'])
    px, py = int(bx - ax * f) + ox0, int(by - ay * f) + oy0
    if px > W or py > H or px + nw < 0 or py + nh < 0:
        return
    paste(canvas, spr, px, py)


def draw_legs(canvas, cam, st):
    if st['legs'] < 0.01:
        return
    lay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    z = cam.z
    for side in (-1, 1):
        top = cam.w2s(st['x'] + side * 80, st['y'] - 10)
        bot = cam.w2s(st['x'] + side * 92, st['ground'])
        d.line([top, bot], fill=(90, 56, 22, 255), width=int(26 * z))
        d.line([(top[0] - 4 * z, top[1]), (bot[0] - 4 * z, bot[1])], fill=(200, 150, 90, 255), width=int(8 * z))
        d.ellipse((bot[0] - 26 * z, bot[1] - 12 * z, bot[0] + 30 * z, bot[1] + 10 * z), fill=(70, 40, 16, 255))
    canvas.alpha_composite(lay)


def draw_pile(canvas, cam, t):
    dx, dy, rot = direct.pile_offset(t)
    x0, y0, x1, y1 = world.PILE_BOX
    sa = cam.w2s(x0 + dx, y0 + dy)
    sw, sh = (x1 - x0) * cam.z, (y1 - y0) * cam.z
    if sa[0] > W or sa[1] > H or sa[0] + sw < 0 or sa[1] + sh < 0:
        return
    pile = G['pile']
    # yalnızca görünen bölgeyi yeniden örnekle
    vx0, vy0 = max(0, -sa[0]), max(0, -sa[1])
    vx1, vy1 = min(sw, W - sa[0]), min(sh, H - sa[1])
    if vx1 <= vx0 or vy1 <= vy0:
        return
    k = pile.size[0] / sw
    part = pile.resize((int(vx1 - vx0), int(vy1 - vy0)), Image.BICUBIC, box=(vx0 * k, vy0 * k, vx1 * k, vy1 * k))
    if rot:
        part = part.rotate(-rot, resample=Image.BICUBIC, center=(part.size[0] / 2, part.size[1]))
    # yığın havadayken koltuğa gölge
    if dy < -5:
        shb = cam.w2s(x0 + dx + 60, world.SEAT_Y - 30)
        lay = Image.new('RGBA', (int(sw * 0.9), int(80 * cam.z)), (0, 0, 0, 0))
        ImageDraw.Draw(lay).ellipse((0, 0, lay.size[0], lay.size[1]), fill=(0, 0, 0, int(min(110, -dy))))
        paste(canvas, lay.filter(ImageFilter.GaussianBlur(14 * cam.z)), shb[0], shb[1])
    paste(canvas, part, sa[0] + vx0, sa[1] + vy0)


def draw_hands(canvas, cam, t):
    hd = direct.hands(t)
    if not hd:
        return
    L, R, grip = hd
    z = cam.z * 1.8
    lay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    for side, (hx_, hy_) in ((-1, L), (1, R)):
        hs = cam.w2s(hx_, hy_)
        top = cam.w2s(hx_ + side * 220, hy_ - 1400)
        # kol (gri kapüşonlu kol)
        d.line([top, (hs[0] + side * 30 * z, hs[1] - 80 * z)], fill=(88, 92, 104, 255), width=int(150 * z))
        d.line([(top[0] - side * 40 * z, top[1]), (hs[0] + side * 4 * z, hs[1] - 80 * z)], fill=(128, 134, 148, 255), width=int(40 * z))
        d.ellipse((hs[0] - 62 * z + side * 30 * z, hs[1] - 120 * z, hs[0] + 62 * z + side * 30 * z, hs[1] - 50 * z), fill=(70, 74, 86, 255))
        # el (cilt)
        skin, dark = (236, 184, 150, 255), (190, 130, 100, 255)
        d.ellipse((hs[0] - 58 * z, hs[1] - 70 * z, hs[0] + 58 * z, hs[1] + 30 * z), fill=dark)
        d.ellipse((hs[0] - 54 * z, hs[1] - 68 * z, hs[0] + 54 * z, hs[1] + 24 * z), fill=skin)
        for i in range(4):
            fx = hs[0] - side * (-36 + i * 22) * z
            fl = (52 if grip < 0.5 else 30) * z
            d.rounded_rectangle((fx - 11 * z, hs[1] - 10 * z, fx + 11 * z, hs[1] + fl), radius=11 * z, fill=skin, outline=dark, width=max(1, int(2 * z)))
        tx = hs[0] + side * 62 * z
        d.rounded_rectangle((tx - 12 * z, hs[1] - 46 * z, tx + 12 * z, hs[1] + 6 * z), radius=12 * z, fill=skin, outline=dark, width=max(1, int(2 * z)))
    canvas.alpha_composite(lay)


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


def overlays(img, t):
    lay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    if 0.25 <= t < 2.75:
        a = ease((t - 0.25) / 0.5) * (1 - ease((t - 2.3) / 0.45))
        al = int(255 * a)
        pop = 0.9 + 0.1 * ease_out((t - 0.25) / 0.4)
        d.rounded_rectangle((W / 2 - 430, 250, W / 2 + 430, 520), radius=40, fill=(20, 16, 30, int(170 * a)))
        d.text((W / 2, 330), 'İNSANLAR GİDİNCE', font=font(F_SANS_B, 74 * pop), fill=(255, 210, 80, al), anchor='mm',
               stroke_width=5, stroke_fill=(60, 30, 10, al))
        d.text((W / 2, 438), 'KATLANMAYANLARIN İSYANI', font=font(F_SERIF_BI, 50 * pop), fill=(255, 255, 255, al), anchor='mm',
               stroke_width=3, stroke_fill=(40, 20, 50, al))
    subs = direct.subtitles_at(t)
    y = 180
    for who, text in subs:
        big = len(subs) == 1
        fnt = font(F_SANS_B, 54 if big else 44)
        lines = wrap(text, fnt, 900, d)
        lh = 64 if big else 54
        wmax = max(d.textlength(l, font=fnt) for l in lines) + 70
        hbox = lh * len(lines) + 56
        d.rounded_rectangle((W / 2 - wmax / 2, y, W / 2 + wmax / 2, y + hbox), radius=24, fill=(10, 8, 16, 165))
        d.text((W / 2, y + 26), direct.NAMES[who], font=font(F_SANS_B, 24), fill=direct.NAME_COL[who] + (255,), anchor='mm')
        for i, l in enumerate(lines):
            d.text((W / 2, y + 50 + lh * i + lh / 2), l, font=fnt, fill=(255, 252, 245, 255), anchor='mm',
                   stroke_width=2, stroke_fill=(0, 0, 0, 200))
        y += hbox + 14
    if 56.3 <= t < 58.0:
        a = ease((t - 56.3) / 0.3) * (1 - ease((t - 57.7) / 0.3))
        d.text((W / 2, 330), '( cırcır böceği )', font=font(F_SERIF_BI, 46), fill=(220, 230, 255, int(220 * a)), anchor='mm')
    if t >= 59.55:
        d.rectangle((0, 0, W, H), fill=(14, 10, 20, 255))
        k = ease_out((t - 59.6) / 0.35)
        d.text((W / 2, 820), 'İNSANLAR GİDİNCE', font=font(F_SANS_B, int(78 * (0.8 + 0.2 * k))), fill=(255, 210, 80, int(255 * k)),
               anchor='mm', stroke_width=5, stroke_fill=(60, 30, 10, int(255 * k)))
        d.text((W / 2, 930), 'Katlanmayanların İsyanı', font=font(F_SERIF_BI, 52), fill=(255, 255, 255, int(255 * k)), anchor='mm')
        if t > 60.6:
            k2 = ease((t - 60.6) / 0.5)
            d.text((W / 2, 1080), 'Kıyafetler katlanmadı. İsyan sürüyor…', font=font(F_SANS, 36), fill=(200, 200, 220, int(255 * k2)), anchor='mm')
    img.alpha_composite(lay)


def render_frame(t, idx=0):
    init()
    if t >= 59.55:
        out = Image.new('RGBA', (W, H), (0, 0, 0, 255))
        overlays(out, t)
        return out.convert('RGB')
    cx, cy, z = direct.camera(t)
    cam = Cam(cx, cy, z)
    canvas = G['bg'].resize((W, H), Image.BICUBIC, box=(cam.x0 * 2, cam.y0 * 2, (cam.x0 + W / z) * 2, (cam.y0 + H / z) * 2)).convert('RGBA')
    sts = [direct.state_of(a, t) for a in G['acts'].values()]
    floor = [s for s in sts if s['name'] == 'sepet']
    others = sorted([s for s in sts if s['name'] != 'sepet'], key=lambda s: s['ground'])
    draw_pile(canvas, cam, t)
    for st in others:
        if st['name'] in ('corapA', 'pantolon', 'corapB'):
            shadow(canvas, cam, st, clothes.WIDTH[st['name']])
        blit_char(canvas, cam, st)
    for st in floor:
        shadow(canvas, cam, st, clothes.WIDTH['sepet'])
        draw_legs(canvas, cam, st)
        blit_char(canvas, cam, st)
    draw_hands(canvas, cam, t)
    fr = np.asarray(canvas.convert('RGB'), np.float32)
    # sıcak akşam derecelendirmesi
    mult = np.array([1.02, 0.98, 0.92], np.float32)
    if 0 <= t < 0.6:
        mult = mult * (t / 0.6)
    if 32.65 <= t < 33.2:   # "YETER" kırmızı flaş
        k = 1 - (t - 32.65) / 0.55
        fr += np.array([90, 10, 0], np.float32) * k
    if 55.6 <= t < 58.2:
        mult = mult * np.array([0.9, 0.95, 1.05], np.float32)
    fr *= mult
    sh = direct.human_shadow(t)
    if sh > 0.001:
        fr *= (1 - sh * np.clip(G['xr'] * 1.6 - 0.2, 0, 1))[..., None]
    fr *= (1 - 0.32 * G['r2'])[..., None]
    rs = np.random.RandomState(idx)
    gx, gy = rs.randint(0, 200), rs.randint(0, 200)
    fr += G['grain'][gy:gy + H, gx:gx + W][..., None] * 1.6
    np.clip(fr, 0, 255, out=fr)
    out = Image.fromarray(fr.astype(np.uint8), 'RGB').convert('RGBA')
    overlays(out, t)
    return out.convert('RGB')


def save_range(args):
    a, b, outdir = args
    init()
    for i in range(a, b):
        render_frame(i / FPS, i).save(os.path.join(outdir, 'f%05d.jpg' % i), quality=93)
    return b - a


if __name__ == '__main__':
    outd = sys.argv[1]
    os.makedirs(outd, exist_ok=True)
    for tt in [float(x) for x in sys.argv[2:]]:
        t1 = time.time()
        render_frame(tt, int(tt * 30)).save(os.path.join(outd, 't%06.2f.png' % tt))
        print(tt, round(time.time() - t1, 2))
