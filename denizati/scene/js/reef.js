import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { canvasTexture, rng, softDotTexture } from './util.js';

// ---------------------------------------------------------------------------
// Sunny, colourful coral reef (units ≈ seahorse heights). Sand with animated
// caustics, rocks, branching / brain / table corals, sea fans, tube sponges,
// swaying anemones and seagrass, small tropical fish schools, god rays,
// rising bubbles and drifting "marine snow". Everything animates from uTime.
// ---------------------------------------------------------------------------
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const uTime = { value: 0 };

const CAUSTIC = /* glsl */ `
  uniform float uTime;
  varying vec3 vWPos;
  varying vec3 vWNorm;
  float caustic(vec2 p, float t){
    vec2 i = p; float c = 1.0; float inten = 0.005;
    for (int n = 0; n < 4; n++) {
      float tt = t * (1.0 - (3.5 / float(n + 1)));
      i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
      vec2 dd = vec2(sin(i.x + tt), cos(i.y + tt)) / inten;
      dd = sign(dd) * max(abs(dd), vec2(1e-4));
      c += 1.0 / max(length(vec2(p.x, p.y) / dd), 1e-3);
    }
    c /= 4.0; c = 1.17 - pow(clamp(c, 0.0, 4.0), 1.4);
    return clamp(pow(abs(c), 8.0), 0.0, 2.0);
  }`;
