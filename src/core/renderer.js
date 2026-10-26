// Film renderer: HDR scene render (MSAA) -> optional sub-frame accumulation
// (real shutter motion blur + sub-pixel jitter) -> depth-of-field from the
// depth buffer -> bloom -> ACES tone map + grade + vignette + grain -> HUD.
import * as THREE from 'three';

const FSQ_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

function quadPass(fragmentShader, uniforms, opts = {}) {
  const mat = new THREE.ShaderMaterial({ vertexShader: FSQ_VERT, fragmentShader, uniforms, depthTest: false, depthWrite: false, ...opts });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  mesh.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(mesh);
  return { mat, scene, uniforms };
}

const DEPTH_FN = /* glsl */ `
uniform sampler2D tDepth; uniform float uNear; uniform float uFar;
float linDepth(vec2 uv) {
  float z = texture2D(tDepth, uv).x * 2.0 - 1.0;
  return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
}
uniform float uFocus; uniform float uCocScale; uniform float uMaxCoc;
float coc(float d) { return clamp(uCocScale * abs(d - uFocus) / d, 0.0, uMaxCoc); }
float cocSigned(float d) { return clamp(uCocScale * (d - uFocus) / d, -uMaxCoc, uMaxCoc); }
`;

const DOF_FRAG = /* glsl */ `
varying vec2 vUv;
uniform sampler2D tColor; uniform vec2 uTexel;
${DEPTH_FN}
void main() {
  float d0 = linDepth(vUv);
  float c0 = cocSigned(d0);
  vec3 acc = vec3(0.0); float wsum = 0.0;
  const int N = 48;
  float ga = 2.39996323;
  for (int i = 0; i < N; i++) {
    float r = sqrt((float(i) + 0.5) / float(N));
    float a = float(i) * ga;
    vec2 off = vec2(cos(a), sin(a)) * r * uMaxCoc;
    vec2 uv = vUv + off * uTexel;
    float ds = linDepth(uv);
    float cs = cocSigned(ds);
    float dist = r * uMaxCoc;
    // a sample contributes if its own blur disc reaches this pixel; background
    // samples cannot spill over sharper foreground
    float reach = smoothstep(dist - 1.5, dist + 0.5, abs(cs));
    float behind = ds > d0 + 0.02 ? smoothstep(dist - 1.5, dist + 0.5, abs(c0)) : 1.0;
    float w = reach * mix(1.0, behind, step(0.0, cs));
    vec3 col = texture2D(tColor, uv).rgb;
    acc += col * w; wsum += w;
  }
  vec3 blurred = wsum > 0.0 ? acc / wsum : texture2D(tColor, vUv).rgb;
  gl_FragColor = vec4(blurred, abs(c0));
}`;

const BRIGHT_FRAG = /* glsl */ `
varying vec2 vUv; uniform sampler2D tColor; uniform float uThreshold;
void main() {
  vec3 c = texture2D(tColor, vUv).rgb;
  float l = max(c.r, max(c.g, c.b));
  gl_FragColor = vec4(c * smoothstep(uThreshold, uThreshold * 2.5, l), 1.0);
}`;
const BLUR_FRAG = /* glsl */ `
varying vec2 vUv; uniform sampler2D tColor; uniform vec2 uDir;
void main() {
  vec3 s = texture2D(tColor, vUv).rgb * 0.227;
  s += texture2D(tColor, vUv + uDir * 1.385).rgb * 0.316;
  s += texture2D(tColor, vUv - uDir * 1.385).rgb * 0.316;
  s += texture2D(tColor, vUv + uDir * 3.231).rgb * 0.07;
  s += texture2D(tColor, vUv - uDir * 3.231).rgb * 0.07;
  gl_FragColor = vec4(s, 1.0);
}`;

