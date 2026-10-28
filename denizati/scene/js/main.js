import * as THREE from 'three';
import { clamp, lerp, remap, ss, easeInOut, easeOut, window01, v3, canvasTexture, rng } from './util.js';
import { createSeahorse, bakeBaby } from './seahorse.js';
import { createReef } from './reef.js';
import { Post } from './post.js';

// ===========================================================================
//  "Deniz Atlarının Şaşırtıcı Dünyası — Erkekler Doğum Yapıyor!"
//  Vertical 1080×1920, 50 s. Every frame is a pure function of t.
//  The timeline follows the narration word timings (audio/words.json, +0.25 s).
//  Sites on one reef: A hook (origin) · B egg transfer · M seagrass meadow
//  (pregnancy + birth) · D courtship dance · F finale.
// ===========================================================================
const W = 1080, H = 1920;
export const FPS = 30;
export const DURATION = 50.0;

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const post = new Post(renderer, W, H);
post.finalMat.uniforms.lift.value.set(0.0, 0.015, 0.03);
post.finalMat.uniforms.gain.value.set(1.0, 1.0, 0.98);
post.finalMat.uniforms.saturation.value = 1.18;
const SUBS = await fetch('./subtitles.json').then((r) => r.json());

// ---------------- helpers ----------------
function spline(keys) {
  const ts = keys.map((k) => k[0]);
  const ps = keys.map((k) => k.slice(1));
  const n = ts.length;
  const ms = ps.map((p, i) => (i === 0 || i === n - 1 ? p.map(() => 0) : p.map((_, j) => (ps[i + 1][j] - ps[i - 1][j]) / (ts[i + 1] - ts[i - 1]))));
  return (t) => {
    if (t <= ts[0]) return ps[0].slice();
    if (t >= ts[n - 1]) return ps[n - 1].slice();
    let i = 0;
    while (t > ts[i + 1]) i++;
    const h = ts[i + 1] - ts[i], s = (t - ts[i]) / h, s2 = s * s, s3 = s2 * s;
    const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
    return ps[i].map((_, j) => h00 * ps[i][j] + h10 * h * ms[i][j] + h01 * ps[i + 1][j] + h11 * h * ms[i + 1][j]);
  };
}
const blinkAt = (t, list, d = 0.16) => list.reduce((m, b) => Math.max(m, Math.exp(-(((t - b) / (d / 2.5)) ** 2))), 0);
const BLINKS = [1.0, 3.8, 6.4, 9.1, 11.2, 15.9, 19.0, 23.6, 27.4, 30.2, 33.0, 37.4, 39.6, 44.0, 46.8, 48.9];
const pulse = (t, a, d = 0.6) => Math.max(0, Math.sin(Math.PI * clamp((t - a) / d))) ** 1.5;

// ---------------- world ----------------
const reef = createReef();
const scene = reef.scene;
const dad = createSeahorse({ sex: 'male', seed: 3 });
const mom = createSeahorse({ sex: 'female', seed: 8, headScale: 1.1 });
scene.add(dad.root, mom.root);
for (const s of [dad, mom]) s.root.rotation.order = 'YXZ';
const cam = new THREE.PerspectiveCamera(34, W / H, 0.02, 600);
function place(s, p, yaw, pose, roll = 0, pitch = 0) {
  s.root.position.set(p[0], p[1], p[2]);
  s.root.rotation.set(pitch, yaw, roll);
  s.root.updateMatrixWorld(true);
  return s.setPose(pose);
}
const A = v3(0, 1.35, 0), B = v3(3.2, 0, -3.2), M = v3(-5, 1.25, 3), D = v3(2.4, 0, 2.6), F = v3(0.3, 1.35, 0.6);

// ---- eggs (S2 transfer) ----
const NE = 46;
const eggs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.019, 12, 8), new THREE.MeshStandardMaterial({ color: '#ff9a2a', emissive: '#ff6a00', emissiveIntensity: 0.6, roughness: 0.25 }), NE);
eggs.frustumCulled = false;
scene.add(eggs);
const ER = rng(4);
const eggSeeds = Array.from({ length: NE }, () => [ER(), ER(), ER()]);

