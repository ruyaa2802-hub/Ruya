// BÖLÜM 1 — "Maaşım yattı, nereye gitti?"
// The performance is authored continuously in PERFORMANCE time (P) in two
// blocks (A: bed -> counter, B: table). The EDL at the bottom "shoots" ranges
// of that performance with different cameras, which creates natural ellipses
// between shots (walk -> already seated) exactly like film editing.
import * as THREE from 'three';
import { BlendTrack, mat, basisMat, lerpMat, lookMat, matBlend, makeWalk, blinkSchedule, blinkAt, saccade, breathPhase } from '../../src/film/performance.js';
import { EXPRESSIONS, blendExpr } from '../../src/character/expressions.js';
import { buildLine, visemesAt } from '../../src/character/lipsync.js';
import { LIGHT_STATES, blendLightState, SPOTS } from '../../src/world/apartment.js';
import { calcKeyLocal, fmtTL } from '../../src/world/phoneui.js';
import { PHONE } from '../../src/world/props.js';
import { clamp, lerp, ease, smoothstep, envelope, noise1, DEG } from '../../src/core/util.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const Q = (x, y, z, o = 'YXZ') => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, o));
const pulse = (t, a, b, r = 0.15) => smoothstep(a - r, a, t) * (1 - smoothstep(b, b + r, t));

// ---------------- grips: held object's frame expressed in the hand frame ----
// hand rest frame: fingers -Y, thumb +Z, palm normal +X (right) / -X (left)
const GRIP = {
  phoneViewR: basisMat(V(0.021, -0.07, 0.03), V(0, 1, 0), V(0, 0, 1)),
  phoneViewL: basisMat(V(-0.021, -0.07, 0.03), V(0, -1, 0), V(0, 0, 1)),
  phoneTopR: basisMat(V(0.026, -0.072, 0.0), V(0, 0, -1), V(0, -1, 0)),
  mugR: basisMat(V(0.08, -0.07, -0.05), V(-1, 0, 0), V(0, 0, 1)),
  mugL: basisMat(V(-0.064, -0.05, -0.05), V(-1, 0, 0), V(0, 0, 1)),
  kettleR: basisMat(V(0.126, -0.072, -0.125), V(1, 0, 0), V(0, 0, 1)),
};
const inv = (m) => m.clone().invert();
const handFrom = (objWorld, grip) => objWorld.clone().multiply(inv(grip));

// ---------------- key places ----------------
const B = V(-1.78, 0, -0.58); // bed sitting root
const C = SPOTS.counterStand.clone(); // counter standing root (yaw PI)
const T = V(1.1, 0, -0.32); // table chair root

// base body poses (root-local)
const SEAT_BED = {
  hips: [0, -0.42, -0.26], hipsRot: [-0.08, 0, 0], spine: [0.14, 0, 0], chest: [0.16, 0, 0], neck: [0.08, 0, 0], head: [0.06, 0, 0],
  feet: { L: { pos: [0.13, 0.085, 0.2], yaw: 0.15 }, R: { pos: [-0.14, 0.085, 0.17], yaw: -0.12 } },
};
const LEAN_REACH = { ...SEAT_BED, hips: [-0.03, -0.42, -0.24], spine: [0.22, -0.25, -0.12], chest: [0.12, -0.25, -0.1], neck: [0.05, -0.2, 0], head: [0.1, -0.3, 0] };
const RISE_MID = { ...SEAT_BED, hips: [0, -0.26, -0.05], hipsRot: [0.15, 0, 0], spine: [0.38, 0, 0], chest: [0.2, 0, 0], neck: [0, 0, 0], head: [-0.15, 0, 0] };
const STAND_BED = { ...SEAT_BED, hips: [0, -0.01, 0.17], hipsRot: [0, 0, 0], spine: [0.03, 0, 0], chest: [0.02, 0, 0], neck: [0.04, 0, 0], head: [0.0, 0, 0],
  feet: { L: { pos: [0.11, 0.085, 0.2], yaw: 0.12 }, R: { pos: [-0.12, 0.085, 0.17], yaw: -0.1 } } };
const STAND = {
  hips: [0, -0.01, 0], hipsRot: [0, 0, 0], spine: [0.04, 0, 0], chest: [0.03, 0, 0], neck: [0.05, 0, 0], head: [0.0, 0, 0],
  feet: { L: { pos: [0.11, 0.085, 0.02], yaw: 0.12 }, R: { pos: [-0.12, 0.085, 0.0], yaw: -0.1 } },
};
const POUR_POSE = { ...STAND, spine: [0.1, 0.12, 0], chest: [0.08, 0.1, 0], neck: [0.1, 0, 0], head: [0.25, 0.1, 0] };
const SEAT_TABLE = {
  hips: [0, -0.445, -0.02], hipsRot: [-0.04, 0, 0], spine: [0.1, 0, 0], chest: [0.1, 0, 0], neck: [0.06, 0, 0], head: [0.02, 0, 0],
  feet: { L: { pos: [0.14, 0.085, 0.43], yaw: 0.12 }, R: { pos: [-0.15, 0.085, 0.4], yaw: -0.1 } },
};
const TABLE_LEAN_IN = { ...SEAT_TABLE, spine: [0.2, 0, 0], chest: [0.16, 0, 0], neck: [0.14, 0, 0], head: [0.05, 0, 0] };
const TABLE_TENSE = { ...SEAT_TABLE, spine: [0.22, 0, 0], chest: [0.2, 0, 0], neck: [0.1, 0, 0], head: [0.08, 0, 0] };
const TABLE_BACK = { ...SEAT_TABLE, hips: [0, -0.45, -0.05], hipsRot: [-0.2, 0, 0], spine: [-0.1, 0, 0], chest: [-0.12, 0, 0], neck: [-0.05, 0, 0], head: [-0.28, 0, 0.05],
  feet: { L: { pos: [0.16, 0.085, 0.5], yaw: 0.2 }, R: { pos: [-0.17, 0.085, 0.47], yaw: -0.2 } } };
const TABLE_SLUMP = { ...SEAT_TABLE, spine: [0.18, 0, 0], chest: [0.24, 0, 0], neck: [0.12, 0, 0], head: [0.12, 0, 0] };

