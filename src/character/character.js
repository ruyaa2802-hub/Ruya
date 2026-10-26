// Character assembly + per-frame pose solver.
import * as THREE from 'three';
import { buildSkeleton, solveTwoBone, setRootOrientation, rootQuat, V } from './rig.js';
import { buildBody } from './body.js';
import { buildHead, MORPHS } from './head.js';
import { buildHair } from './hair.js';
import * as M from '../core/materials.js';
import { clamp, lerp } from '../core/util.js';

const SIDES = ['L', 'R'];
const sgn = (L) => (L === 'L' ? 1 : -1);

// finger curl presets: [mcp, pip, dip] radians per finger
export const FINGER_POSES = {
  relaxed: { index: [0.22, 0.32, 0.18], middle: [0.28, 0.38, 0.22], ring: [0.33, 0.43, 0.24], pinky: [0.4, 0.48, 0.28], thumb: [0.12, 0.18, 0.12], spread: 0.04 },
  flat: { index: [0.02, 0.02, 0.02], middle: [0.02, 0.02, 0.02], ring: [0.02, 0.02, 0.02], pinky: [0.02, 0.02, 0.02], thumb: [0, 0, 0], spread: 0.08 },
  fist: { index: [1.45, 1.6, 0.9], middle: [1.5, 1.6, 0.9], ring: [1.5, 1.6, 0.9], pinky: [1.5, 1.55, 0.9], thumb: [0.55, 0.6, 0.55], spread: 0 },
  phone: { index: [0.85, 1.05, 0.45], middle: [0.95, 1.1, 0.5], ring: [1.0, 1.1, 0.5], pinky: [1.05, 1.05, 0.5], thumb: [-0.6, 0.0, 0.1], spread: 0.02 },
  phoneThumbTap: { index: [0.85, 1.05, 0.45], middle: [0.95, 1.1, 0.5], ring: [1.0, 1.1, 0.5], pinky: [1.05, 1.05, 0.5], thumb: [0.35, 0.55, 0.45], spread: 0.02 },
  point: { index: [0.08, 0.1, 0.06], middle: [1.25, 1.5, 0.8], ring: [1.35, 1.5, 0.8], pinky: [1.4, 1.45, 0.8], thumb: [0.45, 0.55, 0.4], spread: 0.0 },
  mug: { index: [1.05, 1.15, 0.6], middle: [1.15, 1.2, 0.6], ring: [1.2, 1.2, 0.6], pinky: [1.25, 1.15, 0.6], thumb: [0.35, 0.45, 0.3], spread: 0.0 },
  hold: { index: [0.7, 0.9, 0.45], middle: [0.8, 0.95, 0.5], ring: [0.85, 0.95, 0.5], pinky: [0.9, 0.95, 0.5], thumb: [0.3, 0.4, 0.3], spread: 0.02 },
  rest: { index: [0.35, 0.5, 0.3], middle: [0.4, 0.55, 0.3], ring: [0.45, 0.55, 0.3], pinky: [0.5, 0.55, 0.32], thumb: [0.18, 0.25, 0.15], spread: 0.03 },
};

