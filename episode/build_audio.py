"""Eşya Meclisi - ses karışımı + dudak senkronu verisi (numpy ile)."""
import json, subprocess, sys, wave
import numpy as np
SR = 44100
rng = np.random.default_rng(7)
WAV = sys.argv[1]            # diyalog wav klasörü
OUT = sys.argv[2]            # çıktı klasörü (assets)

def load(p):
    with wave.open(p) as w:
        d = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    return d

# (id, karakter, başlangıç sn)  -- konuşma sırası senaryodaki gibi
LINES = [("01-terlik",1.4),("02-spor",8.2),("03-topuklu",12.3),("04-cizme",17.6),("05-spor",22.4),
         ("06-cizme",25.9),("07-terlik",28.0),("08-topuklu",33.0),("09-spor",34.4),("10-cizme",35.6),
         ("11-terlik",40.4)]
TOTAL = 47.0
N = int(TOTAL * SR)
def place(buf, x, t, g=1.0):
    i = int(t * SR); x = x[: max(0, N - i)]
    buf[i:i+len(x)] += x * g
def env(n, a=0.005, d=0.2):
    t = np.arange(n) / SR
    return np.minimum(t / a, 1) * np.exp(-t / d)
def lp(x, k):  # basit alçak geçiren
    y = np.cumsum(x); y = (y[k:] - y[:-k]) / k
    return np.concatenate([y, np.zeros(k)])

# ---- efektler
def S(*xs):
    m=max(len(x) for x in xs); o=np.zeros(m)
    for x in xs: o[:len(x)]+=x
    return o
def thump(f=70, d=0.12, g=1.0):
    n = int(0.3*SR); t = np.arange(n)/SR
    return g*np.sin(2*np.pi*(f + 90*np.exp(-t*40))*t)*np.exp(-t/d)
def step(g=0.8):
    n = int(0.25*SR); return S(g*(lp(rng.standard_normal(n), 40)*8*env(n,0.002,0.05)), thump(90,0.05,0.5*g))
def door_slam():
    n = int(0.9*SR); noise = lp(rng.standard_normal(n), 25)*10*env(n,0.001,0.12)
    return S(noise, thump(55,0.25,1.2), 0.25*np.sin(2*np.pi*190*np.arange(n)/SR)*env(n,0.001,0.08))
def latch():
    n = int(0.12*SR); t = np.arange(n)/SR
    return 0.6*(np.sin(2*np.pi*2400*t)+0.5*np.sin(2*np.pi*3700*t))*env(n,0.0005,0.012)
def keys(dur=1.0):
    out = np.zeros(int(dur*SR)+5000)
    for tt in np.arange(0, dur, 0.09):
        f = rng.choice([2800,3300,3900,4400]); n = int(0.15*SR); t=np.arange(n)/SR
        x = 0.35*(np.sin(2*np.pi*f*t)+0.4*np.sin(2*np.pi*f*1.52*t))*env(n,0.0005,0.03)
        out[int(tt*SR):int(tt*SR)+n] += x
    return out
def boing(f0=250, dur=0.5, g=0.7):
    n = int(dur*SR); t = np.arange(n)/SR
    ph = 2*np.pi*np.cumsum(f0*(1+0.9*np.sin(2*np.pi*9*t)*np.exp(-t*5))*(1+1.2*np.exp(-t*3)))/SR
    return g*np.sin(ph)*np.exp(-t*4.5)
def squeak(g=0.5):
    n = int(0.35*SR); t=np.arange(n)/SR
    ph = 2*np.pi*np.cumsum(900+1500*np.sin(np.pi*t/0.35))/SR
    return g*np.sin(ph)*env(n,0.01,0.18)
def creak(g=0.5):
    n = int(1.1*SR); t=np.arange(n)/SR
    ph = 2*np.pi*np.cumsum(180+140*np.sin(2*np.pi*3*t)+60*t)/SR
    return g*(np.sign(np.sin(ph))*0.5+np.sin(ph)*0.5)*np.minimum(t/0.2,1)*np.minimum((1.1-t)/0.3,1)*lp(rng.standard_normal(n)*0.2+1,3)
def sting(g=0.7):  # komik "ba-dum-tss"
    n = int(1.0*SR); crash = g*0.5*lp(rng.standard_normal(n),3)*env(n,0.001,0.3)*3
    out = np.zeros(int(1.5*SR))
    for x, t in [(thump(110,0.09,g),0.0),(thump(80,0.1,g),0.18),(crash,0.42)]:
        i = int(t*SR); out[i:i+len(x)] += x
    return out
def load_mp3(p):
    raw = subprocess.run(["ffmpeg","-v","error","-i",p,"-f","s16le","-ar",str(SR),"-ac","1","-"],capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.int16).astype(np.float32)/32768

