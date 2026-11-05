# KAPI 204 — İnteraktif Korku Mini Dizisi

Instagram Reels / YouTube Shorts için izleyici seçimleriyle ilerleyen psikolojik korku serisi.

| Bölüm | Dosya | Süre | Format |
|---|---|---|---|
| 1 — İlk Paket | [`bolum-1/KAPI204_Bolum1.mp4`](bolum-1/KAPI204_Bolum1.mp4) | 30,0 sn | 1080×1920 (9:16), H.264 + AAC, 24 fps |

## Bölüm 1 — İlk Paket: çekim listesi

| Zaman | Çekim | Ses |
|---|---|---|
| 0,00–0,55 | Siyah ekran | 0,30'da derin kapı zili (ding) |
| 0,55–3,00 | Koridor, 204 numaralı kapı, paspasın üstünde siyah paket. Kamera yavaşça ilerliyor; yazı: “SAAT 02.04. KAPININ ÖNÜNDE BİR PAKET VARDI…” | 0,88'de “dong”, uzun koridor yankısı, floresan uğultusu ve titreme çıtırtıları, düşük drone |
| 3,00–5,60 | Kapı içeri açılıyor, sıcak ışıkta adamın silueti; sola sağa bakıyor, koridor boş | Kilit sesi, kapı gıcırtısı, gerilim pedi giriyor |
| 5,60–8,00 | Yerden alçak açı, paket ön planda, yüze yaklaşma: “Ben hiçbir şey sipariş etmedim ki…” | Önce uykulu bir nefes; diyalogda müzik otomatik kısılır |
| 8,00–11,00 | Masa lambası ışığında paketi masaya koyar, kapağı kaldırır | Karton “tok” sesi, kapak sürtünmesi, müzik yükselir |
| 11,00–12,20 | Üstten: kutunun içinde fotoğraf, el uzanıp alır | Kâğıt hışırtısı, ters yankı şişmesi |
| 12,20–13,00 | Fotoğraf yakın plan: evin İÇİNDEN, karanlık koridordan salona flaşla çekilmiş; tarih damgası 01:58 | **Gerilim vuruşu** (derin vuruş + metalik tını) |
| 12,95–15,00 | Yüz yakın plan: “Bu fotoğraf… [titrek nefes] benim evim.” | Ses titriyor, cümle sonu düşüyor |
| 15,00–17,40 | Fotoğraf çevrilir, el yazısı: “BU GECE YALNIZ DEĞİLSİN.” | Müzik **aniden kesilir**, sadece oda tonu kalır |
| 17,40–20,25 | Adam yavaşça arkasına döner; karanlık koridorun sonundaki yatak odası kapısı kendi kendine kapanır | Yavaş gıcırtı + yumuşak mandal sesi |
| 20,25–22,00 | Karanlık koridor; kapının altındaki ışığı bir şey bir an kesiyor | **Fısıltı:** “Paketi açmamalıydın…” (müzik neredeyse sıfır, hafif yankılı, soldan merkeze kayar) |
| 22,00–28,00 | Telefon elde, kameraya bakar. Panikle, alçak sesle: “Polisi mi… aramalıyım? [hızlı nefes] Yoksa… o kapıyı mı açmalıyım?” → **A — POLİSİ ARA / B — YATAK ODASININ KAPISINI AÇ** → ağır ve alçak: “Kararı… siz verin.” [titrek nefes verme] | Hızlanan kalp atışı, yükselen yüksek tel gerilimi |
| 28,00–30,00 | Yer seviyesi: kapının altından karanlık gölge adamın ayaklarına doğru uzanıyor. “BİR SONRAKİ BÖLÜMÜ SİZ BELİRLİYORSUNUZ. A MI, B Mİ?” — gölge hareket ederken **sert kesim** | 28,05'te final vuruşu (braam + derin vuruş), sürünme sesi, 30,0'da kesim |

## Sıfır maliyetli üretim hattı

Hiçbir ücretli servis, API, abonelik, kredi ya da deneme sürümü kullanılmadı. Oturumda bağlı olan ElevenLabs, Canva, Adobe, HeyGen gibi kredi harcayan araçlara **hiç dokunulmadı**.

