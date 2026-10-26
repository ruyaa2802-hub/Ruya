import * as THREE from 'three';
import { clamp, lerp, remap, smooth, ss, easeInOut, easeOut, window01, v3, quatFromForwardUp } from './util.js';
import { createOctopus } from './octopus.js';
import { createOcean, floorY } from './ocean.js';
import { Post } from './post.js';
import { CAM_CLEAR } from './cam_clear.js';

// ===========================================================================
//  "Ahtapotların 3 Kalbi Var, Peki Neden?" — vertical 1080×1920, 42.5 s.
//  Every frame is a pure function of t.
// ===========================================================================
const W = 1080, H = 1920;
export const FPS = 30;
export const DURATION = 42.5;
const FOVV = 60; // vertical field of view for the portrait frame

const canvas = document.getElementById('c');
canvas.width = W;
canvas.height = H;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const post = new Post(renderer, W, H);
post.finalMat.uniforms.lift.value.set(0.0, 0.012, 0.02);
post.finalMat.uniforms.gain.value.set(0.96, 1.0, 1.02);

const CLEAR = [];
for (const [x, z] of [[0, -0.6], [0.8, -1.8], [2.0, -3.2], [3.1, -4.6], [3.6, -5.4], [4.6, -7.2], [5.6, -9.3], [5.0, -11.4], [3.6, -13.0], [3.0, -14.0]]) CLEAR.push([x, z, 2.0]);
for (const [x, z] of [[1.5, -2.5], [2.2, -5.0], [2.6, -7.6], [3.0, -9.5], [2.0, -10.0], [0.8, -8.0], [-0.4, -5.6]]) CLEAR.push([x, z, 1.7]);
for (const [x, z] of [[-4, -0.2], [-3, -1.8], [-1.8, -3.2], [-0.8, -4.6], [-0.4, -5.4], [0.6, -2.2], [1.6, -4.0], [5.4, -3.6], [6.2, -5.4]]) CLEAR.push([x, z, 1.6]); // scene-3 camera orbit
CLEAR.push(...CAM_CLEAR);
const ocean = createOcean({ clear: CLEAR });
const octo = createOctopus();
ocean.scene.add(octo.root);
const cam = new THREE.PerspectiveCamera(FOVV, W / H, 0.05, 400);

// ---------------- timeline ----------------
const T = {
  rise: 0.9, approach: 2.5, surprise: 4.15, s2: 7.0, xrayIn: 7.7, bFocus: 8.4, sFocus: 11.4, loop: 14.6,
  s3: 17.0, o2: 18.2, flowSeq: 22.0, hemo: 25.8, xrayOut: 27.2, s4: 30.0, jet0: 30.6, jet1: 35.2, wave: 38.4, end: DURATION,
};
const SUBS = await fetch('./subtitles.json').then((r) => r.json());

// heart beats: steady, then the systemic heart slows down while jet-swimming
const SYS_BEATS = [];
{
  let tb = 7.6;
  while (tb < 30.9) { SYS_BEATS.push(tb); tb += 1.0; }
  for (const d of [1.25, 1.6, 2.05, 2.6]) { SYS_BEATS.push(tb); tb += d; }
  while (tb < DURATION) { SYS_BEATS.push(tb); tb += 1.4; }
}
const BR_BEATS = SYS_BEATS.map((b) => b - 0.22).concat([31.75, 33.6, 35.7]).sort((a, b) => a - b); // branchial hearts keep pumping
const pulse = (t, list) => {
  let v = 0;
  for (const b of list) {
    const d = t - b;
    if (d > -0.1 && d < 0.5) v = Math.max(v, Math.exp(-((d / 0.07) ** 2)) + 0.45 * Math.exp(-(((d - 0.2) / 0.06) ** 2)));
  }
  return v;
};

