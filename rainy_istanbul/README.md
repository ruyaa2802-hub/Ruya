# Yağmurlu İstanbul — 10 sn 3D test sahnesi

Dikey 1080×1920, 30 FPS, 10 sn (300 kare), sesli MP4. Tamamen kodla üretildi:
Blender 4.2 LTS (Cycles, CPU) + MPFB2/MakeHuman (CC0) karakter + Python (numpy) ile post ve ses.

## Akış

| Dosya | Görev |
|---|---|
| `env.py` | Islak arnavut kaldırımı (su birikintileri, animasyonlu yağmur halkaları), cumbalı binalar, sokak lambaları, uzakta aydınlatılmış cami silueti ve şehir ışıkları |
| `character.py` | MPFB2 ile gerçekçi erkek karakter (ten, saç, kaş, göz, takım, ayakkabı) + oyun motoru iskeleti |
| `coat.py` | Vücuda ışın izlemeyle oturtulan prosedürel uzun palto; etek kısmı kumaş simülasyonu (sadece bacaklarla çarpışır) |
| `animation.py` | Adım planlayıcılı IK yürüyüş (ayak kaymaz), bacak erişiminden çözülen kalça yüksekliği, cepte eller, omuz üzerinden geriye bakma, durup uzağa bakma; 3 bölümlü kamera (geniş dolly → yandan takip → yüze yaklaşma), DOF |
| `build_scene.py` | Hepsini birleştirir, kumaşı simüle eder, `.blend` + ses için zamanlama verisi (`*_track.json`) kaydeder |
| `render_setup.py` | Cycles ayarları, mist pasıyla sis + ışık hâlesi (compositor), kamera verisini dışa aktarır |
| `post.py` | Gerçek kamera ile projekte edilen 3D yağmur çizgileri ve zemin sıçramaları (derinlik pasıyla gizlenir, sahne ışığıyla aydınlanır), renk, vinyet, film greni |
| `audio.py` | Örneksiz prosedürel ses: yağmur, animasyondaki topuk temaslarıyla senkron ıslak ayak sesleri, oluk damlaları, şehir uğultusu, uzak araba, vapur düdüğü |
| `make_video.sh` | Uçtan uca: build → render → post → ses → MP4 |

## Ortam notları (bu test sırasında)

- GPU yok → Cycles CPU (4 çekirdek). Render: ~720×1280, 10 örnek + OpenImageDenoise, Lanczos ile 1080×1920'ye ölçeklendi.
- EEVEE yalnızca Mesa yazılım GL ile çalıştı, Cycles'tan yavaştı.
- Hacimsel sis CPU'da çok yavaş olduğu için sis compositor'da mist pasıyla, yağmur post aşamasında yapıldı.

---

# Ciddi Bir Mesele — Bölüm 2: "Hayatının En Büyük Kovalamacası"

14,2 sn, 1080×1920, 30 FPS, sesli: `output/ciddi_bir_mesele_bolum2.mp4`.
Bölüm 1'in karakteri, paltosu, sokağı, ışıkları, render ve post ayarları aynen kullanıldı; yalnız hikâyeye özel parçalar eklendi.

| Dosya | Görev |
|---|---|
| `bus.py` | Otobüs: dış kabuk, aydınlık iç mekân, tutunma direkleri, koltuklar, açılan ön kapı, tekerlekler, farlar/stop lambaları, LED tabelalar ("SONRAKİ DURAK: ÇIKTIĞIN EV") |
| `anim_ep2.py` | Otobüs hareketi; Bölüm 1 adım planlayıcısının koşu ayarları; dönüp otobüse adım atarak binme (2D ayak planı, kaldırım/otobüs zemin yüksekliği); 8 çekimlik kesmeli kamera |
| `build_ep2.py` | Sahneyi kurar, kumaşı simüle eder, ses/post için zamanlama verisi yazar |
| `lipsync.py` | Konuşma WAV'ının zarfından çene açma shape key animasyonu |
| `audio_ep2.py` | Gerilim müziği (tabela anında kaset yavaşlaması ile kesilir), motor/fren/kapı, koşu adımları, nefes, iç mekân uğultusu, cırcır böceği, replik, "wamp wamp" |
| `recam.py` | Kumaşı yeniden simüle etmeden sadece kamerayı yeniden anahtarlar |
| `preview.py` | Workbench ile hızlı animatik (bu ortamda yazılım GL olduğu için yavaş; Cycles düşük çözünürlüklü kilit kareler daha hızlı çıktı) |
| `make_ep2.sh` | Uçtan uca bölüm üretimi |

Notlar:
- Diyalog sesi: ElevenLabs bağlantısı sürekli hız sınırı (429) verdiği için geçici olarak çevrimdışı Piper TTS (`tr_TR-dfki-medium`) kullanıldı.
- Karakterin yüz iskeleti yok; "gözlerin büyümesi" hızlı zoom + baş irkilmesiyle, konuşma çene shape key'iyle yapıldı.
- Render: Cycles CPU, %50 çözünürlük, 6 örnek + OIDN, post aşamasında 1080×1920'ye ölçekleme.
