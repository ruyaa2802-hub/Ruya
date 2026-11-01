const CELL = %%CELLDATA%%;
const CPOS = %%CPOS%%;
const CAPS = %%CAPLIST%%;
const KELPX = [20,160,420,560,700,880,1040];
const GILLS = {axGillL1:[215,300],axGillL2:[196,352],axGillL3:[212,408],axGillR1:[585,300],axGillR2:[604,352],axGillR3:[588,408]};
const TOTAL = 47;
const tl = gsap.timeline({ paused: true });
const q = (s) => document.querySelector(s);

/* ---------- helpers ---------- */
function spark(i, x, y, t, s) {
  tl.fromTo("#sp" + i, { x: x, y: y, scale: 0, opacity: 1, rotation: -30 }, { scale: s || 1, rotation: 25, duration: 0.35, ease: "back.out(3)" }, t);
  tl.to("#sp" + i, { scale: 0, opacity: 0, rotation: 70, duration: 0.4, ease: "power2.in" }, t + 0.38);
}
function pop(sel, t, hold, opts) {
  opts = opts || {};
  tl.fromTo(sel, { opacity: 0, y: opts.fromY === undefined ? 30 : opts.fromY, scale: opts.fromS || 0.7 }, { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: "back.out(2.2)" }, t);
  tl.to(sel, { opacity: 0, y: -10, scale: 0.96, duration: 0.3, ease: "power2.in" }, t + hold);
}

/* ---------- initial states ---------- */
tl.set("#axo", { x: 470, y: 330, scale: 0.5, rotation: 14, transformOrigin: "50% 50%" }, 0);

/* ---------- ambient: bubbles, kelp, rays, fish ---------- */
for (let i = 0; i < 34; i++) {
  const dur = 7 + (i % 6);
  const base = 40 + (i * 173) % 1000;
  const p = ((i * 1.9) % dur) / dur;
  let t = 0, first = true;
  while (t < TOTAL) {
    const d = first ? dur * (1 - p) : dur;
    const y0 = first ? 2000 - p * 2100 : 2000;
    tl.fromTo("#bub" + i, { y: y0, x: base - 12 }, { y: -100, x: base + 12, duration: d, ease: "none" }, t);
    t += d; first = false;
  }
}
KELPX.forEach((kx, k) => {
  for (let t = 0, n = 0; t < TOTAL; t += 1.6, n++) {
    tl.to("#kelp" + k, { rotation: (n % 2 ? 1 : -1) * (3 + (k % 3)), svgOrigin: kx + " 1800", duration: 1.6, ease: "sine.inOut" }, t);
  }
});
["#leafL", "#leafL2", "#leafR", "#leafR2"].forEach((s, k) => {
  for (let t = 0, n = 0; t < TOTAL; t += 2, n++) tl.to(s, { rotation: (n % 2 ? 1 : -1) * 2.6, svgOrigin: (k < 2 ? "40 1920" : "1040 1920"), duration: 2, ease: "sine.inOut" }, t);
});
tl.to("#rays", { x: 70, duration: TOTAL, ease: "sine.inOut" }, 0);
function fishRun(id, t0, t1, y0, y1, sc, flip) {
  const sx = flip ? -sc : sc;
  tl.fromTo("#" + id + "w", { x: flip ? 1400 : -300, y: y0, scaleX: sx, scaleY: sc }, { x: flip ? -300 : 1400, y: y1, duration: t1 - t0, ease: "none" }, t0);
}
fishRun("fishA", 0.6, 7.4, 720, 640, 0.5, false);
fishRun("fishB", 27.4, 36.0, 520, 600, 0.6, true);
fishRun("fishC", 36.3, 46.5, 1240, 1160, 0.46, false);
fishRun("fishD", 28.5, 35.5, 1560, 1500, 0.5, false);
fishRun("fishA", 37.5, 46.8, 460, 380, 0.4, true);

