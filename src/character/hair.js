// Messy short hair: a scalp cap that follows the hairline plus ~1100
// tapered clumps grown along a combing field with head collision.
import * as THREE from 'three';
import { HEAD, surfacePoint, hairMask } from './head.js';
import { rng, smoothstep, lerp, clamp, noise3 } from '../core/util.js';
import { hairCard } from '../core/textures.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const { C } = HEAD;

function dirAt(t, p) {
  return V(Math.sin(t) * Math.sin(p), Math.cos(t), -Math.sin(t) * Math.cos(p));
}
function normalAt(d) {
  const e = 0.004;
  const p = surfacePoint(d);
  const t1 = new THREE.Vector3().crossVectors(d, V(0, 1, 0));
  if (t1.lengthSq() < 1e-6) t1.set(1, 0, 0);
  t1.normalize();
  const t2 = new THREE.Vector3().crossVectors(t1, d).normalize();
  const a = surfacePoint(d.clone().addScaledVector(t1, e).normalize()).sub(p);
  const b = surfacePoint(d.clone().addScaledVector(t2, e).normalize()).sub(p);
  const n = new THREE.Vector3().crossVectors(a, b).normalize();
  if (n.dot(d) < 0) n.negate();
  return n;
}
// combing direction field (tangent to scalp)
function comb(d, n) {
  const { x, y, z } = d;
  let c;
  if (y > 0.45) {
    // top: forward, sweeping slightly to the character's right (-x)
    c = V(-0.25 - x * 0.3, 0.1, 1);
  } else if (z < -0.2) c = V(x * 0.3, -1, -0.2); // back: down
  else c = V(-Math.sign(x) * 0.15, -0.6, -0.8); // sides: back & down
  c.addScaledVector(n, -c.dot(n)).normalize();
  return c;
}
// keep strands out of the head
function collide(p, minOff) {
  const q = p.clone().sub(C);
  const d = V(q.x / HEAD.HW, q.y / HEAD.HH, q.z / HEAD.HD).normalize();
  const s = surfacePoint(d).sub(C);
  const need = s.length() + minOff;
  if (q.length() < need) q.setLength(need);
  return q.add(C);
}

export function buildHair(mat, capMat) {
  mat.map = hairCard();
  mat.alphaHash = true;
  mat.color.set(0xffffff);
  const group = new THREE.Group();
  group.name = 'hair';
  // ---- scalp cap ----
  const R = 150, Cn = 220;
  const pos = [], uv = [], idx = [], mask = [], col = [];
  for (let r = 0; r <= R; r++) {
    const t = (r / R) * Math.PI * 0.82;
    for (let c = 0; c <= Cn; c++) {
      const ph = (c / Cn) * Math.PI * 2;
      const d = dirAt(t, ph);
      const m = hairMask(d);
      const n = normalAt(d);
      const vol = 0.0035 + 0.009 * smoothstep(0.35, 0.95, d.y) + 0.002 * noise3(d.x * 8, d.y * 8, d.z * 8, 4);
      const p = surfacePoint(d).addScaledVector(n, vol * smoothstep(0.2, 0.95, m) + 0.0004);
      pos.push(p.x, p.y, p.z);
      uv.push(c / Cn * 6, r / R * 3);
      mask.push(m);
      col.push(1, 1, 1, smoothstep(0.25, 0.75, m));
    }
  }
  for (let r = 0; r < R; r++) for (let c = 0; c < Cn; c++) {
    const a = r * (Cn + 1) + c, b = a + 1, cc = a + Cn + 1, dd = cc + 1;
    if (Math.min(mask[a], mask[b], mask[cc], mask[dd]) < 0.12) continue;
    idx.push(a, b, cc, b, dd, cc);
  }
  const capGeo = new THREE.BufferGeometry();
  capGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  capGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  capGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  capMat.vertexColors = true;
  capMat.alphaHash = true;
  capGeo.setIndex(idx);
  capGeo.computeVertexNormals();
  const cap = new THREE.Mesh(capGeo, capMat);
  cap.castShadow = true; cap.receiveShadow = true;
  group.add(cap);

  // ---- hair cards: flat ribbons of alpha-textured fibres ----
  const rnd = rng(1234);
  const P = [], U = [], I = [];
  const SEG = 10;
  let tries = 0, made = 0;
  while (made < 1300 && tries < 80000) {
    tries++;
    const t = Math.acos(1 - 2 * rnd() * 0.8);
    const ph = rnd() * Math.PI * 2;
    const d = dirAt(t, ph);
    const m = hairMask(d);
    if (m < 0.35 || rnd() > m) continue;
    made++;
    const n = normalAt(d);
    const top = smoothstep(0.3, 0.85, d.y);
    const edge = smoothstep(0.35, 0.85, m);
    const len = lerp(0.02, 0.068, top) * (0.75 + rnd() * 0.5) * (d.z < -0.3 ? 0.8 : 1) * lerp(0.45, 1, edge);
    const lift = lerp(0.08, 0.28, top) * edge + rnd() * 0.06;
    let p = surfacePoint(d).addScaledVector(n, 0.0012);
    const cd0 = comb(d, n);
    let dir = cd0.clone().multiplyScalar(1 - lift).addScaledVector(n, lift).normalize();
    const wob = rnd() * 100;
    const pts = [p.clone()];
    for (let k = 1; k <= SEG; k++) {
      const f = k / SEG;
      dir.lerp(comb(d, n), 0.15 + f * 0.08);
      dir.y -= 0.06 * f * top;
      dir.x += noise3(wob, f * 2, 0, 3) * 0.05;
      dir.z += noise3(wob, f * 2, 5, 4) * 0.03;
      dir.normalize();
      p = p.clone().addScaledVector(dir, len / SEG);
      p = collide(p, 0.0018 + 0.007 * top * edge * Math.sin(f * Math.PI * 0.75));
      pts.push(p);
    }
    const w0 = lerp(0.006, 0.012, top) * (0.75 + rnd() * 0.5) * lerp(0.6, 1, edge);
    const base = P.length / 3;
    for (let k = 0; k <= SEG; k++) {
      const f = k / SEG;
      const T = pts[Math.min(SEG, k + 1)].clone().sub(pts[Math.max(0, k - 1)]).normalize();
      const q0 = pts[k].clone().sub(C);
      const out = V(q0.x / HEAD.HW, q0.y / HEAD.HH, q0.z / HEAD.HD).normalize();
      const side = new THREE.Vector3().crossVectors(out, T).normalize();
      const w = w0 * (1 - 0.45 * f);
      for (let j = 0; j < 3; j++) {
        const a = j / 2 - 0.5;
        const q = pts[k].clone().addScaledVector(side, a * w).addScaledVector(out, (0.25 - a * a) * w * 0.35);
        P.push(q.x, q.y, q.z);
        U.push(j / 2, f);
      }
    }
    for (let k = 0; k < SEG; k++) for (let j = 0; j < 2; j++) {
      const a = base + k * 3 + j, b = a + 1, c = a + 3, dd = c + 1;
      I.push(a, c, b, b, c, dd);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  g.setIndex(I);
  g.computeVertexNormals();
  const clumps = new THREE.Mesh(g, mat);
  clumps.castShadow = true; clumps.receiveShadow = true;
  group.add(clumps);
  return group;
}
