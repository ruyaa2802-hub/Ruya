# Bölüm 1 · "Kızların kendini savunma taktiği"
## Sahne 1 üretim paketi (karakter tasarımını sabitleme)

> **Referans görsel notu:** Bu konuşmaya hamam böceği/kafe görseli eklenmedi. Depodaki tek görsel `karakterler/velun.png`. O görsel düz 2D bir çizim ve hamam böceği değil, yumurta kafalı, sarı gözlü, yeşil pelerinli bir karakter. Bu yüzden aşağıdaki paket senin yazılı tarifine göre hazırlandı. Viral görseli `karakterler/` klasörüne eklersen promptları ona göre ince ayarlarım.

---

## 0. Konsept analizi (bu formatın neden tuttuğu)

| Öğe | İşlevi | Üretimde karşılığı |
|---|---|---|
| Gerçekçi böcek + insan davranışı | "İğrenç ama komik" kontrastı, ilk saniyede dikkat çeker | Kabuk, segmentler ve antenler gerçekçi, kafede oturma ve el hareketleri insan gibi |
| Sıradan kafe sohbeti | İzleyici kendi hayatından tanır | Statik, iki kişilik orta plan, sıcak ışık, bulanık arka plan |
| Gündelik espri | Kısa replik, tek vurucu cümle | Klip başına en fazla 2 replik, 8 saniyede biter |
| Böcek dünyasına özgü espri | Paylaşılma sebebi | "Terlik" esprisi: her Türk izleyici anında anlar |

**Sabit kurallar (bütün seri boyunca değişmeyecek):**
- Erkek (adı: **Kerem**) her zaman **solda**, kadın (adı: **Lara**) her zaman **sağda**.
- Renkler: bakır-kahverengi kabuk, beyaz kıyafetler, gümüş takılar.
- Kamera yüksekliği masa seviyesinde, 9:16 dikey.
- Işık: sıcak, loş tungsten kafe ışığı ve pencereden gelen yumuşak gün ışığı.

---

## 1. Araç planı (sadece ücretsiz)

| İş | Araç | Not |
|---|---|---|
| Karakter ve mekân görselleri | **Google Flow** içindeki görsel üretimi veya **Gemini uygulaması** (ücretsiz Google hesabı, günlük limitli) | Ücretsiz görsel üretimi kredi harcamadan veya çok az harcayarak yapılabiliyor |
| Video ve konuşma sesi | **Google Flow → Veo**, ücretsiz kredinle | Veo konuşmayı ve dudak hareketini birlikte üretir. Ayrıca seslendirme yapman gerekmez |
| Kurgu + altyazı | **Edits (Meta, ücretsiz)** veya **CapCut ücretsiz sürümü**. Bilgisayarda **DaVinci Resolve ücretsiz sürümü** | Pro etiketli efekt, ses veya şablon kullanma |

**Kredi kontrolü:** Flow'da sağ üstteki kredi sayacına bak. Her üretimden önce o modelin kaç kredi istediğini gösterir. Ücretsiz bakiyen yetmiyorsa **Fast** modeli seç ve çıktı sayısını **1** yap. "Upgrade" veya "Get more credits" butonlarına basma.

---

## 2. Karakter görsel promptları (kopyala, yapıştır)

İkisini de **9:16**, sade gri stüdyo fonunda, belden yukarı üret. 4 varyasyondan en iyisini seç ve `kerem_ref.png` / `lara_ref.png` olarak kaydet. Bu iki görsel serinin "kimlik kartı" olacak.

