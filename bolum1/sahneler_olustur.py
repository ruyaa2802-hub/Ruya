"""Bölüm 1 storyboard karelerini (1080x1920, 9:16) SVG olarak üretir.

Karakter parçaları karakterler/velun.svg ve karakterler/ilo.svg'den,
dünya sembolleri karakterler/dunya.svg'den okunur; tasarımlar değişirse
bu betiği yeniden çalıştırmak yeterli.
"""
import os
import re
import random

KOK = os.path.dirname(os.path.abspath(__file__))
KAR = os.path.join(KOK, '..', 'karakterler')
W, H = 1080, 1920
INK = '#2b1e18'


def oku(ad):
    with open(os.path.join(KAR, ad), encoding='utf-8') as f:
        return f.read()


velun_svg, ilo_svg, dunya_svg = oku('velun.svg'), oku('ilo.svg'), oku('dunya.svg')


def blok(metin, etiket, kimlik):
    m = re.search(r'<%s id="%s".*?</%s>' % (etiket, kimlik, etiket), metin, re.S)
    assert m, kimlik
    return m.group(0)


# ---------- ortak tanımlar ----------
defs = ['<defs>']
for k in ['paper', 'wobble']:
    defs.append(blok(velun_svg, 'filter', k))
defs.append('<filter id="smoke" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="11"/></filter>')
defs.append('<filter id="soft"><feGaussianBlur stdDeviation="7"/></filter>')
defs.append('<filter id="glow" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="6"/></filter>')
for k in ['hatch', 'cross', 'dots']:
    defs.append(blok(velun_svg, 'pattern', k))
defs.append(blok(ilo_svg, 'pattern', 'weave'))
defs.append(blok(dunya_svg, 'pattern', 'pores'))
defs.append(blok(velun_svg, 'radialGradient', 'eyeglow'))
for k in ['headClip', 'eyeL', 'eyeR', 'hornClip']:
    defs.append(blok(velun_svg, 'clipPath', k))
for k in ['tunicClip', 'faceClip']:
    defs.append(blok(ilo_svg, 'clipPath', k))
for k in ['sky', 'g1', 'g2', 'g3', 'g4']:
    defs.append(blok(dunya_svg, 'linearGradient', k))
for k in ['tuft', 'bigmush', 'walkeye', 'eyetree', 'earplant', 'bulb', 'cloud', 'mushtree']:
    defs.append(blok(dunya_svg, 'symbol', k))
defs.append('''<radialGradient id="vignette" cx="50%" cy="48%" r="70%">
  <stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#0d0810" stop-opacity="0.92"/></radialGradient>''')

# Velun: tüm vücut (avucundaki minik figür çıkarılmış)
a = velun_svg.index('>', velun_svg.index('<g filter="url(#wobble)"')) + 1
b = velun_svg.index('  </g>\n\n  <!-- kâğıt dokusu katmanı -->')
velun_ic = velun_svg[a:b].replace(' id="boynuz"', '')
velun_ic = re.sub(r'\s*<!-- avuçtaki minik Ilo -->\s*<g transform="translate\(752 498\)".*?</g>', '', velun_ic, flags=re.S)
SW = 'stroke="%s" stroke-linejoin="round" stroke-linecap="round"' % INK
defs.append('<symbol id="velun" viewBox="150 -200 760 1720" overflow="visible"><g %s>%s</g></symbol>' % (SW, velun_ic))
# Velun: yakın plan kafa
defs.append('<symbol id="velunhead" viewBox="250 -60 400 640" overflow="visible"><g %s>%s</g></symbol>' % (SW, velun_ic))

# Dev Velun parmağı (ilo.svg'den)
a = ilo_svg.index('    <!-- DEV VELUN PARMAĞI')
b = ilo_svg.index('    <!-- MİNİK BEBEK ILO')
parmak = ilo_svg[a:b]
defs.append('<symbol id="finger" viewBox="640 -60 600 1060" overflow="visible"><g %s>%s</g></symbol>' % (SW, parmak))

# Ilo: ayakta, kol uzatmış
a = ilo_svg.index('    <!-- MİNİK BEBEK ILO')
b = ilo_svg.index('  </g>\n\n  <rect width="900" height="1200" fill="#ece2cb" opacity="0.001"')
ilo_ic = ilo_svg[a:b]
defs.append('<symbol id="ilo" viewBox="340 350 330 630" overflow="visible"><g %s>%s</g></symbol>' % (SW, ilo_ic))