// ---------------- octopus path ----------------
const curve = (pts) => new THREE.CatmullRomCurve3(pts.map((p) => v3(...p)), false, 'catmullrom', 0.5);
const HOME = v3(0, 2.35, -0.6);
const pathRise = curve([[-2.8, 0.2, -8.0], [-2.8, 1.6, -7.9], [-2.6, 3.0, -7.4], [-1.6, 2.9, -4.8], [-0.5, 2.5, -2.4], [0, 2.35, -0.6]]);
const pathSwim = curve([[0, 2.35, -0.6], [0.8, 2.5, -1.8], [2.0, 2.45, -3.2], [3.1, 2.55, -4.6], [3.6, 2.5, -5.4]]);
const pathJet = curve([[3.6, 2.5, -5.4], [4.6, 2.3, -7.2], [5.6, 2.1, -9.3], [5.0, 2.4, -11.4], [3.6, 2.6, -13.0]]);
const pathEnd = curve([[3.6, 2.6, -13.0], [3.2, 2.8, -13.6], [3.0, 2.9, -14.0]]);

function octoState(t) {
  // returns { pos, quat, pose }
  const pose = { t, spread: 0.5, wave: 0.6, sway: 0.35, curl: 0.3, omega: 3.0, armLift: 0, surprise: 0, look: [0, 0], blink: 0, bob: 0, pitch: 0 };
  let pos, fwd = v3(0, 0, 1), jet = 0;
  const strokeSwim = (amp) => {
    const s = Math.sin(t * Math.PI * 2 / 1.35);
    pose.spread = 0.5 + amp * 0.28 * s;
    pose.bob = amp * 0.06 * Math.cos(t * Math.PI * 2 / 1.35);
    pose.wave = 0.6 + amp * 0.25;
  };
  if (t < T.surprise + 0.1) {
    const u = easeInOut(remap(t, T.rise, T.surprise));
    pos = pathRise.getPointAt(u);
    strokeSwim(1 - ss(T.surprise - 0.5, T.surprise, t));
    pose.look = [0, 0.4 * (1 - u)];
  } else if (t < T.s3) {
    pos = HOME.clone().add(v3(0, 0.06 * Math.sin(t * 1.7), 0));
    const sp = window01(t, T.surprise - 0.05, 7.6, 0.35);
    pose.surprise = sp;
    pose.spread = lerp(0.48 + 0.05 * Math.sin(t * 2), 1.0, sp);
    pose.armLift = 0.55 * sp;
    pose.curl = 0.3 + 0.35 * sp;
    pose.wave = lerp(0.55, 0.35, sp);
    pose.blink = Math.exp(-(((t - 6.4) / 0.05) ** 2)) + Math.exp(-(((t - 13.2) / 0.05) ** 2));
    pose.look = [0.5 * Math.sin(t * 0.4), 0.1];
    pose.browTilt = 0.1 * window01(t, 8.4, 16, 0.5);
  } else if (t < T.s4 + 0.6) {
    const u = smooth(remap(t, T.s3, T.s4 + 0.6));
    pos = pathSwim.getPointAt(u);
    fwd = pathSwim.getTangentAt(u);
    strokeSwim(1);
    pose.look = [0, 0];
    pose.blink = Math.exp(-(((t - 24.4) / 0.05) ** 2));
  } else if (t < T.jet1 + 0.6) {
    const u = easeInOut(remap(t, T.jet0, T.jet1));
    pos = pathJet.getPointAt(u);
    fwd = pathJet.getTangentAt(u);
    jet = ss(T.jet0 - 0.2, T.jet0 + 0.4, t) * (1 - ss(T.jet1 - 0.4, T.jet1 + 0.5, t));
    pose.spread = lerp(0.5, 0.0, jet);
    pose.wave = lerp(0.6, 0.22, jet);
    pose.sway = lerp(0.35, 0.12, jet);
    pose.curl = lerp(0.3, 0.06, jet);
    pose.omega = lerp(3, 7, jet);
    pose.len = lerp(2.0, 2.15, jet);
  } else {
    const u = easeOut(remap(t, T.jet1 + 0.6, T.end));
    pos = pathEnd.getPointAt(u);
    fwd = v3(0, 0, 1);
    strokeSwim(0.6);
    const wv = window01(t, T.wave, T.end + 1, 0.5);
    pose.armLift = 0.45 * wv;
    pose.spread = lerp(pose.spread, 0.85, wv);
    pose.curl = 0.3 + 0.3 * wv;
    pose.wave = 0.6 + 0.3 * wv;
    pose.blink = Math.exp(-(((t - 40.6) / 0.05) ** 2));
  }
  // orientation: upright, facing where it swims (or the camera); jet = mantle-first
  const flat = v3(fwd.x, 0, fwd.z);
  if (flat.lengthSq() < 1e-4) flat.set(0, 0, 1);
  flat.normalize();
  let yawDir = flat;
  if (t < T.s3) {
    yawDir = v3(0, 0, 1); // scene 1 faces the camera; scene 2 keeps that heading while the camera circles
  } else if (t > T.jet1 + 0.3) {
    const c = camState(t).pos;
    const toCam = v3(c.x - pos.x, 0, c.z - pos.z).normalize();
    const w = ss(T.jet1 + 0.3, T.jet1 + 1.6, t);
    yawDir = flat.clone().lerp(toCam, w).normalize();
  }
  const qUp = quatFromForwardUp(yawDir, v3(0, 1, 0));
  // jet: local +Y (mantle) points along travel; face looks up-ish
  const travel = fwd.clone().normalize();
  const side = v3().crossVectors(travel, v3(0, 1, 0)).normalize();
  const faceUp = v3().crossVectors(side, travel).normalize();
  const qJet = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(side.clone().negate(), travel, faceUp));
  const quat = qUp.clone().slerp(qJet, jet * 0.92);
  return { pos, quat, pose, jet };
}

