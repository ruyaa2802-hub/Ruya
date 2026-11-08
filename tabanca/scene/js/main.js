import * as THREE from 'three';
import { clamp, lerp, remap, ss, easeInOut, easeOut, window01, v3, rng } from './util.js';
import { createSeabed } from './seabed.js';
import { branchCoral } from './reefparts.js';
import { createShrimp } from './shrimp.js';
import { createPrey } from './prey.js';
import { createFX, bubbleRadius } from './fx.js';
import { Post } from './post.js';

// ===========================================================================
//  HAYVANİKA — Bölüm 1: "Denizin Küçük Silahı – Tabanca Karidesi"
//  Vertical 1080×1920, 33.5 s, units = cm. Every frame is a pure function of t.
//  Timeline follows the narration word timings (audio/words.json).
//   A 0–5.3    night reef, dolly through corals → the shrimp snaps (hook)
//   B 5.3–12.45 the snapping claw; prey approaches; cocking; SNAP → jet + bubble
//   C 12.45–18  macro on the cavitation bubble → collapse: flash + shock wave
//   D 18–21.2   ultra-slow replay of the last moments of the collapse (light)
//   E 21.2–33.5 the shrimp collects the stunned prey; camera cranes up and away
// ===========================================================================
const W = 1080, H = 1920;
export const FPS = 30;
export const DURATION = 33.5;
const CUTS = [5.3, 12.45, 18.0, 21.2];

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const post = new Post(renderer, W, H);
post.finalMat.uniforms.lift.value.set(0.0, 0.01, 0.025);
post.finalMat.uniforms.gain.value.set(1.0, 1.0, 1.0);
post.finalMat.uniforms.saturation.value = 1.12;
post.finalMat.uniforms.grain.value = 0.022;

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
// piecewise-linear map of film time → event clock
const pw = (keys) => (t) => {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) if (t <= keys[i + 1][0]) return lerp(keys[i][1], keys[i + 1][1], (t - keys[i][0]) / (keys[i + 1][0] - keys[i][0]));
  return keys[keys.length - 1][1];
};
const spike = (t, a, rise = 0.02, fall = 0.25) => (t < a - rise ? 0 : t < a ? (t - a + rise) / rise : Math.exp(-(t - a) / fall));
const shake = (t, a, amp, dur = 0.5) => (t < a ? 0 : amp * Math.exp(-(t - a) / (dur * 0.35))) ;
const n1 = (t, k) => Math.sin(t * 37.1 + k) * 0.6 + Math.sin(t * 61.7 + k * 2.3) * 0.4;

// ---------------- world ----------------
const sea = createSeabed();
const scene = sea.scene;
const shrimp = createShrimp({ bigSide: -1 });
scene.add(shrimp.root, shrimp.world);
const prey = createPrey();
scene.add(prey.root);
const fx = createFX(scene);
// foreground corals the opening dolly weaves through
const DOLLY = [];
{
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 });
  [[branchCoral(21, '#5a1a6a', '#ff6ad0', { depth: 4, len: 0.5 }), -4.2, 15, 9], [branchCoral(22, '#8a2a08', '#ffb347', { depth: 4, len: 0.45, spread: 0.7 }), 4.8, 21, 11],
    [branchCoral(23, '#123a8a', '#6af0ff', { depth: 5, len: 0.38, rad: 0.05 }), -2.0, 28, 12], [branchCoral(24, '#8a0a28', '#ff5b6b', { depth: 4, len: 0.42 }), 7.5, 31, 13]].forEach(([g, x, z, s], i) => {
    const m = new THREE.Mesh(g, mat);
    m.position.set(x, -0.3, z);
    m.rotation.y = i * 1.7;
    m.scale.setScalar(s);
    m.castShadow = true;
    scene.add(m);
    DOLLY.push(m);
  });
}
// diver-torch key light that travels with the camera (macro lighting), plus a warm fill
const torch = new THREE.SpotLight('#fff0dc', 70, 260, 0.6, 0.75, 2);
torch.castShadow = true;
torch.shadow.mapSize.set(1536, 1536);
torch.shadow.bias = -0.0004;
torch.shadow.normalBias = 0.01;
torch.shadow.camera.near = 0.5;
scene.add(torch, torch.target);
const fill = new THREE.PointLight('#ffb48a', 0, 30, 2);
scene.add(fill);
const cam = new THREE.PerspectiveCamera(30, W / H, 0.05, 8000);

