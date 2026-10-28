"""Yönetmenlik: aktör anahtar kareleri, kamera planları, ışık notaları, konuşma zarfları."""
import math, wave, os
import numpy as np
from style import ease, ease_io, ease_out
from timing import *

HERE = os.path.dirname(os.path.abspath(__file__))
LINES_DIR = os.path.join(HERE, '..', 'audio', 'lines')


def _ez(mode, u):
    if mode == 'L':
        return u
    if mode == 'O':
        return ease_out(u)
    if mode == 'I':
        return ease_io(u)
    return ease(u)


class Track:
    def __init__(self, default):
        self.keys = []
        self.default = default

    def add(self, t, v, mode='S'):
        self.keys.append((t, v, mode))
        self.keys.sort(key=lambda k: k[0])

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


PARAMS = dict(x=540, y=1450, sc=1.0, tilt=0.0, dark=1.0, alpha=1.0, sil=0.0, clip=9999.0, eo=1.0, lx=0.0, ly=0.0,
              brow=0.0, bang=0.0, mo=0.0, mc=0.25, tear=0.0, drop=-1.0, blush=0.35, lid=-1.0, lax=-14, lay=66,
              rax=14, ray=66, bend=1.0, trem=0.0, glow=0.0, sx=1.0, sy=1.0)


class Actor:
    def __init__(self, name, **init):
        self.name = name
        self.tr = {k: Track(init.get(k, v)) for k, v in PARAMS.items()}
        self.disc = {}   # ad -> [(t, değer)]
        self.hops = []   # (t0, t1, yükseklik)
        self.speech = []  # (konuşma zarfı fonksiyonu)

    def k(self, t, ease='S', **kw):
        for p, v in kw.items():
            self.tr[p].add(t, v, ease)
        return self

    def d(self, t, **kw):
        for p, v in kw.items():
            self.disc.setdefault(p, []).append((t, v))
            self.disc[p].sort(key=lambda a: a[0])
        return self

    def dv(self, p, t, default=None):
        v = default
        for tt, val in self.disc.get(p, []):
            if t >= tt:
                v = val
        return v

    def hop(self, t0, t1, h):
        self.hops.append((t0, t1, h))
        return self


# ---------------------------------------------------------------- konuşma zarfları
_env = {}


def _load_env():
    if _env:
        return
    for code, who, t0 in LINES:
        p = os.path.join(LINES_DIR, code + '.wav')
        with wave.open(p) as w:
            sr = w.getframerate()
            x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
        hop = sr // 120
        n = len(x) // hop
        rms = np.sqrt(np.mean(x[:n * hop].reshape(n, hop) ** 2, axis=1))
        ref = np.percentile(rms, 92) + 1e-6
        e = np.clip(rms / ref, 0, 1.15)
        e = np.convolve(e, np.ones(3) / 3, mode='same')
        _env[code] = (who, t0, e, 120.0, len(x) / sr)


def speech(who, t):
    """Konuşan karakterin ağız açıklığı (0..1)."""
    _load_env()
    best = 0.0
    for code, (w, t0, e, rate, dur) in _env.items():
        if w != who or t < t0 or t > t0 + dur:
            continue
        i = (t - t0) * rate
        i0 = int(i)
        if i0 + 1 >= len(e):
            continue
        v = e[i0] * (1 - (i - i0)) + e[i0 + 1] * (i - i0)
        best = max(best, float(v))
    return min(1.0, best ** 0.85 * 0.95)


def speech_spans():
    """(kod, konuşan, başlangıç, bitiş) - gerçek konuşma aralığı."""
    _load_env()
    out = []
    for code, who, t0 in LINES:
        w, _, e, rate, dur = _env[code]
        idx = np.where(e > 0.12)[0]
        a = t0 + (idx[0] / rate if len(idx) else 0) - 0.06
        b = t0 + (idx[-1] / rate if len(idx) else dur) + 0.35
        out.append((code, who, a, b))
    return out