// ---- babies (instanced baked mini seahorses) ----
const baked = bakeBaby();
const NBABY = 300;
const babyMat = baked.skin.clone();
babyMat.map = baked.skin.map;
babyMat.transparent = true;
babyMat.opacity = 0.92;
babyMat.sheen = 0.4;
const babies = new THREE.InstancedMesh(baked.body, babyMat, NBABY);
const babyEyes = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshStandardMaterial({ color: '#141018', roughness: 0.15 }), NBABY * 2);
babies.frustumCulled = babyEyes.frustumCulled = false;
babies.castShadow = true;
scene.add(babies, babyEyes);
const eyeLocal = baked.eyes.map((g) => { g.computeBoundingSphere(); return { c: g.boundingSphere.center.clone(), r: g.boundingSphere.radius }; });
const BR = rng(17);
const babySeeds = Array.from({ length: NBABY }, (_, i) => ({ a: BR() * 6.283, b: BR(), c: BR(), d: BR(), s: 0.11 + BR() * 0.05, ph: BR() * 6.283, i }));
// birth bursts during the contractions: [time, count]
const BURSTS = [[15.4, 6], [16.25, 10], [17.1, 14], [17.95, 22], [18.8, 30], [19.65, 40], [20.5, 52], [21.35, 56], [22.2, 40], [23.1, 30]];
const birth = [];
{
  let k = 0;
  for (const [tb, n] of BURSTS) for (let j = 0; j < n && k < NBABY; j++, k++) birth.push(tb + 0.04 * j * (0.4 + babySeeds[k].d));
  while (birth.length < NBABY) birth.push(1e9);
}
const CONTRACT = BURSTS.map((b) => b[0] - 0.25).concat([14.3]);
let BIRTH_P = null, BIRTH_DIR = null; // pouch opening / outward direction, from the rest pose at the meadow

const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e4 = new THREE.Euler();
function setBaby(i, p, yaw, tilt, s, visible) {
  if (!visible) { m4.makeScale(0, 0, 0); babies.setMatrixAt(i, m4); babyEyes.setMatrixAt(i * 2, m4); babyEyes.setMatrixAt(i * 2 + 1, m4); return; }
  q4.setFromEuler(e4.set(tilt, yaw, 0.15 * Math.sin(yaw * 3), 'YXZ'));
  m4.compose(p, q4, v3(s, s, s));
  babies.setMatrixAt(i, m4);
  for (let k = 0; k < 2; k++) {
    const el = eyeLocal[k];
    const pe = el.c.clone().multiplyScalar(s).applyQuaternion(q4).add(p);
    babyEyes.setMatrixAt(i * 2 + k, new THREE.Matrix4().compose(pe, q4, v3(1, 1, 1).multiplyScalar(el.r * s * 1.02)));
  }
}
// S4: babies leave the pouch in bursts, then drift up and spread into a cloud
function babiesBirth(t) {
  for (let i = 0; i < NBABY; i++) {
    const tb = birth[i], e = t - tb, sd = babySeeds[i];
    if (e < 0) { setBaby(i, v3(), 0, 0, 0, false); continue; }
    const out = BIRTH_DIR.clone().multiplyScalar(0.35 + sd.b * 0.35).add(v3(Math.cos(sd.a) * 0.85, 0.45 + sd.c * 0.9, Math.sin(sd.a) * 0.45 - 0.45)); // up and around, not into the lens
    const k = 2.2;
    const p = BIRTH_P.clone().addScaledVector(out, (1 - Math.exp(-k * e)) / k * 1.4);
    p.y += 0.09 * e + 0.05 * Math.sin(e * 2 + sd.ph);
    p.x += 0.06 * Math.sin(e * 1.3 + sd.ph);
    p.z += 0.06 * Math.cos(e * 1.1 + sd.ph);
    const grow = ss(0, 0.25, e);
    setBaby(i, p, sd.a + 0.4 * Math.sin(e * 1.5 + sd.ph), 0.15 * Math.sin(e * 3 + sd.ph), sd.s * (0.4 + 0.6 * grow), true);
  }
}
// S6: babies swim in from the corners of the screen and gather around the parents
function babiesFinale(t, center) {
  const n = 64;
  for (let i = 0; i < NBABY; i++) {
    if (i >= n) { setBaby(i, v3(), 0, 0, 0, false); continue; }
    const sd = babySeeds[i];
    const corner = i % 4;
    const t0 = 36.6 + (i >> 2) * 0.12 + sd.b * 0.3;
    const u = easeOut(clamp((t - t0) / 3.2));
    const start = center.clone().add(v3((corner % 2 ? 1 : -1) * (1.6 + sd.c), (corner < 2 ? 1.7 : -1.1) + sd.d * 0.4, 0.4 + sd.b));
    const ang = sd.a, rr = 0.55 + sd.c * 0.9;
    const target = center.clone().add(v3(Math.cos(ang) * rr, -0.35 + sd.d * 1.1 + 0.08 * Math.sin(t * 1.4 + sd.ph), Math.sin(ang) * rr * 0.6 - 0.2));
    const p = start.lerp(target, u);
    p.x += 0.05 * Math.sin(t * 1.7 + sd.ph) * u;
    const yaw = u < 0.95 ? Math.atan2(target.x - start.x, target.z - start.z) : 0.6 * Math.sin(t * 0.8 + sd.ph);
    setBaby(i, p, yaw, 0.12 * Math.sin(t * 3 + sd.ph), sd.s, t > t0);
  }
}

