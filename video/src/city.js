// Şehir dünyası (yazısız neon tabelalar), görüşme odası dahil
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { crowdGeometry, crowdMaterial } from './human.js';
const RS = 1;
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

const M = (c, r = 0.6, m = 0, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...extra });
const SKIN = M(0xe0a37f, 0.48, 0, { emissive: 0x3a1408, emissiveIntensity: 0.25 });
function mesh(geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = false; return m; }

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
        const rr = rng(si * 31 + 7); x.lineCap = 'round'; x.shadowBlur = 22;
        const kind = Math.floor(rr() * 4);
        for (let pass = 0; pass < 2; pass++) {
          x.strokeStyle = pass ? 'rgba(255,255,255,0.7)' : col; x.lineWidth = pass ? 4 : 14; x.shadowColor = col;
          if (kind === 0) { for (let k = 0; k < 3; k++) { x.beginPath(); x.arc(w / 2, h / 2, Math.min(w, h) * (0.15 + k * 0.1), 0, 7); x.stroke(); } }
          else if (kind === 1) { const n = vertical ? 5 : 4; for (let k = 0; k < n; k++) { x.beginPath(); if (vertical) { x.moveTo(40, 60 + k * (h - 120) / (n - 1)); x.lineTo(w - 40, 60 + k * (h - 120) / (n - 1)); } else { x.moveTo(60 + k * (w - 120) / (n - 1), 40); x.lineTo(60 + k * (w - 120) / (n - 1), h - 40); } x.stroke(); } }
          else if (kind === 2) { x.beginPath(); if (vertical) { x.moveTo(w / 2, 50); x.lineTo(w / 2, h - 50); } else { x.moveTo(50, h / 2); x.lineTo(w - 50, h / 2); } x.stroke(); x.beginPath(); x.arc(vertical ? w / 2 : w * 0.25, vertical ? h * 0.3 : h / 2, Math.min(w, h) * 0.22, 0, 7); x.stroke(); }
          else { x.beginPath(); const cx = w / 2, cy = h / 2, rr2 = Math.min(w, h) * 0.32; for (let k = 0; k <= 6; k++) { const a = k / 6 * 6.283 + 0.5; x.lineTo(cx + Math.cos(a) * rr2, cy + Math.sin(a) * rr2); } x.stroke(); }
        }
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
  const personGeo = crowdGeometry();
  const NP = 2600;
  const crowdMat = crowdMaterial(); const crowd = new THREE.InstancedMesh(personGeo, crowdMat, NP);
  const umb = new THREE.InstancedMesh(new THREE.ConeGeometry(0.62, 0.32, 12, 1, true).translate(0, 2.0, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, transparent: true, opacity: 0.85, side: THREE.DoubleSide, emissive: 0x111111 }), NP);
  const pal = [0xe8c33a, 0x3a6fe8, 0xd6d9e0, 0x2b2d36, 0xc23b5a, 0x6ad1e3, 0xe07a2b, 0x8b5bd6, 0x1c1e26, 0x9aa0a8];
  const crowdData = [];
  for (let i = 0; i < NP; i++) {
    let x, z, sp;
    const zone = r();
    if (zone < 0.55) { const s = r() < 0.5 ? -1 : 1; x = s * (7.6 + r() * 3.9); z = 40 - r() * 600; }
    else if (zone < 0.8) { x = (r() - 0.5) * 13; z = -60 - Math.floor(r() * 6) * 90 - r() * 6; }
    else { x = (r() - 0.5) * 13; z = 40 - r() * 500; }
    if (x > 6.5 && z < 6 && z > -75 && Math.abs(x - 9.0) < 0.9) { x = x < 9 ? 7.7 : 10.7; }
    if (d_cross_skip(x, z)) { z -= 90; }
    sp = (0.8 + r() * 0.8) * (r() < 0.5 ? 1 : -1);
    crowdData.push({ x, z, sp, ph: r() * 6.28, u: r() < 0.22, s: 0.9 + r() * 0.2, cross: zone >= 0.55 && zone < 0.8 });
    crowd.setColorAt(i, new THREE.Color(pal[Math.floor(r() * pal.length)]));
    umb.setColorAt(i, new THREE.Color().setHSL(r(), 0.6, 0.6));
  }
  const aPh = new Float32Array(NP), aSp = new Float32Array(NP); crowdData.forEach((d, i) => { aPh[i] = d.ph; aSp[i] = Math.abs(d.sp) * 0.55; });
  personGeo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(aPh, 1)); personGeo.setAttribute('aSpeed', new THREE.InstancedBufferAttribute(aSp, 1));
  crowd.castShadow = false; scene.add(crowd, umb);
  crowd.frustumCulled = umb.frustumCulled = cars.frustumCulled = tail.frustumCulled = head.frustumCulled = fly.frustumCulled = flyGlow.frustumCulled = false;

  // ışıklar
  const hemi = new THREE.HemisphereLight(0x8a7cff, 0x2a1020, 0.9); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xff9a5a, 0.0); sun.position.set(0, 20, -100); scene.add(sun);
  const pl1 = new THREE.PointLight(0xff2bd6, 60, 40, 1.6); pl1.position.set(-6, 6, -45); scene.add(pl1);
  const pl2 = new THREE.PointLight(0x2bf3ff, 60, 40, 1.6); pl2.position.set(10, 4, -50); scene.add(pl2);

  const portal = mesh(new THREE.BoxGeometry(0.2, 3.2, 3.0), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 2.2, 3.0) }), 12.0, 1.6, -40); scene.add(portal);
  const portalIn = mesh(new THREE.BoxGeometry(0.25, 2.9, 2.6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 0.8, 0.65) }), 12.02, 1.45, -40); scene.add(portalIn);
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

  const rainA = rain(9000, V(70, 45, 70), 0x9fb8ff, 0.9, 26, 0.32, 9); scene.add(rainA);
  scene.fog = new THREE.FogExp2(0x2a1638, 0.004);

  return { scene, sky, skyU, bU, gU, train, cars, tail, head, carData, fly, flyGlow, flyData, crowd, umb, crowdData, crowdMat, popTex, popBoard, hemi, sun, pl1, pl2, chairs, holo, hHead, holoPts, decTex, door, rainA, signs, signMirror, room };
}


export { buildCity, rng, clamp, lerp, sstep, easeIO, easeOut, V, vlerp, dust, rain, canvasTex, M, mesh, pending };
