// Ortak motor: yükleme, karakter (tek kimlik, çok versiyon), animasyon retarget, post-prodüksiyon.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export { THREE };
const DBG = new URLSearchParams(location.search).get('hide') === '1';
export const FPS = 30;

// ---------- deterministik rastgele ----------
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => { s += 0x6D2B79F5; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const easeOut = t => 1 - Math.pow(1 - clamp(t), 3);
export const easeIn = t => Math.pow(clamp(t), 3);

// ---------- yükleme ----------
const loader = new GLTFLoader();
const load = url => new Promise((res, rej) => loader.load(url, res, undefined, rej));
export const assets = {};

function restMap(root, strip) {
  const m = {};
  root.traverse(o => { if (o.isBone || /Hips|Spine|Arm|Leg|Head|Neck|Hand|Foot|Toe|Shoulder|Eye/.test(o.name)) m[o.name.replace(strip, '')] = { q: o.quaternion.clone(), p: o.position.clone() }; });
  return m;
}

// Mixamo (Xbot) kliplerini hedef iskelete taşı: q_t = R_t * R_s^-1 * q
export let RT_MODE = +(new URLSearchParams(location.search).get('rt') ?? 0);
function retarget(clip, srcRest, dstRest, prefix, hipScale, keepHipPos = true) {
  const tracks = [];
  for (const tr of clip.tracks) {
    const [node, prop] = tr.name.split('.');
    const bone = node.replace('mixamorig', '');
    if (!dstRest[bone] || !srcRest[bone]) continue;
    if (prop === 'quaternion') {
      const rs = srcRest[bone].q.clone().invert(), rt = dstRest[bone].q;
      const v = tr.values.slice(), q = new THREE.Quaternion();
      for (let i = 0; i < v.length; i += 4) {
        q.fromArray(v, i); if (RT_MODE === 1) q.premultiply(rs).premultiply(rt); else if (RT_MODE === 2) q.multiply(rs).premultiply(rt); q.toArray(v, i);
      }
      tracks.push(new THREE.QuaternionKeyframeTrack(prefix + bone + '.quaternion', tr.times, v));
    } else if (prop === 'position' && bone === 'Hips' && keepHipPos) {
      const v = tr.values.slice(), sp = srcRest.Hips.p, dp = dstRest.Hips.p;
      for (let i = 0; i < v.length; i += 3) {
        v[i] = 0; v[i + 2] = dp.z; // yerinde
        v[i + 1] = dp.y + (v[i + 1] - sp.y) * hipScale;
      }
      tracks.push(new THREE.VectorKeyframeTrack(prefix + 'Hips.position', tr.times, v));
    }
  }
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

// Dünya-uzayı retarget: Wt = Ws * Ws_rest^-1 * Wt_rest  (kareler 30fps örneklenir)
function bake(srcScene, clip, dstScene, srcPrefix, dstPrefix, hipScale, keepHip) {
  const find = (root, pre) => { const m = {}; root.traverse(o => { if (o.isBone) m[o.name.replace(pre, '')] = o; }); return m; };
  const S = find(srcScene, srcPrefix), D = find(dstScene, dstPrefix);
  const names = Object.keys(D).filter(n => S[n]);
  // dinlenme pozları
  srcScene.updateMatrixWorld(true); dstScene.updateMatrixWorld(true);
  const wq = o => o.getWorldQuaternion(new THREE.Quaternion());
  const sRest = {}, dRest = {}, dLocalRest = {};
  for (const n of names) { sRest[n] = wq(S[n]); dRest[n] = wq(D[n]); dLocalRest[n] = D[n].quaternion.clone(); }
  const dRestDir = {};
  for (const k in LIMB) if (D[k] && D[LIMB[k]]) dRestDir[k] = D[LIMB[k]].getWorldPosition(new THREE.Vector3()).sub(D[k].getWorldPosition(new THREE.Vector3())).normalize();
  const sHip0 = S.Hips.position.clone(), dHip0 = D.Hips.position.clone();
  const mixer = new THREE.AnimationMixer(srcScene); const act = mixer.clipAction(clip); act.play();
  const n = Math.max(2, Math.round(clip.duration * 30) + 1), times = new Float32Array(n);
  const vals = {}; names.forEach(k => vals[k] = new Float32Array(n * 4)); const hip = new Float32Array(n * 3);
  // hedef kemikleri ebeveyn sırasına göre (kök önce)
  const depth = o => { let d = 0; while (o.parent) { d++; o = o.parent; } return d; };
  const order = names.slice().sort((a, b) => depth(D[a]) - depth(D[b]));
  for (let i = 0; i < n; i++) {
    const t = Math.min(clip.duration, i / 30); times[i] = t;
    act.time = t; mixer.update(0); srcScene.updateMatrixWorld(true);
    for (const k of order) {
      const ws = wq(S[k]);
      let wt;
      const ch = LIMB[k];
      if (ch && S[ch] && D[ch]) {
        // uzuv: hedef kemik yönünü kaynağın canlı yönüne hizala (dinlenme pozu farkından bağımsız)
        const sp = S[k].getWorldPosition(new THREE.Vector3()), sc = S[ch].getWorldPosition(new THREE.Vector3());
        const dirS = sc.sub(sp).normalize();
        const twist = ws.clone().multiply(sRest[k].clone().invert()); // kaynak toplam dönüş
        // hedefin dinlenme yönü
        const dirT0 = dRestDir[k].clone();
        // önce delta yöntemi, sonra yön düzeltmesi
        wt = twist.multiply(dRest[k].clone());
        const dirT = dirT0.clone().applyQuaternion(dRest[k].clone().invert()).applyQuaternion(wt);
        wt.premultiply(new THREE.Quaternion().setFromUnitVectors(dirT, dirS));
      } else wt = ws.multiply(sRest[k].clone().invert()).multiply(dRest[k]);
      const pw = D[k].parent.getWorldQuaternion(new THREE.Quaternion());
      D[k].quaternion.copy(pw.invert().multiply(wt));
      D[k].updateMatrixWorld(true);
      D[k].quaternion.toArray(vals[k], i * 4);
    }
    const hp = S.Hips.position;
    hip[i * 3] = dHip0.x; hip[i * 3 + 1] = dHip0.y + (hp.y - sHip0.y) * hipScale; hip[i * 3 + 2] = dHip0.z;
  }
  for (const k of names) D[k].quaternion.copy(dLocalRest[k]);
  const tracks = names.map(k => new THREE.QuaternionKeyframeTrack(dPre(dstPrefix) + k + '.quaternion', times, vals[k]));
  if (keepHip) tracks.push(new THREE.VectorKeyframeTrack(dPre(dstPrefix) + 'Hips.position', times, hip));
  mixer.stopAllAction();
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}
const dPre = p => p;
const LIMB = { LeftArm: 'LeftForeArm', LeftForeArm: 'LeftHand', RightArm: 'RightForeArm', RightForeArm: 'RightHand', LeftUpLeg: 'LeftLeg', LeftLeg: 'LeftFoot', RightUpLeg: 'RightLeg', RightLeg: 'RightFoot', LeftShoulder: 'LeftArm', RightShoulder: 'RightArm', LeftHand: 'LeftHandMiddle1', RightHand: 'RightHandMiddle1' };

export async function loadAssets() {
  const [rpm, xbot, mich] = await Promise.all([load('/assets/readyplayer.me.glb'), load('/assets/Xbot.glb'), load('/assets/ece_mpfb.glb')]);
  assets.rpm = rpm; assets.mich = mich;
  let eh = 1; mich.scene.updateMatrixWorld(true); mich.scene.traverse(o => { if (o.isBone && o.name === 'Hips') eh = o.getWorldPosition(new THREE.Vector3()).y; });
  const names = []; mich.scene.traverse(o => { if (o.isMesh) names.push(o.name); if (o.isBone && /Hips|Head$/.test(o.name)) names.push('B:' + o.name); }); console.log('ece', eh.toFixed(3), names.join(','));
  assets.clips = {}; assets.mclips = {};
  const hipScale = 1.0192 / 104;
  for (const c of xbot.animations) {
    assets.clips[c.name] = bake(xbot.scene, c, rpm.scene, 'mixamorig', '', hipScale, true);
    assets.mclips[c.name] = bake(xbot.scene, c, mich.scene, 'mixamorig', '', eh / 104, true);
  }
  assets.hairGeo = buildHairGeo(rpm.scene);
}

// Kafa mesh'inden saç kabuğu üret (Head kemiği uzayında)
function buildHairGeo(scene) {
  let head; scene.traverse(o => { if (o.name === 'Wolf3D_Head') head = o; });
  const sk = head.skeleton, hi = sk.bones.findIndex(b => b.name === 'Head');
  const toBone = sk.boneInverses[hi].clone().multiply(head.bindMatrix);
  const base = new THREE.BufferGeometry(); base.setAttribute('position', head.geometry.attributes.position.clone()); base.setIndex(head.geometry.index.clone());
  const g = mergeVertices(base, 1e-4); g.computeVertexNormals();
  const P = g.attributes.position, N = g.attributes.normal, I = g.index;
  const thr = (x, z) => { const ax = Math.abs(x);
    let t = z > .075 ? 1.79 : z > .03 ? lerp(1.76, 1.79, (z - .03) / .045) : z > -.03 ? lerp(1.715, 1.755, (z + .03) / .06) : z > -.075 ? lerp(1.625, 1.715, (z + .075) / .045) : 1.62;
    if (ax > .088 && z > -.03 && z < .06) t = Math.max(t, 1.74);
    if (z > .04) t += .014 * smooth(.03, .075, ax); // şakaklar
    return t; };
  const noise = (x, y, z) => Math.sin(x * 160 + Math.sin(z * 90) * 2) * Math.sin(z * 130 + y * 70) * .5 + .5;
  const pos = new Float32Array(P.count * 3), v = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) {
    v.fromBufferAttribute(P, i); n.fromBufferAttribute(N, i);
    const top = clamp((v.y - 1.73) / .09);
    const d = .005 + .02 * top * (.6 + .4 * noise(v.x, v.y, v.z)) + (v.z > .04 ? .01 * top : 0);
    v.addScaledVector(n, d); v.toArray(pos, i * 3);
  }
  const idx = [];
  for (let i = 0; i < I.count; i += 3) {
    let ok = false; for (let k = 0; k < 3; k++) { const j = I.getX(i + k); if (P.getY(j) > thr(P.getX(j), P.getZ(j)) - .01) ok = true; }
    if (ok || DBG) idx.push(I.getX(i), I.getX(i + 1), I.getX(i + 2));
  }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setIndex(idx);
  const uv = new Float32Array(P.count * 2); for (let i = 0; i < P.count; i++) { uv[i * 2] = Math.atan2(P.getX(i), P.getZ(i)) / Math.PI * .5 + .5; uv[i * 2 + 1] = P.getY(i) * 5; }
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const hy = new Float32Array(P.count); for (let i = 0; i < P.count; i++) hy[i] = (P.getY(i) - thr(P.getX(i), P.getZ(i))) * 100;
  out.setAttribute('hy', new THREE.BufferAttribute(hy, 1));
  out.computeVertexNormals();
  out.setAttribute('skinIndex', new THREE.BufferAttribute(new Uint16Array(P.count * 4).map((_, k) => k % 4 === 0 ? hi : 0), 4));
  out.setAttribute('skinWeight', new THREE.BufferAttribute(new Float32Array(P.count * 4).map((_, k) => k % 4 === 0 ? 1 : 0), 4));
  return out;
}
function knitTexture() {
  if (assets.knit) return assets.knit;
  const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#bdbdbd'; g.fillRect(0, 0, 64, 64);
  for (let x = 0; x < 64; x += 8) for (let y = 0; y < 64; y += 6) { g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(x + 2, y + 3, 1.8, 3, .5, 0, 7); g.fill(); g.beginPath(); g.ellipse(x + 6, y + 3, 1.8, 3, -.5, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(8, 2); t.colorSpace = THREE.SRGBColorSpace; return assets.knit = t;
}
function hairTexture(base = '#1a120d') {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d'); const r = rng(11);
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1400; i++) { const x = r() * 256, y = r() * 256, l = 20 + r() * 50; g.strokeStyle = `rgba(${r() < .5 ? '0,0,0' : '255,255,255'},${.15 + r() * .3})`; g.lineWidth = .6 + r(); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + (r() - .5) * 20, y + l / 2, x + (r() - .5) * 12, y + l); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 1); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------- KARAKTER: "Deniz" ----------
// Tek kimlik (yüz, saç, ten, sakal) korunur; versiyonlar kıyafet/aksesuar/yaşla ayrışır.
const BONES = ['Hips','Spine','Spine1','Spine2','Neck','Head','LeftShoulder','LeftArm','LeftForeArm','LeftHand','RightShoulder','RightArm','RightForeArm','RightHand','LeftUpLeg','LeftLeg','LeftFoot','RightUpLeg','RightLeg','RightFoot'];
export class Person {
  constructor(opts = {}) {
    this.opts = opts;
    const female = !!opts.female;
    const src = female ? assets.mich.scene : assets.rpm.scene;
    this.root = new THREE.Group();
    this.model = SkeletonUtils.clone(src);
    this.root.add(this.model);
    this.bones = {}; this.morphMeshes = [];
    this.model.traverse(o => {
      if (o.isBone) this.bones[o.name.replace('mixamorig', '')] = o;
      if (o.isMesh) {
        o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
        o.material = o.material.clone();
        if (o.morphTargetDictionary) this.morphMeshes.push(o);
        this.style(o);
      }
    });
    this.mixer = new THREE.AnimationMixer(this.model);
    const clips = female ? assets.mclips : assets.clips;
    this.actions = {};
    for (const k in clips) { const a = this.mixer.clipAction(clips[k]); a.play(); a.setEffectiveWeight(0); this.actions[k] = a; }
    this.accessories(opts);
    this.rest = {}; for (const b of BONES) if (this.bones[b]) this.rest[b] = this.bones[b].quaternion.clone();
  }
  style(o) {
    const m = o.material, n = o.name, op = this.opts;
    m.envMapIntensity = 0.8;
    if (op.female) { m.envMapIntensity = .5; if (op.top && /casualsuit/.test(n)) this.recolor(m, op.top, .85); return; }
    if (n === 'Wolf3D_Outfit_Bottom' && op.bottom) { m.map = null; m.color = new THREE.Color(op.bottom); m.roughness = .9; }
    if (n === 'Wolf3D_Outfit_Footwear' && op.shoes) { m.map = null; m.color = new THREE.Color(op.shoes); }
    // Ana kimlik: modern genç adam — şapkasız, bıyıksız, koyu mont
    if (n === 'Wolf3D_Headwear') o.visible = !!op.headwear;
    if (n === 'Wolf3D_Beard') o.visible = !!op.beard;
    if (n === 'Wolf3D_Outfit_Top') { this.recolor(m, op.top || '#3a3f48', op.topRough ?? .8); }
    if (n === 'Wolf3D_Head' || n === 'Wolf3D_Body') { m.color = new THREE.Color(op.skin || '#f3d9c6'); }
    if (n === 'Wolf3D_Outfit_Bottom' && !op.bottom) { m.map = null; m.color = new THREE.Color('#2c3442'); m.roughness = .9; }
    if (n === 'Wolf3D_Outfit_Footwear' && !op.shoes) { m.map = null; m.color = new THREE.Color('#4a4842'); m.roughness = .6; }
    if ((n === 'Wolf3D_Beard' || n === 'Wolf3D_Headwear') && op.grey) { m.color = new THREE.Color(op.grey === true ? '#d9d6d0' : op.grey).multiplyScalar(2.2); }
    if (op.ghost) { m.transparent = true; m.opacity = op.ghost; m.depthWrite = op.ghost > .9; }
    if (op.emissive) { m.emissive = new THREE.Color(op.emissive); m.emissiveIntensity = op.emissiveI ?? .25; }
  }
  // Dokuyu gri tonlayıp yeni renkle çarp (kumaş detayı korunur)
  recolor(m, col, rough) {
    m.color = new THREE.Color(col).multiplyScalar(1.9); m.roughness = rough;
    m.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#ifdef USE_MAP
      vec4 sampledDiffuseColor = texture2D( map, vMapUv ); float lum = dot(sampledDiffuseColor.rgb, vec3(.3,.59,.11));
      diffuseColor.rgb *= vec3(pow(lum, 1.25));
#endif
`); };
    m.customProgramCacheKey = () => 'recolor';
  }
  accessories(op) {
    const b = this.bones, add = (bone, mesh, p, r) => { mesh.position.set(...p); if (r) mesh.rotation.set(...r); mesh.traverse(x => { if (x.isMesh) { x.castShadow = true; } }); b[bone].add(mesh); return mesh; };
    const mat = (c, r = .7, mt = 0, e) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: mt, emissive: e || 0x000000 });
    // Not: RPM kemik uzayı metre cinsinden; Mixamo kemik uzayı santim (x100)
    if (!op.female) {
      const hm = new THREE.MeshStandardMaterial({ color: op.hair || (op.grey ? '#b9b5ae' : '#2a1d15'), roughness: .55, map: hairTexture() });
      if (op.ghost) { hm.transparent = true; hm.opacity = op.ghost; }
      hm.onBeforeCompile = sh => {
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float hy; varying float vHy; varying vec2 vHuv;').replace('#include <uv_vertex>', '#include <uv_vertex>\nvHy = hy; vHuv = uv;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vHy; varying vec2 vHuv;').replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nfloat hEdge = vHy + sin(vHuv.x*170.+sin(vHuv.x*41.)*2.)*.22 + sin(vHuv.x*61.)*.25; if (hEdge < -0.6) discard;').replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.a = smoothstep(-0.6, 0.5, hEdge);');
      };
      hm.customProgramCacheKey = () => 'hair'; hm.alphaToCoverage = true;
      if (op.emissive) { hm.emissive = new THREE.Color(op.emissive); hm.emissiveIntensity = (op.emissiveI ?? .25); }
      let hm0; this.model.traverse(o => { if (o.name === 'Wolf3D_Head') hm0 = o; });
      const hair = new THREE.SkinnedMesh(assets.hairGeo, hm); hair.castShadow = true; hair.frustumCulled = false;
      hm0.parent.add(hair); hair.bind(hm0.skeleton, hm0.bindMatrix); this.hair = hair;
    }
    if (op.phone) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(.074, .155, .009), mat(0x0d0d10, .25, .7)); g.add(body);
      this.screenCanvas = document.createElement('canvas'); this.screenCanvas.width = 512; this.screenCanvas.height = 1072;
      this.screenTex = new THREE.CanvasTexture(this.screenCanvas); this.screenTex.colorSpace = THREE.SRGBColorSpace; this.screenTex.anisotropy = 4;
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(.068, .1424), new THREE.MeshBasicMaterial({ map: this.screenTex, toneMapped: false }));
      scr.position.z = .0047; g.add(scr); this.phoneScreen = scr;
      this.phone = g; this.root.add(g);
      this.phoneLight = new THREE.PointLight(0xbcd2ff, .6, 1.2, 2); this.root.add(this.phoneLight);
    }
    if (op.backpack) {
      const g = new THREE.Group();
      const bag = new THREE.Mesh(new THREE.BoxGeometry(.32, .42, .16, 2, 2, 2), mat(op.backpack, .9)); g.add(bag);
      const pocket = new THREE.Mesh(new THREE.BoxGeometry(.24, .16, .06), mat(new THREE.Color(op.backpack).multiplyScalar(.7), .9)); pocket.position.set(0, -.08, -.1); g.add(pocket);
      const roll = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, .36, 12), mat(0x6b5a3a, .9)); roll.rotation.z = Math.PI / 2; roll.position.set(0, .26, 0); g.add(roll);
      add('Spine2', g, [0, -.06, -.2]);
    }
    if (op.hat) {
      const g = new THREE.Group();
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(.19, .19, .012, 28), mat(op.hat, .9)); g.add(brim);
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(.095, .11, .11, 24), mat(op.hat, .9)); crown.position.y = .06; g.add(crown);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(.111, .111, .025, 24), mat(0x2a1a10, .8)); band.position.y = .02; g.add(band);
      add('Head', g, [0, .19, .0], [-.08, 0, 0]);
    }
    if (op.chefHat) {
      const g = new THREE.Group();
      const band = new THREE.Mesh(new THREE.CylinderGeometry(.105, .105, .08, 24), mat(0xcfccc6, .8)); g.add(band);
      const puff = new THREE.Mesh(new THREE.SphereGeometry(.14, 20, 14), mat(0xcfccc6, .8)); puff.scale.set(1, .8, 1); puff.position.y = .13; g.add(puff);
      add('Head', g, [0, .19, -.01], [-.1, 0, 0]);
    }
    if (op.glasses) {
      const g = new THREE.Group(); const fm = mat(0x111111, .3, .5);
      for (const s of [-1, 1]) { const r = new THREE.Mesh(new THREE.TorusGeometry(.025, .004, 8, 24), fm); r.position.x = s * .033; g.add(r); }
      const br = new THREE.Mesh(new THREE.BoxGeometry(.018, .004, .004), fm); g.add(br);
      add('Head', g, [0, .085, .095]);
    }
    if (op.tie) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(.05, .3, .01), mat(op.tie, .5)); add('Spine2', t, [0, .02, .145], [-.15, 0, 0]);
    }
    const scarf = op.female ? null : (op.scarf === undefined ? '#5a2830' : op.scarf);
    if (scarf) {
      const g = new THREE.Group(); const sm = mat(scarf, .95); sm.bumpMap = knitTexture(); sm.bumpScale = 1.5; sm.map = sm.bumpMap;
      const knit = new THREE.Mesh(new THREE.TorusGeometry(.078, .026, 12, 32), sm); knit.rotation.x = Math.PI / 2; knit.scale.set(1.0, 1.1, 1.3); g.add(knit);
      const knit2 = new THREE.Mesh(new THREE.TorusGeometry(.085, .022, 12, 32), sm); knit2.rotation.x = Math.PI / 2 + .3; knit2.position.y = -.03; knit2.scale.set(1.08, 1.15, 1.2); g.add(knit2);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(.07, .3, .02, 1, 4, 1), sm); tail.position.set(.035, -.19, .1); tail.rotation.set(-.12, 0, .06); g.add(tail);
      const tail2 = new THREE.Mesh(new THREE.BoxGeometry(.065, .22, .02), sm); tail2.position.set(-.03, -.16, .11); tail2.rotation.set(-.15, 0, -.1); g.add(tail2);
      add('Neck', g, [0, .045, .03]);
    }
    if (op.coat) {
      const pts = []; for (let i = 0; i <= 10; i++) pts.push(new THREE.Vector2(.19 + i * .012, -i * .06));
      const c = new THREE.Mesh(new THREE.LatheGeometry(pts, 28, Math.PI * .62, Math.PI * 1.76), mat(op.coat, .85)); c.material.side = THREE.DoubleSide;
      add('Hips', c, [0, .12, 0]);
    }
    if (op.camera) {
      const g = new THREE.Group(); const cb = new THREE.Mesh(new THREE.BoxGeometry(.13, .08, .06), mat(0x1a1a1a, .4, .3)); g.add(cb);
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .06, 16), mat(0x0a0a0a, .2, .6)); lens.rotation.x = Math.PI / 2; lens.position.z = .05; g.add(lens);
      add('Spine2', g, [0, -.12, .17]);
    }
    if (op.brush) {
      const br = new THREE.Mesh(new THREE.CylinderGeometry(.006, .004, .22, 8), mat(0x8a5a2a)); add('RightHand', br, [0, .1, .03], [0, 0, 0]);
    }
    if (op.book) {
      const bk = new THREE.Mesh(new THREE.BoxGeometry(.16, .22, .03), mat(op.book, .8)); add('LeftHand', bk, [0, .12, .04], [0, 0, 0]);
    }
    if (op.flower) {
      const g = new THREE.Group(); const st = new THREE.Mesh(new THREE.CylinderGeometry(.003, .003, .2, 6), mat(0x2f6b2a)); g.add(st);
      const fl = new THREE.Mesh(new THREE.SphereGeometry(.03, 10, 8), mat(op.flower, .6, 0, new THREE.Color(op.flower).multiplyScalar(.2))); fl.position.y = .11; g.add(fl);
      add('RightHand', g, [0, .09, .03]);
    }
  }
  // Animasyon karışımı: pose({walk:[time,weight], idle:[t,w]})
  pose(spec) {
    for (const k in this.actions) this.actions[k].setEffectiveWeight(0);
    for (const k in spec) { const [t, w] = spec[k]; const a = this.actions[k]; a.time = t % a.getClip().duration; a.setEffectiveWeight(w ?? 1); }
    this.mixer.update(0);
    return this;
  }
  // Kemik ofseti (yerel uzayda, animasyonun üstüne)
  rot(bone, x = 0, y = 0, z = 0, w = 1) {
    const b = this.bones[bone]; if (!b) return this;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(x * w, y * w, z * w, 'XYZ'));
    b.quaternion.multiply(q); return this;
  }
  // Kafayı dünya noktasına çevir (ağırlıklı)
  lookAt(target, w = 1) {
    const head = this.bones.Head; if (!head || w <= 0) return this;
    this.root.updateMatrixWorld(true);
    const hp = new THREE.Vector3(); head.getWorldPosition(hp);
    const dir = target.clone().sub(hp).normalize();
    const parentQ = new THREE.Quaternion(); head.parent.getWorldQuaternion(parentQ);
    const cur = new THREE.Quaternion(); head.getWorldQuaternion(cur);
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(cur);
    const delta = new THREE.Quaternion().setFromUnitVectors(fwd, dir);
    const want = delta.multiply(cur);
    const local = parentQ.clone().invert().multiply(want);
    head.quaternion.slerp(local, w);
    return this;
  }
  // kemiği dünya yönüne hizala (child yönü -> dir), ağırlıklı
  aim(bone, child, dir, w = 1) {
    const b = this.bones[bone], c = this.bones[child]; if (!b || !c || w <= 0) return this;
    this.root.updateMatrixWorld(true);
    const bp = b.getWorldPosition(new THREE.Vector3()), cp = c.getWorldPosition(new THREE.Vector3());
    const cur = cp.sub(bp).normalize();
    const d = new THREE.Quaternion().setFromUnitVectors(cur, dir.clone().normalize());
    const wq = b.getWorldQuaternion(new THREE.Quaternion());
    const want = d.multiply(wq);
    const pq = b.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
    b.quaternion.slerp(pq.multiply(want), w); b.updateMatrixWorld(true);
    return this;
  }
  // iki kemikli IK: el hedefe, dirsek pole yönüne
  ik(side, target, pole, w = 1) {
    const A = this.bones[side + 'Arm'], B = this.bones[side + 'ForeArm'], C = this.bones[side + 'Hand']; if (!A || w <= 0) return this;
    this.root.updateMatrixWorld(true);
    const a = A.getWorldPosition(new THREE.Vector3()), b = B.getWorldPosition(new THREE.Vector3()), c = C.getWorldPosition(new THREE.Vector3());
    const l1 = a.distanceTo(b), l2 = b.distanceTo(c);
    const t = target.clone(); const toT = t.clone().sub(a); let d = toT.length(); d = Math.min(d, (l1 + l2) * .999); toT.setLength(d);
    const cosA = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1), ang = Math.acos(cosA);
    const axisDir = toT.clone().normalize();
    const pl = pole.clone().sub(axisDir.clone().multiplyScalar(pole.dot(axisDir))).normalize();
    const elbow = a.clone().add(axisDir.clone().multiplyScalar(Math.cos(ang) * l1)).add(pl.multiplyScalar(Math.sin(ang) * l1));
    this.aim(side + 'Arm', side + 'ForeArm', elbow.clone().sub(a), w);
    const b2 = B.getWorldPosition(new THREE.Vector3());
    this.aim(side + 'ForeArm', side + 'Hand', a.clone().add(toT).sub(b2), w);
    return this;
  }
  // telefonu sağ ele yerleştir, ekranı yüze çevir
  holdPhone(raise = 1, lean = 0) {
    this.root.updateMatrixWorld(true);
    const head = this.bones.Head.getWorldPosition(new THREE.Vector3());
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(this.root.getWorldQuaternion(new THREE.Quaternion()));
    const right = new THREE.Vector3(-1, 0, 0).applyQuaternion(this.root.getWorldQuaternion(new THREE.Quaternion()));
    const tgt = head.clone().add(fwd.clone().multiplyScalar(.30)).add(new THREE.Vector3(0, -.36 + raise * .06, 0)).add(right.clone().multiplyScalar(.03 + lean));
    const pole = right.clone().multiplyScalar(.6).add(new THREE.Vector3(0, -1, 0)).add(fwd.clone().multiplyScalar(-.3));
    this.ik('Right', tgt, pole, 1);
    // el: avuç yukarı, parmaklar ileri
    this.aim('RightHand', 'RightHandMiddle1', fwd.clone().add(new THREE.Vector3(0, .35, 0)).add(right.clone().multiplyScalar(-.45)), 1);
    this.root.updateMatrixWorld(true);
    const hp = this.bones.RightHand.getWorldPosition(new THREE.Vector3());
    const mp = this.bones.RightHandMiddle1.getWorldPosition(new THREE.Vector3());
    const pp = hp.clone().lerp(mp, .7).add(new THREE.Vector3(0, .02, 0)).add(right.clone().multiplyScalar(-.02));
    const inv = this.root.matrixWorld.clone().invert();
    this.phone.position.copy(pp.clone().applyMatrix4(inv));
    const eye = head.clone().add(new THREE.Vector3(0, .07, .08));
    const m = new THREE.Matrix4().lookAt(eye, pp, new THREE.Vector3(0, 1, 0));
    const wq = new THREE.Quaternion().setFromRotationMatrix(m);
    const rq = this.root.getWorldQuaternion(new THREE.Quaternion()).invert();
    this.phone.quaternion.copy(rq.multiply(wq)); this.phone.rotateX(0); 
    this.phoneLight.position.copy(this.phone.position).add(new THREE.Vector3(0, .05, .06).applyQuaternion(this.phone.quaternion));
    return this;
  }
  morph(name, v) { for (const m of this.morphMeshes) { const i = m.morphTargetDictionary[name]; if (i !== undefined) m.morphTargetInfluences[i] = v; } return this; }
}

// ---------- post-prodüksiyon ----------
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2() },
    uVignette: { value: .35 }, uGrain: { value: .05 }, uCA: { value: .0015 }, uSat: { value: 1 }, uContrast: { value: 1.05 },
    uTint: { value: new THREE.Vector3(1, 1, 1) }, uLift: { value: new THREE.Vector3(0, 0, 0) }, uFade: { value: 0 }, uFlash: { value: 0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime,uVignette,uGrain,uCA,uSat,uContrast,uFade,uFlash; uniform vec2 uRes; uniform vec3 uTint,uLift; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233))+uTime*7.13)*43758.5453); }
    void main(){
      vec2 c=vUv-.5; float r=length(c*vec2(uRes.x/uRes.y,1.));
      vec2 off=c*uCA*(1.+r*2.);
      vec3 col=vec3(texture2D(tDiffuse,vUv+off).r, texture2D(tDiffuse,vUv).g, texture2D(tDiffuse,vUv-off).b);
      float l=dot(col,vec3(.2126,.7152,.0722));
      col=mix(vec3(l),col,uSat);
      col=(col-.5)*uContrast+.5;
      col=col*uTint+uLift*(1.-col);
      col*=1.-uVignette*smoothstep(.25,.95,r);
      col+=(h(vUv*uRes)-.5)*uGrain;
      col=mix(col,vec3(1.),uFlash);
      col*=1.-uFade;
      gl_FragColor=vec4(clamp(col,0.,1.),1.);
    }`,
};

export let renderer, composer, grade, bloom, W, H;
export async function boot(mod, w, h) {
  W = w; H = h;
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1); renderer.setSize(W, H);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);
  await loadAssets();
  const pm = new THREE.PMREMGenerator(renderer);
  assets.envTex = pm.fromScene(new RoomEnvironment(), .04).texture;
  const ctx = await mod.setup({ THREE, W, H });
  const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4, stencilBuffer: true });
  composer = new EffectComposer(renderer, rt);
  const rp = ctx.pass || new RenderPass(ctx.scene, ctx.camera); composer.addPass(rp);
  bloom = new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), .4, .45, 1.15); composer.addPass(bloom);
  composer.addPass(new OutputPass());
  grade = new ShaderPass(GradeShader); grade.uniforms.uRes.value.set(W, H); composer.addPass(grade);
  window.FRAMES = mod.FRAMES;
  window.renderFrame = (f, type = 'image/jpeg') => {
    const t = f / FPS;
    grade.uniforms.uTime.value = (f % 97) * .37;
    const r = mod.frame(t, f, { grade: grade.uniforms, bloom, rp }) || {};
    if (r.scene) rp.scene = r.scene; if (r.camera) rp.camera = r.camera;
    composer.render();
    if (mod.overlay) mod.overlay(t, f);
    const url = renderer.domElement.toDataURL(type, .93);
    return url.slice(url.indexOf(',') + 1);
  };
}

