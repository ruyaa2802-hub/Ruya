import * as THREE from 'three';
import { clamp, lerp, remap, ss, easeInOut, easeOut, window01, v3, canvasTexture, softDotTexture, rng } from './util.js';
import { createFlea } from './flea.js';
import { createGround, GROUND_Y } from './ground.js';
import { createFur } from './fur.js';
import { Post } from './post.js';

// ===========================================================================
//  "Bir Pire Kendi Boyunun 100 Katı Üzerine Nasıl Zıplar?" — vertical
//  1080×1920, 44.5 s, units = millimetres. Every frame is a pure function of t.
//  Sets: woven linen macro (ground), cat fur macro. Slow-motion sections are
//  stretched in time; the S5 jump is shown at real speed (gone in one frame).
// ===========================================================================
const W = 1080, H = 1920;
export const FPS = 30;
export const DURATION = 44.5;

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const post = new Post(renderer, W, H);
post.finalMat.uniforms.lift.value.set(0.014, 0.01, 0.012);
post.finalMat.uniforms.gain.value.set(1.0, 0.97, 0.92);
post.finalMat.uniforms.saturation.value = 1.05;
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
// path keys [t, x, z] → position, gait phase from distance travelled (heading +X)
function walker(keys, stridePerCycle = 0.9) {
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
    return { x: a[0], z: a[1], speed, walk: clamp(speed / 0.8), phase: dist(t) / stridePerCycle };
  };
}

// ---------------- world ----------------
const ground = createGround();
const fur = createFur();
const flea = createFlea();
flea.root.rotation.order = 'YXZ';
const cam = new THREE.PerspectiveCamera(32, W / H, 0.05, 4000);
function placeFlea(p, pose) {
  flea.root.position.set(p.x, p.y, p.z);
  flea.root.rotation.set(p.pitch || 0, p.yaw ?? Math.PI / 2, p.roll || 0);
  flea.root.updateMatrixWorld(true);
  flea.setPose(pose);
}
const fleaW = (lx, ly, lz) => flea.body.localToWorld(v3(lx, ly, lz));

// dust kicked up by take-offs / landings
const dot = softDotTexture();
const ND = 90;
const dustGeo = new THREE.BufferGeometry();
dustGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ND * 3), 3));
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ fog: false, size: 0.09, map: dot, color: '#fff4e0', transparent: true, depthWrite: false, opacity: 0 }));
dust.frustumCulled = false;
ground.scene.add(dust);
const DR = rng(5);
const dustSeeds = Array.from({ length: ND }, () => [DR() * 6.283, DR(), DR(), DR()]);
// bursts: [t0, x, z, strength, timeScale]
const BURSTS = [[1.32, 0.2, 0, 1, 0.25], [8.72, 0, 0.9, 0.8, 0.5], [22.12, 0, 0, 1, 0.25], [34.62, 0, 0, 0.7, 1], [37.0, 0, 0, 1.2, 1], [38.85, 0, 0, 0.8, 1]];
function updateDust(t, origin = {}) {
  let best = null;
  for (const b of BURSTS) if (t >= b[0] && t < b[0] + 2.2) best = b;
  if (!best) { dust.visible = false; return; }
  dust.visible = true;
  const [t0, , , str, ts] = best;
  const o = origin[t0] || v3(best[1], GROUND_Y, best[2]);
  const e = (t - t0) * ts;
  const arr = dustGeo.attributes.position.array;
  for (let i = 0; i < ND; i++) {
    const [a, s, u, w] = dustSeeds[i];
    const sp = (0.8 + 2.5 * s) * str;
    const drag = (1 - Math.exp(-e * 3)) / 3;
    arr[i * 3] = o.x + Math.cos(a) * sp * drag;
    arr[i * 3 + 1] = o.y + 0.1 + (1.5 + 2 * u) * str * drag - 0.25 * e * e * w;
    arr[i * 3 + 2] = o.z + Math.sin(a) * sp * drag;
  }
  dustGeo.attributes.position.needsUpdate = true;
  dust.material.opacity = 0.75 * (1 - clamp((t - t0) / 2.2)) * ss(t0, t0 + 0.05, t);
}

