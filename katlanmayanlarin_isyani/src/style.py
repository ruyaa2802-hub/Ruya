"""Ortak çizim yardımcıları: gölgelendirme, maskeler, yazı tipleri."""
import functools
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageChops, ImageFont

F_SERIF_B = '/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf'
F_SERIF_BI = '/usr/share/fonts/truetype/liberation/LiberationSerif-BoldItalic.ttf'
F_SANS_B = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
F_SANS = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'


@functools.lru_cache(None)
def font(path, size):
    return ImageFont.truetype(path, max(4, int(size)))


def hx(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], np.float32)


def rgb(h):
    return tuple(int(v) for v in hx(h))


def mix(a, b, t):
    return a + (b - a) * t


def newmask(size):
    return Image.new('L', size, 0)


def smooth_mask(m, r):
    """Köşeleri yuvarlar (blur + eşik)."""
    r = max(0.5, r)
    return m.filter(ImageFilter.GaussianBlur(r)).point(lambda v: 255 if v > 127 else 0).filter(
        ImageFilter.GaussianBlur(0.8))


def _paste_rgb(img, arr, mask, x0, y0, x1, y1):
    rgba = np.dstack([np.clip(arr, 0, 255).astype(np.uint8),
                      np.array(mask.crop((x0, y0, x1, y1)))])
    img.alpha_composite(Image.fromarray(rgba, 'RGBA'), (x0, y0))


def shade_cyl(img, mask, dark, base, light, hl=0.35, hlpos=0.26, hlw=0.05, rim=None,
              rimw=0.05, vgrad=0.10, lightx=-0.55):
    """Silindirik (yatay degrade) gölgelendirme -> 3B hissi."""
    bb = mask.getbbox()
    if not bb:
        return
    x0, y0, x1, y1 = bb
    w, h = x1 - x0, y1 - y0
    t = (np.arange(w, dtype=np.float32) + 0.5) / w
    th = (t - 0.5) * np.pi * 0.92
    d = np.clip(np.cos(th - lightx), 0, 1) ** 1.15
    lo = mix(dark, base, np.clip(d / 0.7, 0, 1)[:, None])
    hi = mix(base, light, np.clip((d - 0.7) / 0.3, 0, 1)[:, None])
    c = np.where((d < 0.7)[:, None], lo, hi)
    arr = np.repeat(c[None, :, :], h, axis=0)
    v = (np.arange(h, dtype=np.float32) + 0.5) / h
    arr = arr * (1 + vgrad * (0.5 - v))[:, None, None]
    if hl:
        s = np.exp(-(((t - hlpos) / hlw) ** 2))
        arr = arr + (255 * hl * s)[None, :, None]
    if rim is not None:
        s = np.exp(-(((t - 0.975) / rimw) ** 2)) * 0.9
        arr = arr + (s[:, None] * rim)[None, :, :]
    _paste_rgb(img, arr, mask, x0, y0, x1, y1)


def shade_radial(img, mask, dark, base, light, spec=0.35, dome=0.55, rim=None, lvec=(-0.45, -0.55, 0.7)):
    bb = mask.getbbox()
    if not bb:
        return
    x0, y0, x1, y1 = bb
    w, h = x1 - x0, y1 - y0
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    nx = (xx / w - 0.5) * 2
    ny = (yy / h - 0.5) * 2
    r2 = nx * nx + ny * ny
    nz = np.sqrt(np.clip(1 - dome * r2, 0.001, 1))
    ln = np.sqrt(sum(v * v for v in lvec))
    lx, ly, lz = [v / ln for v in lvec]
    nn = np.sqrt(nx * nx * dome * dome + ny * ny * dome * dome + nz * nz)
    d = np.clip((nx * dome * lx + ny * dome * ly + nz * lz) / nn, 0, 1)
    lo = mix(dark, base, np.clip(d / 0.72, 0, 1)[..., None])
    hi = mix(base, light, np.clip((d - 0.72) / 0.28, 0, 1)[..., None])
    arr = np.where((d < 0.72)[..., None], lo, hi)
    if spec:
        sx, sy = -0.38, -0.42
        s = np.exp(-(((nx - sx) ** 2 + (ny - sy) ** 2) / 0.018))
        arr = arr + (255 * spec * s)[..., None]
    if rim is not None:
        s = np.clip((np.sqrt(r2) - 0.86) / 0.14, 0, 1) * np.clip(nx * 0.8 + ny * 0.5 + 0.3, 0, 1)
        arr = arr + (s[..., None] * rim)
    _paste_rgb(img, arr, mask, x0, y0, x1, y1)


def shade_vert(img, mask, top, bottom):
    bb = mask.getbbox()
    x0, y0, x1, y1 = bb
    w, h = x1 - x0, y1 - y0
    v = ((np.arange(h, dtype=np.float32) + 0.5) / h)[:, None, None]
    arr = np.repeat(mix(top, bottom, v), w, axis=1)
    _paste_rgb(img, arr, mask, x0, y0, x1, y1)


def alpha_poly(img, pts, color, alpha):
    lay = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ImageDraw.Draw(lay).polygon(pts, fill=tuple(color) + (int(alpha),))
    img.alpha_composite(lay)


def glow_blob(size, radius, color=(255, 255, 255), strength=1.0):
    """Yumuşak ışık lekesi (RGBA)."""
    n = int(radius * 2)
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    d = np.sqrt((xx - n / 2) ** 2 + (yy - n / 2) ** 2) / (n / 2)
    a = np.clip(1 - d, 0, 1) ** 2.2 * strength
    arr = np.zeros((n, n, 4), np.uint8)
    arr[..., 0], arr[..., 1], arr[..., 2] = color
    arr[..., 3] = np.clip(a * 255, 0, 255)
    return Image.fromarray(arr, 'RGBA')


def ease(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def ease_out(t):
    t = max(0.0, min(1.0, t))
    return 1 - (1 - t) ** 3


def ease_io(t):
    t = max(0.0, min(1.0, t))
    return t * t * t * (t * (6 * t - 15) + 10)
