import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { makeStrawberry } from './char.js';

const W = 720, H = 1280, FPS = 24;
const LIP = await (await fetch('lipsync.json')).json();
const TL = await (await fetch('timeline.json')).json();

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H); renderer.setPixelRatio(1);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#e9dccd');
const pm = new THREE.PMREMGenerator(renderer);
scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.6;

// ---------- utils ----------
let seed = 11; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ease = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const lerp = (a, b, k) => a + (b - a) * k;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------- lights ----------
scene.add(new THREE.HemisphereLight('#fff4e6', '#8a6a5a', 0.9));
const key = new THREE.DirectionalLight('#fff3e2', 2.4); key.castShadow = true;
key.shadow.mapSize.set(2048, 2048); key.shadow.radius = 5; key.shadow.bias = -0.0004;
Object.assign(key.shadow.camera, { left: -7, right: 7, top: 8, bottom: -6, near: 0.5, far: 40 });
scene.add(key, key.target);
const rim = new THREE.DirectionalLight('#ffd2a8', 1.6); scene.add(rim, rim.target);
const fill = new THREE.PointLight('#ffe2c8', 25, 14); scene.add(fill);
const loveLight = new THREE.PointLight('#ff5d9a', 0, 6); scene.add(loveLight);

// ---------- backdrop (painted blurred supermarket) ----------
function backdropTexture() {
  const c = document.createElement('canvas'); c.width = 2048; c.height = 1152; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 1152); g.addColorStop(0, '#f7f1e8'); g.addColorStop(0.55, '#ead9c6'); g.addColorStop(1, '#c9b29b');
  x.fillStyle = g; x.fillRect(0, 0, 2048, 1152);
  // ceiling lights
  for (let i = 0; i < 9; i++) { x.fillStyle = '#ffffff'; x.fillRect(80 + i * 230, 40, 150, 26); }
  // shelving aisles
  const cols = ['#e63946', '#f1a208', '#2a9d8f', '#457b9d', '#f4a261', '#8ac926', '#ff70a6', '#6a4c93', '#ffd166', '#06d6a0', '#ef476f', '#118ab2'];
  for (let a = 0; a < 5; a++) {
    const ax = a * 430 - 40, aw = 380;
    x.fillStyle = '#d9d2c8'; x.fillRect(ax, 200, aw, 760);
    for (let s = 0; s < 6; s++) {
      const sy = 230 + s * 120;
      let bx = ax + 10;
      while (bx < ax + aw - 20) { const w = 20 + rnd() * 34, h = 50 + rnd() * 50; x.fillStyle = cols[Math.floor(rnd() * cols.length)]; x.fillRect(bx, sy + 100 - h, w, h); bx += w + 4; }
      x.fillStyle = '#9a9188'; x.fillRect(ax, sy + 100, aw, 10);
    }
  }
  // floor
  x.fillStyle = '#cdbfae'; x.fillRect(0, 960, 2048, 192);
  const c2 = document.createElement('canvas'); c2.width = 2048; c2.height = 1152; const y = c2.getContext('2d');
  y.filter = 'blur(16px)'; y.drawImage(c, 0, 0);
  y.filter = 'blur(10px)';
  for (let i = 0; i < 40; i++) { y.globalAlpha = 0.25 + rnd() * 0.35; y.fillStyle = '#fff6dc'; y.beginPath(); y.arc(rnd() * 2048, rnd() * 400, 18 + rnd() * 40, 0, 7); y.fill(); }
  const t = new THREE.CanvasTexture(c2); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const bdTex = backdropTexture();