// representative 100× scale (S2b): vertical scale bar 0–300 mm, flight trail, marker ring
const scaleGrp = new THREE.Group();
ground.scene.add(scaleGrp);
{
  const seg = [];
  for (let mm = 0; mm <= 300; mm += 10) { const w = mm % 50 === 0 ? 7 : 3.5; seg.push(0, mm, 0, w, mm, 0); }
  seg.push(0, 0, 0, 0, 300, 0);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
  scaleGrp.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ fog: false, color: new THREE.Color(1.6, 2.2, 2.6), transparent: true, depthWrite: false })));
}
const NT = 120;
const trailGeo = new THREE.BufferGeometry();
trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NT * 3), 3));
const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ fog: false, color: new THREE.Color(2.6, 1.9, 0.9), transparent: true, depthWrite: false }));
trail.frustumCulled = false;
ground.scene.add(trail);
const ringTex = canvasTexture(128, 128, (g, w, h) => { g.strokeStyle = '#fff'; g.lineWidth = 9; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 8, 0, 6.283); g.stroke(); });
const marker = new THREE.Sprite(new THREE.SpriteMaterial({ fog: false, map: ringTex, color: new THREE.Color(2.4, 1.8, 0.8), transparent: true, depthWrite: false, depthTest: false }));
ground.scene.add(marker);

// ---------------- timeline ----------------
const ZOOM = 2.0;
export const CUTS = [4.6, 8.3, 12.8, 25.4, 29.6, 34.1];

// ---- S1 (0–4.6): macro approach, walk, sudden jump, slow-motion rise out of frame ----
const W1 = walker([[0, -3.2, 0], [0.9, -0.4, 0], [1.0, -0.25, 0], [1.3, -0.2, 0]]);
const T1 = 1.32; // take-off
function shot1(t) {
  const s = W1(Math.min(t, 1.3));
  const crouch = ss(0.85, 1.22, t);
  const k = ss(T1, T1 + 0.3, t); // slow-motion leg extension
  const fly = Math.max(0, t - T1 - 0.12);
  const y = GROUND_Y + 1.1 * k + 1.6 * fly + 1.0 * fly * fly;
  const x = s.x + 0.6 * k + 1.2 * fly;
  placeFlea({ x, y, z: s.z, pitch: -0.65 * k - 0.38 * fly }, { t, walk: t < 1 ? s.walk : 0, phase: s.phase, crouch, kick: k, air: ss(T1 + 0.35, T1 + 1.0, t) });
  const c = spline([[0, -7.5, 1.4, 7.5, -2.4, 0.9, 0], [1.2, -3.2, 1.05, 5.6, -0.4, 0.95, 0], [1.6, -3.0, 1.2, 5.6, 0.2, 2.0, 0], [4.6, -2.6, 2.8, 6.2, 1.8, 6.5, 0]])(t);
  return { set: 'g', cam: c.slice(0, 3), look: c.slice(3), fov: 30, focus: v3(x, Math.min(y + 0.6, c[4] + 0.5), 0), ap: 26, key: v3(x, GROUND_Y, 0), span: 8 };
}

// ---- S2a (4.6–8.3): beside the millimetre ruler ----
const W2 = walker([[4.6, -2.2, 0.95], [6.9, 0.6, 0.95], [7.3, 0.75, 0.95], [8.3, 0.75, 0.95]]);
function shot2a(t) {
  const s = W2(t);
  placeFlea({ x: s.x, y: GROUND_Y, z: s.z }, { t, walk: s.walk, phase: s.phase, crouch: 0.6 * ss(7.6, 8.3, t) });
  const c = spline([[4.6, -1.5, 5.6, 7.4, -0.6, 0.6, 0.0], [8.3, 0.4, 5.0, 6.6, 0.4, 0.6, 0.0]])(t);
  return { set: 'g', cam: c.slice(0, 3), look: c.slice(3), fov: 30, focus: v3(s.x, 0.9, s.z), ap: 14, key: v3(s.x, 0, 0), span: 9, ruler: true };
}

