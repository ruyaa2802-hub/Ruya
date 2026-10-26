// Skeleton construction, procedural skinned-sweep geometry and analytic IK.
// Convention: character faces +Z, up +Y, character's left is +X.
// Every bone has an identity rest rotation, so "rest frame" == root frame.
import * as THREE from 'three';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------- skeleton ----------------
export function buildSkeleton() {
  const defs = [];
  const add = (name, parent, p) => defs.push({ name, parent, p: V(...p) });
  add('hips', null, [0, 0.98, 0]);
  add('spine', 'hips', [0, 1.1, 0]);
  add('chest', 'spine', [0, 1.28, -0.005]);
  add('neck', 'chest', [0, 1.46, -0.008]);
  add('head', 'neck', [0, 1.56, 0.008]);
  for (const s of [1, -1]) {
    const L = s > 0 ? 'L' : 'R';
    add('clavicle.' + L, 'chest', [s * 0.035, 1.425, 0.0]);
    add('upperArm.' + L, 'clavicle.' + L, [s * 0.185, 1.43, -0.015]);
    add('foreArm.' + L, 'upperArm.' + L, [s * 0.212, 1.145, -0.03]);
    add('hand.' + L, 'foreArm.' + L, [s * 0.232, 0.9, -0.01]);
    add('thigh.' + L, 'hips', [s * 0.095, 0.915, 0.0]);
    add('shin.' + L, 'thigh.' + L, [s * 0.1, 0.495, 0.01]);
    add('foot.' + L, 'shin.' + L, [s * 0.1, 0.085, -0.025]);
    // fingers (relative to the hand joint, in rest frame: fingers point -Y,
    // palm faces the body (-X*s), thumb points forward +Z)
    const hand = defs.find((d) => d.name === 'hand.' + L).p;
    const fingers = {
      index: { base: [s * -0.002, -0.093, 0.03], segs: [0.04, 0.025, 0.021] },
      middle: { base: [s * -0.002, -0.097, 0.009], segs: [0.044, 0.028, 0.022] },
      ring: { base: [s * -0.001, -0.094, -0.011], segs: [0.041, 0.026, 0.021] },
      pinky: { base: [s * 0.0, -0.085, -0.029], segs: [0.032, 0.02, 0.018] },
    };
    for (const [fname, f] of Object.entries(fingers)) {
      let parent = 'hand.' + L;
      let p = hand.clone().add(V(...f.base));
      for (let k = 0; k < 3; k++) {
        const n = `${fname}${k}.${L}`;
        add(n, parent, p.toArray());
        parent = n;
        p = p.clone().add(V(0, -f.segs[k], 0));
      }
      add(`${fname}Tip.${L}`, parent, p.toArray());
    }
    // thumb: from the base of the palm, angled forward/down/inward
    const tdir = V(s * -0.25, -0.62, 0.74).normalize();
    let tp = hand.clone().add(V(s * -0.006, -0.022, 0.022));
    let parent = 'hand.' + L;
    const tsegs = [0.045, 0.034, 0.027];
    for (let k = 0; k < 3; k++) {
      const n = `thumb${k}.${L}`;
      add(n, parent, tp.toArray());
      parent = n;
      tp = tp.clone().addScaledVector(tdir, tsegs[k]);
    }
    add(`thumbTip.${L}`, parent, tp.toArray());
  }

  const bones = [];
  const byName = {};
  const restWorld = {};
  for (const d of defs) {
    const b = new THREE.Bone();
    b.name = d.name;
    restWorld[d.name] = d.p.clone();
    if (d.parent) {
      b.position.copy(d.p).sub(restWorld[d.parent]);
      byName[d.parent].add(b);
    } else b.position.copy(d.p);
    byName[d.name] = b;
    bones.push(b);
  }
  const index = {};
  bones.forEach((b, i) => (index[b.name] = i));
  return { bones, byName, index, restWorld, root: byName.hips };
}

// ---------------- geometry builder with skin weights ----------------
export class GeoBuilder {
  constructor() {
    this.pos = []; this.uv = []; this.idx = []; this.si = []; this.sw = []; this.col = [];
  }
  get count() { return this.pos.length / 3; }
  vert(p, uv, weights, color = [1, 1, 1]) {
    this.pos.push(p.x, p.y, p.z);
    this.uv.push(uv[0], uv[1]);
    const w = weights.slice().sort((a, b) => b[1] - a[1]).slice(0, 4);
    let sum = w.reduce((s, x) => s + x[1], 0) || 1;
    for (let k = 0; k < 4; k++) {
      this.si.push(w[k] ? w[k][0] : 0);
      this.sw.push(w[k] ? w[k][1] / sum : 0);
    }
    this.col.push(...color);
    return this.count - 1;
  }
  tri(a, b, c) { this.idx.push(a, b, c); }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
    g.setIndex(this.idx);
    g.computeVertexNormals();
    smoothCoincidentNormals(g);
    return g;
  }
}

