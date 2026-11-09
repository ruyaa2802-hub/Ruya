// SAHNE 3 — SONSUZ SEÇENEKLER (13–23 sn): B evreninden hızla geri çekiliş → boşlukta asılı binlerce kapı, her birinde başka bir hayat
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { THREE, Person, assets, rng, clamp, lerp, smooth, ease, easeIn, easeOut, skyDome, glowSprite, dust, renderer } from './engine.js';
import { island, doorFrame, timeline, shards } from './kozmos.js';
import { worldB, skyB, poseCouple } from './dunyalar.js';
import { LIVES } from './hayatlar.js';

export const FRAMES = 300;
let camKeys = null;
let camera, voidS, sB, heroB, ece, portals = [], farDoors, farMat, tls = [], shardG, W0, H0, path;
const DB = 5.5; // B evreninde kapı düzlemi z

// Portal: void'deki kapı açıklığı, ardındaki dünyayı sanal kamerayla render eder
function makePortal(world, anchorZ, w, h, res) {
  const rt = new THREE.WebGLRenderTarget(W0 * res, H0 * res, { type: THREE.HalfFloatType, samples: 2 });
  const mat = new THREE.ShaderMaterial({ uniforms: { tMap: { value: rt.texture }, uRes: { value: new THREE.Vector2(W0, H0) }, uFade: { value: 1 } },
    vertexShader: `void main(){ gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform sampler2D tMap; uniform vec2 uRes; uniform float uFade; void main(){ vec3 c=texture2D(tMap,gl_FragCoord.xy/uRes).rgb; gl_FragColor=vec4(c*uFade,1.); }` });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); plane.position.y = h / 2;
  const frame = doorFrame(w, h, '#e8d6b0', .35);
  const g = new THREE.Group(); g.add(plane, frame);
  const glow = glowSprite('#ffd6a0', Math.max(w, h) * 1.6); glow.position.set(0, h / 2, -.05); glow.material.opacity = .25; g.add(glow);
  return { group: g, plane, rt, world, anchor: new THREE.Matrix4().makeTranslation(0, 0, anchorZ), clip: new THREE.Plane(new THREE.Vector3(0, 0, -1), anchorZ), vcam: new THREE.PerspectiveCamera() };
}
function renderPortal(p, cam) {
  p.group.updateMatrixWorld(true);
  const m = p.anchor.clone().multiply(p.group.matrixWorld.clone().invert()).multiply(cam.matrixWorld);
  p.vcam.copy(cam); m.decompose(p.vcam.position, p.vcam.quaternion, p.vcam.scale); p.vcam.updateMatrixWorld(true);
  renderer.setRenderTarget(p.rt); renderer.clippingPlanes = [p.clip]; renderer.clear(); renderer.render(p.world, p.vcam);
  renderer.clippingPlanes = []; renderer.setRenderTarget(null);
}