# ---------------------------------------------------------------- AKTÖRLER
def build_actors():
    A = {}
    # ---------------- RÜYA
    R = Actor('ruya', x=190, y=1582, clip=1132)
    R.d(0, layer='behind').d(6.4, layer='front')
    R.k(0, eo=0.1, ly=0.8, lx=0.0, mc=0.1, blush=0.2, brow=0, bang=0)
    R.k(3.4, y=1582, eo=0.1)
    R.k(4.5, 'O', y=1126, eo=1.0)
    R.k(4.4, ly=0.4, lx=0.0)
    R.k(4.75, lx=-1.0, ly=-0.2, brow=0.4, bang=-0.5)
    R.k(5.05, lx=1.0, ly=0.0)
    R.k(5.35, lx=0.2, ly=0.5, mc=-0.2, bang=-0.8, brow=0.6)
    R.k(6.2, lx=0.4, ly=0.0)
    R.k(6.4, 'H', clip=9999.0)
    R.k(6.3, clip=1132.0)
    R.k(6.4, x=190); R.k(7.05, x=300)
    R.k(6.4, 'L', y=1126); R.k(7.05, 'L', y=1452)
    R.hop(6.4, 7.05, 190)
    R.k(7.3, lx=0.9, ly=-0.1, brow=0.3, bang=-0.3)
    R.k(7.55, brow=0.95, bang=-0.3, eo=1.0, mc=0.35, blush=0.4)
    R.k(8.7, mc=0.95, blush=0.95, brow=0.35, bang=-0.2, lx=0.85)
    R.k(7.3, tilt=0); R.k(8.5, tilt=3.5)
    # S2
    R.k(11.0, tilt=3.5, mc=0.9)
    R.k(12.8, mc=-0.05, bang=-0.9, brow=0.7, ly=0.4, lx=0.4, tilt=1.0, blush=0.5)
    R.k(12.8, lax=14, lay=66, rax=-14, ray=66)
    R.k(13.5, lax=40, lay=-6, rax=-40, ray=-6, bend=1.3)
    R.k(15.0, tear=0.35)
    R.k(16.6, ly=0.3, lx=0.5, tear=0.35)
    R.k(17.2, ly=-0.25, lx=0.9, bang=-0.45, brow=0.45, mc=0.3, blush=0.85, tear=0.5)
    R.k(20.5, lax=40, lay=-6, rax=-40, ray=-6, tilt=1.5)
    R.k(21.0, x=300); R.k(26.3, x=345)
    R.k(21.0, tilt=1.5); R.k(26.3, tilt=5.0)
    R.k(22.5, lax=-14, lay=66, rax=20, ray=-4, bend=1.0)
    R.k(26.0, rax=38, ray=-30, lx=0.95, ly=-0.15, mc=0.55, eo=0.85, blush=1.0, tear=0.35)
    # clank
    R.k(26.45, 'O', eo=1.0, brow=1.0, bang=-0.5, lx=1.0, ly=-0.1, mc=-0.3, blush=0.3)
    R.k(26.45, x=345); R.k(26.9, x=332)
    R.k(26.45, tilt=5.0); R.k(26.9, tilt=-1.0)
    R.k(26.7, rax=-30, ray=22, lax=30, lay=22)
    R.k(28.0, lx=0.6, ly=0.0, tilt=0)
    R.k(33.0, lx=0.9)
    R.k(41.5, alpha=1.0); R.k(41.55, 'H', alpha=0.0); R.k(64.9, 'H', alpha=1.0)
    # S5 : tek başına
    R.k(65.0, x=470, y=1468, tilt=0, mc=-0.25, eo=0.85, brow=0.2, bang=-0.5, lx=0.5, ly=0.6, tear=0.0, blush=0.15,
        lax=-14, lay=66, rax=14, ray=66, drop=-1.0)
    R.k(65.0, 'H', x=470, y=1468, tilt=0, mc=-0.25, eo=0.85, brow=0.2, bang=-0.5, lx=0.5, ly=0.6, tear=0.0, blush=0.15,
        lax=-14, lay=66, rax=14, ray=66)
    R.k(66.8, lx=-0.5, ly=0.5)
    R.k(67.3, lx=-0.2, ly=0.2, eo=1.0)
    R.k(67.9, lx=1.0, ly=0.5, brow=0.9, bang=-0.5)
    R.k(68.8, lx=1.0, ly=0.55, brow=1.0, bang=-0.7, mc=-0.5, eo=1.0)
    R.k(69.6, lax=36, lay=-32, bend=1.3)
    R.k(70.0, mc=-0.85, bang=-1.0, brow=0.8, tear=0.2, lx=0.3, ly=0.35)
    R.k(72.2, tear=1.0, mc=-0.95, bang=-1.1, lx=0.0, ly=0.1, eo=0.9)
    R.k(73.0, drop=0.0)
    R.k(75.2, 'L', drop=0.999)
    R.k(75.3, 'H', drop=-1.0)
    R.k(76.0, tear=0.85, mc=-0.8, ly=-0.1, lx=0.0)
    R.k(79.0, bang=-0.8, brow=1.0, eo=1.0, ly=-0.55, mc=-0.5)
    R.k(79.0, 'S', tear=0.9)
    R.k(80.8, ly=-0.7, brow=1.0, tear=1.0)
    A['ruya'] = R

    # ---------------- ARAS
    Ar = Actor('aras', x=735, y=1425, dark=0.1)
    Ar.d(0, layer='front')
    Ar.k(0, lx=-0.8, eo=0.9, mc=0.15, lid=0.15, bang=-0.1, brow=0.0, blush=0.0)
    Ar.k(7.3, x=735, y=1425, tilt=0)
    Ar.k(9.7, 'I', x=520, y=1458)
    Ar.k(7.6, dark=0.1); Ar.k(9.4, 'I', dark=1.0)
    Ar.hop(7.5, 9.7, 0)
    Ar.k(7.6, mc=0.55, brow=0.0, lid=0.18)
    Ar.k(9.0, mc=0.6, brow=0.2, bang=-0.2, lid=0.15)
    Ar.k(9.7, tilt=-3.0)
    Ar.k(12.8, bang=-0.35, brow=0.3, mc=0.1, lx=-0.8, ly=0.1)
    Ar.k(15.5, bang=-0.5, brow=0.5, mc=0.0)
    Ar.k(17.0, bang=-0.2, brow=0.3, mc=0.45, ly=0.0, tilt=-3.0)
    Ar.k(19.5, lax=-14, lay=66)
    Ar.k(20.6, lax=-40, lay=-18, bend=1.2)
    Ar.k(21.0, x=520); Ar.k(26.3, x=515)
    Ar.k(21.0, tilt=-3); Ar.k(26.3, tilt=-5.0)
    Ar.k(26.0, mc=0.6, lax=-54, lay=-34, lx=-0.9, ly=-0.1, eo=0.9)
    Ar.k(26.45, 'O', eo=1.0, bang=0.5, brow=0.5, lx=1.0, ly=0.0, mc=-0.1, lax=-14, lay=40)
    Ar.k(26.45, x=515); Ar.k(26.9, x=530)
    Ar.k(26.9, tilt=-5); Ar.k(27.0, tilt=3.0)
    Ar.k(28.0, lx=0.4, bang=0.3)
    Ar.k(41.5, alpha=1.0); Ar.k(41.55, 'H', alpha=0.0)
    A['aras'] = Ar

    # ---------------- LALİN (S3-S4)
    L = Actor('lalin', x=748, y=1445, alpha=0.0)
    L.d(0, layer='behind').d(41.9, layer='front')
    L.k(27.4, alpha=0.0); L.k(27.6, 'H', alpha=1.0)
    L.k(0, lid=0.28, lx=-1.0, eo=1.0)
    L.k(28.0, x=748, y=1445, mc=0.0, bang=0.2, brow=0.5, lid=0.2, eo=1.0, lx=-1.0, ly=0.0)
    L.k(29.7, x=715, mc=-0.5, bang=0.9, brow=0.1, lid=0.4, tilt=-3)
    L.k(30.9, mc=-0.75, bang=1.1, lid=0.5, trem=1.0, tilt=-5)
    L.k(33.4, trem=1.0, bang=1.1)
    L.k(33.6, 'O', rax=-44, ray=-72, lax=26, lay=24, tilt=-4, trem=0.4)
    L.d(33.5, prop='mert', prop_ang=-12)
    L.d(33.3, layer='front')
    L.k(34.8, mc=0.1, bang=0.9, lid=0.45, lx=-0.3, ly=0.5)
    L.k(37.0, mc=0.55, bang=0.8, lid=0.42, ly=0.6, lx=0.0, trem=0.1)
    L.k(40.0, mc=0.7, ly=0.0, lx=0.0, tilt=0)
    L.k(41.85, x=715)
    # S4
    L.k(41.9, 'H', x=745, y=1462, tilt=0, trem=0.0, mc=0.5, bang=0.5, lid=0.38, eo=0.9, lx=-0.8, ly=0.0, rax=-52, ray=-40, lax=-14, lay=66, brow=0.1)
    L.d(41.9, prop='sent', prop_ang=-10)
    L.k(47.5, mc=0.45)
    L.k(48.6, mc=0.2, bang=0.9, lid=0.5, brow=0.0, lx=-0.7)
    L.k(49.2, x=745); L.k(50.4, x=712)
    L.k(50.6, mc=0.8, bang=0.7)
    L.k(51.5, rax=-10, ray=62)
    L.k(58.4, mc=0.8, lid=0.4)
    L.k(59.2, 'O', mc=1.0, bang=0.9, lid=0.5)
    L.k(62.0, lx=-0.4)
    L.k(64.7, mc=1.0)
    L.k(64.9, 'H', alpha=0.0)
    A['lalin'] = L

    # ---------------- MERT (S4)
    M = Actor('mert', x=420, y=1452, alpha=0.0, glow=0.0)
    M.d(0, layer='front')
    M.k(0, alpha=0.0); M.k(41.9, 'H', alpha=1.0)
    M.k(0, eo=0.0)
    M.k(41.9, 'H', eo=0.0, glow=0.0)
    M.k(42.55, 'O', eo=1.0, glow=1.0)
    M.k(42.55, mc=0.1, ly=0.5, lx=0.0, brow=0, bang=0)
    M.k(44.3, ly=0.8, bang=-0.2, brow=0.4)
    M.k(45.7, lx=1.0, ly=0.0, bang=0.5, brow=0.0, mc=0.0)
    M.k(48.4, lx=1.0, bang=0.4, mc=-0.1)
    M.k(50.2, lx=0.4, ly=0.7, bang=0.15, mc=0.3)
    M.k(52.0, ly=0.9, mc=0.6, bang=0.5)
    M.k(53.3, rax=-58, ray=-34, bend=1.2)
    M.k(55.5, rax=-58, ray=-34)
    M.k(56.4, rax=14, ray=66)
    M.k(58.45, eo=1.0, bang=0.0, brow=0.9, mc=-0.1, ly=0.8)
    M.k(59.4, bang=0.7, brow=0.0, mc=0.95, ly=0.2)
    M.k(62.2, lx=1.0, ly=0.0, mc=1.0, bang=0.8)
    M.k(64.8, mc=1.0)
    M.k(64.9, 'H', alpha=0.0)
    A['mert'] = M

    # ---------------- LALİN siluet (ayna, S5)
    S = Actor('lalin_m', x=700, y=1124, sc=0.8, alpha=0.0, sil=1.0)
    S.k(76.8, alpha=0.0); S.k(77.4, alpha=0.5); S.k(77.55, alpha=0.1); S.k(77.9, alpha=0.8); S.k(78.4, alpha=1.0)
    S.k(76.8, sc=0.78); S.k(80.9, sc=0.98)
    S.k(76.8, x=724); S.k(79.0, x=698)
    S.k(0, lid=0.45, bang=1.0, eo=1.0, lx=-0.4, ly=0.0, mc=0.2)
    S.k(78.4, lid=0.5, bang=1.0, lx=-0.5)
    S.k(80.9, lid=0.55)
    A['lalin_m'] = S
    return A


