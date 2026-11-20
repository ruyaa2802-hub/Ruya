import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { makeHuman, phys, PAL } from './human.js';

const W = 720, H = 1280;
const T = { s2: 4.75, s3: 10.25, s4: 20.15, s5: 27.15, end: 33.4, total: 35 };
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ease = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const k = (t, a, b) => ease((t - a) / (b - a));
const lerp = (a, b, u) => a + (b - a) * u;
const S = (t, f, p = 0) => Math.sin(t * f + p);
const vl = (a, b, u) => a.clone().lerp(b, u);
function blinkAt(t, list) { let b = 0; for (const s0 of list) { const d = t - s0; if (d >= 0 && d < 0.2) b = Math.max(b, d < 0.07 ? d / 0.07 : 1 - (d - 0.07) / 0.13); } return b; }

await document.fonts.load('800 60px Nunito'); await document.fonts.load('700 40px Nunito');

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H); renderer.setPixelRatio(1);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
const ENV = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;

// ---------- textures
function canvasTex(w, h, draw, srgb = true) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
const DOT = canvasTex(64, 64, (x) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); });
const STAR = canvasTex(64, 64, (x) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,240,200,0.5)'); g.addColorStop(1, 'rgba(255,240,200,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); x.fillStyle = '#fff'; x.beginPath(); x.moveTo(32, 2); x.quadraticCurveTo(34, 30, 62, 32); x.quadraticCurveTo(34, 34, 32, 62); x.quadraticCurveTo(30, 34, 2, 32); x.quadraticCurveTo(30, 30, 32, 2); x.fill(); });
function sprites(scene, n, tex, color, size, additive = false) {
  const arr = []; for (let i = 0; i < n; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending })); s.scale.setScalar(size); scene.add(s); arr.push(s); } return arr;
}
function baseLights(sc, o = {}) {
  sc.environment = ENV; sc.environmentIntensity = o.env ?? 0.45;
  sc.add(new THREE.HemisphereLight(o.sky || '#fff3e4', o.ground || '#8a6a5a', o.hemi ?? 0.9));
  const key = new THREE.DirectionalLight(o.keyCol || '#fff0dc', o.key ?? 2.0); key.position.copy(o.keyPos || V(-4, 6, 8)); key.target.position.copy(o.keyTarget || V(0, -1, 0));
  key.castShadow = true; key.shadow.mapSize.set(1536, 1536); key.shadow.radius = 4; key.shadow.bias = -0.0005; Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 0.5, far: 40 });
  sc.add(key, key.target);
  const rim = new THREE.DirectionalLight(o.rimCol || '#ffe0c0', o.rim ?? 1.0); rim.position.set(3, 4, -6); sc.add(rim);
  return key;
}
const M = (c, o) => phys(c, o);
const box = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; };
const cyl = (rt, rb, h, mat, x, y, z, seg = 32) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; };
const sph = (r, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 24), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; };

// ---------- props
function perfume() {
  const g = new THREE.Group();
  const glass = new THREE.MeshPhysicalMaterial({ color: '#f2a6bd', roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.72, metalness: 0 });
  const b = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.33, 0.62, 8), glass); b.castShadow = true; g.add(b);
  const liq = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.27, 0.4, 8), M('#e5779a', { roughness: 0.2, transparent: true, opacity: 0.8 })); liq.position.y = -0.08; g.add(liq);
  const gold = M('#d8a64a', { metalness: 0.8, roughness: 0.25 });
  g.add(cyl(0.1, 0.12, 0.18, gold, 0, 0.4, 0));
  const tube = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.025, 8, 24, Math.PI * 0.9), gold); tube.position.set(0.22, 0.5, 0); g.add(tube);
  const bulb = sph(0.13, M('#87596f', { roughness: 0.6, sheen: 1 }), 0.44, 0.38, 0); g.add(bulb);
  const tas = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.22, 12), gold); tas.position.set(0.44, 0.15, 0); g.add(tas);
  g.userData.nozzle = V(0, 0.55, 0); return g;
}
function flower() {
  const g = new THREE.Group();
  const stemCurve = new THREE.QuadraticBezierCurve3(V(0, -0.1, 0), V(0.05, 0.4, 0), V(-0.15, 0.9, 0.05));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(stemCurve, 16, 0.035, 8), M('#5f8f4c')));
  const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 10), M('#7fae63')); leaf.scale.set(1.4, 0.4, 0.6); leaf.position.set(0.18, 0.35, 0); leaf.rotation.z = 0.5; g.add(leaf);
  const bloom = new THREE.Group(); bloom.position.set(-0.15, 0.95, 0.05); g.userData.top = bloom; g.add(bloom);
  for (let i = 0; i < 8; i++) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), M(i % 2 ? '#f4b2bf' : '#f7c7cf', { roughness: 0.5, sheen: 1, sheenColor: new THREE.Color('#fff') })); p.scale.set(0.55, 1.2, 0.25); const a = i / 8 * Math.PI * 2; p.position.set(Math.sin(a) * 0.16, Math.cos(a) * 0.16, 0); p.rotation.z = -a; bloom.add(p); }
  bloom.add(sph(0.08, M('#e8b440', { roughness: 0.5 }), 0, 0, 0.05));
  bloom.rotation.x = -0.4; g.userData.bloom = bloom; return g;
}

