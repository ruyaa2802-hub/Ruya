"""Tuhaf oranlı el çizimi insan figürü + dev yük. Yerel koordinatlar: (0,0) ayak hizası, yukarı negatif.
Figür sağa bakar (facing=+1)."""
import math
from pencil import hexc

INK = '#262838'

MAIN = dict(head='#e6d6c2', cheek='#d9a39a', coat='#c48a86', coat_dk='#9e6668', legs='#2b3350', hand='#e2cdb6',
            burden='#232a45', burden_rim='#4f7f86', strap='#6b4b39', hair='#3b3036')
FRIEND_A = dict(head='#e6d6c2', cheek='#d9a39a', coat='#6e9e9b', coat_dk='#4d7774', legs='#2f3448', hand='#e2cdb6',
                hat='#2d3b55')
FRIEND_B = dict(head='#e9d9c4', cheek='#dba28f', coat='#d29a68', coat_dk='#a8714a', legs='#2f3448', hand='#e2cdb6',
                hat='#7d5b6a')


def ik(sx, sy, tx, ty, l1, l2, bend=1):
    dx, dy = tx - sx, ty - sy
    d = max(1e-3, min(math.hypot(dx, dy), l1 + l2 - 1e-3))
    a = math.atan2(dy, dx)
    c = max(-1, min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)))
    a1 = a - bend * math.acos(c)
    ex, ey = sx + l1 * math.cos(a1), sy + l1 * math.sin(a1)
    ang2 = math.atan2(ty - ey, tx - ex)
    return (ex, ey), (ex + l2 * math.cos(ang2), ey + l2 * math.sin(ang2))


def tube(a, b, r0, r1, n=6):
    ax, ay = a
    bx, by = b
    ang = math.atan2(by - ay, bx - ax)
    pts = []
    for i in range(n + 1):
        t = ang - math.pi / 2 + math.pi * i / n
        pts.append((bx + r1 * math.cos(t), by + r1 * math.sin(t)))
    for i in range(n + 1):
        t = ang + math.pi / 2 + math.pi * i / n
        pts.append((ax + r0 * math.cos(t), ay + r0 * math.sin(t)))
    return pts


def oval(cx, cy, rx, ry, ang=0.0, n=28, lump=0.0, seed=0):
    out = []
    c, s = math.cos(ang), math.sin(ang)
    for i in range(n):
        t = 2 * math.pi * i / n
        r = 1 + lump * (0.5 * math.sin(3 * t + seed) + 0.3 * math.sin(5 * t + seed * 2) + 0.2 * math.sin(7 * t + seed))
        x, y = rx * r * math.cos(t), ry * r * math.sin(t)
        out.append((cx + x * c - y * s, cy + x * s + y * c))
    return out


class Tf:
    def __init__(self, tx, ty, s=1.0, flip=1, rot=0.0):
        self.tx, self.ty, self.s, self.flip, self.rot = tx, ty, s, flip, rot

    def __call__(self, pts):
        c, s_ = math.cos(self.rot), math.sin(self.rot)
        return [(self.tx + self.s * (x * self.flip * c - y * s_), self.ty + self.s * (x * self.flip * s_ + y * c))
                for x, y in pts]

    def pt(self, x, y):
        return self([(x, y)])[0]


def walk_feet(phase, stride, lift=10.0):
    """Ayağın gövdeye göre konumu (x, yükseklik). phase 0..1."""
    p = phase % 1.0
    if p < 0.5:
        return stride * (0.5 - 2 * p), 0.0
    q = (p - 0.5) * 2
    return stride * (-0.5 + q), lift * math.sin(math.pi * q)


