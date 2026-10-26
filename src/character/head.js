// Procedural sculpted head with a real mouth opening, morph-target facial
// rig (17 shapes), eyeballs with iris/cornea, animated eyelids + lashes,
// teeth/tongue on a jaw pivot, ears and 3D eyebrows.
import * as THREE from 'three';
import { clamp, lerp, smoothstep, rng, fbm3, noise3, DEG } from '../core/util.js';
import * as M from '../core/materials.js';
import { eyeTexture, hairCard } from '../core/textures.js';
import { smoothCoincidentNormals } from './rig.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const HEAD = { HW: 0.0775, HH: 0.109, HD: 0.101, C: V(0, 0.084, 0.016) };
const { HW, HH, HD, C } = HEAD;

const ROWS = 150, COLS = 184;
const THETA_M = 115 * DEG; // mouth line latitude
const Y_M = Math.cos(THETA_M);
export const MOUTH_HALF = 0.27;

const g2 = (x, y, cx, cy, sx, sy) => Math.exp(-(((x - cx) / sx) ** 2) - (((y - cy) / sy) ** 2));
const gSym = (x, y, cx, cy, sx, sy) => g2(x, y, cx, cy, sx, sy) + g2(x, y, -cx, cy, sx, sy);
const front = (z) => smoothstep(0.02, 0.4, z);

// ---------- base shape + features (unit-sphere dir -> metres) ----------
function baseShape(d) {
  const { x, y, z } = d;
  const low = smoothstep(-0.05, -0.95, y);
  let wx = 1 - 0.12 * smoothstep(-0.15, -0.85, y) * (0.6 + 0.4 * smoothstep(-0.4, 0.6, z)) - 0.13 * smoothstep(-0.68, -1.0, y) * smoothstep(-0.2, 0.5, z);
  wx *= 1 - 0.05 * Math.exp(-(((y + 0.12) / 0.25) ** 2)) * smoothstep(0.2, 0.7, z);
  wx *= 1 - 0.07 * smoothstep(0.55, 1, y);
  wx *= 1 + 0.03 * g2(y, z, 0.15, -0.3, 0.5, 0.5); // parietal width
  let zf;
  if (z > 0) zf = 1 - 0.2 * x * x - 0.07 * smoothstep(0.35, 0.95, y) + 0.03 * smoothstep(-0.5, -0.9, y);
  else zf = 1.05 - 0.05 * smoothstep(-0.15, -0.8, y) - 0.32 * smoothstep(-0.4, -0.97, y);
  const p = V(x * HW * wx, y * HH, z * HD * zf);
  p.y += 0.012 * smoothstep(-0.78, -1, y) * (z > -0.25 ? 1 : 0.4);
  return p;
}
function featureHeight(d) {
  const { x, y, z } = d;
  const f = front(z);
  let h = 0;
  h += 0.004 * g2(x, y, 0, 0.55, 0.45, 0.25);
  h += 0.0035 * gSym(x, y, 0.3, 0.31, 0.2, 0.055) + 0.0015 * g2(x, y, 0, 0.27, 0.08, 0.06);
  h -= 0.0042 * gSym(x, y, 0.36, 0.13, 0.16, 0.1);
  h -= 0.003 * gSym(x, y, 0.78, 0.32, 0.15, 0.2);
  h += 0.0045 * gSym(x, y, 0.56, -0.02, 0.15, 0.1);
  h -= 0.0016 * gSym(x, y, 0.24, -0.34, 0.035, 0.09); // nasolabial fold
  h -= 0.0025 * gSym(x, y, 0.5, -0.4, 0.15, 0.12);
  // nose
  const win = smoothstep(0.16, 0.06, y) * smoothstep(-0.26, -0.16, y);
  h += (0.003 + 0.008 * smoothstep(0.08, -0.18, y)) * Math.exp(-((x / 0.085) ** 2)) * win;
  h += 0.0125 * g2(x, y, 0, -0.2, 0.1, 0.075);
  h += 0.006 * g2(x, y, 0, -0.275, 0.05, 0.032);
  h += 0.0065 * gSym(x, y, 0.125, -0.25, 0.055, 0.045);
  h -= 0.0035 * gSym(x, y, 0.075, -0.3, 0.028, 0.018);
  // philtrum
  h += 0.001 * gSym(x, y, 0.04, -0.36, 0.015, 0.035) - 0.0006 * g2(x, y, 0, -0.36, 0.02, 0.035);
  // lips
  h += 0.0065 * g2(x, y, 0, Y_M + 0.055, 0.26, 0.04) + 0.0015 * gSym(x, y, 0.06, Y_M + 0.072, 0.05, 0.02);
  h += 0.0062 * g2(x, y, 0, Y_M - 0.065, 0.2, 0.045);
  h -= 0.002 * gSym(x, y, 0.28, Y_M, 0.035, 0.03);
  h -= 0.002 * g2(x, y, 0, Y_M - 0.16, 0.15, 0.04);
  // chin & jaw
  h += 0.007 * g2(x, y, 0, -0.8, 0.3, 0.13) + 0.003 * g2(x, y, 0, -0.92, 0.32, 0.1);
  h += 0.002 * gSym(x, y, 0.62, -0.62, 0.15, 0.15);
  return h * f;
}
// mouth crease: pulls the lip line inward to give lips an inner roll
function creaseDepth(d) {
  const mx = smoothstep(MOUTH_HALF + 0.07, MOUTH_HALF - 0.05, Math.abs(d.x));
  return -0.0062 * Math.exp(-(((d.y - Y_M) / 0.02) ** 2)) * mx * front(d.z);
}
function ellNormal(d) {
  return V(d.x / HW, d.y / HH, d.z / HD).normalize();
}
export function surfacePoint(d) {
  const p = baseShape(d);
  const n = ellNormal(d);
  p.addScaledVector(n, featureHeight(d) + creaseDepth(d));
  return p.add(C);
}
export function dirFromFront(x, y) {
  return V(x, y, Math.sqrt(Math.max(0, 1 - x * x - y * y)));
}

