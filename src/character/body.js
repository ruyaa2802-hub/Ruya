// Clothed body built as skinned sweeps on one shared skeleton:
// hoodie (torso + sleeves + hood + drawstrings), joggers, socks, neck, hands.
import * as THREE from 'three';
import { GeoBuilder, sweep, chainWeights, V } from './rig.js';
import { smoothstep, lerp, clamp } from '../core/util.js';

const prof = (pts, y) => {
  if (y <= pts[0][0]) return pts[0].slice(1);
  for (let i = 1; i < pts.length; i++) {
    if (y <= pts[i][0]) {
      const t = (y - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]);
      const u = t * t * (3 - 2 * t);
      return pts[i].slice(1).map((v, k) => lerp(pts[i - 1][k + 1], v, u));
    }
  }
  return pts[pts.length - 1].slice(1);
};

export function buildBody(sk, mats) {
  const I = sk.index, W = sk.restWorld;
  const meshes = {};

  // ---------------- hoodie ----------------
  const H = new GeoBuilder();
  const torsoProfile = [
    // y, rx, rz, zOffset
    [0.8, 0.156, 0.11, 0.0], [0.865, 0.158, 0.112, 0.0], [0.95, 0.158, 0.11, 0.004], [1.05, 0.161, 0.113, 0.006],
    [1.16, 0.164, 0.118, 0.006], [1.26, 0.171, 0.124, 0.008], [1.34, 0.175, 0.12, 0.004], [1.39, 0.172, 0.112, -0.002],
    [1.425, 0.168, 0.104, -0.005], [1.46, 0.148, 0.09, -0.006], [1.49, 0.1, 0.082, -0.004], [1.53, 0.083, 0.076, 0.004],
  ];
  const torsoW = (q) => {
    const y = q.y;
    const w = [];
    const band = (a, b, x) => smoothstep(a, b, x);
    const hipsW = 1 - band(0.98, 1.07, y);
    const chestW = band(1.17, 1.28, y);
    const neckW = band(1.47, 1.52, y) * 0.6;
    const spineW = clamp(1 - hipsW - chestW);
    const clav = smoothstep(0.09, 0.17, Math.abs(q.x)) * smoothstep(1.33, 1.44, y) * 0.75;
    const cl = q.x > 0 ? I['clavicle.L'] : I['clavicle.R'];
    if (hipsW > 0.001) w.push([I.hips, hipsW]);
    if (spineW > 0.001) w.push([I.spine, spineW]);
    if (chestW > 0.001) w.push([I.chest, chestW * (1 - clav) * (1 - neckW)]);
    if (clav > 0.001) w.push([cl, chestW * clav]);
    if (neckW > 0.001) w.push([I.neck, chestW * neckW]);
    return w.length ? w : [[I.hips, 1]];
  };
  const torsoAO = (s, a) => {
    const y = lerp(0.8, 1.53, s);
    const side = Math.abs(Math.cos(a));
    const pit = smoothstep(0.9, 1.0, side) * smoothstep(1.25, 1.38, y) * smoothstep(1.46, 1.4, y);
    const hem = smoothstep(0.87, 0.86, y) * 0.1;
    const pocketSeam = Math.sin(a) > 0 ? Math.exp(-(((y - 1.075) / 0.006) ** 2)) * smoothstep(0.75, 0.4, side) * 0.25 : 0;
    const v = 1 - pit * 0.35 - hem - pocketSeam;
    return [v, v, v];
  };
  sweep(H, {
    path: [V(0, 0.8, 0), V(0, 1.53, 0)], samples: 44, radial: 48, power: 2.5, caps: [false, false],
    ref: V(0, 0, 1),
    radius: (s, a) => {
      const [rx, rz] = prof(torsoProfile, lerp(0.8, 1.53, s));
      // chest flatter at back, rounder front
      const front = Math.sin(a) > 0 ? 1 : 0.93;
      return [rx, rz * front];
    },
    offset: (s, a) => {
      const y = lerp(0.8, 1.53, s);
      const [, , , zo] = prof(torsoProfile, y);
      const off = V(0, 0, zo);
      // kangaroo pocket bulge
      const sa = Math.sin(a), ca = Math.cos(a);
      if (sa > 0) off.z += 0.007 * smoothstep(0.93, 0.96, y) * smoothstep(1.09, 1.07, y) * smoothstep(0.75, 0.45, Math.abs(ca));
      // soft vertical folds of fabric
      off.x += 0.0025 * Math.sin(a * 7 + y * 9) * smoothstep(1.2, 0.85, y) * ca;
      off.z += 0.0025 * Math.sin(a * 7 + y * 9) * smoothstep(1.2, 0.85, y) * sa;
      return off;
    },
    weights: (s, q) => torsoW(q),
    color: torsoAO,
    uvScale: [3, 2.5],
  });
  // sleeves
  for (const s of [1, -1]) {
    const L = s > 0 ? 'L' : 'R';
    const inner = V(s * 0.125, 1.39, -0.015);
    const sh = W['upperArm.' + L], el = W['foreArm.' + L], wr = W['hand.' + L];
    const end = wr.clone().add(V(0, -0.012, 0));
    const lens = [inner.distanceTo(sh), sh.distanceTo(el), el.distanceTo(wr), wr.distanceTo(end)];
    const tot = lens.reduce((a, b) => a + b, 0);
    const s1 = lens[0] / tot, s2 = (lens[0] + lens[1]) / tot, s3 = (lens[0] + lens[1] + lens[2]) / tot;
    const cw = chainWeights([[0, I['clavicle.' + L]], [s1, I['upperArm.' + L]], [s2, I['foreArm.' + L]], [s3 - 0.004, I['hand.' + L]]], 0.07);
    sweep(H, {
      path: [inner, sh, el, wr, end], samples: 40, radial: 28, caps: [true, false], ref: V(0, 0, 1),
      radius: (u) => {
        let r;
        if (u < s1) r = 0.043;
        else if (u < s2) r = lerp(0.046, 0.049, smoothstep(s1, s1 + 0.15, u)) - 0.002 * smoothstep(s1 + 0.15, s2, u);
        else r = lerp(0.051, 0.046, (u - s2) / (s3 - s2));
        // ribbed cuff
        r = lerp(r, 0.038, smoothstep(s3 - 0.07, s3 - 0.04, u));
        r -= 0.002 * smoothstep(s3 - 0.005, 1, u);
        return [r * 1.04, r * 0.96];
      },
      offset: (u, a) => {
        // gathered wrinkles above the cuff and around the elbow
        const nearCuff = Math.exp(-(((u - (s3 - 0.09)) / 0.04) ** 2));
        const nearElbow = Math.exp(-(((u - s2) / 0.05) ** 2));
        const w = 0.003 * nearCuff * Math.sin(a * 5 + u * 60) + 0.0025 * nearElbow * Math.sin(a * 3 + u * 40);
        return V(Math.cos(a) * w, 0, Math.sin(a) * w);
      },
      weights: (u) => cw(u),
      color: (u, a) => {
        const v = 1 - 0.12 * Math.exp(-(((u - s2) / 0.03) ** 2)) * (Math.sin(a) > 0 ? 1 : 0.3) - 0.08 * smoothstep(s3 - 0.075, s3 - 0.07, u) * smoothstep(s3 - 0.06, s3 - 0.065, u);
        return [v, v, v];
      },
      uvScale: [1.5, 3],
    });
  }
  // hood bunched around the back of the neck
  sweep(H, {
    path: [V(0.105, 1.465, 0.035), V(0.115, 1.495, -0.045), V(0.0, 1.52, -0.1), V(-0.115, 1.495, -0.045), V(-0.105, 1.465, 0.035)],
    samples: 30, radial: 16, caps: [true, true], ref: V(0, 1, 0),
    radius: (u) => {
      const back = Math.sin(u * Math.PI);
      return [0.02 + 0.022 * back, 0.015 + 0.016 * back];
    },
    weights: (u, q) => [[I.chest, 0.75], [I.neck, 0.25]],
    color: (u, a) => [0.92, 0.92, 0.92],
    uvScale: [2, 2],
  });
  meshes.hoodie = H.build();

  // drawstrings (separate thin cords)
  const D = new GeoBuilder();
  for (const s of [1, -1]) {
    sweep(D, {
      path: [V(s * 0.04, 1.49, 0.07), V(s * 0.045, 1.42, 0.112), V(s * 0.047, 1.32, 0.13)],
      samples: 10, radial: 8, caps: [false, true], ref: V(0, 0, 1),
      radius: (u) => (u > 0.93 ? 0.0055 : 0.003),
      weights: () => [[I.chest, 1]],
    });
  }
  meshes.cords = D.build();

  // ---------------- joggers ----------------
  const P = new GeoBuilder();
  sweep(P, {
    path: [V(0, 1.0, -0.005), V(0, 0.79, -0.01)], samples: 14, radial: 40, power: 2.4, caps: [false, true], ref: V(0, 0, 1),
    radius: (u) => [lerp(0.16, 0.152, u), lerp(0.108, 0.104, u)],
    capLength: () => 0.05,
    weights: () => [[I.hips, 1]],
    uvScale: [3, 1],
  });
  for (const s of [1, -1]) {
    const L = s > 0 ? 'L' : 'R';
    const top = V(s * 0.088, 0.99, -0.005), hip = W['thigh.' + L], knee = W['shin.' + L], ank = W['foot.' + L];
    const end = ank.clone().add(V(0, 0.012, 0));
    const l = [top.distanceTo(hip), hip.distanceTo(knee), knee.distanceTo(end)];
    const tot = l[0] + l[1] + l[2];
    const sA = l[0] / tot, sB = (l[0] + l[1]) / tot;
    const cw = chainWeights([[0, I.hips], [sA, I['thigh.' + L]], [sB, I['shin.' + L]]], 0.06);
    sweep(P, {
      path: [top, hip, knee, end], samples: 40, radial: 30, caps: [true, false], ref: V(0, 0, 1),
      radius: (u, a) => {
        let r;
        if (u < sA) r = 0.083;
        else if (u < sB) r = lerp(0.082, 0.059, smoothstep(sA, sB, u));
        else r = lerp(0.06, 0.05, (u - sB) / (1 - sB));
        r = lerp(r, 0.043, smoothstep(0.93, 0.97, u)); // ribbed ankle cuff
        // glutes / calf
        const back = -Math.sin(a);
        r += 0.008 * Math.max(0, back) * Math.exp(-(((u - sA) / 0.08) ** 2));
        r += 0.005 * Math.max(0, back) * Math.exp(-(((u - (sB + 0.12)) / 0.07) ** 2));
        return [r, r * 1.03];
      },
      offset: (u, a) => {
        const k = Math.exp(-(((u - sB) / 0.05) ** 2)) * 0.0025 * Math.sin(a * 4 + u * 50);
        const c = Math.exp(-(((u - 0.9) / 0.04) ** 2)) * 0.003 * Math.sin(a * 5 + u * 70);
        return V(Math.cos(a) * (k + c), 0, Math.sin(a) * (k + c));
      },
      weights: (u) => cw(u),
      color: (u, a) => {
        const crotch = Math.cos(a) * -s > 0.6 && u < sA + 0.05 ? 0.8 : 1;
        const v = crotch * (1 - 0.1 * Math.exp(-(((u - sB) / 0.02) ** 2)) * (Math.sin(a) < 0 ? 1 : 0));
        return [v, v, v];
      },
      uvScale: [1.5, 4],
    });
  }
  meshes.pants = P.build();

  // ---------------- socks ----------------
  const S = new GeoBuilder();
  for (const s of [1, -1]) {
    const L = s > 0 ? 'L' : 'R';
    const ank = W['foot.' + L];
    sweep(S, {
      path: [ank.clone().add(V(0, 0.07, 0.005)), ank.clone().add(V(0, -0.02, -0.005))], samples: 6, radial: 20, caps: [false, false], ref: V(0, 0, 1),
      radius: () => [0.04, 0.043],
      weights: (u) => [[I['shin.' + L], 1 - u * 0.7], [I['foot.' + L], u * 0.7]],
    });
    const heel = V(s * 0.1, 0.045, -0.085), toe = V(s * 0.108, 0.034, 0.168);
    sweep(S, {
      path: [heel, V(s * 0.102, 0.05, 0.0), V(s * 0.106, 0.042, 0.1), toe], samples: 24, radial: 24, caps: [true, true], ref: V(0, 1, 0),
      radius: (u, a) => {
        const w = lerp(0.036, 0.047, smoothstep(0, 0.7, u)) * lerp(1, 0.78, smoothstep(0.82, 1, u));
        const h = lerp(0.045, 0.026, smoothstep(0.2, 1, u));
        return [w, h];
      },
      offset: (u, a) => {
        // flatten the sole
        const sa = Math.sin(a);
        return V(0, sa < 0 ? -sa * 0.012 * smoothstep(0.1, 0.3, u) : 0, 0);
      },
      capLength: (dir) => (dir < 0 ? 0.03 : 0.03),
      weights: () => [[I['foot.' + L], 1]],
    });
  }
  meshes.socks = S.build();

  // ---------------- skin: neck + hands ----------------
  const K = new GeoBuilder();
  sweep(K, {
    path: [V(0, 1.4, -0.012), V(0, 1.56, 0.002), V(0, 1.62, 0.02)], samples: 14, radial: 28, caps: [false, false], ref: V(0, 0, 1),
    radius: (u, a) => {
      const r = lerp(0.068, 0.06, smoothstep(0, 0.6, u));
      return [r * 1.02, r * 1.07];
    },
    offset: (u, a) => V(0, 0, Math.sin(a) > 0 ? 0.004 * Math.exp(-(((u - 0.55) / 0.15) ** 2)) * Math.sin(a) : 0), // adam's apple
    weights: (u) => {
      if (u < 0.35) return [[I.chest, 1 - u / 0.35 * 0.5], [I.neck, u / 0.35 * 0.5]];
      if (u < 0.72) return [[I.neck, 1]];
      return [[I.neck, 1 - (u - 0.72) / 0.28], [I.head, (u - 0.72) / 0.28]];
    },
  });
  for (const s of [1, -1]) {
    const L = s > 0 ? 'L' : 'R';
    const wr = W['hand.' + L];
    // palm
    const fingersBase = ['index', 'middle', 'ring', 'pinky'].map((f) => ({ f, p: W[`${f}0.${L}`] }));
    sweep(K, {
      path: [wr.clone().add(V(0, 0.012, 0.002)), wr.clone().add(V(0, -0.05, 0.002)), wr.clone().add(V(0, -0.093, 0.0))],
      samples: 14, radial: 26, power: 3, caps: [false, true], ref: V(0, 0, 1),
      radius: (u, a) => {
        const width = lerp(0.031, 0.043, smoothstep(0.1, 0.8, u));
        const thick = lerp(0.016, 0.0135, u);
        return [thick, width];
      },
      capLength: () => 0.008,
      offset: (u, a, q) => {
        // thenar pad on the palm side near the thumb
        const palmSide = s * Math.cos(a); // palm faces -s*X, sweep X axis is -X
        const toward = smoothstep(0.0, 0.025, q.z - wr.z);
        const pad = 0.0055 * Math.exp(-(((u - 0.42) / 0.22) ** 2)) * toward * Math.max(0, palmSide);
        return V(-s * pad, 0, 0);
      },
      weights: (u, q) => {
        if (u < 0.78) return [[I['hand.' + L], 1]];
        let best = fingersBase[0], bd = 1e9;
        for (const fb of fingersBase) { const dd = Math.abs(fb.p.z - q.z); if (dd < bd) { bd = dd; best = fb; } }
        const t = smoothstep(0.78, 1.0, u) * 0.45;
        return [[I['hand.' + L], 1 - t], [I[`${best.f}0.${L}`], t]];
      },
      color: (u, a) => {
        const back = s * Math.cos(a) < 0; // knuckle side darker/redder slightly
        const v = back ? 0.97 : 1.0;
        return [v, v * 0.97, v * 0.97];
      },
    });
    const fingerR = { index: 0.0086, middle: 0.0088, ring: 0.0083, pinky: 0.0074, thumb: 0.0105 };
    for (const f of ['index', 'middle', 'ring', 'pinky', 'thumb']) {
      const j = [0, 1, 2].map((k) => W[`${f}${k}.${L}`]);
      const tip = W[`${f}Tip.${L}`];
      const start = f === 'thumb' ? j[0].clone().lerp(j[1], 0.1) : j[0].clone().add(V(0, 0.012, 0));
      const pts = [start, ...j.slice(f === 'thumb' ? 1 : 0), tip];
      if (f !== 'thumb') pts.splice(1, 0); // keep
      const path = f === 'thumb' ? [start, j[1], j[2], tip] : [start, j[0], j[1], j[2], tip];
      const lens = [];
      for (let k = 1; k < path.length; k++) lens.push(path[k].distanceTo(path[k - 1]));
      const tot = lens.reduce((a, b) => a + b, 0);
      const cum = [0];
      lens.forEach((l, k) => cum.push(cum[k] + l / tot));
      const stops = f === 'thumb'
        ? [[0, I[`thumb0.${L}`]], [cum[1], I[`thumb1.${L}`]], [cum[2], I[`thumb2.${L}`]]]
        : [[0, I['hand.' + L]], [cum[1], I[`${f}0.${L}`]], [cum[2], I[`${f}1.${L}`]], [cum[3], I[`${f}2.${L}`]]];
      const cw = chainWeights(stops, 0.07);
      const r0 = fingerR[f];
      sweep(K, {
        path, samples: 26, radial: 14, caps: [false, true], ref: V(s, 0, 0),
        radius: (u, a) => {
          let r = r0 * lerp(1.0, 0.82, u);
          if (f === 'thumb') r *= lerp(1.25, 0.9, smoothstep(0, 0.4, u));
          // knuckle bulges
          for (let k = 2; k < cum.length - 1; k++) r += r0 * 0.07 * Math.exp(-(((u - cum[k]) / 0.04) ** 2));
          return [r, r * 0.92];
        },
        capLength: () => r0 * 0.9,
        weights: (u) => cw(u),
        color: (u, a) => {
          // nail bed on the back of the last segment
          const back = Math.sin(a) > 0.55;
          const nail = back && u > cum[cum.length - 2] + 0.03 ? 1 : 0;
          const crease = 0.06 * cum.slice(1, -1).reduce((acc, c) => acc + Math.exp(-(((u - c) / 0.012) ** 2)), 0);
          return [1 + nail * 0.08 - crease, 1 + nail * 0.02 - crease * 1.2, 1 + nail * 0.05 - crease * 1.1];
        },
      });
    }
  }
  meshes.skin = K.build();

  const out = {};
  const make = (name, geo, mat) => {
    const m = new THREE.SkinnedMesh(geo, mat);
    m.name = name;
    m.castShadow = true; m.receiveShadow = true;
    m.frustumCulled = false;
    out[name] = m;
    return m;
  };
  make('hoodie', meshes.hoodie, mats.hoodie);
  make('cords', meshes.cords, mats.cords);
  make('pants', meshes.pants, mats.pants);
  make('socks', meshes.socks, mats.socks);
  make('skin', meshes.skin, mats.bodySkin);
  return out;
}
