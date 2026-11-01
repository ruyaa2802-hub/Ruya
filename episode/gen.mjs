// Eşya Meclisi - Ayakkabılık bölümü: index.html üretici (Hyperframes kompozisyonu)
import fs from "node:fs";
const lips = JSON.parse(fs.readFileSync("assets/lips.json", "utf8"));

const LINES = [
  ["01-terlik", "terlik", "spor", "Gittiler mi? Gerçekten gittiler mi? Ay, bütün gün ezildim, belim kırıldı!"],
  ["02-spor", "spor", "terlik", "Sen mi ezildin? Ben bu sabah on kilometre koştum, tabanım duman!"],
  ["03-topuklu", "topuklu", "spor", "Aman Allah'ım, siz neyi dert ediyorsunuz? Ben dün gece düğünde sekiz saat dans ettim, topuğum ağlıyor!"],
  ["04-cizme", "cizme", "topuklu", "Susun artık! Ben kar kıyamette bile şikayet etmem!"],
  ["05-spor", "spor", "cizme", "Paşa, dışarıda otuz derece var, sen neden hâlâ buradasın?"],
  ["06-cizme", "cizme", "spor", "Hazırlıklı olmak şereftir evladım!"],
  ["07-terlik", "terlik", "topuklu", "Ya bırakın ya, en çok ben çalışıyorum. Tuvalete bile ben gidiyorum!"],
  ["08-topuklu", "topuklu", "terlik", "Of, ne kadar kaba!"],
  ["09-spor", "spor", "door", "Kapıdan ses geliyor!"],
  ["10-cizme", "cizme", "door", "Anahtar sesi! Herkes yerine!"],
  ["11-terlik", "terlik", "cam", "Ben zaten yerdeyim. Sürekli zaten yerdeyim."],
];
const NAMES = { terlik: "TERLİK", spor: "SPOR AYAKKABI", topuklu: "TOPUKLU", cizme: "ÇİZME PAŞA" };
const COL = { terlik: "#8fb8ff", spor: "#ff7a6b", topuklu: "#ff80cc", cizme: "#e0a468" };
const DUR = 47;

// ---------- karakter çizimleri (viewBox 400x400, zemin y=385) ----------
function eyes(k, e, o = {}) {
  const [x1, x2, y, rx = 30, ry = 36] = e;
  const one = (s, x) => `
  <g id="${k}-eye${s}">
    <ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#fffdf8" stroke="#2a1c2e" stroke-width="3"/>
    <g id="${k}-pup${s}"><circle cx="${x}" cy="${y}" r="${rx * 0.52}" fill="${o.iris || "#2a1c2e"}"/><circle cx="${x}" cy="${y}" r="${rx * 0.3}" fill="#120a14"/>
      <circle cx="${x + 6}" cy="${y - 8}" r="${rx * 0.17}" fill="#fff"/><circle cx="${x - 5}" cy="${y + 7}" r="${rx * 0.09}" fill="#fff" opacity=".8"/></g>
    <ellipse id="${k}-lid${s}" cx="${x}" cy="${y}" rx="${rx + 2}" ry="${ry + 2}" fill="url(#${k}-g)" stroke="#2a1c2e" stroke-width="3"/>
  </g>`;
  const brow = (s, x, dir) => `<g id="${k}-brow${s}"><path d="M${x - 30} ${y - ry - 12} Q${x} ${y - ry - 24} ${x + 30} ${y - ry - 12}" fill="none" stroke="${o.brow || "#2a1c2e"}" stroke-width="${o.bw || 7}" stroke-linecap="round"/></g>`;
  return one("L", x1) + one("R", x2) + brow("L", x1, 1) + brow("R", x2, -1);
}
function mouth(k, mx, my, w, h, o = {}) {
  const path = `M${mx - w} ${my} Q${mx} ${my + 4} ${mx + w} ${my} Q${mx + w * 0.95} ${my + h} ${mx} ${my + h} Q${mx - w * 0.95} ${my + h} ${mx - w} ${my}Z`;
  return `
  <path id="${k}-smile" d="M${mx - w} ${my - 2} Q${mx} ${my + 16} ${mx + w} ${my - 2}" fill="none" stroke="#2a1c2e" stroke-width="6" stroke-linecap="round"/>
  <g id="${k}-mouth">
    <clipPath id="${k}-mc"><path d="${path}"/></clipPath>
    <path d="${path}" fill="#4a1226" stroke="#2a1c2e" stroke-width="4" stroke-linejoin="round"/>
    <g clip-path="url(#${k}-mc)"><ellipse cx="${mx}" cy="${my + h}" rx="${w * 0.7}" ry="${h * 0.45}" fill="#ff7a8a"/>
    ${o.teeth ? `<rect x="${mx - w * 0.8}" y="${my - 2}" width="${w * 1.6}" height="${h * 0.22}" fill="#fff"/>` : ""}</g>
  </g>`;
}
const grad = (k, c0, c1, c2, cx = 200, cy = 190, r = 240) =>
  `<radialGradient id="${k}-g" gradientUnits="userSpaceOnUse" cx="${cx - 40}" cy="${cy - 50}" r="${r}"><stop offset="0" stop-color="${c0}"/><stop offset=".55" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient>`;
