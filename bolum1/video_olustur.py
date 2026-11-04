"""Bölüm 1'i 30 sn'lik, 1080x1920, 24 fps kesme-kâğıt animasyonu olarak üretir.

Adımlar:
  python3 video_olustur.py kareler <klasör>   -> her kare için SVG yazar
  python3 video_olustur.py ses <dosya.wav>     -> ses efektlerini sentezler
Kareleri PNG/JPEG'e çevirip ffmpeg ile birleştirmek için video_yap.sh kullanılır.
Hiçbir ücretli servis ya da hazır ses dosyası kullanılmaz.
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sahneler_olustur as S  # noqa: E402

FPS, DUR = 24, 30.0
W, H = 1080, 1920
INK = S.INK


# ---------- zaman yardımcıları ----------
def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def prog(t, t0, t1):
    return clamp((t - t0) / (t1 - t0)) if t1 > t0 else float(t >= t1)


def ease_out(p):
    return 1 - (1 - p) ** 3


def ease_in(p):
    return p ** 3


def ease_io(p):
    return 3 * p * p - 2 * p * p * p


def lerp(a, b, p):
    return a + (b - a) * p


def vframe(body, extra_top=''):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
            f'viewBox="0 0 {W} {H}" width="{W}" height="{H}">{S.DEFS}'
            f'<g filter="url(#wobble)">{body}</g>'
            f'<rect width="1080" height="1920" fill="#ece2cb" opacity="0.001" filter="url(#paper)"/>{extra_top}</svg>')


def baby_at(x, y, w, rot=0):
    return f'<g transform="rotate({rot:.1f} {x:.1f} {y:.1f})">' + S.use('baby', x - w / 2, y - w / 4, w, w / 2) + '</g>'


def ilo_rot(x, y, h, rot, sym='ilo', extra=''):
    """Ilo'yu ayak noktası etrafında döndürerek çizer."""
    return f'<g transform="rotate({rot:.1f} {x:.1f} {y:.1f})" {extra}>' + S.ilo(x, y, h, sym) + '</g>'


# ---------- ortak arka planlar (her karede aynı, bir kez üretilir) ----------
BG1 = (S.sky() + S.use('cloud', 520, 120, 360, 144)
       + S.hill('M0 1180 C180 1110 380 1140 560 1170 C740 1120 920 1130 1080 1160 L1080 1920 L0 1920 Z', 'g2')
       + ''.join(S.jar(x, 1190, 0.42) for x in [90, 250, 410, 670, 830, 990])
       + S.hill('M0 1500 C260 1440 520 1470 760 1510 C900 1480 1000 1475 1080 1490 L1080 1920 L0 1920 Z', 'g3',
                lines='M80 1560 C220 1530 360 1534 460 1556 M600 1600 C720 1576 860 1580 980 1604')
       + S.tufts(6, -20, 1060, 1500, 1560, 70, 110, 3))

BG23 = (S.sky()
        + S.hill('M0 1060 C200 980 400 1010 560 1050 C740 1000 920 1010 1080 1040 L1080 1920 L0 1920 Z', 'g2')
        + ''.join(S.jar(x, 1080, 0.38) for x in [80, 230, 860, 1010])
        + S.hill('M0 1380 C260 1320 520 1350 760 1390 C900 1360 1000 1355 1080 1370 L1080 1920 L0 1920 Z', 'g3',
                 lines='M60 1450 C220 1420 360 1424 460 1446 M600 1500 C720 1476 860 1480 980 1504')
        + S.use('eyetree', -60, 560, 330, 540))
FG23 = S.tufts(5, 560, 1060, 1700, 1800, 80, 120, 5) + S.tufts(3, -20, 160, 1700, 1800, 80, 120, 6)

JAR_X, JAR_BY, JAR_S = 230, 1660, 1.45
SOIL_Y = JAR_BY - 36 * JAR_S          # fanus içindeki toprağın yüksekliği
ILO_H, GROUND = 360, 1680


# ---------- SAHNE 1 · 0–3 sn ----------
LAND = [0.55, 1.15, 1.75]
FRONT = [(160, 1690), (420, 1700), (680, 1710)]
SKY_BABIES = [(900, 300, 140, -25, 380), (480, 120, 120, 30, 420), (760, 560, 130, -10, 360), (300, 700, 110, 60, 400)]


