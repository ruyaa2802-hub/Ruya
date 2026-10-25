import * as THREE from 'three';
import { rng, canvasTexture, softDotTexture, v3 } from './util.js';

// ---------------------------------------------------------------------------
// Inside the hive: one vertical honeycomb (the dance floor) in the plane z = 0,
// facing +Z. "Up" on the comb (+Y) is the direction opposite to gravity — the
// reference the forager uses to encode the sun's direction.
// ---------------------------------------------------------------------------

export function createHive(dance) {
  const scene = new THREE.Scene();
  const R = rng(21);
  const bg = new THREE.Color().setRGB(0.05, 0.022, 0.006);
  scene.background = bg;
  scene.fog = new THREE.Fog(new THREE.Color().setRGB(0.09, 0.042, 0.012), 8, 30);

  // ---------------- Lights ----------------
  scene.add(new THREE.HemisphereLight(new THREE.Color('#ffc778'), new THREE.Color('#2a1004'), 0.32));
  const key = new THREE.SpotLight(new THREE.Color('#ffd7a0'), 560, 0, 0.62, 0.85, 2);
  key.position.set(9, 7.5, 10);
  key.target.position.set(0, 0, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0003;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 4;
  key.shadow.camera.near = 4;
  key.shadow.camera.far = 40;
  scene.add(key, key.target);
  const fill = new THREE.PointLight(new THREE.Color('#ff9438'), 28, 0, 2);
  fill.position.set(-6, -3, 6);
  scene.add(fill);
  const gate = new THREE.PointLight(new THREE.Color('#ffe2b0'), 170, 0, 2);
  gate.position.set(11.5, 1.8, 3.5);
  scene.add(gate);

  // ---------------- Comb cells (instanced) ----------------
  const Rc = 0.21; // circumradius
  const dx = 1.5 * Rc, dy = Math.sqrt(3) * Rc;
  const cells = [];
  for (let i = -36; i <= 36; i++) {
    for (let j = -20; j <= 20; j++) {
      const x = i * dx;
      const y = j * dy + (Math.abs(i) % 2 ? dy / 2 : 0);
      if (Math.abs(x) > 11 || Math.abs(y) > 7) continue;
      cells.push(new THREE.Vector2(x, y));
    }
  }
  const D = 0.34;
  const rimGeo = new THREE.RingGeometry(0.172, 0.214, 6, 1);
  const wallGeo = new THREE.CylinderGeometry(0.172, 0.172, D, 6, 1, true);
  wallGeo.rotateX(Math.PI / 2);
  wallGeo.rotateZ(Math.PI / 6);
  wallGeo.translate(0, 0, -D / 2);
  const botGeo = new THREE.CircleGeometry(0.172, 6);
  botGeo.translate(0, 0, -D);
  const honeyGeo = new THREE.CircleGeometry(0.172, 6);
  honeyGeo.translate(0, 0, -0.07);
  const capGeo = new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  capGeo.rotateX(Math.PI / 2);

  const wax = new THREE.MeshStandardMaterial({ color: '#dc9a35', roughness: 0.42 });
  const waxIn = new THREE.MeshStandardMaterial({ color: '#b8761f', roughness: 0.5, side: THREE.BackSide });
  const waxBot = new THREE.MeshStandardMaterial({ color: '#8a5214', roughness: 0.6 });
  const honey = new THREE.MeshPhysicalMaterial({ color: '#e08a10', roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.03, emissive: new THREE.Color('#6a2c00'), emissiveIntensity: 0.6 });
  const capMat = new THREE.MeshStandardMaterial({ color: '#f3d88e', roughness: 0.65 });
  const broodMat = new THREE.MeshStandardMaterial({ color: '#c08440', roughness: 0.75 });

  const mk = (geo, mat, list, sc = 1, shadow = false) => {
    const im = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
    const m = new THREE.Matrix4();
    list.forEach((p, i) => {
      m.makeTranslation(p.x, p.y, 0);
      if (sc !== 1) m.multiply(new THREE.Matrix4().makeScale(sc[0], sc[1], sc[2]));
      im.setMatrixAt(i, m);
    });
    im.count = list.length;
    im.receiveShadow = true;
    im.castShadow = shadow;
    scene.add(im);
    return im;
  };
  mk(rimGeo, wax, cells, 1, true);
  mk(wallGeo, waxIn, cells);
  mk(botGeo, waxBot, cells);
  const honeyCells = [], capCells = [], broodCells = [];
  for (const c of cells) {
    const n = Math.sin(c.x * 0.7) * 0.4 + Math.cos(c.y * 1.3 + c.x * 0.3) * 0.3;
    const nearDance = Math.hypot(c.x - dance.M.x, c.y - dance.M.y) < 2.6;
    if (c.y > 3.4 + n) capCells.push(c);
    else if (c.y > 2.0 + n && !nearDance) { if (R() < 0.85) honeyCells.push(c); }
    else if (c.y < -3.2 + n && !nearDance) { if (R() < 0.8) broodCells.push(c); }
    else if (!nearDance && R() < 0.18) honeyCells.push(c);
  }
  mk(honeyGeo, honey, honeyCells);
  mk(capGeo, capMat, capCells, [0.205, 0.205, 0.05]);
  mk(capGeo, broodMat, broodCells, [0.2, 0.2, 0.08]);

  // wooden top bar & side bars, and neighbouring comb in the background
  const wood = new THREE.MeshStandardMaterial({ color: '#7a4e26', roughness: 0.85 });
  const bar = new THREE.Mesh(new THREE.BoxGeometry(24, 0.9, 1.4), wood);
  bar.position.set(0, 7.45, -0.3);
  bar.castShadow = bar.receiveShadow = true;
  scene.add(bar);
  const hexTex = canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = '#5a3008';
    g.fillRect(0, 0, w, h);
    const r = 14;
    g.strokeStyle = '#c4862c';
    g.lineWidth = 3;
    for (let i = 0; i < 30; i++) for (let j = 0; j < 30; j++) {
      const x = i * r * 1.5, y = j * r * Math.sqrt(3) + (i % 2 ? (r * Math.sqrt(3)) / 2 : 0);
      g.beginPath();
      for (let k = 0; k <= 6; k++) g.lineTo(x + r * Math.cos((k * Math.PI) / 3), y + r * Math.sin((k * Math.PI) / 3));
      g.stroke();
    }
  }, { repeat: [3, 2] });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(26, 16), new THREE.MeshStandardMaterial({ map: hexTex, roughness: 0.6, emissive: new THREE.Color('#3a1a04'), emissiveIntensity: 0.4 }));
  back.position.set(-13, 0, -2);
  back.rotation.y = 1.0;
  scene.add(back);
  const back2 = back.clone();
  back2.position.set(13.5, -1, -5);
  back2.rotation.y = -1.1;
  scene.add(back2);

  // Entrance glow (right side)
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(9, 7), new THREE.MeshBasicMaterial({ color: new THREE.Color(5.0, 3.6, 2.2), fog: false }));
  glow.position.set(14.5, 1.5, 4.0);
  glow.rotation.y = -Math.PI / 2;
  scene.add(glow);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDotTexture(), color: new THREE.Color(3, 2, 1.1), blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  halo.position.set(13.5, 1.6, 4);
  halo.scale.set(14, 14, 1);
  scene.add(halo);

  // Dust motes drifting in the light
  const ND = 220;
  const dGeo = new THREE.BufferGeometry();
  const base = new Float32Array(ND * 3);
  for (let i = 0; i < ND * 3; i++) base[i] = R();
  dGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(ND * 3), 3));
  const dust = new THREE.Points(dGeo, new THREE.PointsMaterial({ size: 0.05, map: softDotTexture(), color: new THREE.Color(1.6, 1.1, 0.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  dust.frustumCulled = false;
  scene.add(dust);

  // ---------------- Dance trail (diagram on the comb) ----------------
  const trailGroup = new THREE.Group();
  trailGroup.position.z = 0.05;
  scene.add(trailGroup);
  const runLen = dance.L;
  const runGeo = new THREE.PlaneGeometry(1, 0.07);
  runGeo.translate(0.5, 0, 0);
  const runMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 1.5, 0.25), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const run = new THREE.Mesh(runGeo, runMat);
  run.position.set(dance.A.x, dance.A.y, 0.01);
  run.rotation.z = Math.atan2(dance.d.y, dance.d.x);
  trailGroup.add(run);
  const runGlowMat = new THREE.MeshBasicMaterial({ map: softDotTexture(), color: new THREE.Color(1.6, 0.7, 0.1), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const runGlow = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.5), runGlowMat);
  runGlow.geometry.translate(0.5, 0, 0);
  runGlow.position.copy(run.position);
  runGlow.rotation.z = run.rotation.z;
  trailGroup.add(runGlow);
  // return loops as dotted semicircles
  const dots = [];
  for (const side of [1, -1]) {
    for (let i = 1; i < 14; i++) {
      const ph = (i / 14) * Math.PI;
      const p = dance.M.clone()
        .addScaledVector(dance.d, (dance.L / 2) * Math.cos(ph))
        .addScaledVector(dance.n, side * dance.loopW * Math.sin(ph));
      dots.push(p.x, p.y, 0.02);
    }
  }
  const dotGeo = new THREE.BufferGeometry();
  dotGeo.setAttribute('position', new THREE.Float32BufferAttribute(dots, 3));
  const dotMat = new THREE.PointsMaterial({ size: 0.09, map: softDotTexture(), color: new THREE.Color(1.6, 1.3, 0.7), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  trailGroup.add(new THREE.Points(dotGeo, dotMat));

  return {
    scene,
    key,
    glow,
    setTrail({ runReveal = 0, runOpacity = 0, loopOpacity = 0 }) {
      const s = Math.max(0.0001, runReveal * runLen);
      run.scale.set(s, 1, 1);
      runGlow.scale.set(s, 1, 1);
      runMat.opacity = runOpacity;
      runGlowMat.opacity = runOpacity * 0.6;
      dotMat.opacity = loopOpacity;
    },
    update(t) {
      const a = dGeo.attributes.position.array;
      for (let i = 0; i < ND; i++) {
        a[i * 3] = -6 + base[i * 3] * 18 + Math.sin(t * 0.3 + i) * 0.3;
        a[i * 3 + 1] = -5 + ((base[i * 3 + 1] * 12 + t * 0.12) % 12) + Math.cos(t * 0.4 + i * 2) * 0.2;
        a[i * 3 + 2] = 0.6 + base[i * 3 + 2] * 7;
      }
      dGeo.attributes.position.needsUpdate = true;
    },
  };
}