// ---- hearts (S5) ----
const heartTex = canvasTexture(128, 128, (g, w, h) => {
  g.fillStyle = '#ff4f8b';
  g.beginPath();
  g.moveTo(64, 112);
  g.bezierCurveTo(10, 72, 8, 30, 38, 22);
  g.bezierCurveTo(54, 18, 62, 30, 64, 40);
  g.bezierCurveTo(66, 30, 74, 18, 90, 22);
  g.bezierCurveTo(120, 30, 118, 72, 64, 112);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.7)';
  g.beginPath(); g.arc(42, 42, 9, 0, 6.283); g.fill();
});
const NH = 26;
const hGeo = new THREE.BufferGeometry();
hGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NH * 3), 3));
const hearts = new THREE.Points(hGeo, new THREE.PointsMaterial({ map: heartTex, size: 0.14, transparent: true, depthWrite: false, opacity: 0 }));
hearts.frustumCulled = false;
scene.add(hearts);
const HR = rng(31);
const heartSeeds = Array.from({ length: NH }, () => [HR() * 6.283, HR(), HR()]);

// ---- bursts of bubbles tied to actions (pure functions of t) ----
const NBB = 120;
const bbGeo = new THREE.BufferGeometry();
bbGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NBB * 3), 3));
const bubbleTex = canvasTexture(64, 64, (g, w, h) => {
  g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 4; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 4, 0, 6.283); g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.2)'; g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(w * 0.36, h * 0.34, 6, 0, 6.283); g.fill();
});
const bursts = new THREE.Points(bbGeo, new THREE.PointsMaterial({ map: bubbleTex, size: 0.06, transparent: true, depthWrite: false }));
bursts.frustumCulled = false;
scene.add(bursts);
const BBR = rng(41);
const bbSeeds = Array.from({ length: NBB }, () => [BBR() * 6.283, BBR(), BBR()]);
function updateBursts(t, list) {
  // list: [[t0, position]] — the most recent burst plays
  let cur = null;
  for (const b of list) if (t >= b[0] && t < b[0] + 2.5) cur = b;
  bursts.visible = !!cur;
  if (!cur) return;
  const e = t - cur[0], arr = bbGeo.attributes.position.array;
  for (let i = 0; i < NBB; i++) {
    const [a, r, s] = bbSeeds[i];
    const tt = Math.max(0, e - s * 0.4);
    arr.set([cur[1].x + Math.cos(a) * r * 0.35 * (1 - Math.exp(-tt * 4)) + 0.03 * Math.sin(tt * 9 + a), cur[1].y + tt * (0.5 + r * 0.6), cur[1].z + Math.sin(a) * r * 0.35 * (1 - Math.exp(-tt * 4))], i * 3);
  }
  bbGeo.attributes.position.needsUpdate = true;
  bursts.material.opacity = 1 - clamp((e - 1.6) / 0.9);
}

// ===========================================================================
//  SHOTS
// ===========================================================================
const CUTS = [5.75, 10.4, 25.4, 36.4];

