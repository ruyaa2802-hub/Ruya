# Kediler Neden İnsanlara Miyavlıyor? 🐈

Pirilumo kanalı için 48,6 saniyelik dikey (9:16, 1080×1920, 30 fps) YouTube Shorts animasyonu.
Üretim yöntemi önceki projelerle aynı: Three.js sahnesi → kare kare render (headless Chromium) → ffmpeg.
Anlatıcı: ElevenLabs "Uğur – Turkish Documentary Narrator". Miyav, tıslama ve mırlama sesleri ElevenLabs ses efekti modeliyle üretildi. Kalan efektler ve müzik numpy ile oluşturuldu.

**Çıktı:** `out/kedi-miyav_shorts.mp4` · altyazı `out/altyazi_tr.srt` · ses katmanları `out/audio/stem_*.wav`

## Sahneler

| Süre | Sahne | Görüntü | Anlatım |
|---|---|---|---|
| 0–6,5 sn | 1 · Kanca | Akşam, oturma odası. Turuncu tekir kedi kameraya doğru yürür, yürürken miyavlar (0,15 sn). Sahibinin önünde oturur, başını kaldırıp tekrar miyavlar. Kişi çömelir, kedi göz teması kurar ve el başına uzanır | "Hiç düşündün mü? Kediler birbirlerine değil de, bize neden bu kadar çok miyavlıyor?" |
| 6,5–12,3 sn | 2a · İki kedi | Bahçe, gün batımı. Turuncu ve gri kedi karşılaşır, burun buruna koklaşır. Gri kedinin kulakları yana döner, kuyruğu sallanır. Sonra sırtını kamburlaştırıp tüylerini kabartır ve tıslar; turuncu kedi geri çekilir | "Yetişkin kediler kendi aralarında çoğunlukla beden dili ve koku sinyallerini kullanır." |
| 12,3–16,9 sn | 2b · İnsana miyav | Aynı kedi verandada oturan sahibine gider, miyavlar; el inip başını okşar | "Miyavlama ise insanlarla iletişimlerinde özellikle yaygındır." |
| 16,9–22,4 sn | 3a · Mutfak | Kedi boş mama kabının yanında sahibine bakıp miyavlar. Kişi döner, eğilir ve kaptan mamayı döker; kedi yemeye başlar | "Zamanla kediler şunu öğrenebilir: Miyavladığımda insanım bana bakıyor…" |
| 22,4–27 sn | 3b · Kapı | Kedi kapının önünde kapı koluna ve sahibine bakarak miyavlar. El kola uzanır, kapı açılır, akşam ışığı içeri dolar, kedi dışarı çıkar | "…kapıyı açıyor ya da yemek veriyor." |
| 27–30,9 sn | 4a · Açlık | Yüksek açıdan bakış: boş kabın yanında kedi doğrudan kameraya bakıp uzun ve ısrarlı miyavlar. Etiket: **🍽️ Açlık** | "Üstelik her miyav aynı anlama gelmez." |
| 30,9–34,7 sn | 4b · İlgi | Kuyruk dik ve ucu kıvrık, kedi sahibinin bacaklarına sürünür; kısa, yumuşak bir "mırrrv" sesi çıkarır. Etiket: **💛 İlgi isteği** | "Açlık, ilgi isteği veya rahatsızlık farklı seslerle ifade edilebilir." |
| 34,7–38,9 sn | 4c · Çağırma | Kapalı kapının önünde kedi odaya dönüp uzun, yüksek sesle çağırır. Etiketler: **🚪 Sahibini çağırma** ve **👀 Beden dili + ortam = anlam** | "Kedinin beden diline ve bulunduğu ortama da bakmalıyız." |
| 38,9–48,6 sn | 5 · Final | Koltukta sahibinin yanında yatan kediyi bir el okşar. Kedi gözlerini yavaşça kırpar ve mırlar; kamera yavaşça uzaklaşır. **"Yorumlara yaz 🐈"** | "Yani kedin sana miyavladığında… Peki, senin kedin en çok ne zaman miyavlıyor?" |

