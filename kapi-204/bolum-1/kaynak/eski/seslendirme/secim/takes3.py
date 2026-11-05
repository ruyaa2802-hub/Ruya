import wave, io, numpy as np, re, sys
import sherpa_onnx, soundfile as sf
from scipy.signal import resample_poly
from piper import PiperVoice, SynthesisConfig
sys.path.insert(0,'/tmp/claude-0/k204')
D='/tmp/claude-0/dl/'; v='tr_TR-fahrettin-medium'; pv=PiperVoice.load(f'{D}vits-piper-{v}/{v}.onnx')
A=D+'sherpa-onnx-whisper-small/'
rec=sherpa_onnx.OfflineRecognizer.from_whisper(encoder=A+'small-encoder.int8.onnx',decoder=A+'small-decoder.int8.onnx',tokens=A+'small-tokens.txt',language='tr',task='transcribe',num_threads=4)
def asr(x,sr):
    y=resample_poly(x,16000,sr); st=rec.create_stream(); st.accept_waveform(16000,y.astype(np.float32)); rec.decode_stream(st); return st.result.text.strip()
import emo
texts=['Kararı, siz verin.','Kararıı... siz verin.','Bu kararı siz verin.','Kararı sizler verin.','Kararı... siz, verin.']
i=0
for tx in texts:
  for ns in (0.667,0.85):
    b=io.BytesIO()
    with wave.open(b,'wb') as w: pv.synthesize_wav(tx,w,syn_config=SynthesisConfig(length_scale=1.25,noise_scale=ns,noise_w_scale=0.9))
    b.seek(0)
    with wave.open(b) as w: x=np.frombuffer(w.readframes(w.getnframes()),np.int16)/32768.0; sr=w.getframerate()
    name=f'fahrettin_l4x_{i}'; i+=1
    with wave.open(f'/tmp/claude-0/k204/takes/{name}.wav','wb') as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes((x*32767).astype(np.int16).tobytes())
    y,_=emo.emote(name, shift=-1.2, rng_k=1.0, trem_hz=5.0, trem_c=20, breath=0.58, stretch=1.1, end_st=-2.5, end_frac=0.4)
    print(name, tx, '| ham:', asr(x,sr), '| islenmis:', asr(y,sr), round(len(y)/sr,2))
