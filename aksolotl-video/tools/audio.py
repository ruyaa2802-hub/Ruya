import numpy as np, wave, os
SR=44100; DUR=47.6; N=int(SR*DUR)
rng=np.random.default_rng(11)
D=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def mid(m): return 440.0*2**((m-69)/12)
def tarr(d): return np.arange(int(SR*d))/SR
def place(buf,sig,t,gain=1.0,pan=0.0):
    i=int(t*SR)
    if i>=N or i<0: return
    j=min(N,i+len(sig)); seg=sig[:j-i]*gain
    buf[i:j,0]+=seg*(1-max(pan,0)); buf[i:j,1]+=seg*(1+min(pan,0))
def bandnoise(d,lo,hi):
    n=int(SR*d); x=rng.standard_normal(n); X=np.fft.rfft(x); f=np.fft.rfftfreq(n,1/SR)
    X[(f<lo)|(f>hi)]=0; y=np.fft.irfft(X,n); return y/np.max(np.abs(y)+1e-9)
def pluck(f,d=.5):
    t=tarr(d); e=np.exp(-t/0.14)
    return (np.sin(2*np.pi*f*t)*np.exp(-t/.22)+.45*np.sin(2*np.pi*f*4*t)*e*.6+.2*np.sin(2*np.pi*f*2*t)*np.exp(-t/.3))*np.minimum(1,t/.004)
def bell(f,d=1.4):
    t=tarr(d); idx=2.2*np.exp(-t/.35)
    return np.sin(2*np.pi*f*t+idx*np.sin(2*np.pi*f*3.5*t))*np.exp(-t/(d/4))*np.minimum(1,t/.003)
def pad(freqs,d,att=.5,rel=.6):
    t=tarr(d); s=0
    for f in freqs:
        for det in (-.004,0,.004):
            s=s+np.sin(2*np.pi*f*(1+det)*t)+.25*np.sin(2*np.pi*f*2*(1+det)*t)
    e=np.minimum(1,t/att)*np.minimum(1,(d-t)/rel)
    return s*e/(len(freqs)*3)
def bass(f,d=.55):
    t=tarr(d); return (np.sin(2*np.pi*f*t)+.35*np.sin(2*np.pi*f*2*t))*np.exp(-t/.28)*np.minimum(1,t/.005)
def kick(d=.2):
    t=tarr(d); f=50+60*np.exp(-t/.04); ph=2*np.pi*np.cumsum(f)/SR
    return np.sin(ph)*np.exp(-t/.07)
def shaker(d=.07):
    x=bandnoise(d,5500,15000); t=tarr(d); return x*np.exp(-t/.02)

CH={'C':([48,52,55],[60,64,67,72]),'G':([43,47,50],[55,59,62,67]),'Am':([45,48,52],[57,60,64,69]),'F':([41,45,48],[53,57,60,65]),
    'Em':([40,43,47],[52,55,59,64]),'Dm':([38,41,45],[50,53,57,62])}
segs=[(0,7.2,['C','G','Am'],'play'),(7.2,16.8,['Am','F','C','G'],'curious'),(16.8,26.4,['Am','Em','F','Dm'],'myst'),
      (26.4,36.0,['C','G','Am','F'],'play'),(36.0,45.6,['F','C','G','Am'],'warm'),(45.6,47.6,['C'],'end')]
BAR=2.4; BEAT=.6
music=np.zeros((N,2))
for (a,b,chs,mode) in segs:
    bars=int(round((b-a)/BAR)) if b-a>BAR else 1
    for k in range(max(bars,1)):
        t0=a+k*BAR
        if t0>=b: break
        ch=chs[k%len(chs)]; root,tones=CH[ch]
        L=min(BAR,b-t0)+(.4 if t0+BAR<b else .8)
        if mode in('myst','warm','end'):
            g=.9 if mode!='end' else 1.2
            place(music,pad(tones[:3]+[tones[0]+12] and [mid(m) for m in tones[:3]],L,.7,.8),t0,.16*g)
            place(music,pad([mid(m-12) for m in root[:2]],L,.6,.8),t0,.10)
        else:
            place(music,pad([mid(m) for m in tones[:3]],L,.3,.4),t0,.07)
        # bass
        if mode in('play','curious'):
            for bt in (0,2):
                place(music,bass(mid(root[0]+12-12*0 if False else root[0])),t0+bt*BEAT,.30)
            place(music,bass(mid(root[0]+7-12+12)),t0+3*BEAT,.14)
        elif mode=='warm':
            place(music,bass(mid(root[0]),1.0),t0,.26)
        else:
            place(music,bass(mid(root[0]),1.4),t0,.22)
        # arp / melody
        if mode in('play','curious'):
            pat=[0,1,2,1,3,2,1,2] if mode=='play' else [0,2,1,2,0,3,2,1]
            step=BEAT/2
            for s in range(8):
                tt=t0+s*step
                if tt>=b: break
                f=mid(tones[pat[s]%len(tones)]+ (12 if mode=='curious' and s%4==3 else 0))
                place(music,pluck(f,.5),tt,.20 if mode=='play' else .16,pan=(-.3 if s%2 else .3))
            if mode=='play':
                for s in range(8):
                    place(music,shaker(),t0+s*step+step/2,.06 if s%2 else .03)
                for bt in (0,2): place(music,kick(),t0+bt*BEAT,.30)
        elif mode=='myst':
            for s,m in enumerate([tones[2]+12,tones[1]+12,tones[3],tones[2]+12]):
                tt=t0+s*BEAT*1.0
                if tt<b: place(music,bell(mid(m),1.8),tt,.12,pan=(-.4 if s%2 else .4))
        elif mode=='warm':
            mel={'F':[69,72,69,65],'C':[67,72,76,72],'G':[71,74,71,67],'Am':[69,72,76,72]}[ch]
            for s,m in enumerate(mel):
                tt=t0+s*BEAT
                if tt<b-.3: place(music,bell(mid(m),2.0),tt,.14,pan=(-.25 if s%2 else .25))
        elif mode=='end':
            for s,m in enumerate([72,76,79,84]): place(music,bell(mid(m),2.2),t0+s*.14,.14)