// =============================================================== SCENE 1 — perfume
function makeS1() {
  const sc = new THREE.Scene(); sc.background = new THREE.Color('#e6d3bd');
  baseLights(sc, { key: 1.9 });
  const wallTex = canvasTex(512, 512, (x) => { x.fillStyle = '#ead8c2'; x.fillRect(0, 0, 512, 512); x.fillStyle = '#e1cbb1'; for (let i = 0; i < 8; i++) x.fillRect(i * 64, 0, 32, 512); x.fillStyle = '#d4b998'; for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { x.beginPath(); x.arc(i * 64 + 48, j * 64 + (i % 2) * 32 + 16, 4, 0, 7); x.fill(); } });
  wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping; wallTex.repeat.set(4, 3);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(30, 22), new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.95 })); wall.position.z = -3.2; wall.receiveShadow = true; sc.add(wall);
  const mirror = new THREE.Group(); mirror.position.set(0, 1.0, -3.05); sc.add(mirror);
  const fr = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.15, 16, 72), M('#c99a5b', { metalness: 0.5, roughness: 0.35 })); fr.scale.set(1, 1.25, 1); mirror.add(fr);
  const gl = new THREE.Mesh(new THREE.CircleGeometry(2.0, 72), M('#d6e4e4', { metalness: 0.9, roughness: 0.1 })); gl.scale.set(1, 1.25, 1); gl.position.z = -0.02; mirror.add(gl);
  const wood = M('#b98a5f', { roughness: 0.6, sheen: 0 }), woodDk = M('#93694a', { roughness: 0.65, sheen: 0 });
  sc.add(box(8, 0.3, 2.4, wood, 0, -2.7, -1.9), box(7.6, 3, 2.2, woodDk, 0, -4.35, -1.95));
  for (const x of [-2.4, 2.4]) sc.add(sph(0.08, M('#d8a64a', { metalness: 0.7, roughness: 0.3 }), x, -3.3, -0.83));
  // lamp
  const lamp = new THREE.Group(); lamp.position.set(3.0, -2.55, -1.6); sc.add(lamp);
  lamp.add(cyl(0.35, 0.4, 0.1, woodDk, 0, 0, 0), cyl(0.05, 0.05, 1.2, woodDk, 0, 0.6, 0));
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 0.8, 40, 1, true), M('#e3b45c', { side: THREE.DoubleSide, emissive: '#ffc977', emissiveIntensity: 0.35 })); shade.position.y = 1.45; lamp.add(shade);
  const pl = new THREE.PointLight('#ffcf8a', 10, 9); pl.position.set(3.0, -1.2, -1.4); sc.add(pl);
  // little bottles
  [[-2.9, '#9fc0d6', 0.32], [-2.4, '#b7d3b0', 0.26], [-3.3, '#e3b45c', 0.22]].forEach(([x, c, r]) => {
    sc.add(cyl(r, r, 0.75, new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.8 }), x, -2.17, -1.6, 12));
    sc.add(cyl(0.08, 0.08, 0.2, M('#d8a64a', { metalness: 0.7, roughness: 0.3 }), x, -1.7, -1.6));
  });
  const h = makeHuman('adult'); h.root.rotation.y = -0.06; sc.add(h.root);
  const bottle = perfume(); bottle.position.set(-0.05, 0.42, 0.05); h.holder(1).add(bottle);
  const scent = sprites(sc, 18, DOT, '#f4a7c0', 0.16);
  const sparks = sprites(sc, 34, STAR, '#ffe2a0', 0.22, true);
  const cam = new THREE.PerspectiveCamera(32, W / H, 0.1, 100);
  return {
    sc, cam, update(t) {
      const u = k(t, 0.15, 0.75);
      h.arm(1, vl(V(1.3, -3.3, 0.4), V(0.62, -1.02, 1.05), u), V(1, -1, -0.2));
      h.arm(0, V(-1.3, -3.3, 0.4));
      const closed = k(t, 1.45, 1.85);
      h.face({ lid: [lerp(0.12, 1, closed), lerp(0.12, 1, closed)].map((l) => Math.max(l, blinkAt(t, [0.5]))), look: t < 1.0 ? [0.5, -0.4] : [0, 0],
        smile: lerp(0.45, 0.95, k(t, 1.6, 2.4)), open: t > 0.6 && t < 1.25 ? 1 : 0, brow: closed * 0.6, blush: k(t, 1.8, 3.0) });
      h.pose({ tilt: lerp(0, -0.12, k(t, 1.4, 2.6)) + 0.02 * S(t, 1.2), nod: t > 0.6 && t < 1.3 ? -0.06 : 0.03 * k(t, 1.5, 2.5), breathe: S(t, 2.4) });
      sc.updateMatrixWorld(true);
      const noz = bottle.localToWorld(bottle.userData.nozzle.clone()); const nose = h.root.localToWorld(V(0, -0.15, 1.0));
      const sa = k(t, 0.55, 0.9) * (1 - k(t, 2.2, 3.0));
      scent.forEach((s, i) => { const ph = (t * 0.6 + i / scent.length) % 1; const p = vl(noz, nose, ph); p.x += 0.12 * Math.sin(ph * 9 + i); p.y += 0.25 * Math.sin(ph * Math.PI) + 0.06 * Math.sin(ph * 13 + i); s.position.copy(p); s.material.opacity = sa * Math.sin(Math.PI * ph) * 0.9; s.scale.setScalar(0.1 + 0.1 * ph); });
      const mem = k(t, 2.0, 4.0);
      sparks.forEach((s, i) => { const a = i * 2.399 + t * (0.5 + (i % 3) * 0.15); const r = 1.5 + (i % 5) * 0.22; s.position.set(Math.cos(a) * r, 0.2 + Math.sin(a * 1.3 + i) * 0.9, Math.sin(a) * r * 0.6 + 0.3); s.material.opacity = mem * (0.5 + 0.5 * S(t, 4 + (i % 3), i)); s.scale.setScalar(0.12 + (i % 4) * 0.05); });
      const z = lerp(10.2, 9.2, k(t, 0, 5.3));
      cam.position.set(0.25 + 0.03 * S(t, 0.7), -0.55 + 0.02 * S(t, 0.9), z); cam.lookAt(0, -0.6, 0);
    },
  };
}

