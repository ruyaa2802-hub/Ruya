import * as THREE from 'three';

// ---------- shared helpers ----------
const ray = new THREE.Raycaster();

function deform(x, y, z, fat) {
  // unit sphere point -> strawberry shape
  let w;
  if (y > 0) w = 1 - 0.06 * Math.pow(y, 2);
  else w = 1 - 0.5 * Math.pow(-y, 1.9);
  let ny = y > 0 ? y * 0.86 : y * 1.08;
  if (y > 0.8) ny -= (y - 0.8) * 0.3;
  return new THREE.Vector3(x * w * fat.x, ny * fat.y, z * w * fat.z);
}

function bodyGeometry(fat, seed) {
  const g = new THREE.SphereGeometry(1, 160, 120);
  const p = g.attributes.position;
  const col = new Float32Array(p.count * 3);
  const base = new THREE.Color('#d8121d');
  const top = new THREE.Color('#f04a2a');
  const bot = new THREE.Color('#9e0a14');
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const v = deform(x, y, z, fat);
    // subtle organic lumps
    const n = 0.012 * Math.sin(7 * x + seed) * Math.sin(6 * y + 1.3 * seed) * Math.sin(5 * z + 0.7);
    v.multiplyScalar(1 + n);
    p.setXYZ(i, v.x, v.y, v.z);
    if (y > 0.55) c.copy(base).lerp(top, Math.min(1, (y - 0.55) * 1.6));
    else if (y < -0.3) c.copy(base).lerp(bot, Math.min(1, (-y - 0.3) * 1.4));
    else c.copy(base);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

function hitFrom(mesh, origin, dir) {
  let h = null;
  for (let t = 0; t < 6 && !h; t++) {
    const o = origin.clone().add(new THREE.Vector3(0.0013 * t, 0.0011 * t, 0.0017 * t));
    ray.set(o, dir.clone().normalize());
    h = ray.intersectObject(mesh, false)[0];
  }
  if (!h) return null;
  const n = h.face.normal.clone().transformDirection(mesh.matrixWorld);
  return { p: h.point.clone(), n };
}
// project from front (+z)
function front(mesh, x, y) {
  return hitFrom(mesh, new THREE.Vector3(x, y, 5), new THREE.Vector3(0, 0, -1));
}

function projectGeometry(mesh, geom, ox, oy, lift = 0.006) {
  const p = geom.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const h = front(mesh, p.getX(i) + ox, p.getY(i) + oy);
    if (h) { const q = h.p.addScaledVector(h.n, lift); p.setXYZ(i, q.x, q.y, q.z); }
  }
  p.needsUpdate = true;
  geom.computeVertexNormals();
  return geom;
}

function surfaceTube(mesh, pts2d, radius, mat, lift = 0.012) {
  const pts = pts2d.map(([x, y]) => { const h = front(mesh, x, y); return h.p.addScaledVector(h.n, lift); });
  const curve = new THREE.CatmullRomCurve3(pts);
  const g = new THREE.TubeGeometry(curve, 40, radius, 10, false);
  // taper ends
  const p = g.attributes.position;
  const segs = 41, radial = 11;
  for (let i = 0; i < segs; i++) {
    const t = i / (segs - 1);
    const k = Math.pow(Math.sin(Math.PI * t), 0.6) * 0.85 + 0.15;
    const c = curve.getPoint(t);
    for (let j = 0; j < radial; j++) {
      const idx = i * radial + j;
      const v = new THREE.Vector3(p.getX(idx), p.getY(idx), p.getZ(idx));
      v.sub(c).multiplyScalar(k).add(c);
      p.setXYZ(idx, v.x, v.y, v.z);
    }
  }
  g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}

function radialTexture(inner, outer) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, inner); gr.addColorStop(1, outer);
  x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const blushTex = radialTexture('rgba(255,120,140,0.85)', 'rgba(255,120,140,0)');

