"""Yönetmenlik: replik zamanları, aktör anahtar kareleri, kamera, yığın hareketi, insan elleri."""
import math, os, wave
import numpy as np
from style import ease, ease_io, ease_out
from lines import LINES as TEXTS

HERE = os.path.dirname(os.path.abspath(__file__))
LINES_DIR = os.path.join(HERE, '..', 'audio', 'lines')
FPS = 30
DUR = 63.0

# (kod, başlangıç sn) — konuşan karakter lines.py'den
SCHED = [('g1', 3.4), ('t1', 7.9), ('c1', 12.9), ('c2', 14.2), ('c3', 17.4), ('c4', 18.3), ('p1', 20.0), ('h1', 23.5),
         ('g2', 28.4), ('t2', 28.9), ('p2', 29.4), ('c5', 30.0), ('h2', 30.6),
         ('s1', 32.8), ('s2', 35.8),
         ('a_g', 46.5), ('a_t', 46.56), ('a_cA', 46.62), ('a_cB', 46.5), ('a_h', 46.66), ('a_p', 46.58), ('a_s', 46.53),
         ('g3', 58.4)]
CROWD = {c for c, _ in SCHED if c.startswith('a_')}
SFX = [('door', 0.3), ('keys', 0.05), ('boing', 2.45), ('whoosh', 2.75), ('whoosh', 7.6), ('pop', 12.5),
       ('whoosh', 13.95), ('whip', 17.3), ('whip', 18.2), ('whoosh', 19.7), ('whip', 23.4), ('chaos', 28.4),
       ('scratch', 32.45), ('stomp', 32.95), ('gulp', 35.3), ('whoosh', 40.6),
       ('step', 44.0), ('step', 44.6), ('step', 45.2), ('step', 45.8), ('fanfare', 46.45),
       ('rustle', 49.6), ('whoosh', 50.4), ('thud', 52.85), ('step', 54.4), ('step', 55.0), ('step', 55.6), ('door2', 56.0),
       ('cricket', 56.4), ('zoom', 58.1), ('rimshot', 59.55), ('trombone', 59.9)]
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
              flail=0.0, bounce=0.0, legs=0.0, sx=1.0, sy=1.0, ride=1.0)


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


# ---------------------------------------------------------------- AKTÖRLER
BASE = {'gomlek': (400, 900), 'havlu': (250, 1030), 'tisort': (705, 1055), 'corapA': (118, 1236),
        'pantolon': (522, 1256), 'corapB': (990, 912), 'sepet': (835, 1660)}


def wake(A, t, look=None):
    A.k(t, eo=0.0); A.k(t + 0.25, 'O', eo=1.0, brow=0.9)
    if look is not None:
        A.k(t + 0.25, lx=look[0], ly=look[1])


