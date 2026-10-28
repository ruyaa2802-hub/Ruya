"""Zaman çizelgesi sabitleri (video + ses ortak kullanır)."""
FPS = 30
DUR = 85.0

# (dosya, konuşan, başlangıç sn)
LINES = [
    ('r1', 'ruya', 5.2),
    ('a1', 'aras', 7.5),
    ('r2', 'ruya', 13.2),
    ('a2', 'aras', 17.0),
    ('l1', 'lalin', 31.2),
    ('m1', 'mert', 46.0),
    ('l2', 'lalin', 48.8),
    ('l3', 'lalin', 79.0),
]
TEXT = {
    'r1': 'Gitti mi?',
    'a1': 'Seni bekliyordum.',
    'r2': 'Bizi öğrenirlerse her şey biter.',
    'a2': 'Seni kaybetmekten başka hiçbir şeyden korkmuyorum.',
    'l1': 'Demek beni değil, onu seçtin…',
    'm1': 'Bunu neden bana gönderiyorsun?',
    'l2': 'Çünkü bu daha başlangıç.',
    'l3': 'Şimdi sıra sende, Rüya.',
}
NAMES = {'ruya': 'RÜYA', 'aras': 'ARAS', 'lalin': 'LALİN', 'mert': 'MERT'}
NAME_COL = {'ruya': (255, 150, 170), 'aras': (190, 205, 235), 'lalin': (255, 190, 215), 'mert': (120, 225, 255)}

# Ses efektleri (ad, sn, parametre)
SFX = [
    ('door', 0.35), ('hum_on', 1.2),
    ('bulb', 1.30), ('bulb', 1.42), ('bulb', 1.55), ('bulb', 1.66), ('bulb', 1.8), ('bulb', 1.9), ('bulb', 2.06), ('bulb', 2.2),
    ('bulb', 2.35), ('bulb', 2.5), ('bulb', 2.62), ('bulb', 2.78), ('bulb', 2.9),
    ('drawer', 3.1), ('thump', 6.55), ('step', 7.9), ('step', 8.35), ('step', 8.8), ('step', 9.25),
    ('whoosh', 9.7), ('clank', 26.45), ('rumble', 26.4),
    ('whoosh', 27.9), ('breath', 33.6), ('phone_unlock', 38.4), ('call_blip', 40.3),
    ('flash', 42.0), ('wake', 42.05), ('ping', 43.3), ('whoosh', 52.8),
    ('ping2', 58.55), ('whoosh', 64.8), ('buzz', 67.3), ('buzz', 67.95), ('ping', 68.3),
    ('sparkle', 73.0), ('plink', 75.2), ('riser', 72.0), ('flicker', 77.0), ('boom', 80.9), ('lights_out', 82.0),
]