function leafGeometry(build) {
  // build(u,v) -> Vector3 ; u along length 0..1, v across -1..1
  const U = 24, V = 8;
  const pos = [], idx = [];
  for (let i = 0; i <= U; i++) for (let j = 0; j <= V; j++) {
    const u = i / U, v = j / V * 2 - 1;
    const q = build(u, v); pos.push(q.x, q.y, q.z);
  }
  for (let i = 0; i < U; i++) for (let j = 0; j < V; j++) {
    const a = i * (V + 1) + j, b = a + 1, c = a + V + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// ---------- materials ----------
function mats() {
  return {
    body: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.22, sheen: 0.4, sheenColor: new THREE.Color('#ff7a55'), sheenRoughness: 0.5 }),
    limb: new THREE.MeshPhysicalMaterial({ color: '#cc1420', roughness: 0.38, clearcoat: 0.5 }),
    seed: new THREE.MeshPhysicalMaterial({ color: '#f2c64a', roughness: 0.3, clearcoat: 0.8 }),
    dimple: new THREE.MeshStandardMaterial({ color: '#6e0710', roughness: 0.6, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }),
    leaf: new THREE.MeshPhysicalMaterial({ color: '#2f8a24', roughness: 0.4, sheen: 0.35, sheenColor: new THREE.Color('#bff59a'), side: THREE.DoubleSide, clearcoat: 0.2 }),
    stem: new THREE.MeshStandardMaterial({ color: '#3d7d2a', roughness: 0.6 }),
    white: new THREE.MeshPhysicalMaterial({ color: '#fbfbf8', roughness: 0.25, clearcoat: 1 }),
    pupil: new THREE.MeshStandardMaterial({ color: '#080303', roughness: 0.3 }),
    spec: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
    cornea: new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.0, transmission: 0, transparent: true, opacity: 0.12, clearcoat: 1 }),
    dark: new THREE.MeshStandardMaterial({ color: '#2a0508', roughness: 0.5 }),
    brow: new THREE.MeshStandardMaterial({ color: '#6a0a12', roughness: 0.6 }),
    mouth: new THREE.MeshStandardMaterial({ color: '#3d040c', roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 }),
    tongue: new THREE.MeshStandardMaterial({ color: '#ff6f86', roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -3 }),
    teeth: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3, polygonOffset: true, polygonOffsetFactor: -3 }),
    blush: new THREE.MeshBasicMaterial({ map: blushTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, opacity: 0.8 }),
    bow: new THREE.MeshPhysicalMaterial({ color: '#ff8fbd', roughness: 0.5, sheen: 1, sheenColor: new THREE.Color('#ffd6e8'), sheenRoughness: 0.4 }),
  };
}

