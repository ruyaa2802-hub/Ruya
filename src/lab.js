// Character lab: turntable / close-up stills for checking the model.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Character } from './character/character.js';
import { EXPRESSIONS, faceFromEmotion } from './character/expressions.js';

const q = new URLSearchParams(location.search);
const W = +q.get('w') || 720, H = +q.get('h') || 1280;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x30343a);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.5;
const key = new THREE.DirectionalLight(0xfff1e0, 2.6); key.position.set(1.5, 2.6, 2.2); key.castShadow = true;
key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = key.shadow.camera.bottom = -1.2; key.shadow.camera.right = key.shadow.camera.top = 1.2; key.shadow.bias = -0.0002; key.shadow.normalBias = 0.01;
key.target.position.set(0, 1, 0); scene.add(key, key.target);
const rim = new THREE.DirectionalLight(0xbcd4ff, 1.5); rim.position.set(-1.5, 2, -2); scene.add(rim);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshStandardMaterial({ color: 0x55504a, roughness: 0.8 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

const ch = new Character();
scene.add(ch.group);
const cam = new THREE.PerspectiveCamera(30, W / H, 0.01, 50);
const view = q.get('view') || 'full';
const yaw = (+q.get('yaw') || 0) * Math.PI / 180;
const emo = q.get('emo') || 'neutral';
const sk = ch.sk.restWorld;
const st = {
  rootPos: [0, 0, 0], rootYaw: yaw,
  hips: [0, -0.005, 0], spine: [0.03, 0, 0], chest: [0.02, 0, 0], neck: [0.05, 0, 0], head: [-0.04, 0, 0],
  hands: {}, feet: {}, fingers: { L: { relaxed: 1 }, R: { relaxed: 1 } },
  ...faceFromEmotion(EXPRESSIONS[emo] || {}, 0),
};
for (const L of ['L', 'R']) {
  const s = L === 'L' ? 1 : -1;
  st.hands[L] = { pos: sk['hand.' + L].clone().add(new THREE.Vector3(s * 0.015, 0.03, 0.06)), quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.1, 0, s * 0.08)) };
  st.feet[L] = { pos: sk['foot.' + L].clone().add(new THREE.Vector3(s * 0.01, 0, 0.0)), yaw: s * 0.12 };
}
if (q.get('pose') === 'phone') {
  st.hands.R = { pos: new THREE.Vector3(-0.08, 1.32, 0.28), quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(-1.2, 0.3, -1.4, 'YXZ')) };
  st.fingers.R = { phone: 1 };
}
if (q.get('mouth')) st.morphs = { ...(st.morphs || {}), jawOpen: +q.get('mouth') };
ch.pose(st);
ch.applyFace({ ...st, gaze: null });
const headP = ch.bonePos('head').add(new THREE.Vector3(0, 0.09, 0));
const views = {
  full: [new THREE.Vector3(0, 1.0, 4.6), new THREE.Vector3(0, 0.92, 0)],
  face: [headP.clone().add(new THREE.Vector3(0.0, 0.01, 0.55)), headP],
  face34: [headP.clone().add(new THREE.Vector3(0.32, 0.03, 0.45)), headP],
  side: [headP.clone().add(new THREE.Vector3(0.6, 0.0, 0.0)), headP],
  hands: [new THREE.Vector3(0.0, 1.0, 0.9), new THREE.Vector3(-0.2, 0.9, 0)],
  upper: [new THREE.Vector3(0.5, 1.45, 1.8), new THREE.Vector3(0, 1.35, 0)],
};
const [p, t] = views[view];
cam.position.copy(p); cam.lookAt(t);
st.gaze = cam.position.clone();
ch.pose(st);
renderer.render(scene, cam);
window.__ready = true;
