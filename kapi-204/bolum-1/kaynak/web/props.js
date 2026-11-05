// Ortam esyalari: koridoru ve daireyi yasanmis, dolu bir mekan gibi gosterir.
import * as THREE from 'three';
import * as TX from './textures.js';

const std = (o) => new THREE.MeshStandardMaterial(o);
function m(geo, mat, p, x, y, z, ry = 0, cast = true) { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.rotation.y = ry; o.castShadow = cast; o.receiveShadow = true; p.add(o); return o; }
const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const C = (r1, r2, h, s = 16) => new THREE.CylinderGeometry(r1, r2, h, s);
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }

const MAT = () => ({
  darkWood: std({ map: TX.doorWood('#2a1a10', 121), roughness: 0.6 }),
  metal: std({ color: 0x6d6a64, roughness: 0.45, metalness: 0.6 }),
  darkMetal: std({ color: 0x2a2a2c, roughness: 0.5, metalness: 0.5 }),
  paintedMetal: std({ color: 0x8a8577, roughness: 0.7, metalness: 0.2 }),
  plastic: std({ color: 0x1b1b1d, roughness: 0.5 }),
  red: std({ color: 0x8c1414, roughness: 0.4, metalness: 0.2 }),
  ceramic: std({ color: 0xd8d2c6, roughness: 0.3 }),
  terracotta: std({ color: 0x7a3a22, roughness: 0.9 }),
  leaf: std({ color: 0x23361f, roughness: 0.8, side: THREE.DoubleSide }),
  fabricDark: std({ color: 0x2b2522, roughness: 1 }),
  fabricRed: std({ color: 0x4a1c1a, roughness: 1 }),
  fabricBlue: std({ color: 0x1f2836, roughness: 1 }),
  paper: std({ color: 0xcfc6b0, roughness: 0.9 }),
  glass: std({ color: 0x0a0c10, roughness: 0.08, metalness: 0.3 }),
  rubber: std({ color: 0x141414, roughness: 0.9 }),
});

function shoe(p, M, x, z, ry, col = 0x222222, s = 1) {
  const mat = std({ color: col, roughness: 0.7 });
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; g.scale.setScalar(s); p.add(g);
  m(B(0.1, 0.035, 0.27), M.rubber, g, 0, 0.017, 0);
  const up = m(new THREE.SphereGeometry(1, 16, 10), mat, g, 0, 0.055, -0.02); up.scale.set(0.048, 0.045, 0.12);
  return g;
}
function plant(p, M, x, y, z, s = 1) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s); p.add(g);
  m(C(0.13, 0.1, 0.26), M.terracotta, g, 0, 0.13, 0);
  TX.setSeed(Math.floor(x * 100 + z * 10 + 500));
  for (let i = 0; i < 14; i++) {
    const a = TX.rnd() * 6.28, h = 0.35 + TX.rnd() * 0.45, lean = 0.2 + TX.rnd() * 0.5;
    const l = m(new THREE.PlaneGeometry(0.07, h), M.leaf, g, Math.cos(a) * 0.05, 0.26 + h / 2, Math.sin(a) * 0.05, a);
    l.rotation.z = lean * Math.cos(a); l.rotation.x = lean * Math.sin(a);
  }
  return g;
}
function frame(p, M, x, y, z, w, h, ry, tone = 0x3a3f3a) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; p.add(g);
  m(B(w, h, 0.025), M.darkWood, g, 0, 0, 0, 0, false);
  m(B(w * 0.82, h * 0.82, 0.005), std({ color: tone, roughness: 0.8 }), g, 0, 0, 0.013, 0, false);
  return g;
}
function radiator(p, M, x, z, ry, n = 10) {
  const g = new THREE.Group(); g.position.set(x, 0.12, z); g.rotation.y = ry; p.add(g);
  for (let i = 0; i < n; i++) m(B(0.05, 0.55, 0.08), M.paintedMetal, g, (i - n / 2) * 0.06, 0.28, 0);
  m(C(0.015, 0.015, n * 0.06), M.paintedMetal, g, 0, 0.53, 0).rotation.z = Math.PI / 2;
  return g;
}
function jacket(p, M, x, y, z, ry, mat) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; p.add(g);
  const b = m(new THREE.CapsuleGeometry(0.15, 0.5, 6, 12), mat, g, 0, -0.38, 0.06); b.scale.set(1, 1, 0.42);
  m(C(0.008, 0.008, 0.08, 6), M.metal, g, 0, 0, 0.03).rotation.x = Math.PI / 2;
  return g;
}

