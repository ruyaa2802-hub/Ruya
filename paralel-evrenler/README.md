# Ya Her Kararımız Başka Bir Evren Yaratıyorsa?

40 saniyelik, 9:16 dikey, 1080×1920, 30 FPS, sinematik 3D animasyon kısa filmi.
Tamamen **ücretsiz ve yerel** araçlarla üretildi. Ücretli API, kredi ya da bulut render kullanılmadı.

- **Final video:** `cikti/ya_her_kararimiz.mp4` (H.264, sessiz stereo kanal)
- **Seslendirme ve diyalog (zaman kodlu):** `metin/seslendirme.md`, `metin/seslendirme.srt`
- **Karakter tasarımı:** `karakter/deniz_karakter_sayfasi.png`

## Üretim hattı
| Aşama | Araç |
|---|---|
| 3D sahne, ışık, materyal, kamera | [three.js](https://threejs.org) r170 (MIT) |
| Render | Headless Chromium (Playwright) + SwiftShader WebGL, kare kare deterministik |
| Post-prodüksiyon | UnrealBloom, ACES tonlama, renk derecelendirme, vinyet, film greni, kromatik sapma, arka plan bokeh'i (özel shader'lar) |
| Kodlama / montaj | FFmpeg (libx264) |

Değerlendirilen ama kullanılmayan araçlar: **HyperFrames** (HeyGen) bulut render'ı HeyGen hesabına bağlı ve CLI ortamında devre dışı. HTML/GSAP tabanlı olduğu için gerçek 3D karakter animasyonuna uygun değil. **Claude Flow** bir ajan orkestrasyon aracı, render motoru değil. Üretken video servisleri ise kredi gerektirdiği için kullanılmadı.

## Yeniden üretmek
```bash
cd paralel-evrenler
npm install                 # three@0.170.0
./assets/indir.sh           # modeller
node render.mjs --scene=0 --stills=0,1,2,3 --out=karakter/k.png   # karakter tasarımı kareleri
for s in 1 2 3 4 5; do node render.mjs --scene=$s; done          # cikti/sahneler/sahneN.mp4
./montaj.sh                                                        # cikti/ya_her_kararimiz.mp4
```
Tek bir kareyi önizlemek için: `node render.mjs --scene=3 --stills=150 --w=540 --h=960 --out=/tmp/onizleme.png`

## Dosya yapısı
- `src/engine.js`: render motoru, karakter sistemi (tek kimlik, çok versiyon), Mixamo→avatar dünya-uzayı retarget, iki kemikli IK, prosedürel saç, post-prodüksiyon
- `src/kozmos.js`: yüzen şehir adaları, kapı çerçeveleri, zaman çizgileri, kırık gerçeklik parçaları
- `src/dunyalar.js`: A evreni (yağmurlu sokak) ve B evreni (gün batımı terası)
- `src/hayatlar.js`: alternatif hayatlar (gezgin, aşçı, ressam, yaşlı hali, çocukluğu, iş insanı, baba)
- `src/sahne1.js` … `src/sahne5.js`: sahneler (her biri bağımsız render edilir)

## Varlık lisansları
- `readyplayer.me.glb`, `Xbot.glb`: three.js deposundaki örnek varlıklar (Ready Player Me avatarı / Mixamo animasyonları).
- `ece_mpfb.glb`: MakeHuman/MPFB ile oluşturulmuş, **CC0** (TalkingHead projesi).
- Ticari kullanım planlıyorsan Ready Player Me ve Mixamo kullanım koşullarını kontrol et.
