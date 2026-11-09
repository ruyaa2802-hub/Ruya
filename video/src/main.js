// "Herkes 100 yaşına kadar genç kalsaydı?" — 35 sn, 1080x1920, 30 FPS
// Tamamen deterministik: her kare yalnızca t (saniye) değerinden üretilir.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const W = 1080, H = 1920;
const RS = parseFloat(new URLSearchParams(location.search).get('scale') || '1');
const DURATION = 35;

// ---------- yardımcılar ----------
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const R = rng(20261109);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const sstep = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const easeIO = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
const easeOut = k => 1 - Math.pow(1 - k, 3);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const vlerp = (a, b, k) => a.clone().lerp(b, k);

// ---------- renderer & post ----------
const glCanvas = document.createElement('canvas');
glCanvas.id = 'gl';
document.body.appendChild(glCanvas);
const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(Math.round(W * RS), Math.round(H * RS), false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 3000);
const composer = new EffectComposer(renderer);
composer.setPixelRatio(1);
composer.setSize(Math.round(W * RS), Math.round(H * RS));
const renderPass = new RenderPass(new THREE.Scene(), camera);
const bloom = new UnrealBloomPass(new THREE.Vector2(W * RS, H * RS), 0.8, 0.5, 0.8);
const outputPass = new OutputPass();
const grade = new ShaderPass({
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uFlash: { value: 0 }, uFlashCol: { value: new THREE.Color(1, 1, 1) },
    uFade: { value: 0 }, uZoom: { value: 0 }, uWhip: { value: 0 }, uAberr: { value: 0.0015 }, uSat: { value: 1.08 },
    uContrast: { value: 1.08 }, uVig: { value: 0.45 }, uGrain: { value: 0.045 }, uTint: { value: new THREE.Color(1, 1, 1) },
    uCenter: { value: new THREE.Vector2(0.5, 0.5) }, uLift: { value: new THREE.Color(0.0, 0.0, 0.0) },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime,uFlash,uFade,uZoom,uWhip,uAberr,uSat,uContrast,uVig,uGrain;
    uniform vec3 uTint,uFlashCol,uLift; uniform vec2 uCenter; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
    vec3 tap(vec2 uv, vec2 d){ return vec3(texture2D(tDiffuse,uv+d*uAberr).r, texture2D(tDiffuse,uv).g, texture2D(tDiffuse,uv-d*uAberr).b); }
    void main(){
      vec2 uv=vUv; vec2 d=uv-uCenter; vec3 col;
      if(uZoom+abs(uWhip)>0.0005){
        col=vec3(0.0);
        for(int i=0;i<16;i++){ float k=float(i)/15.0; col+=tap(uv - d*uZoom*k + vec2(uWhip*(k-0.5),0.0), d); }
        col/=16.0;
      } else col=tap(uv,d);
      col = (col-0.5)*uContrast+0.5;
      float l = dot(col,vec3(0.299,0.587,0.114));
      col = mix(vec3(l),col,uSat) * uTint + uLift;
      float v = smoothstep(0.95, 0.25, length(d*vec2(0.85,1.0)));
      col *= mix(1.0-uVig, 1.0, v);
      col += (hash(uv*vec2(1080.0,1920.0)+fract(uTime*7.31))-0.5)*uGrain;
      col = mix(col, uFlashCol, uFlash);
      col *= 1.0-uFade;
      gl_FragColor=vec4(clamp(col,0.0,1.0),1.0);
    }`,
});
composer.addPass(renderPass); composer.addPass(bloom); composer.addPass(outputPass); composer.addPass(grade);
const G = grade.uniforms;

// ---------- dokular ----------
const loader = new THREE.TextureLoader();
const pending = [];
function tex(url, srgb = true) {
  const t = loader.load(url); if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8; pending.push(new Promise(r => { const i = setInterval(() => { if (t.image && t.image.complete !== false && t.image.width) { clearInterval(i); r(); } }, 20); }));
  return t;
}
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); draw(x, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t._ctx = x; t._draw = draw; return t;
}

// ---------- 2.5D fotoğraf sahneleri ----------
function photoScene(img, depth, strength) {
  const scene = new THREE.Scene();
  const map = tex(img), dep = tex(depth, false);
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: map }, dep: { value: dep }, uStr: { value: strength }, uBright: { value: 1 }, uTime: { value: 0 } },
    vertexShader: `uniform sampler2D dep; uniform float uStr; varying vec2 vUv; varying float vD;
      void main(){ vUv=uv; float d=texture2D(dep,uv).r; vD=d; vec3 p=position; p.z+=d*uStr; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0); }`,
    fragmentShader: `uniform sampler2D map; uniform float uBright,uTime; varying vec2 vUv; varying float vD;
      void main(){ vec3 c=texture2D(map,vUv).rgb*uBright; gl_FragColor=vec4(c,1.0);
      #include <colorspace_fragment>
      }`,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(10, 10, 320, 320), mat);
  scene.add(plane);
  scene.userData.mat = mat;
  return scene;
}

function softSprite() {
  return canvasTex(64, 64, (x, w, h) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
}
const SPRITE = softSprite();

function dust(count, box, color, size, seed) {
  const r = rng(seed); const g = new THREE.BufferGeometry(); const p = new Float32Array(count * 3); const s = new Float32Array(count);
  for (let i = 0; i < count; i++) { p[i * 3] = r(); p[i * 3 + 1] = r(); p[i * 3 + 2] = r(); s[i] = r(); }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aS', new THREE.BufferAttribute(s, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uMin: { value: box[0] }, uSize: { value: box[1] }, uCol: { value: new THREE.Color(color) }, uPx: { value: size * RS }, map: { value: SPRITE }, uOp: { value: 1 } },
    vertexShader: `uniform float uTime,uPx; uniform vec3 uMin,uSize; attribute float aS; varying float vA;
      void main(){ vec3 q=position; q.y=fract(q.y+uTime*0.015*(0.5+aS)); q.x=fract(q.x+sin(uTime*0.3+aS*20.0)*0.01);
        vec3 p=uMin+q*uSize; vec4 mv=modelViewMatrix*vec4(p,1.0); gl_Position=projectionMatrix*mv;
        gl_PointSize=uPx*(0.4+aS)*(10.0/-mv.z); vA=0.35+0.65*sin(uTime*2.0+aS*30.0)*0.5+0.3; }`,
    fragmentShader: `uniform sampler2D map; uniform vec3 uCol; uniform float uOp; varying float vA;
      void main(){ float a=texture2D(map,gl_PointCoord).a; gl_FragColor=vec4(uCol*1.6, a*vA*uOp); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; return pts;
}

function rain(count, area, color, len, speed, op, seed) {
  const r = rng(seed); const g = new THREE.BufferGeometry();
  const off = new Float32Array(count * 6), end = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) { const a = r(), b = r(), c = r(); for (let k = 0; k < 2; k++) { off.set([a, b, c], i * 6 + k * 3); end[i * 2 + k] = k; } }
  g.setAttribute('position', new THREE.BufferAttribute(off, 3)); g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uArea: { value: area }, uLen: { value: len }, uSpeed: { value: speed }, uCol: { value: new THREE.Color(color) }, uOp: { value: op } },
    vertexShader: `uniform float uTime,uLen,uSpeed; uniform vec3 uCam,uArea; attribute float aEnd; varying float vA;
      void main(){ vec3 p=position*uArea; p.y-=uTime*uSpeed; vec3 o=uCam-uArea*0.5; p=mod(p-o,uArea)+o;
        p.y-=aEnd*uLen; p.x+=aEnd*uLen*0.1; vA=1.0-aEnd; gl_Position=projectionMatrix*viewMatrix*vec4(p,1.0); }`,
    fragmentShader: `uniform vec3 uCol; uniform float uOp; varying float vA; void main(){ gl_FragColor=vec4(uCol,(0.25+0.75*vA)*uOp); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const l = new THREE.LineSegments(g, m); l.frustumCulled = false; return l;
}

// ---------- karakterler ----------
const M = (c, r = 0.6, m = 0, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...extra });
const SKIN = M(0xe0a37f, 0.48, 0, { emissive: 0x3a1408, emissiveIntensity: 0.25 });
function mesh(geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = false; return m; }

function makeChar(o) {
  const hairM = M(o.hair, 0.55, 0, { emissive: o.hairGlow || 0x000000, emissiveIntensity: 0.25 });
  const topM = M(o.top, o.topRough ?? 0.65, 0.05), pantsM = M(o.pants, 0.8), shoeM = M(o.shoes, 0.35, 0.1);
  const root = new THREE.Group(); const body = new THREE.Group(); body.position.y = 0.95; root.add(body);
  const pelvis = mesh(new THREE.SphereGeometry(0.16, 24, 16), pantsM, 0, 0.02, 0); pelvis.scale.set(1, 0.6, 0.75); body.add(pelvis);
  const spine = new THREE.Group(); body.add(spine);
  const torso = mesh(new THREE.CapsuleGeometry(0.165, 0.3, 8, 24), topM, 0, 0.3, 0); torso.scale.set(1.08, 1, 0.72); spine.add(torso);
  if (o.coat) { const hem = mesh(new THREE.CylinderGeometry(0.19, 0.24, 0.42, 24, 1, true), new THREE.MeshStandardMaterial({ color: o.top, roughness: 0.4, side: THREE.DoubleSide }), 0, -0.02, 0); hem.scale.z = 0.8; spine.add(hem); }
  if (o.shirt) {
    const sh = mesh(new THREE.ConeGeometry(0.07, 0.2, 3), M(0xf2f2f2, 0.5), 0, 0.47, 0.115); sh.rotation.x = Math.PI; sh.scale.z = 0.3; spine.add(sh);
    const tie = mesh(new THREE.BoxGeometry(0.035, 0.2, 0.01), M(o.tie || 0x8b1a2b, 0.4), 0, 0.4, 0.125); spine.add(tie);
  }
  if (o.hood) { const hd = mesh(new THREE.TorusGeometry(0.11, 0.045, 10, 24), M(o.top, 0.4), 0, 0.56, -0.06); hd.rotation.x = Math.PI / 2.6; spine.add(hd); }
  const neck = new THREE.Group(); neck.position.y = 0.6; spine.add(neck);
  neck.add(mesh(new THREE.CylinderGeometry(0.048, 0.055, 0.12, 16), SKIN, 0, 0.03, 0));
  const head = new THREE.Group(); head.position.y = 0.18; neck.add(head);
  const skull = mesh(new THREE.SphereGeometry(0.135, 40, 30), SKIN); skull.scale.set(1, 1.1, 1.04); head.add(skull);
  const jaw = mesh(new THREE.SphereGeometry(0.112, 32, 24), SKIN, 0, -0.055, 0.02); jaw.scale.set(1, 0.85, 1); head.add(jaw);
  for (const s of [-1, 1]) { const e = mesh(new THREE.SphereGeometry(0.034, 16, 12), SKIN, s * 0.134, -0.005, -0.005); e.scale.set(0.5, 1, 0.8); head.add(e); }
  const nose = mesh(new THREE.SphereGeometry(0.024, 16, 12), SKIN, 0, -0.022, 0.138); nose.scale.set(1, 0.95, 1.25); head.add(nose);
  const eyes = [], lids = [], brows = [];
  for (const s of [-1, 1]) {
    const eg = new THREE.Group(); eg.position.set(s * 0.05, 0.012, 0.112); head.add(eg);
    eg.add(mesh(new THREE.SphereGeometry(0.032, 24, 18), M(0xfbfbf8, 0.15)));
    const iris = new THREE.Group(); eg.add(iris);
    iris.add(mesh(new THREE.SphereGeometry(0.0195, 20, 14), M(o.eye || 0x4a2e1a, 0.2), 0, 0, 0.02));
    iris.add(mesh(new THREE.SphereGeometry(0.0105, 14, 10), M(0x050505, 0.1), 0, 0, 0.031));
    iris.add(mesh(new THREE.SphereGeometry(0.0055, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), 0.008, 0.009, 0.036));
    eyes.push(iris);
    const lid = mesh(new THREE.SphereGeometry(0.0345, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), SKIN); eg.add(lid); lids.push(lid);
    const br = mesh(new THREE.BoxGeometry(0.058, 0.013, 0.016), hairM, s * 0.052, 0.072, 0.122); head.add(br); brows.push(br);
  }
  const mouth = mesh(new THREE.TorusGeometry(0.026, 0.0055, 8, 24, Math.PI), M(0x7a3530, 0.5), 0, -0.07, 0.116); head.add(mouth);
  // saç
  const cap = mesh(new THREE.SphereGeometry(0.146, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.56), hairM, 0, 0.012, -0.012);
  cap.scale.set(1.03, 1.1, 1.08); cap.rotation.x = -0.32; head.add(cap);
  if (o.hairStyle === 'neat') {
    const q = mesh(new THREE.SphereGeometry(0.075, 24, 16), hairM, 0.03, 0.118, 0.075); q.scale.set(1.55, 0.55, 0.95); q.rotation.z = -0.25; head.add(q);
    for (const s of [-1, 1]) { const sb = mesh(new THREE.BoxGeometry(0.02, 0.06, 0.05), hairM, s * 0.128, 0.03, 0.03); head.add(sb); }
  } else {
    const tufts = [[0, 0.135, 0.07, 0.06], [0.06, 0.125, 0.06, 0.05], [-0.06, 0.128, 0.055, 0.052], [0.02, 0.15, 0.0, 0.06], [-0.04, 0.145, -0.04, 0.055], [0.09, 0.1, 0.03, 0.045], [-0.095, 0.1, 0.02, 0.045]];
    for (const [x, y, z, r] of tufts) { const tf = mesh(new THREE.SphereGeometry(r, 16, 12), hairM, x, y, z); tf.scale.set(1.1, 0.7, 1); tf.rotation.z = x * 4; head.add(tf); }
  }
  // kollar & bacaklar
  const shoulders = [], elbows = [], hips = [], knees = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * 0.215, 0.5, 0); spine.add(sh); shoulders.push(sh);
    sh.add(mesh(new THREE.SphereGeometry(0.065, 16, 12), topM));
    sh.add(mesh(new THREE.CapsuleGeometry(0.054, 0.22, 6, 16), topM, 0, -0.15, 0));
    const el = new THREE.Group(); el.position.y = -0.3; sh.add(el); elbows.push(el);
    el.add(mesh(new THREE.CapsuleGeometry(0.047, 0.2, 6, 16), topM, 0, -0.12, 0));
    const hand = mesh(new THREE.SphereGeometry(0.048, 16, 12), SKIN, 0, -0.28, 0.005); hand.scale.set(0.8, 1.15, 0.6); el.add(hand);
    const hp = new THREE.Group(); hp.position.set(s * 0.09, 0, 0); body.add(hp); hips.push(hp);
    hp.add(mesh(new THREE.CapsuleGeometry(0.07, 0.3, 6, 16), pantsM, 0, -0.22, 0));
    const kn = new THREE.Group(); kn.position.y = -0.45; hp.add(kn); knees.push(kn);
    kn.add(mesh(new THREE.CapsuleGeometry(0.058, 0.3, 6, 16), pantsM, 0, -0.2, 0));
    const shoe = mesh(new THREE.CapsuleGeometry(0.055, 0.12, 6, 16), shoeM, 0, -0.44, 0.045); shoe.rotation.x = Math.PI / 2; shoe.scale.set(1, 1, 0.75); kn.add(shoe);
  }
  return { root, body, spine, neck, head, shoulders, elbows, hips, knees, lids, brows, mouth, eyes };
}

function pose(c, p) {
  const sit = p.sit || 0, walk = p.walk || 0, ph = p.phase || 0, sad = p.sad || 0;
  const sw = Math.sin(ph);
  for (let i = 0; i < 2; i++) {
    const s = i === 0 ? 1 : -1;
    const legSw = s * sw * 0.48 * walk;
    c.hips[i].rotation.x = lerp(legSw, -Math.PI / 2 + 0.05, sit);
    const kb = Math.max(0, -Math.sin(ph + (i ? Math.PI : 0) + 0.9)) * 0.75 * walk;
    c.knees[i].rotation.x = lerp(kb, Math.PI / 2 - 0.05, sit);
    c.hips[i].rotation.z = s * 0.02 * (1 - sit);
    const armSw = -s * sw * 0.42 * walk;
    c.shoulders[i].rotation.x = lerp(armSw, -0.45, sit) + (p.armsFront || 0) * -0.6;
    c.shoulders[i].rotation.z = (i === 0 ? -1 : 1) * -0.07;
    c.elbows[i].rotation.x = lerp(-0.18 - 0.25 * walk, -1.05, sit) - (p.armsFront || 0) * 0.6;
  }
  c.body.position.y = lerp(0.95 + Math.abs(Math.cos(ph)) * 0.028 * walk, 0.5, sit);
  c.body.position.z = lerp(0, -0.05, sit);
  c.spine.rotation.x = 0.06 * walk + 0.22 * sad + (p.lean || 0);
  c.neck.rotation.x = (p.pitch || 0) + 0.25 * sad;
  c.neck.rotation.y = p.yaw || 0;
  c.head.rotation.z = p.tilt || 0;
  const blink = p.blink || 0;
  for (let i = 0; i < 2; i++) {
    const s = i === 0 ? -1 : 1;
    c.lids[i].rotation.x = lerp(lerp(-1.35, -0.75, sad), 0.35, blink);
    c.brows[i].rotation.z = -s * (0.32 * sad - 0.05);
    c.brows[i].position.y = 0.072 + 0.006 * sad;
    c.eyes[i].rotation.set(p.lookY || 0, p.lookX || 0, 0);
  }
  // ağız: 0 = nötr düz, üzgün = ∩
  c.mouth.rotation.z = p.smile ? Math.PI : 0;
  c.mouth.scale.set(1, lerp(0.22, 0.6, Math.max(sad, p.smile || 0)), 1);
}

// ---------- ŞEHİR ----------
function d_cross_skip(x, z) { return Math.abs(x) < 7 && z < 6 && z > -75; }
function buildCity() {
  const scene = new THREE.Scene();
  const r = rng(77);
  // gökyüzü
  const skyU = {
    uTop: { value: new THREE.Color(0x05060f) }, uHor: { value: new THREE.Color(0x3a1840) }, uBot: { value: new THREE.Color(0x07040a) },
    uSunDir: { value: V(0, 0.04, -1).normalize() }, uSunCol: { value: new THREE.Color(0, 0, 0) }, uCloud: { value: 0.25 }, uCloudCol: { value: new THREE.Color(0x1a1030) }, uTime: { value: 0 },
  };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 48, 24), new THREE.ShaderMaterial({
    uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vDir; void main(){ vDir=position; vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position=p.xyww; }`,
    fragmentShader: `uniform vec3 uTop,uHor,uBot,uSunDir,uSunCol,uCloudCol; uniform float uCloud,uTime; varying vec3 vDir;
      float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
      float fbm(vec2 p){float a=0.5,s=0.0;for(int i=0;i<5;i++){s+=a*n(p);p*=2.03;a*=0.5;}return s;}
      void main(){ vec3 d=normalize(vDir); float y=d.y;
        vec3 c=mix(uHor,uTop,smoothstep(0.0,0.55,y)); c=mix(uBot,c,smoothstep(-0.12,0.02,y));
        float s=max(dot(d,uSunDir),0.0);
        c+=uSunCol*(pow(s,900.0)*10.0+pow(s,40.0)*0.7+pow(s,5.0)*0.35);
        vec2 cp=d.xz/(max(y,0.02)+0.15)*1.4; float cl=smoothstep(0.45,0.85,fbm(cp+vec2(uTime*0.01,0.0)))*smoothstep(0.0,0.12,y);
        vec3 cc=uCloudCol+uSunCol*pow(s,6.0)*0.6; c=mix(c,cc,cl*uCloud);
        gl_FragColor=vec4(c,1.0);
        #include <colorspace_fragment>
      }`,
  }));
  sky.frustumCulled = false; scene.add(sky);

  // bina shader
  const bU = {
    uBase: { value: new THREE.Color(0x10141f) }, uLightDir: { value: V(-0.3, 0.6, 0.5).normalize() }, uLightCol: { value: new THREE.Color(0.35, 0.3, 0.55) },
    uAmb: { value: new THREE.Color(0.25, 0.25, 0.35) }, uFogCol: { value: new THREE.Color(0x2a1638) }, uFogDen: { value: 0.0032 },
    uWarm: { value: new THREE.Color(1.0, 0.62, 0.3) }, uCool: { value: new THREE.Color(0.35, 0.75, 1.0) }, uLit: { value: 0.5 }, uWinI: { value: 1.6 },
    uTime: { value: 0 }, uRimI: { value: 2.5 }, uShop: { value: 1.0 },
  };
  const bVert = `attribute float aSeed; attribute float aH; uniform float uMir; varying vec3 vW; varying vec3 vN; varying float vSeed; varying float vH;
    void main(){ vec4 wp=modelMatrix*instanceMatrix*vec4(position,1.0); vW=wp.xyz; vN=normalize(mat3(modelMatrix)*mat3(instanceMatrix)*normal); vSeed=aSeed; vH=aH; gl_Position=projectionMatrix*viewMatrix*wp; }`;
  const bFrag = `uniform vec3 uBase,uLightDir,uLightCol,uAmb,uFogCol,uWarm,uCool; uniform float uFogDen,uLit,uWinI,uTime,uRimI,uShop,uMir;
    varying vec3 vW; varying vec3 vN; varying float vSeed; varying float vH;
    float h11(float n){return fract(sin(n*91.345)*43758.5453);} float h21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    void main(){ vec3 N=normalize(vN); float y=uMir>0.5?-vW.y:vW.y; if(uMir>0.5) N.y=-N.y;
      float var=0.7+0.6*h11(vSeed*7.1);
      vec3 col=uBase*var*(uAmb+uLightCol*max(dot(N,uLightDir),0.0));
      if(abs(N.y)<0.5){
        float u=abs(N.x)>0.5?vW.z:vW.x; vec2 c=vec2(u/1.8,y/2.7); vec2 cell=floor(c); vec2 f=fract(c);
        float inW=step(0.14,f.x)*step(f.x,0.86)*step(0.2,f.y)*step(f.y,0.8);
        float hh=h21(cell+vSeed*13.37);
        float lit=step(1.0-uLit*(0.5+0.9*h11(vSeed*3.3)),hh);
        lit*=0.85+0.15*step(0.02,fract(hh*91.0+uTime*0.05));
        vec3 wc=mix(uWarm,uCool,step(0.6,h21(cell*1.7+vSeed)));
        col+=inW*lit*wc*(0.4+1.3*h21(cell*3.1+0.5))*uWinI;
        col+=inW*(1.0-lit)*uFogCol*0.12;
        float shop=smoothstep(4.6,4.3,y)*step(0.2,y)*step(0.35,h11(vSeed*9.0));
        vec3 nc=0.5+0.5*cos(6.2831*(h11(vSeed*5.0)+vec3(0.0,0.33,0.67)));
        col+=shop*nc*1.4*uShop*(0.6+0.4*inW);
        float band=step(0.82,h11(vSeed*4.4))*smoothstep(0.6,0.0,abs(fract(y/18.0)-0.5)*18.0-0.1);
        col+=band*nc*0.9*uShop;
      }
      float top=smoothstep(vH-0.7,vH-0.15,y)*step(y,vH+0.01);
      col+=top*step(abs(N.y),0.5)*step(0.7,h11(vSeed*2.2))*(0.5+0.5*cos(6.2831*(h11(vSeed)+vec3(0.6,0.2,0.9))))*uRimI;
      float d=length(vW-cameraPosition);
      float fog=1.0-exp(-pow(d*uFogDen,1.4));
      fog=clamp(fog+exp(-max(y,0.0)*0.04)*0.12*smoothstep(20.0,120.0,d),0.0,1.0);
      col=mix(col,uFogCol,fog);
      if(uMir>0.5) col*=0.42;
      gl_FragColor=vec4(col,1.0);
      #include <colorspace_fragment>
    }`;
  const bMat = new THREE.ShaderMaterial({ uniforms: { ...bU, uMir: { value: 0 } }, vertexShader: bVert, fragmentShader: bFrag });
  const bMatMir = new THREE.ShaderMaterial({ uniforms: { ...bU, uMir: { value: 1 } }, vertexShader: bVert, fragmentShader: bFrag, side: THREE.DoubleSide });

  // yerleşim
  const boxes = [];
  const ROOM = { x0: 12, x1: 22, z0: -48, z1: -32 };
  const hit = (x0, x1, z0, z1) => !(x1 < ROOM.x0 - 1 || x0 > ROOM.x1 + 1 || z1 < ROOM.z0 - 1 || z0 > ROOM.z1 + 1);
  for (const side of [-1, 1]) {
    let rowX = 12;
    for (let row = 0; row < 7; row++) {
      let z = 60;
      while (z > -900) {
        const wz = 9 + r() * 12, dx = 9 + r() * 10;
        const x0 = side > 0 ? rowX : -rowX - dx, x1 = side > 0 ? rowX + dx : -rowX;
        const z1 = z, z0 = z - wz;
        if (!(side > 0 && hit(x0, x1, z0, z1))) {
          let hgt = row === 0 ? 22 + r() * 70 : 35 + r() * 120 + (r() < 0.12 ? 150 + r() * 160 : 0);
          if (row === 0 && z < -150) hgt += r() * 60;
          boxes.push([x0, x1, z0, z1, 0, hgt]);
        }
        z -= wz + (r() < 0.25 ? 8 : 1.5);
      }
      rowX += dx_row(row);
    }
  }
  function dx_row(row) { return row === 0 ? 26 : 22 + row * 4; }
  // görüşme odası kulesi (oda katı boş)
  boxes.push([ROOM.x0, ROOM.x1, ROOM.z0, ROOM.z1, 0, 29.6]);
  boxes.push([ROOM.x0, ROOM.x1, ROOM.z0, ROOM.z1, 34.4, 95]);
  const boxGeo = new THREE.BoxGeometry(1, 1, 1); boxGeo.translate(0, 0.5, 0);
  const n = boxes.length;
  const inst = new THREE.InstancedMesh(boxGeo, bMat, n), instM = new THREE.InstancedMesh(boxGeo, bMatMir, n);
  const seeds = new Float32Array(n), hs = new Float32Array(n); const m4 = new THREE.Matrix4();
  boxes.forEach((b, i) => {
    m4.compose(V((b[0] + b[1]) / 2, b[4], (b[2] + b[3]) / 2), new THREE.Quaternion(), V(b[1] - b[0], b[5] - b[4], b[3] - b[2]));
    inst.setMatrixAt(i, m4); instM.setMatrixAt(i, m4); seeds[i] = i * 1.618 + 0.37; hs[i] = b[5];
  });
  boxGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1)); boxGeo.setAttribute('aH', new THREE.InstancedBufferAttribute(hs, 1));
  inst.frustumCulled = false; instM.frustumCulled = false;
  scene.add(inst);
  const mirror = new THREE.Group(); mirror.scale.y = -1; mirror.add(instM); scene.add(mirror);

  // anten & kırmızı ışıklar
  const ant = boxes.filter(b => b[5] > 120 && r() < 0.6);
  const antM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.3, 0.6, 1, 6).translate(0, 0.5, 0), M(0x1a1c24, 0.5, 0.6), ant.length);
  const beacon = new THREE.InstancedMesh(new THREE.SphereGeometry(0.8, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.3, 0.3) }), ant.length);
  ant.forEach((b, i) => { const hgt = 15 + r() * 40; const p = V((b[0] + b[1]) / 2, b[5], (b[2] + b[3]) / 2); m4.compose(p, new THREE.Quaternion(), V(1, hgt, 1)); antM.setMatrixAt(i, m4); m4.compose(p.clone().setY(b[5] + hgt), new THREE.Quaternion(), V(1, 1, 1)); beacon.setMatrixAt(i, m4); });
  scene.add(antM, beacon);

  // zemin (ıslak asfalt, yarı saydam → yansıma)
  const gU = { uFogCol: bU.uFogCol, uFogDen: bU.uFogDen, uTime: bU.uTime, uRoad: { value: new THREE.Color(0x0b0c12) }, uSide: { value: new THREE.Color(0x16161e) }, uGlow: { value: new THREE.Color(0x5a2a6a) } };
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
    uniforms: gU, transparent: true, depthWrite: true,
    vertexShader: `varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform vec3 uFogCol,uRoad,uSide,uGlow; uniform float uFogDen,uTime; varying vec3 vW;
      float h21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      void main(){ float ax=abs(vW.x); vec3 c=ax<7.0?uRoad:uSide; float a=ax<7.0?0.62:0.78;
        if(ax<7.0){ float lane=step(abs(abs(vW.x)-2.35),0.07)*step(0.45,fract(vW.z/6.0)); c+=lane*vec3(0.55); a+=lane*0.3;
          float edge=step(abs(ax-6.8),0.08); c+=edge*vec3(0.6,0.55,0.4); }
        if(ax>7.0&&ax<7.35) { c=vec3(0.22); a=0.95; }
        if(ax>7.35&&ax<11.8){ vec2 g=fract(vec2(vW.x,vW.z)/1.2); float j=step(0.04,g.x)*step(0.04,g.y); c*=0.75+0.25*j; }
        float sp=step(0.996,h21(floor(vW.xz*6.0)+floor(uTime*8.0))); c+=sp*0.35;
        c+=uGlow*0.12*smoothstep(12.0,6.0,ax);
        float d=length(vW-cameraPosition); float fog=1.0-exp(-pow(d*uFogDen,1.4)); c=mix(c,uFogCol,fog); a=mix(a,1.0,fog);
        gl_FragColor=vec4(c,a);
        #include <colorspace_fragment>
      }`,
  }));
  ground.renderOrder = 1; scene.add(ground);

  // tabelalar
  const signTexts = ['NEXUS', 'GENÇLİK+', 'SONSUZ 25', 'KLİNİK 120', 'İŞ ARANIYOR', 'KİRALIK 2m²', 'YAŞAM POLİÇESİ', 'RAMEN 24/7', 'NEO-İSTANBUL', 'HÜCRE YENİLE', 'AI', 'OTEL KAPSÜL', 'METRO', 'YAŞLANMA YOK', 'NÜFUS +', 'KUYRUK: 3 SAAT'];
  const signCols = ['#ff2bd6', '#2bf3ff', '#ffb02b', '#7cff4a', '#ff4a5a', '#a46bff', '#ffffff', '#ff7a1a'];
  const signs = new THREE.Group(); scene.add(signs);
  const signMirror = new THREE.Group(); signMirror.scale.y = -1; scene.add(signMirror);
  let si = 0;
  for (const side of [-1, 1]) {
    for (let z = 30; z > -650; z -= 14 + r() * 22) {
      if (side > 0 && z < -26 && z > -54) continue;
      const txt = signTexts[si % signTexts.length], col = signCols[(si * 3 + 1) % signCols.length]; si++;
      const vertical = r() < 0.55;
      const tw = vertical ? 160 : 512, th = vertical ? 512 : 160;
      const t = canvasTex(tw, th, (x, w, h) => {
        x.fillStyle = 'rgba(8,6,16,0.85)'; x.fillRect(0, 0, w, h); x.strokeStyle = col; x.lineWidth = 6; x.shadowColor = col; x.shadowBlur = 18; x.strokeRect(8, 8, w - 16, h - 16);
        x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '700 ' + (vertical ? 64 : 84) + 'px Osw';
        if (vertical) { const ch = [...txt.replace(/ /g, '')].slice(0, 7); const step = (h - 40) / ch.length; ch.forEach((c, k) => { x.shadowBlur = 24; x.fillStyle = col; x.fillText(c, w / 2, 26 + step * (k + 0.5)); x.shadowBlur = 0; x.fillStyle = '#fff'; x.globalAlpha = 0.6; x.fillText(c, w / 2, 26 + step * (k + 0.5)); x.globalAlpha = 1; }); }
        else { let fs = 84; x.font = `700 ${fs}px Osw`; while (x.measureText(txt).width > w - 50) { fs -= 4; x.font = `700 ${fs}px Osw`; } x.shadowBlur = 26; x.fillStyle = col; x.fillText(txt, w / 2, h / 2 + 4); x.shadowBlur = 0; x.globalAlpha = 0.65; x.fillStyle = '#fff'; x.fillText(txt, w / 2, h / 2 + 4); x.globalAlpha = 1; }
      });
      const sw = vertical ? 1.6 : 6.5, sh = vertical ? 5.2 : 2.0;
      const mat = new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(1.8, 1.8, 1.8), transparent: true, side: THREE.DoubleSide });
      const sg = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), mat);
      const y = 6 + r() * 22;
      if (vertical) { sg.position.set(side * 10.9, y, z); sg.rotation.y = side * -0.2; }
      else { sg.position.set(side * 11.9, y, z); sg.rotation.y = -side * Math.PI / 2; }
      signs.add(sg);
      const mm = sg.clone(); mm.material = mat.clone(); mm.material.color = new THREE.Color(0.5, 0.5, 0.5); signMirror.add(mm);
    }
  }

  // nüfus panosu
  const popTex = canvasTex(1024, 560, () => {});
  const popBoard = new THREE.Mesh(new THREE.PlaneGeometry(26, 14.2), new THREE.MeshBasicMaterial({ map: popTex, color: new THREE.Color(1.6, 1.6, 1.6), transparent: true, side: THREE.DoubleSide }));
  popBoard.position.set(0, 46, -250); scene.add(popBoard);
  const popPole = mesh(new THREE.BoxGeometry(1.2, 40, 1.2), M(0x15161d, 0.5, 0.5), -13, 20, -250); scene.add(popPole);
  const popPole2 = popPole.clone(); popPole2.position.x = 13; scene.add(popPole2);
  const popBeam = mesh(new THREE.BoxGeometry(27, 1, 1), M(0x15161d, 0.5, 0.5), 0, 38.6, -250); scene.add(popBeam);

  // metro
  const track = mesh(new THREE.BoxGeometry(3.2, 0.8, 1400), M(0x1b1c24, 0.6, 0.4), -8.8, 9, -500); scene.add(track);
  const pillars = new THREE.InstancedMesh(new THREE.BoxGeometry(0.8, 9, 0.8).translate(0, 4.5, 0), M(0x22232c, 0.7, 0.3), 70);
  for (let i = 0; i < 70; i++) { m4.makeTranslation(-8.8, 0, 100 - i * 20); pillars.setMatrixAt(i, m4); } scene.add(pillars);
  const trackLight = mesh(new THREE.BoxGeometry(0.12, 0.12, 1400), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 2.2, 3) }), -7.2, 9.3, -500); scene.add(trackLight);
  const trainTex = canvasTex(1024, 64, (x, w, h) => { x.fillStyle = '#c9ccd6'; x.fillRect(0, 0, w, h); for (let i = 0; i < 24; i++) { x.fillStyle = i % 6 === 5 ? '#333' : '#fff3c8'; x.fillRect(10 + i * 42, 14, 30, 28); } x.fillStyle = '#21e6ff'; x.fillRect(0, 50, w, 6); });
  const train = new THREE.Group(); scene.add(train);
  for (let k = 0; k < 6; k++) {
    const sideM = new THREE.MeshStandardMaterial({ map: trainTex, emissive: 0xffffff, emissiveMap: trainTex, emissiveIntensity: 1.1, roughness: 0.3 });
    const body = M(0xb9bcc6, 0.3, 0.7);
    // BoxGeometry malzeme sırası: +x,-x,+y,-y,+z,-z
    const car = mesh(new THREE.BoxGeometry(2.8, 3, 18), [sideM, sideM, body, M(0x55585f, 0.5, 0.5), body, body], 0, 0, -k * 18.6);
    train.add(car);
  }
  train.position.set(-8.8, 11, 0);

  // arabalar
  const carGeo = mergeGeometries([new THREE.BoxGeometry(1.9, 0.7, 4.4).translate(0, 0.55, 0), new THREE.BoxGeometry(1.6, 0.55, 2.2).translate(0, 1.15, -0.2)]);
  const NC = 80;
  const cars = new THREE.InstancedMesh(carGeo, M(0x1a1d26, 0.25, 0.8), NC);
  const tail = new THREE.InstancedMesh(new THREE.BoxGeometry(1.6, 0.18, 0.1), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 0.25, 0.2) }), NC);
  const head = new THREE.InstancedMesh(new THREE.BoxGeometry(1.6, 0.16, 0.1), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 4, 3.6) }), NC);
  const carData = []; for (let i = 0; i < NC; i++) carData.push({ lane: [-4.6, -1.2, 1.2, 4.6][i % 4], z0: r() * 900, sp: 9 + r() * 7, col: r() });
  scene.add(cars, tail, head);
  // uçan araçlar
  const flyGeo = mergeGeometries([new THREE.CapsuleGeometry(0.9, 2.6, 4, 12).rotateX(Math.PI / 2), new THREE.BoxGeometry(3.6, 0.15, 1.2).translate(0, 0, 0.6)]);
  const NF = 46;
  const fly = new THREE.InstancedMesh(flyGeo, M(0x23262f, 0.2, 0.9), NF);
  const flyGlow = new THREE.InstancedMesh(new THREE.SphereGeometry(0.45, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), NF * 2);
  const flyData = []; for (let i = 0; i < NF; i++) flyData.push({ x: (r() - 0.5) * 60, y: 18 + r() * 70, z0: r() * 900, sp: (14 + r() * 18) * (r() < 0.5 ? 1 : -1), c: new THREE.Color().setHSL(r() < 0.5 ? 0.53 : 0.88, 1, 0.6).multiplyScalar(5), tailC: new THREE.Color(5, 0.3, 0.2) });
  flyData.forEach((d, i) => { flyGlow.setColorAt(i * 2, d.c); flyGlow.setColorAt(i * 2 + 1, d.tailC); });
  scene.add(fly, flyGlow);

  // kalabalık
  const personGeo = mergeGeometries([new THREE.CapsuleGeometry(0.21, 0.85, 4, 10).translate(0, 0.66, 0), new THREE.SphereGeometry(0.13, 12, 8).translate(0, 1.55, 0)]);
  const NP = 1700;
  const crowd = new THREE.InstancedMesh(personGeo, M(0xffffff, 0.7), NP);
  const umb = new THREE.InstancedMesh(new THREE.ConeGeometry(0.62, 0.32, 12, 1, true).translate(0, 2.0, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, transparent: true, opacity: 0.85, side: THREE.DoubleSide, emissive: 0x111111 }), NP);
  const pal = [0xe8c33a, 0x3a6fe8, 0xd6d9e0, 0x2b2d36, 0xc23b5a, 0x6ad1e3, 0xe07a2b, 0x8b5bd6, 0x1c1e26, 0x9aa0a8];
  const crowdData = [];
  for (let i = 0; i < NP; i++) {
    let x, z, sp;
    const zone = r();
    if (zone < 0.55) { const s = r() < 0.5 ? -1 : 1; x = s * (7.6 + r() * 3.9); z = 40 - r() * 600; }
    else if (zone < 0.8) { x = (r() - 0.5) * 13; z = -60 - Math.floor(r() * 6) * 90 - r() * 6; }
    else { x = (r() - 0.5) * 13; z = 40 - r() * 500; }
    if (x > 6.5 && z < 6 && z > -75) { x = -x; }
    if (d_cross_skip(x, z)) { z -= 90; }
    sp = (0.8 + r() * 0.8) * (r() < 0.5 ? 1 : -1);
    crowdData.push({ x, z, sp, ph: r() * 6.28, u: r() < 0.22, s: 0.9 + r() * 0.2, cross: zone >= 0.55 && zone < 0.8 });
    crowd.setColorAt(i, new THREE.Color(pal[Math.floor(r() * pal.length)]));
    umb.setColorAt(i, new THREE.Color().setHSL(r(), 0.6, 0.6));
  }
  scene.add(crowd, umb);
  crowd.frustumCulled = umb.frustumCulled = cars.frustumCulled = tail.frustumCulled = head.frustumCulled = fly.frustumCulled = flyGlow.frustumCulled = false;

  // ışıklar
  const hemi = new THREE.HemisphereLight(0x8a7cff, 0x2a1020, 0.9); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xff9a5a, 0.0); sun.position.set(0, 20, -100); scene.add(sun);
  const pl1 = new THREE.PointLight(0xff2bd6, 60, 40, 1.6); pl1.position.set(-6, 6, -45); scene.add(pl1);
  const pl2 = new THREE.PointLight(0x2bf3ff, 60, 40, 1.6); pl2.position.set(10, 4, -50); scene.add(pl2);

  // ---------- görüşme odası (x 12.2..21.8, y 30..34, z -47.5..-32.5) ----------
  const room = new THREE.Group(); scene.add(room);
  const floorM = M(0x1a1c22, 0.25, 0.3), wallM = M(0x23252e, 0.85, 0.0), panelM = M(0x2d3039, 0.6, 0.1);
  room.add(mesh(new THREE.BoxGeometry(10, 0.4, 15.6), floorM, 17, 29.8, -40));
  room.add(mesh(new THREE.BoxGeometry(10, 0.4, 15.6), wallM, 17, 34.2, -40));
  room.add(mesh(new THREE.BoxGeometry(0.3, 4.4, 15.6), wallM, 21.9, 32, -40));
  room.add(mesh(new THREE.BoxGeometry(10, 4.4, 0.3), wallM, 17, 32, -47.8));
  room.add(mesh(new THREE.BoxGeometry(10, 4.4, 0.3), wallM, 17, 32, -32.2));
  for (let k = 0; k < 7; k++) room.add(mesh(new THREE.BoxGeometry(0.05, 3.4, 1.7), panelM, 21.72, 32, -46 + k * 2));
  const strip = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 2.6, 3.2) });
  room.add(mesh(new THREE.BoxGeometry(0.06, 0.06, 15), strip, 21.7, 33.95, -40));
  room.add(mesh(new THREE.BoxGeometry(9.5, 0.05, 0.08), strip, 17, 33.95, -47.6));
  room.add(mesh(new THREE.BoxGeometry(9.5, 0.05, 0.08), strip, 17, 33.95, -32.4));
  for (let k = 0; k < 3; k++) room.add(mesh(new THREE.BoxGeometry(3.2, 0.04, 0.25), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.2, 2.3) }), 17.5, 33.97, -44 + k * 4));
  // kapı
  const doorFrame = mesh(new THREE.BoxGeometry(0.12, 2.6, 1.6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 2, 2.6) }), 21.7, 31.3, -35); room.add(doorFrame);
  const door = mesh(new THREE.BoxGeometry(0.1, 2.45, 1.4), M(0x0d0e12, 0.3, 0.6), 21.6, 31.25, -35); room.add(door);
  // pencere (x=12.2): dikmeler + cam
  for (let k = 0; k < 9; k++) room.add(mesh(new THREE.BoxGeometry(0.12, 4.2, 0.12), M(0x0e0f14, 0.4, 0.7), 12.15, 32, -47.6 + k * 1.95));
  room.add(mesh(new THREE.BoxGeometry(0.14, 0.14, 15.6), M(0x0e0f14, 0.4, 0.7), 12.15, 30.1, -40));
  const glass = mesh(new THREE.PlaneGeometry(15.6, 4.2), new THREE.MeshBasicMaterial({ color: 0x6fa8ff, transparent: true, opacity: 0.06, side: THREE.DoubleSide, depthWrite: false }), 12.2, 32, -40); glass.rotation.y = Math.PI / 2; room.add(glass);
  // masa & sandalyeler
  room.add(mesh(new THREE.BoxGeometry(1.1, 0.08, 3.0), M(0x0f1015, 0.15, 0.6), 14.9, 30.75, -40));
  room.add(mesh(new THREE.BoxGeometry(0.9, 0.7, 2.6), M(0x0b0c10, 0.4, 0.5), 14.9, 30.35, -40));
  room.add(mesh(new THREE.BoxGeometry(0.02, 0.03, 2.9), strip, 15.46, 30.72, -40));
  const chairM = M(0x2a2c35, 0.5, 0.3);
  const chairs = [];
  for (const z of [-39.25, -40.85]) {
    const ch = new THREE.Group(); ch.position.set(16.95, 30, z); room.add(ch); chairs.push(ch);
    ch.add(mesh(new THREE.BoxGeometry(0.55, 0.08, 0.55), chairM, 0, 0.46, 0));
    ch.add(mesh(new THREE.BoxGeometry(0.08, 0.6, 0.55), chairM, 0.27, 0.8, 0));
    ch.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.46, 8), M(0x777a85, 0.3, 0.9), 0, 0.23, 0));
    ch.add(mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.03, 16), M(0x777a85, 0.3, 0.9), 0, 0.02, 0));
  }
  // hologram görüşmeci
  const holo = new THREE.Group(); holo.position.set(13.45, 31.2, -40); room.add(holo);
  const holoM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 1.8, 2.4), wireframe: true, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
  const hHead = mesh(new THREE.IcosahedronGeometry(0.26, 2), holoM, 0, 0.75, 0); hHead.scale.set(0.9, 1.15, 1); holo.add(hHead);
  const hBody = mesh(new THREE.SphereGeometry(0.5, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), holoM, 0, 0.0, 0); hBody.scale.set(1.1, 0.75, 0.6); holo.add(hBody);
  const holoPts = dust(260, [V(-0.6, -0.6, -0.5), V(1.2, 1.9, 1.0)], 0x5fe8ff, 0.9, 5); holo.add(holoPts);
  const holoBase = mesh(new THREE.CylinderGeometry(0.45, 0.55, 0.05, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 2.5, 3.2) }), 0, -1.17, 0); holo.add(holoBase);
  const holoCone = mesh(new THREE.CylinderGeometry(0.55, 0.45, 2.3, 32, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.1, 0.6, 0.8), transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), 0, 0, 0); holo.add(holoCone);
  // karar ekranı (masa üstünde)
  const decTex = canvasTex(512, 256, () => {});
  const decScreen = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), new THREE.MeshBasicMaterial({ map: decTex, color: new THREE.Color(1.5, 1.5, 1.5), transparent: true, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  decScreen.position.set(14.75, 31.35, -40); decScreen.rotation.y = Math.PI / 2; room.add(decScreen);
  const roomKey = new THREE.PointLight(0x5fd8ff, 26, 8, 1.4); roomKey.position.set(13.8, 31.8, -40); room.add(roomKey);
  const roomFill = new THREE.PointLight(0xffb27a, 14, 10, 1.4); roomFill.position.set(19, 33.5, -40); room.add(roomFill);
  const roomTop = new THREE.PointLight(0xdfe6ff, 12, 9, 1.5); roomTop.position.set(17, 33.6, -36); room.add(roomTop);

  // ---------- karakterler ----------
  const father = makeChar({ hair: 0xf0eff2, hairGlow: 0x222226, hairStyle: 'neat', top: 0x1d2741, pants: 0x161b2b, shoes: 0x0b0b0e, shirt: true, tie: 0x9c1c2e, eye: 0x3b5a7a });
  const son = makeChar({ hair: 0x2a1a12, hairStyle: 'messy', top: 0xd9a020, topRough: 0.35, pants: 0x23262e, shoes: 0xe9e9e9, coat: true, hood: true, eye: 0x4a2e1a });
  scene.add(father.root, son.root);

  const rainA = rain(9000, V(70, 45, 70), 0x9fb8ff, 0.9, 26, 0.32, 9); scene.add(rainA);
  scene.fog = new THREE.FogExp2(0x2a1638, 0.004);

  return { scene, sky, skyU, bU, gU, train, cars, tail, head, carData, fly, flyGlow, flyData, crowd, umb, crowdData, popTex, popBoard, hemi, sun, pl1, pl2, father, son, chairs, holo, hHead, holoPts, decTex, door, rainA, signs, signMirror, room };
}

// ---------- klinik (büyüme sahnesi) ----------
function buildClinic() {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x02060a); scene.fog = new THREE.FogExp2(0x03101a, 0.06);
  const floor = mesh(new THREE.CircleGeometry(30, 64).rotateX(-Math.PI / 2), M(0x0a1016, 0.15, 0.6)); scene.add(floor);
  const strip = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 2.4, 3.2) });
  for (let k = 0; k < 18; k++) { const a = k / 18 * Math.PI * 2; const s = mesh(new THREE.BoxGeometry(0.08, 6, 0.08), strip, Math.cos(a) * 5, 3, Math.sin(a) * 5); scene.add(s); }
  const ring = mesh(new THREE.TorusGeometry(1.4, 0.03, 8, 96).rotateX(Math.PI / 2), strip, 0, 0.02, 0); scene.add(ring);
  const ring2 = mesh(new THREE.TorusGeometry(1.9, 0.015, 8, 96).rotateX(Math.PI / 2), strip, 0, 0.02, 0); scene.add(ring2);
  const pod = mesh(new THREE.CylinderGeometry(1.5, 1.5, 4.5, 64, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.1, 0.5, 0.7), transparent: true, opacity: 0.08, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }), 0, 2.25, 0); pod.visible = false; scene.add(pod);
  scene.add(new THREE.HemisphereLight(0x8fd8ff, 0x050a10, 0.25));
  const key = new THREE.SpotLight(0xfff1e6, 22, 20, 0.5, 0.6, 1.2); key.position.set(2, 5, 4); key.target.position.set(0, 1, 0); scene.add(key, key.target);
  const rim = new THREE.PointLight(0x2bf3ff, 18, 10, 1.5); rim.position.set(-1.5, 2.2, -2); scene.add(rim);
  const rim2 = new THREE.PointLight(0xff4ad8, 14, 10, 1.5); rim2.position.set(1.8, 1.5, -2.2); scene.add(rim2);
  const d = dust(500, [V(-4, 0, -4), V(8, 5, 8)], 0x7fe9ff, 1.2, 3); scene.add(d);
  const son = makeChar({ hair: 0x2a1a12, hairStyle: 'messy', top: 0xd9a020, topRough: 0.35, pants: 0x23262e, shoes: 0xe9e9e9, coat: true, hood: true, eye: 0x4a2e1a });
  scene.add(son.root);
  return { scene, son, dust: d, rings: [ring, ring2] };
}

