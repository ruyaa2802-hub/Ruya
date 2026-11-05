import wave, os
from piper import PiperVoice, SynthesisConfig
HERE=os.path.dirname(os.path.abspath(__file__))
D=os.environ.get('PIPER_DIR', HERE + '/modeller') + '/'
segs={'l1':'Ben hiçbir şey sipariş etmedim.','l2a':'Bu fotoğraf.','l2b':'Benim evim.','l3a':'Polisi mi aramalıyım?','l3b':'Yoksa o kapıyı mı açmalıyım?','l4':'Kararı siz verin.','w':'Paketi açmamalıydın.'}
v='tr_TR-fettah-medium'
pv=PiperVoice.load(f'{D}vits-piper-{v}/{v}.onnx')
for k,s in segs.items():
  for ls in (1.1,):
    with wave.open(f'{HERE}/tts/{k}.wav','wb') as w:
        pv.synthesize_wav(s,w,syn_config=SynthesisConfig(length_scale=ls if k!='w' else 1.35,noise_scale=0.667,noise_w_scale=0.8))
