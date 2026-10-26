# Rüya — Sinematik 3D YouTube Shorts üretim sistemi

Dikey (9:16) kısa filmleri, gerçek 3D sahne, iskeletli karakter ve kurgu
mantığıyla üreten, tamamen kod tabanlı bir animasyon hattı.

**Bölüm 1 — "Maaşım yattı, nereye gitti?"** (~41 sn, 5 sahne, 24 çekim)

```
UMUT → RAHATLAMA → GERÇEKLE YÜZLEŞME → BASKI → TERS KÖŞE
```

## Hızlı başlangıç

```bash
npm install                       # three.js
node tools/serve.mjs 8080         # http://127.0.0.1:8080/  → etkileşimli önizleme
# final video (720×1280 render → 1080×1920 Lanczos, 24 fps, seçili çekimlerde hareket bulanıklığı)
node tools/render.mjs --out out/ep01.mp4 --scale 0.6667 --upscale 1080:1920
python3 tools/audio.py out/ep01.cues.json out/ep01.wav
ffmpeg -i out/ep01.video.mp4 -i out/ep01.wav -c:v copy -c:a aac -shortest out/ep01_final.mp4
# hızlı kontrol araçları
node tools/contact.mjs out/contact.jpg 0.3     # her çekimin orta karesi tek görselde
node tools/still.mjs "lab.html?view=face&emo=defeated" out/face.png   # karakter laboratuvarı
```

Önizleme sayfasında zaman çubuğu, sahne/çekim işaretleri, kalite seçimi ve
hareket bulanıklığı anahtarı vardır.

## Mimari

| Katman | Dosya | Ne yapar |
|---|---|---|
| Render | `src/core/renderer.js` | HDR sahne (4× MSAA) → alt-kare biriktirme (gerçek obtüratör hareket bulanıklığı + alt-piksel titreşimi) → derinlik tamponundan alan derinliği (ince-mercek CoC) → bloom → ACES ton eşleme, renk derecelendirme, vinyet, film greni → HUD |
| Malzemeler | `src/core/materials.js`, `textures.js` | Cilt (kanal başına sarmalı ışık = yüzey altı saçılma yaklaşımı), saç (anizotropik), kumaş (sheen + örgü/dokuma kabartması), cam, metal, ahşap, seramik, plastik — hepsi prosedürel doku ve pürüzlülük varyasyonuyla |
| Karakter | `src/character/*` | 66 kemikli iskelet, skinned giysi/eller, analitik 2-kemik IK (kollar/bacaklar), 17 morph'lu yüz (çene, gülümseme/üzüntü L/R, dudak şekilleri, kaşlar, yanak), gerçek ağız açıklığı + diş/dil, morph'lu göz kapakları ve kirpikler, iris/kornealı göz küresi, alfa-kart saç, 3D kaşlar |
| Duygu | `expressions.js` | Her duygu = yüz morph'ları + göz kapağı + duruş (çökme, omuz, baş eğimi) + nefes hızı/derinliği |
| Dudak senkronu | `lipsync.js` | Türkçe metinden vizem (harf→ağız şekli, ko-artikülasyon) |
| Performans | `src/film/performance.js` | Harmanlanan poz anahtarları, el hedefleri (tutulan nesnenin dünya matrisi + kavrama matrisi), ayak basmalı prosedürel yürüyüş, göz kırpma, sakkad (okuma/tedirgin bakış), nefes |
| Set | `src/world/*` | Stüdyo daire (panjurlu pencere, yatak köşesi, mutfak, masa, giriş duvarı), ışık durumları (sabah/sıcak/bulutlu/tükenmiş), telefon (canlı ekran dokusu + ekran ışığı), buhar, toz, ışık huzmesi, su akışı |
| Kurgu | `src/film/film.js` | **Performans zamanı ≠ film zamanı.** Karakter kesintisiz oynar; kurgu listesi (EDL) her çekimde performansın bir aralığını farklı kamerayla "çeker". Kesmeler doğal zaman atlamaları yaratır; ses olayları kurguya göre otomatik yerleşir |
| Bölüm | `episodes/ep01_maas/episode.js` | Senaryo: poz blokları, duygu/ışık/renk zaman çizelgeleri, telefon ekran akışı, altyazılar, sahnedeki bilgi kartları, ses işaretleri, 24 çekimlik EDL |
| Ses | `tools/audio.py` | Oda tonu, titreşim (masa/cep), bildirimler, adımlar, kumaş hışırtısı, su dökme, yudum, tuşlar, ret sesi, nefesler ve uyarlanır müzik — numpy ile prosedürel |

### Yeni bölüm eklemek
Aynı karakter, malzemeler, set, ışık durumları ve kamera yardımcıları
(`camFace`, `camPOV`, `camOTS`, `dolly`) yeniden kullanılır. Yeni bir
`episodes/<ad>/episode.js` yazıp `src/main.js` içindeki içe aktarmayı
değiştirmek yeterlidir.