/* ---------- axolotl idle loops ---------- */
for (let t = 0, n = 0; t < TOTAL; t += 1.2, n++) tl.to("#axBob", { y: (n % 2 ? 12 : -12), rotation: (n % 2 ? 1.5 : -1.5), duration: 1.2, ease: "sine.inOut" }, t);
for (let t = 0, n = 0; t < TOTAL; t += 0.8, n++) {
  const fast = (t < 4.6) || (t > 27 && t < 32) || (t > 36 && t < 44);
  tl.to("#axTail", { rotation: (n % 2 ? 1 : -1) * (fast ? 11 : 5), svgOrigin: "400 690", duration: 0.8, ease: "sine.inOut" }, t);
}
Object.keys(GILLS).forEach((g, k) => {
  const b = GILLS[g];
  for (let t = 0.1 * k, n = k; t < TOTAL; t += 0.7, n++) {
    const amp = (t > 27 && t < 36.5) ? 15 : (t < 4.6 || t > 36.5) ? 9 : 6;
    tl.to("#" + g, { rotation: (n % 2 ? 1 : -1) * amp, svgOrigin: b[0] + " " + b[1], duration: 0.7, ease: "sine.inOut" }, t);
  }
});
for (let t = 0, n = 0; t < TOTAL; t += 0.9, n++) {
  tl.to("#axLegL", { rotation: (n % 2 ? 1 : -1) * 8, svgOrigin: "248 712", duration: 0.9, ease: "sine.inOut" }, t);
}
[1.8, 3.4, 5.8, 8.2, 12.5, 16.0, 28.4, 31.8, 34.5, 38.2, 41.0, 44.4].forEach((t) => {
  tl.to("#axEyeL .blink, #axEyeR .blink", { scaleY: 0.08, transformOrigin: "50% 50%", duration: 0.09, ease: "power1.in" }, t);
  tl.to("#axEyeL .blink, #axEyeR .blink", { scaleY: 1, duration: 0.11, ease: "power1.out" }, t + 0.09);
});

/* ---------- SCENE 1 (0-7): entrance, approach, reach, title ---------- */
tl.to("#axo", { x: -40, y: 170, scale: 0.62, rotation: -6, duration: 2.6, ease: "sine.inOut" }, 0);
tl.to("#axo", { x: 0, y: 30, scale: 1.2, rotation: 0, duration: 1.8, ease: "power2.inOut" }, 2.6);
tl.to("#axSmile", { opacity: 0, duration: 0.08 }, 4.3);
tl.to("#axMouthOpen", { opacity: 1, duration: 0.08 }, 4.3);
tl.to(".big", { scale: 1.25, transformOrigin: "50% 50%", duration: 0.3, ease: "back.out(3)" }, 4.15);
tl.to("#axArmR", { scale: 2.0, x: -70, y: -40, rotation: -14, svgOrigin: "538 560", duration: 0.7, ease: "back.out(1.6)" }, 4.5);
tl.to("#axArmR", { rotation: 6, duration: 0.25, ease: "sine.inOut" }, 5.3);
tl.to("#axArmR", { rotation: -16, duration: 0.25, ease: "sine.inOut" }, 5.55);
tl.to("#axArmR", { rotation: 4, duration: 0.25, ease: "sine.inOut" }, 5.8);
tl.to("#axArmR", { scale: 1, x: 0, y: 0, rotation: 0, duration: 0.6, ease: "power2.inOut" }, 6.4);
tl.to(".big", { scale: 1, duration: 0.3 }, 6.6);
tl.to("#axMouthOpen", { opacity: 0, duration: 0.1 }, 6.7);
tl.to("#axSmile", { opacity: 1, duration: 0.1 }, 6.7);
pop("#t1", 4.9, 2.1, { fromY: -120, fromS: 0.6 });
spark(0, 220, 700, 4.7, 1.1); spark(1, 880, 760, 4.85, 0.9); spark(2, 760, 1380, 5.0, 0.8);
tl.to("#bgW", { scale: 1.08, transformOrigin: "50% 50%", duration: 7, ease: "none" }, 0);
tl.to("#fgW", { scale: 1.16, transformOrigin: "50% 50%", duration: 7, ease: "none" }, 0);