// ---- S1 (0–5.75): hook — dad turns to the camera, camera rushes in ----
const C1 = spline([[0, 1.6, 2.3, 7.2, 0, 1.4, 0], [0.4, 1.4, 2.2, 6.4, 0, 1.45, 0], [2.3, 0.3, 1.72, 1.9, 0, 1.6, 0], [5.75, 0.5, 1.68, 1.75, 0.02, 1.6, 0]]);
function shot1(t) {
  const turn = easeInOut(remap(t, 0.7, 1.7));
  const bob = 0.04 * Math.sin(t * 1.6);
  const nod = window01(t, 4.0, 5.4, 0.2) * 0.22 * Math.sin((t - 4.0) * 9);
  place(dad, [A.x, A.y + bob, A.z], lerp(-Math.PI / 2, -0.28, turn), {
    t, curl: 1.15, tailSway: 0.25, headYaw: 0.35 * turn * (1 - ss(2.2, 3.0, t)), headPitch: nod - 0.1 * window01(t, 2.4, 3.6, 0.2), breathe: t * 2,
    wide: window01(t, 2.45, 3.7, 0.15), happy: ss(4.1, 4.5, t), blush: ss(4.2, 4.8, t), blink: blinkAt(t, BLINKS), eyeX: -0.3 * turn, lid: 0.1,
  }, 0.04 * Math.sin(t * 1.1));
  mom.root.visible = false;
  const c = C1(t);
  return { cam: c.slice(0, 3), look: c.slice(3), fov: 34, focus: dad.world.head, ap: 7, key: A };
}

// ---- S2 (5.75–10.4): the female passes her eggs into the male's pouch ----
function shot2(t) {
  const u = t - 5.75;
  const rise = 1.25 + 0.06 * u;
  const sway = 0.03 * Math.sin(t * 1.7);
  const close = ss(5.9, 6.9, t);
  place(dad, [B.x - 0.21 - 0.12 * (1 - close), rise + sway, B.z], Math.PI / 2, {
    t, curl: 1.05, tailSway: 0.18, pouch: 0.35 + 0.2 * ss(7, 9.8, t), headPitch: -0.05, headYaw: 0.1, breathe: t * 2.4, blink: blinkAt(t, BLINKS),
    happy: 0.35, blush: 0.6 * ss(7, 8, t), eyeX: 0.2, bend: -0.06 * close,
  }, 0, -0.04 * close);
  place(mom, [B.x + 0.19 + 0.12 * (1 - close), rise + 0.16 + sway, B.z], -Math.PI / 2, {
    t, curl: 1.0, tailSway: 0.2, headPitch: -0.05, breathe: t * 2.4 + 1, blink: blinkAt(t + 0.3, BLINKS), happy: 0.35, blush: 0.6, eyeX: 0.2, bend: -0.08 * close,
  }, 0, -0.06 * close);
  mom.root.visible = true;
  // eggs travel from her ovipositor into his pouch
  const a = mom.world.ovi, b = dad.world.pouchOpen;
  for (let i = 0; i < NE; i++) {
    const [s1, s2, s3] = eggSeeds[i];
    const t0 = 6.9 + (i / NE) * 2.8 + s1 * 0.1;
    const f = clamp((t - t0) / 0.55);
    if (f <= 0 || f >= 1) { eggs.setMatrixAt(i, m4.makeScale(0, 0, 0)); continue; }
    const p = a.clone().lerp(b, f).add(v3(0, 0.04 * Math.sin(Math.PI * f) * (s2 - 0.3), (s3 - 0.5) * 0.04 * Math.sin(Math.PI * f)));
    eggs.setMatrixAt(i, m4.compose(p, q4.identity(), v3(1, 1, 1).multiplyScalar(0.8 + 0.4 * s2)));
  }
  eggs.instanceMatrix.needsUpdate = true;
  eggs.visible = true;
  const mid = a.clone().lerp(b, 0.5);
  const c = spline([[5.75, B.x + 0.6, 1.75, B.z + 2.7, B.x, 1.3, B.z], [7.4, B.x + 0.15, 1.5, B.z + 1.45, mid.x, mid.y + 0.06, B.z], [10.4, B.x - 0.1, 1.5, B.z + 1.45, mid.x, mid.y + 0.06, B.z]])(t);
  return { cam: c.slice(0, 3), look: c.slice(3), fov: 34, focus: mid, ap: 8, key: B.clone().setY(1.3), eggMid: mid };
}

