// "YA ÖLÜMDEN SONRA BAŞKA BİR GERÇEKLİKTE UYANIYORSAK?" — 40 sn, 1080x1920, 30 FPS
// Tek akış, tam ekran; görüntüde yalnızca hikâyenin parçası olan isim plakası yazısı var.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { makeHuman, pose, setAge } from './human.js';
import { rng, clamp, lerp, sstep, easeIO, easeOut, V, vlerp, canvasTex, M, mesh, pending } from './city.js';

const W = 1080, H = 1920;
const RS = parseFloat(new URLSearchParams(location.search).get('scale') || '1');
const TAU = Math.PI * 2;

// ---------------- renderer / post ----------------
const glCanvas = document.createElement('canvas'); glCanvas.id = 'gl'; document.body.appendChild(glCanvas);
const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(Math.round(W * RS), Math.round(H * RS), false);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const camera = new THREE.PerspectiveCamera(40, W / H, 0.02, 6000);
const composer = new EffectComposer(renderer); composer.setPixelRatio(1); composer.setSize(Math.round(W * RS), Math.round(H * RS));
const renderPass = new RenderPass(new THREE.Scene(), camera);
const bokeh = new BokehPass(new THREE.Scene(), camera, { focus: 3, aperture: 0.004, maxblur: 0.008 });
const bloom = new UnrealBloomPass(new THREE.Vector2(W * RS, H * RS), 0.8, 0.6, 0.82);
const grade = new ShaderPass({
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uFlash: { value: 0 }, uFlashCol: { value: new THREE.Color(1, 1, 1) },
    uFade: { value: 0 }, uZoom: { value: 0 }, uWhip: { value: 0 }, uAberr: { value: 0.0012 }, uSat: { value: 1.05 },
    uContrast: { value: 1.08 }, uVig: { value: 0.5 }, uGrain: { value: 0.04 }, uTint: { value: new THREE.Color(1, 1, 1) },
    uCenter: { value: new THREE.Vector2(0.5, 0.5) }, uLift: { value: new THREE.Color(0, 0, 0) }, uWarp: { value: 0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime,uFlash,uFade,uZoom,uWhip,uAberr,uSat,uContrast,uVig,uGrain,uWarp;
    uniform vec3 uTint,uFlashCol,uLift; uniform vec2 uCenter; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
    vec3 tap(vec2 uv, vec2 d){ return vec3(texture2D(tDiffuse,uv+d*uAberr).r, texture2D(tDiffuse,uv).g, texture2D(tDiffuse,uv-d*uAberr).b); }
    void main(){
      vec2 uv=vUv; vec2 d=uv-uCenter;
      if(uWarp>0.0){ float r=length(d); float a=uWarp*(1.0-smoothstep(0.0,0.7,r))*3.0; float c=cos(a), s=sin(a); uv=uCenter+mat2(c,-s,s,c)*d; d=uv-uCenter; }
      vec3 col;
      if(uZoom+abs(uWhip)>0.0005){ col=vec3(0.0); for(int i=0;i<16;i++){ float k=float(i)/15.0; col+=tap(uv-d*uZoom*k+vec2(uWhip*(k-0.5),0.0),d);} col/=16.0; }
      else col=tap(uv,d);
      col=(col-0.5)*uContrast+0.5; float l=dot(col,vec3(0.299,0.587,0.114));
      col=mix(vec3(l),col,uSat)*uTint+uLift;
      float v=smoothstep(0.95,0.25,length(d*vec2(0.85,1.0))); col*=mix(1.0-uVig,1.0,v);
      col+=(hash(uv*vec2(1080.0,1920.0)+fract(uTime*7.31))-0.5)*uGrain;
      col=mix(col,uFlashCol,uFlash); col*=1.0-uFade;
      gl_FragColor=vec4(clamp(col,0.0,1.0),1.0);
    }`,
});
composer.addPass(renderPass); composer.addPass(bokeh); composer.addPass(bloom); composer.addPass(new OutputPass()); composer.addPass(grade);
const G = grade.uniforms;

// ---------------- ortak shader parçaları ----------------
const NOISE = `
  float h31(vec3 p){ return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
  float n3(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(mix(mix(h31(i),h31(i+vec3(1,0,0)),f.x),mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x),mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x),f.y),f.z); }
  float fbm(vec3 p){ float a=0.5,s=0.0; for(int i=0;i<5;i++){ s+=a*n3(p); p*=2.03; a*=0.5; } return s; }`;

const SPRITE = canvasTex(64, 64, (x) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); });

// Galaksi (sarmal kollar, diferansiyel dönüş)
function galaxy(count, radius, arms, cIn, cOut, seed, px = 2.2) {
  const r = rng(seed); const g = new THREE.BufferGeometry();
  const aR = new Float32Array(count), aA = new Float32Array(count), aH = new Float32Array(count), aC = new Float32Array(count * 3), aS = new Float32Array(count);
  const ci = new THREE.Color(cIn), co = new THREE.Color(cOut), c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const rr = Math.pow(r(), 1.6); const arm = i % arms;
    const gj = () => (r() + r() + r() - 1.5);
    aR[i] = rr; aA[i] = arm / arms * TAU + rr * 5.5 + gj() * (0.35 * (1 - rr) + 0.12); aH[i] = gj() * 0.05 * (1 - rr * 0.7);
    c.copy(ci).lerp(co, Math.min(1, rr * 1.3)); if (r() < 0.06) c.setRGB(1, 0.5, 0.8);
    aC.set([c.r, c.g, c.b], i * 3); aS[i] = 0.4 + r() * r() * 2.2 + (rr < 0.08 ? 2 : 0);
  }
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute('aR', new THREE.BufferAttribute(aR, 1)); g.setAttribute('aA', new THREE.BufferAttribute(aA, 1)); g.setAttribute('aH', new THREE.BufferAttribute(aH, 1));
  g.setAttribute('aC', new THREE.BufferAttribute(aC, 3)); g.setAttribute('aS', new THREE.BufferAttribute(aS, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uRad: { value: radius }, uPx: { value: px * RS }, uB: { value: 1 }, map: { value: SPRITE } },
    vertexShader: `attribute float aR,aA,aH,aS; attribute vec3 aC; uniform float uTime,uRad,uPx; varying vec3 vC;
      void main(){ float a=aA+uTime*0.6/(0.25+aR); vec3 p=vec3(cos(a)*aR*uRad, aH*uRad, sin(a)*aR*uRad);
        vec4 mv=modelViewMatrix*vec4(p,1.0); gl_Position=projectionMatrix*mv; gl_PointSize=clamp(uPx*aS*(60.0/-mv.z),1.0,24.0); vC=aC; }`,
    fragmentShader: `uniform sampler2D map; uniform float uB; varying vec3 vC; void main(){ float a=texture2D(map,gl_PointCoord).a; gl_FragColor=vec4(vC*uB*1.8, a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false;
  const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: SPRITE, color: new THREE.Color(cIn).multiplyScalar(2.5), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  core.scale.setScalar(radius * 0.45); pts.add(core); pts.userData.core = core;
  return pts;
}
function fresnel(color, power, intensity, side = THREE.FrontSide) {
  return new THREE.ShaderMaterial({
    uniforms: { uC: { value: new THREE.Color(color) }, uP: { value: power }, uI: { value: intensity } },
    vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uC; uniform float uP,uI; varying vec3 vN; varying vec3 vV; void main(){ float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),uP); gl_FragColor=vec4(uC*f*uI, f); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side,
  });
}
function motes(count, box, color, px, seed, rise = 0.02) {
  const r = rng(seed); const g = new THREE.BufferGeometry(); const p = new Float32Array(count * 3), s = new Float32Array(count);
  for (let i = 0; i < count; i++) { p.set([r(), r(), r()], i * 3); s[i] = r(); }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aS', new THREE.BufferAttribute(s, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uMin: { value: box[0] }, uSize: { value: box[1] }, uCol: { value: new THREE.Color(color) }, uPx: { value: px * RS }, map: { value: SPRITE }, uRise: { value: rise } },
    vertexShader: `uniform float uTime,uPx,uRise; uniform vec3 uMin,uSize; attribute float aS; varying float vA;
      void main(){ vec3 q=position; q.y=fract(q.y+uTime*uRise*(0.5+aS)); q.x=fract(q.x+sin(uTime*0.3+aS*20.0)*0.01);
        vec4 mv=modelViewMatrix*vec4(uMin+q*uSize,1.0); gl_Position=projectionMatrix*mv; gl_PointSize=uPx*(0.4+aS)*(10.0/-mv.z); vA=0.4+0.6*fract(aS*7.0+uTime*0.2); }`,
    fragmentShader: `uniform sampler2D map; uniform vec3 uCol; varying float vA; void main(){ gl_FragColor=vec4(uCol*1.6, texture2D(map,gl_PointCoord).a*vA); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; return pts;
}

// ---------------- KARAKTERLER ----------------
// DENİZ: 34 yaşında, koyu kısa saç, açık mavi-yeşil hasta önlüğü, çıplak bacaklar, gri çorap
const DENIZ_O = { skin: 0xd2a07e, eye: 0x4a3626, hair: 0x231710, hairStyle: 'messy', browColor: 0x1e130d, face: { child: 0, jaw: 0.88, nose: 1.05, cheek: 1.05, brow: 1.1, lip: 0.95 } };
const DENIZ = makeHuman({ ...DENIZ_O, top: 0x86aeb8, pants: 0xd2a07e, shoes: 0xb9bcc0, gown: true });

// ---------------- SAHNE: HASTANE ----------------
function buildHospital() {
  const s = new THREE.Scene(); s.background = new THREE.Color(0x020406); s.fog = new THREE.FogExp2(0x03070a, 0.09);
  const floor = mesh(new THREE.PlaneGeometry(12, 12).rotateX(-Math.PI / 2), M(0x0b1014, 0.3, 0.2)); floor.receiveShadow = true; s.add(floor);
  s.add(mesh(new THREE.PlaneGeometry(12, 4), M(0x121a20, 0.85), 0, 2, -2.6));
  // yatak
  const bedM = new THREE.MeshPhysicalMaterial({ color: 0xc9d0d4, roughness: 0.4, clearcoat: 0.4 });
  s.add(mesh(new THREE.BoxGeometry(1.0, 0.45, 2.1), bedM, 0, 0.3, 0));
  const mattress = mesh(new THREE.BoxGeometry(0.92, 0.16, 2.0), new THREE.MeshPhysicalMaterial({ color: 0xdde3e6, roughness: 0.9, sheen: 0.6 }), 0, 0.6, 0); mattress.receiveShadow = true; s.add(mattress);
  const pillow = mesh(new THREE.CapsuleGeometry(0.12, 0.45, 6, 16).rotateZ(Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0xe8ecee, roughness: 0.95, sheen: 0.6 }), 0, 0.72, -0.82); pillow.scale.z = 1.6; s.add(pillow);
  // battaniye (vücudu göğse kadar örter)
  const bg = new THREE.BoxGeometry(0.98, 0.16, 1.45, 12, 2, 16); const bp = bg.attributes.position;
  for (let i = 0; i < bp.count; i++) { const x = bp.getX(i), y = bp.getY(i), z = bp.getZ(i); if (y > 0) bp.setY(i, y + 0.04 * Math.cos(x * 6) * Math.cos(z * 3) + 0.05 * Math.exp(-(x * x) / 0.05)); if (Math.abs(x) > 0.45) bp.setY(i, bp.getY(i) - 0.12); }
  bg.computeVertexNormals();
  const blanket = mesh(bg, new THREE.MeshPhysicalMaterial({ color: 0x7f9aa6, roughness: 0.95, sheen: 0.8, sheenColor: new THREE.Color(0xb8d4e0) }), 0, 0.76, 0.3); s.add(blanket);
  // Deniz yatakta (sırt üstü; başı -z yönünde)
  // monitör
  const monTex = canvasTex(512, 320, () => {});
  const mon = mesh(new THREE.PlaneGeometry(0.5, 0.31), new THREE.MeshBasicMaterial({ map: monTex, color: new THREE.Color(1.4, 1.4, 1.4) }), -0.85, 1.45, -0.95); mon.rotation.y = 0.6; s.add(mon);
  const monBox = mesh(new THREE.BoxGeometry(0.56, 0.36, 0.06), M(0x0c0f12, 0.4, 0.4), 0, 0, -0.035); mon.add(monBox);
  s.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.4, 8), M(0x8a9098, 0.3, 0.9), -0.95, 0.7, -1.1));
  // serum
  const iv = mesh(new THREE.CapsuleGeometry(0.06, 0.16, 4, 12), new THREE.MeshPhysicalMaterial({ color: 0xcfe8f0, transparent: true, opacity: 0.5, roughness: 0.1 }), 0.75, 1.85, -0.7); s.add(iv);
  s.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 2, 6), M(0x9aa0a8, 0.3, 0.9), 0.75, 1.0, -0.7));
  // pencere: perdeden sızan soğuk ışık
  const blinds = new THREE.Group(); s.add(blinds);
  for (let k = 0; k < 14; k++) blinds.add(mesh(new THREE.BoxGeometry(1.6, 0.03, 0.02), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 0.55, 0.8) }), 1.4, 1.2 + k * 0.1, -2.58));
  s.add(new THREE.HemisphereLight(0x5f86ad, 0x05080a, 0.35));
  const key = new THREE.SpotLight(0x9fc4ff, 4, 7, 0.45, 0.8, 1.4); key.position.set(1.6, 2.8, -1.8); key.target.position.set(0, 0.7, -0.6); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0004; s.add(key, key.target);
  const monLight = new THREE.PointLight(0x57ffa0, 1.2, 2.5, 1.6); monLight.position.set(-0.7, 1.45, -0.8); s.add(monLight);
  return { s, monTex, monLight, blanket };
}
function drawMonitor(t, flat) {
  const x = HOS.monTex._ctx, w = 512, h = 320; x.fillStyle = '#020806'; x.fillRect(0, 0, w, h);
  const col = '#57ffa0'; x.strokeStyle = col; x.lineWidth = 4; x.shadowColor = col; x.shadowBlur = 12; x.beginPath();
  for (let px = 10; px < w - 10; px += 2) {
    const tt = t - (w - px) / 280; const per = 0.85; const ph = ((tt % per) + per) % per / per;
    let v = 0; if (ph > 0.1 && ph < 0.13) v = -12; else if (ph >= 0.13 && ph < 0.17) v = 95; else if (ph >= 0.17 && ph < 0.2) v = -30; else if (ph > 0.35 && ph < 0.45) v = Math.sin((ph - 0.35) / 0.1 * Math.PI) * 14;
    if (tt > flat) v = 0;
    if (px === 10) x.moveTo(px, 170 - v); else x.lineTo(px, 170 - v);
  }
  x.stroke(); x.shadowBlur = 0;
  // ikinci kanal (soluk)
  x.strokeStyle = 'rgba(80,200,255,0.5)'; x.lineWidth = 2; x.beginPath();
  for (let px = 10; px < w - 10; px += 3) { const tt = t - (w - px) / 280; const v = tt > flat ? 0 : Math.sin(tt * 5) * 8; if (px === 10) x.moveTo(px, 260 - v); else x.lineTo(px, 260 - v); }
  x.stroke(); HOS.monTex.needsUpdate = true;
}

// ---------------- SAHNE: EŞİK (kozmik boyut) ----------------
function planetTex(seed, cols, bands) {
  return canvasTex(1024, 512, (x, w, h) => {
    const r = rng(seed); const g = x.createLinearGradient(0, 0, 0, h);
    for (let k = 0; k <= bands; k++) g.addColorStop(k / bands, cols[Math.floor(r() * cols.length)]);
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 1600; i++) { const y = r() * h, len = 30 + r() * 300, th = 1 + r() * 5; x.globalAlpha = 0.08 + r() * 0.15; x.fillStyle = cols[Math.floor(r() * cols.length)]; x.fillRect(r() * w, y, len, th); }
    for (let i = 0; i < 40; i++) { const cx = r() * w, cy = r() * h, rad = 3 + r() * 26; x.globalAlpha = 0.25; x.fillStyle = r() < 0.5 ? '#000' : '#fff'; x.beginPath(); x.ellipse(cx, cy, rad * 1.8, rad, 0, 0, 7); x.fill(); }
    x.globalAlpha = 1;
  });
}
function buildEsik() {
  const s = new THREE.Scene(); s.fog = new THREE.FogExp2(0x0a1424, 0.0045);
  const r = rng(404);
  // gökyüzü: derin lacivert + turkuaz/eflatun nebula + yıldızlar
  const skyU = { uTime: { value: 0 } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(4000, 64, 32), new THREE.ShaderMaterial({
    uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vD; void main(){ vD=position; vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position=p.xyww; }`,
    fragmentShader: NOISE + `uniform float uTime; varying vec3 vD;
      void main(){ vec3 d=normalize(vD);
        vec3 c=mix(vec3(0.012,0.02,0.05), vec3(0.03,0.07,0.11), smoothstep(-0.3,0.4,d.y));
        float n=fbm(d*2.2+vec3(0.0,uTime*0.01,0.0)); float n2=fbm(d*4.5+vec3(5.0));
        c+=vec3(0.05,0.28,0.32)*pow(smoothstep(0.45,0.85,n),2.0)*0.9;
        c+=vec3(0.35,0.08,0.3)*pow(smoothstep(0.55,0.9,n2),2.0)*0.6;
        c+=vec3(0.9,0.55,0.25)*pow(smoothstep(0.7,0.95,n*n2*1.6),3.0)*0.5;
        float st=step(0.9975,h31(floor(d*700.0))); c+=vec3(st)*(0.6+0.4*sin(uTime*3.0+h31(floor(d*700.0))*40.0));
        float st2=step(0.9993,h31(floor(d*260.0)+3.0)); c+=vec3(0.8,0.9,1.0)*st2*1.5;
        gl_FragColor=vec4(c,1.0);
        #include <colorspace_fragment>
      }`,
  }));
  sky.frustumCulled = false; s.add(sky);
  // zemin: koyu cam, eş merkezli dalgalar
  const floorU = { uTime: { value: 0 }, uFog: { value: new THREE.Color(0x0a1424) } };
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
    uniforms: floorU,
    vertexShader: `varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: NOISE + `uniform float uTime; uniform vec3 uFog; varying vec3 vW;
      void main(){ float d=length(vW.xz); vec3 c=vec3(0.01,0.018,0.03);
        float ring=smoothstep(0.06,0.0,abs(fract(d*0.12-uTime*0.25)-0.5))*exp(-d*0.012);
        c+=vec3(0.15,0.7,0.8)*ring*0.35;
        vec2 g=abs(fract(vW.xz/4.0)-0.5); float grid=smoothstep(0.012,0.0,min(g.x,g.y))*exp(-d*0.01);
        c+=vec3(0.2,0.5,0.7)*grid*0.12;
        c+=vec3(0.9,0.6,0.3)*0.05*exp(-length(vW.xz-vec2(0.0,-120.0))*0.02);
        float cd=length(vW-cameraPosition); float f=1.0-exp(-pow(cd*0.0045,1.3)); c=mix(c,uFog,f);
        gl_FragColor=vec4(c,1.0);
        #include <colorspace_fragment>
      }`,
  }));
  floor.receiveShadow = false; s.add(floor);
  const shadowCatch = new THREE.Mesh(new THREE.PlaneGeometry(60, 60).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: 0.55 })); shadowCatch.position.y = 0.005; shadowCatch.receiveShadow = true; s.add(shadowCatch);

  // ---- devasa kapı (ışıklı) ----
  const gateU = { uTime: { value: 0 }, uOpen: { value: 0 } };
  const gate = new THREE.Group(); gate.position.set(0, 0, -150); s.add(gate);
  const stoneM = new THREE.MeshStandardMaterial({ color: 0x1a1f2a, roughness: 0.7, metalness: 0.3 });
  gate.add(mesh(new THREE.BoxGeometry(14, 260, 14), stoneM, -42, 130, 0), mesh(new THREE.BoxGeometry(14, 260, 14), stoneM, 42, 130, 0), mesh(new THREE.BoxGeometry(100, 14, 16), stoneM, 0, 262, 0));
  const leafMat = new THREE.ShaderMaterial({
    uniforms: gateU,
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform float uTime; varying vec2 vUv;
      float h(vec2 p){ vec3 p3=fract(vec3(p.xyx)*0.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
      void main(){ vec3 c=vec3(0.025,0.03,0.045);
        vec2 g=vUv*vec2(180.0,620.0); vec2 cell=floor(g); vec2 f=fract(g)-0.5;
        float hh=h(cell); float lit=step(0.9,hh);
        float tw=0.5+0.5*sin(uTime*(1.5+hh*6.0)+hh*60.0); tw=pow(tw,3.0);
        float dotm=smoothstep(0.32,0.0,length(f));
        vec3 lc=mix(vec3(1.0,0.72,0.38),vec3(0.55,0.9,1.0),step(0.85,h(cell+7.0)));
        c+=lc*dotm*lit*tw*1.6*(0.35+0.6*vUv.y*(1.0-vUv.y)*3.0);
        // dev desen: halkalar
        float rr=length((vUv-vec2(0.5,0.45))*vec2(1.0,3.4)); c+=vec3(1.0,0.75,0.4)*smoothstep(0.015,0.0,abs(fract(rr*6.0-uTime*0.05)-0.5))*0.35;
        float seam=smoothstep(0.004,0.0,abs(vUv.x-0.5)); c+=vec3(1.0,0.85,0.6)*seam*1.6;
        gl_FragColor=vec4(c,1.0);
        #include <colorspace_fragment>
      }`,
  });
  const leaf = mesh(new THREE.PlaneGeometry(70, 250), leafMat, 0, 125, 0.5); leaf.castShadow = false; gate.add(leaf);
  const gateGlow = new THREE.PointLight(0xffb070, 160, 400, 1.3); gateGlow.position.set(0, 60, -120); s.add(gateGlow);

  // ---- yüzen, ters dönen gezegenler ----
  const planets = [];
  const pdefs = [
    [V(-160, 220, -420), 90, ['#2a4b6b', '#5a8fb0', '#a8d0e0', '#1a2a40', '#d9c7a0'], 0x6fd0ff, 0.3],
    [V(140, 90, -260), 34, ['#5a2a1a', '#a0522d', '#e0a060', '#3a1a10'], 0xffa060, 0.0],
    [V(60, 300, -200), 55, ['#3a1a4a', '#7a3a8a', '#c080c0', '#1a0a2a'], 0xd080ff, 0.6],
    [V(-70, 55, -90), 12, ['#203030', '#406060', '#90b0a0'], 0x80ffe0, 0.0],
    [V(30, 40, -70), 5, ['#806040', '#c0a080', '#403020'], 0xffd0a0, 0.0],
  ];
  pdefs.forEach(([pos, rad, cols, atm, ring], i) => {
    const g = new THREE.Group(); g.position.copy(pos); s.add(g);
    const p = mesh(new THREE.SphereGeometry(rad, 64, 32), new THREE.MeshStandardMaterial({ map: planetTex(50 + i, cols, 9), roughness: 0.9, metalness: 0 })); p.castShadow = false; g.add(p);
    const at = mesh(new THREE.SphereGeometry(rad * 1.06, 48, 24), fresnel(atm, 2.5, 1.6)); at.castShadow = false; g.add(at);
    if (ring) { const rg = mesh(new THREE.RingGeometry(rad * 1.4, rad * 2.2, 96), new THREE.MeshBasicMaterial({ color: new THREE.Color(atm).multiplyScalar(0.6), transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false })); rg.rotation.x = Math.PI / 2.3; g.add(rg); }
    g.rotation.set(r() * 3, r() * 3, Math.PI * (0.6 + r() * 0.6)); // ters
    planets.push(g);
  });

  // ---- ters dönen bina adaları ----
  const winTex = canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#000'; x.fillRect(0, 0, w, h); const rr = rng(9); for (let j = 0; j < 8; j++) for (let i = 0; i < 6; i++) if (rr() < 0.55) { x.fillStyle = rr() < 0.7 ? '#ffcf8a' : '#9fe3ff'; x.fillRect(8 + i * 41, 8 + j * 31, 26, 18); } });
  winTex.wrapS = winTex.wrapT = THREE.RepeatWrapping;
  const islands = [];
  const idefs = [[V(-45, 70, -110), 1.0], [V(55, 120, -160), 1.4], [V(-20, 160, -60), 0.7], [V(90, 40, -90), 0.8]];
  idefs.forEach(([pos, sc], k) => {
    const isl = new THREE.Group(); isl.position.copy(pos); isl.scale.setScalar(sc); s.add(isl);
    const rg = new THREE.DodecahedronGeometry(14, 3); const rp = rg.attributes.position;
    for (let i = 0; i < rp.count; i++) { const v = V(rp.getX(i), rp.getY(i), rp.getZ(i)); const n = 1 + 0.25 * Math.sin(v.x * 0.5 + k) * Math.cos(v.z * 0.4); v.multiplyScalar(n); if (v.y > 0) v.y *= 0.25; else v.y *= 1.4; rp.setXYZ(i, v.x, v.y, v.z); }
    rg.computeVertexNormals();
    isl.add(mesh(rg, new THREE.MeshStandardMaterial({ color: 0x2a2620, roughness: 0.95, flatShading: true })));
    const nb = 7 + Math.floor(r() * 6);
    for (let b = 0; b < nb; b++) {
      const bw = 2 + r() * 4, bh = 6 + r() * 26, bd = 2 + r() * 4;
      const geo = new THREE.BoxGeometry(bw, bh, bd); const uv = geo.attributes.uv; const nrm = geo.attributes.normal;
      for (let i = 0; i < uv.count; i++) { const sx = Math.abs(nrm.getX(i)) > 0.5 ? bd : bw; uv.setXY(i, uv.getX(i) * sx / 3, uv.getY(i) * bh / 3); }
      const bm = mesh(geo, new THREE.MeshStandardMaterial({ color: 0x3a4250, roughness: 0.5, metalness: 0.4, emissive: 0xffffff, emissiveMap: winTex, emissiveIntensity: 1.3 }), (r() - 0.5) * 18, 3 + bh / 2, (r() - 0.5) * 18);
      bm.castShadow = false; isl.add(bm);
    }
    isl.rotation.set(Math.PI + (r() - 0.5) * 0.6, r() * 3, (r() - 0.5) * 0.6); // baş aşağı
    islands.push(isl);
  });

  // ---- içinde galaksi dönen dev saatler ----
  const clocks = [];
  const cdefs = [[V(0, 175, -175), 48, 0.12], [V(-75, 95, -130), 20, -0.35], [V(70, 150, -240), 30, 0.2], [V(-28, 28, -55), 7, 0.6]];
  cdefs.forEach(([pos, rad, spd], k) => {
    const c = new THREE.Group(); c.position.copy(pos); s.add(c);
    const brass = new THREE.MeshStandardMaterial({ color: 0xc8a060, roughness: 0.28, metalness: 1.0, emissive: 0x2a1a08 });
    c.add(mesh(new THREE.TorusGeometry(rad, rad * 0.05, 16, 128), brass));
    c.add(mesh(new THREE.TorusGeometry(rad * 0.9, rad * 0.012, 8, 128), brass));
    const face = mesh(new THREE.CircleGeometry(rad * 0.97, 96), new THREE.MeshPhysicalMaterial({ color: 0x050a14, roughness: 0.1, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide })); face.position.z = -rad * 0.02; c.add(face);
    const gx = galaxy(5000, rad * 0.82, 3, 0xffe2b0, k % 2 ? 0xd070ff : 0x50e0ff, 70 + k, 2.4); gx.rotation.x = Math.PI / 2; c.add(gx);
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; const tk = mesh(new THREE.BoxGeometry(rad * 0.025, rad * (i % 3 ? 0.06 : 0.12), rad * 0.02), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.6, 0.9) }), Math.sin(a) * rad * 0.84, Math.cos(a) * rad * 0.84, rad * 0.01); tk.rotation.z = -a; c.add(tk); }
    const hands = [];
    for (const [len, wd] of [[0.55, 0.03], [0.8, 0.018], [0.9, 0.006]]) { const hg = new THREE.Group(); c.add(hg); hg.position.z = rad * 0.03; const hm = mesh(new THREE.BoxGeometry(rad * wd, rad * len, rad * 0.01), brass, 0, rad * len * 0.45, 0); hg.add(hm); hands.push(hg); }
    c.userData = { spd, hands, gx, tilt: V(r() * 0.8 - 0.4, r() * 0.8 - 0.4, r() * 0.6) };
    clocks.push(c);
  });

  // ---- sonsuz merdivenler ----
  const marble = new THREE.MeshStandardMaterial({ color: 0xcfc8bc, roughness: 0.45, metalness: 0.05 });
  const stepGeo = new THREE.BoxGeometry(2.6, 0.22, 0.75);
  const stairs = [];
  // a) sarmal merdiven (sağda)
  const NS = 1400; const sp = new THREE.InstancedMesh(stepGeo, marble, NS); const m4 = new THREE.Matrix4(); const q = new THREE.Quaternion();
  for (let i = 0; i < NS; i++) { const a = i * 0.16; q.setFromAxisAngle(V(0, 1, 0), -a); m4.compose(V(38 + Math.cos(a) * 7, i * 0.24, -60 + Math.sin(a) * 7), q, V(1, 1, 1)); sp.setMatrixAt(i, m4); }
  sp.castShadow = false; s.add(sp); stairs.push(sp);
  // b) gökyüzüne uzanan düz merdiven (solda, kapıya doğru)
  const NL = 900; const sl = new THREE.InstancedMesh(stepGeo, marble, NL);
  for (let i = 0; i < NL; i++) { const z = -18 - i * 0.6; m4.compose(V(-14 - i * 0.05, 0.11 + i * 0.32, z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), 0.08), V(1.3, 1, 1)); sl.setMatrixAt(i, m4); }
  sl.castShadow = false; s.add(sl); stairs.push(sl);
  // c) baş aşağı asılı merdiven (yukarıdan sarkan)
  const NU = 500; const su = new THREE.InstancedMesh(stepGeo, marble, NU);
  for (let i = 0; i < NU; i++) { const a = i * 0.12; q.setFromAxisAngle(V(0, 1, 0), a); m4.compose(V(-60 + Math.cos(a) * 10, 230 - i * 0.3, -170 + Math.sin(a) * 10), q, V(1, 1, 1)); su.setMatrixAt(i, m4); }
  s.add(su);
  const stepGlow = new THREE.InstancedMesh(new THREE.BoxGeometry(2.6, 0.02, 0.04), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 1.8, 2.2) }), NL);
  for (let i = 0; i < NL; i++) { const z = -18 - i * 0.6 + 0.37; m4.compose(V(-14 - i * 0.05, 0.0 + i * 0.32, z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), 0.08), V(1.3, 1, 1)); stepGlow.setMatrixAt(i, m4); }
  s.add(stepGlow);

  // ---- ışık ve atmosfer ----
  const hemi = new THREE.HemisphereLight(0x4f8fc0, 0x140c18, 0.55); s.add(hemi);
  const key = new THREE.DirectionalLight(0xffc890, 2.2); key.position.set(10, 30, -60); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004;
  const kc = key.shadow.camera; kc.left = -10; kc.right = 10; kc.top = 10; kc.bottom = -10; kc.near = 1; kc.far = 120; s.add(key, key.target);
  const rim = new THREE.DirectionalLight(0x60d8ff, 1.6); rim.position.set(-20, 12, 30); s.add(rim);
  const mo = motes(1400, [V(-40, 0, -80), V(80, 40, 100)], 0xbfe8ff, 1.0, 88, 0.012); s.add(mo);
  return { s, skyU, floorU, gateU, gate, planets, islands, clocks, hemi, key, rim, mo, gateGlow };
}