// ---------- sahneleri kur ----------
const P1 = photoScene('/assets/kuvoz_hd.jpg', '/assets/kuvoz_depth.png', 2.2);
const p1dust = dust(260, [V(-5, -5, 0), V(10, 10, 4)], 0x8ff3ff, 1.4, 11); P1.add(p1dust);
const P2 = photoScene('/assets/sehir_gece_hd.jpg', '/assets/sehir_gece_depth.png', 3.2);
const p2rain = rain(4000, V(12, 14, 8), 0xb8c8ff, 0.5, 9, 0.35, 12); P2.add(p2rain);
const P2fly = []; for (let i = 0; i < 4; i++) { const g = new THREE.Group(); const b = mesh(new THREE.CapsuleGeometry(0.06, 0.22, 4, 8).rotateZ(Math.PI / 2), M(0x222630, 0.3, 0.8)); g.add(b); const l = mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(i % 2 ? 5 : 0.5, i % 2 ? 0.5 : 3, i % 2 ? 4 : 5) }), 0, -0.05, 0); g.add(l); P2.add(g); P2fly.push(g); }
P2.add(new THREE.AmbientLight(0x8899ff, 1.5));
const P3 = photoScene('/assets/sehir_gunbatimi_hd.jpg', '/assets/sehir_gunbatimi_depth.png', 3.0);
const p3dust = dust(300, [V(-5, -5, 0), V(10, 10, 4)], 0xffd9a0, 1.1, 13); P3.add(p3dust);
const p3rain = rain(2500, V(12, 14, 8), 0xffe0c0, 0.4, 7, 0.18, 14); P3.add(p3rain);
const C = buildCity();
const K = buildClinic();

