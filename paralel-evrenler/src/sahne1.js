// SAHNE 1 — KANCA (0–5 sn): Yağmurlu gece, silinen mesaj, donan zaman, cam gibi çatlayan gerçeklik
import { THREE, Person, assets, rng, clamp, lerp, smooth, ease, easeOut, skyDome, windowTexture, glowSprite, dust, renderer } from './engine.js';
import { island, doorFrame, timeline, shards } from './kozmos.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

export const FRAMES = 150;
const T_FREEZE = 2.85, T_CRACK = 3.05;
let scene, other, camera, ocam, hero, rain, rainPos, rainBase, pass, frozenT;
const BG = 0, FG = 1;

function setLayer(o, l) { o.traverse(x => x.layers.set(l)); }
function both(o) { o.traverse(x => { x.layers.enable(0); x.layers.enable(1); }); }

let W0 = 1080;
export async function setup({ W, H }) {
  W0 = W;
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a1220, .028);
  scene.environment = assets.envTex; scene.environmentIntensity = .25;
  camera = new THREE.PerspectiveCamera(32, W / H, .03, 600);

  // --- gökyüzü + sokak ---
  const sky = skyDome('#04060c', '#0e1a2c', '#0e1a2c'); scene.add(sky);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 300), new THREE.MeshStandardMaterial({ color: 0x07090d, roughness: .18, metalness: .55, envMapIntensity: .6 }));
  ground.rotation.x = -Math.PI / 2; ground.position.z = -100; ground.receiveShadow = true; scene.add(ground);
  const walkM = new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: .5, metalness: .3 });
  for (const sx of [-1, 1]) { const w = new THREE.Mesh(new THREE.BoxGeometry(4, .16, 300), walkM); w.position.set(sx * 6.5, .08, -100); w.receiveShadow = true; scene.add(w); }
  // binalar iki yanda
  const R = rng(21);
  const texW = [0, 1, 2, 3, 4, 5].map(i => windowTexture(100 + i, i % 3 !== 0, 64, 256, .22));
  texW.forEach(t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; });
  for (const sx of [-1, 1]) for (let z = 12; z > -170; z -= 0) {
    const w = 6 + R() * 8, d = 8 + R() * 10, h = 10 + Math.pow(R(), 1.5) * 50;
    const geo = new THREE.BoxGeometry(w, h, d); const uv = geo.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * Math.round(d / 4), uv.getY(k) * Math.round(h / 12));
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x0b0d12, roughness: .7, emissive: 0xffffff, emissiveMap: texW[Math.floor(R() * 6)], emissiveIntensity: .75 }));
    m.position.set(sx * (8.6 + w / 2), h / 2, z - d / 2); scene.add(m); z -= d + .3;
  }
  // sokak lambaları + ıslak zemin yansıma çizgileri
  const lampM = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: .5, metalness: .7 });
  for (let i = 0; i < 9; i++) {
    const sx = i % 2 ? 1 : -1, z = 4 - i * 16;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.07, .09, 6, 8), lampM); pole.position.set(sx * 5, 3, z); scene.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.4, .08, .08), lampM); arm.position.set(sx * 4.4, 6, z); scene.add(arm);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(.16, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, .78, .5).multiplyScalar(6) })); bulb.position.set(sx * 3.8, 5.9, z); scene.add(bulb);
    const l = new THREE.PointLight(0xffb36b, i < 3 ? 22 : 10, 22, 1.6); l.position.set(sx * 3.8, 5.7, z); scene.add(l);
    const halo = glowSprite('#ffb36b', 3.2); halo.position.copy(bulb.position); scene.add(halo);
    const refl = glowSprite('#ff9a4a', 1); refl.scale.set(1.2, 9, 1); refl.position.set(sx * 3.8, .02, z + 3.5); refl.material.opacity = .35; refl.material.rotation = 0; scene.add(refl);
  }
  // neon tabelalar (yazısız, soyut)
  const neonC = ['#ff2e88', '#22e6ff', '#9d5bff', '#ff6a2e', '#2effa1'];
  for (let i = 0; i < 14; i++) {
    const sx = i % 2 ? 1 : -1, z = -6 - i * 10 - R() * 5, c = new THREE.Color(neonC[i % 5]);
    const shape = R() < .5 ? new THREE.TorusGeometry(.6 + R() * .5, .05, 8, 32) : new THREE.BoxGeometry(.1, 2 + R() * 3, .1);
    const n = new THREE.Mesh(shape, new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(5) }));
    n.position.set(sx * 8.5, 4 + R() * 8, z); n.rotation.y = Math.PI / 2; scene.add(n);
    const gl = glowSprite(neonC[i % 5], 4); gl.position.copy(n.position); gl.material.opacity = .5; scene.add(gl);
    const rf = glowSprite(neonC[i % 5], 1); rf.scale.set(1.5, 10, 1); rf.position.set(sx * 7.5, .02, z + 4); rf.material.opacity = .25; scene.add(rf);
  }
  // uzak bokeh ışıkları (araç farları gibi)
  for (let i = 0; i < 40; i++) { const b = glowSprite(R() < .6 ? '#ffcf8a' : '#ff4a3a', .5 + R()); b.position.set((R() - .5) * 8, .6 + R() * 1.5, -40 - R() * 120); b.material.opacity = .7; scene.add(b); }
  scene.add(new THREE.HemisphereLight(0x3a5a8a, 0x0a0806, .35));

  // --- yağmur ---
  const N = 4500; rainPos = new Float32Array(N * 6); rainBase = new Float32Array(N * 4); const rr = rng(5);
  for (let i = 0; i < N; i++) { rainBase[i * 4] = (rr() - .5) * 14; rainBase[i * 4 + 1] = rr() * 9; rainBase[i * 4 + 2] = 3 - rr() * 30; rainBase[i * 4 + 3] = .8 + rr() * .4; }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0x9fb8d8, transparent: true, opacity: .42, depthWrite: false, fog: true }));
  rain.frustumCulled = false; scene.add(rain);

  // --- karakter (ön plan katmanı) ---
  hero = new Person({ phone: true });
  hero.root.rotation.y = 0; scene.add(hero.root);
  const key = new THREE.SpotLight(0xffe2c8, 16, 14, .5, .6, 1.5); key.position.set(-2.5, 5, 1.5); key.target = hero.root; key.castShadow = true; key.shadow.mapSize.set(1024, 1024); scene.add(key);
  const rim = new THREE.SpotLight(0x5fa8ff, 40, 14, .6, .5, 1.5); rim.position.set(2.2, 3.5, -4); rim.target = hero.root; scene.add(rim);
  const rim2 = new THREE.PointLight(0xff3d8a, 1.2, 6, 2); rim2.position.set(-1.6, 1.8, -1.5); scene.add(rim2);
  setLayer(scene, BG);
  setLayer(hero.root, FG);
  both(key); both(rim); both(rim2); scene.children.filter(o => o.isLight).forEach(both);

  // --- çatlakların ardındaki diğer evrenler ---
  other = new THREE.Scene(); other.environment = assets.envTex;
  other.add(skyDome('#050816', '#101a38', '#04020a', { stars: 1, nebula: .55, nebColor: '#3a4bd8', nebColor2: '#ff9a5a', seed: 3 }));
  ocam = new THREE.PerspectiveCamera(70, W / H, .1, 2000);
  const OR = rng(77);
  for (let i = 0; i < 46; i++) {
    const isl = island({ seed: 300 + i, r: 3 + OR() * 9, warm: OR() < .55, flip: OR() < .2, glow: OR() < .5 ? '#ffb070' : '#7fc4ff' });
    isl.position.set((OR() - .5) * 120, (OR() - .5) * 70, 30 - OR() * 160); isl.rotation.y = OR() * 6; other.add(isl);
  }
  for (let i = 0; i < 40; i++) { const df = doorFrame(1.4, 2.6, OR() < .5 ? '#ffd9a0' : '#a0d8ff', 2.5); df.position.set((OR() - .5) * 120, (OR() - .5) * 80, -30 - OR() * 120); df.rotation.set(OR() * .6, OR() * 6, OR() * .6); df.scale.setScalar(1 + OR() * 5); other.add(df); }
  for (let i = 0; i < 6; i++) { const pts = []; for (let k = 0; k < 8; k++) pts.push(new THREE.Vector3((OR() - .5) * 140, (OR() - .5) * 70, -20 - k * 22)); other.add(timeline(pts, ['#7fd4ff', '#ffb36b', '#ff7fd0'][i % 3], .25, i)); }
  other.add(new THREE.AmbientLight(0x6a5aa8, 1.2));
  const sun = new THREE.DirectionalLight(0xffd1a0, 2.5); sun.position.set(30, 50, 20); other.add(sun);

  pass = new CrackPass(W, H);
  return { scene, camera, pass };
}

