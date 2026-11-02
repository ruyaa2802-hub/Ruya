"""Post-production: upscale the Blender frames to 1080×1920 and draw the crisp text layer
(subtitles with highlighted keywords, titles, the body/tongue ruler, cut-away labels,
energy meter, chips) with Pillow, then pipe the frames into ffmpeg.

  python3 post.py                      → out/video_noaudio.mp4
  python3 post.py --stills 6.5,16,24   → out/post_<t>.png (check the overlay)
"""
import json
import math
import os
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.abspath(__file__))
W, H, FPS, DURATION = 1080, 1920, 30, 38.0
N_OFF = 0.4
F = '/usr/share/fonts/opentype/inter/'
font = lambda w, s: ImageFont.truetype(F + {'b': 'Inter-Bold.otf', 's': 'Inter-SemiBold.otf', 'x': 'InterDisplay-Black.otf', 'eb': 'Inter-ExtraBold.otf'}[w], s)
FS, FB, FEB = font('s', 46), font('b', 46), font('eb', 40)
LOGO = Image.open(os.path.join(ROOT, 'assets/logo.png')).convert('RGBA').resize((84, 84))

YEL = (255, 210, 63)
PINK = (255, 111, 154)

# subtitle chunks: (start, end, text with *keywords*) — timings from audio/words.json (+0.4 s)
SUBS = [
    (0.40, 1.95, 'Bu sevimli *bukalemunun*'), (1.96, 3.40, 'en büyük *silahı* ne biliyor musun?'), (3.70, 4.40, '*Dili!*'),
    (4.60, 6.90, '*Bukalemunların dili*, vücut uzunluklarının'), (6.92, 9.10, 'yaklaşık *iki katına* kadar uzanabiliyor!'),
    (9.30, 11.80, 'Bazı *küçük türlerde* bu oran daha da fazla.'),
    (12.10, 13.90, 'Peki nasıl bu kadar *hızlı?*'), (14.20, 16.95, 'Dilindeki özel *elastik dokular* enerji depoluyor.'),
    (17.30, 19.10, 'Bu enerji *bir anda* serbest kalıyor'), (19.12, 21.70, 've dil adeta bir *mancınık* gibi fırlıyor!'),
    (22.10, 23.85, 'Dilinin ucundaki *yapışkan yüzey*'), (23.87, 25.90, 'avını yakalamasına yardımcı oluyor.'),
    (25.95, 27.25, 'Üstelik bütün bu hareket'), (27.26, 29.15, '*göz açıp kapayıncaya* kadar gerçekleşiyor!'),
    (29.35, 31.95, 'Doğanın en *hızlı avcılarından* biri!'), (32.25, 33.50, 'Peki sen,'), (33.52, 35.30, 'böyle bir dile sahip olmak *ister miydin?*'),
]


def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def ss(a, b, x):
    u = clamp((x - a) / (b - a))
    return u * u * (3 - 2 * u)


def win(t, a, b, r=0.2):
    return ss(a, a + r, t) * (1 - ss(b - r, b, t))


def bounce(t, a):
    u = clamp((t - a) / 0.45)
    return 1 if u >= 1 else 1 + math.sin(u * math.pi * 2.2) * math.exp(-u * 4) * 0.25 - (1 - u) ** 3 * 0.9


def rich_line(d, x, y, text, fnt, fntb, fill=(255, 255, 255), hl=YEL, anchor_center=True):
    """Draw text with *keyword* spans highlighted; returns the width."""
    parts = text.split('*')
    widths = [d.textlength(p, font=(fntb if i % 2 else fnt)) for i, p in enumerate(parts)]
    tw = sum(widths)
    cx = x - tw / 2 if anchor_center else x
    for i, p in enumerate(parts):
        d.text((cx, y), p, font=(fntb if i % 2 else fnt), fill=(hl if i % 2 else fill))
        cx += widths[i]
    return tw


