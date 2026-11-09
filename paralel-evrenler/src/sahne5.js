// SAHNE 5 — TERS KÖŞE (32–40 sn): Karanlıkta binlerce versiyon, "Hangimiz gerçek?", her şey karanlığa gömülür, son yazı
import { THREE, Person, assets, rng, clamp, lerp, smooth, ease, easeOut, easeIn, glowSprite, dust } from './engine.js';

export const FRAMES = 240;
const T_STEP = 2.3, T_SAY = 3.05, T_REV = 4.15, T_COL = 5.0, T_BLACK = 5.65, T_TXT = 5.95;
let scene, camera, hero, speaker, crowd = [], sil, silMat, spot, txtScene, txtCam, txtMat, burst;
const OUTFITS = [
  { top: '#c9b48a', bottom: '#5a4a38', backpack: '#7a3b22', hat: '#8a6a45', scarf: '#b4532a' },
  { top: '#cfccc6', chefHat: true, bottom: '#2a2a2a', scarf: '#cfccc6' },
  { top: '#5a4a5a', grey: true, beard: true, glasses: true, scarf: '#7a3a3a' },
  { top: '#8a9aa8', scarf: '#d8b04a' },
  { top: '#1c1f26', bottom: '#1c1f26', tie: '#7a1020', scarf: null },
  { top: '#7a8a9a', beard: true, scarf: null },
  { top: '#3a5a4a', glasses: true, scarf: '#c0a060' },
  { top: '#e0c0a0', scarf: '#a04060' },
  { top: '#2a3a5a', scarf: '#d0d0d0', beard: true },
  { top: '#5a2a2a', scarf: '#202020' },
];

