import * as THREE from 'three';
import { rng, softDotTexture, v3, clamp } from './util.js';

// ---------------------------------------------------------------------------
// Visualised scent (not something visible in reality — a storytelling device):
//  * thin translucent ribbons drifting away from a source, a soft flow along them
//  * slow glowing motes along the same paths
//  * an "inhale" stream of motes flowing into the dog's nose while it sniffs
// Everything lives on layer 1, which the mirror's reflection camera does not see.
// ---------------------------------------------------------------------------
const LAYER = 1;
const RIBBON_VS = /* glsl */ `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const RIBBON_FS = /* glsl */ `
  uniform vec3 col; uniform float alpha; uniform float time; uniform float reveal; uniform float seed;
  varying vec2 vUv;
  void main(){
    float across = 1.0 - abs(vUv.y - 0.5) * 2.0;
    float u = vUv.x;
    float ends = smoothstep(0.0, 0.12, u) * (1.0 - smoothstep(0.7, 1.0, u));
    float flow = 0.55 + 0.45 * sin(u * 16.0 - time * 2.2 + seed);
    float wisp = 0.65 + 0.35 * sin(vUv.y * 7.0 + u * 11.0 - time * 1.3 + seed * 2.0);
    float rv = 1.0 - smoothstep(reveal - 0.12, reveal, u);
    float a = across * across * ends * flow * wisp * rv * alpha;
    gl_FragColor = vec4(col * a, 1.0);
  }`;

export function createScent(scene, seed = 5) {
  const R = rng(seed);
  const dot = softDotTexture();
  const sources = {};
  const group = new THREE.Group();
  scene.add(group);

  function ribbonGeo(curve, width, n = 48) {
    const pos = new Float32Array((n + 1) * 2 * 3), uv = new Float32Array((n + 1) * 2 * 2), idx = [];
    const up = v3(0, 1, 0);
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const p = curve.getPointAt(u), tg = curve.getTangentAt(u);
      const side = new THREE.Vector3().crossVectors(tg, up).normalize();
      if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
      // ribbons slowly twist toward the vertical so they read from any angle
      side.applyAxisAngle(tg, u * 1.4);
      const w = width * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, u * 1.3)));
      for (let k = 0; k < 2; k++) {
        const q = p.clone().addScaledVector(side, (k - 0.5) * w);
        pos.set([q.x, q.y, q.z], (i * 2 + k) * 3);
        uv.set([u, k], (i * 2 + k) * 2);
      }
      if (i < n) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
  }

  return {
    group,
    // spread: how far the plume drifts; height: how high it rises
    addSource(name, pos, color, { n = 6, spread = 0.7, height = 0.25, width = 0.07, dir = v3(0.3, 0, 0.6) } = {}) {
      const col = new THREE.Color(color);
      const ribbons = [], curves = [];
      for (let k = 0; k < n; k++) {
        const d = dir.clone().normalize().applyAxisAngle(v3(0, 1, 0), (R() - 0.5) * 1.6);
        const L = spread * (0.6 + R() * 0.6);
        const pts = [];
        for (let i = 0; i <= 5; i++) {
          const f = i / 5;
          pts.push(pos.clone().add(v3(
            d.x * L * f + Math.sin(f * 5 + k * 2) * 0.06 * f,
            0.015 + height * (0.2 + 0.8 * f) * (0.6 + R() * 0.6) + Math.sin(f * 4 + k) * 0.03,
            d.z * L * f + Math.cos(f * 5 + k * 3) * 0.06 * f,
          )));
        }
        const curve = new THREE.CatmullRomCurve3(pts);
        curves.push(curve);
        const m = new THREE.Mesh(ribbonGeo(curve, width * (0.6 + R() * 0.8)), new THREE.ShaderMaterial({
          vertexShader: RIBBON_VS, fragmentShader: RIBBON_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
          uniforms: { col: { value: col }, alpha: { value: 0 }, time: { value: 0 }, reveal: { value: 0 }, seed: { value: R() * 6 } },
        }));
        m.layers.set(LAYER);
        m.frustumCulled = false;
        group.add(m);
        ribbons.push(m);
      }
      // motes drifting along the ribbons
      const NM = 70;
      const mg = new THREE.BufferGeometry();
      mg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NM * 3), 3));
      const motes = new THREE.Points(mg, new THREE.PointsMaterial({ size: 0.022, map: dot, color: col.clone().multiplyScalar(1.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
      motes.layers.set(LAYER);
      motes.frustumCulled = false;
      group.add(motes);
      // inhale stream (source → nose)
      const NI = 60;
      const ig = new THREE.BufferGeometry();
      ig.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NI * 3), 3));
      const inhale = new THREE.Points(ig, new THREE.PointsMaterial({ size: 0.014, map: dot, color: col.clone().multiplyScalar(2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
      inhale.layers.set(LAYER);
      inhale.frustumCulled = false;
      group.add(inhale);
      sources[name] = { pos: pos.clone(), col, ribbons, curves, motes, NM, inhale, NI, seeds: Array.from({ length: NM }, () => [R(), R(), R()]) };
    },
    // state: { name: { a: visibility 0..1, reveal: 0..1, inhale: 0..1, nose: Vector3 } }
    update(t, state) {
      for (const [name, S] of Object.entries(sources)) {
        const st = state[name] || {};
        const a = clamp(st.a ?? 0);
        const reveal = st.reveal ?? 1;
        for (const r of S.ribbons) {
          r.visible = a > 0.002;
          r.material.uniforms.alpha.value = a * 0.55;
          r.material.uniforms.time.value = t;
          r.material.uniforms.reveal.value = reveal * 1.15;
        }
        S.motes.visible = a > 0.002;
        S.motes.material.opacity = a * 0.9;
        if (S.motes.visible) {
          const arr = S.motes.geometry.attributes.position.array;
          for (let i = 0; i < S.NM; i++) {
            const [s1, s2, s3] = S.seeds[i];
            const c = S.curves[i % S.curves.length];
            const u = ((s1 + t * (0.04 + 0.05 * s2)) % 1) * Math.min(1, reveal * 1.1);
            const p = c.getPointAt(u);
            arr[i * 3] = p.x + Math.sin(t * 0.8 + s3 * 9) * 0.02;
            arr[i * 3 + 1] = p.y + Math.sin(t * 0.6 + s2 * 7) * 0.015;
            arr[i * 3 + 2] = p.z + Math.cos(t * 0.7 + s1 * 5) * 0.02;
          }
          S.motes.geometry.attributes.position.needsUpdate = true;
        }
        const inh = clamp(st.inhale ?? 0);
        S.inhale.visible = inh > 0.002 && !!st.nose;
        S.inhale.material.opacity = inh;
        if (S.inhale.visible) {
          const arr = S.inhale.geometry.attributes.position.array;
          const A = st.from || S.pos.clone().add(v3(0, 0.03, 0)), B = st.nose;
          const M = A.clone().lerp(B, 0.5).add(v3(0, 0.05, 0));
          for (let i = 0; i < S.NI; i++) {
            const f = (i / S.NI + t * 1.4) % 1;
            const e = f * f;
            const p = A.clone().multiplyScalar((1 - e) * (1 - e)).addScaledVector(M, 2 * e * (1 - e)).addScaledVector(B, e * e);
            const j = (1 - e) * 0.05;
            arr[i * 3] = p.x + Math.sin(i * 12.9) * j;
            arr[i * 3 + 1] = p.y + Math.sin(i * 7.7) * j * 0.5;
            arr[i * 3 + 2] = p.z + Math.cos(i * 4.1) * j;
          }
          S.inhale.geometry.attributes.position.needsUpdate = true;
        }
      }
    },
  };
}

// a soft warm aura of scent around the real dog (absent from the reflection)
export function createAura(scene, color = '#ffd28a') {
  const N = 140;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.02, map: softDotTexture(), color: new THREE.Color(color).multiplyScalar(1.5), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  pts.layers.set(LAYER);
  pts.frustumCulled = false;
  scene.add(pts);
  const R = rng(9);
  const seeds = Array.from({ length: N }, () => [R() - 0.5, R(), R() - 0.5, R()]);
  return {
    pts,
    update(t, center, a, len = 0.8) {
      pts.visible = a > 0.002;
      pts.material.opacity = a;
      if (!pts.visible) return;
      const arr = g.attributes.position.array;
      for (let i = 0; i < N; i++) {
        const [x, y, z, s] = seeds[i];
        const rise = (s + t * 0.12) % 1;
        arr[i * 3] = center.x + x * 0.45 + Math.sin(t + i) * 0.02;
        arr[i * 3 + 1] = center.y + 0.05 + rise * 0.6;
        arr[i * 3 + 2] = center.z + z * len + Math.cos(t * 0.8 + i) * 0.02;
      }
      g.attributes.position.needsUpdate = true;
    },
  };
}
