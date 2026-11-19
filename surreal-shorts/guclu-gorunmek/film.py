"""'Güçlü Görünmek' - 40 sn gerçeküstü el çizimi 2D kısa film. Kare kare render.

python3 film.py --only 1.0,5.0     (önizleme)
python3 film.py                     (tüm kareler -> build/frames)
"""
import math
import os
import sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'engine'))
sys.path.insert(0, HERE)
from pencil import Sheet, W, H, hexc, mix, text_mask, GRAIN_MID, GRAIN_HI, STREAK_H, STREAK_D, LOW, tex
from figure import figure, Tf, oval, tube, walk_feet, MAIN, FRIEND_A, FRIEND_B, INK
from zaman import FPS, DURATION, SCENES, EV, FINAL_TEXT

FONT = os.path.join(HERE, '..', 'fonts', 'Caveat[wght].ttf')
G = 1330.0          # karakter zemini (dünya y)
HOR = 1062.0        # ufuk (dünya y, d=0.04)
C0 = (540.0, 960.0)


def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def ease(t):
    t = clamp(t)
    return t * t * (3 - 2 * t)


def ease_io(t):
    t = clamp(t)
    return 0.5 - 0.5 * math.cos(math.pi * t)


def ramp(t, a, b):
    return ease((t - a) / (b - a)) if b > a else float(t >= a)


def lerp(a, b, t):
    return a + (b - a) * t


# ===================================================================== kamera
class Cam:
    def __init__(self, cx, cy, zoom, shake=(0, 0)):
        self.cx, self.cy, self.zoom = cx + shake[0], cy + shake[1], zoom

    def zd(self, d):
        return 1 + (self.zoom - 1) * d

    def p(self, x, y, d=1.0):
        zd = self.zd(d)
        ccx = C0[0] + (self.cx - C0[0]) * d
        ccy = C0[1] + (self.cy - C0[1]) * d
        return (W / 2 + (x - ccx) * zd, H / 2 + (y - ccy) * zd)

    def ps(self, pts, d=1.0):
        return [self.p(x, y, d) for x, y in pts]


# ===================================================================== yürüyüş zaman tablosu
STRIDE = 24.0
_dt = 1 / 240


def _vel(t):
    if t < 7.25:
        return 30.0
    if t < 7.7:
        return 30.0 * (1 - ease((t - 7.25) / 0.45))
    if 8.85 <= t < 10.35:
        return 26.0 * min(ease((t - 8.85) / 0.3), 1 - ease((t - 10.05) / 0.3))
    if 13.3 <= t < 20.55:
        return 30.0 * ease((t - 13.3) / 0.5)
    if 20.55 <= t < 21.0:
        return 30.0 * (1 - ease((t - 20.55) / 0.45))
    return 0.0


_ts = np.arange(0, DURATION + 1, _dt)
_vs = np.array([_vel(t) for t in _ts])
_xs = 300 + np.concatenate([[0], np.cumsum(_vs[:-1] * _dt)])


def main_x(t):
    return float(np.interp(t, _ts, _xs))


def main_v(t):
    return float(np.interp(t, _ts, _vs))


def gait(t, x0=300.0):
    """Ayak konumları (yakın, uzak) - kayma yok: faz, yol ile ilerler."""
    x = main_x(t)
    ph = (x - x0) / (2 * STRIDE)
    v = main_v(t)
    walk = clamp(v / 22.0)
    fn = walk_feet(ph, STRIDE, 9)
    ff = walk_feet(ph + 0.5, STRIDE, 9)
    stand_n, stand_f = (7, 0), (-7, 0)
    near = (lerp(stand_n[0], fn[0], walk), -lerp(0, fn[1], walk))
    far = (lerp(stand_f[0], ff[0], walk), -lerp(0, ff[1], walk))
    # ağır yürüyüş: basışta kalça çöker
    bob = walk * (6 * (0.5 + 0.5 * math.cos(ph * 4 * math.pi)))
    return near, far, bob, ph, walk


def contacts(t0, t1):
    """t0..t1 arasında yere basış anları ve ayak dünya x'i."""
    out = []
    prev = None
    for t in np.arange(t0, t1, 1 / 48):
        ph = (main_x(t) - 300) / (2 * STRIDE)
        k = math.floor(ph * 2)
        if prev is not None and k != prev and main_v(t) > 5:
            near = (k % 2 == 0)
            out.append((t, main_x(t) + STRIDE * 0.5, near))
        prev = k
    return out


CONTACTS_S3 = contacts(13.3, 21.0)


# ===================================================================== arka plan (önceden hesaplanır)
SKY_N = [(0.0, '#1f2846'), (0.35, '#3d5a6e'), (0.62, '#6f9a98'), (0.82, '#c9998f'), (0.95, '#d9a27a'), (1.0, '#e2b48a')]
SKY_S = [(0.0, '#36395c'), (0.3, '#5d6f86'), (0.58, '#94a9a2'), (0.8, '#d9aaa0'), (0.94, '#e6b791'), (1.0, '#efc9a0')]
GROUND_N = [(0.0, '#c79a77'), (0.12, '#b0856a'), (0.45, '#8a6858'), (1.0, '#4e4049')]
GROUND_S = [(0.0, '#d8ab88'), (0.12, '#c09378'), (0.45, '#9c7766'), (1.0, '#5f4c55')]

_BG = {}


def _grad(stops, n):
    pos = np.array([s[0] for s in stops])
    cols = np.array([hexc(s[1]) for s in stops])
    u = np.linspace(0, 1, n)
    return np.stack([np.interp(u, pos, cols[:, c]) for c in range(3)], -1).astype(np.float32)