// ---------------- the snap events ----------------
const RMAX = 0.32; // cm (≈ 4 mm bubble radius; real ones reach ~3–4 mm)
const SNAP_A = 2.95, COL_A = 4.1;
const SNAP_B = 8.45, COL_B = 15.55;
const COL_D = 19.75;
const uA = pw([[2.97, 0], [3.75, 0.48], [3.95, 0.66], [COL_A, 1]]);
const uB = pw([[8.68, 0], [12.4, 0.48], [14.6, 0.6], [15.2, 0.8], [COL_B, 1]]);
const uD = pw([[18.0, 0.8], [19.2, 0.94], [COL_D, 1]]);
// prey: where it hovers (set once the claw pose is known) and its stunned drift
const PREY = { hover: null };

// the prey's hover point is fixed once, from the claw pose used in shots B–D (pure, part-independent)
function ensureHover() {
  if (PREY.hover) return;
  shrimp.setPose({ t: SNAP_B, yaw: 0, open: 0, aim: [0.0, 0.02] });
  PREY.hover = shrimp.out.tip.clone().addScaledVector(shrimp.out.jetDir, 3.1).add(v3(0.1, 0.2, 0));
}
function snapState(t, k) {
  // k: 'A' | 'B' | 'D'
  const o = shrimp.out.tip.clone(), d = shrimp.out.jetDir.clone();
  if (k === 'A') {
    const u = uA(t);
    return { o, d, t, jet: ss(SNAP_A, 3.45, t), jetI: (t > SNAP_A ? 1 : 0) * (1 - ss(3.7, 4.3, t)), R: bubbleRadius(u, RMAX * 0.9), wrinkle: 0.12 * ss(0.85, 1, u),
      flash: spike(t, COL_A, 0.03, 0.12), flareSize: 1.4, shockR: Math.max(0, t - COL_A) * 9, shockI: t > COL_A ? Math.exp(-(t - COL_A) / 0.35) : 0,
      rebound: (t - COL_A) / 1.3, dust: (t - COL_A - 0.02) / 1.4, ground: 0, flow: (t - SNAP_A) * 0.6, glow: 0.4 * spike(t, COL_A, 0.03, 0.08) };
  }
  if (k === 'B') {
    const u = uB(t);
    return { o, d, t, jet: ss(SNAP_B, 9.8, t), jetI: (t > SNAP_B ? 1 : 0) * (1 - ss(10.6, 12.2, t)), R: bubbleRadius(u, RMAX), wrinkle: 0.14 * ss(0.8, 1, u), wob: 0.035 + 0.02 * ss(0.6, 0.9, u),
      flash: spike(t, COL_B, 0.04, 0.16), flareSize: 1.8, shockR: Math.max(0, t - COL_B) * 7, shockI: t > COL_B ? Math.exp(-(t - COL_B) / 0.45) : 0,
      rebound: (t - COL_B) / 2.2, dust: (t - COL_B - 0.05) / 1.8, ground: 0, flow: (t - SNAP_B) * 0.35, glow: 0.5 * spike(t, COL_B, 0.04, 0.1) };
  }
  const u = uD(t);
  return { o, d, t, jet: 0, jetI: 0, R: bubbleRadius(u, RMAX), wrinkle: 0.18 * ss(0.85, 1, u), wob: 0.06,
    flash: spike(t, COL_D, 0.06, 0.38), flareSize: 2.6, shockR: Math.max(0, t - COL_D) * 4, shockI: t > COL_D ? Math.exp(-(t - COL_D) / 0.6) : 0,
    rebound: (t - COL_D) / 2.0, cloud: 0.5, flow: t, glow: 1.2 * spike(t, COL_D, 0.06, 0.25) };
}

// ===========================================================================
//  SHOTS — each returns camera, look target, focus, aperture, fov, light mood
// ===========================================================================
// camera on a sphere around a target: azimuth from +z towards +x, elevation, distance
const orbit = (target, az, el, dist) => target.clone().add(v3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(dist));
const D2R = Math.PI / 180;

