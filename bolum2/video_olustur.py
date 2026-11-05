"""Bölüm 2 — "Hapşırık": 30 sn, 1080x1920, 24 fps kesme-kâğıt animasyonu + sentez ses/müzik.

  python3 video_olustur.py kareler <klasör>
  python3 video_olustur.py ses <dosya.wav>
  node ../bolum1/kare_render.js <klasör> <dosya.wav> bolum2.mp4
Hiçbir ücretli servis ya da hazır ses/müzik dosyası kullanılmaz.
"""
import math
import os
import random
import re
import sys

KOK = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(KOK, '..', 'bolum1'))
import sahneler_olustur as S  # noqa: E402
import video_olustur as V     # noqa: E402

FPS, DUR = 24, 30.0
INK = S.INK
SW = S.SW
clamp, prog, lerp = V.clamp, V.prog, V.lerp
ease_in, ease_out, ease_io = V.ease_in, V.ease_out, V.ease_io

# ======================= YENİ ÇİZİMLER =======================
GOZ_RE = r'<!-- iri, yuvarlak bebek gözleri.*?<!-- hafif kaşlar -->'
SIKI_GOZ = ('<path d="M398 480 L428 492 L398 504 M502 480 L472 492 L502 504" fill="none" stroke-width="4"/>\n'
            '    <!-- hafif kaşlar -->')
AGIZ = '<ellipse cx="452" cy="540" rx="7" ry="5.5" fill="#b5655a" stroke-width="1.8"/>'

# hapşırık öncesi: gözler kısılmış, burun kırışmış
ilo_hazir = re.sub(GOZ_RE, SIKI_GOZ, S.ilo_ic, flags=re.S)
ilo_hazir = ilo_hazir.replace(AGIZ, AGIZ + '<path d="M434 506 l-10 -8 M470 506 l10 -8" fill="none" stroke-width="2.4"/>')
# hapşırık anı: ağız kocaman açık
ilo_hapsu = re.sub(GOZ_RE, SIKI_GOZ, S.ilo_ic, flags=re.S)
ilo_hapsu = ilo_hapsu.replace(AGIZ, '<ellipse cx="452" cy="546" rx="20" ry="16" fill="#7a3a3a" stroke-width="2.4"/>'
                              '<path d="M434 506 l-10 -8 M470 506 l10 -8" fill="none" stroke-width="2.4"/>')
# nefesini tutuyor: yanaklar şişkin, dudaklar sımsıkı
ilo_nefes = S.ilo_ic.replace(AGIZ, '<path d="M440 540 C448 536 456 536 464 540" fill="none" stroke-width="3"/>')
ilo_nefes = ilo_nefes.replace('r="15" fill="#e3a58f" stroke="none" opacity="0.6"', 'r="27" fill="#e3a58f" stroke="none" opacity="0.85"')
ilo_nefes = ilo_nefes.replace('<ellipse cx="450" cy="466" rx="100" ry="98"', '<ellipse cx="450" cy="470" rx="108" ry="98"')
# tırtıla binmiş: oturan gövde, gülen yüz, kollar öne uzanmış
kafa_mutlu = S.ilo_ic[S.ilo_ic.index('    <!-- KOCAMAN, SAÇSIZ'):].replace(
    AGIZ, '<path d="M432 532 C440 552 466 552 474 532 Z" fill="#b5655a" stroke-width="2.2"/>')
ride_kollar = '''
    <path d="M404 612 C380 650 372 690 380 720 C388 736 406 730 404 712 C400 690 408 660 426 630 Z" fill="#ecccab" stroke-width="2.8"/>
    <path d="M496 612 C520 650 528 690 520 720 C512 736 494 730 496 712 C500 690 492 660 474 630 Z" fill="#ecccab" stroke-width="2.8"/>
    <circle cx="390" cy="726" r="15" fill="#ecccab" stroke-width="2.6"/><circle cx="510" cy="726" r="15" fill="#ecccab" stroke-width="2.6"/>
'''
VB_STAND = (330, 630, 110, 626)   # (genişlik, yükseklik, ayak-x, ayak-y) — S.ilo ile aynı
VB_SIT = (260, 460, 130, 450)

EXTRA = ['<defs>']
for ad, ic in [('ilo_hazir', ilo_hazir), ('ilo_hapsu', ilo_hapsu), ('ilo_nefes', ilo_nefes)]:
    EXTRA.append(f'<symbol id="{ad}" viewBox="340 350 330 630" overflow="visible"><g {SW}>{ic}</g></symbol>')
