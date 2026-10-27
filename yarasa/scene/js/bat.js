import * as THREE from 'three';
import { canvasTexture, rng, clamp } from './util.js';

// ---------------------------------------------------------------------------
// A small insect-eating bat. Local axes: forward = +Z, up = +Y, wings along ±X.
// The wing is a real skeleton (humerus → forearm → wrist → digits III/IV/V);
// the membrane is rebuilt every frame from the joint positions, so the wing
// extends on the downstroke and half-folds on the upstroke.
// ---------------------------------------------------------------------------

function furTex(base, seed) {
  const r = rng(seed);
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      const x = r() * w, y = r() * h, a = r() * 6.28, l = 2 + r() * 4;
      g.strokeStyle = r() < 0.55 ? 'rgba(255,220,180,0.10)' : 'rgba(20,10,5,0.25)';
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
    }
  });
}

const v = (x, y, z) => new THREE.Vector3(x, y, z);

export function createBat() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const fur = new THREE.MeshPhysicalMaterial({ map: furTex('#4e3a2e', 3), roughness: 0.92, sheen: 0.35, sheenRoughness: 0.6, sheenColor: new THREE.Color('#8a6a55') });
  const skin = new THREE.MeshStandardMaterial({ color: '#3a2a26', roughness: 0.55 });
  const pink = new THREE.MeshStandardMaterial({ color: '#c98a86', roughness: 0.6 });
  const eyeMat = new THREE.MeshPhysicalMaterial({ color: '#0b0706', roughness: 0.15, clearcoat: 1 });
  const shine = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 0.95, 1.0) });
  const membrane = new THREE.MeshPhysicalMaterial({ color: '#3a2c29', roughness: 0.6, side: THREE.DoubleSide, sheen: 0.4, sheenColor: new THREE.Color('#a07a6a'), emissive: new THREE.Color('#3a1810'), emissiveIntensity: 0.22, transmission: 0 });
  const S = new THREE.SphereGeometry(1, 32, 20);
  const add = (geo, mat, parent, pos, scl, rot) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...pos);
    if (scl) (typeof scl === 'number' ? m.scale.setScalar(scl) : m.scale.set(...scl));
    if (rot) m.rotation.set(...rot);
    m.castShadow = true;
    parent.add(m);
    return m;
  };

  // torso + belly
  add(S, fur, body, [0, 0, 0], [0.13, 0.115, 0.27]);
  add(S, fur, body, [0, -0.025, 0.04], [0.11, 0.095, 0.2]);
  // head
  const head = new THREE.Group();
  head.position.set(0, 0.05, 0.3);
  body.add(head);
  add(S, fur, head, [0, 0, 0], [0.095, 0.088, 0.1]);
  add(S, fur, head, [0, -0.012, 0.075], [0.052, 0.045, 0.06]); // short snout
  add(S, skin, head, [0, 0.0, 0.128], [0.022, 0.017, 0.014]); // nose pad
  for (const sx of [-1, 1]) add(S, skin, head, [0.009 * sx, 0.002, 0.139], 0.0045); // nostrils
  // lower jaw (opens when calling)
  const jaw = new THREE.Group();
  jaw.position.set(0, -0.035, 0.05);
  head.add(jaw);
  add(S, fur, jaw, [0, -0.01, 0.045], [0.04, 0.016, 0.055]);
  add(S, pink, head, [0, -0.038, 0.085], [0.032, 0.01, 0.04]); // mouth interior
  // eyes
  for (const sx of [-1, 1]) {
    add(S, eyeMat, head, [0.045 * sx, 0.03, 0.07], 0.014);
    add(S, shine, head, [0.049 * sx, 0.035, 0.081], 0.0025).castShadow = false;
  }
  // big ears (outer + pink inner), twitch when listening
  // ear = thin cupped half-ellipsoid (opening forward) with a pinkish inner side and a small tragus
  const earGeo = new THREE.SphereGeometry(1, 22, 14, 0, Math.PI);
  earGeo.rotateY(Math.PI);
  earGeo.translate(0, 0.85, 0);
  { const p = earGeo.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) * (1.05 - 0.35 * Math.max(0, y - 0.9))); } earGeo.computeVertexNormals(); }
  const earMat = new THREE.MeshStandardMaterial({ color: '#3b2a25', roughness: 0.55, side: THREE.DoubleSide, emissive: new THREE.Color('#2a0f0a'), emissiveIntensity: 0.25 });
  const ears = [];
  for (const sx of [-1, 1]) {
    const eg = new THREE.Group();
    eg.position.set(0.05 * sx, 0.055, -0.005);
    head.add(eg);
    add(earGeo, earMat, eg, [0, 0, 0], [0.045, 0.062, 0.026]);
    add(earGeo, pink, eg, [0, 0.005, 0.004], [0.036, 0.055, 0.019]);
    add(S, earMat, eg, [0, 0.03, 0.02], [0.007, 0.02, 0.004]); // tragus
    ears.push({ g: eg, sx });
  }

  // legs + tail membrane
  const legs = [];
  for (const sx of [-1, 1]) {
    const lg = new THREE.Group();
    lg.position.set(0.07 * sx, -0.04, -0.2);
    body.add(lg);
    add(new THREE.CylinderGeometry(0.012, 0.01, 0.16, 6), skin, lg, [0.02 * sx, -0.02, -0.07], 1, [1.25, 0, 0.25 * sx]);
    legs.push(lg);
  }

  // ---- wings ----
  const bone = new THREE.MeshStandardMaterial({ color: '#2c201d', roughness: 0.5 });
  const boneGeo = new THREE.CylinderGeometry(1, 0.8, 1, 6);
  boneGeo.translate(0, 0.5, 0);
  const N = 7; // membrane subdivision per triangle
  function triGrid() {
    const idx = [];
    const row = (i) => (i * (i + 1)) / 2;
    for (let i = 0; i < N; i++) for (let j = 0; j <= i; j++) {
      const a = row(i) + j, b = row(i + 1) + j, c = row(i + 1) + j + 1;
      idx.push(a, b, c);
      if (j < i) idx.push(a, c, a + 1);
    }
    return idx;
  }
  const TRI = 6; // fan triangles per wing
  const vpt = ((N + 1) * (N + 2)) / 2;
  const wings = [];
  for (const sx of [1, -1]) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(TRI * vpt * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const tri = triGrid(), idx = [];
    for (let k = 0; k < TRI; k++) for (const i of tri) idx.push(i + k * vpt);
    geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, membrane);
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    body.add(mesh);
    const bones = Array.from({ length: 8 }, () => {
      const b = new THREE.Mesh(boneGeo, bone);
      b.castShadow = true;
      body.add(b);
      return b;
    });
    const claw = add(new THREE.ConeGeometry(0.012, 0.04, 6), bone, body, [0, 0, 0]);
    wings.push({ sx, geo, pos, bones, claw });
  }

  function setBone(b, a, c, r) {
    const d = c.clone().sub(a);
    const len = d.length();
    b.position.copy(a);
    b.quaternion.setFromUnitVectors(v(0, 1, 0), d.normalize());
    b.scale.set(r, len, r);
  }

  // wing skeleton for phase φ (0 = top of stroke), extension e (1 open … 0.5 folded)
  function skeleton(sx, phi, amp, e, tuck) {
    const th = amp * Math.cos(2 * Math.PI * phi) + 0.12 - 1.1 * tuck; // elevation (+ up)
    const sweep = 0.18 * Math.sin(2 * Math.PI * phi);
    const Sh = v(0.11, 0.05, 0.1);
    // planform in the x–z plane (x outward, z forward)
    const P = (ang, len, from) => from.clone().add(v(Math.cos(ang) * len, 0, Math.sin(ang) * len));
    const aH = -0.55 - 0.5 * tuck;
    const E = P(aH, 0.2, Sh);
    const aF = THREE.MathUtils.lerp(-1.55, 0.32, e) - 0.9 * tuck;
    const Wr = P(aF, 0.34, E);
    const sp = THREE.MathUtils.lerp(0.25, 1, e) * (1 - tuck * 0.8);
    const ls = THREE.MathUtils.lerp(0.55, 1, e);
    const D3 = P(aF - 0.12 * sp - 0.15, 0.56 * ls, Wr);
    const D4 = P(aF - 0.95 * sp - 0.2, 0.44 * ls, Wr);
    const D5 = P(aF - 1.75 * sp - 0.25, 0.34 * ls, Wr);
    const Th = P(aF + 0.35, 0.05, Wr);
    const Hip = v(0.07, -0.03, -0.26);
    const Mid3 = Wr.clone().lerp(D3, 0.5), Mid4 = Wr.clone().lerp(D4, 0.5), Mid5 = Wr.clone().lerp(D5, 0.5);
    // cupping: outer wing bends down a little during the downstroke
    const cup = 0.06 * e * (0.6 + 0.4 * Math.sin(2 * Math.PI * phi));
    for (const p of [D3, D4, D5]) p.y -= cup;
    for (const p of [Mid3, Mid4, Mid5]) p.y -= cup * 0.4;
    // rotate the whole arm about the body axis (z) around the shoulder, plus sweep about y
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, sweep, th, 'YXZ'));
    const pts = { Sh, E, Wr, D3, D4, D5, Th, Hip, Mid3, Mid4, Mid5 };
    for (const k of Object.keys(pts)) {
      if (k === 'Sh' || k === 'Hip') continue;
      pts[k].sub(Sh).applyQuaternion(q).add(Sh);
    }
    // mirror for the left wing
    for (const k of Object.keys(pts)) pts[k].x *= sx;
    return pts;
  }

  function fillTri(arr, k, A, B, C, billow, scallopBC) {
    // A = apex at the wrist side, B–C = trailing edge (scalloped inward)
    let o = k * vpt * 3;
    const n = new THREE.Vector3().subVectors(B, A).cross(new THREE.Vector3().subVectors(C, A)).normalize();
    for (let i = 0; i <= N; i++) for (let j = 0; j <= i; j++) {
      const u = i / N, w = i ? j / i : 0;
      // barycentric: A*(1-u) + (B*(1-w) + C*w)*u
      const p = A.clone().multiplyScalar(1 - u).addScaledVector(B, u * (1 - w)).addScaledVector(C, u * w);
      if (scallopBC && i === N) p.lerp(A, 0.22 * Math.sin(Math.PI * w));
      else if (scallopBC) p.lerp(A, 0.22 * Math.sin(Math.PI * w) * u * u);
      p.addScaledVector(n, -billow * Math.sin(Math.PI * u) * Math.sin(Math.PI * w) * u);
      arr[o++] = p.x;
      arr[o++] = p.y;
      arr[o++] = p.z;
    }
  }

  const bat = {
    root, body, head,
    mouth() { return head.localToWorld(v(0, -0.02, 0.2)); },
    setPose(p) {
      const t = p.t ?? 0;
      const phi = p.phase ?? 0;
      const amp = p.amp ?? 1.05;
      const tuck = clamp(p.tuck ?? 0);
      const e = 0.775 + 0.225 * Math.cos(2 * Math.PI * (phi - 0.25)); // open on the downstroke
      body.position.y = -0.03 * Math.cos(2 * Math.PI * phi);
      body.rotation.set(p.pitch ?? 0, 0, p.roll ?? 0);
      head.rotation.set((p.headPitch ?? 0) - 0.05, p.headYaw ?? 0, 0);
      jaw.rotation.x = 0.45 * clamp(p.call ?? 0);
      for (const ea of ears) ea.g.rotation.set(-0.15 + 0.15 * (p.listen ?? 0) * Math.sin(t * 13 + ea.sx), 0.25 * ea.sx, -0.55 * ea.sx + 0.08 * Math.sin(t * 7 + ea.sx) * (p.listen ?? 0));
      for (const lg of legs) lg.rotation.x = 0.2 * Math.sin(2 * Math.PI * phi);
      for (const W of wings) {
        const k = skeleton(W.sx, phi, amp, e, tuck);
        const bill = 0.05 * e;
        fillTri(W.pos, 0, k.Sh, k.E, k.Wr, 0.01, false); // propatagium (leading edge)
        fillTri(W.pos, 1, k.Wr, k.Th, k.D3, 0.0, false);
        fillTri(W.pos, 2, k.Wr, k.D3, k.D4, bill, true);
        fillTri(W.pos, 3, k.Wr, k.D4, k.D5, bill, true);
        fillTri(W.pos, 4, k.Wr, k.D5, k.Hip, bill * 1.4, true);
        fillTri(W.pos, 5, k.Sh, k.Wr, k.Hip, bill * 0.5, false);
        W.geo.attributes.position.needsUpdate = true;
        W.geo.computeVertexNormals();
        const B = W.bones;
        setBone(B[0], k.Sh, k.E, 0.016);
        setBone(B[1], k.E, k.Wr, 0.013);
        setBone(B[2], k.Wr, k.Mid3, 0.009);
        setBone(B[3], k.Mid3, k.D3, 0.006);
        setBone(B[4], k.Wr, k.Mid4, 0.008);
        setBone(B[5], k.Mid4, k.D4, 0.005);
        setBone(B[6], k.Wr, k.Mid5, 0.008);
        setBone(B[7], k.Mid5, k.D5, 0.005);
        W.claw.position.copy(k.Th);
      }
    },
  };
  bat.setPose({});
  return bat;
}

