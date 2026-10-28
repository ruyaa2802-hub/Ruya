import * as THREE from 'three';
import { clamp, lerp, remap, ss, easeInOut, window01, v3 } from './util.js';
import { createDog } from './dog.js';
import { createHuman } from './human.js';
import { createRoom } from './room.js';
import { createPark } from './park.js';
import { createScent, createAura } from './scent.js';
import { Post } from './post.js';

// ===========================================================================
//  "Köpekler aynadaki görüntülerini neden tanımıyor?" — vertical 1080×1920, 50.5 s.
//  Every frame is a pure function of t. Two sets (living room with a real
//  reflecting mirror, park) joined by a whip cut and a mirror→park dissolve.
// ===========================================================================
const W = 1080, H = 1920;
export const FPS = 30;
export const DURATION = 50.5;

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const post = new Post(renderer, W, H);
post.finalMat.uniforms.lift.value.set(0.012, 0.008, 0.016);
post.finalMat.uniforms.gain.value.set(1.0, 0.98, 0.94);
post.finalMat.uniforms.saturation.value = 1.06;
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
// path keys [t, x, z, yaw] → position, heading, gait phase from distance travelled
function walker(keys, stridePerCycle = 0.62) {
  const f = spline(keys);
  const t0 = keys[0][0];
  const cache = new Map();
  const dist = (t) => {
    const k = Math.round(t * 60);
    if (cache.has(k)) return cache.get(k);
    let d = 0, prev = f(t0);
    for (let tt = t0 + 1 / 60; tt <= t + 1e-6; tt += 1 / 60) { const c = f(tt); d += Math.hypot(c[0] - prev[0], c[1] - prev[1]); prev = c; }
    cache.set(k, d);
    return d;
  };
  return (t) => {
    const a = f(t), b = f(t + 0.05);
    const speed = Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.05;
    return { x: a[0], z: a[1], yaw: a[2], speed, walk: clamp(speed / 0.25), phase: dist(t) / stridePerCycle };
  };
}
const sniffWiggle = (t, amt) => amt * (0.04 * Math.sin(t * 23) + 0.025 * Math.sin(t * 37));
function placeDog(s, pose) {
  dog.root.position.set(s.x, 0, s.z);
  dog.root.rotation.set(0, s.yaw, 0);
  dog.root.updateMatrixWorld(true);
  dog.setPose(pose);
}

// ---------------- world ----------------
const room = createRoom();
const park = createPark();
const dog = createDog();
const human = createHuman();
room.scene.add(human.root);
const roomScent = createScent(room.scene, 11);
const parkScent = createScent(park.scene, 23);
const aura = createAura(room.scene);
const camA = new THREE.PerspectiveCamera(40, W / H, 0.02, 60);
const camB = new THREE.PerspectiveCamera(40, W / H, 0.02, 60);
for (const c of [camA, camB]) c.layers.enable(1);
const M = room.MIR;

// faint scents in the room (from things, never from the reflection)
roomScent.addSource('sofa', v3(-0.6, 0.45, -1.4), '#8fb8ff', { n: 4, spread: 0.9, height: 0.35, dir: v3(0.5, 0, 1) });
roomScent.addSource('plant', v3(-1.55, 0.35, -1.85), '#7dffb0', { n: 4, spread: 0.9, height: 0.3, dir: v3(0.6, 0, 1) });
roomScent.addSource('shoes', v3(-2.2, 0.04, 2.25), '#ffb36a', { n: 5, spread: 1.1, height: 0.25, dir: v3(1, 0, -0.4) });
roomScent.addSource('owner', v3(0.42, 0.6, -1.5), '#ffd6f0', { n: 4, spread: 0.8, height: 0.3, dir: v3(0.5, 0, 1) });
// park scent sources: each a different layer of information
const GRASS = v3(-0.55, 0, 0.45), TREEB = v3(1.0, 0, -1.0), MARK = v3(-1.28, 0, -0.78), OWN = v3(0.15, 0, 0.75), MOD = v3(0.85, 0, 0.55);
parkScent.addSource('grass', GRASS, '#7dffd0', { n: 6, spread: 0.6, height: 0.18, dir: v3(0.4, 0, 0.8) });
parkScent.addSource('tree', TREEB, '#ffb84d', { n: 7, spread: 0.9, height: 0.3, dir: v3(-0.4, 0, 1) });
parkScent.addSource('mark', MARK, '#c58cff', { n: 7, spread: 0.9, height: 0.28, dir: v3(0.8, 0, 0.6) });
parkScent.addSource('own', OWN, '#ffd27a', { n: 5, spread: 0.45, height: 0.16, dir: v3(0.3, 0, 1) });
parkScent.addSource('mod', MOD, '#ffd27a', { n: 5, spread: 0.45, height: 0.16, dir: v3(-0.2, 0, 1) });
parkScent.addSource('mod2', MOD.clone().add(v3(0.03, 0, -0.02)), '#d08cff', { n: 4, spread: 0.4, height: 0.2, dir: v3(0.4, 0, 1) });