// ---------------- camera ----------------
const mantleCenter = (pos) => pos.clone().add(v3(0, 0.6, -0.25));
function orbit(center, angle, radius, height) {
  return center.clone().add(v3(Math.sin(angle) * radius, height, Math.cos(angle) * radius));
}
function camState(t) {
  let pos, look, focusTarget;
  if (t < T.s2) {
    // wide on the coral wall → dolly in to the surprised face
    const u = easeInOut(remap(t, 0, T.surprise + 0.4));
    const p0 = v3(-1.2, 1.8, 5.8), l0 = v3(-2.4, 2.0, -7.0);
    const p1 = v3(0, 2.55, 4.0), l1 = v3(0, 2.3, -0.6);
    pos = p0.lerp(p1, u).add(v3(0, 0, -0.5 * ss(T.surprise, T.s2, t)));
    look = l0.lerp(l1, u);
    focusTarget = look;
  } else if (t < T.s3) {
    return camS2(t);
  } else if (t < T.s4) {
    // scene 3 camera, joined smoothly from where scene 2 ended
    const c3 = camS3(t);
    const j = easeInOut(remap(t, T.s3, T.s3 + 3.6));
    if (j < 1) {
      const c2 = camS2(T.s3);
      c3.pos = c2.pos.lerp(c3.pos, j);
      const away = c3.pos.clone().sub(mantleCenter(octoBase(t).pos)).setY(0).normalize();
      c3.pos.addScaledVector(away, 0.9 * Math.sin(Math.PI * j)).add(v3(0, 0.4 * Math.sin(Math.PI * j), 0));
      c3.look = c2.look.lerp(c3.look, j);
    }
    return c3;
  } else if (false) {
    // (unused)
    const c = mantleCenter(HOME);
    const a = THREE.MathUtils.degToRad(lerp(0, 132, easeInOut(remap(t, T.s2, 9.4))) + 4 * Math.sin((t - 9.4) * 0.35) * ss(9.4, 10.5, t));
    const r = lerp(4.0, 3.15, easeInOut(remap(t, T.s2, 9.4)));
    pos = orbit(c, a, r, lerp(0.15, 0.55, easeInOut(remap(t, T.s2, 9.4))));
    look = c.clone().add(v3(0, -0.15, 0));
    focusTarget = c;
  } else {
    // chase the jet, then pull back to the wide reef — joined smoothly from the scene-3 camera
    const st = octoBase(t);
    const c = st.pos.clone().add(v3(0, 0.3, 0));
    // lead shot: the camera stays ahead of the octopus as it jets toward (and past) us
    const chase = c.clone().add(v3(-1.9, 1.5, -4.4));
    const wide = v3(0.4, 6.6, -23.5);
    const w = easeInOut(remap(t, 35.0, 41.5));
    pos = chase.lerp(wide, w);
    look = c.clone().lerp(v3(3.2, 2.2, -14.5), w * 0.5);
    focusTarget = st.pos;
    const j = easeInOut(remap(t, T.s4, T.s4 + 1.8));
    if (j < 1) {
      const a3 = camS3(T.s4);
      pos = a3.pos.lerp(pos, j);
      look = a3.look.lerp(look, j);
    }
  }
  return { pos, look, focusTarget };
}
function camS2(t) {
  // arc around to the back-right so the mantle (and what is inside) is clear
  const c = mantleCenter(HOME);
  const k = easeInOut(remap(t, T.s2, 11.0));
  const a = THREE.MathUtils.degToRad(lerp(0, 128, k) + 4 * Math.sin((t - 10.2) * 0.35) * ss(10.2, 11.3, t));
  const r = lerp(4.0, 3.15, k);
  const pos = orbit(c, a, r, lerp(0.15, 0.55, k));
  return { pos, look: c.clone().add(v3(0, -0.15, 0)), focusTarget: c };
}
function camS3(t) {
  let pos, look, focusTarget;
  {
    // follow the swimming octopus from the side-back, push in for the flow, pull back after
    const st = octoBase(t);
    const c = mantleCenter(st.pos);
    const heading = Math.atan2(st.fwd.x, st.fwd.z);
    const push = window01(t, 20.8, 27.4, 1.6);
    const a = heading + THREE.MathUtils.degToRad(lerp(132, 105, ss(T.s3, 20, t)) - 55 * ss(26.5, 29.8, t));
    const r = lerp(4.3, 3.5, push) + 0.9 * ss(26.8, 29.8, t);
    pos = orbit(c, a, r, 1.1 - 0.4 * ss(26.5, 29.8, t));
    look = c.clone().add(v3(0, -0.2 - 0.25 * ss(26.5, 29.8, t), 0));
    focusTarget = c;
  }
  return { pos, look, focusTarget };
}
// position/forward of the octopus without the orientation logic (avoids recursion)
function octoBase(t) {
  if (t < T.s4 + 0.6) {
    const u = smooth(remap(t, T.s3, T.s4 + 0.6));
    return { pos: pathSwim.getPointAt(u), fwd: pathSwim.getTangentAt(u) };
  }
  if (t < T.jet1 + 0.6) {
    const u = easeInOut(remap(t, T.jet0, T.jet1));
    return { pos: pathJet.getPointAt(u), fwd: pathJet.getTangentAt(u) };
  }
  const u = easeOut(remap(t, T.jet1 + 0.6, T.end));
  return { pos: pathEnd.getPointAt(u), fwd: v3(0, 0, 1) };
}