// ---------------- VARLIKLAR (insan dışı) ----------------
function glassMat(c) { return new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.05, metalness: 0.0, transparent: true, opacity: 0.22, clearcoat: 1, clearcoatRoughness: 0.05, depthWrite: false, side: THREE.DoubleSide, emissive: c, emissiveIntensity: 0.15 }); }
function edgeLines(geo, color, op = 0.9) { return new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), new THREE.LineBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.2), transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false })); }
function makeBeing(type, seed) {
  const r = rng(seed); const g = new THREE.Group(); const parts = {};
  const hue = [0x8fe8ff, 0xffc8f0, 0xc8ffd8, 0xffe0a0][Math.floor(r() * 4)];
  if (type === 0) { // şeffaf uzun figür
    const hgt = 2.6 + r() * 0.8;
    const bodyG = new THREE.CapsuleGeometry(0.22, hgt * 0.45, 6, 18); const body = mesh(bodyG, glassMat(hue), 0, hgt * 0.55, 0); body.scale.z = 0.6; body.castShadow = false; g.add(body); body.add(edgeLines(bodyG, hue, 0.25));
    const headG = new THREE.IcosahedronGeometry(0.22, 0); const head = mesh(headG, glassMat(hue), 0, hgt * 0.98, 0); head.scale.y = 1.4; head.castShadow = false; g.add(head); head.add(edgeLines(headG, hue)); parts.head = head;
    const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: SPRITE, color: new THREE.Color(hue).multiplyScalar(2.5), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); core.scale.setScalar(0.5); core.position.y = hgt * 0.62; g.add(core);
    parts.legs = [];
    for (const sx of [-1, 1]) { const lg = new THREE.Group(); lg.position.set(sx * 0.1, hgt * 0.36, 0); g.add(lg); const lm = mesh(new THREE.CylinderGeometry(0.035, 0.015, hgt * 0.36, 8), glassMat(hue), 0, -hgt * 0.18, 0); lm.castShadow = false; lg.add(lm); parts.legs.push(lg); }
    parts.walk = 1;
  } else if (type === 1) { // dönen geometrik kule
    const shapes = [new THREE.OctahedronGeometry(0.35), new THREE.TorusGeometry(0.3, 0.06, 8, 24), new THREE.BoxGeometry(0.4, 0.4, 0.4), new THREE.TetrahedronGeometry(0.38), new THREE.IcosahedronGeometry(0.3, 0)];
    parts.spin = [];
    for (let k = 0; k < 4; k++) { const geo = shapes[Math.floor(r() * shapes.length)]; const sm = mesh(geo, new THREE.MeshStandardMaterial({ color: 0x0c0f16, roughness: 0.2, metalness: 0.9, emissive: hue, emissiveIntensity: 0.12 }), 0, 0.6 + k * 0.62, 0); sm.castShadow = true; sm.add(edgeLines(geo, hue, 0.8)); g.add(sm); parts.spin.push(sm); }
    parts.walk = 0;
  } else { // yörüngeli ışık halkası
    parts.orb = [];
    const ring = mesh(new THREE.TorusGeometry(0.5, 0.012, 8, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(hue).multiplyScalar(2) }), 0, 1.6, 0); g.add(ring); parts.ring = ring;
    for (let k = 0; k < 7; k++) { const o = mesh(new THREE.SphereGeometry(0.06, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(hue).multiplyScalar(2.5) })); g.add(o); parts.orb.push(o); }
    const veil = mesh(new THREE.ConeGeometry(0.45, 1.6, 24, 1, true), glassMat(hue), 0, 0.8, 0); veil.castShadow = false; g.add(veil);
    parts.walk = 0;
  }
  g.userData = { type, parts, seed: r() * 10 };
  return g;
}
function animBeing(b, t) {
  const { type, parts, seed } = b.userData;
  if (type === 0) { const ph = t * 4 + seed; parts.legs[0].rotation.x = Math.sin(ph) * 0.4; parts.legs[1].rotation.x = -Math.sin(ph) * 0.4; parts.head.rotation.y = Math.sin(t * 0.7 + seed) * 0.5; }
  else if (type === 1) parts.spin.forEach((m, k) => { m.rotation.set(t * (0.6 + k * 0.3) + seed, t * (0.9 - k * 0.2), 0); m.position.y = 0.6 + k * 0.62 + Math.sin(t * 2 + k + seed) * 0.08; });
  else { parts.ring.rotation.set(t + seed, t * 0.7, 0); parts.orb.forEach((o, k) => { const a = t * 2 + k / 7 * TAU + seed; o.position.set(Math.cos(a) * 0.55, 1.6 + Math.sin(a * 1.3) * 0.25, Math.sin(a) * 0.55); }); }
}

