import * as THREE from 'three';
import { canvasTexture, rng, clamp, lerp } from './util.js';
import { Loft, profile, furShells } from './loft.js';

// ---------------------------------------------------------------------------
// Golden retriever, procedural rig. Metres; local forward +Z, up +Y, root on
// the floor under the body. Shoulder ≈ 0.56 m, body ≈ 0.8 m.
// Torso+neck, legs and tail are lofts rebuilt every frame and covered with
// fur shells; legs use 2-bone IK toward paw targets (walk, sit, sniff).
// Head: long muzzle, wet nose with moving nostrils, floppy ears that swing
// with gravity, brown eyes with lids and expressive brows, opening jaw.
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
  return [a.clone().addScaledVector(dir, l1 * cosA).addScaledVector(perp, l1 * Math.sqrt(1 - cosA * cosA)), a.clone().addScaledVector(dir, L)];
}

const C = { base: '#d49a52', light: '#efcf98', dark: '#a8682c', nose: '#1a1412' };

// u along the loft (canvas x), v around (dorsal = middle row): darker saddle, light underside
function coatTex(seed, { lightEnd = 0, darkBack = 1 } = {}) {
  const r = rng(seed);
  return canvasTexture(1024, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, C.light);
    gr.addColorStop(0.22, C.base);
    gr.addColorStop(0.5, darkBack ? '#c4853f' : C.base);
    gr.addColorStop(0.78, C.base);
    gr.addColorStop(1, C.light);
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    if (lightEnd) {
      const gx = g.createLinearGradient(w * (1 - lightEnd), 0, w, 0);
      gx.addColorStop(0, 'rgba(239,207,152,0)');
      gx.addColorStop(1, 'rgba(239,207,152,0.9)');
      g.fillStyle = gx;
      g.fillRect(0, 0, w, h);
    }
    // hair streaks along the body
    for (let i = 0; i < 14000; i++) {
      const x = r() * w, y = r() * h, l = 6 + r() * 14;
      g.strokeStyle = r() < 0.5 ? `rgba(255,236,200,${0.06 + r() * 0.08})` : `rgba(110,60,20,${0.06 + r() * 0.1})`;
      g.lineWidth = 1 + r();
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x - l, y + (r() - 0.5) * 4);
      g.stroke();
    }
  });
}
function headTex(seed) {
  const r = rng(seed);
  return canvasTexture(512, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#c98d48');
    gr.addColorStop(0.6, C.base);
    gr.addColorStop(1, C.light);
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 5000; i++) {
      const x = r() * w, y = r() * h;
      g.strokeStyle = r() < 0.5 ? 'rgba(255,236,200,0.08)' : 'rgba(110,60,20,0.1)';
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (r() - 0.5) * 3, y + 4 + r() * 5);
      g.stroke();
    }
  });
}
function irisTex() {
  return canvasTexture(256, 128, (g, w, h) => {
    g.fillStyle = '#2a170c';
    g.fillRect(0, 0, w, h);
    const cx = w * 0.25, cy = h * 0.5;
    const gr = g.createRadialGradient(cx, cy, 2, cx, cy, h * 0.45);
    gr.addColorStop(0, '#050302');
    gr.addColorStop(0.36, '#050302');
    gr.addColorStop(0.42, '#6b3a17');
    gr.addColorStop(0.75, '#8a5122');
    gr.addColorStop(1, '#2a170c');
    g.fillStyle = gr;
    g.beginPath();
    g.ellipse(cx, cy, h * 0.42, h * 0.46, 0, 0, Math.PI * 2);
    g.fill();
  });
}
function strandTex(rep) {
  const r = rng(77);
  const t = canvasTexture(256, 256, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      const v = Math.pow(r(), 0.65) * 255;
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, { srgb: false, repeat: rep });
  t.magFilter = THREE.NearestFilter;
  return t;
}