// ---------------- timeline ----------------
const CUTS = [0, 17.2, 21.6, 29.6, 34.2, 41.5, DURATION];
const MIRROR_STOP = 1.02; // dog root z where its nose nearly touches the glass

// ---- shot 1+2: room — the mirror, the reflection with no smell, behind the mirror ----
const W1 = walker([
  [0, -0.55, 3.0, 2.75], [1.5, -0.05, 2.0, 2.9], [3.2, 0.5, 1.3, 3.1], [3.6, 0.53, 1.25, 3.14],
  [5.0, 0.55, 1.18, 3.14], [5.9, 0.55, MIRROR_STOP, 3.14], [9.3, 0.55, MIRROR_STOP, 3.14],
  [10.3, 0.85, 0.95, 2.1], [11.4, 1.32, 0.5, 3.6], [12.5, 1.2, -0.2, 4.2], [13.4, 0.75, -0.45, 4.65], [17.2, 0.7, -0.48, 4.71],
]);
const C1 = spline([
  [0, 0.05, 0.68, 4.5, 0.5, 0.62, 0.3], [3.2, 0.78, 0.64, 2.75, 0.55, 0.62, 0.3],
  [5.3, 1.45, 0.64, 0.95, 0.55, 0.64, 0.4], [7.2, 1.4, 0.63, 0.75, 0.55, 0.64, 0.35],
  [9.2, 1.5, 0.66, 0.9, 0.6, 0.62, 0.35], [11.0, 2.3, 1.05, 1.9, 0.9, 0.5, 0.0], [13.4, -0.35, 0.9, 1.05, 0.55, 0.45, -0.4],
  [14.6, -1.0, 0.8, -0.5, 0.65, 0.42, -0.48], [17.2, -0.9, 0.78, -0.48, 0.65, 0.55, -0.48],
]);
function shotRoom1(t) {
  const s = W1(t);
  const tilt = 0.32 * window01(t, 3.5, 5.0, 0.35) - 0.25 * window01(t, 15.6, 17.4, 0.35);
  const nearMirror = window01(t, 5.8, 9.3, 0.4);
  const sniffBehind = window01(t, 13.5, 15.6, 0.35);
  placeDog(s, {
    t, walk: s.walk, phase: s.phase, stride: 0.36, headTilt: tilt, brow: window01(t, 3.4, 5.2, 0.3) + window01(t, 15.5, 17.4, 0.3), earLift: 0.6 * window01(t, 3.4, 5.4, 0.4),
    sniff: 0.15 * nearMirror + 0.85 * sniffBehind, nostril: nearMirror * (0.5 + 0.5 * Math.sin(t * 30)) + sniffBehind,
    headPitch: sniffWiggle(t, nearMirror + sniffBehind) - 0.1 * window01(t, 15.5, 17.4, 0.4), headYaw: 0.35 * window01(t, 9.0, 9.8, 0.3) - 0.3 * window01(t, 15.6, 17.4, 0.4),
    tailUp: 0.5, wag: lerp(0.25, 0.55, window01(t, 3, 6, 1)), breathe: t * 2.2, blink: blinkAt(t, [2.4, 8.0, 14.0]),
  });
  human.root.visible = true;
  sitHuman(t, 0);
  room.mirror.visible = true;
  const c = C1(t);
  const scent = { sofa: { a: 0.35 * ss(7.5, 9, t) }, plant: { a: 0.35 * ss(7.8, 9.3, t) }, shoes: { a: 0.3 * ss(8.1, 9.6, t) }, owner: { a: 0.3 * ss(8.3, 9.8, t) } };
  roomScent.update(t, scent);
  aura.update(t, dog.root.position.clone().add(v3(0, 0.25, 0)), 0.65 * window01(t, 7.4, 13.8, 0.8));
  return { set: 'room', cam: c.slice(0, 3), look: c.slice(3), fov: 38, focus: dog.root.position.clone().add(v3(0, 0.6, 0)), ap: 12, key: [v3(1.6, 2.2, 1.8), v3(0.5, 0.3, 0.6)] };
}