EXTRA.append(f'<symbol id="ilo_binis" viewBox="320 350 260 460" overflow="visible"><g {SW}>{S.kulak_govde}{kafa_mutlu}{ride_kollar}</g></symbol>')
# Velun'un bacakları (kırpılmış görünüm)
EXTRA.append(f'<symbol id="velunlegs" viewBox="330 1060 240 450"><g {SW}>{S.velun_ic}</g></symbol>')
EXTRA.append('<filter id="flash"><feGaussianBlur stdDeviation="18"/></filter>')
EXTRA.append('<filter id="blur"><feGaussianBlur stdDeviation="14"/></filter>')
EXTRA.append(S.blok(S.dunya_svg, 'symbol', 'caterpillar'))
EXTRA.append('</defs>')
EXTRA = '\n'.join(EXTRA)


def place(sym, x, y, h, vb=VB_STAND, extra=''):
    vw, vh, ox, oy = vb
    s = h / vh
    return S.use(sym, x - ox * s, y - oy * s, vw * s, h, extra)


def frame(body, top=''):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
            f'viewBox="0 0 1080 1920" width="1080" height="1920">{S.DEFS}{EXTRA}'
            f'<g filter="url(#wobble)">{body}</g>'
            f'<rect width="1080" height="1920" fill="#ece2cb" opacity="0.001" filter="url(#paper)"/>{top}</svg>')


def shard(x, y, size, rot, seed, extra=''):
    r = random.Random(seed)
    k = r.choice([3, 4, 4, 5])
    pts = []
    for i in range(k):
        a = 2 * math.pi * i / k + r.uniform(-0.5, 0.5)
        rr = size * r.uniform(0.5, 1.0)
        pts.append(f'{math.cos(a) * rr:.0f},{math.sin(a) * rr:.0f}')
    return (f'<g transform="translate({x:.1f} {y:.1f}) rotate({rot:.1f})" {extra}>'
            f'<polygon points="{" ".join(pts)}" fill="#eaf3f1" fill-opacity="0.45" stroke="{INK}" stroke-width="2.2"/>'
            f'<path d="M{-size * 0.3:.0f} {-size * 0.2:.0f} L{size * 0.2:.0f} {-size * 0.4:.0f}" stroke="#fff" stroke-width="4" opacity="0.8"/></g>')


def mush_stem(cx, by, s):
    return (f'<g transform="translate({cx - 120 * s:.1f} {by - 260 * s:.1f}) scale({s})" {SW}>'
            '<path d="M100 260 C96 210 98 170 104 130 L140 130 C146 170 148 210 144 260 Z" fill="#efe4cc" stroke-width="3"/>'
            '<path d="M124 130 L140 130 C146 170 148 210 144 260 L128 260 Z" fill="url(#hatch)" stroke="none"/></g>')


def mush_cap(cx, by, s, lift=0, tilt=0):
    return (f'<g transform="translate({cx - 120 * s:.1f} {by - 260 * s - lift:.1f}) scale({s}) rotate({tilt:.1f} 120 100)" {SW}>'
            '<path d="M10 132 C10 30 230 30 230 132 C190 146 50 146 10 132 Z" fill="#b6668a" stroke-width="3"/>'
            '<path d="M150 50 C210 70 226 110 228 132 C200 140 170 142 150 142 Z" fill="url(#hatch)" stroke="none"/>'
            '<g fill="#f6e7c6" stroke-width="2"><circle cx="60" cy="90" r="14"/><circle cx="112" cy="64" r="18"/>'
            '<circle cx="170" cy="92" r="12"/><circle cx="90" cy="118" r="8"/><circle cx="196" cy="118" r="7"/></g></g>')


def walkeye(x, y, h, t, look=1):
    """Yürüyen göz: ayak noktası (x, y); adımlarken hafif sallanır."""
    w = h * 80 / 150
    sway = 6 * math.sin(t * 14)
    flip = '' if look > 0 else f'transform="translate({2 * x:.1f} 0) scale(-1 1)"'
    return f'<g {flip}><g transform="rotate({sway:.1f} {x:.1f} {y:.1f})">' + S.use('walkeye', x - w / 2, y - h, w, h) + '</g></g>'


def broken_jar(cx, by, s, seed):
    r = random.Random(seed)
    top = ' '.join(f'L{20 + i * 20} {r.randint(110, 200)}' for i in range(9))
    return (S.jar_base(cx, by, s, bebek=False)
            + f'<g transform="translate({cx - 100 * s:.1f} {by - 272 * s:.1f}) scale({s})" {SW}>'
              f'<path d="M20 240 L20 160 {top} L180 240" fill="#eaf3f1" fill-opacity="0.3" stroke-width="3"/></g>')


