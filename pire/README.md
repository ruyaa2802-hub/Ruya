# Bir Pire Kendi Boyunun 100 Katı Üzerine Nasıl Zıplar? 🦘

Pirilumo kanalı için 44,5 saniyelik dikey (9:16, 1080×1920, 30 fps) bilim animasyonu (YouTube Shorts / Instagram Reels).
Üretim yöntemi önceki projelerle aynı: Three.js ile kodla kurulan, milimetre ölçekli 3D sahneler. Kareler tek tek render edilir (headless Chromium, `render.cjs`), ffmpeg ile MP4'e çevrilir.

**Çıktı:** `out/pire-sicrama_shorts.mp4` · altyazı `out/altyazi_tr.srt` · ses katmanları `out/audio/stem_*.wav`

## Seslendirme — ⚠️ yedek ses kullanıldı

* Tercih edilen ses ElevenLabs **Uğur – Turkish Documentary Narrator**. Metin için gereken ~364 kredi vardı, hesapta yalnızca ~60 kalmıştı. Bu yüzden ElevenLabs ile anlatım **üretilmedi**.
* Videodaki anlatım yerel, açık kaynak **Piper TTS** ile üretildi (`tr_TR-dfki-medium`, `audio/tts_piper.sh`).
  * Bu sesin eğitim verisinin lisansı **CC BY-NC-SA 4.0**'dır, yani ticari olmayan kullanım içindir (`audio/raw/PIPER_MODEL_CARD.md`). Para kazanan bir kanalda yayın için uygun olmayabilir.
  * Tonlaması Uğur sesine göre daha düz ve robotiktir.
* **Değiştirmek kolay:**
  1. Kredi yüklendiğinde 11 cümle Uğur sesiyle `audio/raw/s00.wav … s10.wav` olarak yeniden üretilir.
  2. `audio/sentences.json` süreleri güncellenir.
  3. `python3 audio/make_audio.py` çalıştırılır, sonra mux adımı yapılır.

  Görüntünün yeniden render edilmesi gerekmez. Cümleler `audio/timeline.py` içindeki başlangıç zamanlarına yerleşir; bir cümle uzarsa yalnızca `START` ve `SPEED` ayarlanır.
* Anlatım %12 hızlandırıldı (perde korunarak), cümleler sahnelere tek tek yerleştirildi.
* Ses efektleri (sıçrama, yay, kilit, iniş, hışırtı, kedi mırıltısı) ve müzik kodla (numpy) sentezlendi. Dışarıdan ses dosyası kullanılmadı.

### Seslendirme metni (zaman kodlu)

| Süre | Metin |
|---|---|
| 0:00,5 | Bu küçücük canlı, kendi boyunun 100 katına ulaşan yüksekliklere sıçrayabilir! |
| 0:04,9 | Bazı pire türleri yalnızca birkaç milimetre uzunluğundadır. |
| 0:08,4 | Buna rağmen sıçrama yükseklikleri kendi boylarının yaklaşık 100 katına ulaşabilir. |
| 0:13,0 | Peki bunu nasıl başarıyor? |
| 0:14,7 | Kasları enerji biriktirir. |
| 0:16,5 | Piredeki esnek yapılar ve dış iskelet, bir yaylı mekanizma gibi çalışır. |
| 0:20,6 | Biriken enerji bir anda serbest kalır ve pireyi adeta bir mancınık gibi fırlatır. |
| 0:25,6 | Üstelik pirelerin kanatları yoktur! |
| 0:27,8 | Bir konakçı üzerinde hareket etmek ve başka bir noktaya ulaşmak için güçlü sıçrama yeteneklerinden yararlanırlar. |
| 0:34,4 | Milimetrelik bir canlı, kendi boyuna göre böylesine büyük bir sıçramayı nasıl yapabiliyor? |
| 0:39,5 | Doğanın mühendisliği gerçekten şaşırtıcı. |

## Sahneler

