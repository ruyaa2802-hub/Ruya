# İNSANLAR GİDİNCE — 3D animasyon Shorts üretim hattı

İnsanlar evden çıkınca eşyalar canlanır ve sahiplerinden dert yanar. Bu depo, seriyi
**kod ile** üreten tekrar kullanılabilir hattı içerir: Blender (Cycles) ile stilize 3D
karakterler, Türkçe dudak senkronu, kamera kurgusu, ses miksajı ve 9:16 MP4 çıkışı.

| Bölüm | Süre | Çıktı |
|---|---|---|
| B01 — Yastığın İsyanı | ~38 sn | `renders/b01_v4/b01_v4_final.mp4` |
| B02 — Soğudum (Kupa) | ~41 sn | `renders/b02_v1/b02_v1_final.mp4` |

## Kurulum

```bash
python3.13 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m ig.sfx assets/sfx        # telifsiz ses efektlerini üretir (tek sefer)
```

GPU gerekmez; Blender, PyPI'daki resmî `bpy` paketiyle Python modülü olarak çalışır.

## Bir bölümü üretmek

```bash
# 1) replikleri Shorts temposuna getir (uzun duraklamaları kısalt, 1.12x hız, kelime zamanları)
.venv/bin/python tools/prep_lines.py episodes/b01_yastigin_isyani --tempo 1.12

# 2) render etmeden kontrol: replik ve çekim çizelgesi
.venv/bin/python tools/build_episode.py episodes/b01_yastigin_isyani --dry

# 3) birkaç kareye bak (hızlı)
.venv/bin/python tools/build_episode.py episodes/b01_yastigin_isyani --preset draft --frames 60,200,500

# 4) 5 saniyelik teknik test
.venv/bin/python tools/build_episode.py episodes/b01_yastigin_isyani --script test5s --preset test

# 5) tam bölüm (720x1280 render, 1080x1920'ye lanczos ile ölçeklenir)
.venv/bin/python tools/build_episode.py episodes/b01_yastigin_isyani --preset final --blend
```

Çıktılar `renders/<bölüm>_<script>/` altında: kareler, `mix.wav`, `.mp4` (yazısız),
`_final.mp4` (gömülü Türkçe altyazı + seri jeneriği), `.ass` / `.srt` altyazı dosyaları ve
istenirse elle düzenlenebilir `episode.blend`.

**Altyazı (`ig/subtitles.py`):** replik metni (`LINES`) kelime zamanlarına hizalanır, en
fazla 3 kelimelik parçalar halinde gösterilir; söylenen kelime konuşan karakterin rengine
döner (Yastık mavi, Battaniye sarı). Yazı tipi `assets/fonts/Nunito-Black.ttf` (SIL OFL,
Nunito değişken fontundan `fontTools` ile üretildi; tam Türkçe karakter desteği).

**Render süresi (4 çekirdekli CPU, GPU yok):** ~14 sn/kare → 36 sn'lik bölüm ≈ 3,5 saat.
GPU'lu bir makinede aynı betik `--preset hq` (1080x1920, 64 örnek) ile kare başına birkaç
saniyede çalışır.

## Ses (Türkçe diyalog)

Sesler ElevenLabs `eleven_v4` ile üretildi (duygu etiketleri: `[sarcastic]`, `[shouting]`…).

| Karakter | Ses | voice_id |
|---|---|---|
| Yastık | Orhan — Expressive Istanbul Actor | `y6X1mFgtBqHFtQwrOezf` |
| Battaniye | Gözde | `rtnDjO8siSxeTEeTVczO` |

İş akışı (API istek sınırına takılmamak için karakter başına tek istek):

1. Karakterin tüm repliklerini tek metinde, aralarına `[long pause]` koyarak üret.
2. MP3'ü `episodes/<bölüm>/audio/test/` altına koy ve böl:
   `.venv/bin/python tools/split_lines.py take.mp3 episodes/<bölüm>/audio L03_yastik L05_yastik …`
3. `prep_lines.py` çalıştır. Kelime zamanları `faster-whisper` ile çıkarılır ve önbelleğe yazılır.

