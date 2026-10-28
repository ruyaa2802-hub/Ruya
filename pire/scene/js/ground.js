import * as THREE from 'three';
import { canvasTexture, rng } from './util.js';

// ---------------------------------------------------------------------------
// Macro textile "ground" in millimetres: a woven linen (yarns ≈0.8 mm thick,
// over/under weave) with loose fuzz fibres, a steel mm ruler lying on it, and a
// far backdrop. The top of the yarns is at about y = 0.45 (GROUND_Y).
// ---------------------------------------------------------------------------
export const GROUND_Y = 0.45;
const P = 0.9; // yarn spacing (mm)

function yarnTex() {
  const r = rng(4);
  return canvasTexture(256, 512, (g, w, h) => {
    g.fillStyle = '#d9cbb2';
    g.fillRect(0, 0, w, h);
    // twisted fibres: slanted strokes along the yarn (u = along the length → canvas y)
    for (let i = 0; i < 900; i++) {
      const x = r() * w, y = r() * h, l = 20 + r() * 60;
      const c = 150 + r() * 90;
      g.strokeStyle = `rgba(${c + 25},${c + 10},${c - 15},${0.25 + r() * 0.35})`;
      g.lineWidth = 1 + r() * 2;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + l * 0.5, y + l);
      g.stroke();
    }
  }, { repeat: [1, 40] });
}
function weaveTex() {
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#8f8270';
    g.fillRect(0, 0, w, h);
    for (let k = 0; k < 2; k++) for (let j = 0; j < 2; j++) {
      const over = (k + j) % 2 === 0;
      const x = k * w / 2, y = j * h / 2;
      const gr = over ? g.createLinearGradient(x, 0, x + w / 2, 0) : g.createLinearGradient(0, y, 0, y + h / 2);
      gr.addColorStop(0, '#9c8e78');
      gr.addColorStop(0.5, '#e2d4bb');
      gr.addColorStop(1, '#9c8e78');
      g.fillStyle = gr;
      g.fillRect(x + 6, y + 6, w / 2 - 12, h / 2 - 12);
    }
  }, { repeat: [1, 1] });
}

