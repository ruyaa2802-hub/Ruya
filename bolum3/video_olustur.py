"""Bölüm 3 — "Sinyal": 30 sn, 1080x1920, 24 fps kesme-kâğıt animasyonu + sentez ses/müzik.

  python3 video_olustur.py kareler <klasör>
  python3 video_olustur.py ses <dosya.wav>
  node ../bolum1/kare_render.js <klasör> <dosya.wav> bolum3.mp4
Hiçbir ücretli servis ya da hazır ses/müzik dosyası kullanılmaz.
"""
import importlib.util
import math
import os
import random
import sys

KOK = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(KOK, '..', 'bolum1'))
import sahneler_olustur as S  # noqa: E402
import video_olustur as V     # noqa: E402  (bölüm 1 yardımcıları)

_spec = importlib.util.spec_from_file_location('bolum2_video', os.path.join(KOK, '..', 'bolum2', 'video_olustur.py'))
B2 = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(B2)

FPS, DUR = 24, 30.0
INK, SW = S.INK, S.SW
clamp, prog, lerp = V.clamp, V.prog, V.lerp
ease_in, ease_out, ease_io = V.ease_in, V.ease_out, V.ease_io
place, VB_STAND, VB_SIT = B2.place, B2.VB_STAND, B2.VB_SIT
PURPLE, PURPLE_D = '#8e6aa8', '#7b5895'

# ---- yeni Ilo pozu: avuçta korkuyla oturan (yukarı bakıyor) ----
kafa_korku = S.ilo_ic[S.ilo_ic.index('    <!-- KOCAMAN, SAÇSIZ'):]
EXTRA3 = ('<defs>'
          f'<symbol id="ilo_otur" viewBox="320 350 260 460" overflow="visible"><g {SW}>{S.kulak_govde}{kafa_korku}{B2.ride_kollar}</g></symbol>'
          '<radialGradient id="ringglow"><stop offset="0.7" stop-color="#f2c230" stop-opacity="0"/>'
          '<stop offset="0.86" stop-color="#ffe27a" stop-opacity="0.9"/><stop offset="1" stop-color="#f2c230" stop-opacity="0"/></radialGradient>'
          '</defs>')


def frame(body, top=''):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
            f'viewBox="0 0 1080 1920" width="1080" height="1920">{S.DEFS}{B2.EXTRA}{EXTRA3}'
            f'<g filter="url(#wobble)">{body}</g>'
            f'<rect width="1080" height="1920" fill="#ece2cb" opacity="0.001" filter="url(#paper)"/>{top}</svg>')


# ---------- çizim parçaları ----------
def finger_at(px, py, rot, sc, mirror=False):
    """Dev parmağın ucunu (px, py) noktasına koyar."""
    m = f'scale({-sc} {sc})' if mirror else f'scale({sc})'
    return (f'<g transform="translate({px:.1f} {py:.1f}) rotate({rot:.1f}) {m} translate(-830 -955)">'
            + S.use('finger', 640, -60, 600, 1060) + '</g>')


def pinch(px, py, sc=0.55, gap=0.0):
    """İşaret parmağı ve başparmakla tutma: (px, py) tutulan nokta."""
    return finger_at(px - 50 - gap, py, 10, sc * 0.85, mirror=True) + finger_at(px + 50 + gap, py, -8, sc)


def ilo_dangle(px, py, h, swing, sym='ilo'):
    """Ensesinden tutulmuş Ilo: yaka noktası (px, py), sallanıyor."""
    feet = py + 0.655 * h
    return f'<g transform="rotate({swing:.1f} {px:.1f} {py:.1f})">' + place(sym, px - 10, feet, h) + '</g>'


def palm(y0):
    return (f'<g {SW}><path d="M-120 {y0 + 140} C-60 {y0 - 40} 260 {y0 - 10} 540 {y0 + 20} C820 {y0 - 10} 1140 {y0 - 40} 1200 {y0 + 140} '
            f'L1200 2000 L-120 2000 Z" fill="{PURPLE}" stroke-width="4"/>'
            f'<path d="M200 {y0 + 160} C400 {y0 + 230} 700 {y0 + 230} 900 {y0 + 160} M300 {y0 + 280} C480 {y0 + 330} 640 {y0 + 320} 780 {y0 + 270}" '
            f'fill="none" stroke-width="2.6"/>'
            f'<path d="M-40 {y0 + 60} C-20 {y0 - 160} 120 {y0 - 220} 160 {y0 - 60} C170 {y0 + 10} 120 {y0 + 60} 60 {y0 + 80} Z" fill="{PURPLE}" stroke-width="4"/>'
            f'<path d="M1120 {y0 + 60} C1100 {y0 - 160} 960 {y0 - 220} 920 {y0 - 60} C910 {y0 + 10} 960 {y0 + 60} 1020 {y0 + 80} Z" fill="{PURPLE}" stroke-width="4"/>'
            f'<path d="M900 {y0 - 30} C960 {y0 - 60} 1060 {y0 - 40} 1200 {y0 + 60} L1200 2000 L900 2000 Z" fill="url(#hatch)" stroke="none"/></g>')