# ---------------------------------------------------------------- ANLIK DURUM
def blink(t, seed):
    # küçük, düzensiz göz kırpmalar
    period = 3.1 + (seed % 5) * 0.37
    ph = (t + seed * 0.83) % period
    if ph < 0.13:
        return abs(ph - 0.065) / 0.065
    return 1.0


def mert_screen_state(t):
    if t < 43.1:
        return dict(mode='idle')
    if t < 54.0:
        return dict(mode='photo', k=0.0, big=False, pop=min(1.0, (t - 43.1) / 0.5))
    if t < 58.5:
        return dict(mode='photo', k=min(1.0, (t - 54.0) / 3.0), big=True)
    k = 1 - ease((t - 58.5) / 0.45)
    return dict(mode='msg', k=k, big=True, k2=min(1.0, max(0.0, (t - 58.7) / 0.5)))


def state_of(act, t):
    s = {k: tr.at(t) for k, tr in act.tr.items()}
    s['layer'] = act.dv('layer', t, 'front')
    s['prop'] = act.dv('prop', t, None)
    s['prop_ang'] = act.dv('prop_ang', t, -10)
    # zıplama yayları (squash/stretch)
    sy_extra, sx_extra, yoff = 1.0, 1.0, 0.0
    for t0, t1, h in act.hops:
        if t0 - 0.16 <= t < t0:
            u = (t - (t0 - 0.16)) / 0.16
            sy_extra *= 1 - 0.10 * ease(u); sx_extra *= 1 + 0.07 * ease(u)
        elif t0 <= t < t1:
            u = (t - t0) / (t1 - t0)
            yoff -= h * 4 * u * (1 - u)
            sy_extra *= 1 + 0.07 * math.sin(math.pi * u); sx_extra *= 1 - 0.04 * math.sin(math.pi * u)
        elif t1 <= t < t1 + 0.22:
            u = (t - t1) / 0.22
            k = math.sin(math.pi * u) * (1 - u)
            sy_extra *= 1 - 0.13 * k; sx_extra *= 1 + 0.09 * k
    # yürüme sekmesi: hıza bağlı
    dt = 1 / 30
    vx = (act.tr['x'].at(t + dt) - act.tr['x'].at(t - dt)) / (2 * dt)
    sp = min(1.0, abs(vx) / 140)
    if sp > 0.05:
        ph = t * 2 * math.pi * 2.6
        yoff -= sp * 9 * abs(math.sin(ph))
        s['tilt'] += sp * 2.4 * math.sin(ph)
        sy_extra *= 1 + sp * 0.025 * math.sin(2 * ph); sx_extra *= 1 - sp * 0.02 * math.sin(2 * ph)
    # nefes
    br = math.sin(2 * math.pi * t / 3.2 + (len(act.name) * 1.7))
    sy_extra *= 1 + 0.010 * br; sx_extra *= 1 - 0.006 * br
    # titreme
    if s['trem'] > 0.01:
        s['x'] += s['trem'] * 2.2 * math.sin(t * 61.0) * math.sin(t * 7.0 + 1)
        s['tilt'] += s['trem'] * 0.9 * math.sin(t * 47.0)
    # konuşma
    who = {'ruya': 'ruya', 'aras': 'aras', 'lalin': 'lalin', 'mert': 'mert', 'lalin_m': 'lalin'}[act.name]
    sp_env = speech(who, t)
    mo = max(s['mo'], sp_env)
    sy_extra *= 1 + 0.022 * sp_env; sx_extra *= 1 - 0.012 * sp_env
    # göz kırpma (konuşma ve kapalı gözlerde değil)
    seed = sum(ord(c) for c in act.name)
    eo = s['eo'] * (blink(t, seed) if s['eo'] > 0.5 else 1.0)
    st = dict(eo=eo, lx=s['lx'], ly=s['ly'], brow=s['brow'] + 0.25 * sp_env, bang=s['bang'], mo=mo, mc=s['mc'],
              tear=s['tear'], drop=s['drop'], blush=s['blush'], lid=(None if s['lid'] < 0 else s['lid']),
              lax=s['lax'], lay=s['lay'], rax=s['rax'], ray=s['ray'], bend=s['bend'], prop=s['prop'],
              prop_ang=s['prop_ang'], talk=t, glow=s['glow'])
    if act.name == 'mert':
        st['screen'] = mert_screen_state(t)
    if who == 'lalin' and act.name == 'lalin_m':
        st['mo'] = 0.0
    return dict(name=act.name, x=s['x'], y=s['y'] + yoff, sc=s['sc'], tilt=s['tilt'], sx=s['sx'] * sx_extra,
                sy=s['sy'] * sy_extra, dark=s['dark'], alpha=s['alpha'], sil=s['sil'], clip=s['clip'],
                layer=s['layer'], expr=st, speech=sp_env)