// ============================================================ KORIDOR
export function corridorProps(G) {
  const M = MAT();
  // 204'un yaninda ayakkabilik + ayakkabilar (Turk apartmani klasigi)
  const rack = new THREE.Group(); rack.position.set(0.78, 0, 1.05); rack.rotation.y = -Math.PI / 2; G.add(rack);
  for (const y of [0.04, 0.26, 0.48]) m(B(0.62, 0.025, 0.3), M.darkWood, rack, 0, y, 0);
  for (const x of [-0.3, 0.3]) m(B(0.025, 0.5, 0.3), M.darkWood, rack, x, 0.25, 0);
  shoe(rack, M, -0.16, 0.0, 0.1, 0x2a2016).position.y = 0.055;
  shoe(rack, M, -0.04, 0.0, -0.05, 0x2a2016).position.y = 0.055;
  shoe(rack, M, 0.14, 0.0, 0.2, 0x6a6a6a).position.y = 0.275;
  shoe(rack, M, 0.02, 0.0, 0.0, 0x1c1c22).position.y = 0.275;
  shoe(G, M, 0.55, 1.45, 0.4, 0x30261c); shoe(G, M, 0.62, 1.62, 0.9, 0x30261c);
  // semsiye kapinin yaninda
  const um = m(C(0.03, 0.012, 0.85, 10), std({ color: 0x15151a, roughness: 0.6 }), G, 0.86, 0.45, -0.62); um.rotation.z = 0.12;
  m(C(0.005, 0.005, 0.12, 6), M.metal, G, 0.81, 0.92, -0.62);
  // elektrik sayac panosu (sol duvar)
  const box = m(B(0.06, 0.6, 0.45), M.paintedMetal, G, -0.92, 1.85, 1.6);
  m(B(0.005, 0.12, 0.16), M.glass, G, -0.888, 1.92, 1.52, 0, false);
  m(B(0.005, 0.12, 0.16), M.glass, G, -0.888, 1.92, 1.72, 0, false);
  for (let i = 0; i < 3; i++) m(C(0.006, 0.006, 1.2, 6), M.plastic, G, -0.93, 2.2 + 0.4, 1.45 + i * 0.12);
  // duyuru panosu + kagitlar
  m(B(0.02, 0.5, 0.7), std({ color: 0x5a4a32, roughness: 1 }), G, -0.935, 1.45, -1.1);
  TX.setSeed(31);
  for (let i = 0; i < 5; i++) { const p = m(new THREE.PlaneGeometry(0.16 + TX.rnd() * 0.06, 0.2 + TX.rnd() * 0.06), M.paper, G, -0.923, 1.35 + TX.rnd() * 0.2, -1.35 + i * 0.12, Math.PI / 2, false); p.rotation.z = (TX.rnd() - 0.5) * 0.2; }
  // kalorifer (sol duvar)
  radiator(G, M, -0.9, 2.7, Math.PI / 2, 12);
  // copp torbasi 203 kapisinin onunde
  const bag = m(new THREE.SphereGeometry(1, 16, 12), std({ color: 0x0b0b0c, roughness: 0.35 }), G, -0.7, 0.2, -2.95); bag.scale.set(0.2, 0.22, 0.18);
  m(new THREE.ConeGeometry(0.06, 0.12, 10), bag.material, G, -0.7, 0.45, -2.95);
  // yangin tupu (sol duvar)
  m(C(0.075, 0.075, 0.5, 16), M.red, G, -0.86, 0.6, -6.2);
  m(C(0.02, 0.02, 0.08, 8), M.darkMetal, G, -0.86, 0.89, -6.2);
  // saksi bitkisi koridor sonunda
  plant(G, M, 0.6, 0, -9.8, 1.2);
  plant(G, M, -0.65, 0, -8.6, 0.9);
  // kapi 204'un ustunde diafon + zil butonu
  m(B(0.02, 0.14, 0.09), M.ceramic, G, 0.935, 1.45, 0.66);
  m(C(0.012, 0.012, 0.012, 12), std({ color: 0x000000, emissive: 0xffd28a, emissiveIntensity: 1.5 }), G, 0.92, 1.42, 0.66, 0, false).rotation.z = Math.PI / 2;
  // tavanda kablo kanali ve eski armatur
  m(B(0.05, 0.03, 16), M.paintedMetal, G, 0.85, 2.66, -3, 0, false);
  // eski bisiklet duvara dayali (koridor derinliginde)
  const bike = new THREE.Group(); bike.position.set(0.82, 0, -3.8); bike.rotation.y = -Math.PI / 2; G.add(bike);
  for (const x of [-0.42, 0.42]) { const w = m(new THREE.TorusGeometry(0.3, 0.018, 8, 32), M.rubber, bike, x, 0.32, 0); }
  const fr = m(C(0.015, 0.015, 0.85, 8), M.darkMetal, bike, 0, 0.55, 0); fr.rotation.z = Math.PI / 2 - 0.25;
  m(C(0.015, 0.015, 0.5, 8), M.darkMetal, bike, 0.15, 0.45, 0).rotation.z = 0.6;
  m(B(0.2, 0.04, 0.08), M.rubber, bike, -0.2, 0.86, 0);
  // posta kutulari (koridor girisi, sol duvar)
  for (let i = 0; i < 6; i++) m(B(0.12, 0.18, 0.28), M.paintedMetal, G, -0.88, 1.35 + Math.floor(i / 3) * 0.2, 3.6 + (i % 3) * 0.3);
}