// ---- S3+S4 (10.4–25.4): pregnant dad in the seagrass → embryos → birth ----
function shotMeadow(t) {
  const xray = window01(t, 12.25, 14.15, 0.3);
  const stage = ss(12.5, 13.9, t);
  let contract = 0;
  for (const c of CONTRACT) contract = Math.max(contract, pulse(t, c, 0.65));
  if (t < 14.1) contract = 0;
  const yaw = -0.6; // 3/4 profile: the pouch faces the camera side, the held stalk falls behind
  const bob = 0.02 * Math.sin(t * 1.3);
  place(dad, [M.x, M.y + bob, M.z], yaw, {
    t, curl: 1.35, tailSway: 0.04, pouch: 1 - 0.55 * ss(15.2, 23.5, t), contract, headPitch: -0.12 * contract + 0.05 * Math.sin(t * 0.7),
    headYaw: 0.2 + 0.35 * ss(22.4, 23.5, t), breathe: t * 2.2, blink: blinkAt(t, BLINKS), xray, stage,
    happy: 0.25 + 0.6 * ss(22.6, 23.4, t), blush: 0.3 + 0.6 * ss(22.6, 23.4, t), wide: 0.6 * window01(t, 17.6, 18.6, 0.2), eyeX: 0.15, bend: -0.1 * contract,
  }, 0, -0.08 * contract);
  mom.root.visible = false;
  // the seagrass stalk passes through the tail curl
  // the stalk passes through the tail curl and leans away sideways, so it never hides the pouch
  {
    const cu = dad.world.tailCurl;
    const away = v3(-0.45, 0, -0.89); // away from the meadow cameras (they sit at +x/+z)
    const dir = away.multiplyScalar(0.18).add(v3(0, 1, 0)).normalize();
    const base = cu.clone().addScaledVector(dir, -cu.y / dir.y);
    reef.stalk.position.copy(base);
    reef.stalk.quaternion.setFromUnitVectors(v3(0, 1, 0), dir);
    reef.stalk.scale.set(1, 2.6, 1);
    reef.stalk.visible = true;
  }
  if (!BIRTH_P) {
    BIRTH_P = dad.world.pouchOpen.clone();
    BIRTH_DIR = dad.world.pouchOpen.clone().sub(dad.world.belly).setY(0).normalize();
  }
  babiesBirth(t);
  const P = dad.world.pouchCenter;
  const cam = spline([
    [10.4, M.x + 1.6, 1.7, M.z + 2.0, M.x, 1.2, M.z], [12.2, M.x + 1.2, 1.5, M.z + 1.75, M.x, 1.2, M.z],
    [13.0, M.x + 0.75, 1.25, M.z + 0.8, P.x, P.y, P.z], [14.1, M.x + 0.8, 1.25, M.z + 0.85, P.x, P.y + 0.02, P.z],
    [15.2, M.x + 1.4, 1.45, M.z + 1.55, M.x, 1.2, M.z], [17.6, M.x + 1.6, 1.5, M.z + 1.6, M.x + 0.1, 1.25, M.z],
    [18.6, M.x + 0.5, 1.8, M.z + 2.4, M.x + 0.3, 1.5, M.z], [22.0, M.x - 0.5, 2.15, M.z + 3.4, M.x + 0.25, 1.6, M.z],
    [25.4, M.x - 1.2, 2.0, M.z + 3.6, M.x + 0.2, 1.55, M.z],
  ])(t);
  return { cam: cam.slice(0, 3), look: cam.slice(3), fov: 34, focus: xray > 0.5 ? P : dad.world.head, ap: lerp(7, 3, xray), key: M, xray, babies: true };
}