// ---- shot 3a: macro on the nose → see-through cross-section ----
const C3 = spline([[17.2, 0.62, 0.66, 0.0, 0.0, 0.62, -0.16], [18.6, 0.42, 0.64, 0.02, 0.0, 0.62, -0.08], [21.6, 0.38, 0.65, 0.06, 0.0, 0.63, -0.06]]);
function shotNose(t) {
  const s = { x: 0, z: 0.55, yaw: Math.PI };
  const x = ss(18.0, 18.8, t) * (1 - ss(21.0, 21.5, t));
  placeDog(s, { t, sniff: 0, headPitch: 0.05 + 0.015 * Math.sin(t * 20) * x, nostril: 0.5 + 0.5 * Math.sin(t * 28), breathe: t * 2.2, tailUp: 0.5, wag: 0.3, earLift: 0.2 });
  dog.setXray(x, t, ss(18.8, 19.6, t));
  human.root.visible = false;
  room.mirror.visible = false;
  roomScent.update(t, {});
  aura.update(t, v3(), 0);
  const L = dog.anatWorld('olf').lerp(dog.noseWorld(), 1 - ss(17.4, 18.8, t) * 0.75);
  const d = lerp(0.3, 0.5, ss(17.3, 18.8, t));
  const c = [L.x + d, L.y + 0.03, L.z + 0.06 * d, L.x, L.y, L.z];
  return { set: 'room', cam: c.slice(0, 3), look: c.slice(3), fov: 32, focus: dog.anatWorld('olf'), ap: 7, key: [v3(0.9, 1.4, -0.4), v3(0, 0.6, -0.1)], labels: x };
}

// ---- shot 3b: park — reading the scent layers ----
const P1 = walker([
  [21.6, -2.1, 1.5, 2.2], [22.4, -1.15, 0.9, 2.45], [23.2, -0.62, 0.66, 2.55], [24.6, -0.6, 0.64, 2.5],
  [25.4, -0.05, 0.25, 2.2], [26.2, 0.48, -0.25, 2.4], [27.6, 0.52, -0.3, 2.45], [28.6, 0.4, -0.25, 3.6], [29.6, 0.0, -0.15, 4.2],
]);
const CP1 = spline([[21.6, -1.2, 0.75, 3.4, -1.6, 0.35, 1.2], [23.2, -0.25, 0.7, 2.55, -0.6, 0.3, 0.6], [25.4, 0.65, 0.75, 2.1, 0.0, 0.3, 0.1], [27.6, 1.75, 0.8, 1.35, 0.6, 0.35, -0.45], [29.6, 1.4, 1.0, 1.95, -0.4, 0.45, -0.6]]);
function shotPark1(t) {
  const s = P1(t);
  const sg = window01(t, 22.9, 24.7, 0.35), stree = window01(t, 26.0, 27.8, 0.35);
  placeDog(s, {
    t, walk: s.walk, phase: s.phase, stride: 0.36, sniff: Math.max(0.55 * s.walk * 0, sg, stree) + 0.35 * s.walk, nostril: Math.max(sg, stree) * (0.6 + 0.4 * Math.sin(t * 30)),
    headPitch: sniffWiggle(t, Math.max(sg, stree)), headYaw: 0.3 * window01(t, 28.0, 29.6, 0.4), earLift: 0.4 * window01(t, 28, 29.6, 0.4), tailUp: 0.62, wag: 0.65, breathe: t * 2.6,
  });
  const nose = dog.noseWorld();
  parkScent.update(t, {
    grass: { a: ss(21.9, 22.5, t), reveal: ss(21.9, 23.0, t), inhale: sg, nose },
    tree: { a: ss(24.4, 25.0, t), reveal: ss(24.4, 25.6, t), inhale: stree, nose },
    mark: { a: ss(26.6, 27.2, t), reveal: ss(26.6, 27.8, t) },
  });
  park.update(t, s.x !== undefined ? v3(s.x, 0.3, s.z) : v3());
  const c = CP1(t);
  return { set: 'park', cam: c.slice(0, 3), look: c.slice(3), fov: 42, focus: dog.root.position.clone().add(v3(0, 0.45, 0)), ap: 10, srcLabels: t };
}

