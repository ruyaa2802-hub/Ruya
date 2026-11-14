"""CLAY REPLAY - Bölüm 1B: TİTANİK "Saçında yeni bir yolcu var" (kullanıcı senaryosu).

Jack = Rüzgâr kuklası, Rose = Fındık kuklası. Dekor Bölüm 1 ile ortak.
Kullanım:  python3 episode.py [--only t1,t2,...]
"""
import importlib.util
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
sys.path.insert(0, os.path.join(ROOT, 'engine'))
sys.path.insert(0, HERE)
from clay import (W, H, Canvas, Light, Xf, Camera, hexc, ellipse_pts, tube_pts, poly_tube, bezier,
                  text_mask_fn, subtitle, clamp, ease, ease_out_back, ramp, lerp, spring)
from characters import ruzgar, findik, marti, fk2
from zaman import FPS, DURATION, LINES, EVENTS, NAMES, SHOTS

# Bölüm 1 dekorunu (gökyüzü, deniz, gemi pruvası) yeniden kullan
sys.path.insert(0, os.path.join(ROOT, 'ep01-titanic'))
_spec = importlib.util.spec_from_file_location('ep01', os.path.join(ROOT, 'ep01-titanic', 'episode.py'))
ep1 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ep1)
stage_bow, bow_near_rail, body_xf, y_near, y_far, persp, shake = (
    ep1.stage_bow, ep1.bow_near_rail, ep1.body_xf, ep1.y_near, ep1.y_far, ep1.persp, ep1.shake)

LIPS = json.load(open(os.path.join(HERE, 'build', 'lipsync.json')))
LINE_T = {l[0]: (l[2], l[3]) for l in LIPS['lines']}

JACK_POS = (540, 1384)
ROSE_DECK = (590, 1398)
ROSE_RAIL = (628, 1318)
S = 1.12


def lip(who, t):
    arr = LIPS['lips'][who]
    i = int(t * FPS)
    return clamp((arr[i] if 0 <= i < len(arr) else 0.0) * 0.9)


def blink(t, period=2.7, off=0.0):
    return 0.0 if (t + off) % period < 0.09 else 1.0


def deck_y(x):
    return lerp(y_far(x), y_near(x), 0.65)


def rose_pos(t):
    """Güvertede yürüyüş -> pruva ucu -> korkuluğa kaldırılış."""
    if t < EVENTS['lift']:
        k = ease(t / EVENTS['walk_end'])
        x = lerp(395, ROSE_DECK[0], k)
        bob = abs(math.sin(t * 11)) * 12 * (1 - k)
        return x, lerp(deck_y(395), ROSE_DECK[1], k) - bob
    u = clamp((t - EVENTS['lift']) / 0.55)
    k = ease_out_back(u, 1.3)
    return lerp(ROSE_DECK[0], ROSE_RAIL[0], k), lerp(ROSE_DECK[1], ROSE_RAIL[1], k) - 60 * math.sin(math.pi * u)


def jack_pos(t):
    k = ease(t / (EVENTS['walk_end'] + 0.15))
    x = lerp(300, JACK_POS[0], k)
    bob = abs(math.sin(t * 9 + 0.6)) * 14 * (1 - k)
    return x, lerp(deck_y(300), JACK_POS[1], k) - bob


def rose_hands(fx, aL, aR):
    sh_y = -168
    _, hL = fk2(-34, sh_y + 14, aL[0], aL[1], 34, 30)
    _, hR = fk2(34, sh_y + 14, aR[0], aR[1], 34, 30)
    return fx.pt(*hL), fx.pt(*hR)


def place(X, wx, wy, scale=S):
    return Xf(*X.pt(wx, wy), s=scale * X.s * persp(wx) / persp(JACK_POS[0]), rot=X.rot)


