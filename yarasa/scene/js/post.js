import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Post pipeline: per-layer depth of field → layer mix (crossfade / whip-pan
// motion blur / light flash) → bloom → ACES tone mapping, vignette, grain.
// ---------------------------------------------------------------------------

const VS = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const DOF_FS = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D tColor, tDepth;
  uniform vec2 res;
  uniform float cnear, cfar, focus, aperture, maxBlur;
  float lin(float d){ float z = d * 2.0 - 1.0; return 2.0 * cnear * cfar / (cfar + cnear - z * (cfar - cnear)); }
  float coc(float z){ return clamp(aperture * abs(z - focus) / max(z, 0.001), 0.0, maxBlur); }
  void main(){
    vec3 c0 = texture2D(tColor, vUv).rgb;
    float zc = lin(texture2D(tDepth, vUv).x);
    float cc = coc(zc);
    if (cc < 0.6) { gl_FragColor = vec4(c0, 1.0); return; }
    vec3 acc = c0; float ws = 1.0;
    const int N = 40;
    for (int i = 0; i < N; i++) {
      float r = sqrt((float(i) + 0.5) / float(N));
      float a = float(i) * 2.39996323;
      vec2 off = vec2(cos(a), sin(a)) * r * cc;
      vec2 suv = vUv + off / res;
      float zs = lin(texture2D(tDepth, suv).x);
      float w = 1.0;
      if (zs < zc - 0.05) w = clamp(coc(zs) - r * cc + 1.0, 0.0, 1.0); // sharper foreground must not smear into blurred background
      acc += texture2D(tColor, suv).rgb * w;
      ws += w;
    }
    gl_FragColor = vec4(acc / ws, 1.0);
  }`;

const MIX_FS = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D tA, tB;
  uniform float mixv, flash;
  uniform vec3 flashColor;
  uniform vec2 motion, res;
  vec3 samp(sampler2D t){
    if (length(motion) < 0.5) return texture2D(t, vUv).rgb;
    vec3 a = vec3(0.0);
    for (int i = 0; i < 20; i++) { float k = float(i) / 19.0 - 0.5; a += texture2D(t, vUv + motion * k / res).rgb; }
    return a / 20.0;
  }
  void main(){
    vec3 c = samp(tA);
    if (mixv > 0.001) c = mix(c, samp(tB), mixv);
    c = mix(c, flashColor, flash);
    gl_FragColor = vec4(c, 1.0);
  }`;

const BRIGHT_FS = /* glsl */ `
  precision highp float;
  varying vec2 vUv; uniform sampler2D tIn; uniform vec2 texel; uniform float threshold;
  void main(){
    vec3 c = vec3(0.0);
    c += texture2D(tIn, vUv + texel * vec2(-1.0,-1.0)).rgb;
    c += texture2D(tIn, vUv + texel * vec2( 1.0,-1.0)).rgb;
    c += texture2D(tIn, vUv + texel * vec2(-1.0, 1.0)).rgb;
    c += texture2D(tIn, vUv + texel * vec2( 1.0, 1.0)).rgb;
    c *= 0.25;
    float l = max(max(c.r, c.g), c.b);
    gl_FragColor = vec4(c * smoothstep(threshold, threshold + 1.0, l), 1.0);
  }`;

const BLUR_FS = /* glsl */ `
  precision highp float;
  varying vec2 vUv; uniform sampler2D tIn; uniform vec2 dir;
  void main(){
    vec3 c = texture2D(tIn, vUv).rgb * 0.2270270270;
    c += texture2D(tIn, vUv + dir * 1.3846153846).rgb * 0.3162162162;
    c += texture2D(tIn, vUv - dir * 1.3846153846).rgb * 0.3162162162;
    c += texture2D(tIn, vUv + dir * 3.2307692308).rgb * 0.0702702703;
    c += texture2D(tIn, vUv - dir * 3.2307692308).rgb * 0.0702702703;
    gl_FragColor = vec4(c, 1.0);
  }`;

const FINAL_FS = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D tIn, tBloom;
  uniform float exposure, bloom, vignette, fade, grain, frame, saturation;
  uniform vec3 lift, gain;
  vec3 RRTAndODTFit(vec3 v){ vec3 a = v*(v+0.0245786)-0.000090537; vec3 b = v*(0.983729*v+0.4329510)+0.238081; return a/b; }
  vec3 aces(vec3 c){
    const mat3 I = mat3(vec3(0.59719,0.07600,0.02840), vec3(0.35458,0.90834,0.13383), vec3(0.04823,0.01566,0.83777));
    const mat3 O = mat3(vec3(1.60475,-0.10208,-0.00327), vec3(-0.53108,1.10813,-0.07276), vec3(-0.07367,-0.00605,1.07602));
    c = I * (c / 0.6); c = RRTAndODTFit(c); c = O * c; return clamp(c, 0.0, 1.0);
  }
  vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
  float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + frame * 0.618) * 43758.5453); }
  void main(){
    vec3 c = texture2D(tIn, vUv).rgb + texture2D(tBloom, vUv).rgb * bloom;
    c *= exposure;
    vec2 q = vUv - 0.5; q.x *= 1.25;
    c *= mix(1.0, smoothstep(0.95, 0.2, length(q)), vignette);
    c = aces(c);
    float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = max(mix(vec3(luma), c, saturation), 0.0);
    c = c * gain + lift * (1.0 - c);
    c = toSRGB(c);
    c += (hash(vUv * 1000.0) - 0.5) * grain;
    c *= 1.0 - fade;
    gl_FragColor = vec4(c, 1.0);
  }`;

export class Post {
  constructor(renderer, W, H) {
    this.r = renderer;
    this.W = W;
    this.H = H;
    const hf = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    this.scene = [0, 1].map(() => {
      const rt = new THREE.WebGLRenderTarget(W, H, { ...hf, samples: 4 });
      rt.depthTexture = new THREE.DepthTexture(W, H);
      rt.depthTexture.type = THREE.FloatType;
      return rt;
    });
    this.dof = [0, 1].map(() => new THREE.WebGLRenderTarget(W, H, hf));
    this.mixRT = new THREE.WebGLRenderTarget(W, H, hf);
    const bw = W / 4, bh = H / 4;
    this.b1 = new THREE.WebGLRenderTarget(bw, bh, hf);
    this.b2 = new THREE.WebGLRenderTarget(bw, bh, hf);
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.qs = new THREE.Scene();
    this.qs.add(this.quad);
    const mat = (fs, uniforms) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false });
    this.dofMat = mat(DOF_FS, {
      tColor: { value: null }, tDepth: { value: null }, res: { value: new THREE.Vector2(W, H) },
      cnear: { value: 0.1 }, cfar: { value: 100 }, focus: { value: 5 }, aperture: { value: 0 }, maxBlur: { value: 12 },
    });
    this.mixMat = mat(MIX_FS, {
      tA: { value: null }, tB: { value: null }, mixv: { value: 0 }, flash: { value: 0 },
      flashColor: { value: new THREE.Color(4, 3.3, 2.4) }, motion: { value: new THREE.Vector2() }, res: { value: new THREE.Vector2(W, H) },
    });
    this.brightMat = mat(BRIGHT_FS, { tIn: { value: null }, texel: { value: new THREE.Vector2(1 / W, 1 / H) }, threshold: { value: 1.0 } });
    this.blurMat = mat(BLUR_FS, { tIn: { value: null }, dir: { value: new THREE.Vector2() } });
    this.finalMat = mat(FINAL_FS, {
      tIn: { value: null }, tBloom: { value: null }, exposure: { value: 1 }, bloom: { value: 0.6 }, vignette: { value: 0.55 },
      fade: { value: 0 }, grain: { value: 0.018 }, frame: { value: 0 }, saturation: { value: 1.15 },
      lift: { value: new THREE.Vector3(0.012, 0.008, 0.02) }, gain: { value: new THREE.Vector3(1.0, 0.985, 0.95) },
    });
  }

  pass(material, target) {
    this.quad.material = material;
    this.r.setRenderTarget(target);
    this.r.render(this.qs, this.cam);
  }

  renderLayer(i, scene, camera, { focus = 5, aperture = 0, maxBlur = 12 } = {}) {
    const r = this.r;
    r.setRenderTarget(this.scene[i]);
    r.clear();
    r.render(scene, camera);
    const u = this.dofMat.uniforms;
    u.tColor.value = this.scene[i].texture;
    u.tDepth.value = this.scene[i].depthTexture;
    u.cnear.value = camera.near;
    u.cfar.value = camera.far;
    u.focus.value = focus;
    u.aperture.value = aperture;
    u.maxBlur.value = maxBlur;
    this.pass(this.dofMat, this.dof[i]);
  }

  composite({ mix = 0, flash = 0, motion = [0, 0], exposure = 1, bloom = 0.6, vignette = 0.55, fade = 0, frame = 0, threshold = 1.0 } = {}) {
    const m = this.mixMat.uniforms;
    m.tA.value = this.dof[0].texture;
    m.tB.value = this.dof[1].texture;
    m.mixv.value = mix;
    m.flash.value = flash;
    m.motion.value.set(motion[0], motion[1]);
    this.pass(this.mixMat, this.mixRT);
    this.brightMat.uniforms.tIn.value = this.mixRT.texture;
    this.brightMat.uniforms.threshold.value = threshold;
    this.pass(this.brightMat, this.b1);
    for (let k = 0; k < 2; k++) {
      const s = k + 1;
      this.blurMat.uniforms.tIn.value = this.b1.texture;
      this.blurMat.uniforms.dir.value.set((4 * s) / this.W, 0);
      this.pass(this.blurMat, this.b2);
      this.blurMat.uniforms.tIn.value = this.b2.texture;
      this.blurMat.uniforms.dir.value.set(0, (4 * s) / this.H);
      this.pass(this.blurMat, this.b1);
    }
    const f = this.finalMat.uniforms;
    f.tIn.value = this.mixRT.texture;
    f.tBloom.value = this.b1.texture;
    f.exposure.value = exposure;
    f.bloom.value = bloom;
    f.vignette.value = vignette;
    f.fade.value = fade;
    f.frame.value = frame;
    this.pass(this.finalMat, null);
  }
}
