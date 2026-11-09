// SAHNE 4 — KOZMİK GERÇEKLİK (23–32 sn): Milyonlarca cam küre, her birinde aynı insanın başka bir hayatı; biri kameraya döner
import { windowTexture } from './engine.js';
import { THREE, Person, assets, rng, clamp, lerp, smooth, ease, easeOut, easeIn, skyDome, glowSprite, glowTexture, dust } from './engine.js';
import { timeline, island } from './kozmos.js';

export const FRAMES = 270;
let scene, camera, glassMat, minis = [], hero, heroSphere, tls = [];

function glass(r, tint = '#bfe0ff') {
  return new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.FrontSide,
    uniforms: { uC: { value: new THREE.Color(tint) }, uO: { value: 1 } },
    vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uC; uniform float uO; varying vec3 vN; varying vec3 vV;
      void main(){ float f=pow(1.-max(dot(vN,vV),0.),3.); vec3 L=normalize(vec3(.4,.7,.6)); vec3 H=normalize(L+vV); float sp=0.; float sp2=0.;
        gl_FragColor=vec4(min(uC*f*2.0+vec3(sp+sp2),vec3(1.3)), clamp((f*.9+sp+.05)*uO,0.,1.)); }` }));
}

// küçük diorama: zemin diski + birkaç nesne + karakter
function diorama(kind, R) {
  const g = new THREE.Group(); const r = rng(R);
  const sets = {
    yagmur: { ground: 0x0a0c12, light: 0x8fb8ff, sky: '#2a4a8a', opts: {} },
    cift: { ground: 0x5a3a2a, light: 0xffa860, sky: '#ff9a6a', opts: { top: '#6a5240', scarf: '#c8a46a' } },
    gezgin: { ground: 0xc98a52, light: 0xffb070, sky: '#ff9a5a', opts: { top: '#c9b48a', bottom: '#5a4a38', backpack: '#7a3b22', hat: '#8a6a45', scarf: '#b4532a' } },
    yasli: { ground: 0x6a4a2a, light: 0xffb070, sky: '#e8b08a', opts: { top: '#5a4a5a', grey: true, beard: true, glasses: true, scarf: '#7a3a3a' } },
    asci: { ground: 0x3a2414, light: 0xffc080, sky: '#5a3a24', opts: { top: '#cfccc6', chefHat: true, bottom: '#2a2a2a', scarf: '#cfccc6' } },
    is: { ground: 0x15171c, light: 0x9ab8ff, sky: '#1a2a5a', opts: { top: '#1c1f26', bottom: '#1c1f26', tie: '#7a1020', scarf: null } },
    ressam: { ground: 0x5a4a3a, light: 0xdfeaff, sky: '#9ab0c0', opts: { top: '#8a9aa8', brush: true, scarf: '#d8b04a' } },
    deniz: { ground: 0xd8b890, light: 0xffa070, sky: '#ffb08a', opts: { top: '#7a8a9a', beard: true, scarf: null } },
    kitap: { ground: 0x2a3a2a, light: 0xffe0a0, sky: '#3a5a3a', opts: { top: '#3a5a4a', book: '#8a2a2a', glasses: true, scarf: '#c0a060' } },
    cicek: { ground: 0x3a5a2a, light: 0xffd0e0, sky: '#ffc0d0', opts: { top: '#e0c0a0', flower: '#ff4a7a', scarf: '#a04060' } },
  };
  const S = sets[kind];
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.0, .12, 40), new THREE.MeshStandardMaterial({ color: S.ground, roughness: .8 })); disc.position.y = -.75; g.add(disc);
  const inner = new THREE.Mesh(new THREE.SphereGeometry(1.5, 32, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(S.sky).multiplyScalar(.55), side: THREE.BackSide, transparent: true, opacity: .55, depthWrite: false })); g.add(inner);
  if (kind === 'yagmur') {
    const wt = windowTexture(77, true, 64, 256, .3); wt.repeat.set(2, 2); wt.wrapS = wt.wrapT = THREE.RepeatWrapping;
    for (let i = 0; i < 5; i++) { const h = .5 + r() * .7; const b = new THREE.Mesh(new THREE.BoxGeometry(.28, h, .28), new THREE.MeshStandardMaterial({ color: 0x0a0c12, emissive: 0xffffff, emissiveMap: wt, emissiveIntensity: .9 })); const a = -2.2 + i * .45; b.position.set(Math.cos(a) * .8, -.69 + h / 2, Math.sin(a) * .8); g.add(b); }
    disc.material.roughness = .15; disc.material.metalness = .6;
  } else for (let i = 0; i < 3; i++) { const a = r() * 6.28; const tr = new THREE.Mesh(new THREE.ConeGeometry(.12 + r() * .1, .4 + r() * .3, 7), new THREE.MeshStandardMaterial({ color: kind === 'yasli' ? 0xc0602a : 0x2f5a3a, flatShading: true })); tr.position.set(Math.cos(a) * .75, -.5, Math.sin(a) * .75); g.add(tr); }
  const l = new THREE.PointLight(S.light, 3, 4, 1.5); l.position.set(.5, .8, .6); g.add(l);
  const p = new Person(S.opts); p.root.scale.setScalar(.48); p.root.position.y = -.69; g.add(p.root);
  if (kind === 'cift') { const e = new Person({ female: true, top: '#b8664c' }); e.root.scale.setScalar(.48); e.root.position.set(.22, -.69, 0); e.root.rotation.y = -1.3; p.root.position.x = -.22; p.root.rotation.y = 1.3; g.add(e.root); g.userData.e = e; }
  if (kind === 'yagmur') { const lamp = new THREE.Mesh(new THREE.CylinderGeometry(.015, .015, 1.1, 6), new THREE.MeshStandardMaterial({ color: 0x222222 })); lamp.position.set(-.45, -.15, -.2); g.add(lamp); const b = glowSprite('#ffb36b', .22); b.position.set(-.45, .42, -.2); g.add(b); const bl = new THREE.PointLight(0xffb36b, 2.5, 2, 1.5); bl.position.set(-.45, .38, -.2); g.add(bl); }
  g.add(glass(1.6, S.sky));
  g.userData = { ...g.userData, p, kind };
  return g;
}

export async function setup({ W, H }) {
  scene = new THREE.Scene(); scene.environment = assets.envTex; scene.environmentIntensity = .6;
  scene.add(skyDome('#04030c', '#140c2c', '#02020a', { stars: 1.4, nebula: 1, nebColor: '#3a2ad8', nebColor2: '#ff6a9a', seed: 33, r: 1500 }));
  camera = new THREE.PerspectiveCamera(42, W / H, .05, 5000);
  scene.add(new THREE.AmbientLight(0x6a6aa0, .8));
  const key = new THREE.DirectionalLight(0xffe0c8, 1.2); key.position.set(5, 10, 8); scene.add(key);
  // binlerce boş/uzak küre (instanced) — içlerinde renkli bir "hayat ışığı"
  const N = 4200, R = rng(4);
  const sg = new THREE.SphereGeometry(1, 24, 16);
  const im = new THREE.InstancedMesh(sg, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    vertexShader: `attribute vec3 aC; varying vec3 vN; varying vec3 vV; varying vec3 c; varying float vD; void main(){ c=aC; vec4 mv=modelViewMatrix*instanceMatrix*vec4(position,1.); vN=normalize(normalMatrix*mat3(instanceMatrix)*normal); vV=normalize(-mv.xyz); vD=-mv.z; gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `varying vec3 vN; varying vec3 vV; varying vec3 c; varying float vD; void main(){ float d=clamp(dot(normalize(vN),normalize(vV)),0.001,1.); float f=(1.-d)*(1.-d)*(1.-d); float core=d*d*d*d*d*d;
      float fade=exp(-max(vD,0.)/420.); vec3 col=(c*f*1.3+c*core*.22)*fade+vec3(.06,.04,.12)*(1.-fade); gl_FragColor=vec4(clamp(col,0.,4.), clamp((f*.8+core*.4)*(.35+.65*fade),0.,1.)); }` }), N);
  const cols = new Float32Array(N * 3), m = new THREE.Matrix4(), pal = ['#ffb37a', '#9fd8ff', '#ff8fd0', '#a0ffd0', '#ffe6a0', '#c0b0ff', '#ff6a4a'];
  for (let i = 0; i < N; i++) {
    let p; do { p = new THREE.Vector3((R() - .5) * 600, (R() - .5) * 300, 40 - R() * 700); } while (Math.abs(p.x) < 12 && Math.abs(p.y) < 9 && p.z > -150);
    const s = .5 + Math.pow(R(), 3) * 6;
    m.compose(p, new THREE.Quaternion(), new THREE.Vector3(s, s, s)); im.setMatrixAt(i, m);
    const c = new THREE.Color(pal[i % pal.length]); cols.set([c.r, c.g, c.b], i * 3);
  }
  sg.setAttribute('aC', new THREE.InstancedBufferAttribute(cols, 3)); scene.add(im);
  // "milyonlar": çok uzak ışık noktaları
  const P = 30000, pp = new Float32Array(P * 3), pc = new Float32Array(P * 3);
  for (let i = 0; i < P; i++) { const a = R() * 6.28, b = Math.acos(2 * R() - 1), d = 300 + R() * 900; pp.set([Math.sin(b) * Math.cos(a) * d, Math.cos(b) * d * .6, Math.sin(b) * Math.sin(a) * d - 200], i * 3); const c = new THREE.Color(pal[i % pal.length]); pc.set([c.r, c.g, c.b], i * 3); }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pp, 3)); pg.setAttribute('color', new THREE.BufferAttribute(pc, 3));
  scene.add(new THREE.Points(pg, new THREE.PointsMaterial({ size: 2.2, map: glowTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .8 })));
  // yakın diorama küreleri — kamera yolu boyunca
  const kinds = ['cift', 'gezgin', 'kitap', 'yasli', 'asci', 'cicek', 'ressam', 'is', 'deniz'];
  kinds.forEach((k, i) => {
    const d = diorama(k, 50 + i); const side = i % 2 ? 1 : -1;
    d.position.set(side * (2.6 + (i % 3) * .5), (i % 3 - 1) * 1.4, -6 - i * 9); d.scale.setScalar(1.25); d.rotation.y = side * -.5;
    scene.add(d); minis.push(d);
  });
  // final küresi: ana karakter, yağmurlu sokak dioraması
  heroSphere = diorama('yagmur', 99); heroSphere.position.set(0, 0, -100); heroSphere.scale.setScalar(1.4); scene.add(heroSphere);
  hero = heroSphere.userData.p;
  heroSphere.add(dust(150, [2, 1.6, 2], '#9fc4ff', .015, 5, .5));
  // zaman çizgileri küreler arasında
  const TR = rng(8);
  for (let i = 0; i < 6; i++) { const pts = []; for (let k = 0; k < 10; k++) pts.push(new THREE.Vector3((TR() - .5) * 30, (TR() - .5) * 16, 10 - k * 14)); const tl = timeline(pts, ['#7fd4ff', '#ffb36b', '#ff7fd0'][i % 3], .03, i); scene.add(tl); tls.push(tl); }

  return { scene, camera };
}