// ---- A (0–5.3): through the corals to the burrow; first snap ----
const SHRIMP_YAW_A = 0.3;
function shotA(t) {
  for (const m of DOLLY) m.visible = true;
  const slow = t > SNAP_A ? SNAP_A + (t - SNAP_A) * 0.05 : t; // speed ramp: the world slows after the snap
  shrimp.setPose({ t: slow, yaw: SHRIMP_YAW_A, open: ss(1.85, 2.5, t) * (t < SNAP_A ? 1 : 0) + 0.04 * Math.sin(t * 30) * window01(t, 2.5, SNAP_A, 0.05), aim: [0.08, 0.1], flick: 0.4 + 0.6 * window01(t, 1.2, 2.9, 0.3), recoil: 0.06 * spike(t, SNAP_A, 0.01, 0.15) });
  prey.root.visible = false;
  const s = snapState(t, 'A');
  s.flareSize = 0.35;
  const bc = fx.set(s);
  const o = shrimp.out;
  // dolly in from 40 cm through the coral branches; settle on a 3/4 front view of claw + head
  const k = spline([[0, 24, 14, 40], [1.4, 12, 11, 15], [2.6, -6, 9, 7.6], [SNAP_A, -9, 8, 7.0], [5.3, -16, 6, 5.6]])(t);
  const tgt0 = o.center.clone().lerp(o.palm, 0.55).add(v3(0, 0.25, 0));
  const tgt = t < SNAP_A ? tgt0 : tgt0.lerp(bc, 0.8 * ss(SNAP_A, 3.8, t));
  const sk = shake(t, SNAP_A, 0.05, 0.4) + shake(t, COL_A, 0.1, 0.6);
  const camP = orbit(tgt, k[0] * D2R, k[1] * D2R, k[2]).add(v3(n1(t, 1) * sk, n1(t, 2) * sk, 0));
  return { cam: camP, look: tgt, focus: t < 1.4 ? o.head : t < SNAP_A ? o.palm : bc, ap: lerp(4, 9, ss(0.8, 2.4, t)), fov: 32, slow, mood: 0, bc: t > SNAP_A ? bc : undefined };
}

// ---- B (5.3–12.45): claw beauty shot → over-the-shoulder; snap → jet + growing bubble ----
function shotB(t) {
  const slow = t > SNAP_B ? SNAP_B + (t - SNAP_B) * 0.04 : t;
  const open = ss(7.35, 8.25, t) * (t < SNAP_B ? 1 : 0);
  shrimp.setPose({ t: slow, yaw: 0, open: open + 0.03 * Math.sin(t * 40) * window01(t, 8.25, SNAP_B, 0.04), aim: [0.0, 0.02], flick: 0.3 + 0.9 * window01(t, 6.6, 8.4, 0.3), recoil: 0.05 * spike(t, SNAP_B, 0.01, 0.2) });
  const o = shrimp.out, tip = o.tip, d = o.jetDir;
  // the prey swims in from open water ahead of the shrimp and hovers, facing it
  const arrive = easeOut(remap(t, 5.5, 8.0));
  const from = PREY.hover.clone().add(v3(4.5, 2.0, 5));
  const pp = from.lerp(PREY.hover, arrive);
  pp.y += 0.05 * Math.sin(slow * 2.2);
  prey.root.visible = true;
  prey.setPose({ pos: pp, yaw: Math.PI - 0.6 * (1 - arrive) - 0.15, t: slow, swim: 1 });
  const s = snapState(t, 'B');
  const bc = fx.set(s);
  const side = v3(-1, 0, 0); // the claw's outer side (shrimp yaw 0, claw on −x)
  let camP, tgt, focus, ap = 9, fov = 32;
  if (t < 7.2) {
    // beauty orbit around the snapping claw
    const az = lerp(-120, -60, easeInOut(remap(t, 5.3, 7.2))) * D2R;
    tgt = o.palm.clone().lerp(o.head, 0.35).add(v3(0, 0.1, 0.1));
    camP = orbit(tgt, az, 14 * D2R, 6.8);
    focus = o.palm;
  } else {
    // over the shoulder: claw in the foreground, the prey ahead, the jet shoots into depth
    const u = easeInOut(remap(t, 7.2, 7.9));
    const push = ss(SNAP_B + 0.2, 12.45, t);
    const ots = o.palm.clone().addScaledVector(d, -2.6 + 1.5 * push).addScaledVector(side, 1.15 - 0.3 * push).add(v3(0, 1.25 - 0.2 * push, 0));
    const beauty = orbit(o.palm.clone().add(v3(0, 0.05, 0.25)), -60 * D2R, 14 * D2R, 6.8);
    camP = beauty.lerp(ots, u);
    tgt = o.palm.clone().add(v3(0, 0.05, 0.25)).lerp(PREY.hover.clone().lerp(bc, 0.45 + 0.4 * push), u);
    focus = t < SNAP_B ? o.palm.clone().lerp(PREY.hover, 0.35 * u) : bc;
    ap = 8;
  }
  const sk = shake(t, SNAP_B, 0.04, 0.4);
  camP.add(v3(n1(t, 3) * sk, n1(t, 4) * sk, 0));
  return { cam: camP, look: tgt, focus, ap, fov, slow, mood: 0, bc };
}

