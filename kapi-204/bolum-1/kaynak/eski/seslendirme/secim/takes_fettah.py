import wave, numpy as np, pyworld as pw, json, io, re
import sherpa_onnx, soundfile as sf
from scipy.signal import resample_poly
from piper import PiperVoice, SynthesisConfig
D='/tmp/claude-0/dl/'
v='tr_TR-fettah-medium'; pv=PiperVoice.load(f'{D}vits-piper-{v}/{v}.onnx')
A=D+'sherpa-onnx-whisper-small/'
rec=sherpa_onnx.OfflineRecognizer.from_whisper(encoder=A+'small-encoder.int8.onnx',decoder=A+'small-decoder.int8.onnx',tokens=A+'small-tokens.txt',language='tr',task='transcribe',num_threads=4)
def norm(s): s=s.replace('İ','i').replace('I','ı').lower(); return re.sub(r'[^a-zçğıöşü]','',s)
def cer(a,b):
    d=list(range(len(b)+1))
    for i,ca in enumerate(a,1):
        p=d[:]; d[0]=i
        for j,cb in enumerate(b,1): d[j]=min(p[j]+1,d[j-1]+1,p[j-1]+(ca!=cb))
    return d[-1]/max(1,len(b))
chunks={'l1':'Ben hiçbir şey sipariş etmedim ki.','l2a':'Bu fotoğraf...','l2b':'Benim evim.','l4x':'Kararı, siz verin.','l3a1':'Polisi mi?','l3a2':'Aramalıyım?','l3b1':'Yoksa...','l3b2':'O kapıyı mı açmalıyım?','l4a':'Kararı...','l4b':'Siz verin.'}
res={}
for k,s in chunks.items():
    best=None
    for i in range(12):
        ls=[1.2,1.3,1.4][i%3]; ns=[0.667,0.8,0.9,1.0][i//3]
        b=io.BytesIO()
        with wave.open(b,'wb') as w: pv.synthesize_wav(s,w,syn_config=SynthesisConfig(length_scale=ls,noise_scale=ns,noise_w_scale=0.9))
        b.seek(0)
        with wave.open(b) as w: x=np.frombuffer(w.readframes(w.getnframes()),np.int16)/32768.0; sr=w.getframerate()
        y=resample_poly(x,16000,sr); st=rec.create_stream(); st.accept_waveform(16000,y.astype(np.float32)); rec.decode_stream(st); txt=st.result.text.strip()
        f0,_=pw.harvest(x.astype(np.float64),sr,f0_floor=60,f0_ceil=400,frame_period=5); vf=f0[f0>0]
        rng=float(np.percentile(12*np.log2(vf/np.median(vf)),95)-np.percentile(12*np.log2(vf/np.median(vf)),5)) if len(vf)>5 else 0
        c=cer(norm(txt),norm(s)); name=f'fettah_{k}_{i}'
        with wave.open(f'/tmp/claude-0/k204/takes/{name}.wav','wb') as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes((x*32767).astype(np.int16).tobytes())
        res[name]=dict(cer=round(c,3),rng=round(rng,2),dur=round(len(x)/sr,2),asr=txt,ls=ls,ns=ns)
        if best is None or (c,-rng)<(best[0],-best[1]): best=(c,rng,name,txt)
    print(k,best)
json.dump(res,open('/tmp/claude-0/k204/takes/stats_fettah.json','w'),indent=0,ensure_ascii=False)