// A small moth with fluttering wings.
export function createMoth() {
  const root = new THREE.Group();
  const furM = new THREE.MeshPhysicalMaterial({ color: '#c9b48e', roughness: 0.9, sheen: 1, sheenColor: new THREE.Color('#fff2d8') });
  const wingTex = canvasTexture(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const grd = g.createLinearGradient(0, 0, w, h);
    grd.addColorStop(0, '#e6d6b4');
    grd.addColorStop(1, '#a88c62');
    g.fillStyle = grd;
    g.beginPath();
    g.ellipse(w * 0.5, h * 0.5, w * 0.48, h * 0.36, 0.3, 0, 7);
    g.fill();
    g.fillStyle = 'rgba(80,55,30,0.55)';
    for (const [x, y, r] of [[0.62, 0.42, 0.08], [0.4, 0.58, 0.05], [0.75, 0.6, 0.04]]) { g.beginPath(); g.arc(x * w, y * h, r * w, 0, 7); g.fill(); }
  });
  const wingMat = new THREE.MeshStandardMaterial({ map: wingTex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.8, emissive: new THREE.Color('#3a2a14'), emissiveIntensity: 0.4 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), furM);
  body.scale.set(0.03, 0.03, 0.08);
  root.add(body);
  const wg = new THREE.PlaneGeometry(0.16, 0.12);
  wg.translate(0.08, 0, 0);
  wg.rotateX(-Math.PI / 2);
  const wings = [];
  for (const sx of [1, -1]) for (const fz of [0.02, -0.04]) {
    const pv = new THREE.Group();
    pv.position.set(0.02 * sx, 0.01, fz);
    pv.scale.x = sx;
    const m = new THREE.Mesh(wg, wingMat);
    if (fz < 0) m.scale.setScalar(0.78);
    pv.add(m);
    root.add(pv);
    wings.push(pv);
  }
  for (const sx of [-1, 1]) {
    const an = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.07, 4), furM);
    an.position.set(0.015 * sx, 0.02, 0.1);
    an.rotation.set(1.0, 0, -0.4 * sx);
    root.add(an);
  }
  return {
    root,
    glow(g) { wingMat.emissiveIntensity = 0.9 + 6 * g; furM.emissive = furM.emissive || new THREE.Color(); furM.emissive.setRGB(1, 0.6, 0.25).multiplyScalar(2.5 * g); },
    setPose({ t = 0, hz = 9 }) {
      const a = 0.9 * Math.sin(t * Math.PI * 2 * hz);
      for (const w of wings) w.rotation.z = a * w.scale.x; // mirrored pivots flap symmetrically
    },
  };
}
