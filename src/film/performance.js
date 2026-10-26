// Performance authoring tools: blended pose keys, goal tracks for hands
// (expressed as world matrices of the hand or of a held object), a
// procedural walk with planted feet, breathing, blinks and saccades.
import * as THREE from 'three';
import { clamp, lerp, ease, rng, noise1, smoothstep } from '../core/util.js';

const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
export function mat(pos, quat) {
  return new THREE.Matrix4().compose(pos, quat || new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
}
export function basisMat(pos, x, y) {
  const X = x.clone().normalize();
  const Y = y.clone().addScaledVector(X, -y.dot(X)).normalize();
  const Z = new THREE.Vector3().crossVectors(X, Y);
  const m = new THREE.Matrix4().makeBasis(X, Y, Z);
  m.setPosition(pos);
  return m;
}
export function lerpMat(a, b, w) {
  const pa = new THREE.Vector3(), qa = new THREE.Quaternion(), pb = new THREE.Vector3(), qb = new THREE.Quaternion();
  a.decompose(pa, qa, _s); b.decompose(pb, qb, _s);
  return mat(pa.lerp(pb, w), qa.slerp(qb, w));
}
export function lookMat(pos, target, up = new THREE.Vector3(0, 1, 0)) {
  // object whose +Z faces the target, +Y close to up
  const z = target.clone().sub(pos).normalize();
  const x = new THREE.Vector3().crossVectors(up, z).normalize();
  const y = new THREE.Vector3().crossVectors(z, x);
  const m = new THREE.Matrix4().makeBasis(x, y, z);
  m.setPosition(pos);
  return m;
}

// generic blend of plain pose objects (numbers / arrays / nested objects)
export function blendObj(a, b, w) {
  if (a === undefined) return b;
  if (b === undefined) return a;
  if (typeof a === 'number') return lerp(a, b, w);
  if (Array.isArray(a)) return a.map((v, i) => lerp(v, b[i] ?? v, w));
  if (a && typeof a === 'object' && !(a instanceof THREE.Vector3)) {
    const o = {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) o[k] = blendObj(a[k], b[k], w);
    return o;
  }
  return w < 0.5 ? a : b;
}

// Keys: [t, value | (t) => value, duration, easeName]. Each key starts a
// transition at time t from the previous value toward its value.
export class BlendTrack {
  constructor(keys, blend = blendObj) {
    this.keys = keys.slice().sort((a, b) => a[0] - b[0]);
    this.blend = blend;
  }
  at(t, ctx) {
    const k = this.keys;
    if (!k.length) return undefined;
    const val = (key) => (typeof key[1] === 'function' ? key[1](t, ctx) : key[1]);
    let i = -1;
    for (let j = 0; j < k.length; j++) if (k[j][0] <= t) i = j;
    if (i <= 0) return val(k[0]);
    // last key whose transition has completed
    let m = 0;
    for (let j = 1; j <= i; j++) if (t >= k[j][0] + (k[j][2] ?? 0.4)) m = j;
    let cur = val(k[m]);
    for (let j = m + 1; j <= i; j++) {
      const dur = k[j][2] ?? 0.4;
      const w = dur <= 0 ? 1 : (ease[k[j][3] || 'inOut'] || ease.inOut)(clamp((t - k[j][0]) / dur));
      cur = this.blend(cur, val(k[j]), w);
    }
    return cur;
  }
}
export const matBlend = (a, b, w) => (a && b ? lerpMat(a, b, w) : b || a);

// ---------------- walking ----------------
// path: CatmullRom curve of [x,z]; returns base pose + world feet
export function makeWalk({ t0, points, speed = 1.25, stepLen = 0.66, footSep = 0.1 }) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  const L = curve.getLength();
  const n = Math.max(2, Math.round(L / stepLen));
  const l = L / n;
  const ta = 0.5, td = 0.6;
  const T = L / speed + (ta + td) / 2;
  const plants = { R: [0], L: [0] };
  for (let k = 1; k <= n; k++) (k % 2 ? plants.R : plants.L).push(Math.min(L, k * l));
  for (const f of ['R', 'L']) if (plants[f][plants[f].length - 1] < L - 1e-4) plants[f].push(L);
  // trapezoid velocity profile: accelerate, cruise, decelerate
  const sAt = (t) => {
    const tau = clamp(t - t0, 0, T);
    if (tau < ta) return (speed * tau * tau) / (2 * ta);
    if (tau < T - td) return speed * (ta / 2 + (tau - ta));
    const r = T - tau;
    return L - (speed * r * r) / (2 * td);
  };
  const pt = (d) => curve.getPointAt(clamp(d / L));
  const tan = (d) => curve.getTangentAt(clamp(d / L, 0.001, 0.999));
  const footAt = (f, s) => {
    const side = f === 'L' ? 1 : -1;
    const P = plants[f];
    let k = 0;
    while (k < P.length - 1 && s >= P[k + 1] - (P[k + 1] - P[k]) * 0.2) k++;
    let d = P[k], lift = 0, pitch = 0;
    if (k < P.length - 1) {
      const lam = P[k + 1] - P[k];
      const a = P[k + 1] - lam * 0.65, b = P[k + 1] - lam * 0.2;
      if (s > a) {
        const u = clamp((s - a) / (b - a));
        const e = ease.inOutSine(u);
        d = lerp(P[k], P[k + 1], e);
        lift = Math.sin(u * Math.PI) * 0.075 * clamp(lam / l);
        pitch = Math.sin(u * Math.PI * 2) * -0.35 * clamp(lam / l);
      }
    }
    const p = pt(d), tg = tan(d);
    const nrm = new THREE.Vector3(tg.z, 0, -tg.x); // left normal for +Z facing
    return { pos: p.clone().addScaledVector(nrm, side * footSep).add(new THREE.Vector3(0, 0.085 + lift, 0)), yaw: Math.atan2(tg.x, tg.z), pitch };
  };
  return {
    t0, T, L, l, curve,
    end: t0 + T,
    at(t) {
      const s = sAt(t);
      const ds = (sAt(t + 0.02) - sAt(t - 0.02)) / 0.04;
      const spd = clamp(ds / speed);
      const p = pt(s), tg = tan(s);
      const yaw = Math.atan2(tg.x, tg.z);
      const phase = (s / l) * Math.PI;
      return {
        root: [p.x, 0, p.z], yaw, speed: spd, phase,
        feet: { L: footAt('L', s), R: footAt('R', s) },
        hips: [Math.sin(phase) * 0.012 * spd, -0.012 - 0.016 * spd * Math.abs(Math.cos(phase)) + 0.008 * spd, 0.0],
        hipsRot: [0.03 * spd, Math.sin(phase) * 0.09 * spd, Math.sin(phase) * 0.025 * spd],
        spine: [0.04 * spd, -Math.sin(phase) * 0.06 * spd, 0],
        chest: [0.02 * spd, -Math.sin(phase) * 0.05 * spd, 0],
        swing: Math.sin(phase) * spd,
      };
    },
    // events for audio: footstep plant times (approx)
    footsteps() {
      const out = [];
      for (const f of ['L', 'R']) for (let k = 1; k < plants[f].length; k++) {
        const lam = plants[f][k] - plants[f][k - 1];
        const target = plants[f][k] - lam * 0.2;
        // invert sAt numerically
        let lo = t0, hi = t0 + T;
        for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (sAt(m) < target) lo = m; else hi = m; }
        out.push({ t: (lo + hi) / 2, foot: f, strength: clamp(lam / l) });
      }
      return out.sort((a, b) => a.t - b.t);
    },
  };
}

