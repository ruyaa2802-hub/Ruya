# İnsanlar Gidince — Katlanmayanların İsyanı

91 saniyelik, 9:16 dikey (1080×1920, 30 fps) Türkçe seslendirmeli komik animasyon bölümü (v2: doğal sesler, dağınık yerleşim, ev sahibi dedikodusu).

| Dosya | İçerik |
|---|---|
| `out/Insanlar_Gidince_Katlanmayanlarin_Isyani.mp4` | **Final video v2** (H.264 + AAC, −14,8 LUFS) |
| `out/karakter_referans_sayfasi.png` | 7 karakter (normal ve ifade) + ortam referansı |
| `out/kontrol_kareleri.png` | Bitmiş videodan 2,85 sn aralıklı kontrol kareleri |
| `audio/lines/` | v2: 29 seslendirme repliği (mp3 ham, wav işlenmiş) |
| `audio/lines_v1/` | İlk sürümün replikleri (arşiv) |
| `src/` | Üretim kodu |

## Karakterler, yerleri ve ses kimlikleri (v2)

Karakterler sürekli zıplamıyor; ev sahibinin bıraktığı gibi dağınık duruyorlar ve yalnızca konuşurken ya da tepki verirken hareket ediyorlar. Gözler otomatik olarak konuşana dönüyor.

| Karakter | Nerede | Ses (Türkçe nöral + doğal ayar) |
|---|---|---|
| Gömlek Bey | Koltuğun sırtına asılı, buruşuk | Ahmet, hızlı ve gergin, kompresörlü |
| Tişört | Halıya düşmüş, eller başın arkasında | Ahmet, +1,6 yarım ton (formant korunur), parlak |
| Havlu Abi | Yerde, koltuk ayağının dibinde | Ahmet, −2,6 yarım ton, yavaş, boğuk |
| Pantolon | Koltuğun arkasında; konuşurken başını uzatır, susunca saklanır | Ahmet, −1 yarım ton, genizden (1,3 kHz) |
| Kırmızı Çorap | Yığının tepesinde | Emel, hızlı, telaşlı |
| Mavi Çorap | Koltuğun kolçağında | Emel, −1,6 yarım ton |
| Çamaşır Sepeti | Yerde, hafif devrik; "YETER!" deyince bacaklarıyla kalkar | Emel, −2,2 yarım ton, otoriter |

Önceki sürümdeki yapaylığın ana nedeni olan aşırı perde kaydırma (+30–48 Hz, sincap etkisi) kaldırıldı. Karakter farkı artık konuşma hızı, formantı koruyan küçük perde kaydırma (rubberband), EQ ve oda yankısıyla veriliyor; replikler konuşma dilinde yazıldı ("ya", "ay", "yahu", "var ya…").

## Sahne akışı (v2)

| Sn | Sahne |
|---|---|
| 0–3 | Anahtar, kapı çarpması, uzaklaşan araba. Kıyafetler cansız. Başlık. |
| 3–18 | Gömlek uyanır: "Gitti mi? Gitti!… Ben bir gömleğim, halı değilim!" Tişört halıdan cevap verir. |
| 18–36 | **Dedikodu:** Havlu: "Sevgilisi geldi diye bizi apar topar koltuğa yığdı." Kırmızı Çorap: "Ay, sevgilisinden de utanmıyor!" Mavi Çorap: "Annesini mi çağıralım, ne yapalım yahu?" Pantolon (arkadan): "Annesi görse var ya… hepimizi tek tek katlatır!" |
| 36–45 | Çorapların kavgası (eş meselesi). |
| 45–57 | Pantolon "askıya asılırım", Havlu sözünü keser, herkes üst üste bağırır. |
| 57–71 | Sepet ayağa kalkar: "Yeter!", "tekstil enkazı" konuşması; Tişört mırıldanır: "Bir de sevgilisine 'evim hep böyle tertemiz' diyor…" |
| 71–86 | "Susun! Geliyor!", ayak sesleri, "SONUNDA! BİZİ KATLAYACAK!", dev eller yığını koltuğun öbür tarafına taşır; cırcır böceği sessizliği. |
| 86–91 | Gömlek kameraya: "Şaka mı bu lan?" Rimshot, üzgün trombon, bitiş kartı. |

