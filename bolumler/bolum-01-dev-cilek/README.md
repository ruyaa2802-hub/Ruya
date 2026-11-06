# Piko & Moko – Bölüm 1: Dev Çilek 🍓

- **Video:** `piko-moko-bolum-01-dev-cilek.mp4` (30 sn, 1080×1920 dikey 9:16, 30 fps, H.264 + AAC)
- **Diyalog/altyazı/anlatıcı yok.** Müzik ve tüm efektler kodla sentezlendi (telifsiz).
- **v2:** Aksiyonla senkron neşeli çizgi film skoru (pizzicato, marimba, tuba, klarnet, trombon), kameraman gibi yumuşak kamera takibi, otomatik göz kırpma/nefes, daha canlı renkler.
- Tamamen ücretsiz araçlarla üretildi: Three.js (3D), Chromium (render), Python/numpy (ses), ffmpeg (birleştirme).

## Sahne akışı
| Süre | Sahne |
|---|---|
| 0–5 sn | **Merak:** Piko bahçede yürür, dev çileği görüp donar, gözleri büyür; etrafında dolaşır. Moko korkuyla gelir. |
| 5–10 sn | **Felaket başlıyor:** Piko titreyerek çileği kaldırır, gururla Moko'ya döner; çilek kayar, düşer, yuvarlanır. |
| 10–18 sn | **Kovalamaca:** Çilek tepeden tümseklerden zıplayarak iner; Piko önde, Moko minik bacaklarıyla arkada. |
| 18–25 sn | **Büyük patlama:** Çilek uçurum kenarında durur; Piko sevinip üstüne zıplar, çilek patlar, ikisi de kırmızıya bulanır. Yaprak tacı Moko'nun kafasına konar. |
| 25–30 sn | **Komik final:** Moko püreyi yalar; minik bir çilek Piko'nun kafasına PAT diye düşer. Son kare açılış kadrajıyla aynı → döngü. |

## Yeniden üretmek
```bash
npm install three@0.169.0 playwright     # bu klasörde
python3 -m http.server 8765 &            # bu klasörde
# ep1.html içindeki importmap'i yerel node_modules'e çevirmek isterseniz düzenleyin (varsayılan unpkg CDN)
for w in 0 1 2 3; do node render.js $w 4 frames & done; wait
python3 audio.py ep1.wav
ffmpeg -framerate 30 -i frames/f%04d.jpg -i ep1.wav -c:v libx264 -pix_fmt yuv420p -crf 18 -c:a aac -b:a 192k -shortest out.mp4
```