// ---------- region masks used by morphs + painting ----------
const mouthBand = (d, sy = 0.14) => Math.exp(-(((d.y - Y_M) / sy) ** 2));
function morphDelta(name, d, P, isLower, rowsBelow) {
  const { x, y, z } = d;
  const f = front(z);
  const out = V(0, 0, 0);
  const side = (s) => smoothstep(-0.06 * s, 0.1 * s, x * s); // 1 on side s
  switch (name) {
    case 'jawOpen': {
      if (!isLower) {
        // upper lip lifts a hair, corners stretch
        out.y += 0.0008 * mouthBand(d, 0.05) * smoothstep(MOUTH_HALF, 0, Math.abs(x)) * f;
        return out;
      }
      let w = smoothstep(-0.35, 0.1, z) * (1 - 0.55 * smoothstep(-0.82, -1.0, y));
      const nearCorner = smoothstep(MOUTH_HALF * 1.35, MOUTH_HALF * 0.7, Math.abs(x));
      w *= lerp(nearCorner, 1, 1 - Math.exp(-rowsBelow / 7));
      const J = V(0, 0.058, -0.012);
      const q = P.clone().sub(J);
      const a = 0.28 * w;
      const yy = q.y * Math.cos(a) - q.z * Math.sin(a);
      const zz = q.y * Math.sin(a) + q.z * Math.cos(a);
      out.set(0, yy - q.y, zz - q.z);
      return out;
    }
    case 'smileL': case 'smileR': {
      const s = name === 'smileL' ? 1 : -1;
      const sd = side(s);
      const band = mouthBand(d, 0.16);
      const along = smoothstep(0, MOUTH_HALF * 1.1, x * s);
      out.x += s * 0.0055 * along * band * f;
      out.y += 0.0068 * along * along * band * f;
      out.z -= 0.0035 * along * band * f;
      const cheek = g2(x * s, y, 0.47, -0.17, 0.2, 0.17) * f;
      out.y += 0.0035 * cheek; out.z += 0.0028 * cheek; out.x += s * 0.0015 * cheek;
      out.multiplyScalar(sd);
      return out;
    }
    case 'frownL': case 'frownR': {
      const s = name === 'frownL' ? 1 : -1;
      const band = mouthBand(d, 0.15);
      const along = smoothstep(0.05, MOUTH_HALF * 1.1, x * s);
      out.y -= 0.0052 * along * along * band * f;
      out.x += s * 0.0012 * along * band * f;
      out.y += 0.0015 * g2(x, y, 0, -0.78, 0.18, 0.1) * f; // chin raise
      out.multiplyScalar(side(s));
      return out;
    }
    case 'wide': {
      const band = mouthBand(d, 0.13);
      out.x += 0.0055 * Math.sign(x) * smoothstep(0, MOUTH_HALF * 1.1, Math.abs(x)) * band * f;
      out.z -= 0.0018 * band * smoothstep(0.4, 0, Math.abs(x)) * f;
      out.y += (isLower ? -0.0008 : 0.0008) * mouthBand(d, 0.06) * f;
      return out;
    }
    case 'pucker': {
      const lip = mouthBand(d, 0.11) * smoothstep(0.45, 0.1, Math.abs(x)) * f;
      out.x -= x * HW * 0.42 * lip;
      out.z += 0.0085 * lip;
      out.y += (isLower ? 0.0006 : -0.0006) * lip;
      return out;
    }
    case 'press': {
      const lip = mouthBand(d, 0.09) * smoothstep(0.35, 0.15, Math.abs(x)) * f;
      out.z -= 0.0032 * lip;
      out.y += (isLower ? 0.0012 : -0.0012) * lip;
      return out;
    }
    case 'fv': {
      if (!isLower) return out;
      const lip = mouthBand(d, 0.1) * smoothstep(0.32, 0.1, Math.abs(x)) * f;
      out.y += 0.0042 * lip; out.z -= 0.0048 * lip;
      return out;
    }
    case 'browInnerUp': {
      const w = gSym(x, y, 0.14, 0.33, 0.14, 0.12) * f;
      out.y += 0.0052 * w; out.z += 0.0006 * w;
      return out;
    }
    case 'browDown': {
      const w = gSym(x, y, 0.24, 0.3, 0.18, 0.09) * f;
      out.y -= 0.0042 * w; out.x -= Math.sign(x) * 0.0018 * w; out.z += 0.0012 * w;
      return out;
    }
    case 'browOuterUpL': case 'browOuterUpR': {
      const s = name === 'browOuterUpL' ? 1 : -1;
      const w = g2(x * s, y, 0.44, 0.31, 0.16, 0.12) * f;
      out.y += 0.0048 * w;
      return out;
    }
    case 'cheekPuff': {
      const w = gSym(x, y, 0.45, -0.38, 0.2, 0.17) * f;
      const n = ellNormal(d);
      out.addScaledVector(n, 0.0075 * w);
      out.z += 0.002 * mouthBand(d, 0.08) * smoothstep(0.3, 0, Math.abs(x)) * f;
      return out;
    }
    case 'squintL': case 'squintR': {
      const s = name === 'squintL' ? 1 : -1;
      const w = g2(x * s, y, 0.4, -0.02, 0.17, 0.08) * f;
      out.y += 0.0032 * w; out.z += 0.0012 * w;
      return out;
    }
    case 'sneer': {
      const w = gSym(x, y, 0.11, -0.26, 0.08, 0.07) * f;
      out.y += 0.0022 * w; out.z += 0.0006 * w;
      out.y += 0.0012 * mouthBand(d, 0.05) * (isLower ? 0 : 1) * smoothstep(0.3, 0, Math.abs(x)) * f;
      return out;
    }
  }
  return out;
}
export const MORPHS = ['jawOpen', 'smileL', 'smileR', 'frownL', 'frownR', 'wide', 'pucker', 'press', 'fv',
  'browInnerUp', 'browDown', 'browOuterUpL', 'browOuterUpR', 'cheekPuff', 'squintL', 'squintR', 'sneer'];

