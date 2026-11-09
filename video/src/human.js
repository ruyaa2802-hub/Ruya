// Prosedürel, gerçekçi oranlı insan modeli (Arda, Emre, bebek ve kalabalık)
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const sm = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
const g3 = (dx, dy, dz, s) => Math.exp(-(dx * dx + dy * dy + dz * dz) / (2 * s * s));
const lerp = (a, b, k) => a + (b - a) * k;
function hash3(x, y, z) { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z); const fx = x - ix, fy = y - iy, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  let r = 0;
  for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let c = 0; c < 2; c++)
    r += hash3(ix + a, iy + b, iz + c) * (a ? u : 1 - u) * (b ? v : 1 - v) * (c ? w : 1 - w);
  return r;
}

// ---------- yüz biçimi (birim küre üzerinde) ----------
// p: { child 0..1, jaw, nose, cheek, brow, lip }
function faceDisp(x, y, z, p) {
  const ax = Math.abs(x), F = 1 - 0.45 * p.child; // çocukta yüz hatları yumuşak
  let d = 0;
  d -= 0.06 * F * g3(ax - 0.34, y - 0.07, z - 0.86, 0.12);                                   // göz çukuru
  d += 0.04 * p.brow * F * Math.exp(-((y - 0.22) ** 2) / (2 * 0.05 ** 2)) * sm(0.55, 0.95, z) * (1 - sm(0.45, 0.68, ax)); // kaş kemeri
  d += p.nose * F * (0.18 * g3(x, y + 0.27, z - 0.98, 0.07) + 0.07 * Math.exp(-(x * x) / (2 * 0.05 ** 2)) * sm(-0.3, -0.15, y) * (1 - sm(0.05, 0.18, y)) * sm(0.8, 1, z)); // burun
  d += 0.05 * p.nose * F * g3(ax - 0.095, y + 0.31, z - 0.93, 0.045);                          // burun kanatları
  d -= 0.02 * F * g3(ax - 0.15, y + 0.36, z - 0.92, 0.04);                                     // nazolabial
  d += 0.05 * p.cheek * g3(ax - 0.5, y + 0.1, z - 0.72, 0.17);                                 // elmacık
  d += 0.06 * p.child * g3(ax - 0.42, y + 0.32, z - 0.78, 0.2);                                // çocuk yanak
  d += 0.032 * p.lip * g3(x * 0.55, y + 0.5, z - 0.93, 0.035);                                 // üst dudak
  d += 0.038 * p.lip * g3(x * 0.6, y + 0.615, z - 0.9, 0.04);                                  // alt dudak
  d -= 0.022 * g3(x * 0.5, y + 0.556, z - 0.93, 0.016);                                        // ağız çizgisi
  d -= 0.02 * F * g3(x, y + 0.72, z - 0.86, 0.04);                                             // çene çukuru
  d += 0.06 * F * g3(x * 0.8, y + 0.88, z - 0.5, 0.16);                                        // çene
  d -= 0.03 * g3(ax - 0.76, y - 0.15, z - 0.3, 0.2);                                           // şakak
  return d;
}
function shapeHead(v, p, faceOn = true) {
  let { x, y, z } = v;
  const d = faceOn ? faceDisp(x, y, z, p) : 0;
  const r = 1 + d; x *= r; y *= r; z *= r;
  const jy = sm(0.12, 0.95, -y);
  x *= lerp(1, lerp(p.jaw, 0.92, p.child), jy); z *= lerp(1, 0.94, jy);
  if (z < 0) z *= 1.08 + 0.05 * p.child;
  x *= lerp(0.76, 0.84, p.child); z *= lerp(0.87, 0.9, p.child); y *= lerp(1, 0.94, p.child);
  if (y > 0.2) { const k = (y - 0.2); y += k * 0.08 * p.child; x *= 1 + k * 0.08 * p.child; }
  return new THREE.Vector3(x, y, z);
}
const HEAD_SEG = [150, 110];
function headGeometry(p, skinRGB) {
  const g = new THREE.SphereGeometry(1, HEAD_SEG[0], HEAD_SEG[1]);
  g.rotateX(0); const pos = g.attributes.position; const col = new Float32Array(pos.count * 3);
  const base = new THREE.Color(skinRGB), lip = new THREE.Color(0xa8504c), blush = new THREE.Color(0xd77a6a), shadow = new THREE.Color(0x8a5a45);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    // Küre: varsayılan kutup y ekseninde, yüz +z
    const v = new THREE.Vector3().fromBufferAttribute(pos, i);
    const s = shapeHead(v, p);
    pos.setXYZ(i, s.x, s.y, s.z);
    const ax = Math.abs(v.x);
    c.copy(base);
    c.lerp(lip, Math.min(1, 1.5 * (g3(v.x * 0.55, v.y + 0.5, v.z - 0.93, 0.03) + g3(v.x * 0.6, v.y + 0.615, v.z - 0.9, 0.035))) * 0.9);
    c.lerp(blush, 0.28 * g3(ax - 0.45, v.y + 0.22, v.z - 0.8, 0.15) * (1 + p.child));
    c.lerp(shadow, 0.35 * g3(ax - 0.34, v.y - 0.1, v.z - 0.84, 0.08));
    c.lerp(blush, 0.15 * g3(v.x, v.y + 0.27, v.z - 0.98, 0.07));
    c.multiplyScalar(0.96 + 0.08 * vnoise(v.x * 40, v.y * 40, v.z * 40));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

// saç: aynı kafa biçimi, dışa ofset + maske (alphaHash ile yumuşak saç çizgisi)
function hairGeometry(p, style) {
  const g = new THREE.SphereGeometry(1, 120, 90); const pos = g.attributes.position; const col = new Float32Array(pos.count * 4);
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(pos, i);
    const { x, y, z } = v; const ax = Math.abs(x);
    // saç çizgisi: alında yukarıda, yanlarda kulak üstü, arkada ense
    const front = (style === 'messy' ? 0.4 - 0.07 * vnoise(x * 9, 1, z * 9) : 0.47) + 0.12 * ax;
    let m = z > 0.3 ? sm(front - 0.04, front + 0.04, y) : 1;
    const side = sm(-0.05, 0.08, y + 0.35 * sm(0.3, -0.6, z));
    m *= z > -0.3 ? side : sm(-0.62, -0.5, y);
    if (ax > 0.6 && z > -0.2 && z < 0.4) m *= sm(0.0, 0.12, y + 0.05 * (z + 0.2));
    m *= 0.9 + 0.1 * vnoise(x * 30, y * 30, z * 30);
    let off = 1.04 + 0.03 * sm(0, 1, y);
    if (style === 'messy') {
      off += 0.07 * sm(0.3, 0.9, y) * vnoise(x * 5 + 3, y * 5, z * 5) + 0.02;
      off += 0.04 * g3(x, y - 0.8, z - 0.4, 0.3);
    } else {
      off += 0.035 * g3(x - 0.15, y - 0.75, z - 0.35, 0.3) + 0.006 * Math.sin(x * 70 + z * 8);
    }
    const s = shapeHead(new THREE.Vector3(x * off, y * off, z * off), p, false);
    // alın üstünde saçı biraz öne/aşağı it (perçem)
    if (style === 'messy' && z > 0.4 && y > 0.35) { s.z += 0.03 * sm(0.35, 0.6, y); s.y -= 0.015 * sm(0.4, 0.8, z); }
    pos.setXYZ(i, s.x, s.y, s.z);
    const shade = 0.82 + 0.3 * vnoise(x * 18, y * 6, z * 18);
    col[i * 4] = shade; col[i * 4 + 1] = shade; col[i * 4 + 2] = shade; col[i * 4 + 3] = Math.min(1, m * 1.15);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 4));
  g.computeVertexNormals();
  return g;
}
let HAIR_TEX = null;
function hairTex() {
  if (HAIR_TEX) return HAIR_TEX;
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512; const x = c.getContext('2d');
  x.fillStyle = '#808080'; x.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 4000; i++) { const px = Math.random() * 1024, w = 0.6 + Math.random() * 1.2; const g = 90 + Math.random() * 120; x.strokeStyle = `rgb(${g},${g},${g})`; x.lineWidth = w; x.beginPath(); x.moveTo(px, 0); x.bezierCurveTo(px + (Math.random() - 0.5) * 30, 170, px + (Math.random() - 0.5) * 30, 340, px + (Math.random() - 0.5) * 40, 512); x.stroke(); }
  HAIR_TEX = new THREE.CanvasTexture(c); HAIR_TEX.wrapS = THREE.RepeatWrapping; HAIR_TEX.repeat.set(3, 1);
  return HAIR_TEX;
}
function irisTex(color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#e9ddd3'; x.fillRect(0, 0, 256, 256);
  const g = x.createRadialGradient(128, 128, 2, 128, 128, 120); g.addColorStop(0, '#ece2d9'); g.addColorStop(0.75, '#e2d4ca'); g.addColorStop(1, '#c9a9a0'); x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  const ic = new THREE.Color(color);
  // iris (doku merkezde: küre UV'sinde ön yüz u=0.75 bölgesine denk gelecek şekilde ayrı UV kullanacağız)
  x.save(); x.translate(128, 128);
  const ig = x.createRadialGradient(0, 0, 8, 0, 0, 58); ig.addColorStop(0, '#000'); ig.addColorStop(0.25, '#' + ic.clone().multiplyScalar(0.5).getHexString()); ig.addColorStop(0.7, '#' + ic.getHexString()); ig.addColorStop(1, '#' + ic.clone().multiplyScalar(0.35).getHexString());
  x.fillStyle = ig; x.beginPath(); x.arc(0, 0, 58, 0, 7); x.fill();
  for (let i = 0; i < 90; i++) { const a = i / 90 * 6.283; x.strokeStyle = `rgba(255,255,255,${0.05 + Math.random() * 0.1})`; x.beginPath(); x.moveTo(Math.cos(a) * 14, Math.sin(a) * 14); x.lineTo(Math.cos(a) * 56, Math.sin(a) * 56); x.stroke(); }
  x.fillStyle = '#050505'; x.beginPath(); x.arc(0, 0, 19, 0, 7); x.fill();
  x.restore();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// göz küresi: UV'yi ön yüzde (+z) planar projeksiyonla ver
function eyeGeometry(r) {
  const g = new THREE.SphereGeometry(r, 32, 24); const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i) / r, y = p.getY(i) / r, z = p.getZ(i) / r; uv.setXY(i, 0.5 + x * 0.5 * (z > 0 ? 1 : 1), 0.5 + y * 0.5); if (z < 0) uv.setXY(i, 0.02, 0.02); }
  return g;
}

