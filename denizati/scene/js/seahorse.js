import * as THREE from 'three';
import { canvasTexture, rng, clamp, lerp } from './util.js';
import { Loft, profile } from './loft.js';

// ---------------------------------------------------------------------------
// Seahorse character (Hippocampus), ~1 unit tall. Local: y up, z = front (belly
// and snout), x = lateral. Real anatomy — horse-like head on a bent neck, tube
// snout, coronet, bony ring segments, fluttering dorsal fin, small pectoral fins
// behind the eyes, prehensile tail that curls ventrally; males have a brood
// pouch, females an ovipositor — with a cute layer on top: big expressive eyes
// with lids, blush, a courtship "glow".
// One continuous loft from the tail tip to the snout tip.
// ---------------------------------------------------------------------------
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const X = V(1, 0, 0);

const PALETTES = {
  male: { a: '#ff6a00', b: '#ffa41f', belly: '#ffd77a', pouch: '#fff1c4', spot: '#ffffff', ring: 'rgba(140,50,0,0.35)', fin: '#ffe28a', glow: '#ff9a40', iris: '#2fb6a8' },
  female: { a: '#e0306f', b: '#ff6fa3', belly: '#ffc2d6', pouch: '#ffd0de', spot: '#fff3a0', ring: 'rgba(110,10,50,0.32)', fin: '#ffc2d6', glow: '#ff6fa0', iris: '#7a4cd8' },
  baby: { a: '#f0a640', b: '#ffd27a', belly: '#fff0c8', pouch: '#fff0c8', spot: '#ffffff', ring: 'rgba(90,50,10,0.25)', fin: '#fff2cc', glow: '#ffd080', iris: '#3a2a1a' },
};

function skinTex(pal, seed) {
  const r = rng(seed);
  // x = u (tail tip → snout tip), y = v around the body (0 / 1 ventral, 0.5 dorsal)
  return canvasTexture(1024, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, pal.belly);
    gr.addColorStop(0.22, pal.b);
    gr.addColorStop(0.5, pal.a);
    gr.addColorStop(0.78, pal.b);
    gr.addColorStop(1, pal.belly);
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    // bony rings along tail and trunk (not on the head/snout)
    for (let i = 0; i < 52; i++) {
      const x = (i / 52) * w * 0.74 + 6;
      g.fillStyle = pal.ring;
      g.fillRect(x, 0, 3 + (i > 38 ? 2 : 0), h);
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.fillRect(x + 4, 0, 3, h);
    }
    // lateral ridges
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.fillRect(0, h * 0.24, w * 0.75, 3);
    g.fillRect(0, h * 0.74, w * 0.75, 3);
    // spots and freckles (trunk + head)
    for (let i = 0; i < 160; i++) {
      const x = w * (0.4 + r() * 0.5), y = h * (0.15 + r() * 0.7);
      g.fillStyle = pal.spot;
      g.globalAlpha = 0.35 + r() * 0.5;
      g.beginPath();
      g.arc(x, y, 1.5 + r() * 3.5, 0, 6.283);
      g.fill();
    }
    g.globalAlpha = 1;
  });
}

function eyeTex(iris) {
  // sphere UV with the pole rotated to +z: canvas top rows = front of the eye
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, w, h);
    const gr = g.createLinearGradient(0, 0, 0, h * 0.42);
    gr.addColorStop(0, '#05070a');
    gr.addColorStop(0.42, '#05070a');
    gr.addColorStop(0.5, iris);
    gr.addColorStop(0.86, new THREE.Color(iris).multiplyScalar(0.55).getStyle());
    gr.addColorStop(0.9, '#1a1a22');
    gr.addColorStop(1, '#ffffff');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h * 0.42);
  });
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
const finTex = canvasTexture(256, 128, (g, w, h) => {
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 18; i++) { g.fillStyle = 'rgba(255,255,255,0.95)'; g.fillRect((i / 18) * w, 0, 3, h); }
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, 'rgba(255,255,255,0)');
  gr.addColorStop(1, 'rgba(255,255,255,0.35)');
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
});

