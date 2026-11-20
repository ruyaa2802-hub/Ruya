// İnsan Atlası — "Koku ve Hafıza" — flat illustrated animation (SVG), pure function of time.
const W = 1080, H = 1920;
const P = {
  cream: '#f4e9d8', paper: '#efe2cc', skin: '#f1c7a3', skinSh: '#e2ab86', hair: '#5a392c', hairHi: '#77503f',
  sage: '#86a79c', sageSh: '#6f9086', collar: '#fbf6ee', mustard: '#e3b45c', terra: '#d4826b', rose: '#df9a96',
  blue: '#8fa9bd', blueDk: '#6d8aa1', plum: '#8c6378', wood: '#bf9068', woodDk: '#97704f', ol: '#3d2e2a', green: '#8fb07e', greenDk: '#6c8f5d',
};
const OL = P.ol;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ease = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const k = (t, a, b) => ease((t - a) / (b - a));
const lerp = (a, b, u) => a + (b - a) * u;
const f = (v) => +v.toFixed(2);
const S = (t, fr, ph = 0) => Math.sin(t * fr + ph);
const st = (w = 6) => `stroke="${OL}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;

// ---------------------------------------------------------------- character (same person in every scene)
// origin = base of the neck. opts: armUp 0..1, holding 'bottle'|'flower'|null, eyes 'open'|'closed'|'soft', blink 0..1,
// look [x,y], mouth 0..1 smile, inhale 0..1, tilt deg, blush 0..1, child bool, outfit color, handPos override
function person(o) {
  const t = o.t || 0;
  const child = !!o.child;
  const sweater = o.outfit || P.sage, sweaterSh = o.outfitSh || P.sageSh;
  const breathe = 1 + 0.008 * S(t, 2.4, o.ph || 0);
  const tilt = o.tilt || 0;
  const u = clamp(o.armUp || 0);
  // front arm (screen right): shoulder -> elbow -> hand
  const up = o.holding === 'bottle' ? [78, 8] : [72, -18];
  const hand = o.handPos || [lerp(150, up[0], u), lerp(400, up[1], u)];
  const elbow = [lerp(212, 205, u), lerp(250, 150, u)];
  let s = '';
  // back hair
  s += `<g transform="rotate(${f(tilt)} 0 -40)">`;
  s += `<path d="M -120,-150 C -128,-255 -60,-288 0,-288 C 60,-288 128,-255 120,-150 C 126,-90 122,-48 104,-26 C 60,-36 -60,-36 -104,-26 C -122,-48 -126,-90 -120,-150 Z" fill="${P.hair}" ${st()}/>`;
  s += `</g>`;
  // back arm (screen left)
  s += `<path d="M -150,70 Q -214,250 -152,400" fill="none" stroke="${OL}" stroke-width="78" stroke-linecap="round"/>`;
  s += `<path d="M -150,70 Q -214,250 -152,400" fill="none" stroke="${sweaterSh}" stroke-width="66" stroke-linecap="round"/>`;
  // torso
  s += `<g transform="translate(0,0) scale(1,${f(breathe)})">`;
  if (child) {
    s += `<path d="M -40,-5 C -110,5 -150,40 -158,120 L -165,470 L 165,470 L 158,120 C 150,40 110,5 40,-5 Z" fill="${sweater}" ${st()}/>`;
    s += `<path d="M -40,-4 Q 0,40 40,-4" fill="none" ${st(6)}/>`;
    s += `<circle cx="-70" cy="200" r="20" fill="${P.terra}" ${st(4)}/><circle cx="-20" cy="230" r="14" fill="${P.blue}" ${st(4)}/>`;
  } else {
    s += `<path d="M -45,-5 C -120,5 -170,40 -178,120 L -185,470 L 185,470 L 178,120 C 170,40 120,5 45,-5 Z" fill="${sweater}" ${st()}/>`;
    for (let i = -4; i <= 4; i++) s += `<line x1="${i * 38}" y1="420" x2="${i * 38}" y2="470" stroke="${sweaterSh}" stroke-width="6"/>`;
    s += `<path d="M -150,130 Q -150,260 -158,420" fill="none" stroke="${sweaterSh}" stroke-width="7" opacity="0.7"/>`;
    s += `<path d="M -50,-6 Q -46,42 -4,40 L 0,8 Z" fill="${P.collar}" ${st(5)}/><path d="M 50,-6 Q 46,42 4,40 L 0,8 Z" fill="${P.collar}" ${st(5)}/>`;
  }
  s += `</g>`;
  // neck
  s += `<path d="M -26,-80 L -26,8 Q 0,26 26,8 L 26,-80 Z" fill="${P.skin}" ${st(5)}/><path d="M -26,-10 Q 0,8 26,-10" fill="none" stroke="${P.skinSh}" stroke-width="10" opacity="0.6"/>`;
  // head
  s += `<g transform="rotate(${f(tilt)} 0 -40)">`;
  s += `<ellipse cx="-91" cy="-150" rx="17" ry="24" fill="${P.skin}" ${st(5)}/><ellipse cx="91" cy="-150" rx="17" ry="24" fill="${P.skin}" ${st(5)}/>`;
  if (!child) s += `<circle cx="-93" cy="-122" r="7" fill="${P.mustard}" ${st(3)}/><circle cx="93" cy="-122" r="7" fill="${P.mustard}" ${st(3)}/>`;
  s += `<ellipse cx="0" cy="-160" rx="${child ? 96 : 92}" ry="${child ? 100 : 106}" fill="${P.skin}" ${st()}/>`;
  // features
  const ey = -150, lk = o.look || [0, 0];
  const blink = clamp(o.blink || 0);
  const eyeSc = child ? 1.2 : 1;
  for (const ex of [-36, 36]) {
    const cx = ex + lk[0] * 6, cy = ey + lk[1] * 4;
    if (o.eyes === 'closed') {
      s += `<path d="M ${ex - 14},${ey - 2} Q ${ex},${ey + 9} ${ex + 14},${ey - 2}" fill="none" ${st(5)}/>`;
      s += `<path d="M ${ex + Math.sign(ex) * 14},${ey - 2} l ${Math.sign(ex) * 7},-4" fill="none" ${st(4)}/>`;
    } else if (o.eyes === 'soft') {
      const ry = 7 * (1 - blink * 0.9);
      s += `<ellipse cx="${f(cx)}" cy="${f(cy + 2)}" rx="${8 * eyeSc}" ry="${f(ry * eyeSc)}" fill="${OL}"/>`;
      s += `<path d="M ${ex - 15},${ey - 3} Q ${ex},${ey - 9} ${ex + 15},${ey - 3}" fill="none" ${st(5)}/>`;
      s += `<path d="M ${ex + Math.sign(ex) * 15},${ey - 3} l ${Math.sign(ex) * 6},-5" fill="none" ${st(4)}/>`;
    } else {
      const ry = 11 * (1 - blink * 0.92);
      s += `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${8.5 * eyeSc}" ry="${f(ry * eyeSc)}" fill="${OL}"/>`;
      if (blink < 0.5) s += `<circle cx="${f(cx - 2.5)}" cy="${f(cy - 4)}" r="${3 * eyeSc}" fill="#fff"/>`;
      s += `<path d="M ${ex + Math.sign(ex) * 10},${ey - 10} l ${Math.sign(ex) * 7},-5" fill="none" ${st(4)}/>`;
    }
  }
  const br = o.brow || 0;
  s += `<path d="M -54,${-186 - br} Q -36,${-196 - br} -18,${-188 - br}" fill="none" ${st(5)}/><path d="M 18,${-188 - br} Q 36,${-196 - br} 54,${-186 - br}" fill="none" ${st(5)}/>`;
  s += `<path d="M -4,-132 Q 4,-120 -6,-114" fill="none" stroke="${P.skinSh}" stroke-width="5" stroke-linecap="round"/>`;
  const bl = 0.35 + 0.45 * (o.blush || 0);
  s += `<ellipse cx="-58" cy="-112" rx="20" ry="12" fill="${P.rose}" opacity="${f(bl)}"/><ellipse cx="58" cy="-112" rx="20" ry="12" fill="${P.rose}" opacity="${f(bl)}"/>`;
  const inh = clamp(o.inhale || 0), sm = clamp(o.mouth ?? 0.5);
  if (inh > 0.5) s += `<ellipse cx="0" cy="-92" rx="7" ry="8" fill="#9c4f48" ${st(4)}/>`;
  else s += `<path d="M -20,-96 Q 0,${f(-96 + 6 + 12 * sm)} 20,-96" fill="none" ${st(5)}/>`;
  // fringe & side locks
  s += `<path d="M -98,-182 C -104,-262 -30,-292 16,-282 C 74,-272 108,-240 100,-178 C 82,-210 56,-222 30,-210 C 10,-236 -22,-238 -42,-210 C -62,-226 -88,-214 -98,-182 Z" fill="${P.hair}" ${st()}/>`;
  s += `<path d="M -12,-262 C 20,-268 52,-258 70,-238" fill="none" stroke="${P.hairHi}" stroke-width="7" stroke-linecap="round"/>`;
  s += `<path d="M -98,-182 C -112,-128 -110,-78 -100,-34 C -86,-66 -84,-120 -84,-160 Z" fill="${P.hair}" ${st(5)}/>`;
  s += `<path d="M 100,-178 C 112,-126 110,-76 100,-34 C 86,-66 84,-120 84,-160 Z" fill="${P.hair}" ${st(5)}/>`;
  if (child) s += `<rect x="52" y="-232" width="34" height="12" rx="6" fill="${P.terra}" ${st(4)} transform="rotate(-25 69 -226)"/>`;
  s += `</g>`;
  // front arm + held object
  const armPath = `M 150,70 L ${f(elbow[0])},${f(elbow[1])} L ${f(hand[0])},${f(hand[1])}`;
  s += `<path d="${armPath}" fill="none" stroke="${OL}" stroke-width="78" stroke-linecap="round" stroke-linejoin="round"/>`;
  s += `<path d="${armPath}" fill="none" stroke="${sweater}" stroke-width="66" stroke-linecap="round" stroke-linejoin="round"/>`;
  if (o.holding === 'bottle') s += bottle(hand[0] - 8, hand[1] - 36, 1, t);
  if (o.holding === 'flower') s += flower(hand[0] - 6, hand[1] - 20, 1, t, o.flowerAng || -18);
  s += `<circle cx="${f(hand[0])}" cy="${f(hand[1])}" r="31" fill="${P.skin}" ${st(5)}/>`;
  s += `<path d="M ${f(hand[0] - 26)},${f(hand[1] - 8)} q -6,-18 10,-24" fill="${P.skin}" ${st(4)}/>`;
  return s;
}

