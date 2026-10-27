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
- Gök mavisi pamuk kılıf, ince beyaz çizgiler, mercan biye; lacivert kaş ve dudak.
  Köşeleri el olarak kullanır.
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

### KUPA (`ig/characters/kupa.py`)
- Büyük, sırlı taş kupa: dışı canlı turuncu, içi ve daldırma kenarı krem, sırsız taban halkası.
  Kulp tek kolu. Sırtında krem harflerle "ÖNCE KAHVE" yazar; dönüp gösterir.
- Kahverengi "kahve" gözler, koyu kahve sır kaşlar. İçinde saatlerdir soğumuş, üstü zar
  bağlamış kahve.
- Kişilik: unutulmuş, telaşlı, alıngan ama sahibine aşık; soğuk kalınca tıkır tıkır titrer.
- Ses: ElevenLabs "Ali – Mad Man" (`xROJDAAwVXltxzeQxuFL`), etiketler: `[shivering]`,
  `[frustrated]`, `[exasperated]`, `[softly]`, `[whispers]`.
- Yüz yastık ölçeğinde tasarlanıp `FACE_SCALE = 0.45` ile küçültülür.

### Yeni karakter eklerken
- Yüzü `FaceSpec` ile kur; göz boyutu gövdeye göre ~%15 genişlik, gözler arası ~1,5 göz çapı.
- Renk paletinde diğer karakterlerle karışmayan bir ana renk seç (gök mavisi/mercan, bordo/yeşil ve
  turuncu/krem dolu).
- Kanal adları ortak (`ig/characters/base.py` → `CHANNELS`); ifade ön ayarları `ig/expressions.py`.
- Ses: `creative_list_voices(languages=["tr"])` ile seç, voice_id'yi buraya yaz.

## Mekân

Yatak odası (`ig/sets/bedroom.py`): yaşanmış, renkli bir oda. Ayçiçeği sarısı duvar, nane
yeşili pencere duvarı, turuncu çizgili perdeler, konfeti puantiyeli çarşaf, yatak başlığında
ip lambalar, gün batımı posteri, notlu mantar pano, kitaplı raf ve plastik ördek, köşede iri
yapraklı saksı, lacivert kilim, pembe terlikler. Komodindeki turuncu kupa, saksı ve ördek
sonraki bölümlerin karakterleri olabilir.

## Altyazı

Her bölümde gömülü altyazı vardır (`ig/subtitles.py`): ekranın %72 yüksekliğinde (Shorts
arayüzünün üstünde), en fazla 3 kelime, söylenen kelime konuşanın renginde (Yastık mavi,
Battaniye sarı, Kupa turuncu).

## Bölümler

1. **B01 — Yastığın İsyanı** (Yastık, Battaniye): "Ben seni sekiz saattir dinliyorum!" ve
   insanlarına söylenip yine de onları sevdikleri içten final.
2. **B02 — Soğudum** (Kupa, Yastık): sabah yedide doldurulup üç kez ısıtılıp üç kez unutulan
   kupa; dünkü kahvenin saksıya döküldüğü ortaya çıkar, saksı üç gündür uyumuyor.

Her bölüm "Gittiler mi?" ile açılır, kapıda anahtar sesiyle herkesin "eşya"ya dönmesiyle biter.

## Bölüm fikirleri (sıradaki)

1. **Saksı** — B02'den kafeinli; "Bana sadece misafir gelince su veriyor… bir de dünkü kahve."
2. **Ayakkabılar** — sağ teki sol tekin hep önden gitmesinden şikâyetçi; günlük 12.000 adım.
3. **Kupa'nın dönüşü** — bulaşık makinesinde bir gece.
4. **Telefon** — sırları bilir, söylemez… ama ekran görüntüsü alır.
5. **Eski oyuncak** — dolabın en üst rafından; duygusal final.
6. **Çoraplar** — çamaşır makinesindeki kayıp tekler: bir dedektif hikâyesi.
