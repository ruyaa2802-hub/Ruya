// SAHNE 2 — İKİ FARKLI HAYAT (5–13 sn): Yol ayrımı → A evreni (vazgeçti, yalnız) → kapıdan geçiş → B evreni (cesaret etti, Ece ile gülüyor)
import { THREE, Person, assets, rng, clamp, lerp, smooth, ease, easeOut, easeIn, skyDome, glowSprite, dust } from './engine.js';
import { shards, doorFrame, timeline } from './kozmos.js';
import { worldA, worldB, skyB, poseCouple } from './dunyalar.js';

export const FRAMES = 240;
const T_A = 2.2, T_B = 4.75; // shot sınırları (sn)
let camera, sFork, sA, sB, heroF, ghostA, ghostB, heroA, heroB, ece, doorA, doorB, shardG, pathL, pathR;

export async function setup({ W, H }) {
  camera = new THREE.PerspectiveCamera(34, W / H, .05, 3000);
  // ---- 2a: boşlukta yol ayrımı ----
  sFork = new THREE.Scene(); sFork.environment = assets.envTex; sFork.environmentIntensity = .4;
  sFork.add(skyDome('#020309', '#0a0d1e', '#020206', { stars: 1, nebula: .35, nebColor: '#2a3a9a', nebColor2: '#ff8a4a', seed: 9 }));
  // kırık sokak parçası (havada asılı)
  const slabG = new THREE.CylinderGeometry(1.6, 1.1, .5, 7, 1); const slab = new THREE.Mesh(slabG, new THREE.MeshStandardMaterial({ color: 0x0b0c10, roughness: .55, metalness: .3, flatShading: true })); slab.position.y = -.25; slab.receiveShadow = true; sFork.add(slab);
  const under = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.8, 7), new THREE.MeshStandardMaterial({ color: 0x2a2420, roughness: .95, flatShading: true })); under.rotation.x = Math.PI; under.position.y = -1.4; sFork.add(under);
  heroF = new Person({ phone: true }); sFork.add(heroF.root);
  ghostA = new Person({ emissive: '#4f8cff', emissiveI: .8 }); sFork.add(ghostA.root);
  ghostB = new Person({ emissive: '#ffae5a', emissiveI: .8 }); sFork.add(ghostB.root);
  // iki ışık yolu ve uzaktaki iki kapı
  const mkPath = (dir, col) => { const pts = []; for (let k = 0; k <= 12; k++) { const t = k / 12; pts.push(new THREE.Vector3(dir * t * t * 22, -.02 - t * 2, t * 40)); } return timeline(pts, col, .06, dir > 0 ? 2 : 5); };
  pathL = mkPath(-1, '#6fb0ff'); pathR = mkPath(1, '#ffb36b'); sFork.add(pathL, pathR);
  const dl = doorFrame(1.6, 3, '#9fd0ff', 4); dl.position.set(-22, -2.2, 40); dl.scale.setScalar(2.2); sFork.add(dl);
  const dr = doorFrame(1.6, 3, '#ffd09f', 4); dr.position.set(22, -2.2, 40); dr.scale.setScalar(2.2); sFork.add(dr);
  const gl1 = glowSprite('#4f8cff', 30); gl1.position.set(-22, 1.5, 41); sFork.add(gl1);
  const gl2 = glowSprite('#ffa04f', 30); gl2.position.set(22, 1.5, 41); sFork.add(gl2);
  shardG = shards(70, [30, 16, 30], 8); sFork.add(shardG);
  sFork.add(dust(600, [30, 14, 30], '#cfe0ff', .05, 4, .6));
  const k1 = new THREE.SpotLight(0xdfe8ff, 25, 15, .5, .6, 1.5); k1.position.set(1.5, 5, 2.5); k1.target = heroF.root; k1.castShadow = true; sFork.add(k1);
  const r1 = new THREE.PointLight(0x4f8cff, 6, 8, 2); r1.position.set(-2.5, 1.8, 2); sFork.add(r1);
  const r2 = new THREE.PointLight(0xffa04f, 6, 8, 2); r2.position.set(2.5, 1.8, 2); sFork.add(r2);
  sFork.add(new THREE.AmbientLight(0x30364a, .6));

  // ---- 2b: A evreni ----
  sA = new THREE.Scene(); sA.environment = assets.envTex; sA.environmentIntensity = .2;
  sA.fog = new THREE.FogExp2(0x0a1424, .022);
  sA.add(skyDome('#03050a', '#0b1626', '#0b1626')); sA.add(worldA());
  heroA = new Person({ phone: false }); sA.add(heroA.root);
  doorA = doorFrame(1.5, 2.8, '#ffd9a8', 3); doorA.position.set(0, 0, -16); sA.add(doorA);
  const doorGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.8), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, .38, .1).multiplyScalar(1.6), fog: false })); doorGlow.position.set(0, 1.4, -16.02); sA.add(doorGlow);
  const dgl = glowSprite('#ffa860', 3.5); dgl.material.opacity = .5; dgl.position.set(0, 1.4, -15.8); sA.add(dgl);
  const dlight = new THREE.PointLight(0xffa860, 5, 10, 1.6); dlight.position.set(0, 1.4, -15.2); sA.add(dlight);
  const kA = new THREE.SpotLight(0x9fc4ff, 20, 16, .55, .6, 1.4); kA.position.set(2, 6, 4); kA.castShadow = true; kA.target = heroA.root; sA.add(kA);
  sA.userData.rain = rainLines(sA);

  // ---- 2c: B evreni ----
  sB = new THREE.Scene(); sB.environment = assets.envTex; sB.environmentIntensity = .5;
  sB.fog = new THREE.Fog(0xe08a6a, 60, 320);
  sB.add(skyB()); sB.add(worldB());
  heroB = new Person({ top: '#6a5240', scarf: '#c8a46a' }); sB.add(heroB.root);
  ece = new Person({ female: true, top: '#b8664c' }); sB.add(ece.root);
  doorB = doorFrame(1.5, 2.8, '#ffd9a8', .6); doorB.position.set(0, 0, 5.5); sB.add(doorB);
  sB.add(dust(300, [14, 5, 14], '#ffd6a0', .03, 12, .7));
  return { scene: sFork, camera };
}