def signal_ring(cx, cy, r, alpha):
    return (f'<ellipse cx="{cx:.0f}" cy="{cy:.0f}" rx="{r:.0f}" ry="{r * 0.82:.0f}" fill="url(#ringglow)" opacity="{alpha:.2f}"/>'
            f'<ellipse cx="{cx:.0f}" cy="{cy:.0f}" rx="{r:.0f}" ry="{r * 0.82:.0f}" fill="none" stroke="#f6d25a" '
            f'stroke-width="6" opacity="{alpha:.2f}"/>')


def bed_and_pillows(cx, by, w):
    """Sarı yuvarlak yatak + kırmızı üçgen yastıklar. by: yatağın alt kenarı."""
    h = w * 0.16
    top = by - h
    b = f'<g {SW}>'
    b += f'<path d="M{cx - w / 2:.0f} {top:.0f} L{cx - w / 2:.0f} {by - h * 0.25:.0f} C{cx - w / 2:.0f} {by + h * 0.35:.0f} {cx + w / 2:.0f} {by + h * 0.35:.0f} {cx + w / 2:.0f} {by - h * 0.25:.0f} L{cx + w / 2:.0f} {top:.0f} Z" fill="#d6a52a" stroke-width="3"/>'
    b += f'<ellipse cx="{cx:.0f}" cy="{top:.0f}" rx="{w / 2:.0f}" ry="{w * 0.17:.0f}" fill="#f2c230" stroke-width="3"/>'
    b += ''.join(f'<circle cx="{cx + dx * w:.0f}" cy="{top + dy * w:.0f}" r="{w * 0.012:.1f}" fill="#b8861a" stroke="none"/>'
                 for dx, dy in [(-0.25, 0), (0, -0.06), (0.25, 0), (-0.1, 0.07), (0.12, 0.07), (0, 0.02)])
    for k, (dx, s, rot) in enumerate([(-0.24, 0.2, -8), (0.0, 0.24, 2), (0.22, 0.19, 10)]):
        x, y, z = cx + dx * w, top - w * 0.06, s * w
        b += (f'<g transform="rotate({rot} {x:.0f} {y:.0f})"><path d="M{x - z / 2:.0f} {y + z * 0.35:.0f} L{x:.0f} {y - z * 0.55:.0f} '
              f'L{x + z / 2:.0f} {y + z * 0.35:.0f} Z" fill="#c8463c" stroke-width="3"/>'
              f'<path d="M{x + z * 0.05:.0f} {y - z * 0.4:.0f} L{x + z * 0.4:.0f} {y + z * 0.3:.0f} L{x + z * 0.1:.0f} {y + z * 0.3:.0f} Z" fill="url(#hatch)" stroke="none"/></g>')
    return b + '</g>'


def aquarium(x0, y0, w, h, inner=''):
    """Akvaryum: arka cam, içerik, ön cam; (x0, y0) sol üst köşe."""
    b = f'<g {SW}>'
    b += f'<rect x="{x0}" y="{y0}" width="{w}" height="{h}" fill="#dfeeee" fill-opacity="0.35" stroke-width="3"/>'
    b += f'<path d="M{x0} {y0 + h * 0.86} L{x0 + w} {y0 + h * 0.86}" stroke-width="2"/>'
    b += inner
    b += f'<rect x="{x0}" y="{y0}" width="{w}" height="{h}" fill="#eaf3f1" fill-opacity="0.18" stroke-width="5"/>'
    b += f'<path d="M{x0 + w * 0.08} {y0 + h * 0.12} L{x0 + w * 0.08} {y0 + h * 0.7} M{x0 + w * 0.14} {y0 + h * 0.1} L{x0 + w * 0.14} {y0 + h * 0.32}" stroke="#fff" stroke-width="10" opacity="0.55"/>'
    b += f'<rect x="{x0 - 14}" y="{y0 - 18}" width="{w + 28}" height="22" rx="8" fill="#c9a24a" stroke-width="3"/>'
    b += f'<rect x="{x0 - 14}" y="{y0 + h - 4}" width="{w + 28}" height="28" rx="8" fill="#c9a24a" stroke-width="3"/>'
    return b + '</g>'