/* ---------- SCENE 2 (7-17): look at leg, lens, regeneration ---------- */
tl.to("#axo", { x: -40, y: 420, scale: 0.75, rotation: 0, duration: 1.4, ease: "power2.inOut" }, 6.6);
tl.to("#axHeadAll", { rotation: -8, svgOrigin: "400 520", duration: 0.6, ease: "sine.inOut" }, 7.9);
tl.to(".pupil", { y: 14, x: 6, duration: 0.3, ease: "power2.out" }, 7.9);
tl.to("#axLegR", { scale: 0, svgOrigin: "552 712", duration: 0.35, ease: "back.in(2)" }, 8.3);
spark(3, 614, 1584, 8.3, 1.0);
tl.to("#dim", { opacity: 1, duration: 0.8 }, 7.6);
tl.to("#ptrG", { opacity: 1, duration: 0.4 }, 8.4);
tl.fromTo("#ptrLine", { strokeDashoffset: 0 }, { strokeDashoffset: -160, duration: 7, ease: "none" }, 8.4);
tl.fromTo("#lensG", { opacity: 0, scale: 0.4, svgOrigin: "540 610" }, { opacity: 1, scale: 1, svgOrigin: "540 610", duration: 0.7, ease: "back.out(1.6)" }, 8.0);
// stage A: plaster
tl.fromTo("#lPlaster", { opacity: 0, scale: 0.5, y: -40, svgOrigin: "540 798" }, { opacity: 1, scale: 1, y: 0, svgOrigin: "540 798", duration: 0.45, ease: "back.out(2)" }, 8.6);
tl.to("#lPlaster", { opacity: 0, rotation: 30, x: 80, y: -70, svgOrigin: "540 798", duration: 0.5, ease: "power2.in" }, 9.4);
spark(4, 540, 790, 9.5, 1.2);
tl.fromTo("#chA", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.4, ease: "back.out(2)" }, 8.5);
tl.to("#chA", { opacity: 0, duration: 0.25 }, 9.85);
// stage B: cells multiply
CPOS.forEach((p, i) => {
  tl.fromTo("#lc" + i, { opacity: 0, scale: 0, svgOrigin: p[0] + " " + p[1] }, { opacity: 1, scale: 1, svgOrigin: p[0] + " " + p[1], duration: 0.3, ease: "back.out(2.4)" }, 10.0 + i * 0.07);
  tl.to("#lc" + i, { scale: 1.35, svgOrigin: p[0] + " " + p[1], duration: 0.2, ease: "sine.out", yoyo: true, repeat: 1 }, 11.2 + (i % 8) * 0.06);
});
tl.fromTo("#chB", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.4, ease: "back.out(2)" }, 9.95);
tl.to("#chB", { opacity: 0, duration: 0.25 }, 11.5);
pop("#tc1", 9.9, 1.6, { fromY: -20 });
// stage C: bud
CPOS.forEach((p, i) => {
  tl.to("#lc" + i, { x: 540 - p[0], y: 775 - p[1], scale: 0.4, opacity: 0, duration: 0.7, ease: "power2.in" }, 11.9 + (i % 6) * 0.03);
});
tl.fromTo("#lBud", { opacity: 0, scale: 0.3, svgOrigin: "540 810" }, { opacity: 1, scale: 1, svgOrigin: "540 810", duration: 0.8, ease: "elastic.out(1,0.5)" }, 12.3);
tl.to("#budGlow", { scale: 1.2, svgOrigin: "540 770", duration: 0.5, ease: "sine.inOut", yoyo: true, repeat: 1 }, 12.5);
spark(5, 540, 700, 12.5, 1.2);
tl.fromTo("#chC", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.4, ease: "back.out(2)" }, 12.0);
tl.to("#chC", { opacity: 0, duration: 0.25 }, 13.15);
// stage D: limb grows + tissues
tl.to("#lBud", { opacity: 0, scale: 1.6, svgOrigin: "540 810", duration: 0.6, ease: "power2.in" }, 13.1);
tl.fromTo("#lLimb", { opacity: 1, scaleY: 0.12, scaleX: 0.5, svgOrigin: "540 812" }, { opacity: 1, scaleY: 1, scaleX: 1, svgOrigin: "540 812", duration: 2.0, ease: "power2.out", immediateRender: false }, 13.0);
tl.fromTo("#chD", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.4, ease: "back.out(2)" }, 13.2);
tl.to("#chD", { opacity: 0, duration: 0.25 }, 16.1);
pop("#tc2", 13.0, 1.8, { fromY: -20 });
tl.to("#limbSkin", { opacity: 0.25, duration: 0.5 }, 14.4);
tl.to("#tBone", { opacity: 1, duration: 0.4 }, 14.5); tl.fromTo("#lab0", { opacity: 0, x: 20 }, { opacity: 1, x: 0, duration: 0.35 }, 14.55);
tl.to("#tMuscle", { opacity: 1, duration: 0.4 }, 14.9); tl.fromTo("#lab1", { opacity: 0, x: 20 }, { opacity: 1, x: 0, duration: 0.35 }, 14.95);
tl.to("#tNerve", { opacity: 1, duration: 0.4 }, 15.3); tl.fromTo("#lab2", { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.35 }, 15.35);
tl.fromTo("#lab3", { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.35 }, 15.7);
tl.to("#limbSkin", { opacity: 1, duration: 0.5 }, 15.7);
tl.to(["#tBone", "#tMuscle", "#tNerve", "#lab0", "#lab1", "#lab2", "#lab3"], { opacity: 0, duration: 0.5 }, 16.2);
spark(6, 540, 470, 15.9, 1.3); spark(7, 460, 520, 16.0, 0.9); spark(8, 620, 520, 16.05, 0.9);
// leg returns on the axolotl
tl.to("#axLegR", { scale: 1, svgOrigin: "552 712", duration: 0.6, ease: "elastic.out(1,0.45)" }, 16.0);
spark(9, 614, 1584, 16.0, 1.1);
tl.to(".pupil", { y: 0, x: 0, duration: 0.3 }, 16.0);
tl.to("#axHeadAll", { rotation: 0, svgOrigin: "400 520", duration: 0.5 }, 16.0);
tl.to("#ptrG", { opacity: 0, duration: 0.3 }, 16.1);
tl.to("#bgW", { scale: 1.14, duration: 9.5, ease: "none" }, 7.0);
tl.to("#fgW", { scale: 1.3, duration: 9.5, ease: "none" }, 7.0);

