import * as THREE from 'three';
import { rng, canvasTexture, softDotTexture, v3 } from './util.js';

// ---------------------------------------------------------------------------
// One continuous cave: a winding tunnel (z = +14 … -58) that opens into a tall
// chamber with rock columns (z ≈ -62 … -100). Built as a single deformed tube.
// Rock materials can show "echo reveal" rings: when a sound pulse sphere sweeps
// over a surface it lights up briefly (used to visualise the bat's sound map).
// ---------------------------------------------------------------------------

// smooth 3D value noise
function hash(x, y, z) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}
function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  let r = 0;
  for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) for (let dz = 0; dz < 2; dz++) {
    r += hash(xi + dx, yi + dy, zi + dz) * (dx ? u : 1 - u) * (dy ? v : 1 - v) * (dz ? w : 1 - w);
  }
  return r * 2 - 1;
}
const fbm = (x, y, z) => noise3(x, y, z) * 0.6 + noise3(x * 2.1, y * 2.1, z * 2.1) * 0.28 + noise3(x * 4.3, y * 4.3, z * 4.3) * 0.12;

// cave centre line and radius
export function caveCenter(z) {
  const chamber = Math.exp(-(((z + 70) / 16) ** 2));
  return v3(1.2 * Math.sin(z * 0.07) * (1 - chamber), 2.0 + 0.4 * Math.sin(z * 0.05) + 3.2 * chamber, z);
}
export function caveRadius(z) {
  const chamber = Math.exp(-(((z + 70) / 14) ** 2));
  return 5.0 + 0.6 * Math.sin(z * 0.11) + 9 * chamber;
}
export function floorAt(z) {
  return caveCenter(z).y - caveRadius(z) * 0.62;
}

const REVEAL_GLSL = /* glsl */ `
  #define NP 6
  uniform vec3 uPO[NP]; uniform float uPR[NP]; uniform float uPA[NP]; uniform vec3 uPD[NP]; varying vec3 vWPos;
  vec3 revealAt(vec3 p){
    vec3 e = vec3(0.0);
    for (int i = 0; i < NP; i++) {
      vec3 q = p - uPO[i];
      float L = length(q);
      float d = L - uPR[i];
      float dirw = smoothstep(-0.1, 0.6, dot(q / max(L, 1e-3), uPD[i]));
      float band = exp(-d * d / 0.22);
      float after = exp(-max(-d, 0.0) * 0.9) * step(d, 0.0);
      e += uPA[i] * dirw * (vec3(0.25, 0.85, 1.0) * band + vec3(1.0, 0.6, 0.25) * 0.08 * after);
    }
    return e;
  }`;

