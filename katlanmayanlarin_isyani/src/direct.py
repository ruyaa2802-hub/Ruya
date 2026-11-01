"""Yönetmenlik: replik zamanları, aktör anahtar kareleri, kamera, yığın hareketi, insan elleri."""
import math, os, wave
import numpy as np
from style import ease, ease_io, ease_out
from lines import LINES as TEXTS

HERE = os.path.dirname(os.path.abspath(__file__))
LINES_DIR = os.path.join(HERE, '..', 'audio', 'lines')
FPS = 30

# (kod, başlangıç sn) — konuşan karakter lines.py'den
DUR = 91.0
END_T = 87.4          # bitiş kartı
H0 = 76.0             # insan ellerinin geldiği an
SCHED = [('g1', 3.2), ('t1', 10.6), ('h1', 18.5), ('cA1', 24.4), ('cB1', 28.5), ('p1', 30.9),
         ('cA2', 36.5), ('cB2', 39.45), ('cA3', 42.4), ('cB3', 43.2), ('p2', 44.8), ('h2', 48.2),
         ('g2', 52.7), ('t2', 53.2), ('p3', 53.7), ('cA4', 54.2), ('h3', 54.7),
         ('s1', 56.8), ('s2', 59.8), ('t3', 67.6), ('h4', 71.3),
         ('a_g', 74.0), ('a_t', 74.06), ('a_cA', 74.12), ('a_cB', 74.0), ('a_h', 74.16), ('a_p', 74.08), ('a_s', 74.03),
         ('g3', 86.2)]
CROWD = {c for c, _ in SCHED if c.startswith('a_')}
SFX = [('keys', 0.05), ('door', 0.45), ('car', 0.8), ('whoosh', 2.75), ('whip', 10.3), ('whip', 18.3), ('pop', 24.3),
       ('whip', 28.4), ('whoosh', 30.8), ('whip', 36.4), ('whip', 39.3), ('whip', 42.3), ('whip', 43.1), ('whoosh', 44.6),
       ('whip', 48.1), ('chaos', 52.6), ('scratch', 56.45), ('stomp', 56.95), ('gulp', 59.3), ('whoosh', 64.0),
       ('step', 70.9), ('step', 71.6), ('step', 72.3), ('step', 73.0), ('step', 73.6), ('fanfare', 73.95),
       ('rustle', H0 + 1.2), ('whoosh', H0 + 1.9), ('thud', H0 + 4.45), ('step', 82.4), ('step', 83.0), ('step', 83.6),
       ('door2', 84.0), ('cricket', 84.3), ('zoom', 85.95), ('rimshot', END_T), ('trombone', END_T + 0.35)]
NAMES = {'gomlek': 'GÖMLEK BEY', 'tisort': 'TİŞÖRT', 'corapA': 'KIRMIZI ÇORAP', 'corapB': 'MAVİ ÇORAP',
         'havlu': 'HAVLU ABİ', 'pantolon': 'PANTOLON', 'sepet': 'ÇAMAŞIR SEPETİ', 'hepsi': 'HEPSİ'}
NAME_COL = {'gomlek': (235, 240, 255), 'tisort': (255, 200, 80), 'corapA': (255, 120, 130), 'corapB': (120, 180, 255),
            'havlu': (130, 220, 225), 'pantolon': (150, 170, 240), 'sepet': (240, 190, 120), 'hepsi': (255, 255, 255)}


def _ez(mode, u):
    return {'L': u, 'O': ease_out(u), 'I': ease_io(u)}.get(mode, ease(u)) if mode != 'L' else u


class Track:
    def __init__(self, default):
        self.keys = []; self.default = default

    def add(self, t, v, mode='S'):
        self.keys.append((t, v, mode)); self.keys.sort(key=lambda k: k[0])

    def at(self, t):
        ks = self.keys
        if not ks:
            return self.default
        if t <= ks[0][0]:
            return ks[0][1]
        if t >= ks[-1][0]:
            return ks[-1][1]
        for i in range(1, len(ks)):
            if t < ks[i][0]:
                a, b = ks[i - 1], ks[i]
                if b[2] == 'H':
                    return a[1]
                u = (t - a[0]) / max(1e-6, b[0] - a[0])
                return a[1] + (b[1] - a[1]) * _ez(b[2], u)
        return ks[-1][1]


