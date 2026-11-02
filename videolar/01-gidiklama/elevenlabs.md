# ElevenLabs seslendirme — 01 · Neden kendimizi gıdıklayamayız?

> Bu dosya yalnızca **senin** ElevenLabs'te elle üretmen içindir. Sistem hiçbir API çağrısı yapmaz,
> kredi harcamaz. Sesi üretip yüklediğinde video otomatik olarak sese oturtulur.

## Ayarlar (bu konuşmada kullandığımız ses)

| Ayar | Değer |
|---|---|
| Ses (Voice ID) | `i0MwGlmJMVRT2teAFS3N` |
| Model | Eleven v3 |
| Dil | Türkçe |
| Çıktı | MP3 44.1 kHz 128 kbps |
| Dosya adı | `seslendirme.mp3` |

Not: Bu video için ses zaten üretildi (2 Kasım, flow `ej5WAwzMY5rhzL91rEyZ`) ve
`ses/seslendirme.wav` olarak yüklü. Yeniden üretmene gerek yok.

## Yapıştırılacak metin (tek seferde, tek dosya)

```
Kendinizi gıdıklamayı hiç denediniz mi? Ne kadar uğraşırsanız uğraşın, işe yaramaz. Peki neden?

Aslında iki tür gıdıklanma var. Biri, tenimize tüy değmiş gibi hafif bir kaşıntı hissi. Diğeri ise kaburgalarımıza ya da koltuk altımıza yapılan, bizi kahkahaya boğan gıdıklama.

Kendinize dokunduğunuzda beyniniz, özellikle de beyincik, bu hissi önceden tahmin ediyor ve etkisini azaltıyor. Sürpriz olmayınca, gıdıklanma da olmuyor.

Bilim insanlarına göre gıdıklanma, oyun sırasında aramızdaki bağı güçlendiriyor olabilir. Üstelik bu yalnızca bize özgü değil: Şempanzeler, hatta fareler bile gıdıklanınca gülmeye benzer sesler çıkarıyor. Farelerin bu sesini ise kulağımız duyamıyor!
```

Yaklaşık 47 saniye. Cümleler arasında doğal duraklama olsun; sistem cümleleri bu duraklamalardan buluyor.

## iPhone'da adımlar

1. ElevenLabs uygulaması/sitesi → **Text to Speech** → sesi seç (yukarıdaki Voice ID) → model **Eleven v3**.
2. Metni yapıştır → **Generate** → beğendiğin versiyonu **Download** (MP3).
3. Dosyayı **`seslendirme.mp3`** adıyla şu klasöre yükle: `videolar/01-gidiklama/ses/`
   - GitHub uygulaması/Safari: repo → klasör → **Add file → Upload files**, ya da
   - Claude sohbetine dosyayı ekle, "sesi yükledim, finali hazırla" yaz.
4. Final video: `videolar/01-gidiklama/cikti/final.mp4`.
