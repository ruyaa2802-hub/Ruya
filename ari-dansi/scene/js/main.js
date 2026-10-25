import * as THREE from 'three';
import { clamp, lerp, remap, smooth, ss, easeInOut, easeOut, window01, v3, lerpAngle, quatFromForwardUp } from './util.js';
import { createBee } from './bee.js';
import { createGarden, DANCE_ANGLE } from './garden.js';
import { createHive } from './hive.js';
import { Post } from './post.js';

// ===========================================================================
//  "Arılar Dans Ederek Konuşuyor!" — 42.5 s, 4 scenes, deterministic: every
//  frame is a pure function of time t, so it can be rendered frame-by-frame.
// ===========================================================================

const PARAMS = new URLSearchParams(location.search);
const VERT = PARAMS.get('format') === 'vertical'; // Shorts / Reels: 1080×1920
const W = VERT ? 1080 : 1280, H = VERT ? 1920 : 720;
const SUBS = VERT || PARAMS.has('subs');
// portrait frames get a taller vertical field of view so subjects keep similar horizontal room
const FOV = (f) => (VERT ? 2 * THREE.MathUtils.radToDeg(Math.atan(Math.tan(THREE.MathUtils.degToRad(f / 2)) * 1.62)) : f);
{
  const stage = document.getElementById('stage');
  stage.style.width = `${W}px`;
  stage.style.height = `${H}px`;
  if (VERT) stage.classList.add('vertical');
  const cv = document.getElementById('c');
  cv.width = W;
  cv.height = H;
  cv.style.width = `${W}px`;
  cv.style.height = `${H}px`;
  const svg = document.getElementById('diag');
  svg.setAttribute('width', W);
  svg.setAttribute('height', H);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
}
const SUBTITLES = SUBS ? await fetch('./subtitles.json').then((r) => r.json()) : [];
export const FPS = 30;
export const DURATION = 42.5;

const T = {
  s2: 8.95, // garden → hive (whip pan)
  land1: 4.7, takeoff1: 7.65,
  hiveLand: 10.25, danceStart: 10.6, RUN: 1.5, RET: 1.15, danceEnd: 30.65,
  toAerial: 22.0, fromAerial: 24.75,
  flash: 33.45,
  heroLand2: 38.6, heroLift2: 39.9, heroHover: 41.05,
};
const CIRCUIT = T.RUN + T.RET;
const BEE_Z = 0.36; // bee height above the comb surface
const BEE_STAND = 0.34; // bee height above a flower centre
const UP = v3(0, 1, 0);
const COMB_N = v3(0, 0, 1);

// ---------------- Renderer ----------------
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const post = new Post(renderer, W, H);

// ---------------- Dance geometry (on the comb, z = 0 plane) ----------------
const TH = DANCE_ANGLE; // waggle-run angle, clockwise from "up"
const dance = {
  M: new THREE.Vector2(0, 0),
  d: new THREE.Vector2(Math.sin(TH), Math.cos(TH)),
  n: new THREE.Vector2(Math.cos(TH), -Math.sin(TH)),
  L: 1.15,
  loopW: 0.8,
};
dance.A = dance.M.clone().addScaledVector(dance.d, -dance.L / 2);
dance.B = dance.M.clone().addScaledVector(dance.d, dance.L / 2);

const garden = createGarden();
const hive = createHive(dance);
const camG = new THREE.PerspectiveCamera(FOV(40), W / H, 0.1, 2500);
const camH = new THREE.PerspectiveCamera(FOV(40), W / H, 0.05, 120);

// ---------------- Cast ----------------
const gHero = createBee({ hero: true, seed: 1 });
garden.scene.add(gHero.root);
const hHero = createBee({ hero: true, seed: 1 });
hive.scene.add(hHero.root);
const FOLLOWERS = 6;
const gFol = [], hFol = [];
for (let i = 0; i < FOLLOWERS; i++) {
  const opts = { seed: 10 + i, size: 0.9 + ((i * 37) % 10) / 70, tint: (i % 3) - 1 };
  const a = createBee(opts);
  garden.scene.add(a.root);
  gFol.push(a);
  const b = createBee(opts);
  hive.scene.add(b.root);
  hFol.push(b);
}
const hIdle = [];
const IDLE_POS = [[-5.2, 2.6], [4.6, 3.6], [-3.8, -3.4], [5.8, -2.6], [-7.2, -0.6], [2.4, -4.6], [-1.5, 4.4]];
IDLE_POS.forEach((p, i) => {
  const b = createBee({ seed: 40 + i, size: 0.88 + (i % 3) * 0.05, tint: (i % 3) - 1 });
  hive.scene.add(b.root);
  hIdle.push(b);
});

// ---------------- Helpers ----------------
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const tmp = v3(), tmp2 = v3();
const rotY = (v, a) => v3(v.x * Math.cos(a) + v.z * Math.sin(a), v.y, -v.x * Math.sin(a) + v.z * Math.cos(a));
const combPos = (p2, z = BEE_Z) => v3(p2.x, p2.y, z);
const combQuat = (heading, out = new THREE.Quaternion()) => quatFromForwardUp(v3(Math.sin(heading), Math.cos(heading), 0), COMB_N, out);
const headingTo = (from, to) => Math.atan2(to.x - from.x, to.y - from.y);
const bell = (t, c, w) => Math.exp(-((t - c) * (t - c)) / (2 * w * w));

