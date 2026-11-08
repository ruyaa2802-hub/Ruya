import * as THREE from 'three';
import { clamp, lerp, rng } from './util.js';
import { Loft, profile } from './loft.js';

// ---------------------------------------------------------------------------
// Snapping (pistol) shrimp, Alpheidae — colours after Alpheus randalli
// (translucent cream-white body with bright red bands). Units: centimetres.
// Local frame: +z forward (rostrum), +y up, +x = the shrimp's left side.
//
// Anatomy kept close to the real animal:
//  * smooth carapace whose front forms two ORBITAL HOODS that cover the eyes
//    (alpheid eyes are seen as dark spots through the hood), small rostrum;
//  * one hugely enlarged SNAPPING CLAW (major chela): oval palm (propodus),
//    fixed finger (pollex) with a socket, movable finger (dactyl) carrying a
//    plunger that drives into the socket when the claw snaps shut;
//  * a slender minor claw on the other side; slender 2nd legs; 3 pairs of
//    walking legs; third maxillipeds; antennules (two whips each) and long
//    antennae with a flat antennal scale;
//  * 6 abdominal segments with side plates (pleura), swimmerets (pleopods)
//    and a tail fan (telson + two pairs of uropods).
// ---------------------------------------------------------------------------
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

const CREAM = new THREE.Color('#f0ded2');
const RED = new THREE.Color('#e01f26');
const ORANGE = new THREE.Color('#ff5a1e');
const DEEP = new THREE.Color('#9c0f22');

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

