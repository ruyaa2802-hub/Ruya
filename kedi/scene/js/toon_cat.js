import * as THREE from 'three';
import { canvasTexture, rng, clamp, lerp } from './util.js';
import { Loft, profile } from './loft.js';

// ---------------------------------------------------------------------------
// Cartoon house cat (original character in a classic comic-strip style):
// big round head, large white eyes with expressive lids, puffy muzzle,
// chubby pear-shaped body, short legs, thick striped tail.
// Same rig/pose API as cat.js (forward +Z, up +Y, metres) plus expression
// controls: lid, squint (happy eyes), eyeX/eyeY (gaze), and automatic life:
// blinks, ear flicks, squash & stretch on vocalisations, hip sway when walking.
// ---------------------------------------------------------------------------
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const vl = (a, b, f) => a.clone().lerp(b, f);

function ik2(a, target, l1, l2, hint) {
  const d = target.clone().sub(a);
  const L = clamp(d.length(), 1e-4, l1 + l2 - 1e-4);
  const dir = d.normalize();
  const cosA = clamp((l1 * l1 + L * L - l2 * l2) / (2 * l1 * L), -1, 1);
  const perp = hint.clone().addScaledVector(dir, -hint.dot(dir));
  if (perp.lengthSq() < 1e-8) perp.set(0, 1, 0);
  perp.normalize();
  const mid = a.clone().addScaledVector(dir, l1 * cosA).addScaledVector(perp, l1 * Math.sqrt(1 - cosA * cosA));
  return [mid, a.clone().addScaledVector(dir, L)];
}

const COATS = {
  ginger: { base: '#f29a2e', stripe: '#3b2316', belly: '#fbc98a', muzzle: '#fcd9a6', nose: '#e8857f', sheen: '#ffd9a0' },
  grey: { base: '#98a1b0', stripe: '#525a68', belly: '#d9dee6', muzzle: '#eef0f4', nose: '#c98a8e', sheen: '#eef2ff' },
};

// u along the loft (canvas x), v around (canvas y; dorsal = middle row)
function bodyTex(c, seed, bands = 9, reach = 0.3) {
  const r = rng(seed);
  return canvasTexture(1024, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, c.belly);
    gr.addColorStop(0.24, c.base);
    gr.addColorStop(0.76, c.base);
    gr.addColorStop(1, c.belly);
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    // bold tapered stripes over the back
    g.fillStyle = c.stripe;
    for (let i = 0; i < bands; i++) {
      const x0 = ((i + 0.6) / bands) * w * 0.92 + (r() - 0.5) * 12;
      const wd = 16 + r() * 10, ext = h * (reach + r() * 0.06);
      g.beginPath();
      g.moveTo(x0 - wd / 2, h / 2);
      g.quadraticCurveTo(x0 - wd * 0.6, h / 2 - ext * 0.6, x0 + 6, h / 2 - ext);
      g.quadraticCurveTo(x0 + wd * 0.3, h / 2 - ext * 0.5, x0 + wd / 2, h / 2);
      g.quadraticCurveTo(x0 + wd * 0.3, h / 2 + ext * 0.5, x0 + 6, h / 2 + ext);
      g.quadraticCurveTo(x0 - wd * 0.6, h / 2 + ext * 0.6, x0 - wd / 2, h / 2);
      g.fill();
    }
    // very soft fur grain
    for (let i = 0; i < 5000; i++) {
      g.fillStyle = r() < 0.5 ? 'rgba(255,240,220,0.05)' : 'rgba(60,30,10,0.05)';
      g.fillRect(r() * w, r() * h, 3, 1);
    }
  });
}
function headTex(c) {
  // sphere UV: front (+z) at u = 0.25 (canvas x = w/4), top = canvas y 0
  return canvasTexture(512, 256, (g, w, h) => {
    g.fillStyle = c.base;
    g.fillRect(0, 0, w, h);
    g.fillStyle = c.stripe;
    for (const [dx, len] of [[-16, 0.2], [0, 0.24], [16, 0.2]]) {
      g.beginPath();
      g.ellipse(w * 0.25 + dx, h * 0.12, 4.5, h * len * 0.5, 0, 0, Math.PI * 2);
      g.fill();
    }
    for (const sx of [-1, 1]) {
      g.beginPath();
      g.ellipse(w * 0.25 + sx * 92, h * 0.45, 22, 4, sx * 0.3, 0, Math.PI * 2);
      g.ellipse(w * 0.25 + sx * 100, h * 0.55, 18, 3.5, sx * 0.3, 0, Math.PI * 2);
      g.fill();
    }
  });
}

