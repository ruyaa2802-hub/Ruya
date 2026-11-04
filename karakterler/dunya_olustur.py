import random
random.seed(11)
W,H=1080,1920
out=[]
o=out.append
o(f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 {W} {H}" width="{W}" height="{H}">')
o('''<defs>
  <filter id="paper" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="4"/>
    <feColorMatrix type="matrix" values="0 0 0 0 0.35  0 0 0 0 0.25  0 0 0 0 0.22  0 0 0 0.12 0"/>
    <feComposite in2="SourceGraphic" operator="in"/>
    <feBlend in="SourceGraphic" mode="multiply"/>
  </filter>
  <filter id="wobble"><feTurbulence type="turbulence" baseFrequency="0.02" numOctaves="2" seed="7" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="3"/></filter>
  <filter id="blur"><feGaussianBlur stdDeviation="14"/></filter>
  <pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><line x1="0" y1="0" x2="0" y2="7" stroke="#3a2a22" stroke-width="1.1" opacity="0.5"/></pattern>
  <pattern id="dots" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="0.9" fill="#3a2a22" opacity="0.4"/></pattern>
  <pattern id="pores" width="26" height="22" patternUnits="userSpaceOnUse"><circle cx="6" cy="6" r="1.6" fill="#8a4a52" opacity="0.45"/><circle cx="19" cy="15" r="1.2" fill="#8a4a52" opacity="0.4"/></pattern>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#f4d6cf"/><stop offset="0.55" stop-color="#efc0c2"/><stop offset="1" stop-color="#e6a9b3"/>
  </linearGradient>

  <!-- FANUS: içinde uyuyan minik bebek -->
  <symbol id="jar" viewBox="0 0 200 270" overflow="visible">
    <g stroke="#2b1e18" stroke-linejoin="round" stroke-linecap="round">
      <ellipse cx="100" cy="236" rx="80" ry="12" fill="#b97c7c" stroke-width="2"/>
      <path d="M78 214 C70 200 82 186 100 190 C118 186 150 194 150 212 C150 226 124 232 100 230 C84 230 80 224 78 214 Z" fill="#e6dcc2" stroke-width="2.2"/>
      <circle cx="70" cy="210" r="20" fill="#ecccab" stroke-width="2.2"/>
      <path d="M58 210 C62 214 68 214 72 210" fill="none" stroke-width="1.8"/>
      <circle cx="80" cy="218" r="5" fill="#e3a58f" stroke="none" opacity="0.6"/>
      <path d="M20 240 L20 100 C20 30 180 30 180 100 L180 240" fill="#eaf3f1" fill-opacity="0.28" stroke-width="3"/>
      <path d="M40 200 L40 108 C40 70 66 54 94 52" fill="none" stroke="#ffffff" stroke-width="7" opacity="0.65"/>
      <circle cx="100" cy="36" r="9" fill="#d6a52a" stroke-width="2.2"/>
      <path d="M8 238 C8 256 192 256 192 238 L192 262 C192 276 8 276 8 262 Z" fill="#c9a24a" stroke-width="2.6"/>
      <path d="M8 250 C60 262 140 262 192 250" fill="none" stroke-width="1.4"/>
    </g>
  </symbol>

  <!-- EL BİTKİSİ -->
  <symbol id="handplant" viewBox="0 0 200 420" overflow="visible">
    <g stroke="#2b1e18" stroke-linejoin="round" stroke-linecap="round">
      <path d="M100 420 C90 340 116 260 100 180" fill="none" stroke-width="16"/>
      <path d="M100 420 C90 340 116 260 100 180" fill="none" stroke="#9a6f9e" stroke-width="10"/>
      <g fill="none">
        <path d="M70 150 C60 110 54 80 56 50" stroke-width="20"/><path d="M70 150 C60 110 54 80 56 50" stroke="#e3a2b0" stroke-width="14"/>
        <path d="M90 140 C88 96 88 60 94 26" stroke-width="20"/><path d="M90 140 C88 96 88 60 94 26" stroke="#e3a2b0" stroke-width="14"/>
        <path d="M112 140 C116 98 122 66 132 36" stroke-width="20"/><path d="M112 140 C116 98 122 66 132 36" stroke="#e3a2b0" stroke-width="14"/>
        <path d="M130 152 C142 120 154 98 168 80" stroke-width="20"/><path d="M130 152 C142 120 154 98 168 80" stroke="#e3a2b0" stroke-width="14"/>
        <path d="M66 172 C44 160 30 140 24 120" stroke-width="20"/><path d="M66 172 C44 160 30 140 24 120" stroke="#e3a2b0" stroke-width="14"/>
      </g>
      <ellipse cx="100" cy="170" rx="44" ry="36" fill="#e3a2b0" stroke-width="3"/>
      <path d="M74 160 C92 170 108 182 116 196 M86 150 C104 152 122 160 132 172" fill="none" stroke-width="1.8"/>
    </g>
  </symbol>

  <!-- KULAK BİTKİSİ -->
  <symbol id="earplant" viewBox="0 0 200 400" overflow="visible">
    <g stroke="#2b1e18" stroke-linejoin="round" stroke-linecap="round">
      <path d="M100 400 C110 330 88 280 100 220" fill="none" stroke-width="14"/>
      <path d="M100 400 C110 330 88 280 100 220" fill="none" stroke="#9a6f9e" stroke-width="8"/>
      <path d="M100 30 C170 30 182 120 146 170 C122 200 132 228 108 240 C84 252 60 234 66 210 C72 182 46 160 46 112 C46 62 64 30 100 30 Z" fill="#eaa9a4" stroke-width="3"/>
      <path d="M100 66 C142 68 148 124 124 152 C110 168 112 186 102 198" fill="none" stroke-width="3"/>
      <path d="M84 100 C96 92 112 96 116 112" fill="none" stroke-width="2.2"/>
      <path d="M120 40 C160 60 170 120 140 160 L182 160 L182 30 Z" fill="url(#hatch)" stroke="none"/>
    </g>
  </symbol>

  <!-- SALYANGOZ KABUĞU BİTKİSİ -->
  <symbol id="shellplant" viewBox="0 0 200 380" overflow="visible">
    <g stroke="#2b1e18" stroke-linejoin="round" stroke-linecap="round">
      <path d="M100 380 C92 320 110 260 100 200" fill="none" stroke-width="12"/>
      <path d="M100 380 C92 320 110 260 100 200" fill="none" stroke="#9a6f9e" stroke-width="7"/>
      <circle cx="100" cy="130" r="72" fill="#f0dcc4" stroke-width="3"/>
      <path d="M100 130 a10 10 0 0 1 10 10 a22 22 0 0 1 -22 22 a34 34 0 0 1 -34 -34 a46 46 0 0 1 46 -46 a58 58 0 0 1 58 58" fill="none" stroke-width="3"/>
      <path d="M140 80 C176 110 176 160 140 192 L180 192 L180 70 Z" fill="url(#hatch)" stroke="none"/>
    </g>
  </symbol>

  <!-- GÖZ ÇİÇEĞİ (Velun gözleriyle aynı sarı) -->
  <symbol id="eyeflower" viewBox="0 0 200 400" overflow="visible">
    <g stroke="#2b1e18" stroke-linejoin="round" stroke-linecap="round">
      <path d="M100 400 C108 330 92 270 100 190" fill="none" stroke-width="12"/>
      <path d="M100 400 C108 330 92 270 100 190" fill="none" stroke="#9a6f9e" stroke-width="7"/>
      <g fill="#c58aa8" stroke-width="2.4">
        <ellipse cx="100" cy="70" rx="22" ry="40"/><ellipse cx="100" cy="190" rx="22" ry="40"/>
        <ellipse cx="40" cy="130" rx="40" ry="22"/><ellipse cx="160" cy="130" rx="40" ry="22"/>
        <ellipse cx="58" cy="88" rx="22" ry="38" transform="rotate(-45 58 88)"/><ellipse cx="142" cy="88" rx="22" ry="38" transform="rotate(45 142 88)"/>
        <ellipse cx="58" cy="172" rx="22" ry="38" transform="rotate(45 58 172)"/><ellipse cx="142" cy="172" rx="22" ry="38" transform="rotate(-45 142 172)"/>
      </g>
      <circle cx="100" cy="130" r="44" fill="#f2c230" stroke-width="3"/>
      <circle cx="108" cy="134" r="14" fill="#120c08" stroke="none"/>
      <circle cx="103" cy="128" r="4" fill="#fff8e0" stroke="none"/>
      <path d="M56 112 C80 96 120 96 144 112 L144 100 C120 80 80 80 56 100 Z" fill="#9a6f9e" stroke-width="2.4"/>
    </g>
  </symbol>

  <!-- KÜRE SAPLI ÇİMEN -->
  <symbol id="bulb" viewBox="0 0 60 300" overflow="visible">
    <g stroke="#2b1e18" stroke-linecap="round">
      <path d="M30 300 C24 220 38 140 30 40" fill="none" stroke-width="5"/>
      <circle cx="30" cy="36" r="16" fill="#f3e2b8" stroke-width="2.4"/>
    </g>
  </symbol>
</defs>''')

o('<rect width="1080" height="1920" fill="url(#sky)"/>')
o('<rect width="1080" height="1920" fill="url(#dots)" opacity="0.2"/>')
# aylar
o('''<g stroke="#3a2a22" stroke-width="2.5">
  <circle cx="250" cy="330" r="118" fill="#f1e3b4"/>
  <path d="M250 212 C320 250 330 410 250 448 C330 448 368 380 368 330 C368 270 320 212 250 212 Z" fill="url(#hatch)" stroke="none"/>
  <circle cx="420" cy="190" r="42" fill="#f1e3b4"/>
  <circle cx="210" cy="300" r="14" fill="none" stroke-width="1.5"/><circle cx="270" cy="380" r="9" fill="none" stroke-width="1.5"/>
</g>''')
# uzak nefes alan tepeler
o('<g filter="url(#wobble)" stroke="#2b1e18" stroke-linejoin="round" stroke-linecap="round">')
o('<path d="M0 1060 C140 900 300 930 420 1010 C560 880 760 900 860 990 C960 930 1040 940 1080 960 L1080 1920 L0 1920 Z" fill="#d89dab" stroke-width="3"/>')
o('<path d="M120 1000 C180 980 240 990 300 1010 M560 950 C620 930 700 935 760 960" fill="none" stroke-width="1.8"/>')

# uzaktaki Velun silüeti, fanusları suluyor
o('''<g opacity="0.82" stroke-width="3">
  <path d="M752 922 C760 980 776 1030 778 1062 C770 1090 764 1120 766 1300 L834 1300 C836 1120 830 1090 822 1062 C824 1030 840 980 848 922 Z" fill="#6f8f86"/>
  <path d="M776 1056 C792 1064 808 1064 824 1056 L826 1070 C808 1078 792 1078 774 1070 Z" fill="#d6a52a" stroke-width="2"/>
  <path d="M770 930 C730 960 690 990 660 1030 C652 1042 664 1050 672 1040 C700 1004 740 975 784 950 Z" fill="#9a7ab3"/>
  <path d="M648 1020 C640 1000 676 990 690 1006 L700 1040 C690 1056 660 1056 652 1044 Z" fill="#c9a24a"/>
  <path d="M652 1030 C624 1036 606 1050 594 1066" fill="none" stroke-width="5"/>
  <path d="M786 920 C786 900 790 880 792 860 L808 860 C810 880 814 900 814 920 Z" fill="#9a7ab3"/>
  <ellipse cx="800" cy="770" rx="78" ry="98" fill="#9a7ab3"/>
  <ellipse cx="772" cy="776" rx="26" ry="30" fill="#f2c230"/><ellipse cx="828" cy="776" rx="26" ry="30" fill="#f2c230"/>
  <circle cx="766" cy="790" r="5" fill="#120c08" stroke="none"/><circle cx="822" cy="790" r="5" fill="#120c08" stroke="none"/>
  <path d="M744 760 C760 744 790 744 800 760 M800 760 C810 744 840 744 856 760" fill="#8a69a3" stroke-width="2.4"/>
  <path d="M788 676 L806 560 L816 676 Z" fill="#efe4cc"/>
  <path d="M790 660 L814 652 M793 636 L812 630 M796 612 L810 606" fill="none" stroke="#d6a52a" stroke-width="4"/>
  <circle cx="806" cy="556" r="6" fill="#f2c230"/>
  <path d="M760 900 C780 880 820 880 840 900 C820 918 780 918 760 900 Z" fill="#efe7d6" stroke-width="2.4"/>
</g>''')
# sulama damlaları
for i in range(7):
    x=594-i*4+random.uniform(-4,4); y=1080+i*18
    o(f'<ellipse cx="{x:.1f}" cy="{y:.1f}" rx="3" ry="5" fill="#cfe6ea" stroke-width="1.2"/>')

# sis bandı
o('</g>')
o('<path d="M0 1060 C200 1020 420 1090 640 1050 C820 1020 960 1070 1080 1040 L1080 1180 L0 1180 Z" fill="#fbe8e6" opacity="0.55" filter="url(#blur)"/>')
o('<g filter="url(#wobble)" stroke="#2b1e18" stroke-linejoin="round" stroke-linecap="round">')

# orta tepeler (deri gibi)
o('<path d="M0 1190 C200 1090 380 1130 540 1180 C700 1110 900 1120 1080 1170 L1080 1920 L0 1920 Z" fill="#e2aab0" stroke-width="3"/>')
o('<path d="M0 1190 C200 1090 380 1130 540 1180 C700 1110 900 1120 1080 1170 L1080 1920 L0 1920 Z" fill="url(#pores)" stroke="none"/>')
o('<path d="M60 1180 C140 1150 240 1150 320 1170 M640 1160 C720 1140 820 1142 900 1160 M200 1240 C320 1220 440 1226 520 1250" fill="none" stroke-width="1.8"/>')

# uzak fanus sırası
for x,y,s in [(90,1150,0.3),(210,1140,0.3),(330,1150,0.32),(460,1172,0.34),(560,1150,0.36),(880,1150,0.3),(980,1166,0.32)]:
    w=200*s; h=270*s
    o(f'<use xlink:href="#jar" href="#jar" x="{x-w/2:.1f}" y="{y-h:.1f}" width="{w:.1f}" height="{h:.1f}"/>')
# orta plan küre çimenler
for x in [150,400,720,1010]:
    o(f'<use href="#bulb" xlink:href="#bulb" x="{x}" y="1060" width="30" height="150"/>')
o('<use href="#shellplant" xlink:href="#shellplant" x="740" y="1130" width="110" height="210"/>')

# ön zemin
o('<path d="M0 1460 C250 1380 500 1420 700 1470 C850 1430 980 1420 1080 1450 L1080 1920 L0 1920 Z" fill="#e9b5ae" stroke-width="3"/>')
o('<path d="M0 1460 C250 1380 500 1420 700 1470 C850 1430 980 1420 1080 1450 L1080 1920 L0 1920 Z" fill="url(#pores)" stroke="none"/>')
o('<path d="M80 1500 C200 1470 330 1474 420 1496 M560 1520 C680 1496 800 1500 900 1520 M220 1600 C380 1570 560 1580 700 1610" fill="none" stroke-width="2"/>')

# ön plan fanusları
for x,y,s in [(330,1500,0.85),(700,1560,1.0)]:
    w=200*s; h=270*s
    o(f'<use href="#jar" xlink:href="#jar" x="{x-w/2:.1f}" y="{y-h:.1f}" width="{w:.1f}" height="{h:.1f}"/>')

# bitkiler
o('<use href="#handplant" xlink:href="#handplant" x="-30" y="1060" width="250" height="525"/>')
o('<use href="#earplant" xlink:href="#earplant" x="870" y="1160" width="220" height="440"/>')
o('<use href="#eyeflower" xlink:href="#eyeflower" x="470" y="1380" width="150" height="300"/>')
for x in [420,836]:
    o(f'<use href="#bulb" xlink:href="#bulb" x="{x}" y="1380" width="46" height="230"/>')

# en ön kabarık deri tümseği
o('<path d="M0 1740 C200 1660 460 1690 640 1740 C800 1700 960 1690 1080 1720 L1080 1920 L0 1920 Z" fill="#d6959e" stroke-width="3"/>')
o('<path d="M0 1740 C200 1660 460 1690 640 1740 C800 1700 960 1690 1080 1720 L1080 1920 L0 1920 Z" fill="url(#hatch)" stroke="none" opacity="0.6"/>')
o('<path d="M120 1760 C240 1730 380 1736 480 1760 M700 1770 C820 1746 940 1748 1040 1766" fill="none" stroke-width="2"/>')
o('</g>')

# havada süzülen altın toz
for _ in range(70):
    x=random.uniform(0,W); y=random.uniform(500,1750); r=random.uniform(1.2,3.6)
    o(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="#e2b33a" opacity="{random.uniform(0.5,0.95):.2f}"/>')

o('<rect width="1080" height="1920" fill="#ece2cb" opacity="0.001" filter="url(#paper)"/>')
o('</svg>')
open(__import__('os').path.join(__import__('os').path.dirname(__file__),'dunya.svg'),'w').write('\n'.join(out))
