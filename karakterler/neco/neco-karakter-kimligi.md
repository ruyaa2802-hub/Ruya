# NECO · Karakter kimliği

Referans görsel: `karakterler/neco/neco_referans.jpg` (bütün Neco üretimlerinde bu görseli **referans/ingredient olarak ekle**)

---

## 1. Referans analizi

| Bölge | Görseldeki detay |
|---|---|
| **Stil** | Yüksek kaliteli stilize 3D animasyon filmi görünümü, parlak yüzeyler, yumuşak gün ışığı, sığ alan derinliği |
| **Kabuk rengi** | Sıcak karamel → bakır-kahve, kenarlarda amber parlama. Karın plakaları daha açık karamel |
| **Kafa** | Pürüzsüz, yuvarlak, üstte hafif geniş. Alında birkaç minik koyu nokta (gözenek) |
| **Gözler** | Çok büyük, yuvarlak, parlak. Bembeyaz göz akı, iri koyu çikolata kahvesi iris, büyük siyah göz bebeği, belirgin ışık yansımaları. Üst göz kapağında kalın koyu kahve kontur, hafif kalkık kaş çıkıntısı |
| **Ağız** | Geniş, samimi gülümseme. Üst sırada düzgün beyaz dişler görünür. Çenede iki küçük ağız uzantısı (palp) |
| **Antenler** | İki tane, aşırı uzun, ince, segmentli, kırmızımsı kahve. Kafanın tepesinden dik çıkar, dışa doğru kavis yapar, kadrajın dışına taşar |
| **Boyun/ense** | Kafanın arkasında daha koyu kırmızı-kahve bir kalkan (pronotum) |
| **Gövde** | Dik duran, tombul. Yatay şeritli segmentli karın. Sırtta kapalı, koyu maun renkli kanat örtüleri, yanlardan görünür |
| **Uzuvlar** | 6 adet, ince, parlak, eklemli, üzerinde minik diken ve kıllar. Arka iki bacak üstünde durur. Üst çift kol gibi çalışır (biri el sallıyor, uçta 4 sivri parmaklı böcek eli). Orta çift yanlarda |
| **Kişilik (görselden)** | Neşeli, sempatik, biraz ukala "selam!" enerjisi |
| **Görselde kopyalanmayacak tek şey** | Sağ alttaki ✦ işareti. Bu Gemini/Veo'nun filigranıdır, karakterin parçası değil |

---

## 2. NECO KİLİDİ (her promptun içine aynen yapıştır)

Bu blok Neco'nun "DNA'sı". Her görsel ve video promptunda **kelimesi kelimesine aynı** kullanılmalı. Devamlılığı sağlayan şey bu.

```
NECO: a stylized 3D anthropomorphic cockroach character in high-end animated feature film style. Glossy warm caramel-to-copper brown exoskeleton with soft amber highlights. Smooth rounded head, slightly wider at the top, with a few tiny dark pore dots on the forehead. Huge round glossy eyes with bright white sclera, large dark chocolate-brown irises, big black pupils and sparkling catchlights, framed by thick dark-brown upper eyelid rims and slightly raised brow ridges. Wide friendly grin showing a neat row of white upper teeth, two small mouthpart palps at the chin. Two extremely long thin segmented reddish-brown antennae rising straight up from the top of the head and arching outward. Darker reddish-brown pronotum shield behind the head. Plump upright body with a ribbed segmented abdomen of light caramel horizontal plates, darker mahogany wing cases folded along the back and visible at the sides. Six slender glossy jointed limbs with fine bristles and tiny spines; he stands upright on the two hind legs, the top pair works as arms with small four-pointed spiky insect hands, the middle pair rests at his sides.
```

---

## 3. Üretim adımları (ücretsiz: Gemini uygulaması veya Google Flow görsel üretimi)

Her adımda `neco_referans.jpg` dosyasını **görsele ekle** (Gemini'de ataş/+ simgesi, Flow'da Ingredients). Metin tek başına "birebir aynı" sonuç vermez. Birebirliği referans görsel sağlar.

