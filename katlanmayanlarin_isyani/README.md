# İnsanlar Gidince — Katlanmayanların İsyanı

63 saniyelik, 9:16 dikey (1080×1920, 30 fps) Türkçe seslendirmeli komik animasyon bölümü.

| Dosya | İçerik |
|---|---|
| `out/Insanlar_Gidince_Katlanmayanlarin_Isyani.mp4` | **Final video** (H.264 + AAC, −15 LUFS) |
| `out/karakter_referans_sayfasi.png` | 7 karakter (normal ve ifade) + ortam referansı |
| `out/kontrol_kareleri.png` | Bitmiş videodan 2,1 sn aralıklı kontrol kareleri |
| `audio/lines/` | 23 seslendirme repliği (mp3 ham, wav kırpılmış) |
| `src/` | Üretim kodu |

## Karakterler ve ses kimlikleri

| Karakter | Tasarım | Ses (edge-tts) |
|---|---|---|
| Gömlek Bey | Kırışık beyaz gömlek, burma bıyık, cepte kalem | Ahmet, −6 Hz, hızlı |
| Tişört | Hardal "BOŞVER" tişört, omzunda gri çorap, yarı kapalı gözler | Ahmet, +24 Hz, çok hızlı |
| Kırmızı Çorap | Kırmızı-beyaz çizgili uzun çorap, kirpikli | Emel, +38 Hz |
| Mavi Çorap | Sarı puantiyeli kısa mavi çorap, koltuk kolunda | Ahmet, +30 Hz |
| Havlu Abi | Yeşil havlu, beyaz gür kaş ve sarkık bıyık, püsküllü | Ahmet, −34 Hz, yavaş |
| Pantolon | Lacivert kumaş pantolon, kemer, monokl | Ahmet, −16 Hz, ağır |
| Çamaşır Sepeti | Hasır sepet, kırmızı kedi-gözü gözlük, sonradan çıkan bacaklar | Emel, −20 Hz |

## Sahne akışı

| Sn | Sahne |
|---|---|
| 0–2,8 | Kapı kapanır, insanlar gider. Başlık kartı. Yığın cansız. |
| 2,8–12,5 | **İsyan:** Gömlek Bey yığından fırlar ve bağırır; diğerleri uyanır. Tişört alaycı cevap verir. |
| 12,5–19,7 | **Çorapların kavgası:** koltuğun iki ucundan atışma, hızlı kesmeler. |
| 19,7–32,6 | **Büyük kavga:** Pantolon burnu havada, Havlu Abi sözünü keser, ardından herkes aynı anda bağırır (üst üste replikler, sarsıntılı geniş plan). |
| 32,6–43,6 | **Sepetin isyanı:** plak cızırtısı, sepet bacaklarıyla ayağa kalkar ("YETER!"), herkes donar, sahte-dramatik monolog. |
| 43,6–59,5 | **Final:** ayak sesleri, "SONUNDA! BİZİ KATLAYACAK!" fanfarı, dev insan elleri yığını kaldırıp koltuğun diğer tarafına taşır, sessizlik ve cırcır böceği. Gömlek kameraya döner: "Şaka mı bu lan?" |
| 59,5–63 | Rimshot, üzgün trombon, bitiş kartı. |

## Üretim yöntemi ve sınırlamalar (açık)

- **Görüntü:** Ortamda Blender ya da video üretim modeli yok. Önceki bölümün 2.5D render motorunu (`facekit.py`) yeniden kullandım. Kıyafet gövdeleri (`clothes.py`), oda ve yığın (`world.py`), yönetmenlik (`direct.py`) ve birleştirme (`render.py`) bu bölüm için yazıldı. Görünüm 3B çizgi film hissi veren gölgelendirmeli 2.5D'dir, gerçek 3B geometri değildir.
- **Seslendirme:** ElevenLabs kotası dolu (25 kredi kaldı) ve vidIQ kredisi yetersiz (13). Bu yüzden Microsoft'un Türkçe nöral sesleri (Ahmet, Emel) `edge-tts` ile kullanıldı. Yedi karakter iki sesten perde ve hız ayarıyla ayrıştırıldı, gerçek seslendirme sanatçısı değil. Duygu tonlaması (bağırma, fısıltı) sınırlı.
- **Türkçe doğrulama:** Bütün replikler Whisper (small) ile geri çözüldü ve metinle eşleşti. Yanlış anlaşılan iki replik ("Bildiğin gibi", "Eşim nerede") yeniden üretildi. Kalan küçük farklar: "halı" → "hali", "kırışıklarım" → "karışıklarım" (Whisper'ın şapka/ı okuması).
- **Ağız senkronu** ses genliğinden türetilir, fonem bazlı değildir.
- **Müzik ve efektler** numpy ile sentezlendi (tuba, marimba, klarnet, pirinç, trampet, kayan düdük, ayak sesi, cırcır böceği vb.).
- Senaryoya küçük doğaçlamalar eklendi: "Ne demek o?!", "Bildiğin gibi, canım!" ve kavga sahnesindeki üst üste bağırışlar ("Kimse seni dinlemiyor!", "Bana ütüsüz yaklaşmayın!", "Hepiniz nem kokuyorsunuz!").

## Kalite kontrolü

| Kontrol | Sonuç |
|---|---|
| Karakter tutarlılığı | Tek çizim kodu; referans sayfası ve kontrol karelerinde aynı |
| Türkçe diyalog | Whisper ile doğrulandı; altyazılar doğru |
| Ses kapalıyken anlaşılır mı? | Evet: konuşan adlı altyazılar, abartılı mimik, eller ve yığın hareketi |
| Gerçek animasyon mu? | Evet: zıplama, ezilme-esneme, kol sallama, titreme, göz kırpma, bakış, kamera hızlı yakınlaşma ve sarsıntı |
| Müzik diyalogu bastırıyor mu? | Hayır: konuşma çoğunlukla müzik + efektin 7–14 dB üstünde; iki bağırış (Gömlek'in ilk çıkışı, "Yeter!") efektle birlikte ~5–6 dB |
| Video üretildi mi? | **Evet.** 1890 kare render edildi ve sesle birleştirildi; ffprobe: 1080×1920, 30 fps, 63,0 sn |

## Yeniden üretim

```bash
cd src
python3 make_voices.py                  # replikler (edge-tts; ağ gerekir)
python3 audio.py                        # müzik + efekt + miks -> out/mix.wav
python3 run_render.py <kare_klasörü>    # 1890 kare (~11 dk, 4 çekirdek)
# birleştirme: README'deki ffmpeg komutları veya ../../makyaj_masasi/src/mux.sh mantığı
python3 refsheet.py
```
