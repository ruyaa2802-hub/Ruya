// Reusable props. Every prop is a THREE.Group in metres with its origin at
// its base (or at its grip point for hand-held objects, documented per prop).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as M from '../core/materials.js';
import { canvasTexture } from '../core/textures.js';
import { rng, fbm3, smoothstep } from '../core/util.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const shadow = (o) => { o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };
const box = (w, h, d, mat, r = 0.004) => new THREE.Mesh(r > 0 ? new RoundedBoxGeometry(w, h, d, 3, r) : new THREE.BoxGeometry(w, h, d), mat);
function lathe(points, mat, segs = 48) {
  return new THREE.Mesh(new THREE.LatheGeometry(points.map((p) => new THREE.Vector2(p[0], p[1])), segs), mat);
}

// ---------------- phone ----------------
// Local frame: X right, Y up (long axis), Z out of the screen. Origin = centre.
export const PHONE = { w: 0.072, h: 0.152, d: 0.0085, screenW: 0.0665, screenH: 0.1445 };
export function phone(screenCanvas) {
  const g = new THREE.Group(); g.name = 'phone';
  const frame = box(PHONE.w, PHONE.h, PHONE.d, M.metal({ color: 0x3a3d42, roughness: 0.32, brushed: false }), 0.0042);
  g.add(frame);
  const back = box(PHONE.w - 0.001, PHONE.h - 0.001, 0.002, new THREE.MeshPhysicalMaterial({ color: 0x1d2a33, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.05 }), 0.0009);
  back.position.z = -PHONE.d / 2 + 0.0008; g.add(back);
  const bump = box(0.026, 0.026, 0.0016, new THREE.MeshPhysicalMaterial({ color: 0x15181c, roughness: 0.3, clearcoat: 1 }), 0.004);
  bump.position.set(-0.016, 0.054, -PHONE.d / 2 - 0.0006); g.add(bump);
  for (const [x, y] of [[-0.021, 0.059], [-0.011, 0.049]]) {
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.0042, 0.0042, 0.0012, 24), M.glass({ tint: 0x101418, opacity: 0.9, roughness: 0.02 }));
    lens.rotation.x = Math.PI / 2; lens.position.set(x, y, -PHONE.d / 2 - 0.0015); g.add(lens);
  }
  const tex = new THREE.CanvasTexture(screenCanvas);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const screenMat = new THREE.MeshPhysicalMaterial({
    color: 0x000000, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1.5,
    roughness: 0.12, clearcoat: 0.25, clearcoatRoughness: 0.05, specularIntensity: 0.25, envMapIntensity: 0.25,
  });
  const scr = new THREE.Mesh(new RoundedBoxGeometry(PHONE.screenW, PHONE.screenH, 0.0006, 2, 0.0004), screenMat);
  // RoundedBox UVs map per face; use a plane for a clean UV instead
  scr.geometry = new THREE.PlaneGeometry(PHONE.screenW, PHONE.screenH);
  scr.position.z = PHONE.d / 2 + 0.0002;
  g.add(scr);
  const glassTop = new THREE.Mesh(new RoundedBoxGeometry(PHONE.w - 0.0012, PHONE.h - 0.0012, 0.0005, 2, 0.0035), M.glass({ tint: 0xffffff, opacity: 0.02 }));
  glassTop.material.envMapIntensity = 0.3;
  glassTop.position.z = PHONE.d / 2 + 0.0004; g.add(glassTop);
  g.userData.screenTex = tex;
  g.userData.screenMat = screenMat;
  // screen light that spills onto the face / surroundings
  const light = new THREE.RectAreaLight(0xbfd8ff, 0, PHONE.screenW, PHONE.screenH);
  light.position.z = PHONE.d / 2 + 0.002;
  g.add(light);
  g.userData.light = light;
  return shadow(g);
}

