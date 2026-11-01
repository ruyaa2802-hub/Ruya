import * as THREE from 'three';
import { clamp, lerp, remap, ss, easeInOut, easeOut, window01, v3 } from './util.js';
import { createAxolotl } from './axolotl.js';
import { createLake } from './lake.js';
import { createMicro } from './micro.js';
import { Post } from './post.js';

// ===========================================================================
//  "Aksolotl – Kendini Yeniden İnşa Eden Canlı" — vertical 1080×1920, 48 s.
//  Every frame is a pure function of t. The timeline follows the narration
//  word timings (audio/words.json, +0.3 s). Two worlds: the lake (layer 0)
//  and the cellular view (layer 1), joined by dives / dissolves.
// ===========================================================================
const W = 1080, H = 1920;
export const FPS = 30;
export const DURATION = 48.0;

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const post = new Post(renderer, W, H);
post.finalMat.uniforms.lift.value.set(0.0, 0.02, 0.03);
post.finalMat.uniforms.gain.value.set(1.0, 0.99, 0.97);
post.finalMat.uniforms.saturation.value = 1.1;
const SUBS = await fetch('./subtitles.json').then((r) => r.json());

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

// ---------------- worlds ----------------
const lake = createLake();
const micro = createMicro();
const ax = createAxolotl();
ax.root.rotation.order = 'YXZ';
lake.scene.add(ax.root);
const cam = new THREE.PerspectiveCamera(30, W / H, 0.005, 400);
const camM = new THREE.PerspectiveCamera(36, W / H, 0.02, 200);
const HOME = v3(0, 0, 0);
const gy = (x, z) => lake.groundY(x, z);
function place(x, z, lift, yaw, pose, pitch = 0, roll = 0) {
  ax.root.position.set(x, gy(x, z) + 0.07 + lift, z);
  ax.root.rotation.set(pitch, yaw, roll);
  ax.root.updateMatrixWorld(true);
  return ax.setPose(pose);
}
// water mood: 0 = dark & mysterious opening, 1 = bright habitat
function mood(k) {
  lake.fog.density = lerp(0.2, 0.09, k);
  lake.fog.color.setRGB(lerp(0.03, 0.09, k), lerp(0.12, 0.3, k), lerp(0.2, 0.3, k));
  lake.skyU.top.value.setRGB(lerp(0.12, 0.42, k), lerp(0.32, 0.75, k), lerp(0.48, 0.7, k));
  lake.skyU.mid.value.setRGB(lerp(0.02, 0.08, k), lerp(0.1, 0.3, k), lerp(0.18, 0.3, k));
  lake.hemi.intensity = lerp(0.55, 1.15, k);
  lake.sun.intensity = lerp(1.0, 2.5, k);
  lake.uCaustic.value = lerp(0.35, 1.0, k);
}

// ===========================================================================
//  SHOTS
// ===========================================================================
// ---- S1 (0–6.3): dark water, slow push to the face; the axolotl looks at us; then down to the front leg ----
const C1 = spline([
  [0, 0.25, 0.3, 2.4, 0, 0.08, 0.1], [3.2, 0.08, 0.14, 1.15, 0, 0.09, 0.22],
  [4.4, 0.36, 0.07, 0.78, 0.1, 0.035, 0.15], [6.3, 0.34, 0.03, 0.4, 0.13, 0.025, 0.1],
]);
function shot1(t) {
  mood(0.15 + 0.25 * ss(3, 6.3, t));
  const w = place(0, 0, 0, 0, { t, gill: 1, smile: 0.6, regen: 0, headYaw: 0.08 * Math.sin(t * 0.6), headPitch: 0.04 + 0.03 * Math.sin(t * 0.8), breathe: t * 2 });
  const c = C1(t);
  return { cam: c.slice(0, 3), look: c.slice(3), fov: 30, focus: t < 3.8 ? w.head : w.legTip, ap: 10, key: v3(0, 0, 0) };
}