# ---------------------------------------------------------------- KAMERA
SHOTS = [
    # t0, t1, (cx,cy,z) başla, (cx,cy,z) bitir, yumuşatma
    (0.0, 3.0, (540, 960, 1.0), (540, 990, 1.07), 'S'),
    (3.0, 5.4, (540, 990, 1.07), (290, 985, 1.75), 'I'),
    (5.4, 7.3, (290, 985, 1.75), (340, 1215, 1.7), 'S'),
    (7.3, 10.0, (340, 1215, 1.7), (420, 1235, 1.45), 'S'),
    (10.0, 26.3, (430, 1245, 1.45), (432, 1190, 2.35), 'S'),
    (26.3, 28.0, (432, 1190, 2.35), (745, 1250, 1.6), 'I'),
    (28.0, 31.0, (742, 1285, 2.05), (738, 1262, 2.3), 'S'),
    (31.0, 36.5, (738, 1262, 2.3), (738, 1290, 2.8), 'S'),
    (36.5, 41.8, (738, 1290, 2.8), (808, 1212, 3.3), 'I'),
    (42.0, 46.0, (575, 1290, 1.55), (562, 1278, 1.72), 'S'),
    (46.0, 53.0, (562, 1278, 1.72), (555, 1272, 1.9), 'S'),
    (53.0, 58.0, (555, 1272, 1.9), (430, 1322, 3.4), 'I'),
    (58.0, 62.0, (430, 1322, 3.4), (430, 1300, 3.0), 'S'),
    (62.0, 64.8, (430, 1300, 3.0), (548, 1285, 1.7), 'I'),
    (65.0, 70.0, (500, 1250, 1.2), (490, 1230, 1.36), 'S'),
    (70.0, 74.0, (490, 1230, 1.36), (470, 1175, 2.2), 'I'),
    (74.0, 79.5, (470, 1175, 2.2), (560, 905, 2.6), 'I'),
    (79.5, 85.0, (560, 905, 2.6), (640, 905, 3.0), 'S'),
]
SHAKES = [(26.42, 27.1, 16.0, 31.0), (67.3, 67.7, 3.0, 40.0), (67.95, 68.35, 3.0, 40.0), (77.0, 77.9, 4.5, 28.0),
          (80.85, 81.3, 11.0, 33.0)]
