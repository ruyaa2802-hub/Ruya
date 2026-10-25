import * as THREE from 'three';
import { canvasTexture, rng, clamp } from './util.js';

// ---------------------------------------------------------------------------
// Pırıltı & friends — one honeybee design, built from simple primitives.
// Local axes: forward = +Z, up = +Y, right = -X (three.js convention for lookAt is +Z forward here).
// Body length ≈ 1.5 units (stinger tip z≈-0.86 → face z≈+0.63).
// ---------------------------------------------------------------------------

const GOLD = new THREE.Color('#f3b21c');
const DARK = new THREE.Color('#25170c');

function furTexture(base, speck, seed) {
  const r = rng(seed);
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1800; i++) {
      const x = r() * w;
      const y = r() * h;
      const l = 1.5 + r() * 3;
      const a = r() * Math.PI * 2;
      g.strokeStyle = r() < 0.6 ? speck : 'rgba(110,60,10,0.12)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
    }
  });
}

function stripeTexture(gold, dark, seed) {
  const r = rng(seed);
  return canvasTexture(256, 512, (g, w, h) => {
    // top of canvas = front of abdomen (near thorax), bottom = tip
    const bands = [
      [0.0, gold], [0.2, gold], [0.235, dark], [0.33, dark], [0.365, gold], [0.5, gold],
      [0.535, dark], [0.63, dark], [0.665, gold], [0.77, gold], [0.8, dark], [0.9, dark], [0.96, '#7a4a18'], [1.0, '#7a4a18'],
    ];
    const grd = g.createLinearGradient(0, 0, 0, h);
    for (const [p, c] of bands) grd.addColorStop(p, c);
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 3500; i++) {
      const x = r() * w;
      const y = r() * h;
      g.fillStyle = r() < 0.5 ? 'rgba(255,230,160,0.08)' : 'rgba(30,15,0,0.07)';
      g.fillRect(x, y, 1.5, 3);
    }
  });
}

function wingTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(235,245,255,0.55)';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(70,55,40,0.85)';
    g.lineCap = 'round';
    const vein = (pts, lw) => {
      g.lineWidth = lw;
      g.beginPath();
      g.moveTo(pts[0] * w, pts[1] * h);
      for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i] * w, pts[i + 1] * h);
      g.stroke();
    };
    // shape-space: u = outward (x), v = backward (y)
    vein([0.02, 0.05, 0.55, 0.12, 0.98, 0.3], 4);
    vein([0.02, 0.1, 0.45, 0.35, 0.9, 0.6], 3);
    vein([0.05, 0.15, 0.35, 0.55, 0.7, 0.85], 2.5);
    vein([0.45, 0.13, 0.5, 0.35], 2);
    vein([0.7, 0.2, 0.68, 0.48], 2);
    vein([0.3, 0.27, 0.32, 0.5], 2);
  });
}

function fanTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    const grd = g.createRadialGradient(0, h / 2, 0, 0, h / 2, w);
    grd.addColorStop(0, 'rgba(255,255,255,0.0)');
    grd.addColorStop(0.25, 'rgba(255,255,255,0.65)');
    grd.addColorStop(0.85, 'rgba(255,255,255,0.35)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  });
}