// ---- C (12.45–18): macro on the bubble; collapse, flash, shock, stunned prey ----
function preyStunned(t, slow) {
  // after the shock (≈ COL_B + 0.1): jerk, roll onto its side, sink to the sand
  const e = Math.max(0, t - (COL_B + 0.1));
  const jerk = Math.exp(-e / 0.35) * (e > 0 ? 1 : 0);
  const sink = easeInOut(clamp(e / 5.5));
  const p = PREY.hover.clone();
  p.x += 0.5 * (1 - Math.exp(-e * 1.4));
  p.z += 0.8 * (1 - Math.exp(-e * 1.2));
  p.y = lerp(p.y, 0.3, sink);
  prey.setPose({ pos: p, yaw: Math.PI - 0.15 + 0.5 * (1 - Math.exp(-e)), roll: lerp(0, 1.35, easeOut(clamp(e / 2.2))) + 0.15 * Math.sin(e * 9) * jerk, pitch: 0.2 * jerk, t: slow, swim: e > 0 ? 0 : 1, stun: e > 0 ? 1 : 0, jerk });
  return p;
}
function shotC(t) {
  const slow = SNAP_B + (t - SNAP_B) * 0.04;
  shrimp.setPose({ t: slow, yaw: 0, open: 0, aim: [0.0, 0.02], flick: 0.3 });
  prey.root.visible = true;
  if (t < COL_B + 0.1) prey.setPose({ pos: PREY.hover.clone().add(v3(0, 0.05 * Math.sin(slow * 2.2), 0)), yaw: Math.PI - 0.15, t: slow, swim: 1 });
  else preyStunned(t, slow);
  const s = snapState(t, 'B');
  s.flareSize = 0.42;
  const bc = fx.set(s);
  // three-quarter view from the prey's side: bubble centre, claw on the left, prey behind on the right
  const az = lerp(52, 38, easeInOut(remap(t, 12.45, 18))) * D2R;
  const dist = lerp(4.6, 3.9, ss(12.45, COL_B, t)) + 0.6 * ss(COL_B, 18, t);
  const sk = shake(t, COL_B, 0.08, 0.7);
  const tgt = bc.clone().add(v3(0.15, 0.05, 0.35));
  const camP = orbit(tgt, az, 10 * D2R, dist).add(v3(n1(t, 5) * sk, n1(t, 6) * sk, 0));
  return { cam: camP, look: tgt, focus: bc, ap: 8, fov: 32, slow, mood: 0.2, bc };
}

// ---- D (18–21.2): replay, ultra slow: the last instant of the collapse and the flash ----
function shotD(t) {
  const slow = 12.0 + (t - 18) * 0.02;
  shrimp.setPose({ t: slow, yaw: 0, open: 0, aim: [0.0, 0.02], flick: 0.2 });
  prey.root.visible = false;
  const s = snapState(t, 'D');
  s.flareSize = 0.55;
  const bc = fx.set(s);
  const az = lerp(150, 120, easeInOut(remap(t, 18, 21.2))) * D2R;
  const dist = lerp(3.0, 2.4, ss(18, COL_D, t)) + 0.5 * ss(COL_D, 21.2, t);
  const sk = shake(t, COL_D, 0.05, 0.8);
  const camP = orbit(bc, az, -8 * D2R, dist).add(v3(n1(t, 7) * sk, n1(t, 8) * sk, 0));
  return { cam: camP, look: bc.clone().add(v3(0, 0.1, 0)), focus: bc, ap: 7, fov: 32, slow, mood: 0.5, bc };
}