def build_bg(mood, variant):
    key = (mood, variant)
    if key in _BG:
        return _BG[key]
    sh = Sheet(seed=variant * 3 + 1)
    hy = int(HOR)
    sky = _grad(SKY_N if mood == 0 else SKY_S, hy)
    ground = _grad(GROUND_N if mood == 0 else GROUND_S, H - hy)
    col = np.concatenate([sky, ground], 0)[:, None, :]
    off = (variant * 41) % 120
    st = STREAK_H[off:off + H, off:off + W]
    lo = LOW[off:off + H, off:off + W]
    paper = sh.img
    pig = np.clip(0.88 + 0.06 * st + 0.05 * GRAIN_HI[off:off + H, off:off + W], 0.5, 1.0)[..., None]
    img = paper * (1 - pig) + col * (1 + 0.05 * lo[..., None] + 0.018 * st[..., None]) * pig
    sh.img = img.astype(np.float32)
    # ufuk pusu
    yy = np.arange(H)[:, None, None]
    haze = np.exp(-((yy - hy) / 26.0) ** 2) * (0.35 if mood == 0 else 0.45)
    sh.img = sh.img * (1 - haze) + hexc('#e9c3a0')[None, None, :] * haze
    # uzun, gevşek bulut darbeleri
    rng = np.random.default_rng(4 + variant)
    for i in range(7):
        cx, cy = rng.uniform(-100, 1180), rng.uniform(160, 820)
        ln, th = rng.uniform(220, 520), rng.uniform(10, 24)
        c = mix('#d8a8a0', '#e6c2a6', rng.uniform()) if mood == 1 else mix('#8fa9a8', '#c79e98', rng.uniform())
        pts = [(cx - ln / 2, cy), (cx - ln * 0.2, cy - th), (cx + ln / 2, cy - th * 0.3), (cx + ln * 0.3, cy + th * 0.6),
               (cx - ln * 0.3, cy + th * 0.5)]
        sh.fill([pts], c, alpha=0.45, seed=i * 7, streak='h', wobble=3.0)
    _BG[key] = sh.img
    return sh.img


# ===================================================================== çevre
def draw_far(sh, cam, t, soft):
    # büyük soluk ay/güneş (d=0.02)
    mx, my = cam.p(820, 805, 0.02)
    r = 128 * cam.zd(0.02)
    sh.glow(mx, my, r * 2.6, '#f1b48a', 0.12 + 0.12 * soft)
    sh.fill([oval(mx, my, r, r, n=48)], mix('#e4b6a2', '#f2c8a8', soft), alpha=0.92, seed=301, streak='h', wobble=1.5,
            color2='#d99c8c', grad=(mx, my - r, mx, my + r))
    sh.line(oval(mx, my, r * 1.18, r * 1.18, n=60) + [oval(mx, my, r * 1.18, r * 1.18, n=60)[0]], '#b98a86',
            width=1.4, alpha=0.4, seed=302, wobble=2.0)
    # ince, uzun kayalıklar / kuleler (d=0.15-0.3)
    towers = [(120, 0.16, 470, 30, '#33475a'), (-40, 0.2, 300, 40, '#3c4f60'), (300, 0.22, 230, 22, '#45596a'),
              (980, 0.18, 380, 26, '#36495c'), (1180, 0.25, 260, 34, '#40546a')]
    for i, (x, d, h, w, c) in enumerate(towers):
        base_y = lerp(HOR, G, d * 0.25)
        pts = [(x - w, base_y), (x - w * 0.55, base_y - h * 0.6), (x - w * 0.25, base_y - h), (x + w * 0.3, base_y - h * 0.97),
               (x + w * 0.6, base_y - h * 0.55), (x + w, base_y)]
        sp = cam.ps(pts, d)
        sh.fill([sp], mix(c, '#7f8fa0', 0.25 * soft), seed=310 + i, shade=0.5, hatch=0.4, light=(1, -0.4), shade_col='#1c2436',
                wobble=1.4)
        sh.line(sp, INK, width=1.3, alpha=0.45, seed=320 + i, wobble=1.2)
        if i == 0:  # kulenin üstünde süzülen taş
            fy = base_y - h - 70 + 8 * math.sin(t * 0.7)
            st = cam.ps(oval(x + 4, fy, 34, 18, 0.1, n=20, lump=0.08, seed=2), d)
            sh.fill([st], '#4a5c6e', seed=331, shade=0.6, light=(1, -0.5))
            sh.line(st + st[:1], INK, width=1.2, alpha=0.45, seed=332)
    # hiçbir yere çıkmayan merdiven (d=0.32)
    d = 0.32
    bx, by = 760, lerp(HOR, G, d * 0.3)
    steps = []
    for k in range(7):
        x0 = bx + k * 14
        y0 = by - k * 16
        steps.append([(x0, y0), (x0 + 30, y0), (x0 + 30, y0 + 16 * (k + 1)), (x0, y0 + 16 * (k + 1))])
    sp = [cam.ps(s, d) for s in steps]
    sh.fill(sp, mix('#7a6a72', '#9a8890', soft), seed=340, shade=0.5, hatch=0.5, light=(1, -0.5))
    for s in sp:
        sh.line(s + s[:1], INK, width=1.0, alpha=0.35, seed=341)
    # uzak tek ağaçsız direk (d=0.45)
    d = 0.45
    px_, py_ = 40, lerp(HOR, G, d * 0.6)
    pl = cam.ps([(px_, py_), (px_ + 3, py_ - 240)], d)
    sh.line(pl, '#2f3448', width=3 * cam.zd(d), alpha=0.7, seed=350)
    lamp = cam.ps(oval(px_ + 3, py_ - 248, 9, 7, n=14), d)
    sh.fill([lamp], '#e9c891', seed=351, glow=0.05)


def ground_marks(sh, cam, t):
    rng = np.random.default_rng(77)
    for i in range(70):
        d = rng.uniform(0.15, 1.45) ** 1.2
        x = rng.uniform(-900, 2600)
        y = lerp(HOR, G, d) + rng.uniform(-6, 6)
        ln = rng.uniform(14, 70) * d
        sx, sy = cam.p(x, y, d)
        if not (-80 < sx < W + 80 and HOR - 5 < sy < H + 20):
            continue
        zd = cam.zd(d)
        if i % 4 == 0:
            p = oval(sx, sy, 5 * d * zd, 3 * d * zd, n=10, lump=0.2, seed=i)
            sh.fill([p], '#6d5651', seed=400 + i, wobble=0.4, alpha=0.8)
        else:
            sh.line([(sx - ln * zd / 2, sy), (sx + ln * zd / 2, sy + rng.uniform(-2, 2))], '#5a4645', width=1.2 * min(2, d * zd),
                    alpha=0.35, seed=420 + i, passes=1, wobble=0.8)


