import * as THREE from 'three';
import { canvasTexture, rng, clamp, lerp } from './util.js';
import { Loft, profile, furShells } from './loft.js';

// ---------------------------------------------------------------------------
// Domestic cat, procedural rig. Units: metres. Local axes: forward +Z, up +Y,
// root on the floor under the body centre. Body ≈ 46 cm, shoulder ≈ 25 cm.
// The torso, legs and tail are lofts rebuilt every frame; legs use 2-bone IK
// toward paw targets (walk gait, sit, lie); the head is an articulated group.
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

// ---- coat textures ---------------------------------------------------------
const COATS = {
  ginger: { base: '#d1823c', dark: '#9c4f1f', mid: '#b8682c', white: '#f3eadf', belly: '#f0ddc4', stripes: 1, whiteChest: 1, iris: ['#b8c75a', '#6f8a2a'], nose: '#d98a86' },
  grey: { base: '#7b828c', dark: '#4f555e', mid: '#666d77', white: '#c9ccd1', belly: '#9aa0a8', stripes: 0.45, whiteChest: 0, iris: ['#e8b543', '#b0701c'], nose: '#6c6266' },
};
function bodyTex(c, seed) {
  const r = rng(seed);
  return canvasTexture(1024, 512, (g, w, h) => {
    g.fillStyle = c.base;
    g.fillRect(0, 0, w, h);
    // darker along the spine (v = 0.5 is dorsal → canvas middle row)
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, c.belly);
    gr.addColorStop(0.2, c.base);
    gr.addColorStop(0.5, c.mid);
    gr.addColorStop(0.8, c.base);
    gr.addColorStop(1, c.belly);
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    // tabby stripes (bands across the body)
    g.globalAlpha = 0.75 * c.stripes;
    for (let i = 0; i < 26; i++) {
      const x0 = (i / 26) * w * 0.95 + r() * 14;
      g.fillStyle = c.dark;
      g.beginPath();
      const wd = 9 + r() * 10;
      for (let y = h * 0.17; y <= h * 0.83; y += 6) {
        const xx = x0 + Math.sin(y * 0.03 + i) * 10 + (Math.abs(y - h / 2) / h) * 18 * (r() - 0.5);
        g.lineTo(xx, y);
      }
      for (let y = h * 0.83; y >= h * 0.17; y -= 6) g.lineTo(x0 + wd + Math.sin(y * 0.03 + i + 1) * 9, y);
      g.fill();
    }
    g.globalAlpha = 1;
    // white chest / belly patch toward the front (u > 0.62) and under the belly
    if (c.whiteChest) {
      g.fillStyle = c.white;
      g.beginPath();
      g.ellipse(w, 0, w * 0.42, h * 0.3, 0, 0, Math.PI * 2);
      g.ellipse(w, h, w * 0.42, h * 0.3, 0, 0, Math.PI * 2);
      g.fill();
      g.fillRect(w * 0.15, 0, w * 0.85, h * 0.08);
      g.fillRect(w * 0.15, h * 0.92, w * 0.85, h * 0.08);
    }
    // fine hair streaks
    for (let i = 0; i < 9000; i++) {
      const x = r() * w, y = r() * h;
      g.strokeStyle = r() < 0.5 ? 'rgba(255,240,220,0.10)' : 'rgba(40,20,5,0.12)';
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x - 6 - r() * 6, y + (r() - 0.5) * 3);
      g.stroke();
    }
  });
}
function legTex(c, seed) {
  const r = rng(seed);
  return canvasTexture(512, 128, (g, w, h) => {
    g.fillStyle = c.base;
    g.fillRect(0, 0, w, h);
    g.globalAlpha = 0.6 * c.stripes;
    g.fillStyle = c.dark;
    for (let i = 0; i < 5; i++) g.fillRect(w * (0.12 + i * 0.1) + r() * 6, h * 0.15, 10 + r() * 6, h * 0.7);
    g.globalAlpha = 1;
    const gr = g.createLinearGradient(w * 0.55, 0, w * 0.7, 0);
    gr.addColorStop(0, c.whiteChest ? 'rgba(243,234,223,0)' : 'rgba(0,0,0,0)');
    gr.addColorStop(1, c.whiteChest ? c.white : c.base);
    g.fillStyle = gr;
    g.fillRect(w * 0.55, 0, w * 0.45, h);
    for (let i = 0; i < 2500; i++) {
      const x = r() * w, y = r() * h;
      g.strokeStyle = r() < 0.5 ? 'rgba(255,240,220,0.10)' : 'rgba(40,20,5,0.12)';
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 5 + r() * 5, y + (r() - 0.5) * 2);
      g.stroke();
    }
  });
}
function headTex(c, seed) {
  // sphere UV: front of the head (+z) is u = 0.25 (canvas x = w/4); top is canvas y = 0
  const r = rng(seed);
  return canvasTexture(512, 256, (g, w, h) => {
    g.fillStyle = c.base;
    g.fillRect(0, 0, w, h);
    g.fillStyle = c.mid;
    g.fillRect(0, 0, w, h * 0.25);
    g.globalAlpha = 0.8 * c.stripes;
    g.fillStyle = c.dark;
    // forehead "M" and stripes over the crown
    for (const dx of [-26, -9, 9, 26]) {
      g.beginPath();
      g.ellipse(w * 0.25 + dx, h * 0.24, 4.5, h * 0.17, dx * 0.012, 0, Math.PI * 2);
      g.fill();
    }
    for (const dx of [-60, 60, -95, 95]) {
      g.beginPath();
      g.ellipse(w * 0.25 + dx, h * 0.3, 6, h * 0.18, 0.2 * Math.sign(dx), 0, Math.PI * 2);
      g.fill();
    }
    // cheek stripes
    for (const dx of [-48, 48]) {
      g.beginPath();
      g.ellipse(w * 0.25 + dx, h * 0.55, 18, 3, 0.5 * Math.sign(dx), 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    for (let i = 0; i < 2500; i++) {
      const x = r() * w, y = r() * h;
      g.strokeStyle = r() < 0.5 ? 'rgba(255,240,220,0.10)' : 'rgba(40,20,5,0.12)';
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (r() - 0.5) * 3, y + 4 + r() * 4);
      g.stroke();
    }
  });
}
function irisTex(c) {
  return canvasTexture(256, 128, (g, w, h) => {
    // sphere UV: front (+z) at u = 0.25
    g.fillStyle = c.iris[1];
    g.fillRect(0, 0, w, h);
    const cx = w * 0.25, cy = h * 0.5;
    const gr = g.createRadialGradient(cx, cy, 2, cx, cy, h * 0.42);
    gr.addColorStop(0, c.iris[1]);
    gr.addColorStop(0.55, c.iris[0]);
    gr.addColorStop(0.92, c.iris[1]);
    gr.addColorStop(1, '#2a2010');
    g.fillStyle = gr;
    g.beginPath();
    g.ellipse(cx, cy, h * 0.3, h * 0.5, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(255,255,220,0.25)';
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * 8, cy + Math.sin(a) * 16);
      g.lineTo(cx + Math.cos(a) * h * 0.2, cy + Math.sin(a) * h * 0.42);
      g.stroke();
    }
  });
}
let STRAND = null;
function strandTex() {
  if (STRAND) return STRAND;
  const r = rng(99);
  STRAND = canvasTexture(256, 256, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      const v = Math.pow(r(), 0.7) * 255;
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, { srgb: false, repeat: [10, 5] });
  STRAND.magFilter = THREE.NearestFilter;
  return STRAND;
}

