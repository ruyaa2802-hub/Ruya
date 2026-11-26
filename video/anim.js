'use strict';
/* "Dinlendi" – 9:16 kısa animasyon. Tamamen kodla çizilir (HTML Canvas).
   render(t) deterministiktir: aynı t her zaman aynı kareyi verir. */
const W = 1080, H = 1920, DUR = 74, FPS = 30;
const cv = document.getElementById('c'); cv.width = W; cv.height = H;
const ctx = cv.getContext('2d');
const FONT = '"DejaVu Sans","Liberation Sans",Arial,sans-serif';
const SERIF = '"DejaVu Serif","Liberation Serif",Georgia,serif';
const EMOJI = '"Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji"';

// ---------- yardımcılar ----------
const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
const lerp = (a, b, t) => a + (b - a) * t;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const eio = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const eo = t => { t = clamp(t); return 1 - Math.pow(1 - t, 3); };
const win = (t, a, b, f = .4) => ss(a, a + f, t) * (1 - ss(b - f, b, t));
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const R = mulberry(7);
const arr = (n, f) => Array.from({ length: n }, (_, i) => f(i));

const RAIN = arr(260, () => ({ x: R() * W * 1.3 - W * .15, p: R(), l: 30 + R() * 80, v: 1500 + R() * 900, a: .12 + R() * .3, w: 1 + R() * 1.6 }));
const DROPS = arr(150, () => ({ x: R(), y: R(), r: 2 + R() * R() * 15, s: R() < .12 ? (.03 + R() * .08) : 0, ph: R() }));
const BOKEH = arr(50, () => ({ x: R(), y: R(), r: 20 + R() * 80, h: R(), a: .12 + R() * .3, ph: R() * 6.28 }));
const SNOW = arr(170, () => ({ x: R(), p: R(), r: 1.5 + R() * 5, v: .05 + R() * .08, sw: R() * 6.28 }));
const LEAF = arr(26, () => ({ x: R(), p: R(), r: 8 + R() * 12, v: .12 + R() * .1, sw: R() * 6.28, c: ['#c4622d', '#d98b2b', '#8c3b1f', '#b5762c'][R() * 4 | 0] }));
const PETAL = arr(60, () => ({ x: R(), p: R(), r: 4 + R() * 6, v: .05 + R() * .06, sw: R() * 6.28 }));
const STARS = arr(120, () => ({ x: R(), y: R() * .6, r: .6 + R() * 1.8, ph: R() * 6.28 }));
const WAVE = arr(40, () => .25 + R() * .75);
const VOICE = arr(40, i => ({ k: 'v', d: `0:${String(5 + (R() * 50 | 0)).padStart(2, '0')}`, tm: `${String(23 - (i / 9 | 0)).padStart(2, '0')}:${String(59 - (i * 7) % 60).padStart(2, '0')}`, out: true, read: true, seed: i }));

// grain dokuları
const GRAIN = arr(4, () => { const c = document.createElement('canvas'); c.width = c.height = 300; const g = c.getContext('2d'); const d = g.createImageData(300, 300); for (let i = 0; i < d.data.length; i += 4) { const v = R() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } g.putImageData(d, 0, 0); return c; });

function rrect(x, y, w, h, r, c = ctx) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function grad(x0, y0, x1, y1, stops) { const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; }
function glow(x, y, r, col, a, comp = 'lighter') { if (a <= 0) return; ctx.save(); ctx.globalCompositeOperation = comp; const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(.4, `rgba(${col},${a * .4})`); g.addColorStop(1, `rgba(${col},0)`); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore(); }
function black(a) { if (a <= 0) return; ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = clamp(a); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
function cam(z, cx, cy, rot = 0) { ctx.translate(W / 2, H / 2); ctx.rotate(rot); ctx.scale(z, z); ctx.translate(-cx, -cy); }
function text(s, x, y, size, o = {}) {
  ctx.save(); ctx.globalAlpha *= (o.alpha ?? 1);
  ctx.font = `${o.italic ? 'italic ' : ''}${o.weight || 400} ${size}px ${o.font || FONT}`;
  ctx.textAlign = o.align || 'center'; ctx.textBaseline = o.base || 'alphabetic';
  if (o.spacing) ctx.letterSpacing = o.spacing + 'px';
  if (o.shadow) { ctx.shadowColor = o.shadow; ctx.shadowBlur = o.blur ?? 18; }
  ctx.fillStyle = o.color || '#fff'; ctx.fillText(s, x, y); ctx.restore();
}
function wrap(s, maxW, font) { ctx.save(); ctx.font = font; const words = s.split(' '); const lines = []; let cur = ''; for (const w of words) { const tst = cur ? cur + ' ' + w : w; if (ctx.measureText(tst).width > maxW && cur) { lines.push(cur); cur = w; } else cur = tst; } if (cur) lines.push(cur); ctx.restore(); return lines; }

// ---------- ortam efektleri ----------
function rain(t, o = {}) {
  const { alpha = 1, col = '180,200,235', speed = 1, ang = .12, count = 260, len = 1, x = 0, y = 0, w = W, h = H } = o;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.strokeStyle = `rgb(${col})`; ctx.lineCap = 'round';
  const span = h * 1.3;
  for (let i = 0; i < count; i++) {
    const d = RAIN[i]; const yy = ((d.p * span + t * d.v * speed) % span) - h * .15; const xx = x + (d.x / W) * w + yy * ang;
    ctx.globalAlpha = d.a * alpha; ctx.lineWidth = d.w; ctx.beginPath(); ctx.moveTo(xx, y + yy); ctx.lineTo(xx - d.l * len * ang, y + yy - d.l * len); ctx.stroke();
  }
  ctx.restore();
}
function glassDrops(t, x, y, w, h, col = '200,220,255', alpha = 1, n = 150) {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  for (let i = 0; i < n; i++) {
    const d = DROPS[i]; let dy = d.y; if (d.s) dy = (d.y + t * d.s * (0.6 + .4 * Math.sin(t * 2 + d.ph * 9))) % 1.1;
    const px = x + d.x * w, py = y + dy * h, r = d.r;
    if (d.s) { ctx.globalAlpha = .18 * alpha; ctx.strokeStyle = `rgb(${col})`; ctx.lineWidth = r * .5; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.sin(dy * 30) * 3, py - 120); ctx.stroke(); }
    const g = ctx.createRadialGradient(px - r * .3, py - r * .3, 0, px, py, r);
    g.addColorStop(0, `rgba(${col},${.05 * alpha})`); g.addColorStop(.7, `rgba(${col},${.12 * alpha})`); g.addColorStop(1, `rgba(${col},${.35 * alpha})`);
    ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, r, 0, 6.283); ctx.fill();
    ctx.fillStyle = `rgba(255,255,255,${.5 * alpha})`; ctx.beginPath(); ctx.arc(px - r * .35, py - r * .35, r * .18, 0, 6.283); ctx.fill();
  }
  ctx.restore();
}
function bokeh(t, x, y, w, h, pal, alpha = 1, sc = 1, n = 50) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const b = BOKEH[i]; const col = pal[(b.h * pal.length) | 0]; const r = b.r * sc;
    const px = x + b.x * w + Math.sin(t * .3 + b.ph) * 10, py = y + b.y * h;
    const a = b.a * alpha * (.75 + .25 * Math.sin(t * 1.3 + b.ph));
    const g = ctx.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(.75, `rgba(${col},${a * .7})`); g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, r, 0, 6.283); ctx.fill();
  }
  ctx.restore();
}
function moon(x, y, r, a = 1, tint = '235,240,255') {
  glow(x, y, r * 5, tint, .18 * a); glow(x, y, r * 2, tint, .25 * a);
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = `rgb(${tint})`; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.07)'; [[-.3, -.2, .22], [.25, .15, .16], [-.05, .35, .12], [.35, -.3, .09]].forEach(([a1, b1, c1]) => { ctx.beginPath(); ctx.arc(x + a1 * r, y + b1 * r, c1 * r, 0, 6.283); ctx.fill(); });
  ctx.restore();
}
function grain(t, a = .07) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = a; ctx.globalCompositeOperation = 'overlay'; const f = Math.floor(t * FPS); const p = ctx.createPattern(GRAIN[f % 4], 'repeat'); ctx.translate((f * 97) % 300, (f * 61) % 300); ctx.fillStyle = p; ctx.fillRect(-300, -300, W + 600, H + 600); ctx.restore(); }
function vignette(a = .65) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); const g = ctx.createRadialGradient(W / 2, H / 2, H * .25, W / 2, H / 2, H * .75); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${a})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore(); }

// ---------- ✓✓ motifi ----------
function ticks(x, y, s, col) { ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = s * .16; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; for (const dx of [0, s * .42]) { ctx.beginPath(); ctx.moveTo(x + dx, y); ctx.lineTo(x + dx + s * .28, y + s * .3); ctx.lineTo(x + dx + s * .78, y - s * .38); ctx.stroke(); } ctx.restore(); }
const BLUE = '#53bdeb', GREY = '#8696a0';
function chip(x, y, a, label = 'Dinlendi', sc = 1) {
  if (a <= 0) return; ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.scale(sc * (.9 + .1 * eo(a)), sc * (.9 + .1 * eo(a)));
  ctx.font = `500 34px ${FONT}`; const tw = ctx.measureText(label).width; const w = tw + 110, h = 66;
  ctx.fillStyle = 'rgba(10,16,24,.78)'; rrect(-w / 2, -h / 2, w, h, h / 2); ctx.fill();
  ctx.strokeStyle = 'rgba(83,189,235,.5)'; ctx.lineWidth = 2; ctx.stroke();
  ticks(-w / 2 + 26, 2, 30, BLUE); ctx.fillStyle = '#dfe9ef'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillText(label, -w / 2 + 82, 2);
  ctx.restore();
}
function heart(x, y, s, col = '#fff') { ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, .35); ctx.bezierCurveTo(-.9, -.25, -.5, -1, 0, -.5); ctx.bezierCurveTo(.5, -1, .9, -.25, 0, .35); ctx.fill(); ctx.restore(); }