PARAMS = dict(x=540, y=1450, sc=1.0, tilt=0.0, dark=1.0, alpha=1.0, eo=1.0, lx=0.0, ly=0.0, brow=0.0, bang=0.0,
              mo=0.0, mc=0.2, tear=0.0, blush=0.3, lid=-1.0, lax=-14, lay=66, rax=14, ray=66, bend=1.0, trem=0.0,
              flail=0.0, bounce=0.0, legs=0.0, sx=1.0, sy=1.0, ride=0.0, clip=9999.0, look=1.0)


class Actor:
    def __init__(self, name, **init):
        self.name = name
        self.tr = {k: Track(init.get(k, v)) for k, v in PARAMS.items()}
        self.hops = []

    def k(self, t, ease='S', **kw):
        for p, v in kw.items():
            self.tr[p].add(t, v, ease)
        return self

    def hop(self, t0, t1, h):
        self.hops.append((t0, t1, h)); return self


# ---------------------------------------------------------------- konuşma zarfları
_env = {}


def _load():
    if _env:
        return
    for code, t0 in SCHED:
        who = TEXTS[code][0]
        with wave.open(os.path.join(LINES_DIR, code + '.wav')) as w:
            sr = w.getframerate()
            x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
        hop = sr // 120
        n = len(x) // hop
        rms = np.sqrt(np.mean(x[:n * hop].reshape(n, hop) ** 2, axis=1))
        e = np.clip(rms / (np.percentile(rms, 92) + 1e-6), 0, 1.15)
        e = np.convolve(e, np.ones(3) / 3, mode='same')
        _env[code] = (who, t0, e, len(x) / sr)


def speech(who, t):
    _load()
    best = 0.0
    for code, (w, t0, e, dur) in _env.items():
        if w != who or t < t0 or t > t0 + dur:
            continue
        i = (t - t0) * 120
        i0 = int(i)
        if i0 + 1 < len(e):
            best = max(best, float(e[i0] * (1 - (i - i0)) + e[i0 + 1] * (i - i0)))
    return min(1.0, best ** 0.85 * 0.98)


def spans():
    _load()
    out = []
    for code, t0 in SCHED:
        who, _, e, dur = _env[code]
        idx = np.where(e > 0.12)[0]
        a = t0 + (idx[0] / 120 if len(idx) else 0) - 0.05
        b = t0 + (idx[-1] / 120 if len(idx) else dur) + 0.3
        out.append((code, who, a, b))
    return out


def subtitles_at(t):
    """Aynı anda birden fazla konuşan olabilir (kavga)."""
    res = []
    crowd_on = False
    for code, who, a, b in spans():
        if a - 0.05 <= t <= b:
            if code in CROWD:
                crowd_on = True
                continue
            res.append((who, TEXTS[code][1]))
    if crowd_on:
        res.append(('hepsi', 'SONUNDA! BİZİ KATLAYACAK!'))
    return res[-3:]


# ---------------------------------------------------------------- AKTÖRLER (doğal, dağınık yerleşim)
BASE = {'gomlek': (790, 800), 'pantolon': (580, 1100), 'corapA': (400, 918), 'corapB': (990, 912),
        'tisort': (300, 1585), 'havlu': (960, 1535), 'sepet': (640, 1725)}
FACE = {'gomlek': -238, 'pantolon': -322, 'corapA': -244, 'corapB': -176, 'tisort': -214, 'havlu': -258, 'sepet': -206}
CLIP_SOFA = 792      # koltuk sırtının üst kenarı (Pantolon arkada)


def line_t(code):
    return dict(SCHED)[code]


def line_d(code):
    _load()
    return _env[code][3]


