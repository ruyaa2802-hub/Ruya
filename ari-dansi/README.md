# Arılar Dans Ederek Konuşuyor! 🐝

Pırıltı adlı bal arısının sallanma dansını anlatan, 42,5 saniyelik 3D animasyon.

**Çıktı:** `out/arilar-dans-ederek-konusuyor.mp4` (1280×720, 30 fps, H.264 + AAC stereo)

## Nasıl üretildi?

| Katman | Araç |
|---|---|
| 3D sahneler, karakterler, kamera, geçişler | Three.js (r170). Her kare `t` zamanının saf fonksiyonu; headless Chromium'da kare kare render |
| Post-prosesler | Kendi shader'larımız: alan derinliği (bokeh), bloom, hızlı kaydırma (whip-pan) bulanıklığı, ışık patlaması, ACES ton eşleme, vinyet |
| Grafikler (güneş/açı diyagramı, süre çubukları) | SVG/HTML katmanı, aynı zaman çizelgesiyle canlandırılıyor |
| Türkçe anlatıcı | ElevenLabs `eleven_v4`, ses: "Uğur – Turkish Documentary Narrator" |
| Vızıltı, kuşlar, ambiyans, efektler, müzik | `audio/make_audio.py` – numpy ile prosedürel sentez |
| Kodlama / birleştirme | ffmpeg |

## Dosyalar

```
scene/index.html      Sahne + grafik katmanı (tarayıcıda açılabilir önizleme)
scene/js/main.js      Zaman çizelgesi, koreografi, kamera hareketleri
scene/js/bee.js       Arı karakteri (Pırıltı ve kovan arkadaşları – tek tasarım)
scene/js/garden.js    Çiçek bahçesi, kovan kutusu, gökyüzü, güneş
scene/js/hive.js      Kovan içi: dikey petek, dans izi
scene/js/post.js      Post-proses zinciri
render.cjs            Kare kare render → ffmpeg
audio/make_audio.py   Ses tasarımı (4 ayrı katman + miks)
audio/raw/take2.mp3   Ham anlatım kaydı
out/audio/stem_*.wav  Ayrı ses katmanları: anlatım, müzik, ambiyans, efekt
```

## Yeniden üretme

```bash
npm install                                    # three@0.170.0
node render.cjs --from 0 --to 42.5 --out out/video_noaudio.mp4   # (≈1–2 sn/kare, yazılım GPU)
python3 audio/make_audio.py                    # cues.json gerekir (render yazar)
ffmpeg -i out/video_noaudio.mp4 -i out/soundtrack.wav -c:v copy -c:a aac -b:a 192k -shortest out/final.mp4
```

Hızlı kontrol için tek kareler: `node render.cjs --stills 5.5,19.6,23.2`

Tarayıcı önizlemesi: proje kökünde `npx http-server .` → `http://localhost:8080/scene/index.html`
(tıklayınca `out/soundtrack.wav` ile birlikte gerçek zamanlı oynar).

## Zaman çizelgesi

| Süre | Sahne | Görüntü | Anlatım |
|---|---|---|---|
| 0–9 sn | 1 · Büyük keşif | Geniş bahçe → Pırıltı'ya yaklaşma; konma, nektar, etrafı inceleme, kalkış; hızlı kaydırma geçişi | "Bir arının çiçek tarlası…" / "Peki, arkadaşlarına…" |
| 9–18 sn | 2 · Kovandaki mesaj | Pırıltı peteğe konar, 6 arı etrafını sarar, sallanma dansı başlar, dans izi parlar | "İşte sırrı: Dans ederek!" / "Bal arıları, özel bir…" |
| 18–31 sn | 3 · Dansın sırrı | Peteğe dik kamera: yukarı = güneş, düz koşu açısı; kuşbakışı bahçeye çözülme (aynı açı); geri dönüş, süre ↔ uzaklık çubukları | "Dansın yönü…" / "Dansın süresi ise…" |
| 31–42,5 sn | 4 · Hep birlikte yola | Arılar ışığa doğru uçar, ışık patlamasıyla dışarı; takip kamerası, çiçeklere konma, geniş açı; Pırıltı kameraya döner | "Yani bu minik canlılar…" / "Doğanın en şaşırtıcı…" |

## Bilimsel notlar

* Dans **dikey petek** üzerinde yapılır; peteğin "yukarısı" güneşin yönünü temsil eder.
* **Düz koşunun (sallanma koşusu) yukarıya göre açısı** = besin kaynağının güneşe göre yönü.
  Videoda bahçe, kovandan bakıldığında güneşin 35° sağında; dans koşusu da dikeyin 35° sağında.
  Kuşbakışı çekimde aynı açı birebir korunur (kamera tam yukarıdan bakar, ekranın "yukarısı" güneş azimutu).
* **Sallanma koşusunun süresi** uzaklıkla ilişkilidir (daha uzun sallanma = daha uzak kaynak).
  Kesin "saniye başına metre" değeri koloniye/türe göre değiştiği için videoda sayı verilmedi.
* Dönüş halkaları sırayla sağdan ve soldan yapılır (sekiz şekli); halkalar bilgi taşımaz.
* Takipçi arılar dansçıya dönük, antenleriyle yakından izler.