HEART = [74.0 + i * (1.05 - i * 0.012) for i in range(0, 8)]


def camera(t):
    cx, cy, z = 540, 960, 1.0
    for t0, t1, a, b, mode in SHOTS:
        if t0 <= t <= t1:
            u = (t - t0) / (t1 - t0)
            e = {'S': ease, 'I': ease_io, 'L': lambda v: v}[mode](u)
            cx = a[0] + (b[0] - a[0]) * e
            cy = a[1] + (b[1] - a[1]) * e
            z = a[2] + (b[2] - a[2]) * e
            break
    else:
        # boşluk (kesme anları): son plan
        best = None
        for sh in SHOTS:
            if sh[0] <= t:
                best = sh
        if best:
            cx, cy, z = best[3]
    dx = dy = 0.0
    for t0, t1, amp, fr in SHAKES:
        if t0 <= t <= t1:
            k = (1 - (t - t0) / (t1 - t0)) ** 1.5
            dx += amp * k * math.sin(t * fr * 2.1) / z
            dy += amp * k * math.sin(t * fr * 1.7 + 1) / z
    # hafif el kamerası
    dx += 2.6 * math.sin(t * 0.9) / z
    dy += 2.0 * math.sin(t * 1.3 + 2) / z
    for h in HEART:
        if h <= t < h + 0.4:
            u = (t - h) / 0.4
            z *= 1 + 0.012 * math.sin(math.pi * u) ** 2
    # dünya sınırları
    hw, hh = 540 / z, 960 / z
    cx = min(max(cx + dx, hw), 1080 - hw)
    cy = min(max(cy + dy, hh), 1920 - hh)
    return cx, cy, z


