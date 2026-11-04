# ElevenLabs seslendirme — İNSAN ATLASI #01: "İnsan neden bazen hiçbir sebep yokken ağlamak ister?"

Sistem hiçbir API çağrısı yapmaz; bu metni ElevenLabs'te **sen** üretirsin.

## Ayarlar
| Ayar | Değer |
|---|---|
| Ses | Sakin, sıcak, yavaş bir Türkçe anlatıcı. Öneri: **Su – Gentle & Expressive Storytelling** (kadın) ya da **Ömer – Calm, Natural and Young** (erkek) |
| Model | Eleven v3 (önerilen) veya Multilingual v2 |
| Stability / Similarity / Style | 0.60 / 0.75 / 0.15 (duygusal ama abartısız) |
| Hız | 0.95 (biraz yavaş, nefes alan bir anlatım) |
| Çıktı | MP3, 44.1 kHz |
| Uzunluk | 757 karakter → yaklaşık 48–52 sn (≈ 760 kredi, tek deneme) |

> Not: Bu metin 30 saniyeye sığmaz; doğal hızda ~50 sn sürer. Video sese göre otomatik uzar/kısalır, metni kısaltmana gerek yok.

## Kopyalanacak metin (Eleven v3)
Paragraflar arasındaki **boş satırları silme** — sahne geçişleri bu duraklamalardan bulunur.

```
Hiç durduk yere ağlamak istedin mi? Belki de ortada hiçbir sebep yok değil… Sen sadece henüz fark etmedin.

Bazen gün boyunca bastırdığımız duygular, fark etmediğimiz stres ve zihinsel yorgunluk birikir. Gün içinde güçlü kalmaya çalışırken bedenimiz ve zihnimiz sessizce yorulabilir.

Üstelik ağlamak yalnızca üzüntüyle ilgili değildir. Yoğun stres, yorgunluk, hormonal değişimler ve bazen mutluluk bile gözyaşlarını tetikleyebilir. Beynimiz duygularımızı düzenlerken ağlamak da bu deneyimin bir parçası olabilir.

Yani bazen ağlamak için büyük bir olay yaşaman gerekmez. Gözyaşların, yaşadığın duyguların bir yansıması olabilir. Kendini sürekli güçlü olmak zorunda hissetme. Bazen hissetmek de yeterlidir.

İnsan sandığından çok daha gizemli. İnsan Atlası.
```

### Multilingual v2 kullanırsan
Her paragrafın sonuna `<break time="0.8s" />` ekle.

## Yükleme
`videolar/insan-atlasi-01-aglama/ses/seslendirme.mp3`

iPhone: ElevenLabs'ten MP3'ü indir → Safari'de GitHub → bu klasör → **Add file → Upload files** → Commit.

## Bilimsel notlar (görsellerde kullanılanlar)
- **Amigdala:** duygusal tepkilerin işlenmesinde rol oynar.
- **Hipotalamus:** stres yanıtı ve hormon düzenlemesiyle ilişkilidir.
- **Prefrontal korteks:** duyguların düzenlenmesinde görev alır.
- **Gözyaşı bezi:** duygusal gözyaşları beyin sapından yüz siniri yoluyla gelen sinyallerle salgılanır (videoda sadeleştirilmiş bir yol olarak gösterildi).