export function createCat({ coat = 'ginger', seed = 1, scale = 1 } = {}) {
  const C = COATS[coat];
  const root = new THREE.Group();
  const inner = new THREE.Group(); // scaled container
  inner.scale.setScalar(scale);
  root.add(inner);
  const furMat = new THREE.MeshStandardMaterial({ map: bodyTex(C, seed), roughness: 0.88 });
  const headMat = new THREE.MeshStandardMaterial({ map: headTex(C, seed + 1), roughness: 0.88 });
  const legMat = new THREE.MeshStandardMaterial({ map: legTex(C, seed + 2), roughness: 0.9 });
  const white = new THREE.MeshStandardMaterial({ color: C.whiteChest ? '#e6d6c0' : C.base, roughness: 0.95 });
  const pink = new THREE.MeshStandardMaterial({ color: '#c97a78', roughness: 0.55 });
  const mouthMat = new THREE.MeshStandardMaterial({ color: '#5a1f22', roughness: 0.6 });
  const noseMat = new THREE.MeshPhysicalMaterial({ color: C.nose, roughness: 0.35, clearcoat: 0.5 });
  const strands = strandTex();
  const shadowy = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };
  const withShells = (geo, mat, n, len, parent) => {
    const base = shadowy(new THREE.Mesh(geo, mat));
    parent.add(base);
    for (const sm of furShells(mat, strands, n, len)) {
      const s = new THREE.Mesh(geo, sm);
      s.receiveShadow = true;
      s.frustumCulled = false;
      base.add(s);
    }
    base.frustumCulled = false;
    return base;
  };

  // ---- torso loft (rump → neck) ----
  const body = new Loft(44, 36);
  withShells(body.geo, furMat, 6, 0.009, inner);
  const bodyProf = profile([
    [0, 0.004, 0.004, 0.004], [0.05, 0.05, 0.05, 0.05], [0.14, 0.068, 0.07, 0.072], [0.3, 0.064, 0.068, 0.07],
    [0.48, 0.06, 0.064, 0.074], [0.64, 0.066, 0.07, 0.085], [0.8, 0.06, 0.066, 0.08], [0.92, 0.042, 0.048, 0.05], [1, 0.034, 0.038, 0.04],
  ]);
  // ---- tail ----
  const tail = new Loft(28, 16);
  withShells(tail.geo, furMat, 5, 0.01, inner);
  // ---- legs ----
  const legs = [];
  for (const [sx, front] of [[1, true], [-1, true], [1, false], [-1, false]]) {
    const L = new Loft(22, 16);
    withShells(L.geo, legMat, 3, 0.005, inner);
    const paw = shadowy(new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), white));
    inner.add(paw);
    legs.push({ sx, front, L, paw });
  }

  // ---- head ----
  const head = new THREE.Group();
  inner.add(head);
  const S = new THREE.SphereGeometry(1, 40, 28);
  const cran = withShells(S, headMat, 5, 0.005 / 0.05, head);
  cran.position.set(0, 0.008, -0.006);
  cran.scale.set(0.05, 0.045, 0.048);
  for (const sx of [-1, 1]) {
    const ch = withShells(S, headMat, 4, 0.005 / 0.03, head);
    ch.position.set(0.022 * sx, -0.017, 0.012);
    ch.scale.set(0.03, 0.026, 0.03);
    const pad = shadowy(new THREE.Mesh(S, white));
    pad.position.set(0.009 * sx, -0.0215, 0.042);
    pad.scale.set(0.0105, 0.0085, 0.0095);
    head.add(pad);
  }
  const bridge = shadowy(new THREE.Mesh(S, headMat));
  bridge.position.set(0, -0.003, 0.038);
  bridge.scale.set(0.011, 0.011, 0.019);
  head.add(bridge);
  const nose = shadowy(new THREE.Mesh(S, noseMat));
  nose.position.set(0, -0.0115, 0.0555);
  nose.scale.set(0.0062, 0.0045, 0.0038);
  head.add(nose);
  // jaw + mouth
  const jaw = new THREE.Group();
  jaw.position.set(0, -0.027, 0.018);
  head.add(jaw);
  const chin = shadowy(new THREE.Mesh(S, white));
  chin.position.set(0, -0.005, 0.021);
  chin.scale.set(0.012, 0.0065, 0.016);
  jaw.add(chin);
  const mouthIn = new THREE.Mesh(S, mouthMat);
  mouthIn.position.set(0, -0.001, 0.021);
  mouthIn.scale.set(0.011, 0.005, 0.016);
  jaw.add(mouthIn);
  const tongue = new THREE.Mesh(S, pink);
  tongue.position.set(0, -0.0015, 0.024);
  tongue.scale.set(0.0075, 0.0025, 0.011);
  jaw.add(tongue);
  const upperMouth = new THREE.Mesh(S, mouthMat);
  upperMouth.position.set(0, -0.029, 0.04);
  upperMouth.scale.set(0.012, 0.004, 0.013);
  head.add(upperMouth);
  const fangGeo = new THREE.ConeGeometry(0.0017, 0.006, 6);
  fangGeo.rotateX(Math.PI);
  for (const sx of [-1, 1]) {
    const f = new THREE.Mesh(fangGeo, new THREE.MeshStandardMaterial({ color: '#f4efe6', roughness: 0.3 }));
    f.position.set(0.0065 * sx, -0.0315, 0.049);
    head.add(f);
  }
  // eyes + lids
  const iris = irisTex(C);
  const eyes = [];
  for (const sx of [-1, 1]) {
    const eg = new THREE.Group();
    eg.position.set(0.0205 * sx, 0.007, 0.036);
    eg.rotation.y = 0.3 * sx;
    head.add(eg);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.0125, 32, 20), new THREE.MeshStandardMaterial({ map: iris, roughness: 0.4 }));
    ball.scale.z = 0.85;
    eg.add(ball);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: '#050404' }));
    pupil.position.z = 0.0098;
    eg.add(pupil);
    const cornea = new THREE.Mesh(new THREE.SphereGeometry(0.0131, 32, 20), new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.02, transmission: 0, transparent: true, opacity: 0.12, clearcoat: 1, specularIntensity: 1 }));
    cornea.scale.z = 0.88;
    eg.add(cornea);
    const lidGeo = new THREE.SphereGeometry(0.0138, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const up = shadowy(new THREE.Mesh(lidGeo, headMat));
    const lo = shadowy(new THREE.Mesh(lidGeo, headMat));
    lo.rotation.x = Math.PI;
    eg.add(up, lo);
    eyes.push({ eg, pupil, up, lo, sx });
  }
  // ears: half-cone shells, opening forward
  const earGeo = new THREE.ConeGeometry(1, 1, 16, 1, true, Math.PI / 2, Math.PI);
  earGeo.translate(0, 0.5, 0);
  const earIn = new THREE.MeshStandardMaterial({ color: '#d79a8e', roughness: 0.7, side: THREE.DoubleSide });
  const earOut = headMat.clone();
  earOut.side = THREE.DoubleSide;
  const ears = [];
  for (const sx of [-1, 1]) {
    const g = new THREE.Group();
    g.position.set(0.026 * sx, 0.036, -0.01);
    head.add(g);
    const o = shadowy(new THREE.Mesh(earGeo, earOut));
    o.scale.set(0.022, 0.046, 0.013);
    const i = new THREE.Mesh(earGeo, earIn);
    i.scale.set(0.018, 0.039, 0.009);
    i.position.set(0, 0.002, 0.003);
    g.add(o, i);
    ears.push({ g, sx });
  }
  // whiskers
  const wpos = [];
  for (const sx of [-1, 1]) for (let k = 0; k < 6; k++) {
    const y0 = -0.021 - 0.0025 * (k % 3), a = -0.25 + 0.1 * k;
    let p = V(0.014 * sx, y0, 0.049);
    let d = V(0.9 * sx, Math.sin(a) * 0.5 - 0.1, 0.25).normalize();
    for (let s = 0; s < 4; s++) {
      const q = p.clone().addScaledVector(d, 0.018);
      wpos.push(p.x, p.y, p.z, q.x, q.y, q.z);
      d.y -= 0.12;
      d.normalize();
      p = q;
    }
  }
  const wg = new THREE.BufferGeometry();
  wg.setAttribute('position', new THREE.Float32BufferAttribute(wpos, 3));
  head.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: '#f6f1e8', transparent: true, opacity: 0.75 })));

  // ======================= pose =========================
  const UPV = V(0, 1, 0);
  function spine(p) {
    const st = [V(0, 0.2, -0.22), V(0, 0.205, -0.15), V(0, 0.198, -0.02), V(0, 0.205, 0.1), V(0, 0.25, 0.18)];
    const si = [V(0, 0.065, -0.15), V(0, 0.09, -0.115), V(0, 0.15, -0.055), V(0, 0.215, 0.0), V(0, 0.26, 0.045)];
    const li = [V(0, 0.085, -0.22), V(0, 0.09, -0.15), V(0, 0.095, -0.02), V(0, 0.103, 0.1), V(0, 0.15, 0.17)];
    let P = st.map((v, i) => vl(v, si[i], p.sit));
    P = P.map((v, i) => vl(v, li[i], p.lie));
    // hiss arch: back up, stiff legs
    P[2].y += 0.07 * p.arch;
    P[1].y += 0.03 * p.arch;
    P[3].y += 0.02 * p.arch;
    // crouch (low, eating / sniffing)
    for (let i = 1; i < 5; i++) P[i].y -= 0.05 * p.crouch * (i / 4);
    P[4].z += 0.03 * p.crouch;
    // lateral bend (rubbing, turning)
    P[0].x -= 0.04 * p.bend;
    P[2].x += 0.03 * p.bend;
    P[4].x -= 0.05 * p.bend;
    // walk bob
    const bob = -0.006 * Math.cos(4 * Math.PI * p.phase) * p.walk;
    for (const v of P) v.y += bob;
    // breathing / purr
    return P;
  }
  function tailPts(p, base) {
    const n = 9, segL = 0.032;
    const pts = [base.clone()];
    const elev = lerp(-1.25, 1.45, p.tailUp);
    let dir = V(0, Math.sin(elev), -Math.cos(elev));
    const side = V(1, 0, 0);
    for (let i = 1; i < n; i++) {
      const f = i / (n - 1);
      // bend: curl toward the tip (hook), sway (traveling wave)
      const q1 = new THREE.Quaternion().setFromAxisAngle(side, -p.tailCurl * 0.5 * f * f);
      const q2 = new THREE.Quaternion().setFromAxisAngle(UPV, p.tailSwish * 0.55 * Math.sin(p.tailPhase - i * 0.55) * f);
      dir.applyQuaternion(q1).applyQuaternion(q2).normalize();
      pts.push(pts[i - 1].clone().addScaledVector(dir, segL));
    }
    if (p.tailWrap > 0) {
      // lying on the floor curling around the body's right side toward the front paws
      const w = [base.clone(), V(0.03, 0.03, -0.24), V(0.08, 0.018, -0.2), V(0.12, 0.016, -0.12), V(0.135, 0.016, -0.03), V(0.125, 0.016, 0.06), V(0.09, 0.016, 0.12), V(0.04, 0.016, 0.15), V(-0.01, 0.016, 0.155)];
      if (p.lie > 0) {
        const l = [base.clone(), V(0.05, 0.035, -0.27), V(0.11, 0.022, -0.22), V(0.14, 0.02, -0.12), V(0.15, 0.02, -0.02), V(0.14, 0.02, 0.07), V(0.11, 0.02, 0.14), V(0.06, 0.02, 0.18), V(0.0, 0.02, 0.19)];
        w.forEach((v, i) => v.lerp(l[i], p.lie));
      }
      for (let i = 1; i < n; i++) pts[i].lerp(w[i], p.tailWrap);
    }
    return pts;
  }
  const tailProf = (puff) => (u) => { const r = lerp(0.021, 0.012, u) * (1 + puff * (1.1 - 0.4 * u)) * (u > 0.94 ? Math.sqrt((1 - u) / 0.06) * 0.8 + 0.2 : 1); return [r, r, r]; };

  const cat = {
    root, head, inner,
    world: {},
    setPose(o) {
      const p = Object.assign({
        t: 0, walk: 0, phase: 0, stride: 0.11, sit: 0, lie: 0, arch: 0, crouch: 0, bend: 0,
        headYaw: 0, headPitch: 0, headRoll: 0, reach: 0, jaw: 0, earFwd: 0.5, earFlat: 0, earSide: 0,
        blink: 0, lid: 0, pupil: 0.45, tailUp: 0.6, tailCurl: 0.4, tailSwish: 0.15, tailPhase: 0, tailPuff: 0, tailWrap: 0,
        breathe: 0, purr: 0, furPuff: 0,
      }, o);
      const t = p.t;
      p.tailPhase = p.tailPhase || t * 2.2;
      const P = spine(p);
      const br = 1 + 0.025 * Math.sin(p.breathe) + 0.012 * p.purr * Math.sin(t * 50) + 0.25 * p.furPuff;
      body.update(P, (u) => { const r = bodyProf(u); const k = u > 0.3 && u < 0.85 ? br : 1 + (br - 1) * 0.4; return [r[0] * k, r[1] * k, r[2] * k]; }, (u) => (p.lie > 0.5 && u < 0.3 ? V(0, 1, 0) : UPV));

      // head
      const nk = P[4];
      const nd = P[4].clone().sub(P[3]).normalize();
      const hp = nk.clone().addScaledVector(nd, 0.03).add(V(0, 0.022, 0.012)).add(V(0, -0.01, 0.04).multiplyScalar(p.reach));
      head.position.copy(hp);
      head.rotation.set(p.headPitch, p.headYaw, p.headRoll, 'YXZ');
      jaw.rotation.x = 0.55 * p.jaw;
      upperMouth.visible = p.jaw > 0.05;
      for (const e of eyes) {
        const closed = clamp(Math.max(p.blink, p.lid));
        e.up.visible = e.lo.visible = closed > 0.02;
        e.up.rotation.x = lerp(-1.5, -0.05, closed);
        e.lo.rotation.x = Math.PI + lerp(1.3, 0.35, closed);
        e.pupil.scale.set(lerp(0.0011, 0.0062, p.pupil), 0.0094, 0.003);
      }
      for (const e of ears) {
        e.g.rotation.set(-0.15 + 0.2 * p.earFwd - 0.9 * p.earFlat, 0.25 * e.sx * p.earSide, -0.22 * e.sx - 0.85 * e.sx * p.earFlat - 0.5 * e.sx * p.earSide, 'XYZ');
      }

      // legs
      const fwd = V(0, 0, 1);
      for (let li = 0; li < 4; li++) {
        const Lg = legs[li];
        const { sx, front } = Lg;
        const off = front ? (sx > 0 ? 0.25 : 0.75) : (sx > 0 ? 0.0 : 0.5);
        const ph = (((p.phase + off) % 1) + 1) % 1;
        const duty = 0.62;
        let dz = 0, lift = 0;
        if (ph < duty) dz = p.stride * (0.5 - ph / duty);
        else { const s = (ph - duty) / (1 - duty); const e = s * s * (3 - 2 * s); dz = p.stride * (-0.5 + e); lift = 0.035 * Math.sin(Math.PI * s); }
        dz *= p.walk;
        lift *= p.walk;
        const anchor = front ? P[3] : P[1];
        const hip = anchor.clone().add(front ? V(0.03 * sx, -0.045, -0.005) : V(0.034 * sx, -0.035, 0.01));
        let paw, hock;
        if (front) {
          const st = V(0.038 * sx, 0, 0.11 + dz), si = V(0.03 * sx, 0, 0.075), lie = V(0.035 * sx, 0.012, 0.15);
          paw = vl(vl(st, si, p.sit), lie, p.lie);
          paw.y += lift;
          paw.z += 0.012 * p.arch;
          const wrist = paw.clone().add(V(0, 0.028 * (1 - p.lie), -0.004));
          const [el, wr] = ik2(hip, wrist, 0.088, 0.088, V(0, 0.2, -1));
          Lg.L.update([hip.clone().add(V(-0.01 * sx, 0.04, 0.01)), hip, el, wr, paw.clone().add(V(0, 0.01, 0.006))],
            profile([[0, 0.01, 0.01, 0.01], [0.1, 0.027, 0.027, 0.029], [0.2, 0.026, 0.026, 0.028], [0.5, 0.0165, 0.0165, 0.017], [0.82, 0.0125, 0.0125, 0.013], [1, 0.012, 0.012, 0.012]]), fwd);
        } else {
          const st = V(0.042 * sx, 0, -0.17 + dz), si = V(0.06 * sx, 0, -0.02), lie = V(0.065 * sx, 0.012, -0.05);
          paw = vl(vl(st, si, p.sit), lie, p.lie);
          paw.y += lift;
          paw.z -= 0.02 * p.arch;
          hock = vl(paw.clone().add(V(0, 0.06, -0.026)), paw.clone().add(V(0.005 * sx, 0.016, -0.085)), Math.max(p.sit, p.lie));
          hock.y += lift * 0.6;
          const [kn, hk] = ik2(hip, hock, 0.09, 0.095, V(0, 0, 1));
          Lg.L.update([hip.clone().add(V(-0.012 * sx, 0.045, -0.02)), hip, kn, hk, paw.clone().add(V(0, 0.01, -0.004))],
            profile([[0, 0.012, 0.012, 0.012], [0.1, 0.034, 0.034, 0.036], [0.22, 0.034, 0.034, 0.038], [0.5, 0.021, 0.021, 0.023], [0.75, 0.0125, 0.0125, 0.014], [1, 0.012, 0.012, 0.012]]), V(0, 0, 1));
        }
        Lg.paw.position.copy(paw).add(V(0, 0.0095, 0.01));
        Lg.paw.scale.set(0.016, 0.0105, 0.021);
        Lg.paw.rotation.x = front ? 0 : -0.05;
        cat.world['paw' + li] = paw;
      }

      // tail
      const tb = P[0].clone().add(V(0, 0.01, -0.01));
      tail.update(tailPts(p, tb), tailProf(p.tailPuff), V(0, 1, 0));
      root.updateMatrixWorld(true);
    },
    headWorld() { return head.getWorldPosition(V()); },
    mouthWorld() { return head.localToWorld(V(0, -0.03, 0.06)); },
    eyeWorld() { return head.localToWorld(V(0, 0.006, 0.05)); },
  };
  cat.setPose({});
  return cat;
}