// ---------------- autonomic behaviour ----------------
export function blinkSchedule(t0, t1, seed, extra = [], suppress = []) {
  const R = rng(seed);
  const out = [...extra];
  let t = t0 + R() * 1.5;
  while (t < t1) {
    if (!suppress.some(([a, b]) => t > a && t < b)) out.push(t);
    t += 1.8 + R() * 3.2;
    if (R() < 0.12) out.push(t - 0.45); // occasional double blink
  }
  return out.sort((a, b) => a - b);
}
// 0 = open, 1 = closed
export function blinkAt(t, times) {
  let c = 0;
  for (const b of times) {
    const d = t - b;
    if (d < -0.01 || d > 0.32) continue;
    if (d < 0.075) c = Math.max(c, ease.inQuad(clamp(d / 0.075)));
    else if (d < 0.12) c = 1;
    else c = Math.max(c, 1 - ease.outQuad(clamp((d - 0.12) / 0.2)));
  }
  return c;
}
// small fast eye jumps; reading = left-to-right sweeps with return
export function saccade(t, seed, mode = 'idle') {
  if (mode === 'reading') {
    const line = 0.9;
    const u = (t % line) / line;
    const row = Math.floor(t / line) % 3;
    const x = u < 0.85 ? lerp(-0.09, 0.09, Math.floor(u * 5) / 4) : lerp(0.09, -0.09, (u - 0.85) / 0.15);
    return [x, -0.03 + row * 0.03];
  }
  if (mode === 'darting') {
    const k = Math.floor(t * 3.2);
    const R = rng(seed + k * 13);
    return [(R() - 0.5) * 0.22, (R() - 0.5) * 0.1];
  }
  const k = Math.floor(t * 1.1 + noise1(t * 0.3, seed) * 0.5);
  const R = rng(seed + k * 7);
  return [(R() - 0.5) * 0.06, (R() - 0.5) * 0.035];
}
// breathing: integrate a time-varying rate deterministically
export function breathPhase(t, rateAt, t0 = 0) {
  let ph = 0;
  const dt = 1 / 30;
  for (let x = t0; x < t; x += dt) ph += (rateAt(x) / 60) * Math.min(dt, t - x) * Math.PI * 2;
  return ph;
}
