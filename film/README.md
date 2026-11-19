# Güçlü Görünmek — 40 sn sürreal 2D kısa film

Çıktı: `output/guclu_gorunmek.mp4` (1080x1920, 9:16, 24 fps, 40 sn, Türkçe anlatım).

Tamamen ücretsiz araçlarla, kodla üretildi:
- **Görüntü:** `film.py` — Skia ile prosedürel elle çizim animasyonu (iki karede bir "titreyen" kurşun kalem çizgileri, pastel tarama, kâğıt dokusu, paralaks katmanlar). Ana karakter `karakterler/velun` tasarımına dayanır.
- **Ses:** `audio.py` — Piper (çevrimdışı nöral TTS, `tr_TR-dfki-medium`) anlatım + sentezlenmiş yumuşak piyano + rüzgâr, ayak sesi, çatlak, çarpma ve gözyaşı efektleri.
- **Zamanlama:** `timeline.py` görüntü ve sesin ortak zaman çizelgesi.

Yeniden üretmek:
```
pip install skia-python numpy scipy pillow piper-tts   # (skia için libegl1 gerekir)
# l1..l5.wav anlatım satırlarını piper ile üret (bkz. timeline.VO), sonra:
python3 film/film.py video silent.mp4
python3 film/audio.py <ses_klasörü> soundtrack.wav
ffmpeg -i silent.mp4 -i soundtrack.wav -c:v libx264 -crf 23 -c:a aac -shortest output/guclu_gorunmek.mp4
```
