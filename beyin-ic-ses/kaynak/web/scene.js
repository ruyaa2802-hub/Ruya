// BEYNIN NEDEN KENDI KENDINE KONUSUR? — 30 sn, 9:16. Zamanlama, kamera, karakterler, balonlar, altyazi, post-process.
import * as THREE from 'three';
import { makeMan, armIK } from './man.js';
import { buildBrain } from './brain.js';
import { buildRoom } from './room.js';
import { buildEye } from './eye.js';

const W = 720, H = 1280, FPS = 24;
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NoToneMapping;

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const ease = (t) => t * t * (3 - 2 * t);
const V3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
function key(t, ks) {
  if (t <= ks[0][0]) return ks[0][1];
  for (let i = 0; i < ks.length - 1; i++) { const [t0, v0] = ks[i], [t1, v1] = ks[i + 1]; if (t <= t1) { const k = ease((t - t0) / (t1 - t0)); return Array.isArray(v0) ? v0.map((v, j) => lerp(v, v1[j], k)) : lerp(v0, v1, k); } }
  return ks[ks.length - 1][1];
}
function shake(t, a) { return [a * (Math.sin(t * 1.7) * 0.6 + Math.sin(t * 3.3 + 1) * 0.4), a * (Math.sin(t * 1.3 + 4) * 0.6 + Math.sin(t * 2.7) * 0.4), 0]; }

async function loadFonts() {
  const L = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
  const LE = 'U+0100-02AF,U+0304,U+0308,U+0329,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';
  const defs = [['Oswald', 'oswald-latin-600-normal', '600', L], ['Oswald', 'oswald-latin-ext-600-normal', '600', LE],
    ['Nunito', 'nunito-latin-800-normal', '800', L], ['Nunito', 'nunito-latin-ext-800-normal', '800', LE],
    ['Nunito', 'nunito-latin-900-normal', '900', L], ['Nunito', 'nunito-latin-ext-900-normal', '900', LE]];
  for (const [fam, file, w, ur] of defs) { const f = new FontFace(fam, `url(./fonts/${file}.woff2)`, { weight: w, unicodeRange: ur }); await f.load(); document.fonts.add(f); }
  for (const s of ['600 20px Oswald', '800 20px Nunito', '900 20px Nunito']) await document.fonts.load(s, 'ĞÜŞİÖÇğüşıöç…?');
}

let env, scene, camera, brain, room, eye, human, mini, quadScene, quadCam, quad, postMat, blurMat, sceneRT, bA, bB, ovC, ovX, ovT, miniRT, miniCam, miniBuf, miniCanvas, TM;
const SHOT = { name: '' };