// ---------- şehir ruh hali ----------
function cityMood(m) {
  const { skyU, bU, hemi, sun, pl1, pl2, scene } = C;
  if (m === 'night') {
    skyU.uTop.value.set(0x04050d); skyU.uHor.value.set(0x45183f); skyU.uBot.value.set(0x0a0610); skyU.uSunCol.value.setRGB(0, 0, 0); skyU.uCloud.value = 0.35; skyU.uCloudCol.value.set(0x1d0f2c);
    bU.uFogCol.value.set(0x2c1436); bU.uFogDen.value = 0.0033; bU.uLit.value = 0.5; bU.uWinI.value = 1.7; bU.uShop.value = 1; bU.uRimI.value = 2.5;
    bU.uLightCol.value.setRGB(0.3, 0.25, 0.5); bU.uAmb.value.setRGB(0.22, 0.22, 0.32); bU.uBase.value.set(0x12151f);
    hemi.color.set(0x8a7cff); hemi.groundColor.set(0x2a1020); hemi.intensity = 0.9; sun.intensity = 0; pl1.intensity = 60; pl2.intensity = 60;
    C.gU.uGlow.value.set(0x5a2a6a); scene.fog.color.set(0x2c1436); scene.fog.density = 0.004; C.rainA.visible = true;
  } else {
    skyU.uTop.value.set(0x1b1640); skyU.uHor.value.set(0xff8a3c); skyU.uBot.value.set(0x2a1410); skyU.uSunCol.value.setRGB(1.0, 0.62, 0.28); skyU.uSunDir.value.set(-0.08, 0.05, -1).normalize(); skyU.uCloud.value = 0.75; skyU.uCloudCol.value.set(0x6b2f4a);
    bU.uFogCol.value.set(0xc86a3a); bU.uFogDen.value = 0.0026; bU.uLit.value = 0.32; bU.uWinI.value = 1.2; bU.uShop.value = 0.6; bU.uRimI.value = 1.5;
    bU.uLightCol.value.setRGB(1.0, 0.55, 0.3); bU.uLightDir.value.set(0.05, 0.25, -1).normalize(); bU.uAmb.value.setRGB(0.28, 0.22, 0.32); bU.uBase.value.set(0x2a2230);
    hemi.color.set(0xffb07a); hemi.groundColor.set(0x301a28); hemi.intensity = 1.1; sun.intensity = 3.2; sun.position.set(-10, 25, -200); pl1.intensity = 10; pl2.intensity = 10;
    C.gU.uGlow.value.set(0x8a3a2a); scene.fog.color.set(0xc86a3a); scene.fog.density = 0.003; C.rainA.visible = false;
  }
}