// ---------- Çatlama kompozit pass'i ----------
class CrackPass extends Pass {
  constructor(W, H) {
    super(); this.needsSwap = false;
    const o = { type: THREE.HalfFloatType, samples: 4 };
    this.rtA = new THREE.WebGLRenderTarget(W, H, o); this.rtB = new THREE.WebGLRenderTarget(W, H, o);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { tA: { value: this.rtA.texture }, tB: { value: this.rtB.texture }, uR: { value: 0 }, uP: { value: new THREE.Vector2(.5, .62) }, uAsp: { value: W / H }, uFall: { value: 0 }, uFreeze: { value: 0 }, uGlow: { value: 1 }, uBlur: { value: 0 }, uPx: { value: new THREE.Vector2(1 / W, 1 / H) } },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
      fragmentShader: `
        uniform sampler2D tA,tB; uniform float uR,uAsp,uFall,uFreeze,uGlow,uBlur; uniform vec2 uP,uPx; varying vec2 vUv;
        vec3 blurA(vec2 uv){ if(uBlur<.01) return texture2D(tA,uv).rgb; vec3 s=vec3(0.); float w=0.;
          for(int i=0;i<24;i++){ float a=float(i)*2.39996; float r=sqrt(float(i)/24.); vec2 o=vec2(cos(a),sin(a))*r*uBlur*uPx; vec3 c=texture2D(tA,uv+o).rgb; float k=1.+dot(c,vec3(.3,.6,.1))*2.; s+=c*k; w+=k; } return s/w; }
        vec2 h2(vec2 p){ p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))); return fract(sin(p)*43758.5453); }
        // Voronoi: x=kenar mesafesi, yz=hücre merkezi, w=id
        vec4 vor(vec2 x){ vec2 n=floor(x), f=fract(x); vec2 mg, mr; float md=8.;
          for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){ vec2 g=vec2(i,j); vec2 o=h2(n+g); vec2 r=g+o-f; float d=dot(r,r); if(d<md){ md=d; mr=r; mg=g; } }
          md=8.; for(int j=-2;j<=2;j++) for(int i=-2;i<=2;i++){ vec2 g=mg+vec2(i,j); vec2 o=h2(n+g); vec2 r=g+o-f; if(dot(mr-r,mr-r)>.00001) md=min(md,dot(.5*(mr+r),normalize(r-mr))); }
          vec2 cid=n+mg; return vec4(md, x+mr, h2(cid*1.37).x); }
        vec3 hue(vec3 c,float a){ const vec3 k=vec3(.57735); float ca=cos(a); return c*ca+cross(k,c)*sin(a)+k*dot(k,c)*(1.-ca); }
        void main(){
          vec2 asp=vec2(uAsp,1.); vec2 p=vUv*asp, P=uP*asp;
          vec4 v=vor(p*4.2+vec2(3.1,1.7)); vec2 cc=(v.yz-vec2(3.1,1.7))/4.2; float id=v.w;
          vec4 v2=vor(p*13.+7.);
          float dc=length(cc-P), dp=length(p-P);
          float b=clamp((uR-dc)/.12,0.,1.);
          vec2 r3=h2(vec2(id*91.7,id*13.1));
          vec2 dir=normalize(cc-P+1e-4);
          vec2 uvA=vUv+(r3-.5)*.018*b+dir/asp*uFall*b*(.2+r3.x)*.6;
          vec3 A=blurA(uvA);
          // donma: soğuk, hafif desatüre
          float l=dot(A,vec3(.3,.59,.11)); A=mix(A,mix(vec3(l),A,.55)*vec3(.85,.95,1.15),uFreeze);
          float reveal = step(.28,id)*b*smoothstep(0.,.5,uFall+b*.6);
          float sB=.45+r3.y*.45; vec2 uvB=(vUv-.5)*sB+.5+(r3-.5)*(1.-sB);
          vec3 B=texture2D(tB,uvB).rgb; B=hue(B,(id-.5)*2.4)*(1.1+r3.x*.5);
          vec3 col=mix(A,B,clamp(reveal,0.,1.));
          // çatlak çizgileri
          float on=step(dp,uR+.02);
          float e=(1.-smoothstep(0.,.006,v.x))*on;
          float e2=(1.-smoothstep(0.,.003,v2.x))*on*smoothstep(.55,.0,dp)*step(dp,uR*.8);
          vec3 lc=vec3(.75,.92,1.)*uGlow;
          col+=lc*e*1.5+lc*e2*.7;
          // kenarlarda kromatik kırılma
          col+=vec3(.5,.7,1.)*(1.-smoothstep(0.,.02,v.x))*on*.12*b;
          gl_FragColor=vec4(col,1.);
        }`,
      depthTest: false, depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.mat);
  }
  render(r, writeBuffer, readBuffer) {
    const cam = camera;
    cam.layers.set(BG);
    r.setRenderTarget(this.rtA); r.clear(); r.render(scene, cam);
    if (this.mat.uniforms.uR.value > 0) { r.setRenderTarget(this.rtB); r.clear(); r.render(other, ocam); }
    r.setRenderTarget(readBuffer); r.clear(); this.quad.render(r);
    cam.layers.set(FG); const ac = r.autoClear; r.autoClear = false; r.clearDepth(); r.render(scene, cam); r.autoClear = ac;
    cam.layers.enableAll();
  }
}

