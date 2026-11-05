// Mekanlar: apartman koridoru (Kapi 204) ve daire ici (salon + karanlik koridor + yatak odasi kapisi)
import * as THREE from 'three';
import * as TX from './textures.js';
import { corridorProps, flatProps } from './props.js';

const std = (o) => new THREE.MeshStandardMaterial(o);
function mesh(geo, mat, parent, x = 0, y = 0, z = 0, cast = true, recv = true) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = recv; parent.add(m); return m;
}
function box(parent, w, h, d, mat, x, y, z, cast = true) { return mesh(new THREE.BoxGeometry(w, h, d), mat, parent, x, y, z, cast); }
function repTex(t, rx, ry) { const c = t.clone(); c.repeat.set(rx, ry); c.needsUpdate = true; return c; }
// duvar parcasi: (x,z) normal yonunde, uzunluk L, yukseklik araligi
function wall(parent, tex, L, y0, y1, pos, rotY, texH = 2.7, rough = 0.9) {
  const g = new THREE.PlaneGeometry(L, y1 - y0);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * L / 2.0, (y0 + uv.getY(i) * (y1 - y0)) / texH);
  const m = std({ map: tex, roughness: rough, bumpMap: tex, bumpScale: 0.4 });
  const w = mesh(g, m, parent, pos[0], (y0 + y1) / 2, pos[1], false, true); w.rotation.y = rotY; return w;
}