export class Character {
  constructor({ hoodieColor = 0x5b6b4a, pantsColor = 0x2b2d33, sockColor = 0x8b8f95, hairColor = 0x23160e, irisColor = 0x4a2f19 } = {}) {
    this.group = new THREE.Group();
    this.group.name = 'character';
    const sk = (this.sk = buildSkeleton());
    this.group.add(sk.root);
    this.group.updateMatrixWorld(true);

    const skinTone = new THREE.Color().setRGB(0.84, 0.62, 0.5, THREE.SRGBColorSpace);
    const bodySkin = M.skin({ color: skinTone });
    bodySkin.vertexColors = true;
    this.mats = {
      hoodie: M.fabric({ color: hoodieColor, key: 'hoodie', bump: 'knit', repeat: [22, 22], sheen: 0.9, bumpScale: 0.45, hero: true }),
      cords: M.fabric({ color: 0xd8d2c4, key: 'cord', bump: 'weave', repeat: [4, 4], sheen: 0.4 }),
      pants: M.fabric({ color: pantsColor, key: 'pants', bump: 'weave', repeat: [12, 12], sheen: 0.6, heather: 0.05, hero: true }),
      socks: M.fabric({ color: sockColor, key: 'socks', bump: 'knit', repeat: [8, 8], heather: 0.12 }),
      bodySkin,
    };
    this.mats.hoodie.vertexColors = true;
    this.mats.pants.vertexColors = true;
    this.meshes = buildBody(sk, this.mats);
    this.skeleton = new THREE.Skeleton(sk.bones);
    for (const m of Object.values(this.meshes)) {
      this.group.add(m);
      m.bind(this.skeleton, new THREE.Matrix4());
    }

    // head (rigid on the head bone; face via morphs)
    const headSkin = M.skin({ color: 0xffffff });
    this.headRig = buildHead({ skinMat: headSkin, earMat: M.skin({ color: skinTone.clone().multiplyScalar(0.97) }), irisColor });
    this.headRig.group.scale.setScalar(1.08);
    this.headRig.group.position.set(0, -0.004, 0);
    sk.byName.head.add(this.headRig.group);
    const hairMat = M.hair(hairColor);
    const capMat = M.hairCapMat(new THREE.Color(hairColor).multiplyScalar(0.8));
    this.hair = buildHair(hairMat, capMat);
    this.headRig.group.add(this.hair);

    // limb descriptors for IK (rest positions in root frame)
    const W = sk.restWorld;
    this.limbs = {};
    for (const L of SIDES) {
      const s = sgn(L);
      this.limbs['arm' + L] = {
        upper: sk.byName['upperArm.' + L], lower: sk.byName['foreArm.' + L], end: sk.byName['hand.' + L],
        restA: W['upperArm.' + L], restB: W['foreArm.' + L], restC: W['hand.' + L],
        restPole: W['foreArm.' + L].clone().add(V(s * 0.2, 0, -0.4)),
      };
      this.limbs['leg' + L] = {
        upper: sk.byName['thigh.' + L], lower: sk.byName['shin.' + L], end: sk.byName['foot.' + L],
        restA: W['thigh.' + L], restB: W['shin.' + L], restC: W['foot.' + L],
        restPole: W['shin.' + L].clone().add(V(0, 0, 0.5)),
      };
    }
    this.rest = {};
    for (const b of sk.bones) this.rest[b.name] = b.position.clone();
    this.headMesh = this.headRig.head;
    this._rootInvQ = new THREE.Quaternion();
    this._rootInvM = new THREE.Matrix4();
  }

  // world transform helpers ------------------------------------------------
  rootLocal(worldPos) {
    return worldPos.clone().applyMatrix4(this._rootInvM);
  }
  rootLocalQuat(worldQ) {
    return this._rootInvQ.clone().multiply(worldQ);
  }
  bonePos(name, out = new THREE.Vector3()) {
    return out.setFromMatrixPosition(this.sk.byName[name].matrixWorld);
  }
  // world point of the eyes (between them)
  eyesWorld(out = new THREE.Vector3()) {
    const e = this.headRig.eyes;
    const a = new THREE.Vector3().setFromMatrixPosition(e.L.pivot.matrixWorld);
    const b = new THREE.Vector3().setFromMatrixPosition(e.R.pivot.matrixWorld);
    return out.copy(a).add(b).multiplyScalar(0.5);
  }
  headWorldQuat(out = new THREE.Quaternion()) {
    return this.sk.byName.head.getWorldQuaternion(out);
  }

