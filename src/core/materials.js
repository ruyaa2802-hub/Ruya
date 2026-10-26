// Material library: each real-world surface gets its own physical response
// (skin wrap-scatter, hair anisotropy, fabric sheen, glass, metal, glaze...).
import * as THREE from 'three';
import * as T from './textures.js';

// Skin: wrap lighting per channel approximates sub-surface scattering
// (red light bleeds further past the terminator than green/blue).
const SKIN_DIFFUSE = /* glsl */ `
	#ifdef SKIN_SSS
		float ndlS = dot( geometryNormal, directLight.direction );
		vec3 wrapW = vec3( 0.55, 0.28, 0.2 );
		vec3 wrapped = clamp( ( vec3( ndlS ) + wrapW ) / ( 1.0 + wrapW ), 0.0, 1.0 );
		wrapped *= mix( vec3( 1.0 ), vec3( 1.0, 0.82, 0.78 ), smoothstep( 0.35, -0.15, ndlS ) );
		reflectedLight.directDiffuse += wrapped * directLight.color * BRDF_Lambert( material.diffuseColor );
	#else
		reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	#endif
`;
function patchSkin(mat) {
  mat.defines = { ...(mat.defines || {}), SKIN_SSS: '' };
  mat.onBeforeCompile = (shader) => {
    const chunk = THREE.ShaderChunk.lights_physical_pars_fragment.replace(
      'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );',
      SKIN_DIFFUSE,
    );
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_physical_pars_fragment>', chunk);
  };
  mat.customProgramCacheKey = () => 'skin-sss';
  return mat;
}

export function skin({ map = null, color = 0xffffff, roughness = 0.52, bumpScale = 0.6, roughnessMap = null } = {}) {
  const detail = T.skinDetail();
  const m = new THREE.MeshPhysicalMaterial({
    color, map,
    roughness, roughnessMap,
    bumpMap: detail, bumpScale,
    sheen: 0.35, sheenColor: new THREE.Color(0xff9a80), sheenRoughness: 0.5,
    specularIntensity: 0.55,
  });
  return patchSkin(m);
}

export function hair(color = 0x2a1a10) {
  // Lambert on purpose: hair cards overdraw heavily and the software renderer
  // pays every layer (area lights included). The strand texture carries the
  // look; the scalp cap underneath keeps a Standard specular sheen.
  return new THREE.MeshLambertMaterial({ color, map: T.hairStrands(), side: THREE.DoubleSide });
}
export function hairCapMat(color = 0x2a1a10) {
  return new THREE.MeshStandardMaterial({ color, map: T.hairStrands(), roughness: 0.6 });
}

export function fabric({ color, key, sheen = 0.8, sheenColor = null, roughness = 0.88, bump = 'knit', bumpScale = 1.2, repeat = [6, 6], heather = 0.07, hero = false }) {
  const b = bump === 'knit' ? T.knit() : bump === 'rib' ? T.rib() : bump === 'twill' ? T.weave(true) : T.weave(false);
  const bt = b.clone(); bt.repeat.set(repeat[0], repeat[1]); bt.needsUpdate = true;
  const map = T.heather(color, key, heather).clone(); map.repeat.set(repeat[0] / 3, repeat[1] / 3); map.needsUpdate = true;
  const c = new THREE.Color(color);
  if (!hero) return new THREE.MeshStandardMaterial({ color: 0xffffff, map, roughness, bumpMap: bt, bumpScale });
  return new THREE.MeshPhysicalMaterial({
    color: 0xffffff, map,
    roughness, bumpMap: bt, bumpScale,
    sheen, sheenColor: sheenColor ? new THREE.Color(sheenColor) : c.clone().lerp(new THREE.Color(0xffffff), 0.35), sheenRoughness: 0.6,
    specularIntensity: 0.25,
  });
}

export function wood({ tint = 0xffffff, roughness = 1, repeat = [1, 1] } = {}) {
  const w = T.woodPlanks();
  const clone = (t) => { const c = t.clone(); c.repeat.set(repeat[0], repeat[1]); c.needsUpdate = true; return c; };
  return new THREE.MeshStandardMaterial({
    color: tint, map: clone(w.map), roughness: roughness * 0.85, roughnessMap: clone(w.rough),
    bumpMap: clone(w.bump), bumpScale: 0.8,
  });
}

export function paintedWood(color, roughness = 0.55) {
  return new THREE.MeshStandardMaterial({
    color, roughness, roughnessMap: T.noiseMap('paint', 6, 0.85, 1.0),
    bumpMap: T.noiseMap('paintbump', 60, 0.4, 0.6, 2, 256), bumpScale: 0.3,
  });
}

export function plaster(tint = 0xe8e2d8) {
  const p = T.plaster(tint);
  const clone = (t, r) => { const c = t.clone(); c.repeat.set(r, r); c.needsUpdate = true; return c; };
  return new THREE.MeshStandardMaterial({ map: clone(p.map, 1.5), bumpMap: clone(p.bump, 3), bumpScale: 0.6, roughness: 0.92 });
}

export function tiles(tint) {
  const t = T.tiles(tint);
  const clone = (x) => { const c = x.clone(); c.repeat.set(3, 1.5); c.needsUpdate = true; return c; };
  return new THREE.MeshStandardMaterial({
    map: clone(t.map), bumpMap: clone(t.bump), bumpScale: 1.5, roughnessMap: clone(t.rough), roughness: 0.6,
  });
}

export function metal({ color = 0xc8c8c8, roughness = 0.28, brushed = true } = {}) {
  return new THREE.MeshStandardMaterial({
    color, metalness: 1, roughness,
    roughnessMap: brushed ? T.brushed() : null,
  });
}

export function plastic(color, roughness = 0.45) {
  return new THREE.MeshStandardMaterial({
    color, roughness, roughnessMap: T.noiseMap('plastic', 30, 0.85, 1.05, 2),
  });
}

export function ceramic(color, roughness = 0.25) {
  return new THREE.MeshStandardMaterial({
    color, roughness: Math.min(roughness, 0.18),
    bumpMap: T.noiseMap('glaze', 20, 0.45, 0.55, 3), bumpScale: 0.15,
  });
}

// Glass without the cost of a transmission pass: thin, reflective, faintly tinted.
export function glass({ tint = 0xeaf2f2, opacity = 0.16, roughness = 0.03 } = {}) {
  return new THREE.MeshPhysicalMaterial({
    color: tint, roughness, metalness: 0, transparent: true, opacity,
    clearcoat: 1, clearcoatRoughness: 0.02, specularIntensity: 1, ior: 1.5,
    depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.6,
  });
}

export function liquid(color = 0x24130a) {
  return new THREE.MeshPhysicalMaterial({ color, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.02, specularIntensity: 1 });
}

export function cornea() {
  return new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.0, transparent: true, opacity: 0.08,
    clearcoat: 1, clearcoatRoughness: 0.0, specularIntensity: 1.2, envMapIntensity: 2.2, depthWrite: false,
  });
}