function bottle(x, y, sc, t) {
  return `<g transform="translate(${f(x)},${f(y)}) scale(${sc})">
  <path d="M -14,-78 C 10,-96 36,-92 42,-74" fill="none" ${st(4)}/>
  <path d="M 42,-74 q 4,30 -10,34" fill="none" stroke="${P.mustard}" stroke-width="4"/>
  <circle cx="44" cy="-74" r="16" fill="${P.plum}" ${st(4)}/>
  <path d="M 30,-40 l 4,22 l 6,-22 Z" fill="${P.mustard}" ${st(3)} transform="rotate(${f(S(t, 3) * 8)} 34 -40)"/>
  <rect x="-22" y="-82" width="18" height="22" rx="4" fill="${P.mustard}" ${st(4)}/>
  <path d="M -48,-56 L 26,-56 L 40,-30 L 40,40 L 26,62 L -48,62 L -62,40 L -62,-30 Z" fill="#e7a4b4" fill-opacity="0.85" ${st(5)}/>
  <path d="M -48,-56 L -36,-30 L -36,40 L -48,62 M 26,-56 L 14,-30 L 14,40 L 26,62 M -36,-30 L 14,-30 M -36,40 L 14,40" fill="none" stroke="${OL}" stroke-width="3" opacity="0.5"/>
  <rect x="-30" y="-6" width="36" height="24" rx="4" fill="${P.cream}" ${st(3)}/>
  <path d="M -54,-22 L -54,30" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity="0.7"/>
  </g>`;
}
function flower(x, y, sc, t, ang = -18) {
  let p = '';
  for (let i = 0; i < 7; i++) p += `<ellipse cx="0" cy="-26" rx="13" ry="26" fill="${i % 2 ? '#f0b3b8' : '#f6c5c4'}" ${st(4)} transform="rotate(${i * 51.4})"/>`;
  return `<g transform="translate(${f(x)},${f(y)}) rotate(${f(ang + S(t, 1.6) * 3)}) scale(${sc})">
  <path d="M 0,0 Q 4,60 0,110" fill="none" stroke="${P.greenDk}" stroke-width="8" stroke-linecap="round"/>
  <path d="M 2,62 C 30,48 46,56 52,70 C 32,78 14,74 2,62 Z" fill="${P.green}" ${st(4)}/>
  <g transform="translate(0,-60)">${p}<circle r="16" fill="${P.mustard}" ${st(4)}/><circle cx="-4" cy="-4" r="4" fill="#fff" opacity="0.6"/></g>
  </g>`;
}
function scentWisps(x0, y0, x1, y1, t, amt, col = '#e7a4b4', n = 3) {
  if (amt <= 0.01) return '';
  let s = '';
  for (let i = 0; i < n; i++) {
    const off = (i - 1) * 26, ph = i * 1.7;
    const mx = (x0 + x1) / 2 + 60 * S(t, 2.2, ph) + off, my = (y0 + y1) / 2 + 30 * S(t, 1.7, ph);
    s += `<path d="M ${x0 + off * 0.3},${y0} C ${f(mx + 50)},${f(my + 40)} ${f(mx - 50)},${f(my - 30)} ${x1},${y1 + off * 0.2}" fill="none" stroke="${col}" stroke-width="${7 - i}" stroke-linecap="round" stroke-dasharray="18 26" stroke-dashoffset="${f(-t * 90 - i * 20)}" opacity="${f(amt * 0.85)}"/>`;
  }
  return s;
}
function sparkles(cx, cy, r, t, n, amt, col = '#fff3c4') {
  if (amt <= 0.01) return '';
  let s = '';
  for (let i = 0; i < n; i++) {
    const a = i * 2.399 + t * 0.4, rr = r * (0.35 + 0.65 * ((i * 0.618) % 1));
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * 0.8 - ((t * 30 + i * 40) % 80);
    const tw = 0.5 + 0.5 * S(t, 4 + i % 3, i);
    const z = 8 + (i % 3) * 4;
    s += `<path d="M ${f(x)},${f(y - z)} Q ${f(x)},${f(y)} ${f(x + z)},${f(y)} Q ${f(x)},${f(y)} ${f(x)},${f(y + z)} Q ${f(x)},${f(y)} ${f(x - z)},${f(y)} Q ${f(x)},${f(y)} ${f(x)},${f(y - z)} Z" fill="${col}" opacity="${f(amt * tw)}"/>`;
  }
  return s;
}
function blinkAt(t, list) { let b = 0; for (const s0 of list) { const d = t - s0; if (d >= 0 && d < 0.2) b = Math.max(b, d < 0.07 ? d / 0.07 : 1 - (d - 0.07) / 0.13); } return b; }