# Ilo: kahkaha atan (ağız açık gülüş, gözler hafif kısık)
ilo_gul = ilo_ic.replace(
    '<ellipse cx="452" cy="540" rx="7" ry="5.5" fill="#b5655a" stroke-width="1.8"/>',
    '<path d="M428 530 C436 556 468 556 476 530 Z" fill="#b5655a" stroke-width="2.2"/>'
    '<path d="M440 546 C448 552 458 552 466 546" fill="none" stroke="#e7a0a0" stroke-width="4"/>')
ilo_gul = ilo_gul.replace('<ellipse cx="416" cy="490" rx="21" ry="23"', '<ellipse cx="416" cy="494" rx="21" ry="17"')
ilo_gul = ilo_gul.replace('<ellipse cx="484" cy="490" rx="21" ry="23"', '<ellipse cx="484" cy="494" rx="21" ry="17"')
ilo_gul = ilo_gul.replace('opacity="0.6"/>', 'opacity="0.85"/>')
defs.append('<symbol id="ilo_gul" viewBox="340 350 330 630" overflow="visible"><g %s>%s</g></symbol>' % (SW, ilo_gul))

# Ilo: yere düşmüş, kulaklarını kapatmış (oturur, gözler sımsıkı kapalı)
kafa = ilo_ic[ilo_ic.index('    <!-- KOCAMAN, SAÇSIZ'):]
kafa = re.sub(r'<!-- iri, yuvarlak bebek gözleri.*?<!-- hafif kaşlar -->',
              '<path d="M398 480 L428 492 L398 504 M502 480 L472 492 L502 504" fill="none" stroke-width="4"/>\n    <!-- hafif kaşlar -->',
              kafa, flags=re.S)
kafa = kafa.replace('<ellipse cx="452" cy="540" rx="7" ry="5.5" fill="#b5655a" stroke-width="1.8"/>',
                    '<path d="M432 540 C442 532 462 532 472 540 C462 546 442 546 432 540 Z" fill="#b5655a" stroke-width="2"/>')
kulak_govde = '''
    <!-- büzülmüş oturan gövde -->
    <path d="M370 760 C356 720 380 640 420 600 L480 600 C520 640 544 720 530 760 C500 780 400 780 370 760 Z" fill="#e6dcc2" stroke-width="3"/>
    <path d="M470 604 C510 650 530 720 526 762 L560 762 L560 600 Z" fill="url(#hatch)" stroke="none"/>
    <path d="M372 752 C340 760 330 784 348 792 C380 800 420 792 436 776 Z" fill="#ecccab" stroke-width="2.8"/>
    <path d="M528 752 C560 760 570 784 552 792 C520 800 480 792 464 776 Z" fill="#ecccab" stroke-width="2.8"/>
    <path d="M434 548 L466 548 L466 604 L434 604 Z" fill="#e6c3a0" stroke-width="2.5"/>
'''
kulak_kollar = '''
    <!-- kulakları kapatan kollar -->
    <path d="M410 610 C370 600 340 560 344 506 C346 486 368 486 368 506 C368 548 390 578 424 590 Z" fill="#ecccab" stroke-width="2.8"/>
    <path d="M490 610 C530 600 560 560 556 506 C554 486 532 486 532 506 C532 548 510 578 476 590 Z" fill="#ecccab" stroke-width="2.8"/>
    <circle cx="352" cy="488" r="22" fill="#ecccab" stroke-width="2.8"/>
    <circle cx="548" cy="488" r="22" fill="#ecccab" stroke-width="2.8"/>
    <path d="M340 470 l-6 -10 M352 466 l0 -12 M364 470 l6 -10 M560 470 l6 -10 M548 466 l0 -12 M536 470 l-6 -10" fill="none" stroke-width="2.4"/>
'''
defs.append('<symbol id="ilo_kulak" viewBox="320 350 260 460" overflow="visible"><g %s>%s%s%s</g></symbol>'
            % (SW, kulak_govde, kafa, kulak_kollar))

