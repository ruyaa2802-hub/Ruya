// Ortak sürreal öğeler: yüzen şehir adaları, kapılar, zaman çizgileri, kırık gerçeklik parçaları
import { THREE, rng, cityBlock, windowTexture, assets } from './engine.js';

export function island({ seed = 1, r = 6, warm = true, city = true, flip = false, glow = '#ffb070' } = {}) {
  const g = new THREE.Group(); const R = rng(seed);
  const geo = new THREE.ConeGeometry(r, r * 1.8, 9, 5, false); geo.rotateX(Math.PI); geo.translate(0, -r * .9, 0);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y < -.01) { const k = 1 + (R() - .5) * .45; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); p.setY(i, y * (1 + (R() - .5) * .3)); } }
  geo.computeVertexNormals();
  const rock = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: warm ? 0x3a2a24 : 0x22283a, roughness: .95, flatShading: true }));
  g.add(rock);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(r, r * .98, .3, 9), new THREE.MeshStandardMaterial({ color: warm ? 0x2c3324 : 0x1c2230, roughness: .9, flatShading: true })); top.position.y = -.15; g.add(top);
  if (city) {
    const c = cityBlock({ seed: seed + 5, count: Math.round(r * 3), area: r * 1.2, hmin: r * .3, hmax: r * 2.4, warm, avoid: 0, emissive: 1.8 });
    c.children.forEach(b => { if (Math.hypot(b.position.x, b.position.z) > r * .8) b.visible = false; });
    g.add(c);
  }
  // alttan sarkan ışık / kökler
  const l = new THREE.PointLight(glow, 3, r * 6, 1.5); l.position.y = r * .5; g.add(l);
  if (flip) g.rotation.z = Math.PI;
  return g;
}

// Kapı çerçevesi (ince, gerçeküstü). w,h metre
export function doorFrame(w = 1.4, h = 2.6, color = '#e9d9b8', glow = 0) {
  const g = new THREE.Group(); const t = .08, d = .14;
  const m = new THREE.MeshStandardMaterial({ color, roughness: .35, metalness: .6, emissive: new THREE.Color(color), emissiveIntensity: glow });
  const parts = [[t, h + t, 0, -w / 2 - t / 2, h / 2], [t, h + t, 0, w / 2 + t / 2, h / 2], [w + 2 * t, t, 0, 0, h + t / 2], [w + 2 * t, t, 0, 0, -t / 2]];
  for (const [a, b, , x, y] of parts) { const box = new THREE.Mesh(new THREE.BoxGeometry(a, b, d), m); box.position.set(x, y, 0); box.castShadow = true; g.add(box); }
  g.userData.mat = m;
  return g;
}

// Zaman çizgisi: parlayan, akan tüp
export function timeline(points, color = '#7fd4ff', radius = .04, seed = 1) {
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, 240, radius, 6, false);
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uT: { value: 0 }, uC: { value: new THREE.Color(color) }, uSeed: { value: seed } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform float uT,uSeed; uniform vec3 uC; varying vec2 vUv;
      void main(){ float x=vUv.x*40.-uT*3.+uSeed*7.; float p=pow(.5+.5*sin(x),6.)+.25; float edge=1.-abs(vUv.y-.5)*2.;
        gl_FragColor=vec4(uC*p*1.4, p*(.4+.4*edge)); }`,
  });
  const mesh = new THREE.Mesh(geo, m); mesh.userData.curve = curve; return mesh;
}

// Kırık gerçeklik parçası: içinde başka bir dünyanın rengini taşıyan cam üçgen
export function shards(n, spread, seed = 4, tint = ['#9fd8ff', '#ffc38a', '#ff8fd0']) {
  const R = rng(seed); const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const s = .3 + R() * 1.6;
    const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.lineTo(s * (R() + .3), s * (R() * .4)); shape.lineTo(s * (R() * .6), s * (.6 + R() * .8)); shape.closePath();
    const geo = new THREE.ShapeGeometry(shape);
    const c = new THREE.Color(tint[i % tint.length]);
    const m = new THREE.MeshPhysicalMaterial({ color: c, emissive: c, emissiveIntensity: .25 + R() * .5, roughness: .05, metalness: .2, transmission: 0, transparent: true, opacity: .55, side: THREE.DoubleSide, envMapIntensity: 2 });
    const me = new THREE.Mesh(geo, m);
    me.position.set((R() - .5) * spread[0], (R() - .5) * spread[1], (R() - .5) * spread[2]);
    me.rotation.set(R() * 6, R() * 6, R() * 6); me.userData.spin = new THREE.Vector3(R() - .5, R() - .5, R() - .5);
    g.add(me);
  }
  return g;
}

// İnsan silüeti dokusu (uzak kapılarda "binlerce versiyon" için) — karakterin gerçek modelinden render edilir
export function silhouetteAtlas(renderer, Person, poses) {
  const N = poses.length, S = 256;
  const rt = new THREE.WebGLRenderTarget(S * N, S * 2);
  const sc = new THREE.Scene(); const cam = new THREE.OrthographicCamera(-.6, .6, 2.0, -.4, .1, 10); cam.position.set(0, 0, 5);
  sc.add(new THREE.AmbientLight(0xffffff, 3));
  renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear();
  poses.forEach((ps, i) => {
    const p = new Person(ps.opts || {}); p.pose(ps.pose); if (ps.rotY) p.root.rotation.y = ps.rotY;
    p.model.traverse(o => { if (o.isMesh) { o.material = new THREE.MeshBasicMaterial({ color: 0xffffff }); } });
    sc.add(p.root);
    renderer.setViewport(i * S, 0, S, S * 2); renderer.setScissor(i * S, 0, S, S * 2); renderer.setScissorTest(true);
    renderer.render(sc, cam); sc.remove(p.root);
  });
  renderer.setScissorTest(false); renderer.setRenderTarget(null); renderer.setClearColor(0x000000, 1);
  return { texture: rt.texture, count: N };
}