// ---------------------------------------------------------------- scene 1: dresser, old perfume
function scene1(t) {
  let s = `<rect width="${W}" height="${H}" fill="#ead9c4"/>`;
  for (let i = 0; i < 12; i++) s += `<rect x="${i * 96}" y="0" width="48" height="${H}" fill="#e4d0b8" opacity="0.7"/>`;
  for (let i = 0; i < 12; i++) for (let j = 0; j < 14; j++) s += `<circle cx="${i * 96 + 72}" cy="${j * 140 + 70 + (i % 2) * 70}" r="6" fill="#d6bc9d"/>`;
  // mirror
  s += `<ellipse cx="540" cy="620" rx="300" ry="380" fill="#c7d4d6" ${st(8)}/><ellipse cx="540" cy="620" rx="270" ry="350" fill="#dfe8e6"/>`;
  s += `<path d="M 380,420 L 470,330 M 400,500 L 520,380" stroke="#fff" stroke-width="14" stroke-linecap="round" opacity="0.7"/>`;
  // dresser top
  s += `<rect x="40" y="1180" width="1000" height="60" rx="14" fill="${P.wood}" ${st(7)}/><rect x="70" y="1240" width="940" height="700" fill="${P.woodDk}" ${st(7)}/>`;
  // bottles & lamp on dresser
  s += `<g transform="translate(150,1100)"><rect x="-30" y="-50" width="60" height="130" rx="10" fill="#b9cbd9" ${st(5)}/><rect x="-12" y="-80" width="24" height="32" rx="5" fill="${P.mustard}" ${st(4)}/></g>`;
  s += `<g transform="translate(950,1040)"><path d="M -70,-140 L 70,-140 L 95,-40 L -95,-40 Z" fill="${P.mustard}" ${st(6)}/><rect x="-10" y="-40" width="20" height="120" fill="${P.woodDk}" ${st(5)}/><ellipse cx="0" cy="140" rx="60" ry="14" fill="${P.wood}" ${st(5)}/></g>`;
  s += `<circle cx="950" cy="960" r="${f(160 + 8 * S(t, 1.3))}" fill="#fff3c8" opacity="0.25"/>`;
  // character
  const sniff = k(t, 0.15, 0.7);
  const arm = sniff;
  const closed = t > 1.6;
  const look = t < 0.9 ? [0.3, 0.6] : [0, 0];
  const pose = person({
    t, armUp: arm, holding: 'bottle', eyes: closed ? 'closed' : 'open', blink: blinkAt(t, [0.5]),
    mouth: closed ? 0.85 : 0.4, inhale: t > 0.6 && t < 1.3 ? 1 : 0, tilt: lerp(0, -6, k(t, 1.4, 2.6)) + 1.5 * S(t, 1.2),
    blush: k(t, 1.8, 3.0), look, brow: closed ? 4 : 0,
  });
  s += `<g transform="translate(540,1180) scale(1.6)">${pose}</g>`;
  // scent wisps from bottle to nose
  s += scentWisps(540 + 1.6 * 112, 1180 - 1.6 * 115, 540 + 1.6 * 14, 1180 - 1.6 * 126, t, k(t, 0.55, 0.9) * (1 - k(t, 2.2, 3.0)));
  // nostalgic golden swirl begins
  const mem = k(t, 2.0, 4.0);
  s += sparkles(540, 760, 380, t, 16, mem);
  for (let i = 0; i < 3; i++) {
    const r = 220 + i * 90 + 30 * S(t, 1.1, i);
    s += `<circle cx="540" cy="900" r="${f(r)}" fill="none" stroke="#f3c97c" stroke-width="${10 - i * 2}" stroke-dasharray="40 60" stroke-dashoffset="${f(t * 80 * (i % 2 ? -1 : 1))}" opacity="${f(mem * 0.55)}"/>`;
  }
  return s;
}