# ======================= SAHNELER =======================
BG_FIELD = (S.sky()
            + S.hill('M0 1060 C200 980 400 1010 560 1050 C740 1000 920 1010 1080 1040 L1080 1920 L0 1920 Z', 'g2')
            + ''.join(S.jar(x, 1080, 0.38) for x in [80, 230, 860, 1010]))
HILL3 = S.hill('M0 1380 C260 1320 520 1350 760 1390 C900 1360 1000 1355 1080 1370 L1080 1920 L0 1920 Z', 'g3',
               lines='M60 1450 C220 1420 360 1424 460 1446 M600 1500 C720 1476 860 1480 980 1504')

# --- 0–2 sn: KANCA — hapşırık, cam patlayıp havada donuyor ---
SHARDS1 = [(random.Random(i).uniform(0, 2 * math.pi), random.Random(i + 50).uniform(260, 620),
            random.Random(i + 99).uniform(30, 80)) for i in range(26)]


def scene1(t):
    b = '<rect width="1080" height="1920" fill="#e7b9bd"/>'
    b += f'<g filter="url(#soft)" opacity="0.6">{S.jar_dome(540, 2600, 9.0)}</g>'
    sym = 'ilo' if t < 1.0 else ('ilo_hazir' if t < 1.4 else 'ilo_hapsu')
    jolt = -30 * ease_out(prog(t, 1.4, 1.5)) * (1 - prog(t, 1.5, 2.0)) if t >= 1.4 else 0
    b += place(sym, 540, 2820 + jolt, 2205)
    nose = (547, 1205 + jolt)
    if t < 1.4:  # altın toz zerresi buruna süzülüyor
        q = ease_out(prog(t, 0.0, 1.0))
        x, y = lerp(700, nose[0], q), lerp(520, nose[1] - 8, q) + 10 * math.sin(t * 6) * (1 - q)
        b += f'<circle cx="{x:.0f}" cy="{y:.0f}" r="34" fill="#f2c230" filter="url(#glow)"/>'
        b += f'<circle cx="{x:.0f}" cy="{y:.0f}" r="12" fill="#f6d25a" stroke="{INK}" stroke-width="2"/>'
    if t >= 1.42:  # cam patladı: parçalar dışarı fırlayıp havada donuyor
        q = ease_out(prog(t, 1.42, 1.56))
        for i, (a, R, sz) in enumerate(SHARDS1):
            x = 540 + math.cos(a) * R * q
            y = 900 + math.sin(a) * R * 1.3 * q
            b += shard(x, y, sz, a * 57 + 20 * (t - 1.42), i)
        flash = 1 - prog(t, 1.42, 1.7)
        b += f'<circle cx="540" cy="1150" r="420" fill="#fff" opacity="{0.8 * flash:.2f}" filter="url(#flash)"/>'
    return b


# --- 2–7 sn: parçalar havada; Ilo birine dokunuyor; kar gibi düşüyorlar ---
SOIL2 = 1640 - 36 * 1.45
SHARDS2 = []
for i in range(20):
    r = random.Random(200 + i)
    a = r.uniform(0, 2 * math.pi); R = r.uniform(200, 380)
    SHARDS2.append((540 + math.cos(a) * R, 1380 + math.sin(a) * R * 0.9, r.uniform(26, 56), r.uniform(0, 360),
                    r.uniform(2.4, 3.6), r.uniform(1640, 1780)))
TOUCH = (650, 1318)


def scene2(t):
    u = t - 2
    b = BG_FIELD + HILL3
    b += S.jar_base(540, 1640, 1.45, bebek=False)
    b += place('ilo', 520, SOIL2, 360)
    for i, (x0, y0, sz, r0, fall_at, gy) in enumerate(SHARDS2):
        p = ease_in(prog(u, fall_at, fall_at + 1.6))
        x = x0 + 30 * math.sin(u * 1.3 + i) * (1 - p) + 40 * math.sin(i) * p
        y = lerp(y0 + 10 * math.sin(u * 2 + i), gy, p)
        b += shard(x, y, sz, r0 + 25 * u + 200 * p, 300 + i)
    # Ilo'nun dokunduğu parça: parlıyor
    p = ease_in(prog(u, 3.0, 4.4))
    tx, ty = TOUCH[0] + 20 * p, lerp(TOUCH[1], 1700, p)
    if 1.2 <= u < 1.9:
        g = 1 - prog(u, 1.2, 1.9)
        b += f'<circle cx="{tx}" cy="{ty}" r="80" fill="#fff8d0" opacity="{g:.2f}" filter="url(#glow)"/>'
    b += shard(tx, ty, 44, 30 + 200 * p, 999)
    b += S.tufts(4, 600, 1060, 1720, 1800, 80, 120, 21) + S.dust(18, 0, 1080, 300, 1700, 22)
    return b


