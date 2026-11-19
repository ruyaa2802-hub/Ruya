"""El çizimi kurşun kalem + pastel görünümlü 2D render motoru (ücretsiz: numpy, scipy, Pillow).

- Kağıt dokusu ve lifleri
- Pastel dolgular: yönlü tebeşir izi, kağıdın dişine takılan pigment, pürüzlü kenar
- Kurşun kalem konturlar: titrek, çift geçişli, kırık grafit dokusu
- Tarama (hatch) gölgeler
- "Line boil": her pozda çizgiler yeniden ve biraz farklı çizilir (el çizimi animasyon hissi)
"""
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy.ndimage import gaussian_filter, map_coordinates

W, H = 1080, 1920
SS = 2


def hexc(s):
    s = s.lstrip('#')
    return np.array([int(s[i:i + 2], 16) / 255.0 for i in (0, 2, 4)], np.float32)


def mix(a, b, t):
    a = hexc(a) if isinstance(a, str) else a
    b = hexc(b) if isinstance(b, str) else b
    return a * (1 - t) + b * t


_rng = np.random.default_rng(11)
PH, PW = H + 300, W + 300


def _lowfreq(h, w, cells, rng):
    small = rng.standard_normal((max(2, h * cells // w), cells)).astype(np.float32)
    a = np.asarray(Image.fromarray(small).resize((w, h), Image.BICUBIC))
    return a / (a.std() + 1e-6)


def _streaks(angle_deg, sx, sy, rng):
    n = rng.standard_normal((PH + 400, PW + 400)).astype(np.float32)
    n = gaussian_filter(n, (sy, sx))
    im = Image.fromarray(n).rotate(angle_deg, resample=Image.BILINEAR)
    a = np.asarray(im)[200:200 + PH, 200:200 + PW]
    return (a - a.mean()) / (a.std() + 1e-6)


# kağıt
_grain = _rng.standard_normal((PH, PW)).astype(np.float32)
GRAIN_HI = _grain / _grain.std()
GRAIN_MID = gaussian_filter(_rng.standard_normal((PH, PW)).astype(np.float32), 1.6)
GRAIN_MID /= GRAIN_MID.std()
LOW = _lowfreq(PH, PW, 6, _rng)
LOW2 = _lowfreq(PH, PW, 18, _rng)
STREAK_D = _streaks(-28, 5, 1.0, _rng)    # çapraz pastel izi
STREAK_H = _streaks(-4, 9, 1.2, _rng)     # yatay (gökyüzü, toprak)
FIBER = np.clip(_streaks(37, 30, 0.6, _rng) - 2.2, 0, None) + np.clip(_streaks(-61, 26, 0.6, _rng) - 2.3, 0, None)


def _hatch_tex(spacing=7.0, angle=-0.9):
    yy, xx = np.mgrid[0:PH, 0:PW].astype(np.float32)
    u = xx * math.cos(angle) + yy * math.sin(angle)
    wob = gaussian_filter(_rng.standard_normal((PH, PW)).astype(np.float32), 8) * 6
    v = np.abs(((u + wob) / spacing) % 1.0 - 0.5) * 2
    lines = np.clip(1 - v * 3.2, 0, 1)
    brk = np.clip(GRAIN_MID * 0.6 + 0.8, 0, 1)
    return lines * brk


HATCH = _hatch_tex(8.0, -0.95)
HATCH2 = _hatch_tex(9.0, 0.6)


def paper_base(tint='#ece2cf'):
    base = hexc(tint)[None, None, :] * (1 + 0.035 * LOW[:H, :W, None] + 0.02 * LOW2[:H, :W, None])
    return base.astype(np.float32)


def tex(arr, X0, Y0, w, h, off=(0, 0)):
    ox, oy = off
    return arr[Y0 + oy:Y0 + oy + h, X0 + ox:X0 + ox + w]


def smooth_jitter(pts, seed, amp, closed=False, freq=0.08):
    """Noktaları yumuşak gürültüyle titret (el titremesi + poz başına 'boil')."""
    if amp <= 0 or len(pts) < 2:
        return list(pts)
    rng = np.random.default_rng(seed)
    p = np.array(pts, np.float32)
    seg = np.sqrt(((p[1:] - p[:-1]) ** 2).sum(1))
    s = np.concatenate([[0], np.cumsum(seg)])
    ph = rng.uniform(0, 100, 4)
    dx = amp * (np.sin(s * freq + ph[0]) * 0.6 + np.sin(s * freq * 2.7 + ph[1]) * 0.4)
    dy = amp * (np.sin(s * freq * 1.3 + ph[2]) * 0.6 + np.sin(s * freq * 3.1 + ph[3]) * 0.4)
    p[:, 0] += dx
    p[:, 1] += dy
    return [tuple(q) for q in p]


def resample(pts, step=6.0, closed=False):
    p = list(pts) + ([pts[0]] if closed else [])
    out = []
    for a, b in zip(p[:-1], p[1:]):
        d = math.hypot(b[0] - a[0], b[1] - a[1])
        n = max(1, int(d / step))
        for i in range(n):
            t = i / n
            out.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
    out.append(p[-1])
    return out


class Sheet:
    """Bir kare. img: float RGB (kağıt üstü)."""

    def __init__(self, seed=0, tint='#ece2cf'):
        self.img = paper_base(tint)
        self.seed = seed
        self.toff = (int((seed * 37) % 97), int((seed * 53) % 89))  # doku kayması (boil)

    # ---------------------------------------------------------------- maske
    @staticmethod
    def _mask(polys, X0, Y0, w, h, lines=None):
        im = Image.new('L', (w * SS, h * SS), 0)
        dr = ImageDraw.Draw(im)
        for pts in polys:
            if len(pts) >= 3:
                dr.polygon([((x - X0) * SS, (y - Y0) * SS) for x, y in pts], fill=255)
        if lines:
            for pts, wd in lines:
                q = [((x - X0) * SS, (y - Y0) * SS) for x, y in pts]
                dr.line(q, fill=255, width=max(1, int(wd * SS)), joint='curve')
                for x, y in (q[0], q[-1]):
                    r = wd * SS / 2
                    dr.ellipse([x - r, y - r, x + r, y + r], fill=255)
        return np.asarray(im.resize((w, h), Image.BOX), np.float32) / 255.0

    @staticmethod
    def _bbox(polys, lines=None, pad=12):
        xs, ys = [], []
        for pts in polys:
            for x, y in pts:
                xs.append(x)
                ys.append(y)
        for pts, wd in (lines or []):
            for x, y in pts:
                xs.append(x)
                ys.append(y)
            pad = max(pad, wd + 6)
        if not xs:
            return None
        X0, Y0 = max(0, int(min(xs) - pad)), max(0, int(min(ys) - pad))
        X1, Y1 = min(W, int(max(xs) + pad)), min(H, int(max(ys) + pad))
        if X1 - X0 < 2 or Y1 - Y0 < 2:
            return None
        return X0, Y0, X1, Y1

    # ---------------------------------------------------------------- pastel dolgu
    def fill(self, polys, color, alpha=1.0, seed=0, rough=1.0, streak='d', grain=1.0, wobble=1.6,
             shade=None, shade_col='#1f2540', hatch=0.0, hatch_tex=None, light=(1, -0.6), lines=None,
             color2=None, grad=None, glow=0.0):
        """polys: [[(x,y)...]] (ekran). shade: 0..1 gölge yoğunluğu (ışıktan uzak kenar).
        grad: (x0,y0,x1,y1) boyunca color->color2 geçiş."""
        if isinstance(polys, tuple):
            polys = [polys]
        polys = [smooth_jitter(resample(p, 8, True), self.seed * 7 + seed, wobble, True) for p in polys if len(p) >= 3]
        bb = self._bbox(polys, lines)
        if bb is None:
            return None
        X0, Y0, X1, Y1 = bb
        w, h = X1 - X0, Y1 - Y0
        m = self._mask(polys, X0, Y0, w, h, lines)
        if m.max() < 0.01:
            return None
        oo = self.toff
        # pürüzlü pastel kenar
        mb = gaussian_filter(m, 1.4)
        n = tex(GRAIN_MID, X0, Y0, w, h, oo) * 0.5 + tex(GRAIN_HI, X0, Y0, w, h, oo) * 0.25
        a = np.clip((mb - 0.5 + 0.22 * rough * n) * 3.2 + 0.5, 0, 1)
        st = tex(STREAK_D if streak == 'd' else STREAK_H, X0, Y0, w, h, oo)
        tooth = tex(GRAIN_HI, X0, Y0, w, h, (oo[1], oo[0]))
        cover = np.clip(0.9 + 0.07 * st + 0.10 * tooth * grain, 0.35, 1.0)
        a = a * cover * alpha
        col = hexc(color) if isinstance(color, str) else np.asarray(color, np.float32)
        lo = tex(LOW2, X0, Y0, w, h, oo)
        if color2 is not None and grad is not None:
            gx0, gy0, gx1, gy1 = grad
            yy, xx = np.mgrid[Y0:Y1, X0:X1].astype(np.float32)
            dx, dy = gx1 - gx0, gy1 - gy0
            t = np.clip(((xx - gx0) * dx + (yy - gy0) * dy) / (dx * dx + dy * dy + 1e-6), 0, 1)[..., None]
            c2 = hexc(color2) if isinstance(color2, str) else np.asarray(color2, np.float32)
            colmap = col[None, None, :] * (1 - t) + c2[None, None, :] * t
        else:
            colmap = np.broadcast_to(col[None, None, :], (h, w, 3)).copy()
        colmap = colmap * (1 + 0.06 * lo[..., None] + 0.025 * st[..., None])
        reg = self.img[Y0:Y1, X0:X1]
        if shade:
            lx, ly = light
            ln = math.hypot(lx, ly)
            sh = max(4.0, 0.22 * min(w, h))
            dx, dy = int(lx / ln * sh), int(ly / ln * sh)
            mm = gaussian_filter(m, sh * 0.35)
            moved = np.roll(np.roll(mm, dy, 0), dx, 1)
            sd = np.clip(m - moved * 1.1, 0, 1)
            sd = gaussian_filter(sd, 2.0)
            scol = hexc(shade_col)
            colmap = colmap * (1 - shade * 0.45 * sd[..., None]) + scol[None, None, :] * shade * 0.25 * sd[..., None]
            if hatch:
                ht = tex(hatch_tex if hatch_tex is not None else HATCH, X0, Y0, w, h, oo)
                ha = np.clip(sd * 1.6, 0, 1) * ht * hatch * a
                colmap = colmap * (1 - ha[..., None] * 0.55) + scol[None, None, :] * ha[..., None] * 0.4
        if glow:
            colmap = colmap + glow
        reg[:] = reg * (1 - a[..., None]) + colmap * a[..., None]
        return (X0, Y0, m)

    # ---------------------------------------------------------------- kalem çizgisi
    def line(self, pts, color='#2a2c3a', width=2.4, alpha=0.85, seed=0, passes=2, closed=False,
             wobble=1.3, progress=1.0, taper=True, broken=0.5):
        if len(pts) < 2 or alpha <= 0:
            return
        base = resample(pts, 5, closed)
        if progress < 1.0:
            n = max(2, int(len(base) * progress))
            base = base[:n]
        bb = self._bbox([base], pad=int(width * 2 + 8 + wobble * 2))
        if bb is None:
            return
        X0, Y0, X1, Y1 = bb
        w, h = X1 - X0, Y1 - Y0
        im = Image.new('L', (w * SS, h * SS), 0)
        dr = ImageDraw.Draw(im)
        for k in range(passes):
            q = smooth_jitter(base, self.seed * 13 + seed * 5 + k * 101, wobble * (1 + 0.6 * k), freq=0.05 + 0.03 * k)
            q = [((x - X0) * SS, (y - Y0) * SS) for x, y in q]
            wd = width * (1.0 if k == 0 else 0.6)
            nseg = len(q) - 1
            for i in range(nseg):
                tt = i / max(1, nseg)
                f = (0.55 + 0.45 * math.sin(math.pi * tt)) if taper else 1.0
                dr.line([q[i], q[i + 1]], fill=int(255 * (0.9 if k == 0 else 0.55)),
                        width=max(1, int(round(wd * f * SS))))
        m = np.asarray(im.resize((w, h), Image.BOX), np.float32) / 255.0
        oo = self.toff
        g = tex(GRAIN_HI, X0, Y0, w, h, oo)
        m = m * np.clip(1 - broken * 0.35 + 0.3 * g, 0, 1)
        col = hexc(color) if isinstance(color, str) else color
        reg = self.img[Y0:Y1, X0:X1]
        a = (m * alpha)[..., None]
        reg[:] = reg * (1 - a) + col[None, None, :] * a * 0.9 + reg * a * 0.1 * col[None, None, :]

    def scribble(self, cx, cy, rx, ry, color, seed=0, n=40, width=1.4, alpha=0.5, angle=-0.6):
        """Gevşek karalama dolgusu (pastel tarama)."""
        rng = np.random.default_rng(seed + self.seed * 3)
        pts = []
        ca, sa = math.cos(angle), math.sin(angle)
        for i in range(n):
            u = -1 + 2 * i / n
            s = 1 if i % 2 else -1
            lx, ly = s * rx * math.sqrt(max(0, 1 - u * u)) + rng.normal(0, rx * 0.04), u * ry
            pts.append((cx + lx * ca - ly * sa, cy + lx * sa + ly * ca))
        self.line(pts, color, width, alpha, seed=seed, passes=1, wobble=0.8, taper=False)

    # ---------------------------------------------------------------- yardımcılar
    def glow(self, cx, cy, r, color, k=0.3):
        yy, xx = np.ogrid[0:H, 0:W]
        g = np.exp(-(((xx - cx) ** 2 + (yy - cy) ** 2) / (r * r)))
        self.img += (k * g)[..., None] * hexc(color)[None, None, :]

    def darken(self, cx, cy, rx, ry, k=0.3, color='#1d2238'):
        """Yumuşak pastel gölge (zemin üstü)."""
        X0, Y0 = max(0, int(cx - rx * 1.6)), max(0, int(cy - ry * 1.6))
        X1, Y1 = min(W, int(cx + rx * 1.6)), min(H, int(cy + ry * 1.6))
        if X1 <= X0 or Y1 <= Y0:
            return
        yy, xx = np.mgrid[Y0:Y1, X0:X1].astype(np.float32)
        d = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2
        a = np.clip(1 - d, 0, 1) ** 1.2 * k
        a *= np.clip(0.8 + 0.3 * tex(GRAIN_MID, X0, Y0, X1 - X0, Y1 - Y0, self.toff), 0, 1)
        reg = self.img[Y0:Y1, X0:X1]
        reg[:] = reg * (1 - a[..., None]) + hexc(color)[None, None, :] * a[..., None]

    def finish(self, vignette=0.42, fade=0.0, warmth=0.0, lift=0.0):
        img = self.img.copy()
        # kağıt dişi + lifler her şeyin üstünde
        g = GRAIN_HI[:H, :W] * 0.022 + GRAIN_MID[:H, :W] * 0.018
        img = img * (1 + g[..., None]) - FIBER[:H, :W, None] * 0.05
        yy, xx = np.ogrid[0:H, 0:W]
        v = ((xx - W / 2) / (W * 0.7)) ** 2 + ((yy - H / 2) / (H * 0.62)) ** 2
        img = img * (1 - vignette * np.clip(v, 0, 1.5)[..., None] ** 1.5)
        if warmth:
            img = img * np.array([1 + 0.05 * warmth, 1 + 0.01 * warmth, 1 - 0.04 * warmth], np.float32)
        if lift:
            img = img * (1 - lift) + lift * hexc('#efe4d2')[None, None, :]
        if fade:
            img = img * (1 - fade) + hexc('#141826')[None, None, :] * fade
        return Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8))


def text_mask(text, font_path, size, cx, cy, max_w=960, line_gap=1.08):
    """El yazısı metin maskesi (tam kare). Satırlara böler."""
    font = ImageFont.truetype(font_path, size)
    try:
        font.set_variation_by_name('Bold')
    except Exception:
        pass
    words = text.split()
    lines, cur = [], ''
    d = ImageDraw.Draw(Image.new('L', (10, 10)))
    for wd in words:
        t = (cur + ' ' + wd).strip()
        if d.textlength(t, font=font) > max_w and cur:
            lines.append(cur)
            cur = wd
        else:
            cur = t
    lines.append(cur)
    im = Image.new('L', (W, H), 0)
    dr = ImageDraw.Draw(im)
    lh = size * line_gap
    y0 = cy - lh * len(lines) / 2
    for i, ln in enumerate(lines):
        tw = dr.textlength(ln, font=font)
        dr.text((cx - tw / 2, y0 + i * lh), ln, font=font, fill=255)
    return np.asarray(im, np.float32) / 255.0