def interior():
    b = '<rect width="1080" height="1920" fill="#e9cbd8"/>'
    b += '<rect width="1080" height="1920" fill="url(#dots)" opacity="0.2"/>'
    b += f'<g {SW}>'
    for x, w, hgt, c in [(-80, 520, 1500, '#ddb7c9'), (360, 560, 1700, '#e4c2d2'), (820, 420, 1420, '#ddb7c9')]:
        b += (f'<path d="M{x} 1920 L{x} {1920 - hgt + w / 2} C{x} {1920 - hgt - w * 0.1} {x + w} {1920 - hgt - w * 0.1} {x + w} {1920 - hgt + w / 2} '
              f'L{x + w} 1920 Z" fill="{c}" stroke-width="3"/>')
    # yuvarlak pencere: pembe gökyüzü ve ay
    b += '<circle cx="250" cy="430" r="160" fill="url(#sky)" stroke-width="10"/>'
    b += '<circle cx="300" cy="390" r="50" fill="#f1e3b4" stroke-width="2.5"/>'
    b += '<path d="M90 430 L410 430 M250 270 L250 590" stroke-width="6"/>'
    # raf ve üstünde fanus koleksiyonu
    b += '<rect x="40" y="860" width="440" height="22" fill="#b98a4a" stroke-width="3"/>'
    b += '</g>'
    b += ''.join(S.jar(x, 862, 0.42) for x in [110, 220, 330])
    b += S.use('mushtree', 395, 700, 70, 160)
    return b


VELUN_SEAT = (411, -33, 2000)   # (x, y, yükseklik): baş merkezi (760, 560)


def velun_seated(dy=0):
    x, y, h = VELUN_SEAT
    w = h * 760 / 1720
    return S.use('velun', x, y + dy, w, h)


def headphones(drop):
    """Kulaklık: kulak yerine sarkan ipliklerin uçlarına takılıyor."""
    s = VELUN_SEAT[2] / 1720
    lx, rx, ey = VELUN_SEAT[0] + (252 - 150) * s, VELUN_SEAT[0] + (648 - 150) * s, VELUN_SEAT[1] + (474 + 200) * s
    dy = -drop
    b = f'<g {SW} transform="translate(0 {dy:.0f})">'
    b += f'<path d="M{lx:.0f} {ey - 40:.0f} C{lx - 30:.0f} 120 {rx + 30:.0f} 120 {rx:.0f} {ey - 40:.0f}" fill="none" stroke="{INK}" stroke-width="30"/>'
    b += f'<path d="M{lx:.0f} {ey - 40:.0f} C{lx - 30:.0f} 120 {rx + 30:.0f} 120 {rx:.0f} {ey - 40:.0f}" fill="none" stroke="#c8463c" stroke-width="20"/>'
    for x in (lx, rx):
        b += f'<ellipse cx="{x:.0f}" cy="{ey:.0f}" rx="58" ry="74" fill="#c8463c" stroke-width="4"/>'
        b += f'<ellipse cx="{x:.0f}" cy="{ey:.0f}" rx="30" ry="40" fill="#f2c230" stroke-width="3"/>'
    b += '</g>'
    return b, (rx, ey + dy + 70)


def table(y):
    return (f'<g {SW}><rect x="-40" y="{y}" width="1160" height="70" fill="#c9a24a" stroke-width="4"/>'
            f'<rect x="-40" y="{y + 70}" width="1160" height="400" fill="#b98a4a" stroke-width="4"/>'
            f'<rect x="-40" y="{y + 70}" width="1160" height="400" fill="url(#hatch)" stroke="none"/></g>')


def shell_on_table(x, y):
    return (f'<g {SW}><circle cx="{x}" cy="{y - 70}" r="70" fill="#f0dcc4" stroke-width="3"/>'
            f'<path d="M{x} {y - 70} a10 10 0 0 1 10 10 a22 22 0 0 1 -22 22 a34 34 0 0 1 -34 -34 a46 46 0 0 1 46 -46 a58 58 0 0 1 58 58" fill="none" stroke-width="3"/></g>')