let shared = null;
function getShared() {
  if (shared) return shared;
  const sphere = new THREE.SphereGeometry(1, 40, 28);
  const absGeo = new THREE.SphereGeometry(1, 48, 32);
  absGeo.rotateX(Math.PI / 2);

  const wingShape = (len, wid) => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.bezierCurveTo(len * 0.35, -wid * 0.35, len * 0.85, -wid * 0.1, len, wid * 0.35);
    s.bezierCurveTo(len * 1.05, wid * 0.75, len * 0.6, wid * 1.05, len * 0.3, wid * 0.8);
    s.bezierCurveTo(len * 0.12, wid * 0.6, 0, wid * 0.25, 0, 0);
    const geo = new THREE.ShapeGeometry(s, 24);
    // map uv to 0..1 in shape space
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, pos.getX(i) / (len * 1.05), 1 - (pos.getY(i) + wid * 0.4) / (wid * 1.5));
    }
    geo.rotateX(-Math.PI / 2); // shape y → -z (backward)
    return geo;
  };

  const legCurve = (pts) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), 10, 0.022, 6);

  shared = {
    sphere,
    absGeo,
    foreWing: wingShape(0.72, 0.36),
    hindWing: wingShape(0.48, 0.24),
    fan: new THREE.CircleGeometry(0.78, 24, -1.15, 2.3),
    antenna: new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0.03, 0.14, 0.04),
        new THREE.Vector3(0.07, 0.24, 0.1),
        new THREE.Vector3(0.12, 0.27, 0.22),
        new THREE.Vector3(0.16, 0.26, 0.3),
      ]),
      16,
      0.017,
      6
    ),
    leg: [
      legCurve([[0, 0, 0], [0.12, -0.04, 0.07], [0.2, -0.16, 0.16], [0.24, -0.2, 0.2]]),
      legCurve([[0, 0, 0], [0.15, -0.03, 0.0], [0.27, -0.16, -0.02], [0.32, -0.21, -0.03]]),
      legCurve([[0, 0, 0], [0.15, -0.04, -0.08], [0.27, -0.16, -0.22], [0.32, -0.22, -0.3]]),
    ],
    mouth: new THREE.TorusGeometry(0.055, 0.013, 6, 18, Math.PI),
    cone: new THREE.ConeGeometry(1, 1, 10),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 8),
    wingTex: wingTexture(),
    fanTex: fanTexture(),
    headTex: furTexture('#f7bf35', 'rgba(255,232,160,0.22)', 11),
    thoraxTex: furTexture('#d9962a', 'rgba(255,222,140,0.22)', 12),
    stripeTex: stripeTexture('#f4b81c', '#2a1a0e', 13),
  };
  return shared;
}

function fuzzyMat(map, sheenColor = '#ffe7a0') {
  return new THREE.MeshPhysicalMaterial({
    map,
    roughness: 0.78,
    sheen: 1.0,
    sheenRoughness: 0.45,
    sheenColor: new THREE.Color(sheenColor),
  });
}