# --- 7–13 sn: Ilo kaçıyor, yürüyen göz peşinde, göz meyveleri dönüyor ---
TREE = (-60, 560, 330, 540)
FRUITS = [(70, 300, 13), (110, 328, 11), (200, 272, 12), (240, 246, 13), (120, 140, 12), (188, 206, 11)]
VELUN_FAR = (720, 380, 309, 700)


def ilo_x3(u):
    if u < 0.5:
        return lerp(540, 640, u / 0.5)
    return lerp(640, 860, prog(u, 0.5, 6.0))


def scene3(t):
    u = t - 7
    b = S.sky()
    b += S.hill('M0 1060 C200 980 400 1010 560 1050 C740 1000 920 1010 1080 1040 L1080 1920 L0 1920 Z', 'g2')
    # uzakta Velun başka fanusları suluyor
    vx, vy, vw, vh = VELUN_FAR
    b += S.use('velun', vx, vy, vw, vh)
    for k in range(4):
        d = (u * 0.9 + k * 0.25) % 1
        b += f'<ellipse cx="{975 - 10 * d:.0f}" cy="{690 + 330 * d:.0f}" rx="4" ry="7" fill="#cfe6ea" stroke="{INK}" stroke-width="1.2"/>'
    b += ''.join(S.jar(x, 1080, 0.38) for x in [80, 230, 860, 1010])
    b += HILL3
    tx, ty, tw, th = TREE
    b += S.use('eyetree', tx, ty, tw, th)
    sx, sy = tw / 320, th / 520
    ix = ilo_x3(u)
    for k, (fx, fy, fr) in enumerate(FRUITS):
        cx, cy, r = tx + fx * sx, ty + fy * sy, fr * sx
        turned = ease_out(prog(u, 2.0 + 0.5 * k, 2.25 + 0.5 * k))
        dx, dy = ix - cx, 1500 - cy
        n = math.hypot(dx, dy) or 1
        px = lerp(0, dx / n * r * 0.45, turned); py = lerp(-r * 0.45, dy / n * r * 0.45, turned)
        b += f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" fill="#f2c230" stroke="{INK}" stroke-width="2.2"/>'
        b += f'<circle cx="{cx + px:.1f}" cy="{cy + py:.1f}" r="{r * 0.42:.1f}" fill="#120c08"/>'
    b += S.jar_base(540, 1640, 1.45, bebek=False)
    for i in range(10):
        r = random.Random(400 + i)
        b += shard(r.uniform(330, 760), r.uniform(1650, 1760), r.uniform(18, 34), r.uniform(0, 360), 500 + i)
    # Ilo: kaideden iniyor, parmak uçlarında yürüyor
    if u < 0.5:
        p = u / 0.5
        y = lerp(SOIL2, 1700, p) - 70 * math.sin(math.pi * p)
        b += place('ilo', ix, y, 300)
    else:
        step = math.sin((u - 0.5) * 2 * math.pi * 2.2)
        b += f'<g transform="rotate({6 + 3 * step:.1f} {ix:.1f} 1700)">' + place('ilo', ix, 1700 - 10 * abs(step), 300) + '</g>'
    if u >= 1.5:
        ex = lerp(-80, ix - 170, ease_out(prog(u, 1.5, 3.0)))
        b += walkeye(ex, 1712, 170, u)
    b += S.tufts(4, 500, 1060, 1760, 1820, 90, 130, 31)
    return b


# --- 13–20 sn: mantarın altına saklanma, dev ayaklar yaklaşıyor ---
MUSH = (400, 1720, 2.6)
STEPS4 = [0.5, 1.8, 3.1, 4.4]


def legs_x(u):
    x = 1180
    for k, st in enumerate(STEPS4):
        x -= 130 * ease_io(prog(u, st - 0.3, st))
    return x


def ground_pulse(u):
    g = 0.0
    for st in STEPS4:
        if st <= u < st + 0.6:
            g = max(g, (1 - prog(u, st, st + 0.6)) * math.sin(prog(u, st, st + 0.6) * math.pi * 3))
    return g