// ---------- skin paint ----------
function hairlineY(d) {
  const psi = Math.abs(Math.atan2(d.x, d.z));
  const k = [[0, 0.74], [0.5, 0.64], [0.95, 0.4], [1.3, 0.18], [1.62, 0.22], [2.1, -0.15], [2.6, -0.42], [Math.PI, -0.5]];
  for (let i = 1; i < k.length; i++) {
    if (psi <= k[i][0]) {
      const t = (psi - k[i - 1][0]) / (k[i][0] - k[i - 1][0]);
      return lerp(k[i - 1][1], k[i][1], t * t * (3 - 2 * t));
    }
  }
  return -0.5;
}
export function hairMask(d) {
  const yh = hairlineY(d) + fbm3(d.x * 9, d.y * 9, d.z * 9, 3, 2) * 0.03;
  return smoothstep(yh - 0.03, yh + 0.05, d.y);
}
function stubbleMask(d) {
  const { x, y, z } = d;
  const psi = Math.abs(Math.atan2(x, z));
  const beardLine = lerp(-0.42, -0.12, smoothstep(0.35, 1.3, psi));
  let m = smoothstep(beardLine + 0.04, beardLine - 0.14, y) * smoothstep(1.75, 1.3, psi) * smoothstep(-0.99, -0.88, y);
  m = Math.max(m, g2(x, y, 0, Y_M + 0.11, 0.3, 0.05) * front(z)); // moustache
  m = Math.max(m, smoothstep(1.2, 1.45, psi) * smoothstep(0.25, 0.05, y) * smoothstep(-0.5, -0.1, y)); // sideburn blend
  m *= 1 - g2(x, y, 0, Y_M, 0.3, 0.075) * 0.95; // not on lips
  m *= 1 - g2(x, y, 0, -0.22, 0.17, 0.12); // not nose
  m *= 1 - gSym(x, y, 0.48, -0.06, 0.15, 0.11) * 0.9; // not on cheekbones
  return clamp(m);
}
export function skinColorAt(d, out) {
  const { x, y, z } = d;
  const f = front(z);
  let r = 0.84, g = 0.62, b = 0.5;
  const n = fbm3(x * 14, y * 14, z * 14, 5, 3) * 0.035;
  r += n; g += n * 0.9; b += n * 0.8;
  const red = gSym(x, y, 0.5, -0.16, 0.2, 0.15) * 0.07 * f + g2(x, y, 0, -0.21, 0.1, 0.08) * 0.06 * f;
  r += red * 0.5; g -= red * 0.55; b -= red * 0.4;
  const ear = smoothstep(0.85, 0.98, Math.abs(x)) * 0.05;
  g -= ear; b -= ear * 0.6;
  // tired under-eyes
  const ue = gSym(x, y, 0.36, 0.035, 0.12, 0.045) * f;
  r -= ue * 0.07; g -= ue * 0.09; b -= ue * 0.04;
  // lips
  const lip = (g2(x, y, 0, Y_M + 0.045, 0.24, 0.035) + g2(x, y, 0, Y_M - 0.055, 0.2, 0.045)) * smoothstep(MOUTH_HALF + 0.02, MOUTH_HALF - 0.06, Math.abs(x)) * f;
  const lp = clamp(lip * 1.25);
  r = lerp(r, 0.72, lp); g = lerp(g, 0.42, lp); b = lerp(b, 0.38, lp);
  // eyebrow under-shading
  const brow = gSym(x, y, 0.3, 0.3, 0.17, 0.035) * f;
  r -= brow * 0.12; g -= brow * 0.12; b -= brow * 0.1;
  // stubble
  const sm = stubbleMask(d);
  const dots = noise3(x * 420, y * 420, z * 420, 7) * 0.5 + 0.5;
  const st = sm * (0.3 + 0.7 * smoothstep(0.5, 0.85, dots));
  r = lerp(r, 0.42, st * 0.42); g = lerp(g, 0.34, st * 0.42); b = lerp(b, 0.31, st * 0.42);
  // scalp under the hair is darkened by hair density
  const hm = hairMask(d);
  r = lerp(r, 0.2, hm * 0.85); g = lerp(g, 0.14, hm * 0.85); b = lerp(b, 0.1, hm * 0.85);
  out[0] = clamp(r); out[1] = clamp(g); out[2] = clamp(b);
  return out;
}
function roughAt(d) {
  const { x, y, z } = d;
  const f = front(z);
  let r = 0.56;
  r -= 0.12 * (g2(x, y, 0, 0.5, 0.25, 0.2) + g2(x, y, 0, -0.2, 0.1, 0.15)) * f; // T-zone sheen
  const lip = (g2(x, y, 0, Y_M + 0.045, 0.24, 0.035) + g2(x, y, 0, Y_M - 0.055, 0.2, 0.045)) * f;
  r = lerp(r, 0.32, clamp(lip * 1.2));
  r += stubbleMask(d) * 0.12;
  return clamp(r + fbm3(x * 30, y * 30, z * 30, 2, 2) * 0.04);
}