// ---- S5 (25.4–36.4): courtship / greeting dance ----
function shot5(t) {
  const arrive = easeInOut(remap(t, 25.4, 26.8));
  const dance = ss(31.6, 32.6, t);
  const ang = 0.35 * Math.sin((t - 25.4) * 0.9) + dance * (t - 31.6) * 0.9; // the pair turns around a shared axis
  const rr = 0.3 - 0.02 * dance;
  const bob = 0.07 * Math.sin(t * 2.0) * (0.4 + 0.6 * dance), yC = 1.4 + bob;
  const dp = [D.x + Math.cos(ang) * -rr, yC, D.z + Math.sin(ang) * -rr];
  const mp = [D.x + Math.cos(ang) * rr + 2.2 * (1 - arrive), yC + 0.08 + 0.5 * (1 - arrive), D.z + Math.sin(ang) * rr];
  const face = -ang + Math.PI / 2; // facing each other, sideways to the camera
  const lean = 0.12 * Math.sin(t * 2.0) * dance;
  const glow = ss(31.8, 33.0, t);
  place(dad, dp, face, { t, curl: 1.0 + 0.25 * Math.sin(t * 2), tailSway: 0.15, tailBend: 0.6 * arrive, headPitch: -0.08, breathe: t * 2, blink: blinkAt(t, BLINKS), happy: 0.6, blush: 0.5 + 0.5 * glow, glow, eyeX: 0.3, bend: lean }, lean * 0.5);
  place(mom, mp, face + Math.PI, { t, curl: 1.0 + 0.25 * Math.sin(t * 2 + 0.2), tailSway: 0.15, tailBend: 0.6 * arrive, headPitch: -0.08, breathe: t * 2 + 1, blink: blinkAt(t + 0.4, BLINKS), happy: 0.6, blush: 0.6 + 0.4 * glow, glow, eyeX: 0.3, bend: lean }, -lean * 0.5);
  mom.root.visible = true;
  // hearts float up around the pair
  const arr = hGeo.attributes.position.array;
  heartSeeds.forEach(([a, r, s], i) => {
    const y = ((s * 2 + (t - 26) * (0.25 + r * 0.2)) % 2.2);
    arr.set([D.x + Math.cos(a + t * 0.3) * (0.45 + r * 0.6), 0.9 + y, D.z + Math.sin(a + t * 0.3) * (0.45 + r * 0.6)], i * 3);
  });
  hGeo.attributes.position.needsUpdate = true;
  hearts.material.opacity = 0.9 * ss(26.2, 27.0, t) * (1 - ss(35.8, 36.4, t));
  hearts.material.size = 0.12 + 0.05 * glow;
  const orbit = lerp(-0.35, 1.25, easeInOut(remap(t, 25.4, 36.4)));
  const rad = lerp(2.6, 1.9, ss(26, 30, t));
  return { cam: [D.x + Math.sin(orbit) * rad, 1.85 + 0.15 * Math.sin(t * 0.5), D.z + Math.cos(orbit) * rad], look: [D.x, 1.58, D.z], fov: 34, focus: v3(D.x, 1.45, D.z), ap: 6, key: D.clone().setY(1.4), glow };
}

// ---- S6 (36.4–50): the family; dad turns to us, surprised and happy ----
function shot6(t) {
  const turn = easeInOut(remap(t, 40.5, 41.3));
  const bob = 0.035 * Math.sin(t * 1.5);
  place(dad, [F.x, F.y + bob, F.z], lerp(0.9, -0.12, turn), {
    t, curl: 1.15, tailSway: 0.22, headYaw: lerp(0.3, 0.05, turn), headPitch: -0.05 - 0.12 * window01(t, 40.7, 41.6, 0.15), breathe: t * 2, blink: blinkAt(t, BLINKS),
    wide: window01(t, 40.75, 41.7, 0.15), happy: ss(41.6, 42.0, t) * 0.9 + 0.3 * (1 - turn), blush: 0.4 + 0.5 * ss(41.6, 42.2, t), eyeX: lerp(0.4, 0, turn), lid: 0.08,
  }, 0.04 * Math.sin(t));
  place(mom, [F.x + 0.55, F.y + 0.05 + 0.035 * Math.sin(t * 1.5 + 1), F.z - 0.35], lerp(-0.9, -0.5, turn), {
    t, curl: 1.1, tailSway: 0.22, headPitch: -0.05, breathe: t * 2 + 1, blink: blinkAt(t + 0.5, BLINKS), happy: 0.7, blush: 0.6, eyeX: 0.4,
  });
  mom.root.visible = true;
  babiesFinale(t, v3(F.x + 0.2, F.y, F.z));
  const c = spline([[36.4, F.x - 0.6, 1.85, F.z + 3.4, F.x + 0.15, 1.45, F.z], [40.5, F.x - 0.2, 1.7, F.z + 2.7, F.x + 0.1, 1.5, F.z], [42, F.x, 1.62, F.z + 2.2, F.x + 0.08, 1.55, F.z], [50, F.x + 0.15, 1.62, F.z + 2.4, F.x + 0.12, 1.55, F.z]])(t);
  return { cam: c.slice(0, 3), look: c.slice(3), fov: 34, focus: dad.world.head, ap: 6, key: F, babies: true };
}

