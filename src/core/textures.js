// Procedural texture factory. All surfaces get colour variation + micro
// relief + roughness variation so nothing reads as flat "plastic".
import * as THREE from 'three';
import { tileNoise, rng, clamp, lerp, smoothstep } from './util.js';

const cache = new Map();

export function pixelTexture(key, w, h, fn, { srgb = true, repeat = [1, 1], wrap = true } = {}) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const d = img.data;
  const out = [0, 0, 0, 255];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      out[3] = 255;
      fn(x / w, y / h, out, x, y);
      const i = (y * w + x) * 4;
      d[i] = out[0]; d[i + 1] = out[1]; d[i + 2] = out[2]; d[i + 3] = out[3];
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (wrap) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; }
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  cache.set(key, tex);
  return tex;
}

export function canvasTexture(key, w, h, draw, { srgb = true, wrap = false } = {}) {
  if (key && cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (wrap) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  if (key) cache.set(key, tex);
  return tex;
}

const g = (v) => clamp(Math.round(v * 255), 0, 255);
const hex = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];

// ---------- surfaces ----------

// Oak planks: returns {map, rough, bump}
export function woodPlanks() {
  const W = 1024, H = 1024, rows = 8;
  const R = rng(11);
  const plank = [];
  for (let i = 0; i < rows; i++) plank.push({ off: R(), tone: 0.85 + R() * 0.3, seed: Math.floor(R() * 1000) });
  const sample = (u, v) => {
    const row = Math.floor(v * rows);
    const p = plank[row];
    const lu = (u + p.off) % 1;
    const lv = v * rows - row;
    const seg = Math.floor(lu * 2);
    const grain = tileNoise(lu * 0.15 + seg * 0.37, lv * 0.2 + row * 0.1, 60, p.seed, 3);
    const rings = Math.sin((lv * 9 + grain * 6 + lu * 1.5) * Math.PI * 2) * 0.5 + 0.5;
    const fine = tileNoise(u, v, 400, 3, 2);
    const gapV = smoothstep(0.0, 0.025, lv) * smoothstep(1.0, 0.975, lv);
    const endGap = smoothstep(0.0, 0.006, Math.abs((lu * 2) % 1 - 0.0)) * smoothstep(0, 0.006, Math.abs((lu * 2) % 1 - 1));
    return { p, rings, fine, gap: gapV * endGap, grain };
  };
  const base = hex(0xa87a52), dark = hex(0x6e4a2e);
  const map = pixelTexture('wood.map', W, H, (u, v, o) => {
    const s = sample(u, v);
    const t = clamp(0.55 + s.rings * 0.25 + s.grain * 0.25 + s.fine * 0.08);
    for (let k = 0; k < 3; k++) o[k] = g(lerp(dark[k], base[k], t) * s.p.tone * lerp(0.35, 1, s.gap));
  });
  const rough = pixelTexture('wood.rough', 512, 512, (u, v, o) => {
    const s = sample(u, v);
    const r = clamp(0.48 + s.fine * 0.12 + (1 - s.gap) * 0.4 + s.rings * 0.08);
    o[0] = o[1] = o[2] = g(r);
  }, { srgb: false });
  const bump = pixelTexture('wood.bump', 1024, 1024, (u, v, o) => {
    const s = sample(u, v);
    o[0] = o[1] = o[2] = g(clamp(0.5 + s.fine * 0.15 + s.rings * 0.12) * s.gap);
  }, { srgb: false });
  return { map, rough, bump };
}

// Painted plaster wall
export function plaster(tint = 0xe8e2d8) {
  const c = hex(tint);
  const key = 'plaster.' + tint;
  const map = pixelTexture(key, 512, 512, (u, v, o) => {
    const n = tileNoise(u, v, 6, 2, 4) * 0.035 + tileNoise(u, v, 40, 5, 2) * 0.015;
    for (let k = 0; k < 3; k++) o[k] = g(c[k] * (1 + n));
  });
  const bump = pixelTexture('plaster.bump', 512, 512, (u, v, o) => {
    const n = 0.5 + tileNoise(u, v, 90, 9, 3) * 0.35 + tileNoise(u, v, 14, 4, 2) * 0.15;
    o[0] = o[1] = o[2] = g(n);
  }, { srgb: false });
  return { map, bump };
}