const UNIT = 0.1175; // birim kafa → metre
const FACE = {
  adult: { child: 0, jaw: 0.86, nose: 1.0, cheek: 1.0, brow: 1.0, lip: 1.0 },
  father: { child: 0, jaw: 0.9, nose: 1.1, cheek: 1.1, brow: 1.2, lip: 0.9 },
};

let FOLD = null, PORE = null;
function foldTex() {
  if (FOLD) return FOLD;
  const c = document.createElement('canvas'); c.width = 512; c.height = 512; const x = c.getContext('2d');
  x.fillStyle = '#808080'; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 70; i++) { const px = Math.random() * 512, py = Math.random() * 512, l = 40 + Math.random() * 160, a = (Math.random() - 0.5) * 0.8 + Math.PI / 2;
    const g = x.createLinearGradient(px - 10, py, px + 10, py); const v = Math.random() < 0.5 ? 60 : 200; g.addColorStop(0, 'rgba(128,128,128,0)'); g.addColorStop(0.5, `rgba(${v},${v},${v},0.35)`); g.addColorStop(1, 'rgba(128,128,128,0)');
    x.strokeStyle = g; x.lineWidth = 6 + Math.random() * 14; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke(); }
  const id = x.getImageData(0, 0, 512, 512); for (let i = 0; i < id.data.length; i += 4) { const n = (Math.random() - 0.5) * 26; id.data[i] += n; id.data[i + 1] += n; id.data[i + 2] += n; } x.putImageData(id, 0, 0);
  FOLD = new THREE.CanvasTexture(c); FOLD.wrapS = FOLD.wrapT = THREE.RepeatWrapping; FOLD.repeat.set(2, 2); return FOLD;
}
function poreTex() {
  if (PORE) return PORE;
  const c = document.createElement('canvas'); c.width = 512; c.height = 512; const x = c.getContext('2d'); const id = x.createImageData(512, 512);
  for (let i = 0; i < id.data.length; i += 4) { const n = 128 + (Math.random() - 0.5) * 60; id.data[i] = id.data[i + 1] = id.data[i + 2] = n; id.data[i + 3] = 255; }
  x.putImageData(id, 0, 0); PORE = new THREE.CanvasTexture(c); PORE.wrapS = PORE.wrapT = THREE.RepeatWrapping; PORE.repeat.set(6, 6); return PORE;
}
function physSkin(skin) {
  return new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.6, metalness: 0, sheen: 0.35, sheenColor: new THREE.Color(0xff6a4a), sheenRoughness: 0.5, clearcoat: 0.05, clearcoatRoughness: 0.7, bumpMap: poreTex(), bumpScale: 0.25 });
}
function fabric(color, rough = 0.85, sheen = 0.8) {
  return new THREE.MeshPhysicalMaterial({ color, roughness: rough, metalness: 0, sheen, sheenRoughness: 0.6, sheenColor: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.35), bumpMap: foldTex(), bumpScale: 2.0 });
}
function m(geo, mat, x = 0, y = 0, z = 0) { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; return o; }
function lathe(pts, seg = 48) { return new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg); }