def mush_scene(u, show_hiders=True, cap_lift=0.0, finger=None):
    gp = ground_pulse(u)
    b = S.sky()
    b += f'<g transform="translate(0 {14 * gp:.1f})">'
    b += S.hill('M0 1240 C260 1180 520 1210 760 1250 C900 1220 1000 1215 1080 1230 L1080 1920 L0 1920 Z', 'g3',
                lines='M60 1320 C220 1290 360 1294 460 1316 M600 1360 C720 1336 860 1340 980 1364')
    b += '</g>'
    cx, by, s = MUSH
    b += mush_stem(cx, by, s)
    if show_hiders:
        sym = 'ilo_nefes' if u >= 2.0 else 'ilo'
        b += place(sym, 330, 1720, 300)
        b += walkeye(500, 1730, 170, u * 0.2, look=-1)
    lx = legs_x(u)
    lift_step = sum(60 * math.sin(math.pi * prog(u, st - 0.3, st)) for st in STEPS4)
    b += S.use('velunlegs', lx, 280 - lift_step * 0.3, 800, 1500)
    b += mush_cap(cx, by, s, lift=cap_lift, tilt=-6 * clamp(cap_lift / 300))
    if finger is not None:
        fx, fy = finger
        b += f'<g transform="translate({fx:.1f} {fy:.1f})">' + S.use('finger', 470, -120, 800, 1413, 'transform="rotate(14 870 600)"') + '</g>'
    b += S.tufts(5, -20, 1060, 1760, 1880, 100, 150, 41)
    return b


def scene4(t):
    return mush_scene(t - 13)


# --- 20–26 sn: şapka kalkıyor (altı boş) → tırtılla kaçış ---
def scene5(t):
    u = t - 20
    if u < 1.9:
        uu = 7.0  # bacaklar durmuş hâlde
        reach = ease_out(prog(u, 0.0, 0.5))
        lift = 720 * ease_io(prog(u, 0.5, 1.5))
        # parmak ucu şapkanın tepesine iniyor, sonra şapkayla birlikte yükseliyor
        fx, fy = lerp(300, -150, reach), lerp(-700, -130, reach) - lift
        return mush_scene(uu, show_hiders=False, cap_lift=lift, finger=(fx, fy))
    return chase(u - 1.9, speed=1.0)


def chase(v, speed=1.0, stop_at=None):
    """Çimenlerin arasında kaçış: tırtıl ortada koşar, arka plan kayar."""
    b = S.sky()
    scroll = 520 * v if stop_at is None else 520 * min(v, stop_at) + 520 * (ease_out(prog(v, stop_at, stop_at + 0.8)) * 0.4)
    b += f'<g transform="translate({-((scroll * 0.25) % 1080):.1f} 0)">'
    top = 'M0 1090 C200 1030 400 1060 560 1090 C740 1040 920 1050 1080 1090'
    for off in (0, 1080):
        b += (f'<g transform="translate({off} 0)"><path d="{top} L1080 1920 L0 1920 Z" fill="url(#g1)"/>'
              f'<path d="{top}" fill="none" stroke="{INK}" stroke-width="3"/></g>')
    b += '</g>'
    b += S.hill('M0 1420 C260 1380 520 1400 760 1420 C900 1400 1000 1395 1080 1405 L1080 1920 L0 1920 Z', 'g3')
    # arka sıra çimenler
    for k in range(12):
        x = (k * 140 - scroll * 0.6) % 1300 - 110
        c = ['#3f7f74', '#c9a24a', '#c58aa8'][k % 3]
        b += S.use('tuft', x, 1260, 160, 133, f'style="color:{c}"')
    moving = 1.0 if stop_at is None else 1 - prog(v, stop_at, stop_at + 0.8)
    wave = math.sin(v * 22) * 8 * moving
    cx, cy = 330, 1540
    b += f'<g transform="translate(0 {wave:.1f})">' + S.use('caterpillar', cx, cy, 500, 159) + '</g>'
    b += place('ilo_binis', cx + 270, cy + 60 + wave, 230, VB_SIT)
    b += walkeye(170 + 20 * math.sin(v * 3), 1700, 150, v * 2.2 * moving)
    # ön sıra çimenler, hızlı kayıyor
    for k in range(9):
        x = (k * 170 - scroll * 1.5) % 1500 - 200
        c = ['#3f7f74', '#c58aa8', '#c9a24a'][k % 3]
        b += S.use('tuft', x, 1690, 260, 216, f'style="color:{c}"')
    return b


# --- 26–30 sn: uçurum, kırık fanus vadisi, altın el izi ---
VALLEY_JARS = []
for row, (y, s, n) in enumerate([(980, 0.22, 14), (1080, 0.3, 11), (1210, 0.42, 8), (1380, 0.58, 6)]):
    for k in range(n):
        r = random.Random(row * 40 + k)
        VALLEY_JARS.append((k * 1080 / n + r.uniform(10, 1080 / n - 10), y + r.uniform(-12, 12), s, row * 40 + k))


