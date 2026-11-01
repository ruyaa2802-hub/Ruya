import * as THREE from 'three';
import { canvasTexture, rng, clamp, lerp, ss } from './util.js';
import { Loft, profile } from './loft.js';

// ---------------------------------------------------------------------------
// Axolotl (Ambystoma mexicanum, leucistic pink), ~1.2 units long.
// Local: z = forward (snout), y = up, x = lateral.
// Broad flat head with a wide smiling mouth and small black eyes; three pairs
// of feathery external gills; four short legs (4 fingers front, 5 toes hind);
// a long laterally flattened tail with a fin crest running along the back.
// Semi-translucent wet skin (fresnel glow + clearcoat).
// The front-right leg can regenerate: `regen` 0 (healed stump) → 1 (full leg),
// with a blastema bud and an x-ray view of bone, muscle, nerve and vessels.
// ---------------------------------------------------------------------------
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

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

function skinTex(seed) {
  const r = rng(seed);
  // x = u (tail tip → snout), y = v around (0/1 belly, 0.5 back)
  return canvasTexture(1024, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#ffe3e6');
    gr.addColorStop(0.3, '#f9c3cc');
    gr.addColorStop(0.5, '#f2aab8');
    gr.addColorStop(0.7, '#f9c3cc');
    gr.addColorStop(1, '#ffe3e6');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    // faint costal grooves along the trunk
    for (let i = 0; i < 12; i++) {
      const x = w * (0.47 + i * 0.022);
      g.fillStyle = 'rgba(200,110,130,0.13)';
      g.fillRect(x, h * 0.12, 3, h * 0.76);
    }
    // soft speckles and tiny surface pores
    for (let i = 0; i < 1600; i++) {
      g.fillStyle = r() < 0.6 ? `rgba(220,130,150,${0.05 + r() * 0.12})` : `rgba(255,255,255,${0.08 + r() * 0.15})`;
      g.beginPath();
      g.arc(r() * w, r() * h, 0.6 + r() * 2.2, 0, 6.283);
      g.fill();
    }
    // faint golden flecks on the back
    for (let i = 0; i < 90; i++) {
      g.fillStyle = `rgba(255,214,150,${0.2 + r() * 0.25})`;
      g.beginPath();
      g.arc(r() * w * 0.95, h * (0.35 + r() * 0.3), 1 + r() * 2, 0, 6.283);
      g.fill();
    }
  });
}

