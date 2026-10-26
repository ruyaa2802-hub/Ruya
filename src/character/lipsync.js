// Text-driven Turkish lip sync. Turkish spelling is phonemic, so letters map
// almost 1:1 to mouth shapes. Produces morph weights for any time t; the line
// timings double as cue points for recording a real voice later.
import { clamp, smoothstep } from '../core/util.js';

const VISEME = {
  a: { jawOpen: 0.5, wide: 0.12 },
  e: { jawOpen: 0.3, wide: 0.42 },
  ı: { jawOpen: 0.18, wide: 0.3 },
  i: { jawOpen: 0.16, wide: 0.52 },
  o: { jawOpen: 0.36, pucker: 0.5 },
  ö: { jawOpen: 0.28, pucker: 0.55 },
  u: { jawOpen: 0.14, pucker: 0.8 },
  ü: { jawOpen: 0.12, pucker: 0.85 },
  m: { press: 0.85 }, b: { press: 0.8 }, p: { press: 0.9 },
  f: { fv: 0.85, jawOpen: 0.06 }, v: { fv: 0.75, jawOpen: 0.06 },
  s: { jawOpen: 0.07, wide: 0.35 }, z: { jawOpen: 0.07, wide: 0.32 }, ş: { jawOpen: 0.1, pucker: 0.35 },
  ç: { jawOpen: 0.1, pucker: 0.3 }, c: { jawOpen: 0.1, pucker: 0.25 }, j: { jawOpen: 0.1, pucker: 0.3 },
  t: { jawOpen: 0.14 }, d: { jawOpen: 0.15 }, n: { jawOpen: 0.13 }, l: { jawOpen: 0.18 }, r: { jawOpen: 0.15 },
  k: { jawOpen: 0.2 }, g: { jawOpen: 0.2 }, h: { jawOpen: 0.25 }, y: { jawOpen: 0.15, wide: 0.3 }, ğ: {},
};
const VOWELS = 'aeıioöuü';

export function buildLine(text, start, end) {
  const s = text.toLocaleLowerCase('tr-TR').replace(/[^a-zçğıöşü ]/g, '');
  const units = [];
  for (const ch of s) {
    if (ch === ' ') { units.push({ ch, w: 0.35 }); continue; }
    units.push({ ch, w: VOWELS.includes(ch) ? 1.0 : ch === 'ğ' ? 0.4 : 0.55 });
  }
  const tot = units.reduce((a, u) => a + u.w, 0);
  let t = start;
  const keys = [];
  for (const u of units) {
    const d = ((end - start) * u.w) / tot;
    keys.push({ t0: t, t1: t + d, v: u.ch === ' ' ? {} : VISEME[u.ch] || { jawOpen: 0.12 } });
    t += d;
  }
  return { text, start, end, keys };
}

// coarticulated weights at time t: each viseme is a soft bump that overlaps
// its neighbours (~60 ms ramps)
export function visemesAt(lines, t) {
  const out = {};
  let active = 0;
  for (const L of lines) {
    if (t < L.start - 0.15 || t > L.end + 0.15) continue;
    for (const k of L.keys) {
      const mid = (k.t0 + k.t1) / 2, half = Math.max(0.04, (k.t1 - k.t0) / 2);
      const w = smoothstep(mid - half - 0.06, mid - half * 0.3, t) * (1 - smoothstep(mid + half * 0.3, mid + half + 0.06, t));
      if (w <= 0) continue;
      for (const [m, v] of Object.entries(k.v)) out[m] = Math.max(out[m] || 0, v * w);
    }
    active = Math.max(active, smoothstep(L.start - 0.1, L.start, t) * (1 - smoothstep(L.end, L.end + 0.12, t)));
  }
  if (out.press) out.jawOpen = (out.jawOpen || 0) * (1 - out.press);
  out._active = active;
  return out;
}
