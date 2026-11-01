# Korktuğumuzda Neden Tüylerimiz Diken Diken Olur? — Üretim Dosyası

Dikey 9:16 (1080x1920) bilimsel mini belgesel, ~52 sn. YouTube Shorts / Instagram Reels.

ElevenLabs flow (tüm düğümler, promptlar ve üretimler):
https://elevenlabs.io/app/flows/HdKdzIUvhagtrDFjA7VM

## Seslendirme
- Ses: **Uğur – Turkish Documentary Narrator** (`fSruVisKJEvQqmgx0yZT`), model `eleven_v4`
- Süre: 50,76 sn (`seslendirme.mp3`)
- Metin talimattaki gibi, kelimesi kelimesine; bilgi eklenmedi/değiştirilmedi.

## Zaman çizelgesi (videoda 1,0 sn sessiz korku girişi + seslendirme)

| Sahne | Video zamanı | Seslendirme | Klip(ler) |
|---|---|---|---|
| 1 – Korku anı | 0,0 – 10,4 | "Hiç korktuğunuzda… Peki vücudunuz bunu neden yapıyor?" | S1a (5 sn) gece yürüyüşü + irkilme, S1b (6 sn) makro tüy dikleşmesi |
| 2 – Derinin altında | 10,4 – 23,0 | "Aslında derimizin altında… tüylerimiz dikleşiyor." | S2 (13 sn) deri katmanları, kıl kökü, kıl dikleştirici kas kasılması |
| 3 – Milyonlarca yıllık savunma | 23,0 – 41,6 | "Bu mekanizma aslında… ısı kaybını azaltıyordu." | S3a (9 sn) tarih öncesi memeli tehditte kabarıyor, S3b (10 sn) soğukta hava tabakası |
| 4 – Şaşırtıcı sonuç | 41,6 – 52,8 | "İnsanlar zamanla… küçük bir iz!" | S4 (13 sn) koldan geri çekilen kamera, final kare |

Seslendirmedeki duraklamalar (sessizlik analizi): 6,3 · 9,2 · 21,9 · 40,4 · 43,3 sn → sahne kesmeleri bu duraklamalara oturtuldu.

## Karakter tutarlılığı
Seedream 5 Pro ile tek bir karakter referansı üretildi (`karakter-referans.png`): 20'li yaşlarda, koyu kahve kısa saç, hafif sakal, koyu gri tişört, kolları sıvanmış haki-yeşil ceket, sisli gece sokağı. S1a, S1b ve S4 bu görsele `reference_images` olarak bağlı.

## Video promptları (Seedance 2.5, 9:16, ses kapalı)

**S1a** — Medium tracking shot from behind and slightly to the side: the young man from the reference image walks alone down a dark, foggy, empty side street at night. Suddenly he flinches and freezes, turning his head sharply over his shoulder as if startled by a sound behind him, then glances down at his bare forearm. Cold blue moonlight, a single warm streetlight, drifting fog, wet asphalt reflections. Photorealistic high-end cinematic CGI, documentary camera work, shallow depth of field, anamorphic film look. Maintain exact appearance from reference image, consistent character, no deformation, no text.

**S1b** — Slow macro push-in on the bare forearm of the young man from the reference image, his olive-green jacket sleeve pushed up. In extreme close-up, tiny bumps slowly rise across the skin and the fine arm hairs gradually lift and stand upright, one after another. Realistic skin pores, fine vellus hair, cold blue night light with a warm rim light, shallow macro depth of field, photorealistic scientific documentary cinematography. Smooth slow camera, no distortion, no text.

**S2** — Continuous cinematic camera dive from the surface of human forearm skin down into a scientifically accurate 3D cross-section of the skin. The layers become visible: thin outer epidermis, thick dermis with collagen fibers and small blood vessels, and fatty subcutaneous tissue below. The camera glides to a single hair follicle rooted in the dermis, with its sebaceous gland, and a small slanted band of smooth muscle — the arrector pili muscle — attached from the side of the follicle up toward the skin surface. A faint glowing nerve signal travels along a thin nerve fiber to the muscle; the muscle contracts and shortens, pulling the follicle so the hair tilts from lying flat to standing upright, and the skin above forms a small raised bump. Photorealistic high-end medical 3D animation, soft volumetric lighting, warm translucent tissue tones, shallow depth of field, slow smooth documentary camera. Anatomically accurate, no labels, no text, no distortion.

**S3a** — Cinematic transition from a dark misty haze into a prehistoric forest at dusk. A furry prehistoric mammal with thick brown-grey fur crouches on a mossy rock, facing an unseen threat. Its body fur slowly bristles and puffs up all over, making its silhouette look much larger and more intimidating as it stands its ground. Slow low-angle push-in, ground fog, cold dusk backlight rimming the raised fur, photorealistic nature-documentary CGI, detailed fur strands, shallow depth of field. Realistic animal, no fantasy creature, no text, no distortion.

**S3b** — The same furry prehistoric mammal sits in a cold, snowy landscape with light snowfall and visible breath vapor. Its fur fluffs up and stands out from its body. The camera slowly moves in close to the fur and a subtle scientific visualization appears: a thin, softly glowing warm amber layer of trapped air between the raised fur and the skin, with cold blue air outside, showing the warm layer holding body heat in. Photorealistic nature-documentary CGI with a tasteful scientific overlay, detailed fur strands, soft cold daylight, shallow depth of field. No text, no labels, no distortion.

**S4** — Starts in close-up on the forearm of the young man from the reference image, the fine arm hairs still standing upright on goosebumped skin. The camera slowly and smoothly pulls back and rises to reveal him standing still on the foggy night street, holding up his forearm and looking at it with quiet amazement and curiosity, then lifting his gaze thoughtfully toward the distance. The fog glows in moonlight behind him, warm streetlight rim light, ending on a wide, symmetrical, cinematic hero frame of the lone figure in the misty street. Photorealistic high-end cinematic CGI, anamorphic film look, shallow depth of field. Maintain exact appearance from reference image, consistent character, no deformation, no text.

## Ses ve kurgu planı
- 0,0 sn: arkadan gelen ani ses (dal kırılması / metal tıkırtı) + sert "sting".
- Fon: hafif gizemli, düşük tempolu sinematik ambient (seslendirmenin ~-20 dB altında, konuşma sırasında ducking).
- Sahne geçişleri: S1b→S2 deriye "dalış" çapraz geçişi, S2→S3a sisli/kararan çapraz geçiş, S3b→S4 yumuşak çapraz geçiş (0,5–0,8 sn), her geçişte hafif "whoosh".
- Çıkış: 1080x1920, 30 fps, H.264 + AAC, -14 LUFS.

## Durum
- [x] Seslendirme
- [x] Karakter referansı
- [x] Tüm klip düğümleri ve promptlar hazır (720p, kullanıcı onayıyla)
- [ ] Klipler: ElevenLabs kredi kotası doldu — yalnızca S2 üretimi başladı; S1a, S1b, S3a, S3b, S4 kredi yenilenince/artırılınca çalıştırılacak
- [ ] Müzik + SFX
- [ ] Kurgu (ffmpeg) ve 1080x1920 çıktı