def draw_sub(img, t):
    for a, b, txt in SUBS:
        if a - 0.06 <= t < b + 0.1:
            k = win(t, a - 0.06, b + 0.1, 0.06)
            layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
            d = ImageDraw.Draw(layer)
            plain = txt.replace('*', '')
            tw = d.textlength(plain, font=FB)
            # wrap long lines in two
            lines = [txt]
            if tw > 900:
                words = txt.split(' ')
                best = None
                for i in range(1, len(words)):
                    l1, l2 = ' '.join(words[:i]), ' '.join(words[i:])
                    if l1.count('*') % 2:
                        continue
                    w1, w2 = d.textlength(l1.replace('*', ''), font=FB), d.textlength(l2.replace('*', ''), font=FB)
                    sc = max(w1, w2)
                    if best is None or sc < best[0]:
                        best = (sc, [l1, l2])
                lines = best[1] if best else [txt]
            lh = 58
            boxw = max(d.textlength(l.replace('*', ''), font=FB) for l in lines) + 56
            boxh = lh * len(lines) + 26
            y0 = H - 430 - boxh
            d.rounded_rectangle([W / 2 - boxw / 2, y0, W / 2 + boxw / 2, y0 + boxh], 22, fill=(16, 40, 18, int(160 * k)))
            for i, l in enumerate(lines):
                rich_line(d, W / 2, y0 + 10 + i * lh, l, FS, FB, fill=(255, 255, 255, int(255 * k)), hl=(*YEL, int(255 * k)))
            img.alpha_composite(layer)
            return


def big_title(img, t, a, b, lines, size=96, y=250, colors=((255, 245, 168), (255, 140, 30))):
    k = win(t, a, b, 0.2)
    if k <= 0.001:
        return
    sc = bounce(t, a) * (1 + 0.02 * math.sin(t * 5))
    f = font('x', int(size * sc))
    layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    yy = y
    for line in lines:
        tw = d.textlength(line, font=f)
        x = W / 2 - tw / 2
        # drop shadow + stroke + vertical gradient fill
        d.text((x + 6, yy + 8), line, font=f, fill=(10, 40, 20, int(150 * k)))
        mask = Image.new('L', img.size, 0)
        ImageDraw.Draw(mask).text((x, yy), line, font=f, fill=255)
        bbox = mask.getbbox()
        if bbox:
            grad = Image.new('RGBA', img.size, (0, 0, 0, 0))
            gd = ImageDraw.Draw(grad)
            for gy in range(bbox[1], bbox[3]):
                u = (gy - bbox[1]) / max(1, bbox[3] - bbox[1])
                c = tuple(int(colors[0][i] + (colors[1][i] - colors[0][i]) * u) for i in range(3))
                gd.line([(bbox[0], gy), (bbox[2], gy)], fill=(*c, int(255 * k)))
            d.text((x, yy), line, font=f, fill=(0, 0, 0, 0), stroke_width=5, stroke_fill=(60, 25, 0, int(230 * k)))
            layer.alpha_composite(Image.composite(grad, Image.new('RGBA', img.size, (0, 0, 0, 0)), mask))
        yy += int(size * 1.08)
    img.alpha_composite(layer)


def chip(img, t, a, b, text, small=None, y=250, x=None, col=(255, 255, 255), fg=(18, 70, 32), anchor=None):
    k = win(t, a, b, 0.2)
    if k <= 0.001:
        return
    layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    f1, f2 = font('eb', 38), font('s', 28)
    w1 = d.textlength(text, font=f1)
    w2 = d.textlength(small, font=f2) if small else 0
    bw = max(w1, w2) + 52
    bh = 66 + (40 if small else 0)
    cx = W / 2 if x is None else x
    cy = y
    if anchor is not None:
        cx, cy = anchor
        cx = clamp(cx, bw / 2 + 24, W - bw / 2 - 24)
    sc = 0.9 + 0.1 * ss(a, a + 0.25, t)
    d.rounded_rectangle([cx - bw / 2, cy, cx + bw / 2, cy + bh], 26, fill=(*col, int(235 * k)))
    d.text((cx - w1 / 2, cy + 12), text, font=f1, fill=(*fg, int(255 * k)))
    if small:
        d.text((cx - w2 / 2, cy + 62), small, font=f2, fill=(220, 60, 110, int(255 * k)))
    if sc < 0.999:
        layer = layer.resize((int(W * sc), int(H * sc)))
        pad = Image.new('RGBA', img.size, (0, 0, 0, 0))
        pad.alpha_composite(layer, (int((W - W * sc) / 2), int((H - H * sc) / 2)))
        layer = pad
    img.alpha_composite(layer)


