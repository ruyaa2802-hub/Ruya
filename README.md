# Ruya — Ücretsiz Bilim Videosu Stüdyosu

YouTube Shorts ve Instagram Reels için sinematik, bilimsel bilgilendirici dikey videolar.
**Hiçbir görsel/video üretim API'sine kredi harcanmaz.** Görüntüler kodla çizilir, müzik kodla sentezlenir,
seslendirmeyi sen ElevenLabs'te üretip yüklersin.

## Eski sistem → yeni sistem

| | Eski (ElevenLabs Flows) | Yeni (bu repo) |
|---|---|---|
| Görsel | Her sahne ayrı AI video/görsel üretimi (Seedance, LTX, GPT-Image, Seedream) | SVG + JS animasyon, Chromium'da kare kare render |
| Kredi | Sahne başına video kredisi; 46 node'luk flow'lar, yarım kalan sahneler | **0** — yalnızca yerel araçlar |
| Ses | Replik başına ayrı TTS node'u | Tek metin, tek ses dosyası (sen üretirsin) |
| Senkron | Elle | Ses analizinden otomatik cümle hizalama |
| Müzik | Kredili müzik node'u | Kodla sentezlenen telifsiz müzik + otomatik ducking |
| Tekrar üretim | Yeniden kredi | Ücretsiz, deterministik (aynı girdi → aynı video) |

## Mimari

```
seslendirme.txt ──► zamanla.py ──► zamanlama.json ──┐
 (cümle/satır)      (ses yoksa tahmini,              │
                     varsa sessizlik analiziyle)     ▼
                                       sahneler.js + studio/motor (SVG/JS)
                                                     │  render.cjs: headless Chromium,
                                                     │  kare kare yakalama → FFmpeg H.264
                                                     ▼
                                          onizleme_sessiz.mp4
ses/seslendirme.mp3 ─┐
muzik.py (sentez) ───┴─► FFmpeg miks (ducking, -14 LUFS) ──► cikti/final.mp4
```

- `studio/motor/` — animasyon motoru: zaman çizelgesi, sinematik geçişler (bulanıklaşarak itme),
  film greni, hacimsel ışık, bokeh/alan derinliği, vinyet, **kelime kelime animasyonlu altyazı**.
- `studio/araclar/render.cjs` — paralel kare render (4 çekirdekte 47 sn ≈ 5 dk).
- `studio/araclar/zamanla.py` — cümle sınırlarını FFmpeg sessizlik analiziyle bulur (dinamik programlama).
- `studio/araclar/muzik.py` — drone + pad + arpej + hava dokusu + sahne vurguları (sub-boom/whoosh) + yankı.
- `videolar/<NN-konu>/` — her video: `seslendirme.txt`, `elevenlabs.md`, `senaryo.md`, `ayarlar.json`, `sahneler.js`, `ses/`, `cikti/`.

Teknik çıktı: 1080×1920 · 9:16 · H.264 · 30 FPS · AAC 192 kbps · -14 LUFS / -1.5 dBTP.

## Kullanım

```bash
./studio/uret.sh videolar/01-gidiklama onizleme   # sessiz önizleme (ses gerekmez)
./studio/uret.sh videolar/01-gidiklama final      # ses/seslendirme.mp3 yüklendikten sonra
./studio/uret.sh videolar/01-gidiklama kare 21.5  # tek kare kontrolü
```

Gereksinimler: Node 18+, `npm install` (Playwright), `npx playwright install chromium`, Python 3 + numpy, FFmpeg.

## iPhone'dan kullanım

**A) Claude ile (en kolay):** Claude Code oturumunda "Yeni video: <konu>" yaz → senaryo + sessiz önizleme gelir →
`elevenlabs.md`'deki metni ElevenLabs'te seslendir → MP3'ü sohbete ekle → final MP4 gelir.

**B) GitHub ile (otomatik):** MP3'ü GitHub uygulamasından/Safari'den `videolar/<video>/ses/seslendirme.mp3`
olarak yükle → GitHub Actions finali render eder → `cikti/final.mp4` repoya eklenir
(Actions sekmesinden indirilebilir "artifact" olarak da). Ücretsiz Actions kotası kullanılır, kredi değil.

## Kredi koruma

`CLAUDE.md` içindeki kurallar her oturumda geçerlidir: görsel için ücretli API yok, seslendirme için API yok,
herhangi bir harici araç çağrısından önce izin.
