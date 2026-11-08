# Beynin Neden Kendi Kendine Konuşur?

30 saniyelik, dikey (9:16) 3D sinematik animasyon. Instagram Reels / YouTube Shorts için.

| Dosya | İçerik |
|---|---|
| [`BeyinIcSes.mp4`](BeyinIcSes.mp4) | Seslendirmeli sürüm: 1080×1920, 24 fps, 30,0 sn, H.264 + AAC, -14 LUFS |
| [`BeyinIcSes_seslendirmesiz.mp4`](BeyinIcSes_seslendirmesiz.mp4) | Aynı görüntü; anlatım yalnızca altyazıda, ses tasarımı ve müzik tam |
| [`onizleme.png`](onizleme.png) | Kare önizlemesi |

## Karakter

Tek model (`kaynak/web/man.js`), hem gerçek insan hem de beynindeki minyatür kopya olarak kullanıldı. Hardal sarısı kapüşonlu, lacivert kot, beyaz spor ayakkabı, yuvarlak ince çerçeveli gözlük ve koyu kahve saçı var. Göz kırpma, kaş, konuşma ağız hareketi ve gülümseme mimikleri bulunuyor.

## Çekim akışı

| Zaman | Görüntü | Ses |
|---|---|---|
| 0,0–1,1 | Siyah ekran | Gizemli açılış (derin alt bas + cam tınısı); “Bir dakika…” |
| 1,1–1,8 | Odada oturan insanın gözüne hızla yaklaşma | “Şu an kiminle konuşuyorsun?”, yükselen whoosh |
| 1,8–2,6 | Makro göz: lifli iris, yansımalı kornea, kirpikler; göz bebeği büyür, kamera içine dalar | |
| 2,6–4,0 | Flaş + radyal hız bulanıklığı → ıslak, kıvrımlı beyin dokusu mağarası; dev nöronun üstünde oturup kendi kendine konuşan minyatür karakter. Yazı: **ZİHNİNDEKİ SESİN SAHİBİ KİM?** | Whoosh-boom + elektrik kıvılcımı, elektronik atmosfer başlar |
| 4,0–10,0 | Miyelinli sinir lifi köprüsünde yürüyüş; Ranvier düğümlerinden atlayan ışık darbeleri. Balonlar: “Acaba bugün ne olacak?” / “Dün neden öyle söyledim?” / “Ya yarın işler ters giderse?” | Balon “pop”ları, arpej, nöron tıkırtıları |
| 10,0–19,0 | Kamera sinir ağına girer; ışık dalgaları nöronları ve aksonları sırayla yakar | Anlatım (bilimsel açıklama), dalga titreşimleri, bas nabzı |
| 19,0–20,0 | Beyinden hızla çıkış → flaş → gözden geri çekilme | Ters whoosh + yumuşak vuruş |
| 20,0–30,0 | Odada sessizce oturan insan. Başının üstünde balonlar belirir: “kelimelerle” denince kelimeler (Bugün… / Neden? / Yarın!), “görüntülerle” denince resimler (güneş, ev, kalp). Finalde büyük balonun içinde minyatür karakter kameraya bakıp gülümser | Duygusal piyano ve pad, final anlatımı |

## Ücretsiz üretim hattı

Hiçbir ücretli servis, API veya kredi kullanılmadı.

| İş | Araç | Lisans |
|---|---|---|
| 3D, ışık, gölge, sis, bloom, kamera | three.js r160 + başsız Chromium (yazılımsal WebGL) | MIT |
| Beyin dokusu, nöronlar, göz, oda, dokular | Tamamen kodla prosedürel (`brain.js`, `eye.js`, `room.js`, `textures.js`) | — |
| Anlatım | Piper TTS, Türkçe erkek sesi `tr_TR-fahrettin-medium`. Her cümle tek parça üretildi (akıcı tonlama); cümle başına 16 çekimden doğru anlaşılanlar arasında tonlaması en hareketlisi seçildi (`voice_takes3.py`, `voice_build2.py`). Virgül duraklamaları ses dalgasından bulunup altyazı ve balonlara bağlandı | CC0 / MIT |
| Anlaşılırlık kontrolü | Yerel Whisper-small (sherpa-onnx): her parça ve bitmiş miks tek tek doğrulandı | MIT / Apache-2.0 |
| Müzik ve tüm efektler | numpy/scipy ile özgün sentez (`audio.py`); nöron tıkırtıları sahnedeki ateşlenme zamanlarına (`events.json`) birebir bağlı | Özgün, telifsiz |
| Yazı tipleri | Nunito, Oswald (Fontsource) | SIL OFL 1.1 |
| Kurgu, kodlama | ffmpeg | LGPL/GPL |

## Dürüst sınırlar

* Görüntü fotogerçekçi değil; GPU ve ücretsiz bir yapay zekâ video modeli yok. Tüm görüntü gerçek zamanlı 3D render. Karakter stilize, mankene yakın bir figür.
* Anlatım sentetik (Piper). Anlaşılır ama bir seslendirme sanatçısı kadar doğal değil. Bu yüzden ayrıca seslendirmesiz sürüm de var. Kendi ses kaydınızı `kaynak/tts/` içine koyarsanız `audio.py` aynı zamanlamayla yeniden miksler.

## Yeniden üretme

```bash
cd kaynak
pip install numpy scipy soundfile piper-tts sherpa-onnx
npm pack three@0.160.0 && mkdir -p web/lib && tar xzf three-0.160.0.tgz && cp package/build/three.module.js web/lib/
python3 voice_build2.py                             # takes3/ -> tts/hook.wav, sci.wav, fin.wav + web/env.json zamanlamaları
(cd web && python3 -m http.server 8205 --bind 127.0.0.1 &)
node events.js                                      # nöron ateşlenme zamanları -> events.json
python3 audio.py                                    # mix.wav + mix_seslendirmesiz.wav
node render.js full                                 # 720 kare -> visual.mp4
```