def dust(sh, cam, t, k=1.0, soft=0.0):
    """Rüzgârda sürüklenen toz / ışık zerreleri."""
    for i in range(16):
        ph = (t * (0.03 + 0.01 * (i % 3)) + i * 0.137) % 1.0
        x = lerp(-60, W + 60, ph)
        y = 300 + (i * 271) % 1300 + 20 * math.sin(t * 0.9 + i)
        if soft:
            y -= ph * 120
        r = 2.2 + (i % 3)
        sh.fill([oval(x, y, r * 2.6, r, 0.1, n=10)], mix('#e8d2bc', '#f6dfc0', soft), alpha=0.5 * k, seed=500 + i, wobble=0.3)


def shadow_of(sh, cam, x, scale, length=1.0, k=0.28, sit=0.0):
    sx, sy = cam.p(x, G)
    z = cam.zoom * scale
    sh.darken(sx - 60 * z * length, sy + 2 * z, (70 + 50 * length) * z, 9 * z, k)


# ===================================================================== semboller
def obj_letter(sh, cx, cy, s, prog, alpha, rot, seed):
    c, sn = math.cos(rot), math.sin(rot)
    def r(pts):
        return [(cx + (x * c - y * sn) * s, cy + (x * sn + y * c) * s) for x, y in pts]
    paper = r([(-24, -30), (22, -32), (25, 30), (-22, 32)])
    if prog > 0.3:
        sh.fill([paper], '#efe6d6', alpha=alpha * ramp(prog, 0.3, 0.6), seed=seed, shade=0.3, light=(1, -0.5))
    sh.line(paper + paper[:1], INK, width=1.6 * s, alpha=0.8 * alpha, seed=seed + 1, progress=min(1, prog * 1.4))
    for k in range(5):  # yarım kalmış satırlar
        wl = 36 if k < 3 else (20 if k == 3 else 8)
        ln = r([(-16, -18 + k * 9), (-16 + wl, -18 + k * 9 + 1)])
        sh.line(ln, '#4c5070', width=1.1 * s, alpha=0.7 * alpha, seed=seed + 2 + k, progress=clamp(prog * 2 - 0.8 - k * 0.12),
                passes=1)


def obj_clock(sh, cx, cy, s, prog, alpha, t, seed):
    face = oval(cx, cy, 26 * s, 26 * s, n=30)
    if prog > 0.3:
        sh.fill([face], '#e4d7bf', alpha=alpha * ramp(prog, 0.3, 0.6), seed=seed, shade=0.4, light=(1, -0.5))
    sh.line(face + face[:1], INK, width=2.0 * s, alpha=0.8 * alpha, seed=seed + 1, progress=min(1, prog * 1.4))
    if prog > 0.6:
        a1 = t * 9.0 + math.sin(t * 23) * 0.6   # deli gibi dönen akrep
        a2 = -t * 2.0
        for a, l in ((a1, 18), (a2, 12)):
            sh.line([(cx, cy), (cx + l * s * math.sin(a), cy - l * s * math.cos(a))], INK, width=1.6 * s, alpha=alpha,
                    seed=seed + 3, passes=1)
        # çatlak
        sh.line([(cx - 20 * s, cy - 10 * s), (cx - 6 * s, cy - 2 * s), (cx - 10 * s, cy + 8 * s), (cx + 4 * s, cy + 20 * s)],
                INK, width=1.2 * s, alpha=0.8 * alpha, seed=seed + 4, passes=1)
        sh.line([(cx - 3 * s, cy - 36 * s), (cx + 3 * s, cy - 36 * s)], INK, width=3 * s, alpha=alpha, seed=seed + 5)


def obj_flower(sh, cx, cy, s, prog, alpha, fade, t, seed):
    stem = [(cx, cy + 30 * s), (cx + 4 * s, cy + 10 * s), (cx, cy)]
    sh.line(stem, '#56704e', width=2.2 * s, alpha=alpha * (1 - 0.4 * fade), seed=seed, progress=min(1, prog * 1.5))
    if prog > 0.4:
        col = mix('#c96f78', '#9c8c88', fade)
        for k in range(5):
            if k < int(fade * 3.0):
                continue  # dökülen yapraklar
            a = k * 1.256 + 0.3
            p = oval(cx + 9 * s * math.cos(a), cy - 2 * s + 9 * s * math.sin(a), 7 * s, 4.5 * s, a, n=12)
            sh.fill([p], col, alpha=alpha * ramp(prog, 0.4, 0.7), seed=seed + 2 + k, wobble=0.5)
        sh.fill([oval(cx, cy - 2 * s, 4 * s, 4 * s, n=10)], '#d9a35b', alpha=alpha, seed=seed + 9)
        # düşen taç yaprak
        if fade > 0.2:
            fy = cy + 20 * s + ((t * 30) % 60) * s
            sh.fill([oval(cx + 10 * s + 8 * s * math.sin(t * 3), fy, 6 * s, 3.5 * s, t, n=10)], col, alpha=alpha * 0.8,
                    seed=seed + 10)


def obj_chair(sh, cx, cy, s, prog, alpha, rot, seed):
    c, sn = math.cos(rot), math.sin(rot)
    def r(pts):
        return [(cx + (x * c - y * sn) * s, cy + (x * sn + y * c) * s) for x, y in pts]
    lines = [r([(-14, -30), (-14, 22)]), r([(-14, 0), (16, 0)]), r([(16, 0), (16, 22)]), r([(-14, 2), (-14, 22)]),
             r([(-14, -30), (-6, -30)]), r([(-14, -16), (-6, -16)]), r([(-8, 0), (-8, 22)]), r([(10, 0), (10, 22)])]
    seatp = r([(-16, -4), (18, -4), (18, 3), (-16, 3)])
    if prog > 0.4:
        sh.fill([seatp], '#8a6a55', alpha=alpha * ramp(prog, 0.4, 0.7), seed=seed)
    for k, ln in enumerate(lines):
        sh.line(ln, '#3a2e30', width=2.4 * s, alpha=0.85 * alpha, seed=seed + 1 + k, progress=clamp(prog * 2 - k * 0.12),
                passes=1)