// ---- S2 (6.3–15.3): time-lapse regeneration of the front-right leg (+ x-ray of the new tissues) ----
const RG0 = 6.6, RG1 = 14.3;
function shot2(t) {
  mood(0.45);
  const regen = easeInOut(remap(t, RG0, RG1));
  const inner = window01(t, 10.7, 15.5, 0.5);
  const w = place(0, 0, 0.09, 0, { t, gill: 1, smile: 0.6, regen, inner, reach: 1, headYaw: 0.05 * Math.sin(t * 0.6), breathe: t * 2, ground: -0.16 });
  const orbit = lerp(0.35, -0.1, easeInOut(remap(t, 6.3, 15.3)));
  const d = 0.5;
  const L = w.legBase.clone().add(v3(0.065, -0.012, 0.025)); // middle of the (future) leg; the shoulder does not move
  return { cam: [L.x + Math.sin(orbit) * d, L.y - 0.01, L.z + Math.cos(orbit) * d], look: [L.x - 0.005, L.y - 0.004, L.z], fov: 30, focus: L, ap: 8, key: v3(0, 0, 0), leg: true, regen, inner };
}

// ---- S3 (15.3–24.3): dive into the tip → cellular view: migration, blastema, proliferation, new tissues ----
const DIVE = 15.35, M0 = 16.05;
function shot3Lake(t) {
  mood(0.45);
  const w = place(0, 0, 0, 0, { t, gill: 1, smile: 0.6, regen: 1, breathe: t * 2 });
  const tip = w.legTip;
  const k = easeInOut(remap(t, DIVE, M0 + 0.4));
  const start = v3(tip.x + 0.22, tip.y + 0.03, tip.z + 0.2);
  const p = start.lerp(tip, 0.92 * k);
  return { cam: [p.x, p.y, p.z], look: [tip.x, tip.y, tip.z], fov: 30 + 25 * k, focus: tip, ap: 8, key: v3(0, 0, 0) };
}
function shotMicro(t) {
  const m = t - M0;
  const info = micro.update(m);
  const orbit = 0.4 * Math.sin(m * 0.18) + m * 0.06;
  const d = lerp(1.6, 4.1, easeOut(clamp(m / 3))) + 0.3 * ss(5.5, 8, m);
  const ly = lerp(0.2, 0.75, ss(4, 8, m));
  return { cam: [Math.sin(orbit) * d, ly + 0.55 + 0.2 * Math.sin(m * 0.3), Math.cos(orbit) * d], look: [0, ly, 0], fov: 36, focus: v3(0, ly, 0), ap: 6, info, m };
}

// ---- S4 (24.3–35.0): back to the face: still "baby-like" — the feathery external gills ----
const C4 = spline([
  [24.3, 0.5, 0.22, 1.3, 0, 0.09, 0.22], [27.5, 0.32, 0.2, 1.2, 0, 0.09, 0.22], [30.3, 0.12, 0.18, 1.1, 0, 0.09, 0.2],
  [31.4, 0.5, 0.2, 0.5, 0.08, 0.1, 0.12], [33.4, 0.55, 0.22, 0.2, 0.12, 0.1, 0.06], [35.0, 0.5, 0.24, 0.02, 0.12, 0.1, 0.04],
]);
function shot4(t) {
  mood(0.6);
  const current = 1 + 0.6 * ss(31, 32, t);
  const w = place(0, 0, 0, 0, { t, gill: current, smile: 0.75, regen: 1, headYaw: 0.15 * Math.sin(t * 0.5), headPitch: 0.05, breathe: t * 2 });
  const c = C4(t);
  return { cam: c.slice(0, 3), look: c.slice(3), fov: 30, focus: t < 31 ? w.head : w.gills, ap: 9, key: v3(0, 0, 0) };
}

// ---- S5 (35.0–48): swimming slowly through the waterweed; camera pulls back; final turn to the camera ----
const P5 = spline([[35, -0.2, 0.1], [38, 0.25, -0.05], [41, 0.75, -0.25], [43.3, 0.95, -0.3], [48, 0.98, -0.3]]);
function shot5(t) {
  mood(lerp(0.75, 1.0, ss(35, 40, t)));
  const p = P5(t), p2 = P5(t + 0.1);
  const moving = 1 - ss(42.6, 43.4, t);
  const heading = Math.atan2(p2[0] - p[0], p2[1] - p[1]);
  const turn = easeInOut(remap(t, 43.2, 44.4));
  const camF = spline([[35, -0.5, 0.35, 1.6], [40.5, 0.2, 0.9, 3.6], [43.2, 0.9, 0.35, 1.6], [48, 0.95, 0.2, 1.05]])(t);
  const toCam = Math.atan2(camF[0] - p[0], camF[2] - p[1]);
  const yaw = lerp(heading, toCam, turn);
  const lift = 0.12 * moving + 0.02 * Math.sin(t * 1.2);
  const w = place(p[0], p[1], lift, yaw, {
    t, swim: 0.9 * moving, swimPhase: t * 0.9, tuck: moving, gill: 1.1, smile: 0.6 + 0.4 * turn, regen: 1, headYaw: 0.1 * turn, breathe: t * 2,
  }, -0.05 * moving);
  const look = spline([[35, -0.1, 0.12, 0.0], [40.5, 0.4, 0.25, -0.3], [43.2, 0.9, 0.1, -0.25], [48, 0.97, 0.07, -0.26]])(t);
  return { cam: camF, look, fov: 30, focus: w.head, ap: lerp(6, 3, ss(37, 40, t)) + 6 * ss(43, 45, t), key: v3(p[0], 0, p[1]), span: 2 };
}

