// Piko & Moko — onaylı 3D modellerin hareket ettirilebilir (rig'li) sürümleri
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
function add(parent, geo, mat, pos, scale, rot) {
  const m = new THREE.Mesh(geo, mat);
  if (pos) m.position.copy(pos);
  if (scale) m.scale.set(...scale);
  if (rot) m.rotation.set(...rot);
  parent.add(m); return m;
}
function blushTex(rgb, a0, a1) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d');
  const rg = c.createRadialGradient(64, 64, 0, 64, 64, 64);
  rg.addColorStop(0, `rgba(${rgb},${a0})`); rg.addColorStop(0.6, `rgba(${rgb},${a1})`); rg.addColorStop(1, `rgba(${rgb},0)`);
  c.fillStyle = rg; c.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const shine = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
const black = new THREE.MeshPhysicalMaterial({ color: 0x17121a, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 });
const darkLine = new THREE.MeshStandardMaterial({ color: 0x241018, roughness: 0.6 });
export const PUREE = 0xd8203a;
const pureeMat = new THREE.MeshPhysicalMaterial({ color: PUREE, roughness: 0.25, clearcoat: 0.9, clearcoatRoughness: 0.15 });

function happyArc(w, h, r) {
  const pts = []; for (let i = 0; i <= 24; i++) { const a = Math.PI * i / 24; pts.push(V(-Math.cos(a) * w, Math.sin(a) * h, 0)); }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, r, 10, false);
}