// ---------- şehir animasyonu ----------
const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), qY = new THREE.Quaternion(), one = V(1, 1, 1);
function animateCity(t) {
  C.bU.uTime.value = t; C.skyU.uTime.value = t;
  C.train.position.z = 80 - ((t * 32) % 700);
  C.carData.forEach((d, i) => {
    const dir = d.lane < 0 ? 1 : -1; const u = (d.z0 + t * d.sp) % 900;
    const z = dir > 0 ? -820 + u : 80 - u;
    qY.setFromAxisAngle(V(0, 1, 0), dir > 0 ? 0 : Math.PI);
    m4.compose(V(d.lane, 0, z), qY, one); C.cars.setMatrixAt(i, m4);
    m4.compose(V(d.lane, 0.75, z - dir * 2.25), qY, one); C.tail.setMatrixAt(i, m4);
    m4.compose(V(d.lane, 0.65, z + dir * 2.25), qY, one); C.head.setMatrixAt(i, m4);
  });
  C.cars.instanceMatrix.needsUpdate = C.tail.instanceMatrix.needsUpdate = C.head.instanceMatrix.needsUpdate = true;
  C.flyData.forEach((d, i) => {
    const u = (d.z0 + t * Math.abs(d.sp)) % 900; const zz = d.sp > 0 ? 80 - u : -820 + u;
    const y = d.y + Math.sin(t * 0.7 + i) * 1.2;
    qY.setFromAxisAngle(V(0, 1, 0), d.sp > 0 ? 0 : Math.PI);
    m4.compose(V(d.x, y, zz), qY, one); C.fly.setMatrixAt(i, m4);
    const fz = d.sp > 0 ? -1 : 1; // hareket yönü
    m4.compose(V(d.x, y - 0.6, zz + fz * 1.6), q, V(1.6, 0.5, 1.6)); C.flyGlow.setMatrixAt(i * 2, m4);
    m4.compose(V(d.x, y, zz - fz * 1.9), q, V(1.2, 0.8, 0.6)); C.flyGlow.setMatrixAt(i * 2 + 1, m4);
  });
  C.fly.instanceMatrix.needsUpdate = C.flyGlow.instanceMatrix.needsUpdate = true;
  C.crowdData.forEach((d, i) => {
    let x = d.x, z = d.z;
    if (d.cross) x = ((d.x + 6.5 + t * d.sp) % 13 + 13) % 13 - 6.5; else z = d.z + Math.sin(d.ph) * 0 + t * d.sp;
    const bob = Math.abs(Math.sin(t * 6 + d.ph)) * 0.05;
    qY.setFromAxisAngle(V(0, 1, 0), d.cross ? (d.sp > 0 ? Math.PI / 2 : -Math.PI / 2) : (d.sp > 0 ? 0 : Math.PI));
    m4.compose(V(x, bob, z), qY, V(d.s, d.s, d.s)); C.crowd.setMatrixAt(i, m4);
    m4.compose(V(x, d.u ? bob : -50, z), qY, V(d.s, d.s, d.s)); C.umb.setMatrixAt(i, m4);
  });
  C.crowd.instanceMatrix.needsUpdate = C.umb.instanceMatrix.needsUpdate = true;
  C.rainA.material.uniforms.uTime.value = t; C.rainA.material.uniforms.uCam.value.copy(camera.position);
  C.hHead.rotation.y = Math.sin(t * 0.8) * 0.4; C.holoPts.material.uniforms.uTime.value = t * 4;
  C.hHead.material.opacity = 0.45 + 0.15 * Math.sin(t * 23) * Math.sin(t * 7);
}