def build():
    acts = {}
    for n, (x, y) in BASE.items():
        acts[n] = Actor(n, x=x, y=y, ride=0.0 if n in ('corapB', 'sepet') else 1.0, eo=0.0, mc=0.0)
    G, T, CA, CB, H, P, SP = (acts[k] for k in ('gomlek', 'tisort', 'corapA', 'corapB', 'havlu', 'pantolon', 'sepet'))
    # başlangıç: cansız gibi, hafif yığılmış
    G.k(0, tilt=-22, sy=0.52, sx=1.15, y=925, eo=0.0, mc=0.0, lax=-14, lay=66)
    H.k(0, tilt=-10); T.k(0, tilt=-18); P.k(0, tilt=6); CA.k(0, tilt=8); CB.k(0, tilt=-6); SP.k(0, tilt=0)
    # S1 — GÖMLEK AYAĞA KALKAR
    G.k(2.45, eo=0.0); G.k(2.65, 'O', eo=1.0, brow=1.0, bang=0.2)
    G.k(2.9, tilt=-22, sy=0.52, sx=1.15, y=925); G.k(3.3, 'O', tilt=0, sy=1.0, sx=1.0, y=900); G.hop(2.9, 3.3, 60)
    G.k(3.3, bang=1.1, brow=0.1, mc=-0.6, lx=0.0, ly=0.0, flail=0.0)
    G.k(3.6, flail=1.0, lax=-46, lay=-70, rax=46, ray=-70)
    G.k(5.6, lax=-20, lay=-20, rax=70, ray=-40)   # kendini gösterir
    G.k(6.4, lax=40, lay=0, rax=-40, ray=0, flail=0.5)
    G.k(7.6, flail=0.0, bang=0.9, mc=-0.5, lx=0.8, ly=0.2, lax=-14, lay=66, rax=14, ray=66)
    for a, tw, lk in ((H, 3.7, (0.8, -0.4)), (T, 3.9, (-1.0, -0.4)), (P, 4.0, (-0.6, -0.6)), (CA, 4.1, (0.4, -0.8)),
                      (CB, 4.3, (-1.0, 0.0)), (SP, 4.4, (-1.0, -0.6))):
        wake(a, tw, lk)
        a.k(tw + 0.3, tilt=0)
        a.k(tw + 0.9, brow=0.2, mc=0.0)
    # Tişört
    T.k(7.6, tilt=-14, lid=0.42, mc=0.55, lx=-1.0, ly=-0.3, bang=0.0)
    T.k(8.0, rax=40, ray=-20, lax=-30, lay=20)
    T.k(10.2, rax=-56, ray=-62, mc=-0.5, lid=0.2, brow=0.6, bang=-0.4)   # omzundaki çorabı gösterir
    T.k(11.8, rax=14, ray=66, mc=0.4, lid=0.42, brow=0.0, bang=0.0)
    G.k(10.0, mc=-0.7, bang=1.2, lx=0.9)
    # S2 — ÇORAPLAR
    CA.k(12.6, bang=-0.9, brow=0.9, mc=-0.6, lx=-1.0, ly=0.0, bounce=0.4, lax=30, lay=-10, rax=-30, ray=-10)
    CA.k(13.2, lx=1.0); CA.k(13.7, lx=-0.6)
    CA.k(14.0, lx=1.0, ly=-0.4, bounce=0.0)
    CB.k(13.9, lid=0.3, mc=0.75, tilt=8, lx=-1.0, ly=0.2, bang=0.3, rax=30, ray=-60)
    CB.k(15.2, rax=-10, ray=-30, flail=0.4)
    CB.k(17.0, flail=0.0)
    CA.k(17.3, bang=1.0, brow=0.0, mc=-0.7, lax=30, lay=20, rax=-30, ray=20, tilt=-6, trem=0.6)
    CA.k(18.1, trem=0.2)
    CB.k(18.2, lid=0.35, mc=0.9, tilt=10, brow=0.7, bang=-0.2, rax=40, ray=-40)
    CB.k(19.8, tilt=4, mc=0.6)
    # S3 — BÜYÜK KAVGA
    P.k(19.6, ly=-0.7, lx=-0.2, lid=0.35, mc=0.45, bang=0.2, brow=0.5, tilt=-3, lax=20, lay=10, rax=-20, ray=10)
    P.k(21.8, ly=-0.9, tilt=-6, rax=40, ray=-40)
    P.k(23.4, ly=0.0, lx=-1.0, eo=1.0, lid=0.0, brow=1.0, mc=-0.4, tilt=0)   # Havlu'ya şaşkın
    H.k(23.2, bang=1.2, brow=-0.2, lid=0.55, mc=-0.7, lx=1.0, ly=0.2, rax=60, ray=-30, tilt=6, trem=0.5)
    H.k(26.0, rax=40, ray=-50, lax=-40, lay=-40, flail=0.6)
    H.k(28.3, flail=0.0, trem=0.2)
    for a in (G, T, CA, P, H, SP, CB):
        a.k(28.2, flail=0.0, bounce=0.0)
        a.k(28.5, flail=1.0, bounce=0.7, bang=1.1, brow=0.0, mc=-0.6, lid=0.0, trem=0.6)
        a.k(32.55, flail=1.0, bounce=0.7)
    SP.k(28.5, flail=0.0, bounce=0.0, trem=0.0, bang=0.6, mc=-0.3, lx=-1.0, ly=-0.5)
    SP.k(32.55, flail=0.0, bounce=0.0)
    G.k(28.5, lx=0.5); T.k(28.5, lx=-0.8); P.k(28.5, lx=-1.0); H.k(28.5, lx=1.0); CA.k(28.5, lx=1.0); CB.k(28.5, lx=-1.0)
    # S4 — SEPET
    SP.k(32.6, legs=0.0, bang=0.6, mo=0.0); SP.k(33.0, 'O', legs=1.0); SP.hop(32.6, 33.0, 60)
    SP.k(32.9, bang=1.3, brow=0.0, mc=-0.8, lx=-1.0, ly=-0.7, lax=-50, lay=-80, rax=50, ray=-80)
    SP.k(35.4, lax=-14, lay=66, rax=-40, ray=-100, bang=1.0, flail=0.0)   # parmak sallama
    SP.k(36.0, flail=0.35)
    SP.k(38.7, lx=-0.4, ly=-0.6, mc=-0.5, bang=0.6, brow=0.4, flail=0.2)
    SP.k(41.0, rax=60, ray=-60, lax=-60, lay=-60, bang=1.0, flail=0.5)
    SP.k(43.6, flail=0.0, rax=14, ray=66, lax=-14, lay=66)
    for a in (G, T, CA, P, H, CB):
        a.k(32.75, 'H', flail=0.0, bounce=0.0, trem=0.0)
        a.k(32.8, 'O', eo=1.0, brow=1.0, bang=-0.3, mc=-0.4, lid=0.0, lax=-14, lay=66, rax=14, ray=66)
        a.k(33.0, lx=1.0, ly=0.5)
        a.k(36.5, ly=0.6, lx=0.7, brow=0.5, bang=-0.6, mc=-0.3, lid=0.15)
        a.k(43.6, ly=0.0)
    # S5 — AYAK SESLERİ
    for i, a in enumerate((G, T, CA, P, H, CB, SP)):
        a.k(43.9, lx=1.0, ly=-0.2, brow=1.0, bang=-0.4, mc=-0.2, eo=1.0, lid=0.0)
        a.k(44.1, 'O', mo=0.5); a.k(44.5, mo=0.0)
        a.k(46.3, mc=1.0, bounce=0.0, lax=-14, lay=66, rax=14, ray=66)
        a.k(46.6, 'O', bounce=1.0, lax=-40, lay=-90, rax=40, ray=-90, flail=0.5)
        a.k(48.5, bounce=0.6)
        a.k(49.5, bounce=0.0, flail=0.0, mc=0.3)
    for a in (G, T, CA, P, H):
        a.k(49.7, 'O', eo=1.0, brow=1.2, bang=-0.6, mc=-0.3, trem=0.6, lx=0.0, ly=-1.0)
        a.k(52.6, trem=0.6)
        a.k(53.1, 'O', trem=0.0, mc=-0.1, ly=0.0)
        a.k(55.0, lx=1.0, ly=0.0, mc=-0.2, lax=-14, lay=66, rax=14, ray=66)
        a.k(56.5, lx=-0.3); a.k(57.3, lx=0.5)
    for a in (CB, SP):
        a.k(49.7, eo=1.0, brow=1.0, mc=-0.2, lx=-1.0)
        a.k(51.5, lx=0.5); a.k(53.1, lx=-0.4)
        a.k(55.0, mc=-0.2, lax=-14, lay=66, rax=14, ray=66)
    SP.k(55.0, legs=1.0)
    # Gömlek kameraya
    G.k(57.9, lx=1.0, ly=0.0, lid=0.0, mc=-0.2, bang=0.0, x=400)
    G.k(58.3, x=445, sc=1.0); G.hop(57.95, 58.3, 30)
    G.k(58.25, 'O', lx=0.0, ly=0.0, lid=0.45, mc=-0.35, bang=0.35, brow=0.2)
    G.k(59.4, lid=0.5)
    return acts


