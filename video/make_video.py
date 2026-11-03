"""Misafir Takımının Büyük Korkusu – 30 sn, 9:16 – tamamen ücretsiz üretim hattı."""
import sys, os, math, random, subprocess, time, json
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

import gfx, bg
from timeline import make_schedule, FPS, DUR, SPK_LABEL, SPK_COLOR, CHAR_X, SPEAKER_TO_CHARS

HERE = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(HERE, "build")
W, H = 720, 1280
S = bg.S
SHELF = bg.SHELF
NF = int(DUR * FPS)
FONT_B = "/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf"
FONT_BL = "/usr/share/fonts/opentype/inter/Inter-Black.otf"

ST = make_schedule()
NAMES = ["tabak", "fincan", "cayd", "pot1", "pot2", "pot3", "kazan"]
DRAW_ORDER = ["tabak", "fincan", "cayd", "pot1", "pot2", "pot3", "kazan"]
PHASE = {n: i * 1.7 for i, n in enumerate(NAMES)}
POT_DELAY = {"pot1": 0.0, "pot2": 0.04, "pot3": 0.08}


def clamp(x, a, b): return max(a, min(b, x))
def lerp(a, b, t): return a + (b - a) * t
def ease_io(p): return p * p * (3 - 2 * p) if p < 1 else 1.0
def ease_o(p): return 1 - (1 - p) ** 3


# ----------------------------------------------------------------------------- konuşma zarfları
ENV = {}
for lid, d in ST.items():
    if lid.startswith("_"): continue
    x = np.load(os.path.join(BUILD, f"{lid}.npy"))
    spf = 44100 // FPS
    nfr = len(x) // spf + 1
    r = np.array([np.sqrt(np.mean(x[i * spf:(i + 1) * spf] ** 2) + 1e-12) for i in range(nfr)])
    r = r / (np.percentile(r, 92) + 1e-9)
    # hafif yumuşatma
    r = np.convolve(np.pad(r, 1, mode="edge"), [0.25, 0.5, 0.25], mode="valid")
    ENV[lid] = np.clip(r, 0, 1.2)

CHAR_LINES = {n: [] for n in NAMES}
for lid, d in ST.items():
    if lid.startswith("_"): continue
    for c in SPEAKER_TO_CHARS[d["spk"]]:
        CHAR_LINES[c].append((lid, POT_DELAY.get(c, 0.0)))


def speak_level(name, t):
    for lid, off in CHAR_LINES[name]:
        d = ST[lid]
        tt = t - d["start"] - off
        if 0 <= tt < d["end"] - d["start"]:
            i = int(tt * FPS)
            e = ENV[lid]
            return float(e[min(i, len(e) - 1)]), lid
    return 0.0, None


def speaking_name_now(t):
    for lid, d in ST.items():
        if lid.startswith("_"): continue
        if d["start"] <= t <= d["end"] + 0.08:
            return lid
    return None


# ----------------------------------------------------------------------------- kamera
def cam_keys():
    k = [  # (varış zamanı, cx, cy, z, hareket süresi)
        (0.0, 360, 262, 1.25, 0.001),
        (0.98, 214, 352, 2.55, 0.80),             # kancadaki hızlı yaklaşma -> fincan
        (ST["L1"]["end"], 192, 354, 2.95, ST["L1"]["end"] - 0.98),
        (ST["L2"]["start"] + 0.22, 120, 346, 2.45, 0.30),
        (ST["L3"]["start"] + 0.24, 306, 356, 2.55, 0.30),
        (ST["L4"]["start"] + 0.22, 592, 352, 2.35, 0.30),
        (ST["L4"]["end"], 600, 352, 2.75, ST["L4"]["end"] - ST["L4"]["start"] - 0.22),
        (ST["L5"]["start"] + 0.22, 198, 354, 2.7, 0.30),
        (ST["L6a"]["start"] + 0.10, 340, 350, 1.6, 0.32),
        (ST["L7"]["start"] + 0.20, 606, 352, 2.6, 0.30),
        (ST["L7"]["end"], 606, 352, 3.0, ST["L7"]["end"] - ST["L7"]["start"] - 0.2),
        (ST["L8"]["start"] + 0.35, 380, 372, 1.38, 0.55),          # ev sahibi: geri çekil, aşağı bak
        (ST["L8"]["end"], 340, 380, 1.45, ST["L8"]["end"] - ST["L8"]["start"] - 0.35),
        (ST["L9"]["start"] + 0.12, 196, 356, 2.8, 0.22),
        (ST["L10"]["start"] + 0.20, 604, 352, 2.7, 0.28),
        (ST["L11"]["start"] + 0.10, 606, 352, 2.75, 0.30),
        (ST["_end_speech"] + 0.05, 606, 350, 3.15, 0.55),          # öfkeli bakış: yavaş yaklaşma
        (28.10, 600, 345, 3.3, 1.0),
        (29.45, 360, 205, 1.55, 1.15),                              # yukarı tilt -> gizli gözler
    ]
    return k


