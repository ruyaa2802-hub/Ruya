import * as THREE from 'three';
import { canvasTexture, rng } from '../scene/js/util.js';

// Cute cartoon animal heads for the Pirilumo channel avatar, built in the same
// style as Pırıltı (fuzzy sheen materials, big glossy eyes with catch-lights).

function fur(base, speck, seed) {
  const r = rng(seed);
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1500; i++) {
      const x = r() * w, y = r() * h, a = r() * 6.28, l = 1.5 + r() * 3;
      g.strokeStyle = speck;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
    }
  });
}
const fuzzy = (color, seed = 1) =>
  new THREE.MeshPhysicalMaterial({ map: fur(color, 'rgba(255,255,255,0.14)', seed), roughness: 0.8, sheen: 1, sheenRoughness: 0.45, sheenColor: new THREE.Color('#ffffff') });
const flat = (color, rough = 0.6) => new THREE.MeshStandardMaterial({ color, roughness: rough });
const S = new THREE.SphereGeometry(1, 40, 28);
const CONE = new THREE.ConeGeometry(1, 1, 24);
const MOUTH = new THREE.TorusGeometry(0.11, 0.022, 8, 24, Math.PI);
const eyeMat = new THREE.MeshPhysicalMaterial({ color: '#1b120c', roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 });
const shine = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.6, 1.6) });
const blush = new THREE.MeshStandardMaterial({ color: '#ff8c8c', roughness: 0.8, transparent: true, opacity: 0.7 });
const black = flat('#1d1712', 0.5);

function add(parent, geo, mat, pos, scl, rot) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  if (scl) (typeof scl === 'number' ? m.scale.setScalar(scl) : m.scale.set(...scl));
  if (rot) m.rotation.set(...rot);
  parent.add(m);
  return m;
}
function glossyEye(parent, x, y, z, s = 1, yaw = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = yaw;
  parent.add(g);
  add(g, S, eyeMat, [0, 0, 0], [0.13 * s, 0.17 * s, 0.1 * s]);
  add(g, S, shine, [-0.04 * s, 0.07 * s, 0.085 * s], 0.035 * s);
  add(g, S, shine, [0.035 * s, -0.05 * s, 0.09 * s], 0.017 * s);
  return g;
}
function smile(parent, y, z, s = 1) {
  add(parent, MOUTH, black, [0, y, z], s, [0.2, 0, Math.PI]);
}

export function createFox() {
  const g = new THREE.Group();
  const orange = fuzzy('#f28a2e', 2), cream = fuzzy('#fff4e2', 3);
  add(g, S, orange, [0, 0, 0], [1.0, 0.86, 0.88]);
  for (const sx of [-1, 1]) {
    add(g, S, cream, [0.5 * sx, -0.32, 0.45], [0.44, 0.34, 0.36]);
    const ear = new THREE.Group();
    ear.position.set(0.56 * sx, 0.72, -0.05);
    ear.rotation.z = -0.38 * sx;
    g.add(ear);
    add(ear, CONE, orange, [0, 0.32, 0], [0.32, 0.72, 0.22]);
    add(ear, CONE, cream, [0, 0.27, 0.1], [0.19, 0.5, 0.1]);
    add(ear, CONE, black, [0, 0.62, 0.01], [0.1, 0.16, 0.08]);
    glossyEye(g, 0.34 * sx, 0.12, 0.74, 1, 0.3 * sx);
    add(g, S, blush, [0.56 * sx, -0.12, 0.62], [0.12, 0.07, 0.04], [0, 0.6 * sx, 0]);
  }
  add(g, S, cream, [0, -0.3, 0.68], [0.4, 0.3, 0.42]);
  add(g, S, black, [0, -0.2, 1.08], [0.11, 0.08, 0.08]);
  smile(g, -0.42, 0.98, 0.9);
  return g;
}

