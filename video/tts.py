"""Ücretsiz Türkçe seslendirme: espeak-ng + ffmpeg efektleri (kredi/ücret yok)."""
import subprocess, os, json, sys, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(HERE, "build")
SR = 44100

# konuşmacı -> espeak ayarları + ffmpeg ses filtresi (her karakter ayırt edilebilir olsun)
VOICES = {
    # MBROLA (mb-tr1 erkek / mb-tr2 kadın) – espeak'in kendi sesinden çok daha doğal; kredi/ücret yok
    "fincan":  dict(v="mb-tr2", p=72, s=215, af="asetrate=44100*1.12,atempo=0.893,equalizer=f=3000:t=q:w=1:g=3,highpass=f=180"),
    "tabak":   dict(v="mb-tr2", p=56, s=205, af="asetrate=44100*1.04,atempo=0.962,equalizer=f=2400:t=q:w=1:g=2,highpass=f=150"),
    "cayd":    dict(v="mb-tr2", p=40, s=190, af="asetrate=44100*0.97,atempo=1.031,equalizer=f=1800:t=q:w=1:g=2,aecho=0.7:0.5:14:0.2,highpass=f=130"),
    "tencere": dict(v="mb-tr2", p=78, s=225, af="asetrate=44100*1.17,atempo=0.855,equalizer=f=3400:t=q:w=1:g=3,highpass=f=220"),
    "kazan":   dict(v="mb-tr1", p=22, s=180, af="asetrate=44100*0.80,atempo=1.25,aecho=0.8:0.7:9|17:0.4|0.25,equalizer=f=180:t=q:w=1:g=4,lowpass=f=5500"),
    "evsahibi": dict(v="mb-tr1", p=44, s=195, af="asetrate=44100*0.97,atempo=1.031,lowpass=f=1600,highpass=f=120,aecho=0.8:0.7:45|90:0.35|0.2,volume=0.9"),
}

# id, konuşmacı, metin
LINES = [
    ("L1",  "fincan",   "ŞİMDİ SAKİN OLUN! BİZİ SATMAYA KARAR VERMİŞLER!"),
    ("L2",  "tabak",    "NE?! BEN DAHA AMBALAJIMIN HAKKINI VEREMEDİM!"),
    ("L3",  "cayd",     "Kim satılıyormuş? Benim altım daha çizilmedi bile!"),
    ("L4",  "kazan",    "SATIYORLARSA BENİ DE SATSINLAR! ZATEN BU EVDE DEĞERİMİ BİLEN YOK!"),
    ("L5",  "fincan",   "Misafir geliyormuş! Aşağıda duydum!"),
    ("L6a", "tabak",    "Misafir mi?!"),
    ("L6b", "tencere",  "Ay, hazırım hazırım!"),
    ("L6c", "cayd",     "O dedikoducu komşu mu?"),
    ("L7",  "kazan",    "Hmph! Kullanılacak olan benim!"),
    ("L8",  "evsahibi", "Yarın misafirlere yemek yapalım, şu dolaptaki takımları indirelim."),
    ("L9",  "fincan",   "AYYY! KENDİMİ TOPARLAYAMIYORUM!"),
    ("L10", "kazan",    "Sonunda! Yıllardır beklediğim gün geldi!"),
    ("L11", "evsahibi", "Kazanı da komşuya verelim!"),
]


def read_wav(path):
    with wave.open(path, "rb") as w:
        assert w.getnchannels() == 1
        sr = w.getframerate()
        data = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0
    return sr, data


def trim(x, thr=0.01):
    idx = np.where(np.abs(x) > thr)[0]
    if len(idx) == 0:
        return x
    return x[max(0, idx[0] - 200): idx[-1] + 400]


def make_line(lid, spk, text, speed_mul=1.0):
    cfg = VOICES[spk]
    raw = os.path.join(BUILD, f"{lid}_raw.wav")
    out = os.path.join(BUILD, f"{lid}.wav")
    subprocess.run(["espeak-ng", "-v", cfg["v"], "-p", str(cfg["p"]), "-s", str(int(cfg["s"] * speed_mul)),
                    "-a", "190", "-w", raw, text], check=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", raw, "-ar", str(SR), "-ac", "1",
                    "-af", "aresample=44100," + cfg["af"] + f",aresample={SR}", out], check=True)
    sr, x = read_wav(out)
    x = trim(x)
    x = x / (np.sqrt(np.mean(x ** 2)) + 1e-9) * 0.11   # eşit ses seviyesi (RMS)
    return x


if __name__ == "__main__":
    mul = float(sys.argv[1]) if len(sys.argv) > 1 else 1.0
    info = {}
    for lid, spk, text in LINES:
        x = make_line(lid, spk, text, mul)
        np.save(os.path.join(BUILD, f"{lid}.npy"), x)
        info[lid] = dict(spk=spk, text=text, dur=len(x) / SR)
        print(f"{lid:4s} {spk:9s} {len(x)/SR:5.2f}s  {text}")
    json.dump(info, open(os.path.join(BUILD, "lines.json"), "w"), ensure_ascii=False, indent=1)
    print("TOPLAM konuşma:", round(sum(v["dur"] for v in info.values()), 2), "s")
