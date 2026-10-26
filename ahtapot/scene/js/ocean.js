import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, canvasTexture, softDotTexture, v3 } from './util.js';

// ---------------------------------------------------------------------------
// Underwater reef: sandy floor with animated caustics, light shafts from the
// surface, corals, anemones, swaying seaweed, rocks, a fish school, bubbles
// and drifting particles. Floor height = floorY(x, z).
// ---------------------------------------------------------------------------

export function floorY(x, z) {
  return 0.35 * Math.sin(x * 0.18 + 1.3) * Math.cos(z * 0.15) + 0.2 * Math.sin(x * 0.07 - z * 0.11) - 0.05 * Math.sin(x * 2.1 + z * 0.4);
}

const CAUSTIC_GLSL = /* glsl */ `
  uniform float uTime; uniform float uCaustic; varying vec3 vWPos;
  float causticAt(vec2 p, float t){
    vec2 q = p * 0.75; float c = 0.0;
    for (int i = 0; i < 3; i++) {
      q = q * 1.55 + vec2(sin(q.y * 1.3 + t * 0.9), cos(q.x * 1.1 - t * 0.75));
      c += abs(sin(q.x) + sin(q.y));
    }
    return pow(max(0.0, 1.35 - c / 3.0), 3.0);
  }`;