const FINAL_FRAG = /* glsl */ `
varying vec2 vUv;
uniform sampler2D tColor; uniform sampler2D tDof; uniform sampler2D tBloom; uniform sampler2D tBloom2; uniform sampler2D tHud;
uniform float uDofOn; uniform float uBloom; uniform float uExposure; uniform float uTime;
uniform vec3 uLift; uniform vec3 uGamma; uniform vec3 uGain; uniform float uSat; uniform float uContrast;
uniform float uVignette; uniform float uGrain; uniform float uFade; uniform vec2 uRes; uniform float uHudOn; uniform float uDebug;
${DEPTH_FN}
vec3 aces(vec3 x) {
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 uv = vUv;
  // subtle lateral chromatic aberration toward the edges
  vec2 cc = uv - 0.5;
  float ca = dot(cc, cc) * 0.0035;
  vec3 sharp;
  sharp.r = texture2D(tColor, uv + cc * ca).r;
  sharp.g = texture2D(tColor, uv).g;
  sharp.b = texture2D(tColor, uv - cc * ca).b;
  vec3 col = sharp;
  if (uDofOn > 0.5) {
    float c0 = coc(linDepth(uv));
    vec4 b = texture2D(tDof, uv);
    float m = smoothstep(0.6, 2.2, max(c0, b.a));
    col = mix(sharp, b.rgb, m);
  }
  col += (texture2D(tBloom, uv).rgb * 0.6 + texture2D(tBloom2, uv).rgb * 0.4) * uBloom;
  col *= uExposure;
  col = aces(col);
  // grade (in display-ish space)
  col = pow(max(col, 0.0), vec3(1.0 / 2.2));
  col = col * uGain + uLift * (1.0 - col);
  col = pow(max(col, 0.0), 1.0 / uGamma);
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l), col, uSat);
  col = (col - 0.5) * uContrast + 0.5;
  float v = smoothstep(0.85, 0.2, length(cc * vec2(0.9, 1.1)));
  col *= mix(1.0, v, uVignette);
  float n = hash(uv * uRes + fract(uTime * 7.31) * 113.0) - 0.5;
  col += n * uGrain * (1.0 - l * 0.6);
  col *= uFade;
  if (uHudOn > 0.5) {
    vec4 h = texture2D(tHud, uv);
    col = col * (1.0 - h.a) + h.rgb;
  }
  if (uDebug > 0.5) col = vec3(coc(linDepth(uv)) / uMaxCoc, fract(linDepth(uv)), texture2D(tDepth, uv).x);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

const ACCUM_FRAG = /* glsl */ `
varying vec2 vUv; uniform sampler2D tColor; uniform float uWeight;
void main() { gl_FragColor = vec4(texture2D(tColor, vUv).rgb * uWeight, 1.0); }`;

export const DEFAULT_GRADE = {
  lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1], sat: 1, contrast: 1, exposure: 1,
  vignette: 0.35, grain: 0.035, bloom: 0.35, threshold: 1.2, fade: 1,
};

export class FilmRenderer {
  constructor({ width, height, pixelRatio = 1, canvas } = {}) {
    this.width = width; this.height = height;
    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: false, canvas, preserveDrawingBuffer: true, powerPreference: 'high-performance' }));
    r.setPixelRatio(pixelRatio);
    r.setSize(width, height, false);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.outputColorSpace = THREE.LinearSRGBColorSpace; // final shader writes display values
    r.toneMapping = THREE.NoToneMapping;
    this.canvas = r.domElement;
    const W = width * pixelRatio, H = height * pixelRatio;
    this.W = W; this.H = H;
    const depthTex = new THREE.DepthTexture(W, H);
    depthTex.type = THREE.UnsignedIntType;
    this.sceneRT = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4, depthTexture: depthTex });
    this.accumRT = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });
    const hw = Math.ceil(W / 2), hh = Math.ceil(H / 2);
    this.dofRT = new THREE.WebGLRenderTarget(hw, hh, { type: THREE.HalfFloatType });
    const qw = Math.ceil(W / 4), qh = Math.ceil(H / 4);
    this.bloomA = new THREE.WebGLRenderTarget(qw, qh, { type: THREE.HalfFloatType });
    this.bloomB = new THREE.WebGLRenderTarget(qw, qh, { type: THREE.HalfFloatType });
    const ew = Math.ceil(W / 8), eh = Math.ceil(H / 8);
    this.bloomC = new THREE.WebGLRenderTarget(ew, eh, { type: THREE.HalfFloatType });
    this.bloomD = new THREE.WebGLRenderTarget(ew, eh, { type: THREE.HalfFloatType });

    const depthU = () => ({ tDepth: { value: depthTex }, uNear: { value: 0.05 }, uFar: { value: 60 }, uFocus: { value: 2 }, uCocScale: { value: 10 }, uMaxCoc: { value: 12 } });
    this.accum = quadPass(ACCUM_FRAG, { tColor: { value: null }, uWeight: { value: 1 } }, { blending: THREE.AdditiveBlending, transparent: true });
    this.dof = quadPass(DOF_FRAG, { tColor: { value: null }, uTexel: { value: new THREE.Vector2(1 / W, 1 / H) }, ...depthU() });
    this.bright = quadPass(BRIGHT_FRAG, { tColor: { value: null }, uThreshold: { value: 1.2 } });
    this.blur = quadPass(BLUR_FRAG, { tColor: { value: null }, uDir: { value: new THREE.Vector2() } });
    this.final = quadPass(FINAL_FRAG, {
      tColor: { value: null }, tDof: { value: this.dofRT.texture }, tBloom: { value: this.bloomA.texture }, tBloom2: { value: this.bloomC.texture },
      tHud: { value: null }, uHudOn: { value: 0 },
      uDofOn: { value: 1 }, uBloom: { value: 0.35 }, uExposure: { value: 1 }, uTime: { value: 0 },
      uLift: { value: new THREE.Vector3() }, uGamma: { value: new THREE.Vector3(1, 1, 1) }, uGain: { value: new THREE.Vector3(1, 1, 1) },
      uSat: { value: 1 }, uContrast: { value: 1 }, uVignette: { value: 0.35 }, uGrain: { value: 0.03 }, uFade: { value: 1 },
      uRes: { value: new THREE.Vector2(W, H) }, uDebug: { value: 0 },
      ...depthU(),
    });
    this.final.uniforms.tDepth.value = depthTex;
    this.dof.uniforms.tDepth.value = depthTex;
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.stats = { scene: 0, post: 0 };
  }

  // lens: { fovV(deg), focus (m), fstop, focalMM, sensorMM }
  setLens(camera, lens) {
    const f = (lens.focalMM || 50) / 1000;
    const sensor = (lens.sensorMM || 32) / 1000;
    // CoC on the sensor (m) = f^2 |d - df| / (N d (df - f)); in full-res pixels:
    const scale = (f * f) / ((lens.fstop || 4) * Math.max(0.05, lens.focus - f)) / sensor * this.H;
    for (const p of [this.dof, this.final]) {
      p.uniforms.uNear.value = camera.near;
      p.uniforms.uFar.value = camera.far;
      p.uniforms.uFocus.value = lens.focus;
      p.uniforms.uCocScale.value = scale;
      p.uniforms.uMaxCoc.value = lens.maxCoc ?? 22;
    }
    // DOF pass works at half-res: radius in half-res texels = full/2, texel = 2/W
    this.dof.uniforms.uTexel.value.set(1 / this.W, 1 / this.H);
    this.dofEnabled = lens.dof !== false;
  }

  // subframes: array of callbacks (k) => prepares the scene for sub-frame k.
  render({ scene, camera, subframes = 1, prepare, grade = DEFAULT_GRADE, hudTexture = null, overlay = null, time = 0, jitter = true }) {
    const r = this.renderer;
    const t0 = performance.now();
    const halton = (i, b) => { let f = 1, x = 0; while (i > 0) { f /= b; x += f * (i % b); i = Math.floor(i / b); } return x; };
    let src;
    if (subframes <= 1) {
      prepare && prepare(0, 1);
      if (jitter) camera.clearViewOffset();
      r.setRenderTarget(this.sceneRT);
      r.clear();
      r.render(scene, camera);
      src = this.sceneRT.texture;
    } else {
      r.setRenderTarget(this.accumRT);
      r.setClearColor(0x000000, 1);
      r.clear();
      // render the centre sub-frame last so its depth drives the DOF
      const order = [];
      for (let k = 0; k < subframes; k++) order.push(k);
      const mid = Math.floor(subframes / 2);
      order.splice(order.indexOf(mid), 1); order.push(mid);
      for (const k of order) {
        prepare && prepare(k, subframes);
        if (jitter) {
          const jx = halton(k + 1, 2) - 0.5, jy = halton(k + 1, 3) - 0.5;
          camera.setViewOffset(this.W, this.H, jx * 0.9, jy * 0.9, this.W, this.H);
        }
        r.setRenderTarget(this.sceneRT);
        r.clear();
        r.render(scene, camera);
        this.accum.uniforms.tColor.value = this.sceneRT.texture;
        this.accum.uniforms.uWeight.value = 1 / subframes;
        r.setRenderTarget(this.accumRT);
        r.autoClear = false;
        r.render(this.accum.scene, this.quadCam);
        r.autoClear = true;
      }
      if (jitter) camera.clearViewOffset();
      src = this.accumRT.texture;
    }
    const t1 = performance.now();
    // DOF
    if (this.dofEnabled) {
      this.dof.uniforms.tColor.value = src;
      r.setRenderTarget(this.dofRT);
      r.render(this.dof.scene, this.quadCam);
    }
    // bloom
    this.bright.uniforms.tColor.value = src;
    this.bright.uniforms.uThreshold.value = grade.threshold ?? 1.2;
    r.setRenderTarget(this.bloomA); r.render(this.bright.scene, this.quadCam);
    const blurPass = (from, to, dx, dy) => {
      this.blur.uniforms.tColor.value = from.texture;
      this.blur.uniforms.uDir.value.set(dx / from.width, dy / from.height);
      r.setRenderTarget(to); r.render(this.blur.scene, this.quadCam);
    };
    blurPass(this.bloomA, this.bloomB, 1, 0); blurPass(this.bloomB, this.bloomA, 0, 1);
    blurPass(this.bloomA, this.bloomC, 1, 0); blurPass(this.bloomC, this.bloomD, 0, 1);
    blurPass(this.bloomD, this.bloomC, 2, 0); blurPass(this.bloomC, this.bloomD, 0, 2);
    this.final.uniforms.tBloom2.value = this.bloomD.texture;
    // final
    const u = this.final.uniforms;
    u.tColor.value = src;
    u.uDofOn.value = this.dofEnabled ? 1 : 0;
    u.uBloom.value = grade.bloom ?? 0.35;
    u.uExposure.value = grade.exposure ?? 1;
    u.uLift.value.fromArray(grade.lift || [0, 0, 0]);
    u.uGamma.value.fromArray(grade.gamma || [1, 1, 1]);
    u.uGain.value.fromArray(grade.gain || [1, 1, 1]);
    u.uSat.value = grade.sat ?? 1;
    u.uContrast.value = grade.contrast ?? 1;
    u.uVignette.value = grade.vignette ?? 0.35;
    u.uGrain.value = grade.grain ?? 0.03;
    u.uFade.value = grade.fade ?? 1;
    u.uTime.value = time;
    u.uDebug.value = this.debugDepth ? 1 : 0;
    u.tHud.value = hudTexture;
    u.uHudOn.value = hudTexture ? 1 : 0;
    r.setRenderTarget(null);
    r.render(this.final.scene, this.quadCam);
    if (overlay) {
      r.autoClear = false;
      r.render(overlay.scene, overlay.camera);
      r.autoClear = true;
    }
    const t2 = performance.now();
    this.stats.scene = t1 - t0; this.stats.post = t2 - t1;
  }
}