// ---- shot 4a: the mirror again → its image dissolves into the park ----
const C4 = spline([[29.6, 0.95, 0.78, 2.6, 0.55, 0.7, 0.3], [32.0, 0.72, 1.05, 1.75, 0.55, 0.8, 0.26], [34.2, 0.6, 1.2, 1.15, 0.55, 0.92, 0.25]]);
const CP2 = spline([[32.0, -0.6, 1.0, 3.4, 0.4, 0.35, 0.4], [34.2, -0.5, 0.82, 3.0, -0.1, 0.3, 1.0], [36.0, 0.55, 0.68, 2.6, 0.1, 0.28, 0.85], [38.5, 1.75, 0.62, 2.0, 0.8, 0.28, 0.6], [41.5, 1.8, 0.64, 1.9, 0.8, 0.3, 0.6]]);
function shotMirror2(t) {
  const s = { x: 0.55, z: MIRROR_STOP + 0.1, yaw: Math.PI };
  placeDog(s, { t, headTilt: 0.28 * window01(t, 30.4, 32.4, 0.4), brow: window01(t, 30.2, 32.6, 0.4), earLift: 0.4, tailUp: 0.5, wag: 0.3, breathe: t * 2.2, blink: blinkAt(t, [31.2]) });
  dog.setXray(0);
  human.root.visible = true;
  sitHuman(t, 0);
  room.mirror.visible = true;
  roomScent.update(t, { sofa: { a: 0.2 }, plant: { a: 0.2 }, owner: { a: 0.2 } });
  aura.update(t, dog.root.position.clone().add(v3(0, 0.25, 0)), 0.5);
  const c = C4(t);
  return { set: 'room', cam: c.slice(0, 3), look: c.slice(3), fov: 38, focus: v3(0.55, 0.7, 0.3), ap: 9, key: [v3(1.6, 2.2, 1.8), v3(0.5, 0.3, 0.6)] };
}
// park layer seen through the dissolve (no dog yet), then the dog compares scents
const P2 = walker([
  [32.0, -1.2, 1.6, 2.6], [34.2, -0.9, 1.45, 2.6], [35.0, -0.25, 1.25, 2.9], [35.4, -0.05, 1.12, 3.0], [36.4, -0.04, 1.1, 3.0],
  [37.3, 0.55, 0.98, 2.75], [37.8, 0.66, 0.92, 2.75], [41.5, 0.68, 0.9, 2.8],
]);
function shotPark2(t, withDog = true) {
  const s = P2(t);
  const sOwn = window01(t, 35.3, 36.5, 0.3), sMod = window01(t, 37.7, 41.5, 0.4);
  dog.root.visible = withDog;
  if (withDog) {
    placeDog(s, {
      t, walk: s.walk, phase: s.phase, stride: 0.36, sniff: Math.max(sOwn, sMod) + 0.3 * s.walk, nostril: Math.max(sOwn, sMod) * (0.6 + 0.4 * Math.sin(t * 30)),
      headPitch: sniffWiggle(t, Math.max(sOwn, sMod)), earLift: 0.5 * sMod, tailUp: 0.6, wag: lerp(0.4, 0.9, sMod), breathe: t * 2.6,
    });
    dog.setXray(0);
  }
  const nose = withDog ? dog.noseWorld() : null;
  parkScent.update(t, {
    grass: { a: 0.35 }, tree: { a: 0.35 }, mark: { a: 0.35 },
    own: { a: ss(32.4, 33.4, t), inhale: sOwn, nose },
    mod: { a: ss(32.6, 33.6, t), inhale: sMod, nose }, mod2: { a: ss(32.6, 33.6, t), inhale: sMod * 0.8, nose },
  });
  park.update(t, v3(0.4, 0.3, 0.8));
  const c = CP2(t);
  return { set: 'park', cam: c.slice(0, 3), look: c.slice(3), fov: 42, focus: withDog ? dog.root.position.clone().add(v3(0, 0.4, 0)) : v3(0.4, 0.2, 0.6), ap: 10, cmpLabels: withDog ? t : 0 };
}

