// Gercek insanin oturdugu oda (aksam/gece): pencere, masa lambasi, koltuk, kitaplik, bitki.
import * as THREE from 'three';
import * as TX from './textures.js';

const std = (o) => new THREE.MeshStandardMaterial(o);
function m(geo, mat, p, x, y, z, ry = 0, cast = true) { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.rotation.y = ry; o.castShadow = cast; o.receiveShadow = true; p.add(o); return o; }
const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
function rep(t, x, y) { const c = t.clone(); c.repeat.set(x, y); c.needsUpdate = true; return c; }

export function buildRoom() {
  const G = new THREE.Group(); G.name = 'room';
  const wp = TX.wallpaper(), pq = TX.parquet(), wood = TX.tableWood();
  const wall = std({ map: rep(wp, 3, 1.3), roughness: 0.9 });
  // zemin, duvarlar (oda: x -3..3, z -3..3)
  const fl = m(new THREE.PlaneGeometry(6, 6), std({ map: rep(pq, 4, 4), roughness: 0.5 }), G, 0, 0, 0, 0, false); fl.rotation.x = -Math.PI / 2;
  const back = m(new THREE.PlaneGeometry(6, 2.8), wall, G, 0, 1.4, -3, 0, false);
  const left = m(new THREE.PlaneGeometry(6, 2.8), wall, G, -3, 1.4, 0, Math.PI / 2, false);
  // sag duvar: pencere boslugu (z -0.8..0.8, y 0.9..2.2)
  const rw = (w, h, y, z) => m(new THREE.PlaneGeometry(w, h), wall, G, 3, y, z, -Math.PI / 2, false);
  rw(2.2, 2.8, 1.4, -1.9); rw(2.2, 2.8, 1.4, 1.9); rw(1.6, 0.9, 0.45, 0); rw(1.6, 0.6, 2.5, 0);
  const ce = m(new THREE.PlaneGeometry(6, 6), std({ color: 0x2a2620, roughness: 1 }), G, 0, 2.8, 0, 0, false); ce.rotation.x = Math.PI / 2;
  // pencere: gece sehir manzarasi
  const nv = TX.nightView(707);
  m(new THREE.PlaneGeometry(1.6, 1.3), std({ color: 0x000000, emissive: 0xffffff, emissiveMap: nv, emissiveIntensity: 1.3 }), G, 3.05, 1.55, 0, -Math.PI / 2, false);
  const fr = std({ color: 0xd8d2c4, roughness: 0.5 });
  m(B(0.06, 0.06, 1.66), fr, G, 2.98, 0.9, 0, 0); m(B(0.06, 0.06, 1.66), fr, G, 2.98, 2.2, 0, 0);
  m(B(0.06, 1.36, 0.06), fr, G, 2.98, 1.55, 0.8, 0); m(B(0.06, 1.36, 0.06), fr, G, 2.98, 1.55, -0.8, 0); m(B(0.05, 1.3, 0.04), fr, G, 2.98, 1.55, 0, 0);
  m(B(0.25, 0.04, 1.8), fr, G, 2.88, 0.88, 0, 0);
  // perdeler
  for (const z of [-1.05, 1.05]) { const c = m(new THREE.CylinderGeometry(0.12, 0.16, 2.5, 12, 1, true), std({ color: 0x5a6a73, roughness: 1, side: THREE.DoubleSide }), G, 2.9, 1.3, z); c.scale.x = 0.5; }
  // koltuk (insan burada oturur, kameraya donuk: +z yonune bakar)
  const fab = std({ color: 0x3d5a63, roughness: 1, bumpMap: TX.fabricBump(), bumpScale: 0.5 });
  const ch = new THREE.Group(); ch.position.set(0, 0, -0.45); G.add(ch);
  m(B(0.9, 0.42, 0.8), fab, ch, 0, 0.21, 0); m(B(0.9, 0.75, 0.2), fab, ch, 0, 0.75, -0.32);
  m(B(0.16, 0.6, 0.8), fab, ch, -0.45, 0.4, 0); m(B(0.16, 0.6, 0.8), fab, ch, 0.45, 0.4, 0);
  for (const [x, z] of [[-0.38, -0.32], [0.38, -0.32], [-0.38, 0.32], [0.38, 0.32]]) m(new THREE.CylinderGeometry(0.025, 0.02, 0.1), std({ color: 0x2a1a10 }), ch, x, 0.05, z);
  // yan sehpa + masa lambasi (sicak isik)
  const tw = std({ map: wood, roughness: 0.5 });
  m(new THREE.CylinderGeometry(0.28, 0.28, 0.03, 32), tw, G, 0.85, 0.6, -0.3); m(new THREE.CylinderGeometry(0.03, 0.03, 0.6), tw, G, 0.85, 0.3, -0.3);
  m(new THREE.CylinderGeometry(0.06, 0.08, 0.3, 16), std({ color: 0xcfc6b0, roughness: 0.4 }), G, 0.92, 0.76, -0.38);
  m(new THREE.CylinderGeometry(0.14, 0.2, 0.22, 24, 1, true), std({ color: 0xf0e2c0, emissive: 0xffb060, emissiveIntensity: 1.2, side: THREE.DoubleSide, roughness: 1 }), G, 0.92, 1.02, -0.38);
  m(new THREE.CylinderGeometry(0.045, 0.04, 0.11, 18), std({ color: 0xe9e3d8, roughness: 0.3 }), G, 0.7, 0.67, -0.18); // kupa
  const lamp = new THREE.PointLight(0xffb36a, 4.5, 6, 2); lamp.position.set(0.92, 1.0, -0.38); lamp.castShadow = true; lamp.shadow.mapSize.set(512, 512); lamp.shadow.bias = -0.002; G.add(lamp);
  // pencereden soguk ay/sehir isigi
  const moon = new THREE.SpotLight(0x8ea8ff, 22, 9, 0.7, 0.8, 1.2); moon.position.set(3.6, 2.2, 0.2); moon.target.position.set(0, 0.9, -0.3); moon.castShadow = true; moon.shadow.mapSize.set(1024, 1024); moon.shadow.bias = -0.0004; G.add(moon, moon.target);
  // kameranin arkasindan yumusak dolgu
  const fill = new THREE.PointLight(0x9a8cff, 0.8, 8, 2); fill.position.set(-1.2, 1.8, 2.4); G.add(fill);
  G.add(new THREE.HemisphereLight(0x3a4466, 0x120e0c, 0.45));
  // kitaplik (sol arka)
  const sh = new THREE.Group(); sh.position.set(-2.1, 0, -2.75); G.add(sh);
  m(B(1.2, 2.1, 0.35), tw, sh, 0, 1.05, 0);
  TX.setSeed(5); const bc = [0x7a2a24, 0x2a4a6a, 0xb08a3a, 0x2f5a3a, 0x5a3a6a, 0xd8d0c0];
  for (let r = 0; r < 4; r++) { let x = -0.55; while (x < 0.52) { const w = 0.03 + TX.rnd() * 0.04, h = 0.24 + TX.rnd() * 0.12; m(B(w, h, 0.24), std({ color: bc[Math.floor(TX.rnd() * 6)], roughness: 0.8 }), sh, x + w / 2, 0.2 + r * 0.5 + h / 2, 0.08); x += w + 0.005; } }
  // bitki (sag arka)
  const pot = new THREE.Group(); pot.position.set(2.2, 0, -2.4); G.add(pot);
  m(new THREE.CylinderGeometry(0.2, 0.15, 0.35, 20), std({ color: 0xc8b8a0, roughness: 0.6 }), pot, 0, 0.175, 0);
  TX.setSeed(9); const leaf = std({ color: 0x2f5a2a, roughness: 0.7, side: THREE.DoubleSide });
  for (let i = 0; i < 22; i++) { const a = TX.rnd() * 6.28, h = 0.5 + TX.rnd() * 0.7; const l = m(new THREE.PlaneGeometry(0.12, h), leaf, pot, Math.cos(a) * 0.06, 0.35 + h / 2, Math.sin(a) * 0.06, a); l.rotation.z = 0.35 * Math.cos(a); l.rotation.x = 0.35 * Math.sin(a); }
  // hali
  const rg = m(new THREE.PlaneGeometry(2.4, 1.8), std({ map: TX.rug(), roughness: 1 }), G, 0, 0.003, 0.4, 0, false); rg.rotation.x = -Math.PI / 2; rg.rotation.z = Math.PI / 2;
  // duvarda cerceveler
  for (const [x, y, w, h, c] of [[-0.9, 1.75, 0.5, 0.65, 0x3a5060], [-0.2, 1.85, 0.35, 0.35, 0x6a4a3a], [0.5, 1.7, 0.4, 0.55, 0x2a3a3a]]) {
    m(B(w, h, 0.03), std({ color: 0x1a120c, roughness: 0.5 }), G, x, y, -2.98, 0, false);
    m(B(w * 0.82, h * 0.82, 0.01), std({ color: c, roughness: 0.8 }), G, x, y, -2.96, 0, false);
  }
  return { G, lamp, moon };
}
