# Pirilumo · HAYVANİKA Bölüm 1: Denizin Küçük Silahı – Tabanca Karidesi 🦐💥

Bu video 33,5 saniyelik dikey bir 3D animasyondur (9:16, 1080×1920, 30 fps). Karakter, ortam, kamera ve efektler Three.js ile tamamen kodla kuruldu. Her kare tarayıcıda (headless Chromium) kare kare render edildi; ses de kodla sentezlenip ffmpeg ile birleştirildi.

**Çıktılar:**
- Video: `out/tabanca_karidesi_shorts.mp4`
- Altyazı: `out/altyazi_tr.srt`
- Ses katmanları: `out/audio/stem_*.wav`

## Araç zinciri ve maliyet

Hiçbir ücretli servis ya da kredi kullanılmadı.

| Ne | Araç | Maliyet |
|---|---|---|
| 3D karakter, ortam, kamera, animasyon | **Three.js** (MIT lisanslı, açık kaynak). Sahne `scene/js/*.js` dosyalarında koddan kuruluyor. | Ücretsiz |
| Render | Headless Chromium + SwiftShader (GPU'suz WebGL). `render.cjs` her kareyi sırayla çiziyor. 4 paralel parça, kare başına ~20 sn. | Ücretsiz |
| Efektler | Kendi GLSL shader'larım (`scene/js/fx.js`, `scene/js/post.js`): <ul><li>su jeti;</li><li>kavitasyon kabarcığı;</li><li>çöküş parlaması;</li><li>şok dalgası kırılması;</li><li>alan derinliği, bloom, renk sapması.</li></ul> | Ücretsiz |
| Seslendirme | **Microsoft Edge sinir ağı TTS** (`edge-tts`, ses `tr-TR-AhmetNeural`). Metnin tamamı tek seferde üretildi (`audio/tts_edge.py`). | Ücretsiz |
| Müzik ve efektler | `audio/make_audio.py` içinde numpy ile sentezlendi; hazır örnek ses kullanılmadı. Telifsiz. | Ücretsiz |
| Birleştirme | ffmpeg | Ücretsiz |

**ElevenLabs neden kullanılmadı:** Önce ElevenLabs'te Uğur sesiyle tek bir üretim denendi. Tahmini maliyet 504 krediydi ama hesapta yalnızca 5 kredi kalmıştı. İstek, üretim başlamadan reddedildi ve kredi harcanmadı. Brifteki "bir yöntem çalışmazsa ücretsiz alternatifine geç" kuralına göre ücretsiz Edge TTS'e geçildi. Kredi yüklenirse aynı metin Uğur sesiyle üretilip `audio/prep_narration.py` ile aynı zaman çizelgesine yerleştirilebilir.

## Seslendirme (tek dosya, sahnelere bölünmüş)

> Denizin dibinde, küçücük bir canlı var… Ve bu canlının silahı mermi değil! Tabanca karidesi, özel kıskacını kapattığında inanılmaz hızlı bir su jeti oluşturuyor. Bu hareket, kavitasyon adı verilen bir olaya yol açıyor. Kabarcık çökerken ses ve ısı ortaya çıkıyor. Hatta çok kısa süreli ışık parlamaları bile oluşabiliyor! Üstelik bütün bunları yalnızca birkaç santimetrelik bir vücutla yapıyor. Doğa bazen en büyük sürprizleri en küçük canlılara saklıyor.

Seslendirme tek parça halinde üretildi. Sonra cümle aralarındaki duraklamalardan (`silencedetect`) 8 cümleye bölündü ve her cümle sahnesindeki ana görsel ana oturtuldu (`audio/prep_narration.py`). TTS'in verdiği kelime zamanları da bu yerleşime kaydırıldı (`audio/words.json`).

Bunun sonucu olarak görüntü sese tam senkron:
- "kıskacını kapattığında" → kıskaç kurulur;
- "inanılmaz" → kıskaç kapanır;
- "çökerken" → kabarcık çöker;
- "ışık" → parlama görünür.

## Karakter (bütün sahnelerde aynı model: `scene/js/shrimp.js`)

Renkleri *Alpheus randalli*'den esinlendi: yarı saydam krem gövde, parlak kırmızı bantlar. Anatomi gerçeğe yakın tutuldu:

- **Göz başlıkları:** Kabuğun ön kısmı gözleri örten iki yarı saydam başlık oluşturur. Tabanca karideslerinin gözleri bu başlıkların altında koyu lekeler olarak görünür. Önde küçük bir rostrum vardır.
- **Dev kıskaç:** Büyük oval avuç (propodus). Sabit parmakta bir **yuva**, hareketli parmakta (dactyl) bir **piston** bulunur. Kıskaç ~77° açılıp kilitlenir; kapanırken piston yuvaya girer.
- **Diğer uzuvlar:**
  - diğer tarafta ince küçük kıskaç;
  - ince 2. bacaklar ve 3 çift yürüme bacağı (zemine IK ile basar);
  - ağız ayakları (3. maksillipedler);
  - iki kollu antenciler ve gövdeden uzun antenler, yanlarında yassı anten pulu.
- **Karın ve kuyruk:**
  - 6 karın segmenti ve yan plakaları;
  - dalgalanarak çırpan yüzme ayakları (pleopodlar);
  - kuyruk yelpazesi (telson + 2 çift uropod).
- **Malzeme:** Islak kitin görünümü: clearcoat ve yarı saydamlık hissi veren fresnel dolgu.

## Sahneler

| Süre | Görüntü |
|---|---|
| 0–5,3 sn | Gece, karanlık resif tabanı. Kamera mercan dallarının arasından geçerek yuvasının önündeki karidese yaklaşır. Antenler oynar, kıskaç kurulur. **2,95 sn'de kıskaç kapanır**, görüntü ağır çekime geçer: su jeti, kabarcık, **4,1 sn'de çöküş** ile parlama, şok dalgası ve kabarcık bulutu. |
| 5,3–12,45 sn | Dev kıskacın etrafında dönen yakın plan; "TABANCA KARİDESİ" başlığı ve "Dev kıskaç" etiketi. Küçük bir balık gelip önünde durur. Kamera kıskacın omzunun üstüne geçer. Kıskaç yavaşça açılıp kilitlenir, **8,45 sn'de ateş**. Ağır çekimde jet balığa doğru uzanır ve içinde kavitasyon kabarcığı büyür: "Su jeti ~100 km/sa" ve **KAVİTASYON** yazıları. |
| 12,45–18 sn | Kabarcığa yakın plan. Kabarcık en büyük boyuna ulaşır, titreşir, sonra giderek hızlanarak çöker (**15,55 sn**, "çökerken"). Parlama, ekranı büken şok dalgası ve kabarcık bulutu görünür. Şok dalgası balığı sersemletir; balık yan yatar ve yavaşça dibe çöker. Ekranda: "Ses: kabarcığın çöküşünden" ve "Isı: binlerce °C". |
| 18–21,2 sn | **Tekrar, çok daha yavaş:** çöküşün son anı başka bir açıdan. "ışık" kelimesinde parlama görünür. Ekranda: "Işık parlaması · nanosaniyeler sürer · çıplak gözle görülmez". |
| 21,2–33,5 sn | Karides sersemlemiş avına yürür, küçük kıskacıyla onu alır ve yuvasına döner. Ekranda "Boyu yalnızca 3–5 cm" yazısı çıkar. Kamera yavaşça yükselip uzaklaşır; karanlık ve büyük resif, ay ışığı huzmeleri, plankton ışıltıları görünür. Kapanış: **"Doğanın başka hangi sırrını keşfedelim?"** ve Pirilumo logosu. |

## Ses tasarımı

Hepsi kodla sentezlendi.

- **Açılış:** Derin su altı uğultusu, uzak sonar benzeri bir ping ve resifin gerçek arka plan sesi olan uzak tabanca karidesi çıtırtıları.
- **Kıskaç:** Kurulurken mandal tıkırtıları ve gerilim yükselişi; kapanırken tok bir "tak". Ağır çekime geçişte zamanın yavaşladığını hissettiren derin bir iniş efekti var. Ağır çekim sırasında dış dünya boğuklaşır.
- **Kabarcık:**
  - Büyürken elektronik, dalgalı, yükselen bir ton ve su parıltısı duyulur.
  - Çöküşten hemen önce içe çeken bir whoosh var.
  - Çöküşte çok keskin bir "çat", derin bir alt bas darbesi ve kabarcık köpürmesi gelir.
  - Işık parlamasında kristal çan sesleri duyulur.
- **Müzik:**
  - Re minör, gizemli bir pad ile başlar.
  - Ağır çekim boyunca tremololu yaylı gerilimi ve yavaş bir kalp atışı ritmi yükselir.
  - Her çöküşten hemen önce müzik "nefesini tutar", sonra geri gelir.
  - Finalde akorlar (Dm → B♭ → F → C → Dm) ve cam arpejlerle genişler.
- **Miks:** Müzik konuşma altında −10 dB kısılır. Hedef −16 LUFS, tepe −1 dBFS.

## Bilimsel notlar

* Tabanca karidesleri (Alpheidae) birkaç santimetre boyundadır. Büyük kıskaçları vücutlarının yarısına yaklaşabilir.
* **Kıskacın çalışması:** Kıskaç açılıp kilitlenir, kas gerilir, kilit bırakılınca parmak çok hızlı kapanır. Piston yuvaya girer ve yuvadaki suyu ileri doğru hızlı bir **su jeti** halinde (~25–30 m/sn, yani ~100 km/sa) dışarı fırlatır (Versluis ve ark. 2000).
* Jetteki basınç suyun buhar basıncının altına düşer ve bir **kavitasyon kabarcığı** oluşur (birkaç mm). Kabarcık birkaç yüz mikrosaniye içinde büyüyüp çöker. Videoda bu yüzden ağır çekim kullanıldı; gerçekte hız ~20 000 kat daha yüksektir.
* **Duyulan yüksek "çat" sesi kıskaçların birbirine çarpmasından değil, kabarcığın çöküşünden gelir.** Çöküş bir şok dalgası üretir; bu dalga küçük avları sersemletebilir.
* Çöküşün son anında kabarcığın içi kısa süreliğine **binlerce derece** ısınır (tahmin: en az ~5 000 K). **Çok kısa bir ışık parlaması** (sonolüminesans, "shrimpoluminescence") ölçülmüştür (Lohse ve ark. 2001). Bu parlama nanosaniyeler sürer ve çıplak gözle görülemeyecek kadar zayıftır. Videodaki parlama bu yüzden **görselleştirmedir** ve ekranda da böyle belirtildi.
* Gerçekte kabarcık tam küre değildir, jetin girdabında halka/uzun biçimlidir. Videoda jet yönünde uzamış ve dalgalı bir kabarcık olarak gösterildi.
* Karidesin sersemlettiği avı yuvasına taşıması gerçek bir davranıştır; sahne bu davranışın sadeleştirilmiş halidir.

## Yeniden üretme

```bash
npm install                                            # three.js
python3 audio/tts_edge.py tr-TR-AhmetNeural +2% -2Hz audio/script.txt audio/raw/narration_ahmet.mp3 audio/raw/narration_ahmet.srt
ffmpeg -i audio/raw/narration_ahmet.mp3 -ar 48000 -ac 1 audio/raw/narration_ahmet.wav
cd audio && python3 prep_narration.py && cd ..          # cümleleri zaman çizelgesine yerleştir → audio/narration.wav, words.json
node render.cjs --format vertical --stills 3.6,9.8,15.6   # test kareleri
for p in "0 0 8.4" "1 8.4 16.8" "2 16.8 25.2" "3 25.2 33.5"; do set -- $p
  node render.cjs --format vertical --from $2 --to $3 --out out/parts/part$1.mp4 & done; wait
ffmpeg -f concat -safe 0 -i <(for i in 0 1 2 3; do echo "file '$PWD/out/parts/part$i.mp4'"; done) -c copy out/video_noaudio.mp4
python3 audio/make_audio.py                             # müzik + efekt + anlatım → out/soundtrack.wav
ffmpeg -i out/video_noaudio.mp4 -i out/soundtrack.wav -map 0:v -map 1:a -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p \
  -af "volume=XdB,alimiter=limit=0.891:level=false" -c:a aac -b:a 192k -ar 48000 -movflags +faststart -shortest out/tabanca_karidesi_shorts.mp4
```