### 2A. Erkek: KEREM
```
Ultra-detailed cinematic 3D CGI character, anthropomorphic cockroach young man, waist-up portrait, sitting upright like a human, facing camera at a slight three-quarter angle.
Realistic cockroach anatomy: glossy copper-brown chitin exoskeleton with subtle amber translucency at the edges, visible segmented plates on neck and abdomen, fine micro-scratches and specular highlights, two long thin curved antennae rising from the head and arching backward.
Face: large, slightly bulging, glossy dark-brown eyes with realistic wet reflections, heavy half-lowered eyelids giving a sleepy, overconfident, unbothered look, a slight lopsided smirk, small mandible-like mouth that can articulate human speech.
Body: four human-like arms are reduced to two expressive humanoid arms with three-segment insect hands, thin insect legs hidden under the frame.
Outfit: oversized loose white cotton t-shirt with soft fabric folds, a chunky silver curb-chain necklace resting on the shirt, a matte black wristwatch on the left wrist.
Neutral seamless light-grey studio background, soft key light from the front-left, warm rim light, shallow depth of field.
Style: high-end feature-film animation quality, photoreal textures, subsurface scattering, 85mm lens look, sharp focus on the eyes.
Not cartoonish, not cute, not a children's style, not 2D, no text, no watermark. Vertical 9:16.
```

### 2B. Kadın: LARA
```
Ultra-detailed cinematic 3D CGI character, anthropomorphic cockroach young woman, waist-up portrait, sitting upright like a human, facing camera at a slight three-quarter angle.
Realistic cockroach anatomy: glossy warm copper-brown chitin exoskeleton with subtle amber translucency, visible segmented plates on neck and abdomen, fine surface detail and specular highlights, two long thin curved antennae rising from the head and arching gracefully backward.
Face: large, expressive, glossy dark eyes with realistic wet reflections, long thick black eyelashes, eyelids tinted soft pink, full glossy pink lips on an insect face, one eyebrow-ridge slightly raised: confident, sarcastic, mildly condescending expression, a knowing half-smile.
Body: two expressive humanoid arms with slender three-segment insect hands, elegant posture.
Outfit: chic white sleeveless fitted top, a delicate thin gold chain necklace with a tiny pendant.
Neutral seamless light-grey studio background, soft key light from the front-right, warm rim light, shallow depth of field.
Style: high-end feature-film animation quality, photoreal textures, subsurface scattering, 85mm lens look, sharp focus on the eyes.
Not cartoonish, not cute, not a children's style, not 2D, no text, no watermark. Vertical 9:16.
```

> **Kolye rengi:** Lara'nın kolyesini tarifindeki "ince kolye" için altın seçtim, böylece Kerem'in gümüşünden ayrışıyor. Gümüş istersen `thin gold chain` yerine `thin silver chain` yaz.

**Kontrol listesi (seçmeden önce):** iki anten, gözler aynı renkte, tişört/üst bembeyaz, Kerem'de saat sol bilekte, yüzde insan burnu YOK. Biri tutmuyorsa yeniden üret. Bu aşamada harcadığın zaman, sonraki bütün sahnelerde devamlılık olarak geri döner.

---

## 3. Ana referans görsel: ikisi aynı kafede

Flow'da görsel üretirken `kerem_ref.png` ve `lara_ref.png` dosyalarını **referans/ingredient** olarak ekle, sonra bu promptu yaz. Bu görsel `master_frame.png` olacak ve **her videonun ilk karesi** buradan çıkacak.

```
Vertical 9:16 cinematic 3D CGI film still. Two anthropomorphic cockroach characters sitting across from each other at a small round wooden café table, both fully visible in one medium two-shot, camera at table height, slightly off-center.
LEFT: the male cockroach from the reference (Kerem): glossy copper-brown exoskeleton, long curved antennae, big heavy-lidded bored eyes, oversized white t-shirt, chunky silver chain, black wristwatch, leaning back casually in his chair, one arm resting on the table.
RIGHT: the female cockroach from the reference (Lara): glossy copper-brown exoskeleton, long antennae, long black eyelashes, pink eyelids, full pink lips, white sleeveless top, thin gold necklace, sitting upright with legs crossed, holding a white coffee cup.
Table: two white ceramic coffee cups on saucers, a small stainless-steel sugar dispenser in the center, warm wood grain.
Background: modern stylish café, large floor-to-ceiling windows, green potted plants, warm dim pendant lights, softly blurred human customers in the background, creamy bokeh.
Lighting: warm tungsten interior light mixed with soft daylight from the windows, gentle rim light on both exoskeletons, realistic reflections on the chitin.
Feature-film animation quality, photoreal textures, 35mm lens, shallow depth of field, rich but natural color grade.
Not cartoon, not 2D, no text, no subtitles, no watermark.
```