def scene1(t):
    b = BG1
    # gökyüzünde sürekli düşen bebekler (uzak sıraya)
    for x, y0, w, rot, sp in SKY_BABIES:
        y = y0 + sp * t
        if y < 1120:
            b += S.speed_lines(x, y - 60) + baby_at(x, y, w, rot + 40 * t)
    for i, (cx, by) in enumerate(FRONT):
        s = 0.95
        land = LAND[i]
        landed = t >= land
        b += S.jar_base(cx, by, s, bebek=landed)
        if not landed:
            p = prog(t, land - 0.55, land)
            y = lerp(-160, by - 62 * s, ease_in(p))
            b += S.speed_lines(cx, y - 70) + baby_at(cx, y, 114, lerp(-60, 0, p))
            lift = 300
        else:
            lift = lerp(300, 0, ease_in(prog(t, land, land + 0.15)))
        b += S.jar_dome(cx, by, s, lift=lift)
    # Ilo'nun boş fanusu: kapak havada kalıyor
    cx, by = 940, 1700
    landed = t >= 2.6
    b += S.jar_base(cx, by, 0.95, bebek=landed)
    if 2.0 <= t < 2.6:
        y = lerp(-160, by - 59, ease_in(prog(t, 2.0, 2.6)))
        b += S.speed_lines(cx, y - 70) + baby_at(cx, y, 114, lerp(50, 0, prog(t, 2.0, 2.6)))
    b += S.jar_dome(cx, by, 0.95, lift=260 + 8 * math.sin(t * 5))
    b += S.dust(25, 0, 1080, 500, 1750, 1)
    return b


# ---------- SAHNE 2 · 3–6 sn ----------
def scene2(t):
    u = t - 3
    b = BG23
    b += S.jar_base(JAR_X, JAR_BY, JAR_S, bebek=False)
    b += S.jar_dome(JAR_X, JAR_BY, JAR_S, lift=340 + 10 * math.sin(u * 3))
    if u < 0.6:                                     # fanusun içinde kıvrılmış yatıyor
        b += baby_at(JAR_X, SOIL_Y - 30, 170, 0)
    elif u < 1.0:                                   # doğruluyor
        p = ease_out(prog(u, 0.6, 1.0))
        b += ilo_rot(JAR_X, SOIL_Y, ILO_H, lerp(-80, 0, p))
    elif u < 1.4:                                   # kaideden aşağı zıplıyor
        p = prog(u, 1.0, 1.4)
        x = lerp(JAR_X, JAR_X + 170, p)
        y = lerp(SOIL_Y, GROUND, p) - 90 * math.sin(math.pi * p)
        b += ilo_rot(x, y, ILO_H, 0)
    else:                                           # sağa yürüyor
        p = prog(u, 1.4, 3.0)
        x = lerp(JAR_X + 170, 640, p)
        step = math.sin((u - 1.4) * 2 * math.pi * 4)
        b += ilo_rot(x, GROUND - 12 * abs(step), ILO_H, 4 * step)
        for k in range(3):
            px = x - 70 - k * 26
            b += f'<ellipse cx="{px:.0f}" cy="{GROUND - 4}" rx="{12 - 3 * k}" ry="{6 - k}" fill="#f4ead2" stroke="{INK}" stroke-width="1.5" opacity="{0.8 - 0.25 * k:.2f}"/>'
    b += FG23 + S.dust(18, 0, 1080, 400, 1700, 2)
    return b


# ---------- SAHNE 3 · 6–11 sn ----------
PUSHES = [0.7, 2.0, 3.2]
FINGER_TIP = (600, 1150)
FINGER_DIR = (-0.45, 0.89)