// =============================================================== SCENE 2 — grandmother's kitchen
function curtain(w, h, color) {
  const tex = canvasTex(128, 128, (x) => { x.fillStyle = color; x.fillRect(0, 0, 128, 128); x.fillStyle = 'rgba(255,255,255,0.35)'; for (let i = 0; i < 4; i++) x.fillRect(i * 32 + 10, 0, 10, 128); });
  tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(2, 1);
  const g = new THREE.PlaneGeometry(w, h, 14, 24); const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.9 }));
  m.castShadow = true; m.userData.base = g.attributes.position.array.slice(); return m;
}
function waveCurtain(m, t, amp, ph) {
  const p = m.geometry.attributes.position, b = m.userData.base; const h = m.geometry.parameters.height;
  for (let i = 0; i < p.count; i++) { const x = b[i * 3], y = b[i * 3 + 1]; const d = (h / 2 - y) / h; p.setZ(i, Math.sin(x * 9 + ph) * 0.06 + amp * d * d * Math.sin(t * 1.4 + ph + x * 2)); p.setX(i, x + amp * 0.3 * d * Math.sin(t * 1.1 + ph)); }
  p.needsUpdate = true; m.geometry.computeVertexNormals();
}
function makeS2() {
  const sc = new THREE.Scene(); sc.background = new THREE.Color('#efd5ab');
  const key = baseLights(sc, { key: 2.3, keyCol: '#ffe2b0', keyPos: V(5, 6, -1), keyTarget: V(-1, -2, 1), hemi: 1.0, env: 0.4 });
  const wallM = new THREE.MeshStandardMaterial({ color: '#f0d9b2', roughness: 0.95 });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(30, 22), wallM); wall.position.z = -4; wall.receiveShadow = true; sc.add(wall);
  const floorTex = canvasTex(256, 256, (x) => { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? '#d9c3a3' : '#f1e4cf'; x.fillRect(i * 64, j * 64, 64, 64); } });
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(8, 8);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.6 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -4.2; floor.receiveShadow = true; sc.add(floor);
  // window
  const sky = canvasTex(256, 256, (x) => { const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#bfe0ea'); g.addColorStop(1, '#fff2cf'); x.fillStyle = g; x.fillRect(0, 0, 256, 256); x.fillStyle = '#9cc58b'; x.beginPath(); x.moveTo(0, 200); x.quadraticCurveTo(80, 150, 160, 190); x.quadraticCurveTo(220, 215, 256, 180); x.lineTo(256, 256); x.lineTo(0, 256); x.fill(); x.fillStyle = '#fff6c8'; x.beginPath(); x.arc(180, 70, 30, 0, 7); x.fill(); });
  const win = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.8), new THREE.MeshBasicMaterial({ map: sky, toneMapped: false })); win.position.set(2.4, 1.5, -3.97); sc.add(win);
  const frameM = M('#f7efe2', { roughness: 0.6 });
  for (const [w, h, x, y] of [[2.7, 0.15, 2.4, 2.9], [2.7, 0.2, 2.4, 0.1], [0.15, 2.9, 1.1, 1.5], [0.15, 2.9, 3.7, 1.5], [0.1, 2.8, 2.4, 1.5], [2.5, 0.1, 2.4, 1.5]]) sc.add(box(w, h, 0.15, frameM, x, y, -3.92));
  const cL = curtain(1.2, 3.4, '#e79f95'), cR = curtain(1.2, 3.4, '#e79f95'); cL.position.set(0.85, 1.4, -3.7); cR.position.set(3.95, 1.4, -3.7); sc.add(cL, cR);
  sc.add(cyl(0.05, 0.05, 4.2, M('#93694a'), 2.4, 3.15, -3.7)); sc.children[sc.children.length - 1].rotation.z = Math.PI / 2;
  // tiles
  const tiles = canvasTex(256, 128, (x) => { for (let i = 0; i < 8; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? '#f7ecd8' : '#cfe0da'; x.fillRect(i * 32 + 1, j * 32 + 1, 30, 30); } });
  const tl = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 2.2), new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.3 })); tl.position.set(-1.6, -1.3, -3.95); sc.add(tl);
  // rail + utensils
  const rail = cyl(0.05, 0.05, 3.4, M('#93694a'), -2.0, 2.7, -3.7); rail.rotation.z = Math.PI / 2; sc.add(rail);
  const utensils = [];
  [[-3.3, 'pan', '#d4826b'], [-2.5, 'ladle'], [-1.7, 'pan', '#8fa9bd'], [-0.9, 'ladle']].forEach(([x, kind, c], i) => {
    const g = new THREE.Group(); g.position.set(x, 2.7, -3.65); sc.add(g); utensils.push(g);
    if (kind === 'pan') { g.add(box(0.1, 0.6, 0.06, M('#93694a'), 0, -0.35, 0)); const d = cyl(0.42, 0.42, 0.1, M(c, { metalness: 0.3, roughness: 0.35 }), 0, -1.05, 0.02, 40); d.rotation.x = Math.PI / 2; g.add(d); }
    else { g.add(cyl(0.035, 0.035, 0.9, M('#c8c0b6', { metalness: 0.8, roughness: 0.3 }), 0, -0.5, 0)); const b = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M('#c8c0b6', { metalness: 0.8, roughness: 0.3, side: THREE.DoubleSide })); b.position.y = -0.95; g.add(b); }
  });
  // clock + pendulum
  const clock = new THREE.Group(); clock.position.set(0.0, 2.35, -3.85); sc.add(clock);
  const face = cyl(0.55, 0.55, 0.1, M('#fbf3e3'), 0, 0, 0, 48); face.rotation.x = Math.PI / 2; clock.add(face);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.06, 10, 48), M('#c99a5b', { metalness: 0.4 })); clock.add(rim);
  const hh = box(0.05, 0.3, 0.03, M('#3d2e2a'), 0, 0.15, 0.07), mh = box(0.04, 0.42, 0.03, M('#3d2e2a'), 0, 0.21, 0.08); const hp = new THREE.Group(), mp = new THREE.Group(); hp.add(hh); mp.add(mh); hp.position.z = 0.0; clock.add(hp, mp);
  const pend = new THREE.Group(); pend.position.set(0, -0.55, 0.02); clock.add(pend); pend.add(box(0.04, 0.9, 0.03, M('#93694a'), 0, -0.45, 0), sph(0.13, M('#e0ac4f', { metalness: 0.6, roughness: 0.3 }), 0, -0.95, 0));
  // shelf + jars
  sc.add(box(2.6, 0.12, 0.5, M('#93694a'), -2.3, 0.95, -3.75));
  ['#d4826b', '#e0ac4f', '#86a79c', '#e79a9a'].forEach((c, i) => { sc.add(cyl(0.22, 0.22, 0.55, M(c, { roughness: 0.4, clearcoat: 0.6 }), -3.2 + i * 0.6, 1.3, -3.7, 24)); sc.add(cyl(0.24, 0.24, 0.1, M('#f4ece0'), -3.2 + i * 0.6, 1.62, -3.7, 24)); });
  // counter/stove
  sc.add(box(3.4, 1.9, 1.7, M('#e7dccb', { roughness: 0.7 }), -1.3, -3.3, -0.7), box(3.6, 0.18, 1.9, M('#cbbba5', { roughness: 0.4 }), -1.3, -2.3, -0.7));
  sc.add(box(2.2, 1.0, 0.05, M('#3f3936', { roughness: 0.15, clearcoat: 1 }), -1.3, -3.35, 0.16));
  for (let i = 0; i < 4; i++) sc.add(sph(0.09, M('#3d2e2a'), -2.3 + i * 0.55, -2.6, 0.18));
  const pot = new THREE.Group(); pot.position.set(-0.95, -1.85, -0.55); sc.add(pot);
  pot.add(cyl(0.72, 0.65, 0.8, M('#6d8aa1', { metalness: 0.25, roughness: 0.35, clearcoat: 0.6 }), 0, 0, 0, 48));
  const rimP = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.05, 10, 48), M('#8fa9bd', { metalness: 0.3 })); rimP.rotation.x = Math.PI / 2; rimP.position.y = 0.4; pot.add(rimP);
  const soup = cyl(0.68, 0.68, 0.02, M('#d98a4a', { roughness: 0.3, clearcoat: 1 }), 0, 0.33, 0, 48); pot.add(soup);
  for (const s of [-1, 1]) { const hd = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.04, 8, 16, Math.PI), M('#3d2e2a')); hd.position.set(s * 0.78, 0.2, 0); hd.rotation.z = -s * Math.PI / 2; pot.add(hd); }
  const steam = sprites(sc, 14, DOT, '#ffffff', 0.5);
  // grandma
  const g = makeHuman('grandma'); g.root.position.set(-1.05, 0.25, -1.75); g.root.scale.setScalar(0.95); g.root.rotation.y = 0.22; sc.add(g.root);
  const spoon = cyl(0.045, 0.045, 1.5, M('#a8774f', { roughness: 0.6 }), 0, 0, 0, 12); sc.add(spoon);
  // table + child
  sc.add(box(2.4, 0.14, 2.0, M('#b98a5f', { roughness: 0.5 }), 1.55, -2.75, 0.4));
  const clothTex = canvasTex(128, 128, (x) => { x.fillStyle = '#e8a59a'; x.fillRect(0, 0, 128, 128); x.fillStyle = 'rgba(255,255,255,0.4)'; for (let i = 0; i < 8; i++) { x.fillRect(i * 16, 0, 8, 128); x.fillRect(0, i * 16, 128, 8); } });
  const tc = box(2.5, 1.3, 2.1, new THREE.MeshStandardMaterial({ map: clothTex, roughness: 0.9 }), 1.55, -3.45, 0.4); sc.add(tc);
  const plate = cyl(0.42, 0.36, 0.05, M('#ffffff', { roughness: 0.2, clearcoat: 1 }), 1.15, -2.65, 0.85, 40); sc.add(plate);
  for (const [dx, dz] of [[-0.12, 0], [0.12, 0.05], [0, -0.13]]) sc.add(cyl(0.13, 0.13, 0.05, M('#d9a25a', { roughness: 0.8 }), 1.15 + dx, -2.6, 0.85 + dz, 20));
  const c = makeHuman('child'); c.root.position.set(1.6, -1.0, -0.35); c.root.scale.setScalar(0.52); c.root.rotation.y = -0.5; sc.add(c.root);
  const motes = sprites(sc, 26, DOT, '#fff3cc', 0.07, true);
  const cam = new THREE.PerspectiveCamera(38, W / H, 0.1, 100);
  return {
    sc, cam, update(t) {
      utensils.forEach((u, i) => { u.rotation.z = 0.07 * S(t, 1.7, i * 1.3); });
      const sw = 0.32 * Math.sin(t * 3.1); pend.rotation.z = sw; mp.rotation.z = -t * 0.6; hp.rotation.z = -t * 0.05 - 1;
      waveCurtain(cL, t, 0.18, 0); waveCurtain(cR, t, 0.18, 1.7);
      // grandma stirring
      sc.updateMatrixWorld(true);
      const a = t * 3.0; const spoonTop = V(-0.95 + Math.cos(a) * 0.32, -0.95, -0.55 + Math.sin(a) * 0.22);
      const tip = V(-0.95 + Math.cos(a) * 0.22, -1.7, -0.55 + Math.sin(a) * 0.15);
      g.arm(1, g.root.worldToLocal(spoonTop.clone()), V(1, -1, -0.6)); g.arm(0, g.root.worldToLocal(V(-2.1, -2.2, -0.3)), V(-1, -1, -0.3));
      spoon.position.copy(spoonTop).add(tip).multiplyScalar(0.5); spoon.quaternion.setFromUnitVectors(V(0, 1, 0), spoonTop.clone().sub(tip).normalize());
      g.face({ lid: [0.42, 0.42].map((l) => Math.max(l, blinkAt(t, [6.2, 8.7]))), look: [0.55, -0.3], smile: 0.95, blush: 0.6 });
      g.pose({ tilt: 0.06 * S(t, 1.4), nod: 0.05 + 0.03 * S(t, 2.0), breathe: S(t, 2.2) });
      // child
      const happy = k(t, 7.2, 7.6);
      c.face({ lid: [lerp(0.08, 1, happy), lerp(0.08, 1, happy)].map((l) => Math.max(l, blinkAt(t, [6.0]))), look: [-0.7, -0.1], smile: 0.9 + 0.1 * happy, blush: 0.6 + 0.4 * happy, open: t > 6.9 && t < 7.3 ? 1 : 0 });
      c.pose({ tilt: -0.1 + 0.06 * S(t, 1.5), nod: -0.08 * happy + 0.04 * S(t, 3.4), yaw: -0.15, breathe: S(t, 2.6) });
      c.arm(0, c.root.worldToLocal(V(1.15, -2.6, 0.5)), V(-1, -1, 0)); c.arm(1, c.root.worldToLocal(V(1.95, -2.62, 0.75)), V(1, -1, 0));
      steam.forEach((s, i) => { const ph = (t * 0.35 + i / steam.length) % 1; s.position.set(-0.95 + 0.35 * Math.sin(i * 2.1 + t) * (0.4 + ph), -1.5 + ph * 2.6, -0.55 + 0.2 * Math.cos(i * 1.7)); s.material.opacity = 0.55 * Math.sin(Math.PI * ph); s.scale.setScalar(0.35 + ph * 0.7); });
      motes.forEach((s, i) => { const x = 3.4 - ((i * 0.37 + t * 0.08 * (1 + i % 3)) % 5.5); const y = -2.5 + ((i * 0.61 + t * 0.1) % 4.5); s.position.set(x, y, -1 + (i % 5) * 0.4); s.material.opacity = 0.5 + 0.4 * S(t, 2, i); });
      const z = lerp(11.0, 10.2, k(t, T.s2, T.s3 + 0.6));
      cam.position.set(0.25 + 0.03 * S(t, 0.7), -0.6 + 0.03 * S(t, 0.9), z); cam.lookAt(0.25, -0.8, 0);
    },
  };
}

