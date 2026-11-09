// Alternatif hayatlar: her biri kendi küçük evreni olan sahneler (kapıların ardında / kürelerin içinde)
import { THREE, Person, assets, rng, skyDome, glowSprite, dust, windowTexture, lerp } from './engine.js';

function base(top, mid, bot, groundCol, opts = {}) {
  const s = new THREE.Scene(); s.environment = assets.envTex; s.environmentIntensity = opts.env ?? .4;
  s.add(skyDome(top, mid, bot, { r: 400, stars: opts.stars || 0, nebula: opts.nebula || 0 }));
  if (groundCol) { const g = new THREE.Mesh(new THREE.CircleGeometry(60, 48), new THREE.MeshStandardMaterial({ color: groundCol, roughness: .9 })); g.rotation.x = -Math.PI / 2; s.add(g); s.userData.ground = g; }
  if (opts.fog) s.fog = new THREE.Fog(opts.fog, 18, 140);
  return s;
}
const M = (c, r = .8, e) => new THREE.MeshStandardMaterial({ color: c, roughness: r, emissive: e || 0 });

export const LIVES = {
  // 1) Dünyayı gezen: çölde gün batımı, sırt çantası, şapka
  gezgin() {
    const s = base('#3b2d5a', '#ff9a5a', '#5a3a2a', 0xc98a52, { fog: 0xe6a070 });
    const R = rng(3);
    for (let i = 0; i < 14; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(6 + R() * 10, 24, 12, 0, 6.3, 0, 1.2), M(0xd39558, .95)); d.scale.y = .25; d.position.set((R() - .5) * 90, -1, -30 - R() * 50); s.add(d); }
    const sun = new THREE.Mesh(new THREE.SphereGeometry(5, 24, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, .6, .3).multiplyScalar(3), fog: false })); sun.position.set(-12, 4, -80); s.add(sun);
    s.add(new THREE.HemisphereLight(0xffc49a, 0x6a3a2a, 1.4)); const dl = new THREE.DirectionalLight(0xff9a5a, 3); dl.position.set(-10, 4, -20); s.add(dl);
    const p = new Person({ top: '#c9b48a', bottom: '#5a4a38', backpack: '#7a3b22', hat: '#8a6a45', scarf: '#b4532a' }); s.add(p.root);
    return { scene: s, people: [p], update(t) { p.root.rotation.y = .5; p.root.position.set(0, 0, -1.5); p.pose({ walk: [t * .9, 1] }); s.userData.ground.position.z = (t * 1.1) % 10; } };
  },
  // 2) Aşçı: sıcak mutfak ışığı
  asci() {
    const s = base('#1a1008', '#3a2414', '#1a1008', 0x2a1a10, { env: .6 });
    const counter = new THREE.Mesh(new THREE.BoxGeometry(3, .95, .7), M(0x8a8a88, .35)); counter.position.set(0, .47, .65); s.add(counter);
    const top = new THREE.Mesh(new THREE.BoxGeometry(3.05, .05, .75), M(0xd8d0c0, .3)); top.position.set(0, .96, .65); s.add(top);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(10, 5), M(0x4a3020, .9)); wall.position.set(0, 2.5, -1.2); s.add(wall);
    for (let i = 0; i < 9; i++) { const pan = new THREE.Mesh(new THREE.CylinderGeometry(.18, .15, .06, 16), M(0x6a4a30, .3)); pan.material.metalness = .8; pan.position.set(-1.6 + i * .4, 2.2 + (i % 2) * .3, -1.1); pan.rotation.x = Math.PI / 2; s.add(pan); }
    for (let i = 0; i < 3; i++) { const l = new THREE.Mesh(new THREE.ConeGeometry(.25, .3, 16, 1, true), M(0x222222, .4)); l.position.set(-1 + i, 2.6, .4); s.add(l); const b = new THREE.PointLight(0xffb36b, 6, 6, 1.5); b.position.set(-1 + i, 2.4, .4); s.add(b); const g = glowSprite('#ffb36b', .8); g.position.set(-1 + i, 2.42, .4); s.add(g); }
    const steam = dust(80, [.6, 1.2, .4], '#ffffff', .06, 7, .25); steam.position.set(.5, 1.5, .6); s.add(steam);
    s.add(new THREE.HemisphereLight(0xffd0a0, 0x2a1a10, .7));
    const p = new Person({ top: '#cfccc6', chefHat: true, bottom: '#2a2a2a', scarf: '#cfccc6' }); s.add(p.root);
    return { scene: s, people: [p], update(t) {
      p.root.position.set(0, 0, 0); p.root.rotation.y = 0; p.pose({ idle: [t, 1] });
      p.root.updateMatrixWorld(true); const c = Math.sin(t * 9) * .03;
      p.ik('Right', new THREE.Vector3(-.25, 1.05 + Math.max(0, c), .48), new THREE.Vector3(-1, -1, -.3)); p.ik('Left', new THREE.Vector3(.25, 1.02, .45), new THREE.Vector3(1, -1, -.3));
      p.rot('Neck', .35, 0, 0); steam.position.y = 1.5 + (t * .3) % .4; } };
  },
  // 3) Ressam: stüdyo, tuval
  ressam() {
    const s = base('#2a3a4a', '#9ab0c0', '#2a3a4a', 0x5a4a3a, { env: .6 });
    const easel = new THREE.Group(); const wood = M(0x6a4a2a, .8);
    for (const x of [-.4, .4]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(.05, 1.9, .05), wood); leg.position.set(x, .95, 0); leg.rotation.z = x > 0 ? -.08 : .08; easel.add(leg); }
    const c = document.createElement('canvas'); c.width = 256; c.height = 320; const g = c.getContext('2d'); const R = rng(8);
    const gr = g.createLinearGradient(0, 0, 0, 320); gr.addColorStop(0, '#1a2a6a'); gr.addColorStop(.6, '#e07a5a'); gr.addColorStop(1, '#3a2a4a'); g.fillStyle = gr; g.fillRect(0, 0, 256, 320);
    for (let i = 0; i < 160; i++) { g.fillStyle = `hsla(${R() * 360},70%,60%,.5)`; g.beginPath(); g.arc(R() * 256, R() * 320, 3 + R() * 14, 0, 7); g.fill(); }
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
    const canvas = new THREE.Mesh(new THREE.BoxGeometry(.9, 1.1, .03), [wood, wood, wood, wood, new THREE.MeshStandardMaterial({ map: tx, roughness: .9 }), wood]); canvas.position.set(0, 1.45, .03); easel.add(canvas);
    easel.position.set(.55, 0, .5); easel.rotation.y = -.6; s.add(easel);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(3, 3.5), new THREE.MeshBasicMaterial({ color: new THREE.Color(.7, .8, .95).multiplyScalar(.8) })); win.position.set(-1.5, 2.2, -2); s.add(win);
    const dl = new THREE.DirectionalLight(0xdfeaff, 2.2); dl.position.set(-3, 4, 2); s.add(dl); s.add(new THREE.HemisphereLight(0xcfe0ff, 0x4a3a2a, .9));
    const p = new Person({ top: '#8a9aa8', bottom: '#3a3a42', brush: true, scarf: '#d8b04a' }); s.add(p.root);
    return { scene: s, people: [p], update(t) {
      p.root.position.set(-.2, 0, 0); p.root.rotation.y = .9; p.pose({ idle: [t, 1] });
      const ph = new THREE.Vector3(.35 + Math.sin(t * 3) * .06, 1.45 + Math.sin(t * 2.3) * .1, .55);
      p.ik('Right', ph, new THREE.Vector3(0, -1, -1)); p.lookAt(new THREE.Vector3(.55, 1.45, .5), .8); } };
  },
  // 4) Yaşlı hali: sonbahar parkı, gri saç, baston
  yasli() {
    const s = base('#6a5a7a', '#e8b08a', '#5a4a3a', 0x6a4a2a, { fog: 0xd8a080 });
    const R = rng(12);
    for (let i = 0; i < 12; i++) { const tr = new THREE.Group(); const tk = new THREE.Mesh(new THREE.CylinderGeometry(.12, .18, 3, 8), M(0x3a2a1a)); tk.position.y = 1.5; tr.add(tk); const cr = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 1), M(R() < .5 ? 0xc0602a : 0xd8902a, .9)); cr.position.y = 3.6; cr.material.flatShading = true; tr.add(cr); tr.position.set((R() - .5) * 20, 0, -4 - R() * 18); s.add(tr); }
    const leaves = dust(220, [10, 6, 8], '#e08a3a', .09, 13, .9); leaves.position.y = 3; s.add(leaves); s.userData.leaves = leaves;
    s.add(new THREE.HemisphereLight(0xffd8b0, 0x5a3a2a, 1.2)); const dl = new THREE.DirectionalLight(0xffb070, 2.5); dl.position.set(4, 5, 3); s.add(dl);
    const p = new Person({ top: '#5a4a5a', bottom: '#4a4a4a', grey: true, beard: true, glasses: true, scarf: '#7a3a3a' });
    const cane = new THREE.Mesh(new THREE.CylinderGeometry(.015, .015, .9, 8), M(0x3a2a1a, .6)); s.add(cane); s.add(p.root);
    return { scene: s, people: [p], update(t) {
      p.root.position.set(0, 0, -1 + (t * .35) % 2); p.root.rotation.y = .3; p.pose({ walk: [t * .6, .7], sad_pose: [0, .3] });
      p.rot('Spine1', .15, 0, 0).rot('Neck', .1, 0, 0);
      p.root.updateMatrixWorld(true); const hp = p.bones.RightHand.getWorldPosition(new THREE.Vector3()); cane.position.set(hp.x, hp.y - .45, hp.z);
      leaves.position.y = 3 - (t * .5) % 2; } };
  },
  // 5) Çocukluğu: karda koşan çocuk
  cocuk() {
    const s = base('#5a7090', '#b8c8d8', '#8a98a8', 0xc8d0dc, { fog: 0xb8c8d8, env: .4 });
    const R = rng(15);
    for (let i = 0; i < 10; i++) { const tr = new THREE.Mesh(new THREE.ConeGeometry(.9, 3, 8), M(0x2a4a3a, .9)); tr.position.set((R() - .5) * 18, 1.5, -3 - R() * 15); s.add(tr); }
    const snow = dust(400, [10, 7, 8], '#ffffff', .05, 16, .6); snow.position.y = 3; s.add(snow);
    s.add(new THREE.HemisphereLight(0xffffff, 0x8aa0c0, .8)); const sl = new THREE.DirectionalLight(0xfff0e0, 1.5); sl.position.set(3, 4, 3); s.add(sl);
    const p = new Person({ top: '#c03a3a', bottom: '#2a3a6a', scarf: '#f0c040', noScarf: false }); p.root.scale.setScalar(.62); s.add(p.root);
    return { scene: s, people: [p], update(t) { p.root.position.set(Math.sin(t * .8) * .8, 0, -1); p.root.rotation.y = Math.cos(t * .8) > 0 ? 1.2 : -1.2; p.root.rotation.y = .9; p.pose({ run: [t * 1.0, 1] }); snow.position.y = 3 - (t * .6) % 2; s.userData.ground.position.x = -(t * 2) % 10; } };
  },
  // 6) İş insanı: gece ofis, şehir manzarası, takım elbise
  isinsani() {
    const s = base('#05070f', '#0e1830', '#05070f', 0x15171c, { env: .5 });
    const tex = windowTexture(901, false, 64, 256, .4); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(6, 3);
    const city = new THREE.Mesh(new THREE.PlaneGeometry(20, 10), new THREE.MeshBasicMaterial({ map: tex, color: 0x8ab0ff })); city.position.set(0, 4, -6); s.add(city);
    for (let i = -3; i <= 3; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(.08, 5, .08), M(0x222428, .4)); m.position.set(i * 1.4, 2.5, -2); s.add(m); }
    const desk = new THREE.Mesh(new THREE.BoxGeometry(1.8, .06, .8), M(0x1a1a1a, .3)); desk.position.set(.8, .75, .2); s.add(desk);
    const lamp = new THREE.PointLight(0x9ab8ff, 5, 6, 1.6); lamp.position.set(.8, 2, .6); s.add(lamp);
    s.add(new THREE.HemisphereLight(0x6a8aff, 0x101015, .7));
    const p = new Person({ top: '#1c1f26', bottom: '#1c1f26', tie: '#7a1020', scarf: null });
    p.opts.scarf = null; s.add(p.root);
    return { scene: s, people: [p], update(t) { p.root.position.set(-.3, 0, -.6); p.root.rotation.y = Math.PI * .85; p.pose({ idle: [t, 1] }); p.ik('Right', new THREE.Vector3(-.2, 1.62, -.62), new THREE.Vector3(1, -1, 0)); p.lookAt(new THREE.Vector3(-1, 1.6, -5), .5); } };
  },
  // 7) Baba: sahilde çocuğunun elinden tutuyor
  baba() {
    const s = base('#3a5a8a', '#ffb08a', '#2a3a5a', 0xd8b890, { fog: 0xf0b090 });
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(200, 80), new THREE.MeshStandardMaterial({ color: 0x3a6a8a, roughness: .15, metalness: .5 })); sea.rotation.x = -Math.PI / 2; sea.position.set(0, .02, -45); s.add(sea);
    const sun = new THREE.Mesh(new THREE.SphereGeometry(6, 24, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, .55, .3).multiplyScalar(3), fog: false })); sun.position.set(10, 4, -90); s.add(sun);
    s.add(new THREE.HemisphereLight(0xffc0a0, 0x6a5a4a, 1.3)); const dl = new THREE.DirectionalLight(0xffa070, 2.5); dl.position.set(10, 5, -20); s.add(dl);
    const p = new Person({ top: '#7a8a9a', bottom: '#5a6a7a', scarf: null, beard: true }); s.add(p.root);
    const kid = new Person({ top: '#f0a040', bottom: '#3a5a8a', scarf: null }); kid.root.scale.setScalar(.55); s.add(kid.root);
    return { scene: s, people: [p, kid], update(t) {
      const z = -1 - (t * .5) % 1.5;
      p.root.position.set(-.3, 0, z); p.root.rotation.y = Math.PI; kid.root.position.set(.3, 0, z); kid.root.rotation.y = Math.PI;
      p.pose({ walk: [t * .85, 1] }); kid.pose({ walk: [t * 1.2 + .3, 1] });
      p.root.updateMatrixWorld(true); kid.root.updateMatrixWorld(true);
      const kh = kid.bones.RightHand.getWorldPosition(new THREE.Vector3());
      p.ik('Left', kh.add(new THREE.Vector3(.02, .03, 0)), new THREE.Vector3(0, -1, 0)); } };
  },
};