// ===========================================================================
//  OVERLAY
// ===========================================================================
const $ = (id) => document.getElementById(id);
const op = (el, v, tr) => { el.style.opacity = clamp(v).toFixed(3); if (tr !== undefined) el.style.transform = tr; };
const pop = (t, a) => (0.9 + 0.1 * easeOut(clamp((t - a) / 0.3))).toFixed(3);
function anchor(el, p, c, a, dx = 0, dy = 0) {
  const s = p.clone().project(c);
  const hw = el.offsetWidth / 2 + 24;
  el.style.left = `${clamp((s.x * 0.5 + 0.5) * W + dx, hw, W - hw).toFixed(1)}px`;
  el.style.top = `${((-s.y * 0.5 + 0.5) * H + dy).toFixed(1)}px`;
  op(el, s.z < 1 ? a : 0, 'translate(-50%, -50%)');
}
function updateOverlay(t, sh) {
  op($('notsf'), window01(t, 4.3, 6.2, 0.25), `translateX(-50%) scale(${pop(t, 4.3)})`);
  op($('lapse'), window01(t, 6.8, 15.0, 0.3), 'translateX(-50%)');
  $('lapseBar').style.width = `${(100 * clamp(sh.regen ?? 0)).toFixed(1)}%`;
  op($('blastema'), window01(t, 17.7, 20.6, 0.25), `translateX(-50%) scale(${pop(t, 17.7)})`);
  op($('m1'), window01(t, 16.7, 19.6, 0.25), `translateX(-50%) scale(${pop(t, 16.7)})`);
  op($('m2'), window01(t, 19.7, 22.2, 0.25), `translateX(-50%) scale(${pop(t, 19.7)})`);
  op($('m3'), window01(t, 22.3, 24.2, 0.25), `translateX(-50%) scale(${pop(t, 22.3)})`);
  op($('legend'), window01(t, 22.5, 24.2, 0.25), 'translateX(-50%)');
  op($('neoteny'), window01(t, 26.4, 30.6, 0.3), `translateX(-50%) scale(${pop(t, 26.4)})`);
  op($('home'), window01(t, 37.4, 40.3, 0.3), `translateX(-50%) scale(${pop(t, 37.4)})`);
  op($('title'), window01(t, 40.4, 43.3, 0.35), `translateX(-50%) scale(${pop(t, 40.4)})`);
  op($('question'), window01(t, 43.4, DURATION + 1, 0.4), `translateX(-50%) scale(${pop(t, 43.4)})`);
  op($('brand'), ss(44.6, 45.2, t), 'translateX(-50%)');
  const hide = (...ids) => ids.forEach((id) => op($(id), 0));
  if (sh.leg) {
    const w = ax.world;
    anchor($('tBud'), w.legTip, cam, window01(t, 7.6, 10.2, 0.25), 0, 120);
    const T = w.tissue || {};
    const lab = (id, key, a, dx, dy) => (T[key] ? anchor($(id), T[key], cam, a, dx, dy) : op($(id), 0));
    lab('tBone', 'bone', window01(t, 11.08, 15.2, 0.2), -230, -170);
    lab('tMuscle', 'muscleA', window01(t, 11.92, 15.2, 0.2), 230, -90);
    lab('tNerve', 'nerve', window01(t, 12.76, 15.2, 0.2), -230, 120);
    lab('tVessel', 'artery', window01(t, 13.32, 15.2, 0.2), 230, 200);
  } else hide('tBud', 'tBone', 'tMuscle', 'tNerve', 'tVessel');
  if (t > 31 && t < 35.2) anchor($('tGills'), ax.world.gills, cam, window01(t, 31.3, 34.9, 0.25), 60, -160);
  else hide('tGills');
  let on = 0;
  for (const c of SUBS) {
    if (t >= c.start - 0.06 && t < c.end + 0.1) {
      if ($('sub').dataset.k !== c.html) { $('sub').innerHTML = c.html; $('sub').dataset.k = c.html; }
      on = window01(t, c.start - 0.06, c.end + 0.1, 0.06);
      break;
    }
  }
  op($('sub'), on, 'translateX(-50%)');
}