// add caustic light to any standard/physical material (strongest on upward faces)
function withCaustics(mat, strength = 0.55, scale = 0.9) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNorm;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vec4 wp4 = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          wp4 = instanceMatrix * wp4;
        #endif
        vWPos = (modelMatrix * wp4).xyz;
        vWNorm = normalize(mat3(modelMatrix) * objectNormal);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + CAUSTIC)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float cst = caustic(vWPos.xz * ${scale.toFixed(3)} + vec2(vWPos.y * 0.3), uTime * 0.5 + 23.0);
        totalEmissiveRadiance += diffuseColor.rgb * vec3(0.75, 1.0, 1.0) * cst * ${strength.toFixed(3)} * smoothstep(-0.2, 0.8, vWNorm.y);`);
  };
  mat.customProgramCacheKey = () => 'caustic' + strength + scale;
  return mat;
}

function sandTex() {
  const r = rng(3);
  return canvasTexture(1024, 1024, (g, w, h) => {
    g.fillStyle = '#e8d5a8';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 60000; i++) {
      const c = 180 + r() * 70;
      g.fillStyle = `rgba(${c},${c - 15},${c - 50},${0.25 + r() * 0.3})`;
      g.fillRect(r() * w, r() * h, 2, 2);
    }
    // ripples
    g.strokeStyle = 'rgba(150,120,70,0.18)';
    g.lineWidth = 6;
    for (let y = 0; y < h; y += 26) {
      g.beginPath();
      for (let x = 0; x <= w; x += 16) g.lineTo(x, y + 8 * Math.sin(x * 0.02 + y * 0.05));
      g.stroke();
    }
  }, { repeat: [24, 24] });
}

// recursive branching coral → one merged geometry with vertex colours (dark base → bright tips)
function branchCoral(seed, base, tip, { depth = 4, len = 0.55, rad = 0.07, spread = 0.55 } = {}) {
  const r = rng(seed);
  const geos = [];
  const cb = new THREE.Color(base), ct = new THREE.Color(tip);
  const grow = (p, dir, l, rd, d) => {
    const end = p.clone().addScaledVector(dir, l);
    const g = new THREE.CylinderGeometry(rd * 0.72, rd, l, 7, 1);
    g.translate(0, l / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir));
    g.translate(p.x, p.y, p.z);
    const col = cb.clone().lerp(ct, 1 - d / depth);
    const cols = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < g.attributes.position.count; i++) {
      const k = (g.attributes.position.getY(i) - p.y) / Math.max(1e-3, end.y - p.y);
      const c2 = col.clone().lerp(cb.clone().lerp(ct, 1 - (d - 1) / depth), Math.max(0, Math.min(1, k)));
      cols.set([c2.r, c2.g, c2.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    geos.push(g.toNonIndexed());
    if (d <= 1) {
      const s = new THREE.SphereGeometry(rd * 0.85, 8, 6);
      s.translate(end.x, end.y, end.z);
      const c = new Float32Array(s.attributes.position.count * 3);
      for (let i = 0; i < s.attributes.position.count; i++) c.set([ct.r, ct.g, ct.b], i * 3);
      s.setAttribute('color', new THREE.BufferAttribute(c, 3));
      geos.push(s.toNonIndexed());
      return;
    }
    const n = 2 + (r() < 0.45 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const a = r() * Math.PI * 2;
      const nd = dir.clone().add(V(Math.cos(a) * spread, 0.25 + r() * 0.3, Math.sin(a) * spread)).normalize();
      grow(end, nd, l * (0.68 + r() * 0.2), rd * 0.72, d - 1);
    }
  };
  grow(V(), V(0, 1, 0), len, rad, depth);
  for (const g of geos) g.deleteAttribute('uv');
  return mergeGeometries(geos);
}

function brainTex(c1, c2) {
  const r = rng(11);
  return canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = c1;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = c2;
    g.lineWidth = 7;
    g.lineCap = 'round';
    for (let k = 0; k < 90; k++) {
      let x = r() * w, y = r() * h, a = r() * 6.28;
      g.beginPath();
      g.moveTo(x, y);
      for (let i = 0; i < 26; i++) { a += (r() - 0.5) * 1.1; x += Math.cos(a) * 9; y += Math.sin(a) * 9; g.lineTo(x, y); }
      g.stroke();
    }
  });
}

function fanTex(col) {
  const r = rng(5);
  return canvasTexture(512, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = col;
    g.lineCap = 'round';
    // fan: branching veins from the bottom centre, plus a fine lattice
    const vein = (x, y, a, l, wdt) => {
      if (l < 8) return;
      const x2 = x + Math.cos(a) * l, y2 = y - Math.sin(a) * l;
      g.lineWidth = wdt;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
      vein(x2, y2, a + 0.25 + r() * 0.15, l * 0.8, wdt * 0.8);
      vein(x2, y2, a - 0.25 - r() * 0.15, l * 0.8, wdt * 0.8);
    };
    vein(w / 2, h, Math.PI / 2, 120, 10);
    g.lineWidth = 2;
    g.globalAlpha = 0.7;
    for (let i = 0; i < 70; i++) { g.beginPath(); g.arc(w / 2, h, 40 + i * 6, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
  });
}

// keep the space between each set-up and its camera free of props
const SITES = [[0, 0], [3.2, -3.2], [-5, 3], [2.4, 2.6], [0.3, 0.6]];
const clearZone = (x, z) => SITES.some(([sx, sz]) => (Math.abs(x - sx) < 2.6 && z > sz - 0.6 && z < sz + 6) || (x > sx - 0.5 && x < sx + 4 && Math.abs(z - sz) < 2.2 && sz > 2));

export function createReef() {
  const scene = new THREE.Scene();
  const R = rng(7);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vP; void main(){ float y = vP.y;
      vec3 top = vec3(0.45, 0.9, 1.0), mid = vec3(0.05, 0.52, 0.72), low = vec3(0.02, 0.22, 0.38);
      vec3 c = y > 0.0 ? mix(mid, top, pow(y, 0.7)) : mix(mid, low, pow(-y, 0.6));
      gl_FragColor = vec4(c, 1.0); }`,
  }));
  scene.add(sky);
  scene.fog = new THREE.FogExp2('#127fa6', 0.045);

  // ---- light ----
  scene.add(new THREE.HemisphereLight('#aef0ff', '#3a6f6a', 1.25));
  const sun = new THREE.DirectionalLight('#fff4d8', 2.8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  const rim = new THREE.DirectionalLight('#7fe6ff', 1.6);
  scene.add(rim, rim.target);
  const setFocus = (c, span = 4) => {
    sun.target.position.copy(c);
    sun.position.copy(c).add(V(2.5, 9, 3.5));
    const s = sun.shadow.camera;
    s.left = s.bottom = -span; s.right = s.top = span; s.near = 0.5; s.far = 30;
    s.updateProjectionMatrix();
    rim.target.position.copy(c);
    rim.position.copy(c).add(V(-4, 3, -6));
  };
  setFocus(V());

  // ---- sand ----
  const sandGeo = new THREE.PlaneGeometry(160, 160, 160, 160);
  sandGeo.rotateX(-Math.PI / 2);
  {
    const p = sandGeo.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, 0.12 * Math.sin(x * 0.45) * Math.cos(z * 0.37) + 0.05 * Math.sin(x * 1.3 + z * 0.9)); }
    sandGeo.computeVertexNormals();
  }
  const sand = new THREE.Mesh(sandGeo, withCaustics(new THREE.MeshStandardMaterial({ map: sandTex(), roughness: 0.95 }), 0.9, 0.7));
  sand.receiveShadow = true;
  scene.add(sand);

  // ---- rocks ----
  const rockMat = withCaustics(new THREE.MeshStandardMaterial({ color: '#8a6f9a', roughness: 0.9, flatShading: false }));
  const rockGeo = new THREE.IcosahedronGeometry(1, 3);
  {
    const p = rockGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const v = V(p.getX(i), p.getY(i), p.getZ(i));
      const n = 1 + 0.18 * Math.sin(v.x * 4.1 + v.y * 2.3) * Math.cos(v.z * 3.7) + 0.08 * Math.sin(v.y * 9 + v.x * 7);
      v.multiplyScalar(n);
      p.setXYZ(i, v.x, v.y * 0.65, v.z);
    }
    rockGeo.computeVertexNormals();
  }
  const ROCKS = [[-3.2, -4.5, 1.8], [3.8, -5, 2.2], [-6, 1, 1.5], [6.5, 0.5, 1.7], [0.5, -7, 2.6], [-1.5, 5.5, 1.2], [8, -3, 2], [-8, -3, 2.3]];
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, ROCKS.length);
  ROCKS.forEach(([x, z, s], i) => rocks.setMatrixAt(i, new THREE.Matrix4().compose(V(x, 0.1, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, R() * 6, 0)), V(s, s, s))));
  rocks.castShadow = rocks.receiveShadow = true;
  scene.add(rocks);

  // ---- corals (instanced variants on rocks and sand) ----
  const coralMat = withCaustics(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.65 }), 0.5);
  const VARIANTS = [
    branchCoral(1, '#7a2a8a', '#ff7ad9', { depth: 4, len: 0.5 }),
    branchCoral(2, '#a03a10', '#ffb347', { depth: 4, len: 0.45, spread: 0.7 }),
    branchCoral(3, '#204a9a', '#7af0ff', { depth: 5, len: 0.38, rad: 0.05 }),
    branchCoral(4, '#9a1030', '#ff6b6b', { depth: 4, len: 0.42, spread: 0.45 }),
  ];
  const coralSpots = [];
  while (coralSpots.length < 70) {
    const a = R() * Math.PI * 2, rr = 2.4 + R() * 9;
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    if (!clearZone(x, z)) coralSpots.push([x, z, R()]);
  }
  const spot = (r0, r1) => { for (;;) { const a = R() * 6.28, rr = r0 + R() * (r1 - r0); const x = Math.cos(a) * rr, z = Math.sin(a) * rr; if (!clearZone(x, z)) return [x, z]; } };
  VARIANTS.forEach((g, vi) => {
    const list = coralSpots.filter((_, i) => i % 4 === vi);
    const im = new THREE.InstancedMesh(g, coralMat, list.length);
    list.forEach(([x, z, s], i) => im.setMatrixAt(i, new THREE.Matrix4().compose(V(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, s * 9, 0)), V(1, 1, 1).multiplyScalar(0.8 + s * 1.1))));
    im.castShadow = im.receiveShadow = true;
    scene.add(im);
  });
  // brain corals
  const brain = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 28, 16), withCaustics(new THREE.MeshStandardMaterial({ map: brainTex('#9bd84a', '#5f8f2a'), roughness: 0.8 })), 9);
  for (let i = 0; i < 9; i++) {
    const [x, z] = spot(2.8, 9.8);
    brain.setMatrixAt(i, new THREE.Matrix4().compose(V(x, 0, z), new THREE.Quaternion(), V(1, 0.55, 1).multiplyScalar(0.35 + R() * 0.4)));
  }
  brain.castShadow = brain.receiveShadow = true;
  scene.add(brain);
  // table corals
  const tableGeo = mergeGeometries([new THREE.CylinderGeometry(0.06, 0.1, 0.5, 8).translate(0, 0.25, 0), new THREE.CylinderGeometry(0.75, 0.15, 0.12, 24).translate(0, 0.55, 0)]);
  const table = new THREE.InstancedMesh(tableGeo, withCaustics(new THREE.MeshStandardMaterial({ color: '#3fc9b0', roughness: 0.7 })), 6);
  for (let i = 0; i < 6; i++) {
    const [x, z] = spot(4, 10);
    table.setMatrixAt(i, new THREE.Matrix4().compose(V(x, 0, z), new THREE.Quaternion(), V(1, 1, 1).multiplyScalar(0.7 + R() * 0.7)));
  }
  table.castShadow = table.receiveShadow = true;
  scene.add(table);
  // tube sponges
  const tubeMat = withCaustics(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.75, side: THREE.DoubleSide }));
  const tubes = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.11, 0.08, 1, 14, 1, true).translate(0, 0.5, 0), tubeMat, 24);
  for (let i = 0; i < 24; i++) {
    if (i % 4 === 0) tubes.userData.c = spot(3.5, 9);
    const x = tubes.userData.c[0] + (R() - 0.5) * 0.5, z = tubes.userData.c[1] + (R() - 0.5) * 0.5;
    tubes.setMatrixAt(i, new THREE.Matrix4().compose(V(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler((R() - 0.5) * 0.3, 0, (R() - 0.5) * 0.3)), V(1, 0.6 + R() * 0.9, 1)));
    tubes.setColorAt(i, new THREE.Color().setHSL(0.75 + R() * 0.2, 0.7, 0.55));
  }
  tubes.castShadow = true;
  scene.add(tubes);
  // sea fans (sway)
  const fans = [];
  for (let i = 0; i < 7; i++) {
    const col = ['#ff5a5a', '#c76bff', '#ff9a3c', '#ff4fa0'][i % 4];
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6).translate(0, 0.8, 0), new THREE.MeshStandardMaterial({ map: fanTex(col), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.7 }));
    const [fx, fz] = spot(5, 11);
    m.position.set(fx, 0, fz);
    m.rotation.y = R() * 3;
    m.scale.setScalar(0.8 + R() * 0.8);
    m.castShadow = true;
    scene.add(m);
    fans.push({ m, ph: R() * 6 });
  }

  // ---- anemones: tentacles bend in the vertex shader ----
  const tentacle = new THREE.CapsuleGeometry(0.025, 0.32, 3, 6).translate(0, 0.18, 0);
  const anemGeos = [];
  for (let k = 0; k < 60; k++) {
    const a = (k / 60) * Math.PI * 2 * 3.1, rr = 0.05 + 0.2 * (k / 60);
    const g = tentacle.clone();
    g.applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(a) * 0.6 * rr * 4, 0, -Math.cos(a) * 0.6 * rr * 4)));
    g.translate(Math.cos(a) * rr, 0.12, Math.sin(a) * rr);
    const ph = new Float32Array(g.attributes.position.count).fill(k * 0.37);
    g.setAttribute('ph', new THREE.BufferAttribute(ph, 1));
    anemGeos.push(g);
  }
  const anemBase = new THREE.CylinderGeometry(0.22, 0.28, 0.14, 16).translate(0, 0.07, 0);
  anemBase.setAttribute('ph', new THREE.BufferAttribute(new Float32Array(anemBase.attributes.position.count).fill(-1), 1));
  const anemGeo = mergeGeometries([...anemGeos.map((g) => { g.deleteAttribute('uv'); return g; }), (() => { anemBase.deleteAttribute('uv'); return anemBase; })()]);
  const anemMat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ff3f9a', emissiveIntensity: 0.18, roughness: 0.5 });
  anemMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;\nattribute float ph;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        if (ph >= 0.0) { float h = max(0.0, position.y - 0.12); float sw = sin(uTime * 1.6 + ph + float(gl_InstanceID)) * 0.35 * h * h * 4.0;
          transformed.x += sw; transformed.z += cos(uTime * 1.3 + ph) * 0.2 * h * h * 4.0; }`);
  };
  const anemones = new THREE.InstancedMesh(anemGeo, anemMat, 10);
  for (let i = 0; i < 10; i++) {
    const [x, z] = spot(2.2, 7.2);
    anemones.setMatrixAt(i, new THREE.Matrix4().compose(V(x, 0, z), new THREE.Quaternion(), V(1, 1, 1).multiplyScalar(0.9 + R() * 0.7)));
    anemones.setColorAt(i, new THREE.Color().setHSL([0.92, 0.08, 0.55, 0.8][i % 4], 0.8, 0.65));
  }
  anemones.castShadow = true;
  scene.add(anemones);

  // ---- seagrass meadow (instanced bending blades) ----
  const blade = new THREE.PlaneGeometry(0.07, 1, 1, 8).translate(0, 0.5, 0);
  const grassMat = new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide, roughness: 0.6, emissive: '#1f6a2a', emissiveIntensity: 0.15 });
  grassMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float h = position.y; float id = float(gl_InstanceID);
        transformed.x += sin(uTime * 1.2 + id * 0.7 + h * 1.5) * 0.18 * h * h;
        transformed.z += cos(uTime * 0.9 + id * 1.3) * 0.08 * h * h;`);
  };
  const GRASS = { x: -5, z: 3, r: 3.2 };
  const NG = 760;
  const grass = new THREE.InstancedMesh(blade, grassMat, NG);
  for (let i = 0; i < NG; i++) {
    const far = i > 420;
    let x, z;
    do { const a = R() * 6.28, rr = GRASS.r * Math.sqrt(R()); x = GRASS.x + Math.cos(a) * rr * 1.4; z = GRASS.z + Math.sin(a) * rr; } while (!far && z > GRASS.z - 0.7);
    if (far) { x = (R() - 0.5) * 34; z = -5 - R() * 10; }
    grass.setMatrixAt(i, new THREE.Matrix4().compose(V(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, R() * 6.28, 0)), V(1, 0.7 + R() * 1.0, 1)));
    grass.setColorAt(i, new THREE.Color().setHSL(0.3 + R() * 0.08, 0.6, 0.38 + R() * 0.15));
  }
  scene.add(grass);
  // the stalk the father holds on to (moved per shot)
  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.038, 1, 10).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: '#46a855', roughness: 0.6 }));
  stalk.castShadow = true;
  scene.add(stalk);

  // ---- small tropical fish (instanced, tails wiggle in the shader) ----
  const fishGeo = (() => {
    const bodyG = new THREE.SphereGeometry(1, 16, 10);
    bodyG.scale(0.035, 0.09, 0.14);
    const tail = new THREE.ConeGeometry(0.07, 0.09, 4);
    tail.rotateX(-Math.PI / 2);
    tail.scale(0.35, 1, 1);
    tail.translate(0, 0, -0.17);
    const fin = new THREE.ConeGeometry(0.03, 0.08, 3).translate(0, 0.1, -0.02);
    const g = mergeGeometries([bodyG, tail, fin].map((x) => { x.deleteAttribute('uv'); return x.toNonIndexed(); }));
    return g;
  })();
  const fishMat = new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.1 });
  fishMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float behind = max(0.0, -position.z - 0.02);
        transformed.x += sin(uTime * 14.0 + float(gl_InstanceID) * 1.7) * behind * 0.6;`);
  };
  const NF = 46;
  const fish = new THREE.InstancedMesh(fishGeo, fishMat, NF);
  const fishData = [];
  const palettes = ['#2f7bff', '#ffd23f', '#ff7a2f', '#4af0c8', '#ff4fa0'];
  for (let i = 0; i < NF; i++) {
    const school = i % 4;
    fishData.push({ school, r: 1.8 + school * 0.6 + R() * 0.6, y: 1.2 + school * 0.5 + R() * 0.6, ph: R() * 6.28, sp: (0.18 + R() * 0.05) * (school % 2 ? -1 : 1), off: R() });
    fish.setColorAt(i, new THREE.Color(palettes[(school + (R() < 0.3 ? 1 : 0)) % palettes.length]));
  }
  fish.castShadow = true;
  scene.add(fish);

  // ---- god rays ----
  const rayTex = canvasTexture(128, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    const v = g.createLinearGradient(0, 0, 0, h);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(0.2, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = v;
    g.fillRect(0, 0, w, h);
  });
  const rays = [];
  for (let i = 0; i < 9; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 16).translate(0, -8, 0), new THREE.MeshBasicMaterial({ map: rayTex, color: new THREE.Color(0.55, 0.85, 0.9), transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    m.position.set((R() - 0.5) * 18, 12, (R() - 0.5) * 18);
    m.rotation.z = 0.25;
    scene.add(m);
    rays.push({ m, ph: R() * 6, w: 0.8 + R() * 1.6 });
  }

  // ---- ambient bubbles and marine snow ----
  const bubbleTex = canvasTexture(64, 64, (g, w, h) => {
    g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 4; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 4, 0, 6.283); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fill();
    g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); g.arc(w * 0.35, h * 0.35, 6, 0, 6.283); g.fill();
  });
  const NB = 160;
  const bGeo = new THREE.BufferGeometry();
  bGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NB * 3), 3));
  const bubbles = new THREE.Points(bGeo, new THREE.PointsMaterial({ map: bubbleTex, size: 0.07, transparent: true, depthWrite: false, opacity: 0.9 }));
  bubbles.frustumCulled = false;
  scene.add(bubbles);
  const bSeeds = Array.from({ length: NB }, () => [(R() - 0.5) * 16, (R() - 0.5) * 16, R(), 0.35 + R() * 0.5]);
  const NS = 500;
  const sGeo = new THREE.BufferGeometry();
  sGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NS * 3), 3));
  const snow = new THREE.Points(sGeo, new THREE.PointsMaterial({ map: softDotTexture(), size: 0.035, color: '#e8fbff', transparent: true, opacity: 0.55, depthWrite: false }));
  snow.frustumCulled = false;
  scene.add(snow);
  const sSeeds = Array.from({ length: NS }, () => [(R() - 0.5) * 14, R() * 5, (R() - 0.5) * 14, R() * 6.28]);

  return {
    scene, sun, rim, setFocus, uTime, stalk, GRASS,
    update(t, focus = V()) {
      uTime.value = t;
      for (const f of fans) f.m.rotation.x = Math.sin(t * 0.8 + f.ph) * 0.08;
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
      fishData.forEach((d, i) => {
        const a = d.ph + t * d.sp * 2.2 + d.off * 0.6;
        const cx = [2.5, -5, 4.5, -1.5][d.school], cz = [-7, -1.5, -1.5, -6][d.school];
        const p = V(cx + Math.cos(a) * d.r, d.y + 0.25 * Math.sin(t * 0.7 + i), cz + Math.sin(a) * d.r * 0.7);
        const tg = V(-Math.sin(a) * d.r, 0, Math.cos(a) * d.r * 0.7).multiplyScalar(Math.sign(d.sp)).normalize();
        q.setFromUnitVectors(V(0, 0, 1), tg);
        m4.compose(p, q, V(1, 1, 1).multiplyScalar(1.15));
        fish.setMatrixAt(i, m4);
      });
      fish.instanceMatrix.needsUpdate = true;
      for (const r of rays) {
        r.m.material.opacity = 0.11 + 0.07 * Math.sin(t * 0.6 + r.ph);
        r.m.scale.x = r.w * (0.8 + 0.2 * Math.sin(t * 0.4 + r.ph));
      }
      const ba = bGeo.attributes.position.array;
      bSeeds.forEach(([x, z, o, sp], i) => {
        const y = ((o * 6 + t * sp) % 6);
        ba.set([focus.x + x + Math.sin(t * 2 + i) * 0.05, y, focus.z + z], i * 3);
      });
      bGeo.attributes.position.needsUpdate = true;
      const sa = sGeo.attributes.position.array;
      sSeeds.forEach(([x, y, z, p], i) => {
        sa.set([focus.x + x + Math.sin(t * 0.3 + p) * 0.3, ((y - t * 0.05) % 5 + 5) % 5 + 0.1, focus.z + z + Math.cos(t * 0.25 + p) * 0.3], i * 3);
      });
      sGeo.attributes.position.needsUpdate = true;
    },
  };
}
