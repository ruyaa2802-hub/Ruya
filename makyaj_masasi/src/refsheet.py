"""Karakter referans tasarım sayfası (tek sayfa): aynı çizim kodu = sahnelerdeki birebir aynı tasarım."""
import os
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
import chars
from style import *

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'out')
W, H = 2600, 1700
bg = np.zeros((H, W, 3), np.float32)
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
bg[:] = mix(hx('2e0f1c'), hx('120609'), (yy / H)[..., None])
bg += 18 * np.exp(-(((xx - W / 2) / 1100) ** 2 + ((yy - 500) / 600) ** 2))[..., None] * np.array([1, .5, .45], np.float32)
img = Image.fromarray(np.clip(bg, 0, 255).astype(np.uint8), 'RGB').convert('RGBA')
d = ImageDraw.Draw(img)
d.rounded_rectangle((30, 30, W - 30, H - 30), radius=30, outline=(220, 175, 90, 255), width=4)
d.rounded_rectangle((44, 44, W - 44, H - 44), radius=24, outline=(220, 175, 90, 110), width=2)
d.text((W / 2, 110), 'MAKYAJ MASASININ SIRLARI', font=font(F_SERIF_B, 76), fill=(236, 196, 110, 255), anchor='mm')
d.text((W / 2, 185), 'KARAKTER REFERANS SAYFASI  ·  Bölüm 1: Bir Damla İhanet', font=font(F_SERIF_BI, 40), fill=(255, 226, 200, 255), anchor='mm')

CARDS = [
    ('ruya', 'RÜYA RUJ', 'Ana kadın karakter · gururlu, zarif, cesur', [('bordo', '8c1030'), ('koyu bordo', '2a030d'), ('altın', 'd4a43a'), ('parlak altın', 'fff0b4')],
     dict(mc=0.8, blush=0.8, lx=0.3), dict(mc=-0.8, bang=-1.0, brow=0.8, tear=0.9, ly=0.2)),
    ('aras', 'PARFÜM ARAS', 'Ana erkek karakter · sakin, etkileyici', [('siyah cam', '15161d'), ('gümüş', 'c3c7d3'), ('beyaz parlama', 'ffffff'), ('çelik', '555a68')],
     dict(mc=0.5, lid=0.15, lx=-0.3), dict(mc=-0.1, bang=0.7, brow=0.4, eo=1.0)),
    ('lalin', 'PUDRA LALİN', 'Ana rakip · soğuk bakışlı, kontrollü', [('pudra pembesi', 'f1bccb'), ('altın', 'dcae44'), ('buz mavisi göz', '9fd0ee'), ('mauve dudak', 'a8456a')],
     dict(mc=0.5, bang=0.5, lid=0.38), dict(mc=-0.7, bang=1.1, lid=0.5)),
    ('mert', 'TELEFON MERT', 'Gizemli ve çıkarcı · yüz ekrana entegre', [('siyah cam', '0b0b11'), ('krom', 'a3a8b6'), ('ekran mavisi', '0d3150'), ('LED camgöbeği', '40d2ff')],
     dict(mc=0.9, bang=0.7, ly=0.2), dict(mc=-0.2, bang=0.2, brow=0.8, mo=0.6)),
    ('serra', 'MASKARA SERRA', 'Bu bölümde görünmez · kararlı gözler', [('siyah tüp', '141418'), ('metalik gümüş', 'c3c7d3'), ('kahve göz', '7a4a22'), ('gümüş halka', '8a90a8')],
     dict(mc=0.2, bang=0.4), dict(mc=-0.4, bang=0.9, brow=0.2)),
]
cw = (W - 120) // 5
S = 1.15
for i, (key, name, desc, pal, e1, e2) in enumerate(CARDS):
    x0 = 60 + i * cw
    card = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ImageDraw.Draw(card).rounded_rectangle((x0 + 8, 250, x0 + cw - 8, H - 80), radius=22, fill=(255, 255, 255, 14), outline=(220, 175, 90, 110), width=2)
    img.alpha_composite(card)
    d = ImageDraw.Draw(img)
    spr, (ax, ay) = chars.render(key, S, dict(e1))
    gl = glow_blob((10, 10), 330, (255, 190, 120), 0.35)
    img.alpha_composite(gl, (int(x0 + cw / 2 - gl.size[0] / 2), 640))
    # zemin elipsi
    sh = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse((x0 + cw / 2 - 150, 930, x0 + cw / 2 + 150, 975), fill=(0, 0, 0, 150))
    img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(14)))
    img.alpha_composite(spr, (int(x0 + cw / 2 - ax), int(955 - ay)))
    d.text((x0 + cw / 2, 1010), name, font=font(F_SERIF_B, 44), fill=(255, 238, 215, 255), anchor='mm')
    d.text((x0 + cw / 2, 1058), desc, font=font(F_SANS, 20), fill=(220, 190, 170, 255), anchor='mm')
    # ifade varyasyonu
    sp2, (bx, by) = chars.render(key, 0.62, dict(e1, **e2))
    cx = x0 + cw / 2
    d.text((cx, 1118), 'İFADE', font=font(F_SANS_B, 18), fill=(236, 196, 110, 255), anchor='mm')
    img.alpha_composite(sp2.crop((int(bx - 130 * 0.62 * 1.3), int(by - 440 * 0.62), int(bx + 130 * 0.62 * 1.3), int(by + 4))), (int(cx - 130 * 0.62 * 1.3), 1140))
    # palet
    for j, (pn, hx_) in enumerate(pal):
        px = x0 + 40 + (j % 2) * (cw // 2 - 20)
        py = 1470 + (j // 2) * 78
        d.rounded_rectangle((px, py, px + 54, py + 54), radius=10, fill=rgb(hx_) + (255,), outline=(255, 255, 255, 120), width=2)
        d.text((px + 66, py + 18), pn, font=font(F_SANS, 20), fill=(240, 225, 210, 255), anchor='lm')
        d.text((px + 66, py + 40), '#' + hx_.upper(), font=font(F_SANS, 16), fill=(180, 160, 150, 255), anchor='lm')
d.text((W / 2, H - 56), 'Tüm sahneler bu aynı çizim kodunu kullanır: şekil, renk, oran ve aksesuar bütün karelerde birebir aynıdır. İnsan karakter yoktur.', font=font(F_SANS, 22), fill=(200, 170, 150, 255), anchor='mm')
img.convert('RGB').save(os.path.join(OUT, 'karakter_referans_sayfasi.png'))
print('ok')
