// DJ HAMAM — ana karakter (v2). Tek kaynak: tüm bölümler bu dosyayı kullanır.
// viewBox 0 0 400 620, zemin y=604. İskelet pivotları (diğer bölümlerin rig'iyle uyumlu, DEĞİŞTİRME):
//   omuz L(136,282) R(264,282) | dirsek L(94,346) R(306,346) | kalça L(165,396) R(235,396)
//   diz L(152,492) R(248,492) | kafa(200,240) | anten L(176,100) R(224,100) | göz L(160,152) R(240,152)
//   ağız(200,208) | zincir(200,262) | kulaklık(200,150)
export const PALETTE = {
  shell: ["#c07a42", "#6a3418", "#2a1008"], belly: "#e0a35a", ink: "#1a0b12",
  neonPink: "#ff3fd0", neonCyan: "#34e0ff", neonViolet: "#8d5bff", gold: "#ffd23f", goldDark: "#8a5a00",
};
function d(side, ...a) { // sol -> sağ ayna
  let out = "", i = 0;
  while (i < a.length) { if (typeof a[i] === "string") { out += a[i] + " "; i++; } else { out += `${side === "L" ? a[i] : 400 - a[i]} ${a[i + 1]} `; i += 2; } }
  return out.trim();
}
const X = (s, x) => (s === "L" ? x : 400 - x);
const rot = (a, x, y) => (a ? ` transform="rotate(${a} ${x} ${y})"` : "");