# ===================================================================== SAHNE 1
def shot_S1(cv, t):
    """0-5.1: Jack, Rose'u elinden tutup pruvaya getirir. 'Jack! Çok güzel!' / 'Gözlerini kapat...'"""
    k = ease(t / 5.1)
    cam = Camera(lerp(470, 545, k), lerp(1110, 1080, k), lerp(0.98, 1.12, k), rot=0.006 * math.sin(t * 1.1))
    X = stage_bow(cv, t, cam)
    jx, jy = jack_pos(t)
    rx_, ry_ = rose_pos(t)
    jxf = place(X, jx, jy)
    fxf = place(X, rx_, ry_)
    walking = t < EVENTS['walk_end'] + 0.1
    arrive = ramp(t, 1.0, 1.3)
    excite = ramp(t, 1.15, 1.35) * (1 - ramp(t, 4.0, 4.3))
    closed = t > 4.25
    # Rose'un sol eli Jack'e uzanır (yürürken)
    aL = (lerp(-0.9, 0.9, arrive), lerp(-0.2, -1.9, arrive))
    aR = (lerp(0.3, -0.9, arrive), lerp(-0.4, 1.9, arrive))
    hL, _ = rose_hands(fxf, aL, aR)
    jb = body_xf(jxf, 0.04)
    tR = jb.inv(*hL) if walking else None
    lean = 0.04 + 0.07 * ramp(t, 3.2, 3.8)
    ruzgar(cv, jxf, lean=lean, tR=tR, armR=(lerp(0.3, 0.5, arrive), 0.4), armL=(-0.3, -1.6),
           mo=lip('R', t), smile=0.8, lid=0.62 * blink(t, 3.0, 0.3) + 0.03, px=0.55, py=0.6 if t > 2.4 else 0.2,
           browL=0.3, browR=1.0, wind=0.55, phase=t, head=0.08 * ramp(t, 2.4, 2.8))
    findik(cv, fxf, t=t, armL=aL, armR=aR, mo=lip('F', t), smile=lerp(0.1, 0.95, excite) if not closed else 0.6,
           worry=lerp(0.4, -0.3, excite), lid=1.0, closed=closed, px=lerp(-0.5, 0.75, arrive),
           py=lerp(0.0, -0.1, arrive) if t < 2.5 else lerp(-0.1, -0.85, ramp(t, 2.5, 2.8)),
           blush=0.6 + 0.4 * excite, bun=1.0 if walking else 0.4 + excite, legs_dangle=1.0 if walking else 0.0,
           head=-0.06 * excite)
    bow_near_rail(cv, X, t)


# ===================================================================== SAHNE 2
def shot_S2(cv, t):
    """5.1-12: Korkuluğa kaldırma, kolları açma, 'Uçuyorum Jack!'"""
    lt = t - 5.1
    k = ease(lt / 6.9)
    cam = Camera(lerp(570, 590, k), lerp(1110, 1070, k), lerp(1.24, 1.42, k), rot=0.01 * math.sin(t * 0.9) - 0.015 * k)
    X = stage_bow(cv, t, cam)
    rx_, ry_ = rose_pos(t)
    fxf = Xf(*X.pt(rx_, ry_), s=S * X.s, rot=X.rot)
    jxf = Xf(*X.pt(*JACK_POS), s=S * X.s, rot=X.rot)
    lean = 0.13
    jb = body_xf(jxf, lean)
    open_k = ramp(t, 6.45, 7.25)
    aL = (lerp(0.35, -1.75, open_k), lerp(0.5, 0.1, open_k))
    aR = (lerp(0.35, 1.75, open_k), lerp(-0.5, -0.1, open_k))
    wiggle = ramp(t, 8.2, 8.4) * (1 - ramp(t, 9.9, 10.2))
    aL = (aL[0] - 0.25 * wiggle * math.sin(t * 9), aL[1])
    aR = (aR[0] + 0.25 * wiggle * math.sin(t * 9 + 1), aR[1])
    hL, hR = rose_hands(fxf, aL, aR)
    waistL, waistR = fxf.pt(-48, -112), fxf.pt(46, -112)
    # eller: bel -> Rose'un elleri (kolları açtırır) -> tekrar bel
    g = ramp(t, 6.2, 6.5) * (1 - ramp(t, 7.4, 7.8))
    tL = (lerp(waistL[0], hL[0], g), lerp(waistL[1], hL[1], g))
    tR = (lerp(waistR[0], hR[0], g), lerp(waistR[1], hR[1], g))
    j_closed = t > 7.9
    ruzgar(cv, jxf, lean=lean, tL=jb.inv(*tL), tR=jb.inv(*tR), mo=lip('R', t), smile=0.85, closed=j_closed,
           lid=0.6 * blink(t, 3.0) + 0.03, px=0.5, py=0.8, browL=0.6, browR=0.9, head=0.1, wind=0.9, phase=t)
    wow = ramp(t, 7.95, 8.15)
    findik(cv, fxf, t=t, armL=aL, armR=aR, mo=lip('F', t), closed=t < 7.95, lid=1.0,
           smile=lerp(0.5, 0.95, wow), worry=lerp(0.3, -0.5, wow), px=0.3, py=-0.2, blush=0.6 + 0.4 * wow,
           bun=1.0, legs_dangle=1.0 - ramp(t, 5.9, 6.3) * 0.7, lower=0.0)
    bow_near_rail(cv, X, t)