function curve(points) {
  return new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);
}
// Flight pose along a curve with time mapping; banks into turns.
function flyPose(cv, t0, t1, ease, t, upBase = UP) {
  const P = (tt) => cv.getPointAt(clamp(ease(remap(tt, t0, t1))));
  const h = 1 / 60;
  const p = P(t);
  const pa = P(t - h), pb = P(t + h);
  const vel = pb.clone().sub(pa);
  let fwd = vel.lengthSq() > 1e-10 ? vel.clone().normalize() : cv.getTangentAt(clamp(ease(remap(t, t0, t1)))).normalize();
  fwd.y = clamp(fwd.y, -0.45, 0.45);
  fwd.normalize();
  const acc = pb.clone().add(pa).addScaledVector(p, -2).divideScalar(h * h);
  const lat = acc.clone().addScaledVector(fwd, -acc.dot(fwd));
  const upHint = upBase.clone().addScaledVector(lat, 0.012).normalize();
  return { p, q: quatFromForwardUp(fwd, upHint), fwd, speed: vel.length() / (2 * h) };
}

// ---------------- Waggle dance (pure function of t) ----------------
function danceAt(t) {
  const { M, d, n, L, loopW, A, B } = dance;
  if (t < T.danceStart) return { p: A.clone(), head: TH, run: false, u: 0, k: -1, wig: 0, walk: 0, tau: 0 };
  const tt = Math.min(t, T.danceEnd) - T.danceStart;
  const k = Math.min(Math.floor(tt / CIRCUIT), Math.floor((T.danceEnd - T.danceStart) / CIRCUIT));
  let tau = tt - k * CIRCUIT;
  if (t >= T.danceEnd) tau = T.RUN; // frozen at end of final run
  if (tau < T.RUN || t >= T.danceEnd) {
    const u = Math.min(1, tau / T.RUN);
    const env = ss(0, 0.08, u) * (1 - ss(0.94, 1, u));
    const wig = Math.sin(2 * Math.PI * 7.5 * tau) * env * (t >= T.danceEnd ? 0 : 1);
    const p = A.clone().lerp(B, u).addScaledVector(n, 0.05 * wig);
    return { p, head: TH + 0.18 * Math.sin(2 * Math.PI * 7.5 * tau + 0.6) * env, run: t < T.danceEnd, u, k, wig, walk: 0.6, tau };
  }
  const u = (tau - T.RUN) / T.RET;
  const side = k % 2 === 0 ? 1 : -1;
  const ph = Math.PI * smooth(u);
  const p = M.clone().addScaledVector(d, (L / 2) * Math.cos(ph)).addScaledVector(n, side * loopW * Math.sin(ph));
  const tg = d.clone().multiplyScalar(-(L / 2) * Math.sin(ph)).addScaledVector(n, side * loopW * Math.cos(ph));
  let head = Math.atan2(tg.x, tg.y);
  head = lerpAngle(TH, head, ss(0, 0.16, u));
  head = lerpAngle(head, TH, ss(0.84, 1, u));
  return { p, head, run: false, u, k, wig: 0, walk: 1, tau };
}

// ===========================================================================
//  GARDEN — scene 1 and scene 4 choreography
// ===========================================================================
garden.heroFlower.update(0);
const T1 = garden.heroFlower.top();
const toCam1 = v3(0.62, 0, 0.78).normalize();
const f1 = toCam1.clone().negate();
const rgt1 = v3(-f1.z, 0, f1.x);
const heroHeading1 = rotY(toCam1, 0.5);
const camB = T1.clone().addScaledVector(toCam1, 3.7).add(v3(0, 0.95, 0));
const camA = T1.clone().addScaledVector(toCam1, 23).addScaledVector(rgt1, 6).add(v3(0, 9.5, 0));
const camMid = T1.clone().addScaledVector(toCam1, 10).addScaledVector(rgt1, 1.5).add(v3(0, 3.6, 0));
const camPath1 = curve([camA, camMid, camB]);
const lookA = T1.clone().addScaledVector(f1, 7).addScaledVector(rgt1, -2).add(v3(0, -0.5, 0));

const P1 = (r, f, u) => T1.clone().addScaledVector(rgt1, r).addScaledVector(f1, f).add(v3(0, u, 0));
const heroPath1 = curve([P1(-12, 7, 2.6), P1(-7, 3, 3.6), P1(-3.6, 4.2, 1.9), P1(-1.4, 1.2, 2.7), P1(0.7, -0.3, 1.3), P1(0, 0, BEE_STAND)]);
const heroTake1 = curve([P1(0, 0, BEE_STAND), P1(0, 0.2, 1.3), P1(-3.2, 0.9, 1.6), P1(-10.5, 0.6, 2.1)]);
const easeSinOut = (u) => Math.sin((u * Math.PI) / 2);

// Scene 4 (garden part)
const E = garden.entrance.clone();
const L = garden.landingFlowers;
const { gDir, hDir, perp, G, HIVE } = garden;
const flowerTopAt = (f, t) => { f.update(t); return f.top(); };
L.forEach((f) => f.update(0));
const Ltop0 = L.map((f) => f.top());
const lerpE = (P, u) => E.clone().lerp(P, u);
const heroPath4 = curve([
  E.clone(),
  E.clone().addScaledVector(gDir, 2.5).add(v3(0, 1.6, 0)),
  lerpE(Ltop0[0], 0.35).add(v3(0, 3.0, 0)).addScaledVector(perp, 0.8),
  lerpE(Ltop0[0], 0.72).add(v3(0, 3.3, 0)).addScaledVector(perp, -0.6),
  Ltop0[0].clone().add(v3(0, 1.5, 0)).addScaledVector(gDir, -1.4),
  Ltop0[0].clone().add(v3(0, BEE_STAND, 0)),
]);
const folStart4 = (i) => T.flash + 0.15 + i * 0.28;
const folLand4 = (i) => T.heroLand2 + 0.2 + i * 0.24;
const folPath4 = Array.from({ length: FOLLOWERS }, (_, i) => {
  const s = i % 2 ? 1 : -1;
  const Lt = Ltop0[i + 1];
  return curve([
    E.clone(),
    E.clone().addScaledVector(gDir, 2.4).add(v3(0, 1.2 + 0.3 * (i % 3), 0)).addScaledVector(perp, s * 0.8),
    lerpE(Lt, 0.4).add(v3(0, 2.4 + (i % 3) * 0.6, 0)).addScaledVector(perp, s * (1.3 + 0.3 * i)),
    lerpE(Lt, 0.75).add(v3(0, 3.0 + (i % 2) * 0.5, 0)).addScaledVector(perp, s * 0.6),
    Lt.clone().add(v3(0, 1.3, 0)).addScaledVector(gDir, -1.0),
    Lt.clone().add(v3(0, BEE_STAND, 0)),
  ]);
});
L[0].landings.push(T.heroLand2, T.heroLift2);
for (let i = 0; i < FOLLOWERS; i++) L[i + 1].landings.push(folLand4(i));
garden.heroFlower.landings.push(T.land1, T.takeoff1);