def build():
    A = {n: Actor(n, x=x, y=y, eo=0.0, mc=0.0) for n, (x, y) in BASE.items()}
    G, T, CA, CB, H, P, SP = (A[k] for k in ('gomlek', 'tisort', 'corapA', 'corapB', 'havlu', 'pantolon', 'sepet'))
    CA.k(0, ride=1.0)
    P.k(0, clip=CLIP_SOFA)
    # --- cansız başlangıç pozları
    G.k(0, sy=0.62, sx=1.12, tilt=-10, y=812)        # sırta asılı, buruşuk
    T.k(0, tilt=-24, sy=0.9, sx=1.05)                  # halıya düşmüş
    H.k(0, tilt=9, sy=0.88, sx=1.08)                   # yere yığılmış
    SP.k(0, tilt=-7)                                   # hafif devrik sepet
    CB.k(0, tilt=-6); CA.k(0, tilt=6)
    # --- uyanış
    G.k(2.6, eo=0.0); G.k(2.85, 'O', eo=1.0, brow=0.8, lx=1.0, ly=0.0)          # kapıya doğru bakar
    G.k(3.0, sy=0.62, sx=1.12, tilt=-10, y=812); G.k(3.45, 'O', sy=1.0, sx=1.0, tilt=0, y=800); G.hop(3.0, 3.45, 30)
    G.k(4.3, lx=-0.3, brow=0.2, bang=1.0, mc=-0.5)
    G.k(5.2, lax=-46, lay=-30, rax=46, ray=-30)
    G.k(8.0, lax=-20, lay=-70, rax=60, ray=-10)
    G.k(10.3, lax=-14, lay=66, rax=14, ray=66, bang=0.8, mc=-0.4)
    for a, tw in ((T, 4.0), (H, 4.3), (CA, 4.5), (CB, 4.8), (P, 5.2), (SP, 5.5)):
        a.k(tw, eo=0.0); a.k(tw + 0.25, 'O', eo=1.0, brow=0.7); a.k(tw + 1.0, brow=0.1, mc=0.0)
    P.k(5.0, y=1100); P.k(5.6, y=1062)   # arkadan kafasını uzatır
    # Tişört: halıda umursamaz
    T.k(10.2, lid=0.4, mc=0.45, lax=40, lay=-70, rax=-40, ray=-70)
    T.k(14.6, rax=-60, ray=-64, lax=40, lay=-70, mc=-0.4, lid=0.15, brow=0.5, bang=-0.3)
    T.k(17.4, rax=14, ray=66, mc=0.3, lid=0.4, brow=0.0, bang=0.0)
    # Havlu: dedikodu başlatır, kollar kavuşturulmuş
    H.k(18.2, sy=0.95, sx=1.03, lid=0.35, mc=-0.2, lax=46, lay=6, rax=-46, ray=6, bang=0.3)
    H.k(24.2, mc=0.1)
    # Kırmızı çorap: "Ay!"
    CA.k(24.2, brow=0.9, bang=-0.6, mc=-0.3, lax=26, lay=-70, blush=0.6)
    CA.k(26.0, lax=-14, lay=66, rax=30, ray=-40)
    CA.k(28.3, rax=14, ray=66, mc=0.2)
    # Mavi çorap
    CB.k(28.3, lid=0.25, mc=0.5, tilt=4, rax=34, ray=-50, brow=0.6)
    CB.k(30.6, rax=14, ray=66, tilt=-2)
    # Pantolon arkadan yükselir
    P.k(30.6, y=1062); P.k(31.0, 'O', y=1010, lid=0.3, ly=-0.4, mc=0.4)
    P.k(36.2, y=1010); P.k(36.7, y=1062, ly=0.0)
    # çoraplar
    CA.k(36.3, mc=-0.4, bang=-0.9, brow=0.9, trem=0.3)
    CA.k(39.3, trem=0.0)
    CB.k(39.3, lid=0.3, mc=0.75, tilt=6, rax=30, ray=-40)
    CA.k(42.25, 'O', bang=1.0, brow=0.0, mc=-0.7, lax=26, lay=30, rax=-26, ray=30, tilt=-5)
    CB.k(43.0, lid=0.4, mc=0.9, tilt=8, brow=0.7, bang=-0.2)
    CB.k(44.6, tilt=-2, rax=14, ray=66, mc=0.4)
    # Pantolon kibir; Havlu sözünü keser
    P.k(44.5, y=1062); P.k(44.9, 'O', y=1000, ly=-0.6, lid=0.35, mc=0.45, bang=0.2)
    P.k(48.1, ly=0.0, lid=0.0, brow=1.0, mc=-0.4, bang=-0.2)
    H.k(48.0, sy=1.0, sx=1.0, tilt=3, bang=1.2, brow=-0.2, lid=0.5, mc=-0.7, rax=-60, ray=-40, lax=46, lay=6)
    H.k(52.6, rax=-46, ray=6)
    # kaos (52.6–56.6): herkes bağırır
    for a in (G, T, CA, CB, H, P):
        a.k(52.5, flail=0.0, trem=0.0)
        a.k(52.8, flail=0.55, trem=0.3, bang=1.1, brow=0.0, mc=-0.6, lid=0.0)
        a.k(56.55, flail=0.55, trem=0.3)
    P.k(52.8, y=1000)
    SP.k(52.8, bang=0.7, mc=-0.4, brow=0.0)
    # Sepet kalkar
    SP.k(56.5, legs=0.0, tilt=-7); SP.k(56.95, 'O', legs=1.0, tilt=0); SP.hop(56.5, 56.95, 40)
    SP.k(56.85, bang=1.3, mc=-0.8, lax=-50, lay=-80, rax=50, ray=-80)
    SP.k(59.4, lax=30, lay=40, rax=-30, ray=40, bang=0.9)          # eller belde
    SP.k(62.6, rax=-40, ray=-100, flail=0.25)
    SP.k(65.0, rax=60, ray=-60, lax=-60, lay=-60, flail=0.35, bang=1.0)
    SP.k(67.4, flail=0.0, lax=30, lay=40, rax=-30, ray=40)
    for a in (G, T, CA, CB, H, P):
        a.k(56.7, 'H', flail=0.0, trem=0.0)
        a.k(56.75, 'O', eo=1.0, brow=1.0, bang=-0.3, mc=-0.4, lid=0.0, lax=-14, lay=66, rax=14, ray=66)
        a.k(60.5, brow=0.5, bang=-0.5, mc=-0.3, lid=0.15)
    P.k(56.75, y=1062)
    T.k(67.4, lid=0.45, mc=0.35, lax=40, lay=-70, rax=-40, ray=-70)       # mırıldanır
    # ayak sesleri
    for a in (G, T, CA, CB, H, P, SP):
        a.k(70.8, brow=1.0, bang=-0.4, mc=-0.3, lid=0.0, look=1.0)
        a.k(71.0, look=0.0, lx=1.0, ly=0.0)
        a.k(73.8, mc=1.0, lax=-14, lay=66, rax=14, ray=66)
        a.k(74.1, 'O', lax=-40, lay=-90, rax=40, ray=-90, bounce=0.5)
        a.k(76.4, bounce=0.0, lax=-14, lay=66, rax=14, ray=66, mc=0.4)
        a.k(77.3, lx=-0.6, ly=-0.4, eo=1.0, brow=1.2, mc=-0.2)
        a.k(81.0, lx=0.8, ly=0.0, mc=-0.3)
        a.k(84.4, lx=0.0, ly=0.2, brow=0.6, bang=-0.2)
        a.k(85.0, look=0.0)
    P.k(70.8, y=1062); P.k(74.0, y=1000); P.k(76.5, y=1062)
    T.k(70.8, lax=-14, lay=66, rax=14, ray=66)
    CA.k(H0 + 1.2, eo=1.0, brow=1.3, mo=0.4, trem=0.5); CA.k(H0 + 4.6, trem=0.0, mo=0.0)
    # Gömlek kameraya
    G.k(85.6, lx=1.0, ly=0.1, lid=0.0, mc=-0.25, bang=0.0)
    G.k(86.05, 'O', lx=0.0, ly=0.0, lid=0.45, mc=-0.35, bang=0.35, brow=0.2)
    return A