// ---------------- GÖREVLİ (galaksi kafalı) ----------------
function makeClerk() {
  const root = new THREE.Group();
  const robeM = new THREE.MeshPhysicalMaterial({ color: 0x0b0d18, roughness: 0.6, sheen: 1, sheenColor: new THREE.Color(0x4060a0), sheenRoughness: 0.4, emissive: 0x0a1030, emissiveIntensity: 0.4 });
  const robe = mesh(new THREE.LatheGeometry([[0, 0], [0.62, 0.02], [0.5, 0.5], [0.36, 1.2], [0.3, 1.7], [0.34, 2.05], [0.2, 2.2], [0.08, 2.28], [0, 2.3]].map(([a, b]) => new THREE.Vector2(a, b)), 64), robeM);
  robe.scale.z = 0.7; root.add(robe);
  // cüppe içinde yıldız tozu
  const st = motes(220, [V(-0.4, 0.1, -0.25), V(0.8, 2.0, 0.5)], 0x8fb8ff, 0.5, 501, 0.03); root.add(st);
  // omuz yakası (pirinç halka)
  const collar = mesh(new THREE.TorusGeometry(0.26, 0.025, 10, 48), new THREE.MeshStandardMaterial({ color: 0xc8a060, roughness: 0.25, metalness: 1 }), 0, 2.22, 0); collar.rotation.x = Math.PI / 2; root.add(collar);
  // kollar (ince, uzun) + ışıklı eller
  const arms = [];
  for (const sx of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(sx * 0.36, 2.02, 0); root.add(sh);
    sh.add(mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.75, 12), robeM, 0, -0.37, 0));
    const el = new THREE.Group(); el.position.y = -0.75; sh.add(el);
    el.add(mesh(new THREE.CylinderGeometry(0.05, 0.03, 0.7, 12), robeM, 0, -0.35, 0));
    const hand = new THREE.Group(); hand.position.y = -0.72; el.add(hand);
    const hm = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.9, 2.4) });
    for (let f = 0; f < 4; f++) { const fg = mesh(new THREE.CylinderGeometry(0.008, 0.004, 0.22, 6), hm, (f - 1.5) * 0.025, -0.11, 0); fg.rotation.z = (f - 1.5) * 0.12; hand.add(fg); }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: SPRITE, color: new THREE.Color(0.6, 0.9, 1.6), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); glow.scale.setScalar(0.35); hand.add(glow);
    sh.rotation.z = sx * 0.08; el.rotation.x = -0.25;
    arms.push({ sh, el, hand, glow });
  }
  // kafa: cam küre içinde dönen galaksi
  const head = new THREE.Group(); head.position.y = 2.72; root.add(head);
  const gx = galaxy(5000, 0.42, 2, 0xfff0d0, 0x60c8ff, 909, 0.12); gx.userData.core.scale.setScalar(0.12); gx.userData.core.material.color.setRGB(1.2, 1.1, 0.9); gx.material.uniforms.uB.value = 0.6; gx.rotation.set(1.15, 0, 0.3); head.add(gx);
  const bubble = mesh(new THREE.SphereGeometry(0.47, 48, 32), fresnel(0x7fd8ff, 2.6, 0.8)); bubble.castShadow = false; head.add(bubble);
  // "gülümseme": yay biçimli parlak yıldızlar
  const smG = new THREE.BufferGeometry(); const sp = []; for (let i = 0; i < 160; i++) { const a = Math.PI * (0.18 + 0.64 * i / 159); sp.push(Math.cos(a) * 0.24, -Math.sin(a) * 0.12 - 0.04, 0.4 + Math.sin(a) * 0.02); }
  smG.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const smile = new THREE.Points(smG, new THREE.PointsMaterial({ size: 0.02, map: SPRITE, color: new THREE.Color(1.6, 1.3, 0.9), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); head.add(smile);
  // iki "göz": parlak yıldız kümeleri
  const eyes = [];
  for (const sx of [-1, 1]) { const e = new THREE.Sprite(new THREE.SpriteMaterial({ map: SPRITE, color: new THREE.Color(2.5, 2.2, 1.6), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); e.scale.setScalar(0.08); e.material.color.setRGB(1.6, 1.4, 1.0); e.position.set(sx * 0.13, 0.06, 0.38); head.add(e); eyes.push(e); }
  root.traverse(o => { if (o.isMesh && o.material !== bubble.material) o.castShadow = true; });
  return { root, head, gx, bubble, smile, eyes, arms };
}

// ---------------- MASA ----------------
function makeDesk() {
  const d = new THREE.Group();
  const top = mesh(new THREE.BoxGeometry(2.4, 0.12, 1.0), new THREE.MeshPhysicalMaterial({ color: 0x14161c, roughness: 0.15, metalness: 0.3, clearcoat: 1 }), 0, 0, 0); d.add(top);
  const edge = mesh(new THREE.BoxGeometry(2.42, 0.02, 1.02), new THREE.MeshStandardMaterial({ color: 0xc8a060, roughness: 0.25, metalness: 1 }), 0, 0.07, 0); d.add(edge);
  const under = new THREE.Sprite(new THREE.SpriteMaterial({ map: SPRITE, color: new THREE.Color(0.3, 0.8, 1.2), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); under.scale.set(3, 0.8, 1); under.position.y = -0.4; d.add(under);
  // minik gezegen sistemi
  const sys = new THREE.Group(); sys.position.set(-0.45, 0.42, 0); d.add(sys);
  const sun = mesh(new THREE.SphereGeometry(0.07, 24, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.2, 1.2) })); sys.add(sun);
  const orbs = [];
  [[0.16, 0.022, 0x7fc8ff], [0.26, 0.03, 0xffa070], [0.36, 0.018, 0xc0ffd0], [0.48, 0.04, 0xd8a0ff]].forEach(([rad, sz, c], k) => {
    const ring = mesh(new THREE.RingGeometry(rad - 0.002, rad + 0.002, 96), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(0.6), side: THREE.DoubleSide, transparent: true, opacity: 0.4 })); ring.rotation.x = -Math.PI / 2; sys.add(ring);
    const p = mesh(new THREE.SphereGeometry(sz, 20, 14), new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, emissive: c, emissiveIntensity: 0.25 })); sys.add(p); orbs.push({ p, rad, sp: 1.8 / (k + 1) });
  });
  // havada duran ışık sayfaları
  const pages = [];
  for (let k = 0; k < 3; k++) { const pg = mesh(new THREE.PlaneGeometry(0.28, 0.38), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 0.85, 1.1), transparent: true, opacity: 0.35, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }), 0.45 + k * 0.22, 0.3 + k * 0.06, 0.05); pg.rotation.set(-0.7, 0.2 * k, 0.1); d.add(pg); pages.push(pg); }
  const deskLight = new THREE.PointLight(0xffd8a0, 3, 4, 1.5); deskLight.position.set(-0.45, 0.45, 0.1); d.add(deskLight);
  return { d, sys, orbs, pages };
}