# ===================================================================== ana karakter
def main_pose(t):
    near, far, bob, ph, walk = gait(t)
    sway = math.sin(ph * 2 * math.pi) * walk
    p = dict(feet=[near, far], hip_drop=bob + 4, bend=0.55 + 0.05 * math.sin(ph * 4 * math.pi) * walk, sway=sway,
             head_tilt=0.15, burden_scale=1.0, hands=[None, None])
    return p


def draw_main(sh, cam, t, pose, x, scale=1.0, line_alpha=0.85):
    sx, sy = cam.p(x, G)
    T = Tf(sx, sy, s=scale * cam.zoom, flip=1)
    return figure(sh, T, MAIN, pose, seed=1000, burden=True, line_alpha=line_alpha), T


def hands_on_straps(pose):
    """Eller askıları kavrar (göğüs önünde)."""
    bend = pose['bend']
    L1, L2 = pose.get('legs', (48, 46))
    hipy = -(L1 + L2 - 6) + pose['hip_drop']
    shx, shy = 40 * math.sin(bend), hipy - 40 * math.cos(bend)
    return [(shx + 12, shy + 18), (shx + 6, shy + 14)]


# ===================================================================== SAHNELER
def scene_bg(sh, t, mood_k):
    v = (int(t * 12)) % 2
    a = build_bg(0, v)
    if mood_k > 0:
        b = build_bg(1, v)
        sh.img = a * (1 - mood_k) + b * mood_k
    else:
        sh.img = a.copy()


def s1_s2_s3(sh, t):
    """0 - 21 sn: tek akış (kesintisiz). Kamera yaklaşır, arkadaşlar gelir/gider, yük büyür."""
    x = main_x(t)
    # --- kamera
    k1 = ease_io(t / 6.4)
    k2 = ease_io((t - 6.4) / 1.6)
    k3 = ease_io((t - 12.6) / 1.4)
    zoom = lerp(1.0, 1.55, k1)
    cx = lerp(540, x + 40, k1)
    cy = lerp(960, G - 170, k1)
    if t > 6.4:
        zoom = lerp(zoom, 1.85, k2)
        cx = lerp(cx, x + 135, k2)
        cy = lerp(cy, G - 150, k2)
    if t > 11.0:  # arkadaşlar uzaklaşırken kamera hafif açılır
        k = ease_io((t - 11.0) / 1.6)
        cx = lerp(cx, x + 170, k)
    if t > 12.6:
        zoom = lerp(zoom, 1.72, k3)
        cx = lerp(cx, x + 70, k3)
        cy = lerp(cy, G - 175, k3)
    cam = Cam(cx, cy, zoom)
    scene_bg(sh, t, 0)
    draw_far(sh, cam, t, 0)
    ground_marks(sh, cam, t)
    # --- çatlaklar (S3)
    for i, (tc, fx, near) in enumerate(CONTACTS_S3):
        if t < tc:
            break
        g = ease((t - tc) / 0.45)
        rng = np.random.default_rng(900 + i)
        for br in range(2 + i % 2):
            pts = [(fx, G + 1)]
            ang = rng.uniform(-0.35, 0.35) + (math.pi if br % 2 else 0)
            L = rng.uniform(28, 60) * (1 + i * 0.03)
            for k in range(5):
                a = ang + rng.normal(0, 0.4)
                px, py = pts[-1]
                pts.append((px + math.cos(a) * L / 5, py + math.sin(a) * L / 5 * 0.25 + rng.normal(0, 1.2)))
            sh.line(cam.ps(pts), '#2b2230', width=1.5 * cam.zoom, alpha=0.75, seed=950 + i * 3 + br, progress=g, passes=1)
    # --- ana karakter pozu
    pose = main_pose(t)
    upright = ramp(t, EV['straighten'], EV['straighten'] + 0.55) * (1 - ramp(t, EV['rebend'], EV['rebend'] + 0.8))
    pose['bend'] = lerp(pose['bend'], 0.03, upright)
    pose['hip_drop'] = lerp(pose['hip_drop'], 0.0, upright)
    pose['head_tilt'] = lerp(0.15, -0.12, upright)
    rebend = ramp(t, EV['rebend'], EV['rebend'] + 0.8)
    if t > EV['rebend']:
        pose['bend'] = lerp(0.03, 0.72, rebend) if t < 13.3 else pose['bend'] + 0.12
        pose['hip_drop'] += 6 * rebend
        pose['head_tilt'] = lerp(-0.12, 0.35, rebend) if t < 13.3 else 0.3
        if 12.9 < t < 13.3:
            pose['sway'] = math.sin(t * 40) * 0.4  # titreme
    # S3: yük büyür
    grow = ramp(t, 13.6, 20.6)
    pose['burden_scale'] = 1.0 + 0.42 * grow
    pose['burden_dark'] = grow
    pose['bend'] += 0.18 * grow
    pose['hip_drop'] += 5 * grow
    if 19.4 < t < 19.8:  # tökezleme
        pose['bend'] += 0.12 * math.sin((t - 19.4) / 0.4 * math.pi)
    pose['hands'] = hands_on_straps(pose)
    # arkadaşlar + kutu
    fr = friends_state(t, x)
    if fr and fr['carry_main']:
        pose['hands'][0] = fr['main_hand_local']
    if t > 13.6:  # iplerle sembolleri tutar: eller öne/yukarı
        hk = ramp(t, 14.2, 14.8)
        hs = hands_on_straps(pose)
        shx, shy = hs[0][0] - 12, hs[0][1] - 18
        wob = math.sin(t * 2.3) * 3
        pose['hands'] = [(lerp(hs[0][0], shx + 30, hk), lerp(hs[0][1], shy - 6 + wob, hk)),
                         (lerp(hs[1][0], shx + 22, hk), lerp(hs[1][1], shy - 16 - wob, hk))]
    shadow_of(sh, cam, x, 1.0, 1.0 + 0.4 * grow)
    if fr:
        draw_friends(sh, cam, t, fr, behind=True)
    info, T = draw_main(sh, cam, t, pose, x)
    if fr:
        draw_friends(sh, cam, t, fr, behind=False)
    # --- semboller (S3)
    if t > EV['obj1'] - 0.1:
        draw_symbols(sh, cam, t, x, info, release=0.0)
    dust(sh, cam, t, 1.0)
    return cam


