# DJ HAMAM — Karakter Kitabı (ana karakter)

**Tek kaynak:** `dj-hamam.mjs` → `djHamam(id, {accent, w}, pose)`. Tüm bölümler bu dosyayı kullanır; karakter her sahnede **aynı** görünür, yeniden tasarlanmaz.
Hazır çıktılar: `dj-hamam.svg` (dinlenme), `poses/*.svg` (6 poz), `dj-hamam-sheet.png` (karakter sayfası). Yeniden üretmek için: `node build.mjs`.

## Kimlik
- **Tür:** antropomorfik hamam böceği, iki ayak üstünde yürür. Gece vardiyasının DJ'i; mutfak onun kulübü.
- **Kişilik:** kendinden emin, ukala, rahat, lafı ağzında geveler; sıkışınca hemen panikler ama yine de havalı kalmaya çalışır. Hiç pes etmez, müziği asla kesmez.
- **Ses:** erkek, hafif kalın, rahat ve ukala (tr-TR Ahmet, perde −10/−14 Hz; panikte +6/+10 Hz ve hızlı).
- **Tik / imza hareketler:** gözlüğü iki parmakla yukarı iter; kulaklığı düzeltir; antenleri ritme göre sallar; şaşırınca gözlük burnundan kayar ve gerçek gözleri görünür.

## Tasarım kuralları (değişmez)
- Parlak koyu kahverengi kabuk, karında açık kehribar plakalar, kanat kabukları (elytra) damarlı ve parlak.
- **Büyük siyah güneş gözlüğü** (altın çerçeve, mor-siyah cam, neon ekolayzer yansıması).
- **Büyük DJ kulaklığı** (koyu mor, neon pembe halka, camgöbeği LED).
- **Altın zincir** + "DJ" madalyonu (pembe taş). Sağ tarafta **altın diş** (gülerken görünür).
- Bilekte altın bileklikler; bacak/kollarda böcek dikenleri; neon sneaker (pembe, beyaz taban, camgöbeği şerit).
- Neon kenar ışığı: sol pembe, sağ camgöbeği.
- Oranlar: viewBox 400×620, zemin y=604; kafa geniş, gövde armut, bacaklar ince ve uzun.

## Palet
| Rol | Renk |
|---|---|
| Kabuk (açık/orta/koyu) | `#c07a42` / `#6a3418` / `#2a1008` |
| Karın | `#e0a35a` |
| Neon pembe / camgöbeği / mor | `#ff3fd0` / `#34e0ff` / `#8d5bff` |
| Altın | `#ffd23f` (koyu `#8a5a00`) |
| Kontur | `#1a0b12` |

## İskelet (rig) — pivotlar ve kimlikler
Kimlikler `{id}-` önekiyle: `head, antL, antR, armL, foreL, armR, foreR, legL, shinL, legR, shinR, torso, wings, chain, hp, glasses, eyeL/R, pupL/R, lidL/R, browL/R, mouth, smile`.
Pivotlar: omuz L(136,282) R(264,282) · dirsek L(94,346) R(306,346) · kalça L(165,396) R(235,396) · diz L(152,492) R(248,492) · kafa (200,240) · anten L(176,100) R(224,100) · göz L(160,152) R(240,152) · ağız (200,208) · zincir (200,262) · kulaklık (200,150).
Kol/bacak açıları: pozitif = dışa/yukarı (sağ taraf aynalanır). Gözlük `glassY` ile aşağı kayar (≈34 = tam şok).

## Ağız / ifade
Ağız `scaleY = .06 + .94·aç`, `scaleX = 1 − .14·aç`; kapalıyken ukala gülüş çizgisi görünür. Kaş açısı + (`browY`) ile öfke/şaşkınlık. Dudak senkronu konuşma sesinin 30 FPS enerji zarfından üretilir (`build_audio.py`).

## Yan karakterler
Aynı gövde, `full:false` (gözlük/kulaklık/zincir yok) ve farklı aksesuar (parti şapkası, kırmızı gözlük, glow stick) ile arka plan böcekleri.