function rainLines(sc) {
  const N = 3000, pos = new Float32Array(N * 6), base = new Float32Array(N * 4), r = rng(9);
  for (let i = 0; i < N; i++) { base[i * 4] = (r() - .5) * 14; base[i * 4 + 1] = r() * 9; base[i * 4 + 2] = 4 - r() * 34; base[i * 4 + 3] = .8 + r() * .4; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x9fb8d8, transparent: true, opacity: .4, depthWrite: false })); l.frustumCulled = false; sc.add(l);
  return { l, pos, base, N };
}
function updRain(R, t, zoff) {
  for (let i = 0; i < R.N; i++) { const b = R.base; const y = ((b[i * 4 + 1] - t * 11 * b[i * 4 + 3]) % 9 + 9) % 9; const z = b[i * 4 + 2] + zoff; R.pos.set([b[i * 4] + .02, y, z, b[i * 4], y + .2, z], i * 6); }
  R.l.geometry.attributes.position.needsUpdate = true;
}

export function frame(t, f, { grade, bloom }) {
  scene_uT(sFork, t);
  grade.uFlash.value = 0; grade.uFade.value = 0; grade.uCA.value = .0015; grade.uGrain.value = .05; grade.uVignette.value = .42;
  if (t < T_A) {
    // ---------- 2a: yörünge + ayrışma ----------
    const k = t / T_A;
    heroF.pose({ idle: [2 + t, 1] }); heroF.holdPhone(1);
    heroF.rot('Neck', .1, 0, 0);
    // ayrışma: iki hayalet gövdeden çıkar ve zıt yönlere yürür
    const sp = smooth(.75, 2.2, t);
    for (const [gh, dir] of [[ghostA, -1], [ghostB, 1]]) {
      gh.root.visible = t > .75;
      gh.root.position.set(dir * sp * 1.0, 0, .2 + sp * 2.6);
      gh.root.rotation.y = dir * .3 * sp;
      gh.pose({ walk: [t * 1.05 + (dir > 0 ? .5 : 0), sp > .05 ? 1 : 0], idle: [2 + t, sp > .05 ? 0 : 1] });
      gh.model.traverse(o => { if (o.material) { o.material.transparent = true; o.material.opacity = .25 + .55 * smooth(.75, 1.2, t); o.material.depthWrite = false; } });
    }
    const e = ease(k), a = lerp(.25, Math.PI * .97, e), d = lerp(2.6, 3.2, e);
    camera.fov = lerp(34, 40, e); camera.position.set(Math.sin(a) * d, lerp(1.45, 2.0, e), Math.cos(a) * d); camera.lookAt(0, lerp(1.35, 1.05, e), lerp(0, 1.8, e));
    shardG.children.forEach((s, i) => { s.rotation.x += 0; s.rotation.set(s.userData.spin.x * t * 2 + i, s.userData.spin.y * t * 2, i); });
    grade.uFlash.value = Math.max(0, 1 - t / .35) * .95;
    grade.uTint.value.set(1, 1, 1.02); grade.uSat.value = 1.0; bloom.strength = .6;
    camera.updateProjectionMatrix();
    return { scene: sFork };
  }
  if (t < T_B) {
    // ---------- 2b: A — vazgeçtin: yağmurda yalnız yürüyüş ----------
    const k = (t - T_A) / (T_B - T_A);
    const z = 4 - (t - T_A) * 1.25;
    heroA.root.position.set(0, 0, z); heroA.root.rotation.y = Math.PI; // kameradan uzağa (kapıya doğru) değil: kameraya doğru yürüsün diye aşağıda ayarlanır
    heroA.root.rotation.y = 0; heroA.root.position.z = -2 - (t - T_A) * -1.2; // kameraya doğru yürür
    heroA.pose({ walk: [t * .92, 1] });
    heroA.rot('Neck', .25, 0, 0).rot('Head', .12, 0, 0).rot('Spine2', .08, 0, 0); // başı önde
    // omuzlar düşük: kollar gövdeye yakın
    updRain(sA.userData.rain, t, 0);
    const hz = heroA.root.position.z;
    if (k < .62) { // önden geri geri giden takip
      const kk = k / .62;
      camera.fov = 30; camera.position.set(lerp(.6, .3, kk), 1.55, hz + lerp(3.2, 2.6, kk)); camera.lookAt(0, 1.4, hz);
    } else { // kamera onu bırakır, arkasındaki kapıya yükselip dalar
      const kk = (k - .62) / .38, e = easeIn(kk);
      const from = new THREE.Vector3(.3, 1.55, hz + 2.6), to = new THREE.Vector3(0, 1.45, -15.6);
      camera.position.copy(from.clone().lerp(to, e)); camera.position.x += Math.sin(kk * 3) * .2 * (1 - e);
      camera.fov = lerp(30, 40, e);
      camera.lookAt(new THREE.Vector3(0, 1.4, hz).lerp(new THREE.Vector3(0, 1.4, -20), smooth(0, .35, kk)));
    }
    const wk = smooth(.62, 1, k); grade.uTint.value.set(lerp(.82, 1.1, wk), lerp(.95, .95, wk), lerp(1.18, .8, wk)); grade.uSat.value = lerp(.62, 1.1, wk); grade.uContrast.value = 1.08; bloom.strength = .35;
    grade.uFlash.value = smooth(.94, 1, k) * .7; grade.uCA.value = .0015 + smooth(.75, 1, k) * .01;
    camera.updateProjectionMatrix();
    return { scene: sA };
  }
  // ---------- 2c: B — cesaret ettin: Ece ile gülüşme ----------
  const k = (t - T_B) / (8 - T_B);
  poseCouple(heroB, ece, t);
  // kamera: kapıdan çıkar, çifte doğru yay çizer
  if (k < .25) { const kk = easeOut(k / .25); camera.position.set(lerp(0, .5, kk), lerp(1.45, 1.5, kk), lerp(6.2, 3.6, kk)); camera.fov = lerp(40, 32, kk); }
  else { const kk = ease((k - .25) / .75); const a = lerp(.14, -.12, kk), d = lerp(3.6, 2.3, kk); camera.position.set(Math.sin(a) * d, lerp(1.4, 1.3, kk), Math.cos(a) * d); camera.fov = 32; }
  camera.lookAt(0, 1.5, 0);
  grade.uTint.value.set(1.12, 1.0, .86); grade.uSat.value = 1.12; grade.uContrast.value = 1.04; bloom.strength = .7;
  grade.uFlash.value = Math.max(0, 1 - (t - T_B) / .3) * .8;
  camera.updateProjectionMatrix();
  return { scene: sB };
}
function scene_uT(sc, t) { sc.traverse(o => { if (o.material && o.material.uniforms && o.material.uniforms.uT) o.material.uniforms.uT.value = t; }); }