// ---------------------------------------------------------------- scene 2: grandmother's kitchen (memory)
function grandma(t) {
  const stir = t * 3.2;
  const hx = 120 + Math.cos(stir) * 40, hy = 330 + Math.sin(stir) * 14;
  let s = '';
  s += `<path d="M -45,-5 C -130,5 -180,50 -188,140 L -200,520 L 200,520 L 188,140 C 180,50 130,5 45,-5 Z" fill="${P.plum}" ${st()}/>`;
  s += `<path d="M -110,80 Q 0,110 110,80 L 130,520 L -130,520 Z" fill="#f6eee2" ${st(5)}/><rect x="-50" y="250" width="100" height="70" rx="12" fill="#efe1cf" ${st(4)}/>`;
  s += `<path d="M -26,-80 L -26,8 Q 0,26 26,8 L 26,-80 Z" fill="${P.skin}" ${st(5)}/>`;
  s += `<g transform="rotate(${f(3 * S(t, 1.4))} 0 -40)">`;
  s += `<circle cx="0" cy="-290" r="48" fill="#c9c3bc" ${st(5)}/>`;
  s += `<ellipse cx="-90" cy="-150" rx="16" ry="22" fill="${P.skin}" ${st(5)}/><ellipse cx="90" cy="-150" rx="16" ry="22" fill="${P.skin}" ${st(5)}/>`;
  s += `<ellipse cx="0" cy="-160" rx="92" ry="104" fill="${P.skin}" ${st()}/>`;
  s += `<path d="M -96,-170 C -100,-250 -40,-270 0,-268 C 40,-270 100,-250 96,-170 C 70,-215 30,-225 0,-210 C -30,-225 -70,-215 -96,-170 Z" fill="#cfc9c2" ${st()}/>`;
  for (const ex of [-36, 36]) { s += `<circle cx="${ex}" cy="-146" r="26" fill="#fff" fill-opacity="0.3" ${st(5)}/><path d="M ${ex - 12},-146 Q ${ex},-136 ${ex + 12},-146" fill="none" ${st(5)}/>`; }
  s += `<line x1="-10" y1="-148" x2="10" y2="-148" ${st(5)}/>`;
  s += `<path d="M -22,-95 Q 0,-76 22,-95" fill="none" ${st(5)}/>`;
  s += `<ellipse cx="-62" cy="-108" rx="18" ry="10" fill="${P.rose}" opacity="0.55"/><ellipse cx="62" cy="-108" rx="18" ry="10" fill="${P.rose}" opacity="0.55"/>`;
  s += `<path d="M -40,-196 q 40,-14 80,0" fill="none" stroke="#b3aca5" stroke-width="5" stroke-linecap="round"/>`;
  s += `</g>`;
  // stirring arm with wooden spoon
  const arm = `M 150,70 L 200,250 L ${f(hx)},${f(hy)}`;
  s += `<path d="${arm}" fill="none" stroke="${OL}" stroke-width="74" stroke-linecap="round" stroke-linejoin="round"/><path d="${arm}" fill="none" stroke="${P.plum}" stroke-width="62" stroke-linecap="round" stroke-linejoin="round"/>`;
  s += `<line x1="${f(hx)}" y1="${f(hy)}" x2="${f(hx - 30)}" y2="${f(hy + 160)}" stroke="${P.woodDk}" stroke-width="16" stroke-linecap="round"/>`;
  s += `<circle cx="${f(hx)}" cy="${f(hy)}" r="30" fill="${P.skin}" ${st(5)}/>`;
  return s;
}
function scene2(t) {
  let s = `<rect width="${W}" height="${H}" fill="#f2dcb4"/>`;
  // window with sun
  s += `<rect x="600" y="230" width="380" height="460" rx="20" fill="#bfe0e4" ${st(8)}/>`;
  s += `<circle cx="830" cy="380" r="70" fill="#fff1b8" opacity="0.9"/><path d="M 600,600 Q 700,520 800,580 T 980,560 L 980,690 L 600,690 Z" fill="${P.green}" opacity="0.8"/>`;
  s += `<line x1="790" y1="230" x2="790" y2="690" ${st(8)}/><line x1="600" y1="460" x2="980" y2="460" ${st(8)}/>`;
  for (const side of [0, 1]) {
    const sw = 10 * S(t, 1.2, side * 2);
    const x = side ? 990 : 590, dir = side ? -1 : 1;
    s += `<path d="M ${x},200 L ${x + dir * 110},200 Q ${x + dir * (90 + sw)},460 ${x + dir * (40 + sw)},720 L ${x},720 Z" fill="#e8a59a" ${st(6)}/>`;
    for (let i = 1; i < 4; i++) s += `<line x1="${x + dir * i * 26}" y1="205" x2="${f(x + dir * (i * 12 + sw * 0.5))}" y2="715" stroke="#f6d3cb" stroke-width="7"/>`;
  }
  s += `<rect x="570" y="180" width="440" height="24" rx="12" fill="${P.woodDk}" ${st(5)}/>`;
  // sun rays
  for (let i = 0; i < 4; i++) s += `<path d="M ${640 + i * 90},690 L ${300 + i * 140},1500 L ${380 + i * 140},1500 L ${700 + i * 90},690 Z" fill="#fff4cf" opacity="${f(0.12 + 0.05 * S(t, 1.1, i))}"/>`;
  // tiles
  for (let i = 0; i < 7; i++) for (let j = 0; j < 4; j++) s += `<rect x="${40 + i * 80}" y="${840 + j * 80}" width="74" height="74" rx="8" fill="${(i + j) % 2 ? '#f7ecd8' : '#cfe0da'}" stroke="#d8c3a2" stroke-width="3"/>`;
  // hanging utensils
  s += `<rect x="40" y="250" width="500" height="14" rx="7" fill="${P.woodDk}" ${st(4)}/>`;
  [[110, 'pan'], [230, 'ladle'], [340, 'pan2'], [450, 'whisk']].forEach(([x, kind], i) => {
    const a = 5 * S(t, 1.8, i * 1.3);
    let g = `<line x1="0" y1="0" x2="0" y2="40" ${st(4)}/>`;
    if (kind === 'pan') g += `<rect x="-9" y="40" width="18" height="80" rx="8" fill="${P.woodDk}" ${st(4)}/><circle cx="0" cy="170" r="55" fill="${P.terra}" ${st(6)}/><circle cx="-12" cy="160" r="30" fill="#e39a83"/>`;
    if (kind === 'pan2') g += `<rect x="-8" y="40" width="16" height="60" rx="7" fill="${P.woodDk}" ${st(4)}/><circle cx="0" cy="135" r="40" fill="${P.blue}" ${st(6)}/>`;
    if (kind === 'ladle') g += `<line x1="0" y1="40" x2="0" y2="170" stroke="${P.woodDk}" stroke-width="12" stroke-linecap="round"/><path d="M -30,170 Q 0,220 30,170 Z" fill="#c8c0b6" ${st(5)}/>`;
    if (kind === 'whisk') g += `<line x1="0" y1="40" x2="0" y2="100" stroke="${P.woodDk}" stroke-width="12" stroke-linecap="round"/><path d="M 0,100 C -30,150 -20,200 0,200 C 20,200 30,150 0,100 M 0,100 C -10,150 -8,200 0,200 C 8,200 10,150 0,100" fill="none" ${st(4)}/>`;
    s += `<g transform="translate(${x},257) rotate(${f(a)})">${g}</g>`;
  });
  // clock with pendulum
  s += `<g transform="translate(440,560)"><line x1="0" y1="40" x2="${f(60 * Math.sin(1.0 * S(t, 3.1) * 0.5))}" y2="${f(40 + 120 * Math.cos(0.5 * S(t, 3.1) * 0.5))}" ${st(5)}/><circle cx="${f(160 * Math.sin(0.25 * S(t, 3.1)))}" cy="${f(40 + 160 * Math.cos(0.25 * S(t, 3.1)))}" r="22" fill="${P.mustard}" ${st(5)}/>
  <circle r="70" fill="#fbf2e2" ${st(7)}/><line x1="0" y1="0" x2="0" y2="-44" ${st(6)}/><line x1="0" y1="0" x2="${f(32 * Math.cos(t * 0.5))}" y2="${f(32 * Math.sin(t * 0.5))}" ${st(6)}/></g>`;
  // shelf with jars
  s += `<rect x="40" y="700" width="330" height="18" rx="6" fill="${P.woodDk}" ${st(4)}/>`;
  [[90, P.terra], [170, P.mustard], [250, P.sage], [320, P.rose]].forEach(([x, c]) => { s += `<rect x="${x - 28}" y="610" width="56" height="90" rx="12" fill="${c}" ${st(5)}/><rect x="${x - 30}" y="600" width="60" height="18" rx="6" fill="${P.cream}" ${st(4)}/>`; });
  // grandma behind the stove
  s += `<g transform="translate(330,1020) scale(0.95)">${grandma(t)}</g>`;
  // stove counter & pot
  s += `<rect x="20" y="1300" width="640" height="660" fill="#e4d6c3" ${st(7)}/><rect x="0" y="1270" width="680" height="50" rx="10" fill="#cbbba5" ${st(7)}/>`;
  s += `<rect x="80" y="1380" width="520" height="300" rx="18" fill="#cfc2b0" ${st(6)}/><rect x="120" y="1420" width="440" height="120" rx="12" fill="#3f3936" opacity="0.85"/>`;
  s += `<path d="M 230,1170 L 230,1270 Q 230,1290 250,1290 L 470,1290 Q 490,1290 490,1270 L 490,1170 Z" fill="${P.blueDk}" ${st(7)}/><rect x="215" y="1150" width="290" height="30" rx="14" fill="${P.blue}" ${st(6)}/>`;
  s += `<path d="M 225,1200 h -30 M 495,1200 h 30" ${st(10)}/>`;
  // steam
  for (let i = 0; i < 4; i++) {
    const ph = (t * 0.45 + i * 0.25) % 1;
    const x = 290 + i * 45 + 20 * S(t, 2, i), y = 1130 - ph * 380;
    s += `<path d="M ${f(x)},${f(y)} q 30,-40 0,-80 q -30,-40 0,-80" fill="none" stroke="#fff" stroke-width="${f(14 - ph * 8)}" stroke-linecap="round" opacity="${f(0.7 * Math.sin(Math.PI * ph))}"/>`;
  }
  // smell ribbons toward the child
  s += scentWisps(470, 1050, 790, 1180, t, 0.7, '#f3c08a');
  // table & child
  const swing = 22 * S(t, 3.4);
  s += `<g transform="translate(800,1310) scale(0.62)">${person({ t, child: true, outfit: P.mustard, outfitSh: '#c8963f', eyes: t > 7.3 ? 'closed' : 'open', look: [-0.8, 0.1], mouth: 0.9, tilt: -5 + 3 * S(t, 1.5), blink: blinkAt(t, [6.0, 8.8]), blush: 0.6, ph: 1 })}</g>`;
  s += `<rect x="640" y="1500" width="440" height="40" rx="10" fill="${P.wood}" ${st(6)}/><path d="M 650,1540 L 1080,1540 L 1080,1700 Q 860,1740 650,1700 Z" fill="#e8a59a" ${st(6)}/>`;
  for (let i = 0; i < 5; i++) s += `<line x1="${680 + i * 80}" y1="1545" x2="${680 + i * 80}" y2="${1705 + (i % 2) * 8}" stroke="#f6d3cb" stroke-width="10"/>`;
  s += `<g transform="translate(790,1700)"><line x1="0" y1="0" x2="${f(swing * 0.6)}" y2="110" ${st(22)}/><line x1="50" y1="0" x2="${f(50 - swing * 0.6)}" y2="110" ${st(22)}/></g>`;
  s += `<ellipse cx="760" cy="1500" rx="60" ry="14" fill="#fff" ${st(5)}/><circle cx="740" cy="1488" r="14" fill="${P.mustard}" ${st(4)}/><circle cx="772" cy="1486" r="14" fill="#d9a25a" ${st(4)}/>`;
  // floating dust motes
  for (let i = 0; i < 18; i++) { const x = (i * 157 + t * 12 * (i % 3 + 1)) % W, y = 600 + ((i * 263 + t * 20) % 900); s += `<circle cx="${f(x)}" cy="${f(y)}" r="${3 + i % 3}" fill="#fff7d6" opacity="${f(0.4 + 0.3 * S(t, 2, i))}"/>`; }
  // memory tint & vignette
  s += `<rect width="${W}" height="${H}" fill="#f2b56b" opacity="0.13" style="mix-blend-mode:multiply"/>`;
  s += `<rect width="${W}" height="${H}" fill="url(#vigWarm)"/>`;
  return s;
}