# ---------------------------------------------------------------- yığın + insan
def pile_offset(t):
    dx = dy = rot = 0.0
    if 28.4 <= t < 32.6:
        dx += 3 * math.sin(t * 37); dy += 2 * math.sin(t * 29)
    if t >= 49.6:
        u = ease_io((t - 49.6) / 0.7)
        dy = -110 * u
    if t >= 50.3:
        u = ease_io((t - 50.3) / 2.3)
        dx = 260 * u
        dy = -110 - 30 * math.sin(math.pi * min(1, u))
        rot = 2.5 * math.sin(t * 6) * (1 - abs(2 * u - 1))
    if t >= 52.6:
        u = min(1.0, (t - 52.6) / 0.25)
        dx = 260
        dy = -110 * (1 - u * u)
        rot = 0
    if t >= 52.85:
        k = (t - 52.85)
        dy = -18 * math.exp(-k * 7) * abs(math.sin(k * 22))
    return dx, dy, rot


def hands(t):
    """İnsan elleri: (sol el x,y), (sağ el x,y), görünürlük. None = yok."""
    if t < 48.4 or t > 54.6:
        return None
    dx, dy, _ = pile_offset(t)
    L = (40 + dx, 1080 + dy); R = (790 + dx, 1080 + dy)
    if t < 49.6:
        u = ease_out((t - 48.4) / 1.2)
        L = (L[0] - 60 * (1 - u), -260 + (L[1] + 260) * u)
        R = (R[0] + 60 * (1 - u), -260 + (R[1] + 260) * u)
    if t > 53.2:
        u = ease_io((t - 53.2) / 1.4)
        L = (L[0] - 80 * u, L[1] + (-300 - L[1]) * u)
        R = (R[0] + 80 * u, R[1] + (-300 - R[1]) * u)
    grip = 1.0 if 49.5 <= t <= 53.2 else 0.0
    return L, R, grip


