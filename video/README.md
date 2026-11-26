# Dinlendi – 9:16 hüzünlü romantik kısa animasyon (74 sn)

Tamamen ücretsiz araçlarla üretilir: **HTML Canvas** (çizim), **Playwright/Chromium** (kare yakalama),
**FFmpeg** (video), **Python + numpy** (piyano, yaylılar, yağmur, bildirim sesi; hepsi sentez).
Hiçbir ücretli servis, stok görsel ya da yapay zekâ kredisi kullanılmaz.

## Dosyalar
| Dosya | Görev |
|---|---|
| `index.html` + `anim.js` | Animasyonun tamamı. Tarayıcıda açınca önizleme oynatıcısı çıkar. |
| `tools/render.js` | Kareleri çizip `build/video_sessiz.mp4` üretir. |
| `tools/stills.js` | Seçilen saniyelerden kontrol kareleri alır. |
| `audio.py` | Müzik + efektleri sentezler, `ses/` klasöründeki seslendirmeyi yerleştirir, videoyla birleştirir. |
| `ses/` | Seslendirme kayıtlarını buraya koy. |

## Üretim
```bash
node tools/render.js build/video_sessiz.mp4 4   # görüntü (~7 dk)
python3 audio.py --mux                           # ses + birleştirme → build/dinlendi.mp4
```

## Seslendirme kayıtları (`ses/` klasörü, wav/mp3/m4a/ogg olabilir)
| Dosya adı | Başlangıç | Azami süre | Replik |
|---|---|---|---|
| `01_kanca` | 0:00.4 | 2.7 sn | Hepsini dinliyorsun… neden hiç cevap vermiyorsun? *(fısıltı)* |
| `02_gece` | 0:03.8 | 7.1 sn | Bugün yine o kafeye gittim. Senin sevdiğin kurabiyeden aldım… ama yiyemedim. İyi geceler. |
| `03_gun47` | 0:13.4 | 3.0 sn | Annem seni sordu yine… |
| `04_gun183` | 0:16.7 | 3.1 sn | Kar yağdı, sen hep ilk karda dışarı çıkardın… |
| `05_gun301` | 0:20.0 | 2.9 sn | Bugün iyiyim. Galiba. |
| `06_dogumgunu` | 0:25.0 | 6.0 sn | Bugün senin doğum günün. Bir kere… sadece bir kere cevap ver. Lütfen. |
| `07_yarin` | 1:04.2 | 2.6 sn | Yarın… size gelebilir miyim? |

`06_dogumgunu`, 0:41'de Sevim Hanım'ın kulaklığından sızan cızırtılı ses olarak da otomatik kullanılır.
Baştaki/sondaki sessizlik kırpılır, seviye eşitlenir. Süreyi aşan kayıt en fazla %25 hızlandırılır.