# ---------------------------------------------------------------- yığın + insan
def pile_offset(t):
    dx = dy = rot = 0.0
    if 52.6 <= t < 56.6:
        dx += 2 * math.sin(t * 37); dy += 1.5 * math.sin(t * 29)
    if t >= H0 + 1.2:
        dy = -110 * ease_io((t - H0 - 1.2) / 0.7)
    if t >= H0 + 1.9:
        u = ease_io((t - H0 - 1.9) / 2.3)
        dx = 260 * u
        dy = -110 - 30 * math.sin(math.pi * min(1, u))
        rot = 2.5 * math.sin(t * 6) * (1 - abs(2 * u - 1))
    if t >= H0 + 4.2:
        u = min(1.0, (t - H0 - 4.2) / 0.25)
        dx, dy, rot = 260, -110 * (1 - u * u), 0
    if t >= H0 + 4.45:
        k = t - H0 - 4.45
        dy = -18 * math.exp(-k * 7) * abs(math.sin(k * 22))
    return dx, dy, rot


def hands(t):
    if t < H0 or t > H0 + 6.2:
        return None
    dx, dy, _ = pile_offset(t)
    L = (40 + dx, 1080 + dy); R = (790 + dx, 1080 + dy)
    if t < H0 + 1.2:
        u = ease_out((t - H0) / 1.2)
        L = (L[0] - 60 * (1 - u), -260 + (L[1] + 260) * u)
        R = (R[0] + 60 * (1 - u), -260 + (R[1] + 260) * u)
    if t > H0 + 4.8:
        u = ease_io((t - H0 - 4.8) / 1.4)
        L = (L[0] - 80 * u, L[1] + (-300 - L[1]) * u)
        R = (R[0] + 80 * u, R[1] + (-300 - R[1]) * u)
    grip = 1.0 if H0 + 1.1 <= t <= H0 + 4.8 else 0.0
    return L, R, grip