// ---------------- mug ----------------
// Origin at the base centre. Handle on +X.
export function mug({ color = 0xc9902f, fill = 0.75 } = {}) {
  const g = new THREE.Group(); g.name = 'mug';
  const ceramic = M.ceramic(color, 0.28);
  const inner = M.ceramic(0xf1ece2, 0.2);
  const outer = lathe([[0.0, 0.0], [0.036, 0.0], [0.039, 0.004], [0.041, 0.05], [0.042, 0.094], [0.0395, 0.097]], ceramic);
  const innerM = lathe([[0.0375, 0.097], [0.0365, 0.06], [0.034, 0.012], [0.0, 0.01]], inner);
  innerM.material.side = THREE.DoubleSide;
  g.add(outer, innerM);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.0065, 14, 28, Math.PI * 1.25), ceramic);
  handle.rotation.z = -Math.PI * 0.62; handle.scale.set(1, 1.2, 1);
  handle.position.set(0.041, 0.052, 0);
  g.add(handle);
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.0358, 40), M.liquid(0x1f1006));
  coffee.rotation.x = -Math.PI / 2;
  coffee.position.y = 0.012 + 0.08 * fill;
  g.add(coffee);
  // thin crema ring
  const crema = new THREE.Mesh(new THREE.RingGeometry(0.03, 0.0358, 40), new THREE.MeshPhysicalMaterial({ color: 0x5a3519, roughness: 0.35, clearcoat: 0.6 }));
  crema.rotation.x = -Math.PI / 2; crema.position.y = coffee.position.y + 0.0003;
  g.add(crema);
  g.userData.coffee = coffee; g.userData.crema = crema;
  g.userData.setFill = (f) => { coffee.position.y = 0.012 + 0.08 * f; crema.position.y = coffee.position.y + 0.0003; coffee.visible = crema.visible = f > 0.02; };
  g.userData.setFill(fill);
  g.userData.handle = V(0.064, 0.052, 0); // grip point (local)
  return shadow(g);
}

// ---------------- electric kettle ----------------
// Origin at base centre; handle on -X, spout on +X.
export function kettle() {
  const g = new THREE.Group(); g.name = 'kettle';
  const steel = M.metal({ color: 0xd6d6d6, roughness: 0.22 });
  const black = M.plastic(0x1a1a1c, 0.4);
  const base = lathe([[0, 0], [0.085, 0], [0.087, 0.012], [0.08, 0.02], [0, 0.02]], black);
  g.add(base);
  const body = lathe([[0, 0.02], [0.074, 0.022], [0.078, 0.06], [0.076, 0.14], [0.066, 0.2], [0.05, 0.215], [0, 0.216]], steel, 64);
  g.add(body);
  const lid = lathe([[0, 0.214], [0.048, 0.214], [0.044, 0.222], [0.02, 0.228], [0, 0.229]], black);
  g.add(lid);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.012, 14, 30, Math.PI * 0.95), black);
  handle.rotation.z = Math.PI * 0.52; handle.scale.set(0.9, 1.05, 1);
  handle.position.set(-0.07, 0.12, 0);
  g.add(handle);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.018, 0.06, 20, 1, true), steel);
  spout.material = steel;
  spout.position.set(0.085, 0.185, 0); spout.rotation.z = -0.9;
  g.add(spout);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.004, 12, 8), new THREE.MeshBasicMaterial({ color: 0x4aa8ff }));
  led.position.set(-0.058, 0.04, 0.03); g.add(led);
  g.userData.handle = V(-0.112, 0.125, 0);
  g.userData.spoutTip = V(0.11, 0.205, 0);
  return shadow(g);
}

export function coffeeJar() {
  const g = new THREE.Group();
  const glass = lathe([[0, 0], [0.04, 0], [0.042, 0.005], [0.042, 0.11], [0.036, 0.118], [0, 0.118]], M.glass({ tint: 0xe6efee, opacity: 0.22 }));
  const grains = lathe([[0, 0.003], [0.039, 0.003], [0.039, 0.07], [0, 0.074]], new THREE.MeshStandardMaterial({ color: 0x3a1d0c, roughness: 0.9 }));
  const lid = lathe([[0, 0.116], [0.038, 0.116], [0.039, 0.132], [0, 0.133]], M.metal({ color: 0xb9a37a, roughness: 0.35, brushed: false }));
  const label = new THREE.Mesh(new THREE.CylinderGeometry(0.0425, 0.0425, 0.05, 32, 1, true), new THREE.MeshStandardMaterial({
    map: canvasTexture('jarlabel', 256, 96, (c, w, h) => {
      c.fillStyle = '#c23b22'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#f5e6c8'; c.font = 'bold 34px Inter, sans-serif'; c.textAlign = 'center';
      c.fillText('KAHVE', w * 0.25, 60); c.fillText('KAHVE', w * 0.75, 60);
    }), roughness: 0.7,
  }));
  label.position.y = 0.05;
  g.add(glass, grains, lid, label);
  return shadow(g);
}