  // ------------------------------------------------------------------------
  pose(st) {
    const sk = this.sk, B = sk.byName;
    this.group.position.fromArray(st.rootPos || [0, 0, 0]);
    this.group.rotation.set(0, st.rootYaw || 0, 0);
    this.group.updateMatrixWorld(true);
    this._rootInvM.copy(this.group.matrixWorld).invert();
    this._rootInvQ.copy(this.group.quaternion).invert();

    for (const b of sk.bones) { b.position.copy(this.rest[b.name]); b.quaternion.identity(); }
    const eul = new THREE.Euler();
    const setE = (bone, a, order = 'YXZ') => {
      if (!a) return;
      eul.set(a[0] || 0, a[1] || 0, a[2] || 0, order);
      bone.quaternion.setFromEuler(eul);
    };
    if (st.hips) B.hips.position.add(V(...st.hips));
    setE(B.hips, st.hipsRot);
    setE(B.spine, st.spine);
    setE(B.chest, st.chest);
    setE(B.neck, st.neck);
    setE(B.head, st.head);
    for (const L of SIDES) {
      const c = (st.clav && st.clav[L]) || [0, 0];
      const s = sgn(L);
      // raise = roll the clavicle up, fwd = yaw forward
      eul.set(0, -s * c[1], s * c[0], 'XYZ');
      B['clavicle.' + L].quaternion.setFromEuler(eul);
    }
    this.group.updateMatrixWorld(true);

    // head look-at blend
    if (st.headLook && st.headLook.w > 0) {
      const tgt = st.headLook.target;
      const neckQ = new THREE.Quaternion();
      B.neck.getWorldQuaternion(neckQ);
      const hp = this.bonePos('head').add(new THREE.Vector3(0, 0.09, 0));
      const dir = tgt.clone().sub(hp).normalize().applyQuaternion(neckQ.clone().invert());
      const yaw = clamp(Math.atan2(dir.x, dir.z), -1.1, 1.1);
      const pitch = clamp(Math.asin(clamp(-dir.y, -1, 1)), -0.6, 0.9);
      const base = st.head || [0, 0, 0];
      const w = st.headLook.w;
      // neck takes part of the turn
      const nb = st.neck || [0, 0, 0];
      eul.set(lerp(nb[0], nb[0] + pitch * 0.35, w), lerp(nb[1], nb[1] + yaw * 0.35, w), nb[2] || 0, 'YXZ');
      B.neck.quaternion.setFromEuler(eul);
      B.neck.updateWorldMatrix(false, false);
      eul.set(lerp(base[0], pitch * 0.65, w), lerp(base[1], yaw * 0.65, w), base[2] || 0, 'YXZ');
      B.head.quaternion.setFromEuler(eul);
      this.group.updateMatrixWorld(true);
    }

    // legs
    for (const L of SIDES) {
      const f = st.feet && st.feet[L];
      if (!f) continue;
      const limb = this.limbs['leg' + L];
      const hipP = new THREE.Vector3().setFromMatrixPosition(limb.upper.matrixWorld).applyMatrix4(this._rootInvM);
      const pole = f.pole || hipP.clone().add(V(sgn(L) * 0.06, -0.2, 0.6).applyAxisAngle(V(0, 1, 0), f.yaw || 0));
      solveTwoBone(limb, f.pos, pole, this._rootInvQ, this._rootInvM);
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(f.pitch || 0, f.yaw || 0, f.roll || 0, 'YXZ'));
      setRootOrientation(limb.end, q, this._rootInvQ);
      this.group.updateMatrixWorld(true);
    }
    // arms
    for (const L of SIDES) {
      const h = st.hands && st.hands[L];
      if (!h) continue;
      const limb = this.limbs['arm' + L];
      const s = sgn(L);
      const shP = new THREE.Vector3().setFromMatrixPosition(limb.upper.matrixWorld).applyMatrix4(this._rootInvM);
      const pole = h.pole || shP.clone().add(V(s * 0.38, -0.5, -0.32));
      solveTwoBone(limb, h.pos, pole, this._rootInvQ, this._rootInvM, 0.001);
      if (h.quat) setRootOrientation(limb.end, h.quat, this._rootInvQ);
      this.group.updateMatrixWorld(true);
    }
    // fingers
    for (const L of SIDES) {
      const fp = (st.fingers && st.fingers[L]) || { relaxed: 1 };
      this.applyFingers(L, fp, st.thumbTap ? st.thumbTap[L] || 0 : 0, st.indexTap ? st.indexTap[L] || 0 : 0);
    }
    this.group.updateMatrixWorld(true);
    this.applyFace(st);
  }

  applyFingers(L, weights, thumbTap = 0, indexTap = 0) {
    const s = sgn(L), B = this.sk.byName;
    let tot = 0;
    for (const w of Object.values(weights)) tot += w;
    tot = tot || 1;
    const acc = {};
    for (const f of ['index', 'middle', 'ring', 'pinky', 'thumb']) acc[f] = [0, 0, 0];
    let spread = 0;
    for (const [name, w] of Object.entries(weights)) {
      const p = FINGER_POSES[name];
      if (!p) continue;
      for (const f of Object.keys(acc)) for (let k = 0; k < 3; k++) acc[f][k] += (p[f][k] * w) / tot;
      spread += (p.spread * w) / tot;
    }
    acc.thumb[0] += thumbTap * 0.25; acc.thumb[1] += thumbTap * 0.35;
    acc.index[0] += indexTap * 0.35; acc.index[1] += indexTap * 0.2;
    const axis = V(0, 0, -s);
    const spreadOf = { index: 1, middle: 0, ring: -0.6, pinky: -1.3 };
    for (const f of ['index', 'middle', 'ring', 'pinky']) {
      for (let k = 0; k < 3; k++) {
        const b = B[`${f}${k}.${L}`];
        b.quaternion.setFromAxisAngle(axis, acc[f][k]);
        if (k === 0) b.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(V(s, 0, 0), spreadOf[f] * spread));
      }
    }
    // thumb flexes across the palm
    const tdir = V(s * -0.25, -0.62, 0.74).normalize();
    const palmN = V(-s, 0, 0);
    const tax = new THREE.Vector3().crossVectors(tdir, palmN).normalize();
    for (let k = 0; k < 3; k++) {
      const b = B[`thumb${k}.${L}`];
      b.quaternion.setFromAxisAngle(tax, acc.thumb[k] * (k === 0 ? 0.8 : 1));
      if (k === 0) b.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), s * acc.thumb[0] * 0.5));
    }
  }

  applyFace(st) {
    const hr = this.headRig;
    const infl = hr.head.morphTargetInfluences;
    const mw = st.morphs || {};
    MORPHS.forEach((n, i) => (infl[i] = clamp(mw[n] || 0, -0.3, 1.3)));
    const bi = hr.brows.morphTargetInfluences;
    for (let i = 0; i < infl.length; i++) bi[i] = infl[i];
    hr.jaw.rotation.x = 0.28 * clamp(mw.jawOpen || 0, 0, 1.3);
    // gaze
    hr.group.updateWorldMatrix(true, false);
    const inv = new THREE.Matrix4().copy(hr.group.matrixWorld).invert();
    for (const L of SIDES) {
      const e = hr.eyes[L];
      let yaw = 0, pitch = 0;
      if (st.gaze) {
        const t = st.gaze.clone().applyMatrix4(inv).sub(e.center);
        yaw = Math.atan2(t.x, t.z);
        pitch = Math.atan2(-t.y, Math.hypot(t.x, t.z));
      }
      if (st.gazeOffset) { yaw += st.gazeOffset[0]; pitch += st.gazeOffset[1]; }
      yaw = clamp(yaw, -0.6, 0.6); pitch = clamp(pitch, -0.45, 0.55);
      e.look.rotation.set(pitch, yaw, 0, 'YXZ');
      const open = st.lids ? st.lids[L] ?? 1 : 1;
      const eff = open - 1.05 * Math.max(0, pitch) + 0.45 * Math.max(0, -pitch);
      const close = clamp(1 - eff), wide = clamp((eff - 1) / 0.35);
      for (const m of [e.up, e.lash]) { m.morphTargetInfluences[0] = close; m.morphTargetInfluences[1] = wide; }
      const low = st.lower ? st.lower[L] ?? 0 : 0;
      const lowEff = low + 0.35 * Math.max(0, pitch);
      for (const m of [e.lo, e.lashLo]) { m.morphTargetInfluences[0] = clamp(lowEff); m.morphTargetInfluences[1] = clamp(-lowEff); }
    }
  }
}
