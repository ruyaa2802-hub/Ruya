import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { canvasTexture, rng, v3 } from './util.js';

// ---------------------------------------------------------------------------
// Back garden at golden hour. Lawn around (0,0,0), wooden fence at z = -3,
// the house wall with a patio step at z = +1.6 (the person sits there).
// ---------------------------------------------------------------------------
export function createGarden() {
  const scene = new THREE.Scene();
  const R = rng(21);
  const sh = (m, cast = true) => { m.castShadow = cast; m.receiveShadow = true; return m; };
  const skyTex = canvasTexture(16, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#3e5c8a');
    gr.addColorStop(0.5, '#a8a6b8');
    gr.addColorStop(0.8, '#f2c08e');
    gr.addColorStop(1, '#f7d6a6');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  });
  scene.background = skyTex;
  scene.fog = new THREE.Fog(new THREE.Color('#d9b996'), 6, 22);

  const grassTex = canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = '#4f6e2c';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26000; i++) {
      const x = R() * w, y = R() * h, l = 3 + R() * 7;
      g.strokeStyle = `hsla(${78 + R() * 30},${40 + R() * 25}%,${22 + R() * 25}%,0.8)`;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (R() - 0.5) * 3, y - l);
      g.stroke();
    }
  }, { repeat: [10, 10] });
  const ground = sh(new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.95 })), false);
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  // grass blades near the action (instanced, gently swaying via shader time)
  const bladeGeo = new THREE.PlaneGeometry(0.005, 0.055, 1, 3);
  bladeGeo.translate(0, 0.0275, 0);
  { const p = bladeGeo.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) * (1 - y / 0.06)); } }
  const bladeMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8, side: THREE.DoubleSide });
  const uTime = { value: 0 };
  bladeMat.onBeforeCompile = (s) => {
    s.uniforms.uTime = uTime;
    s.vertexShader = 'uniform float uTime;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 ip = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      float sway = sin(uTime * 1.7 + ip.x * 3.0 + ip.z * 2.0) * 0.006 * (position.y / 0.055);
      transformed.x += sway; transformed.z += sway * 0.6;`);
  };
  const NB = 36000;
  const blades = new THREE.InstancedMesh(bladeGeo, bladeMat, NB);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
  for (let i = 0; i < NB; i++) {
    const x = (R() - 0.5) * 4, z = -1.8 + R() * 3.25;
    const s = 0.6 + R() * 0.9;
    m.compose(v3(x, 0, z), q.setFromEuler(new THREE.Euler((R() - 0.5) * 0.5, R() * 6.28, (R() - 0.5) * 0.5)), v3(s, s * (0.7 + R() * 0.8), s));
    blades.setMatrixAt(i, m);
    blades.setColorAt(i, col.setHSL(0.22 + R() * 0.06, 0.45, 0.25 + R() * 0.2));
  }
  blades.receiveShadow = true;
  scene.add(blades);

  // fence
  const fenceTex = canvasTexture(128, 512, (g, w, h) => {
    g.fillStyle = '#8a6243';
    g.fillRect(0, 0, w, h);
    for (let k = 0; k < 60; k++) { g.strokeStyle = `rgba(50,30,15,${0.1 + R() * 0.15})`; g.beginPath(); const x = R() * w; g.moveTo(x, 0); g.lineTo(x + (R() - 0.5) * 8, h); g.stroke(); }
  });
  const fenceMat = new THREE.MeshStandardMaterial({ map: fenceTex, roughness: 0.85 });
  for (let i = -16; i <= 16; i++) {
    const b = sh(new THREE.Mesh(new RoundedBoxGeometry(0.14, 1.5, 0.03, 2, 0.01), fenceMat));
    b.position.set(i * 0.155, 0.75, -3.0);
    b.rotation.z = (R() - 0.5) * 0.02;
    scene.add(b);
  }
  for (const y of [0.35, 1.2]) { const r = sh(new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.08, 0.04), fenceMat)); r.position.set(0, y, -2.97); scene.add(r); }
  // bushes, flowers
  const leafTex = canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#2f4a22';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { g.fillStyle = `hsl(${90 + R() * 30},${35 + R() * 25}%,${18 + R() * 25}%)`; g.beginPath(); g.ellipse(R() * w, R() * h, 4 + R() * 6, 2 + R() * 3, R() * 3, 0, 7); g.fill(); }
  }, { repeat: [2, 2] });
  const bushMat = new THREE.MeshStandardMaterial({ map: leafTex, roughness: 0.9 });
  const bush = (x, z, s) => {
    for (let k = 0; k < 6; k++) {
      const b = sh(new THREE.Mesh(new THREE.IcosahedronGeometry(1, 3), bushMat));
      b.scale.setScalar(s * (0.5 + R() * 0.4));
      b.position.set(x + (R() - 0.5) * s, s * (0.35 + R() * 0.4), z + (R() - 0.5) * s * 0.6);
      scene.add(b);
    }
  };
  bush(-2.0, -2.55, 0.65);
  bush(1.6, -2.6, 0.55);
  bush(-2.6, -0.8, 0.45);
  bush(2.7, -1.2, 0.5);
  // stepping stones
  const stoneMat = new THREE.MeshStandardMaterial({ color: '#a59d92', roughness: 0.9 });
  for (let i = 0; i < 5; i++) {
    const st = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.03, 20), stoneMat), false);
    st.position.set(0.9 - i * 0.12, 0.012, 1.2 - i * 0.55);
    st.scale.set(1, 1, 0.75);
    scene.add(st);
  }
  // house wall + patio step behind the person
  const brick = canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = '#d9cbb8';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 32) for (let x = (y / 32) % 2 ? -32 : 0; x < w; x += 64) { g.fillStyle = `hsl(${25 + R() * 10},${25 + R() * 10}%,${62 + R() * 10}%)`; g.fillRect(x + 2, y + 2, 60, 28); }
  }, { repeat: [3, 2] });
  const houseWall = sh(new THREE.Mesh(new THREE.PlaneGeometry(8, 3), new THREE.MeshStandardMaterial({ map: brick, roughness: 0.9 })), false);
  houseWall.position.set(0, 1.5, 2.2);
  houseWall.rotation.y = Math.PI;
  scene.add(houseWall);
  const step = sh(new THREE.Mesh(new RoundedBoxGeometry(2.4, 0.36, 0.7, 2, 0.02), new THREE.MeshStandardMaterial({ color: '#b9b0a3', roughness: 0.85 })));
  step.position.set(0.9, 0.18, 1.85);
  scene.add(step);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.0), new THREE.MeshStandardMaterial({ color: '#2d3a44', roughness: 0.05, metalness: 0.6, emissive: new THREE.Color('#ffb36a'), emissiveIntensity: 0.25 }));
  glass.position.set(0.9, 1.4, 2.19);
  glass.rotation.y = Math.PI;
  scene.add(glass);
  // plant pots on the step
  const pot = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.26, 20), new THREE.MeshStandardMaterial({ color: '#b8613f', roughness: 0.8 })));
  pot.position.set(-0.1, 0.49, 1.95);
  scene.add(pot);
  bush(-0.1, 1.95, 0.16);

  // golden-hour sun + sky fill
  const sun = new THREE.DirectionalLight(new THREE.Color('#ffc58a'), 3.2);
  sun.position.set(-4, 2.6, -5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 20 });
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.01;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight(new THREE.Color('#9fb6dd'), new THREE.Color('#4a5a2a'), 0.9));
  const bounce = new THREE.PointLight(new THREE.Color('#ffd9b0'), 1.2, 5, 2);
  scene.add(bounce);
  return {
    scene, sun, bounce,
    update(t, focus) {
      uTime.value = t;
      sun.target.position.copy(focus);
      sun.position.copy(focus).add(v3(-4, 2.4, -5));
      bounce.position.copy(focus).add(v3(0.8, 0.5, 1.2));
    },
  };
}