// ---- S2b (8.3–12.8): representative 3 mm → 30 cm jump, logarithmic camera pull-out ----
const X2 = 0.75, Z2 = 0.95, T2 = 8.72, TOP2 = 11.6;
const jump2 = (t) => {
  const u = clamp((t - T2) / (TOP2 - T2));
  const e = (1 - Math.cos(Math.PI * u)) / 2; // representative, eased so the pull-out can follow it
  return { x: X2 + 55 * e, y: GROUND_Y + 300 * e, u };
};
function shot2b(t) {
  const j = jump2(t);
  const k = ss(T2, T2 + 0.15, t);
  placeFlea({ x: j.x + 0.5 * k, y: t < T2 ? GROUND_Y : j.y + 1.0 * k, z: Z2, pitch: -0.7 * k - 2.2 * j.u }, { t, crouch: 0.6 + 0.4 * ss(8.3, 8.6, t), kick: k, air: ss(T2 + 0.2, T2 + 0.6, t) });
  // camera keeps the flea in the upper half while pulling out; then settles to show 0–30 cm
  const yf = t < T2 ? 0 : j.y - GROUND_Y, settle = ss(11.2, 12.3, t);
  const d = lerp(Math.hypot(11, 2.6 * yf), 700, settle);
  const lx = lerp(X2, 12, clamp(yf / 300)), ly = lerp(Math.max(1.0, yf - 0.1 * d + 1), 165, settle);
  return { set: 'g', cam: [lx + 0.12 * d, ly + 0.18 * d, d], look: [lx, ly, 0], fov: 32, focus: v3(j.x, j.y, Z2), ap: 14 * (11 / d) + 2, key: v3(j.x, GROUND_Y, 0), span: 8 + d * 0.4, scale: true, j };
}

// ---- S3 (12.8–25.4): side tracking → anatomical cut-away → release → launch ----
const W3 = walker([[12.8, -3.0, 0], [14.3, 0, 0], [14.6, 0.08, 0], [25.4, 0.08, 0]]);
const T3 = 22.0; // catch released (shown stretched ~600× in time)
function shot3(t) {
  const s = W3(t);
  const cut = ss(14.8, 15.6, t) * (1 - ss(23.3, 24.0, t));
  const crouch = ss(14.7, 15.6, t);
  const load = ss(15.4, 20.2, t);
  const rel = ss(T3, T3 + 0.7, t);
  const k = ss(T3 + 0.05, T3 + 0.6, t);
  const fly = Math.max(0, t - T3 - 0.55);
  const y = GROUND_Y + 1.05 * k + 2.2 * fly + 1.2 * fly * fly;
  placeFlea({ x: s.x + 0.9 * k + 1.6 * fly, y, z: 0, pitch: -0.55 * k - 0.3 * fly }, { t, walk: s.walk, phase: s.phase, crouch, load, release: rel, kick: k, air: ss(T3 + 0.7, T3 + 1.4, t), cut });
  const c = spline([
    [12.8, -4.6, 1.2, 6.4, -3.0, 0.9, 0], [14.3, -0.6, 1.1, 6.2, -0.1, 0.95, 0], [15.6, 0.5, 1.4, 4.4, 0.3, 0.95, 0],
    [20.6, 0.4, 1.35, 4.2, 0.3, 0.95, 0], [22.0, 0.45, 1.35, 4.5, 0.35, 0.95, 0], [23.4, 1.0, 3.0, 6.0, 1.0, 3.6, 0], [25.4, 1.4, 6.5, 6.6, 1.8, 9.5, 0],
  ])(t);
  return { set: 'g', cam: c.slice(0, 3), look: c.slice(3), fov: 30, focus: v3(s.x + 0.2, Math.min(y + 0.6, c[4] + 0.4), 0), ap: 22 * (1 - 0.8 * cut), key: v3(s.x, GROUND_Y, 0), span: 7, cut, exposure: 1 - 0.25 * cut, zoom: lerp(ZOOM, 1.5, cut) };
}

