"""Karakter + ortam referans sayfası (aynı çizim kodu)."""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import clothes, world
from style import *

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'out')
W, H = 2800, 1530
bg = np.zeros((H, W, 3), np.float32)
yy = np.mgrid[0:H, 0:W][0].astype(np.float32)
bg[:] = mix(hx('2c4a4e'), hx('15262a'), (yy / H)[..., None])
img = Image.fromarray(bg.astype(np.uint8), 'RGB').convert('RGBA')
d = ImageDraw.Draw(img)
d.rounded_rectangle((30, 30, W - 30, H - 30), radius=30, outline=(255, 205, 90, 255), width=4)
d.text((W / 2, 100), 'İNSANLAR GİDİNCE — KATLANMAYANLARIN İSYANI', font=font(F_SANS_B, 66), fill=(255, 210, 80, 255), anchor='mm')
d.text((W / 2, 170), 'Karakter ve ortam referans sayfası', font=font(F_SERIF_BI, 40), fill=(240, 240, 240, 255), anchor='mm')
DESC = {'gomlek': 'Sinirli, kendini önemli gören beyaz gömlek. Kırışıklarından şikâyetçi.',
        'tisort': 'Umursamaz, alaycı genç tişört. Omzunda başkasının çorabı.',
        'corapA': 'Eşini kaybetmiş, telaşlı kırmızı-beyaz çizgili çorap.',
        'corapB': 'Dedikoducu, alaycı mavi puantiyeli çorap.',
        'havlu': 'Ağırbaşlı, yaşlı, sabrı tükenmiş havlu.',
        'pantolon': 'Kibirli, monokllü kumaş pantolon. Askı ister.',
        'sepet': 'Herkesi yöneten otoriter çamaşır sepeti.'}
EXPR = {'gomlek': dict(bang=1.1, mc=-0.6, mo=0.6), 'tisort': dict(mc=0.6), 'corapA': dict(bang=-0.9, brow=0.8, mc=-0.5),
        'corapB': dict(mc=0.8, lid=0.3), 'havlu': dict(bang=1.0, mc=-0.6), 'pantolon': dict(ly=-0.6, mc=0.4),
        'sepet': dict(bang=1.2, mo=0.7)}
keys = list(clothes.SPECS)
cw = (W - 120) / 4
for i, k in enumerate(keys):
    r, c = divmod(i, 4)
    x0 = 60 + c * cw; y0 = 230 + r * 620
    card = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ImageDraw.Draw(card).rounded_rectangle((x0 + 10, y0, x0 + cw - 10, y0 + 600), radius=24, fill=(255, 255, 255, 18), outline=(255, 205, 90, 90), width=2)
    img.alpha_composite(card)
    d = ImageDraw.Draw(img)
    S = 0.95 if k != 'sepet' else 0.8
    spr, (ax, ay) = clothes.render(k, S, dict(mc=0.3))
    img.alpha_composite(spr, (int(x0 + cw * 0.32 - ax), int(y0 + 470 - ay)))
    sp2, (bx, by) = clothes.render(k, 0.55, EXPR[k])
    img.alpha_composite(sp2, (int(x0 + cw * 0.78 - bx), int(y0 + 430 - by)))
    d.text((x0 + cw * 0.78, y0 + 460), 'ifade', font=font(F_SANS_B, 20), fill=(255, 205, 90, 255), anchor='mm')
    d.text((x0 + cw / 2, y0 + 515), clothes.NAMES[k], font=font(F_SANS_B, 40), fill=(255, 245, 230, 255), anchor='mm')
    d.text((x0 + cw / 2, y0 + 560), DESC[k], font=font(F_SANS, 19), fill=(220, 225, 225, 255), anchor='mm')
# ortam küçük resmi (8. hücre)
x0 = 60 + 3 * cw; y0 = 230 + 620
room = Image.open(os.path.join(OUT, 'bg_cache.png')).convert('RGBA')
pile = Image.open(os.path.join(OUT, 'pile_cache.png')).convert('RGBA')
px0, py0 = world.PILE_BOX[:2]
room.paste(pile, (px0 * 2, py0 * 2), pile) if px0 >= 0 else room.alpha_composite(pile.crop((-px0 * 2, 0, pile.size[0], pile.size[1])), (0, py0 * 2))
th = room.crop((0, 500, 2160, 3300)).resize((int(cw - 60), int((cw - 60) * 2800 / 2160)))
th = th.crop((0, 0, th.size[0], 500))
img.alpha_composite(th, (int(x0 + 30), int(y0 + 10)))
d.text((x0 + cw / 2, y0 + 560), 'Ortam: oturma odası, hardal koltuk, dev yığın', font=font(F_SANS, 20), fill=(220, 225, 225, 255), anchor='mm')
img.convert('RGB').save(os.path.join(OUT, 'karakter_referans_sayfasi.png'))
print('ok')
