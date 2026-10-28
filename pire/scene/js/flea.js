import * as THREE from 'three';
import { canvasTexture, rng, clamp, lerp } from './util.js';
import { Loft, profile } from './loft.js';

// ---------------------------------------------------------------------------
// Cat flea (Ctenocephalides felis), units = millimetres. Local: head toward +Z,
// back up +Y, laterally flattened (narrow in X). ≈2.6 mm long, no wings.
// Glossy sclerotised exoskeleton with segment plates (tergites), backward-
// pointing bristles, genal + pronotal combs, short antennae, piercing mouthparts,
// three pairs of legs (huge hind legs). Legs: coxa fixed, femur+tibia via IK,
// tarsus to the foot. Cut-away mode reveals the jump mechanism in the thorax:
// big depressor muscle + tendon, pleural arch with a resilin pad, catch.
// ---------------------------------------------------------------------------
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

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

function chitinTex(seed) {
  const r = rng(seed);
  // u along the body (canvas x: 0 = abdomen tip, 1 = head), v around (dorsal = middle row)
  return canvasTexture(1024, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#b0682e');
    gr.addColorStop(0.3, '#6b3214');
    gr.addColorStop(0.5, '#4a210b');
    gr.addColorStop(0.7, '#6b3214');
    gr.addColorStop(1, '#b0682e');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    // segment plates: darker front edge, lighter (translucent) hind margin
    const seams = [0.06, 0.13, 0.2, 0.27, 0.34, 0.41, 0.48, 0.55, 0.62, 0.69, 0.76];
    for (const s of seams) {
      const x = s * w;
      const lg = g.createLinearGradient(x - 22, 0, x + 6, 0);
      lg.addColorStop(0, 'rgba(210,140,70,0)');
      lg.addColorStop(0.7, 'rgba(225,150,80,0.55)');
      lg.addColorStop(0.85, 'rgba(30,10,2,0.9)');
      lg.addColorStop(1, 'rgba(30,10,2,0)');
      g.fillStyle = lg;
      g.fillRect(x - 22, 0, 28, h);
    }
    // head capsule a bit lighter and smoother
    const hg = g.createLinearGradient(w * 0.82, 0, w, 0);
    hg.addColorStop(0, 'rgba(150,80,30,0)');
    hg.addColorStop(1, 'rgba(150,80,30,0.45)');
    g.fillStyle = hg;
    g.fillRect(w * 0.82, 0, w * 0.18, h);
    // micro texture
    for (let i = 0; i < 9000; i++) {
      g.fillStyle = r() < 0.5 ? 'rgba(255,200,140,0.05)' : 'rgba(10,4,0,0.08)';
      g.fillRect(r() * w, r() * h, 2, 2);
    }
  });
}

