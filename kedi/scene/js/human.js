import * as THREE from 'three';
import { canvasTexture, rng, clamp } from './util.js';
import { Loft, profile } from './loft.js';

// ---------------------------------------------------------------------------
// The cat's person. Mostly framed partially (legs, hands) or out of focus, so
// a clean stylised-realistic body is enough. Local: forward +Z, root on floor.
// Legs and arms are 2-bone IK toward ankle / wrist targets (local space).
// ---------------------------------------------------------------------------
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

function ik2(a, target, l1, l2, hint) {
  const d = target.clone().sub(a);
  const L = clamp(d.length(), 1e-4, l1 + l2 - 1e-4);
  const dir = d.normalize();
  const cosA = clamp((l1 * l1 + L * L - l2 * l2) / (2 * l1 * L), -1, 1);
  const perp = hint.clone().addScaledVector(dir, -hint.dot(dir));
  if (perp.lengthSq() < 1e-8) perp.set(0, 0, 1);
  perp.normalize();
  return [a.clone().addScaledVector(dir, l1 * cosA).addScaledVector(perp, l1 * Math.sqrt(1 - cosA * cosA)), a.clone().addScaledVector(dir, L)];
}

function knitTex() {
  const r = rng(4);
  return canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = '#d9cbb2';
    g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16) for (let y = 0; y < h; y += 10) {
      g.strokeStyle = `rgba(120,95,60,${0.18 + r() * 0.1})`;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x + 2, y);
      g.lineTo(x + 8, y + 9);
      g.lineTo(x + 14, y);
      g.stroke();
    }
  }, { repeat: [3, 3] });
}
function denimTex() {
  const r = rng(5);
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#3d5272';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 6000; i++) {
      g.fillStyle = r() < 0.5 ? 'rgba(200,215,235,0.10)' : 'rgba(10,20,40,0.15)';
      g.fillRect(r() * w, r() * h, 1 + r() * 3, 1);
    }
  }, { repeat: [4, 2] });
}

