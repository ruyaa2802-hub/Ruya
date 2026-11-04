import random
SKIP=[(0,90,1170,1280),(380,480,1340,1430),(520,760,1170,1220),(860,940,1170,1220),(60,180,1300,1420),
      (100,300,1540,1640),(530,650,1600,1700),(400,640,1760,1925)]
def ok(x,w,y):
    cx=x+w/2
    return not any(a<cx<b and c<y<d for a,b,c,d in SKIP)
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
  <filter id="smoke" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4"/></filter>
  <pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><line x1="0" y1="0" x2="0" y2="7" stroke="#3a2a22" stroke-width="1.1" opacity="0.5"/></pattern>
  <pattern id="dots" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="0.9" fill="#3a2a22" opacity="0.4"/></pattern>
  <pattern id="pores" width="26" height="22" patternUnits="userSpaceOnUse"><circle cx="6" cy="6" r="1.6" fill="#2f6b62" opacity="0.4"/><circle cx="19" cy="15" r="1.2" fill="#2f6b62" opacity="0.35"/></pattern>
  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bfe3d8"/><stop offset="1" stop-color="#d9dca0"/></linearGradient>
  <linearGradient id="g2" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="#9fd1c4"/><stop offset="1" stop-color="#e3cf7e"/></linearGradient>
  <linearGradient id="g3" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#86c2b4"/><stop offset="1" stop-color="#e6c66c"/></linearGradient>
  <linearGradient id="g4" x1="0" y1="0" x2="0.5" y2="1"><stop offset="0" stop-color="#5f9f93"/><stop offset="1" stop-color="#caa64e"/></linearGradient>
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

  <!-- ===== YENİ SEMBOLLER ===== -->
  <!-- kesme-kâğıt bulut, sarmal kıvrımlı -->
  <symbol id="cloud" viewBox="0 0 300 120" overflow="visible">
    <g stroke="#2b1e18" stroke-linejoin="round" stroke-linecap="round">
      <path d="M20 100 C0 100 0 70 30 66 C30 40 70 30 90 50 C100 20 150 14 170 42 C190 20 240 26 244 60 C276 58 290 96 260 100 Z" fill="#fbebe7" stroke-width="2.6"/>
      <path d="M30 96 C100 104 200 104 260 96 L254 84 C190 92 100 92 36 84 Z" fill="url(#hatch)" stroke="none"/>
      <path d="M90 50 c12 -6 22 6 12 14 c-7 5 -14 -2 -9 -7" fill="none" stroke-width="2"/>
      <path d="M170 42 c12 -6 22 6 12 14 c-7 5 -14 -2 -9 -7" fill="none" stroke-width="2"/>
      <path d="M244 60 c10 -2 16 8 8 14 c-6 4 -12 -2 -8 -6" fill="none" stroke-width="2"/>
    </g>
  </symbol>
  <!-- gökyüzü denizanası -->
  <symbol id="jelly" viewBox="0 0 120 260" overflow="visible">
    <g stroke="#2b1e18" stroke-linejoin="round" stroke-linecap="round">
      <g fill="none" stroke="#7b5895" stroke-width="2.4">
        <path d="M24 74 C14 110 34 140 20 180 C10 210 26 230 18 256"/>
        <path d="M46 78 C40 120 58 150 46 196 C40 220 52 236 48 250"/>
        <path d="M72 78 C80 120 64 152 76 196 C82 220 70 236 74 252"/>
        <path d="M96 74 C108 110 88 142 102 180 C110 206 96 228 104 248"/>
      </g>
      <path d="M10 72 C10 10 110 10 110 72 C90 84 30 84 10 72 Z" fill="#cdb6e3" fill-opacity="0.9" stroke-width="2.6"/>
      <path d="M22 60 C24 34 46 20 66 20" fill="none" stroke="#ffffff" stroke-width="5" opacity="0.6"/>
      <circle cx="46" cy="58" r="5" fill="#f2c230" stroke-width="1.6"/><circle cx="74" cy="58" r="5" fill="#f2c230" stroke-width="1.6"/>
      <circle cx="47" cy="59" r="2" fill="#120c08" stroke="none"/><circle cx="75" cy="59" r="2" fill="#120c08" stroke="none"/>
      <g fill="#9a7ab3" stroke="none"><circle cx="34" cy="44" r="2.4"/><circle cx="60" cy="36" r="2.4"/><circle cx="86" cy="44" r="2.4"/></g>
    </g>
  </symbol>
  <!-- havada asılı ada, kökleri sarkıyor -->
  <symbol id="island" viewBox="0 0 240 260" overflow="visible">
    <g stroke="#2b1e18" stroke-linejoin="round" stroke-linecap="round">
      <g fill="none" stroke-width="2"><path d="M80 150 C76 190 90 210 84 250"/><path d="M120 170 C124 200 112 220 118 258"/><path d="M160 150 C168 180 156 206 164 236"/></g>
      <path d="M20 110 C60 98 180 98 220 110 C200 150 150 190 120 196 C90 190 40 150 20 110 Z" fill="#c98597" stroke-width="2.8"/>
      <path d="M120 110 C170 112 200 116 220 110 C200 150 150 190 120 196 Z" fill="url(#hatch)" stroke="none"/>
      <ellipse cx="120" cy="108" rx="100" ry="14" fill="#7a9a6a" stroke-width="2.6"/>
      <path d="M116 100 C114 80 120 60 118 40" fill="none" stroke-width="6"/>
      <circle cx="118" cy="34" r="30" fill="#e3a2b0" stroke-width="2.6"/>
      <path d="M104 28 c8 -6 18 0 14 8 c-4 6 -12 2 -9 -3" fill="none" stroke-width="1.8"/>
      <circle cx="170" cy="96" r="7" fill="#f3e2b8" stroke-width="1.8"/>
    </g>
  </symbol>
  <!-- göz desenli güve -->
  <symbol id="moth" viewBox="0 0 160 120" overflow="visible">
    <g stroke="#2b1e18" stroke-linejoin="round" stroke-linecap="round">
      <path d="M80 50 C60 10 10 6 6 36 C4 62 46 70 78 60 Z" fill="#e7c9a6" stroke-width="2.4"/>
      <path d="M80 50 C100 10 150 6 154 36 C156 62 114 70 82 60 Z" fill="#e7c9a6" stroke-width="2.4"/>
      <path d="M78 62 C54 70 30 96 42 110 C56 120 74 96 80 70 Z" fill="#c58aa8" stroke-width="2.4"/>
      <path d="M82 62 C106 70 130 96 118 110 C104 120 86 96 80 70 Z" fill="#c58aa8" stroke-width="2.4"/>
      <circle cx="40" cy="38" r="14" fill="#f2c230" stroke-width="2"/><circle cx="120" cy="38" r="14" fill="#f2c230" stroke-width="2"/>
      <circle cx="42" cy="40" r="6" fill="#120c08" stroke="none"/><circle cx="122" cy="40" r="6" fill="#120c08" stroke="none"/>
      <ellipse cx="80" cy="60" rx="7" ry="26" fill="#7b5895" stroke-width="2"/>
      <path d="M76 36 C70 20 60 14 52 16 M84 36 C90 20 100 14 108 16" fill="none" stroke-width="1.8"/>
      <circle cx="52" cy="16" r="2.4" fill="#2b1e18"/><circle cx="108" cy="16" r="2.4" fill="#2b1e18"/>
    </g>
  </symbol>
  <!-- tek gözlü sinek -->
  <symbol id="fly" viewBox="0 0 80 60" overflow="visible">
    <g stroke="#2b1e18" stroke-linejoin="round" stroke-linecap="round">
      <ellipse cx="26" cy="18" rx="20" ry="11" fill="#eaf3f1" fill-opacity="0.75" stroke-width="1.8" transform="rotate(-25 26 18)"/>
      <ellipse cx="52" cy="16" rx="20" ry="11" fill="#eaf3f1" fill-opacity="0.75" stroke-width="1.8" transform="rotate(25 52 16)"/>
      <path d="M30 40 l-8 14 M40 42 l0 14 M50 40 l8 14" fill="none" stroke-width="1.6"/>
      <circle cx="40" cy="34" r="13" fill="#5e4a6e" stroke-width="2"/>
      <circle cx="40" cy="32" r="8" fill="#f2c230" stroke-width="1.6"/>
      <circle cx="41" cy="33" r="3.2" fill="#120c08" stroke="none"/>
    </g>
  </symbol>
  <!-- uzun kuyruklu yusufçuk -->
  <symbol id="dragonfly" viewBox="0 0 220 90" overflow="visible">
    <g stroke="#2b1e18" stroke-linejoin="round" stroke-linecap="round">
      <ellipse cx="70" cy="22" rx="46" ry="10" fill="#eaf3f1" fill-opacity="0.7" stroke-width="1.8" transform="rotate(-14 70 22)"/>
      <ellipse cx="74" cy="52" rx="44" ry="9" fill="#eaf3f1" fill-opacity="0.7" stroke-width="1.8" transform="rotate(12 74 52)"/>
      <ellipse cx="110" cy="20" rx="40" ry="9" fill="#eaf3f1" fill-opacity="0.7" stroke-width="1.8" transform="rotate(16 110 20)"/>
      <ellipse cx="106" cy="54" rx="38" ry="8" fill="#eaf3f1" fill-opacity="0.7" stroke-width="1.8" transform="rotate(-12 106 54)"/>
      <path d="M100 38 L214 44" fill="none" stroke-width="7"/>
      <path d="M100 38 L214 44" fill="none" stroke="#6f8f86" stroke-width="4"/>
      <path d="M130 37 l0 8 M150 38 l0 8 M170 39 l0 8 M190 40 l0 8" fill="none" stroke-width="1.4"/>
      <circle cx="88" cy="38" r="13" fill="#6f8f86" stroke-width="2"/>
      <circle cx="80" cy="34" r="7" fill="#f2c230" stroke-width="1.6"/><circle cx="80" cy="44" r="7" fill="#f2c230" stroke-width="1.6"/>
    </g>
  </symbol>
  <!-- havada yüzen tül yüzgeçli balık -->
  <symbol id="airfish" viewBox="0 0 200 100" overflow="visible">
    <g stroke="#2b1e18" stroke-linejoin="round" stroke-linecap="round">
      <path d="M140 50 C170 20 196 18 198 30 C186 44 186 56 198 70 C196 82 170 80 140 50 Z" fill="#eaf3f1" fill-opacity="0.6" stroke-width="1.8"/>
      <path d="M70 34 C80 4 120 0 130 20 Z" fill="#eaf3f1" fill-opacity="0.6" stroke-width="1.8"/>
      <path d="M80 66 C84 92 116 96 124 76 Z" fill="#eaf3f1" fill-opacity="0.6" stroke-width="1.8"/>
      <path d="M20 50 C40 20 120 18 146 50 C120 82 40 80 20 50 Z" fill="#f0dcc4" stroke-width="2.6"/>
      <path d="M70 30 C76 44 76 56 70 70 M96 28 C102 44 102 56 96 72 M120 34 C124 44 124 56 120 66" fill="none" stroke="#c58aa8" stroke-width="5"/>
      <circle cx="44" cy="46" r="8" fill="#f2c230" stroke-width="1.8"/><circle cx="43" cy="46" r="3.4" fill="#120c08" stroke="none"/>
      <path d="M22 54 C28 58 34 58 38 56" fill="none" stroke-width="1.6"/>
    </g>
  </symbol>
  <!-- akciğer ağacı: iki pembe balon taç -->
  <symbol id="lungtree" viewBox="0 0 300 500" overflow="visible">
    <g stroke="#2b1e18" stroke-linejoin="round" stroke-linecap="round">
      <path d="M140 500 C136 420 146 360 150 300 C150 260 120 230 96 210 M150 300 C152 260 182 232 206 212" fill="none" stroke-width="18"/>
      <path d="M140 500 C136 420 146 360 150 300 C150 260 120 230 96 210 M150 300 C152 260 182 232 206 212" fill="none" stroke="#6e4a68" stroke-width="12"/>
      <path d="M96 214 C40 220 12 170 20 110 C28 50 70 20 104 34 C130 46 140 90 136 140 C132 180 124 210 96 214 Z" fill="#e8a1ab" stroke-width="3"/>
      <path d="M206 214 C262 220 290 170 282 110 C274 50 232 20 198 34 C172 46 162 90 166 140 C170 180 178 210 206 214 Z" fill="#e8a1ab" stroke-width="3"/>
      <path d="M96 210 C90 170 80 130 70 90 M90 170 C70 160 52 150 40 130 M84 130 C100 116 110 100 112 80" fill="none" stroke="#a5566a" stroke-width="2.4"/>
      <path d="M206 210 C212 170 222 130 232 90 M212 170 C232 160 250 150 262 130 M218 130 C202 116 192 100 190 80" fill="none" stroke="#a5566a" stroke-width="2.4"/>
      <path d="M210 40 C260 50 290 120 270 190 L300 190 L300 40 Z" fill="url(#hatch)" stroke="none"/>
    </g>
  </symbol>
  <!-- göz meyveli kıvrık ağaç -->
  <symbol id="eyetree" viewBox="0 0 320 520" overflow="visible">
    <g stroke="#2b1e18" stroke-linejoin="round" stroke-linecap="round">
      <path d="M150 520 C130 440 180 380 150 300 C130 250 160 200 160 160 M152 300 C110 270 70 260 40 220 C24 196 40 170 60 182 M156 230 C200 210 240 190 270 150 C290 124 276 96 256 112 M160 160 C150 110 120 80 90 70 C66 64 62 92 84 94" fill="none" stroke-width="20"/>
      <path d="M150 520 C130 440 180 380 150 300 C130 250 160 200 160 160 M152 300 C110 270 70 260 40 220 C24 196 40 170 60 182 M156 230 C200 210 240 190 270 150 C290 124 276 96 256 112 M160 160 C150 110 120 80 90 70 C66 64 62 92 84 94" fill="none" stroke="#5e4a6e" stroke-width="14"/>
      <path d="M140 470 C150 450 160 440 170 436 M150 380 C158 370 168 366 178 366" fill="none" stroke-width="1.8"/>
      <g fill="none" stroke-width="1.6"><path d="M70 236 L70 290"/><path d="M110 270 L110 318"/><path d="M200 214 L200 262"/><path d="M240 180 L240 236"/><path d="M120 84 L120 130"/><path d="M160 150 L184 196"/></g>
      <g stroke-width="2.2">
        <circle cx="70" cy="300" r="13" fill="#f2c230"/><circle cx="110" cy="328" r="11" fill="#f2c230"/><circle cx="200" cy="272" r="12" fill="#f2c230"/>
        <circle cx="240" cy="246" r="13" fill="#f2c230"/><circle cx="120" cy="140" r="12" fill="#f2c230"/><circle cx="188" cy="206" r="11" fill="#f2c230"/>
      </g>
      <g fill="#120c08" stroke="none">
        <circle cx="72" cy="303" r="5"/><circle cx="112" cy="330" r="4.4"/><circle cx="198" cy="275" r="4.8"/>
        <circle cx="243" cy="249" r="5"/><circle cx="122" cy="143" r="4.8"/><circle cx="186" cy="209" r="4.4"/>
      </g>
      <g fill="#7a9a6a" stroke-width="1.6">
        <path d="M60 182 c-14 -10 -26 -4 -28 6 c12 6 22 4 28 -6 Z"/><path d="M256 112 c4 -16 18 -20 26 -14 c-6 12 -16 16 -26 14 Z"/><path d="M84 94 c-14 0 -22 10 -20 18 c12 0 20 -8 20 -18 Z"/>
      </g>
    </g>
  </symbol>
  <!-- damlayan şapkalı mantar ağaç (uzak silüet) -->
  <symbol id="mushtree" viewBox="0 0 160 360" overflow="visible">
    <g stroke="#2b1e18" stroke-linejoin="round" stroke-linecap="round">
      <path d="M76 360 C70 280 90 200 80 110 L92 110 C100 200 84 280 90 360 Z" fill="#efe4cc" stroke-width="2.4"/>
      <path d="M6 110 C6 40 154 40 154 110 C140 116 134 130 128 116 C116 122 108 138 100 118 C88 124 76 140 66 118 C56 124 44 136 36 116 C26 122 16 130 6 110 Z" fill="#6f8f86" stroke-width="2.6"/>
      <g fill="#efe4cc" stroke-width="1.6"><circle cx="44" cy="80" r="7"/><circle cx="84" cy="64" r="9"/><circle cx="118" cy="84" r="6"/></g>
    </g>
  </symbol>
  <!-- tirbuşon gövdeli eğrelti ağacı -->
  <symbol id="corktree" viewBox="0 0 160 420" overflow="visible">
    <g stroke="#2b1e18" stroke-linejoin="round" stroke-linecap="round">
      <path d="M80 420 C50 390 110 360 80 330 C50 300 110 270 80 240 C50 210 110 180 80 150 C56 126 70 80 100 70 C130 60 140 96 116 106 C100 112 92 96 102 90" fill="none" stroke-width="16"/>
      <path d="M80 420 C50 390 110 360 80 330 C50 300 110 270 80 240 C50 210 110 180 80 150 C56 126 70 80 100 70 C130 60 140 96 116 106 C100 112 92 96 102 90" fill="none" stroke="#9a6f9e" stroke-width="10"/>
      <g fill="#c58aa8" stroke-width="1.8">
        <path d="M98 345 c18 -8 32 0 34 10 c-16 6 -28 2 -34 -10 Z"/><path d="M62 285 c-18 -8 -32 0 -34 10 c16 6 28 2 34 -10 Z"/>
        <path d="M98 225 c18 -8 32 0 34 10 c-16 6 -28 2 -34 -10 Z"/><path d="M62 165 c-18 -8 -32 0 -34 10 c16 6 28 2 34 -10 Z"/>
      </g>
    </g>
  </symbol>
  <!-- çimen öbeği: rengi use'un color değerinden gelir -->
  <symbol id="tuft" viewBox="0 0 120 100" overflow="visible">
    <g stroke="#2b1e18" stroke-width="1.8" stroke-linejoin="round" fill="currentColor">
      <path d="M40 100 C36 70 24 40 8 18 C30 40 46 70 50 100 Z"/>
      <path d="M50 100 C50 66 46 36 40 4 C56 36 60 66 60 100 Z"/>
      <path d="M58 100 C62 70 72 44 92 24 C78 50 70 74 68 100 Z"/>
      <path d="M66 100 C74 80 92 64 116 58 C96 70 82 84 76 100 Z"/>
      <path d="M34 100 C28 84 14 74 0 72 C16 70 32 80 44 100 Z"/>
    </g>
    <path d="M40 4 c-8 -4 -14 4 -8 8" fill="none" stroke="#2b1e18" stroke-width="1.8"/>
    <path d="M92 24 c6 -6 14 0 8 6" fill="none" stroke="#2b1e18" stroke-width="1.8"/>
  </symbol>
  <!-- kıvrık uçlu eğrelti filizi -->
  <symbol id="fern" viewBox="0 0 120 300" overflow="visible">
    <g stroke="#2b1e18" stroke-linecap="round" fill="none">
      <path d="M60 300 C50 220 70 140 60 80 C56 50 80 30 96 44 C108 56 96 74 84 66 C76 60 82 50 90 54" stroke-width="12"/>
      <path d="M60 300 C50 220 70 140 60 80 C56 50 80 30 96 44 C108 56 96 74 84 66 C76 60 82 50 90 54" stroke="#7a9a6a" stroke-width="7"/>
      <path d="M58 240 l-20 -10 M62 200 l22 -10 M58 160 l-20 -10 M62 120 l20 -10" stroke-width="3"/>
    </g>
  </symbol>
  <!-- iki bacaklı yürüyen göz -->
  <symbol id="walkeye" viewBox="0 0 80 150" overflow="visible">
    <g stroke="#2b1e18" stroke-linejoin="round" stroke-linecap="round">
      <path d="M30 70 C26 100 18 120 10 146 M50 70 C56 100 62 120 72 146" fill="none" stroke-width="3"/>
      <path d="M10 146 l-8 2 M72 146 l8 2" fill="none" stroke-width="3"/>
      <circle cx="40" cy="44" r="34" fill="#faf3e2" stroke-width="2.6"/>
      <circle cx="48" cy="46" r="18" fill="#f2c230" stroke-width="2"/>
      <circle cx="50" cy="47" r="8" fill="#120c08" stroke="none"/>
      <circle cx="45" cy="42" r="3" fill="#fff8e0" stroke="none"/>
      <path d="M12 30 C26 18 54 16 70 28" fill="none" stroke="#c58aa8" stroke-width="2"/>
    </g>
  </symbol>
  <!-- boncuk tırtıl -->
  <symbol id="caterpillar" viewBox="0 0 220 70" overflow="visible">
    <g stroke="#2b1e18" stroke-width="2.2">
      <g fill="none" stroke-width="1.8"><path d="M30 56 l-4 12 M58 52 l-2 14 M86 54 l0 14 M114 52 l2 14 M142 54 l4 12 M170 56 l6 10"/></g>
      <circle cx="30" cy="44" r="16" fill="#c58aa8"/><circle cx="58" cy="36" r="17" fill="#6f8f86"/><circle cx="86" cy="40" r="17" fill="#c58aa8"/>
      <circle cx="114" cy="34" r="18" fill="#6f8f86"/><circle cx="142" cy="40" r="17" fill="#c58aa8"/><circle cx="170" cy="42" r="16" fill="#6f8f86"/>
      <circle cx="196" cy="34" r="20" fill="#e7c9a6"/>
      <circle cx="202" cy="30" r="6" fill="#f2c230"/><circle cx="203" cy="31" r="2.6" fill="#120c08" stroke="none"/>
      <path d="M190 16 C186 4 178 0 172 2 M204 14 C208 2 216 -2 222 0" fill="none" stroke-width="1.8"/>
    </g>
  </symbol>
  <!-- benekli dev mantar (ön plan) -->
  <symbol id="bigmush" viewBox="0 0 240 260" overflow="visible">
    <g stroke="#2b1e18" stroke-linejoin="round" stroke-linecap="round">
      <path d="M100 260 C96 210 98 170 104 130 L140 130 C146 170 148 210 144 260 Z" fill="#efe4cc" stroke-width="3"/>
      <path d="M124 130 L140 130 C146 170 148 210 144 260 L128 260 Z" fill="url(#hatch)" stroke="none"/>
      <path d="M10 132 C10 30 230 30 230 132 C190 146 50 146 10 132 Z" fill="#b6668a" stroke-width="3"/>
      <path d="M150 50 C210 70 226 110 228 132 C200 140 170 142 150 142 Z" fill="url(#hatch)" stroke="none"/>
      <g fill="#f6e7c6" stroke-width="2"><circle cx="60" cy="90" r="14"/><circle cx="112" cy="64" r="18"/><circle cx="170" cy="92" r="12"/><circle cx="90" cy="118" r="8"/><circle cx="196" cy="118" r="7"/></g>
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