// Glazed ceramic tiles with grout (subway pattern)
export function tiles(tint = 0xdfe6e4) {
  const c = hex(tint);
  const cols = 4, rows = 8;
  const R = rng(5);
  const jitter = Array.from({ length: cols * rows * 2 }, () => 0.94 + R() * 0.1);
  const cell = (u, v) => {
    const row = Math.floor(v * rows);
    const uu = u * cols + (row % 2 ? 0.5 : 0);
    const col = Math.floor(uu);
    const fu = uu - col, fv = v * rows - row;
    const edge = Math.min(fu, 1 - fu, (fv) * 0.5, (1 - fv) * 0.5);
    return { edge, id: (row * cols + (col % cols)) % jitter.length, fu, fv };
  };
  const map = pixelTexture('tiles.map.' + tint, 512, 512, (u, v, o) => {
    const s = cell(u, v);
    const grout = smoothstep(0.008, 0.018, s.edge);
    const tone = jitter[s.id] * (1 + tileNoise(u, v, 20, 3, 2) * 0.02);
    for (let k = 0; k < 3; k++) o[k] = g(lerp(0.55, c[k] * tone, grout));
  });
  const bump = pixelTexture('tiles.bump', 512, 512, (u, v, o) => {
    const s = cell(u, v);
    const bevel = smoothstep(0.005, 0.04, s.edge);
    o[0] = o[1] = o[2] = g(0.2 + bevel * 0.75 + tileNoise(u, v, 60, 1, 2) * 0.03);
  }, { srgb: false });
  const rough = pixelTexture('tiles.rough', 256, 256, (u, v, o) => {
    const s = cell(u, v);
    o[0] = o[1] = o[2] = g(s.edge < 0.016 ? 0.9 : 0.12 + tileNoise(u, v, 30, 8, 2) * 0.05);
  }, { srgb: false });
  return { map, bump, rough };
}

// Knit jersey fabric (hoodie): tiny V loops in rows
export function knit() {
  return pixelTexture('knit.bump', 256, 256, (u, v, o) => {
    const cu = u * 32, cv = v * 48;
    const fu = cu - Math.floor(cu), fv = cv - Math.floor(cv);
    const loop = Math.abs(fu - 0.5) * 2;
    const vshape = Math.sin((fv + loop * 0.5) * Math.PI);
    const n = 0.5 + vshape * 0.3 + tileNoise(u, v, 30, 4, 2) * 0.12;
    o[0] = o[1] = o[2] = g(n);
  }, { srgb: false });
}
// Rib knit for cuffs/hem
export function rib() {
  return pixelTexture('rib.bump', 128, 128, (u, v, o) => {
    const s = Math.sin(u * Math.PI * 2 * 24) * 0.5 + 0.5;
    o[0] = o[1] = o[2] = g(0.3 + s * 0.6 + tileNoise(u, v, 20, 2, 2) * 0.05);
  }, { srgb: false });
}
// Cotton plain weave (sheets, t-shirt) + denim twill
export function weave(twill = false) {
  return pixelTexture('weave.' + twill, 256, 256, (u, v, o) => {
    const a = u * 64, b = v * 64;
    let s;
    if (twill) s = Math.sin((a + b) * Math.PI * 0.5) * 0.5 + 0.5;
    else s = (Math.sin(a * Math.PI) * Math.sin(b * Math.PI)) * 0.5 + 0.5;
    o[0] = o[1] = o[2] = g(0.35 + s * 0.4 + tileNoise(u, v, 16, 7, 3) * 0.2);
  }, { srgb: false });
}
// Fabric colour with slubs/heather (melange) variation
export function heather(tint, key, amount = 0.08) {
  const c = hex(tint);
  return pixelTexture('heather.' + key, 512, 512, (u, v, o) => {
    const n = tileNoise(u, v, 140, 2, 2) * amount + tileNoise(u * 0.5, v * 3, 20, 9, 2) * amount * 0.5;
    for (let k = 0; k < 3; k++) o[k] = g(c[k] * (1 + n));
  });
}
// Generic grey noise (roughness/bump variation)
export function noiseMap(key, freq = 8, lo = 0.4, hi = 0.6, oct = 4, size = 256) {
  return pixelTexture('noise.' + key, size, size, (u, v, o) => {
    o[0] = o[1] = o[2] = g(lerp(lo, hi, tileNoise(u, v, freq, key.length * 7, oct) * 0.5 + 0.5));
  }, { srgb: false });
}
// Brushed metal streaks (along u)
export function brushed() {
  return pixelTexture('brushed', 512, 64, (u, v, o) => {
    const n = tileNoise(u * 0.02, v, 120, 3, 3);
    o[0] = o[1] = o[2] = g(0.5 + n * 0.5);
  }, { srgb: false });
}
// Skin micro-detail: pores + fine wrinkles, tileable
export function skinDetail() {
  return pixelTexture('skin.detail', 512, 512, (u, v, o) => {
    const pores = tileNoise(u, v, 180, 4, 2);
    const p = smoothstep(0.35, 0.75, pores) * 0.35;
    const wr = tileNoise(u * 4, v, 30, 6, 3) * 0.12;
    o[0] = o[1] = o[2] = g(0.6 - p + wr);
  }, { srgb: false });
}
// Hair strand texture: u = across strand, v = along. Dark core + lighter fibres.
export function hairStrands() {
  const R = rng(9);
  const fib = Array.from({ length: 64 }, () => R());
  return pixelTexture('hair.map', 256, 256, (u, v, o) => {
    const f = fib[Math.floor(u * 64)];
    const l = 0.75 + f * 0.35 + tileNoise(u, v * 0.2, 40, 1, 2) * 0.1;
    o[0] = g(0.25 * l); o[1] = g(0.17 * l); o[2] = g(0.11 * l);
  });
}