// Camera rigs for scene 4
const estabPos = E.clone().addScaledVector(gDir, 6.5).addScaledVector(perp, 3.2).add(v3(0, 1.0, 0));
const estabLook = E.clone().addScaledVector(gDir, 1.0).add(v3(0, 0.6, 0));
const wideLook = G.clone().addScaledVector(hDir, 9).add(v3(0, 1.4, 0));
if (VERT) wideLook.lerp(Ltop0[0], 0.4); // narrow portrait frame: keep Pırıltı's flower in shot
const widePos0 = G.clone().addScaledVector(hDir, 21.5).addScaledVector(perp, -3.5).add(v3(0, 7.0, 0));
function widePos(t) {
  return widePos0.clone().lerp(wideLook, 0.1 * ss(39.6, 42.5, t));
}
const heroP4 = (t) => heroPath4.getPointAt(clamp(easeSinOut(remap(t, T.flash, T.heroLand2))));
function gardenCam4(t) {
  const hp = heroP4(Math.min(t, T.heroLand2));
  const chasePos = hp.clone().addScaledVector(gDir, -3.9).add(v3(0, 1.75, 0)).addScaledVector(perp, 2.1);
  const chaseLook = hp.clone().addScaledVector(gDir, 4).add(v3(0, -0.2, 0));
  const w1 = easeInOut(remap(t, 34.0, 35.3));
  const w2 = easeInOut(remap(t, 37.2, 39.9));
  const pos = estabPos.clone().lerp(chasePos, w1).lerp(widePos(t), w2);
  const look = estabLook.clone().lerp(chaseLook, w1).lerp(wideLook, w2);
  return { pos, look };
}
// Final hover point in front of the camera
const camEnd = (() => {
  const c = gardenCam4(T.heroHover);
  const fwd = c.look.clone().sub(c.pos).normalize();
  const right = v3(-fwd.z, 0, fwd.x).normalize();
  const up = right.clone().cross(fwd).normalize();
  return { ...c, fwd, right, up };
})();
const hover = camEnd.pos.clone().addScaledVector(camEnd.fwd, 3.9).addScaledVector(camEnd.right, 0.15).addScaledVector(camEnd.up, 0.22);
const heroLift = curve([
  Ltop0[0].clone().add(v3(0, BEE_STAND, 0)),
  Ltop0[0].clone().add(v3(0, 1.3, 0)),
  hover.clone().addScaledVector(camEnd.right, -2.6).addScaledVector(camEnd.fwd, 1.2).add(v3(0, 0.5, 0)),
  hover.clone().addScaledVector(camEnd.right, -0.9).add(v3(0, 0.1, 0)),
  hover.clone(),
]);

// ===========================================================================
//  HIVE — scene 2/3/4 choreography
// ===========================================================================
const A3 = combPos(dance.A);
const heroIn = curve([v3(10, 3.0, 4.2), v3(5.8, 2.4, 3.4), v3(2.4, 0.7, 2.1), v3(dance.A.x + 0.4, dance.A.y - 0.7, 1.05), A3.clone()]);
const FOL_ANG = [2, 142, 180, 220, 262, 314].map((a) => THREE.MathUtils.degToRad(a));
const folHome = FOL_ANG.map((a) => new THREE.Vector2(Math.cos(a) * 2.05, Math.sin(a) * 2.05));
const folFrom = FOL_ANG.map((a, i) => new THREE.Vector2(Math.cos(a + 0.5) * (3.7 + (i % 3) * 0.5), Math.sin(a + 0.5) * (3.7 + (i % 3) * 0.5)));
const folTake = (i) => 31.75 + i * 0.22;

function hiveFollowerOnComb(i, t) {
  const t0 = 9.9 + i * 0.16, t1 = t0 + 1.5;
  const u = easeInOut(remap(t, t0, t1));
  const home = folHome[i];
  const dp = danceAt(t).p;
  const toward = dp.clone().sub(home).normalize();
  const lean = 0.18 * (0.5 + 0.5 * Math.sin(0.9 * t + i * 1.7)) * ss(11.5, 12.5, t);
  const p = folFrom[i].clone().lerp(home, u).addScaledVector(toward, lean);
  const moveHead = headingTo(folFrom[i], home);
  const lookHead = headingTo(p, dp);
  const head = u < 1 ? lerpAngle(moveHead, lookHead, ss(0.6, 1, u)) : lookHead;
  const walking = u > 0 && u < 1 ? 1 : 0.25 * Math.abs(Math.sin(t * 0.9 + i));
  return { p, head, walk: walking, walkPhase: t * 2.2 + i };
}