# ===================================================================== SAHNE 3
def shot_S3(cv, t):
    """12-18: Karşıdan yakın ikili. Rüzgâr eser. 'Dünyanın en güzel hissi bu!' / 'Biliyorum Rose!'"""
    lt = t - 12.0
    k = ease(lt / 6.0)
    cam = Camera(lerp(585, 615, k), lerp(985, 945, k), lerp(1.85, 2.0, k), rot=lerp(-0.035, 0.03, k))
    X = stage_bow(cv, t, cam, dof=4.5)
    fxf = Xf(*X.pt(*ROSE_RAIL), s=S * X.s, rot=X.rot)
    jxf = Xf(*X.pt(*JACK_POS), s=S * X.s, rot=X.rot)
    lean = 0.17
    jb = body_xf(jxf, lean)
    wL, wR = fxf.pt(-48, -112), fxf.pt(46, -112)
    nod = math.sin(clamp((t - 15.3) / 1.2) * math.pi * 2) * 0.06 if 15.3 < t < 16.5 else 0
    ruzgar(cv, jxf, lean=lean, tL=jb.inv(*wL), tR=jb.inv(*wR), mo=lip('R', t), smile=0.9, closed=True,
           browL=0.7, browR=0.9, head=0.12 + nod, wind=1.0, phase=t * 1.4)
    gust = 0.6 + 0.4 * math.sin(t * 2.3)
    findik(cv, fxf, t=t, armL=(-1.8 - 0.12 * math.sin(t * 3), 0.15), armR=(1.8 + 0.12 * math.sin(t * 3 + 1), -0.15),
           mo=lip('F', t), closed=True, smile=0.95, worry=-0.6, blush=1.0, bun=1.5 * gust, head=-0.05 + 0.03 * math.sin(t * 2))
    # rüzgârda uçuşan kil parçacıkları (deniz serpintisi)
    for i in range(10):
        ph = (t * 0.9 + i * 0.137) % 1.0
        x = lerp(W + 40, -60, ph)
        y = 200 + (i * 173) % 1500 + 30 * math.sin(t * 3 + i)
        cv.part([('poly', ellipse_pts(x, y, 7 + i % 3 * 3, 4 + i % 2 * 2))], '#f2f5f4', alpha=0.6, shadow=False,
                bump=0.6, tex=0.2)
    bow_near_rail(cv, X, t)


# ===================================================================== SAHNE 4
def gull_state(t, land_pt):
    """Martının konumu (ekran), uçuş durumu."""
    t0, t1 = EVENTS['gull_in'], EVENTS['land']
    if t < t0:
        return None
    if t < t1:
        u = ease(clamp((t - t0) / (t1 - t0)))
        lx, ly = land_pt
        p = bezier((lx + 700, ly - 520), (lx + 120, ly - 520), (lx, ly), 2)
        # tek nokta hesapla
        a = (1 - u) ** 2
        b = 2 * (1 - u) * u
        c = u * u
        P0, P1, P2 = (lx + 700, ly - 520), (lx + 160, ly - 560), (lx, ly)
        x = a * P0[0] + b * P1[0] + c * P2[0]
        y = a * P0[1] + b * P1[1] + c * P2[1]
        return dict(x=x, y=y, fly=1.0, flap=math.sin(t * 38), squash=0.0, settle=0.0, rot=-0.1)
    lt = t - t1
    sq = math.exp(-lt * 7) * math.sin(lt * 30) * 0.6 if lt < 0.6 else 0.0
    return dict(x=land_pt[0], y=land_pt[1], fly=0.0, flap=0.0, squash=max(0.0, sq), settle=ramp(t, t1 + 0.3, t1 + 1.0),
                rot=0.0)