def friends_state(t, mx):
    if t < EV['friends_in'] or t > EV['friends_gone'] + 0.2:
        return None
    x77 = main_x(7.7)
    # B (turkuaz, kutuyu taşır) ve C (turuncu)
    arrive = ease((t - EV['friends_in']) / 1.35)
    bx = lerp(x77 + 430, x77 + 118, arrive)
    cxx = lerp(x77 + 500, x77 + 175, arrive)
    walking_in = t < EV['friends_in'] + 1.35
    carry = EV['lift'] <= t < EV['handoff']
    away = ramp(t, EV['handoff'] + 0.25, EV['friends_gone'])
    d = 1.0
    if t >= EV['lift']:
        dx = mx - main_x(EV['lift'])
        bx += dx
        cxx += dx
    if t >= EV['handoff']:
        bx += 230 * away + 0
        cxx += 230 * away - 25 * ramp(t, EV['handoff'], EV['handoff'] + 0.4)
        d = lerp(1.0, 0.32, away)
    alpha = 1 - ramp(t, EV['friends_gone'] - 0.5, EV['friends_gone'])
    return dict(bx=bx, cx=cxx, d=d, walking=walking_in or t >= EV['handoff'] + 0.25 or (8.85 < t < 10.35),
                carry_main=carry, alpha=alpha, main_hand_local=(52, -112), away=away)


def draw_friends(sh, cam, t, fr, behind):
    d = fr['d']
    y = lerp(HOR, G, d) if d < 1 else G
    # B: kutuyu taşıyan (önde), C: arkada
    stag = ramp(t, EV['friends_in'], EV['lift']) * (1 - ramp(t, EV['lift'], EV['lift'] + 0.3))
    happy = ramp(t, EV['handoff'], EV['handoff'] + 0.3)
    for who, xx, pal, hat, faceL in (('C', fr['cx'], FRIEND_B, True, False), ('B', fr['bx'], FRIEND_A, True, True)):
        if (who == 'C') != behind:
            continue
        zd = cam.zd(d)
        sx, sy = cam.p(xx, y, d)
        hop = abs(math.sin(t * 9 + (0 if who == 'B' else 1.3))) * 9 * happy
        T = Tf(sx, sy - hop * cam.zoom * d, s=0.86 * cam.zoom * d * zd / cam.zoom * (cam.zoom), flip=-1 if (t < EV['handoff'] + 0.25) else 1)
        T.s = 0.86 * cam.zoom * d * (zd / max(cam.zd(1.0), 1e-3)) * (cam.zd(1.0) / cam.zoom)
        walk = fr['walking']
        ph = t * (1.4 if happy > 0.5 else 0.9) + (0 if who == 'B' else 0.4)
        fn = walk_feet(ph, 20, 8)
        ff = walk_feet(ph + 0.5, 20, 8)
        feet = [(fn[0], -fn[1]), (ff[0], -ff[1])] if walk else [(7, 0), (-7, 0)]
        pose = dict(feet=feet, legs=(40, 38), torso=34, bend=0.1 + 0.25 * stag * (who == 'B'), hat=hat, hair=False,
                    hip_drop=3, head_tilt=-0.1 * happy)
        box_local = None
        if who == 'B' and t < EV['handoff'] + 0.25 + 3:
            # kutu B'nin önünde (B sola bakarken yerel +x = sola)
            tilt = 0.18 * math.sin(t * 6) * stag
            bxl, byl = 34, -64 + 6 * stag
            if t >= EV['lift']:
                byl -= 10
            pose['hands'] = [(bxl - 14, byl + 4), (bxl - 10, byl - 2)]
            box_local = (bxl, byl, tilt)
        if who == 'C' and happy > 0:
            pose['hands'] = [(26, -110 - 10 * math.sin(t * 8)), None]  # el sallar
        if who == 'C' and EV['handoff'] <= t:
            pose['hands'][1] = None
        sh_seed = 2000 if who == 'B' else 3000
        if box_local is not None and t < EV['handoff']:
            draw_box(sh, T, box_local, t)
        figure(sh, T, pal, pose, seed=sh_seed, burden=False, line_alpha=0.85 * fr['alpha'])
        if box_local is not None and t >= EV['handoff']:
            draw_box(sh, T, (box_local[0] - 4, box_local[1] - 4, 0.0), t)
        if fr['alpha'] < 1:  # pastelle silinir
            pass


def draw_box(sh, T, b, t):
    bx, by, rot = b
    c, s = math.cos(rot), math.sin(rot)
    pts = [(bx + x * c - y * s, by + x * s + y * c) for x, y in [(-30, -24), (30, -24), (30, 24), (-30, 24)]]
    sp = T(pts)
    sh.fill([sp], '#93704f', seed=2100, shade=0.6, hatch=0.6, light=(1, -0.5), shade_col='#3d2b28')
    sh.line(sp + sp[:1], INK, width=1.8 * T.s, alpha=0.85, seed=2101)
    for k in (-1, 1):
        ln = T([(bx + k * 12 * c - (-24) * s, by + k * 12 * s + (-24) * c), (bx + k * 12 * c - 24 * s, by + k * 12 * s + 24 * c)])
        sh.line(ln, '#4a3428', width=1.2 * T.s, alpha=0.6, seed=2102 + k, passes=1)


SYM = [  # (tür, görünme zamanı, yerel ofset (x,y), el)
    ('letter', EV['obj1'], (95, -265), 0),
    ('clock', EV['obj2'], (160, -190), 0),
    ('flower', EV['obj3'], (48, -330), 1),
    ('chair', EV['obj4'], (185, -300), 1),
]