// ---------------- anatomy choreography ----------------
function anatomyState(t) {
  const xray = ss(T.xrayIn, T.xrayIn + 1.0, t) * (1 - ss(T.xrayOut, T.xrayOut + 1.8, t)) * (t < T.s3 ? 1 : lerp(1, 0.85, ss(T.s3, T.s3 + 1, t)));
  const hlB = window01(t, T.bFocus, T.sFocus + 0.2, 0.3) + 0.6 * window01(t, T.flowSeq, T.flowSeq + 1.2, 0.2);
  const hlS = window01(t, T.sFocus, T.loop + 0.3, 0.3) + 0.6 * window01(t, T.flowSeq + 2.0, T.flowSeq + 3.2, 0.2);
  const flow = {
    deox: ss(T.bFocus, T.bFocus + 0.6, t),
    gill: ss(T.bFocus + 0.5, T.bFocus + 1.1, t),
    ox: ss(T.sFocus - 0.4, T.sFocus + 0.2, t),
    aorta: ss(T.sFocus, T.sFocus + 0.6, t),
  };
  // sequential emphasis during the "teamwork" sentence
  const seq = (a) => 1 + 0.9 * window01(t, a, a + 1.4, 0.3);
  flow.deox *= seq(T.flowSeq);
  flow.gill *= seq(T.flowSeq + 0.9);
  flow.ox *= seq(T.flowSeq + 1.8);
  flow.aorta *= seq(T.flowSeq + 2.7);
  const oxygen = ss(T.o2 + 0.6, T.o2 + 2.6, t) * (1 - ss(T.xrayOut, T.xrayOut + 1.5, t)) + 0.35 * flow.gill * (t < T.s3 ? 1 : 0);
  return {
    xray,
    oxygen: clamp(oxygen),
    highlight: { b: clamp(hlB), s: clamp(hlS) },
    beat: { b: pulse(t, BR_BEATS), s: pulse(t, SYS_BEATS) },
    flow,
  };
}

