import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Loft: a smooth tube rebuilt every frame from a spine (control points) and a
// radius profile. Used for the cat's torso, legs and tail and the human limbs.
//   u (0…1) runs along the spine, v (0…1) around it, v = 0 is the ventral side
//   so the normal seam sits on the belly / underside where it is least visible.
// ---------------------------------------------------------------------------
const _t = new THREE.Vector3(), _s = new THREE.Vector3(), _u = new THREE.Vector3(), _p = new THREE.Vector3();

export class Loft {
  constructor(rings, segs) {
    this.rings = rings;
    this.segs = segs;
    const n = rings * (segs + 1);
    this.pos = new Float32Array(n * 3);
    const uv = new Float32Array(n * 2), idx = [];
    for (let i = 0; i < rings; i++) for (let j = 0; j <= segs; j++) {
      const k = i * (segs + 1) + j;
      uv[k * 2] = i / (rings - 1);
      uv[k * 2 + 1] = j / segs;
      if (i < rings - 1 && j < segs) {
        const a = k, b = k + segs + 1;
        idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    this.geo.setIndex(idx);
    this.geo.computeVertexNormals();
    this.curve = new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(0, 0, 1)], false, 'centripetal');
  }

  // pts: control points; prof(u) -> [rx, ryTop, ryBottom]; upHint: Vector3 (dorsal direction) or fn(u)
  update(pts, prof, upHint = new THREE.Vector3(0, 1, 0)) {
    const { rings, segs, pos } = this;
    this.curve.points = pts;
    const P = this.curve.getSpacedPoints(rings - 1);
    let prevU = null;
    for (let i = 0; i < rings; i++) {
      const u = i / (rings - 1);
      _t.subVectors(P[Math.min(rings - 1, i + 1)], P[Math.max(0, i - 1)]).normalize();
      const hint = typeof upHint === 'function' ? upHint(u) : upHint;
      // keep the frame twist-free: blend the hint with the transported previous up
      _u.copy(prevU && hint.lengthSq() < 1e-6 ? prevU : hint);
      if (prevU) _u.lerp(prevU, 0.35);
      _u.addScaledVector(_t, -_u.dot(_t));
      if (_u.lengthSq() < 1e-8) _u.set(1, 0, 0).addScaledVector(_t, -_t.x);
      _u.normalize();
      prevU = (prevU || new THREE.Vector3()).copy(_u);
      _s.crossVectors(_t, _u).normalize();
      const [rx, ryT, ryB] = prof(u);
      for (let j = 0; j <= segs; j++) {
        const a = Math.PI + (j / segs) * Math.PI * 2; // start at the ventral side
        const c = Math.cos(a), s = Math.sin(a);
        _p.copy(P[i]).addScaledVector(_u, c * (c > 0 ? ryT : ryB)).addScaledVector(_s, s * rx);
        const k = (i * (segs + 1) + j) * 3;
        pos[k] = _p.x;
        pos[k + 1] = _p.y;
        pos[k + 2] = _p.z;
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.computeVertexNormals();
    // weld the seam normals
    const nr = this.geo.attributes.normal.array;
    for (let i = 0; i < rings; i++) {
      const a = i * (segs + 1) * 3, b = (i * (segs + 1) + segs) * 3;
      for (let c = 0; c < 3; c++) { const m = (nr[a + c] + nr[b + c]) / 2; nr[a + c] = nr[b + c] = m; }
    }
    this.geo.computeBoundingSphere();
    return P;
  }
}

// piecewise-linear table → smooth function of u
export function profile(table) {
  return (u) => {
    if (u <= table[0][0]) return table[0].slice(1);
    for (let i = 0; i < table.length - 1; i++) {
      const a = table[i], b = table[i + 1];
      if (u <= b[0]) {
        let f = (u - a[0]) / (b[0] - a[0]);
        f = f * f * (3 - 2 * f);
        return a.slice(1).map((x, k) => x + (b[k + 1] - x) * f);
      }
    }
    return table[table.length - 1].slice(1);
  };
}

// fur shells: copies of a mesh pushed out along the normal, cut by a strand texture
export function furShells(mat, strandTex, n, len, darken = 0.55) {
  const out = [];
  for (let k = 1; k <= n; k++) {
    const f = k / n;
    const m = mat.clone();
    m.alphaMap = strandTex;
    m.alphaTest = 0.15 + 0.75 * f;
    m.transparent = false;
    m.color = mat.color.clone().multiplyScalar(darken + (1 - darken) * f);
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n transformed += objectNormal * ${(len * f).toFixed(5)};`);
    };
    m.customProgramCacheKey = () => 'shell' + k + len;
    out.push(m);
  }
  return out;
}
