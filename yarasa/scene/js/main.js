import * as THREE from 'three';
import { clamp, lerp, remap, ss, easeInOut, window01, v3, quatFromForwardUp, softDotTexture } from './util.js';
import { createBat, createMoth } from './bat.js';
import { createCave } from './cave.js';
import { Post } from './post.js';

// ===========================================================================
//  "Yarasalar Karanlıkta Nasıl Yolunu Buluyor?" — vertical 1080×1920, 45 s.
//  Every frame is a pure function of t.  The bat flies along −z through one
//  continuous cave; the camera is world-anchored at the start and end and
//  orbits the bat in between, so there are no cuts.
// ===========================================================================
const W = 1080, H = 1920;
export const FPS = 30;
export const DURATION = 45.0;
const FOVV = 58;

const canvas = document.getElementById('c');
canvas.width = W;
canvas.height = H;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const post = new Post(renderer, W, H);
post.finalMat.uniforms.lift.value.set(0.004, 0.01, 0.022);
post.finalMat.uniforms.gain.value.set(0.97, 1.0, 1.03);
post.finalMat.uniforms.saturation.value = 1.05;

const SUBS = await fetch('./subtitles.json').then((r) => r.json());

// ---------------- time-keyed Hermite splines ----------------
function spline(keys) {
  const ts = keys.map((k) => k[0]);
  const ps = keys.map((k) => k.slice(1));
  const n = ts.length, d = ps[0].length;
  const ms = ps.map((p, i) => {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
    return p.map((_, j) => (ps[b][j] - ps[a][j]) / (ts[b] - ts[a]));
  });
  return (t) => {
    if (t <= ts[0]) return ps[0].map((x, j) => x + ms[0][j] * (t - ts[0]) * 0);
    if (t >= ts[n - 1]) return ps[n - 1].map((x, j) => x + ms[n - 1][j] * (t - ts[n - 1]));
    let i = 0;
    while (t > ts[i + 1]) i++;
    const h = ts[i + 1] - ts[i], s = (t - ts[i]) / h, s2 = s * s, s3 = s2 * s;
    const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
    const out = new Array(d);
    for (let j = 0; j < d; j++) out[j] = h00 * ps[i][j] + h10 * h * ms[i][j] + h01 * ps[i + 1][j] + h11 * h * ms[i + 1][j];
    return out;
  };
}
const vspline = (keys) => { const f = spline(keys); return (t) => v3(...f(t)); };
// integrate a frequency function into a phase table (cycles)
function phaseTable(freq, T1 = DURATION + 2, dt = 0.002) {
  const tab = new Float32Array(Math.ceil(T1 / dt) + 2);
  for (let i = 1; i < tab.length; i++) tab[i] = tab[i - 1] + freq((i - 0.5) * dt) * dt;
  return (t) => { const x = clamp(t, 0, T1) / dt, i = Math.floor(x); return tab[i] + (tab[i + 1] - tab[i]) * (x - i); };
}

// ---------------- timeline ----------------
const T = { s2: 5.0, s3: 12.0, s4: 22.0, dart: 24.6, turn: 26.3, buzz: 29.3, catch: 30.0, s5: 33.0, outro: 40.5 };

