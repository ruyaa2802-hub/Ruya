"""DJ Hamam - Gece Vardiyası: ses karışımı (müzik + efekt + diyalog) ve dudak senkronu verisi."""
import json, subprocess, sys, wave
import numpy as np
SR = 44100; TOTAL = 55.0; N = int(TOTAL*SR)
WAV, OUT, PKG = sys.argv[1], sys.argv[2], sys.argv[3]
rng = np.random.default_rng(11)

# (dosya, başlangıç sn)
LINES = [("01-dj",3.0),("02-dj",11.2),("03-ev",20.3),("04-dj",22.6),("05-ev",25.7),("06-dj",27.0),
         ("07-dj",32.0),("08-dj",36.6),("09-dj",42.0),("10-dj",49.0)]

def load(p):
    with wave.open(p) as w: return np.frombuffer(w.readframes(w.getnframes()),dtype=np.int16).astype(np.float32)/32768
def load_mp3(p):
    raw = subprocess.run(["ffmpeg","-nostdin","-v","error","-i",p,"-f","s16le","-ar",str(SR),"-ac","1","-"],capture_output=True).stdout
    return np.frombuffer(raw,dtype=np.int16).astype(np.float32)/32768
def place(buf,x,t,g=1.0):
    i=int(t*SR)
    if i<0 or i>=N: return
    x=x[:N-i]; buf[i:i+len(x)]+=x*g
def S(*xs):
    m=max(len(x) for x in xs); o=np.zeros(m)
    for x in xs: o[:len(x)]+=x
    return o
def env(n,a=.005,d=.2):
    t=np.arange(n)/SR; return np.minimum(t/a,1)*np.exp(-t/d)
def lp(x,k):
    if k<=1: return x
    y=np.cumsum(x); y=(y[k:]-y[:-k])/k; return np.concatenate([y,np.zeros(k)])
def hp(x,k): return x-lp(x,k)[:len(x)]
def noise(n): return rng.standard_normal(n)

# ---- davul ve sentez
def kick(g=1.0):
    n=int(.28*SR); t=np.arange(n)/SR
    ph=2*np.pi*np.cumsum(48+130*np.exp(-t*28))/SR
    return g*np.sin(ph)*np.exp(-t/.12)
def clap(g=.7):
    n=int(.22*SR); x=hp(noise(n),6)*env(n,.001,.05); x=lp(x,3)[:n]
    return g*x*3.2
def hat(g=.3,d=.03):
    n=int(.12*SR); return g*hp(noise(n),3)*env(n,.0005,d)*2
def ohat(g=.28): return hat(g,.09)
def saw(f,d,g,cut=0):
    n=int(d*SR); t=np.arange(n)/SR; x=np.zeros(n)
    for h in range(1,12): x+=np.sin(2*np.pi*f*h*t)/h
    x=x*g*env(n,.004,d/2.2)
    return lp(x,cut) if cut else x
def sq(f,d,g):
    n=int(d*SR); t=np.arange(n)/SR
    x=np.sign(np.sin(2*np.pi*f*t))*.5+np.sin(2*np.pi*f*t)*.5
    return g*x*env(n,.003,d/2)
def pad(f,d,g):
    n=int(d*SR); t=np.arange(n)/SR
    x=sum(np.sin(2*np.pi*f*r*t+i) for i,r in enumerate([1,1.005,.995,2]))
    return g*x*np.minimum(t/.8,1)*np.minimum((d-t)/.8,1)/4
NOTE={"A":55.0,"C":65.41,"D":73.42,"E":82.41,"F":87.31,"G":98.0}
def mtof(m): return 440*2**((m-69)/12)