// ---- shot 5: last look in the mirror, then to its person ----
const W5 = walker([
  [41.5, 0.55, MIRROR_STOP + 0.12, 3.14], [43.6, 0.55, MIRROR_STOP + 0.12, 3.14], [44.5, 0.15, 1.0, 3.9], [45.7, -0.15, 0.0, 3.4], [46.5, -0.2, -0.55, 3.5], [47.3, -0.15, -0.6, 6.2], [50.5, -0.15, -0.6, 6.28],
]);
const C5 = spline([[41.5, 0.9, 0.76, 2.55, 0.55, 0.7, 0.3], [43.6, 0.85, 0.74, 2.4, 0.55, 0.7, 0.3], [45.5, -0.65, 0.95, 1.8, -0.15, 0.5, -0.4], [47.4, -0.12, 0.8, 0.32, -0.15, 0.76, -0.55], [50.5, -0.1, 0.84, 0.82, -0.15, 0.72, -0.6]]);
function shotRoom5(t) {
  const s = W5(t);
  const sit = ss(46.9, 47.5, t);
  placeDog(s, {
    t, walk: s.walk * (1 - sit), phase: s.phase, stride: 0.36, sit,
    headTilt: 0.3 * window01(t, 42.2, 43.7, 0.35) + 0.32 * ss(48.0, 48.6, t), brow: window01(t, 42.0, 43.8, 0.3) + ss(47.8, 48.6, t),
    earLift: 0.5 * window01(t, 42, 44, 0.4) + 0.4 * ss(47.8, 48.6, t), headPitch: -0.12 * ss(47.6, 48.3, t),
    tailUp: 0.5, wag: lerp(0.3, 0.8, ss(44, 46, t)), breathe: t * 2.2, blink: blinkAt(t, [44.4, 49.3]), pant: 0.6 * ss(47.2, 47.8, t),
  });
  dog.setXray(0);
  human.root.visible = true;
  sitHuman(t, ss(46.6, 47.6, t));
  room.mirror.visible = true;
  roomScent.update(t, { sofa: { a: 0.15 }, plant: { a: 0.15 }, owner: { a: 0.35 * ss(43.5, 45, t) } });
  aura.update(t, dog.root.position.clone().add(v3(0, 0.25, 0)), 0.3);
  const c = C5(t);
  return { set: 'room', cam: c.slice(0, 3), look: c.slice(3), fov: lerp(38, 44, ss(47, 50.5, t)), focus: dog.head.getWorldPosition(v3()), ap: 11, key: [v3(0.8, 2.2, 1.6), v3(-0.3, 0.4, -0.6)] };
}

// the owner sits on the sofa; pet > 0 brings the hand to the dog's head
function sitHuman(t, pet) {
  human.root.position.set(0.42, 0, -1.62);
  human.root.rotation.set(0, -0.3, 0);
  const headW = dog.head.getWorldPosition(v3()).add(v3(0, 0.12, 0.05));
  const strokeW = headW.clone().add(v3(0.02 * Math.sin(t * 2.4), 0.015 * Math.sin(t * 4.8), 0.05 * Math.sin(t * 2.4)));
  human.setPose({
    pelvis: v3(0, 0.6, -0.02), pelvisPitch: -0.25, spine: 0.08 + 0.25 * pet, headPitch: 0.6, headYaw: 0.35, breathe: t * 1.4,
    footL: v3(-0.14, 0.08, 0.5), footR: v3(0.14, 0.08, 0.52),
    handL: pet > 0.01 ? human.root.worldToLocal(human.root.localToWorld(v3(-0.18, 0.62, 0.35)).lerp(strokeW, pet)) : v3(-0.18, 0.62, 0.35), palmL: v3(0, -1, 0),
    handR: v3(0.15, 0.62, 0.33), curl: 0.2,
  });
}
const blinkAt = (t, list, d = 0.16) => list.reduce((m, b) => Math.max(m, Math.exp(-(((t - b) / (d / 2.5)) ** 2))), 0);

