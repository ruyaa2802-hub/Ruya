// Phone screen UI rendered into a canvas each frame from a plain state object.
// All apps are fictional. Text is Turkish, sized for mobile legibility.
import { clamp, ease, lerp } from '../core/util.js';
import { PHONE } from './props.js';

export const SCREEN_W = 540, SCREEN_H = 1170;
const F = 'Inter, "DejaVu Sans", sans-serif';

export const fmtTL = (n) => {
  const s = Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (n < 0 ? '-' : '') + s + ' TL';
};

// calculator layout (canvas px) -> also used to aim the fingertip
const CALC_KEYS = [
  ['C', '±', '%', '÷'], ['7', '8', '9', '×'], ['4', '5', '6', '−'], ['1', '2', '3', '+'], ['0', ',', '⌫', '='],
];
function calcKeyRect(label) {
  for (let r = 0; r < CALC_KEYS.length; r++) {
    const c = CALC_KEYS[r].indexOf(label);
    if (c >= 0) {
      const size = 112, gap = 14, x0 = (SCREEN_W - (4 * size + 3 * gap)) / 2, y0 = 470;
      return { x: x0 + c * (size + gap), y: y0 + r * (size + gap), w: size, h: size };
    }
  }
  return null;
}
// phone-local position (metres, on the screen plane) of a calculator key
export function calcKeyLocal(label) {
  const r = calcKeyRect(label);
  if (!r) return [0, 0];
  const u = (r.x + r.w / 2) / SCREEN_W, v = (r.y + r.h / 2) / SCREEN_H;
  return [(u - 0.5) * PHONE.screenW, (0.5 - v) * PHONE.screenH];
}
export function screenLocal(px, py) {
  return [(px / SCREEN_W - 0.5) * PHONE.screenW, (0.5 - py / SCREEN_H) * PHONE.screenH];
}

function rr(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}

