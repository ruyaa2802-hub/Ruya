// Ana karakter: 20'li yaslarda genc adam. Koyu antrasit kapusonlu, koyu lacivert kot, koyu gri corap,
// kisa siyah sac, hafif sakal golgesi. Tum sahnelerde AYNI model kullanilir.
import * as THREE from 'three';
import { eyeTex, fabricBump, hairBump, fbmFn } from './textures.js';

const gauss = (x) => Math.exp(-x * x);
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function makeMan() {
  const fab = fabricBump();
  const M = {
    hoodie: new THREE.MeshStandardMaterial({ color: 0x2c2f35, roughness: 0.95, bumpMap: fab, bumpScale: 0.6 }),
    hoodieDark: new THREE.MeshStandardMaterial({ color: 0x24272c, roughness: 0.95, bumpMap: fab, bumpScale: 0.6 }),
    jeans: new THREE.MeshStandardMaterial({ color: 0x1d2635, roughness: 0.9, bumpMap: fab, bumpScale: 0.8 }),
    sock: new THREE.MeshStandardMaterial({ color: 0x2a2a2c, roughness: 1.0, bumpMap: fab, bumpScale: 0.5 }),
    skin: new THREE.MeshStandardMaterial({ color: 0xc79a86, roughness: 0.6 }),
    face: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 }),
    hair: new THREE.MeshStandardMaterial({ color: 0x15110f, roughness: 0.7, bumpMap: hairBump(), bumpScale: 2.0 }),
    brow: new THREE.MeshStandardMaterial({ color: 0x1a1411, roughness: 0.9 }),
    eye: new THREE.MeshStandardMaterial({ map: eyeTex(), roughness: 0.08 }),
    string: new THREE.MeshStandardMaterial({ color: 0x5c5c5c, roughness: 0.9 }),
  };
  const root = new THREE.Group(); root.name = 'man';
  const add = (parent, geo, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz);
    m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  };
  const grp = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
  const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 8, 16);
  const sph = new THREE.SphereGeometry(1, 32, 20);

  const hips = grp(root, 0, 0.95, 0);
  add(hips, sph, M.jeans, 0, 0, 0, 0.17, 0.11, 0.12);
  const J = { hips };
  for (const s of [1, -1]) {
    const hip = grp(hips, 0.092 * s, -0.02, 0);
    add(hip, cap(0.07, 0.34), M.jeans, 0, -0.22, 0);
    const knee = grp(hip, 0, -0.45, 0);
    add(knee, cap(0.054, 0.36), M.jeans, 0, -0.21, 0);
    add(knee, new THREE.CylinderGeometry(0.06, 0.062, 0.05, 16), M.jeans, 0, -0.38, 0); // paca
    const ankle = grp(knee, 0, -0.45, 0);
    add(ankle, sph, M.sock, 0, -0.022, 0.055, 0.048, 0.035, 0.125);
    add(ankle, cap(0.04, 0.04), M.sock, 0, 0.0, -0.005);
    J[s > 0 ? 'hipL' : 'hipR'] = hip; J[s > 0 ? 'kneeL' : 'kneeR'] = knee; J[s > 0 ? 'ankleL' : 'ankleR'] = ankle;
  }
  const spine = grp(hips, 0, 0.03, 0); J.spine = spine;
  // govde (kapusonlu)
  add(spine, cap(0.15, 0.3), M.hoodie, 0, 0.27, 0, 1.18, 1, 0.72);
  add(spine, sph, M.hoodie, 0, 0.06, 0.0, 0.18, 0.09, 0.115);          // bel lastigi
  add(spine, new THREE.CylinderGeometry(0.176, 0.17, 0.06, 24), M.hoodieDark, 0, 0.02, 0, 1, 1, 0.68);
  add(spine, new THREE.BoxGeometry(0.2, 0.11, 0.01), M.hoodieDark, 0, 0.15, 0.108).rotation.x = -0.08; // kanguru cep
  for (const s of [1, -1]) add(spine, sph, M.hoodie, 0.185 * s, 0.47, 0, 0.08, 0.07, 0.085);
  const hood = add(spine, new THREE.TorusGeometry(0.085, 0.038, 12, 24), M.hoodieDark, 0, 0.545, -0.03);
  hood.rotation.x = Math.PI / 2 + 0.25; hood.scale.set(1.15, 1, 1);
  add(spine, sph, M.hoodieDark, 0, 0.5, -0.1, 0.1, 0.08, 0.05);
  for (const s of [1, -1]) {
    const st = add(spine, new THREE.CylinderGeometry(0.004, 0.004, 0.17, 6), M.string, 0.032 * s, 0.44, 0.105);
    st.rotation.x = -0.15;
  }
  // boyun + bas
  const neck = grp(spine, 0, 0.55, 0.0); J.neck = neck;
  add(neck, new THREE.CylinderGeometry(0.056, 0.062, 0.12, 16), M.skin, 0, 0.03, 0.0);
  const head = grp(neck, 0, 0.055, 0.0); J.head = head;
  const face = buildHead();
  const faceMesh = add(head, face.geo, M.face, 0, 0.1, 0.012);
  // kulaklar
  for (const s of [1, -1]) add(head, sph, M.skin, 0.076 * s, 0.1, 0.0, 0.012, 0.029, 0.019).rotation.y = 0.3 * s;
  // sac
  const hairGeo = buildHair();
  add(head, hairGeo, M.hair, 0, 0.1, 0.012);
  // gozler, goz kapaklari, kaslar
  const eyes = [], lids = [], brows = [];
  for (const s of [1, -1]) {
    const eg = grp(head, 0.0315 * s, 0.1 + 0.0105, 0.012 + 0.0675);
    const e = add(eg, new THREE.SphereGeometry(0.0118, 32, 16), M.eye); e.castShadow = false;
    eyes.push(eg);
    const lid = add(eg, new THREE.SphereGeometry(0.0126, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.4), M.skin); lid.castShadow = false;
    const lidLo = add(eg, new THREE.SphereGeometry(0.0125, 24, 8, 0, Math.PI * 2, Math.PI * 0.66, Math.PI * 0.34), M.skin); lidLo.castShadow = false;
    lids.push(lid);
    const b = add(head, new THREE.BoxGeometry(0.032, 0.0035, 0.006), M.brow, 0.031 * s, 0.1 + 0.029, 0.012 + 0.086);
    b.rotation.z = -0.12 * s; b.rotation.y = 0.25 * s; brows.push(b); b.castShadow = false;
  }
  // kollar
  for (const s of [1, -1]) {
    const sh = grp(spine, 0.2 * s, 0.465, 0);
    add(sh, cap(0.058, 0.2), M.hoodie, 0, -0.15, 0);
    const el = grp(sh, 0, -0.29, 0);
    add(el, cap(0.05, 0.18), M.hoodie, 0, -0.12, 0);
    add(el, new THREE.CylinderGeometry(0.043, 0.04, 0.05, 16), M.hoodieDark, 0, -0.235, 0); // manset
    const wr = grp(el, 0, -0.265, 0);
    add(wr, sph, M.skin, 0, -0.045, 0, 0.04, 0.05, 0.019);
    for (let f = 0; f < 4; f++) add(wr, cap(0.0095, 0.045 - Math.abs(f - 1.5) * 0.006), M.skin, (f - 1.5) * 0.019 * s, -0.11, 0.004);
    const th = add(wr, cap(0.011, 0.04), M.skin, 0.035 * s, -0.06, 0.012); th.rotation.z = 0.6 * s;
    J[s > 0 ? 'shL' : 'shR'] = sh; J[s > 0 ? 'elL' : 'elR'] = el; J[s > 0 ? 'wrL' : 'wrR'] = wr;
  }

  // ---- kontrol API
  const api = { root, J, eyes, lids, brows, face, faceMesh, M };
  let lastLid = -1, lastJaw = -1;
  api.setLids = (open) => { // 0 kapali, 1 normal, 1.3 korkuyla acik
    const v = Math.round(open * 50) / 50; if (v === lastLid) return; lastLid = v;
    const len = Math.PI * (0.92 - 0.52 * Math.min(open, 1) - 0.06 * Math.max(0, open - 1) / 0.3);
    for (const l of lids) { l.geometry.dispose(); l.geometry = new THREE.SphereGeometry(0.0126, 24, 12, 0, Math.PI * 2, 0, len); }
  };
  api.setJaw = (j) => { const v = Math.round(j * 40) / 40; if (v === lastJaw) return; lastJaw = v; face.setJaw(v); };
  api.gaze = (yaw, pitch) => { for (const e of eyes) { e.rotation.set(pitch, yaw, 0); } };
  api.browsWorried = (k) => { brows.forEach((b, i) => { const s = i === 0 ? 1 : -1; b.rotation.z = (-0.12 - 0.25 * k) * s; b.position.y = 0.1 + 0.029 + 0.003 * k; }); };
  api.setLids(1);
  return api;
}

