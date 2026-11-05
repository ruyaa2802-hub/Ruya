import sherpa_onnx, soundfile as sf, numpy as np, json, glob, re, unicodedata
from scipy.signal import resample_poly
D='/tmp/claude-0/dl/sherpa-onnx-whisper-small/'
rec=sherpa_onnx.OfflineRecognizer.from_whisper(encoder=D+'small-encoder.int8.onnx',decoder=D+'small-decoder.int8.onnx',tokens=D+'small-tokens.txt',language='tr',task='transcribe',num_threads=4)
REF={'l1':'ben hiçbir şey sipariş etmedim ki','l2a':'bu fotoğraf','l2b':'benim evim','l3a':'polisi mi aramalıyım','l3b':'yoksa o kapıyı mı açmalıyım','l4':'kararı siz verin'}
def norm(s): s=s.replace('İ','i').replace('I','ı').lower(); return re.sub(r'[^a-zçğıöşü ]','',s).replace(' ','')
def cer(a,b):
    d=list(range(len(b)+1))
    for i,ca in enumerate(a,1):
        p=d[:]; d[0]=i
        for j,cb in enumerate(b,1): d[j]=min(p[j]+1,d[j-1]+1,p[j-1]+(ca!=cb))
    return d[-1]/max(1,len(b))
def asr(f):
    x,sr=sf.read(f); x=resample_poly(x,16000,sr)
    s=rec.create_stream(); s.accept_waveform(16000,x.astype(np.float32)); rec.decode_stream(s); return s.result.text.strip()
st=json.load(open('/tmp/claude-0/k204/takes/stats.json'))
out={}
for n,v in st.items():
    voice,k,i=n.split('_'); txt=asr(f'/tmp/claude-0/k204/takes/{n}.wav'); v['asr']=txt; v['cer']=round(cer(norm(txt),norm(REF[k])),3)
json.dump(st,open('/tmp/claude-0/k204/takes/stats.json','w'),indent=0,ensure_ascii=False)
for voice in ['fahrettin','fettah']:
    print('==',voice, 'ortalama CER', round(np.mean([v['cer'] for n,v in st.items() if n.startswith(voice)]),3))
    for k in REF:
        c=[(v['cer'],-v['rng'],n,v['asr']) for n,v in st.items() if n.startswith(voice+'_'+k+'_')]
        c.sort(); print(' ',k,c[0][2],'CER',c[0][0],'aralik',-c[0][1],'|',c[0][3])
