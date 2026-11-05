// KAPI 204 - BOLUM 1 : zamanlamali sahne yonetimi, kamera, post-process ve ekran yazilari
import * as THREE from 'three';
import { buildCorridor, buildFlat, makePackage } from './sets.js';
import { makeMan, armIK } from './man.js';
import * as TX from './textures.js';

const W = 720, H = 1280, FPS = 24;
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NoToneMapping;

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const ease = (t) => t * t * (3 - 2 * t);
// anahtar kare: [[t,v],...] (v sayi veya dizi) yumusak gecis
function key(t, ks) {
  if (t <= ks[0][0]) return ks[0][1];
  for (let i = 0; i < ks.length - 1; i++) {
    const [t0, v0] = ks[i], [t1, v1] = ks[i + 1];
    if (t <= t1) { const k = ease((t - t0) / (t1 - t0)); return Array.isArray(v0) ? v0.map((v, j) => lerp(v, v1[j], k)) : lerp(v0, v1, k); }
  }
  return ks[ks.length - 1][1];
}
const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
function shake(t, amp, sp = 1) {
  return [amp * (Math.sin(t * 1.7 * sp) * 0.6 + Math.sin(t * 3.1 * sp + 1) * 0.3 + Math.sin(t * 7.3 * sp + 2) * 0.1),
          amp * (Math.sin(t * 1.3 * sp + 4) * 0.6 + Math.sin(t * 2.9 * sp + 3) * 0.3 + Math.sin(t * 6.1 * sp) * 0.1),
          amp * 0.5 * Math.sin(t * 1.1 * sp + 2)];
}

// --------------------------------------------------------------- fontlar
async function loadFonts() {
  const L = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
  const LE = 'U+0100-02AF,U+0304,U+0308,U+0329,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';
  const defs = [
    ['Oswald', 'oswald-latin-400-normal', '400', 'normal', L], ['Oswald', 'oswald-latin-ext-400-normal', '400', 'normal', LE],
    ['Oswald', 'oswald-latin-600-normal', '600', 'normal', L], ['Oswald', 'oswald-latin-ext-600-normal', '600', 'normal', LE],
    ['Caveat', 'caveat-latin-700-normal', '700', 'normal', L], ['Caveat', 'caveat-latin-ext-700-normal', '700', 'normal', LE],
    ['Cormorant', 'cormorant-garamond-latin-600-italic', '600', 'italic', L], ['Cormorant', 'cormorant-garamond-latin-ext-600-italic', '600', 'italic', LE],
  ];
  for (const [fam, file, w, st, ur] of defs) {
    const f = new FontFace(fam, `url(./fonts/${file}.woff2)`, { weight: w, style: st, unicodeRange: ur });
    await f.load(); document.fonts.add(f);
  }
  // tum glifleri onceden yukle
  for (const s of ['600 20px Oswald', '400 20px Oswald', '700 20px Caveat', 'italic 600 20px Cormorant']) await document.fonts.load(s, 'ĞÜŞİÖÇğüşıöç204…');
}

let env = null, keyJ;
let scene, camera, man, cor, flat, photo, insertHands, phone, dust, photoCanvasTex;
let sceneRT, bloomA, bloomB, postMat, blurMat, quadScene, quadCam, quad, overlayCanvas, overlayCtx, overlayTex;

