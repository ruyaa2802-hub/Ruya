import os
# Anlatim cekimleri: Piper fahrettin (CC0), parca parca; Whisper ile anlasilirlik secimi
import wave, io, json, re, numpy as np, sherpa_onnx
from scipy.signal import resample_poly
from piper import PiperVoice, SynthesisConfig
D=os.environ.get('MODEL_DIR', os.path.dirname(os.path.abspath(__file__)) + '/modeller') + '/'; v='tr_TR-fahrettin-medium'; pv=PiperVoice.load(f'{D}vits-piper-{v}/{v}.onnx')
A=D+'sherpa-onnx-whisper-small/'
rec=sherpa_onnx.OfflineRecognizer.from_whisper(encoder=A+'small-encoder.int8.onnx',decoder=A+'small-decoder.int8.onnx',tokens=A+'small-tokens.txt',language='tr',task='transcribe',num_threads=4)
def norm(s): s=s.replace('İ','i').replace('I','ı').lower(); return re.sub(r'[^a-zçğıöşü]','',s)
def cer(a,b):
    d=list(range(len(b)+1))
    for i,ca in enumerate(a,1):
        p=d[:]; d[0]=i
        for j,cb in enumerate(b,1): d[j]=min(p[j]+1,d[j-1]+1,p[j-1]+(ca!=cb))
    return d[-1]/max(1,len(b))
CH={
 'h1':'Bir dakika...',
 'h2':'Şu an kiminle konuşuyorsun?',
 'a1':'Aslında bu, beyninin düşüncelerini kelimelere dönüştüren iç konuşma mekanizması.',
 'a2':'Kelimeleri sesli söylemeden de zihninde konuşabiliyorsun.',
 'f1':'Üstelik herkesin iç sesi aynı şekilde çalışmaz.',
 'f2':'Bazıları kelimelerle düşünür,',
 'f3':'bazıları görüntülerle...',
 'f4':'Peki senin zihnindeki ses hiç susuyor mu?',
}
res={}
for k,s in CH.items():
    for i in range(8):
        ls=[1.0,1.08][i%2]; ns=[0.667,0.75,0.85,0.95][i//2]
        b=io.BytesIO()
        with wave.open(b,'wb') as w: pv.synthesize_wav(s,w,syn_config=SynthesisConfig(length_scale=ls,noise_scale=ns,noise_w_scale=0.85))
        b.seek(0)
        with wave.open(b) as w: x=np.frombuffer(w.readframes(w.getnframes()),np.int16)/32768.0; sr=w.getframerate()
        y=resample_poly(x,16000,sr); st=rec.create_stream(); st.accept_waveform(16000,y.astype(np.float32)); rec.decode_stream(st); txt=st.result.text.strip()
        n=f'{k}_{i}'
        with wave.open(os.path.dirname(os.path.abspath(__file__))+f'/takes/{n}.wav','wb') as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes((x*32767).astype(np.int16).tobytes())
        res[n]=dict(cer=round(cer(norm(txt),norm(s)),3),dur=round(len(x)/sr,2),ls=ls,ns=ns,asr=txt)
    best=sorted([(v['cer'],v['dur'],n) for n,v in res.items() if n.startswith(k+'_')])
    print(k, best[0], res[best[0][2]]['asr'])
json.dump(res,open(''+os.path.dirname(os.path.abspath(__file__))+'/takes/stats.json','w'),ensure_ascii=False,indent=0)