// ---- S4a (25.4–29.6): slow-motion flight, no wings ----
function shot4a(t) {
  const u = t - 25.4;
  const x = 0.9 * u, y = 14 + 0.5 * u - 0.12 * u * u;
  placeFlea({ x, y, z: 0, pitch: -0.55 - 0.22 * u, roll: 0.25 * Math.sin(u * 0.8) }, { t, air: 1 });
  const c = [x - 1.0 + 0.2 * u, y + 2.7, 2.9 - 0.1 * u];
  return { set: 'g', cam: c, look: [x + 0.1, y + 0.45, 0], fov: 30, focus: v3(x, y + 0.5, 0), ap: 20, key: v3(x, y - 1, 0), span: 6, wing: true };
}

// ---- S4b (29.6–34.1): jumping between the hairs of a cat's fur ----
const T4 = 30.7, L4 = 32.7, A4 = -4, B4 = 16;
function shot4b(t) {
  const u = clamp((t - T4) / (L4 - T4));
  const k = ss(T4, T4 + 0.25, t), land = ss(L4 - 0.05, L4 + 0.35, t);
  let x = lerp(A4, B4, u), y = 0.3 + 9 * 4 * u * (1 - u);
  if (t < T4) { x = A4; y = 0.3; }
  const pitch = t < T4 ? 0 : t < L4 ? -0.5 - 4.9 * u : -6.283 + 0.0 * land;
  placeFlea({ x, y: y + 1.0 * k * (1 - u), z: 0, pitch: t < L4 ? pitch : 0 }, { t, crouch: ss(30.0, 30.6, t) * (1 - land) + 0.3 * land, kick: k * (1 - ss(T4 + 0.4, T4 + 0.8, t)), air: ss(T4 + 0.3, T4 + 0.7, t) * (1 - land) });
  // camera follows the flea with a lag-free but softened target
  const fx = (tt) => (tt < T4 ? A4 : tt < L4 ? lerp(A4, B4, (tt - T4) / (L4 - T4)) : B4);
  const fy = (tt) => (tt < T4 || tt > L4 ? 0.3 : 0.3 + 36 * ((tt - T4) / (L4 - T4)) * (1 - (tt - T4) / (L4 - T4)));
  let lx = 0, ly = 0;
  for (let i = -6; i <= 6; i++) { lx += fx(t + i * 0.05) / 13; ly += fy(t + i * 0.05) / 13; }
  const push = ss(29.6, 34.1, t);
  return { set: 'f', cam: [lx - 4.5 + 2 * push, ly + 2.4, 13 - 2 * push], look: [lx + 0.4, ly + 1.0, 0], noZoom: true, fov: 32, focus: v3(x, y + 0.6, 0), ap: 16, key: v3(x, 0, 0), span: 14, host: true };
}

