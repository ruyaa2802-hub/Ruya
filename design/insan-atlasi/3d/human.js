import * as THREE from 'three';
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));

export const PAL = {
  skin: '#f0c2a0', hair: '#4a2c22', sage: '#7fa596', collar: '#fbf5ec', mustard: '#e0ac4f', plum: '#87596f',
  gray: '#cfc9c3', iris: '#5a3420', lips: '#a0444a', apron: '#f4ece0', rose: '#e79a9a',
};
export const phys = (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.55, sheen: 0.3, sheenColor: new THREE.Color('#ffffff'), ...o });

function blushTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(240,120,120,0.75)'); g.addColorStop(1, 'rgba(240,120,120,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const BLUSH = blushTex();

// kind: 'adult' | 'child' | 'grandma'
export function makeHuman(kind = 'adult', opts = {}) {
  const C = {
    adult: { cloth: PAL.sage, hair: PAL.hair },
    child: { cloth: PAL.mustard, hair: PAL.hair },
    grandma: { cloth: PAL.plum, hair: PAL.gray },
  }[kind];
  const skinM = phys(PAL.skin, { roughness: 0.6, sheen: 0.5, sheenColor: new THREE.Color('#ffd9c4'), ...(opts.skin || {}) });
  const hairM = phys(C.hair, { roughness: 0.45, sheen: 0.8, sheenColor: new THREE.Color(kind === 'grandma' ? '#ffffff' : '#a87a62'), ...(opts.hair || {}) });
  const clothM = phys(C.cloth, { roughness: 0.85, sheen: 1, sheenColor: new THREE.Color('#ffffff') });
  const darkM = new THREE.MeshStandardMaterial({ color: '#1d1210', roughness: 0.25 });
  const whiteM = phys('#ffffff', { roughness: 0.2, clearcoat: 1 });
  const root = new THREE.Group();
  const cast = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };

  // ---- torso
  const torso = cast(new THREE.Mesh(new THREE.CapsuleGeometry(0.85, 1.4, 12, 28), clothM));
  torso.scale.set(1.2, 1, 0.78); torso.position.y = -2.5; root.add(torso);
  if (kind === 'adult') {
    for (const s of [-1, 1]) { const c = cast(new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 12), phys(PAL.collar, { roughness: 0.7 }))); c.scale.set(0.9, 0.38, 0.5); c.position.set(s * 0.2, -1.42, 0.5); c.rotation.z = s * 0.55; root.add(c); }
    // ribbed hem hint
    const hem = cast(new THREE.Mesh(new THREE.TorusGeometry(0.98, 0.07, 10, 40), clothM)); hem.rotation.x = Math.PI / 2; hem.scale.set(1.04, 0.8, 1); hem.position.y = -3.35; root.add(hem);
  }
  if (kind === 'grandma') {
    const ap = cast(new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 0.9, 8, 20), phys(PAL.apron, { roughness: 0.8 }))); ap.scale.set(1.1, 1, 0.25); ap.position.set(0, -2.55, 0.55); root.add(ap);
  }
  if (kind === 'child') {
    for (const [x, y, c] of [[-0.35, -2.2, '#d4826b'], [0.2, -2.6, '#8fa9bd']]) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), phys(c)); d.scale.z = 0.3; d.position.set(x, y, 0.66); root.add(d); }
  }
  const neck = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.31, 0.7, 20), skinM)); neck.position.y = -1.2; root.add(neck);

  // ---- head (pivot at neck)
  const headPivot = new THREE.Group(); headPivot.position.y = -0.95; root.add(headPivot);
  const head = new THREE.Group(); head.position.y = 0.95; headPivot.add(head);
  const skull = cast(new THREE.Mesh(new THREE.SphereGeometry(1, 48, 36), skinM)); skull.scale.set(0.95, 1.03, 0.93); head.add(skull);
  const earrings = [];
  for (const s of [-1, 1]) {
    const ear = cast(new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), skinM)); ear.scale.set(0.6, 1, 0.8); ear.position.set(s * 0.92, -0.05, 0); head.add(ear);
    if (kind === 'adult') { const er = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), phys(PAL.mustard, { metalness: 0.6, roughness: 0.25 })); er.position.set(s * 0.95, -0.27, 0.04); head.add(er); earrings.push(er); }
  }
  const nose = cast(new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), skinM)); nose.position.set(0, -0.14, 0.93); nose.scale.set(1, 0.9, 0.8); head.add(nose);
  const blushM = new THREE.MeshBasicMaterial({ map: BLUSH, transparent: true, depthWrite: false, opacity: 0.6 });
  const blushes = [-1, 1].map((s) => { const b = new THREE.Mesh(new THREE.CircleGeometry(0.2, 24), blushM); const p = V(s * 0.5, -0.27, 0.8); b.position.copy(p); b.lookAt(p.clone().multiplyScalar(2)); b.position.multiplyScalar(1.02); head.add(b); return b; });

  // eyes with lids
  const eyes = [-1, 1].map((s) => {
    const g = new THREE.Group(); const p = V(s * 0.33, 0.04, 0.8); g.position.copy(p); g.lookAt(V(s * 0.33 * 1.3, 0.05, 3)); head.add(g);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.15, 24, 16), whiteM); g.add(ball);
    const iris = new THREE.Group(); g.add(iris);
    const ir = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 16), phys(PAL.iris, { roughness: 0.2, clearcoat: 1 })); ir.scale.set(1, 1.08, 0.4); ir.position.z = 0.115; iris.add(ir);
    const pu = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), darkM); pu.scale.set(1, 1.08, 0.4); pu.position.z = 0.142; iris.add(pu);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 8), new THREE.MeshBasicMaterial({ color: '#fff' })); hl.position.set(-0.035, 0.045, 0.16); g.add(hl); g.userData.hl = hl;
    const lidP = new THREE.Group(); g.add(lidP);
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.19, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), skinM); lidP.add(lid);
    const lash = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.016, 6, 32, Math.PI), darkM); lash.rotation.x = Math.PI / 2; lash.rotation.z = Math.PI; lidP.add(lash);
    if (kind !== 'grandma') for (const a of [0.9, 1.25]) { const l = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.06, 4, 6), darkM); l.position.set(s * Math.sin(a) * 0.19, 0.02, Math.cos(a) * 0.19); l.rotation.z = -s * 0.9; lidP.add(l); }
    return { g, iris, lidP, s };
  });
  // brows
  const brows = [-1, 1].map((s) => { const b = cast(new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.17, 4, 8), phys(kind === 'grandma' ? '#b8b1aa' : '#3a221a'))); b.rotation.z = Math.PI / 2; const p = new THREE.Group(); p.position.set(s * 0.33, 0.32, 0.86); p.rotation.y = s * 0.3; p.add(b); head.add(p); return p; });
  // mouth
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.03, 10, 28, Math.PI), new THREE.MeshStandardMaterial({ color: '#7e2f34', roughness: 0.5 }));
  smile.rotation.z = Math.PI; const smileP = new THREE.Group(); smileP.position.set(0, -0.4, 0.88); smileP.rotation.x = -0.35; smileP.add(smile); head.add(smileP);
  const oMouth = new THREE.Mesh(new THREE.SphereGeometry(0.065, 16, 12), new THREE.MeshStandardMaterial({ color: '#5a1d22', roughness: 0.5 })); oMouth.scale.set(1, 1.15, 0.45); oMouth.position.set(0, -0.43, 0.86); head.add(oMouth);

  // ---- hair
  if (kind === 'grandma') {
    const cap = cast(new THREE.Mesh(new THREE.SphereGeometry(1.06, 40, 24, 0, Math.PI * 2, 0, 1.15), hairM)); cap.rotation.x = 0.28; head.add(cap);
    const back = cast(new THREE.Mesh(new THREE.SphereGeometry(1.05, 40, 24, Math.PI / 2 + 1.25, Math.PI * 2 - 2.5, 0, 1.75), hairM)); head.add(back);
    const bun = cast(new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 18), hairM)); bun.position.set(0, 1.05, -0.3); head.add(bun);
    const gm = phys('#8a6a50', { metalness: 0.5, roughness: 0.3 });
    for (const s of [-1, 1]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 8, 28), gm); r.position.set(s * 0.33, 0.04, 0.97); head.add(r); const gl = new THREE.Mesh(new THREE.CircleGeometry(0.19, 24), new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.15, roughness: 0 })); gl.position.set(s * 0.33, 0.04, 0.975); head.add(gl); }
    const br = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.26, 8), gm); br.rotation.z = Math.PI / 2; br.position.set(0, 0.07, 0.99); head.add(br);
  } else {
    const back = cast(new THREE.Mesh(new THREE.SphereGeometry(1.09, 48, 32, Math.PI / 2 + 0.95, Math.PI * 2 - 1.9, 0, 2.05), hairM)); back.scale.set(1.02, 1.05, 1.0); head.add(back);
    const cap = cast(new THREE.Mesh(new THREE.SphereGeometry(1.08, 48, 24, 0, Math.PI * 2, 0, 1.0), hairM)); cap.rotation.x = 0.3; head.add(cap);
    // fringe tufts
    for (let i = -2; i <= 2; i++) { const t = cast(new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 14), hairM)); t.scale.set(0.9, 0.45, 0.5); t.position.set(i * 0.27, 0.62 - Math.abs(i) * 0.06, 0.78 - Math.abs(i) * 0.1); t.rotation.z = -i * 0.18; head.add(t); }
    for (const s of [-1, 1]) { const lock = cast(new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.8, 8, 16), hairM)); lock.position.set(s * 0.9, -0.2, 0.32); lock.rotation.z = s * 0.08; head.add(lock); }
    // bob flare at the bottom
    const flare = cast(new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.2, 12, 40, Math.PI * 2 - 1.9), hairM)); flare.rotation.x = Math.PI / 2; flare.rotation.z = Math.PI / 2 + 0.95; flare.position.y = -0.62; flare.scale.set(1.03, 0.95, 1); head.add(flare);
    if (kind === 'child') { const clip = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.22, 4, 8), phys('#d4826b')); clip.position.set(0.55, 0.72, 0.62); clip.rotation.z = -0.9; head.add(clip); }
  }

  // ---- arms (2-bone IK built from capsules)
  const UA = 0.78, FA = 0.74;
  const arms = [-1, 1].map((s) => {
    const sh = V(s * 1.02, -1.75, 0);
    const up = cast(new THREE.Mesh(new THREE.CapsuleGeometry(0.21, UA - 0.1, 8, 16), clothM));
    const fo = cast(new THREE.Mesh(new THREE.CapsuleGeometry(0.19, FA - 0.1, 8, 16), clothM));
    const hand = cast(new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 16), skinM)); hand.scale.set(1, 0.9, 0.85);
    const thumb = cast(new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 10), skinM));
    const holder = new THREE.Group();
    root.add(up, fo, hand, thumb, holder);
    return { s, sh, up, fo, hand, thumb, holder };
  });
  const Y = V(0, 1, 0);
  function setArm(i, target, pole) {
    const a = arms[i]; const S = a.sh, T = target.clone();
    let d = T.clone().sub(S); let dist = d.length(); const maxd = UA + FA - 0.02; if (dist > maxd) { d.setLength(maxd); dist = maxd; T.copy(S).add(d); }
    const u = d.clone().normalize();
    const cosA = clamp((UA * UA + dist * dist - FA * FA) / (2 * UA * dist), -1, 1); const A = Math.acos(cosA);
    const P = (pole || V(a.s * 1, -0.6, -0.4)).clone(); const w = P.sub(u.clone().multiplyScalar(P.dot(u))).normalize();
    const E = S.clone().addScaledVector(u, UA * Math.cos(A)).addScaledVector(w, UA * Math.sin(A));
    const place = (m, p0, p1) => { m.position.copy(p0).add(p1).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(Y, p1.clone().sub(p0).normalize()); };
    place(a.up, S, E); place(a.fo, E, T);
    a.hand.position.copy(T); a.holder.position.copy(T);
    a.thumb.position.copy(T).add(V(-a.s * 0.14, 0.1, 0.12));
  }
  const api = {
    root, head: headPivot, holder: (i) => arms[i].holder, handPos: (i) => arms[i].hand.position,
    arm: setArm,
    face({ lid = [0.1, 0.1], look = [0, 0], smile: sm = 0.5, open = 0, brow = 0, blush = 0.4 } = {}) {
      eyes.forEach((e, i) => {
        e.lidP.rotation.x = -1.25 + clamp(lid[i]) * 2.85; e.g.userData.hl.visible = lid[i] < 0.55;
        e.iris.rotation.set(-look[1] * 0.35, look[0] * 0.45, 0);
      });
      brows.forEach((b, i) => { b.position.y = 0.32 + brow * 0.05; b.rotation.z = (i ? -1 : 1) * brow * 0.12; });
      smileP.scale.set(1, 0.35 + 0.8 * sm, 1); smile.visible = open < 0.5; oMouth.visible = open >= 0.5 && smileP.visible;
      blushM.opacity = 0.35 + 0.5 * blush;
    },
    pose({ tilt = 0, nod = 0, yaw = 0, breathe = 0 } = {}) {
      headPivot.rotation.set(nod, yaw, tilt);
      torso.scale.set(1.2 * (1 + breathe * 0.01), 1 + breathe * 0.012, 0.78);
    },
    mats: { skinM, hairM, clothM },
    hideFace() { eyes.forEach((e) => { e.g.visible = false; }); brows.forEach((b) => { b.visible = false; }); smileP.visible = false; oMouth.visible = false; blushes.forEach((b) => { b.visible = false; }); earrings.forEach((e) => { e.visible = false; }); },
  };
  api.face({}); api.pose({});
  setArm(0, V(-1.25, -3.3, 0.35)); setArm(1, V(1.25, -3.3, 0.35));
  return api;
}