const shadow = `<ellipse cx="200" cy="388" rx="160" ry="14" fill="#000" opacity=".28"/>`;
const drop = (k) => `<path id="${k}-drop" d="M355 70 C340 100 335 118 355 128 C375 118 370 100 355 70Z" fill="#8fe0ff" stroke="#2a7fa8" stroke-width="3" opacity="0"/>`;
const gloss = (d) => `<path d="${d}" fill="#fff" opacity=".28"/>`;

function terlik() {
  const k = "terlik";
  let fuzz = "";
  for (let i = 0; i < 26; i++) {
    const a = Math.PI * (1.02 + (i / 25) * 0.96);
    const x = 200 + Math.cos(a) * 160 * (1 + 0.04 * Math.sin(i * 3)), y = 250 + Math.sin(a) * 128;
    fuzz += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(12 + (i % 3) * 3)}" fill="#a9c8ff" stroke="#5f84d8" stroke-width="2"/>`;
  }
  return `<svg id="${k}-svg" viewBox="0 0 400 400" width="340" height="340"><defs>${grad(k, "#b5d2ff", "#6f98f2", "#3354b4")}</defs>
  ${shadow}
  <path d="M30 338 C55 378 345 378 370 338 L372 356 C345 396 55 396 28 356Z" fill="#26346f"/>
  <path d="M42 338 C22 240 70 130 200 118 C330 130 378 240 358 338 C320 372 80 372 42 338Z" fill="url(#${k}-g)" stroke="#2a3a80" stroke-width="4"/>
  ${fuzz}
  <ellipse cx="200" cy="158" rx="96" ry="26" fill="#1b2660" stroke="#a9c8ff" stroke-width="8"/>
  ${gloss("M95 210 C110 170 150 150 190 148 C140 165 112 195 105 235Z")}
  <ellipse cx="108" cy="285" rx="22" ry="14" fill="#ff8fa8" opacity=".55"/><ellipse cx="292" cy="285" rx="22" ry="14" fill="#ff8fa8" opacity=".55"/>
  ${eyes(k, [150, 250, 228, 30, 36])}${mouth(k, 200, 292, 30, 34)}${drop(k)}</svg>`;
}
function spor() {
  const k = "spor";
  return `<svg id="${k}-svg" viewBox="0 0 400 400" width="340" height="340"><defs>${grad(k, "#ff9a86", "#e83a3a", "#a01a28")}</defs>
  ${shadow}
  <path d="M30 330 L372 330 C380 362 370 392 345 392 L55 392 C30 392 22 362 30 330Z" fill="#fff" stroke="#2a1c2e" stroke-width="4"/>
  <path d="M28 362 L376 362" stroke="#e83a3a" stroke-width="8"/>
  <path d="M42 340 C28 250 58 212 122 202 C150 196 168 150 192 120 C220 92 262 100 280 140 C298 190 352 212 362 270 C370 316 366 336 362 342Z" fill="url(#${k}-g)" stroke="#2a1c2e" stroke-width="4"/>
  <path d="M42 340 C32 280 56 242 108 236 L110 342Z" fill="#fff" stroke="#2a1c2e" stroke-width="3"/>
  <path d="M185 125 C200 110 240 112 262 142" fill="none" stroke="#2a1c2e" stroke-width="4"/>
  <g fill="#fff" stroke="#2a1c2e" stroke-width="3"><rect x="196" y="128" width="46" height="13" rx="6" transform="rotate(28 219 134)"/><rect x="214" y="150" width="46" height="13" rx="6" transform="rotate(34 237 156)"/><rect x="236" y="176" width="46" height="13" rx="6" transform="rotate(30 259 182)"/></g>
  <path d="M310 250 L338 250 L320 285 L342 285 L300 340 L310 296 L292 296Z" fill="#ffd23f" stroke="#2a1c2e" stroke-width="3"/>
  ${gloss("M78 258 C90 232 120 220 150 216 C112 232 98 258 96 290Z")}
  <ellipse cx="148" cy="296" rx="18" ry="11" fill="#ffb0a0" opacity=".6"/>
  ${eyes(k, [165, 250, 244, 28, 33])}${mouth(k, 208, 300, 30, 36, { teeth: true })}${drop(k)}</svg>`;
}
function topuklu() {
  const k = "topuklu";
  return `<svg id="${k}-svg" viewBox="0 0 400 400" width="340" height="340"><defs>${grad(k, "#ffb0dd", "#ee4aa4", "#9c1e68", 160, 270, 240)}</defs>
  ${shadow}
  <path d="M296 262 L336 262 L352 388 L338 388 L320 300Z" fill="#8d1a5c" stroke="#2a1c2e" stroke-width="3"/>
  <path d="M26 352 C14 300 46 226 118 214 C176 206 214 180 252 134 C278 104 326 100 350 128 C358 170 336 214 322 250 C312 282 312 318 296 352 C200 376 100 376 26 352Z" fill="url(#${k}-g)" stroke="#2a1c2e" stroke-width="4"/>
  <path d="M26 352 C100 376 200 376 296 352 L296 362 C200 388 100 388 26 364Z" fill="#7a1650"/>
  <g transform="translate(84 226)"><path d="M0 0 C-30 -26 -34 12 0 6 C34 12 30 -26 0 0Z" fill="#ff5fb8" stroke="#2a1c2e" stroke-width="3"/><circle cx="0" cy="3" r="8" fill="#ffd23f" stroke="#2a1c2e" stroke-width="2"/></g>
  ${gloss("M60 300 C66 262 100 238 150 232 C106 252 86 282 84 318Z")}
  <path d="M232 160 C262 130 296 120 324 138" fill="none" stroke="#ffd0ea" stroke-width="6" opacity=".6" stroke-linecap="round"/>
  <ellipse cx="62" cy="318" rx="16" ry="10" fill="#ffd0e6" opacity=".6"/><ellipse cx="196" cy="318" rx="16" ry="10" fill="#ffd0e6" opacity=".6"/>
  ${eyes(k, [100, 174, 272, 26, 32], { bw: 6 })}
  <g stroke="#2a1c2e" stroke-width="4" stroke-linecap="round"><path d="M66 250 L52 240 M74 242 L66 228 M200 250 L214 240 M192 242 L200 228"/></g>
  ${mouth(k, 138, 330, 26, 28)}
  <path d="M110 330 Q138 322 166 330 Q138 340 110 330Z" fill="#e0103c" stroke="#2a1c2e" stroke-width="3" opacity=".9" id="${k}-lips"/>${drop(k)}</svg>`;
}
function cizme() {
  const k = "cizme";
  return `<svg id="${k}-svg" viewBox="0 0 400 400" width="340" height="340"><defs>${grad(k, "#c98a58", "#8a5230", "#4d2c18", 210, 190, 260)}</defs>
  ${shadow}
  <path d="M118 46 C118 34 130 28 148 28 L270 28 C288 28 298 38 298 52 L306 280 C336 292 356 310 356 346 C356 372 342 386 322 386 L60 386 C34 386 22 370 24 346 C28 310 62 290 114 282Z" fill="url(#${k}-g)" stroke="#2a1c2e" stroke-width="4"/>
  <path d="M120 40 C120 32 130 26 148 26 L270 26 C288 26 296 34 297 46 L299 92 L118 92Z" fill="#c9a074" stroke="#2a1c2e" stroke-width="4"/>
  <path d="M124 82 L296 82" stroke="#6b4325" stroke-width="3" stroke-dasharray="9 7"/>
  <path d="M28 358 L350 358 L352 386 L324 388 L62 388 C34 388 24 372 28 358Z" fill="#2c1a10" stroke="#2a1c2e" stroke-width="3"/>
  <path d="M112 292 L306 292 L304 318 L110 318Z" fill="#6a3f22" stroke="#2a1c2e" stroke-width="3"/><rect x="190" y="288" width="34" height="34" rx="6" fill="#ffd23f" stroke="#2a1c2e" stroke-width="3"/><rect x="199" y="298" width="16" height="14" rx="3" fill="#8a5230"/>
  <path d="M60 330 l16 -6 M90 340 l14 -4 M248 344 l18 -4" stroke="#4d2c18" stroke-width="3" stroke-linecap="round"/>
  ${gloss("M140 120 C146 100 160 100 168 102 C162 170 160 230 166 270 C146 250 138 190 140 120Z")}
  <ellipse cx="146" cy="215" rx="16" ry="10" fill="#e8907a" opacity=".55"/><ellipse cx="282" cy="215" rx="16" ry="10" fill="#e8907a" opacity=".55"/>
  ${eyes(k, [180, 250, 150, 26, 32], { bw: 11, brow: "#3a2012" })}
  ${mouth(k, 214, 246, 30, 34, { teeth: false })}
  <path d="M214 224 C196 208 168 214 160 232 C176 222 194 224 214 234 C234 224 252 222 268 232 C260 214 232 208 214 224Z" fill="#3a2012" stroke="#2a1c2e" stroke-width="2"/>
  ${drop(k)}</svg>`;
}

