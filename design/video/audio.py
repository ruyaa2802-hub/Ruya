import numpy as np, json, wave, subprocess
SR=44100; DUR=30.0; FPS=24
T=json.load(open('timeline.json'))
def readwav(p):
    w=wave.open(p); n=w.getnframes(); d=np.frombuffer(w.readframes(n),dtype=np.int16).astype(np.float32)/32768; return d
mix=np.zeros(int(SR*DUR)); voice=np.zeros_like(mix)
env={}
for k,(start,who) in T['lines'].items():
    d=readwav(f'aud/l{k}.wav'); i=int(start*SR); voice[i:i+len(d)]+=d[:len(voice)-i]
    hop=SR//FPS; frames=[float(np.sqrt(np.mean(d[j:j+hop]**2))) for j in range(0,len(d),hop)]
    m=max(frames); env[k]={'start':start,'who':who,'env':[round(f/m,3) for f in frames]}
json.dump(env,open('lipsync.json','w'))
t=np.arange(len(mix))/SR
rng=np.random.default_rng(1)
def note(f,start,dur,amp,kind='pad'):
    i0=int(start*SR); n=int(dur*SR); tt=np.arange(n)/SR
    if kind=='pad':
        s=sum(np.sin(2*np.pi*f*h*tt+0.3*h)/h**1.5 for h in (1,2,3,4))
        e=np.minimum(1,tt/0.6)*np.minimum(1,(dur-tt)/0.8)
    elif kind=='pluck':
        s=sum(np.sin(2*np.pi*f*h*tt)*np.exp(-tt*(2+h*1.5))/h for h in (1,2,3,5))
        e=np.minimum(1,tt/0.005)
    elif kind=='bell':
        s=np.sin(2*np.pi*f*tt)+0.4*np.sin(2*np.pi*f*2.76*tt)*np.exp(-tt*4)
        e=np.exp(-tt*2.5)*np.minimum(1,tt/0.003)
    seg=s*e*amp; j=min(len(mix),i0+n); return i0,seg[:j-i0]
music=np.zeros_like(mix)
def add(buf,r):
    i0,seg=r; buf[i0:i0+len(seg)]+=seg
# romantic music 0 -> cut
cut=T['musicCut']
chords=[[261.6,329.6,392.0],[220.0,261.6,329.6],[174.6,220.0,261.6],[196.0,246.9,293.7]]
beat=0.75
for bar in range(8):
    ch=chords[bar%4]; st=bar*4*beat
    if st>cut: break
    for f in ch: add(music,note(f/2,st,4*beat+0.6,0.05,'pad'))
    add(music,note(ch[0]/4,st,4*beat,0.07,'pad'))
    for k,f in enumerate([ch[0],ch[1],ch[2],ch[1]*2,ch[2],ch[1],ch[0]*2,ch[2]]):
        add(music,note(f*2,st+k*beat/2,1.5,0.06,'pluck'))
# melody (bells)
mel=[(784,0),(659,1),(698,2),(784,3),(880,4),(784,6),(659,8),(587,10),(659,11),(698,12),(659,14),(523,16),(587,18),(659,19)]
for f,b in mel:
    if b*beat<cut: add(music,note(f,b*beat,1.8,0.05,'bell'))
fadein=np.minimum(1,t/1.0); music*=fadein
music[int(cut*SR):]=0
mix+=music
# record scratch at cut
n=int(0.45*SR); tt=np.arange(n)/SR
sc=rng.standard_normal(n)*0.25*np.exp(-tt*6)
sweep=np.sin(2*np.pi*np.cumsum(900*np.exp(-tt*5)+120)/SR)*0.35*np.exp(-tt*5)
i=int((cut-0.05)*SR); mix[i:i+n]+=sc*0.6+sweep
# sparkle chime when love starts
for k,f in enumerate([1568,1760,2093,2349,2637,3136]):
    add(mix,note(f,T['love']+k*0.06,1.2,0.05,'bell'))
# hand whoosh
def noise_sweep(start,dur,f0,f1,amp):
    n=int(dur*SR); x=rng.standard_normal(n); y=np.zeros(n); a=0
    fr=np.linspace(f0,f1,n)
    for j in range(1,n):
        c=fr[j]/SR*6.28; a=min(0.99,c); y[j]=y[j-1]+a*(x[j]-y[j-1])
    e=np.sin(np.pi*np.arange(n)/n)**2; i=int(start*SR); mix[i:i+n]+=y*e*amp
noise_sweep(T['handIn'],1.0,300,2500,0.5)
noise_sweep(T['handLift'],0.6,2500,500,0.45)
# basket clatter
for k in range(9):
    st=T['drop']+k*0.035+rng.uniform(0,0.03); n=int(0.12*SR); tt=np.arange(n)/SR
    f=rng.uniform(400,1500)
    s=(np.sin(2*np.pi*f*tt)+0.6*rng.standard_normal(n))*np.exp(-tt*40)*0.25*(1-k/12)
    i=int(st*SR); mix[i:i+n]+=s
# soft thuds of the strawberries
for st in (T['drop'], T['drop']+0.08):
    n=int(0.2*SR); tt=np.arange(n)/SR; i=int(st*SR); mix[i:i+n]+=np.sin(2*np.pi*(90+60*np.exp(-tt*20))*tt)*np.exp(-tt*18)*0.5
# hops
for st in T['hops']:
    n=int(0.15*SR); tt=np.arange(n)/SR; i=int(st*SR); mix[i:i+n]+=np.sin(2*np.pi*(180+200*tt)*tt)*np.exp(-tt*25)*0.18
# grab squish
n=int(0.25*SR); tt=np.arange(n)/SR; i=int(T['grab']*SR); mix[i:i+n]+=rng.standard_normal(n)*np.exp(-tt*25)*0.2
# ending sting (comic pizzicato) at freeze
for k,f in enumerate([392,523.3]):
    add(mix,note(f,T['freeze']+k*0.18,0.6,0.25,'pluck'))
# store ambience
amb=rng.standard_normal(len(mix)); y=np.convolve(amb,np.ones(60)/60,'same')*0.06
mix+=y
for st in (6.5,12.2,21.8):  # distant scanner beeps
    add(mix,note(2400,st,0.12,0.012,'pluck'))
mix+=voice*0.95
mix/=max(1,np.max(np.abs(mix))/0.95)
out=(mix*32767).astype(np.int16)
w=wave.open('mix.wav','wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(out.tobytes()); w.close()
print('ok')