// oxygen particles flowing from the water into the gills (scene 3)
const O2N = 70;
const o2Geo = new THREE.BufferGeometry();
o2Geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(O2N * 3), 3));
const o2Tex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.4, 'rgba(160,240,255,0.8)');
  gr.addColorStop(1, 'rgba(160,240,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  const tx = new THREE.CanvasTexture(c);
  tx.colorSpace = THREE.SRGBColorSpace;
  return tx;
})();
const o2Mat = new THREE.PointsMaterial({ size: 0.075, map: o2Tex, color: new THREE.Color(1.2, 2.2, 2.4), transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending });
const o2 = new THREE.Points(o2Geo, o2Mat);
o2.frustumCulled = false;
o2.renderOrder = 12;
octo.body.add(o2);
function updateO2(t) {
  const on = window01(t, T.o2, T.flowSeq + 1.0, 0.6);
  o2Mat.opacity = on;
  const a = o2Geo.attributes.position.array;
  for (let i = 0; i < O2N; i++) {
    const sx = i % 2 ? 1 : -1;
    const k = ((t * 0.55 + i * 0.137) % 1);
    const start = v3(1.25 * sx, 0.5 + ((i * 0.37) % 1) * 0.7, 0.55);
    const end = v3(0.43 * sx, 0.45 + ((i * 0.61) % 1) * 0.65, -0.14);
    const p = start.lerp(end, smooth(k));
    p.x += Math.sin(t * 3 + i) * 0.03;
    a[i * 3] = p.x;
    a[i * 3 + 1] = p.y;
    a[i * 3 + 2] = p.z;
  }
  o2Geo.attributes.position.needsUpdate = true;
}