// ---------- telefon arayüzü (sanal genişlik 400) ----------
function phone(x, y, w, h, drawScreen, o = {}) {
  const { glowA = .5, glowCol = '120,170,255', rot = 0 } = o;
  ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(rot); ctx.translate(-w / 2, -h / 2);
  if (glowA > 0) glow(w / 2, h / 2, Math.max(w, h) * .9, glowCol, .22 * glowA);
  ctx.fillStyle = '#05070b'; rrect(0, 0, w, h, w * .12); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = Math.max(1, w * .006); ctx.stroke();
  const m = w * .035; ctx.save(); rrect(m, m, w - 2 * m, h - 2 * m, w * .1); ctx.clip(); ctx.translate(m, m);
  const k = (w - 2 * m) / 400; ctx.scale(k, k); drawScreen((h - 2 * m) / k);
  ctx.restore();
  // ekran parlaması
  ctx.save(); rrect(m, m, w - 2 * m, h - 2 * m, w * .1); ctx.clip(); ctx.fillStyle = grad(0, 0, w, h, [[0, 'rgba(255,255,255,.06)'], [.4, 'rgba(255,255,255,0)'], [1, 'rgba(255,255,255,0)']]); ctx.fillRect(0, 0, w, h); ctx.restore();
  ctx.restore();
}
function voiceBubble(x, y, m, seed, out) {
  const w = 268, h = 66; ctx.fillStyle = out ? '#1d4b46' : '#232e38'; rrect(x, y, w, h, 14); ctx.fill();
  ctx.fillStyle = '#c9d6dc'; ctx.beginPath(); ctx.moveTo(x + 18, y + 18); ctx.lineTo(x + 38, y + 30); ctx.lineTo(x + 18, y + 42); ctx.fill();
  for (let i = 0; i < 30; i++) { const bh = 4 + WAVE[(i + seed * 3) % 40] * 24; ctx.fillStyle = m.played ? (i < 30 * m.played ? BLUE : '#7d8f98') : (out ? '#9bb6b2' : '#9aa7ae'); rrect(x + 52 + i * 5.6, y + 30 - bh / 2, 3, bh, 1.5); ctx.fill(); }
  ctx.font = `12px ${FONT}`; ctx.fillStyle = '#9fb2b8'; ctx.textAlign = 'left'; ctx.fillText(m.d, x + 52, y + 58);
  ctx.textAlign = 'right'; ctx.fillText(m.tm, x + w - (out ? 38 : 10), y + 58);
  if (out) ticks(x + w - 32, y + 53, 14, m.read ? BLUE : GREY);
  return h;
}
function chatScreen(vh, o) {
  const name = o.name || 'Emre';
  ctx.fillStyle = '#0c1319'; ctx.fillRect(0, 0, 400, vh);
  // hafif desen
  ctx.fillStyle = 'rgba(255,255,255,.018)'; for (let i = 0; i < 60; i++) { ctx.beginPath(); ctx.arc((i * 73) % 400, (i * 131) % vh, 6 + (i % 5) * 3, 0, 6.283); ctx.fill(); }
  const bottom = o.keyboard ? 250 : 0; const barH = 62; const top = 78;
  // mesajlar
  ctx.save(); ctx.beginPath(); ctx.rect(0, top, 400, vh - top - barH - bottom); ctx.clip();
  let y = vh - bottom - barH - 10 + (o.scroll || 0);
  const msgs = o.msgs || [];
  for (let i = 0; i < msgs.length && y > top - 200; i++) {
    const m = msgs[i]; const a = m.appear ?? 1;
    if (m.k === 'v') { y -= 66 * a; ctx.save(); ctx.globalAlpha = a; voiceBubble(m.out ? 400 - 12 - 268 : 12, y, m, m.seed || i, m.out); ctx.restore(); }
    else if (m.k === 't') {
      const font = `17px ${FONT}`; const lines = wrap(m.text, 270, font); const lh = 24; const hh = Math.max(1, lines.length) * lh + 36;
      ctx.font = font; const tw = Math.max(80, ...lines.map(l => ctx.measureText(l).width)); const bw = Math.min(300, tw + 28);
      y -= hh; const bx = m.out ? 400 - 12 - bw : 12;
      ctx.fillStyle = m.out ? '#1d4b46' : '#222d37'; rrect(bx, y, bw, hh, 14); ctx.fill();
      ctx.fillStyle = '#e9edef'; ctx.textAlign = 'left'; lines.forEach((l, j) => ctx.fillText(l, bx + 14, y + 26 + j * lh));
      if (m.caret) { const lw = ctx.measureText(lines[lines.length - 1] || '').width; ctx.fillRect(bx + 16 + lw, y + 10 + (lines.length - 1) * lh, 2, 20); }
      ctx.font = `11px ${FONT}`; ctx.fillStyle = '#8fa1a9'; ctx.textAlign = 'right'; ctx.fillText(m.tm || '', bx + bw - 10, y + hh - 8);
    }
    y -= 8;
  }
  ctx.restore();
  // başlık
  ctx.fillStyle = '#16202a'; ctx.fillRect(0, 0, 400, top);
  ctx.strokeStyle = '#c9d6dc'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(24, 30); ctx.lineTo(14, 40); ctx.lineTo(24, 50); ctx.stroke();
  const ag = ctx.createLinearGradient(40, 18, 84, 62); ag.addColorStop(0, o.avatar || '#3f6f8f'); ag.addColorStop(1, '#22384a');
  ctx.fillStyle = ag; ctx.beginPath(); ctx.arc(62, 40, 22, 0, 6.283); ctx.fill();
  ctx.fillStyle = '#e8eef2'; ctx.font = `600 20px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(name[0], 62, 47);
  ctx.textAlign = 'left'; ctx.fillStyle = '#e9edef'; ctx.font = `600 20px ${FONT}`; ctx.fillText(name, 96, o.status ? 36 : 47);
  if (o.status) { ctx.font = `14px ${FONT}`; ctx.fillStyle = o.statusCol || '#8696a0'; ctx.fillText(o.status, 96, 58); }
  if (o.count) { ctx.font = `13px ${FONT}`; ctx.fillStyle = '#8696a0'; ctx.textAlign = 'right'; ctx.fillText(o.count, 386, 47); }
  // giriş çubuğu
  const by = vh - bottom - barH;
  ctx.fillStyle = '#0c1319'; ctx.fillRect(0, by, 400, barH);
  if (o.recording != null) {
    const r = o.recording; ctx.fillStyle = '#1f2c34'; rrect(10, by + 8, 300, 46, 23); ctx.fill();
    ctx.fillStyle = `rgba(240,70,70,${.55 + .45 * Math.sin(r * 6)})`; ctx.beginPath(); ctx.arc(34, by + 31, 7, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#e9edef'; ctx.font = `16px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(`0:${String(Math.floor(r)).padStart(2, '0')}`, 50, by + 37);
    ctx.fillStyle = '#8696a0'; ctx.font = `13px ${FONT}`; ctx.fillText('‹ iptal için kaydır', 150, by + 36);
    ctx.fillStyle = '#1f8f7a'; ctx.beginPath(); ctx.arc(354, by + 31, 30 + 3 * Math.sin(r * 5), 0, 6.283); ctx.fill();
  } else {
    ctx.fillStyle = '#1f2c34'; rrect(10, by + 8, 320, 46, 23); ctx.fill();
    ctx.font = `16px ${FONT}`; ctx.textAlign = 'left';
    if (o.input != null) { ctx.fillStyle = '#e9edef'; ctx.fillText(o.input, 28, by + 37); const iw = ctx.measureText(o.input).width; if (Math.floor((o.caretT || 0) * 2.2) % 2 === 0) ctx.fillRect(30 + iw, by + 20, 2, 22); }
    else { ctx.fillStyle = '#8696a0'; ctx.fillText('Mesaj', 28, by + 37); }
    ctx.fillStyle = '#1f8f7a'; ctx.beginPath(); ctx.arc(362, by + 31, 24, 0, 6.283); ctx.fill();
  }
  // mikrofon simgesi
  const mx = o.recording != null ? 354 : 362; ctx.fillStyle = '#fff'; rrect(mx - 5, by + 19, 10, 16, 5); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(mx, by + 29, 9, 0.1, Math.PI - .1); ctx.stroke(); ctx.beginPath(); ctx.moveTo(mx, by + 38); ctx.lineTo(mx, by + 43); ctx.stroke();
  if (o.keyboard) keyboard(vh - bottom, bottom, o.keyT || 0);
}
function keyboard(y, h, t) {
  ctx.fillStyle = '#1b1f23'; ctx.fillRect(0, y, 400, h);
  const rows = [10, 9, 7]; const kw = 34, kh = 46;
  rows.forEach((n, ri) => { const ox = (400 - n * 38) / 2 + (ri === 2 ? 0 : 0); for (let i = 0; i < n; i++) { const hot = Math.floor(t * 7) % 26 === ri * 9 + i; ctx.fillStyle = hot ? '#5a6168' : '#3a3f44'; rrect(ox + i * 38 + 2, y + 12 + ri * 56, kw, kh, 6); ctx.fill(); } });
  ctx.fillStyle = '#3a3f44'; rrect(100, y + 182, 200, 46, 6); ctx.fill();
}
function lockScreen(vh, o) {
  const on = o.on ?? 1;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 400, vh);
  if (on <= 0) return;
  ctx.save(); ctx.globalAlpha = on;
  couplePhoto(400, vh); ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, 0, 400, vh);
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = `15px ${FONT}`; ctx.fillText('Perşembe, 14 Kasım', 200, 92);
  ctx.font = `300 84px ${FONT}`; ctx.fillText('03:12', 200, 180);
  const na = o.notif ?? 0;
  if (na > 0) {
    ctx.save(); ctx.globalAlpha = on * na; ctx.translate(0, (1 - eo(na)) * -30);
    ctx.fillStyle = 'rgba(30,30,34,.78)'; rrect(16, 232, 368, 92, 20); ctx.fill();
    ctx.fillStyle = '#1f8f7a'; rrect(30, 248, 40, 40, 10); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(50, 266, 11, 0, 6.283); ctx.fill(); ctx.beginPath(); ctx.moveTo(42, 272); ctx.lineTo(39, 281); ctx.lineTo(48, 276); ctx.fill();
    ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = `600 17px ${FONT}`; ctx.fillText('Zeynep', 84, 264);
    ctx.font = `15px ${FONT}`; ctx.fillStyle = '#d0d4d8'; ctx.fillText('🎤 Sesli mesaj (0:14)', 84, 292);
    ctx.textAlign = 'right'; ctx.font = `13px ${FONT}`; ctx.fillStyle = '#aeb3b8'; ctx.fillText('şimdi', 370, 262);
    ctx.restore();
  }
  ctx.restore();
}