// ===========================================================================
//  Overlay (SVG diagram + text)
// ===========================================================================
const $ = (id) => document.getElementById(id);
const ov = {
  title: $('title'), diag: $('diag'), upLine: $('upLine'), sun: $('sun'), arc: $('arc'), runArrow: $('runArrow'), hub: $('hub'),
  miniBee: $('miniBee'), angleTag: $('angleTag'), sunTag: $('sunTag'), hiveTag: $('hiveTag'), gardenTag: $('gardenTag'),
  dirPill: $('dirPill'), upPill: $('upPill'), panel: $('panel'), fillA: $('fillA'), fillB: $('fillB'), end: $('end'), sub: $('sub'),
};
const C = { x: W / 2, y: H / 2 };
const ARROW = VERT ? 560 : 262;
const UPLEN = VERT ? 540 : 250;
const SUN_Y = C.y - UPLEN - 26;
const ARC_R = VERT ? 110 : 72;
const AD = { x: Math.sin(TH), y: -Math.cos(TH) };
const op = (el, v, extra = '') => { el.style.opacity = v.toFixed(3); if (extra) el.style.transform = extra; };
const place = (el, x, y) => { el.style.left = `${x}px`; el.style.top = `${y}px`; };
const tip = { x: C.x + AD.x * ARROW, y: C.y + AD.y * ARROW };
for (const id of ['upLine', 'runArrow']) { ov[id].setAttribute('x1', C.x); ov[id].setAttribute('y1', C.y); ov[id].setAttribute('x2', C.x); ov[id].setAttribute('y2', C.y); }
ov.hub.setAttribute('cx', C.x);
ov.hub.setAttribute('cy', C.y);
if (VERT) {
  place(ov.angleTag, C.x + 165 * Math.sin(TH / 2) - 26, C.y - 165 * Math.cos(TH / 2) - 20);
  place(ov.sunTag, C.x + 46, SUN_Y - 22);
  place(ov.hiveTag, C.x - 140, C.y + 34);
  place(ov.gardenTag, tip.x - 250, tip.y - 76);
  ov.upPill.style.top = '170px';
  ov.dirPill.style.top = '1150px';
} else {
  place(ov.angleTag, C.x + 112 * Math.sin(TH / 2) - 18, C.y - 112 * Math.cos(TH / 2) - 14);
  place(ov.sunTag, C.x + 32, SUN_Y - 18);
  place(ov.hiveTag, C.x - 92, C.y + 24);
  place(ov.gardenTag, tip.x + 23, tip.y - 19);
  place(ov.upPill, 60, 120);
  place(ov.dirPill, 340, 620);
}
{
  const a1 = -Math.PI / 2, a2 = -Math.PI / 2 + TH, r = ARC_R;
  ov.arc.setAttribute('d', `M ${C.x + r * Math.cos(a1)} ${C.y + r * Math.sin(a1)} A ${r} ${r} 0 0 1 ${C.x + r * Math.cos(a2)} ${C.y + r * Math.sin(a2)}`);
  ov.arcLen = r * TH;
  ov.arc.setAttribute('stroke-dasharray', `${ov.arcLen} ${ov.arcLen}`);
}

function updateOverlay(t) {
  const ti = window01(t, 0.45, 3.9, 0.55);
  op(ov.title, ti, `scale(${(0.94 + 0.06 * ss(0.45, 3.9, t)).toFixed(4)})`);

  const diagOn = window01(t, 18.55, 24.65, 0.3);
  op(ov.diag, diagOn);
  const pU = ss(18.7, 19.35, t);
  ov.upLine.setAttribute('y2', (C.y - UPLEN * pU).toFixed(1));
  const sp = ss(19.15, 19.55, t);
  ov.sun.setAttribute('transform', `translate(${C.x},${SUN_Y}) scale(${(sp * (1 + 0.15 * bell(t, 19.5, 0.12))).toFixed(3)}) rotate(${(t * 20).toFixed(1)})`);
  const pR = ss(19.0, 20.0, t);
  ov.runArrow.setAttribute('x2', (C.x + AD.x * ARROW * pR).toFixed(1));
  ov.runArrow.setAttribute('y2', (C.y + AD.y * ARROW * pR).toFixed(1));
  ov.runArrow.style.opacity = pR > 0.01 ? 1 : 0;
  const pA = ss(20.1, 20.6, t);
  ov.arc.setAttribute('stroke-dashoffset', (ov.arcLen * (1 - pA)).toFixed(2));
  op(ov.angleTag, diagOn * ss(20.4, 20.7, t));
  op(ov.sunTag, diagOn * ss(19.4, 19.8, t));
  op(ov.upPill, window01(t, 19.3, 21.9, 0.35));
  op(ov.dirPill, window01(t, 20.6, 24.5, 0.35));
  const aer = window01(t, 22.2, 24.5, 0.3);
  op(ov.hiveTag, aer);
  op(ov.gardenTag, aer);
  const mb = remap(t, 22.6, 23.9);
  const mbx = C.x + AD.x * ARROW * easeInOut(mb), mby = C.y + AD.y * ARROW * easeInOut(mb);
  ov.miniBee.setAttribute('transform', `translate(${mbx.toFixed(1)},${mby.toFixed(1)}) rotate(-55) translate(0,${(Math.sin(t * 40) * 1.5).toFixed(2)})`);
  ov.miniBee.style.opacity = window01(t, 22.5, 24.3, 0.2);

  op(ov.panel, window01(t, 25.4, 30.4, 0.4));
  const dz = danceAt(t);
  let fill = 0;
  if (t > 26.4) fill = dz.run ? dz.u : 1;
  ov.fillA.style.width = `${(fill * 100).toFixed(1)}%`;
  ov.fillB.style.width = `${(fill * 100).toFixed(1)}%`;

  // subtitles (burned in for the Shorts version)
  let subOn = 0;
  for (const c of SUBTITLES) {
    if (t >= c.start - 0.1 && t < c.end + 0.15) {
      if (ov.sub.textContent !== c.text) ov.sub.textContent = c.text;
      subOn = window01(t, c.start - 0.1, c.end + 0.15, 0.1);
      break;
    }
  }
  op(ov.sub, subOn);

  op(ov.end, window01(t, 41.3, 43.5, 0.5), `translateY(${((1 - ss(41.3, 41.9, t)) * 14).toFixed(1)}px)`);
}

