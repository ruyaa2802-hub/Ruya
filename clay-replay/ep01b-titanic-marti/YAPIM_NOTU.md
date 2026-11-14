# CLAY REPLAY — Bölüm 1B: TİTANİK, "Saçında Yeni Bir Yolcu Var"
Kullanıcı senaryosu · 9:16 · 25,8 sn · Türkçe

**Oyuncu kadrosu:** JACK rolünü Rüzgâr kuklası, ROSE rolünü Fındık kuklası oynuyor. Yeni karakter olarak kil **MARTI** eklendi (`engine/characters.py`, `marti()`).
Martının görünüşü: beyaz gövde, gri kanatlar ve siyah kanat uçları, sarı gaga üzerinde kırmızı benek, sarı öfkeli gözler, turuncu perdeli ayaklar.

| Sahne | Süre | Kamera | Aksiyon |
|---|---|---|---|
| 1 | 0–5,1 | Pruvada ikili plan, yavaş itme | Jack, Rose'u elinden tutup pruvaya getiriyor. ROSE: "Jack! Çok güzel!" JACK: "Gözlerini kapat, Rose. Bana güven." Rose gözlerini kapatıyor |
| 2 | 5,1–12 | Yakın ikili plan, itme ve hafif dutch açı | Rose korkuluğa kaldırılıyor. JACK: "Şimdi aç kollarını!" Rose'un ellerinden tutup kollarını açtırıyor. ROSE: "Uçuyorum, Jack! Uçuyorum!" Müzik giriyor |
| 3 | 12–18 | Karşıdan yakın plan, kamera yay çiziyor, sığ alan derinliği | Rüzgâr esiyor, serpinti uçuşuyor. ROSE: "Jack, dünyanın en güzel hissi bu!" JACK: "Biliyorum, Rose!" |
| 4 | 18–25,8 | Kafalara yakın plan | Jack romantik bakarken bir martı süzülüp saçına konuyor, tüyler uçuşuyor ve müzik plak cızırtısıyla kesiliyor. ROSE: "Jack… Kıpırdama." JACK: "Neden?" ROSE: "Saçında yeni bir yolcu var." Final: martı Jack'in saçına **yumurtluyor** ve kameraya bağırıyor. Ardından CLAY REPLAY başlığı geliyor |

**Ses:**
- Diyaloglar Piper TTS ile üretildi. Doğru telaffuz için metne "Cek" ve "Roz" yazıldı, altyazıda "Jack" ve "Rose" görünüyor.
- Martı çığlığı, kanat çırpma ve "pop" efektleri numpy ile sentezlendi.

**Üretim:** `./build.sh` çalıştırın. Bölüm 1 dekoru (`ep01-titanic/episode.py`) yeniden kullanılıyor.