## Bilimsel notlar

* Yetişkin kediler birbirleriyle **çoğunlukla** koku (sürtünme, koklaşma), beden dili (kulak, kuyruk, duruş) ve bakışla iletişim kurar. Miyavlama yavru–anne iletişiminde yaygındır; yetişkinlerde ise özellikle insanlara yöneliktir.
* Kediler kendi aralarında da ses kullanır: **tıslama, hırlama, mırlama**, trill, çiftleşme sesleri gibi. Bu sesler bağlama göre farklı işlev taşır. Videodaki tıslama da bunun bir örneğidir. Anlatımda "hiç miyavlamaz" gibi kesin bir ifade yoktur.
* **Öğrenilmiş iletişim:** Bir miyav ilgi, mama ya da kapının açılmasıyla ödüllendirildiğinde, kedi o sesi o durumda daha sık kullanmayı öğrenebilir. Videoda "kandırmak" gibi bir ifade kullanılmaz.
* Her miyav aynı anlama gelmez. Ses tonu, uzunluk ve ısrar duruma göre değişir. Doğru yorum için kulaklara, kuyruğa ve bulunulan ortama birlikte bakmak gerekir.
* **Yavaş göz kırpma** (sahne 5) kedilerin rahatlık ve güven bildiren bir sinyali olarak bilinir. Mırlama ise çoğu zaman rahatlığa eşlik eder; ama tek anlamı bu değildir.

## Dosyalar

* `scene/js/cat.js` — kedi:
  * Gövde, bacak ve kuyruk her karede yeniden kurulan yüzeylerdir (loft).
  * Tüy görünümü için 3–6 katlı "tüy kabuğu" katmanları kullanılır.
  * Bacaklar 2 kemikli IK ile yürüme yürüyüşü yapar. Oturma, yatma, kambur durma (tıslama) ve yana bükülme (sürünme) pozları vardır.
  * Çene (miyav ve tıslama), göz kapakları (kırpma ve yavaş kırpma), göz bebekleri, kulak açıları ve bıyıklar hareketlidir.
* `scene/js/human.js` — kişi (IK ile kollar ve bacaklar, okşama ve dökme hareketleri).
* `scene/js/house.js` — akşam ev seti: oturma odası, mutfak (mama kabı, dökülen mamalar), antre (dışa açılan kapı).
* `scene/js/garden.js` — gün batımı bahçesi (rüzgârda sallanan çimler, çit, veranda).
* `scene/js/main.js` — 9 çekimlik zaman çizelgesi, kamera yolları, ses olayları, ekran yazıları.
* `audio/make_audio.py` — anlatım yerleşimi, miyav/tıslama/mırlama yerleşimi, pati, mama, kapı ve geçiş efektleri, ev/bahçe ambiyansı, müzik ve ducking.

## Yeniden üretme

```bash
npm install
for i in 0 1 2 3; do node render.cjs --format vertical --from $(echo "$i*12.15" | bc) --to $(echo "($i+1)*12.15" | bc) --out out/parts/part$i.mp4 & done; wait
ffmpeg -f concat -safe 0 -i <(for i in 0 1 2 3; do echo "file '$PWD/out/parts/part$i.mp4'"; done) -c copy out/video_vertical_noaudio.mp4
python3 audio/make_audio.py
ffmpeg -i out/video_vertical_noaudio.mp4 -i out/soundtrack.wav -map 0:v -map 1:a -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p \
  -af "volume=XdB,alimiter=limit=0.891:level=false" -c:a aac -b:a 192k -ar 48000 -movflags +faststart -shortest out/kedi-miyav_shorts.mp4
```

Test kareleri: `node render.cjs --format vertical --stills 0.3,9,29.4,41`
