import * as THREE from 'three';
import { clamp, lerp } from './util.js';
import { Loft, profile } from './loft.js';

// ---------------------------------------------------------------------------
// Prey: a small juvenile reef fish (~2 cm, goby-like), semi-translucent with
// dark bars and a large eye. Body is a loft rebuilt every frame so the tail can
// undulate; `stun` makes it jerk, stop finning, roll and slowly sink.
// Local frame: +z forward, +y up.
// ---------------------------------------------------------------------------
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export function createPrey() {
  const root = new THREE.Group();
  const L = new Loft(30, 22);
  // colours along the body (u: tail → head)
  {
    const p = L.geo.attributes.uv, col = new Float32Array(p.count * 3);
    const base = new THREE.Color('#d9e4e0'), bar = new THREE.Color('#ff6a2a'), belly = new THREE.Color('#fbf6ee'), blue = new THREE.Color('#4fc8ff');
    const c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i), v = p.getY(i);
      const top = 0.5 - 0.5 * Math.cos(v * Math.PI * 2); // 0 belly, 1 back
      c.copy(belly).lerp(base, top);
      const bars = Math.max(0, Math.sin(u * Math.PI * 7 + 0.8)) ** 14 * (u < 0.9 ? 1 : 0);
      c.lerp(bar, bars * 0.85 * (0.4 + 0.6 * top));
      const stripe = Math.exp(-(((top - 0.62) / 0.07) ** 2)) * (u > 0.15 ? 1 : 0);
      c.lerp(blue, stripe * 0.75);
      if ((Math.sin(u * 60) * Math.sin(v * 40)) > 0.9 && top > 0.5) c.lerp(bar, 0.5);
      col.set([c.r, c.g, c.b], i * 3);
    }
    L.geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  const skin = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.3, clearcoat: 0.8, transparent: true, opacity: 0.93, sheen: 0.4, sheenColor: new THREE.Color('#bfe8ff') });
  skin.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      float fres = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.0);
      totalEmissiveRadiance += diffuseColor.rgb * (0.05 + fres * 0.3);`);
  };
  const bodyM = new THREE.Mesh(L.geo, skin);
  bodyM.castShadow = true;
  bodyM.frustumCulled = false;
  root.add(bodyM);
  const finMat = new THREE.MeshStandardMaterial({ color: '#f6e7c4', transparent: true, opacity: 0.45, side: THREE.DoubleSide, roughness: 0.4, depthWrite: false });
  const fin = (w, h) => {
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.quadraticCurveTo(w * 0.2, h, w * 0.7, h * 0.9); s.lineTo(w, 0.02); s.lineTo(0, 0);
    return new THREE.ShapeGeometry(s, 10);
  };
  const dorsal = new THREE.Mesh(fin(0.45, 0.34), finMat); root.add(dorsal);
  const dorsal2 = new THREE.Mesh(fin(0.62, 0.26), finMat); root.add(dorsal2);
  const anal = new THREE.Mesh(fin(0.5, 0.2), finMat); root.add(anal);
  const caudal = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24, -1.1, 2.2), finMat); root.add(caudal);
  const pecs = [1, -1].map(() => { const m = new THREE.Mesh(new THREE.CircleGeometry(0.17, 14, -1, 2), finMat); root.add(m); return m; });
  const eyes = [1, -1].map((s) => {
    const g = new THREE.Group();
    const w = new THREE.Mesh(new THREE.SphereGeometry(0.068, 16, 12), new THREE.MeshStandardMaterial({ color: '#ffcf5a', roughness: 0.25, metalness: 0.5 }));
    const pu = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), new THREE.MeshStandardMaterial({ color: '#050505', roughness: 0.05 }));
    pu.position.x = s * 0.03;
    g.add(w, pu);
    root.add(g);
    return { g, s };
  });

  const out = { center: V(), head: V() };
  function setPose({ pos, yaw = 0, pitch = 0, roll = 0, t = 0, swim = 1, stun = 0, jerk = 0 }) {
    root.position.copy(pos);
    root.rotation.set(pitch, yaw, roll, 'YXZ');
    root.updateMatrixWorld(true);
    const amp = 0.09 * swim * (1 - stun) + jerk * 0.25;
    const freq = 7 + 10 * jerk;
    const pts = [];
    for (let i = 0; i <= 6; i++) {
      const u = i / 6;
      const z = lerp(-1.1, 0.95, u);
      const w = Math.sin(t * freq - u * 4.5) * amp * (1 - u) ** 1.5 + jerk * 0.15 * Math.sin(u * 3) * (1 - u);
      pts.push(V(w, 0, z));
    }
    L.update(pts, profile([[0, 0.025, 0.05, 0.04], [0.2, 0.06, 0.1, 0.08], [0.6, 0.12, 0.16, 0.14], [0.86, 0.13, 0.16, 0.14], [0.97, 0.08, 0.1, 0.09], [1, 0.02, 0.03, 0.03]]));
    bodyM.geometry.computeBoundingSphere();
    const tailW = pts[0].x;
    caudal.position.set(tailW, 0, -1.06);
    caudal.rotation.set(0, Math.PI / 2 + Math.sin(t * freq) * amp * 2, Math.PI);
    dorsal.position.set(pts[4].x, 0.14, 0.3); dorsal.rotation.set(0, -Math.PI / 2, 0);
    dorsal2.position.set(pts[3].x, 0.12, -0.45); dorsal2.rotation.set(0, -Math.PI / 2, 0);
    anal.position.set(pts[2].x, -0.1, -0.45); anal.rotation.set(Math.PI, -Math.PI / 2, 0);
    pecs.forEach((m, k) => { const s = k ? -1 : 1; m.position.set(s * 0.12, -0.04, 0.42); m.rotation.set(0, s * (1.2 + 0.35 * Math.sin(t * 9 + k) * (1 - stun)), 0); });
    eyes.forEach(({ g, s }) => g.position.set(s * 0.085, 0.1, 0.7));
    root.localToWorld(out.center.set(0, 0, 0));
    root.localToWorld(out.head.set(0, 0.05, 0.75));
    return out;
  }
  return { root, setPose, out };
}
