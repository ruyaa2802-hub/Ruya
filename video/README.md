# Herkes 100 Yaşına Kadar Genç Kalsaydı? — YouTube Shorts

35 sn · 1080x1920 · 30 FPS · H.264 + AAC · seslendirmesiz (anlatım ekrandaki altyazılarla)

Çıktı: `output/100_yas_shorts.mp4`

## Tamamen ücretsiz araçlar
| Ne | Araç |
|---|---|
| 3D sahneler (şehir, görüşme odası, karakterler) | Three.js 0.160 (WebGL) |
| 2.5D paralaks çekimler | Verdiğin 3 fotoğraf + elle tasarlanmış derinlik haritaları (`prep.py`) |
| Kare kare render | Headless Chromium (Playwright) + SwiftShader |
| Müzik + efektler | Python / NumPy / SciPy ile prosedürel sentez (`audio.py`) — telifsiz |
| Kodlama / birleştirme | FFmpeg |
| Yazı tipleri | Montserrat, Oswald (@fontsource, OFL lisans) |

Ücretli API, kredi veya üretken video servisi kullanılmadı.

## Sahne planı
| Süre | Görüntü | Ekran yazısı |
|---|---|---|
| 0–2.7 | Küvözdeki bebek (foto, paralaks + EKG HUD) | Ya insanlar 100 yaşına kadar hiç yaşlanmasaydı? |
| 2.7–5.0 | 3D klinik: Emre bebeklikten 25'e büyür, sayaç "25 · SABİT" | |
| 5.0–9.0 | Neon gece şehri (foto, yağmur + uçan araçlar) | İnsanlar artık yaşlanmıyordu… |
| 9.0–13.0 | 3D şehir uçuşu, metro, nüfus panosu | …ama her gün yeni insanlar doğuyordu. |
| 13.0–19.0 | Görüşme odası: Arda (90, beyaz saç) & Emre (25) · KABUL / RED | 90 yaşındaki insanlar hâlâ çalışıyor… |
| 19.0–25.0 | Emre çıkar, yağmurda yürür; Arda pencereden izler | 25 yaşındaki çocuklar… yarışıyordu. |
| 25.0–29.4 | Gün batımı şehir (foto, paralaks) | İnsanlık daha uzun yaşamayı başarmıştı… |
| 29.4–35.0 | Baba-oğul çatıda → kamera gökyüzüne yükselir | …ama daha iyi yaşamayı değil. / Bu dünya sence CENNET mi olurdu, CEHENNEM mi? |

## Yeniden üretmek
```bash
cd video
npm install                     # three + fontlar
python3 prep.py                 # foto büyütme + derinlik haritaları
node render.mjs 0 1050 output/video_sessiz.mp4      # (ya da parçalara bölüp paralel)
python3 audio.py                # output/ses.wav
ffmpeg -i output/video_sessiz.mp4 -i output/ses.wav -c:v copy -c:a aac -b:a 192k \
  -af loudnorm=I=-14:TP=-1.5 -shortest output/100_yas_shorts.mp4
```
Test kareleri: `node render.mjs --still 1,11,18 /tmp/kareler 0.5`

Not: karakterler prosedürel stilize 3D modellerdir (aynı model tüm sahnelerde → tutarlı yüz/saç/kıyafet). Pixar seviyesinde render ücretsiz/yerel araçlarla mümkün değil; bunun yerine sinematik ışık, bloom, sis, yağmur ve fotoğraf paralaksı kullanıldı.