# ================= SAHNELER =================
def scene1(t):
    """0–2: uçurumda; dev parmaklar Ilo'yu ensesinden kaldırıyor."""
    b = f'<g filter="url(#soft)">{B2.valley(1.1)}</g>'
    b += S.hill('M0 1520 C220 1480 460 1490 700 1520 C860 1540 960 1560 1080 1600 L1080 1920 L0 1920 Z', 'g4', pores=False)
    b += S.tufts(4, -20, 1060, 1600, 1700, 110, 160, 51)
    b += S.use('caterpillar', 40, 1500, 360, 115)
    b += B2.walkeye(860, 1640, 170, t * 0.6, look=-1)
    h = 440
    grab_y = 1640 - 0.655 * h
    descend = ease_out(prog(t, 0.2, 0.7))
    lift = ease_in(prog(t, 0.85, 2.0)) * 900
    px, py = 560, grab_y - lift
    swing = 10 * math.sin(t * 9) * prog(t, 0.85, 1.1)
    fy = lerp(-900, 0, descend)
    b += f'<g transform="translate(0 {fy:.0f})">' + pinch(px, py - 10, 0.36, gap=26 * (1 - prog(t, 0.6, 0.85))) + '</g>'
    if t < 0.85:
        b += place('ilo', 550, 1640, h)
    else:
        b += ilo_dangle(px, py, h, swing)
        for k in range(2):   # çırpınan minik ayaklar
            a = math.sin(t * 30 + k * 2) * 10
            b += f'<path d="M{px - 30 + 40 * k:.0f} {py + 0.66 * h:.0f} l{a:.0f} 22" stroke="{INK}" stroke-width="3" opacity="0.6"/>'
    return b


def scene2(t):
    """2–6: avuçta oturuyor, kamera Velun'un yüzünde dolaşıyor."""
    u = t - 2
    pan = ease_io(prog(u, 0.4, 3.6)) * 620
    b = '<rect width="1080" height="1920" fill="#e9b3b8"/>'
    b += S.use('velunhead', -260, -828 + pan, 1600, 2560)
    b += palm(1500)
    shake = 3 * math.sin(u * 40)
    b += place('ilo_otur', 540 + shake, 1690, 400, VB_SIT)
    return b


def scene3(t):
    """6–10: tek dev göz; içinde Ilo'nun yansıması; yavaşça kırpılıyor."""
    u = t - 6
    z = lerp(1.0, 1.18, ease_io(prog(u, 0, 4)))
    blink = 0.0
    if 2.0 <= u < 2.6:
        q = prog(u, 2.0, 2.6); blink = math.sin(math.pi * q)
    cx, cy, rx, ry = 540, 900, 440, 520
    lid_y = lerp(cy - ry + 120, cy + ry + 40, blink)
    b = f'<rect width="1080" height="1920" fill="#9a78b4"/>'
    b += f'<g transform="translate(540 900) scale({z:.4f}) translate(-540 -900)">'
    b += f'<ellipse cx="{cx}" cy="{cy}" rx="{rx + 90}" ry="{ry + 100}" fill="#140c18" opacity="0.4" filter="url(#smoke)"/>'
    b += f'<clipPath id="bigeye"><ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}"/></clipPath>'
    b += f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="url(#eyeglow)" stroke="{INK}" stroke-width="6"/>'
    b += f'<g clip-path="url(#bigeye)">'
    b += f'<ellipse cx="{cx + 30}" cy="{cy + 60}" rx="250" ry="290" fill="none" stroke="#b07c10" stroke-width="4"/>'
    b += f'<circle cx="{cx + 50}" cy="{cy + 80}" r="80" fill="#120c08"/>'
    shrink = lerp(1.0, 0.8, ease_out(prog(u, 2.7, 3.4)))
    b += f'<g opacity="0.55" transform="translate({cx - 120} {cy + 230}) scale({shrink:.3f}) translate({-(cx - 120)} {-(cy + 230)})">'
    b += place('ilo_otur', cx - 120, cy + 230, 220, VB_SIT) + '</g>'
    b += f'<circle cx="{cx - 60}" cy="{cy - 120}" r="38" fill="#fff8e0" opacity="0.9"/>'
    b += (f'<path d="M0 0 L1080 0 L1080 {lid_y:.0f} C800 {lid_y - 80:.0f} 280 {lid_y - 80:.0f} 0 {lid_y:.0f} Z" fill="{PURPLE_D}" stroke="{INK}" stroke-width="5"/>')
    b += f'<path d="M0 0 L1080 0 L1080 {lid_y:.0f} C800 {lid_y - 80:.0f} 280 {lid_y - 80:.0f} 0 {lid_y:.0f} Z" fill="url(#hatch)" opacity="0.6"/>'
    b += '</g></g>'
    return b