// ===========================================================================
//  Overlay
// ===========================================================================
const $ = (id) => document.getElementById(id);
const ov = {
  big: $('big'), labs: { bL: $('labBL'), bR: $('labBR'), s: $('labS'), g: $('labG'), o2: $('labO2') }, lines: $('lines'),
  legend: $('legend'), hemo: $('hemo'), hud: $('hud'), hudHeart: $('hudHeart'), ecg: $('ecg'), outro: $('outro'), sub: $('sub'),
};
const op = (el, v, tr) => { el.style.opacity = v.toFixed(3); if (tr !== undefined) el.style.transform = tr; };
const proj = (p) => { const s = p.clone().project(cam); return { x: (s.x * 0.5 + 0.5) * W, y: (-s.y * 0.5 + 0.5) * H, z: s.z }; };
function label(el, anchor, dx, dy, alpha, lineId) {
  const a = proj(anchor);
  const wEl = el.offsetWidth || 260;
  let x = a.x + dx, y = a.y + dy;
  if (dx < 0) x = Math.max(x, wEl + 24); else x = Math.min(x, W - wEl - 24);
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  op(el, alpha, `translate(${dx < 0 ? '-100%' : '0'}, -50%)`);
  const ln = document.getElementById(lineId);
  ln.setAttribute('x1', a.x.toFixed(1));
  ln.setAttribute('y1', a.y.toFixed(1));
  ln.setAttribute('x2', (x + (dx < 0 ? 6 : -6)).toFixed(1));
  ln.setAttribute('y2', y.toFixed(1));
  ln.style.opacity = alpha;
}
function ecgPath(t) {
  // scrolling ECG trace of the systemic heart (last 3 seconds)
  let d = '';
  for (let i = 0; i <= 120; i++) {
    const tt = t - 3 + (i / 120) * 3;
    let y = 0;
    for (const b of SYS_BEATS) {
      const dd = tt - b;
      if (dd > -0.12 && dd < 0.25) y += -38 * Math.exp(-((dd / 0.025) ** 2)) + 14 * Math.exp(-(((dd - 0.06) / 0.03) ** 2)) - 8 * Math.exp(-(((dd - 0.2) / 0.05) ** 2));
    }
    d += `${i ? 'L' : 'M'}${(i * 3.2).toFixed(1)},${(45 + y).toFixed(1)}`;
  }
  return d;
}
function updateOverlay(t, an) {
  // scene 1 headline pop
  const bigOn = window01(t, T.surprise + 0.05, T.s2 + 0.2, 0.25);
  const pop = 1 + 0.25 * Math.exp(-(((t - T.surprise - 0.2) / 0.12) ** 2)) * (t > T.surprise ? 1 : 0);
  op(ov.big, bigOn, `translateX(-50%) scale(${(0.6 + 0.4 * ss(T.surprise, T.surprise + 0.25, t)) * pop}) rotate(-4deg)`);

  // anatomy labels (scenes 2 & 3)
  const lx = an.xray;
  const bOn = lx * window01(t, T.bFocus + 0.1, T.s3 + 0.2, 0.35) + lx * window01(t, T.flowSeq - 0.2, T.flowSeq + 1.6, 0.3);
  const sOn = lx * window01(t, T.sFocus + 0.1, T.s3 + 0.2, 0.35) + lx * window01(t, T.flowSeq + 1.6, T.flowSeq + 3.4, 0.3);
  const gOn = lx * window01(t, T.o2 + 0.4, T.flowSeq + 2.2, 0.35);
  const L = octo.anchor('bL'), R = octo.anchor('bR'), S = octo.anchor('s'), G = octo.anchor('gR'), GL = octo.anchor('gL');
  const left = proj(L).x < proj(R).x ? [L, R] : [R, L];
  label(ov.labs.bL, left[0], -150, 110, clamp(bOn), 'lnBL');
  label(ov.labs.bR, left[1], 150, 110, clamp(bOn), 'lnBR');
  label(ov.labs.s, S, 170, -160, clamp(sOn), 'lnS');
  const gl = proj(G).x > proj(GL).x ? G : GL;
  label(ov.labs.g, gl, -170, -130, clamp(gOn), 'lnG');
  const o2On = window01(t, T.o2 + 0.2, T.flowSeq + 0.6, 0.35) * lx;
  label(ov.labs.o2, gl.clone().add(v3(0, 0, 0)), 150, 90, clamp(o2On), 'lnO2');
  op(ov.legend, window01(t, T.bFocus + 0.2, T.xrayOut + 1.2, 0.4));
  op(ov.hemo, window01(t, T.hemo, T.s4 - 0.2, 0.35), `translateX(-50%) scale(${(0.92 + 0.08 * ss(T.hemo, T.hemo + 0.3, t)).toFixed(3)})`);

  // heart-rate HUD (scene 4)
  op(ov.hud, window01(t, T.jet0 + 0.2, 36.4, 0.4));
  ov.hudHeart.style.transform = `scale(${(1 + 0.28 * pulse(t, SYS_BEATS)).toFixed(3)})`;
  ov.ecg.setAttribute('d', ecgPath(t));

  op(ov.outro, window01(t, T.wave + 0.2, T.end + 1, 0.5), `translateX(-50%) translateY(${((1 - ss(T.wave + 0.2, T.wave + 0.8, t)) * 30).toFixed(1)}px)`);

  // subtitles
  let on = 0;
  for (const c of SUBS) {
    if (t >= c.start - 0.08 && t < c.end + 0.12) {
      if (ov.sub.textContent !== c.text) ov.sub.textContent = c.text;
      on = window01(t, c.start - 0.08, c.end + 0.12, 0.08);
      break;
    }
  }
  op(ov.sub, on, 'translateX(-50%)');
}

