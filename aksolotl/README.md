# Aksolotl – Kendini Yeniden İnşa Eden Canlı 🦎

Pirilumo kanalı için 48 saniyelik dikey (9:16, 1080×1920, 30 fps) 3D animasyonlu bilim videosu (YouTube Shorts / Instagram Reels).
Sahneler Three.js ile kodla kuruldu ve kare kare render edildi (headless Chromium, `render.cjs`). Ses numpy ile miksajlandı, ffmpeg ile tek parça MP4'e çevrildi.

**Çıktı:** `out/aksolotl_shorts.mp4` · altyazı `out/altyazi_tr.srt` · ses katmanları `out/audio/stem_*.wav` · ses testi `out/ses_testi.m4a`

## Ses — ne gerçekten üretildi

| Bileşen | Kaynak |
|---|---|
| Türkçe anlatım | **vidIQ seslendirme**, "Jessica" sesi (ElevenLabs'in çok dilli hazır sesi), metnin tamamı tek seferde. 14 vidIQ kredisi harcandı. |
| Fon müziği | **Kodla sentezlendi** (`audio/make_audio.py`): <ul><li>gizemli, büyüleyici su altı pad'leri (Re minör add9 → Si♭ → Fa → Sol minör 9 …);</li><li>cam/çelesta benzeri arpej;</li><li>yenilenme ve hücre sahnelerinin altında kalp atışı gibi yumuşak bir bas nabız.</li></ul> |
| Ses efektleri | Kodla sentezlendi: <ul><li>kabarcıklar, su geçişleri;</li><li>yenilenme için yükselen cam ton ve parıltı;</li><li>hücre sahnesinde bilim kurgu dokusu, bölünme "blip"leri;</li><li>doku etiketlerinde "ping", final çanları.</li></ul> |

* **Neden müzik sentezlendi:** vidIQ hesabında 27 kredi kalmıştı. Anlatım 14 kredi tuttu, yeni bir müzik parçası 25 kredi istiyordu. ElevenLabs'te ise 60 kredi var. Telifsiz olması için müziği kodla ürettim.
* **Akış:** anlatımdaki 0,4 sn'den uzun 11 duraklama 0,3 sn'ye kısaltıldı, sonra perde korunarak %5 hızlandırıldı. Toplam süre 45,3 sn. Cümleler sahnelere whisper kelime zamanlarıyla bağlandı.
* **Telaffuz kontrolü:** faster-whisper "small" modeli "tüylü solungaçlar"ı yanlış çözdü. Daha büyük "medium" modeli doğru duydu ("Başının iki yanındaki tüylü solungaçlar bunun en güzel kanıtı"); yani hata konuşma tanımadaydı, seste değil.
* **Miks:**
  * Müzik konuşma sırasında otomatik olarak −10 dB kısılır, boşluklarda yükselir (ducking).
  * Efektler de konuşma altında −5 dB çekilir.
  * Hedef: −16 LUFS, tepe −1 dBFS.

### Seslendirme metni (zaman kodlu, videodaki konumuyla)

| Süre | Metin |
|---|---|
| 0:00,3 | Ya sana, kaybettiği bir bacağını yeniden oluşturabilen bir hayvan olduğunu söylesem? Üstelik bu, bir bilim kurgu değil! |
| 0:06,4 | Aksolotl, kaybettiği bacaklarını yeniden oluşturabiliyor! Hem de yalnızca derisini değil; kemiklerini, kaslarını, sinirlerini ve damarlarını da yeniden geliştirebiliyor. |
| 0:15,3 | Peki bunu nasıl yapıyor? Yaralanan bölgede, blastema adı verilen özel bir hücre yapısı oluşuyor. Bu hücreler çoğalarak, yeni dokuların gelişmesini sağlıyor. |
| 0:24,3 | Bir başka şaşırtıcı özelliği daha var! Aksolotl yetişkinliğe ulaşsa bile, yavruluk dönemine ait özelliklerini koruyor. Başının iki yanındaki tüylü solungaçlar, bunun en güzel kanıtı. |
| 0:35,0 | Ancak bu eşsiz canlı, doğal yaşam alanı olan Meksika'da, yok olma tehlikesiyle karşı karşıya. Doğanın bize sunduğu bu mucizeyi korumak zorundayız. |
| 0:43,4 | Sen, böyle bir canlı olduğunu biliyor muydun? |

## Karakter (bütün sahnelerde aynı model: `scene/js/axolotl.js`)

* **Görünüm:** açık pembe (lösistik), hafif yarı saydam ıslak deri: fresnel parıltısı, clearcoat, ince lekeler.
* **Baş:** geniş ve yassı; küçük, parlak siyah gözler; hafif gülümseyen geniş ağız.
* **Solungaçlar:** her yanda 3 dış solungaç kolu. Üzerlerinde suyla dalgalanan yüzlerce ince filament var.
* **Bacaklar ve kuyruk:** dört kısa bacak (önde 4, arkada 5 parmak); uzun, yandan basık kuyruk ve sırttan kuyruğa uzanan yüzgeç.
* **Hareketler:** yüzme dalgası, yürüme, bacakları gövdeye toplama.
* **Sağ ön bacak** sahnede yeniden büyür (`regen`):
  1. iyileşmiş güdük;
  2. blastema tomurcuğu;
  3. kürek safhası;
  4. parmakların belirmesi;
  5. tam bacak.

  Bu sırada saydam görünümde (`inner`) kemik, kas, sinir, atardamar ve toplardamar bacakla birlikte büyür.

## Sahneler

| Süre | Görüntü |
|---|---|
| 0–6,3 sn | Karanlık, mavi tonlu göl suyu. Kamera yavaşça aksolotlun yüzüne yaklaşır; aksolotl kameraya bakar, solungaçları dalgalanır. Kamera sağ ön bacağın yerine, iyileşmiş güdüğe iner. Grafik yara yok. "Bilim kurgu değil — gerçek!" |
| 6,3–15,3 sn | **Zaman atlamalı yenilenme** (ilerleme çubuğu ve "Gerçekte birkaç hafta sürer" notuyla): güdükte blastema tomurcuğu oluşur, büyür, kürek şeklini alır, parmaklar belirir. Bacak saydamlaşır; anlatıyla aynı anda "Kemik", "Kas", "Sinir" ve "Damar" etiketleri çıkar. |
| 15,3–24,3 sn | "Peki bunu nasıl yapıyor?" sırasında kamera bacak ucuna dalar ve **hücre dünyasına** geçilir: <ul><li>Yara epidermisinin (saydam kubbe) altına eski dokulardan hücreler göç eder; renkleri parlak bir blastema tonuna döner ama köken izini korur.</li><li>**"BLASTEMA"** başlığı çıkar.</li><li>Hücreler bölünerek çoğalır, tomurcuk şişer.</li><li>Hücreler yeniden özelleşip katmanlara ayrılır: kıkırdak/kemik çekirdek, çevresinde kas, boyunca sinir ve damarlar, dışta deri. Renk açıklaması ekranda görünür.</li></ul> |
| 24,3–35 sn | Yüze dönüş: yakın plan, "Neoteni 🐣 — yetişkinken bile yavru özelliklerini korur". Ardından kamera akıntıda dalgalanan **dış solungaçların** etrafında döner ("Dış solungaçlar" etiketi). |
| 35–48 sn | Aksolotl su bitkileri, sazlar ve nilüferlerin gölgesi arasında yavaşça yüzer; kamera geri çekilip yaşam alanını gösterir. Sırayla şu yazılar çıkar: <ul><li>"📍 Doğal yaşam alanı: Meksika — Xochimilco kanalları · doğada kritik tehlike altında"</li><li>**"AKSOLOTL — Doğanın kendini yenileyen mucizesi."**</li></ul> Son karede aksolotl kameraya döner: **"Sen böyle bir canlı olduğunu biliyor muydun?"** ve Pirilumo logosu. |

Sahneler arasında siyah ekran yok: geçişlerde hareket bulanıklığı, dalış ve çözülme (crossfade) kullanılır. Bütün sahneler hareketli; sabit slayt yok.

## Bilimsel notlar

* Aksolotl (*Ambystoma mexicanum*) kaybettiği bacağı tüm dokularıyla yeniden oluşturabilir: deri, kemik/kıkırdak, kas, sinir ve damarlar. Süre hayvanın yaşına ve boyutuna göre değişir, genellikle haftalar sürer. Bu yüzden animasyon zaman atlamalıdır.
* Yaranın üstünü önce özel bir yara epidermisi kapatır. Altında **blastema** oluşur: yakındaki dokulardan gelen, kısmen "farklılaşmasını kaybeden" ve çoğalan hücrelerden oluşan bir kitle.
* Hücreler büyük ölçüde kökenlerinin "hafızasını" korur. Örneğin kas hücreleri yeniden çoğunlukla kasa dönüşür. Videoda bu, hücre renklerinin tamamen kaybolmayıp hafif iz bırakmasıyla gösterildi.
* Yeni bacak gövdeden uca doğru şekillenir. Sinirlerin varlığı yenilenme için gereklidir.
* **Neoteni:** aksolotl çoğunlukla başkalaşım geçirmeden üreme çağına gelir; dış solungaçlar ve yüzgeç gibi larva özelliklerini korur.
* Doğadaki tek yaşam alanı Meksiko şehri yakınlarındaki **Xochimilco** göl/kanal sistemidir. IUCN'e göre doğada **kritik tehlike altındadır** (CR). Laboratuvar ve akvaryumlarda ise yaygındır.
* Hücre sahnesi ölçeksiz bir **bilimsel illüstrasyondur**. Renkler doku türlerini anlatmak için seçildi.

## Dosyalar

* `scene/js/axolotl.js` — karakter (yukarıda).
* `scene/js/lake.js` — göl tabanı:
  * kostik ışıklı çamur, çakıllar, batık dal;
  * su veba otu benzeri bitkiler, sazlar, nilüfer gölgeleri;
  * ışık huzmeleri, partiküller, kabarcıklar.
* `scene/js/micro.js` — hücre dünyası: yara epidermisi kubbesi; göç eden, bölünen ve farklılaşan 460 hücre.
* `scene/js/main.js` — anlatıma bağlı zaman çizelgesi, kameralar, iki dünya arası geçişler, ekran yazıları.
* `audio/prep_narration.py`, `audio/words.json`, `audio/subtitles.py`, `audio/make_audio.py`.

## Yeniden üretme

```bash
npm install
python3 audio/prep_narration.py && python3 <asr.py> audio/narration.wav audio/words.json && python3 audio/subtitles.py
python3 audio/make_audio.py --test 20     # kısa ses testi
for p in "0 0 12" "1 12 24" "2 24 36" "3 36 48"; do set -- $p
  node render.cjs --format vertical --from $2 --to $3 --out out/parts/part$1.mp4 & done; wait
ffmpeg -f concat -safe 0 -i <(for i in 0 1 2 3; do echo "file '$PWD/out/parts/part$i.mp4'"; done) -c copy out/video_vertical_noaudio.mp4
python3 audio/make_audio.py
ffmpeg -i out/video_vertical_noaudio.mp4 -i out/soundtrack.wav -map 0:v -map 1:a -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p \
  -af "volume=XdB,alimiter=limit=0.891:level=false" -c:a aac -b:a 192k -ar 48000 -movflags +faststart -shortest out/aksolotl_shorts.mp4
```