// ---------- telefon ekranı ----------
const DRAFT = 'Seni hâlâ düşünüyorum. Konuşabilir miyiz?';
function drawPhone(chars, t) {
  const c = hero.screenCanvas, g = c.getContext('2d'), W = c.width, H = c.height;
  g.fillStyle = '#0d1117'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#161b24'; g.fillRect(0, 0, W, 150);
  g.fillStyle = '#c99a7a'; g.beginPath(); g.arc(70, 95, 34, 0, 7); g.fill();
  g.fillStyle = '#f2f2f2'; g.font = '600 40px "DejaVu Sans"'; g.fillText('Ece', 122, 108);
  g.fillStyle = '#7d8696'; g.font = '26px "DejaVu Sans"'; g.fillText('son görülme 23:41', 124, 142);
  // eski mesajlar (bulanık, okunmayacak kadar küçük)
  const bub = (x, y, w, h, col) => { g.fillStyle = col; g.beginPath(); g.roundRect(x, y, w, h, 26); g.fill(); };
  bub(28, 200, 300, 60, '#232a35'); bub(200, 280, 280, 60, '#2a5a8a'); bub(28, 360, 230, 60, '#232a35');
  g.fillStyle = 'rgba(255,255,255,.2)'; g.font = '22px "DejaVu Sans"'; g.fillText('3 ay önce', 190, 180);
  // klavye
  g.fillStyle = '#1b1f27'; g.fillRect(0, 660, W, 412);
  for (let r = 0; r < 4; r++) for (let k = 0; k < 10 - (r === 3 ? 6 : r); k++) { g.fillStyle = '#2c323d'; g.beginPath(); g.roundRect(14 + k * 49 + r * 18 + (r === 3 ? 90 : 0), 690 + r * 92, r === 3 ? 160 : 40, 74, 8); g.fill(); }
  // yazma alanı
  g.fillStyle = '#141820'; g.fillRect(0, 440, W, 220);
  bub(24, 460, 380, 180, '#262e3b');
  const txt = DRAFT.slice(0, chars);
  g.fillStyle = '#f4f4f4'; g.font = '34px "DejaVu Sans"';
  const words = txt.split(' '); let line = '', y = 515; const lines = [];
  for (const w of words) { const tl = line ? line + ' ' + w : w; if (g.measureText(tl).width > 340) { lines.push(line); line = w; } else line = tl; }
  lines.push(line);
  if (!txt.length) { g.fillStyle = '#6b7484'; g.fillText('Mesaj', 48, 515); }
  else lines.slice(-3).forEach((l, i) => g.fillText(l, 48, y + i * 44));
  // imleç
  if (Math.floor(t * 2.2) % 2 === 0) { const ll = lines.slice(-3); const lw = txt.length ? g.measureText(ll[ll.length - 1]).width : 0; g.fillStyle = '#4ea3ff'; g.fillRect(48 + lw + 4, 485 + (ll.length - 1) * 44, 4, 40); }
  // gönder butonu
  g.fillStyle = chars > 0 ? '#2f86ff' : '#2a3140'; g.beginPath(); g.arc(452, 550, 42, 0, 7); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.moveTo(436, 530); g.lineTo(474, 550); g.lineTo(436, 570); g.lineTo(442, 550); g.fill();
  hero.screenTex.needsUpdate = true;
}

