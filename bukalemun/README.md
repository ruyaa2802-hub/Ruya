# Bukalemunun Fırlatma Dili 🦎👅

Pirilumo için 38 saniyelik dikey (9:16, 1080×1920, 30 fps) 3D çizgi film animasyonu (YouTube Shorts / Instagram Reels).
**Ücretsiz ve açık kaynak üretim:** karakter, ortam, kamera ve animasyon **Blender 5.2** içinde tamamen Python koduyla kuruldu ve EEVEE ile render edildi. Ücretli tek kalem, ElevenLabs'te **bir kez** üretilen seslendirmedir.

**Çıktı:** `out/bukalemun_shorts.mp4` · ses katmanları `out/audio/stem_*.wav` · ses testi `out/ses_testi.m4a`

## Araçlar ve maliyet

| Ne | Araç | Maliyet |
|---|---|---|
| 3D karakter, ortam, animasyon, kamera | **Blender 5.2.3** (`pip install bpy`, açık kaynak GPL). Sahne `blender/scene.py` içinde koddan kuruluyor. | Ücretsiz |
| Render | Blender **EEVEE**. GPU olmadığı için Mesa'nın yazılımsal OpenGL'i (llvmpipe) kullanıldı; `apt install libegl1 libegl-mesa0 libgl1-mesa-dri libgbm1`. 540×960'ta render, 1080×1920'ye ölçekleme. | Ücretsiz |
| Yazılar ve altyazılar | Python **Pillow** + Inter yazı tipi (`post.py`), tam çözünürlükte keskin | Ücretsiz |
| Seslendirme | **ElevenLabs**, hazır ses **Jessica – Playful, Bright, Warm** (`cgSgspJ2msm6clMCkdW9`), model `eleven_v4`, metnin tamamı **tek üretim** (1 varyasyon). Yeniden üretim yapılmadı. | **611 ElevenLabs kredisi** |
| Müzik ve efektler | `audio/make_audio.py` içinde numpy ile sentezlendi. <ul><li>**Müzik:** marimba, pizzicato bas, shaker, tahta blok.</li><li>**Efektler:** sinek vızıltısı, kayan düdük, "fırlatma", "şlap", "gulp", yay, çan, orman ambiyansı.</li></ul> | Ücretsiz, telifsiz |
| Birleştirme | ffmpeg | Ücretsiz |

Öncesinde fiyat tahmini alındı: ~561 kredi (`estimate_only`, ücretsiz). Gerçek üretim 611 kredi tuttu.

## Seslendirme (Jessica, tek dosya)

> Bu sevimli bukalemunun en büyük silahı ne biliyor musun? Dili! Bukalemunların dili, vücut uzunluklarının yaklaşık iki katına kadar uzanabiliyor! Bazı küçük türlerde bu oran daha da fazla. Peki nasıl bu kadar hızlı? Dilindeki özel elastik dokular enerji depoluyor. Bu enerji bir anda serbest kalıyor ve dil adeta bir mancınık gibi fırlıyor! Dilinin ucundaki yapışkan yüzey avını yakalamasına yardımcı oluyor. Üstelik bütün bu hareket göz açıp kapayıncaya kadar gerçekleşiyor! Doğanın en hızlı avcılarından biri! Peki sen, böyle bir dile sahip olmak ister miydin?

* **Süre ve duraklamalar:** 34,9 sn; en uzun duraklama 0,46 sn, bu yüzden kesme ya da hızlandırma yapılmadı. Video 0,4 sn'de başlıyor.
* **Duygu etiketleri:** `[curious] [excited] [playful]` eklendi. Etiketler okunmuyor; yalnızca tonlamayı yönlendiriyor.
* **Ağız senkronu:** bukalemun kameraya konuştuğu planlarda (açılış ve final) çenesi, seslendirmenin 100 Hz'lik ses yüksekliği zarfıyla açılıp kapanıyor. Basit bir dudak senkronu.

## Karakter (bütün sahnelerde aynı: `blender/scene.py → build_chameleon`)

* **Gövde:** yandan basık, sırtı dikenli; parlak yeşil cilt, sarı-turuncu karın ve turuncu çapraz bantlar, ince pul dokusu.
* **Baş:** miğfer (casque) şeklinde. Alt çene menteşeli, ağız gülümseyen bir çizgi.
* **Gözler:** **birbirinden bağımsız dönen** göz kuleleri; büyük beyaz-turuncu iris, göz kapakları ile kırpma ve kısma.
* **Bacaklar ve kuyruk:** dört kısa bacak, dalı iki yandan kavrayan parmak grupları; **spiral kıvrılan kuyruk**.
* **Dil:** yapışkan, pembe topuz uçlu.

## Sahneler

