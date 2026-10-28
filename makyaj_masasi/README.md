# Makyaj Masasının Sırları — Bölüm 1: Bir Damla İhanet

85 saniyelik, 9:16 dikey, Türkçe, sözsüz özgün müzikli kısa animasyon.

| Dosya | İçerik |
|---|---|
| `out/Makyaj_Masasinin_Sirlari_B1_Bir_Damla_Ihanet.mp4` | **Final video**: 1080×1920, 30 fps, 85 sn, H.264 + AAC (−15 LUFS) |
| `out/karakter_referans_sayfasi.png` | Tek sayfa karakter referansı (5 karakter, ifade ve renk paleti) |
| `out/ses_plani.json` | Replik ve efekt zaman damgaları |
| `out/kontrol_kareleri.png` | Bitmiş videodan 2,7 sn aralıklı kontrol kareleri |
| `audio/lines/*.wav` | Kesilmiş seslendirme replikleri |
| `src/` | Üretim kodu (aşağıda) |

## Üretim planı ve ortam denetimi

Ortamda **Blender, gerçek 3B motor, yerel TTS ve video üretim modeli yoktu**. Bulunanlar: ffmpeg, Python, PIL, numpy ve iki ses bağlayıcısı (ElevenLabs, vidIQ). Bu yüzden:

1. **Görüntü:** Kendi 2.5D render motorumu yazdım (`src/chars.py`, `world.py`, `render.py`). Karakterler silindirik ve radyal gölgelendirme, cam/metal yansıması ve kenar ışığıyla çizilmiş sprite'lardır; kamera, ışık, masa yansıması ve ayna yansıması gerçek zamanlı hesaplanır.
2. **Karakter tutarlılığı:** Her karakter tek bir çizim kodundan gelir, yani şekil, renk ve oran bütün karelerde aynıdır. Referans sayfası aynı koddan üretildi.
3. **Ses:** Seslendirme bağlayıcıdan, müzik ve efektler `src/audio.py` ile numpy sentezi.
4. **Birleştirme:** `src/run_render.py` kareleri 4 işlemde üretir, `src/mux.sh` ses ve görüntüyü birleştirir.

## Teknik sınırlamalar (açık)

- **Bu gerçek 3B değil.** Sinematik 3B animasyon görünümü taklit eden, gölgelendirmeli 2.5D çizimdir. Karakterler döndürülemez, yalnızca eğilir, ezilir, esner ve ifade değiştirir.
- **Türkçe sesler Türk seslendirme sanatçısı değil.** ElevenLabs hesabı kredisini ilk replikte bitirdi (kota dolu), kalan yedi replik vidIQ'nun hazır çok dilli sesleriyle üretildi: Rüya = Sarah, Aras = Brian, Lalin = Matilda, Mert = Callum. **Telaffuzu ve aksanı ben dinleyemedim**, ses dosyalarının varlığını ve süresini ölçtüm ama diksiyon doğrulanmadı. Yayından önce bir insanın dinlemesi gerekir. Kredi olduğunda bu satırlar Türkçe sesli ElevenLabs sesleriyle (örn. Gözde `rtnDjO8siSxeTEeTVczO`, Deniz `2w5twzryiFg9VNnXphRP`) yeniden üretilebilir.
- Her karakterin repliklerini tek betikte üretip sessizlik noktalarından kestim (kredi tasarrufu). Kesimlerde kelime kaybı olmadığını sessizlik analizi ve süre ölçümüyle kontrol ettim.
- **Ağız senkronu** ses genliğinden türetilir (aç/kapa), fonem bazlı değildir.
- **Müzik sentezdir** (piyano, yaylı ve bas additif sentez), canlı kayıt kalitesinde değildir.
- Karakterlere küçük kollar ekledim (jest için). Ürün gövdeleri, yüzler ve renkler tasarıma sadıktır, insan karakter yoktur.
- Rüya'yı çekmecenin kendi içinde değil, organizerin üstünde çekmeceden yükselirken gösterdim. Aynadaki yansıma stilize: ayrı ve hafif mavi tonlu bir kopya.