// ======================================================= KORIDOR
export function buildCorridor(shared) {
  const G = new THREE.Group(); G.name = 'corridor';
  const wallT = TX.corridorWall(); const floorT = TX.terrazzo(); const ceilT = TX.ceiling();
  // zemin
  const fl = mesh(new THREE.PlaneGeometry(1.9, 16), std({ map: repTex(floorT, 1.9 / 0.8, 16 / 0.8), roughness: 0.45, metalness: 0.0 }), G, 0, 0, -3, false, true);
  fl.rotation.x = -Math.PI / 2;
  const ce = mesh(new THREE.PlaneGeometry(1.9, 16), std({ map: repTex(ceilT, 1, 8), roughness: 1 }), G, 0, 2.7, -3, false, true);
  ce.rotation.x = Math.PI / 2;
  // sol duvar (x=-0.95), sag duvar (x=+0.95) kapi boslugu ile
  wall(G, wallT, 16, 0, 2.7, [-0.95, -3], Math.PI / 2);
  wall(G, wallT, 4.55, 0, 2.7, [0.95, 0.45 + 4.55 / 2], -Math.PI / 2);
  wall(G, wallT, 10.55, 0, 2.7, [0.95, -0.45 - 10.55 / 2], -Math.PI / 2);
  wall(G, wallT, 0.9, 2.06, 2.7, [0.95, 0], -Math.PI / 2);
  // arka/on duvar
  wall(G, wallT, 1.9, 0, 2.7, [0, 5], Math.PI);
  // supurgelik
  const skirt = std({ color: 0x1e1a16, roughness: 0.6 });
  box(G, 0.02, 0.1, 16, skirt, -0.94, 0.05, -3, false);
  box(G, 0.02, 0.1, 4.55, skirt, 0.94, 0.05, 0.45 + 4.55 / 2, false);
  box(G, 0.02, 0.1, 10.55, skirt, 0.94, 0.05, -0.45 - 10.55 / 2, false);
  // tavanda boru
  const pipe = std({ color: 0x5a554c, roughness: 0.6, metalness: 0.3 });
  const p = mesh(new THREE.CylinderGeometry(0.035, 0.035, 16, 12), pipe, G, -0.85, 2.58, -3); p.rotation.x = Math.PI / 2;

  // ---- KAPI 204
  const woodT = TX.doorWood();
  const frameM = std({ color: 0x2b1c13, roughness: 0.7 });
  box(G, 0.05, 2.12, 0.07, frameM, 0.94, 1.06, 0.485);
  box(G, 0.05, 2.12, 0.07, frameM, 0.94, 1.06, -0.485);
  box(G, 0.05, 0.07, 1.04, frameM, 0.94, 2.09, 0);
  const pivot = new THREE.Group(); pivot.position.set(0.975, 0, 0.445); G.add(pivot);
  const doorM = std({ map: woodT, roughness: 0.55, bumpMap: woodT, bumpScale: 1.2 });
  const slab = box(pivot, 0.045, 2.04, 0.88, doorM, 0, 1.02, -0.44);
  // plaka, kulp, gozetleme deligi
  const plate = mesh(new THREE.PlaneGeometry(0.16, 0.08), std({ map: TX.numberPlate('204'), roughness: 0.3, metalness: 0.55 }), pivot, -0.024, 1.58, -0.44, false);
  plate.rotation.y = -Math.PI / 2;
  const brass = std({ color: 0xb28a45, roughness: 0.3, metalness: 0.8 });
  const peep = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.02, 16), brass, pivot, -0.03, 1.45, -0.44); peep.rotation.z = Math.PI / 2;
  const rose = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.012, 20), brass, pivot, -0.028, 1.0, -0.8); rose.rotation.z = Math.PI / 2;
  const lever = box(pivot, 0.025, 0.02, 0.12, brass, -0.05, 1.0, -0.75);
  box(pivot, 0.02, 0.06, 0.03, brass, -0.03, 0.9, -0.8);
  // daire ici (kapi arkasi): sicak los antre
  const inWall = TX.wallpaper();
  const ent = new THREE.Group(); G.add(ent);
  const ef = mesh(new THREE.PlaneGeometry(2.6, 2.9), std({ map: repTex(TX.parquet(), 2, 2), roughness: 0.6 }), ent, 2.25, 0.001, 0.15, false); ef.rotation.x = -Math.PI / 2;
  wall(ent, inWall, 2.9, 0, 2.6, [3.5, 0.15], -Math.PI / 2, 2.6);
  wall(ent, inWall, 2.6, 0, 2.6, [2.25, -1.3], 0, 2.6);
  wall(ent, inWall, 2.6, 0, 2.6, [2.25, 1.6], Math.PI, 2.6);
  const ec = mesh(new THREE.PlaneGeometry(2.6, 2.9), std({ color: 0x3a342c, roughness: 1 }), ent, 2.25, 2.6, 0.15, false); ec.rotation.x = Math.PI / 2;
  // portmanto ve ceket silueti
  const coatM = std({ color: 0x1b1b1d, roughness: 1 });
  box(ent, 0.04, 1.8, 0.04, coatM, 3.3, 0.9, 1.1);
  mesh(new THREE.CapsuleGeometry(0.16, 0.6, 6, 12), coatM, ent, 3.25, 1.2, 1.05).scale.set(1, 1, 0.5);
  const warm = new THREE.SpotLight(0xffb070, 9, 7, 0.9, 0.8, 2);
  warm.position.set(2.9, 2.45, 0.4); warm.target.position.set(0.6, 0, 0.0); warm.castShadow = true;
  warm.shadow.mapSize.set(1024, 1024); warm.shadow.bias = -0.0004; warm.shadow.normalBias = 0.02;
  ent.add(warm, warm.target);
  const warmFill = new THREE.PointLight(0xff9a55, 1.6, 4, 2); warmFill.position.set(2.6, 1.8, -0.6); ent.add(warmFill);

  // komsu kapilar
  const d2 = TX.doorWood('#2e2a26', 55);
  for (const [x, z, rot, num] of [[-0.93, -3.4, Math.PI / 2, '203'], [0.93, -5.2, -Math.PI / 2, '205'], [-0.93, -7.6, Math.PI / 2, '201']]) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; G.add(g);
    box(g, 0.98, 2.1, 0.04, frameM, 0, 1.05, 0.0);
    box(g, 0.88, 2.04, 0.05, std({ map: d2, roughness: 0.6, bumpMap: d2, bumpScale: 1 }), 0, 1.02, 0.025);
    const pl = mesh(new THREE.PlaneGeometry(0.14, 0.07), std({ map: TX.numberPlate(num), roughness: 0.4, metalness: 0.5 }), g, 0, 1.58, 0.052, false);
    box(g, 0.1, 0.02, 0.03, brass, 0.32, 1.0, 0.06);
  }
  // paspas
  const mat = mesh(new THREE.PlaneGeometry(0.42, 0.65), std({ map: TX.doormat(), roughness: 1 }), G, 0.68, 0.004, 0.0, false); mat.rotation.x = -Math.PI / 2;

  // otomatik isik dugmesi (turuncu led)
  box(G, 0.02, 0.1, 0.07, std({ color: 0x8c877c, roughness: 0.6 }), 0.94, 1.32, 0.68, false);
  const led = mesh(new THREE.SphereGeometry(0.006, 8, 8), std({ color: 0x000000, emissive: 0xff6a10, emissiveIntensity: 6 }), G, 0.927, 1.34, 0.68, false);

  // floresan armatur (kapinin ustunde)
  const fix = box(G, 0.14, 0.05, 0.9, std({ color: 0x77736a, roughness: 0.6 }), 0.15, 2.67, 0.6, false);
  const tubeM = std({ color: 0x000000, emissive: 0xd8ecff, emissiveIntensity: 6 });
  const tube = mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.82, 10), tubeM, G, 0.15, 2.63, 0.6, false); tube.rotation.x = Math.PI / 2;
  const fluo = new THREE.SpotLight(0xd6e6ff, 26, 9, 1.25, 0.9, 2);
  fluo.position.set(0.15, 2.6, 0.6); fluo.target.position.set(0.4, 0, 0.0); fluo.castShadow = true;
  fluo.shadow.mapSize.set(1024, 1024); fluo.shadow.bias = -0.0004; fluo.shadow.normalBias = 0.02;
  G.add(fluo, fluo.target);
  // uzakta olu floresan + cikis tabelasi + pencere/ay isigi
  const tube2 = mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.82, 10), std({ color: 0x000000, emissive: 0xbfd6ff, emissiveIntensity: 0.4 }), G, 0.15, 2.63, -5.5, false); tube2.rotation.x = Math.PI / 2;
  box(G, 0.14, 0.05, 0.9, std({ color: 0x77736a, roughness: 0.6 }), 0.15, 2.67, -5.5, false);
  const exitM = std({ color: 0x000000, emissive: 0x18ff6a, emissiveIntensity: 3 });
  box(G, 0.3, 0.12, 0.03, exitM, 0, 2.35, -10.8, false);
  const exitL = new THREE.PointLight(0x30ff80, 0.6, 3, 2); exitL.position.set(0, 2.25, -10.5); G.add(exitL);
  // koridor sonu pencere
  const nv = TX.nightView(404); const win = mesh(new THREE.PlaneGeometry(1.0, 1.3), std({ color: 0x000000, emissive: 0xffffff, emissiveMap: nv, emissiveIntensity: 2.6 }), G, 0, 1.5, -10.98, false);
  const wf = std({ color: 0x1a1a1a, roughness: 0.7 });
  box(G, 1.05, 0.04, 0.05, wf, 0, 1.5, -10.96, false); box(G, 0.04, 1.35, 0.05, wf, 0, 1.5, -10.96, false);
  wall(G, wallT, 1.9, 0, 2.7, [0, -11], 0);
  const moon = new THREE.SpotLight(0x7d98ff, 30, 16, 0.5, 1, 1.1);
  moon.position.set(0, 1.8, -10.7); moon.target.position.set(0, 0, -3); G.add(moon, moon.target);
  const amb = new THREE.HemisphereLight(0x2c3f66, 0x0a0b0f, 0.42); G.add(amb);

  // karanlik siluet: koridorun ucunda, pencerenin onunde (yalnizca acilis cekiminde)
  const figM = new THREE.MeshBasicMaterial({ color: 0x010102 });
  const figure = new THREE.Group(); figure.position.set(0.22, 0, -10.05); G.add(figure);
  const fb = mesh(new THREE.CapsuleGeometry(0.19, 0.95, 6, 12), figM, figure, 0, 0.95, 0, false, false); fb.scale.z = 0.55;
  mesh(new THREE.SphereGeometry(0.11, 16, 12), figM, figure, 0, 1.78, 0, false, false);
  for (const sx of [-1, 1]) { const a = mesh(new THREE.CapsuleGeometry(0.05, 0.62, 4, 8), figM, figure, 0.23 * sx, 1.08, 0, false, false); a.rotation.z = 0.05 * sx; }
  for (const sx of [-1, 1]) mesh(new THREE.CapsuleGeometry(0.07, 0.6, 4, 8), figM, figure, 0.09 * sx, 0.35, 0, false, false);
  // ---- PAKET (koridor)
  const pkg = shared.makePackage(); pkg.group.position.set(0.66, 0.0, 0.05); pkg.group.rotation.y = 0.35; G.add(pkg.group);

  corridorProps(G);
  return { G, figure, door: pivot, fluo, tubeM, tube2, pkg, warm, warmFill, led };
}