// =============================================================== SCENE 3 — 3D brain
function label(title, sub, color) {
  const tex = canvasTex(560, 210, (x, w, h) => {
    x.fillStyle = 'rgba(255,255,255,0.92)'; x.beginPath(); x.roundRect(6, 6, w - 12, h - 12, 40); x.fill();
    x.strokeStyle = color; x.lineWidth = 8; x.stroke();
    x.fillStyle = color; x.font = '800 70px Nunito'; x.textAlign = 'center'; x.fillText(title, w / 2, 98);
    x.fillStyle = '#3d2e2a'; x.font = '700 46px Nunito'; x.fillText(sub, w / 2, 160);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false })); s.scale.set(1.35, 0.506, 1); s.renderOrder = 10; return s;
}
function makeS3() {
  const sc = new THREE.Scene(); sc.background = new THREE.Color('#dde8e7');
  baseLights(sc, { key: 1.5, keyPos: V(6, 5, 4), hemi: 1.1, env: 0.55 });
  const h = makeHuman('adult', { skin: { transparent: true, opacity: 0.2, depthWrite: false }, hair: { transparent: true, opacity: 0.3, depthWrite: false } });
  sc.add(h.root); h.face({ lid: [0.15, 0.15], smile: 0.6 }); h.hideFace();
  h.arm(0, V(-1.3, -3.3, 0.4)); h.arm(1, V(1.3, -3.3, 0.4));
  const brainG = new THREE.Group(); brainG.position.set(0, 0.95, 0); h.head.add(brainG); // head pivot space (-0.95) -> head center
  // cerebrum with gyri
  const bg = new THREE.SphereGeometry(1, 128, 96); const p = bg.attributes.position;
  for (let i = 0; i < p.count; i++) { const v = V(p.getX(i), p.getY(i), p.getZ(i)); const th = Math.atan2(v.z, v.x), ph = Math.acos(v.y); const d = 1 + 0.035 * Math.sin(ph * 22 + Math.sin(th * 5) * 2) * Math.sin(th * 9 + ph * 4); v.multiplyScalar(d); p.setXYZ(i, v.x * 0.6, v.y * 0.55 + (v.y < -0.5 ? (v.y + 0.5) * 0.25 : 0), v.z * 0.78); }
  bg.computeVertexNormals();
  const brainM = M('#eea7a8', { roughness: 0.55, transparent: true, opacity: 0.5, depthWrite: false, sheen: 0.6, sheenColor: new THREE.Color('#ffd0d0') });
  const brain = new THREE.Mesh(bg, brainM); brain.position.set(0, 0.22, -0.06); brain.renderOrder = 2; brainG.add(brain);
  const cg = new THREE.SphereGeometry(1, 64, 48); const cp = cg.attributes.position; for (let i = 0; i < cp.count; i++) { const y = cp.getY(i); const d = 1 + 0.05 * Math.sin(y * 30); cp.setXYZ(i, cp.getX(i) * 0.36 * d, y * 0.24, cp.getZ(i) * 0.3 * d); } cg.computeVertexNormals();
  const cereb = new THREE.Mesh(cg, M('#e49b9c', { roughness: 0.6, transparent: true, opacity: 0.75, depthWrite: false })); cereb.position.set(0, -0.36, -0.6); brainG.add(cereb);
  const stem = cyl(0.11, 0.09, 0.8, M('#e2a19e', { transparent: true, opacity: 0.8 }), 0, -0.72, -0.4, 24); stem.rotation.x = 0.25; brainG.add(stem);
  // olfactory bulb, nasal path
  const bulbM = M('#f3cf6a', { emissive: '#ffcc40', emissiveIntensity: 0.0, roughness: 0.4 });
  const bulb = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.22, 6, 12), bulbM); bulb.rotation.x = Math.PI / 2 - 0.15; bulb.position.set(0, -0.2, 0.55); brainG.add(bulb);
  const nasal = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0, -0.2, 1.02), V(0, -0.24, 0.85), V(0, -0.24, 0.7)]), 16, 0.05, 10), M('#f1b3a3', { transparent: true, opacity: 0.6 })); brainG.add(nasal);
  // amygdala & hippocampus
  const amyM = M('#d4826b', { emissive: '#ff9a5a', emissiveIntensity: 0, roughness: 0.4 });
  const amy = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 16), amyM); amy.scale.set(0.9, 0.8, 1.25); amy.position.set(0, -0.3, 0.17); brainG.add(amy);
  const hipCurve = new THREE.CatmullRomCurve3([V(0, -0.32, 0.06), V(0, -0.35, -0.12), V(0, -0.29, -0.32), V(0, -0.14, -0.42), V(0, -0.05, -0.33)]);
  const hipM = M('#7fa3c4', { emissive: '#5ab0ff', emissiveIntensity: 0, roughness: 0.4 });
  const hip = new THREE.Mesh(new THREE.TubeGeometry(hipCurve, 48, 0.055, 14), hipM); brainG.add(hip);
  // pathways
  const pA = new THREE.CatmullRomCurve3([V(0, -0.22, 0.43), V(0, -0.27, 0.32), V(0, -0.3, 0.24)]);
  const pB = new THREE.CatmullRomCurve3([V(0, -0.22, 0.43), V(0, -0.34, 0.25), V(0, -0.36, 0.1), V(0, -0.33, 0.03)]);
  const pathM = M('#f3cf6a', { emissive: '#ffd060', emissiveIntensity: 0.8, transparent: true, opacity: 0 });
  for (const c of [pA, pB]) brainG.add(new THREE.Mesh(new THREE.TubeGeometry(c, 24, 0.016, 8), pathM));
  const pulses = []; for (let i = 0; i < 10; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 8), new THREE.MeshBasicMaterial({ color: '#fff2b0', transparent: true })); brainG.add(m); pulses.push(m); }
  const smell = []; for (let i = 0; i < 12; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), new THREE.MeshBasicMaterial({ color: '#f39ab8', transparent: true })); brainG.add(m); smell.push(m); }
  const glowA = new THREE.Sprite(new THREE.SpriteMaterial({ map: DOT, color: '#ffb070', transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending })); glowA.position.copy(amy.position); brainG.add(glowA);
  const glowH = new THREE.Sprite(new THREE.SpriteMaterial({ map: DOT, color: '#8fd0ff', transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending })); glowH.position.set(0, -0.22, -0.2); brainG.add(glowH);
  const glowB = new THREE.Sprite(new THREE.SpriteMaterial({ map: DOT, color: '#ffe080', transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending })); glowB.position.copy(bulb.position); brainG.add(glowB);
  // labels with leader lines
  const lBulb = label('Koku soğanı', 'koku sinyalini işler', '#b8892d'), lHip = label('Hipokampus', 'anılar ve hafıza', '#3f74a3'), lAmy = label('Amigdala', 'duygular', '#b9634e');
  sc.add(lBulb, lHip, lAmy);
  const lineM = (c) => new THREE.LineBasicMaterial({ color: c, transparent: true, depthTest: false });
  const mkLine = (c) => { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(0, 0, 0), V(0, 0, 0)]), lineM(c)); l.renderOrder = 9; sc.add(l); return l; };
  const lnB = mkLine('#b8892d'), lnH = mkLine('#3f74a3'), lnA = mkLine('#b9634e');
  const cam = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);
  const floaters = sprites(sc, 20, DOT, '#ffffff', 0.12);
  return {
    sc, cam, update(t) {
      const lt = t - T.s3;
      h.pose({ breathe: S(t, 2.2), nod: 0.02 * S(t, 1.1) });
      const bulbOn = k(lt, 1.0, 1.6), con = k(lt, 1.7, 2.8), both = k(lt, 2.2, 3.0), hipOn = k(lt, 6.1, 6.6), amyOn = k(lt, 7.1, 7.6);
      const pulse = 0.65 + 0.35 * S(t, 6);
      bulbM.emissiveIntensity = 0.9 * bulbOn * pulse; glowB.material.opacity = bulbOn * 0.7 * pulse; glowB.scale.setScalar(0.45);
      pathM.opacity = con;
      const amyG = Math.max(amyOn, both * 0.4), hipG = Math.max(hipOn, both * 0.4);
      amyM.emissiveIntensity = 2.2 * amyG * pulse; hipM.emissiveIntensity = 3.2 * hipG * pulse;
      glowA.material.opacity = amyG * 0.9; glowA.scale.setScalar(0.45 + 0.15 * amyG * pulse);
      glowH.material.opacity = hipG; glowH.scale.setScalar(0.95 + 0.2 * hipG * pulse);
      pulses.forEach((m, i) => { const c = i % 2 ? pA : pB; const ph = (t * 0.8 + i / 10) % 1; m.position.copy(c.getPoint(ph)); m.material.opacity = con * Math.sin(Math.PI * ph); });
      const sa = k(lt, 0.5, 1.2) * (1 - k(lt, 6.5, 7.5));
      smell.forEach((m, i) => { const ph = (t * 0.55 + i / 12) % 1; const p = vl(V(0, -0.35, 1.7), V(0, -0.21, 0.55), ph); p.y += 0.06 * Math.sin(ph * 10 + i); p.x += 0.05 * Math.cos(ph * 8 + i); m.position.copy(p); m.material.opacity = sa * Math.sin(Math.PI * ph); });
      // camera: side view, slow orbit, push in for the deep structures
      const ang = lerp(1.3, 1.62, k(lt, 0, 10)); const dist = lerp(8.6, 7.2, k(lt, 5.6, 7.0));
      const tgt = V(0, lerp(-0.45, -0.15, k(lt, 5.6, 7.0)), lerp(0.1, 0.05, k(lt, 5.6, 7.0)));
      cam.position.set(Math.sin(ang) * dist, tgt.y + 0.15 + 0.03 * S(t, 0.8), Math.cos(ang) * dist + tgt.z); cam.lookAt(tgt); cam.updateMatrixWorld(true);
      sc.updateMatrixWorld(true);
      const wp = (o) => o.getWorldPosition(V(0, 0, 0));
      const right = V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 0), up = V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 1);
      const place = (lab, ln, anchor, nx, ny, a) => {
        const dcam = anchor.clone().sub(cam.position).length();
        const pos = V(nx, ny, 0.5).unproject(cam).sub(cam.position).normalize().multiplyScalar(dcam * 0.85).add(cam.position);
        lab.position.copy(pos); lab.material.opacity = a; const sc2 = dcam * 0.85 * 0.19; lab.scale.set(sc2 * (0.9 + 0.1 * a), sc2 * 0.375 * (0.9 + 0.1 * a), 1);
        const edge = pos.clone().addScaledVector(up, (ny > 0 ? -1 : 1) * sc2 * 0.19);
        ln.geometry.setFromPoints([anchor, edge]); ln.material.opacity = a;
      };
      place(lBulb, lnB, wp(bulb), -0.35, -0.55, k(lt, 1.1, 1.6) * (1 - k(lt, 5.4, 5.9)));
      place(lHip, lnH, wp(hip).add(V(0, -0.15, -0.25)), 0.3, 0.62, hipOn);
      place(lAmy, lnA, wp(amy), -0.35, -0.55, amyOn);
      floaters.forEach((s, i) => { s.position.set(-2 + (i % 4), -2 + ((i * 0.7 + t * 0.15) % 4.5), -1.5 + ((i * 1.3) % 3)); s.material.opacity = 0.25; });
    },
  };
}