sfx = np.zeros(N, dtype=np.float32)
for i, tt in enumerate([0.10,0.42,0.74]): place(sfx, step(0.7 - i*0.15), tt)     # insanlar uzaklaşır
place(sfx, door_slam(), 0.95, 0.9); place(sfx, latch(), 1.05)                      # kapı çarpar
place(sfx, boing(300), 8.15, 0.6)                                                  # spor ayakkabı zıplar
place(sfx, squeak(), 12.25, 0.45)                                                  # topuklu çığlık
place(sfx, load_mp3("/tmp/claude-0/-home-user-Ruya/be416bd8-0c2b-5f3b-884c-e47e308278f5/scratchpad/hfcli/node_modules/hyperframes/dist/skills/media-use/audio/assets/sfx/pop.mp3"), 17.55, 0.7)                                    # çizme araya girer
place(sfx, boing(180, 0.6), 22.35, 0.4)
place(sfx, squeak(0.4), 33.0, 0.6)                                                 # "ne kadar kaba!"
place(sfx, keys(3.2), 34.6, 0.55)                                                  # kapı önünde anahtar sesi
for i, tt in enumerate([35.0, 35.9, 36.8, 37.7]): place(sfx, step(0.5), tt)        # yaklaşan ayak sesi
place(sfx, latch(), 38.6, 1.0); place(sfx, creak(0.6), 38.9)                       # kapı açılır
place(sfx, load_mp3("/tmp/claude-0/-home-user-Ruya/be416bd8-0c2b-5f3b-884c-e47e308278f5/scratchpad/hfcli/node_modules/hyperframes/dist/skills/media-use/audio/assets/sfx/whoosh-short.mp3"), 34.5, 0.5)                            # kamera yaklaşması
place(sfx, load_mp3("/tmp/claude-0/-home-user-Ruya/be416bd8-0c2b-5f3b-884c-e47e308278f5/scratchpad/hfcli/node_modules/hyperframes/dist/skills/media-use/audio/assets/sfx/whoosh-short.mp3"), 39.0, 0.5)
place(sfx, sting(0.8), 44.9, 0.8)                                                  # final
for tt in [45.6, 46.2]: place(sfx, step(0.9), tt)

# ---- müzik: 112 bpm neşeli marimba + pizzicato bas
bpm = 112; beat = 60/bpm
music = np.zeros(N, dtype=np.float32)
def tone(f, d, g):
    n = int(d*SR); t = np.arange(n)/SR
    return g*(np.sin(2*np.pi*f*t)+0.3*np.sin(2*np.pi*f*4*t)*np.exp(-t*20))*env(n,0.003,d/2.5)
C = {"C":261.63,"D":293.66,"E":329.63,"F":349.23,"G":392.0,"A":440.0}
bass_prog = [65.41,87.31,98.0,65.41]; mel = ["E","G","E","D","C","D","E","G"]
for bar in range(int(TOTAL/(beat*4))+1):
    b0 = bar*beat*4; root = bass_prog[bar % 4]
    for k, off in enumerate([0,1.5,2,3.5]):
        place(music, tone(root*(2 if k%2 else 1), 0.3, 0.5), b0+off*beat)
    for k in range(8):
        f = C[mel[(k+bar*3) % 8]] * (1 if (bar%2==0) else 1.5 if k%3==0 else 1)
        place(music, tone(f, 0.35, 0.28), b0+k*beat/2)
    for k in range(8):
        n = int(0.05*SR); place(music, 0.05*rng.standard_normal(n)*env(n,0.001,0.015), b0+k*beat/2+beat/4)
music *= np.minimum(np.arange(N)/SR/1.0,1)*np.minimum((TOTAL-np.arange(N)/SR)/1.5,1)

# ---- diyalog + dudak senkronu
dlg = np.zeros(N, dtype=np.float32); lips = {}
hop = int(SR/30)
for lid, start in LINES:
    x = load(f"{WAV}/{lid}.wav"); place(dlg, x, start)
    frames = len(x)//hop
    r = np.array([np.sqrt(np.mean(x[i*hop:(i+1)*hop]**2)) for i in range(frames)])
    r = r/np.percentile(r, 92); r = np.clip(r,0,1)
    r = np.convolve(r, [0.25,0.5,0.25], mode="same")
    lips[lid] = {"start": start, "dur": len(x)/SR, "m": [round(float(v),2) for v in r]}
json.dump(lips, open(f"{OUT}/lips.json","w"))

mix = dlg*1.0 + sfx*0.45 + music*0.16
# diyalog üstünde müzik kısılsın (basit ducking)
duck = 1 - 0.5*np.clip(np.convolve(np.abs(dlg), np.ones(SR//5)/(SR//5), mode="same")*12, 0, 1)
mix = dlg + sfx*0.45 + music*0.16*duck
mix = mix/np.max(np.abs(mix))*0.89
pcm = (mix*32767).astype(np.int16)
with wave.open(f"{OUT}/master.wav","w") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print("ok", TOTAL)