// Average normals of vertices sharing a position (uv seams, cap tips)
export function smoothCoincidentNormals(g) {
  const p = g.attributes.position.array, n = g.attributes.normal.array;
  const groups = new Map();
  for (let i = 0; i < p.length / 3; i++) {
    const k = Math.round(p[i * 3] * 1e5) + ',' + Math.round(p[i * 3 + 1] * 1e5) + ',' + Math.round(p[i * 3 + 2] * 1e5);
    let a = groups.get(k);
    if (!a) groups.set(k, (a = []));
    a.push(i);
  }
  for (const a of groups.values()) {
    if (a.length < 2) continue;
    let x = 0, y = 0, z = 0;
    for (const i of a) { x += n[i * 3]; y += n[i * 3 + 1]; z += n[i * 3 + 2]; }
    const l = Math.hypot(x, y, z) || 1;
    for (const i of a) { n[i * 3] = x / l; n[i * 3 + 1] = y / l; n[i * 3 + 2] = z / l; }
  }
  g.attributes.normal.needsUpdate = true;
}

// Sweep an (optionally super-elliptic) cross-section along a polyline.
// opts.radius(s, a) -> [rx, rz] or number; opts.offset(s,a) -> Vector3 (added)
// opts.weights(s, pointOnAxis) -> [[boneIndex, w], ...]
// opts.color(s, a) -> [r,g,b] (baked occlusion / seams)
export function sweep(B, opts) {
  const { path, samples = 24, radial = 24, ref = V(0, 0, 1), caps = [true, true], power = 2, uvScale = [1, 1] } = opts;
  // arc length param
  const L = [0];
  for (let i = 1; i < path.length; i++) L.push(L[i - 1] + path[i].distanceTo(path[i - 1]));
  const total = L[L.length - 1];
  const at = (s) => {
    const d = s * total;
    let i = 1;
    while (i < path.length - 1 && L[i] < d) i++;
    const f = (d - L[i - 1]) / Math.max(1e-6, L[i] - L[i - 1]);
    const p = path[i - 1].clone().lerp(path[i], f);
    // smoothed tangent
    const t0 = path[Math.max(0, i - 1)].clone().sub(path[Math.max(0, i - 2)] || path[0]);
    const t1 = path[i].clone().sub(path[i - 1]);
    const t2 = (path[i + 1] || path[i]).clone().sub(path[i]);
    let T = t1.clone().normalize();
    if (f < 0.5 && i > 1) T.lerp(t0.normalize(), 0.5 - f).normalize();
    if (f > 0.5 && path[i + 1]) T.lerp(t2.normalize(), f - 0.5).normalize();
    return { p, T };
  };
  const rings = [];
  const capSteps = 4;
  const sList = [];
  if (caps[0]) for (let k = capSteps; k >= 1; k--) sList.push({ s: 0, cap: k / capSteps, dir: -1 });
  for (let i = 0; i <= samples; i++) sList.push({ s: i / samples, cap: 0 });
  if (caps[1]) for (let k = 1; k <= capSteps; k++) sList.push({ s: 1, cap: k / capSteps, dir: 1 });

  for (const it of sList) {
    const { p, T } = at(it.s);
    let N = ref.clone().addScaledVector(T, -ref.dot(T));
    if (N.lengthSq() < 1e-6) N = V(1, 0, 0).addScaledVector(T, -T.x);
    N.normalize();
    const X = new THREE.Vector3().crossVectors(T, N).normalize();
    const ring = [];
    const shrink = it.cap ? Math.cos((it.cap * Math.PI) / 2) : 1;
    const push = it.cap ? Math.sin((it.cap * Math.PI) / 2) : 0;
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      let r = opts.radius(it.s, a);
      if (!Array.isArray(r)) r = [r, r];
      const ca = Math.cos(a), sa = Math.sin(a);
      const e = 2 / power;
      const cx = Math.sign(ca) * Math.pow(Math.abs(ca), e), sz = Math.sign(sa) * Math.pow(Math.abs(sa), e);
      const capLen = it.cap ? (opts.capLength ? opts.capLength(it.dir) : Math.min(r[0], r[1])) : 0;
      const q = p.clone()
        .addScaledVector(X, cx * r[0] * shrink)
        .addScaledVector(N, sz * r[1] * shrink)
        .addScaledVector(T, (it.dir || 0) * push * capLen);
      if (opts.offset) q.add(opts.offset(it.s, a, q));
      const w = opts.weights(it.s, q);
      const c = opts.color ? opts.color(it.s, a) : [1, 1, 1];
      ring.push(B.vert(q, [(j / radial) * uvScale[0], it.s * uvScale[1]], w, c));
    }
    rings.push(ring);
  }
  // X = T x N, ring runs X -> N, so (a, c, b) winding faces outward
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < radial; j++) {
      const a = rings[i][j], b = rings[i][j + 1], c = rings[i + 1][j], d = rings[i + 1][j + 1];
      B.tri(a, c, b); B.tri(b, c, d);
    }
  }
  // close the cap tips with fans
  return { rings, at };
}

