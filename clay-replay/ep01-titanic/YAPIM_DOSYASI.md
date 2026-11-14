# CLAY REPLAY — Bölüm 1: TİTANİK
**"Kapıda Yer Var mı?"** · 9:16 dikey · 24,6 sn · Türkçe · anlatıcı yok

## 1. Orijinal sahne neden unutulmaz?
- **Pruvada kollar açık "uçuyorum" pozu**: gün batımı, rüzgâr, romantizm. Tek kare bile tanınıyor.
- **Buz dağı**: herkes sonunu biliyor. Bu yüzden gerilim kendiliğinden kuruluyor.
- **Kapı tartışması**: "Kapıda ikisine de yer vardı" sonradan internet şakasına döndü.

Parodinin fikri: Romantik an, kahramanların beceriksizliği yüzünden bozuluyor. Buz dağı sadece minicik bir **buz küpü** çıkıyor ama gemi yine de batıyor. Kapı meselesi de bu kez tersinden çözülüyor.

## 2. Karakterler (sabitlenmiş tasarım)
| | **RÜZGÂR** | **FINDIK** |
|---|---|---|
| Boy | Çok uzun ve sırık gibi ince (~560 birim) | Kısa ve armut gövdeli (~300 birim) |
| Kafa | Gövdeye göre küçük kafa, sivri uzun çene, iri sivri burun | Gövdesinden büyük, yuvarlak kafa |
| Saç | Kızıl-kahve, dağınık, rüzgârda yelken gibi uçan tutamlar | Fındık kahvesi topuz ve sarı fiyonk |
| Gözler | Asimetrik ve yarı kapalı. Kendini beğenmiş bakar, bir kaşı hep havada | Kocaman yeşil gözler, endişeli kaşlar, pembe yanaklar |
| Kıyafet | Kolları kıvrık beyaz gömlek, kahve askı, gri pantolon | Mercan pembesi çan elbise, krem yaka, bordo ayakkabı |
| Kişilik | Kendine aşırı güvenir, felakette bile "anı bozma" der | Sürekli endişelidir ve kollarına bile güvenmez |
| Ses | Piper TTS, perde %12 kalın | Piper TTS, perde %36 ince |

Kodda paletler `engine/characters.py` içinde `R_PAL` ve `F_PAL` olarak sabit. Her bölümde yeni karakterler gelecek ama render motoru aynı kalacak. Böylece hepsi "aynı stüdyodan" çıkmış gibi görünecek.

## 3. Çekim planı
| # | Süre | Plan / Kamera | Aksiyon ve Diyalog | Ses |
|---|---|---|---|---|
| S1 | 0,0–2,4 | Geniş plan: gün batımında 4 bacalı gemi. Pruvaya hızlı itme (zoom 1→1,6) | **Kanca:** dev gemi, dumanlar | Gemi düdüğü, okyanus, alçak pad |
| S2 | 2,4–7,0 | Pruvada 3/4 ikili plan, yavaş itme, arka plan bulanık (DOF) | Fındık titriyor. **R:** "Kollarını aç, Fındık. Bana güven." Kolunu ufka kaldırıyor. **F** minicik kollarını açıp kameraya bakıyor: "Açtım. Bu kadar açılıyor." Rüzgâr'ın kaşı kalkıyor | Rüzgâr, "squish" efekti |
| S3 | 7,0–11,4 | Yakın ikili plan, hafif dutch açı | Rüzgâr, Fındık'ı korkuluğa kaldırıyor (squash & stretch). **F:** "Uçuyorum!" Bir rüzgâr esiyor ve Rüzgâr'ın perçemi Fındık'ın ağzına yapışıyor. **F** (boğuk sesle): "Saçın ağzımda!" | Özgün pan flüt teması başlıyor, rüzgâr ıslığı |
| S4 | 11,4–14,8 | Fındık'ın gözlerine çok yakın plan (gözbebeklerinde buz yansıması), ardından Rüzgâr'a hızlı pan | **F:** "BUZ DAĞI!" Kamera sarsılıyor. **R** gözleri kapalı, parmağı dudağında: "Şşş... Anı bozma." | Müzik devam ediyor |
| S5 | 14,8–19,0 | Su hizasında alçak açı | Dev gövde girip minicik buz küpüne **"tık"** diye çarpıyor ve duruyor. Sessizlik. Kafalar korkuluktan uzanıyor. **R:** "Gördün mü? Minicik." Gıcırtı geliyor, gövde ikiye çatlıyor, pruva batıyor ve su sıçrıyor | Plak cızırtısıyla müzik kesiliyor, komik sessizlik, gıcırtı, çatırtı, sıçrama |
| S6 | 19,0–24,6 | Alacakaranlıkta yüksek açı. Kapı suda sallanıyor | Fındık kapıda keyifle yatıyor. Rüzgâr'ın ıslak kafası sudan çıkıyor. **R:** "Kapıda yer var mı?" Fındık ona bakıyor ve kollarını iki yana açıp kapının tamamını kaplıyor. **F:** "Yok." Rüzgâr yavaşça batıyor. Arkada buz küpü keyifle süzülüyor. Kil harflerle **CLAY REPLAY** başlığı düşüyor | Baloncuklar, "üzgün trombon" |

**Ters köşe:** Buz dağı aslında bir buz küpü. Yine de gemi batıyor ve kapı tartışması bu kez tek kelimeyle bitiyor.

## 4. Teknik üretim (tamamen ücretsiz)
- **Görüntü:** Kendi yazdığımız 2.5D "kil" render motoru (`engine/clay.py`) kullanıldı. Python, numpy, scipy ve Pillow ile çalışıyor.
  - Her parça bir maskeden başlıyor. Maskeye mesafe dönüşümü uygulanıyor, buradan yükseklik haritası (hacim) çıkıyor, sonra normaller hesaplanıp ışıklandırılıyor.
  - Görünüme şunlar ekleniyor: kil dokusu, **parmak izi** halkaları, kazıma çizgiler (saç ve kumaş kıvrımları), temas gölgeleri, kenar (rim) ışığı ve film greni.
  - **Stop-motion hissi** için:
    - "İkişerli" çekim kullanılıyor: 24 fps'te her poz 2 kare tutuluyor, yani saniyede 12 poz.
    - Her pozda kil dokusu hafifçe kayıyor ("boiling" etkisi).
  - **Dudak senkronu** ses dosyasının genliğinden otomatik hesaplanıyor.
- **Ses:**
  - Diyaloglar Piper TTS (açık kaynak, yerel) ile `tr_TR-dfki` sesinden üretildi. İki karakter, ffmpeg ile perde kaydırılarak ayrıştırıldı.
  - Efektler (düdük, dalga, rüzgâr, tık, çatırtı, sıçrama, trombon) ve **özgün** müzik numpy ile sentezlendi. Hazır kayıt veya stok ses kullanılmadı.
- **Birleştirme:** ffmpeg ile H.264 ve AAC (`build.sh`).

**Dürüst not:** Bu video gerçek bir kil ve kamera ile çekilmedi. Kil görünümü prosedürel olarak simüle edildi. Karakterler 2.5D katmanlardan oluşuyor, yani gerçek 3B modeller değil. Bu yüzden kamera dönüşleri sınırlı. TTS sesi doğal bir oyuncu kadar ifadeli değil. Daha iyi sonuç için diyaloglar kendi sesinizle kaydedilip `audio/raw_*.wav` dosyalarının yerine konabilir. `build.sh` gerisini yeniden üretir.

## 5. Yeniden üretme
```bash
pip install numpy scipy pillow piper-tts   # + ffmpeg
./build.sh
```