| Süre | Görüntü |
|---|---|
| 0–4,6 sn | Makro: dokuma kumaş lifleri üzerinde yürüyen kedi piresi. Kamera alçaktan yaklaşır. Pire 1,3. saniyede arka bacaklarını kurup sıçrar, toz lifleri havalanır. Ağır çekimde yükselir ve kadrajın üstünden çıkar. "≈100× kendi boyunun". |
| 4,6–8,3 sn | Çelik milimetrik cetvelin yanında yürür. Ekranda "1 mm", "Pire ≈ 2,5 mm", "Kedi piresi ≈ 1–3 mm · türe göre değişir" yazıları görünür. |
| 8,3–12,8 sn | Temsili ölçek: sıçrama başlar, kamera logaritmik olarak geri çekilir. Parlak iz çizgisi, 0–30 cm ölçek çubuğu ve halka işaretçi görünür. "Temsili: ~3 mm boy → ~30 cm ≈ 100× · ölçülen değerler türe ve bireye göre değişir". |
| 12,8–25,4 sn | Yandan takip çekimi, ardından **anatomik kesit**: dış iskelet saydamlaşır. Sırayla şunlar görünür: <ul><li>kasılıp kalınlaşan kırmızı kas,</li><li>sıkışan turuncu göğüs yayı (dış iskelet),</li><li>enerji depoladıkça parlayan mavi esnek ped (resilin),</li><li>yanıp sönen kilit.</li></ul>Enerji parçacıkları kastan pede toplanır. Kilit açılınca enerji bacak boyunca aşağı akar, bacak açılır ("İtme: bacak ucu → zemin") ve pire fırlar. |
| 25,4–29,6 sn | Ağır çekim uçuş: pire havada yavaşça takla atar, sırtı görünür. "Kanat yok". |
| 29,6–34,1 sn | Kedi tüyü makrosu (temsili): pire derinin üstünde, kılların arasında çömelir. Kıllar arasından ağır çekimde karşıya sıçrar; kamera takip eder. |
| 34,1–44,5 sn | Kumaşa geri dönüş: pire düşer ve iner, birkaç adım yürür. **Gerçek hızda** bir sıçrama yapar: tek karede kadrajdan çıkar, ekranda yalnızca hareket bulanıklığı ve toz kalır. Sonra geri iner. "Doğanın en küçük akrobatlarından biri!" + Pirilumo logosu. |

## Bilimsel notlar

* **"100 kat" yaklaşık ve temsilidir.** Sıçrama yüksekliği ve mesafesi türe, cinsiyete, bireye ve ortama göre değişir. Videoda bu bilgi ekranda yazılıdır ("türe ve bireye göre değişir", "temsili").
* **Enerji tek bir kaynaktan gelmez.**
  * Göğüsteki büyük bacak kası (trokanter depresör kası) **yavaşça** kasılır.
  * Bu iş, göğsün dış iskeletindeki (pleural kemer) esnek bölgelerde ve **resilin** adlı lastik benzeri proteinde, sıkıştırılan bir yay gibi depolanır. Resilin, çevresindeki sert kütikülle birlikte çalışır.
  * Bir kilit/mandal mekanizması bacağı kurulu tutar. Kilit açılınca depolanan enerji yaklaşık **1 milisaniye** içinde boşalır. Bu, kasın tek başına üretebileceğinden çok daha hızlı bir güç çıkışıdır.
  * Kuvvet bacak boyunca aktarılır ve **tibia ile tarsus (bacak ucu) üzerinden zemine** iletilir.
  * Kaynaklar: Bennet-Clark & Lucey 1967, *J. Exp. Biol.*; Sutton & Burrows 2011, *J. Exp. Biol.*