def figure(sh, T, pal, pose, seed=0, burden=True, line_alpha=0.85):
    """pose anahtarları:
    bend (gövde öne eğilme, rad), hip_drop, feet: [(x,y),(x,y)] yakın/uzak, hands: [(x,y)|None]*2,
    head_tilt, burden_scale, burden_off (dx,dy,rot), sit (0..1), hat, eye (bool), burden_dark
    """
    P = dict(bend=0.0, hip_drop=0.0, feet=[(6, 0), (-6, 0)], hands=[None, None], head_tilt=0.0, burden_scale=1.0,
             burden_off=(0, 0, 0), sit=0.0, hat=False, eye=True, legs=(48, 46), torso=40, burden_dark=0.0,
             arm=(36, 34), sway=0.0, burden_detached=None, head_lift=0.0)
    P.update(pose)
    L1, L2 = P['legs']
    sit = P['sit']
    hip = (P['sway'] * 4, -(L1 + L2 - 6) + P['hip_drop'] + sit * (L1 + L2 - 30))
    bend = P['bend']
    tor = P['torso']
    sho = (hip[0] + tor * math.sin(bend), hip[1] - tor * math.cos(bend))
    neck = (sho[0] + 14 * math.sin(bend * 1.2 + P['head_tilt']), sho[1] - 14 * math.cos(bend * 1.2 + P['head_tilt']))
    ha = bend * 1.25 + P['head_tilt']
    head_c = (neck[0] + 15 * math.sin(ha), neck[1] - 15 * math.cos(ha) + P['head_lift'])
    s_ = 1.0
    ln = dict(color=INK, alpha=line_alpha)

    # --- yük (sırtta)
    def draw_burden():
        bs = P['burden_scale']
        if P['burden_detached'] is not None:
            bx, by, brot = P['burden_detached']
        else:
            ox, oy, brot = P['burden_off']
            bx = sho[0] - 6 - 92 * bs * 1.02 * math.cos(bend * 0.5) + ox
            by = sho[1] - 92 * bs * 0.25 + 92 * bs * 0.5 * math.sin(bend) + oy
        R = 92 * bs
        shape = oval(bx, by, R * 1.08, R * 0.95, brot - 0.15, n=40, lump=0.045, seed=3)
        col = hexc(pal['burden']) * (1 - 0.35 * P['burden_dark'])
        sh.fill([T(shape)], col, seed=seed + 1, shade=0.9, hatch=0.9, light=(T.flip * 1, -0.5), shade_col='#0e1222')
        # pastel kenar ışığı
        rim = [(bx + R * 1.0 * math.cos(t), by + R * 0.88 * math.sin(t)) for t in [(-1.5 + i * 0.09) for i in range(16)]]
        sh.line(T(rim), pal['burden_rim'], width=5 * T.s, alpha=0.55, seed=seed + 2, passes=1, wobble=1.2)
        sh.line(T(shape + shape[:1]), INK, width=2.6 * T.s, alpha=0.8, seed=seed + 3)
        return bx, by, R

    # uzak kol/bacak
    def leg(foot, far):
        k = ik(hip[0], hip[1], foot[0], foot[1] - 2, L1, L2, bend=-1)
        knee, ank = k
        col = hexc(pal['legs']) * (0.8 if far else 1.0)
        sh.fill([T(tube(hip, knee, 4.2, 3.6)), T(tube(knee, (foot[0], foot[1] - 3), 3.6, 3.0))], col, seed=seed + (5 if far else 6),
                wobble=0.6, rough=0.6)
        sh.line(T([hip, knee, (foot[0], foot[1] - 3)]), INK, width=1.6 * T.s, alpha=0.55, seed=seed + 7)
        # ayak
        sh.fill([T(oval(foot[0] + 5, foot[1] - 3, 8, 3.6))], col * 0.85, seed=seed + 8, wobble=0.5)

    def arm(hand, far, default_ang):
        sx, sy = sho[0] + (-3 if far else 3), sho[1] + 4
        a1, a2 = P['arm']
        if hand is None:
            hand = (sx + (a1 + a2 - 8) * math.sin(default_ang), sy + (a1 + a2 - 8) * math.cos(default_ang))
        el, hd = ik(sx, sy, hand[0], hand[1], a1, a2, bend=1)
        col = hexc(pal['coat_dk'] if far else pal['coat'])
        sh.fill([T(tube((sx, sy), el, 5.2, 4.4)), T(tube(el, hd, 4.4, 3.6))], col, seed=seed + (9 if far else 10),
                wobble=0.7, rough=0.7)
        sh.fill([T(oval(hd[0], hd[1], 4.6, 5.2))], pal['hand'], seed=seed + 11, wobble=0.4)
        sh.line(T([(sx, sy), el, hd]), INK, width=1.5 * T.s, alpha=0.5, seed=seed + 12)
        return hd

    feet = P['feet']
    if sit > 0.5:
        # oturuş: dizler yukarıda, ayaklar önde
        pass
    if burden and P['burden_detached'] is None:
        draw_burden()
    arm(P['hands'][1], True, 0.15 + bend)
    leg(feet[1], True)
    # gövde / palto (uzun, çan)
    c, s = math.cos(bend), math.sin(bend)

    def bp(x, y):  # gövde yerel -> figür yerel (kalça merkezli, eğik)
        return (hip[0] + x * c - y * s * -1 * 0 + x * 0, 0)

    coat = []
    for x, y in [(-9, -tor - 2), (9, -tor - 2), (14, -tor + 14), (19, 12), (16, 22), (-16, 22), (-20, 12), (-13, -tor + 14)]:
        # y negatif yukarı; eğiklik uygula
        rx = hip[0] + x * c - y * s
        ry = hip[1] + x * s + y * c
        coat.append((rx, ry))
    sh.fill([T(coat)], pal['coat'], seed=seed + 13, shade=0.7, hatch=0.5, light=(1, -0.6), shade_col='#3b2b3a')
    sh.line(T(coat + coat[:1]), INK, width=1.9 * T.s, alpha=line_alpha, seed=seed + 14)
    leg(feet[0], False)
    # boyun + kafa (uzun yumurta)
    sh.fill([T(tube(sho, neck, 3.2, 3.0))], pal['head'], seed=seed + 15, wobble=0.4)
    head = oval(head_c[0], head_c[1], 10.5, 15.5, ha * 0.8, n=24)
    sh.fill([T(head)], pal['head'], seed=seed + 16, shade=0.45, light=(1, -0.6), shade_col='#7a5d63')
    if P.get('hair', True):
        hair = oval(head_c[0] - 3 * math.cos(ha), head_c[1] - 9, 10, 7, ha * 0.8 - 0.2, n=16)
        sh.fill([T(hair)], pal.get('hair', '#3b3036'), seed=seed + 17, wobble=0.5)
    if P['hat']:
        hat = [(head_c[0] - 9, head_c[1] - 10), (head_c[0] + 9, head_c[1] - 12), (head_c[0] + 6, head_c[1] - 30),
               (head_c[0] - 5, head_c[1] - 29)]
        sh.fill([T(hat)], pal['hat'], seed=seed + 18)
        sh.line(T(hat + hat[:1]), INK, width=1.5 * T.s, alpha=0.7, seed=seed + 19)
    sh.line(T(head + head[:1]), INK, width=1.6 * T.s, alpha=line_alpha, seed=seed + 20)
    # yanak + göz (minicik)
    ex, ey = head_c[0] + 5 * math.cos(ha), head_c[1] + 1 + 5 * math.sin(ha)
    sh.fill([T(oval(ex - 1, ey + 5, 3.4, 2.2))], pal['cheek'], alpha=0.55, seed=seed + 21, wobble=0.3)
    if P['eye']:
        sh.fill([T(oval(ex + 1, ey - 2, 1.4, 1.7))], INK, seed=seed + 22, wobble=0.1, rough=0.2)
    # yakın kol
    hd = arm(P['hands'][0], False, 0.25 + bend)
    if burden and P['burden_detached'] is None:
        # askılar
        st = [sho, (sho[0] - 6, sho[1] + 22), (sho[0] - 20, sho[1] + 30)]
        sh.line(T(st), pal['strap'], width=3.2 * T.s, alpha=0.8, seed=seed + 23)
    return dict(head=T.pt(*head_c), hand=T.pt(*hd), hip=T.pt(*hip), sho=T.pt(*sho), head_local=head_c)