# Uyuyan, kıvrılmış minik bebek (düşen bebekler ve fanus içleri için)
defs.append('''<symbol id="baby" viewBox="40 180 120 60" overflow="visible">
  <g stroke="#2b1e18" stroke-linejoin="round" stroke-linecap="round">
    <path d="M78 214 C70 200 82 186 100 190 C118 186 150 194 150 212 C150 226 124 232 100 230 C84 230 80 224 78 214 Z" fill="#e6dcc2" stroke-width="2.2"/>
    <circle cx="70" cy="210" r="20" fill="#ecccab" stroke-width="2.2"/>
    <path d="M58 210 C62 214 68 214 72 210" fill="none" stroke-width="1.8"/>
    <circle cx="80" cy="218" r="5" fill="#e3a58f" stroke="none" opacity="0.6"/>
  </g></symbol>''')
defs.append('</defs>')
DEFS = '\n'.join(defs)


# ---------- çizim yardımcıları ----------
def use(sym, x, y, w, h, extra=''):
    return f'<use href="#{sym}" x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" {extra}/>'


def ilo(x, y, h, sym='ilo', extra=''):
    """Ilo'yu ayak tabanı (x merkez, y) olacak şekilde, h yüksekliğinde yerleştirir."""
    vb = {'ilo': (330, 630, 450 - 340, 976 - 350), 'ilo_gul': (330, 630, 110, 626),
          'ilo_kulak': (260, 460, 130, 450)}[sym]
    vw, vh, ox, oy = vb
    s = h / vh
    return use(sym, x - ox * s, y - oy * s, vw * s, h, extra)


def jar_base(cx, by, s, bebek=True):
    """Fanus tabanı (altın kaide + toprak + bebek). cx: merkez, by: kaide altı."""
    g = f'<g transform="translate({cx - 100 * s:.1f} {by - 272 * s:.1f}) scale({s})" {SW}>'
    g += '<ellipse cx="100" cy="236" rx="80" ry="12" fill="#b97c7c" stroke-width="2"/>'
    if bebek:
        g += use('baby', 40, 180, 120, 60)
    g += ('<path d="M8 238 C8 256 192 256 192 238 L192 262 C192 276 8 276 8 262 Z" fill="#c9a24a" stroke-width="2.6"/>'
          '<path d="M8 250 C60 262 140 262 192 250" fill="none" stroke-width="1.4"/></g>')
    return g


def jar_dome(cx, by, s, lift=0, extra=''):
    """Cam kapak. lift>0 ise kapak yukarıda (açık)."""
    g = f'<g transform="translate({cx - 100 * s:.1f} {by - 272 * s - lift:.1f}) scale({s})" {SW} {extra}>'
    g += ('<path d="M20 240 L20 100 C20 30 180 30 180 100 L180 240" fill="#eaf3f1" fill-opacity="0.28" stroke-width="3"/>'
          '<path d="M40 200 L40 108 C40 70 66 54 94 52" fill="none" stroke="#ffffff" stroke-width="7" opacity="0.65"/>'
          '<circle cx="100" cy="36" r="9" fill="#d6a52a" stroke-width="2.2"/></g>')
    return g


def jar(cx, by, s, bebek=True):
    return jar_base(cx, by, s, bebek) + jar_dome(cx, by, s)


def tufts(n, x0, x1, y0, y1, w0, w1, seed):
    r = random.Random(seed)
    out = []
    for _ in range(n):
        x = r.uniform(x0, x1); y = r.uniform(y0, y1); w = r.uniform(w0, w1)
        c = r.choice(['#3f7f74', '#c9a24a', '#c58aa8'])
        out.append(use('tuft', x, y - w * 0.83, w, w * 0.83, f'style="color:{c}"'))
    return ''.join(out)


def dust(n, x0, x1, y0, y1, seed, rmax=3.4):
    r = random.Random(seed)
    return ''.join(f'<circle cx="{r.uniform(x0, x1):.1f}" cy="{r.uniform(y0, y1):.1f}" r="{r.uniform(1.2, rmax):.1f}" '
                   f'fill="#e2b33a" opacity="{r.uniform(0.5, 0.95):.2f}"/>' for _ in range(n))


def sky(moon=True):
    s = '<rect width="1080" height="1920" fill="url(#sky)"/><rect width="1080" height="1920" fill="url(#dots)" opacity="0.2"/>'
    if moon:
        s += f'''<g stroke="{INK}" stroke-width="2.5"><circle cx="250" cy="330" r="118" fill="#f1e3b4"/>
        <path d="M250 212 C320 250 330 410 250 448 C330 448 368 380 368 330 C368 270 320 212 250 212 Z" fill="url(#hatch)" stroke="none"/>
        <circle cx="420" cy="190" r="42" fill="#f1e3b4"/></g>'''
    return s