def walk_scene(u):
    scroll = 380 * u
    b = S.sky()
    top = 'M0 1150 C200 1090 400 1120 560 1150 C740 1100 920 1110 1080 1150'
    b += f'<g transform="translate({-((scroll * 0.4) % 1080):.1f} 0)">'
    for off in (0, 1080):
        b += (f'<g transform="translate({off} 0)"><path d="{top} L1080 1920 L0 1920 Z" fill="url(#g1)"/>'
              f'<path d="{top}" fill="none" stroke="{INK}" stroke-width="3"/>'
              + ''.join(S.jar(x, 1170, 0.36) for x in [140, 520, 880]) + '</g>')
    b += '</g>'
    b += S.hill('M0 1560 C260 1520 520 1540 760 1560 C900 1545 1000 1540 1080 1550 L1080 1920 L0 1920 Z', 'g3', pores=False)
    bob = 22 * abs(math.sin(u * math.pi * 1.8))
    rot = 2.2 * math.sin(u * math.pi * 1.8)
    vx, vy, vh = 160, 120 - bob, 1640
    s = vh / 1720
    b += f'<g transform="rotate({rot:.2f} 540 1700)">' + S.use('velun', vx, vy, vh * 760 / 1720, vh)
    b += place('ilo_otur', vx + (752 - 150) * s, vy + (540 + 200) * s, 110, VB_SIT) + '</g>'
    for k in range(10):
        x = (k * 150 - scroll * 1.4) % 1400 - 160
        c = ['#3f7f74', '#c58aa8', '#c9a24a'][k % 3]
        b += S.use('tuft', x, 1700, 240, 200, f'style="color:{c}"')
    return b


def iris(r):
    return (f'<path d="M0 0 H1080 V1920 H0 Z M540 960 m{-r:.0f} 0 a{r:.0f} {r:.0f} 0 1 0 {2 * r:.0f} 0 '
            f'a{r:.0f} {r:.0f} 0 1 0 {-2 * r:.0f} 0 Z" fill="#000" fill-rule="evenodd"/>')


AQ = (90, 1180, 470, 420)       # akvaryum: x, y, genişlik, yükseklik
TABLE_Y = 1600


def room(u_bed=None, ilo='', show_velun=True, phones=None, rings=''):
    b = interior()
    if show_velun:
        b += velun_seated()
    hp = ''
    if phones is not None:
        hp, (cx_, cy_) = headphones(phones)
        b += hp
        b += (f'<path d="M{cx_:.0f} {cy_:.0f} C{cx_ + 60:.0f} {cy_ + 300:.0f} 980 1300 890 {TABLE_Y - 60}" fill="none" '
              f'stroke="{INK}" stroke-width="7"/>')
    b += rings
    b += table(TABLE_Y)
    b += shell_on_table(890, TABLE_Y + 4)
    x0, y0, w, h = AQ
    inner = bed_and_pillows(x0 + w / 2, y0 + h * 0.86, w * 0.78) + ilo
    b += aquarium(x0, y0, w, h, inner)
    return b


def scene4(t):
    """10–15: Velun yürüyor → iris geçişi → evin içi."""
    u = t - 10
    if u < 2.9:
        b = walk_scene(u)
        r = lerp(1200, 0, ease_in(prog(u, 2.4, 2.9)))
        return b, iris(r) if u >= 2.4 else ''
    r = lerp(0, 1200, ease_out(prog(u, 2.9, 3.4)))
    z = lerp(1.15, 1.0, ease_io(prog(u, 2.9, 5.0)))
    b = f'<g transform="translate(540 960) scale({z:.4f}) translate(-540 -960)">{room()}</g>'
    return b, iris(r) if u < 3.4 else ''


BED_TOP = AQ[1] + AQ[3] * 0.86 - AQ[2] * 0.78 * 0.16


def scene5(t):
    """15–20: Velun Ilo'yu akvaryuma, sarı yatağa bırakıyor."""
    u = t - 15
    x0, y0, w, h = AQ
    cx = x0 + w / 2
    hgt = 260
    if u < 2.0:
        p = ease_io(prog(u, 0.0, 2.0))
        py = lerp(560, BED_TOP - 0.655 * hgt + 10, p)
        swing = 8 * math.sin(u * 5) * (1 - p)
        ilo = ''
        b = room(ilo=ilo)
        b += pinch(cx, py - 8, 0.26)
        b += ilo_dangle(cx, py, hgt, swing)
        return b
    bounce = 0.0
    if u < 2.8:
        q = prog(u, 2.0, 2.8); bounce = 40 * abs(math.sin(q * math.pi * 2.5)) * (1 - q)
    rel = ease_out(prog(u, 2.0, 2.6))
    look = 1 if int((u - 2.8) / 0.7) % 2 == 0 else -1
    if u < 2.8:
        look = 1
    flip = '' if look > 0 else f'transform="translate({2 * cx:.0f} 0) scale(-1 1)"'
    ilo = f'<g {flip}>' + place('ilo_otur', cx, BED_TOP + 30 - bounce, 230, VB_SIT) + '</g>'
    b = room(ilo=ilo)
    fy = lerp(0, -900, rel)
    b += f'<g transform="translate(0 {fy:.0f})">' + pinch(cx, BED_TOP - 160, 0.26, gap=40 * rel) + '</g>'
    return b


RING_T0 = 21.3


