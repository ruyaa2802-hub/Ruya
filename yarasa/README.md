# Yarasalar Karanlıkta Nasıl Yolunu Buluyor? 🦇

Pirilumo kanalı için 45 saniyelik dikey (9:16, 1080×1920, 30 fps) YouTube Shorts animasyonu.
Üretim yöntemi `ari-dansi` ve `ahtapot` projeleriyle aynı: Three.js sahnesi → kare kare render (headless Chromium) → ffmpeg;
anlatıcı ElevenLabs "Uğur – Turkish Documentary Narrator"; ses tasarımı numpy ile.

**Çıktı:** `out/yarasa-ekolokasyon_shorts.mp4` · altyazı dosyası `out/altyazi_tr.srt` · ses katmanları `out/audio/stem_*.wav`

## Sahneler

| Süre | Sahne | Görüntü | Anlatım |
|---|---|---|---|
| 0–5 sn | 1 · Karanlık mağara | Kamera tünelde yavaşça ilerler; ışık huzmesi, sarkıt/dikitler. Yarasa karanlığın içinden hızla kameraya doğru uçar | "Göz gözü görmeyen bir karanlıkta, bu yarasa küçücük bir böceği nasıl bulabiliyor?" |
| 5–12 sn | 2 · Yakın plan | Kamera yarasanın önünde geri geri giderek yüzüne yaklaşır; ağız her açıldığında kısa, ince ses halkaları çıkar. **"Ultrason"** notu | "Sırrı, bizim duyamadığımız kadar yüksek frekanslı seslerde: ultrasonlarda!" |
| 12–22 sn | 3 · Yankı (ağır çekim) | Kamera yana döner (yan takip). Mavi ses dalgası güveye ulaşır; güvede küçük bir parlama, oradan **turuncu yankı** yarasaya geri döner, kulaklar oynar. Gösterge: "Gönderilen ses / Yankı" | "Yarasa ses gönderiyor. Ses bir engele çarpıp geri dönüyor. Yarasa da yankıyı dinliyor." |
| 22–33 sn | 4 · Av | Kamera arkadan takip eder. Darbe sıklığı artar, yankılar giderek daha kısa sürede döner; güve yana kaçar, yeni konumdan gelen yankıdan sonra yarasa dönüp kanatlarını toplar ve güveyi havada yakalar (≈30 sn). "Yankı süresi → uzaklık", "Yankıdaki değişim → yön, hareket" | "Yankının ne kadar sürede döndüğünü ve nasıl değiştiğini analiz ederek, nesnenin uzaklığını, yönünü ve hareketini anlayabiliyor." |
| 33–45 sn | 5 · Ses haritası | Kamera yükselip geniş plana geçer; yarasa büyük salondaki sütunların arasından geçer. Her ses darbesi kayaların üzerinde ince bir ışık bandı gibi ilerleyerek çevreyi "çizer"; yarasa karanlıkta uzaklaşır. Son yazı: **"Doğa, düşündüğümüzden çok daha şaşırtıcı. 🦇"** | "Yani yarasa, çevresinin seslerden oluşan bir haritasını çıkarıyor. Karanlık onun için tamamen kör olmak demek değil!" |

Tüm sahne geçişleri kesmesiz: kamera yarasanın etrafında sürekli yörüngede döner, başta ve sonda dünyaya sabit hareketlere yumuşakça bağlanır.

## Bilimsel notlar

* **Ekolokasyon:** Yarasa ses darbesi yayar ve nesnelerden geri dönen yankıları dinler.
  * **Yankının gecikmesi** → nesnenin uzaklığı. Videoda güve yaklaştıkça yankılar daha kısa sürede döner.
  * **Yankının değişimi** (iki kulağa varış farkı, şiddet, frekans kayması) → nesnenin yönü, boyutu ve hareketi. Güve kaçtığında yeni konumdan gelen yankıyla yarasa yön değiştirir.
* **Av sırasında darbe hızlanır:** arama → yaklaşma → yakalamadan hemen önce çok hızlı darbe dizisi ("terminal buzz").
* **Ağır çekim:** Ses saniyede ~343 m yol alır, yani gerçekte yankı milisaniyeler içinde döner. Dalgaların görülebilmesi için yayılma büyük ölçüde yavaşlatıldı; ekranda "Ağır çekim" etiketi vardır.
* **Ultrason sesleri:** Gerçek çağrılar insan kulağının duyamayacağı kadar yüksek frekanslıdır (çoğu türde ~20 kHz'in üstü).
  Videodaki kısa "tik" sesleri bu çağrıların duyulabilir bir temsilidir.
* **Tür farkı:** Her yarasa türü ekolokasyonu aynı ölçüde kullanmaz. Örneğin birçok meyve yarasası daha çok görme ve kokuya güvenir. Bu yüzden anlatımda "bu yarasa" denir ve kapanışta kısa bir not vardır.
* Görselleştirme şematiktir: Mavi halkalar gönderilen sesi, turuncu halkalar yankıyı gösterir. Ses gerçekte görünmez.

## Dosyalar

* `scene/js/bat.js` — yarasa (iskeletli kanat: kol, ön kol, bilek, III–V parmaklar; zar her karede yeniden kurulur, aşağı vuruşta açılır, yukarı vuruşta yarı katlanır) ve güve.
* `scene/js/cave.js` — tek parça mağara tüneli ve sütunlu salon, ışık huzmeleri, toz, ateşböceği benzeri noktalar. Kaya malzemesindeki "yankı izi" shader'ı sahne 5'teki ses haritasını çizer.
* `scene/js/main.js` — zaman çizelgesi, uçuş yolları, ses darbeleri ve yankı hesabı (darbe → güveye çarpma → yarasaya dönüş zamanları hareketli hedefe göre çözülür), kamera, ekran yazıları.
* `audio/make_audio.py` — anlatım yerleşimi, kanat çırpma (render ipuçlarından her aşağı vuruşta), darbe ve yankı sesleri, yakalama sesi, mağara ambiyansı (uğultu, damlalar, yankı), müzik ve ducking.

## Yeniden üretme

```bash
npm install
# 4 paralel parça (her biri ~11,25 sn), sonra birleştirme
for i in 0 1 2 3; do node render.cjs --format vertical --from $(echo "$i*11.25" | bc) --to $(echo "($i+1)*11.25" | bc) --out out/parts/part$i.mp4 & done; wait
ffmpeg -f concat -safe 0 -i <(for i in 0 1 2 3; do echo "file '$PWD/out/parts/part$i.mp4'"; done) -c copy out/video_vertical_noaudio.mp4
python3 audio/make_audio.py
ffmpeg -i out/video_vertical_noaudio.mp4 -i out/soundtrack.wav -map 0:v -map 1:a -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p \
  -af "volume=XdB,alimiter=limit=0.891:level=false" -c:a aac -b:a 192k -ar 48000 -movflags +faststart -shortest out/yarasa-ekolokasyon_shorts.mp4
```

`volume` değeri, sonuç −16 LUFS olacak şekilde `ebur128` ölçümüne göre ayarlanır.
Test kareleri için: `node render.cjs --format vertical --stills 5,13,26.5,40`