* Kesit görünümü **şematiktir**: kas, yay, ped ve kilit, mekanizmayı anlatmak için sadeleştirilmiş ve renklendirilmiştir. Gerçek konumları daha karmaşıktır.
* **Pireler kanatsızdır** (Siphonaptera takımı). Konakçıya ulaşmak ve konakçı üzerinde yer değiştirmek için sıçramayı kullanırlar. Uçuş sırasında takla atmaları gerçek gözlemlerle uyumludur.
* **Model:** kedi piresi (*Ctenocephalides felis*), yetişkini yaklaşık 1–3 mm. Görsel özellikleri:
  * yanlardan basık, parlak kırmızı-kahverengi kitin gövde;
  * baş altındaki (genal) ve göğüs önündeki (pronotal) dikensi taraklar;
  * geriye yatık kıllar, kısa antenler, aşağı bakan ağız parçaları;
  * büyük arka bacaklar.

  Anatomi sadeleştirilmiştir (ör. tarsus segmentleri tek parça).
* **Ağır çekim ve gerçek hız:** gerçek bir sıçramanın kalkışı ~1 ms'dir, yükselişi de saniyenin onda biri mertebesindedir. Bu yüzden 0–4,6, 22–25 ve 25–34 sn arasındaki sahneler büyük ölçüde yavaşlatılmıştır (ekranda "AĞIR ÇEKİM"). 37. saniyedeki sıçrama gerçek hızdadır: pire bir kare içinde kaybolur.
* Kedi tüyü sahnesindeki kıllar kadraja sığsın diye gerçek uzunluklarından kısa tutuldu (temsili makro görünüm).

## Dosyalar

* `scene/js/flea.js` — kedi piresi:
  * Gövde tek parça bir loft yüzeyidir (segment plakaları dokuda). Ayrıca kıllar, taraklar, göz, anten ve ağız parçaları vardır.
  * Altı bacak IK ile hareket eder. Pozları: yürüme, arka bacakları kurma (`crouch`), itme (`kick`), havada bacakları salma (`air`).
  * Kesit modu (`cut`, `load`, `release`): fresnel "hayalet" kabuk, kas lifleri, kiriş, göğüs yayı, resilin pedi, kilit ve enerji parçacıkları.
* `scene/js/ground.js` — makro dokuma kumaş (örgülü iplikler, toz lifleri) ve çelik milimetrik cetvel.
* `scene/js/fur.js` — kedi derisi ve sivrilen, kıvrık kıllar.
* `scene/js/main.js` — zaman çizelgesi:
  * kamera yolları ve sıçrama yörüngeleri;
  * temsili 30 cm ölçeği (ölçek çubuğu, iz, işaretçi);
  * toz patlamaları ve ekran yazıları.
* `audio/timeline.py` — anlatım zamanlaması (tek kaynak). `scene/subtitles.json` ve `out/altyazi_tr.srt` dosyalarını üretir.
* `audio/make_audio.py` — anlatım yerleşimi, efektler, müzik ve miks. `audio/tts_piper.sh` — yedek seslendirmeyi yeniden üretir.

## Yeniden üretme

```bash
npm install
python3 audio/timeline.py                       # altyazı zamanları
for p in "0 0 11.2" "1 11.2 22.4" "2 22.4 33.4" "3 33.4 44.5"; do set -- $p
  node render.cjs --format vertical --from $2 --to $3 --out out/parts/part$1.mp4 & done; wait
ffmpeg -f concat -safe 0 -i <(for i in 0 1 2 3; do echo "file '$PWD/out/parts/part$i.mp4'"; done) -c copy out/video_vertical_noaudio.mp4
python3 audio/make_audio.py
ffmpeg -i out/video_vertical_noaudio.mp4 -i out/soundtrack.wav -map 0:v -map 1:a -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p \
  -af "volume=XdB,alimiter=limit=0.891:level=false" -c:a aac -b:a 192k -ar 48000 -movflags +faststart -shortest out/pire-sicrama_shorts.mp4
```

`XdB` değeri, sonuç −16 LUFS olacak şekilde `ffmpeg -af ebur128` ölçümüne göre seçilir.

Test kareleri: `node render.cjs --format vertical --stills 1.8,6.5,10.8,17.5,22.6,27,31.5,37.03,42`

Tarayıcıda canlı önizleme: proje kökünde bir statik sunucu açıp (`npx http-server .`) `scene/index.html` adresini açın.
