"""Fotoğrafları hazırlar: büyütme + 2.5D paralaks için elle tasarlanmış derinlik haritaları."""
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance

def up(src, dst, size):
    im = Image.open(src).convert("RGB").resize((size, size), Image.LANCZOS)
    im = im.filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))
    im.save(dst, quality=95)

def grid(n):
    y, x = np.mgrid[0:n, 0:n] / (n - 1.0)
    return x, y

def save_depth(d, path, blur):
    d = np.clip(d, 0, 1)
    Image.fromarray((d * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(blur)).save(path)

N = 512
up("assets/kuvoz.jpg", "assets/kuvoz_hd.jpg", 1600)
up("assets/sehir_gece.jpg", "assets/sehir_gece_hd.jpg", 2048)
up("assets/sehir_gunbatimi.jpg", "assets/sehir_gunbatimi_hd.jpg", 2048)

# Küvöz: bebek/kapsül öne, arka plan geride, sol cam kolon en önde
x, y = grid(N)
d = 0.25 + 0.55 * np.exp(-(((x - 0.6) ** 2) / 0.09 + ((y - 0.62) ** 2) / 0.05))
d = np.maximum(d, 0.35 + 0.35 * np.clip((y - 0.45) * 2, 0, 1))      # kapsül gövdesi
d = np.maximum(d, 0.95 * (x < 0.1))                                  # ön cam kolon
save_depth(d, "assets/kuvoz_depth.png", 18)

# Gece şehir: kaçış noktası (0.5, 0.42) uzak; kenarlar/kalabalık yakın
x, y = grid(N)
dx = np.abs(x - 0.5) * 1.25
dy = np.clip((y - 0.42) * 1.7, 0, None)
d = np.clip(0.05 + np.maximum(dx, dy) * 1.15, 0, 1)
d = np.where(y < 0.12, d * 0.6, d)                                   # gökyüzü uzak
save_depth(d, "assets/sehir_gece_depth.png", 14)

# Gün batımı: kaçış noktası (0.53, 0.46); kadın + korkuluk çok yakın
x, y = grid(N)
dx = np.abs(x - 0.53) * 1.3
dy = np.clip((y - 0.46) * 1.6, 0, None)
d = np.clip(0.05 + np.maximum(dx, dy) * 1.0, 0, 0.8)
woman = np.exp(-(((x - 0.81) ** 2) / 0.012 + ((y - 0.66) ** 2) / 0.06))
rail = (y > 0.65) & (x > 0.42) & (y > 1.1 - 0.75 * (x - 0.42) - 0.3)
d = np.maximum(d, np.clip(woman * 1.3, 0, 1))
d = np.maximum(d, 0.85 * rail)
save_depth(d, "assets/sehir_gunbatimi_depth.png", 12)
print("ok")
