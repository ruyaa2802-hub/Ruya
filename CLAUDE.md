# Ruya — ücretsiz video üretim sistemi: Claude için kurallar

## Kredi koruma (en önemli kural)
- Görüntü, video, müzik, ses efekti **asla** ücretli bir API ile üretilmez (ElevenLabs, Runway, Kling, Veo, Sora, Replicate, vidIQ, Canva, HeyGen vb.). Hepsi bu repodaki kodla üretilir.
- Seslendirmeyi **kullanıcı** ElevenLabs'te kendisi üretir. Claude ElevenLabs'e çağrı yapmaz, kredi harcamaz; yalnızca `ELEVENLABS.md` metnini hazırlar ve dosyanın yüklenmesini bekler.
- Herhangi bir harici API / MCP aracı / ağ isteği gerekiyorsa önce kullanıcıdan **açık izin** al ve ne kadar kredi/ücret tutacağını söyle. `.claude/settings.json` bu araçları engeller veya onaya bağlar; bu ayarı kullanıcı istemeden gevşetme.

## Yeni video iş akışı
1. `videolar/<kisa-ad>/senaryo.json` — 45–60 sn Türkçe metin (4 bölüm önerilir; bölümler = sahneler). Bilgileri uydurma; kısa ve anlaşılır yaz.
2. `videolar/<kisa-ad>/sahneler.js` — her bölüm için `VIDEO.sahne(id, { ciz(ctx, S) })`. Örnek: `videolar/tuyler-diken-diken/sahneler.js`. Zamanlama için `S.at(cumle, oran)` ve `S.ci(...)` kullan ki görüntü sese otomatik otursun.
3. Kontrol kareleri: `node studio/render.mjs <kisa-ad> --kare 2,10,25` → `cikti/kareler/` (bak, düzelt).
4. Sessiz önizleme: `node studio/render.mjs <kisa-ad>` → `cikti/onizleme.mp4`.
5. `ELEVENLABS.md` yaz (metin + ayarlar). Kullanıcı `ses/seslendirme.mp3` yükleyene kadar bekle.
6. Final: `node studio/render.mjs <kisa-ad> --final` → `cikti/final.mp4` (sese göre yeniden zamanlama, animasyonlu altyazı, sentez müzik/efekt, -14 LUFS).

## Ortam notları
- Claude bulut ortamında Playwright + Chromium hazır kurulu: `npm install` veya `playwright install` **çalıştırma**.
- Render ~4 kare/sn (4 çekirdek): 55 sn video ≈ 7 dk. Hızlı taslak için `--hizli`.
- `cikti/kareler/` ve `cikti/.parca-*` git'e girmez.
