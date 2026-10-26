// Small studio flat: bed corner with blinds, kitchenette, round table,
// entrance wall. Walls are single-sided (inward) so cameras can sit "inside"
// a wall for wide reverse shots, like a film set with wild walls.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as M from '../core/materials.js';
import * as P from './props.js';
import { canvasTexture } from '../core/textures.js';
import { rng, smoothstep, lerp } from '../core/util.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const sh = (o) => { o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };
const boxM = (w, h, d, mat, r = 0.006) => sh(new THREE.Mesh(r ? new RoundedBoxGeometry(w, h, d, 2, r) : new THREE.BoxGeometry(w, h, d), mat));

export const ROOM = { x0: -2.6, x1: 2.6, z0: -2.2, z1: 2.2, h: 2.7 };
export const SPOTS = {
  bedSit: V(-1.45, 0, -0.38), // root position when seated on the bed edge (faces +Z)
  nightstandPhone: V(-2.17, 0.548, -0.3),
  counterStand: V(0.98, 0, -1.27), // facing -Z (toward counter)
  kettle: V(1.2, 0.92, -1.86),
  counterMug: V(0.86, 0.92, -1.78),
  chair: V(1.1, 0, -0.32), // chair centre; seated root faces +Z
  tableMug: V(0.93, 0.75, 0.0),
  tablePhone: V(1.25, 0.752, 0.02),
};