def draw_symbols(sh, cam, t, x, info, release=0.0, rel_t=None):
    s = cam.zoom * 1.55
    for i, (kind, t0, (ox, oy), hand) in enumerate(SYM):
        if t < t0:
            continue
        prog = clamp((t - t0) / 0.9)
        bob_x = 6 * math.sin(t * 1.3 + i * 1.7) + 10 * math.sin(t * 0.6 + i)
        bob_y = 7 * math.sin(t * 1.1 + i * 2.1)
        alpha = 1.0
        drift = 0.0
        if rel_t is not None and t > rel_t:
            drift = ease((t - rel_t) / 1.8)
            alpha = 1 - ramp(t, rel_t + 0.6, rel_t + 1.9)
        wx = x + ox + bob_x + drift * (120 + 40 * i)
        wy = G + oy + bob_y - drift * (260 + 50 * i)
        cx, cy = cam.p(wx, wy)
        if alpha <= 0.01:
            continue
        hx, hy = info['hand'] if hand == 0 else info.get('hand_far', info['hand'])
        anchor = (cx, cy + 36 * s * (0.9 if kind != 'flower' else 1.1))
        # ip (gerilmiş, hafif sarkık)
        if drift < 0.3:
            midx, midy = (hx + anchor[0]) / 2, (hy + anchor[1]) / 2 + 10 * s
            sh.line([(hx, hy), (midx, midy), anchor], '#3a3346', width=1.0 * s, alpha=0.6 * alpha * (1 - drift * 3),
                    seed=700 + i, passes=1, progress=min(1, prog * 1.5))
        else:
            sh.line([anchor, (anchor[0] - 10 * s, anchor[1] + 30 * s), (anchor[0] + 4 * s, anchor[1] + 56 * s)], '#3a3346',
                    width=1.0 * s, alpha=0.5 * alpha, seed=700 + i, passes=1)
        rot = 0.15 * math.sin(t * 1.4 + i) + drift * 0.8
        if kind == 'letter':
            obj_letter(sh, cx, cy, s, prog, alpha, rot, 710)
        elif kind == 'clock':
            obj_clock(sh, cx, cy, s, prog, alpha, t, 720)
        elif kind == 'flower':
            obj_flower(sh, cx, cy, s, prog, alpha, ramp(t, t0 + 1.0, 21.0), t, 730)
        else:
            obj_chair(sh, cx, cy, s, prog, alpha, rot, 740)


# ---------------------------------------------------------------- S4 + S5
def burden_rest_x():
    return main_x(21.0) - 190


def collapse_pose(t):
    x = main_x(21.0)
    pose = main_pose(21.0)
    pose['feet'] = [(8, 0), (-8, 0)]
    pose['burden_scale'] = 1.42
    pose['burden_dark'] = 1.0
    pose['bend'] = 0.85
    pose['hip_drop'] = 13
    pose['head_tilt'] = 0.3
    # adım denemesi
    ts = clamp((t - EV['try_step']) / 1.2)
    if 0 < ts < 1:
        lift = math.sin(ts * math.pi)
        pose['feet'][0] = (8 + 10 * lift, -9 * lift + 1.5 * math.sin(t * 50) * lift)
        pose['bend'] += 0.06 * lift
    # eller iplere -> bırakır -> sarkar
    hs = hands_on_straps(pose)
    up = [(hs[0][0] + 18, hs[0][1] - 24 + 3 * math.sin(t * 2.3)), (hs[1][0] + 10, hs[1][1] - 34)]
    drop = ramp(t, EV['release'], EV['release'] + 0.6)
    hang = [(14 + 30 * math.sin(pose['bend']), -60), (8 + 30 * math.sin(pose['bend']), -62)]
    pose['hands'] = [(lerp(up[i][0], hang[i][0], drop), lerp(up[i][1], hang[i][1], drop)) for i in range(2)]
    # dizler çöker
    kb = ramp(t, EV['knees'], EV['slip'] + 0.2)
    pose['hip_drop'] = lerp(pose['hip_drop'], 40, kb)
    pose['feet'][0] = (lerp(pose['feet'][0][0], 18, kb), pose['feet'][0][1])
    pose['bend'] = lerp(pose['bend'], 1.0, kb)
    if EV['knees'] < t < EV['slip']:
        pose['sway'] = math.sin(t * 34) * 0.35 * kb
    # yük kayar
    sl = clamp((t - EV['slip']) / (EV['crash'] - EV['slip']))
    if sl > 0:
        R = 92 * 1.42
        L1, L2 = 48, 46
        hipy = -(L1 + L2 - 6) + pose['hip_drop']
        shx, shy = 40 * math.sin(pose['bend']), hipy - 40 * math.cos(pose['bend'])
        bs = 1.42
        b0 = (shx - 6 - 92 * bs * 1.02 * math.cos(pose['bend'] * 0.5),
              shy - 92 * bs * 0.25 + 92 * bs * 0.5 * math.sin(pose['bend']))
        b1 = (burden_rest_x() - x, -R * 0.93)
        e = sl ** 2
        bxl = lerp(b0[0], b1[0], e) - 30 * math.sin(sl * math.pi)
        byl = lerp(b0[1], b1[1], e) - 40 * math.sin(sl * math.pi) * (1 - sl)
        pose['burden_detached'] = (bxl, byl, -0.9 * e)
    if t >= EV['crash']:
        pose['burden_detached'] = (burden_rest_x() - x, -92 * 1.42 * 0.93, -0.9 + 0.04 * math.exp(-(t - EV['crash']) * 6) * math.sin((t - EV['crash']) * 30))
    # oturuş
    st = ramp(t, EV['slip'] + 0.25, EV['sat'])
    if st > 0:
        pose['sit'] = st
        pose['feet'] = [(lerp(pose['feet'][0][0], 40, st), 0), (lerp(pose['feet'][1][0], 30, st), 0)]
        pose['bend'] = lerp(pose['bend'], 0.55, st)
        pose['hip_drop'] = lerp(pose['hip_drop'], 0, st)
        pose['head_tilt'] = lerp(0.3, 0.55, st)
        knee_hand = [(36, -40), (30, -42)]
        pose['hands'] = [(lerp(pose['hands'][i][0], knee_hand[i][0], st), lerp(pose['hands'][i][1], knee_hand[i][1], st))
                         for i in range(2)]
    return pose