export async function setup({ W, H }) {
  scene = new THREE.Scene(); scene.environment = assets.envTex; scene.environmentIntensity = .12;
  scene.background = new THREE.Color(0x000000); scene.fog = new THREE.FogExp2(0x000000, .035);
  camera = new THREE.PerspectiveCamera(34, W / H, .05, 600);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(80, 64), new THREE.MeshStandardMaterial({ color: 0x050507, roughness: .22, metalness: .85 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  // ana karakter: merkezde, tepeden soğuk spot
  hero = new Person({}); hero.root.position.set(0, 0, 0); hero.root.rotation.y = 0; scene.add(hero.root);
  spot = new THREE.SpotLight(0xcfe0ff, 60, 14, .32, .5, 1.4); spot.position.set(0, 7, 1.2); spot.target = hero.root; spot.castShadow = true; scene.add(spot);
  scene.add(new THREE.HemisphereLight(0x3a4a7a, 0x000000, .25));
  // karşısındaki versiyonlar (yakın sıralar: gerçek modeller)
  const R = rng(17);
  const rows = [[4.2, 7], [6.0, 9]];
  let id = 0;
  rows.forEach(([r, n], ri) => {
    for (let i = 0; i < n; i++) {
      const a = (i - (n - 1) / 2) * (ri ? .19 : .24);
      const o = { ...OUTFITS[(id * 3 + ri) % OUTFITS.length] };
      const p = new Person(o); p.root.position.set(Math.sin(a) * r, 0, Math.cos(a) * r); p.root.rotation.y = a + Math.PI;
      p.appear = .25 + ri * .35 + R() * .5; p.phase = R() * 5; p.row = ri;
      p.model.traverse(x => { if (x.isMesh) { x.material.transparent = true; } });
      scene.add(p.root); crowd.push(p); id++;
    }
  });
  // konuşan versiyon: B evrenindeki (cesaret eden) hali — ön sıranın ortasından öne çıkar
  speaker = new Person({ top: '#6a5240', scarf: '#c8a46a' }); speaker.root.position.set(0, 0, 3.4); speaker.root.rotation.y = Math.PI; scene.add(speaker.root);
  speaker.model.traverse(x => { if (x.isMesh) x.material.transparent = true; });
  // arka ışık (versiyonlara kontur)
  const back = new THREE.SpotLight(0x9fb8ff, 80, 30, .9, .6, 1.2); back.position.set(0, 9, 14); back.target.position.set(0, 0, 4); scene.add(back, back.target);
  const front = new THREE.PointLight(0xffd8b0, 2.5, 5, 1.8); front.position.set(.5, 1.75, .5); scene.add(front); scene.userData.front = front; scene.userData.back = back;
  // binlerce uzak versiyon: amfitiyatro gibi yükselen sıralarda silüetler
  const N = 2200; const g = new THREE.PlaneGeometry(.75, 1.95); g.translate(0, .975, 0);
  silMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uT: { value: 0 }, uCol: { value: 99 } },
    vertexShader: `attribute float aA; attribute float aD; varying vec2 vUv; varying float a; varying float d; void main(){ vUv=uv; a=aA; d=aD; gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform float uT,uCol; varying vec2 vUv; varying float a; varying float d;
      float box(vec2 p, vec2 b){ vec2 q=abs(p)-b; return length(max(q,0.))+min(max(q.x,q.y),0.); }
      void main(){ vec2 p=(vUv-vec2(.5,0.))*vec2(.75,1.95);
        float head=length(p-vec2(0.,1.68))-.11; float body=box(p-vec2(0.,1.15),vec2(.19,.3))-.06; float legs=min(box(p-vec2(-.09,.45),vec2(.07,.45)),box(p-vec2(.09,.45),vec2(.07,.45)));
        float arms=min(box(p-vec2(-.27,1.0),vec2(.05,.3)),box(p-vec2(.27,1.0),vec2(.05,.3))); float s=min(min(head,body),min(legs,arms));
        float vis=smoothstep(a,a+.5,uT)*(1.-smoothstep(uCol-d*.012,uCol-d*.012+.2,uT));
        float rim=smoothstep(.0,-.012,s)-smoothstep(-.012,-.035,s);
        float inside=smoothstep(.01,-.01,s);
        float fade=exp(-(d-8.)/14.);
        vec3 col=vec3(.004,.005,.009)+vec3(.35,.45,.8)*rim*.06*fade;
        gl_FragColor=vec4(col, inside*vis); }` });
  sil = new THREE.InstancedMesh(g, silMat, N);
  const aA = new Float32Array(N), aD = new Float32Array(N); const m = new THREE.Matrix4();
  for (let i = 0; i < N; i++) {
    const tier = Math.floor(i / 200), r = 8 + tier * 2.2, ang = (R() - .5) * (1.5 + tier * .05) * Math.PI * .62;
    const p = new THREE.Vector3(Math.sin(ang) * r, tier * .8, Math.cos(ang) * r);
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(-p.x, -p.z));
    m.compose(p, q, new THREE.Vector3(1, 1, 1)); sil.setMatrixAt(i, m);
    aA[i] = .3 + tier * .1 + R() * .5; aD[i] = r;
  }
  g.setAttribute('aA', new THREE.InstancedBufferAttribute(aA, 1)); g.setAttribute('aD', new THREE.InstancedBufferAttribute(aD, 1));
  scene.add(sil);
  const hz = glowSprite('#4a6ac8', 90); hz.position.set(0, 8, 60); hz.material.opacity = .8; hz.material.fog = false; scene.add(hz); scene.userData.hz = hz;
  burst = dust(2500, [30, 10, 30], '#9fb8ff', .06, 23, 0); burst.position.set(0, 4, 12); scene.add(burst);
  // son yazı
  txtScene = new THREE.Scene(); txtCam = new THREE.OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, -10, 10);
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
  const fs = Math.round(W * .088); x.font = `italic ${fs}px "Liberation Serif", "DejaVu Serif", serif`;
  x.shadowColor = 'rgba(160,190,255,.55)'; x.shadowBlur = fs * .5;
  x.fillText('Ya başka bir hayatın', W / 2, H / 2 - fs * .7); x.fillText('şu anda yaşanıyorsa?', W / 2, H / 2 + fs * .7);
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
  txtMat = new THREE.MeshBasicMaterial({ map: tx, transparent: true, opacity: 0, toneMapped: false });
  txtScene.background = new THREE.Color(0); txtScene.add(new THREE.Mesh(new THREE.PlaneGeometry(W, H), txtMat));
  return { scene, camera };
}

function setOpacity(p, o) { p.model.traverse(x => { if (x.isMesh) { if (x.userData.v0 === undefined) x.userData.v0 = x.visible; x.material.opacity = o; x.material.depthWrite = o > .98; x.visible = x.userData.v0 && o > .01; } }); }