// ---------- Emre fotoğrafları ----------
function cartoonHead(x, y, r, o) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot || 0);
  ctx.fillStyle = o.cloth; rrect(-r * 1.5, r * .95, r * 3, r * 2.2, r * .9); ctx.fill();
  ctx.fillStyle = o.skin; ctx.fillRect(-r * .3, r * .6, r * .6, r * .6);
  if (o.long) { ctx.fillStyle = o.hair; ctx.beginPath(); ctx.ellipse(0, r * .3, r * 1.2, r * 1.55, 0, 0, 6.283); ctx.fill(); }
  ctx.fillStyle = o.skin; ctx.beginPath(); ctx.ellipse(0, 0, r * .92, r, 0, 0, 6.283); ctx.fill();
  ctx.fillStyle = o.hair; ctx.beginPath();
  if (o.long) { ctx.ellipse(0, -r * .55, r * 1.0, r * .6, 0, Math.PI, 0); ctx.fill(); ctx.beginPath(); ctx.ellipse(r * .3, -r * .5, r * .7, r * .38, -.4, 0, 6.283); }
  else { ctx.ellipse(0, -r * .5, r * .98, r * .62, 0, Math.PI * 1.02, -0.02); ctx.fill(); ctx.beginPath(); ctx.ellipse(-r * .2, -r * .72, r * .8, r * .35, .2, 0, 6.283); }
  ctx.fill();
  ctx.strokeStyle = '#3a2418'; ctx.lineWidth = r * .09; ctx.lineCap = 'round';
  [-1, 1].forEach(sd => { ctx.beginPath(); ctx.arc(sd * r * .36, r * .02, r * .15, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); });
  ctx.fillStyle = 'rgba(230,110,110,.35)'; [-1, 1].forEach(sd => { ctx.beginPath(); ctx.arc(sd * r * .55, r * .3, r * .16, 0, 6.283); ctx.fill(); });
  ctx.fillStyle = '#5a2620'; ctx.beginPath(); ctx.arc(0, r * .35, r * .32, .1, Math.PI - .1); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillRect(-r * .2, r * .36, r * .4, r * .07);
  ctx.restore();
}
function couplePhoto(w, h, sat = 1) {
  ctx.fillStyle = grad(0, 0, 0, h, [[0, '#f0a35e'], [.45, '#d4706b'], [.75, '#6c4462'], [1, '#2c2236']]); ctx.fillRect(0, 0, w, h);
  glow(w * .7, h * .33, w * .5, '255,220,150', .6);
  ctx.fillStyle = 'rgba(40,20,40,.5)'; ctx.fillRect(0, h * .62, w, h * .38);
  const r = w * .14;
  cartoonHead(w * .38, h * .56, r, { skin: '#e9b99a', hair: '#2a1a14', cloth: '#a3495a', long: true, rot: .16 });
  cartoonHead(w * .62, h * .53, r * 1.05, { skin: '#d9a582', hair: '#1c120c', cloth: '#4b5a3a', rot: -.12 });
}
function emrePortrait(x, y, w, h, light = 1) {
  ctx.save();
  ctx.fillStyle = '#20140b'; ctx.fillRect(x - 16, y - 16, w + 32, h + 32);
  ctx.fillStyle = '#c9a77a'; ctx.fillRect(x - 6, y - 6, w + 12, h + 12);
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = grad(x, y, x, y + h, [[0, '#8a9aa6'], [1, '#4a5560']]); ctx.fillRect(x, y, w, h);
  cartoonHead(x + w / 2, y + h * .48, w * .25, { skin: '#d9a582', hair: '#1c120c', cloth: '#4b5a3a' });
  ctx.fillStyle = `rgba(60,30,10,${.35 * (1 - light * .3)})`; ctx.fillRect(x, y, w, h);
  ctx.restore();
  // siyah kurdele
  ctx.save(); ctx.beginPath(); ctx.rect(x - 16, y - 16, w + 32, h + 32); ctx.clip();
  ctx.translate(x - 16, y - 16); ctx.rotate(-Math.PI / 4); ctx.fillStyle = '#050505'; ctx.fillRect(-120, 46, 240, 34); ctx.restore();
}

// ---------- karakterler ----------
const BUST_SRC = (`M -0.05 -1.02 C 0.25 -1.02 0.4 -0.7 0.38 -0.38 L 0.43 -0.3 Q 0.44 -0.12 0.6 0.06 Q 0.56 0.14 0.44 0.15 Q 0.48 0.22 0.47 0.26 L 0.42 0.31 Q 0.47 0.35 0.45 0.4 Q 0.37 0.46 0.39 0.52 Q 0.42 0.66 0.3 0.72 Q 0.12 0.8 0.1 0.9 L 0.14 1.25 Q 0.55 1.35 0.7 1.7 L 0.75 3.2 L -1.0 3.2 L -0.95 1.6 Q -0.8 1.3 -0.42 1.15 L -0.42 0.75 C -0.85 0.5 -0.85 -0.6 -0.45 -0.9 Q -0.25 -1.03 -0.05 -1.02 Z`);
const BUST_S = new Path2D(BUST_SRC), BUST_L = new Path2D(BUST_SRC.replace(/3\.2/g, '9'));
const HAIR_LONG = new Path2D(`M 0.18 -1.0 C 0.44 -0.92 0.48 -0.6 0.37 -0.43 Q 0.22 -0.62 0.06 -0.58 Q -0.04 -0.2 0.0 0.25 Q 0.05 0.85 0.06 1.55 Q -0.2 1.75 -0.55 1.62 L -1.02 1.58 C -1.04 0.7 -1.08 -0.5 -0.55 -0.96 Q -0.2 -1.15 0.18 -1.0 Z`);
const HAIR_BUN = new Path2D(`M 0.22 -0.97 C 0.38 -0.9 0.42 -0.72 0.37 -0.55 Q 0.24 -0.7 0.08 -0.66 Q -0.04 -0.35 0.0 0.0 Q -0.18 0.3 -0.45 0.55 C -0.86 0.3 -0.86 -0.6 -0.5 -0.94 Q -0.2 -1.1 0.22 -0.97 Z M -0.36 -0.72 A 0.26 0.26 0 1 0 -0.88 -0.72 A 0.26 0.26 0 1 0 -0.36 -0.72 Z`);
const CLOTH = new Path2D(`M -1.2 1.1 Q -0.6 1.25 0.1 1.2 Q 0.55 1.3 0.8 1.6 L 0.9 9 L -1.2 9 Z`);