# reverb
ir_n=int(SR*1.7); t=np.arange(ir_n)/SR
ir=rng.standard_normal(ir_n)*np.exp(-t/.42); ir[0]=0
def rev(x,wet=.28):
    out=np.zeros_like(x); M=len(x)+ir_n; Fi=np.fft.rfft(ir,M)
    for c in range(2): out[:,c]=np.fft.irfft(np.fft.rfft(x[:,c],M)*Fi,M)[:len(x)]
    out*=np.max(np.abs(x))/(np.max(np.abs(out))+1e-9)
    return x*(1-wet*.5)+out*wet
music=rev(music,.30)
# --- SFX ---
sfx=np.zeros((N,2))
def bubble(f0):
    d=.16; t=tarr(d); f=f0*(1+2.2*t/d); ph=2*np.pi*np.cumsum(f)/SR
    return np.sin(ph)*np.exp(-t/.05)*np.minimum(1,t/.004)
for i,tt in enumerate([0.8,1.4,2.2,3.0,3.9,5.1,6.2,7.4,9.9,10.4,11.0,12.3,13.5,14.8,16.0,27.5,28.3,29.0,30.4,31.0,32.2,33.5,35.0,36.5,37.8,39.0,40.2,41.5,42.8,44.0,45.6,46.4]):
    place(sfx,bubble(380+((i*97)%360)),tt,.30,pan=((i%5)-2)*.25)
    if i%3==0: place(sfx,bubble(520+((i*53)%300)),tt+.11,.2,pan=((i%5)-2)*-.2)
def whoosh(d,lo=300,hi=2600,rise=True,g=1):
    x=bandnoise(d,lo,hi); t=tarr(d); e=np.sin(np.pi*np.minimum(1,t/d))**2
    if rise: e=e*(0.3+0.7*t/d)
    return x*e
for tt,d,r in [(0.3,.9,True),(2.8,.9,True),(6.6,.9,False),(16.4,1.5,True),(26.4,1.1,False),(26.9,.8,True),(28.7,.9,True),(31.4,1.0,True),(34.4,.9,False),(36.2,.9,True),(43.8,.9,True),(4.5,.5,True)]:
    place(sfx,whoosh(d,300,2400,r),tt,.28)
def pop(f=520):
    d=.14; t=tarr(d); fr=f*(1+1.5*np.exp(-t/.02)); ph=2*np.pi*np.cumsum(fr)/SR
    return np.sin(ph)*np.exp(-t/.05)
for tt in (4.9,8.3,16.0,19.3,32.4,43.8,13.0,37.2,41.0): place(sfx,pop(),tt,.5)
def sparkle(base=1200):
    out=np.zeros(int(SR*1.2))
    for k,m in enumerate([0,4,7,12,16,19]):
        b=bell(base*2**(m/12),.8); s=int(k*.06*SR); out[s:s+len(b)]+=b[:len(out)-s]*(.6**(k*.3))
    return out
for tt in (4.7,5.0,8.3,9.5,12.5,15.9,16.0,19.5,26.0,32.6,44.3,44.9,45.2): place(sfx,sparkle(1100+(int(tt*10)%5)*90),tt,.14,pan=((int(tt*3))%3-1)*.4)
place(sfx,bandnoise(.35,1500,9000)*np.exp(-tarr(.35)/.12),9.4,.4)            # plaster peel
for i in range(16): place(sfx,pop(480+i*26)*.8,10.0+i*.07,.22,pan=((i%4)-1.5)*.3)   # cell pops
for i in range(26): place(sfx,pop(420+i*18)*.8,19.7+i*.07,.2,pan=((i%5)-2)*.25)
for i in range(35): place(sfx,bell(700+i*34,.5),22.3+i*.03,.05,pan=((i%7)-3)*.2)  # differentiation shimmer
def glide(f0,f1,d,g=1):
    t=tarr(d); f=f0+(f1-f0)*(t/d)**1.5; ph=2*np.pi*np.cumsum(f)/SR
    return np.sin(ph)*np.sin(np.pi*np.minimum(1,t/d))**1.5*g
place(sfx,glide(180,700,2.0),13.0,.12)       # limb growing
place(sfx,glide(300,1100,1.8),24.2,.11)      # assemble
place(sfx,glide(200,900,1.4),16.4,.10)       # dive in
place(sfx,glide(900,160,1.0),26.4,.12)       # iris out
for k,m in enumerate([72,76,79,84]): place(sfx,bell(mid(m),2.4),43.8+k*.12,.16)
sfx=rev(sfx,.18)
# write
def norm_write(path,x,peak):
    x=x/ (np.max(np.abs(x))+1e-9)*peak
    y=(x*32767).astype('<i2')
    with wave.open(path,'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(y.tobytes())
os.makedirs(D+'/audio',exist_ok=True)
mp=np.max(np.abs(music)); sp=np.max(np.abs(sfx))
np.save(D+'/audio/_gains.npy',np.array([mp,sp]))
norm_write(D+'/audio/music.wav',music,.8)
norm_write(D+'/audio/sfx.wav',sfx,.8)
print("rms music",np.sqrt((music**2).mean()),"sfx",np.sqrt((sfx**2).mean()),"dur",DUR)
