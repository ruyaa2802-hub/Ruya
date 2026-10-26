# Ahtapotların 3 Kalbi Var, Peki Neden? 🐙

Pirilumo kanalı için 42,5 saniyelik dikey (9:16, 1080×1920) YouTube Shorts animasyonu.
Üretim yöntemi `ari-dansi` projesiyle aynıdır (Three.js → kare kare render → ffmpeg; ElevenLabs anlatıcı; numpy ses tasarımı).

**Çıktı:** `out/ahtapotun-3-kalbi_shorts.mp4` · altyazı dosyası `out/altyazi_tr.srt` · ses katmanları `out/audio/stem_*.wav`

## Sahneler

| Süre | Sahne | Görüntü | Anlatım |
|---|---|---|---|
| 0–7 sn | 1 · Merak | Ahtapot mercan duvarının arkasından yükselir, kameraya yüzer; şaşırıp kollarını açar. Ekran yazısı **"3 KALBİ VAR?!"** | "Bir ahtapotun tam üç kalbi olduğunu biliyor muydun?" |
| 7–17 sn | 2 · Üç kalp | Kamera yanından arkasına döner; manto yarı saydamlaşır. İki solungaç kalbi solungaçların dibinde, sistemik kalp ortada; mavi tonlu akış okları | "İki kalbi kanı solungaçlara gönderir." / "Üçüncü kalbi ise kanı vücuduna pompalar." |
| 17–30 sn | 3 · İşlev | Ahtapot yüzer, kamera takip eder; O₂ parçacıkları sudan solungaçlara akar, solungaçlar oksijenle mavileşir; dolaşım sırayla vurgulanır; "Ahtapot kanı mavidir – hemosiyanin" notu | "Ahtapotlar oksijeni sudan solungaçlarıyla alır." / "Üç kalbin görev paylaşımı…" |
| 30–42,5 sn | 4 · Final | Manto önde, kollar arkada jet yüzüşü; sistemik kalp ritmi göstergesi yavaşlar; kamera geri çekilip resifi gösterir; ahtapot kollarıyla el sallar. **"Doğanın daha ne sırları var? 🌊"** | "Üstelik yüzmek, … yavaşlatabilir." / "İşte bu yüzden …" |

## Bilimsel notlar

* **İki solungaç (branşiyal) kalbi**, her biri bir solungacın dibinde: kanı solungaçlardan geçirir.
* **Bir sistemik kalp**, ortada: solungaçlardan gelen oksijenli kanı vücudun geri kalanına pompalar.
* Renk kodu: açık gri-mavi = oksijeni azalmış kan, koyu/parlak mavi = oksijenli kan
  (bakır içeren **hemosiyanin** oksijen bağlayınca mavi görünür).
* Jet yüzüşü sırasında **sistemik kalbin atışı yavaşlar** (hatta durabilir); solungaç kalpleri pompalamaya devam eder.
  Videoda ritim göstergesi ve kalp sesleri bu yavaşlamayla eş zamanlıdır.
* Anatomi şematiktir (eğitim amaçlı sadeleştirme): organların göreli konumu doğru, oranlar çizgi film ölçüsündedir.

## Yeniden üretme

```bash
npm install
node render.cjs --format vertical --from 0 --to 42.5 --out out/video_vertical_noaudio.mp4
python3 audio/make_audio.py          # cues.json dosyaları render'dan gelir
ffmpeg -i out/video_vertical_noaudio.mp4 -i out/soundtrack.wav -c:v libx264 -crf 19 -pix_fmt yuv420p \
  -af "volume=3.8dB,alimiter=limit=0.891:level=false" -c:a aac -b:a 192k -shortest out/ahtapotun-3-kalbi_shorts.mp4
```

Test kareleri: `node render.cjs --format vertical --stills 5.5,12.8,23.5`