// ---------- KAFA ----------
function buildHead(o) {
  const head = new THREE.Group();
  const skinM = physSkin();
  const gA = headGeometry(o.face, o.skin);
  // çocuk morph hedefi (Emre için yaş geçişi)
  if (o.morphChild) {
    const gC = headGeometry({ ...o.face, child: 1, jaw: 0.95, nose: 0.6, cheek: 0.7, brow: 0.4, lip: 0.9 }, o.skin);
    gA.morphAttributes.position = [gC.attributes.position];
    gA.morphAttributes.normal = [gC.attributes.normal];
  }
  const skull = m(gA, skinM); skull.scale.setScalar(UNIT); head.add(skull);
  // kulaklar
  for (const s of [-1, 1]) {
    const eg = new THREE.SphereGeometry(1, 24, 16); const ep = eg.attributes.position;
    for (let i = 0; i < ep.count; i++) { const x = ep.getX(i), y = ep.getY(i), z = ep.getZ(i); ep.setXYZ(i, x * 0.14, y * (y > 0 ? 0.27 : 0.21), z * 0.08 + 0.02 * (y * y)); }
    eg.computeVertexNormals();
    const ear = m(eg, new THREE.MeshPhysicalMaterial({ color: o.skin, roughness: 0.55, sheen: 0.6, sheenColor: new THREE.Color(0xff6a4a) }), s * 0.755 * UNIT, -0.05 * UNIT, -0.04 * UNIT);
    ear.scale.setScalar(UNIT); ear.rotation.y = s * 1.35; ear.rotation.z = s * -0.1; head.add(ear);
  }
  // gözler
  const eyeR = 0.0128, eyes = [], lids = [], lowLids = [];
  const eyeM = new THREE.MeshPhysicalMaterial({ map: irisTex(o.eye), roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.03 });
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(s * 0.245 * UNIT, 0.068 * UNIT, 0.715 * UNIT); head.add(pivot);
    const eye = m(eyeGeometry(eyeR), eyeM); eye.castShadow = false; pivot.add(eye); eyes.push(eye);
    const lidG = new THREE.SphereGeometry(eyeR * 1.1, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const lid = m(lidG, new THREE.MeshPhysicalMaterial({ color: new THREE.Color(o.skin).multiplyScalar(0.92), roughness: 0.6, sheen: 0.5, sheenColor: new THREE.Color(0xff6a4a) })); lid.castShadow = false; pivot.add(lid); lids.push(lid);
    const low = m(lidG, lid.material); low.rotation.x = Math.PI; low.castShadow = false; pivot.add(low); lowLids.push(low);
    // kirpik çizgisi
    const lash = m(new THREE.TorusGeometry(eyeR * 1.08, eyeR * 0.09, 6, 24, Math.PI), new THREE.MeshStandardMaterial({ color: 0x1a120e, roughness: 0.8 })); lash.castShadow = false; lid.add(lash); lash.rotation.x = Math.PI / 2;
  }
  // kaşlar
  const brows = [];
  const browM = new THREE.MeshStandardMaterial({ color: o.browColor, roughness: 0.9 });
  for (const s of [-1, 1]) {
    const pts = [];
    for (let k = 0; k <= 8; k++) {
      const u = k / 8; const ux = 0.13 + u * 0.37, uy = 0.25 + 0.07 * Math.sin(u * 2.6) - 0.02 * u;
      const uz = Math.sqrt(Math.max(0, 1 - ux * ux - uy * uy));
      const v = shapeHead(new THREE.Vector3(ux, uy, uz), o.face).multiplyScalar(UNIT * 1.01);
      v.x *= s; pts.push(v);
    }
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.0028, 6, false);
    const sp = tube.attributes.position; // uçlara doğru incelt
    const brow = m(tube, browM); brow.castShadow = false; head.add(brow); brows.push(brow);
  }
  // ağız içi (konuşma)
  const mouth = m(new THREE.CircleGeometry(1, 24), new THREE.MeshBasicMaterial({ color: 0x3a1210 }), 0, -0.556 * UNIT * 0.98, 0.838 * UNIT);
  mouth.scale.set(0.017, 0.001, 1); mouth.castShadow = false; head.add(mouth);
  const teeth = m(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0xe8e2d6, roughness: 0.3 }), 0, -0.548 * UNIT, 0.832 * UNIT);
  teeth.scale.set(0.03, 0.001, 1); teeth.castShadow = false; head.add(teeth);
  // saç
  let hair = null;
  if (o.hair) {
    const tex = hairTex();
    const hm = new THREE.MeshPhysicalMaterial({ color: o.hair, vertexColors: true, alphaHash: true, roughness: 0.58, sheen: 0.45, sheenColor: new THREE.Color(o.hair).lerp(new THREE.Color(0xffffff), 0.3), sheenRoughness: 0.45, bumpMap: tex, bumpScale: 1.5, roughnessMap: tex });
    hair = m(hairGeometry(o.face, o.hairStyle), hm); hair.scale.setScalar(UNIT); head.add(hair);
    if (o.morphChild) { /* çocukta saç aynı kalsın, kafa ile birlikte ölçeklenir */ }
  }
  return { head, skull, eyes, lids, lowLids, brows, mouth, teeth, hair };
}

