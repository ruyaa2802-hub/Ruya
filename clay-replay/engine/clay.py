"""CLAY REPLAY - kil (plastilin) görünümlü 2.5D render motoru.

Her parça bir maske olarak çizilir, maskeden mesafe dönüşümü ile bir
yükseklik haritası (hacim) çıkarılır, üstüne kil dokusu + parmak izi
eklenir ve ışıklandırılır. Böylece düz çizgi film yerine yumuşak,
elle yoğrulmuş kil hacmi elde edilir. Tamamen ücretsiz: numpy, scipy, Pillow.
"""
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy.ndimage import distance_transform_edt, gaussian_filter, zoom as nd_zoom

W, H = 1080, 1920
SS = 2  # maske süper-örnekleme


def _fractal(h, w, rng, octaves=5, base=8):
    out = np.zeros((h, w), np.float32)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        n = base * (2 ** o)
        small = rng.standard_normal((max(2, h * n // w), n)).astype(np.float32)
        img = Image.fromarray(small).resize((w, h), Image.BICUBIC)
        out += amp * np.asarray(img)
        tot += amp
        amp *= 0.55
    out /= tot
    return out / (out.std() + 1e-6)


def _fingerprints(h, w, rng, count=420):
    tex = np.zeros((h, w), np.float32)
    for _ in range(count):
        r = int(rng.integers(18, 40))
        cx, cy = int(rng.integers(r, w - r)), int(rng.integers(r, h - r))
        yy, xx = np.mgrid[-r:r, -r:r].astype(np.float32)
        ang = rng.uniform(0, math.pi)
        ex = rng.uniform(0.55, 0.85)
        xr = xx * math.cos(ang) + yy * math.sin(ang)
        yr = (-xx * math.sin(ang) + yy * math.cos(ang)) / ex
        d = np.sqrt(xr ** 2 + yr ** 2)
        win = np.clip(1 - d / r, 0, 1) ** 1.5
        tex[cy - r:cy + r, cx - r:cx + r] += np.sin(d * rng.uniform(1.1, 1.5)) * win
    return tex


_rng = np.random.default_rng(7)
TEXH, TEXW = H + 256, W + 256
NOISE = _fractal(TEXH, TEXW, _rng, octaves=6, base=24)
NOISE_LO = _fractal(TEXH, TEXW, _rng, octaves=3, base=4)
FINGER = _fingerprints(TEXH, TEXW, _rng)
GRAIN = [_rng.standard_normal((H, W)).astype(np.float32) for _ in range(6)]


def hexc(s):
    s = s.lstrip('#')
    return np.array([int(s[i:i + 2], 16) / 255.0 for i in (0, 2, 4)], np.float32)


def norm3(v):
    v = np.array(v, np.float32)
    return v / np.linalg.norm(v)


class Light:
    def __init__(self, key=(0.55, -0.45, 0.70), key_col='#fff1dc', amb=0.38,
                 amb_col='#9fb0d8', rim=(1, -0.2, 0.1), rim_col='#ffb36b', rim_k=0.55,
                 shadow_off=(-14, 10), shadow_k=0.38):
        self.key = norm3(key)
        self.key_col = hexc(key_col)
        self.amb = amb
        self.amb_col = hexc(amb_col)
        self.rim = norm3(rim)
        self.rim_col = hexc(rim_col)
        self.rim_k = rim_k
        self.shadow_off = shadow_off
        self.shadow_k = shadow_k


# ------------------------------------------------------------------ geometry
def ellipse_pts(cx, cy, rx, ry, ang=0.0, n=48, ymax=None):
    t = np.linspace(0, 2 * math.pi, n, endpoint=False)
    x, y = rx * np.cos(t), ry * np.sin(t)
    if ymax is not None:  # göz kapağı vb. için alt kısmı düzleştir (yerel)
        y = np.minimum(y, ymax)
    c, s = math.cos(ang), math.sin(ang)
    return list(zip(cx + x * c - y * s, cy + x * s + y * c))


def tube_pts(a, b, r0, r1, n=10):
    """Uçları yuvarlak, kalınlığı değişen tüp (konik sosis)."""
    ax, ay = a
    bx, by = b
    ang = math.atan2(by - ay, bx - ax)
    pts = []
    for i in range(n + 1):
        t = ang + math.pi / 2 + math.pi * i / n
        pts.append((bx + r1 * math.cos(t - math.pi), by + r1 * math.sin(t - math.pi)))
    for i in range(n + 1):
        t = ang + math.pi / 2 + math.pi * i / n
        pts.append((ax + r0 * math.cos(t), ay + r0 * math.sin(t)))
    return pts


def poly_tube(path, r0, r1=None):
    """Bir çizgi boyunca kalınlaşan/incelen tüp poligonu (saç tutamı, kol...)."""
    if r1 is None:
        r1 = r0
    path = np.array(path, np.float32)
    n = len(path)
    left, right = [], []
    for i in range(n):
        p = path[i]
        d = path[min(i + 1, n - 1)] - path[max(i - 1, 0)]
        d /= (np.linalg.norm(d) + 1e-6)
        nrm = np.array([-d[1], d[0]])
        r = r0 + (r1 - r0) * i / max(1, n - 1)
        left.append(p + nrm * r)
        right.append(p - nrm * r)
    # yuvarlak uç
    end = path[-1]
    d = path[-1] - path[-2]
    a0 = math.atan2(d[1], d[0])
    cap = [(end[0] + r1 * math.cos(a0 + math.pi / 2 - math.pi * k / 6),
            end[1] + r1 * math.sin(a0 + math.pi / 2 - math.pi * k / 6)) for k in range(7)]
    st = path[0]
    d = path[1] - path[0]
    a1 = math.atan2(d[1], d[0])
    cap0 = [(st[0] + r0 * math.cos(a1 - math.pi / 2 - math.pi * k / 6),
             st[1] + r0 * math.sin(a1 - math.pi / 2 - math.pi * k / 6)) for k in range(7)]
    return [tuple(p) for p in left] + cap + [tuple(p) for p in right[::-1]] + cap0


def bezier(p0, p1, p2, n=12):
    t = np.linspace(0, 1, n)[:, None]
    p0, p1, p2 = map(np.array, (p0, p1, p2))
    return ((1 - t) ** 2 * p0 + 2 * (1 - t) * t * p1 + t ** 2 * p2).tolist()


class Xf:
    """2D dönüşüm: yerel -> ekran (ölçek, dönüş, öteleme) + kamera."""

    def __init__(self, tx=0, ty=0, s=1.0, rot=0.0, flip=1):
        self.tx, self.ty, self.s, self.rot, self.flip = tx, ty, s, rot, flip

    def __call__(self, pts):
        c, s = math.cos(self.rot), math.sin(self.rot)
        out = []
        for x, y in pts:
            x *= self.flip
            out.append((self.tx + self.s * (x * c - y * s), self.ty + self.s * (x * s + y * c)))
        return out

    def pt(self, x, y):
        return self([(x, y)])[0]

    def inv(self, px, py):
        x, y = (px - self.tx) / self.s, (py - self.ty) / self.s
        c, s = math.cos(-self.rot), math.sin(-self.rot)
        return ((x * c - y * s) * self.flip, x * s + y * c)

    def child(self, x, y, rot=0.0, s=1.0):
        px, py = self.pt(x, y)
        return Xf(px, py, self.s * s, self.rot + rot * self.flip, self.flip)


class Camera:
    def __init__(self, cx=540, cy=960, zoom=1.0, rot=0.0):
        self.cx, self.cy, self.zoom, self.rot = cx, cy, zoom, rot

    def xf(self, local=None):
        # world -> screen
        c, s = math.cos(self.rot), math.sin(self.rot)
        z = self.zoom
        tx = W / 2 - z * (self.cx * c - self.cy * s)
        ty = H / 2 - z * (self.cx * s + self.cy * c)
        return Xf(tx, ty, z, self.rot)


# ------------------------------------------------------------------ canvas
class Canvas:
    def __init__(self, light, frame_seed=0):
        self.img = np.zeros((H, W, 3), np.float32)
        self.light = light
        self.seed = frame_seed
        self.depth_mask = None

    # --- maske
    @staticmethod
    def _mask(shapes, x0, y0, bw, bh, grooves=None):
        im = Image.new('L', (bw * SS, bh * SS), 0)
        dr = ImageDraw.Draw(im)
        for sh in shapes:
            kind = sh[0]
            if kind == 'poly':
                pts = [((x - x0) * SS, (y - y0) * SS) for x, y in sh[1]]
                if len(pts) >= 3:
                    dr.polygon(pts, fill=255 if len(sh) < 3 else sh[2])
            elif kind == 'cut':
                pts = [((x - x0) * SS, (y - y0) * SS) for x, y in sh[1]]
                if len(pts) >= 3:
                    dr.polygon(pts, fill=0)
            elif kind == 'line':
                pts = [((x - x0) * SS, (y - y0) * SS) for x, y in sh[1]]
                wd = sh[2] * SS
                dr.line(pts, fill=255, width=int(max(1, wd)), joint='curve')
                for p in (pts[0], pts[-1]):
                    dr.ellipse([p[0] - wd / 2, p[1] - wd / 2, p[0] + wd / 2, p[1] + wd / 2], fill=255)
        m = np.asarray(im.resize((bw, bh), Image.BOX), np.float32) / 255.0
        g = None
        if grooves:
            gi = Image.new('L', (bw * SS, bh * SS), 0)
            gd = ImageDraw.Draw(gi)
            for path, wd in grooves:
                pts = [((x - x0) * SS, (y - y0) * SS) for x, y in path]
                if len(pts) >= 2:
                    gd.line(pts, fill=255, width=int(max(1, wd * SS)), joint='curve')
            g = gaussian_filter(np.asarray(gi.resize((bw, bh), Image.BOX), np.float32) / 255.0, 1.2)
        return m, g

    def part(self, shapes, color, bump=1.0, tex=1.0, roundness=None, spec=0.18, gloss=18,
             shadow=True, shadow_k=None, grooves=None, groove_depth=6.0, mask_fn=None,
             emissive=0.0, alpha=1.0, flat=False, ao=0.25, jitter=True, tex_scale=1.0,
             light=None, sss=0.0, clip=None):
        """Bir kil parçası çiz. shapes: [('poly',pts)|('line',pts,w)|('cut',pts)]"""
        L = light or self.light
        if mask_fn is None:
            xs, ys = [], []
            for sh in shapes:
                for x, y in sh[1]:
                    xs.append(x)
                    ys.append(y)
            if not xs:
                return
            pad = 4 + max([sh[2] / 2 if sh[0] == 'line' else 0 for sh in shapes] + [0])
            x0, y0 = int(math.floor(min(xs) - pad)), int(math.floor(min(ys) - pad))
            x1, y1 = int(math.ceil(max(xs) + pad)), int(math.ceil(max(ys) + pad))
        else:
            x0, y0, x1, y1 = mask_fn('bbox')
        sp = 40  # gölge payı
        X0, Y0 = max(0, x0 - sp), max(0, y0 - sp)
        X1, Y1 = min(W, x1 + sp), min(H, y1 + sp)
        if X1 <= X0 + 2 or Y1 <= Y0 + 2:
            return
        bw, bh = X1 - X0, Y1 - Y0
        if mask_fn is None:
            m, g = self._mask(shapes, X0, Y0, bw, bh, grooves)
        else:
            m, g = mask_fn((X0, Y0, bw, bh)), None
        if clip is not None:
            cm, _ = self._mask(clip, X0, Y0, bw, bh)
            m = m * cm
        if m.max() < 0.02:
            return
        # --- hacim (yükseklik haritası)
        binm = m > 0.5
        d = distance_transform_edt(binm).astype(np.float32)
        dmax = float(d.max()) + 1e-3
        R = roundness if roundness is not None else dmax
        R = max(2.0, min(R, dmax))
        dn = np.clip(d / R, 0, 1)
        h = R * np.sqrt(1 - (1 - dn) ** 2) * bump
        h = gaussian_filter(h, max(1.0, 0.38 * R))
        h = h * binm + h * (1 - binm) * 0.0
        # kil dokusu (her karede hafif kayar -> "boiling")
        rng = np.random.default_rng(self.seed * 131 + int(abs(x0 * 7 + y0 * 13)) % 9973)
        ox, oy = (int(rng.integers(0, 120)), int(rng.integers(0, 120))) if jitter else (64, 64)
        nx0, ny0 = X0 + ox, Y0 + oy
        tz = NOISE[ny0:ny0 + bh, nx0:nx0 + bw]
        fz = FINGER[ny0:ny0 + bh, nx0:nx0 + bw]
        lo = NOISE_LO[ny0:ny0 + bh, nx0:nx0 + bw]
        h = h + tex * tex_scale * (0.6 * tz + 0.55 * fz) * np.clip(dn * 3, 0, 1)
        if g is not None:
            h = h - groove_depth * g
        if flat:
            h = h * 0.15
        # --- normaller ve ışık
        gy, gx = np.gradient(h)
        nz = np.ones_like(h)
        inv = 1.0 / np.sqrt(gx * gx + gy * gy + 1)
        nxv, nyv, nzv = -gx * inv, -gy * inv, nz * inv
        k = L.key
        diff = np.clip(nxv * k[0] + nyv * k[1] + nzv * k[2], 0, 1)
        # sarma ışık (kil yumuşak ışığı)
        diff = 0.82 * diff + 0.18 * np.clip((nxv * k[0] + nyv * k[1] + nzv * k[2] + 0.5) / 1.5, 0, 1)
        hv = norm3(k + np.array([0, 0, 1.0]))
        spc = np.clip(nxv * hv[0] + nyv * hv[1] + nzv * hv[2], 0, 1) ** gloss
        rim = np.clip(nxv * L.rim[0] + nyv * L.rim[1], 0, 1) * (1 - nzv) ** 1.5
        occl = 1 - ao * (1 - np.clip(d / 6.0, 0, 1))
        col = np.array(color, np.float32) if not isinstance(color, str) else hexc(color)
        base = col[None, None, :] * (1 + 0.05 * lo[..., None])
        if g is not None:
            occl = occl * (1 - 0.35 * g)
        shade = base * (L.amb * L.amb_col[None, None, :] + diff[..., None] * L.key_col[None, None, :]) * occl[..., None]
        shade += spec * spc[..., None] * L.key_col[None, None, :]
        shade += L.rim_k * rim[..., None] * L.rim_col[None, None, :] * (0.5 + col[None, None, :])
        if sss:
            shade += sss * col[None, None, :] * (1 - dn[..., None]) * 0.5
        if emissive:
            shade = shade * (1 - emissive) + col[None, None, :] * emissive
        reg = self.img[Y0:Y1, X0:X1]
        # --- temas gölgesi
        if shadow:
            sk = L.shadow_k if shadow_k is None else shadow_k
            sx, sy = L.shadow_off
            sm = gaussian_filter(m, 7)
            sm = np.roll(np.roll(sm, int(sy), 0), int(sx), 1)
            reg *= (1 - sk * sm * alpha)[..., None]
            am = gaussian_filter(m, 2.5)
            reg *= (1 - 0.25 * am * (1 - m) * alpha)[..., None]
        a = (m * alpha)[..., None]
        reg[:] = reg * (1 - a) + shade * a

    # --- düz katmanlar
    def fill(self, arr, mask=None):
        if mask is None:
            self.img[:] = arr
        else:
            self.img[:] = self.img * (1 - mask[..., None]) + arr * mask[..., None]

    def blur(self, sigma, mask=None):
        b = np.stack([gaussian_filter(self.img[..., c], sigma) for c in range(3)], -1)
        if mask is None:
            self.img[:] = b
        else:
            self.img[:] = self.img * (1 - mask[..., None]) + b * mask[..., None]

    def glow(self, cx, cy, r, color, k=1.0):
        yy, xx = np.ogrid[0:H, 0:W]
        d2 = ((xx - cx) ** 2 + (yy - cy) ** 2) / (r * r)
        self.img += k * np.exp(-d2)[..., None] * hexc(color)[None, None, :]

    def finish(self, grain_idx=0, vignette=0.45, warm=(1.04, 1.0, 0.95), contrast=1.06):
        img = self.img * np.array(warm, np.float32)
        yy, xx = np.ogrid[0:H, 0:W]
        v = ((xx - W / 2) / (W * 0.62)) ** 2 + ((yy - H / 2) / (H * 0.62)) ** 2
        img *= (1 - vignette * np.clip(v, 0, 1.4) ** 1.6)[..., None]
        img = (img - 0.5) * contrast + 0.5
        img += 0.018 * GRAIN[grain_idx % len(GRAIN)][..., None]
        # yumuşak tonlama (filmic)
        img = np.clip(img, 0, None)
        img = img * (1 + img / 6.0) / (1 + img)
        img = np.clip(img * 1.22, 0, 1) ** (1 / 1.05)
        return Image.fromarray((img * 255).astype(np.uint8))


# ------------------------------------------------------------------ metin (kil harfler)
FONT_BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'


def text_mask_fn(text, cx, cy, size, font_path=FONT_BOLD, stroke=0, rot=0.0):
    font = ImageFont.truetype(font_path, int(size * SS))
    tmp = Image.new('L', (10, 10))
    bb = ImageDraw.Draw(tmp).textbbox((0, 0), text, font=font, stroke_width=stroke * SS)
    tw, th = (bb[2] - bb[0]) / SS, (bb[3] - bb[1]) / SS
    x0, y0 = int(cx - tw / 2) - 8, int(cy - th / 2) - 8
    x1, y1 = int(cx + tw / 2) + 8, int(cy + th / 2) + 8

    def fn(arg):
        if arg == 'bbox':
            return (x0, y0, x1, y1)
        X0, Y0, bw, bh = arg
        im = Image.new('L', (bw * SS, bh * SS), 0)
        dr = ImageDraw.Draw(im)
        dr.text(((cx - tw / 2 - X0) * SS - bb[0], (cy - th / 2 - Y0) * SS - bb[1]), text, font=font,
                fill=255, stroke_width=stroke * SS, stroke_fill=255)
        if rot:
            im = im.rotate(rot, resample=Image.BICUBIC, center=((cx - X0) * SS, (cy - Y0) * SS))
        return np.asarray(im.resize((bw, bh), Image.BOX), np.float32) / 255.0
    return fn


def subtitle(pil_img, text, color='#ffffff', y=1600, size=64, who=None, who_col='#ffd27a', alpha=1.0):
    """Altyazı (sessiz izleyenler için). Kalın, konturlu."""
    if alpha <= 0:
        return pil_img
    base = pil_img.convert('RGBA')
    over = Image.new('RGBA', base.size, (0, 0, 0, 0))
    dr = ImageDraw.Draw(over)
    font = ImageFont.truetype(FONT_BOLD, size)
    a = int(255 * alpha)
    lines = text.split('\n')
    yy = y
    for ln in lines:
        bb = dr.textbbox((0, 0), ln, font=font, stroke_width=7)
        tw = bb[2] - bb[0]
        x = (W - tw) // 2
        c = tuple(int(v * 255) for v in hexc(color)) + (a,)
        dr.text((x, yy), ln, font=font, fill=c, stroke_width=7, stroke_fill=(25, 15, 20, a))
        yy += size + 14
    if who:
        f2 = ImageFont.truetype(FONT_BOLD, int(size * 0.55))
        bb = dr.textbbox((0, 0), who, font=f2, stroke_width=5)
        tw = bb[2] - bb[0]
        c = tuple(int(v * 255) for v in hexc(who_col)) + (a,)
        dr.text(((W - tw) // 2, y - int(size * 0.75)), who, font=f2, fill=c, stroke_width=5,
                stroke_fill=(25, 15, 20, a))
    return Image.alpha_composite(base, over).convert('RGB')


# ------------------------------------------------------------------ easing
def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def ease(t):
    t = clamp(t)
    return t * t * (3 - 2 * t)


def ease_out_back(t, s=1.70158):
    t = clamp(t) - 1
    return t * t * ((s + 1) * t + s) + 1


def ramp(t, a, b):
    return ease((t - a) / (b - a)) if b > a else float(t >= a)


def lerp(a, b, t):
    return a + (b - a) * t


def spring(t, freq=3.0, damp=4.0):
    if t <= 0:
        return 0.0
    return 1 - math.exp(-damp * t) * math.cos(2 * math.pi * freq * t)