export function createCat({ coat = 'ginger', seed = 1, scale = 1 } = {}) {
  const C = COATS[coat];
  const root = new THREE.Group();
  const inner = new THREE.Group();
  inner.scale.setScalar(scale);
  root.add(inner);
  const plush = (opts) => new THREE.MeshPhysicalMaterial({ roughness: 0.75, sheen: 0.25, sheenRoughness: 0.7, sheenColor: new THREE.Color(C.sheen), ...opts });
  const furMat = plush({ map: bodyTex(C, seed) });
  const tailMat = plush({ map: bodyTex(C, seed + 5, 7, 0.5) });
  const legMat = plush({ map: bodyTex(C, seed + 9, 3, 0.2) });
  const headMat = plush({ map: headTex(C) });
  const baseMat = plush({ color: C.base });
  const muzzleMat = plush({ color: C.muzzle });
  const pawMat = plush({ color: C.base });
  const pink = new THREE.MeshStandardMaterial({ color: '#f09aa0', roughness: 0.5 });
  const mouthMat = new THREE.MeshStandardMaterial({ color: '#7a1f2a', roughness: 0.6 });
  const noseMat = new THREE.MeshPhysicalMaterial({ color: C.nose, roughness: 0.3, clearcoat: 0.8 });
  const eyeWhite = new THREE.MeshPhysicalMaterial({ color: '#fffdf6', roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.1 });
  const pupilMat = new THREE.MeshPhysicalMaterial({ color: '#120c0a', roughness: 0.2, clearcoat: 1 });
  const glint = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const sh = (m) => { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; return m; };
  const S = new THREE.SphereGeometry(1, 48, 32);
  const add = (geo, mat, parent, pos, scl) => { const m = sh(new THREE.Mesh(geo, mat)); m.position.set(...pos); m.scale.set(...scl); parent.add(m); return m; };

  // ---- body, tail, legs (lofts) ----
  const body = new Loft(44, 40);
  inner.add(sh(new THREE.Mesh(body.geo, furMat)));
  const bodyProf = profile([
    [0, 0.005, 0.005, 0.005], [0.05, 0.06, 0.06, 0.06], [0.15, 0.088, 0.078, 0.088], [0.36, 0.097, 0.08, 0.108],
    [0.56, 0.09, 0.076, 0.104], [0.73, 0.076, 0.07, 0.088], [0.87, 0.058, 0.057, 0.064], [1, 0.044, 0.044, 0.046],
  ]);
  const tail = new Loft(30, 20);
  inner.add(sh(new THREE.Mesh(tail.geo, tailMat)));
  const legs = [];
  for (const [sx, front] of [[1, true], [-1, true], [1, false], [-1, false]]) {
    const L = new Loft(22, 20);
    inner.add(sh(new THREE.Mesh(L.geo, legMat)));
    const paw = sh(new THREE.Mesh(S, pawMat));
    inner.add(paw);
    legs.push({ sx, front, L, paw });
  }

  // ---- head ----
  const neck = sh(new THREE.Mesh(S, baseMat));
  inner.add(neck);
  const head = new THREE.Group();
  inner.add(head);
  const headScale = new THREE.Group(); // squash & stretch
  head.add(headScale);
  const H = headScale;
  add(S, headMat, H, [0, 0.006, -0.006], [0.084, 0.074, 0.078]);
  const jowls = [-1, 1].map((sx) => add(S, baseMat, H, [0.05 * sx, -0.028, 0.004], [0.046, 0.04, 0.046]));
  const puffs = [-1, 1].map((sx) => add(S, muzzleMat, H, [0.021 * sx, -0.034, 0.058], [0.029, 0.024, 0.025]));
  add(S, noseMat, H, [0, -0.014, 0.081], [0.011, 0.0075, 0.0075]);
  // mouth: interior visible when the jaw drops
  const jaw = new THREE.Group();
  jaw.position.set(0, -0.046, 0.038);
  H.add(jaw);
  const chin = add(S, muzzleMat, jaw, [0, -0.01, 0.018], [0.024, 0.0125, 0.022]);
  const mouthIn = add(S, mouthMat, H, [0, -0.05, 0.05], [0.021, 0.012, 0.016]);
  const tongue = add(S, pink, jaw, [0, -0.004, 0.025], [0.014, 0.005, 0.016]);
  // eyes: big whites touching in the middle, black pupils with a glint, eyelids for expression
  const eyes = [];
  for (const sx of [-1, 1]) {
    const eg = new THREE.Group();
    eg.position.set(0.0275 * sx, 0.03, 0.05);
    eg.rotation.set(-0.08, 0.22 * sx, -0.06 * sx);
    eg.scale.set(0.03, 0.037, 0.015);
    H.add(eg);
    const white = sh(new THREE.Mesh(S, eyeWhite));
    eg.add(white);
    const pg = new THREE.Group();
    eg.add(pg);
    const pupil = new THREE.Mesh(S, pupilMat);
    pupil.scale.set(0.36, 0.4, 0.28);
    pupil.position.z = 0.82;
    pg.add(pupil);
    const gl = new THREE.Mesh(S, glint);
    gl.scale.set(0.1, 0.09, 0.06);
    gl.position.set(0.12, 0.16, 1.05);
    pg.add(gl);
    const lidGeo = new THREE.SphereGeometry(1.1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const up = sh(new THREE.Mesh(lidGeo, baseMat));
    const lo = sh(new THREE.Mesh(lidGeo, baseMat));
    eg.add(up, lo);
    eyes.push({ sx, pg, pupil, up, lo });
  }
  // ears
  const earGeo = new THREE.ConeGeometry(1, 1, 20, 1);
  earGeo.translate(0, 0.5, 0);
  const ears = [];
  for (const sx of [-1, 1]) {
    const g = new THREE.Group();
    g.position.set(0.052 * sx, 0.052, -0.012);
    H.add(g);
    add(earGeo, baseMat, g, [0, 0, 0], [0.03, 0.046, 0.014]);
    add(earGeo, pink, g, [0, 0.004, 0.008], [0.019, 0.034, 0.006]);
    ears.push({ g, sx });
  }
  // whiskers (thin dark strokes, comic style)
  const wGeo = new THREE.CylinderGeometry(0.0009, 0.0005, 0.07, 5);
  wGeo.translate(0, 0.035, 0);
  const wMat = new THREE.MeshBasicMaterial({ color: '#2a1a12' });
  for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) {
    const w = new THREE.Mesh(wGeo, wMat);
    w.position.set(0.04 * sx, -0.03 - 0.006 * k, 0.062);
    w.rotation.set(0, 0, -sx * (Math.PI / 2 - 0.15 + 0.15 * k));
    H.add(w);
  }

  // ======================= pose =========================
  const UPV = V(0, 1, 0);
  function spine(p) {
    const st = [V(0, 0.155, -0.2), V(0, 0.16, -0.14), V(0, 0.153, -0.02), V(0, 0.16, 0.09), V(0, 0.205, 0.16)];
    const si = [V(0, 0.065, -0.135), V(0, 0.09, -0.105), V(0, 0.15, -0.05), V(0, 0.205, 0.0), V(0, 0.245, 0.038)];
    const li = [V(0, 0.09, -0.2), V(0, 0.094, -0.14), V(0, 0.097, -0.02), V(0, 0.1, 0.09), V(0, 0.14, 0.15)];
    let P = st.map((v, i) => vl(v, si[i], p.sit));
    P = P.map((v, i) => vl(v, li[i], p.lie));
    P[2].y += 0.06 * p.arch;
    P[1].y += 0.025 * p.arch;
    P[3].y += 0.02 * p.arch;
    for (let i = 1; i < 5; i++) P[i].y -= 0.045 * p.crouch * (i / 4);
    P[4].z += 0.03 * p.crouch;
    P[0].x -= 0.04 * p.bend;
    P[2].x += 0.03 * p.bend;
    P[4].x -= 0.05 * p.bend;
    // squash & stretch: chest lifts on a vocalisation
    P[3].y += 0.012 * p.jaw;
    P[4].y += 0.02 * p.jaw;
    const bob = -0.008 * Math.cos(4 * Math.PI * p.phase) * p.walk;
    for (const v of P) v.y += bob;
    return P;
  }
  function tailPts(p, base) {
    const n = 9, segL = 0.032;
    const pts = [base.clone()];
    const elev = lerp(-1.25, 1.45, p.tailUp);
    const dir = V(0, Math.sin(elev), -Math.cos(elev));
    const side = V(1, 0, 0);
    for (let i = 1; i < n; i++) {
      const f = i / (n - 1);
      const q1 = new THREE.Quaternion().setFromAxisAngle(side, -p.tailCurl * 0.55 * f * f);
      const q2 = new THREE.Quaternion().setFromAxisAngle(UPV, p.tailSwish * 0.6 * Math.sin(p.tailPhase - i * 0.55) * f);
      dir.applyQuaternion(q1).applyQuaternion(q2).normalize();
      pts.push(pts[i - 1].clone().addScaledVector(dir, segL));
    }
    if (p.tailWrap > 0) {
      const w = [base.clone(), V(0.03, 0.03, -0.23), V(0.08, 0.02, -0.2), V(0.115, 0.018, -0.12), V(0.13, 0.018, -0.03), V(0.12, 0.018, 0.05), V(0.09, 0.018, 0.11), V(0.04, 0.018, 0.14), V(-0.01, 0.018, 0.145)];
      if (p.lie > 0) {
        const l = [base.clone(), V(0.05, 0.035, -0.26), V(0.11, 0.024, -0.21), V(0.14, 0.022, -0.11), V(0.15, 0.022, -0.01), V(0.14, 0.022, 0.08), V(0.11, 0.022, 0.15), V(0.06, 0.022, 0.19), V(0.0, 0.022, 0.2)];
        w.forEach((v, i) => v.lerp(l[i], p.lie));
      }
      for (let i = 1; i < n; i++) pts[i].lerp(w[i], p.tailWrap);
    }
    return pts;
  }
  const tailProf = (puff) => (u) => {
    const r = lerp(0.026, 0.017, u) * (1 + puff * (1.1 - 0.4 * u)) * (u > 0.92 ? Math.sqrt((1 - u) / 0.08) * 0.75 + 0.25 : 1);
    return [r, r, r];
  };
  // automatic life: blinks and ear flicks at irregular, deterministic times
  const autoBlink = (t) => {
    let v = 0;
    for (let k = Math.floor(t / 3.1) - 1; k <= Math.floor(t / 3.1) + 1; k++) {
      const b = k * 3.1 + 1.3 + 0.9 * Math.sin(k * 12.9898 + seed);
      v = Math.max(v, Math.exp(-(((t - b) / 0.055) ** 2)));
    }
    return v;
  };
  const flick = (t, sx) => {
    let v = 0;
    for (let k = Math.floor(t / 2.7) - 1; k <= Math.floor(t / 2.7) + 1; k++) {
      const b = k * 2.7 + 0.6 + 1.1 * Math.sin(k * 7.13 + sx * 3 + seed);
      if (Math.sin(k * 3.7 + sx) > 0.1) v = Math.max(v, Math.exp(-(((t - b) / 0.07) ** 2)));
    }
    return v;
  };

  const cat = {
    root, head, inner,
    world: {},
    setPose(o) {
      const p = Object.assign({
        t: 0, walk: 0, phase: 0, stride: 0.13, sit: 0, lie: 0, arch: 0, crouch: 0, bend: 0,
        headYaw: 0, headPitch: 0, headRoll: 0, reach: 0, jaw: 0, earFwd: 0.5, earFlat: 0, earSide: 0,
        blink: 0, lid: 0.12, squint: 0, eyeX: 0, eyeY: 0, pupil: 0.5, tailUp: 0.6, tailCurl: 0.4, tailSwish: 0.15, tailPhase: 0, tailPuff: 0, tailWrap: 0,
        breathe: 0, purr: 0, furPuff: 0,
      }, o);
      const t = p.t;
      p.tailPhase = p.tailPhase || t * 2.2;
      const P = spine(p);
      const br = 1 + 0.035 * Math.sin(p.breathe) + 0.012 * p.purr * Math.sin(t * 50) + 0.2 * p.furPuff;
      body.update(P, (u) => { const r = bodyProf(u); const k = u > 0.25 && u < 0.8 ? br : 1 + (br - 1) * 0.4; return [r[0] * k, r[1] * k, r[2] * k]; }, UPV);
      // hip sway while walking
      inner.rotation.z = 0.045 * Math.sin(2 * Math.PI * p.phase) * p.walk;

      // head
      const nd = P[4].clone().sub(P[3]).normalize();
      const hp = P[4].clone().addScaledVector(nd, 0.03).add(V(0, 0.05, 0.022)).add(V(0, -0.01, 0.04).multiplyScalar(p.reach));
      hp.y += 0.006 * Math.cos(4 * Math.PI * p.phase) * p.walk; // counter-bob
      head.position.copy(hp);
      neck.position.copy(P[4]).lerp(hp, 0.45);
      neck.scale.set(0.052, 0.055, 0.05);
      head.rotation.set(p.headPitch, p.headYaw, p.headRoll - 0.6 * inner.rotation.z, 'YXZ');
      const j = clamp(p.jaw);
      H.scale.set(1 - 0.035 * j, 1 + 0.06 * j, 1);
      jaw.rotation.x = 0.62 * j;
      mouthIn.scale.y = 0.012 * (0.4 + 1.4 * j);
      mouthIn.visible = j > 0.04;
      for (const jw of jowls) jw.scale.y = 0.04 * (1 + 0.08 * j);
      puffs.forEach((pf, i) => { pf.position.y = -0.034 + 0.004 * j; pf.rotation.z = (i ? -1 : 1) * 0.15 * j; });
      // eyes: lids (expression + blinks), gaze, pupil size
      const blink = Math.max(p.blink, autoBlink(t) * (1 - p.squint));
      const closed = clamp(Math.max(p.lid, blink) + 0.35 * p.squint * (1 - blink));
      for (const e of eyes) {
        e.up.rotation.x = -1.15 + closed * 2.72 - 0.15 * j * (1 - closed);
        e.lo.rotation.x = Math.PI + lerp(1.35, 0.35, clamp(p.squint + 0.25 * j)) * (1 - 0.0 * closed);
        e.pg.rotation.set(-p.eyeY * 0.35, p.eyeX * 0.4, 0);
        const ps = lerp(0.75, 1.25, p.pupil);
        e.pupil.scale.set(0.36 * ps, 0.4 * ps, 0.28);
      }
      for (const e of ears) {
        const f = flick(t, e.sx);
        e.g.rotation.set(-0.1 + 0.15 * p.earFwd - 0.95 * p.earFlat - 0.3 * f, 0.2 * e.sx * p.earSide, -0.28 * e.sx - 0.9 * e.sx * p.earFlat - 0.5 * e.sx * p.earSide - 0.25 * e.sx * f, 'XYZ');
      }

      // legs (short and stubby)
      for (let li = 0; li < 4; li++) {
        const Lg = legs[li];
        const { sx, front } = Lg;
        const off = front ? (sx > 0 ? 0.25 : 0.75) : (sx > 0 ? 0.0 : 0.5);
        const ph = (((p.phase + off) % 1) + 1) % 1;
        const duty = 0.6;
        let dz = 0, lift = 0;
        if (ph < duty) dz = p.stride * (0.5 - ph / duty);
        else { const s = (ph - duty) / (1 - duty); const e = s * s * (3 - 2 * s); dz = p.stride * (-0.5 + e); lift = 0.04 * Math.sin(Math.PI * s); }
        dz *= p.walk;
        lift *= p.walk;
        const anchor = front ? P[3] : P[1];
        const hip = anchor.clone().add(front ? V(0.034 * sx, -0.04, -0.005) : V(0.04 * sx, -0.03, 0.012));
        let paw;
        if (front) {
          const st = V(0.042 * sx, 0, 0.1 + dz), si = V(0.034 * sx, 0, 0.07), lie = V(0.04 * sx, 0.014, 0.15);
          paw = vl(vl(st, si, p.sit), lie, p.lie);
          paw.y += lift;
          paw.z += 0.012 * p.arch;
          const wrist = paw.clone().add(V(0, 0.024 * (1 - p.lie), -0.004));
          const [el, wr] = ik2(hip, wrist, 0.06, 0.06, V(0, 0.2, -1));
          Lg.L.update([hip.clone().add(V(0, 0.02, 0)), el, wr, paw.clone().add(V(0, 0.012, 0.006))],
            profile([[0, 0.03, 0.03, 0.03], [0.12, 0.034, 0.034, 0.035], [0.5, 0.024, 0.024, 0.025], [0.85, 0.021, 0.021, 0.021], [1, 0.02, 0.02, 0.02]]), V(0, 0, 1));
        } else {
          const st = V(0.046 * sx, 0, -0.15 + dz), si = V(0.062 * sx, 0, -0.01), lie = V(0.07 * sx, 0.014, -0.05);
          paw = vl(vl(st, si, p.sit), lie, p.lie);
          paw.y += lift;
          paw.z -= 0.02 * p.arch;
          const hock = vl(paw.clone().add(V(0, 0.048, -0.022)), paw.clone().add(V(0.005 * sx, 0.018, -0.07)), Math.max(p.sit, p.lie));
          hock.y += lift * 0.6;
          const [kn, hk] = ik2(hip, hock, 0.066, 0.068, V(0, 0, 1));
          Lg.L.update([hip.clone().add(V(0, 0.02, -0.01)), kn, hk, paw.clone().add(V(0, 0.012, -0.004))],
            profile([[0, 0.04, 0.04, 0.04], [0.12, 0.048, 0.048, 0.05], [0.35, 0.04, 0.04, 0.043], [0.6, 0.026, 0.026, 0.027], [0.8, 0.02, 0.02, 0.021], [1, 0.02, 0.02, 0.02]]), V(0, 0, 1));
        }
        Lg.paw.position.copy(paw).add(V(0, 0.013, 0.012));
        Lg.paw.scale.set(0.024, 0.015, 0.03);
        cat.world['paw' + li] = paw;
      }
      const tb = P[0].clone().add(V(0, 0.012, -0.01));
      tail.update(tailPts(p, tb), tailProf(p.tailPuff), V(0, 1, 0));
      root.updateMatrixWorld(true);
    },
    headWorld() { return head.getWorldPosition(V()); },
  };
  cat.setPose({});
  return cat;
}