// ---------- ortak yardımcılar ----------
// Gradyan gökyüzü / nebula kubbesi
export function skyDome(top, mid, bottom, opts = {}) {
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { cTop: { value: new THREE.Color(top) }, cMid: { value: new THREE.Color(mid) }, cBot: { value: new THREE.Color(bottom) }, uStars: { value: opts.stars ?? 0 }, uNeb: { value: opts.nebula ?? 0 }, uSeed: { value: opts.seed ?? 1 }, uNebC: { value: new THREE.Color(opts.nebColor || '#6a2cff') }, uNebC2: { value: new THREE.Color(opts.nebColor2 || '#ff4fa3') } },
    vertexShader: `varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); gl_Position.z=gl_Position.w; }`,
    fragmentShader: `uniform vec3 cTop,cMid,cBot,uNebC,uNebC2; uniform float uStars,uNeb,uSeed; varying vec3 vP;
      float hash(vec3 p){ p=fract(p*.3183099+.1+uSeed); p*=17.; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
      float noise(vec3 x){ vec3 i=floor(x),f=fract(x); f=f*f*(3.-2.*f);
        return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z); }
      float fbm(vec3 p){ float v=0.,a=.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.03; a*=.5; } return v; }
      void main(){ float y=vP.y; vec3 c= y>0. ? mix(cMid,cTop,pow(y,.6)) : mix(cMid,cBot,pow(-y,.5));
        if(uNeb>0.){ float n=fbm(vP*2.5); float n2=fbm(vP*5.+3.); c+=uNebC*pow(n,3.)*uNeb*2.2 + uNebC2*pow(n2,4.)*uNeb*1.8; }
        if(uStars>0.){ vec3 q=vP*380.; vec3 id=floor(q); float s=hash(id); float d=length(fract(q)-.5);
          c+=vec3(.9,.95,1.)*step(.985,s)*smoothstep(.35,.0,d)*uStars*(.4+.6*hash(id+7.)); }
        gl_FragColor=vec4(c,1.); }`,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(opts.r || 900, 48, 24), m);
}