// ---------- EL ----------
function buildHand(skinM, s) {
  const h = new THREE.Group();
  const palm = m(new THREE.CapsuleGeometry(0.036, 0.045, 6, 12), skinM, 0, -0.045, 0); palm.scale.set(1.05, 1, 0.42); h.add(palm);
  for (let f = 0; f < 4; f++) {
    const len = [0.07, 0.078, 0.074, 0.06][f];
    const fg = new THREE.Group(); fg.position.set((f - 1.5) * 0.0175, -0.088, 0); fg.rotation.x = 0.25 + f * 0.05; h.add(fg);
    fg.add(m(new THREE.CapsuleGeometry(0.0075, len, 4, 8), skinM, 0, -len / 2, 0));
  }
  const th = new THREE.Group(); th.position.set(s * -0.03, -0.035, 0.012); th.rotation.z = s * -0.6; th.rotation.x = 0.4; h.add(th);
  th.add(m(new THREE.CapsuleGeometry(0.009, 0.05, 4, 8), skinM, 0, -0.03, 0));
  return h;
}

// ---------- TAM İNSAN ----------
// o: { skin, eye, hair, hairStyle, browColor, face, top, pants, shoes, coat, shirt, tie, morphChild }
export function makeHuman(o) {
  const skinM = new THREE.MeshPhysicalMaterial({ color: o.skin, roughness: 0.6, sheen: 0.35, sheenColor: new THREE.Color(0xff6a4a), sheenRoughness: 0.5, bumpMap: poreTex(), bumpScale: 0.25 });
  const topM = o.coat ? new THREE.MeshPhysicalMaterial({ color: o.top, roughness: 0.42, clearcoat: 0.45, clearcoatRoughness: 0.35, sheen: 0.3, bumpMap: foldTex(), bumpScale: 2.5 }) : fabric(o.top, 0.7, 0.6);
  const pantsM = fabric(o.pants, 0.85, 0.6), shoeM = new THREE.MeshPhysicalMaterial({ color: o.shoes, roughness: 0.35, clearcoat: 0.5 });
  const root = new THREE.Group();
  const body = new THREE.Group(); body.position.y = 0.93; root.add(body);   // kalça eklemi
  const spine = new THREE.Group(); spine.position.y = 0.1; body.add(spine); // bel
  // gövde (kıyafet) — yerel y: bel = 0
  const torso = m(lathe([[0.0, -0.17], [0.15, -0.15], [0.172, -0.09], [0.165, -0.02], [0.152, 0.04], [0.165, 0.14], [0.186, 0.26], [0.195, 0.35], [0.19, 0.4], [0.155, 0.45], [0.075, 0.495], [0.0, 0.505]]), topM);
  torso.scale.z = 0.64; spine.add(torso);
  if (o.gown) {
    const hem = m(lathe([[0.25, -0.62], [0.22, -0.4], [0.19, -0.2], [0.17, -0.05]], 48), topM, 0, 0, 0); hem.material = topM.clone(); hem.material.side = THREE.DoubleSide; hem.scale.z = 0.75; spine.add(hem);
    const tie = m(new THREE.TorusGeometry(0.03, 0.006, 6, 16), topM, 0, 0.44, 0.1); spine.add(tie);
  }
  if (o.coat) {
    const hem = m(lathe([[0.2, -0.45], [0.19, -0.3], [0.178, -0.15], [0.17, -0.05]], 48), topM, 0, 0, 0); hem.material = topM.clone(); hem.material.side = THREE.DoubleSide; hem.scale.z = 0.72; spine.add(hem);
    const zip = m(new THREE.BoxGeometry(0.008, 0.8, 0.006), new THREE.MeshStandardMaterial({ color: 0x3a2f12, roughness: 0.5, metalness: 0.5 }), 0, 0.0, 0.122); spine.add(zip);
    const hood = m(new THREE.TorusGeometry(0.1, 0.045, 12, 32, Math.PI * 1.3), topM, 0, 0.47, -0.04); hood.rotation.set(Math.PI / 2.3, 0, Math.PI * 0.85); spine.add(hood);
    for (const s of [-1, 1]) { const pk = m(new THREE.BoxGeometry(0.1, 0.012, 0.03), topM, s * 0.1, -0.12, 0.11); pk.rotation.y = s * 0.3; spine.add(pk); }
  }
  if (o.shirt) {
    const sh = m(new THREE.CircleGeometry(0.075, 3), fabric(0xf3f1ee, 0.6, 0.3), 0, 0.39, 0.118); sh.rotation.z = -Math.PI / 2; sh.scale.set(1.2, 0.8, 1); spine.add(sh);
    const tie = m(new THREE.BoxGeometry(0.03, 0.26, 0.006), fabric(o.tie, 0.4, 0.5), 0, 0.28, 0.121); spine.add(tie);
    for (const s of [-1, 1]) { const lap = m(new THREE.BoxGeometry(0.05, 0.22, 0.008), topM, s * 0.06, 0.33, 0.118); lap.rotation.z = s * 0.38; spine.add(lap); }
    const bt = m(new THREE.SphereGeometry(0.008, 8, 6), new THREE.MeshStandardMaterial({ color: 0x0c0c10 }), 0, 0.12, 0.122); spine.add(bt);
  }
  // boyun & kafa
  const neck = new THREE.Group(); neck.position.y = 0.49; spine.add(neck);
  neck.add(m(new THREE.CylinderGeometry(0.048, 0.056, 0.11, 20), skinM, 0, 0.04, 0.005));
  const collar = m(new THREE.TorusGeometry(0.058, 0.01, 8, 24), o.shirt ? fabric(0xf3f1ee, 0.6, 0.3) : topM, 0, 0.0, 0.005); collar.rotation.x = Math.PI / 2; collar.scale.set(1, 0.85, 1); neck.add(collar);
  const H = buildHead(o); H.head.position.set(0, 0.17, 0.012); neck.add(H.head);
  // omuz/kol
  const shoulders = [], elbows = [], wrists = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * 0.175, 0.375, -0.005); spine.add(sh); shoulders.push(sh);
    { const dl = m(new THREE.SphereGeometry(0.058, 20, 14), topM); dl.scale.set(0.95, 0.85, 0.9); dl.position.x = -s * 0.008; sh.add(dl); }
    sh.add(m(new THREE.CylinderGeometry(0.05, 0.043, 0.29, 18), topM, 0, -0.15, 0));
    const el = new THREE.Group(); el.position.y = -0.3; sh.add(el); elbows.push(el);
    el.add(m(new THREE.SphereGeometry(0.044, 16, 12), topM));
    el.add(m(new THREE.CylinderGeometry(0.043, o.coat ? 0.044 : 0.037, 0.26, 18), topM, 0, -0.13, 0));
    const wr = new THREE.Group(); wr.position.y = -0.265; el.add(wr); wrists.push(wr);
    wr.add(m(new THREE.CylinderGeometry(0.026, 0.028, 0.03, 12), skinM, 0, -0.005, 0));
    const hand = buildHand(skinM, s); hand.position.y = -0.015; wr.add(hand);
  }
  // bacaklar
  const hips = [], knees = [], ankles = [];
  for (const s of [-1, 1]) {
    const hp = new THREE.Group(); hp.position.set(s * 0.092, 0, 0); body.add(hp); hips.push(hp);
    hp.add(m(new THREE.SphereGeometry(0.08, 16, 12), pantsM, 0, 0.0, 0));
    hp.add(m(new THREE.CylinderGeometry(0.078, 0.056, 0.44, 18), pantsM, 0, -0.22, 0));
    const kn = new THREE.Group(); kn.position.y = -0.44; hp.add(kn); knees.push(kn);
    kn.add(m(new THREE.SphereGeometry(0.056, 14, 10), pantsM));
    kn.add(m(new THREE.CylinderGeometry(0.054, 0.05, 0.43, 18), pantsM, 0, -0.215, 0));
    const an = new THREE.Group(); an.position.y = -0.43; kn.add(an); ankles.push(an);
    const shoe = m(new THREE.CapsuleGeometry(0.045, 0.16, 6, 16), shoeM, 0, -0.035, 0.05); shoe.rotation.x = Math.PI / 2; shoe.scale.set(1.05, 1, 0.62); an.add(shoe);
    const sole = m(new THREE.BoxGeometry(0.095, 0.02, 0.27), new THREE.MeshStandardMaterial({ color: 0xe5e5e5, roughness: 0.7 }), 0, -0.058, 0.05); an.add(sole);
  }
  return { root, body, spine, neck, ...H, shoulders, elbows, wrists, hips, knees, ankles, torso };
}

