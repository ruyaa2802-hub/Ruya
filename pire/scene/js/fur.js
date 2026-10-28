import * as THREE from 'three';
import { canvasTexture, rng } from './util.js';

// ---------------------------------------------------------------------------
// Macro "cat fur" in millimetres: pale skin with pores, dense tapered hairs
// (≈0.06 mm thick, 8–16 mm long, leaning one way), lit from behind so the
// hairs glow. Hairs are kept away from a clear lane (the flea's jump path)
// so the camera can see through.
// ---------------------------------------------------------------------------
function hairGeo(len, bend, seed) {
  const r = rng(seed);
  const pts = [];
  for (let i = 0; i <= 8; i++) {
    const f = i / 8;
    pts.push(new THREE.Vector3(bend * f * f * len * 0.5 + (r() - 0.5) * 0.04, f * len, (r() - 0.5) * 0.05 * f * len));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const g = new THREE.TubeGeometry(curve, 24, 1, 5, false);
  // taper: rebuild the radius along the length
  const p = g.attributes.position, n = g.attributes.normal;
  const P = curve.getSpacedPoints(24);
  for (let i = 0; i <= 24; i++) {
    const rad = 0.045 * (1 - 0.92 * (i / 24));
    for (let j = 0; j <= 5; j++) {
      const k = i * 6 + j;
      p.setXYZ(k, P[i].x + n.getX(k) * rad, P[i].y + n.getY(k) * rad, P[i].z + n.getZ(k) * rad);
    }
  }
  g.computeVertexNormals();
  return g;
}

export function createFur() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#120d0b');
  scene.fog = new THREE.Fog('#1d1512', 30, 140);
  scene.add(new THREE.HemisphereLight('#ffe8d4', '#3a2a24', 0.7));
  const key = new THREE.DirectionalLight('#fff0dd', 2.4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0005;
  scene.add(key, key.target);
  const back = new THREE.DirectionalLight('#ffc890', 3.5);
  scene.add(back, back.target);
  const setKey = (center, span = 10) => {
    key.target.position.copy(center);
    key.position.copy(center).add(new THREE.Vector3(10, 30, 18));
    const c = key.shadow.camera;
    c.left = c.bottom = -span; c.right = c.top = span; c.near = 1; c.far = 120;
    c.updateProjectionMatrix();
    back.target.position.copy(center);
    back.position.copy(center).add(new THREE.Vector3(-8, 10, -30));
  };
  setKey(new THREE.Vector3());

  const skinTex = canvasTexture(1024, 1024, (g, w, h) => {
    const r = rng(8);
    g.fillStyle = '#c9a99a';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4000; i++) {
      g.fillStyle = `rgba(${120 + r() * 60},${80 + r() * 40},${70 + r() * 30},${0.15 + r() * 0.25})`;
      const s = 2 + r() * 6;
      g.beginPath(); g.arc(r() * w, r() * h, s, 0, 6.283); g.fill();
    }
  }, { repeat: [6, 6] });
  const skin = new THREE.Mesh(new THREE.PlaneGeometry(240, 240, 60, 60), new THREE.MeshStandardMaterial({ map: skinTex, roughness: 0.7, color: '#ffffff' }));
  skin.rotation.x = -Math.PI / 2;
  {
    const p = skin.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, 0.25 * Math.sin(p.getX(i) * 0.4) * Math.cos(p.getY(i) * 0.33));
    skin.geometry.computeVertexNormals();
  }
  skin.receiveShadow = true;
  scene.add(skin);

  const hairMat = new THREE.MeshPhysicalMaterial({ color: '#d7a46c', roughness: 0.45, sheen: 0.6, sheenColor: new THREE.Color('#fff0d0'), clearcoat: 0.3 });
  const darkMat = new THREE.MeshPhysicalMaterial({ color: '#5a3a22', roughness: 0.5, sheen: 0.5, sheenColor: new THREE.Color('#ffd9a0') });
  const R = rng(31);
  const geos = [hairGeo(12, 0.6, 1), hairGeo(15, 0.9, 2), hairGeo(9, 0.4, 3)];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  const lane = (x, z) => z > -2.2 && z < 20 && x > -16 && x < 30; // keep the jump lane and the camera side clear
  for (const [gi, g] of geos.entries()) {
    for (const mat of [hairMat, darkMat]) {
      const N = mat === hairMat ? 1700 : 550;
      const im = new THREE.InstancedMesh(g, mat, N);
      let k = 0;
      while (k < N) {
        const x = (R() - 0.5) * 110, z = (R() - 0.5) * 90;
        if (lane(x, z) && R() < (z < 2.2 ? 0.85 : 0.94)) continue;
        // hairs lean toward +x (the "grain" of the fur) with some spread
        q.setFromEuler(new THREE.Euler((R() - 0.5) * 0.35, (R() - 0.5) * 0.7, -0.55 - R() * 0.35, 'YXZ'));
        const s = 0.7 + R() * 0.6;
        m4.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(1, s, 1));
        im.setMatrixAt(k++, m4);
      }
      im.castShadow = true;
      im.receiveShadow = true;
      scene.add(im);
    }
  }
  return { scene, key, back, setKey };
}
