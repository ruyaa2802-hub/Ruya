// Film engine: owns the world, evaluates an episode at a film time through
// its edit decision list (EDL) and renders frames.
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { FilmRenderer, DEFAULT_GRADE } from '../core/renderer.js';
import { Character } from '../character/character.js';
import { buildApartment, buildLights, applyLightState, LIGHT_STATES, ROOM } from '../world/apartment.js';
import * as P from '../world/props.js';
import { PhoneUI } from '../world/phoneui.js';
import { Steam, Dust, Shaft, Pour } from '../world/fx.js';
import { Hud } from './hud.js';
import { clamp, fbm1, DEG } from '../core/util.js';

export class Film {
  constructor({ width = 1080, height = 1920, pixelRatio = 1, canvas, episode }) {
    RectAreaLightUniformsLib.init();
    this.fr = new FilmRenderer({ width, height, pixelRatio, canvas });
    this.width = width; this.height = height;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b0d10);
    this.world = new THREE.Group();
    this.scene.add(this.world);
    this.set = buildApartment();
    this.world.add(this.set);
    this.lights = buildLights(this.world, this.set);
    this.char = new Character();
    this.scene.add(this.char.group);
    // props
    this.phoneUI = new PhoneUI();
    this.phone = P.phone(this.phoneUI.canvas);
    this.mug = P.mug({ fill: 0 });
    this.kettle = this.set.getObjectByName('kettle');
    this.scene.add(this.phone, this.mug);
    this.steam = new Steam();
    this.mug.add(this.steam.group);
    this.pour = new Pour();
    this.scene.add(this.pour.mesh);
    const sunDir = this.lights.sun.target.position.clone().sub(this.lights.sun.position).normalize();
    this.shaft = new Shaft(this.set.userData.window, ROOM.z0 + 0.03, sunDir);
    this.scene.add(this.shaft.group);
    this.dust = new Dust(new THREE.Box3(new THREE.Vector3(-2.1, 0.5, -2.0), new THREE.Vector3(-0.6, 2.2, 0.2)));
    this.scene.add(this.dust.points);
    this.camera = new THREE.PerspectiveCamera(40, width / height, 0.03, 40);
    // soft fill carried with the camera (like a bounce board on set)
    this.fill = new THREE.RectAreaLight(0xfff0e2, 0, 0.9, 0.9);
    this.scene.add(this.fill);
    this.hud = new Hud(width * pixelRatio, height * pixelRatio);
    this.episode = episode(this);
    this.duration = this.episode.duration;
    this.captureEnvironments();
  }

  // Environment maps captured from the actual room under each light state
  // (gives correct reflections and an ambient bounce approximation).
  captureEnvironments() {
    const pm = new THREE.PMREMGenerator(this.fr.renderer);
    this.envs = {};
    const centre = new THREE.Vector3(0, 1.3, -0.2);
    this.char.group.visible = false; this.phone.visible = false; this.mug.visible = false;
    this.shaft.group.visible = false; this.dust.points.visible = false;
    this.world.position.copy(centre).negate();
    this.world.updateMatrixWorld(true);
    for (const [name, st] of Object.entries(LIGHT_STATES)) {
      applyLightState(this.lights, this.scene, { ...st, env: 0 });
      this.scene.environment = null;
      const rt = pm.fromScene(this.scene, 0.03, 0.05, 20);
      this.envs[name] = rt.texture;
    }
    this.world.position.set(0, 0, 0);
    this.world.updateMatrixWorld(true);
    this.char.group.visible = true; this.phone.visible = true; this.mug.visible = true;
    this.shaft.group.visible = true; this.dust.points.visible = true;
    pm.dispose();
  }

  shotAt(F) {
    const shots = this.episode.shots;
    for (const s of shots) if (F >= s.film[0] && F < s.film[1]) return s;
    return shots[shots.length - 1];
  }
  perfTime(F, shot = this.shotAt(F)) {
    return shot.perf + (Math.min(F, shot.film[1]) - shot.film[0]) * (shot.speed || 1);
  }

  // Evaluate everything for a film time (no rendering)
  evaluate(F, { hud = true } = {}) {
    const shot = this.shotAt(F);
    const Pt = this.perfTime(F, shot);
    const ev = this.episode.evaluate(Pt, shot);
    // lights + environment
    applyLightState(this.lights, this.scene, ev.light);
    this.scene.environment = this.envs[ev.envName] || this.envs.morning;
    this.shaft.update(ev.shaft ?? clamp(ev.light.sun / 4), ev.light.sunColor);
    this.dust.update(Pt, clamp(ev.light.sun / 3));
    // phone screen + its light
    const info = this.phoneUI.draw(ev.phoneUI);
    this.phone.userData.screenTex.needsUpdate = true;
    const pl = this.phone.userData.light;
    pl.intensity = this.phone.visible ? info.lum * (ev.phoneLight ?? 1) * 10 : 0;
    pl.color.setRGB(...info.color);
    this.phone.userData.screenMat.emissiveIntensity = 0.62;
    // fx
    this.steam.update(Pt, ev.steam ?? 0);
    if (ev.pour) this.pour.update(Pt, ev.pour.from, ev.pour.to, ev.pour.amount); else this.pour.update(Pt, null, null, 0);
    // camera
    const local = F - shot.film[0];
    const cam = shot.cam(this.episode.ctx, local, Pt, shot);
    this.applyCamera(cam, Pt, shot);
    if (hud) {
      this.hud.draw({ subtitle: ev.subtitle, cards: ev.cards, title: this.episode.titleAt ? this.episode.titleAt(F) : null, camera: this.camera });
    }
    return { shot, Pt, ev, cam };
  }

  applyCamera(cam, Pt, shot) {
    const c = this.camera;
    const sensor = 32; // vertical sensor (mm), 9:16 frame
    const fov = 2 * Math.atan(sensor / (2 * cam.focal)) / DEG;
    c.fov = fov; c.aspect = this.width / this.height;
    const pos = cam.pos.clone(), tgt = cam.target.clone();
    // handheld: low-frequency drift + subtle breathing of the operator
    const hh = cam.handheld ?? 0.3;
    if (hh > 0) {
      const sd = shot.seed || 1;
      pos.x += fbm1(Pt * 0.9, sd) * 0.006 * hh; pos.y += fbm1(Pt * 0.8, sd + 5) * 0.005 * hh;
      tgt.x += fbm1(Pt * 1.1, sd + 9) * 0.008 * hh; tgt.y += fbm1(Pt * 1.0, sd + 13) * 0.006 * hh;
    }
    c.position.copy(pos);
    c.up.set(0, 1, 0);
    const fl = cam.fill || { i: 2.2, off: [0.45, 0.3, 0] };
    const fwdC = tgt.clone().sub(pos).normalize();
    const rightC = new THREE.Vector3().crossVectors(fwdC, new THREE.Vector3(0, 1, 0)).normalize();
    this.fill.position.copy(pos).addScaledVector(rightC, fl.off[0]).add(new THREE.Vector3(0, fl.off[1], 0)).addScaledVector(fwdC, fl.off[2]);
    this.fill.lookAt(cam.focusPoint || tgt);
    this.fill.intensity = fl.i * (this.episodeFill ?? 1);
    if (fl.color) this.fill.color.setRGB(...fl.color);
    c.lookAt(tgt);
    if (cam.roll) c.rotateZ(cam.roll);
    c.updateProjectionMatrix();
    c.updateMatrixWorld();
    const focus = cam.focusPoint ? cam.focusPoint.distanceTo(pos) : cam.focus ?? pos.distanceTo(tgt);
    this.fr.setLens(c, { focalMM: cam.focal, fstop: cam.fstop ?? 2.8, focus, sensorMM: sensor, maxCoc: cam.maxCoc ?? 22, dof: cam.dof !== false });
    this.lastCam = cam;
  }

  render(F, { subframes = 1, shutter = 0.5, fps = 24, debugDof = null } = {}) {
    const center = this.evaluate(F);
    if (debugDof === 'off') this.fr.dofEnabled = false;
    this.fr.debugDepth = debugDof === 'depth';
    const shot = center.shot;
    const grade = { ...DEFAULT_GRADE, ...(center.ev.grade || {}) };
    const hudTex = this.hud.texture;
    const prepare = subframes > 1 ? (k, n) => {
      // spread sub-frames over the shutter interval, clamped to the shot
      const off = ((k + 0.5) / n - 0.5) * (shutter / fps);
      const f = Math.min(Math.max(F + off, shot.film[0]), shot.film[1] - 1e-4);
      this.evaluate(f, { hud: false });
    } : null;
    this.fr.render({ scene: this.scene, camera: this.camera, subframes, prepare, grade, hudTexture: hudTex, time: F });
    // restore centre state (camera/lens) for any later queries
    if (subframes > 1) this.evaluate(F, { hud: false });
    return center;
  }
}
