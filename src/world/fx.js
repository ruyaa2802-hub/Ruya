// Deterministic atmospheric effects (pure functions of time).
import * as THREE from 'three';
import { steamSprite, softSprite } from '../core/textures.js';
import { rng, noise1, clamp, smoothstep } from '../core/util.js';

// Steam wisps rising from a cup. intensity 0..1 (coffee cooling -> 0)
export class Steam {
  constructor(count = 18) {
    this.group = new THREE.Group();
    this.sprites = [];
    const tex = steamSprite();
    const R = rng(42);
    for (let i = 0; i < count; i++) {
      const m = new THREE.SpriteMaterial({ map: tex, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
      const s = new THREE.Sprite(m);
      s.userData = { phase: R(), speed: 0.7 + R() * 0.5, seed: Math.floor(R() * 1000), rot: R() * 6 };
      this.group.add(s);
      this.sprites.push(s);
    }
  }
  update(t, intensity, warm = 1) {
    for (const s of this.sprites) {
      const u = s.userData;
      const life = 2.6 / u.speed;
      const age = ((t / life + u.phase) % 1);
      const h = age * 0.16;
      s.position.set(noise1(t * 0.8 + u.seed, u.seed) * 0.012 * (1 + age * 3), 0.1 + h, noise1(t * 0.7 + u.seed, u.seed + 3) * 0.012 * (1 + age * 3));
      const sc = 0.025 + age * 0.07;
      s.scale.set(sc, sc * 1.4, 1);
      s.material.rotation = u.rot + age * 1.5;
      s.material.opacity = intensity * 0.16 * Math.sin(age * Math.PI) * (1 - age * 0.4);
      s.material.color.setRGB(1, 0.97 * warm + (1 - warm), 0.93 * warm + (1 - warm));
    }
  }
}

// Dust motes floating inside the sun shaft volume
export class Dust {
  constructor(box, count = 160) {
    this.box = box;
    const geo = new THREE.BufferGeometry();
    this.base = new Float32Array(count * 3);
    this.seeds = new Float32Array(count);
    const R = rng(7);
    for (let i = 0; i < count; i++) {
      this.base[i * 3] = box.min.x + R() * (box.max.x - box.min.x);
      this.base[i * 3 + 1] = box.min.y + R() * (box.max.y - box.min.y);
      this.base[i * 3 + 2] = box.min.z + R() * (box.max.z - box.min.z);
      this.seeds[i] = R() * 1000;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    this.mat = new THREE.PointsMaterial({ size: 0.0035, map: softSprite(), transparent: true, opacity: 0.6, depthWrite: false, color: 0xfff1dc, blending: THREE.AdditiveBlending });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
  }
  update(t, intensity) {
    const p = this.points.geometry.attributes.position.array;
    for (let i = 0; i < this.seeds.length; i++) {
      const s = this.seeds[i];
      p[i * 3] = this.base[i * 3] + noise1(t * 0.07 + s, 1) * 0.12;
      p[i * 3 + 1] = this.base[i * 3 + 1] + noise1(t * 0.05 + s, 2) * 0.1 - ((t * 0.01 + s) % 0.2);
      p[i * 3 + 2] = this.base[i * 3 + 2] + noise1(t * 0.06 + s, 3) * 0.12;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.mat.opacity = 0.22 * intensity;
  }
}

// Fake volumetric sun shaft: additive slab with slat stripes, aligned to the sun.
export class Shaft {
  constructor(window, z0, sunDir) {
    const w = window.xb - window.xa, h = window.yb - window.ya;
    const c = document.createElement('canvas'); c.width = 64; c.height = 256;
    const ctx = c.getContext('2d');
    for (let y = 0; y < 256; y++) {
      const slat = (Math.sin((y / 256) * Math.PI * 2 * 30) * 0.5 + 0.5) ** 3;
      ctx.fillStyle = `rgba(255,255,255,${0.15 + 0.85 * slat})`;
      ctx.fillRect(0, y, 64, 1);
    }
    const tex = new THREE.CanvasTexture(c);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { tStripe: { value: tex }, uI: { value: 0.0 }, uColor: { value: new THREE.Color(1, 0.9, 0.75) }, uLen: { value: 3.5 } },
      vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform sampler2D tStripe; uniform float uI; uniform vec3 uColor; varying vec2 vUv; varying vec3 vW;
        void main(){ float s = texture2D(tStripe, vec2(0.5, vUv.y)).a;
          float along = vUv.x; float fade = smoothstep(0.0, 0.08, along) * (1.0 - smoothstep(0.35, 1.0, along));
          float side = smoothstep(0.0, 0.15, vUv.y) * smoothstep(1.0, 0.85, vUv.y);
          gl_FragColor = vec4(uColor * uI * s * fade * side, 1.0); }`,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    this.group = new THREE.Group();
    // a few vertical slabs spanning the window width, extruded along sunDir
    const dir = sunDir.clone().normalize();
    for (let k = 0; k < 5; k++) {
      const x = window.xa + ((k + 0.5) / 5) * w;
      const geo = new THREE.BufferGeometry();
      const len = 2.1;
      const p0 = new THREE.Vector3(x, window.ya, z0), p1 = new THREE.Vector3(x, window.yb, z0);
      const q0 = p0.clone().addScaledVector(dir, len), q1 = p1.clone().addScaledVector(dir, len);
      geo.setAttribute('position', new THREE.Float32BufferAttribute([...p0.toArray(), ...p1.toArray(), ...q0.toArray(), ...q1.toArray()], 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0, 1, 1, 0, 1, 1], 2));
      geo.setIndex([0, 2, 1, 1, 2, 3]);
      const m = new THREE.Mesh(geo, this.mat);
      m.frustumCulled = false;
      m.renderOrder = 5;
      this.group.add(m);
    }
  }
  update(intensity, color) {
    this.mat.uniforms.uI.value = intensity * 0.03;
    if (color) this.mat.uniforms.uColor.value.setRGB(...color);
  }
}

// Water stream from kettle spout into the mug
export class Pour {
  constructor() {
    const mat = new THREE.MeshPhysicalMaterial({ color: 0xd8e6ea, transparent: true, opacity: 0.55, roughness: 0.02, clearcoat: 1, depthWrite: false, envMapIntensity: 2 });
    this.mesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 10, 12, true), mat);
    this.mesh.visible = false;
    this.mesh.frustumCulled = false;
    this.base = this.mesh.geometry.attributes.position.array.slice();
  }
  update(t, from, to, amount) {
    if (amount <= 0.01) { this.mesh.visible = false; return; }
    this.mesh.visible = true;
    const p = this.mesh.geometry.attributes.position;
    const N = p.count;
    for (let i = 0; i < N; i++) {
      const bx = this.base[i * 3], by = this.base[i * 3 + 1] + 0.5, bz = this.base[i * 3 + 2];
      // parabolic arc from spout to cup
      const s = 1 - by;
      const x = from.x + (to.x - from.x) * s;
      const z = from.z + (to.z - from.z) * s;
      const y = from.y + (to.y - from.y) * s + 0.02 * Math.sin(s * Math.PI) - 0.0 * s * s;
      const r = (0.0028 + 0.0012 * s) * amount * (1 + 0.15 * Math.sin(t * 40 + s * 20));
      p.setXYZ(i, x + bx * r, y, z + bz * r);
    }
    p.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
  }
}