# bulutlar, adalar, denizanaları, uçan balıklar
o('<g filter="url(#wobble)">')
for x,y,w in [(470,70,360)]:
    o(f'<use href="#cloud" xlink:href="#cloud" x="{x}" y="{y}" width="{w}" height="{w*0.4:.0f}"/>')
for x,y,w in []:
    o(f'<use href="#jelly" xlink:href="#jelly" x="{x}" y="{y}" width="{w}" height="{w*2.17:.0f}"/>')
o('</g>')
# uzak nefes alan tepeler
o('<g filter="url(#wobble)" stroke="#2b1e18" stroke-linejoin="round" stroke-linecap="round">')
o('<path d="M0 1060 C140 900 300 930 420 1010 C560 880 760 900 860 990 C960 930 1040 940 1080 960 L1080 1920 L0 1920 Z" fill="url(#g1)" stroke-width="3"/>')
o('<path d="M120 1000 C180 980 240 990 300 1010 M560 950 C620 930 700 935 760 960" fill="none" stroke-width="1.8"/>')


o('<g opacity="0.85">')
for x,b,h in [(10,1030,230)]:
    w=h*0.44
    o(f'<use href="#mushtree" xlink:href="#mushtree" x="{x}" y="{b-h}" width="{w:.0f}" height="{h}"/>')
