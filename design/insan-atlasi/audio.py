import numpy as np, wave
SR=44100; DUR=35.0; N=int(SR*DUR); rng=np.random.default_rng(3)
def rd(p):
    w=wave.open(p); return np.frombuffer(w.readframes(w.getnframes()),dtype=np.int16).astype(np.float32)/32768
VO={1:0.9,2:4.95,3:10.5,4:20.4,5:27.4}
voice=np.zeros(N)
for k,s in VO.items():
    d=rd(f'aud/v{k}.wav'); i=int(s*SR); voice[i:i+len(d)]+=d[:N-i]
def put(buf,start,seg):
    i=int(start*SR); j=min(N,i+len(seg)); 
    if i<N: buf[i:j]+=seg[:j-i]
def piano(f,dur,amp):
    n=int(dur*SR); t=np.arange(n)/SR
    s=sum(np.sin(2*np.pi*f*h*t+h)*np.exp(-t*(1.2+h*0.9))/h**1.3 for h in (1,2,3,4,5))
    s*=np.minimum(1,t/0.006)*amp; return s
def pad(f,dur,amp):
    n=int(dur*SR); t=np.arange(n)/SR
    s=sum(np.sin(2*np.pi*f*d*t) for d in (1,1.003,0.997))/3
    s+=0.3*np.sin(2*np.pi*f*2*t)
    e=np.minimum(1,t/1.2)*np.minimum(1,(dur-t)/1.2); return s*e*amp
def bell(f,dur,amp):
    n=int(dur*SR); t=np.arange(n)/SR
    return (np.sin(2*np.pi*f*t)+0.35*np.sin(2*np.pi*f*2.76*t)*np.exp(-t*5))*np.exp(-t*2.2)*np.minimum(1,t/0.004)*amp
music=np.zeros(N)
m=lambda n: 440*2**((n-69)/12)
chords=[[53,57,60,64],[57,60,64,67],[50,53,57,60],[46,50,53,57]]  # Fmaj7 Am7 Dm7 Bbmaj7
beat=60/68; bar=4*beat
for b in range(11):
    ch=chords[b%4]; t0=b*bar
    put(music,t0,pad(m(ch[0]-12),bar+1.2,0.05))
    for n in ch[1:]: put(music,t0,pad(m(n),bar+1.2,0.018))
    arp=[ch[0],ch[1],ch[2],ch[3],ch[2]+12,ch[3],ch[2],ch[1]]
    for i,n in enumerate(arp):
        put(music,t0+i*beat/2,piano(m(n+12),2.2,0.035*(1 if i%2==0 else 0.75)))
mel=[(76,0),(74,2),(72,3),(69,4),(72,6),(74,7),(76,8),(77,10),(76,11),(72,12),(69,14),(72,16),(74,18),(72,19),(69,20),(67,22),(69,24),(72,26),(74,28),(76,30),(72,32),(69,34),(65,36)]
for n,b in mel: put(music,b*beat*1.0+0.5,piano(m(n),2.6,0.045))
music*=np.minimum(1,np.arange(N)/SR/1.5)*np.minimum(1,(DUR-np.arange(N)/SR)/2.0)
# duck under voice
env=np.convolve(np.abs(voice),np.ones(4410)/4410,'same'); duck=1-0.45*np.clip(env/0.05,0,1)
music*=duck
sfx=np.zeros(N)
def noise_band(dur,lo,hi,amp,shape):
    n=int(dur*SR); x=rng.standard_normal(n); X=np.fft.rfft(x); fr=np.fft.rfftfreq(n,1/SR)
    X[(fr<lo)|(fr>hi)]=0; y=np.fft.irfft(X,n); y/=np.max(np.abs(y))+1e-9; t=np.arange(n)/n
    return y*shape(t)*amp
sniff=lambda: noise_band(0.5,1500,6000,0.12,lambda u: np.sin(np.pi*u)**2*(0.6+0.4*u))
put(sfx,0.3,sniff()); put(sfx,20.35,sniff())
whoosh=lambda a=0.08: noise_band(0.9,300,2500,a,lambda u: np.sin(np.pi*u)**3)
for t in (10.0,19.95,26.95): put(sfx,t,whoosh())
for i,f in enumerate([784,988,1175,1568,1976]): put(sfx,4.45+i*0.07,bell(f,1.5,0.035))
# kitchen ambience: simmer bubbles + clock tick
for i in range(70):
    t=4.8+rng.uniform(0,5.5); f=rng.uniform(300,900); n=int(0.05*SR); tt=np.arange(n)/SR
    put(sfx,t,np.sin(2*np.pi*(f+f*3*tt)*tt)*np.exp(-tt*80)*0.02)
put(sfx,4.8,noise_band(5.6,200,1200,0.012,lambda u: np.minimum(1,np.minimum(u*8,(1-u)*8))))
for t in np.arange(5.0,10.2,0.5): put(sfx,t,noise_band(0.03,2000,5000,0.03,lambda u: np.exp(-u*8)))
# brain cues
put(sfx,11.3,bell(660,1.2,0.04)); put(sfx,12.1,noise_band(1.2,500,3000,0.02,lambda u: np.sin(np.pi*u)))
for t,f in ((16.35,880),(17.35,740)):
    for j,mul in enumerate((1,1.5,2)): put(sfx,t+j*0.06,bell(f*mul,1.6,0.04))
# memory bubbles pop
for i,t in enumerate([21.45,22.05,22.65,23.15,23.65]):
    n=int(0.12*SR); tt=np.arange(n)/SR; put(sfx,t,np.sin(2*np.pi*(500+600*tt*8+i*60)*tt)*np.exp(-tt*35)*0.08)
for i,f in enumerate([523,659,784,1047]): put(sfx,24.1+i*0.12,bell(f,2.0,0.03))
# window: soft birds
for t in (28.2,29.0,31.3):
    for j in range(3):
        n=int(0.09*SR); tt=np.arange(n)/SR; put(sfx,t+j*0.13,np.sin(2*np.pi*(3200+900*np.sin(tt*60))*tt)*np.sin(np.pi*tt/0.09)*0.012)
for i,f in enumerate([698,880,1047,1397]): put(sfx,33.4+i*0.1,bell(f,2.2,0.04))
mix=voice*1.0+music+sfx
mix/=max(1,np.max(np.abs(mix))/0.95)
w=wave.open('mix.wav','wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix*32767).astype(np.int16).tobytes()); w.close()
print('ok', round(float(np.sqrt(np.mean(music**2))),4), round(float(np.sqrt(np.mean(voice**2))),4))
