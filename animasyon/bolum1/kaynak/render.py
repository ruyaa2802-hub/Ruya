# -*- coding: utf-8 -*-
"""Kare oluşturucu: sahne geçişleri, suluboya/kâğıt dokusu, film greni,
altyazılar ve yazı kartları. Paralel olarak ffmpeg'e segment yazar.

Kullanım:  python3 render.py frames 12.5 36 ...   (test kareleri)
           python3 render.py video  [işçi sayısı]
"""
import math
import os
import subprocess
import sys

import cairo
import numpy as np
from PIL import Image, ImageFilter

import core
from core import G, W, H, FPS, clamp, ramp, ease, hn
import scenes as S
from timing import SUBS

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'build')
os.makedirs(OUT, exist_ok=True)

SERIF = 'FreeSerif'


# =============================================================== dokular
def _noise(shape, scale, seed):
    rng = np.random.default_rng(seed)
    h, w = shape
    small = rng.random((max(2, h // scale + 2), max(2, w // scale + 2))).astype(np.float32)
    im = Image.fromarray((small * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
    return np.asarray(im, dtype=np.float32) / 255.0


def make_paper():
    p = (_noise((H, W), 3, 1) * 0.35 + _noise((H, W), 12, 2) * 0.3 + _noise((H, W), 60, 3) * 0.25 +
         _noise((H, W), 300, 4) * 0.10)
    p = (p - p.mean()) / (p.std() + 1e-6)
    paper = 1.0 + p * 0.035
    # lifler
    rng = np.random.default_rng(9)
    im = Image.new('L', (W, H), 0)
    from PIL import ImageDraw
    d = ImageDraw.Draw(im)
    for _ in range(500):
        x, y = rng.random() * W, rng.random() * H
        a = rng.random() * math.pi
        L = 10 + rng.random() * 40
        d.line([(x, y), (x + math.cos(a) * L, y + math.sin(a) * L)], fill=int(40 + rng.random() * 60), width=1)
    fib = np.asarray(im.filter(ImageFilter.GaussianBlur(0.7)), dtype=np.float32) / 255.0
    paper = paper - fib * 0.05
    # vinyet
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    r = np.sqrt(((xx - W / 2) / (W * 0.62)) ** 2 + ((yy - H / 2) / (H * 0.62)) ** 2)
    vig = 1.0 - 0.38 * np.clip(r - 0.35, 0, 1) ** 1.6
    return paper.astype(np.float32), vig.astype(np.float32)


PAPER = None
VIG = None
GRAINS = None


def _init_tex():
    global PAPER, VIG, GRAINS
    if PAPER is None:
        PAPER, VIG = make_paper()
        rng = np.random.default_rng(42)
        GRAINS = [rng.normal(0, 1, (H // 2, W // 2)).astype(np.float32) for _ in range(6)]


# =============================================================== yardımcılar
def new_surface():
    sf = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
    return sf, cairo.Context(sf)


def to_np(sf):
    sf.flush()
    a = np.ndarray((H, W, 4), np.uint8, sf.get_data()).copy()
    return a[:, :, [2, 1, 0]].astype(np.float32) / 255.0


def bloom(img, strength=0.35, thr=0.72):
    lum = img.max(axis=2, keepdims=True)
    hi = np.clip((lum - thr) / (1 - thr), 0, 1) * img
    im = Image.fromarray((np.clip(hi, 0, 1) * 255).astype(np.uint8)).resize((W // 6, H // 6), Image.BILINEAR)
    im = im.filter(ImageFilter.GaussianBlur(8)).resize((W, H), Image.BILINEAR)
    b = np.asarray(im, dtype=np.float32) / 255.0
    return img + b * strength


def render_scene(fn, t, *a, **kw):
    sf, ctx = new_surface()
    G.alpha = 1.0
    G.night = 0.0
    G.warm = 0.0
    fn(ctx, t, *a, **kw)
    return to_np(sf)


# =============================================================== sahneler
def street_img(t):
    return render_scene(S.scene_street, t)


def reverse_img(t):
    img = render_scene(S.scene_reverse, t)
    fg = S.reverse_fg_layer(t)
    fg.flush()
    a = np.ndarray((H // 3, W // 3, 4), np.uint8, fg.get_data()).copy()
    im = Image.fromarray(a[:, :, [2, 1, 0, 3]], 'RGBA').filter(ImageFilter.GaussianBlur(5)).resize((W, H), Image.BILINEAR)
    f = np.asarray(im, dtype=np.float32) / 255.0
    al = f[:, :, 3:4]
    rgb = f[:, :, :3]  # premultiplied
    img = img * (1 - al) + rgb
    return bloom(img, 0.15, 0.85)


def dream_img(t, fade_people=1.0):
    img = render_scene(S.scene_dream, t, fade_people)
    img = bloom(img, 0.3, 0.8)
    return img


def return_img(t):
    return render_scene(S.scene_street, t, cam=S.return_cam(t), girl_override=S.return_state)


def persp_img(t):
    sf, ctx = new_surface()
    S.persp_scene(ctx, t)
    return to_np(sf)


# =============================================================== yazılar
def _text_extents(ctx, s):
    return ctx.text_extents(s)


def wrap(ctx, text, maxw):
    words = text.split(' ')
    lines, cur = [], ''
    for w_ in words:
        tst = (cur + ' ' + w_).strip()
        if ctx.text_extents(tst).x_advance > maxw and cur:
            lines.append(cur)
            cur = w_
        else:
            cur = tst
    if cur:
        lines.append(cur)
    return lines


def draw_subtitles(ctx, t):
    for (a, b, text, kind) in SUBS:
        if not (a - 0.1 < t < b + 0.8):
            continue
        out = 1 - ramp(t, b, b + 0.7)
        ctx.save()
        italic = cairo.FONT_SLANT_ITALIC
        size = 50 if kind == 'n' else 52
        ctx.select_font_face(SERIF, italic, cairo.FONT_WEIGHT_NORMAL)
        ctx.set_font_size(size)
        lines = wrap(ctx, text, 840)
        lh = size * 1.32
        y0 = 1700 - (len(lines) - 1) * lh / 2
        # yumuşak koyu zemin
        band = cairo.RadialGradient(W / 2, y0 + (len(lines) - 1) * lh / 2, 30, W / 2, y0 + (len(lines) - 1) * lh / 2, 620)
        band.add_color_stop_rgba(0, 0.03, 0.04, 0.10, 0.42 * out * ramp(t, a - 0.1, a + 0.5))
        band.add_color_stop_rgba(1, 0.03, 0.04, 0.10, 0)
        ctx.save()
        ctx.translate(0, 0)
        ctx.set_source(band)
        ctx.rectangle(0, y0 - 260, W, len(lines) * lh + 420)
        ctx.fill()
        ctx.restore()
        # kelime kelime beliren metin (anlatım ritmi)
        nwords = len(text.split(' '))
        dur = max(1.2, (b - a) * 0.62)
        per = dur / nwords
        wi = 0
        for li, line in enumerate(lines):
            ws = line.split(' ')
            total = ctx.text_extents(line).x_advance
            x = W / 2 - total / 2
            y = y0 + li * lh
            for w_ in ws:
                k = clamp((t - a - wi * per) / 0.45) * out
                k = k * k * (3 - 2 * k)
                adv = ctx.text_extents(w_ + ' ').x_advance
                if k > 0:
                    dy = (1 - k) * 10
                    # gölge
                    for ox, oy, al in ((0, 3, 0.35), (2, 4, 0.2), (-2, 4, 0.2)):
                        ctx.move_to(x + ox, y + dy + oy)
                        ctx.set_source_rgba(0.02, 0.03, 0.08, al * k)
                        ctx.show_text(w_)
                    ctx.move_to(x, y + dy)
                    if kind == 'n':
                        ctx.set_source_rgba(0.97, 0.93, 0.85, k)
                    else:
                        ctx.set_source_rgba(1.0, 0.86, 0.62, k)
                    ctx.show_text(w_)
                x += adv
                wi += 1
        if kind == 'c':
            # küçük konuşmacı işareti: kızın sesi
            ctx.select_font_face(SERIF, cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_NORMAL)
            ctx.set_font_size(30)
            lab = '— küçük kız, fısıltıyla —'
            e = ctx.text_extents(lab)
            ctx.move_to(W / 2 - e.x_advance / 2, y0 + len(lines) * lh + 4)
            ctx.set_source_rgba(1.0, 0.86, 0.62, 0.55 * clamp((t - a) / 0.6) * out)
            ctx.show_text(lab)
        ctx.restore()


def spaced(ctx, text, cx, y, spacing):
    widths = [ctx.text_extents(ch).x_advance for ch in text]
    total = sum(widths) + spacing * (len(text) - 1)
    x = cx - total / 2
    for ch, w_ in zip(text, widths):
        ctx.move_to(x, y)
        ctx.show_text(ch)
        x += w_ + spacing


def card_img(t):
    sf, ctx = new_surface()
    p = cairo.RadialGradient(W / 2, H * 0.45, 50, W / 2, H * 0.45, 1300)
    p.add_color_stop_rgb(0, 0.10, 0.12, 0.21)
    p.add_color_stop_rgb(1, 0.03, 0.035, 0.07)
    ctx.set_source(p)
    ctx.paint()
    if t < S.T_TITLE:
        lt = t - S.T_QUOTE
        k_out = 1 - ramp(t, S.T_TITLE - 1.3, S.T_TITLE - 0.2)
        lines = ["Belki de bazı çocuklar,", "çocukluklarını yaşamak yerine", "kendi dünyalarını kurmak",
                 "zorunda kalır."]
        ctx.select_font_face(SERIF, cairo.FONT_SLANT_ITALIC, cairo.FONT_WEIGHT_NORMAL)
        ctx.set_font_size(60)
        for i, ln in enumerate(lines):
            k = clamp((lt - 0.4 - i * 0.9) / 1.2) * k_out
            k = ease(k)
            e = ctx.text_extents(ln)
            y = 830 + i * 92 + (1 - k) * 14
            ctx.move_to(W / 2 - e.x_advance / 2, y)
            ctx.set_source_rgba(0.96, 0.92, 0.84, k)
            ctx.show_text(ln)
        # küçük sıcak ışık (bir pencere)
        k = ease(clamp((lt - 4.0) / 1.5)) * k_out
        core.glow(ctx, W / 2, 1290, 90, '#ffcf80', a=0.35 * k)
        ctx.set_source_rgba(1.0, 0.85, 0.55, 0.9 * k)
        ctx.rectangle(W / 2 - 14, 1272, 28, 36)
        ctx.fill()
        ctx.set_source_rgba(0.10, 0.12, 0.21, k)
        ctx.rectangle(W / 2 - 1.5, 1272, 3, 36)
        ctx.rectangle(W / 2 - 14, 1286, 28, 3)
        ctx.fill()
    else:
        lt = t - S.T_TITLE
        k_all = 1 - ramp(t, S.T_END - 1.6, S.T_END - 0.1)
        k1 = ease(clamp((lt - 0.3) / 1.6)) * k_all
        k2 = ease(clamp((lt - 1.6) / 1.4)) * k_all
        # ev ışığı + başlık
        core.glow(ctx, W / 2, 760, 300, '#ffcf80', a=0.22 * k1)
        ctx.set_source_rgba(1.0, 0.85, 0.55, 0.95 * k1)
        ctx.rectangle(W / 2 - 22, 720, 44, 56)
        ctx.fill()
        ctx.set_source_rgba(0.08, 0.09, 0.16, k1)
        ctx.rectangle(W / 2 - 2, 720, 4, 56)
        ctx.rectangle(W / 2 - 22, 742, 44, 4)
        ctx.fill()
        ctx.select_font_face(SERIF, cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_NORMAL)
        ctx.set_font_size(76)
        ctx.set_source_rgba(0.97, 0.93, 0.85, k1)
        spaced(ctx, "BENİM KÜÇÜK", W / 2, 920, 10)
        spaced(ctx, "DÜNYAM", W / 2, 1015, 14)
        ctx.set_source_rgba(1.0, 0.85, 0.6, 0.7 * k2)
        ctx.rectangle(W / 2 - 90 * k2, 1068, 180 * k2, 2)
        ctx.fill()
        ctx.select_font_face(SERIF, cairo.FONT_SLANT_ITALIC, cairo.FONT_WEIGHT_NORMAL)
        ctx.set_font_size(42)
        ctx.set_source_rgba(0.96, 0.9, 0.8, k2)
        for i, ln in enumerate(["1. Bölüm", "Başkalarının Evindeki Işıklar"]):
            e = ctx.text_extents(ln)
            ctx.move_to(W / 2 - e.x_advance / 2, 1140 + i * 62)
            ctx.show_text(ln)
    return to_np(sf)


# =============================================================== kompozisyon
def compose(t):
    G.t = t
    G.boil = int(t * 8)
    fx = None
    if t < S.T_REV:
        img = street_img(t)
    elif t < S.T_REV + 1.1:
        k = ease((t - S.T_REV) / 1.1)
        img = street_img(t) * (1 - k) + reverse_img(t) * k
    elif t < S.T_DREAM - 0.9:
        img = reverse_img(t)
    elif t < S.T_DREAM + 0.7:
        k = ease((t - (S.T_DREAM - 0.9)) / 1.6)
        img = reverse_img(min(t, S.T_DREAM)) * (1 - k) + dream_img(t) * k
        flash = math.sin(math.pi * k) ** 2
        img = img + np.array([1.0, 0.85, 0.55], np.float32) * 0.45 * flash
    elif t < S.T_BACK:
        img = dream_img(t)
    elif t < S.T_RET + 0.4:
        k = (t - S.T_BACK) / (S.T_RET + 0.4 - S.T_BACK)
        fp = 1 - ease(k * 1.4)
        d = dream_img(t, fp)
        sf, ctx = new_surface()
        S.dream_particles(ctx, t, k)
        part = to_np(sf)
        r = return_img(t)
        kk = ease(clamp((k - 0.25) / 0.75))
        # hayalin rengi soluyor
        gray = d.mean(axis=2, keepdims=True)
        d = d * (1 - 0.4 * k) + gray * 0.4 * k
        img = d * (1 - kk) + r * kk + part * (1 - kk * 0.6)
    elif t < S.T_PERSP - 0.8:
        img = return_img(t)
    elif t < S.T_PERSP + 0.6:
        k = ease((t - (S.T_PERSP - 0.8)) / 1.4)
        img = return_img(t) * (1 - k) + persp_img(t) * k
    elif t < S.T_FADE + 0.2:
        img = persp_img(t)
        img = img * (1 - ramp(t, S.T_FADE - 3.0, S.T_FADE))
    elif t < S.T_QUOTE:
        img = np.zeros((H, W, 3), np.float32)
    else:
        img = card_img(t)
        img = img * ramp(t, S.T_QUOTE, S.T_QUOTE + 0.5)
    # açılış: karanlıktan
    if t < 2.2:
        img = img * ramp(t, 0.0, 2.2)
    return img


def finish(img, t, fi):
    _init_tex()
    img = img * PAPER[:, :, None] * VIG[:, :, None]
    # pigment granülasyonu: koyu alanlarda biraz daha belirgin
    g = GRAINS[fi % len(GRAINS)]
    g = np.repeat(np.repeat(g, 2, axis=0), 2, axis=1)
    img = img + g[:, :, None] * 0.022
    # çok hafif film tonu
    img = np.clip(img, 0, 1)
    img = img ** np.array([0.98, 1.0, 1.02], np.float32)
    return (np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8)


def overlay_text(img8, t):
    sf = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
    ctx = cairo.Context(sf)
    draw_subtitles(ctx, t)
    sf.flush()
    a = np.ndarray((H, W, 4), np.uint8, sf.get_data())
    al = a[:, :, 3:4].astype(np.float32) / 255.0
    if al.max() == 0:
        return img8
    rgb = a[:, :, [2, 1, 0]].astype(np.float32)
    out = img8.astype(np.float32) * (1 - al) + rgb
    return np.clip(out, 0, 255).astype(np.uint8)


def frame(fi):
    t = fi / FPS
    img = compose(t)
    img8 = finish(img, t, fi)
    return overlay_text(img8, t)


# =============================================================== çalıştırma
def render_segment(args):
    seg, f0, f1 = args
    path = os.path.join(OUT, 'seg_%02d.mp4' % seg)
    cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '%dx%d' % (W, H),
           '-r', str(FPS), '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p',
           '-tune', 'film', path]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for fi in range(f0, f1):
        p.stdin.write(frame(fi).tobytes())
        if fi % 48 == 0:
            print('seg', seg, 'frame', fi, flush=True)
    p.stdin.close()
    p.wait()
    return path


if __name__ == '__main__':
    mode = sys.argv[1]
    if mode == 'frames':
        for a in sys.argv[2:]:
            t = float(a)
            Image.fromarray(frame(int(round(t * FPS)))).save(os.path.join(OUT, 'f_%06.2f.png' % t))
            print('ok', t)
    elif mode == 'video':
        from multiprocessing import Pool
        nw = int(sys.argv[2]) if len(sys.argv) > 2 else 4
        total = int(S.T_END * FPS)
        nseg = nw * 3
        b = [int(total * i / nseg) for i in range(nseg + 1)]
        jobs = [(i, b[i], b[i + 1]) for i in range(nseg)]
        with Pool(nw) as pool:
            paths = pool.map(render_segment, jobs, chunksize=1)
        with open(os.path.join(OUT, 'segs.txt'), 'w') as f:
            for p_ in paths:
                f.write("file '%s'\n" % p_)
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i',
                        os.path.join(OUT, 'segs.txt'), '-c', 'copy', os.path.join(OUT, 'video_sessiz.mp4')], check=True)
        print('bitti')
