# Aksolotl – kendini yenileyen minik kahraman

Dikey (1080x1920), 47 sn, HyperFrames ile üretilmiş animasyon. Ana karakter her sahnede aynı tek SVG rig'idir
(`characters/aksolotl.svg`), sahneler arasında yalnızca konum/ölçek/ifade değişir.

## Yapı
- `tools/axo.py` – aksolotl karakter rig'i (SVG)
- `tools/world.py` – su altı dünyası, mercek (bacak yenilenmesi), hücre dünyası
- `tools/main.js`, `tools/page.tpl.html`, `tools/build.py` – zaman çizelgesi ve sayfa; `python3 tools/build.py` → `index.html`
- `tools/audio.py` – müzik + ses efektleri (numpy ile sentez) → `audio/music.wav`, `audio/sfx.wav`
- `tools/mix.sh` – sesi videoyla birleştirir; `voice/scene1..5.mp3` varsa anlatımı ekler ve müziği kısar

## Üretim
```bash
python3 tools/build.py
npx hyperframes render --output renders/aksolotl-silent.mp4
python3 tools/audio.py
tools/mix.sh renders/aksolotl-silent.mp4 renders/aksolotl.mp4
```

## Seslendirme
Anlatım metni `tools/build.py` içindeki altyazı listesindedir. Seslendirme dosyaları `voice/scene1.mp3` ...
`voice/scene5.mp3` adıyla konursa (başlangıçlar: 0.3, 7.2, 17.4, 27.2, 36.3 sn) `tools/mix.sh` otomatik ekler.