def human_shadow(t):
    a = 0.0
    if 44.0 <= t < 56.0:
        a = 0.38 * ease((t - 44.0) / 4.0) * (1 - ease((t - 54.5) / 1.5))
    return a


# ---------------------------------------------------------------- KAMERA
SHOTS = [
    (0.0, 2.8, (540, 1000, 1.0), (470, 1050, 1.22), 'S'),
    (2.8, 3.3, (470, 1050, 1.22), (420, 760, 2.3), 'I'),
    (3.3, 7.6, (420, 760, 2.3), (410, 770, 2.45), 'S'),
    (7.6, 7.95, (410, 770, 2.45), (700, 900, 2.3), 'I'),
    (7.95, 12.5, (700, 900, 2.3), (695, 905, 2.45), 'S'),
    (12.5, 12.8, (695, 905, 2.45), (215, 1090, 2.6), 'I'),
    (12.8, 13.95, (215, 1090, 2.6), (215, 1090, 2.7), 'S'),
    (13.95, 14.3, (215, 1090, 2.7), (872, 800, 2.6), 'I'),
    (14.3, 17.3, (872, 800, 2.6), (872, 805, 2.75), 'S'),
    (17.3, 18.2, (215, 1090, 2.8), (215, 1090, 2.9), 'S'),
    (18.2, 19.7, (872, 800, 2.75), (872, 805, 2.85), 'S'),
    (19.7, 20.0, (872, 805, 2.85), (522, 990, 2.3), 'I'),
    (20.0, 23.4, (522, 990, 2.3), (522, 985, 2.5), 'S'),
    (23.4, 23.65, (522, 985, 2.5), (270, 850, 2.3), 'I'),
    (23.65, 28.4, (270, 850, 2.3), (275, 845, 2.55), 'S'),
    (28.4, 28.8, (275, 845, 2.55), (520, 1060, 1.3), 'I'),
    (28.8, 32.65, (520, 1060, 1.3), (520, 1060, 1.36), 'S'),
    (32.65, 33.0, (520, 1060, 1.36), (835, 1385, 1.8), 'I'),
    (33.0, 40.5, (835, 1385, 1.8), (830, 1360, 2.2), 'S'),
    (40.5, 43.6, (830, 1360, 2.2), (540, 1080, 1.22), 'I'),
    (43.6, 48.4, (540, 1080, 1.22), (550, 1060, 1.15), 'S'),
    (48.4, 55.6, (550, 1060, 1.15), (650, 1040, 1.12), 'S'),
    (55.6, 58.1, (650, 1040, 1.12), (660, 1000, 1.3), 'S'),
    (58.1, 58.35, (660, 1000, 1.3), (712, 700, 3.0), 'I'),
    (58.35, 63.0, (712, 700, 3.0), (712, 705, 3.15), 'S'),
]
SHAKES = [(3.4, 4.0, 10, 30), (28.4, 32.6, 7, 23), (33.0, 33.5, 16, 30), (44.0, 44.3, 5, 30), (44.6, 44.9, 7, 30),
          (45.2, 45.5, 9, 30), (45.8, 46.2, 12, 30), (52.85, 53.3, 14, 30)]


