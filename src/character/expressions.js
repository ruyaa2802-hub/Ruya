// Emotion presets: face morphs + lids + body posture offsets.
// Body channels (radians/metres) are additive offsets on top of the action.
export const EXPRESSIONS = {
  neutral: { morphs: {}, lids: 0.95, lower: 0.05, body: {} },
  tired: {
    morphs: { browInnerUp: 0.15, frownL: 0.12, frownR: 0.1, press: 0.1 },
    lids: 0.68, lower: 0.12,
    body: { slump: 0.35, headPitch: 0.04, breathRate: 11, breathDepth: 0.8 },
  },
  hopeful: {
    morphs: { browInnerUp: 0.35, browOuterUpL: 0.4, browOuterUpR: 0.35, smileL: 0.22, smileR: 0.2, jawOpen: 0.07 },
    lids: 1.12, lower: 0.05,
    body: { slump: 0.05, headPitch: -0.02, breathRate: 15, breathDepth: 1.1 },
  },
  relief: {
    morphs: { smileL: 0.42, smileR: 0.38, squintL: 0.25, squintR: 0.22, browInnerUp: 0.18, cheekPuff: 0.0 },
    lids: 0.82, lower: 0.25,
    body: { slump: 0.1, headPitch: -0.04, breathRate: 10, breathDepth: 1.3 },
  },
  content: {
    morphs: { smileL: 0.55, smileR: 0.45, squintL: 0.35, squintR: 0.3, browOuterUpL: 0.08 },
    lids: 0.86, lower: 0.3,
    body: { slump: 0.0, headPitch: -0.05, headRoll: 0.05, breathRate: 11, breathDepth: 1.0 },
  },
  doubt: {
    morphs: { browDown: 0.35, browInnerUp: 0.25, browOuterUpL: 0.2, press: 0.25, frownL: 0.12, frownR: 0.18, smileL: 0.05 },
    lids: 0.9, lower: 0.28,
    body: { slump: 0.05, headPitch: 0.06, headFwd: 0.4, breathRate: 13, breathDepth: 0.7 },
  },
  anxious: {
    morphs: { browInnerUp: 0.75, browDown: 0.15, frownL: 0.3, frownR: 0.32, press: 0.3, wide: 0.12 },
    lids: 1.12, lower: 0.15,
    body: { slump: 0.1, shoulderRaise: 0.06, headPitch: 0.05, breathRate: 22, breathDepth: 0.65 },
  },
  panic: {
    morphs: { browInnerUp: 0.95, browOuterUpL: 0.3, browOuterUpR: 0.35, wide: 0.35, frownL: 0.25, frownR: 0.25, jawOpen: 0.14 },
    lids: 1.25, lower: 0.0,
    body: { slump: 0.0, shoulderRaise: 0.09, headPitch: 0.02, breathRate: 30, breathDepth: 0.6 },
  },
  despair: {
    morphs: { browInnerUp: 0.85, frownL: 0.45, frownR: 0.42, jawOpen: 0.04, press: 0.05 },
    lids: 0.58, lower: 0.1,
    body: { slump: 0.75, shoulderRaise: -0.04, headPitch: 0.12, breathRate: 9, breathDepth: 1.2 },
  },
  hopeSmall: {
    morphs: { smileL: 0.3, smileR: 0.22, browInnerUp: 0.3, browOuterUpL: 0.15 },
    lids: 1.0, lower: 0.15,
    body: { slump: 0.15, headPitch: 0.03, breathRate: 14, breathDepth: 0.9 },
  },
  shock: {
    morphs: { browInnerUp: 0.6, browOuterUpL: 0.65, browOuterUpR: 0.6, jawOpen: 0.22, wide: 0.05 },
    lids: 1.28, lower: 0.0,
    body: { slump: 0.0, shoulderRaise: 0.05, headPitch: -0.03, breathRate: 4, breathDepth: 0.2 },
  },
  // defeated, self-mocking acceptance: asymmetric closed smile, sad brows
  defeated: {
    morphs: { smileL: 0.48, smileR: 0.22, browInnerUp: 0.62, squintL: 0.25, squintR: 0.12, press: 0.18 },
    lids: 0.74, lower: 0.25,
    body: { slump: 0.45, headPitch: 0.02, headRoll: -0.08, breathRate: 9, breathDepth: 1.0 },
  },
  grimace: {
    morphs: { wide: 0.3, frownL: 0.3, frownR: 0.35, sneer: 0.5, squintL: 0.4, squintR: 0.45, browDown: 0.4, press: 0.2 },
    lids: 0.6, lower: 0.45,
    body: { slump: 0.2, headPitch: 0.0, breathRate: 10, breathDepth: 0.8 },
  },
};

export function blendExpr(list) {
  // list: [[preset, weight], ...]
  const out = { morphs: {}, lids: 0, lower: 0, body: {} };
  let tot = 0;
  for (const [p, w] of list) tot += w;
  tot = tot || 1;
  for (const [p, w0] of list) {
    const w = w0 / tot;
    for (const [k, v] of Object.entries(p.morphs || {})) out.morphs[k] = (out.morphs[k] || 0) + v * w;
    out.lids += (p.lids ?? 0.95) * w;
    out.lower += (p.lower ?? 0.05) * w;
    for (const [k, v] of Object.entries(p.body || {})) out.body[k] = (out.body[k] || 0) + v * w;
  }
  // body keys missing in some presets fall back to neutral defaults
  return out;
}

export function faceFromEmotion(p) {
  return {
    morphs: { ...(p.morphs || {}) },
    lids: { L: p.lids ?? 0.95, R: p.lids ?? 0.95 },
    lower: { L: p.lower ?? 0.05, R: p.lower ?? 0.05 },
  };
}