export function waterGlass(fill = 0.6) {
  const g = new THREE.Group();
  const gl = lathe([[0, 0], [0.03, 0], [0.033, 0.003], [0.036, 0.11], [0.0345, 0.11], [0.0315, 0.004], [0, 0.004]], M.glass({ tint: 0xf0f6f6, opacity: 0.2 }));
  const water = lathe([[0, 0.004], [0.031, 0.004], [0.0335, 0.004 + 0.1 * fill], [0, 0.004 + 0.1 * fill]], new THREE.MeshPhysicalMaterial({ color: 0xbfd6d8, transparent: true, opacity: 0.25, roughness: 0.02, clearcoat: 1, depthWrite: false }));
  g.add(gl, water);
  return g;
}

export function lamp() {
  const g = new THREE.Group();
  const metal = M.metal({ color: 0x9a8b70, roughness: 0.35, brushed: false });
  g.add(lathe([[0, 0], [0.065, 0], [0.065, 0.012], [0.012, 0.02], [0, 0.02]], metal));
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.28, 12), metal); stem.position.y = 0.16; g.add(stem);
  const shadeMat = M.fabric({ color: 0xe7dcc6, key: 'shade', bump: 'weave', repeat: [6, 3], sheen: 0.3, roughness: 0.95 });
  shadeMat.side = THREE.DoubleSide;
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.11, 0.16, 40, 1, true), shadeMat); shade.position.y = 0.33; g.add(shade);
  return shadow(g);
}

export function book(w, h, d, color, seed = 1) {
  const g = new THREE.Group();
  const cover = box(w, h, d, M.paintedWood(color, 0.7), 0.002);
  const pages = new THREE.Mesh(new THREE.BoxGeometry(w * 0.96, h * 0.82, d * 0.96), new THREE.MeshStandardMaterial({ color: 0xece3cf, roughness: 0.9 }));
  pages.position.x = 0.003;
  g.add(cover, pages);
  return shadow(g);
}

export function chair(wood) {
  const g = new THREE.Group();
  const seat = box(0.42, 0.035, 0.42, wood, 0.008); seat.position.y = 0.45; g.add(seat);
  for (const [x, z] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.013, 0.45, 12), wood); leg.position.set(x, 0.225, z); g.add(leg);
  }
  for (const x of [-0.18, 0.18]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.016, 0.45, 12), wood); post.position.set(x, 0.69, -0.19); g.add(post);
  }
  const back = box(0.4, 0.09, 0.022, wood, 0.008); back.position.set(0, 0.86, -0.19); g.add(back);
  const rail = box(0.38, 0.04, 0.018, wood, 0.006); rail.position.set(0, 0.68, -0.19); g.add(rail);
  return shadow(g);
}

export function roundTable(wood, metal) {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.03, 64), wood); top.position.y = 0.735; g.add(top);
  const edge = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.015, 8, 64), wood); edge.rotation.x = Math.PI / 2; edge.position.y = 0.735; g.add(edge);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.7, 16), metal); post.position.y = 0.37; g.add(post);
  const foot = lathe([[0, 0], [0.24, 0], [0.24, 0.012], [0.05, 0.03], [0, 0.03]], metal); g.add(foot);
  return shadow(g);
}