// ---------------------------------------------------------------- scene 3: brain
function scene3(t, t0) {
  const lt = t - t0;
  let s = `<rect width="${W}" height="${H}" fill="#e9eeec"/>`;
  s += `<circle cx="560" cy="900" r="${f(560 + 10 * S(t, 0.8))}" fill="#dfe8e6"/>`;
  s += `<text x="540" y="270" text-anchor="middle" font-family="Nunito" font-weight="800" font-size="64" fill="${P.ol}" opacity="${f(k(lt, 0.2, 0.8))}">Koku ve Hafıza</text>`;
  s += `<rect x="410" y="300" width="${f(260 * k(lt, 0.4, 1.0))}" height="10" rx="5" fill="${P.mustard}"/>`;
  const appear = k(lt, 0, 0.8);
  s += `<g opacity="${f(appear)}" transform="translate(0,${f((1 - appear) * 40)})">`;
  // head profile (same hair as the character)
  const head = 'M 700,1520 C 690,1390 720,1310 760,1230 C 865,1050 855,780 742,650 C 640,530 430,520 340,620 C 290,680 268,760 274,822 C 277,862 262,882 245,912 L 204,986 C 198,1002 210,1012 240,1013 C 250,1030 238,1048 248,1062 C 236,1076 242,1092 255,1102 C 262,1136 262,1162 300,1182 C 362,1202 422,1212 450,1262 L 462,1520 Z';
  s += `<path d="${head}" fill="${P.skin}" opacity="0.55" ${st(7)}/>`;
  s += `<path d="M 742,650 C 640,530 430,520 340,620 C 330,600 420,500 560,500 C 760,500 900,640 880,860 C 870,980 830,1060 800,1120 C 790,1040 860,880 742,650 Z" fill="${P.hair}" ${st(6)}/>`;
  s += `<path d="M 262,800 q 18,-6 30,4" fill="none" ${st(5)}/>`;
  // nasal passage
  s += `<path d="M 222,1000 C 260,990 300,980 345,972" fill="none" stroke="#e8b8a0" stroke-width="22" stroke-linecap="round" opacity="0.8"/>`;
  // brain
  const brain = 'M 330,840 C 300,700 420,600 565,600 C 705,600 805,690 808,822 C 812,905 775,960 705,975 C 655,1000 600,985 562,992 C 500,1002 432,992 402,962 C 362,932 342,895 330,840 Z';
  s += `<defs><clipPath id="bc"><path d="${brain}"/></clipPath></defs>`;
  s += `<path d="${brain}" fill="#efb6b2" ${st(7)}/>`;
  let gy = '';
  const gyri = ['M 360,760 C 400,720 430,780 470,740 S 540,700 580,740 S 650,700 700,740 S 760,720 800,760', 'M 350,830 C 390,800 420,850 460,815 S 530,790 570,830 S 640,800 690,830 S 760,810 810,850',
    'M 420,660 C 450,700 480,650 510,690 S 570,640 610,680 S 670,650 720,690', 'M 380,900 C 420,880 450,930 500,900 S 560,880 600,910', 'M 640,890 C 680,870 710,910 760,885'];
  gyri.forEach((d) => { gy += `<path d="${d}" fill="none" stroke="#d48f8d" stroke-width="7" stroke-linecap="round"/>`; });
  s += `<g clip-path="url(#bc)">${gy}</g>`;
  s += `<path d="M 470,900 C 520,870 600,880 640,915" fill="none" stroke="#c98381" stroke-width="7" stroke-linecap="round"/>`;
  // cerebellum & brainstem
  s += `<path d="M 640,985 L 655,1130 L 700,1130 L 690,990 Z" fill="#e7a7a3" ${st(6)}/>`;
  s += `<ellipse cx="732" cy="1000" rx="74" ry="46" fill="#e7a7a3" ${st(6)}/>`;
  for (let i = 0; i < 4; i++) s += `<path d="M ${672 + i * 6},${978 + i * 14} q 60,${-8 + i * 3} 120,${6 + i * 2}" fill="none" stroke="#c98381" stroke-width="5"/>`;
  s += `</g>`;
  // scent particles from nose to the olfactory bulb
  const sc = k(lt, 0.6, 1.4) * (1 - k(lt, 6.5, 7.5));
  for (let i = 0; i < 9; i++) {
    const ph = ((lt * 0.7 + i / 9) % 1);
    const x = lerp(120, 350, ph), y = lerp(1010, 968, ph) + 14 * Math.sin(ph * 12 + i);
    s += `<circle cx="${f(x)}" cy="${f(y)}" r="${7 + (i % 3) * 2}" fill="#e79ab0" opacity="${f(sc * Math.sin(Math.PI * ph))}"/>`;
  }
  // olfactory bulb
  const bulbOn = k(lt, 1.0, 1.6);
  s += `<ellipse cx="368" cy="966" rx="${f(30 + 5 * bulbOn)}" ry="12" fill="#f3d27a" ${st(5)} transform="rotate(-8 368 966)"/>`;
  s += `<path d="M 396,962 L 455,950" stroke="#f3d27a" stroke-width="12" stroke-linecap="round"/>`;
  // connections to amygdala & hippocampus (glowing, animated)
  const con = k(lt, 1.7, 2.8);
  const pulse = 0.6 + 0.4 * S(t, 6);
  const path1 = 'M 455,950 C 480,945 495,940 515,938', path2 = 'M 455,950 C 500,975 560,968 600,945';
  for (const d of [path1, path2]) {
    s += `<path d="${d}" fill="none" stroke="#fff4c2" stroke-width="22" stroke-linecap="round" opacity="${f(con * 0.6)}"/>`;
    s += `<path d="${d}" fill="none" stroke="${P.mustard}" stroke-width="8" stroke-linecap="round" stroke-dasharray="14 12" stroke-dashoffset="${f(-t * 60)}" opacity="${f(con)}"/>`;
  }
  // amygdala (emotion) & hippocampus (memory)
  const hipOn = k(lt, 6.1, 6.6), amyOn = k(lt, 7.1, 7.6);
  const both = k(lt, 2.2, 3.0);
  const amyGlow = Math.max(amyOn, both * 0.45), hipGlow = Math.max(hipOn, both * 0.45);
  s += `<ellipse cx="520" cy="938" rx="${f(40 + 10 * amyGlow * pulse)}" ry="${f(30 + 8 * amyGlow * pulse)}" fill="#ffd27a" opacity="${f(amyGlow * 0.5)}"/>`;
  s += `<path d="M 600,945 C 640,955 690,945 700,915" fill="none" stroke="#bfe3ff" stroke-width="${f(46 + 12 * hipGlow * pulse)}" stroke-linecap="round" opacity="${f(hipGlow * 0.55)}"/>`;
  s += `<path d="M 548,938 C 590,960 650,958 688,935 C 708,922 712,895 694,888 C 680,884 672,898 682,906" fill="none" stroke="${OL}" stroke-width="30" stroke-linecap="round"/>`;
  s += `<path d="M 548,938 C 590,960 650,958 688,935 C 708,922 712,895 694,888 C 680,884 672,898 682,906" fill="none" stroke="${P.blue}" stroke-width="20" stroke-linecap="round"/>`;
  s += `<path d="M 498,940 C 500,920 528,912 546,926 C 556,940 540,958 520,957 C 506,956 497,950 498,940 Z" fill="${P.terra}" ${st(5)}/>`;
  // labels
  const lab = (x, y, title, sub, col, a, lx, ly, ax, ay, anchor = 'start') => {
    if (a <= 0.01) return '';
    return `<g opacity="${f(a)}" transform="translate(0,${f((1 - a) * 20)})"><path d="M ${lx},${ly} L ${ax},${ay}" stroke="#fff" stroke-width="12" stroke-linecap="round"/><path d="M ${lx},${ly} L ${ax},${ay}" stroke="${OL}" stroke-width="4" stroke-linecap="round"/><circle cx="${ax}" cy="${ay}" r="8" fill="${col}" ${st(4)}/>
      <text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Nunito" font-weight="800" font-size="50" fill="${col}" stroke="#fff" stroke-width="10" paint-order="stroke">${title}</text>
      <text x="${x}" y="${y + 48}" text-anchor="${anchor}" font-family="Nunito" font-weight="700" font-size="36" fill="${OL}" stroke="#fff" stroke-width="8" paint-order="stroke">${sub}</text></g>`;
  };
  s += lab(70, 1330, 'Koku soğanı', 'koku sinyalini işler', '#b8892d', k(lt, 1.1, 1.6) * (1 - k(lt, 5.4, 5.9)), 210, 1290, 362, 978);
  s += lab(640, 400, 'Hipokampus', 'anılar ve hafıza', P.blueDk, hipOn, 760, 450, 660, 930, 'middle');
  s += lab(70, 1330, 'Amigdala', 'duygular', '#b9634e', amyOn, 210, 1290, 518, 950);
  s += sparkles(600, 930, 180, t, 10, Math.max(hipOn, amyOn) * pulse * 0.8, '#ffe9a8');
  return s;
}