// ------------------------------------------------------------- yuz geometrisi
function buildHead() {
  const geo = new THREE.SphereGeometry(1, 96, 72);
  const P = geo.attributes.position; const n = P.count;
  const base = new Float32Array(n * 3); const meta = new Float32Array(n * 3);
  const colors = new Float32Array(n * 3);
  const skin = new THREE.Color(0xc79a86), lip = new THREE.Color(0x96534f), stub = new THREE.Color(0x6e5a52), mouthC = new THREE.Color(0x2a0f0e), sock = new THREE.Color(0xb98572);
  for (let i = 0; i < n; i++) {
    let x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    const u = x, v = y; const fr = sstep(0.15, 0.6, z);
    // cene incelmesi
    if (y < 0) { const k = 1 - 0.2 * Math.pow(-y, 1.6); x *= k; if (z < 0) z *= 1 - 0.1 * Math.pow(-y, 1.5); }
    if (z < 0 && y > -0.4) z *= 1.07;
    if (z > 0) z *= 1 - 0.1 * x * x;
    let X = x * 0.077, Y = y * 0.11, Z = z * 0.096;
    // yuz ozellikleri (ileri yonde ofset, metre)
    let d = 0;
    const ridge = sstep(0.08, -0.05, v) * sstep(-0.38, -0.3, v);
    d += 0.024 * ridge * gauss(u / 0.085) * (0.55 + 0.45 * sstep(0.0, -0.28, v));
    d += 0.011 * gauss(u / 0.12) * gauss((v + 0.28) / 0.06);
    d += 0.006 * (gauss((u - 0.12) / 0.06) + gauss((u + 0.11) / 0.06)) * gauss((v + 0.3) / 0.05);
    d -= 0.015 * (gauss(Math.hypot(u - 0.4, (v - 0.1) * 1.3) / 0.15) + gauss(Math.hypot(u + 0.4, (v - 0.1) * 1.3) / 0.15));
    d += 0.006 * gauss((v - 0.27) / 0.07) * sstep(0.62, 0.4, Math.abs(u));
    d += 0.007 * (gauss(Math.hypot(Math.abs(u) - 0.5, v + 0.08) / 0.15));
    d -= 0.004 * gauss(Math.hypot(Math.abs(u) - 0.45, v + 0.38) / 0.12);
    d += 0.008 * gauss(u / 0.2) * gauss((v + 0.43) / 0.035);
    d += 0.0085 * gauss(u / 0.18) * gauss((v + 0.525) / 0.04);
    d -= 0.003 * gauss(u / 0.24) * gauss((v + 0.475) / 0.012);
    d += 0.01 * gauss(u / 0.3) * gauss((v + 0.76) / 0.12);
    Z += d * fr;
    base[i * 3] = X; base[i * 3 + 1] = Y; base[i * 3 + 2] = Z;
    meta[i * 3] = u; meta[i * 3 + 1] = v; meta[i * 3 + 2] = fr;
    // renk
    const c = skin.clone();
    const lipW = gauss(u / 0.2) * (gauss((v + 0.43) / 0.035) + gauss((v + 0.525) / 0.04)) * fr;
    const beard = sstep(-0.32, -0.5, v) * sstep(0.95, 0.7, Math.abs(u) + 0.0) * (z > -0.3 ? 1 : 0) * (1 - Math.min(1, lipW * 1.4));
    const mus = gauss(u / 0.3) * gauss((v + 0.385) / 0.03) * fr;
    c.lerp(stub, Math.min(1, beard * 0.55 + mus * 0.45));
    c.lerp(lip, Math.min(1, lipW * 0.8));
    const sockW = (gauss(Math.hypot(u - 0.4, (v - 0.06) * 1.3) / 0.17) + gauss(Math.hypot(u + 0.4, (v - 0.06) * 1.3) / 0.17)) * fr;
    c.lerp(sock, Math.min(1, sockW * 0.5));
    const mouth = gauss(u / 0.2) * gauss((v + 0.475) / 0.013) * fr;
    c.lerp(mouthC, Math.min(1, mouth * 1.2));
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const setJaw = (j) => {
    for (let i = 0; i < n; i++) {
      const v = meta[i * 3 + 1], u = meta[i * 3], fr = meta[i * 3 + 2];
      let dy = 0, dz = 0;
      if (v < -0.468) {
        const w = Math.min(1, (-0.468 - v) / 0.06) * sstep(0.9, 0.5, Math.abs(u));
        const ww = w * (0.6 + 0.4 * fr);
        dy = -0.013 * j * ww; dz = -0.004 * j * ww;
      } else if (v < -0.44) {
        dy = 0.001 * j * gauss(u / 0.2) * fr;
      }
      P.setXYZ(i, base[i * 3], base[i * 3 + 1] + dy, base[i * 3 + 2] + dz);
    }
    P.needsUpdate = true; geo.computeVertexNormals();
  };
  setJaw(0);
  return { geo, setJaw };
}

function buildHair() {
  const geo = new THREE.SphereGeometry(1, 64, 40);
  const P = geo.attributes.position; const f = fbmFn(77, 4);
  const keep = [];
  for (let i = 0; i < P.count; i++) {
    let x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    // sac cizgisi: alin onde yuksek, yanlarda kulak ustu, arkada ense
    const hair = (z > 0.2) ? y > 0.36 - 0.08 * Math.abs(x) - 0.02 * Math.sin(x * 20) : (z > -0.3 ? y > 0.05 - (0.2 - z) * 0.3 + (Math.abs(x) > 0.85 ? 0.12 : 0) : y > -0.55);
    const k = 1.0 + (hair ? 0.014 + 0.035 * f(x * 4 + 3, y * 4 + z * 3) * Math.min(1, Math.max(0, y + 0.3)) : -0.04);
    // ayni cene incelmesi
    let xx = x, zz = z;
    if (y < 0) { const kk = 1 - 0.2 * Math.pow(-y, 1.6); xx *= kk; if (z < 0) zz *= 1 - 0.1 * Math.pow(-y, 1.5); }
    if (z < 0 && y > -0.4) zz *= 1.07;
    P.setXYZ(i, xx * 0.077 * k, y * 0.11 * k + (hair && y > 0.6 ? 0.004 : 0), zz * 0.096 * k);
    keep.push(hair);
  }
  // sac olmayan ucgenleri at
  const idx = geo.index.array; const out = [];
  for (let t = 0; t < idx.length; t += 3) if (keep[idx[t]] && keep[idx[t + 1]] && keep[idx[t + 2]]) out.push(idx[t], idx[t + 1], idx[t + 2]);
  geo.setIndex(out); geo.computeVertexNormals();
  return geo;
}

// ----------------------------------------------------- iki kemikli kol IK
const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), DOWN = new THREE.Vector3(0, -1, 0);
export function armIK(man, side, target, pole) {
  const sh = man.J[side === 'L' ? 'shL' : 'shR'], el = man.J[side === 'L' ? 'elL' : 'elR'];
  const L1 = 0.29, L2 = 0.265 + 0.06;
  sh.rotation.set(0, 0, 0); el.rotation.set(0, 0, 0);
  man.root.updateMatrixWorld(true);
  const S = new THREE.Vector3().setFromMatrixPosition(sh.matrixWorld);
  const D = target.clone().sub(S); let dist = D.length();
  dist = Math.min(dist, (L1 + L2) * 0.999); D.setLength(dist);
  const a = Math.acos(Math.min(1, Math.max(-1, (L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist))));
  const dn = D.clone().normalize();
  const pv = pole.clone().sub(S); pv.sub(dn.clone().multiplyScalar(pv.dot(dn))).normalize();
  const elbowDir = dn.clone().multiplyScalar(Math.cos(a)).add(pv.clone().multiplyScalar(Math.sin(a)));
  const E = S.clone().add(elbowDir.clone().multiplyScalar(L1));
  const foreDir = S.clone().add(D).sub(E).normalize();
  // omuz: ebeveyn uzayinda yon
  const parentQ = new THREE.Quaternion(); sh.parent.getWorldQuaternion(parentQ);
  const d1 = elbowDir.clone().applyQuaternion(parentQ.clone().invert());
  sh.quaternion.setFromUnitVectors(DOWN, d1.normalize());
  man.root.updateMatrixWorld(true);
  const shQ = new THREE.Quaternion(); sh.getWorldQuaternion(shQ);
  const d2 = foreDir.clone().applyQuaternion(shQ.invert());
  el.quaternion.setFromUnitVectors(DOWN, d2.normalize());
  man.root.updateMatrixWorld(true);
}