export function createSeahorse({ sex = 'male', seed = 3, headScale = 1.15, eyeScale = 1.0, baby = false } = {}) {
  const pal = PALETTES[baby ? 'baby' : sex];
  const root = new THREE.Group();
  const sh = (m) => { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; return m; };
  const skin = new THREE.MeshPhysicalMaterial({
    map: skinTex(pal, seed), roughness: 0.48, sheen: 0.7, sheenColor: new THREE.Color(pal.b), clearcoat: 0.35, clearcoatRoughness: 0.4,
    emissive: new THREE.Color(pal.glow), emissiveIntensity: 0,
  });
  const lidMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(pal.a).lerp(new THREE.Color(pal.b), 0.6), roughness: 0.5, sheen: 0.5, sheenColor: new THREE.Color(pal.b) });
  const loft = new Loft(150, 26);
  const body = sh(new THREE.Mesh(loft.geo, skin));
  root.add(body);

  // ---- head group (eyes, coronet, pectoral fins, blush) ----
  const head = new THREE.Group();
  root.add(head);
  const eyes = [];
  const eGeo = new THREE.SphereGeometry(1, 32, 24);
  eGeo.rotateX(Math.PI / 2);
  const eMat = new THREE.MeshPhysicalMaterial({ map: eyeTex(pal.iris), roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 });
  const lidUp = new THREE.SphereGeometry(1, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  const lidLo = lidUp.clone().rotateX(Math.PI);
  const hlMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const blushMat = new THREE.MeshBasicMaterial({ color: '#ff6f91', transparent: true, opacity: 0, depthWrite: false });
  const ER = 0.045 * eyeScale;
  for (const sx of [-1, 1]) {
    const socket = new THREE.Group();
    socket.position.set(0.06 * sx * headScale, 0.055 * headScale, 0.072 * headScale);
    socket.rotation.y = sx * 1.05; // eyes look sideways-forward
    head.add(socket);
    const ball = sh(new THREE.Mesh(eGeo, eMat));
    ball.scale.setScalar(ER);
    socket.add(ball);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(ER * 0.22, 12, 8), hlMat);
    socket.add(hl);
    const hl2 = new THREE.Mesh(new THREE.SphereGeometry(ER * 0.1, 8, 6), hlMat);
    socket.add(hl2);
    const up = sh(new THREE.Mesh(lidUp, lidMat));
    const lo = sh(new THREE.Mesh(lidLo, lidMat));
    up.scale.setScalar(ER * 1.17);
    lo.scale.setScalar(ER * 1.17);
    socket.add(up, lo);
    const blush = new THREE.Mesh(new THREE.CircleGeometry(0.022, 20), blushMat);
    blush.position.set(0.072 * sx * headScale, 0.008 * headScale, 0.11 * headScale);
    blush.rotation.y = sx * 1.25;
    blush.scale.set(1.3, 0.75, 1);
    head.add(blush);
    eyes.push({ sx, socket, ball, hl, hl2, up, lo });
  }
  // coronet: a little crown of knobs on top of the head
  const knobMat = new THREE.MeshPhysicalMaterial({ color: pal.b, roughness: 0.45, sheen: 0.5 });
  const coronet = new THREE.Group();
  coronet.position.set(0, 0.125 * headScale, 0.02 * headScale);
  head.add(coronet);
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    const c = sh(new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.045, 8), knobMat));
    c.position.set(Math.cos(a) * 0.018, 0.012, Math.sin(a) * 0.018);
    c.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35);
    coronet.add(c);
    const ball = sh(new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 8), knobMat));
    ball.position.copy(c.position).add(V(Math.cos(a) * 0.006, 0.026, Math.sin(a) * 0.006));
    coronet.add(ball);
  }
  const crownBase = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.03, 12), skin));
  coronet.add(crownBase);

  // ---- fins ----
  const finMat = new THREE.MeshStandardMaterial({ color: pal.fin, map: finTex, transparent: true, opacity: 0.92, side: THREE.DoubleSide, depthWrite: false, roughness: 0.4, emissive: new THREE.Color(pal.fin), emissiveIntensity: 0.25 });
  const dFin = new THREE.Mesh(finGeo(18, 5), finMat);
  dFin.frustumCulled = false;
  root.add(dFin);
  const pFins = [-1, 1].map(() => { const m = new THREE.Mesh(finGeo(10, 4), finMat); m.frustumCulled = false; root.add(m); return m; });

  // ---- dorsal knobs (bony tubercles along the back and the tail) ----
  const knobs = new THREE.InstancedMesh(new THREE.ConeGeometry(0.008, 0.022, 6), knobMat, 40);
  knobs.castShadow = true;
  knobs.frustumCulled = false;
  root.add(knobs);

  // ---- female ovipositor, male pouch interior (embryos) ----
  const ovi = sex === 'female' && !baby ? sh(new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.05, 10), new THREE.MeshPhysicalMaterial({ color: '#ffb0c8', roughness: 0.4 }))) : null;
  if (ovi) root.add(ovi);
  const embryos = new THREE.Group();
  embryos.visible = false;
  root.add(embryos);
  const emb = [];
  if (sex === 'male' && !baby) {
    const R = rng(seed + 50);
    const eggMat = new THREE.MeshPhysicalMaterial({ color: '#ff9a3a', emissive: '#ff7a1a', emissiveIntensity: 1.1, roughness: 0.2, transparent: true, opacity: 0.85, depthWrite: false });
    const embMat = new THREE.MeshPhysicalMaterial({ color: '#f3d9a0', emissive: '#d0a050', emissiveIntensity: 0.8, roughness: 0.4 });
    const dotMat = new THREE.MeshBasicMaterial({ color: '#111' });
    for (let k = 0; k < 34; k++) {
      const g = new THREE.Group();
      // fill an ellipsoid (local pouch frame: x lateral, y along body, z ventral depth)
      let p;
      do p = V(R() * 2 - 1, R() * 2 - 1, R() * 2 - 1); while (p.lengthSq() > 1);
      g.position.set(p.x * 0.038, p.y * 0.055, p.z * 0.03);
      g.rotation.set(R() * 6, R() * 6, R() * 6);
      const egg = new THREE.Mesh(new THREE.SphereGeometry(0.0115, 14, 10), eggMat);
      g.scale.setScalar(1.25);
      const curl = new THREE.Mesh(new THREE.TorusGeometry(0.0065, 0.0026, 6, 16, Math.PI * 1.5), embMat);
      const head2 = new THREE.Mesh(new THREE.SphereGeometry(0.0036, 8, 6), embMat);
      head2.position.set(0.0065, 0, 0);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.0016, 6, 4), dotMat);
      eye.position.set(0.0075, 0.002, 0.0028);
      g.add(egg, curl, head2, eye);
      embryos.add(g);
      emb.push({ g, egg, curl, head2, eye });
    }
  }

  // ---- spine construction ----
  const curve = new THREE.CatmullRomCurve3([V(), V(0, 1, 0)], false, 'centripetal');
  const tailPts = (o) => {
    // integrate a curling tail downward from the trunk base; curvature grows toward the tip
    const pts = [];
    const L = 0.66, n = 18, ds = L / n;
    let p = V(0, -0.2, 0), ang = 0.25; // ang: angle from straight down, + = toward the front (ventral)
    for (let i = 0; i < n; i++) {
      const f = (i + 0.5) / n;
      ang += o.curl * (1.2 + 17 * f * f) * ds + o.tailBend * ds * 2;
      p = p.clone().add(V(Math.sin((i * 0.7) + o.t * 2.2) * o.tailSway * ds, -Math.cos(ang) * ds, Math.sin(ang) * ds));
      pts.push(p);
    }
    return pts.reverse(); // tip first
  };

  const world = {};
  const sea = {
    root, head, eyes, body, skin, embryos, world, sex, pal,
    // o: t, curl, tailSway, tailBend, bend (lean), contract (0..1), pouch (0..1 swollen), headPitch, headYaw, headRoll,
    //    fin (flutter rate scale), lid (0..1 upper lid droop), happy (lower lid up), wide (surprise), blink, eyeX, eyeY,
    //    blush, glow, xray (0..1), stage (embryo development 0..1)
    setPose(o0) {
      const o = Object.assign({ t: 0, curl: 1, tailSway: 0.15, tailBend: 0, bend: 0, contract: 0, pouch: 0, headPitch: 0, headYaw: 0, headRoll: 0, fin: 1,
        lid: 0.12, happy: 0, wide: 0, blink: 0, eyeX: 0, eyeY: 0, blush: 0, glow: 0, xray: 0, stage: 0, breathe: 0 }, o0);
      root.updateMatrixWorld(true);
      const c = o.contract;
      const pouch = sex === 'male' && !baby ? o.pouch : 0;
      // trunk (belly forward), neck bends back, head pitched so the snout points forward
      const T0 = V(0, -0.2, 0.0), T1 = V(0, -0.03, 0.05 + 0.025 * c + 0.012 * pouch), T2 = V(0, 0.13, 0.04 + 0.03 * c), T3 = V(0, 0.25, -0.03 + 0.015 * c);
      const lean = new THREE.Quaternion().setFromAxisAngle(X, o.bend);
      for (const p of [T1, T2, T3]) p.sub(T0).applyQuaternion(lean).add(T0);
      const N = V(0, 0.315, -0.025).sub(T0).applyQuaternion(lean).add(T0);
      const hq = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.12 + o.headPitch + 0.25 * c, o.headYaw, o.headRoll, 'YXZ')).premultiply(lean);
      head.position.copy(N);
      head.quaternion.copy(hq);
      head.scale.setScalar(1);
      const hs = headScale;
      const HP = (x, y, z) => V(x, y * hs, z * hs).applyQuaternion(hq).add(N);
      const Hc = HP(0, 0.05, 0.07), S0 = HP(0, 0.03, 0.155), S1 = HP(0, 0.022, 0.215), S2 = HP(0, 0.018, 0.268), S3 = HP(0, 0.016, 0.28); // short, cute snout
      const tail = tailPts(o);
      const pts = [...tail, T0, T1, T2, T3, N, Hc, S0, S1, S2, S3];
      // arc-length position of each named node → profile table
      const cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
      const tot = cum[cum.length - 1];
      const u = (i) => cum[i] / tot;
      const nt = tail.length;
      const iT0 = nt, iT1 = nt + 1, iT2 = nt + 2, iT3 = nt + 3, iN = nt + 4, iH = nt + 5, iS0 = nt + 6, iS1 = nt + 7, iS2 = nt + 8, iS3 = nt + 9;
      const br = 1 + 0.02 * Math.sin(o.breathe);
      const pumpB = 1 - 0.18 * c;
      const tab = [[0, 0.004, 0.004, 0.004]];
      for (let i = 1; i < nt; i++) { const f = i / nt; const r = lerp(0.006, 0.042, Math.pow(f, 0.85)); tab.push([u(i), r, r * 1.1, r * 0.95]); }
      tab.push(
        [u(iT0), 0.062, 0.055, 0.07 + 0.045 * pouch * pumpB],
        [(u(iT0) + u(iT1)) / 2, 0.075 * br, 0.064, (0.09 + 0.085 * pouch) * pumpB * br],
        [u(iT1), 0.085 * br, 0.07, (0.098 + 0.06 * pouch) * pumpB * br],
        [u(iT2), 0.084 * br, 0.074, 0.085],
        [u(iT3), 0.066, 0.064, 0.064],
        [u(iN), 0.056 * hs, 0.06 * hs, 0.052 * hs],
        [u(iH), 0.084 * hs, 0.088 * hs, 0.068 * hs],
        [(u(iH) + u(iS0)) / 2, 0.06 * hs, 0.065 * hs, 0.05 * hs],
        [u(iS0), 0.031 * hs, 0.034 * hs, 0.03 * hs],
        [u(iS1), 0.025 * hs, 0.026 * hs, 0.024 * hs],
        [u(iS2) - 0.004, 0.03 * hs, 0.028 * hs, 0.028 * hs],
        [u(iS2), 0.028 * hs, 0.026 * hs, 0.026 * hs],
        [1, 0.004, 0.004, 0.004],
      );
      const prof = profile(tab);
      curve.points = pts;
      const up = (uu) => curve.getTangentAt(clamp(uu, 0.001, 0.999)).cross(X).normalize(); // dorsal side
      const P = loft.update(pts, prof, up);
      // helpers to sample the surface along the body
      const ring = (uu) => { const i = Math.round(clamp(uu) * (P.length - 1)); return { c: P[i], d: up(uu), r: prof(uu) }; };

      // ---- dorsal knobs ----
      let k = 0;
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
      for (let i = 0; i < 40; i++) {
        const uu = 0.06 + (i / 40) * (u(iT3) - 0.08);
        const s = ring(uu);
        const pos = s.c.clone().addScaledVector(s.d, s.r[1] * 0.96);
        q.setFromUnitVectors(V(0, 1, 0), s.d);
        const sc = (0.55 + 0.45 * Math.min(1, uu / u(iT0))) * (baby ? 0.6 : 1);
        m4.compose(pos, q, V(sc, sc, sc));
        knobs.setMatrixAt(k++, m4);
      }
      knobs.instanceMatrix.needsUpdate = true;

      // ---- dorsal fin (on the back, between T1 and T2), flutters fast ----
      {
        const g = dFin.geometry, a = g.attributes.position.array;
        const cols = 18, rows = 5;
        const u0 = u(iT1) - 0.03, u1 = u(iT2) + 0.005;
        const ph = o.t * 38 * o.fin;
        for (let i = 0; i <= cols; i++) {
          const uu = lerp(u0, u1, i / cols);
          const s = ring(uu);
          const base = s.c.clone().addScaledVector(s.d, s.r[1] * 0.9);
          const tg = curve.getTangentAt(clamp(uu, 0.001, 0.999));
          const hgt = 0.095 * Math.sin(Math.PI * (0.15 + 0.85 * i / cols)) * (baby ? 0.7 : 1);
          for (let j = 0; j <= rows; j++) {
            const f = j / rows;
            const p = base.clone().addScaledVector(s.d, hgt * f).addScaledVector(tg, -0.02 * f).addScaledVector(X, Math.sin(ph - i * 0.85) * 0.018 * f * f);
            a.set([p.x, p.y, p.z], (i * (rows + 1) + j) * 3);
          }
        }
        g.attributes.position.needsUpdate = true;
        g.computeVertexNormals();
      }
      // ---- pectoral fins behind the eyes ----
      pFins.forEach((pf, n) => {
        const sx = n ? 1 : -1;
        const g = pf.geometry, a = g.attributes.position.array;
        const ph = o.t * 30 * o.fin + n * 1.3;
        for (let i = 0; i <= 10; i++) for (let j = 0; j <= 4; j++) {
          const ang = -0.9 + 1.8 * (i / 10), f = j / 4;
          const p = HP(sx * (0.06 + 0.004 * f), 0.0 + Math.sin(ang) * 0.035 * f, -0.03 + Math.cos(ang) * -0.005 - 0.032 * f);
          p.addScaledVector(X.clone().applyQuaternion(hq), sx * (0.012 * f + Math.sin(ph - i * 0.7) * 0.01 * f));
          a.set([p.x, p.y, p.z], (i * 5 + j) * 3);
        }
        g.attributes.position.needsUpdate = true;
        g.computeVertexNormals();
      });

      // ---- eyes & expression ----
      const blink = clamp(o.blink);
      for (const e of eyes) {
        const look = new THREE.Euler(-o.eyeY * 0.5, (o.eyeX * e.sx) * 0.5, 0);
        e.ball.rotation.copy(look);
        e.ball.scale.setScalar(ER * (1 + 0.12 * o.wide));
        const hp = V(0.3, 0.42, 0.85).normalize().multiplyScalar(ER * (1 + 0.12 * o.wide) * 0.98);
        e.hl.position.copy(hp.clone().applyEuler(new THREE.Euler(0, -e.sx * 0.35, 0)));
        e.hl2.position.copy(V(-0.35, -0.3, 0.88).normalize().multiplyScalar(ER * 0.99));
        const upClose = clamp(Math.max(o.lid * (1 - o.wide), blink) - 0.15 * o.wide);
        const loClose = clamp(Math.max(o.happy * 0.55, blink * 0.45));
        e.up.rotation.x = lerp(-Math.PI / 2 - 0.25, Math.PI / 2 * 0.98, upClose);
        e.lo.rotation.x = lerp(Math.PI / 2 + 0.25, -Math.PI / 2 * 0.98, loClose);
      }
      blushMat.opacity = 0.55 * clamp(o.blush);
      skin.emissiveIntensity = 0.35 * clamp(o.glow);
      finMat.emissiveIntensity = 0.15 + 0.5 * clamp(o.glow);

      // ---- female ovipositor ----
      const pouchU = (u(iT0) + u(iT1)) / 2;
      const ps = ring(pouchU);
      const ventral = ps.d.clone().negate();
      if (ovi) {
        const s0 = ring(u(iT0) + 0.004);
        ovi.position.copy(s0.c).addScaledVector(s0.d, -s0.r[2] * 0.95);
        ovi.quaternion.setFromUnitVectors(V(0, 1, 0), s0.d.clone().negate().add(V(0, -0.3, 0.2)).normalize());
        world.ovi = root.localToWorld(ovi.position.clone().addScaledVector(s0.d, -0.03));
      }
      // pouch opening (top of the pouch) and pouch centre
      const so = ring(u(iT1) - 0.006);
      world.pouchOpen = root.localToWorld(so.c.clone().addScaledVector(so.d, -so.r[2] * 0.98));
      world.pouchCenter = root.localToWorld(ps.c.clone().addScaledVector(ventral, ps.r[2] * 0.45));
      world.head = root.localToWorld(Hc.clone());
      world.snout = root.localToWorld(S2.clone());
      world.eye = root.localToWorld(HP(0.07, 0.07, 0.075));
      world.belly = root.localToWorld(ring(u(iT1)).c.clone());
      world.tailCurl = root.localToWorld(tail.slice(0, 5).reduce((s, p) => s.add(p), V()).multiplyScalar(1 / 5));
      world.top = root.localToWorld(coronet.position.clone().applyQuaternion(hq).add(N));

      // ---- x-ray: see the embryos inside the pouch ----
      const xr = clamp(o.xray);
      skin.transparent = xr > 0.01;
      skin.opacity = 1 - 0.82 * xr;
      skin.sheen = 0.7 * (1 - xr);
      skin.clearcoat = 0.35 * (1 - xr);
      skin.depthWrite = xr < 0.5;
      embryos.visible = xr > 0.02;
      if (embryos.visible) {
        embryos.position.copy(ps.c).addScaledVector(ventral, ps.r[2] * 0.42);
        embryos.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, curve.getTangentAt(pouchU), ventral));
        const st = clamp(o.stage);
        for (const e of emb) {
          e.egg.material.opacity = 0.85 * (1 - 0.75 * st);
          const g = 0.35 + 0.65 * st;
          e.curl.scale.setScalar(g);
          e.head2.scale.setScalar(g);
          e.head2.position.set(0.0065 * g, 0, 0);
          e.eye.visible = st > 0.3;
          e.eye.position.set(0.0075 * g, 0.002 * g, 0.0028 * g);
        }
      }
      root.updateMatrixWorld(true);
      return world;
    },
  };
  sea.setPose({});
  return sea;
}

// bake a static baby seahorse (body + eyes) for instancing
export function bakeBaby() {
  const b = createSeahorse({ sex: 'male', baby: true, headScale: 1.45, eyeScale: 1.25, seed: 9 });
  b.setPose({ curl: 1.25, lid: 0.05, t: 0 });
  const body = b.body.geometry.clone();
  const eyeGeos = [];
  for (const e of b.eyes) {
    const g = new THREE.SphereGeometry(1, 12, 10);
    e.ball.updateMatrixWorld(true);
    g.applyMatrix4(e.ball.matrixWorld);
    eyeGeos.push(g);
  }
  return { body, eyes: eyeGeos, skin: b.skin };
}