export default function episode(film) {
  const { char, phone, mug, kettle } = film;
  const ctx = { film, char };

  // ---------------- base body track (root + pose) ----------------
  const walk = makeWalk({ t0: 7.95, points: [[B.x, B.z + 0.17], [-1.1, -0.18], [0.1, -0.52], [C.x, C.z - 0.0]], speed: 1.3 });
  const walkYawEnd = walk.at(walk.end).yaw;
  const bodyKeys = new BlendTrack([
    [0, { root: [B.x, 0, B.z], yaw: 0, ...SEAT_BED }, 0],
    [1.55, { root: [B.x, 0, B.z], yaw: 0, ...LEAN_REACH }, 0.7, 'inOut'],
    [2.6, { root: [B.x, 0, B.z], yaw: 0, ...SEAT_BED, spine: [0.1, 0, 0], chest: [0.12, 0, 0] }, 0.8, 'inOut'],
    [6.75, { root: [B.x, 0, B.z], yaw: 0, ...RISE_MID }, 0.45, 'inQuad'],
    [7.2, { root: [B.x, 0, B.z], yaw: 0, ...STAND_BED }, 0.6, 'outQuad'],
    // block B
    [19.0, { root: [T.x, 0, T.z], yaw: 0, ...SEAT_TABLE }, 0],
    [20.4, { root: [T.x, 0, T.z], yaw: 0, ...SEAT_TABLE, neck: [0.0, 0, 0], head: [-0.12, 0, 0] }, 0.5],
    [21.6, { root: [T.x, 0, T.z], yaw: 0, ...SEAT_TABLE }, 0.6],
    [23.05, { root: [T.x, 0, T.z], yaw: 0, ...SEAT_TABLE, neck: [0.2, 0, 0], head: [0.15, 0, 0] }, 0.35],
    [24.9, { root: [T.x, 0, T.z], yaw: 0, ...SEAT_TABLE }, 0.5],
    [26.4, { root: [T.x, 0, T.z], yaw: 0, ...TABLE_LEAN_IN }, 1.2],
    [31.0, { root: [T.x, 0, T.z], yaw: 0, ...TABLE_TENSE }, 1.0],
    [40.25, { root: [T.x, 0, T.z], yaw: 0, ...TABLE_BACK }, 1.1, 'inOut'],
    [42.3, { root: [T.x, 0, T.z], yaw: 0, ...TABLE_SLUMP }, 1.0],
    [44.4, { root: [T.x, 0, T.z], yaw: 0, ...SEAT_TABLE, spine: [0.14, 0, 0] }, 0.8],
    [46.6, { root: [T.x, 0, T.z], yaw: 0, ...SEAT_TABLE, spine: [0.08, 0, 0], neck: [0.0, 0, 0] }, 0.12],
    [48.0, { root: [T.x, 0, T.z], yaw: 0, ...TABLE_SLUMP }, 1.4],
    [50.9, { root: [T.x, 0, T.z], yaw: 0, ...SEAT_TABLE, spine: [0.08, 0, 0], chest: [0.08, 0, 0], neck: [-0.04, 0, 0], head: [-0.12, 0, 0.0] }, 0.8],
  ]);
  function basePose(t) {
    if (t >= walk.t0 && t < 19) {
      const w = walk.at(t);
      const yaw = t <= walk.end ? w.yaw : lerp(walkYawEnd, Math.PI, ease.inOut(clamp((t - walk.end) / 0.55)));
      const settle = clamp((t - walk.end) / 0.55);
      const root = V(w.root[0], 0, w.root[2]);
      const toLocal = (wp, wyaw) => {
        const d = wp.clone().sub(root).applyAxisAngle(V(0, 1, 0), -yaw);
        return { pos: [d.x, d.y, d.z], yaw: wyaw - yaw, pitch: 0 };
      };
      let feet = { L: toLocal(w.feet.L.pos, w.feet.L.yaw), R: toLocal(w.feet.R.pos, w.feet.R.yaw) };
      feet.L.pitch = w.feet.L.pitch; feet.R.pitch = w.feet.R.pitch;
      if (settle > 0) {
        // small pivot step into the counter stance
        const lift = Math.sin(settle * Math.PI) * 0.03;
        feet = {
          L: { pos: [lerp(feet.L.pos[0], STAND.feet.L.pos[0], settle), 0.085 + lift * (settle < 0.5 ? 1 : 0), lerp(feet.L.pos[2], STAND.feet.L.pos[2], settle)], yaw: lerp(feet.L.yaw, STAND.feet.L.yaw, settle) },
          R: { pos: [lerp(feet.R.pos[0], STAND.feet.R.pos[0], settle), 0.085 + lift * (settle >= 0.5 ? 1 : 0), lerp(feet.R.pos[2], STAND.feet.R.pos[2], settle)], yaw: lerp(feet.R.yaw, STAND.feet.R.yaw, settle) },
        };
      }
      let pose = { root: w.root, yaw, hips: w.hips, hipsRot: w.hipsRot, spine: w.spine, chest: w.chest, neck: [0.05, -w.swing * 0.03, 0], head: [0.02, 0, 0], feet, swing: w.swing };
      // pour posture while standing at the counter
      const pw = pulse(t, 10.6, 12.8, 0.4);
      if (pw > 0) pose = { ...pose, ...blendFields(pose, POUR_POSE, pw) };
      if (t < walk.t0 + 0.3) pose = blendFields({ root: [B.x, 0, B.z + 0.17], yaw: 0, ...STAND }, pose, clamp((t - walk.t0) / 0.3));
      return pose;
    }
    return bodyKeys.at(t);
  }
  function blendFields(a, b, w) {
    const o = { ...a };
    for (const k of ['hips', 'hipsRot', 'spine', 'chest', 'neck', 'head']) if (b[k]) o[k] = a[k].map((v, i) => lerp(v, b[k][i], w));
    if (b.root && a.root) o.root = a.root.map((v, i) => lerp(v, b.root[i], w));
    if (b.feet && a.feet) o.feet = { L: { pos: a.feet.L.pos.map((v, i) => lerp(v, b.feet.L.pos[i], w)), yaw: lerp(a.feet.L.yaw, b.feet.L.yaw, w) }, R: { pos: a.feet.R.pos.map((v, i) => lerp(v, b.feet.R.pos[i], w)), yaw: lerp(a.feet.R.yaw, b.feet.R.yaw, w) } };
    if (b.yaw !== undefined && a.yaw !== undefined) o.yaw = lerp(a.yaw, b.yaw, w);
    return o;
  }

  // ---------------- emotions (story beats) ----------------
  const emoKeys = [
    [0, 'tired', 0], [3.35, 'hopeful', 0.45], [5.5, 'relief', 0.9], [6.5, 'content', 0.7],
    [20, 'content', 0], [23.0, 'neutral', 0.3], [24.9, 'content', 0.3], [25.6, 'doubt', 1.5], [27.0, 'doubt', 0.4],
    [28.7, 'anxious', 1.2], [31.3, 'anxious', 0.5], [32.4, 'panic', 0.9], [33.7, 'anxious', 0.5], [35.9, 'shock', 0.2],
    [36.7, 'doubt', 0.4], [38.4, 'panic', 0.5], [39.45, 'shock', 0.15], [40.4, 'despair', 1.1],
    [42.9, 'hopeSmall', 0.9], [44.6, 'hopeful', 0.6], [46.62, 'shock', 0.12], [47.7, 'despair', 0.8],
    [50.3, 'grimace', 0.15], [50.9, 'neutral', 0.4], [51.3, 'defeated', 1.0],
  ];
  const emoTrack = new BlendTrack(emoKeys.map(([t, n, d]) => [t, EXPRESSIONS[n], d]), (a, b, w) => blendExpr([[a, 1 - w], [b, w]]));

  // ---------------- speech (lip sync) + subtitles ----------------
  const spoken = [
    buildLine('Oh be...', 5.65, 6.25),
    buildLine('Bir dakika...', 27.15, 27.9),
    buildLine('Yanlış hesapladım herhalde...', 36.85, 38.25),
    buildLine('En azından bir kahveyi hak ettim.', 42.7, 44.3),
  ];
  const subtitles = [
    ...spoken.map((l) => ({ text: l.text, start: l.start - 0.1, end: l.end + 0.35, style: 'spoken' })),
    { text: 'Bugün kendime iyi davranacağım.', start: 11.0, end: 12.75, style: 'thought' },
    { text: '(Kahve zaten soğumuş.)', start: 50.35, end: 50.95, style: 'thought' },
  ];

  // ---------------- breathing ----------------
  const breathBig = (t) =>
    // inhale (+) / exhale (-) events: relief, despair sigh, final nose-laugh
    envelope(t, 4.9, 0.55, 0.05, 0.05) - envelope(t, 5.5, 0.15, 0.3, 0.6) * 1.2 +
    envelope(t, 40.25, 0.4, 0.05, 0.05) * 0.8 - envelope(t, 40.7, 0.2, 0.5, 0.9) * 1.1 +
    envelope(t, 48.5, 0.4, 0.0, 0.1) * 0.5 - envelope(t, 48.95, 0.15, 0.25, 0.5) * 0.8 -
    (envelope(t, 52.3, 0.06, 0.04, 0.12) + envelope(t, 52.55, 0.06, 0.04, 0.2)) * 0.5;

  // ---------------- gaze / head look ----------------
  const phoneScreen = () => V(0, 0, 0.005).applyMatrix4(phone.matrixWorld);
  const gazeKeys = new BlendTrack([
    [0, () => B.clone().add(V(0.25, 0.2, 1.3)), 0],
    [1.08, () => V(-2.17, 0.56, -0.3), 0.22],
    [2.55, () => phoneScreen(), 0.25],
    [6.3, () => B.clone().add(V(0.6, 1.9, 1.6)), 0.35],
    [6.9, () => B.clone().add(V(1.5, 1.0, 1.6)), 0.4],
    [7.8, () => V(0.3, 1.1, -0.8), 0.4],
    [9.9, () => SPOTS.counterMug.clone().add(V(0.1, 0.05, 0)), 0.35],
    [20.0, () => mug.localToWorld(V(0, 0.1, 0)), 0],
    [21.7, () => V(-0.4, 1.4, 1.6), 0.4],
    [23.05, () => T.clone().add(V(0.0, 0.62, 0.15)), 0.12],
    [24.75, () => phoneScreen(), 0.25],
    [40.3, () => T.clone().add(V(0.1, 2.6, 0.8)), 0.6],
    [41.9, () => T.clone().add(V(0.05, 0.75, 0.6)), 0.8],
    [42.4, () => mug.localToWorld(V(0, 0.08, 0)), 0.45],
    [43.95, () => phoneScreen(), 0.3],
    [48.75, () => T.clone().add(V(0.12, 0.75, 0.35)), 0.4],
    [49.35, () => mug.localToWorld(V(0, 0.08, 0)), 0.3],
    [51.05, () => film.camera.position.clone(), 0.35],
  ], (a, b, w) => a.clone().lerp(b, w));
  const headLookW = new BlendTrack([[0, 0.35, 0], [1.08, 0.75, 0.3], [6.9, 0.4, 0.5], [9.9, 0.6, 0.4], [20, 0.3, 0], [23.05, 0.6, 0.2], [24.75, 0.55, 0.3], [40.3, 0.15, 0.6], [42.4, 0.55, 0.4], [51.05, 0.85, 0.5]], (a, b, w) => lerp(a, b, w));
  const saccadeMode = (t) => (t > 2.9 && t < 4.6) || (t > 25.2 && t < 27.0) || (t > 28.5 && t < 30.6) || (t > 47.5 && t < 48.6) ? 'reading'
    : (t > 31.0 && t < 33.5) || (t > 35.0 && t < 35.9) ? 'darting'
    : (t > 46.6 && t < 47.4) || t > 51.4 ? 'still' : 'idle';
  const blinks = blinkSchedule(0, 54, 11, [1.12, 3.32, 6.55, 23.08, 24.8, 28.4, 40.5, 46.7, 51.1], [[46.65, 47.5], [51.3, 53.6], [3.4, 4.4]]);

  // ---------------- fingers ----------------
  const fingerR = new BlendTrack([
    [0, { rest: 1 }, 0], [1.7, { hold: 1 }, 0.3], [2.3, { phone: 1 }, 0.15], [7.65, { hold: 1 }, 0.2], [8.1, { relaxed: 1 }, 0.3],
    [10.45, { mug: 1 }, 0.3], [12.95, { relaxed: 1 }, 0.3],
    [20, { mug: 1 }, 0], [23.85, { rest: 1 }, 0.25], [33.3, { point: 1 }, 0.25], [35.35, { rest: 1 }, 0.3], [38.15, { point: 1 }, 0.2], [39.65, { rest: 1 }, 0.3],
    [49.2, { hold: 1 }, 0.2], [49.45, { mug: 1 }, 0.15], [51.0, { rest: 1 }, 0.3],
  ]);
  const fingerL = new BlendTrack([
    [0, { fist: 0.5, relaxed: 0.5 }, 0], [0.95, { rest: 1 }, 0.35],
    [20, { mug: 1 }, 0], [23.6, { hold: 1 }, 0.2], [24.0, { phone: 1 }, 0.15], [49.25, { rest: 1 }, 0.3],
  ]);
  const thumbTapsL = [27.95, 28.15, 33.25, 44.25, 44.55, 45.25, 45.32];
  const thumbTapsR = [3.0, 6.6];
  const tapCurve = (t, list) => list.reduce((a, x) => Math.max(a, envelope(t, x - 0.08, 0.08, 0.02, 0.12)), 0);

  // calculator keystrokes (right index)
  const calcSeq1 = '32500−17000−1240−2310−449−520−1400−4800−2000='.split('');
  const calcSeq2 = 'C32500−17000−1240−2310−449−520−1400−4800−2000='.split('');
  const keyTimes = (seq, t0, t1, accel) => seq.map((k, i) => ({ k, t: t0 + (t1 - t0) * Math.pow(i / (seq.length - 1), accel) }));
  // typing is shown in chunks: the finger hits a subset of keys, the display jumps
  const strokes1 = keyTimes(calcSeq1, 33.75, 35.3, 0.92);
  const strokes2 = keyTimes(calcSeq2, 38.35, 39.4, 0.85);
  const strokesAll = [...strokes1, ...strokes2];
  function calcState(t) {
    const run = (strokes) => {
      let expr = '', res = '';
      for (const s of strokes) {
        if (s.t > t) break;
        if (s.k === 'C') { expr = ''; res = '0'; continue; }
        if (s.k === '=') { res = '2.781'; continue; }
        expr += s.k;
        const nums = expr.split('−').filter(Boolean);
        res = nums.length ? nums[nums.length - 1].replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '0';
      }
      return { expr: expr.replace(/\B(?=(\d{3})+(?!\d))/g, '.'), res };
    };
    const second = t >= strokes2[0].t;
    const r = run(second ? strokes2 : strokes1);
    let pressed = '', amt = 0;
    for (const s of second ? strokes2 : strokes1) { const d = t - s.t; if (d > -0.03 && d < 0.09) { pressed = s.k; amt = 1 - Math.abs(d - 0.02) / 0.07; } }
    return { expr: r.expr, result: r.res || '0', pressed, pressAmt: clamp(amt), alert: r.res === '2.781' && (t - (second ? strokes2 : strokes1).slice(-1)[0].t) < 3 && Math.floor(t * 4) % 2 === 0 };
  }

  // ---------------- phone UI timeline ----------------
  const N = (t0, app, title, body, tone, extra = {}) => ({ t0, app, title, body, tone, ...extra });
  const notifsA = [N(1.0, 'Bankam', 'Maaşınız yattı 🎉', '+32.500,00 TL', 'good', { big: true, color: '#1e8e4b', icon: '₺' })];
  const notifsB = [
    N(25.3, 'Ev Sahibi · Kira', 'Kira ödemesi bugün', '−17.000 TL', 'bad', { color: '#c0392b', icon: '⌂' }),
    N(26.0, 'Elektrik', 'Fatura son ödeme: bugün', '−1.240 TL', 'bad', { color: '#e67e22', icon: '⚡' }),
    N(26.6, 'Doğalgaz', 'Faturanız hazır', '−2.310 TL', 'bad', { color: '#d35400', icon: '🔥' }),
  ];
  const notifsS4 = [
    N(31.0, 'İnternet', 'Otomatik ödeme', '−449 TL', 'bad', { color: '#8e44ad', icon: '⌁' }),
    N(31.45, 'Telefon', 'Fatura ödendi', '−520 TL', 'bad', { color: '#2c3e50', icon: '✆' }),
    N(31.85, 'Site Yönetimi', 'Aidat', '−1.400 TL', 'bad', { color: '#16a085', icon: '▦' }),
    N(32.25, 'Bankam', 'Kredi taksiti', '−4.800 TL', 'bad', { color: '#123d7a', icon: '₺' }),
    N(32.6, 'FitSalon', 'Üyelik yenilendi', '−2.000 TL', 'bad', { color: '#c0392b', icon: '◎' }),
  ];
  const notifsS5 = [
    N(47.3, 'Bankam', 'Kredi kartı ekstresi otomatik ödendi', '−2.781 TL', 'bad', { color: '#123d7a', icon: '₺' }),
    N(47.95, 'Bankam · Ekstre özeti', 'En çok harcama:', 'Kahve Durağı · 23 işlem', 'bad', { color: '#5a3a24', icon: '☕' }),
  ];
  const bankItems = [
    { t: 28.85, label: 'Kira', amount: -17000, icon: '⌂', sub: 'Ev sahibi' },
    { t: 29.5, label: 'Elektrik', amount: -1240, icon: '⚡' },
    { t: 30.15, label: 'Doğalgaz', amount: -2310, icon: '🔥' },
    { t: 31.0, label: 'İnternet', amount: -449, icon: '⌁' },
    { t: 31.45, label: 'Telefon', amount: -520, icon: '✆' },
    { t: 31.85, label: 'Aidat', amount: -1400, icon: '▦' },
    { t: 32.25, label: 'Kredi taksiti', amount: -4800, icon: '₺' },
    { t: 32.6, label: 'Spor salonu', amount: -2000, icon: '◎' },
  ];
  function balanceAt(t) {
    let b = 32500;
    let flash = 0;
    for (const it of bankItems) {
      const u = clamp((t - it.t - 0.15) / 0.45);
      b += it.amount * ease.out(u);
      flash = Math.max(flash, envelope(t, it.t + 0.1, 0.08, 0.1, 0.4));
    }
    return { b, flash };
  }
  function phoneUIAt(t) {
    const live = (list, max = 4) => list.filter((n) => t >= n.t0).slice(-max).reverse().map((n) => ({ ...n, age: t - n.t0 }));
    if (t < 19) {
      const wake = smoothstep(0.98, 1.08, t) * (1 - smoothstep(7.7, 7.9, t));
      return { screen: 'lock', wake, notifs: live(notifsA) };
    }
    if (t < 24.55) return { screen: 'lock', wake: 0 };
    if (t < 28.3) return { screen: 'lock', wake: smoothstep(24.55, 24.7, t), notifs: live(notifsB) };
    if (t < 33.4) {
      const { b, flash } = balanceAt(t);
      const items = bankItems.filter((i) => t >= i.t).slice(-5).reverse().map((i) => ({ ...i, age: t - i.t }));
      return { screen: 'bank', bank: { balance: b, flash, items }, notifs: live(notifsS4, 1).filter((n) => n.age < 0.9) };
    }
    if (t < 44.3) return { screen: 'calc', calc: calcState(t) };
    if (t < 46.6) return { screen: 'cafe', cafe: { press: envelope(t, 45.25, 0.06, 0.08, 0.2), loading: t > 45.33 ? t - 45.33 : 0 } };
    return { screen: 'declined', declined: { a: smoothstep(46.6, 46.75, t), balance: t > 47.4 ? 0 : 2781 }, notifs: live(notifsS5, 2) };
  }

  // ---------------- props ----------------
  const phoneOnStand = mat(SPOTS.nightstandPhone, Q(-Math.PI / 2, 0.4, 0));
  const phoneFaceDown = mat(SPOTS.tablePhone.clone().add(V(0, 0.0045, 0)), Q(Math.PI / 2, 0.25, 0));
  const mugCounter = mat(SPOTS.counterMug, Q(0, Math.PI / 2 + 0.3, 0));
  const mugTable = mat(SPOTS.tableMug, Q(0, 2.36, 0)); // handle toward his right-front
  const kettleHome = mat(SPOTS.kettle, Q(0, Math.PI - 0.1, 0));
  // phone buzz jitter on hard surfaces
  const buzz = (t, t0) => (t > t0 && t < t0 + 0.55 && Math.floor((t - t0) / 0.06) % 2 === 0 ? 1 : 0) * (t - t0 < 0.25 || t - t0 > 0.32 ? 1 : 0);

  // ---------------- lighting / grade ----------------
  const lightKeys = [[0, 'morning'], [5.6, 'warm', 3.0], [19, 'warm', 0], [25.6, 'overcast', 3.0], [40.3, 'drained', 2.2]];
  function lightAt(t) {
    let cur = LIGHT_STATES[lightKeys[0][1]], name = lightKeys[0][1];
    for (const [k, n, d = 0] of lightKeys) {
      if (t < k) break;
      const w = d ? ease.inOut(clamp((t - k) / d)) : 1;
      cur = blendLightState(cur, LIGHT_STATES[n], w);
      if (w > 0.5) name = n;
    }
    return { light: cur, envName: name };
  }
  const GRADES = {
    morning: { lift: [0.01, 0.015, 0.03], gamma: [1.0, 1.0, 1.02], gain: [0.98, 1.0, 1.05], sat: 0.9, contrast: 1.04, exposure: 1.05, vignette: 0.4 },
    warm: { lift: [0.025, 0.012, 0.0], gamma: [1.02, 1.0, 0.97], gain: [1.05, 1.0, 0.92], sat: 1.06, contrast: 1.05, exposure: 1.08, vignette: 0.32 },
    tense: { lift: [0.0, 0.01, 0.02], gamma: [0.98, 1.0, 1.02], gain: [0.97, 1.0, 1.03], sat: 0.85, contrast: 1.12, exposure: 1.0, vignette: 0.5 },
    drained: { lift: [0.01, 0.015, 0.025], gamma: [0.97, 0.98, 1.0], gain: [0.95, 0.97, 1.0], sat: 0.72, contrast: 1.08, exposure: 0.96, vignette: 0.55 },
  };
  const gradeKeys = new BlendTrack([[0, GRADES.morning, 0], [5.6, GRADES.warm, 3], [19, GRADES.warm, 0], [25.6, GRADES.tense, 4], [40.3, GRADES.drained, 2.5]]);

  // ---------------- HUD cards (diegetic info) ----------------
  const cardDefs = [
    ...bankItems.slice(0, 3).map((it, i) => ({ t: it.t + 0.05, life: 1.6, text: fmtTL(it.amount), sub: it.label, tone: 'bad', anchor: 'phone', offset: [220, -120 + i * 120] })),
    ...bankItems.slice(3).map((it, i) => ({ t: it.t + 0.05, life: 2.3 - i * 0.3, text: fmtTL(it.amount), sub: it.label, tone: 'bad', anchor: 'head', offset: [(i % 2 ? 1 : -1) * (180 + (i % 3) * 30), -160 - i * 95] })),
    { t: 33.0, life: 1.0, text: 'Kalan: 2.781 TL', tone: 'neutral', anchor: 'phone', offset: [0, -330], big: true },
    { t: 47.45, life: 1.4, text: 'Bakiye: 0 TL', tone: 'bad', anchor: 'phone', offset: [0, -360], big: true },
  ];
  function cardsAt(t, shot) {
    const out = [];
    for (const c of cardDefs) {
      if (t < c.t || t > c.t + c.life + 0.35) continue;
      if (shot.noCards) continue;
      const anchor = c.anchor === 'phone' ? phone.localToWorld(V(0, 0, 0)) : char.eyesWorld().add(V(0, 0.05, 0));
      out.push({ ...c, anchor, age: t - c.t });
    }
    return out;
  }

  // ---------------- per-frame evaluation ----------------
  const rootMat = (pose) => mat(V(...pose.root), Q(0, pose.yaw, 0));
  const toRootLocal = (pose, M) => {
    const rinv = inv(rootMat(pose));
    const l = rinv.multiply(M);
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    l.decompose(p, q, s);
    return { pos: p, quat: q };
  };

  function evaluate(t, shot) {
    const pose = basePose(t);
    const emo = emoTrack.at(t);
    const eb = emo.body || {};
    // posture overlays from emotion + breathing
    const rate = (x) => (emoTrack.at(x).body || {}).breathRate || 13;
    const ph = breathPhase(t, rate, t < 19 ? 0 : 19);
    const depth = eb.breathDepth ?? 1;
    const br = Math.sin(ph) * depth;
    const big = breathBig(t);
    const slump = (eb.slump || 0) - big * 0.25;
    const st = {
      rootPos: pose.root, rootYaw: pose.yaw,
      hips: pose.hips, hipsRot: pose.hipsRot,
      spine: [pose.spine[0] + slump * 0.08 - br * 0.008, pose.spine[1], pose.spine[2]],
      chest: [pose.chest[0] + slump * 0.2 - br * 0.02 - big * 0.05, pose.chest[1], pose.chest[2]],
      neck: [pose.neck[0] + (eb.headFwd || 0) * 0.22 + slump * 0.05, pose.neck[1], pose.neck[2]],
      head: [pose.head[0] + (eb.headPitch || 0) - (eb.headFwd || 0) * 0.15 + slump * 0.06 - big * 0.06, pose.head[1], pose.head[2] + (eb.headRoll || 0)],
      clav: {
        L: [(eb.shoulderRaise || 0) + br * 0.012 + big * 0.05 - slump * 0.03, slump * 0.06],
        R: [(eb.shoulderRaise || 0) + br * 0.012 + big * 0.05 - slump * 0.03, slump * 0.06],
      },
      feet: {},
      hands: {},
    };
    for (const L of ['L', 'R']) {
      const f = pose.feet[L];
      st.feet[L] = { pos: V(...f.pos), yaw: f.yaw, pitch: f.pitch || 0 };
    }
    // pass 1: body without hands -> live head/shoulders for hand goals
    char.pose(st);
    const eyes = char.eyesWorld();
    const headQ = char.headWorldQuat();
    const fwd = V(0, 0, 1).applyQuaternion(headQ), up = V(0, 1, 0).applyQuaternion(headQ), right = V(-1, 0, 0).applyQuaternion(headQ);
    const rootQ = Q(0, pose.yaw, 0);
    const bodyFwd = V(0, 0, 1).applyQuaternion(rootQ), bodyRight = V(-1, 0, 0).applyQuaternion(rootQ);
    ctx.eyes = eyes; ctx.headQ = headQ; ctx.fwd = fwd; ctx.up = up; ctx.right = right;
    const shoulder = (L) => char.bonePos('upperArm.' + L);
    const spineM = char.sk.byName.spine.matrixWorld;
    const pocket = (L) => V(L === 'L' ? 0.07 : -0.07, -0.02, 0.135).applyMatrix4(spineM);

    // ---- goals (world matrices of the hand) ----
    const sideRest = (L) => {
      const s = L === 'L' ? 1 : -1;
      const sp = shoulder(L);
      const sw = (pose.swing || 0) * (L === 'L' ? -1 : 1);
      const p = sp.clone().addScaledVector(bodyRight, -s * 0.045).add(V(0, -0.555, 0)).addScaledVector(bodyFwd, 0.04 + sw * 0.17);
      return mat(p, rootQ.clone().multiply(Q(-0.12 - sw * 0.35, 0, s * 0.05)));
    };
    const thighRest = (L, k = 0.55, lift = 0.075) => {
      const s = L === 'L' ? 1 : -1;
      const hip = char.bonePos('thigh.' + L), knee = char.bonePos('shin.' + L);
      const p = hip.clone().lerp(knee, k).add(V(0, lift, 0)).addScaledVector(bodyRight, s * 0.01);
      const X = s > 0 ? V(0, 1, 0) : V(0, -1, 0);
      const Y = bodyFwd.clone().negate().add(V(0, 0.25, 0)).normalize();
      return basisMat(p, X, Y).multiply(new THREE.Matrix4().makeTranslation(0, 0.06, 0));
    };
    const tableRest = (L, dx = 0) => {
      const s = L === 'L' ? 1 : -1;
      const p = T.clone().add(V(s * (0.2 + dx), 0.77, 0.24));
      const X = s > 0 ? V(0.15, 1, 0) : V(-0.15, -1, 0);
      return basisMat(p, X.normalize(), V(0.15 * s, 0.12, -1).normalize()).multiply(new THREE.Matrix4().makeTranslation(0, 0.07, 0));
    };
    const phoneView = (dist = 0.34, drop = 0.16, lat = 0.0, tilt = 0) => {
      // phone held fairly high: keeps the face readable for the camera
      const p = eyes.clone().addScaledVector(bodyFwd, dist).add(V(0, -drop * 1.15, 0)).addScaledVector(bodyRight, lat);
      const m = lookMat(p, eyes.clone().addScaledVector(up, 0.02), up.clone().addScaledVector(fwd, tilt));
      return m;
    };
    const mp = char.headRig.mouthP;
    const mouthPos = () => V(0, mp.y * 1.08 - 0.004, mp.z * 1.08).applyMatrix4(char.sk.byName.head.matrixWorld);

    // phone world pose & attachment
    let phoneSide = null, phoneGrip = null, phoneWorld = null, phoneVisible = true;
    let mugSide = null, mugWorld = null, mugGrip = null, mugSupport = false, mugFill = 0;
    let kettleWorld = kettleHome.clone(), kettleHeld = false;
    const goal = { L: null, R: null };
    const indexTap = { L: 0, R: 0 };

    if (t < 19) {
      // ===== BLOCK A =====
      // left hand: rubbing eye, then rests on thigh
      const rub = pulse(t, 0.15, 0.85, 0.3);
      goal.L = lerpMat(thighRest('L'), (() => {
        const p = eyes.clone().addScaledVector(right, -0.04).addScaledVector(fwd, 0.05).add(V(0, -0.01 + Math.sin(t * 14) * 0.006 * rub, 0));
        return basisMat(p, fwd.clone().negate(), up.clone().negate().addScaledVector(right, -0.6)).multiply(new THREE.Matrix4().makeTranslation(0.0, 0.11, -0.02));
      })(), rub);
      // right hand: rest -> reach nightstand -> view -> pocket -> walk swing -> kettle
      const buzzJit = buzz(t, 1.0) * 0.0012;
      const standPose = phoneOnStand.clone().multiply(new THREE.Matrix4().makeTranslation(buzzJit, 0, 0));
      if (t < 2.3) {
        phoneWorld = standPose;
        const reach = ease.inOut(clamp((t - 1.55) / 0.75));
        const hover = handFrom(standPose.clone().premultiply(new THREE.Matrix4().makeTranslation(0, 0.05 * (1 - reach), 0)), GRIP.phoneTopR);
        goal.R = lerpMat(thighRest('R'), hover, reach);
      } else {
        phoneSide = t < 8.05 ? 'R' : null;
        const lift = ease.inOut(clamp((t - 2.3) / 0.65));
        phoneGrip = lerpMat(GRIP.phoneTopR, GRIP.phoneViewR, ease.inOut(clamp((t - 2.4) / 0.5)));
        let desired = lerpMat(standPose.clone().premultiply(new THREE.Matrix4().makeTranslation(0, 0.04 * lift, 0)), phoneView(0.33, 0.17, 0.08), lift);
        // stand up holding the phone loosely, then pocket it
        const pk = ease.inOut(clamp((t - 7.55) / 0.5));
        if (t > 6.7) desired = lerpMat(desired, phoneView(0.3, 0.33, 0.06, 0.4), ease.inOut(clamp((t - 6.7) / 0.6)));
        if (pk > 0) desired = lerpMat(desired, mat(pocket('R'), rootQ.clone().multiply(Q(-Math.PI / 2 + 0.3, 0, 0))), pk);
        if (t < 8.05) goal.R = handFrom(desired, phoneGrip);
        else phoneVisible = false;
        if (t >= 8.05) goal.R = lerpMat(mat(pocket('R'), rootQ), sideRest('R'), ease.inOut(clamp((t - 8.05) / 0.4)));
        if (t > 6.4 && t < 8.05) goal.L = lerpMat(goal.L, sideRest('L'), ease.inOut(clamp((t - 6.8) / 0.5)));
        if (t > 7.6) goal.L = sideRest('L');
      }
      // kettle pour at the counter
      if (t > 10.0) {
        // left hand rests on the counter edge (keeps the insert shot clear)
        const counterEdge = mat(C.clone().add(V(-0.28, 0.935, -0.36)), Q(0, Math.PI, 0).multiply(Q(-Math.PI / 2 + 0.2, 0, Math.PI / 2)));
        goal.L = lerpMat(sideRest('L'), counterEdge, ease.inOut(clamp((t - 10.3) / 0.5)) * (1 - ease.inOut(clamp((t - 12.9) / 0.4))));
        const reach = ease.inOut(clamp((t - 10.35) / 0.55));
        const lift = ease.inOut(clamp((t - 10.9) / 0.35)) * (1 - ease.inOut(clamp((t - 12.6) / 0.35)));
        const tilt = ease.inOut(clamp((t - 11.05) / 0.4)) * (1 - ease.inOut(clamp((t - 12.35) / 0.3)));
        const toward = SPOTS.counterMug.clone().sub(SPOTS.kettle).setY(0).normalize();
        const kPos = SPOTS.kettle.clone().add(V(0, 0.16 * lift, 0)).addScaledVector(toward, 0.19 * lift);
        const yawK = Math.atan2(toward.x, toward.z) - Math.PI / 2;
        const kq = Q(0, yawK, 0).multiply(Q(0, 0, -0.75 * tilt, 'XYZ'));
        const kHeld = mat(kPos, lerpQuat(Q(0, Math.PI - 0.1, 0), kq, lift));
        kettleWorld = lift > 0 ? kHeld : kettleHome.clone();
        kettleHeld = reach > 0.98 && t < 12.95;
        const hk = handFrom(kettleWorld, GRIP.kettleR);
        if (t < 13.3) goal.R = lerpMat(sideRest('R'), hk, reach * (1 - ease.inOut(clamp((t - 12.95) / 0.35))));
        mugWorld = mugCounter;
        mugFill = 0.04 + 0.74 * smoothstep(11.3, 12.4, t);
      } else mugWorld = mugCounter;
    } else {
      // ===== BLOCK B (table) =====
      mugFill = 0.72;
      const rest = (L) => tableRest(L);
      goal.L = rest('L'); goal.R = rest('R');
      // mug in both hands, sip, set down
      const sip = pulse(t, 20.55, 21.5, 0.45);
      const holdQ = rootQ.clone().multiply(Q(0, Math.PI - 0.3, 0));
      const hold = mat(eyes.clone().addScaledVector(bodyFwd, 0.2).add(V(0, -0.36, 0)), holdQ);
      const tiltQ = new THREE.Quaternion().setFromAxisAngle(bodyRight, 0.62).multiply(holdQ);
      const tUp = V(0, 1, 0).applyQuaternion(tiltQ);
      const atMouth = mat(mouthPos().addScaledVector(bodyFwd, 0.05).addScaledVector(tUp, -0.09), tiltQ);
      let mugInHands = lerpMat(hold, atMouth, ease.inOut(sip));
      // freeze on the buzz (23.0), then put the mug down
      if (t > 23.0) mugInHands = lerpMat(mugInHands, hold.clone().premultiply(new THREE.Matrix4().makeTranslation(0, -0.03, 0)), 1);
      const down = ease.inOut(clamp((t - 23.35) / 0.5));
      // second sip of the cold coffee at the end
      const lift2 = ease.inOut(clamp((t - 49.45) / 0.4));
      const sip2 = pulse(t, 49.8, 50.45, 0.3);
      const down2 = ease.inOut(clamp((t - 50.55) / 0.45));
      if (t < 23.85) {
        mugWorld = lerpMat(mugInHands, mugTable, down);
        mugSide = 'R'; mugGrip = GRIP.mugR; mugSupport = t < 23.5;
      } else if (t > 49.15 && t < 51.0) {
        const reachHandle = mugTable;
        const up = lerpMat(reachHandle, lerpMat(hold, atMouth, ease.inOut(sip2)), lift2);
        mugWorld = lerpMat(up, mugTable, down2);
        mugSide = t > 49.4 ? 'R' : null; mugGrip = GRIP.mugR;
      } else mugWorld = mugTable;
      if (mugSide === 'R') {
        goal.R = handFrom(mugWorld, GRIP.mugR);
        if (mugSupport) goal.L = lerpMat(rest('L'), handFrom(mugWorld, GRIP.mugL), 1 - ease.inOut(clamp((t - 23.25) / 0.25)));
      } else if (t > 49.0 && t <= 49.4) goal.R = lerpMat(rest('R'), handFrom(mugTable, GRIP.mugR), ease.inOut(clamp((t - 49.0) / 0.4)));
      else if (t >= 51.0) goal.R = lerpMat(handFrom(mugTable, GRIP.mugR), rest('R'), ease.inOut(clamp((t - 51.0) / 0.4)));
      if (t > 23.85 && t < 24.2) goal.R = lerpMat(handFrom(mugTable, GRIP.mugR), rest('R'), ease.inOut(clamp((t - 23.85) / 0.35)));

      // phone: pocket -> view (left hand)
      if (t < 23.55) phoneVisible = false;
      else {
        phoneSide = t < 49.3 ? 'L' : null;
        phoneGrip = GRIP.phoneViewL;
        const toPocket = ease.inOut(clamp((t - 23.55) / 0.45));
        const out = ease.inOut(clamp((t - 24.05) / 0.7));
        const pocketPose = mat(pocket('L'), rootQ.clone().multiply(Q(-Math.PI / 2 + 0.4, 0, 0)));
        let view = phoneView(0.33, 0.18, -0.08);
        // pulled in closer when doubting, then shaking slightly with panic
        view = lerpMat(view, phoneView(0.28, 0.16, -0.07), smoothstep(26.2, 27.4, t) * (1 - smoothstep(40.2, 41.0, t)));
        const shake = smoothstep(31, 32.5, t) * (1 - smoothstep(35.2, 36, t)) + smoothstep(38.3, 38.6, t) * (1 - smoothstep(39.6, 40, t));
        if (shake > 0) view.premultiply(new THREE.Matrix4().makeTranslation(noise1(t * 9, 3) * 0.004 * shake, noise1(t * 8, 5) * 0.004 * shake, 0));
        // lowered when leaning back, raised again for the cafe app
        const lowered = mat(T.clone().add(V(0.12, 0.86, 0.28)), rootQ.clone().multiply(Q(-1.2, 0.3, 0)));
        const low = ease.inOut(clamp((t - 40.35) / 0.8)) * (1 - ease.inOut(clamp((t - 43.75) / 0.6)));
        view = lerpMat(view, lowered, low);
        // freeze & slowly lower after the decline; put face down
        const place = ease.inOut(clamp((t - 48.75) / 0.55));
        view = lerpMat(view, phoneFaceDown, place);
        phoneWorld = t < 24.05 ? pocketPose : lerpMat(pocketPose, view, out);
        if (t >= 49.3) phoneWorld = phoneFaceDown;
        if (t < 24.05) goal.L = lerpMat(rest('L'), handFrom(pocketPose, GRIP.phoneViewL), toPocket);
        else if (t < 49.3) goal.L = handFrom(phoneWorld, GRIP.phoneViewL);
        else goal.L = lerpMat(handFrom(phoneFaceDown, GRIP.phoneViewL), rest('L'), ease.inOut(clamp((t - 49.3) / 0.45)));
        phoneVisible = t > 23.9;
      }
      // right index taps on the calculator
      const typing = (t > 33.4 && t < 35.5) || (t > 38.2 && t < 39.7);
      if (typing && phoneWorld) {
        const strokes = t < 37 ? strokes1 : strokes2;
        let i = 0;
        while (i < strokes.length - 1 && strokes[i + 1].t - 0.05 <= t) i++;
        const a = strokes[i], b = strokes[Math.min(strokes.length - 1, i + 1)];
        const u = b === a ? 1 : clamp((t - (a.t + 0.06)) / Math.max(0.02, b.t - a.t - 0.08));
        const ka = calcKeyLocal(a.k), kb = calcKeyLocal(b.k);
        const kx = lerp(ka[0], kb[0], ease.inOut(u)), ky = lerp(ka[1], kb[1], ease.inOut(u));
        const press = Math.max(envelope(t, a.t - 0.04, 0.04, 0.02, 0.06), envelope(t, b.t - 0.04, 0.04, 0.02, 0.06));
        const hover = 0.012 * (1 - press) + 0.012 * Math.sin(u * Math.PI);
        const tip = V(kx, ky, PHONE.d / 2 + 0.003 + hover).applyMatrix4(phoneWorld);
        const pz = V(0, 0, 1).transformDirection(phoneWorld), py = V(0, 1, 0).transformDirection(phoneWorld), px = V(1, 0, 0).transformDirection(phoneWorld);
        const fingerDir = pz.clone().negate().addScaledVector(py, 0.55).addScaledVector(px, 0.35).normalize();
        const Yh = fingerDir.clone().negate();
        const Xh = px.clone().negate().addScaledVector(pz, -0.4).normalize();
        const handM = basisMat(V(0, 0, 0), Xh, Yh);
        const tipLocal = V(0.0, -0.188, 0.03);
        const origin = tip.clone().sub(tipLocal.clone().applyMatrix4(new THREE.Matrix4().extractRotation(handM)));
        handM.setPosition(origin);
        const ramp = smoothstep(33.4, 33.65, t) * (1 - smoothstep(35.3, 35.5, t)) + smoothstep(38.2, 38.4, t) * (1 - smoothstep(39.5, 39.7, t));
        goal.R = lerpMat(goal.R, handM, ramp);
      }
    }

    // ---- solve full pose ----
    const ensure = (L) => goal[L] || (t < 19 ? sideRest(L) : tableRest(L));
    for (const L of ['L', 'R']) st.hands[L] = toRootLocal(pose, ensure(L));
    // elbows: keep them down/out when holding the phone up
    st.fingers = { L: fingerL.at(t), R: fingerR.at(t) };
    st.thumbTap = { L: tapCurve(t, thumbTapsL), R: tapCurve(t, thumbTapsR) };
    st.indexTap = indexTap;
    // face
    const vis = visemesAt(spoken, t);
    const speaking = vis._active || 0;
    const morphs = { ...emo.morphs };
    for (const [k, v] of Object.entries(vis)) if (k !== '_active') morphs[k] = Math.max((morphs[k] || 0) * (1 - speaking * 0.6), 0) + v;
    if (speaking) { morphs.smileL = (morphs.smileL || 0) * (1 - 0.4 * speaking); morphs.smileR = (morphs.smileR || 0) * (1 - 0.4 * speaking); }
    // exhale: puffed cheeks + parted lips
    const exh = Math.max(0, -big);
    morphs.cheekPuff = (morphs.cheekPuff || 0) + exh * 0.35;
    morphs.jawOpen = (morphs.jawOpen || 0) + exh * 0.05;
    // final nose laugh
    morphs.smileL = (morphs.smileL || 0) + envelope(t, 52.3, 0.06, 0.25, 0.4) * 0.12;
    const blink = blinkAt(t, blinks);
    const exhaleClose = envelope(t, 5.55, 0.25, 0.35, 0.4) * 0.7 + envelope(t, 40.6, 0.3, 0.8, 0.5) * 0.9;
    st.morphs = morphs;
    st.lids = { L: emo.lids * (1 - blink) * (1 - exhaleClose), R: emo.lids * (1 - blink) * (1 - exhaleClose) };
    st.lower = { L: emo.lower, R: emo.lower };
    const gz = gazeKeys.at(t, ctx);
    const mode = saccadeMode(t);
    st.gaze = gz;
    st.gazeOffset = mode === 'still' ? [0, 0] : saccade(t, 3, mode);
    st.headLook = { target: gz, w: headLookW.at(t) };
    char.pose(st);

    // ---- attach props after the final pose ----
    const handWorld = (L) => char.sk.byName['hand.' + L].matrixWorld;
    phone.visible = phoneVisible;
    if (phoneSide) phone.matrix.copy(handWorld(phoneSide).clone().multiply(phoneGrip));
    else if (phoneWorld) phone.matrix.copy(phoneWorld);
    phone.matrix.decompose(phone.position, phone.quaternion, phone.scale);
    if (mugSide) mug.matrix.copy(handWorld(mugSide).clone().multiply(mugGrip));
    else mug.matrix.copy(mugWorld || mugTable);
    mug.matrix.decompose(mug.position, mug.quaternion, mug.scale);
    mug.userData.setFill(mugFill);
    if (kettle) {
      const km = kettleHeld ? handWorld('R').clone().multiply(GRIP.kettleR) : kettleWorld;
      // kettle lives inside the set group (identity transform)
      km.decompose(kettle.position, kettle.quaternion, kettle.scale);
    }
    phone.updateMatrixWorld(true); mug.updateMatrixWorld(true);
    if (kettle) kettle.updateMatrixWorld(true);

    // pour stream
    let pour = null;
    if (t > 11.15 && t < 12.45 && kettle) {
      const from = kettle.localToWorld(kettle.userData.spoutTip.clone());
      const to = mug.localToWorld(V(0, 0.012 + 0.08 * mugFill, 0));
      pour = { from, to, amount: smoothstep(11.15, 11.35, t) * (1 - smoothstep(12.25, 12.45, t)) };
    }
    // steam: hot after the pour, cooling over block B
    const steam = t < 19 ? smoothstep(11.4, 12.4, t) : 1 - smoothstep(24, 41, t);

    const { light, envName } = lightAt(t);
    const subtitle = (() => {
      for (const s of subtitles) if (t >= s.start && t <= s.end) return { text: s.text, style: s.style, a: smoothstep(s.start, s.start + 0.12, t) * (1 - smoothstep(s.end - 0.12, s.end, t)) };
      return null;
    })();
    return {
      light, envName,
      grade: gradeKeys.at(t),
      phoneUI: phoneUIAt(t),
      phoneLight: shot.phoneLight ?? 1,
      steam, pour,
      subtitle: shot.noSubs ? null : subtitle,
      cards: cardsAt(t, shot),
    };
  }
  function lerpQuat(a, b, w) { return a.clone().slerp(b, w); }

  // ---------------- cameras ----------------
  const live = () => ({ eyes: ctx.eyes.clone(), fwd: ctx.fwd.clone(), up: ctx.up.clone(), right: ctx.right.clone() });
  const dolly = (a, b, u) => a.clone().lerp(b, ease.inOutSine(clamp(u)));
  const camFace = (dist, lat, height, focal, fstop, push = 0) => (c, lt, P, shot) => {
    const L = live();
    const u = lt / (shot.film[1] - shot.film[0]);
    const flat = V(L.fwd.x, 0, L.fwd.z).normalize();
    const side = V(-flat.z, 0, flat.x);
    const pos = L.eyes.clone().addScaledVector(flat, dist - push * u).addScaledVector(side, lat).add(V(0, height, 0));
    return { pos, target: L.eyes.clone().add(V(0, -0.045, 0)), focal, fstop, focusPoint: L.eyes, handheld: 0.35, fill: { i: 4, off: [0.35, 0.15, 0] } };
  };
  const camPOV = (focal = 45, fstop = 8, back = 0.06, lift = 0.05) => () => {
    const L = live();
    const scr = phone.localToWorld(V(0, -0.005, 0));
    const pos = L.eyes.clone().addScaledVector(L.fwd, 0.1).addScaledVector(L.up, -0.035).addScaledVector(L.right, -0.02);
    return { pos, target: scr, focal, fstop: 8, focusPoint: scr, handheld: 0.5, maxCoc: 10, fill: { i: 1.5, off: [0.3, 0.3, 0] } };
  };
  const camOTS = (sideSign, focal, fstop, back = 0.42, height = 0.16, lat = 0.24) => () => {
    const L = live();
    const scr = phone.localToWorld(V(0, 0, 0));
    const flat = V(L.fwd.x, 0, L.fwd.z).normalize();
    const side = V(-flat.z, 0, flat.x); // +left
    const pos = L.eyes.clone().addScaledVector(flat, -back).addScaledVector(side, sideSign * lat).add(V(0, height, 0));
    return { pos, target: scr.clone().lerp(L.eyes, 0.12), focal, fstop: Math.max(fstop, 5.6), focusPoint: scr, handheld: 0.45, maxCoc: 14 };
  };

  const shotList = [
    // name, scene, duration, perfStart, cam, extra
    ['1A geniş · yatak', 'UMUT', 2.3, 0.0, (c, lt) => {
      const u = lt / 2.3;
      return { pos: dolly(V(-0.62, 0.92, 1.45), V(-0.75, 0.95, 1.2), u), target: V(-1.82, 0.92, -0.72), focal: 26, fstop: 4, focusPoint: ctx.eyes, handheld: 0.4 };
    }],
    ['1B yakın · uzanma', 'UMUT', 1.6, 1.5, (c, lt) => {
      const tgt = ctx.eyes.clone().lerp(V(-2.15, 0.62, -0.32), 0.5 - 0.25 * clamp(lt / 1.6));
      return { pos: V(-2.05, 1.02, 0.55), target: tgt, focal: 32, fstop: 2.8, focusPoint: ctx.eyes.clone().lerp(phone.position, 0.5), handheld: 0.5 };
    }],
    ['1C yakın plan · yüz', 'UMUT', 1.2, 3.0, camFace(0.95, -0.14, -0.16, 75, 2.0, 0.06), { phoneLight: 1.4 }],
    ['1D bakış açısı · ekran', 'UMUT', 0.95, 4.2, camPOV(42, 2.8)],
    ['1E yakın plan · rahatlama', 'UMUT', 1.55, 5.1, camFace(0.95, -0.12, -0.15, 75, 2.0, 0.1), { phoneLight: 1.4 }],
    ['2A orta-geniş · kalkış ve yürüyüş', 'RAHATLAMA', 2.4, 6.75, (c, lt) => {
      const u = lt / 2.4;
      const head = ctx.eyes.clone();
      const pos = dolly(V(-0.55, 1.3, 1.55), V(0.45, 1.3, 1.25), u);
      return { pos, target: head.add(V(0, -0.15, 0)), focal: 28, fstop: 3.5, focusPoint: ctx.eyes, handheld: 0.6 };
    }, { subframes: 3 }],
    ['2B detay · demleme', 'RAHATLAMA', 1.8, 10.95, (c, lt) => {
      const m = SPOTS.counterMug.clone().add(V(0.02, 0.09, 0));
      return { pos: dolly(V(0.66, 1.13, -2.12), V(0.69, 1.11, -2.08), lt / 1.8), target: m.clone().add(V(0.07, 0.07, 0.05)), focal: 35, fstop: 4, focusPoint: m, handheld: 0.3, fill: { i: 2, off: [-0.3, 0.3, 0] } };
    }, { noCards: true, subframes: 3 }],
    ['2C orta plan · ilk yudum', 'RAHATLAMA', 2.5, 20.0, (c, lt) => {
      const u = lt / 2.5;
      return { pos: dolly(V(1.0, 1.2, 1.15), V(1.02, 1.19, 1.0), u), target: ctx.eyes.clone().add(V(0, -0.12, 0)), focal: 50, fstop: 2.2, focusPoint: ctx.eyes, handheld: 0.3 };
    }],
    ['3A orta plan · cepte titreşim', 'GERÇEKLE YÜZLEŞME', 1.8, 22.75, (c, lt) => {
      return { pos: V(1.42, 1.08, 0.95), target: ctx.eyes.clone().lerp(char.bonePos('spine'), 0.35 + 0.2 * clamp(lt / 1.8)), focal: 40, fstop: 2.5, focusPoint: ctx.eyes, handheld: 0.5 };
    }],
    ['3B omuz üstü · bildirimler', 'GERÇEKLE YÜZLEŞME', 2.0, 24.85, camOTS(1, 40, 2.8, 0.36, 0.2, 0.3)],
    ['3C yakın plan · şüphe', 'GERÇEKLE YÜZLEŞME', 1.4, 26.85, camFace(0.95, 0.14, -0.16, 80, 2.0, 0.08), { phoneLight: 1.5 }],
    ['3D ekran · banka uygulaması', 'GERÇEKLE YÜZLEŞME', 2.3, 28.3, camPOV(40, 2.8, 0.08, 0.06)],
    ['4A orta plan · yağan faturalar', 'BASKI', 1.9, 30.8, (c, lt) => {
      return { pos: V(1.2, 1.0, 0.62), target: ctx.eyes.clone().add(V(0, 0.02, 0)), focal: 30, fstop: 2.8, focusPoint: ctx.eyes, handheld: 0.9 };
    }],
    ['4B omuz üstü · hesap makinesi', 'BASKI', 1.4, 33.6, camOTS(-1, 42, 2.8, 0.34, 0.19, 0.27), { noCards: true, subframes: 3 }],
    ['4C çok yakın · gözler', 'BASKI', 0.9, 35.0, camFace(0.62, 0.06, -0.1, 100, 2.8, 0.03), { phoneLight: 1.6 }],
    ['4D yakın plan · "yanlış hesapladım"', 'BASKI', 1.5, 36.8, camFace(0.92, 0.14, -0.15, 75, 2.0, 0.06), { phoneLight: 1.5 }],
    ['4E omuz üstü · yeniden hesap', 'BASKI', 1.1, 38.35, camOTS(-1, 50, 2.8, 0.32, 0.18, 0.25), { noCards: true, subframes: 3 }],
    ['4F yüksek açı · çaresizlik', 'BASKI', 1.9, 40.2, (c, lt) => {
      const u = lt / 1.9;
      return { pos: dolly(V(1.85, 2.15, 1.2), V(2.0, 2.3, 1.38), u), target: T.clone().add(V(0, 0.95, 0.15)), focal: 26, fstop: 4, focusPoint: ctx.eyes, handheld: 0.2 };
    }],
    ['5A orta plan · karar', 'TERS KÖŞE', 2.0, 42.4, (c, lt) => {
      return { pos: dolly(V(0.72, 1.12, 0.95), V(0.76, 1.12, 0.85), lt / 2), target: ctx.eyes.clone().lerp(mug.position, 0.3), focal: 45, fstop: 2.2, focusPoint: ctx.eyes, handheld: 0.35 };
    }],
    ['5B ekran · kahve uygulaması', 'TERS KÖŞE', 1.4, 44.6, camPOV(42, 2.8)],
    ['5C yakın plan · bekleyiş', 'TERS KÖŞE', 1.3, 46.0, camFace(0.95, 0.15, -0.15, 80, 2.0, 0.05), { phoneLight: 2.0 }],
    ['5D ekran · ödeme reddedildi', 'TERS KÖŞE', 1.6, 47.3, camPOV(40, 2.8, 0.07, 0.05)],
    ['5E orta plan · soğuk kahve', 'TERS KÖŞE', 2.0, 48.9, (c, lt) => {
      return { pos: V(1.32, 1.08, 0.98), target: ctx.eyes.clone().add(V(0, -0.1, 0)), focal: 40, fstop: 2.5, focusPoint: ctx.eyes, handheld: 0.3 };
    }],
    ['5F yakın plan · kameraya bakış', 'TERS KÖŞE', 2.75, 50.9, (c, lt) => {
      const u = lt / 2.75;
      const e = ctx.eyes;
      const pos = V(T.x - 0.03, e.y - 0.02, T.z + 1.15 - 0.08 * ease.inOutSine(u));
      return { pos, target: e.clone().add(V(0, -0.04, 0)), focal: 70, fstop: 2.0, focusPoint: e, handheld: 0.25, fill: { i: 4, off: [0.4, 0.2, 0] } };
    }, { noCards: true }],
  ];
  let F = 0;
  const shots = shotList.map(([name, scene, dur, perf, cam, extra = {}], i) => {
    const s = { name, scene, film: [F, F + dur], perf, cam, seed: i * 7 + 3, ...extra };
    F += dur;
    return s;
  });
  const duration = F;

  // ---------------- titles ----------------
  const titleAt = (Ft) => {
    const a = smoothstep(duration - 1.6, duration - 1.2, Ft);
    return a > 0 ? { text: 'MAAŞIM YATTI, NEREYE GİTTİ?', sub: 'Bölüm 1', a } : null;
  };

  // ---------------- audio cues (performance time unless film: true) --------
  const cues = [
    { t: 1.0, type: 'buzz_surface', dur: 0.55 }, { t: 1.02, type: 'notif_good' },
    { t: 0.2, type: 'cloth', dur: 0.6, gain: 0.4 }, { t: 1.55, type: 'cloth', dur: 0.7 }, { t: 2.3, type: 'pickup' },
    { t: 3.0, type: 'tap', gain: 0.5 }, { t: 4.9, type: 'breath_in', dur: 0.55 }, { t: 5.5, type: 'breath_out', dur: 0.9 },
    { t: 6.75, type: 'bed_creak', dur: 0.8 }, { t: 6.8, type: 'cloth', dur: 0.9 }, { t: 7.6, type: 'cloth', dur: 0.5 },
    ...walk.footsteps().map((f) => ({ t: f.t, type: 'step', gain: 0.6 + 0.4 * f.strength })),
    { t: 10.95, type: 'kettle_lift' }, { t: 11.15, type: 'pour', dur: 1.3 }, { t: 12.85, type: 'kettle_down' },
    { t: 20.6, type: 'sip', dur: 0.8 }, { t: 22.0, type: 'cloth', dur: 0.4, gain: 0.3 },
    { t: 23.0, type: 'buzz_pocket', dur: 0.5 }, { t: 23.8, type: 'mug_down' }, { t: 23.6, type: 'cloth', dur: 0.8 },
    ...notifsB.map((n) => ({ t: n.t0, type: 'notif_bad' })),
    { t: 28.0, type: 'tap', gain: 0.5 }, { t: 28.3, type: 'app_open' },
    ...bankItems.map((i) => ({ t: i.t + 0.15, type: 'deduct' })),
    ...notifsS4.map((n) => ({ t: n.t0, type: 'notif_bad', gain: 0.8 })),
    { t: 33.25, type: 'tap', gain: 0.5 },
    ...strokesAll.map((s) => ({ t: s.t, type: 'key' })),
    { t: 35.35, type: 'result_beep' }, { t: 39.45, type: 'result_beep' },
    { t: 40.3, type: 'chair_creak', dur: 0.9 }, { t: 40.7, type: 'sigh', dur: 1.3 },
    { t: 44.3, type: 'tap', gain: 0.5 }, { t: 44.6, type: 'app_open' }, { t: 45.27, type: 'tap' }, { t: 45.35, type: 'loading', dur: 1.25 },
    { t: 46.6, type: 'decline' }, ...notifsS5.map((n) => ({ t: n.t0, type: 'notif_bad', gain: 0.7 })),
    { t: 48.95, type: 'breath_out', dur: 0.7, gain: 0.6 }, { t: 49.28, type: 'phone_down' },
    { t: 49.45, type: 'mug_lift' }, { t: 49.85, type: 'sip', dur: 0.6, gain: 0.7 }, { t: 50.95, type: 'mug_down' },
    { t: 52.3, type: 'nose_laugh' },
    ...spoken.map((l) => ({ t: l.start, type: 'voice_marker', dur: l.end - l.start, text: l.text })),
  ];
  const music = [
    { film: true, t: 0, type: 'music', mood: 'hope', dur: shots[7].film[1] },
    { film: true, t: shots[8].film[0], type: 'music', mood: 'tension', dur: shots[12].film[0] - shots[8].film[0] },
    { film: true, t: shots[12].film[0], type: 'music', mood: 'pressure', dur: shots[18].film[0] - shots[12].film[0] },
    { film: true, t: shots[18].film[0], type: 'music', mood: 'fragile', dur: shots[20].film[0] + 0.6 - shots[18].film[0] },
    { film: true, t: shots[23].film[0] + 0.5, type: 'music', mood: 'ironic', dur: duration - shots[23].film[0] - 0.5 },
  ];
  const roomTone = [{ film: true, t: 0, type: 'room_tone', dur: duration }];

  return {
    duration, shots, evaluate, ctx, titleAt,
    perfCues: cues, filmCues: [...music, ...roomTone],
    subtitles, spoken,
    beats: [
      { scene: 'UMUT', emotion: 'Yorgunluk → umut → rahatlama', cause: 'Maaş bildirimi' },
      { scene: 'RAHATLAMA', emotion: 'Kısa süreli mutluluk', cause: 'Güneş açıyor, kahve, sakin bir sabah' },
      { scene: 'GERÇEKLE YÜZLEŞME', emotion: 'Şüphe → farkına varma', cause: 'Kira ve fatura bildirimleri, bakiye düşüyor' },
      { scene: 'BASKI', emotion: 'Kaygı → panik → çaresizlik', cause: 'Yeni masraflar, hesap tutmuyor' },
      { scene: 'TERS KÖŞE', emotion: 'Umut kırıntısı → şok → kendisiyle dalga geçen kabulleniş', cause: 'Kahve ödemesi reddedilir; kart ekstresi = kahveler' },
    ],
  };
}