CAM_KEYS = cam_keys()


def camera(t):
    prev = CAM_KEYS[0]
    state = np.array(prev[1:4], float)
    for key in CAM_KEYS[1:]:
        t1, cx, cy, z, dur = key
        t0 = t1 - dur
        if t <= t0:
            break
        p = clamp((t - t0) / dur, 0, 1)
        e = ease_o(p) if (t1 < 1.2 or dur < 0.35) else ease_io(p)
        tgt = np.array([cx, cy, z], float)
        state = state + (tgt - state) * e if p < 1 else tgt
        if p < 1:
            break
        prev = key
    cx, cy, z = state
    # --- zoom darbesi (final vuruş)
    tp = t - (ST["_end_speech"] + 0.05)
    if 0 <= tp < 0.4:
        z *= 1 + 0.07 * math.exp(-tp * 9)
    # --- titreşim
    amp = 1.1
    if 0.5 < t < 1.6: amp += 7 * math.exp(-(t - 0.5) * 2.6)
    if ST["L6a"]["start"] - 0.1 < t < ST["L6c"]["end"]: amp += 3.6
    if ST["_end_speech"] + 0.05 < t < 28.1: amp += 2.8
    if 0.0 <= t < 0.6: amp += 3 * (t / 0.6)
    shx = amp * (math.sin(2 * math.pi * 7.3 * t) + 0.6 * math.sin(2 * math.pi * 12.7 * t + 1.1))
    shy = amp * (math.sin(2 * math.pi * 6.1 * t + 2) + 0.6 * math.sin(2 * math.pi * 11.3 * t))
    # sınırlar (titreşimden sonra)
    vw, vh = W / z, H / z
    cx = clamp(cx + shx / z, vw / 2, W - vw / 2)
    cy = clamp(cy + shy / z, vh / 2, H - vh / 2)
    return cx, cy, z


# ----------------------------------------------------------------------------- yüz / ruh hali
def look_at(name, other):
    dx = clamp((CHAR_X[other] - CHAR_X[name]) / 90.0, -1, 1)
    return (dx, 0.0)


BLINK = {n: [] for n in NAMES}
_r = random.Random(5)
for n in NAMES:
    tt = _r.uniform(1.0, 3.0)
    while tt < DUR:
        BLINK[n].append(tt)
        tt += _r.uniform(2.0, 4.4)


def blinking(name, t):
    return any(0 <= t - b < 0.14 for b in BLINK[name])