// ---------------------------------------------------------------- memory bubble icons
const icon = {
  pot: (t) => `<path d="M -50,-5 L -50,35 Q -50,48 -37,48 L 37,48 Q 50,48 50,35 L 50,-5 Z" fill="${P.blue}" ${st(5)}/><rect x="-58" y="-18" width="116" height="18" rx="8" fill="${P.blueDk}" ${st(5)}/>` + [0, 1, 2].map((i) => `<path d="M ${-20 + i * 20},-30 q 12,-15 0,-30 q -12,-15 0,-30" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity="${f(0.6 + 0.4 * S(t, 3, i))}"/>`).join(''),
  bike: (t) => `<g transform="rotate(${f(S(t, 2) * 3)})"><circle cx="-38" cy="20" r="26" fill="none" ${st(6)}/><circle cx="38" cy="20" r="26" fill="none" ${st(6)}/><path d="M -38,20 L -10,-18 L 25,-18 L 38,20 M -10,-18 L 6,20 L 25,-18 M -14,-30 L -2,-30 M 25,-18 L 22,-34 L 34,-36" fill="none" stroke="${P.terra}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></g>`,
  cake: (t) => `<rect x="-50" y="-5" width="100" height="50" rx="10" fill="#f6c5c4" ${st(5)}/><path d="M -50,10 q 12,12 25,0 t 25,0 t 25,0 t 25,0" fill="none" stroke="#fff" stroke-width="6"/><rect x="-36" y="-35" width="72" height="30" rx="8" fill="${P.cream}" ${st(5)}/>` + [-18, 0, 18].map((x, i) => `<rect x="${x - 4}" y="-58" width="8" height="24" fill="${P.blue}" ${st(3)}/><path d="M ${x},-70 q ${f(5 * S(t, 9, i))},-8 0,-16 q -6,8 0,16 Z" fill="${P.mustard}" ${st(2)}/>`).join(''),
  sea: (t) => `<circle cx="22" cy="-20" r="22" fill="${P.mustard}" ${st(5)}/><path d="M -60,15 q 15,${f(-10 + 4 * S(t, 2))} 30,0 t 30,0 t 30,0 t 30,0 L 60,50 L -60,50 Z" fill="${P.blue}" ${st(5)}/><path d="M -40,-20 l 14,-26 l 14,26 Z" fill="${P.terra}" ${st(4)}/>`,
  kite: (t) => `<g transform="rotate(${f(S(t, 1.7) * 8)})"><path d="M 0,-55 L 35,-5 L 0,45 L -35,-5 Z" fill="${P.rose}" ${st(5)}/><path d="M 0,-55 L 0,45 M -35,-5 L 35,-5" ${st(4)}/><path d="M 0,45 q 20,15 0,30 q -20,15 0,30" fill="none" ${st(4)}/></g>`,
  granny: (t) => `<circle cx="0" cy="-48" r="16" fill="#c9c3bc" ${st(4)}/><circle cx="0" cy="-8" r="38" fill="${P.skin}" ${st(5)}/><path d="M -38,-14 C -36,-50 36,-50 38,-14 C 20,-34 -20,-34 -38,-14 Z" fill="#cfc9c2" ${st(4)}/><circle cx="-14" cy="-4" r="10" fill="none" ${st(3)}/><circle cx="14" cy="-4" r="10" fill="none" ${st(3)}/><path d="M -10,16 Q 0,26 10,16" fill="none" ${st(4)}/><path d="M -40,60 Q 0,20 40,60" fill="${P.plum}" ${st(5)}/>`,
};
function bubble(x, y, r, kind, t, a, warm) {
  if (a <= 0.01) return '';
  const pop = a < 1 ? 1 + 0.25 * Math.sin(Math.PI * a) : 1;
  const bob = 10 * S(t, 1.3, x);
  let s = `<g transform="translate(${f(x)},${f(y + bob)}) scale(${f(a * pop)})">`;
  if (warm > 0) s += `<circle r="${f(r + 26)}" fill="#ffd98a" opacity="${f(warm * (0.45 + 0.15 * S(t, 4, x)))}"/>`;
  s += `<circle r="${r}" fill="#fbf4e8" ${st(7)}/><g transform="scale(${f(r / 95)})">${icon[kind](t)}</g>`;
  s += `<circle cx="${f(-r * 0.5)}" cy="${f(-r * 0.55)}" r="${f(r * 0.12)}" fill="#fff"/>`;
  if (warm > 0) for (let i = 0; i < 2; i++) { const ph = (t * 0.6 + i * 0.5 + x * 0.001) % 1; s += `<path transform="translate(${f(r * 0.7 + i * 20)},${f(-r * 0.6 - ph * 90)}) scale(${f(0.6 + i * 0.2)})" d="M 0,14 C -24,-2 -12,-22 0,-8 C 12,-22 24,-2 0,14 Z" fill="${P.terra}" opacity="${f(warm * Math.sin(Math.PI * ph))}"/>`; }
  return s + `</g>`;
}

