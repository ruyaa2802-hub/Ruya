import * as THREE from 'three';
import { clamp, rng, canvasTexture, softDotTexture } from './util.js';

// ---------------------------------------------------------------------------
// Snap effects (units: cm). What happens when the claw snaps shut (≈0.3 ms):
//   1. the plunger drives into the socket and a high-speed WATER JET leaves
//      the claw (~25–30 m/s);
//   2. pressure inside the jet's vortex drops below vapour pressure → a
//      CAVITATION BUBBLE grows ahead of the claw (a few mm);
//   3. the bubble COLLAPSES violently: a shock wave (the loud snap), heat and a
//      tiny, extremely short flash of light (sonoluminescence);
//   4. rebound: a cloud of micro-bubbles.
// The film shows these in slow motion; each piece is a pure function of its
// own progress parameter so the timeline can stretch time freely.
// ---------------------------------------------------------------------------
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const Z = V(0, 0, 1);

const NOISE = /* glsl */ `
  float h31(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float vnoise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z); }`;

export function createFX(scene) {
  const R = rng(91);
  const time = { value: 0 };

  // ---------------- water jet: a cone of streaming, refracting turbulence ----------------
  const jetGeo = new THREE.CylinderGeometry(1, 0.35, 1, 40, 24, true);
  jetGeo.translate(0, 0.5, 0);
  jetGeo.rotateX(Math.PI / 2); // along +z, from z=0 (claw) to z=1
  const jetMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uTime: time, uFlow: { value: 0 }, uInt: { value: 0 }, uLen: { value: 1 } },
    vertexShader: /* glsl */ `varying vec3 vP; varying vec3 vN; varying vec3 vV;
      void main(){ vP = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; vN = normalMatrix * normal; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `${NOISE}
      uniform float uTime, uFlow, uInt, uLen; varying vec3 vP; varying vec3 vN; varying vec3 vV;
      void main(){
        float a = atan(vP.y, vP.x);
        float streak = vnoise(vec3(a * 3.0, vP.z * 6.0 / max(uLen, 0.2) - uFlow * 9.0, 1.0));
        streak = pow(streak, 4.0) + 0.6 * pow(vnoise(vec3(a * 9.0, vP.z * 14.0 - uFlow * 17.0, 4.0)), 6.0);
        float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 1.5);
        float along = smoothstep(0.0, 0.08, vP.z) * (1.0 - smoothstep(0.65, 1.0, vP.z));
        vec3 c = mix(vec3(0.35, 0.75, 1.0), vec3(0.95, 1.0, 1.0), streak);
        gl_FragColor = vec4(c * (0.06 + 1.3 * streak) * (0.25 + fres) * along * uInt * 0.75, 1.0);
      }`,
  });
  const jet = new THREE.Mesh(jetGeo, jetMat);
  jet.frustumCulled = false;
  scene.add(jet);

  // ---------------- cavitation bubble ----------------
  const bubGeo = new THREE.SphereGeometry(1, 96, 64);
  const bubMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: true, // writes depth so the depth-of-field keeps the bubble sharp
    uniforms: { uTime: time, uWob: { value: 0.03 }, uWrinkle: { value: 0 }, uLight: { value: new THREE.Vector3(0, 1, 0) }, uAlpha: { value: 1 }, uGlow: { value: 0 } },
    vertexShader: /* glsl */ `${NOISE}
      uniform float uTime, uWob, uWrinkle; varying vec3 vN; varying vec3 vV; varying vec3 vW; varying float vNs;
      void main(){
        vec3 p = position;
        float n = vnoise(p * 2.5 + uTime * 0.9) - 0.5;
        float w = vnoise(p * 9.0 + uTime * 2.0) - 0.5;
        float d = n * uWob + w * uWrinkle;
        vNs = d;
        p *= 1.0 + d;
        vec4 wp = modelMatrix * vec4(p, 1.0); vW = wp.xyz;
        vec4 mv = viewMatrix * wp; vV = -mv.xyz;
        vN = normalize(normalMatrix * normalize(normal + vec3(n, w, n * w) * (uWob + uWrinkle) * 4.0));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uLight; uniform float uAlpha, uGlow; varying vec3 vN; varying vec3 vV; varying vec3 vW; varying float vNs;
      void main(){
        vec3 n = normalize(vN), v = normalize(vV);
        float ndv = clamp(abs(dot(n, v)), 0.0, 1.0);
        float fres = pow(1.0 - ndv, 3.0);
        // a gas bubble in water: almost total internal reflection at the rim (bright, silvery edge),
        // a darker clear centre, two sharp highlights (torch + moon), a faint inner caustic ring
        vec3 l = normalize(uLight);
        vec3 hv = normalize(l + v);
        float spec = pow(max(dot(n, hv), 0.0), 140.0) * 6.0 + pow(max(dot(n, normalize(vec3(-0.3, 1.0, 0.2) + v)), 0.0), 60.0) * 1.2;
        float ring = smoothstep(0.55, 0.62, ndv) * (1.0 - smoothstep(0.62, 0.72, ndv)) * 0.35;
        vec3 rim = mix(vec3(0.55, 0.85, 1.0), vec3(1.0), fres);
        vec3 c = rim * (fres * 2.2 + ring) + vec3(spec) + vec3(0.02, 0.05, 0.08) + vec3(0.6, 0.8, 1.0) * uGlow;
        float a = clamp(0.1 + fres * 1.1 + ring + spec + uGlow, 0.0, 1.0) * uAlpha;
        gl_FragColor = vec4(c, a);
      }`,
  });
  const bubble = new THREE.Mesh(bubGeo, bubMat);
  bubble.frustumCulled = false;
  bubble.renderOrder = 5;
  scene.add(bubble);

  // ---------------- collapse flash: point light + glow sprite with streaks ----------------
  const flashLight = new THREE.PointLight('#cfe6ff', 0, 40, 2);
  scene.add(flashLight);
  const flareTex = canvasTexture(256, 256, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.08, 'rgba(230,245,255,0.95)'); gr.addColorStop(0.25, 'rgba(120,190,255,0.35)'); gr.addColorStop(1, 'rgba(40,90,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'lighter';
    for (const [a, l, wd] of [[0, 1, 3], [Math.PI / 2, 1, 3], [Math.PI / 4, 0.55, 2], [-Math.PI / 4, 0.55, 2]]) {
      g.save(); g.translate(w / 2, h / 2); g.rotate(a);
      const lg = g.createLinearGradient(-w / 2 * l, 0, w / 2 * l, 0);
      lg.addColorStop(0, 'rgba(160,210,255,0)'); lg.addColorStop(0.5, 'rgba(235,248,255,0.9)'); lg.addColorStop(1, 'rgba(160,210,255,0)');
      g.fillStyle = lg; g.fillRect(-w / 2 * l, -wd, w * l, wd * 2); g.restore();
    }
  });
  const flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: flareTex, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, fog: false }));
  flare.renderOrder = 20;
  scene.add(flare);

  // ---------------- shock wave shell (the visible part; post adds refraction) ----------------
  const shockMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uInt: { value: 0 } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vV = -mv.xyz; vN = normalMatrix * normal; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform float uInt; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 9.0); gl_FragColor = vec4(vec3(0.6, 0.85, 1.0) * f * uInt * 0.45, 1.0); }',
  });
  const shock = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 40), shockMat);
  shock.frustumCulled = false;
  scene.add(shock);

  // ---------------- micro-bubbles (rebound cloud) and stirred sand ----------------
  const bubbleTex = canvasTexture(64, 64, (g, w, h) => {
    g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 3; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 4, 0, 6.283); g.stroke();
    g.fillStyle = 'rgba(200,235,255,0.12)'; g.fill();
    g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); g.arc(w * 0.36, h * 0.34, 5, 0, 6.283); g.fill();
  });
  const NM = 220;
  const mGeo = new THREE.BufferGeometry();
  mGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NM * 3), 3));
  const micro = new THREE.Points(mGeo, new THREE.PointsMaterial({ map: bubbleTex, size: 0.05, transparent: true, depthWrite: false, opacity: 0 }));
  micro.frustumCulled = false;
  scene.add(micro);
  const mSeeds = Array.from({ length: NM }, () => [V(R() - 0.5, R() - 0.5, R() - 0.5).normalize(), R(), R(), R()]);
  const ND = 160;
  const dGeo = new THREE.BufferGeometry();
  dGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ND * 3), 3));
  const dust = new THREE.Points(dGeo, new THREE.PointsMaterial({ map: softDotTexture(), size: 0.08, color: '#c8b896', transparent: true, depthWrite: false, opacity: 0 }));
  dust.frustumCulled = false;
  scene.add(dust);
  const dSeeds = Array.from({ length: ND }, () => [R() * 6.283, R(), R(), R()]);

  const q = new THREE.Quaternion();
  const hide = () => { jet.visible = bubble.visible = shock.visible = micro.visible = dust.visible = flare.visible = false; flashLight.intensity = 0; };
  hide();

  return {
    time,
    // one snap event, as a function of its stages (all 0…1 unless noted):
    //   o: jet origin, d: jet direction (unit), t: film time (for flow animation)
    //   jet: jet extension, jetI: jet brightness, R: bubble radius (cm), wrinkle: collapse wrinkles,
    //   flash: flash brightness, shockR: shock radius (cm), shockI: shock visibility,
    //   rebound: micro-bubble cloud progress, dust: sand stirred (progress), light: highlight direction
    set(s) {
      hide();
      time.value = s.t;
      q.setFromUnitVectors(Z, s.d);
      const bc = s.bc || s.o.clone().addScaledVector(s.d, (s.bubOff ?? 0.9));
      if (s.jet > 0.001 && s.jetI > 0.001) {
        jet.visible = true;
        const L = 0.3 + 2.2 * s.jet;
        jet.position.copy(s.o);
        jet.quaternion.copy(q);
        jet.scale.set(0.05 + 0.06 * s.jet, 0.05 + 0.06 * s.jet, L);
        jetMat.uniforms.uFlow.value = s.flow ?? s.t;
        jetMat.uniforms.uInt.value = s.jetI;
        jetMat.uniforms.uLen.value = L;
      }
      if (s.R > 0.004) {
        bubble.visible = true;
        bubble.position.copy(bc);
        bubble.quaternion.copy(q);
        const el = s.elong ?? 1.35;
        bubble.scale.set(s.R, s.R, s.R * el);
        bubMat.uniforms.uWob.value = s.wob ?? 0.035;
        bubMat.uniforms.uWrinkle.value = s.wrinkle || 0;
        bubMat.uniforms.uAlpha.value = s.alpha ?? 1;
        bubMat.uniforms.uGlow.value = s.glow || 0;
        if (s.light) bubMat.uniforms.uLight.value.copy(s.light);
      }
      if (s.flash > 0.002) {
        flare.visible = true;
        flare.position.copy(bc);
        const sc = (s.flareSize ?? 1.6) * (0.4 + 0.6 * s.flash);
        flare.scale.set(sc, sc, 1);
        flare.material.opacity = Math.min(1, s.flash * 1.3);
        flashLight.position.copy(bc);
        flashLight.intensity = 22 * s.flash;
      }
      if (s.shockI > 0.002 && s.shockR > 0.01) {
        shock.visible = true;
        shock.position.copy(bc);
        shock.scale.setScalar(s.shockR);
        shockMat.uniforms.uInt.value = s.shockI;
      }
      if (s.rebound > 0 && s.rebound < 1) {
        micro.visible = true;
        const a = mGeo.attributes.position.array, e = s.rebound;
        mSeeds.forEach(([dir, r, k, ph], i) => {
          const rr = (0.05 + 0.9 * r) * (1 - Math.exp(-e * 5)) * (s.cloud ?? 0.6);
          const p = bc.clone().addScaledVector(dir, rr).addScaledVector(s.d, 0.3 * e * k);
          p.y += e * (0.2 + 0.5 * k);
          a.set([p.x, p.y, p.z], i * 3);
        });
        mGeo.attributes.position.needsUpdate = true;
        micro.material.opacity = Math.min(1, e * 8) * (1 - Math.pow(e, 2));
        micro.material.size = (s.microSize ?? 0.05);
      }
      if (s.dust > 0 && s.dust < 1) {
        dust.visible = true;
        const a = dGeo.attributes.position.array, e = s.dust;
        const base = s.dustAt || bc;
        dSeeds.forEach(([ang, r, k, ph], i) => {
          const rr = (0.3 + 1.6 * r) * (1 - Math.exp(-e * 4));
          a.set([base.x + Math.cos(ang) * rr, (s.ground ?? 0) + 0.05 + (0.15 + 0.8 * k) * Math.sin(Math.min(1, e * 1.5) * Math.PI * 0.8) * (1 - e * 0.3), base.z + Math.sin(ang) * rr], i * 3);
        });
        dGeo.attributes.position.needsUpdate = true;
        dust.material.opacity = 0.75 * Math.min(1, e * 6) * (1 - e);
      }
      return bc;
    },
  };
}

// Rayleigh-like bubble history on a normalised clock u ∈ [0,1]:
//   growth (0 → uMax), near-symmetric collapse that accelerates to zero at u = 1.
export function bubbleRadius(u, Rmax, uMax = 0.48) {
  if (u <= 0 || u >= 1) return 0;
  if (u < uMax) { const k = u / uMax; return Rmax * Math.pow(Math.sin(k * Math.PI / 2), 0.7); }
  const k = (u - uMax) / (1 - uMax);
  return Rmax * Math.pow(Math.max(0, 1 - k * k), 0.45);
}