## Üretim yöntemi ve sınırlamalar (açık)

- **Görüntü:** Ortamda Blender ya da video üretim modeli yok. Önceki bölümün 2.5D render motorunu (`facekit.py`) yeniden kullandım. Kıyafet gövdeleri (`clothes.py`), oda ve yığın (`world.py`), yönetmenlik (`direct.py`) ve birleştirme (`render.py`) bu bölüm için yazıldı. Görünüm 3B çizgi film hissi veren gölgelendirmeli 2.5D'dir, gerçek 3B geometri değildir.
- **Seslendirme:** ElevenLabs kotası dolu (25 kredi kaldı), vidIQ kredisi yetersiz (13), gcloud'da kimlik bilgisi yok. Microsoft'un çok dilli sesleri de denendi ama Türkçeyi aksanlı okuyor (Whisper testi: "çağıralım" → "yaralım"). En doğru telaffuz yerli Türkçe sesler (Ahmet, Emel, `edge-tts`) olduğu için onlar kullanıldı. Bunlar gerçek seslendirme sanatçısı değil; bağırma ve fısıltı gibi duygu tonlaması hâlâ sınırlı. ElevenLabs kredisi yenilendiğinde aynı replikler Türk seslendirme sesleriyle yeniden üretilebilir (`lines.py` + `make_voices.py`).
- **Türkçe doğrulama:** v2'nin bütün replikleri Whisper (small) ile geri çözüldü ve metinle eşleşti. Bozuk okunan "Şşşt! Geliyor!" → "Susun! Geliyor!" yapıldı. Kalan küçük farklar Whisper'ın yazımından: "halı" → "hali", "kırışıklarım" → "karışıklarım", "yığdı" → "yıdı".
- **Ağız senkronu** ses genliğinden türetilir, fonem bazlı değildir.
- **Müzik ve efektler** numpy ile sentezlendi (tuba, marimba, klarnet, pirinç, trampet, kayan düdük, ayak sesi, cırcır böceği vb.).
- Orijinal ana replikler korundu; ev sahibi dedikodusu, "Ne demek o?!", "Bildiğin gibi, canım!", kavga bağırışları ve "Susun! Geliyor!" eklendi.

## Kalite kontrolü

| Kontrol | Sonuç |
|---|---|
| Karakter tutarlılığı | Tek çizim kodu; referans sayfası ve kontrol karelerinde aynı |
| Türkçe diyalog | Whisper ile doğrulandı; altyazılar doğru |
| Ses kapalıyken anlaşılır mı? | Evet: konuşan adlı altyazılar, abartılı mimik, eller ve yığın hareketi |
| Gerçek animasyon mu? | Evet: zıplama, ezilme-esneme, kol sallama, titreme, göz kırpma, bakış, kamera hızlı yakınlaşma ve sarsıntı |
| Müzik diyalogu bastırıyor mu? | Hayır: konuşma bandında (300 Hz–4 kHz) her replik müzik + efektin 7,5–20 dB üstünde |
| Doğal yerleşim / hareket | Karakterler dağınık yerlerde; zıplama ve kol sallama yalnızca kavga ve "Sonunda!" anında |
| Video üretildi mi? | **Evet.** 2730 kare render edildi ve sesle birleştirildi; ffprobe: 1080×1920, 30 fps, 91,0 sn, −14,8 LUFS |

## Yeniden üretim

```bash
cd src
python3 make_voices.py                  # replikler (edge-tts; ağ gerekir)
python3 audio.py                        # müzik + efekt + miks -> out/mix.wav
python3 run_render.py <kare_klasörü>    # 2730 kare (~17 dk, 4 çekirdek)
# birleştirme: README'deki ffmpeg komutları veya ../../makyaj_masasi/src/mux.sh mantığı
python3 refsheet.py
```