function updateRain(tt) {
  const N = rainBase.length / 4;
  for (let i = 0; i < N; i++) {
    const x = rainBase[i * 4], y0 = rainBase[i * 4 + 1], z = rainBase[i * 4 + 2], sp = rainBase[i * 4 + 3];
    let y = ((y0 - tt * 11 * sp) % 9 + 9) % 9;
    const L = .22 * sp;
    rainPos.set([x + .02, y, z, x, y + L, z], i * 6);
  }
  rain.geometry.attributes.position.needsUpdate = true;
}

export function frame(t, f, { grade, bloom }) {
  const frozen = t >= T_FREEZE;
  const wt = frozen ? T_FREEZE + (t - T_FREEZE) * .0 : t; // dünya zamanı donar
  updateRain(wt);
  // karakter: hafif nefes, telefona bakış
  hero.pose({ idle: [1.0 + t * .8, 1] });
  hero.holdPhone(1);
  // baş: telefona bakar; donmadan sonra yavaşça başını kaldırır
  const look = smooth(3.3, 4.6, t);
  hero.rot('Neck', .22 * (1 - look), 0, 0).rot('Head', .28 * (1 - look) - .05 * look, -.25 * smooth(3.8, 4.9, t), 0);
  hero.rot('Spine2', .06 * (1 - look), 0, 0);
  // telefon: taslak silinir
  const del = clamp((t - 1.55) / 1.05);
  const chars = Math.round(DRAFT.length * (1 - ease(del)));
  drawPhone(t < 1.55 ? DRAFT.length : chars, t);
  hero.phoneLight.intensity = .18; hero.phoneLight.position.add(new THREE.Vector3(0, .12, .05));
  // --- kamera ---
  if (t < 1.4) { // A: yüz yakın plan
    const k = t / 1.4;
    camera.fov = 24; camera.position.set(lerp(.55, .42, k), lerp(1.5, 1.52, k), lerp(1.75, 1.45, k)); camera.lookAt(-.02, 1.5, 0);
  } else if (t < 2.75) { // B: omuz üstü telefon
    const k = (t - 1.4) / 1.35;
    camera.fov = 20; camera.position.set(lerp(-.5, -.46, k), lerp(2.08, 2.04, k), lerp(-.5, -.42, k));
    const ph = hero.phone.getWorldPosition(new THREE.Vector3()); camera.lookAt(ph.x + .02, ph.y + .01, ph.z);
  } else { // C: alçak açı, yavaş yay — donma ve çatlama
    const k = (t - 2.75) / 2.25;
    camera.fov = 34;
    const a = lerp(.32, -.18, ease(k)), d = lerp(3.0, 2.55, k);
    camera.position.set(Math.sin(a) * d, lerp(1.05, 1.15, k), Math.cos(a) * d); camera.lookAt(0, 1.42, 0);
  }
  camera.updateProjectionMatrix();
  // diğer evrenler kamerası: sürekli süzülür
  ocam.position.set(Math.sin(t * .3) * 10, 20 + t * 1.5, 90 - t * 6); ocam.lookAt(0, -4, -60);
  scene.traverse(o => { if (o.material && o.material.uniforms && o.material.uniforms.uT) o.material.uniforms.uT.value = t; });
  other.traverse(o => { if (o.material && o.material.uniforms && o.material.uniforms.uT) o.material.uniforms.uT.value = t; });
  // çatlak
  const u = pass.mat.uniforms;
  const ck = clamp((t - T_CRACK) / 1.45);
  u.uR.value = t < T_CRACK ? 0 : .03 + Math.pow(ck, 1.35) * 1.6;
  u.uFall.value = smooth(4.25, 5.0, t);
  u.uFreeze.value = frozen ? smooth(T_FREEZE, T_FREEZE + .25, t) : 0;
  u.uGlow.value = 1 + smooth(4.5, 5, t) * 1.5;
  u.uBlur.value = (t < 2.75 ? 34 : lerp(22, 6, smooth(2.75, 3.4, t))) * (W0 / 1080);
  // grade
  grade.uFlash.value = (frozen ? Math.max(0, 1 - (t - T_FREEZE) / .18) * .45 : 0) + smooth(4.82, 5.0, t) * .95;
  grade.uCA.value = .0015 + (frozen ? Math.max(0, .012 * (1 - (t - T_FREEZE) / .6)) : 0) + smooth(4.2, 5, t) * .006;
  grade.uFade.value = 1 - smooth(0, .35, t);
  grade.uSat.value = frozen ? .85 : 1.05; grade.uVignette.value = .45; grade.uGrain.value = .055;
  grade.uTint.value.set(.95, 1, 1.08);
  bloom.strength = .5 + smooth(4.4, 5, t) * .4;
}