// ===========================================================================
//  Frame
// ===========================================================================
function setCam(cam, pos, look, fov = FOV(40), up = UP) {
  cam.position.copy(pos);
  cam.up.copy(up);
  cam.lookAt(look);
  if (cam.fov !== fov) { cam.fov = fov; cam.updateProjectionMatrix(); }
  cam.updateMatrixWorld(true);
}

function poseGardenBees(t) {
  const hp = { t, antenna: 1, smile: 1.05 };
  let pos, quat, wing = 1;
  const standQ = (head) => quatFromForwardUp(head, UP, new THREE.Quaternion());
  const heroVisible = t < T.s2 + 0.3 || t > T.flash - 0.05;
  gHero.root.visible = heroVisible;

  if (t < T.land1) {
    const f = flyPose(heroPath1, -0.2, T.land1, easeSinOut, t);
    pos = f.p;
    const w = ss(T.land1 - 0.7, T.land1, t);
    quat = f.q.clone().slerp(standQ(heroHeading1), w);
    wing = 1;
  } else if (t < T.takeoff1) {
    garden.heroFlower.update(t);
    pos = garden.heroFlower.top().add(v3(0, BEE_STAND, 0));
    quat = standQ(heroHeading1);
    wing = 1 - ss(T.land1, T.land1 + 0.35, t) + ss(7.35, T.takeoff1, t);
    const nectar = window01(t, 5.0, 6.3, 0.3);
    hp.bodyPitch = 0.32 * nectar;
    hp.headPitch = 0.35 * nectar - 0.12 * window01(t, 6.3, 7.3, 0.2);
    hp.tongue = window01(t, 5.15, 6.15, 0.2);
    hp.headYaw = 0.6 * window01(t, 6.35, 6.85, 0.18) - 0.6 * window01(t, 6.85, 7.35, 0.18);
    hp.blink = bell(t, 6.62, 0.05) + bell(t, 7.45, 0.05);
    hp.antennaPerk = window01(t, 6.3, 7.6, 0.2);
    hp.smile = 1 + 0.35 * window01(t, 7.1, 7.7, 0.15);
    pos.y += 0.13 * Math.max(0, Math.sin(Math.PI * remap(t, 7.2, 7.5))) + 0.03 * Math.sin(t * 9) * nectar;
  } else if (t < T.s2 + 0.4) {
    const f = flyPose(heroTake1, T.takeoff1, T.s2 + 0.3, (u) => u * u, t);
    pos = f.p;
    quat = standQ(heroHeading1).slerp(f.q, ss(T.takeoff1, T.takeoff1 + 0.45, t));
    wing = 1;
  } else if (t < T.heroLand2) {
    const f = flyPose(heroPath4, T.flash, T.heroLand2, easeSinOut, t);
    pos = f.p;
    quat = f.q.clone().slerp(standQ(gDir), ss(T.heroLand2 - 0.6, T.heroLand2, t));
    wing = 1;
  } else if (t < T.heroLift2) {
    pos = flowerTopAt(L[0], t).add(v3(0, BEE_STAND, 0));
    quat = standQ(gDir);
    wing = 1 - ss(T.heroLand2, T.heroLand2 + 0.3, t) + ss(T.heroLift2 - 0.3, T.heroLift2, t);
    const nectar = window01(t, 38.85, 39.6, 0.2);
    hp.bodyPitch = 0.3 * nectar;
    hp.headPitch = 0.3 * nectar;
    hp.tongue = nectar;
  } else if (t < T.heroHover) {
    const f = flyPose(heroLift, T.heroLift2, T.heroHover, easeInOut, t);
    pos = f.p;
    quat = standQ(gDir).slerp(f.q, ss(T.heroLift2, T.heroLift2 + 0.4, t));
    const flat = camEnd.right.clone();
    quat.slerp(standQ(flat), ss(T.heroHover - 0.35, T.heroHover, t));
  } else {
    // hover and turn to the camera
    const k = t - T.heroHover;
    pos = hover.clone().add(v3(0, 0.05 * Math.sin(k * 5.0), 0));
    const toCam = camEnd.pos.clone().sub(hover);
    toCam.y *= 0.4;
    const spin = easeOut(remap(t, T.heroHover + 0.05, T.heroHover + 0.75));
    quat = standQ(camEnd.right).slerp(standQ(toCam.normalize()), spin);
    hp.bodyRoll = 0.12 * Math.sin(k * 3.0) * spin;
    hp.smile = 1 + 0.4 * spin;
    hp.blink = bell(t, 41.95, 0.05);
    hp.antennaPerk = spin;
    hp.headRoll = 0.15 * window01(t, 41.6, 42.4, 0.25);
  }
  gHero.root.position.copy(pos);
  gHero.root.quaternion.copy(quat);
  hp.wing = wing;
  const camFwd = v3(); camG.getWorldDirection(camFwd);
  hp.backlight = Math.pow(Math.max(0, camFwd.dot(garden.sunDir)), 2) * wing;
  gHero.setPose(hp);

  // Followers (scene 4 only)
  gFol.forEach((b, i) => {
    const t0 = folStart4(i), t1 = folLand4(i);
    b.root.visible = t > t0 && t > T.flash;
    if (!b.root.visible) return;
    const p = { t, antenna: 1 };
    if (t < t1) {
      const f = flyPose(folPath4[i], t0, t1, easeSinOut, t);
      b.root.position.copy(f.p);
      b.root.quaternion.copy(f.q.slerp(standQ(rotY(gDir, (i - 3) * 0.4)), ss(t1 - 0.5, t1, t)));
      p.wing = 1;
    } else {
      b.root.position.copy(flowerTopAt(L[i + 1], t).add(v3(0, BEE_STAND, 0)));
      b.root.quaternion.copy(standQ(rotY(gDir, (i - 3) * 0.4)));
      p.wing = 1 - ss(t1, t1 + 0.3, t);
      const n = window01(t, t1 + 0.4, t1 + 2.5, 0.3);
      p.bodyPitch = 0.3 * n;
      p.headPitch = 0.3 * n;
    }
    p.backlight = Math.pow(Math.max(0, camFwd.dot(garden.sunDir)), 2) * p.wing;
    b.setPose(p);
  });
  return { wing };
}