// ---------------- overlay ----------------
const $ = (id) => document.getElementById(id);
const op = (el, v, tr) => { el.style.opacity = clamp(v).toFixed(3); if (tr !== undefined) el.style.transform = tr; };
const pop = (t, a) => (0.9 + 0.1 * ss(a, a + 0.25, t)).toFixed(3);
function anchor(el, p, cam, a, dx = 0, dy = 0) {
  const s = p.clone().project(cam);
  el.style.left = `${((s.x * 0.5 + 0.5) * W + dx).toFixed(1)}px`;
  el.style.top = `${((-s.y * 0.5 + 0.5) * H + dy).toFixed(1)}px`;
  op(el, s.z < 1 ? a : 0, 'translate(-50%, -50%)');
}
function updateOverlay(t, sh, cam) {
  op($('noscent'), window01(t, 8.3, 12.2, 0.35), `translateX(-50%) scale(${pop(t, 8.3)})`);
  op($('nobody'), window01(t, 13.6, 17.0, 0.35), `translateX(-50%) scale(${pop(t, 13.6)})`);
  op($('repr'), window01(t, 22.2, 26.0, 0.35), `translateX(-50%)`);
  op($('facts'), window01(t, 19.0, 21.4, 0.35), `translateX(-50%) scale(${pop(t, 19.0)})`);
  op($('test'), window01(t, 38.0, 41.3, 0.35), `translateX(-50%) scale(${pop(t, 38.0)})`);
  op($('outro'), window01(t, 47.0, DURATION + 1, 0.5), `translateX(-50%) translateY(${((1 - ss(47.0, 47.6, t)) * 30).toFixed(1)}px)`);
  const lx = sh.labels || 0;
  if (lx > 0.02) {
    anchor($('lOlf'), dog.anatWorld('olf'), cam, lx * ss(18.9, 19.3, t), 0, -150);
    anchor($('lBulb'), dog.anatWorld('bulb'), cam, lx * ss(19.6, 20.0, t), 0, -260);
    anchor($('lAir'), dog.anatWorld('air'), cam, lx * ss(18.5, 18.9, t), 0, 150);
  } else for (const id of ['lOlf', 'lBulb', 'lAir']) op($(id), 0);
  if (sh.srcLabels) {
    anchor($('sGrass'), GRASS.clone().add(v3(0, 0.25, 0)), cam, window01(t, 22.6, 26.0, 0.3), 0, -40);
    anchor($('sTree'), TREEB.clone().add(v3(0, 0.45, 0)), cam, window01(t, 25.2, 29.4, 0.3), 0, -40);
    anchor($('sMark'), MARK.clone().add(v3(0, 0.5, 0)), cam, window01(t, 27.2, 29.4, 0.3), 0, -40);
  } else for (const id of ['sGrass', 'sTree', 'sMark']) op($(id), 0);
  if (sh.cmpLabels) {
    anchor($('cOwn'), OWN.clone().add(v3(0, 0.28, 0)), cam, window01(t, 34.6, 37.0, 0.3), 0, -30);
    anchor($('cMod'), MOD.clone().add(v3(0, 0.3, 0)), cam, window01(t, 36.6, 41.3, 0.3), 0, -30);
  } else for (const id of ['cOwn', 'cMod']) op($(id), 0);
  let on = 0;
  for (const c of SUBS) {
    if (t >= c.start - 0.08 && t < c.end + 0.12) {
      if ($('sub').textContent !== c.text) $('sub').textContent = c.text;
      on = window01(t, c.start - 0.08, c.end + 0.12, 0.08);
      break;
    }
  }
  op($('sub'), on, 'translateX(-50%)');
}

