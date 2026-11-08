import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { canvasTexture, rng, softDotTexture } from './util.js';
import { withCaustics, branchCoral, brainTex, fanTex, uTime } from './reefparts.js';

// ---------------------------------------------------------------------------
// Night reef floor at macro scale (units: centimetres). The shrimp's burrow is
// at the origin, under a slab of coral rubble. Around it: sand with moonlit
// caustics, pebbles and shell grit, then coral heads (branching, brain, table),
// sea fans, tube sponges and anemones, boulders further out. Deep navy water,
// drifting marine snow, faint bioluminescent plankton and moonlight shafts.
// ---------------------------------------------------------------------------
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export function groundY(x, z) {
  // gentle undulation, flat where the shrimp lives
  const r = Math.hypot(x, z);
  const k = Math.min(1, Math.max(0, (r - 14) / 30));
  return k * (2.2 * Math.sin(x * 0.021) * Math.cos(z * 0.017) + 1.1 * Math.sin(x * 0.05 + z * 0.037)) + 0.08 * Math.sin(x * 1.3) * Math.cos(z * 1.1);
}

function sandTex() {
  const r = rng(3);
  return canvasTexture(1024, 1024, (g, w, h) => {
    g.fillStyle = '#b7a688';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90000; i++) {
      const c = 120 + r() * 120;
      g.fillStyle = `rgba(${c},${c - 12},${c - 35},${0.25 + r() * 0.4})`;
      const s = r() < 0.03 ? 4 : 2;
      g.fillRect(r() * w, r() * h, s, s);
    }
    for (let i = 0; i < 900; i++) { // dark grains and tiny shell bits
      g.fillStyle = r() < 0.5 ? `rgba(60,50,45,${0.4 + r() * 0.4})` : `rgba(255,240,225,${0.4 + r() * 0.4})`;
      g.beginPath(); g.ellipse(r() * w, r() * h, 1 + r() * 3, 1 + r() * 2, r() * 3, 0, 6.283); g.fill();
    }
  }, { repeat: [90, 90] });
}