// ---------------------------------------------------------------- PİKO
export function buildPiko() {
  const blueBase = new THREE.Color(0x4fa6ec);
  const blue = new THREE.MeshPhysicalMaterial({ color: blueBase.clone(), roughness: 0.55, clearcoat: 0.15, clearcoatRoughness: 0.7 });
  const peach = new THREE.MeshPhysicalMaterial({ color: 0xf0a77e, roughness: 0.55, clearcoat: 0.2 });
  const white = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.35, clearcoat: 0.5 });
  const C = V(0, 1.17, 0);

  const root = new THREE.Group();
  const legs = [];
  for (const sx of [-1, 1]) {
    const lg = new THREE.Group(); lg.position.set(sx * 0.33, 0, 0); root.add(lg);
    add(lg, new THREE.CapsuleGeometry(0.16, 0.18, 8, 24), blue, V(0, 0.3, 0));
    add(lg, new THREE.SphereGeometry(1, 40, 28), peach, V(sx * 0.03, 0.11, 0.1), [0.25, 0.13, 0.33]);
    legs.push(lg);
  }
  const squash = new THREE.Group(); root.add(squash);
  const lean = new THREE.Group(); lean.position.y = 0.3; squash.add(lean);
  const B = new THREE.Group(); B.position.y = -0.3; lean.add(B);   // gövde uzayı

  // gövde + göbek
  const g = new THREE.SphereGeometry(1, 128, 96); const p = g.attributes.position; const bd = V(0, -0.4, 0.92).normalize(); const v = V(0, 0, 0);
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = v.clone().normalize(); v.multiplyScalar(1 + 0.09 * Math.exp(-n.distanceToSquared(bd) / 0.3)); v.y *= 0.97; p.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals();
  const body = add(B, g, blue, C);

  const arms = [];
  for (const sx of [-1, 1]) {
    const pv = new THREE.Group(); pv.position.set(sx * 0.82, 1.28, 0.05); B.add(pv);
    add(pv, new THREE.SphereGeometry(1, 48, 36), blue, V(sx * 0.13, -0.38, 0), [0.24, 0.44, 0.28], [0, 0, sx * 0.25]);
    arms.push(pv);
  }
  // anten
  const ant = new THREE.Group(); ant.position.set(0, 2.08, 0); B.add(ant);
  const cp = [V(0, -0.03, 0), V(0, 0.12, 0)];
  for (let i = 0; i <= 60; i++) { const t = i / 60, a = Math.PI - t * 2.3 * Math.PI, rr = 0.15 * (1 - 0.62 * t); cp.push(V(0.15 + Math.cos(a) * rr, 0.28 + Math.sin(a) * rr, 0)); }
  add(ant, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cp), 160, 0.042, 12, false), blue);
  add(ant, new THREE.SphereGeometry(0.043, 16, 16), blue, cp[cp.length - 1]);

  // yüzey yerleştirici
  const probe = new THREE.Mesh(g, blue); probe.position.copy(C); probe.updateMatrixWorld();
  const rc = new THREE.Raycaster();
  function surf(dir, off) {
    const d = V(...dir).normalize(); rc.set(C.clone().add(d.clone().multiplyScalar(3)), d.clone().negate());
    const h = rc.intersectObject(probe)[0]; const n = h.face.normal.clone().normalize();
    return { pos: h.point.clone().add(n.clone().multiplyScalar(off)), q: new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), n) };
  }
  const eyes = [], pupils = [], happy = [];
  for (const sx of [-1, 1]) {
    const s = surf([sx * 0.36, 0.18, 0.93], -0.03);
    const eg = new THREE.Group(); eg.position.copy(s.pos); eg.quaternion.copy(s.q); B.add(eg);
    const ei = new THREE.Group(); eg.add(ei);
    add(ei, new THREE.SphereGeometry(0.255, 48, 36), white, null, [1, 1.02, 0.32]);
    const pg = new THREE.Group(); ei.add(pg);
    add(pg, new THREE.SphereGeometry(0.19, 48, 36), black, V(0, -0.01, 0.035), [1, 1.04, 0.3]);
    add(pg, new THREE.SphereGeometry(0.055, 20, 14), shine, V(-0.065, 0.075, 0.1), [1, 1, 0.3]);
    add(pg, new THREE.SphereGeometry(0.022, 14, 10), shine, V(0.08, -0.07, 0.1), [1, 1, 0.3]);
    const hp = add(eg, happyArc(0.15, 0.1, 0.03), darkLine, V(0, -0.02, 0.06)); hp.visible = false;
    eyes.push(ei); pupils.push(pg); happy.push(hp);
    const bl = surf([sx * 0.58, -0.08, 0.82], 0.012);
    const bm = add(B, new THREE.CircleGeometry(0.17, 40), new THREE.MeshBasicMaterial({ map: blushTex('255,150,160', 0.85, 0.6), transparent: true, depthWrite: false, toneMapped: false }), bl.pos);
    bm.quaternion.copy(bl.q);
  }
  // ağız: gülümseme / O
  const ms = surf([0, -0.05, 1], 0.008);
  const mouth = new THREE.Group(); mouth.position.copy(ms.pos); mouth.quaternion.copy(ms.q); B.add(mouth);
  const smile = new THREE.Group(); mouth.add(smile);
  const sh = new THREE.Shape(); sh.moveTo(-0.12, 0.03); sh.quadraticCurveTo(0, 0.06, 0.12, 0.03); sh.bezierCurveTo(0.11, -0.1, -0.11, -0.1, -0.12, 0.03);
  add(smile, new THREE.ShapeGeometry(sh, 32), new THREE.MeshStandardMaterial({ color: 0x3a1420, roughness: 0.6 }));
  const tg = new THREE.Shape(); tg.moveTo(-0.07, -0.04); tg.quadraticCurveTo(0, 0, 0.07, -0.04); tg.bezierCurveTo(0.06, -0.085, -0.06, -0.085, -0.07, -0.04);
  add(smile, new THREE.ShapeGeometry(tg, 32), new THREE.MeshStandardMaterial({ color: 0xf27f8c, roughness: 0.5 }), V(0, 0, 0.002));
  const oM = new THREE.Group(); mouth.add(oM);
  add(oM, new THREE.CircleGeometry(0.08, 32), new THREE.MeshStandardMaterial({ color: 0x3a1420, roughness: 0.6 }), null, [0.9, 1.15, 1]);
  add(oM, new THREE.CircleGeometry(0.045, 24), new THREE.MeshStandardMaterial({ color: 0xf27f8c, roughness: 0.5 }), V(0, -0.04, 0.002), [1.1, 0.7, 1]);
  oM.visible = false;
  // püre lekeleri
  const splats = []; let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const sdirs = [[0.1, 0.95, 0.3], [-0.5, 0.7, 0.5], [0.6, 0.6, 0.45], [-0.75, 0.1, 0.6], [0.8, -0.2, 0.5], [0.0, -0.55, 0.85], [-0.3, 0.45, -0.7], [0.45, 0.2, 0.86], [-0.2, 0.75, 0.62]];
  for (const d of sdirs) {
    const s = surf(d, -0.03); const m = add(B, new THREE.SphereGeometry(0.16 + rnd() * 0.08, 24, 16), pureeMat, s.pos); m.quaternion.copy(s.q);
    m.userData.s = [1 + rnd() * 0.5, 0.8 + rnd() * 0.5, 0.3]; m.scale.set(0.001, 0.001, 0.001); splats.push(m);
  }
  const red = new THREE.Color(PUREE);
  return {
    root, squash, lean, B, arms, legs, eyes, pupils, happy, ant, smile, oM, mouth, blue,
    setMess(k) { blue.color.copy(blueBase).lerp(red, 0.86 * k); splats.forEach(m => { const s = m.userData.s; const kk = Math.max(0.001, k); m.scale.set(s[0] * kk, s[1] * kk, s[2] * kk); }); },
    setMouth(type, sc = 1) { smile.visible = type === 'smile'; oM.visible = type === 'o'; mouth.scale.set(sc, sc, 1); },
    setEyes(sc, blink = 0, happyOn = false, look = [0, 0]) {
      eyes.forEach((e, i) => { e.visible = !happyOn; e.scale.set(sc, sc * Math.max(0.08, 1 - blink), sc); pupils[i].position.set(look[0], look[1], 0); happy[i].visible = happyOn; });
    },
    setSquash(sy) { const sxz = 1 / Math.sqrt(sy); squash.scale.set(sxz, sy, sxz); },
    setArms(l, r, fwd = 0) { arms[0].rotation.set(-fwd, 0, -l); arms[1].rotation.set(-fwd, 0, r); },
    walk(phase, amp) { legs.forEach((lg, i) => { const ph = phase + i * Math.PI; lg.position.z = Math.sin(ph) * 0.22 * amp; lg.position.y = Math.max(0, Math.cos(ph)) * 0.16 * amp; }); },
  };
}

