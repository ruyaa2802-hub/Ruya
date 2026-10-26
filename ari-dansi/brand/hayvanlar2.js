import * as THREE from 'three';
import { fuzzy, flat, add, glossyEye, smile, shadowAll, S, CONE, black, blush } from './hayvanlar.js';

// Second cast for the "world of animals" avatar: lion, elephant, penguin.
// Each stands on y = 0, facing +Z.

export function createLion() {
  const g = new THREE.Group();
  const gold = fuzzy('#f2b13c', 21), cream = fuzzy('#fff0cf', 22), mane = fuzzy('#c8641c', 23);
  add(g, S, gold, [0, 0.82, 0], [0.68, 0.84, 0.64]);
  add(g, S, cream, [0, 0.9, 0.4], [0.4, 0.55, 0.28]);
  for (const sx of [-1, 1]) {
    add(g, S, gold, [0.28 * sx, 0.18, 0.42], [0.18, 0.2, 0.24]);
    add(g, S, gold, [0.5 * sx, 0.3, 0.02], [0.3, 0.3, 0.42]);
  }
  const tail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[0.3, 0.3, -0.5], [0.8, 0.25, -0.7], [1.0, 0.7, -0.6], [0.9, 1.1, -0.4]].map((p) => new THREE.Vector3(...p))), 20, 0.06, 8), gold);
  g.add(tail);
  add(g, S, mane, [0.9, 1.18, -0.38], 0.15);
  const head = new THREE.Group();
  head.position.set(0, 1.95, 0.1);
  g.add(head);
  // mane: ring of fluffy lobes behind the face
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    add(head, S, mane, [Math.cos(a) * 0.82, Math.sin(a) * 0.78, -0.18], [0.36, 0.36, 0.3]);
  }
  add(head, S, mane, [0, 0, -0.3], [0.9, 0.86, 0.5]);
  add(head, S, gold, [0, 0, 0.05], [0.78, 0.72, 0.7]);
  for (const sx of [-1, 1]) {
    add(head, S, gold, [0.55 * sx, 0.62, -0.02], [0.2, 0.2, 0.12]);
    add(head, S, flat('#f7c7a0', 0.7), [0.55 * sx, 0.62, 0.06], [0.11, 0.11, 0.06]);
    glossyEye(head, 0.28 * sx, 0.13, 0.62, 0.9, 0.25 * sx);
    add(head, S, blush, [0.45 * sx, -0.14, 0.55], [0.11, 0.06, 0.04], [0, 0.6 * sx, 0]);
  }
  add(head, S, cream, [0, -0.24, 0.6], [0.36, 0.26, 0.24]);
  add(head, S, flat('#6b3a2a', 0.4), [0, -0.12, 0.83], [0.13, 0.09, 0.07]);
  smile(head, -0.33, 0.8, 0.85);
  g.userData.head = head;
  return shadowAll(g);
}

export function createElephant() {
  const g = new THREE.Group();
  const grey = fuzzy('#9aa6b4', 24), pink = flat('#f4b6c2', 0.7), ivory = flat('#fffaf0', 0.35);
  add(g, S, grey, [0, 0.95, -0.15], [0.78, 0.8, 0.95]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    add(g, S, grey, [0.42 * sx, 0.32, -0.15 + 0.5 * sz], [0.24, 0.38, 0.24]);
    add(g, S, flat('#e8e2d8', 0.6), [0.42 * sx, 0.04, -0.15 + 0.5 * sz + 0.06], [0.2, 0.06, 0.18]);
  }
  const head = new THREE.Group();
  head.position.set(0, 1.75, 0.55);
  g.add(head);
  add(head, S, grey, [0, 0, 0], [0.7, 0.66, 0.62]);
  for (const sx of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(0.66 * sx, 0.05, -0.12);
    ear.rotation.y = 0.5 * sx;
    head.add(ear);
    add(ear, S, grey, [0.3 * sx, 0, 0], [0.5, 0.58, 0.08]);
    add(ear, S, pink, [0.3 * sx, -0.02, 0.05], [0.36, 0.44, 0.04]);
    glossyEye(head, 0.27 * sx, 0.15, 0.52, 0.85, 0.3 * sx);
    add(head, S, blush, [0.42 * sx, -0.12, 0.46], [0.1, 0.06, 0.04], [0, 0.6 * sx, 0]);
    add(head, CONE, ivory, [0.22 * sx, -0.38, 0.5], [0.05, 0.22, 0.05], [1.9, 0, -0.3 * sx]);
  }
  // trunk curling up at the tip (a happy trumpet)
  const trunk = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(
    [[0, -0.15, 0.5], [0, -0.55, 0.72], [0, -0.85, 0.8], [0, -0.95, 1.0], [0, -0.8, 1.18]].map((p) => new THREE.Vector3(...p))), 30, 0.13, 12), grey);
  head.add(trunk);
  add(head, S, grey, [0, -0.78, 1.2], [0.13, 0.13, 0.08]);
  g.userData.head = head;
  return shadowAll(g);
}

export function createPenguin() {
  const g = new THREE.Group();
  const navy = fuzzy('#25324a', 25), white = fuzzy('#fbfbf6', 26), orange = flat('#ff9a1f', 0.45);
  add(g, S, navy, [0, 1.0, 0], [0.62, 1.0, 0.58]);
  add(g, S, white, [0, 0.9, 0.24], [0.48, 0.82, 0.42]);
  add(g, S, white, [0, 1.62, 0.3], [0.42, 0.34, 0.3]); // face mask
  for (const sx of [-1, 1]) {
    add(g, S, navy, [0.6 * sx, 1.0, 0.0], [0.12, 0.52, 0.28], [0, 0, 0.35 * sx]);
    add(g, S, orange, [0.22 * sx, 0.05, 0.3], [0.2, 0.06, 0.26]);
    glossyEye(g, 0.18 * sx, 1.72, 0.55, 0.75, 0.25 * sx);
    add(g, S, blush, [0.32 * sx, 1.52, 0.52], [0.09, 0.05, 0.03], [0, 0.6 * sx, 0]);
  }
  add(g, CONE, orange, [0, 1.52, 0.7], [0.1, 0.26, 0.08], [Math.PI / 2 + 0.25, 0, 0]);
  g.userData.head = g;
  return shadowAll(g);
}