**Kontrol:** Kerem solda, Lara sağda. İki fincan ve şekerlik görünüyor. İkisinin kafası ve antenleri kadrajın içinde, üstte nefes payı var (Reels arayüzü üstü ve altı kapatır).

---

## 4. Bölüm 1 tam diyalog (≈20 sn, 3 klip × ~7 sn)

Klipleri **8 saniyelik** Veo üretimleri olarak planladım. Kurgu sırasında baş ve sonlarından kırparak toplam 20 saniyeye indirilir.

| # | Süre | Konuşan | Replik | Mimik |
|---|---|---|---|---|
| **Klip 1** | 0–8 | **KEREM** | "Sen gece tek başına yürürken biri peşine takılsa ne yaparsın?" | Arkasına yaslanmış, ukala, antenleri gevşek |
| | | **LARA** | "Kolay." | Başını kaldırmadan kahvesini karıştırır |
| **Klip 2** | 8–16 | **KEREM** | "Biber gazı falan mı?" | Kaşını kaldırır, öne eğilir |
| | | **LARA** | *(sözünü keser)* "Yok canım. Bağırırım: 'Anneee! Terliği getir!'" | Gözlerini kısar, öne eğilir, son kelimede sesini yükseltir |
| **Klip 3** | 16–22 | **KEREM** | *(donar, antenleri dikleşir)* "...Tamam. Çok etkili." | Sandalyesini hafifçe geri iter, saatine bakıyormuş gibi yapar |
| | | **LARA** | "Biliyorum." | Kahvesinden yudum alır, göz devirip sırıtır |

**Hook (ilk saniye):** Video doğrudan Kerem'in sorusuyla başlar. Kurguda ilk 0,5 saniyedeki sessiz kısmı kes.

---

## 5. SAHNE 1 (Klip 1) Google Flow üretimi

### Ayarlar
- Mod: **Frames to Video**
- Başlangıç karesi: `master_frame.png`
- Bitiş karesi: boş bırak
- En-boy oranı: **9:16 (portrait)**
- Model: ücretsiz kredinin yettiği en yüksek **Veo** sürümü. Kredi azsa Fast modeli seç
- Çıktı sayısı: **1** (kredi tasarrufu)

> Frames to Video seni sorunlu buluyorsa yedek yol **Ingredients to Video**: `kerem_ref.png`, `lara_ref.png` ve `master_frame.png` dosyalarını ekle, aynı promptu kullan. Frames to Video daha iyi devamlılık verir. Çünkü ilk kare birebir senin onayladığın görsel olur.

### Video promptu (kopyala, yapıştır)
```
Continue exactly from the provided start frame. Vertical 9:16 cinematic 3D CGI, feature-film animation quality. Same café, same two cockroach characters, same outfits, same lighting. The male cockroach stays on the LEFT, the female cockroach stays on the RIGHT for the whole shot.

Camera: locked-off medium two-shot at table height with a very slow, subtle push-in (about 5 percent). Shallow depth of field, blurred customers moving softly in the background.

Action and dialogue:
0-4s: The male cockroach on the left leans back lazily in his chair, half-lidded bored eyes, a cocky smirk, one hand gesturing loosely toward her; his long antennae sway slowly. He speaks in Turkish, casual and slightly teasing, with clear lip and mandible movement:
"Sen gece tek başına yürürken biri peşine takılsa ne yaparsın?"
4-8s: The female cockroach on the right does not look up; she keeps calmly stirring her coffee with a small spoon, eyelashes lowered, one antenna twitching. Then she answers in Turkish, flat and unimpressed, with a tiny knowing smile:
"Kolay."
She slowly raises her eyes to him at the very end.

Natural blinks, realistic eye movement, subtle breathing, antennae moving independently and organically, insect hands moving like human hands.
Audio: only the two characters' voices in Turkish, natural café ambience (soft chatter, cup clinks). Male voice: young adult man, relaxed, slightly cocky. Female voice: young adult woman, cool, dry, confident.
No background music, no narrator, no subtitles, no on-screen text, no watermark. Not cartoon, not 2D.
```

