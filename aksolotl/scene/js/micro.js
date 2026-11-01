import * as THREE from 'three';
import { canvasTexture, rng, clamp, lerp, ss, easeInOut, softDotTexture } from './util.js';

// ---------------------------------------------------------------------------
// Cellular view of the regenerating limb tip (scientific illustration, not to
// scale). A translucent wound epidermis (the dome) covers the stump.
//  A  cells from the old tissues — cartilage/bone, muscle, skin/connective
//     tissue, nerve sheath, vessel walls — migrate under the cap and partly
//     "forget" their specialised look (colours fade toward a glowing blastema
//     tone but keep a hint of their lineage).
//  B  the blastema proliferates: cells divide and the bud swells.
//  C  cells re-specialise and sort into tissues: a cartilage/bone core,
//     muscle around it, nerves and vessels running along, skin outside.
// All motion is a pure function of the local time m (seconds since entry).
// ---------------------------------------------------------------------------
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const TYPES = {
  bone: { c: '#dfe9ff', frac: 0.24 },
  muscle: { c: '#ff4d5e', frac: 0.3 },
  skin: { c: '#ffb3c6', frac: 0.26 },
  nerve: { c: '#ffd84a', frac: 0.1 },
  vessel: { c: '#7a5cff', frac: 0.1 },
};
const BLASTEMA = new THREE.Color('#bff6ff');