export function frame(t, f, { grade, bloom }) {
  tls.forEach(l => { l.material.uniforms.uT.value = t; l.visible = t < 5.2; });
  minis.forEach((d, i) => {
    const p = d.userData.p; d.rotation.y += 0; d.position.y += Math.sin(t * .6 + i) * .002;
    if (['gezgin', 'yasli', 'deniz'].includes(d.userData.kind)) { p.pose({ walk: [t * .8 + i, 1] }); p.root.rotation.y = t * .5 + i; p.root.position.x = Math.sin(t * .5 + i) * .35; p.root.position.z = Math.cos(t * .5 + i) * .35; p.root.rotation.y = t * .5 + i + Math.PI / 2; }
    else p.pose({ idle: [t + i, 1] });
    if (d.userData.e) { d.userData.e.pose({ idle: [t + 2, 1] }); p.morph('mouthSmile', 1); }
  });
  // --- ana küre: yürür, durur, kameraya döner ---
  const tTurn = 6.2;
  const walking = 1 - smooth(tTurn - .5, tTurn, t);
  const ang = t * .55;
  hero.root.position.set(Math.sin(ang) * .3 * walking + Math.sin(tTurn * .55) * .3 * (1 - walking), -.69, Math.cos(ang) * .3 * walking + Math.cos(tTurn * .55) * .3 * (1 - walking));
  hero.root.rotation.y = (t < tTurn ? ang : tTurn * .55) + Math.PI / 2;
  hero.pose({ walk: [t * .8, walking], idle: [t, 1 - walking] });

  // --- kamera: kürelerin arasından ileri süzülme ---
  const k = clamp(t / 9);
  const z = lerp(4, -93.2, 1 - Math.pow(1 - ease(k * .98), 1.6)) - smooth(6.3, 9, t) * 2.0;
  const sway = Math.sin(t * .7) * 1.2 * (1 - smooth(5, 7, t));
  camera.position.set(sway, Math.sin(t * .5) * .6 * (1 - smooth(5, 7, t)) + .25 * smooth(5, 7, t), z);
  camera.fov = lerp(48, 30, smooth(5, 7, t)) - smooth(6.4, 9, t) * 10;
  hero.root.updateMatrixWorld(true); const headW = hero.bones.Head.getWorldPosition(new THREE.Vector3());
  const look = new THREE.Vector3(sway * .3, 0, z - 20).lerp(heroSphere.position.clone().add(new THREE.Vector3(0, .05, 0)), smooth(4, 6.5, t)).lerp(headW.add(new THREE.Vector3(0, -.15, 0)), smooth(6.3, 8.5, t));
  camera.lookAt(look); camera.rotateZ(Math.sin(t * .4) * .04 * (1 - smooth(5, 7, t)));
  camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
  // karakter aniden kameraya döner
  const turn = smooth(tTurn + .1, tTurn + .55, t);
  if (turn > 0) {
    hero.root.updateMatrixWorld(true);
    const hw = hero.root.getWorldPosition(new THREE.Vector3());
    const inv = heroSphere.matrixWorld.clone().invert();
    const camL = camera.position.clone().applyMatrix4(inv), hl = hero.root.position.clone();
    const yaw = Math.atan2(camL.x - hl.x, camL.z - hl.z);
    let cur = hero.root.rotation.y; let dy = yaw - cur; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    hero.root.rotation.y = cur + dy * turn * .75;
    hero.lookAt(camera.position, turn);
  }
  // grade
  grade.uFlash.value = Math.max(0, 1 - t / .4) * .6; grade.uFade.value = 0;
  grade.uCA.value = .0015 + smooth(tTurn + .1, tTurn + .4, t) * (1 - smooth(tTurn + .4, tTurn + 1.2, t)) * .008;
  grade.uTint.value.set(1, .97, 1.06); grade.uSat.value = 1.1; grade.uContrast.value = 1.06; grade.uVignette.value = .5 + smooth(6, 9, t) * .2; grade.uGrain.value = .05;
  bloom.strength = .7;
}