### Adım 1: Temiz ana görsel (`neco_ana.png`)
Aynı poz ve aynı mutfak, temiz ve keskin bir kare.
```
Use the attached image as the exact character reference. Recreate this exact same character with identical proportions, colors, eyes, teeth, antennae, body segments and limbs — do not redesign or stylize him differently.
[NECO KİLİDİ'Nİ BURAYA YAPIŞTIR]
Pose: standing upright on a wooden kitchen counter, waving at the camera with his raised right arm, big friendly grin, looking straight into the lens.
Background: softly blurred cozy kitchen — stainless steel fridge with paper notes and magnets, a wicker basket and a small plant on top, wooden utensils, an oven on the right, warm natural daylight.
Camera: eye level with the character, 50mm lens, shallow depth of field, crisp focus on the eyes.
Vertical 9:16, ultra-detailed, clean image, no text, no logo, no watermark.
```

### Adım 2: Dönüş (turnaround) sayfası (`neco_turnaround.png`)
Videoda yandan ya da arkadan göründüğünde tasarımın bozulmaması için.
```
Use the attached image as the exact character reference. Character turnaround model sheet of this exact same character, identical design, no changes.
[NECO KİLİDİ'Nİ BURAYA YAPIŞTIR]
Show him four times side by side in a neutral standing pose, arms relaxed: front view, three-quarter view, side profile, back view (wing cases visible). Same scale, same lighting, evenly spaced.
Plain light-grey seamless background, soft studio lighting, high detail, no text, no labels, no watermark. Horizontal 16:9.
```

### Adım 3: Mimik sayfası (`neco_mimikler.png`)
Senaryodaki tepkiler için hazır yüzler.
```
Use the attached image as the exact character reference. Facial expression sheet of this exact same character, identical design, head and shoulders only, 6 panels in a 3x2 grid:
1) big friendly grin, 2) bored half-lidded smug look with a lopsided smirk, 3) shocked — eyes wide open, antennae stiff and straight up, 4) laughing hard with eyes squeezed shut, 5) eye-roll with a sarcastic smile, 6) talking mid-sentence, mouth half open.
[NECO KİLİDİ'Nİ BURAYA YAPIŞTIR]
Plain light-grey background, consistent soft studio lighting, no text, no labels, no watermark. Horizontal 16:9.
```

### Adım 4 (isteğe bağlı): Kafe kıyafetli versiyon (`neco_kafe.png`)
İlk brief'teki "beyaz salaş tişört + gümüş zincir + siyah saat" stilini istersen.
```
Use the attached image as the exact character reference. Same exact character, identical face, eyes, antennae, colors and limbs.
[NECO KİLİDİ'Nİ BURAYA YAPIŞTIR]
Now he wears an oversized loose white t-shirt (his wing cases peek out at the back), a chunky silver chain necklace and a matte black wristwatch on his left arm.
He sits on a chair at a small round wooden café table like a human, one arm resting on the table, relaxed confident smile. Two white coffee cups and a small metal sugar dispenser on the table.
Background: modern café, large windows, green plants, warm dim pendant lights, blurred people, creamy bokeh.
Vertical 9:16, cinematic lighting, ultra-detailed, no text, no watermark.
```

---

## 4. Hareket ve ses testi (Google Flow · Veo, 8 sn)

Karakteri onaylamadan önce bir kere hareket ettirip sesini dinle.

- Mod: **Frames to Video** · Başlangıç karesi: `neco_ana.png` · 9:16 · Çıktı: 1 · En ucuz/Fast Veo modeli
```
Continue exactly from the start frame. Same character, same kitchen, same lighting, stylized 3D animated feature film quality.
The cockroach character waves cheerfully with his raised arm, his long antennae swaying and bouncing naturally, he blinks, tilts his head and says in Turkish with a friendly, slightly cocky young male voice, clear lip and mouth movement:
"Selam! Ben Neco. Evet, mutfaktayım. Hayır, gitmiyorum."
He ends with a smug little shrug and a grin.
Camera: static, eye level, very slow push-in. Soft kitchen ambience only.
No music, no narrator, no subtitles, no on-screen text.
```

---

## 5. Onay kontrol listesi
- [ ] Gözler: beyaz göz akı + iri koyu kahve iris + kalın üst kapak konturu
- [ ] Gülüşte üst dişler görünüyor
- [ ] İki uzun anten, kafanın **tepesinden** dik çıkıyor
- [ ] Karın şeritli ve açık karamel, kanat örtüleri koyu maun
- [ ] 6 uzuv, arka ikisinin üstünde dik duruyor
- [ ] Renk tonu referansla aynı (daha kırmızı ya da daha sarı değil)

**Not:** Ücretsiz Gemini/Flow çıktılarında köşede küçük bir ✦ filigranı olur, bu normal. Reels ve Shorts paylaşımına engel değil.