def valley(z):
    b = '<rect width="1080" height="1920" fill="url(#sky)"/>'
    b += f'<g transform="translate(540 1100) scale({z:.4f}) translate(-540 -1100)">'
    b += S.hill('M0 900 C200 860 420 880 600 900 C780 870 940 880 1080 890 L1080 1920 L0 1920 Z', 'g1', pores=False)
    b += '<rect x="0" y="880" width="1080" height="120" fill="#fbe8e6" opacity="0.6" filter="url(#blur)"/>'
    for x, y, s, sd in VALLEY_JARS:
        b += broken_jar(x, y, s, sd)
    b += '</g>'
    # ön planda uçurum kenarı, Ilo ve arkadaşları arkadan
    b += S.hill('M0 1560 C200 1520 420 1530 620 1560 C700 1575 760 1600 790 1920 L0 1920 Z', 'g4', pores=False)
    b += S.use('caterpillar', 260, 1450, 380, 121)
    b += place('ilo_binis', 470, 1500, 180, VB_SIT)
    b += walkeye(180, 1580, 120, 0)
    return b


def handprint_close(z):
    b = '<rect width="1080" height="1920" fill="#e2b0b6"/>'
    b += f'<g transform="translate(540 900) scale({z:.4f}) translate(-540 -900)">'
    b += ('<polygon points="180,520 860,420 960,1180 520,1460 120,1100" fill="#eaf3f1" fill-opacity="0.5" '
          f'stroke="{INK}" stroke-width="6"/>')
    b += '<path d="M250 600 L700 520" stroke="#fff" stroke-width="16" opacity="0.6"/>'
    hand = (f'<ellipse cx="545" cy="980" rx="92" ry="105" fill="#f2c230"/>'
            + ''.join(f'<ellipse cx="{x}" cy="{y}" rx="23" ry="{ry}" fill="#f2c230" transform="rotate({r} {x} {y})"/>'
                      for x, y, r, ry in [(478, 820, -10, 62), (526, 795, -3, 70), (574, 798, 4, 68), (618, 828, 12, 56),
                                          (448, 990, -48, 52)]))
    b += f'<g filter="url(#glow)" opacity="0.9">{hand}</g><g opacity="0.85">{hand}</g>'
    b += '</g>'
    return b


def scene6(t):
    u = t - 26
    if u < 1.2:
        return chase(4.1 + u, stop_at=4.3), ''
    if u < 2.8:
        return valley(lerp(1.0, 1.12, ease_io(prog(u, 1.2, 2.8)))), ''
    body = handprint_close(lerp(1.0, 1.15, ease_io(prog(u, 2.8, 4.0))))
    black = ease_in(prog(u, 3.3, 3.9))
    return body, f'<rect width="1080" height="1920" fill="#000" opacity="{black:.3f}"/>'


def frame_svg(t):
    if t < 2:
        return frame(scene1(t))
    if t < 7:
        return frame(scene2(t))
    if t < 13:
        return frame(scene3(t))
    if t < 20:
        return frame(scene4(t))
    if t < 26:
        return frame(scene5(t))
    body, top = scene6(t)
    return frame(body, top)