async function init() {
  await loadFonts();
  env = await (await fetch('./env.json')).json();
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.FogExp2(0x0b0e14, 0.05);
  camera = new THREE.PerspectiveCamera(58, W / H, 0.02, 60);

  const shared = { makePackage };
  cor = buildCorridor(shared); flat = buildFlat(shared);
  scene.add(cor.G, flat.G);
  man = makeMan(); scene.add(man.root);
  photo = makePhoto(); scene.add(photo.group);
  insertHands = makeInsertHands(); scene.add(insertHands.group);
  phone = makePhone();
  dust = makeDust(); scene.add(dust);

  // render hedefleri
  sceneRT = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
  bloomA = new THREE.WebGLRenderTarget(W / 4, H / 4, { type: THREE.HalfFloatType });
  bloomB = new THREE.WebGLRenderTarget(W / 4, H / 4, { type: THREE.HalfFloatType });
  overlayCanvas = document.createElement('canvas'); overlayCanvas.width = W; overlayCanvas.height = H;
  overlayCtx = overlayCanvas.getContext('2d');
  overlayTex = new THREE.CanvasTexture(overlayCanvas); overlayTex.colorSpace = THREE.NoColorSpace;
  quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const vs = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`;
  blurMat = new THREE.ShaderMaterial({
    uniforms: { tex: { value: null }, dir: { value: new THREE.Vector2() }, thr: { value: 0 } }, vertexShader: vs,
    fragmentShader: `varying vec2 vUv; uniform sampler2D tex; uniform vec2 dir; uniform float thr;
      void main(){ vec3 c=vec3(0.); float w[5]; w[0]=.227;w[1]=.194;w[2]=.121;w[3]=.054;w[4]=.016;
        for(int i=-4;i<=4;i++){ vec3 s=texture2D(tex,vUv+dir*float(i)).rgb; if(thr>0.){ s=max(s-thr,0.);} c+=s*w[i<0?-i:i]; }
        gl_FragColor=vec4(c,1.); }`
  });
  postMat = new THREE.ShaderMaterial({
    uniforms: { tex: { value: sceneRT.texture }, bloom: { value: bloomB.texture }, ov: { value: overlayTex }, time: { value: 0 },
      exposure: { value: 1 }, fade: { value: 1 }, vig: { value: 1 }, ca: { value: 0.0015 }, grade: { value: 0 }, flash: { value: 0 } },
    vertexShader: vs,
    fragmentShader: `varying vec2 vUv; uniform sampler2D tex, bloom, ov; uniform float time, exposure, fade, vig, ca, grade, flash;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
      vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.,1.); }
      void main(){
        vec2 d = vUv-0.5;
        vec3 c;
        c.r = texture2D(tex, vUv - d*ca).r; c.g = texture2D(tex, vUv).g; c.b = texture2D(tex, vUv + d*ca).b;
        c += texture2D(bloom, vUv).rgb * 0.4;
        c *= exposure;
        c = aces(c);
        // sinematik renk: golgelerde camgobegi, isiklarda sicak
        float l = dot(c, vec3(0.299,0.587,0.114));
        c = mix(vec3(l), c, 0.82);
        c += vec3(-0.012, 0.006, 0.02) * (1.0 - smoothstep(0.0, 0.5, l));
        c *= mix(vec3(1.0), vec3(1.05, 0.99, 0.92), smoothstep(0.3, 0.9, l));
        c = pow(c, vec3(1.0/2.2));
        // kontrast egrisi
        c = c*c*(3.0-2.0*c)*0.35 + c*0.65;
        // vinyet
        float v = 1.0 - smoothstep(0.25, 0.95, length(d*vec2(1.0, 0.75)));
        c *= mix(1.0, v, 0.85*vig);
        // film greni
        float g = h(vUv*vec2(720.,1280.) + fract(time*17.31)*91.7) - 0.5;
        c += g * 0.055 * (1.0 - l*0.5);
        c = mix(c, vec3(1.0), flash);
        c *= fade;
        vec4 o = texture2D(ov, vUv);
        c = c*(1.0-o.a) + o.rgb;
        gl_FragColor = vec4(c, 1.0);
      }`
  });
  quadScene = new THREE.Scene();
  quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat); quadScene.add(quad);

  keyJ = new THREE.SpotLight(0xffc89a, 1.6, 4, 0.45, 0.8, 2); keyJ.position.set(0.75, 1.75, -0.85); keyJ.target.position.set(0.08, 1.55, -1.55); keyJ.castShadow = true; keyJ.shadow.mapSize.set(1024, 1024); keyJ.shadow.bias = -0.0004; flat.G.add(keyJ, keyJ.target);
  bakePhoto();
  window.READY = true;
}

// ---------------------------------------------------------- fotograf nesnesi
function makePhoto() {
  const group = new THREE.Group();
  const pw = 0.102, ph = 0.152;
  photoCanvasTex = new THREE.CanvasTexture(document.createElement('canvas'));
  const front = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshStandardMaterial({ map: photoCanvasTex, roughness: 0.25, emissive: 0xffffff, emissiveMap: photoCanvasTex, emissiveIntensity: 0.32 }));
  const pb = TX.photoBack(); const back = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshStandardMaterial({ map: pb, roughness: 0.8, emissive: 0xffffff, emissiveMap: pb, emissiveIntensity: 0.22 }));
  back.rotation.y = Math.PI; back.position.z = -0.0005;
  front.castShadow = back.castShadow = true; front.receiveShadow = back.receiveShadow = true;
  group.add(front, back); group.visible = false;
  return { group, front, back };
}
// Fotograf: evin ICINDEN, karanlik koridordan salona dogru flasla cekilmis
function bakePhoto() {
  const RW = 408, RH = 608;
  const rt = new THREE.WebGLRenderTarget(RW, RH, { type: THREE.UnsignedByteType, samples: 4 });
  cor.G.visible = false; flat.G.visible = true; man.root.visible = false; flat.pkg.group.visible = false; photo.group.visible = false; insertHands.group.visible = false; dust.visible = false;
  flat.bdPivot.rotation.y = 0.6;
  const cam = new THREE.PerspectiveCamera(62, RW / RH, 0.05, 30);
  cam.position.set(-0.22, 1.45, -3.3); cam.lookAt(0.15, 0.75, 0.6);
  const fl = new THREE.PointLight(0xfff2dd, 40, 14, 2); fl.position.copy(cam.position); fl.position.y += 0.05; scene.add(fl);
  const oldFog = scene.fog.density; scene.fog.density = 0.02;
  renderer.setRenderTarget(rt); renderer.render(scene, cam); renderer.setRenderTarget(null);
  scene.remove(fl); scene.fog.density = oldFog;
  const buf = new Uint8Array(RW * RH * 4); renderer.readRenderTargetPixels(rt, 0, 0, RW, RH, buf);
  const c = document.createElement('canvas'); c.width = 640; c.height = 960; const x = c.getContext('2d');
  x.fillStyle = '#ece6da'; x.fillRect(0, 0, 640, 960);
  const tmp = document.createElement('canvas'); tmp.width = RW; tmp.height = RH; const tx = tmp.getContext('2d');
  const img = tx.createImageData(RW, RH);
  for (let yy = 0; yy < RH; yy++) for (let xx = 0; xx < RW; xx++) {
    const s = ((RH - 1 - yy) * RW + xx) * 4, d = (yy * RW + xx) * 4;
    for (let k = 0; k < 3; k++) {
      let v = buf[s + k] / 255; v = v * 4.0; v = v / (1 + v); v = Math.pow(v, 1 / 2.2);
      const warm = [1.08, 1.0, 0.82][k]; img.data[d + k] = Math.min(255, v * 255 * warm + 8);
    }
    img.data[d + 3] = 255;
  }
  tx.putImageData(img, 0, 0);
  x.drawImage(tmp, 28, 28, 584, 870);
  // vinyet + soluk renk
  const g = x.createRadialGradient(320, 460, 120, 320, 460, 520); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(10,5,0,0.55)');
  x.fillStyle = g; x.fillRect(28, 28, 584, 870);
  // tarih damgasi (turuncu dijital)
  x.font = '600 34px Oswald'; x.fillStyle = 'rgba(255,140,40,0.92)'; x.shadowColor = 'rgba(255,90,0,0.8)'; x.shadowBlur = 8; x.textAlign = 'right';
  x.fillText("05 11 '26   01:58", 590, 878); x.shadowBlur = 0;
  photoCanvasTex.image = c; photoCanvasTex.colorSpace = THREE.SRGBColorSpace; photoCanvasTex.needsUpdate = true;
  man.root.visible = true; flat.pkg.group.visible = true; dust.visible = true;
}

function makeInsertHands() {
  const group = new THREE.Group(); const hands = [];
  for (const s of [1, -1]) {
    const h = new THREE.Group();
    const sk = new THREE.MeshStandardMaterial({ color: 0x9c7868, roughness: 0.65 });
    const add = (geo, m, x, y, z, sx = 1, sy = 1, sz = 1) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = o.receiveShadow = true; h.add(o); return o; };
    const sph = new THREE.SphereGeometry(1, 24, 16);
    add(sph, sk, 0, 0, 0, 0.042, 0.05, 0.02);
    for (let f = 0; f < 4; f++) { const fi = add(new THREE.CapsuleGeometry(0.0095, 0.045 - Math.abs(f - 1.5) * 0.006, 6, 10), sk, (f - 1.5) * 0.019, 0.065, 0.006); fi.rotation.x = -0.35; }
    const th = add(new THREE.CapsuleGeometry(0.011, 0.04, 6, 10), sk, 0.038 * s, 0.025, 0.018); th.rotation.z = -0.7 * s; th.rotation.x = -0.6;
    add(new THREE.CylinderGeometry(0.043, 0.045, 0.06, 16), man.M.hoodieDark, 0, -0.07, 0);
    add(new THREE.CapsuleGeometry(0.05, 0.2, 6, 12), man.M.hoodie, 0, -0.2, 0);
    h.scale.setScalar(0.85); group.add(h); hands.push(h);
  }
  group.visible = false;
  return { group, hands };
}

function makePhone() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.15, 0.008), new THREE.MeshStandardMaterial({ color: 0x101012, roughness: 0.3, metalness: 0.5 }));
  body.castShadow = true; g.add(body);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.066, 0.142), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xbfd6ff, emissiveIntensity: 0.7 }));
  scr.position.z = 0.0042; g.add(scr);
  const light = new THREE.SpotLight(0xd8e2ff, 0.35, 1.5, 0.6, 1, 2); light.position.set(0, 0, 0.03); light.target.position.set(0, 0, 1); g.add(light, light.target);
  return { group: g, light };
}

function makeDust() {
  const n = 500; const g = new THREE.BufferGeometry(); const p = new Float32Array(n * 3);
  TX.setSeed(999);
  for (let i = 0; i < n; i++) { p[i * 3] = (TX.rnd() - 0.5) * 2.5; p[i * 3 + 1] = TX.rnd() * 2.6; p[i * 3 + 2] = (TX.rnd() - 0.5) * 4; }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d');
  const gr = x.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 32, 32);
  const m = new THREE.PointsMaterial({ size: 0.012, map: new THREE.CanvasTexture(c), transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xcfd8e8 });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; return pts;
}

// ======================================================= POZLAR
const R = (o, x = 0, y = 0, z = 0) => o.rotation.set(x, y, z);
function resetPose() {
  const J = man.J;
  for (const k of Object.keys(J)) { J[k].rotation.set(0, 0, 0); J[k].quaternion.identity(); }
  J.hips.position.set(0, 0.95, 0);
  R(J.shL, 0, 0, 0.08); R(J.shR, 0, 0, -0.08); R(J.elL, -0.15); R(J.elR, -0.15);
}
function seated() {
  const J = man.J;
  J.hips.position.set(0, 0.52, 0);
  R(J.hipL, -1.5, 0, 0.06); R(J.hipR, -1.5, 0, -0.06); R(J.kneeL, 1.5); R(J.kneeR, 1.5);
}
function mouthAt(t) { const i = Math.floor(t * FPS); return env.mouth[Math.min(env.mouth.length - 1, Math.max(0, i))] || 0; }
function blinkAt(t) {
  const bl = [1.2, 4.4, 6.9, 9.6, 12.9, 16.6, 19.2, 23.3, 26.0, 27.8];
  let k = 1; for (const b of bl) { const d = Math.abs(t - b); if (d < 0.09) k = Math.min(k, d / 0.09); }
  return k;
}
function faceUpdate(t, talk, fear = 0.5) {
  man.setJaw(talk ? Math.min(1, mouthAt(t) * 0.85) : 0.03);
  man.setLids(blinkAt(t) * (1 + 0.25 * fear));
  man.browsWorried(fear);
}

// ======================================================= SAHNE / CEKIM
const FLICK = [[0.55, 0.05], [0.66, 0.04], [1.95, 0.07], [2.12, 0.03], [4.65, 0.06], [7.1, 0.05]];
function fluoAt(t) {
  if (t < 0.55) return 0;
  for (const [a, d] of FLICK) if (t >= a && t < a + d) return 0.08;
  return 1 + 0.04 * Math.sin(t * 100 * 6.28 * 0.37);
}
let shotName = '';
function setCam(pos, look, fov = 58, sh = 0, t = 0, roll = 0) {
  const s = shake(t, sh);
  camera.position.set(pos[0] + s[0], pos[1] + s[1], pos[2] + s[2]);
  camera.lookAt(look[0] + s[0] * 0.5, look[1] + s[1] * 0.5, look[2]);
  camera.rotateZ(roll + s[2] * 0.3);
  camera.fov = fov; camera.updateProjectionMatrix();
}
function setVisible(c) {
  cor.G.visible = c; flat.G.visible = !c;
}

function update(t) {
  let exposure = 1.0, fade = 1.0, vig = 1.0, flash = 0;
  resetPose();
  man.root.visible = true; photo.group.visible = false; insertHands.group.visible = false;
  if (phone.group.parent) phone.group.parent.remove(phone.group);
  man.gaze(0, 0);
  dust.material.opacity = 0.3;
  flat.pkg.group.visible = true; flat.pkg.lid.position.set(0, 0.13, 0); flat.pkg.lid.rotation.set(0, 0, 0);
  flat.pkg.group.position.set(0, 0.76, 0.18); flat.pkg.group.rotation.set(0, 0.15, 0);
  flat.shadowM.uniforms.prog.value = 0; flat.shadowM.uniforms.time.value = t;
  flat.gapGlowM.opacity = 0.0; flat.gapLine.visible = true; flat.hallL.intensity = 2.2; if (keyJ) keyJ.intensity = 0;
  scene.fog.density = 0.05;

  if (t < 5.6) {
    // ------------------------------------------- SAHNE 1-2: KORIDOR
    setVisible(true);
    const f = fluoAt(t);
    cor.fluo.intensity = 26 * f; cor.tubeM.emissiveIntensity = 6 * f;
    scene.fog.color.set(0x0d1118); scene.fog.density = 0.07;
    // kapi
    const da = key(t, [[3.15, 0], [3.6, 0.12], [4.35, 1.05]]);
    cor.door.rotation.y = -da;
    cor.warm.intensity = 9 * clamp(da * 3); cor.warmFill.intensity = 1.6 * clamp(da * 3);
    man.root.visible = t > 3.0;
    man.root.position.set(key(t, [[3.6, 1.75], [4.6, 1.22]]), 0, 0.02); man.root.rotation.y = -Math.PI / 2;
    // yurume (hafif)
    const walk = ss(3.6, 4.6, t) * (1 - ss(4.5, 4.7, t));
    const ph = (t - 3.6) * 9;
    R(man.J.hipL, -0.35 * Math.sin(ph) * walk); R(man.J.hipR, 0.35 * Math.sin(ph) * walk);
    R(man.J.kneeL, 0.4 * Math.max(0, Math.sin(ph)) * walk); R(man.J.kneeR, 0.4 * Math.max(0, -Math.sin(ph)) * walk);
    // sol-sag bakis
    const yaw = key(t, [[4.55, 0], [4.85, 0.75], [5.1, 0.75], [5.35, -0.7], [5.6, -0.7]]);
    man.J.neck.rotation.y = yaw * 0.6; man.J.head.rotation.y = yaw * 0.4; man.J.spine.rotation.y = yaw * 0.15;
    R(man.J.elR, -0.3); R(man.J.shR, -0.25, 0, -0.1);
    R(man.J.shL, -0.1, 0, 0.12);
    faceUpdate(t, false, 0.3);
    if (t < 3.0) {
      shotName = 'A';
      const k = ss(0.55, 3.0, t);
      setCam([lerp(-0.55, -0.4, k), lerp(1.58, 1.32, k), lerp(3.7, 2.35, k)], [lerp(0.7, 0.72, k), lerp(0.75, 0.38, k), lerp(0.0, 0.05, k)], 56, 0.008, t);
      exposure = t < 0.55 ? 0 : 1.1;
      dust.position.set(0.0, 0, 1.0);
    } else {
      shotName = 'B';
      const k = ss(3.0, 5.6, t);
      setCam([-0.72, lerp(1.35, 1.3, k), lerp(1.55, 1.25, k)], [0.95, lerp(1.05, 1.1, k), lerp(0.0, -0.05, k)], 54, 0.006, t);
      exposure = 1.05;
      dust.position.set(0.0, 0, 0.5);
    }
  } else if (t < 8.0) {
    // ------------------------------------------- SAHNE 2: alt aci, paket on planda, yuze yaklasma
    shotName = 'C';
    setVisible(true);
    const f = fluoAt(t); cor.fluo.intensity = 26 * f; cor.tubeM.emissiveIntensity = 6 * f;
    scene.fog.color.set(0x0d1118); scene.fog.density = 0.06;
    cor.door.rotation.y = -1.05; cor.warm.intensity = 9; cor.warmFill.intensity = 1.6;
    man.root.position.set(1.2, 0, 0.02); man.root.rotation.y = -Math.PI / 2 - 0.15;
    man.J.spine.rotation.x = 0.12; man.J.neck.rotation.x = 0.35; man.J.head.rotation.x = 0.25;
    man.gaze(0, 0.25);
    R(man.J.shR, -0.15, 0, -0.1); R(man.J.elR, -0.35);
    faceUpdate(t, true, 0.6);
    const k = ss(5.6, 8.0, t);
    setCam([lerp(0.2, 0.36, k), lerp(0.2, 0.32, k), lerp(0.62, 0.42, k)], [lerp(1.0, 1.08, k), lerp(1.05, 1.5, k), lerp(-0.05, -0.02, k)], lerp(60, 48, k), 0.004, t);
    exposure = 1.1;
  } else {
    // ------------------------------------------- DAIRE ICI
    setVisible(false);
    scene.fog.color.set(0x07090d); scene.fog.density = 0.045;
    man.root.position.set(0, 0, -0.36); man.root.rotation.y = 0;
    seated();
    flat.bdPivot.rotation.y = 0.6;
    flat.lampL.intensity = 7; flat.moon.intensity = 34;
    const fear = ss(12.0, 16, t) * 0.5 + 0.4;
    if (t < 11.0) {
      // SAHNE 3a: paketi masaya koyar, kapagi acar
      shotName = 'D';
      const pk = flat.pkg;
      const dy = key(t, [[8.0, 0.16], [8.34, 0.0]]);
      pk.group.position.set(0, 0.76 + dy, key(t, [[8.0, 0.08], [8.34, 0.18]]));
      const lidY = key(t, [[9.25, 0.13], [9.75, 0.29], [10.05, 0.03]]);
      const lidX = key(t, [[9.45, 0], [10.05, -0.33]]);
      pk.lid.position.set(lidX, lidY, key(t, [[9.45, 0], [10.05, 0.05]]));
      pk.lid.rotation.z = key(t, [[9.3, 0], [9.75, 0.5], [10.05, 0.0]]);
      man.J.spine.rotation.x = 0.28; man.J.neck.rotation.x = 0.25; man.J.head.rotation.x = 0.2;
      man.gaze(0, 0.2);
      faceUpdate(t, false, fear);
      const P = pk.group.position;
      const lidW = new THREE.Vector3(P.x + pk.lid.position.x, P.y + pk.lid.position.y, P.z + pk.lid.position.z);
      const tl = t < 9.2 ? new THREE.Vector3(P.x + 0.15, P.y + 0.1, P.z) : lidW.clone().add(new THREE.Vector3(0.14, 0.02, 0));
      const tr = t < 9.2 ? new THREE.Vector3(P.x - 0.15, P.y + 0.1, P.z) : (t < 10.1 ? lidW.clone().add(new THREE.Vector3(-0.14, 0.02, 0)) : new THREE.Vector3(-0.12, 0.8, 0.05));
      if (t > 10.1) tl.set(0.14, 0.8, 0.02);
      armIK(man, 'L', tl, new THREE.Vector3(0.6, 0.7, -0.5));
      armIK(man, 'R', tr, new THREE.Vector3(-0.6, 0.7, -0.5));
      const k = ss(8.0, 11.0, t);
      setCam([lerp(0.95, 0.72, k), lerp(1.42, 1.3, k), lerp(1.55, 1.2, k)], [lerp(0.0, 0.0, k), lerp(0.9, 0.86, k), lerp(0.05, 0.12, k)], 52, 0.004, t);
      exposure = key(t, [[8.0, 1.25], [11, 1.3]]);
    } else if (t < 12.2) {
      // SAHNE 3b: ustten - kutunun icinde fotograf
      shotName = 'E';
      const pk = flat.pkg; pk.lid.position.set(-0.33, 0.03, 0.05);
      man.J.spine.rotation.x = 0.3; man.J.neck.rotation.x = 0.3; man.J.head.rotation.x = 0.3;
      faceUpdate(t, false, fear);
      photo.group.visible = true;
      const lift = key(t, [[11.45, 0], [12.2, 0.2]]);
      const P = pk.group.position;
      photo.group.position.set(P.x + 0.01, P.y + 0.012 + lift, P.z + 0.0 - lift * 0.4);
      photo.group.rotation.set(-Math.PI / 2 + lift * 3.2, 0, 0.1 + lift);
      armIK(man, 'R', new THREE.Vector3(photo.group.position.x - 0.03, photo.group.position.y + 0.04 + (t < 11.4 ? 0.12 : 0), photo.group.position.z + 0.06 - (t < 11.4 ? 0.1 : 0)), new THREE.Vector3(-0.6, 0.7, -0.5));
      armIK(man, 'L', new THREE.Vector3(0.2, 0.8, 0.05), new THREE.Vector3(0.6, 0.7, -0.5));
      const k = ss(11.0, 12.2, t);
      setCam([lerp(0.07, 0.05, k), lerp(1.32, 1.22, k), lerp(0.42, 0.36, k)], [0.0, 0.76, lerp(0.17, 0.15, k)], 50, 0.003, t);
      exposure = 1.35;
    } else if (t < 13.0 || (t >= 15.0 && t < 17.4)) {
      // SAHNE 3c / 4a: fotograf yakin plan (on yuz, sonra arka yuz)
      shotName = t < 13 ? 'F1' : 'G';
      man.root.visible = true;
      photo.group.visible = true; insertHands.group.visible = true;
      const flip = t < 13 ? 0 : key(t, [[15.3, 0], [15.78, Math.PI]]);
      const base = new THREE.Vector3(0.0, 1.02, 0.02);
      photo.group.position.copy(base);
      photo.group.rotation.set(-0.25, flip, 0.04);
      // eller fotografi kenarlarindan tutar
      const [hl, hr] = insertHands.hands;
      const ca = Math.cos(flip), sa = Math.sin(flip);
      hl.position.set(base.x + 0.056 * ca, base.y - 0.125, base.z - 0.05 * sa - 0.01); hl.rotation.set(-0.25, flip * 0.3, -0.2);
      hr.position.set(base.x - 0.056 * ca, base.y - 0.13, base.z + 0.05 * sa - 0.01); hr.rotation.set(-0.25, flip * 0.3, 0.2);
      man.J.spine.rotation.x = 0.1; man.J.neck.rotation.x = 0.3; man.J.head.rotation.x = 0.25;
      R(man.J.shL, -1.0, 0, 0.2); R(man.J.shR, -1.0, 0, -0.2); R(man.J.elL, -1.0); R(man.J.elR, -1.0);
      faceUpdate(t, false, fear);
      const k = t < 13 ? ss(12.2, 13.0, t) : ss(15.0, 17.4, t);
      const dist = t < 13 ? lerp(0.27, 0.22, k) : lerp(0.3, 0.2, k);
      setCam([0.0, 1.02 + 0.07 + dist * 0.25, 0.02 + dist], [0.0, 1.0, 0.02], 46, 0.0025, t);
      exposure = 1.1;
      if (t < 12.35) flash = (1 - (t - 12.2) / 0.15) * 0.35;
    } else if (t < 15.0) {
      // SAHNE 3d: yuz yakin plan - "Bu fotograf... benim evim."
      shotName = 'F2';
      photo.group.visible = true;
      photo.group.position.set(0.0, 1.0, 0.0); photo.group.rotation.set(-0.3, Math.PI, 0.05);
      photo.group.rotation.y = 0;
      armIK(man, 'L', new THREE.Vector3(0.06, 0.97, 0.0), new THREE.Vector3(0.6, 0.6, -0.6));
      armIK(man, 'R', new THREE.Vector3(-0.06, 0.96, 0.0), new THREE.Vector3(-0.6, 0.6, -0.6));
      man.J.neck.rotation.x = key(t, [[13.0, 0.3], [13.6, 0.05]]); man.J.head.rotation.x = key(t, [[13.0, 0.2], [13.6, -0.05]]);
      man.gaze(0, key(t, [[13.0, 0.25], [13.7, 0.05]]));
      faceUpdate(t, true, fear);
      const k = ss(13.0, 15.0, t);
      setCam([lerp(0.16, 0.1, k), lerp(1.2, 1.22, k), lerp(0.42, 0.22, k)], [0.0, lerp(1.2, 1.24, k), -0.35], lerp(48, 40, k), 0.003, t);
      exposure = 1.15;
    } else if (t < 20.25) {
      // SAHNE 4b: adam arkasina doner, yatak odasi kapisi kendi kendine kapanir
      shotName = 'H';
      const turn = key(t, [[17.6, 0], [18.7, 1]]);
      man.J.spine.rotation.y = 0.75 * turn; man.J.neck.rotation.y = 0.65 * turn; man.J.head.rotation.y = 0.45 * turn;
      man.J.spine.rotation.x = 0.05;
      man.gaze(0.3 * turn, 0);
      photo.group.visible = true;
      R(man.J.shL, -0.6, 0, 0.1); R(man.J.elL, -1.2); R(man.J.shR, -0.3, 0, -0.1); R(man.J.elR, -0.9);
      man.root.updateMatrixWorld(true);
      const wp = new THREE.Vector3(); man.J.wrL.getWorldPosition(wp);
      photo.group.position.copy(wp).add(new THREE.Vector3(-0.02, -0.06, 0.03)); photo.group.rotation.set(-0.6, 0.0, 0.3);
      faceUpdate(t, false, 0.9);
      flat.bdPivot.rotation.y = key(t, [[18.5, 0.6], [19.6, 0.25], [20.12, 0.0]]);
      flat.gapGlowM.opacity = 0.2;
      const k = ss(17.4, 20.25, t);
      setCam([lerp(-0.62, -0.52, k), lerp(1.42, 1.36, k), lerp(2.15, 1.75, k)], [lerp(0.18, 0.12, k), lerp(1.0, 0.98, k), -4.0], lerp(50, 44, k), 0.004, t);
      exposure = 1.45;
    } else if (t < 22.0) {
      // SAHNE 4c: karanlik koridor (bakis acisi) - fisilti
      shotName = 'I';
      man.root.visible = false;
      flat.bdPivot.rotation.y = 0.0;
      // kapinin arkasinda bir sey geciyor: isik bir an kesilir
      const pass = 1 - 0.85 * ss(20.85, 21.0, t) * (1 - ss(21.25, 21.45, t));
      flat.gapGlowM.opacity = 0.24 * pass; flat.gapLine.visible = pass > 0.3;
      const k = ss(20.25, 22.0, t);
      setCam([lerp(0.12, 0.08, k), lerp(1.28, 1.22, k), lerp(-0.6, -1.5, k)], [0.0, lerp(0.95, 0.75, k), -6.2], 50, 0.005, t, 0.01);
      exposure = 1.6;
      dust.position.set(0, 0, -3);
    } else if (t < 28.0) {
      // SAHNE 5: telefon elde, kameraya bakar
      shotName = 'J';
      resetPose();
      man.root.position.set(0.08, 0, -1.55); man.root.rotation.y = 0.05;
      const ph = phone.group; scene.add(ph);
      ph.position.set(-0.03, 1.24, -1.3); ph.lookAt(0.06, 1.62, -1.25);
      armIK(man, 'R', new THREE.Vector3(-0.04, 1.15, -1.33), new THREE.Vector3(-0.8, 0.6, -1.9));
      R(man.J.shL, 0.05, 0, 0.1); R(man.J.elL, -0.2);
      man.J.neck.rotation.x = -0.05; man.J.head.rotation.x = -0.04;
      man.gaze(-0.02, -0.02);
      faceUpdate(t, true, 1.0);
      flat.bdPivot.rotation.y = 0.0; flat.gapGlowM.opacity = 0.18;
      flat.lampL.intensity = 4.5; keyJ.intensity = 1.6;
      const k = ss(22.0, 28.0, t);
      setCam([lerp(0.16, 0.1, k), lerp(1.58, 1.57, k), lerp(-0.25, -0.62, k)], [0.06, 1.47, -1.55], 48, 0.005, t);
      exposure = 1.5;
      dust.position.set(0, 0, -1.0);
    } else {
      // FINAL: golge kapinin altindan ayaklarina dogru uzanir (hareket ortasinda kesilir)
      shotName = 'K';
      resetPose();
      man.root.position.set(0.08, 0, -1.55); man.root.rotation.y = 0.05;
      R(man.J.shR, -0.5); R(man.J.elR, -1.2);
      flat.bdPivot.rotation.y = 0.0; flat.gapGlowM.opacity = 0.45;
      flat.lampL.intensity = 4.5;
      faceUpdate(t, false, 1.0);
      const p = 0.08 + ss(28.0, 30.2, t) * 1.05;
      flat.shadowM.uniforms.prog.value = p;
      flat.gapLine.visible = t < 28.15;
      flat.gapGlowM.opacity = 0.8;
      const k = ss(28.0, 30.0, t);
      setCam([lerp(0.32, 0.3, k), lerp(0.28, 0.26, k), lerp(-0.55, -0.66, k)], [-0.2, lerp(0.05, 0.02, k), -5.5], 64, 0.003, t, -0.03);
      flat.hallL.intensity = 25; keyJ.intensity = 1.2;
      exposure = 2.0;
      if (t < 28.12) flash = 0.15 * (1 - (t - 28.0) / 0.12);
    }
  }
  // toz parcaciklari surukleniyor
  dust.rotation.y = t * 0.02; dust.position.y = Math.sin(t * 0.3) * 0.05;
  return { exposure, fade, vig, flash };
}

// ======================================================= EKRAN YAZILARI
function drawOverlay(t) {
  const x = overlayCtx; x.clearRect(0, 0, W, H);
  const txt = (s, px, py, font, col, al = 1, spacing = 0, blur = 18) => {
    x.save(); x.globalAlpha = al; x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle';
    if ('letterSpacing' in x) x.letterSpacing = spacing + 'px';
    x.shadowColor = 'rgba(0,0,0,0.95)'; x.shadowBlur = blur; x.fillStyle = col; x.fillText(s, px, py);
    x.shadowBlur = 0; x.fillText(s, px, py); x.restore();
  };
  // SAHNE 1 - kanca yazisi (daktilo gibi beliren)
  if (t > 0.75 && t < 3.05) {
    const a = ss(0.75, 0.95, t) * (1 - ss(2.85, 3.05, t));
    const fl = (t > 1.95 && t < 2.02) ? 0.35 : 1;
    const l1 = 'SAAT 02.04.', l2 = 'KAPININ ÖNÜNDE', l3 = 'BİR PAKET VARDI…';
    const n1 = Math.floor(clamp((t - 0.8) / 0.45) * l1.length);
    const n2 = Math.floor(clamp((t - 1.35) / 0.55) * l2.length);
    const n3 = Math.floor(clamp((t - 1.95) / 0.6) * l3.length);
    txt(l1.slice(0, n1), W / 2, H * 0.30, '600 74px Oswald', '#efe8dc', a * fl, 6);
    txt(l2.slice(0, n2), W / 2, H * 0.30 + 82, '400 46px Oswald', '#d9d2c5', a * fl, 5);
    txt(l3.slice(0, n3), W / 2, H * 0.30 + 136, '400 46px Oswald', '#d9d2c5', a * fl, 5);
    // ince kirmizi cizgi
    x.save(); x.globalAlpha = a * 0.9; x.fillStyle = '#a3141b'; const lw = 220 * ss(0.85, 1.4, t); x.fillRect(W / 2 - lw / 2, H * 0.30 - 58, lw, 3); x.restore();
  }
  // seri etiketi
  if (t > 0.6 && t < 3.0) {
    const a = ss(0.6, 1.0, t) * (1 - ss(2.6, 3.0, t)) * 0.8;
    txt('KAPI 204  ·  BÖLÜM 1', W / 2, H * 0.085, '400 24px Oswald', '#c9c2b6', a, 8, 8);
  }
  // altyazilar
  const subs = [
    [5.72, 7.95, 'Ben hiçbir şey sipariş etmedim…', 0],
    [13.05, 14.98, 'Bu fotoğraf… benim evim.', 0],
    [20.3, 21.95, 'Paketi açmamalıydın…', 1],
    [22.35, 23.85, 'Polisi mi aramalıyım…', 0],
    [23.9, 25.85, '…yoksa o kapıyı mı açmalıyım?', 0],
    [26.3, 27.7, 'Kararı siz verin…', 0],
  ];
  for (const [a, b, s, wsp] of subs) {
    if (t < a - 0.05 || t > b + 0.1) continue;
    const al = ss(a - 0.05, a + 0.12, t) * (1 - ss(b - 0.05, b + 0.1, t));
    const yy = (t > 22 && t < 28) ? H * 0.505 : H * 0.70;
    if (wsp) {
      const j = Math.sin(t * 40) * 1.2;
      txt(s, W / 2 + j, H * 0.62, 'italic 600 44px Cormorant', 'rgba(205,200,215,0.85)', al * (0.75 + 0.25 * Math.sin(t * 9)), 2, 22);
    } else txt(s, W / 2, yy, 'italic 600 46px Cormorant', '#f3efe6', al, 0.5, 16);
  }
  // SAHNE 5 - secim kutulari
  if (t > 24.95 && t < 28.25) {
    const outA = 1 - ss(28.0, 28.2, t);
    const opts = [['A', 'POLİSİ ARA', 25.0, '#b3141c'], ['B', 'YATAK ODASININ KAPISINI AÇ', 25.35, '#2f5aa8']];
    opts.forEach(([L, s, t0, col], i) => {
      const a = ss(t0, t0 + 0.3, t) * outA; if (a <= 0) return;
      const bw = W * 0.84, bh = 96, bx = (W - bw) / 2 + (1 - ss(t0, t0 + 0.35, t)) * (i ? 40 : -40), by = H * 0.585 + i * 118;
      const pulse = 1 + 0.015 * Math.sin((t - t0) * 6);
      x.save(); x.globalAlpha = a;
      x.translate(bx + bw / 2, by + bh / 2); x.scale(pulse, pulse); x.translate(-bw / 2, -bh / 2);
      x.shadowColor = 'rgba(0,0,0,0.7)'; x.shadowBlur = 24;
      x.fillStyle = 'rgba(10,12,16,0.72)'; roundRect(x, 0, 0, bw, bh, 18); x.fill();
      x.shadowBlur = 0; x.lineWidth = 2; x.strokeStyle = 'rgba(235,228,215,0.55)'; roundRect(x, 0, 0, bw, bh, 18); x.stroke();
      x.fillStyle = col; roundRect(x, 12, 12, 72, 72, 12); x.fill();
      x.font = '600 50px Oswald'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#fff'; x.fillText(L, 48, 50);
      x.font = (s.length > 14 ? '600 33px' : '600 40px') + ' Oswald'; x.textAlign = 'left'; x.fillStyle = '#f1ece2';
      if ('letterSpacing' in x) x.letterSpacing = '2px';
      x.fillText(s, 104, 50);
      x.restore();
    });
  }
  // FINAL yazisi
  if (t > 28.1) {
    const a = ss(28.1, 28.45, t);
    txt('BİR SONRAKİ BÖLÜMÜ', W / 2, H * 0.12, '400 44px Oswald', '#e9e3d8', a, 5);
    txt('SİZ BELİRLİYORSUNUZ.', W / 2, H * 0.12 + 56, '400 44px Oswald', '#e9e3d8', a, 5);
    const b = ss(28.45, 28.75, t);
    txt('A MI, B Mİ?', W / 2, H * 0.12 + 140, '600 84px Oswald', '#f4efe6', b, 6, 26);
    x.save(); x.globalAlpha = b; x.fillStyle = '#a3141b'; x.fillRect(W / 2 - 110, H * 0.12 + 196, 220, 3); x.restore();
  }
  overlayTex.needsUpdate = true;
}
function roundRect(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }

// ======================================================= RENDER
function renderAt(frame) {
  const t = frame / FPS;
  const p = update(t);
  drawOverlay(t);
  scene.updateMatrixWorld(true);
  renderer.setRenderTarget(sceneRT); renderer.render(scene, camera);
  // bloom
  blurMat.uniforms.tex.value = sceneRT.texture; blurMat.uniforms.dir.value.set(1.5 / (W / 4), 0); blurMat.uniforms.thr.value = 1.6;
  quad.material = blurMat; renderer.setRenderTarget(bloomA); renderer.render(quadScene, quadCam);
  blurMat.uniforms.tex.value = bloomA.texture; blurMat.uniforms.dir.value.set(0, 1.5 / (H / 4)); blurMat.uniforms.thr.value = 0;
  renderer.setRenderTarget(bloomB); renderer.render(quadScene, quadCam);
  quad.material = postMat;
  Object.assign(postMat.uniforms.time, { value: t });
  postMat.uniforms.exposure.value = p.exposure; postMat.uniforms.fade.value = p.fade; postMat.uniforms.vig.value = p.vig; postMat.uniforms.flash.value = p.flash;
  renderer.setRenderTarget(null); renderer.render(quadScene, quadCam);
}
window.renderAt = renderAt;
window.grab = async () => {
  const gl = renderer.getContext();
  const px = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const blob = new Blob([px]);
  return await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.readAsDataURL(blob); });
};
window.shot = () => shotName;
init().catch((e) => { window.ERR = String(e && e.stack || e); });
