"""Narration = the user's own voice file (audio/raw/narration_user.wav, 39.2 s, one take),
placed unchanged at 0.3 s on the video timeline → audio/narration.wav (48 kHz mono).
Word timings (faster-whisper medium) → audio/words.json; the film timeline is warped to these
words through scene/timewarp.json (old film time → new video time)."""
import json, subprocess
OFF = 0.3
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', 'raw/narration_user.wav', '-af', f'adelay={int(OFF * 1000)},apad=whole_dur=41.6', '-ar', '48000', '-ac', '1', 'narration.wav'], check=True)
words = [{'w': w, 's': round(a + OFF, 3), 'e': round(b + OFF, 3)} for a, b, w in json.load(open('raw/words_user_raw.json'))]
json.dump(words, open('words.json', 'w'), ensure_ascii=False, indent=0)
print(len(words), 'words')