/* ---------- SCENE 3 (16.4-27): microscopic world ---------- */
tl.fromTo("#maskC", { attr: { r: 0 } }, { attr: { r: 1500 }, duration: 1.5, ease: "power2.in" }, 16.4);
tl.fromTo("#cellWorld", { scale: 2.6, svgOrigin: "540 610" }, { scale: 1, svgOrigin: "540 610", duration: 2.6, ease: "power3.out" }, 16.4);
tl.to(".dust", { y: -150, duration: 10, ease: "none", stagger: 0.06 }, 17);
tl.to(".bgc", { x: 50, y: -70, duration: 10, ease: "sine.inOut", stagger: 0.1 }, 17);
CELL.pos.forEach((p, i) => { tl.set("#cc" + i, { x: p[0], y: p[1] }, 0); });
for (let i = 0; i < 9; i++) {
  tl.fromTo("#cc" + i, { opacity: 0, scale: 0 }, { opacity: 1, scale: 1, duration: 0.45, ease: "back.out(2)" }, 18.5 + i * 0.07);
}
tl.fromTo("#ring circle:first-child", { opacity: 0.8, scale: 0.4, svgOrigin: "540 900" }, { opacity: 0, scale: 1.3, svgOrigin: "540 900", duration: 1.2, ease: "power2.out" }, 19.0);
tl.fromTo("#ringB", { opacity: 0.35, scale: 0.3, svgOrigin: "540 900" }, { opacity: 0, scale: 1.2, svgOrigin: "540 900", duration: 1.4, ease: "power2.out" }, 19.0);
pop("#blast", 19.3, 3.9, { fromY: -30, fromS: 0.5 });
spark(10, 300, 860, 19.5, 1.0); spark(11, 780, 1000, 19.8, 0.9);
for (let i = 9; i < 35; i++) {
  const par = i % 9, pp = CELL.pos[par], pi = CELL.pos[i];
  tl.fromTo("#cc" + i, { x: pp[0], y: pp[1], scale: 0, opacity: 1 }, { x: pi[0], y: pi[1], scale: 1, duration: 0.55, ease: "back.out(1.5)" }, 19.7 + (i - 9) * 0.07);
}
const KCOL = { bone: "#f7ecd0", muscle: "#ff6b6b", nerve: "#ffd23f", skin: "#ffa9c4" };
for (let i = 0; i < 35; i++) {
  tl.to("#cc" + i + " circle:first-child", { attr: { fill: KCOL[CELL.kind[i]] }, duration: 0.5, ease: "none" }, 22.3 + i * 0.03);
  tl.to("#cc" + i, { scale: 1.2, duration: 0.2, yoyo: true, repeat: 1, ease: "sine.inOut" }, 22.3 + i * 0.03);
}
tl.fromTo("#legend", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.5, ease: "back.out(2)" }, 22.6);
tl.to("#legend", { opacity: 0, duration: 0.4 }, 26.4);
for (let i = 0; i < 35; i++) {
  tl.to("#cc" + i, { x: CELL.tgt[i][0], y: CELL.tgt[i][1], scale: 0.85, duration: 1.3, ease: "power3.inOut" }, 24.2 + i * 0.025);
}
tl.to("#nerveLine", { opacity: 0.9, duration: 0.6 }, 25.8);
spark(12, 540, 690, 26.0, 1.2); spark(13, 540, 1280, 26.1, 1.0);
tl.set("#maskC", { attr: { cx: 540, cy: 960 } }, 26.35);
tl.to("#maskC", { attr: { r: 0 }, duration: 0.9, ease: "power2.in" }, 26.4);
tl.set("#dim", { opacity: 0 }, 26.4);
tl.set("#lensG", { opacity: 0 }, 26.4);

