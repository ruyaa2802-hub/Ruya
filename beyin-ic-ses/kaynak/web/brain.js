// Beyin ici dunya: islak kivrimli doku magarasi, isiyan noronlar, akson aglari, miyelinli sinir lifi koprusu,
// lifler uzerinde ilerleyen isik darbeleri ve aktivasyon dalgalari.
import * as THREE from 'three';
import { setSeed, rnd } from './textures.js';

// --- 3B deger gurultusu
function hash3(x, y, z) { let h = x * 374761393 + y * 668265263 + z * 2147483647; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967295; }
function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const L = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz);
  return L(L(L(c(0, 0, 0), c(1, 0, 0), u), L(c(0, 1, 0), c(1, 1, 0), u), v), L(L(c(0, 0, 1), c(1, 0, 1), u), L(c(0, 1, 1), c(1, 1, 1), u), v), w);
}
function fbm3(x, y, z, o = 4) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * noise3(x * f, y * f, z * f); f *= 2.03; a *= 0.5; } return s; }

const PAL = [new THREE.Color(0x39e6ff), new THREE.Color(0x8a5cff), new THREE.Color(0xff7ad9), new THREE.Color(0x5cffb8), new THREE.Color(0xffb44a)];

export function buildBrain() {
  const G = new THREE.Group(); G.name = 'brain';
  // ---------------- doku magarasi (ic yuzey, beyin kivrimlari: gyri/sulci)
  const R = 34;
  const geo = new THREE.SphereGeometry(R, 260, 150);
  const P = geo.attributes.position, n = P.count; const col = new Float32Array(n * 3);
  const cA = new THREE.Color(0xd99aa0), cB = new THREE.Color(0x5a1f33), cC = new THREE.Color(0xf2c6c0);
  for (let i = 0; i < n; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    const s = 0.11;
    const warp = fbm3(x * 0.05, y * 0.05, z * 0.05, 3) * 6;
    const nn = fbm3(x * s + warp, y * s * 1.3 + warp, z * s - warp, 4);
    const ridge = 1 - Math.abs(nn * 2 - 1);          // kivrim sirti
    const fold = Math.pow(ridge, 3.0);
    const d = 1 - (fold * 3.2 + fbm3(x * 0.6, y * 0.6, z * 0.6, 2) * 0.35) / R;
    P.setXYZ(i, x * d, y * d, z * d);
    const c = cB.clone().lerp(cA, Math.min(1, fold * 1.25)).lerp(cC, Math.max(0, fold - 0.82) * 2.5);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
  const tissue = new THREE.MeshPhysicalMaterial({ vertexColors: true, side: THREE.BackSide, roughness: 0.38, clearcoat: 0.9, clearcoatRoughness: 0.25, sheen: 0.6, sheenColor: new THREE.Color(0xff9ab0), sheenRoughness: 0.5 });
  const cave = new THREE.Mesh(geo, tissue); G.add(cave);

  // ---------------- ortak malzemeler
  const fibers = []; const neurons = [];
  const somaGeo = new THREE.IcosahedronGeometry(1, 4);
  // ---------------- miyelinli sinir lifi koprusu (karakter ustunde yurur)
  const bridgeCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.15, -0.6), new THREE.Vector3(0.5, -0.35, -4.5), new THREE.Vector3(-0.5, -0.15, -9),
    new THREE.Vector3(0.4, 0.25, -14), new THREE.Vector3(-0.2, 0.6, -20), new THREE.Vector3(0.3, 1.2, -27)]);
  const nearBridgeR = (p, rad) => { for (let u = 0; u <= 1; u += 0.02) if (bridgeCurve.getPointAt(u).distanceTo(p) < rad) return true; return false; };
  // ---------------- dev noron (karakterin oturdugu) merkezde
  const bigCol = new THREE.Color(0x39d6ff);
  const bigMat = new THREE.MeshPhysicalMaterial({ color: 0x9fe8ff, emissive: bigCol, emissiveIntensity: 0.9, roughness: 0.25, clearcoat: 1, transmission: 0.0 });
  const bigSoma = new THREE.Mesh(somaGeo, bigMat); bigSoma.scale.set(1.15, 0.85, 1.15); bigSoma.position.set(0, 0, 0); G.add(bigSoma);
  neurons.push({ p: new THREE.Vector3(0, 0, 0), mat: bigMat, base: 0.9, col: bigCol, r: 1.1, act: 0 });
  // dev noronun dendritleri
  setSeed(7);
  const dendrite = (from, dir, len, r, color, depth) => {
    const pts = [from.clone()]; let p = from.clone(); const d = dir.clone().normalize();
    for (let k = 0; k < 6; k++) { d.add(new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(0.5)).normalize(); p = p.clone().add(d.clone().multiplyScalar(len / 6)); pts.push(p); }
    const curve = new THREE.CatmullRomCurve3(pts);
    if (pts.some((q) => nearBridgeR(q, 2.0))) return { curve };   // yurume yolunu kapatmasin
    const m = new THREE.MeshStandardMaterial({ color: 0x223040, emissive: color, emissiveIntensity: 0.35, roughness: 0.4 });
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, r, 6, false), m); G.add(tube);
    if (depth > 0) for (let b = 0; b < 2; b++) { const t = 0.4 + rnd() * 0.5; dendrite(curve.getPoint(t), d.clone().add(new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5)), len * 0.55, r * 0.6, color, depth - 1); }
    return { curve, m };
  };
  for (let k = 0; k < 9; k++) {
    const a = k / 9 * Math.PI * 2 + rnd() * 0.3;
    const dir = new THREE.Vector3(Math.cos(a), -0.25 + rnd() * 0.7, Math.sin(a));
    if (dir.z < -0.6 && Math.abs(dir.x) < 0.5) continue; // kopru tarafini bos birak
    dendrite(dir.clone().multiplyScalar(1.0), dir, 4.5 + rnd() * 3, 0.09, bigCol, 2);
  }

  const BR = 0.42;
  const axonMat = new THREE.MeshPhysicalMaterial({ color: 0x3a4a6a, emissive: 0x2a8cff, emissiveIntensity: 0.25, roughness: 0.3, clearcoat: 0.8 });
  G.add(new THREE.Mesh(new THREE.TubeGeometry(bridgeCurve, 300, BR * 0.82, 20, false), axonMat));
  // miyelin kiliflari (boncuklu) + Ranvier dugumleri (isik halkalari)
  const myelinMat = new THREE.MeshPhysicalMaterial({ color: 0xe8e2f0, roughness: 0.35, clearcoat: 1, sheen: 0.4, sheenColor: new THREE.Color(0xbfd4ff), emissive: 0x1a2440, emissiveIntensity: 0.3 });
  const nodeMats = [];
  const segLen = 1.35; const L = bridgeCurve.getLength(); const nSeg = Math.floor(L / segLen);
  const tmpQ = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < nSeg; i++) {
    const s = (i + 0.5) / nSeg;
    const p = bridgeCurve.getPointAt(s), tg = bridgeCurve.getTangentAt(s);
    const seg = new THREE.Mesh(new THREE.CapsuleGeometry(BR, segLen - 2 * BR - 0.08, 10, 24), myelinMat);
    seg.position.copy(p); seg.quaternion.copy(tmpQ.setFromUnitVectors(Y, tg)); G.add(seg);
    const nm = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x6fe3ff, emissiveIntensity: 0.6 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(BR * 0.84, 0.05, 10, 32), nm);
    const sp = bridgeCurve.getPointAt(Math.min(1, (i + 1) / nSeg)), stg = bridgeCurve.getTangentAt(Math.min(1, (i + 1) / nSeg));
    ring.position.copy(sp); ring.quaternion.copy(tmpQ.setFromUnitVectors(new THREE.Vector3(0, 0, 1), stg)); G.add(ring);
    nodeMats.push({ m: nm, s: (i + 1) / nSeg });
  }

  // ---------------- noron sahasi
  setSeed(42);
  const nearBridge = (p) => { for (let s = 0; s <= 1; s += 0.05) if (bridgeCurve.getPointAt(s).distanceTo(p) < 2.2) return true; return false; };
  let tries = 0;
  while (neurons.length < 70 && tries < 4000) {
    tries++;
    const p = new THREE.Vector3((rnd() - 0.5) * 26, -6 + rnd() * 15, 6 - rnd() * 32);
    if (p.length() < 3 || nearBridge(p) || p.length() > R - 6) continue;
    if (neurons.some((q) => q.p.distanceTo(p) < 2.2)) continue;
    const c = PAL[Math.floor(rnd() * PAL.length)].clone();
    const r = 0.18 + rnd() * 0.32;
    const m = new THREE.MeshPhysicalMaterial({ color: c.clone().multiplyScalar(0.5), emissive: c, emissiveIntensity: 0.55, roughness: 0.3, clearcoat: 1 });
    const so = new THREE.Mesh(somaGeo, m); so.position.copy(p); so.scale.setScalar(r); so.scale.y *= 0.8; so.rotation.set(rnd() * 3, rnd() * 3, 0); G.add(so);
    neurons.push({ p, mat: m, base: 0.55, col: c, r, act: 0 });
    // kisa dendritler
    for (let k = 0; k < 4; k++) {
      const dir = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize();
      const pts = [p.clone()]; let q = p.clone();
      for (let j = 0; j < 4; j++) { dir.add(new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(0.6)).normalize(); q = q.clone().add(dir.clone().multiplyScalar(0.35 + rnd() * 0.3)); pts.push(q); }
      G.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, r * 0.12, 5, false), m));
    }
  }
  // akson baglantilari: her noron en yakin 2-3 komsuya
  const fiberMat0 = (c) => new THREE.MeshStandardMaterial({ color: 0x101420, emissive: c, emissiveIntensity: 0.18, roughness: 0.5 });
  for (let i = 0; i < neurons.length; i++) {
    const a = neurons[i];
    const near = neurons.map((b, j) => [a.p.distanceTo(b.p), j]).filter(([d, j]) => j !== i && d < 9).sort((x, y) => x[0] - y[0]).slice(0, 3);
    for (const [d, j] of near) {
      if (j < i && fibers.some((f) => (f.a === j && f.b === i))) continue;
      const b = neurons[j];
      const mid = a.p.clone().lerp(b.p, 0.5).add(new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(d * 0.35));
      const mid2 = a.p.clone().lerp(b.p, 0.25).add(new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(d * 0.15));
      const curve = new THREE.CatmullRomCurve3([a.p.clone(), mid2, mid, b.p.clone()]);
      const m = fiberMat0(a.col.clone().lerp(b.col, 0.5));
      const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.028 + rnd() * 0.02, 6, false), m); G.add(mesh);
      fibers.push({ a: i, b: j, curve, m, len: curve.getLength() });
    }
  }

  // ---------------- isik darbeleri (sprite havuzu)
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const pool = [];
  for (let i = 0; i < 90; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); s.visible = false; G.add(s); pool.push(s); }

  // darbe programi (deterministik): her lif icin rastgele zamanlarda darbeler
  setSeed(99);
  const SPEED = 7.0;
  const pulses = [];
  for (let fi = 0; fi < fibers.length; fi++) {
    let t = rnd() * 3;
    while (t < 30) { pulses.push({ f: fi, t0: t, dir: rnd() < 0.5 ? 1 : -1 }); t += 2.2 + rnd() * 5.5; }
  }
  // kopru uzerinde saltatory iletim: darbeler dugumden dugume ziplar
  const bridgePulses = [];
  for (let t = 0.5; t < 30; t += 1.6 + rnd() * 1.2) bridgePulses.push(t);
  // dalgalar (sahne 3): kaynak noron + baslangic zamani
  const waves = [];

  // ---------------- isiklar: doku kivrimlari gorunsun (renkli noron isigi + pembe ortam)
  G.add(new THREE.HemisphereLight(0xff8fb8, 0x1a0614, 0.55));
  const PL = [[0, 2.5, 0, 0x39d6ff, 30], [6, 3, -8, 0x8a5cff, 60], [-7, 1, -12, 0xff7ad9, 60], [4, -2, -18, 0x39e6ff, 60], [-5, 5, 2, 0xffb44a, 40], [0, 8, -24, 0x8a5cff, 80], [8, -3, 4, 0x5cffb8, 40]];
  for (const [x, y, z, c, i] of PL) { const l = new THREE.PointLight(c, i, 30, 1.4); l.position.set(x, y, z); G.add(l); }
  const keyL = new THREE.PointLight(0xfff0e0, 6, 6, 1.6); G.add(keyL);   // karakteri aydinlatan (kamerayi izler)
  const rimL = new THREE.PointLight(0x5ad8ff, 5, 5, 1.6); G.add(rimL);
  const api = { G, keyL, rimL, neurons, fibers, bridgeCurve, BR, bigSoma, nodeMats, pulses, bridgePulses, waves, SPEED, tissue };
  api.addWave = (t0, origin, speed = 9) => waves.push({ t0, origin: origin.clone(), speed });
  // arac: t aninda bir noronun aktivasyonu (darbe varisi + dalga)
  api.update = (t) => {
    for (const nn of neurons) nn.act = 0;
    // darbeler
    let k = 0;
    for (const pu of pulses) {
      const f = fibers[pu.f]; const dur = f.len / SPEED; const u = (t - pu.t0) / dur;
      if (u >= 0 && u <= 1) {
        if (k < pool.length) {
          const s = pool[k++]; s.visible = true;
          s.position.copy(f.curve.getPointAt(pu.dir > 0 ? u : 1 - u));
          const c = neurons[pu.dir > 0 ? f.b : f.a].col; s.material.color.copy(c).lerp(new THREE.Color(1, 1, 1), 0.5);
          s.scale.setScalar(0.35);
        }
      }
      const arr = t - (pu.t0 + dur);
      if (arr >= 0 && arr < 0.45) { const tgt = neurons[pu.dir > 0 ? f.b : f.a]; tgt.act = Math.max(tgt.act, 1 - arr / 0.45); }
    }
    // dalgalar
    for (const w of waves) {
      const front = (t - w.t0) * w.speed;
      if (front < 0) continue;
      for (const nn of neurons) { const d = nn.p.distanceTo(w.origin); const x = front - d; if (x > 0 && x < 3.5) nn.act = Math.max(nn.act, 1.4 * (1 - x / 3.5)); }
    }
    for (const nn of neurons) nn.mat.emissiveIntensity = nn.base + nn.act * 3.2;
    // lifler: uc noronlarin aktivasyonu + dalga
    for (const f of fibers) {
      let a = Math.max(neurons[f.a].act, neurons[f.b].act) * 0.6;
      for (const w of waves) {
        const front = (t - w.t0) * w.speed;
        const d = f.curve.getPointAt(0.5).distanceTo(w.origin); const x = front - d;
        if (x > 0 && x < 4) a = Math.max(a, 1.6 * (1 - x / 4));
      }
      f.m.emissiveIntensity = 0.18 + a * 2.2;
    }
    for (; k < pool.length; k++) pool[k].visible = false;
    // kopru dugumleri: atlayan darbe
    for (const nm of nodeMats) nm.m.emissiveIntensity = 0.5;
    for (const bt of bridgePulses) {
      const u = (t - bt) * 0.22; // koprunun basindan sonuna
      if (u < 0 || u > 1.1) continue;
      for (const nm of nodeMats) { const dd = Math.abs(nm.s - u); if (dd < 0.035) nm.m.emissiveIntensity = Math.max(nm.m.emissiveIntensity, 0.5 + 5 * (1 - dd / 0.035)); }
    }
    bigMat.emissiveIntensity = 0.9 + neurons[0].act * 1.5 + 0.15 * Math.sin(t * 2.1);
  };
  // ses icin olaylar: noron aktivasyon zirveleri (varis anlari)
  api.events = () => {
    const ev = [];
    for (const pu of pulses) { const f = fibers[pu.f]; ev.push({ t: pu.t0 + f.len / SPEED, n: pu.dir > 0 ? f.b : f.a }); }
    return ev;
  };
  return api;
}
