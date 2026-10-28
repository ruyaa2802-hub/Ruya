# Köpekler Aynadaki Görüntülerini Neden Tanımıyor? 🐾

Pirilumo kanalı için 50,5 saniyelik dikey (9:16, 1080×1920, 30 fps) bilim animasyonu (YouTube Shorts / Instagram Reels).
Üretim yöntemi önceki projelerle aynı: Three.js ile kodla kurulan 3D sahneler, kare kare render (headless Chromium, `render.cjs`), ffmpeg ile MP4.

**Çıktı:** `out/kopek-ayna-koku_shorts.mp4` · altyazı `out/altyazi_tr.srt` · ses katmanları `out/audio/stem_*.wav`

## Seslendirme (gerçekten üretildi)

* ElevenLabs, ses: **Uğur – Turkish Documentary Narrator**.
* Model: **`eleven_flash_v2_5`**. Hesapta 528 kredi kalmıştı; tercih edilen `eleven_v4` modeli bu metin için 984 kredi istedi ve üretim başarısız oldu (kredi düşmedi). Bu yüzden aynı sesle daha ucuz flash modeli kullanıldı (418 kredi). Duygu etiketleri bu modelde yok; tonlama v4'e göre biraz daha düz.
* Kredi yüklendiğinde metin `eleven_v4` ile yeniden üretilip `audio/raw/take1.mp3` değiştirilerek `audio/make_audio.py` tekrar çalıştırılabilir.
* Cümle sınırları yerel `faster-whisper` kelime zamanlamasıyla bulundu (`audio/words.json`). Video ~50 sn'ye sığsın diye anlatım %8 hızlandırıldı (perde korunarak).
* Koklama sesi ElevenLabs ses efektiyle üretildi. Pati, ortam, geçiş efektleri ve müzik kodla (numpy) üretildi.

### Seslendirme metni (zaman kodlu)

| Süre | Metin |
|---|---|
| 0:00,4 | Köpeğin aynada başka bir köpek gördüğünü düşündün mü hiç? |
| 0:03,5 | Peki, neden onunla gerçek bir köpek gibi iletişim kuramıyor? |
| 0:07,4 | Çünkü aynada bir görüntü var ama o görüntüden gerçek bir koku gelmiyor. |
| 0:12,0 | Köpekler için koku, çevrelerindeki canlılar hakkında bilgi edinmenin en önemli yollarından biri. |
| 0:17,4 | Bir köpek, kokular sayesinde çevresindeki canlılar hakkında pek çok ipucu edinebilir. |
| 0:22,8 | Biz bir odaya baktığımızda gördüklerimizi fark ederiz; o ise bizim fark edemediğimiz koku bilgilerini de araştırır. |
| 0:29,8 | Araştırmalar, köpeklerin kendi kokularındaki değişikliklere tepki verebildiğini gösteriyor. |
| 0:34,5 | Yani aynada kendini tanıma testi, bir köpeğin kendisi hakkında hiçbir farkındalığı olmadığı anlamına gelmez. |
| 0:41,6 | Belki de köpeklerin kendilerini anlamlandırma biçimi bizimkinden farklıdır. |
| 0:46,4 | Peki, sence köpeğin aynada kimi gördüğünü düşünüyor? |

## Sahneler

| Süre | Görüntü |
|---|---|
| 0–7,2 sn | Loş, sıcak ışıklı oturma odası; odanın ortasında boy aynası (**gerçek yansıma**: `Reflector`). Golden retriever aynaya yürür; yansıması da aynı hareketi yapar. Kafasını yana eğer, kaşlarını kaldırır, burnunu cama yaklaştırır; burun yanından yakın plan. |
| 7,2–17,2 sn | Aynayı koklar. Odadaki eşyalardan (koltuk, bitki, ayakkabı, sahibi) ince renkli koku izleri; gerçek köpeğin çevresinde sıcak koku zerrecikleri — **yansımada ise hiçbiri yok** (koku efektleri aynanın görmediği katmanda). "Aynada: görüntü ✓ · koku ✗". Köpek aynanın arkasına dolaşır, yeri koklar, kimse yok. |
| 17,2–21,6 sn | Burna makro yakın plan → kafa saydamlaşır (röntgen görünümü): solunum kıvrımları, altın renkli koku alma bölgesi, koku soğancığı; havanın bir kısmı koku bölgesine (altın), bir kısmı boğaza (mavi) gider. "~300 milyon koku reseptörü / insanda ~6 milyon". |
| 21,6–29,6 sn | Parkta köpek çimeni, ağaç dibini kokluyor; her kaynak farklı renkte bir bilgi katmanı (çimen, ağaç dibi, başka bir köpeğin izi). "Kokular gözle görülmez · temsili gösterim". |
| 29,6–41,5 sn | Köpek yeniden aynaya bakar; aynadaki görüntü park sahnesiyle iç içe geçer. Parkta **kendi kokusu** ile **kendi kokusu + yabancı koku**yu karşılaştırır, ikincisini daha uzun koklar. "Ayna testi ≠ koku testi". |
| 41,5–50,5 sn | Son kez aynaya bakar, kafasını eğer, sahibinin yanına gidip oturur; el başını okşar. Kamera geri çekilir; meraklı yüz. **"Köpeklerin dünyası kokularla dolu! 🐾"** |