// ---------------------------------------------------------------- MOKO
export function buildMoko() {
  const oBase = new THREE.Color(0xf27d16);
  const orange = new THREE.MeshPhysicalMaterial({ color: oBase.clone(), roughness: 0.5, clearcoat: 0.2, clearcoatRoughness: 0.6 });
  const cream = new THREE.MeshPhysicalMaterial({ color: 0xfff1dc, roughness: 0.35, clearcoat: 0.5 });
  const brown = new THREE.MeshPhysicalMaterial({ color: 0x7a4a2a, roughness: 0.7 });
  const tooth = new THREE.MeshPhysicalMaterial({ color: 0xfff6ea, roughness: 0.3, clearcoat: 0.6 });
  const root = new THREE.Group();
  const legs = [];
  for (const x of [-0.5, 0.5]) for (const z of [-0.3, 0.32]) {
    const lg = new THREE.Group(); lg.position.set(x, 0.5, z); root.add(lg);
    add(lg, new THREE.CapsuleGeometry(0.19, 0.2, 8, 24), orange, V(0, -0.21, 0));
    add(lg, new THREE.SphereGeometry(1, 32, 24), orange, V(x * 0.02, -0.4, 0.05), [0.22, 0.11, 0.26]);
    lg.userData.front = z > 0; lg.userData.side = x; legs.push(lg);
  }
  const squash = new THREE.Group(); root.add(squash);
  const lean = new THREE.Group(); lean.position.y = 0.5; squash.add(lean);
  const B = new THREE.Group(); B.position.y = -0.5; lean.add(B);
  add(B, new RoundedBoxGeometry(1.75, 1.95, 1.35, 8, 0.45), orange, V(0, 1.38, 0));
  const eyes = [], pupils = [], brows = [], happy = [], eyeGroups = [];
  for (const sx of [-1, 1]) {
    const g = new THREE.Group(); g.position.set(sx * 0.43, 1.78, 0.6); B.add(g); eyeGroups.push(g);
    add(g, new THREE.TorusGeometry(0.385, 0.085, 20, 56), orange, V(0, 0, 0.05));
    const ei = new THREE.Group(); g.add(ei);
    add(ei, new THREE.SphereGeometry(0.39, 48, 36), cream, null, [1, 1, 0.55]);
    const pg = new THREE.Group(); ei.add(pg);
    add(pg, new THREE.SphereGeometry(0.29, 48, 36), black, V(sx * -0.015, -0.03, 0.14), [1, 1, 0.42]);
    add(pg, new THREE.SphereGeometry(0.07, 20, 14), shine, V(-0.08, 0.1, 0.27), [1, 1, 0.3]);
    add(pg, new THREE.SphereGeometry(0.032, 14, 10), shine, V(0.1, -0.1, 0.27), [1, 1, 0.3]);
    const hp = add(g, happyArc(0.2, 0.13, 0.04), darkLine, V(0, -0.05, 0.12)); hp.visible = false;
    const lid = add(g, new THREE.SphereGeometry(0.4, 40, 30), orange, V(0, 0, 0.02), [1, 1, 0.57]); lid.visible = false; lid.userData.lid = true;
    const bw = new THREE.Group(); bw.position.set(sx * 0.04, 0.45, 0.1); g.add(bw);
    add(bw, new THREE.CapsuleGeometry(0.075, 0.42, 8, 20), brown, null, [1, 1, 0.75], [0, 0, Math.PI / 2]);
    bw.userData.sx = sx;
    eyes.push(ei); pupils.push(pg); brows.push(bw); happy.push([hp, lid]);
  }
  const mouthC = new THREE.MeshStandardMaterial({ color: 0x5a2412, roughness: 0.6 });
  add(B, new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(-0.17, 1.235, 0.672), V(-0.08, 1.218, 0.684), V(0.08, 1.218, 0.684), V(0.17, 1.235, 0.672)]), 30, 0.016, 10, false), mouthC);
  const teeth = new THREE.Group(); B.add(teeth);
  for (const sx of [-1, 1]) add(teeth, new RoundedBoxGeometry(0.15, 0.21, 0.07, 5, 0.04), tooth, V(sx * 0.081, 1.13, 0.69), null, [0, 0, -sx * 0.04]);
  // dil (yalama)
  const tongue = new THREE.Group(); tongue.position.set(0, 1.08, 0.66); B.add(tongue);
  add(tongue, new THREE.CapsuleGeometry(0.11, 0.25, 8, 20), new THREE.MeshPhysicalMaterial({ color: 0xff7f95, roughness: 0.35, clearcoat: 0.5 }), V(0, -0.2, 0.03), [1, 1, 0.45]);
  tongue.scale.set(1, 0.001, 1); tongue.rotation.x = 0.35;
  for (const sx of [-1, 1]) add(B, new THREE.CircleGeometry(0.16, 36), new THREE.MeshBasicMaterial({ map: blushTex('255,120,110', 0.6, 0.35), transparent: true, depthWrite: false, toneMapped: false }), V(sx * 0.6, 1.28, 0.682));
  const splats = []; let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const spots = [[0.5, 2.33, 0.2, 'top'], [-0.45, 2.33, -0.1, 'top'], [0.0, 2.33, 0.35, 'top'], [-0.7, 0.95, 0.676, 'f'], [0.65, 0.75, 0.676, 'f'], [0.05, 0.6, 0.676, 'f'], [0.876, 1.6, 0.1, 'r'], [-0.876, 1.3, 0.2, 'l'], [0.0, 2.28, 0.4, 'top']];
  for (const [x, y, z, f] of spots) {
    const m = add(B, new THREE.SphereGeometry(0.17 + rnd() * 0.08, 24, 16), pureeMat, V(x, y, z));
    m.userData.s = f === 'top' ? [1.2 + rnd() * .4, 0.3, 1 + rnd() * .4] : f === 'f' ? [1 + rnd() * .4, 0.9 + rnd() * .5, 0.3] : [0.3, 1 + rnd() * .5, 1 + rnd() * .4];
    m.scale.set(0.001, 0.001, 0.001); splats.push(m);
  }
  const red = new THREE.Color(PUREE);
  return {
    root, squash, lean, B, legs, eyes, pupils, brows, teeth, tongue, orange,
    setMess(k) { orange.color.copy(oBase).lerp(red, 0.68 * k); splats.forEach(m => { const s = m.userData.s, kk = Math.max(0.001, k); m.scale.set(s[0] * kk, s[1] * kk, s[2] * kk); }); },
    setEyes(sc, blink = 0, happyOn = false, look = [0, 0]) {
      eyes.forEach((e, i) => { e.visible = !happyOn; e.scale.set(sc, sc * Math.max(0.06, 1 - blink), sc); pupils[i].position.set(look[0], look[1], 0); happy[i][0].visible = happyOn; happy[i][1].visible = happyOn; });
    },
    // worry: 0 düz, 1 endişeli; raise: kaş yukarı
    setBrows(worry, raise = 0) { brows.forEach(b => { const sx = b.userData.sx; b.rotation.z = -sx * 0.2 * worry; b.position.y = 0.45 + raise; }); },
    setTongue(k, wag = 0) { tongue.scale.set(1, Math.max(0.001, k), 1); tongue.rotation.x = 0.35 + wag; },
    setSquash(sy, puff = 1) { const sxz = 1 / Math.sqrt(sy); squash.scale.set(sxz * puff, sy, sxz); },
    walk(phase, amp) { legs.forEach(lg => { const ph = phase + (lg.userData.front ? 0 : Math.PI) + (lg.userData.side > 0 ? Math.PI : 0); lg.rotation.x = Math.sin(ph) * 0.7 * amp; lg.position.y = 0.5 + Math.max(0, Math.cos(ph)) * 0.1 * amp; }); },
  };
}