// ---------- sahne ----------
const SLOT = { cizme: [300, 840], topuklu: [760, 840], terlik: [300, 1200], spor: [760, 1200] };
const chars = { terlik, spor, topuklu, cizme };
const charDivs = Object.keys(chars).map((k) => {
  const [cx, base] = SLOT[k];
  return `<div id="ch-${k}" class="char" style="left:${cx - 170}px;top:${base - 327}px">${chars[k]()}</div>`;
}).join("\n");

const caps = LINES.map((l, i) => {
  const s = lips[l[0]].start, nxt = i + 1 < LINES.length ? lips[LINES[i + 1][0]].start : s + lips[l[0]].dur + 0.2;
  const end = i === LINES.length - 1 ? s + lips[l[0]].dur + 0.2 : Math.max(nxt, s + 0.4);
  return `<div id="cap${i + 1}" class="clip cap" data-start="${s.toFixed(2)}" data-duration="${(end - s).toFixed(2)}" data-track-index="3"><div class="cap-in" id="cap${i + 1}-in"><div class="who" style="background:${COL[l[1]]}">${NAMES[l[1]]}</div><div class="txt">${l[3]}</div></div></div>`;
}).join("\n");

const data = {
  lines: LINES.map((l, i) => ({ id: l[0], who: l[1], to: l[2], start: lips[l[0]].start, dur: lips[l[0]].dur, m: lips[l[0]].m })),
};