// inject animated caustic light into any MeshStandard/Physical material
export function addCaustics(mat, uniforms, strength = 1) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uniforms.uTime;
    sh.uniforms.uCaustic = { value: strength };
    sh.vertexShader = 'varying vec3 vWPos;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = CAUSTIC_GLSL + '\n' + sh.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
       float up = clamp(normalize(cross(dFdx(vWPos), dFdy(vWPos))).y, 0.0, 1.0);
       totalEmissiveRadiance += vec3(0.75, 1.0, 1.0) * causticAt(vWPos.xz, uTime) * uCaustic * (0.25 + 0.75 * up) * 0.9;`
    );
  };
  mat.customProgramCacheKey = () => 'caustic' + strength;
  return mat;
}

export function createOcean({ clear = [] } = {}) {
  const blocked = (x, z) => clear.some(([cx, cz, r]) => (x - cx) ** 2 + (z - cz) ** 2 < r * r);
  const scene = new THREE.Scene();
  const R = rng(17);
  const U = { uTime: { value: 0 } };
  const fogCol = new THREE.Color().setRGB(0.02, 0.32, 0.42);
  scene.fog = new THREE.FogExp2(fogCol, 0.05);
  scene.background = fogCol;

  // water "sky": bright surface above, deep blue below
  const dome = new THREE.Mesh(new THREE.SphereGeometry(200, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { uTime: U.uTime },
    vertexShader: `varying vec3 d; void main(){ d = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `varying vec3 d; uniform float uTime;
      void main(){
        float h = d.y;
        vec3 deep = vec3(0.005, 0.07, 0.16), mid = vec3(0.02, 0.32, 0.42), top = vec3(0.35, 0.95, 1.05);
        vec3 c = mix(deep, mid, smoothstep(-0.6, 0.05, h));
        c = mix(c, top, smoothstep(0.15, 0.95, h));
        // shimmering surface ripples
        vec2 uv = d.xz / max(h, 0.05);
        float r = sin(uv.x * 3.0 + uTime * 0.8) * sin(uv.y * 2.6 - uTime * 0.6) + sin(uv.x * 7.0 - uTime * 1.3) * 0.4;
        c += vec3(0.25, 0.5, 0.5) * smoothstep(0.4, 1.0, h) * (0.5 + 0.5 * r) * 0.6;
        gl_FragColor = vec4(c, 1.0);
      }`,
  }));
  dome.renderOrder = -10;
  scene.add(dome);

  // lights: sun through the surface + blue ambient + soft bounce from the sand
  scene.add(new THREE.HemisphereLight(new THREE.Color('#8ff0ff'), new THREE.Color('#1c4a5a'), 1.25));
  const sun = new THREE.DirectionalLight(new THREE.Color('#d8fff8'), 3.0);
  sun.position.set(-6, 22, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 4;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(new THREE.Color('#ffd8f0'), 0.9);
  scene.add(fill, fill.target);

  // ---------------- sand floor ----------------
  const sandTex = canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = '#e6d39f';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(255,245,210,0.35)' : 'rgba(150,120,70,0.25)';
      g.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
    }
  }, { repeat: [40, 40] });
  const floorGeo = new THREE.PlaneGeometry(240, 240, 240, 240);
  floorGeo.rotateX(-Math.PI / 2);
  { const p = floorGeo.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, floorY(p.getX(i), p.getZ(i))); floorGeo.computeVertexNormals(); }
  const floor = new THREE.Mesh(floorGeo, addCaustics(new THREE.MeshStandardMaterial({ map: sandTex, roughness: 0.95 }), U, 1.2));
  floor.receiveShadow = true;
  scene.add(floor);

  // ---------------- rocks ----------------
  const rockGeo = new THREE.IcosahedronGeometry(1, 3);
  { const p = rockGeo.attributes.position; for (let i = 0; i < p.count; i++) { const v = v3(p.getX(i), p.getY(i), p.getZ(i)); const n = 1 + 0.18 * Math.sin(v.x * 3.1 + v.y * 2.3) + 0.1 * Math.sin(v.z * 5.3 + v.x * 1.7); v.multiplyScalar(n); p.setXYZ(i, v.x, v.y, v.z); } rockGeo.computeVertexNormals(); }
  const rockMat = addCaustics(new THREE.MeshStandardMaterial({ color: '#5c7286', roughness: 0.9 }), U, 0.8);
  const rocks = [];
  function rock(x, z, s, sy = 0.6) {
    const m = new THREE.Mesh(rockGeo, rockMat);
    m.position.set(x, floorY(x, z) + s * sy * 0.35, z);
    m.scale.set(s, s * sy, s * 0.9);
    m.rotation.y = R() * 6;
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
    rocks.push(m);
    return m;
  }

  // ---------------- corals ----------------
  const coralMats = ['#ff6f91', '#ff9f43', '#b36cf0', '#ffd23d', '#ff5e7e', '#4fd1c5'].map((c) =>
    addCaustics(new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, emissive: new THREE.Color(c), emissiveIntensity: 0.12 }), U, 0.6));
  function branchCoral(x, z, s, mi, seed) {
    const r = rng(seed);
    const parts = [];
    const grow = (p, dir, len, rad, depth) => {
      const end = p.clone().addScaledVector(dir, len);
      const g = new THREE.CylinderGeometry(rad * 0.75, rad, len, 8, 1);
      g.translate(0, len / 2, 0);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(v3(0, 1, 0), dir));
      g.translate(p.x, p.y, p.z);
      parts.push(g);
      const tip = new THREE.SphereGeometry(rad * 0.8, 8, 6);
      tip.translate(end.x, end.y, end.z);
      parts.push(tip);
      if (depth > 0) {
        const n = 2 + Math.floor(r() * 2);
        for (let k = 0; k < n; k++) {
          const nd = dir.clone().add(v3((r() - 0.5) * 1.3, 0.25 + r() * 0.4, (r() - 0.5) * 1.3)).normalize();
          grow(end, nd, len * (0.65 + r() * 0.2), rad * 0.72, depth - 1);
        }
      }
    };
    grow(v3(0, 0, 0), v3(0, 1, 0), 0.75, 0.19, 3);
    const m = new THREE.Mesh(mergeGeometries(parts), coralMats[mi]);
    m.position.set(x, floorY(x, z) - 0.05, z);
    m.scale.setScalar(s);
    m.rotation.y = r() * 6;
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
    return m;
  }
  const brainGeo = new THREE.SphereGeometry(1, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2);
  { const p = brainGeo.attributes.position; for (let i = 0; i < p.count; i++) { const v = v3(p.getX(i), p.getY(i), p.getZ(i)); const n = 1 + 0.045 * Math.sin(v.x * 18 + Math.sin(v.z * 9) * 2) ; v.multiplyScalar(n); p.setXYZ(i, v.x, v.y, v.z); } brainGeo.computeVertexNormals(); }
  function brainCoral(x, z, s, color) {
    const m = new THREE.Mesh(brainGeo, addCaustics(new THREE.MeshStandardMaterial({ color, roughness: 0.75 }), U, 0.7));
    m.position.set(x, floorY(x, z) - 0.05, z);
    m.scale.set(s, s * 0.75, s);
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
  }
  const fanTex = canvasTexture(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = '#fff';
    g.lineCap = 'round';
    const br = (x, y, a, l, d) => { if (d === 0) return; const x2 = x + Math.cos(a) * l, y2 = y - Math.sin(a) * l; g.lineWidth = d * 1.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke(); br(x2, y2, a + 0.35, l * 0.78, d - 1); br(x2, y2, a - 0.35, l * 0.78, d - 1); };
    br(w / 2, h, Math.PI / 2, 60, 7);
    br(w / 2, h, Math.PI / 2 + 0.6, 50, 6);
    br(w / 2, h, Math.PI / 2 - 0.6, 50, 6);
  });
  const fans = [];
  function seaFan(x, z, s, color, yaw) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshStandardMaterial({ map: fanTex, color, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.7, emissive: new THREE.Color(color), emissiveIntensity: 0.15 }));
    m.geometry.translate(0, 1, 0);
    m.position.set(x, floorY(x, z) - 0.05, z);
    m.scale.setScalar(s);
    m.rotation.y = yaw;
    m.castShadow = true;
    scene.add(m);
    fans.push({ m, yaw, ph: R() * 6 });
  }
  // anemones
  const anemones = [];
  function anemone(x, z, s, color, tipColor) {
    const g = new THREE.Group();
    g.position.set(x, floorY(x, z), z);
    g.scale.setScalar(s);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.35, 20), new THREE.MeshStandardMaterial({ color: '#e07a5f', roughness: 0.7 }));
    base.position.y = 0.17;
    g.add(base);
    const tent = [];
    const tg = new THREE.CapsuleGeometry(0.03, 0.4, 4, 8);
    tg.translate(0, 0.22, 0);
    const tm = new THREE.MeshStandardMaterial({ color, roughness: 0.5, emissive: new THREE.Color(tipColor), emissiveIntensity: 0.25 });
    for (let i = 0; i < 26; i++) {
      const a = i * 2.39996, r = 0.06 + Math.sqrt(i / 26) * 0.22;
      const t = new THREE.Mesh(tg, tm);
      t.position.set(Math.cos(a) * r, 0.34, Math.sin(a) * r);
      t.userData = { a, r, ph: R() * 6 };
      g.add(t);
      tent.push(t);
    }
    g.traverse((o) => (o.castShadow = true));
    scene.add(g);
    anemones.push(tent);
  }
  // seaweed ribbons (vertex-shader sway)
  const weedMat = new THREE.MeshStandardMaterial({ color: '#3fae5a', roughness: 0.6, side: THREE.DoubleSide, emissive: new THREE.Color('#1d6b33'), emissiveIntensity: 0.2 });
  weedMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        float ph = instanceMatrix[3].x * 0.7 + instanceMatrix[3].z * 0.5;
      #else
        float ph = 0.0;
      #endif
      float k = position.y / 3.0;
      transformed.x += sin(uTime * 1.1 + ph + position.y * 1.3) * 0.35 * k * k;
      transformed.z += cos(uTime * 0.9 + ph + position.y) * 0.18 * k * k;`);
  };
  const weedGeo = new THREE.PlaneGeometry(0.22, 3, 1, 16);
  weedGeo.translate(0, 1.5, 0);
  { const p = weedGeo.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) * (1 - y / 3.6)); } }

  // ---------------- layout ----------------
  // the "stage": octopus area around (0, *, 0); hiding coral at z ≈ -5; reef continues far
  const placeCluster = (cx, cz, rad, n, scl = 1) => {
    for (let i = 0; i < n; i++) {
      const a = R() * 6.28, r = Math.sqrt(R()) * rad;
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      const k = R();
      if (blocked(x, z)) continue;
      if (k < 0.45) branchCoral(x, z, (0.7 + R() * 0.7) * scl, Math.floor(R() * coralMats.length), Math.floor(R() * 1e6));
      else if (k < 0.62) brainCoral(x, z, (0.4 + R() * 0.5) * scl, ['#c9d36a', '#e7a15c', '#9ad0a8'][Math.floor(R() * 3)]);
      else if (k < 0.75) seaFan(x, z, (0.6 + R() * 0.5) * scl, ['#ff5e7e', '#ff9f43', '#b36cf0'][Math.floor(R() * 3)], R() * 6);
      else if (k < 0.87) anemone(x, z, (0.8 + R() * 0.6) * scl, ['#ff9ecf', '#ffd48a', '#9fe6ff'][Math.floor(R() * 3)], '#ffffff');
      else rock(x, z, (0.5 + R() * 0.8) * scl);
    }
  };
  // hiding coral wall the octopus rises from (scene 1)
  for (let i = 0; i < 9; i++) { const x = -5.0 + i * 0.5, z = -7.0 + Math.sin(i) * 0.3; if (!blocked(x, z)) branchCoral(x, z, 1.05 + (i % 3) * 0.2, i % coralMats.length, 100 + i); }
  brainCoral(-4.6, -6.5, 0.8, '#c9d36a');
  brainCoral(-1.6, -6.6, 0.7, '#e7a15c');
  rock(-2.9, -8.6, 1.4, 0.8);
  // side reef around the stage and along the swim path (+x / -z direction)
  placeCluster(-4.2, -1.5, 2.2, 14);
  placeCluster(4.4, -1.0, 2.2, 14);
  placeCluster(-3.2, 3.2, 1.8, 8, 0.8);
  placeCluster(3.6, 3.6, 1.8, 8, 0.8);
  placeCluster(6, -9, 4, 24);
  placeCluster(-7, -10, 4, 22);
  placeCluster(0, -15, 6, 30, 1.2);
  placeCluster(10, -3, 3, 14);
  placeCluster(-10, 0, 3, 14);
  placeCluster(13, -14, 5, 22, 1.2);
  placeCluster(-14, -16, 5, 22, 1.2);
  placeCluster(4, -24, 7, 30, 1.4);
  // seaweed beds
  {
    const N = 90;
    const im = new THREE.InstancedMesh(weedGeo, weedMat, N);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion();
    for (let i = 0; i < N; i++) {
      const bed = [[-5.5, -3], [5.8, -2.5], [-8, -8], [9, -9], [0, -20]][i % 5];
      const x = bed[0] + (R() - 0.5) * 2.4, z = bed[1] + (R() - 0.5) * 2.4;
      if (blocked(x, z)) { m.makeScale(0, 0, 0); im.setMatrixAt(i, m); continue; }
      q.setFromEuler(new THREE.Euler(0, R() * 6, 0));
      m.compose(v3(x, floorY(x, z) - 0.05, z), q, v3(1, 0.6 + R() * 0.8, 1));
      im.setMatrixAt(i, m);
    }
    im.castShadow = true;
    scene.add(im);
  }

  // ---------------- light shafts ----------------
  const rayTex = canvasTexture(64, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, 'rgba(255,255,255,0.9)');
    gr.addColorStop(0.6, 'rgba(255,255,255,0.25)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    const gx = g.createLinearGradient(0, 0, w, 0);
    gx.addColorStop(0, 'rgba(0,0,0,1)');
    gx.addColorStop(0.5, 'rgba(0,0,0,0)');
    gx.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = gx;
    g.fillRect(0, 0, w, h);
  });
  const rays = [];
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: rayTex, color: new THREE.Color(0.55, 0.95, 0.95), transparent: true, opacity: 0.13, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
    m.geometry.translate(0, -0.5, 0);
    const x = -12 + R() * 24, z = -20 + R() * 20;
    m.position.set(x, 14, z);
    m.scale.set(1.2 + R() * 2.2, 18, 1);
    m.rotation.set(0, R() * 3, -0.25 + R() * 0.1);
    scene.add(m);
    rays.push({ m, ph: R() * 6, base: 0.08 + R() * 0.1 });
  }

  // ---------------- fish school ----------------
  const fishGeo = (() => {
    const body = new THREE.SphereGeometry(1, 16, 10);
    body.scale(0.09, 0.12, 0.2);
    const tail = new THREE.ConeGeometry(0.09, 0.14, 4);
    tail.rotateX(-Math.PI / 2);
    tail.translate(0, 0, -0.24);
    tail.scale(0.3, 1, 1);
    return mergeGeometries([body, tail]);
  })();
  const fishMat = new THREE.MeshStandardMaterial({ color: '#ffd23d', roughness: 0.4, emissive: new THREE.Color('#ff9f1c'), emissiveIntensity: 0.25 });
  const NF = 34;
  const fish = new THREE.InstancedMesh(fishGeo, fishMat, NF);
  fish.frustumCulled = false;
  const fishCol = new THREE.Color();
  for (let i = 0; i < NF; i++) fish.setColorAt(i, fishCol.set(i % 3 ? '#ffd23d' : '#5ec8ff'));
  scene.add(fish);
  const fishOff = Array.from({ length: NF }, () => v3((R() - 0.5) * 2.4, (R() - 0.5) * 1.2, (R() - 0.5) * 2.4));

  // ---------------- particles: marine snow + bubbles ----------------
  const NP = 600;
  const pBase = new Float32Array(NP * 3);
  for (let i = 0; i < NP * 3; i++) pBase[i] = R();
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(NP * 3), 3));
  const snow = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.05, map: softDotTexture(), color: new THREE.Color(1.1, 1.3, 1.3), transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
  snow.frustumCulled = false;
  scene.add(snow);
  const bubbleTex = canvasTexture(64, 64, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, w * 0.28, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,0.05)');
    gr.addColorStop(0.75, 'rgba(255,255,255,0.55)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.beginPath();
    g.arc(w * 0.38, h * 0.36, w * 0.08, 0, 7);
    g.fill();
  });
  const NB = 160;
  const bGeo = new THREE.BufferGeometry();
  bGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(NB * 3), 3));
  const bubbles = new THREE.Points(bGeo, new THREE.PointsMaterial({ size: 0.12, map: bubbleTex, color: new THREE.Color(1.2, 1.4, 1.4), transparent: true, depthWrite: false }));
  bubbles.frustumCulled = false;
  scene.add(bubbles);
  // bubble sources: vents in the reef + the octopus (set each frame)
  const vents = [v3(-3.6, 0, -1.8), v3(4.2, 0, -0.6), v3(-1.5, 0, -4.8), v3(6, 0, -8), v3(-7, 0, -9)];
  const bSeed = Array.from({ length: NB }, () => [R(), R(), R()]);

  return {
    scene, U, sun, fill, rocks, fogCol,
    setShadow(center, r) {
      sun.target.position.copy(center);
      sun.position.copy(center).add(v3(-6, 22, 8));
      const c = sun.shadow.camera;
      c.left = -r; c.right = r; c.top = r; c.bottom = -r; c.near = 1; c.far = 60;
      c.updateProjectionMatrix();
    },
    update(t, cam, octoPos, octoBubbles = 0) {
      U.uTime.value = t;
      dome.position.copy(cam.position);
      fill.position.copy(cam.position).add(v3(0, 2, 0));
      fill.target.position.copy(octoPos);
      for (const r of rays) r.m.material.opacity = r.base * (0.7 + 0.3 * Math.sin(t * 0.6 + r.ph));
      for (const f of fans) f.m.rotation.set(Math.sin(t * 0.9 + f.ph) * 0.08, f.yaw, Math.sin(t * 0.7 + f.ph) * 0.05);
      for (const tent of anemones) for (const tt of tent) {
        const { a, r, ph } = tt.userData;
        tt.rotation.set(Math.sin(t * 1.4 + ph) * 0.35 + Math.cos(a) * 0.4 * r * 3, 0, Math.cos(t * 1.1 + ph) * 0.35 - Math.sin(a) * 0.4 * r * 3);
      }
      // fish school cruising on a loop behind the stage
      const m = new THREE.Matrix4(), q = new THREE.Quaternion();
      for (let i = 0; i < NF; i++) {
        const u = t * 0.07 + i * 0.002;
        const c = v3(Math.sin(u * 6.28) * 9, 3.2 + Math.sin(u * 12.5) * 0.6, -9 + Math.cos(u * 6.28) * 5);
        const c2 = v3(Math.sin((u + 0.01) * 6.28) * 9, 3.2 + Math.sin((u + 0.01) * 12.5) * 0.6, -9 + Math.cos((u + 0.01) * 6.28) * 5);
        const p = c.add(fishOff[i]).add(v3(0, Math.sin(t * 2 + i) * 0.08, 0));
        const dir = c2.add(fishOff[i]).sub(p).normalize();
        q.setFromUnitVectors(v3(0, 0, 1), dir);
        q.multiply(new THREE.Quaternion().setFromAxisAngle(v3(0, 1, 0), Math.sin(t * 9 + i) * 0.2));
        m.compose(p, q, v3(1, 1, 1));
        fish.setMatrixAt(i, m);
      }
      fish.instanceMatrix.needsUpdate = true;
      // marine snow around the camera
      const a = pGeo.attributes.position.array, B = 16;
      for (let i = 0; i < NP; i++) for (let k = 0; k < 3; k++) {
        const drift = [0.05, -0.04, 0.03][k] * t + Math.sin(t * 0.3 + i + k) * 0.3;
        let v = pBase[i * 3 + k] * B + drift - (cam.position.getComponent(k) - B / 2);
        v = ((v % B) + B) % B;
        a[i * 3 + k] = v + cam.position.getComponent(k) - B / 2;
      }
      pGeo.attributes.position.needsUpdate = true;
      // bubbles rising from vents and from the octopus' siphon
      const b = bGeo.attributes.position.array;
      for (let i = 0; i < NB; i++) {
        const [s1, s2, s3] = bSeed[i];
        const fromOcto = i < 30;
        const life = fromOcto ? 2.2 : 5;
        const tt = (t * (0.6 + s3 * 0.6) + s1 * life) % life;
        const src = fromOcto ? octoPos : vents[i % vents.length];
        const y0 = fromOcto ? octoPos.y : floorY(src.x, src.z);
        const on = fromOcto ? octoBubbles : 1;
        b[i * 3] = src.x + Math.sin(tt * 3 + s2 * 6) * 0.12 + (s2 - 0.5) * 0.3 + (fromOcto ? 0.5 : 0);
        b[i * 3 + 1] = on > 0.01 ? y0 + tt * (fromOcto ? 1.0 : 1.4) : -100;
        b[i * 3 + 2] = src.z + Math.cos(tt * 2.5 + s1 * 6) * 0.12 + (s3 - 0.5) * 0.3;
      }
      bGeo.attributes.position.needsUpdate = true;
    },
  };
}
