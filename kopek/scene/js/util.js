import * as THREE from 'three';

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const remap = (t, a, b) => clamp((t - a) / (b - a));
export const smooth = (t) => t * t * (3 - 2 * t);
export const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10);
export const ss = (a, b, t) => smooth(remap(t, a, b));
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);
export const easeIn = (t) => t * t * t;
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
// Pulse that rises over [a, a+r], holds, falls over [b-r, b]
export const window01 = (t, a, b, r = 0.4) => ss(a, a + r, t) * (1 - ss(b - r, b, t));

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export function lerpV(a, b, t, out = new THREE.Vector3()) {
  return out.copy(a).lerp(b, t);
}

// Smoothly-damped angle interpolation (shortest path)
export function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % (2 * Math.PI)) - Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return a + d * t;
}

export function canvasTexture(w, h, draw, opts = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = opts.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  if (opts.repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(opts.repeat[0], opts.repeat[1]);
  }
  return tex;
}

export function softDotTexture() {
  return canvasTexture(64, 64, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  });
}

// Path helper: CatmullRom through points, sampled by arc length with an easing function on time
export class TimedPath {
  constructor(points, t0, t1, ease = smooth, tension = 0.5) {
    this.curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', tension);
    this.t0 = t0;
    this.t1 = t1;
    this.ease = ease;
  }
  u(t) {
    return this.ease(remap(t, this.t0, this.t1));
  }
  at(t, out = new THREE.Vector3()) {
    return this.curve.getPointAt(clamp(this.u(t)), out);
  }
}

// Build an orientation quaternion from a forward vector and an up hint (object forward = +Z, up = +Y)
const _m = new THREE.Matrix4();
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();
export function quatFromForwardUp(forward, upHint, out = new THREE.Quaternion()) {
  _z.copy(forward).normalize();
  _x.crossVectors(upHint, _z);
  if (_x.lengthSq() < 1e-8) _x.set(1, 0, 0);
  _x.normalize();
  _y.crossVectors(_z, _x).normalize();
  _m.makeBasis(_x, _y, _z);
  return out.setFromRotationMatrix(_m);
}