| İş | Araç | Lisans |
|---|---|---|
| 3D sahne, ışık, gölge, sis, toz, kamera | [three.js](https://threejs.org) r160, başsız Chromium (yazılımsal WebGL / SwiftShader) | MIT |
| Dokular (terrazzo, duvar, ahşap, parke, halı, pirinç plaka, el yazısı) | Kodla prosedürel üretim (`textures.js`), harici görsel yok | — |
| Karakter | Kodla modellenmiş tek bir model (`man.js`): yüz geometrisi, saç, göz, kapüşonlu, kot, çorap; kol IK, göz kırpma, sese göre ağız hareketi | — |
| Seslendirme (adam) | [Piper](https://github.com/rhasspy/piper) yerel TTS, Türkçe erkek sesi `tr_TR-fahrettin-medium`. Ham kayıt korunur (perde/zaman işlemesi yok); duraklamalar, nefesler, konuşmaya kilitli hava katmanı, yakın mikrofon EQ'su ve hafif sıkıştırma (`natural.py`) | Model: CC0, Piper: MIT/GPL |
| Çekim seçimi ve anlaşılırlık kontrolü | Yerel Whisper-small (sherpa-onnx): her replik için 8–12 çekim, doğru anlaşılanlar arasından en hareketli tonlama seçildi (`secim/`) | Whisper: MIT, sherpa-onnx: Apache-2.0 |
| Fısıltı | Ayrı bir CC0 ses (`tr_TR-fettah-medium`) kaydından rastgele-faz STFT ile gerçek fısıltı spektrumu (canavar efekti yok) | — |
| Müzik ve tüm ses efektleri | numpy/scipy ile sentez (`audio.py`): zil, gıcırtılar, drone, gerilim pedi, kalp atışı, vuruşlar, sentetik yankılar | Özgün, telifsiz |
| Yazı tipleri | Oswald, Cormorant Garamond, Caveat (Fontsource) | SIL OFL 1.1 |
| Kurgu, renk, kodlama | ffmpeg (renk düzenleme ve film greni shader içinde) | LGPL/GPL |

## Dürüst sınırlar

* **Görüntüler fotogerçekçi değil.** Bu ortamda ücretsiz bir yapay zekâ video/görüntü üreticisi ya da GPU yok. Tüm görüntü gerçek zamanlı 3D render: gerçek gölgeler, hacimli ışık hissi, sis, renk düzenleme ve kamera hareketleri var, ama karakter stilize bir 3D figür (mankene yakın), gerçek bir oyuncu değil. Bunu kısmak için yüzler çoğunlukla düşük anahtarlı ışıkta ve karanlıkta tutuldu.
* **Seslendirme hâlâ sentetik.** Ücretsiz Türkçe erkek seslerinden en kalını ve tonlaması en hareketlisi (fahrettin) kullanıldı. İlk duygu denemesindeki vokoder işlemesi sesi robotikleştirdiği için kaldırıldı (`kaynak/eski/emo_vokoder.py`). Şimdiki sürüm ham kaydı bozmadan; seçilmiş çekim, duraklama, nefes ve doğal mikrofon/oda işlemesiyle duygu veriyor. Yine de gerçek bir oyuncu performansı değil. Kayıt gelirse aynı miks hattına takılır. Denenen ses örnekleri: [`bolum-1/ses_ornekleri/`](bolum-1/ses_ornekleri/) (A videoda kullanılan).
* Altyazılar eklendi (Reels'in çoğu sessiz izleniyor). İstenmezse `scene.js` içindeki `subs` dizisi boşaltılabilir.

## Yeniden üretme

```bash
cd bolum-1/kaynak
# 1) Bağımlılıklar (hepsi ücretsiz)
pip install piper-tts numpy scipy
npm pack three@0.160.0 && mkdir -p web/lib && tar xzf three-0.160.0.tgz && cp package/build/three.module.js web/lib/
# 2) Türkçe ses modeli (CC0): sherpa-onnx GitHub sürümlerindeki vits-piper-tr_TR-fettah-medium.tar.bz2
#    açıp modeller/vits-piper-tr_TR-fettah-medium/ altına koyun
python3 tts.py          # fısıltı kaynağı -> tts/w.wav
python3 natural.py A fahrettin  # takes/ içindeki seçilmiş çekimler -> tts_A_fahrettin/ (sonra tts/ içine kopyalayın)
                        # (çekim üretme/seçme araçları: secim/; ek olarak: pip install pyworld sherpa-onnx soundfile)
python3 audio.py        # müzik + efekt + miks -> mix.wav, dudak senkronu -> web/env.json
(cd web && python3 -m http.server 8204 --bind 127.0.0.1 &)
node render.js full     # 720 kare -> visual.mp4 (4 çekirdekte ~25 dk)
ffmpeg -i visual.mp4 -i mix.wav -vf "scale=1080:1920:flags=lanczos,unsharp=5:5:0.4" \
  -af loudnorm=I=-14:TP=-1.5:LRA=11 -c:v libx264 -crf 18 -preset slow -pix_fmt yuv420p \
  -c:a aac -b:a 192k -t 30 -movflags +faststart KAPI204_Bolum1.mp4
```

`node render.js test 40,160,300` ile tek tek kareler PNG olarak `test/` klasörüne alınır.