def ilo_state3(u):
    """(x, dönüş, görünür mü) — parmak itişlerine göre Ilo'nun durumu."""
    if u < 0.7:
        return lerp(600, 660, u / 0.7), 0
    if u < 1.6:
        fall = ease_out(prog(u, 0.7, 0.95)); up = ease_io(prog(u, 1.2, 1.6))
        return lerp(660, 600, fall), -95 * fall * (1 - up)
    if u < 2.0:
        return lerp(600, 650, prog(u, 1.6, 2.0)), 0
    if u < 2.9:
        fall = ease_out(prog(u, 2.0, 2.25)); up = ease_io(prog(u, 2.5, 2.9))
        return lerp(650, 590, fall), -95 * fall * (1 - up)
    if u < 3.2:
        return lerp(590, 630, prog(u, 2.9, 3.2)), 0
    p = prog(u, 3.2, 3.9)
    return lerp(630, JAR_X, ease_out(p)), -95 - 630 * ease_out(p)


def finger_offset3(u):
    """Parmak ucunu Ilo'nun başına götüren öteleme."""
    far = (-520 * FINGER_DIR[0], -520 * FINGER_DIR[1])
    k = 0.0
    for p in PUSHES:
        if p - 0.35 <= u < p:
            k = max(k, ease_out(prog(u, p - 0.35, p)))
        elif p <= u < p + 0.6:
            k = max(k, 1 - ease_io(prog(u, p + 0.1, p + 0.6)))
    x, _ = ilo_state3(min(u, 3.19))
    tx, ty = x + 120 - FINGER_TIP[0], GROUND - ILO_H - 20 - FINGER_TIP[1]
    return lerp(far[0], tx, k), lerp(far[1], ty, k)


def scene3(t):
    u = t - 6
    b = BG23
    rolled_in = u >= 3.9
    b += S.jar_base(JAR_X, JAR_BY, JAR_S, bebek=False)
    if rolled_in:
        b += baby_at(JAR_X, SOIL_Y - 30, 170, 0)
    lift = 340 + 10 * math.sin(u * 3)
    if u >= 4.1:
        lift = lerp(340, 0, ease_in(prog(u, 4.1, 4.3)))
    b += S.jar_dome(JAR_X, JAR_BY, JAR_S, lift=lift)
    if not rolled_in:
        x, rot = ilo_state3(u)
        if u >= 3.2:   # yuvarlanırken zıplayarak fanusa giriyor
            p = prog(u, 3.2, 3.9)
            cy = lerp(GROUND, SOIL_Y, p) - ILO_H / 2 - 160 * math.sin(math.pi * p)
            b += f'<g transform="rotate({rot:.1f} {x:.1f} {cy:.1f})">' + S.ilo(x, cy + ILO_H / 2, ILO_H) + '</g>'
        else:
            b += ilo_rot(x, GROUND, ILO_H, rot)
    # itiş anında toz bulutçukları
    for p in PUSHES:
        if p <= u < p + 0.45:
            q = prog(u, p, p + 0.45)
            x, _ = ilo_state3(p)
            for dx, dy, r in [(70, -300, 30), (110, -250, 22), (40, -240, 18)]:
                b += (f'<circle cx="{x + dx + 40 * q:.0f}" cy="{GROUND + dy - 30 * q:.0f}" r="{r * (1 + q):.0f}" '
                      f'fill="#fbeef0" stroke="{INK}" stroke-width="2" opacity="{1 - q:.2f}"/>')
    ox, oy = finger_offset3(u)
    b += f'<g transform="translate({ox:.1f} {oy:.1f})">' + S.use('finger', 470, -120, 800, 1413, 'transform="rotate(14 870 600)"') + '</g>'
    b += FG23
    return b


# ---------- SAHNE 4 · 11–16 sn ----------
def scene4(t):
    u = t - 11
    b = '<rect width="1080" height="1920" fill="#e9b3b8"/>'
    a = ease_io(prog(u, 0.3, 2.6))
    sc = lerp(1.25, 1.0, ease_io(prog(u, 0, 5)))
    b += (f'<g opacity="{a:.3f}" transform="translate(540 900) scale({sc:.4f}) translate(-540 -900)">'
          f'<g filter="url(#soft)">{S.use("velunhead", -180, -475, 1440, 2304)}</g></g>')
    b += '<rect width="1080" height="1920" fill="#f4d6cf" opacity="0.18"/>'
    b += S.jar_base(540, 1800, 4.2, bebek=False)
    bob = 4 * math.sin(u * 2.4)
    b += S.ilo(560, 1745 + bob * 0, 360)
    b += S.jar_dome(540, 1800, 4.2)
    b += '<path d="M200 1500 C200 1100 300 820 520 760" fill="none" stroke="#ffffff" stroke-width="10" opacity="0.35"/>'
    return b