async function init() {
  await loadFonts();
  env = await (await fetch('./env.json')).json();
  TM = env.timing;   // anlatim parcalarinin mutlak zamanlari
  scene = new THREE.Scene(); scene.background = new THREE.Color(0x000000);
  camera = new THREE.PerspectiveCamera(50, W / H, 0.01, 200);
  brain = buildBrain(); room = buildRoom(); eye = buildEye(renderer);
  scene.add(brain.G, room.G, eye.G);
  human = makeMan(); room.G.add(human.root);
  mini = makeMan(); brain.G.add(mini.root);
  // sahne 3 dalgalari: "kelimelere donusturen" ve "zihninde konusabiliyorsun" ile senkron
  const cl = brain.neurons.slice(1).filter((n) => n.p.z < -4 && n.p.z > -16).sort((a, b) => a.p.distanceTo(new THREE.Vector3(2, 2, -9)) - b.p.distanceTo(new THREE.Vector3(2, 2, -9)));
  brain.addWave(TM.a1[0] + 1.6, cl[0].p, 8);
  brain.addWave(TM.a2[0] + 0.3, cl[3] ? cl[3].p : cl[0].p, 9);
  brain.addWave(TM.a2[0] + 1.6, new THREE.Vector3(0, 0, 0), 11);
  // post
  sceneRT = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
  bA = new THREE.WebGLRenderTarget(W / 4, H / 4, { type: THREE.HalfFloatType }); bB = new THREE.WebGLRenderTarget(W / 4, H / 4, { type: THREE.HalfFloatType });
  ovC = document.createElement('canvas'); ovC.width = W; ovC.height = H; ovX = ovC.getContext('2d');
  ovT = new THREE.CanvasTexture(ovC); ovT.colorSpace = THREE.NoColorSpace;
  quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const vs = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`;
  blurMat = new THREE.ShaderMaterial({ uniforms: { tex: { value: null }, dir: { value: new THREE.Vector2() }, thr: { value: 0 } }, vertexShader: vs,
    fragmentShader: `varying vec2 vUv; uniform sampler2D tex; uniform vec2 dir; uniform float thr;
      void main(){ vec3 c=vec3(0.); float w[5]; w[0]=.227;w[1]=.194;w[2]=.121;w[3]=.054;w[4]=.016;
        for(int i=-4;i<=4;i++){ vec3 s=texture2D(tex,vUv+dir*float(i)).rgb; if(thr>0.){ s=max(s-thr,0.);} c+=s*w[i<0?-i:i]; } gl_FragColor=vec4(c,1.); }` });
  postMat = new THREE.ShaderMaterial({
    uniforms: { tex: { value: sceneRT.texture }, bloom: { value: bB.texture }, ov: { value: ovT }, time: { value: 0 }, exposure: { value: 1 }, bloomK: { value: 0.8 }, zb: { value: 0 }, flash: { value: 0 }, fade: { value: 1 }, tint: { value: new THREE.Vector3(0, 0, 0) } },
    vertexShader: vs,
    fragmentShader: `varying vec2 vUv; uniform sampler2D tex, bloom, ov; uniform float time, exposure, bloomK, zb, flash, fade; uniform vec3 tint;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
      vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.,1.); }
      void main(){
        vec2 c0 = vec2(0.5);
        vec3 c = vec3(0.); vec3 b = vec3(0.);
        // radyal hiz bulanikligi (goz bebegi gecisi)
        for (int i = 0; i < 12; i++) { float k = 1.0 - zb * float(i) / 12.0 * 0.35; vec2 uv = c0 + (vUv - c0) * k;
          c += texture2D(tex, uv).rgb; b += texture2D(bloom, uv).rgb; }
        c /= 12.0; b /= 12.0;
        vec2 d = vUv - 0.5;
        c += b * bloomK;
        c *= exposure;
        c = aces(c);
        float l = dot(c, vec3(0.299,0.587,0.114));
        c += tint * (1.0 - smoothstep(0.0, 0.6, l));
        c = pow(c, vec3(1.0/2.2));
        c = c*c*(3.0-2.0*c)*0.3 + c*0.7;
        float v = 1.0 - smoothstep(0.35, 1.0, length(d*vec2(1.0, 0.72)));
        c *= mix(1.0, v, 0.7);
        c += (h(vUv*vec2(720.,1280.) + fract(time*13.7)*77.0) - 0.5) * 0.012;
        c = mix(c, vec3(0.85, 0.95, 1.0), flash);
        c *= fade;
        vec4 o = texture2D(ov, vUv);
        c = c*(1.0-o.a) + o.rgb;
        gl_FragColor = vec4(c, 1.0);
      }` });
  quadScene = new THREE.Scene(); quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat); quadScene.add(quad);
  miniRT = new THREE.WebGLRenderTarget(300, 300, { type: THREE.UnsignedByteType, samples: 4 });
  miniCam = new THREE.PerspectiveCamera(30, 1, 0.01, 100); miniBuf = new Uint8Array(300 * 300 * 4);
  miniCanvas = document.createElement('canvas'); miniCanvas.width = miniCanvas.height = 300;
  window.READY = true;
}

// ---------------------------------------------------------------- pozlar
function reset(m) { for (const k of Object.keys(m.J)) { m.J[k].rotation.set(0, 0, 0); m.J[k].quaternion.identity(); } m.J.hips.position.set(0, 0.95, 0); m.J.shL.rotation.set(0, 0, 0.08); m.J.shR.rotation.set(0, 0, -0.08); m.J.elL.rotation.set(-0.15, 0, 0); m.J.elR.rotation.set(-0.15, 0, 0); }
function seat(m, hipY = 0.52) { m.J.hips.position.set(0, hipY, 0); m.J.hipL.rotation.set(-1.5, 0, 0.08); m.J.hipR.rotation.set(-1.5, 0, -0.08); m.J.kneeL.rotation.set(1.45, 0, 0); m.J.kneeR.rotation.set(1.45, 0, 0); }
function blink(t, off = 0) { const bl = [0.9, 3.3, 5.8, 8.6, 11.9, 15.1, 18.4, 21.3, 24.6, 27.0, 29.3].map((x) => x + off); let k = 1; for (const b of bl) { const d = Math.abs(t - b); if (d < 0.08) k = Math.min(k, d / 0.08); } return k; }
function chatter(t, t0, t1) { if (t < t0 || t > t1) return 0.03; const x = t - t0; return 0.15 + 0.6 * Math.abs(Math.sin(x * 11.0) * Math.sin(x * 4.3 + 1)); }

// ---------------------------------------------------------------- yerlesim
const P = { x: 0 };
function setCam(pos, look, fov = 50, sh = 0, t = 0) {
  const s = shake(t, sh); camera.position.set(pos.x + s[0], pos.y + s[1], pos.z); camera.lookAt(look.x + s[0] * 0.4, look.y + s[1] * 0.4, look.z); camera.fov = fov; camera.updateProjectionMatrix();
}
function show(which) { brain.G.visible = which === 'brain'; room.G.visible = which === 'room'; eye.G.visible = which === 'eye'; scene.environment = null; scene.fog = which === 'brain' ? BFOG : null; }
const BFOG = new THREE.FogExp2(0x1c0a26, 0.03);
// minyatur karakteri aydinlatan isiklar: kameradan anahtar isik, arkadan camgobegi kontur
function lightMini(cam) { const hd = headW(mini); const toCam = cam.clone().sub(hd).normalize(); brain.keyL.position.copy(hd).add(toCam.multiplyScalar(1.4)).add(new THREE.Vector3(0.5, 0.6, 0)); brain.rimL.position.copy(hd).add(toCam.clone().multiplyScalar(-1.2)).add(new THREE.Vector3(-0.3, 0.4, 0)); }
const BUB = []; // ekran balonlari {kind, text|icon, x,y, a, s}

function posHuman(t) {
  reset(human); human.root.position.set(0, 0, -0.42); human.root.rotation.y = -0.18; seat(human);
  human.J.spine.rotation.x = -0.08; human.J.neck.rotation.x = 0.05; human.J.head.rotation.set(-0.03 + 0.02 * Math.sin(t * 0.7), 0.12, 0.04);
  human.root.updateMatrixWorld(true);
  const toW = (v) => human.root.localToWorld(new THREE.Vector3(v[0], v[1], v[2]));
  armIK(human, 'L', toW([0.17, 0.6, 0.25]), toW([0.6, 0.6, -0.2]));
  armIK(human, 'R', toW([-0.17, 0.6, 0.25]), toW([-0.6, 0.6, -0.2]));
  human.gaze(-0.05, -0.05);
  human.setLids(blink(t)); human.setJaw(0.02, 0); human.browsWorried(0.15);
  human.root.updateMatrixWorld(true);
}
function headW(m) { const v = new THREE.Vector3(); m.J.head.getWorldPosition(v); v.y += 0.1; return v; }
function eyeW(m) { const v = new THREE.Vector3(); m.eyes[0].getWorldPosition(v); return v; }

function posMiniSit(t, talk0, talk1, lookCam = 0, smile = 0) {
  reset(mini); mini.root.position.set(0, 0.37, 0.32); mini.root.rotation.y = 0; seat(mini, 0.52);
  mini.J.spine.rotation.x = 0.12; mini.J.head.rotation.set(0.05, -0.25 * (1 - lookCam), 0); mini.J.neck.rotation.y = 0.15 * Math.sin(t * 1.3) * (1 - lookCam);
  // konusurken el hareketi
  const g = t > talk0 && t < talk1 ? Math.sin((t - talk0) * 3.1) : 0;
  mini.J.shR.rotation.set(-0.6 - 0.25 * g, 0, -0.25); mini.J.elR.rotation.set(-1.2 - 0.3 * g, 0, 0);
  mini.J.shL.rotation.set(-0.35, 0, 0.2); mini.J.elL.rotation.set(-1.0, 0, 0);
  mini.gaze(0, -0.05 * (1 - lookCam));
  mini.setLids(blink(t, 0.4) * (1.08 - 0.06 * smile)); mini.setJaw(chatter(t, talk0, talk1), smile); mini.browsWorried(0.25 * (1 - smile));
  mini.root.updateMatrixWorld(true);
}

// kopru uzerinde yurume
function posMiniWalk(t, s, walking, talkT) {
  reset(mini);
  const c = brain.bridgeCurve; const p = c.getPointAt(s), tg = c.getTangentAt(s);
  const up = new THREE.Vector3(0, 1, 0);
  const ph = s * c.getLength() / 0.7 * Math.PI;
  const w = walking;
  mini.root.position.copy(p).add(up.clone().multiplyScalar(brain.BR * 0.98 + 0.02 * Math.abs(Math.sin(ph)) * w));
  mini.root.rotation.y = Math.atan2(tg.x, tg.z);
  mini.J.hipL.rotation.set(-0.45 * Math.sin(ph) * w, 0, 0.03); mini.J.hipR.rotation.set(0.45 * Math.sin(ph) * w, 0, -0.03);
  mini.J.kneeL.rotation.set(0.55 * Math.max(0, Math.sin(ph + 0.6)) * w, 0, 0); mini.J.kneeR.rotation.set(0.55 * Math.max(0, -Math.sin(ph + 0.6)) * w, 0, 0);
  mini.J.shL.rotation.set(0.35 * Math.sin(ph) * w, 0, 0.1); mini.J.shR.rotation.set(-0.35 * Math.sin(ph) * w, 0, -0.1);
  mini.J.elL.rotation.set(-0.3, 0, 0); mini.J.elR.rotation.set(-0.3, 0, 0);
  mini.J.spine.rotation.y = 0.06 * Math.sin(ph) * w;
  mini.J.neck.rotation.y = 0.25 * Math.sin(t * 0.9); mini.J.head.rotation.x = -0.08 + 0.05 * Math.sin(t * 1.7);
  mini.setLids(blink(t, 0.4)); mini.setJaw(talkT ? chatter(t, talkT[0], talkT[1]) : 0.03, 0); mini.browsWorried(0.45);
  mini.root.updateMatrixWorld(true);
  return { p, tg };
}

function update(t) {
  BUB.length = 0;
  let exposure = 1, bloomK = 0.8, zb = 0, flash = 0, fade = 1; const tint = new THREE.Vector3(0, 0, 0);
  brain.update(t);
  const tIn = 1.08, tEye = 1.8, tBrain = 2.62, tWalk = 4.0, tSci = 10.0, tOut = 19.0, tFlashOut = 19.55, tRoom = 20.0;
  if (t < tIn) {
    SHOT.name = 'siyah'; show('room'); posHuman(t); exposure = 0; setCam(new THREE.Vector3(0, 1.2, 2), new THREE.Vector3(0, 1.2, 0));
  } else if (t < tEye) {
    // insanin yuzune hizla yaklasma
    SHOT.name = 'oda-yaklasma'; show('room'); posHuman(t);
    const e = eyeW(human); const k = Math.pow(clamp((t - tIn) / (tEye - tIn)), 2.2);
    const p0 = e.clone().add(new THREE.Vector3(0.55, 0.0, 1.9)), p1 = e.clone().add(new THREE.Vector3(0.004, 0.0, 0.07));
    setCam(p0.clone().lerp(p1, k), e, lerp(42, 30, k), 0.004 * (1 - k), t);
    exposure = 1.1 * ss(tIn, tIn + 0.2, t); zb = 0.6 * ss(tEye - 0.3, tEye, t);
    tint.set(-0.004, 0.0, 0.012);
  } else if (t < tBrain) {
    // makro goz: goz bebeginin icine dalis
    SHOT.name = 'goz'; show('eye'); scene.environment = eye.env;
    const k = clamp((t - tEye) / (tBrain - tEye)); const kz = Math.pow(k, 1.6);
    eye.pupil.scale.setScalar(lerp(0.22, 0.4, ss(0, 0.8, k)));
    setCam(new THREE.Vector3(lerp(0.06, 0.0, kz), lerp(0.03, 0.0, kz), lerp(3.6, 0.86, kz)), new THREE.Vector3(0, 0, 0.8), 38, 0, t);
    zb = lerp(0.6, 1.0, k); exposure = 1.2 * (1 - ss(0.82, 1.0, k)); bloomK = 0.5;
  } else if (t < tWalk) {
    // beyin: buyuk noronun ustunde oturan minyatur karakter, kendi kendine konusuyor
    SHOT.name = 'beyin-giris'; show('brain'); posMiniSit(t, 2.9, 4.0);
    const k = ss(tBrain, tWalk, t); const kk = 1 - Math.pow(1 - clamp((t - tBrain) / (tWalk - tBrain)), 3);
    const pos = new THREE.Vector3(lerp(0.4, 1.35, kk), lerp(3.6, 1.95, kk), lerp(16, 3.6, kk));
    setCam(pos, new THREE.Vector3(lerp(0, 0.05, k), lerp(1.2, 1.5, k), 0.3), lerp(55, 42, k), 0.01, t);
    zb = 1.0 * (1 - ss(tBrain, tBrain + 0.45, t)); flash = 0.7 * (1 - ss(tBrain, tBrain + 0.35, t)); exposure = 1.0 * ss(tBrain, tBrain + 0.12, t) + 0.0;
    tint.set(-0.006, 0.0, 0.02);
  } else if (t < tSci) {
    // sahne 2: sinir lifi koprusunde yurume, konusma balonlari
    SHOT.name = 'yurume'; show('brain');
    const s = lerp(0.06, 0.18, (t - tWalk) / (tSci - tWalk));
    const bubT = [[4.55, 6.35], [6.45, 8.25], [8.35, 10.0]];
    const talk = bubT.find(([a, b]) => t >= a && t < a + 1.2);
    const { p, tg } = posMiniWalk(t, s, ss(tWalk, tWalk + 0.4, t), talk ? [talk[0], talk[0] + 1.2] : null);
    const side = new THREE.Vector3().crossVectors(tg, new THREE.Vector3(0, 1, 0)).normalize();
    const hd = headW(mini);
    const orbit = lerp(-0.6, 0.6, (t - tWalk) / (tSci - tWalk));
    const cp = hd.clone().add(tg.clone().multiplyScalar(2.3)).add(side.clone().multiplyScalar(1.1 + orbit)).add(new THREE.Vector3(0, 0.15, 0));
    setCam(cp, hd.clone().add(new THREE.Vector3(0, -0.25, 0)).add(tg.clone().multiplyScalar(-0.6)), 46, 0.01, t);
    const texts = ['Acaba bugün ne olacak?', 'Dün neden öyle söyledim?', 'Ya yarın işler ters giderse?'];
    bubT.forEach(([a, b], i) => { if (t >= a - 0.05 && t < b) BUB.push({ kind: 'speech', text: texts[i], anchor: hd.clone().add(new THREE.Vector3(0, 0.22, 0)), a: ss(a - 0.05, a + 0.15, t) * (1 - ss(b - 0.18, b, t)), pop: ss(a - 0.05, a + 0.25, t), i }); });
    tint.set(-0.006, 0.0, 0.02);
  } else if (t < tOut) {
    // sahne 3: sinir aglarina yaklasma, isik dalgalari
    SHOT.name = 'sinir-agi'; show('brain');
    const { p, tg } = posMiniWalk(t, 0.18, 0, null);
    mini.J.neck.rotation.y = 0.5; mini.J.head.rotation.x = -0.15; mini.root.updateMatrixWorld(true);
    const hd = headW(mini);
    const target = new THREE.Vector3(2.2, 1.8, -9.5);
    const path = [[tSci, [hd.x - 0.6, hd.y + 0.35, hd.z + 1.6], [hd.x + 1.2, hd.y, hd.z - 3]],
      [tSci + 2.6, [1.4, 2.2, -4.4], [2.6, 1.7, -10]],
      [tSci + 5.4, [2.9, 2.3, -7.4], [1.5, 1.6, -12.5]],
      [tSci + 7.0, [1.0, 3.4, -4.0], [1.4, 1.0, -11]],
      [tOut, [-1.6, 6.5, 3.5], [0.6, 0.0, -9]]];
    let pos, look;
    for (let i = 0; i < path.length - 1; i++) { const [t0, p0, l0] = path[i], [t1, p1, l1] = path[i + 1]; if (t <= t1) { const k = ease((t - t0) / (t1 - t0)); pos = V3(p0).lerp(V3(p1), k); look = V3(l0).lerp(V3(l1), k); break; } }
    setCam(pos, look, 48, 0.012, t);
    bloomK = 1.0; tint.set(-0.006, 0.0, 0.022);
  } else if (t < tFlashOut) {
    // cikis: beynin disina hizla
    SHOT.name = 'cikis'; show('brain'); posMiniWalk(t, 0.18, 0, null);
    const k = Math.pow(clamp((t - tOut) / (tFlashOut - tOut)), 2);
    setCam(new THREE.Vector3(lerp(-1.6, -3, k), lerp(6.5, 12, k), lerp(3.5, 26, k)), new THREE.Vector3(0.6, 0, -9), lerp(48, 70, k), 0, t);
    zb = 0.9 * k; flash = 0.8 * ss(tFlashOut - 0.15, tFlashOut, t); bloomK = 1.1;
  } else if (t < tRoom) {
    SHOT.name = 'goz-cikis'; show('eye'); scene.environment = eye.env;
    const k = 1 - Math.pow(1 - clamp((t - tFlashOut) / (tRoom - tFlashOut)), 2.5);
    eye.pupil.scale.setScalar(lerp(0.36, 0.22, k));
    setCam(new THREE.Vector3(0.03 * k, 0.02 * k, lerp(1.2, 3.8, k)), new THREE.Vector3(0, 0, 0.8), 38, 0, t);
    flash = 0.8 * (1 - ss(tFlashOut, tFlashOut + 0.2, t)); zb = 0.9 * (1 - k); bloomK = 0.5;
  } else {
    // sahne 4: oda — insan sessizce oturuyor, dusunce balonlari
    SHOT.name = 'oda-final'; show('room'); posHuman(t);
    const e = eyeW(human); const hd = headW(human);
    const k1 = 1 - Math.pow(1 - clamp((t - tRoom) / 1.6), 3);
    const k2 = ss(tRoom + 1.6, 30, t);
    const pNear = e.clone().add(new THREE.Vector3(0.004, 0, 0.09)), pMid = hd.clone().add(new THREE.Vector3(0.45, -0.25, 2.3)), pEnd = hd.clone().add(new THREE.Vector3(0.25, -0.12, 1.55));
    const pos = k1 < 1 ? pNear.clone().lerp(pMid, k1) : pMid.clone().lerp(pEnd, k2);
    const look = e.clone().lerp(hd.clone().add(new THREE.Vector3(0, -0.12, 0)), k1);
    setCam(pos, look, lerp(30, 44, k1), 0.004, t);
    zb = 0.6 * (1 - ss(tRoom, tRoom + 0.4, t));
    tint.set(-0.004, 0.0, 0.012);
    // dusunce balonlari (anlatimla senkron)
    const anc = hd.clone().add(new THREE.Vector3(0, 0.18, 0));
    const f2 = TM.f2[0], f3 = TM.f3[0], f4 = TM.f4[0];
    const fadeAll = 1 - ss(f4 + 0.2, f4 + 0.7, t);
    const add = (t0, b) => { if (t >= t0) BUB.push(Object.assign({ kind: 'thought', anchor: anc, a: ss(t0, t0 + 0.2, t) * fadeAll, pop: ss(t0, t0 + 0.3, t), age: t - t0 }, b)); };
    add(tRoom + 1.3, { text: '…', dx: -140, dy: -150, r: 44 });
    add(tRoom + 2.3, { text: '?', dx: 150, dy: -175, r: 44 });
    add(f2 + 0.05, { text: 'Bugün…', dx: -165, dy: -300, r: 82 });
    add(f2 + 0.4, { text: 'Neden?', dx: 170, dy: -350, r: 82 });
    add(f2 + 0.8, { text: 'Yarın!', dx: -20, dy: -470, r: 82 });
    add(f3 + 0.05, { icon: 'sun', dx: 190, dy: -560, r: 70 });
    add(f3 + 0.35, { icon: 'house', dx: -180, dy: -600, r: 70 });
    add(f3 + 0.65, { icon: 'heart', dx: 20, dy: -700, r: 70 });
    // final: buyuk balonun icinde minyatur karakter kameraya bakip gulumser
    const tf = f4 + 0.45;
    if (t >= tf) BUB.push({ kind: 'mini', anchor: anc, a: ss(tf, tf + 0.35, t), pop: ss(tf, tf + 0.45, t), dx: 70, dy: -430, r: 205 });
  }
  if (brain.G.visible) lightMini(camera.position);
  return { exposure, bloomK, zb, flash, fade, tint };
}

// --------------------------------------------------------------- 2B katman
function project(v) { const p = v.clone().project(camera); return [(p.x * 0.5 + 0.5) * W, (1 - (p.y * 0.5 + 0.5)) * H, p.z]; }
function rr(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }
function cloud(x, cx, cy, r) {
  x.beginPath(); const n = 9;
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; x.moveTo(cx + Math.cos(a) * r * 0.78 + r * 0.32, cy + Math.sin(a) * r * 0.62); x.arc(cx + Math.cos(a) * r * 0.78, cy + Math.sin(a) * r * 0.62, r * 0.32, 0, Math.PI * 2); }
  x.moveTo(cx + r * 0.8, cy); x.ellipse(cx, cy, r * 0.8, r * 0.62, 0, 0, Math.PI * 2);
}
function icon(x, kind, cx, cy, s) {
  x.save(); x.translate(cx, cy); x.scale(s, s); x.lineWidth = 5; x.lineCap = 'round'; x.lineJoin = 'round';
  if (kind === 'sun') { x.fillStyle = '#ffb21e'; x.beginPath(); x.arc(0, 0, 15, 0, 6.28); x.fill(); x.strokeStyle = '#ffb21e'; for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; x.beginPath(); x.moveTo(Math.cos(a) * 22, Math.sin(a) * 22); x.lineTo(Math.cos(a) * 31, Math.sin(a) * 31); x.stroke(); } }
  if (kind === 'house') { x.fillStyle = '#e8564a'; x.beginPath(); x.moveTo(-26, -2); x.lineTo(0, -26); x.lineTo(26, -2); x.closePath(); x.fill(); x.fillStyle = '#4a7bd8'; x.fillRect(-19, -3, 38, 28); x.fillStyle = '#ffe2a8'; x.fillRect(-5, 9, 10, 16); }
  if (kind === 'heart') { x.fillStyle = '#ff4d7d'; x.beginPath(); x.moveTo(0, 22); x.bezierCurveTo(-34, -2, -18, -30, 0, -12); x.bezierCurveTo(18, -30, 34, -2, 0, 22); x.fill(); }
  x.restore();
}
function drawMiniInBubble(x, cx, cy, r, t) {
  // minyatur karakterin yakin plani (beyin sahnesinden ayri kamerayla)
  const lookCam = ss(TM.f4[0] + 1.0, TM.f4[0] + 1.6, t), smile = ss(TM.f4[0] + 1.5, TM.f4[0] + 2.1, t);
  posMiniSit(t, -1, -1, lookCam, smile);
  const hd = headW(mini);
  miniCam.position.copy(hd).add(new THREE.Vector3(-0.07, -0.02, 0.85)); miniCam.lookAt(hd.x - 0.07, hd.y - 0.05, hd.z); lightMini(miniCam.position); brain.keyL.intensity = 9; brain.keyL.color.set(0xfff4ea);
  const oldFog = scene.fog; scene.fog = BFOG;
  const vis = [brain.G.visible, room.G.visible, eye.G.visible];
  brain.G.visible = true; room.G.visible = false; eye.G.visible = false; scene.environment = null;
  renderer.setRenderTarget(miniRT); renderer.render(scene, miniCam); renderer.setRenderTarget(null);
  brain.G.visible = vis[0]; room.G.visible = vis[1]; eye.G.visible = vis[2]; scene.fog = oldFog; brain.keyL.intensity = 6;
  renderer.readRenderTargetPixels(miniRT, 0, 0, 300, 300, miniBuf);
  const mx = miniCanvas.getContext('2d'); const img = mx.createImageData(300, 300);
  for (let yy = 0; yy < 300; yy++) for (let xx = 0; xx < 300; xx++) { const s = ((299 - yy) * 300 + xx) * 4, d = (yy * 300 + xx) * 4;
    for (let k = 0; k < 3; k++) { let v = miniBuf[s + k] / 255 * 1.4; v = v / (1 + v * 0.4); img.data[d + k] = Math.min(255, Math.pow(v, 1 / 2.2) * 255); } img.data[d + 3] = 255; }
  mx.putImageData(img, 0, 0);
  x.save(); cloud(x, cx, cy, r); x.clip(); x.drawImage(miniCanvas, cx - r * 1.05, cy - r * 1.05, r * 2.1, r * 2.1); x.restore();
}
function subtitles(t) {
  const S = [];
  const split = (ch, a, b) => { const [t0, t1] = TM[ch]; const k = a.length / (a.length + b.length); return [[t0, t0 + (t1 - t0) * k + 0.05, a], [t0 + (t1 - t0) * k + 0.05, t1 + 0.15, b]]; };
  S.push([TM.h1[0], TM.h1[1] + 0.15, 'Bir dakika…'], [TM.h2[0], TM.h2[1] + 0.2, 'Şu an kiminle konuşuyorsun?']);
  S.push(...split('a1', 'Aslında bu, beyninin düşüncelerini', 'kelimelere dönüştüren iç konuşma mekanizması.'));
  S.push(...split('a2', 'Kelimeleri sesli söylemeden de', 'zihninde konuşabiliyorsun.'));
  S.push([TM.f1a[0], TM.f1b[0] + (TM.f1b[1] - TM.f1b[0]) * 0.5, 'Üstelik herkesin iç sesi'], [TM.f1b[0] + (TM.f1b[1] - TM.f1b[0]) * 0.5, TM.f1b[1] + 0.15, 'aynı şekilde çalışmaz.']);
  S.push([TM.f2[0], TM.f2[1] + 0.1, 'Bazıları kelimelerle düşünür,'], [TM.f3[0], TM.f3[1] + 0.3, 'bazıları görüntülerle…']);
  S.push(...split('f4', 'Peki senin zihnindeki ses', 'hiç susuyor mu?'));
  for (const [a, b, s] of S) if (t >= a - 0.05 && t < b) return [s, ss(a - 0.05, a + 0.08, t) * (1 - ss(b - 0.08, b, t))];
  return null;
}
function drawOverlay(t) {
  const x = ovX; x.clearRect(0, 0, W, H);
  // balonlar
  for (const b of BUB) {
    if (b.a <= 0) continue;
    const [ax, ay, az] = project(b.anchor); if (az > 1) continue;
    x.save(); x.globalAlpha = b.a;
    if (b.kind === 'speech') {
      const bob = Math.sin(t * 2 + b.i) * 4;
      x.font = '800 40px Nunito'; const tw = x.measureText(b.text).width;
      const bw = tw + 56, bh = 84, sc = 0.6 + 0.4 * b.pop + 0.06 * Math.sin(b.pop * Math.PI);
      const bx = clamp(ax - bw / 2 + 60, 24, W - bw - 24), by = ay - bh - 110 + bob;
      x.translate(ax, ay - 40); x.scale(sc, sc); x.translate(-ax, -(ay - 40));
      x.shadowColor = 'rgba(0,30,60,0.55)'; x.shadowBlur = 26;
      x.fillStyle = 'rgba(250,252,255,0.96)'; rr(x, bx, by, bw, bh, 30); x.fill();
      x.beginPath(); x.moveTo(clamp(ax, bx + 30, bx + bw - 30) - 16, by + bh - 2); x.lineTo(ax, ay - 30); x.lineTo(clamp(ax, bx + 30, bx + bw - 30) + 14, by + bh - 2); x.closePath(); x.fill();
      x.shadowBlur = 0; x.strokeStyle = 'rgba(57,214,255,0.9)'; x.lineWidth = 3; rr(x, bx, by, bw, bh, 30); x.stroke();
      x.fillStyle = '#132033'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(b.text, bx + bw / 2, by + bh / 2 + 2);
    } else {
      const fl = Math.sin((b.age || 0) * 1.6 + b.dx) * 6;
      const cx = clamp(ax + b.dx, b.r + 16, W - b.r - 16), cy = Math.max(b.r + 20, ay + b.dy * (H / 1280) + fl - (b.age || 0) * 6);
      const sc = 0.4 + 0.6 * b.pop + 0.08 * Math.sin(b.pop * Math.PI);
      x.translate(cx, cy); x.scale(sc, sc); x.translate(-cx, -cy);
      // baglanti kabarciklari
      x.fillStyle = 'rgba(250,250,255,0.92)';
      for (let i = 1; i <= 3; i++) { const k = i / 4; x.beginPath(); x.arc(lerp(ax, cx, k * 0.7), lerp(ay, cy, k * 0.7) + 10, 5 + i * 4, 0, 6.28); x.fill(); }
      x.shadowColor = 'rgba(0,0,30,0.5)'; x.shadowBlur = 24;
      cloud(x, cx, cy, b.r); x.fill(); x.shadowBlur = 0;
      if (b.kind === 'mini') { x.fillStyle = 'rgba(57,214,255,0.95)'; cloud(x, cx, cy, b.r * 0.97); x.fill(); drawMiniInBubble(x, cx, cy, b.r * 0.92, t); }
      else if (b.icon) icon(x, b.icon, cx, cy, b.r / 48);
      else { x.fillStyle = '#132033'; x.font = `900 ${Math.round(b.r * 0.42)}px Nunito`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(b.text, cx, cy + 3); }
    }
    x.restore();
  }
  // baslik (sahne 1)
  if (t > 2.85 && t < 4.25) {
    const a = ss(2.85, 3.15, t) * (1 - ss(4.0, 4.25, t)); const yy = H * 0.2 - 18 * (1 - ss(2.85, 3.3, t));
    x.save(); x.globalAlpha = a; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '600 66px Oswald';
    if ('letterSpacing' in x) x.letterSpacing = '3px';
    x.shadowColor = 'rgba(57,214,255,0.6)'; x.shadowBlur = 14; x.fillStyle = '#ffffff';
    x.fillText('ZİHNİNDEKİ SESİN', W / 2, yy); x.fillText('SAHİBİ KİM?', W / 2, yy + 78);
    x.shadowBlur = 0; x.fillText('ZİHNİNDEKİ SESİN', W / 2, yy); x.fillText('SAHİBİ KİM?', W / 2, yy + 78);
    x.restore();
  }
  // altyazi
  const sub = subtitles(t);
  if (sub && sub[1] > 0) {
    const [s, a] = sub; x.save(); x.globalAlpha = a; x.font = '800 40px Nunito'; x.textAlign = 'center'; x.textBaseline = 'middle';
    let lines = [s];
    if (x.measureText(s).width > W - 80) { const w = s.split(' '); let best = null; for (let i = 1; i < w.length; i++) { const l1 = w.slice(0, i).join(' '), l2 = w.slice(i).join(' '); const m = Math.max(x.measureText(l1).width, x.measureText(l2).width); if (!best || m < best[0]) best = [m, l1, l2]; } lines = [best[1], best[2]]; }
    lines.forEach((l, i) => { const yy = H * 0.74 + (i - (lines.length - 1) / 2) * 50; x.lineJoin = 'round'; x.lineWidth = 9; x.strokeStyle = 'rgba(0,0,0,0.85)'; x.strokeText(l, W / 2, yy); x.fillStyle = '#ffffff'; x.fillText(l, W / 2, yy); });
    x.restore();
  }
  ovT.needsUpdate = true;
}

function renderAt(frame) {
  const t = frame / FPS; const p = update(t);
  scene.updateMatrixWorld(true);
  drawOverlay(t);
  renderer.setRenderTarget(sceneRT); renderer.render(scene, camera);
  blurMat.uniforms.tex.value = sceneRT.texture; blurMat.uniforms.dir.value.set(2.2 / (W / 4), 0); blurMat.uniforms.thr.value = 0.85;
  quad.material = blurMat; renderer.setRenderTarget(bA); renderer.render(quadScene, quadCam);
  blurMat.uniforms.tex.value = bA.texture; blurMat.uniforms.dir.value.set(0, 2.2 / (H / 4)); blurMat.uniforms.thr.value = 0;
  renderer.setRenderTarget(bB); renderer.render(quadScene, quadCam);
  quad.material = postMat;
  const u = postMat.uniforms; u.time.value = t; u.exposure.value = p.exposure; u.bloomK.value = p.bloomK; u.zb.value = p.zb; u.flash.value = p.flash; u.fade.value = p.fade; u.tint.value.copy(p.tint);
  renderer.setRenderTarget(null); renderer.render(quadScene, quadCam);
}
window.renderAt = renderAt;
window.grab = async () => { const gl = renderer.getContext(); const px = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px); const blob = new Blob([px]); return await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.readAsDataURL(blob); }); };
window.shot = () => SHOT.name;
// ses icin: noron ateslenme olaylari + kamera uzakligi (yalniz beyin sahnelerinde duyulur)
window.events = () => { const out = []; for (const e of brain.events()) { if (e.t < 2.6 || e.t > 19.6) continue; update(e.t); const d = camera.position.distanceTo(brain.neurons[e.n].p); const p = brain.neurons[e.n].p.clone().project(camera); out.push({ t: +e.t.toFixed(3), d: +d.toFixed(2), x: +p.x.toFixed(2), vis: Math.abs(p.x) < 1.1 && Math.abs(p.y) < 1.1 && p.z < 1 ? 1 : 0 }); } return out; };
init().catch((e) => { window.ERR = String(e && e.stack || e); });