// ---- E (21.2–33.5): the shrimp collects its stunned prey, heads home; crane up and away ----
const HOME = v3(-1.2, 0, -2.4);
function shotE(t) {
  const slow = t;
  const preyP = preyStunned(30, t); // resting on the sand by now
  prey.root.visible = true;
  const reachP = v3(preyP.x - 0.3, 0, preyP.z - 2.7);
  let pos, yaw, walk = 0, phase = 0;
  if (t < 24.3) {
    const u = easeInOut(remap(t, 21.3, 23.7));
    pos = v3(0, 0, 0).lerp(reachP, u);
    yaw = Math.atan2(reachP.x, reachP.z) * ss(21.2, 21.8, t);
    walk = window01(t, 21.3, 23.8, 0.3);
    phase = u * 4.5;
  } else {
    const turn = easeInOut(remap(t, 24.3, 25.4));
    const u = easeInOut(remap(t, 25.0, 30.0));
    const back = Math.atan2(HOME.x - reachP.x, HOME.z - reachP.z);
    let fwd = Math.atan2(reachP.x, reachP.z);
    let b = back; while (b - fwd > Math.PI) b -= 2 * Math.PI; while (b - fwd < -Math.PI) b += 2 * Math.PI;
    yaw = lerp(fwd, b, turn);
    pos = reachP.clone().lerp(HOME, u);
    walk = Math.max(0.6 * window01(t, 24.3, 25.4, 0.3), window01(t, 25.0, 30.2, 0.4));
    phase = 4.5 + turn * 1.2 + u * 5.5;
  }
  const o = shrimp.setPose({ t: slow, x: pos.x, z: pos.z, yaw, open: 0, aim: [0.05, 0.0], walk, phase, flick: 0.4, pitch: 0.02 });
  if (t >= 24.0) {
    const held = shrimp.out.minorTip.clone().add(v3(0, -0.12, 0));
    const p = preyP.clone().lerp(held, ss(24.0, 24.4, t));
    prey.setPose({ pos: p, yaw: yaw + Math.PI / 2, roll: 1.35, t, swim: 0, stun: 1 });
  }
  fx.set({ o: o.tip, d: o.jetDir, t, jet: 0, jetI: 0, R: 0, flash: 0, shockI: 0, rebound: 0, dust: 0 });
  // in front of the shrimp, beyond the prey; then crane up behind it and pull far back over the reef
  const far = ss(25.8, 31.5, t);
  const c = spline([[21.2, 4.0, 3.2, 15.5], [24.3, 3.6, 3.4, 13.5], [25.8, 2.0, 6.5, 14.5], [28.5, -1.5, 18, 22], [31.5, -5, 40, 48], [33.5, -6, 50, 60]])(t);
  const look = o.center.clone().add(v3(0, 0.3, 0)).lerp(v3(-5, 0, -26), ss(27, 33.5, t) * 0.8);
  for (const m of DOLLY) m.visible = t < 26.5;
  return { cam: v3(c[0], c[1], c[2]), look, focus: o.center, ap: lerp(7, 0.5, far), fov: lerp(36, 40, far), slow, mood: 0, far };
}