// ============================================================ DAIRE
export function flatProps(G) {
  const M = MAT();
  // masa ustu: kupa, kitaplar, anahtarlar, telefon sarj kablosu
  m(C(0.04, 0.036, 0.095, 18), M.ceramic, G, 0.3, 0.808, 0.5);
  m(new THREE.TorusGeometry(0.025, 0.007, 8, 16), M.ceramic, G, 0.345, 0.81, 0.5, Math.PI / 2);
  const books = [[0x3a2020, 0.03], [0x1f2a3a, 0.025], [0x2f3528, 0.035]];
  let y = 0.76; for (const [c, h] of books) { m(B(0.17, h, 0.24), std({ color: c, roughness: 0.8 }), G, -0.42, y + h / 2, 0.52, 0.15); y += h; }
  m(new THREE.TorusGeometry(0.012, 0.003, 6, 12), M.metal, G, 0.2, 0.763, 0.6, 0).rotation.x = Math.PI / 2;
  m(B(0.05, 0.004, 0.02), M.metal, G, 0.24, 0.762, 0.6);
  // TV unitesi + eski televizyon (on duvar)
  m(B(1.5, 0.45, 0.42), M.darkWood, G, 0.4, 0.225, 2.15);
  m(B(0.95, 0.56, 0.06), M.plastic, G, 0.4, 0.78, 2.22);
  m(B(0.9, 0.51, 0.005), M.glass, G, 0.4, 0.78, 2.189, 0, false);
  m(B(0.3, 0.03, 0.18), M.plastic, G, 0.4, 0.465, 2.22);
  m(B(0.35, 0.06, 0.25), M.plastic, G, 0.0, 0.48, 2.12); // modem
  m(new THREE.SphereGeometry(0.005, 6, 6), std({ color: 0x000000, emissive: 0x30ff60, emissiveIntensity: 5 }), G, -0.1, 0.49, 1.996, 0, false);
  // duvar saati (on duvar) - 02:04
  const clockT = canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#d9d2c2'; x.beginPath(); x.arc(128, 128, 124, 0, 6.28); x.fill();
    x.strokeStyle = '#1a1612'; x.lineWidth = 8; x.stroke();
    x.fillStyle = '#1a1612'; for (let i = 0; i < 12; i++) { const a = i / 12 * 6.28; x.fillRect(128 + Math.sin(a) * 100 - 3, 128 - Math.cos(a) * 100 - 8, 6, 16); }
    const hand = (a, l, wd) => { x.save(); x.translate(128, 128); x.rotate(a); x.fillRect(-wd / 2, -l, wd, l + 12); x.restore(); };
    hand((2 + 4 / 60) / 12 * 6.28, 60, 9); hand(4 / 60 * 6.28, 92, 6);
    x.fillStyle = '#8c1414'; hand(41 / 60 * 6.28, 100, 2);
  });
  const clk = m(new THREE.CircleGeometry(0.15, 32), std({ map: clockT, roughness: 0.4 }), G, -0.9, 1.85, 2.385, Math.PI, false);
  m(C(0.155, 0.155, 0.03, 32), M.darkWood, G, -0.9, 1.85, 2.395, 0, false).rotation.x = Math.PI / 2;
  // perdeler (pencere iki yani) + kalorifer
  for (const z of [-0.05, 0.95]) { const c = m(new THREE.CylinderGeometry(0.09, 0.12, 2.3, 10, 1, true), std({ color: 0x3b2a22, roughness: 1, side: THREE.DoubleSide }), G, 2.33, 1.25, z); c.scale.z = 0.6; }
  m(C(0.012, 0.012, 1.4, 8), M.metal, G, 2.35, 2.42, 0.45).rotation.x = Math.PI / 2;
  radiator(G, M, 2.33, 0.45, -Math.PI / 2, 10);
  plant(G, M, 2.0, 0, 1.55, 1.1);
  // sehpa (kanepe onunde) + kumanda + dergi
  m(B(0.5, 0.04, 0.9), M.darkWood, G, -1.1, 0.42, 0.3);
  for (const [x, z] of [[-1.3, -0.1], [-0.9, -0.1], [-1.3, 0.7], [-0.9, 0.7]]) m(B(0.04, 0.4, 0.04), M.darkWood, G, x, 0.2, z);
  m(B(0.05, 0.02, 0.16), M.plastic, G, -1.05, 0.45, 0.1, 0.3);
  m(B(0.22, 0.01, 0.3), M.paper, G, -1.15, 0.445, 0.5, -0.2);
  // ayakli lamba (sonuk) kanepe yaninda
  m(C(0.13, 0.15, 0.03), M.darkMetal, G, -1.45, 0.015, -2.25);
  m(C(0.012, 0.012, 1.55), M.darkMetal, G, -1.45, 0.8, -2.25);
  m(new THREE.CylinderGeometry(0.14, 0.2, 0.26, 20, 1, true), std({ color: 0x5c5040, roughness: 1, side: THREE.DoubleSide }), G, -1.45, 1.62, -2.25);
  m(new THREE.SphereGeometry(0.03, 10, 8), std({ color: 0x000000, emissive: 0xffb06a, emissiveIntensity: 6 }), G, -1.45, 1.58, -2.25, 0, false);
  const fl = new THREE.PointLight(0xff9f5a, 1.4, 4.5, 2); fl.position.set(-1.45, 1.55, -2.2); fl.intensity = 0.75; G.add(fl);
  // kanepe uzerinde battaniye
  const bl = m(B(0.7, 0.05, 0.6), M.fabricRed, G, -1.8, 0.45, 0.85, 0.2); bl.rotation.z = 0.08;
  // sol duvarda ek cerceveler
  frame(G, M, -2.38, 1.55, -0.95, 0.35, 0.45, Math.PI / 2, 0x2c3238);
  frame(G, M, -2.38, 1.95, 1.4, 0.3, 0.3, Math.PI / 2, 0x3a3028);
  // salon kosesinde karton kutular (yeni taşınmış hissi)
  m(B(0.5, 0.4, 0.4), std({ color: 0x6a5238, roughness: 1 }), G, -1.95, 0.2, -2.25, 0.2);
  m(B(0.4, 0.3, 0.35), std({ color: 0x5e4830, roughness: 1 }), G, -1.9, 0.55, -2.2, -0.1);
  // koridor agzi: askilik + ceketler, ayakkabilar, ayna
  jacket(G, M, -0.7, 1.75, -2.56, 0, M.fabricBlue);
  jacket(G, M, -0.95, 1.75, -2.56, 0, M.fabricDark);
  m(B(0.6, 0.03, 0.05), M.darkWood, G, -0.85, 1.76, -2.57);
  shoe(G, M, -0.8, -2.3, 1.4, 0x2a2016); shoe(G, M, -0.95, -2.25, 1.6, 0x2a2016);
  // dar koridorda: konsol + kase + anahtar, ayna, cerceveler
  m(B(0.26, 0.04, 0.7), M.darkWood, G, 0.36, 0.82, -3.3);
  for (const z of [-3.6, -3.0]) m(B(0.03, 0.8, 0.03), M.darkWood, G, 0.3, 0.4, z);
  m(new THREE.SphereGeometry(0.08, 16, 8, 0, 6.28, Math.PI / 2, Math.PI / 2), M.ceramic, G, 0.36, 0.92, -3.15).rotation.x = Math.PI;
  const mir = m(B(0.02, 0.6, 0.4), M.darkWood, G, 0.485, 1.45, -3.2, 0, false);
  m(B(0.005, 0.54, 0.34), std({ color: 0x20262e, roughness: 0.05, metalness: 0.9 }), G, 0.472, 1.45, -3.2, 0, false);
  frame(G, M, -0.485, 1.55, -3.9, 0.3, 0.4, Math.PI / 2, 0x30302c);
  frame(G, M, -0.485, 1.5, -4.8, 0.28, 0.28, Math.PI / 2, 0x2a2228);
  frame(G, M, 0.485, 1.6, -5.1, 0.25, 0.35, -Math.PI / 2, 0x26282e);
  // isik dugmesi
  m(B(0.02, 0.08, 0.08), M.ceramic, G, -0.49, 1.15, -2.75, 0, false);
}