## Bilimsel notlar

* **Ayna testi** (işaret testi) görsel kendini tanımayı ölçer; köpeklerin çoğu bu testi geçmez. Bu, **kendileri hakkında hiçbir farkındalıkları olmadığı** anlamına gelmez; videoda da böyle bir iddia yoktur.
* **Koku ile "kendini tanıma" testleri:** Köpekler kendi idrar kokularındaki değişikliğe (başka bir kokuyla karıştırıldığında) daha uzun süre koklayarak tepki verebiliyor (ör. Horowitz 2017, "Smelling themselves"). Videodaki "kendi kokusu / kendi kokusu + yabancı koku" sahnesi bu deneyin sadeleştirilmiş temsilidir.
* **Burun anatomisi:** Solunan havanın bir kısmı ayrı bir yolla burnun arka-üst bölgesindeki koku alma epiteline gider; sinyaller koku soğancığına iletilir. Görselleştirme şematiktir.
* "~300 milyon reseptör" sık kullanılan **yaklaşık** bir değerdir; ırka göre değişir.
* Renkli koku izleri ve zerrecikler **gerçekte görünmez**; anlatımı kolaylaştıran temsillerdir (videoda bunu belirten not vardır).

## Dosyalar

* `scene/js/dog.js` — golden retriever:
  * Gövde, boyun, bacak ve kuyruk loft yüzeylerdir. Üzerlerinde 4–7 katmanlı tüy kabukları vardır; kuyrukta uzun tüyler.
  * Kafa kafatasından buruna tek parça bir yüzeydir. Islak burunda hareketli burun delikleri, kahverengi gözler, göz kapakları ve kaşlar, sarkık kulaklar (kafa eğilince yerçekimiyle sallanır) ve açılan çene vardır.
  * Hareketleri: yürüme, oturma, koklama, kafa eğme, kuyruk sallama.
  * Röntgen modunda burun anatomisi ve hava akışı görünür.
* `scene/js/room.js` — oturma odası ve gerçek yansıma yapan boy aynası.
* `scene/js/park.js` — park: çimen, ağaç, direk, bank.
* `scene/js/scent.js` — koku görselleştirmesi: şerit izler, zerrecikler, burna akan "koklama" akışı ve köpeğin çevresindeki koku halesi. Hepsi 1. katmandadır; aynanın yansıma kamerası bu katmanı görmez.
* `scene/js/main.js` — zaman çizelgesi, kamera yolları, ayna→park çözülmesi, ekran yazıları.
* `audio/make_audio.py` — ses miksi.

## Yeniden üretme

```bash
npm install
for i in 0 1 2 3; do node render.cjs --format vertical --from $(echo "$i*12.625" | bc) --to $(echo "($i+1)*12.625" | bc) --out out/parts/part$i.mp4 & done; wait
ffmpeg -f concat -safe 0 -i <(for i in 0 1 2 3; do echo "file '$PWD/out/parts/part$i.mp4'"; done) -c copy out/video_vertical_noaudio.mp4
python3 audio/make_audio.py
ffmpeg -i out/video_vertical_noaudio.mp4 -i out/soundtrack.wav -map 0:v -map 1:a -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p \
  -af "volume=1.4dB,alimiter=limit=0.891:level=false" -c:a aac -b:a 192k -ar 48000 -movflags +faststart -shortest out/kopek-ayna-koku_shorts.mp4
```

Sonuç −16,1 LUFS, tepe −1,3 dBFS (ebur128).

Test kareleri: `node render.cjs --format vertical --stills 4.2,8.8,19.8,26.8,36,49.5`