// rumpled duvet: displaced grid
export function duvet(w, d, mat, seed = 3) {
  const geo = new THREE.PlaneGeometry(w, d, 90, 70);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const ex = Math.min(1, (w / 2 - Math.abs(x)) / 0.09), ez = Math.min(1, (d / 2 - Math.abs(z)) / 0.09);
    const edge = Math.min(ex, ez);
    let y = 0.05 * fbm3(x * 2.2, 0, z * 2.2, seed, 3) + 0.018 * fbm3(x * 7, 1, z * 7, seed + 5, 2) + 0.04;
    y += 0.06 * Math.exp(-(((x + w * 0.1) / 0.35) ** 2) - (((z - d * 0.1) / 0.3) ** 2)); // pushed-aside lump
    y *= smoothstep(0, 1, edge);
    const drop = edge < 1 ? (1 - edge) * -0.18 : 0;
    p.setY(i, y + drop * 0.9);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.material.side = THREE.DoubleSide;
  return shadow(m);
}
export function pillow(mat) {
  const geo = new RoundedBoxGeometry(0.62, 0.13, 0.42, 6, 0.06);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 - (x * x) / 0.12 - (z * z) / 0.06;
    p.setY(i, y * (0.55 + 0.55 * Math.max(0, k)) + 0.01 * fbm3(x * 9, y * 9, z * 9, 2, 2));
  }
  geo.computeVertexNormals();
  return shadow(new THREE.Mesh(geo, mat));
}

// soft heap of clothes
export function clothesPile(mats, seed = 5) {
  const g = new THREE.Group();
  const R = rng(seed);
  for (let i = 0; i < 6; i++) {
    const geo = new THREE.SphereGeometry(0.16, 32, 16);
    const p = geo.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const v = V(p.getX(k), p.getY(k), p.getZ(k));
      const n = fbm3(v.x * 8 + i, v.y * 8, v.z * 8, seed + i, 3);
      v.multiplyScalar(1 + n * 0.35);
      v.y *= 0.28;
      p.setXYZ(k, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mats[i % mats.length]);
    m.position.set((R() - 0.5) * 0.18, 0.03 + i * 0.028, (R() - 0.5) * 0.14);
    m.rotation.y = R() * 6;
    m.scale.setScalar(0.8 + R() * 0.4);
    g.add(m);
  }
  return shadow(g);
}

export function plant(potColor = 0xb8653d) {
  const g = new THREE.Group();
  g.add(lathe([[0, 0], [0.06, 0], [0.075, 0.13], [0.08, 0.14], [0.07, 0.14], [0.0, 0.12]], M.ceramic(potColor, 0.6)));
  const soil = new THREE.Mesh(new THREE.CircleGeometry(0.07, 24), new THREE.MeshStandardMaterial({ color: 0x2b1d12, roughness: 1 }));
  soil.rotation.x = -Math.PI / 2; soil.position.y = 0.128; g.add(soil);
  const leafMat = new THREE.MeshPhysicalMaterial({ color: 0x3f6b2e, roughness: 0.45, sheen: 0.3, side: THREE.DoubleSide, clearcoat: 0.3 });
  const R = rng(17);
  for (let i = 0; i < 14; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), leafMat);
    leaf.scale.set(0.45, 0.06, 1.0);
    const a = R() * Math.PI * 2, tilt = 0.3 + R() * 0.7;
    leaf.position.set(Math.cos(a) * 0.04, 0.17 + R() * 0.12, Math.sin(a) * 0.04);
    leaf.rotation.set(tilt * Math.sin(a), -a, tilt * Math.cos(a));
    leaf.translateZ(0.04);
    g.add(leaf);
  }
  return shadow(g);
}

// paper with printed text (bills, envelopes)
export function paper(w, h, lines, { tint = '#f4f1ea', accent = '#b33' } = {}) {
  const tex = canvasTexture(null, 256, Math.round(256 * (h / w)), (c, W, H) => {
    c.fillStyle = tint; c.fillRect(0, 0, W, H);
    c.fillStyle = accent; c.fillRect(0, 0, W, H * 0.12);
    c.fillStyle = '#fff'; c.font = `bold ${Math.round(H * 0.07)}px Inter, sans-serif`; c.fillText(lines[0] || '', 12, H * 0.09);
    c.fillStyle = '#333'; c.font = `${Math.round(H * 0.05)}px Inter, sans-serif`;
    lines.slice(1).forEach((l, i) => c.fillText(l, 12, H * (0.24 + i * 0.09)));
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }));
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  return m;
}