export function createPanda() {
  const g = new THREE.Group();
  const white = fuzzy('#f6f4ee', 4), dark = fuzzy('#26211d', 5);
  add(g, S, white, [0, 0, 0], [1.05, 0.95, 0.92]);
  for (const sx of [-1, 1]) {
    add(g, S, dark, [0.7 * sx, 0.74, -0.08], [0.33, 0.33, 0.24]);
    add(g, S, dark, [0.36 * sx, 0.06, 0.74], [0.25, 0.31, 0.14], [0, 0.3 * sx, -0.55 * sx]);
    // white eye ring so the dark eye reads on the patch
    add(g, S, flat('#ffffff', 0.3), [0.36 * sx, 0.1, 0.83], [0.12, 0.14, 0.06], [0, 0.3 * sx, 0]);
    glossyEye(g, 0.36 * sx, 0.1, 0.85, 0.72, 0.3 * sx);
    add(g, S, blush, [0.62 * sx, -0.25, 0.62], [0.12, 0.07, 0.04], [0, 0.6 * sx, 0]);
  }
  add(g, S, white, [0, -0.32, 0.74], [0.38, 0.27, 0.28]);
  add(g, S, black, [0, -0.2, 0.98], [0.15, 0.1, 0.09]);
  smile(g, -0.41, 0.98, 0.95);
  return g;
}

export function createOwl() {
  const g = new THREE.Group();
  const brown = fuzzy('#9a6338', 6), cream = fuzzy('#f7e4c2', 7);
  add(g, S, brown, [0, 0, 0], [1.0, 0.95, 0.88]);
  for (const sx of [-1, 1]) {
    add(g, S, cream, [0.36 * sx, 0.04, 0.66], [0.42, 0.44, 0.16], [0, 0.32 * sx, 0]);
    const tuft = new THREE.Group();
    tuft.position.set(0.6 * sx, 0.78, -0.05);
    tuft.rotation.z = -0.55 * sx;
    g.add(tuft);
    add(tuft, CONE, brown, [0, 0.2, 0], [0.16, 0.48, 0.12]);
    // big amber eyes with dark pupils
    const e = new THREE.Group();
    e.position.set(0.36 * sx, 0.07, 0.8);
    e.rotation.y = 0.3 * sx;
    g.add(e);
    add(e, S, flat('#ffb21f', 0.3), [0, 0, 0], [0.21, 0.21, 0.08]);
    add(e, S, eyeMat, [0, 0, 0.05], [0.13, 0.13, 0.07]);
    add(e, S, shine, [-0.05, 0.06, 0.11], 0.035);
    add(e, S, shine, [0.04, -0.04, 0.115], 0.017);
  }
  add(g, CONE, flat('#ff9a1f', 0.5), [0, -0.18, 0.9], [0.1, 0.24, 0.08], [Math.PI + 0.5, 0, 0]);
  add(g, S, cream, [0, -0.62, 0.55], [0.5, 0.32, 0.3]);
  return g;
}

