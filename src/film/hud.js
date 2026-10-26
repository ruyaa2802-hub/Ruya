// 2D layer composited after grading: burned-in subtitles, diegetic info cards
// anchored to 3D points (projected each frame, so they move with the scene but
// stay sharp and legible), and the title card. Respects Shorts safe zones.
import * as THREE from 'three';
import { clamp, ease, lerp } from '../core/util.js';

const F = 'Inter, "DejaVu Sans", sans-serif';
function rr(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}

export class Hud {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.canvas = document.createElement('canvas');
    this.canvas.width = w; this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.NoColorSpace;
    this.texture.premultiplyAlpha = true;
    this.s = w / 1080;
  }
  draw({ subtitle, cards = [], title, camera }) {
    const c = this.ctx, s = this.s;
    c.clearRect(0, 0, this.w, this.h);
    for (const card of cards) this.card(c, card, camera);
    if (subtitle && subtitle.a > 0.01) this.sub(c, subtitle);
    if (title && title.a > 0.01) this.title(c, title);
    this.texture.needsUpdate = true;
  }
  sub(c, { text, a, style }) {
    const s = this.s;
    c.save();
    c.globalAlpha = a;
    const italic = style === 'thought';
    c.font = `${italic ? 'italic 600' : '800'} ${Math.round(54 * s)}px ${F}`;
    const maxW = 860 * s;
    const words = text.split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
      const t = cur ? cur + ' ' + w : w;
      if (c.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
    }
    lines.push(cur);
    const lh = 70 * s;
    const y0 = this.h * 0.7 - (lines.length - 1) * lh;
    lines.forEach((l, i) => {
      const tw = c.measureText(l).width;
      const x = this.w * 0.47 - tw / 2;
      const y = y0 + i * lh;
      c.fillStyle = 'rgba(10,10,14,0.55)';
      rr(c, x - 22 * s, y - 52 * s, tw + 44 * s, 68 * s, 18 * s); c.fill();
      c.fillStyle = italic ? '#ffe9b8' : '#ffffff';
      c.fillText(l, x, y);
    });
    c.restore();
  }
  // card: { anchor: Vector3 world, text, sub, tone, age, life, offset:[px,py] }
  card(c, card, camera) {
    const s = this.s;
    const p = card.anchor.clone().project(camera);
    if (p.z > 1) return;
    const a = clamp(card.age / 0.25) * (1 - clamp((card.age - card.life) / 0.3));
    if (a <= 0) return;
    let x = (p.x * 0.5 + 0.5) * this.w + (card.offset ? card.offset[0] * s : 0);
    let y = (-p.y * 0.5 + 0.5) * this.h + (card.offset ? card.offset[1] * s : 0) - ease.out(clamp(card.age / 0.5)) * 30 * s - Math.max(0, card.age - card.life) * 80 * s;
    const sc = lerp(0.85, 1, ease.outBack(clamp(card.age / 0.3)));
    c.save();
    c.globalAlpha = a;
    c.translate(x, y); c.scale(sc, sc);
    c.font = `800 ${Math.round((card.big ? 64 : 46) * s)}px ${F}`;
    const tw = c.measureText(card.text).width;
    c.font = `600 ${Math.round(28 * s)}px ${F}`;
    const sw = card.sub ? c.measureText(card.sub).width : 0;
    const W = Math.max(tw, sw) + 56 * s, H = (card.sub ? (card.big ? 128 : 108) : (card.big ? 92 : 74)) * s;
    // keep inside the safe area (avoid the right-hand Shorts buttons)
    let dx = 0;
    const left = x - W / 2, right = x + W / 2;
    if (left < 40 * s) dx = 40 * s - left;
    if (right > this.w * 0.82) dx = this.w * 0.82 - right;
    c.translate(dx, 0);
    const col = card.tone === 'bad' ? [214, 55, 45] : card.tone === 'good' ? [30, 150, 80] : [40, 44, 52];
    c.shadowColor = 'rgba(0,0,0,0.35)'; c.shadowBlur = 24 * s; c.shadowOffsetY = 8 * s;
    c.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},0.88)`;
    rr(c, -W / 2, -H / 2, W, H, 22 * s); c.fill();
    c.shadowColor = 'transparent';
    c.fillStyle = '#fff'; c.textAlign = 'center';
    c.font = `800 ${Math.round((card.big ? 64 : 46) * s)}px ${F}`;
    c.fillText(card.text, 0, card.sub ? -4 * s : 16 * s);
    if (card.sub) { c.font = `600 ${Math.round(28 * s)}px ${F}`; c.fillStyle = 'rgba(255,255,255,0.85)'; c.fillText(card.sub, 0, 36 * s); }
    c.restore();
  }
  title(c, { text, sub, a }) {
    const s = this.s;
    c.save();
    c.globalAlpha = a;
    c.textAlign = 'center';
    c.fillStyle = 'rgba(8,8,12,0.55)';
    rr(c, 90 * s, this.h * 0.12 - 70 * s, this.w - 180 * s, 190 * s, 28 * s); c.fill();
    c.fillStyle = '#fff'; c.font = `900 ${Math.round(62 * s)}px ${F}`;
    c.fillText(text, this.w / 2, this.h * 0.12 + 8 * s);
    if (sub) { c.fillStyle = '#ffd27a'; c.font = `700 ${Math.round(34 * s)}px ${F}`; c.fillText(sub, this.w / 2, this.h * 0.12 + 72 * s); }
    c.restore();
  }
}