// =============================================================== SCENE 4 — flower & memory bubbles
function mini(kind) {
  const g = new THREE.Group();
  if (kind === 'granny') { const gm = makeHuman('grandma'); gm.face({ lid: [0.45, 0.45], smile: 1 }); gm.root.scale.setScalar(0.28); gm.root.position.y = 0.05; g.add(gm.root); }
  if (kind === 'cake') { g.add(cyl(0.38, 0.38, 0.26, M('#f6c5c4'), 0, -0.2, 0), cyl(0.28, 0.28, 0.22, M('#fbf2e2'), 0, 0.04, 0)); for (const x of [-0.14, 0, 0.14]) { g.add(cyl(0.025, 0.025, 0.18, M('#8fa9bd'), x, 0.24, 0)); g.add(sph(0.04, M('#ffcc55', { emissive: '#ffb030', emissiveIntensity: 1.5 }), x, 0.36, 0)); } }
  if (kind === 'bike') { const red = M('#d4826b', { metalness: 0.3, roughness: 0.35 }); for (const x of [-0.3, 0.3]) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 10, 32), M('#3d2e2a')); w.position.set(x, -0.15, 0); g.add(w); } const fr = new THREE.CatmullRomCurve3([V(-0.3, -0.15, 0), V(-0.05, 0.12, 0), V(0.22, 0.12, 0), V(0.3, -0.15, 0)]); g.add(new THREE.Mesh(new THREE.TubeGeometry(fr, 20, 0.03, 8), red)); g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(V(-0.05, 0.12, 0), V(0.0, -0.15, 0)), 4, 0.03, 8), red)); g.add(box(0.14, 0.04, 0.08, M('#3d2e2a'), -0.08, 0.22, 0)); }
  if (kind === 'sea') { g.add(sph(0.16, M('#ffd060', { emissive: '#ffb030', emissiveIntensity: 1.2 }), 0.12, 0.15, -0.1)); const sea = box(0.75, 0.2, 0.4, M('#6fa3c8', { roughness: 0.2, clearcoat: 1 }), 0, -0.22, 0); g.add(sea); g.add(box(0.75, 0.06, 0.4, M('#f0dcb0'), 0, -0.35, 0)); }
  if (kind === 'kite') { const s = new THREE.Shape(); s.moveTo(0, 0.32); s.lineTo(0.2, 0.02); s.lineTo(0, -0.3); s.lineTo(-0.2, 0.02); s.lineTo(0, 0.32); const m = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02 }), M('#e79a9a')); g.add(m); const tail = new THREE.CatmullRomCurve3([V(0, -0.3, 0), V(0.08, -0.42, 0), V(-0.06, -0.55, 0), V(0.05, -0.66, 0)]); g.add(new THREE.Mesh(new THREE.TubeGeometry(tail, 16, 0.012, 6), M('#3d2e2a'))); }
  return g;
}
function heartMesh() { const s = new THREE.Shape(); s.moveTo(0, -0.12); s.bezierCurveTo(-0.22, 0.02, -0.12, 0.2, 0, 0.08); s.bezierCurveTo(0.12, 0.2, 0.22, 0.02, 0, -0.12); return new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, curveSegments: 12 }), M('#e26b6b', { emissive: '#ff5050', emissiveIntensity: 0.3 })); }
function makeS4() {
  const sc = new THREE.Scene(); sc.background = new THREE.Color('#cfe3e2');
  baseLights(sc, { key: 2.1, keyPos: V(-5, 7, 6), sky: '#eaf6ff', ground: '#7d9a6c', hemi: 1.0 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), M('#a9c48f', { roughness: 0.95, sheen: 0 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -3.6; ground.receiveShadow = true; sc.add(ground);
  const greens = ['#7fa86b', '#6c955c', '#8fb57a', '#5f8a52'];
  for (let i = 0; i < 26; i++) { const x = -7 + (i % 13) * 1.15 + (i > 12 ? 0.5 : 0), z = i > 12 ? -5.5 : -3.5; sc.add(sph(0.9 + (i % 3) * 0.3, M(greens[i % 4], { roughness: 0.9, sheen: 0.4 }), x, -2.6 + (i % 2) * 0.4 + (i > 12 ? 0.8 : 0), z)); }
  for (const [x, z] of [[-6, -9], [-2, -10], [3, -9.5], [6.5, -8.5]]) { sc.add(cyl(0.2, 0.25, 2.4, M('#8a6a50'), x, -2.4, z)); sc.add(sph(1.6, M('#86ad74', { roughness: 0.9 }), x, -0.2, z)); }
  for (const [x, c] of [[-2.6, '#f4b2bf'], [2.6, '#e3b45c']]) { sc.add(cyl(0.45, 0.35, 0.8, M('#d4826b', { roughness: 0.8 }), x, -3.2, 1.2)); for (let j = 0; j < 5; j++) sc.add(sph(0.16, M(c), x - 0.3 + j * 0.15, -2.55 + (j % 2) * 0.12, 1.2 + (j % 3 - 1) * 0.12)); }
  const bokeh = sprites(sc, 16, DOT, '#fff8e0', 0.8);
  const h = makeHuman('adult'); sc.add(h.root);
  const fl = flower(); fl.position.set(-0.1, 0.1, 0.05); h.holder(1).add(fl);
  const pos = [[-1.3, 1.9, 0.6, 'granny', 1.3], [1.3, 1.9, 0.6, 'cake', 1.9], [-1.4, 0.0, 1.2, 'bike', 2.5], [1.4, 0.0, 1.2, 'sea', 3.0], [0, 2.85, 0.2, 'kite', 3.5]];
  const glassM = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.02, clearcoat: 1, transparent: true, opacity: 0.16, depthWrite: false, envMapIntensity: 1.5 });
  const bubbles = pos.map(([x, y, z, kind, at]) => {
    const g = new THREE.Group(); g.position.set(x, y, z); sc.add(g);
    const inner = mini(kind); g.add(inner);
    const glass = new THREE.Mesh(new THREE.SphereGeometry(0.58, 40, 28), glassM); glass.renderOrder = 3; g.add(glass);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.018, 8, 64), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7 })); g.add(ring);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: DOT, color: '#ffc870', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); glow.scale.setScalar(2.0); g.add(glow);
    const hearts = [0, 1].map(() => { const m = heartMesh(); g.add(m); return m; });
    return { g, inner, glow, hearts, at, ring };
  });
  const sparks = sprites(sc, 26, STAR, '#ffe2a0', 0.2, true);
  const cam = new THREE.PerspectiveCamera(36, W / H, 0.1, 100);
  return {
    sc, cam, update(t) {
      const lt = t - T.s4;
      const u = k(lt, 0.0, 0.6);
      h.arm(1, vl(V(1.3, -3.3, 0.4), V(0.6, -1.35, 1.05), u), V(1, -1, -0.2)); h.arm(0, V(-1.3, -3.3, 0.4));
      const closed = k(lt, 0.9, 1.25), warm = k(t, 24.1, 24.8);
      h.face({ lid: [lerp(0.12, 1, closed), lerp(0.12, 1, closed)].map((l) => Math.max(l, blinkAt(lt, [0.35]))), smile: lerp(0.55, 0.85, closed) + 0.15 * warm, open: lt > 0.5 && lt < 0.95 ? 1 : 0, brow: closed * 0.5, blush: 0.4 + 0.6 * warm });
      h.pose({ tilt: -0.08 + 0.03 * S(t, 1.1), nod: 0.03 * closed, breathe: S(t, 2.4) });
      fl.userData.bloom.rotation.z = 0.05 * S(t, 1.6);
      bubbles.forEach((b, i) => {
        const a = clamp((lt - b.at) / 0.45); const pop = a <= 0 ? 0 : (a < 1 ? 1 + 2.4 * Math.pow(a - 1, 3) + 1.4 * Math.pow(a - 1, 2) : 1);
        b.g.visible = a > 0; b.g.scale.setScalar(Math.max(0.001, pop)); b.g.position.y = pos[i][1] + 0.08 * S(t, 1.3, i);
        b.inner.rotation.y = 0.6 * S(t, 0.7, i); b.inner.rotation.z = 0.05 * S(t, 1.1, i);
        b.glow.material.opacity = warm * (0.55 + 0.15 * S(t, 4, i)); b.ring.lookAt(cam.position);
        b.hearts.forEach((m, j) => { const ph = (t * 0.5 + j * 0.5 + i * 0.2) % 1; m.visible = warm > 0.02; m.position.set(0.45 + j * 0.15, 0.4 + ph * 0.9, 0.2); m.scale.setScalar(warm * Math.sin(Math.PI * ph) * (0.9 + j * 0.3)); m.rotation.y = t * 2 + j; });
      });
      sparks.forEach((s, i) => { const ang = i * 2.399 + t * 0.4; s.position.set(Math.cos(ang) * (1.2 + (i % 5) * 0.3), 0.6 + Math.sin(ang * 1.7 + i) * 1.6, 0.8 + Math.sin(ang) * 0.5); s.material.opacity = warm * (0.5 + 0.5 * S(t, 4 + (i % 3), i)); });
      bokeh.forEach((s, i) => { s.position.set(-4 + (i * 0.53) % 8 + 0.3 * S(t, 0.4, i), -1 + (i * 0.71) % 5, -4.5); s.material.opacity = 0.22 + 0.1 * S(t, 1.1, i); s.scale.setScalar(0.6 + (i % 4) * 0.25); });
      const z = lerp(11.6, 10.8, k(t, T.s4, T.s5 + 0.6));
      cam.position.set(0.03 * S(t, 0.7), 0.0 + 0.03 * S(t, 0.9), z); cam.lookAt(0, 0.05, 0);
    },
  };
}

