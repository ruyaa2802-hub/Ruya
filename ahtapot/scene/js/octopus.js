import * as THREE from 'three';
import { canvasTexture, rng, clamp } from './util.js';
const v = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------------------
// "Mavi" — the purple cartoon octopus (one model for every shot).
// Local axes: face looks toward +Z, up = +Y. Mantle sits above/behind the eyes,
// eight procedural arms hang from the web ring below.
//
// Anatomy (x-ray mode, schematic but in the right places):
//   * two gills inside the mantle cavity, one left and one right,
//   * a branchial heart at the base of each gill  → pumps blood THROUGH the gill,
//   * one systemic heart in the middle            → pumps oxygenated blood to the body.
// ---------------------------------------------------------------------------

const SKIN = '#9a5be0';

function skinTexture() {
  const r = rng(31);
  return canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = SKIN;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 420; i++) {
      const x = r() * w, y = r() * h, s = 2 + r() * 9;
      g.fillStyle = r() < 0.65 ? 'rgba(205,160,255,0.45)' : 'rgba(80,30,140,0.35)';
      g.beginPath();
      g.ellipse(x, y, s, s * (0.7 + r() * 0.5), r() * 3, 0, 7);
      g.fill();
    }
  });
}

function heartShape(s) {
  const h = new THREE.Shape();
  h.moveTo(0, -0.9 * s);
  h.bezierCurveTo(-0.15 * s, -0.7 * s, -1.0 * s, -0.25 * s, -1.0 * s, 0.25 * s);
  h.bezierCurveTo(-1.0 * s, 0.75 * s, -0.45 * s, 0.95 * s, 0, 0.5 * s);
  h.bezierCurveTo(0.45 * s, 0.95 * s, 1.0 * s, 0.75 * s, 1.0 * s, 0.25 * s);
  h.bezierCurveTo(1.0 * s, -0.25 * s, 0.15 * s, -0.7 * s, 0, -0.9 * s);
  const g = new THREE.ExtrudeGeometry(h, { depth: 0.35 * s, bevelEnabled: true, bevelThickness: 0.18 * s, bevelSize: 0.16 * s, bevelSegments: 6, curveSegments: 24 });
  g.translate(0, 0, -0.175 * s);
  return g;
}