def club(t0,t1,bpm=124,intensity=1.0,muffle=0,sw=False):
    """kulüp müziği kesiti [t0,t1) -> stem"""
    stem=np.zeros(N,dtype=np.float32); beat=60/bpm
    bass=[45,45,48,43,45,45,52,43]  # Am
    arp=[69,72,76,72,81,76,72,67]
    i=0; t=t0
    while t<t1-1e-6:
        step=i%16
        if i%4==0: place(stem,kick(1.0*intensity),t)
        if i%4==2: place(stem,ohat(.34*intensity),t)
        if i%4 in(1,3): place(stem,hat(.18*intensity),t)
        if i%8==4: place(stem,clap(.8*intensity),t)
        # bas (çarpıcı saw)
        if i%2==1 or step in(0,6,10):
            f=mtof(bass[(i//2)%8]); place(stem,saw(f,beat*.45,.38*intensity,cut=40),t)
        # arp
        if i%1==0: place(stem,sq(mtof(arp[i%8]+(12 if (i//16)%2 else 0)),beat*.22,.14*intensity),t+beat*.25)
        # akor vuruşları
        if step in(3,7,11,14): 
            for m in (57,60,64): place(stem,saw(mtof(m),beat*.4,.07*intensity,cut=6),t)
        i+=1; t+=beat/2*1.0 if False else beat/2
    # beat/2 = 8'lik adım; kick her 4 adımda yani 2 vuruşta değil -> düzelt: kick her 2 sekizlikte
    return stem
# basit ve doğru: 16'lık adım ızgarası
def club2(t0,t1,bpm=124,gain=1.0,drums=True):
    stem=np.zeros(N,dtype=np.float32); b=60/bpm; st=b/4
    bass=[45,45,57,45,43,43,55,43,48,48,60,48,52,52,64,50]
    arp=[69,72,76,72,81,76,72,67,69,72,76,79,81,79,76,72]
    k=0
    while t0+k*st<t1-1e-6:
        t=t0+k*st; s=k%16
        if drums:
            if s%4==0: place(stem,kick(1.0*gain),t)
            if s%4==2: place(stem,ohat(.30*gain),t)
            if s in(4,12): place(stem,clap(.75*gain),t)
            if s%2==1: place(stem,hat(.14*gain),t)
        if s%2==0 or s in(3,11): place(stem,saw(mtof(bass[s]),st*1.7,.36*gain,cut=30),t)
        place(stem,sq(mtof(arp[s]),st*1.2,.12*gain),t+st*.5*0)
        if s in(0,6,10): 
            for m in (57,60,64): place(stem,saw(mtof(m),st*3,.06*gain,cut=8),t)
        k+=1
    return stem

# ---- müzik bölümleri
music=np.zeros(N,dtype=np.float32)
# intro: karanlık, uzaktan boğuk bas + pad
for k,m in enumerate([45,48,43,41]): place(music,pad(mtof(m+12),4.8,.4),k*2.4)
low=club2(0,9.4,124,.55); low=lp(low,60)[:N]; music+=low*.55         # boğuk, uzaktan
# riser 7.6-9.4
n=int(1.8*SR); r=hp(noise(n),12)*np.linspace(0,1,n)**2*.35; place(music,r,7.6)
for j in range(8): place(music,clap(.4*(.3+j/8)),8.1+j*0.16)
# ana kulüp (9.4 - 19.0)
music+=club2(9.4,19.0,124,1.0)
# 19.0 kayıt durur -> sessizlik (müzik yok)
# kovalamaca: hızlı komik (31.2 - 40.6) 150 bpm, pizzicato
ch=np.zeros(N,dtype=np.float32); b=60/150
for k in range(int((40.6-31.2)/(b/2))+1):
    t=31.2+k*b/2
    if k%2==0: place(ch,kick(.9),t)
    if k%4==2: place(ch,clap(.7),t)
    place(ch,hat(.18),t)
    note=[57,60,64,60,67,64,60,57][k%8]; place(ch,sq(mtof(note+12),b*.3,.16),t)
    place(ch,saw(mtof([45,45,48,43][(k//2)%4]),b*.4,.3,cut=30),t)
music+=ch
# soğutucu (40.6 - 55): boğuk, 48'de açılır
fr=club2(40.6,55.0,124,.9); 
mfull=fr.copy(); mlow=lp(fr,70)[:N]*1.4
xf=np.clip((np.arange(N)/SR-47.5)/3.0,0,1)
music+=mlow*(1-xf)+mfull*xf*.9
# finalde müzik gerçek 'drop' ile 53.6
# ---- efektler
def thump(f=70,d=.12,g=1.0,L=.3):
    n=int(L*SR); t=np.arange(n)/SR
    return g*np.sin(2*np.pi*(f+90*np.exp(-t*40))*t)*np.exp(-t/d)
def click(g=.7):
    n=int(.12*SR); t=np.arange(n)/SR
    return g*(np.sin(2*np.pi*2400*t)+.5*np.sin(2*np.pi*3700*t))*env(n,.0005,.012)
def scratch(d=.35,g=.5,f0=900):
    n=int(d*SR); t=np.arange(n)/SR
    ph=2*np.pi*np.cumsum(f0*(1+2.2*np.sin(2*np.pi*(2.2/d)*t)))/SR
    x=np.sign(np.sin(ph))*.4+hp(noise(n),5)*.5
    return g*x*np.minimum(t/.01,1)*np.minimum((d-t)/.03,1)
def brake(d=.9,g=.6):
    n=int(d*SR); t=np.arange(n)/SR
    ph=2*np.pi*np.cumsum(500*np.exp(-t*3.5))/SR
    return g*(np.sin(ph)+.5*np.sign(np.sin(ph*.5)))*np.exp(-t*2.2)
def boing(f0=250,d=.5,g=.6):
    n=int(d*SR); t=np.arange(n)/SR
    ph=2*np.pi*np.cumsum(f0*(1+.9*np.sin(2*np.pi*9*t)*np.exp(-t*5))*(1+1.2*np.exp(-t*3)))/SR
    return g*np.sin(ph)*np.exp(-t*4.5)
def bonk(g=.7):
    n=int(.35*SR); t=np.arange(n)/SR
    return g*(np.sin(2*np.pi*(300-180*t/.35)*t)+.4*np.sin(2*np.pi*620*t))*np.exp(-t/.09)
def whack(g=.9):  # terlik şaplağı
    n=int(.3*SR)
    return S(g*lp(noise(n),12)*env(n,.0008,.04)*7, thump(110,.07,g*.9,.3)[:n])
def whoosh(d=.45,g=.5,up=True):
    n=int(d*SR); t=np.arange(n)/SR; x=lp(noise(n),int(30-22*(t[-1]>0)*0)+0 or 1)
    f=np.linspace(1,0,n) if not up else np.linspace(0,1,n)
    return g*hp(noise(n),8)*np.sin(np.pi*np.linspace(0,1,n))**1.5*2
def slidewhistle(d=.7,g=.4,up=True):
    n=int(d*SR); t=np.arange(n)/SR
    f=300+1400*(t/d if up else 1-t/d)
    return g*np.sin(2*np.pi*np.cumsum(f)/SR)*np.minimum(t/.02,1)*np.minimum((d-t)/.05,1)
def clatter(g=.5):
    out=np.zeros(int(.8*SR))
    for tt in np.sort(rng.uniform(0,.5,9)):
        n=int(.12*SR); t=np.arange(n)/SR; f=rng.uniform(1800,4200)
        x=g*np.sin(2*np.pi*f*t)*np.exp(-t/.03)
        i=int(tt*SR); out[i:i+n]+=x
    return out
def hum(d,g=.12):
    n=int(d*SR); t=np.arange(n)/SR
    return g*(np.sin(2*np.pi*100*t)+.5*np.sin(2*np.pi*200*t))*np.minimum(t/.5,1)
def buzz(d,g=.08):
    n=int(d*SR); t=np.arange(n)/SR
    return g*(np.sign(np.sin(2*np.pi*120*t))*.5+np.sin(2*np.pi*240*t)*.5)*(0.6+0.4*np.sign(np.sin(2*np.pi*7*t)))
def door(g=.8):
    n=int(.7*SR)
    return S(thump(60,.2,g,.7), g*.5*lp(noise(n),20)*env(n,.001,.1)*6)
def sting(g=.7):
    out=np.zeros(int(1.5*SR)); crash=g*.5*lp(noise(int(SR)),3)*env(int(SR),.001,.3)*3
    for x,t in [(thump(110,.09,g),0),(thump(80,.1,g),.18),(crash,.42)]:
        i=int(t*SR); out[i:i+len(x)]+=x
    return out
def tick(g=.25):
    n=int(.05*SR); return g*np.sin(2*np.pi*1800*np.arange(n)/SR)*env(n,.0003,.008)
def step(g=.5):
    n=int(.18*SR); return S(g*lp(noise(n),30)*env(n,.002,.04)*7, thump(100,.05,.4*g,.2)[:n])

sfx=np.zeros(N,dtype=np.float32)
place(sfx,hum(55,.07),0)                                  # buzdolabı uğultusu
for k in range(int(19)): place(sfx,tick(.18),k*1.0+.3)     # duvar saati
place(sfx,lp(noise(int(.5*SR)),6)*env(int(.5*SR),.02,.2)*.3,.9)  # buzdolabı arkası sürtünme
place(sfx,click(.9),1.95); place(sfx,click(.5),2.12)       # gözlük
place(sfx,thump(150,.04,.6,.2),2.6)                        # kulaklık
for k,tt in enumerate([1.2,1.55]): place(sfx,step(.5),tt)
place(sfx,thump(55,.4,1.0,1.0),9.4)                         # drop
place(sfx,whoosh(.5,.5),9.35)
for tt in(10.2,14.0,16.2,17.0): place(sfx,scratch(.35,.5),tt)
place(sfx,slidewhistle(.5,.35),9.6)
# ışık açılır
place(sfx,click(1.0),19.0); place(sfx,brake(1.0,.8),19.02)
place(sfx,buzz(12.0,.07),19.05)
place(sfx,boing(300,.4,.4),19.2)
# terlik hazırlığı ve kovalamaca
place(sfx,whoosh(.4,.6),30.8); place(sfx,whack(1.0),31.0)
for tt,f in[(32.6,'w'),(33.7,'w'),(35.0,'w'),(37.3,'w'),(38.7,'w')]: place(sfx,whack(1.0),tt)
for tt in(31.5,33.1,34.4,35.6,37.0,38.2,39.4): place(sfx,boing(240+int(tt*7)%90,.35,.35),tt)
place(sfx,slidewhistle(.7,.45,True),34.6); place(sfx,slidewhistle(.5,.4,False),36.1)
place(sfx,clatter(.6),35.8); place(sfx,clatter(.5),37.6)
for tt in(32.4,34.0,35.2,37.8): place(sfx,bonk(.7),tt)
for k in range(8): place(sfx,step(.5),31.5+k*.5)
place(sfx,whoosh(.5,.5),33.0); place(sfx,whoosh(.5,.5),36.2); place(sfx,whoosh(.5,.5),39.0)
# buzdolabı
place(sfx,door(1.0),40.3); place(sfx,hum(14,.12),41.0)
place(sfx,click(.6),44.8)
place(sfx,sting(.8),53.9)
place(sfx,lp(noise(int(.3*SR)),4)*env(int(.3*SR),.01,.1)*.5,54.4)   # kırıntı çıtırtısı

# ---- diyalog + dudak
dlg=np.zeros(N,dtype=np.float32); lips={}; hop=int(SR/30)
for lid,start in LINES:
    x=load(f"{WAV}/{lid}.wav"); place(dlg,x,start)
    fr=len(x)//hop
    r=np.array([np.sqrt(np.mean(x[i*hop:(i+1)*hop]**2)) for i in range(fr)])
    r=np.clip(r/np.percentile(r,92),0,1); r=np.convolve(r,[.25,.5,.25],mode="same")
    lips[lid]={"start":start,"dur":len(x)/SR,"m":[round(float(v),2) for v in r]}
json.dump(lips,open(f"{OUT}/lips.json","w"))
# diyalog etrafında müziği kıs
dabs=np.abs(dlg); duck=1-.62*np.clip(np.convolve(dabs,np.ones(SR//4)/(SR//4),mode="same")*14,0,1)
mix=dlg*1.0+sfx*.55+music*.34*duck
mix=mix/np.max(np.abs(mix))*.9
pcm=(mix*32767).astype(np.int16)
with wave.open(f"{OUT}/master.wav","w") as w:
    w.setnchannels(1);w.setsampwidth(2);w.setframerate(SR);w.writeframes(pcm.tobytes())
print("ok")
