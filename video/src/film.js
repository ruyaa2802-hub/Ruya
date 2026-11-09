// KISA ANİMASYON FİLMİ — "Herkes 100 yaşına kadar genç kalsaydı?"
// Tek akış, tam ekran 9:16, sahneler sırayla; görüntüde yazı YOK (altyazı post'ta eklenir).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { makeHuman, pose, setAge, makeBaby, crowdGeometry, crowdMaterial } from './human.js';
import { buildCity, rng, clamp, lerp, sstep, easeIO, easeOut, V, vlerp, dust, rain, canvasTex, M, mesh, pending } from './city.js';

const W = 1080, H = 1920;
const RS = parseFloat(new URLSearchParams(location.search).get('scale') || '1');

// ---------- renderer ----------
const glCanvas = document.createElement('canvas'); glCanvas.id = 'gl'; document.body.appendChild(glCanvas);
const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(Math.round(W * RS), Math.round(H * RS), false);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const camera = new THREE.PerspectiveCamera(40, W / H, 0.03, 4000);
const composer = new EffectComposer(renderer); composer.setPixelRatio(1); composer.setSize(Math.round(W * RS), Math.round(H * RS));
const renderPass = new RenderPass(new THREE.Scene(), camera);
const bokeh = new BokehPass(new THREE.Scene(), camera, { focus: 3, aperture: 0.004, maxblur: 0.008 });
const bloom = new UnrealBloomPass(new THREE.Vector2(W * RS, H * RS), 0.7, 0.55, 0.85);
const grade = new ShaderPass({
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uFlash: { value: 0 }, uFlashCol: { value: new THREE.Color(1, 1, 1) },
    uFade: { value: 0 }, uZoom: { value: 0 }, uWhip: { value: 0 }, uAberr: { value: 0.001 }, uSat: { value: 1.05 },
    uContrast: { value: 1.06 }, uVig: { value: 0.45 }, uGrain: { value: 0.035 }, uTint: { value: new THREE.Color(1, 1, 1) },
    uCenter: { value: new THREE.Vector2(0.5, 0.5) }, uLift: { value: new THREE.Color(0, 0, 0) }, uBars: { value: 0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime,uFlash,uFade,uZoom,uWhip,uAberr,uSat,uContrast,uVig,uGrain,uBars;
    uniform vec3 uTint,uFlashCol,uLift; uniform vec2 uCenter; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
    vec3 tap(vec2 uv, vec2 d){ return vec3(texture2D(tDiffuse,uv+d*uAberr).r, texture2D(tDiffuse,uv).g, texture2D(tDiffuse,uv-d*uAberr).b); }
    void main(){
      vec2 uv=vUv; vec2 d=uv-uCenter; vec3 col;
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

// ---------- karakterler (tüm filmde aynı modeller) ----------
const SKIN = 0xd9a083;
const ARDA = makeHuman({ skin: 0xd6a084, eye: 0x4a6a8a, hair: 0xcfcbc5, hairStyle: 'neat', browColor: 0xd8d4cf, face: { child: 0, jaw: 0.9, nose: 1.1, cheek: 1.1, brow: 1.2, lip: 0.9 }, top: 0x1c2438, pants: 0x161b28, shoes: 0x0d0d10, shirt: true, tie: 0x8a1c2c });
const EMRE = makeHuman({ skin: SKIN, eye: 0x5a3a22, hair: 0x2a1a12, hairStyle: 'messy', browColor: 0x241510, face: { child: 0, jaw: 0.86, nose: 1.0, cheek: 1.0, brow: 1.0, lip: 1.0 }, top: 0xc8901a, pants: 0x22252d, shoes: 0xdedede, coat: true, morphChild: true });
const NURSE = makeHuman({ skin: 0xc58a6a, eye: 0x3a2a1a, hair: 0x1a120e, hairStyle: 'neat', browColor: 0x1a120e, face: { child: 0, jaw: 0.82, nose: 0.9, cheek: 1.0, brow: 0.8, lip: 1.1 }, top: 0x2f8f8a, pants: 0x2f8f8a, shoes: 0xeeeeee });
const BABY = makeBaby();

// ---------- SAHNE A: yenidoğan odası ----------
function buildHospital() {
  const s = new THREE.Scene(); s.background = new THREE.Color(0x03070c); s.fog = new THREE.FogExp2(0x04101a, 0.06);
  const wallM = M(0x16212b, 0.85), floorM = M(0x0c1218, 0.22, 0.25);
  const floor = mesh(new THREE.PlaneGeometry(14, 14).rotateX(-Math.PI / 2), floorM); floor.receiveShadow = true; s.add(floor);
  const back = mesh(new THREE.PlaneGeometry(14, 4), wallM, 0, 2, -3.2); back.receiveShadow = true; s.add(back);
  const left = mesh(new THREE.PlaneGeometry(14, 4).rotateY(Math.PI / 2), wallM, -3.5, 2, 0); s.add(left);
  // pencere: gece şehri ışıkları + yağmur
  const winTex = canvasTex(1024, 512, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0a0f24'); g.addColorStop(1, '#2a1238'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    const r = rng(5); for (let i = 0; i < 260; i++) { const cx = r() * w, cy = h * 0.35 + r() * h * 0.65, rad = 4 + r() * 16; const c = ['#ff4ad8', '#4af3ff', '#ffb04a', '#ffffff', '#7a6bff'][Math.floor(r() * 5)]; const gg = x.createRadialGradient(cx, cy, 0, cx, cy, rad); gg.addColorStop(0, c); gg.addColorStop(1, 'rgba(0,0,0,0)'); x.globalAlpha = 0.25 + r() * 0.5; x.fillStyle = gg; x.fillRect(cx - rad, cy - rad, rad * 2, rad * 2); }
    x.globalAlpha = 1;
  });
  const win = mesh(new THREE.PlaneGeometry(4.2, 2.2), new THREE.MeshBasicMaterial({ map: winTex, color: new THREE.Color(1.4, 1.4, 1.4) }), 0.6, 1.9, -3.18); s.add(win);
  for (let k = 0; k < 4; k++) s.add(mesh(new THREE.BoxGeometry(0.06, 2.3, 0.08), M(0x0b1016, 0.4, 0.6), -1.5 + k * 1.4, 1.9, -3.12));
  const rn = rain(1500, V(4.2, 2.4, 0.3), 0x9fc8ff, 0.12, 2.2, 0.3, 21); s.add(rn);
  // küvöz (fotoğraftaki gibi parlak kenarlı kapsül)
  const inc = new THREE.Group(); inc.position.set(0, 0, 0); s.add(inc);
  const baseM = new THREE.MeshPhysicalMaterial({ color: 0xdfe6ea, roughness: 0.25, clearcoat: 0.8 });
  const cab = mesh(new THREE.BoxGeometry(1.1, 0.75, 0.62), baseM, 0, 0.55, 0); inc.add(cab);
  const top = mesh(new THREE.BoxGeometry(1.16, 0.08, 0.68), baseM, 0, 0.96, 0); inc.add(top);
  const mat = mesh(new THREE.BoxGeometry(0.9, 0.05, 0.48), new THREE.MeshPhysicalMaterial({ color: 0xf4f6f8, roughness: 0.8, sheen: 1 }), 0, 1.02, 0); mat.receiveShadow = true; inc.add(mat);
  const hood = mesh(new THREE.CylinderGeometry(0.33, 0.33, 1.08, 48, 1, true, -Math.PI / 2, Math.PI), new THREE.MeshPhysicalMaterial({ color: 0xbfe8ff, roughness: 0.05, transparent: true, opacity: 0.05, side: THREE.DoubleSide, depthWrite: false, clearcoat: 1 }), 0, 1.0, 0);
  hood.rotation.z = Math.PI / 2; hood.castShadow = false; inc.add(hood);
  const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 1.5, 2.0) });
  for (const xx of [-0.54, 0.54]) { const ring = mesh(new THREE.TorusGeometry(0.33, 0.012, 8, 64, Math.PI), glow, xx, 1.0, 0); ring.rotation.y = Math.PI / 2; ring.castShadow = false; inc.add(ring); }
  const edge = mesh(new THREE.BoxGeometry(1.12, 0.012, 0.012), glow, 0, 0.98, 0.33); inc.add(edge); const edge2 = edge.clone(); edge2.position.z = -0.33; inc.add(edge2);
  const under = mesh(new THREE.BoxGeometry(1.0, 0.02, 0.5), glow, 0, 0.17, 0); inc.add(under);
  const bh = new THREE.Group(); bh.position.set(0.3, 1.1, 0.0); bh.rotation.y = -Math.PI / 2 + 0.25; inc.add(bh); BABY.root.rotation.set(-Math.PI / 2, 0, 0); bh.add(BABY.root);
  // monitör
  const monTex = canvasTex(512, 320, () => {});
  const mon = mesh(new THREE.PlaneGeometry(0.55, 0.34), new THREE.MeshBasicMaterial({ map: monTex, color: new THREE.Color(1.3, 1.3, 1.3) }), -0.95, 1.55, -0.35); mon.rotation.y = 0.5; s.add(mon);
  s.add(mesh(new THREE.BoxGeometry(0.6, 0.38, 0.04), M(0x101418, 0.4, 0.5), -0.96, 1.55, -0.38).rotateY(0.5));
  s.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.5, 8), M(0x8a9098, 0.3, 0.9), -1.05, 0.75, -0.5));
  // ışıklar
  s.add(new THREE.HemisphereLight(0x6fa8ff, 0x0a0a10, 0.35));
  const key = new THREE.SpotLight(0xfff0e0, 3.2, 6, 0.5, 0.8, 1.4); key.position.set(0.9, 2.6, 1.2); key.target.position.set(0, 1.05, 0); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0004; s.add(key, key.target);
  const cy = new THREE.PointLight(0x4fe0ff, 0.8, 1.6, 1.6); cy.position.set(0, 1.25, 0); s.add(cy);
  const rim = new THREE.PointLight(0xa070ff, 6, 6, 1.5); rim.position.set(0.6, 2.0, -2.6); s.add(rim);
  const d = dust(260, [V(-2, 0.3, -2.5), V(4, 2.5, 4)], 0x9fdcff, 0.6, 31); s.add(d);
  s.add(NURSE.root);
  return { s, monTex, rain: rn, dust: d, key };
}