def camera(t):
    cx, cy, z = 540, 960, 1.0
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
    dx += 2.0 * math.sin(t * 0.9) / z
    dy += 1.5 * math.sin(t * 1.3 + 2) / z
    hw, hh = 540 / z, 960 / z
    return min(max(cx + dx, hw), 1080 - hw), min(max(cy + dy, hh), 1920 - hh), z


def blink(t, seed):
    period = 2.9 + (seed % 7) * 0.31
    ph = (t + seed * 0.71) % period
    return abs(ph - 0.065) / 0.065 if ph < 0.13 else 1.0


def state_of(act, t):
    s = {k: tr.at(t) for k, tr in act.tr.items()}
    sxe = sye = 1.0
    yoff = 0.0
    for t0, t1, h in act.hops:
        if t0 - 0.12 <= t < t0:
            u = (t - (t0 - 0.12)) / 0.12; sye *= 1 - 0.12 * ease(u); sxe *= 1 + 0.08 * ease(u)
        elif t0 <= t < t1:
            u = (t - t0) / (t1 - t0); yoff -= h * 4 * u * (1 - u); sye *= 1 + 0.08 * math.sin(math.pi * u)
        elif t1 <= t < t1 + 0.22:
            u = (t - t1) / 0.22; k = math.sin(math.pi * u) * (1 - u); sye *= 1 - 0.15 * k; sxe *= 1 + 0.1 * k
    seed = sum(ord(c) for c in act.name)
    if s['bounce'] > 0.01:
        ph = t * 2 * math.pi * (2.4 + (seed % 5) * 0.15) + seed
        yoff -= s['bounce'] * 22 * abs(math.sin(ph))
        sye *= 1 + s['bounce'] * 0.05 * math.sin(2 * ph)
    if s['flail'] > 0.01:
        f = s['flail']
        s['lax'] += 30 * f * math.sin(t * 13 + seed); s['lay'] += 40 * f * math.sin(t * 11 + seed * 2)
        s['rax'] += 30 * f * math.sin(t * 12 + seed * 3); s['ray'] += 40 * f * math.sin(t * 14 + seed)
        s['tilt'] += 4 * f * math.sin(t * 7 + seed)
    if s['trem'] > 0.01:
        s['x'] += s['trem'] * 2.5 * math.sin(t * 61 + seed)
        s['tilt'] += s['trem'] * 1.2 * math.sin(t * 47 + seed)
    br = math.sin(2 * math.pi * t / 3.0 + seed)
    sye *= 1 + 0.011 * br; sxe *= 1 - 0.007 * br
    sp = speech(act.name, t)
    sye *= 1 + 0.03 * sp; sxe *= 1 - 0.015 * sp
    if sp > 0.05:
        s['tilt'] += 1.5 * sp * math.sin(t * 9 + seed)
    # yığın üzerindekiler yığınla taşınır
    if s['ride'] > 0.5:
        pdx, pdy, rot = pile_offset(t)
        s['x'] += pdx; yoff += pdy; s['tilt'] += rot * 2
    if s['legs'] > 0.001:
        yoff -= 70 * s['legs']
    eo = s['eo'] * (blink(t, seed) if s['eo'] > 0.5 else 1.0)
    st = dict(eo=eo, lx=s['lx'], ly=s['ly'], brow=s['brow'] + 0.3 * sp, bang=s['bang'], mo=max(s['mo'], sp), mc=s['mc'],
              tear=s['tear'], drop=-1.0, blush=s['blush'], lid=(None if s['lid'] < 0 else s['lid']),
              lax=s['lax'], lay=s['lay'], rax=s['rax'], ray=s['ray'], bend=s['bend'], prop=None, talk=t)
    return dict(name=act.name, x=s['x'], y=s['y'] + yoff, ground=s['y'], sc=s['sc'], tilt=s['tilt'], sx=s['sx'] * sxe,
                sy=s['sy'] * sye, dark=s['dark'], alpha=s['alpha'], legs=s['legs'], expr=st, speech=sp)