| Süre | Görüntü |
|---|---|
| 0–4,5 sn | Tropik ormanda dalın üzerindeki bukalemun kameraya bakarak konuşur. Bir sinek burnunun önünden geçer: bir göz kameraya bakarken diğeri sineği izler, sonra iki göz de burna çevrilir. Sinek burna konar. "Dili!" anında dilin ucu görünür. |
| 4,5–12 sn | Yan görünüm, **ağır çekim**: ağız açılır, dil çaprazlamasına uzar. <ul><li>Ekranda karşılaştırma: gövde altında "1× vücut" çizgisi, dil boyunca "1×" ve "2×" işaretleri.</li><li>**"VÜCUT UZUNLUĞUNUN 2 KATINA KADAR!"** başlığı çıkar.</li><li>"Bazı küçük türlerde ~2,5 katı!" notu görünür.</li></ul> |
| 12–22 sn | Meraklı yakın plan, ardından **kesit görünüm**: baş saydamlaşır. İçeride dil kemiği (hiyoid), etrafında elastik kılıflar ve onları saran hızlandırıcı kas görünür. Kas kasıldıkça kılıflar gerilir, parlar ve "Depolanan enerji" çubuğu dolar. Kilit açılınca **"FIRLAT!"**: dil mancınık gibi çıkar, kamera ucu takip eder. |
| 22–29 sn | Havada duran sinek → nişan → **gerçek hızda atış**. Ardından **ağır çekim**: "Yapışkan dil ucu" sineği yakalar, dil geri çekilir, sinek ağza girer ("gulp"), bukalemun memnun göz kırpar. Ekranda: "Saniyenin onda birinden kısa! — göz açıp kapayıncaya kadar". |
| 29–38 sn | Gururlu bakış. Arkadan bir sinek yaklaşır; arka göz döner ve onu görür. Atış yapılır ama sinek son anda kaçar; dil bir yaprağa yapışıp gerilir. Bukalemun şaşkın gözlerle kameraya bakar. **"BUKALEMUN — DOĞANIN MANCINIK USTASI!"** ve Pirilumo logosu. |

Not: Ekran yazısını briefteki "BUKALEM" yerine "BUKALEMUN" olarak yazdım.

## Bilimsel notlar

* Bukalemun dili, vücut uzunluğunun (burun–kloak) yaklaşık 2 katına uzanabilir. Küçük türlerde oran daha yüksektir, örneğin *Rhampholeon spinosus*'ta ~2,5 kat (Anderson 2016).
* **Fırlatma mekanizması:** hızlandırıcı kas yavaşça kasılır. Enerji, dil kemiğinin (hiyoid) uzun çıkıntısını saran iç içe elastik kolajen kılıflarda depolanır. Kas kılıfları gerdikten sonra dil kemik çıkıntısından kayarak serbest kalır ve enerji bir anda açığa çıkar. Bu, mancınık benzeri **balistik** bir harekettir (de Groot & van Leeuwen 2004; Anderson 2016).
* **Hız:** dil ucu saniyenin onda birinden kısa sürede avına ulaşır; küçük türlerde ivme 250 g'yi aşabilir.
* **Yapışkanlık:** dil ucundaki çok yoğun (viskoz) mukus ve ucun avı saran yastık şekli yakalamayı sağlar.
* **Gözler:** bukalemun gözleri birbirinden bağımsız hareket eder; açılış ve finaldeki göz hareketleri buna dayanır.
* Sahneler çizgi film stilizasyonudur. Kesit görünüm şematiktir ve oranlar abartılmıştır.

## Yeniden üretme

```bash
pip install bpy==5.2.3 pillow numpy                # Blender'ı Python modülü olarak kurar (≈400 MB)
apt-get install -y libegl1 libegl-mesa0 libgl1-mesa-dri libgbm1   # GPU yoksa EEVEE için yazılımsal OpenGL
python3 blender/render.py --w 540 --h 960 --stills 3.2,7.5,16,24,34.8   # test kareleri
python3 blender/render.py --w 540 --h 960 --from 0 --to 19 &       # tam render (iki parça paralel)
python3 blender/render.py --w 540 --h 960 --from 19 --to 38 &
wait
python3 post.py                                   # 1080×1920'ye ölçekle + yazı/altyazı → out/video_noaudio.mp4
python3 audio/make_audio.py                       # müzik + efekt + Jessica anlatımı → out/soundtrack.wav
ffmpeg -i out/video_noaudio.mp4 -i out/soundtrack.wav -map 0:v -map 1:a -c:v copy \
  -af "volume=XdB,alimiter=limit=0.891:level=false" -c:a aac -b:a 192k -ar 48000 -movflags +faststart -shortest out/bukalemun_shorts.mp4
```

GPU'lu bir bilgisayarda EEVEE çok daha hızlıdır. Bu bulut bilgisayarında kare başına ~18 sn sürdü (iki paralel süreç). GPU varsa `--w 1080 --h 1920` ile doğrudan tam çözünürlükte render alınabilir.
