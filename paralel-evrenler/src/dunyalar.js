// Sahne 2–3'te paylaşılan iki evren: A (vazgeçilen, soğuk yağmurlu sokak) ve B (cesaret edilen, altın saat çatı terası)
import { THREE, rng, windowTexture, glowSprite, skyDome, smooth } from './engine.js';
const T_B = 4.75;

export function worldA() {
  const g = new THREE.Group(); const R = rng(41);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 260), new THREE.MeshStandardMaterial({ color: 0x06080c, roughness: .16, metalness: .6 }));
  ground.rotation.x = -Math.PI / 2; ground.position.z = -90; ground.receiveShadow = true; g.add(ground);
  const tex = [0, 1, 2, 3].map(i => { const t = windowTexture(500 + i, false, 64, 256, .12); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; });
  for (const sx of [-1, 1]) for (let z = 10; z > -200;) {
    const w = 6 + R() * 8, d = 8 + R() * 10, h = 12 + Math.pow(R(), 1.5) * 45;
    const geo = new THREE.BoxGeometry(w, h, d); const uv = geo.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * Math.round(d / 4), uv.getY(k) * Math.round(h / 12));
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x0a0d13, roughness: .8, emissive: 0xffffff, emissiveMap: tex[Math.floor(R() * 4)], emissiveIntensity: .7 }));
    m.position.set(sx * (6.5 + w / 2), h / 2, z - d / 2); g.add(m); z -= d + .3;
  }
  for (let i = 0; i < 10; i++) {
    const sx = i % 2 ? 1 : -1, z = 6 - i * 15;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.07, .09, 5.5, 8), new THREE.MeshStandardMaterial({ color: 0x15171c, metalness: .7, roughness: .4 })); pole.position.set(sx * 5, 2.75, z); g.add(pole);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(.14, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(.6, .8, 1).multiplyScalar(5) })); bulb.position.set(sx * 4.6, 5.4, z); g.add(bulb);
    const l = new THREE.PointLight(0x8fbfff, 12, 18, 1.6); l.position.copy(bulb.position); g.add(l);
    const halo = glowSprite('#8fbfff', 2.6); halo.position.copy(bulb.position); g.add(halo);
    const refl = glowSprite('#6fa0ff', 1); refl.scale.set(1, 8, 1); refl.position.set(sx * 4.6, .02, z + 3); refl.material.opacity = .3; g.add(refl);
  }
  g.add(new THREE.HemisphereLight(0x2a4a7a, 0x05060a, .4));
  return g;
}

