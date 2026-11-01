"""Turkish narration with the open Coqui GlowTTS+HiFi-GAN model (local, no credits).
Usage: python tools/voice_tr.py <models_dir>
models_dir holds the two extracted Coqui release folders (tts_models--tr--common-voice--glow-tts, vocoder_models--tr--common-voice--hifigan).
Writes voice/scene1..5.wav, tempo-fitted to each scene's time slot.
"""
import sys, os, subprocess, json
from TTS.api import TTS
M = sys.argv[1]
D = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
tr = lambda s: s.replace("I", "ı").replace("İ", "i").lower()
def clean(s):
    s = s.replace("…", ".").replace("Xochimilco", "Sochimilko").replace("'", "")
    return tr(s)
SCENES = [  # text, slot seconds (start->end of the scene's narration window)
 ("Şu sevimli tipe bak! Ama sakın küçümseme… Çünkü bu minik kahraman, kaybettiği bacaklarını yeniden oluşturabiliyor!", 6.6),
 ("Bir bacağını kaybettiğinde vücudu hemen harekete geçiyor! Hücreleri çoğalıyor, yeni dokular gelişiyor ve zamanla yepyeni bir bacak ortaya çıkıyor.", 9.6),
 ("Bilim insanları bu özel hücre yapısına blastema diyor. Bu yapı, yeni bacağın oluşması için gereken dokuların gelişmesine yardımcı oluyor.", 9.4),
 ("Bir de inanılmaz başka bir özelliği var! Aksolotl yetişkin olsa bile larva döneminden kalan dış solungaçlarını koruyor. Yani hayatı boyunca biraz yavru gibi görünüyor!", 8.8),
 ("Üstelik bu eşsiz canlı, yalnızca Meksika'nın Xochimilco bölgesinde doğal olarak yaşıyor ve nesli kritik derecede tehlike altında. Doğanın bu minik mucizesini korumalıyız.", 9.1),
]
p1 = M + "/tts_models--tr--common-voice--glow-tts/tts_models--tr--common-voice--glow-tts/"
p2 = M + "/vocoder_models--tr--common-voice--hifigan/vocoder_models--tr--common-voice--hifigan/"
t = TTS(model_path=p1 + "model_file.pth", config_path=p1 + "config.json", vocoder_path=p2 + "model_file.pth", vocoder_config_path=p2 + "config.json", progress_bar=False)
os.makedirs(D + "/voice", exist_ok=True)
for i, (txt, slot) in enumerate(SCENES, 1):
    raw = f"{D}/voice/_raw{i}.wav"; out = f"{D}/voice/scene{i}.wav"
    t.tts_to_file(text=clean(txt), file_path=raw)
    dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", raw]).decode())
    tempo = max(1.0, min(1.35, dur / slot))
    subprocess.check_call(["ffmpeg", "-loglevel", "error", "-y", "-i", raw, "-af", f"atempo={tempo:.3f},highpass=f=70,loudnorm=I=-18:TP=-2:LRA=7", "-ar", "44100", out])
    os.remove(raw)
    nd = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", out]).decode())
    print(f"scene{i}: raw {dur:.2f}s -> tempo {tempo:.2f} -> {nd:.2f}s (slot {slot}s)", flush=True)
