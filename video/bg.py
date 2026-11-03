"""Modern, geniş, şık mutfak arka planı (2x çözünürlükte bir kez çizilir)."""
import math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageChops

S = 2
W, H = 720, 1280
IX0, IX1, IY0, IY1 = 22, 698, 90, 420     # üst dolap iç boşluğu (karakterlerin rafı)
SHELF = 402                                # raf üst yüzeyi (karakterlerin tabanı)

SAGE = [(0, (146, 172, 144)), (1, (92, 120, 96))]
BRASS = [(0, (255, 226, 150)), (0.5, (214, 168, 78)), (1, (140, 98, 36))]


def grad_img(w, h, stops, angle=0.0):
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    a = math.radians(angle)
    t = (xx / max(w - 1, 1) - 0.5) * math.sin(a) + (yy / max(h - 1, 1) - 0.5) * math.cos(a) + 0.5
    t = np.clip(t, 0, 1)
    pos = [s[0] for s in stops]
    arr = np.stack([np.interp(t, pos, [s[1][c] for s in stops]) for c in range(3)], -1)
    return Image.fromarray(arr.astype(np.uint8), "RGB")


def put_grad(img, box, stops, angle=0.0, mask=None):
    x0, y0, x1, y1 = [int(round(v * S)) for v in box]
    g = grad_img(x1 - x0, y1 - y0, stops, angle)
    img.paste(g, (x0, y0), mask.crop((x0, y0, x1, y1)) if mask is not None else None)


def rr_mask(size, box, r):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle([v * S for v in box], radius=r * S, fill=255)
    return m


def glow(img, cx, cy, r, col, strength):
    """yumuşak ışık lekesi (add)"""
    sz = int(r * 2 * S)
    yy, xx = np.mgrid[0:sz, 0:sz].astype(np.float32)
    d = np.sqrt((xx - sz / 2) ** 2 + (yy - sz / 2) ** 2) / (sz / 2)
    a = np.clip(1 - d, 0, 1) ** 2 * strength
    layer = np.zeros((sz, sz, 3), np.float32)
    for c in range(3):
        layer[..., c] = col[c] * a
    x0, y0 = int(cx * S - sz / 2), int(cy * S - sz / 2)
    base = np.asarray(img).astype(np.float32)
    h, w = base.shape[:2]
    xa, ya = max(x0, 0), max(y0, 0)
    xb, yb = min(x0 + sz, w), min(y0 + sz, h)
    if xb <= xa or yb <= ya:
        return
    base[ya:yb, xa:xb] += layer[ya - y0:yb - y0, xa - x0:xb - x0]
    img.paste(Image.fromarray(np.clip(base, 0, 255).astype(np.uint8), "RGB"))