// Pencereleri parlayan bina dokusu
export function windowTexture(seed, warm = true, w = 64, h = 256, lit = .45) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); const r = rng(seed);
  g.fillStyle = '#05060a'; g.fillRect(0, 0, w, h);
  const cw = 8, ch = 10;
  for (let y = 2; y < h - ch; y += ch) for (let x = 2; x < w - cw; x += cw) {
    if (r() < lit) { const k = r(); g.fillStyle = warm ? `hsl(${30 + k * 20},${70 + k * 20}%,${45 + r() * 30}%)` : `hsl(${190 + k * 30},60%,${50 + r() * 25}%)`; g.fillRect(x, y, cw - 3, ch - 4); }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; return t;
}

// Şehir bloğu (instanced). center, radius, count, height range
export function cityBlock({ seed = 1, count = 120, area = 80, hmin = 6, hmax = 60, warm = true, avoid = 6, emissive = 1.6, base = 0x0b0d14 } = {}) {
  const g = new THREE.Group(); const r = rng(seed);
  const texs = [0, 1, 2, 3].map(i => windowTexture(seed * 10 + i, warm));
  const mats = texs.map(t => new THREE.MeshStandardMaterial({ color: base, roughness: .8, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: emissive }));
  for (let i = 0; i < count; i++) {
    let x, z; do { x = (r() - .5) * area; z = (r() - .5) * area; } while (Math.abs(x) < avoid && Math.abs(z) < avoid);
    const w = 3 + r() * 7, d = 3 + r() * 7, hh = hmin + Math.pow(r(), 2) * (hmax - hmin);
    const geo = new THREE.BoxGeometry(w, hh, d);
    const uv = geo.attributes.uv; for (let k = 0; k < uv.count; k++) { uv.setXY(k, uv.getX(k) * Math.max(1, Math.round(w / 4)), uv.getY(k) * Math.max(1, Math.round(hh / 16))); }
    texs.forEach(t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; });
    const m = new THREE.Mesh(geo, mats[i % 4]); m.position.set(x, hh / 2, z); g.add(m);
  }
  return g;
}

export function glowSprite(color = '#ffffff', size = 1) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  s.scale.setScalar(size); return s;
}
export function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.3, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
}
// Toz / yüzen parçacıklar
export function dust(n, spread, color = '#ffffff', size = .05, seed = 3, opacity = .8) {
  const r = rng(seed); const p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { p[i * 3] = (r() - .5) * spread[0]; p[i * 3 + 1] = (r() - .5) * spread[1]; p[i * 3 + 2] = (r() - .5) * spread[2]; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ color, size, map: glowTexture(), transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
}
