import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { canvasTexture, rng, softDotTexture } from './util.js';

// ---------------------------------------------------------------------------
// Freshwater canal / lake bed in the spirit of Xochimilco (Mexico City): soft
// silty bottom with pebbles, leaf litter and a sunken branch, waterweed
// (Elodea-like stems with whorled leaves), reed blades, lily pads at the
// surface, dim teal-green water with light shafts, drifting particles and
// bubbles. Caustic light ripples over everything that faces up.
// ---------------------------------------------------------------------------
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const uTime = { value: 0 };
const uCaustic = { value: 1 };

const CAUSTIC = /* glsl */ `
  uniform float uTime; uniform float uCaustic;
  varying vec3 vWPos; varying vec3 vWNorm;
  float caustic(vec2 p, float t){
    vec2 i = p; float c = 1.0; float inten = 0.005;
    for (int n = 0; n < 4; n++) {
      float tt = t * (1.0 - (3.5 / float(n + 1)));
      i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
      vec2 dd = vec2(sin(i.x + tt), cos(i.y + tt)) / inten;
      dd = sign(dd) * max(abs(dd), vec2(1e-4));
      c += 1.0 / max(length(p / dd), 1e-3);
    }
    c /= 4.0; c = 1.17 - pow(clamp(c, 0.0, 4.0), 1.4);
    return clamp(pow(abs(c), 8.0), 0.0, 2.0);
  }`;
