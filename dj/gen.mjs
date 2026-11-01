// DJ HAMAM - GECE VARDİYASI : index.html üretici (Hyperframes kompozisyonu)
import fs from "node:fs";
const lips = JSON.parse(fs.readFileSync("assets/lips.json", "utf8"));
const DUR = 55;

const LINES = [
  ["01-dj", "dj", "Hanımlar beyler, gece vardiyası başladı! İnsanlar uyusun, eğlence bize kaldı!"],
  ["02-dj", "dj", "Bu gece mutfağın sahibi benim! Burası artık Michelin değil, DJ Hamam!"],
  ["03-ev", "ev", "OĞLUM BU SAATTE NE OLUYOR?"],
  ["04-dj", "dj", "Abi sakin ol, after party yapıyoruz."],
  ["05-ev", "ev", "SEN KİMSİN?"],
  ["06-dj", "dj", "Mekânın işletmecisiyim. Sen kimsin?"],
  ["07-dj", "dj", "GÜVENLİK! GÜVENLİK! MEKÂN BASILDI!"],
  ["08-dj", "dj", "Abi şiddete gerek yok, müziğin sesini kısarım!"],
  ["09-dj", "dj", "Beyler… Yeni mekân bulduk. Soğuk ama müşterisi bol!"],
  ["10-dj", "dj", "Bu arada peyniri kim yemiş? Benim setin sponsoru oydu!"],
];
const NAMES = { dj: "DJ HAMAM", ev: "EV SAHİBİ" };
const COL = { dj: "#ff4fd8", ev: "#ffb347" };

// ---------- yardımcılar ----------
// yol komutlarını (M,L,C,Q + sayı çiftleri) soldan sağa aynalar
function d(side, ...a) {
  let out = "", i = 0;
  while (i < a.length) {
    if (typeof a[i] === "string") { out += a[i] + " "; i++; }
    else { const x = side === "L" ? a[i] : 400 - a[i]; out += `${x} ${a[i + 1]} `; i += 2; }
  }
  return out.trim();
}
const X = (side, x) => (side === "L" ? x : 400 - x);

// ---------- DJ Hamam (ve arka plan böcekleri) ----------
function roach(id, o = {}) {
  const acc = o.accent || "#ff3fd0";
  const [c0, c1, c2] = o.body || ["#b06e3c", "#5e2f14", "#26100a"];
  const full = o.full !== false;           // gözlük + kulaklık + zincir
  const g = `${id}-g`, h = `${id}-hg`;
  const leg = (s) => `
   <g id="${id}-leg${s}">
     <path d="${d(s, "M", 165, 396, "L", 152, 492)}" stroke="#2c140a" stroke-width="26" stroke-linecap="round" fill="none"/>
     <path d="${d(s, "M", 160, 400, "L", 148, 488)}" stroke="#7a4524" stroke-width="9" stroke-linecap="round" fill="none"/>
     <g id="${id}-shin${s}">
       <path d="${d(s, "M", 152, 492, "L", 150, 574)}" stroke="#2c140a" stroke-width="21" stroke-linecap="round" fill="none"/>
       <path d="${d(s, "M", 148, 494, "L", 146, 572)}" stroke="#7a4524" stroke-width="7" stroke-linecap="round" fill="none"/>
       <path d="${d(s, "M", 128, 568, "C", 126, 552, 172, 548, 186, 562, "C", 200, 572, 204, 586, 196, 596, "L", 124, 596, "C", 116, 588, 118, 576, 128, 568, "Z")}" fill="${acc}" stroke="#1a0b12" stroke-width="4"/>
       <path d="${d(s, "M", 118, 590, "L", 204, 590, "L", 204, 604, "L", 118, 604, "Z")}" fill="#fff" stroke="#1a0b12" stroke-width="4"/>
       <path d="${d(s, "M", 150, 560, "L", 172, 568, "M", 148, 570, "L", 170, 578)}" stroke="#fff" stroke-width="4" stroke-linecap="round" fill="none"/>
     </g>
   </g>`;
  const arm = (s) => `
   <g id="${id}-arm${s}">
     <path d="${d(s, "M", 136, 282, "L", 94, 346)}" stroke="#2c140a" stroke-width="24" stroke-linecap="round" fill="none"/>
     <path d="${d(s, "M", 132, 284, "L", 92, 344)}" stroke="#7a4524" stroke-width="8" stroke-linecap="round" fill="none"/>
     <g id="${id}-fore${s}">
       <path d="${d(s, "M", 94, 346, "L", 82, 414)}" stroke="#2c140a" stroke-width="20" stroke-linecap="round" fill="none"/>
       <path d="${d(s, "M", 90, 348, "L", 79, 412)}" stroke="#7a4524" stroke-width="6" stroke-linecap="round" fill="none"/>
       <ellipse cx="${X(s, 80)}" cy="424" rx="19" ry="17" fill="#3a1c0c" stroke="#1a0b12" stroke-width="3"/>
       <path d="${d(s, "M", 70, 436, "L", 62, 462, "M", 80, 440, "L", 78, 470, "M", 90, 436, "L", 94, 462)}" stroke="#2c140a" stroke-width="8" stroke-linecap="round" fill="none"/>
     </g>
   </g>`;
  const ant = (s) => `<g id="${id}-ant${s}"><path d="${d(s, "M", 176, 100, "Q", 150, 20, 82, -24)}" stroke="#2c140a" stroke-width="6" stroke-linecap="round" fill="none"/><circle cx="${X(s, 82)}" cy="-24" r="8" fill="${acc}"/></g>`;
  const brow = (s) => `<g id="${id}-brow${s}"><path d="${d(s, "M", 124, 118, "Q", 160, 104, 196, 118)}" fill="none" stroke="#1a0b12" stroke-width="9" stroke-linecap="round"/></g>`;
  const eye = (s) => `<g id="${id}-eye${s}"><ellipse cx="${X(s, 160)}" cy="152" rx="24" ry="28" fill="#fffdf4" stroke="#1a0b12" stroke-width="3"/>
     <g id="${id}-pup${s}"><circle cx="${X(s, 160)}" cy="152" r="13" fill="#140a10"/><circle cx="${X(s, 165)}" cy="145" r="4" fill="#fff"/></g>
     <ellipse id="${id}-lid${s}" cx="${X(s, 160)}" cy="152" rx="26" ry="30" fill="url(#${h})" stroke="#1a0b12" stroke-width="3"/></g>`;
  const glasses = full ? `<g id="${id}-glasses">
     <rect x="124" y="124" width="74" height="56" rx="24" fill="#07040e" stroke="#2a1a3a" stroke-width="5"/>
     <rect x="202" y="124" width="74" height="56" rx="24" fill="#07040e" stroke="#2a1a3a" stroke-width="5"/>
     <rect x="196" y="140" width="10" height="8" fill="#2a1a3a"/>
     <path d="M134 134 C150 128 170 128 184 134" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".55" fill="none"/>
     <path d="M212 134 C228 128 248 128 262 134" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".55" fill="none"/>
     <path d="M126 150 L112 146 M274 150 L288 146" stroke="#07040e" stroke-width="6"/>
     <path d="M140 170 C150 175 170 175 182 168" stroke="${acc}" stroke-width="3" opacity=".7" fill="none"/></g>` : "";
  const phones = full ? `<g id="${id}-hp">
     <path d="M120 150 C112 56 288 56 280 150" fill="none" stroke="#241040" stroke-width="18" stroke-linecap="round"/>
     <path d="M120 150 C113 62 287 62 280 150" fill="none" stroke="${acc}" stroke-width="5" stroke-linecap="round" opacity=".9"/>
     <ellipse cx="116" cy="158" rx="24" ry="40" fill="#30185a" stroke="#120826" stroke-width="5"/><ellipse cx="114" cy="158" rx="12" ry="26" fill="${acc}" opacity=".85"/>
     <ellipse cx="284" cy="158" rx="24" ry="40" fill="#30185a" stroke="#120826" stroke-width="5"/><ellipse cx="286" cy="158" rx="12" ry="26" fill="${acc}" opacity=".85"/></g>` : "";
  const chain = full ? `<g id="${id}-chain"><path d="M150 262 Q200 352 250 262" fill="none" stroke="#ffd23f" stroke-width="8" stroke-linecap="round"/>
     <path d="M150 262 Q200 352 250 262" fill="none" stroke="#fff3a0" stroke-width="2.5" stroke-dasharray="6 8" stroke-linecap="round"/>
     <circle cx="200" cy="334" r="21" fill="#ffd23f" stroke="#8a5a00" stroke-width="3"/><text x="200" y="341" text-anchor="middle" font-family="Archivo Black,Impact,sans-serif" font-size="19" fill="#7a4a00">DJ</text></g>` : "";
  const hat = o.hat ? `<g id="${id}-hat"><path d="M160 104 L200 22 L240 104Z" fill="${acc}" stroke="#1a0b12" stroke-width="4"/><circle cx="200" cy="20" r="10" fill="#ffd23f"/></g>` : "";
  const shades = o.shades ? `<g id="${id}-glasses"><path d="M126 138 Q160 124 196 138 L190 176 Q160 186 132 176Z" fill="${acc}" stroke="#1a0b12" stroke-width="4"/><path d="M204 138 Q240 124 274 138 L268 176 Q240 186 210 176Z" fill="${acc}" stroke="#1a0b12" stroke-width="4"/></g>` : "";
  const glow = o.glow ? `<g id="${id}-gl"><rect x="48" y="360" width="14" height="70" rx="7" fill="#7dffb0" stroke="#fff" stroke-width="2" transform="rotate(20 55 395)"/></g>` : "";
  return `<svg id="${id}-svg" viewBox="0 0 400 620" width="${o.w || 360}" height="${(o.w || 360) * 620 / 400}" style="overflow:visible">
   <defs>
    <radialGradient id="${g}" gradientUnits="userSpaceOnUse" cx="170" cy="280" r="220"><stop offset="0" stop-color="${c0}"/><stop offset=".55" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient>
    <radialGradient id="${h}" gradientUnits="userSpaceOnUse" cx="170" cy="130" r="110"><stop offset="0" stop-color="${c0}"/><stop offset=".6" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient>
   </defs>
   <ellipse cx="200" cy="604" rx="130" ry="14" fill="#000" opacity=".35"/>
   ${leg("L")}${leg("R")}
   <g id="${id}-torso">
    <g id="${id}-wings"><path d="M130 258 C84 300 84 410 124 452 C150 400 150 320 140 262Z" fill="url(#${g})" stroke="#1a0b12" stroke-width="4"/><path d="M270 258 C316 300 316 410 276 452 C250 400 250 320 260 262Z" fill="url(#${g})" stroke="#1a0b12" stroke-width="4"/></g>
    <path d="M200 226 C282 226 290 330 270 400 C250 452 150 452 130 400 C110 330 118 226 200 226Z" fill="url(#${g})" stroke="#1a0b12" stroke-width="5"/>
    <path d="M200 252 C252 252 258 330 244 388 C230 426 170 426 156 388 C142 330 148 252 200 252Z" fill="#d89a52" opacity=".55"/>
    <path d="M152 290 Q200 300 248 290 M148 318 Q200 330 252 318 M150 346 Q200 358 250 346 M156 374 Q200 386 244 374 M166 402 Q200 412 234 402" fill="none" stroke="#7a4524" stroke-width="4" opacity=".8"/>
    <path d="M146 262 C156 246 190 240 206 242 C170 252 154 280 150 318Z" fill="#fff" opacity=".25"/>
    ${chain}
   </g>
   ${arm("L")}${arm("R")}
   <g id="${id}-head">
    ${ant("L")}${ant("R")}
    <ellipse cx="200" cy="238" rx="86" ry="30" fill="url(#${g})" stroke="#1a0b12" stroke-width="4"/>
    <ellipse cx="200" cy="158" rx="80" ry="72" fill="url(#${h})" stroke="#1a0b12" stroke-width="5"/>
    <path d="M144 112 C160 90 196 84 216 88 C176 98 158 124 152 150Z" fill="#fff" opacity=".26"/>
    ${eye("L")}${eye("R")}${brow("L")}${brow("R")}
    ${glasses}${shades}
    <path id="${id}-smile" d="M170 210 Q200 226 232 208" fill="none" stroke="#1a0b12" stroke-width="6" stroke-linecap="round"/>
    <g id="${id}-mouth"><clipPath id="${id}-mc"><path d="M168 208 Q200 214 234 208 Q236 244 202 246 Q166 244 168 208Z"/></clipPath>
      <path d="M168 208 Q200 214 234 208 Q236 244 202 246 Q166 244 168 208Z" fill="#4a1020" stroke="#1a0b12" stroke-width="4" stroke-linejoin="round"/>
      <g clip-path="url(#${id}-mc)"><ellipse cx="202" cy="244" rx="26" ry="12" fill="#ff7a8a"/><rect x="170" y="207" width="62" height="7" fill="#fffbe8"/></g></g>
    <path d="M176 220 L170 238 M228 220 L234 238" stroke="#1a0b12" stroke-width="6" stroke-linecap="round"/>
    ${phones}${hat}
   </g>
   ${glow}
  </svg>`;
}