// ===========================================================================
function setCam(cam, sh, t) {
  const hd = v3(Math.sin(t * 0.9) * 0.004 + Math.sin(t * 2.3) * 0.0015, Math.sin(t * 1.3 + 1) * 0.003, Math.sin(t * 0.7 + 2) * 0.003);
  cam.position.set(...sh.cam).add(hd);
  cam.fov = sh.fov;
  cam.updateProjectionMatrix();
  cam.lookAt(...sh.look);
  cam.updateMatrixWorld(true);
}
function sceneOf(sh) {
  const sc = sh.set === 'room' ? room.scene : park.scene;
  sc.add(dog.root);
  if (sh.set === 'room') { room.setKey(sh.key[0], sh.key[1]); room.fill.position.copy(sh.cam ? v3(...sh.cam) : v3()).add(v3(0, 0.4, 0)); }
  return sc;
}
function frame(t) {
  dog.root.visible = true;
  let A, B = null, mix = 0;
  if (t < 17.2) A = shotRoom1(t);
  else if (t < 21.6) A = shotNose(t);
  else if (t < 29.6) A = shotPark1(t);
  else if (t < 34.2) {
    // the park appears inside the mirror image and takes over the frame
    mix = easeInOut(remap(t, 32.0, 34.2));
    if (mix > 0) B = shotPark2(t, false);
    dog.root.visible = true;
    A = shotMirror2(t);
  } else if (t < 41.5) A = shotPark2(t, true);
  else A = shotRoom5(t);

  const scA = sceneOf(A);
  setCam(camA, A, t);
  post.renderLayer(0, scA, camA, { focus: camA.position.distanceTo(A.focus), aperture: A.ap, maxBlur: 16 });
  if (B) {
    park.scene.remove(dog.root);
    setCam(camB, B, t);
    post.renderLayer(1, park.scene, camB, { focus: camB.position.distanceTo(B.focus), aperture: B.ap, maxBlur: 16 });
    room.scene.add(dog.root);
  }
  let mot = 0;
  for (const c of [17.2, 21.6, 29.6, 41.5]) mot = Math.max(mot, 1 - Math.abs(t - c) / 0.1);
  post.composite({
    mix, motion: [70 * clamp(mot), 0],
    exposure: (A.set === 'park' ? 1.0 : 1.12) * (A.labels ? 1 - 0.3 * A.labels : 1), bloom: 0.5, vignette: 0.55, threshold: 1.0,
    fade: (1 - ss(0, 0.35, t)) + ss(DURATION - 0.5, DURATION, t) * 0.85,
    frame: Math.round(t * FPS),
  });
  updateOverlay(t, A, camA);
  return { t: +t.toFixed(4), d: +camA.position.distanceTo(dog.root.position).toFixed(3), walk: +W1(t).walk.toFixed(3) };
}

export const EVENTS = [
  { t: 0, type: 'ambience_room' },
  { t: 5.9, type: 'sniff', d: 3.2 }, { t: 13.5, type: 'sniff', d: 2.1 }, { t: 18.6, type: 'sniff', d: 2.6 },
  { t: 22.9, type: 'sniff', d: 1.8 }, { t: 26.0, type: 'sniff', d: 1.8 }, { t: 35.3, type: 'sniff', d: 1.2 }, { t: 37.7, type: 'sniff', d: 3.6 },
  { t: 18.0, type: 'xray' }, { t: 21.6, type: 'park' }, { t: 32.0, type: 'dissolve' }, { t: 41.5, type: 'room' },
  { t: 47.0, type: 'outro' }, { t: 47.3, type: 'pant' },
  ...[17.2, 21.6, 29.6, 41.5].map((t) => ({ t, type: 'cut' })),
];
// paw steps for the sound design: walking ranges
export const WALKS = [[0, 5.9, 'in'], [9.3, 13.4, 'in'], [21.6, 26.2, 'out'], [27.6, 29.6, 'out'], [34.2, 37.8, 'out'], [43.6, 47.0, 'in']];
window.DURATION = DURATION;
window.FPS = FPS;
window.EVENTS = EVENTS;
window.WALKS = WALKS;
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
