// Small deterministic math/animation helpers shared by every module.
// Everything that animates is a pure function of time so any frame can be
// rendered in any order (required for sub-frame motion blur and parallel renders).

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, x) => clamp((x - a) / (b - a));
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const smootherstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * t * (t * (t * 6 - 15) + 10);
};
export const DEG = Math.PI / 180;

export const ease = {
  linear: (t) => t,
  in: (t) => t * t * t,
  out: (t) => 1 - Math.pow(1 - t, 3),
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  outSine: (t) => Math.sin((t * Math.PI) / 2),
  inSine: (t) => 1 - Math.cos((t * Math.PI) / 2),
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  outBack: (t) => {
    const c1 = 1.4, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  inBack: (t) => {
    const c1 = 1.4, c3 = c1 + 1;
    return c3 * t * t * t - c1 * t * t;
  },
  // slow start, fast middle, soft settle with a small overshoot - "weighty" human moves
  heavy: (t) => {
    const s = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    return s + Math.sin(t * Math.PI) * 0.04 * t;
  },
  step: (t) => (t < 1 ? 0 : 1),
};

// Seeded PRNG (mulberry32)
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth 1D value noise in [-1,1]
function hash1(i, seed) {
  let h = (i * 374761393 + seed * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
export function noise1(x, seed = 0) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(hash1(i, seed), hash1(i + 1, seed), u) * 2 - 1;
}
export function fbm1(x, seed = 0, oct = 3) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let o = 0; o < oct; o++) {
    s += a * noise1(x * f, seed + o * 17);
    n += a;
    a *= 0.5;
    f *= 2.03;
  }
  return s / n;
}

// 2D/3D value noise for procedural textures and sculpting
function hash3(x, y, z, seed) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647 + seed * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
export function noise3(x, y, z, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz, seed);
  const x00 = lerp(c(0, 0, 0), c(1, 0, 0), u), x10 = lerp(c(0, 1, 0), c(1, 1, 0), u);
  const x01 = lerp(c(0, 0, 1), c(1, 0, 1), u), x11 = lerp(c(0, 1, 1), c(1, 1, 1), u);
  return lerp(lerp(x00, x10, v), lerp(x01, x11, v), w) * 2 - 1;
}
export function fbm3(x, y, z, seed = 0, oct = 4) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let o = 0; o < oct; o++) {
    s += a * noise3(x * f, y * f, z * f, seed + o * 31);
    n += a;
    a *= 0.5;
    f *= 2.07;
  }
  return s / n;
}
// Tileable 2D noise on a torus mapping (for seamless textures)
export function tileNoise(u, v, freq, seed = 0, oct = 4) {
  const a = u * Math.PI * 2, b = v * Math.PI * 2;
  const r = freq / (Math.PI * 2);
  let s = 0, amp = 0.5, n = 0, f = 1;
  for (let o = 0; o < oct; o++) {
    s += amp * noise3(Math.cos(a) * r * f + 7, Math.sin(a) * r * f + 3, Math.cos(b) * r * f + Math.sin(b) * r * f * 0.7 + o * 13, seed + o);
    n += amp;
    amp *= 0.5;
    f *= 2;
  }
  return s / n;
}

// Keyframe track. keys: [[time, value, easeName?], ...]. The ease of a key
// shapes the segment arriving at that key. Values: number or number[].
export class Track {
  constructor(keys, fallback = 0) {
    this.keys = keys.slice().sort((a, b) => a[0] - b[0]);
    this.fallback = fallback;
  }
  at(t) {
    const k = this.keys;
    if (!k.length) return this.fallback;
    if (t <= k[0][0]) return k[0][1];
    if (t >= k[k.length - 1][0]) return k[k.length - 1][1];
    let i = 1;
    while (k[i][0] < t) i++;
    const a = k[i - 1], b = k[i];
    const e = ease[b[2] || 'inOut'] || ease.inOut;
    const u = e((t - a[0]) / (b[0] - a[0]));
    if (Array.isArray(a[1])) return a[1].map((v, j) => lerp(v, b[1][j], u));
    return lerp(a[1], b[1], u);
  }
}
export const track = (keys, fallback) => new Track(keys, fallback);

// Pulse envelope: attack/hold/release around a time window
export function envelope(t, start, attack, hold, release) {
  if (t < start) return 0;
  if (t < start + attack) return ease.outSine((t - start) / attack);
  if (t < start + attack + hold) return 1;
  if (t < start + attack + hold + release) return 1 - ease.inOutSine((t - start - attack - hold) / release);
  return 0;
}