// ---------------- bat flight ----------------
// enters from the dark end of the tunnel, flies at the camera, then slows; slow motion 12–30 s
const BAT = vspline([
  [0.0, 0.3, 3.0, 19.0], [1.0, 0.2, 2.9, 14.0], [2.0, 0.0, 2.6, 8.6], [3.0, -0.3, 2.3, 4.0], [4.0, -0.5, 2.15, 0.9],
  [5.0, -0.6, 2.08, -1.3], [6.5, -0.7, 2.02, -3.4], [9.0, -0.8, 2.0, -6.6], [11.0, -0.9, 2.0, -8.9],
  [12.5, -0.95, 2.0, -10.0], [15, -1.0, 2.02, -11.3], [18, -1.05, 2.05, -12.8], [22, -1.1, 2.1, -14.8],
  [24, -1.08, 2.15, -16.9], [26, -1.0, 2.3, -19.6], [27.5, -0.55, 2.6, -21.7], [29, 0.0, 2.9, -23.8],
  [30.0, 0.15, 3.05, -25.3], [31.5, 0.2, 2.9, -27.9], [33, 0.0, 2.7, -31.0], [35, -0.3, 2.75, -36.6],
  [37, 0.15, 3.0, -43.5], [39, 0.45, 3.4, -51.3], [41, -0.55, 3.8, -59.4], [43, 0.6, 4.2, -67.5], [45, 0.0, 4.6, -75.6], [46, -0.3, 4.8, -79.6],
]);
const wingHz = (t) => {
  let f = 6.5;
  f = lerp(f, 4.2, ss(3.4, 5.0, t));
  f = lerp(f, 1.45, ss(11.0, 12.5, t)); // slow motion
  f = lerp(f, 2.1, ss(22, 24, t));
  f = lerp(f, 2.9, ss(27, 29.5, t));
  f = lerp(f, 5.2, ss(30.6, 34.0, t));
  return f;
};
const batPhase = phaseTable(wingHz);
const UP = v3(0, 1, 0);
function batFrame(t) {
  const p = BAT(t);
  const vel = BAT(t + 0.04).sub(BAT(t - 0.04)).divideScalar(0.08);
  const acc = BAT(t + 0.2).add(BAT(t - 0.2)).addScaledVector(p, -2).divideScalar(0.04);
  const fwd = vel.clone().normalize();
  const right = new THREE.Vector3().crossVectors(fwd, UP).normalize();
  const bank = clamp(acc.dot(right) * 0.35, -0.75, 0.75);
  const up = UP.clone().addScaledVector(right, bank).normalize();
  const q = quatFromForwardUp(fwd, up);
  return { p, vel, fwd, right, q, bank };
}
const MOUTH_LOCAL = v3(0, 0.02, 0.52);
const mouthAt = (t) => { const f = batFrame(t); return f.p.clone().add(MOUTH_LOCAL.clone().applyQuaternion(f.q)); };

// ---------------- moth ----------------
// offset from the bat (world axes); darts sideways at T.dart, caught at T.catch
const MOTH_OFF = vspline([
  [9.5, 0.2, 1.8, -1.2], [12, 0.1, 1.55, -0.95], [17, -0.1, 1.5, -0.9], [22, 0.0, 1.5, -1.0], [24.4, 0.05, 1.45, -1.2],
  [25.0, 0.7, 1.75, -1.85], [25.7, 1.45, 1.95, -1.95], [27.2, 1.0, 1.3, -1.45], [28.6, 0.45, 0.8, -1.0], [29.6, 0.12, 0.4, -0.7], [30.0, 0.0, 0.1, -0.55],
]);
const mothHz = (t) => lerp(lerp(8, 2.6, ss(10, 12.5, t)), 3.6, ss(22, 24.5, t));
const mothPhase = phaseTable(mothHz);
function mothRaw(t) {
  const sl = lerp(1, 0.35, window01(t, 11, 30, 1.5)); // slow-motion jitter
  const jit = v3(Math.sin(t * 2.7 * sl + 1) * 0.07, Math.sin(t * 3.9 * sl) * 0.09, Math.sin(t * 2.1 * sl + 2) * 0.05).multiplyScalar(1 - ss(28.6, 29.8, t));
  return BAT(t).add(MOTH_OFF(t)).add(jit);
}
const mothAt = (t) => mothRaw(t).lerp(mouthAt(t), ss(29.3, T.catch, t));