export async function setup({ W, H }) {
  W0 = W; H0 = H;
  camera = new THREE.PerspectiveCamera(34, W / H, .05, 4000);
  // --- B evreni (başlangıç) ---
  sB = new THREE.Scene(); sB.environment = assets.envTex; sB.environmentIntensity = .5; sB.fog = new THREE.Fog(0xe08a6a, 60, 320);
  sB.add(skyB()); sB.add(worldB());
  heroB = new Person({ top: '#6a5240', scarf: '#c8a46a' }); sB.add(heroB.root);
  ece = new Person({ female: true, top: '#b8664c' }); sB.add(ece.root);

  // --- boşluk ---
  voidS = new THREE.Scene(); voidS.environment = assets.envTex; voidS.environmentIntensity = .6;
  voidS.add(skyDome('#020208', '#0a0a20', '#020206', { stars: 1.2, nebula: .8, nebColor: '#2a5ad8', nebColor2: '#ff8a4a', seed: 21 }));
  voidS.add(new THREE.AmbientLight(0x404a70, 1.2));
  const key = new THREE.DirectionalLight(0xffe0c0, 1.5); key.position.set(10, 20, 30); voidS.add(key);

  // B kapısı (orijin) + detaylı kapılar
  const pB = makePortal(sB, DB, 1.5, 2.8, 1); voidS.add(pB.group); portals.push(pB);
  path = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 3.2, 22), new THREE.Vector3(9, 4, 26), new THREE.Vector3(20, 5.5, 24), new THREE.Vector3(30, 7, 18), new THREE.Vector3(38, 8.5, 10), new THREE.Vector3(44, 10, 0), new THREE.Vector3(47, 11.5, -10)]);
  const kinds = ['gezgin', 'asci', 'yasli', 'ressam', 'cocuk', 'isinsani', 'baba'];
  kinds.forEach((k, i) => {
    const life = LIVES[k](); const p = makePortal(life.scene, 2.4, 1.5, 2.8, .5); p.life = life;
    const u = .16 + i * .12; const pt = path.getPointAt(u), tan = path.getTangentAt(u);
    const side = new THREE.Vector3().crossVectors(tan, new THREE.Vector3(0, 1, 0)).normalize().multiplyScalar(i % 2 ? 7 : -7);
    p.group.position.copy(pt).add(side).add(tan.clone().multiplyScalar(3)).add(new THREE.Vector3(0, -2.6, 0)); p.group.scale.setScalar(1.8);
    const look = path.getPointAt(Math.max(0, u - .03)); p.group.lookAt(look.x, p.group.position.y, look.z);
    p.u = u; voidS.add(p.group); portals.push(p);
    // her hayatı kendi kapısının önünde, kendi zemini olmadan da göstermek için kapı mesh'ine ek yok
  });
  // binlerce uzak kapı (instanced) — her birinde başka bir gökyüzü ve bir silüet
  const N = 2600, R = rng(55);
  const bars = [[.1, 3.0, 0, -.8], [.1, 3.0, 0, .8], [1.7, .1, 1.45, 0], [1.7, .1, -1.45, 0]].map(([w, h, y, x]) => { const b = new THREE.BoxGeometry(w, h, .1); b.translate(x, y, 0); return b; });
  const fg = mergeGeometries(bars);
  const frameMesh = new THREE.InstancedMesh(fg, new THREE.MeshStandardMaterial({ color: 0x8a7a60, metalness: .7, roughness: .35, emissive: 0xffc890, emissiveIntensity: .15 }), N);
  farMat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 } },
    vertexShader: `attribute vec3 aC1; attribute vec3 aC2; attribute float aS; varying vec2 vUv; varying vec3 c1,c2; varying float s; varying float vD;
      void main(){ vUv=uv; c1=aC1; c2=aC2; s=aS; vec4 mv=modelViewMatrix*instanceMatrix*vec4(position,1.); vD=-mv.z; gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform float uT; varying vec2 vUv; varying vec3 c1,c2; varying float s; varying float vD;
      float box(vec2 p, vec2 b){ vec2 d=abs(p)-b; return length(max(d,0.))+min(max(d.x,d.y),0.); }
      void main(){ vec3 col=mix(c2,c1,smoothstep(.0,.9,vUv.y)); float hz=step(vUv.y,.28+.05*sin(vUv.x*9.+s*20.)); col=mix(col,c2*.35,hz);
        // yürüyen küçük silüet
        float x=fract(s*7.3+uT*.04*(s>.5?1.:-1.))*1.2-.1; vec2 p=vUv-vec2(x,.28);
        vec2 q=p*vec2(1.,.54);
        float body=box(q-vec2(0.,.11),vec2(.07,.055))-.015; float head=length(q-vec2(0.,.2))-.032; float legs=min(box(q-vec2(-.03+.015*sin(uT*5.+s*9.),.03),vec2(.022,.04)),box(q-vec2(.03-.015*sin(uT*5.+s*9.),.03),vec2(.022,.04)));
        float sil=min(min(body,head),legs); col=mix(col,vec3(.03,.02,.04),smoothstep(.004,0.,sil));
        float fade=exp(-vD/180.); col=mix(vec3(.08,.06,.18),col*.85,fade);
        gl_FragColor=vec4(col,1.); }` });
  const og = new THREE.PlaneGeometry(1.5, 2.8);
  const c1 = new Float32Array(N * 3), c2 = new Float32Array(N * 3), sv = new Float32Array(N);
  const openMesh = new THREE.InstancedMesh(og, farMat, N);
  const pal = [['#ffb37a', '#5a2a4a'], ['#9fd8ff', '#1a3a5a'], ['#ffe6a0', '#6a4a2a'], ['#ff8fb0', '#3a1a3a'], ['#a0ffd0', '#1a4a3a'], ['#c0b0ff', '#2a1a5a'], ['#ffffff', '#6a7a8a'], ['#ff6a4a', '#2a0a0a']];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3(), e = new THREE.Euler();
  for (let i = 0; i < N; i++) {
    // sonsuzluğa uzanan helezon + rastgele bulut
    let x, y, z;
    if (i < N * .55) { const a = i * .137, r = 14 + (i / N) * 260, h = (R() - .5) * 140; x = Math.cos(a) * r; z = Math.sin(a) * r - 20; y = h * (r / 200) + (R() - .5) * 20; }
    else { x = (R() - .5) * 600; y = (R() - .5) * 300; z = (R() - .5) * 600 - 100; }
    pos.set(x, y, z);
    // kamera yolundan ve B kapısından uzak tut
    let tries = 0, ok = false; while (tries++ < 8) { let md = 1e9; for (let k = 0; k <= 40; k++) md = Math.min(md, path.getPointAt(k / 40).distanceTo(pos)); if (md > 26 && pos.length() > 20) { ok = true; break; } pos.x = (R() - .5) * 700; pos.y = (R() - .5) * 300; pos.z = (R() - .5) * 700 - 100; }
    if (!ok) pos.set(0, -5000, 0);
    const ctr = new THREE.Vector3(24, 6, 12); const lm = new THREE.Matrix4().lookAt(ctr, pos, new THREE.Vector3(0, 1, 0)); q.setFromRotationMatrix(lm); q.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler((R() - .5) * .4, (R() - .5) * .9, (R() - .5) * .3))); sc.setScalar(.8 + Math.pow(R(), 4) * 5 + pos.length() / 120);
    m.compose(pos, q, sc); frameMesh.setMatrixAt(i, m);
    const off = new THREE.Matrix4().makeTranslation(0, 0, 0); openMesh.setMatrixAt(i, m.clone().multiply(off));
    const pp = pal[Math.floor(R() * pal.length)]; const ca = new THREE.Color(pp[0]), cb = new THREE.Color(pp[1]);
    c1.set([ca.r, ca.g, ca.b], i * 3); c2.set([cb.r, cb.g, cb.b], i * 3); sv[i] = R();
  }
  og.setAttribute('aC1', new THREE.InstancedBufferAttribute(c1, 3)); og.setAttribute('aC2', new THREE.InstancedBufferAttribute(c2, 3)); og.setAttribute('aS', new THREE.InstancedBufferAttribute(sv, 1));
  voidS.add(frameMesh, openMesh); farDoors = openMesh; if (new URLSearchParams(location.search).get('hide') === '1') { frameMesh.visible = false; openMesh.visible = false; }
  // zaman çizgileri: kapılar arasından örülen ışık şeritleri
  const TR = rng(91);
  for (let i = 0; i < 9; i++) {
    const pts = []; const ph = TR() * 6;
    for (let k = 0; k < 14; k++) { const a = k * .5 + ph; pts.push(new THREE.Vector3(Math.cos(a) * (18 + k * 4) + (TR() - .5) * 8, (k - 7) * 3 + Math.sin(a * 2) * 6, Math.sin(a) * (18 + k * 4) - 10)); }
    pts.forEach(v => v.add(new THREE.Vector3(-30, 0, -40))); const tl = timeline(pts, ['#7fd4ff', '#ffb36b', '#ff7fd0', '#a0ffcf'][i % 4], .08 + TR() * .1, i); voidS.add(tl); tls.push(tl);
  }
  // yüzen şehir adaları (farklı ölçekler; biri devasa ve ters)
  const IR = rng(31);
  for (let i = 0; i < 14; i++) { const isl = island({ seed: 900 + i, r: 2 + IR() * 6, warm: IR() < .5, flip: IR() < .25 }); isl.position.set((IR() - .5) * 260, (IR() - .5) * 120, -80 - IR() * 200); isl.rotation.y = IR() * 6; voidS.add(isl); }
  const giant = island({ seed: 999, r: 60, warm: false, flip: true, glow: '#7fc4ff' }); giant.position.set(-60, 160, -260); voidS.add(giant);
  shardG = shards(60, [80, 30, 80], 13); shardG.position.set(24, 6, 0); voidS.add(shardG);
  voidS.add(dust(1500, [120, 60, 120], '#cfe0ff', .12, 6, .5));
  return { scene: voidS, camera };
}