// ===========================================================================
function setCam(c, sh) {
  c.position.set(...sh.cam);
  c.fov = sh.fov;
  c.updateProjectionMatrix();
  c.lookAt(...sh.look);
  c.updateMatrixWorld(true);
}
function frame(t) {
  let A = null, B = null, mix = 0;
  if (t < 6.3) A = shot1(t);
  else if (t < DIVE) A = shot2(t);
  else if (t < M0 + 0.6) { A = shot3Lake(t); if (t > M0 - 0.2) { B = shotMicro(Math.max(t, M0)); mix = ss(M0 - 0.2, M0 + 0.6, t); } }
  else if (t < 24.0) A = null, B = shotMicro(t), mix = 1;
  else if (t < 24.7) { B = shotMicro(t); A = shot4(t); mix = 1 - ss(24.0, 24.7, t); }
  else if (t < 35.0) A = shot4(t);
  else A = shot5(t);
  if (A) {
    lake.update(t, v3(...A.look));
    lake.setFocus(A.key || HOME, A.span || 0.8);
    setCam(cam, A);
    post.renderLayer(0, lake.scene, cam, { focus: cam.position.distanceTo(A.focus), aperture: A.ap, maxBlur: 16 });
  }
  if (B) {
    setCam(camM, B);
    post.renderLayer(A ? 1 : 0, micro.scene, camM, { focus: camM.position.distanceTo(B.focus), aperture: B.ap, maxBlur: 14 });
  }
  if (!A) mix = 0;
  const cuts = [6.3, 35.0];
  let mot = 0;
  for (const c of cuts) mot = Math.max(mot, 1 - Math.abs(t - c) / 0.12);
  const sh = A || B;
  post.composite({
    mix, motion: [70 * clamp(mot), 0],
    flash: 0.25 * Math.exp(-(((t - M0) / 0.18) ** 2)) + 0.12 * Math.exp(-(((t - 24.2) / 0.2) ** 2)),
    exposure: t < 6.3 ? lerp(0.7, 0.95, ss(3, 6.3, t)) : 1.0, bloom: 0.55, vignette: t < 6.3 ? 0.75 : 0.5, threshold: 0.95,
    fade: (1 - ss(0, 0.6, t)) + ss(DURATION - 0.6, DURATION, t) * 0.9,
    frame: Math.round(t * FPS),
  });
  updateOverlay(t, sh === A ? A : { ...B });
  return { t: +t.toFixed(4) };
}

export const EVENTS = [
  { t: 0.0, type: 'swell' }, { t: 4.3, type: 'title' }, { t: 6.3, type: 'whoosh' },
  { t: 6.6, type: 'regen', d: 7.7 }, { t: 7.6, type: 'sparkle' }, { t: 11.08, type: 'ping', n: 0 }, { t: 11.92, type: 'ping', n: 1 }, { t: 12.76, type: 'ping', n: 2 }, { t: 13.32, type: 'ping', n: 3 },
  { t: DIVE, type: 'dive', d: M0 - DIVE + 0.3 }, { t: M0, type: 'micro', d: 8.2 }, { t: 17.7, type: 'title' }, { t: 19.7, type: 'divide', d: 2.4 }, { t: 22.3, type: 'sparkle' },
  { t: 24.0, type: 'whoosh' }, { t: 26.4, type: 'title' }, { t: 31.2, type: 'bubbles', d: 1.5 }, { t: 35.0, type: 'whoosh' }, { t: 37.4, type: 'title' },
  { t: 40.4, type: 'sparkle' }, { t: 43.4, type: 'outro' },
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