function drawPop(t) {
  const x = C.popTex._ctx, w = 1024, h = 560;
  x.clearRect(0, 0, w, h);
  x.fillStyle = 'rgba(4,10,24,0.82)'; x.fillRect(0, 0, w, h);
  x.strokeStyle = '#2bf3ff'; x.lineWidth = 8; x.shadowColor = '#2bf3ff'; x.shadowBlur = 20; x.strokeRect(14, 14, w - 28, h - 28); x.shadowBlur = 0;
  x.fillStyle = '#2bf3ff'; x.font = '700 64px Osw'; x.textAlign = 'center'; x.fillText('DÜNYA NÜFUSU', w / 2, 110);
  const k = clamp((t - 5) / 8); const n = 8.2e9 + easeIO(k) * 6.0e9 + Math.floor(t * 30) * 137;
  const s = Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  x.fillStyle = '#fff'; x.shadowColor = '#ff2bd6'; x.shadowBlur = 30; x.font = '700 150px Osw'; x.fillText(s, w / 2, 300); x.shadowBlur = 0;
  x.fillStyle = '#ff4a8a'; x.font = '700 50px Osw'; x.fillText('DOĞUM: +4.3 / sn     ÖLÜM: 0', w / 2, 420);
  x.fillStyle = 'rgba(43,243,255,0.6)'; for (let i = 0; i < 40; i++) { const hh = 20 + 30 * Math.abs(Math.sin(i * 1.7 + t * 6)); x.fillRect(80 + i * 22, 500 - hh, 12, hh); }
  C.popTex.needsUpdate = true;
}