# ---------- SAHNE 5 · 16–20 sn ----------
def scene5(t):
    u = t - 16
    b = '<rect width="1080" height="1920" fill="#e9b3b8"/>'
    tilt = lerp(0, 12, ease_io(prog(u, 0.2, 2.2)))
    b += f'<g filter="url(#soft)" transform="rotate({tilt:.2f} 540 700)">{S.use("velunhead", -100, -522, 1280, 2048)}</g>'
    b += '<rect width="1080" height="1920" fill="#f4d6cf" opacity="0.15"/>'
    b += '<rect x="760" y="0" width="320" height="1920" fill="#eaf3f1" opacity="0.22"/>'
    b += f'<path d="M760 0 L760 1920" stroke="{INK}" stroke-width="4"/>'
    b += '<path d="M820 200 L820 1500 M880 400 L880 900" stroke="#ffffff" stroke-width="9" opacity="0.45"/>'
    laughing = (0.3 <= u < 1.7) or (2.2 <= u < 3.1)
    bounce = 14 * abs(math.sin(u * math.pi * 6)) if laughing else 0
    b += S.ilo(470, 1720 - bounce, 1250, 'ilo_gul')
    fog = 0.2 + 0.2 * prog(u, 0, 1.5)
    b += f'<ellipse cx="770" cy="{1000 - bounce:.0f}" rx="60" ry="70" fill="#ffffff" opacity="{fog:.2f}"/>'
    return b


# ---------- SAHNE 6 · 20–25 sn ----------
TAPS = [0.6, 1.5, 2.4]


def scene6(t):
    u = t - 20
    b = '<rect width="1080" height="1920" fill="#e9b3b8"/>'
    b += f'<g filter="url(#soft)" opacity="0.9">{S.use("velunhead", -300, -520, 1700, 2720)}</g>'
    shake = 0.0
    for p in TAPS:
        if p <= u < p + 0.5:
            q = prog(u, p, p + 0.5)
            shake += 16 * (1 - q) * math.sin(q * 40)
    g = f'<g transform="translate({shake:.1f} 0)">'
    g += S.jar_base(540, 1780, 3.6, bebek=False)
    if u < TAPS[0] + 0.05:
        g += S.ilo(540, 1700, 360)
    else:
        tremble = 3 * math.sin(u * 60)
        g += f'<g transform="translate({tremble:.1f} 0)">' + S.ilo(540, 1700, 430, 'ilo_kulak') + '</g>'
    g += S.jar_dome(540, 1780, 3.6) + '</g>'
    b += g
    # parmak: her vuruşta hızla gelip gidiyor
    k = 0.0
    for p in TAPS:
        if p - 0.12 <= u < p:
            k = max(k, ease_in(prog(u, p - 0.12, p)))
        elif p <= u < p + 0.3:
            k = max(k, 1 - ease_out(prog(u, p, p + 0.3)))
    ox, oy = lerp(160, 0, k), lerp(-200, 0, k)
    b += f'<g transform="translate({ox:.1f} {oy:.1f})">' + S.use('finger', 640, -560, 720, 1272, 'transform="rotate(38 900 300)"') + '</g>'
    # darbe halkaları
    for p in TAPS:
        if p <= u < p + 0.6:
            q = prog(u, p, p + 0.6)
            for j, r0 in enumerate([40, 90, 140]):
                r = r0 + 160 * q
                b += (f'<path d="M{850 - r:.0f} {700 + r * 0.3:.0f} A{r:.0f} {r:.0f} 0 0 1 {850 + r * 0.2:.0f} {700 - r:.0f}" '
                      f'fill="none" stroke="#fbeef0" stroke-width="6" opacity="{(1 - q) * (1 - j * 0.25):.2f}"/>')
    return b