// ---------------- ANI EKRANI (render target) ----------------
const memRT = new THREE.WebGLRenderTarget(960, 540, { samples: 4 }); memRT.texture.colorSpace = THREE.SRGBColorSpace;
function buildMemory() {
  const s = new THREE.Scene(); const sky = { top: new THREE.Color(), hor: new THREE.Color() };
  s.background = new THREE.Color(0xf0b070); s.fog = new THREE.Fog(0xf0b070, 20, 90);
  const ground = mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x6a7a3a, roughness: 1 })); ground.receiveShadow = false; s.add(ground);
  const trees = new THREE.Group(); s.add(trees); const r = rng(77);
  for (let i = 0; i < 40; i++) { const x = (r() - 0.5) * 60, z = -8 - r() * 50; const tr = mesh(new THREE.ConeGeometry(1 + r(), 3 + r() * 4, 10), new THREE.MeshStandardMaterial({ color: 0x2f4a2a, roughness: 1 }), x, 2, z); tr.castShadow = false; trees.add(tr); }
  const hemi = new THREE.HemisphereLight(0xffe0b0, 0x404020, 1.1); s.add(hemi);
  const sun = new THREE.DirectionalLight(0xffb070, 2.5); sun.position.set(-10, 8, -20); s.add(sun);
  const fill = new THREE.DirectionalLight(0xa0c0ff, 0.6); fill.position.set(5, 5, 10); s.add(fill);
  const snow = motes(900, [V(-8, 0, -6), V(16, 8, 12)], 0xffffff, 1.6, 31, -0.08); s.add(snow);
  // aynı Deniz'in farklı halleri
  const kid = makeHuman({ ...DENIZ_O, top: 0xd04a3a, pants: 0x2a3550, shoes: 0xf0f0f0, morphChild: true });
  const dad = makeHuman({ skin: 0xc8946e, eye: 0x3a2a1a, hair: 0x3a2a1e, hairStyle: 'neat', browColor: 0x2a1a10, face: { child: 0, jaw: 0.92, nose: 1.1, cheek: 1.0, brow: 1.2, lip: 0.9 }, top: 0x5a6a5a, pants: 0x2a2a30, shoes: 0x3a2a20 });
  const mom = makeHuman({ skin: 0xdcae8e, eye: 0x4a3020, hair: 0x5a3020, hairStyle: 'messy', browColor: 0x3a2010, face: { child: 0, jaw: 0.8, nose: 0.85, cheek: 1.05, brow: 0.7, lip: 1.15 }, top: 0xa03040, pants: 0x30303a, shoes: 0x202020, coat: true });
  const adult = makeHuman({ ...DENIZ_O, top: 0x3a5a7a, pants: 0x2a2a30, shoes: 0x202020 });
  const child2 = makeHuman({ skin: 0xd8a888, eye: 0x4a3626, hair: 0x2a1a10, hairStyle: 'messy', browColor: 0x1e130d, face: { child: 0, jaw: 0.88, nose: 1.0, cheek: 1.0, brow: 1.0, lip: 1.0 }, top: 0xf0c040, pants: 0x3a4a6a, shoes: 0xffffff, morphChild: true });
  const old = makeHuman({ ...DENIZ_O, hair: 0xd8d6d2, browColor: 0xc8c4be, hairStyle: 'neat', top: 0x4a3a30, pants: 0x2a2620, shoes: 0x1a1410, coat: true });
  const bench = new THREE.Group(); bench.add(mesh(new THREE.BoxGeometry(1.6, 0.06, 0.45), M(0x5a3a22, 0.8), 0, 0.46, 0)); bench.add(mesh(new THREE.BoxGeometry(1.6, 0.4, 0.05), M(0x5a3a22, 0.8), 0, 0.7, -0.2)); s.add(bench);
  [kid, dad, mom, adult, child2, old].forEach(h => s.add(h.root));
  const cam = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 300);
  return { s, cam, kid, dad, mom, adult, child2, old, bench, hemi, sun, snow, ground, trees };
}
function renderMemory(t) {
  const Mm = MEM; const k = t - 24.6; // 0..3.4
  for (const h of [Mm.kid, Mm.dad, Mm.mom, Mm.adult, Mm.child2, Mm.old]) h.root.visible = false; Mm.bench.visible = false; Mm.snow.visible = false;
  let v = k < 1.15 ? 0 : k < 2.3 ? 1 : 2;
  if (v === 0) { // çocukluk: anne-babayla gün batımına yürüyüş
    Mm.s.background.set(0xf2a868); Mm.s.fog.color.set(0xf2a868); Mm.ground.material.color.set(0x7a7a3a); Mm.hemi.color.set(0xffd8a0); Mm.sun.intensity = 2.5;
    const z = -k * 1.1;
    Mm.kid.root.visible = Mm.dad.root.visible = Mm.mom.root.visible = true;
    setAge(Mm.kid, 6); Mm.kid.root.position.set(0, 0, z); Mm.kid.root.rotation.y = Math.PI; pose(Mm.kid, { walk: 1, phase: k * 8.5, t, child: Mm.kid.childK, reach: 0 });
    Mm.dad.root.position.set(-0.55, 0, z + 0.05); Mm.dad.root.rotation.y = Math.PI; pose(Mm.dad, { walk: 1, phase: k * 6.5 + 1, t });
    Mm.mom.root.position.set(0.55, 0, z + 0.05); Mm.mom.root.rotation.y = Math.PI; pose(Mm.mom, { walk: 1, phase: k * 6.5 + 2.5, t });
    Mm.cam.position.set(0.6, 1.2, z + 3.6); Mm.cam.lookAt(0, 0.9, z - 2);
  } else if (v === 1) { // aile: kendi çocuğunu kucaklamak üzere eğilir
    const kk = k - 1.15;
    Mm.s.background.set(0xb8d0e8); Mm.s.fog.color.set(0xb8d0e8); Mm.ground.material.color.set(0x5a8a4a); Mm.hemi.color.set(0xf0f4ff); Mm.sun.intensity = 1.6;
    Mm.adult.root.visible = Mm.child2.root.visible = true;
    Mm.adult.root.position.set(0, 0, 0); Mm.adult.root.rotation.y = 0.4; pose(Mm.adult, { t, reach: sstep(0, 0.6, kk), lean: 0.15, talk: 0.6, pitch: 0.25 });
    setAge(Mm.child2, 5); Mm.child2.root.position.set(0.45, 0, 1.0 - kk * 0.5); Mm.child2.root.rotation.y = Math.PI + 0.4; pose(Mm.child2, { walk: 1, phase: kk * 9, t, child: Mm.child2.childK, pitch: -0.2 });
    Mm.cam.position.set(2.4, 1.3, 2.4); Mm.cam.lookAt(0.2, 0.8, 0.4);
  } else { // hiç yaşanmamış ihtimal: kar altında yaşlı Deniz
    const kk = k - 2.3;
    Mm.s.background.set(0x8a96a8); Mm.s.fog.color.set(0x8a96a8); Mm.ground.material.color.set(0xd8dde4); Mm.hemi.color.set(0xd0dcf0); Mm.sun.intensity = 0.6; Mm.snow.visible = true; Mm.snow.material.uniforms.uTime.value = t;
    Mm.old.root.visible = true; Mm.bench.visible = true; Mm.bench.position.set(0, 0, 0);
    Mm.old.root.position.set(0, 0, 0.05); Mm.old.root.rotation.y = 0; pose(Mm.old, { sit: 1, t, pitch: 0.2, sad: 0.6, lean: 0.2 });
    Mm.cam.position.set(-1.4 + kk * 0.2, 1.1, 3.0 - kk * 0.3); Mm.cam.lookAt(0, 0.9, 0);
  }
  renderer.setRenderTarget(memRT); renderer.render(Mm.s, Mm.cam); renderer.setRenderTarget(null);
}