// ---------- Ev sahibi (kadın) ----------
function host() {
  const id = "ho";
  const skin = ["#ffd8b8", "#f0a888", "#b86a50"];
  return `<svg id="${id}-svg" viewBox="0 0 520 1160" width="520" height="1160" style="overflow:visible">
  <defs>
   <radialGradient id="${id}-sk" gradientUnits="userSpaceOnUse" cx="240" cy="280" r="150"><stop offset="0" stop-color="${skin[0]}"/><stop offset=".6" stop-color="${skin[1]}"/><stop offset="1" stop-color="${skin[2]}"/></radialGradient>
   <linearGradient id="${id}-pj" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb6d6"/><stop offset="1" stop-color="#e07ab0"/></linearGradient>
   <linearGradient id="${id}-pa" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3a9cc0"/><stop offset=".5" stop-color="#6cc6e4"/><stop offset="1" stop-color="#2f84a8"/></linearGradient>
  </defs>
  <ellipse cx="260" cy="1138" rx="190" ry="20" fill="#000" opacity=".3"/>
  <g id="${id}-legL"><path d="M214 640 L204 1090" stroke="url(#${id}-pa)" stroke-width="92" stroke-linecap="round" fill="none"/>
    <path d="M214 700 L208 1000" stroke="#fff" stroke-width="3" stroke-dasharray="2 34" stroke-linecap="round" opacity=".7"/>
    <ellipse cx="198" cy="1112" rx="62" ry="30" fill="#ffc0dc" stroke="#7a2f58" stroke-width="5"/><ellipse cx="180" cy="1086" rx="16" ry="22" fill="#ffc0dc" stroke="#7a2f58" stroke-width="4"/></g>
  <g id="${id}-legR"><path d="M306 640 L316 1090" stroke="url(#${id}-pa)" stroke-width="92" stroke-linecap="round" fill="none"/>
    <path d="M306 700 L312 1000" stroke="#fff" stroke-width="3" stroke-dasharray="2 34" stroke-linecap="round" opacity=".7"/>
    <ellipse cx="322" cy="1112" rx="62" ry="30" fill="#ffc0dc" stroke="#7a2f58" stroke-width="5" id="${id}-slipfoot"/><ellipse cx="340" cy="1086" rx="16" ry="22" fill="#ffc0dc" stroke="#7a2f58" stroke-width="4" id="${id}-slipfoot2"/></g>
  <g id="${id}-body">
   <path d="M150 440 C150 410 200 396 260 396 C320 396 370 410 370 440 L384 690 C340 724 180 724 136 690Z" fill="url(#${id}-pj)" stroke="#7a2f58" stroke-width="6"/>
   <g fill="#fff6a8" opacity=".9"><circle cx="190" cy="500" r="9"/><circle cx="260" cy="470" r="9"/><circle cx="330" cy="510" r="9"/><circle cx="220" cy="580" r="9"/><circle cx="300" cy="600" r="9"/><circle cx="180" cy="650" r="9"/><circle cx="340" cy="660" r="9"/></g>
   <path d="M170 420 C180 470 180 560 172 640" stroke="#fff" stroke-width="12" opacity=".2" fill="none"/>
   <path d="M232 396 C240 420 280 420 288 396" fill="url(#${id}-sk)" stroke="#7a2f58" stroke-width="4"/>
  </g>
  <g id="${id}-armL">
   <path d="M168 452 L118 590" stroke="#ffa0c8" stroke-width="64" stroke-linecap="round" fill="none"/><path d="M168 452 L118 590" stroke="#7a2f58" stroke-width="4" stroke-linecap="round" fill="none" opacity=".35"/>
   <g id="${id}-foreL"><path d="M118 590 L104 700" stroke="#ffa0c8" stroke-width="56" stroke-linecap="round" fill="none"/><ellipse cx="102" cy="722" rx="30" ry="34" fill="url(#${id}-sk)" stroke="#7a2f58" stroke-width="4"/></g>
  </g>
  <g id="${id}-armR">
   <path d="M352 452 L402 590" stroke="#ffa0c8" stroke-width="64" stroke-linecap="round" fill="none"/>
   <g id="${id}-foreR"><path d="M402 590 L416 700" stroke="#ffa0c8" stroke-width="56" stroke-linecap="round" fill="none"/><ellipse cx="418" cy="722" rx="30" ry="34" fill="url(#${id}-sk)" stroke="#7a2f58" stroke-width="4"/>
    <g id="${id}-slip" opacity="0"><path d="M376 730 C372 690 420 650 470 664 C506 676 520 720 508 758 C494 786 396 786 376 730Z" fill="#ff8a2a" stroke="#6a2a00" stroke-width="6"/><path d="M386 744 C420 724 470 722 502 742" fill="none" stroke="#ffd08a" stroke-width="8" stroke-linecap="round"/><path d="M392 764 C430 776 470 776 500 764" fill="none" stroke="#6a2a00" stroke-width="5"/></g></g>
  </g>
  <g id="${id}-head">
   <path d="M170 330 C120 250 160 120 260 120 C360 120 400 250 350 330 C380 400 350 440 330 400 L190 400 C170 440 140 400 170 330Z" fill="#2c1a14" stroke="#120a08" stroke-width="5"/>
   <circle cx="262" cy="104" r="50" fill="#2c1a14" stroke="#120a08" stroke-width="5"/><path d="M222 126 Q262 156 304 124" stroke="#ff4f9a" stroke-width="16" stroke-linecap="round" fill="none"/>
   <path d="M130 196 C100 170 96 130 122 116" stroke="#2c1a14" stroke-width="12" stroke-linecap="round" fill="none"/>
   <ellipse cx="260" cy="300" rx="94" ry="108" fill="url(#${id}-sk)" stroke="#7a2f58" stroke-width="5"/>
   <path d="M170 232 C190 172 250 160 290 170 C250 176 208 200 196 250Z" fill="#2c1a14"/><path d="M236 200 C290 168 340 190 352 250 C320 204 280 200 236 200Z" fill="#2c1a14"/>
   <path d="M312 148 C338 120 360 130 366 162" stroke="#2c1a14" stroke-width="10" stroke-linecap="round" fill="none"/>
   <ellipse cx="190" cy="352" rx="22" ry="12" fill="#ff8a8a" opacity=".5"/><ellipse cx="330" cy="352" rx="22" ry="12" fill="#ff8a8a" opacity=".5"/>
   <g id="${id}-eyeL"><ellipse cx="222" cy="300" rx="25" ry="29" fill="#fffdf6" stroke="#5a2a30" stroke-width="3"/><g id="${id}-pupL"><circle cx="222" cy="300" r="13" fill="#3a2418"/><circle cx="222" cy="300" r="7" fill="#120a08"/><circle cx="227" cy="294" r="4" fill="#fff"/></g>
     <ellipse id="${id}-lidL" cx="222" cy="300" rx="27" ry="31" fill="url(#${id}-sk)" stroke="#5a2a30" stroke-width="3"/><path d="M198 330 Q222 344 246 330" stroke="#8a5a8a" stroke-width="5" fill="none" opacity=".65"/></g>
   <g id="${id}-eyeR"><ellipse cx="298" cy="300" rx="25" ry="29" fill="#fffdf6" stroke="#5a2a30" stroke-width="3"/><g id="${id}-pupR"><circle cx="298" cy="300" r="13" fill="#3a2418"/><circle cx="298" cy="300" r="7" fill="#120a08"/><circle cx="303" cy="294" r="4" fill="#fff"/></g>
     <ellipse id="${id}-lidR" cx="298" cy="300" rx="27" ry="31" fill="url(#${id}-sk)" stroke="#5a2a30" stroke-width="3"/><path d="M274 330 Q298 344 322 330" stroke="#8a5a8a" stroke-width="5" fill="none" opacity=".65"/></g>
   <g id="${id}-browL"><path d="M190 262 Q222 248 252 262" stroke="#2c1a14" stroke-width="10" stroke-linecap="round" fill="none"/></g>
   <g id="${id}-browR"><path d="M268 262 Q298 248 330 262" stroke="#2c1a14" stroke-width="10" stroke-linecap="round" fill="none"/></g>
   <path d="M256 318 Q246 342 262 346" stroke="#b86a50" stroke-width="5" fill="none" stroke-linecap="round"/>
   <path id="${id}-smile" d="M226 372 Q260 384 296 372" fill="none" stroke="#a02848" stroke-width="7" stroke-linecap="round"/>
   <g id="${id}-mouth"><clipPath id="${id}-mc"><path d="M222 372 Q260 378 298 372 Q304 416 260 420 Q216 416 222 372Z"/></clipPath>
     <path d="M222 372 Q260 378 298 372 Q304 416 260 420 Q216 416 222 372Z" fill="#5a1426" stroke="#a02848" stroke-width="6" stroke-linejoin="round"/>
     <g clip-path="url(#${id}-mc)"><rect x="226" y="371" width="68" height="10" fill="#fffbe8"/><ellipse cx="260" cy="418" rx="30" ry="14" fill="#ff7a8a"/></g></g>
  </g>
  </svg>`;
}

