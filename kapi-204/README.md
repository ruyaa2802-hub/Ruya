# KAPI 204 — İnteraktif Korku Mini Dizisi

Instagram Reels / YouTube Shorts için izleyici seçimleriyle ilerleyen psikolojik korku serisi.

| Bölüm | Dosya | Süre | Format |
|---|---|---|---|
| 1 — İlk Paket | [`bolum-1/KAPI204_Bolum1.mp4`](bolum-1/KAPI204_Bolum1.mp4) | 30,0 sn | 1080×1920 (9:16), H.264 + AAC, 24 fps, -14 LUFS |

**Diyalogsuz sürüm:** videoda hiç konuşma yok. Hikâye görüntü, ekran yazıları ve ses tasarımıyla anlatılıyor.

## Bölüm 1 — İlk Paket: çekim listesi

| Zaman | Çekim | Ses |
|---|---|---|
| 0,00–0,55 | Siyah ekran | 0,30'da derin kapı zili (ding) |
| 0,55–3,00 | Koridor: 204 numaralı kapı, paspasın üstünde siyah paket, ayakkabılık, ayakkabılar, şemsiye, sayaç panosu. Yazı: “SAAT 02.04. KAPININ ÖNÜNDE BİR PAKET VARDI…” | 0,88'de “dong”, uzun koridor yankısı, floresan uğultusu ve titreme çıtırtıları, düşük drone |
| 3,00–5,60 | Kapı içeri açılıyor, sıcak ışıkta adamın silueti; sola sağa bakıyor, koridor boş | Kilit sesi, kapı gıcırtısı, gerilim pedi giriyor |
| 5,60–8,00 | Yerden alçak açı, paket ön planda, adamın yüzüne yaklaşma | |
| 8,00–11,00 | Masa lambası ışığında (kupa, kitaplar, anahtarlar) paketi masaya koyar, kapağı kaldırır | Karton “tok” sesi, kapak sürtünmesi, müzik yükselir |
| 11,00–12,20 | Üstten: kutunun içinde fotoğraf, el uzanıp alır | Kâğıt hışırtısı, ters yankı şişmesi |
| 12,20–13,00 | Fotoğraf yakın plan: evin İÇİNDEN, karanlık koridordan salona flaşla çekilmiş; tarih damgası 01:58 | **Gerilim vuruşu** |
| 13,00–15,00 | Yüz yakın plan, şaşkın bakış | |
| 15,00–17,40 | Fotoğraf çevrilir, el yazısı: “BU GECE YALNIZ DEĞİLSİN.” | Müzik **aniden kesilir** |
| 17,40–20,25 | Adam yavaşça arkasına döner; karanlık koridorun sonundaki yatak odası kapısı kendi kendine kapanır | Yavaş gıcırtı + mandal |
| 20,25–22,00 | Karanlık koridor; kapının altındaki ışığı bir şey bir an kesiyor | Kapının arkasında ağır bir adımın döşemeyi gıcırdatması, tok ses |
| 22,00–28,00 | Telefon elde, kameraya bakar → **A — POLİSİ ARA / B — YATAK ODASININ KAPISINI AÇ** | Hızlanan kalp atışı, yükselen yüksek tel gerilimi |
| 28,00–30,00 | Yer seviyesi: kapının altından karanlık gölge adamın ayaklarına doğru uzanıyor. “BİR SONRAKİ BÖLÜMÜ SİZ BELİRLİYORSUNUZ. A MI, B Mİ?” — gölge hareket ederken **sert kesim** | Final vuruşu, sürünme sesi, 30,0'da kesim |

## Sıfır maliyetli üretim hattı

Hiçbir ücretli servis, API, abonelik, kredi ya da deneme sürümü kullanılmadı.

| İş | Araç | Lisans |
|---|---|---|
| 3D sahne, ışık, gölge, sis, toz, kamera | [three.js](https://threejs.org) r160, başsız Chromium (yazılımsal WebGL / SwiftShader) | MIT |
| Mekânlar ve eşyalar | Kodla modellendi: `sets.js` (koridor, daire), `props.js` (ayakkabılık, sayaç panosu, duyuru panosu, kalorifer, bisiklet, posta kutuları, yangın tüpü, saksılar, TV ünitesi, 02:04'te duran duvar saati, perdeler, sehpa, ayaklı lamba, ceketler, ayna, konsol, çerçeveler, kutular…) | — |
| Dokular | Kodla prosedürel üretim (`textures.js`), harici görsel yok | — |
| Karakter | Kodla modellenmiş tek model (`man.js`): kol IK, göz kırpma | — |
| Müzik ve tüm ses efektleri | numpy/scipy ile sentez (`audio.py`) | Özgün, telifsiz |
| Yazı tipleri | Oswald, Cormorant Garamond, Caveat (Fontsource) | SIL OFL 1.1 |
| Kurgu, renk, kodlama | ffmpeg; renk düzenleme ve film greni shader içinde | LGPL/GPL |

Daha önce denenen seslendirme sürümleri (Piper TTS) kullanıcı isteğiyle videodan çıkarıldı; kaynakları `bolum-1/kaynak/eski/seslendirme/` altında duruyor.

## Dürüst sınırlar

* **Görüntüler fotogerçekçi değil.** Ücretsiz bir yapay zekâ video üreticisi ya da GPU yok. Tüm görüntü gerçek zamanlı 3D render. Karakter stilize, mankene yakın bir figür.

## Yeniden üretme

```bash
cd bolum-1/kaynak
pip install numpy scipy
npm pack three@0.160.0 && mkdir -p web/lib && tar xzf three-0.160.0.tgz && cp package/build/three.module.js web/lib/
python3 audio.py        # müzik + efekt miksi -> mix.wav, web/env.json
(cd web && python3 -m http.server 8204 --bind 127.0.0.1 &)
node render.js full     # 720 kare -> visual.mp4 (4 çekirdekte ~15 dk)
ffmpeg -i visual.mp4 -i mix.wav -vf "scale=1080:1920:flags=lanczos,unsharp=5:5:0.3" \
  -af loudnorm=I=-14:TP=-1.5:LRA=11 -c:v libx264 -crf 21 -maxrate 9M -bufsize 18M -preset slow \
  -pix_fmt yuv420p -c:a aac -b:a 192k -t 30 -movflags +faststart KAPI204_Bolum1.mp4
```

`node render.js test 40,160,300` ile tek tek kareler PNG olarak `test/` klasörüne alınır.