// ---------------- KAPILAR (binlerce evren) ----------------
function buildDoors() {
  const g = new THREE.Group(); const N = 2600; const r = rng(2024);
  const panelGeo = new THREE.PlaneGeometry(1.4, 2.8); panelGeo.translate(0, 1.4, 0);
  const seeds = new Float32Array(N); for (let i = 0; i < N; i++) seeds[i] = r();
  panelGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
  const pU = { uTime: { value: 0 } };
  const panels = new THREE.InstancedMesh(panelGeo, new THREE.ShaderMaterial({
    uniforms: pU, side: THREE.DoubleSide,
    vertexShader: `attribute float aSeed; varying vec2 vUv; varying float vS; void main(){ vUv=uv; vS=aSeed; gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0); }`,
    fragmentShader: NOISE + `uniform float uTime; varying vec2 vUv; varying float vS;
      void main(){ vec2 p=vUv*vec2(1.0,2.0); float t=uTime*0.3; vec3 c; float k=floor(vS*6.0);
        if(k<1.0){ float n=fbm(vec3(p*2.5,t+vS*10.0)); c=mix(vec3(0.1,0.0,0.25),vec3(0.2,0.9,1.0),n)*1.4; }
        else if(k<2.0){ c=vec3(0.95,0.85,0.7)*(0.7+0.3*fbm(vec3(p*4.0,t))); }
        else if(k<3.0){ float w=sin(p.y*14.0+fbm(vec3(p*3.0,t))*6.0); c=mix(vec3(0.0,0.15,0.35),vec3(0.3,0.7,0.9),0.5+0.5*w); }
        else if(k<4.0){ float d=fbm(vec3(p.x*3.0,p.y*1.2,vS*5.0)); c=mix(vec3(0.6,0.3,0.1),vec3(1.2,0.75,0.35),smoothstep(0.3,0.7,d)); if(p.y>1.3) c=vec3(1.0,0.6,0.3); }
        else if(k<5.0){ c=vec3(0.01,0.01,0.03); float st=step(0.985,h31(vec3(floor(p*60.0),vS))); c+=vec3(st)*2.0; c+=vec3(0.8,0.3,0.6)*pow(fbm(vec3(p*2.0,vS)),3.0); }
        else { float n=fbm(vec3(p*3.0,t*2.0+vS)); c=mix(vec3(0.1,0.4,0.1),vec3(0.6,1.0,0.4),n); }
        float edge=smoothstep(0.0,0.08,vUv.x)*smoothstep(1.0,0.92,vUv.x)*smoothstep(0.0,0.04,vUv.y)*smoothstep(1.0,0.96,vUv.y);
        gl_FragColor=vec4(c*mix(1.3,0.85,edge),1.0);
        #include <colorspace_fragment>
      }`,
  }), N);
  const frameGeo = new THREE.BoxGeometry(1.7, 3.05, 0.18); frameGeo.translate(0, 1.42, -0.1);
  const frames = new THREE.InstancedMesh(frameGeo, new THREE.MeshStandardMaterial({ color: 0x1c1a18, roughness: 0.35, metalness: 0.8, emissive: 0x3a2610, emissiveIntensity: 0.4 }), N);
  const data = [];
  for (let i = 0; i < N; i++) {
    // kişinin etrafında küresel kabuk + helezon
    const u = r(), v = r(); const th = u * TAU; const ph = Math.acos(2 * v - 1);
    const rad = 14 + Math.pow(r(), 0.7) * 260;
    let p = V(Math.sin(ph) * Math.cos(th) * rad, Math.cos(ph) * rad * 0.55 + rad * 0.25, Math.sin(ph) * Math.sin(th) * rad);
    p.add(V(3, 0, -10));
    if (p.y < 0.5 && rad < 40) p.y = 0;
    const face = Math.atan2(3 - p.x, -10 - p.z);
    data.push({ p, face, tilt: (r() - 0.5) * (p.y > 1 ? 0.6 : 0), roll: (r() - 0.5) * (p.y > 1 ? 0.6 : 0), dist: rad, s: 1 + rad / 120, bob: r() * 6 });
  }
  panels.frustumCulled = frames.frustumCulled = false; frames.castShadow = false;
  g.add(frames, panels);
  return { g, panels, frames, data, pU };
}
function animDoors(t, appearT) {
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  D.data.forEach((d, i) => {
    const a = clamp((appearT - d.dist / 110) / 0.6); const s = easeOut(a) * d.s;
    e.set(d.tilt, d.face, d.roll); q.setFromEuler(e);
    const pos = d.p.clone(); if (d.p.y > 1) pos.y += Math.sin(t * 0.5 + d.bob) * 0.6;
    m4.compose(pos, q, V(s || 1e-4, s || 1e-4, s || 1e-4)); D.panels.setMatrixAt(i, m4); D.frames.setMatrixAt(i, m4);
  });
  D.panels.instanceMatrix.needsUpdate = D.frames.instanceMatrix.needsUpdate = true; D.pU.uTime.value = t;
}
// adının yazdığı kapı
function makeNameDoor() {
  const g = new THREE.Group();
  const bronze = new THREE.MeshStandardMaterial({ color: 0x3a2c1c, roughness: 0.3, metalness: 0.9 });
  g.add(mesh(new THREE.BoxGeometry(0.16, 3.2, 0.25), bronze, -0.86, 1.6, 0), mesh(new THREE.BoxGeometry(0.16, 3.2, 0.25), bronze, 0.86, 1.6, 0), mesh(new THREE.BoxGeometry(1.88, 0.18, 0.25), bronze, 0, 3.2, 0));
  const panelU = { uTime: { value: 0 } };
  const panel = mesh(new THREE.PlaneGeometry(1.56, 3.1), new THREE.ShaderMaterial({ uniforms: panelU,
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: NOISE + `uniform float uTime; varying vec2 vUv; void main(){ float n=fbm(vec3(vUv*vec2(2.0,4.0),uTime*0.2)); vec3 c=mix(vec3(0.55,0.28,0.1),vec3(0.95,0.75,0.5),n); c*=0.8+0.35*smoothstep(0.6,0.0,abs(vUv.x-0.5)); gl_FragColor=vec4(c,1.0);
      #include <colorspace_fragment>
    }` }), 0, 1.55, 0.02);
  panel.castShadow = false; g.add(panel);
  // isim plakası (hikâyenin parçası; temiz, doğru yazılmış)
  const plateTex = canvasTex(512, 128, (x, w, h) => {
    const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#e2c27a'); gr.addColorStop(0.5, '#b8924a'); gr.addColorStop(1, '#8a6a30'); x.fillStyle = gr; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#5a4018'; x.lineWidth = 6; x.strokeRect(8, 8, w - 16, h - 16);
    x.font = '700 82px Osw'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = 'rgba(255,240,200,0.5)'; x.fillText('DENİZ', w / 2 + 2, h / 2 + 6); x.fillStyle = '#2a1a08'; x.fillText('DENİZ', w / 2, h / 2 + 4);
  });
  const plate = mesh(new THREE.BoxGeometry(0.62, 0.155, 0.02), [M(0x8a6a30, 0.3, 1), M(0x8a6a30, 0.3, 1), M(0x8a6a30, 0.3, 1), M(0x8a6a30, 0.3, 1), new THREE.MeshStandardMaterial({ map: plateTex, roughness: 0.3, metalness: 0.85 }), M(0x8a6a30, 0.3, 1)], 0, 2.55, 0.08);
  g.add(plate);
  const handle = mesh(new THREE.SphereGeometry(0.05, 16, 12), new THREE.MeshStandardMaterial({ color: 0xd8b060, roughness: 0.2, metalness: 1 }), 0.55, 1.05, 0.08); g.add(handle);
  const spill = new THREE.PointLight(0xffb060, 0.7, 5, 2.0); spill.position.set(0, 1.6, 0.15); g.add(spill);
  const fl = mesh(new THREE.PlaneGeometry(2.4, 3.4).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.55, 0.2), transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false }), 0, 0.01, 1.4); g.add(fl);
  return { g, panelU, plateTex, plate, handle };
}