function bust(o) {
  const { x, y, s, mir = false, rot = 0 } = o;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(mir ? -s : s, s);
  const BUST = o.long ? BUST_L : BUST_S;
  ctx.fillStyle = o.base || '#111a29'; ctx.fill(BUST);
  ctx.save(); ctx.clip(BUST);
  if (o.cloth) { ctx.fillStyle = o.cloth; ctx.fill(CLOTH); }
  if (o.light) for (const L of [].concat(o.light)) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(L.x, L.y, 0, L.x, L.y, L.r || 1.6); g.addColorStop(0, `rgba(${L.col},${L.a})`); g.addColorStop(1, `rgba(${L.col},0)`); ctx.fillStyle = g; ctx.fillRect(-2, -2, 4, 6); ctx.restore(); }
  ctx.restore();
  // yüz detayları
  const ink = o.ink || 'rgba(2,4,8,.85)';
  ctx.strokeStyle = ink; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // kaş
  ctx.lineWidth = .022; ctx.beginPath(); ctx.moveTo(0.18, -0.36); ctx.quadraticCurveTo(0.27, -0.41, 0.36, -0.37); ctx.stroke();
  // göz
  const e = o.eye || 'open';
  if (e === 'open') {
    ctx.fillStyle = ink; ctx.beginPath(); ctx.moveTo(0.21, -0.23); ctx.quadraticCurveTo(0.28, -0.28, 0.34, -0.22); ctx.quadraticCurveTo(0.28, -0.19, 0.21, -0.23); ctx.fill();
    ctx.lineWidth = .014; ctx.beginPath(); ctx.moveTo(0.2, -0.24); ctx.quadraticCurveTo(0.28, -0.3, 0.355, -0.235); ctx.stroke();
    if (o.glint) { ctx.fillStyle = `rgba(255,255,255,${o.glint})`; ctx.beginPath(); ctx.arc(0.3, -0.235, 0.012, 0, 6.283); ctx.fill(); }
    if (o.wet) { ctx.strokeStyle = `rgba(200,225,255,${o.wet})`; ctx.lineWidth = .008; ctx.beginPath(); ctx.moveTo(0.22, -0.205); ctx.quadraticCurveTo(0.28, -0.185, 0.335, -0.21); ctx.stroke(); ctx.strokeStyle = ink; }
  } else {
    ctx.lineWidth = .016; ctx.beginPath(); ctx.moveTo(0.21, -0.22); ctx.quadraticCurveTo(0.28, e === 'closed' ? -0.19 : -0.2, 0.345, -0.215); ctx.stroke();
    ctx.lineWidth = .01; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(0.25 + i * .03, -0.2); ctx.lineTo(0.255 + i * .034, -0.175); ctx.stroke(); }
  }
  // ağız / tebessüm
  const sm = o.smile || 0; ctx.lineWidth = .014; ctx.beginPath(); ctx.moveTo(0.43, 0.305); ctx.quadraticCurveTo(0.39, 0.31 - sm * .01, 0.36, 0.295 - sm * .035); ctx.stroke();
  if (o.wrinkles) { ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = .009; [[0.36, -0.16, 0.4, -0.13], [0.36, -0.19, 0.405, -0.19], [0.38, 0.17, 0.32, 0.38], [0.15, -0.5, 0.3, -0.52], [0.13, 1.0, 0.0, 1.03], [0.13, 1.08, -0.02, 1.12]].forEach(([a, b, c, d]) => { ctx.beginPath(); ctx.moveTo(a, b); ctx.quadraticCurveTo((a + c) / 2 + .01, (b + d) / 2, c, d); ctx.stroke(); }); }
  // saç
  if (o.hair) {
    const HP = o.hair === 'bun' ? HAIR_BUN : HAIR_LONG;
    ctx.fillStyle = o.hairCol || '#05080f'; ctx.fill(HP);
    if (o.hairLight) { ctx.save(); ctx.clip(HP); ctx.globalCompositeOperation = 'lighter'; const L = o.hairLight; const g = ctx.createRadialGradient(L.x, L.y, 0, L.x, L.y, L.r || 1.2); g.addColorStop(0, `rgba(${L.col},${L.a})`); g.addColorStop(1, `rgba(${L.col},0)`); ctx.fillStyle = g; ctx.fillRect(-2, -2, 4, 5); ctx.strokeStyle = `rgba(${L.col},${L.a * .5})`; ctx.lineWidth = .006; for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.moveTo(0.15 - i * .07, -0.98 + i * .01); ctx.quadraticCurveTo(-0.5 - i * .02, -0.6 + i * .08, -0.7 + i * .02, 0.2 + i * .1); ctx.stroke(); } ctx.restore(); }
  }
  // kenar ışığı
  if (o.rim) { ctx.save(); ctx.clip(BUST); ctx.strokeStyle = `rgba(${o.rim},.55)`; ctx.lineWidth = .03; ctx.stroke(BUST); ctx.restore(); }
  // gözyaşı
  if (o.tear > 0) {
    const tp = clamp(o.tear); const tx = lerp(0.3, 0.37, tp), ty = lerp(-0.17, 0.42, tp);
    ctx.strokeStyle = `rgba(${o.tearCol || '200,225,255'},.35)`; ctx.lineWidth = .01; ctx.beginPath(); ctx.moveTo(0.3, -0.17); ctx.quadraticCurveTo(0.34, (ty - .17) / 2, tx, ty); ctx.stroke();
    ctx.fillStyle = `rgba(${o.tearCol || '210,230,255'},.95)`; ctx.beginPath(); ctx.moveTo(tx, ty - .035); ctx.quadraticCurveTo(tx + .02, ty, tx, ty + .015); ctx.quadraticCurveTo(tx - .02, ty, tx, ty - .035); ctx.fill();
  }
  // kulaklık
  if (o.headphones) {
    ctx.strokeStyle = '#141414'; ctx.lineWidth = .065; ctx.beginPath(); ctx.moveTo(-0.2, -0.2); ctx.quadraticCurveTo(-0.28, -1.22, 0.06, -1.13); ctx.stroke();
    ctx.fillStyle = '#161616'; ctx.beginPath(); ctx.ellipse(-0.18, -0.04, 0.15, 0.21, 0, 0, 6.283); ctx.fill();
    ctx.strokeStyle = `rgba(${o.headphones},.5)`; ctx.lineWidth = .012; ctx.beginPath(); ctx.ellipse(-0.18, -0.04, 0.15, 0.21, 0, -1.2, 1.2); ctx.stroke();
    if (o.cable) { ctx.strokeStyle = '#151515'; ctx.lineWidth = .016; ctx.beginPath(); ctx.moveTo(-0.18, 0.17); ctx.bezierCurveTo(-0.2, 0.9, o.cable[0] - 0.3, o.cable[1] - 0.4, o.cable[0], o.cable[1]); ctx.stroke(); }
  }
  // eller / telefon
  const skinH = o.handCol || o.base || '#1a2333';
  if (o.phone === 'mouth') {
    ctx.save(); ctx.translate(0.72, 0.62); ctx.rotate(-0.4);
    glow(0, -0.05, 0.6, o.phoneGlow || '140,180,255', .5);
    ctx.fillStyle = '#05070b'; rrect(-0.3, -0.035, 0.6, 0.07, 0.03); ctx.fill();
    ctx.fillStyle = `rgba(${o.phoneGlow || '160,200,255'},.9)`; ctx.fillRect(-0.27, -0.04, 0.54, 0.012);
    ctx.fillStyle = skinH; ctx.beginPath(); ctx.ellipse(-0.05, 0.08, 0.2, 0.1, 0, 0, 6.283); ctx.fill();
    ctx.fillRect(-0.18, 0.08, 0.2, 0.7);
    ctx.restore();
  }
  if (o.phone === 'chest') {
    const pa = o.phoneA ?? .4;
    ctx.save(); ctx.translate(0.3, 1.62); ctx.rotate(.15);
    glow(0, 0, 0.9, o.phoneGlow || '255,190,120', .45 * pa + .1);
    ctx.fillStyle = '#07070a'; rrect(-0.18, -0.34, 0.36, 0.68, 0.05); ctx.fill();
    ctx.fillStyle = `rgba(${o.phoneGlow || '255,200,140'},${.15 + .6 * pa})`; rrect(-0.155, -0.31, 0.31, 0.62, 0.04); ctx.fill();
    ctx.fillStyle = skinH; ctx.beginPath(); ctx.ellipse(-0.1, 0.05, 0.28, 0.13, -.5, 0, 6.283); ctx.fill(); ctx.beginPath(); ctx.ellipse(0.06, 0.2, 0.28, 0.12, .4, 0, 6.283); ctx.fill();
    ctx.restore();
  }
  if (o.handMouth) {
    ctx.save(); ctx.fillStyle = skinH; ctx.translate(0.5, 0.36); ctx.rotate(.35);
    ctx.beginPath(); ctx.ellipse(0, 0, 0.13, 0.2, 0, 0, 6.283); ctx.fill();
    for (let i = 0; i < 4; i++) { rrect(-0.12 + i * .065, -0.36 + Math.abs(i - 1.5) * .03, 0.06, 0.25, 0.03); ctx.fill(); }
    ctx.fillRect(-0.12, 0.1, 0.22, 1.5);
    if (o.handLight) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(${o.handLight},.25)`; ctx.beginPath(); ctx.ellipse(0.04, -0.05, 0.1, 0.18, 0, 0, 6.283); ctx.fill(); }
    ctx.restore();
  }
  ctx.restore();
}
const ZEY = { hair: 'long', base: '#111a2a', hairCol: '#04070d', cloth: '#16233a', handCol: '#1a2538' };
const SEV = { hair: 'bun', base: '#2b1a10', hairCol: '#4a3d33', cloth: '#3a1b1b', handCol: '#3a2517', wrinkles: true, ink: 'rgba(15,6,2,.85)', tearCol: '255,225,190' };

function wrinkledHand(x, y, s, rot, jit) {
  ctx.save(); ctx.translate(x + jit, y); ctx.rotate(rot); ctx.scale(s, s);
  ctx.fillStyle = '#3b1f1f'; rrect(-0.3, 0.55, 0.6, 1.6, 0.1); ctx.fill();
  ctx.fillStyle = '#4a2a26'; rrect(-0.32, 0.52, 0.64, 0.16, 0.06); ctx.fill();
  const skin = grad(-0.3, -0.6, 0.3, 0.6, [[0, '#c48b62'], [1, '#7d4f33']]);
  ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(0, 0.2, 0.28, 0.38, 0, 0, 6.283); ctx.fill();
  const fing = [[-0.2, -0.55, .9], [-0.07, -0.66, 1], [0.07, -0.63, .97], [0.19, -0.5, .85]];
  fing.forEach(([fx, fy, l], i) => { ctx.save(); ctx.translate(fx, 0); ctx.rotate((i - 1.5) * .07); rrect(-0.055, fy, 0.11, 0.6 * l, 0.055); ctx.fill(); ctx.restore(); });
  ctx.save(); ctx.translate(-0.26, 0.15); ctx.rotate(-.9); rrect(-0.06, -0.4, 0.12, 0.45, 0.06); ctx.fill(); ctx.restore();
  ctx.strokeStyle = 'rgba(60,30,15,.6)'; ctx.lineWidth = .012; ctx.lineCap = 'round';
  fing.forEach(([fx, fy, l], i) => { for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(fx - 0.035, fy + 0.25 * l + k * .025); ctx.quadraticCurveTo(fx, fy + 0.26 * l + k * .025, fx + 0.035, fy + 0.25 * l + k * .025); ctx.stroke(); } });
  for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.moveTo(-0.15, 0.1 + k * .06); ctx.quadraticCurveTo(0, 0.13 + k * .06, 0.15, 0.08 + k * .06); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(110,70,90,.35)'; ctx.lineWidth = .015; ctx.beginPath(); ctx.moveTo(-0.05, 0.5); ctx.quadraticCurveTo(-0.02, 0.2, -0.08, -0.05); ctx.stroke();
  ctx.restore();
}

// ---------- SAHNE 0 – Kanca (0–3) ----------
function s0(t) {
  const z = 1 + .45 * eio(t / 3);
  ctx.save(); cam(z, W / 2, H / 2 - 30);
  const pw = 640, ph = 1300, px = (W - pw) / 2, py = (H - ph) / 2 - 30;
  phone(px, py, pw, ph, vh => chatScreen(vh, { msgs: VOICE, scroll: -60 + t * 70, status: 'son görülme yakın zamanda', count: '' }), { glowA: .9 });
  ctx.restore();
  glow(W / 2, H * .35, 700, '120,160,230', .1);
  // yazı
  ctx.fillStyle = grad(0, H * .62, 0, H, [[0, 'rgba(0,0,0,0)'], [.5, 'rgba(0,0,0,.8)'], [1, 'rgba(0,0,0,.9)']]); ctx.fillRect(0, H * .62, W, H * .38);
  const a1 = ss(.9, 1.3, t), a2 = ss(1.6, 2.0, t);
  text('412 mesaj.', W / 2, 1520, 92, { weight: 700, alpha: a1, shadow: 'rgba(0,0,0,.8)' });
  text('0 cevap.', W / 2, 1630, 92, { weight: 700, alpha: a2, color: '#9fd6f0', shadow: 'rgba(0,0,0,.8)' });
  black(1 - ss(0, .5, t)); black(ss(2.8, 3, t));
}

// ---------- SAHNE 1 – Gece (3–13) ----------
function bedroomWindow(t, x, y, w, h, pal) {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = grad(0, y, 0, y + h, [[0, '#0a1426'], [1, '#1b2c4a']]); ctx.fillRect(x, y, w, h);
  // şehir siluetleri
  const r2 = mulberry(11);
  for (let i = 0; i < 16; i++) { const bw = 40 + r2() * 90, bh = 120 + r2() * 380, bx = x + i * (w / 14) - 30; ctx.fillStyle = '#0b1424'; ctx.fillRect(bx, y + h - bh, bw, bh); for (let k = 0; k < 14; k++) if (r2() < .35) { ctx.fillStyle = `rgba(${pal[k % pal.length]},.5)`; ctx.fillRect(bx + 8 + (k % 3) * 14, y + h - bh + 16 + (k / 3 | 0) * 26, 6, 9); } }
  bokeh(t, x, y + h * .2, w, h * .8, pal, .9, 1);
  rain(t, { x, y, w, h, alpha: .7, count: 140 });
  glassDrops(t, x, y, w, h, '180,205,255', .9);
  ctx.restore();
}
const COLD = ['120,160,255', '90,130,220', '200,220,255', '255,190,120', '150,120,220'];
function s1(t) {
  const lt = t - 3;
  if (lt < 2.5) { // geniş plan
    const z = 1 + .06 * lt / 2.5; ctx.save(); cam(z, W / 2, H / 2);
    ctx.fillStyle = '#080d18'; ctx.fillRect(0, 0, W, H);
    bedroomWindow(t, 110, 240, 860, 1060, COLD);
    ctx.fillStyle = '#060a12'; ctx.fillRect(110, 760, 860, 24); ctx.fillRect(528, 240, 24, 1060); ctx.lineWidth = 30; ctx.strokeStyle = '#060a12'; ctx.strokeRect(110, 240, 860, 1060);
    // yatak
    ctx.fillStyle = grad(0, 1300, 0, H, [[0, '#14203a'], [1, '#070b14']]); ctx.beginPath(); ctx.moveTo(0, 1360); ctx.quadraticCurveTo(540, 1300, W, 1360); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
    ctx.strokeStyle = 'rgba(140,170,230,.15)'; ctx.lineWidth = 3; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(0, 1420 + i * 90); ctx.quadraticCurveTo(540, 1370 + i * 95, W, 1430 + i * 90); ctx.stroke(); }
    // Zeynep oturuyor (dizler karnında)
    const zx = 560, zy = 930, s = 125;
    ctx.save(); ctx.translate(zx, zy); ctx.scale(s, s);
    ctx.fillStyle = '#060a13'; ctx.beginPath(); ctx.moveTo(-0.95, 3.4); ctx.quadraticCurveTo(-1.1, 2.0, -0.6, 1.2); ctx.lineTo(0.4, 1.4); ctx.quadraticCurveTo(1.1, 1.3, 1.2, 1.9); ctx.quadraticCurveTo(1.5, 2.6, 1.55, 3.4); ctx.closePath(); ctx.fill();
    ctx.restore();
    bust({ ...ZEY, x: zx, y: zy, s, rot: .22, base: '#070c16', hairCol: '#03050a', cloth: '#08101d', eye: 'down', light: { x: .9, y: .6, r: .9, col: '120,170,255', a: .55 }, rim: '140,170,240' });
    // telefon elde
    ctx.save(); ctx.translate(zx + 95, zy + 150); ctx.rotate(-.5); glow(0, 0, 160, '130,180,255', .5); ctx.fillStyle = '#05070b'; rrect(-26, -45, 52, 90, 8); ctx.fill(); ctx.fillStyle = 'rgba(170,205,255,.9)'; rrect(-22, -41, 44, 82, 6); ctx.fill(); ctx.restore();
    ctx.fillStyle = '#0a1220'; ctx.beginPath(); ctx.ellipse(zx + 120, zy + 205, 50, 26, -.4, 0, 6.283); ctx.fill();
    ctx.restore();
    black(1 - ss(0, .5, lt));
  } else if (lt < 8.6) { // omuz üstü telefon
    const k = lt - 2.5; const z = 1 + .05 * k / 6;
    ctx.fillStyle = '#05080f'; ctx.fillRect(0, 0, W, H);
    bokeh(t, -100, 0, W + 200, H * .7, COLD, .7, 2.2, 30);
    ctx.save(); cam(z, W / 2, H / 2);
    const rec = t - 3.8, sent = t >= 10.9, read = t >= 11.4;
    const msgs = [...VOICE.slice(0, 12)];
    if (sent) msgs.unshift({ k: 'v', d: '0:07', tm: '23:42', out: true, read, seed: 99, appear: eo((t - 10.9) / .25) });
    phone(250, 260, 640, 1300, vh => chatScreen(vh, { msgs, status: 'son görülme yakın zamanda', recording: !sent && rec >= 0 ? rec : null }), { rot: -.04, glowA: 1 });
    // başparmak
    ctx.fillStyle = '#121b2b'; ctx.beginPath(); ctx.ellipse(880, 1520 - (sent ? 0 : 25), 70, 150, -.6, 0, 6.283); ctx.fill();
    glow(800, 1420, 140, '120,170,255', .12);
    ctx.restore();
    // ön planda omuz & saç
    ctx.fillStyle = '#020306'; ctx.beginPath(); ctx.moveTo(0, 700); ctx.quadraticCurveTo(260, 820, 300, 1300); ctx.quadraticCurveTo(320, 1700, 420, H); ctx.lineTo(0, H); ctx.fill();
    ctx.strokeStyle = 'rgba(120,160,230,.25)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, 700); ctx.quadraticCurveTo(260, 820, 300, 1300); ctx.stroke();
    if (read) chip(W / 2, 200, ss(11.45, 11.7, t) * (1 - ss(12.6, 13, t)));
  } else { // yüze yakın plan – buruk tebessüm
    const k = lt - 8.6;
    ctx.fillStyle = '#070c16'; ctx.fillRect(0, 0, W, H);
    bokeh(t, 0, 0, W * .6, H * .7, COLD, .55, 2.5, 25);
    rain(t, { x: 0, y: 0, w: 540, h: 1100, alpha: .25, count: 60 });
    bust({ ...ZEY, x: 430, y: 720 - k * 8, s: 520, rot: .14, eye: 'down', smile: ss(.2, .9, k), light: [{ x: 1.0, y: .7, r: 1.5, col: '110,160,250', a: .55 }, { x: .5, y: .2, r: .45, col: '170,200,255', a: .2 }], rim: '150,180,255', hairLight: { x: .4, y: -.6, r: .7, col: '120,160,240', a: .25 } });
    glow(1050, 1500, 450, '120,170,255', .35);
  }
  black(ss(12.75, 13, t));
}

// ---------- SAHNE 2 – Zaman geçiyor (13–23) ----------
function vignetteBg(kind, t, lt) {
  if (kind === 0) { // metro – sonbahar
    ctx.fillStyle = '#121a24'; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.beginPath(); rrect(60, 300, 960, 820, 40); ctx.clip();
    ctx.fillStyle = grad(0, 300, 0, 1120, [[0, '#3d2a24'], [1, '#6b4227']]); ctx.fillRect(0, 300, W, 820);
    for (let i = 0; i < 14; i++) { const xx = ((i * 230 - t * 1400) % 3200 + 3200) % 3200 - 400; ctx.fillStyle = ['#b5642c', '#8c3b1f', '#d08a2e'][i % 3]; ctx.globalAlpha = .55; ctx.beginPath(); ctx.ellipse(xx, 760 + (i % 4) * 40, 160, 220, 0, 0, 6.283); ctx.fill(); }
    ctx.globalAlpha = 1; ctx.strokeStyle = 'rgba(255,200,140,.3)'; ctx.lineWidth = 3; for (let i = 0; i < 20; i++) { const xx = ((i * 157 - t * 2400) % 1400 + 1400) % 1400 - 200; ctx.beginPath(); ctx.moveTo(xx, 400 + i * 33); ctx.lineTo(xx + 180, 400 + i * 33); ctx.stroke(); }
    LEAF.forEach(l => { const yy = 300 + ((l.p + lt * l.v) % 1) * 820, xx = 60 + ((l.x - lt * .25) % 1 + 1) % 1 * 960; ctx.save(); ctx.translate(xx, yy); ctx.rotate(lt * 3 + l.sw); ctx.fillStyle = l.c; ctx.beginPath(); ctx.ellipse(0, 0, l.r, l.r * .5, 0, 0, 6.283); ctx.fill(); ctx.restore(); });
    ctx.restore();
    ctx.lineWidth = 26; ctx.strokeStyle = '#0b1118'; rrect(60, 300, 960, 820, 40); ctx.stroke();
    ctx.fillStyle = 'rgba(160,200,230,.12)'; ctx.fillRect(0, 140, W, 30); glow(W / 2, 150, 600, '170,210,240', .15);
    ctx.fillStyle = grad(820, 0, 860, 0, [[0, '#4a5560'], [.5, '#a7b4bf'], [1, '#3a444d']]); ctx.fillRect(820, 0, 40, H);
    ctx.fillStyle = '#0d141c'; ctx.fillRect(0, 1500, W, 420);
  } else if (kind === 1) { // vapur – kış
    ctx.fillStyle = grad(0, 0, 0, 1100, [[0, '#28364b'], [1, '#5e6d82']]); ctx.fillRect(0, 0, W, 1100);
    ctx.fillStyle = '#1e2a3a'; const sky = [[0, 60], [80, 40], [130, 110], [160, 40], [240, 70], [300, 130], [320, 50], [420, 80], [480, 30], [560, 95], [600, 150], [640, 60], [760, 75], [820, 40], [900, 120], [960, 45], [1080, 65]];
    ctx.beginPath(); ctx.moveTo(0, 1050); sky.forEach(([x, h]) => ctx.lineTo(x, 1050 - h)); ctx.lineTo(W, 1050); ctx.fill();
    [[300, 1050 - 130], [600, 1050 - 150], [900, 1050 - 120]].forEach(([x, y]) => { ctx.fillRect(x - 3, y - 60, 6, 60); ctx.beginPath(); ctx.arc(x - 60, y + 20, 55, Math.PI, 0); ctx.fill(); });
    ctx.fillStyle = grad(0, 1050, 0, H, [[0, '#1b2635'], [1, '#0b111a']]); ctx.fillRect(0, 1050, W, H - 1050);
    ctx.strokeStyle = 'rgba(180,200,225,.18)'; ctx.lineWidth = 3; for (let i = 0; i < 18; i++) { const yy = 1070 + i * i * 2.2; const off = (t * 60 * (1 + i * .1)) % 160; ctx.beginPath(); for (let x = -160; x < W + 160; x += 160) { ctx.moveTo(x + off, yy); ctx.lineTo(x + off + 60 + i * 3, yy); } ctx.stroke(); }
    ctx.strokeStyle = '#d7dde6'; ctx.lineWidth = 4; [[260, 420], [380, 470]].forEach(([x, y], i) => { const fl = Math.sin(t * 5 + i) * 12; ctx.beginPath(); ctx.moveTo(x - 30 + lt * 20, y + fl); ctx.quadraticCurveTo(x - 12 + lt * 20, y - 14, x + lt * 20, y); ctx.quadraticCurveTo(x + 12 + lt * 20, y - 14, x + 30 + lt * 20, y + fl); ctx.stroke(); });
  } else { // otobüs – bahar
    ctx.fillStyle = '#0f1220'; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.beginPath(); rrect(-40, 260, 1160, 900, 30); ctx.clip();
    ctx.fillStyle = grad(0, 260, 0, 1160, [[0, '#2b2f5a'], [.6, '#6a5a85'], [1, '#c98a8a']]); ctx.fillRect(0, 260, W, 900);
    for (let i = 0; i < 9; i++) { const xx = ((i * 420 - t * 700) % 3780 + 3780) % 3780 - 400; ctx.fillStyle = '#1e1a2e'; ctx.fillRect(xx + 90, 820, 18, 340); ['#f2b5c8', '#e79ab3', '#f7cdd9'].forEach((c, j) => { ctx.fillStyle = c; ctx.globalAlpha = .8; ctx.beginPath(); ctx.arc(xx + 60 + j * 40, 760 - j * 30, 120 - j * 15, 0, 6.283); ctx.fill(); }); ctx.globalAlpha = 1; }
    for (let i = 0; i < 6; i++) { const xx = ((i * 640 - t * 1200) % 3840 + 3840) % 3840 - 300; glow(xx, 520, 120, '255,210,150', .5); }
    ctx.restore();
    ctx.lineWidth = 22; ctx.strokeStyle = '#090b14'; rrect(-40, 260, 1160, 900, 30); ctx.stroke();
    ctx.fillStyle = '#090b14'; ctx.fillRect(0, 1160, W, H - 1160);
  }
}
function s2(t) {
  const lt = t - 13; const seg = Math.min(2, Math.floor(lt / (10 / 3))); const st = lt - seg * (10 / 3), sd = 10 / 3;
  ctx.save(); const z = 1.03 + .05 * st / sd; cam(z, W / 2 + (seg - 1) * 20, H / 2);
  vignetteBg(seg, t, st);
  const lightCol = ['170,200,235', '170,190,220', '230,180,200'][seg];
  bust({ ...ZEY, long: true, x: seg === 2 ? 470 : 420, y: 930, s: 250, mir: seg === 1, rot: seg === 2 ? -.12 : 0, cloth: ['#2c3a4a', '#273548', '#3a2f48'][seg], eye: seg === 2 ? 'down' : 'open', phone: 'mouth', light: [{ x: .9, y: .7, r: .9, col: '140,180,255', a: .45 }, { x: .2, y: -1.2, r: 2.2, col: lightCol, a: .3 }], rim: lightCol, hairLight: { x: .2, y: -1, r: 1, col: lightCol, a: .2 } });
  if (seg === 1) { // korkuluk + kar
    ctx.fillStyle = '#0a0f17'; ctx.fillRect(0, 1360, W, 22); ctx.fillRect(0, 1480, W, 16); for (let x = 40; x < W; x += 220) ctx.fillRect(x, 1360, 18, 560);
    ctx.fillStyle = '#fff'; SNOW.forEach(s => { const yy = ((s.p + st * s.v * 2) % 1) * H, xx = (s.x * W + Math.sin(st * 2 + s.sw) * 30); ctx.globalAlpha = .75; ctx.beginPath(); ctx.arc(xx, yy, s.r, 0, 6.283); ctx.fill(); }); ctx.globalAlpha = 1;
  }
  if (seg === 2) { ctx.fillStyle = '#f5c4d4'; PETAL.forEach(p => { const yy = 260 + ((p.p + st * p.v * 2) % 1) * 900, xx = ((p.x - st * .2) % 1 + 1) % 1 * W; ctx.save(); ctx.translate(xx, yy); ctx.rotate(st * 2 + p.sw); ctx.globalAlpha = .8; ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * .55, 0, 0, 6.283); ctx.fill(); ctx.restore(); }); }
  ctx.restore();
  // Gün etiketi
  const lbl = ['Gün 47', 'Gün 183', 'Gün 301'][seg];
  const la = ss(.1, .4, st) * (1 - ss(sd - .3, sd, st));
  text(lbl, W / 2, 230, 74, { font: SERIF, weight: 400, spacing: 6, alpha: la, shadow: 'rgba(0,0,0,.7)' });
  chip(W / 2, 1330, ss(sd - .75, sd - .55, st) * (1 - ss(sd - .12, sd, st)));
  black(1 - ss(0, .15, st)); black(ss(sd - .12, sd, st));
}

// ---------- SAHNE 3 – Kırılma anı (23–33) ----------
function s3(t) {
  const lt = t - 23; const flame = 1 - ss(8.0, 8.3, lt); const flick = .85 + .15 * Math.sin(t * 23) * Math.sin(t * 7.3);
  const pan = eio(lt / 5), push = eio((lt - 5) / 3);
  ctx.save(); cam(1 + .18 * push, lerp(380, 940, pan) + push * 20, 1000 + push * 20);
  ctx.fillStyle = grad(0, 0, 0, H, [[0, '#0a1120'], [1, '#060a12']]); ctx.fillRect(-400, 0, 2200, H);
  // pencere
  ctx.save(); ctx.beginPath(); ctx.rect(560, 260, 520, 640); ctx.clip(); ctx.fillStyle = grad(0, 260, 0, 900, [[0, '#0d1a30'], [1, '#1c2e4d']]); ctx.fillRect(560, 260, 520, 640); bokeh(t, 560, 400, 520, 500, COLD, .6, .7, 25); rain(t, { x: 560, y: 260, w: 520, h: 640, alpha: .5, count: 80 }); ctx.restore();
  ctx.strokeStyle = '#050911'; ctx.lineWidth = 22; ctx.strokeRect(560, 260, 520, 640); ctx.fillStyle = '#050911'; ctx.fillRect(810, 260, 20, 640);
  glow(820, 600, 600, '100,140,220', .12);
  // boş sandalye (solda)
  ctx.fillStyle = '#0e1624'; ctx.fillRect(170, 640, 26, 700); ctx.fillRect(440, 640, 26, 700); ctx.fillRect(170, 640, 296, 30); ctx.fillRect(170, 760, 296, 18); ctx.fillRect(170, 880, 296, 18);
  ctx.strokeStyle = `rgba(255,170,90,${.25 * flame * flick})`; ctx.lineWidth = 4; ctx.strokeRect(440, 640, 26, 700);
  // Zeynep (sağda, sola bakıyor)
  const lean = ss(7.5, 8.0, lt) * (1 - ss(8.4, 9, lt));
  const fl = { x: 1.6, y: .6, r: 2.2, col: '255,160,80', a: .55 * flame * flick };
  bust({ ...ZEY, x: 1230 - lean * 30, y: 820 + lean * 10, s: 190, mir: true, rot: -.05 - lean * .08, eye: lt < 7.6 ? 'down' : 'closed', tear: ss(5.4, 7.4, lt), light: [fl, { x: -0.8, y: -0.9, r: 1.5, col: '110,150,230', a: .2 }], rim: flame > .5 ? '255,180,110' : '120,160,230', hairLight: { x: .3, y: -.3, r: 1.1, col: '255,160,80', a: .3 * flame } });
  // masa
  ctx.fillStyle = grad(0, 1180, 0, 1280, [[0, '#1d2639'], [1, '#121a29']]); ctx.beginPath(); ctx.moveTo(-200, 1280); ctx.lineTo(80, 1180); ctx.lineTo(1500, 1180); ctx.lineTo(1800, 1280); ctx.fill();
  ctx.fillStyle = '#0a101b'; ctx.fillRect(-200, 1280, 2000, 700);
  glow(780, 1190, 650, '255,160,80', .35 * flame * flick);
  // tabaklar
  [[420, 1225], [1110, 1225]].forEach(([x, y]) => { ctx.fillStyle = '#2b3447'; ctx.beginPath(); ctx.ellipse(x, y, 140, 34, 0, 0, 6.283); ctx.fill(); ctx.fillStyle = '#39445b'; ctx.beginPath(); ctx.ellipse(x, y - 3, 100, 22, 0, 0, 6.283); ctx.fill(); ctx.fillStyle = '#4a5468'; ctx.fillRect(x + 170, y - 30, 8, 60); });
  // pasta
  const cx = 780, cy = 1150;
  ctx.fillStyle = '#2c3346'; ctx.beginPath(); ctx.ellipse(cx, cy + 70, 150, 32, 0, 0, 6.283); ctx.fill();
  ctx.fillStyle = grad(cx - 110, 0, cx + 110, 0, [[0, '#6b5a5a'], [.4, '#c9a79a'], [1, '#5a4a52']]); ctx.fillRect(cx - 110, cy - 60, 220, 120); ctx.beginPath(); ctx.ellipse(cx, cy + 60, 110, 26, 0, 0, Math.PI); ctx.fill();
  ctx.fillStyle = '#e8d4c8'; ctx.beginPath(); ctx.ellipse(cx, cy - 60, 110, 26, 0, 0, 6.283); ctx.fill();
  ctx.fillStyle = '#b5495b'; for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.arc(cx - 90 + i * 30, cy - 38 + Math.sin(i) * 3, 7, 0, 6.283); ctx.fill(); }
  ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(cx - 110, cy - 60, 220, 120);
  glow(cx, cy - 60, 200, '255,180,100', .25 * flame);
  ctx.fillStyle = '#c9d6ea'; ctx.fillRect(cx - 6, cy - 140, 12, 80); ctx.fillStyle = '#7a8aa6'; for (let i = 0; i < 4; i++) ctx.fillRect(cx - 6, cy - 132 + i * 20, 12, 5);
  if (flame > 0) { const fh = 60 * flame * (0.9 + .1 * Math.sin(t * 31)); glow(cx, cy - 170, 260, '255,170,80', .5 * flame * flick); ctx.save(); ctx.translate(cx + Math.sin(t * 13) * 2 * flame, cy - 142); const g = ctx.createLinearGradient(0, 0, 0, -fh); g.addColorStop(0, 'rgba(255,120,40,.9)'); g.addColorStop(.4, 'rgba(255,210,120,.95)'); g.addColorStop(1, 'rgba(255,250,220,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -fh); ctx.quadraticCurveTo(16 * flame, -fh * .35, 0, 0); ctx.quadraticCurveTo(-16 * flame, -fh * .35, 0, -fh); ctx.fill(); ctx.restore(); }
  // duman
  if (lt > 8.05) { for (let i = 0; i < 46; i++) { const age = lt - 8.05 - i * .035; if (age <= 0) continue; const yy = cy - 145 - age * 160 - i * 2; const xx = cx + Math.sin(age * 2.4 + i * .3) * 30 * age; ctx.fillStyle = `rgba(190,200,220,${clamp(.22 - age * .1)})`; ctx.beginPath(); ctx.arc(xx, yy, 6 + age * 16, 0, 6.283); ctx.fill(); } }
  ctx.restore();
  black(1 - ss(0, .35, lt)); black(ss(9.0, 9.9, lt));
}

// ---------- SAHNE 4 – Diğer ev (33–40) ----------
function amberWindow(t, x, y, w, h) {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = grad(0, y, 0, y + h, [[0, '#120d10'], [1, '#2a1c16']]); ctx.fillRect(x, y, w, h);
  bokeh(t, x, y + h * .3, w, h * .7, ['255,180,110', '255,140,80', '200,150,120'], .45, .8, 20);
  rain(t, { x, y, w, h, alpha: .55, count: 120, col: '230,190,150' });
  glassDrops(t, x, y, w, h, '255,215,170', .8, 90);
  ctx.restore();
  ctx.strokeStyle = '#140b05'; ctx.lineWidth = 22; ctx.strokeRect(x, y, w, h); ctx.fillStyle = '#140b05'; ctx.fillRect(x + w / 2 - 9, y, 18, h); ctx.fillRect(x, y + h / 2 - 9, w, 18);
}
function lamp(x, y, s = 1, a = 1) {
  glow(x, y + 40 * s, 900 * s, '255,165,80', .45 * a);
  ctx.fillStyle = '#3a2412'; ctx.fillRect(x - 6 * s, y + 60 * s, 12 * s, 260 * s); ctx.beginPath(); ctx.ellipse(x, y + 330 * s, 80 * s, 20 * s, 0, 0, 6.283); ctx.fill();
  ctx.fillStyle = grad(x - 130 * s, 0, x + 130 * s, 0, [[0, '#c0742e'], [.5, '#ffd08a'], [1, '#b3682a']]); ctx.beginPath(); ctx.moveTo(x - 80 * s, y - 120 * s); ctx.lineTo(x + 80 * s, y - 120 * s); ctx.lineTo(x + 140 * s, y + 70 * s); ctx.lineTo(x - 140 * s, y + 70 * s); ctx.fill();
  glow(x, y + 80 * s, 200 * s, '255,220,150', .6 * a);
}
function s4(t) {
  const lt = t - 33; const z = 1 + .08 * lt / 7;
  ctx.save(); cam(z, W / 2, H / 2 + 60);
  ctx.fillStyle = grad(0, 0, 0, H, [[0, '#1b1009'], [1, '#2a180c']]); ctx.fillRect(0, 0, W, H);
  amberWindow(t, 620, 170, 420, 720);
  lamp(200, 680, 1.1);
  // komodin
  ctx.fillStyle = grad(0, 1240, 0, 1320, [[0, '#5a361c'], [1, '#3a2312']]); ctx.fillRect(-50, 1240, W + 100, 80);
  ctx.fillStyle = '#24150a'; ctx.fillRect(-50, 1320, W + 100, 700); ctx.fillStyle = '#c99a5a'; ctx.beginPath(); ctx.arc(540, 1520, 14, 0, 6.283); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 4; ctx.strokeRect(80, 1380, 920, 300);
  // gözlük ve bardak
  ctx.strokeStyle = '#1a0f07'; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(880, 1225, 40, 18, 0, 0, 6.283); ctx.stroke(); ctx.beginPath(); ctx.ellipse(970, 1225, 40, 18, 0, 0, 6.283); ctx.stroke();
  ctx.fillStyle = 'rgba(255,220,170,.15)'; ctx.fillRect(80, 1050, 90, 190); ctx.strokeStyle = 'rgba(255,220,170,.35)'; ctx.lineWidth = 3; ctx.strokeRect(80, 1050, 90, 190);
  // telefon
  const lift = ss(6.2, 7, lt);
  const ny = 760 - lift * 260; const on = ss(1.4, 1.6, lt);
  ctx.strokeStyle = '#0b0b0b'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(620, ny + 560); ctx.bezierCurveTo(620, 1320, 300, 1300, 260, 1500); ctx.stroke();
  ctx.fillStyle = '#2a1a0e'; ctx.fillRect(470, 1180, 300, 60);
  phone(450, ny, 340, 600, vh => lockScreen(vh, { on, notif: ss(1.5, 1.9, lt) }), { glowA: .9 * on, glowCol: '255,200,150', rot: -.03 - lift * .05 });
  // titreyen el
  const ha = ss(3.6, 6.2, lt); const jit = Math.sin(t * 41) * 4 + Math.sin(t * 27) * 3;
  if (ha > 0) wrinkledHand(lerp(1250, 770, ha), lerp(1750, 1230, ha) - lift * 260, 330, -.55 + ha * .1, jit);
  ctx.restore();
  black(1 - ss(0, .6, lt)); black(ss(6.7, 7, lt) * .6);
}

// ---------- SAHNE 5 – Gerçek (40–52) ----------
function room5(t, lt, phoneA) {
  ctx.fillStyle = grad(0, 0, 0, H, [[0, '#1a0f08'], [.6, '#2b190d'], [1, '#140b05']]); ctx.fillRect(-500, -300, W + 1000, H + 600);
  amberWindow(t, 40, 240, 300, 520);
  lamp(150, 950, .75);
  ctx.fillStyle = '#3a2312'; ctx.fillRect(20, 1200, 280, 30); ctx.fillStyle = '#26160a'; ctx.fillRect(30, 1230, 260, 450);
  // duvar fotoğrafı
  emrePortrait(640, 320, 240, 300, .8);
  glow(760, 470, 300, '255,180,100', .12);
  // sandalye ve ceket
  ctx.fillStyle = '#20130a'; ctx.fillRect(900, 880, 22, 700); ctx.fillRect(1060, 880, 22, 700); ctx.fillRect(900, 880, 182, 26);
  ctx.fillStyle = '#3c4a2f'; ctx.beginPath(); ctx.moveTo(890, 870); ctx.quadraticCurveTo(990, 840, 1090, 870); ctx.lineTo(1110, 1250); ctx.quadraticCurveTo(1000, 1290, 880, 1240); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(990, 870); ctx.lineTo(985, 1260); ctx.stroke(); ctx.beginPath(); ctx.moveTo(940, 1000); ctx.quadraticCurveTo(960, 1080, 930, 1150); ctx.stroke();
  ctx.fillStyle = 'rgba(255,180,100,.12)'; ctx.fillRect(890, 870, 40, 380);
  // yatak (dokunulmamış)
  ctx.fillStyle = '#3a2a22'; ctx.fillRect(250, 1180, 900, 420);
  ctx.fillStyle = grad(0, 1150, 0, 1300, [[0, '#5a4535'], [1, '#3b2c22']]); ctx.beginPath(); ctx.moveTo(250, 1200); ctx.quadraticCurveTo(700, 1150, 1150, 1190); ctx.lineTo(1150, 1320); ctx.lineTo(250, 1320); ctx.fill();
  ctx.fillStyle = '#6b5444'; rrect(780, 1100, 260, 90, 40); ctx.fill();
  ctx.fillStyle = '#1e140e'; ctx.fillRect(250, 1600, 900, 40);
  // Sevim Hanım – yatağın kenarında
  const sx = 520, sy = 860, s = 115;
  ctx.save(); ctx.translate(sx, sy); ctx.scale(-s, s);
  ctx.fillStyle = '#331818'; ctx.beginPath(); ctx.moveTo(-0.95, 3.0); ctx.lineTo(0.8, 2.9); ctx.quadraticCurveTo(1.9, 3.0, 2.0, 3.5); ctx.lineTo(1.85, 6.6); ctx.lineTo(1.35, 6.6); ctx.lineTo(1.4, 3.9); ctx.lineTo(-0.9, 3.9); ctx.closePath(); ctx.fill();
  ctx.restore();
  const tear = ss(4.6, 6.6, lt);
  bust({ ...SEV, x: sx, y: sy, s, mir: true, rot: .1, eye: lt > 3.5 && lt < 7 ? 'down' : 'down', tear, headphones: '255,190,120', cable: [0.75, 2.6], light: [{ x: 1.2, y: .8, r: 2.0, col: '255,160,80', a: .55 }, { x: .8, y: 2.6, r: .8, col: '255,200,140', a: .4 * phoneA }], rim: '255,180,100', hairLight: { x: .5, y: -.6, r: 1.2, col: '255,180,110', a: .5 } });
  // kucağında telefon ve eller
  const px = sx - 0.75 * s, py = sy + 3.05 * s;
  glow(px, py, 220, '255,200,140', .35 * phoneA);
  ctx.save(); ctx.translate(px, py); ctx.rotate(.5); ctx.fillStyle = '#060606'; rrect(-26, -46, 52, 92, 8); ctx.fill(); ctx.fillStyle = `rgba(255,215,170,${.3 + .6 * phoneA})`; rrect(-22, -42, 44, 84, 6); ctx.fill(); ctx.restore();
  ctx.fillStyle = '#5a3a26'; ctx.beginPath(); ctx.ellipse(px + 30, py + 30, 46, 22, -.3, 0, 6.283); ctx.fill(); ctx.beginPath(); ctx.ellipse(px - 26, py + 24, 42, 20, .5, 0, 6.283); ctx.fill();
}
function ambulance(lt, a) {
  if (a <= 0) return;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = a;
  const sh = Math.sin(lt * 50) * 6;
  ctx.translate(sh, Math.cos(lt * 43) * 4);
  ctx.fillStyle = grad(0, 0, 0, H, [[0, '#050608'], [.5, '#0a0c10'], [1, '#111419']]); ctx.fillRect(-20, -20, W + 40, H + 40);
  const p = Math.sin(lt * 26) > 0;
  ctx.globalCompositeOperation = 'lighter';
  glow(360, 760, 520, '255,40,40', p ? .85 : .25); glow(720, 780, 520, '50,100,255', p ? .25 : .85);
  // ıslak asfalt yansımaları
  for (let i = 0; i < 16; i++) { const yy = 1050 + i * 55; ctx.fillStyle = `rgba(255,50,50,${(p ? .35 : .1) * (1 - i / 16)})`; ctx.fillRect(330 + Math.sin(i * 3) * 20, yy, 70, 22); ctx.fillStyle = `rgba(60,110,255,${(p ? .1 : .35) * (1 - i / 16)})`; ctx.fillRect(690 + Math.cos(i * 2) * 20, yy, 70, 22); }
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = 'rgba(220,220,220,.12)'; ctx.lineWidth = 10; for (let i = 0; i < 6; i++) { const y0 = 1100 + i * i * 22; ctx.beginPath(); ctx.moveTo(540 - 4 - i * 6, y0); ctx.lineTo(540 - 8 - i * 9, y0 + 40 + i * 10); ctx.stroke(); }
  rain(lt, { alpha: .6, col: '200,200,220', speed: 1.2 });
  ctx.fillStyle = `rgba(255,255,255,${clamp(.6 - lt * 1.2)})`; ctx.fillRect(-20, -20, W + 40, H + 40);
  ctx.restore();
}
function draftsPhone(t, lt) {
  // 48–52: yazıp silinen taslaklar
  const k = lt - 8;
  const typeDel = (str, a, b, c, d) => { if (k < a) return null; if (k < b) return str.slice(0, Math.ceil(str.length * (k - a) / (b - a))); if (k < c) return str; if (k < d) return str.slice(0, Math.floor(str.length * (1 - (k - c) / (d - c)))); return ''; };
  let inp = typeDel('Kızım…', .3, 1.0, 1.5, 1.9); if (k >= 1.9) { const s2 = typeDel('Zeynep, ben…', 2.1, 2.9, 3.3, 3.8); inp = s2; }
  if (inp === '') inp = null;
  ctx.fillStyle = '#140b05'; ctx.fillRect(0, 0, W, H);
  ctx.save(); cam(1 + .04 * k, W / 2, H / 2);
  glow(200, 300, 900, '255,165,80', .35);
  const msgs = VOICE.slice(0, 10).map((m, i) => ({ ...m, out: false, played: i === 0 ? clamp(.4 + k * .15) : 1 }));
  phone(170, 160, 740, 1500, vh => chatScreen(vh, { name: 'Zeynep', avatar: '#8f4f5f', msgs, status: 'çevrimiçi', statusCol: '#8696a0', input: inp, caretT: t, keyboard: true, keyT: t }), { glowA: .8, glowCol: '255,200,150', rot: .03 });
  // başparmaklar
  const tap = Math.abs(Math.sin(t * 9));
  ctx.fillStyle = '#6a4630'; ctx.beginPath(); ctx.ellipse(330, 1640 - tap * 14, 70, 140, .5, 0, 6.283); ctx.fill(); ctx.beginPath(); ctx.ellipse(760, 1660 - (1 - tap) * 14, 70, 140, -.5, 0, 6.283); ctx.fill();
  ctx.fillStyle = 'rgba(255,190,130,.2)'; ctx.beginPath(); ctx.ellipse(310, 1580 - tap * 14, 30, 60, .5, 0, 6.283); ctx.fill();
  ctx.restore();
  ctx.fillStyle = 'rgba(80,40,10,.15)'; ctx.fillRect(0, 0, W, H);
}
function s5(t) {
  const lt = t - 40;
  if (lt < 8) {
    let z, cx, cy;
    const handP = [520 - .75 * 115, 860 + 3.05 * 115], face = [480, 860];
    if (lt < 3.5) { const p = eio(lt / 3.5); z = lerp(2.6, 1.0, p); cx = lerp(handP[0], W / 2, p); cy = lerp(handP[1], H / 2, p); }
    else { const p = eio((lt - 3.5) / 3); z = lerp(1.0, 2.9, p); cx = lerp(W / 2, face[0], p); cy = lerp(H / 2, face[1], p); }
    ctx.save(); cam(z, cx, cy); room5(t, lt, .6 + .2 * Math.sin(t * 2)); ctx.restore();
    // flashback
    const fa = win(lt, 6.5, 8.0, .12) * (.75 + .25 * Math.sin(t * 40));
    ambulance(lt - 6.5, fa);
    black(1 - ss(0, .3, lt));
  } else {
    draftsPhone(t, lt);
    black(1 - ss(8, 8.2, lt));
  }
}

// ---------- SAHNE 6 – Cevap (52–62) ----------
const FINAL_MSG = "Kızım… Ben Emre'nin annesiyim. Telefonunu kapatmaya kıyamadım. Her gece seni dinliyorum. O da seni çok severdi.";
function s6(t) {
  const lt = t - 52;
  if (lt < 2) { // Sevim yazıyor
    ctx.fillStyle = '#140b05'; ctx.fillRect(0, 0, W, H);
    ctx.save(); cam(1.08, W / 2, H / 2 + 120);
    glow(200, 300, 900, '255,165,80', .35);
    const typed = FINAL_MSG.slice(0, Math.floor(lt * 9));
    const msgs = VOICE.slice(0, 10).map(m => ({ ...m, out: false, played: 1 }));
    const jit = Math.sin(t * 37) * 2;
    phone(170 + jit, 160, 740, 1500, vh => chatScreen(vh, { name: 'Zeynep', avatar: '#8f4f5f', msgs, status: 'çevrimiçi', input: typed.slice(-26), caretT: t, keyboard: true, keyT: t * 1.6 }), { glowA: .8, glowCol: '255,200,150', rot: .03 });
    const tap = Math.abs(Math.sin(t * 11));
    ctx.fillStyle = '#6a4630'; ctx.beginPath(); ctx.ellipse(330 + jit, 1640 - tap * 16, 70, 140, .5, 0, 6.283); ctx.fill(); ctx.beginPath(); ctx.ellipse(760 + jit, 1660 - (1 - tap) * 16, 70, 140, -.5, 0, 6.283); ctx.fill();
    ctx.restore();
    black(ss(1.85, 2, lt));
  } else if (lt < 3.8 || lt >= 5.3) { // Zeynep'in telefonu
    const k = lt < 3.8 ? lt - 2 : lt - 5.3;
    const incoming = lt >= 5.3; const prog = clamp((lt - 5.6) / 3.6);
    const n = Math.floor(FINAL_MSG.length * prog);
    const msgs = VOICE.slice(0, 12).map(m => ({ ...m }));
    if (incoming && n > 0) msgs.unshift({ k: 't', text: FINAL_MSG.slice(0, n), out: false, tm: prog >= 1 ? '03:14' : '', caret: prog < 1 });
    const typing = !incoming || prog < 1;
    const dots = '.'.repeat(1 + Math.floor(t * 3) % 3);
    ctx.fillStyle = '#04070d'; ctx.fillRect(0, 0, W, H);
    const z = incoming ? 1.0 + .25 * eio((lt - 5.3) / 4.7) : 1.0 + .12 * eio(k / 1.8);
    ctx.save(); cam(z, W / 2, incoming ? H / 2 + 260 * eio((lt - 5.3) / 4) : H / 2 - 300 * eio(k / 1.8));
    phone(170, 180, 740, 1500, vh => chatScreen(vh, { msgs, status: typing ? 'yazıyor' + dots : 'son görülme yakın zamanda', statusCol: typing ? '#53bdeb' : '#8696a0' }), { glowA: 1 });
    ctx.restore();
    black(1 - ss(lt < 3.8 ? 2 : 5.3, (lt < 3.8 ? 2 : 5.3) + .12, lt));
  } else { // Zeynep'in yüzü – nefesini tutuyor
    const k = lt - 3.8;
    ctx.fillStyle = '#04070d'; ctx.fillRect(0, 0, W, H);
    const fl = .75 + .25 * Math.sin(t * 9) * Math.sin(t * 3.7);
    bust({ ...ZEY, x: 360, y: 1040 - k * 10, s: 1150, rot: .06, eye: 'open', glint: .9, wet: .7, light: [{ x: 1.1, y: .1, r: 1.1, col: '120,170,255', a: .65 * fl }], rim: '150,190,255', hairLight: { x: .4, y: -.5, r: .7, col: '120,170,255', a: .3 } });
    glow(1080, 900, 600, '120,170,255', .25 * fl);
    black(1 - ss(0, .1, k));
  }
}

// ---------- SAHNE 7 – Final (62–74) ----------
function zeyHalf(t, lt) {
  ctx.fillStyle = grad(0, 0, 0, 960, [[0, '#0b1426'], [1, '#14223b']]); ctx.fillRect(0, 0, W, 960);
  ctx.save(); ctx.beginPath(); ctx.rect(560, 60, 470, 600); ctx.clip(); ctx.fillStyle = grad(0, 60, 0, 660, [[0, '#0d1a33'], [1, '#1c2d4c']]); ctx.fillRect(560, 60, 470, 600);
  moon(830, 200, 50, 1 - ss(5.5, 7, lt)); bokeh(t, 560, 350, 470, 300, COLD, .4, .5, 20); rain(t, { x: 560, y: 60, w: 470, h: 600, alpha: .55, count: 100 }); glassDrops(t, 560, 60, 470, 600, '190,210,255', .7, 70); ctx.restore();
  ctx.strokeStyle = '#050911'; ctx.lineWidth = 16; ctx.strokeRect(560, 60, 470, 600);
  const rec = lt >= 2.2 && lt < 4.8;
  bust({ ...ZEY, x: 340, y: 450, s: 200, rot: rec ? .05 : .12, eye: rec ? 'down' : 'closed', tear: ss(.2, 2, lt), handMouth: lt < 2.1, handLight: '120,170,255', phone: rec ? 'mouth' : null, light: [{ x: 1.2, y: -.2, r: 1.8, col: '120,160,240', a: .4 }, { x: .8, y: .7, r: .8, col: '150,190,255', a: rec ? .45 : .15 }], rim: '150,180,240', hairLight: { x: .3, y: -.8, r: 1, col: '150,180,240', a: .3 } });
  if (rec) { ctx.save(); ctx.globalAlpha = ss(2.2, 2.4, lt); ctx.fillStyle = 'rgba(10,16,24,.75)'; rrect(640, 720, 300, 70, 35); ctx.fill(); ctx.fillStyle = `rgba(240,70,70,${.6 + .4 * Math.sin(t * 6)})`; ctx.beginPath(); ctx.arc(680, 755, 10, 0, 6.283); ctx.fill(); ctx.fillStyle = '#e9edef'; ctx.font = `30px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(`Sevim Hanım · 0:0${Math.floor(lt - 2.2)}`, 702, 757); ctx.restore(); }
  chip(790, 760, ss(5.0, 5.25, lt) * (1 - ss(5.9, 6.3, lt)), 'Dinlendi', .9);
}
function sevHalf(t, lt) {
  ctx.fillStyle = grad(0, 0, 0, 960, [[0, '#1d1009'], [1, '#2d190c']]); ctx.fillRect(0, 0, W, 960);
  ctx.save(); ctx.beginPath(); ctx.rect(50, 60, 470, 600); ctx.clip(); ctx.fillStyle = grad(0, 60, 0, 660, [[0, '#140d12'], [1, '#2b1c16']]); ctx.fillRect(50, 60, 470, 600);
  moon(250, 200, 50, 1 - ss(5.5, 7, lt), '255,235,200'); rain(t, { x: 50, y: 60, w: 470, h: 600, alpha: .5, count: 100, col: '230,190,150' }); glassDrops(t, 50, 60, 470, 600, '255,215,170', .7, 70); ctx.restore();
  ctx.strokeStyle = '#140b05'; ctx.lineWidth = 16; ctx.strokeRect(50, 60, 470, 600);
  glow(1000, 300, 700, '255,165,80', .35);
  const arrive = ss(4.8, 5.0, lt) * (1 - ss(5.6, 7, lt));
  bust({ ...SEV, x: 760, y: 430, s: 200, mir: true, rot: .1, eye: 'closed', tear: ss(.5, 2.6, lt), phone: 'chest', phoneA: .3 + arrive * .7, light: [{ x: 1.4, y: -.3, r: 2, col: '255,160,80', a: .5 }, { x: .3, y: 1.4, r: .9, col: '255,200,140', a: .25 + arrive * .5 }], rim: '255,180,100', hairLight: { x: .5, y: -.6, r: 1.2, col: '255,180,110', a: .5 } });
}
function s7(t) {
  const lt = t - 62;
  const tilt = eio((lt - 5.6) / 3.2); const off = tilt * 1980;
  // gökyüzü (birleşen renkler)
  if (tilt > 0) {
    ctx.fillStyle = grad(0, 0, 0, H, [[0, '#071022'], [.45, '#182545'], [.75, '#4a3326'], [1, '#6b4422']]); ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff'; STARS.forEach(s => { ctx.globalAlpha = (.3 + .5 * Math.abs(Math.sin(t * .8 + s.ph))) * tilt; ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r, 0, 6.283); ctx.fill(); }); ctx.globalAlpha = 1;
    const my = lerp(1100, 640, tilt);
    moon(W / 2, my, 95, tilt, '240,232,220');
    glow(W / 2, my, 900, '120,160,255', .12 * tilt); glow(W / 2, my + 200, 900, '255,170,90', .12 * tilt);
    rain(t, { alpha: .25 * (1 - ss(7, 9.5, lt)), count: 140 });
  }
  if (off < 1980) {
    ctx.save(); ctx.translate(0, off); ctx.beginPath(); ctx.rect(0, 0, W, 960); ctx.clip(); zeyHalf(t, lt); ctx.restore();
    ctx.save(); ctx.translate(0, 960 + off); ctx.beginPath(); ctx.rect(0, 0, W, 960); ctx.clip(); sevHalf(t, lt); ctx.restore();
    ctx.save(); ctx.translate(0, off); ctx.fillStyle = grad(0, 0, W, 0, [[0, 'rgba(120,160,255,.6)'], [1, 'rgba(255,170,90,.6)']]); ctx.fillRect(0, 958, W, 4); ctx.restore();
  }
  // yazılar
  const a1 = ss(7.4, 8.0, lt) * (1 - ss(9.9, 10.4, lt)), a2 = ss(8.2, 8.8, lt) * (1 - ss(9.9, 10.4, lt));
  text('Bazı mesajlar cevap beklemez.', W / 2, 1180, 50, { font: SERIF, italic: true, alpha: a1, shadow: 'rgba(0,0,0,.8)' });
  text('Sadece dinlenmek ister.', W / 2, 1260, 50, { font: SERIF, italic: true, alpha: a2, shadow: 'rgba(0,0,0,.8)', color: '#f3e3cf' });
  const c = ss(10.5, 11.0, lt);
  text('Bugün sevdiğin birine', W / 2, 1180, 52, { weight: 600, alpha: c, shadow: 'rgba(0,0,0,.8)' });
  text('bir sesli mesaj at.', W / 2, 1255, 52, { weight: 600, alpha: c, shadow: 'rgba(0,0,0,.8)' });
  ctx.save(); ctx.globalAlpha = c; text('🤍', W / 2, 1380, 76, { font: EMOJI }); ctx.restore();
  black(1 - ss(0, .2, lt)); black(ss(11.4, 12, lt));
}