def shot_S4(cv, t):
    """18-25.8: Romantik bakış... martı Jack'in saçına konar. 'Saçında yeni bir yolcu var.'"""
    lt = t - 18.0
    sx, sy = shake(t, EVENTS['squawk2'], 9, 0.5, 30)
    z = 1.62 + 0.03 * lt
    cam = Camera(625 + sx / z, 845 + sy / z, z, rot=0.008 * math.sin(t * 0.8))
    X = stage_bow(cv, t, cam, dof=4.0)
    fxf = Xf(*X.pt(*ROSE_RAIL), s=S * X.s, rot=X.rot)
    jxf = Xf(*X.pt(*JACK_POS), s=S * X.s, rot=X.rot)
    lean = 0.15
    jb = body_xf(jxf, lean)
    wL, wR = fxf.pt(-48, -112), fxf.pt(46, -112)
    landed = t >= EVENTS['land']
    romance = ramp(t, 18.1, 18.5)
    roll_up = ramp(t, 21.5, 21.75)
    flinch = ramp(t, EVENTS['squawk2'], EVENTS['squawk2'] + 0.1)
    freeze = ramp(t, 20.3, 20.5)
    jinfo = ruzgar(cv, jxf, lean=lean, tL=jb.inv(*wL), tR=jb.inv(*wR), mo=lip('R', t),
                   smile=lerp(0.9, 0.0, freeze) - 0.5 * flinch,
                   closed=flinch > 0.5 or (18.0 <= t < 18.1),
                   lid=lerp(0.62, lerp(0.85, 1.0, roll_up), freeze) * blink(t, 2.9, 0.5) + 0.02,
                   px=lerp(lerp(0.5, 0.3, roll_up), 0.0, 0), py=lerp(0.9, -1.0, roll_up),
                   browL=lerp(1.0, 1.5, freeze), browR=lerp(1.2, 1.6, freeze), head=lerp(0.1, 0.16, romance),
                   wind=lerp(0.9, 0.3, ramp(t, 19.2, 19.6)), phase=t)
    hx, hy = jinfo['head']
    land = (hx - 12 * X.s, hy - 74 * S * X.s)
    notice = ramp(t, 19.55, 19.75)
    findik(cv, fxf, t=t, armL=(lerp(-1.8, -0.6, ramp(t, 19.6, 20.0)), 0.15),
           armR=(lerp(1.8, 0.6, ramp(t, 19.6, 20.0)), -0.15), mo=lip('F', t),
           closed=t < 19.55, smile=lerp(0.9, -0.15, notice), worry=lerp(-0.5, 0.9, notice), lid=lerp(1.0, 0.75, ramp(t, 20.9, 21.2)),
           px=lerp(0.2, -0.55, notice), py=lerp(0.0, -1.0, notice), blush=lerp(1.0, 0.3, notice), bun=0.4,
           head=lerp(-0.05, -0.12, notice))
    g = gull_state(t, land)
    if g:
        look = 0.0
        if landed:
            look = 0.25 * math.sin((t - 19.4) * 2.2) if t < EVENTS['squawk2'] else -0.35
        beak = 0.0
        if EVENTS['squawk1'] + 0.3 < t < EVENTS['squawk1'] + 0.75:
            beak = 0.6
        if t > EVENTS['squawk2']:
            beak = 0.9 * abs(math.sin((t - EVENTS['squawk2']) * 11))
        if g['fly'] < 0.5:
            # yuva: saçı yuvaya döner
            gx = Xf(g['x'], g['y'], 1.05 * X.s, 0.0)
            if t > EVENTS['egg']:
                k = ease_out_back(clamp((t - EVENTS['egg']) / 0.25), 2.2)
                eg = gx.child(-58, -10, s=k)
                cv.part([('poly', eg(ellipse_pts(0, -18, 15, 19)))], '#d9eef2', spec=0.6, shadow_k=0.4)
                for (ex, ey) in ((-5, -26), (6, -14), (-2, -8), (7, -30)):
                    cv.part([('poly', eg(ellipse_pts(ex, ey, 2.2, 2)))], '#6d7d86', shadow=False, flat=True)
        else:
            gx = Xf(g['x'], g['y'], 1.05 * X.s, g['rot'], flip=-1)
        marti(cv, gx, t=t, fly=g['fly'], flap=g['flap'], beak=beak, look=look, squash=g['squash'],
              settle=g['settle'], lid=0.5 if t < EVENTS['egg'] else 0.8)
        if landed and t < EVENTS['land'] + 0.35:  # tüyler uçuşur
            k = (t - EVENTS['land']) / 0.35
            for i in range(6):
                a = -2.6 + i * 0.45
                fx_, fy_ = g['x'] + math.cos(a) * 160 * k * X.s, g['y'] - 40 * X.s + math.sin(a) * 120 * k * X.s + 80 * k * k * X.s
                cv.part([('poly', ellipse_pts(fx_, fy_, 14 * X.s * 0.6, 5 * X.s * 0.6, a))], '#f4f1ea', alpha=1 - k,
                        shadow=False)
    bow_near_rail(cv, X, t)
    if t > EVENTS['title']:
        k = ease_out_back(clamp((t - EVENTS['title']) / 0.4), 1.6)
        y = lerp(2100, 1560, k)
        cv.part([], '#e8574e', mask_fn=text_mask_fn('CLAY REPLAY', 540, y, 110), spec=0.4, shadow_k=0.5)
        a = ramp(t, EVENTS['title'] + 0.4, EVENTS['title'] + 0.7)
        if a > 0:
            cv.part([], '#f7f1e3', mask_fn=text_mask_fn('Bölüm 1 · TİTANİK', 540, y + 110, 46), alpha=a, shadow_k=0.4)