function addBackdrop(cx) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(56, 31.5), new THREE.MeshBasicMaterial({ map: bdTex, toneMapped: false, color: '#f2e6da' }));
  m.position.set(cx, 8, -16); scene.add(m);
}
addBackdrop(0); addBackdrop(40);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 60), new THREE.MeshStandardMaterial({ color: '#cbbcab', roughness: 0.4 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

// ---------- fruit instancing ----------
function smallBerryGeo() {
  const g = new THREE.SphereGeometry(1, 20, 16); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); const w = y > 0 ? 1 - 0.05 * y * y : 1 - 0.5 * Math.pow(-y, 1.9); p.setXYZ(i, p.getX(i) * w, y * (y > 0 ? 0.85 : 1.1), p.getZ(i) * w); }
  g.computeVertexNormals(); return g;
}
const FRUIT = {
  strawberry: { geo: smallBerryGeo(), mat: new THREE.MeshPhysicalMaterial({ color: '#d4141e', roughness: 0.35, clearcoat: 0.6 }), r: 0.2, sc: [1, 1, 1] },
  orange: { geo: new THREE.SphereGeometry(1, 24, 18), mat: new THREE.MeshPhysicalMaterial({ color: '#f28a12', roughness: 0.55, clearcoat: 0.2 }), r: 0.3, sc: [1, 0.95, 1] },
  apple: { geo: new THREE.SphereGeometry(1, 24, 18), mat: new THREE.MeshPhysicalMaterial({ color: '#b5161c', roughness: 0.3, clearcoat: 0.7 }), r: 0.3, sc: [1, 0.9, 1] },
  lemon: { geo: new THREE.SphereGeometry(1, 24, 18), mat: new THREE.MeshPhysicalMaterial({ color: '#f4d81c', roughness: 0.5, clearcoat: 0.3 }), r: 0.25, sc: [1.3, 0.9, 0.9] },
  tomato: { geo: new THREE.SphereGeometry(1, 24, 18), mat: new THREE.MeshPhysicalMaterial({ color: '#e0261b', roughness: 0.25, clearcoat: 0.8 }), r: 0.3, sc: [1, 0.82, 1] },
  kiwi: { geo: new THREE.SphereGeometry(1, 20, 14), mat: new THREE.MeshStandardMaterial({ color: '#7a5a33', roughness: 0.95 }), r: 0.24, sc: [1.25, 1, 1] },
  greenapple: { geo: new THREE.SphereGeometry(1, 24, 18), mat: new THREE.MeshPhysicalMaterial({ color: '#8cc63f', roughness: 0.35, clearcoat: 0.6 }), r: 0.3, sc: [1, 0.9, 1] },
};
function fillFruit(type, cx, cz, w, d, yBase, layers = 2) {
  const f = FRUIT[type]; const pts = [];
  const nx = Math.floor(w / (f.r * 2.05)), nz = Math.floor(d / (f.r * 2.05));
  for (let l = 0; l < layers; l++) for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const x = cx - w / 2 + f.r * 1.03 + i * f.r * 2.05 + (l % 2) * f.r * 0.9 + (rnd() - 0.5) * 0.08;
    const z = cz - d / 2 + f.r * 1.03 + j * f.r * 2.05 + (l % 2) * f.r * 0.9 + (rnd() - 0.5) * 0.08;
    if (x > cx + w / 2 - f.r * 0.8 || z > cz + d / 2 - f.r * 0.8) continue;
    pts.push([x, yBase + f.r * 0.9 + l * f.r * 1.4 + rnd() * 0.05, z]);
  }
  const im = new THREE.InstancedMesh(f.geo, f.mat, pts.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  pts.forEach((p, i) => {
    e.set((rnd() - 0.5) * 0.6, rnd() * 6.28, (rnd() - 0.5) * 0.6 + (type === 'strawberry' ? Math.PI * (rnd() > 0.5 ? 0.45 : -0.45) : 0));
    q.setFromEuler(e); const s = f.r * (0.9 + rnd() * 0.2);
    m.compose(V(...p), q, V(s * f.sc[0], s * f.sc[1], s * f.sc[2])); im.setMatrixAt(i, m);
  });
  im.castShadow = true; im.receiveShadow = true; scene.add(im);
  return yBase + f.r * 0.9 + (layers - 1) * f.r * 1.4 + f.r;
}

// ---------- crates ----------
const wood = new THREE.MeshStandardMaterial({ color: '#b98552', roughness: 0.75 });
const woodDark = new THREE.MeshStandardMaterial({ color: '#7b5233', roughness: 0.8 });
function crate(cx, cz, w, d, y0, h) {
  const g = new THREE.Group();
  const slat = (sx, sy, sz, x, y, z, m = wood) => { const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); b.position.set(x, y, z); b.castShadow = true; b.receiveShadow = true; g.add(b); };
  for (let k = 0; k < 3; k++) {
    const y = y0 + 0.18 + k * (h / 3);
    slat(w, h / 3 - 0.06, 0.06, cx, y, cz + d / 2); slat(w, h / 3 - 0.06, 0.06, cx, y, cz - d / 2);
    slat(0.06, h / 3 - 0.06, d, cx - w / 2, y, cz); slat(0.06, h / 3 - 0.06, d, cx + w / 2, y, cz);
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) slat(0.12, h, 0.12, cx + sx * w / 2, y0 + h / 2, cz + sz * d / 2, woodDark);
  slat(w, 0.06, d, cx, y0 + 0.05, cz);
  scene.add(g);
}
// display: front row y0=0.3, back row raised
const stand = new THREE.Mesh(new THREE.BoxGeometry(10, 0.3, 2.8), woodDark); stand.position.set(0, 0.15, 0); stand.receiveShadow = true; scene.add(stand);
const stand2 = new THREE.Mesh(new THREE.BoxGeometry(10, 1.1, 2.8), woodDark); stand2.position.set(0, 0.55, -2.8); stand2.receiveShadow = true; scene.add(stand2);
const CW = 2.4, CD = 2.6, CH = 1.0;
let surf = 0;
for (const [x, type] of [[-4.9, 'orange'], [-2.45, 'strawberry'], [0, 'strawberry'], [2.45, 'apple'], [4.9, 'lemon']]) {
  crate(x, 0, CW, CD, 0.3, CH); surf = fillFruit(type, x, 0, CW - 0.1, CD - 0.1, 0.38, type === 'strawberry' ? 3 : 2);
}
const SURF = surf - 0.12; // top of strawberry beds
for (const [x, type] of [[-4.9, 'kiwi'], [-2.45, 'tomato'], [0, 'greenapple'], [2.45, 'orange'], [4.9, 'tomato']]) {
  crate(x, -2.8, CW, CD, 1.1, CH); fillFruit(type, x, -2.8, CW - 0.1, CD - 0.1, 1.18, 2);
}