def plant(sh, cam, x, t, h, leaves, seed=800):
    if h <= 0.5:
        return
    s = cam.zoom
    base = cam.p(x, G + 1)
    tip = (base[0] + 2 * s, base[1] - h * s)
    sh.line([base, (base[0] - 1.5 * s, base[1] - h * 0.5 * s), tip], '#5f8a4f', width=2.4 * s, alpha=0.95, seed=seed,
            passes=2, wobble=0.4)
    for k in range(leaves):
        f = clamp(leaves - k) if isinstance(leaves, float) else 1.0
        ly = base[1] - h * s * (0.55 + 0.4 * (k // 2) / max(1, (int(leaves) + 1) // 2))
        side = 1 if k % 2 == 0 else -1
        sz = 7 * s * min(1.0, h / 18.0) * (1 - 0.25 * (k // 2))
        sway = 0.12 * math.sin(t * 1.2 + k)
        p = oval(base[0] + side * sz * 0.9, ly, sz, sz * 0.48, side * 0.45 + sway, n=14)
        sh.fill([p], '#7fae5f', seed=seed + 1 + k, wobble=0.3, shade=0.4, light=(1, -0.5), shade_col='#2f4a2a')
        sh.line(p + p[:1], '#2e3a2a', width=1.0 * s, alpha=0.6, seed=seed + 10 + k, passes=1)


def s4_s5(sh, t):
    x = main_x(21.0)
    soft = ramp(t, 30.5, 36.0)
    # --- kamera: yavaş itme (S4) -> yavaş geri çekilme (S5)
    push = ease_io((t - 21.0) / 7.5)
    zoom = lerp(1.72, 3.1, push)
    cx = lerp(x + 70, x + 8, push)
    cy = lerp(G - 175, G - 75, push)
    if t > 29.6:
        pb = ease_io((t - 29.6) / 8.6)
        zoom = lerp(3.1, 1.3, pb)
        cx = lerp(x + 8, x - 60, pb)
        cy = lerp(G - 75, G - 330, pb)
    shake = (0, 0)
    if EV['crash'] <= t < EV['crash'] + 0.5:
        k = 1 - (t - EV['crash']) / 0.5
        shake = (5 * k * math.sin(t * 90), 7 * k * math.cos(t * 70))
    cam = Cam(cx, cy, zoom, shake)
    scene_bg(sh, t, soft)
    draw_far(sh, cam, t, soft)
    ground_marks(sh, cam, t)
    for i, (tc, fx, near) in enumerate(CONTACTS_S3):  # eski çatlaklar
        rng = np.random.default_rng(900 + i)
        for br in range(2 + i % 2):
            pts = [(fx, G + 1)]
            ang = rng.uniform(-0.35, 0.35) + (math.pi if br % 2 else 0)
            L = rng.uniform(28, 60) * (1 + i * 0.03)
            for k in range(5):
                a = ang + rng.normal(0, 0.4)
                px, py = pts[-1]
                pts.append((px + math.cos(a) * L / 5, py + math.sin(a) * L / 5 * 0.25 + rng.normal(0, 1.2)))
            if abs(fx - x) < 600:
                sh.line(cam.ps(pts), '#2b2230', width=1.5 * cam.zoom, alpha=0.6, seed=950 + i * 3 + br, passes=1)
    # yük çarpınca büyük çatlaklar
    bxw = burden_rest_x()
    if t > EV['crash']:
        g = ease((t - EV['crash']) / 0.4)
        rng = np.random.default_rng(31)
        for br in range(6):
            pts = [(bxw + rng.uniform(-60, 60), G + 2)]
            ang = math.pi * (br % 2) + rng.uniform(-0.3, 0.3)
            for k in range(6):
                a = ang + rng.normal(0, 0.35)
                px, py = pts[-1]
                pts.append((px + math.cos(a) * 22, py + math.sin(a) * 4 + rng.normal(0, 1.5)))
            sh.line(cam.ps(pts), '#251d2a', width=1.8 * cam.zoom, alpha=0.75, seed=980 + br, progress=g, passes=1)
    pose = collapse_pose(t)
    if t > EV['sat']:  # nefes ve S5'te bitkiye dönüş
        br = math.sin(t * 1.6) * 1.2
        pose['hip_drop'] += br * 0.3
        look = ramp(t, 31.5, 34.5)
        pose['head_tilt'] = lerp(0.55, 0.38, look)
        pose['bend'] = lerp(0.55, 0.48, look)
        reach = ramp(t, 34.2, 36.2)
        if reach > 0:
            pose['hands'][0] = (lerp(36, 58, reach), lerp(-40, -14, reach))
    # gölgeler
    sit = pose.get('sit', 0)
    shadow_of(sh, cam, x, 1.0, 1.4 * (1 - 0.5 * sit))
    if t >= EV['crash'] - 0.1:
        bsx, bsy = cam.p(bxw, G)
        sh.darken(bsx - 30 * cam.zoom, bsy + 3 * cam.zoom, 170 * cam.zoom, 16 * cam.zoom, 0.35)
    # semboller uçup gider
    pre = dict(hand=cam.p(x + 40, G - 150))
    info, T = draw_main(sh, cam, t, pose, x)
    if t < EV['release'] + 2.2:
        draw_symbols(sh, cam, t, x, info, rel_t=EV['release'])
    # yük ayrıldıysa ayrıca çiz (karakterin arkasında kalması için: ayrıldıktan sonra öne değil, yan tarafta)
    if pose.get('burden_detached') is not None:
        # figure() ayrılmış yükü çizmez: burada çiz
        bxl, byl, brot = pose['burden_detached']
        R = 92 * 1.42
        shape = oval(bxl, byl, R * 1.08, R * 0.95, brot - 0.15, n=40, lump=0.045, seed=3)
        sp = T(shape)
        sh.fill([sp], hexc(MAIN['burden']) * 0.65, seed=1001, shade=0.9, hatch=0.9, light=(1, -0.5), shade_col='#0e1222')
        sh.line(sp + sp[:1], INK, width=2.6 * T.s, alpha=0.8, seed=1003)
        # karakteri yükün önünde tekrar çiz (yük arkada kalsın)
        info, T = draw_main(sh, cam, t, dict(pose, burden_detached=(0, 0, 0)), x)
    # toz bulutu
    if EV['crash'] <= t < EV['crash'] + 1.6:
        k = (t - EV['crash']) / 1.6
        rng = np.random.default_rng(55)
        for i in range(14):
            a = rng.uniform(math.pi * 0.9, math.pi * 2.1)
            r = (60 + 180 * k) * rng.uniform(0.6, 1.2)
            px = bxw + math.cos(a) * r * 1.4
            py = G - 10 + math.sin(a) * r * 0.35 - 40 * k
            sx, sy = cam.p(px, py)
            rr = (18 + 40 * k) * cam.zoom * rng.uniform(0.6, 1.2)
            sh.fill([oval(sx, sy, rr, rr * 0.7, n=16, lump=0.12, seed=i)], '#c9ad94', alpha=0.55 * (1 - k), seed=1200 + i,
                    wobble=2.0)
    # gözyaşı
    hx, hy = info['head']
    face = (hx + 6 * cam.zoom, hy + 8 * cam.zoom)
    land_w = (x + 30, G)
    lx, ly = cam.p(*land_w)
    if EV['tear'] <= t < EV['tear_land']:
        k = (t - EV['tear']) / (EV['tear_land'] - EV['tear'])
        k2 = k * k
        tx, ty = lerp(face[0], lx, k), lerp(face[1], ly, k2)
        r = 3.2 * cam.zoom
        drop = [(tx, ty - r * 2.2)] + oval(tx, ty, r, r * 1.1, n=14)[3:12]
        sh.fill([drop], '#a9d2d4', seed=1300, wobble=0.2, glow=0.08)
        sh.line(drop + drop[:1], '#3e5d66', width=1.0 * cam.zoom, alpha=0.6, seed=1301, passes=1)
    elif EV['tear'] - 0.4 <= t < EV['tear']:
        k = (t - EV['tear'] + 0.4) / 0.4
        r = 2.6 * cam.zoom * k
        sh.fill([oval(face[0], face[1], r, r * 1.1, n=12)], '#a9d2d4', seed=1300, wobble=0.2)
    if t >= EV['tear_land']:
        k = clamp((t - EV['tear_land']) / 0.8)
        sh.darken(lx, ly + 2, 14 * cam.zoom, 4 * cam.zoom, 0.35, '#3b2e33')
        if k < 1:
            for j in range(2):
                rr = (6 + 26 * k + j * 10) * cam.zoom
                ring = oval(lx, ly + 1, rr, rr * 0.22, n=24)
                sh.line(ring + ring[:1], '#9fc4c4', width=1.0 * cam.zoom, alpha=0.5 * (1 - k), seed=1310 + j, passes=1)
    # filiz
    if t >= EV['sprout']:
        g1 = ease((t - EV['sprout']) / 1.3)
        g2 = ease((t - 31.0) / 6.0)
        h = 4 + 16 * g1 + 22 * g2
        leaves = 2 if t < 33.0 else (3 if t < 35 else 4)
        plant(sh, cam, x + 30, t, h, leaves)
        if t > 33:
            sh.glow(*cam.p(x + 30, G - h * 0.6), 40 * cam.zoom, '#c9e3a8', 0.05 * soft)
    dust(sh, cam, t, 0.8, soft)
    return cam


def final_text(img_sheet, t):
    k = ramp(t, EV['text'], EV['text'] + 1.1)
    if k <= 0:
        return
    m = text_mask(FINAL_TEXT, FONT, 108, W / 2, 520, max_w=900)
    # soldan sağa "yazılma" + pürüzlü kalem dokusu
    xs = np.arange(W)[None, :]
    reveal = np.clip((k * 1.15 * W - xs) / 60.0, 0, 1)
    rows = np.arange(H)[:, None]
    m = m * reveal
    g = GRAIN_HI[:H, :W] * 0.25 + GRAIN_MID[:H, :W] * 0.25
    m = np.clip(m * (0.85 + g), 0, 1)
    col = hexc('#f4ead8')
    img_sheet.img = img_sheet.img * (1 - m[..., None] * 0.95) + col[None, None, :] * m[..., None] * 0.95
    # yumuşak gölge
    return


# ===================================================================== render
def render_pose(fi):
    t = fi / FPS
    sh = Sheet(seed=fi // 2)
    if t < 21.0:
        s1_s2_s3(sh, t)
    else:
        s4_s5(sh, t)
    if t >= EV['text'] - 0.2:
        dim = ramp(t, EV['text'] - 0.6, EV['text'] + 0.6) * 0.28
        sh.img = sh.img * (1 - dim) + hexc('#1a2033')[None, None, :] * dim
        final_text(sh, t)
    fade_in = 1 - ramp(t, 0.0, 0.6)
    return sh.finish(vignette=0.45, fade=fade_in, warmth=ramp(t, 30, 36) * 0.6)


def pose_index(fi):
    return (fi // 2) * 2


OUT = os.path.join(HERE, 'build', 'frames')


def job(fi):
    p = os.path.join(OUT, f'f{fi:04d}.jpg')
    if not os.path.exists(p):
        im = render_pose(fi)
        im.save(p, quality=94)
        if fi + 1 < int(DURATION * FPS):
            im.save(os.path.join(OUT, f'f{fi + 1:04d}.jpg'), quality=94)
    return fi


if __name__ == '__main__':
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', default='')
    ap.add_argument('--jobs', type=int, default=os.cpu_count())
    a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    if a.only:
        pd = os.path.join(HERE, 'build', 'preview')
        os.makedirs(pd, exist_ok=True)
        for ts in a.only.split(','):
            fi = pose_index(int(round(float(ts) * FPS)))
            render_pose(fi).save(os.path.join(pd, f'p_{float(ts):05.2f}.jpg'), quality=90)
            print('ok', ts, flush=True)
    else:
        from multiprocessing import Pool
        nf = int(DURATION * FPS)
        todo = list(range(0, nf, 2))
        with Pool(a.jobs) as pool:
            for i, _ in enumerate(pool.imap_unordered(job, todo, chunksize=1)):
                if i % 24 == 0:
                    print('poz', i, '/', len(todo), flush=True)