export function createMicro() {
  const scene = new THREE.Scene();
  scene.background = null;
  const bg = new THREE.Mesh(new THREE.SphereGeometry(60, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec3 vP; void main(){ float y = vP.y * 0.5 + 0.5; vec3 c = mix(vec3(0.05, 0.02, 0.09), vec3(0.16, 0.06, 0.2), y); c += vec3(0.08, 0.02, 0.06) * pow(max(0.0, 1.0 - length(vP.xz)), 3.0); gl_FragColor = vec4(c, 1.0); }',
  }));
  scene.add(bg);
  scene.add(new THREE.HemisphereLight('#ffd6f0', '#201030', 1.2));
  const key = new THREE.DirectionalLight('#ffffff', 1.6);
  key.position.set(3, 6, 5);
  scene.add(key);
  const back = new THREE.PointLight('#ff9ad5', 30, 12, 2);
  back.position.set(0, 1.4, -2.5);
  scene.add(back);

  // ---- wound epidermis / new skin: translucent dome with an epithelial pattern ----
  const epiTex = canvasTexture(512, 512, (g, w, h) => {
    const r = rng(2);
    g.fillStyle = '#000';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,190,220,0.9)';
    g.lineWidth = 2;
    for (let i = 0; i < 420; i++) {
      const x = r() * w, y = r() * h, s = 10 + r() * 8;
      g.beginPath();
      for (let k = 0; k <= 6; k++) { const a = k * Math.PI / 3 + r() * 0.2; g.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s); }
      g.stroke();
    }
  }, { repeat: [3, 2] });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { map: { value: epiTex }, a: { value: 1 } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; varying vec2 vUv; void main(){ vUv = uv * vec2(3.0, 2.0); vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform sampler2D map; uniform float a; varying vec3 vN; varying vec3 vV; varying vec2 vUv; void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0); float pat = texture2D(map, vUv).r; vec3 c = vec3(1.0, 0.55, 0.75) * (0.05 + 0.55 * f) + vec3(1.0, 0.75, 0.9) * pat * (0.12 + 0.3 * f); gl_FragColor = vec4(c * a, 1.0); }',
  }));
  scene.add(dome);
  // old stump tissue below (a dim floor of packed cells)
  const floorTex = canvasTexture(512, 512, (g, w, h) => {
    const r = rng(4);
    g.fillStyle = '#2a0f22'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${150 + r() * 80},${60 + r() * 40},${100 + r() * 60},${0.25 + r() * 0.3})`; g.beginPath(); g.arc(r() * w, r() * h, 5 + r() * 9, 0, 6.283); g.fill(); }
  }, { repeat: [4, 4] });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(8, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.8, emissive: '#3a1030', emissiveIntensity: 0.4 }));
  floor.position.y = -0.62;
  scene.add(floor);

  // ---- cells ----
  const R = rng(77);
  const N = 460, N0 = 170; // N0 cells migrate in, the rest are born by division
  const cellGeo = new THREE.SphereGeometry(1, 18, 12);
  const cellMat = new THREE.MeshPhysicalMaterial({ roughness: 0.25, clearcoat: 0.8, transparent: true, opacity: 0.82, emissive: '#ffffff', emissiveIntensity: 0.18, depthWrite: true });
  const cells = new THREE.InstancedMesh(cellGeo, cellMat, N);
  const nuclei = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshStandardMaterial({ color: '#4a1a6a', emissive: '#6a2a9a', emissiveIntensity: 0.5, roughness: 0.4 }), N);
  cells.frustumCulled = nuclei.frustumCulled = false;
  scene.add(cells, nuclei);
  const typeList = [];
  for (const [k, v] of Object.entries(TYPES)) for (let i = 0; i < Math.round(v.frac * N); i++) typeList.push(k);
  while (typeList.length < N) typeList.push('skin');
  // shuffle deterministically
  for (let i = typeList.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [typeList[i], typeList[j]] = [typeList[j], typeList[i]]; }
  const ballPos = (i, n) => { // position inside the blastema ball when n cells exist
    let p;
    do p = V(R() * 2 - 1, R() * 2 - 1, R() * 2 - 1); while (p.lengthSq() > 1);
    return p;
  };
  const C = [];
  for (let i = 0; i < N; i++) {
    const type = typeList[i];
    const unit = ballPos();
    const born = i < N0 ? -1 : 3.4 + ((i - N0) / (N - N0)) * 2.4 + R() * 0.2;
    // start: scattered in the old tissue below and around
    const a = R() * 6.283, rr = 1.6 + R() * 2.2;
    const start = V(Math.cos(a) * rr, -0.45 + R() * 0.3, Math.sin(a) * rr);
    // final: sorted into a limb-bud cylinder (axis = y)
    const h = 0.05 + R() * 1.75;
    const th = R() * 6.283;
    let rad;
    if (type === 'bone') rad = R() * 0.22;
    else if (type === 'muscle') rad = 0.3 + R() * 0.22;
    else if (type === 'skin') rad = 0.7 + R() * 0.08;
    else rad = 0.52 + R() * 0.06;
    let th2 = th;
    if (type === 'nerve') th2 = [0.4, 2.5, 4.4][i % 3] + (R() - 0.5) * 0.12;
    if (type === 'vessel') th2 = [1.3, 3.4, 5.4][i % 3] + (R() - 0.5) * 0.12;
    const taper = 1 - 0.35 * (h / 1.8) * (h / 1.8);
    const fin = V(Math.cos(th2) * rad * taper, h, Math.sin(th2) * rad * taper);
    C.push({ type, unit, born, start, fin, parent: i < N0 ? -1 : Math.floor(R() * N0), delay: R() * 0.35 + h * 0.18, ph: R() * 6.283, col: new THREE.Color(TYPES[type].c) });
  }
  // background bokeh
  const NBK = 80;
  const bkGeo = new THREE.BufferGeometry();
  const bkPos = new Float32Array(NBK * 3);
  for (let i = 0; i < NBK; i++) bkPos.set([(R() - 0.5) * 16, (R() - 0.2) * 8, -3 - R() * 10], i * 3);
  bkGeo.setAttribute('position', new THREE.BufferAttribute(bkPos, 3));
  const bokeh = new THREE.Points(bkGeo, new THREE.PointsMaterial({ map: softDotTexture(), size: 0.9, color: '#ff8fd0', transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(bokeh);

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
  return {
    scene, dome, cells, N, N0,
    // m: seconds since the dive; returns progress values for overlays
    update(m) {
      const mig = easeInOut(clamp(m / 2.4)); // A
      const dediff = ss(0.3, 2.2, m) * (1 - ss(6.0, 7.4, m));
      let alive = 0;
      for (let i = 0; i < N; i++) {
        const c = C[i];
        if (c.born > 0 && m < c.born) { m4.makeScale(0, 0, 0); cells.setMatrixAt(i, m4); nuclei.setMatrixAt(i, m4); continue; }
        alive++;
        const n = N0 + clamp((m - 3.4) / 2.4) * (N - N0);
        const ballR = 0.55 * Math.cbrt(n / N0); // the bud swells as cells divide
        const ballC = V(0, 0.15 + 0.35 * (ballR - 0.55), 0);
        const inBall = ballC.clone().addScaledVector(c.unit, ballR);
        let p;
        if (c.born < 0) p = c.start.clone().lerp(inBall, mig);
        else {
          const par = C[c.parent];
          const pp = par.start.clone().lerp(ballC.clone().addScaledVector(par.unit, ballR), 1);
          const sep = ss(c.born, c.born + 0.45, m);
          p = pp.lerp(inBall, sep);
        }
        const diff = easeInOut(clamp((m - 6.0 - c.delay) / 1.4));
        p.lerp(c.fin, diff);
        p.x += 0.02 * Math.sin(m * 2 + c.ph);
        p.y += 0.02 * Math.cos(m * 1.7 + c.ph);
        // shape: division pinch, elongated muscle cells, flattened skin cells
        const pinch = c.born > 0 ? 1 - 0.3 * Math.sin(Math.PI * ss(c.born, c.born + 0.45, m)) : 1;
        let sx = 0.085, sy = 0.085, sz = 0.085;
        if (c.type === 'muscle') sy *= 1 + 0.9 * diff;
        if (c.type === 'skin') { sx *= 1 + 0.3 * diff; sz *= 1 + 0.3 * diff; sy *= 1 - 0.35 * diff; }
        if (c.type === 'nerve' || c.type === 'vessel') sy *= 1 + 1.2 * diff;
        const breath = 1 + 0.05 * Math.sin(m * 3 + c.ph);
        q.setFromEuler(new THREE.Euler(0.2 * Math.sin(c.ph), c.ph, 0));
        m4.compose(p, q, V(sx * breath * pinch, sy * breath, sz * breath * pinch));
        cells.setMatrixAt(i, m4);
        m4.compose(p, q, V(sx * 0.42, sy * 0.38, sz * 0.42));
        nuclei.setMatrixAt(i, m4);
        // colour: lineage colour fades toward the blastema glow (with a hint kept), then returns vivid
        col.copy(c.col).lerp(BLASTEMA, 0.78 * dediff);
        cells.setColorAt(i, col);
      }
      cells.instanceMatrix.needsUpdate = true;
      nuclei.instanceMatrix.needsUpdate = true;
      cells.instanceColor.needsUpdate = true;
      cellMat.emissiveIntensity = 0.18 + 0.35 * dediff;
      const domeScale = 0.75 + 0.55 * ss(3.2, 5.9, m) + 0.5 * ss(6.0, 7.8, m);
      dome.scale.set(1.05 * (0.85 + 0.15 * domeScale), 1.15 * domeScale + 0.3, 1.05 * (0.85 + 0.15 * domeScale));
      dome.position.y = -0.55;
      bokeh.rotation.y = m * 0.02;
      return { alive, mig, dediff };
    },
  };
}
