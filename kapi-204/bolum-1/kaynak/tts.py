# Fisilti kaynagi: Piper 'tr_TR-fettah-medium' (CC0). audio.py bunu rastgele-faz STFT ile fisiltiya cevirir.
# Adamin replikleri artik 'tr_TR-fahrettin-medium' (CC0) cekimlerinden emo.py ile uretiliyor (bkz. secim/).
import wave, os
from piper import PiperVoice, SynthesisConfig
HERE = os.path.dirname(os.path.abspath(__file__))
D = os.environ.get('PIPER_DIR', HERE + '/modeller') + '/'
v = 'tr_TR-fettah-medium'
pv = PiperVoice.load(f'{D}vits-piper-{v}/{v}.onnx')
with wave.open(f'{HERE}/tts/w.wav', 'wb') as w:
    pv.synthesize_wav('Paketi açmamalıydın.', w, syn_config=SynthesisConfig(length_scale=1.35, noise_scale=0.667, noise_w_scale=0.8))