// moving-dash flow material for blood vessels
export function flowMaterial(color) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0 }, uSpeed: { value: 1 }, uGlow: { value: 0 } },
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 mv = modelViewMatrix*vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform float uTime, uOpacity, uSpeed, uGlow; uniform vec3 uColor; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        float dash = smoothstep(0.35, 0.55, fract(vUv.x * 9.0 - uTime * uSpeed * 1.6)) * (1.0 - smoothstep(0.75, 0.95, fract(vUv.x * 9.0 - uTime * uSpeed * 1.6)));
        float rim = pow(1.0 - abs(dot(vN, vV)), 1.5);
        vec3 c = uColor * (0.75 + 0.9 * dash + uGlow) + rim * 0.3;
        gl_FragColor = vec4(c, uOpacity * (0.55 + 0.45 * dash));
      }`,
  });
}

class Arm {
  constructor(material, suckerMat, idx) {
    this.idx = idx;
    this.SEG = 46;
    this.RAD = 10;
    const n = (this.SEG + 1) * (this.RAD + 1);
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 3);
    this.nor = new Float32Array(n * 3);
    const uv = new Float32Array(n * 2), col = new Float32Array(n * 3);
    const idxs = [];
    for (let i = 0; i <= this.SEG; i++) {
      for (let j = 0; j <= this.RAD; j++) {
        const k = i * (this.RAD + 1) + j;
        uv[k * 2] = i / this.SEG;
        uv[k * 2 + 1] = j / this.RAD;
        // underside (j around the "inner" side) lighter pink
        const a = (j / this.RAD) * Math.PI * 2;
        const under = Math.max(0, -Math.cos(a));
        col[k * 3] = 1 + under * 0.25;
        col[k * 3 + 1] = 1 + under * 0.55;
        col[k * 3 + 2] = 1 + under * 0.2;
        if (i < this.SEG && j < this.RAD) {
          const a0 = k, b0 = k + this.RAD + 1;
          idxs.push(a0, a0 + 1, b0, b0, a0 + 1, b0 + 1);
        }
      }
    }
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(idxs);
    this.mesh = new THREE.Mesh(g, material);
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    this.NS = 14;
    this.suckers = new THREE.InstancedMesh(new THREE.TorusGeometry(1, 0.42, 8, 14), suckerMat, this.NS * 2);
    this.suckers.frustumCulled = false;
    this.pts = Array.from({ length: this.SEG + 1 }, () => new THREE.Vector3());
  }

  // base: Vector3 (local), o: outward dir, params: {pitch0, len, wave, sway, curl, t, phase}
  update(base, o, p) {
    const SEG = this.SEG, L = p.len;
    const up = new THREE.Vector3(0, 1, 0);
    const w = new THREE.Vector3().crossVectors(o, up).normalize();
    const pts = this.pts;
    pts[0].copy(base);
    let phi = p.pitch0;
    const ds = 1 / SEG;
    for (let i = 1; i <= SEG; i++) {
      const s = i / SEG;
      const kappa = p.wave * Math.sin(Math.PI * 3.2 * s - p.t * p.omega + p.phase) * (0.5 + 1.2 * s) + p.curl * 7.5 * s * s;
      phi += kappa * ds;
      const psi = p.sway * Math.sin(Math.PI * 2.2 * s - p.t * p.omega * 0.7 + p.phase * 1.3) * s;
      const dir = o.clone().multiplyScalar(Math.cos(phi) * Math.cos(psi)).addScaledVector(w, Math.cos(phi) * Math.sin(psi)).addScaledVector(up, Math.sin(phi));
      pts[i].copy(pts[i - 1]).addScaledVector(dir, L * ds);
    }
    // parallel-transport frames
    const T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3();
    T.subVectors(pts[1], pts[0]).normalize();
    N.copy(up).addScaledVector(T, -up.dot(T));
    if (N.lengthSq() < 1e-6) N.copy(o);
    N.normalize();
    const prevT = T.clone();
    const tmp = new THREE.Vector3(), q = new THREE.Quaternion();
    const RAD = this.RAD;
    let si = 0;
    const m = new THREE.Matrix4(), sq = new THREE.Quaternion(), sp = new THREE.Vector3(), ss = new THREE.Vector3();
    for (let i = 0; i <= SEG; i++) {
      const s = i / SEG;
      if (i > 0) {
        T.subVectors(pts[Math.min(i + 1, SEG)], pts[i - 1]).normalize();
        q.setFromUnitVectors(prevT, T);
        N.applyQuaternion(q).normalize();
        prevT.copy(T);
      }
      B.crossVectors(T, N).normalize();
      const r = 0.15 * Math.pow(1 - s, 0.85) + 0.012 + (s < 0.08 ? (0.08 - s) * 0.9 : 0);
      for (let j = 0; j <= RAD; j++) {
        const a = (j / RAD) * Math.PI * 2;
        tmp.copy(N).multiplyScalar(Math.cos(a)).addScaledVector(B, Math.sin(a));
        const k = (i * (RAD + 1) + j) * 3;
        this.pos[k] = pts[i].x + tmp.x * r;
        this.pos[k + 1] = pts[i].y + tmp.y * r;
        this.pos[k + 2] = pts[i].z + tmp.z * r;
        this.nor[k] = tmp.x;
        this.nor[k + 1] = tmp.y;
        this.nor[k + 2] = tmp.z;
      }
      // suckers: two rows on the underside (the -N side)
      if (i % 3 === 1 && si < this.NS * 2 - 1 && s > 0.08 && s < 0.92) {
        for (const side of [-0.42, 0.42]) {
          tmp.copy(N).multiplyScalar(-Math.cos(side)).addScaledVector(B, Math.sin(side));
          sp.copy(pts[i]).addScaledVector(tmp, r * 0.93);
          sq.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tmp);
          const sr = r * 0.32;
          ss.set(sr, sr, sr * 0.6);
          m.compose(sp, sq, ss);
          this.suckers.setMatrixAt(si++, m);
        }
      }
    }
    for (; si < this.NS * 2; si++) { m.makeScale(0, 0, 0); this.suckers.setMatrixAt(si, m); }
    this.suckers.instanceMatrix.needsUpdate = true;
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.normal.needsUpdate = true;
    this.mesh.geometry.computeBoundingSphere();
  }
}

export function createOctopus() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const tex = skinTexture();
  const skin = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.42, clearcoat: 0.55, clearcoatRoughness: 0.35, sheen: 0.6, sheenColor: new THREE.Color('#f0c8ff'), emissive: new THREE.Color('#2a0a4a'), emissiveIntensity: 0.25 });
  const armSkin = new THREE.MeshPhysicalMaterial({ map: tex, vertexColors: true, roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.35, emissive: new THREE.Color('#2a0a4a'), emissiveIntensity: 0.25 });
  // translucent mantle material (x-ray)
  const mantleMat = skin.clone();
  const suckerMat = new THREE.MeshPhysicalMaterial({ color: '#ffc6e0', roughness: 0.4, clearcoat: 0.6 });
  const white = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.18, clearcoat: 1 });
  const pupilMat = new THREE.MeshPhysicalMaterial({ color: '#120a1c', roughness: 0.15, clearcoat: 1 });
  const shine = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 1.8, 1.8) });
  const dark = new THREE.MeshStandardMaterial({ color: '#3a1460', roughness: 0.5 });
  const blush = new THREE.MeshStandardMaterial({ color: '#ff8fb5', roughness: 0.8, transparent: true, opacity: 0.75 });
  const S = new THREE.SphereGeometry(1, 48, 32);
  const add = (geo, mat, parent, pos, scl, rot) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...pos);
    if (scl) (typeof scl === 'number' ? m.scale.setScalar(scl) : m.scale.set(...scl));
    if (rot) m.rotation.set(...rot);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  // head / mantle / web
  const mantle = add(S, mantleMat, body, [0, 0.62, -0.05], [1.0, 1.08, 0.95], [-0.12, 0, 0]);
  mantle.renderOrder = 6;
  add(S, skin, body, [0, -0.2, 0.02], [0.8, 0.4, 0.78]);
  // siphon on the right side
  const siphon = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 0.3, 16, 1, true), skin);
  siphon.position.set(0.8, 0.08, 0.2);
  siphon.rotation.set(0.2, 0, -1.1);
  body.add(siphon);

  // eyes with sockets, pupils (slightly wide, a nod to real octopus pupils), brows
  const eyes = [], pupils = [], brows = [];
  for (const sx of [-1, 1]) {
    add(S, skin, body, [0.34 * sx, 0.3, 0.66], [0.27, 0.29, 0.2]);
    const eg = new THREE.Group();
    eg.position.set(0.34 * sx, 0.3, 0.78);
    eg.rotation.y = 0.32 * sx;
    body.add(eg);
    add(S, white, eg, [0, 0, 0], [0.23, 0.25, 0.16]);
    const pg = new THREE.Group();
    eg.add(pg);
    add(S, pupilMat, pg, [0, 0, 0.12], [0.13, 0.12, 0.06]);
    add(S, shine, pg, [-0.05, 0.05, 0.17], 0.035).castShadow = false;
    add(S, shine, pg, [0.04, -0.045, 0.175], 0.016).castShadow = false;
    eyes.push(eg);
    pupils.push(pg);
    const bg = new THREE.Group();
    bg.position.set(0.34 * sx, 0.6, 0.76);
    body.add(bg);
    add(new THREE.CapsuleGeometry(0.035, 0.16, 6, 12), dark, bg, [0, 0, 0], 1, [0, 0, Math.PI / 2 + 0.15 * sx]);
    brows.push({ g: bg, sx });
    add(S, blush, body, [0.52 * sx, 0.08, 0.66], [0.1, 0.06, 0.04], [0, 0.65 * sx, 0]).castShadow = false;
  }
  const smile = add(new THREE.TorusGeometry(0.12, 0.026, 8, 24, Math.PI), dark, body, [0, 0.06, 0.79], 1, [0.3, 0, Math.PI]);
  const ooh = add(new THREE.TorusGeometry(0.06, 0.024, 10, 24), dark, body, [0, 0.02, 0.8], 1, [0.3, 0, 0]);
  const oohFill = add(new THREE.CircleGeometry(0.06, 20), new THREE.MeshStandardMaterial({ color: '#2a0838' }), body, [0, 0.02, 0.795], 1, [0.3, 0, 0]);

  // arms
  const arms = [];
  for (let i = 0; i < 8; i++) {
    const a = new Arm(armSkin, suckerMat, i);
    body.add(a.mesh, a.suckers);
    arms.push(a);
  }

  // ---------------- anatomy (inside the mantle) ----------------
  const anatomy = new THREE.Group();
  anatomy.position.set(0, 0.0, -0.24);
  body.add(anatomy);
  const organ = (c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.35, clearcoat: 0.8, emissive: new THREE.Color(c), emissiveIntensity: 0.15, transparent: true, opacity: 0, depthTest: false });
  const gillMats = [], gills = [];
  for (const sx of [-1, 1]) {
    const gm = organ('#ff9fc0');
    gm.emissiveIntensity = 0.35;
    gillMats.push(gm);
    const gg = new THREE.Group();
    gg.position.set(0.42 * sx, 0.42, -0.12);
    anatomy.add(gg);
    // feather-like gill: a curved spine with two rows of lamellae
    const spine = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([v(0, 0.05, 0), v(0.02 * sx, 0.35, -0.03), v(0, 0.66, -0.08)]), 20, 0.03, 8), gm);
    gg.add(spine);
    for (let k = 0; k < 13; k++) {
      const s = (k + 0.5) / 13;
      const w = 0.12 * Math.sin(Math.PI * (0.15 + 0.85 * s)) + 0.03;
      for (const side of [-1, 1]) {
        const lam = new THREE.Mesh(S, gm);
        lam.position.set(0.012 * sx + side * w * 0.55, 0.06 + s * 0.6, -0.04 * s);
        lam.scale.set(w * 0.55, 0.014, 0.05);
        lam.rotation.set(0, 0, side * 0.35);
        gg.add(lam);
      }
    }
    gg.traverse((o) => (o.renderOrder = 7));
    gills.push(gg);
  }
  const heartMats = { b: [organ('#ff6b81'), organ('#ff6b81')], s: organ('#ff4d6d') };
  const bHearts = [-1, 1].map((sx, i) => {
    const h = new THREE.Mesh(heartShape(0.1), heartMats.b[i]);
    h.position.set(0.4 * sx, 0.24, -0.04);
    anatomy.add(h);
    return h;
  });
  const sHeart = new THREE.Mesh(heartShape(0.15), heartMats.s);
  sHeart.position.set(0, 0.74, -0.3);
  anatomy.add(sHeart);
  for (const h of [...bHearts, sHeart]) h.renderOrder = 8;

  // vessels: deoxygenated (pale blue) and oxygenated (bright blue)
  const vessel = (pts, mat, r = 0.026) => {
    const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), 48, r, 10), mat);
    m.renderOrder = 7;
    anatomy.add(m);
    return m;
  };
  const deoxMat = flowMaterial('#8fb6d9');
  const gillFlowMat = flowMaterial('#5fa8ff');
  const oxMat = flowMaterial('#1f7bff');
  const vessels = { deox: [], gill: [], ox: [], aorta: [] };
  for (const sx of [-1, 1]) {
    vessels.deox.push(vessel([[0.1 * sx, -0.38, 0.06], [0.24 * sx, -0.12, 0.02], [0.34 * sx, 0.14, -0.03], [0.36 * sx, 0.24, -0.05]], deoxMat));
    vessels.gill.push(vessel([[0.38 * sx, 0.36, -0.06], [0.45 * sx, 0.62, -0.12], [0.46 * sx, 0.9, -0.17], [0.43 * sx, 1.13, -0.22]], gillFlowMat, 0.022));
    vessels.ox.push(vessel([[0.42 * sx, 1.16, -0.24], [0.3 * sx, 1.12, -0.3], [0.15 * sx, 0.95, -0.31], [0.06 * sx, 0.8, -0.3]], oxMat));
  }
  vessels.aorta.push(vessel([[0, 0.6, -0.3], [0, 0.25, -0.18], [0, -0.15, -0.05], [0, -0.45, 0.0]], oxMat, 0.032));
  for (const sx of [-1, 1]) vessels.aorta.push(vessel([[0, -0.4, 0.0], [0.3 * sx, -0.52, 0.12], [0.55 * sx, -0.62, 0.28]], oxMat, 0.024));
  vessels.aorta.push(vessel([[0, -0.4, 0.0], [0, -0.55, -0.35], [0, -0.66, -0.6]], oxMat, 0.024));
  // arrowheads
  const arrowGeo = new THREE.ConeGeometry(0.055, 0.13, 14);
  const arrows = [];
  const arrow = (from, to, mat) => {
    const m = new THREE.Mesh(arrowGeo, new THREE.MeshBasicMaterial({ color: mat.uniforms.uColor.value, transparent: true, opacity: 0, depthWrite: false, depthTest: false }));
    m.position.set(...to);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]).normalize());
    m.renderOrder = 9;
    anatomy.add(m);
    arrows.push({ m, group: mat });
    return m;
  };
  for (const sx of [-1, 1]) {
    arrow([0.34 * sx, 0.14, -0.03], [0.35 * sx, 0.22, -0.05], deoxMat);
    arrow([0.46 * sx, 0.9, -0.17], [0.44 * sx, 1.08, -0.21], gillFlowMat);
    arrow([0.15 * sx, 0.95, -0.31], [0.07 * sx, 0.83, -0.3], oxMat);
    arrow([0.3 * sx, -0.52, 0.12], [0.55 * sx, -0.62, 0.28], oxMat);
  }
  arrow([0, -0.55, -0.35], [0, -0.66, -0.6], oxMat);

  const phases = Array.from({ length: 8 }, (_, i) => i * 0.83 + (i % 2) * 1.7);

  const oct = {
    root, body, mantle, anatomy, eyes,
    hearts: { b: bHearts, s: sHeart },
    gills,
    // world positions of things the overlay needs
    anchor(name, out = new THREE.Vector3()) {
      const src = { bL: bHearts[0], bR: bHearts[1], s: sHeart, gL: gills[0], gR: gills[1] }[name];
      root.updateMatrixWorld(true);
      if (name[0] === 'g') return src.localToWorld(out.set(0, 0.42, 0));
      return src.getWorldPosition(out);
    },
    setPose(p) {
      const t = p.t ?? 0;
      // body bob from swim strokes
      const stroke = p.stroke ?? 0; // 0..1 closing phase of a swim stroke
      body.position.y = (p.bob ?? 0);
      body.rotation.set(p.pitch ?? 0, 0, p.roll ?? 0);
      // arms
      const spread = p.spread ?? 0.5;
      const wave = p.wave ?? 0.6;
      for (let i = 0; i < 8; i++) {
        const th = ((i + 0.5) / 8) * Math.PI * 2;
        const o = new THREE.Vector3(Math.sin(th), 0, Math.cos(th));
        const base = new THREE.Vector3(o.x * 0.5, -0.36, o.z * 0.5 + 0.02);
        const front = Math.max(0, o.z); // arms in front curl a bit more for cuteness
        arms[i].update(base, o, {
          t,
          omega: p.omega ?? 3.2,
          phase: phases[i],
          len: (p.len ?? 1.75) * (0.92 + 0.08 * Math.sin(phases[i] * 3)),
          pitch0: THREE.MathUtils.lerp(-1.45, -0.05, spread) + (p.armLift ?? 0) * (0.6 + 0.4 * front) - stroke * 0.35,
          wave,
          sway: (p.sway ?? 0.35) * (0.6 + 0.4 * Math.sin(phases[i])),
          curl: (p.curl ?? 0.25) * (0.7 + 0.5 * front),
        });
      }
      // face
      const surprise = clamp(p.surprise ?? 0);
      const blink = clamp(p.blink ?? 0);
      for (const e of eyes) e.scale.set(1 + 0.12 * surprise, (1 + 0.15 * surprise) * (1 - 0.88 * blink), 1);
      const look = p.look ?? [0, 0];
      for (const pg of pupils) pg.position.set(look[0] * 0.06, look[1] * 0.05, 0);
      for (const b of brows) {
        b.g.position.y = 0.6 + 0.09 * surprise;
        b.g.rotation.z = -0.25 * surprise * b.sx + (p.browTilt ?? 0) * b.sx;
      }
      smile.scale.setScalar(1 - surprise);
      ooh.scale.setScalar(Math.max(0.0001, surprise));
      oohFill.scale.setScalar(Math.max(0.0001, surprise));
      // x-ray
      const xr = clamp(p.xray ?? 0);
      mantleMat.transparent = xr > 0.001;
      mantleMat.opacity = 1 - 0.42 * xr;
      mantleMat.depthWrite = xr < 0.2;
      anatomy.visible = xr > 0.01;
      for (const gm of gillMats) gm.opacity = xr;
      const ox = clamp(p.oxygen ?? 0);
      for (const gm of gillMats) {
        gm.color.set('#ff9fc0').lerp(new THREE.Color('#7fd8ff'), ox);
        gm.emissive.copy(gm.color);
        gm.emissiveIntensity = 0.35 + 0.6 * ox;
      }
      // hearts: beat pulses and highlight
      const hb = p.beat ?? { b: 0, s: 0 };
      const hl = p.highlight ?? { b: 0, s: 0 };
      bHearts.forEach((h, i) => {
        h.scale.setScalar(1 + 0.22 * hb.b + 0.25 * hl.b);
        heartMats.b[i].opacity = xr;
        heartMats.b[i].emissiveIntensity = 0.15 + 0.9 * hl.b + 0.5 * hb.b;
      });
      sHeart.scale.setScalar(1 + 0.22 * hb.s + 0.25 * hl.s);
      heartMats.s.opacity = xr;
      heartMats.s.emissiveIntensity = 0.15 + 0.9 * hl.s + 0.5 * hb.s;
      // hearts always face the camera so their shape reads clearly
      if (p.camera) {
        const cp = p.camera.position;
        for (const h of [...bHearts, sHeart]) {
          const wp = h.getWorldPosition(new THREE.Vector3());
          const dir = cp.clone().sub(wp).normalize();
          const parentQ = h.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
          h.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.applyQuaternion(parentQ));
        }
      }
      // vessel flow
      const f = p.flow ?? { deox: 0, gill: 0, ox: 0, aorta: 0 };
      deoxMat.uniforms.uOpacity.value = xr * f.deox;
      gillFlowMat.uniforms.uOpacity.value = xr * f.gill;
      oxMat.uniforms.uOpacity.value = xr * Math.max(f.ox, f.aorta);
      for (const mt of [deoxMat, gillFlowMat, oxMat]) mt.uniforms.uTime.value = t;
      vessels.ox.forEach((v) => (v.visible = f.ox > 0.01));
      vessels.aorta.forEach((v) => (v.visible = f.aorta > 0.01));
      for (const a of arrows) {
        const key = a.group === deoxMat ? 'deox' : a.group === gillFlowMat ? 'gill' : null;
        const v = key ? f[key] : a.m.position.y < 0 ? f.aorta : f.ox;
        a.m.material.opacity = xr * v;
      }
    },
  };
  oct.setPose({});
  return oct;
}