// ---------- altyazılar ----------
const SUBS = [
  [0.4, 2.9, 'Hepsini dinliyorsun… neden hiç cevap vermiyorsun?', { y: 1290 }],
  [3.8, 7.3, 'Bugün yine o kafeye gittim. Senin sevdiğin kurabiyeden aldım…'],
  [7.3, 10.8, '…ama yiyemedim. İyi geceler.'],
  [13.4, 16.1, 'Annem seni sordu yine…'],
  [16.7, 19.5, 'Kar yağdı, sen hep ilk karda dışarı çıkardın…'],
  [20.0, 22.7, 'Bugün iyiyim. Galiba.'],
  [25.0, 27.8, 'Bugün senin doğum günün.'],
  [27.8, 30.8, 'Bir kere… sadece bir kere cevap ver. Lütfen.'],
  [41.2, 45.8, '“Bugün senin doğum günün…”', { italic: true, dim: true }],
  [64.2, 66.6, 'Yarın… size gelebilir miyim?', { y: 880 }],
];
function subtitles(t) {
  for (const [a, b, s, o = {}] of SUBS) {
    const al = win(t, a, b, .2); if (al <= 0) continue;
    const font = `${o.italic ? 'italic ' : ''}600 46px ${FONT}`; const lines = wrap(s, 860, font); const y0 = (o.y || 1440) - (lines.length - 1) * 30;
    lines.forEach((l, i) => text(l, W / 2, y0 + i * 60, 46, { weight: 600, italic: o.italic, alpha: al * (o.dim ? .75 : 1), shadow: 'rgba(0,0,0,.95)', blur: 14, color: o.dim ? '#f3dcc0' : '#fff' }));
  }
}