// Weight helper for a chain of joints: s along the sweep is mapped to
// joint fractions given by `stops` = [[s0, boneIndex], [s1, boneIndex], ...]
// Each stop marks where a bone begins. Blending happens over `blend` around stops.
export function chainWeights(stops, blend = 0.06) {
  return (s) => {
    let k = 0;
    while (k < stops.length - 1 && s >= stops[k + 1][0]) k++;
    const cur = stops[k][1];
    // distance to the start of this bone (joint with parent)
    const ds = s - stops[k][0];
    if (k > 0 && ds < blend) {
      const t = 0.5 + 0.5 * (ds / blend);
      return [[cur, t], [stops[k - 1][1], 1 - t]];
    }
    if (k < stops.length - 1) {
      const dn = stops[k + 1][0] - s;
      if (dn < blend) {
        const t = 0.5 + 0.5 * (dn / blend);
        return [[cur, t], [stops[k + 1][1], 1 - t]];
      }
    }
    return [[cur, 1]];
  };
}

// ---------------- IK ----------------
const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4();
function basisQuat(xAxis, yAxis) {
  const x = xAxis.clone().normalize();
  const y = yAxis.clone().addScaledVector(x, -yAxis.dot(x)).normalize();
  const z = new THREE.Vector3().crossVectors(x, y);
  _m.makeBasis(x, y, z);
  return new THREE.Quaternion().setFromRotationMatrix(_m);
}
// rotation that maps rest frame (nRest, dRest) to target frame (nT, dT)
export function frameRotation(nRest, dRest, nT, dT) {
  const qr = basisQuat(nRest, dRest);
  const qt = basisQuat(nT, dT);
  return qt.multiply(qr.invert());
}

// root-local orientation of a bone
export function rootQuat(bone, rootInvQ) {
  const q = new THREE.Quaternion();
  bone.getWorldQuaternion(q);
  return rootInvQ.clone().multiply(q);
}
export function rootPos(bone, rootInvM) {
  return new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld).applyMatrix4(rootInvM);
}

// Analytic two-bone IK in root-local space.
// limb = { upper, lower, end, restA, restB, restC, restPole }
export function solveTwoBone(limb, target, pole, rootInvQ, rootInvM, soft = 0.002) {
  const { upper, lower, end } = limb;
  upper.parent.updateWorldMatrix(true, false);
  const a = rootPos(upper, rootInvM);
  const l1 = limb.restB.distanceTo(limb.restA);
  const l2 = limb.restC.distanceTo(limb.restB);
  const toT = target.clone().sub(a);
  let d = toT.length();
  const dir = toT.clone().normalize();
  const maxD = l1 + l2 - soft;
  d = Math.min(Math.max(d, Math.abs(l1 - l2) + 0.01), maxD);
  const toPole = pole.clone().sub(a);
  let n = new THREE.Vector3().crossVectors(dir, toPole);
  if (n.lengthSq() < 1e-8) n.set(1, 0, 0);
  n.normalize();
  const m = new THREE.Vector3().crossVectors(n, dir).normalize(); // toward pole
  const cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const elbow = a.clone().addScaledVector(dir, cosA * l1).addScaledVector(m, sinA * l1);
  const wrist = a.clone().addScaledVector(dir, d);

  // rest frame
  const restDirChain = limb.restC.clone().sub(limb.restA).normalize();
  const nr = new THREE.Vector3().crossVectors(restDirChain, limb.restPole.clone().sub(limb.restA)).normalize();
  const dr1 = limb.restB.clone().sub(limb.restA).normalize();
  const dr2 = limb.restC.clone().sub(limb.restB).normalize();
  const dt1 = elbow.clone().sub(a).normalize();
  const dt2 = wrist.clone().sub(elbow).normalize();
  const Q1 = frameRotation(nr, dr1, n, dt1);
  const Q2 = frameRotation(nr, dr2, n, dt2);
  const pq = rootQuat(upper.parent, rootInvQ);
  upper.quaternion.copy(pq.clone().invert().multiply(Q1));
  lower.quaternion.copy(Q1.clone().invert().multiply(Q2));
  upper.updateWorldMatrix(false, true);
  return { elbow, wrist, Q2 };
}

// Set a bone's root-local orientation (used for hands/feet after IK)
export function setRootOrientation(bone, q, rootInvQ) {
  bone.parent.updateWorldMatrix(true, false);
  const pq = rootQuat(bone.parent, rootInvQ);
  bone.quaternion.copy(pq.invert().multiply(q));
}

export { V };