export class PhoneUI {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = SCREEN_W; this.canvas.height = SCREEN_H;
    this.ctx = this.canvas.getContext('2d');
    this.lastKey = '';
    this.brightness = 0;
  }
  // returns average luminance (0..1) and tint for the screen light
  draw(st) {
    const key = JSON.stringify(st);
    if (key === this.lastKey) return this.lightInfo;
    this.lastKey = key;
    const c = this.ctx;
    c.save();
    c.fillStyle = '#000'; c.fillRect(0, 0, SCREEN_W, SCREEN_H);
    const wake = st.wake ?? 1;
    if (wake <= 0.001) { c.restore(); this.lightInfo = { lum: 0, color: [0.7, 0.8, 1] }; return this.lightInfo; }
    let info = { lum: 0.35, color: [0.75, 0.85, 1] };
    switch (st.screen) {
      case 'lock': info = this.lock(c, st); break;
      case 'bank': info = this.bank(c, st); break;
      case 'calc': info = this.calc(c, st); break;
      case 'cafe': info = this.cafe(c, st); break;
      case 'declined': info = this.declined(c, st); break;
    }
    if (st.notifs && st.notifs.length) this.notifs(c, st.notifs, st.screen === 'lock' ? 330 : 40);
    c.globalAlpha = 1;
    // wake fade
    if (wake < 1) { c.fillStyle = `rgba(0,0,0,${1 - wake})`; c.fillRect(0, 0, SCREEN_W, SCREEN_H); }
    c.restore();
    this.lightInfo = { lum: info.lum * wake, color: info.color };
    return this.lightInfo;
  }
  status(c, dark = false) {
    c.fillStyle = dark ? '#111' : '#fff';
    c.font = `600 26px ${F}`; c.textAlign = 'left'; c.fillText('07:42', 40, 52);
    c.textAlign = 'right'; c.fillText('▮▮▮  87%', SCREEN_W - 36, 52);
    c.textAlign = 'left';
  }
  lock(c, st) {
    const g = c.createLinearGradient(0, 0, 0, SCREEN_H);
    g.addColorStop(0, '#26344f'); g.addColorStop(0.55, '#3b3f63'); g.addColorStop(1, '#704f63');
    c.fillStyle = g; c.fillRect(0, 0, SCREEN_W, SCREEN_H);
    // soft wallpaper shapes
    c.fillStyle = 'rgba(255,190,150,0.18)'; c.beginPath(); c.arc(420, 860, 260, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(120,170,255,0.15)'; c.beginPath(); c.arc(90, 980, 200, 0, Math.PI * 2); c.fill();
    this.status(c);
    c.fillStyle = '#fff'; c.textAlign = 'center';
    c.font = `500 34px ${F}`; c.fillText('15 Ekim Çarşamba', SCREEN_W / 2, 150);
    c.font = `300 150px ${F}`; c.fillText('07:42', SCREEN_W / 2, 290);
    c.textAlign = 'left';
    return { lum: 0.32, color: [0.62, 0.66, 0.95] };
  }
  notifs(c, list, top) {
    let y = top;
    for (const n of list) {
      const a = clamp(n.age / 0.35);
      const e = ease.outBack(a);
      const h = n.big ? 190 : 150;
      const yy = lerp(y - 120, y, e);
      c.globalAlpha = clamp(a * 1.5) * (n.fade ?? 1);
      c.fillStyle = n.tone === 'good' ? 'rgba(235,255,240,0.95)' : n.tone === 'bad' ? 'rgba(255,236,233,0.96)' : 'rgba(245,245,248,0.94)';
      rr(c, 22, yy, SCREEN_W - 44, h, 30); c.fill();
      // app badge
      c.fillStyle = n.color || '#2d6cdf';
      rr(c, 44, yy + 24, 54, 54, 14); c.fill();
      c.fillStyle = '#fff'; c.font = `700 30px ${F}`; c.textAlign = 'center'; c.fillText(n.icon || '₺', 71, yy + 62); c.textAlign = 'left';
      c.fillStyle = '#555'; c.font = `600 24px ${F}`; c.fillText(n.app, 114, yy + 46);
      c.textAlign = 'right'; c.fillStyle = '#888'; c.font = `400 22px ${F}`; c.fillText('şimdi', SCREEN_W - 48, yy + 46); c.textAlign = 'left';
      c.fillStyle = '#111'; c.font = `700 32px ${F}`; c.fillText(n.title, 114, yy + 90);
      if (n.body) { c.fillStyle = n.tone === 'bad' ? '#b3261e' : n.tone === 'good' ? '#13803d' : '#333'; c.font = `700 ${n.big ? 44 : 32}px ${F}`; c.fillText(n.body, 114, yy + (n.big ? 150 : 128)); }
      y += (h + 16) * e;
    }
    c.globalAlpha = 1;
  }
  bank(c, st) {
    const b = st.bank || {};
    c.fillStyle = '#f3f5f8'; c.fillRect(0, 0, SCREEN_W, SCREEN_H);
    c.fillStyle = '#123d7a'; c.fillRect(0, 0, SCREEN_W, 430);
    this.status(c);
    c.fillStyle = '#cfe0ff'; c.font = `600 30px ${F}`; c.fillText('Bankam · Vadesiz Hesap', 40, 130);
    c.fillStyle = '#fff'; c.font = `500 30px ${F}`; c.fillText('Kullanılabilir bakiye', 40, 210);
    const flash = b.flash || 0;
    c.fillStyle = flash > 0 ? `rgb(255,${Math.round(255 - 120 * flash)},${Math.round(255 - 140 * flash)})` : '#fff';
    c.font = `700 92px ${F}`; c.fillText(fmtTL(b.balance ?? 0), 40, 315);
    c.fillStyle = '#9fbaf0'; c.font = `400 26px ${F}`; c.fillText('Son hareketler', 40, 392);
    let y = 470;
    for (const it of b.items || []) {
      const a = clamp(it.age / 0.3);
      c.globalAlpha = a;
      const x = lerp(80, 24, ease.out(a));
      c.fillStyle = '#fff'; rr(c, x, y, SCREEN_W - 48, 104, 22); c.fill();
      c.fillStyle = it.amount < 0 ? '#fde8e6' : '#e5f6ea'; rr(c, x + 18, y + 22, 60, 60, 16); c.fill();
      c.fillStyle = it.amount < 0 ? '#c0392b' : '#1e8e4b'; c.font = `700 32px ${F}`; c.textAlign = 'center'; c.fillText(it.icon || '•', x + 48, y + 64); c.textAlign = 'left';
      c.fillStyle = '#1b1f24'; c.font = `600 30px ${F}`; c.fillText(it.label, x + 96, y + 50);
      c.fillStyle = '#7a8087'; c.font = `400 22px ${F}`; c.fillText(it.sub || 'Otomatik ödeme', x + 96, y + 82);
      c.textAlign = 'right'; c.fillStyle = it.amount < 0 ? '#c0392b' : '#1e8e4b'; c.font = `700 32px ${F}`;
      c.fillText((it.amount > 0 ? '+' : '') + fmtTL(it.amount), x + SCREEN_W - 70, y + 64); c.textAlign = 'left';
      y += 118;
      c.globalAlpha = 1;
    }
    return { lum: 0.75, color: [0.9, 0.94, 1] };
  }
  calc(c, st) {
    const k = st.calc || {};
    c.fillStyle = '#111316'; c.fillRect(0, 0, SCREEN_W, SCREEN_H);
    this.status(c);
    c.textAlign = 'right';
    c.fillStyle = '#8a9099'; c.font = `400 34px ${F}`;
    const expr = k.expr || '';
    const lines = [];
    for (let i = 0; i < expr.length; i += 22) lines.push(expr.slice(i, i + 22));
    lines.slice(-3).forEach((l, i, arr) => c.fillText(l, SCREEN_W - 44, 300 - (arr.length - 1 - i) * 44));
    c.fillStyle = k.alert ? '#ff6b5b' : '#fff'; c.font = `300 ${k.result && k.result.length > 8 ? 96 : 120}px ${F}`;
    c.fillText(k.result || '0', SCREEN_W - 40, 430);
    c.textAlign = 'center';
    for (const row of CALC_KEYS) for (const lab of row) {
      const r = calcKeyRect(lab);
      const op = '÷×−+='.includes(lab), fn = 'C±%'.includes(lab);
      const pressed = k.pressed === lab ? clamp(k.pressAmt ?? 1) : 0;
      c.fillStyle = op ? `rgb(${255 - 60 * pressed},${159 - 40 * pressed},${10})` : fn ? `rgb(${165 + 60 * pressed},${165 + 60 * pressed},${165 + 60 * pressed})` : `rgb(${51 + 90 * pressed},${51 + 90 * pressed},${55 + 90 * pressed})`;
      c.beginPath(); c.arc(r.x + r.w / 2, r.y + r.h / 2, r.w / 2, 0, Math.PI * 2); c.fill();
      c.fillStyle = fn ? '#111' : '#fff'; c.font = `500 46px ${F}`;
      c.fillText(lab, r.x + r.w / 2, r.y + r.h / 2 + 16);
    }
    c.textAlign = 'left';
    return { lum: 0.2, color: [0.85, 0.8, 0.75] };
  }
  cafe(c, st) {
    const k = st.cafe || {};
    c.fillStyle = '#fbf6ef'; c.fillRect(0, 0, SCREEN_W, SCREEN_H);
    c.fillStyle = '#5a3a24'; c.fillRect(0, 0, SCREEN_W, 150);
    this.status(c);
    c.fillStyle = '#f5e7d6'; c.font = `700 36px ${F}`; c.fillText('☕ Kahve Durağı', 40, 118);
    // product card
    const g = c.createRadialGradient(270, 400, 20, 270, 400, 190);
    g.addColorStop(0, '#f3d9b5'); g.addColorStop(1, '#c58a52');
    c.fillStyle = g; c.beginPath(); c.arc(270, 400, 170, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff6ea'; c.beginPath(); c.ellipse(270, 345, 120, 40, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#b77b46'; c.lineWidth = 8; c.beginPath(); c.moveTo(210, 345); c.bezierCurveTo(250, 310, 300, 380, 330, 340); c.stroke();
    c.fillStyle = '#2b1a10'; c.font = `700 46px ${F}`; c.textAlign = 'center'; c.fillText('Karamelli Latte', 270, 650);
    c.fillStyle = '#7a5a44'; c.font = `400 28px ${F}`; c.fillText('Büyük boy · Kendine bir iyilik yap', 270, 700);
    c.fillStyle = '#2b1a10'; c.font = `800 72px ${F}`; c.fillText('145 TL', 270, 800);
    // pay button
    const press = clamp(k.press || 0);
    c.fillStyle = `rgb(${Math.round(46 - 20 * press)},${Math.round(125 - 30 * press)},${Math.round(50 - 10 * press)})`;
    rr(c, 50, 900, SCREEN_W - 100, 120, 60); c.fill();
    c.fillStyle = '#fff'; c.font = `700 44px ${F}`;
    if (k.loading) {
      c.save(); c.translate(270, 960); c.rotate(k.loading * 7);
      c.strokeStyle = '#fff'; c.lineWidth = 7; c.beginPath(); c.arc(0, 0, 28, 0, Math.PI * 1.4); c.stroke();
      c.restore();
    } else c.fillText('Öde · 145 TL', 270, 976);
    c.textAlign = 'left';
    return { lum: 0.85, color: [1, 0.93, 0.85] };
  }
  declined(c, st) {
    const k = st.declined || {};
    c.fillStyle = '#fbf6ef'; c.fillRect(0, 0, SCREEN_W, SCREEN_H);
    c.fillStyle = `rgba(200,40,30,${0.15 + 0.85 * clamp(k.a ?? 1)})`; c.fillRect(0, 0, SCREEN_W, SCREEN_H);
    this.status(c);
    c.fillStyle = '#fff'; c.textAlign = 'center';
    c.beginPath(); c.arc(270, 360, 110, 0, Math.PI * 2); c.lineWidth = 14; c.strokeStyle = '#fff'; c.stroke();
    c.lineWidth = 16; c.beginPath(); c.moveTo(225, 315); c.lineTo(315, 405); c.moveTo(315, 315); c.lineTo(225, 405); c.stroke();
    c.font = `800 58px ${F}`; c.fillText('Ödeme reddedildi', 270, 580);
    c.font = `500 36px ${F}`; c.fillText('Yetersiz bakiye', 270, 640);
    c.font = `700 52px ${F}`; c.fillText(`Bakiye: ${fmtTL(k.balance ?? 0)}`, 270, 760);
    c.textAlign = 'left';
    return { lum: 0.6, color: [1, 0.35, 0.3] };
  }
}