# ---------------------------------------------------------------- IŞIK NOTALARI
GRADE = [
    # t, çarpan(r,g,b), soğukluk, vinyet, bordo kaldırma
    (0.0, (0.10, 0.09, 0.10), 0.0, 0.35, 0.0),
    (1.2, (0.20, 0.18, 0.19), 0.0, 0.35, 0.05),
    (3.4, (1.0, 0.93, 0.84), 0.0, 0.30, 0.10),
    (26.0, (1.0, 0.93, 0.84), 0.0, 0.32, 0.10),
    (27.4, (0.86, 0.88, 1.0), 0.3, 0.40, 0.14),
    (28.6, (0.72, 0.80, 1.0), 0.65, 0.45, 0.16),
    (41.8, (0.70, 0.78, 1.0), 0.7, 0.48, 0.16),
    (42.2, (0.63, 0.72, 1.0), 0.85, 0.50, 0.18),
    (64.8, (0.63, 0.72, 1.0), 0.85, 0.50, 0.18),
    (65.0, (0.52, 0.60, 0.95), 1.0, 0.58, 0.20),
    (78.0, (0.44, 0.52, 0.9), 1.0, 0.65, 0.22),
    (81.6, (0.40, 0.46, 0.85), 1.0, 0.7, 0.22),
    (82.4, (0.0, 0.0, 0.0), 1.0, 0.7, 0.0),
]


