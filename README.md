# Karakalem Stüdyosu

YouTube Shorts ve Instagram Reels için, gerçekçi karakalem çizimlerinin aşama aşama oluştuğu,
Türkçe çizim taktikleri içeren dikey (9:16, 1080×1920) videolar üreten tarayıcı tabanlı sistem.
API anahtarı, ücretli servis, hesap ya da sunucu gerekmez.

**Bölüm 1: Gerçekçi Kedi Portresi** (42 sn, 8 aşama).

## Hızlı başlangıç

1. `studio.html` dosyasını Chrome, Edge, Firefox veya Safari ile aç (çift tıklamak yeterli).
2. **Başlat / Duraklat / Yeniden başlat** düğmeleriyle oynat. Zaman çizelgesine tıklayıp sürükleyerek istediğin ana atla.
3. Dışa aktarma için iki yol var:
   - **Tarayıcıda kaydet:** MediaRecorder ile gerçek zamanlı kayıt (Chrome/Edge'de MP4 veya WebM, Firefox'ta WebM). Yavaş bilgisayarda kare atlayabilir.
   - **Kayıpsız MP4 (önerilen):** `node tools/render-video.mjs` her kareyi tek tek çizer ve ffmpeg ile
     `cikti/kedi-portresi.mp4` üretir (1080×1920, 30 fps, H.264). Gerekenler: Node 18+, Playwright (`npm i playwright && npx playwright install chromium`) ve ffmpeg. Hepsi ücretsiz.

## Ses ve altyazı

Sistem **ses dosyası üretmez.** Seslendirme metni, cümle başına başlangıç ve bitiş saniyesiyle birlikte şu dosyalarda:

- `bolumler/kedi-seslendirme.md`: tablo ve kopyalanabilir düz metin
- `bolumler/kedi-seslendirme.srt`: altyazı dosyası (panelde "Altyazı (.srt)" ile de indirilebilir)

"Sesli önizleme" seçeneği tarayıcının yerleşik Türkçe sesini yalnızca hoparlörden çalar. **Kayda girmez.**
Sesi kendin kaydedip CapCut, DaVinci Resolve veya Shotcut gibi ücretsiz bir programda videoya ekleyebilirsin.

## Çizim nasıl üretiliyor (dürüst açıklama)

Görüntü fotoğraftan, filtreden ya da yapay zekâ görüntü üreticisinden gelmiyor. Tamamı kodda tasarlanmış vektör çizim verisinden oluşuyor:

- **Elle tasarlanmış anatomi:** göz kapakları, iris, dikey göz bebeği, ışık yansıması, burun derisi, burun delikleri,
  ağız, bıyık yastıkları, siluet, kulaklar ve kulak içi tek bir koordinat sisteminde tanımlı. Bütün aşamalar bu tek
  kaynaktan türetildiği için kedinin oranları ve kompozisyonu baştan sona aynı kalıyor.
- **Ton haritası:** tekir deseni (alındaki "M", yanak çizgileri, gerdanlık), sol üstten gelen ışık, açık
  bıyık yastıkları ve çene, çene altı gölgesi, form kenarlarında koyulaşma.
- **Tüy büyüme yönü (akış alanı):** burundan dışarı akan, alında yukarı, yanaklarda dışa ve aşağı dönen,
  göz çevresinde ışınsal yönler.
- **Tüy darbeleri:** binlerce tüy darbesi bu akış alanını izler. Yoğunlukları ve kalem basınçları ton haritasından
  gelir. Darbelerin kâğıt üzerindeki yerleşimi sabit tohumlu (deterministik) bir dağılımla yapılır, yani her açılışta
  aynı resim çıkar. Tüyler tek tek elle yerleştirilmedi; elle tasarlanmış bölge, yön ve ton kurallarından üretildi.
- **Malzeme benzetimi:** kâğıt dokusu ve lifleri üretilir. Grafit, kalem sertliğine (H, HB, 2B, 4B, 6B) göre kâğıdın
  tümseklerine tutunur; harmanlama (stump) katmanı, silgi ile ışık açma ve sonda yapım çizgilerinin yoğurma silgisiyle
  alınması da benzetilir.
- Her darbenin **başlama zamanı, süresi, yönü (ilk nokta = kalemin kâğıda değdiği yer) ve basınç profili** veri
  olarak tanımlıdır. Çizgiler `Canvas` üzerinde uç uca, kademeli olarak çizilir.

Sınırlar: Sonuç el çizimi bir illüstrasyon gibi görünür ama fotogerçekçi bir usta işi değildir. Gözler biraz
büyük ve stilize, göğüs bölümü sade tutuldu. Kalitenin bir sonraki adımı, gerçek bir referans fotoğraftan
çıkarılmış ton haritası ve daha ayrıntılı göz ve burun katmanlarıdır (aşağıya bakın).

## Dosya yapısı

```
studio.html                 Motor + Bölüm 1 + arayüz (tek dosya, çevrimdışı çalışır)
bolumler/kedi-seslendirme.* Seslendirme metni (md, srt)
tools/render-video.mjs      Kare kare MP4 dışa aktarma (Playwright + ffmpeg)
tools/snap.mjs              Belirli saniyelerden PNG kare alma (kontrol için)
```

`studio.html` üç bölümden oluşur:

1. **Motor (`KS`)**: kâğıt, kalem desenleri, darbe hazırlama, zamanlayıcı (`sequence`), harmanlama ve silgi katmanları,
   kamera (`cameraAt`), ekran yazıları, kalem ve silgi aracı, oynatıcı.
2. **Bölüm verisi** (`KS.register({...})`): `stages`, `camera`, `narration`, `titleCard`/`endCard`, `consAlpha`
   ve çizim katmanlarını döndüren `build(K)`.
3. **Uygulama**: arayüz, zaman çizelgesi, kayıt ve altyazı.

## Yeni bölüm eklemek

Kedi bloğunu kopyala, `id` alanını değiştir (ör. `kurt`) ve `studio.html?bolum=kurt` ile aç. Değiştirilecekler:

- `stages`: aşama adları ve zaman aralıkları
- `camera`: `{ t, x, y, z }` anahtar kareleri (yumuşak geçişli)
- `narration`: `{ t0, t1, text, caption }`
- `build(K)`: `{ strokes, blends }` döndürür. Bir darbe şöyle tanımlanır:

```js
{ layer: 'ink',            // 'cons' yapım çizgisi | 'ink' kalem | 'erase' silgi | 'mask' harmanlama
  grade: '2B',             // H, HB, 2B, 4B, 6B
  pts: [[x, y], ...],      // çizim yönünde kontrol noktaları (Catmull-Rom ile yumuşatılır)
  w: 1.4, a: 0.6,          // kalınlık ve koyuluk
  taper: [0.1, 0.6],       // baş/son incelmesi (tüy için sonda uzun incelme)
  press: [...] }           // isteğe bağlı basınç profili
```

Zamanlama için `K.sequence(darbeler, t0, t1, { lift })` darbeleri tek kalemle sırayla çizilecek şekilde pencereye yerleştirir.

Sıradaki konular: gerçekçi insan gözü, kurt portresi, kelebek kanadı, el ve parmak anatomisi, cam ve metal yansımaları.
