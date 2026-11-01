import os, subprocess, sys
from lines import VOICE, LINES
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'audio', 'lines')
os.makedirs(OUT, exist_ok=True)
only = set(sys.argv[1:])
for code, (who, text) in LINES.items():
    if only and code not in only:
        continue
    v, rate, pitch, semi, chain = VOICE[who]
    mp3 = os.path.join(OUT, code + '.mp3')
    if not os.path.exists(mp3) or only:
        subprocess.run([sys.executable, os.path.join(HERE, 'tts_edge.py'), v, text, mp3, rate, pitch], check=True)
    wav = os.path.join(OUT, code + '.wav')
    af = []
    if semi:
        af.append('rubberband=pitch=%.4f:formant=preserved:pitchq=quality' % (2 ** (semi / 12)))
    af.append(chain)
    af.append('silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02,areverse,'
              'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.06,areverse')
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', mp3, '-af', ','.join(af), '-ar', '44100', '-ac', '1', wav], check=True)
    d = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav], capture_output=True, text=True).stdout.strip()
    print(code, who, d, flush=True)