## Hikâye ve duygu tasarımı (Bölüm 1)

| Sahne | Duygu | Görünür neden | Bedende/kamerada |
|---|---|---|---|
| UMUT | Yorgunluk → umut → rahatlama | Komodindeki telefon titrer: "Maaşınız yattı +32.500 TL" | Göz ovuşturma, uzanma, ekran ışığı yüze vurur, derin nefes alıp verme, "Oh be…" |
| RAHATLAMA | Kısa süreli mutluluk | Güneş açar (ışık soğuktan sıcağa), kahve demlenir | Kalkış, yürüyüş, su dökme detayı, ilk yudum, sıcak renk derecelendirmesi |
| GERÇEKLE YÜZLEŞME | Şüphe → farkına varma | Cepte titreşim; kira, elektrik, doğalgaz bildirimleri | Yudumun ortasında donma, gülümsemenin yavaşça sönmesi, ekrana eğilme, "Bir dakika…", bakiye sayacı düşer; bir bulut güneşi kapatır |
| BASKI | Kaygı → panik → çaresizlik | Yeni otomatik ödemeler yağar; hesap makinesi 2.781 TL der | Omuzlar kalkar, nefes hızlanır, telefon titrer, kurgu hızlanır, "Yanlış hesapladım herhalde…", yeniden daha hızlı tuşlama, geriye yaslanıp tavana bakma (yüksek açı) |
| TERS KÖŞE | Umut kırıntısı → şok → kendisiyle dalga geçen kabulleniş | 145 TL'lik latte reddedilir: unutulan kredi kartı ekstresi kalan 2.781 TL'yi otomatik çekmiştir — ekstrenin en büyük kalemi **Kahve Durağı · 23 işlem** | Kırmızı ekran ışığı yüze vurur, donma, telefonu ters çevirme, soğumuş ev kahvesinden yudum ve yüz buruşturma, kameraya sessiz yenik gülümseme |

Ters köşe mantıklıdır (bakiye bilgisi baştan beri ekranda, kart ekstresi
gerçek bir otomatik ödeme) ama beklenmediktir (kendine ödül olarak
düşündüğü alışkanlık, paranın gittiği yerdir). Buhar, B bloğu boyunca
azalır: kahvenin soğuması son yudumun ironisini hazırlar.

## Dürüst teknik sınırlar

Bu ortamda GPU yok; görüntü Chromium + **SwiftShader (yazılımsal Vulkan)** ile
CPU'da render edilir. Bunun sonuçları ve bilinçli tercihler:

- **Çözünürlük:** Final 720×1280 render edilip 1080×1920'ye Lanczos ile
  büyütülür (kare süresi bütçesi; aşağıdaki ölçümlere bakın). GPU'lu bir
  makinede `--scale 1` ile doğrudan 1080×1920 alınabilir.
- **Hareket bulanıklığı** gerçek alt-kare biriktirmedir, ancak maliyet
  nedeniyle yalnızca hızlı aksiyon çekimlerinde (yürüyüş, su dökme,
  tuşlama) açıktır.
- **Global aydınlatma yok:** yansıma ve sekme ışığı, odanın kendisinden her
  ışık durumu için yakalanan ortam haritalarıyla ve dolgu ışıklarıyla
  yaklaşıklanır. Yüzey altı saçılma gerçek değil, sarmalı ışık
  yaklaşımıdır.
- **Saç ve kumaş simülasyonu yok:** saç alfa kartlardır, giysi kırışıkları
  modellenmiştir; fiziksel simülasyon yapılmaz.
- **Karakter** bir sanatçının yonttuğu model değil, tamamen kodla üretilmiş
  stilize bir modeldir; yüz oranları ve eller film stüdyosu kalitesinde
  değildir. Eller nesnelerle yaklaşık temas eder (çarpışma çözümü yok).
- **Ses:** Seslendirme (diyalog) üretilmez. Dudak senkronu metinden
  üretilmiştir ve zamanlamalar `out/ep01.vo.txt` dosyasında bir oyuncu ya da
  TTS ile kaydedilmek üzere hazırdır. Efektler ve müzik prosedürel olarak
  sentezlenir; stüdyo kütüphanesi kalitesinde değildir. Harici ses servisine
  bağımlılık eklenmedi.
- Altyazılar videoya gömülüdür ve ayrıca `out/ep01.srt` olarak verilir
  (sessiz izlemeye uygun). Ekran yazıları Shorts güvenli alanında tutulur.

## Ölçümler

Ayrıntılar `out/*.log.json` dosyalarındadır (bkz. aşağıdaki "Render
süreleri" bölümü — final render sonrası güncellenir).
