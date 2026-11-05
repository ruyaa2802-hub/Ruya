# Ruya Studio — kredi harcamayan bilim videosu sistemi

YouTube Shorts / Instagram Reels için **1080×1920, 9:16, H.264, 30 FPS** sinematik bilim videoları.
Görüntülerin tamamı kodla çizilir (HTML Canvas + JavaScript), FFmpeg ile MP4'e dönüştürülür.
**Hiçbir ücretli görüntü/video/müzik API'si kullanılmaz.** Tek dış kaynak, senin ElevenLabs'te kendin ürettiğin seslendirme dosyasıdır.

## Mimari

```
senaryo.json ──► zamanlama (tahmini)  ──► sahneler.js (Canvas çizimi) ──► Chromium kare kare ──► FFmpeg ──► onizleme.mp4 (sessiz)
                     ▲                                                                                      │
seslendirme.mp3 ─────┘ (sessizlik analizi: bölüm/cümle/kelime zamanları)                                    ▼
                                         sentez müzik + efekt (kodla) ──► sidechain mix ──► -14 LUFS ──► final.mp4
```

| Parça | Dosya | Görevi |
|---|---|---|
| Motor | `studio/engine.js` | Kare çizimi, sahne geçişleri (dalış / karartma / çapraz), film greni, vinyet, kanca başlığı, kelime kelime vurgulu animasyonlu altyazı |
| Zamanlama | `studio/zamanlama.mjs` | Ses yokken metinden süre tahmini; ses gelince FFmpeg `silencedetect` ile bölüm-cümle sınırlarını bulur, kelimeleri hece ağırlığına göre dağıtır. Sahneler cümlelere bağlı olduğu için görüntü sese **otomatik esner** |
| Ses tasarımı | `studio/ses.mjs` | Pad + yumuşak piyano müzik, ortam sesleri (oda, yağmur, saat, kuşlar), korku "sting"i, kalp atışı, geçiş whoosh'ları, sinir "zap"ı, rüzgâr, kapanış darbesi — hepsi matematikle sentezlenir (lisans sorunu yok) |
| Render | `studio/render.mjs` | Playwright/Chromium ile paralel kare çizimi, FFmpeg ile kodlama ve miks |
| Karakter | `studio/karakter.js` | İnsan Atlası ana karakteri (profil, saç, oturan beden, gözyaşı) — tüm bölümlerde aynı |
| Kütüphane | `studio/kutuphane.js` | Videolar arası ortak çizimler: kamera, insan silueti, bokeh, ışık halkaları, etiket hapları, stüdyo ışığı |
| Oynatıcı | `studio/player.html` | Tarayıcıda canlı önizleme (`player.html?v=<video>`) |
| Video | `videolar/<video>/` | `senaryo.json`, `sahneler.js`, `ELEVENLABS.md`, `ses/`, `cikti/` |

## Komutlar

```bash
node studio/render.mjs tuyler-diken-diken                # sessiz önizleme → cikti/onizleme.mp4
node studio/render.mjs tuyler-diken-diken --kare 3,20    # kontrol kareleri (PNG)
node studio/render.mjs tuyler-diken-diken --final        # ses + altyazı + müzik → cikti/final.mp4
node studio/render.mjs tuyler-diken-diken --hizli        # 540×960 hızlı taslak
```

Gereksinim: Node 20+, FFmpeg, `npm install` (Playwright) + `npx playwright install chromium`.

## iPhone'dan kullanım

1. **Seslendirme:** `videolar/<video>/ELEVENLABS.md` dosyasındaki metni kopyala → ElevenLabs uygulaması/sitesi → üret → MP3 indir (Dosyalar uygulamasına kaydolur).
2. **Yükle:** Safari'de GitHub reposunu aç → `videolar/<video>/ses/` klasörü → **Add file → Upload files** → dosyayı seç. Adı tam olarak `seslendirme.mp3` olmalı → **Commit**.
3. **Final:** İki yol var, ikisi de ücretsiz:
   - **Otomatik:** Yükleme, `Video final render` GitHub Action'ını tetikler (~10–20 dk). Bitince `cikti/final.mp4` repoya eklenir.
   - **Claude ile:** Claude uygulamasına "ses yüklendi, finali hazırla" yaz.
4. **İndir & paylaş:** GitHub'da `cikti/final.mp4` → **Download** → Paylaş → **Videoyu Kaydet** → Shorts / Reels'e yükle.

> GitHub Actions herkese açık repolarda ücretsizdir; özel repolarda ayda 2.000 ücretsiz dakika vardır (bir video ≈ 15–20 dk).

## Kredi koruma
- `.claude/settings.json`: ücretli üretim araçları (görüntü/video/ses üretimi) **engelli**; diğer harici araçlar ve ağ istekleri her seferinde **onay ister**.
- `CLAUDE.md`: Claude'un uyduğu kurallar (izin almadan hiçbir harici API çağrısı yok).

## Videolar
| Video | Durum |
|---|---|
| [tuyler-diken-diken](videolar/tuyler-diken-diken) — Bölüm 1: Korktuğumuzda neden tüylerimiz diken diken olur? | Final hazır |
| [neden-gidiklaniriz](videolar/neden-gidiklaniriz) — Bölüm 2: Neden gıdıklanırız? | Sessiz önizleme hazır · seslendirme ElevenLabs'te üretildi, yüklenmeyi bekliyor |
| [insan-atlasi-01-aglama](videolar/insan-atlasi-01-aglama) — İnsan Atlası #01: Neden bazen sebepsiz yere ağlamak isteriz? | Final hazır (ses: Evren) |
| [insan-atlasi-03-unutamamak](videolar/insan-atlasi-03-unutamamak) — İnsan Atlası #03: Bizi görmezden gelen birini neden unutamayız? | Sessiz önizleme hazır · seslendirme bekleniyor |

Yazı tipi: Inter (SIL OFL, `studio/fonts/`).