/* ---------- SCENE 4 (27-36): swim to camera, gills, adult ---------- */
tl.set("#axo", { x: -130, y: -300, scale: 0.28, rotation: -10 }, 26.4);
tl.to("#axo", { x: 160, y: -120, scale: 0.55, rotation: 6, duration: 1.8, ease: "sine.inOut" }, 26.9);
tl.to("#axo", { x: 0, y: 70, scale: 1.05, rotation: 0, duration: 2.0, ease: "power2.out" }, 28.7);
tl.to("#axSmile", { opacity: 0, duration: 0.08 }, 30.0); tl.to("#axMouthOpen", { opacity: 1, duration: 0.08 }, 30.0);
tl.to("#adult", { opacity: 0.45, duration: 1.2 }, 29.2);
tl.to("#adult", { x: 120, y: -40, duration: 6, ease: "sine.inOut" }, 29.2);
tl.to("#axo", { x: 640, y: 40, scale: 2.3, rotation: 0, duration: 2.0, ease: "power2.inOut" }, 31.4);
pop("#chG", 32.4, 2.0, { fromY: 20 });
spark(14 - 1, 330, 700, 32.6, 1.0);
tl.to("#axo", { x: 0, y: 60, scale: 1.0, duration: 1.8, ease: "power2.inOut" }, 34.4);
tl.to("#axMouthOpen", { opacity: 0, duration: 0.1 }, 35.6); tl.to("#axSmile", { opacity: 1, duration: 0.1 }, 35.6);
tl.to("#bgW", { scale: 1.1, transformOrigin: "50% 50%", duration: 0.01 }, 26.4);
tl.to("#fgW", { scale: 1.16, transformOrigin: "50% 50%", duration: 0.01 }, 26.4);
tl.to("#bgW", { scale: 1.2, x: -30, duration: 9.6, ease: "none" }, 26.5);
tl.to("#fgW", { scale: 1.4, x: -60, duration: 9.6, ease: "none" }, 26.5);

/* ---------- SCENE 5 (36-47): calm, warm light, pull back, final ---------- */
tl.to("#adult", { opacity: 0, duration: 1.0 }, 35.4);
tl.to("#axo", { x: -300, y: 300, scale: 0.55, rotation: -8, duration: 1.0, ease: "power2.inOut" }, 36.2);
tl.to("#axo", { x: 20, y: -60, scale: 0.5, rotation: 5, duration: 3.6, ease: "sine.inOut" }, 37.2);
tl.to("#axo", { x: 280, y: 160, scale: 0.55, rotation: -4, duration: 3.0, ease: "sine.inOut" }, 40.8);
tl.to("#axo", { x: 0, y: 60, scale: 1.0, rotation: 0, duration: 1.2, ease: "power2.inOut" }, 43.8);
tl.to("#axo", { scale: 1.12, y: 100, duration: 1.4, ease: "sine.inOut" }, 45.0);
tl.to("#axSmile", { opacity: 0, duration: 0.08 }, 44.0); tl.to("#axMouthOpen", { opacity: 1, duration: 0.08 }, 44.0);
tl.to(".big", { scale: 1.15, transformOrigin: "50% 50%", duration: 0.3, ease: "back.out(3)" }, 44.3);
tl.to("#bgW", { scale: 1.0, x: 0, duration: 10.4, ease: "sine.inOut" }, 36.4);
tl.to("#fgW", { scale: 1.0, x: 0, duration: 10.4, ease: "sine.inOut" }, 36.4);
tl.to("#warm", { opacity: 1, duration: 5, ease: "sine.inOut" }, 38);
pop("#tagM", 37.2, 3.6, { fromY: -20 });
pop("#tagN", 41.0, 2.6, { fromY: -20 });
tl.fromTo("#final", { opacity: 0, y: -100, scale: 0.6 }, { opacity: 1, y: 0, scale: 1, duration: 0.7, ease: "back.out(2)" }, 43.8);
spark(0, 200, 640, 44.3, 1.2); spark(1, 880, 700, 44.5, 1.1); spark(2, 300, 1300, 44.7, 1.0); spark(3, 800, 1260, 44.9, 1.1); spark(4, 540, 560, 45.2, 1.3);

/* ---------- captions (narration text) ---------- */
CAPS.forEach((c, i) => {
  const el = "#cap" + i;
  if (c[0] <= 0.05) tl.set(el, { opacity: 1 }, 0);
  else tl.fromTo(el, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.25, ease: "power2.out" }, c[0]);
  tl.to(el, { opacity: 0, duration: 0.2 }, c[1] - 0.2);
});

window.__timelines["main"] = tl;
tl.seek(0);