// p: { walk, phase, sit, sad, surprise, talk, t, pitch, yaw, lookX, lookY, blink, armReach(0..1 sağ kol öne), handOnShoulder, breath }
export function pose(h, p) {
  const walk = p.walk || 0, ph = p.phase || 0, sit = p.sit || 0, sad = p.sad || 0, sur = p.surprise || 0;
  const sw = Math.sin(ph), t = p.t || 0;
  const breath = Math.sin(t * 1.6) * 0.008;
  for (let i = 0; i < 2; i++) {
    const s = i === 0 ? 1 : -1; // i=0 sol (x-)
    const legPh = ph + (i ? Math.PI : 0);
    const thigh = Math.sin(legPh) * 0.42 * walk;
    const knee = Math.max(0, Math.sin(legPh - 1.3)) * 0.85 * walk + 0.05 * walk;
    h.hips[i].rotation.x = lerp(-thigh, -Math.PI / 2 + 0.08, sit);
    h.knees[i].rotation.x = lerp(knee, Math.PI / 2 - 0.06, sit);
    h.ankles[i].rotation.x = lerp(-Math.min(0, Math.sin(legPh)) * 0.25 * walk, 0, sit);
    h.hips[i].rotation.z = (i ? -1 : 1) * 0.015 * (1 - sit);
    const arm = Math.sin(legPh + Math.PI) * 0.38 * walk;
    h.shoulders[i].rotation.set(lerp(-arm, -0.35, sit), 0, (i ? 1 : -1) * -(0.06 + 0.02 * walk));
    h.elbows[i].rotation.x = lerp(-0.12 - 0.3 * walk - Math.max(0, -arm) * 0.6, -1.0, sit);
    h.wrists[i].rotation.x = 0;
  }
  // sağ kol (i=1): uzan / omza el koy
  const reach = p.reach || 0;
  if (reach > 0) {
    h.shoulders[1].rotation.x = lerp(h.shoulders[1].rotation.x, -1.15, reach);
    h.shoulders[1].rotation.z = lerp(h.shoulders[1].rotation.z, 0.25, reach);
    h.elbows[1].rotation.x = lerp(h.elbows[1].rotation.x, -0.55, reach);
    h.wrists[1].rotation.x = lerp(0, 0.3, reach);
  }
  const lift = p.handsFace || 0;
  if (lift > 0) for (let i = 0; i < 2; i++) { h.shoulders[i].rotation.x = lerp(h.shoulders[i].rotation.x, -0.5, lift); h.elbows[i].rotation.x = lerp(h.elbows[i].rotation.x, -1.6, lift); }
  h.body.position.y = lerp(0.93 + Math.abs(Math.cos(ph)) * 0.022 * walk - 0.012 * walk, 0.47, sit);
  h.body.position.z = lerp(0, -0.04, sit);
  h.body.rotation.y = sw * 0.06 * walk;
  h.spine.rotation.set(0.05 * walk + 0.16 * sad + (p.lean || 0) + breath, -sw * 0.1 * walk, 0);
  h.spine.scale.y = 1 + breath * 0.5;
  h.neck.rotation.set((p.pitch || 0) + 0.18 * sad - 0.06 * sur, (p.yaw || 0), p.tilt || 0);
  // gözler
  const blink = Math.max(p.blink || 0, autoBlink(t + (p.seed || 0)));
  const lookX = p.lookX || 0, lookY = p.lookY || 0;
  for (let i = 0; i < 2; i++) {
    h.eyes[i].rotation.set(-lookY, lookX, 0);
    const open = lerp(lerp(-0.9, -0.62, sad), -1.25, sur);
    h.lids[i].rotation.x = lerp(open, 0.05, blink) - lookY * 0.3;
    h.lowLids[i].rotation.x = Math.PI + lerp(1.08, 1.0, sad) - 0.05 * blink;
    const s = i === 0 ? -1 : 1;
    h.brows[i].position.y = 0.0025 * sur + 0.001 * sad;
    h.brows[i].rotation.z = s * (0.06 * sad - 0.04 * sur) * -1;
  }
  // ağız: konuşma
  const talk = p.talk ? Math.max(0, Math.sin(t * 17) * 0.6 + Math.sin(t * 9.3) * 0.5) * p.talk : 0;
  const open = 0.001 + talk * 0.0075 + sur * 0.0018;
  h.mouth.scale.set(0.017 - 0.003 * sur, open, 1);
  h.teeth.scale.set(0.026, open > 0.003 ? open * 0.5 : 0.0005, 1);
  if (h.skull.morphTargetInfluences) h.skull.morphTargetInfluences[0] = p.child || 0;
}
function autoBlink(t) { const ph = (t % 3.7) / 3.7; return ph > 0.96 ? Math.sin((ph - 0.96) / 0.04 * Math.PI) : 0; }

