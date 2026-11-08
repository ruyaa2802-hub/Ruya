import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { canvasTexture, rng, softDotTexture } from './util.js';

// ---------------------------------------------------------------------------
// Sunny, colourful coral reef (units ≈ seahorse heights). Sand with animated
// caustics, rocks, branching / brain / table corals, sea fans, tube sponges,
// swaying anemones and seagrass, small tropical fish schools, god rays,
// rising bubbles and drifting "marine snow". Everything animates from uTime.
// ---------------------------------------------------------------------------
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const uTime = { value: 0 };

const CAUSTIC = /* glsl */ `
  uniform float uTime;
  varying vec3 vWPos;
  varying vec3 vWNorm;
  float caustic(vec2 p, float t){
    vec2 i = p; float c = 1.0; float inten = 0.005;
    for (int n = 0; n < 4; n++) {
      float tt = t * (1.0 - (3.5 / float(n + 1)));
      i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
      vec2 dd = vec2(sin(i.x + tt), cos(i.y + tt)) / inten;
      dd = sign(dd) * max(abs(dd), vec2(1e-4));
      c += 1.0 / max(length(vec2(p.x, p.y) / dd), 1e-3);
    }
    c /= 4.0; c = 1.17 - pow(clamp(c, 0.0, 4.0), 1.4);
    return clamp(pow(abs(c), 8.0), 0.0, 2.0);
  }
  float bh(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float bnoise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(bh(i), bh(i + vec3(1,0,0)), f.x), mix(bh(i + vec3(0,1,0)), bh(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(bh(i + vec3(0,0,1)), bh(i + vec3(1,0,1)), f.x), mix(bh(i + vec3(0,1,1)), bh(i + vec3(1,1,1)), f.x), f.y), f.z); }`;