def to_px(p):
    return (p[0] * W, p[1] * H)


def draw_ruler(img, info, t):
    r = info.get('ruler')
    if not r or r['k'] <= 0.01:
        return
    k = r['k']
    layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    a, b = to_px(r['body0']), to_px(r['body1'])
    # body length bar under the chameleon
    d.line([a, b], fill=(255, 255, 255, int(230 * k)), width=8)
    for p in (a, b):
        d.line([(p[0], p[1] - 18), (p[0], p[1] + 18)], fill=(255, 255, 255, int(230 * k)), width=6)
    f = font('eb', 34)
    lab = '1× vücut'
    tw = d.textlength(lab, font=f)
    mx = (a[0] + b[0]) / 2
    d.rounded_rectangle([mx - tw / 2 - 14, a[1] + 22, mx + tw / 2 + 14, a[1] + 72], 14, fill=(20, 60, 30, int(200 * k)))
    d.text((mx - tw / 2, a[1] + 28), lab, font=f, fill=(255, 255, 255, int(255 * k)))
    # tongue scale: ticks at 1× and 2× body length along the tongue
    m, one, two = to_px(r['mouth']), to_px(r['one']), to_px(r['two'])
    frac = clamp(r['L'] / 2.0)
    end = (m[0] + (two[0] - m[0]) * frac, m[1] + (two[1] - m[1]) * frac)
    off = (-26, -22)
    d.line([(m[0] + off[0], m[1] + off[1]), (end[0] + off[0], end[1] + off[1])], fill=(*YEL, int(240 * k)), width=8)
    for p, txt, need in ((one, '1×', 1.0), (two, '2×', 2.0)):
        if r['L'] >= need - 0.02:
            q = (p[0] + off[0], p[1] + off[1])
            d.ellipse([q[0] - 12, q[1] - 12, q[0] + 12, q[1] + 12], fill=(*YEL, int(255 * k)))
            ff = font('x', 52)
            d.text((q[0] - 90, q[1] - 34), txt, font=ff, fill=(255, 255, 255, int(255 * k)), stroke_width=4, stroke_fill=(30, 60, 20, int(220 * k)))
    img.alpha_composite(layer)


def draw_labels(img, info):
    L = info.get('labels')
    k = info.get('label_k', 0)
    if not L or k < 0.02:
        return
    layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    f = font('eb', 32)
    spec = [('rod', 'Dil kemiği (hiyoid)', (240, 240, 230), (-40, 230)), ('sheath', 'Elastik kılıflar · enerji depolar', (80, 220, 255), (40, -260)),
            ('muscle', 'Hızlandırıcı kas', (255, 80, 95), (120, 150))]
    for key, txt, col, (dx, dy) in spec:
        if key not in L:
            continue
        p = to_px(L[key])
        q = (clamp(p[0] + dx, 220, W - 220), p[1] + dy)
        d.line([p, q], fill=(*col, int(230 * k)), width=4)
        d.ellipse([p[0] - 9, p[1] - 9, p[0] + 9, p[1] + 9], fill=(*col, int(255 * k)))
        tw = d.textlength(txt, font=f)
        d.rounded_rectangle([q[0] - tw / 2 - 18, q[1] - 30, q[0] + tw / 2 + 18, q[1] + 26], 16, fill=(10, 30, 20, int(215 * k)), outline=(*col, int(255 * k)), width=3)
        d.text((q[0] - tw / 2, q[1] - 22), txt, font=f, fill=(255, 255, 255, int(255 * k)))
    img.alpha_composite(layer)


def draw_energy(img, info, t):
    e = info.get('energy')
    k = win(t, 14.2, 17.9, 0.2)
    if e is None or k < 0.01:
        return
    layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    x0, y0, w, h = W / 2 - 300, 230, 600, 40
    f = font('eb', 34)
    d.text((W / 2 - d.textlength('DEPOLANAN ENERJİ', font=f) / 2, y0 - 50), 'DEPOLANAN ENERJİ', font=f, fill=(255, 255, 255, int(255 * k)), stroke_width=3, stroke_fill=(10, 40, 20, int(200 * k)))
    d.rounded_rectangle([x0, y0, x0 + w, y0 + h], 20, fill=(10, 30, 20, int(200 * k)), outline=(255, 255, 255, int(220 * k)), width=3)
    if e > 0.01:
        d.rounded_rectangle([x0 + 5, y0 + 5, x0 + 5 + (w - 10) * e, y0 + h - 5], 15, fill=(80, 220, 255, int(255 * k)))
    img.alpha_composite(layer)


