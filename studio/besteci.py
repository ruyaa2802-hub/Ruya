#!/usr/bin/env python3
"""Ruya besteci — kodla yazılmış, enstrümantal belgesel müziği (ücretsiz, lisans sorunu yok).

  /root/cbx-venv/bin/python studio/besteci.py <video>

videolar/<video>/cikti/zamanlama.json'daki bölüm zamanlarına göre bir parça besteler:
melodi + armoni + ritim; piyano, yaylılar (ensemble), pizzicato, celesta ve kontrbas.
Bölüm başları en yakın ölçüye oturtulur, her bölümün kendi düzenlemesi vardır (döngü yok).
senaryo.json → "muzik": { "ton": "F", "tempo": 92, "bolumler": { "<sahne>": "oyunbaz|hayal|sakin|yukselis|final" } }
Çıktı: videolar/<video>/ses/muzik.wav (48 kHz stereo).
"""
import json, sys
from pathlib import Path
import numpy as np
from scipy.signal import fftconvolve, butter, sosfilt

SR = 48000
KOK = Path(__file__).resolve().parent.parent
rng = np.random.default_rng(7)


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


# ---------------- enstrümanlar ----------------
def piyano(m, sure, hiz=0.7):
    f = hz(m)
    n = int((sure + 2.5) * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    B = 0.00035
    parlak = 0.5 + 0.5 * hiz
    for k in range(1, 11):
        fk = k * f * np.sqrt(1 + B * k * k)
        if fk > 12000:
            break
        a = (1 / k ** 1.25) * (parlak ** (k - 1) if k > 1 else 1)
        dec = 0.9 + 0.55 * k + f / 400
        for det in (-0.9, 0.9):                       # iki tel, hafif akort farkı → canlılık
            out += a * 0.5 * np.sin(2 * np.pi * (fk + det * k * 0.15) * t + k) * np.exp(-t * dec)
    out *= np.minimum(1, t / 0.004)
    # tuştan kalkınca sönüm
    kal = np.clip(1 - (t - sure) / 0.35, 0, 1)
    out *= np.where(t > sure, kal, 1)
    # çekiç tıkı
    ck = rng.standard_normal(int(0.012 * SR)) * np.exp(-np.arange(int(0.012 * SR)) / (0.002 * SR)) * 0.03
    out[:len(ck)] += ck
    return out * hiz


def yayli(m, sure, hiz=0.6, ses=5, atak=0.45, birak=0.9):
    f = hz(m)
    n = int((sure + birak + 0.1) * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for v in range(ses):
        det = (v - (ses - 1) / 2) * 0.0035
        vib = 1 + 0.0022 * np.sin(2 * np.pi * (5.0 + v * 0.23) * t + v) * np.clip((t - 0.25) / 0.6, 0, 1)
        faz = 2 * np.pi * f * (1 + det) * np.cumsum(vib) / SR
        for k in range(1, 9):
            if k * f > 9000:
                break
            out += np.sin(k * faz + v * k) * (1 / k) * (0.85 ** k)
    out /= ses
    zarf = np.clip(t / atak, 0, 1) ** 1.5
    zarf *= np.where(t > sure, np.clip(1 - (t - sure) / birak, 0, 1), 1)
    sos = butter(2, min(3200 + 2600 * hiz, 9000), 'low', fs=SR, output='sos')
    return sosfilt(sos, out * zarf) * hiz * 0.55


def pizz(m, hiz=0.7):
    f = hz(m)
    n = int(0.9 * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for k in range(1, 7):
        out += np.sin(2 * np.pi * k * f * t) * (1 / k ** 1.4) * np.exp(-t * (7 + 3 * k))
    out += np.sin(2 * np.pi * f * 0.5 * t) * 0.15 * np.exp(-t * 6)
    return out * np.minimum(1, t / 0.003) * hiz * 0.8


def celesta(m, hiz=0.5):
    f = hz(m)
    n = int(2.2 * SR)
    t = np.arange(n) / SR
    out = (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * f * 4.0 * t) * np.exp(-t * 6) + 0.12 * np.sin(2 * np.pi * f * 10.2 * t) * np.exp(-t * 14)) * np.exp(-t * 2.2)
    return out * np.minimum(1, t / 0.002) * hiz * 0.45


def kontrbas(m, sure, hiz=0.6):
    return yayli(m, sure, hiz * 0.9, ses=3, atak=0.12, birak=0.4)


# ---------------- müzik teorisi ----------------
TON = {'C': 60, 'D': 62, 'Eb': 63, 'F': 65, 'G': 67, 'A': 69, 'Bb': 70}
MAJ = [0, 2, 4, 5, 7, 9, 11]
# derece → akor (majör tonda diyatonik üçlüler)
def akor(kok, derece, yedili=False):
    idx = [derece, derece + 2, derece + 4] + ([derece + 6] if yedili else [])
    return [kok + MAJ[i % 7] + 12 * (i // 7) for i in idx]


# bölüm karakterleri: akor yürüyüşleri (derece, 0 = I) ve doku
YURUYUS = {
    'oyunbaz':  [0, 5, 3, 4, 0, 5, 1, 4],          # I vi IV V I vi ii V
    'hayal':    [0, 2, 3, 4, 5, 2, 3, 4],          # I iii IV V vi iii IV V
    'sakin':    [5, 3, 0, 4, 5, 3, 1, 4],          # vi IV I V vi IV ii V
    'yukselis': [3, 4, 2, 5, 3, 4, 0, 0],          # IV V iii vi IV V I I
    'final':    [0, 5, 3, 4, 3, 4, 0, 0],
}
# ana tema (I vi IV V üzerinde, ölçü başına (vuruş, süre, ton içi derece; 7 = üst oktav tonik))
TEMA = [
    [(0, .5, 4), (.5, .5, 2), (1, 1, 0), (2, .5, 1), (2.5, .5, 2), (3, 1, 4)],
    [(0, 1.5, 5), (1.5, .5, 4), (2, 1, 2), (3, 1, 0)],
    [(0, .5, 5), (.5, .5, 4), (1, 1, 3), (2, .5, 2), (2.5, .5, 3), (3, 1, 5)],
    [(0, 2, 4), (2, 1, 1), (3, 1, 6 - 7)],
    [(0, .5, 4), (.5, .5, 2), (1, 1, 0), (2, .5, 1), (2.5, .5, 2), (3, 1, 7)],
    [(0, 1.5, 9), (1.5, .5, 8), (2, 1, 7), (3, 1, 5)],
    [(0, 1, 8), (1, .5, 7), (1.5, .5, 6), (2, 1, 5), (3, 1, 4)],
    [(0, 1, 4), (1, .5, 5), (1.5, .5, 6), (2, 2, 7)],
]
TEMA_SAKIN = [[(0, 2, 2), (2, 2, 0)], [(0, 2, 0), (2, 2, -2)], [(0, 3, 4), (3, 1, 2)], [(0, 4, 1)],
              [(0, 2, 2), (2, 2, 4)], [(0, 2, 5), (2, 2, 3)], [(0, 3, 1), (3, 1, 2)], [(0, 4, 1)]]


def derece_nota(kok, d, okt=0):
    return kok + MAJ[d % 7] + 12 * (d // 7) + 12 * okt


def main():
    video = sys.argv[1]
    vdir = KOK / 'videolar' / video
    TL = json.loads((vdir / 'cikti' / 'zamanlama.json').read_text(encoding='utf-8'))
    sen = json.loads((vdir / 'senaryo.json').read_text(encoding='utf-8'))
    M = sen.get('muzik', {})
    kok = TON[M.get('ton', 'F')]
    tempo = M.get('tempo', 92)
    vurus = 60 / tempo
    olcu = 4 * vurus
    toplam = TL['toplam']
    N = int((toplam + 4) * SR)
    L = np.zeros(N); R = np.zeros(N)

    def koy(x, zaman, pan=0.0, sev=1.0):
        i = int(zaman * SR)
        if i >= N or i < 0:
            return
        x = x[:N - i] * sev
        L[i:i + len(x)] += x * np.sqrt((1 - pan) / 2) * 1.414 / 1.414
        R[i:i + len(x)] += x * np.sqrt((1 + pan) / 2)

    # bölüm sınırlarını ölçülere oturt
    B = TL['bolumler']
    bas_olcu = [round(b['start'] / olcu) for b in B] + [int(np.ceil(toplam / olcu))]
    bas_olcu[0] = 0
    tema_i = 0
    for bi, b in enumerate(B):
        kar = M.get('bolumler', {}).get(b['sahne'], ['oyunbaz', 'hayal', 'sakin', 'yukselis', 'final'][min(bi, 4)])
        yur = YURUYUS[kar]
        o0, o1 = bas_olcu[bi], max(bas_olcu[bi + 1], bas_olcu[bi] + 1)
        son_bolum = bi == len(B) - 1
        for oi, o in enumerate(range(o0, o1)):
            t0 = o * olcu
            if t0 > toplam:
                break
            son_olcu = son_bolum and o == o1 - 1
            d = 0 if son_olcu else yur[oi % len(yur)]
            ak = akor(kok, d)
            bas_nota = ak[0] - 24 if ak[0] - 24 >= 36 else ak[0] - 12
            # --- doku ---
            if kar == 'oyunbaz':
                for v in (0, 2):
                    koy(pizz(bas_nota + (7 if v == 2 else 0), 0.75), t0 + v * vurus, -0.2)
                for v in (1, 3):
                    for n in ak:
                        koy(piyano(n, vurus * 0.35, 0.32), t0 + v * vurus + 0.004 * n % 3, 0.15, 0.7)
                tema = TEMA[tema_i % 8]
                for (bv, sv, dd) in tema:
                    koy(pizz(derece_nota(kok, dd, 1), 0.65), t0 + bv * vurus, 0.25, 0.9)
                    koy(celesta(derece_nota(kok, dd, 1), 0.25), t0 + bv * vurus, -0.3, 0.5)
                tema_i += 1
            elif kar == 'hayal':
                koy(kontrbas(bas_nota, olcu * 0.95, 0.5), t0, -0.1)
                for n in ak:
                    koy(yayli(n, olcu * 0.98, 0.32), t0, (n % 5 - 2) * 0.2)
                tema = TEMA[tema_i % 8]
                for (bv, sv, dd) in tema:
                    koy(piyano(derece_nota(kok, dd, 1), sv * vurus * 0.9, 0.6), t0 + bv * vurus, 0.1)
                tema_i += 1
            elif kar == 'sakin':
                koy(kontrbas(bas_nota, olcu * 0.95, 0.45), t0, -0.1)
                desen = [ak[0] - 12, ak[2] - 12, ak[1], ak[2], ak[0] + 12, ak[2], ak[1], ak[2] - 12]
                for k, n in enumerate(desen):
                    koy(piyano(n, vurus * 0.9, 0.38 + (0.08 if k == 0 else 0)), t0 + k * vurus / 2, -0.15 + 0.04 * k)
                for n in ak[1:]:
                    koy(yayli(n + 12, olcu * 0.98, 0.18, atak=0.9), t0, 0.3)
                for (bv, sv, dd) in TEMA_SAKIN[oi % 8]:
                    koy(yayli(derece_nota(kok, dd, 1), sv * vurus * 0.95, 0.42, ses=3, atak=0.25, birak=0.6), t0 + bv * vurus, 0.2)
            elif kar == 'yukselis':
                guc = 0.6 + 0.4 * oi / max(1, o1 - o0 - 1)
                koy(kontrbas(bas_nota, olcu * 0.95, 0.55 * guc), t0, -0.1)
                desen = [ak[0], ak[1], ak[2], ak[0] + 12] * 2
                for k, n in enumerate(desen):
                    koy(piyano(n, vurus * 0.45, 0.33 * guc), t0 + k * vurus / 2, -0.1)
                for n in ak:
                    koy(yayli(n, olcu * 0.98, 0.3 * guc, atak=0.5), t0, (n % 5 - 2) * 0.2)
                tema = TEMA[tema_i % 8]
                for (bv, sv, dd) in tema:
                    koy(yayli(derece_nota(kok, dd, 1), sv * vurus, 0.45 * guc, ses=4, atak=0.12, birak=0.5), t0 + bv * vurus, 0.2)
                for v in (0, 2):
                    koy(celesta(ak[(oi + v) % 3] + 24, 0.3 * guc), t0 + v * vurus + vurus / 2, 0.4)
                tema_i += 1
            else:  # final
                koy(kontrbas(bas_nota, olcu * (2.5 if son_olcu else 0.95), 0.5), t0, -0.1)
                if son_olcu:
                    for n in ak + [ak[0] + 12]:
                        koy(yayli(n, olcu * 1.8, 0.35, atak=0.6, birak=2.0), t0, (n % 5 - 2) * 0.2)
                        koy(piyano(n, olcu * 2, 0.4), t0 + 0.02 * (n % 4), 0)
                    koy(celesta(ak[2] + 24, 0.4), t0 + vurus, 0.3)
                    koy(celesta(ak[0] + 36, 0.35), t0 + 2 * vurus, -0.3)
                    continue
                for n in ak:
                    koy(yayli(n, olcu * 0.98, 0.3), t0, (n % 5 - 2) * 0.2)
                for v in (0, 2):
                    koy(pizz(bas_nota + 12 + (7 if v else 0), 0.55), t0 + v * vurus, -0.25)
                tema = TEMA[tema_i % 8]
                for (bv, sv, dd) in tema:
                    koy(piyano(derece_nota(kok, dd, 1), sv * vurus * 0.9, 0.6), t0 + bv * vurus, 0.1)
                tema_i += 1

    # oda yankısı (sentetik salon tepkisi)
    n = int(2.4 * SR)
    tt = np.arange(n) / SR
    ir = rng.standard_normal((2, n)) * np.exp(-tt * 2.6)
    sos = butter(1, 5000, 'low', fs=SR, output='sos')
    ir = sosfilt(sos, ir) * 0.08
    ir[:, 0] = 1.0
    ir[:, 1:int(0.012 * SR)] *= 0.2
    Lr = fftconvolve(L, ir[0])[:N] * 1.0
    Rr = fftconvolve(R, ir[1])[:N]
    kuru, islak = 0.75, 0.55
    L2 = L * kuru + (Lr - L) * islak
    R2 = R * kuru + (Rr - R) * islak
    # giriş/çıkış yumuşatma, hafif tiz yumuşatma
    t = np.arange(N) / SR
    zarf = np.clip(t / 1.2, 0, 1) * np.clip((toplam + 1.5 - t) / 2.5, 0, 1)
    sos = butter(2, 11000, 'low', fs=SR, output='sos')
    L2 = sosfilt(sos, L2 * zarf); R2 = sosfilt(sos, R2 * zarf)
    st = np.stack([L2, R2], 1)
    st /= np.max(np.abs(st)) / 0.8
    hedef = vdir / 'ses' / 'muzik.wav'
    import wave
    with wave.open(str(hedef), 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((st * 32767).astype('<i2').tobytes())
    print(f'🎼 {hedef.relative_to(KOK)} ({toplam:.1f} sn, {tempo} bpm, ton {M.get("ton", "F")})')


if __name__ == '__main__':
    main()
