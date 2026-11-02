# ElevenLabs seslendirme — "Korktuğumuzda neden tüylerimiz diken diken olur?"

Bu dosyayı **sen** ElevenLabs'te kullanırsın. Sistem hiçbir API çağrısı yapmaz, kredi harcamaz.

## 1) Ayarlar
| Ayar | Değer |
|---|---|
| Ses | **Uğur – Turkish Documentary Narrator** (önceki denemede kullanılan ses) — ya da beğendiğin herhangi bir Türkçe anlatıcı |
| Model | Eleven v3 (önerilen) veya Eleven Multilingual v2 |
| Stability / Similarity / Style | 0.50 / 0.75 / 0.20 |
| Hız | 1.0 |
| Çıktı | MP3, 44.1 kHz, 128 kbps |
| Uzunluk | ~811 karakter → yaklaşık 50–52 sn ses (≈ 800–900 kredi, tek deneme) |

**Kredi tasarrufu:** Önce tek seferde üret, dinle. Beğenmediğin tek bir cümle varsa sadece onu yeniden üretmek yerine tüm metni yeniden üret (sistem tek dosya bekler).

## 2) Kopyalanacak metin (Eleven v3 için)
Paragraflar arasındaki **boş satırları silme** — sistem sahne geçişlerini bu duraklamalardan otomatik bulur.

```
Hiç korktuğunuzda veya ürperdiğinizde kollarınızdaki tüylerin aniden diken diken olduğunu fark ettiniz mi? Peki vücudunuz bunu neden yapıyor?

Aslında derimizin altında, her kıl köküne bağlı küçücük kaslar bulunuyor. Bunlara kıl dikleştirici kaslar deniyor. Korktuğumuzda sinir sistemimiz bu kasları harekete geçiriyor ve tüylerimiz dikleşiyor.

Bu mekanizma aslında çok eski bir hayatta kalma yönteminden geliyor. Atalarımızın vücut kılları kabardığında daha büyük ve korkutucu görünmelerine yardımcı oluyordu. Aynı zamanda soğukta vücut çevresinde hava tabakası oluşturarak ısı kaybını azaltıyordu.

İnsanlar zamanla vücut kıllarının büyük bölümünü kaybetti. Ama bu eski mekanizma hâlâ bizimle. Yani korktuğumuzda tüylerimizin diken diken olması, vücudumuzun milyonlarca yıllık geçmişinden kalan küçük bir iz!
```

### Multilingual v2 kullanırsan
Paragraf sonlarına duraklama etiketi ekle (v2 bunu okur, seslendirmez):

```
Hiç korktuğunuzda veya ürperdiğinizde kollarınızdaki tüylerin aniden diken diken olduğunu fark ettiniz mi? Peki vücudunuz bunu neden yapıyor? <break time="0.7s" />
Aslında derimizin altında, her kıl köküne bağlı küçücük kaslar bulunuyor. Bunlara kıl dikleştirici kaslar deniyor. Korktuğumuzda sinir sistemimiz bu kasları harekete geçiriyor ve tüylerimiz dikleşiyor. <break time="0.7s" />
Bu mekanizma aslında çok eski bir hayatta kalma yönteminden geliyor. Atalarımızın vücut kılları kabardığında daha büyük ve korkutucu görünmelerine yardımcı oluyordu. Aynı zamanda soğukta vücut çevresinde hava tabakası oluşturarak ısı kaybını azaltıyordu. <break time="0.7s" />
İnsanlar zamanla vücut kıllarının büyük bölümünü kaybetti. Ama bu eski mekanizma hâlâ bizimle. Yani korktuğumuzda tüylerimizin diken diken olması, vücudumuzun milyonlarca yıllık geçmişinden kalan küçük bir iz!
```

## 3) Yükleme
İndirdiğin dosyayı **tam olarak** şu ada ve konuma yükle:

```
videolar/tuyler-diken-diken/ses/seslendirme.mp3
```

(iPhone adımları için kök klasördeki `README.md` → "iPhone'dan kullanım".)

> Not: `arsiv/eski-seslendirme-v1.mp3` önceki oturumda zaten üretilmiş (kredisi ödenmiş) aynı metnin seslendirmesi. Yeni kredi harcamak istemezsen bu dosyayı `ses/seslendirme.mp3` olarak kopyalaman yeterli.