def mood(name, t):
    m = dict(eye="open", brow="neutral", mouth="smile", look=(0.0, 0.0))
    L = ST
    end_sp = L["_end_speech"]
    sp = speak_level(name, t)[1]
    is_k = name == "kazan"
    if t < 0.56:
        return dict(eye="sleepy", brow="flat", mouth="closed", look=(0, 0.4))
    # kanca: kapak açıldıktan sonra herkes şaşkın
    if t < L["L1"]["start"]:
        m.update(eye="wide", brow="shock", mouth="o")
        return m
    if t < L["L2"]["start"] - 0.05:                 # L1: fincan panikte
        if name == "fincan": m.update(eye="wide", brow="worried", mouth="wide")
        else: m.update(eye="wide", brow="up", mouth="o", look=look_at(name, "fincan"))
        if is_k: m.update(eye="open", brow="angry", mouth="grumble", look=(-0.8, 0.2))
        return m
    if t < L["L3"]["start"] - 0.05:                 # L2: tabak
        if name == "tabak": m.update(eye="wide", brow="angry", mouth="wide")
        elif name == "fincan": m.update(eye="wide", brow="worried", mouth="closed", look=look_at(name, "tabak"))
        else: m.update(eye="wide", brow="up", mouth="a", look=look_at(name, "tabak"))
        if is_k: m.update(eye="open", brow="angry", mouth="grumble")
        return m
    if t < L["L4"]["start"] - 0.05:                 # L3: çaydanlık
        if name == "cayd": m.update(eye="wide", brow="worried", mouth="wide")
        else: m.update(eye="wide", brow="up", mouth="a", look=look_at(name, "cayd"))
        if is_k: m.update(eye="open", brow="angry", mouth="grumble")
        return m
    if t < L["L5"]["start"] - 0.05:                 # L4: kazan öfkeli
        if is_k: m.update(eye="angry", brow="angry", mouth="wide")
        else: m.update(eye="wide", brow="worried", mouth="o", look=look_at(name, "kazan"))
        return m
    if t < L["L6a"]["start"] - 0.02:                # L5: fincan haber veriyor
        if name == "fincan": m.update(eye="wide", brow="up", mouth="wide")
        elif is_k: m.update(eye="angry", brow="angry", mouth="grumble", look=(-0.7, 0.3))
        else: m.update(eye="open", brow="up", mouth="a", look=look_at(name, "fincan"))
        return m
    chat_end = max(L["L6a"]["end"], L["L6b"]["end"], L["L6c"]["end"])
    if t < chat_end + 0.05:                         # gevezelik
        if is_k: m.update(eye="angry", brow="angry", mouth="grumble", look=(-0.9, 0.2))
        elif name == "fincan": m.update(eye="happy", brow="up", mouth="wide")
        else: m.update(eye="wide", brow="up", mouth="smile")
        return m
    if t < L["L8"]["start"] - 0.35:                 # L7: kazan kendini beğenmiş
        if is_k: m.update(eye="open", brow="smug", mouth="wide")
        else: m.update(eye="sleepy", brow="flat", mouth="closed", look=look_at(name, "kazan"))
        return m
    if t < L["L9"]["start"] - 0.02:                 # L8: ev sahibi konuşuyor – herkes aşağı bakıyor
        if is_k: m.update(eye="wide", brow="up", mouth="smile", look=(0.0, 0.95))
        else: m.update(eye="wide", brow="up", mouth="a", look=(0.0, 0.95))
        return m
    if t < L["L10"]["start"] - 0.02:                # L9: fincan çığlık çığlığa
        if name == "fincan": m.update(eye="happy", brow="up", mouth="wide")
        elif name in ("tabak", "pot1", "pot2", "pot3"): m.update(eye="happy", brow="up", mouth="wide")
        elif name == "cayd": m.update(eye="open", brow="smug", mouth="smile")
        else: m.update(eye="sleepy", brow="smug", mouth="smile")
        return m
    if t < L["L11"]["start"] - 0.02:                # L10: kazan zafer
        if is_k: m.update(eye="happy", brow="up", mouth="wide")
        else: m.update(eye="open", brow="up", mouth="smile", look=look_at(name, "kazan"))
        return m
    if t < end_sp + 0.02:                           # L11: ev sahibi "kazanı komşuya verelim"
        k_t = t - L["L11"]["start"]
        if is_k:
            if k_t < 0.55: m.update(eye="happy", brow="up", mouth="smile")
            else: m.update(eye="wide", brow="shock", mouth="o")
        else: m.update(eye="open", brow="smug", mouth="smirk", look=look_at(name, "kazan"))
        return m
    if t < 28.1:                                    # öfkeli bakış
        if is_k: m.update(eye="angry", brow="angry", mouth="gritted", look=(-1.0, 0.1))
        else:
            away = t > end_sp + 0.9
            m.update(eye="open", brow="worried", mouth="a",
                     look=(0.0, -0.8) if away and name in ("cayd", "tabak") else look_at(name, "kazan"))
        return m
    # kanca: gizli bir şey var
    if is_k and t < 28.7:
        m.update(eye="angry", brow="angry", mouth="gritted", look=(-1.0, 0.1))
    else:
        m.update(eye="wide", brow="shock", mouth="o", look=(0.0, -0.95))
    return m