def hill(d, grad, pores=True, lines=''):
    s = f'<path d="{d}" fill="url(#{grad})" stroke="{INK}" stroke-width="3"/>'
    if pores:
        s += f'<path d="{d}" fill="url(#pores)" stroke="none"/>'
    if lines:
        s += f'<path d="{lines}" fill="none" stroke="{INK}" stroke-width="1.8"/>'
    return s


def caption(no, sure, baslik):
    return (f'<rect x="0" y="1808" width="1080" height="112" fill="#1d1418" opacity="0.82"/>'
            f'<text x="44" y="1876" font-family="Georgia, serif" font-size="38" fill="#f4e6d0" letter-spacing="2">'
            f'SAHNE {no}  ·  {sure}  ·  {baslik}</text>')


def frame(body, no, sure, baslik):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
            f'viewBox="0 0 {W} {H}" width="{W}" height="{H}">{DEFS}'
            f'<g filter="url(#wobble)">{body}</g>'
            f'<rect width="1080" height="1920" fill="#ece2cb" opacity="0.001" filter="url(#paper)"/>'
            f'{caption(no, sure, baslik)}</svg>')


def speed_lines(cx, top, n=3, length=90, gap=16):
    return ''.join(f'<path d="M{cx + (i - (n - 1) / 2) * gap:.1f} {top} l0 {-length + abs(i - (n - 1) / 2) * 24:.1f}" '
                   f'stroke="#fbeef0" stroke-width="5" stroke-linecap="round" opacity="0.85"/>' for i in range(n))


# ---------- SAHNE 1: gökten bebek yağıyor ----------
def sahne1():
    b = sky()
    b += use('cloud', 520, 120, 360, 144)
    b += hill('M0 1180 C180 1110 380 1140 560 1170 C740 1120 920 1130 1080 1160 L1080 1920 L0 1920 Z', 'g2')
    b += hill('M0 1500 C260 1440 520 1470 760 1510 C900 1480 1000 1475 1080 1490 L1080 1920 L0 1920 Z', 'g3',
              lines='M80 1560 C220 1530 360 1534 460 1556 M600 1600 C720 1576 860 1580 980 1604')
    b += tufts(6, -20, 1060, 1500, 1560, 70, 110, 3)
    # uzak, kapanmış fanus sırası
    for x in [90, 250, 410, 670, 830, 990]:
        b += jar(x, 1190, 0.42)
    # ön sıra: kapanmış, kapanıyor, boş
    b += jar(160, 1690, 0.95)
    b += jar(420, 1700, 0.95)
    # kapanmak üzere olan fanus: bebek yeni düştü, kapak iniyor
    b += jar_base(680, 1710, 0.95)
    b += jar_dome(680, 1710, 0.95, lift=150)
    b += f'<path d="M560 1350 l0 -50 M680 1330 l0 -60 M800 1350 l0 -50" stroke="#fbeef0" stroke-width="6" stroke-linecap="round"/>'
    # boş, bekleyen fanus (Ilo'nun)
    b += jar_base(940, 1700, 0.95, bebek=False)
    b += jar_dome(940, 1700, 0.95, lift=260)
    # gökten düşen bebekler
    for x, y, w, rot in [(900, 420, 170, -25), (480, 620, 150, 30), (760, 860, 160, -10), (300, 980, 140, 60), (940, 960, 150, 15)]:
        b += speed_lines(x, y - 60)
        b += f'<g transform="rotate({rot} {x} {y})">' + use('baby', x - w / 2, y - w / 4, w, w / 2) + '</g>'
    b += dust(25, 0, 1080, 500, 1750, 1)
    return frame(b, 1, '0–3 sn', 'Gökten bebekler düşüyor')


