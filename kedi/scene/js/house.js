import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { canvasTexture, rng, v3 } from './util.js';

// ---------------------------------------------------------------------------
// A modern flat in the evening. Three areas share one floor:
//   living room around (0,0,0)   – sofa against the window wall (z = -1.9)
//   kitchen around (4.8,0,-0.6)  – cabinets along z = -1.25, cat bowl on the floor
//   hallway around (-4,0,-0.9)   – front door in the wall z = -1.05, hinge x = -4.45
// ---------------------------------------------------------------------------
export function createHouse() {
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

  // ===== kitchen =====
  wall(4, 2.8, 4.8, -1.86, 0, greenWall);
  box(2.8, 0.86, 0.6, cabinetMat, 4.8, 0.45, -1.55, 0.015);
  box(2.84, 0.04, 0.64, counterMat, 4.8, 0.9, -1.54, 0.01);
  box(2.8, 0.08, 0.55, new THREE.MeshStandardMaterial({ color: '#2a2a28', roughness: 0.8 }), 4.8, 0.04, -1.52, 0.01); // kick plate
  for (let i = 0; i < 4; i++) {
    const x = 3.75 + i * 0.7;
    box(0.66, 0.74, 0.02, cabinetMat, x, 0.5, -1.24, 0.01);
    box(0.012, 0.012, 0.18, metal, x + 0.25, 0.75, -1.22, 0.005).rotation.x = Math.PI / 2;
  }
  box(2.8, 0.7, 0.35, cabinetMat, 4.8, 2.0, -1.7, 0.015); // upper cabinets
  // tiles backsplash
  const tiles = canvasTexture(256, 128, (g, w, h) => {
    g.fillStyle = '#f2efe9';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#cfc8bd';
    g.lineWidth = 2;
    for (let y = 0; y < h; y += 16) for (let x = (y / 16) % 2 ? 0 : 16; x < w; x += 32) g.strokeRect(x, y, 32, 16);
  }, { repeat: [3, 2] });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 0.75), new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.3 }));
  back.position.set(4.8, 1.3, -1.85);
  scene.add(back);
  // jars, kettle
  box(0.14, 0.2, 0.14, new THREE.MeshPhysicalMaterial({ color: '#e9d7b9', roughness: 0.1, transmission: 0.0 }), 4.0, 1.02, -1.7, 0.03);
  const kettle = sh(new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 16), new THREE.MeshStandardMaterial({ color: '#d45f3f', roughness: 0.3 })));
  kettle.scale.y = 0.9;
  kettle.position.set(5.7, 1.03, -1.65);
  scene.add(kettle);
  plant(5.2, 0.92, -1.75, 14, 0.6);
  const pendant = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 16, 0, 6.29, 0, 1.8), new THREE.MeshStandardMaterial({ color: '#f6e7c8', emissive: new THREE.Color('#ffc27a'), emissiveIntensity: 2.2, side: THREE.DoubleSide }));
  pendant.position.set(4.8, 2.1, -0.6);
  scene.add(pendant);
  const kLight = new THREE.PointLight(new THREE.Color('#ffc27a'), 5, 6, 2);
  kLight.position.set(4.8, 1.95, -0.6);
  scene.add(kLight);
  // cat bowl + mat
  const matMesh = sh(new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.01, 0.32, 2, 0.004), new THREE.MeshStandardMaterial({ color: '#b5c6c9', roughness: 0.9 })), false);
  matMesh.position.set(4.5, 0.005, -0.75);
  scene.add(matMesh);
  const bowlPts = [];
  for (let i = 0; i <= 16; i++) { const f = i / 16; bowlPts.push(new THREE.Vector2(0.07 + 0.035 * Math.sin(f * Math.PI * 0.5) + (f > 0.9 ? 0.004 : 0), f * 0.055)); }
  const inPts = [];
  for (let i = 16; i >= 0; i--) { const f = i / 16; inPts.push(new THREE.Vector2(0.06 + 0.035 * Math.sin(f * Math.PI * 0.5), 0.012 + f * 0.04)); }
  const bowl = sh(new THREE.Mesh(new THREE.LatheGeometry([...bowlPts, ...inPts], 48), new THREE.MeshPhysicalMaterial({ color: '#3f6f8c', roughness: 0.2, clearcoat: 0.8, side: THREE.DoubleSide })));
  bowl.position.set(4.42, 0.01, -0.75);
  scene.add(bowl);
  // kibble (revealed by fill level)
  const kib = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.0075, 0), new THREE.MeshStandardMaterial({ color: '#8b5a2b', roughness: 0.8 }), 160);
  kib.castShadow = true;
  const KIB = [];
  for (let i = 0; i < 160; i++) {
    const a = R() * 6.28, r = Math.sqrt(R()) * 0.075, lvl = i / 160;
    KIB.push({ p: v3(4.42 + Math.cos(a) * r, 0.02 + lvl * 0.032 - r * 0.08, -0.75 + Math.sin(a) * r), rot: new THREE.Euler(R() * 6, R() * 6, R() * 6), lvl });
  }
  scene.add(kib);
  // falling kibble stream
  const fall = new THREE.InstancedMesh(kib.geometry, kib.material, 40);
  scene.add(fall);
  // measuring cup (held by the human)
  const cup = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.042, 0.09, 24, 1, true), new THREE.MeshStandardMaterial({ color: '#d9d4c8', roughness: 0.4, side: THREE.DoubleSide })));
  const cupG = new THREE.Group();
  cupG.add(cup);
  const cupKib = new THREE.Mesh(new THREE.CircleGeometry(0.045, 20), new THREE.MeshStandardMaterial({ color: '#7b4f27', roughness: 0.9 }));
  cupKib.rotation.x = -Math.PI / 2;
  cupKib.position.y = 0.02;
  cupG.add(cupKib);
  scene.add(cupG);

  // ===== hallway / front door =====
  wall(3.4, 2.8, -5.75, -1.05, 0, wallMat);
  wall(0.9, 0.75, -4.0, -1.05, 0, wallMat).position.y = 2.425;
  wall(3.0, 2.8, -2.15, -1.05, 0, wallMat);
  const doorG = new THREE.Group();
  doorG.position.set(-4.45, 0, -1.05);
  scene.add(doorG);
  const door = box(0.9, 2.05, 0.05, doorMat, 0, 1.025, 0, 0.01);
  scene.remove(door);
  door.position.set(0.45, 1.025, 0);
  doorG.add(door);
  const handle = box(0.12, 0.022, 0.022, metal, 0.8, 1.0, 0.045, 0.008);
  scene.remove(handle);
  handle.position.set(0.79, 1.0, 0.05);
  doorG.add(handle);
  const frameD = new THREE.MeshStandardMaterial({ color: '#efeae2', roughness: 0.5 });
  box(0.06, 2.1, 0.12, frameD, -4.48, 1.05, -1.04);
  box(0.06, 2.1, 0.12, frameD, -3.52, 1.05, -1.04);
  box(1.02, 0.06, 0.12, frameD, -4.0, 2.08, -1.04);
  // outside (seen when the door opens): evening porch light and blue dusk
  const outside = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 0.45, 0.75) }));
  outside.position.set(-4.0, 1.4, -2.4);
  scene.add(outside);
  const porch = new THREE.SpotLight(new THREE.Color('#a9c4ff'), 0, 6, 0.6, 0.6, 1.5);
  porch.position.set(-4.0, 1.9, -2.2);
  porch.target.position.set(-4.0, 0, 0.4);
  scene.add(porch, porch.target);
  const shoeMat = new THREE.MeshStandardMaterial({ color: '#4a3b30', roughness: 0.7 });
  box(0.12, 0.08, 0.28, shoeMat, -5.1, 0.04, -0.85, 0.03);
  box(0.12, 0.08, 0.28, shoeMat, -4.95, 0.04, -0.82, 0.03);
  const doormat = sh(new THREE.Mesh(new RoundedBoxGeometry(0.8, 0.015, 0.5, 2, 0.005), new THREE.MeshStandardMaterial({ color: '#8a6e4b', roughness: 1 })), false);
  doormat.position.set(-4.0, 0.008, -0.65);
  scene.add(doormat);
  // hallway walls behind / beside (seen when the camera looks back into the flat)
  wall(4.2, 2.8, -4.0, 1.7, Math.PI, wallMat);
  wall(3.0, 2.8, -6.0, 0.25, Math.PI / 2, wallMat);
  box(1.0, 0.8, 0.35, new THREE.MeshStandardMaterial({ color: '#6b4a32', roughness: 0.5 }), -3.6, 0.4, 1.5, 0.02); // console
  const vase = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.25, 20), new THREE.MeshStandardMaterial({ color: '#2f6f73', roughness: 0.3 })));
  vase.position.set(-3.35, 0.93, 1.5);
  scene.add(vase);
  plant(-3.35, 1.0, 1.5, 10, 0.5);
  box(0.9, 0.6, 0.03, frameMat, -3.8, 1.55, 1.68, 0.005).rotation.y = Math.PI;
  const art2 = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.5), new THREE.MeshStandardMaterial({ color: '#c58a5c', roughness: 0.8 }));
  art2.position.set(-3.8, 1.55, 1.66);
  art2.rotation.y = Math.PI;
  scene.add(art2);
  const sconce = new THREE.Mesh(new THREE.SphereGeometry(0.08, 20, 12), new THREE.MeshStandardMaterial({ color: '#fff0d8', emissive: new THREE.Color('#ffc27a'), emissiveIntensity: 2 }));
  sconce.position.set(-4.7, 1.8, 1.62);
  scene.add(sconce);
  const sconceL = new THREE.PointLight(new THREE.Color('#ffc27a'), 3, 5, 2);
  sconceL.position.set(-4.7, 1.75, 1.45);
  scene.add(sconceL);
  const hallLamp = new THREE.PointLight(new THREE.Color('#ffc890'), 6, 6, 2);
  hallLamp.position.set(-3.6, 2.3, -0.2);
  scene.add(hallLamp);
  const coatHook = box(0.6, 0.04, 0.05, frameMat, -5.4, 1.75, -1.0, 0.01);
  const coat = sh(new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.6, 6, 16), new THREE.MeshStandardMaterial({ color: '#8a4e3a', roughness: 0.9 })));
  coat.position.set(-5.35, 1.3, -0.92);
  coat.scale.z = 0.5;
  scene.add(coat);

  // ---- global light ----
  scene.add(new THREE.HemisphereLight(new THREE.Color('#8ea6d6'), new THREE.Color('#5a3e2a'), 0.35));
  const key = new THREE.SpotLight(new THREE.Color('#ffd2a1'), 30, 12, 0.7, 0.8, 1.6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0002;
  key.shadow.normalBias = 0.01;
  key.shadow.radius = 4;
  scene.add(key, key.target);
  const fill = new THREE.PointLight(new THREE.Color('#b9c8ff'), 0.8, 5, 2);
  scene.add(fill);

  const tmpM = new THREE.Matrix4(), q = new THREE.Quaternion(), one = v3(1, 1, 1);
  return {
    scene, key, fill, doorG, porch, cupG, cupKib,
    setDoor(open) {
      doorG.rotation.y = open * 1.45; // opens outward
      porch.intensity = 18 * Math.min(1, open * 2);
    },
    setKibble(level, pour, t, cupPos) {
      for (let i = 0; i < KIB.length; i++) {
        const k = KIB[i];
        const vis = k.lvl < level;
        tmpM.compose(k.p, q.setFromEuler(k.rot), vis ? one : v3(0, 0, 0));
        kib.setMatrixAt(i, tmpM);
      }
      kib.instanceMatrix.needsUpdate = true;
      for (let i = 0; i < 40; i++) {
        let s = 0;
        const p = v3();
        if (pour > 0 && cupPos) {
          const ph = (t * 2.2 + i / 40) % 1;
          p.copy(cupPos).add(v3(Math.sin(i * 7.1) * 0.012, -ph * (cupPos.y - 0.03), Math.cos(i * 3.3) * 0.012 + ph * 0.02));
          s = pour;
        }
        tmpM.compose(p, q.setFromEuler(new THREE.Euler(i, i * 2, t * 5 + i)), v3(s, s, s));
        fall.setMatrixAt(i, tmpM);
      }
      fall.instanceMatrix.needsUpdate = true;
    },
    setKey(pos, target, intensity = 30) {
      key.position.copy(pos);
      key.target.position.copy(target);
      key.intensity = intensity;
    },
  };
}