// ===========================================================================
//  OVERLAY
// ===========================================================================
const $ = (id) => document.getElementById(id);
const op = (el, v, tr) => { el.style.opacity = clamp(v).toFixed(3); if (tr !== undefined) el.style.transform = tr; };
// bouncy pop-in: overshoot then settle, with a tiny idle wobble
const bounce = (t, a) => { const u = clamp((t - a) / 0.45); return u >= 1 ? 1 : 1 + Math.sin(u * Math.PI * 2.2) * Math.exp(-u * 4) * 0.25 - (1 - u) ** 3 * 0.9; };
function anchor(el, p, a, dx = 0, dy = 0) {
  const s = p.clone().project(cam);
  const hw = el.offsetWidth / 2 + 24;
  el.style.left = `${clamp((s.x * 0.5 + 0.5) * W + dx, hw, W - hw).toFixed(1)}px`;
  el.style.top = `${((-s.y * 0.5 + 0.5) * H + dy).toFixed(1)}px`;
  op(el, s.z < 1 ? a : 0, 'translate(-50%, -50%)');
}
function big(el, t, a, b) {
  const v = window01(t, a, b, 0.18);
  const sc = bounce(t, a) * (1 + 0.02 * Math.sin(t * 5));
  op(el, v, `translateX(-50%) scale(${sc.toFixed(3)}) rotate(${(-2 + 1.5 * Math.sin(t * 3)).toFixed(2)}deg)`);
}
function updateOverlay(t, sh) {
  big($('hook'), t, 2.35, 4.05);
  big($('males'), t, 4.05, 5.75);
  big($('hundreds'), t, 20.6, 22.6);
  big($('next'), t, 43.2, DURATION + 1);
  op($('comment'), ss(46.9, 47.3, t), `translateX(-50%) scale(${(bounce(t, 46.9) * (1 + 0.04 * Math.sin(t * 6))).toFixed(3)})`);
  op($('brand'), ss(47.4, 47.9, t), 'translateX(-50%)');
  op($('pair'), window01(t, 26.7, 31.3, 0.3), `translateX(-50%) scale(${bounce(t, 26.7).toFixed(3)})`);
  op($('dance'), window01(t, 31.9, 36.2, 0.3), `translateX(-50%) scale(${bounce(t, 31.9).toFixed(3)})`);
  // embryo stages: egg → embryo → mini seahorse
  const stg = sh.xray || 0;
  op($('stages'), stg, 'translateX(-50%)');
  if (stg > 0.01) {
    const s = ss(12.5, 13.9, t);
    ['st1', 'st2', 'st3'].forEach((id, k) => $(id).classList.toggle('on', s >= k * 0.42 && s < (k + 1) * 0.42 + (k === 2 ? 1 : 0)));
  }
  const hide = (...ids) => ids.forEach((id) => op($(id), 0));
  if (sh.eggMid) {
    anchor($('lPouch'), dad.world.pouchCenter, window01(t, 7.7, 10.2, 0.25), -40, -170);
    anchor($('lEggs'), sh.eggMid, window01(t, 7.1, 9.8, 0.25), 120, -120);
  } else if (sh.xray > 0.3) {
    anchor($('lPouch'), dad.world.pouchCenter, sh.xray, -200, 150);
    hide('lEggs');
  } else hide('lPouch', 'lEggs');
  let on = 0;
  for (const c of SUBS) {
    if (t >= c.start - 0.06 && t < c.end + 0.1) {
      if ($('sub').dataset.k !== c.html) { $('sub').innerHTML = c.html; $('sub').dataset.k = c.html; }
      on = window01(t, c.start - 0.06, c.end + 0.1, 0.06);
      break;
    }
  }
  op($('sub'), on, `translateX(-50%) scale(${(0.94 + 0.06 * ss(0, 1, on)).toFixed(3)})`);
}