// ---------- sahne ----------
const roaches = [
  ["dj", { full: true, accent: "#ff3fd0" }],
  ["b1", { full: false, accent: "#34c8ff", body: ["#9a5a2a", "#53280e", "#241008"], w: 300, glow: true }],
  ["b2", { full: false, accent: "#ffd23f", body: ["#b27a3c", "#6a3a14", "#2c1608"], w: 300, hat: true }],
  ["b3", { full: false, accent: "#ff5a5a", body: ["#8a4a30", "#4a1e12", "#200c08"], w: 300, shades: true }],
  ["b4", { full: false, accent: "#9d6bff", body: ["#a86a46", "#5a2c18", "#26100a"], w: 300 }],
];
const roachDivs = roaches.map(([id, o]) => `<div id="r-${id}" class="rc">${roach(id, o)}</div>`).join("\n");
// buzdolabı içi (sahne 5): aynı tasarım, ayrı örnekler
const roachesF = [
  ["fdj", { full: true, accent: "#ff3fd0", w: 360 }],
  ["f1", { full: false, accent: "#34c8ff", body: ["#9a5a2a", "#53280e", "#241008"], w: 300, glow: true }],
  ["f2", { full: false, accent: "#ffd23f", body: ["#b27a3c", "#6a3a14", "#2c1608"], w: 300, hat: true }],
  ["f3", { full: false, accent: "#ff5a5a", body: ["#8a4a30", "#4a1e12", "#200c08"], w: 300, shades: true }],
];
const roachDivsF = roachesF.map(([id, o]) => `<div id="r-${id}" class="rc">${roach(id, o)}</div>`).join("\n");

const caps = LINES.map((l, i) => {
  const s = lips[l[0]].start, e = lips[l[0]].start + lips[l[0]].dur;
  const nxt = i + 1 < LINES.length ? lips[LINES[i + 1][0]].start : e + 0.4;
  const end = Math.max(Math.min(nxt, e + 1.2), e + 0.15);
  return `<div id="cap${i + 1}" class="clip cap" data-start="${s.toFixed(2)}" data-duration="${(end - s).toFixed(2)}" data-track-index="3"><div class="cap-in" id="cap${i + 1}-in"><div class="who" style="background:${COL[l[1]]}">${NAMES[l[1]]}</div><div class="txt">${l[2]}</div></div></div>`;
}).join("\n");

const data = { lines: LINES.map((l) => ({ id: l[0], who: l[1], start: lips[l[0]].start, dur: lips[l[0]].dur, m: lips[l[0]].m })) };
const platesHtml = [1560, 1790, 2020, 2250].map((x, i) => `<div id="plate${i}" class="plate" style="left:${x - 110}px"></div>`).join("");
const beams = [0, 1, 2].map((i) => `<div id="beam${i}" class="beam"></div>`).join("");

