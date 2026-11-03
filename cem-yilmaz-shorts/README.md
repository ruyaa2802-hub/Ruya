# Cem Yılmaz Kimdir? — 60 sn Shorts / Reels animasyonu

Dikey 1080 × 1920, 30 fps, ~60 sn. Türkçe seslendirme ve burned-in Türkçe altyazılar.

## Dosyalar

| Dosya | Açıklama |
| --- | --- |
| `index.html` | Animasyon sahnesi. `render(t)` fonksiyonu her kareyi saniyeye göre deterministik çizer. |
| `render.cjs` | Playwright ile kareleri alıp ffmpeg'e (libx264) akıtan render betiği. |
| `narration_mix.m4a` | Sahne seslendirmeleri (ElevenLabs, `Veyzel - Energetic Turkish Male`) + telifsiz arka plan müziği, sahne zamanlarına göre karıştırılmış. |
| `cem-yilmaz-kimdir.mp4` | Son video: silent render + ses birleştirilmiş hali. |

## Sahne planı

| Zaman | Sahne | Seslendirme (sn) |
| --- | --- | --- |
| 0–8 | Giriş: "CEM YILMAZ / KİMDİR?" patlaması | 7.6 |
| 8–18 | Hayatı: İstanbul, 23.04.1973 kartları | 9.4 |
| 18–31 | Kariyeri: stand-up, 2004, G.O.R.A. | 9.2 |
| 31–47 | Filmleri: G.O.R.A. 2004, A.R.O.G. 2008, Yahşi Batı 2009, Arif V 216 2018 | 15.5 |
| 47–60 | Kapanış: Oyuncu / Yönetmen / Senarist + "Sence en komik filmi hangisi?" | 9.1 |

## Bilgi kaynakları

Tüm metin ve tarihler web araması ile doğrulandı; kaynaklar çelişen yerlerde (eğitim, doğum semti, sinema
kariyerinin başlangıç yılı) videoya bilerek alınmadı. Yer ve tarih bilgisi için kullanılan kaynaklar:
Beyazperde ve biyografiler.com (doğum tarihi/yeri), Wikipedia "G.O.R.A." ve "A.R.O.G." sayfaları (film tarihleri),
Hokkabaz (2006) yönetmenlik bilgisi.

## 3B karakter (Blender)

Sahne 3'teki sunucu karakteri `blender/host_layer.py` ile 3B olarak üretilir. Blender uygulaması yerine
`bpy` (Blender'ın Python modülü) kullanılır; Workbench motoru ile render alınır (EEVEE CPU'da çok yavaş).

```bash
python3.11 -m venv blender-venv && ./blender-venv/bin/pip install bpy
# libEGL gerekir: apt-get install -y libegl1 libgl1 libgles2
OUT_DIR=./host_frames FRAMES=549-931 ./blender-venv/bin/python blender/host_layer.py
# kareler 1080x1920 RGBA, 30 fps zaman çizelgesine göre adlandırılır (host_0549.png ...)
HOST_DIR=./host_frames node render.cjs silent.mp4 30 60
```

Kare klasörü (~350 MB) depoya konmaz. `index.html` bu kareleri `window.HOST_DIR` üzerinden okur;
`render.cjs` bu değeri `HOST_DIR` ortam değişkeninden alır.

## Yeniden üretim

```bash
# 1) Sesler: ElevenLabs'ta sahne metinleri ayrı üretilip s1..s5.mp3 olarak indirildi.
# 2) Müzik + karışım (sahne başlangıçları ms): 0, 8000, 18000, 31000, 47000
ffmpeg -i s1.mp3 -i s2.mp3 -i s3.mp3 -i s4.mp3 -i s5.mp3 -i music.wav -filter_complex "..." narration_mix.m4a
# 3) Görsel: silent.mp4
NODE_PATH=$(npm root -g) node render.cjs silent.mp4 30 60
# 4) Birleştirme
ffmpeg -i silent.mp4 -i narration_mix.m4a -c:v copy -c:a aac -b:a 192k -shortest cem-yilmaz-kimdir.mp4
```

Müzik `numpy` ile üretilen basit bir pad + kick + hi-hat yatağıdır; üçüncü taraf bir eser içermez.
