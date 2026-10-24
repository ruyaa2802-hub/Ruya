"""Post pass: 3D rain streaks + ground splashes projected with the real camera,
occluded by the rendered depth (mist pass), lit by the frame itself; film grain,
vignette. Writes final 8-bit frames.

    python3 post.py RENDER_DIR OUT_DIR
"""
import json
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SRC, DST = sys.argv[1], sys.argv[2]
os.makedirs(DST, exist_ok=True)
cams = json.load(open(os.path.join(SRC, "camera.json")))
MIST_START, MIST_DEPTH = 1.0, 120.0
FPS = 30.0
SHUTTER = 0.5 / FPS
FALL = 8.5           # m/s
WIND = np.array([-0.55, 0.25, 0.0])

rng = np.random.default_rng(42)
N_DROPS = 16000
BOX = np.array([12.0, 30.0, 10.0])          # rain box around the camera (x, y, z)
BOX_OFF = np.array([-6.0, -4.0, 0.0])
seed_pos = rng.random((N_DROPS, 3)) * BOX
drop_len_jit = rng.uniform(0.7, 1.3, N_DROPS)
drop_bri = rng.uniform(0.5, 1.0, N_DROPS)


def cam_basis(c):
    m = np.array(c["m"])
    R = m[:3, :3]
    t = m[:3, 3]
    return R, t


def project(P, R, t, lens, sensor, W, H):
    # camera looks down -Z, x right, y up
    pc = (P - t) @ R
    z = -pc[..., 2]
    fx = lens / sensor * W
    u = W / 2 + fx * pc[..., 0] / np.maximum(z, 1e-4)
    v = H / 2 - fx * pc[..., 1] / np.maximum(z, 1e-4)
    return u, v, z


def drop_positions(time, cam_t):
    """World positions of the drops; the box wraps around the camera so rain is always present."""
    p = seed_pos.copy()
    p[:, 2] -= FALL * time
    p += WIND * time
    origin = cam_t + BOX_OFF
    origin[2] = 0.0
    rel = np.mod(p - origin, BOX)
    return origin + rel


def depth_from_mist(m):
    return MIST_START + MIST_DEPTH * np.clip(m, 0, 1)


