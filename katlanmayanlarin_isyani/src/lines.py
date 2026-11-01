"""Replik metinleri ve karakter ses ayarları (v2: doğal, enerjik, dedikodulu).

Ses: edge-tts tr-TR Ahmet / Emel nöral sesleri. Karakter farkı aşırı perde kaydırmayla değil;
konuşma hızı, küçük perde farkı, formantı koruyan rubberband kaydırması ve EQ (ses rengi) ile verilir.
"""
# karakter: (ses, hız, edge perde, rubberband yarım ton, ffmpeg ses rengi zinciri)
VOICE = {
    'gomlek':   ('tr-TR-AhmetNeural', '+14%', '+0Hz', 0.0, 'highpass=f=110,equalizer=f=2800:t=q:w=1.2:g=3,acompressor=threshold=0.1:ratio=3:makeup=1.5'),
    'tisort':   ('tr-TR-AhmetNeural', '+8%', '+4Hz', 1.6, 'highpass=f=140,equalizer=f=5000:t=q:w=1:g=3'),
    'havlu':    ('tr-TR-AhmetNeural', '-6%', '-6Hz', -2.6, 'highpass=f=70,lowpass=f=6500,equalizer=f=250:t=q:w=1:g=2'),
    'pantolon': ('tr-TR-AhmetNeural', '+2%', '-2Hz', -1.0, 'highpass=f=190,equalizer=f=1300:t=q:w=0.8:g=5'),
    'corapA':   ('tr-TR-EmelNeural', '+16%', '+6Hz', 1.0, 'highpass=f=150,equalizer=f=3500:t=q:w=1:g=2'),
    'corapB':   ('tr-TR-EmelNeural', '+8%', '-2Hz', -1.6, 'highpass=f=130,equalizer=f=2400:t=q:w=1:g=3'),
    'sepet':    ('tr-TR-EmelNeural', '+6%', '-6Hz', -2.2, 'highpass=f=90,equalizer=f=300:t=q:w=1:g=2,acompressor=threshold=0.1:ratio=3:makeup=1.5'),
}
LINES = {
    'g1': ('gomlek', 'Gitti mi? Gitti! Ya üç gündür buradayım! Ben bir gömleğim, halı değilim!'),
    't1': ('tisort', 'Bağırma abi ya... En azından sen koltuktasın. Ben yerdeyim, üstüme çorap bile atmışlar!'),
    'h1': ('havlu', 'Gördünüz mü ama? Sevgilisi geldi diye bizi apar topar koltuğa yığdı.'),
    'cA1': ('corapA', 'Ay, sevgilisinden de utanmıyor! Ev ne halde, ne halde!'),
    'cB1': ('corapB', 'Annesini mi çağıralım, ne yapalım yahu?'),
    'p1': ('pantolon', 'Annesi görse var ya... Kulağından tutar, hepimizi tek tek katlatır!'),
    'cA2': ('corapA', 'Dur bir dakika... Benim eşim nerede?'),
    'cB2': ('corapB', 'Kesin yine çamaşır makinesinde başka biriyle dönüyordur!'),
    'cA3': ('corapA', 'Ne demek o?!'),
    'cB3': ('corapB', 'Bildiğin gibi, canım!'),
    'p2': ('pantolon', 'Ben katlanmam ama! Ben askıya asılırım!'),
    'h2': ('havlu', 'Sen önce haddini bil! Ben üç gündür yerde bekliyorum!'),
    'g2': ('gomlek', 'Asıl benim kırışıklarım!'),
    't2': ('tisort', 'Kimse seni dinlemiyor!'),
    'p3': ('pantolon', 'Bana ütüsüz yaklaşmayın!'),
    'cA4': ('corapA', 'Eşim nerede, eşim?!'),
    'h3': ('havlu', 'Hepiniz nem kokuyorsunuz!'),
    's1': ('sepet', 'Yeter! Hepiniz susun!'),
    's2': ('sepet', 'İnsanlar bizi yıkadı, kuruttu... Şimdi de katlamaya üşeniyorlar. Biz burada tekstil enkazına döndük!'),
    't3': ('tisort', 'Bir de sevgilisine, evim hep böyle tertemiz, diyor...'),
    'h4': ('havlu', 'Susun! Geliyor!'),
    'a_g': ('gomlek', 'Sonunda! Bizi katlayacak!'),
    'a_t': ('tisort', 'Sonunda! Bizi katlayacak!'),
    'a_cA': ('corapA', 'Sonunda! Bizi katlayacak!'),
    'a_cB': ('corapB', 'Sonunda! Bizi katlayacak!'),
    'a_h': ('havlu', 'Sonunda! Bizi katlayacak!'),
    'a_p': ('pantolon', 'Sonunda! Bizi katlayacak!'),
    'a_s': ('sepet', 'Sonunda! Bizi katlayacak!'),
    'g3': ('gomlek', 'Şaka mı bu lan?'),
}