// ---------- eye ----------
function makeEye(M, irisColor, opt) {
  const g = new THREE.Group();
  const R = opt.r, sy = opt.tall, sz = 0.55, zf = R * sz;
  const white = new THREE.Mesh(new THREE.SphereGeometry(R, 48, 32), M.white);
  white.scale.set(1, sy, sz); g.add(white);
  const irisMat = new THREE.MeshPhysicalMaterial({ color: irisColor, roughness: 0.25, clearcoat: 1 });
  const irisG = new THREE.Group(); g.add(irisG);
  const iris = new THREE.Mesh(new THREE.SphereGeometry(R * 0.7, 40, 24), irisMat);
  iris.scale.set(1, 1.05, 0.28); iris.position.set(0, -R * 0.05, zf * 0.78); irisG.add(iris);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R * 0.68, R * 0.035, 8, 48), M.dark);
  ring.scale.set(1, 1.05, 0.4); ring.position.set(0, -R * 0.05, R * 0.56); irisG.add(ring);
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(R * 0.38, 32, 16), M.pupil);
  pupil.scale.set(1, 1.05, 0.25); pupil.position.set(0, -R * 0.05, R * 0.55); irisG.add(pupil);
  // heart iris
  const hs = new THREE.Shape(); const k = R * 0.75;
  hs.moveTo(0, -0.9 * k); hs.bezierCurveTo(-1.3 * k, -0.1 * k, -0.7 * k, 0.95 * k, 0, 0.35 * k); hs.bezierCurveTo(0.7 * k, 0.95 * k, 1.3 * k, -0.1 * k, 0, -0.9 * k);
  const hg = new THREE.ExtrudeGeometry(hs, { depth: R * 0.08, bevelEnabled: true, bevelThickness: R * 0.06, bevelSize: R * 0.05, bevelSegments: 4, curveSegments: 24 });
  const heart = new THREE.Mesh(hg, new THREE.MeshPhysicalMaterial({ color: '#ff2d6a', roughness: 0.2, clearcoat: 1, emissive: '#ff1050', emissiveIntensity: 0.25 }));
  const heartG = new THREE.Group(); heartG.position.set(0, 0, R * 0.5); heartG.add(heart); g.add(heartG);
  // highlights stay fixed (light reflection)
  const s1 = new THREE.Mesh(new THREE.SphereGeometry(R * 0.17, 16, 12), M.spec);
  s1.scale.set(1, 1, 0.3); s1.position.set(-R * 0.24, R * 0.2, R * 0.66); g.add(s1);
  const s2 = new THREE.Mesh(new THREE.SphereGeometry(R * 0.08, 12, 8), M.spec);
  s2.scale.set(1, 1, 0.3); s2.position.set(R * 0.24, -R * 0.3, R * 0.66); g.add(s2);
  const cornea = new THREE.Mesh(new THREE.SphereGeometry(R * 1.02, 48, 32), M.cornea);
  cornea.scale.set(1, sy, sz * 1.12); g.add(cornea);
  // eyelid rig: hemisphere cap rotating around the eye's x axis
  const lidFrame = new THREE.Group(); lidFrame.scale.set(1, sy, sz * 1.25); g.add(lidFrame);
  const lidPivot = new THREE.Group(); lidFrame.add(lidPivot);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(R * 1.07, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), M.limb); lidPivot.add(cap);
  const edge = new THREE.Mesh(new THREE.TorusGeometry(R * 1.07, R * 0.045, 8, 64), M.dark); edge.rotation.x = Math.PI / 2; lidPivot.add(edge);
  if (opt.lashes) {
    const side = opt.side;
    for (let i = 0; i < 4; i++) {
      const a = 0.55 + i * 0.2;
      const p = V3(side * Math.sin(a) * R * 1.07, 0, Math.cos(a) * R * 1.07);
      const rad = p.clone().normalize();
      const mid = p.clone().addScaledVector(rad, R * 0.25).add(V3(0, R * 0.22, 0));
      const end = p.clone().addScaledVector(rad, R * 0.42).add(V3(0, R * 0.42 - i * R * 0.03, 0));
      lidPivot.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(p, mid, end), 10, R * 0.034, 6, false), M.dark));
    }
  }
  g.userData.set = ({ lx = 0, ly = 0, lid = 0, tilt = 0, shock = 0, heart: h = 0 }) => {
    const x = lx * R * 0.3, y = ly * R * 0.3;
    const dz = -zf * (1 - Math.sqrt(Math.max(0, 1 - (x / R) ** 2 - (y / (R * sy)) ** 2)));
    irisG.position.set(x, y, dz);
    const sc = (1 - 0.45 * shock) * (1 - h);
    irisG.scale.set(sc, sc, 1); irisG.visible = sc > 0.02;
    const hp = h <= 0 ? 0 : (h < 1 ? 1 + 2.7 * Math.pow(h - 1, 3) + 1.7 * Math.pow(h - 1, 2) : 1);
    heartG.visible = h > 0.01; heartG.scale.setScalar(Math.max(0.001, hp));
    lidPivot.rotation.x = -1.3 + lid * 2.93;
    lidFrame.rotation.z = tilt;
  };
  return g;
}
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------- build a character ----------
export function makeStrawberry(kind, expr = {}) {
  const M = mats();
  const root = new THREE.Group();
  const fat = kind === 'bey' ? new THREE.Vector3(1.1, 1.0, 1.04) : new THREE.Vector3(0.9, 1.06, 0.9);
  const body = new THREE.Mesh(bodyGeometry(fat, kind === 'bey' ? 1.3 : 2.7), M.body);
  body.castShadow = true; body.receiveShadow = true;
  root.add(body);
  body.updateMatrixWorld(true);
  const probe = new THREE.Mesh(body.geometry); probe.updateMatrixWorld(true);

  // ---- face layout
  const eyeX = kind === 'bey' ? 0.3 : 0.27, eyeY = 0.1;
  const faceSkip = (x, y, z) => z > 0.2 && Math.abs(x) < 0.62 && y > -0.42 && y < 0.38;

  // ---- seeds (instanced)
  const N = 420;
  const seedGeo = new THREE.SphereGeometry(1, 10, 8);
  const dimGeo = new THREE.CircleGeometry(1, 16);
  const seeds = new THREE.InstancedMesh(seedGeo, M.seed, N);
  const dims = new THREE.InstancedMesh(dimGeo, M.dimple, N);
  let k = 0;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  const golden = Math.PI * (3 - Math.sqrt(5));
  const jr = (a) => { const v = Math.sin(a * 12.9898) * 43758.5453; return v - Math.floor(v); };
  for (let i = 0; i < 700 && k < N; i++) {
    const y = 1 - (i / 699) * 2 + (jr(i) - 0.5) * 0.02;
    const r = Math.sqrt(1 - y * y), th = golden * i;
    const x = Math.cos(th + (jr(i + 7) - 0.5) * 0.12) * r, z = Math.sin(th + (jr(i + 7) - 0.5) * 0.12) * r;
    if (y > 0.72) continue;
    const dp = deform(x, y, z, fat);
    if (faceSkip(dp.x, dp.y, dp.z)) continue;
    const h = hitFrom(probe, dp.clone().multiplyScalar(3), dp.clone().negate());
    if (!h) continue;
    // orient: z->normal, y->tangent toward bottom tip
    const down = new THREE.Vector3(0, -1, 0);
    const tang = down.clone().sub(h.n.clone().multiplyScalar(down.dot(h.n))).normalize();
    const bin = new THREE.Vector3().crossVectors(tang, h.n);
    const basis = new THREE.Matrix4().makeBasis(bin, tang, h.n);
    q.setFromRotationMatrix(basis);
    s.set(0.017, 0.027, 0.012);
    m4.compose(h.p.clone().addScaledVector(h.n, -0.002), q, s); seeds.setMatrixAt(k, m4);
    s.set(0.03, 0.042, 1);
    m4.compose(h.p.clone().addScaledVector(h.n, 0.002), q, s); dims.setMatrixAt(k, m4);
    k++;
  }
  seeds.count = k; dims.count = k; seeds.castShadow = true;
  root.add(dims, seeds);


  // ================= animatable face =================
  const irisColor = kind === 'bey' ? '#3d7fbf' : '#4a2410';
  const R_EYE = kind === 'bey' ? 0.17 : 0.165;
  [-1, 1].forEach((side) => {
    const g = projectGeometry(probe, new THREE.CircleGeometry(0.13, 40, 0, Math.PI * 2), side * (eyeX + 0.1), -0.17, 0.004);
    root.add(new THREE.Mesh(g, M.blush));
  });
  const eyes = [-1, 1].map((side) => {
    const h = front(probe, side * eyeX, eyeY);
    const e = makeEye(M, irisColor, { r: R_EYE, tall: 1.18, lashes: kind === 'hanim', side });
    e.position.copy(h.p).addScaledVector(h.n, -0.035);
    e.lookAt(h.p.clone().add(h.n.clone().lerp(V3(0, 0, 1), 0.55).normalize()));
    root.add(e); return e;
  });
  const brows = [-1, 1].map((side) => {
    const cx = side * eyeX, cy = eyeY + 0.3, w = 0.13;
    const c = front(probe, cx, cy).p;
    const tube = surfaceTube(probe, [[cx - w, cy], [cx, cy + 0.035], [cx + w, cy]], kind === 'bey' ? 0.028 : 0.02, M.brow, 0.02);
    tube.geometry.translate(-c.x, -c.y, -c.z);
    const piv = new THREE.Group(); piv.position.copy(c); piv.add(tube); piv.userData.base = c.clone(); root.add(piv);
    return piv;
  });
  const mouthC = front(probe, 0, -0.27).p;
  const mouthRoot = new THREE.Group(); mouthRoot.position.copy(mouthC); root.add(mouthRoot);
  const mouths = {};
  function buildMouth(mk) {
    const g = new THREE.Group(); const my = -0.2; let mx = 0;
    const shape = new THREE.Shape(); let tongue = null;
    if (mk === 'smirk' || mk === 'smirkL') {
      const f = mk === 'smirk' ? 1 : -1; mx = 0.03 * f;
      shape.moveTo(-0.15 * f, -0.005); shape.quadraticCurveTo(0.0, -0.19, 0.17 * f, 0.06); shape.quadraticCurveTo(0.02 * f, -0.03, -0.15 * f, -0.005);
      tongue = [0.01 * f, -0.105, 0.06, 0.03];
    } else if (mk === 'O') { shape.absellipse(0, -0.05, 0.055, 0.075, 0, Math.PI * 2); tongue = [0, -0.1, 0.035, 0.02]; }
    else if (mk === 'flat') { shape.moveTo(-0.11, -0.04); shape.quadraticCurveTo(-0.05, -0.02, 0, -0.04); shape.quadraticCurveTo(0.05, -0.06, 0.11, -0.04); shape.lineTo(0.11, -0.058); shape.quadraticCurveTo(0.05, -0.078, 0, -0.058); shape.quadraticCurveTo(-0.05, -0.038, -0.11, -0.058); }
    else if (mk === 'frown') { shape.moveTo(-0.11, -0.08); shape.quadraticCurveTo(0, 0.0, 0.11, -0.08); shape.quadraticCurveTo(0, -0.03, -0.11, -0.08); }
    else if (mk === 'grin') { shape.moveTo(-0.14, 0.0); shape.quadraticCurveTo(0, -0.13, 0.14, 0.0); shape.quadraticCurveTo(0, -0.1, -0.14, 0.0); }
    else if (mk === 'talk') { shape.moveTo(-0.12, -0.02); shape.quadraticCurveTo(-0.1, -0.2, 0, -0.2); shape.quadraticCurveTo(0.1, -0.2, 0.12, -0.02); shape.quadraticCurveTo(0, -0.05, -0.12, -0.02); tongue = [0, -0.15, 0.055, 0.03]; }
    else { shape.moveTo(-0.14, 0.01); shape.quadraticCurveTo(0, -0.2, 0.14, 0.01); shape.quadraticCurveTo(0, -0.03, -0.14, 0.01); tongue = [0, -0.105, 0.06, 0.03]; }
    const add = (geo, mat) => { geo.translate(-mouthC.x, -mouthC.y, -mouthC.z); g.add(new THREE.Mesh(geo, mat)); };
    add(projectGeometry(probe, new THREE.ShapeGeometry(shape, 32), mx, my, 0.006), M.mouth);
    if (tongue) { const t = new THREE.Shape(); t.absellipse(tongue[0], tongue[1], tongue[2], tongue[3], 0, Math.PI * 2);
      add(projectGeometry(probe, new THREE.ShapeGeometry(t, 24), mx, my, 0.009), M.tongue); }
    return g;
  }
  let curMouth = null;
  const api = {
    eyes: (L, Rr) => { eyes[0].userData.set(L); eyes[1].userData.set(Rr); },
    brows: (up, tilt) => brows.forEach((b, i) => { const side = i ? 1 : -1; b.position.copy(b.userData.base).add(V3(0, up[i], 0)); b.rotation.z = Math.atan(tilt[i] * side / 0.13); }),
    mouth: (mk, open = 1, wide = 1) => {
      if (!mouths[mk]) { mouths[mk] = buildMouth(mk); mouthRoot.add(mouths[mk]); }
      if (curMouth && curMouth !== mouths[mk]) curMouth.visible = false;
      curMouth = mouths[mk]; curMouth.visible = true; mouthRoot.scale.set(wide, open, 1);
    },
  };
  // sweat drop
  const sweat = new THREE.Mesh(new THREE.SphereGeometry(0.06, 20, 16), new THREE.MeshPhysicalMaterial({ color: '#bfe8ff', roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.85 }));
  { const p = sweat.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y > 0) { const k2 = 1 - y / 0.06; p.setX(i, p.getX(i) * k2); p.setZ(i, p.getZ(i) * k2); p.setY(i, y * 2.2); } } sweat.geometry.computeVertexNormals(); }
  const sweatBase = (() => { const h = front(probe, 0.62, 0.42); return h.p.addScaledVector(h.n, 0.05); })();
  sweat.position.copy(sweatBase); sweat.visible = false; root.add(sweat);
  api.sweat = (v, slide = 0) => { sweat.visible = v; sweat.position.copy(sweatBase).add(V3(0.02 * slide, -0.25 * slide, 0)); };
  // crown (leaves/stem/bow) on a pivot so it can lag & jiggle
  const crownPivot = new THREE.Group(); const crown = new THREE.Group(); crownPivot.add(crown); root.add(crownPivot);
  api.crown = crownPivot;

  // ---- leaves (calyx)
  const topY = hitFrom(probe, new THREE.Vector3(0.003, 5, 0.002), new THREE.Vector3(0, -1, 0)).p.y;
  const surfY = (x, z) => { const h = hitFrom(probe, new THREE.Vector3(x, 5, z), new THREE.Vector3(0, -1, 0)); return h ? h.p.y : -9; };
  const nLeaves = 8;
  for (let i = 0; i < nLeaves; i++) {
    const phi = (i / nLeaves) * Math.PI * 2 + 0.2;
    const L = 0.85 + 0.1 * Math.sin(i * 2.3);
    const W = 0.25;
    const d = new THREE.Vector3(Math.sin(phi), 0, Math.cos(phi));
    const t = new THREE.Vector3(Math.cos(phi), 0, -Math.sin(phi));
    const geo = leafGeometry((u, v) => {
      const width = W * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.05)), 0.75) * (1 - 0.35 * u);
      const r = 0.03 + u * L;
      let y = topY + 0.04 + 0.1 * u - 0.6 * u * u;
      const px = d.x * r + t.x * v * width, pz = d.z * r + t.z * v * width;
      y = Math.max(y, surfY(px, pz) + 0.025 + 0.015 * u);
      y += Math.abs(v) * width * 0.35 + 0.025 * Math.sin(u * 9 + i) * u; // cupped & wavy
      return new THREE.Vector3(px, y, pz);
    });
    const leaf = new THREE.Mesh(geo, M.leaf); leaf.castShadow = true; crown.add(leaf);
  }
  // hair / upright leaves for bey, small crown for hanim
  const upright = kind === 'bey' ? [[-0.5, 0.5, 0.9], [-0.1, 0.6, 1.0], [0.3, 0.55, 0.85], [0.7, 0.42, 0.7]] : [[-0.3, 0.26, 0.6], [0.3, 0.26, 0.6]];
  upright.forEach(([phi, L, lean], i) => {
    const W = 0.15;
    const geo = leafGeometry((u, v) => {
      const width = W * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.05)), 0.8) * (1 - 0.3 * u);
      const up = u * L;
      const sweep = (kind === 'bey' ? 0.35 : 0) * u * u; // quiff sweeping to the right
      const x = Math.sin(phi) * up * 0.4 * lean + sweep + Math.cos(phi) * v * width;
      const z = Math.cos(phi) * up * 0.25 * lean + Math.sin(phi) * v * width * -0.3 + 0.05;
      const y = topY + 0.02 + up * 0.95 - 0.25 * u * u * L;
      return new THREE.Vector3(x, y, z - 0.05 + Math.abs(v) * width * 0.4);
    });
    const leaf = new THREE.Mesh(geo, M.leaf); leaf.castShadow = true; crown.add(leaf);
  });
  const stem = new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(0, topY - 0.02, 0), new THREE.Vector3(0.02, topY + 0.14, 0), new THREE.Vector3(-0.06, topY + 0.22, -0.02)), 12, 0.035, 10, false), M.stem);
  crown.add(stem);

  // ---- bow (hanim)
  if (kind === 'hanim') {
    const h = hitFrom(probe, new THREE.Vector3(-0.55, 0.62, 0.4).multiplyScalar(4), new THREE.Vector3(0.55, -0.62, -0.4));
    const bow = new THREE.Group();
    const lobeG = new THREE.SphereGeometry(0.12, 32, 24);
    [-1, 1].forEach((sd) => {
      const lobe = new THREE.Mesh(lobeG, M.bow); lobe.scale.set(1.15, 0.75, 0.42);
      lobe.position.set(sd * 0.12, 0, 0); lobe.rotation.z = sd * 0.25; lobe.castShadow = true; bow.add(lobe);
      const tail = new THREE.Mesh(lobeG, M.bow); tail.scale.set(0.35, 0.8, 0.25);
      tail.position.set(sd * 0.06, -0.1, -0.01); tail.rotation.z = sd * 0.5; bow.add(tail);
    });
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.055, 24, 16), M.bow); knot.scale.set(1, 1, 0.8); bow.add(knot);
    bow.position.copy(h.p).addScaledVector(h.n, 0.07);
    bow.lookAt(h.p.clone().add(h.n)); bow.rotateZ(-0.4); bow.scale.setScalar(1.7);
    crown.add(bow);
  }


  crownPivot.position.set(0, topY, 0); crown.position.set(0, -topY, 0);
  // ================= arms (two-bone rig) =================
  const armRig = [-1, 1].map((side) => {
    const h = hitFrom(probe, new THREE.Vector3(side * 4, -0.12, 0.1), new THREE.Vector3(-side, 0, 0));
    const sh = new THREE.Group(); sh.position.copy(h.p).addScaledVector(h.n, -0.02); root.add(sh);
    const up = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.17, 6, 12), M.limb); up.position.y = -0.1; up.castShadow = true; sh.add(up);
    const el = new THREE.Group(); el.position.y = -0.2; sh.add(el);
    const fo = new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.16, 6, 12), M.limb); fo.position.y = -0.1; fo.castShadow = true; el.add(fo);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.085, 24, 16), M.limb); hand.position.y = -0.22; hand.scale.set(1, 0.9, 0.85); hand.castShadow = true; el.add(hand);
    const th = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 10), M.limb); th.position.set(-side * 0.055, -0.2, 0.05); el.add(th);
    return { sh, el, side };
  });
  api.arm = (i, { sz, sx, eb }) => { const a = armRig[i]; a.sh.rotation.set(-sx, 0, a.side * sz); a.el.rotation.set(0, 0, -a.side * eb); };

  if (kind === 'bey') {
    // price sticker with barcode + syringe icon (no text)
    const c = document.createElement('canvas'); c.width = 256; c.height = 160; const x = c.getContext('2d');
    x.fillStyle = '#fffdf6'; x.beginPath(); x.roundRect(4, 4, 248, 152, 26); x.fill();
    x.strokeStyle = '#d33'; x.lineWidth = 6; x.stroke();
    x.fillStyle = '#111'; let bx = 26; for (let i = 0; i < 26; i++) { const w = [3, 5, 2, 6][i % 4]; x.fillRect(bx, 34, w, 92); bx += w + 3; }
    // syringe icon
    x.save(); x.translate(200, 80); x.rotate(-0.7); x.fillStyle = '#e33'; x.fillRect(-36, -11, 52, 22); x.fillStyle = '#fff'; x.fillRect(-30, -6, 30, 12);
    x.fillStyle = '#e33'; x.fillRect(16, -3, 22, 6); x.fillRect(-46, -16, 8, 32); x.fillRect(-52, -4, 8, 8); x.restore();
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const pg = new THREE.PlaneGeometry(0.3, 0.19, 8, 6);
    const h = hitFrom(probe, new THREE.Vector3(4, -0.28, 1.4), new THREE.Vector3(-1, 0, -0.35));
    const st = new THREE.Mesh(pg, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 }));
    st.position.copy(h.p).addScaledVector(h.n, 0.012); st.lookAt(h.p.clone().add(h.n)); st.rotateZ(0.15);
    root.add(st); api.sticker = st;
  }


  // ---- legs & shoes
  const botY = hitFrom(probe, new THREE.Vector3(0.003, -5, 0.002), new THREE.Vector3(0, 1, 0)).p.y;
  const shoeMat = new THREE.MeshPhysicalMaterial({ color: kind === 'bey' ? '#f7f7f7' : '#ff8fb8', roughness: 0.35, clearcoat: 0.6 });
  const soleMat = new THREE.MeshStandardMaterial({ color: kind === 'bey' ? '#d01a26' : '#e2558e', roughness: 0.5 });
  const legLen = 0.3;
  const feetY = botY - legLen + 0.1;
  [-1, 1].forEach((side) => {
    const x = side * 0.17;
    const sy = hitFrom(probe, new THREE.Vector3(x, -5, 0.02), new THREE.Vector3(0, 1, 0)).p.y + 0.05;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.065, sy - feetY, 14), M.limb);
    leg.position.set(x, (sy + feetY) / 2, 0.02); leg.castShadow = true; root.add(leg);
    const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.12, 28, 18), shoeMat);
    shoe.scale.set(0.95, 0.6, 1.45); shoe.position.set(x + side * 0.02, feetY, 0.08); shoe.castShadow = true; root.add(shoe);
    const sole = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.03, 28), soleMat);
    sole.scale.set(0.95, 1, 1.45); sole.position.set(x + side * 0.02, feetY - 0.055, 0.08); root.add(sole);
  });
  root.userData = { feetY: feetY - 0.07, api };
  return root;
}