// ---- S5 (34.1–44.5): back on the ground, landing, a jump at real speed, landing again ----
const T5 = 37.0, L5 = 38.85;
function shot5(t) {
  let x = 0, y = GROUND_Y, pitch = 0, pose;
  if (t < 34.62) {
    const u = clamp((34.62 - t) / 0.5);
    y = GROUND_Y + 22 * u * u; x = -1.5 * u; pitch = -0.8 * u;
    pose = { t, air: ss(0, 0.3, u) };
  } else if (t < T5) {
    const s = W5(t);
    x = s.x;
    pose = { t, walk: s.walk, phase: s.phase, crouch: 0.35 * (1 - ss(34.62, 34.9, t)) + ss(36.62, 36.95, t) };
  } else if (t < L5) {
    // real speed: take-off velocity ~1 m/s → out of frame in a single frame
    const e = t - T5;
    x = W5(T5).x + 300 * e; y = GROUND_Y + 1000 * e;
    pose = { t, air: 1, kick: 1 };
  } else {
    const u = clamp((t - L5) / 0.09);
    x = 1.3; y = GROUND_Y + 14 * (1 - u) * (1 - u); pitch = -0.6 * (1 - u);
    pose = { t, air: 1 - ss(L5 + 0.05, L5 + 0.3, t), crouch: 0.35 * window01(t, L5 + 0.05, L5 + 0.9, 0.2) };
  }
  placeFlea({ x, y, z: 0, pitch, yaw: t > L5 ? Math.PI / 2 - 0.45 : Math.PI / 2 }, pose);
  const c = spline([[34.1, -2.5, 6.0, 7.5, -0.5, 2.5, 0], [34.8, -2.6, 1.5, 6.2, -0.2, 0.9, 0], [36.9, -1.0, 1.25, 5.6, 0.6, 0.85, 0], [38.6, -0.6, 1.3, 6.4, 1.1, 0.9, 0], [44.5, 0.6, 1.15, 4.6, 2.0, 0.85, 0]])(t);
  return { set: 'g', cam: c.slice(0, 3), look: c.slice(3), fov: 30, focus: v3(t > 38 ? 1.3 : x, GROUND_Y + 0.5, 0), ap: 24, key: v3(1, GROUND_Y, 0), span: 7 };
}
const W5 = walker([[34.62, 0, 0], [35.3, 0, 0], [36.4, 1.0, 0], [37.0, 1.05, 0]]);