export function worldB() {
  const g = new THREE.Group(); const R = rng(77);
  // teras zemini (ahşap)
  const c = document.createElement('canvas'); c.width = 256; c.height = 256; const x = c.getContext('2d');
  for (let i = 0; i < 16; i++) { x.fillStyle = `hsl(${24 + R() * 8},${35 + R() * 10}%,${22 + R() * 10}%)`; x.fillRect(0, i * 16, 256, 15); x.fillStyle = 'rgba(0,0,0,.4)'; x.fillRect(0, i * 16 + 15, 256, 1); }
  const wt = new THREE.CanvasTexture(c); wt.wrapS = wt.wrapT = THREE.RepeatWrapping; wt.repeat.set(4, 4); wt.colorSpace = THREE.SRGBColorSpace;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(14, .2, 14), new THREE.MeshStandardMaterial({ map: wt, roughness: .7 })); deck.position.y = -.1; deck.receiveShadow = true; g.add(deck);
  // korkuluk
  const railM = new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: .5, metalness: .4 });
  for (const [px, pz, rx, len] of [[0, -7, 0, 14], [-7, 0, Math.PI / 2, 14], [7, 0, Math.PI / 2, 14]]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(len, .06, .06), railM); r.position.set(px, 1.05, pz); r.rotation.y = rx; g.add(r);
    for (let k = -6; k <= 6; k += 1.5) { const p = new THREE.Mesh(new THREE.BoxGeometry(.05, 1.05, .05), railM); const off = new THREE.Vector3(k, .52, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), rx); p.position.set(px + off.x, .52, pz + off.z); g.add(p); }
  }
  // saksılar / bitkiler
  for (let i = 0; i < 7; i++) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(.25, .2, .45, 12), new THREE.MeshStandardMaterial({ color: 0x8a4a2a, roughness: .8 }));
    const a = R() * 6; const p = new THREE.Vector3(i % 2 ? -6.2 : 6.2, .22, -6 + i * 1.8); pot.position.copy(p); g.add(pot);
    const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(.45 + R() * .25, 1), new THREE.MeshStandardMaterial({ color: 0x3f6b2a, roughness: .9, flatShading: true })); leaves.position.copy(p).add(new THREE.Vector3(0, .6, 0)); leaves.scale.y = 1.3; g.add(leaves);
  }
  // ip lambalar (zincir eğrileri)
  const bulbM = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, .75, .4).multiplyScalar(5) });
  const wireM = new THREE.LineBasicMaterial({ color: 0x111111 });
  for (let s = 0; s < 4; s++) {
    const a = new THREE.Vector3(-7, 3.2, -6 + s * 3.5), b = new THREE.Vector3(7, 3.4, -4.5 + s * 3.2);
    const pts = []; for (let k = 0; k <= 24; k++) { const t = k / 24; const p = a.clone().lerp(b, t); p.y -= Math.sin(t * Math.PI) * .9; pts.push(p); }
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireM));
    for (let k = 1; k < 24; k += 2) { const m = new THREE.Mesh(new THREE.SphereGeometry(.05, 8, 6), bulbM); m.position.copy(pts[k]).y -= .06; g.add(m); const h = glowSprite('#ffb060', .55); h.position.copy(m.position); h.material.opacity = .8; g.add(h); }
    const l = new THREE.PointLight(0xffa860, 5, 9, 1.6); l.position.copy(pts[12]); g.add(l);
  }
  // uzak şehir silueti (sıcak)
  const tex = [0, 1, 2].map(i => { const t = windowTexture(700 + i, true, 64, 256, .25); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; });
  for (let i = 0; i < 90; i++) {
    const a = -Math.PI * .95 + R() * Math.PI * .9 - Math.PI * .05, d = 140 + R() * 220, w = 8 + R() * 14, h = 10 + Math.pow(R(), 2) * 70;
    const geo = new THREE.BoxGeometry(w, h, w); const uv = geo.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * Math.round(w / 4), uv.getY(k) * Math.round(h / 12));
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x1a1218, roughness: .9, emissive: 0xffffff, emissiveMap: tex[i % 3], emissiveIntensity: .45 }));
    m.position.set(Math.cos(a) * d, h / 2 - 45, Math.sin(a) * d); g.add(m);
  }
  // gün batımı ışığı
  const sun = new THREE.DirectionalLight(0xffa25a, 3.2); sun.position.set(-20, 8, -30); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 }); g.add(sun); g.add(sun.target);
  const sunDisk = glowSprite('#ffb36b', 60); sunDisk.position.set(-200, 25, -300); g.add(sunDisk);
  const sunCore = new THREE.Mesh(new THREE.SphereGeometry(12, 24, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, .7, .4).multiplyScalar(3), fog: false })); sunCore.position.copy(sunDisk.position); g.add(sunCore);
  g.add(new THREE.HemisphereLight(0xffc4a0, 0x3a2030, .8));
  return g;
}
export const skyB = () => skyDome('#3a4a8a', '#ff9a6a', '#4a2a3a', { r: 800 });

// B evrenindeki çift: gülüşme (Sahne 2 ve 3 ortak)
export function poseCouple(heroB, ece, t) {
  heroB.root.position.set(-.42, 0, 0); heroB.root.rotation.y = Math.PI / 2 - .35;
  ece.root.position.set(.42, 0, -.05); ece.root.rotation.y = -Math.PI / 2 + .35;
  heroB.pose({ idle: [t * .9, 1] });
  ece.pose({ idle: [t * .9 + 1.3, 1] });
  // gülme: baş geri, omuz titremesi, gülümseme
  const lg = Math.max(0, Math.sin((t - T_B) * 2.2)) ;
  const shake = Math.sin(t * 22) * .5 + .5;
  heroB.rot('Spine2', -.05 - .07 * lg, 0, 0).rot('Neck', -.1 * lg, 0, 0).rot('Head', -.18 * lg + .04 * shake * lg, .05, 0).rot('Spine1', .03 * shake * lg, 0, 0);
  heroB.morph('mouthSmile', .8 + .2 * lg).morph('mouthOpen', .15 + .45 * lg * shake);
  const lg2 = Math.max(0, Math.sin((t - T_B) * 2.2 + .6));
  ece.rot('Spine2', .06 * lg2, 0, 0).rot('Neck', .12 * lg2, .1, 0).rot('Head', -.12 * lg2 + .05 * shake, .08, .06);
  // Ece elini ağzına götürür
  ece.root.updateMatrixWorld(true);
  const eh = ece.bones.Head.getWorldPosition(new THREE.Vector3());
  const fwdE = new THREE.Vector3(0, 0, 1).applyQuaternion(ece.root.quaternion);
  ece.ik('Left', eh.clone().add(fwdE.clone().multiplyScalar(.12)).add(new THREE.Vector3(0, -.09, 0)), new THREE.Vector3(0, -1, 0).add(fwdE.clone().multiplyScalar(-.5)), smooth(T_B + .5, T_B + 1.1, t) * (1 - smooth(6.6, 7.3, t)));
}
