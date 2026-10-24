# Sinematik biyografi video hattı (prototip)

Hedef: 45–60 saniyelik dikey (9:16) bir biyografi videosu. Sahneler hareketli
görüntülerden oluşur, anlatım Türkçedir, metin azdır.

Bu klasör şu an **kurgu ve MP4 birleştirme aşamasını** içerir. Gerçekçi hareketli
karakter üretimi için bağlı bir video sağlayıcısı henüz yok (aşağıda).

## Durum

| Aşama | Durum |
| --- | --- |
| Türkçe seslendirme (ElevenLabs TTS) | Doğrulandı. `A. Umit Gunacti - Cinematic Narrator` sesiyle 5,5–5,7 sn test anlatımı üretildi. Maliyet: 2 varyasyon, 150 kredi (yaklaşık 0,015 USD). |
| Hareketli karakter klipleri | **Engel.** Bu ElevenLabs hesabında video üretimi ücretli plan gerektiriyor. Test sahnesi üretilemedi. |
| Kurgu ve MP4 dışa aktarma (ffmpeg) | Çalışıyor. Testlerle doğrulandı (`test_assemble.py`). |
| Araştırma, senaryo, karakter referansı | Henüz yok. |
| Harici video API entegrasyonu | Yok. Sağlayıcı ve hesap seçimi gerekiyor. |

## Mimari

1. **Araştırma ve senaryo**: kaynaklı metin, 45–60 sn, sahne listesi.
2. **Karakter referansı**: her ana karakter için sabit referans görselleri.
3. **Sahne görselleri**: her çekim için kare üretimi (karakter referansı ile).
4. **Hareketli klipler**: her sahne için 5–15 sn video (görsel → video veya metin → video).
5. **Seslendirme**: sahne metninden Türkçe TTS, ortam sesi ve müzik ayrı katman.
6. **Kurgu ve dışa aktarma**: `assemble.py` klipleri 1080×1920, 30 fps olarak kırpar,
   çapraz geçişle birleştirir, anlatım ve müziği karıştırır, MP4 üretir.

Her çekim `shots/` içinde bir JSON dosyasıyla tanımlanır (karakter, hareket, kamera,
ışık, ortam, ses ve kabul kriterleri).

## Araçlar, anahtarlar ve kısıtlar

- **Anahtarlar**: API anahtarları yalnızca ortam değişkeni olarak verilir (ör.
  `ELEVENLABS_API_KEY`). Depoda anahtar yok ve kod içine gömülmez.
- **ElevenLabs**: Türkçe TTS çalışıyor. Video üretimi ücretli plan gerektiriyor.
  Model listesinde Seedance, Kling, Veo, Runway gibi video modelleri görünüyor; bunların
  kullanılabilmesi plana bağlı. Fiyat ve kota bu belgede doğrulanmadı.
- **Diğer bağlı servisler** (bu oturumda görünen): HyperFrames (HeyGen), Adobe, Canva,
  Descript, Orshot. Bunlar çoğunlukla tasarım, şablon ve kurgu araçları; gerçekçi
  insan hareketi üretmeleri bu hatta test edilmedi.
- **ffmpeg 6.1** ve **ffprobe** sistemde mevcut. GPU yok; yerel video üretimi pratik değil.

## Gerçek kişi kararı

Cem Yılmaz'ın gerçekçi, tanınabilir bir yapay zeka görüntüsünü veya sesini bu hatta
üretmiyorum. Gerçek bir kişinin rızası olmadan onun yapay zeka ile üretilmiş,
"gerçekmiş gibi" bir görüntüsünü ve sesini biyografi videosunda kullanmak yanıltıcıdır.
Bunun yerine:

1. **Kurgusal ana karakter**: bu prototipteki test sahnesi bu yolu izler.
2. **Belgesel düzeni**: Cem Yılmaz'ın lisanslı arşiv fotoğrafları ve görüntüleri (telif
   ve kullanım hakkı kullanıcıda), kaynaklı Türkçe anlatım, sahne geçişleri.
3. **Açık rıza ve etiket**: Cem Yılmaz'ın yazılı rızası ve yapay zeka üretimi görüntülerin
   açıkça etiketlenmesi. Bu ayrı bir karar gerektirir ve varsayılan değildir.

## Test sahnesi (8 sn)

`shots/test_scene.json`. Karakter kurgusaldır; yürür, kameraya yaklaşır, mikrofonu
kaldırır, başını çevirir ve gülümser. Kabul kriterleri geçmeden tam videoya geçilmez:

- Yüz ve kıyafet tüm karelerde aynı kalır.
- Yürüyüş doğal, ayaklar zemine basar.
- Mikrofon elde kalır, nesne yüzmez.
- El, uzuv ve parmak bozulmaz.
- Kamera hareketi sarsıntısız, ışık tutarlıdır.

## Çalıştırma

```bash
cd video_pipeline
python3 -m unittest -v          # ffmpeg testleri dahil
python3 assemble.py manifest.json
```

Manifest biçimi `assemble.py` başındaki docstring'de tanımlıdır. Göreli yollar manifest
dosyasının klasörüne göre çözülür. Çıktılar `build/` altına yazılır ve git'e alınmaz.

## Sonraki adımlar

1. Video sağlayıcısını seçin ve ilgili planı veya API anahtarını ortam değişkeni olarak
   sağlayın (ElevenLabs ücretli plan, HeyGen HyperFrames veya başka bir sağlayıcı).
2. Test sahnesini üretin, kabul kriterlerine göre değerlendirin.
3. Belgesel düzeni için kaynak ve arşiv materyalini belirleyin.
4. Araştırma ve senaryo aşamasını kaynaklı metinle ekleyin.