export function createSeabed() {
  const scene = new THREE.Scene();
  const R = rng(11);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(5000, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vP; void main(){ float y = vP.y;
      vec3 top = vec3(0.07, 0.26, 0.42), mid = vec3(0.012, 0.075, 0.13), low = vec3(0.004, 0.02, 0.04);
      vec3 c = y > 0.0 ? mix(mid, top, pow(y, 0.8)) : mix(mid, low, pow(-y, 0.5));
      gl_FragColor = vec4(c, 1.0); }`,
  }));
  scene.add(sky);
  scene.fog = new THREE.FogExp2('#03182a', 0.0105);

  // ---- light: dim blue ambient, moonlight from above, a cyan rim from behind ----
  const hemi = new THREE.HemisphereLight('#3f74a8', '#081218', 0.22);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight('#8fb6ff', 0.55);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.bias = -0.0004;
  moon.shadow.normalBias = 0.03;
  scene.add(moon, moon.target);
  const rim = new THREE.DirectionalLight('#4fd8ff', 1.1);
  scene.add(rim, rim.target);
  const setFocus = (c, span = 12) => {
    moon.target.position.copy(c);
    moon.position.copy(c).add(V(8, 60, -14));
    const s = moon.shadow.camera;
    s.left = s.bottom = -span; s.right = s.top = span; s.near = 1; s.far = 140;
    s.updateProjectionMatrix();
    rim.target.position.copy(c);
    rim.position.copy(c).add(V(-10, 8, -22));
  };
  setFocus(V());

  // ---- sand ----
  const sandGeo = new THREE.PlaneGeometry(2400, 2400, 300, 300);
  sandGeo.rotateX(-Math.PI / 2);
  {
    // denser vertices near the burrow: warp the grid towards the centre
    const p = sandGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), z = p.getZ(i);
      const r = Math.hypot(x, z), rr = 1200 * Math.pow(r / 1200, 2.2);
      if (r > 0) { x *= rr / r; z *= rr / r; }
      p.setXYZ(i, x, groundY(x, z), z);
    }
    sandGeo.computeVertexNormals();
  }
  const sandMap = sandTex();
  const sand = new THREE.Mesh(sandGeo, withCaustics(new THREE.MeshStandardMaterial({ map: sandMap, bumpMap: sandMap, bumpScale: 2.0, roughness: 0.95, color: '#626a7a' }), 0.7, 0.11));
  sand.receiveShadow = true;
  scene.add(sand);

  // ---- burrow: dark mouth with a raised rim, under a flat rubble slab ----
  const burrow = new THREE.Group();
  scene.add(burrow);
  {
    const hole = new THREE.Mesh(new THREE.CircleGeometry(1.4, 32), new THREE.MeshBasicMaterial({ color: '#020304' }));
    hole.rotation.x = -Math.PI / 2;
    hole.scale.set(1.2, 0.8, 1);
    hole.position.set(-1.0, 0.02, -2.6);
    burrow.add(hole);
    const rimG = new THREE.TorusGeometry(1.45, 0.5, 10, 36);
    rimG.rotateX(Math.PI / 2);
    rimG.scale(1.25, 0.6, 0.9);
    const rimM = new THREE.Mesh(rimG, new THREE.MeshStandardMaterial({ map: sandTex(), color: '#9a9082', roughness: 1 }));
    rimM.position.set(-1.0, 0.0, -2.6);
    rimM.receiveShadow = true;
    burrow.add(rimM);
    let slabG = mergeVertices(new THREE.IcosahedronGeometry(1, 4));
    const p = slabG.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const v = V(p.getX(i), p.getY(i), p.getZ(i));
      v.multiplyScalar(1 + 0.12 * Math.sin(v.x * 5 + v.z * 3) + 0.06 * Math.sin(v.y * 11 + v.x * 7));
      p.setXYZ(i, v.x * 4.2, v.y * 1.1, v.z * 3.4);
    }
    slabG.computeVertexNormals();
    const slab = new THREE.Mesh(slabG, withCaustics(new THREE.MeshStandardMaterial({ color: '#6f6670', roughness: 0.95 }), 0.4, 0.11, 1.2, 1.6));
    slab.position.set(-2.4, 0.9, -4.6);
    slab.rotation.set(0.25, 0.4, 0.12);
    slab.castShadow = slab.receiveShadow = true;
    burrow.add(slab);
    // encrusting pink coralline algae dots on the slab
    const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 16, 10), new THREE.MeshStandardMaterial({ color: '#c96a8a', roughness: 0.8 }), 40);
    for (let i = 0; i < 40; i++) {
      const a = R() * 6.28, rr = Math.sqrt(R());
      const pp = V(Math.cos(a) * rr * 3.6, 1.0, Math.sin(a) * rr * 2.8).applyEuler(slab.rotation).add(slab.position);
      dots.setMatrixAt(i, new THREE.Matrix4().compose(pp, new THREE.Quaternion(), V(1, 0.35, 1).multiplyScalar(0.08 + R() * 0.18)));
    }
    dots.visible = false;
  }

  // ---- pebbles and shell grit (macro detail around the burrow) ----
  const pebG = mergeVertices(new THREE.IcosahedronGeometry(1, 3));
  {
    const p = pebG.attributes.position;
    for (let i = 0; i < p.count; i++) { const v = V(p.getX(i), p.getY(i), p.getZ(i)); v.multiplyScalar(1 + 0.15 * Math.sin(v.x * 4 + v.y * 3)); p.setXYZ(i, v.x, v.y * 0.6, v.z); }
    pebG.computeVertexNormals();
  }
  const NP = 520;
  const pebbles = new THREE.InstancedMesh(pebG, withCaustics(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85 }), 0.4, 0.11, 0.5, 4.0), NP);
  const pebCols = ['#8d8478', '#b9ad9a', '#6e6a70', '#d8cdbd', '#a28a7a', '#d9b0a8'];
  for (let i = 0; i < NP; i++) {
    let x, z;
    do { const a = R() * 6.28, rr = 2 + Math.pow(R(), 1.6) * 60; x = Math.cos(a) * rr; z = Math.sin(a) * rr; } while (Math.abs(x) < 3.2 && z > -1.4 && z < 9); // keep the stage in front of the burrow clear
    const s = (0.1 + Math.pow(R(), 5) * 0.7) * (1 + Math.hypot(x, z) / 25);
    pebbles.setMatrixAt(i, new THREE.Matrix4().compose(V(x, groundY(x, z) + s * 0.2, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(R() * 0.4, R() * 6, R() * 0.4)), V(s, s, s)));
    pebbles.setColorAt(i, new THREE.Color(pebCols[i % pebCols.length]));
  }
  pebbles.castShadow = pebbles.receiveShadow = true;
  scene.add(pebbles);

  // ---- boulders ----
  const rockGeo = mergeVertices(new THREE.IcosahedronGeometry(1, 4));
  {
    const p = rockGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const v = V(p.getX(i), p.getY(i), p.getZ(i));
      v.multiplyScalar(1 + 0.2 * Math.sin(v.x * 4.1 + v.y * 2.3) * Math.cos(v.z * 3.7) + 0.08 * Math.sin(v.y * 9 + v.x * 7));
      p.setXYZ(i, v.x, v.y * 0.62, v.z);
    }
    rockGeo.computeVertexNormals();
  }
  const ROCKS = [[-40, -55, 30], [55, -70, 40], [-95, 10, 36], [110, 25, 45], [10, -140, 60], [-150, -90, 70], [160, -140, 80], [-30, 120, 40], [90, 110, 50], [-200, 60, 90], [230, -20, 85]];
  const rocks = new THREE.InstancedMesh(rockGeo, withCaustics(new THREE.MeshStandardMaterial({ color: '#5a5262', roughness: 0.95 }), 0.4, 0.11, 1.0, 0.25), ROCKS.length);
  ROCKS.forEach(([x, z, s], i) => rocks.setMatrixAt(i, new THREE.Matrix4().compose(V(x, groundY(x, z), z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, R() * 6, 0)), V(s, s, s))));
  rocks.castShadow = rocks.receiveShadow = true;
  scene.add(rocks);

  // ---- corals (scaled up to centimetres) ----
  const coralMat = withCaustics(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }), 0.45, 0.11, 0.9, 2.2);
  coralMat.onBeforeCompile = ((prev) => (sh) => { prev(sh); sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * 0.06;'); })(coralMat.onBeforeCompile);
  const VARIANTS = [
    branchCoral(1, '#5a1a6a', '#ff6ad0', { depth: 4, len: 0.5 }),
    branchCoral(2, '#8a2a08', '#ffb347', { depth: 4, len: 0.45, spread: 0.7 }),
    branchCoral(3, '#123a8a', '#6af0ff', { depth: 5, len: 0.38, rad: 0.05 }),
    branchCoral(4, '#8a0a28', '#ff5b6b', { depth: 4, len: 0.42, spread: 0.45 }),
    branchCoral(5, '#2a6a20', '#c8ff6a', { depth: 4, len: 0.4, spread: 0.6 }),
  ];
  const coralSpots = [];
  const clear = (x, z) => (Math.abs(x) < 16 && z > -6 && z < 70) || Math.hypot(x, z) < 13;
  while (coralSpots.length < 150) {
    const a = R() * Math.PI * 2, rr = 14 + Math.pow(R(), 0.8) * 260;
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    if (!clear(x, z)) coralSpots.push([x, z, R(), rr]);
  }
  const spot = (r0, r1) => { for (;;) { const a = R() * 6.28, rr = r0 + R() * (r1 - r0); const x = Math.cos(a) * rr, z = Math.sin(a) * rr; if (!clear(x, z)) return [x, z]; } };
  VARIANTS.forEach((g, vi) => {
    const list = coralSpots.filter((_, i) => i % VARIANTS.length === vi);
    const im = new THREE.InstancedMesh(g, coralMat, list.length);
    list.forEach(([x, z, s, rr], i) => im.setMatrixAt(i, new THREE.Matrix4().compose(V(x, groundY(x, z) - 0.5, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, s * 9, 0)), V(1, 1, 1).multiplyScalar((18 + s * 26) * (0.7 + rr / 300)))));
    im.castShadow = im.receiveShadow = true;
    scene.add(im);
  });
  // close "hero" corals that frame the burrow (the opening dolly passes through them)
  const hero = [];
  [[-9, 3, 0, 16], [8.5, -1, 2, 14], [-6.5, -9, 3, 18], [11, -8, 1, 15], [-14, -3, 4, 13]].forEach(([x, z, v, s]) => {
    const m = new THREE.Mesh(VARIANTS[v], coralMat);
    m.position.set(x, groundY(x, z) - 0.3, z);
    m.rotation.y = R() * 6;
    m.scale.setScalar(s);
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
    hero.push(m);
  });
  // brain corals
  const brain = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 40, 24), withCaustics(new THREE.MeshStandardMaterial({ map: brainTex('#8a7a4a', '#5a4a2a'), roughness: 0.8 }), 0.45, 0.11, 0.6, 1.5), 22);
  for (let i = 0; i < 22; i++) {
    const [x, z] = i === 0 ? [22, -26] : spot(30, 240);
    const s = i === 0 ? 8 : 8 + R() * 22;
    brain.setMatrixAt(i, new THREE.Matrix4().compose(V(x, groundY(x, z), z), new THREE.Quaternion(), V(1, 0.6, 1).multiplyScalar(s)));
  }
  brain.castShadow = brain.receiveShadow = true;
  scene.add(brain);
  // table corals
  const tableGeo = mergeGeometries([new THREE.CylinderGeometry(0.06, 0.1, 0.5, 8).translate(0, 0.25, 0), new THREE.CylinderGeometry(0.75, 0.15, 0.12, 28).translate(0, 0.55, 0)]);
  const table = new THREE.InstancedMesh(tableGeo, withCaustics(new THREE.MeshStandardMaterial({ color: '#2fae98', roughness: 0.7 }), 0.45, 0.11), 12);
  for (let i = 0; i < 12; i++) {
    const [x, z] = spot(60, 260);
    table.setMatrixAt(i, new THREE.Matrix4().compose(V(x, groundY(x, z), z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, R() * 6, 0)), V(1, 1, 1).multiplyScalar(40 + R() * 50)));
  }
  table.castShadow = table.receiveShadow = true;
  scene.add(table);
  // tube sponges
  const tubes = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.11, 0.08, 1, 16, 1, true).translate(0, 0.5, 0), withCaustics(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.75, side: THREE.DoubleSide }), 0.4, 0.11), 40);
  for (let i = 0; i < 40; i++) {
    if (i % 4 === 0) tubes.userData.c = spot(25, 200);
    const sc = 20 + R() * 20;
    const x = tubes.userData.c[0] + (R() - 0.5) * 8, z = tubes.userData.c[1] + (R() - 0.5) * 8;
    tubes.setMatrixAt(i, new THREE.Matrix4().compose(V(x, groundY(x, z), z), new THREE.Quaternion().setFromEuler(new THREE.Euler((R() - 0.5) * 0.3, 0, (R() - 0.5) * 0.3)), V(sc, sc * (0.6 + R() * 0.9), sc)));
    tubes.setColorAt(i, new THREE.Color().setHSL(0.72 + R() * 0.25, 0.75, 0.5));
  }
  tubes.castShadow = true;
  scene.add(tubes);
  // sea fans
  const fans = [];
  for (let i = 0; i < 14; i++) {
    const col = ['#ff5a5a', '#c76bff', '#ff9a3c', '#ff4fa0'][i % 4];
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6).translate(0, 0.8, 0), new THREE.MeshStandardMaterial({ map: fanTex(col), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.7 }));
    const [fx, fz] = spot(40, 260);
    m.position.set(fx, groundY(fx, fz), fz);
    m.rotation.y = R() * 3;
    m.scale.setScalar(35 + R() * 40);
    m.castShadow = true;
    scene.add(m);
    fans.push({ m, ph: R() * 6 });
  }
  // anemones (tentacles sway in the vertex shader)
  const tentacle = new THREE.CapsuleGeometry(0.025, 0.32, 3, 6).translate(0, 0.18, 0);
  const anemGeos = [];
  for (let k = 0; k < 70; k++) {
    const a = (k / 70) * Math.PI * 2 * 3.1, rr = 0.05 + 0.2 * (k / 70);
    const g = tentacle.clone();
    g.applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(a) * 0.6 * rr * 4, 0, -Math.cos(a) * 0.6 * rr * 4)));
    g.translate(Math.cos(a) * rr, 0.12, Math.sin(a) * rr);
    g.setAttribute('ph', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(k * 0.37), 1));
    g.deleteAttribute('uv');
    anemGeos.push(g);
  }
  const anemBase = new THREE.CylinderGeometry(0.22, 0.28, 0.14, 16).translate(0, 0.07, 0);
  anemBase.setAttribute('ph', new THREE.BufferAttribute(new Float32Array(anemBase.attributes.position.count).fill(-1), 1));
  anemBase.deleteAttribute('uv');
  const anemMat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ff3f9a', emissiveIntensity: 0.25, roughness: 0.5 });
  anemMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;\nattribute float ph;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        if (ph >= 0.0) { float h = max(0.0, position.y - 0.12); float sw = sin(uTime * 1.3 + ph + float(gl_InstanceID)) * 0.35 * h * h * 4.0;
          transformed.x += sw; transformed.z += cos(uTime * 1.1 + ph) * 0.2 * h * h * 4.0; }`);
  };
  const anemones = new THREE.InstancedMesh(mergeGeometries([...anemGeos, anemBase]), anemMat, 16);
  for (let i = 0; i < 16; i++) {
    const [x, z] = i === 0 ? [-12, 9] : spot(18, 160);
    anemones.setMatrixAt(i, new THREE.Matrix4().compose(V(x, groundY(x, z), z), new THREE.Quaternion(), V(1, 1, 1).multiplyScalar(i === 0 ? 14 : 12 + R() * 18)));
    anemones.setColorAt(i, new THREE.Color().setHSL([0.92, 0.08, 0.55, 0.8][i % 4], 0.8, 0.62));
  }
  anemones.castShadow = true;
  scene.add(anemones);

  // ---- distant fish (instanced, tails wiggle) ----
  const fishGeo = (() => {
    const bodyG = new THREE.SphereGeometry(1, 16, 10);
    bodyG.scale(0.035, 0.09, 0.14);
    const tl = new THREE.ConeGeometry(0.07, 0.09, 4);
    tl.rotateX(-Math.PI / 2); tl.scale(0.35, 1, 1); tl.translate(0, 0, -0.17);
    return mergeGeometries([bodyG, tl].map((x) => { x.deleteAttribute('uv'); return x.toNonIndexed(); }));
  })();
  const fishMat = new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.2 });
  fishMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float behind = max(0.0, -position.z - 0.02);
        transformed.x += sin(uTime * 12.0 + float(gl_InstanceID) * 1.7) * behind * 0.6;`);
  };
  const NF = 40;
  const fish = new THREE.InstancedMesh(fishGeo, fishMat, NF);
  const fishData = [];
  for (let i = 0; i < NF; i++) {
    const school = i % 3;
    fishData.push({ school, r: 40 + school * 25 + R() * 25, y: 40 + school * 25 + R() * 30, ph: R() * 6.28, sp: (0.05 + R() * 0.02) * (school % 2 ? -1 : 1) });
    fish.setColorAt(i, new THREE.Color(['#7fb4ff', '#ffd27a', '#ff8f6a'][school]));
  }
  scene.add(fish);

  // ---- moonlight shafts ----
  const rayTex = canvasTexture(128, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const v = g.createLinearGradient(0, 0, 0, h);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(0.15, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = v; g.fillRect(0, 0, w, h);
  });
  const rays = [];
  for (let i = 0; i < 12; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(40, 700).translate(0, -350, 0), new THREE.MeshBasicMaterial({ map: rayTex, color: new THREE.Color(0.35, 0.6, 0.85), transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
    m.position.set((R() - 0.5) * 500, 500, (R() - 0.5) * 500 - 80);
    m.rotation.set(0, R() * 3, 0.18);
    scene.add(m);
    rays.push({ m, ph: R() * 6, w: 0.6 + R() * 1.4 });
  }

  // ---- particles: marine snow + bioluminescent plankton (around the camera focus) ----
  const NS = 900;
  const sGeo = new THREE.BufferGeometry();
  sGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NS * 3), 3));
  const snow = new THREE.Points(sGeo, new THREE.PointsMaterial({ map: softDotTexture(), size: 0.12, color: '#d8ecff', transparent: true, opacity: 0.6, depthWrite: false }));
  snow.frustumCulled = false;
  scene.add(snow);
  const sSeeds = Array.from({ length: NS }, () => [(R() - 0.5), R(), (R() - 0.5), R() * 6.28, R()]);
  const NG = 260;
  const gGeo = new THREE.BufferGeometry();
  gGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NG * 3), 3));
  const glow = new THREE.Points(gGeo, new THREE.PointsMaterial({ map: softDotTexture(), size: 0.22, color: '#5ff6ff', transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  glow.frustumCulled = false;
  scene.add(glow);
  const gSeeds = Array.from({ length: NG }, () => [(R() - 0.5), R(), (R() - 0.5), R() * 6.28, R()]);

  return {
    scene, moon, rim, hemi, setFocus, uTime, hero, burrow,
    update(t, focus = V(), span = 30) {
      uTime.value = t;
      for (const f of fans) f.m.rotation.x = Math.sin(t * 0.6 + f.ph) * 0.06;
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
      fishData.forEach((d, i) => {
        const a = d.ph + t * d.sp * 2.2;
        const cx = [-60, 80, 20][d.school], cz = [-120, -90, -180][d.school];
        const p = V(cx + Math.cos(a) * d.r, d.y + 5 * Math.sin(t * 0.7 + i), cz + Math.sin(a) * d.r * 0.6);
        const tg = V(-Math.sin(a), 0, Math.cos(a) * 0.6).multiplyScalar(Math.sign(d.sp)).normalize();
        q.setFromUnitVectors(V(0, 0, 1), tg);
        m4.compose(p, q, V(1, 1, 1).multiplyScalar(30));
        fish.setMatrixAt(i, m4);
      });
      fish.instanceMatrix.needsUpdate = true;
      for (const r of rays) {
        r.m.material.opacity = 0.05 + 0.04 * Math.sin(t * 0.5 + r.ph);
        r.m.scale.x = r.w * (0.8 + 0.2 * Math.sin(t * 0.4 + r.ph));
      }
      // particles live in a box of size `span` around the focus point
      const sa = sGeo.attributes.position.array;
      sSeeds.forEach(([x, y, z, p, k], i) => {
        const yy = (((y * span - t * (0.25 + k * 0.3)) % span) + span) % span;
        sa.set([focus.x + x * span * 1.6 + Math.sin(t * 0.3 + p) * 0.4, focus.y - span * 0.35 + yy, focus.z + z * span * 1.6 + Math.cos(t * 0.25 + p) * 0.4], i * 3);
      });
      sGeo.attributes.position.needsUpdate = true;
      snow.material.size = 0.004 * span + 0.05;
      const ga = gGeo.attributes.position.array;
      gSeeds.forEach(([x, y, z, p, k], i) => {
        ga.set([focus.x + x * span * 1.4 + Math.sin(t * 0.5 + p) * 0.6, focus.y - span * 0.2 + y * span * 0.7 + Math.sin(t * 0.4 + p * 2) * 0.5, focus.z + z * span * 1.4], i * 3);
      });
      gGeo.attributes.position.needsUpdate = true;
      glow.material.size = 0.006 * span + 0.08;
      glow.material.opacity = 0.65 + 0.2 * Math.sin(t * 1.7);
    },
  };
}