// Eye ball: iris at the +Z pole after the sphere is rotated; texture is
// equirectangular so iris = band near v=0 (top row is the pole).
export function eyeTexture(irisColor = 0x5a3a1e) {
  const ic = hex(irisColor);
  const R = rng(21);
  const fibres = Array.from({ length: 256 }, () => R());
  return pixelTexture('eye.' + irisColor, 1024, 512, (u, v, o, x) => {
    const ang = v * 180; // degrees from the front pole
    const irisR = 31, pupilR = 12.5;
    if (ang < pupilR) { o[0] = o[1] = o[2] = 6; return; }
    if (ang < irisR) {
      const r = (ang - pupilR) / (irisR - pupilR);
      const fb = fibres[Math.floor(u * 256)] * 0.5 + fibres[(Math.floor(u * 256) + 7) % 256] * 0.5;
      const collar = smoothstep(0.25, 0.35, r) * smoothstep(0.5, 0.36, r);
      let l = 0.75 + fb * 0.45 + collar * 0.35 - smoothstep(0.75, 1.0, r) * 0.75;
      l *= 1 - smoothstep(0.0, 0.12, 0.12 - r) * 0.4;
      // warm amber ring near the pupil
      const amb = smoothstep(0.4, 0.05, r);
      o[0] = g(clamp(ic[0] * l + amb * 0.18));
      o[1] = g(clamp(ic[1] * l + amb * 0.1));
      o[2] = g(clamp(ic[2] * l));
      return;
    }
    // sclera: off-white, warmer and redder toward the back, faint veins
    const back = smoothstep(irisR + 4, 90, ang);
    const vein = Math.pow(Math.max(0, tileNoise(u * 3, v * 2, 18, 3, 3)), 6) * 6 * back;
    o[0] = g(clamp(0.92 - back * 0.08 + vein * 0.1));
    o[1] = g(clamp(0.89 - back * 0.16 - vein * 0.25));
    o[2] = g(clamp(0.87 - back * 0.18 - vein * 0.25));
  }, { wrap: false });
}

// Soft round sprite (steam, dust)
export function softSprite() {
  return canvasTexture('sprite.soft', 128, 128, (ctx, w, h) => {
    const grd = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.4, 'rgba(255,255,255,0.45)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);
  });
}
export function steamSprite() {
  return pixelTexture('sprite.steam', 128, 128, (u, v, o) => {
    const dx = u - 0.5, dy = v - 0.5;
    const r = Math.sqrt(dx * dx + dy * dy) * 2;
    const n = tileNoise(u, v, 5, 3, 4) * 0.5 + 0.5;
    const a = clamp((1 - r) * 1.4) * n;
    o[0] = o[1] = o[2] = 255;
    o[3] = g(a * a);
  }, { wrap: false });
}

// Hair card: RGBA strip of individual fibres, u = across, v = root->tip.
export function hairCard() {
  const R = rng(31);
  const fib = Array.from({ length: 34 }, () => ({ x: R(), w: 0.006 + R() * 0.01, len: 0.55 + R() * 0.45, l: 0.7 + R() * 0.6, wave: R() * 6 }));
  return pixelTexture('hair.card', 256, 512, (u, vv, o) => {
    const v = 1 - vv;
    let a = 0, l = 0;
    for (const f of fib) {
      const x = f.x + Math.sin(v * 3 + f.wave) * 0.015;
      const taper = 1 - smoothstep(f.len * 0.6, f.len, v);
      const w = f.w * (0.3 + 0.7 * taper);
      const d = Math.abs(u - x);
      const c = smoothstep(w, w * 0.3, d) * (v < f.len ? 1 : 0);
      if (c > a) { a = c; l = f.l; }
    }
    const edge = smoothstep(0, 0.12, u) * smoothstep(1, 0.88, u);
    a *= edge * smoothstep(0, 0.04, v);
    const shade = (0.55 + 0.45 * v) * l;
    o[0] = g(clamp(0.3 * shade)); o[1] = g(clamp(0.2 * shade)); o[2] = g(clamp(0.13 * shade));
    o[3] = g(clamp(a * 1.2));
  }, { wrap: false });
}