// ---------- basket (at x=40) ----------
const BX = 40;
function basket() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, 256, 256); x.fillStyle = '#000';
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { x.beginPath(); x.roundRect(18 + i * 60, 30 + j * 70, 42, 50, 10); x.fill(); }
  const alpha = new THREE.CanvasTexture(c);
  const red = new THREE.MeshPhysicalMaterial({ color: '#d7192a', roughness: 0.35, clearcoat: 0.5, alphaMap: alpha, alphaTest: 0.5, side: THREE.DoubleSide });
  const solid = new THREE.MeshPhysicalMaterial({ color: '#c41626', roughness: 0.35, clearcoat: 0.5 });
  const g = new THREE.Group(); const w = 5.6, d = 3.6, h = 2.0;
  const wall = (ww, rotY, x, z) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(ww, h), red.clone()); m.material.alphaMap = alpha; m.material.alphaMap.repeat.set(ww / 2, 1); m.material.alphaMap.wrapS = THREE.RepeatWrapping; m.position.set(x, h / 2, z); m.rotation.y = rotY; m.castShadow = true; m.receiveShadow = true; g.add(m); };
  wall(w, 0, 0, d / 2); wall(w, 0, 0, -d / 2); wall(d, Math.PI / 2, -w / 2, 0); wall(d, Math.PI / 2, w / 2, 0);
  const rimG = (sx, sz, x, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.14, sz), solid); b.position.set(x, h, z); b.castShadow = true; g.add(b); };
  rimG(w + 0.14, 0.14, 0, d / 2); rimG(w + 0.14, 0.14, 0, -d / 2); rimG(0.14, d, -w / 2, 0); rimG(0.14, d, w / 2, 0);
  const bottom = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), solid); bottom.position.y = 0.05; g.add(bottom);
  const handleMat = new THREE.MeshStandardMaterial({ color: '#222', roughness: 0.4 });
  for (const s of [-1, 1]) { const hd = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.07, 10, 40, Math.PI), handleMat); hd.position.set(s * 1.2, h, 0); hd.rotation.y = Math.PI / 2; hd.rotation.z = s * 1.2; g.add(hd); }
  g.position.set(BX, 0, 0); scene.add(g);
}
basket();
// fruit inside basket
fillFruit('apple', BX - 1.9, 0.2, 1.6, 3.2, 0.1, 2);
fillFruit('orange', BX + 1.9, 0.2, 1.6, 3.2, 0.1, 2);
fillFruit('greenapple', BX, 0.6, 2.2, 2.2, 0.1, 2);
fillFruit('lemon', BX, -1.2, 5.0, 1.0, 0.1, 2);
// bananas
const banMat = new THREE.MeshPhysicalMaterial({ color: '#f3d23a', roughness: 0.45, clearcoat: 0.3 });
for (let i = 0; i < 4; i++) {
  const curve = new THREE.QuadraticBezierCurve3(V(-0.9, 0, 0), V(0, -0.45, 0), V(0.9, 0, 0));
  const b = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.2, 10, false), banMat);
  b.position.set(BX - 1.7 + i * 0.22, 1.25 + i * 0.05, -1.25 + i * 0.1); b.rotation.set(0.3, 0.4 + i * 0.1, 0.2); b.castShadow = true; scene.add(b);
}

// googly fruit faces (watchers) and talking tomato
const whiteMat = new THREE.MeshPhysicalMaterial({ color: '#fff', roughness: 0.2, clearcoat: 1 });
const blackMat = new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.3 });
function eyesOn(group, r, sep, y, z, lid = 0, lidColor = '#e0261b') {
  const eyes = [];
  for (const s of [-1, 1]) {
    const e = new THREE.Group(); e.position.set(s * sep, y, z);
    const w = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 16), whiteMat); w.scale.z = 0.7; e.add(w);
    const p = new THREE.Mesh(new THREE.SphereGeometry(r * 0.5, 16, 12), blackMat); p.position.z = r * 0.55; p.scale.z = 0.5; e.add(p); e.userData.p = p;
    const hl = new THREE.Mesh(new THREE.SphereGeometry(r * 0.15, 8, 6), new THREE.MeshBasicMaterial({ color: '#fff' })); hl.position.set(-r * 0.15, r * 0.15, r * 0.8); e.add(hl);
    if (lid > 0) { const l = new THREE.Mesh(new THREE.SphereGeometry(r * 1.06, 20, 12, 0, Math.PI * 2, 0, Math.PI * lid), new THREE.MeshPhysicalMaterial({ color: lidColor, roughness: 0.3, clearcoat: 0.8 })); l.rotation.x = 0.35; e.add(l); }
    group.add(e); eyes.push(e);
  }
  return eyes;
}
const watchers = [];
for (const [x, z, col, r] of [[BX - 2.0, -0.7, '#b5161c', 0.42], [BX + 2.05, -0.6, '#f28a12', 0.42], [BX - 0.7, -1.35, '#f4d81c', 0.36]]) {
  const g = new THREE.Group(); g.position.set(x, 1.45, z);
  const b = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 24), new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.35, clearcoat: 0.6 }));
  b.castShadow = true; g.add(b);
  const eyes = eyesOn(g, r * 0.26, r * 0.33, r * 0.15, r * 0.82); watchers.push({ g, eyes }); scene.add(g);
}
// tomato
const tomato = new THREE.Group(); tomato.position.set(BX, 2.05, -1.3); scene.add(tomato);
{
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.75, 48, 32), FRUIT.tomato.mat); b.scale.set(1.08, 0.86, 1.0); b.castShadow = true; tomato.add(b);
  const leafM = new THREE.MeshPhysicalMaterial({ color: '#3f8f2a', roughness: 0.5, side: THREE.DoubleSide });
  for (let i = 0; i < 6; i++) { const l = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.5, 8), leafM); const a = i / 6 * 6.28; l.position.set(Math.sin(a) * 0.22, 0.63, Math.cos(a) * 0.22); l.rotation.set(Math.cos(a) * 1.2, 0, -Math.sin(a) * 1.2); tomato.add(l); }
  const st = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.22, 8), leafM); st.position.y = 0.72; tomato.add(st);
  tomato.userData.eyes = eyesOn(tomato, 0.16, 0.24, 0.12, 0.62, 0.3);
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.09, 20, 12), new THREE.MeshStandardMaterial({ color: '#3d040c' }));
  mouth.position.set(0, -0.2, 0.66); mouth.scale.set(1.2, 0.15, 0.4); tomato.add(mouth); tomato.userData.mouth = mouth;
  const bl = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff6b6b', transparent: true, opacity: 0.5 }));
}