export function createGround() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#1b1512');
  scene.fog = new THREE.Fog('#2a211a', 120, 900);

  // ---- light ----
  const hemi = new THREE.HemisphereLight('#fff1dc', '#4a3a2c', 0.9);
  scene.add(hemi);
  const key = new THREE.DirectionalLight('#ffe9cc', 3.2);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight('#9cc4ff', 2.2);
  scene.add(rim, rim.target);
  const setKey = (center, span = 8, dir = new THREE.Vector3(0.5, 1, 0.6), rimDir = new THREE.Vector3(-0.6, 0.5, -0.8)) => {
    key.target.position.copy(center);
    key.position.copy(center).addScaledVector(dir.clone().normalize(), span * 4);
    const c = key.shadow.camera;
    c.left = c.bottom = -span; c.right = c.top = span; c.near = 0.1; c.far = span * 10;
    c.updateProjectionMatrix();
    rim.target.position.copy(center);
    rim.position.copy(center).addScaledVector(rimDir.clone().normalize(), span * 4);
  };
  setKey(new THREE.Vector3());

  // ---- woven yarns (instanced, two crossing directions) ----
  const HALF = 60, N = Math.round((2 * HALF) / P);
  const yarnMat = new THREE.MeshStandardMaterial({ map: yarnTex(), roughness: 0.9, color: '#ffffff' });
  function yarnGeo() {
    const pts = [];
    for (let i = 0; i <= 260; i++) {
      const x = -HALF + (2 * HALF * i) / 260;
      pts.push(new THREE.Vector3(x, 0.17 * Math.sin((Math.PI * x) / P), 0));
    }
    const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 900, 0.4, 10, false);
    g.scale(1, 0.62, 1); // flattened yarn
    return g;
  }
  const g1 = yarnGeo();
  const weft = new THREE.InstancedMesh(g1, yarnMat, N);
  const warp = new THREE.InstancedMesh(g1, yarnMat, N);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s1 = new THREE.Vector3(1, 1, 1);
  for (let k = 0; k < N; k++) {
    const z = -HALF + (k + 0.5) * P;
    // weft along X: alternate phase each row (over/under)
    m4.compose(new THREE.Vector3((k % 2) * P, 0.1, z), q.identity(), s1);
    weft.setMatrixAt(k, m4);
    // warp along Z, sitting in the dips of the weft
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
    m4.compose(new THREE.Vector3(z, 0.1, ((k + 1) % 2) * P), q, s1);
    warp.setMatrixAt(k, m4);
  }
  for (const m of [weft, warp]) { m.receiveShadow = true; m.castShadow = true; scene.add(m); }
  // under-layer so no holes show, and the far floor with a weave texture
  const under = new THREE.Mesh(new THREE.PlaneGeometry(2 * HALF, 2 * HALF), new THREE.MeshStandardMaterial({ color: '#5a4e40', roughness: 1 }));
  under.rotation.x = -Math.PI / 2;
  under.position.y = -0.15;
  scene.add(under);
  const wt = weaveTex();
  wt.wrapS = wt.wrapT = THREE.RepeatWrapping;
  wt.repeat.set(1600 / (2 * P), 1600 / (2 * P));
  const far = new THREE.Mesh(new THREE.RingGeometry(HALF * 0.98, 800, 64, 1), new THREE.MeshStandardMaterial({ map: wt, roughness: 0.95 }));
  far.rotation.x = -Math.PI / 2;
  far.position.y = 0.3;
  // ring UVs are planar in [0,1] → map them over the whole 1600 mm
  scene.add(far);

  // ---- loose fuzz fibres on top ----
  const R = rng(17);
  const fGeo = new THREE.CylinderGeometry(0.007, 0.011, 1, 4, 6);
  {
    const p = fGeo.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + 0.12 * (0.25 - y * y)); }
    fGeo.computeVertexNormals();
  }
  const NF = 1100;
  const fuzz = new THREE.InstancedMesh(fGeo, new THREE.MeshStandardMaterial({ color: '#efe4d0', roughness: 0.8 }), NF);
  for (let i = 0; i < NF; i++) {
    const rr = 30 * Math.sqrt(R()), a = R() * 6.283;
    const len = 0.6 + R() * 2.2;
    q.setFromEuler(new THREE.Euler(Math.PI / 2 - 0.04 - R() * 0.16, R() * 6.283, 0, 'YXZ'));
    m4.compose(new THREE.Vector3(Math.cos(a) * rr, GROUND_Y + 0.06 + R() * 0.1, Math.sin(a) * rr), q, new THREE.Vector3(1, len, 1));
    fuzz.setMatrixAt(i, m4);
  }
  fuzz.castShadow = true;
  scene.add(fuzz);

  // ---- steel millimetre ruler (S2) ----
  const RL = 50, RW = 9;
  const rulerTex = canvasTexture(4096, 740, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#d8dde2'); gr.addColorStop(0.5, '#aeb5bc'); gr.addColorStop(1, '#d0d6dc');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    const pxmm = w / RL;
    g.fillStyle = '#15181c';
    for (let mm = 0; mm <= RL; mm++) {
      const x = 40 + mm * pxmm * 0.98;
      const len = mm % 10 === 0 ? 0.42 : mm % 5 === 0 ? 0.3 : 0.2;
      g.fillRect(x - 3, h * (1 - len), 6, h * len); // ticks along the near (+z) edge
      if (mm % 10 === 0) { g.font = 'bold 120px Inter, sans-serif'; g.fillText(String(mm / 10), x + 10, h * 0.5); }
    }
    g.font = 'bold 70px Inter, sans-serif';
    g.fillText('cm', 40 + 0.5 * pxmm, h * 0.22);
  });
  const ruler = new THREE.Mesh(new THREE.BoxGeometry(RL, 0.5, RW), [
    new THREE.MeshStandardMaterial({ color: '#9aa1a8', metalness: 0.9, roughness: 0.35 }), new THREE.MeshStandardMaterial({ color: '#9aa1a8', metalness: 0.9, roughness: 0.35 }),
    new THREE.MeshStandardMaterial({ map: rulerTex, metalness: 0.75, roughness: 0.38 }), new THREE.MeshStandardMaterial({ color: '#9aa1a8' }),
    new THREE.MeshStandardMaterial({ color: '#9aa1a8', metalness: 0.9, roughness: 0.35 }), new THREE.MeshStandardMaterial({ color: '#9aa1a8', metalness: 0.9, roughness: 0.35 }),
  ]);
  ruler.castShadow = ruler.receiveShadow = true;
  ruler.visible = false;
  scene.add(ruler);
  // ruler: its mm marks start at local x = -RL/2 + 40px; helper returns world x of a mark
  const MM0 = -RL / 2 + (40 / 4096) * RL, MMS = 0.98;
  const rulerMark = (mm) => ruler.position.x + MM0 + mm * MMS;

  return { scene, key, rim, hemi, setKey, ruler, rulerMark, fuzz };
}