// ---------------------------------------------------------------------------
// Full-body sitting versions (ground at y = 0)
// ---------------------------------------------------------------------------
function shadowAll(g) {
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

export function createFoxSitting() {
  const g = new THREE.Group();
  const orange = fuzzy('#f28a2e', 12), cream = fuzzy('#fff4e2', 13), sock = fuzzy('#3a2418', 14);
  add(g, S, orange, [0, 0.88, 0], [0.7, 0.9, 0.66]);
  add(g, S, cream, [0, 1.0, 0.42], [0.42, 0.58, 0.3]);
  for (const sx of [-1, 1]) {
    add(g, S, sock, [0.27 * sx, 0.36, 0.42], [0.14, 0.38, 0.15]);
    add(g, S, sock, [0.27 * sx, 0.06, 0.52], [0.16, 0.08, 0.2]);
    add(g, S, orange, [0.5 * sx, 0.32, 0.05], [0.3, 0.3, 0.42]);
  }
  // big fluffy tail curling around the side, white tip
  const tail = new THREE.Group();
  tail.position.set(0.55, 0.32, -0.35);
  tail.rotation.set(0.2, 0.9, 0.35);
  g.add(tail);
  add(tail, S, orange, [0, 0, 0.45], [0.36, 0.34, 0.75]);
  add(tail, S, cream, [0, 0.03, 1.1], [0.27, 0.26, 0.3]);
  const head = createFox();
  head.position.set(0, 2.05, 0.08);
  head.scale.setScalar(0.82);
  g.add(head);
  g.userData.head = head;
  return shadowAll(g);
}

export function createPandaSitting() {
  const g = new THREE.Group();
  const white = fuzzy('#f6f4ee', 15), dark = fuzzy('#26211d', 16);
  add(g, S, white, [0, 0.95, 0], [1.02, 0.98, 0.92]);
  add(g, S, dark, [0, 1.62, -0.05], [0.98, 0.32, 0.86]); // shoulder band
  for (const sx of [-1, 1]) {
    add(g, S, dark, [0.82 * sx, 1.15, 0.38], [0.3, 0.58, 0.32], [0.5, 0, 0.55 * sx]);
    add(g, S, dark, [0.58 * sx, 0.32, 0.62], [0.36, 0.3, 0.44]);
    add(g, S, flat('#3a332e', 0.7), [0.58 * sx, 0.3, 1.0], [0.2, 0.18, 0.06]); // foot pad
  }
  const head = createPanda();
  head.position.set(0, 2.38, 0.12);
  head.scale.setScalar(0.92);
  g.add(head);
  g.userData.head = head;
  return shadowAll(g);
}

export function createOwlOnStump() {
  const g = new THREE.Group();
  const brown = fuzzy('#9a6338', 17), cream = fuzzy('#f7e4c2', 18), wing = fuzzy('#6e4425', 19);
  const bark = canvasTexture(256, 256, (c, w, h) => {
    c.fillStyle = '#7a4f2a'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { c.strokeStyle = `rgba(40,20,5,${0.2 + (i % 3) * 0.1})`; c.lineWidth = 2 + (i % 4); c.beginPath(); const x = (i * 37) % w; c.moveTo(x, 0); c.lineTo(x + ((i * 13) % 20) - 10, h); c.stroke(); }
  });
  const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.9, 0.9, 28), new THREE.MeshStandardMaterial({ map: bark, roughness: 0.9 }));
  stump.position.y = 0.45;
  g.add(stump);
  const rings = canvasTexture(256, 256, (c, w, h) => {
    c.fillStyle = '#d9b07a'; c.fillRect(0, 0, w, h);
    for (let r = 10; r < 128; r += 12) { c.strokeStyle = 'rgba(120,70,30,0.45)'; c.lineWidth = 3; c.beginPath(); c.arc(128, 128, r, 0, 6.29); c.stroke(); }
  });
  add(g, new THREE.CircleGeometry(0.78, 28), new THREE.MeshStandardMaterial({ map: rings, roughness: 0.8 }), [0, 0.901, 0], 1, [-Math.PI / 2, 0, 0]);
  const owl = new THREE.Group();
  owl.position.y = 0.9;
  g.add(owl);
  add(owl, S, brown, [0, 0.8, 0], [0.74, 0.86, 0.68]);
  add(owl, S, cream, [0, 0.72, 0.36], [0.5, 0.62, 0.36]);
  for (const sx of [-1, 1]) {
    add(owl, S, wing, [0.66 * sx, 0.82, -0.02], [0.24, 0.62, 0.48], [0, 0, 0.18 * sx]);
    add(owl, S, flat('#ff9a1f', 0.5), [0.22 * sx, 0.06, 0.42], [0.13, 0.07, 0.16]);
  }
  const head = createOwl();
  head.position.set(0, 1.86, 0.05);
  head.scale.setScalar(0.8);
  owl.add(head);
  g.userData.head = head;
  return shadowAll(g);
}