// ---------- giant hand ----------
const skin = new THREE.MeshPhysicalMaterial({ color: '#e9b48f', roughness: 0.55, sheen: 0.5, sheenColor: new THREE.Color('#ffd0b8'), clearcoat: 0.1 });
const hand = new THREE.Group(); scene.add(hand);
const palm = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), skin); palm.scale.set(2.3, 0.6, 1.7); palm.castShadow = true; hand.add(palm);
const wrist = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 12, 32), skin); wrist.position.set(0, 5.5, -2.2); wrist.rotation.x = -0.45; wrist.castShadow = true; hand.add(wrist);
const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.5, 8, 32), new THREE.MeshStandardMaterial({ color: '#3b5b8c', roughness: 0.8 })); sleeve.position.set(0, 10.5, -4.6); sleeve.rotation.x = -0.45; hand.add(sleeve);
const fingers = [];
for (let i = 0; i < 4; i++) {
  const piv = new THREE.Group(); piv.position.set(-1.55 + i * 1.03, -0.05, 1.45); hand.add(piv);
  const len = [1.9, 2.2, 2.1, 1.7][i];
  const seg1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, len * 0.5, 8, 16), skin); seg1.rotation.x = Math.PI / 2; seg1.position.z = len * 0.3; seg1.castShadow = true; piv.add(seg1);
  const piv2 = new THREE.Group(); piv2.position.z = len * 0.55; piv.add(piv2);
  const seg2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.33, len * 0.4, 8, 16), skin); seg2.rotation.x = Math.PI / 2; seg2.position.z = len * 0.28; seg2.castShadow = true; piv2.add(seg2);
  const nail = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 8), new THREE.MeshPhysicalMaterial({ color: '#f6d3c4', roughness: 0.2, clearcoat: 1 })); nail.scale.set(1, 0.4, 1.2); nail.position.set(0, 0.24, len * 0.45); piv2.add(nail);
  fingers.push([piv, piv2]);
}
const thumbPiv = new THREE.Group(); thumbPiv.position.set(-2.1, -0.1, 0.4); hand.add(thumbPiv);
const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 1.4, 8, 16), skin); thumb.rotation.set(Math.PI / 2, 0, 0.9); thumb.position.set(-0.5, 0, 0.6); thumbPiv.add(thumb);
function curlHand(k) { fingers.forEach(([a, b]) => { a.rotation.x = 0.35 + k * 1.0; b.rotation.x = 0.2 + k * 1.1; }); thumbPiv.rotation.y = -k * 0.6; }

// ---------- characters ----------
const bey = makeStrawberry('bey', { arms: ['hip', 'hip'] });
const han = makeStrawberry('hanim', { arms: ['hip', 'hip'] });
scene.add(bey, han);
const B = bey.userData.api, Hn = han.userData.api;
const bFeet = -bey.userData.feetY, hFeet = -han.userData.feetY;