// ===========================================================================
//  OVERLAY
// ===========================================================================
const SUBS = [
  [0.35, 2.75, 'Denizin dibinde, <b>küçücük</b> bir canlı var…'],
  [3.25, 5.2, 'Ve bu canlının silahı <b>mermi değil!</b>'],
  [5.55, 8.3, '<b>Tabanca karidesi</b>, özel kıskacını kapattığında'],
  [8.4, 10.45, '<b>inanılmaz hızlı</b> bir su jeti oluşturuyor.'],
  [10.95, 12.72, 'Bu hareket, <b>kavitasyon</b>'],
  [12.78, 14.2, 'adı verilen bir olaya yol açıyor.'],
  [14.85, 17.55, '<b>Kabarcık çökerken</b> ses ve ısı ortaya çıkıyor.'],
  [18.35, 19.72, 'Hatta çok kısa süreli'],
  [19.74, 21.55, '<b>ışık parlamaları</b> bile oluşabiliyor!'],
  [22.7, 24.5, 'Üstelik bütün bunları yalnızca'],
  [24.53, 26.65, '<b>birkaç santimetrelik</b> bir vücutla yapıyor.'],
  [27.55, 29.56, 'Doğa bazen en <b>büyük sürprizleri</b>'],
  [29.58, 31.15, 'en <b>küçük canlılara</b> saklıyor.'],
];
const $ = (id) => document.getElementById(id);
const op = (el, v, tr) => { el.style.opacity = clamp(v).toFixed(3); if (tr !== undefined) el.style.transform = tr; };
const pop = (t, a) => { const u = clamp((t - a) / 0.35); return u >= 1 ? 1 : 1 + Math.sin(u * Math.PI * 2) * Math.exp(-u * 5) * 0.12 - (1 - u) ** 3 * 0.25; };
function anchor(el, p, a, dx = 0, dy = 0) {
  const s = p.clone().project(cam);
  const hw = el.offsetWidth / 2 + 30;
  el.style.left = `${clamp((s.x * 0.5 + 0.5) * W + dx, hw, W - hw).toFixed(1)}px`;
  el.style.top = `${clamp((-s.y * 0.5 + 0.5) * H + dy, 200, H - 520).toFixed(1)}px`;
  op(el, s.z < 1 ? a : 0, 'translate(-50%, -50%)');
}
function title(el, t, a, b) {
  const v = window01(t, a, b, 0.22);
  const sc = pop(t, a) * (1 + 0.012 * (t - a));
  op(el, v, `translateX(-50%) scale(${sc.toFixed(3)})`);
  el.style.letterSpacing = `${(0.02 + 0.06 * (1 - ss(a, a + 0.6, t))).toFixed(3)}em`;
}
function updateOverlay(t, sh) {
  title($('tName'), t, 5.6, 7.9);
  title($('tCav'), t, 11.95, 14.4);
  title($('tEnd'), t, 31.0, DURATION + 1);
  op($('series'), ss(31.6, 32.2, t), 'translateX(-50%)');
  op($('slow'), window01(t, 3.0, 5.25, 0.15) + window01(t, 8.5, 17.95, 0.15), 'none');
  op($('replay'), window01(t, 18.05, 21.15, 0.15), 'none');
  // fact chips (stacked under the safe top area)
  op($('cJet'), window01(t, 9.35, 11.5, 0.2), `translateX(-50%) scale(${pop(t, 9.35).toFixed(3)})`);
  op($('cSes'), window01(t, 16.05, 17.95, 0.15), `translateX(-50%) scale(${pop(t, 16.05).toFixed(3)})`);
  op($('cIsi'), window01(t, 16.45, 17.95, 0.15), `translateX(-50%) scale(${pop(t, 16.45).toFixed(3)})`);
  op($('cIsik'), window01(t, 19.8, 21.15, 0.15), `translateX(-50%) scale(${pop(t, 19.8).toFixed(3)})`);
  op($('cSize'), window01(t, 24.5, 26.9, 0.2), `translateX(-50%) scale(${pop(t, 24.5).toFixed(3)})`);
  if (t > 6.4 && t < 7.5) anchor($('lClaw'), shrimp.out.palm, window01(t, 6.5, 7.4, 0.15), 0, -170); else op($('lClaw'), 0);
  if (sh.bc && t > 11.9 && t < 14.5) anchor($('lBub'), sh.bc, window01(t, 12.0, 14.4, 0.2), 0, -260); else op($('lBub'), 0);
  let on = 0;
  for (const [a, b, html] of SUBS) {
    if (t >= a - 0.06 && t < b + 0.08) {
      if ($('sub').dataset.k !== html) { $('sub').innerHTML = html; $('sub').dataset.k = html; }
      on = window01(t, a - 0.06, b + 0.08, 0.06);
      break;
    }
  }
  op($('sub'), on, `translateX(-50%) scale(${(0.96 + 0.04 * ss(0, 1, on)).toFixed(3)})`);
}