// Emre'nin yaş geçişi: yaş 5..25
export function setAge(h, age) {
  const H = age <= 5 ? 1.1 : age <= 15 ? lerp(1.1, 1.66, (age - 5) / 10) : lerp(1.66, 1.78, Math.min(1, (age - 15) / 10));
  const headM = age <= 5 ? 0.21 : age <= 15 ? lerp(0.21, 0.228, (age - 5) / 10) : lerp(0.228, 0.235, Math.min(1, (age - 15) / 10));
  const k = H / 1.78;
  h.root.scale.set(k * lerp(1.08, 1, Math.min(1, (age - 5) / 15)), k, k * lerp(1.08, 1, Math.min(1, (age - 5) / 15)));
  h.head.scale.setScalar((headM / 0.235) / k);
  h.childK = Math.max(0, Math.min(1, (18 - age) / 13));
}

// ---------- BEBEK ----------
export function makeBaby() {
  const g = new THREE.Group();
  const face = { child: 1, jaw: 1.0, nose: 0.45, cheek: 0.6, brow: 0.2, lip: 0.8 };
  const H = buildHead({ face, skin: 0xf0b89a, eye: 0x3a2a20, browColor: 0xc89070, hair: 0x7a5a40, hairStyle: 'neat' });
  H.head.scale.setScalar(0.62); g.add(H.head);
  H.hair.visible = false;
  // kundak
  const sw = new THREE.SphereGeometry(1, 64, 40); const sp = sw.attributes.position;
  for (let i = 0; i < sp.count; i++) { const x = sp.getX(i), y = sp.getY(i), z = sp.getZ(i); const n = vnoise(x * 4, y * 6, z * 4) * 0.08; sp.setXYZ(i, x * 0.11 * (1 + n), y * 0.21 * (1 + n * 0.5), z * 0.085 * (1 + n)); }
  sw.computeVertexNormals();
  const swaddle = m(sw, fabric(0x9ea8b2, 0.95, 0.5), 0, -0.22, -0.01); g.add(swaddle);
  const hood = m(new THREE.TorusGeometry(0.075, 0.022, 12, 32, Math.PI * 1.25), fabric(0xcfd6dc, 0.95, 0.6), 0, 0.0, -0.035); hood.rotation.z = -Math.PI * 0.125; hood.rotation.y = 0; g.add(hood);
  const hand = buildHand(new THREE.MeshPhysicalMaterial({ color: 0xf0b89a, roughness: 0.5, sheen: 0.6, sheenColor: new THREE.Color(0xff6a4a) }), 1); hand.scale.setScalar(0.42); hand.position.set(0.04, -0.075, 0.07); hand.rotation.set(-1.9, 0, 0.6); g.add(hand);
  return { root: g, ...H, hand };
}