def rings_at(t, cx=760, cy=470, inside=False):
    out = ''
    k = 0
    while RING_T0 + k * 0.5 <= t:
        age = t - (RING_T0 + k * 0.5)
        if age < 3.2:
            r = 80 + 330 * age
            a = clamp(1 - age / 3.2) * 0.9
            out += signal_ring(cx, cy, r, a)
        k += 1
    return out


def scene6(t):
    """20–25: kulaklık takılıyor, sinyal halkaları yayılıyor."""
    u = t - 20
    drop = lerp(900, 0, ease_out(prog(u, 0.0, 1.2)))
    x0, y0, w, h = AQ
    cx = x0 + w / 2
    stand = u >= 3.2
    if stand:
        ilo = place('ilo', cx + 40, AQ[1] + AQ[3] * 0.86, 250)
    else:
        ilo = place('ilo_otur', cx, BED_TOP + 30, 230, VB_SIT)
    b = room(ilo=ilo, phones=drop, rings=rings_at(t))
    # akvaryumun içine süzülen halka
    if t >= 22.6:
        q = ease_io(prog(t, 22.6, 25.0))
        b += signal_ring(lerp(560, x0 + w * 0.82, q), lerp(700, y0 + h * 0.45, q), lerp(120, 60, q), 0.9)
    return b


def scene7(t):
    """25–30: akvaryum camında yakın plan; Ilo elini halkaya uzatıyor."""
    u = t - 25
    b = '<rect width="1080" height="1920" fill="#d9c3cf"/>'
    b += f'<g filter="url(#soft)" opacity="0.7">{interior()}</g>'
    b += bed_and_pillows(260, 1900, 900)
    h = 900
    s = h / 626
    walk = ease_out(prog(u, 0.0, 1.5))
    lean = ease_io(prog(u, 1.5, 4.2))
    ix = lerp(150, 330, walk) + 40 * lean
    bob = 14 * abs(math.sin(u * 7)) * (1 - walk)
    b += f'<g transform="rotate({3 * lean:.2f} {ix:.0f} 1880)">' + place('ilo', ix, 1880 - bob, h) + '</g>'
    hand_x = ix + (640 - 450) * s + 40 * lean
    hand_y = 1880 - (976 - 524) * s
    gap = lerp(320, 5, ease_io(prog(u, 1.2, 4.2)))
    r = 150 + 8 * math.sin(u * 6)
    b += signal_ring(hand_x + gap + r, hand_y, r, 0.95)
    b += '<rect width="1080" height="1920" fill="#eaf3f1" opacity="0.12"/>'
    b += '<path d="M120 200 L120 1300 M190 160 L190 520" stroke="#fff" stroke-width="16" opacity="0.4"/>'
    top = '<rect width="1080" height="1920" fill="#000"/>' if u >= 4.35 else ''
    return b, top


def frame_svg(t):
    if t < 2:
        return frame(scene1(t))
    if t < 6:
        return frame(scene2(t))
    if t < 10:
        return frame(scene3(t))
    if t < 15:
        b, top = scene4(t); return frame(b, top)
    if t < 20:
        return frame(scene5(t))
    if t < 25:
        return frame(scene6(t))
    b, top = scene7(t)
    return frame(b, top)