// ===========================================================================
function frame(t) {
  let sh;
  eggs.visible = false;
  reef.stalk.visible = false;
  hearts.material.opacity = 0;
  if (t < 5.75) sh = shot1(t);
  else if (t < 10.4) sh = shot2(t);
  else if (t < 25.4) sh = shotMeadow(t);
  else if (t < 36.4) sh = shot5(t);
  else sh = shot6(t);
  if (!sh.babies) for (let i = 0; i < NBABY; i++) setBaby(i, v3(), 0, 0, 0, false);
  babies.instanceMatrix.needsUpdate = true;
  babyEyes.instanceMatrix.needsUpdate = true;
  updateBursts(t, [[2.45, A.clone().add(v3(0.2, 0.1, 0.25))], [7.0, B.clone().setY(1.3)], [15.4, M.clone().add(v3(0.25, 0, 0.2))], [19.5, M.clone().add(v3(0.3, 0.2, 0.2))], [41.0, F.clone().add(v3(0.1, 0.25, 0.2))]]);

  reef.update(t, v3(...sh.look));
  reef.setFocus(sh.key, 4);
  const hd = v3(Math.sin(t * 0.7) * 0.01, Math.sin(t * 0.9 + 1) * 0.008, 0);
  cam.position.set(...sh.cam).add(hd);
  cam.fov = sh.fov;
  cam.updateProjectionMatrix();
  cam.lookAt(...sh.look);
  cam.updateMatrixWorld(true);
  post.renderLayer(0, scene, cam, { focus: cam.position.distanceTo(sh.focus), aperture: sh.ap, maxBlur: 14 });
  let mot = 0;
  for (const c of CUTS) mot = Math.max(mot, 1 - Math.abs(t - c) / 0.12);
  post.composite({
    motion: [85 * clamp(mot), 0],
    flash: 0.08 * window01(t, 31.8, 32.6, 0.3) + 0.06 * Math.exp(-(((t - 15.4) / 0.15) ** 2)),
    exposure: 1.05 + 0.1 * (sh.glow || 0), bloom: 0.55, vignette: 0.42, threshold: 0.95,
    fade: (1 - ss(0, 0.25, t)) + ss(DURATION - 0.5, DURATION, t) * 0.9,
    frame: Math.round(t * FPS),
  });
  updateOverlay(t, sh);
  return { t: +t.toFixed(4) };
}

export const EVENTS = [
  { t: 0.0, type: 'whoosh' }, { t: 2.35, type: 'title' }, { t: 2.45, type: 'sparkle' }, { t: 4.05, type: 'title' },
  ...CUTS.map((t) => ({ t, type: 'whoosh' })),
  { t: 6.9, type: 'eggs', d: 2.9 }, { t: 7.0, type: 'bubbles', d: 1.5, rate: 14, g: -28 },
  { t: 11.0, type: 'bubbles', d: 1.2, rate: 8, g: -30 }, { t: 12.3, type: 'sparkle', f: 1500 }, { t: 12.6, type: 'heart' },
  ...[14.3, ...BURSTS.map((b) => b[0] - 0.25)].map((t) => ({ t, type: 'contract' })),
  { t: 15.4, type: 'births', d: 1.8 }, { t: 17.95, type: 'births', d: 1.6 }, { t: 19.65, type: 'births', d: 3.2 }, { t: 20.6, type: 'title' },
  { t: 22.6, type: 'sparkle', f: 2000 }, { t: 25.6, type: 'heart' }, { t: 26.7, type: 'title' }, { t: 31.8, type: 'sparkle', f: 1700 }, { t: 31.9, type: 'heart' },
  { t: 36.7, type: 'bubbles', d: 3.0, rate: 10, g: -29 }, { t: 40.75, type: 'sparkle', f: 2100 }, { t: 43.2, type: 'title' }, { t: 46.9, type: 'outro' },
];
window.DURATION = DURATION;
window.FPS = FPS;
window.EVENTS = EVENTS;
window.renderAt = (t) => frame(t);
if (!new URLSearchParams(location.search).has('render')) {
  const stage = document.getElementById('stage');
  const fit = () => {
    const s = Math.min(innerWidth / W, innerHeight / H);
    stage.style.transform = `translate(${(innerWidth - W * s) / 2}px, ${(innerHeight - H * s) / 2}px) scale(${s})`;
    stage.style.transformOrigin = '0 0';
  };
  fit();
  addEventListener('resize', fit);
  let start = null;
  const loop = (now) => {
    if (start === null) start = now;
    let tt = (now - start) / 1000;
    if (tt > DURATION) { start = now; tt = 0; }
    frame(tt);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
window.READY = true;