// wet chitin: clearcoat + a soft translucent (subsurface-like) fresnel fill
function chitin(opts = {}) {
  const m = new THREE.MeshPhysicalMaterial({
    vertexColors: true, roughness: 0.38, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12, sheen: 0.15, sheenColor: new THREE.Color('#ffd9c8'), ...opts,
  });
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      float fres = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.2);
      totalEmissiveRadiance += diffuseColor.rgb * (0.025 + fres * 0.1);`);
  };
  m.customProgramCacheKey = () => 'chitin' + (opts.transparent ? 't' : '');
  return m;
}

// fill a colour attribute from a function of (u along, v around, local position)
function paint(geo, fn) {
  const p = geo.attributes.position, uv = geo.attributes.uv;
  const col = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    fn(c, uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0, p.getX(i), p.getY(i), p.getZ(i));
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}
const noise3 = (x, y, z) => Math.sin(x * 12.9 + y * 7.1) * Math.cos(z * 9.7 - x * 3.3) * 0.5 + Math.sin(y * 21.3 + z * 17.1) * 0.25;

// static loft along a polyline → geometry
function loftGeo(pts, prof, rings = 24, segs = 24, up = V(0, 1, 0)) {
  const L = new Loft(rings, segs);
  L.update(pts, prof, up);
  return L.geo;
}

export function createShrimp({ bigSide = -1 } = {}) {
  const root = new THREE.Group(); // placed in the world: position on the sand, yaw
  const body = new THREE.Group(); // body pitch/roll/height
  root.add(body);
  const world = new THREE.Group(); // world-space parts (legs, antennae) rebuilt per frame
  const mat = chitin();
  const matClaw = chitin({ roughness: 0.3 });
  const parts = [];
  const add = (parent, geo, m = mat) => { const mesh = new THREE.Mesh(geo, m); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); parts.push(mesh); return mesh; };

  // ---------------- carapace (cephalothorax) ----------------
  const carGeo = loftGeo([V(0, 0.02, -0.08), V(0, 0.04, 0.5), V(0, 0.03, 1.05), V(0, 0.0, 1.45)], profile([
    [0, 0.33, 0.33, 0.28], [0.12, 0.38, 0.41, 0.33], [0.5, 0.4, 0.44, 0.34], [0.82, 0.34, 0.37, 0.27], [1, 0.2, 0.2, 0.12],
  ]), 30, 30);
  paint(carGeo, (c, u, v, x, y, z) => {
    // cream with a red saddle band and a red front, fine speckles
    const band = Math.exp(-(((u - 0.42) / 0.11) ** 2)) + 0.8 * Math.exp(-(((u - 0.95) / 0.07) ** 2));
    const top = clamp((y + 0.05) / 0.4);
    c.copy(CREAM).lerp(RED, clamp(band * (0.55 + 0.45 * top)));
    const n = noise3(x * 3, y * 3, z * 3);
    if (n > 0.55) c.lerp(DEEP, 0.35);
    c.multiplyScalar(0.92 + 0.08 * top);
  });
  add(body, carGeo);
  // orbital hoods (translucent) with the dark eyes beneath
  const eyeMat = new THREE.MeshStandardMaterial({ color: '#1a0508', roughness: 0.2, emissive: '#3a0010', emissiveIntensity: 0.4 });
  const hoodMat = chitin({ transparent: true, opacity: 0.72, depthWrite: false });
  const eyes = [];
  for (const s of [1, -1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.075, 18, 12), eyeMat);
    eye.position.set(s * 0.13, 0.17, 1.5);
    body.add(eye);
    eyes.push(eye);
    const hg = new THREE.SphereGeometry(1, 28, 18);
    hg.scale(0.15, 0.14, 0.24);
    paint(hg, (c, u, v, x, y, z) => c.copy(CREAM).lerp(RED, 0.25 + 0.4 * clamp(-z / 0.2)));
    const hood = new THREE.Mesh(hg, hoodMat);
    hood.position.set(s * 0.13, 0.16, 1.44);
    hood.renderOrder = 2;
    body.add(hood);
  }
  // rostrum
  {
    const g = new THREE.ConeGeometry(0.045, 0.2, 10);
    g.rotateX(Math.PI / 2);
    paint(g, (c) => c.copy(RED));
    const r = add(body, g);
    r.position.set(0, 0.2, 1.62);
  }

  // ---------------- abdomen: 6 hinged segments + tail fan ----------------
  const SEG = [0.44, 0.42, 0.41, 0.39, 0.36, 0.42];
  const SR = [[0.34, 0.37, 0.36], [0.33, 0.36, 0.36], [0.31, 0.34, 0.34], [0.28, 0.31, 0.3], [0.24, 0.27, 0.25], [0.2, 0.22, 0.19]];
  const segs = [];
  let parent = body, hinge = V(0, 0.08, -0.02);
  SEG.forEach((len, i) => {
    const g = new THREE.Group();
    g.position.copy(hinge);
    parent.add(g);
    const [rx, ryT, ryB] = SR[i];
    const nx = SR[Math.min(5, i + 1)];
    const geo = loftGeo([V(0, -0.02, 0.06), V(0, 0, -len * 0.5), V(0, -0.02, -len - 0.03)], profile([
      [0, rx * 0.97, ryT * 0.97, ryB * 1.05], [0.45, rx * 1.02, ryT, ryB * 1.12], [1, nx[0] * 1.02, nx[1], nx[2] * 1.1],
    ]), 14, 26);
    paint(geo, (c, u, v, x, y, z) => {
      // each segment: cream front, bright red posterior band (the "candy stripe")
      const band = clamp((u - 0.5) / 0.18);
      const side = Math.abs(Math.cos(v * Math.PI * 2));
      c.copy(CREAM).lerp(i % 2 ? ORANGE : RED, band * (0.85 + 0.15 * side));
      if (noise3(x * 4 + i, y * 4, z * 4) > 0.6) c.lerp(DEEP, 0.3);
    });
    add(g, geo);
    // swimmerets (pleopods) under segments 1–5
    if (i < 5) {
      for (const s of [1, -1]) {
        const pg = new THREE.PlaneGeometry(0.1, 0.32, 1, 3).translate(0, -0.16, 0);
        paint(pg, (c, u, v) => c.copy(CREAM).lerp(RED, 0.2 * (1 - v)));
        const pm = add(g, pg, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 0.85, roughness: 0.5 }));
        pm.position.set(s * 0.12, -ryB * 0.75, -len * 0.5);
        pm.rotation.y = Math.PI / 2;
        pm.userData.pleo = { i, s };
      }
    }
    segs.push(g);
    parent = g;
    hinge = V(0, 0, -len);
  });
  // tail fan: telson + 2 pairs of uropods
  const tail = new THREE.Group();
  tail.position.copy(hinge);
  parent.add(tail);
  const fanMat = chitin({ side: THREE.DoubleSide });
  const blade = (len, w0, w1) => {
    const sh = new THREE.Shape();
    sh.moveTo(-w0 / 2, 0);
    sh.lineTo(w0 / 2, 0);
    sh.bezierCurveTo(w1 / 2 + 0.03, -len * 0.5, w1 / 2, -len, 0, -len * 1.04);
    sh.bezierCurveTo(-w1 / 2, -len, -w1 / 2 - 0.03, -len * 0.5, -w0 / 2, 0);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.025, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 14 });
    g.translate(0, 0, -0.0125);
    g.rotateX(Math.PI / 2); // lie flat, pointing back (-z)
    paint(g, (c, u, v, x, y, z) => { const k = clamp(-z / len); c.copy(RED).lerp(CREAM, ss2(0.45, 0.95, k)); });
    return g;
  };
  function ss2(a, b, x) { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); }
  add(tail, blade(0.62, 0.2, 0.2), fanMat).position.set(0, 0.0, 0.02);
  const uropods = [];
  for (const s of [1, -1]) for (const k of [0, 1]) {
    const u = add(tail, blade(0.58 - k * 0.04, 0.12, 0.26), fanMat);
    u.position.set(s * 0.06, -0.02 - k * 0.01, 0.02);
    u.userData.base = s * (0.38 + k * 0.32);
    u.rotation.y = u.userData.base;
    uropods.push(u);
  }

  // ---------------- major (snapping) claw ----------------
  const S = bigSide;
  const claw = new THREE.Group(); // shoulder
  claw.position.set(S * 0.3, -0.12, 1.22);
  body.add(claw);
  const merusGeo = loftGeo([V(0, 0, 0), V(0, 0.02, 0.35), V(0, 0.02, 0.72)], profile([[0, 0.09, 0.1, 0.1], [0.5, 0.13, 0.15, 0.13], [1, 0.11, 0.13, 0.12]]), 14, 18);
  paint(merusGeo, (c, u) => c.copy(CREAM).lerp(RED, 0.35 + 0.6 * Math.exp(-(((u - 0.55) / 0.2) ** 2))));
  add(claw, merusGeo, matClaw);
  const carpus = new THREE.Group();
  carpus.position.set(0, 0.02, 0.72);
  claw.add(carpus);
  {
    const g = new THREE.SphereGeometry(1, 20, 14);
    g.scale(0.15, 0.17, 0.2);
    g.translate(0, 0, 0.12);
    paint(g, (c) => c.copy(CREAM).lerp(RED, 0.3));
    add(carpus, g, matClaw);
  }
  const palm = new THREE.Group();
  palm.position.set(0, 0.02, 0.28);
  carpus.add(palm);
  // palm (propodus): smooth swollen oval, slightly compressed, front tapers into the pollex
  const PL = 1.25, PH = 0.42, PW = 0.3;
  const palmGeo = loftGeo([V(0, 0, -0.02), V(0, 0.03, 0.3), V(0, 0.04, 0.75), V(0, 0.0, PL)], profile([
    [0, 0.14, 0.15, 0.15], [0.15, PW * 0.9, PH * 0.85, PH * 0.85], [0.55, PW, PH, PH * 0.98], [0.85, PW * 0.88, PH * 0.88, PH * 0.9], [1, PW * 0.55, PH * 0.4, PH * 0.6],
  ]), 30, 32);
  paint(palmGeo, (c, u, v, x, y, z) => {
    // orange-red palm with a creamy band, darker groove marks
    const band = Math.exp(-(((u - 0.32) / 0.07) ** 2));
    c.copy(ORANGE).lerp(RED, clamp(0.5 + y * 1.2)).lerp(CREAM, band * 0.85);
    if (noise3(x * 5, y * 5, z * 3) > 0.55) c.lerp(DEEP, 0.4);
  });
  add(palm, palmGeo, matClaw);
  // fixed finger (pollex): from the lower front, slightly upturned, with the socket on top
  const pollexGeo = loftGeo([V(0, -0.12, PL - 0.1), V(0, -0.1, PL + 0.22), V(0, -0.04, PL + 0.5)], profile([[0, 0.17, 0.12, 0.17], [0.6, 0.12, 0.08, 0.11], [1, 0.03, 0.03, 0.03]]), 16, 18);
  paint(pollexGeo, (c, u) => c.copy(RED).lerp(CREAM, ss2(0.5, 1, u)));
  add(palm, pollexGeo, matClaw);
  const socket = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8), new THREE.MeshStandardMaterial({ color: '#2a0508', roughness: 0.6 }));
  socket.scale.set(0.07, 0.025, 0.09);
  socket.position.set(0, -0.025, PL + 0.04);
  palm.add(socket);
  // movable finger (dactyl) on a hinge at the upper front of the palm; plunger below it
  const dactyl = new THREE.Group();
  dactyl.position.set(0, 0.22, PL - 0.1);
  palm.add(dactyl);
  const dactylGeo = loftGeo([V(0, 0, 0), V(0, -0.02, 0.28), V(0, -0.12, 0.56), V(0, -0.22, 0.68)], profile([[0, 0.15, 0.13, 0.12], [0.35, 0.15, 0.14, 0.13], [0.8, 0.1, 0.09, 0.08], [1, 0.03, 0.03, 0.03]]), 18, 20);
  paint(dactylGeo, (c, u) => c.copy(RED).lerp(CREAM, ss2(0.55, 1, u)).lerp(new THREE.Color('#bcd6ff'), 0.35 * ss2(0.85, 1, u)));
  add(dactyl, dactylGeo, matClaw);
  const plunger = add(dactyl, (() => { const g = new THREE.SphereGeometry(1, 14, 10); g.scale(0.06, 0.07, 0.07); paint(g, (c) => c.copy(DEEP)); return g; })(), matClaw);
  plunger.position.set(0, -0.13, 0.14);
  plunger.scale.setScalar(0.75);

  // ---------------- minor claw (other side) ----------------
  const mclaw = new THREE.Group();
  mclaw.position.set(-S * 0.27, -0.16, 1.2);
  body.add(mclaw);
  const mSeg = (len, r0, r1, parentG) => {
    const g = loftGeo([V(0, 0, 0), V(0, 0, len * 0.5), V(0, 0, len)], profile([[0, r0, r0, r0], [1, r1, r1, r1]]), 10, 10);
    paint(g, (c, u) => c.copy(CREAM).lerp(RED, 0.45 + 0.45 * Math.sin(u * Math.PI)));
    add(parentG, g, matClaw);
  };
  mSeg(0.6, 0.055, 0.06, mclaw);
  const mcarp = new THREE.Group();
  mcarp.position.z = 0.6;
  mclaw.add(mcarp);
  mSeg(0.25, 0.06, 0.07, mcarp);
  const mpalm = new THREE.Group();
  mpalm.position.z = 0.25;
  mcarp.add(mpalm);
  {
    const g = loftGeo([V(0, 0, 0), V(0, 0, 0.25), V(0, -0.01, 0.48)], profile([[0, 0.07, 0.08, 0.08], [0.5, 0.1, 0.11, 0.1], [1, 0.07, 0.07, 0.07]]), 12, 14);
    paint(g, (c) => c.copy(RED).lerp(ORANGE, 0.4));
    add(mpalm, g, matClaw);
    for (const k of [1, -1]) {
      const f = loftGeo([V(0, 0.03 * k, 0.46), V(0, 0.035 * k, 0.6), V(0, 0.01 * k, 0.72)], profile([[0, 0.035, 0.035, 0.035], [1, 0.012, 0.012, 0.012]]), 8, 8);
      paint(f, (c, u) => c.copy(RED).lerp(CREAM, u));
      add(mpalm, f, matClaw);
    }
  }

  // ---------------- per-frame world-space parts: legs, maxillipeds, antennae ----------------
  const legMat = chitin();
  const lofts = [];
  const mkLoft = (rings, segsN, colorFn) => {
    const L = new Loft(rings, segsN);
    paint(L.geo, colorFn);
    const m = new THREE.Mesh(L.geo, legMat);
    m.castShadow = true;
    m.frustumCulled = false;
    world.add(m);
    lofts.push(L);
    return L;
  };
  const bandFn = (n, a = 0.75) => (c, u) => c.copy(CREAM).lerp(RED, a * (0.5 + 0.5 * Math.sin(u * Math.PI * 2 * n)) ** 2);
  // walking legs: 2nd (slender), 3rd–5th; on both sides
  const LEGS = [];
  [[1.0, 0.32, 1.25, 0.9, 0.034], [0.72, 0.34, 1.45, 0.25, 0.044], [0.45, 0.34, 1.45, -0.2, 0.046], [0.18, 0.32, 1.4, -0.65, 0.044]].forEach(([z, x, reach, fwd, r], k) => {
    for (const s of [1, -1]) {
      LEGS.push({ hip: V(s * x * 0.85, -0.2, z), s, k, reach, fwd, r, L: mkLoft(16, 6, bandFn(2.5 + k * 0.3)) });
    }
  });
  // third maxillipeds (mouthpart "legs" at the front)
  const MAXI = [1, -1].map((s) => ({ s, L: mkLoft(10, 6, bandFn(2, 0.5)) }));
  // antennules (2 whips per side) and antennae (long whip + flat scale)
  const ANT = [];
  for (const s of [1, -1]) {
    ANT.push({ s, kind: 'ant', len: 4.2, base: V(s * 0.2, 0.0, 1.5), L: mkLoft(40, 5, bandFn(9, 0.85)), r0: 0.03 });
    ANT.push({ s, kind: 'au1', len: 1.05, base: V(s * 0.07, 0.08, 1.62), L: mkLoft(18, 5, bandFn(4, 0.7)), r0: 0.024 });
    ANT.push({ s, kind: 'au2', len: 0.75, base: V(s * 0.08, 0.07, 1.62), L: mkLoft(14, 5, bandFn(3, 0.7)), r0: 0.02 });
    // antennal scale (scaphocerite): a thin translucent blade
    const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.55).translate(0, 0.275, 0), new THREE.MeshStandardMaterial({ color: '#f6e6dc', transparent: true, opacity: 0.7, side: THREE.DoubleSide, roughness: 0.4 }));
    sc.position.set(s * 0.22, -0.02, 1.52);
    sc.rotation.set(-Math.PI / 2 + 0.1, s * 0.25, 0);
    body.add(sc);
  }

  // ---------------- pose ----------------
  const tmp = V(), q = new THREE.Quaternion();
  const out = { minorTip: V(), tip: V(), jetDir: V(), head: V(), eyes: [V(), V()], center: V(), palm: V(), dactylTip: V(), socket: V() };
  const toW = (obj, p, o = V()) => o.copy(p).applyMatrix4(obj.matrixWorld);

  function setPose(p) {
    const t = p.t || 0;
    root.position.set(p.x || 0, p.ground || 0, p.z || 0);
    root.rotation.set(0, p.yaw || 0, 0);
    const h = 0.56 + (p.lift || 0);
    body.position.set(0, h + 0.012 * Math.sin(t * 2.1), p.recoil ? -p.recoil : 0);
    body.rotation.set(-(p.pitch || 0) - 0.03, 0, (p.roll || 0) + 0.015 * Math.sin(t * 1.3));
    // abdomen flex + tail fan spread
    const flex = p.flex || 0;
    segs.forEach((g, i) => { g.rotation.x = 0.05 + flex * (0.1 + i * 0.04) + 0.02 * Math.sin(t * 1.7 - i * 0.6); });
    tail.rotation.x = 0.12 + flex * 0.3;
    for (const u of uropods) u.rotation.y = u.userData.base * (0.85 + 0.15 * (p.fan ?? 1));
    // swimmerets beat in a metachronal wave
    const beat = p.pleo ?? 0.6;
    body.traverse((m) => { if (m.userData.pleo) { const { i, s } = m.userData.pleo; m.rotation.x = 0.35 + beat * 0.45 * Math.sin(t * 11 - i * 0.9); m.rotation.z = s * 0.15; } });
    // major claw: aim, cocking (dactyl opening) and the snap
    const aim = p.aim || [0, 0];
    claw.rotation.set(-0.42 - aim[0], -S * 0.1 + aim[1], S * 0.05);
    carpus.rotation.set(0.5 + aim[0] * 0.3, S * 0.12, 0);
    palm.rotation.set(-0.02, -S * 0.05, (p.clawRoll || 0));
    dactyl.rotation.x = -(p.open || 0) * 1.35; // ~77° fully cocked
    // minor claw tucked forward
    mclaw.rotation.set(-0.15 + 0.05 * Math.sin(t * 1.4), S * 0.25, 0);
    mcarp.rotation.set(0.9 + 0.1 * Math.sin(t * 1.9), 0, 0);
    mpalm.rotation.set(-0.5, 0, 0);
    root.updateMatrixWorld(true);

    // legs: IK from hip to a foot on the sand (with an optional walk cycle)
    const gait = p.walk || 0, ph = p.phase || 0;
    for (const lg of LEGS) {
      const hip = toW(body, lg.hip);
      const off = (lg.k + (lg.s > 0 ? 0 : 2)) % 4;
      const cyc = ph * Math.PI * 2 + off * Math.PI * 0.5;
      const swing = gait * 0.22 * Math.sin(cyc);
      const raise = gait * 0.12 * Math.max(0, Math.cos(cyc));
      const footL = V(lg.s * lg.reach * 0.9, 0, lg.hip.z + lg.fwd * 0.55 + swing);
      const foot = footL.applyMatrix4(root.matrixWorld);
      foot.y = (p.ground || 0) + 0.015 + raise;
      const outv = V(lg.s, 0, 0).applyQuaternion(root.quaternion);
      const hint = outv.add(V(0, 1.4, 0));
      const l1 = lg.k === 0 ? 0.62 : 0.72, l2 = lg.k === 0 ? 0.75 : 0.95;
      const [knee, ft] = ik2(hip, foot, l1, l2, hint);
      const r = lg.r;
      lg.L.update([hip, hip.clone().lerp(knee, 0.5), knee, knee.clone().lerp(ft, 0.55), ft], profile([[0, r * 1.2, r * 1.2, r * 1.2], [0.45, r, r, r], [0.55, r * 0.9, r * 0.9, r * 0.9], [1, r * 0.35, r * 0.35, r * 0.35]]));
    }
    for (const mx of MAXI) {
      const a = toW(body, V(mx.s * 0.1, -0.22, 1.42));
      const b = toW(body, V(mx.s * 0.14, -0.38, 1.7 + 0.03 * Math.sin(t * 3 + mx.s)));
      const c2 = toW(body, V(mx.s * 0.1, -0.36, 1.95 + 0.04 * Math.sin(t * 3.4 + mx.s)));
      mx.L.update([a, b, c2], profile([[0, 0.04, 0.04, 0.04], [1, 0.018, 0.018, 0.018]]));
    }
    // antennae: sweep forward-out then curve back; flicking waves
    const flick = p.flick || 0;
    for (const an of ANT) {
      const n = an.kind === 'ant' ? 9 : 6;
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const f = i / n, d = f * an.len;
        let lp;
        if (an.kind === 'ant') {
          // long antenna: forward and outward, then arcs back along the body side
          const ang = lerp(0.35, 2.2, f ** 1.3) + 0.25 * Math.sin(t * 1.3 + an.s) * f + flick * 0.5 * Math.sin(t * 9 + f * 5) * f;
          lp = V(an.s * (0.2 + Math.sin(ang) * d * 0.55), 0.05 + d * 0.22 * Math.sin(f * 2.4) + 0.08 * Math.sin(t * 2 + f * 4 + an.s) * f, 1.5 + Math.cos(ang) * d * 0.62);
        } else {
          const spread = an.kind === 'au1' ? 0.32 : 0.6;
          const wig = 0.12 * Math.sin(t * (an.kind === 'au1' ? 5.5 : 4.3) + f * 3 + an.s) * f + flick * 0.25 * Math.sin(t * 14 + f * 4) * f;
          lp = V(an.s * (0.07 + d * Math.sin(spread) * 0.7) + wig, 0.08 + d * 0.38 * f + 0.06 * Math.sin(t * 3 + an.s) * f, 1.62 + d * Math.cos(spread) * 0.95);
        }
        pts.push(toW(body, lp));
      }
      const r0 = an.r0;
      an.L.update(pts, (u) => { const r = lerp(r0, r0 * 0.18, u ** 0.6); return [r, r, r]; });
    }

    // outputs (world): jet origin = just ahead of the closed fingers, direction = claw axis
    toW(palm, V(0, 0.0, PL + 0.18), out.tip);
    toW(palm, V(0, 0.0, PL + 1.2), tmp);
    out.jetDir.copy(tmp).sub(out.tip).normalize();
    toW(palm, V(0, 0, PL * 0.5), out.palm);
    toW(dactyl, V(0, -0.22, 0.68), out.dactylTip);
    toW(palm, V(0, -0.02, PL + 0.04), out.socket);
    toW(mpalm, V(0, 0, 0.72), out.minorTip);
    toW(body, V(0, 0.15, 1.4), out.head);
    toW(body, V(0, 0, 0.2), out.center);
    eyes.forEach((e, i) => e.getWorldPosition(out.eyes[i]));
    return out;
  }

  return { root, world, setPose, out, parts, palmGroup: palm, dactyl };
}
