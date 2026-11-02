# ElevenLabs seslendirme — Bölüm 2: "Neden gıdıklanırız?"

Sistem hiçbir API çağrısı yapmaz; bu metni ElevenLabs'te **sen** üretirsin.

## Ayarlar
| Ayar | Değer |
|---|---|
| Ses | Uğur – Turkish Documentary Narrator (Bölüm 1 ile aynı ses = seri bütünlüğü) |
| Model | Eleven v3 (önerilen) veya Multilingual v2 |
| Stability / Similarity / Style | 0.50 / 0.75 / 0.25 (bu konu biraz daha neşeli) |
| Çıktı | MP3, 44.1 kHz |
| Uzunluk | 680 karakter → yaklaşık 44–47 sn (≈ 700–750 kredi, tek deneme) |

## Kopyalanacak metin (Eleven v3)
Paragraflar arasındaki **boş satırları silme** — sahne geçişleri bu duraklamalardan bulunur.

```
Kendinizi gıdıklamayı hiç denediniz mi? Ne kadar uğraşırsanız uğraşın, işe yaramaz. Peki neden?

Aslında iki tür gıdıklanma var. Biri, tenimize tüy değmiş gibi hafif bir kaşıntı hissi. Diğeri ise kaburgalarımıza ya da koltuk altımıza yapılan, bizi kahkahaya boğan gıdıklama.

Kendinize dokunduğunuzda beyniniz, özellikle de beyincik, bu hissi önceden tahmin ediyor ve etkisini azaltıyor. Sürpriz olmayınca, gıdıklanma da olmuyor.

Bilim insanlarına göre gıdıklanma, oyun sırasında aramızdaki bağı güçlendiriyor olabilir. Üstelik bu yalnızca bize özgü değil: Şempanzeler, hatta fareler bile gıdıklanınca gülmeye benzer sesler çıkarıyor. Farelerin bu sesini ise kulağımız duyamıyor!
```

### Multilingual v2 kullanırsan
Her paragrafın sonuna `<break time="0.7s" />` ekle.

## Yükleme
`videolar/neden-gidiklaniriz/ses/seslendirme.mp3`

## Bilimsel notlar (videoda kullanılan bilgiler)
- İki tür: *knismesis* (hafif, kaşıntı benzeri) ve *gargalesis* (kahkahalı) — literatürdeki standart ayrım.
- Kendini gıdıklayamama: beyincik, kendi hareketimizin duyusal sonucunu tahmin edip tepkiyi azaltır (Blakemore, Wolpert & Frith çalışmaları).
- Sosyal bağ: yaygın bir hipotez olduğu için metinde "olabilir" diye anlatıldı.
- Şempanzeler gıdıklanınca gülmeye benzer sesler çıkarır; fareler ~50 kHz ultrasonik sesler çıkarır (Panksepp). İnsan işitmesi ~20 kHz'e kadardır.