def grade(t):
    ks = GRADE
    if t <= ks[0][0]:
        g = ks[0]
        return g[1], g[2], g[3], g[4]
    for i in range(1, len(ks)):
        if t < ks[i][0]:
            a, b = ks[i - 1], ks[i]
            u = ease((t - a[0]) / (b[0] - a[0]))
            m = tuple(a[1][j] + (b[1][j] - a[1][j]) * u for j in range(3))
            return m, a[2] + (b[2] - a[2]) * u, a[3] + (b[3] - a[3]) * u, a[4] + (b[4] - a[4]) * u
    g = ks[-1]
    return g[1], g[2], g[3], g[4]


_bulb_rng = np.random.RandomState(4)
N_BULBS = 25
BULB_ON = {i: 1.28 + 0.065 * k + _bulb_rng.rand() * 0.05 for k, i in enumerate(_bulb_rng.permutation(N_BULBS))}


def bulb_levels(t):
    out = np.zeros(N_BULBS, np.float32)
    for i in range(N_BULBS):
        t0 = BULB_ON[i]
        if t < t0:
            continue
        v = 1.0
        u = t - t0
        if u < 0.45:
            v = 0.0 if (int(u * 38 + i) % 3 == 0) else 1.0 if u > 0.18 else 0.55
            v *= min(1, 0.5 + u * 3)
        if 77.0 <= t < 79.0:
            v *= 0.25 + 0.75 * (1 if math.sin(t * 61 + i * 3.7) > -0.3 else 0.0)
        if 26.4 <= t < 26.75:
            v *= 0.55
        if t >= 82.0:
            fade = max(0.0, 1 - (t - 82.0) / 0.25)
            v *= fade if int((t - 82) * 30 + i) % 4 else fade * 0.3
        out[i] = v
    return out


def subtitle_at(t):
    out = None
    for code, who, a, b in speech_spans():
        if a - 0.05 <= t <= b:
            out = (who, TEXT[code])
    return out