export function createCave() {
  const scene = new THREE.Scene();
  const R = rng(33);
  const fogCol = new THREE.Color().setRGB(0.012, 0.02, 0.035);
  scene.background = fogCol;
  scene.fog = new THREE.FogExp2(fogCol, 0.036);

  const reveal = {
    uPO: { value: Array.from({ length: 6 }, () => new THREE.Vector3(0, -999, 0)) },
    uPR: { value: new Array(6).fill(0) },
    uPA: { value: new Array(6).fill(0) },
    uPD: { value: Array.from({ length: 6 }, () => new THREE.Vector3(0, 0, -1)) },
  };
  const withReveal = (mat) => {
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, reveal);
      sh.vertexShader = 'varying vec3 vWPos;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = REVEAL_GLSL + '\n' + sh.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n totalEmissiveRadiance += revealAt(vWPos);'
      );
    };
    mat.customProgramCacheKey = () => 'reveal';
    return mat;
  };

  // ---------------- rock textures ----------------
  const rockTex = canvasTexture(512, 512, (g, w, h) => {
    const r = rng(5);
    g.fillStyle = '#4a4440';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      const x = r() * w, y = r() * h, s = 2 + r() * 18;
      const c = 40 + r() * 60;
      g.fillStyle = `rgba(${c + 10},${c + 4},${c},${0.15 + r() * 0.25})`;
      g.beginPath();
      g.ellipse(x, y, s, s * (0.4 + r() * 0.6), r() * 3, 0, 7);
      g.fill();
    }
    for (let i = 0; i < 90; i++) {
      g.strokeStyle = `rgba(20,16,14,${0.3 + r() * 0.3})`;
      g.lineWidth = 1 + r() * 2.5;
      g.beginPath();
      let x = r() * w, y = r() * h;
      g.moveTo(x, y);
      for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 60; y += (r() - 0.5) * 60; g.lineTo(x, y); }
      g.stroke();
    }
  }, { repeat: [3, 2] });
  const rockMat = withReveal(new THREE.MeshStandardMaterial({ map: rockTex, bumpMap: rockTex, bumpScale: 1.6, roughness: 0.92, color: '#b8aca2' }));

  // ---------------- the cave tube ----------------
  const ZS = 36, ZE = -112, SEGZ = 380, SEGR = 120;
  const pos = new Float32Array((SEGZ + 1) * (SEGR + 1) * 3);
  const uv = new Float32Array((SEGZ + 1) * (SEGR + 1) * 2);
  const idx = [];
  for (let i = 0; i <= SEGZ; i++) {
    const z = ZS + (ZE - ZS) * (i / SEGZ);
    const c = caveCenter(z), rad = caveRadius(z);
    const fl = floorAt(z);
    for (let j = 0; j <= SEGR; j++) {
      const a = (j / SEGR) * Math.PI * 2;
      const dir = v3(Math.cos(a), Math.sin(a) * 0.85, 0);
      const n = fbm(Math.cos(a) * 1.3 + 7, Math.sin(a) * 1.3, z * 0.18) * 0.18 + fbm(a * 3, z * 0.6, 1.7) * 0.05;
      const p = c.clone().addScaledVector(dir, rad * (1 + n));
      if (p.y < fl) p.y = fl + fbm(p.x * 0.6, z * 0.6, 3.3) * 0.15; // flat-ish floor
      const k = (i * (SEGR + 1) + j) * 3;
      pos[k] = p.x; pos[k + 1] = p.y; pos[k + 2] = p.z;
      uv[(i * (SEGR + 1) + j) * 2] = (z / 6);
      uv[(i * (SEGR + 1) + j) * 2 + 1] = (j / SEGR) * 6;
      if (i < SEGZ && j < SEGR) {
        const a0 = i * (SEGR + 1) + j, b0 = a0 + SEGR + 1;
        idx.push(a0, a0 + 1, b0, b0, a0 + 1, b0 + 1);
      }
    }
  }
  const tubeGeo = new THREE.BufferGeometry();
  tubeGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  tubeGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  tubeGeo.setIndex(idx);
  tubeGeo.computeVertexNormals();
  const tube = new THREE.Mesh(tubeGeo, rockMat);
  tube.material.side = THREE.DoubleSide;
  tube.receiveShadow = true;
  scene.add(tube);

  // ---------------- stalactites / stalagmites / columns ----------------
  const spikeGeo = new THREE.ConeGeometry(1, 1, 10, 6);
  { const p = spikeGeo.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); const s = 1 + 0.18 * Math.sin(y * 9 + p.getX(i) * 5); p.setX(i, p.getX(i) * s); p.setZ(i, p.getZ(i) * s); } spikeGeo.computeVertexNormals(); }
  const dripMat = withReveal(new THREE.MeshStandardMaterial({ map: rockTex, color: '#d2c3b0', roughness: 0.75, bumpMap: rockTex, bumpScale: 0.8 }));
  const surface = (z, a) => {
    const c = caveCenter(z), rad = caveRadius(z);
    return c.add(v3(Math.cos(a), Math.sin(a) * 0.85, 0).multiplyScalar(rad * 0.97));
  };
  const spikes = [];
  const addSpike = (base, h, r, down) => {
    const m = new THREE.Mesh(spikeGeo, dripMat);
    m.position.copy(base).add(v3(0, down ? -h / 2 : h / 2, 0));
    m.scale.set(r, h, r);
    if (down) m.rotation.x = Math.PI;
    m.rotation.y = R() * 6;
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
    spikes.push(m);
    return m;
  };
  // keep the bat's flight corridor free (set by main via clearCorridor)
  let corridor = () => false;
  const placeAll = () => {
    for (let i = 0; i < 150; i++) {
      const z = 30 - R() * 132;
      const a = Math.PI / 2 + (R() - 0.5) * 2.0;
      const top = surface(z, a);
      const h = 0.6 + R() * (caveRadius(z) > 8 ? 4.5 : 2.2);
      const tip = top.clone().add(v3(0, -h, 0));
      if (corridor(top, tip)) continue;
      addSpike(top.add(v3(0, 0.4, 0)), h + 0.4, 0.12 + R() * 0.35 * (h / 2.5), true);
    }
    for (let i = 0; i < 90; i++) {
      const z = 30 - R() * 132;
      const x = caveCenter(z).x + (R() - 0.5) * caveRadius(z) * 1.3;
      const base = v3(x, floorAt(z) - 0.2, z);
      const h = 0.5 + R() * (caveRadius(z) > 8 ? 3.5 : 1.6);
      if (corridor(base, base.clone().add(v3(0, h, 0)))) continue;
      addSpike(base, h, 0.15 + R() * 0.35 * (h / 2), false);
    }
  };
  // tall columns in the chamber (the bat weaves between them in the finale)
  const columns = [];
  const addColumn = (x, z, r) => {
    const fl = floorAt(z), top = caveCenter(z).y + caveRadius(z) * 0.82;
    const g = new THREE.CylinderGeometry(r * 0.75, r, top - fl, 16, 12);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), a = Math.atan2(p.getZ(i), p.getX(i));
      const waist = 1 - 0.35 * Math.exp(-((y / ((top - fl) * 0.18)) ** 2));
      const s = waist * (1 + 0.12 * fbm(a * 2, y * 0.8, x));
      p.setX(i, p.getX(i) * s);
      p.setZ(i, p.getZ(i) * s);
    }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, dripMat);
    m.position.set(x, (fl + top) / 2, z);
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
    columns.push(m);
  };

  // ---------------- light ----------------
  scene.add(new THREE.HemisphereLight(new THREE.Color('#2b4a66'), new THREE.Color('#0b0806'), 0.85));
  const shafts = [];
  const shaftTex = canvasTexture(64, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, 'rgba(255,255,255,0.9)');
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
  const addShaft = (z, x, width, intensity, shadow) => {
    const top = caveCenter(z).y + caveRadius(z) * 0.85;
    const sp = new THREE.SpotLight(new THREE.Color('#b8d8ff'), intensity, 0, 0.32, 0.9, 1.6);
    sp.position.set(x, top + 2, z);
    sp.target.position.set(x + 0.8, floorAt(z), z - 1);
    if (shadow) {
      sp.castShadow = true;
      sp.shadow.mapSize.set(1024, 1024);
      sp.shadow.bias = -0.0005;
      sp.shadow.radius = 3;
    }
    scene.add(sp, sp.target);
    for (let k = 0; k < 3; k++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shaftTex, color: new THREE.Color(0.45, 0.62, 0.9), transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      m.geometry.translate(0, -0.5, 0);
      m.position.set(x + (k - 1) * width * 0.25, top + 1, z + (k - 1) * 0.4);
      m.scale.set(width * (0.6 + 0.3 * k), top - floorAt(z) + 1, 1);
      m.rotation.set(0, k * 1.05, -0.06);
      scene.add(m);
      shafts.push({ m, ph: R() * 6, base: 0.09 + 0.04 * k });
    }
  };
  addShaft(3, 0.6, 1.6, 120, false);
  addShaft(-15, 1.6, 1.8, 70, true);
  addShaft(-28, 0.4, 1.6, 130, false);
  addShaft(-70, 1.5, 3.6, 900, true);
  // rim light for the bat (cool, from ahead) + a faint warm fill that follows the camera
  const rim = new THREE.DirectionalLight(new THREE.Color('#9cc6ff'), 0.9);
  scene.add(rim, rim.target);
  // soft cool key from above that travels with the action (moonlight-like through ceiling cracks)
  const key = new THREE.DirectionalLight(new THREE.Color('#8fb2dc'), 0.75);
  scene.add(key, key.target);
  const fill = new THREE.PointLight(new THREE.Color('#ffd9c0'), 3.2, 10, 2);
  scene.add(fill);

  // glow-worm specks on the ceiling (depth cue in the dark)
  {
    const N = 450, a = [];
    for (let i = 0; i < N; i++) {
      const z = 34 - R() * 140;
      const p = surface(z, Math.PI / 2 + (R() - 0.5) * 2.4);
      a.push(p.x, p.y - 0.1, p.z);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(a, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 0.035, map: softDotTexture(), color: new THREE.Color(0.25, 0.9, 0.8), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
  }
  // dust in the light shafts
  const ND = 260;
  const dBase = new Float32Array(ND * 3);
  for (let i = 0; i < ND * 3; i++) dBase[i] = R();
  const dGeo = new THREE.BufferGeometry();
  dGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(ND * 3), 3));
  const dust = new THREE.Points(dGeo, new THREE.PointsMaterial({ size: 0.02, map: softDotTexture(), color: new THREE.Color(0.9, 1.0, 1.2), transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }));
  dust.frustumCulled = false;
  scene.add(dust);

  return {
    scene, reveal, columns,
    build({ isInCorridor, columnsAt }) {
      corridor = isInCorridor;
      placeAll();
      for (const [x, z, r] of columnsAt) addColumn(x, z, r);
    },
    setPulses(list) {
      for (let i = 0; i < 6; i++) {
        const p = list[i];
        if (p) { reveal.uPO.value[i].copy(p.o); reveal.uPR.value[i] = p.r; reveal.uPA.value[i] = p.a; reveal.uPD.value[i].copy(p.d); }
        else reveal.uPA.value[i] = 0;
      }
    },
    update(t, cam, focus) {
      rim.position.copy(focus).addScaledVector(focus.clone().sub(cam.position).normalize(), 6).add(v3(1.5, 3, 0));
      rim.target.position.copy(focus);
      key.position.copy(focus).add(v3(-3, 8, 2));
      key.target.position.copy(focus);
      fill.position.copy(cam.position).lerp(focus, 0.35).add(v3(0, 0.6, 0));
      for (const s of shafts) s.m.material.opacity = s.base * (0.8 + 0.2 * Math.sin(t * 0.5 + s.ph));
      const a = dGeo.attributes.position.array, B = 10;
      for (let i = 0; i < ND; i++) for (let k = 0; k < 3; k++) {
        const drift = [0.03, -0.02, 0.02][k] * t + Math.sin(t * 0.25 + i + k) * 0.25;
        let val = dBase[i * 3 + k] * B + drift - (cam.position.getComponent(k) - B / 2);
        val = ((val % B) + B) % B;
        a[i * 3 + k] = val + cam.position.getComponent(k) - B / 2;
      }
      dGeo.attributes.position.needsUpdate = true;
    },
  };
}
