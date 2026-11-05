import sherpa_onnx, sys, soundfile as sf, numpy as np
from scipy.signal import resample_poly
D='/tmp/claude-0/dl/sherpa-onnx-whisper-small/'
rec=sherpa_onnx.OfflineRecognizer.from_whisper(encoder=D+'small-encoder.int8.onnx',decoder=D+'small-decoder.int8.onnx',tokens=D+'small-tokens.txt',language='tr',task='transcribe',num_threads=4)
for f in sys.argv[1:]:
    x,sr=sf.read(f)
    if x.ndim>1: x=x.mean(1)
    if sr!=16000: x=resample_poly(x,16000,sr)
    s=rec.create_stream(); s.accept_waveform(16000,x.astype(np.float32)); rec.decode_stream(s)
    print(f.split('/')[-1],'|',s.result.text.strip())