const html = `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=1080, height=1920">
<title>DJ Hamam - Gece Vardiyası</title>
<style>
  html,body{margin:0;background:#0b0618;}
  #root{position:relative;width:1080px;height:1920px;overflow:hidden;background:#0b0618;font-family:'Nunito',sans-serif;}
  .abs{position:absolute;}
  #stage{position:absolute;left:0;top:0;width:2400px;height:2300px;transform-origin:0 0;}
  #wall{left:0;top:0;width:2400px;height:1000px;background:linear-gradient(#3a2a62,#2a1d4a);}
  #tiles{left:0;top:380px;width:2400px;height:620px;background:
     repeating-linear-gradient(90deg,transparent 0 118px,rgba(255,255,255,.16) 118px 122px),
     repeating-linear-gradient(0deg,transparent 0 118px,rgba(255,255,255,.16) 118px 122px),linear-gradient(#6c5aa6,#4a3a7e);}
  #uppers{left:700px;top:0;width:1700px;height:380px;background:linear-gradient(#7a4a8a,#52305e);border-bottom:10px solid #2a1638;box-sizing:border-box;}
  #uppers i{position:absolute;top:20px;bottom:30px;width:6px;background:#2a1638;}
  #clock{left:1140px;top:130px;width:320px;height:150px;border-radius:24px;background:#120a1e;border:8px solid #5a3a7a;box-sizing:border-box;color:#ff3b5c;font:900 96px/134px 'Space Mono',monospace;text-align:center;text-shadow:0 0 18px #ff3b5c;}
  #window{left:1560px;top:420px;width:300px;height:340px;background:linear-gradient(#0a0a2a,#1a1a5a);border:14px solid #e8e0f4;box-sizing:border-box;border-radius:8px;overflow:hidden;}
  #moon{left:200px;top:40px;width:70px;height:70px;border-radius:50%;background:#fff6c8;box-shadow:0 0 30px #fff6c8;}
  #counter{left:480px;top:1000px;width:1920px;height:520px;background:linear-gradient(#7a5a86,#4a3458);}
  #ctop{left:480px;top:990px;width:1920px;height:40px;background:linear-gradient(#e4dcf0,#a89cc0);border-bottom:6px solid #3a2848;box-sizing:border-box;}
  #cdoors{left:480px;top:1030px;width:1920px;height:490px;background:repeating-linear-gradient(90deg,#6a4a7a 0 370px,#2a1638 370px 380px);}
  #floor{left:0;top:1520px;width:2400px;height:780px;background:repeating-linear-gradient(0deg,#4a3a68 0 130px,#3e2f5a 130px 134px);}
  #fridge{left:0;top:380px;width:520px;height:1140px;}
  .fr-body{background:linear-gradient(90deg,#c9d2e8,#eef2fa 40%,#aeb9d4);border:8px solid #6a7694;box-sizing:border-box;border-radius:14px 14px 0 0;}
  #fr-int{left:0;top:380px;width:520px;height:1140px;background:linear-gradient(#cfeeff,#eaffff);opacity:0;}
  #fr-door{left:0;top:380px;width:520px;height:1140px;transform-origin:0 50%;}
  #fr-handle{left:440px;top:700px;width:22px;height:240px;border-radius:11px;background:linear-gradient(90deg,#8a96b4,#e8eefc);}
  .plate{position:absolute;top:978px;width:220px;height:34px;border-radius:50%;background:radial-gradient(#fff,#cfd6e8);border:5px solid #8a96b4;box-sizing:border-box;}
  .cap{position:absolute;}
  #tt0,#tt1{position:absolute;top:944px;width:150px;height:70px;}
  .disc{position:absolute;left:0;top:0;width:150px;height:70px;border-radius:50%;background:repeating-radial-gradient(#222,#222 3px,#3a3a3a 3px 6px);border:6px solid #c0c8dc;box-sizing:border-box;}
  .rc{position:absolute;transform-origin:50% 96%;}
  .rc svg{display:block;overflow:visible;}
  #host{position:absolute;transform-origin:50% 98%;}
  .beam{position:absolute;top:0;width:520px;height:1400px;transform-origin:50% 0;background:linear-gradient(rgba(255,255,255,.45),rgba(255,255,255,0));clip-path:polygon(46% 0,54% 0,100% 100%,0 100%);mix-blend-mode:screen;}
  #wash{left:0;top:0;width:2400px;height:2300px;mix-blend-mode:screen;opacity:0;}
  #night{left:0;top:0;width:2400px;height:2300px;background:#0a0420;opacity:.58;}
  #lite{left:0;top:0;width:2400px;height:2300px;background:#fff1d0;opacity:0;mix-blend-mode:soft-light;}
  #ball{left:1300px;top:290px;width:70px;height:70px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff,#9aa6c8 55%,#4a5478);box-shadow:0 0 30px #fff;}
  #stroke{left:1296px;top:200px;width:6px;height:100px;background:#8a96b4;}
  #stage5{position:absolute;left:0;top:0;width:1080px;height:2300px;transform-origin:0 0;opacity:0;}
  #f-bg{left:0;top:0;width:1080px;height:2300px;background:linear-gradient(#d4f3ff,#9ad8f0 60%,#7ac2e0);}
  .shelf{position:absolute;left:0;width:1080px;height:34px;background:linear-gradient(#f4fbff,#a8cfe4);border-bottom:6px solid #5f8fb0;box-sizing:border-box;}
  #fglow{left:0;top:0;width:1080px;height:2300px;mix-blend-mode:screen;opacity:.6;}
  #speed{position:absolute;left:0;top:0;width:1080px;height:1920px;opacity:0;z-index:40;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(255,255,255,0) 0 22px,rgba(255,255,255,.25) 22px 26px,rgba(255,255,255,0) 26px 60px);mix-blend-mode:screen;}
  #vig{position:absolute;left:0;top:0;width:1080px;height:1920px;pointer-events:none;background:radial-gradient(ellipse 75% 62% at 50% 38%,rgba(0,0,0,0) 55%,rgba(10,4,30,.6));z-index:50;}
  #flash{position:absolute;left:0;top:0;width:1080px;height:1920px;background:#fff;opacity:0;z-index:55;pointer-events:none;}
  #black{position:absolute;left:0;top:0;width:1080px;height:1920px;background:#000;opacity:0;z-index:56;pointer-events:none;}
  #title{position:absolute;left:0;top:200px;width:1080px;text-align:center;z-index:60;}
  #title .t{display:inline-block;font:900 64px 'Nunito',sans-serif;color:#fff;-webkit-text-stroke:10px #1a0838;paint-order:stroke fill;padding:6px 26px;background:linear-gradient(90deg,#ff3fd0,#7d4dff);border-radius:22px;box-shadow:0 8px 0 #1a0838,0 0 36px #ff3fd0;}
  #title .s{margin-top:16px;font:900 36px 'Nunito',sans-serif;color:#9ff0ff;-webkit-text-stroke:7px #1a0838;paint-order:stroke fill;}
  .cap{left:60px;top:1128px;width:960px;z-index:70;text-align:center;}
  .cap-in{display:inline-block;transform-origin:50% 100%;}
  .who{display:inline-block;font:900 28px 'Nunito',sans-serif;color:#1a0838;padding:2px 18px;border-radius:14px;margin-bottom:6px;border:4px solid #1a0838;}
  .txt{font:900 50px/1.16 'Nunito',sans-serif;color:#fff;-webkit-text-stroke:9px #1a0838;paint-order:stroke fill;text-shadow:0 5px 0 #1a0838;}
</style></head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="${DUR}" data-width="1080" data-height="1920">

  <div id="stage" class="clip" data-start="0" data-duration="40.9" data-track-index="1" data-layout-ignore>
    <div id="wall" class="abs"></div><div id="tiles" class="abs"></div><div id="uppers" class="abs"><i style="left:420px"></i><i style="left:850px"></i><i style="left:1280px"></i></div>
    <div id="clock" class="abs">03:07</div>
    <div id="window" class="abs"><div id="moon" class="abs"></div></div>
    <div id="stroke" class="abs"></div><div id="ball" class="abs"></div>
    <div class="abs" style="left:2200px;top:880px;width:46px;height:72px;border-radius:8px;background:#f4efe6;border:5px solid #9a9080;box-sizing:border-box" id="switch"><div class="abs" id="sw-t" style="left:11px;top:10px;width:16px;height:30px;border-radius:5px;background:#cfc6b4"></div></div>
    <div id="counter" class="abs"></div><div id="cdoors" class="abs"></div><div id="ctop" class="abs"></div>
    <!-- DJ kabini: şişe kapağı pikaplar, kaşık mikrofon, tabak pist -->
    <div id="tt0" style="left:925px"><div class="disc" id="disc0"></div><div class="abs" style="left:56px;top:24px;width:38px;height:22px;border-radius:50%;background:radial-gradient(#ffd23f,#c8901c)"></div></div>
    <div id="tt1" style="left:1275px"><div class="disc" id="disc1"></div><div class="abs" style="left:56px;top:24px;width:38px;height:22px;border-radius:50%;background:radial-gradient(#ff5a5a,#aa2020)"></div></div>
    <div class="abs" style="left:1500px;top:846px;width:8px;height:150px;background:#c0c8dc"></div>
    <div class="abs" style="left:1485px;top:800px;width:38px;height:62px;border-radius:50%;background:linear-gradient(#f4f6fb,#a8b0c8);border:3px solid #6a7694;box-sizing:border-box"></div>
    <div class="abs" style="left:1350px;top:920px;width:6px;height:80px;background:#c0c8dc"></div><div class="abs" style="left:1337px;top:884px;width:32px;height:50px;border-radius:50%;background:linear-gradient(#f4f6fb,#a8b0c8);border:3px solid #6a7694;box-sizing:border-box"></div>
    ${platesHtml}
    <div id="r-slot"></div>
    ${roachDivs}
    <div id="fridge" class="abs">
      <div id="fr-int" class="abs"><div class="shelf" style="top:300px"></div><div class="shelf" style="top:640px"></div><div class="shelf" style="top:980px"></div></div>
      <div id="fr-door" class="abs fr-body"><div id="fr-handle" class="abs"></div><div class="abs" style="left:30px;top:60px;width:200px;height:90px;background:#7a86a8;opacity:.15"></div></div>
    </div>
    <div id="host-wrap">${`<div id="host">${host()}</div>`}</div>
    <div id="floor" class="abs" style="z-index:-1"></div>
    <div id="wash" class="abs"></div><div id="beams">${beams}</div>
    <div id="night" class="abs"></div><div id="lite" class="abs"></div>
  </div>

  <div id="stage5" class="clip" data-start="40.8" data-duration="14.2" data-track-index="2" data-layout-ignore>
    <div id="f-bg" class="abs"></div>
    <div class="shelf" style="top:1060px"></div>
    <div class="abs" style="left:30px;top:620px;width:150px;height:420px;border-radius:12px;background:linear-gradient(90deg,#fff,#d4e4f4);border:6px solid #6a96c0;box-sizing:border-box"></div>
    <div class="abs" style="left:30px;top:660px;width:150px;height:90px;background:#5aa0e0;opacity:.8"></div>
    <div class="abs" style="left:900px;top:760px;width:130px;height:280px;border-radius:20px 20px 12px 12px;background:linear-gradient(90deg,#ff9a3c,#e06a10);border:6px solid #8a3a00;box-sizing:border-box"></div>
    <div class="abs" style="left:430px;top:954px;width:190px;height:108px;"><div class="abs" style="left:0;top:50px;width:190px;height:48px;border-radius:50%;background:radial-gradient(#fff,#cfd6e8);border:5px solid #8a96b4;box-sizing:border-box"></div></div>
    <div class="abs" id="tt5a" style="left:350px;top:1000px;width:150px;height:70px"><div class="disc" id="disc5a"></div></div>
    <div class="abs" id="tt5b" style="left:640px;top:1000px;width:150px;height:70px"><div class="disc" id="disc5b"></div></div>
    <div class="abs" id="cheese" style="left:760px;top:900px;width:240px;height:170px;"><svg viewBox="0 0 240 170" width="240" height="170"><path d="M8 150 L226 150 L226 70 C170 74 60 40 8 150Z" fill="#ffd23f" stroke="#8a6a00" stroke-width="5"/><path d="M8 150 L226 150 L226 120 L8 120Z" fill="#f0b81c" opacity=".6"/><circle cx="150" cy="118" r="14" fill="#c89a10"/><circle cx="196" cy="100" r="9" fill="#c89a10"/><circle cx="90" cy="130" r="10" fill="#c89a10"/><path d="M226 70 C210 60 190 80 200 96 C214 92 226 98 226 110Z" fill="#fff1b0" stroke="#8a6a00" stroke-width="3"/></svg></div>
    <div id="fcrumbs" class="abs" style="left:420px;top:1040px;width:200px;height:20px;opacity:0"><svg viewBox="0 0 200 20" width="200" height="20"><g fill="#ffd23f" stroke="#8a6a00" stroke-width="1.5"><circle cx="20" cy="12" r="4"/><circle cx="64" cy="8" r="3"/><circle cx="110" cy="12" r="5"/><circle cx="150" cy="9" r="3"/><circle cx="180" cy="12" r="4"/></g></svg></div>
    ${roachDivsF}
    <div id="fglow" class="abs"></div>
  </div>

  <div id="speed"></div>
  <div id="title" class="clip" data-start="0" data-duration="3.2" data-track-index="4"><div class="t" id="title-t">DJ HAMAM</div><div class="s" id="title-s">GECE VARDİYASI • 03:07</div></div>
  ${caps}
  <div id="flash"></div><div id="black"></div><div id="vig"></div>
  <audio id="master" src="assets/master.wav" data-start="0" data-duration="${DUR}" data-volume="1"></audio>
</div>

<script src="assets/gsap.min.js"></script>
<script>
const D = ${JSON.stringify(data)};
const DUR = ${DUR};
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x)), lerp=(a,b,u)=>a+(b-a)*u;
const ss=(x)=>{x=clamp(x);return x*x*(3-2*x);}, eoc=(x)=>1-Math.pow(1-clamp(x),3), eio=(x)=>{x=clamp(x);return x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;};
const eob=(x)=>{x=clamp(x);const c1=1.9,c3=c1+1;return 1+c3*Math.pow(x-1,3)+c1*Math.pow(x-1,2);};
function rnd(s){s=Math.sin(s*127.1+311.7)*43758.5453;return s-Math.floor(s);}
const BPM=124, BEAT=BPM/60;
const R2D=Math.PI/180;

// ================= yol/konum anahtar kareleri =================
// [t, x, y, durum]   durum: bir sonraki kareye kadar geçerli poz
const DJP=[
 [0,500,1000,'peek'],[1.0,520,1000,'walk'],[2.4,640,1000,'stand'],[2.9,640,1000,'talk'],
 [4.9,640,1000,'walk'],[5.5,700,1000,'talk'],[7.0,820,1000,'walk'],[8.6,1000,1000,'idle'],
 [9.4,1000,1000,'slide'],[10.0,1150,1000,'scratch'],[14.4,1150,1000,'dance'],[16.9,1150,1000,'scratch'],[17.8,1150,1000,'dance'],
 [18.96,1150,1000,'freeze'],[30.9,1150,1000,'gulp'],
 [31.2,1150,1000,'run'],[32.3,700,1000,'run'],[32.9,560,1560,'jump'],[33.2,560,1560,'run'],[34.6,1500,1560,'run'],
 [34.7,1500,1560,'slide'],[35.5,1950,1560,'jump'],[36.1,1980,1000,'run'],[36.3,1980,1000,'run'],
 [39.0,900,1000,'run'],[39.9,560,1000,'run'],[40.3,420,820,'jump'],[40.6,420,820,'hide']
];
// DJ konumu: parça parça doğrusal (+ zıplama ark)
function posOf(arr,t){
  let i=0; while(i+1<arr.length&&t>=arr[i+1][0])i++;
  const a=arr[i], b=arr[Math.min(i+1,arr.length-1)];
  const u=b[0]===a[0]?0:clamp((t-a[0])/(b[0]-a[0]));
  let x,y;
  const jumping=a[3]==='jump';
  const e=a[3]==='slide'?eoc(u):jumping?u:u;
  x=lerp(a[1],b[1],e); y=lerp(a[2],b[2],jumping?eio(u):u);
  if(jumping) y-=Math.sin(Math.PI*u)*(a[0]===32.9?260:a[0]===35.5?220:140);
  return {x,y,state:a[3],u,seg:a[0]};
}
const HP=[ // ev sahibi: [t,x,state]
 [0,2800,'away'],[18.3,2800,'enter'],[19.0,2060,'idleH'],[30.5,2060,'grab'],[31.0,2060,'chase'],[32.6,1300,'chase'],[33.5,1000,'chase'],
 [34.6,1550,'chase'],[35.6,2000,'chase'],[37.3,1500,'chase'],[38.7,1000,'chase'],[40.2,640,'chase'],[40.8,640,'bang']
];
function hostPos(t){let i=0;while(i+1<HP.length&&t>=HP[i+1][0])i++;const a=HP[i],b=HP[Math.min(i+1,HP.length-1)];const u=b[0]===a[0]?0:clamp((t-a[0])/(b[0]-a[0]));return {x:lerp(a[1],b[1],a[2]==='enter'?eoc(u):u),state:a[2],u};}
const WHACK=[32.6,33.7,35.0,37.3,38.7,40.45];

// ================= poz fonksiyonları =================
const P0=()=>({x:0,y:0,rot:0,sx:1,sy:1,head:0,antL:0,antR:0,aLu:0,aLf:0,aRu:0,aRf:0,hL:0,kL:0,hR:0,kR:0,brow:0,raise:0,glassY:0,chain:0,hp:1,wing:0,lid:0,mood:0,pupx:0,pupy:0});
const SMP={}; // poz sözlüğü
function dance(t,ph,style,amp=1){
  const b=t*BEAT+ph, s=Math.sin(Math.PI*b), bo=Math.abs(s), w=Math.sin(2*Math.PI*b);
  const p=P0();
  p.y=-26*bo*amp; p.sy=1+.05*bo-.03; p.sx=1-.03*bo; p.rot=6*s*amp; p.head=-8*s*amp+3*Math.sin(t*9+ph);
  p.antL=14*Math.sin(2*Math.PI*b+1); p.antR=-14*Math.sin(2*Math.PI*b);
  p.hL=22*Math.max(0,s)*amp; p.kL=-30*Math.max(0,s)*amp; p.hR=22*Math.max(0,-s)*amp; p.kR=-30*Math.max(0,-s)*amp;
  p.chain=14*s; p.hp=1+.05*bo; p.wing=1; p.raise=-.3*bo;
  const st=style%4;
  if(st===0){p.aLu=80+70*Math.max(0,s); p.aRu=80+70*Math.max(0,-s); p.aLf=20; p.aRf=20;}            // sağ-sol kol havaya
  else if(st===1){p.aLu=150+25*w; p.aRu=150-25*w; p.aLf=-10*w; p.aRf=10*w;}                          // iki kol yukarı dalga
  else if(st===2){p.aLu=40+30*bo; p.aRu=110+60*(1-bo); p.aLf=50; p.aRf=-20; p.rot+=6*s;}              // disko işaret
  else {p.aLu=95+40*w; p.aRu=95-40*w; p.aLf=40*s; p.aRf=-40*s; p.y-=8*bo;}                           // robot/sallan
  return p;
}
const POSES={
 peek:(t,u)=>{const p=P0();p.rot=-6;p.head=-10;p.aLu=30;p.aRu=10;p.antL=10*Math.sin(t*5);p.antR=-8*Math.sin(t*4+1);p.mood=1;p.glassY=-4;return p;},
 walk:(t)=>{const p=P0();const f=t*7,s=Math.sin(f);p.y=-9*Math.abs(s);p.hL=-20*Math.max(0,s);p.kL=34*Math.max(0,s);p.hR=-20*Math.max(0,-s);p.kR=34*Math.max(0,-s);p.aLu=14+12*s;p.aRu=14-12*s;p.rot=3*s;p.head=-2*s;p.antL=8*Math.sin(t*6);p.antR=-8*Math.sin(t*5+1);p.mood=1;return p;},
 stand:(t)=>{const p=P0();const s=Math.sin(t*2);p.sy=1+.012*s;p.antL=10*Math.sin(t*3);p.antR=-10*Math.sin(t*2.6);
   // 2.0: gözlük itme, 2.6: kulaklık düzeltme
   const g=Math.sin(Math.PI*clamp((t-1.9)/.55));const hp=Math.sin(Math.PI*clamp((t-2.55)/.6));
   p.aRu=lerp(8,128,g*0+0)+0;p.aRf=0; if(g>0){p.aRu=110*g;p.aRf=80*g;p.head=-6*g;p.glassY=-6*g;} if(hp>0){p.aLu=125*hp;p.aLf=70*hp;p.head=6*hp;p.hp=1+.12*hp;}
   p.mood=1;return p;},
 idle:(t)=>{const p=P0();const s=Math.sin(t*3);p.y=-4*Math.abs(s);p.sy=1+.01*s;p.aLu=20;p.aRu=20;p.mood=1;p.head=4*Math.sin(t*2);return p;},
 talk:(t)=>{const p=P0();const s=Math.sin(t*3.2);p.y=-6*Math.abs(Math.sin(t*5));p.rot=3*s;p.head=4*Math.sin(t*2.3);
   p.aLu=60+50*Math.sin(t*3.1);p.aRu=60+50*Math.sin(t*2.7+1.4);p.aLf=25*Math.sin(t*4);p.aRf=25*Math.sin(t*3.6);p.mood=1;p.antL=12*Math.sin(t*4);p.antR=-12*Math.sin(t*3.4);return p;},
 slide:(t,u)=>{const p=P0();p.rot=-14;p.sy=.92;p.sx=1.06;p.aLu=70;p.aRu=70;p.hL=24;p.kL=10;p.hR=-24;p.kR=10;p.head=-8;p.mood=1;p.glassY=0;p.antL=-20;p.antR=-20;return p;},
 scratch:(t)=>{const p=P0();const b=t*BEAT;const s=Math.sin(Math.PI*b),sc=Math.sin(2*Math.PI*b*2);
   p.y=-8*Math.abs(s);p.sy=.97+.03*Math.abs(s);p.head=-9*s;p.rot=3*s;p.aLu=40+8*sc;p.aLf=-35+16*sc;p.aRu=46;p.aRf=-36-14*sc;
   p.hL=5;p.hR=5;p.antL=12*Math.sin(2*Math.PI*b);p.antR=-12*Math.sin(2*Math.PI*b);p.chain=10*s;p.hp=1+.06*Math.abs(s);p.mood=1;return p;},
 dance:(t)=>dance(t,0,0,1.2),
 freeze:(t)=>{const p=P0();p.glassY=34;p.raise=-1.6;p.sy=1.02;p.x=1.5*Math.sin(t*50);p.aLu=40;p.aRu=130;p.aRf=30;p.hL=14;p.kL=-18;p.rot=-4;p.mood=2;p.antL=20;p.antR=-24;p.lid=-.1;return p;},
 gulp:(t)=>{const p=P0();p.glassY=28;p.raise=-1.2;p.mood=2;p.head=-10;p.sy=1+.03*Math.sin(t*30);p.aLu=10;p.aRu=12;p.antL=18;p.antR=-18;return p;},
 run:(t)=>{const p=P0();const f=t*14,s=Math.sin(f);p.y=-18*Math.abs(Math.sin(f*1));p.rot=12;p.hL=-34*Math.max(0,s);p.kL=60*Math.max(0,s);p.hR=-34*Math.max(0,-s);p.kR=60*Math.max(0,-s);p.aLu=70+50*s;p.aRu=70-50*s;p.aLf=30*s;p.aRf=-30*s;p.head=-4;p.antL=-26;p.antR=-26;p.mood=3;p.sy=.98;p.glassY=10;return p;},
 jump:(t,u)=>{const p=P0();p.sy=1+.12*Math.sin(Math.PI*u);p.sx=1-.06*Math.sin(Math.PI*u);p.aLu=150;p.aRu=150;p.hL=30;p.kL=-40;p.hR=30;p.kR=-40;p.rot=-360*0+ (u*0);p.antL=-30;p.antR=-30;p.mood=3;p.head=-10;return p;},
 hide:(t)=>{const p=P0();p.mood=3;return p;},
};
function poseMix(name,t,u){return (POSES[name]||POSES.idle)(t,u);}
function blend(a,b,u){const o={};for(const k in a)o[k]=lerp(a[k],b[k],u);return o;}
const MOODMAP={}; // dudak/ifade
function djPose(t){
  const pp=posOf(DJP,t); let p=poseMix(pp.state,t,pp.u);
  // durum geçişlerini yumuşat
  const idx=DJP.findIndex(k=>k[0]===pp.seg); if(idx>0){const prev=DJP[idx-1]; const u=clamp((t-pp.seg)/.18); if(u<1){p=blend(poseMix(prev[3],t,1),p,ss(u));}}
  // bölümler: gerçek akrobasi
  if(t>=33.2&&t<34.6){ /* yer koşusu */ }
  if(pp.state==='jump'&&pp.seg===32.9){p.rot=-360*eio(pp.u);}                  // havada takla
  if(pp.state==='jump'&&pp.seg===35.5){p.rot=360*eio(pp.u);}
  if(t>=36.1&&t<39.9){ p.aLu=150;p.aRu=150+20*Math.sin(t*20);p.aLf=-20;p.mood=3;p.glassY=18; if(t>=37.5&&t<38.2){p.aRu=60;p.aRf=80;} } // "müziği kısarım" ellerini kaldır
  if(pp.state==='slide'&&pp.seg===34.7){p.rot=-80;p.y+=40;}                    // yere yatıp kayma
  return {p,pp};
}
function bgPose(i,t){
  // arka plan dansçıları bağımsız: kendi faz ve stilleri
  const ph=[.0,.37,.71,.19][i], style=[0,1,2,3][i];
  if(t<9.4){return null;}                       // henüz gizli (sahne 1: yalnız DJ)
  if(t<18.96){return dance(t,ph,style,1.0+.2*Math.sin(t*.7+i));}
  if(t<31.2){const p=dance(18.96,ph,style,1.0); p.x=1.2*Math.sin(t*45+i); p.mood=2; p.glassY=28; p.lid=-.1; p.raise=-1.3; return p;}   // donmuş
  return null;
}
// ---- karakter yerleşimi (sahne 2-3: tabak üstünde) ----
const BG={b1:[1570,1000],b2:[1800,1000],b3:[2030,1000],b4:[2250,1000]};

// ---------- bakış, ağız ----------
function mouthOf(who,t){let m=0;D.lines.forEach(l=>{if(l.who!==who)return;const f=(t-l.start)*30;if(f<0||f>=l.m.length-1)return;const i=Math.floor(f);m=lerp(l.m[i],l.m[i+1],f-i);});return m;}
function activeLine(t){let s=null;D.lines.forEach(l=>{if(t>=l.start&&t<l.start+l.dur)s=l;});return s;}

// ---------- uygulama: böcek ----------
const EYE={L:{x:160,y:152,rx:24,ry:28},R:{x:240,y:152,rx:24,ry:28}};
function applyRoach(id,wrap,p,mo,opts={}){
  const {x,y,sc=1,full=true,visible=true,blinkPh=0,t=0,look=[0,0]}=opts;
  const el='#'+wrap;
  if(!visible){gsap.set(el,{opacity:0});return;}
  gsap.set(el,{opacity:1,x:x+p.x,y:y+p.y,rotation:p.rot,scaleX:sc*p.sx,scaleY:sc*p.sy});
  gsap.set('#'+id+'-head',{rotation:p.head,svgOrigin:'200 240'});
  gsap.set('#'+id+'-antL',{rotation:p.antL,svgOrigin:'176 100'});gsap.set('#'+id+'-antR',{rotation:p.antR,svgOrigin:'224 100'});
  gsap.set('#'+id+'-armL',{rotation:p.aLu,svgOrigin:'136 282'});gsap.set('#'+id+'-foreL',{rotation:-p.aLf,svgOrigin:'94 346'});
  gsap.set('#'+id+'-armR',{rotation:-p.aRu,svgOrigin:'264 282'});gsap.set('#'+id+'-foreR',{rotation:p.aRf,svgOrigin:'306 346'});
  gsap.set('#'+id+'-legL',{rotation:p.hL,svgOrigin:'165 396'});gsap.set('#'+id+'-shinL',{rotation:p.kL,svgOrigin:'152 492'});
  gsap.set('#'+id+'-legR',{rotation:-p.hR,svgOrigin:'235 396'});gsap.set('#'+id+'-shinR',{rotation:-p.kR,svgOrigin:'248 492'});
  gsap.set('#'+id+'-wings',{scaleX:1+.05*Math.sin(t*22)*p.wing,svgOrigin:'200 350'});
  if(full){gsap.set('#'+id+'-chain',{rotation:p.chain,svgOrigin:'200 262'});gsap.set('#'+id+'-hp',{scale:p.hp,svgOrigin:'200 150'});}
  const gl=document.getElementById(id+'-glasses'); if(gl)gsap.set(gl,{y:p.glassY,rotation:p.glassY>10?-3:0,svgOrigin:'200 150'});
  // gözler
  const blink=(()=>{const c=((t*.37+blinkPh)%1);return c<.045?Math.sin(Math.PI*c/.045):0;})();
  ['L','R'].forEach((s,i)=>{const c=EYE[s];
    gsap.set('#'+id+'-lid'+s,{scaleY:clamp(Math.max(blink,p.lid>0?p.lid:0)+(p.lid<0?p.lid:0),0,1),svgOrigin:c.x+' '+(c.y-c.ry-2)});
    gsap.set('#'+id+'-pup'+s,{x:look[0]*c.rx*.4+(p.mood===2?0:0),y:look[1]*c.ry*.4});
    const m=p.mood, base=m===3?-14:m===2?6:m===1?-6:0;
    gsap.set('#'+id+'-brow'+s,{rotation:(s==='L'?1:-1)*(base+p.raise*4),y:p.raise*14+(m===3?3:0),svgOrigin:(s==='L'?160:240)+' 112'});});
  const open=clamp(mo);
  gsap.set('#'+id+'-mouth',{scaleY:.06+open*.94,scaleX:1-.14*open,svgOrigin:'200 208',opacity:open>.06?1:0});
  gsap.set('#'+id+'-smile',{opacity:open>.06?0:1});
}
// ---------- uygulama: ev sahibi ----------
function applyHost(t){
  const hp=hostPos(t); const s=hp.state; const h='ho';
  const sc=.9, base=1700;
  let x=hp.x,y=0,rot=0,sx=1,sy=1,head=0,lid=.55,brow=-4,raise=0,mo=0,aLu=0,aLf=0,aRu=0,aRf=0,lL=0,lR=0,slip=0,lean=0;
  const m=mouthOf('ev',t);
  if(s==='away'){gsap.set('#host',{opacity:0});return;}
  const f=t*7;
  if(s==='enter'){ // uyku sersemi yürür, bir kolu anahtarda
    const sw=Math.sin(t*9);lL=22*sw;lR=-22*sw;y=-10*Math.abs(sw);aRu=170-Math.max(0,1-hp.u*1.2)*0;aRf=-20;lid=.7;brow=-6;rot=2*sw;
    gsap.set('#sw-t',{y:hp.u>.9?-12:0});}
  if(s==='idleH'){
    const u=(t-19.0);
    // ışık: gözlerini kısarak ovuşturur -> şaşırır -> sinirlenir
    const tr=t;
    lid=lerp(.85,.35,ss((tr-19.2)/1.2)); if(tr>20.2)lid=lerp(.35,-.05,ss((tr-20.4)/.5));
    brow=lerp(-8,6,ss((tr-20.4)/.4)); raise=tr>20.3&&tr<22?-.9:0;
    if(tr>25.6){brow=24;lid=.05;raise=.4;}
    aLu=tr<20?lerp(30,110,ss((tr-19.2)/.5)):20; aLf=tr<20?lerp(0,90,ss((tr-19.2)/.5)):0;      // elini gözüne siper
    aRu=tr<19.8?170:lerp(170,15,ss((tr-19.8)/.4));aRf=0;
    rot=1.6*Math.sin(t*1.7);y=-3*Math.abs(Math.sin(t*2));sy=1+.01*Math.sin(t*2.4);
    head=tr>25.6?-4:3*Math.sin(t*1.3);
    if(tr>25.6){aLu=40+20*Math.sin(t*3);aLf=30;aRu=60;aRf=20;}   // elleri belinde sinirli
    if(tr>20.3&&tr<21.8){rot=-5*Math.sin(Math.PI*(tr-20.3)/1.5);y-=14*Math.sin(Math.PI*(tr-20.3)/1.5);}
  }
  if(s==='grab'){ // eğilir, terliği alır
    const u=clamp((t-30.5)/.5);lean=18*Math.sin(Math.PI*u);y=0;lid=.05;brow=26;lL=0;lR=-30*Math.sin(Math.PI*u)*0;rot=lean*.6;aRu=lerp(15,150,eio(u));aRf=lerp(0,-40,eio(u));slip=u>.5?1:0;
    gsap.set('#ho-slipfoot',{opacity:u>.5?0:1});gsap.set('#ho-slipfoot2',{opacity:u>.5?0:1});}
  if(s==='chase'||s==='bang'){
    const sp=Math.sin(t*14);lL=26*sp;lR=-26*sp;y=-14*Math.abs(sp);rot=-8;lid=.02;brow=28;raise=.3;slip=1;head=-3;
    let wu=0;WHACK.forEach(w=>{const d=t-(w-.35);if(d>0&&d<.55)wu=Math.max(wu,d/.55);});
    // terlik savurma: yukarıdan aşağı hızlı
    aRu=lerp(150,40,wu>0?(wu<.55?eoc(wu/.55):1):0)+(wu>0?0:10*Math.sin(t*14));aRf=wu>0?lerp(-40,40,wu):0;
    aLu=40+20*Math.sin(t*14+1);aLf=20;
    if(wu>0)rot=-8-12*Math.sin(Math.PI*wu);
    gsap.set('#ho-slipfoot',{opacity:0});gsap.set('#ho-slipfoot2',{opacity:0});
    if(s==='bang'){rot=0;y=0;aRu=lerp(100,150,Math.abs(Math.sin(t*10)));}
  }
  if(t>=19.0&&s!=='chase'&&s!=='grab'){gsap.set('#ho-slipfoot',{opacity:1});gsap.set('#ho-slipfoot2',{opacity:1});}
  const open=clamp(m);
  gsap.set('#host',{opacity:1,x:x-260*sc,y:base-1140*sc+y,rotation:rot,scaleX:sc*sx,scaleY:sc*sy,transformOrigin:'50% 98%'});
  gsap.set('#'+h+'-head',{rotation:head,svgOrigin:'260 400'});
  gsap.set('#'+h+'-armL',{rotation:aLu,svgOrigin:'168 452'});gsap.set('#'+h+'-foreL',{rotation:-aLf,svgOrigin:'118 590'});
  gsap.set('#'+h+'-armR',{rotation:-aRu,svgOrigin:'352 452'});gsap.set('#'+h+'-foreR',{rotation:aRf,svgOrigin:'402 590'});
  gsap.set('#'+h+'-legL',{rotation:lL,svgOrigin:'214 640'});gsap.set('#'+h+'-legR',{rotation:lR,svgOrigin:'306 640'});
  gsap.set('#'+h+'-slip',{opacity:slip});
  const blink=(()=>{const c=((t*.29)%1);return c<.04?Math.sin(Math.PI*c/.04):0;})();
  ['L','R'].forEach(sd=>{gsap.set('#'+h+'-lid'+sd,{scaleY:clamp(Math.max(lid,blink),0,1),svgOrigin:(sd==='L'?222:298)+' 270'});
    gsap.set('#'+h+'-brow'+sd,{rotation:(sd==='L'?1:-1)*brow,y:raise*16,svgOrigin:(sd==='L'?222:298)+' 260'});
    gsap.set('#'+h+'-pup'+sd,{x:-2,y:2});});
  gsap.set('#'+h+'-mouth',{scaleY:.06+open*.94,scaleX:1-.1*open,svgOrigin:'260 372',opacity:open>.06?1:0});
  gsap.set('#'+h+'-smile',{opacity:open>.06?0:1,attr:{d:(s==='enter'||s==='idleH'&&t<20.3)?'M226 378 Q260 366 296 378':'M226 372 Q260 360 296 372'}});
}

// ================= kamera =================
// [t, cx, cy, zoom, süre, tür]   cx/cy sayı ya da 'dj'|'host'
const CAM=[
 [0,590,780,1.5,0,'e'],
 [1.0,640,760,1.45,1.4,'i'],
 [3.0,700,750,1.4,3.0,'i'],
 [6.0,900,800,1.1,3.0,'i'],
 [9.35,1000,780,1.4,.3,'o'],
 [10.1,1150,760,1.55,.5,'o'],
 [11.2,1150,640,2.1,.9,'i'],
 [14.4,1450,820,1.15,.5,'o'],
 [16.9,1150,760,1.5,.4,'o'],
 [17.8,1560,820,1.15,.8,'i'],
 [18.4,1900,950,1.2,.6,'o'],
 [19.0,1980,1000,1.3,.2,'o'],
 [19.6,2050,960,1.5,.8,'i'],
 [20.2,2050,1000,2.0,.5,'o'],
 [22.5,1170,740,1.7,.2,'o'],
 [24.8,1160,640,2.2,1.0,'i'],
 [25.65,2050,1020,2.2,.2,'o'],
 [26.9,1170,740,1.7,.2,'o'],
 [29.4,1560,900,1.0,1.0,'i'],
 [30.8,1980,950,1.25,.5,'o'],
 [31.2,'dj',0,1.3,.3,'f'],
 [33.0,'dj',0,1.5,.3,'f'],
 [35.0,'dj',0,1.25,.3,'f'],
 [37.2,'dj',0,1.4,.3,'f'],
 [39.0,'dj',0,1.2,.3,'f'],
 [40.1,500,760,1.8,.4,'o'],
 [40.6,520,780,2.0,.1,'o']
];
function camSym(v,t){ if(v==='dj')return posOf(DJP,t-.12); return {x:v,y:1000}; }
function camAt(t){ t=Math.max(0,t);
  let cur=null;
  for(let i=0;i<CAM.length;i++){
    const k=CAM[i]; if(t<k[0])break;
    const target=k[5]==='f'?(()=>{const q=posOf(DJP,t-.1);return [clamp(q.x,540/k[3],2400-540/k[3]),q.y-280,k[3]];})():[k[1],k[2],k[3]];
    const dur=k[4];
    const prev=i>0?(()=>{const pk=CAM[i-1];if(pk[5]==='f'){const q=posOf(DJP,k[0]-.1);return [clamp(q.x,540/pk[3],2400-540/pk[3]),q.y-280,pk[3]];}return [pk[1],pk[2],pk[3]];})():target;
    const uu=dur<=0?1:clamp((t-k[0])/dur);
    const e=k[5]==='o'||k[5]==='f'?eoc(uu):k[5]==='i'?eio(uu):uu;
    cur=[lerp(prev[0],target[0],e),lerp(prev[1],target[1],e),lerp(prev[2],target[2],e)];
    if(uu>=1)cur=target;
  }
  return cur;
}
const WH=[[1.0,.5],[9.4,1.4],[19.0,1.0],[40.5,1.2]].concat(WHACK.map(w=>[w,1.0]));
function renderAll(t){
  // ---- DJ (mutfak) ----
  const dj=djPose(t);
  const mo=mouthOf('dj',t);
  const speaking=mo>.04;
  // konuşurken ek hareket
  const p=dj.p; if(speaking){p.head+=3*Math.sin(t*7);p.y-=4*mo;p.aLu+=14*Math.sin(t*5)*mo;}
  const showKitchen=t<40.8;
  const hideDJ=(dj.pp.state==='hide'||t>40.75);
  applyRoach('dj','r-dj',p,Math.max(mo,0),{x:dj.pp.x-180,y:dj.pp.y-600*1,sc:1,full:true,visible:showKitchen&&!hideDJ&&!(t<1.0&&false),t,blinkPh:.2,look:[Math.sin(t*.8)*.4,.1]});
  // arka plan dansçıları
  ['b1','b2','b3','b4'].forEach((id,i)=>{
    const bp=bgPose(i,t); const base=BG[id];
    let vis=!!bp&&showKitchen;
    let x=base[0]-150,y=base[1]-600*.78;
    if(t>=31.2&&t<40.8){ // kaçışırlar
      const u=clamp((t-31.2-.1*i)/1.2); const tx=[-200,-250,2700,2700][i];
      const fx=[1100+i*60,700,2000,2600][i]; vis=u<1&&showKitchen; x=lerp(base[0],tx,eio(u))-150; y=base[1]-600*.78-80*Math.abs(Math.sin(u*Math.PI*6));
      if(vis){const pr=dance(t,.3*i,i,1.4);pr.mood=3;pr.glassY=0;pr.aLu=150;pr.aRu=150;applyRoach(id,'r-'+id,pr,0,{x:x,y:y,sc:.78,full:false,visible:true,t,blinkPh:.5*i});return;}
    }
    if(!bp){gsap.set('#r-'+id,{opacity:0});return;}
    applyRoach(id,'r-'+id,bp,0,{x:x,y:y,sc:.78,full:false,visible:vis,t,blinkPh:.3*i,look:[Math.sin(t+i)*.5,0]});
  });
  applyHost(t);
  gsap.set('#host',{zIndex:5});gsap.set('#r-dj',{zIndex:(t>32.9&&t<36.2)?9:1});
  // sahne 5 (buzdolabı içi)
  const in5=t>=40.8;
  const q=t-40.8;
  if(in5){
    const dpr=(t<42.0)?POSES.idle(t):POSES.talk(t);
    let pp=dpr;
    if(t>=49.0&&t<54){ pp=POSES.talk(t); const pt=ss((t-52.6)/.4); pp.aRu=lerp(pp.aRu,100,pt);pp.aRf=lerp(pp.aRf,10,pt);}
    if(t<42.0){pp=P0();pp.mood=1;pp.x=1.4*Math.sin(t*48);pp.aLu=30;pp.aRu=30;pp.hp=1;pp.glassY=8;}   // titreme (soğuk)
    // L9 sırasında soğuktan titrer, L10'da sinirli
    if(t>=42.0&&t<48){pp.x=(t<46?1.5:.4)*Math.sin(t*44);}
    if(t>=49&&t<53){pp.glassY=lerp(0,34,ss((t-52.2)/.5));pp.raise=lerp(0,-1.3,ss((t-52.2)/.5));}
    if(t>=53.9){pp.mood=2;pp.glassY=34;}
    const mo5=mouthOf('dj',t);
    applyRoach('fdj','r-fdj',pp,mo5,{x:420-180,y:1040-600,sc:1.0,full:true,visible:true,t,blinkPh:.4,look:[.3,0]});
    const bps=[[170,1040,.7,1],[780,1040,.7,2],[260,1040,.62,3]];
    ['f1','f2','f3'].forEach((id,i)=>{
      const b=bps[i];let pr=dance(t,[.1,.5,.8][i],[0,2,1][i],.7);
      const guilty=(i===1);
      if(guilty){pr=P0();pr.y=-3*Math.abs(Math.sin(t*10));pr.sy=1+.04*Math.sin(t*14);pr.head=10*Math.sin(t*11);pr.mood=1;pr.aLu=60;pr.aLf=40;pr.aRu=70;pr.aRf=70;pr.antL=10*Math.sin(t*6);
         if(t>=52.6){pr.mood=2;pr.head=-8;pr.x=2*Math.sin(t*40);pr.raise=-1;pr.lid=-.1;}}
      if(t<49.0){pr.x=1.2*Math.sin(t*42+i);}   // soğuktan titreme
      const cm=guilty?(.25+.25*Math.abs(Math.sin(t*14))):0;
      applyRoach(id,'r-'+id,pr,cm,{x:b[0]-150,y:b[1]-600*b[2],sc:b[2],full:false,visible:true,t,blinkPh:.2*i,look:[guilty?(t>52.4?-1:.6):.4,0]});
    });
    gsap.set('#fcrumbs',{opacity:t>49.5?1:0});
  } else { ['fdj','f1','f2','f3'].forEach(id=>gsap.set('#r-'+id,{opacity:0})); }
  // ---- kamera ----
  if(!in5){
    const c=camAt(t); const sway=[4*Math.sin(t*.9),3*Math.sin(t*1.3+1)];
    let sh=0;WH.forEach(([t0,a])=>{const u=t-t0;if(u>0&&u<.4)sh+=a*Math.sin(u*90)*(1-u/.4)*8;});
    const beatPulse=(t>9.4&&t<19.0)?.03*Math.pow(Math.max(0,Math.cos(Math.PI*((t*BEAT)%1))),6):0;
    const z=c[2]+beatPulse;
    const chase=t>=31.0&&t<40.6; const hs=chase?10*Math.sin(t*23)*Math.min(1,(t-31)/.5):0;
    gsap.set('#stage',{scale:z,x:540-(c[0]+sway[0]+sh)*z,y:640-(c[1]+sway[1]+sh+hs)*z,transformOrigin:'0 0'});
    // hareket bulanıklığı: kamera hızı
    const c2=camAt(t-.05); const sp=Math.hypot((c[0]-c2[0])*c[2],(c[1]-c2[1])*c[2])/.05;
    const blur=clamp((sp-900)/1400,0,1)*4+(chase?1.2:0);
    gsap.set('#stage',{filter:'blur('+blur.toFixed(2)+'px)'});
    gsap.set('#speed',{opacity:chase?.5:0,y:(t*1400)%60});
  } else {
    const q5=t-40.8; const z=1.0+.0*q5+(.22*ss((t-41)/13))+(t>53.9?.45*eoc((t-53.9)/.25):0)+(t>=49.0&&t<52?.08*ss((t-49)/1):0);
    let cx=540,cy=800; if(t>=53.9){cx=lerp(540,780,eoc((t-53.9)/.3));cy=840;} if(t>=49.0&&t<53.9){cy=780;}
    cx=clamp(cx,540/z,1080-540/z);gsap.set('#stage5',{opacity:1,scale:z,x:540-cx*z,y:640-cy*z,transformOrigin:'0 0'});
    gsap.set('#speed',{opacity:0});
  }
  gsap.set('#stage5',{opacity:in5?1:0});
  // ---- ışıklar ----
  const lightsOn=t>=19.0;
  const neon=(t>=8.0&&t<19.0)?1:0;
  let wI=0; if(t>=9.4&&t<19.0)wI=.55+.25*Math.pow(Math.max(0,Math.cos(Math.PI*((t*BEAT)%1))),4); else if(t>=7.6&&t<9.4)wI=(Math.sin(t*40)>0?.35:.05);
  const hue=(t*60)%360; const col1=['#b02cff','#2f7bff','#ff2a5a'][Math.floor((t*BEAT/2)%3)];
  gsap.set('#wash',{opacity:wI,background:'radial-gradient(ellipse 50% 40% at 50% 40%,'+col1+',rgba(0,0,0,0))'});
  for(let i=0;i<3;i++)gsap.set('#beam'+i,{opacity:neon?(.55+.2*Math.sin(t*3+i)):0,left:[900,1400,1900][i],rotation:35*Math.sin(t*1.7+i*2.1),background:'linear-gradient(rgba('+['190,60,255','60,140,255','255,60,100'][i]+',.7),rgba(0,0,0,0))'});
  const nightV=t<19.0?(.58-(t>=9.4?.12:0)):0;
  gsap.set('#night',{opacity:t<19.0?nightV:Math.max(0,.58*(1-ss((t-19.0)/.1)))});
  gsap.set('#lite',{opacity:t>=19.0&&t<40.8?.55:0});
  gsap.set('#flash',{opacity:Math.max(t>=9.4&&t<9.6?(1-(t-9.4)/.2)*.7:0,t>=19.0&&t<19.15?(1-(t-19)/.15)*.9:0,t>=40.5&&t<40.7?(1-(t-40.5)/.2)*.8:0)});
  gsap.set('#black',{opacity:t>=40.62&&t<40.82?1:0});
  gsap.set('#fglow',{background:'radial-gradient(ellipse 45% 30% at 50% 58%,rgba(180,80,255,.55),rgba(0,0,0,0))',opacity:.45+.2*Math.sin(t*6)});
  // plakalar, kaplar, saat
  for(let i=0;i<4;i++){const on=t>=9.4&&t<19.0;const cols=['#ff3fd0','#34c8ff','#ffd23f','#9d6bff'];const c=cols[(Math.floor(t*BEAT*2)+i)%4];gsap.set('#plate'+i,{background:on?'radial-gradient(#fff,'+c+')':'radial-gradient(#fff,#cfd6e8)',boxShadow:on?'0 0 26px '+c:'none'});}
  const spin=(t>=9.4&&t<19.0)?t*420:t>=19?0:t*20;gsap.set('#disc0',{rotation:spin});gsap.set('#disc1',{rotation:-spin*.9});
  gsap.set('#disc5a',{rotation:t*300});gsap.set('#disc5b',{rotation:-t*300});
  gsap.set('#ball',{rotation:t*60,opacity:neon?1:.6});
  // buzdolabı kapısı
  const open=t<39.9?0:ss((t-39.9)/.35); const closed=t>=40.45?1-ss((t-40.45)/.12):1;
  const door=t<39.9?1:(t<40.45?lerp(1,.1,open):lerp(.1,1,1-closed));
  gsap.set('#fr-door',{scaleX:Math.max(.05,door),transformOrigin:'0 50%'});gsap.set('#fr-int',{opacity:(t>=39.95&&t<40.5)?1:0});
  gsap.set('#fridge',{rotation:(t>=40.45&&t<40.9)?1.2*Math.sin((t-40.45)*60)*(1-(t-40.45)/.45):0});
  gsap.set('#clock',{color:t<19?'#ff3b5c':'#ff3b5c'});
  // altyazı
  D.lines.forEach((l,i)=>{const u=(t-l.start)/.2;gsap.set('#cap'+(i+1)+'-in',{scale:u<1?.8+.2*eob(u):1,opacity:clamp(u*3+.2)});});
  gsap.set('#title-t',{scale:.7+.3*eob(t/.4)});gsap.set('#title',{opacity:1-ss((t-2.6)/.5)});
}
window.__timelines=window.__timelines||{};
const tl=gsap.timeline({paused:true});
const proxy={v:0};
tl.to(proxy,{v:1,duration:DUR,ease:'none',onUpdate:()=>renderAll(tl.time())},0);
renderAll(0);
window.__timelines['main']=tl;
</script>
</body></html>`;
fs.writeFileSync("index.html", html);
console.log("index.html", html.length);