// ---------------- sound pulses ----------------
// Every pulse is a short burst of thin wavefronts. Targeted pulses reflect from the moth:
// an echo shell (amber) starts at the hit point and travels back to the bat.
// Wave speed is drastically slowed for visibility (real sound: ~343 m/s).
const PULSES = [];
function addPulse(te, kind) {
  const c = { s2: 2.8, demo: 2.0, hunt: 3.0, buzz: 3.0, nav: 9.0 }[kind];
  const O = mouthAt(te);
  const f = batFrame(te);
  const P = { te, kind, c, O };
  if (kind === 's2' || kind === 'nav') {
    P.axis = f.fwd.clone().addScaledVector(UP, kind === 'nav' ? 0.05 : 0.12).normalize();
    P.cap = kind === 'nav' ? 0.8 : 0.6;
    P.rmax = kind === 'nav' ? 3.2 : 1.7;
    P.reach = 14;
    P.base = kind === 'nav' ? 0.45 : 0.75;
  } else {
    let th = te + O.distanceTo(mothAt(te)) / c;
    for (let k = 0; k < 10; k++) th = te + O.distanceTo(mothAt(th)) / c;
    const Hp = mothAt(th);
    let tr = th + Hp.distanceTo(mouthAt(th)) / c;
    for (let k = 0; k < 10; k++) tr = th + Hp.distanceTo(mouthAt(tr)) / c;
    Object.assign(P, { th, tr, H: Hp, hitR: O.distanceTo(Hp), retR: Hp.distanceTo(mouthAt(tr)) });
    P.axis = Hp.clone().sub(O).normalize();
    P.echoAxis = mouthAt(tr).sub(Hp).normalize();
    P.cap = kind === 'buzz' ? 0.42 : 0.5;
    P.rmax = P.hitR * (kind === 'buzz' ? 1.05 : 1.2);
    P.base = { demo: 1.0, hunt: 0.45, buzz: 0.4 }[kind];
  }
  PULSES.push(P);
}
for (let te = 6.3; te < 11.3; te += 0.42) addPulse(te, 's2');
for (const te of [12.6, 15.0, 18.4, 20.6]) addPulse(te, 'demo');
for (const te of [22.4, 23.5, 24.5, 25.35, 26.15, 26.85, 27.45, 27.95, 28.4, 28.8, 29.15]) addPulse(te, 'hunt');
for (let te = 29.32; te < 29.95; te += 0.09) addPulse(te, 'buzz');
for (let te = 33.4; te < 43.6; te += 0.62) addPulse(te, 'nav');

