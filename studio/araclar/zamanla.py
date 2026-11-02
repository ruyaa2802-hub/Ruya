#!/usr/bin/env python3
"""Cümle zamanlarını üretir -> <video>/zamanlama.json

* Ses dosyası yoksa: okuma hızına göre TAHMİNİ zamanlama (sessiz önizleme için).
* Ses dosyası varsa: FFmpeg sessizlik analiziyle cümle sınırlarını bulur (HİZALANMIŞ).
  Hiçbir harici servis ya da API kullanmaz.

Kullanım: python3 studio/araclar/zamanla.py videolar/01-gidiklama
"""
import json, re, subprocess, sys
from pathlib import Path

HIZ = 14.5        # harf/sn (bu kanalın ElevenLabs sesinden ölçüldü)
DURAKLAMA = 0.6   # cümleler arası tahmini sessizlik (sn)
GIRIS, KUYRUK = 0.3, 0.9


def ses_bul(klasor: Path):
    for ad in ("seslendirme.mp3", "seslendirme.wav", "seslendirme.m4a", "seslendirme.aac"):
        p = klasor / "ses" / ad
        if p.exists():
            return p
    return None


def cumleleri_oku(klasor: Path):
    satirlar = (klasor / "seslendirme.txt").read_text(encoding="utf-8").splitlines()
    cumleler = []
    for s in satirlar:
        s = s.strip()
        if not s or s.startswith("#"):
            continue
        temiz = re.sub(r"\[[^\]]*\]", "", s)          # ElevenLabs etiketleri: [curious] vb.
        temiz = re.sub(r"\s+", " ", temiz).strip()
        cumleler.append(temiz)
    return cumleler


def harf(s):
    return len(re.sub(r"[^\w]", "", s))


def sure_olc(ses):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(ses)],
                       capture_output=True, text=True, check=True)
    return float(r.stdout.strip())


def sessizlikler(ses, esik="-38dB", en_az=0.12):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(ses), "-af", f"silencedetect=n={esik}:d={en_az}", "-f", "null", "-"],
                       capture_output=True, text=True)
    bas = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", r.stderr)]
    son = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", r.stderr)]
    return list(zip(bas, son))


def tahmini(cumleler):
    t, cikti = GIRIS, []
    for c in cumleler:
        d = harf(c) / HIZ
        cikti.append([t, t + d])
        t += d + DURAKLAMA
    return cikti, t - DURAKLAMA + KUYRUK


def hizala(cumleler, ses):
    toplam = sure_olc(ses)
    sess = sessizlikler(ses)
    konusma_bas = sess[0][1] if sess and sess[0][0] < 0.05 else 0.0
    konusma_son = sess[-1][0] if sess and sess[-1][1] > toplam - 0.05 else toplam
    ic = [(a, b) for a, b in sess if a > konusma_bas + 0.05 and b < konusma_son - 0.05]
    n = len(cumleler)
    if n == 1:
        return [[konusma_bas, konusma_son]], toplam
    if len(ic) < n - 1:
        raise SystemExit(f"Hizalama başarısız: {n} cümle için en az {n-1} duraklama gerekli, {len(ic)} bulundu.")

    # Beklenen sınırlar: cümle uzunluklarıyla orantılı
    w = [harf(c) + 6 for c in cumleler]
    top, birikim, beklenen = sum(w), 0, []
    for k in range(n - 1):
        birikim += w[k]
        beklenen.append(konusma_bas + (konusma_son - konusma_bas) * birikim / top)

    # Dinamik programlama: her sınıra artan sırada bir duraklama ata.
    # Maliyet = beklenen konumdan uzaklık - uzun duraklama ödülü
    m = len(ic)
    orta = [(a + b) / 2 for a, b in ic]
    odul = [2.0 * min(b - a, 1.0) for a, b in ic]
    INF = float("inf")
    dp = [[INF] * m for _ in range(n - 1)]
    geri = [[-1] * m for _ in range(n - 1)]
    for j in range(m):
        dp[0][j] = abs(orta[j] - beklenen[0]) - odul[j]
    for k in range(1, n - 1):
        en_iyi, en_iyi_j = INF, -1
        for j in range(m):
            if j - 1 >= 0 and dp[k - 1][j - 1] < en_iyi:
                en_iyi, en_iyi_j = dp[k - 1][j - 1], j - 1
            if en_iyi < INF:
                dp[k][j] = en_iyi + abs(orta[j] - beklenen[k]) - odul[j]
                geri[k][j] = en_iyi_j
    j = min(range(m), key=lambda x: dp[n - 2][x])
    secim = [0] * (n - 1)
    for k in range(n - 2, -1, -1):
        secim[k] = j
        j = geri[k][j]

    sinir = [ic[j] for j in secim]
    zaman = []
    for k in range(n):
        bas = konusma_bas if k == 0 else sinir[k - 1][1]
        son = konusma_son if k == n - 1 else sinir[k][0]
        zaman.append([bas, son])
    return zaman, toplam


def main():
    klasor = Path(sys.argv[1])
    cumleler = cumleleri_oku(klasor)
    ses = None if "--tahmini" in sys.argv else ses_bul(klasor)
    if ses:
        zaman, sure = hizala(cumleler, ses)
        kaynak = "hizalanmis"
    else:
        zaman, sure = tahmini(cumleler)
        kaynak = "tahmini"
    veri = {
        "kaynak": kaynak,
        "ses": str(ses.relative_to(klasor)) if ses else None,
        "sure": round(sure, 3),
        "cumleler": [{"id": i + 1, "metin": c, "bas": round(a, 3), "son": round(b, 3)} for i, (c, (a, b)) in enumerate(zip(cumleler, zaman))],
    }
    (klasor / "zamanlama.json").write_text(json.dumps(veri, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"zamanlama: {kaynak}, {len(cumleler)} cümle, {sure:.2f} sn")
    for c in veri["cumleler"]:
        print(f"  {c['id']:>2}  {c['bas']:6.2f} – {c['son']:6.2f}  {c['metin'][:60]}")


if __name__ == "__main__":
    main()