# ---------- SAHNE 2: Ilo kalkıp fanustan çıkıyor ----------
def sahne2():
    b = sky()
    b += hill('M0 1060 C200 980 400 1010 560 1050 C740 1000 920 1010 1080 1040 L1080 1920 L0 1920 Z', 'g2')
    for x in [80, 230, 860, 1010]:
        b += jar(x, 1080, 0.38)
    b += hill('M0 1380 C260 1320 520 1350 760 1390 C900 1360 1000 1355 1080 1370 L1080 1920 L0 1920 Z', 'g3',
              lines='M60 1450 C220 1420 360 1424 460 1446 M600 1500 C720 1476 860 1480 980 1504')
    b += use('eyetree', -60, 560, 330, 540)
    # Ilo'nun fanusu: kapak yukarıda asılı kalmış
    b += jar_base(330, 1640, 1.25, bebek=False)
    b += jar_dome(330, 1640, 1.25, lift=340)
    b += tufts(7, -20, 1060, 1560, 1780, 80, 130, 5)
    # Ilo kaideden inmiş, sağa yürüyor
    b += ilo(720, 1650, 560)
    b += ''.join(f'<ellipse cx="{x}" cy="{y}" rx="{r}" ry="{r * 0.5:.1f}" fill="#f4ead2" stroke="{INK}" stroke-width="1.6" opacity="0.9"/>'
                 for x, y, r in [(610, 1656, 14), (640, 1662, 9), (585, 1664, 7)])
    b += dust(18, 0, 1080, 400, 1700, 2)
    return frame(b, 2, '3–6 sn', 'Ilo kalkıp yürüyor')


# ---------- SAHNE 3: dev parmak itiyor, Ilo tepetaklak ----------
def sahne3():
    b = sky()
    b += hill('M0 1100 C200 1020 420 1050 600 1090 C780 1040 940 1050 1080 1080 L1080 1920 L0 1920 Z', 'g2')
    b += hill('M0 1420 C260 1360 520 1390 760 1430 C900 1400 1000 1395 1080 1410 L1080 1920 L0 1920 Z', 'g3',
              lines='M60 1490 C220 1460 360 1464 460 1486')
    b += jar_base(170, 1620, 1.0, bebek=False)
    b += jar_dome(170, 1620, 1.0, lift=470)
    # devasa parmak yukarıdan sağdan
    b += use('finger', 470, -120, 800, 1413, 'transform="rotate(14 870 600)"')
    # Ilo tepetaklak
    b += f'<g transform="rotate(-58 520 1380)">' + ilo(520, 1560, 470) + '</g>'
    # "pof" bulutçukları ve hareket çizgileri
    for x, y, r in [(660, 1240, 34), (700, 1290, 24), (630, 1300, 20)]:
        b += f'<circle cx="{x}" cy="{y}" r="{r}" fill="#fbeef0" stroke="{INK}" stroke-width="2.2"/>'
    # tekrar işareti: hayalet Ilo silüetleri (1. ve 2. itiş)
    b += f'<g opacity="0.22">{ilo(800, 1600, 300)}</g>'
    b += tufts(6, -20, 1060, 1600, 1800, 80, 130, 7)
    return frame(b, 3, '6–11 sn', 'Dev parmak itiyor')


# ---------- SAHNE 4: fanusun arkasında dev sarı gözler ----------
def sahne4():
    b = '<rect width="1080" height="1920" fill="#e9b3b8"/>'
    # arka planı dolduran Velun yüzü, bulanık
    b += f'<g filter="url(#soft)">{use("velunhead", -180, -475, 1440, 2304)}</g>'
    b += '<rect width="1080" height="1920" fill="#f4d6cf" opacity="0.18"/>'
    # ön planda fanus, içinde küçük Ilo
    b += jar_base(540, 1800, 4.2, bebek=False)
    b += ilo(560, 1745, 360)
    b += jar_dome(540, 1800, 4.2)
    b += '<path d="M200 1500 C200 1100 300 820 520 760" fill="none" stroke="#ffffff" stroke-width="10" opacity="0.35"/>'
    return frame(b, 4, '11–16 sn', 'Camın ardında dev gözler')


# ---------- SAHNE 5: Ilo gülüyor, elini cama koyuyor ----------
def sahne5():
    b = '<rect width="1080" height="1920" fill="#e9b3b8"/>'
    b += f'<g filter="url(#soft)" transform="rotate(12 540 700)">{use("velunhead", -100, -522, 1280, 2048)}</g>'
    b += '<rect width="1080" height="1920" fill="#f4d6cf" opacity="0.15"/>'
    # cam yüzeyi (sağda dikey cam duvar)
    b += '<rect x="760" y="0" width="320" height="1920" fill="#eaf3f1" opacity="0.22"/>'
    b += f'<path d="M760 0 L760 1920" stroke="{INK}" stroke-width="4"/>'
    b += '<path d="M820 200 L820 1500 M880 400 L880 900" stroke="#ffffff" stroke-width="9" opacity="0.45"/>'
    # Ilo büyük, kahkaha atıyor, el cama dayalı
    b += ilo(470, 1720, 1250, 'ilo_gul')
    # elin camdaki buğusu
    b += '<ellipse cx="770" cy="1000" rx="60" ry="70" fill="#ffffff" opacity="0.35"/>'
    return frame(b, 5, '16–20 sn', 'Ilo gülüyor')