// ---------------------------------------------------------------- scene 4: flower & memories
function scene4(t, t0) {
  const lt = t - t0;
  let s = `<rect width="${W}" height="${H}" fill="#dfe9e0"/>`;
  s += `<rect y="1250" width="${W}" height="670" fill="#cddcc8"/>`;
  for (let i = 0; i < 9; i++) s += `<circle cx="${i * 140 - 20}" cy="${1250 + 30 * S(i, 1.7)}" r="${110 + (i % 3) * 30}" fill="${i % 2 ? P.greenDk : P.green}" ${st(6)}/>`;
  for (let i = 0; i < 10; i++) { const x = (i * 211) % W, y = 200 + (i * 347) % 900; s += `<circle cx="${f(x + 20 * S(t, 0.7, i))}" cy="${f(y)}" r="${30 + (i % 4) * 14}" fill="#fff8e0" opacity="${f(0.18 + 0.08 * S(t, 1.1, i))}"/>`; }
  const sniff = k(lt, 0.0, 0.6);
  const closed = lt > 1.1;
  const pose = person({ t, armUp: sniff, holding: 'flower', flowerAng: -32, eyes: closed ? 'closed' : 'open', inhale: lt > 0.5 && lt < 1.0 ? 1 : 0,
    mouth: closed ? lerp(0.7, 1, k(t, 24.0, 24.8)) : 0.5, tilt: -4 + 2 * S(t, 1.1), blush: k(t, 24.1, 25.0), blink: blinkAt(lt, [0.35]) });
  s += `<g transform="translate(540,1250) scale(1.55)">${pose}</g>`;
  s += scentWisps(540 + 1.55 * 60, 1250 - 1.55 * 140, 540 + 1.55 * 12, 1250 - 1.55 * 126, t, k(lt, 0.4, 0.8) * (1 - k(lt, 1.8, 2.4)), '#f0b3b8', 2);
  // memories pop up one by one
  const warm = k(t, 24.1, 24.8);
  const items = [[220, 520, 'granny', 1.3], [860, 520, 'cake', 1.9], [170, 900, 'bike', 2.5], [910, 900, 'sea', 3.0], [540, 300, 'kite', 3.5]];
  items.forEach(([x, y, kind, at]) => { s += bubble(x, y, 105, kind, t, clamp((lt - at) / 0.35), warm); });
  s += sparkles(540, 650, 420, t, 14, warm * 0.9);
  return s;
}