// ======================================================= DAIRE ICI
export function buildFlat(shared) {
  const G = new THREE.Group(); G.name = 'flat';
  const wp = TX.wallpaper(); const pq = TX.parquet();
  const H = 2.6;
  const fl = mesh(new THREE.PlaneGeometry(4.8, 12), std({ map: repTex(pq, 4.8 / 1.6, 12 / 1.6), roughness: 0.55 }), G, 0, 0, -3.3, false, true); fl.rotation.x = -Math.PI / 2;
  const ce = mesh(new THREE.PlaneGeometry(4.8, 12), std({ color: 0x2e2a25, roughness: 1 }), G, 0, H, -3.3, false, true); ce.rotation.x = Math.PI / 2;
  // salon duvarlari: x=-2.4..2.4, z=-2.6..2.4
  wall(G, wp, 5.0, 0, H, [-2.4, -0.1], Math.PI / 2, H);
  wall(G, wp, 1.6, 0, H, [2.4, 1.6], -Math.PI / 2, H);       // pencere cevresi
  wall(G, wp, 2.7, 0, H, [2.4, -1.25], -Math.PI / 2, H);
  wall(G, wp, 0.7, 0, 0.9, [2.4, 0.45], -Math.PI / 2, H);
  wall(G, wp, 0.7, 2.2, H, [2.4, 0.45], -Math.PI / 2, H);
  wall(G, wp, 4.8, 0, H, [0, 2.4], Math.PI, H);
  // arka duvar, koridor agzi x=-0.5..0.5
  wall(G, wp, 1.9, 0, H, [-1.45, -2.6], 0, H);
  wall(G, wp, 1.9, 0, H, [1.45, -2.6], 0, H);
  wall(G, wp, 1.0, 2.1, H, [0, -2.6], 0, H);
  // dar koridor z=-2.6..-6.2
  wall(G, wp, 3.6, 0, H, [-0.5, -4.4], Math.PI / 2, H);
  wall(G, wp, 3.6, 0, H, [0.5, -4.4], -Math.PI / 2, H);
  const skirt = std({ color: 0x1a140f, roughness: 0.6 });
  box(G, 0.02, 0.09, 3.6, skirt, -0.49, 0.045, -4.4, false); box(G, 0.02, 0.09, 3.6, skirt, 0.49, 0.045, -4.4, false);
  // yatak odasi kapisi duvari (z=-6.2), kapi boslugu x=-0.42..0.42
  wall(G, wp, 0.08, 0, H, [-0.46, -6.2], 0, H); wall(G, wp, 0.08, 0, H, [0.46, -6.2], 0, H);
  wall(G, wp, 0.84, 2.04, H, [0, -6.2], 0, H);
  const frameM = std({ color: 0xcfc6b4, roughness: 0.6 });
  box(G, 0.05, 2.08, 0.06, frameM, -0.445, 1.04, -6.18); box(G, 0.05, 2.08, 0.06, frameM, 0.445, 1.04, -6.18); box(G, 0.94, 0.05, 0.06, frameM, 0, 2.065, -6.18);
  // kapi: menteşe x=-0.42, yatak odasina dogru acilir
  const bdPivot = new THREE.Group(); bdPivot.position.set(-0.42, 0, -6.22); G.add(bdPivot);
  const bdM = std({ color: 0xbdb3a0, roughness: 0.55 });
  const bd = box(bdPivot, 0.84, 2.02, 0.04, bdM, 0.42, 1.025, 0);
  box(bdPivot, 0.1, 0.02, 0.03, std({ color: 0x8a8a8a, metalness: 0.8, roughness: 0.3 }), 0.76, 1.0, 0.03);
  for (const yy of [0.55, 1.5]) box(bdPivot, 0.64, 0.6, 0.006, std({ color: 0xb0a690, roughness: 0.6 }), 0.42, yy, 0.022);
  // yatak odasi (soguk, ay isigi)
  const bed = new THREE.Group(); G.add(bed);
  const bf = mesh(new THREE.PlaneGeometry(3, 3), std({ map: repTex(pq, 2, 2), roughness: 0.6 }), bed, 0, 0.001, -7.7, false); bf.rotation.x = -Math.PI / 2;
  wall(bed, wp, 3, 0, H, [0, -9.2], 0, H); wall(bed, wp, 3, 0, H, [-1.5, -7.7], Math.PI / 2, H); wall(bed, wp, 3, 0, H, [1.5, -7.7], -Math.PI / 2, H);
  wall(bed, wp, 1.0, 0, H, [-1.0, -6.24], Math.PI, H); wall(bed, wp, 1.0, 0, H, [1.0, -6.24], Math.PI, H);
  box(bed, 1.4, 0.45, 2.0, std({ color: 0x3a4250, roughness: 1 }), 0.6, 0.225, -8.1);
  const bedMoon = new THREE.SpotLight(0x7f9bff, 30, 6, 0.9, 1, 1.5); bedMoon.position.set(1.3, 2.3, -8.8); bedMoon.target.position.set(-0.2, 0, -6.6); bed.add(bedMoon, bedMoon.target);
  // kapi altindan sizan isik (zemin uzerinde soguk isik havuzu)
  const gapGlowM = new THREE.MeshBasicMaterial({ color: 0x9fb5ff, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false });
  const gapGlow = mesh(new THREE.PlaneGeometry(1.0, 4.7), gapGlowM, G, 0, 0.004, -3.85, false, false); gapGlow.rotation.x = -Math.PI / 2;
  {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256; const x = c.getContext('2d');
    const g = x.createRadialGradient(128, 0, 5, 128, 0, 256); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.15, 'rgba(255,255,255,0.4)'); g.addColorStop(0.6, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256); gapGlowM.map = new THREE.CanvasTexture(c); gapGlowM.alphaMap = gapGlowM.map;
  }
  const gapLine = mesh(new THREE.PlaneGeometry(0.84, 0.012), new THREE.MeshBasicMaterial({ color: 0xb8c8ff }), G, 0, 0.007, -6.19, false, false);
  // koridor ucu: tavandan sarkan sonuk ampul
  mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.4, 4), std({ color: 0x111111 }), G, 0, 2.4, -4.6, false);
  mesh(new THREE.SphereGeometry(0.04, 12, 10), std({ color: 0x555048, roughness: 0.2 }), G, 0, 2.18, -4.6, false);
  const hallL = new THREE.SpotLight(0x8ea4d8, 2.2, 6, 0.8, 1, 1.5); hallL.position.set(0, 2.5, -3.2); hallL.target.position.set(0, 0, -4.8); G.add(hallL, hallL.target);
  // tablo/cerceve koridorda
  box(G, 0.02, 0.5, 0.38, std({ color: 0x1a1410, roughness: 0.6 }), 0.485, 1.5, -3.6);
  box(G, 0.01, 0.42, 0.3, std({ color: 0x2a2f30, roughness: 0.9 }), 0.475, 1.5, -3.6, false);

  // ---- mobilya
  const woodT = TX.tableWood();
  const tw = std({ map: woodT, roughness: 0.5, bumpMap: woodT, bumpScale: 0.6 });
  const rugM = mesh(new THREE.PlaneGeometry(1.8, 2.4), std({ map: TX.rug(), roughness: 1 }), G, 0, 0.003, 0.2, false); rugM.rotation.x = -Math.PI / 2; rugM.rotation.z = Math.PI / 2;
  const table = new THREE.Group(); table.position.set(0, 0, 0.3); G.add(table);
  box(table, 1.15, 0.04, 0.78, tw, 0, 0.74, 0);
  for (const [x, z] of [[-0.52, -0.33], [0.52, -0.33], [-0.52, 0.33], [0.52, 0.33]]) box(table, 0.05, 0.72, 0.05, tw, x, 0.36, z);
  // sandalye (adam masanin -z tarafinda, +z'ye bakar)
  const chair = new THREE.Group(); chair.position.set(0, 0, -0.42); G.add(chair);
  box(chair, 0.44, 0.04, 0.42, tw, 0, 0.46, 0);
  box(chair, 0.44, 0.5, 0.03, tw, 0, 0.74, -0.2);
  for (const [x, z] of [[-0.19, -0.18], [0.19, -0.18], [-0.19, 0.18], [0.19, 0.18]]) box(chair, 0.035, 0.46, 0.035, tw, x, 0.23, z);
  // karsi sandalye
  const chair2 = chair.clone(); chair2.position.set(0, 0, 1.05); chair2.rotation.y = Math.PI; G.add(chair2);
  // kanepe (sol)
  const sofaM = std({ color: 0x3b3430, roughness: 1, bumpMap: TX.fabricBump(), bumpScale: 0.5 });
  const sofa = new THREE.Group(); sofa.position.set(-1.95, 0, 0.3); sofa.rotation.y = Math.PI / 2; G.add(sofa);
  box(sofa, 1.9, 0.42, 0.85, sofaM, 0, 0.21, 0); box(sofa, 1.9, 0.5, 0.2, sofaM, 0, 0.62, -0.33);
  box(sofa, 0.2, 0.6, 0.85, sofaM, -0.95, 0.3, 0); box(sofa, 0.2, 0.6, 0.85, sofaM, 0.95, 0.3, 0);
  mesh(new THREE.SphereGeometry(0.2, 16, 12), std({ color: 0x5a3a30, roughness: 1 }), sofa, 0.6, 0.55, -0.15).scale.set(1, 0.7, 0.4);
  // kitaplik (sag arka)
  const shelf = new THREE.Group(); shelf.position.set(1.6, 0, -2.42); G.add(shelf);
  box(shelf, 0.9, 1.9, 0.32, tw, 0, 0.95, 0);
  const bookCols = [0x3a2020, 0x1f2a3a, 0x3a3420, 0x202020, 0x4a3a2a, 0x283028];
  TX.setSeed(55);
  for (let r = 0; r < 4; r++) { let x = -0.4; while (x < 0.38) { const w = 0.03 + TX.rnd() * 0.04, h = 0.22 + TX.rnd() * 0.1; box(shelf, w, h, 0.22, std({ color: bookCols[Math.floor(TX.rnd() * 6)], roughness: 0.8 }), x + w / 2, 0.15 + r * 0.45 + h / 2, 0.1); x += w + 0.004; } }
  // duvarda cerceve (sol duvar)
  box(G, 0.03, 0.6, 0.8, std({ color: 0x15110d, roughness: 0.5 }), -2.38, 1.6, 0.3, false);
  box(G, 0.01, 0.5, 0.7, std({ color: 0x3a4038, roughness: 0.9 }), -2.36, 1.6, 0.3, false);
  // pencere + jaluzi (sag duvar x=2.4, z=0.1..0.8)
  const winM = std({ color: 0x000000, emissive: 0xffffff, emissiveMap: TX.nightView(505), emissiveIntensity: 1.6 });
  mesh(new THREE.PlaneGeometry(0.7, 1.3), winM, G, 2.42, 1.55, 0.45, false).rotation.y = -Math.PI / 2;
  const slatM = std({ color: 0x8d877a, roughness: 0.7 });
  for (let i = 0; i < 20; i++) { const s = box(G, 0.01, 0.035, 0.72, slatM, 2.37, 0.92 + i * 0.065, 0.45, true); s.rotation.z = 0.5; }
  // MASA LAMBASI (sicak pratik isik)
  const lamp = new THREE.Group(); lamp.position.set(0.5, 0.76, -0.02); G.add(lamp);
  const lampM = std({ color: 0x1c1c1c, roughness: 0.4, metalness: 0.6 });
  mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.02, 20), lampM, lamp, 0, 0.01, 0);
  const arm = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.38, 8), lampM, lamp, 0, 0.19, 0);
  const shade = mesh(new THREE.ConeGeometry(0.09, 0.13, 24, 1, true), std({ color: 0x1a1a1a, roughness: 0.5, metalness: 0.4, side: THREE.DoubleSide }), lamp, -0.05, 0.38, 0.0);
  shade.rotation.z = -0.45;
  const bulb = mesh(new THREE.SphereGeometry(0.025, 12, 10), std({ color: 0x000000, emissive: 0xffc27a, emissiveIntensity: 12 }), lamp, -0.07, 0.35, 0.0, false, false);
  const lampL = new THREE.SpotLight(0xffc58a, 7, 5, 1.1, 0.7, 2);
  lampL.position.set(0.43, 1.1, -0.02); lampL.target.position.set(-0.05, 0.76, 0.2); lampL.castShadow = true;
  lampL.shadow.mapSize.set(1024, 1024); lampL.shadow.bias = -0.0003; lampL.shadow.normalBias = 0.015; lampL.shadow.camera.near = 0.05;
  G.add(lampL, lampL.target);
  const lampFill = new THREE.PointLight(0xff9c55, 0.7, 4, 2); lampFill.position.set(0.4, 1.15, 0.0); G.add(lampFill);
  // ay isigi (jaluziden cizgili)
  const moon = new THREE.SpotLight(0x8aa2ff, 60, 9, 0.42, 0.5, 1.1);
  moon.position.set(4.2, 2.8, 0.6); moon.target.position.set(0.2, 0.3, 0.2); moon.map = TX.blindsCookie(); moon.castShadow = true;
  moon.shadow.mapSize.set(1024, 1024); moon.shadow.bias = -0.0004; moon.shadow.normalBias = 0.02;
  G.add(moon, moon.target);
  const amb = new THREE.HemisphereLight(0x263759, 0x090a0d, 0.42); G.add(amb);
  // ikinci ay isigi: jaluziden arka duvara ve koridor agzina cizgili soguk isik (gece hissi)
  const moon2 = new THREE.SpotLight(0x8aa2ff, 45, 10, 0.5, 0.45, 1.1);
  moon2.position.set(4.0, 2.5, 0.5); moon2.target.position.set(-1.1, 1.1, -2.6); moon2.map = TX.blindsCookie();
  G.add(moon2, moon2.target);

  // golge (yatak odasi kapisinin altindan surunen) - shader decal
  const shadowM = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { prog: { value: 0 }, time: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
    fragmentShader: `varying vec2 vUv; uniform float prog; uniform float time;
      float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
      float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p*=2.03;a*=.5;}return v;}
      void main(){
        // vUv.y: 0 = kapi, 1 = adamin ayaklari. vUv.x: 0..1 genislik
        float x = (vUv.x-.5);
        float along = vUv.y;
        // parmak benzeri uzantilar
        float tend = fbm(vec2(x*7.0, along*2.0 - time*0.6));
        float width = mix(0.45, 0.12, smoothstep(0.0, 1.0, along)) + 0.15*tend;
        float front = prog*(0.85 + 0.35*fbm(vec2(x*5.0+3.0, time*0.8)));
        float body = 1.0 - smoothstep(width-0.12, width, abs(x + 0.08*sin(along*6.0+time*1.5)*along));
        float reach = 1.0 - smoothstep(front-0.18, front, along);
        float a = body*reach;
        a *= 0.75 + 0.25*fbm(vec2(x*12.0, along*9.0 - time));
        gl_FragColor = vec4(0.0,0.0,0.005, clamp(a*0.97,0.0,0.97));
      }`
  });
  const shadow = mesh(new THREE.PlaneGeometry(1.4, 4.8), shadowM, G, 0, 0.009, -6.2 + 2.4, false, false);
  shadow.rotation.x = -Math.PI / 2; shadow.renderOrder = 5;
  // uv.y plane ust kenari (z=-6.2) 1 -> tersine cevir
  { const uv = shadow.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i)); }

  // ---- PAKET (daire ici, ayni nesne tasarimi)
  const pkg = shared.makePackage(); pkg.group.position.set(0, 0.76, 0.18); G.add(pkg.group);

  flatProps(G);
  return { G, hallL, table, chair, bdPivot, gapGlowM, gapLine, lampL, lampFill, moon, shadowM, pkg, bulb, bedMoon, amb };
}