def human_shadow(t):
    if 71.0 <= t < 84.0:
        return 0.38 * ease((t - 71.0) / 4.0) * (1 - ease((t - 82.5) / 1.5))
    return 0.0


# ---------------------------------------------------------------- KAMERA
CU = {'gomlek': (790, 640, 2.2), 'tisort': (320, 1420, 2.15), 'havlu': (835, 1330, 2.15), 'corapA': (400, 740, 2.45),
      'corapB': (865, 790, 2.45), 'pantolon': (580, 760, 2.35), 'sepet': (640, 1470, 2.0)}
WIDE = (540, 1150, 1.0)


def _cu(n, extra=0.12):
    x, y, z = CU[n]
    return (x, y, z), (x, y, z + extra)


SHOTS = []


def _shot(t0, t1, a, b, mode='S'):
    SHOTS.append((t0, t1, a, b, mode))


_shot(0.0, 3.0, WIDE, (540, 1130, 1.06))
_shot(3.0, 3.35, (540, 1130, 1.06), CU['gomlek'], 'I')
_shot(3.35, 10.3, *_cu('gomlek'))
for (t0, t1, n) in ((10.3, 18.3, 'tisort'), (18.3, 24.3, 'havlu'), (24.3, 28.4, 'corapA'), (28.4, 30.8, 'corapB'),
                    (30.8, 36.4, 'pantolon'), (36.4, 39.3, 'corapA'), (39.3, 42.3, 'corapB'), (42.3, 43.1, 'corapA'),
                    (43.1, 44.6, 'corapB'), (44.6, 48.1, 'pantolon'), (48.1, 52.6, 'havlu')):
    a, b = _cu(n)
    _shot(t0, t0 + 0.28, SHOTS[-1][3], a, 'I')
    _shot(t0 + 0.28, t1, a, b)
_shot(52.6, 53.0, SHOTS[-1][3], (540, 1150, 1.05), 'I')
_shot(53.0, 56.6, (540, 1150, 1.05), (540, 1150, 1.1))
_shot(56.6, 56.95, (540, 1150, 1.1), (640, 1430, 2.0), 'I')
_shot(56.95, 64.0, (640, 1430, 2.0), (640, 1420, 2.3))
_shot(64.0, 67.4, (640, 1420, 2.3), (540, 1150, 1.08), 'I')
_shot(67.4, 67.7, (540, 1150, 1.08), CU['tisort'], 'I')
_shot(67.7, 70.8, CU['tisort'], (320, 1420, 2.3))
_shot(70.8, 71.2, (320, 1420, 2.3), (540, 1150, 1.03), 'I')
_shot(71.2, 83.6, (540, 1150, 1.03), (560, 1130, 1.06))
_shot(83.6, 85.9, (560, 1130, 1.06), (760, 820, 1.6))
_shot(85.9, 86.15, (760, 820, 1.6), (792, 600, 2.9), 'I')
_shot(86.15, DUR, (792, 600, 2.9), (792, 605, 3.05))
SHAKES = [(3.2, 3.6, 6, 30), (52.6, 56.6, 6, 23), (56.95, 57.4, 14, 30), (70.9, 71.1, 4, 30), (71.6, 71.8, 5, 30),
          (72.3, 72.5, 6, 30), (73.0, 73.2, 7, 30), (73.6, 73.85, 8, 30), (H0 + 4.45, H0 + 4.9, 12, 30)]


def camera(t):
    cx, cy, z = WIDE
    for t0, t1, a, b, mode in SHOTS:
        if t0 <= t <= t1:
            u = (t - t0) / (t1 - t0)
            e = {'S': ease, 'I': ease_io}[mode](u)
            cx, cy, z = (a[i] + (b[i] - a[i]) * e for i in range(3))
            break
    dx = dy = 0.0
    for t0, t1, amp, fr in SHAKES:
        if t0 <= t <= t1:
            k = (1 - (t - t0) / (t1 - t0)) ** 1.3
            dx += amp * k * math.sin(t * fr * 2.1) / z
            dy += amp * k * math.sin(t * fr * 1.7 + 1) / z
    dx += 1.5 * math.sin(t * 0.7) / z
    dy += 1.2 * math.sin(t * 1.1 + 2) / z
    hw, hh = 540 / z, 960 / z
    return min(max(cx + dx, hw), 1080 - hw), min(max(cy + dy, hh), 1920 - hh), z