# ---------- SAHNE 7 · 25–30 sn ----------
def _crack_paths():
    r = random.Random(9)
    cx, cy = 620, 640
    out = []
    for ang in [200, 235, 260, 300, 330, 20, 70, 110, 150]:
        x, y = cx, cy
        pts = [(x, y)]
        L = r.uniform(260, 560)
        for _ in range(6):
            a = math.radians(ang + r.uniform(-18, 18))
            x += math.cos(a) * L / 6; y += math.sin(a) * L / 6
            pts.append((x, y))
        length = sum(math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1))
        d = 'M' + ' L'.join(f'{px:.0f} {py:.0f}' for px, py in pts)
        out.append((d, length))
    return out


CRACKS = _crack_paths()


def scene7(t):
    u = t - 25
    b = '<rect width="1080" height="1920" fill="#d9a2ab"/>'
    lower = prog(u, 1.0, 1.6)
    shake = 4 * (1 - prog(u, 0, 1.0)) * math.sin(u * 50)
    b += f'<g filter="url(#soft)" transform="translate({shake:.1f} 0)">'
    b += f'<g opacity="{0.75 * (1 - lower):.2f}">{S.ilo(560, 1700, 700, "ilo_kulak")}</g>'
    b += f'<g opacity="{0.75 * lower:.2f}">{S.ilo(560, 1700, 700, "ilo")}</g></g>'
    b += '<rect width="1080" height="1920" fill="#eaf3f1" opacity="0.25"/>'
    grow = ease_out(prog(u, 1.8, 3.0))
    if grow > 0:
        for d, L in CRACKS:
            off = L * (1 - grow)
            dash = f'stroke-dasharray="{L:.0f} {L:.0f}" stroke-dashoffset="{off:.0f}"'
            b += f'<path d="{d}" fill="none" stroke="#ffffff" stroke-width="7" opacity="0.8" {dash}/>'
            b += f'<path d="{d}" fill="none" stroke="{INK}" stroke-width="2.4" {dash}/>'
        b += f'<circle cx="620" cy="640" r="{22 * min(1, grow * 3):.0f}" fill="#ffffff" opacity="0.85" stroke="{INK}" stroke-width="2"/>'
    if u >= 2.8:
        q = ease_io(prog(u, 2.8, 4.1))
        x, y = lerp(612, 560, q), lerp(660, 900, q) + 6 * math.sin(u * 4)
        glow = 40 + 8 * math.sin(u * 7)
        b += f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{glow:.0f}" fill="#f2c230" filter="url(#glow)"/>'
        b += f'<circle cx="{x:.0f}" cy="{y:.0f}" r="15" fill="#f6d25a" stroke="{INK}" stroke-width="2"/>'
        b += f'<circle cx="{x - 5:.0f}" cy="{y - 5:.0f}" r="5" fill="#fff8e0"/>'
    b += '<rect width="1080" height="1920" fill="url(#vignette)"/>'
    black = ease_in(prog(u, 4.2, 4.6))
    top = f'<rect width="1080" height="1920" fill="#000" opacity="{black:.3f}"/>'
    return b, top


def frame_svg(t):
    if t < 3:
        return vframe(scene1(t))
    if t < 6:
        return vframe(scene2(t))
    if t < 11:
        return vframe(scene3(t))
    if t < 16:
        return vframe(scene4(t))
    if t < 20:
        return vframe(scene5(t))
    if t < 25:
        return vframe(scene6(t))
    body, top = scene7(t)
    return vframe(body, top)


