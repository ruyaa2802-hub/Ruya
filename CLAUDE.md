# Ruya — video projeleri için kalıcı tercihler

## Türkçe anlatıcı sesi (onaylandı — sonraki videolarda da kullan)

- Servis: ElevenLabs (`creative_generate_speech`)
- Ses: **Uğur – Turkish Documentary Narrator**
- `voice_id`: `fSruVisKJEvQqmgx0yZT`
- Model: `eleven_v4` (duygu etiketleri destekli: `[warmly]`, `[curious]`, `[excited]`, `[happy]`, `[pause]`, `[short pause]`)
- Ton: sıcak, merak uyandırıcı, belgesel/eğitim tarzı; cümleleri acele ettirme.
- İş akışı: metnin tamamını tek seferde üret (tutarlı ton), sonra duraklamalardan
  (`ffmpeg silencedetect`, -38 dB / 0,28 sn) cümlelere bölüp sahnelere yerleştir.
  Örnek: `ari-dansi/audio/make_audio.py`.

## Yayın formatları

- Yatay: 1280×720 (veya 1920×1080), 30 fps.
- Shorts/Reels: dikey 1080×1920, 30 fps; Türkçe **küçük ama okunur** gömülü altyazı
  (Inter yarı kalın, ~42 px, yarı saydam koyu kutu), alt arayüz alanının (~alt %20) üstünde.
- Ses: miks −16 LUFS, tepe −1 dBFS; anlatım altında müzik −10 dB kısılır.