function poseHiveBees(t) {
  // --- Pırıltı ---
  const hp = { t, antenna: 1 };
  let pos, quat, wing = 0;
  if (t < T.hiveLand) {
    const f = flyPose(heroIn, T.s2 - 0.05, T.hiveLand, easeSinOut, t);
    pos = f.p;
    quat = f.q.clone().slerp(combQuat(TH), ss(T.hiveLand - 0.55, T.hiveLand, t));
    wing = 1 - ss(T.hiveLand, T.hiveLand + 0.3, t);
  } else if (t < T.danceEnd) {
    const dz = danceAt(t);
    pos = combPos(dz.p);
    quat = combQuat(dz.head);
    wing = 1 - ss(T.hiveLand, T.hiveLand + 0.3, t);
    hp.bodyYaw = 0.2 * dz.wig;
    hp.abdomenYaw = 0.5 * dz.wig;
    hp.buzz = dz.run ? 1 : 0;
    hp.walk = dz.walk;
    hp.walkPhase = t * 3.2;
    hp.smile = 1.15;
    hp.antennaPerk = 0.5;
  } else {
    const B3 = combPos(dance.B);
    const turnHead = lerpAngle(TH, THREE.MathUtils.degToRad(78), easeInOut(remap(t, T.danceEnd, 31.3)));
    const fwd = v3(Math.sin(turnHead), Math.cos(turnHead), 0);
    const ground = B3.clone().addScaledVector(fwd, 0.18 * ss(T.danceEnd, 31.3, t));
    wing = ss(31.0, 31.35, t);
    if (t < 31.4) {
      pos = ground;
      quat = combQuat(turnHead);
      hp.walk = 1;
      hp.walkPhase = t * 3;
    } else {
      const cv = curve([ground, ground.clone().add(v3(0.5, 0.3, 1.2)), v3(4.6, 1.6, 2.9), v3(9.2, 2.0, 3.6), v3(15, 2.3, 4.2)]);
      const f = flyPose(cv, 31.4, 33.5, (u) => u * u * (1.6 - 0.6 * u), t);
      pos = f.p;
      quat = combQuat(turnHead).slerp(f.q, ss(31.4, 31.9, t));
    }
    hp.smile = 1.25;
  }
  hHero.root.position.copy(pos);
  hHero.root.quaternion.copy(quat);
  hp.wing = wing;
  hHero.setPose(hp);
  hHero.root.visible = t > T.s2 - 0.3;

  // --- followers ---
  hFol.forEach((b, i) => {
    const p = { t, antenna: 1.3 };
    const tf = folTake(i);
    if (t < tf) {
      const s = hiveFollowerOnComb(i, t);
      b.root.position.copy(combPos(s.p));
      b.root.quaternion.copy(combQuat(s.head));
      p.walk = s.walk;
      p.walkPhase = s.walkPhase;
      p.wing = ss(tf - 0.35, tf, t);
      p.antennaPerk = ss(11, 12, t) * 0.6;
    } else {
      const s = hiveFollowerOnComb(i, tf);
      const g0 = combPos(s.p);
      const cv = curve([g0, g0.clone().add(v3(0.7, 0.5, 1.4)), v3(4.8 + i * 0.3, 1.0 + (i % 3) * 0.6, 3 + (i % 2) * 0.8), v3(15, 1.5 + (i % 3) * 0.5, 3.6 + (i % 2))]);
      const f = flyPose(cv, tf, tf + 2.0, (u) => u * u * (1.6 - 0.6 * u), t);
      b.root.position.copy(f.p);
      b.root.quaternion.copy(combQuat(s.head).slerp(f.q, ss(tf, tf + 0.45, t)));
      p.wing = 1;
    }
    b.setPose(p);
  });
  hIdle.forEach((b, i) => {
    const [x, y] = IDLE_POS[i];
    const w = 0.35;
    const P = (tt) => new THREE.Vector2(x + w * Math.sin(0.33 * tt + i * 1.3), y + w * 0.8 * Math.cos(0.27 * tt + i * 2.1));
    const p0 = P(t), p1 = P(t + 0.1);
    b.root.position.copy(combPos(p0));
    b.root.quaternion.copy(combQuat(headingTo(p0, p1)));
    b.setPose({ t, walk: 0.8, walkPhase: t * 1.6 + i, antenna: 1, headPitch: 0.1 * Math.sin(t + i) });
  });
  return { pos };
}

// Trail on the comb (diagram that shows the figure-eight path)
function updateTrail(t) {
  const dz = danceAt(t);
  const show = ss(13.0, 14.0, t) * (1 - ss(30.4, 31.0, t));
  const strong = 0.55 + 0.45 * window01(t, 18.4, 30.3, 0.5);
  hive.setTrail({
    runReveal: dz.run ? dz.u : t > 13 ? 1 : 0,
    runOpacity: show * strong * (dz.run ? 1 : 0.65),
    loopOpacity: show * 0.75,
  });
}