// =============================================================== SCENE 5 — by the window
function makeS5() {
  const sc = new THREE.Scene(); sc.background = new THREE.Color('#e3cfbf');
  baseLights(sc, { key: 2.6, keyCol: '#ffc58a', keyPos: V(4, 2.5, -6), keyTarget: V(-0.5, -1.5, 1), hemi: 0.75, sky: '#ffe8d4', ground: '#7a5a5a', env: 0.35, rim: 0.4 });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(30, 22), new THREE.MeshStandardMaterial({ color: '#e6d2c1', roughness: 0.95 })); wall.position.z = -3; wall.receiveShadow = true; sc.add(wall);
  // window hole look: sunset plane behind, frame in front
  const sunset = canvasTex(256, 512, (x) => { const g = x.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, '#9fb0d6'); g.addColorStop(0.5, '#f2b99b'); g.addColorStop(0.75, '#f8d39a'); g.addColorStop(1, '#f8d39a'); x.fillStyle = g; x.fillRect(0, 0, 256, 512); x.fillStyle = '#fff1c4'; x.beginPath(); x.arc(150, 330, 46, 0, 7); x.fill(); x.fillStyle = '#b693a0'; x.beginPath(); x.moveTo(0, 390); x.quadraticCurveTo(90, 330, 170, 380); x.quadraticCurveTo(220, 400, 256, 370); x.lineTo(256, 512); x.lineTo(0, 512); x.fill(); x.fillStyle = '#93768a'; x.beginPath(); x.moveTo(0, 440); x.quadraticCurveTo(120, 400, 256, 430); x.lineTo(256, 512); x.lineTo(0, 512); x.fill(); });
  const view = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.8), new THREE.MeshBasicMaterial({ map: sunset, toneMapped: false })); view.position.set(1.9, 0.6, -2.98); sc.add(view);
  const fm = M('#f6eee4', { roughness: 0.6 });
  for (const [w, h, x, y] of [[2.9, 0.18, 1.9, 2.55], [2.9, 0.22, 1.9, -1.35], [0.18, 4.0, 0.55, 0.6], [0.18, 4.0, 3.25, 0.6], [0.1, 3.8, 1.9, 0.6], [2.7, 0.1, 1.9, 0.9]]) sc.add(box(w, h, 0.2, fm, x, y, -2.9));
  sc.add(box(3.2, 0.14, 0.7, M('#b98a5f'), 1.9, -1.45, -2.65));
  // plant
  const plant = new THREE.Group(); plant.position.set(2.8, -1.38, -2.6); sc.add(plant);
  plant.add(cyl(0.22, 0.17, 0.4, M('#d4826b'), 0, 0.2, 0));
  const leaves = [-1, 0, 1].map((i) => { const l = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 10), M('#7fae63')); l.scale.set(0.6, 1.4, 0.3); const g = new THREE.Group(); g.position.y = 0.4; g.rotation.z = i * 0.5; l.position.y = 0.3; g.add(l); plant.add(g); return g; });
  const curt = curtain(1.3, 4.4, '#8fa9bd'); curt.position.set(0.2, 0.5, -2.75); sc.add(curt);
  sc.add(cyl(0.05, 0.05, 4.0, M('#93694a'), 1.5, 2.75, -2.75)); sc.children[sc.children.length - 1].rotation.z = Math.PI / 2;
  // seat & cushion
  sc.add(box(8, 1.2, 3, M('#c4a389', { roughness: 0.8 }), 0, -4.2, -0.8));
  const cush = new THREE.Mesh(new THREE.CapsuleGeometry(0.7, 0.9, 10, 20), M('#e39a95', { roughness: 0.9, sheen: 1 })); cush.rotation.z = Math.PI / 2 - 0.2; cush.scale.set(1, 1, 0.5); cush.position.set(-2.1, -2.6, -1.6); cush.castShadow = true; sc.add(cush);
  // light beam
  const beamTex = canvasTex(64, 256, (x) => { const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, 'rgba(255,220,160,0.55)'); g.addColorStop(1, 'rgba(255,220,160,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 256); });
  const beam = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 6), new THREE.MeshBasicMaterial({ map: beamTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); beam.position.set(0.9, -0.6, -0.8); beam.rotation.set(-0.5, 0.35, 0.45); sc.add(beam);
  const h = makeHuman('adult'); h.root.position.set(-0.55, 0, 0); h.root.rotation.y = 0.32; sc.add(h.root);
  const fl = flower(); fl.position.set(-0.05, 0.05, 0.05); fl.rotation.z = 0.25; h.holder(1).add(fl);
  const petals = []; for (let i = 0; i < 7; i++) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), M('#f7c7cf')); p.scale.set(1, 0.5, 0.2); sc.add(p); petals.push(p); }
  const motes = sprites(sc, 20, DOT, '#ffe3b0', 0.06, true);
  const cam = new THREE.PerspectiveCamera(36, W / H, 0.1, 100);
  return {
    sc, cam, update(t) {
      const lt = t - T.s5;
      waveCurtain(curt, t, 0.22, 0.4);
      leaves.forEach((l, i) => { l.rotation.z = (i - 1) * 0.5 + 0.05 * S(t, 1.5, i); });
      h.arm(1, h.root.worldToLocal(V(0.05, -1.75, 1.15)), V(1, -1, 0)); h.arm(0, h.root.worldToLocal(V(-0.55, -2.1, 1.05)), V(-1, -1, 0));
      h.face({ lid: [0.38, 0.38].map((l) => Math.max(l, blinkAt(lt, [1.6, 4.4]))), look: [0.75, 0.15], smile: 0.75, brow: 0.3, blush: 0.5 });
      h.pose({ yaw: 0.25 + 0.03 * S(t, 0.6), tilt: 0.1 + 0.02 * S(t, 0.9), nod: -0.04, breathe: S(t, 2.0) });
      petals.forEach((p, i) => { const ph = (lt * 0.1 + i / 7) % 1; p.position.set(-1.8 + i * 0.6 + 0.3 * S(t, 1, i), 2.8 - ph * 6, 0.4 + (i % 3) * 0.3); p.rotation.set(t * 1.2 + i, t * 0.8, t + i); });
      motes.forEach((s, i) => { s.position.set(0.2 + ((i * 0.37 + t * 0.05) % 2.4), -2.5 + ((i * 0.61 + t * 0.08) % 4), -1.2 + (i % 4) * 0.4); s.material.opacity = 0.6 + 0.3 * S(t, 2, i); });
      const z = lerp(9.2, 8.3, k(t, T.s5, T.total));
      cam.position.set(0.3 + 0.03 * S(t, 0.7), -0.25 + 0.02 * S(t, 0.9), z); cam.lookAt(0.1, -0.55, 0);
    },
  };
}