// ---------- ana çizim ----------
function render(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  if (t < 3) s0(t); else if (t < 13) s1(t); else if (t < 23) s2(t); else if (t < 33) s3(t);
  else if (t < 40) s4(t); else if (t < 52) s5(t); else if (t < 62) s6(t); else s7(t);
  vignette(t >= 52 && t < 62 ? .75 : .6);
  subtitles(t);
  grain(t);
}
window.render = render; window.DUR = DUR; window.FPS = FPS;

// ---------- önizleme oynatıcı ----------
if (!/render=1/.test(location.search)) {
  const audio = new Audio('final.wav'); let playing = false, t0 = 0, base = 0;
  const seek = document.getElementById('seek'), tc = document.getElementById('tc'), btn = document.getElementById('play');
  const cur = () => playing ? base + (performance.now() - t0) / 1000 : base;
  btn.onclick = () => { if (playing) { base = cur(); playing = false; audio.pause(); btn.textContent = '▶ Oynat'; } else { playing = true; t0 = performance.now(); audio.currentTime = base; audio.play().catch(() => { }); btn.textContent = '❚❚ Durdur'; } };
  seek.oninput = () => { base = +seek.value; t0 = performance.now(); audio.currentTime = base; };
  (function loop() { let t = cur(); if (t >= DUR) { t = DUR; playing = false; base = 0; btn.textContent = '▶ Oynat'; } render(t); seek.value = t; tc.textContent = t.toFixed(1) + ' s'; requestAnimationFrame(loop); })();
} else document.body.classList.add('render');
window.READY = true;