def main():
    frames = sorted(f for f in os.listdir(os.path.join(SRC, "beauty")) if f.endswith(".png"))
    splashes = []
    for name in frames:
        fnum = int(name[2:6])
        img16 = np.asarray(Image.open(os.path.join(SRC, "beauty", name))).astype(np.float32)
        img = img16 / (65535.0 if img16.max() > 255 else 255.0)
        img = img[..., :3]
        H, W = img.shape[:2]
        mpath = os.path.join(SRC, "mist", f"m_{fnum:04d}.png")
        mist = np.asarray(Image.open(mpath)).astype(np.float32)
        mist = mist / (65535.0 if mist.max() > 255 else 255.0)
        if mist.ndim == 3:
            mist = mist[..., 0]
        depth = depth_from_mist(mist)
        c = cams[str(fnum)]
        R, t = cam_basis(c)
        scale = W / 1080.0
        time = (fnum - 1) / FPS
        p1 = drop_positions(time, t)
        p0 = p1 + np.array([0, 0, FALL]) * SHUTTER * drop_len_jit[:, None] - WIND * SHUTTER
        u1, v1, z1 = project(p1, R, t, c["lens"], c["sensor"], W, H)
        u0, v0, z0 = project(p0, R, t, c["lens"], c["sensor"], W, H)
        mask = Image.new("L", (W, H), 0)
        draw = ImageDraw.Draw(mask)
        ok = (z1 > 0.35) & (z0 > 0.35)
        ok &= (u1 > -50) & (u1 < W + 50) & (v1 > -200) & (v1 < H + 200)
        focus = c["focus"]
        for i in np.nonzero(ok)[0]:
            um, vm = int((u0[i] + u1[i]) / 2), int((v0[i] + v1[i]) / 2)
            if 0 <= um < W and 0 <= vm < H and depth[vm, um] < z1[i] - 0.05:
                continue   # hidden behind geometry
            zz = z1[i]
            # near drops are big and soft (defocused), far drops thin and faint
            defocus = abs(zz - focus) / max(zz, 0.3)
            width = max(1, int(round((1.0 + 2.2 / zz) * scale * (1 + 0.8 * min(defocus, 1.5)))))
            a = drop_bri[i] * min(1.0, 4.0 / (zz + 1.0)) / (1 + 1.5 * min(defocus, 2.0))
            a = int(255 * min(1.0, 0.25 + a) * (0.55 if zz > 12 else 1.0))
            draw.line([(u0[i], v0[i]), (u1[i], v1[i])], fill=a, width=width)
        # ground splashes near the camera (short lived)
        cam_xy = t[:2]
        for _ in range(int(55 * scale + 10)):
            gx = rng.uniform(-0.3, 7.0)
            gy = cam_xy[1] + rng.uniform(-2, 16)
            gz = 0.02 if abs(gx) < 2.3 else 0.16
            splashes.append([np.array([gx, gy, gz]), fnum, rng.uniform(0.5, 1.0)])
        splashes = [s for s in splashes if fnum - s[1] < 3]
        for P, born, b in splashes:
            u, v, z = project(P[None], R, t, c["lens"], c["sensor"], W, H)
            u, v, z = float(u[0]), float(v[0]), float(z[0])
            if z < 0.5 or not (0 <= u < W and 0 <= v < H):
                continue
            if depth[int(v), int(u)] < z - 0.1:
                continue
            age = fnum - born
            rad = (0.02 + 0.03 * age) * 1080 * c["lens"] / c["sensor"] / z * scale / 1.0
            rad = max(1.0, min(rad, 14 * scale))
            a = int(255 * b * (1 - age / 3.0) * min(1.0, 6.0 / z))
            if age == 0:
                draw.line([(u, v), (u, v - rad * 2.5)], fill=a, width=max(1, int(scale)))
            else:
                draw.ellipse([u - rad, v - rad * 0.3, u + rad, v + rad * 0.3], outline=a, width=max(1, int(scale)))
        rain = np.asarray(mask.filter(ImageFilter.GaussianBlur(0.6 * scale))).astype(np.float32) / 255.0
        # light the rain with the surrounding light (drops glow near lamps / windows)
        small = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8)).resize((W // 8, H // 8), Image.BILINEAR)
        lit = np.asarray(small.filter(ImageFilter.GaussianBlur(4)).resize((W, H), Image.BILINEAR)).astype(np.float32) / 255.0
        rain_col = 0.06 + 1.8 * lit
        out = img + rain[..., None] * rain_col * 0.85
        # grade: slight teal shadows / warm highlights
        lum = out.mean(axis=2, keepdims=True)
        out = out + (0.012 * (1 - np.clip(lum * 4, 0, 1))) * np.array([-0.4, 0.15, 0.4])
        # vignette
        yy, xx = np.mgrid[0:H, 0:W]
        rr = np.sqrt(((xx - W / 2) / (W / 2)) ** 2 * 0.8 + ((yy - H / 2) / (H / 2)) ** 2)
        out *= (1 - 0.35 * np.clip(rr - 0.35, 0, 1) ** 1.6)[..., None]
        # film grain (per frame, luminance weighted)
        g = rng.normal(0, 0.016, (H, W, 1)).astype(np.float32)
        out = out + g * (0.6 + 0.4 * np.sqrt(np.clip(lum, 0, 1)))
        out = np.clip(out, 0, 1)
        Image.fromarray((out * 255 + 0.5).astype(np.uint8)).save(os.path.join(DST, f"p_{fnum:04d}.png"))
        print("post", fnum, flush=True)


if __name__ == "__main__":
    main()