// ---------- SAHNE B: zaman koridoru ----------
function buildCorridor() {
  const s = new THREE.Scene(); s.fog = new THREE.FogExp2(0x9fb0c0, 0.012);
  const skyU = { uDay: { value: 1 }, uSunDir: { value: V(-1, 0.3, 0).normalize() } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(800, 32, 16), new THREE.ShaderMaterial({ uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vD; void main(){ vD=position; vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position=p.xyww; }`,
    fragmentShader: `uniform float uDay; uniform vec3 uSunDir; varying vec3 vD;
      void main(){ vec3 d=normalize(vD); float y=d.y;
        vec3 dayTop=vec3(0.25,0.5,0.9), dayHor=vec3(0.85,0.82,0.78), nTop=vec3(0.01,0.015,0.05), nHor=vec3(0.12,0.06,0.16), dusk=vec3(1.0,0.45,0.2);
        float k=uDay; vec3 top=mix(nTop,dayTop,k), hor=mix(nHor,dayHor,k);
        float duskK=(1.0-abs(k*2.0-1.0)); hor=mix(hor,dusk,duskK*0.7);
        vec3 c=mix(hor,top,smoothstep(0.0,0.5,y));
        float s=max(dot(d,uSunDir),0.0); c+=vec3(1.0,0.8,0.55)*(pow(s,600.0)*6.0+pow(s,8.0)*0.4)*smoothstep(-0.05,0.05,uSunDir.y);
        gl_FragColor=vec4(c,1.0);
        #include <colorspace_fragment>
      }` }));
  sky.frustumCulled = false; s.add(sky);
  // dışarıdaki silüet şehir
  const r = rng(12); const n = 260; const tw = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: 0x2a3340, roughness: 0.6, emissive: 0xffc070, emissiveIntensity: 0 }), n);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < n; i++) { const x = -30 - r() * 400, z = 60 - r() * 500, h = 15 + r() * 160 * (1 - Math.abs(z) / 900); m4.compose(V(x, -25, z), new THREE.Quaternion(), V(8 + r() * 20, h + 25, 8 + r() * 20)); tw.setMatrixAt(i, m4); }
  s.add(tw);
  // koridor
  const L = 70, z0 = 8;
  const floorM = new THREE.MeshPhysicalMaterial({ color: 0x8a8d92, roughness: 0.28, metalness: 0.0, clearcoat: 0.6, clearcoatRoughness: 0.2 });
  const floor = mesh(new THREE.PlaneGeometry(4, L).rotateX(-Math.PI / 2), floorM, 0, 0, z0 - L / 2); floor.receiveShadow = true; s.add(floor);
  const ceil = mesh(new THREE.PlaneGeometry(4, L).rotateX(Math.PI / 2), M(0xd8dadc, 0.8), 0, 3.4, z0 - L / 2); s.add(ceil);
  const wallR = mesh(new THREE.PlaneGeometry(L, 3.4).rotateY(-Math.PI / 2), M(0xc9c6c0, 0.75), 2, 1.7, z0 - L / 2); wallR.receiveShadow = true; s.add(wallR);
  const lampM = new THREE.MeshBasicMaterial({ color: new THREE.Color(2, 2, 2) });
  const lamps = [];
  for (let z = z0; z > z0 - L; z -= 1.6) {
    const mu = mesh(new THREE.BoxGeometry(0.1, 3.4, 0.12), M(0x2c3036, 0.4, 0.7), -2, 1.7, z); s.add(mu);
    const lp = mesh(new THREE.BoxGeometry(0.12, 0.03, 1.1), lampM, 0.6, 3.38, z - 0.8); lp.castShadow = false; s.add(lp); lamps.push(lp);
    if (Math.round(z / 1.6) % 4 === 0) { const dr = mesh(new THREE.BoxGeometry(0.06, 2.2, 1.0), M(0x5a4a3a, 0.6), 1.97, 1.1, z); s.add(dr); }
  }
  s.add(mesh(new THREE.BoxGeometry(0.12, 0.25, L), M(0x2c3036, 0.4, 0.7), -2, 0.12, z0 - L / 2));
  s.add(mesh(new THREE.BoxGeometry(0.12, 0.1, L), M(0x2c3036, 0.4, 0.7), -2, 3.35, z0 - L / 2));
  const glass = mesh(new THREE.PlaneGeometry(L, 3.4).rotateY(Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0xaaccdd, transparent: true, opacity: 0.08, roughness: 0.05, depthWrite: false }), -2.02, 1.7, z0 - L / 2); glass.castShadow = false; s.add(glass);
  const sun = new THREE.DirectionalLight(0xfff0d8, 4); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0003;
  const sc = sun.shadow.camera; sc.left = -9; sc.right = 9; sc.top = 9; sc.bottom = -9; sc.near = 1; sc.far = 80; s.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0xcfe0ff, 0x4a4038, 0.6); s.add(hemi);
  const fill = new THREE.PointLight(0xffe2c0, 0, 14, 1.2); s.add(fill);
  // geçip giden insanlar (zaman atlaması)
  const cg = crowdGeometry(); const cm = crowdMaterial(); const NPp = 26; const ppl = new THREE.InstancedMesh(cg, cm, NPp);
  const ph = new Float32Array(NPp), sp = new Float32Array(NPp); const pd = [];
  for (let i = 0; i < NPp; i++) { ph[i] = r() * 6; sp[i] = 2.2; pd.push({ x: -1.3 + r() * 1.2 + (i % 2) * 1.5, z: r() * 70, v: (i % 2 ? 1 : -1) * (4 + r() * 3) }); ppl.setColorAt(i, new THREE.Color().setHSL(r(), 0.3, 0.25 + r() * 0.4)); }
  cg.setAttribute('aPhase', new THREE.InstancedBufferAttribute(ph, 1)); cg.setAttribute('aSpeed', new THREE.InstancedBufferAttribute(sp, 1));
  ppl.frustumCulled = false; s.add(ppl);
  const d = dust(500, [V(-2, 0, -60), V(4, 3.4, 70)], 0xfff2d8, 0.5, 41); s.add(d);
  return { s, skyU, sun, hemi, fill, lamps, lampM, ppl, pd, cm, tw, z0, floorM, dust: d };
}

const HOS = buildHospital();
const COR = buildCorridor();
const C = buildCity();
// soyut nüfus panosu (yazısız: yüzlerce küçük figür ikonu)
(() => { const x = C.popTex._ctx; x.clearRect(0, 0, 1024, 560); x.fillStyle = 'rgba(4,10,24,0.7)'; x.fillRect(0, 0, 1024, 560);
  for (let j = 0; j < 9; j++) for (let i = 0; i < 26; i++) { const cx = 40 + i * 37.5, cy = 60 + j * 55; x.fillStyle = (i * 7 + j * 3) % 11 === 0 ? '#ff4a8a' : '#2bf3ff'; x.globalAlpha = 0.5 + 0.5 * ((i + j) % 3) / 2; x.beginPath(); x.arc(cx, cy - 12, 7, 0, 7); x.fill(); x.fillRect(cx - 8, cy - 2, 16, 22); }
  x.globalAlpha = 1; C.popTex.needsUpdate = true; })();
// şehre ek ışıklar (karakterler için)
const streetKey = new THREE.SpotLight(0xbfd8ff, 0, 30, 0.6, 0.6, 1.2); streetKey.castShadow = true; streetKey.shadow.mapSize.set(1024, 1024); C.scene.add(streetKey, streetKey.target);
const roomShadow = new THREE.SpotLight(0xe8f0ff, 0, 14, 0.9, 0.7, 1.3); roomShadow.position.set(18.5, 33.8, -38.5); roomShadow.target.position.set(17, 30, -39.5); roomShadow.castShadow = true; roomShadow.shadow.mapSize.set(1024, 1024); roomShadow.shadow.bias = -0.0004; C.scene.add(roomShadow, roomShadow.target);
const faceKey = new THREE.PointLight(0xffd8b8, 0, 5, 1.4); C.scene.add(faceKey);
const holoBeam = new THREE.SpotLight(0x4fffe0, 0, 8, 0.32, 0.5, 1.2); holoBeam.position.set(13.6, 33.6, -40); C.scene.add(holoBeam, holoBeam.target);
const sunsetKey = new THREE.DirectionalLight(0xffa060, 0); sunsetKey.castShadow = true; sunsetKey.shadow.mapSize.set(1024, 1024); const ssc = sunsetKey.shadow.camera; ssc.left = -6; ssc.right = 6; ssc.top = 6; ssc.bottom = -6; ssc.far = 200; C.scene.add(sunsetKey, sunsetKey.target);
C.chairs.forEach(c => c.traverse(o => { o.castShadow = true; o.receiveShadow = true; }));
C.room.traverse(o => { if (o.isMesh) o.receiveShadow = true; });

function cityMood(m) {
  const { skyU, bU, hemi, sun, pl1, pl2, scene } = C;
  if (m === 'night') {
    skyU.uTop.value.set(0x04050d); skyU.uHor.value.set(0x45183f); skyU.uBot.value.set(0x0a0610); skyU.uSunCol.value.setRGB(0, 0, 0); skyU.uCloud.value = 0.35; skyU.uCloudCol.value.set(0x1d0f2c);
    bU.uFogCol.value.set(0x2c1436); bU.uFogDen.value = 0.0033; bU.uLit.value = 0.5; bU.uWinI.value = 1.7; bU.uShop.value = 1; bU.uRimI.value = 2.5;
    bU.uLightCol.value.setRGB(0.3, 0.25, 0.5); bU.uAmb.value.setRGB(0.22, 0.22, 0.32); bU.uBase.value.set(0x12151f); bU.uLightDir.value.set(-0.3, 0.6, 0.5).normalize();
    hemi.color.set(0x8a7cff); hemi.groundColor.set(0x2a1020); hemi.intensity = 0.9; sun.intensity = 0; pl1.intensity = 60; pl2.intensity = 60;
    C.gU.uGlow.value.set(0x5a2a6a); scene.fog.color.set(0x2c1436); scene.fog.density = 0.004; C.rainA.visible = true; sunsetKey.intensity = 0;
  } else {
    skyU.uTop.value.set(0x1b1640); skyU.uHor.value.set(0xff8a3c); skyU.uBot.value.set(0x2a1410); skyU.uSunCol.value.setRGB(1.0, 0.62, 0.28); skyU.uSunDir.value.set(-0.08, 0.05, -1).normalize(); skyU.uCloud.value = 0.75; skyU.uCloudCol.value.set(0x6b2f4a);
    bU.uFogCol.value.set(0xc86a3a); bU.uFogDen.value = 0.0026; bU.uLit.value = 0.32; bU.uWinI.value = 1.2; bU.uShop.value = 0.6; bU.uRimI.value = 1.5;
    bU.uLightCol.value.setRGB(1.0, 0.55, 0.3); bU.uLightDir.value.set(0.05, 0.25, -1).normalize(); bU.uAmb.value.setRGB(0.28, 0.22, 0.32); bU.uBase.value.set(0x2a2230);
    hemi.color.set(0xffb07a); hemi.groundColor.set(0x301a28); hemi.intensity = 1.0; sun.intensity = 0; pl1.intensity = 8; pl2.intensity = 8;
    C.gU.uGlow.value.set(0x8a3a2a); scene.fog.color.set(0xc86a3a); scene.fog.density = 0.003; C.rainA.visible = false; sunsetKey.intensity = 3.5;
  }
}
const m4 = new THREE.Matrix4(), q0 = new THREE.Quaternion(), qY = new THREE.Quaternion(), ONE = V(1, 1, 1), YA = V(0, 1, 0);
let CLEAR = [];
function animateCity(t) {
  C.bU.uTime.value = t; C.skyU.uTime.value = t; C.crowdMat.userData.uTime.value = t;
  C.train.position.z = 80 - ((t * 32) % 700);
  C.carData.forEach((d, i) => {
    const dir = d.lane < 0 ? 1 : -1; const u = (d.z0 + t * d.sp) % 900; const z = dir > 0 ? -820 + u : 80 - u;
    qY.setFromAxisAngle(YA, dir > 0 ? 0 : Math.PI);
    m4.compose(V(d.lane, 0, z), qY, ONE); C.cars.setMatrixAt(i, m4);
    m4.compose(V(d.lane, 0.75, z - dir * 2.25), qY, ONE); C.tail.setMatrixAt(i, m4);
    m4.compose(V(d.lane, 0.65, z + dir * 2.25), qY, ONE); C.head.setMatrixAt(i, m4);
  });
  C.cars.instanceMatrix.needsUpdate = C.tail.instanceMatrix.needsUpdate = C.head.instanceMatrix.needsUpdate = true;
  C.flyData.forEach((d, i) => {
    const u = (d.z0 + t * Math.abs(d.sp)) % 900; const zz = d.sp > 0 ? 80 - u : -820 + u; const y = d.y + Math.sin(t * 0.7 + i) * 1.2;
    qY.setFromAxisAngle(YA, d.sp > 0 ? 0 : Math.PI); m4.compose(V(d.x, y, zz), qY, ONE); C.fly.setMatrixAt(i, m4);
    const fz = d.sp > 0 ? -1 : 1;
    m4.compose(V(d.x, y - 0.6, zz + fz * 1.6), q0, V(1.6, 0.5, 1.6)); C.flyGlow.setMatrixAt(i * 2, m4);
    m4.compose(V(d.x, y, zz - fz * 1.9), q0, V(1.2, 0.8, 0.6)); C.flyGlow.setMatrixAt(i * 2 + 1, m4);
  });
  C.fly.instanceMatrix.needsUpdate = C.flyGlow.instanceMatrix.needsUpdate = true;
  C.crowdData.forEach((d, i) => {
    let x = d.x, z = d.z;
    if (d.cross) x = ((d.x + 6.5 + t * d.sp * 0.55) % 13 + 13) % 13 - 6.5; else z = d.z + t * d.sp * 0.55;
    qY.setFromAxisAngle(YA, d.cross ? (d.sp > 0 ? Math.PI / 2 : -Math.PI / 2) : (d.sp > 0 ? 0 : Math.PI));
    let hide = false; for (const c of CLEAR) if ((x - c[0]) ** 2 + (z - c[1]) ** 2 < c[2] * c[2]) hide = true;
    if (hide) { m4.makeTranslation(0, -80, 0); C.crowd.setMatrixAt(i, m4); C.umb.setMatrixAt(i, m4); return; }
    m4.compose(V(x, 0, z), qY, V(d.s, d.s, d.s)); C.crowd.setMatrixAt(i, m4);
    m4.compose(V(x, d.u ? 0 : -50, z), qY, V(d.s, d.s, d.s)); C.umb.setMatrixAt(i, m4);
  });
  C.crowd.instanceMatrix.needsUpdate = C.umb.instanceMatrix.needsUpdate = true;
  C.rainA.material.uniforms.uTime.value = t; C.rainA.material.uniforms.uCam.value.copy(camera.position);
  C.hHead.rotation.y = Math.sin(t * 0.8) * 0.4; C.holoPts.material.uniforms.uTime.value = t * 4;
}

// ---------- yardımcılar ----------
function place(h, parent, x, y, z, ry) { if (h.root.parent !== parent) parent.add(h.root); h.root.position.set(x, y, z); h.root.rotation.set(0, ry, 0); h.root.visible = true; }
function look(p, tgt, fov) { camera.position.copy(p); camera.fov = fov; camera.updateProjectionMatrix(); camera.up.set(0, 1, 0); camera.lookAt(tgt); }
function ots(from, to, dist, side, camY, faceY, fov) {
  const d = V(from.x - to.x, 0, from.z - to.z).normalize(); const pr = V(d.z, 0, -d.x);
  look(V(from.x + d.x * dist + pr.x * side, camY, from.z + d.z * dist + pr.z * side), V(to.x, faceY, to.z), fov);
}
function shake(t, a) { camera.rotation.z += Math.sin(t * 1.3) * a + Math.sin(t * 3.1) * a * 0.4; camera.position.y += Math.sin(t * 2.1) * a * 0.6; }
function dof(on, focus, ap = 0.004, mb = 0.008) { bokeh.enabled = on; bokeh.uniforms.focus.value = focus; bokeh.uniforms.aperture.value = ap; bokeh.uniforms.maxblur.value = mb; }
function resetFx() {
  G.uFlash.value = 0; G.uFade.value = 0; G.uZoom.value = 0; G.uWhip.value = 0; G.uAberr.value = 0.001; G.uSat.value = 1.05; G.uContrast.value = 1.06; G.uVig.value = 0.45; G.uGrain.value = 0.035;
  G.uTint.value.setRGB(1, 1, 1); G.uLift.value.setRGB(0, 0, 0); G.uCenter.value.set(0.5, 0.5); G.uFlashCol.value.setRGB(1, 1, 1);
  renderer.toneMappingExposure = 1.0; bloom.strength = 0.7; bloom.radius = 0.55; bloom.threshold = 0.85; dof(false, 3);
  streetKey.intensity = 0; roomShadow.intensity = 0; holoBeam.intensity = 0; faceKey.intensity = 0;
}
function drawMonitor(t) {
  const x = HOS.monTex._ctx, w = 512, h = 320; x.fillStyle = '#02080c'; x.fillRect(0, 0, w, h);
  const lines = [['#4af3ff', 70, 0.5], ['#7cff8a', 160, 0.9], ['#ffb04a', 250, 1.4]];
  lines.forEach(([c, y0, f]) => { x.strokeStyle = c; x.lineWidth = 3; x.shadowColor = c; x.shadowBlur = 8; x.beginPath();
    for (let px = 10; px < w - 10; px += 3) { const tt = t * 1.2 - (w - px) / 300; const ph = ((tt * f) % 1 + 1) % 1; let v = Math.sin(tt * 6 * f) * 6; if (y0 === 70 && ph > 0.4 && ph < 0.46) v = -Math.sin((ph - 0.4) / 0.06 * Math.PI) * 45; if (px === 10) x.moveTo(px, y0 + v); else x.lineTo(px, y0 + v); }
    x.stroke(); });
  x.shadowBlur = 0; HOS.monTex.needsUpdate = true;
}

function poseBaby(blink, lookY = 0) {
  for (let i = 0; i < 2; i++) { BABY.lids[i].rotation.x = lerp(-0.85, 0.15, blink); BABY.lowLids[i].rotation.x = Math.PI + 1.05; BABY.eyes[i].rotation.set(-lookY, 0, 0); }
  BABY.mouth.scale.set(0.012, 0.001, 1); BABY.teeth.scale.set(0.001, 0.0005, 1);
}
// ---------- ÇEKİM LİSTESİ ----------
let cur = null;
const SHOTS = [
  // ===== SAHNE 1: DOĞUM =====
  [0.0, 3.0, (t, k) => {
    cur = HOS.s; renderer.toneMappingExposure = 0.95; bloom.threshold = 0.92; bloom.strength = 0.55; HOS.key.position.set(0.9, 2.6, 1.2); HOS.key.intensity = 3.2;
    drawMonitor(t); HOS.rain.material.uniforms.uTime.value = t; HOS.rain.material.uniforms.uCam.value.set(0.6, 1.9, -3.0); HOS.dust.material.uniforms.uTime.value = t;
    // hemşire arka planda yürür ve monitöre bakar
    const nk = clamp(t / 2.4); place(NURSE, HOS.s, lerp(-2.6, -1.35, easeOut(nk)), 0, lerp(-1.6, -0.9, nk), lerp(1.1, 0.6, nk));
    pose(NURSE, { walk: 1 - sstep(1.8, 2.4, t), phase: t * 6.5, t, pitch: 0.1, seed: 2 });
    poseBaby(1); BABY.hand.rotation.z = 0.6 + Math.sin(t * 2.2) * 0.15;
    const e = easeIO(k);
    look(V(lerp(1.9, 1.05, e), lerp(1.75, 1.5, e), lerp(2.3, 1.1, e)), V(lerp(-0.2, 0.15, e), 1.08, 0), lerp(40, 34, e));
    shake(t, 0.002); dof(true, lerp(2.9, 1.45, e), 0.002, 0.005);
    G.uFade.value = 1 - sstep(0, 0.6, t); G.uTint.value.setRGB(0.92, 1.0, 1.08);
  }],
  [3.0, 5.0, (t, k) => {
    cur = HOS.s; renderer.toneMappingExposure = 0.95; bloom.threshold = 0.92; bloom.strength = 0.55;
    drawMonitor(t); HOS.rain.material.uniforms.uTime.value = t; HOS.dust.material.uniforms.uTime.value = t;
    place(NURSE, HOS.s, -1.35, 0, -0.9, 0.6); pose(NURSE, { t, pitch: 0.15, seed: 2 });
    // bebek gözlerini yavaşça açar
    const open = sstep(3.9, 4.6, t);
    poseBaby(1); BABY.hand.rotation.z = 0.6 + Math.sin(t * 2.6) * 0.25; BABY.hand.rotation.x = -1.9 + Math.sin(t * 1.7) * 0.15;
    const e = easeIO(k);
    camera.position.set(lerp(-0.25, -0.05, e), lerp(1.75, 1.6, e), lerp(0.42, 0.28, e)); camera.fov = lerp(34, 30, e); camera.updateProjectionMatrix();
    camera.up.set(0.97, 0, -0.25); camera.lookAt(0.3, 1.14, 0.0); BABY.hand.visible = false;
    HOS.key.position.set(0.55, 1.45, 0.75); HOS.key.intensity = 2.2; renderer.toneMappingExposure = 0.85;
    dof(true, camera.position.distanceTo(V(0.3, 1.17, 0)), 0.003, 0.005);
    G.uTint.value.setRGB(0.95, 1.0, 1.06); G.uFlash.value = sstep(4.65, 5.0, t) * 0.95; G.uFlashCol.value.setRGB(1, 0.97, 0.9);
  }],
  // ===== SAHNE 2: TEK PLANDA BÜYÜME (5 → 15 → 25, sonra sabit) =====
  [5.0, 12.0, (t, k) => {
    cur = COR.s; renderer.toneMappingExposure = 1.0; bloom.threshold = 0.9; bloom.strength = 0.5;
    // zaman atlaması: gün/gece döngüsü giderek hızlanır
    const cyc = (t - 5) * 0.55 + Math.pow(Math.max(0, t - 9.5), 2) * 0.35;
    const a = cyc * Math.PI * 2 + 0.6; const sy = Math.sin(a); const day = sstep(-0.15, 0.25, sy);
    const sunDir = V(-Math.cos(a) * 0.3 - 0.9, sy, Math.cos(a) * 0.8).normalize();
    COR.skyU.uDay.value = day; COR.skyU.uSunDir.value.copy(sunDir);
    // yaş
    const age = t < 5.8 ? 5 : t < 9.6 ? lerp(5, 25, easeIO((t - 5.8) / 3.8)) : 25;
    // yürüyüş
    const speed = lerp(0.9, 1.35, clamp((age - 5) / 20));
    const zc = -20 + (t - 5) * 1.2;
    place(EMRE, COR.s, -0.2, 0, zc, 0); setAge(EMRE, age);
    pose(EMRE, { walk: 1, phase: (t - 5) * lerp(8.5, 6.6, clamp((age - 5) / 20)), t, child: EMRE.childK, pitch: lerp(-0.05, 0.02, age / 25), seed: 1 });
    COR.sun.position.copy(V(-0.2, 1, zc).add(sunDir.clone().multiplyScalar(30))); COR.sun.target.position.set(-0.2, 0, zc);
    COR.sun.intensity = 4.5 * day * Math.max(0, sy) + 0.0; COR.sun.color.setRGB(1, lerp(0.55, 0.95, Math.min(1, sy * 2)), lerp(0.35, 0.85, Math.min(1, sy * 2)));
    COR.hemi.intensity = lerp(0.15, 0.75, day); COR.hemi.color.setRGB(lerp(0.3, 0.8, day), lerp(0.35, 0.88, day), lerp(0.6, 1, day));
    COR.lampM.color.setScalar(lerp(3.0, 0.9, day)); COR.fill.intensity = lerp(18, 2, day); COR.fill.position.set(0.5, 3.0, zc + 1.5);
    COR.s.fog.color.setRGB(lerp(0.05, 0.62, day), lerp(0.05, 0.68, day), lerp(0.09, 0.75, day));
    COR.tw.material.emissiveIntensity = (1 - day) * 0.5;
    COR.cm.userData.uTime.value = t;
    COR.pd.forEach((d, i) => { const z = ((d.z + t * d.v) % 70 + 70) % 70 - 62; m4.compose(V(d.x, 0, z), qY.setFromAxisAngle(YA, d.v > 0 ? 0 : Math.PI), ONE); COR.ppl.setMatrixAt(i, m4); });
    COR.ppl.instanceMatrix.needsUpdate = true; COR.dust.material.uniforms.uTime.value = t;
    // kamera: önünde geri geri giden steadicam, göz hizasına uyumlu
    const eyeY = lerp(0.95, 1.62, clamp((age - 5) / 20));
    const dist = lerp(2.6, 2.1, sstep(9.6, 11.6, t));
    look(V(lerp(0.55, 0.25, k), eyeY + 0.05, zc + dist), V(-0.2, eyeY - 0.08, zc), lerp(42, 30, sstep(9.6, 11.8, t)));
    shake(t, 0.003); dof(true, dist, 0.004, 0.008);
    G.uFlash.value = 0.9 * (1 - sstep(5.0, 5.35, t)); G.uFlashCol.value.setRGB(1, 0.97, 0.9);
    G.uZoom.value = sstep(11.7, 12.0, t) * 0.18; G.uFlash.value = Math.max(G.uFlash.value, sstep(11.75, 12.0, t) * 0.8);
  }],
  // ===== SAHNE 3: YILLAR SONRA, KALABALIK ŞEHİR =====
  [12.0, 17.0, (t, k) => {
    cur = C.scene; cityMood('night'); animateCity(t); bloom.threshold = 0.78; bloom.strength = 0.9;
    // Emre kalabalıkta yürüyor, kuleye doğru
    const ez = -22 - (t - 12) * 1.35; CLEAR = [[9.0, ez, 0.9], [9.6, ez + 3, 1.6]];
    place(EMRE, C.scene, 9.0, 0, ez, Math.PI); setAge(EMRE, 25);
    pose(EMRE, { walk: 1, phase: (t - 12) * 6.8, t, pitch: 0.05, seed: 1 });
    const e = easeIO(clamp((t - 12) / 4.2));
    // vinç: gökyüzünden caddeye, sonra Emre'nin arkasına
    const p = vlerp(V(-6, 70, 40), V(9.9, 2.0, ez + 3.6), e); p.x += Math.sin(e * 3) * 6 * (1 - e);
    const tg = vlerp(V(3, 20, -80), V(9.0, 1.45, ez - 3), Math.pow(e, 1.4));
    look(p, tg, lerp(55, 42, e)); shake(t, 0.003 * e);
    streetKey.intensity = 40 * e; streetKey.position.set(9.5, 7, ez + 2); streetKey.target.position.set(9, 0.8, ez);
    if (e > 0.85) dof(true, p.distanceTo(V(9, 1.4, ez)), 0.003, 0.006);
    G.uFlash.value = 0.85 * (1 - sstep(12.0, 12.4, t)); G.uZoom.value = 0.15 * (1 - sstep(12.0, 12.5, t));
    G.uTint.value.setRGB(1.0, 0.95, 1.08); G.uSat.value = 1.12;
  }],
  // ===== SAHNE 4: İŞ GÖRÜŞMESİ =====
  // 4a: Emre odaya girer, Arda bekliyor
  [17.0, 19.6, (t, k) => {
    room(t);
    const e = easeIO(k);
    look(V(lerp(14.4, 14.7, e), 31.6, lerp(-41.6, -41.2, e)), V(lerp(19.5, 18.3, e), 31.3, lerp(-35.8, -37.6, e)), 44);
    shake(t, 0.002); dof(true, 4.2, 0.003, 0.006);
    G.uFlash.value = 0.4 * (1 - sstep(17.0, 17.15, t)); G.uFlashCol.value.setRGB(0.6, 0.9, 1);
  }],
  // 4b: göz göze gelirler — Arda'nın omzu üzerinden Emre
  [19.6, 21.0, (t, k) => {
    room(t);
    const e = easeIO(k);
    ots(ARDA.root.position, EMRE.root.position, 0.8, 0.32, lerp(31.55, 31.85, sstep(20.0, 20.8, t)), 31.64, lerp(34, 30, e));
    dof(true, 1.75, 0.004, 0.007);
  }],
  // 4c: ters açı — Emre'nin omzu üzerinden konuşan Arda, elini omzuna koyar
  [21.0, 22.6, (t, k) => {
    room(t);
    const e = easeIO(k);
    ots(EMRE.root.position, ARDA.root.position, lerp(0.85, 0.75, e), -0.34, 31.82, 31.66, lerp(36, 32, e));
    dof(true, 1.75, 0.004, 0.007);
  }],
  // 4d: hologram Arda'yı seçer (geniş)
  [22.6, 23.6, (t, k) => {
    room(t);
    const e = easeIO(k);
    look(V(lerp(15.5, 15.3, e), 31.85, lerp(-41.6, -41.4, e)), V(17.2, 31.4, -39.9), 38);
    dof(true, 2.0, 0.003, 0.006);
  }],
  // 4e: Emre'nin yakın planı — reddedildi
  [23.6, 25.0, (t, k) => {
    room(t);
    const e = easeIO(k);
    const sp = EMRE.root.position, ry = EMRE.root.rotation.y;
    const f = V(Math.sin(ry), 0, Math.cos(ry)), side = V(f.z, 0, -f.x);
    const d = lerp(0.95, 0.75, e);
    look(V(sp.x + f.x * d + side.x * 0.18, 31.42, sp.z + f.z * d + side.z * 0.18), V(sp.x, 31.6, sp.z), lerp(30, 26, e));
    faceKey.position.set(sp.x + f.x * 1.4 + side.x * 0.9, 32.0, sp.z + f.z * 1.4 + side.z * 0.9); faceKey.intensity = 2.5;
    dof(true, d, 0.006, 0.008);
  }],
  // 4f: Emre çıkıp gider; Arda arkasından bakar
  [25.0, 26.6, (t, k) => {
    room(t);
    const e = easeIO(k);
    look(V(lerp(16.3, 16.45, e), 31.65, lerp(-40.9, -40.75, e)), V(lerp(18.6, 20.2, e), 31.3, lerp(-38.0, -36.4, e)), 40);
    dof(true, 3.2, 0.004, 0.007);
  }],
  // 4e: Arda pencerede, dışarıdan; yağmur
  [26.6, 28.0, (t, k) => {
    cur = C.scene; cityMood('night'); animateCity(t); bloom.threshold = 0.8;
    place(ARDA, C.scene, 12.75, 30, -38.4, -Math.PI / 2 - 0.2);
    pose(ARDA, { t, pitch: 0.45, sad: 0.8, lookY: 0.25, seed: 3 });
    place(EMRE, C.scene, 9.0, 0, -44 - (t - 26.6) * 1.3, Math.PI); pose(EMRE, { walk: 1, phase: t * 6.8, t, sad: 1, pitch: 0.3 });
    roomShadow.intensity = 6;
    const e = easeIO(k);
    look(V(lerp(9.2, 9.7, e), lerp(31.9, 31.8, e), lerp(-37.6, -37.9, e)), V(12.75, 31.5, -38.4), lerp(34, 30, e));
    faceKey.intensity = 3.5; faceKey.position.set(11.6, 32.3, -38.0);
    dof(true, 3.3, 0.003, 0.006);
    G.uTint.value.setRGB(0.93, 0.97, 1.1); G.uSat.value = 0.95; G.uFlash.value = sstep(27.7, 28.0, t) * 0.85; G.uFlashCol.value.setRGB(1, 0.75, 0.45);
  }],
  // ===== SAHNE 5: DEVASA NÜFUS — FİNAL =====
  [28.0, 35.0, (t, k) => {
    cur = C.scene; cityMood('sunset'); animateCity(t); bloom.threshold = 0.85; bloom.strength = 0.85; bloom.radius = 0.7;
    // baba ve oğul kalabalığın ortasında yan yana; insanlar akıp geçiyor
    CLEAR = [[-9.9, -67.1, 1.6], [-9.0, -64.0, 3.0]];
    place(ARDA, C.scene, -10.2, 0, -67.0, Math.PI - 0.15); pose(ARDA, { t, pitch: -0.05, seed: 3, sad: 0.2 });
    place(EMRE, C.scene, -9.65, 0, -67.15, Math.PI + 0.1); setAge(EMRE, 25); pose(EMRE, { t, pitch: -0.08, seed: 1, yaw: -sstep(29.2, 30.2, t) * 0.4 });
    ARDA.neck.rotation.y = sstep(29.6, 30.6, t) * 0.35;
    sunsetKey.position.set(-13, 25, -127); sunsetKey.target.position.set(-10, 0, -67);
    const e = easeIO(clamp((t - 28.0) / 6.4));
    const p = V(lerp(-8.6, 2, e), lerp(5.2, 230, Math.pow(e, 1.5)), lerp(-63.2, 30, e));
    const tg = V(lerp(-9.9, -2, e), lerp(1.55, lerp(1.5, 210, e), Math.pow(e, 1.2)), lerp(-67.5, -400, Math.pow(e, 0.8)));
    look(p, tg, lerp(42, 60, e)); shake(t, 0.002);
    if (t < 29.4) dof(true, 5.4, 0.002, 0.005);
    G.uTint.value.setRGB(1.06, 0.97, 0.9); G.uSat.value = 1.12; G.uLift.value.setRGB(0.012, 0.0, 0.01);
    G.uFlash.value = 0.7 * (1 - sstep(28.0, 28.35, t)); G.uFlashCol.value.setRGB(1, 0.8, 0.5);
    G.uFade.value = sstep(32.6, 33.4, t) * 0.45 + sstep(34.55, 34.95, t) * 0.55;
  }],
];

// oda içi oyunculuk (17–26.6)
function room(t) {
  cur = C.scene; cityMood('night'); animateCity(t); bloom.threshold = 0.8; bloom.strength = 0.75;
  G.uTint.value.setRGB(0.98, 0.98, 1.04); G.uVig.value = 0.5; roomShadow.intensity = 14; renderer.toneMappingExposure = 1.1; bloom.threshold = 0.95;
  faceKey.intensity = 2.2; faceKey.position.set(15.2, 32.2, -37.8);
  // ARDA: oturuyor (17–20.2), kalkar, oğluna adım atar, elini omzuna koyar, hologram onu seçer
  const stand = sstep(20.0, 20.8, t);
  const step = sstep(21.0, 21.7, t);
  const fp = vlerp(V(16.95, 30, -40.85), V(17.12, 30, -40.0), step);
  const turnToSon = sstep(18.0, 18.8, t);
  const faceHolo = sstep(22.7, 23.0, t) * (1 - sstep(23.5, 23.9, t));
  ARDA.root.visible = true; place(ARDA, C.scene, fp.x, fp.y, fp.z, lerp(-Math.PI / 2, lerp(-0.6, 0.25, stand), turnToSon));
  pose(ARDA, { sit: 1 - stand, t, seed: 3, walk: sstep(21.0, 21.2, t) * (1 - sstep(21.5, 21.7, t)), phase: t * 6,
    yaw: lerp(0.0, 0.0, 0) - faceHolo * 1.2 + (t > 24.9 ? sstep(25.0, 25.6, t) * 0.5 : 0),
    surprise: sstep(18.6, 19.0, t) * (1 - sstep(20.6, 21.4, t)), talk: (t > 20.9 && t < 22.4 ? 1 : 0) + (t > 23.7 && t < 24.6 ? 0.8 : 0),
    reach: sstep(21.5, 21.95, t) * (1 - sstep(24.3, 24.9, t)) + (t > 25.1 ? sstep(25.2, 25.6, t) * 0.55 : 0),
    sad: sstep(23.6, 24.0, t) * 0.7, pitch: 0.0 });
  // EMRE: kapıdan girer (17–18.9), durur, şaşırır, dinler, reddedilir, döner ve çıkar (25–26.6)
  let ep, ery, walk = 0, ph = 0;
  const door = V(21.0, 30, -35.4), stop = V(17.55, 30, -39.15);
  if (t < 18.9) { const w = easeOut(clamp((t - 17.0) / 1.9)); ep = vlerp(door, stop, w); ery = Math.atan2(stop.x - door.x, stop.z - door.z); walk = 1 - sstep(18.6, 18.9, t); ph = (t - 17) * 6.8; }
  else if (t < 25.0) { ep = stop.clone(); ery = lerp(Math.atan2(stop.x - door.x, stop.z - door.z), Math.atan2(fp.x - stop.x, fp.z - stop.z), sstep(18.9, 19.4, t)); }
  else { const w = clamp((t - 25.15) / 1.45); ep = vlerp(stop, V(20.1, 30, -36.3), w); ery = lerp(Math.atan2(fp.x - stop.x, fp.z - stop.z), Math.atan2(20.1 - stop.x, -36.3 - stop.z), sstep(25.0, 25.35, t)); walk = sstep(25.1, 25.3, t); ph = (t - 25) * 6.8; }
  place(EMRE, C.scene, ep.x, ep.y, ep.z, ery); setAge(EMRE, 25);
  const rejected = sstep(23.05, 23.5, t);
  pose(EMRE, { t, walk, phase: ph, seed: 1, surprise: sstep(18.7, 19.0, t) * (1 - sstep(20.8, 21.6, t)),
    talk: t > 19.4 && t < 20.4 ? 1 : 0, sad: Math.max(rejected, sstep(25, 25.3, t)), pitch: 0.05 + rejected * 0.2, lookY: rejected * 0.25, yaw: -sstep(22.65, 22.95, t) * 0.6 * (1 - sstep(23.2, 23.5, t)) });
  // hologram seçimi
  const sel = sstep(22.6, 22.9, t) * (1 - sstep(25.2, 25.8, t));
  holoBeam.intensity = 25 * sel; holoBeam.target.position.set(fp.x, 30.9, fp.z);
  C.holo.scale.setScalar(1 + 0.08 * sel); C.hHead.material.color.setRGB(lerp(0.3, 0.4, sel), lerp(1.8, 2.6, sel), lerp(2.4, 1.6, sel));
  C.door.position.z = -35 + Math.max(sstep(16.9, 17.2, t) * (1 - sstep(18.0, 18.4, t)), sstep(25.6, 26.0, t)) * 1.3;
}

// ---------- kare ----------
const out = document.getElementById('out'); const ctx = out.getContext('2d');
window.DEBUG_NOCROWD = false;
window.renderFrame = function (t) {
  resetFx(); G.uTime.value = t; CLEAR = [];
  for (const h of [ARDA, EMRE, NURSE]) h.root.visible = false;
  const shot = SHOTS.find(s => t >= s[0] && t < s[1]) || SHOTS[SHOTS.length - 1];
  camera.rotation.set(0, 0, 0); camera.up.set(0, 1, 0); BABY.hand.visible = true;
  shot[2](t, clamp((t - shot[0]) / (shot[1] - shot[0])));
  renderPass.scene = cur; renderPass.camera = camera; bokeh.scene = cur; bokeh.camera = camera;
  if (window.DEBUG_NOCROWD) { C.crowd.visible = false; C.umb.visible = false; }
  composer.render();
  ctx.drawImage(glCanvas, 0, 0, W, H);
  return out.toDataURL('image/jpeg', 0.94);
};

(async () => {
  await Promise.all(pending);
  for (const tt of [1, 6, 13, 18, 30]) window.renderFrame(tt);
  window.READY = true;
})();