// shell geometry (cap around +Y) + additive fresnel material
const shellGeo = new THREE.SphereGeometry(1, 64, 24, 0, Math.PI * 2, 0, 1.25);
const SHELL_VS = /* glsl */ `
  varying vec3 vN; varying vec3 vV; varying float vPol;
  void main(){
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vN = normalize(mat3(modelMatrix) * normal);
    vV = cameraPosition - wp.xyz;
    vPol = acos(clamp(position.y, -1.0, 1.0));
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;
const SHELL_FS = /* glsl */ `
  uniform vec3 col; uniform float alpha; uniform float cap; uniform float ring;
  varying vec3 vN; varying vec3 vV; varying float vPol;
  void main(){
    float ndv = abs(dot(normalize(vN), normalize(vV)));
    float rim = pow(1.0 - ndv, 4.0);
    float edge = 1.0 - smoothstep(cap * 0.5, cap, vPol);
    float near = smoothstep(0.6, 2.2, length(vV)); // never smear a front across the lens
    // seen edge-on a front reads as a thin arc (rim); seen head-on it reads as an expanding ring
    float rg = exp(-pow((vPol - cap * 0.62) / (0.035 * cap / 0.6), 2.0)) * ndv * ndv * ring;
    float a = (0.02 + 0.9 * rim + 0.7 * rg) * edge * alpha * near;
    gl_FragColor = vec4(col * a, 1.0);
  }`;
const CYAN = new THREE.Color(0.42, 0.95, 1.25), AMBER = new THREE.Color(1.3, 0.72, 0.28);
const shells = [];
function shell() {
  const m = new THREE.Mesh(shellGeo, new THREE.ShaderMaterial({
    vertexShader: SHELL_VS, fragmentShader: SHELL_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { col: { value: new THREE.Color() }, alpha: { value: 0 }, cap: { value: 1 }, ring: { value: 1 } },
  }));
  m.frustumCulled = false;
  m.renderOrder = 5;
  return m;
}
const qY = new THREE.Quaternion();
function placeShell(i, o, axis, r, cap, col, a, ring = 0) {
  if (!shells[i]) { shells[i] = shell(); cave.scene.add(shells[i]); }
  const m = shells[i];
  m.visible = a > 0.003 && r > 0.01;
  if (!m.visible) return;
  m.position.copy(o);
  m.scale.setScalar(r);
  m.quaternion.copy(qY.setFromUnitVectors(UP, axis));
  m.material.uniforms.col.value.copy(col);
  m.material.uniforms.alpha.value = a;
  m.material.uniforms.cap.value = cap;
  m.material.uniforms.ring.value = ring;
}
function updatePulses(t) {
  let n = 0;
  const reveal = [];
  let glow = 0, listen = 0, call = 0;
  for (const P of PULSES) {
    const dt = t - P.te;
    call = Math.max(call, Math.exp(-(((dt - 0.03) / (P.kind === 'buzz' ? 0.1 : 0.06)) ** 2)));
    if (dt < 0 || dt > 4) continue;
    const r = P.c * dt;
    const a = P.base * ss(0, 0.05, r) * (1 - ss(P.rmax * (P.th !== undefined ? 0.75 : 0.55), P.rmax, r));
    // a pulse is 2 thin fronts, slightly apart
    for (let k = 0; k < 3; k++) {
      const rk = r - k * (P.kind === 'nav' ? 0.2 : 0.07);
      if (rk > 0 && a > 0.003 && n < 90) placeShell(n++, P.O, P.axis, rk, P.cap, CYAN, a * [1, 0.55, 0.3][k], P.th === undefined ? 1 : 0);
    }
    if (P.kind === 'nav' && r < P.reach) reveal.push({ o: P.O, r, a: 0.22 * ss(0, 0.5, r) * (1 - ss(P.reach * 0.55, P.reach, r)), d: P.axis });
    if (P.th !== undefined && t > P.th) {
      const re = P.c * (t - P.th);
      const ea = (P.kind === 'buzz' ? 0.4 : P.kind === 'hunt' ? 0.55 : 0.7) * ss(0, 0.06, re) * (1 - ss(P.retR * 0.88, P.retR * 1.04, re));
      for (let k = 0; k < 3; k++) {
        const rk = re - k * 0.06;
        if (rk > 0 && ea > 0.003 && n < 90) placeShell(n++, P.H, P.echoAxis, rk, 0.5, AMBER, ea * [1, 0.55, 0.3][k]);
      }
      glow = Math.max(glow, Math.exp(-(((t - P.th) / 0.12) ** 2)) * (P.kind === 'buzz' ? 0.15 : P.kind === 'hunt' ? 0.5 : 0.8));
      listen = Math.max(listen, Math.exp(-(((t - P.tr) / 0.3) ** 2)));
    }
  }
  for (let i = n; i < shells.length; i++) shells[i].visible = false;
  reveal.sort((a, b) => b.a - a.a);
  cave.setPulses(reveal.slice(0, 6));
  return { glow, listen, call };
}

// ---------------- camera ----------------
// orbit around the bat: yaw 0 = in front (looking at its face), 90 = its right side, 180 = behind
const ORB = spline([
  [2.6, 16, 4, 5.4, 0], [4.5, 24, 5, 2.5, 0], [6.5, 30, 5, 1.6, 0], [9.0, 33, 4, 1.22, 0], [11.0, 36, 4, 1.08, 0],
  [12.3, 58, 5, 2.8, 0.6], [13.8, 76, 3, 4.2, 1], [18, 80, 3, 4.2, 1], [21.6, 86, 5, 4.1, 1],
  [23.8, 136, 15, 3.7, 0.9], [27, 148, 14, 3.4, 0.85], [29.4, 128, 10, 2.5, 0.6], [31, 116, 9, 2.5, 0.0], [33, 120, 10, 2.8, 0.0],
]);
function headingAt(t) {
  const d = BAT(t + 0.7).sub(BAT(t - 0.7));
  d.y *= 0.3;
  return d.normalize();
}
const S1POS = (t) => v3(-0.35, 2.25, -6.6 + 0.45 * t);
const S5CAM = vspline([[31.6, 2.5, 3.4, -28.0], [34, 2.2, 3.9, -33.6], [36.5, 1.8, 4.8, -39.5], [39.5, 1.2, 5.4, -44.5], [46, 0.6, 5.8, -48.0]]);
function camState(t) {
  const o = ORB(t);
  const B = BAT(t);
  const head = B.clone().add(v3(0, 0.08, 0.3).applyQuaternion(batFrame(t).q));
  const look = head.clone().lerp(B.clone().lerp(mothAt(t), 0.5), o[3]);
  const fh = headingAt(t);
  const right = new THREE.Vector3().crossVectors(fh, UP).normalize();
  const yaw = THREE.MathUtils.degToRad(o[0]), pit = THREE.MathUtils.degToRad(o[1]);
  const dir = fh.clone().multiplyScalar(Math.cos(yaw)).addScaledVector(right, Math.sin(yaw)).normalize();
  let pos = look.clone().addScaledVector(dir, o[2] * Math.cos(pit)).addScaledVector(UP, o[2] * Math.sin(pit));
  let tgt = look;
  let focusP = look;
  // scene 1: slow dolly into the tunnel, picks up the incoming bat
  const w1 = easeInOut(remap(t, 2.6, 4.6));
  if (w1 < 1) {
    const p1 = S1POS(t);
    const l1 = v3(0.1, 2.6, 22).lerp(B, ss(0.8, 2.6, t));
    pos = p1.lerp(pos, w1);
    tgt = l1.lerp(tgt, w1);
    focusP = B;
  }
  // scene 5: crane up and hold while the bat flies off through the chamber
  const w5 = easeInOut(remap(t, 31.6, 35.4));
  if (w5 > 0) {
    const p5 = S5CAM(t);
    const l5 = B.clone().add(v3(0, 0.2, 0)).lerp(v3(0, 4.6, -80), ss(41.5, 45, t) * 0.4);
    pos.lerp(p5, w5).addScaledVector(UP, Math.sin(Math.PI * w5) * 0.6);
    tgt = tgt.clone().lerp(l5, w5);
    focusP = focusP.clone().lerp(B, w5);
  }
  return { pos, look: tgt, focusP };
}

// ---------------- world ----------------
const cave = createCave();
const scene = cave.scene;
{
  // keep the flight corridor, camera path and the camera→bat sight line free of rock
  const samples = [];
  for (let t = 0; t <= DURATION + 0.5; t += 0.08) {
    const B = BAT(t), C = camState(t).pos;
    samples.push([B, 1.35], [C, 0.9]);
    for (const u of [0.25, 0.5, 0.75]) samples.push([C.clone().lerp(B, u), 0.55]);
    if (t > 9 && t < 30.2) samples.push([mothAt(t), 0.8]);
  }
  const segDist = (p, a, b) => {
    const ab = b.clone().sub(a), u = clamp(p.clone().sub(a).dot(ab) / ab.lengthSq());
    return p.distanceTo(a.clone().addScaledVector(ab, u));
  };
  cave.build({
    isInCorridor: (a, b) => samples.some(([p, r]) => Math.abs(p.z - a.z) < 6 && segDist(p, a, b) < r + 0.35),
    columnsAt: [[2.8, -53.5, 1.0], [-2.9, -56, 1.3], [3.3, -61.5, 1.4], [-3.8, -64.5, 1.2], [3.0, -70.5, 1.5], [-2.6, -73.5, 1.1], [6.8, -60, 1.9], [-7.5, -68, 2.2], [0.8, -88, 1.7]],
  });
}
const bat = createBat();
scene.add(bat.root);
const moth = createMoth();
scene.add(moth.root);
moth.root.scale.setScalar(1.3);
// a few moth scales drifting after the catch
const NS = 70;
const scGeo = new THREE.BufferGeometry();
scGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(NS * 3), 3));
const scales = new THREE.Points(scGeo, new THREE.PointsMaterial({ size: 0.022, map: softDotTexture(), color: new THREE.Color(1.6, 1.2, 0.7), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
scales.frustumCulled = false;
scene.add(scales);
const scDir = Array.from({ length: NS }, (_, i) => v3(Math.sin(i * 12.9898) , Math.sin(i * 78.233) , Math.sin(i * 37.719)).normalize().multiplyScalar(0.25 + 0.5 * Math.abs(Math.sin(i * 3.1))));
const catchPoint = mouthAt(T.catch);

const cam = new THREE.PerspectiveCamera(FOVV, W / H, 0.04, 300);

// ---------------- overlay ----------------
const $ = (id) => document.getElementById(id);
const ov = { slow: $('slow'), ultra: $('ultra'), legend: $('legend'), f1: $('f1'), f2: $('f2'), outro: $('outro'), sub: $('sub') };
const op = (el, v, tr) => { el.style.opacity = clamp(v).toFixed(3); if (tr !== undefined) el.style.transform = tr; };
const popIn = (t, a) => (0.92 + 0.08 * ss(a, a + 0.3, t)).toFixed(3);
function updateOverlay(t) {
  op(ov.slow, window01(t, 12.2, 30.3, 0.4));
  op(ov.ultra, window01(t, 9.0, 12.0, 0.35), `translateX(-50%) scale(${popIn(t, 9.0)})`);
  op(ov.legend, window01(t, 12.7, 21.9, 0.4), `translateX(-50%) scale(${popIn(t, 12.7)})`);
  op(ov.f1, window01(t, 22.4, 29.6, 0.35), `translateX(-50%) scale(${popIn(t, 22.4)})`);
  op(ov.f2, window01(t, 26.0, 29.6, 0.35), `translateX(-50%) scale(${popIn(t, 26.0)})`);
  op(ov.outro, window01(t, T.outro, DURATION + 1, 0.6), `translateX(-50%) translateY(${((1 - ss(T.outro, T.outro + 0.7, t)) * 30).toFixed(1)}px)`);
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
const tmpM = new THREE.Matrix4();
function frame(t) {
  const cs = camState(t);
  cam.position.copy(cs.pos);
  cam.up.set(0, 1, 0);
  cam.lookAt(cs.look);
  cam.updateMatrixWorld(true);

  // bat
  const bf = batFrame(t);
  bat.root.position.copy(bf.p);
  bat.root.quaternion.copy(bf.q);
  bat.root.updateMatrixWorld(true);
  const pu = updatePulses(t);
  const M = mothAt(t);
  // head follows the moth while hunting
  const hl = M.clone().applyMatrix4(tmpM.copy(bat.root.matrixWorld).invert()).sub(v3(0, 0.05, 0.3));
  const track = window01(t, 11.5, T.catch + 0.1, 0.8);
  const scoop = Math.exp(-(((t - T.catch + 0.05) / 0.22) ** 2));
  bat.setPose({
    t, phase: batPhase(t) % 1, amp: 1.05 - 0.15 * window01(t, 11.5, 22, 1), tuck: 0.4 * scoop,
    pitch: -0.35 * scoop, roll: 0,
    headYaw: track * clamp(Math.atan2(hl.x, hl.z), -0.5, 0.5),
    headPitch: track * clamp(-Math.atan2(hl.y, Math.hypot(hl.x, hl.z)), -0.6, 0.4),
    call: pu.call, listen: 0.35 + 0.65 * pu.listen,
  });

  // moth
  moth.root.visible = t > 9.0 && t < T.catch + 0.1;
  if (moth.root.visible) {
    moth.root.position.copy(M);
    const mv = mothAt(t + 0.05).sub(mothAt(t - 0.05));
    const bv = bf.vel.clone().multiplyScalar(0.1);
    moth.root.quaternion.copy(quatFromForwardUp(mv.lengthSq() > 1e-6 ? mv.add(bv.multiplyScalar(0.2)) : bf.fwd, UP));
    moth.setPose({ t: mothPhase(t), hz: 1 });
    moth.glow(pu.glow);
  }
  // scales burst after the catch
  const ds = t - T.catch;
  scales.visible = ds > 0 && ds < 1.6;
  if (scales.visible) {
    const a = scGeo.attributes.position.array;
    for (let i = 0; i < NS; i++) {
      const d = scDir[i], k = (1 - Math.exp(-ds * 3)) / 3;
      a[i * 3] = catchPoint.x + d.x * k;
      a[i * 3 + 1] = catchPoint.y + d.y * k - 0.15 * ds * ds;
      a[i * 3 + 2] = catchPoint.z + d.z * k;
    }
    scGeo.attributes.position.needsUpdate = true;
    scales.material.opacity = 1 - ss(0.3, 1.6, ds);
  }

  cave.update(t, cam, bf.p);
  const focus = cam.position.distanceTo(cs.focusP);
  const close = window01(t, 4.5, 12.0, 1.2);
  post.renderLayer(0, scene, cam, { focus, aperture: lerp(lerp(lerp(7, 12, close), 3.5, ss(11.5, 13.5, t)), 4.5, ss(31, 35, t)), maxBlur: 14 });
  post.composite({
    exposure: 1.25,
    bloom: 0.6,
    vignette: 0.7,
    threshold: 0.9,
    fade: (1 - ss(0, 0.8, t)) + ss(DURATION - 0.6, DURATION, t) * 0.9,
    frame: Math.round(t * FPS),
  });
  updateOverlay(t);
  const sc = bf.p.clone().project(cam);
  return {
    t: +t.toFixed(4),
    ph: +batPhase(t).toFixed(4),
    hz: +wingHz(t).toFixed(3),
    d: +cam.position.distanceTo(bf.p).toFixed(3),
    x: +clamp(sc.x, -1.5, 1.5).toFixed(3),
  };
}

export const EVENTS = [
  { t: 0.0, type: 'ambience' },
  ...PULSES.map((P) => ({ t: +P.te.toFixed(3), type: 'pulse', kind: P.kind })),
  ...PULSES.filter((P) => P.tr !== undefined).map((P) => ({ t: +P.tr.toFixed(3), type: 'echo', kind: P.kind })),
  { t: T.dart, type: 'dart' },
  { t: T.catch, type: 'catch' },
  { t: T.outro, type: 'outro' },
];

window.DURATION = DURATION;
window.FPS = FPS;
window.EVENTS = EVENTS;
window.renderAt = (t) => frame(t);
window.camAt = (t) => camState(t).pos.toArray();
window.dbg = (t) => { const o = ORB(t); return [o, headingAt(t).toArray(), BAT(t).toArray(), mothAt(t).toArray(), batFrame(t).q.toArray()]; };
window.batAt = (t) => BAT(t).toArray();
window.PULSES = PULSES.map((P) => ({ te: P.te, kind: P.kind, th: P.th, tr: P.tr, hitR: P.hitR }));
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
