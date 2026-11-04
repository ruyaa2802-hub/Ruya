# ElevenLabs seslendirme — İNSAN ATLASI #01: "İnsan neden bazen hiçbir sebep yokken ağlamak ister?"

Sistem hiçbir API çağrısı yapmaz; bu metni ElevenLabs'te **sen** üretirsin.

## Ayarlar
| Ayar | Değer |
|---|---|
| Ses | **Su – Gentle & Expressive Storytelling** (kadın, Bölüm 2 ile aynı) — alternatif: Ömer – Calm, Natural and Young (erkek) |
| Model | Eleven v3 (önerilen) veya Multilingual v2 |
| Stability / Similarity / Style | 0.60 / 0.75 / 0.15 (duygusal ama abartısız) |
| Hız | 0.95 (biraz yavaş, nefes alan bir anlatım) |
| Çıktı | MP3, 44.1 kHz |
| Uzunluk | 502 karakter → yaklaşık 32–35 sn konuşma (≈ 500 kredi, tek deneme) |

> Kısaltılmış sürüm (30–35 sn). Video sese göre otomatik uzar/kısalır.

## Kopyalanacak metin (Eleven v3)
Paragraflar arasındaki **boş satırları silme** — sahne geçişleri bu duraklamalardan bulunur.

```
Hiç durduk yere ağlamak istedin mi? Belki bir sebep var… Sadece henüz fark etmedin.

Gün boyunca bastırdığın duygular, stres ve yorgunluk birikir. Zihnin sessizce yorulur.

Ağlamak sadece üzüntü değildir. Stres, yorgunluk, hormonlar, hatta mutluluk bile gözyaşı getirebilir. Bu, duyguları düzenlemenin bir yolu olabilir.

Büyük bir sebep gerekmez. Gözyaşın, hissettiklerinin bir yansıması. Kendini hep güçlü olmaya zorlama. Bazen hissetmek yeterlidir.

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