function drawDecision(t, phase) {
  const x = C.decTex._ctx, w = 512, h = 256; x.clearRect(0, 0, w, h);
  x.fillStyle = 'rgba(0,30,40,0.6)'; x.fillRect(0, 0, w, h);
  x.strokeStyle = '#2bf3ff'; x.lineWidth = 4; x.strokeRect(6, 6, w - 12, h - 12);
  x.font = '700 30px Osw'; x.textAlign = 'center'; x.fillStyle = '#2bf3ff'; x.fillText('POZİSYON: 1 KİŞİ · 4.812 BAŞVURU', w / 2, 46);
  const cards = [['ARDA K.', '90 YAŞ · 68 YIL DENEYİM'], ['EMRE K.', '25 YAŞ · 0 YIL DENEYİM']];
  cards.forEach((c, i) => {
    const y = 90 + i * 80; x.fillStyle = 'rgba(43,243,255,0.12)'; x.fillRect(24, y, w - 48, 66);
    x.textAlign = 'left'; x.fillStyle = '#fff'; x.font = '700 30px Osw'; x.fillText(c[0], 40, y + 30); x.fillStyle = '#9fe9ff'; x.font = '700 20px Osw'; x.fillText(c[1], 40, y + 56);
    if (phase > 0) { const ok = i === 0; x.textAlign = 'right'; x.fillStyle = ok ? '#4bff7a' : '#ff3b4b'; x.font = '700 34px Osw'; if ((ok && phase >= 1) || (!ok && phase >= 2)) x.fillText(ok ? 'KABUL' : 'RED', w - 40, y + 44); }
  });
  C.decTex.needsUpdate = true;
}

// ---------- 2D katman (yazılar, HUD) ----------
const out = document.getElementById('out'); const ctx = out.getContext('2d');
const SUBS = [
  [0.35, 4.55, 'Ya insanlar *100 yaşına* kadar hiç *yaşlanmasaydı?*', 1240],
  [5.5, 9.0, 'İnsanlar artık *yaşlanmıyordu…*', 1300],
  [9.15, 12.85, '…ama her gün *yeni insanlar* doğuyordu.', 1300],
  [13.5, 18.6, '*90 yaşındaki* insanlar hâlâ çalışıyor…', 1330],
  [19.0, 24.7, '*25 yaşındaki* çocuklar, anne babalarıyla *aynı işler* için yarışıyordu.', 1330],
  [25.5, 29.3, 'İnsanlık *daha uzun* yaşamayı başarmıştı…', 1300],
  [29.5, 32.2, '…ama *daha iyi* yaşamayı değil.', 1300],
];
function tokens(s) { const out = []; let hl = false; for (const part of s.split(/(\*)/)) { if (part === '*') { hl = !hl; continue; } for (const w of part.split(' ')) if (w) out.push({ w, hl }); } return out; }
function drawSub(t, [t0, t1, text, yc], size = 70) {
  if (t < t0 || t > t1) return;
  const toks = tokens(text); ctx.save(); ctx.font = `800 ${size}px Mont`; ctx.textBaseline = 'middle';
  const space = ctx.measureText(' ').width, maxW = 880;
  const lines = [[]]; let lw = 0;
  for (const tk of toks) { tk.m = ctx.measureText(tk.w).width; if (lw + tk.m > maxW && lines[lines.length - 1].length) { lines.push([]); lw = 0; } lines[lines.length - 1].push(tk); lw += tk.m + space; }
  const lh = size * 1.22, y0 = yc - (lines.length - 1) * lh / 2;
  const dur = t1 - t0, reveal = Math.min(dur * 0.45, toks.length * 0.11), fadeOut = clamp((t1 - t) / 0.22);
  let idx = 0;
  lines.forEach((ln, li) => {
    const tw = ln.reduce((a, b) => a + b.m, 0) + space * (ln.length - 1); let x = 540 - tw / 2;
    for (const tk of ln) {
      const st = t0 + reveal * idx / toks.length; const k = clamp((t - st) / 0.16); idx++;
      if (k <= 0) { x += tk.m + space; continue; }
      const sc = lerp(1.35, 1, easeOut(k)); const cx = x + tk.m / 2, cy = y0 + li * lh;
      ctx.save(); ctx.globalAlpha = k * fadeOut; ctx.translate(cx, cy); ctx.scale(sc, sc);
      ctx.lineJoin = 'round'; ctx.lineWidth = 13; ctx.strokeStyle = 'rgba(0,0,0,0.92)'; ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 18; ctx.strokeText(tk.w, -tk.m / 2, 0);
      ctx.shadowBlur = 0; ctx.fillStyle = tk.hl ? '#ffd23a' : '#ffffff'; ctx.fillText(tk.w, -tk.m / 2, 0);
      ctx.restore(); x += tk.m + space;
    }
  });
  ctx.restore();
}
function hudText(s, x, y, size, col, align = 'left', alpha = 1, font = 'Osw', weight = 700) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.font = `${weight} ${size}px ${font}`; ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.shadowColor = col; ctx.shadowBlur = 16; ctx.fillStyle = col; ctx.fillText(s, x, y); ctx.shadowBlur = 0; ctx.globalAlpha = alpha * 0.55; ctx.fillStyle = '#fff'; ctx.fillText(s, x, y); ctx.restore();
}
function ecg(t, y, alpha) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = '#5ff6ff'; ctx.lineWidth = 4; ctx.shadowColor = '#5ff6ff'; ctx.shadowBlur = 14; ctx.beginPath();
  const per = 0.5;
  for (let x = 60; x <= 1020; x += 3) {
    const tt = t - (1020 - x) / 900; const ph = ((tt % per) + per) % per / per;
    let v = 0; if (ph > 0.1 && ph < 0.14) v = -(ph - 0.1) * 300; else if (ph >= 0.14 && ph < 0.18) v = -12 + (ph - 0.14) * 2400 * 0.04 * 25; else if (ph >= 0.18 && ph < 0.22) v = 85 - (ph - 0.18) * 4000 * 0.6; else if (ph > 0.35 && ph < 0.45) v = -Math.sin((ph - 0.35) / 0.1 * Math.PI) * 14;
    v = clamp(v, -110, 110);
    if (x === 60) ctx.moveTo(x, y + v); else ctx.lineTo(x, y - v);
  }
  ctx.stroke(); ctx.restore();
}
function proj(v) { const p = v.clone().project(camera); return [(p.x + 1) / 2 * W, (1 - p.y) / 2 * H, p.z]; }
function tag(v, l1, l2, col, alpha) {
  const [x, y, z] = proj(v); if (z > 1 || alpha <= 0) return;
  ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.shadowColor = col; ctx.shadowBlur = 12;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 70); ctx.stroke();
  ctx.font = '700 40px Osw'; const w1 = Math.max(ctx.measureText(l1).width, 0); ctx.font = '700 28px Osw'; const w2 = ctx.measureText(l2).width; const bw = Math.max(w1, w2) + 40;
  ctx.fillStyle = 'rgba(2,12,20,0.75)'; ctx.fillRect(x - bw / 2, y - 180, bw, 110); ctx.strokeRect(x - bw / 2, y - 180, bw, 110);
  ctx.shadowBlur = 0; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = '700 40px Osw'; ctx.fillText(l1, x, y - 145); ctx.fillStyle = col; ctx.font = '700 28px Osw'; ctx.fillText(l2, x, y - 98);
  ctx.restore();
}
function stamp(v, text, col, k) {
  if (k <= 0) return; let [x, y] = proj(v); x = clamp(x, 230, 850); y = clamp(y, 560, 1500); const sc = lerp(2.4, 1, easeOut(clamp(k * 1.6)));
  ctx.save(); ctx.translate(x, y - 260); ctx.rotate(-0.12); ctx.scale(sc, sc); ctx.globalAlpha = clamp(k * 2);
  ctx.font = '800 76px Mont'; const w = ctx.measureText(text).width + 60;
  ctx.lineWidth = 9; ctx.strokeStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 30; ctx.strokeRect(-w / 2, -58, w, 116);
  ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 0, 4); ctx.restore();
}