// ---------------- KURULUM ----------------
const HOS = buildHospital();
const E = buildEsik();
const CLERK = makeClerk();
const DESK = makeDesk();
const MEM = buildMemory();
const D = buildDoors(); E.s.add(D.g); D.g.visible = false;
const ND = makeNameDoor(); E.s.add(ND.g);
// sahne yerleşimi
const DESK_POS = V(3.5, 1.05, -13.0), CLERK_POS = V(3.5, 0, -14.1), DZ_DESK = V(3.0, 0, -10.6), NAMEDOOR = V(2.6, 0, -4.6);
E.s.add(DESK.d, CLERK.root); DESK.d.position.copy(DESK_POS); CLERK.root.position.copy(CLERK_POS);
ND.g.position.copy(NAMEDOOR); ND.g.rotation.y = Math.PI; // kapı -z yönüne (Deniz'e) bakar
// ekran
const screenU = { map: { value: memRT.texture }, uTime: { value: 0 }, uOn: { value: 0 }, uGlitch: { value: 0 } };
const screen = mesh(new THREE.PlaneGeometry(7.2, 4.05), new THREE.ShaderMaterial({
  uniforms: screenU, transparent: true, depthWrite: false, side: THREE.DoubleSide,
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `uniform sampler2D map; uniform float uTime,uOn,uGlitch; varying vec2 vUv;
    float h(float x){ return fract(sin(x*91.7)*43758.5); }
    void main(){ vec2 uv=vUv; float band=floor(uv.y*40.0); float gl=uGlitch*step(0.7,h(band+floor(uTime*20.0)));
      uv.x+=gl*(h(band*3.1)-0.5)*0.15;
      vec3 c=vec3(texture2D(map,uv+vec2(0.004*uGlitch,0.0)).r, texture2D(map,uv).g, texture2D(map,uv-vec2(0.004*uGlitch,0.0)).b);
      c*=0.92+0.08*sin(uv.y*900.0); c=mix(c,c*vec3(0.85,1.0,1.15),0.3);
      float reveal=smoothstep(0.0,0.15,uOn*1.2-abs(vUv.y-0.5)*2.0);
      float edge=smoothstep(0.0,0.015,vUv.x)*smoothstep(1.0,0.985,vUv.x)*smoothstep(0.0,0.025,vUv.y)*smoothstep(1.0,0.975,vUv.y);
      c=mix(vec3(0.5,1.2,1.6),c*1.25,edge);
      gl_FragColor=vec4(c, reveal*uOn);
      #include <colorspace_fragment>
    }`,
}), 3.1, 3.9, -15.2);
screen.castShadow = false; E.s.add(screen);
const screenLight = new THREE.PointLight(0xa0d0ff, 0, 10, 1.4); screenLight.position.set(3.1, 3.2, -13); E.s.add(screenLight);
// varlıklar
const BEINGS = [];
{ const r = rng(33); for (let i = 0; i < 26; i++) { const b = makeBeing(i % 3, 100 + i); const lane = -19 - r() * 28; b.userData.path = { z: lane, x0: (r() - 0.5) * 60, v: (r() < 0.5 ? 1 : -1) * (0.6 + r() * 0.9), sc: 1.2 + r() * 0.7 }; b.scale.setScalar(b.userData.path.sc); E.s.add(b); BEINGS.push(b); } }
const flareLight = new THREE.PointLight(0x9fe0ff, 0, 12, 1.3); E.s.add(flareLight);

// ---------------- yardımcılar ----------------
let cur = null;
function place(h, parent, x, y, z, ry) { if (h.root.parent !== parent) parent.add(h.root); h.root.position.set(x, y, z); h.root.rotation.set(0, ry, 0); h.root.visible = true; }
function look(p, tgt, fov) { camera.position.copy(p); camera.fov = fov; camera.updateProjectionMatrix(); camera.lookAt(tgt); }
function shake(t, a) { camera.rotation.z += Math.sin(t * 1.3) * a + Math.sin(t * 3.1) * a * 0.4; camera.position.y += Math.sin(t * 2.1) * a * 0.6; }
function dof(on, focus, ap = 0.004, mb = 0.008) { bokeh.enabled = on; bokeh.uniforms.focus.value = focus; bokeh.uniforms.aperture.value = ap; bokeh.uniforms.maxblur.value = mb; }
function resetFx() {
  G.uFlash.value = 0; G.uFade.value = 0; G.uZoom.value = 0; G.uWhip.value = 0; G.uWarp.value = 0; G.uAberr.value = 0.0012; G.uSat.value = 1.06; G.uContrast.value = 1.08; G.uVig.value = 0.5; G.uGrain.value = 0.04;
  G.uTint.value.setRGB(1, 1, 1); G.uLift.value.setRGB(0, 0, 0); G.uCenter.value.set(0.5, 0.5); G.uFlashCol.value.setRGB(1, 1, 1);
  renderer.toneMappingExposure = 1.0; bloom.strength = 0.7; bloom.radius = 0.6; bloom.threshold = 0.9; dof(false, 3);
  flareLight.intensity = 0; screenLight.intensity = 0;
}
function ots(from, to, dist, side, camY, faceY, fov) {
  const d = V(from.x - to.x, 0, from.z - to.z).normalize(); const pr = V(d.z, 0, -d.x);
  look(V(from.x + d.x * dist + pr.x * side, camY, from.z + d.z * dist + pr.z * side), V(to.x, faceY, to.z), fov);
}
function animWorld(t) {
  E.skyU.uTime.value = t; E.floorU.uTime.value = t; E.gateU.uTime.value = t; E.mo.material.uniforms.uTime.value = t;
  E.planets.forEach((p, i) => { p.rotation.y += 0; p.children[0].rotation.y = t * 0.05 * (i % 2 ? 1 : -1); p.rotation.z = Math.PI * 0.8 + Math.sin(t * 0.05 + i) * 0.3 + t * 0.01 * (i + 1); p.position.y += 0; });
  E.islands.forEach((isl, i) => { isl.rotation.y = t * 0.04 * (i % 2 ? 1 : -1) + i; isl.rotation.x = Math.PI + Math.sin(t * 0.2 + i) * 0.15; });
  E.clocks.forEach((c, i) => {
    const u = c.userData; c.rotation.set(u.tilt.x + Math.sin(t * 0.07 + i) * 0.2, u.tilt.y + t * 0.03 * (i % 2 ? 1 : -1), u.tilt.z + t * u.spd * 0.2);
    u.hands[0].rotation.z = -t * u.spd * 0.5; u.hands[1].rotation.z = -t * u.spd * 3 + i; u.hands[2].rotation.z = t * u.spd * 14 * (i % 2 ? -1 : 1);
    u.gx.material.uniforms.uTime.value = t * (0.6 + i * 0.2);
  });
  BEINGS.forEach((b, i) => { const p = b.userData.path; const x = ((p.x0 + t * p.v + 40) % 80 + 80) % 80 - 40; b.position.set(x, b.userData.type === 0 ? 0 : 0.2 + Math.sin(t + i) * 0.1, p.z); b.rotation.y = p.v > 0 ? Math.PI / 2 : -Math.PI / 2; animBeing(b, t); });
  // görevli & masa
  DESK.d.position.y = DESK_POS.y + Math.sin(t * 1.1) * 0.05; DESK.d.rotation.z = Math.sin(t * 0.7) * 0.015;
  DESK.orbs.forEach((o, k) => { const a = t * o.sp + k * 2; o.p.position.set(Math.cos(a) * o.rad, Math.sin(a * 0.3) * 0.02, Math.sin(a) * o.rad); });
  DESK.pages.forEach((pg, k) => { pg.position.y = 0.3 + k * 0.06 + Math.sin(t * 1.5 + k) * 0.03; });
  CLERK.gx.material.uniforms.uTime.value = t * 1.4; CLERK.root.position.y = CLERK_POS.y + Math.sin(t * 0.9) * 0.03;
  CLERK.head.rotation.y = 0; CLERK.smile.material.opacity = 0;
  E.key.target.position.copy(DENIZ.root.position); E.key.position.copy(DENIZ.root.position).add(V(8, 22, -30));
  ND.panelU.uTime.value = t;
}
function clerkTalk(t, on) { const pulse = on ? 0.75 + 0.5 * Math.max(0, Math.sin(t * 15) * Math.sin(t * 6.3)) : 1; CLERK.gx.material.uniforms.uB.value = pulse * 0.6; CLERK.eyes.forEach(e => e.material.opacity = on ? 0.8 + 0.2 * pulse : 0.9); }
function clerkArm(raise) { const a = CLERK.arms[1]; a.sh.rotation.set(-raise * 1.9, 0, 0.08 + raise * 0.25); a.el.rotation.x = -0.25 - raise * 0.4; a.glow.scale.setScalar(0.35 + raise * 0.6); }

