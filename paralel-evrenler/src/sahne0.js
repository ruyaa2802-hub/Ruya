// KARAKTER TASARIMI: "Deniz" — ana kimlik + versiyonlar (turnaround)
import { THREE, Person, assets, skyDome } from './engine.js';
export const FRAMES = 4;
let scene, camera, people = [];

export async function setup({ W, H }) {

  scene = new THREE.Scene(); scene.environment = assets.envTex;
  scene.add(skyDome('#0d0f1a', '#1b1f33', '#07080c'));
  camera = new THREE.PerspectiveCamera(30, W / H, .05, 2000);
  const key = new THREE.DirectionalLight(0xfff1e0, 2.4); key.position.set(2, 3, 3); key.castShadow = true; scene.add(key);
  const rim = new THREE.DirectionalLight(0x7fb0ff, 2.5); rim.position.set(-3, 2.5, -3); scene.add(rim);
  scene.add(new THREE.HemisphereLight(0x9fb4ff, 0x20160f, .6));
  const fl = new THREE.Mesh(new THREE.CircleGeometry(8, 48), new THREE.MeshStandardMaterial({ color: 0x15171f, roughness: .6 })); fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true; scene.add(fl);
  return { scene, camera };
}
const VERS = [
  {}, // ana
  { top: '#2f3a4a', phone: true },
  { top: '#c9b48a', bottom: '#4a4035', backpack: '#7a3b22', hat: '#8a6a45', scarf: '#b4532a' },
  { top: '#cfccc4', bottom: '#2a2d36', coat: '#cfccc4', glasses: true, grey: true },
  { top: '#1c1f26', bottom: '#1c1f26', tie: '#7a1020' },
  { top: '#cfccc6', chefHat: true, bottom: '#2a2a2a' },
];
export function frame(t, f) {
  people.forEach(p => scene.remove(p.root)); people = [];
  if (f < 3) {
    // 3 açı turnaround
    for (let i = 0; i < 3; i++) {
      const p = new Person({}); p.root.position.x = (i - 1) * .75; p.root.rotation.y = [0, Math.PI / 2, Math.PI][i] + (f === 0 ? .25 : 0);
      p.pose({ idle: [1.2, 1] }); scene.add(p.root); people.push(p);
    }
    camera.position.set(f === 2 ? .5 : 0, 1.0 + (f === 2 ? .75 : 0), f === 2 ? 1.1 : 5.2); camera.lookAt(f === 2 ? -0.75 * 0 : 0, f === 2 ? 1.55 : .95, 0);
    if (f === 2) { people.forEach((p, i) => { p.root.rotation.y = [0.35, 0, -.35][i]; p.root.position.x = (i - 1) * .32; }); }
    if (f === 1) people.forEach((p, i) => p.pose({ walk: [i * .3, 1] }));
  } else {
    VERS.forEach((o, i) => { const p = new Person(o); p.root.position.set(((i % 3) - 1) * .8, 0, i < 3 ? 0 : -1.4); p.root.rotation.y = .15; p.pose({ idle: [i * .4, 1] }); scene.add(p.root); people.push(p); });
    camera.position.set(0, 1.4, 6.2); camera.lookAt(0, .9, -.6);
  }
}