export function buildApartment() {
  const set = new THREE.Group(); set.name = 'apartment';
  const { x0, x1, z0, z1, h } = ROOM;
  const W = x1 - x0, D = z1 - z0;
  // ---------- shell ----------
  const floorMat = M.wood({ repeat: [2.6, 2.2] });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; set.add(floor);
  const wallMat = M.plaster(0xe9e2d6);
  const wallBlue = M.plaster(0xb9c6c9);
  const mkWall = (w, hh, mat, pos, rotY) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, hh), mat);
    m.position.copy(pos); m.rotation.y = rotY; m.receiveShadow = true; m.castShadow = true;
    m.material = mat.clone(); m.material.shadowSide = THREE.DoubleSide;
    set.add(m); return m;
  };
  // back wall with a window hole (built from 4 panels)
  const win = { xa: -2.05, xb: -0.85, ya: 1.0, yb: 2.25 };
  mkWall(win.xa - x0, h, wallMat, V((x0 + win.xa) / 2, h / 2, z0), 0);
  mkWall(x1 - win.xb, h, wallMat, V((win.xb + x1) / 2, h / 2, z0), 0);
  mkWall(win.xb - win.xa, win.ya, wallMat, V((win.xa + win.xb) / 2, win.ya / 2, z0), 0);
  mkWall(win.xb - win.xa, h - win.yb, wallMat, V((win.xa + win.xb) / 2, (h + win.yb) / 2, z0), 0);
  mkWall(D, h, wallBlue, V(x0, h / 2, 0), Math.PI / 2);
  mkWall(D, h, wallMat, V(x1, h / 2, 0), -Math.PI / 2);
  mkWall(W, h, wallMat, V(0, h / 2, z1), Math.PI);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), M.plaster(0xf0ede6));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = h; set.add(ceil);
  // skirting boards
  const skirt = M.paintedWood(0xf2efe8, 0.5);
  for (const [w, pos, ry] of [[W, V(0, 0.04, z0 + 0.008), 0], [W, V(0, 0.04, z1 - 0.008), 0], [D, V(x0 + 0.008, 0.04, 0), Math.PI / 2], [D, V(x1 - 0.008, 0.04, 0), Math.PI / 2]]) {
    const b = boxM(w, 0.08, 0.016, skirt, 0); b.position.copy(pos); b.rotation.y = ry; set.add(b);
  }

  // ---------- window + blinds ----------
  const frameMat = M.paintedWood(0xf4f2ee, 0.45);
  const wcx = (win.xa + win.xb) / 2, wcy = (win.ya + win.yb) / 2;
  for (const [w, hh, x, y] of [[win.xb - win.xa + 0.1, 0.06, wcx, win.ya - 0.01], [win.xb - win.xa + 0.1, 0.06, wcx, win.yb + 0.01], [0.06, win.yb - win.ya, win.xa - 0.01, wcy], [0.06, win.yb - win.ya, win.xb + 0.01, wcy], [0.04, win.yb - win.ya, wcx, wcy]]) {
    const f = boxM(w, hh, 0.1, frameMat, 0.004); f.position.set(x, y, z0 - 0.02); set.add(f);
  }
  const sill = boxM(win.xb - win.xa + 0.24, 0.035, 0.22, M.paintedWood(0xf4f2ee, 0.35), 0.006); sill.position.set(wcx, win.ya - 0.03, z0 + 0.07); set.add(sill);
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(win.xb - win.xa, win.yb - win.ya), M.glass({ tint: 0xdfeeff, opacity: 0.08 }));
  pane.position.set(wcx, wcy, z0 - 0.03); set.add(pane);
  // outside: sky + far buildings (soft, out of focus anyway)
  const skyTex = canvasTexture('sky', 512, 512, (c, w, hh) => {
    const g = c.createLinearGradient(0, 0, 0, hh);
    g.addColorStop(0, '#9fc3e8'); g.addColorStop(0.6, '#e9eef0'); g.addColorStop(1, '#f6e2c8');
    c.fillStyle = g; c.fillRect(0, 0, w, hh);
    const R = rng(4);
    for (let i = 0; i < 14; i++) {
      const bw = 30 + R() * 70, bh = 120 + R() * 260, bx = i * 40 - 20 + R() * 20;
      c.fillStyle = `rgba(${150 + R() * 30},${140 + R() * 30},${135 + R() * 25},1)`; c.fillRect(bx, hh - bh, bw, bh);
      c.fillStyle = 'rgba(255,240,210,0.5)';
      for (let k = 0; k < 20; k++) c.fillRect(bx + 6 + (k % 3) * (bw / 3.2), hh - bh + 14 + Math.floor(k / 3) * 26, 7, 10);
    }
  });
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(6, 4.2), new THREE.MeshBasicMaterial({ map: skyTex, toneMapped: false }));
  sky.position.set(wcx, 1.6, z0 - 2.2); set.add(sky);
  set.userData.sky = sky;
  // venetian blinds (slats cast the striped shadows)
  const slatMat = M.metal({ color: 0xf1efe9, roughness: 0.45, brushed: false });
  slatMat.metalness = 0.2;
  const slats = new THREE.Group();
  const nSl = 30;
  for (let i = 0; i < nSl; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(win.xb - win.xa - 0.02, 0.0015, 0.026), slatMat);
    s.position.set(wcx, win.yb - 0.03 - i * ((win.yb - win.ya - 0.12) / nSl), z0 + 0.025);
    s.rotation.x = 0.55; s.castShadow = true; s.receiveShadow = true;
    slats.add(s);
  }
  const headrail = boxM(win.xb - win.xa, 0.04, 0.045, slatMat, 0.004); headrail.position.set(wcx, win.yb - 0.0, z0 + 0.028); slats.add(headrail);
  const bottom = boxM(win.xb - win.xa - 0.02, 0.012, 0.03, slatMat, 0.003); bottom.position.set(wcx, win.ya + 0.1, z0 + 0.025); slats.add(bottom);
  set.add(slats);

  // ---------- bed corner ----------
  const woodLight = M.wood({ tint: 0xd9b48a, repeat: [0.6, 0.6] });
  const woodDark = M.wood({ tint: 0x8d6446, repeat: [0.6, 0.6] });
  const bed = new THREE.Group();
  const bx0 = -2.56, bx1 = -0.65, bz0 = -2.16, bz1 = -0.76;
  const bcx = (bx0 + bx1) / 2, bcz = (bz0 + bz1) / 2;
  const frame = boxM(bx1 - bx0, 0.26, bz1 - bz0, woodDark, 0.01); frame.position.set(bcx, 0.17, bcz); bed.add(frame);
  const headboard = boxM(0.05, 0.75, bz1 - bz0, woodDark, 0.01); headboard.position.set(bx0 + 0.02, 0.45, bcz); bed.add(headboard);
  const sheetMat = M.fabric({ color: 0xe9e6df, key: 'sheet', bump: 'weave', repeat: [14, 14], sheen: 0.5, roughness: 0.92 });
  const mattress = boxM(bx1 - bx0 - 0.08, 0.2, bz1 - bz0 - 0.05, sheetMat, 0.05); mattress.position.set(bcx + 0.03, 0.38, bcz); bed.add(mattress);
  const duvetMat = M.fabric({ color: 0x6f8aa3, key: 'duvet', bump: 'weave', repeat: [10, 10], sheen: 0.8, roughness: 0.9 });
  const duv = P.duvet(1.35, 1.45, duvetMat);
  duv.position.set(bcx + 0.25, 0.48, bcz + 0.02); duv.rotation.y = 0.06; bed.add(duv);
  const pilMat = M.fabric({ color: 0xf1ede6, key: 'pillow', bump: 'weave', repeat: [8, 8], sheen: 0.4 });
  const p1 = P.pillow(pilMat); p1.position.set(bx0 + 0.32, 0.54, bcz - 0.32); p1.rotation.set(0.1, Math.PI / 2 + 0.15, 0.15); bed.add(p1);
  const p2 = P.pillow(pilMat); p2.position.set(bx0 + 0.3, 0.55, bcz + 0.28); p2.rotation.set(-0.15, Math.PI / 2 - 0.1, 0.25); bed.add(p2);
  set.add(bed);
  // nightstand + lamp + glass + book + phone spot
  const nightstand = new THREE.Group();
  const nsMat = M.paintedWood(0xe5dccb, 0.5);
  const ns = boxM(0.42, 0.54, 0.38, nsMat, 0.01); ns.position.y = 0.27; nightstand.add(ns);
  const drawer = boxM(0.38, 0.16, 0.01, nsMat, 0.004); drawer.position.set(0, 0.38, 0.19); nightstand.add(drawer);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 8), M.metal({ color: 0xb59a6a, brushed: false })); knob.position.set(0, 0.38, 0.2); nightstand.add(knob);
  const lp = P.lamp(); lp.position.set(-0.09, 0.54, -0.07); nightstand.add(lp);
  const wg = P.waterGlass(0.55); wg.position.set(0.12, 0.54, -0.08); nightstand.add(wg);
  const bk = P.book(0.15, 0.022, 0.21, 0x7a2f2a); bk.position.set(-0.08, 0.552, 0.08); bk.rotation.y = 0.3; nightstand.add(bk);
  nightstand.position.set(-2.3, 0, -0.42);
  set.add(nightstand);
  // rug
  const rugTex = canvasTexture('rug', 512, 512, (c, w, hh) => {
    c.fillStyle = '#8e6a55'; c.fillRect(0, 0, w, hh);
    const cols = ['#a9826a', '#6f5546', '#c2a689', '#7b5f4f'];
    for (let i = 0; i < 26; i++) { c.fillStyle = cols[i % 4]; c.fillRect(0, i * 20, w, 8 + (i % 3) * 3); }
    c.strokeStyle = '#d8c3a5'; c.lineWidth = 6; c.strokeRect(14, 14, w - 28, hh - 28);
  });
  const rugMat = new THREE.MeshPhysicalMaterial({ map: rugTex, roughness: 1, sheen: 1, sheenColor: new THREE.Color(0xd8b090), bumpMap: M.fabric({ color: 0xffffff, key: 'rugb', bump: 'weave', repeat: [30, 30] }).bumpMap, bumpScale: 2 });
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.1), rugMat); rug.rotation.x = -Math.PI / 2; rug.position.set(-1.45, 0.004, 0.15); rug.receiveShadow = true; set.add(rug);
  // laundry chair (foreground in the wide)
  const lchair = P.chair(woodLight); lchair.position.set(-0.45, 0, 0.75); lchair.rotation.y = -2.4; set.add(lchair);
  const pile = P.clothesPile([
    M.fabric({ color: 0x2f3d55, key: 'shirt1', bump: 'twill', repeat: [8, 8] }),
    M.fabric({ color: 0xc9c3b6, key: 'shirt2', bump: 'knit', repeat: [8, 8] }),
    M.fabric({ color: 0x8a3b32, key: 'shirt3', bump: 'weave', repeat: [8, 8] }),
  ]);
  pile.position.set(-0.45, 0.47, 0.75); set.add(pile);
  // socks/backpack on floor
  const bag = boxM(0.3, 0.42, 0.18, M.fabric({ color: 0x23262b, key: 'bag', bump: 'twill', repeat: [6, 6] }), 0.06);
  bag.position.set(-0.6, 0.2, -0.35); bag.rotation.set(0.15, 0.5, -0.08); set.add(bag);

  // ---------- kitchenette ----------
  const kx0 = 0.3, kx1 = 2.58, kz0 = -2.2, kz1 = -1.6;
  const cabMat = M.paintedWood(0x5f7f78, 0.5);
  const topMat = M.wood({ tint: 0xe2c49e, repeat: [0.8, 0.3] });
  const base = boxM(kx1 - kx0, 0.86, kz1 - kz0 - 0.03, cabMat, 0.006); base.position.set((kx0 + kx1) / 2, 0.43, (kz0 + kz1) / 2 - 0.015); set.add(base);
  for (let i = 0; i < 4; i++) {
    const door = boxM((kx1 - kx0) / 4 - 0.012, 0.7, 0.018, cabMat, 0.005);
    door.position.set(kx0 + (i + 0.5) * ((kx1 - kx0) / 4), 0.47, kz1 - 0.02); set.add(door);
    const hdl = boxM(0.12, 0.012, 0.02, M.metal({ color: 0x2b2b2b, roughness: 0.4, brushed: false }), 0.004);
    hdl.position.set(kx0 + (i + 0.5) * ((kx1 - kx0) / 4), 0.78, kz1 - 0.005); set.add(hdl);
  }
  const top = boxM(kx1 - kx0 + 0.02, 0.04, kz1 - kz0 + 0.03, topMat, 0.006); top.position.set((kx0 + kx1) / 2, 0.9, (kz0 + kz1) / 2); set.add(top);
  const tile = new THREE.Mesh(new THREE.PlaneGeometry(kx1 - kx0, 0.58), M.tiles(0xdfe6e1)); tile.position.set((kx0 + kx1) / 2, 1.21, z0 + 0.005); tile.receiveShadow = true; set.add(tile);
  const upper = boxM(kx1 - kx0 - 0.4, 0.62, 0.34, cabMat, 0.006); upper.position.set((kx0 + kx1) / 2 + 0.2, 1.84, z0 + 0.17); set.add(upper);
  // warm LED strip under the cabinets
  const led = new THREE.Mesh(new THREE.BoxGeometry(kx1 - kx0 - 0.5, 0.01, 0.02), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.75, 0.45).multiplyScalar(3), toneMapped: false }));
  led.position.set((kx0 + kx1) / 2 + 0.2, 1.525, z0 + 0.3); set.add(led);
  const ledLight = new THREE.PointLight(0xffc48a, 0, 2.2, 1.6);
  ledLight.position.copy(led.position).add(V(0, -0.05, 0.1));
  set.add(ledLight);
  set.userData.ledLight = ledLight; set.userData.ledMesh = led;
  // sink + faucet
  const steel = M.metal({ color: 0xcfcfcf, roughness: 0.25 });
  const sink = boxM(0.5, 0.012, 0.38, steel, 0.004); sink.position.set(1.95, 0.921, -1.9); set.add(sink);
  const basin = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.16, 0.32), steel); basin.material = steel.clone(); basin.material.side = THREE.BackSide; basin.position.set(1.95, 0.84, -1.9); set.add(basin);
  const faucet = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 10, 24, Math.PI), steel); faucet.position.set(1.95, 1.02, -2.08); faucet.rotation.y = Math.PI / 2; sh(faucet); set.add(faucet);
  const fpost = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.1, 12), steel); fpost.position.set(1.95, 0.97, -2.12); sh(fpost); set.add(fpost);
  // props on counter
  const kettle = P.kettle(); kettle.position.copy(SPOTS.kettle); kettle.rotation.y = -0.4; set.add(kettle);
  const jar = P.coffeeJar(); jar.position.set(0.55, 0.92, -1.98); set.add(jar);
  const board = boxM(0.4, 0.018, 0.26, M.wood({ tint: 0xc9a27a, repeat: [0.3, 0.3] }), 0.006); board.position.set(1.45, 0.93, -2.05); board.rotation.x = -1.2; board.position.y = 1.03; board.position.z = -2.13; set.add(board);
  const fruit = new THREE.Group();
  const fbowl = new THREE.Mesh(new THREE.SphereGeometry(0.13, 32, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2.4), M.ceramic(0x2f4f6f)); fbowl.material.side = THREE.DoubleSide; fbowl.position.y = 0.11; fruit.add(fbowl);
  const R = rng(8);
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), new THREE.MeshPhysicalMaterial({ color: [0xd04a2a, 0xe0b02a, 0x8fb03a][i % 3], roughness: 0.35, clearcoat: 0.5 }));
    f.position.set((R() - 0.5) * 0.12, 0.05 + R() * 0.03, (R() - 0.5) * 0.12); fruit.add(f);
  }
  fruit.position.set(2.35, 0.92, -1.88); sh(fruit); set.add(fruit);
  const pl = P.plant(); pl.position.set(0.42, 0.92, -1.75); pl.scale.setScalar(0.9); set.add(pl);
  // fridge
  const fridge = boxM(0.6, 1.85, 0.62, new THREE.MeshPhysicalMaterial({ color: 0xe8e8e4, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.2 }), 0.025);
  fridge.position.set(2.28, 0.925, -1.05); set.add(fridge);
  const fh = boxM(0.02, 0.5, 0.03, steel, 0.008); fh.position.set(1.97, 1.2, -0.82); set.add(fh);
  const magnet = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.16), new THREE.MeshStandardMaterial({
    map: canvasTexture('fridgeNote', 128, 170, (c) => { c.fillStyle = '#fff59a'; c.fillRect(0, 0, 128, 170); c.fillStyle = '#333'; c.font = '18px Inter'; ['Kira: 15\'i', 'Fatura!', 'Süt al'].forEach((t, i) => c.fillText(t, 10, 40 + i * 34)); }), roughness: 0.8,
  }));
  magnet.position.set(1.975, 1.45, -1.05); magnet.rotation.y = -Math.PI / 2; set.add(magnet);

  // ---------- table area ----------
  const table = P.roundTable(woodLight, M.metal({ color: 0x2a2a2a, roughness: 0.45, brushed: false }));
  table.position.set(1.1, 0, 0.28); set.add(table);
  const ch1 = P.chair(woodLight); ch1.position.copy(SPOTS.chair); set.add(ch1);
  const ch2 = P.chair(woodLight); ch2.position.set(1.55, 0, 0.85); ch2.rotation.y = Math.PI + 0.6; set.add(ch2);
  const bill1 = P.paper(0.15, 0.2, ['FATURA', 'Elektrik', 'Son ödeme: 15.10', 'Tutar: 1.240 TL'], { accent: '#c0392b' });
  bill1.position.set(1.34, 0.752, 0.38); bill1.rotation.z = 0.4; set.add(bill1);
  const bill2 = P.paper(0.15, 0.2, ['FATURA', 'Doğalgaz', 'Son ödeme: 15.10', 'Tutar: 2.310 TL'], { accent: '#d35400' });
  bill2.position.set(1.4, 0.7535, 0.33); bill2.rotation.z = -0.25; set.add(bill2);
  const keys = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.0025, 8, 20), M.metal({ color: 0xc0a060, brushed: false })); keys.rotation.x = Math.PI / 2; keys.position.set(0.82, 0.754, 0.45); set.add(keys);

  // ---------- entrance wall (seen in reverse shots) ----------
  const door = boxM(0.92, 2.05, 0.05, M.paintedWood(0xd9d2c4, 0.45), 0.01); door.position.set(1.8, 1.025, z1 - 0.03); set.add(door);
  const dh = boxM(0.12, 0.02, 0.05, M.metal({ color: 0xb8b8b8, roughness: 0.3, brushed: false }), 0.006); dh.position.set(1.45, 1.0, z1 - 0.07); set.add(dh);
  const hooks = boxM(0.7, 0.06, 0.03, woodDark, 0.006); hooks.position.set(0.7, 1.7, z1 - 0.02); set.add(hooks);
  const jacket = P.clothesPile([M.fabric({ color: 0x2c3646, key: 'jacket', bump: 'twill', repeat: [6, 6] })], 9);
  jacket.scale.set(0.9, 2.8, 0.6); jacket.position.set(0.55, 1.28, z1 - 0.12); set.add(jacket);
  const tote = boxM(0.32, 0.38, 0.06, M.fabric({ color: 0xd8c9a8, key: 'tote', bump: 'weave', repeat: [6, 6] }), 0.03); tote.position.set(0.95, 1.42, z1 - 0.08); tote.rotation.z = 0.05; set.add(tote);
  const shoeRack = boxM(0.8, 0.3, 0.3, woodLight, 0.008); shoeRack.position.set(0.2, 0.15, z1 - 0.17); set.add(shoeRack);
  const calTex = canvasTexture('calendar', 300, 420, (c, w, hh) => {
    c.fillStyle = '#fbfaf6'; c.fillRect(0, 0, w, hh);
    c.fillStyle = '#c0392b'; c.fillRect(0, 0, w, 80);
    c.fillStyle = '#fff'; c.font = 'bold 44px Inter'; c.textAlign = 'center'; c.fillText('EKİM', w / 2, 58);
    c.fillStyle = '#333'; c.font = '22px Inter';
    for (let d = 1; d <= 31; d++) {
      const col = (d + 2) % 7, row = Math.floor((d + 2) / 7);
      const x = 28 + col * 41, y = 130 + row * 52;
      c.fillText(String(d), x, y);
      if (d === 15) { c.strokeStyle = '#1e8e4b'; c.lineWidth = 4; c.beginPath(); c.arc(x, y - 8, 20, 0, Math.PI * 2); c.stroke(); }
    }
  });
  const cal = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.42), new THREE.MeshStandardMaterial({ map: calTex, roughness: 0.85 }));
  cal.position.set(-0.4, 1.55, z1 - 0.005); cal.rotation.y = Math.PI; set.add(cal);
  const posterTex = canvasTexture('poster', 300, 400, (c, w, hh) => {
    const g = c.createLinearGradient(0, 0, w, hh); g.addColorStop(0, '#1d3557'); g.addColorStop(1, '#e76f51');
    c.fillStyle = g; c.fillRect(0, 0, w, hh);
    c.fillStyle = 'rgba(255,255,255,0.85)'; c.beginPath(); c.arc(w * 0.5, hh * 0.42, 70, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff'; c.font = 'bold 30px Inter'; c.textAlign = 'center'; c.fillText('BİR GÜN', w / 2, hh * 0.8); c.fillText('TATİL', w / 2, hh * 0.88);
  });
  const poster = boxM(0.5, 0.68, 0.02, new THREE.MeshStandardMaterial({ map: posterTex, roughness: 0.6 }), 0);
  poster.position.set(-1.5, 1.55, z1 - 0.02); set.add(poster);
  const radiator = new THREE.Group();
  for (let i = 0; i < 12; i++) { const fin = boxM(0.05, 0.55, 0.08, M.paintedWood(0xf4f4f0, 0.4), 0.01); fin.position.set(i * 0.06, 0, 0); radiator.add(fin); }
  radiator.position.set(-2.0, 0.45, z1 - 0.07); set.add(radiator);
  // books shelf on left wall
  const shelf = boxM(0.25, 0.025, 0.9, woodDark, 0.004); shelf.position.set(x0 + 0.13, 1.5, 1.0); set.add(shelf);
  for (let i = 0; i < 9; i++) {
    const b = P.book(0.18, 0.2 + R() * 0.08, 0.03 + R() * 0.02, [0x2c5f7a, 0xb5651d, 0x7a2f2a, 0x3d5a3a, 0xd9c48a][i % 5]);
    b.rotation.z = Math.PI / 2; b.rotation.y = Math.PI / 2;
    b.position.set(x0 + 0.13, 1.62, 0.62 + i * 0.075); set.add(b);
  }

  set.userData.slats = slats;
  set.userData.window = win;
  set.userData.dirtyMats = [];
  return set;
}