# ======================= SES + MÜZİK =======================
def make_audio(path):
    import numpy as np
    import wave
    SR = 44100; N = int(SR * DUR)
    dry = np.zeros(N); wet = np.zeros(N); mus = np.zeros(N)
    rng = np.random.default_rng(11)

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

    def chime(t0, f, g=0.15, d=1.5):
        s = tone([f, f * 2.76, f * 5.4], d, 0.45, [1, 0.4, 0.15]); put(s, t0, dry, g); put(s, t0, wet, g * 0.6)

    def thump(t0, f=110, d=0.14, g=0.5):
        put(tone([f, f * 1.5], d, d / 3, [1, 0.3]), t0, dry, g)

    def step(t0, g=0.16):
        thump(t0, 170, 0.05, g); env_noise(t0, 0.03, 600, 2500, 0.002, 0.01, g * 0.4)

    def big_step(t0, g=0.8):
        thump(t0, 48, 0.5, g); thump(t0, 70, 0.3, g * 0.6)
        env_noise(t0, 0.6, 40, 300, 0.01, 0.18, g * 0.5); env_noise(t0, 0.6, 40, 300, 0.01, 0.25, g * 0.3, wet)

    def heartbeat(t0, g=0.45):
        thump(t0, 52, 0.25, g); thump(t0 + 0.18, 50, 0.22, g * 0.6)

    def tick(t0, g=0.12):
        n = int(0.006 * SR); put(band_noise(n, 2500, 8000) * np.linspace(1, 0, n), t0, dry, g)

    def pop(t0, g=0.5):
        n = int(0.15 * SR); tt = np.arange(n) / SR
        f = 380 * np.exp(-tt / 0.05) + 120
        put(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 0.05), t0, dry, g)

    def bell(t0, g=0.45):
        fr = [196, 393.5, 523.3, 781, 1047.2]; am = [1, 0.6, 0.45, 0.3, 0.2]
        put(tone(fr, 3.0, 0.9, am), t0, dry, g); put(tone(fr, 3.0, 1.2, am), t0, wet, g * 0.5)

    def wind(t0, t1, g=0.06):
        n = int((t1 - t0) * SR); tt = np.arange(n) / SR
        e = (0.6 + 0.4 * np.sin(2 * np.pi * 0.25 * tt)) * np.minimum(1, tt / 0.6) * np.minimum(1, (t1 - t0 - tt) / 0.3)
        put(band_noise(n, 150, 700) * e, t0, dry, g)

    # ---- 0–2: toz, nefes, hapşırık, cam patlaması ----
    for k in range(6):
        put(tone([rng.uniform(2800, 4200)], 0.5, 0.15), 0.05 + k * 0.15, dry, 0.06)
    n = int(0.45 * SR); tt = np.arange(n) / SR                       # "ha... ha..."
    put(band_noise(n, 400, 2200) * (tt / tt[-1]) ** 2 * (0.7 + 0.3 * np.sin(2 * np.pi * 7 * tt)), 0.95, dry, 0.28)
    env_noise(1.4, 0.25, 800, 7000, 0.004, 0.06, 0.75)                # "hapşu!"
    thump(1.4, 160, 0.1, 0.4)
    env_noise(1.42, 0.8, 1500, 12000, 0.002, 0.12, 0.6)               # cam patlaması
    for _ in range(26):
        chime(1.42 + rng.uniform(0, 0.12), rng.uniform(1800, 4800), 0.06, 0.8)
    # ---- 2–7: asılı parçalar, dokunuş, kar gibi düşüş ----
    for _ in range(9):
        chime(rng.uniform(2.3, 4.6), rng.uniform(1400, 3200), 0.05)
    chime(3.2, 1568, 0.32, 2.5)                                       # Ilo'nun dokunduğu parça
    for _ in range(40):
        chime(rng.uniform(4.6, 7.2), rng.uniform(2200, 5200), 0.035, 0.5)
    wind(2.0, 13.0, 0.05)
    # ---- 7–13: kaçış ----
    thump(7.45, 140, 0.1, 0.3)
    tt0 = 7.6
    while tt0 < 13.0:
        step(tt0, 0.12); tt0 += 0.23
    for k in range(6):
        tick(9.0 + 0.5 * k, 0.18)
    tt0 = 8.6
    while tt0 < 13.0:
        step(tt0, 0.07); tt0 += 0.17                                   # yürüyen gözün minik adımları
    # ---- 13–20: dev ayaklar, nefes tutma, kalp atışı ----
    for st in STEPS4:
        big_step(13 + st)
    tt0 = 17.6
    while tt0 < 20.4:
        heartbeat(tt0, 0.4); tt0 += 0.8
    # ---- 20–26: şapka kalkıyor, kaçış ----
    env_noise(20.5, 1.0, 200, 1200, 0.3, 0.3, 0.15)                    # parmak yaklaşırken hışırtı
    pop(20.55, 0.6)
    for k in range(3):
        tick(21.0 + 0.25 * k, 0.1)
    tt0 = 21.9
    while tt0 < 27.0:
        step(tt0, 0.09 * (1 if tt0 < 26.2 else 1 - (tt0 - 26.2) / 0.8)); tt0 += 0.07
    env_noise(21.9, 4.3, 600, 4000, 0.4, 3.0, 0.05)                    # çimen hışırtısı
    # ---- 26–30: uçurum, vadi, el izi ----
    wind(27.0, 30.0, 0.09)
    bell(28.85, 0.5)
    for k in range(5):
        put(tone([rng.uniform(3000, 4500)], 0.6, 0.2), 28.9 + k * 0.12, wet, 0.05)

    # ================= MÜZİK =================
    def mtof(m):
        return 440.0 * 2 ** ((m - 69) / 12)

    def mbox(m, t0, g=0.15, d=1.6):
        f = mtof(m); n = int(d * SR); tt = np.arange(n) / SR
        s = (np.sin(2 * np.pi * f * tt) * np.exp(-tt / 0.55) + 0.35 * np.sin(4 * np.pi * f * tt) * np.exp(-tt / 0.25)
             + 0.12 * np.sin(2 * np.pi * 3.02 * f * tt) * np.exp(-tt / 0.12)) * np.minimum(1, tt / 0.003)
        put(s, t0, mus, g); put(s, t0, wet, g * 0.3)

    def pizz(m, t0, g=0.25):
        f = mtof(m); n = int(0.5 * SR); tt = np.arange(n) / SR
        s = sum((0.8 ** k) * np.sin(2 * np.pi * f * (k + 1) * tt) for k in range(5)) * np.exp(-tt / 0.09)
        put(s * np.minimum(1, tt / 0.004), t0, mus, g)

    def pad(ms, t0, t1, g=0.1, att=2.0, rel=0.5):
        n = int((t1 - t0) * SR); tt = np.arange(n) / SR; s = np.zeros(n)
        for m in ms:
            for det in (-0.12, 0.12):
                f = mtof(m + det); s += sum((0.55 ** k) * np.sin(2 * np.pi * f * (k + 1) * tt + k) for k in range(4))
        s /= len(ms) * 2
        e = np.minimum(1, tt / att) * np.minimum(1, (t1 - t0 - tt) / rel)
        put(s * e, t0, mus, g); put(s * e, t0, wet, g * 0.3)

    motif = [74, 77, 81, 80, 76, 77, 74, None, 74, 77, 81, 84, 83, 80, 81, None]
    # 2.3–13: merak (96 bpm), hafif ve kurnaz
    E8 = 60 / 96 / 2; tt0 = 2.3; k = 0
    while tt0 < 12.9:
        m = motif[k % len(motif)]
        if m is not None:
            mbox(m, tt0, 0.13)
        if k % 2 == 0:
            pizz([50, 45, 46, 45][(k // 8) % 4] - (12 if k % 4 else 0), tt0, 0.2)
        tt0 += E8; k += 1
    pad([50, 57], 2.3, 13.2, 0.04, 2.5)
    # 13–20: gerilim
    pad([50, 57, 63], 13.0, 20.4, 0.1, 1.5, 0.3)
    pad([38, 39], 14.0, 20.4, 0.08, 3.0, 0.3)
    for k, m in enumerate([86, 85, 81, 80]):
        mbox(m, 13.4 + k * 1.3, 0.09, 2.4)
    # 21.9–26.6: kovalamaca (132 bpm), hızlı ve neşeli-gergin
    E8 = 60 / 132 / 2; tt0 = 21.9; k = 0
    chase_m = [74, 76, 77, 81, 80, 77, 76, 74, 77, 81, 84, 81, 80, 76, 77, 74]
    while tt0 < 26.6:
        mbox(chase_m[k % 16] + 12 * (k // 16 % 2), tt0, 0.12, 0.9)
        if k % 2 == 0:
            pizz([50, 53, 45, 49][(k // 4) % 4], tt0, 0.24)
        tt0 += E8; k += 1
    pad([50, 57, 62], 21.9, 26.6, 0.05, 0.6, 0.2)
    cut = int(26.6 * SR); fade = int(0.08 * SR)
    mus[cut - fade:cut] *= np.linspace(1, 0, fade); mus[cut:] = 0
    # efektlerin altında müziği kıs
    duck = np.ones(N)
    for tt0, depth, d in [(1.4, 0.0, 0.9), (3.2, 0.5, 0.6)] + [(13 + s, 0.4, 0.6) for s in STEPS4] + [(20.55, 0.4, 0.4)]:
        i = int(tt0 * SR); n = int(d * SR)
        curve = depth + (1 - depth) * np.linspace(0, 1, n) ** 2
        duck[i:i + n] = np.minimum(duck[i:i + n], curve[:max(0, min(n, N - i))])
    dry += mus * duck * 0.55

    irn = int(1.4 * SR); tt = np.arange(irn) / SR
    ir = rng.standard_normal(irn) * np.exp(-tt / 0.35); ir /= np.abs(ir).sum() / 6
    L = 1 << int(np.ceil(np.log2(N + irn)))
    rev = np.fft.irfft(np.fft.rfft(wet, L) * np.fft.rfft(ir, L), L)[:N]
    mix = dry + wet * 0.3 + rev
    mix *= 0.9 / (np.abs(mix).max() + 1e-9)
    fade = int(0.4 * SR); mix[-fade:] *= np.linspace(1, 0, fade)
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
