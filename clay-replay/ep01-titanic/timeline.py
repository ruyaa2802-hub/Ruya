"""Bölüm 1 - TİTANİK: zaman çizelgesi (saniye). Ses ve görüntü bu dosyayı paylaşır."""
FPS = 24
DURATION = 24.6

SHOTS = [  # (ad, başlangıç, bitiş)
    ('S1_gemi_genel', 0.0, 2.4),
    ('S2_pruva_ikili', 2.4, 7.0),
    ('S3_ucuyorum', 7.0, 11.4),
    ('S4_buzdagi', 11.4, 14.8),
    ('S5_tik', 14.8, 19.0),
    ('S6_kapi', 19.0, DURATION),
]

# (id, konuşan, başlangıç, altyazı)
LINES = [
    ('R1', 'R', 2.65, 'Kollarını aç, Fındık.\nBana güven.'),
    ('F1', 'F', 5.0, 'Açtım.\nBu kadar açılıyor.'),
    ('F2', 'F', 7.95, 'Uçuyorum!'),
    ('F3', 'F', 9.75, 'Saçın ağzımda!'),
    ('F4', 'F', 11.65, 'BUZ DAĞI!'),
    ('R2', 'R', 12.75, 'Şşş...\nAnı bozma.'),
    ('R3', 'R', 16.55, 'Gördün mü?\nMinicik.'),
    ('R4', 'R', 20.3, 'Kapıda yer var mı?'),
    ('F5', 'F', 22.2, 'Yok.'),
]

EVENTS = dict(horn=0.12, lift=7.0, gust=8.85, music_in=7.25, tik=15.9, creak=17.95, crack=18.2,
              splash=18.95, spread=22.15, trombone=22.85, title=23.15)

NAMES = dict(R='RÜZGÂR', F='FINDIK')