export function frame(t, f, { grade, bloom }) {
  const T2 = t + 8; // B çiftinin zamanı sahne 2'den devam eder
  poseCouple(heroB, ece, T2);
  portals.forEach(p => { if (p.life) p.life.update(t + p.u * 10); });
  farMat.uniforms.uT.value = t; tls.forEach(l => l.material.uniforms.uT.value = t);
  shardG.children.forEach((s, i) => s.rotation.set(s.userData.spin.x * t + i, s.userData.spin.y * t, i));

  // --- kamera yolu ---
  let inside = false;
  if (t < 2.6) {
    // B içinden hızla geri: B koordinatında (-.28,1.3,2.3)'ten kapıya ve öteye
    const k = easeIn(clamp(t / 2.6)) * .55 + clamp(t / 2.6) * .45;
    const zB = lerp(2.3 - DB, 22, Math.pow(k, 1.6));
    camera.position.set(lerp(-.28, 0, smooth(0, .4, k)), lerp(1.3, 3.2, smooth(.2, 1, k)), zB);
    camera.fov = lerp(32, 52, smooth(.1, .9, k));
    camera.lookAt(0, lerp(1.5, 1.6, k), zB - 10);
    inside = camera.position.z < -.02;
  } else {
    const k = clamp((t - 2.6) / 7.4);
    if (!camKeys) {
      const P = [new THREE.Vector3(0, 3.2, 22)], L = [new THREE.Vector3(0, 1.6, 0)];
      portals.slice(1).forEach((p, i) => { p.group.updateMatrixWorld(true); const c = new THREE.Vector3(0, 1.45, 0).applyMatrix4(p.group.matrixWorld); const vp = new THREE.Vector3(i % 2 ? 1.4 : -1.4, 1.6, 6.2).applyMatrix4(p.group.matrixWorld); P.push(vp); L.push(c); });
      const last = P[P.length - 1].clone(), ll = L[L.length - 1].clone(); const dir = ll.clone().sub(last).normalize();
      P.push(last.clone().add(dir.clone().multiplyScalar(6)).add(new THREE.Vector3(0, 4, 0))); L.push(ll.clone().add(dir.multiplyScalar(30)).add(new THREE.Vector3(0, 12, 0)));
      camKeys = { P: new THREE.CatmullRomCurve3(P, false, 'centripetal'), L: new THREE.CatmullRomCurve3(L, false, 'centripetal'), n: P.length - 1 };
    }
    // her durakta biraz yavaşla
    const n = camKeys.n, x = k * n, seg = Math.floor(Math.min(x, n - 1e-6)), fr = x - seg;
    const fs = seg === 0 ? ease(fr) : fr + Math.sin(fr * Math.PI * 2) * -.11;
    const u = (seg + fs) / n;
    camera.position.copy(camKeys.P.getPoint(u));
    const pullP = new THREE.Vector3(0, 3.2, 22);
    if (t < 3.4) camera.position.lerp(pullP, 1 - smooth(2.6, 3.4, t));
    const Lp = camKeys.L.points, la = Lp[seg].clone().lerp(Lp[Math.min(seg + 1, Lp.length - 1)], smooth(.5, 1, fr));
    camera.lookAt(la);
    camera.fov = 52 - 12 * smooth(3, 5, t);
  }
  const DBG = +(new URLSearchParams(location.search).get('dbg') || 0);
  if (DBG) { const g = portals[DBG].group; g.updateMatrixWorld(true); const p = new THREE.Vector3(0, 1.5, 7).applyMatrix4(g.matrixWorld); camera.position.copy(p); camera.lookAt(new THREE.Vector3(0, 1.4, 0).applyMatrix4(g.matrixWorld)); camera.fov = 40; }
  camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
  // portalları render et (görünenler)
  const fr = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  portals.forEach((p, i) => { if (i === 0 && inside) return; if (fr.intersectsObject(p.plane) && p.group.position.distanceTo(camera.position) < 120) renderPortal(p, camera); });
  // grade
  grade.uFlash.value = 0; grade.uFade.value = 0; grade.uCA.value = .0015 + smooth(.4, 2, t) * (1 - smooth(2, 3, t)) * .01;
  grade.uTint.value.set(1, .98, 1.02); grade.uSat.value = 1.08; grade.uContrast.value = 1.06; grade.uVignette.value = .45;
  bloom.strength = .6;
  grade.uFade.value = smooth(9.6, 10, t) * 0; // geçiş sahne 4'te
  grade.uFlash.value = smooth(9.75, 10, t) * .6;
  if (inside) { const v = portals[0].vcam; v.copy(camera); v.position.z += DB; v.updateMatrixWorld(true); renderer.clippingPlanes = []; return { scene: sB, camera: v }; }
  return { scene: voidS, camera };
}