// ---------------- Shot list ----------------
function hiveCamera(t) {
  const frontPos = A3.clone().setZ(VERT ? 6.2 : 7.4);
  const frontLook = A3.clone().setZ(0);
  const p0 = v3(4.6, 3.2, 8.4), l0 = v3(1.5, 0.5, 0);
  const p1 = v3(1.25, 2.55, 4.3), l1 = v3(0.05, 0.05, 0);
  const orbit = v3(Math.sin(t * 0.35) * 0.25, 0, 0);
  const u1 = easeInOut(remap(t, 10.4, 16.8));
  let pos = p0.clone().lerp(p1, u1).add(orbit.multiplyScalar(u1));
  let look = l0.clone().lerp(l1, u1);
  if (t < 10.6) {
    // follow the incoming bee a little
    const hp = hHero.root.position;
    look.lerp(hp, 0.35 * (1 - ss(10.2, 10.6, t)));
  }
  const u2 = easeInOut(remap(t, 16.8, 18.6));
  pos.lerp(frontPos, u2);
  look.lerp(frontLook, u2);
  // scene 4: pull back & follow the bees toward the entrance light
  const u3 = easeInOut(remap(t, 30.7, 33.4));
  const exitPos = v3(lerp(A3.x, 7.2, u3), lerp(A3.y, 1.0, u3), lerp(7.4, 8.6, u3));
  const exitLook = hHero.root.position.clone().lerp(v3(14, 1.8, 3.8), VERT ? 0.08 : 0.25);
  pos.lerp(exitPos, ss(30.7, 31.2, t));
  look.lerp(exitLook, ss(30.9, 31.8, t));
  const focus = pos.distanceTo(t < 30.9 ? (t < T.danceStart ? hHero.root.position : A3) : hHero.root.position);
  const front = remap(t, 17.5, 18.6) * (1 - remap(t, 30.6, 31.2));
  return { pos, look, focus, aperture: lerp(13, 4.5, front), maxBlur: 12 };
}

// height chosen so the hive→garden distance spans exactly ARROW pixels on screen (angle and length match the diagram)
const aerialPos = HIVE.clone().add(v3(0, (H / 2) * Math.hypot(G.x - HIVE.x, G.z - HIVE.z) / (Math.tan(THREE.MathUtils.degToRad(30)) * ARROW), 0));

function frame(t) {
  // which world(s) are on screen
  const layers = [];
  let mixv = 0, motion = [0, 0], flash = 0;
  const inGarden1 = t < T.s2 + 0.2;
  const inHive = t > T.s2 - 0.2 && t < T.flash + 0.01;
  const aerialMix = ss(T.toAerial - 0.4, T.toAerial + 0.4, t) * (1 - ss(T.fromAerial - 0.4, T.fromAerial + 0.4, t));
  const inGarden4 = t >= T.flash;

  // pose everything
  poseHiveBees(t);
  updateTrail(t);
  hive.update(t);

  // --- garden camera ---
  let gcam = null;
  if (inGarden1) {
    const u = easeInOut(remap(t, 0, 5.0));
    let pos = camPath1.getPointAt(u);
    if (t > 5.0) pos = T1.clone().addScaledVector(rotY(toCam1, (t - 5.0) * 0.045), 3.7 - 0.25 * ss(5, 7.6, t)).add(v3(0, 0.95, 0));
    gcam = { pos, look: null, focus: 0, aperture: 9 };
  } else if (inGarden4) {
    const c = gardenCam4(t);
    gcam = { ...c, aperture: lerp(9, 6, ss(37.5, 39.8, t)) };
  }
  if (gcam || aerialMix > 0) {
    // pose garden bees (needs camera direction for wing back-light → set camera first with provisional look)
    if (gcam) setCam(camG, gcam.pos, gcam.look || T1);
    poseGardenBees(t);
  }
  if (inGarden1) {
    const hp = gHero.root.position;
    let look = lookA.clone().lerp(hp.clone().add(v3(0, 0.12, 0)), ss(0.6, 3.6, t));
    if (t > T.takeoff1) look = T1.clone().add(v3(0, 0.45, 0)).lerp(hp, 0.62 * ss(T.takeoff1, 8.5, t));
    if (t > T.land1 - 0.3 && t <= T.takeoff1) look = T1.clone().add(v3(0, 0.45, 0)).lerp(hp, 0.2);
    gcam.look = look;
    gcam.focus = gcam.pos.distanceTo(hp);
    setCam(camG, gcam.pos, look);
    garden.setShadowFocus(T1, t < 3 ? 26 : 10);
    garden.update(t, camG, camG.position.clone().lerp(T1, 0.7));
    garden.updateSparks(t, T1, 5.1, 1.3);
  }
  if (inGarden4) {
    const target = gHero.root.position;
    gcam.focus = gcam.pos.distanceTo(target);
    setCam(camG, gcam.pos, gcam.look);
    garden.setShadowFocus(t < 37.5 ? target : wideLook, t < 37.5 ? 16 : 22);
    garden.update(t, camG, camG.position.clone().lerp(gcam.look, 0.5));
    garden.updateSparks(t, Ltop0[0], 38.9, 0.9);
  }

  if (t < T.s2 - 0.25) {
    post.renderLayer(0, garden.scene, camG, { focus: gcam.focus, aperture: gcam.aperture });
  } else if (t < T.s2 + 0.2) {
    // whip pan: garden → hive
    post.renderLayer(0, garden.scene, camG, { focus: gcam.focus, aperture: gcam.aperture });
    const hc = hiveCamera(t);
    setCam(camH, hc.pos, hc.look);
    post.renderLayer(1, hive.scene, camH, hc);
    mixv = ss(T.s2 - 0.08, T.s2 + 0.08, t);
    motion = [-110 * bell(t, T.s2, 0.09), 0];
  } else if (inHive) {
    const hc = hiveCamera(t);
    setCam(camH, hc.pos, hc.look);
    post.renderLayer(0, hive.scene, camH, hc);
    if (aerialMix > 0) {
      setCam(camG, aerialPos, HIVE, 60, garden.sDir);
      gFol.forEach((b) => (b.root.visible = false));
      gHero.root.visible = false;
      garden.setShadowFocus(HIVE.clone().lerp(G, 0.5), 48);
      garden.update(t, camG, HIVE);
      garden.setFog(260, 1200);
      post.renderLayer(1, garden.scene, camG, { focus: 92, aperture: 0 });
      garden.setFog(60, 320);
      mixv = aerialMix;
    }
    if (t > T.flash - 0.35) flash = bell(t, T.flash, 0.12) * 1.0;
  } else {
    post.renderLayer(0, garden.scene, camG, { focus: gcam.focus, aperture: gcam.aperture });
    flash = bell(t, T.flash, 0.12);
  }
  if (t >= T.flash && t < T.flash + 0.5) flash = bell(t, T.flash, 0.12);

  post.composite({
    mix: mixv,
    motion,
    flash: clamp(flash),
    exposure: inHive && t > T.s2 + 0.2 ? 1.05 : 1.0,
    bloom: inHive && !inGarden4 ? 0.75 : 0.55,
    vignette: inHive ? 0.7 : 0.5,
    fade: 1 - ss(0, 0.5, t),
    frame: Math.round(t * FPS),
    threshold: inHive ? 0.85 : 1.1,
  });
  updateOverlay(t);
  return cues(t, mixv);
}