# ---------- SAHNE 6: TAK TAK, Ilo kulaklarını kapatıyor ----------
def sahne6():
    b = '<rect width="1080" height="1920" fill="#e9b3b8"/>'
    b += f'<g filter="url(#soft)" opacity="0.9">{use("velunhead", -300, -520, 1700, 2720)}</g>'
    # sarsılan fanus: hayalet kopya + asıl
    b += jar_dome(570, 1770, 3.6, extra='opacity="0.35"')
    b += jar_dome(510, 1774, 3.6, extra='opacity="0.25"')
    b += jar_base(540, 1780, 3.6, bebek=False)
    b += ilo(540, 1700, 430, 'ilo_kulak')
    b += jar_dome(540, 1780, 3.6)
    # tırnakla vuran parmak ucu (sağ üstten)
    b += use('finger', 640, -560, 720, 1272, 'transform="rotate(38 900 300)"')
    # darbe halkaları ve ses yazıları
    b += ''.join(f'<path d="M{850 - r} {700 + r * 0.3:.0f} A{r} {r} 0 0 1 {850 + r * 0.2:.0f} {700 - r}" fill="none" stroke="#fbeef0" stroke-width="6" opacity="{1 - r / 260:.2f}"/>'
                 for r in [60, 110, 160, 210])
    return frame(b, 6, '20–25 sn', 'Tak tak tak')


# ---------- SAHNE 7: camda çatlak, içeri süzülen altın toz ----------
def sahne7():
    b = '<rect width="1080" height="1920" fill="#d9a2ab"/>'
    # camın ardında bulanık Ilo, ellerini indiriyor
    b += f'<g filter="url(#soft)" opacity="0.75">{ilo(560, 1700, 700, "ilo_kulak")}</g>'
    b += '<rect width="1080" height="1920" fill="#eaf3f1" opacity="0.25"/>'
    # çatlak: darbe noktasından dallanan çizgiler
    r = random.Random(9)
    cx, cy = 620, 640
    paths = []
    for ang in [200, 235, 260, 300, 330, 20, 70, 110, 150]:
        import math
        x, y = cx, cy
        d = f'M{x} {y}'
        L = r.uniform(260, 560)
        steps = 6
        for k in range(steps):
            a = math.radians(ang + r.uniform(-18, 18))
            x += math.cos(a) * L / steps; y += math.sin(a) * L / steps
            d += f' L{x:.0f} {y:.0f}'
        paths.append(d)
    for d in paths:
        b += f'<path d="{d}" fill="none" stroke="#ffffff" stroke-width="7" opacity="0.8"/>'
        b += f'<path d="{d}" fill="none" stroke="{INK}" stroke-width="2.4"/>'
    b += f'<circle cx="{cx}" cy="{cy}" r="22" fill="#ffffff" opacity="0.85" stroke="{INK}" stroke-width="2"/>'
    # çatlaktan süzülen tek altın toz zerresi
    b += '<circle cx="560" cy="860" r="46" fill="#f2c230" filter="url(#glow)"/>'
    b += f'<circle cx="560" cy="860" r="16" fill="#f6d25a" stroke="{INK}" stroke-width="2"/>'
    b += '<circle cx="555" cy="855" r="5" fill="#fff8e0"/>'
    b += f'<path d="M604 690 C596 740 584 790 568 840" fill="none" stroke="#f2c230" stroke-width="3" stroke-dasharray="4 10"/>'
    # karanlığa kapanış
    b += '<rect width="1080" height="1920" fill="url(#vignette)"/>'
    return frame(b, 7, '25–30 sn', 'Çatlak · Cliffhanger')


if __name__ == '__main__':
    for i, f in enumerate([sahne1, sahne2, sahne3, sahne4, sahne5, sahne6, sahne7], 1):
        with open(os.path.join(KOK, f'sahne{i}.svg'), 'w', encoding='utf-8') as fh:
            fh.write(f())
    print('7 sahne yazıldı')