const html = `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=1080, height=1920">
<title>Eşya Meclisi - Ayakkabılık</title>
<style>
  html,body{margin:0;background:#1b1426;}
  #root{position:relative;width:1080px;height:1920px;overflow:hidden;background:#1b1426;font-family:'Nunito',sans-serif;}
  #stage{position:absolute;left:0;top:0;width:1080px;height:2300px;transform-origin:0 0;}
  .abs{position:absolute;}
  #wall{left:0;top:0;width:1080px;height:1260px;background:linear-gradient(#f6e6c9,#ead2a8);}
  #wallpaper{left:0;top:0;width:1080px;height:1260px;opacity:.5;background:repeating-linear-gradient(90deg,transparent 0 78px,rgba(190,140,90,.18) 78px 82px);}
  #floor{left:0;top:1250px;width:1080px;height:1100px;background:repeating-linear-gradient(0deg,#b97f4d 0 110px,#a9703f 110px 114px);}
  #floorshade{left:0;top:1250px;width:1080px;height:260px;background:linear-gradient(rgba(40,20,10,.45),rgba(40,20,10,0));}
  #rug{left:150px;top:1420px;width:780px;height:300px;border-radius:50%;background:radial-gradient(#ff9a7a,#d9544a 70%,#a53a3a);box-shadow:0 10px 0 rgba(0,0,0,.18);}
  .char{position:absolute;width:340px;height:340px;transform-origin:50% 96%;}
  .char svg{display:block;overflow:visible;}
  #cab{left:40px;top:500px;width:1000px;height:790px;}
  .board{position:absolute;left:0;width:1000px;background:linear-gradient(#e0a870,#b97a45);border:5px solid #6a3f22;box-sizing:border-box;border-radius:10px;}
  .side{position:absolute;top:0;width:44px;height:790px;background:linear-gradient(90deg,#c88c55,#9a6234);border:5px solid #6a3f22;box-sizing:border-box;border-radius:8px;}
  .back{position:absolute;left:40px;width:920px;background:linear-gradient(#5b3820,#7a4d2c);box-shadow:inset 0 30px 40px rgba(0,0,0,.35);}
  #door{left:170px;top:0;width:740px;height:540px;background:linear-gradient(#8a5430,#6a3f22);border:14px solid #4c2c16;box-sizing:border-box;border-radius:6px 6px 0 0;}
  #glass{left:320px;top:90px;width:440px;height:230px;background:linear-gradient(#bfe6ff,#e8f6ff);border:12px solid #4c2c16;box-sizing:border-box;border-radius:8px;overflow:hidden;}
  #glass i{position:absolute;top:0;bottom:0;width:8px;background:#4c2c16;}
  #glow{left:0;top:0;width:1080px;height:1300px;opacity:0;background:radial-gradient(ellipse 60% 70% at 50% 0%,rgba(255,244,200,.95),rgba(255,230,160,.35) 55%,rgba(255,230,160,0));mix-blend-mode:screen;}
  #shadowhum{left:200px;top:0;width:700px;height:1400px;opacity:0;}
  #vig{position:absolute;left:0;top:0;width:1080px;height:1920px;pointer-events:none;background:radial-gradient(ellipse 75% 62% at 50% 40%,rgba(0,0,0,0) 55%,rgba(20,8,30,.55));z-index:50;}
  #title{position:absolute;left:0;top:190px;width:1080px;text-align:center;z-index:60;}
  #title .t{display:inline-block;font:900 62px 'Nunito',sans-serif;color:#fff;letter-spacing:2px;-webkit-text-stroke:10px #2a1840;paint-order:stroke fill;padding:6px 26px;background:#ff7a3d;border-radius:22px;box-shadow:0 8px 0 #2a1840;}
  #title .s{margin-top:18px;font:800 34px 'Nunito',sans-serif;color:#fff3d6;-webkit-text-stroke:7px #2a1840;paint-order:stroke fill;}
  .cap{position:absolute;left:60px;top:1128px;width:960px;z-index:70;text-align:center;}
  .cap-in{display:inline-block;transform-origin:50% 100%;}
  .who{display:inline-block;font:900 28px 'Nunito',sans-serif;color:#2a1840;padding:2px 18px;border-radius:14px;margin-bottom:6px;border:4px solid #2a1840;}
  .txt{font:900 50px/1.16 'Nunito',sans-serif;color:#fff;-webkit-text-stroke:9px #2a1840;paint-order:stroke fill;text-shadow:0 5px 0 #2a1840;}
</style></head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="${DUR}" data-width="1080" data-height="1920">

  <div id="stage" class="clip" data-start="0" data-duration="${DUR}" data-track-index="1" data-layout-ignore>
    <div id="wall" class="abs"></div><div id="wallpaper" class="abs"></div>
    <div id="door" class="abs"></div>
    <div id="glass" class="abs"><i style="left:140px"></i><i style="left:290px"></i></div>
    <div class="abs" style="left:380px;top:360px;width:30px;height:30px;border-radius:50%;background:#2a1c10;border:5px solid #d4a24a"></div>
    <div class="abs" style="left:810px;top:300px;width:34px;height:130px;border-radius:17px;background:linear-gradient(90deg,#ffe28a,#c4902a);border:4px solid #7a5418"></div>
    <div class="abs" style="left:770px;top:210px;width:90px;height:34px;border-radius:8px;background:#d4a24a;border:4px solid #7a5418;color:#4c2c16;font:900 22px 'Nunito';text-align:center;line-height:30px">No:7</div>
    <!-- askılık: mont ve çanta -->
    <div class="abs" style="left:40px;top:90px;width:100px;height:14px;background:#6a3f22;border-radius:7px"></div>
    <div class="abs" id="jacket" style="left:44px;top:100px;width:100px;height:330px;background:linear-gradient(90deg,#3a6fd8,#2b4fa8);border-radius:20px 20px 40px 40px;border:4px solid #1f3770;transform-origin:50% 0"></div>
    <div class="abs" style="left:950px;top:90px;width:90px;height:14px;background:#6a3f22;border-radius:7px"></div>
    <div class="abs" id="bag" style="left:958px;top:104px;width:78px;height:210px;background:linear-gradient(90deg,#ffb347,#e0852a);border-radius:12px 12px 30px 30px;border:4px solid #8a5418;transform-origin:50% 0"></div>
    <div id="glow" class="abs"></div>

    <div id="cab" class="abs">
      <div class="back" style="top:30px;height:320px"></div><div class="back" style="top:390px;height:320px"></div>
      <div class="side" style="left:0"></div><div class="side" style="right:0"></div>
      <div class="board" style="top:0;height:42px"></div>
      <div class="board" style="top:340px;height:42px"></div>
      <div class="board" style="top:700px;height:50px"></div>
      <div class="abs" style="left:60px;top:750px;width:46px;height:44px;background:#6a3f22;border-radius:0 0 8px 8px"></div>
      <div class="abs" style="right:60px;top:750px;width:46px;height:44px;background:#6a3f22;border-radius:0 0 8px 8px"></div>
    </div>
    <!-- dolap üstü: anahtar kasesi + saksı -->
    <div class="abs" style="left:120px;top:462px;width:140px;height:44px;border-radius:0 0 60px 60px;background:linear-gradient(#f2f2f2,#c9c9d8);border:4px solid #7b7b95"></div>
    <div class="abs" style="left:150px;top:440px;width:24px;height:30px;border-radius:50%;border:6px solid #d4a24a"></div>
    <div class="abs" style="left:196px;top:446px;width:24px;height:28px;border-radius:50%;border:6px solid #c0c0c8"></div>
    <div class="abs" id="plant" style="left:830px;top:330px;width:130px;height:170px;transform-origin:50% 100%">
      <div class="abs" style="left:10px;top:0;width:44px;height:130px;border-radius:50% 50% 50% 50%;background:#4aa84a;transform:rotate(-20deg);border:4px solid #2d6e2d"></div>
      <div class="abs" style="left:46px;top:-18px;width:42px;height:150px;border-radius:50%;background:#5cc25c;border:4px solid #2d6e2d"></div>
      <div class="abs" style="left:80px;top:6px;width:42px;height:126px;border-radius:50%;background:#4aa84a;transform:rotate(22deg);border:4px solid #2d6e2d"></div>
      <div class="abs" style="left:14px;top:112px;width:102px;height:60px;background:linear-gradient(#e87a50,#b8502a);border-radius:6px 6px 22px 22px;border:4px solid #7a3016"></div>
    </div>

    ${charDivs}

    <div id="floor" class="abs"></div><div id="floorshade" class="abs"></div>
    <div id="rug" class="abs"></div>
    <div id="shadowhum" class="abs"><svg viewBox="0 0 700 1400" width="700" height="1400" style="overflow:visible">
      <path d="M130 0 L330 0 L300 760 C330 800 330 900 240 930 C150 930 120 840 160 790Z" fill="#120a20"/>
      <path d="M390 0 L580 0 L540 700 C600 760 600 880 500 910 C400 910 370 820 410 760Z" fill="#120a20"/></svg></div>
  </div>

  <div id="title" class="clip" data-start="0" data-duration="3.6" data-track-index="4"><div class="t" id="title-t">EŞYA MECLİSİ</div><div class="s" id="title-s">İnsanlar gidince…</div></div>
  ${caps}
  <div id="vig"></div>
  <audio id="master" src="assets/master.wav" data-start="0" data-duration="${DUR}" data-volume="1"></audio>
</div>

<script src="assets/gsap.min.js"></script>
<script>
const D = ${JSON.stringify(data)};
const DUR = ${DUR};
const POS = {terlik:[300,1050], spor:[760,1050], topuklu:[760,690], cizme:[300,690], door:[540,150], cam:[540,1150]};
const KEYS = Object.keys(POS).slice(0,4);
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x)), lerp=(a,b,u)=>a+(b-a)*u;
const ss=(x)=>{x=clamp(x);return x*x*(3-2*x);}, eoc=(x)=>1-Math.pow(1-clamp(x),3), eio=(x)=>{x=clamp(x);return x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;};
const eob=(x)=>{x=clamp(x);const c1=1.9,c3=c1+1;return 1+c3*Math.pow(x-1,3)+c1*Math.pow(x-1,2);};
const bump=(t,t0,d)=>{const u=(t-t0);if(u<0||u>d)return 0;return Math.sin(Math.PI*clamp(u/d));};
const hold=(t,t0,d,a=.1,r=.25)=>clamp((t-t0)/a)*clamp((t0+d-t)/r);
// seçilmiş sahte rastgele (tekrarlanabilir)
function rnd(s){s=Math.sin(s*127.1+311.7)*43758.5453;return s-Math.floor(s);}
// ---- kamera kareleri: [başlangıç, cx, cy, zoom, geçiş süresi, tür]
const CAM=[
 [0,540,880,1,0,'e'],
 [1.1,330,1010,1.5,1.3,'i'],
 [3.0,330,1000,1.75,5.2,'i'],
 [8.05,760,1030,1.7,0.28,'o'],
 [11.3,760,1030,2.15,0.35,'o'],
 [12.25,760,660,1.8,0.3,'o'],
 [16.6,760,640,2.25,0.4,'o'],
 [17.55,330,660,1.85,0.28,'o'],
 [19.3,330,650,2.2,0.4,'o'],
 [22.35,760,1020,1.65,0.3,'o'],
 [24.3,330,640,1.9,0.3,'o'],
 [25.85,330,650,2.05,2.2,'i'],
 [27.95,330,1020,1.7,0.3,'o'],
 [31.2,330,1020,2.2,0.45,'o'],
 [32.95,760,670,2.35,0.22,'o'],
 [34.35,760,1030,1.85,0.25,'o'],
 [35.5,540,880,1.15,0.4,'o'],
 [36.6,540,860,1.0,0.5,'i'],
 [39.9,330,1030,1.9,0.9,'i'],
 [44.2,330,1030,2.3,0.6,'i'],
 [44.9,540,900,1.0,0.5,'o']
];
function cam(t){
  let cur=CAM[0].slice(1,4);
  for(let i=1;i<CAM.length;i++){
    const k=CAM[i]; if(t<k[0])break;
    const prev=CAM[i-1]; const from=[prev[1],prev[2],prev[3]];
    const u=k[4]<=0?1:clamp((t-k[0])/k[4]);
    const e=k[5]==='o'?eoc(u):k[5]==='i'?eio(u):u;
    cur=[lerp(from[0],k[1],e),lerp(from[1],k[2],e),lerp(from[2],k[3],e)];
    if(u>=1)cur=[k[1],k[2],k[3]];
  }
  return cur;
}
// ---- karakter olayları [tür, başlangıç, süre]
const EV={
 terlik:[['yawn',1.0,0.9],['shock',8.2,0.8],['giggle',24.0,1.6],['giggle',33.3,1.6],['alert',34.4,1.4],['hop',37.2,0.5],['stare',38.05,9]],
 spor:[['hop',8.1,0.55],['hop',12.0,0.4],['giggle',18.4,1.6],['giggle',26.2,1.8],['giggle',33.3,0.9],['alert',34.4,0.1],['hop',37.0,0.5],['stare',38.05,9]],
 topuklu:[['roll',9.9,1.1],['shock',17.7,0.9],['angry',28.4,3.5],['hop',37.4,0.5],['stare',38.05,9],['faint',33.0,0.1]],
 cizme:[['angry',1.8,5.5],['shake',17.6,1.4],['puff',25.9,1.6],['angry',28.4,4.0],['shake',35.6,1.2],['hop',37.1,0.5],['stare',38.05,9]]
};
const BASE={terlik:{lid:.4,brow:-5},spor:{lid:.05,brow:0},topuklu:{lid:.1,brow:0},cizme:{lid:.12,brow:8}};
const BLINK={};
KEYS.forEach((k,ci)=>{let t=1.2+ci*.7;BLINK[k]=[];let i=0;while(t<DUR){BLINK[k].push(t);t+=1.7+rnd(i*7.3+ci*3.1)*2.8;i++;}});
// ---- bakış parçaları
const GAZE={};
KEYS.forEach(k=>GAZE[k]=[[0,0,-1]]);
function dirTo(a,b){const A=POS[a],B=POS[b];const dx=B[0]-A[0],dy=B[1]-A[1];const L=Math.hypot(dx,dy)||1;return [dx/L,dy/L];}
GAZE.terlik.push([1.15,.4,.2]);
D.lines.forEach(l=>{
  KEYS.forEach(k=>{
    let tgt;
    if(l.to==='door'){tgt=dirTo(k,'door');tgt=[tgt[0]*.5,-1];GAZE[k].push([l.start+.35,tgt[0],tgt[1]]);return;}
    if(k===l.who){tgt=l.to==='cam'?[0,.3]:dirTo(k,l.to);GAZE[k].push([l.start+.05,tgt[0],tgt[1]]);}
    else{tgt=dirTo(k,l.who);GAZE[k].push([l.start+.12+rnd(l.start*3+k.length)*.15,tgt[0],tgt[1]]);}
  });
});
KEYS.forEach(k=>{GAZE[k].push([38.05,0,-1]);});
GAZE.spor.push([40.9,-1,0]);GAZE.topuklu.push([41.2,-1,.2]);GAZE.cizme.push([40.8,-.5,.7]);
KEYS.forEach(k=>GAZE[k].sort((a,b)=>a[0]-b[0]));
function gaze(k,t){
  const g=GAZE[k];let cur=[g[0][1],g[0][2]];
  for(let i=1;i<g.length;i++){ if(t<g[i][0])break; const f=[g[i-1][1],g[i-1][2]]; const u=ss((t-g[i][0])/.16); cur=[lerp(f[0],g[i][1],u),lerp(f[1],g[i][2],u)]; }
  return cur;
}
function speakerAt(t){let s=null;D.lines.forEach(l=>{if(t>=l.start&&t<l.start+l.dur)s=l;});return s;}
function mouthAmt(k,t){
  let m=0;
  D.lines.forEach(l=>{ if(l.who!==k)return; const f=(t-l.start)*30; if(f<0||f>=l.m.length-1)return; const i=Math.floor(f); m=lerp(l.m[i],l.m[i+1],f-i); });
  return m;
}
const S={}; // karakter durumu
function rig(k,t){
  const base=BASE[k], evs=EV[k];
  let x=0,y=0,rot=0,sx=1,sy=1,lid=base.lid,brow=base.brow,raise=0,smileOpen=0,extraMouth=0,dropO=0;
  const ph=KEYS.indexOf(k)*1.7;
  // nefes
  sy*=1+.014*Math.sin(2*Math.PI*t/2.6+ph); sx*=1-.008*Math.sin(2*Math.PI*t/2.6+ph);
  const m=mouthAmt(k,t);
  const sp=speakerAt(t);
  // konuşurken beden
  if(m>0.02||(sp&&sp.who===k)){
    y-=7*m; sy*=1+.035*m; sx*=1-.02*m;
    rot+=3.2*Math.sin(t*6.1+ph)*Math.min(1,m*2)+1.6*Math.sin(t*2.3);
    raise-=.5*m; brow+=3*Math.sin(t*4+ph)*m;
  } else if(sp){
    // dinleyici: konuşana doğru eğil, hafif başını salla
    const d=dirTo(k,sp.who); rot+=d[0]*3.4+1.4*Math.sin(t*2.7+ph)*Math.min(1,mouthAmt(sp.who,t)*1.5);
    y-=2.5*Math.abs(Math.sin(t*3.1+ph))*mouthAmt(sp.who,t);
  } else { rot+=1.4*Math.sin(t*1.1+ph); }
  let frozen=0, staring=0;
  evs.forEach(([ty,t0,d])=>{
    const u=(t-t0)/d, e=hold(t,t0,d), b=bump(t,t0,d);
    if(ty==='hop'){ y-=70*b; sy*=1+.12*Math.sin(Math.PI*clamp(u))*0+(-.12*Math.max(0,.2-u)/.2*(u>=0&&u<.2?1:0)); sx*=1+.05*b; }
    if(ty==='shock'){ y-=26*b; rot+=-7*e*Math.cos(Math.PI*clamp(u)); sx*=1-.06*b; sy*=1+.1*b; lid=lerp(lid,-.1,e); raise-=1.2*e; extraMouth+=0; }
    if(ty==='shake'){ if(u>=0&&u<=1){x+=9*Math.sin((t-t0)*62)*(1-u); rot+=3*Math.sin((t-t0)*48)*(1-u);} brow=lerp(brow,26,e); lid=lerp(lid,.0,e); }
    if(ty==='giggle'){ if(u>=0&&u<=1){ const env=Math.sin(Math.PI*clamp(u)); y-=10*Math.abs(Math.sin((t-t0)*18))*env; sy*=1-.05*Math.abs(Math.sin((t-t0)*18))*env; rot+=4*Math.sin((t-t0)*14)*env; extraMouth+=.38*env*(.6+.4*Math.sin((t-t0)*18)); lid=lerp(lid,.62,e); brow=lerp(brow,-8,e);} }
    if(ty==='puff'){ const e2=hold(t,t0,d,.25,.4); sx*=1+.1*e2; sy*=1+.12*e2; y-=10*e2; brow=lerp(brow,14,e2); raise-=.2*e2; }
    if(ty==='angry'){ brow=lerp(brow,24,e); lid=lerp(lid,.22,e); }
    if(ty==='roll'){ raise-=.5*e; lid=lerp(lid,.3,e); rot+=-3*e; }
    if(ty==='alert'){ lid=lerp(lid,-.1,e); raise-=1.0*e; y-=14*b; }
    if(ty==='yawn'){ const yb=Math.sin(Math.PI*clamp(u)); extraMouth+=.95*yb; lid=lerp(lid,.92,yb*.9); y-=6*yb; sy*=1+.03*yb; }
    if(ty==='stare'){ const e2=clamp((t-t0)/.12); frozen=e2; staring=e2; }
  });
  if(frozen>0){ lid=lerp(lid,-.12,frozen); brow=lerp(brow,-14,frozen); raise=lerp(raise,-1.4,frozen); rot=lerp(rot,k==='topuklu'?-6:k==='cizme'?4:0,frozen)*1; x*=1-frozen; dropO=ss((t-38.3)/.4)*(t<47?1:0); }
  // final: Terlik ezilir
  if(k==='terlik'&&t>44.9){ const u=eoc((t-44.9)/.12); sy*=lerp(1,.55,u); sx*=lerp(1,1.28,u); lid=lerp(lid,.0,u); }
  // son sahne: terlik konuşurken kıpırdamasın (sadece ağız)
  if(k==='terlik'&&t>40.2&&t<44.8){ y=0;rot*=.1;x=0; sy=1+.01*Math.sin(t*6); sx=1; lid=lerp(lid,.3,.6); brow=lerp(brow,10,.6); }
  // göz kırpma
  if(!frozen){ BLINK[k].forEach(b=>{const u=(t-b)/.16; if(u>0&&u<1){lid=Math.max(lid,Math.sin(Math.PI*u)*1.0*(1-Math.max(0,lid))+Math.max(0,lid)*0);} }); }
  const g=gaze(k,t);
  const sh=(frozen>0?0.4:1)*0.0;
  const mo=clamp(m+extraMouth);
  S[k]={x,y,rot,sx,sy,lid:clamp(lid,-.2,1),brow,raise,g,mo,dropO};
  return S[k];
}
function applyChar(k,t){
  const s=rig(k,t);
  gsap.set('#ch-'+k,{x:s.x,y:s.y,rotation:s.rot,scaleX:s.sx,scaleY:s.sy});
  const cfg=EYE[k];
  ['L','R'].forEach((sd,i)=>{
    const c=cfg[i]; const lidv=clamp(s.lid,0,1);
    gsap.set('#'+k+'-pup'+sd,{x:s.g[0]*c.rx*.42,y:s.g[1]*c.ry*.4+(s.lid>0.5?c.ry*.1:0)});
    gsap.set('#'+k+'-lid'+sd,{scaleY:lidv,svgOrigin:c.x+' '+(c.y-c.ry-2)});
    const a=(sd==='L'?1:-1)*s.brow;
    gsap.set('#'+k+'-brow'+sd,{y:s.raise*14+(lidv>.4?lidv*8:0),rotation:a,svgOrigin:c.x+' '+(c.y-c.ry-18)});
  });
  const M=MOUTH[k];
  gsap.set('#'+k+'-mouth',{scaleY:.05+s.mo*.95,scaleX:1-.16*s.mo,svgOrigin:M[0]+' '+M[1],opacity:s.mo>.06?1:0});
  gsap.set('#'+k+'-smile',{opacity:s.mo>.06?0:1});
  if(k==='topuklu')gsap.set('#topuklu-lips',{opacity:s.mo>.06?0:.9});
  gsap.set('#'+k+'-drop',{opacity:s.dropO,y:s.dropO*14*Math.sin(t*5)*.0+(s.dropO?(t-38.3)*8%30:0)});
}
const EYE={terlik:[{x:150,y:228,rx:30,ry:36},{x:250,y:228,rx:30,ry:36}],spor:[{x:165,y:244,rx:28,ry:33},{x:250,y:244,rx:28,ry:33}],topuklu:[{x:100,y:272,rx:26,ry:32},{x:174,y:272,rx:26,ry:32}],cizme:[{x:180,y:150,rx:26,ry:32},{x:250,y:150,rx:26,ry:32}]};
const MOUTH={terlik:[200,292],spor:[208,300],topuklu:[138,330],cizme:[214,246]};
// altyazı ve diğer öğeler
const CAPS=D.lines.map((l,i)=>({id:'#cap'+(i+1)+'-in',t0:l.start}));
function render(t){
  KEYS.forEach(k=>applyChar(k,t));
  const c=cam(t); const sway=[3.5*Math.sin(t*.9),2.5*Math.sin(t*1.3+1)];
  let sh=0; // yumruk darbesi (kamera sarsıntısı) - kapı sesinde
  [[1.0,.5],[34.9,.5],[44.95,.6]].forEach(([t0,a])=>{const u=(t-t0);if(u>0&&u<.4)sh+=a*Math.sin(u*90)*(1-u/.4)*8;});
  gsap.set('#stage',{scale:c[2],x:540-(c[0]+sway[0]+sh)*c[2],y:630-(c[1]+sway[1]+sh)*c[2],transformOrigin:'0 0'});
  CAPS.forEach(cp=>{const u=(t-cp.t0)/.2; gsap.set(cp.id,{scale:u<1?.8+.2*eob(u):1,opacity:clamp(u*3+.2)});});
  // kapı açılır: ışık + insan gölgesi
  const gl=ss((t-38.9)/.5); gsap.set('#glow',{opacity:gl*.9*(t<44.9?1:1-ss((t-44.9)/.3)*.3)});
  const shd=ss((t-39.2)/.8); gsap.set('#shadowhum',{opacity:shd*.55,y:lerp(-400,0,eoc((t-39.2)/1.2))+(t>44.9?60*eoc((t-44.9)/.12):0),x:lerp(40,-120,ss((t-43.8)/1.1))});
  gsap.set('#jacket',{rotation:2.5*Math.sin(t*1.7)+(t>38.9?4*Math.sin((t-38.9)*7)*Math.exp(-(t-38.9)):0)});
  gsap.set('#bag',{rotation:-2*Math.sin(t*1.4)});
  gsap.set('#plant',{rotation:1.5*Math.sin(t*1.2)});
  gsap.set('#title-t',{scale:.7+.3*eob(t/.4)});
  gsap.set('#title',{opacity:1-ss((t-3.1)/.5)});
}
window.__timelines=window.__timelines||{};
const tl=gsap.timeline({paused:true});
const proxy={v:0};
tl.to(proxy,{v:1,duration:DUR,ease:'none',onUpdate:()=>render(tl.time())},0);
render(0);
window.__timelines['main']=tl;
</script>
</body></html>`;
fs.writeFileSync("index.html", html);
console.log("index.html", html.length);
