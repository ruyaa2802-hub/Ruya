import numpy as np, sys
sys.path.insert(0,'/tmp/claude-0/k204')
import sherpa_onnx
from scipy.signal import resample_poly
import emo
A='/tmp/claude-0/dl/sherpa-onnx-whisper-small/'
rec=sherpa_onnx.OfflineRecognizer.from_whisper(encoder=A+'small-encoder.int8.onnx',decoder=A+'small-decoder.int8.onnx',tokens=A+'small-tokens.txt',language='tr',task='transcribe',num_threads=4)
def asr(x,sr):
    y=resample_poly(x,16000,sr); st=rec.create_stream(); st.accept_waveform(16000,y.astype(np.float32)); rec.decode_stream(st); return st.result.text.strip()
for i in range(8):
    y,sr=emo.emote(f'fahrettin_l1_{i}', shift=-0.6, rng_k=1.15, breath=0.3, stretch=1.04, end_st=-1.8, jitter_c=10)
    print(i, asr(y,sr), round(len(y)/sr,2))