# ================= SES + MÜZİK =================
def make_audio(path):
    import numpy as np
    import wave
    SR = 44100; N = int(SR * DUR)
    dry = np.zeros(N); wet = np.zeros(N); mus = np.zeros(N)
    rng = np.random.default_rng(23)

    def band_noise(n, lo, hi):
        x = rng.standard_normal(n); X = np.fft.rfft(x); f = np.fft.rfftfreq(n, 1 / SR)
        X[(f < lo) | (f > hi)] = 0
        y = np.fft.irfft(X, n); return y / (np.abs(y).max() + 1e-9)

    def put(sig, t0, bus, g=1.0):
        i = int(t0 * SR)
        if i >= N or i < 0:
            return
        j = min(N, i + len(sig)); bus[i:j] += g * sig[:j - i]

    def tone(freqs, d, decay, amps=None):
        n = int(d * SR); tt = np.arange(n) / SR; amps = amps or [1] * len(freqs)
        return sum(a * np.sin(2 * np.pi * f * tt) for f, a in zip(freqs, amps)) * np.exp(-tt / decay)

    def env_noise(t0, d, lo, hi, att, dec, g, bus=None):
        n = int(d * SR); tt = np.arange(n) / SR
        e = np.minimum(1, tt / att) * np.exp(-np.maximum(0, tt - att) / dec)
        put(band_noise(n, lo, hi) * e, t0, dry if bus is None else bus, g)

    def thump(t0, f=110, d=0.14, g=0.5, bus=None):
        put(tone([f, f * 1.5], d, d / 3, [1, 0.3]), t0, dry if bus is None else bus, g)

    def heartbeat(t0, g=0.4):
        thump(t0, 52, 0.25, g); thump(t0 + 0.18, 50, 0.22, g * 0.6)

    def big_step(t0, g=0.7):
        thump(t0, 48, 0.5, g); env_noise(t0, 0.5, 40, 300, 0.01, 0.15, g * 0.4)

    def chirp(t0, f0, f1, d, g):
        n = int(d * SR); tt = np.arange(n) / SR
        f = np.linspace(f0, f1, n)
        put(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.hanning(n), t0, dry, g)

    def wind(t0, t1, g=0.06):
        n = int((t1 - t0) * SR); tt = np.arange(n) / SR
        e = (0.6 + 0.4 * np.sin(2 * np.pi * 0.25 * tt)) * np.minimum(1, tt / 0.3) * np.minimum(1, (t1 - t0 - tt) / 0.3)
        put(band_noise(n, 150, 700) * e, t0, dry, g)

    # ---- 0–2: kavranma ----
    wind(0, 2.3, 0.08)
    env_noise(0.2, 0.55, 200, 2500, 0.35, 0.1, 0.25)          # parmakların inişi
    env_noise(0.82, 0.3, 300, 1800, 0.05, 0.12, 0.3)          # kumaşın gerilmesi
    chirp(0.86, 900, 1500, 0.16, 0.18)                         # minik bir "ii!"
    for k in range(10):
        thump(0.95 + 0.1 * k, 260, 0.04, 0.12)                 # çırpınan ayaklar
    env_noise(0.9, 1.0, 300, 1500, 0.6, 0.2, 0.12)              # yukarı vuuş
    # ---- 2–10: avuç, yüz, göz ----
    tt0, gap = 2.2, 0.9
    while tt0 < 10.0:
        heartbeat(tt0, 0.36); tt0 += gap; gap = max(0.55, gap * 0.95)
    for t0, d in ((2.6, 1.4), (4.4, 1.6)):                    # Velun'un derin nefesi
        n = int(d * SR); tt = np.arange(n) / SR
        put(band_noise(n, 80, 600) * np.sin(np.pi * tt / d) ** 2, t0, dry, 0.22)
    n = int(0.6 * SR); tt = np.arange(n) / SR                  # ıslak göz kırpma
    put(band_noise(n, 150, 900) * np.sin(np.pi * tt / 0.6) * (0.6 + 0.4 * np.sin(2 * np.pi * 18 * tt)), 8.0, dry, 0.3)
    # ---- 10–15: yürüyüş, kapı, ev ----
    for k in range(5):
        big_step(10.05 + 0.555 * k, 0.6)
    n = int(0.9 * SR); tt = np.arange(n) / SR                  # kapı gıcırtısı
    f = 380 + 160 * np.sin(2 * np.pi * 1.6 * tt) + 40 * rng.standard_normal(n).cumsum() / np.sqrt(n)
    sq = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * 0.3 + np.sin(2 * np.pi * np.cumsum(f) / SR)
    put(sq * np.hanning(n), 12.45, dry, 0.12); put(sq * np.hanning(n), 12.45, wet, 0.05)
    # ---- 15–20: akvaryum ----
    put(tone([2100, 3300], 0.6, 0.12), 15.1, dry, 0.15)        # cam kapak
    for k, g in enumerate([0.32, 0.18, 0.1]):                  # yatağın "boing"leri
        t0 = 17.0 + 0.3 * k
        n = int(0.35 * SR); tt = np.arange(n) / SR
        f = 260 - 120 * tt / 0.35 + 25 * np.sin(2 * np.pi * 9 * tt)
        put(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 0.12), t0, dry, g)
    # ---- 20–25: kulaklık klik + sinyaller ----
    n = int(0.01 * SR); put(band_noise(n, 2000, 9000) * np.linspace(1, 0, n), 21.2, dry, 0.5)
    put(tone([1700], 0.08, 0.02), 21.2, dry, 0.25)

    # ================= MÜZİK =================
    def mtof(m):
        return 440.0 * 2 ** ((m - 69) / 12)

    def mbox(m, t0, g=0.13, d=1.6):
        f = mtof(m); n = int(d * SR); tt = np.arange(n) / SR
        s = (np.sin(2 * np.pi * f * tt) * np.exp(-tt / 0.55) + 0.35 * np.sin(4 * np.pi * f * tt) * np.exp(-tt / 0.25)) * np.minimum(1, tt / 0.003)
        put(s, t0, mus, g); put(s, t0, wet, g * 0.3)

    def pad(ms, t0, t1, g=0.1, att=2.0, rel=0.5):
        n = int((t1 - t0) * SR); tt = np.arange(n) / SR; s = np.zeros(n)
        for m in ms:
            for det in (-0.12, 0.12):
                f = mtof(m + det); s += sum((0.55 ** k) * np.sin(2 * np.pi * f * (k + 1) * tt + k) for k in range(4))
        s /= len(ms) * 2
        e = np.minimum(1, tt / att) * np.minimum(1, (t1 - t0 - tt) / rel)
        put(s * e, t0, mus, g); put(s * e, t0, wet, g * 0.3)

    def beep(t0, f, g=0.12, d=0.12):
        n = int(d * SR); tt = np.arange(n) / SR
        s = np.sign(np.sin(2 * np.pi * f * tt)) * 0.25 + np.sin(2 * np.pi * f * tt)
        e = np.minimum(1, tt / 0.004) * np.exp(-tt / (d / 2.5))
        put(s * e, t0, mus, g); put(s * e, t0, wet, g * 0.5)

    # gerilim: avuç ve göz
    pad([50, 57, 63], 2.0, 10.4, 0.1, 1.5, 0.4)
    pad([38, 39], 3.0, 10.4, 0.07, 2.5, 0.4)
    for k, m in enumerate([86, 85, 81]):
        mbox(m, 3.0 + k * 1.5, 0.08, 2.4)
    # merak: ev ve akvaryum (müzik kutusu, yumuşak)
    motif = [74, 77, 81, 80, 76, 77, 74, None, 79, 77, 76, 74, 73, 74, None, None]
    E8 = 60 / 90 / 2; tt0 = 13.3; k = 0
    while tt0 < 21.0:
        m = motif[k % len(motif)]
        if m is not None:
            mbox(m, tt0, 0.11 * (1 - prog(tt0, 20.0, 21.0)))
        tt0 += E8; k += 1
    pad([50, 57], 13.0, 21.3, 0.04, 2.0, 0.4)
    # sinyal müziği: ritmik bipler + alçak titreşim, finalde tek tona dönüşür
    pattern = [1320, None, 1760, 1320, None, 1568, None, 1760]
    tt0 = 21.3; k = 0
    while tt0 < 27.2:
        f = pattern[k % len(pattern)]
        if f is not None:
            beep(tt0, f * (1 + 0.04 * prog(tt0, 25.0, 27.2)), 0.11)
        tt0 += 0.125; k += 1
    n = int((29.35 - 21.3) * SR); tt = np.arange(n) / SR
    wob = np.sin(2 * np.pi * 65 * tt) * (0.5 + 0.5 * np.sin(2 * np.pi * 4 * tt))
    put(wob * np.minimum(1, tt / 0.5), 21.3, mus, 0.14)
    n = int((29.35 - 26.6) * SR); tt = np.arange(n) / SR       # yükselen tek ince ton
    f = 1760 * (1 + 0.5 * (tt / tt[-1]) ** 2)
    put(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.minimum(1, tt / 0.6), 26.6, mus, 0.13)
    pad([62, 69, 74], 21.3, 29.35, 0.05, 1.0, 0.02)

    dry += mus * 0.6
    irn = int(1.4 * SR); tt = np.arange(irn) / SR
    ir = rng.standard_normal(irn) * np.exp(-tt / 0.35); ir /= np.abs(ir).sum() / 6
    L = 1 << int(np.ceil(np.log2(N + irn)))
    rev = np.fft.irfft(np.fft.rfft(wet, L) * np.fft.rfft(ir, L), L)[:N]
    mix = dry + wet * 0.3 + rev
    mix *= 0.9 / (np.abs(mix).max() + 1e-9)
    cut = int(29.35 * SR); fade = int(0.015 * SR)              # siyah ekranla birlikte ani kesilme
    mix[cut - fade:cut] *= np.linspace(1, 0, fade); mix[cut:] = 0
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((mix * 32767).astype('<i2').tobytes())


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'kareler':
        out = sys.argv[2]; os.makedirs(out, exist_ok=True)
        for i in range(int(FPS * DUR)):
            with open(os.path.join(out, f'f{i:04d}.svg'), 'w', encoding='utf-8') as f:
                f.write(frame_svg(i / FPS))
        print('kareler yazıldı')
    elif cmd == 'ses':
        make_audio(sys.argv[2]); print('ses yazıldı')
    elif cmd == 'ornek':
        out = sys.argv[2]; os.makedirs(out, exist_ok=True)
        for t in [float(x) for x in sys.argv[3:]]:
            with open(os.path.join(out, f't{t:05.2f}.svg'), 'w', encoding='utf-8') as f:
                f.write(frame_svg(t))