## Sahne / zaman çizelgesi

| Sn | Sahne | Işık | Kamera |
|---|---|---|---|
| 0–10 | Gece başlıyor: kapı sesi, ampuller sırayla yanar, çekmece açılır, Rüya yükselir, "Gitti mi?", Aras karanlıktan: "Seni bekliyordum." | sıcak altın | geniş → çekmeceye yaklaşma → Aras'ı izleme |
| 10–28 | Gizli aşk: yaklaşırlar, yakın plan, metalik ses | sıcak altın → soğuk | yavaş yaklaşma, omuz hizası, sese sarsıntı + kaydırma |
| 28–42 | Tanık: Lalin kuleden izler, öfke, fısıltı, telefondan "Mert" | soğuk mavi + bordo | yüz → telefon ekranına yaklaşma |
| 42–65 | İlk hamle: Mert'in ekranı parlar, fotoğraf büyür, "Yarın gece. Herkes öğrenecek." | soğuk | iki kişilik plan → ekrana yaklaşma |
| 65–85 | Bölüm sonu: Rüya yalnız, mesaj, gözyaşı, aynadaki yansımaya yaklaşma, Lalin'in silueti, "Şimdi sıra sende, Rüya." | düşük ışık, ampuller titrer, kararma | yüz → yansımaya yaklaşma → kararma |

Replik zamanları (başlangıç, sn): Rüya 5,2 / 13,2 · Aras 7,5 / 17,0 · Lalin 31,2 / 48,8 / 79,0 · Mert 46,0. Konuşmalar üst üste binmez (aralar ≥ 0,6 sn). Ayrıntı `out/ses_plani.json`.

## Müzik / efekt

Romantik piyano (La minör, 76 bpm) ile başlar, 12. saniye civarında yaylılar girer; 26,4'te piyano aniden kesilir, metalik ses ve düşük drone gelir; 42'den sonra ritmik bas, staccato piyano, soğuk yaylı ve tik sesleri; 65'ten sonra yalnız piyano, kalp atışı ve 72–79 arası yükselen gerilim; 80,9'da düşük vuruş ve karartma. Müzik, konuşma sırasında yaklaşık −10 dB kısılır (ducking).

## Kalite kontrolü

| Kontrol | Sonuç |
|---|---|
| Karakterler tutarlı mı? | Evet, tek çizim kodu; referans sayfası ve kontrol karelerinde doğrulandı |
| Türkçe metin doğru mu? | Altyazılar ve ekran metinleri doğru (ğ, ş, ı, İ, â kontrol edildi). **Seslendirme telaffuzu doğrulanmadı** |
| Ses kapalıyken anlaşılır mı? | Evet: altyazı + mimik + ekran içerikleri hikâyeyi taşır |
| Kamera/karakterler hareket ediyor mu? | Evet: kamera planları, zıplama/yürüme, nefes, göz kırpma, bakış, tilt, ağız |
| Müzik diyalogu bastırıyor mu? | Hayır: konuşma, müzik + efektin 7–16 dB üstünde ölçüldü |
| Bölüm güçlü merakla bitiyor mu? | Evet: yansımada Lalin'in silueti, son replik, karartma, "DEVAM EDECEK" |
| Video gerçekten üretildi mi? | **Evet.** 2550 kare render edildi, sesle birleştirildi, ffprobe ile doğrulandı: 1080×1920, 30 fps, 85 sn |

## Yeniden üretim

```bash
cd src
python3 audio.py                         # müzik + efekt + miks
python3 run_render.py <kare_klasörü>     # 2550 JPEG kare (~8 dk, 4 çekirdek)
./mux.sh <kare_klasörü> ../out/video.mp4
python3 refsheet.py                      # referans sayfası
```