// ---------- KALABALIK (instanced, vertex shader ile yürüme) ----------
export function crowdGeometry() {
  const parts = [];
  const add = (geo, limb, pivotY, skin) => {
    const n = geo.attributes.position.count;
    geo.setAttribute('aLimb', new THREE.BufferAttribute(new Float32Array(n).fill(limb), 1));
    geo.setAttribute('aPivot', new THREE.BufferAttribute(new Float32Array(n).fill(pivotY), 1));
    geo.setAttribute('aSkin', new THREE.BufferAttribute(new Float32Array(n).fill(skin), 1));
    if (geo.index) geo = geo.toNonIndexed();
    geo.deleteAttribute('uv'); parts.push(geo);
  };
  add(lathe([[0, -0.17], [0.15, -0.15], [0.17, -0.05], [0.155, 0.05], [0.18, 0.25], [0.18, 0.38], [0.11, 0.46], [0, 0.48]], 12).scale(1, 1, 0.64).translate(0, 1.03, 0), 0, 0, 0);
  add(new THREE.SphereGeometry(0.105, 12, 10).scale(0.82, 1.08, 0.92).translate(0, 1.66, 0.01), 0, 0, 1);
  add(new THREE.CylinderGeometry(0.045, 0.05, 0.1, 8).translate(0, 1.54, 0), 0, 0, 1);
  for (const s of [-1, 1]) {
    add(new THREE.CylinderGeometry(0.07, 0.048, 0.88, 8).translate(s * 0.092, 0.49, 0), s < 0 ? 1 : 2, 0.93, 0);
    add(new THREE.BoxGeometry(0.09, 0.07, 0.24).translate(s * 0.092, 0.035, 0.05), s < 0 ? 1 : 2, 0.93, 0);
    add(new THREE.CylinderGeometry(0.048, 0.035, 0.56, 8).translate(s * 0.2, 1.15, 0), s < 0 ? 3 : 4, 1.43, 0);
    add(new THREE.SphereGeometry(0.035, 8, 6).translate(s * 0.2, 0.85, 0.01), s < 0 ? 3 : 4, 1.43, 1);
  }
  const g = mergeGeometries(parts);
  return g;
}
export function crowdMaterial() {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.65 });
  mat.userData.uTime = { value: 0 };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = mat.userData.uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
      attribute float aLimb; attribute float aPivot; attribute float aSkin; attribute float aPhase; attribute float aSpeed;
      uniform float uTime; varying float vSkin;
      vec3 rotX(vec3 p, float py, float a){ p.y-=py; float c=cos(a), s=sin(a); p=vec3(p.x, c*p.y-s*p.z, s*p.y+c*p.z); p.y+=py; return p; }`)
      .replace('#include <begin_vertex>', `vec3 transformed = position; vSkin=aSkin;
        float ph = uTime*aSpeed*6.0 + aPhase;
        float sw = sin(ph)*0.45*step(0.05,aSpeed);
        if(aLimb>0.5 && aLimb<1.5) transformed = rotX(transformed, aPivot, -sw);
        if(aLimb>1.5 && aLimb<2.5) transformed = rotX(transformed, aPivot, sw);
        if(aLimb>2.5 && aLimb<3.5) transformed = rotX(transformed, aPivot, sw*0.8);
        if(aLimb>3.5) transformed = rotX(transformed, aPivot, -sw*0.8);
        transformed.y += abs(cos(ph))*0.03*step(0.05,aSpeed);`)
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vSkin;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62,0.42,0.32), vSkin);`);
  };
  return mat;
}