export function frame(t, f, { grade, bloom }) {
  grade.uFlash.value = 0; grade.uCA.value = .0015; grade.uGrain.value = .06; grade.uVignette.value = .55; grade.uSat.value = .9; grade.uTint.value.set(.95, 1, 1.08); grade.uContrast.value = 1.1;
  if (t >= T_BLACK) {
    // ---- son ekran ----
    const k = smooth(T_TXT, T_TXT + 1.1, t);
    txtMat.opacity = k * (1 - smooth(7.75, 8, t) * 0);
    txtScene.children[0].scale.setScalar(1 + (t - T_TXT) * .012);
    grade.uFade.value = 0; grade.uVignette.value = .3; grade.uCA.value = .001; bloom.strength = .5;
    return { scene: txtScene, camera: txtCam };
  }
  silMat.uniforms.uT.value = t; silMat.uniforms.uCol.value = T_COL - .1;
  // kalabalık: belirir, kahramana bakar, sonra dalga halinde söner
  hero.pose({ idle: [t * .8 + 3, 1] });
  hero.root.updateMatrixWorld(true);
  const heroHead = hero.bones.Head.getWorldPosition(new THREE.Vector3());
  crowd.forEach((p, i) => {
    p.pose({ idle: [t * .7 + p.phase, 1] });
    const app = smooth(p.appear, p.appear + .6, t), gone = 1 - smooth(T_COL + .05 * (1 - p.row) + i * .012, T_COL + .3 + i * .012, t);
    setOpacity(p, app * gone);
    p.lookAt(heroHead, .9);
  });
  // konuşan versiyon öne çıkar
  const sa = smooth(.6, 1.2, t), step = smooth(T_STEP, T_STEP + .75, t);
  speaker.root.position.z = lerp(3.4, 1.55, step);
  speaker.pose({ walk: [t * .9, step > 0 && step < 1 ? 1 : 0], idle: [t, step > 0 && step < 1 ? 0 : 1] });
  speaker.lookAt(heroHead, .95);
  // "Hangimiz gerçek?" — Han-gi-miz ger-çek
  const sy = [[0, .18], [.2, .34], [.36, .52], [.6, .78], [.8, 1.0]];
  let mo = 0; const ts = t - T_SAY; sy.forEach(([a, b]) => { if (ts > a && ts < b) mo = Math.max(mo, Math.sin((ts - a) / (b - a) * Math.PI)); });
  speaker.morph('mouthOpen', mo * .75).morph('mouthSmile', .05);
  setOpacity(speaker, sa * (1 - smooth(T_COL + .25, T_COL + .5, t)));
  // kahraman: şaşkın, cevap vermeye çalışır
  const tryAns = smooth(T_REV + .45, T_REV + .7, t) * (1 - smooth(T_COL - .05, T_COL + .1, t));
  hero.morph('mouthOpen', tryAns * .35 + Math.sin(t * 9) * .02);
  hero.lookAt(speaker.bones.Head.getWorldPosition(new THREE.Vector3()), .9);
  // ışıklar
  const col = smooth(T_COL, T_BLACK - .1, t);
  spot.intensity = 60 * (1 - col); scene.userData.back.intensity = 80 * smooth(.2, 1.5, t) * (1 - smooth(T_COL, T_COL + .3, t)); scene.userData.front.intensity = 2.5 * (1 - col);
  scene.userData.hz.material.opacity = .8 * smooth(.2, 1.5, t) * (1 - smooth(T_COL, T_COL + .4, t));
  burst.material.opacity = smooth(T_COL, T_COL + .15, t) * (1 - smooth(T_COL + .3, T_BLACK, t)) * .9; burst.position.y = 4 + (t - T_COL) * 2; burst.scale.setScalar(1 + Math.max(0, t - T_COL) * 1.5);
  // kamera
  if (t < T_STEP) { // arkasından geniş: binlerce versiyon belirir
    const k = t / T_STEP;
    camera.fov = 38; camera.position.set(lerp(.9, .45, k), lerp(1.2, 1.65, k), lerp(-3.4, -2.6, k)); camera.lookAt(0, lerp(2.4, 1.9, k), 6);
  } else if (t < T_REV) { // omuz üstü: konuşan versiyon
    const k = (t - T_STEP) / (T_REV - T_STEP);
    camera.fov = lerp(30, 24, k); camera.position.set(lerp(.38, .3, k), 1.62, lerp(-.7, -.55, k));
    const sh = speaker.bones.Head.getWorldPosition(new THREE.Vector3()); camera.lookAt(sh.x - .05, sh.y - .05, sh.z);
  } else { // ters açı: kahramanın yüzü
    const k = (t - T_REV) / (T_BLACK - T_REV);
    camera.fov = lerp(22, 18, k); camera.position.set(lerp(-.25, -.22, k), 1.6, lerp(1.25, 1.05, k));
    camera.lookAt(heroHead.x, heroHead.y + .03, heroHead.z);
  }
  camera.updateProjectionMatrix();
  grade.uFade.value = smooth(T_BLACK - .35, T_BLACK - .02, t);
  grade.uCA.value = .0015 + smooth(T_COL, T_COL + .2, t) * .01;
  bloom.strength = .6;
}
