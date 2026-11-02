#!/usr/bin/env python3
"""Telifsiz, tamamen kodla sentezlenen sinematik bilim belgeseli fon müziği.

Katmanlar: derin drone + yumuşak pad akorları + merak uyandıran arpej + hava dokusu
+ sahne geçişlerinde sinematik "vurgu" (sub-boom + whoosh). Ücretsiz, API yok.

Kullanım: python3 studio/araclar/muzik.py <video-klasoru> <cikti.wav>
  (sure ve vurgu zamanlarını zamanlama.json + ayarlar.json'dan alır)
"""
import json, sys, wave
from pathlib import Path
import numpy as np

SR = 48000


def nota(n):  # MIDI -> Hz
    return 440.0 * 2 ** ((n - 69) / 12)


def zarf(n, atak, birak):
    e = np.ones(n)
    a, r = int(atak * SR), int(birak * SR)
    if a: e[:a] = np.linspace(0, 1, a) ** 2
    if r: e[-r:] *= np.linspace(1, 0, r) ** 2
    return e


def testere(f, t, harmonik=14, parlaklik=5.0):
    """Yumuşatılmış (alçak geçiren) testere dalga: sıcak analog pad."""
    s = np.zeros_like(t)
    for k in range(1, harmonik + 1):
        if f * k > 9000: break
        s += np.sin(2 * np.pi * f * k * t) / k * np.exp(-k / parlaklik)
    return s


def pad(akorlar, sure, t):
    out = np.zeros((2, len(t)))
    blok = sure / len(akorlar)
    for i, akor in enumerate(akorlar):
        a, b = int(max(0, (i * blok - 1.2)) * SR), int(min(sure, (i + 1) * blok + 1.2) * SR)
        tt = t[a:b]
        e = zarf(b - a, 1.6, 1.6)
        for j, n in enumerate(akor):
            for kanal, detune in ((0, -0.11), (1, 0.13)):
                f = nota(n) * 2 ** (detune / 12)
                faz = 0.6 * np.sin(2 * np.pi * 0.07 * tt + j)
                out[kanal, a:b] += testere(f, tt + faz / f, parlaklik=3.5 + 1.5 * np.sin(2 * np.pi * 0.05 * tt + j)) * e * 0.12
    return out


def arpej(akorlar, sure, t, bpm=96, basla=2.0):
    out = np.zeros((2, len(t)))
    adim = 60 / bpm / 2  # sekizlik
    blok = sure / len(akorlar)
    k, zaman = 0, basla
    rng = np.random.default_rng(3)
    while zaman < sure - 1.0:
        akor = akorlar[min(int(zaman / blok), len(akorlar) - 1)]
        sira = [0, 2, 1, 3, 2, 1][k % 6]
        n = akor[sira % len(akor)] + 12
        a = int(zaman * SR)
        L = int(0.9 * SR)
        b = min(len(t), a + L)
        tt = np.arange(b - a) / SR
        f = nota(n)
        ton = (np.sin(2 * np.pi * f * tt) + 0.25 * np.sin(2 * np.pi * 2 * f * tt) + 0.08 * np.sin(2 * np.pi * 3 * f * tt))
        e = np.exp(-tt * 5.5) * (1 - np.exp(-tt * 200))
        ses = ton * e * (0.05 + 0.02 * rng.random())
        pan = 0.5 + 0.35 * np.sin(k * 1.7)
        out[0, a:b] += ses * (1 - pan)
        out[1, a:b] += ses * pan
        k += 1
        zaman += adim
    # ping-pong gecikme
    d = int(adim * 3 * SR)
    for tekrar, g in ((1, 0.35), (2, 0.18)):
        kay = d * tekrar
        out[0, kay:] += out[1, :-kay] * g
        out[1, kay:] += out[0, :-kay] * g
    # giriş: arpej yavaşça açılır
    out *= np.clip((t - basla) / 4.0, 0, 1)
    return out


def drone(t, kok):
    f = nota(kok - 24)
    s = np.sin(2 * np.pi * f * t) * 0.22 + np.sin(2 * np.pi * f * 1.5 * t) * 0.05
    s *= 0.8 + 0.2 * np.sin(2 * np.pi * 0.11 * t)
    return np.vstack([s, s])


def hava(t, rng):
    n = rng.standard_normal(len(t))
    # basit tek kutuplu alçak geçiren filtre (uğultu dokusu)
    y = np.zeros_like(n)
    a = 0.985
    acc = 0.0
    for i in range(0, len(n), 1):
        acc = a * acc + (1 - a) * n[i]
        y[i] = acc
    y /= np.max(np.abs(y)) + 1e-9
    mod = 0.5 + 0.5 * np.sin(2 * np.pi * 0.09 * t)
    return np.vstack([y, np.roll(y, 977)]) * 0.05 * mod