// ---------------------------------------------------------------- scene 5: by the window
function scene5(t, t0) {
  const lt = t - t0;
  let s = `<rect width="${W}" height="${H}" fill="#e7d6c6"/>`;
  // window (right)
  s += `<rect x="560" y="260" width="460" height="900" rx="26" fill="url(#sunset)" ${st(9)}/>`;
  s += `<circle cx="790" cy="${f(820 + lt * 6)}" r="80" fill="#fbe2a8" opacity="0.95"/>`;
  s += `<path d="M 560,900 Q 660,820 760,880 T 1020,850 L 1020,1160 L 560,1160 Z" fill="#b99aa3" opacity="0.8"/><path d="M 560,990 Q 700,930 820,980 T 1020,960 L 1020,1160 L 560,1160 Z" fill="#9b7d8c"/>`;
  for (let i = 0; i < 3; i++) { const bx = 620 + ((lt * 30 + i * 140) % 420); s += `<path d="M ${f(bx)},${400 + i * 60} q 10,-8 20,0 q 10,-8 20,0" fill="none" ${st(4)}/>`; }
  s += `<line x1="790" y1="260" x2="790" y2="1160" ${st(9)}/><line x1="560" y1="700" x2="1020" y2="700" ${st(9)}/>`;
  s += `<rect x="530" y="1150" width="520" height="40" rx="12" fill="${P.wood}" ${st(6)}/>`;
  // curtain swaying
  const sw = 18 * S(t, 0.9);
  s += `<path d="M 520,220 L 640,220 Q ${f(610 + sw)},700 ${f(590 + sw)},1200 L 520,1200 Z" fill="${P.blue}" ${st(7)}/>`;
  for (let i = 1; i < 4; i++) s += `<line x1="${520 + i * 30}" y1="225" x2="${f(520 + i * 22 + sw * 0.6)}" y2="1195" stroke="#a9bfd0" stroke-width="8"/>`;
  s += `<rect x="500" y="200" width="560" height="24" rx="12" fill="${P.woodDk}" ${st(5)}/>`;
  // plant on sill
  s += `<g transform="translate(940,1150)"><path d="M -40,0 L -30,-70 L 30,-70 L 40,0 Z" fill="${P.terra}" ${st(5)}/>${[-1, 0, 1].map((i) => `<path d="M 0,-70 C ${i * 40},-140 ${i * 70 + f(6 * S(t, 1.5, i))},-170 ${i * 60},-200" fill="none" stroke="${P.greenDk}" stroke-width="10" stroke-linecap="round"/><ellipse cx="${i * 60}" cy="-200" rx="20" ry="32" fill="${P.green}" ${st(4)} transform="rotate(${i * 30} ${i * 60} -200)"/>`).join('')}</g>`;
  // window seat cushion
  s += `<rect x="-20" y="1500" width="1120" height="440" fill="#c9a98f" ${st(7)}/><rect x="60" y="1300" width="300" height="220" rx="60" fill="${P.rose}" ${st(7)}/>`;
  // light beam
  s += `<path d="M 560,300 L 1020,300 L 600,1900 L 0,1900 Z" fill="#ffe6b0" opacity="${f(0.16 + 0.04 * S(t, 0.9))}"/>`;
  // character, seated, gazing out, holding flower at chest
  const pose = person({ t, armUp: 0.45, handPos: [70, 150], holding: 'flower', flowerAng: 8, eyes: 'soft', look: [1, 0.2], blink: blinkAt(lt, [1.6, 4.6]),
    mouth: 0.75, tilt: 7 + 1.5 * S(t, 0.9), blush: 0.4, brow: 2 });
  const push = 1 + 0.05 * k(lt, 0, 6.5);
  s += `<g transform="translate(400,1500) scale(${f(1.45 * push)})">${pose}</g>`;
  // gentle floating petals
  for (let i = 0; i < 6; i++) { const ph = (lt * 0.12 + i / 6) % 1; s += `<ellipse cx="${f(200 + i * 140 + 40 * S(t, 1, i))}" cy="${f(200 + ph * 1500)}" rx="10" ry="6" fill="#f6c5c4" opacity="${f(0.7 * Math.sin(Math.PI * ph))}" transform="rotate(${f(t * 40 + i * 60)} ${f(200 + i * 140)} ${f(200 + ph * 1500)})"/>`; }
  return s;
}
function endCard(t, t0) {
  const a = k(t, t0, t0 + 0.8);
  if (a <= 0) return '';
  return `<g opacity="${f(a)}"><rect width="${W}" height="${H}" fill="${P.cream}"/>
  <g transform="translate(540,880) scale(${f(0.9 + 0.1 * a)})"><circle r="120" fill="${P.sage}" ${st(8)}/>
  <path d="M 30,95 C 30,60 50,40 60,10 C 70,-30 60,-80 10,-95 C -40,-108 -85,-70 -85,-20 C -85,10 -95,25 -105,40 C -95,48 -85,50 -85,60 C -85,85 -60,95 -30,92 L -30,118" fill="${P.cream}" ${st(6)}/>
  <circle cx="-15" cy="-35" r="22" fill="${P.mustard}" ${st(5)}/><path d="M -15,-13 C -10,10 10,20 25,25" fill="none" stroke="${P.terra}" stroke-width="6" stroke-linecap="round"/></g>
  <text x="540" y="1110" text-anchor="middle" font-family="Nunito" font-weight="800" font-size="92" fill="${OL}">İnsan Atlası</text>
  <rect x="${f(540 - 170 * a)}" y="1140" width="${f(340 * a)}" height="10" rx="5" fill="${P.mustard}"/></g>`;
}

// ---------------------------------------------------------------- composition & transitions
const T = { s2: 4.75, s3: 10.25, s4: 20.15, s5: 27.15, end: 33.4, total: 35 };
function defs(frame) {
  return `<defs>
  <radialGradient id="vigWarm" cx="0.5" cy="0.5" r="0.75"><stop offset="0.55" stop-color="#5a3a20" stop-opacity="0"/><stop offset="1" stop-color="#5a3a20" stop-opacity="0.45"/></radialGradient>
  <radialGradient id="vig" cx="0.5" cy="0.5" r="0.8"><stop offset="0.6" stop-color="#3d2e2a" stop-opacity="0"/><stop offset="1" stop-color="#3d2e2a" stop-opacity="0.22"/></radialGradient>
  <linearGradient id="sunset" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b9c4dc"/><stop offset="0.55" stop-color="#f3c3a6"/><stop offset="1" stop-color="#f6d9a6"/></linearGradient>
  <filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${frame % 7}"/><feColorMatrix type="saturate" values="0"/></filter>
  <filter id="soft"><feGaussianBlur stdDeviation="6"/></filter>
  </defs>`;
}
function cam(t, a, b, inner, z0 = 1, z1 = 1.04, ox = 540, oy = 960) {
  const z = lerp(z0, z1, clamp((t - a) / (b - a)));
  const dx = 4 * S(t, 0.7), dy = 3 * S(t, 0.9, 1);
  return `<g transform="translate(${f(ox + dx)},${f(oy + dy)}) scale(${f(z)}) translate(${-ox},${-oy})">${inner}</g>`;
}
function build(t, frame) {
  let s = defs(frame);
  // scene 1 -> 2: memory circle opening from the character's head
  if (t < T.s2 + 0.6) s += cam(t, 0, T.s2 + 0.6, scene1(t), 1, 1.06, 540, 900);
  if (t >= T.s2 - 0.1 && t < T.s3 + 0.6) {
    const r = lerp(0, 1500, k(t, T.s2 - 0.1, T.s2 + 0.6));
    const inner = cam(t, T.s2 - 0.1, T.s3 + 0.6, scene2(t), 1.08, 1.0, 540, 1100);
    if (r < 1499) s += `<clipPath id="memc"><circle cx="540" cy="910" r="${f(r)}"/></clipPath><g clip-path="url(#memc)">${inner}</g><circle cx="540" cy="910" r="${f(r)}" fill="none" stroke="#f3c97c" stroke-width="${f(20 * (1 - r / 1500))}" opacity="0.9"/>`;
    else s += inner;
  }
  // 2 -> 3 crossfade with slight zoom
  if (t >= T.s3 - 0.1 && t < T.s4 + 0.6) { const a = k(t, T.s3 - 0.1, T.s3 + 0.5); s += `<g opacity="${f(a)}">${cam(t, T.s3, T.s4 + 0.6, scene3(t, T.s3), 1.04, 1.0)}</g>`; }
  if (t >= T.s4 - 0.1 && t < T.s5 + 0.6) { const a = k(t, T.s4 - 0.1, T.s4 + 0.5); s += `<g opacity="${f(a)}">${cam(t, T.s4, T.s5 + 0.6, scene4(t, T.s4), 1.0, 1.05, 540, 800)}</g>`; }
  if (t >= T.s5 - 0.1) { const a = k(t, T.s5 - 0.1, T.s5 + 0.6); s += `<g opacity="${f(a)}">${cam(t, T.s5, T.total, scene5(t, T.s5), 1.0, 1.03, 400, 1200)}</g>`; }
  s += endCard(t, T.end);
  s += `<rect width="${W}" height="${H}" fill="url(#vig)"/>`;
  s += `<rect width="${W}" height="${H}" filter="url(#grain)" opacity="0.06"/>`;
  return s;
}
window.T = T;
window.build = build;