def mouth_from_level(level, base, name, f):
    if level < 0.06: return "closed" if base in ("smile", "closed", "grumble", "gritted") else base
    if level < 0.24: return "a"
    if level < 0.50: return "o" if (f // 2) % 2 else "mid"
    return "wide"


def pupil_target(name, f):
    return mood(name, f / FPS)["look"]


def pupil_at(name, f):
    px, py = pupil_target(name, max(f - 14, 0))
    for k in range(f - 13, f + 1):
        tx, ty = pupil_target(name, max(k, 0))
        px += (tx - px) * 0.32
        py += (ty - py) * 0.32
    return round(px * 3) / 3, round(py * 3) / 3


def body_motion(name, t, level):
    ph = PHASE[name]
    dy, sx, sy, rot = 0.0, 1.0, 1.0, 0.0
    sy += 0.010 * math.sin(2 * math.pi * 0.9 * t + ph)
    sx -= 0.005 * math.sin(2 * math.pi * 0.9 * t + ph)
    if level > 0:
        dy -= 3.4 * level
        sy += 0.065 * level
        sx -= 0.03 * level
        rot += 2.2 * math.sin(t * 19 + ph) * level
    k = t - 0.56
    if 0 <= k < 0.7:                                # kapak çarpınca sıçrama
        p = k / 0.7
        dy -= 17 * math.sin(math.pi * min(p * 1.6, 1.0)) * math.exp(-p * 1.2)
        rot += 5 * math.sin(k * 40 + ph) * math.exp(-k * 4)
    ca, cb = ST["L6a"]["start"], max(ST["L6a"]["end"], ST["L6b"]["end"], ST["L6c"]["end"])
    if ca <= t <= cb:                               # gevezelik titremesi
        rot += 2.6 * math.sin(t * 14 + ph)
        dy -= 1.5 * abs(math.sin(t * 11 + ph))
    if name == "kazan":
        if ST["L7"]["start"] <= t <= ST["L7"]["end"] + 0.2:
            sy *= 1.04; dy -= 2.0
        if ST["L10"]["start"] <= t <= ST["L10"]["end"]:
            dy -= 3 * abs(math.sin(t * 9))
        ge = ST["_end_speech"] + 0.05
        if ge <= t <= 28.7:
            rot += 1.4 * math.sin(t * 38)
            sx *= 1.025; sy *= 1.015
    if ST["L9"]["start"] <= t <= ST["L10"]["end"] and name != "kazan":  # sevinç zıplamaları
        dy -= 6.5 * abs(math.sin(t * 8.5 + ph))
    if ST["L8"]["start"] - 0.2 <= t <= ST["L8"]["end"]:     # öne eğilip aşağı bakma
        rot += 1.6 * (1 if CHAR_X[name] < 360 else -1) * 0.5
        dy += 1.0
    if t >= 28.1 and name != "kazan":
        dy -= 2.0
    return dy, sx, sy, rot


# ----------------------------------------------------------------------------- sprite'lar
SPR = {n: gfx.CHAR_BUILDERS[n]() for n in NAMES}
FACE_CACHE = {}


def get_sprite(name, eye, pup, mouth, brow):
    key = (name, eye, pup, mouth, brow)
    spr = FACE_CACHE.get(key)
    if spr is None:
        c = SPR[name]
        img = c["img"]
        f = gfx.face_layer(c["face"], img.width / gfx.K, img.height / gfx.K, eye, pup, mouth, brow)
        spr = img.copy()
        spr.alpha_composite(f)
        spr = spr.convert("RGBa")
        if len(FACE_CACHE) > 360:
            FACE_CACHE.pop(next(iter(FACE_CACHE)))
        FACE_CACHE[key] = spr
    return spr


def draw_sprite(frame, spr, sx, sy, kx, ky, rot_deg, ax, ay):
    th = math.radians(rot_deg)
    c, s = math.cos(th), math.sin(th)
    w, h = spr.size
    corners = []
    for (px, py) in ((0, 0), (w, 0), (w, h), (0, h)):
        vx, vy = (px - ax) * kx, (py - ay) * ky
        corners.append((sx + vx * c - vy * s, sy + vx * s + vy * c))
    x0 = int(math.floor(min(p[0] for p in corners))); x1 = int(math.ceil(max(p[0] for p in corners)))
    y0 = int(math.floor(min(p[1] for p in corners))); y1 = int(math.ceil(max(p[1] for p in corners)))
    if x1 < 0 or y1 < 0 or x0 > W or y0 > H or x1 - x0 < 2 or y1 - y0 < 2:
        return
    cx0, cy0 = max(x0, 0), max(y0, 0)
    cx1, cy1 = min(x1, W), min(y1, H)
    a = c / kx; b = s / kx; d = -s / ky; e = c / ky
    cc = ax + a * (cx0 - sx) + b * (cy0 - sy)
    ff = ay + d * (cx0 - sx) + e * (cy0 - sy)
    out = spr.transform((cx1 - cx0, cy1 - cy0), Image.AFFINE, (a, b, cc, d, e, ff), resample=Image.BICUBIC)
    frame.alpha_composite(out.convert("RGBA"), (cx0, cy0))


SHADOW = Image.new("RGBA", (240, 48), (0, 0, 0, 0))
_sd = ImageDraw.Draw(SHADOW)
_sd.ellipse([8, 8, 232, 40], fill=(40, 20, 8, 150))
SHADOW = SHADOW.filter(ImageFilter.GaussianBlur(7))
SHADOW_W = {"tabak": 108, "fincan": 124, "cayd": 118, "pot1": 74, "pot2": 62, "pot3": 52, "kazan": 156}

# ----------------------------------------------------------------------------- arka plan
BG = Image.open(os.path.join(BUILD, "bg.png")).convert("RGB") if os.path.exists(os.path.join(BUILD, "bg.png")) else bg.build()
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
VIG = 1 - 0.20 * np.clip(((xx / W - 0.5) * 2) ** 2 * 0.9 + ((yy / H - 0.5) * 2) ** 2 * 0.7, 0, 1.3)
VIG = np.repeat(VIG[..., None], 3, axis=2)

GLOW = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
_g = np.zeros((256, 256, 4), np.uint8)
_y, _x = np.mgrid[0:256, 0:256].astype(np.float32)
_d = np.clip(1 - np.sqrt((_x - 128) ** 2 + (_y - 128) ** 2) / 128, 0, 1) ** 2
_g[..., 0], _g[..., 1], _g[..., 2] = 255, 244, 190
_g[..., 3] = (_d * 255).astype(np.uint8)
GLOW = Image.fromarray(_g, "RGBA")

_rr = random.Random(21)
MOTES = [(_rr.uniform(30, 690), _rr.uniform(110, 395), _rr.uniform(0.6, 2.0), _rr.uniform(0, 6.28), _rr.uniform(0.2, 0.7)) for _ in range(46)]
POOF = [(_rr.uniform(30, 690), _rr.uniform(-60, -10), _rr.uniform(-30, 30), _rr.uniform(8, 20), _rr.uniform(0, 0.25)) for _ in range(42)]


def to_screen(wx, wy, cam):
    cx, cy, z = cam
    return (wx - (cx - W / z / 2)) * z, (wy - (cy - H / z / 2)) * z


def door_theta(t, delay=0.0):
    t = t - delay
    if t < 0.15: return 0.0
    if t < 0.45: return 18 * ((t - 0.15) / 0.30) ** 2
    if t < 0.62: return lerp(18, 90, ease_o((t - 0.45) / 0.17))
    k = t - 0.62
    return 82 + 8 * math.exp(-k * 7) * math.cos(k * 28)


def draw_doors(frame, t, cam):
    d = ImageDraw.Draw(frame)
    x_hl, x_hr, mid = 20.0, 700.0, 360.0
    dw = mid - x_hl - 1.0
    ytop, ybot = 90.0, 420.0
    for side in (-1, 1):
        th = door_theta(t, 0.0 if side < 0 else 0.05)
        thr = math.radians(th)
        wid = dw * abs(math.cos(thr))
        sn = math.sin(thr)
        hx = x_hl if side < 0 else x_hr
        fx = hx + (wid if side < 0 else -wid)
        grow = 16 * sn
        pts_w = [(hx, ytop), (fx, ytop - grow), (fx, ybot + grow), (hx, ybot)]
        pts = [to_screen(px, py, cam) for px, py in pts_w]
        shade = 1.0 - 0.38 * sn
        base = (int(126 * shade), int(156 * shade), int(130 * shade))
        d.polygon(pts, fill=base)
        # panel çerçevesi + iç panel
        ins = 0.08
        ipts_w = [(hx + (fx - hx) * 0.1, ytop + 16 - grow * 0.8), (hx + (fx - hx) * 0.9, ytop + 16 - grow * 0.8 - 0),
                  (hx + (fx - hx) * 0.9, ybot - 16 + grow * 0.8), (hx + (fx - hx) * 0.1, ybot - 16)]
        ipts = [to_screen(px, py, cam) for px, py in ipts_w]
        d.polygon(ipts, fill=(int(144 * shade), int(176 * shade), int(148 * shade)))
        d.line(pts + [pts[0]], fill=(int(74 * shade), int(96 * shade), int(78 * shade)), width=max(2, int(3 * cam[2] / 2)))
        # pirinç kulp (serbest kenara yakın)
        hxw = hx + (fx - hx) * 0.88
        hy0, hy1 = 220, 292
        hp = [to_screen(hxw, hy0, cam), to_screen(hxw + (4 if side < 0 else -4) * abs(math.cos(thr)), hy1, cam)]
        d.line(hp, fill=(222, 176, 84), width=max(3, int(5 * cam[2] / 2)))


def draw_overlays(frame, t, cam):
    z = cam[2]
    # --- kapak açılış parıltısı + toz bulutu
    if 0.5 <= t < 1.9:
        ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        od = ImageDraw.Draw(ov)
        for (px, off, vx, r0, delay) in POOF:
            k = t - 0.55 - delay
            if k < 0 or k > 1.4: continue
            wx = px + vx * k
            wy = SHELF + off * 0.2 - k * 38
            r = (r0 + k * 18) * z
            a = int(110 * (1 - k / 1.4) ** 1.5)
            sx, sy = to_screen(wx, wy, cam)
            od.ellipse([sx - r, sy - r * 0.7, sx + r, sy + r * 0.7], fill=(236, 224, 202, a))
        ov = ov.filter(ImageFilter.GaussianBlur(6))
        frame.alpha_composite(ov)
    if 0.52 <= t < 0.85:
        a = int(120 * (1 - (t - 0.52) / 0.33))
        frame.alpha_composite(Image.new("RGBA", (W, H), (255, 244, 214, a)))
    # --- havada uçuşan toz zerrecikleri
    d = ImageDraw.Draw(frame)
    for (mx, my, sp, ph, al) in MOTES:
        wx = mx + 8 * math.sin(t * 0.6 * sp + ph)
        wy = my + 10 * math.sin(t * 0.45 * sp + ph * 1.3) - 3 * t * 0
        sx, sy = to_screen(wx, wy, cam)
        if -5 < sx < W + 5 and -5 < sy < H + 5:
            r = max(1.0, 1.3 * z * 0.7)
            d.ellipse([sx - r, sy - r, sx + r, sy + r], fill=(255, 240, 200, int(255 * al * 0.55)))


# ----------------------------------------------------------------------------- altyazı
F_SUB = ImageFont.truetype(FONT_B, 50)
F_LAB = ImageFont.truetype(FONT_B, 24)
F_TITLE = ImageFont.truetype(FONT_BL, 62)
F_SMALL = ImageFont.truetype(FONT_B, 34)
SUB_CACHE = {}


def wrap(text, font, maxw):
    words, lines, cur = text.split(), [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if font.getlength(trial) <= maxw or not cur:
            cur = trial
        else:
            lines.append(cur); cur = w
    lines.append(cur)
    return lines


def sub_image(lid):
    if lid in SUB_CACHE: return SUB_CACHE[lid]
    d = ST[lid]
    lines = wrap(d["text"], F_SUB, 630)
    col = SPK_COLOR[d["spk"]]
    lh = 60
    hh = lh * len(lines) + 48
    img = Image.new("RGBA", (700, hh), (0, 0, 0, 0))
    dr = ImageDraw.Draw(img)
    label = SPK_LABEL[d["spk"]]
    lw = F_LAB.getlength(label) + 26
    dr.rounded_rectangle([350 - lw / 2, 2, 350 + lw / 2, 38], radius=18, fill=col + (255,), outline=(30, 16, 8, 255), width=3)
    dr.text((350, 20), label, font=F_LAB, fill=(34, 18, 10), anchor="mm")
    for i, ln in enumerate(lines):
        dr.text((350, 48 + lh * i + lh / 2), ln, font=F_SUB, fill=(255, 255, 255), anchor="mm",
                stroke_width=8, stroke_fill=(28, 14, 6))
    SUB_CACHE[lid] = img
    return img


def draw_subtitles(frame, t):
    active = [lid for lid, d in ST.items() if not lid.startswith("_") and d["start"] - 0.02 <= t <= d["end"] + 0.22]
    if not active: return
    active.sort(key=lambda l: ST[l]["start"])
    imgs = []
    for lid in active:
        im = sub_image(lid)
        k = t - ST[lid]["start"]
        sc = 1.0 + 0.16 * math.exp(-max(k, 0) * 16) if k < 0.4 else 1.0
        if sc != 1.0:
            im = im.resize((int(im.width * sc), int(im.height * sc)), Image.BICUBIC)
        imgs.append(im)
    total = sum(i.height for i in imgs) + 4 * (len(imgs) - 1)
    bottom = 1005
    y = bottom - total
    for im in imgs:
        frame.alpha_composite(im, (int(W / 2 - im.width / 2), int(y)))
        y += im.height + 4


def draw_end(frame, t, cam):
    """merak uyandıran son: karanlıkta gizli gözler + 'Bölüm 2'"""
    if t < 27.85: return
    dim = clamp((t - 27.85) / 1.1, 0, 1) * 0.42
    arr = np.asarray(frame.convert("RGB")).astype(np.float32) * (1 - dim)
    arr[..., 2] *= 1 + dim * 0.25
    frame.paste(Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB"))
    if t >= 28.12:
        # yukarı raftan bakan iki göz
        ex, ey = 360, 150
        open_p = ease_o(clamp((t - 28.12) / 0.35, 0, 1))
        blink = 0.12 if 28.88 <= t < 29.0 else 1.0
        sx, sy = to_screen(ex, ey, cam)
        gl = GLOW.resize((int(150 * cam[2]), int(150 * cam[2])), Image.BICUBIC)
        tint = Image.new("RGBA", gl.size, (255, 230, 90, 255))
        tint.putalpha(gl.getchannel("A").point(lambda v: int(v * 0.55 * open_p)))
        frame.alpha_composite(tint, (int(sx - gl.width / 2), int(sy - gl.height / 2)))
        d = ImageDraw.Draw(frame)
        for side in (-1, 1):
            cx = sx + side * 17 * cam[2]
            rx, ry = 9 * cam[2], 12 * cam[2] * open_p * blink
            d.ellipse([cx - rx, sy - ry, cx + rx, sy + ry], fill=(255, 250, 220))
            pr = 5.6 * cam[2]
            px, py = cx - side * 1.6 * cam[2], sy + 3.2 * cam[2] * open_p
            if blink > 0.5:
                d.ellipse([px - pr, py - pr, px + pr, py + pr], fill=(255, 214, 40))
                d.ellipse([px - pr * 0.5, py - pr * 0.5, px + pr * 0.5, py + pr * 0.5], fill=(20, 12, 8))
            # sinsi kaşlar
            bx0, bx1 = cx - 11 * cam[2], cx + 11 * cam[2]
            iy = sy - ry - 5 * cam[2] + 6 * cam[2]
            oy = sy - ry - 5 * cam[2] - 2 * cam[2]
            if side < 0: d.line([(bx0, oy), (bx1, iy)], fill=(30, 18, 12), width=int(3.4 * cam[2]))
            else: d.line([(bx0, iy), (bx1, oy)], fill=(30, 18, 12), width=int(3.4 * cam[2]))
    if t >= 29.1:
        a = ease_o(clamp((t - 29.1) / 0.45, 0, 1))
        ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        od = ImageDraw.Draw(ov)
        y = 880 + (1 - a) * 22
        od.text((W / 2, y), "BÖLÜM 2 YAKINDA…", font=F_TITLE, fill=(255, 236, 120, int(255 * a)), anchor="mm",
                stroke_width=9, stroke_fill=(30, 14, 4, int(255 * a)))
        a2 = ease_o(clamp((t - 29.45) / 0.4, 0, 1))
        od.text((W / 2, y + 62), "dolapta bir şey var…", font=F_SMALL, fill=(255, 255, 255, int(235 * a2)), anchor="mm",
                stroke_width=6, stroke_fill=(30, 14, 4, int(255 * a2)))
        frame.alpha_composite(ov)


# ----------------------------------------------------------------------------- kare
def render_frame(f):
    t = f / FPS
    cam = camera(t)
    cx, cy, z = cam
    vw, vh = W / z, H / z
    x0, y0 = cx - vw / 2, cy - vh / 2
    base = BG.resize((W, H), Image.BICUBIC, box=(x0 * S, y0 * S, (x0 + vw) * S, (y0 + vh) * S))
    frame = base.convert("RGBA")

    # gölgeler
    for n in DRAW_ORDER:
        sx, sy = to_screen(CHAR_X[n], SHELF + 1.5, cam)
        w_ = SHADOW_W[n] * z
        sh = SHADOW.resize((int(w_ * 1.2), int(w_ * 0.24)), Image.BILINEAR)
        frame.alpha_composite(sh, (int(sx - sh.width / 2), int(sy - sh.height / 2))) if -300 < sx < W + 300 else None

    # karakterler
    for n in DRAW_ORDER:
        wx = CHAR_X[n]
        sxc, _ = to_screen(wx, SHELF, cam)
        if sxc < -260 or sxc > W + 260:
            continue
        lvl, lid = speak_level(n, t)
        md = mood(n, t)
        eye = md["eye"]
        if eye == "open" and blinking(n, t): eye = "blink"
        mouth = md["mouth"]
        if lvl > 0 or (lid is not None):
            mouth = mouth_from_level(lvl, md["mouth"], n, f)
        dy, sxs, sys_, rot = body_motion(n, t, lvl)
        spr = get_sprite(n, eye, pupil_at(n, f), mouth, md["brow"])
        ax, ay = SPR[n]["anchor"]
        sx, sy = to_screen(wx, SHELF + dy, cam)
        draw_sprite(frame, spr, sx, sy, z * sxs / gfx.K, z * sys_ / gfx.K, rot, ax * gfx.K, ay * gfx.K)

    draw_doors(frame, t, cam)
    draw_overlays(frame, t, cam)

    # vinyet
    rgb = np.asarray(frame.convert("RGB")).astype(np.float32) * VIG
    frame = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), "RGB").convert("RGBA")
    # finaldeki flaş (komik vuruş)
    tp = t - (ST["_end_speech"] + 0.05)
    if 0 <= tp < 0.18:
        frame.alpha_composite(Image.new("RGBA", (W, H), (255, 120, 80, int(90 * (1 - tp / 0.18)))))
    draw_end(frame, t, cam)
    draw_subtitles(frame, t)
    return frame.convert("RGB")


# ----------------------------------------------------------------------------- çıktı
def encode(out_path, frames_iter, audio):
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
           "-i", "-", "-i", audio, "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", "medium", "-crf", "20",
           "-pix_fmt", "yuv420p", "-profile:v", "high", "-c:a", "aac", "-b:a", "192k", "-t", str(DUR),
           "-movflags", "+faststart", out_path]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    t0 = time.time()
    for f in frames_iter:
        p.stdin.write(f.tobytes())
        if int(f_idx[0]) % 60 == 0:
            print(f"  kare {f_idx[0]}/{NF}  {time.time()-t0:.0f}s", flush=True)
    p.stdin.close()
    p.wait()


f_idx = [0]


def gen_frames(rng_frames):
    for f in rng_frames:
        f_idx[0] = f
        yield render_frame(f)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "test":
        times = [float(x) for x in sys.argv[2].split(",")]
        for tt in times:
            t0 = time.time()
            im = render_frame(int(tt * FPS))
            im.save(os.path.join(BUILD, f"test_{tt:05.2f}.png"))
            print(tt, round(time.time() - t0, 2), "s")
    elif len(sys.argv) > 1 and sys.argv[1] == "chunk":
        a, b, outp = int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
        cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
               "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-profile:v", "high",
               "-g", "30", outp]
        p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
        for f in range(a, b):
            p.stdin.write(render_frame(f).tobytes())
        p.stdin.close(); p.wait()
        print("chunk ok", a, b)
    else:
        out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "..", "output", "misafir_takimi_buyuk_korku.mp4")
        audio = os.path.join(BUILD, "audio.wav")
        encode(out, gen_frames(range(NF)), audio)
        print("hazır:", out)