function paintSkin() {
  const W = 1536, H = 768;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const c2 = document.createElement('canvas'); c2.width = W / 2; c2.height = H / 2;
  const ctx = c.getContext('2d'), ctx2 = c2.getContext('2d');
  const img = ctx.createImageData(W, H), img2 = ctx2.createImageData(W / 2, H / 2);
  const col = [0, 0, 0];
  const d = V(0, 0, 0);
  for (let j = 0; j < H; j++) {
    const th = ((j + 0.5) / H) * Math.PI;
    for (let i = 0; i < W; i++) {
      const ph = ((i + 0.5) / W) * Math.PI * 2;
      d.set(Math.sin(th) * Math.sin(ph), Math.cos(th), -Math.sin(th) * Math.cos(ph));
      skinColorAt(d, col);
      const k = (j * W + i) * 4;
      img.data[k] = col[0] * 255; img.data[k + 1] = col[1] * 255; img.data[k + 2] = col[2] * 255; img.data[k + 3] = 255;
      if (!(i & 1) && !(j & 1)) {
        const r = roughAt(d) * 255;
        const k2 = ((j >> 1) * (W >> 1) + (i >> 1)) * 4;
        img2.data[k2] = img2.data[k2 + 1] = img2.data[k2 + 2] = r; img2.data[k2 + 3] = 255;
      }
    }
  }
  ctx.putImageData(img, 0, 0); ctx2.putImageData(img2, 0, 0);
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
  const rough = new THREE.CanvasTexture(c2); rough.colorSpace = THREE.NoColorSpace;
  return { map, rough };
}

// ---------- head mesh ----------
function rowAngles() {
  const dens = (t) => 1 + 2.6 * Math.exp(-(((t - THETA_M) / (9 * DEG)) ** 2)) + 1.3 * Math.exp(-(((t - 82 * DEG) / (12 * DEG)) ** 2)) + 0.9 * Math.exp(-(((t - 100 * DEG) / (8 * DEG)) ** 2));
  const N = 4000, cum = [0];
  for (let i = 1; i <= N; i++) cum.push(cum[i - 1] + dens((i / N) * Math.PI));
  const tot = cum[N];
  const out = [];
  let k = 0;
  for (let r = 0; r <= ROWS; r++) {
    const target = (r / ROWS) * tot;
    while (k < N && cum[k] < target) k++;
    out.push((k / N) * Math.PI);
  }
  let best = 0;
  for (let r = 0; r <= ROWS; r++) if (Math.abs(out[r] - THETA_M) < Math.abs(out[best] - THETA_M)) best = r;
  out[best] = THETA_M;
  return { th: out, rowM: best };
}
function colAngles() {
  const dens = (p) => 1 + 1.6 * Math.exp(-(((p - Math.PI) / 0.62) ** 2));
  const N = 4000, cum = [0];
  for (let i = 1; i <= N; i++) cum.push(cum[i - 1] + dens((i / N) * Math.PI * 2));
  const tot = cum[N];
  const out = [];
  let k = 0;
  for (let c = 0; c <= COLS; c++) {
    const target = (c / COLS) * tot;
    while (k < N && cum[k] < target) k++;
    out.push((k / N) * Math.PI * 2);
  }
  out[COLS] = Math.PI * 2;
  return out;
}