// ---------------- Audio cues (exported for the sound design script) ----------------
const _v = v3();
function project(obj, cam) {
  obj.getWorldPosition(_v);
  const d = _v.distanceTo(cam.position);
  const s = _v.clone().project(cam);
  return { x: +s.x.toFixed(3), y: +s.y.toFixed(3), d: +d.toFixed(2), on: Math.abs(s.x) < 1.2 && Math.abs(s.y) < 1.2 && s.z < 1 };
}
function cues(t, mixv) {
  const world = t < T.s2 ? 'garden' : t < T.flash ? 'hive' : 'garden';
  const cam = world === 'garden' ? camG : camH;
  const hero = world === 'garden' ? gHero : hHero;
  const dz = danceAt(t);
  const fols = world === 'garden' ? gFol : hFol;
  let flying = 0, dsum = 0;
  fols.forEach((b) => {
    if (!b.root.visible) return;
    const pr = project(b.root, cam);
    dsum += pr.d;
    flying += 1;
  });
  return {
    t: +t.toFixed(4),
    world,
    aerial: +mixv.toFixed(3),
    hero: { ...project(hero.root, cam), vis: hero.root.visible },
    waggle: dz.run && t > T.danceStart && t < T.danceEnd,
    swarm: { n: flying, d: flying ? +(dsum / flying).toFixed(2) : 0 },
  };
}

// timeline events for the sound designer
export const EVENTS = (() => {
  const ev = [];
  ev.push({ t: T.land1, type: 'land' }, { t: 5.15, type: 'sparkle' }, { t: 7.25, type: 'hop' }, { t: T.takeoff1, type: 'takeoff' });
  ev.push({ t: T.s2, type: 'whoosh' }, { t: T.hiveLand, type: 'land_soft' });
  for (let k = 0; T.danceStart + k * CIRCUIT < T.danceEnd; k++) ev.push({ t: T.danceStart + k * CIRCUIT, type: 'waggle', dur: T.RUN });
  ev.push({ t: 18.7, type: 'chime' }, { t: 19.2, type: 'pop' }, { t: 20.1, type: 'chime' }, { t: T.toAerial, type: 'swoosh_soft' }, { t: 22.6, type: 'zip' }, { t: T.fromAerial, type: 'swoosh_soft' });
  ev.push({ t: 26.5, type: 'tick_fill', dur: T.RUN }, { t: 29.15, type: 'tick_fill', dur: T.RUN });
  ev.push({ t: 31.4, type: 'takeoff' }, { t: T.flash, type: 'flash' }, { t: T.heroLand2, type: 'land' });
  for (let i = 0; i < FOLLOWERS; i++) ev.push({ t: folLand4(i), type: 'land_small' });
  ev.push({ t: 38.9, type: 'sparkle' }, { t: T.heroLift2, type: 'takeoff' }, { t: T.heroHover + 0.1, type: 'turn' }, { t: 41.95, type: 'blink' });
  return ev;
})();

// ---------------- Boot ----------------
window.DURATION = DURATION;
window.FPS = FPS;
window.EVENTS = EVENTS;
window.renderAt = (t) => frame(t);
const isRender = new URLSearchParams(location.search).has('render');
if (!isRender) {
  // interactive preview: real-time playback (+ the mixed soundtrack if it exists)
  const audio = new Audio('../out/soundtrack.wav');
  let start = null;
  const stage = document.getElementById('stage');
  const fit = () => {
    const s = Math.min(innerWidth / W, innerHeight / H);
    stage.style.transform = `translate(${(innerWidth - W * s) / 2}px, ${(innerHeight - H * s) / 2}px) scale(${s})`;
    stage.style.transformOrigin = '0 0';
  };
  fit();
  addEventListener('resize', fit);
  const loop = (now) => {
    if (start === null) start = now;
    let t = (now - start) / 1000;
    if (t > DURATION) { start = now; t = 0; audio.currentTime = 0; }
    frame(t);
    requestAnimationFrame(loop);
  };
  addEventListener('click', () => { start = null; audio.currentTime = 0; audio.play().catch(() => {}); }, { once: false });
  requestAnimationFrame(loop);
}
window.READY = true;