// ===========================================================================
function frame(t) {
  ensureHover();
  let sh;
  if (t < CUTS[0]) sh = shotA(t);
  else if (t < CUTS[1]) sh = shotB(t);
  else if (t < CUTS[2]) sh = shotC(t);
  else if (t < CUTS[3]) sh = shotD(t);
  else sh = shotE(t);

  const look = sh.look;
  const camDist = sh.cam.distanceTo(look);
  sea.update(sh.slow, look, clamp(camDist * 2.2, 8, 160));
  sea.setFocus(sh.far > 0.3 ? v3(0, 0, -20) : look.clone(), sh.far > 0.3 ? 140 : 14);
  scene.fog.density = lerp(0.016, 0.0075, sh.far || 0);
  sea.hemi.intensity = lerp(0.22, 0.5, sh.far || 0);
  sea.moon.intensity = lerp(0.55, 0.9, sh.far || 0);
  cam.position.copy(sh.cam);
  cam.fov = sh.fov;
  cam.near = camDist > 40 ? 0.5 : 0.05;
  cam.updateProjectionMatrix();
  cam.lookAt(look);
  cam.updateMatrixWorld(true);
  // torch: above-left of the lens, aimed at the subject
  const right = v3(1, 0, 0).applyQuaternion(cam.quaternion), up = v3(0, 1, 0).applyQuaternion(cam.quaternion);
  torch.position.copy(cam.position).addScaledVector(right, -0.25 * camDist).addScaledVector(up, 0.45 * camDist);
  torch.target.position.copy(sh.focus);
  torch.intensity = 60 * Math.max(1, (camDist / 9) ** 2) * (1 - 0.7 * (sh.far || 0));
  torch.angle = lerp(0.5, 0.75, sh.far || 0);
  fill.position.copy(cam.position).addScaledVector(right, 0.4 * camDist);
  fill.intensity = 3 * (camDist / 6) ** 2 * (1 - (sh.far || 0));

  post.renderLayer(0, scene, cam, { focus: cam.position.distanceTo(sh.focus), aperture: sh.ap, maxBlur: 16 });
  // shock-wave refraction ring + chromatic punch at the collapses
  let shock = [0, 0, 0, 0], chroma = 0, flash = 0;
  const col = t < CUTS[0] ? COL_A : t < CUTS[2] ? COL_B : t < CUTS[3] ? COL_D : -1;
  if (col > 0 && t > col && sh.bc) {
    const bc = sh.bc.clone();
    const e = t - col;
    const s = bc.clone().project(cam);
    shock = [s.x * 0.5 + 0.5, s.y * 0.5 + 0.5, e * (col === COL_D ? 0.35 : 0.6), 1.6 * Math.exp(-e / 0.5)];
  }
  for (const [a, k] of [[COL_A, 0.6], [COL_B, 0.8], [COL_D, 1.0]]) { chroma = Math.max(chroma, 2.4 * k * spike(t, a, 0.03, 0.3)); flash = Math.max(flash, 0.1 * k * spike(t, a, 0.02, 0.06)); }
  chroma = Math.max(chroma, 1.2 * spike(t, SNAP_A, 0.01, 0.1), 1.0 * spike(t, SNAP_B, 0.01, 0.1));
  let mot = 0;
  for (const c of CUTS) mot = Math.max(mot, 1 - Math.abs(t - c) / 0.1);
  post.composite({
    motion: [60 * clamp(mot), 0], shock, chroma, flash,
    exposure: 1.18 + 0.15 * (sh.mood || 0), bloom: 0.75, vignette: 0.58, threshold: 0.9,
    fade: (1 - ss(0, 0.35, t)) + ss(DURATION - 0.6, DURATION, t),
    frame: Math.round(t * FPS),
  });
  updateOverlay(t, sh);
  return { t: +t.toFixed(4) };
}

export const EVENTS = [
  { t: 0, type: 'open' }, { t: 1.9, type: 'cock', d: 0.65 }, { t: SNAP_A, type: 'snap' }, { t: COL_A, type: 'collapse', k: 0.8 },
  ...CUTS.map((t) => ({ t, type: 'whoosh' })), { t: 5.6, type: 'title' }, { t: 7.0, type: 'ping' },
  { t: 7.35, type: 'cock', d: 0.9 }, { t: SNAP_B, type: 'snap' }, { t: 8.6, type: 'jet', d: 2.6 }, { t: 9.35, type: 'ping' },
  { t: 8.7, type: 'grow', d: 3.8 }, { t: 11.95, type: 'title' }, { t: 14.7, type: 'pre', d: COL_B - 14.7 }, { t: COL_B, type: 'collapse', k: 1 },
  { t: 16.05, type: 'ping' }, { t: 16.45, type: 'ping' }, { t: 18.0, type: 'pre', d: COL_D - 18.0 }, { t: COL_D, type: 'collapse', k: 1.1, light: 1 }, { t: 19.8, type: 'ping' },
  { t: 21.3, type: 'walk', d: 2.5 }, { t: 24.05, type: 'grab' }, { t: 24.5, type: 'ping' }, { t: 25.0, type: 'walk', d: 5.0 }, { t: 25.6, type: 'swell' }, { t: 31.0, type: 'title' },
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