Dudak senkronu (`ig/lipsync.py`): Whisper kelime zamanları → RMS zarfıyla sessizlik
kırpma → Türkçe harf→visem eşlemesi (Türkçe yazım fonetiğe çok yakın) → ses şiddetine
göre ağız açıklığı. Fısıltı küçük, bağırma geniş ağız; nefes/iç çekmede dudaklar aralanır.

## Mimari

```
ig/
  util.py          sahne/mesh yardımcıları, easing
  materials.py     prosedürel malzemeler: kumaş (ince çizgi, ekose, triplanar), ahşap, seramik…
  face.py          ortak yüz sistemi: göz küresi+iris, göz kapakları, kaşlar, visemli ağız
  characters/
    base.py        iskelet, ağırlık, kanal API'si (her karakter aynı kanal adlarıyla sürülür)
    yastik.py      YASTIK
    battaniye.py   BATTANİYE
  sets/bedroom.py  yatak odası seti + ışık
  expressions.py   ifade ön ayarları (tired, sarcastic, shout, touched…)
  anim.py          zaman çizelgesi: set/expr/look/hop/move/shake/say/sfx/shot/prop → keyframe
  lipsync.py       Türkçe dudak senkronu
  audio.py         miksaj (-14 LUFS), tempo, MP4, SRT, altyazı+jenerik son geçişi
  subtitles.py     Shorts altyazısı (ASS, karaoke renk, pop animasyonu)
  sfx.py           sentez ses efektleri (kapı, anahtar, hışırtı, puf, vuuş, burun çekme,
                   seramik tıkırtı, mikrodalga "ding", kafeinli yaprak titremesi)
  render.py        Cycles ön ayarları, karaktere göre kamera
tools/             build_episode, prep_lines, split_lines, still (look-dev)
episodes/<bölüm>/  episode.py (senaryo+oyunculuk+kamera), test5s.py, audio/
```

### Karakter kanal API'si

Tüm karakterler aynı kanallarla sürülür; bölüm betikleri sadece bunları kullanır:
`pos_x/y/z, turn, lean_f, lean_s, squash, nod, tilt, twist, arm_{L,R}_{raise,fold,curl},
gaze_x/y, blink, lid_u/l, squint, brow_up/ang (+_L/_R), m_open/wide/round/press/smile/frown/sneer`.

### Yeni eşya (karakter) eklemek

1. `ig/characters/<ad>.py` oluştur: gövde mesh'i, `build_armature` ile kemikler, `skin` ile
   ağırlıklar, yüz bölgesinde baş kemiğine 1.0 ağırlık, `anchor_on_surface(...)` ve
   `Face(...)` (`FaceSpec` ile göz rengi, boyut, kirpik, dinlenme kapak seviyesi…).
2. `rot_map` ile kanal→kemik eşlemesi tanımla (bkz. `yastik.py`, `battaniye.py`).
3. `ig/stage.py` içindeki `CAST` ve `HOME` sözlüğüne ekle.
4. `tools/still.py` ile ifade/poz sayfası render et ve kontrol et.

Yüz sistemi yüzeye ışın izlemeyle oturduğu için kupa, ayakkabı, saksı gibi her gövde
şekline uyar; böylece tüm seride aynı tasarım dili korunur. Küçük eşyalarda yüzü yastık
ölçeğinde tasarla ve yüz çapasını küçült (`kupa.py`: `FACE_SCALE`); vizem ve kaş
hareketleri orantılı kalır.

Setteki bir objeyi (ör. saksının yaprakları) oynatmak için `tl.prop(obj, fn, t0, t1)`:
`fn(t)` dinlenme pozuna eklenecek `{"rotation_euler": (...)}` döndürür.

### Yeni bölüm

`episodes/bNN_<ad>/episode.py` oluştur (`CAST`, `LINES`, `PACING`, `TITLE`, `build(tl, ep)`).
Oyunculuk vuruşlarını saniyeye değil kelimeye bağla: `line.find("ayağ")`. Böylece ses
yeniden üretilse bile kurgu kendini ayarlar.

## Sonraki bölüm fikirleri

Saksı bitkisi (B02'de kafeinli olduğu ortaya çıktı), ayakkabılar, telefon, eski oyuncak,
çamaşır makinesindeki kayıp çoraplar.
