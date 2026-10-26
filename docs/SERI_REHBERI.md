# İNSANLAR GİDİNCE — Seri rehberi

Bölümler arası tutarlılık için tek kaynak. Kodda karşılığı olan her şey parantez içinde.

## Ton

- Anlatıcı yok. Hikâye diyalog, oyunculuk, ses efekti ve kamerayla ilerler.
- İlk 1–2 saniyede olay: ses + tepki (kapı, anahtar, telefon titremesi…), sonra ilk replik.
- Şikâyetler tırmanır ve absürtleşir; final ya güçlü bir espri ya da kısa bir duygusal dönüş.
- 25–35 sn. Repliklerdeki ölü havayı `tools/prep_lines.py` kırpar (1.12× tempo, perde korunur).
- Videonun alt %20'si Shorts arayüzünün altında kalır: önemli aksiyonu orta/üst bölgede tut.

## Ortak tasarım dili (ig/face.py)

- Parlak, büyük göz küreleri; iris yüzeye boyalı (`materials.eye`), kapaklar karakterin kendi
  malzemesinden, kirpik çizgisi kaş renginde.
- Kaşlar heykelsi kapsül; ağız yüzeye oturmuş koyu boşluk + dudak rulosu, visemlerle konuşur.
- Gerçekçi malzeme, stilize form: kumaş, seramik, ahşap dokusu belirgin; yüzler sevimli ama
  çocuksu değil. Korkutucu/bozuk yüz yok: göz kapakları her zaman gözü kısmen sarar.

## Karakterler

### YASTIK (`ig/characters/yastik.py`)
- Krem pamuk kılıf, ince toz mavisi çizgiler, mavi biye. Köşeleri el olarak kullanır.
- Gri-mavi, ağır kapaklı gözler (`rest_lid_u=0.38`): kalıcı yorgunluk.
- Kişilik: herkesin dertlerini dinleyen yorgun "terapist"; kuru, alaycı, kısa cümleler.
  Patladığında büyük patlar.
- Ses: ElevenLabs "Orhan — Expressive Istanbul Actor" (`y6X1mFgtBqHFtQwrOezf`), etiketler:
  `[tired]`, `[sarcastic]`, `[deadpan]`, `[shouting]`.

### BATTANİYE (`ig/characters/battaniye.py`)
- Bordo-yeşil ekose polar, krem saçaklı etek; yanlardaki köşeleri kol.
- Kehribar gözler, kirpikler, koyu kahve kaşlar; dudak bordo.
- Kişilik: dramatik, alıngan, sahneye düşkün; ama kalbi yumuşak.
- Ses: ElevenLabs "Gözde" (`rtnDjO8siSxeTEeTVczO`), etiketler: `[dramatically]`, `[outraged]`,
  `[softly]`, `[gently]`.

### Yeni karakter eklerken
- Yüzü `FaceSpec` ile kur; göz boyutu gövdeye göre ~%15 genişlik, gözler arası ~1,5 göz çapı.
- Renk paletinde diğer karakterlerle karışmayan bir ana renk seç (krem/mavi ve bordo/yeşil dolu).
- Kanal adları ortak (`ig/characters/base.py` → `CHANNELS`); ifade ön ayarları `ig/expressions.py`.
- Ses: `creative_list_voices(languages=["tr"])` ile seç, voice_id'yi buraya yaz.

## Mekân

Yatak odası (`ig/sets/bedroom.py`): sabah güneşi soldaki pencereden, adaçayı yeşili duvar,
ceviz yatak, meşe parke, petrol mavisi halı. Komodindeki turuncu kupa ve lamba sonraki
bölümlerin karakterleri olabilir.

## Bölüm fikirleri (sıradaki)

1. **Kupa** — "Beni sabah doldurup öğlene kadar unutuyor. Soğudum, Ahmet. Soğudum."
2. **Ayakkabılar** — sağ teki sol tekin hep önden gitmesinden şikâyetçi; günlük 12.000 adım.
3. **Saksı** — sulanmamaktan; "Bana sadece misafir gelince su veriyor."
4. **Telefon** — sırları bilir, söylemez… ama ekran görüntüsü alır.
5. **Eski oyuncak** — dolabın en üst rafından; duygusal final.
6. **Çoraplar** — çamaşır makinesindeki kayıp tekler: bir dedektif hikâyesi.
