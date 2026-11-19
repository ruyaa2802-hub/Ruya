"""'Güçlü Görünmek' - zaman çizelgesi (saniye)."""
FPS = 24
DURATION = 40.0

SCENES = [
    ('S1_yuk', 0.0, 6.4),
    ('S2_maske', 6.4, 13.2),
    ('S3_gorunmez_agirlik', 13.2, 21.0),
    ('S4_cokus', 21.0, 29.6),
    ('S5_mesaj', 29.6, DURATION),
]

VO = [('V1', 0.55), ('V2', 6.95), ('V3', 13.5), ('V4', 21.25), ('V5', 29.95)]

EV = dict(
    friends_in=6.6, straighten=7.7, lift=8.6, handoff=10.4, friends_gone=12.2, rebend=12.35,
    obj1=14.6, obj2=15.4, obj3=16.2, obj4=17.0,
    stop=21.0, try_step=22.0, release=23.1, knees=24.0, slip=25.2, crash=25.95, sat=26.8,
    tear=27.35, tear_land=28.05, sprout=28.25,
    text=38.15,
)

FINAL_TEXT = 'Sen en son ne zaman gerçekten yorulduğunu söyledin?'
