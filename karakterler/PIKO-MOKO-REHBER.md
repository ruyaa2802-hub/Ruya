# Piko & Moko: Karakter Rehberi

## ✅ ONAYLI TASARIM: Piko (3D oyuncak stili)
- Resmî görsel: `piko-3d.png` · Model kaynağı: `piko-3d.html` (Three.js; tarayıcıda açınca aynı görseli üretir)
- Stil: yumuşak mat kil/oyuncak dokusu, stüdyo ışığı, açık lavanta zemin
- Gövde gök mavisi `#4FA6EC`, ayaklar şeftali `#F0A77E`, yanaklar pembe
- Beyaz çerçeveli kocaman parlak siyah gözler, açık gülümseme, kıvrık anten
- Bundan sonraki tüm sahneler bu modele göre üretilecek.

## ✅ ONAYLI TASARIM: Moko (3D oyuncak stili)
- Resmî görsel: `moko-3d.png` · Model kaynağı: `moko-3d.html` (Three.js)
- Gövde turuncu `#F27D16`, köşeleri yumuşatılmış kare, 4 kısa tombul bacak
- Kalın turuncu çerçeveli kocaman parlak siyah gözler, krem göz akı `#FFF1DC`
- Kahverengi endişeli kaşlar `#7A4A2A` (iç uçlar yukarı), iki büyük ön diş, hafif pembe yanaklar

## Çizim tekniği (tüm bölümler için sabit)
- Three.js ile 3D model → yumuşak mat kil/oyuncak materyali, stüdyo ışığı, ACES ton eşleme
- Açık lavanta zemin, yumuşak zemin gölgesi
- Eski 2D çizimler (`piko.svg/png`, `moko.svg/png`, `piko-moko-sayfa.png`) yalnızca ilk taslaktır.

---

Dosyalar: `piko.svg/png`, `moko.svg/png`, `piko-moko-sayfa.png` (karakter sayfası).
SVG'ler ücretsiz programlarda (Inkscape, Figma ücretsiz plan, tarayıcı) açılıp düzenlenebilir.

## Değişmeyecek kurallar (her bölümde aynı)
| | PİKO | MOKO |
|---|---|---|
| Gövde | Kusursuz yuvarlak top, kocaman açık mavi göbek | Köşeleri yuvarlatılmış kare |
| Renk | Mavi `#3FA4F0`, koyu `#2373CF`, göbek `#BFE5FF` | Turuncu `#FF9A3C`, koyu `#EA6D18`, yüz `#FFF3DF` |
| Kontur | Lacivert `#173A66`, kalın | Kahverengi `#6B2F0C`, kalın |
| Göz | Dev, mavi iris, 2 beyaz parıltı + 1 yıldız | Dev, kahverengi iris, 2 beyaz parıltı + 1 yıldız |
| İmza detay | Tepede kıvrık anten (soru işareti gibi) | Tepede 3 tel tüy, 2 büyük ön diş |
| Uzuv | Kısa yuvarlak kollar, bacaksız, tombul ayaklar | Kısa kollar, kısa ince bacaklar, oval ayaklar |
| Varsayılan ifade | Bir kaşı havada, kendinden emin sırıtış | Endişeli kaşlar, ter damlası, elinde kurabiye |

## Ücretsiz araçlarda tutarlı üretim
1. `piko.png` ve `moko.png`yi **referans görsel** olarak yükle (Google Flow/Whisk'te "ingredient/subject", diğer araçlarda image reference).
2. Aşağıdaki sabit tanımı **her prompt'un başına aynen** yapıştır, sadece sahneyi değiştir.
3. Ücretsiz kotalar araçtan araca ve zamanla değişiyor; günlük krediyi bitirmemek için önce tek görsel, sonra video üret.

**Sabit stil:**
```
2D cute cartoon style, thick dark outlines, soft gradient shading, glossy highlights, huge sparkling eyes with two white highlights and a small star sparkle, kawaii, children's animated short, clean vertical 9:16 frame.
```

**Piko:**
```
PIKO: a small perfectly round blue ball-shaped creature (#3FA4F0), a huge pale-blue round belly, no visible legs, two chubby little feet, tiny stubby arms, a single curly antenna on top shaped like a question mark, huge sparkling blue eyes, one eyebrow raised, confident cheeky grin, pink blush cheeks, navy outline.
```

**Moko:**
```
MOKO: a small orange rounded-square creature (#FF9A3C), cream face patch, short thin legs with oval feet, tiny stubby arms, three thin hair strands on top, huge sparkling brown eyes, worried eyebrows, two big buck teeth, pink blush cheeks, a sweat drop, brown outline, often holding a bitten cookie.
```

**Örnek sahne:**
```
[Sabit stil] [Piko] [Moko] — Piko excitedly points at a mysterious glowing button in a forest, Moko hides behind him trembling and nibbling a cookie.
```

**Negatif (destekleyen araçlarda):** `realistic, 3D render, extra limbs, long arms, sharp teeth, scary, different colors, text, watermark`