def vurgu(t_an, uzunluk, rng):
    """Sinematik geçiş: ters whoosh (0.6 sn önce) + sub boom."""
    out = np.zeros((2, uzunluk))
    # boom
    a = int(t_an * SR)
    L = int(2.2 * SR)
    tt = np.arange(L) / SR
    f = 34 + 60 * np.exp(-tt * 9)
    faz = 2 * np.pi * np.cumsum(f) / SR
    boom = np.sin(faz) * np.exp(-tt * 2.4) * (1 - np.exp(-tt * 400)) * 0.55
    b = min(uzunluk, a + L)
    out[:, a:b] += boom[: b - a]
    # whoosh (yükselen filtreli gürültü)
    W = int(0.65 * SR)
    ws = max(0, a - W)
    n = rng.standard_normal(a - ws)
    if len(n):
        env = np.linspace(0, 1, len(n)) ** 3
        kuyruk = min(len(n), int(0.12 * SR))
        env[-kuyruk:] *= np.linspace(1, 0, kuyruk) ** 1.5  # tıklamasız bitiş
        y = np.zeros_like(n); acc = 0.0
        alfa = np.linspace(0.97, 0.75, len(n))
        for i in range(len(n)):
            acc = alfa[i] * acc + (1 - alfa[i]) * n[i]
            y[i] = acc
        y = y / (np.max(np.abs(y)) + 1e-9) * env * 0.18
        out[0, ws:a] += y
        out[1, ws:a] += np.roll(y, 300)
    return out


def yanki(x, sure=2.8, karisim=0.28, rng=None):
    """FFT konvolüsyon ile sentetik salon yankısı."""
    L = int(sure * SR)
    tt = np.arange(L) / SR
    ir = np.vstack([rng.standard_normal(L), rng.standard_normal(L)]) * np.exp(-tt * 3.2)
    ir[:, : int(0.012 * SR)] = 0
    ir /= np.sqrt((ir ** 2).sum(axis=1, keepdims=True))
    n = x.shape[1] + L
    N = 1 << (n - 1).bit_length()
    out = np.zeros((2, x.shape[1]))
    for k in range(2):
        y = np.fft.irfft(np.fft.rfft(x[k], N) * np.fft.rfft(ir[k], N), N)[: x.shape[1]]
        out[k] = x[k] * (1 - karisim) + y * karisim * 3.0
    return out


def main():
    klasor, cikti = Path(sys.argv[1]), Path(sys.argv[2])
    z = json.loads((klasor / "zamanlama.json").read_text(encoding="utf-8"))
    ayar_yol = klasor / "ayarlar.json"
    ayar = json.loads(ayar_yol.read_text(encoding="utf-8")) if ayar_yol.exists() else {}
    m = ayar.get("muzik", {})
    sure = z["sure"]
    vurgu_zaman = []
    cumle = {c["id"]: c for c in z["cumleler"]}
    for cid in m.get("vurgu_cumleleri", []):
        c = cumle[cid]
        onceki = cumle.get(cid - 1)
        vurgu_zaman.append((onceki["son"] + c["bas"]) / 2 if onceki else c["bas"])

    rng = np.random.default_rng(11)
    t = np.arange(int(sure * SR)) / SR
    # Re minör merak/gizem: Dm(add9) – B♭maj7 – F/A – Csus2
    akorlar = m.get("akorlar", [[50, 57, 62, 64, 65], [46, 53, 57, 62, 65], [45, 53, 57, 60, 65], [48, 55, 60, 62, 67]])
    tekrar = max(1, round(sure / 24))
    akor_dizisi = akorlar * tekrar

    x = pad(akor_dizisi, sure, t) + drone(t, akorlar[0][0]) + hava(t, rng)
    x += arpej(akor_dizisi, sure, t, bpm=m.get("bpm", 96))
    x = yanki(x, rng=rng)
    for v in vurgu_zaman:
        x += vurgu(v, len(t), rng)

    x *= zarf(len(t), 1.5, 2.5)
    x /= np.max(np.abs(x)) + 1e-9
    x *= 0.89  # ~ -1 dBFS
    pcm = (x.T * 32767).astype(np.int16)
    cikti.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(cikti), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(f"müzik: {cikti} ({sure:.1f} sn, {len(vurgu_zaman)} vurgu)")


if __name__ == "__main__":
    main()