// add caustic light to any standard/physical material (strongest on upward faces)
export function withCaustics(mat, strength = 0.55, scale = 0.9, bump = 0, bumpFreq = 1) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNorm;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vec4 wp4 = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          wp4 = instanceMatrix * wp4;
        #endif
        vWPos = (modelMatrix * wp4).xyz;
        vWNorm = normalize(mat3(modelMatrix) * objectNormal);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + CAUSTIC)
      .replace('#include <normal_fragment_maps>', bump > 0 ? `#include <normal_fragment_maps>
        { vec3 bp = vWPos * ${bumpFreq.toFixed(3)}; float e = 0.35;
          vec3 g = vec3(bnoise(bp + vec3(e,0,0)) - bnoise(bp - vec3(e,0,0)), bnoise(bp + vec3(0,e,0)) - bnoise(bp - vec3(0,e,0)), bnoise(bp + vec3(0,0,e)) - bnoise(bp - vec3(0,0,e)));
          vec3 g2 = vec3(bnoise(bp * 3.1 + vec3(e,0,0)) - bnoise(bp * 3.1 - vec3(e,0,0)), bnoise(bp * 3.1 + vec3(0,e,0)) - bnoise(bp * 3.1 - vec3(0,e,0)), bnoise(bp * 3.1 + vec3(0,0,e)) - bnoise(bp * 3.1 - vec3(0,0,e)));
          normal = normalize(normal + (mat3(viewMatrix) * (g + 0.5 * g2)) * ${bump.toFixed(3)}); }` : '#include <normal_fragment_maps>')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float cst = caustic(vWPos.xz * ${scale.toFixed(3)} + vec2(vWPos.y * 0.3), uTime * 0.5 + 23.0);
        totalEmissiveRadiance += diffuseColor.rgb * vec3(0.75, 1.0, 1.0) * cst * ${strength.toFixed(3)} * smoothstep(-0.2, 0.8, vWNorm.y);`);
  };
  mat.customProgramCacheKey = () => 'caustic' + strength + scale + bump + bumpFreq;
  return mat;
}

function sandTex() {
  const r = rng(3);
  return canvasTexture(1024, 1024, (g, w, h) => {
    g.fillStyle = '#e8d5a8';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 60000; i++) {
      const c = 180 + r() * 70;
      g.fillStyle = `rgba(${c},${c - 15},${c - 50},${0.25 + r() * 0.3})`;
      g.fillRect(r() * w, r() * h, 2, 2);
    }
    // ripples
    g.strokeStyle = 'rgba(150,120,70,0.18)';
    g.lineWidth = 6;
    for (let y = 0; y < h; y += 26) {
      g.beginPath();
      for (let x = 0; x <= w; x += 16) g.lineTo(x, y + 8 * Math.sin(x * 0.02 + y * 0.05));
      g.stroke();
    }
  }, { repeat: [24, 24] });
}

// recursive branching coral → one merged geometry with vertex colours (dark base → bright tips)
export function branchCoral(seed, base, tip, { depth = 4, len = 0.55, rad = 0.07, spread = 0.55 } = {}) {
  const r = rng(seed);
  const geos = [];
  const cb = new THREE.Color(base), ct = new THREE.Color(tip);
  const grow = (p, dir, l, rd, d) => {
    const end = p.clone().addScaledVector(dir, l);
    const g = new THREE.CylinderGeometry(rd * 0.72, rd, l, 16, 3);
    g.translate(0, l / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir));
    g.translate(p.x, p.y, p.z);
    const col = cb.clone().lerp(ct, 1 - d / depth);
    const cols = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < g.attributes.position.count; i++) {
      const k = (g.attributes.position.getY(i) - p.y) / Math.max(1e-3, end.y - p.y);
      const c2 = col.clone().lerp(cb.clone().lerp(ct, 1 - (d - 1) / depth), Math.max(0, Math.min(1, k)));
      cols.set([c2.r, c2.g, c2.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    geos.push(g.toNonIndexed());
    if (d <= 1) {
      const s = new THREE.SphereGeometry(rd * 0.85, 14, 10);
      s.translate(end.x, end.y, end.z);
      const c = new Float32Array(s.attributes.position.count * 3);
      for (let i = 0; i < s.attributes.position.count; i++) c.set([ct.r, ct.g, ct.b], i * 3);
      s.setAttribute('color', new THREE.BufferAttribute(c, 3));
      geos.push(s.toNonIndexed());
      return;
    }
    const n = 2 + (r() < 0.45 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const a = r() * Math.PI * 2;
      const nd = dir.clone().add(V(Math.cos(a) * spread, 0.25 + r() * 0.3, Math.sin(a) * spread)).normalize();
      grow(end, nd, l * (0.68 + r() * 0.2), rd * 0.72, d - 1);
    }
  };
  grow(V(), V(0, 1, 0), len, rad, depth);
  for (const g of geos) g.deleteAttribute('uv');
  return mergeGeometries(geos);
}

export function brainTex(c1, c2) {
  const r = rng(11);
  return canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = c1;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = c2;
    g.lineWidth = 7;
    g.lineCap = 'round';
    for (let k = 0; k < 90; k++) {
      let x = r() * w, y = r() * h, a = r() * 6.28;
      g.beginPath();
      g.moveTo(x, y);
      for (let i = 0; i < 26; i++) { a += (r() - 0.5) * 1.1; x += Math.cos(a) * 9; y += Math.sin(a) * 9; g.lineTo(x, y); }
      g.stroke();
    }
  });
}

export function fanTex(col) {
  const r = rng(5);
  return canvasTexture(512, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = col;
    g.lineCap = 'round';
    // fan: branching veins from the bottom centre, plus a fine lattice
    const vein = (x, y, a, l, wdt) => {
      if (l < 8) return;
      const x2 = x + Math.cos(a) * l, y2 = y - Math.sin(a) * l;
      g.lineWidth = wdt;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
      vein(x2, y2, a + 0.25 + r() * 0.15, l * 0.8, wdt * 0.8);
      vein(x2, y2, a - 0.25 - r() * 0.15, l * 0.8, wdt * 0.8);
    };
    vein(w / 2, h, Math.PI / 2, 120, 10);
    g.lineWidth = 2;
    g.globalAlpha = 0.7;
    for (let i = 0; i < 70; i++) { g.beginPath(); g.arc(w / 2, h, 40 + i * 6, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
  });
}

// keep the space between each set-up and its camera free of props



