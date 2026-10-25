import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, canvasTexture, softDotTexture, v3 } from './util.js';

// ---------------------------------------------------------------------------
// Outdoor world: meadow with flowers, hive box, trees, sky and the morning sun.
// Geography (used by the dance explanation):
//   G     = centre of the flower garden
//   HIVE  = hive position
//   gDir  = unit direction hive → garden (on the ground)
//   sDir  = unit azimuth of the sun; the garden lies DANCE_ANGLE clockwise
//           (to the right) of the sun as seen from the hive.
// ---------------------------------------------------------------------------

export const DANCE_ANGLE = THREE.MathUtils.degToRad(35);
export const SUN_ELEV = THREE.MathUtils.degToRad(24);

export function terrainH(x, z) {
  return 0.45 * Math.sin(0.09 * x + 1.0) * Math.cos(0.075 * z) + 0.3 * Math.sin(0.04 * x + 0.06 * z + 2.0);
}

export function createGarden() {
  const scene = new THREE.Scene();
  const R = rng(7);

  const G = v3(0, terrainH(0, 0), 0);
  const HIVE = v3(-30, 0, 24);
  HIVE.y = terrainH(HIVE.x, HIVE.z);
  const gDir = v3(G.x - HIVE.x, 0, G.z - HIVE.z).normalize();
  const rightOf = (d) => v3(-d.z, 0, d.x);
  // sun azimuth = garden direction rotated DANCE_ANGLE to the left
  const sDir = gDir.clone().multiplyScalar(Math.cos(DANCE_ANGLE)).addScaledVector(rightOf(gDir), -Math.sin(DANCE_ANGLE)).normalize();
  const sunDir = v3(sDir.x * Math.cos(SUN_ELEV), Math.sin(SUN_ELEV), sDir.z * Math.cos(SUN_ELEV)).normalize();
  const hDir = gDir.clone().negate(); // garden → hive
  const perp = rightOf(hDir);

  // ---------------- Sky ----------------
  const skyUniforms = { sunDir: { value: sunDir }, uTime: { value: 0 } };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(900, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: skyUniforms,
      vertexShader: /* glsl */ `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `
        varying vec3 vDir; uniform vec3 sunDir; uniform float uTime;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
        float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
          return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
        float fbm(vec2 p){ float a=0.5, s=0.0; for(int i=0;i<4;i++){ s+=a*noise(p); p*=2.03; a*=0.5;} return s; }
        void main(){
          vec3 d = normalize(vDir);
          float h = max(d.y, 0.0);
          vec3 zen = vec3(0.10, 0.30, 0.85);
          vec3 hor = vec3(1.0, 0.80, 0.58);
          vec3 col = mix(hor, zen, pow(h, 0.32));
          col = mix(col, vec3(0.75,0.62,0.45), smoothstep(0.0,-0.2,d.y));
          float sd = max(dot(d, sunDir), 0.0);
          col += vec3(1.0, 0.72, 0.4) * pow(sd, 6.0) * 0.55;
          col += vec3(1.0, 0.85, 0.6) * pow(sd, 90.0) * 2.0;
          col += vec3(1.0, 0.95, 0.85) * smoothstep(0.9993, 0.9997, sd) * 40.0;
          // soft clouds
          if (d.y > 0.0) {
            vec2 uv = d.xz / (d.y + 0.25) * 1.6 + vec2(uTime*0.01, 0.0);
            float c = smoothstep(0.52, 0.85, fbm(uv));
            vec3 cc = mix(vec3(1.0,0.93,0.86), vec3(1.0,0.8,0.6), pow(sd,4.0));
            col = mix(col, cc * (1.1 + pow(sd,8.0)), c * 0.7 * smoothstep(0.02,0.25,d.y));
          }
          gl_FragColor = vec4(col, 1.0);
        }`,
    })
  );
  sky.renderOrder = -10;
  scene.add(sky);
  const fogColor = new THREE.Color().setRGB(0.95, 0.78, 0.6);
  scene.fog = new THREE.Fog(fogColor, 60, 320);

  // ---------------- Lights ----------------
  const sun = new THREE.DirectionalLight(new THREE.Color('#fff0d6'), 3.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(new THREE.Color('#bcd9ff'), new THREE.Color('#6b7f36'), 1.15);
  scene.add(hemi);
  const fill = new THREE.DirectionalLight(new THREE.Color('#ffe6c4'), 0.9);
  scene.add(fill, fill.target);

  // ---------------- Ground ----------------
  const groundGeo = new THREE.PlaneGeometry(700, 700, 220, 220);
  groundGeo.rotateX(-Math.PI / 2);
  {
    const p = groundGeo.attributes.position;
    const col = [];
    const c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      p.setY(i, terrainH(x, z));
      const n = Math.sin(x * 0.31) * Math.cos(z * 0.27) * 0.5 + Math.sin(x * 0.07 + z * 0.11) * 0.5;
      c.setHSL(0.24 + n * 0.03, 0.55, 0.3 + n * 0.05);
      col.push(c.r, c.g, c.b);
    }
    groundGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    groundGeo.computeVertexNormals();
  }
  const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  ground.receiveShadow = true;
  scene.add(ground);

  // ---------------- Grass (instanced, wind sway in shader) ----------------
  const grassUniforms = { uTime: { value: 0 } };
  {
    const blade = new THREE.PlaneGeometry(0.09, 1, 1, 4);
    blade.translate(0, 0.5, 0);
    const p = blade.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      p.setX(i, p.getX(i) * (1 - y * 0.92));
      p.setZ(i, y * y * 0.25);
    }
    blade.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.9 });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = grassUniforms.uTime;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         #ifdef USE_INSTANCING
           float ph = instanceMatrix[3].x * 0.35 + instanceMatrix[3].z * 0.23;
           transformed.x += sin(uTime * 1.6 + ph) * 0.18 * position.y * position.y;
           transformed.z += cos(uTime * 1.3 + ph) * 0.08 * position.y * position.y;
         #endif`
      );
    };
    const N = 16000;
    const im = new THREE.InstancedMesh(blade, mat, N);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), pos = new THREE.Vector3();
    const c = new THREE.Color();
    let k = 0;
    while (k < N) {
      // cluster around garden and along the hive path
      let x, z;
      if (R() < 0.7) {
        const a = R() * Math.PI * 2, r = Math.sqrt(R()) * 34;
        x = G.x + Math.cos(a) * r; z = G.z + Math.sin(a) * r;
      } else {
        const u = R();
        x = G.x + hDir.x * 40 * u + perp.x * (R() - 0.5) * 22;
        z = G.z + hDir.z * 40 * u + perp.z * (R() - 0.5) * 22;
      }
      pos.set(x, terrainH(x, z) - 0.02, z);
      q.setFromEuler(new THREE.Euler((R() - 0.5) * 0.4, R() * Math.PI * 2, (R() - 0.5) * 0.4));
      const h = 0.45 + R() * 0.75;
      s.set(1 + R(), h, 1);
      m.compose(pos, q, s);
      im.setMatrixAt(k, m);
      c.setHSL(0.23 + R() * 0.07, 0.55 + R() * 0.2, 0.28 + R() * 0.16);
      im.setColorAt(k, c);
      k++;
    }
    im.receiveShadow = true;
    scene.add(im);
  }

  // ---------------- Flower geometry ----------------
  const petalBase = new THREE.SphereGeometry(1, 10, 6);
  function daisyHead(n, len, wid, cup) {
    const parts = [];
    for (let i = 0; i < n; i++) {
      const g = petalBase.clone();
      g.scale(wid, 0.035, len * 0.5);
      g.translate(0, 0, len * 0.5 + 0.12);
      g.rotateX(-cup);
      g.rotateY((i / n) * Math.PI * 2 + (i % 2) * 0.05);
      parts.push(g);
    }
    return mergeGeometries(parts);
  }
  const daisyGeo = daisyHead(9, 0.9, 0.2, 0.18);
  const cosmosGeo = daisyHead(8, 0.85, 0.3, 0.1);
  const centerGeo = new THREE.SphereGeometry(1, 16, 10);
  centerGeo.scale(0.28, 0.14, 0.28);
  const stemGeo = (() => {
    const st = new THREE.CylinderGeometry(0.045, 0.06, 1, 6);
    st.translate(0, 0.5, 0);
    const leaf = new THREE.SphereGeometry(1, 8, 5);
    leaf.scale(0.12, 0.02, 0.38);
    leaf.translate(0, 0, 0.36);
    leaf.rotateX(-0.6);
    const leafA = leaf.clone().translate(0, 0.35, 0);
    const leafB = leaf.clone().rotateY(Math.PI * 0.9).translate(0, 0.55, 0);
    return mergeGeometries([st, leafA, leafB]);
  })();
  const tulipGeo = (() => {
    const parts = [];
    for (let i = 0; i < 6; i++) {
      const g = new THREE.SphereGeometry(1, 10, 8);
      g.scale(0.2, 0.42, 0.09);
      g.translate(0, 0.38, 0.14 + (i % 2) * 0.03);
      g.rotateX(0.22 + (i % 2) * 0.12);
      g.rotateY((i / 6) * Math.PI * 2 + (i % 2) * 0.5);
      parts.push(g);
    }
    return mergeGeometries(parts);
  })();
  const lavGeo = (() => {
    const parts = [];
    const b = new THREE.SphereGeometry(1, 6, 4);
    for (let i = 0; i < 14; i++) {
      const g = b.clone();
      const s = 0.09 * (1 - i / 20);
      g.scale(s, s * 1.3, s);
      g.translate(Math.sin(i * 2.4) * 0.05, i * 0.07, Math.cos(i * 2.4) * 0.05);
      parts.push(g);
    }
    return mergeGeometries(parts);
  })();

  const petalMat = new THREE.MeshStandardMaterial({ roughness: 0.55, side: THREE.DoubleSide });
  const centerMat = new THREE.MeshStandardMaterial({ roughness: 0.8 });
  const stemMat = new THREE.MeshStandardMaterial({ color: '#4f8a2b', roughness: 0.8 });
  const PETALS = ['#ff6fa8', '#ffffff', '#b98cff', '#ff9b3d', '#ffd23d', '#ff5f7d', '#ffffff', '#ff8fc4', '#9fc3ff'];
  const TULIP = ['#ff4256', '#ffcc33', '#ff7aa2', '#ff8a2a'];

  // reserved spots for hero flowers (kept clear)
  const HF = v3(G.x + 2, 0, G.z + 3);
  HF.y = terrainH(HF.x, HF.z);
  const landSpots = [
    [9.5, 0.6], [8.2, -2.6], [10.8, 3.0], [12.4, -0.8], [7.4, 2.6], [11.6, -3.6], [13.6, 1.9],
  ].map(([d, w]) => {
    const p = v3(G.x + hDir.x * d + perp.x * w, 0, G.z + hDir.z * d + perp.z * w);
    p.y = terrainH(p.x, p.z);
    return p;
  });
  const reserved = [{ p: HF, r: 2.3 }, ...landSpots.map((p) => ({ p, r: 1.5 }))];

  const flowers = [];
  let tries = 0;
  while (flowers.length < 760 && tries < 20000) {
    tries++;
    const a = R() * Math.PI * 2;
    const rr = R() < 0.82 ? Math.sqrt(R()) * 22 : 22 + R() * 16;
    const x = G.x + Math.cos(a) * rr, z = G.z + Math.sin(a) * rr;
    const p = v3(x, terrainH(x, z), z);
    if (reserved.some((o) => o.p.distanceTo(p) < o.r)) continue;
    if (flowers.some((f) => Math.hypot(f.p.x - x, f.p.z - z) < 0.85)) continue;
    const typeR = R();
    const type = typeR < 0.56 ? 'daisy' : typeR < 0.8 ? 'cosmos' : typeR < 0.88 ? 'tulip' : 'lav';
    const nearHero = p.distanceTo(HF) < 5;
    flowers.push({
      p,
      type,
      h: (nearHero ? 1.0 : 1.3) + R() * (nearHero ? 0.9 : 1.7),
      s: 0.75 + R() * 0.45,
      tilt: new THREE.Euler((R() - 0.5) * 0.5, R() * 6.28, (R() - 0.5) * 0.5),
      col: type === 'tulip' ? TULIP[Math.floor(R() * TULIP.length)] : type === 'lav' ? '#8a62d6' : PETALS[Math.floor(R() * PETALS.length)],
    });
  }

  function buildInstanced(list, geo, mat, matrixFn, colorFn, shadow = true) {
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    list.forEach((f, i) => {
      matrixFn(f, m);
      im.setMatrixAt(i, m);
      if (colorFn) im.setColorAt(i, c.set(colorFn(f)));
    });
    im.castShadow = shadow;
    im.receiveShadow = true;
    scene.add(im);
    return im;
  }
  const q = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  const headMatrix = (f, m) => {
    q.setFromEuler(f.tilt);
    m.compose(v3(f.p.x, f.p.y + f.h * f.s, f.p.z), q, one.clone().multiplyScalar(f.s));
  };
  buildInstanced(flowers.filter((f) => f.type !== 'lav'), stemGeo, stemMat, (f, m) => {
    q.setFromEuler(new THREE.Euler(0, f.tilt.y, 0));
    m.compose(f.p, q, v3(f.s, f.h * f.s, f.s));
  });
  const daisies = flowers.filter((f) => f.type === 'daisy');
  const cosmos = flowers.filter((f) => f.type === 'cosmos');
  buildInstanced(daisies, daisyGeo, petalMat, headMatrix, (f) => f.col);
  buildInstanced(cosmos, cosmosGeo, petalMat, headMatrix, (f) => f.col);
  buildInstanced([...daisies, ...cosmos], centerGeo, centerMat, headMatrix, (f) => (f.col === '#ffd23d' || f.col === '#ff9b3d' ? '#5a3214' : '#ffc61a'));
  buildInstanced(flowers.filter((f) => f.type === 'tulip'), tulipGeo, petalMat, headMatrix, (f) => f.col);
  buildInstanced(flowers.filter((f) => f.type === 'lav'), lavGeo, new THREE.MeshStandardMaterial({ roughness: 0.7 }), (f, m) => {
    q.setFromEuler(new THREE.Euler(f.tilt.x * 0.3, 0, f.tilt.z * 0.3));
    m.compose(f.p, q, v3(f.s * 1.2, f.h * 1.1, f.s * 1.2));
  }, () => '#8f69de');

  // ---------------- Hero / landing flowers (animated) ----------------
  function makeFlower(pos, { color = '#ff6fa8', center = '#ffc61a', stem = 2.4, size = 1.25, petals = 8, yaw = 0 } = {}) {
    const root = new THREE.Group();
    root.position.copy(pos);
    root.rotation.y = yaw;
    const stemM = new THREE.Mesh(stemGeo, stemMat);
    stemM.scale.set(size * 0.9, stem, size * 0.9);
    stemM.castShadow = true;
    root.add(stemM);
    const head = new THREE.Group();
    head.position.y = stem;
    root.add(head);
    const pm = new THREE.MeshStandardMaterial({ color, roughness: 0.5, side: THREE.DoubleSide, emissive: new THREE.Color(color), emissiveIntensity: 0.06 });
    const ph = new THREE.Mesh(daisyHead(petals, 0.9, 0.3, 0.16), pm);
    ph.scale.setScalar(size);
    ph.castShadow = ph.receiveShadow = true;
    head.add(ph);
    const cm = new THREE.Mesh(centerGeo, new THREE.MeshStandardMaterial({ color: center, roughness: 0.85 }));
    cm.scale.setScalar(size);
    cm.castShadow = cm.receiveShadow = true;
    head.add(cm);
    // tiny pollen bumps on the centre
    const bumps = new THREE.InstancedMesh(new THREE.SphereGeometry(0.03, 6, 4), new THREE.MeshStandardMaterial({ color: '#ffb000', roughness: 0.9 }), 40);
    const m = new THREE.Matrix4();
    for (let i = 0; i < 40; i++) {
      const a = i * 2.39996, r = Math.sqrt(i / 40) * 0.24 * size;
      const y = 0.14 * size * Math.sqrt(Math.max(0, 1 - (r / (0.28 * size)) ** 2));
      m.makeTranslation(Math.cos(a) * r, y, Math.sin(a) * r);
      bumps.setMatrixAt(i, m);
    }
    head.add(bumps);
    scene.add(root);
    const f = {
      root,
      head,
      size,
      landings: [], // times when a bee lands (for bounce)
      topLocal: v3(0, 0.14 * size, 0),
      update(t) {
        let rx = 0, rz = 0, dy = 0;
        for (const tl of f.landings) {
          if (t < tl) continue;
          const k = t - tl;
          const e = Math.exp(-k * 3.2) * Math.sin(k * 11);
          rx += e * 0.08;
          rz += e * 0.05;
          dy += -Math.exp(-k * 4) * Math.sin(k * 9) * 0.08;
        }
        const sway = Math.sin(t * 1.3 + pos.x) * 0.025;
        root.rotation.set(rx + sway, yaw, rz + sway * 0.6);
        head.position.y = stem + dy;
      },
      top(out = new THREE.Vector3()) {
        root.updateMatrixWorld(true);
        return head.localToWorld(out.copy(f.topLocal));
      },
    };
    return f;
  }
  const heroFlower = makeFlower(HF, { color: '#ff5fa2', stem: 2.3, size: 1.35, yaw: 0.3 });
  const LCOL = ['#ffffff', '#b98cff', '#ff9b3d', '#ff6fa8', '#ffd23d', '#ff5f7d', '#9fc3ff'];
  const landingFlowers = landSpots.map((p, i) =>
    makeFlower(p, { color: LCOL[i % LCOL.length], center: LCOL[i % LCOL.length] === '#ffd23d' ? '#5a3214' : '#ffc61a', stem: 1.6 + (i % 3) * 0.35, size: 1.05 + (i % 2) * 0.15, yaw: i })
  );

  // ---------------- Hive box ----------------
  const hive = new THREE.Group();
  hive.position.copy(HIVE);
  hive.rotation.y = Math.atan2(gDir.x, gDir.z); // local +Z faces the garden
  scene.add(hive);
  const box = (w, h, d, color, y, z = 0, rough = 0.75) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: rough }));
    m.position.set(0, y, z);
    m.castShadow = m.receiveShadow = true;
    hive.add(m);
    return m;
  };
  const woodTex = canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#d8b07a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) { g.strokeStyle = `rgba(120,70,30,${0.08 + Math.random() * 0.12})`; g.lineWidth = 1 + Math.random() * 2; g.beginPath(); const y = Math.random() * h; g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + 6, w * 0.6, y - 6, w, y + 2); g.stroke(); }
  });
  [[-2.8, 0.4], [2.8, 0.4]].forEach(([x]) => { const leg = box(0.5, 0.8, 0.5, '#5a3b22', 0.4); leg.position.x = x; leg.position.z = 2.2; const l2 = leg.clone(); l2.position.z = -2.2; hive.add(l2); });
  box(7.2, 0.25, 6.0, '#6b4528', 0.92);
  const b1 = box(6.8, 2.8, 5.6, '#9cd0e4', 2.45);
  const b2 = box(6.8, 2.6, 5.6, '#f3e2b8', 5.15);
  b2.material.map = woodTex; b2.material.color.set('#f6e7c4');
  box(7.3, 0.5, 6.1, '#e9eef0', 6.7, 0, 0.6);
  box(7.0, 0.3, 5.8, '#c9d3d6', 7.0, 0, 0.6);
  // handholds
  for (const y of [2.8, 5.4]) { const hh = box(1.8, 0.25, 0.25, '#7d9cab', y, 2.85); if (y > 4) hh.material.color.set('#c9a874'); }
  // entrance slot + landing board
  const slot = box(3.6, 0.38, 0.2, '#1b0f05', 1.26, 2.76, 1);
  slot.material.emissive = new THREE.Color('#2a1505');
  box(4.2, 0.12, 1.2, '#b98b55', 1.0, 3.2);
  const E = new THREE.Vector3(0, 1.32, 3.0);
  hive.updateMatrixWorld(true);
  const entrance = hive.localToWorld(E.clone());

  // ---------------- Trees, bushes, hills ----------------
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#6a4a2e', roughness: 1 });
  const leafMats = ['#3f7d2c', '#4f9135', '#336b28', '#5c9a3a'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95 }));
  const blob = new THREE.IcosahedronGeometry(1, 3);
  const trunkGeo = new THREE.CylinderGeometry(0.5, 0.8, 1, 8);
  trunkGeo.translate(0, 0.5, 0);
  let placed = 0;
  while (placed < 42) {
    const a = R() * Math.PI * 2, r = 72 + R() * 70;
    const x = G.x + Math.cos(a) * r, z = G.z + Math.sin(a) * r;
    if (Math.hypot(x - HIVE.x, z - HIVE.z) < 14) continue;
    // keep the corridor hive→garden open
    const rel = v3(x - HIVE.x, 0, z - HIVE.z);
    const along = rel.dot(gDir), side = Math.abs(rel.dot(perp));
    if (along > -10 && along < 50 && side < 14) continue;
    const y = terrainH(x, z);
    const tg = new THREE.Group();
    tg.position.set(x, y, z);
    const s = 1.3 + R() * 1.4;
    tg.scale.setScalar(s);
    const tr = new THREE.Mesh(trunkGeo, trunkMat);
    tr.scale.set(1, 5, 1);
    tr.castShadow = true;
    tg.add(tr);
    const lm = leafMats[Math.floor(R() * leafMats.length)];
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(blob, lm);
      b.position.set((R() - 0.5) * 3.2, 6 + R() * 2.5, (R() - 0.5) * 3.2);
      b.scale.setScalar(2.2 + R() * 1.4);
      b.castShadow = true;
      b.receiveShadow = true;
      tg.add(b);
    }
    scene.add(tg);
    placed++;
  }
  const bushMat = new THREE.MeshStandardMaterial({ color: '#4a8a33', roughness: 0.95 });
  for (let i = 0; i < 26; i++) {
    const a = R() * Math.PI * 2, r = 26 + R() * 16;
    const x = G.x + Math.cos(a) * r, z = G.z + Math.sin(a) * r;
    if (Math.hypot(x - HIVE.x, z - HIVE.z) < 9) continue;
    const b = new THREE.Mesh(blob, bushMat);
    b.position.set(x, terrainH(x, z) + 0.6, z);
    b.scale.set(1.6 + R() * 1.5, 1.1 + R(), 1.6 + R() * 1.5);
    b.castShadow = b.receiveShadow = true;
    scene.add(b);
  }
  const hillMat = new THREE.MeshStandardMaterial({ color: '#5f8f4a', roughness: 1 });
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + R() * 0.2, r = 190 + R() * 60;
    const h = new THREE.Mesh(blob, hillMat);
    h.position.set(Math.cos(a) * r, -6, Math.sin(a) * r);
    h.scale.set(60 + R() * 50, 18 + R() * 22, 50 + R() * 40);
    scene.add(h);
  }

  // ---------------- Floating pollen / light motes ----------------
  const NP = 420;
  const pollenGeo = new THREE.BufferGeometry();
  const pBase = new Float32Array(NP * 3);
  for (let i = 0; i < NP * 3; i++) pBase[i] = R();
  pollenGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(NP * 3), 3));
  const pollen = new THREE.Points(
    pollenGeo,
    new THREE.PointsMaterial({ size: 0.09, map: softDotTexture(), color: new THREE.Color(1.1, 0.95, 0.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })
  );
  pollen.frustumCulled = false;
  scene.add(pollen);

  function updatePollen(t, focus) {
    const a = pollenGeo.attributes.position.array;
    const B = 22;
    for (let i = 0; i < NP; i++) {
      for (let k = 0; k < 3; k++) {
        const drift = [0.18, 0.06, 0.12][k] * t + Math.sin(t * 0.4 + i * 1.3 + k) * 0.6;
        let v = pBase[i * 3 + k] * B + drift - (focus.getComponent(k) - B / 2);
        v = ((v % B) + B) % B;
        a[i * 3 + k] = v + focus.getComponent(k) - B / 2;
      }
    }
    pollenGeo.attributes.position.needsUpdate = true;
  }

  // Sparkles burst (nectar) — a few additive points around a target
  const NS = 40;
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(NS * 3), 3));
  const sparkMat = new THREE.PointsMaterial({ size: 0.055, map: softDotTexture(), color: new THREE.Color(3.0, 2.0, 0.5), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const sparks = new THREE.Points(sparkGeo, sparkMat);
  sparks.frustumCulled = false;
  scene.add(sparks);
  function updateSparks(t, center, t0, dur) {
    const k = (t - t0) / dur;
    sparkMat.opacity = k > 0 && k < 1 ? Math.sin(k * Math.PI) : 0;
    const a = sparkGeo.attributes.position.array;
    for (let i = 0; i < NS; i++) {
      const ang = i * 2.399 + t * 0.8;
      const r = 0.15 + 0.45 * ((i * 0.37) % 1) + k * 0.25;
      a[i * 3] = center.x + Math.cos(ang) * r;
      a[i * 3 + 1] = center.y + 0.05 + ((i * 0.61) % 1) * 0.35 + k * 0.6;
      a[i * 3 + 2] = center.z + Math.sin(ang) * r;
    }
    sparkGeo.attributes.position.needsUpdate = true;
  }

  function setShadowFocus(center, radius) {
    sun.position.copy(center).addScaledVector(sunDir, 120);
    sun.target.position.copy(center);
    const c = sun.shadow.camera;
    c.left = -radius; c.right = radius; c.top = radius; c.bottom = -radius;
    c.near = 1; c.far = 260;
    c.updateProjectionMatrix();
  }

  return {
    scene,
    sun,
    sunDir,
    sDir,
    gDir,
    hDir,
    perp,
    G,
    HIVE,
    HF,
    hive,
    entrance,
    heroFlower,
    landingFlowers,
    fogColor,
    setFog(near, far) {
      scene.fog.near = near;
      scene.fog.far = far;
    },
    update(t, camera, focus) {
      fill.position.copy(camera.position).add(new THREE.Vector3(0, 3, 0));
      fill.target.position.copy(focus);
      grassUniforms.uTime.value = t;
      skyUniforms.uTime.value = t;
      sky.position.copy(camera.position);
      heroFlower.update(t);
      landingFlowers.forEach((f) => f.update(t));
      updatePollen(t, focus);
    },
    updateSparks,
    setShadowFocus,
  };
}