### Kamera ve mimik özeti (yönetmen notu)
| Zaman | Kamera | Kerem | Lara |
|---|---|---|---|
| 0–1 sn | Sabit orta plan | Konuşmaya başlar, eli havada gevşek | Kahveyi karıştırıyor |
| 1–4 sn | Çok yavaş push-in | Göz kapakları yarı kapalı, sırıtma, antenler sallanır | Kirpikler aşağıda, tek anten seğirir |
| 4–6 sn | Push-in sürer | Cevap beklerken kaşını kaldırır | Bakmadan "Kolay." der |
| 6–8 sn | Push-in biter | Hafif şaşkın, göz kırpar | Gözlerini yavaşça ona kaldırır (Klip 2'ye köprü) |

### Üretim sonrası kontrol
1. Türkçe telaffuz anlaşılır mı? Yanlış veya İngilizce aksanlıysa sadece yeniden üret. Promptun başına `Spoken language: Turkish.` satırını ekleyebilirsin.
2. Karakterler yer değiştirdi mi? Değiştirdiyse ekranda klibi sil, aynı promptu yeniden üret.
3. Altyazı veya yazı çıktı mı? Çıktıysa reddet. Altyazıyı kurguda kendin ekleyeceksin.
4. Son kareyi kaydet (Flow'da klibin son karesinde "Save frame" veya ekran görüntüsü). Bu `klip1_son.png` olacak ve **Klip 2'nin başlangıç karesi** olarak kullanılacak. Böylece devamlılık zinciri kopmaz.

---

## 6. Birleştirme ve seslendirme (ücretsiz)

**Seslendirme:** Ayrı bir seslendirme adımı yok. Veo diyaloğu dudak senkronuyla birlikte üretiyor. Ses tonu klipler arasında değişirse ağır klibi yeniden üret. Böylece ayrıca seslendirme ve dudak senkronu aracı gerekmez (bunlar çoğunlukla ücretli).

**Kurgu (Edits veya CapCut ücretsiz, telefonda):**
1. Yeni proje → 9:16 → üç klibi sırayla ekle.
2. Klip başlarındaki sessiz kareleri ve sonlardaki fazlalığı kırp. Hedef toplam: 18–20 sn.
3. Klip 2'de Lara'nın "Terliği getir!" çığlığından hemen sonra 2–3 karelik **hızlı zoom-in** (Edits/CapCut'ta ücretsiz "zoom" keyframe).
4. **Otomatik altyazı** (Türkçe) ekle, beyaz yazı + siyah kontur, ekranın orta-alt üçte birinde. Altyazıları kontrol edip yanlış kelimeleri düzelt.
5. Başlık metni ilk 2 saniyede üstte: **"Kızların kendini savunma taktiği 🪳"**
6. Müzik ekleme (konuşma esprisi müziksiz daha iyi çalışır). İstersen Instagram/YouTube'un kendi ücretsiz müzik kütüphanesini paylaşım ekranında, çok düşük seste ekle.
7. Dışa aktar: 1080×1920, 30 fps. Pro etiketli hiçbir efekt kullanma. Yoksa dışa aktarırken ödeme ister.

---

## Sıradaki adım
1. Bölüm 2'deki iki karakter görselini üret, en iyi varyasyonu seç.
2. Bölüm 3'teki ana kareyi üret.
3. Klip 1'i üret ve sonucu (veya sorunları) bana söyle.

Karakterler onaylandıktan sonra Klip 2 ve Klip 3'ün Flow promptlarını aynı formatta hazırlarım.