// =============================================================== END CARD
function makeEnd() {
  const sc = new THREE.Scene(); sc.background = new THREE.Color('#f3e8d6');
  baseLights(sc, { key: 1.8, hemi: 1.0 });
  const h = makeHuman('adult'); h.root.scale.setScalar(0.55); h.root.position.set(0, 1.3, 0); sc.add(h.root); h.face({ smile: 0.8, blush: 0.5 });
  h.arm(0, V(-1.3, -3.3, 0.4)); h.arm(1, V(1.3, -3.3, 0.4));
  const disc = cyl(1.25, 1.25, 0.2, M('#86a79c', { roughness: 0.6 }), 0, 0.9, -0.8, 64); disc.rotation.x = Math.PI / 2; sc.add(disc);
  const tex = canvasTex(1024, 300, (x, w) => { x.fillStyle = '#3d2e2a'; x.font = '800 150px Nunito'; x.textAlign = 'center'; x.fillText('İnsan Atlası', w / 2, 170); x.fillStyle = '#e0ac4f'; x.beginPath(); x.roundRect(w / 2 - 220, 215, 440, 22, 11); x.fill(); });
  const txt = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.0), new THREE.MeshBasicMaterial({ map: tex, transparent: true })); txt.position.set(0, -1.3, 0.5); sc.add(txt);
  const cam = new THREE.PerspectiveCamera(36, W / H, 0.1, 100); cam.position.set(0, 0, 9); cam.lookAt(0, 0, 0);
  return { sc, cam, update(t) { const lt = t - T.end; h.root.rotation.y = 0.35 * Math.sin(lt * 1.5); h.pose({ tilt: 0.06 * S(t, 2) }); h.face({ smile: 0.85, blush: 0.5, lid: [blinkAt(lt, [0.9]), blinkAt(lt, [0.9])] }); txt.scale.setScalar(0.92 + 0.08 * k(lt, 0, 0.6)); } };
}