// ======================================================= ORTAK: SIYAH PAKET
export function makePackage() {
  const g = new THREE.Group();
  const black = std({ color: 0x0d0d0f, roughness: 0.62, metalness: 0.05 });
  const inner = std({ color: 0x050505, roughness: 1, side: THREE.DoubleSide });
  const W = 0.28, Hh = 0.13, D = 0.21, t = 0.006;
  const body = new THREE.Group(); g.add(body);
  box(body, W, t, D, black, 0, t / 2, 0);
  box(body, W, Hh, t, black, 0, Hh / 2, D / 2 - t / 2); box(body, W, Hh, t, black, 0, Hh / 2, -D / 2 + t / 2);
  box(body, t, Hh, D, black, W / 2 - t / 2, Hh / 2, 0); box(body, t, Hh, D, black, -W / 2 + t / 2, Hh / 2, 0);
  box(body, W - 0.02, 0.002, D - 0.02, inner, 0, t + 0.001, 0, false);
  const lid = new THREE.Group(); lid.position.set(0, Hh, 0); g.add(lid);
  box(lid, W + 0.01, 0.006, D + 0.01, black, 0, 0.003, 0);
  for (const [w, d, x, z] of [[W + 0.01, 0.004, 0, D / 2 + 0.005], [W + 0.01, 0.004, 0, -D / 2 - 0.005], [0.004, D + 0.01, W / 2 + 0.005, 0], [0.004, D + 0.01, -W / 2 - 0.005, 0]])
    box(lid, w, 0.035, d, black, x, -0.0115, z);
  // etiket
  const lab = mesh(new THREE.PlaneGeometry(0.09, 0.056), std({ map: TX.labelTex(), roughness: 0.9 }), lid, 0.06, 0.0065, 0.03, false); lab.rotation.x = -Math.PI / 2; lab.rotation.z = 0.12;
  // ip
  const twine = std({ color: 0x6b5a3c, roughness: 1 });
  box(lid, 0.004, 0.003, D + 0.012, twine, -0.03, 0.0075, 0, false);
  box(lid, W + 0.012, 0.003, 0.004, twine, 0, 0.0075, -0.02, false);
  return { group: g, lid, body };
}
