import * as THREE from 'three';
import { clamp, lerp, remap, ss, easeInOut, window01, v3 } from './util.js';
import { createCat } from './cat.js';
import { createHuman } from './human.js';
import { createHouse } from './house.js';
import { createGarden } from './garden.js';
import { Post } from './post.js';

// ===========================================================================
//  "Kediler Neden İnsanlara Miyavlıyor?" — vertical 1080×1920, 48.6 s.
//  Every frame is a pure function of t. Nine shots in two sets (flat, garden),
//  joined by short whip-blur cuts.
// ===========================================================================
const W = 1080, H = 1920;
export const FPS = 30;
export const DURATION = 48.6;

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const post = new Post(renderer, W, H);
post.finalMat.uniforms.lift.value.set(0.012, 0.008, 0.016);
post.finalMat.uniforms.gain.value.set(1.0, 0.98, 0.94);
post.finalMat.uniforms.saturation.value = 1.08;
const SUBS = await fetch('./subtitles.json').then((r) => r.json());

// ---------------- helpers ----------------
function spline(keys) {
  const ts = keys.map((k) => k[0]);
  const ps = keys.map((k) => k.slice(1));
  const n = ts.length, d = ps[0].length;
  const ms = ps.map((p, i) => {
    if (i === 0 || i === n - 1) return p.map(() => 0); // ease in/out at the ends
    return p.map((_, j) => (ps[i + 1][j] - ps[i - 1][j]) / (ts[i + 1] - ts[i - 1]));
  });
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
// walking path: keys [t, x, z, yaw]; returns pose bits incl. gait phase from travelled distance
function walker(keys, stridePerCycle = 0.24) {
  const f = spline(keys);
  const t0 = keys[0][0];
  const cache = new Map();
  const dist = (t) => {
    const k = Math.round(t * 120);
    if (cache.has(k)) return cache.get(k);
    let d = 0, prev = f(t0);
    for (let tt = t0 + 1 / 120; tt <= t + 1e-6; tt += 1 / 120) { const c = f(tt); d += Math.hypot(c[0] - prev[0], c[1] - prev[1]); prev = c; }
    cache.set(k, d);
    return d;
  };
  return (t) => {
    const a = f(t), b = f(t + 0.05);
    const speed = Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.05;
    return { x: a[0], z: a[1], yaw: a[2], speed, walk: clamp(speed / 0.12), phase: dist(t) / stridePerCycle };
  };
}
// mouth open envelope for vocalisations: list of [start, duration, size]
function voc(t, list) {
  let v = 0;
  for (const [a, d, s] of list) {
    if (t < a - 0.05 || t > a + d + 0.2) continue;
    const e = ss(a - 0.04, a + 0.07, t) * (1 - ss(a + d - 0.1, a + d + 0.08, t));
    v = Math.max(v, e * s * (0.85 + 0.15 * Math.sin((t - a) * 18)));
  }
  return v;
}
const blinkAt = (t, list, d = 0.16) => list.reduce((m, b) => Math.max(m, Math.exp(-(((t - b) / (d / 2.5)) ** 2))), 0);
const slowBlink = (t, list) => list.reduce((m, b) => Math.max(m, window01(t, b, b + 1.1, 0.4) * 0.92), 0);
function placeCat(cat, s, pose) {
  cat.root.position.set(s.x, s.y ?? 0, s.z);
  cat.root.rotation.set(0, s.yaw, 0);
  cat.root.updateMatrixWorld(true);
  cat.setPose(pose);
}
// head angles (relative to the body) to look at a world point
function lookAngles(s, sit, target, yOff = 0) {
  const hl = v3(0, lerp(0.29, 0.3, sit) + yOff, lerp(0.27, 0.12, sit));
  const hw = hl.applyAxisAngle(v3(0, 1, 0), s.yaw).add(v3(s.x, s.y ?? 0, s.z));
  const d = target.clone().sub(hw).applyAxisAngle(v3(0, 1, 0), -s.yaw);
  return { headYaw: clamp(Math.atan2(d.x, d.z), -1.5, 1.5), headPitch: clamp(-Math.atan2(d.y, Math.hypot(d.x, d.z)), -0.68, 0.7) };
}
const mixA = (a, b, f) => ({ headYaw: lerp(a.headYaw, b.headYaw, f), headPitch: lerp(a.headPitch, b.headPitch, f) });

// ---------------- world ----------------
const house = createHouse();
const garden = createGarden();
const ginger = createCat({ coat: 'ginger', seed: 1 });
const grey = createCat({ coat: 'grey', seed: 7, scale: 1.04 });
const human = createHuman();
const cam = new THREE.PerspectiveCamera(40, W / H, 0.02, 60);

// ---------------- timeline ----------------
const CUTS = [0, 6.5, 12.3, 16.9, 22.4, 27.0, 30.9, 34.7, 38.9, DURATION];
// cat vocalisations (also drive the sound design): [time, duration, size, kind]
const MEOWS = [
  [0.15, 0.45, 0.7, 'meow'], [1.85, 0.5, 0.8, 'meow'], [6.0, 0.35, 0.55, 'meow'],
  [11.62, 0.6, 1.0, 'hiss'],
  [13.45, 0.5, 0.75, 'meow'], [16.5, 0.4, 0.7, 'meow'],
  [19.33, 0.55, 0.85, 'meow'],
  [24.15, 0.5, 0.8, 'meow'], [25.3, 0.45, 0.75, 'meow'],
  [29.3, 0.85, 1.0, 'hungry'],
  [34.4, 0.3, 0.45, 'trill'],
  [37.95, 0.9, 1.0, 'call'],
];
const voice = (t) => voc(t, MEOWS.filter((m) => m[3] !== 'hiss'));
const hissV = (t) => voc(t, MEOWS.filter((m) => m[3] === 'hiss'));
const TAILP = (t, f = 2.2) => t * f;

// ---- shot 1: living room, cat comes to its person ----
const S1walk = walker([[0, -1.35, -0.5, 1.1], [0.65, -0.8, -0.18, 1.25], [1.3, -0.27, 0.13, 1.5], [3, -0.27, 0.13, 1.57]]);
const S1cam = spline([
  [0, 0.3, 0.2, 0.78, -1.1, 0.22, -0.35], [1.3, 0.3, 0.21, 0.76, -0.35, 0.27, 0.05], [2.6, 0.2, 0.2, 0.72, -0.27, 0.34, 0.1],
  [3.8, -0.8, 0.3, 0.6, 0.05, 0.6, -0.02], [4.6, -0.82, 0.3, 0.58, 0.05, 0.58, -0.02],
  [5.6, 0.22, 0.24, 0.36, -0.12, 0.34, 0.13], [6.5, 0.2, 0.24, 0.33, -0.12, 0.34, 0.13],
]);
const S1human = spline([ // t, pelvisY, spine, headPitch, handReach
  [0, 0.95, 0, 0.15, 0, 0], [2.4, 0.95, 0.02, 0.35, 0, 0], [4.0, 0.52, 0.45, 0.55, 0, 1], [4.8, 0.5, 0.5, 0.6, 0, 1], [5.9, 0.49, 0.55, 0.6, 1, 1], [6.5, 0.49, 0.55, 0.6, 1, 1],
]);
function humanStanding(yaw, x, z) { human.root.position.set(x, 0, z); human.root.rotation.set(0, yaw, 0); }

function shot1(t) {
  const s = S1walk(t);
  const sit = ss(1.2, 1.75, t);
  const hp = S1human(t);
  humanStanding(-Math.PI / 2, 0.38, 0.02);
  const humanHead = v3(0.38 + 0.12 * hp[4] - Math.sin(hp[1]) * 0.55 - 0.03, hp[0] + 0.62 * Math.cos(hp[1]) + 0.05, 0.02);
  const look = mixA(lookAngles(s, sit, v3(0.5, 0.3, 0.1)), lookAngles(s, sit, humanHead), ss(0.9, 1.6, t));
  const m = voice(t);
  const catHead = v3(s.x + 0.12, 0.3, s.z);
  // the hand comes down and hovers / touches the cat's head
  const reach = hp[3];
  const handT = v3(lerp(0.25, catHead.x + 0.07, reach), lerp(0.5, catHead.y + 0.1, reach), lerp(-0.15, catHead.z + 0.02, reach));
  human.setPose({
    pelvis: v3(0, hp[0], -0.14 * hp[4]), spine: hp[1], headPitch: hp[2], breathe: t * 1.6,
    footL: v3(-0.14, 0.08, 0.06), footR: v3(0.14, 0.08, 0.1),
    handR: reach > 0 ? human.root.worldToLocal(handT.clone()) : null, palmR: v3(0, -1, 0.2).normalize(), curl: 0.25,
    handL: hp[4] > 0.05 ? v3(-0.15, lerp(0.75, 0.55, hp[4]), lerp(0.1, 0.38, hp[4])) : null,
  });
  placeCat(ginger, s, {
    t, walk: s.walk, phase: s.phase, stride: 0.15, sit, ...look,
    headPitch: look.headPitch - 0.12 * m, jaw: m, earFwd: 1, pupil: 0.7, blink: blinkAt(t, [3.1]),
    tailUp: lerp(0.95, 0.85, sit), tailCurl: 0.7, tailSwish: 0.12, tailPhase: TAILP(t), tailWrap: ss(1.6, 2.4, t) * 0.0, breathe: t * 2.4,
  });
  const c = S1cam(t);
  return { scene: house.scene, set: 'house', cam: [c[0], c[1], c[2]], look: [c[3], c[4], c[5]], fov: 40, focus: catHead, aperture: 16,
    key: [v3(1.2, 1.5, -1.2), v3(-0.2, 0.2, 0.1)] };
}

// ---- shot 2a: garden, two cats meet ----
const G1 = walker([[6.5, -1.25, 0.25, 1.75], [7.7, -0.29, 0.0, 1.57], [11.62, -0.29, 0.0, 1.57], [11.95, -0.43, 0.04, 1.62], [12.3, -0.45, 0.05, 1.62]]);
const G2 = walker([[6.5, 1.15, -0.35, -1.25], [7.7, 0.29, 0.0, -1.57], [12.3, 0.29, 0.0, -1.57]]);
const S2cam = spline([
  [6.5, -1.55, 0.45, 1.3, 0.0, 0.2, 0.0], [7.6, -1.15, 0.32, 0.95, 0.05, 0.22, 0.0],
  [9.0, -0.85, 0.27, 0.5, 0.1, 0.25, 0.0], [10.6, -0.8, 0.26, 0.42, 0.14, 0.26, 0.0], [12.3, -0.62, 0.25, 0.3, 0.2, 0.27, 0.0],
]);
function shot2a(t) {
  const a = G1(t), b = G2(t);
  const sniff = window01(t, 7.5, 10.6, 0.4);
  const hiss = hissV(t);
  const tense = ss(10.2, 11.3, t);
  const noseA = v3(0.0, 0.26, 0.0);
  placeCat(ginger, { ...a }, {
    t, walk: a.walk, phase: a.phase, stride: 0.15, ...lookAngles(a, 0, noseA.clone().add(v3(0.2, 0, 0))),
    reach: sniff * (1 - ss(11.6, 11.8, t)), crouch: 0.15 * sniff + 0.55 * ss(11.65, 11.85, t),
    earFwd: 1 - ss(11.6, 11.8, t), earFlat: 0.6 * ss(11.65, 11.85, t), pupil: 0.55 + 0.4 * ss(11.6, 11.8, t),
    tailUp: lerp(0.9, 0.35, ss(11.6, 11.9, t)), tailCurl: 0.6, tailSwish: 0.1, tailPhase: TAILP(t), breathe: t * 2.6,
    headPitch: 0.05 + 0.08 * Math.sin(t * 9) * sniff - 0.25 * ss(11.65, 11.85, t), blink: blinkAt(t, [9.4]),
  });
  placeCat(grey, { ...b }, {
    t, walk: b.walk, phase: b.phase, stride: 0.15, headYaw: lerp(0, 0.35, ss(9.2, 10.2, t)) * (1 - ss(11.0, 11.4, t)),
    headPitch: 0.05 + 0.06 * Math.sin(t * 8 + 1) * sniff - 0.2 * hiss, reach: sniff * 0.8 * (1 - tense),
    arch: ss(11.0, 11.5, t) * 0.9, earSide: ss(9.2, 10.2, t) * (1 - ss(11.0, 11.3, t)), earFlat: ss(11.0, 11.35, t), earFwd: 0.6 * (1 - tense),
    jaw: hiss * 1.0, pupil: 0.4 + 0.5 * tense, tailUp: lerp(0.5, 0.42, tense), tailCurl: 0.2, tailSwish: lerp(0.15, 0.7, ss(9.0, 10.0, t)), tailPhase: TAILP(t, 3.4),
    tailPuff: ss(11.0, 11.5, t), furPuff: 0.35 * ss(11.0, 11.5, t), breathe: t * 3,
  });
  garden.update(t, v3(0, 0.2, 0));
  const c = S2cam(t);
  return { scene: garden.scene, set: 'garden', cam: [c[0], c[1], c[2]], look: [c[3], c[4], c[5]], fov: 40, focus: lerp(0, 1, ss(8.4, 9.2, t)) ? v3(0.12, 0.26, 0) : v3(0, 0.22, 0), aperture: 15 };
}

// ---- shot 2b: garden, the same cat meows to its person on the patio step ----
const G3 = walker([[12.3, 0.25, 0.15, 0.6], [13.15, 0.82, 0.98, 0.2], [16.9, 0.82, 0.98, 0.2]]);
const S2bcam = spline([[12.3, 1.7, 0.36, 1.2, 0.5, 0.25, 0.55], [13.4, 1.6, 0.4, 1.32, 0.8, 0.32, 0.98], [16.9, 1.55, 0.42, 1.36, 0.8, 0.34, 0.98]]);
function shot2b(t) {
  const s = G3(t);
  const sit = ss(13.1, 13.6, t);
  human.root.position.set(0.95, 0, 1.78);
  human.root.rotation.set(0, Math.PI, 0);
  const lean = ss(14.3, 15.2, t);
  const pet = window01(t, 15.0, 16.9, 0.4);
  const catHeadW = v3(s.x + 0.04, 0.33, s.z + 0.1);
  const strokeW = catHeadW.clone().add(v3(0, 0.07 + 0.01 * Math.sin(t * 5), -0.04 + 0.04 * Math.sin(t * 3)));
  const hand = v3(lerp(0.75, strokeW.x, lean), lerp(0.62, strokeW.y, lean), lerp(1.35, strokeW.z, lean));
  human.setPose({
    pelvis: v3(0, 0.45, -0.02), pelvisPitch: 0.05, spine: 0.25 + 0.45 * lean, headPitch: 0.45 + 0.2 * lean, breathe: t * 1.6,
    footL: v3(-0.14, 0.08, 0.52), footR: v3(0.14, 0.08, 0.5),
    handL: v3(-0.2, 0.52, 0.42), handR: human.root.worldToLocal(hand.clone()), palmR: v3(0, -1, 0), curl: 0.2,
  });
  const look = lookAngles(s, sit, v3(0.95, 1.2, 1.7));
  const m = voice(t);
  placeCat(ginger, s, {
    t, walk: s.walk, phase: s.phase, stride: 0.15, sit, ...look, headPitch: look.headPitch - 0.1 * m + 0.25 * pet, headRoll: 0.25 * pet * Math.sin(t * 2.5),
    jaw: m, earFwd: 1, pupil: 0.65, tailUp: lerp(0.95, 0.8, sit), tailCurl: 0.75, tailSwish: 0.1, tailPhase: TAILP(t),
    lid: 0.45 * pet, breathe: t * 2.4, blink: blinkAt(t, [14.2]),
  });
  garden.update(t, v3(0.8, 0.3, 1.1));
  const c = S2bcam(t);
  return { scene: garden.scene, set: 'garden', cam: [c[0], c[1], c[2]], look: [c[3], c[4], c[5]], fov: 38, focus: catHeadW, aperture: 14 };
}

// ---- shot 3a: kitchen, meow → the person looks → food ----
const S3cam = spline([
  [16.9, 3.92, 0.24, -1.08, 4.3, 0.3, -0.35], [19.6, 3.95, 0.25, -1.06, 4.33, 0.36, -0.4],
  [20.9, 3.7, 0.5, -1.15, 4.32, 0.2, -0.62], [22.4, 3.72, 0.48, -1.12, 4.32, 0.18, -0.64],
]);
const K3 = walker([[16.9, 4.18, -0.5, 2.3], [21.75, 4.18, -0.5, 2.3], [22.2, 4.3, -0.6, 2.2], [22.4, 4.31, -0.61, 2.2]]);
const S3h = spline([ // t, yaw, spine, headPitch, pour(0/1)
  [16.9, Math.PI, 0.1, 0.3, 0], [19.8, Math.PI, 0.1, 0.3, 0], [20.6, Math.PI + 0.75, 0.25, 0.75, 0], [21.1, Math.PI + 0.75, 0.95, 0.8, 0], [22.4, Math.PI + 0.75, 1.0, 0.85, 1],
]);
function shot3a(t) {
  const s = K3(t);
  const hp = S3h(t);
  human.root.position.set(4.95, 0, -0.95);
  human.root.rotation.set(0, hp[0], 0);
  const bowlTop = v3(4.42, 0.32, -0.74);
  const pour = ss(21.15, 21.4, t) * (1 - ss(22.0, 22.2, t));
  const handW = bowlTop.clone().add(v3(0.04, 0.02 + 0.3 * (1 - ss(20.6, 21.1, t)), 0.02));
  human.setPose({
    pelvis: v3(0, 0.95 - 0.18 * ss(20.6, 21.1, t), -0.05 * hp[1]), spine: hp[1], headPitch: hp[2], breathe: t * 1.6,
    footL: v3(-0.12, 0.08, 0.0), footR: v3(0.12, 0.08, 0.06),
    handR: ss(20.3, 20.7, t) > 0 ? human.root.worldToLocal(handW.clone().lerp(human.root.localToWorld(v3(0.25, 0.9, 0.35)), 1 - ss(20.3, 20.9, t))) : v3(0.22, 0.9, 0.42),
    handL: v3(-0.22, 0.9, 0.42), palmR: v3(0.6, -0.2, 0).normalize(), curl: 0.6,
  });
  // cup in the right hand, tilting to pour
  const hand = human.hands[1];
  house.cupG.visible = true;
  house.cupG.position.copy(hand.position).add(v3(0, -0.02, 0));
  house.cupG.rotation.set(0, 0, -1.8 * ss(21.0, 21.4, t) * (1 - 0.3 * ss(22.0, 22.3, t)));
  house.cupKib.visible = t < 21.9;
  house.setKibble(ss(21.25, 22.05, t), pour, t, house.cupG.position.clone().add(v3(-0.04, -0.02, 0)));
  const sit = 1 - ss(21.75, 22.0, t);
  const humanHead = human.head.getWorldPosition(v3());
  let look = mixA(lookAngles(s, sit, v3(4.42, 0.05, -0.75)), lookAngles(s, sit, humanHead), ss(18.6, 19.1, t));
  look = mixA(look, lookAngles(s, sit, v3(4.42, 0.05, -0.75)), ss(21.2, 21.5, t));
  const m = voice(t);
  placeCat(ginger, s, {
    t, walk: s.walk, phase: s.phase, stride: 0.15, sit, ...look, headPitch: look.headPitch - 0.1 * m + 0.35 * ss(22.0, 22.3, t),
    crouch: 0.7 * ss(22.05, 22.35, t), reach: ss(22.05, 22.35, t), jaw: m + 0.15 * ss(22.2, 22.3, t) * Math.max(0, Math.sin(t * 22)),
    earFwd: 1, pupil: 0.75, tailUp: lerp(0.8, 0.9, ss(21.6, 22.0, t)), tailCurl: 0.7, tailSwish: 0.2, tailPhase: TAILP(t, 2.8), tailWrap: 0.6 * sit,
    breathe: t * 2.4, blink: blinkAt(t, [17.8, 20.4]),
  });
  const c = S3cam(t);
  return { scene: house.scene, set: 'house', cam: [c[0], c[1], c[2]], look: [c[3], c[4], c[5]], fov: 40,
    focus: t < 20.7 ? v3(4.25, 0.3, -0.5) : v3(4.42, 0.12, -0.74), aperture: 14, key: [v3(4.6, 2.0, 0.1), v3(4.4, 0.1, -0.7)] };
}

// ---- shot 3b: front door ----
const D3 = walker([[22.4, -3.62, -0.42, -3.04], [26.35, -3.62, -0.42, -3.04], [26.7, -3.72, -0.75, -2.9], [27.0, -3.85, -1.1, -2.85]]);
const S3bcam = spline([[22.4, -3.22, 0.27, -0.98, -3.68, 0.36, -0.3], [24.6, -3.24, 0.27, -0.97, -3.66, 0.4, -0.3], [26.2, -3.25, 0.3, -0.95, -3.7, 0.45, -0.35], [27.0, -3.17, 0.32, -0.5, -3.95, 0.3, -1.5]]);
function shot3b(t) {
  const s = D3(t);
  const open = easeInOut(remap(t, 25.75, 26.8));
  house.setDoor(open);
  const handleW = house.doorG.localToWorld(v3(0.79, 1.0, 0.08));
  human.root.position.set(-3.4, 0, 0.02);
  human.root.rotation.set(0, Math.PI, 0);
  const reach = ss(24.9, 25.6, t);
  human.setPose({
    pelvis: v3(0, 0.95, -0.08 * reach), spine: 0.1 + 0.55 * reach, headPitch: 0.5, breathe: t * 1.6, footL: v3(-0.12, 0.08, 0.1), footR: v3(0.12, 0.08, 0.05),
    handR: reach > 0 ? human.root.worldToLocal(handleW.clone().lerp(human.root.localToWorld(v3(-0.3, 0.9, 0.3)), 1 - reach)) : null, palmR: v3(1, 0, 0), curl: 0.7,
  });
  const sit = 1 - ss(26.3, 26.55, t);
  let look = lookAngles(s, sit, v3(-3.66, 1.0, -1.0));
  look = mixA(look, lookAngles(s, sit, v3(-3.4, 1.3, 0.0)), window01(t, 23.7, 24.9, 0.35));
  look = mixA(look, lookAngles(s, sit, v3(-4.0, 0.3, -1.5)), ss(26.0, 26.4, t));
  const m = voice(t);
  placeCat(ginger, s, {
    t, walk: s.walk, phase: s.phase, stride: 0.15, sit, ...look, headPitch: look.headPitch - 0.1 * m, bend: 0.4 * window01(t, 23.7, 24.9, 0.35),
    jaw: m, earFwd: 1, pupil: 0.8 - 0.4 * open, tailUp: 0.85, tailCurl: 0.8, tailSwish: 0.18, tailPhase: TAILP(t, 2.6), tailWrap: 0.5 * sit,
    breathe: t * 2.4, blink: blinkAt(t, [23.2]),
  });
  const c = S3bcam(t);
  return { scene: house.scene, set: 'house', cam: [c[0], c[1], c[2]], look: [c[3], c[4], c[5]], fov: 42, focus: v3(s.x, 0.3, s.z), aperture: 13,
    key: [v3(-3.0, 2.2, 0.6), v3(-3.6, 0.2, -0.5)] };
}

// ---- shot 4a: hunger — empty bowl, cat looks straight up into the lens ----
const S4acam = spline([[27.0, 4.62, 1.1, 0.1, 4.33, 0.18, -0.5], [30.9, 4.55, 0.98, 0.0, 4.33, 0.2, -0.5]]);
function shot4a(t) {
  const s = { x: 4.3, z: -0.52, yaw: 0.55 };
  house.cupG.visible = false;
  house.setKibble(0, 0, t, null);
  const c = S4acam(t);
  const camP = v3(c[0], c[1], c[2]);
  let look = mixA(lookAngles(s, 1, camP), lookAngles(s, 1, v3(4.42, 0.03, -0.75)), window01(t, 27.7, 28.6, 0.3));
  const m = voice(t);
  placeCat(ginger, s, {
    t, sit: 1, ...look, headPitch: look.headPitch - 0.15 * m, jaw: m * 1.1, earFwd: 1, pupil: 0.95, tailUp: 0.6, tailCurl: 0.4, tailSwish: 0.35, tailPhase: TAILP(t, 3), tailWrap: 0.7,
    breathe: t * 2.6, blink: blinkAt(t, [28.9]),
  });
  human.root.position.set(100, 0, 100);
  return { scene: house.scene, set: 'house', cam: [c[0], c[1], c[2]], look: [c[3], c[4], c[5]], fov: 38, focus: v3(4.33, 0.3, -0.45), aperture: 12,
    key: [v3(4.6, 2.0, 0.1), v3(4.3, 0.1, -0.5)], label: 'lab1' };
}

// ---- shot 4b: attention — rubbing against the legs ----
const R4 = walker([[30.9, -0.45, 0.02, 1.57], [34.7, 0.62, 0.02, 1.57]], 0.24);
function shot4b(t) {
  const s = R4(t);
  human.root.position.set(0.3, 0, -0.2);
  human.root.rotation.set(0, 0, 0);
  human.setPose({ pelvis: v3(0, 0.95, 0), headPitch: 0.6, breathe: t * 1.6, footL: v3(-0.11, 0.08, 0.04), footR: v3(0.11, 0.08, 0.02) });
  const near = Math.exp(-(((s.x - 0.2) / 0.22) ** 2)) + Math.exp(-(((s.x - 0.42) / 0.22) ** 2));
  const m = voice(t);
  placeCat(ginger, s, {
    t, walk: s.walk, phase: s.phase, stride: 0.15, bend: -0.9 * clamp(near), headYaw: -0.55 * clamp(near), headRoll: -0.35 * clamp(near), headPitch: 0.1 - 0.15 * m,
    jaw: m * 0.6, lid: 0.35 * clamp(near), earFwd: 0.6, tailUp: 1.0, tailCurl: 0.95, tailSwish: 0.25, tailPhase: TAILP(t, 1.4), breathe: t * 2.4,
  });
  const camP = v3(s.x * 0.6 + 0.05, 0.32, 1.12);
  return { scene: house.scene, set: 'house', cam: camP.toArray(), look: [s.x * 0.6 + 0.12, 0.34, -0.1], fov: 40, focus: v3(s.x + 0.2, 0.3, 0.0), aperture: 14,
    key: [v3(1.2, 1.6, 0.9), v3(0.2, 0.2, 0)], label: 'lab2' };
}

// ---- shot 4c: calling — at the closed door, facing the room ----
const S4ccam = spline([[34.7, -3.38, 0.24, 0.35, -3.6, 0.3, -0.7], [38.9, -3.45, 0.27, 0.12, -3.62, 0.33, -0.7]]);
function shot4c(t) {
  house.setDoor(0);
  const s = { x: -3.62, z: -0.72, yaw: 0.12 };
  const c = S4ccam(t);
  let look = lookAngles(s, 1, v3(c[0], c[1] + 0.9, c[2] + 0.6));
  look = mixA(look, lookAngles(s, 1, v3(-3.85, 1.0, -1.05)), window01(t, 35.4, 36.9, 0.4));
  const m = voice(t);
  placeCat(ginger, s, {
    t, sit: 1, ...look, headPitch: look.headPitch - 0.2 * m, jaw: m * 1.1, earFwd: 1, pupil: 0.8, tailUp: 0.55, tailCurl: 0.35, tailSwish: 0.45, tailPhase: TAILP(t, 3.2), tailWrap: 0.3,
    breathe: t * 2.6, blink: blinkAt(t, [35.2, 37.3]),
  });
  human.root.position.set(100, 0, 100);
  return { scene: house.scene, set: 'house', cam: [c[0], c[1], c[2]], look: [c[3], c[4], c[5]], fov: 40, focus: v3(-3.62, 0.3, -0.62), aperture: 14,
    key: [v3(-3.0, 2.2, 0.4), v3(-3.6, 0.2, -0.7)], label: 'lab3' };
}

// ---- shot 5: sofa — curled up, slow blink, purr, pull back ----
const S5cam = spline([[38.9, 0.5, 0.74, -0.95, 0.24, 0.68, -1.5], [42.5, 0.6, 0.8, -0.65, 0.2, 0.66, -1.55], [48.6, 0.7, 0.8, -0.05, 0.18, 0.56, -1.6]]);
function shot5(t) {
  human.root.position.set(-0.12, 0, -1.62);
  human.root.rotation.set(0, 0, 0);
  // left hand strokes the cat's back (head → tail), lifted on the way back
  const cyc = ((t - 38.9) % 2.4) / 2.4;
  const down = cyc < 0.62;
  const u = down ? cyc / 0.62 : 1 - (cyc - 0.62) / 0.38;
  const catW = (x, y, z) => v3(x, y, z).applyAxisAngle(v3(0, 1, 0), -0.4).add(v3(0.3, 0.53, -1.6));
  const strokeA = catW(0, 0.235, 0.06), strokeB = catW(0, 0.225, -0.16);
  const hand = strokeA.clone().lerp(strokeB, u * u * (3 - 2 * u)).add(v3(0, down ? 0 : 0.06 * Math.sin(Math.PI * u), 0));
  human.setPose({
    pelvis: v3(0, 0.6, -0.02), pelvisPitch: -0.28, spine: 0.05, headPitch: 0.55, headYaw: 0.45, breathe: t * 1.4,
    footL: v3(-0.13, 0.08, 0.52), footR: v3(0.13, 0.08, 0.5),
    handL: human.root.worldToLocal(hand.clone()), palmL: v3(0, -1, 0), curl: 0.15, handR: v3(-0.05, 0.62, 0.33),
  });
  const s = { x: 0.3, y: 0.53, z: -1.6, yaw: -0.4 };
  placeCat(ginger, s, {
    t, lie: 1, tailWrap: 1, headYaw: 0.25 + 0.05 * Math.sin(t * 0.7), headPitch: 0.25 + 0.25 * ss(44.2, 45.5, t), headRoll: 0.15,
    earFwd: 0.4, earSide: 0.25, lid: 0.3 + slowBlink(t, [40.4, 43.4]) * 0.7 + 0.45 * ss(45.5, 47.5, t), pupil: 0.5,
    tailUp: 0.2, tailCurl: 0.2, tailSwish: 0.05, tailPhase: TAILP(t, 0.6), breathe: t * 2.0, purr: 1,
  });
  const c = S5cam(t);
  return { scene: house.scene, set: 'house', cam: [c[0], c[1], c[2]], look: [c[3], c[4], c[5]], fov: lerp(36, 38, ss(39, 48.6, t)),
    focus: v3(0.22, 0.72, -1.45), aperture: lerp(14, 8, ss(42, 48, t)), key: [v3(1.4, 1.7, -0.6), v3(0.2, 0.55, -1.6)], keyI: 14 };
}

const SHOTS = [shot1, shot2a, shot2b, shot3a, shot3b, shot4a, shot4b, shot4c, shot5];
const shotIndex = (t) => { let i = 0; while (i < SHOTS.length - 1 && t >= CUTS[i + 1]) i++; return i; };

// ---------------- overlay ----------------
const $ = (id) => document.getElementById(id);
const op = (el, v, tr) => { el.style.opacity = clamp(v).toFixed(3); if (tr !== undefined) el.style.transform = tr; };
const pop = (t, a) => (0.9 + 0.1 * ss(a, a + 0.25, t)).toFixed(3);
function updateOverlay(t) {
  op($('c2a'), window01(t, 8.2, 12.2, 0.35), `translateX(-50%) scale(${pop(t, 8.2)})`);
  op($('c2b'), window01(t, 13.5, 16.8, 0.35), `translateX(-50%) scale(${pop(t, 13.5)})`);
  op($('c3'), window01(t, 17.5, 26.9, 0.35), `translateX(-50%) scale(${pop(t, 17.5)})`);
  op($('lab1'), window01(t, 27.25, 30.85, 0.3), `translateX(-50%) scale(${pop(t, 27.25)})`);
  op($('lab2'), window01(t, 31.1, 34.65, 0.3), `translateX(-50%) scale(${pop(t, 31.1)})`);
  op($('lab3'), window01(t, 34.9, 38.85, 0.3), `translateX(-50%) scale(${pop(t, 34.9)})`);
  op($('bl'), window01(t, 35.4, 38.85, 0.35), `translateX(-50%) scale(${pop(t, 35.4)})`);
  op($('outro'), window01(t, 44.9, DURATION + 1, 0.5), `translateX(-50%) translateY(${((1 - ss(44.9, 45.5, t)) * 30).toFixed(1)}px)`);
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
function frame(t) {
  const i = shotIndex(t);
  for (const g of [ginger, grey, human]) g.root.visible = true;
  house.cupG.visible = false;
  const sh = SHOTS[i](t);
  // the grey cat only lives in the garden scene; everyone else follows the active set
  sh.scene.add(ginger.root, human.root);
  grey.root.visible = sh.set === 'garden' && i === 1;
  if (grey.root.visible) sh.scene.add(grey.root);
  if (i === 1) human.root.visible = false;
  if (i === 5 || i === 7) human.root.visible = false;
  if (sh.key) house.setKey(sh.key[0], sh.key[1], sh.keyI ?? 30);
  // subtle handheld drift
  const hd = v3(Math.sin(t * 0.9) * 0.004 + Math.sin(t * 2.3) * 0.0015, Math.sin(t * 1.3 + 1) * 0.003, Math.sin(t * 0.7 + 2) * 0.003);
  cam.position.set(...sh.cam).add(hd);
  cam.fov = sh.fov;
  cam.updateProjectionMatrix();
  cam.lookAt(...sh.look);
  cam.updateMatrixWorld(true);
  house.fill.position.copy(cam.position).add(v3(0, 0.3, 0));
  const focus = cam.position.distanceTo(sh.focus);
  post.renderLayer(0, sh.scene, cam, { focus, aperture: sh.aperture, maxBlur: 16 });
  // whip-blur across each cut
  let mot = 0;
  for (const c of CUTS.slice(1, -1)) mot = Math.max(mot, 1 - Math.abs(t - c) / 0.1);
  post.composite({
    exposure: sh.set === 'garden' ? 1.0 : 1.15, bloom: 0.45, vignette: 0.55, threshold: 1.0,
    motion: [70 * clamp(mot), 0],
    fade: (1 - ss(0, 0.35, t)) + ss(DURATION - 0.5, DURATION, t) * 0.85,
    frame: Math.round(t * FPS),
  });
  updateOverlay(t);
  return { t: +t.toFixed(4), shot: i };
}

export const EVENTS = [
  ...MEOWS.map(([t, d, s, kind]) => ({ t, type: kind, d, s })),
  { t: 21.2, type: 'pour' },
  { t: 25.7, type: 'door' },
  { t: 38.9, type: 'purr' },
  { t: 44.9, type: 'outro' },
  ...CUTS.slice(1, -1).map((t) => ({ t, type: 'cut' })),
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