// =============================================================== compositor
const rtOpts = { type: THREE.HalfFloatType, samples: 4 };
const rtA = new THREE.WebGLRenderTarget(W, H, rtOpts), rtB = new THREE.WebGLRenderTarget(W, H, rtOpts);
const quadMat = new THREE.ShaderMaterial({
  uniforms: { tA: { value: rtA.texture }, tB: { value: rtB.texture }, mixv: { value: 0 }, mode: { value: 0 }, rad: { value: 0 }, ctr: { value: new THREE.Vector2(0.5, 0.62) }, tint: { value: 0 }, time: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }',
  fragmentShader: `uniform sampler2D tA,tB; uniform float mixv,mode,rad,tint,time; uniform vec2 ctr; varying vec2 vUv;
  void main(){ vec3 a=texture2D(tA,vUv).rgb, b=texture2D(tB,vUv).rgb; float m=mixv; vec2 d=(vUv-ctr)*vec2(1.0,1.7778); float dd=length(d);
    if(mode>0.5){ m=1.0-smoothstep(rad-0.012,rad,dd); }
    vec3 c=mix(a,b,m);
    if(mode>0.5){ float ring=smoothstep(0.03,0.0,abs(dd-rad))*(1.0-smoothstep(0.7,1.2,rad)); c=mix(c,vec3(1.6,1.15,0.6),ring*0.8); }
    c=mix(c,c*vec3(1.1,0.94,0.74),tint);
    vec2 q=vUv-0.5; c*=1.0-dot(q*vec2(1.0,0.75),q*vec2(1.0,0.75))*(0.65+tint*0.6);
    float n=fract(sin(dot(vUv*vec2(720.,1280.)+time,vec2(12.9898,78.233)))*43758.5453); c+=(n-0.5)*0.02;
    gl_FragColor=vec4(c,1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`,
});
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), quadMat); const qs = new THREE.Scene(); qs.add(quad); const qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

const S1 = makeS1(), S2 = makeS2(), S3 = makeS3(), S4 = makeS4(), S5 = makeS5(), SE = makeEnd();
function renderTo(rt, s, t) { s.update(t); renderer.setRenderTarget(rt); renderer.render(s.sc, s.cam); }
const segs = [[S1, 0], [S2, T.s2], [S3, T.s3], [S4, T.s4], [S5, T.s5], [SE, T.end]];
window.frame = (t) => {
  // which scene(s)
  let i = 0; for (let j = 0; j < segs.length; j++) if (t >= segs[j][1] - 0.1) i = j;
  const cur = segs[i], prev = segs[i - 1];
  const start = cur[1] - 0.1, dur = i === 1 ? 0.7 : 0.6;
  const inTrans = prev && t < start + dur;
  quadMat.uniforms.time.value = t * 13.7;
  quadMat.uniforms.tint.value = i === 1 && !inTrans ? 0.28 : (i === 1 ? 0.28 * k(t, start, start + dur) : (i === 2 && inTrans ? 0.28 * (1 - k(t, start, start + dur)) : 0));
  if (inTrans) {
    renderTo(rtA, prev[0], t); renderTo(rtB, cur[0], t);
    if (i === 1) { quadMat.uniforms.mode.value = 1; quadMat.uniforms.rad.value = lerp(0.0, 1.25, k(t, start, start + dur)); }
    else { quadMat.uniforms.mode.value = 0; quadMat.uniforms.mixv.value = k(t, start, start + dur); }
  } else {
    renderTo(rtA, cur[0], t); quadMat.uniforms.mode.value = 0; quadMat.uniforms.mixv.value = 0;
  }
  renderer.setRenderTarget(null); renderer.render(qs, qc);
  return renderer.domElement.toDataURL('image/jpeg', 0.93);
};
window.READY = true;