export function createFlea({ seed = 2 } = {}) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const chitin = new THREE.MeshPhysicalMaterial({ map: chitinTex(seed), roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.18, sheen: 0.3, sheenColor: new THREE.Color('#ffb070') });
  const legMat = new THREE.MeshPhysicalMaterial({ color: '#7a3d18', roughness: 0.35, clearcoat: 0.9, clearcoatRoughness: 0.2 });
  const darkMat = new THREE.MeshPhysicalMaterial({ color: '#1f0d05', roughness: 0.3, clearcoat: 1 });
  const sh = (m) => { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; return m; };
  const S = new THREE.SphereGeometry(1, 32, 20);

  // ---- body: one loft from abdomen tip (u=0) to the front of the head (u=1) ----
  const loft = new Loft(64, 40);
  const centres = [V(0, 0.98, -1.3), V(0, 0.98, -1.05), V(0, 0.95, -0.5), V(0, 0.88, 0.0), V(0, 0.8, 0.4), V(0, 0.71, 0.75), V(0, 0.6, 1.05), V(0, 0.5, 1.25)];
  const prof = profile([
    [0, 0.03, 0.05, 0.05], [0.06, 0.15, 0.3, 0.3], [0.22, 0.25, 0.5, 0.48], [0.42, 0.27, 0.52, 0.5], [0.58, 0.24, 0.46, 0.44],
    [0.68, 0.21, 0.4, 0.38], [0.76, 0.19, 0.36, 0.34], [0.8, 0.17, 0.32, 0.3], [0.88, 0.18, 0.33, 0.3], [0.96, 0.15, 0.26, 0.22], [1, 0.04, 0.05, 0.05],
  ]);
  loft.update(centres, prof, V(0, 1, 0));
  const shell = sh(new THREE.Mesh(loft.geo, chitin));
  body.add(shell);
  // fresnel "ghost" shell for the cut-away view
  const ghost = new THREE.Mesh(loft.geo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { a: { value: 0 } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform float a; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2); gl_FragColor = vec4(vec3(1.0, 0.62, 0.3) * (0.02 + 0.7 * f) * a, 1.0); }',
  }));
  ghost.visible = false;
  body.add(ghost);

  // ---- head details ----
  for (const sx of [-1, 1]) {
    const eye = sh(new THREE.Mesh(S, darkMat));
    eye.position.set(0.165 * sx, 0.66, 1.0);
    eye.scale.set(0.045, 0.06, 0.06);
    body.add(eye);
    // short clubbed antenna lying in a groove behind the eye
    const ant = sh(new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.16, 4, 10), legMat));
    ant.position.set(0.17 * sx, 0.68, 0.86);
    ant.rotation.set(0.9, 0, 0.15 * sx);
    body.add(ant);
  }
  // mouthparts (palps + stylets) pointing down
  const mouth = [];
  for (const [x, l] of [[-0.05, 0.36], [0.05, 0.36], [0, 0.42]]) {
    const m = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.01, l, 6), legMat));
    m.geometry.translate(0, -l / 2, 0);
    m.position.set(x, 0.36, 1.14);
    m.rotation.x = 0.35;
    body.add(m);
    mouth.push(m);
  }
  // combs: genal (lower head margin) and pronotal (behind the head)
  const spineGeo = new THREE.ConeGeometry(0.018, 0.16, 5);
  spineGeo.translate(0, 0.08, 0);
  const combs = new THREE.InstancedMesh(spineGeo, darkMat, 60);
  combs.castShadow = true;
  let ci = 0;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  const putSpine = (p, dir, s = 1) => {
    q.setFromUnitVectors(V(0, 1, 0), dir.clone().normalize());
    m4.compose(p, q, V(s, s, s));
    combs.setMatrixAt(ci++, m4);
  };
  for (const sx of [-1, 1]) for (let k = 0; k < 8; k++) putSpine(V(0.15 * sx, 0.4 + k * 0.012, 1.1 - k * 0.04), V(0.15 * sx, -0.3, -1), 0.9); // genal comb
  for (let k = 0; k < 15; k++) {
    const a = -1.95 + k * (3.9 / 14);
    putSpine(V(Math.sin(a) * 0.2, 0.71 + Math.cos(a) * 0.37, 0.74), V(0.25 * Math.sin(a), 0.15 * Math.cos(a), -1), 1.1); // pronotal comb
  }
  combs.count = ci;
  body.add(combs);
  // backward-pointing bristles in rows along the segment margins (dorsal and lateral)
  const brGeo = new THREE.ConeGeometry(0.012, 0.22, 4);
  brGeo.translate(0, 0.11, 0);
  const bristles = new THREE.InstancedMesh(brGeo, darkMat, 400);
  let bi = 0;
  const pts = loft.curve.getSpacedPoints(63);
  for (const u of [0.1, 0.17, 0.24, 0.31, 0.38, 0.45, 0.52, 0.59, 0.66, 0.73]) {
    const c = pts[Math.round(u * 63)];
    const r = prof(u);
    for (let k = 0; k < 14; k++) {
      const a = -1.35 + k * (2.7 / 13);
      const p = c.clone().add(V(Math.sin(a) * r[0] * 0.98, Math.cos(a) * r[1] * 0.98, -0.02));
      const out = V(Math.sin(a), Math.cos(a), 0).normalize();
      const dir = out.multiplyScalar(0.3).add(V(0, 0, -1));
      q.setFromUnitVectors(V(0, 1, 0), dir.normalize());
      m4.compose(p, q, V(1, 0.7 + 0.5 * Math.abs(Math.sin(k * 3.1)), 1));
      bristles.setMatrixAt(bi++, m4);
    }
  }
  bristles.count = bi;
  bristles.castShadow = true;
  body.add(bristles);

  // ---- legs ----
  // base: coxa attachment on the thorax; L: [coxa, femur, tibia, tarsus], r: radii
  const LEGS = [
    { name: 'fore', base: V(0.12, 0.5, 0.88), L: [0.3, 0.34, 0.3, 0.34], r: [0.085, 0.06, 0.04, 0.025], coxDir: V(0.1, -0.85, 0.4), tars: V(0, 0.55, -0.6) },
    { name: 'mid', base: V(0.14, 0.48, 0.45), L: [0.28, 0.4, 0.38, 0.42], r: [0.09, 0.062, 0.042, 0.025], coxDir: V(0.2, -0.95, -0.1), tars: V(-0.4, 0.6, 0.1) },
    { name: 'hind', base: V(0.17, 0.56, 0.08), L: [0.42, 0.58, 0.64, 0.66], r: [0.11, 0.08, 0.052, 0.028], coxDir: V(0.15, -0.8, -0.35), tars: V(0, 0.3, 1) },
  ];
  const legs = [];
  for (const def of LEGS) for (const sx of [-1, 1]) {
    const L = new Loft(40, 14);
    body.add(sh(new THREE.Mesh(L.geo, legMat)));
    const claw = sh(new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.08, 5), darkMat));
    body.add(claw);
    // spines along the tibia
    const sp = new THREE.InstancedMesh(brGeo, darkMat, 8);
    body.add(sp);
    legs.push({ ...def, sx, Lf: L, claw, sp });
  }

  // ---- jump mechanism (shown in the cut-away) ----
  const mech = new THREE.Group();
  mech.visible = false;
  body.add(mech);
  const glow = (c, e, o = 0.95) => new THREE.MeshStandardMaterial({ color: c, emissive: new THREE.Color(c), emissiveIntensity: e, roughness: 0.5, transparent: true, opacity: o, depthWrite: false });
  const muscleMat = glow('#d0443c', 0.5);
  const fibers = [];
  for (let k = 0; k < 9; k++) {
    const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 1, 4, 10), muscleMat);
    mech.add(f);
    fibers.push({ f, ox: (k % 3 - 1) * 0.06, oz: (Math.floor(k / 3) - 1) * 0.1 });
  }
  const tendon = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 6), glow('#f4ead8', 0.4));
  mech.add(tendon);
  const archMat = glow('#ffb35a', 0.6);
  const arches = [-1, 1].map((sx) => {
    const a = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.035, 10, 32, Math.PI), archMat);
    a.position.set(0.19 * sx, 0.78, 0.08);
    a.rotation.y = Math.PI / 2;
    mech.add(a);
    return a;
  });
  const resMat = glow('#4fc3ff', 0.8);
  const pads = [-1, 1].map((sx) => {
    const p = new THREE.Mesh(S, resMat);
    p.position.set(0.19 * sx, 0.94, 0.08);
    p.scale.set(0.05, 0.07, 0.11);
    mech.add(p);
    return p;
  });
  const catchM = new THREE.Mesh(S, glow('#ffe066', 0.8));
  catchM.scale.setScalar(0.045);
  catchM.position.set(0.17, 0.6, 0.12);
  mech.add(catchM);
  // energy motes: gather into the pads while loading, rush down the leg on release
  const NE = 70;
  const eg = new THREE.BufferGeometry();
  eg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NE * 3), 3));
  const dotTex = canvasTexture(64, 64, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  const energy = new THREE.Points(eg, new THREE.PointsMaterial({ size: 0.07, map: dotTex, color: new THREE.Color(0.6, 1.5, 2.6), transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
  energy.frustumCulled = false;
  mech.add(energy);
  const R = rng(seed + 9);
  const eSeeds = Array.from({ length: NE }, () => [R(), R(), R()]);

  const world = {};
  const flea = {
    root, body, legs, world,
    // p: { t, walk, phase, crouch (hind legs cocked), kick (0..1 hind extension), air (legs trailing), pitch, cut (0..1), load, release }
    setPose(o) {
      const p = Object.assign({ t: 0, walk: 0, phase: 0, stride: 0.5, crouch: 0, kick: 0, air: 0, cut: 0, load: 0, release: 0, groundY: 0 }, o);
      // body attitude: tilts nose-up a little when cocked
      body.rotation.x = -0.12 * p.crouch * (1 - p.kick) + 0.1 * p.kick;
      body.position.y = -0.06 * p.crouch * (1 - p.kick) + 0.03 * Math.sin(p.phase * Math.PI * 4) * p.walk;
      body.updateMatrixWorld(true);
      for (const m of mouth) m.rotation.x = 0.35 + 0.05 * Math.sin(p.t * 3);
      for (const lg of legs) {
        const { sx, L, r, name } = lg;
        const base = lg.base.clone().multiply(V(sx, 1, 1));
        const C = base.clone().addScaledVector(lg.coxDir.clone().multiply(V(sx, 1, 1)).normalize(), L[0]);
        // foot target in body space
        const off = { fore: 0, mid: 0.5, hind: 0 }[name] + (sx > 0 ? 0.5 : 0);
        const ph = (((p.phase + off) % 1) + 1) % 1;
        let dz = 0, lift = 0;
        if (ph < 0.55) dz = p.stride * (0.5 - ph / 0.55);
        else { const s = (ph - 0.55) / 0.45; dz = p.stride * (-0.5 + s * s * (3 - 2 * s)); lift = 0.18 * Math.sin(Math.PI * s); }
        dz *= p.walk;
        lift *= p.walk;
        const stand = { fore: V(0.4 * sx, 0, 1.12), mid: V(0.55 * sx, 0, 0.35), hind: V(0.45 * sx, 0, -1.45) }[name].clone();
        let foot = stand.add(V(0, lift, dz));
        // ground is at y = groundY in root space; convert to body space
        foot.y += p.groundY - body.position.y;
        if (name === 'hind') {
          // cocked: femur levitated up against the body, tarsus on the ground below the thorax
          const cocked = V(0.32 * sx, p.groundY - body.position.y, -0.55);
          const ext = V(0.3 * sx, -1.0, -1.75);
          foot = foot.lerp(cocked, p.crouch).lerp(ext, p.kick);
        }
        if (p.air > 0) {
          const trail = { fore: V(0.42 * sx, -0.4, 1.05), mid: V(0.5 * sx, -0.45, 0.3), hind: V(0.32 * sx, -0.75, -1.7) }[name];
          foot.lerp(trail, p.air);
        }
        const tarsDir = lg.tars.clone().multiply(V(sx, 1, 1)).normalize();
        const T = foot.clone().addScaledVector(tarsDir, L[3]);
        const hint = name === 'hind' ? V(0.3 * sx, 0.5, 1).normalize().lerp(V(0.2 * sx, 1, 0.3), p.crouch * (1 - p.kick)) : V(sx * 0.7, 0.8, name === 'fore' ? 0.3 : -0.2);
        const [K, Tb] = ik2(C, T, L[1], L[2], hint);
        lg.Lf.update([base.clone().add(V(-0.04 * sx, 0.05, 0)), base, C, K, Tb, foot],
          profile([[0, r[0] * 0.7, r[0] * 0.7, r[0] * 0.7], [0.18, r[0], r[0], r[0]], [0.3, r[1] * 1.1, r[1] * 1.1, r[1] * 1.1], [0.5, r[1] * 0.85, r[1] * 0.85, r[1] * 0.85], [0.56, r[2], r[2], r[2]], [0.74, r[2] * 0.9, r[2] * 0.9, r[2] * 0.9], [0.8, r[3], r[3], r[3]], [1, r[3] * 0.7, r[3] * 0.7, r[3] * 0.7]]),
          V(sx, 0, 0));
        lg.claw.position.copy(foot);
        lg.claw.rotation.set(Math.PI * 0.75, 0, 0);
        // tibial spines
        let k = 0;
        for (let s = 0; s < 8; s++) {
          const f = (s + 0.5) / 8;
          const pp = K.clone().lerp(Tb, f);
          const dir = Tb.clone().sub(K).normalize().add(V(0.6 * sx, 0.3, 0)).normalize();
          q.setFromUnitVectors(V(0, 1, 0), dir);
          m4.compose(pp, q, V(0.8, 0.45, 0.8));
          lg.sp.setMatrixAt(k++, m4);
        }
        lg.sp.instanceMatrix.needsUpdate = true;
        if (name === 'hind') { world['hindC' + sx] = C; world['hindK' + sx] = K; world['hindT' + sx] = Tb; world['hindF' + sx] = foot; world.hindBase = base; }
      }
      // ---- cut-away ----
      const cut = clamp(p.cut);
      ghost.visible = cut > 0.02;
      ghost.material.uniforms.a.value = cut;
      shell.material.transparent = cut > 0.01;
      shell.material.opacity = 1 - 0.96 * cut;
      shell.material.depthWrite = cut < 0.4;
      bristles.visible = combs.visible = cut < 0.5;
      mech.visible = cut > 0.02;
      if (mech.visible) {
        const load = clamp(p.load), rel = clamp(p.release);
        // muscle from the dorsal thorax down to the tendon; shortens and thickens while loading
        const top = V(0, 1.18, 0.38), bot = V(0, lerp(0.66, 0.76, load), lerp(0.2, 0.24, load));
        const len = top.distanceTo(bot);
        for (const fb of fibers) {
          const a = top.clone().add(V(fb.ox, 0, fb.oz)), b = bot.clone().add(V(fb.ox * 0.6, 0, fb.oz * 0.6));
          fb.f.position.copy(a).lerp(b, 0.5);
          fb.f.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize());
          const th = 1 + 0.6 * load * (1 - rel);
          fb.f.scale.set(th, len, th);
        }
        muscleMat.emissiveIntensity = 0.4 + 1.2 * load * (1 - rel);
        const hc = (world['hindC1'] || V(0.2, 0, 0)).clone().multiply(V(0.3, 1, 1));
        tendon.position.copy(bot).lerp(hc, 0.5);
        tendon.quaternion.setFromUnitVectors(V(0, 1, 0), hc.clone().sub(bot).normalize());
        tendon.scale.set(1, bot.distanceTo(hc), 1);
        // pleural arch squeezes, resilin pad bulges and glows with stored energy
        const sq = load * (1 - rel);
        for (const a of arches) a.scale.set(1, 1 - 0.28 * sq, 1 + 0.12 * sq);
        for (const pd of pads) { pd.scale.set(0.05 * (1 + 0.5 * sq), 0.07 * (1 - 0.3 * sq), 0.11 * (1 + 0.35 * sq)); }
        resMat.emissiveIntensity = 0.5 + 3.5 * sq;
        catchM.material.emissiveIntensity = 0.6 + 2.5 * load * (1 - rel) * (0.6 + 0.4 * Math.sin(p.t * 20));
        // energy motes
        const arr = eg.attributes.position.array;
        const legPath = [V(0.19, 0.94, 0.08), world['hindC1'] || V(0.2, 0, 0), world['hindK1'] || V(0.3, -0.3, 0.2), world['hindT1'] || V(0.3, -0.6, -0.4), world['hindF1'] || V(0.3, -0.9, -0.6)];
        for (let i = 0; i < NE; i++) {
          const [a, b, c] = eSeeds[i];
          const sx = i % 2 ? 1 : -1;
          let pos;
          if (rel < 0.02) {
            // swirl in from the muscle toward the pad
            const f = ((a + p.t * 0.6) % 1) * load;
            pos = V(0.05 * sx, 1.1, 0.35).lerp(V(0.19 * sx, 0.94, 0.08), f).add(V(Math.sin(b * 20 + p.t * 3) * 0.04, Math.cos(c * 20 + p.t * 2) * 0.04, 0));
          } else {
            const f = clamp(rel * 1.3 - a * 0.3);
            const seg = Math.min(3, Math.floor(f * 4)), u = f * 4 - seg;
            pos = legPath[seg].clone().lerp(legPath[seg + 1], u);
            pos.x = Math.abs(pos.x) * sx;
          }
          arr.set([pos.x, pos.y, pos.z], i * 3);
        }
        eg.attributes.position.needsUpdate = true;
        energy.material.opacity = cut * Math.max(load * (1 - rel), rel < 1 ? Math.sin(Math.PI * clamp(rel)) : 0);
      }
      root.updateMatrixWorld(true);
    },
  };
  flea.setPose({});
  return flea;
}
