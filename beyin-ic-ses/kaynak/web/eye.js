// Makro goz duzenegi: sklera (damarli), duz iris diski (lifli, kahverengi-ela), buyuyen goz bebegi,
// isik kiran kornea kubbesi, badem seklinde goz acikligi, kapak kenarlari ve kirpikler, gozenekli cilt.
import * as THREE from 'three';
import { setSeed, rnd, fbmFn } from './textures.js';

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }

function irisTex() {
  const S = 1024; const [c, x] = canvas(S, S); const C = S / 2;
  x.fillStyle = '#000'; x.fillRect(0, 0, S, S);
  const img = x.createImageData(S, S); const f = fbmFn(17, 5); setSeed(3);
  for (let yy = 0; yy < S; yy++) for (let xx = 0; xx < S; xx++) {
    const dx = (xx - C) / C, dy = (yy - C) / C, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    if (r > 1) continue;
    const fib = 0.5 + 0.5 * Math.sin(a * 140 + f(r * 6, a * 3) * 9) * Math.sin(a * 37 + r * 20);
    const n = f(a * 8 + 10, r * 14);
    let R = 92, Gc = 62, Bc = 34;                        // kahve
    const amber = Math.exp(-(((r - 0.42) / 0.12) ** 2));    // collarette civari ela/altin
    R += 70 * amber; Gc += 48 * amber; Bc += 10 * amber;
    const k = 0.55 + 0.6 * fib * (0.6 + 0.4 * n);
    let v = k;
    if (Math.abs(r - 0.42) < 0.02) v *= 0.75;           // collarette halkasi
    if (r > 0.88) v *= 1 - (r - 0.88) / 0.12 * 0.85;     // limbal koyu halka
    const crypt = f(a * 20, r * 30) > 0.72 && r > 0.45 && r < 0.8 ? 0.55 : 1;
    v *= crypt;
    const i = (yy * S + xx) * 4;
    img.data[i] = Math.min(255, R * v); img.data[i + 1] = Math.min(255, Gc * v); img.data[i + 2] = Math.min(255, Bc * v); img.data[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function scleraTex() {
  const W = 1024, H = 512; const [c, x] = canvas(W, H);
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#d9cfc6'); g.addColorStop(0.5, '#eee6de'); g.addColorStop(1, '#d6c9bf');
  x.fillStyle = g; x.fillRect(0, 0, W, H); setSeed(11);
  for (let i = 0; i < 80; i++) {
    let px = rnd() * W, py = H * (0.15 + rnd() * 0.7); x.strokeStyle = `rgba(${150 + rnd() * 60},${30 + rnd() * 20},${35},${0.25 + rnd() * 0.35})`; x.lineWidth = 0.6 + rnd() * 1.6;
    x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 10; k++) { px += (rnd() - 0.5) * 30; py += (rnd() - 0.5) * 18; x.lineTo(px, py); } x.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function skinTex() {
  const S = 1024; const [c, x] = canvas(S, S); const f = fbmFn(23, 5);
  const img = x.createImageData(S, S); setSeed(31);
  for (let yy = 0; yy < S; yy++) for (let xx = 0; xx < S; xx++) {
    const n = f(xx / 90, yy / 90), pore = rnd() < 0.012 ? 0.7 : 1, wr = 0.95 + 0.05 * Math.sin(yy * 0.08 + f(xx / 40, yy / 40) * 6);
    const k = (0.88 + 0.18 * n) * pore * wr; const i = (yy * S + xx) * 4;
    img.data[i] = 205 * k; img.data[i + 1] = 150 * k; img.data[i + 2] = 128 * k; img.data[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function almondAlpha() {
  const S = 1024; const [c, x] = canvas(S, S);
  x.fillStyle = '#fff'; x.fillRect(0, 0, S, S); x.fillStyle = '#000';
  // badem: iki yay (ust daha kavisli)
  const cx = S / 2, cy = S / 2, w = S * 0.16, hu = S * 0.1, hl = S * 0.075;
  x.beginPath(); x.moveTo(cx - w, cy + 4);
  x.bezierCurveTo(cx - w * 0.5, cy - hu * 1.35, cx + w * 0.45, cy - hu * 1.3, cx + w, cy - 6);
  x.bezierCurveTo(cx + w * 0.5, cy + hl * 1.3, cx - w * 0.5, cy + hl * 1.35, cx - w, cy + 4);
  x.fill();
  const t = new THREE.CanvasTexture(c); return t;
}

export function buildEye(renderer) {
  const G = new THREE.Group(); G.name = 'eye';
  // yansima ortami (pencere + lamba) -> kornea/islak yuzey yansimasi
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.BoxGeometry(20, 20, 20), new THREE.MeshBasicMaterial({ color: 0x0b0d14, side: THREE.BackSide })));
  const win = new THREE.Mesh(new THREE.PlaneGeometry(4, 5), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.6, 3.4) })); win.position.set(-4, 2, 7); win.lookAt(0, 0, 0); envScene.add(win);
  const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 5), new THREE.MeshBasicMaterial({ color: 0x0b0d14 })); bar.position.set(-3.95, 2, 6.98); bar.lookAt(0, 0, 0); envScene.add(bar);
  const lampS = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 2.6, 1.3) })); lampS.position.set(5, -1, 6); envScene.add(lampS);
  const pm = new THREE.PMREMGenerator(renderer); const env = pm.fromScene(envScene, 0.02).texture;

  // sklera (on tarafinda iris icin bosluk)
  const holeA = 0.62;
  const scG = new THREE.SphereGeometry(1, 128, 96, 0, Math.PI * 2, holeA, Math.PI - holeA); scG.rotateX(Math.PI / 2);
  const sclera = new THREE.Mesh(scG, new THREE.MeshPhysicalMaterial({ map: scleraTex(), roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.05, envMap: env, envMapIntensity: 0.8 }));
  G.add(sclera);
  // iris diski
  const iris = new THREE.Mesh(new THREE.CircleGeometry(0.585, 128), new THREE.MeshStandardMaterial({ map: irisTex(), roughness: 0.55 }));
  iris.position.z = 0.80; G.add(iris);
  const pupil = new THREE.Mesh(new THREE.CircleGeometry(1, 96), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  pupil.position.z = 0.802; pupil.scale.setScalar(0.2); G.add(pupil);
  // kornea kubbesi (isik kirar + yansitir)
  const coG = new THREE.SphereGeometry(0.7, 96, 48, 0, Math.PI * 2, 0, 0.98); coG.rotateX(Math.PI / 2);
  const cornea = new THREE.Mesh(coG, new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.0, metalness: 0, transmission: 1, thickness: 0.15, ior: 1.376, envMap: env, envMapIntensity: 2.2, transparent: true, specularIntensity: 1 }));
  cornea.position.z = 0.422; G.add(cornea);
  // cilt + badem acikligi
  const sk = skinTex();
  const skinM = new THREE.MeshStandardMaterial({ map: sk, roughness: 0.55, bumpMap: sk, bumpScale: 2.5, alphaMap: almondAlpha(), alphaTest: 0.5, side: THREE.DoubleSide });
  const skin = new THREE.Mesh(new THREE.PlaneGeometry(6, 6, 64, 64), skinM);
  { // cildi goz kuresine dogru kivir (yanaklar/kapaklar hacimli dursun)
    const P = skin.geometry.attributes.position;
    for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i); const r2 = x * x / 1.6 + y * y / 0.55; P.setZ(i, 0.35 * Math.exp(-r2 * 0.9) - 0.03 * (x * x + y * y)); }
    skin.geometry.computeVertexNormals();
  }
  skin.position.z = 0.66; G.add(skin);
  // kapak kenarlari (ust/alt) + kirpikler
  const lidM = new THREE.MeshStandardMaterial({ map: sk, color: 0xb88a7c, roughness: 0.5 });
  const edge = (upper) => {
    const pts = []; const w = 0.96, h = upper ? 0.73 : 0.61;
    for (let i = 0; i <= 40; i++) { const t = i / 40, x = -w + 2 * w * t; const y = (upper ? 1 : -1) * h * Math.sin(Math.PI * t) ** 0.8 * (upper ? 1 : 0.9) + (upper ? -0.02 : 0.03); pts.push(new THREE.Vector3(x, y * 0.82, 0.62 + 0.36 * Math.sin(Math.PI * t))); }
    const cv = new THREE.CatmullRomCurve3(pts);
    G.add(new THREE.Mesh(new THREE.TubeGeometry(cv, 80, upper ? 0.06 : 0.045, 12, false), lidM));
    const lashM = new THREE.MeshStandardMaterial({ color: 0x120c0a, roughness: 0.6 });
    setSeed(upper ? 71 : 72);
    const nL = upper ? 90 : 55;
    for (let i = 0; i < nL; i++) {
      const t = 0.06 + 0.88 * (i / nL) + (rnd() - 0.5) * 0.008; const p = cv.getPointAt(t);
      const len = (upper ? 0.32 : 0.16) * (0.6 + 0.4 * Math.sin(Math.PI * t)) * (0.85 + rnd() * 0.3);
      const l = new THREE.Mesh(new THREE.ConeGeometry(upper ? 0.009 : 0.007, len, 5), lashM);
      const dir = new THREE.Vector3((t - 0.5) * 0.6, upper ? 1 : -1, 0.9).normalize();
      l.position.copy(p).add(dir.clone().multiplyScalar(len / 2));
      l.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); l.rotation.z += (rnd() - 0.5) * 0.2;
      G.add(l);
    }
  };
  edge(true); edge(false);
  // isiklar: pencere (soguk) anahtar + lamba (sicak) dolgu
  const key = new THREE.DirectionalLight(0xb8c8ff, 2.2); key.position.set(-3, 2, 6); G.add(key);
  const warm = new THREE.PointLight(0xffb070, 6, 12, 2); warm.position.set(3.5, -1.5, 4); G.add(warm);
  G.add(new THREE.HemisphereLight(0x8090b0, 0x302018, 0.4));
  return { G, pupil, env };
}