def build():
    rnd = random.Random(7)
    size = (W * S, H * S)
    img = Image.new("RGB", size, (232, 216, 190))
    d = ImageDraw.Draw(img)

    # ---- duvar ---------------------------------------------------
    put_grad(img, (0, 0, W, H), [(0, (226, 208, 180)), (0.5, (236, 222, 196)), (1, (214, 196, 168))])

    # ---- sırt dolap gövdesi (adaçayı yeşili) -----------------------
    cab_mask = rr_mask(size, (8, 66, 712, 452), 8)
    put_grad(img, (8, 66, 712, 452), SAGE, angle=100, mask=cab_mask)
    # kronoz süs
    put_grad(img, (0, 52, W, 70), [(0, (170, 192, 166)), (1, (104, 130, 106))])
    d.rectangle([0, 49 * S, W * S, 52 * S], fill=(88, 108, 90))
    # tavan/duvar üstü
    put_grad(img, (0, 0, W, 50), [(0, (206, 188, 160)), (1, (226, 210, 184))])

    # ---- dolap içi (sıcak ahşap) -----------------------------------
    ix = (IX0, IY0, IX1, IY1)
    put_grad(img, ix, [(0, (236, 196, 140)), (0.45, (214, 170, 118)), (1, (186, 140, 92))], angle=0)
    # tahta dokusu: dikey ince çizgiler
    for k in range(0, IX1 - IX0, 34):
        d.line([((IX0 + k) * S, IY0 * S), ((IX0 + k) * S, SHELF * S)], fill=(190, 146, 98), width=2)
    # yan duvarlardan iç gölge, üstten LED ışığı
    sh = Image.new("L", size, 0)
    sd = ImageDraw.Draw(sh)
    sd.rectangle([IX0 * S, IY0 * S, IX1 * S, IY1 * S], fill=255)
    inv = ImageChops.invert(sh).filter(ImageFilter.GaussianBlur(26 * S))
    dark = Image.new("RGB", size, (62, 36, 20))
    mask = ImageChops.multiply(inv, sh).point(lambda v: int(v * 0.85))
    img.paste(dark, (0, 0), mask)
    # LED şerit
    put_grad(img, (IX0, IY0, IX1, IY0 + 10), [(0, (255, 244, 208)), (1, (230, 190, 120))])
    for gx in (140, 360, 580):
        glow(img, gx, IY0 + 40, 170, (255, 214, 140), 0.55)
    glow(img, 360, 300, 330, (255, 200, 120), 0.30)

    # raf tahtası
    put_grad(img, (IX0 - 4, SHELF, IX1 + 4, IY1 - 2), [(0, (232, 188, 128)), (1, (150, 104, 62))], angle=0)
    d.rectangle([(IX0 - 4) * S, SHELF * S, (IX1 + 4) * S, (SHELF + 2) * S], fill=(246, 214, 160))
    # raf üstündeki ince toz tabakası
    dust = Image.new("RGBA", size, (0, 0, 0, 0))
    dd = ImageDraw.Draw(dust)
    for _ in range(300):
        x = rnd.uniform(IX0, IX1)
        y = rnd.uniform(SHELF + 0.5, SHELF + 3)
        dd.ellipse([x * S, y * S, (x + rnd.uniform(3, 14)) * S, (y + 1.1) * S], fill=(236, 226, 210, rnd.randint(20, 56)))
    img.paste(dust, (0, 0), dust)
    # dolap alt kenarı (sage) – raf altı
    put_grad(img, (8, IY1 - 2, 712, 452), [(0, (130, 156, 130)), (1, (86, 112, 90))])
    d.rectangle([8 * S, 450 * S, 712 * S, 453 * S], fill=(70, 92, 74))

    # ---- mutfak arkası (backsplash) ---------------------------------
    bs = (0, 453, W, 880)
    put_grad(img, bs, [(0, (240, 230, 212)), (1, (226, 212, 190))])
    th = 24
    for r, y in enumerate(range(453, 880, th)):
        off = 0 if r % 2 == 0 else 36
        for x in range(-72 + off, W + 72, 72):
            c = 236 + rnd.randint(-5, 5)
            d.rectangle([(x + 1) * S, (y + 1) * S, (x + 71) * S, (y + th - 1) * S], fill=(c, c - 8, c - 24))
    # dolap altı gölgesi
    shad = grad_img(W * S, 60 * S, [(0, (60, 40, 24)), (1, (236, 222, 196))], 0)
    sm = Image.linear_gradient("L").resize((W * S, 60 * S)).point(lambda v: int((255 - v) * 0.55))
    img.paste(shad, (0, 453 * S), sm)
    # pencere (solda)
    wx0, wy0, wx1, wy1 = 36, 520, 232, 790
    d.rectangle([(wx0 - 8) * S, (wy0 - 8) * S, (wx1 + 8) * S, (wy1 + 8) * S], fill=(248, 244, 236))
    put_grad(img, (wx0, wy0, wx1, wy1), [(0, (255, 250, 226)), (0.6, (255, 232, 176)), (1, (246, 204, 140))])
    for _ in range(26):
        gx, gy = rnd.uniform(wx0, wx1), rnd.uniform(wy0 + 120, wy1)
        glow(img, gx, gy, rnd.uniform(20, 46), (120, 150, 90), 0.5)
    d.rectangle([(wx0 + 96) * S, wy0 * S, (wx0 + 100) * S, wy1 * S], fill=(248, 244, 236))
    d.rectangle([wx0 * S, (wy0 + 130) * S, wx1 * S, (wy0 + 134) * S], fill=(248, 244, 236))
    glow(img, 134, 660, 300, (255, 232, 170), 0.35)
    # pencere kasası
    d.rectangle([(wx0 - 14) * S, (wy1 + 8) * S, (wx1 + 14) * S, (wy1 + 18) * S], fill=(238, 232, 220))
    # bitki (pencere önü)
    for k in range(9):
        a = -80 + k * 20
        x0 = 82
        L = rnd.uniform(40, 70)
        x1 = x0 + math.sin(math.radians(a)) * L
        y1 = wy1 + 8 - math.cos(math.radians(a)) * L
        d.polygon([(x0 * S, (wy1 + 8) * S), ((x1 - 7) * S, (y1 + 10) * S), (x1 * S, y1 * S), ((x1 + 7) * S, (y1 + 10) * S)], fill=(70 + k * 4, 128 + k * 2, 84))
    d.rounded_rectangle([60 * S, (wy1 + 4) * S, 106 * S, (wy1 + 32) * S], radius=5 * S, fill=(214, 120, 84))
    # çerçeve (sağda) – sıcak soyut sanat
    fx0, fy0, fx1, fy1 = 500, 548, 676, 730
    d.rectangle([(fx0 - 7) * S, (fy0 - 7) * S, (fx1 + 7) * S, (fy1 + 7) * S], fill=(120, 84, 54))
    put_grad(img, (fx0, fy0, fx1, fy1), [(0, (244, 224, 190)), (1, (232, 204, 170))])
    d.ellipse([(fx0 + 22) * S, (fy0 + 24) * S, (fx0 + 120) * S, (fy0 + 122) * S], fill=(214, 128, 88))
    d.ellipse([(fx0 + 70) * S, (fy0 + 70) * S, (fx0 + 160) * S, (fy0 + 160) * S], fill=(120, 150, 118))
    d.rectangle([(fx0 + 14) * S, (fy0 + 140) * S, (fx0 + 150) * S, (fy0 + 150) * S], fill=(90, 70, 60))
    # raflı süs: aydınlık duvar lambası parıltısı
    glow(img, 360, 600, 260, (255, 224, 170), 0.22)
    glow(img, 600, 520, 140, (255, 210, 150), 0.25)

    # ---- tezgâh (mermer) ---------------------------------------------
    mt = (0, 880, W, 936)
    put_grad(img, mt, [(0, (252, 250, 246)), (1, (226, 224, 220))])
    mar = Image.new("RGBA", size, (0, 0, 0, 0))
    md = ImageDraw.Draw(mar)
    for _ in range(14):
        x, y = rnd.uniform(0, W), rnd.uniform(884, 928)
        pts = [(x, y)]
        for k in range(6):
            x += rnd.uniform(14, 40)
            y += rnd.uniform(-6, 6)
            pts.append((x, min(max(y, 884), 932)))
        md.line([(px * S, py * S) for px, py in pts], fill=(128, 132, 148, 90), width=int(rnd.uniform(1, 2.6) * S))
    mar = mar.filter(ImageFilter.GaussianBlur(1.2 * S))
    img.paste(mar, (0, 0), mar)
    d.rectangle([0, 936 * S, W * S, 944 * S], fill=(206, 202, 198))
    # tezgâh üstü eşyalar
    # meyve kasesi
    d.ellipse([86 * S, 905 * S, 190 * S, 934 * S], fill=(196, 156, 112))
    for (ax, ay, c) in [(108, 892, (210, 62, 52)), (134, 888, (236, 150, 52)), (158, 894, (150, 190, 70)), (122, 880, (224, 70, 60))]:
        d.ellipse([(ax - 14) * S, (ay - 14) * S, (ax + 14) * S, (ay + 14) * S], fill=c)
    d.rounded_rectangle([86 * S, 912 * S, 190 * S, 934 * S], radius=10 * S, fill=(184, 142, 98))
    # kahve makinesi
    d.rounded_rectangle([290 * S, 770 * S, 392 * S, 884 * S], radius=8 * S, fill=(58, 58, 66))
    d.rectangle([298 * S, 784 * S, 384 * S, 806 * S], fill=(30, 30, 36))
    d.ellipse([336 * S, 862 * S, 346 * S, 872 * S], fill=(210, 80, 60))
    d.rounded_rectangle([318 * S, 846 * S, 364 * S, 884 * S], radius=3 * S, fill=(224, 220, 216))
    # sürahi / kavanoz grubu
    for k, (jx, c) in enumerate([(444, (236, 224, 196)), (480, (216, 190, 150)), (514, (200, 214, 196))]):
        d.rounded_rectangle([jx * S, (820 - k * 6) * S, (jx + 28) * S, 884 * S], radius=6 * S, fill=c)
        d.rectangle([jx * S, (820 - k * 6) * S, (jx + 28) * S, (828 - k * 6) * S], fill=(120, 96, 70))
    # kaşıklık
    d.rounded_rectangle([588 * S, 830 * S, 628 * S, 884 * S], radius=5 * S, fill=(188, 90, 70))
    for k, a in enumerate((-14, 0, 12)):
        x1 = 608 + a * 1.2
        d.line([(608 * S, 834 * S), (x1 * S, 782 * S)], fill=(176, 130, 80), width=5 * S)
    # ---- alt dolaplar ------------------------------------------------
    lc = (0, 944, W, 1060)
    put_grad(img, lc, SAGE, angle=100)
    for x in range(0, W, 180):
        d.rounded_rectangle([(x + 8) * S, 954 * S, (x + 172) * S, 1052 * S], radius=5 * S, outline=(78, 104, 82), width=3 * S)
        put_grad(img, (x + 12, 958, x + 168, 1048), [(0, (136, 162, 136)), (1, (100, 126, 104))], angle=100)
        d.rounded_rectangle([(x + 70) * S, 962 * S, (x + 110) * S, 968 * S], radius=3 * S, fill=(220, 172, 82))

    # ---- ada (ön plan): mermer tabla + meşe gövde + taburelar ----------
    ia = (0, 1080, W, 1280)
    put_grad(img, ia, [(0, (212, 168, 118)), (1, (156, 112, 70))], angle=0)
    for x in range(0, W, 22):
        d.line([(x * S, 1118 * S), (x * S, 1280 * S)], fill=(176, 130, 84), width=2 * S)
    put_grad(img, (-10, 1060, W + 10, 1120), [(0, (252, 250, 246)), (1, (222, 220, 216))])
    d.rectangle([-10 * S, 1118 * S, (W + 10) * S, 1126 * S], fill=(196, 192, 188))
    for sx in (150, 560):
        d.rounded_rectangle([(sx - 46) * S, 1160 * S, (sx + 46) * S, 1196 * S], radius=16 * S, fill=(120, 88, 64))
        d.rounded_rectangle([(sx - 40) * S, 1164 * S, (sx + 40) * S, 1182 * S], radius=14 * S, fill=(176, 130, 94))
        for lx in (-32, 32):
            d.line([((sx + lx) * S, 1196 * S), ((sx + lx * 1.4) * S, 1280 * S)], fill=(60, 52, 54), width=7 * S)

    # ---- alan derinliği: alt kısmı hafif bulanıklaştır ----------------
    blurred = img.filter(ImageFilter.GaussianBlur(2.6 * S))
    m = Image.linear_gradient("L").resize((1, H * S)).resize((W * S, H * S))
    ma = np.asarray(m).astype(np.float32) / 255.0   # 0 (üst) -> 1 (alt)
    y = np.arange(H * S, dtype=np.float32) / S
    t = np.clip((y - 456) / 200, 0, 1)[:, None]
    t = np.repeat(t, W * S, axis=1)
    mm = Image.fromarray((t * 255).astype(np.uint8), "L")
    img = Image.composite(blurred, img, mm)

    # sıcak bokeh ışıkları (arka plan, bulanık)
    for _ in range(22):
        glow(img, rnd.uniform(0, W), rnd.uniform(470, 880), rnd.uniform(14, 34), (255, 220, 160), 0.22)
    # genel sıcak ton + vinyet
    arr = np.asarray(img).astype(np.float32)
    arr[..., 0] *= 1.03
    arr[..., 2] *= 0.94
    yy, xx = np.mgrid[0:H * S, 0:W * S].astype(np.float32)
    dx = (xx / (W * S) - 0.5) * 2
    dy = (yy / (H * S) - 0.46) * 2
    vig = 1 - 0.30 * np.clip((dx ** 2 * 0.9 + dy ** 2 * 0.6), 0, 1.4)
    arr *= vig[..., None]
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB")


if __name__ == "__main__":
    import time
    t = time.time()
    b = build()
    b.save("build/bg.png")
    b.resize((360, 640), Image.LANCZOS).save("build/bg_small.png")
    print("bg", b.size, round(time.time() - t, 1), "s")