export function buildHead({ skinMat, earMat, irisColor = 0x4a2f19 }) {
  const group = new THREE.Group();
  group.name = 'headRig';
  const { th, rowM } = rowAngles();
  const ph = colAngles();
  const dirs = [], pos = [], uv = [], isLower = [], rowsBelow = [];
  const vid = []; // vid[r][c]
  const dir = (t, p) => V(Math.sin(t) * Math.sin(p), Math.cos(t), -Math.sin(t) * Math.cos(p));
  for (let r = 0; r <= ROWS; r++) {
    vid.push([]);
    for (let c = 0; c <= COLS; c++) {
      const d = dir(th[r], ph[c]);
      dirs.push(d); pos.push(surfacePoint(d));
      uv.push(ph[c] / (Math.PI * 2), 1 - th[r] / Math.PI);
      isLower.push(r > rowM); rowsBelow.push(Math.max(0, r - rowM));
      vid[r].push(dirs.length - 1);
    }
  }
  // mouth split: duplicate interior vertices of the mouth row for the lower lip
  const lowerDup = {};
  const mouthCols = [];
  for (let c = 0; c <= COLS; c++) {
    const d = dirs[vid[rowM][c]];
    if (d.z > 0 && Math.abs(d.x) < MOUTH_HALF) mouthCols.push(c);
  }
  const c0 = mouthCols[0], c1 = mouthCols[mouthCols.length - 1];
  for (let c = c0 + 1; c < c1; c++) {
    const i = vid[rowM][c];
    dirs.push(dirs[i]); pos.push(pos[i].clone()); uv.push(uv[i * 2], uv[i * 2 + 1]);
    isLower.push(true); rowsBelow.push(0);
    lowerDup[c] = dirs.length - 1;
  }
  const idx = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      let a = vid[r][c], b = vid[r][c + 1], cc = vid[r + 1][c], dd = vid[r + 1][c + 1];
      if (r === rowM) {
        if (lowerDup[c] !== undefined) a = lowerDup[c];
        if (lowerDup[c + 1] !== undefined) b = lowerDup[c + 1];
      }
      idx.push(a, b, cc, b, dd, cc);
    }
  }

  // eye sockets: find eye centres from the sculpted surface
  const eyeR = 0.0127;
  const eyes = {};
  for (const s of [1, -1]) {
    const d = dirFromFront(0.36 * s, 0.135);
    const p = surfacePoint(d);
    const n = new THREE.Vector3();
    {
      const e = 0.01;
      const px = surfacePoint(dirFromFront(0.36 * s + e, 0.135)), py = surfacePoint(dirFromFront(0.36 * s, 0.135 + e));
      n.crossVectors(px.sub(p), py.sub(p)).normalize();
      if (n.z < 0) n.negate();
    }
    const fwd = V(s * 0.05, 0.0, 1).normalize();
    const center = p.clone().addScaledVector(fwd, -0.0112);
    eyes[s > 0 ? 'L' : 'R'] = { center, fwd, s };
  }
  // carve sockets: inside the (widest) lid opening the skin is pushed
  // behind the eyeball; around it the skin sinks just under the lid shells,
  // whose outer rim is glued to the face surface (no seams).
  for (const e of Object.values(eyes)) e.rFace = (w) => faceRadius(e.center, w);
  for (let i = 0; i < pos.length; i++) {
    for (const e of Object.values(eyes)) {
      const q = pos[i].clone().sub(e.center);
      const len = q.length();
      if (len > eyeR * 2.4 || q.z < 0) continue;
      const dn = q.clone().normalize();
      const h = (e.s * Math.atan2(dn.x, dn.z)) / LID.span;
      const v = Math.asin(clamp(dn.y, -1, 1));
      const { up, low } = lidWindow(h);
      const inWin = Math.abs(h) < 1.04 && v < up + 3 * DEG && v > low - 3 * DEG && len < eyeR * 1.5;
      if (inWin) { pos[i].copy(e.center).addScaledVector(dn, eyeR * 0.9); continue; }
      const blend = lidBlend(h, v) * smoothstep(eyeR * 1.6, eyeR * 1.2, len) * smoothstep(-1.08, -0.9, h);
      if (blend <= 0) continue;
      const r0 = eyeR * (v > lidRestCentre(h) ? 1.095 : 1.08);
      const r = Math.min(len, lerp(len, r0, blend) - 0.0005 * blend);
      pos[i].copy(e.center).addScaledVector(dn, r);
    }
  }

  const geo = new THREE.BufferGeometry();
  const posArr = new Float32Array(pos.length * 3);
  pos.forEach((p, i) => p.toArray(posArr, i * 3));
  geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  smoothCoincidentNormalsExceptMouth(geo, lowerDup, vid[rowM]);
  const baseN = geo.attributes.normal.array.slice();

  // morph targets (relative deltas incl. normals)
  geo.morphAttributes.position = [];
  geo.morphAttributes.normal = [];
  const tmp = new THREE.BufferGeometry();
  tmp.setIndex(idx);
  const morphDeltas = {};
  for (const name of MORPHS) {
    const dp = new Float32Array(pos.length * 3);
    const mp = new Float32Array(pos.length * 3);
    for (let i = 0; i < pos.length; i++) {
      const dl = morphDelta(name, dirs[i], pos[i], isLower[i], rowsBelow[i]);
      dp[i * 3] = dl.x; dp[i * 3 + 1] = dl.y; dp[i * 3 + 2] = dl.z;
      mp[i * 3] = posArr[i * 3] + dl.x; mp[i * 3 + 1] = posArr[i * 3 + 1] + dl.y; mp[i * 3 + 2] = posArr[i * 3 + 2] + dl.z;
    }
    tmp.setAttribute('position', new THREE.BufferAttribute(mp, 3));
    tmp.computeVertexNormals();
    smoothCoincidentNormalsExceptMouth(tmp, lowerDup, vid[rowM]);
    const dn = new Float32Array(pos.length * 3);
    const tn = tmp.attributes.normal.array;
    for (let k = 0; k < dn.length; k++) dn[k] = tn[k] - baseN[k];
    const pa = new THREE.BufferAttribute(dp, 3); pa.name = name;
    geo.morphAttributes.position.push(pa);
    geo.morphAttributes.normal.push(new THREE.BufferAttribute(dn, 3));
    morphDeltas[name] = dp;
  }
  geo.morphTargetsRelative = true;

  const paint = paintSkin();
  const headMat = skinMat.clone();
  headMat.map = paint.map;
  headMat.roughnessMap = paint.rough;
  headMat.roughness = 1;
  headMat.onBeforeCompile = skinMat.onBeforeCompile;
  headMat.customProgramCacheKey = skinMat.customProgramCacheKey;
  const detail = skinMat.bumpMap.clone(); detail.repeat.set(10, 5); detail.needsUpdate = true;
  headMat.bumpMap = detail; headMat.bumpScale = 0.55;
  const head = new THREE.Mesh(geo, headMat);
  head.name = 'head';
  head.castShadow = head.receiveShadow = true;
  head.morphTargetDictionary = Object.fromEntries(MORPHS.map((n, i) => [n, i]));
  head.morphTargetInfluences = MORPHS.map(() => 0);
  group.add(head);

  // ---------- mouth interior ----------
  const mouthP = surfacePoint(dirFromFront(0, Y_M));
  const jaw = new THREE.Group(); jaw.name = 'jaw';
  const jawPivot = V(0, 0.058, -0.012);
  jaw.position.copy(jawPivot);
  group.add(jaw);
  const bag = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16),
    new THREE.MeshStandardMaterial({ color: 0x2a0d0b, roughness: 0.75, side: THREE.BackSide }));
  bag.scale.set(0.028, 0.022, 0.03);
  bag.position.set(0, mouthP.y - 0.006, mouthP.z - 0.027);
  group.add(bag);
  const teethMat = new THREE.MeshPhysicalMaterial({ color: 0xe9e1d2, roughness: 0.32, clearcoat: 0.5, clearcoatRoughness: 0.2, side: THREE.DoubleSide });
  const teeth = (upper) => {
    const geoT = new THREE.BufferGeometry();
    const vs = [], ids = [];
    const segs = 22, h = 0.0085, t = 0.0035;
    for (let i = 0; i <= segs; i++) {
      const a = lerp(-1.25, 1.25, i / segs);
      const rx = 0.0205, rz = 0.017;
      const cx = Math.sin(a) * rx, cz = Math.cos(a) * rz;
      const nx = Math.sin(a) / rx, nz = Math.cos(a) / rz;
      const nl = Math.hypot(nx, nz);
      // slight scallop per tooth
      const tooth = Math.abs(Math.sin(i * 1.5)) * 0.0006;
      const y0 = upper ? -h + tooth : h - tooth, y1 = 0;
      for (const yy of [y0, y1]) for (const off of [0, -t]) vs.push(cx + (nx / nl) * off, yy, cz + (nz / nl) * off);
    }
    for (let i = 0; i < segs; i++) {
      const b = i * 4, n = b + 4;
      // front face, back face, edge
      ids.push(b, n, b + 2, n, n + 2, b + 2);
      ids.push(b + 1, b + 3, n + 1, n + 1, b + 3, n + 3);
      ids.push(b, b + 1, n, n, b + 1, n + 1);
    }
    geoT.setAttribute('position', new THREE.Float32BufferAttribute(vs, 3));
    geoT.setIndex(upper ? ids : ids.map((x, k) => ids[k - (k % 3) + (2 - (k % 3))]));
    geoT.computeVertexNormals();
    const m = new THREE.Mesh(geoT, teethMat);
    m.material = teethMat;
    return m;
  };
  const upperTeeth = teeth(true);
  upperTeeth.position.set(0, mouthP.y + 0.0042, mouthP.z - 0.0255);
  group.add(upperTeeth);
  const lowerTeeth = teeth(false);
  lowerTeeth.position.set(0, mouthP.y - 0.0052, mouthP.z - 0.0275).sub(jawPivot);
  jaw.add(lowerTeeth);
  const tongue = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), new THREE.MeshPhysicalMaterial({ color: 0xa8484a, roughness: 0.38, clearcoat: 0.4 }));
  tongue.scale.set(0.017, 0.0065, 0.024);
  tongue.position.set(0, mouthP.y - 0.0115, mouthP.z - 0.038).sub(jawPivot);
  jaw.add(tongue);

  // ---------- eyes ----------
  const eyeMat = new THREE.MeshPhysicalMaterial({ map: eyeTexture(irisColor), roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.03 });
  const corneaMat = M.cornea();
  const eyeGeo = new THREE.SphereGeometry(eyeR, 40, 28); eyeGeo.rotateX(Math.PI / 2);
  const corneaGeo = new THREE.SphereGeometry(eyeR * 1.03, 40, 28, 0, Math.PI * 2, 0, Math.PI * 0.32); corneaGeo.rotateX(Math.PI / 2);
  const lidSrgb = [0, 0, 0];
  skinColorAt(dirFromFront(0.36, 0.2), lidSrgb);
  const lc = new THREE.Color().setRGB(lidSrgb[0], lidSrgb[1], lidSrgb[2], THREE.SRGBColorSpace);
  const lidColor = [lc.r, lc.g, lc.b];
  const lidMat = skinMat.clone();
  lidMat.onBeforeCompile = skinMat.onBeforeCompile;
  lidMat.customProgramCacheKey = skinMat.customProgramCacheKey;
  lidMat.vertexColors = true;
  lidMat.side = THREE.DoubleSide;
  lidMat.color = new THREE.Color(1, 1, 1);
  const lashMat = new THREE.MeshStandardMaterial({ color: 0x1c130d, roughness: 0.6, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
  for (const [key, e] of Object.entries(eyes)) {
    const pivot = new THREE.Group(); pivot.position.copy(e.center);
    group.add(pivot);
    const ball = new THREE.Mesh(eyeGeo, eyeMat); ball.castShadow = false; ball.receiveShadow = true;
    const corn = new THREE.Mesh(corneaGeo, corneaMat);
    // eyeball orientation: slightly diverged rest gaze
    const look = new THREE.Group();
    look.add(ball, corn);
    pivot.add(look);
    const lidsUpper = makeLid(e.s, true, eyeR, [...lidColor], e);
    const lidsLower = makeLid(e.s, false, eyeR, [...lidColor], e);
    const up = new THREE.Mesh(lidsUpper.lid, lidMat); up.castShadow = true; up.receiveShadow = true;
    const lo = new THREE.Mesh(lidsLower.lid, lidMat); lo.receiveShadow = true;
    const lashes = new THREE.Mesh(lidsUpper.lash, lashMat);
    const lashesLo = new THREE.Mesh(lidsLower.lash, lashMat);
    for (const m of [up, lo, lashes, lashesLo]) { m.morphTargetInfluences = [0, 0]; pivot.add(m); }
    e.pivot = pivot; e.look = look; e.up = up; e.lo = lo; e.lash = lashes; e.lashLo = lashesLo;
  }

  // ---------- ears ----------
  const earGeo = makeEar();
  for (const s of [1, -1]) {
    const ear = new THREE.Mesh(earGeo, earMat || skinMat);
    const p = surfacePoint(V(s * 0.985, 0.05, -0.1).normalize());
    ear.position.copy(p).add(V(-s * 0.004, 0, 0));
    ear.scale.set(s, 1, 1);
    ear.rotation.set(-0.12, s * -0.32, s * 0.08);
    ear.castShadow = ear.receiveShadow = true;
    group.add(ear);
  }

  // ---------- eyebrows (3D strands following the head morphs) ----------
  const brows = makeBrows(pos, morphDeltas);
  group.add(brows);

  return { group, head, jaw, eyes, brows, eyeR, rowM, dirs, pos, mouthP };
}

function smoothCoincidentNormalsExceptMouth(geo) {
  // the mouth duplicates are coincident with the upper lip edge in the rest
  // pose; averaging them is fine (lips touch) and avoids a crease line.
  smoothCoincidentNormals(geo);
}

const LID = { innerC: -2 * DEG, outerC: 4 * DEG, lowOpen: 17 * DEG, span: 64 * DEG, upOpen: 37 * DEG };
function lidCos(h) { return Math.max(0, Math.cos((Math.min(1, Math.abs(h)) * Math.PI) / 2)); }
function lidWindow(h) {
  const vc = lerp(LID.innerC, LID.outerC, clamp((h + 1) / 2));
  return { up: vc + (LID.upOpen + 9 * DEG) * Math.pow(lidCos(h), 0.65), low: vc - LID.lowOpen * 1.45 * lidCos(h) };
}
const LID_FAR_UP = 54 * DEG, LID_FAR_LO = -40 * DEG, LID_HS = 1.32, LID_HS_IN = 1.1;
const hsLim = (h) => (h < 0 ? LID_HS_IN : LID_HS);
function lidRestCentre(h) { return lerp(LID.innerC, LID.outerC, clamp((h + 1) / 2)); }
function lidEdgeRest(h, upper) {
  const vc = lidRestCentre(h);
  return upper ? vc + LID.upOpen * Math.pow(lidCos(h), 0.7) : vc - LID.lowOpen * lidCos(h);
}
// how much of the lid shell (vs face surface) defines the radius at (h, v)
function lidBlend(h, v) {
  if (Math.abs(h) > hsLim(h)) return 0;
  const upper = v > lidRestCentre(h);
  const far = upper ? LID_FAR_UP : LID_FAR_LO;
  const edge = lidEdgeRest(h, upper);
  let t = upper ? (far - v) / (far - edge) : (v - far) / (edge - far);
  if (t <= 0) return 0;
  t = Math.pow(clamp(t), 1 / 0.85);
  return Math.min(smoothstep(0.0, 0.5, t), smoothstep(hsLim(h), 1.0, Math.abs(h)));
}
// distance from an eye centre to the (uncarved) face surface along w
function faceRadius(E, w) {
  let lo = 0, hi = 0.06;
  const P = new THREE.Vector3();
  for (let k = 0; k < 22; k++) {
    const r = (lo + hi) / 2;
    P.copy(E).addScaledVector(w, r);
    const q = P.clone().sub(C);
    const d = V(q.x / HW, q.y / HH, q.z / HD).normalize();
    const S = surfacePoint(d).sub(C);
    if (q.length() < S.length()) lo = r; else hi = r;
  }
  return (lo + hi) / 2;
}

// Eyelid shell with closed/wide morphs (upper) or raise/drop morphs (lower)
function makeLid(s, upper, eyeR, colour, eye) {
  const H = 26, Tn = 16;
  const vc = (h) => lerp(LID.innerC, LID.outerC, clamp((h + 1) / 2));
  const cosH = (h) => Math.pow(Math.max(0, Math.cos((Math.min(1, Math.abs(h)) * Math.PI) / 2)), 1);
  const lowOpen = LID.lowOpen;
  const edges = upper
    ? [(h) => vc(h) + LID.upOpen * Math.pow(cosH(h), 0.7), (h) => vc(h) - lowOpen * cosH(h) * 0.55 + 0.6 * DEG, (h) => vc(h) + (LID.upOpen + 9 * DEG) * Math.pow(cosH(h), 0.65)]
    : [(h) => vc(h) - lowOpen * cosH(h), (h) => vc(h) - 4 * DEG * cosH(h), (h) => vc(h) - lowOpen * 1.45 * cosH(h)];
  const far = upper ? LID_FAR_UP : LID_FAR_LO;
  const r0 = eyeR * (upper ? 1.095 : 1.08);
  const point = (h, t, edgeFn, out) => {
    const ha = s * h * LID.span;
    const ve = edgeFn(h);
    let v = lerp(far, ve, Math.pow(t, 0.85));
    const w = V(Math.cos(v) * Math.sin(ha), Math.sin(v), Math.cos(v) * Math.cos(ha));
    const rf = Math.min(eye.rFace(w), eyeR * 1.4);
    let r = lerp(rf, r0, Math.min(smoothstep(0.0, 0.5, t), smoothstep(hsLim(h), 1.0, Math.abs(h))));
    if (upper) r += 0.0011 * Math.exp(-(((t - 0.5) / 0.15) ** 2)) * cosH(h);
    if (t > 0.82) {
      const m = (t - 0.82) / 0.18;
      r = lerp(r, eyeR * 1.012, smoothstep(0, 1, m));
      v += (upper ? -1 : 1) * 1.2 * DEG * m;
    }
    out.set(r * Math.cos(v) * Math.sin(ha), r * Math.sin(v), r * Math.cos(v) * Math.cos(ha));
    return out;
  };
  const build = (fnArr, lash) => {
    const pos = [[], [], []];
    const col = [];
    const idx = [];
    const p = V(0, 0, 0);
    const hs = LID_HS;
    if (!lash) {
      for (let i = 0; i <= H; i++) {
        const h = lerp(-LID_HS_IN, hs, i / H);
        for (let j = 0; j <= Tn; j++) {
          const t = j / Tn;
          for (let k = 0; k < 3; k++) { point(h, t, fnArr[k], p); pos[k].push(p.x, p.y, p.z); }
          point(h, t, fnArr[0], p);
          const dd = p.clone().add(eye.center).sub(C);
          skinColorAt(V(dd.x / HW, dd.y / HH, dd.z / HD).normalize(), colour);
          const lin = new THREE.Color().setRGB(colour[0], colour[1], colour[2], THREE.SRGBColorSpace);
          colour = [lin.r, lin.g, lin.b];
          const margin = smoothstep(0.85, 1, t);
          const crease = upper ? Math.exp(-(((t - 0.45) / 0.12) ** 2)) * 0.12 : 0;
          col.push(clamp(colour[0] * (1 - crease) - margin * 0.02), clamp(colour[1] * (1 - crease * 1.1) - margin * 0.12), clamp(colour[2] * (1 - crease) - margin * 0.08));
        }
      }
      for (let i = 0; i < H; i++) for (let j = 0; j < Tn; j++) {
        const a = i * (Tn + 1) + j, b = a + Tn + 1;
        if ((s > 0) === upper) idx.push(a, b, a + 1, b, b + 1, a + 1); else idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
    } else {
      // lash ribbons from the lid edge, curling outward
      const N = 34;
      for (let i = 0; i <= N; i++) {
        const h = lerp(-0.92, 0.98, i / N);
        const len = (upper ? 0.0056 : 0.0025) * (0.55 + 0.45 * Math.sin(((h + 1) / 2) * Math.PI * 0.9 + 0.25));
        for (let k = 0; k < 3; k++) {
          const e0 = point(h, 1, fnArr[k], V(0, 0, 0));
          const e1 = point(h, 0.93, fnArr[k], V(0, 0, 0));
          const out = e0.clone().normalize();
          const upv = e0.clone().sub(e1).normalize();
          const tip = e0.clone().addScaledVector(out, len * 0.7).addScaledVector(upv, len * 0.75);
          const side = V(Math.cos(s * h), 0, -Math.sin(s * h)).multiplyScalar(0.00035);
          pos[k].push(e0.x - side.x, e0.y, e0.z - side.z, e0.x + side.x, e0.y, e0.z + side.z, tip.x, tip.y, tip.z);
        }
        col.push(0, 0, 0, 0, 0, 0, 0, 0, 0);
        if (i < N) {
          const a = i * 3;
          idx.push(a, a + 1, a + 2, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos[0], 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const base = g.attributes.normal.array.slice();
    g.morphAttributes.position = [];
    g.morphAttributes.normal = [];
    for (let k = 1; k < 3; k++) {
      const d = new Float32Array(pos[0].length);
      for (let q = 0; q < d.length; q++) d[q] = pos[k][q] - pos[0][q];
      const tg = new THREE.BufferGeometry(); tg.setIndex(idx);
      tg.setAttribute('position', new THREE.Float32BufferAttribute(pos[k], 3));
      tg.computeVertexNormals();
      const dn = new Float32Array(d.length);
      for (let q = 0; q < d.length; q++) dn[q] = tg.attributes.normal.array[q] - base[q];
      g.morphAttributes.position.push(new THREE.BufferAttribute(d, 3));
      g.morphAttributes.normal.push(new THREE.BufferAttribute(dn, 3));
    }
    g.morphTargetsRelative = true;
    return g;
  };
  return { lid: build(edges, false), lash: build(edges, true) };
}

function makeEar() {
  const g = new THREE.SphereGeometry(1, 28, 20);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const r = Math.hypot(y / 1.0, z / 0.62);
    // outer face is +x: concha bowl + raised helix rim
    if (x > 0) x = x * 0.55 - 0.42 * smoothstep(0.75, 0.15, r) + 0.15 * Math.exp(-(((r - 0.85) / 0.12) ** 2));
    else x *= 0.35;
    p.setXYZ(i, x * 0.0075, y * 0.031 + (y < 0 ? y * 0.004 : 0), z * 0.019 - (y > 0 ? 0 : y * 0.003));
  }
  g.computeVertexNormals();
  return g;
}

function makeBrows(headPos, morphDeltas) {
  const R = rng(77);
  const verts = [], ids = [], uvs = [];
  const anchor = [];
  for (const s of [1, -1]) {
    const N = 30;
    for (let i = 0; i < N; i++) {
      const t = (i + R() * 0.6) / N;
      const x = lerp(0.12, 0.55, t);
      const yArch = 0.282 + 0.034 * Math.sin(Math.min(1, t * 1.25) * Math.PI) - 0.02 * t + (R() - 0.5) * 0.018;
      const at = (xx, yy) => surfacePoint(dirFromFront(xx * s, yy));
      const p = at(x, yArch);
      const e = 0.004;
      const px = at(x + e, yArch).sub(p), py = at(x, yArch + e).sub(p);
      const n = new THREE.Vector3().crossVectors(px, py).normalize();
      if (n.z < 0) n.negate();
      const dirAng = lerp(70, 8, smoothstep(0, 0.55, t)) * DEG + (R() - 0.5) * 0.3;
      const tx = px.clone().normalize().multiplyScalar(s), ty = py.clone().normalize();
      const sd = tx.clone().multiplyScalar(Math.cos(dirAng)).addScaledVector(ty, Math.sin(dirAng)).normalize();
      const len = lerp(0.008, 0.011, R()) * (1 - t * 0.3);
      const wid = lerp(0.0035, 0.0048, R()) * (1 - t * 0.35);
      const side = new THREE.Vector3().crossVectors(n, sd).normalize();
      const b = verts.length / 3;
      for (let k = 0; k <= 3; k++) {
        const f = k / 3;
        const c = p.clone().addScaledVector(sd, len * (f - 0.25)).addScaledVector(n, 0.0004 + 0.0006 * Math.sin(f * Math.PI));
        for (let j = 0; j < 2; j++) {
          const q = c.clone().addScaledVector(side, (j - 0.5) * wid);
          verts.push(q.x, q.y, q.z);
          uvs.push(j, f);
          anchor.push(p);
        }
      }
      for (let k = 0; k < 3; k++) { const a = b + k * 2; ids.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(ids);
  g.computeVertexNormals();
  // nearest head vertex for each brow vertex -> transfer morph deltas
  const nearest = anchor.map((a) => {
    let best = 0, bd = 1e9;
    for (let i = 0; i < headPos.length; i++) {
      const dd = headPos[i].distanceToSquared(a);
      if (dd < bd) { bd = dd; best = i; }
    }
    return best;
  });
  g.morphAttributes.position = MORPHS.map((name) => {
    const src = morphDeltas[name];
    const d = new Float32Array(verts.length);
    nearest.forEach((hi, k) => { d[k * 3] = src[hi * 3]; d[k * 3 + 1] = src[hi * 3 + 1]; d[k * 3 + 2] = src[hi * 3 + 2]; });
    return new THREE.BufferAttribute(d, 3);
  });
  g.morphTargetsRelative = true;
  const m = new THREE.Mesh(g, new THREE.MeshPhysicalMaterial({ color: 0x9a8070, map: hairCard(), alphaHash: true, roughness: 0.55, sheen: 0.3, sheenColor: new THREE.Color(0x4a3426), side: THREE.DoubleSide }));
  m.morphTargetInfluences = MORPHS.map(() => 0);
  m.name = 'brows';
  m.castShadow = false;
  return m;
}
