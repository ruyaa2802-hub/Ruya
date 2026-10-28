# Deniz Atlarının Şaşırtıcı Dünyası — Erkekler Doğum Yapıyor! 🐠

Pirilumo kanalı için 50 saniyelik dikey (9:16, 1080×1920, 30 fps) 3D animasyonlu bilgi videosu (YouTube Shorts / Instagram Reels).
Sahneler Three.js ile kodla kuruldu ve kare kare render edildi (headless Chromium, `render.cjs`). Ses numpy ile miksajlandı, ffmpeg ile MP4'e çevrildi.

**Çıktı:** `out/denizati_shorts.mp4` · altyazı `out/altyazi_tr.srt` · ses katmanları `out/audio/stem_*.wav` · ses testi `out/ses_testi.m4a`

## Ses — gerçekten üretildi, kaynakları

| Bileşen | Kaynak | Not |
|---|---|---|
| Türkçe anlatım | **vidIQ seslendirme** (ElevenLabs'in çok dilli hazır sesi "Jessica – Playful, Bright, Warm"), metnin tamamı tek seferde | Proje tercihi olan ElevenLabs "Uğur" sesi kullanılamadı: hesapta 60 kredi var, tam metin 917, kısa test 100 kredi istedi. Üretim reddedildi, kredi düşmedi. |
| Fon müziği | **vidIQ müzik üretimi**: özgün, telifsiz parça (marimba, ukulele, hafif perküsyon, çanlar, su altı dokusu, ~112 BPM) | `audio/raw/music_vidiq.wav` |
| Ses efektleri | `audio/make_audio.py` içinde numpy ile sentezlendi | Hepsi kodla üretildi, dış kaynak yok. Efektler: <ul><li>kabarcık (Minnaert rezonansı)</li><li>parıltı ve çan</li><li>yavruların çıkışında "pıt" sesleri</li><li>sahne geçişlerinde hışırtı</li><li>kese kasılması</li><li>su altı ortam sesi</li></ul> |

* **Ses testi (önce yapıldı):** iki ses kısa bir cümleyle denendi: Jessica (kadın) ve Liam (erkek). Kontrol yöntemleri:
  * Türkçe telaffuz: faster-whisper ile metne çevrildi.
  * Tonlama: perde aralığı ölçüldü. Jessica ~10, Liam ~12 yarım ton; monoton değil.

  Liam "atlarında"yı "altlarında" gibi okudu, bu yüzden Jessica seçildi. Ardından anlatım + müzik + efekt + ducking içeren 18 saniyelik test miksi yapıldı (`out/ses_testi.m4a`, −16 LUFS).
* **Akış:** anlatım tek parça üretildi. 0,4 sn'den uzun 5 duraklama 0,3 sn'ye kısaltıldı, sonra perde korunarak %5 hızlandırıldı (`audio/prep_narration.py`). En uzun boşluk ~0,45 sn.
* **Miks:**
  * Müzik konuşma sırasında otomatik olarak −10 dB kısılır, boşluklarda geri yükselir (ducking).
  * Efektler de konuşma altında −5 dB çekilir.
  * Hedef: −16 LUFS, tepe −1 dBFS.
* vidIQ kredisi: 150'den 67 kullanıldı (iki test sesi, tam anlatım, müzik). Kullanım hakları vidIQ'nun koşullarına tabidir. Müzik vidIQ tarafından "original, royalty-free" olarak üretildi.
* Kredi yüklendiğinde anlatım ElevenLabs "Uğur" (veya genç/enerjik başka bir Türkçe ses) ile yeniden üretilebilir. Bunun için yeni dosya `audio/raw/narration_jessica.mp3` yerine konur ve sırasıyla şunlar çalıştırılır:
  1. `prep_narration.py`
  2. whisper ile `words.json`
  3. `subtitles.py`
  4. `make_audio.py`

  Zamanlama değişirse sahne zamanları `main.js` içinde güncellenir.

### Seslendirme metni (zaman kodlu, videodaki konumuyla)

| Süre | Metin |
|---|---|
| 0:00,3 | Deniz altında öyle bir baba var ki, doğum yapan taraf o! Evet, evet, yanlış duymadın! |
| 0:05,9 | Deniz atlarında dişi, yumurtalarını erkeğin karnındaki özel bir keseye bırakıyor. |
| 0:10,6 | Baba adayımız da yumurtaları burada taşıyor, gelişmelerini sağlıyor ve doğum zamanı gelince… minik deniz atlarını dünyaya getiriyor! |
| 0:17,7 | Ama dur, daha bitmedi! Bazı türler tek seferde yüzlerce yavru doğurabiliyor. Düşünsene, koca bir aile bir anda ortaya çıkıyor! |
| 0:25,5 | Peki ya aşk hayatları? Bazı deniz atı türleri, aynı eşle birden fazla üreme döneminde birlikte kalabiliyor. |
| 0:31,8 | Hatta birbirlerini selamlamak için, her gün dans eder gibi hareketler yapabiliyorlar! |
| 0:36,5 | Kısacası deniz altında hem sıra dışı babalar, hem de romantik danslar var. Doğanın sürprizleri gerçekten bitmiyor! |
| 0:43,2 | Peki sence, yavrulara bakma işini başka hangi hayvan babalar üstleniyor? Yorumlara yaz! |

## Sahneler (anlatımın kelime zamanlarına göre)

| Süre | Görüntü |
|---|---|
| 0–5,75 sn | Rengârenk resif. Turuncu erkek deniz atı profilden kameraya döner, kamera hızla yaklaşır. Şaşkın gözler, kabarcık patlaması. **"DOĞUM YAPAN BABA?!"** yazısı belirir. "Evet, evet" sırasında karakter başını sallar, yanakları kızarır ve **"ERKEK DENİZ ATLARI DOĞUM YAPAR!"** yazısı çıkar. |
| 5,75–10,4 sn | Pembe dişi ile erkek karşı karşıya, birlikte hafifçe yükselir. Dişinin yumurta bırakma organından erkeğin kesesine turuncu yumurtalar akar. Yakın çekimde "Yumurtalar" ve "Kuluçka kesesi" etiketleri görünür. |
| 10,4–14 sn | Deniz çayırı: baba kuyruğuyla bir sapa tutunur. Kesesi şişkindir; çevrede balıklar ve kabarcıklar var. **Bilimsel görselleştirme:** kese saydamlaşır, içindeki yumurtalar embriyoya dönüşür. "🥚 Yumurta → Embriyo → Minik deniz atı" aşamaları sırayla yanar. |
| 14–25,4 sn | **Doğum:** kese ritmik olarak kasılır, beden öne doğru seğirir. Her kasılmada büyüyen gruplar halinde minik yavrular dışarı fırlar, toplam 300 yavru (hepsi kodla hareketli). Kamera yavruları takip ederek yükselir. **"YÜZLERCE YAVRU!"** yazısı çıkar. Sonunda kamera geri çekilir: yavru bulutunun ortasında mutlu baba. |
| 25,4–36,4 sn | Dişi yüzerek gelir. İkili yüz yüze, kuyrukları kıvrık, eş zamanlı sallanır. "Bazı türler: aynı eşle birden fazla üreme döneminde birlikte" yazısı görünür. 31,8 sn'den itibaren selamlaşma dansı başlar: ikili ortak bir eksen etrafında döner, renkleri parlar, kalpler yükselir. Kamera yumuşak bir tur atar. "Her gün selamlaşma dansı! 💃" yazısı görünür. |
| 36,4–50 sn | Yavrular ekranın dört köşesinden yüzerek gelir ve anne-babanın etrafında toplanır. "Doğanın sürprizleri" cümlesinde baba kameraya döner: önce şaşkın, sonra mutlu ve kızarık. **"Sıradaki hayvan hangisi? 🐠"**, ardından "Yorumlara yaz! 💬" ve Pirilumo logosu görünür. |

Geçişler siyah ekran kullanmaz: hareket bulanıklıklı kamera savrulması ve "whoosh" sesi kullanılır. Görüntü 2–4 saniyede bir değişir (kamera hareketi, yeni yazı ya da yeni olay).

## Bilimsel notlar

* Deniz atlarında (*Hippocampus*) dişi, yumurtalarını yumurta bırakma organıyla erkeğin karnındaki **kuluçka kesesine** bırakır. Döllenme kesenin içinde olur.
* Erkek embriyoları kesede taşır. Kese embriyolara oksijen sağlar, tuzluluğu düzenler ve bir miktar besin desteği verir.
* Doğumda erkek kas kasılmalarıyla yavruları dışarı çıkarır.
* Gebelik süresi ve yavru sayısı **türe göre** değişir: birkaç düzineden yüzlerceye, bazı türlerde binin üzerine çıkabilir. Bu yüzden anlatımda "bazı türler" denir.
* Bazı türlerde eşler bir üreme mevsimi boyunca, hatta birden fazla dönemde birlikte kalır. Her sabah kısa bir "selamlaşma" yaparlar: yan yana yüzme, renk değiştirme, kuyrukları tutuşturma gibi davranışlar.
* Görselleştirmedeki sadeleştirmeler:
  * Karakterler gerçek deniz atı anatomisini temel alır: at başı, tüp ağız, taç, kemik halkalar, dorsal yüzgeç, kavrayıcı kuyruk, erkekte kese, dişide yumurta bırakma organı.
  * Gözler, göz kapakları ve kızarma çizgi film tarzı eklemelerdir.
  * Yavrular kolay görünsün diye gerçek oranlarına göre daha büyük çizildi.
  * Embriyo aşamaları şematiktir.

## Dosyalar

* `scene/js/seahorse.js` — deniz atı karakteri:
  * Kuyruk ucundan ağız ucuna tek loft yüzeyi, kemik halka dokusu.
  * Çırpınan dorsal ve göğüs yüzgeçleri, taç, sırt çıkıntıları.
  * Göz kapaklı büyük gözler, kızarma, kur parıltısı.
  * Erkekte şişebilen ve kasılabilen kese ile saydam görünüm (embriyolar); dişide yumurta bırakma organı.
  * `bakeBaby()` instanced yavrular üretir.
* `scene/js/reef.js` — resif:
  * Kostik ışıklı kum, kayalar.
  * Dallı, beyin ve masa mercanları, deniz yelpazeleri, tüp süngerler.
  * Sallanan anemonlar ve deniz çayırı.
  * Balık sürüleri, ışık huzmeleri, kabarcıklar, su altı partikülleri.
* `scene/js/main.js` — anlatıma bağlı zaman çizelgesi:
  * kamera yolları;
  * yumurta aktarımı, doğum patlamaları ve yavru bulutu;
  * kalpler, kabarcık patlamaları, ekran yazıları.
* `audio/prep_narration.py`, `audio/words.json` (whisper kelime zamanları), `audio/subtitles.py` (kısa altyazılar, anahtar kelimeler sarı), `audio/make_audio.py` (miks).

## Yeniden üretme

```bash
npm install
python3 audio/prep_narration.py          # anlatımı sıkılaştır + %5 hızlandır → audio/narration.wav
python3 <asr.py> audio/narration.wav audio/words.json   # faster-whisper "small", kelime zamanları
python3 audio/subtitles.py               # scene/subtitles.json + out/altyazi_tr.srt
python3 audio/make_audio.py --test 18    # kısa ses testi → out/audio_test.wav
for p in "0 0 12.5" "1 12.5 25" "2 25 37.5" "3 37.5 50"; do set -- $p
  node render.cjs --format vertical --from $2 --to $3 --out out/parts/part$1.mp4 & done; wait
ffmpeg -f concat -safe 0 -i <(for i in 0 1 2 3; do echo "file '$PWD/out/parts/part$i.mp4'"; done) -c copy out/video_vertical_noaudio.mp4
python3 audio/make_audio.py
ffmpeg -i out/video_vertical_noaudio.mp4 -i out/soundtrack.wav -map 0:v -map 1:a -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p \
  -af "volume=XdB,alimiter=limit=0.891:level=false" -c:a aac -b:a 192k -ar 48000 -movflags +faststart -shortest out/denizati_shorts.mp4
```

Test kareleri: `node render.cjs --format vertical --stills 3,7.8,13.2,20.8,24,30,34,41.5,45`