// ---------- çekim listesi ----------
let curScene = null;
function photoCam(cx0, cy0, z0, cx1, cy1, z1, k, look = 0) {
  camera.fov = 40; camera.position.set(lerp(cx0, cx1, k), lerp(cy0, cy1, k), lerp(z0, z1, k));
  camera.lookAt(camera.position.x + look, camera.position.y, 0); camera.updateProjectionMatrix();
}
function look(p, tgt, fov) { camera.position.copy(p); camera.fov = fov; camera.updateProjectionMatrix(); camera.lookAt(tgt); }
function resetFx() {
  G.uFlash.value = 0; G.uFade.value = 0; G.uZoom.value = 0; G.uWhip.value = 0; G.uAberr.value = 0.0012; G.uSat.value = 1.08; G.uContrast.value = 1.06; G.uVig.value = 0.5; G.uGrain.value = 0.04;
  G.uTint.value.setRGB(1, 1, 1); G.uLift.value.setRGB(0, 0, 0); G.uCenter.value.set(0.5, 0.5); G.uFlashCol.value.setRGB(1, 1, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  bloom.strength = 0.8; bloom.radius = 0.5; bloom.threshold = 0.8;
}

const SHOTS = [
  // SAHNE 1 — KANCA
  [0, 2.7, (t, k) => {
    curScene = P1; renderer.toneMapping = THREE.NoToneMapping; bloom.strength = 0.55; bloom.threshold = 0.72; bloom.radius = 0.6;
    const e = easeIO(clamp(t / 2.7));
    photoCam(0.9, -0.3, 13.6, 1.25, -0.95, 7.6, e);
    camera.rotation.z = Math.sin(t * 0.7) * 0.01;
    P1.userData.mat.uniforms.uBright.value = 0.95 + 0.06 * Math.sin(t * 12.56) * Math.exp(-((t % 0.5) * 8));
    p1dust.material.uniforms.uTime.value = t;
    G.uFade.value = 1 - sstep(0, 0.45, t); G.uTint.value.setRGB(0.92, 1.0, 1.06); G.uVig.value = 0.6;
    G.uZoom.value = sstep(2.35, 2.7, t) * 0.12; G.uCenter.value.set(0.62, 0.55); G.uFlash.value = sstep(2.5, 2.7, t) * 0.9;
  }, (t) => {
    const a = sstep(0.3, 0.8, t) * (1 - sstep(2.4, 2.7, t));
    hudText('NEO-İSTANBUL · DOĞUMEVİ', 70, 150, 36, '#5ff6ff', 'left', a);
    hudText('09.11.2026 · 04:12', 70, 196, 30, '#5ff6ff', 'left', a * 0.8);
    hudText('♥ 128', 1010, 150, 40, '#ff5f8a', 'right', a);
    ecg(t, 330, a * 0.85);
    hudText('YAŞ: 0', 70, 250, 34, '#ffd23a', 'left', a);
  }],
  [2.7, 4.3, (t, k) => {
    curScene = K.scene; bloom.strength = 0.9; bloom.threshold = 0.85; renderer.toneMappingExposure = 0.85;
    const age = easeIO(clamp((t - 2.7) / 1.45));
    const s = lerp(0.42, 1, age);
    K.son.root.scale.setScalar(s); K.son.head.scale.setScalar(lerp(1.45, 1, age));
    pose(K.son, { walk: 0, phase: 0, pitch: -0.08, sad: 0, blink: 0, smile: 0.5 * (1 - age) });
    K.son.root.rotation.y = 0;
    const a = lerp(2.4, -0.4, easeOut(clamp((t - 2.7) / 1.6)));
    const h = lerp(0.75, 1.55, age), dist = lerp(2.0, 2.6, age);
    look(V(Math.sin(a) * dist, h, Math.cos(a) * dist), V(0, h * 0.92, 0), 45);
    K.dust.material.uniforms.uTime.value = t * 3; K.rings.forEach((r, i) => r.rotation.y = t * (i ? -1 : 1));
    G.uFlash.value = 1 - sstep(2.7, 2.95, t); G.uZoom.value = 0.22 * (1 - sstep(2.7, 4.1, t)); G.uAberr.value = 0.004 * (1 - sstep(2.7, 4.2, t)); G.uTint.value.setRGB(0.9, 1.02, 1.1);
    const pulse = Math.max(0, Math.sin((t - 2.7) * Math.PI * 6)); G.uFlash.value = Math.max(G.uFlash.value, pulse * 0.12 * (1 - age));
  }, (t) => {
    const age = Math.round(25 * easeIO(clamp((t - 2.75) / 1.4)));
    const yr = 2026 + age;
    hudText('YAŞ', 540, 190, 50, '#5ff6ff', 'center', 0.9);
    hudText(String(age), 540, 340, 230, '#ffd23a', 'center', 0.95);
    hudText(String(yr), 540, 490, 54, '#5ff6ff', 'center', 0.8);
  }],
  [4.3, 5.0, (t, k) => {
    curScene = K.scene; bloom.strength = 0.7; bloom.threshold = 0.9; renderer.toneMappingExposure = 0.85;
    K.son.root.scale.setScalar(1); K.son.head.scale.setScalar(1);
    pose(K.son, { pitch: -0.05, yaw: 0.0, blink: sstep(4.55, 4.62, t) * (1 - sstep(4.62, 4.7, t)) });
    const p = easeOut(k);
    look(V(lerp(0.7, 0.45, p), 1.7, lerp(2.3, 1.8, p)), V(0, 1.72, 0), 34);
    K.dust.material.uniforms.uTime.value = t * 3;
    G.uTint.value.setRGB(0.95, 1.02, 1.08); G.uWhip.value = sstep(4.85, 5.0, t) * 0.25;
  }, (t) => {
    hudText('YAŞ', 540, 190, 50, '#5ff6ff', 'center', 0.9);
    hudText('25', 540, 340, 230, '#ffd23a', 'center', 0.92);
    const k = sstep(4.35, 4.55, t);
    hudText('🔒 SABİT', 540, 490, 54, '#5ff6ff', 'center', k);
  }],
  // SAHNE 2 — DÜNYA DEĞİŞİYOR
  [5.0, 9.0, (t, k) => {
    curScene = P2; renderer.toneMapping = THREE.NoToneMapping; bloom.strength = 0.7; bloom.threshold = 0.62; bloom.radius = 0.55;
    const e = easeIO(k);
    photoCam(-0.6, 1.2, 13.8, 0.25, -0.2, 9.2, e, 0);
    camera.rotation.z = lerp(-0.04, 0.02, e);
    p2rain.material.uniforms.uTime.value = t; p2rain.material.uniforms.uCam.value.copy(camera.position).add(V(0, 0, -4));
    P2fly.forEach((g, i) => { const tt = (t - 5) * (0.6 + i * 0.15); g.position.set((i % 2 ? 1 : -1) * (3.5 - tt * 2.2), 1.2 + i * 0.9, 4.5 + i * 0.6); g.rotation.y = i % 2 ? 0 : Math.PI; });
    G.uWhip.value = -0.25 * (1 - sstep(5.0, 5.25, t)); G.uTint.value.setRGB(1.0, 0.96, 1.08); G.uSat.value = 1.15;
    G.uZoom.value = sstep(8.75, 9.0, t) * 0.15;
  }, (t) => {
    const a = sstep(5.4, 5.9, t) * (1 - sstep(8.8, 9.0, t));
    const k = clamp((t - 5) / 8); const n = 8.2 + easeIO(k) * 6.0;
    hudText('DÜNYA NÜFUSU', 70, 150, 32, '#5ff6ff', 'left', a);
    hudText(n.toFixed(3).replace('.', ',') + ' MİLYAR', 70, 205, 52, '#ffffff', 'left', a);
    hudText('ORT. ÖLÜM YAŞI: 100+', 70, 258, 28, '#ff5f8a', 'left', a * 0.9);
  }],
  [9.0, 13.0, (t, k) => {
    curScene = C.scene; cityMood('night'); animateCity(t); drawPop(t); bloom.strength = 0.95; bloom.threshold = 0.75; bloom.radius = 0.55;
    const e = easeIO(k);
    const p = V(lerp(-2.0, 3.5, e), lerp(38, 9, e), lerp(60, -150, e));
    look(p, V(lerp(-1, 1.5, e), lerp(30, 30, e), p.z - 80), 52);
    camera.rotation.z += Math.sin(t * 0.9) * 0.02 - 0.03 * (1 - e);
    G.uZoom.value = 0.15 * (1 - sstep(9.0, 9.3, t)) + sstep(12.75, 13.0, t) * 0.0; G.uWhip.value = sstep(12.8, 13.0, t) * 0.3;
    G.uTint.value.setRGB(1.0, 0.95, 1.08); G.uSat.value = 1.15;
  }, (t) => {
    const a = sstep(9.2, 9.6, t) * (1 - sstep(12.8, 13.0, t));
    const k = clamp((t - 5) / 8); const n = 8.2 + easeIO(k) * 6.0;
    hudText('DÜNYA NÜFUSU', 70, 150, 32, '#5ff6ff', 'left', a);
    hudText(n.toFixed(3).replace('.', ',') + ' MİLYAR', 70, 205, 52, '#ffffff', 'left', a);
    hudText('ORT. ÖLÜM YAŞI: 100+', 70, 258, 28, '#ff5f8a', 'left', a * 0.9);
  }],
  // SAHNE 3 — BEKLENMEYEN SONUÇ
  [13.0, 16.9, (t, k) => {
    roomCommon(t);
    const e = easeIO(k);
    look(V(lerp(13.0, 14.0, e), lerp(32.3, 31.9, e), lerp(-37.2, -38.4, e)), V(17, 31.3, -40.2), lerp(52, 44, e));
    G.uWhip.value = -0.3 * (1 - sstep(13.0, 13.25, t));
  }, (t) => {
    const a = sstep(13.6, 14.0, t);
    tag(V(16.9, 31.75, -40.85), 'ARDA', '90 YAŞINDA', '#5ff6ff', a);
    tag(V(16.9, 31.75, -39.25), 'EMRE · OĞLU', '25 YAŞINDA', '#ffd23a', sstep(14.1, 14.5, t));
  }],
  [16.9, 19.0, (t, k) => {
    roomCommon(t);
    const e = easeIO(k);
    C.holo.visible = !(t >= 16.9 && t < 17.9);
    if (t < 17.9) { const e1 = easeIO(clamp((t - 16.9) / 1.0)); look(V(lerp(12.5, 12.8, e1), lerp(31.75, 31.7, e1), lerp(-39.6, -39.8, e1)), V(17, 31.1, -40.05), lerp(48, 45, e1)); }
    else { const e2 = easeIO(clamp((t - 17.9) / 1.1)); look(V(lerp(15.0, 15.35, e2), lerp(31.3, 31.25, e2), lerp(-39.5, -39.35, e2)), V(16.9, lerp(31.15, 31.1, e2), -39.25), lerp(42, 34, e2)); }
  }, (t) => {
    stamp(V(16.9, 31.2, -40.85), 'KABUL', '#4bff7a', clamp((t - 17.2) / 0.5));
    stamp(V(16.9, 31.2, -39.25), 'RED', '#ff3b4b', clamp((t - 17.85) / 0.5));
  }],
  [19.0, 21.0, (t, k) => {
    roomCommon(t);
    const e = easeIO(k);
    look(V(lerp(13.2, 13.5, e), 32.2, lerp(-44.5, -44.0, e)), V(lerp(17.5, 19.5, e), 31.1, lerp(-39.5, -36.8, e)), 50);
  }, () => {}],
  [21.0, 22.8, (t, k) => {
    curScene = C.scene; cityMood('night'); animateCity(t); bloom.strength = 0.9; bloom.threshold = 0.75;
    sonStreet(t); placeFather(t);
    const sp = C.son.root.position;
    look(V(sp.x + 0.9, 1.7, sp.z + 4.6 - (t - 21) * 0.3), V(sp.x - 0.3, 1.1, sp.z - 6), 46);
    G.uTint.value.setRGB(0.95, 0.97, 1.1); G.uFlash.value = 0.5 * (1 - sstep(21.0, 21.15, t)); G.uFlashCol.value.setRGB(0.5, 0.9, 1);
  }, () => {}],
  [22.8, 25.0, (t, k) => {
    curScene = C.scene; cityMood('night'); animateCity(t); bloom.strength = 0.85; bloom.threshold = 0.75;
    sonStreet(t); placeFather(t);
    const sp = C.son.root.position;
    if (t < 23.9) { const e = easeIO(clamp((t - 22.8) / 1.1)); look(V(lerp(9.6, 10.3, e), lerp(31.75, 31.7, e), lerp(-35.6, -36.0, e)), V(12.75, 31.45, -37.0), lerp(36, 30, e)); }
    else { const e = easeIO(clamp((t - 23.9) / 1.1)); look(V(11.9, 31.4, -37.2), V(sp.x, 0.8, sp.z), lerp(30, 22, e)); }
    G.uTint.value.setRGB(0.92, 0.96, 1.1); G.uSat.value = 1.0; G.uVig.value = 0.6;
    G.uFade.value = sstep(24.75, 25.0, t) * 0.0; G.uFlash.value = sstep(24.7, 25.0, t) * 0.85; G.uFlashCol.value.setRGB(1.0, 0.75, 0.45);
  }, () => {}],
  // SAHNE 4 — FİNAL
  [25.0, 29.4, (t, k) => {
    curScene = P3; renderer.toneMapping = THREE.NoToneMapping; bloom.strength = 0.6; bloom.threshold = 0.66; bloom.radius = 0.6;
    const e = easeIO(k);
    photoCam(2.1, -0.9, 9.0, 0.2, 0.3, 12.4, e, 0);
    camera.rotation.z = lerp(0.02, -0.01, e);
    p3dust.material.uniforms.uTime.value = t; p3rain.material.uniforms.uTime.value = t; p3rain.material.uniforms.uCam.value.copy(camera.position).add(V(0, 0, -4));
    G.uFlash.value = 0.85 * (1 - sstep(25.0, 25.4, t)); G.uFlashCol.value.setRGB(1.0, 0.75, 0.45);
    G.uTint.value.setRGB(1.06, 0.98, 0.92); G.uSat.value = 1.1;
    G.uFlash.value = Math.max(G.uFlash.value, sstep(29.15, 29.4, t) * 0.6);
  }, () => {}],
  [29.4, 35.0, (t, k) => {
    curScene = C.scene; cityMood('sunset'); animateCity(t); bloom.strength = 0.85; bloom.threshold = 0.82; bloom.radius = 0.7;
    rooftop(t);
    const e = easeIO(clamp((t - 29.4) / 5.0));
    const p = V(lerp(15.6, 18, e), lerp(96.7, 175, e), lerp(-42.6, -10, e));
    const tg = V(lerp(15.6, 6, e), lerp(95.9, lerp(95, 150, e), e), lerp(-60, -300, e));
    look(p, tg, lerp(50, 62, e));
    G.uTint.value.setRGB(1.06, 0.97, 0.9); G.uSat.value = 1.12; G.uFlash.value = 0.6 * (1 - sstep(29.4, 29.7, t)); G.uFlashCol.value.setRGB(1.0, 0.8, 0.5);
    G.uLift.value.setRGB(0.012, 0.0, 0.01);
    G.uFade.value = sstep(32.2, 32.9, t) * 0.55 + sstep(34.65, 35.0, t) * 0.45;
  }, (t) => {
    if (t < 32.25) return;
    const a = sstep(32.25, 32.6, t);
    ctx.save(); ctx.globalAlpha = a;
    ctx.font = '800 76px Mont'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const lines = [['Bu dünya sence', '#ffffff', 0], ['CENNET mi', '#ffd23a', 0.25], ['olurdu,', '#ffffff', 0.45], ['CEHENNEM mi?', '#ff3b4b', 0.75]];
    lines.forEach(([s, c, d], i) => {
      const k = clamp((t - 32.3 - d) / 0.25); if (k <= 0) return;
      const size = i === 1 || i === 3 ? 112 : 70; ctx.font = `800 ${size}px Mont`;
      const y = 760 + i * 135 + (1 - easeOut(k)) * 30;
      ctx.globalAlpha = a * k; ctx.lineWidth = 12; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.strokeText(s, 540, y);
      ctx.shadowColor = c; ctx.shadowBlur = c === '#ffffff' ? 0 : 36; ctx.fillStyle = c; ctx.fillText(s, 540, y); ctx.shadowBlur = 0;
    });
    const k2 = clamp((t - 33.4) / 0.3);
    ctx.globalAlpha = a * k2; ctx.font = '600 44px Mont'; ctx.fillStyle = '#e8e8e8'; ctx.fillText('↓ Yorumlara yaz', 540, 1330);
    ctx.restore();
  }],
];

function roomCommon(t) {
  curScene = C.scene; cityMood('night'); animateCity(t); bloom.strength = 0.8; bloom.threshold = 0.78; bloom.radius = 0.5;
  G.uTint.value.setRGB(0.96, 0.98, 1.06); G.uVig.value = 0.55;
  const F = C.father, S = C.son;
  // baba oturuyor (z -40.85), oğul (z -39.25)
  F.root.position.set(16.95, 30, -40.85); F.root.rotation.y = -Math.PI / 2; F.root.scale.setScalar(1);
  const fatherTurn = sstep(19.3, 20.4, t);
  pose(F, { sit: 1, pitch: 0.02, yaw: -fatherTurn * 0.9, lookX: -fatherTurn * 0.3, blink: blinkAt(t, [14.6, 18.4, 21.3]), sad: 0.15 * fatherTurn });
  // oğul: oturur → kalkar → kapıya yürür
  const rise = sstep(19.15, 19.75, t);
  const sad = sstep(18.0, 18.5, t);
  if (t < 19.75) {
    S.root.position.set(16.95, 30, -39.25); S.root.rotation.y = -Math.PI / 2;
    pose(S, { sit: 1 - rise, pitch: 0.0 - 0.1 * sad, sad, blink: blinkAt(t, [15.3, 17.5]), lean: rise * 0.25 });
  } else {
    const wk = clamp((t - 19.75) / 1.25);
    const a = V(17.2, 30, -39.0), b = V(21.0, 30, -35.2);
    S.root.position.copy(vlerp(a, b, wk)); S.root.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
    pose(S, { walk: 1, phase: (t - 19.75) * 7.5, sad: 1, pitch: 0.35 });
  }
  C.holo.visible = true;
  C.door.position.z = -35 + sstep(20.4, 20.8, t) * 1.3;
  drawDecision(t, t > 17.85 ? 2 : t > 17.2 ? 1 : 0);
}
function blinkAt(t, ts) { let b = 0; for (const x of ts) b = Math.max(b, 1 - Math.abs(t - x) / 0.07); return clamp(b); }
function sonStreet(t) {
  const S = C.son; const tt = t - 21.0;
  const start = V(11.4, 0, -37.6);
  let p;
  if (tt < 0.9) p = vlerp(start, V(9.4, 0, -39.0), tt / 0.9);
  else p = V(9.4, 0, -39.0 - (tt - 0.9) * 1.35);
  S.root.position.copy(p); S.root.scale.setScalar(1);
  const dir = tt < 0.9 ? Math.atan2(-2, -1.4) : Math.PI;
  S.root.rotation.y = dir;
  pose(S, { walk: 1, phase: tt * 7.2, sad: 1, pitch: 0.38 });
}
function placeFather(t) {
  const F = C.father; F.root.position.set(12.75, 30, -37.0); F.root.rotation.y = -Math.PI / 2 - 0.25;
  pose(F, { pitch: 0.55, yaw: -0.15, sad: 0.65, lookY: 0.2 });
}
function rooftop(t) {
  const F = C.father, S = C.son;
  F.root.position.set(15.0, 95, -46.9); F.root.rotation.y = Math.PI; pose(F, { pitch: -0.08, sad: 0.2 });
  S.root.position.set(16.2, 95, -46.9); S.root.rotation.y = Math.PI; pose(S, { pitch: -0.05, sad: 0.4, yaw: sstep(30.5, 31.5, t) * 0.35 });
  F.neck.rotation.y = -sstep(30.8, 31.8, t) * 0.3;
}

// ---------- kare çizimi ----------
window.renderFrame = function (t) {
  resetFx();
  G.uTime.value = t;
  const shot = SHOTS.find(s => t >= s[0] && t < s[1]) || SHOTS[SHOTS.length - 1];
  camera.rotation.set(0, 0, 0); camera.up.set(0, 1, 0);
  const k = clamp((t - shot[0]) / (shot[1] - shot[0]));
  shot[2](t, k);
  renderPass.scene = curScene; renderPass.camera = camera;
  composer.render();
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(glCanvas, 0, 0, W, H);
  shot[3](t);
  for (const s of SUBS) drawSub(t, s);
  return out.toDataURL('image/jpeg', 0.94);
};

(async () => {
  await Promise.all([document.fonts.load('800 70px Mont'), document.fonts.load('600 40px Mont'), document.fonts.load('700 40px Osw'), document.fonts.load('800 70px Mont', 'şğıİçöü'), document.fonts.load('700 40px Osw', 'ŞĞİı')]);
  await Promise.all(pending);
  // tabelaları font yüklendikten sonra yeniden çiz
  C.scene.traverse(o => { if (o.material && o.material.map && o.material.map._draw) { const m = o.material.map; const c = m.image; m._ctx.clearRect(0, 0, c.width, c.height); m._draw(m._ctx, c.width, c.height); m.needsUpdate = true; } });
  window.renderFrame(0.01); window.renderFrame(9.5); window.renderFrame(30);
  window.READY = true;
})();