def blink(t, seed):
    period = 3.4 + (seed % 7) * 0.37
    ph = (t + seed * 0.71) % period
    return abs(ph - 0.07) / 0.07 if ph < 0.14 else 1.0


def speaker_at(t):
    """Son konuşmaya başlayan karakter (kalabalık hariç)."""
    best = None
    for code, who, a, b in spans():
        if code in CROWD:
            continue
        if a <= t <= b + 0.6:
            best = who
    return best


def state_of(act, t, acts=None):
    s = {k: tr.at(t) for k, tr in act.tr.items()}
    sxe = sye = 1.0
    yoff = 0.0
    for t0, t1, h in act.hops:
        if t0 - 0.12 <= t < t0:
            u = (t - (t0 - 0.12)) / 0.12; sye *= 1 - 0.1 * ease(u); sxe *= 1 + 0.06 * ease(u)
        elif t0 <= t < t1:
            u = (t - t0) / (t1 - t0); yoff -= h * 4 * u * (1 - u)
        elif t1 <= t < t1 + 0.22:
            u = (t - t1) / 0.22; k = math.sin(math.pi * u) * (1 - u); sye *= 1 - 0.12 * k; sxe *= 1 + 0.08 * k
    seed = sum(ord(c) for c in act.name)
    if s['bounce'] > 0.01:
        ph = t * 2 * math.pi * (2.2 + (seed % 5) * 0.15) + seed
        yoff -= s['bounce'] * 18 * abs(math.sin(ph))
    if s['flail'] > 0.01:
        f = s['flail']
        s['lax'] += 26 * f * math.sin(t * 12 + seed); s['lay'] += 34 * f * math.sin(t * 10 + seed * 2)
        s['rax'] += 26 * f * math.sin(t * 11 + seed * 3); s['ray'] += 34 * f * math.sin(t * 13 + seed)
        s['tilt'] += 3 * f * math.sin(t * 6 + seed)
    if s['trem'] > 0.01:
        s['x'] += s['trem'] * 2.0 * math.sin(t * 57 + seed)
    # kumaş: neredeyse hiç "nefes" yok, sadece çok hafif
    br = math.sin(2 * math.pi * t / 4.0 + seed)
    sye *= 1 + 0.004 * br
    sp = speech(act.name, t)
    sye *= 1 + 0.025 * sp; sxe *= 1 - 0.012 * sp
    if sp > 0.05:
        s['tilt'] += 1.2 * sp * math.sin(t * 7 + seed)
    # konuşana doğal bakış
    lx, ly = s['lx'], s['ly']
    if s['look'] > 0.5 and acts is not None and s['eo'] > 0.5:
        who = speaker_at(t)
        if who and who != act.name and who in acts:
            o = acts[who]
            tx = o.tr['x'].at(t) + (pile_offset(t)[0] if o.tr['ride'].at(t) > 0.5 else 0)
            ty = o.tr['y'].at(t) + FACE[who]
            mx = s['x'] + (pile_offset(t)[0] if s['ride'] > 0.5 else 0)
            my = s['y'] + FACE[act.name]
            lx = max(-1, min(1, (tx - mx) / 220)); ly = max(-0.8, min(0.8, (ty - my) / 300))
    if s['ride'] > 0.5:
        pdx, pdy, rot = pile_offset(t)
        s['x'] += pdx; yoff += pdy; s['tilt'] += rot * 2
    if s['legs'] > 0.001:
        yoff -= 70 * s['legs']
    eo = s['eo'] * (blink(t, seed) if s['eo'] > 0.5 else 1.0)
    st = dict(eo=eo, lx=lx, ly=ly, brow=s['brow'] + 0.3 * sp, bang=s['bang'], mo=max(s['mo'], sp), mc=s['mc'],
              tear=s['tear'], drop=-1.0, blush=s['blush'], lid=(None if s['lid'] < 0 else s['lid']),
              lax=s['lax'], lay=s['lay'], rax=s['rax'], ray=s['ray'], bend=s['bend'], prop=None, talk=t)
    return dict(name=act.name, x=s['x'], y=s['y'] + yoff, ground=s['y'], sc=s['sc'], tilt=s['tilt'], sx=s['sx'] * sxe,
                sy=s['sy'] * sye, dark=s['dark'], alpha=s['alpha'], legs=s['legs'], clip=s['clip'], expr=st, speech=sp)