// ---------- FX: hearts / sparkles / overlay ----------
function spriteTex(draw) { const c = document.createElement('canvas'); c.width = c.height = 128; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
const heartTex = spriteTex((x) => { x.fillStyle = '#ff3d7f'; x.shadowColor = '#ff9ac0'; x.shadowBlur = 16; x.beginPath(); x.moveTo(64, 108); x.bezierCurveTo(-10, 60, 20, 6, 64, 38); x.bezierCurveTo(108, 6, 138, 60, 64, 108); x.fill(); });
const sparkTex = spriteTex((x) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.2, 'rgba(255,230,240,0.8)'); g.addColorStop(1, 'rgba(255,200,220,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); x.fillStyle = '#fff'; x.fillRect(60, 8, 8, 112); x.fillRect(8, 60, 112, 8); });
const hearts = [], sparks = [];
for (let i = 0; i < 14; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: heartTex, transparent: true, depthWrite: false })); s.userData = { ph: rnd(), x: (rnd() - 0.5) * 3.2, z: (rnd() - 0.5) * 1.5 + 0.8, sp: 0.4 + rnd() * 0.5, sz: 0.25 + rnd() * 0.3 }; scene.add(s); hearts.push(s); }
for (let i = 0; i < 18; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); s.userData = { ph: rnd() * 6.28, x: (rnd() - 0.5) * 4, y: rnd() * 3.5, z: (rnd() - 0.5) * 2 + 0.5 }; scene.add(s); sparks.push(s); }
const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 200);
scene.add(camera);
const overlayTex = spriteTex((x) => { const g = x.createRadialGradient(64, 64, 20, 64, 64, 90); g.addColorStop(0, 'rgba(255,150,190,0.15)'); g.addColorStop(1, 'rgba(255,80,150,0.9)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); });
const overlay = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.0), new THREE.MeshBasicMaterial({ map: overlayTex, transparent: true, depthTest: false, depthWrite: false, opacity: 0 }));
overlay.position.z = -0.75; overlay.renderOrder = 999; camera.add(overlay);

// ---------- timeline helpers ----------
const lines = Object.values(LIP);
function speaking(who, t) {
  for (const l of lines) {
    if (l.who !== who) continue;
    const i = Math.floor((t - l.start) * FPS);
    if (i >= 0 && i < l.env.length) return l.env[i];
  }
  return -1;
}
function talkMouth(amp, rest, t) {
  if (amp < 0) return rest;
  if (amp > 0.55) return (Math.floor(t * 8) % 3 === 0) ? 'talkO' : 'talkA';
  if (amp > 0.18) return 'talkE';
  return rest === 'talkA' ? 'talkE' : (rest === 'O' ? 'O' : 'grin');
}
function pick(table, t) { let cur = table[0][1]; for (const [ts, v] of table) if (t >= ts) cur = v; return cur; }
function blinkAt(t, offs) { const per = 3.1; const ph = ((t + offs) % per); return ph < 0.13 ? 1 - Math.sin(ph / 0.13 * Math.PI) * 0.92 : 1; }

// expression tables [time, {eyes, brows, mouth, arms, sweat}]
const WORRY = { up: [0.08, 0.08], tilt: [-0.045, -0.045] };
const beyTab = [
  [0, { eyes: { lid: [0.25, 0.25], look: [0.2, 0] }, brows: { up: [0, 0.05], tilt: [0.02, -0.02] }, mouth: 'smirk', arms: ['hip', 'hip'] }],
  [1.15, { eyes: { look: [0.8, 0.1] }, brows: { up: [0.07, 0.07] }, mouth: 'O', arms: ['hip', 'hip'] }],
  [1.9, { eyes: { heart: true }, brows: { up: [0.06, 0.06], tilt: [-0.03, -0.03] }, mouth: 'smile', arms: ['heart', 'heart'] }],
  [8.4, { eyes: { lid: [0.28, 0.16], lidTilt: 0.1, look: [0.5, 0] }, brows: { up: [0, 0.08], tilt: [0.02, -0.03] }, mouth: 'smirk', arms: ['hip', 'hip'] }],
  [10.3, { eyes: { look: [0.6, -0.1] }, brows: { up: [0.04, 0.04] }, mouth: 'grin', arms: ['down', 'down'] }],
  [15.8, { eyes: { shock: true }, brows: { up: [0.11, 0.11] }, mouth: 'flat', arms: ['down', 'down'], sweat: true }],
  [16.55, { eyes: { look: [0.6, 0] }, brows: WORRY, mouth: 'frown', arms: ['open', 'open'], sweat: true }],
  [18.6, { eyes: { lid: [0.2, 0.2], look: [0.6, -0.1] }, brows: WORRY, mouth: 'frown', arms: ['down', 'down'] }],
  [20.55, { eyes: { look: [0.6, 0] }, brows: { up: [0.06, 0.06] }, mouth: 'talkE', arms: ['open', 'open'] }],
  [21.2, { eyes: { shock: true, look: [0, 0.9] }, brows: { up: [0.12, 0.12] }, mouth: 'O', arms: ['down', 'down'] }],
  [22.0, { eyes: { shock: true, look: [0, 0.3] }, brows: { up: [0.12, 0.12] }, mouth: 'talkA', arms: ['up', 'up'] }],
  [23.95, { eyes: { look: [-0.6, 0.1] }, brows: WORRY, mouth: 'O', arms: ['down', 'down'] }],
  [24.6, { eyes: { look: [-0.4, 0.2] }, brows: WORRY, mouth: 'frown', arms: ['open', 'open'] }],
  [25.5, { eyes: { look: [0.7, 0] }, brows: { up: [0.06, 0.06], tilt: [-0.02, -0.02] }, mouth: 'flat', arms: ['down', 'down'] }],
  [27.65, { eyes: { lid: [0.18, 0.18], look: [0.8, 0] }, brows: { up: [0.03, 0.03] }, mouth: 'grin', arms: ['down', 'down'] }],
];
const hanTab = [
  [0, { eyes: { lid: [0.3, 0.3], look: [-0.3, 0] }, brows: {}, mouth: 'smirkL', arms: ['hip', 'hip'] }],
  [5.0, { eyes: { lid: [0.35, 0.35], look: [-0.3, 0.1] }, brows: { up: [0.06, 0] }, mouth: 'smile', arms: ['hip', 'wave'] }],
  [6.8, { eyes: { lid: [0.35, 0.35], look: [-0.5, 0.1] }, brows: { up: [0.06, 0] }, mouth: 'smile', arms: ['hip', 'hip'] }],
  [8.4, { eyes: { lid: [0.3, 0.3], look: [-0.6, 0] }, brows: {}, mouth: 'smirkL', arms: ['hip', 'hip'] }],
  [10.3, { eyes: { lid: [0.52, 0.52], look: [-0.7, 0] }, brows: { tilt: [0.05, 0.05] }, mouth: 'flat', arms: ['hip', 'hip'] }],
  [11.0, { eyes: { lid: [0.45, 0.45], look: [-0.6, -0.3] }, brows: { tilt: [0.04, 0.04] }, mouth: 'flat', arms: ['down', 'down'] }],
  [12.9, { eyes: { lid: [0.1, 0.1], look: [-0.6, -0.5] }, brows: { up: [0.09, 0.02] }, mouth: 'O', arms: ['down', 'down'] }],
  [13.55, { eyes: { lid: [0.4, 0.4], look: [-0.6, 0] }, brows: { up: [0, 0.08], tilt: [0.03, 0] }, mouth: 'smirkL', arms: ['cross', 'cross'] }],
  [18.6, { eyes: { lid: [0.5, 0.5], look: [-0.3, 0.3] }, brows: { up: [0.08, 0] }, mouth: 'smirkL', arms: ['cross', 'cross'] }],
  [21.2, { eyes: { shock: true, look: [0, 0.9] }, brows: { up: [0.1, 0.1] }, mouth: 'O', arms: ['down', 'down'] }],
  [22.0, { eyes: { shock: true, look: [0, 0.3] }, brows: { up: [0.1, 0.1] }, mouth: 'O', arms: ['up', 'up'] }],
  [23.95, { eyes: { lid: [0.4, 0.4], look: [-0.5, 0] }, brows: { tilt: [0.03, 0.03] }, mouth: 'flat', arms: ['cross', 'cross'] }],
  [25.7, { eyes: { lid: [0.25, 0.25], look: [0, 0.9] }, brows: { up: [0.06, 0.06] }, mouth: 'smirkL', arms: ['cross', 'cross'] }],
  [26.3, { eyes: { lid: [0.42, 0.42], look: [-0.6, 0] }, brows: { up: [0.07, 0] }, mouth: 'smirkL', arms: ['cross', 'cross'] }],
  [27.65, { eyes: { lid: [0.22, 0.22], look: [-0.8, 0] }, brows: {}, mouth: 'grin', arms: ['down', 'down'] }],
];

// positions
const BEY0 = V(-1.3, SURF, 0.1), HAN0 = V(1.3, SURF, 0.0);
const hopPts = [V(1.3, SURF, 0.0), V(1.15, SURF, 0.45), V(0.95, SURF, 0.8), V(0.8, SURF, 1.05), V(0.7, SURF, 1.15)];
const HOPS = TL.hops;
function hanPos(t) {
  if (t < HOPS[0]) return { p: HAN0.clone(), yaw: -0.45, hop: 0 };
  for (let i = 0; i < HOPS.length; i++) {
    if (t < HOPS[i] + 0.45) {
      const k = clamp((t - HOPS[i]) / 0.42); const a = hopPts[i], b = hopPts[i + 1];
      const p = a.clone().lerp(b, ease(k)); p.y += Math.sin(Math.PI * k) * 0.45;
      return { p, yaw: lerp(-0.6, -1.3, (i + k) / 4), hop: k };
    }
    if (i + 1 < HOPS.length && t < HOPS[i + 1]) return { p: hopPts[i + 1].clone(), yaw: lerp(-0.6, -1.3, (i + 1) / 4), hop: 0 };
  }
  const end = hopPts[4].clone();
  if (t < 13.55) return { p: end, yaw: -1.3, hop: 0, lean: ease((t - 12.6) / 0.4) * 0.22 };
  if (t < 20.0) return { p: end, yaw: lerp(-1.3, -0.65, ease((t - 13.55) / 0.4)), hop: 0 };
  // step back next to bey before the hand
  const k = ease((t - 20.0) / 0.45);
  return { p: end.clone().lerp(V(0.95, SURF, 0.55), k).add(V(0, Math.sin(Math.PI * clamp((t - 20) / 0.45)) * 0.35, 0)), yaw: lerp(-0.65, -0.1, k), hop: 0 };
}

// camera shots
function shot(t) {
  const bc = bey.position.clone().add(V(0, 0.15, 0)), hc = han.position.clone().add(V(0, 0.2, 0));
  const S = (t0, t1) => clamp((t - t0) / (t1 - t0));
  if (t < 1.9) { const k = ease(S(0, 1.9)); return { p: V(lerp(0.5, -0.6, k), lerp(4.6, 3.4, k), lerp(15, 9.5, k)), l: V(lerp(0, -0.6, k), 2.6, 0), f: 40 }; }
  if (t < 5.0) { const k = S(1.9, 5.0); return { p: bc.clone().add(V(lerp(1.4, 1.1, k), 0.5, lerp(5.8, 5.0, k))), l: bc.clone().add(V(0.15, 0.1, 0)), f: 40 }; }
  if (t < 8.4) { const k = S(5.0, 8.4); return { p: hc.clone().add(V(lerp(-1.3, -1.0, k), 0.5, lerp(5.5, 4.8, k))), l: hc.clone().add(V(-0.1, 0.1, 0)), f: 40 }; }
  if (t < 10.3) { const k = S(8.4, 10.3); return { p: bc.clone().add(V(1.3, lerp(0.35, 0.6, k), lerp(5.2, 5.6, k))), l: bc.clone().add(V(0.15, 0.15, 0)), f: 40 }; }
  if (t < 11.0) { const k = S(10.3, 11.0); return { p: hc.clone().add(V(-1.0, 0.4, lerp(4.5, 4.0, k))), l: hc.clone().add(V(-0.1, 0.15, 0)), f: 40 }; }
  if (t < 13.3) { const k = S(11.0, 13.3); return { p: V(lerp(3.6, 2.8, k), 3.3, lerp(8.6, 7.4, k)), l: V(-0.2, 2.5, 0.4), f: 40 }; }
  if (t < 13.9) { // sticker insert
    const st = B.sticker; st.updateMatrixWorld(); const wp = st.getWorldPosition(V(0, 0, 0)); const n = V(0, 0, 1).applyQuaternion(st.getWorldQuaternion(new THREE.Quaternion()));
    const k = S(13.3, 13.9); return { p: wp.clone().addScaledVector(n, lerp(1.6, 1.1, k)).add(V(0, 0.1, 0)), l: wp, f: 40 };
  }
  if (t < 15.8) { const k = S(13.9, 15.8); const fw = V(Math.sin(han.rotation.y), 0, Math.cos(han.rotation.y)); return { p: hc.clone().addScaledVector(fw, lerp(5.0, 4.6, k)).add(V(-0.3, 0.45, 0.3)), l: hc.clone().add(V(0, 0.1, 0)), f: 40 }; }
  if (t < 18.6) { const k = ease(S(15.8, 16.4)); return { p: bc.clone().add(V(0.9, 0.4, 5.0)), l: bc.clone().add(V(0.1, 0.1, 0)), f: lerp(40, 31, k) }; }
  if (t < 20.5) { const k = S(18.6, 20.5); const fw = V(Math.sin(-0.65), 0, Math.cos(-0.65)); return { p: hc.clone().addScaledVector(fw, lerp(4.9, 4.5, k)).add(V(0, 0.45, 0.2)), l: hc.clone().add(V(0, 0.1, 0)), f: 40 }; }
  if (t < 23.4) { const k = S(20.5, 23.4); return { p: V(-0.2, lerp(3.6, 4.2, k), lerp(11.5, 12.5, k)), l: V(-0.2, lerp(3.6, 4.6, k), 0.3), f: 40 }; }
  if (t < 28.1) { const k = S(23.4, 28.1); return { p: V(BX, lerp(5.6, 5.2, k), lerp(8.8, 7.8, k)), l: V(BX, 2.0, 0), f: 40 }; }
  { const k = ease(S(28.1, 28.55)); return { p: V(BX, lerp(5.2, 4.9, k), lerp(7.8, 3.9, k)), l: V(BX, lerp(2.0, 2.1, k), lerp(0, -1.3, k)), f: 40 }; }
}

// ---------- frame ----------
const HAND_X = -0.2, HAND_Z = 0.5;
window.frame = (tIn) => {
  const t = Math.min(tIn, TL.freeze);
  const inBasket = t >= 23.4;
  // ---- hand
  let handY = 30, curl = 0.15, lift = 0;
  if (t >= TL.handIn && t < 23.4) {
    handY = lerp(14, 5.0, ease((t - TL.handIn) / 1.3));
    curl = lerp(0.15, 1.0, ease((t - TL.grab) / 0.3));
    lift = Math.pow(clamp((t - TL.handLift) / 0.85), 2) * 9;
    handY += lift;
  }
  hand.position.set(HAND_X, handY, HAND_Z); hand.visible = !inBasket && t >= TL.handIn; curlHand(curl);

  // ---- characters state
  const be = pick(beyTab, t), he = pick(hanTab, t);
  const bAmp = speaking('B', t), hAmp = speaking('H', t);
  B.setFace({ eyes: be.eyes, brows: be.brows, mouth: talkMouth(bAmp, be.mouth, t) }); B.setArms(be.arms); B.sweat(!!be.sweat);
  Hn.setFace({ eyes: he.eyes, brows: he.brows, mouth: talkMouth(hAmp, he.mouth, t) }); Hn.setArms(he.arms); Hn.sweat(false);
  B.blink(be.eyes.heart || be.eyes.shock ? 1 : blinkAt(t, 0.4));
  Hn.blink(he.eyes.shock ? 1 : blinkAt(t, 1.9));

  const bob = (ph, amp) => Math.sin(t * 2.4 + ph) * amp;
  if (!inBasket) {
    // bey
    let bp = BEY0.clone(), byaw = 0.45, bsq = 1 + bob(0, 0.012), bt = 0;
    if (t < 1.15) byaw = 0.15; else if (t < 1.9) byaw = lerp(0.15, 0.55, ease((t - 1.15) / 0.4));
    if (t >= 1.9 && t < 8.4) { byaw = 0.5; bt = Math.sin(t * 3) * 0.05; bp.y += Math.abs(Math.sin(t * 3)) * 0.05; }
    if (t >= 8.4 && t < 10.3) { const k = ease((t - 8.75) / 0.25) * (1 - ease((t - 9.9) / 0.3)); bsq = 1 + 0.07 * k; byaw = 0.35; }
    if (t >= 11 && t < 15.8) byaw = lerp(0.45, 0.75, ease((t - 11) / 1.5));
    if (t >= 15.8 && t < 16.55) { bsq = 1; bt = Math.sin(t * 60) * 0.006; }
    if (t >= 16.55 && t < 18.6) bt = Math.sin(t * 5) * 0.03;
    if (bAmp > 0) bsq += bAmp * 0.02;
    // hand lift
    let bHang = 0;
    if (t >= TL.grab) { bp.x = lerp(bp.x, -1.05, ease((t - TL.grab) / 0.3)); bp.y += lift; bHang = Math.sin(t * 9) * 0.08; }
    bey.position.copy(bp).add(V(0, bFeet * bsq, 0)); bey.rotation.set(0, byaw, bt + bHang); bey.scale.set(1 / Math.sqrt(bsq), bsq, 1 / Math.sqrt(bsq));
    // hanim
    const hp = hanPos(t); let hsq = 1 + bob(1.3, 0.012); if (hp.hop) hsq = 1 + Math.sin(Math.PI * hp.hop) * 0.08 - (hp.hop > 0.85 ? 0.08 : 0);
    if (hAmp > 0) hsq += hAmp * 0.02;
    let hpp = hp.p.clone(); let hHang = 0;
    if (t >= TL.grab) { hpp.x = lerp(hpp.x, 0.75, ease((t - TL.grab) / 0.3)); hpp.y += lift; hHang = Math.sin(t * 9 + 1) * 0.08; }
    han.position.copy(hpp).add(V(0, hFeet * hsq, 0)); han.rotation.set(hp.lean || 0, hp.yaw, hHang + (t > 5 && t < 6.8 ? Math.sin(t * 4) * 0.04 : 0)); han.scale.set(1 / Math.sqrt(hsq), hsq, 1 / Math.sqrt(hsq));
  } else {
    // drop into basket
    const drop = (t0, x, yaw) => {
      const k = clamp((t - t0) / 0.28); let y = lerp(5.5, 0, k * k);
      let sq = 1; if (k >= 1) { const d = t - t0 - 0.28; sq = 1 - Math.exp(-d * 9) * Math.sin(d * 28) * 0.18; }
      return { p: V(BX + x, 1.35 + y, 0.55), sq, yaw };
    };
    let byaw = 0.35, hyaw = -0.35;
    if (t >= 24.6 && t < 25.5) byaw = 0.35 + Math.sin((t - 24.6) * 7) * 0.35;
    if (t >= 27.6) { const k = ease((t - 27.6) / 0.4); byaw = lerp(0.35, 0.85, k); hyaw = lerp(-0.35, -0.85, k); }
    const bd = drop(TL.drop - 0.25, -1.4, byaw), hd = drop(TL.drop - 0.17, 1.4, hyaw);
    const bsq = bd.sq + (bAmp > 0 ? bAmp * 0.02 : 0), hsq = hd.sq + (hAmp > 0 ? hAmp * 0.02 : 0);
    bey.position.copy(bd.p).add(V(0, bFeet * bsq, 0)); bey.rotation.set(0, bd.yaw, 0.04); bey.scale.set(1 / Math.sqrt(bsq), bsq, 1 / Math.sqrt(bsq));
    han.position.copy(hd.p).add(V(0, hFeet * hsq, 0)); han.rotation.set(0, hd.yaw, -0.04); han.scale.set(1 / Math.sqrt(hsq), hsq, 1 / Math.sqrt(hsq));
  }
  // watchers look at the strawberries
  watchers.forEach((w) => { const target = t < 28.1 ? (w.g.position.x < BX ? bey.position : han.position) : V(BX, 3, 8); w.eyes.forEach((e) => { const d = target.clone().sub(w.g.position).normalize(); e.userData.p.position.x = d.x * 0.05; e.userData.p.position.y = 0.04 + d.y * 0.04; }); });
  // tomato
  const dAmp = speaking('D', t);
  tomato.userData.mouth.scale.y = dAmp > 0 ? 0.15 + dAmp * 0.9 : 0.15;
  tomato.rotation.y = t > 28.1 ? 0 : 0.3; tomato.userData.eyes.forEach((e) => { e.userData.p.position.x = t > 28.15 ? 0 : -0.03; });

  // ---- FX
  const love = t >= 1.9 && t < 5.2 ? Math.min(1, (t - 1.9) / 0.4) * (1 - clamp((t - 4.8) / 0.4)) : 0;
  overlay.material.opacity = love * 0.55;
  loveLight.intensity = love * 18; loveLight.position.copy(bey.position).add(V(0.6, 0.5, 1.8));
  hearts.forEach((s) => { const u = s.userData; const ph = ((t - 1.9) * u.sp + u.ph) % 1; s.visible = love > 0.02; s.material.opacity = love * Math.sin(Math.PI * ph);
    s.position.set(bey.position.x + u.x + Math.sin(t * 2 + u.ph * 6) * 0.15, bey.position.y - 0.6 + ph * 2.6, bey.position.z + u.z); s.scale.setScalar(u.sz * (0.7 + ph * 0.6)); });
  sparks.forEach((s) => { const u = s.userData; s.visible = love > 0.02; s.material.opacity = love * Math.max(0, Math.sin(t * 5 + u.ph)); s.position.set(bey.position.x + u.x, bey.position.y - 1 + u.y, bey.position.z + u.z); s.scale.setScalar(0.18); });

  // ---- lights follow the action
  const focus = inBasket ? V(BX, 1.5, 0) : V(0, 2, 0);
  key.position.copy(focus).add(V(-4, 9, 7)); key.target.position.copy(focus);
  rim.position.copy(focus).add(V(4, 5, -6)); rim.target.position.copy(focus);
  fill.position.copy(focus).add(V(0, 2.5, 5));

  // ---- camera
  const c = shot(t);
  camera.position.copy(c.p); camera.fov = c.f; camera.updateProjectionMatrix(); camera.lookAt(c.l);
  renderer.render(scene, camera);
  return renderer.domElement.toDataURL('image/jpeg', 0.93);
};
window.READY = true;
