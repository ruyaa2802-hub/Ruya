import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { canvasTexture, rng, v3 } from './util.js';

// ---------------------------------------------------------------------------
// The living room for the dog film (derived from the cat film's flat):
//   living room around (0,0,0)   – sofa against the window wall (z = -1.9)
//   kitchen around (4.8,0,-0.6)  – cabinets along z = -1.25, cat bowl on the floor
//   hallway around (-4,0,-0.9)   – front door in the wall z = -1.05, hinge x = -4.45
// ---------------------------------------------------------------------------
export function createRoom() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#1b1714');
  const R = rng(12);
  const sh = (m, cast = true) => { m.castShadow = cast; m.receiveShadow = true; return m; };
  const box = (w, h, d, mat, x, y, z, r = 0.02) => { const m = sh(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), mat)); m.position.set(x, y, z); scene.add(m); return m; };

  // ---- materials ----
  const woodTex = canvasTexture(1024, 1024, (g, w, h) => {
    const planks = 8;
    for (let i = 0; i < planks; i++) {
      const base = 150 + R() * 30;
      g.fillStyle = `rgb(${base},${base * 0.72},${base * 0.5})`;
      g.fillRect(0, (i * h) / planks, w, h / planks);
      for (let k = 0; k < 140; k++) {
        g.strokeStyle = `rgba(80,45,20,${0.06 + R() * 0.1})`;
        g.lineWidth = 1 + R() * 2;
        const y = (i * h) / planks + R() * (h / planks);
        g.beginPath();
        g.moveTo(0, y);
        for (let x = 0; x <= w; x += 64) g.lineTo(x, y + Math.sin(x * 0.01 + k) * 3);
        g.stroke();
      }
      g.fillStyle = 'rgba(40,22,10,0.55)';
      g.fillRect(0, (i * h) / planks, w, 3);
      const cut = R() * w;
      g.fillRect(cut, (i * h) / planks, 3, h / planks);
    }
  }, { repeat: [3, 3] });
  const floorMat = new THREE.MeshPhysicalMaterial({ map: woodTex, roughness: 0.45, clearcoat: 0.35, clearcoatRoughness: 0.35 });
  const plaster = canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#d8d0c4';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '255,255,255' : '120,110,100'},0.05)`; g.fillRect(R() * w, R() * h, 2, 2); }
  }, { repeat: [6, 3] });
  const wallMat = new THREE.MeshStandardMaterial({ map: plaster, roughness: 0.95 });
  const greenWall = new THREE.MeshStandardMaterial({ map: plaster, color: '#9fae9a', roughness: 0.95 });
  const fabric = canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#5f7177';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) { g.fillStyle = `rgba(255,255,255,${0.03 + R() * 0.04})`; g.fillRect(0, y, w, 1); }
    for (let x = 0; x < w; x += 2) { g.fillStyle = `rgba(0,0,0,${0.03 + R() * 0.04})`; g.fillRect(x, 0, 1, h); }
  }, { repeat: [4, 4] });
  const sofaMat = new THREE.MeshPhysicalMaterial({ map: fabric, roughness: 0.9, sheen: 0.8, sheenColor: new THREE.Color('#a9c0c6'), sheenRoughness: 0.6 });
  const rugTex = canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = '#e8dfcf';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 20000; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '255,250,240' : '150,130,100'},0.12)`; g.fillRect(R() * w, R() * h, 2, 2); }
    g.strokeStyle = 'rgba(160,120,80,0.35)';
    g.lineWidth = 10;
    for (let k = 1; k < 4; k++) { g.beginPath(); g.arc(w / 2, h / 2, k * 60, 0, 7); g.stroke(); }
  });
  const rugMat = new THREE.MeshStandardMaterial({ map: rugTex, roughness: 1 });
  const cabinetMat = new THREE.MeshStandardMaterial({ color: '#7f9585', roughness: 0.55 });
  const counterMat = new THREE.MeshPhysicalMaterial({ color: '#efebe4', roughness: 0.25, clearcoat: 0.6 });
  const metal = new THREE.MeshStandardMaterial({ color: '#c9c3b8', roughness: 0.25, metalness: 1 });
  const doorWood = canvasTexture(256, 512, (g, w, h) => {
    g.fillStyle = '#7a5434';
    g.fillRect(0, 0, w, h);
    for (let k = 0; k < 200; k++) { g.strokeStyle = `rgba(40,20,8,${0.08 + R() * 0.1})`; g.beginPath(); const x = R() * w; g.moveTo(x, 0); g.bezierCurveTo(x + 10, h / 3, x - 10, (2 * h) / 3, x + R() * 8, h); g.stroke(); }
    g.strokeStyle = 'rgba(30,15,5,0.6)';
    g.lineWidth = 4;
    g.strokeRect(w * 0.15, h * 0.08, w * 0.7, h * 0.36);
    g.strokeRect(w * 0.15, h * 0.52, w * 0.7, h * 0.4);
  });
  const doorMat = new THREE.MeshStandardMaterial({ map: doorWood, roughness: 0.6 });

  // ---- floor + walls ----
  const floor = sh(new THREE.Mesh(new THREE.PlaneGeometry(20, 10), floorMat), false);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 1);
  scene.add(floor);
  const wall = (w, h, x, z, ry, mat) => { const m = sh(new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat), false); m.position.set(x, h / 2, z); m.rotation.y = ry; scene.add(m); return m; };
  // baseboards
  const baseMat = new THREE.MeshStandardMaterial({ color: '#efeae2', roughness: 0.6 });

  // ===== living room =====
  wall(2.2, 2.8, -2.0, -2.3, 0, wallMat);
  wall(2.2, 2.8, 2.0, -2.3, 0, wallMat);
  wall(1.8, 0.85, 0, -2.3, 0, wallMat).position.y = 0.425;
  wall(1.8, 0.5, 0, -2.3, 0, wallMat).position.y = 2.55;
  // window with dusk sky + distant city lights
  const sky = canvasTexture(512, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#1d2f5c');
    gr.addColorStop(0.55, '#5a5f8e');
    gr.addColorStop(0.85, '#d98f6a');
    gr.addColorStop(1, '#f2b27a');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      const x = R() * w, bw = 20 + R() * 60, bh = 60 + R() * 200;
      g.fillStyle = '#1a1c2c';
      g.fillRect(x, h - bh, bw, bh);
      for (let k = 0; k < 14; k++) { g.fillStyle = R() < 0.5 ? '#ffd58a' : '#2a2c3c'; g.fillRect(x + 4 + R() * (bw - 8), h - bh + 6 + R() * (bh - 10), 3, 4); }
    }
  });
  const win = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.45), new THREE.MeshBasicMaterial({ map: sky, color: new THREE.Color(1.6, 1.6, 1.6) }));
  win.position.set(0, 1.575, -2.35);
  scene.add(win);
  const frameMat = new THREE.MeshStandardMaterial({ color: '#2b2b2b', roughness: 0.5 });
  box(1.84, 0.05, 0.08, frameMat, 0, 0.87, -2.28);
  box(1.84, 0.05, 0.08, frameMat, 0, 2.29, -2.28);
  box(0.05, 1.45, 0.08, frameMat, 0, 1.575, -2.28);
  // sofa
  box(2.2, 0.38, 0.92, sofaMat, 0, 0.21, -1.78, 0.06);
  box(1.04, 0.16, 0.8, sofaMat, -0.53, 0.46, -1.72, 0.07);
  box(1.04, 0.16, 0.8, sofaMat, 0.53, 0.46, -1.72, 0.07);
  box(2.2, 0.5, 0.22, sofaMat, 0, 0.67, -2.13, 0.08);
  box(0.2, 0.62, 0.92, sofaMat, -1.12, 0.36, -1.78, 0.08);
  box(0.2, 0.62, 0.92, sofaMat, 1.12, 0.36, -1.78, 0.08);
  const cushion = new THREE.MeshPhysicalMaterial({ color: '#d39a52', roughness: 0.9, sheen: 1, sheenColor: new THREE.Color('#ffd9a0') });
  box(0.42, 0.4, 0.14, cushion, -0.78, 0.7, -1.95, 0.08).rotation.z = 0.15;
  const throwB = new THREE.MeshPhysicalMaterial({ color: '#efe6d6', roughness: 1, sheen: 1, sheenColor: new THREE.Color('#ffffff') });
  box(0.6, 0.03, 0.75, throwB, 0.75, 0.55, -1.7, 0.015);
  // rug
  const rug = sh(new THREE.Mesh(new THREE.CircleGeometry(1.4, 64), rugMat), false);
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, 0.006, -0.5);
  scene.add(rug);
  // floor lamp (warm practical)
  const lampPole = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.5, 10), frameMat));
  lampPole.position.set(1.55, 0.75, -1.95);
  scene.add(lampPole);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.24, 0.3, 32, 1, true), new THREE.MeshStandardMaterial({ color: '#f3e3c3', emissive: new THREE.Color('#ffb76b'), emissiveIntensity: 1.6, side: THREE.DoubleSide }));
  shade.position.set(1.55, 1.55, -1.95);
  scene.add(shade);
  const lamp = new THREE.PointLight(new THREE.Color('#ffb76b'), 6, 7, 2);
  lamp.position.set(1.55, 1.45, -1.9);
  scene.add(lamp);
  // plant
  const pot = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.36, 24), new THREE.MeshStandardMaterial({ color: '#c26b4a', roughness: 0.8 })));
  pot.position.set(-1.55, 0.18, -1.95);
  scene.add(pot);
  const leafTex = canvasTexture(128, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const gr = g.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, '#2f5a2a');
    gr.addColorStop(0.5, '#4f8a3c');
    gr.addColorStop(1, '#2f5a2a');
    g.fillStyle = gr;
    g.beginPath();
    g.ellipse(w / 2, h / 2, w * 0.45, h * 0.48, 0, 0, 7);
    g.fill();
    g.strokeStyle = 'rgba(200,230,170,0.5)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(w / 2, 4);
    g.lineTo(w / 2, h - 4);
    g.stroke();
  });
  const leafMat = new THREE.MeshStandardMaterial({ map: leafTex, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.6 });
  const plant = (x, y, z, n, s) => {
    for (let i = 0; i < n; i++) {
      const l = sh(new THREE.Mesh(new THREE.PlaneGeometry(0.16 * s, 0.34 * s), leafMat));
      const a = R() * 6.28, e = 0.3 + R() * 0.9;
      l.position.set(x + Math.cos(a) * 0.12 * s * e, y + 0.15 * s + R() * 0.45 * s, z + Math.sin(a) * 0.12 * s * e);
      l.rotation.set(-0.5 + R() * 0.4, a, (R() - 0.5) * 0.8);
      scene.add(l);
    }
  };
  plant(-1.55, 0.3, -1.95, 34, 1.3);
  // picture frames on the wall
  for (const [x, y, w, h, c] of [[-2.2, 1.6, 0.5, 0.65, '#c9a273'], [-1.55, 1.75, 0.35, 0.45, '#7d9aa6'], [2.2, 1.55, 0.6, 0.45, '#b77c64']]) {
    box(w, h, 0.03, frameMat, x, y, -2.28, 0.005);
    const art = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.8, h * 0.8), new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }));
    art.position.set(x, y, -2.26);
    scene.add(art);
  }
  box(0.45, 0.5, 0.45, new THREE.MeshStandardMaterial({ color: '#6b4a32', roughness: 0.5 }), -1.5, 0.25, -1.1, 0.03); // side table
  const mug = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.09, 20), new THREE.MeshStandardMaterial({ color: '#e7e1d6', roughness: 0.3 })));
  mug.position.set(-1.45, 0.545, -1.05);
  scene.add(mug);

  // side walls + the wall behind the camera
  wall(5, 2.8, -3.1, 0.2, Math.PI / 2, wallMat);
  wall(5, 2.8, 3.1, 0.2, -Math.PI / 2, wallMat);
  wall(6.2, 2.8, 0, 3.6, Math.PI, wallMat);
  box(0.9, 0.04, 0.3, new THREE.MeshStandardMaterial({ color: '#6b4a32', roughness: 0.5 }), 2.4, 1.2, 3.42, 0.01); // shelf
  for (let i = 0; i < 5; i++) box(0.05, 0.22 + (i % 2) * 0.05, 0.16, new THREE.MeshStandardMaterial({ color: ['#a4553f', '#3f6f8c', '#d9b25a', '#5f7f5a', '#e9e1d4'][i], roughness: 0.6 }), 2.1 + i * 0.07, 1.33, 3.42, 0.005);
  plant(2.6, 0.0, 3.0, 26, 1.1);
  const pot2 = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.3, 20), new THREE.MeshStandardMaterial({ color: '#d8d2c6', roughness: 0.6 })));
  pot2.position.set(2.6, 0.15, 3.0);
  scene.add(pot2);
  const shoeMat = new THREE.MeshStandardMaterial({ color: '#4a3b30', roughness: 0.7 });
  box(0.11, 0.08, 0.27, shoeMat, -2.3, 0.04, 2.2, 0.03).rotation.y = 0.3;
  box(0.11, 0.08, 0.27, shoeMat, -2.12, 0.04, 2.3, 0.03).rotation.y = 0.1;

  // ===== free-standing floor mirror in the middle of the room (real reflection) =====
  const MIR = { x: 0.55, z: 0.25, w: 0.8, h: 1.6, y0: 0.14 };
  const mirror = new Reflector(new THREE.PlaneGeometry(MIR.w, MIR.h), { textureWidth: 640, textureHeight: 1280, color: new THREE.Color('#d8dcdc'), clipBias: 0.003, multisample: 4 });
  mirror.position.set(MIR.x, MIR.y0 + MIR.h / 2, MIR.z);
  scene.add(mirror);
  const walnut = new THREE.MeshStandardMaterial({ color: '#4a3324', roughness: 0.45 });
  const fw = 0.05;
  box(MIR.w + 2 * fw, fw, 0.05, walnut, MIR.x, MIR.y0 - fw / 2, MIR.z - 0.02, 0.01);
  box(MIR.w + 2 * fw, fw, 0.05, walnut, MIR.x, MIR.y0 + MIR.h + fw / 2, MIR.z - 0.02, 0.01);
  box(fw, MIR.h + 2 * fw, 0.05, walnut, MIR.x - MIR.w / 2 - fw / 2, MIR.y0 + MIR.h / 2, MIR.z - 0.02, 0.01);
  box(fw, MIR.h + 2 * fw, 0.05, walnut, MIR.x + MIR.w / 2 + fw / 2, MIR.y0 + MIR.h / 2, MIR.z - 0.02, 0.01);
  box(MIR.w + 2 * fw, MIR.h + 2 * fw, 0.015, walnut, MIR.x, MIR.y0 + MIR.h / 2, MIR.z - 0.045, 0.005); // back panel
  for (const sx of [-1, 1]) {
    box(0.06, 0.04, 0.5, walnut, MIR.x + sx * (MIR.w / 2 - 0.05), 0.02, MIR.z - 0.05, 0.01); // feet
    const leg = box(0.04, 0.9, 0.04, walnut, MIR.x + sx * (MIR.w / 2 - 0.05), 0.5, MIR.z - 0.25, 0.01);
    leg.rotation.x = -0.24;
  }

  // ---- global light ----
  scene.add(new THREE.HemisphereLight(new THREE.Color('#8ea6d6'), new THREE.Color('#5a3e2a'), 0.45));
  const key = new THREE.SpotLight(new THREE.Color('#ffd2a1'), 30, 12, 0.75, 0.8, 1.6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0002;
  key.shadow.normalBias = 0.01;
  key.shadow.radius = 4;
  scene.add(key, key.target);
  const fill = new THREE.PointLight(new THREE.Color('#ffe0c0'), 1.2, 6, 2);
  scene.add(fill);
  const ceilWarm = new THREE.PointLight(new THREE.Color('#ffc890'), 4, 8, 2);
  ceilWarm.position.set(-0.5, 2.5, 1.2);
  scene.add(ceilWarm);
  return {
    scene, key, fill, mirror, MIR,
    setKey(pos, target, intensity = 30) {
      key.position.copy(pos);
      key.target.position.copy(target);
      key.intensity = intensity;
    },
  };
}