/** pose: { head, antL, antR, armL, foreL, armR, foreR, legL, shinL, legR, shinR, glassY, mouth(0..1), brow(deg), browY, lidL, lidR, look:[x,y], hp, chain, bodyRot } */
export function djHamam(id = "dj", o = {}, pose = {}) {
  const P = PALETTE, acc = o.accent || P.neonPink, [c0, c1, c2] = P.shell;
  const g = `${id}-g`, h = `${id}-hg`, rim = `${id}-rim`, gold = `${id}-gold`, lensg = `${id}-lens`;
  const p = { head: 0, antL: 0, antR: 0, armL: 0, foreL: 0, armR: 0, foreR: 0, legL: 0, shinL: 0, legR: 0, shinR: 0, glassY: 0, mouth: 0, brow: -6, browY: 0, lidL: 0, lidR: 0, look: [0, 0], hp: 1, chain: 0, bodyRot: 0, ...pose };
  const m = p.mouth, mt = `translate(200 208) scale(${(1 - 0.14 * m).toFixed(3)} ${(0.06 + 0.94 * m).toFixed(3)}) translate(-200 -208)`;
  const spines = (s, pts) => pts.map(([x, y, a]) => `<path d="${d(s, "M", x, y, "L", x - 9, y + 3, "L", x - 2, y + 11, "Z")}" fill="#3a1c0c" stroke="${P.ink}" stroke-width="2" transform="rotate(${a} ${X(s, x)} ${y})"/>`).join("");
  const leg = (s) => {
    const hip = s === "L" ? p.legL : -p.legR, kn = s === "L" ? p.shinL : -p.shinR;
    return `<g id="${id}-leg${s}"${rot(hip, X(s, 165), 396)}>
     <path d="${d(s, "M", 165, 396, "L", 152, 492)}" stroke="${P.ink}" stroke-width="30" stroke-linecap="round" fill="none"/>
     <path d="${d(s, "M", 165, 396, "L", 152, 492)}" stroke="#4a220f" stroke-width="24" stroke-linecap="round" fill="none"/>
     <path d="${d(s, "M", 160, 402, "L", 149, 486)}" stroke="#9a5e30" stroke-width="8" stroke-linecap="round" fill="none"/>
     ${spines(s, [[176, 420, -10], [172, 446, -10], [166, 470, -10]])}
     <circle cx="${X(s, 152)}" cy="492" r="14" fill="#3a1c0c" stroke="${P.ink}" stroke-width="3"/>
     <g id="${id}-shin${s}"${rot(kn, X(s, 152), 492)}>
       <path d="${d(s, "M", 152, 492, "L", 150, 574)}" stroke="${P.ink}" stroke-width="25" stroke-linecap="round" fill="none"/>
       <path d="${d(s, "M", 152, 492, "L", 150, 574)}" stroke="#4a220f" stroke-width="19" stroke-linecap="round" fill="none"/>
       <path d="${d(s, "M", 148, 496, "L", 147, 570)}" stroke="#9a5e30" stroke-width="6" stroke-linecap="round" fill="none"/>
       ${spines(s, [[164, 512, -8], [163, 534, -8], [162, 556, -8]])}
       <path d="${d(s, "M", 128, 566, "C", 124, 548, 172, 544, 188, 560, "C", 204, 570, 208, 586, 198, 598, "L", 122, 598, "C", 112, 588, 116, 574, 128, 566, "Z")}" fill="${acc}" stroke="${P.ink}" stroke-width="4"/>
       <path d="${d(s, "M", 134, 568, "C", 140, 556, 166, 554, 180, 562)}" fill="none" stroke="#fff" stroke-width="4" opacity=".45" stroke-linecap="round"/>
       <path d="${d(s, "M", 116, 592, "L", 208, 592, "L", 208, 606, "L", 116, 606, "Z")}" fill="#fff" stroke="${P.ink}" stroke-width="4"/>
       <path d="${d(s, "M", 120, 600, "L", 204, 600)}" stroke="${P.neonCyan}" stroke-width="3" opacity=".9"/>
       <path d="${d(s, "M", 148, 556, "L", 172, 566, "M", 146, 566, "L", 170, 576, "M", 144, 576, "L", 166, 585)}" stroke="#fff" stroke-width="4" stroke-linecap="round" fill="none"/>
     </g></g>`;
  };
  const arm = (s) => {
    const up = s === "L" ? p.armL : -p.armR, fo = s === "L" ? -p.foreL : p.foreR;
    return `<g id="${id}-arm${s}"${rot(up, X(s, 136), 282)}>
     <path d="${d(s, "M", 136, 282, "L", 94, 346)}" stroke="${P.ink}" stroke-width="28" stroke-linecap="round" fill="none"/>
     <path d="${d(s, "M", 136, 282, "L", 94, 346)}" stroke="#4a220f" stroke-width="22" stroke-linecap="round" fill="none"/>
     <path d="${d(s, "M", 131, 286, "L", 91, 344)}" stroke="#9a5e30" stroke-width="7" stroke-linecap="round" fill="none"/>
     ${spines(s, [[124, 296, -50], [112, 314, -50], [102, 332, -50]])}
     <circle cx="${X(s, 94)}" cy="346" r="13" fill="#3a1c0c" stroke="${P.ink}" stroke-width="3"/>
     <g id="${id}-fore${s}"${rot(fo, X(s, 94), 346)}>
       <path d="${d(s, "M", 94, 346, "L", 82, 414)}" stroke="${P.ink}" stroke-width="23" stroke-linecap="round" fill="none"/>
       <path d="${d(s, "M", 94, 346, "L", 82, 414)}" stroke="#4a220f" stroke-width="17" stroke-linecap="round" fill="none"/>
       <path d="${d(s, "M", 90, 350, "L", 79, 411)}" stroke="#9a5e30" stroke-width="5" stroke-linecap="round" fill="none"/>
       <rect x="${s === "L" ? 62 : 400 - 100}" y="372" width="38" height="12" rx="6" fill="${P.gold}" stroke="${P.goldDark}" stroke-width="2" transform="rotate(${s === "L" ? -12 : 12} ${X(s, 82)} 378)"/>
       <ellipse cx="${X(s, 80)}" cy="424" rx="20" ry="18" fill="#4a220f" stroke="${P.ink}" stroke-width="3"/>
       <path d="${d(s, "M", 70, 436, "L", 61, 464, "M", 80, 441, "L", 78, 472, "M", 90, 436, "L", 95, 464)}" stroke="${P.ink}" stroke-width="10" stroke-linecap="round" fill="none"/>
       <path d="${d(s, "M", 70, 436, "L", 61, 464, "M", 80, 441, "L", 78, 472, "M", 90, 436, "L", 95, 464)}" stroke="#6a3418" stroke-width="5" stroke-linecap="round" fill="none"/>
     </g></g>`;
  };
  const ant = (s) => {
    const a = s === "L" ? p.antL : p.antR;
    let seg = ""; for (let i = 1; i <= 7; i++) { const t = i / 8; const x = (1 - t) * (1 - t) * 176 + 2 * (1 - t) * t * 150 + t * t * 82, y = (1 - t) * (1 - t) * 100 + 2 * (1 - t) * t * 20 + t * t * -24; seg += `<circle cx="${X(s, x).toFixed(1)}" cy="${y.toFixed(1)}" r="${(4.6 - t * 1.6).toFixed(1)}" fill="#4a220f" stroke="${P.ink}" stroke-width="1.5"/>`; }
    return `<g id="${id}-ant${s}"${rot(a, X(s, 176), 100)}><path d="${d(s, "M", 176, 100, "Q", 150, 20, 82, -24)}" stroke="${P.ink}" stroke-width="7" stroke-linecap="round" fill="none"/><path d="${d(s, "M", 176, 100, "Q", 150, 20, 82, -24)}" stroke="#6a3418" stroke-width="3.5" stroke-linecap="round" fill="none"/>${seg}<circle cx="${X(s, 82)}" cy="-24" r="9" fill="${acc}" stroke="${P.ink}" stroke-width="2.5"/><circle cx="${X(s, 79)}" cy="-27" r="3" fill="#fff" opacity=".8"/></g>`;
  };
  const eye = (s) => {
    const c = EYES[s], lid = s === "L" ? p.lidL : p.lidR;
    return `<g id="${id}-eye${s}"><ellipse cx="${c.x}" cy="${c.y}" rx="${c.rx}" ry="${c.ry}" fill="#fffdf4" stroke="${P.ink}" stroke-width="3"/>
     <g id="${id}-pup${s}" transform="translate(${p.look[0] * c.rx * 0.4} ${p.look[1] * c.ry * 0.4})"><circle cx="${c.x}" cy="${c.y}" r="14" fill="#2a1408"/><circle cx="${c.x}" cy="${c.y}" r="8" fill="#0c0508"/><circle cx="${c.x + 6}" cy="${c.y - 8}" r="4.5" fill="#fff"/><circle cx="${c.x - 5}" cy="${c.y + 7}" r="2.2" fill="#fff" opacity=".8"/></g>
     <ellipse id="${id}-lid${s}" cx="${c.x}" cy="${c.y}" rx="${c.rx + 2}" ry="${c.ry + 2}" fill="url(#${h})" stroke="${P.ink}" stroke-width="3" transform="translate(${c.x} ${c.y - c.ry - 2}) scale(1 ${lid}) translate(${-c.x} ${-(c.y - c.ry - 2)})"/></g>`;
  };
  const EYES = { L: { x: 160, y: 152, rx: 24, ry: 28 }, R: { x: 240, y: 152, rx: 24, ry: 28 } };
  const brow = (s) => `<g id="${id}-brow${s}" transform="translate(0 ${p.browY}) rotate(${(s === "L" ? 1 : -1) * p.brow} ${X(s, 160)} 112)"><path d="${d(s, "M", 124, 118, "Q", 160, 102, 198, 120)}" fill="none" stroke="${P.ink}" stroke-width="10" stroke-linecap="round"/><path d="${d(s, "M", 130, 114, "Q", 160, 104, 190, 116)}" fill="none" stroke="#5a2a14" stroke-width="3" stroke-linecap="round" opacity=".8"/></g>`;
  const bars = [10, 22, 14, 28, 18, 12].map((hgt, i) => `<rect x="${134 + i * 9}" y="${168 - hgt}" width="5" height="${hgt}" fill="${i % 2 ? P.neonCyan : acc}" opacity=".75"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" id="${id}-svg" viewBox="0 0 400 620" width="${o.w || 400}" height="${(o.w || 400) * 1.55}" style="overflow:visible">
  <defs>
   <radialGradient id="${g}" gradientUnits="userSpaceOnUse" cx="160" cy="270" r="230"><stop offset="0" stop-color="${c0}"/><stop offset=".5" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient>
   <radialGradient id="${h}" gradientUnits="userSpaceOnUse" cx="165" cy="125" r="115"><stop offset="0" stop-color="${c0}"/><stop offset=".6" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient>
   <linearGradient id="${rim}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${acc}"/><stop offset=".5" stop-color="${acc}" stop-opacity="0"/><stop offset=".5" stop-color="${P.neonCyan}" stop-opacity="0"/><stop offset="1" stop-color="${P.neonCyan}"/></linearGradient>
   <linearGradient id="${gold}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff6b0"/><stop offset=".5" stop-color="${P.gold}"/><stop offset="1" stop-color="#b87a00"/></linearGradient>
   <linearGradient id="${lensg}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a1250"/><stop offset=".5" stop-color="#0a0516"/><stop offset="1" stop-color="#05030c"/></linearGradient>
  </defs>
  <ellipse cx="200" cy="606" rx="140" ry="14" fill="#000" opacity=".4"/>
  <g transform="rotate(${p.bodyRot} 200 604)">
  ${leg("L")}${leg("R")}
  <g id="${id}-torso">
   <g id="${id}-wings">
    <path d="M132 256 C80 300 78 416 122 458 C152 404 152 322 142 262Z" fill="url(#${g})" stroke="${P.ink}" stroke-width="4"/>
    <path d="M268 256 C320 300 322 416 278 458 C248 404 248 322 258 262Z" fill="url(#${g})" stroke="${P.ink}" stroke-width="4"/>
    <path d="M118 290 C104 340 108 400 124 436 M104 300 C94 350 98 392 112 424 M282 290 C296 340 292 400 276 436 M296 300 C306 350 302 392 288 424" stroke="#2a1008" stroke-width="2.5" fill="none" opacity=".6"/>
    <path d="M100 318 C94 350 96 384 108 414" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".18" fill="none"/>
   </g>
   <path d="M200 224 C284 224 292 332 272 402 C252 456 148 456 128 402 C108 332 116 224 200 224Z" fill="url(#${g})" stroke="${P.ink}" stroke-width="5"/>
   <path d="M200 224 C284 224 292 332 272 402 C252 456 148 456 128 402 C108 332 116 224 200 224Z" fill="none" stroke="url(#${rim})" stroke-width="5" opacity=".7"/>
   <path d="M200 250 C254 250 260 330 246 390 C232 430 168 430 154 390 C140 330 146 250 200 250Z" fill="${P.belly}" opacity=".5"/>
   <path d="M150 292 Q200 304 250 292 M146 320 Q200 334 254 320 M148 348 Q200 362 252 348 M154 376 Q200 390 246 376 M166 404 Q200 416 234 404" fill="none" stroke="#7a4524" stroke-width="4.5" opacity=".85"/>
   <path d="M150 296 Q200 308 250 296 M146 324 Q200 338 254 324 M148 352 Q200 366 252 352" fill="none" stroke="#fff" stroke-width="1.5" opacity=".25"/>
   <path d="M144 266 C154 248 192 240 210 242 C170 252 152 284 148 322Z" fill="#fff" opacity=".28"/>
   <g id="${id}-chain"${rot(p.chain, 200, 262)}>
    <path d="M148 262 Q200 356 252 262" fill="none" stroke="#7a4a00" stroke-width="11" stroke-linecap="round"/>
    <path d="M148 262 Q200 356 252 262" fill="none" stroke="url(#${gold})" stroke-width="8" stroke-linecap="round"/>
    <path d="M148 262 Q200 356 252 262" fill="none" stroke="#a06a00" stroke-width="3" stroke-dasharray="3 9" stroke-linecap="round"/>
    <circle cx="200" cy="338" r="24" fill="url(#${gold})" stroke="${P.goldDark}" stroke-width="3.5"/>
    <circle cx="200" cy="338" r="18" fill="none" stroke="#a06a00" stroke-width="1.8"/>
    <text x="200" y="345" text-anchor="middle" font-family="Archivo Black,Impact,sans-serif" font-size="20" fill="#6a3c00">DJ</text>
    <circle cx="200" cy="314" r="5" fill="${acc}" stroke="#fff" stroke-width="1.5"/>
   </g>
  </g>
  ${arm("L")}${arm("R")}
  <g id="${id}-head"${rot(p.head, 200, 240)}>
   ${ant("L")}${ant("R")}
   <ellipse cx="200" cy="240" rx="88" ry="32" fill="url(#${g})" stroke="${P.ink}" stroke-width="4"/>
   <path d="M120 238 Q200 262 280 238" fill="none" stroke="#2a1008" stroke-width="3" opacity=".7"/>
   <ellipse cx="200" cy="158" rx="82" ry="74" fill="url(#${h})" stroke="${P.ink}" stroke-width="5"/>
   <ellipse cx="200" cy="158" rx="82" ry="74" fill="none" stroke="url(#${rim})" stroke-width="4" opacity=".65"/>
   <path d="M142 112 C158 90 196 84 218 88 C176 98 158 124 152 152Z" fill="#fff" opacity=".3"/>
   <path d="M232 100 C258 108 272 130 274 150" stroke="#fff" stroke-width="3" opacity=".2" fill="none"/>
   ${eye("L")}${eye("R")}${brow("L")}${brow("R")}
   <g id="${id}-glasses" transform="translate(0 ${p.glassY})${p.glassY > 10 ? " rotate(-3 200 150)" : ""}">
    <rect x="120" y="120" width="82" height="64" rx="28" fill="url(#${lensg})" stroke="${P.gold}" stroke-width="5"/>
    <rect x="198" y="120" width="82" height="64" rx="28" fill="url(#${lensg})" stroke="${P.gold}" stroke-width="5"/>
    <rect x="120" y="120" width="82" height="64" rx="28" fill="none" stroke="${P.goldDark}" stroke-width="1.5"/>
    <rect x="196" y="140" width="10" height="9" rx="3" fill="${P.gold}" stroke="${P.goldDark}" stroke-width="1.5"/>
    <g clip-path="inset(0)" opacity=".8">${bars}</g>
    <path d="M132 132 C150 124 176 124 192 132" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".6" fill="none"/>
    <path d="M210 132 C228 124 254 124 270 132" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".6" fill="none"/>
    <path d="M140 176 L172 150 M222 176 L254 150" stroke="${acc}" stroke-width="3" opacity=".5"/>
    <path d="M122 150 L108 146 M278 150 L292 146" stroke="${P.gold}" stroke-width="6" stroke-linecap="round"/>
   </g>
   <path id="${id}-smile" d="M168 212 Q200 232 234 208" fill="none" stroke="${P.ink}" stroke-width="6.5" stroke-linecap="round" opacity="${m > 0.06 ? 0 : 1}"/>
   <g id="${id}-mouth" transform="${mt}" opacity="${m > 0.06 ? 1 : 0}"><clipPath id="${id}-mc"><path d="M166 208 Q200 214 236 206 Q240 246 204 248 Q164 246 166 208Z"/></clipPath>
    <path d="M166 208 Q200 214 236 206 Q240 246 204 248 Q164 246 166 208Z" fill="#4a1020" stroke="${P.ink}" stroke-width="4" stroke-linejoin="round"/>
    <g clip-path="url(#${id}-mc)"><ellipse cx="204" cy="248" rx="28" ry="13" fill="#ff7a8a"/><rect x="168" y="206" width="70" height="8" fill="#fffbe8"/><rect x="204" y="206" width="11" height="10" rx="2" fill="url(#${gold})" stroke="${P.goldDark}" stroke-width="1"/></g></g>
   <path d="M174 222 Q166 236 172 244 M232 220 Q240 236 234 244" stroke="${P.ink}" stroke-width="6.5" stroke-linecap="round" fill="none"/>
   <g id="${id}-hp" transform="translate(200 150) scale(${p.hp}) translate(-200 -150)">
    <path d="M118 152 C110 50 290 50 282 152" fill="none" stroke="#120826" stroke-width="22" stroke-linecap="round"/>
    <path d="M118 152 C110 56 290 56 282 152" fill="none" stroke="#3a1c70" stroke-width="15" stroke-linecap="round"/>
    <path d="M120 150 C113 62 287 62 280 150" fill="none" stroke="${acc}" stroke-width="4.5" stroke-linecap="round"/>
    <ellipse cx="114" cy="160" rx="26" ry="42" fill="#30185a" stroke="#120826" stroke-width="5"/><ellipse cx="112" cy="160" rx="15" ry="29" fill="#1a0c34"/><ellipse cx="112" cy="160" rx="12" ry="25" fill="none" stroke="${acc}" stroke-width="3.5"/><circle cx="112" cy="160" r="5" fill="${P.neonCyan}"/>
    <ellipse cx="286" cy="160" rx="26" ry="42" fill="#30185a" stroke="#120826" stroke-width="5"/><ellipse cx="288" cy="160" rx="15" ry="29" fill="#1a0c34"/><ellipse cx="288" cy="160" rx="12" ry="25" fill="none" stroke="${acc}" stroke-width="3.5"/><circle cx="288" cy="160" r="5" fill="${P.neonCyan}"/>
    <path d="M96 190 C70 230 90 270 120 280" fill="none" stroke="#120826" stroke-width="4" stroke-linecap="round"/>
   </g>
  </g>
  </g>
  </svg>`;
}