// ---------------- ÇEKİM LİSTESİ ----------------
const SHOTS = [
  // ===== SAHNE 1 — KANCA =====
  [0.0, 1.6, (t, k) => { // monitör: çizgi düzleşiyor
    cur = HOS.s; renderer.toneMappingExposure = 1.0; bloom.threshold = 0.75; bloom.strength = 0.75;
    drawMonitor(t, 0.95); HOS.monLight.intensity = 1.2 + (t < 0.95 ? 0.4 * Math.max(0, Math.sin(t * 7.4)) : 0);
    hospitalDeniz(t);
    const e = easeIO(k);
    look(V(lerp(-0.25, -0.35, e), lerp(1.5, 1.48, e), lerp(-0.35, -0.5, e)), V(-0.85, 1.45, -0.95), lerp(30, 24, e));
    dof(true, 0.7, 0.005, 0.01); G.uFade.value = 1 - sstep(0, 0.35, t); G.uTint.value.setRGB(0.9, 1.0, 1.05);
  }],
  [1.6, 2.75, (t, k) => { // gözlere yaklaş
    cur = HOS.s; renderer.toneMappingExposure = 0.9; bloom.threshold = 0.9;
    drawMonitor(t, 0.95); hospitalDeniz(t);
    const e = easeIO(k); const hp = headPos();
    camera.position.set(hp.x + lerp(0.05, 0.02, e), hp.y + lerp(0.55, 0.3, e), hp.z + lerp(0.12, 0.05, e)); camera.up.set(0, 0, -1); camera.fov = lerp(30, 22, e); camera.updateProjectionMatrix(); camera.lookAt(hp.x, hp.y + 0.02, hp.z - 0.008);
    dof(true, camera.position.distanceTo(hp), 0.006, 0.01);
    G.uTint.value.setRGB(0.85, 0.95, 1.05); G.uVig.value = 0.7;
    G.uFlash.value = sstep(2.62, 2.75, t) * 0.95; G.uZoom.value = sstep(2.55, 2.75, t) * 0.25;
  }],
  [2.75, 5.0, (t, k) => { // gözlerini açar → Eşik'te; kamera yükselip evreni gösterir
    cur = E.s; animWorld(t); bloom.threshold = 0.9; bloom.strength = 0.75;
    // Deniz zeminde sırt üstü yatıyor
    lyingDeniz(t, 1 - sstep(2.8, 3.1, t));
    const e = easeOut(clamp((t - 2.75) / 2.25));
    const hp = DENIZ.head.getWorldPosition(V(0, 0, 0));
    if (t < 3.3) { // önce yüz (gözler açılır)
      const k2 = clamp((t - 2.75) / 0.55);
      camera.position.set(hp.x + 0.02, hp.y + lerp(0.45, 0.62, k2), hp.z + 0.04); camera.up.set(0, 0, -1); camera.fov = 24; camera.updateProjectionMatrix(); camera.lookAt(hp.x, hp.y, hp.z - 0.008);
      dof(true, camera.position.distanceTo(hp), 0.006, 0.01);
    } else { // hızla yukarı-geri çekil: ters gezegenler, saatler, kapı
      const k3 = easeOut(clamp((t - 3.3) / 1.7));
      const p = V(lerp(0.3, 6, k3), lerp(0.6, 26, k3), lerp(0.2, 22, k3));
      camera.position.copy(p); camera.up.set(0, 1, 0); camera.fov = lerp(30, 58, k3); camera.updateProjectionMatrix();
      camera.lookAt(V(lerp(0, 0, k3), lerp(0, 60, k3), lerp(-0.5, -150, Math.pow(k3, 0.7))));
      camera.rotation.z += lerp(0.6, 0.05, k3);
    }
    G.uFlash.value = 0.95 * (1 - sstep(2.75, 3.05, t)); G.uFlashCol.value.setRGB(0.85, 0.95, 1.0);
    G.uWarp.value = 0.35 * (1 - sstep(3.3, 4.2, t)) * sstep(3.25, 3.4, t); G.uAberr.value = 0.004 * (1 - sstep(3.3, 4.5, t)) + 0.0012;
  }],
  // ===== SAHNE 2 — BİLİNMEYEN YER =====
  [5.0, 7.6, (t, k) => { // ayağa kalkar; önünde dev kapı
    cur = E.s; animWorld(t); bloom.threshold = 0.9;
    const rise = easeIO(clamp((t - 5.1) / 2.0));
    place(DENIZ, E.s, 0, lerp(-0.42, 0, rise), 0, Math.PI);
    pose(DENIZ, { t, sit: lerp(0.85, 0, rise), lean: lerp(0.55, 0, rise), pitch: lerp(0.3, -0.35, rise), handsFace: 0, seed: 1, surprise: sstep(6.6, 7.2, t) });
    const e = easeIO(k);
    look(V(lerp(0.9, 0.6, e), lerp(0.4, 0.9, e), lerp(2.2, 2.9, e)), V(lerp(0.0, 0.0, e), lerp(0.9, 14, e), lerp(-2, -60, e)), lerp(50, 56, e));
    shake(t, 0.002); dof(true, lerp(2.3, 3.0, e), 0.002, 0.005);
  }],
  [7.6, 10.5, (t, k) => { // varlıklar geçer; Deniz etrafına bakınır (dönerek kamera)
    cur = E.s; animWorld(t); bloom.threshold = 0.9;
    place(DENIZ, E.s, 0, 0, 0, Math.PI + Math.sin((t - 7.6) * 1.1) * 0.5);
    pose(DENIZ, { t, pitch: -0.2 + 0.15 * Math.sin(t * 1.3), yaw: Math.sin(t * 0.9) * 0.6, surprise: 0.7, seed: 1, lookX: Math.sin(t * 1.7) * 0.3 });
    const a = lerp(-0.6, 0.9, easeIO(k)); const rad = 4.2;
    look(V(Math.sin(a) * rad, 1.25, Math.cos(a) * rad - 1.5), V(0, 1.4, -2), 44);
    shake(t, 0.002); dof(true, rad * 0.9, 0.002, 0.005);
  }],
  [10.5, 13.0, (t, k) => { // yüz yakın: "Ben neredeyim?"
    cur = E.s; animWorld(t); bloom.threshold = 0.92;
    place(DENIZ, E.s, 0, 0, 0, Math.PI + 0.15);
    pose(DENIZ, { t, pitch: -0.12, yaw: -0.15 + 0.2 * sstep(11.8, 12.6, t), surprise: 0.5, talk: t > 11.0 && t < 12.3 ? 1 : 0, seed: 1, lookX: 0.15, lookY: 0.05 });
    const e = easeIO(k); const hp = DENIZ.head.getWorldPosition(V(0, 0, 0));
    const ang = lerp(0.5, 0.15, e);
    look(V(hp.x + Math.sin(Math.PI + 0.15 + ang) * lerp(1.0, 0.75, e), hp.y + 0.02, hp.z + Math.cos(Math.PI + 0.15 + ang) * lerp(1.0, 0.75, e)), V(hp.x, hp.y, hp.z), 30);
    dof(true, lerp(1.0, 0.75, e), 0.006, 0.009);
  }],
  // ===== SAHNE 3 — ABSÜRT KARŞILAŞMA =====
  [13.0, 15.6, (t, k) => { // geniş: süzülen masa, galaksi kafalı görevli; Deniz yaklaşır
    cur = E.s; animWorld(t); bloom.threshold = 0.9;
    const w = easeOut(clamp((t - 13.0) / 2.4)); const p = vlerp(V(0.2, 0, -4.5), DZ_DESK, w);
    place(DENIZ, E.s, p.x, 0, p.z, Math.PI + 0.1); pose(DENIZ, { t, walk: 1 - sstep(15.0, 15.5, t), phase: (t - 13) * 6.4, pitch: -0.05, seed: 1, surprise: 0.3 });
    clerkTalk(t, false); CLERK.root.rotation.y = 0;
    const e = easeIO(k);
    look(V(lerp(-3.2, -2.6, e), lerp(2.6, 2.1, e), lerp(-1.5, -3.2, e)), V(3.2, 1.7, -12.6), 46);
    dof(true, 9.5, 0.0015, 0.004);
  }],
  [15.6, 18.2, (t, k) => { // görevli (alt açı): "Buraya gelen herkes ilk önce bunu soruyor."
    cur = E.s; animWorld(t); bloom.threshold = 0.9;
    place(DENIZ, E.s, DZ_DESK.x, 0, DZ_DESK.z, Math.PI + 0.1); pose(DENIZ, { t, pitch: -0.12, seed: 1, surprise: 0.25 });
    clerkTalk(t, t > 15.9 && t < 18.0); CLERK.head.rotation.z = Math.sin(t * 0.8) * 0.08;
    const e = easeIO(k);
    ots(DENIZ.root.position, CLERK.root.position, lerp(0.75, 0.6, e), 0.42, lerp(1.55, 1.6, e), 2.55, lerp(42, 36, e));
    dof(true, 3.6, 0.003, 0.006);
  }],
  [18.2, 20.3, (t, k) => { // Deniz: "Yani öldüm mü?"
    cur = E.s; animWorld(t); bloom.threshold = 0.92;
    place(DENIZ, E.s, DZ_DESK.x, 0, DZ_DESK.z, Math.PI + 0.1); pose(DENIZ, { t, pitch: -0.22, seed: 1, sad: 0.35, talk: t > 18.4 && t < 19.8 ? 1 : 0, lookY: 0.15 });
    clerkTalk(t, false);
    const e = easeIO(k);
    const from = V(CLERK_POS.x, 0, CLERK_POS.z + 0.6);
    ots(from, DENIZ.root.position, lerp(0.9, 0.8, e), -0.5, lerp(2.0, 1.95, e), 1.68, lerp(32, 28, e));
    dof(true, 2.2, 0.004, 0.007);
  }],
  [20.3, 23.0, (t, k) => { // görevli gülümser, yaklaşır: "Henüz doğru soruyu sormadın."
    cur = E.s; animWorld(t); bloom.threshold = 0.9; bloom.strength = 0.85;
    place(DENIZ, E.s, DZ_DESK.x, 0, DZ_DESK.z, Math.PI + 0.1); pose(DENIZ, { t, pitch: -0.25, seed: 1 });
    clerkTalk(t, t > 20.6 && t < 22.8);
    CLERK.smile.material.opacity = sstep(20.4, 20.9, t); CLERK.head.rotation.x = 0.12 * sstep(20.4, 21.2, t);
    CLERK.root.position.z = CLERK_POS.z + sstep(20.5, 22.5, t) * 0.35;
    const e = easeIO(k);
    look(V(lerp(3.0, 3.2, e), lerp(2.45, 2.6, e), lerp(-11.5, -12.3, e)), V(3.5, 2.72, -13.75 + sstep(20.5, 22.5, t) * 0.35), lerp(34, 26, e));
    dof(true, lerp(2.4, 1.6, e), 0.004, 0.008);
  }],
  // ===== SAHNE 4 — BÜYÜK GİZEM =====
  [23.0, 24.6, (t, k) => { // el kalkar, ışık patlaması
    cur = E.s; animWorld(t); bloom.threshold = 0.9; bloom.strength = 0.85;
    place(DENIZ, E.s, DZ_DESK.x, 0, DZ_DESK.z, Math.PI + 0.1); pose(DENIZ, { t, pitch: -0.3, seed: 1, surprise: sstep(24.0, 24.4, t) });
    clerkTalk(t, false); CLERK.smile.material.opacity = 1 - sstep(23.0, 23.6, t);
    const raise = easeIO(clamp((t - 23.1) / 0.9)); clerkArm(raise);
    const hp = CLERK.arms[1].hand.getWorldPosition(V(0, 0, 0)); flareLight.position.copy(hp); flareLight.intensity = 30 * sstep(23.7, 24.2, t);
    const e = easeIO(k);
    look(V(lerp(0.2, 0.5, e), lerp(1.2, 1.1, e), lerp(-8.3, -8.8, e)), V(3.4, lerp(2.3, 3.0, e), -13.8), lerp(40, 46, e));
    dof(true, 6, 0.002, 0.005);
    G.uFlash.value = sstep(24.15, 24.6, t) * 0.7; G.uFlashCol.value.setRGB(0.7, 0.9, 1.0);
  }],
  [24.6, 28.0, (t, k) => { // dev ekran: çocukluk, aile, yaşanmamış ihtimal
    cur = E.s; animWorld(t); bloom.threshold = 0.92; bloom.strength = 0.8;
    place(DENIZ, E.s, DZ_DESK.x, 0, DZ_DESK.z, Math.PI + 0.1); pose(DENIZ, { t, pitch: -0.3, seed: 1, surprise: 0.4, sad: sstep(26.9, 27.4, t) * 0.6 });
    clerkArm(1); CLERK.arms[1].glow.scale.setScalar(0.6);
    renderMemory(t);
    screenU.uOn.value = sstep(24.6, 25.1, t); screenU.uTime.value = t;
    const kk = t - 24.6; screenU.uGlitch.value = Math.max(0, 1 - Math.abs(kk - 1.15) / 0.12, 1 - Math.abs(kk - 2.3) / 0.12, sstep(27.6, 27.9, t));
    screenLight.intensity = 14 * screenU.uOn.value;
    const e = easeIO(k);
    ots(DENIZ.root.position, V(3.1, 0, -15.2), lerp(1.3, 0.9, e), -0.45, lerp(2.0, 2.05, e), 3.7, lerp(46, 40, e));
    dof(true, 5.2, 0.0015, 0.004);
  }],
  [28.0, 32.0, (t, k) => { // ekran dağılır → binlerce kapı belirir
    cur = E.s; animWorld(t); bloom.threshold = 0.9; bloom.strength = 0.8;
    place(DENIZ, E.s, DZ_DESK.x, 0, DZ_DESK.z, Math.PI + 0.1 - sstep(29.0, 31.0, t) * 1.2); pose(DENIZ, { t, pitch: -0.15 - 0.2 * Math.sin(t * 0.8), yaw: Math.sin(t * 0.7) * 0.4, seed: 1, surprise: 0.8 });
    clerkArm(1 - sstep(28.4, 29.4, t));
    screenU.uOn.value = 1 - sstep(28.0, 28.5, t); screenU.uGlitch.value = 1;
    if (screenU.uOn.value > 0) renderMemory(27.9);
    D.g.visible = true; animDoors(t, (t - 28.1) * 1.25);
    const e = easeIO(k);
    const a = lerp(0.3, 2.4, e), rad = lerp(4, 30, Math.pow(e, 1.4));
    look(V(DZ_DESK.x + Math.sin(a) * rad, lerp(1.6, 16, e), DZ_DESK.z + Math.cos(a) * rad), V(DZ_DESK.x, lerp(1.4, 8, e), DZ_DESK.z), lerp(40, 60, e));
    dof(e < 0.3, rad, 0.002, 0.005);
    G.uFlash.value = 0.6 * (1 - sstep(28.0, 28.4, t));
  }],
  // ===== SAHNE 5 — TERS KÖŞE =====
  [32.0, 34.2, (t, k) => { // adının yazdığı kapıya yürür (arkadan takip)
    cur = E.s; animWorld(t); D.g.visible = true; animDoors(t, 10); bloom.threshold = 0.9;
    const w = easeIO(clamp((t - 32.0) / 2.2)); const p = vlerp(V(DZ_DESK.x, 0, DZ_DESK.z), V(NAMEDOOR.x, 0, NAMEDOOR.z - 1.0), w);
    place(DENIZ, E.s, p.x, 0, p.z, Math.atan2(NAMEDOOR.x - DZ_DESK.x, NAMEDOOR.z - DZ_DESK.z)); pose(DENIZ, { t, walk: 1 - sstep(33.9, 34.2, t), phase: (t - 32) * 6.4, seed: 1, pitch: 0.05 });
    look(V(p.x - 0.6, 1.75, p.z - 2.4), V(NAMEDOOR.x, 1.6, NAMEDOOR.z), 42);
    shake(t, 0.002); dof(true, 2.6, 0.003, 0.006);
  }],
  [34.2, 35.3, (t, k) => { // isim plakası + uzanan el
    cur = E.s; animWorld(t); D.g.visible = true; animDoors(t, 10); bloom.threshold = 0.88;
    place(DENIZ, E.s, NAMEDOOR.x, 0, NAMEDOOR.z - 0.9, 0); pose(DENIZ, { t, reach: easeIO(clamp((t - 34.4) / 0.8)) * 0.85, seed: 1, pitch: 0.1 });
    const e = easeIO(k);
    const ty = lerp(2.55, 1.25, sstep(0.45, 1.0, k));
    look(V(NAMEDOOR.x + 0.3, lerp(2.2, 1.9, e), NAMEDOOR.z - lerp(1.9, 1.7, e)), V(NAMEDOOR.x - 0.25 * e, ty, NAMEDOOR.z), lerp(40, 46, e));
    dof(true, lerp(1.9, 1.6, e), 0.002, 0.005); renderer.toneMappingExposure = 0.9;
  }],
  [35.3, 37.1, (t, k) => { // görevli seslenir (arkada, odak dışı); Deniz donar
    cur = E.s; animWorld(t); D.g.visible = true; animDoors(t, 10); bloom.threshold = 0.92;
    place(DENIZ, E.s, NAMEDOOR.x, 0, NAMEDOOR.z - 0.9, 0);
    pose(DENIZ, { t: 35.3, reach: 0.85 - sstep(36.4, 36.8, t) * 0.2, seed: 1, pitch: 0.1, yaw: -sstep(36.3, 36.9, t) * 0.35, surprise: sstep(36.2, 36.5, t), blink: 0 });
    clerkTalk(t, t > 35.4 && t < 37.0); CLERK.root.position.z = CLERK_POS.z + 0.35; renderer.toneMappingExposure = 0.85;
    const e = easeIO(k);
    look(V(NAMEDOOR.x + lerp(0.85, 0.75, e), 1.72, NAMEDOOR.z - lerp(0.25, 0.35, e)), V(NAMEDOOR.x - 0.05, 1.62, NAMEDOOR.z - 1.0), lerp(36, 32, e));
    dof(true, lerp(1.1, 1.0, e), 0.003, 0.006);
  }],
  [37.1, 38.0, (t, k) => { // gözlere aşırı yakın — sonra karanlık
    cur = E.s; animWorld(t); bloom.threshold = 0.95; renderer.toneMappingExposure = 0.85;
    place(DENIZ, E.s, NAMEDOOR.x, 0, NAMEDOOR.z - 0.9, 0);
    pose(DENIZ, { t: 35.3, reach: 0.2, seed: 1, pitch: 0.1, yaw: -0.35, surprise: 1, blink: 0 });
    const hp = DENIZ.head.getWorldPosition(V(0, 0, 0)); const yaw = -0.35; const f = V(Math.sin(yaw), 0, Math.cos(yaw));
    const e = easeIO(k); const d = lerp(0.6, 0.45, e);
    look(V(hp.x + f.x * d, hp.y + 0.015, hp.z + f.z * d), V(hp.x, hp.y + 0.008, hp.z), lerp(20, 17, e));
    dof(true, d, 0.004, 0.008);
    G.uVig.value = 0.75; G.uFade.value = sstep(37.85, 38.0, t);
  }],
  [38.0, 40.01, (t, k) => { cur = E.s; G.uFade.value = 1; }],
];