# ---------- SES ----------
def make_audio(path):
    import numpy as np
    import wave
    SR = 44100
    N = int(SR * DUR)
    dry = np.zeros(N); wet = np.zeros(N)
    rng = np.random.default_rng(7)

    def band_noise(n, lo, hi):
        x = rng.standard_normal(n)
        X = np.fft.rfft(x); f = np.fft.rfftfreq(n, 1 / SR)
        X[(f < lo) | (f > hi)] = 0
        y = np.fft.irfft(X, n)
        return y / (np.abs(y).max() + 1e-9)

    def put(sig, t0, bus=None, g=1.0):
        bus = dry if bus is None else bus
        i = int(t0 * SR)
        if i >= N:
            return
        j = min(N, i + len(sig))
        bus[i:j] += g * sig[:j - i]

    def tone(freqs, d, decay, amps=None):
        n = int(d * SR); tt = np.arange(n) / SR
        amps = amps or [1] * len(freqs)
        s = sum(a * np.sin(2 * np.pi * f * tt) for f, a in zip(freqs, amps))
        return s * np.exp(-tt / decay)

    def tak(t0, g=0.5):
        n = int(0.006 * SR)
        click = band_noise(n, 2000, 9000) * np.linspace(1, 0, n)
        put(click, t0, g=g * 0.9)
        put(tone([1900, 2650, 3400], 0.35, 0.07, [1, 0.6, 0.35]), t0, g=g * 0.35)
        put(tone([1900, 2650], 0.35, 0.07), t0, wet, g=g * 0.12)

    def big_tak(t0, g=0.9):
        n = int(0.01 * SR)
        put(band_noise(n, 1500, 8000) * np.linspace(1, 0, n), t0, g=g)
        put(tone([700, 1080, 1520], 0.6, 0.09, [1, 0.7, 0.4]), t0, g=g * 0.5)
        put(tone([170], 0.3, 0.06), t0, g=g * 0.6)
        put(tone([700, 1080, 1520, 170], 0.6, 0.12), t0, wet, g=g * 0.45)

    def thump(t0, f=110, d=0.14, g=0.5):
        put(tone([f, f * 1.5], d, d / 3, [1, 0.3]), t0, g=g)

    def whoosh(t0, d=0.5, g=0.18):
        n = int(d * SR); e = np.sin(np.linspace(0, np.pi, n)) ** 2
        put(band_noise(n, 300, 2600) * e, t0, g=g)

    def pof(t0, g=0.55):
        n = int(0.28 * SR); tt = np.arange(n) / SR
        e = (1 - np.exp(-tt / 0.008)) * np.exp(-tt / 0.07)
        put(band_noise(n, 120, 1100) * e, t0, g=g)
        thump(t0, 80, 0.18, g * 0.7)

    def step(t0, g=0.22):
        thump(t0, 160, 0.06, g)
        n = int(0.03 * SR)
        put(band_noise(n, 500, 2200) * np.linspace(1, 0, n), t0, g=g * 0.4)

    def giggle(t0, count=5, g=0.22):
        for k in range(count):
            d = 0.09; n = int(d * SR); tt = np.arange(n) / SR
            f0 = 860 - 45 * k + rng.uniform(-20, 20)
            ph = 2 * np.pi * np.cumsum(f0 * (1 + 0.04 * np.sin(2 * np.pi * 28 * tt))) / SR
            s = (np.sin(ph) + 0.35 * np.sin(2 * ph) + 0.15 * np.sin(3 * ph)) * np.hanning(n)
            put(s, t0 + k * 0.12, g=g)
            put(band_noise(n, 1500, 5000) * np.hanning(n), t0 + k * 0.12, g=g * 0.08)

    def hum(t0, t1, g=0.22, rise=1.5):
        n = int((t1 - t0) * SR); tt = np.arange(n) / SR
        lfo = 1 + 0.15 * np.sin(2 * np.pi * 0.35 * tt)
        s = (np.sin(2 * np.pi * 55 * tt) + 0.6 * np.sin(2 * np.pi * 82.4 * tt)
             + 0.35 * np.sin(2 * np.pi * 110.3 * tt) + 0.15 * np.sin(2 * np.pi * 165 * tt))
        e = np.minimum(1, tt / rise) * np.minimum(1, (t1 - t0 - tt) / 0.4)
        put(s * lfo * e, t0, g=g)
        put(s * lfo * e, t0, wet, g=g * 0.25)

    def wind(t0, t1, g=0.05):
        n = int((t1 - t0) * SR); tt = np.arange(n) / SR
        e = (0.6 + 0.4 * np.sin(2 * np.pi * 0.2 * tt)) * np.minimum(1, tt / 0.5) * np.minimum(1, (t1 - t0 - tt) / 0.3)
        put(band_noise(n, 150, 650) * e, t0, g=g)

    def roll(t0, t1, g=0.25):
        n = int((t1 - t0) * SR); tt = np.arange(n) / SR
        e = (0.5 + 0.5 * np.abs(np.sin(2 * np.pi * 6 * tt))) * np.hanning(n)
        put(band_noise(n, 80, 500) * e, t0, g=g)

    def crackle(t0, t1, dens=40, g=0.35):
        for _ in range(int((t1 - t0) * dens)):
            tt0 = rng.uniform(t0, t1); n = int(rng.uniform(0.002, 0.008) * SR)
            put(band_noise(n, 3000, 9000) * np.linspace(1, 0, n), tt0, g=g * rng.uniform(0.3, 1))

    def shimmer(t0, t1, dens=8, g=0.08):
        for _ in range(int((t1 - t0) * dens)):
            f = rng.uniform(2600, 4600)
            put(tone([f], 0.5, 0.12), rng.uniform(t0, t1), g=g)
            put(tone([f], 0.5, 0.2), rng.uniform(t0, t1), wet, g=g * 0.5)

    def bell(t0, g=0.45):
        fr = [196, 393.5, 523.3, 781, 1047.2]
        am = [1, 0.6, 0.45, 0.3, 0.2]
        put(tone(fr, 3.0, 0.9, am), t0, g=g)
        put(tone(fr, 3.0, 1.2, am), t0, wet, g=g * 0.5)

    # --- SAHNE 1 ---
    wind(0, 11)
    for k, t0 in enumerate([0.0, 0.6, 1.2]):
        whoosh(t0, 0.55)
        thump(LAND[k], 130, 0.1, 0.35)
        tak(LAND[k] + 0.15)
    whoosh(2.0, 0.6)
    thump(2.6, 130, 0.1, 0.35)
    shimmer(0, 3, 3, 0.04)
    # --- SAHNE 2 ---
    thump(3.0 + 1.4, 120, 0.12, 0.35)              # kaideden atlayış
    u = 1.55
    while u < 3.0:
        step(3 + u); u += 0.125 * 2
    # --- SAHNE 3 ---
    for k, p in enumerate(PUSHES):
        whoosh(6 + p - 0.35, 0.35, 0.12)
        pof(6 + p)
        if k < 2:
            thump(6 + p + 0.25, 100, 0.14, 0.4)
    for st in [0.0, 0.25, 0.5, 1.7, 1.95, 2.95, 3.1]:
        step(6 + st, 0.18)
    roll(6 + 3.2, 6 + 3.9)
    tak(6 + 4.3, 0.75)
    # --- SAHNE 4–5 ---
    hum(11.3, 20.4, 0.24, 2.2)
    giggle(16.3, 6); giggle(17.0, 5); giggle(18.2, 6, 0.2)
    # --- SAHNE 6 ---
    for p in TAPS:
        big_tak(20 + p)
    # --- SAHNE 7 ---
    crackle(25 + 1.8, 25 + 3.0, 45, 0.4)
    tak(25 + 1.8, 0.35)
    shimmer(25 + 2.8, 25 + 4.2, 10, 0.07)
    bell(25 + 4.4)

    # basit yankı: üstel sönen gürültü darbe tepkisi (FFT ile evrişim)
    irn = int(1.4 * SR); tt = np.arange(irn) / SR
    ir = rng.standard_normal(irn) * np.exp(-tt / 0.35); ir /= np.abs(ir).sum() / 6
    L = 1 << int(np.ceil(np.log2(N + irn)))
    rev = np.fft.irfft(np.fft.rfft(wet, L) * np.fft.rfft(ir, L), L)[:N]
    mix = dry + wet * 0.3 + rev
    mix *= 0.9 / (np.abs(mix).max() + 1e-9)
    # son 0.3 sn yumuşak kapanış
    fade = int(0.3 * SR); mix[-fade:] *= np.linspace(1, 0, fade)
    data = (mix * 32767).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(data.tobytes())


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'kareler':
        out = sys.argv[2]
        os.makedirs(out, exist_ok=True)
        n = int(FPS * DUR)
        for i in range(n):
            with open(os.path.join(out, f'f{i:04d}.svg'), 'w', encoding='utf-8') as f:
                f.write(frame_svg(i / FPS))
        print(n, 'kare yazıldı')
    elif cmd == 'ses':
        make_audio(sys.argv[2])
        print('ses yazıldı')
