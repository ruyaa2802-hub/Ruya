# Ruya — Ücretsiz Video Üretim Sistemi

Bu repo, YouTube Shorts / Instagram Reels için **kredi harcamadan** bilim videoları üretir.
Ayrıntılı kullanım: `README.md`.

## KREDİ KORUMA KURALLARI (zorunlu)

1. **Görsel/video üretimi için hiçbir ücretli API kullanma.** ElevenLabs (görsel/video), Runway, Kling,
   Veo, Sora, Replicate, Seedance, LTX, GPT-Image vb. YASAK. Görseller yalnızca kodla üretilir
   (SVG, HTML/CSS, JS, Three.js) ve `studio/` hattıyla render edilir.
2. **Seslendirmeyi kullanıcı kendisi üretir.** ElevenLabs'e API çağrısı yapma, TTS üretme, kredi harcama.
   Sen yalnızca `seslendirme.txt` ve `elevenlabs.md` dosyalarını hazırla; ses dosyasının
   `videolar/<video>/ses/seslendirme.mp3` olarak yüklenmesini bekle.
3. **Herhangi bir harici API/MCP aracını (ElevenLabs, Descript, Adobe, Canva, OpusClip, vidIQ, HeyGen vb.)
   çağırmadan önce kullanıcıdan açık izin al.** Kredi tüketen hiçbir aracı otomatik çalıştırma.
   Okuma amaçlı çağrılar da dahil: önce sor.
4. Müzik `studio/araclar/muzik.py` ile kodla sentezlenir (telifsiz). Stok müzik/görsel gerekirse
   yalnızca lisansı açıkça uygun (CC0 / Pexels / Pixabay lisansı) kaynaklar; önce kullanıcıya sor.

## Yeni video akışı

1. `videolar/NN-konu/` oluştur: `seslendirme.txt` (her satır bir cümle, 45–60 sn, ~650–850 harf),
   `ayarlar.json`, `elevenlabs.md`, `senaryo.md`, `sahneler.js`.
2. `./studio/uret.sh videolar/NN-konu onizleme` → sessiz önizleme (tahmini zamanlama).
3. Kullanıcı sesi yükleyince: `./studio/uret.sh videolar/NN-konu final` → `cikti/final.mp4`.

Sahneleri mutlak saniyeyle değil `M.c(id)` ve `M.kz(cumleId, 'kelime')` ile zamanla;
böylece gerçek ses gelince görüntü otomatik yeniden senkronlanır.

Teknik hedef: 1080×1920, 9:16, H.264, 30 FPS, AAC 192k, -14 LUFS, animasyonlu Türkçe altyazı.
Altyazı güvenli alanı: y 1235–1495 (alt 380 px'te Shorts/Reels arayüzü var).

Commit mesajlarında ve dosyalarda model adı geçmesin.