def compose(t, n):
    base = Image.open(os.path.join(ROOT, f'out/frames/f_{n:05d}.png')).convert('RGB')
    try:
        info = json.load(open(os.path.join(ROOT, f'out/frames/f_{n:05d}.json')))
    except FileNotFoundError:
        info = {}
    img = base.resize((W, H), Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=2, percent=70, threshold=2)).convert('RGBA')
    # slow-motion / real-speed tags
    for a, b, txt in ((5.0, 8.7, 'AĞIR ÇEKİM'), (23.55, 27.4, 'AĞIR ÇEKİM')):
        chip(img, t, a, b, '● ' + txt, y=120, x=230, col=(20, 40, 25), fg=(255, 90, 90))
    draw_ruler(img, info, t)
    big_title(img, t, 6.0, 11.4, ['VÜCUT UZUNLUĞUNUN', '2 KATINA KADAR!'], size=84, y=230)
    chip(img, t, 9.4, 11.6, 'Bazı küçük türlerde ~2,5 katı!', 'ör. küçük cüce bukalemunlar', y=1080)
    draw_energy(img, info, t)
    draw_labels(img, info)
    big_title(img, t, 17.6, 18.9, ['FIRLAT!'], size=150, y=330, colors=((200, 250, 255), (60, 190, 255)))
    if info.get('tip') and info.get('sticky', 0) > 0.01:
        p = to_px(info['tip'])
        chip(img, t, 23.6, 25.6, 'Yapışkan dil ucu', anchor=(p[0], p[1] + 120), col=(255, 255, 255), fg=(200, 40, 90))
    chip(img, t, 26.0, 28.9, 'Saniyenin onda birinden kısa!', 'göz açıp kapayıncaya kadar', y=250)
    big_title(img, t, 35.0, DURATION + 1, ['BUKALEMUN', 'DOĞANIN MANCINIK', 'USTASI!'], size=88, y=200)
    if t > 35.6:
        k = ss(35.6, 36.2, t)
        layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        f = font('eb', 40)
        tw = d.textlength('Pirilumo', font=f)
        x = W / 2 - (tw + 100) / 2
        lg = LOGO.copy()
        lg.putalpha(Image.eval(lg.getchannel('A'), lambda v: int(v * k)))
        layer.alpha_composite(lg, (int(x), 520))
        d.text((x + 100, 540), 'Pirilumo', font=f, fill=(255, 255, 255, int(255 * k)), stroke_width=3, stroke_fill=(10, 40, 20, int(200 * k)))
        img.alpha_composite(layer)
    draw_sub(img, t)
    # fade in / out
    fade = (1 - ss(0, 0.4, t)) + ss(DURATION - 0.5, DURATION, t) * 0.9
    if fade > 0:
        img = Image.blend(img, Image.new('RGBA', img.size, (0, 0, 0, 255)), clamp(fade))
    return img.convert('RGB')


def main():
    if '--stills' in sys.argv:
        for s in sys.argv[sys.argv.index('--stills') + 1].split(','):
            t = float(s)
            n = round(t * FPS)
            compose(t, n).save(os.path.join(ROOT, f'out/post_{t:05.2f}.png'))
        return
    n_frames = round(DURATION * FPS)
    ff = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', str(FPS), '-c:v', 'mjpeg', '-i', '-',
                           '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', str(FPS), os.path.join(ROOT, 'out/video_noaudio.mp4')], stdin=subprocess.PIPE)
    import io
    for n in range(n_frames):
        buf = io.BytesIO()
        compose(n / FPS, n).save(buf, 'JPEG', quality=94)
        ff.stdin.write(buf.getvalue())
        if n % 60 == 0:
            print('post', n, '/', n_frames, flush=True)
    ff.stdin.close()
    ff.wait()


main()