// wet, slightly translucent skin: add a soft fresnel glow and a subsurface-like warm fill
function translucent(mat, color = '#ff9fb2', k = 0.45) {
  mat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      float fres = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.0);
      totalEmissiveRadiance += vec3(${new THREE.Color(color).toArray().map((x) => x.toFixed(3)).join(',')}) * (0.12 + fres * ${k.toFixed(3)});`);
  };
  mat.customProgramCacheKey = () => 'transl' + color + k;
  return mat;
}

function finGeo(cols, rows) {
  const g = new THREE.BufferGeometry();
  const n = (cols + 1) * (rows + 1);
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const uv = new Float32Array(n * 2), idx = [];
  for (let i = 0; i <= cols; i++) for (let j = 0; j <= rows; j++) {
    const k = i * (rows + 1) + j;
    uv[k * 2] = i / cols;
    uv[k * 2 + 1] = j / rows;
    if (i < cols && j < rows) idx.push(k, k + rows + 1, k + 1, k + 1, k + rows + 1, k + rows + 2);
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

export function createAxolotl({ seed = 5 } = {}) {
  const root = new THREE.Group();
  const sh = (m) => { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; return m; };
  const skin = translucent(new THREE.MeshPhysicalMaterial({ map: skinTex(seed), roughness: 0.42, clearcoat: 0.7, clearcoatRoughness: 0.25, sheen: 0.6, sheenColor: new THREE.Color('#ffd0da'), transparent: true, opacity: 1 }));
  const limbMat = translucent(new THREE.MeshPhysicalMaterial({ color: '#f7c0ca', roughness: 0.45, clearcoat: 0.6, clearcoatRoughness: 0.3, sheen: 0.5, sheenColor: new THREE.Color('#ffd6de'), transparent: true, opacity: 1 }));
  const loft = new Loft(160, 28);
  const body = sh(new THREE.Mesh(loft.geo, skin));
  root.add(body);
  const head = new THREE.Group();
  root.add(head);

  // ---- eyes: small, black, glossy ----
  const eyeMat = new THREE.MeshPhysicalMaterial({ color: '#07070a', roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.03 });
  const hlMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  for (const sx of [-1, 1]) {
    const e = sh(new THREE.Mesh(new THREE.SphereGeometry(0.019, 24, 16), eyeMat));
    e.position.set(0.088 * sx, 0.04, 0.13);
    head.add(e);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 10, 8), hlMat);
    hl.position.set(0.095 * sx, 0.052, 0.138);
    head.add(hl);
    const hl2 = new THREE.Mesh(new THREE.SphereGeometry(0.0025, 8, 6), hlMat);
    hl2.position.set(0.102 * sx, 0.034, 0.138);
    head.add(hl2);
  }
  // ---- mouth: a wide, gentle smile around the front of the head ----
  const mouthMat = new THREE.MeshStandardMaterial({ color: '#c7647a', roughness: 0.5 });
  const mouth = new THREE.Mesh(new THREE.BufferGeometry(), mouthMat);
  head.add(mouth);
  const setSmile = (s) => {
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const a = -1 + (i / 16) * 2; // -1 … 1 across
      const x = a * 0.098;
      const z = 0.229 - 0.085 * a * a; // follows the round snout
      const y = -0.012 + (0.006 + 0.008 * s) * a * a; // corners curl up
      pts.push(V(x, y, z));
    }
    mouth.geometry.dispose();
    mouth.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.0036, 6, false);
  };
  setSmile(0.5);

  // ---- external gills: 3 rami per side with feathery filaments ----
  const gillMat = translucent(new THREE.MeshPhysicalMaterial({ color: '#ff6f8f', roughness: 0.4, sheen: 0.8, sheenColor: new THREE.Color('#ffc0cc'), clearcoat: 0.3, transparent: true, opacity: 1 }), '#ff4f78', 0.6);
  const filGeo = new THREE.CylinderGeometry(0.0007, 0.0016, 1, 4, 1);
  filGeo.translate(0, 0.5, 0);
  const GILL = [];
  const NFIL = 46;
  const filaments = new THREE.InstancedMesh(filGeo, gillMat, 6 * NFIL * 2);
  filaments.frustumCulled = false;
  filaments.castShadow = true;
  head.add(filaments);
  for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) {
    const ramus = sh(new THREE.Mesh(new THREE.BufferGeometry(), gillMat));
    head.add(ramus);
    GILL.push({ sx, k, ramus });
  }

  // ---- fin crest (back + tail, top and bottom) ----
  const finMat = translucent(new THREE.MeshPhysicalMaterial({ color: '#ffd3dc', roughness: 0.4, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }), '#ffb0c0', 0.3);
  const finTop = new THREE.Mesh(finGeo(60, 3), finMat);
  const finBot = new THREE.Mesh(finGeo(40, 3), finMat);
  finTop.frustumCulled = finBot.frustumCulled = false;
  root.add(finTop, finBot);

  // ---- legs ----
  // base: shoulder/hip in body space, L: [upper, lower], fingers count
  const LEGS = [
    { name: 'fore', sx: -1, base: V(-0.06, -0.022, 0.07), L: [0.05, 0.048], n: 4, ph: 0 },
    { name: 'fore', sx: 1, base: V(0.06, -0.022, 0.07), L: [0.05, 0.048], n: 4, ph: 0.5, regen: true },
    { name: 'hind', sx: -1, base: V(-0.055, -0.024, -0.19), L: [0.055, 0.052], n: 5, ph: 0.5 },
    { name: 'hind', sx: 1, base: V(0.055, -0.024, -0.19), L: [0.055, 0.052], n: 5, ph: 0 },
  ];
  const fingerGeo = new THREE.CapsuleGeometry(0.0055, 0.016, 6, 10);
  fingerGeo.translate(0, 0.0135, 0); // unit = one finger of ~0.027
  for (const lg of LEGS) {
    lg.lf = new Loft(30, 12);
    lg.mesh = sh(new THREE.Mesh(lg.lf.geo, limbMat));
    root.add(lg.mesh);
    lg.palm = sh(new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), limbMat));
    root.add(lg.palm);
    lg.fingers = [];
    for (let f = 0; f < lg.n; f++) { const m = sh(new THREE.Mesh(fingerGeo, limbMat)); root.add(m); lg.fingers.push(m); }
  }
  const RL = LEGS[1];
  // regeneration extras: blastema bud, wound cap glow, inner tissues
  const blastema = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshStandardMaterial({ color: '#fff0f4', emissive: '#ff9ab8', emissiveIntensity: 0.9, transparent: true, opacity: 0, roughness: 0.3, depthWrite: false }));
  blastema.frustumCulled = false;
  root.add(blastema);
  const tissueDefs = [
    { key: 'bone', color: '#f4f1e6', emissive: '#d8d2c0', r: 0.0042, off: V(0, 0, 0), lag: 0.12 },
    { key: 'muscleA', color: '#e0505e', emissive: '#a02030', r: 0.0045, off: V(0.0065, 0.004, 0), lag: 0.2 },
    { key: 'muscleB', color: '#e0505e', emissive: '#a02030', r: 0.0045, off: V(-0.0065, 0.004, 0), lag: 0.2 },
    { key: 'nerve', color: '#ffd84a', emissive: '#ffb000', r: 0.0017, off: V(0.002, -0.0075, 0), lag: 0.0 },
    { key: 'artery', color: '#ff2a3a', emissive: '#ff0020', r: 0.0017, off: V(-0.004, -0.0065, 0.003), lag: 0.04 },
    { key: 'vein', color: '#4a7dff', emissive: '#2050ff', r: 0.0018, off: V(0.005, -0.006, -0.003), lag: 0.06 },
  ];
  const tissues = tissueDefs.map((d) => {
    const lf = new Loft(24, 8);
    const m = new THREE.Mesh(lf.geo, new THREE.MeshStandardMaterial({ color: d.color, emissive: d.emissive, emissiveIntensity: 0.6, roughness: 0.4, transparent: true, opacity: 0, depthTest: false }));
    m.renderOrder = 5;
    m.frustumCulled = false;
    m.visible = false;
    root.add(m);
    return { ...d, lf, m };
  });

  const curve = new THREE.CatmullRomCurve3([V(), V(0, 0, 1)], false, 'centripetal');
  const world = {};
  const ax = {
    root, head, skin, world, legs: LEGS,
    // o: t, swim (0..1 body wave), swimPhase, walk (0..1), walkPhase, tuck (legs folded back for swimming),
    //    headYaw, headPitch, smile, gill (sway amount), regen (0..1), inner (x-ray 0..1), ground (body-space y of the ground)
    setPose(o0) {
      const o = Object.assign({ t: 0, swim: 0, swimPhase: 0, walk: 0, walkPhase: 0, tuck: 0, headYaw: 0, headPitch: 0, smile: 0.6, gill: 1, regen: 1, inner: 0, ground: -0.07, breathe: 0, reach: 0 }, o0);
      root.updateMatrixWorld(true);
      // ---- spine with lateral swimming wave (stronger toward the tail) ----
      const zs = [-0.86, -0.74, -0.61, -0.48, -0.36, -0.25, -0.14, -0.03, 0.06, 0.12];
      const pts = zs.map((z) => {
        const tail = clamp((0.1 - z) / 0.96);
        const amp = o.swim * (0.012 + 0.14 * tail * tail) + o.walk * 0.025 * Math.sin(o.walkPhase * Math.PI * 2) * (0.3 + tail);
        const x = amp * Math.sin(o.swimPhase * Math.PI * 2 - (0.1 - z) * 5.2);
        return V(x, 0.004 * Math.sin(o.t * 1.3 + z * 3) * o.swim, z);
      });
      const N = pts[pts.length - 1].clone();
      const hq = new THREE.Quaternion().setFromEuler(new THREE.Euler(-o.headPitch, o.headYaw + 0.6 * (pts[pts.length - 1].x - pts[pts.length - 2].x) * 0, 0, 'YXZ'));
      head.position.copy(N);
      head.quaternion.copy(hq);
      const HP = (x, y, z) => V(x, y, z).applyQuaternion(hq).add(N);
      const headPts = [HP(0, 0.006, 0.06), HP(0, 0.008, 0.12), HP(0, 0.004, 0.175), HP(0, -0.002, 0.21), HP(0, -0.004, 0.226)];
      const all = [...pts, ...headPts];
      const cum = [0];
      for (let i = 1; i < all.length; i++) cum.push(cum[i - 1] + all[i].distanceTo(all[i - 1]));
      const tot = cum[cum.length - 1];
      const u = (i) => cum[i] / tot;
      const iN = pts.length - 1;
      const br = 1 + 0.015 * Math.sin(o.breathe);
      const prof = profile([
        [0, 0.004, 0.008, 0.008], [u(1), 0.012, 0.03, 0.026], [u(3), 0.022, 0.05, 0.042], [u(5), 0.038, 0.06, 0.054],
        [u(6), 0.058 * br, 0.06, 0.06 * br], [u(7), 0.072 * br, 0.06, 0.064 * br], [u(8), 0.074 * br, 0.058, 0.062 * br], [u(iN), 0.068, 0.052, 0.054],
        [u(iN + 1), 0.118, 0.064, 0.052], [u(iN + 2), 0.126, 0.062, 0.05], [u(iN + 3), 0.112, 0.054, 0.044], [u(iN + 4), 0.08, 0.04, 0.034], [1, 0.001, 0.001, 0.001],
      ]);
      curve.points = all;
      const P = loft.update(all, prof, UP);
      const tg = (uu) => curve.getTangentAt(clamp(uu, 0.001, 0.999));
      const ring = (uu) => { const i = Math.round(clamp(uu) * (P.length - 1)); return { c: P[i], r: prof(uu) }; };

      // ---- fins ----
      const fin = (mesh, cols, u0, u1, top, hfn) => {
        const a = mesh.geometry.attributes.position.array;
        for (let i = 0; i <= cols; i++) {
          const f = i / cols, uu = lerp(u0, u1, f);
          const s = ring(uu);
          const base = s.c.clone().addScaledVector(UP, top ? s.r[1] * 0.92 : -s.r[2] * 0.92);
          const hgt = hfn(f);
          const t = tg(uu), side = new THREE.Vector3().crossVectors(UP, t).normalize();
          for (let j = 0; j <= 3; j++) {
            const g = j / 3;
            const p = base.clone().addScaledVector(UP, (top ? 1 : -1) * hgt * g).addScaledVector(side, Math.sin(o.t * 3 + f * 9) * 0.004 * g);
            a.set([p.x, p.y, p.z], (i * 4 + j) * 3);
          }
        }
        mesh.geometry.attributes.position.needsUpdate = true;
        mesh.geometry.computeVertexNormals();
      };
      fin(finTop, 60, 0.01, u(7), true, (f) => (f < 0.08 ? f / 0.08 * 0.012 : 0.012 + 0.03 * Math.sin(Math.PI * Math.min(1, (f - 0.05) / 0.75)) * (1 - f * 0.55)) * (f > 0.9 ? (1 - f) / 0.1 : 1));
      fin(finBot, 40, 0.01, u(4), false, (f) => 0.004 + 0.026 * Math.sin(Math.PI * Math.min(1, f / 0.85)) * (f > 0.9 ? (1 - f) / 0.1 : 1));

      // ---- gills: rami sweep back, filaments flutter in the current ----
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
      let fi = 0;
      for (const G of GILL) {
        const { sx, k } = G;
        const ang = [0.85, 0.3, -0.15][k]; // fan: upper, middle, lower ramus
        const len = [0.105, 0.12, 0.1][k];
        const sway = o.gill * (0.12 * Math.sin(o.t * 1.6 + k * 0.9 + sx) + 0.05 * Math.sin(o.t * 3.7 + k));
        const base = V(0.1 * sx, 0.014 + (1 - k) * 0.013, 0.02);
        const pts2 = [];
        for (let i = 0; i <= 6; i++) {
          const f = i / 6;
          const bend = f * f * (0.5 + sway * 2);
          const dir = V(sx * (0.8 - 0.3 * f), Math.sin(ang) * (0.9 - 0.3 * f) + 0.2 * f, -0.7 - bend);
          pts2.push(i === 0 ? base.clone() : pts2[i - 1].clone().addScaledVector(dir.normalize(), len / 6));
        }
        const cg = new THREE.CatmullRomCurve3(pts2);
        G.ramus.geometry.dispose();
        const rg = new THREE.TubeGeometry(cg, 16, 1, 7, false);
        // taper the ramus
        const pa = rg.attributes.position, na = rg.attributes.normal, PP = cg.getSpacedPoints(16);
        for (let i = 0; i <= 16; i++) for (let j = 0; j <= 7; j++) {
          const kk = i * 8 + j, rad = 0.0065 * (1 - 0.6 * i / 16);
          pa.setXYZ(kk, PP[i].x + na.getX(kk) * rad, PP[i].y + na.getY(kk) * rad, PP[i].z + na.getZ(kk) * rad);
        }
        rg.computeVertexNormals();
        G.ramus.geometry = rg;
        world['gill' + sx + k] = head.localToWorld(PP[10].clone());
        for (let i = 0; i < NFIL; i++) {
          const f = 0.12 + 0.88 * (i / (NFIL - 1));
          const p = cg.getPointAt(f), t = cg.getTangentAt(f);
          for (const side of [-1, 1]) {
            // filaments stick out on both edges of the ramus, slanted backward, fluttering
            const out = new THREE.Vector3().crossVectors(t, V(sx, 0, 0)).normalize().multiplyScalar(side);
            const jit = Math.sin(i * 12.9898 + k * 78.233 + side * 3.1) * 0.5; // irregular, fluffy
            const fl = 0.35 * Math.sin(o.t * 5 + i * 0.7 + k + side) * o.gill + jit * 0.5;
            const j2 = Math.sin(i * 7.31 + k * 3.7 + side * 1.9);
            const d = out.clone().multiplyScalar(0.8).addScaledVector(t, 0.55 + fl * 0.3 + 0.25 * j2).add(V(sx * (0.25 * fl + 0.2 * j2), 0.15 * j2, 0)).normalize();
            q.setFromUnitVectors(UP, d);
            const L = (0.011 + 0.013 * Math.sin(Math.PI * f)) * (k === 1 ? 1.1 : 1) * (0.8 + 0.4 * (jit + 0.5));
            m4.compose(p, q, V(1, L, 1));
            filaments.setMatrixAt(fi++, m4);
          }
        }
      }
      filaments.instanceMatrix.needsUpdate = true;

      // ---- legs ----
      for (const lg of LEGS) {
        const { sx, L } = lg;
        const isFore = lg.name === 'fore';
        const s = ring(isFore ? u(8) + 0.005 : u(5) + 0.01); // front legs just behind the gills
        const base = s.c.clone().add(V(sx * s.r[0] * 0.75, -0.02, 0));
        // standing / walking foot target in body space, or tucked back along the body when swimming
        const ph = ((o.walkPhase + lg.ph) % 1 + 1) % 1;
        let dz = 0, lift = 0;
        if (o.walk > 0) {
          if (ph < 0.6) dz = 0.05 * (0.5 - ph / 0.6);
          else { const f = (ph - 0.6) / 0.4; dz = 0.05 * (-0.5 + f); lift = 0.03 * Math.sin(Math.PI * f); }
        }
        const stand = base.clone().add(V(sx * 0.085, 0, isFore ? 0.03 : -0.015)); // splayed, salamander-style
        stand.y = o.ground;
        const foot = stand.add(V(0, lift * o.walk, dz * o.walk));
        const tucked = base.clone().add(V(sx * 0.03, -0.035, -0.11));
        foot.lerp(tucked, o.tuck);
        if (lg.regen && o.reach > 0) foot.lerp(base.clone().add(V(sx * 0.13, -0.025, 0.05)), o.reach); // held out sideways for the close-up
        let len = 1, digits = 1, palm = 1;
        if (lg.regen) {
          const r = clamp(o.regen);
          len = 0.14 + 0.86 * ss(0.12, 0.75, r);
          palm = ss(0.35, 0.7, r);
          digits = ss(0.55, 0.92, r);
        }
        const L1 = L[0] * len, L2 = L[1] * len;
        const hint = V(sx * 1.0, 0.6, isFore ? -0.5 : 0.5); // elbows/knees out and up
        const tgt = base.clone().lerp(foot, len);
        const [K, F] = ik2(base, tgt, L1, L2, hint);
        const ends = [base.clone().add(V(-sx * 0.02, 0.01, 0)), base, K, F];
        const rr = (a) => profile([[0, a * 1.15, a * 1.15, a * 1.15], [0.3, a, a, a], [0.65, a * 0.8, a * 0.8, a * 0.8], [1, a * 0.65, a * 0.65, a * 0.65]]);
        lg.lf.update(ends, rr(0.021), V(0, 1, 0));
        lg.end = F;
        lg.dir = F.clone().sub(K).normalize();
        // palm & fingers splayed on the ground
        const pv = palm;
        lg.palm.visible = pv > 0.02;
        lg.palm.position.copy(F).add(V(0, 0.002, 0));
        lg.palm.scale.set(0.017 * pv, 0.006 * pv + 0.001, 0.015 * pv);
        lg.palm.rotation.y = sx * (isFore ? 0.3 : -0.2);
        lg.fingers.forEach((m, fIdx) => {
          const spread = (fIdx / (lg.n - 1) - 0.5) * (isFore ? 1.5 : 1.9);
          const dirF = V(Math.sin(spread) * 1 + sx * 0.3, -0.12, Math.cos(spread) * (isFore ? 1 : 0.7)).normalize();
          m.position.copy(F).addScaledVector(dirF, 0.008 * pv);
          m.quaternion.setFromUnitVectors(UP, dirF);
          const fl = (isFore ? 0.022 : 0.026) * (fIdx === 0 || fIdx === lg.n - 1 ? 0.75 : 1) * digits;
          m.scale.setScalar(Math.max(0.001, digits * fl / 0.027));
          m.visible = digits > 0.02;
        });
      }
      // ---- regeneration extras on the front-right leg ----
      {
        const r = clamp(o.regen);
        const bud = ss(0.02, 0.15, r) * (1 - ss(0.55, 0.8, r));
        blastema.visible = bud > 0.01;
        const tip = RL.end.clone().addScaledVector(RL.dir, 0.004);
        blastema.position.copy(tip);
        blastema.quaternion.setFromUnitVectors(UP, RL.dir);
        const bs = 0.011 + 0.006 * ss(0.05, 0.4, r);
        blastema.scale.set(bs, bs * (1.2 + 0.8 * ss(0.15, 0.45, r)), bs);
        blastema.material.opacity = 0.75 * bud;
        blastema.material.emissiveIntensity = 0.6 + 0.6 * Math.sin(o.t * 4) * 0.5 + 0.4;
        world.legTip = root.localToWorld(tip.clone());
        world.legBase = root.localToWorld(RL.lf.curve.points[1].clone());
        // x-ray: skin of the leg becomes glassy, tissues show inside and grow distally with a lag
        const inn = clamp(o.inner);
        limbMat.opacity = 1 - 0.55 * inn;
        limbMat.depthWrite = inn < 0.5;
        const pathPts = RL.lf.curve.points.slice(1);
        for (const T of tissues) {
          T.m.visible = inn > 0.02;
          if (!T.m.visible) continue;
          const g = clamp((ss(0.12, 0.8, r) - T.lag) / (1 - T.lag) + 0.1);
          const c = new THREE.CatmullRomCurve3(pathPts.map((p) => p.clone().add(T.off)));
          const L = c.getLength() * Math.max(0.05, g);
          const pts3 = [];
          for (let i = 0; i <= 6; i++) pts3.push(c.getPointAt(Math.min(1, (L / c.getLength()) * (i / 6))));
          T.lf.update(pts3, profile([[0, T.r, T.r, T.r], [0.85, T.r, T.r, T.r], [1, T.r * 0.5, T.r * 0.5, T.r * 0.5]]), V(0, 1, 0));
          T.m.material.opacity = inn * 0.95;
        }
        world.tissue = {};
        for (const T of tissues) if (T.m.visible) world.tissue[T.key] = root.localToWorld(T.lf.curve.getPointAt(0.6));
      }
      // whole-body glassiness (used for the cellular dive)
      skin.opacity = 1;
      setSmile(o.smile);
      world.head = root.localToWorld(HP(0, 0.02, 0.12));
      world.eye = root.localToWorld(HP(0.088, 0.04, 0.13));
      world.snout = root.localToWorld(HP(0, -0.01, 0.23));
      world.gills = root.localToWorld(HP(0.13, 0.04, -0.03));
      root.updateMatrixWorld(true);
      return world;
    },
  };
  ax.setPose({});
  return ax;
}