export function createHuman() {
  const root = new THREE.Group();
  const sweater = new THREE.MeshStandardMaterial({ map: knitTex(), roughness: 0.95 });
  const jeans = new THREE.MeshStandardMaterial({ map: denimTex(), roughness: 0.85 });
  const skin = new THREE.MeshPhysicalMaterial({ color: '#dba98e', roughness: 0.55, sheen: 0.3, sheenColor: new THREE.Color('#ffd8c8') });
  const hairM = new THREE.MeshStandardMaterial({ color: '#3a271c', roughness: 0.6 });
  const sockM = new THREE.MeshStandardMaterial({ color: '#8c8f96', roughness: 0.95 });
  const sh = (m) => { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; return m; };

  const torso = new Loft(30, 32);
  root.add(sh(new THREE.Mesh(torso.geo, sweater)));
  const legs = [-1, 1].map((sx) => {
    const L = new Loft(26, 24);
    root.add(sh(new THREE.Mesh(L.geo, jeans)));
    const foot = sh(new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), sockM));
    root.add(foot);
    return { sx, L, foot };
  });
  const arms = [-1, 1].map((sx) => {
    const L = new Loft(26, 20);
    root.add(sh(new THREE.Mesh(L.geo, sweater)));
    const hand = new THREE.Group();
    root.add(hand);
    const palm = sh(new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), skin));
    palm.scale.set(0.042, 0.016, 0.05);
    palm.position.z = 0.04;
    hand.add(palm);
    const wrist = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.03, 0.06, 14), skin));
    wrist.rotation.x = Math.PI / 2;
    hand.add(wrist);
    const fingers = [];
    for (let k = 0; k < 4; k++) {
      const f = new THREE.Group();
      f.position.set((k - 1.5) * 0.019, 0, 0.085);
      hand.add(f);
      const seg = sh(new THREE.Mesh(new THREE.CapsuleGeometry(0.0072, 0.045 - Math.abs(k - 1.5) * 0.008, 4, 8), skin));
      seg.rotation.x = Math.PI / 2;
      seg.position.z = 0.03;
      f.add(seg);
      fingers.push(f);
    }
    const thumb = new THREE.Group();
    thumb.position.set(-0.035 * sx, -0.004, 0.035);
    thumb.rotation.y = -0.7 * sx;
    hand.add(thumb);
    const ts = sh(new THREE.Mesh(new THREE.CapsuleGeometry(0.0095, 0.04, 4, 8), skin));
    ts.rotation.x = Math.PI / 2;
    ts.position.z = 0.025;
    thumb.add(ts);
    return { sx, L, hand, fingers, thumb };
  });
  // head
  const head = new THREE.Group();
  root.add(head);
  const neck = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.12, 16), skin));
  neck.position.y = -0.1;
  head.add(neck);
  const skull = sh(new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), skin));
  skull.scale.set(0.078, 0.1, 0.092);
  head.add(skull);
  const jawM = sh(new THREE.Mesh(new THREE.SphereGeometry(1, 30, 20), skin));
  jawM.scale.set(0.062, 0.055, 0.07);
  jawM.position.set(0, -0.05, 0.022);
  head.add(jawM);
  const hair = sh(new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28, 0, Math.PI * 2, 0, Math.PI * 0.58), hairM));
  hair.scale.set(0.085, 0.108, 0.1);
  hair.rotation.x = -0.35;
  hair.position.set(0, 0.012, -0.008);
  head.add(hair);
  const bun = sh(new THREE.Mesh(new THREE.SphereGeometry(0.045, 20, 14), hairM));
  bun.position.set(0, 0.06, -0.085);
  head.add(bun);
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.011, 12, 8), new THREE.MeshStandardMaterial({ color: '#2a1d16', roughness: 0.2 }));
    eye.position.set(0.03 * sx, 0.012, 0.083);
    head.add(eye);
    const ear = sh(new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), skin));
    ear.scale.set(0.012, 0.026, 0.018);
    ear.position.set(0.077 * sx, -0.005, 0.0);
    head.add(ear);
    const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.004, 0.026, 3, 6), hairM);
    brow.rotation.z = Math.PI / 2 + 0.12 * sx;
    brow.position.set(0.031 * sx, 0.034, 0.083);
    head.add(brow);
  }
  const nose = sh(new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), skin));
  nose.scale.set(0.014, 0.022, 0.016);
  nose.position.set(0, -0.012, 0.094);
  head.add(nose);
  const lips = new THREE.Mesh(new THREE.CapsuleGeometry(0.006, 0.028, 3, 8), new THREE.MeshStandardMaterial({ color: '#b56f66', roughness: 0.5 }));
  lips.rotation.z = Math.PI / 2;
  lips.position.set(0, -0.052, 0.086);
  head.add(lips);

  const torsoProf = profile([[0, 0.12, 0.08, 0.08], [0.08, 0.165, 0.11, 0.11], [0.35, 0.15, 0.1, 0.1], [0.65, 0.17, 0.115, 0.12], [0.86, 0.185, 0.105, 0.1], [0.95, 0.12, 0.07, 0.07], [1, 0.06, 0.05, 0.05]]);
  const legProf = profile([[0, 0.085, 0.085, 0.085], [0.12, 0.08, 0.08, 0.085], [0.5, 0.058, 0.058, 0.06], [0.85, 0.05, 0.05, 0.05], [1, 0.048, 0.048, 0.048]]);
  const armProf = profile([[0, 0.05, 0.05, 0.05], [0.1, 0.05, 0.05, 0.05], [0.5, 0.042, 0.042, 0.042], [0.9, 0.036, 0.036, 0.036], [1, 0.033, 0.033, 0.033]]);
  const rotX = (a) => new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), a);

  const human = {
    root, head,
    hands: arms.map((a) => a.hand),
    setPose(o) {
      const p = Object.assign({
        pelvis: V(0, 0.95, 0), pelvisPitch: 0, spine: 0, spineYaw: 0, headPitch: 0, headYaw: 0,
        footL: V(-0.1, 0.08, 0.02), footR: V(0.1, 0.08, 0.02), handL: null, handR: null, curl: 0.3, palmL: null, palmR: null, breathe: 0,
      }, o);
      const yawQ = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), p.spineYaw);
      const q = (a) => yawQ.clone().multiply(rotX(a));
      const pv = p.pelvis;
      const P0 = pv.clone().add(V(0, -0.1, 0).applyQuaternion(q(p.pelvisPitch)));
      const P1 = pv.clone().add(V(0, 0.16, 0).applyQuaternion(q(p.pelvisPitch + 0.3 * p.spine)));
      const P2 = P1.clone().add(V(0, 0.2, 0).applyQuaternion(q(p.pelvisPitch + 0.75 * p.spine)));
      const P3 = P2.clone().add(V(0, 0.15, 0).applyQuaternion(q(p.pelvisPitch + p.spine)));
      const P4 = P3.clone().add(V(0, 0.07, 0).applyQuaternion(q(p.pelvisPitch + p.spine)));
      const fwd = V(0, 0, 1).applyQuaternion(q(p.pelvisPitch + p.spine));
      const br = 1 + 0.015 * Math.sin(p.breathe);
      torso.update([P0, pv.clone(), P1, P2, P3, P4], (u) => torsoProf(u).map((x) => x * (u > 0.5 ? br : 1)), fwd);
      const right = V(1, 0, 0).applyQuaternion(yawQ);
      const upT = P4.clone().sub(P3).normalize();
      // head
      head.position.copy(P4).addScaledVector(upT, 0.13).addScaledVector(fwd, 0.02);
      head.quaternion.copy(q(p.pelvisPitch + p.spine)).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(p.headPitch, p.headYaw, 0, 'YXZ')));
      // legs
      for (const L of legs) {
        const hip = pv.clone().addScaledVector(right, 0.095 * L.sx).add(V(0, -0.05, 0));
        const ank = (L.sx < 0 ? p.footL : p.footR).clone();
        const [kn, an] = ik2(hip, ank, 0.45, 0.44, V(0, 0, 1).applyQuaternion(yawQ));
        L.L.update([hip.clone().add(V(0, 0.06, 0)), hip, kn, an], legProf, V(0, 0, 1).applyQuaternion(yawQ));
        L.foot.position.copy(an).add(V(0, -0.035, 0.06).applyQuaternion(yawQ));
        L.foot.quaternion.copy(yawQ);
        L.foot.scale.set(0.048, 0.04, 0.12);
      }
      // arms
      for (const A of arms) {
        const shd = P3.clone().addScaledVector(right, 0.185 * A.sx).addScaledVector(upT, -0.03);
        const tgt = (A.sx < 0 ? p.handL : p.handR) || shd.clone().add(V(0.04 * A.sx, -0.52, 0.06));
        const hint = V(0.5 * A.sx, -0.3, -1).applyQuaternion(yawQ);
        const [el, wr] = ik2(shd, tgt, 0.29, 0.27, hint);
        A.L.update([shd.clone().addScaledVector(right, -0.04 * A.sx).addScaledVector(upT, 0.03), shd, el, wr], armProf, upT);
        const dir = wr.clone().sub(el).normalize();
        const palmN = ((A.sx < 0 ? p.palmL : p.palmR) || V(0, -1, 0)).clone();
        const upH = palmN.clone().multiplyScalar(-1).addScaledVector(dir, palmN.dot(dir)).normalize();
        const m = new THREE.Matrix4().lookAt(V(), dir.clone().negate(), upH);
        A.hand.quaternion.setFromRotationMatrix(m);
        A.hand.position.copy(wr);
        for (const f of A.fingers) f.rotation.x = 0.25 + 1.1 * p.curl;
        A.thumb.rotation.x = 0.4 * p.curl;
      }
      root.updateMatrixWorld(true);
    },
  };
  human.setPose({});
  return human;
}