// hastane: Deniz yatakta sırt üstü
function hospitalDeniz(t) {
  place(DENIZ, HOS.s, 0, 0.8, 1.0, 0);
  DENIZ.root.rotation.set(-Math.PI / 2, 0, 0);
  pose(DENIZ, { t, blink: 1, seed: 1, pitch: -0.15 });
}
function headPos() { DENIZ.root.updateMatrixWorld(true); return DENIZ.head.getWorldPosition(V(0, 0, 0)); }
function lyingDeniz(t, closed) {
  place(DENIZ, E.s, 0, 0.12, 0.9, 0); DENIZ.root.rotation.set(-Math.PI / 2, 0, 0);
  pose(DENIZ, { t, blink: closed, surprise: 1 - closed, seed: 1, pitch: -0.15 });
  DENIZ.root.updateMatrixWorld(true);
}

// ---------------- kare ----------------
const out = document.getElementById('out'); const ctx = out.getContext('2d');
window.renderFrame = function (t) {
  resetFx(); G.uTime.value = t; D.g.visible = false;
  const shot = SHOTS.find(s => t >= s[0] && t < s[1]) || SHOTS[SHOTS.length - 1];
  camera.rotation.set(0, 0, 0); camera.up.set(0, 1, 0);
  CLERK.root.position.copy(CLERK_POS); CLERK.head.rotation.set(0, 0, 0); clerkArm(0);
  shot[2](t, clamp((t - shot[0]) / (shot[1] - shot[0])));
  if (G.uFade.value >= 1) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); return out.toDataURL('image/jpeg', 0.94); }
  renderPass.scene = cur; renderPass.camera = camera; bokeh.scene = cur; bokeh.camera = camera;
  composer.render();
  ctx.drawImage(glCanvas, 0, 0, W, H);
  return out.toDataURL('image/jpeg', 0.94);
};
(async () => {
  await Promise.all([document.fonts.load('700 40px Osw'), document.fonts.load('700 40px Osw', 'İ')]);
  ND.plateTex._draw(ND.plateTex._ctx, 512, 128); ND.plateTex.needsUpdate = true;
  await Promise.all(pending);
  for (const tt of [0.5, 4, 9, 16, 26, 30, 36]) window.renderFrame(tt);
  window.READY = true;
})();