export function withCaustics(mat, strength = 0.5, scale = 2.2) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.uniforms.uTime = uTime;
    sh.uniforms.uCaustic = uCaustic;
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
        float cst = caustic(vWPos.xz * ${scale.toFixed(3)} + vec2(vWPos.y * 0.4), uTime * 0.45 + 17.0);
        totalEmissiveRadiance += diffuseColor.rgb * vec3(0.7, 1.0, 0.9) * cst * ${strength.toFixed(3)} * uCaustic * smoothstep(-0.2, 0.8, vWNorm.y);`);
  };
  mat.customProgramCacheKey = () => 'lakecaustic' + strength + scale;
  return mat;
}

function mudTex() {
  const r = rng(12);
  return canvasTexture(1024, 1024, (g, w, h) => {
    g.fillStyle = '#5b4a36';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2500; i++) {
      const c = 70 + r() * 60;
      g.fillStyle = `rgba(${c + 20},${c + 10},${c - 10},${0.15 + r() * 0.2})`;
      g.beginPath();
      g.arc(r() * w, r() * h, 2 + r() * 14, 0, 6.283);
      g.fill();
    }
    for (let i = 0; i < 50000; i++) {
      g.fillStyle = `rgba(${150 + r() * 80},${130 + r() * 70},${90 + r() * 50},${0.2 + r() * 0.3})`;
      g.fillRect(r() * w, r() * h, 2, 2);
    }
    // dead leaves
    for (let i = 0; i < 60; i++) {
      g.save();
      g.translate(r() * w, r() * h);
      g.rotate(r() * 6.28);
      g.fillStyle = ['#6b4a22', '#7a5a2a', '#4a3a1a', '#8a6a3a'][i % 4];
      g.globalAlpha = 0.55;
      g.beginPath();
      g.ellipse(0, 0, 18 + r() * 14, 7 + r() * 5, 0, 0, 6.283);
      g.fill();
      g.restore();
    }
  }, { repeat: [10, 10] });
}

export function createLake() {
  const scene = new THREE.Scene();
  const R = rng(9);
  const skyU = { top: { value: new THREE.Color('#5fb7b0') }, mid: { value: new THREE.Color('#14514f') }, low: { value: new THREE.Color('#071d22') } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 top, mid, low; varying vec3 vP; void main(){ float y = vP.y;
      vec3 c = y > 0.0 ? mix(mid, top, pow(y, 0.8)) : mix(mid, low, pow(-y, 0.5)); gl_FragColor = vec4(c, 1.0); }`,
  }));
  scene.add(sky);
  scene.fog = new THREE.FogExp2('#164f50', 0.12);

  const hemi = new THREE.HemisphereLight('#b8f0e0', '#3a3020', 1.1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff3dc', 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.01;
  scene.add(sun, sun.target);
  const rim = new THREE.DirectionalLight('#8fe8ff', 1.5);
  scene.add(rim, rim.target);
  const setFocus = (c, span = 1.2) => {
    sun.target.position.copy(c);
    sun.position.copy(c).add(V(1.2, 5, 1.6));
    const s = sun.shadow.camera;
    s.left = s.bottom = -span; s.right = s.top = span; s.near = 0.5; s.far = 12;
    s.updateProjectionMatrix();
    rim.target.position.copy(c);
    rim.position.copy(c).add(V(-2, 1.5, -3));
  };
  setFocus(V());

  // ---- silty bottom ----
  const g = new THREE.PlaneGeometry(60, 60, 160, 160);
  g.rotateX(-Math.PI / 2);
  {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, 0.04 * Math.sin(x * 2.1) * Math.cos(z * 1.7) + 0.025 * Math.sin(x * 5.3 + z * 4.1) + 0.12 * Math.sin(x * 0.4) * Math.cos(z * 0.3)); }
    g.computeVertexNormals();
  }
  const ground = new THREE.Mesh(g, withCaustics(new THREE.MeshStandardMaterial({ map: mudTex(), roughness: 0.95 }), 0.9, 2.0));
  ground.receiveShadow = true;
  scene.add(ground);
  const groundY = (x, z) => 0.04 * Math.sin(x * 2.1) * Math.cos(z * 1.7) + 0.025 * Math.sin(x * 5.3 + z * 4.1) + 0.12 * Math.sin(x * 0.4) * Math.cos(z * 0.3);

  // ---- pebbles ----
  const pebGeo = new THREE.IcosahedronGeometry(1, 2);
  {
    const p = pebGeo.attributes.position;
    for (let i = 0; i < p.count; i++) { const v = V(p.getX(i), p.getY(i), p.getZ(i)); v.multiplyScalar(1 + 0.12 * Math.sin(v.x * 5 + v.z * 3)); p.setXYZ(i, v.x, v.y * 0.55, v.z); }
    pebGeo.computeVertexNormals();
  }
  const NP = 140;
  const pebbles = new THREE.InstancedMesh(pebGeo, withCaustics(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 }), 0.6, 2.0), NP);
  for (let i = 0; i < NP; i++) {
    const x = (R() - 0.5) * 14, z = (R() - 0.5) * 14;
    const s = 0.015 + R() * R() * 0.12;
    pebbles.setMatrixAt(i, new THREE.Matrix4().compose(V(x, groundY(x, z), z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, R() * 6, 0)), V(s, s, s * (0.8 + R() * 0.4))));
    pebbles.setColorAt(i, new THREE.Color().setHSL(0.08 + R() * 0.06, 0.15 + R() * 0.15, 0.25 + R() * 0.25));
  }
  pebbles.castShadow = pebbles.receiveShadow = true;
  scene.add(pebbles);

  // ---- sunken branch ----
  const branchCurve = new THREE.CatmullRomCurve3([V(-2.2, 0.02, -1.3), V(-1.2, 0.09, -1.0), V(-0.3, 0.06, -1.25), V(0.6, 0.03, -1.55)]);
  const branch = new THREE.Mesh(new THREE.TubeGeometry(branchCurve, 60, 0.06, 10, false), withCaustics(new THREE.MeshStandardMaterial({ color: '#4a3826', roughness: 0.9 }), 0.6, 2.0));
  branch.castShadow = branch.receiveShadow = true;
  scene.add(branch);

  // ---- waterweed (Elodea-like): stems with whorls of small leaves, swaying ----
  const leaf = new THREE.PlaneGeometry(0.018, 0.075, 1, 2).translate(0, 0.037, 0);
  const weedGeos = [];
  const STEM_H = 1.6, WHORLS = 26;
  const stem = new THREE.CylinderGeometry(0.006, 0.008, STEM_H, 5, 12).translate(0, STEM_H / 2, 0);
  weedGeos.push(stem.toNonIndexed());
  for (let w = 0; w < WHORLS; w++) {
    const y = 0.08 + (w / WHORLS) * (STEM_H - 0.1);
    for (let k = 0; k < 3; k++) {
      const l = leaf.clone();
      const sc = 1 - 0.4 * (w / WHORLS);
      l.scale(sc, sc, sc);
      l.rotateX(-1.0);
      l.rotateY(k * 2.094 + w * 0.7);
      l.translate(0, y, 0);
      weedGeos.push(l.toNonIndexed());
    }
  }
  weedGeos.forEach((x) => { x.deleteAttribute('uv'); });
  const weedGeo = mergeGeometries(weedGeos);
  const weedMat = withCaustics(new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide, roughness: 0.6, emissive: '#0d3a14', emissiveIntensity: 0.3 }), 0.4, 2.0);
  const weedPrev = weedMat.onBeforeCompile;
  weedMat.onBeforeCompile = (sh, r) => {
    weedPrev(sh, r);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;').replace('#include <begin_vertex>', `#include <begin_vertex>
      float hh = position.y / ${STEM_H.toFixed(2)}; float id = float(gl_InstanceID);
      transformed.x += sin(uTime * 0.9 + id * 1.7 + hh * 2.0) * 0.12 * hh * hh;
      transformed.z += cos(uTime * 0.7 + id * 0.9) * 0.08 * hh * hh;`);
  };
  weedMat.customProgramCacheKey = () => 'weed';
  const WEED = [];
  // clumps around the stage, kept out of the camera's way (cameras sit at +z)
  const clumps = [[-0.9, -0.7], [0.9, -0.9], [-1.6, 0.2], [1.7, 0.1], [0.2, -1.8], [-2.6, -1.6], [2.4, -1.7], [-0.4, -3], [1.2, -3.2], [-3.5, 0.6], [3.3, 0.8], [3.0, 2.6], [-3.2, 2.4], [4.5, -0.5], [-4.6, -0.2]];
  for (const [cx, cz] of clumps) for (let i = 0; i < 9; i++) WEED.push([cx + (R() - 0.5) * 0.5, cz + (R() - 0.5) * 0.5, 0.6 + R() * 0.7]);
  const weed = new THREE.InstancedMesh(weedGeo, weedMat, WEED.length);
  WEED.forEach(([x, z, s], i) => {
    weed.setMatrixAt(i, new THREE.Matrix4().compose(V(x, groundY(x, z) - 0.02, z), new THREE.Quaternion().setFromEuler(new THREE.Euler((R() - 0.5) * 0.2, R() * 6, (R() - 0.5) * 0.2)), V(1, s, 1)));
    weed.setColorAt(i, new THREE.Color().setHSL(0.28 + R() * 0.08, 0.55, 0.3 + R() * 0.12));
  });
  weed.castShadow = true;
  scene.add(weed);

  // ---- reed blades (tall, ribbon-like) ----
  const blade = new THREE.PlaneGeometry(0.05, 1, 1, 8).translate(0, 0.5, 0);
  const reedMat = new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide, roughness: 0.6 });
  reedMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float h = position.y; float id = float(gl_InstanceID);
        transformed.x += sin(uTime * 0.8 + id * 0.7 + h * 1.5) * 0.15 * h * h;
        transformed.z += cos(uTime * 0.6 + id * 1.3) * 0.06 * h * h;`);
  };
  const NR = 260;
  const reeds = new THREE.InstancedMesh(blade, reedMat, NR);
  for (let i = 0; i < NR; i++) {
    let x, z;
    do { x = (R() - 0.5) * 16; z = -1.2 - R() * 8; } while (Math.abs(x) < 0.8 && z > -2.2);
    reeds.setMatrixAt(i, new THREE.Matrix4().compose(V(x, groundY(x, z), z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, R() * 6.28, 0)), V(1, 1.4 + R() * 1.8, 1)));
    reeds.setColorAt(i, new THREE.Color().setHSL(0.24 + R() * 0.08, 0.5, 0.28 + R() * 0.12));
  }
  scene.add(reeds);

  // ---- lily pads at the surface (dark silhouettes against the bright top) ----
  const pad = new THREE.CircleGeometry(0.45, 24, 0.25, Math.PI * 2 - 0.5).rotateX(Math.PI / 2);
  const pads = new THREE.InstancedMesh(pad, new THREE.MeshBasicMaterial({ color: '#0f2a18', side: THREE.DoubleSide, fog: false, transparent: true, opacity: 0.85 }), 14);
  for (let i = 0; i < 14; i++) {
    pads.setMatrixAt(i, new THREE.Matrix4().compose(V((R() - 0.5) * 9, 4.2, (R() - 0.5) * 9 - 1), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, R() * 6, 0)), V(1, 1, 1).multiplyScalar(0.7 + R() * 0.8)));
  }
  scene.add(pads);

  // ---- light shafts ----
  const rayTex = canvasTexture(128, 512, (gg, w, h) => {
    const gr = gg.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    gg.fillStyle = gr; gg.fillRect(0, 0, w, h);
    const v = gg.createLinearGradient(0, 0, 0, h);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(0.25, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,1)');
    gg.globalCompositeOperation = 'destination-out'; gg.fillStyle = v; gg.fillRect(0, 0, w, h);
  });
  const rays = [];
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 6).translate(0, -3, 0), new THREE.MeshBasicMaterial({ map: rayTex, color: new THREE.Color(0.6, 0.95, 0.85), transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    m.position.set((R() - 0.5) * 6, 4.2, -1 - R() * 4);
    m.rotation.z = 0.22;
    scene.add(m);
    rays.push({ m, ph: R() * 6, w: 0.7 + R() * 1.5 });
  }

  // ---- particles and bubbles ----
  const NS = 600;
  const sGeo = new THREE.BufferGeometry();
  sGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NS * 3), 3));
  const snow = new THREE.Points(sGeo, new THREE.PointsMaterial({ map: softDotTexture(), size: 0.012, color: '#e9fff4', transparent: true, opacity: 0.6, depthWrite: false }));
  snow.frustumCulled = false;
  scene.add(snow);
  const sSeeds = Array.from({ length: NS }, () => [(R() - 0.5) * 4, R() * 2.2, (R() - 0.5) * 4, R() * 6.28]);
  const bubbleTex = canvasTexture(64, 64, (gg, w, h) => {
    gg.strokeStyle = 'rgba(255,255,255,0.95)'; gg.lineWidth = 4; gg.beginPath(); gg.arc(w / 2, h / 2, w / 2 - 4, 0, 6.283); gg.stroke();
    gg.fillStyle = 'rgba(255,255,255,0.15)'; gg.fill();
    gg.fillStyle = '#fff'; gg.beginPath(); gg.arc(w * 0.36, h * 0.34, 6, 0, 6.283); gg.fill();
  });
  const NB = 70;
  const bGeo = new THREE.BufferGeometry();
  bGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NB * 3), 3));
  const bubbles = new THREE.Points(bGeo, new THREE.PointsMaterial({ map: bubbleTex, size: 0.03, transparent: true, depthWrite: false, opacity: 0.85 }));
  bubbles.frustumCulled = false;
  scene.add(bubbles);
  const bSeeds = Array.from({ length: NB }, () => [(R() - 0.5) * 3, (R() - 0.5) * 3, R(), 0.15 + R() * 0.25]);

  return {
    scene, sun, hemi, rim, setFocus, groundY, uTime, uCaustic, skyU, fog: scene.fog,
    update(t, focus = V()) {
      uTime.value = t;
      for (const r of rays) { r.m.material.opacity = 0.09 + 0.06 * Math.sin(t * 0.5 + r.ph); r.m.scale.x = r.w * (0.8 + 0.2 * Math.sin(t * 0.3 + r.ph)); }
      const sa = sGeo.attributes.position.array;
      sSeeds.forEach(([x, y, z, p], i) => sa.set([focus.x + x + Math.sin(t * 0.25 + p) * 0.12, ((y + t * 0.02) % 2.2) + 0.02, focus.z + z + Math.cos(t * 0.2 + p) * 0.12], i * 3));
      sGeo.attributes.position.needsUpdate = true;
      const ba = bGeo.attributes.position.array;
      bSeeds.forEach(([x, z, o, sp], i) => ba.set([focus.x + x + Math.sin(t * 2 + i) * 0.02, (o * 3 + t * sp) % 3, focus.z + z], i * 3));
      bGeo.attributes.position.needsUpdate = true;
    },
  };
}