// ---------------------------------------------------------------- ÇİLEK
export function buildStrawberry(scale) {
  const grp = new THREE.Group();
  const spin = new THREE.Group(); grp.add(spin);
  const squash = new THREE.Group(); spin.add(squash);
  const g = new THREE.SphereGeometry(1, 96, 72); const p = g.attributes.position; const v = V(0, 0, 0);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); const u = (v.y + 1) / 2;
    const k = 0.5 + 0.55 * Math.pow(u, 0.6); let y = v.y * 1.08; if (y > 0.55) y = 0.55 + (y - 0.55) * 0.55;
    p.setXYZ(i, v.x * k, y - 0.05, v.z * k);
  }
  g.computeVertexNormals();
  const redMat = new THREE.MeshPhysicalMaterial({ color: 0xe8253c, roughness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.12, sheen: 0.3, sheenColor: 0xff8899 });
  const body = add(squash, g, redMat);
  // tohumlar
  const probe = new THREE.Mesh(g); probe.updateMatrixWorld(); const rc = new THREE.Raycaster();
  const N = 120; const seeds = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshPhysicalMaterial({ color: 0xffd84a, roughness: 0.3, clearcoat: 0.6 }), N);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = V(0.035, 0.055, 0.02);
  let n = 0;
  let sd = 3; const rr = () => (sd = (sd * 16807) % 2147483647) / 2147483647; const pts = [];
  for (let i = 0; i < 4000 && pts.length < N; i++) {
    const yy = -0.95 + rr() * 1.65, th = rr() * Math.PI * 2, r = Math.sqrt(1 - yy * yy);
    const d = V(Math.cos(th) * r, yy, Math.sin(th) * r);
    if (pts.some(o => o.distanceTo(d) < 0.27)) continue; pts.push(d);
    rc.set(d.clone().multiplyScalar(3), d.clone().negate()); const h = rc.intersectObject(probe)[0]; if (!h) continue;
    q.setFromUnitVectors(V(0, 0, 1), h.face.normal); m4.compose(h.point.clone().add(h.face.normal.clone().multiplyScalar(0.005)), q, sc); seeds.setMatrixAt(n++, m4);
  }
  seeds.count = n; squash.add(seeds);
  // yaprak tacı
  const crown = new THREE.Group(); crown.position.y = 0.62; squash.add(crown);
  const leaf = new THREE.MeshPhysicalMaterial({ color: 0x3cbf4a, roughness: 0.5, clearcoat: 0.3, side: THREE.DoubleSide });
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2; const lg = new THREE.Group(); lg.rotation.y = a; crown.add(lg);
    add(lg, new THREE.SphereGeometry(1, 20, 12), leaf, V(0.24, 0.0, 0), [0.28, 0.04, 0.1], [0, 0, -0.35]);
  }
  add(crown, new THREE.CylinderGeometry(0.035, 0.05, 0.26, 12), new THREE.MeshPhysicalMaterial({ color: 0x2e9a3a, roughness: 0.5 }), V(0, 0.13, 0), null, [0, 0, 0.2]);
  grp.scale.setScalar(scale);
  const bottom = 1.13 * scale; // merkezden alt uca
  return { grp, spin, squash, crown, body, bottom, redMat };
}