// ===========================================================================
//  Frame
// ===========================================================================
function frame(t) {
  const cs = camState(t);
  cam.position.copy(cs.pos);
  cam.up.set(0, 1, 0);
  cam.lookAt(cs.look);
  cam.updateMatrixWorld(true);

  const st = octoState(t);
  octo.root.position.copy(st.pos);
  octo.root.quaternion.copy(st.quat);
  octo.root.updateMatrixWorld(true);
  const an = anatomyState(t);
  octo.setPose({ ...st.pose, ...an, camera: cam });
  updateO2(t);

  ocean.setShadow(st.pos, 7);
  ocean.update(t, cam, st.pos.clone().add(v3(0, 0.2, 0)), st.jet > 0.2 ? 1 : 0.15);

  const focus = cam.position.distanceTo(cs.focusTarget);
  const wide = ss(37, 41.5, t);
  post.renderLayer(0, ocean.scene, cam, { focus, aperture: lerp(t < T.s2 ? 9 : 11, 6, wide), maxBlur: 14 });
  post.composite({
    exposure: 1.05,
    bloom: 0.55,
    vignette: 0.6,
    threshold: 1.0,
    fade: (1 - ss(0, 0.6, t)) + ss(42.0, 42.5, t) * 0.85,
    frame: Math.round(t * FPS),
  });
  updateOverlay(t, an);
  const scr = proj(st.pos.clone().add(v3(0, 0.8, 0)));
  return {
    t: +t.toFixed(4),
    octo: { x: +((scr.x / W) * 2 - 1).toFixed(3), d: +cam.position.distanceTo(st.pos).toFixed(2), jet: +st.jet.toFixed(3) },
    xray: +an.xray.toFixed(3),
  };
}

export const EVENTS = [
  { t: 0.0, type: 'ambience' },
  { t: T.rise + 0.4, type: 'bubbles' },
  { t: T.surprise + 0.05, type: 'accent' },
  { t: T.xrayIn, type: 'xray' },
  { t: T.bFocus, type: 'ping' },
  { t: T.sFocus, type: 'ping' },
  { t: T.o2 + 0.2, type: 'sparkle' },
  { t: T.hemo, type: 'ping' },
  { t: T.jet0, type: 'jet' },
  { t: T.wave + 0.2, type: 'accent_soft' },
  ...SYS_BEATS.filter((b) => b > T.xrayIn && b < 36.6).map((b) => ({ t: b, type: 'beat' })),
];

window.DURATION = DURATION;
window.FPS = FPS;
window.EVENTS = EVENTS;
window.renderAt = (t) => frame(t);
window.camAt = (t) => camState(t).pos.toArray();
window.octoAt = (t) => octoState(t).pos.toArray();
if (!new URLSearchParams(location.search).has('render')) {
  const stage = document.getElementById('stage');
  const fit = () => {
    const s = Math.min(innerWidth / W, innerHeight / H);
    stage.style.transform = `translate(${(innerWidth - W * s) / 2}px, ${(innerHeight - H * s) / 2}px) scale(${s})`;
    stage.style.transformOrigin = '0 0';
  };
  fit();
  addEventListener('resize', fit);
  const audio = new Audio('../out/soundtrack.wav');
  let start = null;
  const loop = (now) => {
    if (start === null) start = now;
    let t = (now - start) / 1000;
    if (t > DURATION) { start = now; t = 0; audio.currentTime = 0; }
    frame(t);
    requestAnimationFrame(loop);
  };
  addEventListener('click', () => { start = null; audio.currentTime = 0; audio.play().catch(() => {}); });
  requestAnimationFrame(loop);
}
window.READY = true;
