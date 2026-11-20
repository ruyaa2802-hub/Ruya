# Benim Küçük Dünyam – 1. Bölüm: Başkalarının Evindeki Işıklar

9:16 dikey, 1080×1920, 24 fps, 90 sn'lik 2D animasyon kısa film.

**İzlemek için:** `cikti/benim_kucuk_dunyam_bolum1.mp4`

## Nasıl üretildi
Tamamen ücretsiz ve açık kaynak araçlarla, koddan üretildi (ücretli platform veya abonelik yok):

- **Çizim / animasyon:** Python + Cairo. Karakterler, iskeletli "kukla" olarak çizilip her karede yeniden hareket ettiriliyor:
  yürüme döngüsü, koşma, oturma, nefes alma, göz kırpma, bakış yönü, kaş/ağız ifadeleri, rüzgârda saç ve etek.
- **El çizimi estetiği:** titreşen kurşun kalem hatları (saniyede 8 kez "kaynayan" çizgiler), suluboya pigment kenarları,
  kâğıt lifi dokusu, film greni, vinyet ve ışık parlaması (bloom).
- **Kamera:** tek parça, yumuşak eğrilerle (Catmull-Rom) hareket eden sinematik kamera; sahneler arasında çapraz geçişler,
  hayale altın ışıkla geçiş ve hayalin altın zerreler hâlinde dağılması.
- **Ses:** sentezlenmiş piyano ve yaylılar (La minör → hayalde Fa–Sol–Do aydınlığı), rüzgâr, şehir uğultusu,
  yürüyüşle senkron ayak sesleri, pencerelerden boğuk aile sesleri ve tabak tıkırtıları.
- **Anlatım:** tercihiniz doğrultusunda seslendirme yerine kelime kelime beliren altyazılar; küçük kızın repliği ayrı,
  sıcak renkte. (Sonradan gerçek seslendirme eklenebilir; zamanlamalar `kaynak/timing.py` içinde.)

## Sahne akışı
| Süre | Sahne |
|---|---|
| 0–14 sn | Akşam yolculuğu: uzak genel plandan kızın yüzüne yaklaşan kamera |
| 14–31 sn | Pencereler: sofrayı kuran anne, çocuğunu havaya kaldıran baba, yemek yiyen aile |
| 31–44 sn | Büyük pencere önünde durma → camın içinden ters açı: gülümseme, bakışın yere düşmesi, fısıltı |
| 44–53 sn | Hayal: altın ışıklı oda, üç sandalye, kızın koşup oturması |
| 53–62 sn | Hayalin dağılması, soğuk sokakta yalnız |
| 62–73 sn | Final: lambaların altında uzaklaşan küçük siluet, kararma |
| 75–90 sn | Alıntı ve başlık kartı |

## Yeniden üretmek
```bash
pip install pycairo numpy scipy pillow
cd kaynak
python3 render.py video 4     # görüntü → build/video_sessiz.mp4
python3 audio.py              # ses   → build/ses.wav
ffmpeg -i ../build/video_sessiz.mp4 -i ../build/ses.wav -c:v copy -c:a aac -b:a 192k -shortest ../cikti/benim_kucuk_dunyam_bolum1.mp4
```
Tek kare önizleme: `python3 render.py frames 12.4 40.5`
