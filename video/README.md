# Herkes 100 Yaşına Kadar Genç Kalsaydı? — kısa animasyon filmi (YouTube Shorts)

35 sn · 1080x1920 · 30 FPS · H.264 + AAC · seslendirme yok

Tek bir dikey görüntü akışı: ekranda her an yalnızca bir sahne var, sahneler kesme ya da geçişle birbirini izliyor. Kolaj, bölünmüş ekran veya storyboard yok.

| Dosya | İçerik |
|---|---|
| `output/film_temiz.mp4` | Görüntüde hiç yazı yok (müzik + efektler) |
| `output/film_altyazili.mp4` | Aynı film; altyazılar montaj aşamasında basıldı |
| `output/altyazi_tr.srt` | YouTube'a ayrı altyazı olarak yüklemek için |
| `output/altyazi.ass` | Stilli altyazı (Montserrat, vurgulu kelimeler) |

## Kurgu
| Süre | Sahne | Çekimler |
|---|---|---|
| 0–5 sn | **1. Doğum** | Yenidoğan odası, yağmurlu pencere, hemşire monitöre bakıyor → kamera küvözdeki bebeğe yaklaşıyor |
| 5–12 sn | **2. Büyüme (tek plan)** | Emre camlı koridorda kameraya yürürken 5 → 15 → 25 yaşına geliyor. Dışarıda günler hızla akıyor, gölgeler dönüyor; 25'te yüzü sabit kalıyor |
| 12–17 sn | **3. Yıllar sonra** | Vinç çekimi: gece şehrinin üstünden kalabalık caddeye iniliyor, Emre'nin arkasına geçiliyor |
| 17–28 sn | **4. İş görüşmesi** | Emre içeri girer → bekleyen babası Arda'yı (90, beyaz saçlı) görür → omuz üstü karşılıklı çekimler: Arda ayağa kalkar, konuşur, elini oğlunun omzuna koyar → hologram Arda'yı seçer → Emre'nin yakın planı → Emre çıkar → Arda pencereden bakar |
| 28–35 sn | **5. Final** | Gün batımında baba-oğul kalabalığın ortasında; kamera devasa nüfusun üstüne yükselir, müzik zirve yapıp kesilir |

## Araçlar (hepsi ücretsiz)
- Three.js 0.160: 3D sahneler, gölgeler, alan derinliği (bokeh), bloom
- Prosedürel insan modeli (`src/human.js`): gerçek oranlar, şekillendirilmiş yüz, göz kapağı/kaş/ağız animasyonu, yürüme, oturma, konuşma, yaş morfu. Arda ve Emre tüm sahnelerde aynı model.
- Headless Chromium (Playwright): kare kare render
- Python/NumPy/SciPy: telifsiz prosedürel müzik ve efektler (`audio.py`)
- FFmpeg + libass: montaj, ses miksajı, altyazı basımı

## Yeniden üretmek
```bash
cd video && npm install
PAGE=film node render.mjs 0 1050 output/video_sessiz.mp4        # veya parçalara bölüp paralel
python3 audio.py                                                  # output/ses.wav
ffmpeg -i output/video_sessiz.mp4 -i output/ses.wav -map 0:v -map 1:a -c:v libx264 -crf 19 \
  -af loudnorm=I=-14:TP=-1.5 -c:a aac -b:a 192k -shortest output/film_temiz.mp4
ffmpeg -i output/film_temiz.mp4 -vf "ass=output/altyazi.ass:fontsdir=fonts" -c:a copy output/film_altyazili.mp4
```
Test karesi: `PAGE=film node render.mjs --still 8,21.8 /tmp/kareler 0.5`

---

# Ya Ölümden Sonra Başka Bir Gerçeklikte Uyanıyorsak? — 40 sn

`output/esik/` · 1080x1920 · 30 FPS · tek akış, tam ekran, ardışık sahneler

| Dosya | İçerik |
|---|---|
| `esik_temiz.mp4` | Görüntüde yazı yok (yalnızca hikâyenin parçası olan "DENİZ" kapı plakası); müzik + efekt, seslendirme yok |
| `esik_yazili.mp4` | Açılış/kapanış yazıları ve diyalog altyazıları montajda basılmış sürüm |
| `diyalog_zamanlama.txt` | Seslendirme için zaman kodlu diyaloglar, oyunculuk notları, karakter ve mekân kimliği |
| `altyazi_tr.srt` / `altyazi.ass` | Ayrı altyazı dosyaları |

Kaynak: `src/esik.js` (sahneler), `src/human.js` (Deniz), `audio_esik.py` (müzik/efekt; diyalog anlarında müzik kısılır).
Render: `PAGE=esik node render.mjs 0 1200 output/esik/video_sessiz.mp4`
