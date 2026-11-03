"""Ücretsiz Türkçe seslendirme: espeak-ng + ffmpeg efektleri (kredi/ücret yok)."""
import subprocess, os, json, sys, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(HERE, "build")
SR = 44100

# konuşmacı -> espeak ayarları + ffmpeg ses filtresi (her karakter ayırt edilebilir olsun)
VOICES = {
    "fincan":  dict(v="tr+f3", p=82, s=205, af="asetrate=22050*1.10,atempo=0.909,equalizer=f=3200:t=q:w=1:g=4,highpass=f=200"),
    "tabak":   dict(v="tr+f1", p=66, s=185, af="asetrate=22050*1.03,atempo=0.971,equalizer=f=2500:t=q:w=1:g=3,highpass=f=160"),
    "cayd":    dict(v="tr+f4", p=48, s=165, af="asetrate=22050*0.96,atempo=1.042,equalizer=f=1800:t=q:w=1:g=3,aecho=0.7:0.5:14:0.25,highpass=f=140"),
    "tencere": dict(v="tr+f5", p=88, s=215, af="asetrate=22050*1.14,atempo=0.877,equalizer=f=3600:t=q:w=1:g=4,highpass=f=240"),
    "kazan":   dict(v="tr+m3", p=14, s=150, af="asetrate=22050*0.84,atempo=1.19,aecho=0.8:0.75:9|17:0.45|0.3,equalizer=f=200:t=q:w=1:g=5,lowpass=f=5200"),
    "evsahibi": dict(v="tr+m1", p=34, s=160, af="asetrate=22050*0.94,atempo=1.064,lowpass=f=1500,highpass=f=120,aecho=0.8:0.7:45|90:0.4|0.25,volume=0.85"),
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
                    "-a", "190", "-g", "1", "-w", raw, text], check=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", raw, "-ar", str(SR), "-ac", "1",
                    "-af", cfg["af"] + f",aresample={SR}", out], check=True)
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
