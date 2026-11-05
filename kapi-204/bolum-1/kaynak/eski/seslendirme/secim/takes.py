import wave, numpy as np, pyworld as pw, json, io
from piper import PiperVoice, SynthesisConfig
D='/tmp/claude-0/dl/'
# metinler: noktalama ile tonlama yonlendirmesi
segs={
 'l1':'Ben... hiçbir şey sipariş etmedim ki.',
 'l2a':'Bu fotoğraf...',
 'l2b':'Benim evim.',
 'l3a':'Polisi mi aramalıyım?',
 'l3b':'Yoksa... o kapıyı mı açmalıyım?',
 'l4':'Kararı... siz verin.',
}
def synth(pv, text, ls, ns, nw):
    b=io.BytesIO()
    with wave.open(b,'wb') as w: pv.synthesize_wav(text,w,syn_config=SynthesisConfig(length_scale=ls,noise_scale=ns,noise_w_scale=nw))
    b.seek(0)
    with wave.open(b) as w: x=np.frombuffer(w.readframes(w.getnframes()),np.int16)/32768.0; sr=w.getframerate()
    return x, sr
res={}
for v in ['tr_TR-fettah-medium','tr_TR-fahrettin-medium']:
    pv=PiperVoice.load(f'{D}vits-piper-{v}/{v}.onnx')
    for k,s in segs.items():
        for i in range(8):
            ns=[0.667,0.8,0.9,1.0][i%4]; nw=[0.8,1.0][i//4]
            x,sr=synth(pv,s,1.15,ns,nw)
            f0,t=pw.harvest(x.astype(np.float64),sr,f0_floor=60,f0_ceil=400,frame_period=5)
            vf=f0[f0>0]
            st=12*np.log2(vf/np.median(vf)) if len(vf) else np.array([0])
            name=f'{v[6:-7]}_{k}_{i}'
            with wave.open(f'/tmp/claude-0/k204/takes/{name}.wav','wb') as w:
                w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes((x*32767).astype(np.int16).tobytes())
            res[name]=dict(dur=round(len(x)/sr,2), med=round(float(np.median(vf)),1), rng=round(float(np.percentile(st,95)-np.percentile(st,5)),2), ns=ns, nw=nw)
json.dump(res,open('/tmp/claude-0/k204/takes/stats.json','w'),indent=0)
import collections
for v in ['fettah','fahrettin']:
    r=[d['rng'] for n,d in res.items() if n.startswith(v)]
    m=[d['med'] for n,d in res.items() if n.startswith(v)]
    print(v,'ortalama perde araligi (yarim ton):',round(np.mean(r),2),' medyan F0:',round(np.mean(m),1))