// ---------------- overlay ----------------
const $ = (id) => document.getElementById(id);
const op = (el, v, tr) => { el.style.opacity = clamp(v).toFixed(3); if (tr !== undefined) el.style.transform = tr; };
const pop = (t, a) => (0.9 + 0.1 * ss(a, a + 0.25, t)).toFixed(3);
function anchor(el, p, c, a, dx = 0, dy = 0) {
  const s = p.clone().project(c);
  const hw = el.offsetWidth / 2 + 24; // keep the whole tag on screen
  el.style.left = `${clamp((s.x * 0.5 + 0.5) * W + dx, hw, W - hw).toFixed(1)}px`;
  el.style.top = `${((-s.y * 0.5 + 0.5) * H + dy).toFixed(1)}px`;
  op(el, s.z < 1 ? a : 0, 'translate(-50%, -50%)');
}
function updateOverlay(t, sh) {
  op($('hook'), window01(t, 1.55, 4.5, 0.25), `translateX(-50%) scale(${(0.8 + 0.2 * easeOut(remap(t, 1.55, 1.9))).toFixed(3)})`);
  op($('slow'), Math.max(window01(t, 1.4, 4.55, 0.2), window01(t, 22.05, 25.35, 0.2), window01(t, 25.45, 29.55, 0.2), window01(t, 30.6, 33.2, 0.2)));
  op($('real'), window01(t, 36.3, 38.6, 0.2));
  op($('size'), window01(t, 5.0, 8.25, 0.3), `translateX(-50%) scale(${pop(t, 5.0)})`);
  op($('repr'), window01(t, 9.0, 12.75, 0.3), `translateX(-50%) scale(${pop(t, 9.0)})`);
  op($('mech'), window01(t, 15.2, 20.45, 0.3), `translateX(-50%) scale(${pop(t, 15.2)})`);
  op($('rel'), window01(t, 20.6, 25.3, 0.3), `translateX(-50%) scale(${pop(t, 20.6)})`);
  op($('wingc'), window01(t, 26.0, 29.5, 0.3), `translateX(-50%) scale(${pop(t, 26.0)})`);
  op($('hostc'), window01(t, 29.9, 34.0, 0.3), `translateX(-50%) scale(${pop(t, 29.9)})`);
  op($('outro'), window01(t, 40.2, DURATION + 1, 0.5), `translateX(-50%) translateY(${((1 - ss(40.2, 40.8, t)) * 30).toFixed(1)}px)`);
  // labels anchored to 3D points
  const hide = (...ids) => ids.forEach((id) => op($(id), 0));
  if (sh.ruler) {
    anchor($('l1mm'), v3(ground.rulerMark(3.5), GROUND_Y + 0.55, -0.6), cam, window01(t, 5.3, 8.2, 0.3), 0, 40);
    anchor($('lFlea'), fleaW(0, 1.75, 0), cam, window01(t, 5.8, 8.2, 0.3), 0, -30);
  } else hide('l1mm', 'lFlea');
  if (sh.scale) {
    const d = cam.position.distanceTo(flea.root.position);
    anchor($('l3mm'), fleaW(0, 1.8, 0), cam, window01(t, 8.3, 9.4, 0.25) * (d < 30 ? 1 : 0), 0, -30);
    anchor($('l30'), v3(-30, 300, 0), cam, ss(10.6, 11.2, t), -70, 0);
    anchor($('l0'), v3(-30, 0, 0), cam, ss(10.2, 10.8, t), -60, 0);
  } else hide('l3mm', 'l30', 'l0');
  const cut = sh.cut || 0;
  if (cut > 0.05) {
    anchor($('lMus'), fleaW(0, 1.3, 0.38), cam, cut * window01(t, 15.6, 22.3, 0.3), 0, -90);
    anchor($('lRes'), fleaW(0.19, 0.98, 0.0), cam, cut * window01(t, 17.2, 22.3, 0.3), -150, -40);
    anchor($('lArc'), fleaW(0.19, 0.72, -0.2), cam, cut * window01(t, 18.2, 22.3, 0.3), -40, 110);
    anchor($('lCatch'), fleaW(0.17, 0.6, 0.12), cam, cut * window01(t, 19.2, 22.3, 0.3), 160, 40);
    anchor($('lPush'), flea.body.localToWorld((flea.world.hindF1 || v3()).clone()), cam, cut * window01(t, 22.1, 23.1, 0.2), 150, -40);
  } else hide('lMus', 'lRes', 'lArc', 'lCatch', 'lPush');
  if (sh.wing) anchor($('lWing'), fleaW(0, 1.45, 0.3), cam, window01(t, 25.9, 29.4, 0.3), 0, -70);
  else hide('lWing');
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
  let sh;
  if (t < 4.6) sh = shot1(t);
  else if (t < 8.3) sh = shot2a(t);
  else if (t < 12.8) sh = shot2b(t);
  else if (t < 25.4) sh = shot3(t);
  else if (t < 29.6) sh = shot4a(t);
  else if (t < 34.1) sh = shot4b(t);
  else sh = shot5(t);

  const set = sh.set === 'f' ? fur : ground;
  set.scene.add(flea.root);
  set.setKey(sh.key, sh.span);
  ground.ruler.visible = !!sh.ruler || (t >= 8.3 && t < 9.5);
  if (ground.ruler.visible) ground.ruler.position.set(5, GROUND_Y + 0.3, 0.2 - 4.5);
  // scale bar / trail / marker
  scaleGrp.visible = trail.visible = marker.visible = !!sh.scale;
  if (sh.scale) {
    scaleGrp.position.set(-30, GROUND_Y, 0);
    const a = ss(9.6, 10.4, t);
    scaleGrp.children[0].material.opacity = a;
    const arr = trailGeo.attributes.position.array;
    for (let i = 0; i < NT; i++) {
      const tt = lerp(T2, Math.max(T2, t), i / (NT - 1));
      const j = jump2(tt);
      arr.set([j.x, j.y + 0.5, Z2], i * 3);
    }
    trailGeo.attributes.position.needsUpdate = true;
    trail.material.opacity = ss(T2 + 0.3, T2 + 0.8, t);
    const d = cam.position.distanceTo(flea.root.position);
    marker.position.copy(flea.root.position).add(v3(0, 0.6, 0));
    marker.scale.setScalar(0.06 * d);
    marker.material.opacity = ss(14, 40, d);
  }
  updateDust(t, { 1.32: v3(-0.1, GROUND_Y, 0), 8.72: v3(X2, GROUND_Y, Z2), 22.12: v3(0.2, GROUND_Y, 0), 34.62: v3(0, GROUND_Y, 0), 37.0: v3(W5(T5).x, GROUND_Y, 0), 38.85: v3(1.3, GROUND_Y, 0) });

  const hd = v3(Math.sin(t * 0.9) * 0.02 + Math.sin(t * 2.3) * 0.008, Math.sin(t * 1.3 + 1) * 0.015, 0);
  cam.position.set(...sh.cam);
  // macro framing: the keys were laid out tight; pull every camera back along its view line
  if (!sh.scale && !sh.noZoom) {
    cam.position.sub(v3(...sh.look)).multiplyScalar(sh.zoom ?? ZOOM).add(v3(...sh.look));
    cam.position.y = Math.max(cam.position.y, GROUND_Y + 0.9); // never dip under the fabric when looking up
  }
  cam.position.add(hd);
  cam.fov = sh.fov;
  cam.near = Math.max(0.05, cam.position.length() * 0.002);
  cam.updateProjectionMatrix();
  cam.lookAt(...sh.look);
  cam.updateMatrixWorld(true);
  post.renderLayer(0, set.scene, cam, { focus: cam.position.distanceTo(sh.focus), aperture: sh.ap, maxBlur: 18 });

  let mot = 0;
  for (const c of CUTS) mot = Math.max(mot, 1 - Math.abs(t - c) / 0.1);
  const real = t >= T5 && t < T5 + 1 / FPS + 0.001 ? 1 : 0; // the real-speed take-off frame
  post.composite({
    motion: [70 * clamp(mot), 90 * real],
    flash: 0.12 * Math.exp(-Math.pow((t - T1) / 0.06, 2)) + 0.1 * Math.exp(-Math.pow((t - T3) / 0.06, 2)),
    exposure: sh.exposure ?? 1.0, bloom: 0.45, vignette: 0.6, threshold: 1.0,
    fade: (1 - ss(0, 0.3, t)) + ss(DURATION - 0.6, DURATION, t) * 0.9,
    frame: Math.round(t * FPS),
  });
  updateOverlay(t, sh);
  return { t: +t.toFixed(4), y: +flea.root.position.y.toFixed(3) };
}

export const EVENTS = [
  { t: 0, type: 'amb_ground' }, { t: 29.6, type: 'amb_fur' }, { t: 34.1, type: 'amb_ground' },
  { t: 0, type: 'steps', d: 0.95 }, { t: 4.6, type: 'steps', d: 2.4 }, { t: 12.8, type: 'steps', d: 1.6 }, { t: 35.3, type: 'steps', d: 1.1 },
  { t: 1.0, type: 'cock' }, { t: T1, type: 'jump_slow' }, { t: T2, type: 'jump_slow', g: 0.7 }, { t: 14.8, type: 'cock' },
  { t: 15.4, type: 'tension', d: 6.6 }, { t: T3, type: 'release' }, { t: T3 + 0.05, type: 'jump_slow' },
  { t: 25.4, type: 'flight', d: 4.2 }, { t: T4, type: 'jump_slow', g: 0.8 }, { t: L4, type: 'land' },
  { t: 34.62, type: 'land' }, { t: 36.62, type: 'cock' }, { t: T5, type: 'jump_real' }, { t: L5, type: 'land' },
  { t: 40.2, type: 'outro' },
  ...CUTS.map((t) => ({ t, type: 'cut' })),
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