export function createBee({ hero = false, seed = 1, size = 1, tint = 0 } = {}) {
  const S = getShared();
  const r = rng(seed);
  const root = new THREE.Group();
  const body = new THREE.Group(); // receives bob / waggle
  root.add(body);
  body.scale.setScalar(size);

  const headMat = fuzzyMat(S.headTex);
  const thoraxMat = fuzzyMat(S.thoraxTex);
  const absMat = fuzzyMat(S.stripeTex, '#ffd98a');
  if (tint) {
    headMat.color.offsetHSL(tint * 0.02, 0, tint * -0.03);
    absMat.color.offsetHSL(tint * 0.015, 0, tint * -0.02);
  }
  const darkMat = new THREE.MeshStandardMaterial({ color: DARK, roughness: 0.6 });
  const eyeMat = new THREE.MeshPhysicalMaterial({ color: '#1b120c', roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.05 });
  const shineMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.5, 1.5) });
  const cheekMat = new THREE.MeshStandardMaterial({ color: '#ff7f7a', roughness: 0.8, transparent: true, opacity: hero ? 0.75 : 0.0 });
  const wingMat = new THREE.MeshPhysicalMaterial({
    map: S.wingTex,
    color: '#ffffff',
    transparent: true,
    roughness: 0.15,
    metalness: 0,
    iridescence: 0.9,
    iridescenceIOR: 1.35,
    side: THREE.DoubleSide,
    depthWrite: false,
    emissive: new THREE.Color('#fff2cc'),
    emissiveMap: S.wingTex,
    emissiveIntensity: 0.05,
  });
  const fanMat = new THREE.MeshBasicMaterial({
    map: S.fanTex,
    color: '#eaf4ff',
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const mesh = (geo, mat, parent, pos, scl, rot) => {
    const m = new THREE.Mesh(geo, mat);
    if (pos) m.position.set(...pos);
    if (scl) (typeof scl === 'number' ? m.scale.setScalar(scl) : m.scale.set(...scl));
    if (rot) m.rotation.set(...rot);
    m.castShadow = true;
    parent.add(m);
    return m;
  };

  // Thorax
  mesh(S.sphere, thoraxMat, body, [0, 0.02, 0.0], [0.25, 0.24, 0.27]);
  // Abdomen (pivot near waist so it can waggle)
  const abdomen = new THREE.Group();
  abdomen.position.set(0, 0.0, -0.18);
  body.add(abdomen);
  mesh(S.absGeo, absMat, abdomen, [0, -0.05, -0.26], [0.28, 0.26, 0.44], [0.16, 0, 0]);
  mesh(S.cone, darkMat, abdomen, [0, -0.13, -0.71], [0.025, 0.09, 0.025], [-Math.PI / 2 - 0.2, 0, 0]);

  // Head
  const head = new THREE.Group();
  head.position.set(0, 0.07, 0.26);
  body.add(head);
  mesh(S.sphere, headMat, head, [0, 0.02, 0.13], [0.27, 0.255, 0.25]);

  // Eyes: large glossy compound eyes with catch-lights
  const eyes = [];
  for (const sx of [-1, 1]) {
    const eg = new THREE.Group();
    eg.position.set(0.135 * sx, 0.07, 0.27);
    eg.rotation.set(-0.1, 0.42 * sx, 0);
    head.add(eg);
    const es = hero ? 1.06 : 1.0;
    mesh(S.sphere, eyeMat, eg, [0, 0, 0], [0.085 * es, 0.12 * es, 0.075 * es]);
    const s1 = mesh(S.sphere, shineMat, eg, [-0.025 * sx, 0.05, 0.062], 0.018);
    const s2 = mesh(S.sphere, shineMat, eg, [0.02 * sx, -0.035, 0.068], 0.011);
    s1.castShadow = s2.castShadow = false;
    eyes.push(eg);
  }
  // cheeks + smile
  for (const sx of [-1, 1]) mesh(S.sphere, cheekMat, head, [0.15 * sx, -0.05, 0.3], [0.05, 0.03, 0.02], [0, 0.5 * sx, 0]).castShadow = false;
  const mouth = mesh(S.mouth, darkMat, head, [0, -0.07, 0.37], 1, [0.15, 0, Math.PI]);
  mouth.castShadow = false;
  // proboscis (tongue) for nectar
  const tongue = mesh(S.cyl, new THREE.MeshStandardMaterial({ color: '#7a3b1a', roughness: 0.5 }), head, [0, -0.12, 0.33], [0.016, 0.001, 0.016], [Math.PI / 2 + 0.7, 0, 0]);

  // Antennae
  const antennae = [];
  for (const sx of [-1, 1]) {
    const ag = new THREE.Group();
    ag.position.set(0.06 * sx, 0.2, 0.3);
    head.add(ag);
    const inner = new THREE.Group();
    inner.scale.x = sx;
    ag.add(inner);
    mesh(S.antenna, darkMat, inner);
    mesh(S.sphere, darkMat, inner, [0.16, 0.26, 0.3], 0.032);
    antennae.push(ag);
  }

  // Hero signature: a little golden tuft on the head
  if (hero) {
    const tuftMat = fuzzyMat(S.headTex, '#fff0b0');
    const tuft = new THREE.Group();
    tuft.position.set(0, 0.26, 0.1);
    head.add(tuft);
    [[-0.04, -0.35], [0.0, 0.0], [0.045, 0.4]].forEach(([x, rz], i) => {
      mesh(S.cone, tuftMat, tuft, [x, 0.03, 0.02 * i], [0.036, 0.1, 0.036], [-0.5, 0, rz]);
    });
  }

  // Legs (3 pairs)
  const legs = [];
  const legZ = [0.12, 0.0, -0.12];
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const lg = new THREE.Group();
      lg.position.set(0.09 * sx, -0.14, legZ[i]);
      body.add(lg);
      const inner = new THREE.Group();
      inner.scale.x = sx;
      lg.add(inner);
      mesh(S.leg[i], darkMat, inner);
      legs.push({ g: lg, side: sx, i });
    }
  }

  // Wings: pivot(yaw fold) → flap(roll) → meshes
  const wings = [];
  for (const sx of [1, -1]) {
    const pivot = new THREE.Group();
    pivot.position.set(0.1 * sx, 0.2, 0.06);
    pivot.scale.x = sx; // mirror left wing
    body.add(pivot);
    const flap = new THREE.Group();
    pivot.add(flap);
    const fore = new THREE.Mesh(S.foreWing, wingMat);
    const hind = new THREE.Mesh(S.hindWing, wingMat);
    hind.position.set(0.02, -0.01, -0.13);
    fore.renderOrder = hind.renderOrder = 5;
    flap.add(fore, hind);
    fore.castShadow = hind.castShadow = true;
    const fan = new THREE.Mesh(S.fan, fanMat);
    fan.rotation.set(0, 0, 0);
    fan.renderOrder = 4;
    pivot.add(fan);
    wings.push({ pivot, flap, fan, side: sx });
  }

  const flapHz = 10.7 + r() * 0.8;
  const phase0 = r() * 10;

  const bee = {
    root,
    body,
    head,
    abdomen,
    hero,
    wingMat,
    // pose: see header
    setPose(p) {
      const t = p.t ?? 0;
      const wing = clamp(p.wing ?? 0);
      const buzz = clamp(p.buzz ?? 0);
      // Body bob while flying
      body.position.set(0, wing * 0.04 * Math.sin(t * 2 * Math.PI * 2.1 + phase0), 0);
      body.rotation.set(p.bodyPitch ?? 0, p.bodyYaw ?? 0, p.bodyRoll ?? 0);

      head.rotation.set((p.headPitch ?? 0), (p.headYaw ?? 0), p.headRoll ?? 0, 'YXZ');
      abdomen.rotation.set(-0.05 + (p.abdPitch ?? 0) + wing * 0.08, p.abdomenYaw ?? 0, 0);

      const blink = clamp(p.blink ?? 0);
      for (const e of eyes) e.scale.set(1, 1 - 0.85 * blink, 1);

      const tw = p.antenna ?? 0;
      antennae.forEach((a, i) => {
        const s = i === 0 ? -1 : 1;
        a.rotation.set(
          -0.15 + 0.22 * Math.sin(t * 5.3 + i * 1.7 + phase0) * tw + (p.antennaPerk ?? 0) * -0.35,
          0.12 * Math.sin(t * 3.1 + i + phase0) * tw * s,
          0
        );
      });

      const smile = p.smile ?? 1;
      mouth.scale.set(1 + 0.25 * (smile - 1), smile, 1);

      const tongueAmt = clamp(p.tongue ?? 0);
      tongue.scale.set(0.016, 0.001 + 0.22 * tongueAmt, 0.016);
      tongue.position.set(0, -0.12 - 0.07 * tongueAmt, 0.33 + 0.06 * tongueAmt);

      // Legs: walking tripod gait, or tucked while flying
      const walk = p.walk ?? 0;
      const wp = (p.walkPhase ?? 0) * Math.PI * 2;
      for (const L of legs) {
        const tri = (L.i + (L.side > 0 ? 0 : 1)) % 2 === 0 ? 1 : -1;
        const swing = Math.sin(wp) * tri * 0.35 * walk;
        const lift = Math.max(0, Math.cos(wp) * tri) * 0.25 * walk;
        L.g.rotation.set(wing * 0.6 + 0.0, swing * L.side, (-lift + wing * 0.35) * L.side);
      }

      // Wings
      const stroke = Math.sin((t + phase0) * Math.PI * 2 * flapHz);
      const vib = Math.sin((t + phase0) * Math.PI * 2 * 13.3);
      for (const W of wings) {
        // folded: swept back over abdomen; flying: spread sideways
        const fold = 1 - wing;
        // positive yaw sweeps the tip backward; mirrored wing needs the opposite sign
        W.pivot.rotation.set(0, W.side * (1.12 * fold + 0.18 * wing), 0);
        const amp = 1.05 * wing;
        W.flap.rotation.set(0, 0, 0.08 + stroke * amp + vib * 0.12 * buzz + fold * -0.12);
        W.fan.visible = wing > 0.05;
      }
      fanMat.opacity = 0.34 * wing;
      wingMat.opacity = 0.6 - 0.15 * wing;
      wingMat.emissiveIntensity = 0.05 + (p.backlight ?? 0) * 1.6;
    },
  };
  bee.setPose({});
  return bee;
}

export { GOLD, DARK };