export function createDog({ seed = 3 } = {}) {
  const root = new THREE.Group();
  const inner = new THREE.Group();
  root.add(inner);
  const furMat = new THREE.MeshStandardMaterial({ map: coatTex(seed), roughness: 0.85 });
  const legMat = new THREE.MeshStandardMaterial({ map: coatTex(seed + 1, { lightEnd: 0.5, darkBack: 0 }), roughness: 0.85 });
  const tailMat = new THREE.MeshStandardMaterial({ map: coatTex(seed + 2, { darkBack: 0 }), roughness: 0.85 });
  const headMat = new THREE.MeshStandardMaterial({ map: coatTex(seed + 3, { lightEnd: 0.3 }), roughness: 0.85 });
  const muzzleMat = new THREE.MeshStandardMaterial({ color: '#dcb27a', roughness: 0.85 });
  const earMat = new THREE.MeshStandardMaterial({ color: '#b97a3a', roughness: 0.85, side: THREE.DoubleSide });
  const lipMat = new THREE.MeshStandardMaterial({ color: '#2a1d18', roughness: 0.5 });
  const noseMat = new THREE.MeshPhysicalMaterial({ color: C.nose, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.15 });
  const pink = new THREE.MeshStandardMaterial({ color: '#d97b84', roughness: 0.45 });
  const mouthMat = new THREE.MeshStandardMaterial({ color: '#5a2228', roughness: 0.6 });
  const sh = (m) => { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; return m; };
  const S = new THREE.SphereGeometry(1, 48, 32);
  const shells = (geo, mat, n, len, parent, tex) => {
    const base = sh(new THREE.Mesh(geo, mat));
    parent.add(base);
    for (const m of furShells(mat, tex, n, len, 0.6)) {
      const s = new THREE.Mesh(geo, m);
      s.receiveShadow = true;
      s.frustumCulled = false;
      base.add(s);
    }
    return base;
  };
  const bodyStr = strandTex([18, 9]);
  const smallStr = strandTex([8, 4]);

  // ---- torso + neck ----
  const body = new Loft(56, 44);
  shells(body.geo, furMat, 6, 0.016, inner, bodyStr);
  const bodyProf = profile([
    [0, 0.01, 0.01, 0.01], [0.04, 0.09, 0.09, 0.09], [0.12, 0.125, 0.11, 0.12], [0.3, 0.12, 0.1, 0.14],
    [0.5, 0.13, 0.105, 0.19], [0.66, 0.125, 0.1, 0.18], [0.76, 0.1, 0.09, 0.12], [0.88, 0.08, 0.08, 0.085], [0.96, 0.06, 0.06, 0.06], [1, 0.02, 0.02, 0.02],
  ]);
  // ---- tail (feathered) ----
  const tail = new Loft(30, 20);
  shells(tail.geo, tailMat, 7, 0.03, inner, smallStr);
  // ---- legs ----
  const legs = [];
  for (const [sx, front] of [[1, true], [-1, true], [1, false], [-1, false]]) {
    const L = new Loft(24, 22);
    shells(L.geo, legMat, 4, 0.01, inner, smallStr);
    const paw = sh(new THREE.Mesh(S, legMat));
    inner.add(paw);
    legs.push({ sx, front, L, paw });
  }

  // ---- head ----
  const headPivot = new THREE.Group();
  inner.add(headPivot);
  const head = new THREE.Group();
  head.scale.setScalar(1.32);
  headPivot.add(head);
  const add = (geo, mat, parent, pos, scl, rot) => { const m = sh(new THREE.Mesh(geo, mat)); m.position.set(...pos); m.scale.set(...scl); if (rot) m.rotation.set(...rot); parent.add(m); return m; };
  const headStr = strandTex([6, 3]);
  // one continuous surface from the back of the skull to the nose: broad skull,
  // a clear stop, a long slightly tapering muzzle with fuller lips underneath
  const hl = new Loft(46, 44);
  hl.update([V(0, 0.02, -0.085), V(0, 0.028, -0.03), V(0, 0.022, 0.03), V(0, 0.0, 0.075), V(0, -0.012, 0.13), V(0, -0.014, 0.19)],
    profile([[0, 0.012, 0.012, 0.012], [0.07, 0.058, 0.058, 0.052], [0.28, 0.077, 0.071, 0.066], [0.42, 0.068, 0.058, 0.066], [0.55, 0.054, 0.04, 0.06],
      [0.72, 0.046, 0.035, 0.052], [0.9, 0.041, 0.031, 0.046], [0.97, 0.03, 0.025, 0.034], [1, 0.012, 0.012, 0.012]]), V(0, 1, 0));
  const headSurf = shells(hl.geo, headMat, 4, 0.006, head, headStr);
  const ghost = new THREE.Mesh(hl.geo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { a: { value: 0 } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform float a; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.5); gl_FragColor = vec4(vec3(0.55, 0.8, 1.0) * (0.04 + 0.7 * f) * a, 1.0); }',
  }));
  ghost.visible = false;
  head.add(ghost);
  const nose = add(S, noseMat, head, [0, -0.008, 0.19], [0.019, 0.014, 0.013]);
  const nostrils = [-1, 1].map((sx) => add(S, new THREE.MeshBasicMaterial({ color: '#000' }), head, [0.0085 * sx, -0.012, 0.2], [0.0042, 0.003, 0.0025]));
  // mouth line + lower jaw tucked under the muzzle
  for (const sx of [-1, 1]) add(S, lipMat, head, [0.036 * sx, -0.052, 0.075], [0.004, 0.0022, 0.028], [0, 0.3 * sx, 0]);
  const jaw = new THREE.Group();
  jaw.position.set(0, -0.045, 0.03);
  head.add(jaw);
  add(S, muzzleMat, jaw, [0, -0.008, 0.07], [0.03, 0.012, 0.062]);
  const mouthIn = add(S, mouthMat, head, [0, -0.055, 0.1], [0.026, 0.007, 0.055]);
  const tongue = add(S, pink, jaw, [0, -0.002, 0.08], [0.022, 0.005, 0.055]);
  // eyes, lids, brows
  const iris = irisTex();
  const eyes = [];
  for (const sx of [-1, 1]) {
    const eg = new THREE.Group();
    eg.position.set(0.056 * sx, 0.031, 0.05);
    eg.rotation.y = 0.5 * sx;
    head.add(eg);
    eg.add(new THREE.Mesh(new THREE.SphereGeometry(0.0145, 32, 20), new THREE.MeshPhysicalMaterial({ map: iris, roughness: 0.25, clearcoat: 0.6, clearcoatRoughness: 0.2 })));
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.0138, 0.0028, 8, 32), lipMat);
    rim.position.z = 0.006;
    eg.add(rim);

    const lidGeo = new THREE.SphereGeometry(0.0162, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const up = sh(new THREE.Mesh(lidGeo, headMat));
    const lo = sh(new THREE.Mesh(lidGeo, headMat));
    eg.add(up, lo);
    const brow = add(S, headMat, head, [0.05 * sx, 0.052, 0.046], [0.018, 0.007, 0.012], [0, 0, -0.25 * sx]);
    eyes.push({ sx, up, lo, brow });
  }
  // floppy ears: pivot at the top of the skull side, hanging down
  const earGeo = new THREE.SphereGeometry(1, 28, 20);
  earGeo.translate(0, -1, 0);
  const ears = [];
  for (const sx of [-1, 1]) {
    const piv = new THREE.Group();
    piv.position.set(0.066 * sx, 0.05, -0.012);
    head.add(piv);
    const flap = shells(earGeo, earMat, 3, 0.006 / 0.05, piv, headStr);
    flap.scale.set(0.016, 0.072, 0.052);
    ears.push({ sx, piv, flap });
  }

  // ---- x-ray anatomy (head-local, shown for the nose cross-section) ----
  const anat = new THREE.Group();
  anat.visible = false;
  head.add(anat);
  const glowM = (c, e = 0.6, o = 0.9) => new THREE.MeshStandardMaterial({ color: c, emissive: new THREE.Color(c), emissiveIntensity: e, transparent: true, opacity: o, depthWrite: false, roughness: 0.5 });
  const airway = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.15, 8, 24), glowM('#f2b8b0', 0.25, 0.22));
  airway.rotation.x = Math.PI / 2;
  airway.position.set(0, -0.014, 0.105);
  anat.add(airway);
  const scrollGeo = new THREE.TorusGeometry(0.011, 0.0021, 6, 28, 4.6);
  const scrolls = [];
  for (let i = 0; i < 8; i++) for (const sx of [-1, 1]) { // respiratory turbinates
    const m = new THREE.Mesh(scrollGeo, glowM('#e88a8a', 0.35, 0.85));
    m.position.set(0.007 * sx, -0.016 + 0.002 * Math.sin(i), 0.09 + i * 0.011);
    m.rotation.set(0, 0, i * 0.7 + (sx > 0 ? 0 : Math.PI));
    anat.add(m);
  }
  const olfMat = glowM('#ffcc55', 0.9, 0.95);
  for (let i = 0; i < 7; i++) for (const sx of [-1, 1]) { // olfactory (ethmo-)turbinates, upper back of the nose
    const m = new THREE.Mesh(new THREE.TorusGeometry(0.0085, 0.0019, 6, 24, 5), olfMat);
    m.position.set(0.006 * sx, 0.006 + 0.003 * Math.sin(i * 1.7), 0.04 + i * 0.0075);
    m.rotation.set(0.3, 0, i * 0.9 + (sx > 0 ? 0 : Math.PI));
    anat.add(m);
    scrolls.push(m);
  }
  const bulbMat = glowM('#ff9a3a', 1.0, 0.95);
  for (const sx of [-1, 1]) {
    const b = new THREE.Mesh(S, bulbMat);
    b.scale.set(0.0085, 0.009, 0.014);
    b.position.set(0.007 * sx, 0.022, 0.012);
    anat.add(b);
  }
  const brain = new THREE.Mesh(S, glowM('#f3c9c4', 0.2, 0.35));
  brain.scale.set(0.045, 0.038, 0.05);
  brain.position.set(0, 0.03, -0.035);
  anat.add(brain);
  // airflow: half of the motes go up to the smell region (gold), half down to the throat (blue)
  const NA = 90;
  const ag = new THREE.BufferGeometry();
  ag.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NA * 3), 3));
  ag.setAttribute('color', new THREE.BufferAttribute(new Float32Array(NA * 3), 3));
  const dotTex = canvasTexture(64, 64, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  const air = new THREE.Points(ag, new THREE.PointsMaterial({ size: 0.006, map: dotTex, vertexColors: true, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
  air.frustumCulled = false;
  anat.add(air);
  // nerve signals: olfactory region → bulb
  const NS = 14;
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NS * 3), 3));
  const sig = new THREE.Points(sg, new THREE.PointsMaterial({ size: 0.007, map: dotTex, color: new THREE.Color(3, 2.2, 0.8), transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
  sig.frustumCulled = false;
  anat.add(sig);
  const headMeshes = [], headShells = [];
  head.traverse((o) => { if (o.isMesh && o !== ghost && o.parent !== anat) (o.material.alphaMap ? headShells : headMeshes).push(o); });
  for (const m of headMeshes) m.material = m.material.clone();
  const airPath = (u, up) => {
    // nostril → mid airway → split
    const a = V(0, -0.012, 0.19), b = V(0, -0.014, 0.1);
    const c = up ? V(0, 0.008, 0.055) : V(0, -0.04, 0.045);
    const d = up ? V(0, 0.016, 0.04) : V(0, -0.07, -0.02);
    if (u < 0.55) return a.lerp(b, u / 0.55);
    const f = (u - 0.55) / 0.45;
    return b.multiplyScalar((1 - f) * (1 - f)).addScaledVector(c, 2 * f * (1 - f)).addScaledVector(d, f * f);
  };

  // ======================= pose =========================
  function spine(p) {
    const st = [V(0, 0.53, -0.4), V(0, 0.55, -0.32), V(0, 0.545, -0.06), V(0, 0.56, 0.18), V(0, 0.66, 0.32), V(0, 0.74, 0.4)];
    const si = [V(0, 0.12, -0.27), V(0, 0.2, -0.24), V(0, 0.36, -0.13), V(0, 0.52, 0.0), V(0, 0.66, 0.1), V(0, 0.74, 0.16)];
    let P = st.map((v, i) => vl(v, si[i], p.sit));
    // sniffing: neck and head go down and forward
    const sn = p.sniff;
    P[4].add(V(0, -0.16, 0.08).multiplyScalar(sn));
    P[5].add(V(0, -0.36, 0.14).multiplyScalar(sn));
    P[3].y -= 0.04 * sn;
    // lateral bend (turning to look behind the mirror)
    P[0].x -= 0.06 * p.bend;
    P[2].x += 0.04 * p.bend;
    P[4].x -= 0.06 * p.bend;
    P[5].x -= 0.1 * p.bend;
    const bob = -0.012 * Math.cos(4 * Math.PI * p.phase) * p.walk;
    for (const v of P) v.y += bob;
    return P;
  }
  function tailPts(p, base) {
    const n = 10, segL = 0.05;
    const pts = [base.clone()];
    const elev = lerp(-1.2, 0.9, p.tailUp);
    const dir = V(0, Math.sin(elev), -Math.cos(elev));
    for (let i = 1; i < n; i++) {
      const f = i / (n - 1);
      const q1 = new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), -0.25 * f * p.tailUp - 0.05);
      const q2 = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), p.wag * 0.5 * Math.sin(p.wagPhase - i * 0.35) * (0.4 + f));
      dir.applyQuaternion(q1).applyQuaternion(q2).normalize();
      pts.push(pts[i - 1].clone().addScaledVector(dir, segL));
    }
    if (p.sit > 0) {
      // when sitting the tail lies on the floor behind
      for (let i = 1; i < n; i++) {
        const f = i / (n - 1);
        const tgt = base.clone().add(V(0.06 * Math.sin(p.wagPhase - i * 0.4) * p.wag * f + 0.05 * f, -base.y + 0.03, -0.05 - 0.42 * f));
        pts[i].lerp(tgt, p.sit);
      }
    }
    return pts;
  }
  const tailProf = (u) => { const r = lerp(0.04, 0.016, u) * (u > 0.9 ? Math.sqrt((1 - u) / 0.1) * 0.7 + 0.3 : 1); return [r, r * 1.05, r * 1.25]; };

  const dog = {
    root, head: headPivot,
    setPose(o) {
      const p = Object.assign({
        t: 0, walk: 0, phase: 0, stride: 0.34, sit: 0, sniff: 0, bend: 0,
        headYaw: 0, headPitch: 0, headTilt: 0, jaw: 0, blink: 0, lid: 0.05, brow: 0, earLift: 0,
        tailUp: 0.45, wag: 0.4, wagPhase: 0, nostril: 0, breathe: 0, pant: 0,
      }, o);
      const t = p.t;
      p.wagPhase = p.wagPhase || t * 9;
      const P = spine(p);
      const br = 1 + 0.02 * Math.sin(p.breathe);
      body.update(P, (u) => { const r = bodyProf(u); const k = u > 0.3 && u < 0.75 ? br : 1; return [r[0] * k, r[1] * k, r[2] * k]; }, V(0, 1, 0));

      // head
      const nd = P[5].clone().sub(P[4]).normalize();
      const hp = P[5].clone().addScaledVector(nd, 0.02).add(V(0, 0.035, 0.02));
      headPivot.position.copy(hp);
      // base orientation follows the neck in pitch; sniffing points the nose down
      const neckPitch = Math.atan2(-(P[5].y - P[4].y), P[5].z - P[4].z) * 0.35;
      headPivot.rotation.set(neckPitch + p.headPitch + 0.75 * p.sniff + 0.32 * p.sit, p.headYaw, p.headTilt, 'YXZ');
      jaw.rotation.x = 0.4 * clamp(p.jaw + 0.15 * p.pant);
      mouthIn.visible = p.jaw + p.pant > 0.05;
      tongue.position.z = 0.09 + 0.03 * p.pant;
      // nostrils flare when sniffing
      const nf = 1 + 0.5 * p.nostril;
      for (const n of nostrils) n.scale.set(0.0042 * nf, 0.003 * nf, 0.0025);
      nose.scale.set(0.019 * (1 + 0.04 * p.nostril), 0.014, 0.013);
      for (const e of eyes) {
        const closed = clamp(Math.max(p.blink, p.lid));
        e.up.rotation.x = lerp(-1.45, -0.05, closed);
        e.lo.rotation.x = Math.PI + lerp(1.35, 0.35, closed * 0.5);
        e.brow.position.y = 0.052 + 0.008 * p.brow;
        e.brow.rotation.z = (-0.25 - 0.25 * p.brow) * e.sx;
      }
      // ears hang with gravity: counter the head tilt, lift a little when curious
      for (const e of ears) {
        const swing = -p.headTilt * 0.8 + 0.06 * Math.sin(t * 3 + e.sx) * p.walk;
        e.piv.rotation.set(-0.1 - 0.25 * p.earLift - 0.5 * p.sniff, 0.35 * e.sx, swing + e.sx * (0.18 + 0.35 * p.earLift));
      }

      // legs
      for (const Lg of legs) {
        const { sx, front } = Lg;
        const off = front ? (sx > 0 ? 0.25 : 0.75) : (sx > 0 ? 0.0 : 0.5);
        const ph = (((p.phase + off) % 1) + 1) % 1;
        const duty = 0.6;
        let dz = 0, lift = 0;
        if (ph < duty) dz = p.stride * (0.5 - ph / duty);
        else { const s = (ph - duty) / (1 - duty); const e = s * s * (3 - 2 * s); dz = p.stride * (-0.5 + e); lift = 0.07 * Math.sin(Math.PI * s); }
        dz *= p.walk;
        lift *= p.walk;
        if (front) {
          const sho = P[3].clone().add(V(0.075 * sx, -0.08, -0.03));
          const st = V(0.085 * sx, 0, 0.2 + dz), si = V(0.07 * sx, 0, 0.12);
          const paw = vl(st, si, p.sit);
          paw.y += lift;
          const wrist = paw.clone().add(V(0, 0.07, -0.01));
          const [el, wr] = ik2(sho, wrist, 0.2, 0.2, V(0, 0.1, -1));
          Lg.L.update([sho.clone().add(V(0, 0.05, 0)), el, wr, paw.clone().add(V(0, 0.03, 0.01))],
            profile([[0, 0.07, 0.07, 0.075], [0.25, 0.058, 0.058, 0.064], [0.55, 0.04, 0.04, 0.042], [0.85, 0.034, 0.034, 0.035], [1, 0.033, 0.033, 0.033]]), V(0, 0, 1));
          Lg.paw.position.copy(paw).add(V(0, 0.025, 0.02));
        } else {
          const hip = P[1].clone().add(V(0.08 * sx, -0.06, 0.02));
          const st = V(0.09 * sx, 0, -0.34 + dz), si = V(0.11 * sx, 0, 0.0);
          const paw = vl(st, si, p.sit);
          paw.y += lift;
          const hock = vl(paw.clone().add(V(0, 0.14, -0.05)), paw.clone().add(V(0.01 * sx, 0.035, -0.16)), p.sit);
          hock.y += lift * 0.6;
          const [kn, hk] = ik2(hip, hock, 0.24, 0.25, V(0, 0, 1));
          Lg.L.update([hip.clone().add(V(0, 0.06, -0.03)), kn, hk, paw.clone().add(V(0, 0.03, -0.01))],
            profile([[0, 0.1, 0.1, 0.105], [0.2, 0.085, 0.085, 0.09], [0.45, 0.05, 0.05, 0.052], [0.75, 0.035, 0.035, 0.036], [1, 0.033, 0.033, 0.033]]), V(0, 0, 1));
          Lg.paw.position.copy(paw).add(V(0, 0.025, 0.02));
        }
        Lg.paw.scale.set(0.042, 0.028, 0.05);
      }
      const tb = P[0].clone().add(V(0, 0.03, 0.0));
      tail.update(tailPts(p, tb), tailProf, V(0, 1, 0));
      root.updateMatrixWorld(true);
    },
    noseWorld() { return head.localToWorld(V(0, -0.008, 0.2)); },
    anatWorld(name) {
      const p = { olf: V(0, 0.01, 0.06), bulb: V(0, 0.024, 0.012), air: V(0, -0.016, 0.13), throat: V(0, -0.055, 0.0) }[name];
      return head.localToWorld(p.clone());
    },
    // x: 0 → normal head, 1 → see-through head showing the nose anatomy; glow: smell activity
    setXray(x, t = 0, glow = 0) {
      anat.visible = x > 0.02;
      for (const m of headShells) m.visible = x < 0.05;
      for (const m of headMeshes) {
        m.visible = x < 0.98;
        m.material.transparent = x > 0.01;
        m.material.opacity = 1 - x;
        m.material.depthWrite = x < 0.3;
      }
      ghost.visible = x > 0.02;
      ghost.material.uniforms.a.value = x;
      if (!anat.visible) return;
      for (const m of anat.children) if (m.material && m.material.opacity !== undefined && !m.isPoints) m.material.opacity = Math.min(m.material.userData.o ??= m.material.opacity, 1) * x;
      olfMat.emissiveIntensity = 0.6 + 1.6 * glow * (0.7 + 0.3 * Math.sin(t * 9));
      bulbMat.emissiveIntensity = 0.6 + 1.8 * glow * (0.7 + 0.3 * Math.sin(t * 9 + 1));
      const pa = ag.attributes.position.array, ca = ag.attributes.color.array;
      for (let i = 0; i < NA; i++) {
        const up = i % 2 === 0;
        const u = ((i / NA) * 3.7 + t * 0.9) % 1;
        const p = airPath(u, up);
        pa.set([p.x + Math.sin(i * 7.3) * 0.004, p.y + Math.sin(i * 3.1) * 0.003, p.z], i * 3);
        const c = up && u > 0.55 ? [1.6, 1.2, 0.4] : [0.6, 1.1, 1.6];
        const a = x * Math.sin(Math.PI * u);
        ca.set([c[0] * a, c[1] * a, c[2] * a], i * 3);
      }
      ag.attributes.position.needsUpdate = true;
      ag.attributes.color.needsUpdate = true;
      const sa = sg.attributes.position.array;
      for (let i = 0; i < NS; i++) {
        const f = (i / NS + t * 1.2) % 1;
        const p = V(0, 0.012, 0.055).lerp(V(0, 0.022, 0.014), f);
        sa.set([p.x + Math.sin(i * 5) * 0.004, p.y, p.z], i * 3);
      }
      sg.attributes.position.needsUpdate = true;
      sig.material.opacity = x * glow;
    },
  };
  dog.setPose({});
  return dog;
}