SHOT_FN = dict(S1_pruvaya_gelis=shot_S1, S2_kollarini_ac=shot_S2, S3_karsidan=shot_S3, S4_marti=shot_S4)


def shot_of(t):
    for name, a, b in SHOTS:
        if a <= t < b:
            return name
    return SHOTS[-1][0]


def subs(img, t):
    for lid, who, st, txt in LINES:
        a, b = LINE_T[lid]
        nxt = [l[2] for l in LINES if l[2] > st]
        end = min(b + 0.45, nxt[0] - 0.05) if nxt else b + 0.5
        if st - 0.03 <= t < end:
            col = '#ffe08a' if who == 'R' else '#ffb3c4'
            return subtitle(img, txt, y=1580 if t < EVENTS['title'] else 1300, size=66, who=NAMES[who], who_col=col)
    return img


def render_pose(fi):
    t = fi / FPS
    cv = Canvas(Light(key=(0.62, -0.45, 0.66), rim=(1, -0.3, 0.1)), frame_seed=fi // 2)
    SHOT_FN[shot_of(t)](cv, t)
    return cv.finish(grain_idx=fi // 2, vignette=0.5)


def pose_index(fi):
    pe = (fi // 2) * 2
    return fi if shot_of(pe / FPS) != shot_of(fi / FPS) else pe


def render_frame(fi):
    return subs(render_pose(pose_index(fi)), fi / FPS)


OUT_DIR = os.path.join(HERE, 'build', 'frames')


def job(fi):
    p = os.path.join(OUT_DIR, f'f{fi:04d}.jpg')
    if os.path.exists(p):
        return fi
    pi = pose_index(fi)
    base = render_pose(pi)
    subs(base, fi / FPS).save(p, quality=95)
    nxt = fi + 1
    if nxt < int(DURATION * FPS) and pose_index(nxt) == pi:
        subs(base, nxt / FPS).save(os.path.join(OUT_DIR, f'f{nxt:04d}.jpg'), quality=95)
    return fi


if __name__ == '__main__':
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', default='')
    ap.add_argument('--jobs', type=int, default=os.cpu_count())
    a = ap.parse_args()
    os.makedirs(OUT_DIR, exist_ok=True)
    if a.only:
        pdir = os.path.join(HERE, 'build', 'preview')
        os.makedirs(pdir, exist_ok=True)
        for ts in a.only.split(','):
            fi = int(round(float(ts) * FPS))
            render_frame(fi).save(os.path.join(pdir, f'p_{float(ts):05.2f}.jpg'), quality=90)
            print('ok', ts, flush=True)
    else:
        from multiprocessing import Pool
        nf = int(DURATION * FPS)
        todo = [f for f in range(nf) if pose_index(f) == f]
        with Pool(a.jobs) as pool:
            for i, fi in enumerate(pool.imap_unordered(job, todo, chunksize=1)):
                if i % 24 == 0:
                    print('poz', i, '/', len(todo), flush=True)