// ---------------- lighting rig ----------------
// State-driven so scenes can blend between moods (morning cool -> warm ->
// overcast) with physically motivated changes (sun behind clouds, LEDs on).
export function buildLights(scene, set) {
  const L = {};
  const sun = new THREE.DirectionalLight(0xffe3c0, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -3.2; sc.right = 3.2; sc.top = 3.2; sc.bottom = -3.2; sc.near = 0.5; sc.far = 14;
  sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.012; sun.shadow.radius = 4;
  // low morning sun so the blinds throw stripes across the bed and the character
  sun.target.position.set(-1.75, 0.9, -0.7);
  sun.position.copy(sun.target.position).addScaledVector(new THREE.Vector3(-0.22, -0.34, 1).normalize(), -8);
  scene.add(sun, sun.target);
  L.sun = sun;
  // sky light pouring through the window
  // window sky light: a soft wide spot is far cheaper than an area light in software GL
  const skyLight = new THREE.SpotLight(0xbfd6ff, 6, 7, 1.1, 1.0, 1.4);
  const w = set.userData.window;
  skyLight.position.set((w.xa + w.xb) / 2, (w.ya + w.yb) / 2, ROOM.z0 + 0.05);
  skyLight.target.position.set(skyLight.position.x + 0.5, 0.6, 1.2);
  scene.add(skyLight, skyLight.target);
  L.sky = skyLight;
  // bounce from the sunlit floor/bed (warm, no shadows)
  const bounce = new THREE.PointLight(0xffd2a8, 0.0, 6, 1.6);
  bounce.position.set(-0.9, 0.3, 0.2);
  scene.add(bounce);
  L.bounce = bounce;
  const kitchenFill = new THREE.PointLight(0xffe0c0, 0.0, 5, 1.8);
  kitchenFill.position.set(1.4, 2.2, -0.6);
  scene.add(kitchenFill);
  L.kitchenFill = kitchenFill;
  const hemi = new THREE.HemisphereLight(0xdfe8f5, 0x8a6a50, 0.25);
  scene.add(hemi);
  L.hemi = hemi;
  L.led = set.userData.ledLight;
  return L;
}

export const LIGHT_STATES = {
  // dawn: cool, low contrast, soft sun through blinds
  morning: { sun: 2.2, sunColor: [1.0, 0.86, 0.72], sky: 9, skyColor: [0.72, 0.82, 1.0], bounce: 0.6, kitchen: 0.2, hemi: 0.35, led: 0, env: 0.45, sunElev: 0 },
  // sun breaks through: warm and bright
  warm: { sun: 4.2, sunColor: [1.0, 0.8, 0.58], sky: 5, skyColor: [0.85, 0.88, 1.0], bounce: 1.4, kitchen: 0.9, hemi: 0.3, led: 1.6, env: 0.55, sunElev: 0.2 },
  // a cloud passes: cooler, flatter, dimmer
  overcast: { sun: 0.6, sunColor: [0.85, 0.88, 0.95], sky: 6, skyColor: [0.78, 0.84, 0.95], bounce: 0.35, kitchen: 0.55, hemi: 0.3, led: 1.4, env: 0.42, sunElev: 0.2 },
  // late, emotionally drained
  drained: { sun: 0.35, sunColor: [0.8, 0.84, 0.95], sky: 4.5, skyColor: [0.7, 0.78, 0.95], bounce: 0.25, kitchen: 0.45, hemi: 0.26, led: 1.2, env: 0.38, sunElev: 0.2 },
};

export function applyLightState(L, scene, st) {
  L.sun.intensity = st.sun;
  L.sun.color.setRGB(...st.sunColor);
  L.sun.position.copy(L.sun.target.position).addScaledVector(new THREE.Vector3(-0.22 + st.sunElev * 0.3, -0.34 - st.sunElev * 0.4, 1).normalize(), -8);
  L.sky.intensity = st.sky;
  L.sky.color.setRGB(...st.skyColor);
  L.bounce.intensity = st.bounce;
  L.kitchenFill.intensity = st.kitchen;
  L.hemi.intensity = st.hemi;
  if (L.led) L.led.intensity = st.led;
  scene.environmentIntensity = st.env;
}
export function blendLightState(a, b, t) {
  const o = {};
  for (const k of Object.keys(a)) o[k] = Array.isArray(a[k]) ? a[k].map((v, i) => lerp(v, b[k][i], t)) : lerp(a[k], b[k], t);
  return o;
}
