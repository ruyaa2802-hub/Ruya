"""Bölüm 1B - TİTANİK: "Saçında yeni bir yolcu var" - zaman çizelgesi (saniye)."""
FPS = 24
DURATION = 25.8

SHOTS = [
    ('S1_pruvaya_gelis', 0.0, 5.1),
    ('S2_kollarini_ac', 5.1, 12.0),
    ('S3_karsidan', 12.0, 18.0),
    ('S4_marti', 18.0, DURATION),
]

# (id, konuşan, başlangıç, altyazı)  R = Jack (Rüzgâr kuklası), F = Rose (Fındık kuklası)
LINES = [
    ('RO1', 'F', 1.25, 'Jack! Çok güzel!'),
    ('JA1', 'R', 2.6, 'Gözlerini kapat, Rose.\nBana güven.'),
    ('JA2', 'R', 6.0, 'Şimdi aç kollarını!'),
    ('RO2', 'F', 8.2, 'Uçuyorum, Jack!\nUçuyorum!'),
    ('RO3', 'F', 12.55, 'Jack, dünyanın\nen güzel hissi bu!'),
    ('JA3', 'R', 15.3, 'Biliyorum, Rose!'),
    ('RO4', 'F', 20.05, 'Jack…\nKıpırdama.'),
    ('JA4', 'R', 21.55, 'Neden?'),
    ('RO5', 'F', 22.45, 'Saçında yeni\nbir yolcu var.'),
]

EVENTS = dict(walk_end=1.1, lift=5.3, music_in=7.55, gust=12.2, gull_in=18.15, land=19.2, squawk1=19.3,
              egg=23.9, squawk2=24.45, title=24.75)

NAMES = dict(R='JACK', F='ROSE')