o('</g>')
# uzaktaki Velun silüeti, fanusları suluyor
o('''<g opacity="0.82" stroke-width="3">
  <path d="M752 922 C760 980 776 1030 778 1062 C770 1090 764 1120 766 1300 L834 1300 C836 1120 830 1090 822 1062 C824 1030 840 980 848 922 Z" fill="#6f8f86"/>
  <path d="M776 1056 C792 1064 808 1064 824 1056 L826 1070 C808 1078 792 1078 774 1070 Z" fill="#d6a52a" stroke-width="2"/>
  <path d="M770 930 C730 960 690 990 660 1030 C652 1042 664 1050 672 1040 C700 1004 740 975 784 950 Z" fill="#9a7ab3"/>
  <path d="M648 1020 C640 1000 676 990 690 1006 L700 1040 C690 1056 660 1056 652 1044 Z" fill="#c9a24a"/>
  <path d="M652 1030 C624 1036 606 1050 594 1066" fill="none" stroke-width="5"/>
  <path d="M786 920 C786 900 790 880 792 860 L808 860 C810 880 814 900 814 920 Z" fill="#9a7ab3"/>
  <ellipse cx="800" cy="770" rx="78" ry="98" fill="#9a7ab3"/>
  <g filter="url(#smoke)" stroke="none"><ellipse cx="772" cy="778" rx="31" ry="36" fill="#140c18" opacity="0.4"/><ellipse cx="828" cy="778" rx="31" ry="36" fill="#140c18" opacity="0.4"/></g>
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
o('<path d="M0 1190 C200 1090 380 1130 540 1180 C700 1110 900 1120 1080 1170 L1080 1920 L0 1920 Z" fill="url(#g2)" stroke-width="3"/>')
o('<path d="M0 1190 C200 1090 380 1130 540 1180 C700 1110 900 1120 1080 1170 L1080 1920 L0 1920 Z" fill="url(#pores)" stroke="none"/>')
o('<path d="M60 1180 C140 1150 240 1150 320 1170 M640 1160 C720 1140 820 1142 900 1160 M200 1240 C320 1220 440 1226 520 1250" fill="none" stroke-width="1.8"/>')


o('<use href="#eyetree" xlink:href="#eyetree" x="90" y="720" width="290" height="472"/>')
for i in range(7):
    x=random.uniform(-20,1060); y=random.uniform(1175,1215); w=random.uniform(50,80)
    c=random.choice(['#3f7f74','#c9a24a','#c58aa8'])
    if not ok(x,w,y): continue
    o(f'<use href="#tuft" xlink:href="#tuft" x="{x:.0f}" y="{y-w*0.83:.0f}" width="{w:.0f}" height="{w*0.83:.0f}" style="color:{c}"/>')
for i in range(5):
    x=random.uniform(0,1040); y=random.uniform(1240,1420); w=random.uniform(40,70)
    c=random.choice(['#3f7f74','#c9a24a','#c58aa8'])
    if not ok(x,w,y): continue
    o(f'<use href="#tuft" xlink:href="#tuft" x="{x:.0f}" y="{y-w*0.83:.0f}" width="{w:.0f}" height="{w*0.83:.0f}" style="color:{c}"/>')
# uzak fanus sırası
for x,y,s in [(90,1150,0.3),(210,1140,0.3),(330,1150,0.32),(460,1172,0.34),(560,1150,0.36),(880,1150,0.3),(980,1166,0.32)]:
    w=200*s; h=270*s
    o(f'<use xlink:href="#jar" href="#jar" x="{x-w/2:.1f}" y="{y-h:.1f}" width="{w:.1f}" height="{h:.1f}"/>')
# orta plan küre çimenler
for x in [720]:
    o(f'<use href="#bulb" xlink:href="#bulb" x="{x}" y="1060" width="30" height="150"/>')

# ön zemin
o('<path d="M0 1460 C250 1380 500 1420 700 1470 C850 1430 980 1420 1080 1450 L1080 1920 L0 1920 Z" fill="url(#g3)" stroke-width="3"/>')
o('<path d="M0 1460 C250 1380 500 1420 700 1470 C850 1430 980 1420 1080 1450 L1080 1920 L0 1920 Z" fill="url(#pores)" stroke="none"/>')
o('<path d="M80 1500 C200 1470 330 1474 420 1496 M560 1520 C680 1496 800 1500 900 1520 M220 1600 C380 1570 560 1580 700 1610" fill="none" stroke-width="2"/>')


for i in range(8):
    x=random.uniform(-20,1060); y=random.uniform(1470,1700); w=random.uniform(60,110)
    c=random.choice(['#3f7f74','#c9a24a','#c58aa8'])
    if 820 < x+w/2 < 960 and 1440 < y < 1580: continue
    if not ok(x,w,y): continue
    o(f'<use href="#tuft" xlink:href="#tuft" x="{x:.0f}" y="{y-w*0.83:.0f}" width="{w:.0f}" height="{w*0.83:.0f}" style="color:{c}"/>')
# ön plan fanusları
for x,y,s in [(330,1500,0.85),(700,1560,1.0)]:
    w=200*s; h=270*s
    o(f'<use href="#jar" xlink:href="#jar" x="{x-w/2:.1f}" y="{y-h:.1f}" width="{w:.1f}" height="{h:.1f}"/>')

# bitkiler
o('<use href="#earplant" xlink:href="#earplant" x="870" y="1160" width="220" height="440"/>')
for x in [836]:
    o(f'<use href="#bulb" xlink:href="#bulb" x="{x}" y="1380" width="46" height="230"/>')

# en ön kabarık deri tümseği
o('<path d="M0 1740 C200 1660 460 1690 640 1740 C800 1700 960 1690 1080 1720 L1080 1920 L0 1920 Z" fill="url(#g4)" stroke-width="3"/>')
o('<path d="M0 1740 C200 1660 460 1690 640 1740 C800 1700 960 1690 1080 1720 L1080 1920 L0 1920 Z" fill="url(#hatch)" stroke="none" opacity="0.6"/>')
o('<path d="M120 1760 C240 1730 380 1736 480 1760 M700 1770 C820 1746 940 1748 1040 1766" fill="none" stroke-width="2"/>')
o('</g>')


o('<g filter="url(#wobble)">')
o('<use href="#bigmush" xlink:href="#bigmush" x="-40" y="1600" width="260" height="282"/>')
o('<use href="#caterpillar" xlink:href="#caterpillar" x="600" y="1700" width="200" height="64"/>')
o('<use href="#walkeye" xlink:href="#walkeye" x="300" y="1640" width="60" height="112"/>')
for i in range(7):
    x=random.uniform(150,1060); y=random.uniform(1760,1920); w=random.uniform(80,140)
    c=random.choice(['#3f7f74','#c9a24a','#c58aa8'])
    if not ok(x,w,y): continue
    o(f'<use href="#tuft" xlink:href="#tuft" x="{x:.0f}" y="{y-w*0.83:.0f}" width="{w:.0f}" height="{w*0.83:.0f}" style="color:{c}"/>')
# uçan böcekler
for x,y,w in [(780,1360,40),(520,1700,44),(860,880,36)]:
    o(f'<use href="#fly" xlink:href="#fly" x="{x}" y="{y}" width="{w}" height="{w*0.75:.0f}"/>')
o('</g>')
# havada süzülen altın toz
for _ in range(40):
    x=random.uniform(0,W); y=random.uniform(500,1750); r=random.uniform(1.2,3.6)
    o(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="#e2b33a" opacity="{random.uniform(0.5,0.95):.2f}"/>')

o('<rect width="1080" height="1920" fill="#ece2cb" opacity="0.001" filter="url(#paper)"/>')
o('</svg>')
open(__import__('os').path.join(__import__('os').path.dirname(__file__),'dunya.svg'),'w').write('\n'.join(out))
