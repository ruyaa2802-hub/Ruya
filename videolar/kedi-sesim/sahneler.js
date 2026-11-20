/* "Bir gün sesimi duymayacaksın" — kedinin gözünden kısa film.
 * Stil: sıcak, sulu boya dokulu el çizimi hikâye kitabı illüstrasyonu. Titreyen mürekkep kontur, kâğıt dokusu,
 * pencere ışığı, ön planda bulanık nesnelerle derinlik, bol yakın plan.
 * Kedi: kabarık turuncu-beyaz, yeşil gözlü (alında "M" çizgisi, beyaz burun-göğüs-pati). Her çekimde aynı fonksiyonlar.
 */
(function () {
  const { W, H, clamp, lerp, ease, ramp, pencere, rng, tuval, gurultuDokusu, yazi, FONT } = STUDIO.R;
  const TAU = Math.PI * 2;
  const A = {};
  const C = {
    kontur: '#4a3226', tur: '#e8913f', turK: '#c0652a', turA: '#f6b878', bey: '#f6e4c8', beyG: '#e2cdb0', pembe: '#eaa3a0',
    ten: '#f1c9a9', tenG: '#d9a07e', sac: '#3e2a20', pijama: '#9fb6cc', pijamaG: '#7f97b0',
    duvar: '#f0dfc4', duvarG: '#e2c9a6', ahsap: '#a8724c', ahsapK: '#7c4f34', yorgan: '#f7efe2', yorganG: '#dccbb4', yesil: '#8fae7e',
  };

  // ---------------- el çizimi yardımcıları ----------------
  let KARE = 0;
  function titre(seed, i, g) { const r = Math.sin(seed * 127.1 + i * 311.7 + KARE * 74.7) * 43758.5453; return ((r - Math.floor(r)) - 0.5) * 2 * g; }
  function yol(pts, seed, g = 1.4, kapali = true) {
    const p = pts.map(([x, y], i) => [x + titre(seed, i * 2, g), y + titre(seed, i * 2 + 1, g)]);
    const P = new Path2D();
    if (!kapali) { P.moveTo(...p[0]); for (let i = 1; i < p.length - 1; i++) P.quadraticCurveTo(p[i][0], p[i][1], (p[i][0] + p[i + 1][0]) / 2, (p[i][1] + p[i + 1][1]) / 2); P.lineTo(...p[p.length - 1]); return P; }
    const n = p.length, m = i => [(p[i % n][0] + p[(i + 1) % n][0]) / 2, (p[i % n][1] + p[(i + 1) % n][1]) / 2];
    P.moveTo(...m(0)); for (let i = 1; i <= n; i++) P.quadraticCurveTo(p[i % n][0], p[i % n][1], ...m(i)); P.closePath(); return P;
  }
  function elips(cx, cy, rx, ry, n = 20, rot = 0) { return Array.from({ length: n }, (_, i) => { const a = i / n * TAU, x = Math.cos(a) * rx, y = Math.sin(a) * ry; return [cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]; }); }
  const dik = (x, y, w, h) => [[x, y], [x + w / 2, y], [x + w, y], [x + w, y + h / 2], [x + w, y + h], [x + w / 2, y + h], [x, y + h], [x, y + h / 2]];
  // sulu boya dolgu: düz renk + leke dokusu + kenara doğru koyulaşma + ışık yönü
  function boya(ctx, pts, seed, renk, o = {}) {
    const P = yol(pts, seed, o.g ?? 1.4, true);
    ctx.save();
    ctx.fillStyle = renk; ctx.fill(P);
    ctx.clip(P);
    ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = o.doku ?? 0.35; ctx.drawImage(A.sulu, (seed * 37) % 400 - 400, (seed * 53) % 400 - 400, 1600, 1600);
    ctx.globalAlpha = 1;
    if (o.golge !== false) { ctx.globalCompositeOperation = 'multiply'; ctx.strokeStyle = o.golgeRenk || 'rgba(150,100,70,0.35)'; ctx.lineWidth = o.kenar ?? 26; ctx.filter = 'blur(10px)'; ctx.stroke(P); ctx.filter = 'none'; }
    if (o.isik) { ctx.globalCompositeOperation = 'screen'; const [lx, ly, lr] = o.isik; const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, lr); g.addColorStop(0, 'rgba(255,236,200,0.55)'); g.addColorStop(1, 'rgba(255,236,200,0)'); ctx.fillStyle = g; ctx.fill(P); }
    ctx.restore();
    if (o.kontur !== false) { ctx.strokeStyle = o.renkK || C.kontur; ctx.lineWidth = o.kal ?? 4; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(P); }
    return P;
  }
  function cizgi(ctx, pts, seed, kal = 4, renk = C.kontur) { ctx.strokeStyle = renk; ctx.lineWidth = kal; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(yol(pts, seed, 1.0, false)); }
  function tuyler(ctx, pts, seed, renk, kal = 2.5) {
    ctx.save(); ctx.strokeStyle = renk; ctx.lineWidth = kal; ctx.lineCap = 'round';
    for (let i = 0; i < pts.length; i++) { const [x, y, nx, ny, L] = pts[i]; ctx.beginPath(); ctx.moveTo(x - nx * 4, y - ny * 4); ctx.quadraticCurveTo(x + nx * L * 0.5 + ny * 3, y + ny * L * 0.5 - nx * 3, x + nx * L + ny * 5, y + ny * L - nx * 5); ctx.stroke(); }
    ctx.restore();
  }
  function elipsTuy(cx, cy, rx, ry, a0, a1, n, L, seed) {
    const r = rng(seed), out = [];
    for (let i = 0; i < n; i++) { const a = lerp(a0, a1, i / (n - 1)); out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, Math.cos(a), Math.sin(a), L * (0.6 + r() * 0.7)]); }
    return out;
  }
  function kamera(ctx, cx, cy, z, rot = 0) { ctx.translate(W / 2, H / 2); ctx.rotate(rot); ctx.scale(z, z); ctx.translate(-cx, -cy); }
  function bulanik(ctx, px, f) { ctx.save(); ctx.filter = `blur(${px}px)`; f(); ctx.restore(); }
  function kagit(ctx, sicak = 1) {
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.28; ctx.drawImage(A.kagit, 0, 0, W, H); ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = 0.25 * sicak; ctx.fillStyle = '#ffb46e'; ctx.fillRect(0, 0, W, H); ctx.restore();
    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75); v.addColorStop(0, 'rgba(60,30,15,0)'); v.addColorStop(1, 'rgba(60,30,15,0.35)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  }
  function huzme(ctx, x0, y0, x1, y1, gen, alfa, renk = '255,226,170') {
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = alfa;
    const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, `rgba(${renk},0.85)`); g.addColorStop(1, `rgba(${renk},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x0 - gen * 0.3, y0); ctx.lineTo(x0 + gen * 0.3, y0); ctx.lineTo(x1 + gen, y1); ctx.lineTo(x1 - gen, y1); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  function toz(ctx, t, n, alfa = 0.6) {
    const r = rng(17); ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < n; i++) { const x = (r() * 1100 + Math.sin(t * 0.3 + i) * 30 + t * 5) % 1100, y = (r() * 1700 + Math.cos(t * 0.25 + i * 2) * 40 - t * 6 * r() + 1700) % 1700;
      ctx.fillStyle = `rgba(255,236,200,${alfa * (0.3 + 0.7 * Math.sin(t * 0.8 + i) ** 2)})`; ctx.beginPath(); ctx.arc(x, y, 1.5 + r() * 3, 0, TAU); ctx.fill(); }
    ctx.restore();
  }

  // ======================= KEDİ: YAN GÖRÜNÜŞ =======================
  const POZ = {
    ayakta: { gx: -10, gy: -150, gr: 0, grx: 160, gry: 76, bx: 168, by: -228, kalx: -118, kaly: -142, kalca: 66, on: [64, -128, 78, 0], arka: [-118, -122, -128, 0], kk: [-168, -165], ka: -2.3, ke: 0.8 },
    otur: { gx: -36, gy: -150, gr: -1.0, grx: 128, gry: 80, bx: 58, by: -300, kalx: -72, kaly: -78, kalca: 86, on: [32, -170, 46, 0], arka: [-70, -50, -10, -2], kk: [-110, -26], ka: 0.25, ke: -0.55 },
    yat: { gx: -10, gy: -64, gr: 0.04, grx: 172, gry: 62, bx: 150, by: -108, kalx: -108, kaly: -66, kalca: 70, on: [80, -50, 196, -8], arka: [-110, -40, -20, -6], kk: [-168, -60], ka: 0.4, ke: -1.6 },
  };
  const kar = (a, b, u) => { const o = {}; for (const k in a) o[k] = Array.isArray(a[k]) ? a[k].map((v, i) => lerp(v, b[k][i], u)) : lerp(a[k], b[k], u); return o; };
  function renk(yas) {
    const m = (c1, c2) => { const a = c1.match(/\w\w/g).map(h => parseInt(h, 16)), b = c2.match(/\w\w/g).map(h => parseInt(h, 16)); return `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], yas * 0.35))).join(',')})`; };
    return { tur: m(C.tur, '#d8cfc4'), turK: m(C.turK, '#b8aca0'), bey: C.bey, beyG: C.beyG };
  }
  function kediYan(ctx, x, y, s, p) {
    const t = p.t || 0, yas = p.yas || 0, K = renk(yas), sd = 300;
    let P = kar(POZ.ayakta, POZ.otur, clamp(p.otur || 0)); if (p.yat) P = kar(P, POZ.yat, clamp(p.yat));
    const nef = Math.sin(t * (p.yat ? 1.3 : 2)) * (p.yat ? 4 : 2), adim = p.adim || 0, fz = p.yuru || 0;
    ctx.save(); ctx.translate(x, y); ctx.scale(s * (p.yon || 1), s);
    ctx.fillStyle = 'rgba(70,40,20,0.22)'; ctx.beginPath(); ctx.ellipse(-10, 2, 200, 20, 0, 0, TAU); ctx.fill();
    ctx.translate(0, -Math.abs(Math.sin(fz)) * 6 * adim);
    const sal = Math.sin(t * (1.2 - yas * 0.5)) * (p.kuyrukSal ?? 0.35);
    const KN = [[P.kk[0], P.kk[1]]];
    for (let i = 1; i <= 48; i++) { const u = i / 48, a = P.ka + sal * u * 1.6 + P.ke * u * 1.6 + (u > 0.75 ? (u - 0.75) * 7 * Math.sign(P.ke || 1) : 0); const q = KN[i - 1]; KN.push([q[0] + Math.cos(a) * 225 / 48, q[1] + Math.sin(a) * 225 / 48]); }
    const kn = u => KN[Math.round(clamp(u) * 48)];
    const sol = [], sag = [];
    for (let i = 0; i <= 12; i++) { const u = i / 12, [qx, qy] = kn(u), [rx2, ry2] = u < 1 ? kn(Math.min(1, u + 0.03)) : kn(1), [px0, py0] = u < 1 ? [qx, qy] : kn(0.97), dx = rx2 - px0, dy = ry2 - py0, L = Math.hypot(dx, dy) || 1, w = lerp(30, 18, u); sol.push([qx - dy / L * w, qy + dx / L * w]); sag.unshift([qx + dy / L * w, qy - dx / L * w]); }
    const kq = boya(ctx, [...sol, ...sag], sd + 1, K.tur, { kenar: 18 });
    ctx.save(); ctx.clip(kq); ctx.strokeStyle = K.turK; ctx.lineWidth = 14; for (let i = 1; i < 6; i++) { const [a, b] = kn(i / 6); ctx.beginPath(); ctx.arc(a, b, 26, 0, TAU); ctx.stroke(); } ctx.restore();
    const bacak = (o, faz, uzak, on) => {
      const ofs = Math.sin(faz) * 46 * adim, kalk = Math.max(0, Math.cos(faz)) * 24 * adim;
      let [sx, sy, ex, ey] = o; ex += ofs; ey -= kalk;
      if (on && !uzak && p.pati) { ex = lerp(ex, p.patiHedef[0], ease.inOut(p.pati)); ey = lerp(ey, p.patiHedef[1], ease.inOut(p.pati)); }
      const d = uzak ? -16 : 0, w = on ? 19 : 23, mx = (sx + ex) / 2 + (on ? 8 : -14), my = (sy + ey) / 2;
      const dx = ex - sx, dy = ey - sy, L = Math.hypot(dx, dy) || 1, nx = -dy / L * w, ny = dx / L * w;
      boya(ctx, [[sx + d - nx, sy - ny], [mx + d - nx, my - ny], [ex + d - nx * 0.8, ey - ny * 0.8], [ex + d + nx * 0.8, ey + ny * 0.8], [mx + d + nx, my + ny], [sx + d + nx, sy + ny]], sd + (on ? 3 : 5) + (uzak ? 1 : 0), uzak ? K.turK : K.tur, { kenar: 12, kal: 3.5 });
      boya(ctx, [[lerp(mx, ex, 0.35) + d - nx * 0.9, lerp(my, ey, 0.35) - ny * 0.9], [ex + d - nx * 0.8, ey - ny * 0.8], ...elips(ex + d + 8, ey - 8, 26, 15, 8).slice(0, 5), [ex + d + nx * 0.8, ey + ny * 0.8], [lerp(mx, ex, 0.35) + d + nx * 0.9, lerp(my, ey, 0.35) + ny * 0.9]], sd + 7 + (on ? 1 : 0), uzak ? K.beyG : K.bey, { kenar: 8, kal: 3.5 });
    };
    bacak(P.on, fz + Math.PI, true, true); bacak(P.arka, fz, true, false);
    const gv = elips(P.gx, P.gy + nef * 0.3, P.grx + nef, P.gry + nef * 0.5, 26, P.gr);
    const gP = boya(ctx, gv, sd + 10, K.tur, { isik: [P.gx - 40, P.gy - 80, 200], kenar: 30 });
    ctx.save(); ctx.clip(gP);
    ctx.save(); ctx.translate(P.gx, P.gy); ctx.rotate(P.gr);
    ctx.globalAlpha = 0.75; ctx.strokeStyle = K.turK; ctx.lineCap = 'round';
    for (let i = -4; i <= 4; i++) { ctx.lineWidth = 14 - Math.abs(i) * 1.2; ctx.beginPath(); ctx.moveTo(i * 36, -P.gry - 8); ctx.quadraticCurveTo(i * 36 + 18, -P.gry * 0.2, i * 36 + 2, P.gry * 0.5); ctx.stroke(); }
    ctx.globalAlpha = 1;
    boya(ctx, elips(P.grx * 0.55, P.gry * 0.55, P.grx * 0.5, P.gry * 0.42, 18), sd + 11, K.bey, { kontur: false, kenar: 14 });
    ctx.restore(); ctx.restore();
    tuyler(ctx, elipsTuy(P.gx, P.gy, P.grx, P.gry, Math.PI * 1.05, Math.PI * 1.95, 18, 14, sd + 12), C.kontur, 2.2);
    boya(ctx, elips(P.kalx, P.kaly, P.kalca, P.kalca * 0.92, 18), sd + 13, K.tur, { kenar: 20 });
    bacak(P.arka, fz + Math.PI, false, false); bacak(P.on, fz, false, true);
    ctx.save(); ctx.translate(P.bx, P.by + nef * 0.4); ctx.rotate((p.basEgim || 0) + (p.yat ? 0.12 : 0)); ctx.scale(0.62, 0.62);
    kediBas(ctx, 0, 0, 1, { ...p, yan: 1 - clamp(p.bak || 0) * 0.7 });
    ctx.restore();
    ctx.restore();
  }

  // ======================= KEDİ: BAŞ =======================
  /* Tekir turuncu kedi: geniş yanaklı köşeli yüz, uzun sivri kulaklar (krem tüylü), iri yuvarlak yeşil gözler (kirpikli),
   * krem alt yüz, pembe-kırmızı burun, gülümseyen ağız, alında çizgiler ve tepede kıvrık tutam. */
  function kediBas(ctx, x, y, s, p) {
    const t = p.t || 0, yas = p.yas || 0, K = renk(yas), yan = clamp(p.yan || 0), sd = 400;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    const kx = yan * 24;
    // kulaklar (uzun, sivri)
    for (const k of [-1, 1]) {
      const uz = k === -1 ? 1 - yan * 0.3 : 1;
      ctx.save(); ctx.translate(k * 88 + kx * 0.6 - (k === -1 ? yan * 16 : 0), -92); ctx.rotate(k * (0.22 + (p.kulak || 0) * 0.55)); ctx.scale(uz, 1);
      boya(ctx, [[-58, 50], [-34, -40], [-6, -140], [14, -136], [40, -40], [60, 44]], sd + 1 + k, K.tur, { kenar: 18 });
      boya(ctx, [[-36, 40], [-20, -30], [-2, -104], [10, -100], [24, -30], [36, 38]], sd + 3 + k, '#e7a090', { kontur: false, golge: false });
      ctx.strokeStyle = K.bey; ctx.lineWidth = 3; ctx.lineCap = 'round';
      for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-18 + i * 7, 40); ctx.quadraticCurveTo(-16 + i * 7 + k * 6, 0, -12 + i * 5 + k * 10, -26 - i * 4); ctx.stroke(); }
      ctx.restore();
    }
    // köşeli, geniş yanaklı yüz
    const yuz = [[-168, 52], [-150, -10], [-118, -76], [-62, -112], [0, -122], [62, -112], [118, -76], [150, -10], [168, 52], [120, 96], [60, 128], [0, 138], [-60, 128], [-120, 96]];
    const yP = boya(ctx, yuz, sd + 10, K.tur, { isik: [-50, -70, 180], kenar: 34 });
    ctx.save(); ctx.clip(yP);
    // alın ve yanak çizgileri
    ctx.strokeStyle = K.turK; ctx.lineCap = 'round'; ctx.globalAlpha = 0.9;
    for (const [a, w] of [[-34, 9], [-12, 11], [12, 11], [34, 9]]) { ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(a * 1.3 + kx, -124); ctx.quadraticCurveTo(a * 1.15 + kx, -96, a * 0.9 + kx, -66); ctx.stroke(); }
    for (const k of [-1, 1]) for (let i = 0; i < 3; i++) { ctx.lineWidth = 10 - i * 2; ctx.beginPath(); ctx.moveTo(k * 170, -2 + i * 26); ctx.quadraticCurveTo(k * 136, 4 + i * 26, k * (112 - i * 4), -2 + i * 24); ctx.stroke(); }
    ctx.globalAlpha = 1;
    // krem alt yüz (ağız-çene)
    boya(ctx, [[kx - 150, 60], [kx - 96, 26], [kx - 40, 14], [kx, 22], [kx + 40, 14], [kx + 96, 26], [kx + 150, 60], [kx + 110, 104], [kx + 50, 132], [kx, 140], [kx - 50, 132], [kx - 110, 104]], sd + 12, K.bey, { kontur: false, kenar: 18 });
    if (yas > 0) { ctx.globalAlpha = yas * 0.55; ctx.fillStyle = '#dcd5ce'; ctx.beginPath(); ctx.ellipse(kx, 80, 120, 66, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
    ctx.restore();
    // tepede kıvrık tutam
    boya(ctx, [[kx - 16, -112], [kx - 26, -140], [kx - 10, -160], [kx + 12, -158], [kx + 2, -146], [kx + 14, -114]], sd + 13, K.tur, { kal: 3.5, golge: false });
    // gözler: iri, yuvarlak, kirpikli
    const goz = clamp(p.goz ?? 1) * (1 - yas * 0.1), mutlu = p.mutlu || 0;
    for (const k of [-1, 1]) {
      const ex = k * 62 + kx - (k === -1 ? yan * 12 : 0), ey = -30, olc = k === -1 ? 1 - yan * 0.25 : 1;
      ctx.save(); ctx.translate(ex, ey); ctx.scale(olc, 1);
      if (mutlu > 0.5 || goz < 0.12) {
        cizgi(ctx, mutlu > 0.5 ? [[-32, 8], [0, -14], [32, 8]] : [[-32, -2], [0, 10], [32, -2]], sd + 20 + k, 6);
        for (let i = 0; i < 3; i++) cizgi(ctx, [[k * (26 + i * 5), mutlu > 0.5 ? 2 - i * 6 : -2 - i * 5], [k * (36 + i * 6), mutlu > 0.5 ? -4 - i * 8 : -8 - i * 7]], sd + 23 + k * 3 + i, 3);
      } else {
        const R = 40, ry = R * goz;
        const P2 = new Path2D(); P2.ellipse(0, 0, R, Math.max(4, ry), 0, 0, TAU);
        ctx.fillStyle = '#fffaf2'; ctx.fill(P2);
        ctx.save(); ctx.clip(P2);
        const bx = (p.bakX || 0) * 10, by = (p.bakY || 0) * 8;
        const ig = ctx.createRadialGradient(bx - 4, by + 6, 4, bx, by, 32); ig.addColorStop(0, '#a9d48c'); ig.addColorStop(0.6, '#4f9a5e'); ig.addColorStop(1, '#2e6a3e');
        ctx.fillStyle = ig; ctx.beginPath(); ctx.arc(bx, by + 2, 31, 0, TAU); ctx.fill();
        ctx.fillStyle = '#1a120c'; ctx.beginPath(); ctx.arc(bx, by + 2, 16 + (p.bebek ?? 0.6) * 8, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.97)'; ctx.beginPath(); ctx.ellipse(bx - 9, by - 8, 10, 8, -0.4, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(bx + 11, by + 12, 4.5, 0, TAU); ctx.fill();
        if (yas > 0) { ctx.fillStyle = `rgba(225,232,236,${yas * 0.2})`; ctx.fillRect(-50, -50, 100, 100); }
        if (goz < 0.98) { ctx.fillStyle = K.tur; ctx.fillRect(-50, -60, 100, 60 - ry); }
        ctx.restore();
        ctx.strokeStyle = C.kontur; ctx.lineWidth = 4; ctx.stroke(P2);
        // üst kapak çizgisi + kirpikler (dış köşe)
        ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(0, 0, R + 1, Math.max(4, ry) + 1, 0, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
        for (let i = 0; i < 3; i++) cizgi(ctx, [[k * (R - 6 + i * 2), -ry * 0.6 - i * 6], [k * (R + 8 + i * 4), -ry * 0.8 - i * 9]], sd + 26 + k * 3 + i, 3.5);
      }
      ctx.restore();
      // kaş tüyleri
      cizgi(ctx, [[ex - 20, ey - 52], [ex + k * 4, ey - 60], [ex + 22, ey - 54]], sd + 40 + k, 3, K.turK);
    }
    // burun (pembe-kırmızı) + gülümseyen ağız
    const nx = kx * 1.25, miy = clamp(p.miyav || 0);
    boya(ctx, [[nx - 20, 28], [nx + 20, 28], [nx + 12, 42], [nx, 50], [nx - 12, 42]], sd + 30, '#d9666a', { kal: 3.5, golge: false });
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.ellipse(nx - 6, 33, 6, 3.5, 0, 0, TAU); ctx.fill();
    if (miy > 0.05) {
      boya(ctx, elips(nx, 78 + miy * 6, 20 + miy * 6, 8 + miy * 18, 14), sd + 31, '#7a3436', { kal: 3.5, golge: false });
      ctx.fillStyle = '#e48a8c'; ctx.beginPath(); ctx.ellipse(nx, 88 + miy * 12, 12, 5 + miy * 5, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(nx + k * 15, 66); ctx.lineTo(nx + k * 11, 76); ctx.lineTo(nx + k * 7, 66); ctx.fill(); }
    } else {
      cizgi(ctx, [[nx, 50], [nx, 62]], sd + 33, 4);
      cizgi(ctx, [[nx - 46, 60], [nx - 24, 78], [nx, 64], [nx + 24, 78], [nx + 46, 60]], sd + 32, 4.5);
    }
    // bıyıklar
    ctx.strokeStyle = 'rgba(255,252,245,0.95)'; ctx.lineWidth = 2.4;
    for (let i = 0; i < 3; i++) for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(nx + k * 40, 58 + i * 8); ctx.quadraticCurveTo(nx + k * 130, 40 + i * 14, nx + k * (210 + i * 8), 52 + i * 22 + Math.sin(t * 1.3 + i) * 3); ctx.stroke(); }
    ctx.restore();
  }
  function pati(ctx, x, y, s, a, K) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.scale(s, s);
    boya(ctx, [[-60, -400], [60, -400], [70, -60], [60, 30], [0, 60], [-60, 30], [-70, -60]], 501, (K || renk(0)).tur, { kenar: 24 });
    boya(ctx, [[-62, -150], [62, -150], [70, -40], [62, 34], [0, 64], [-62, 34], [-70, -40]], 502, C.bey, { kenar: 14 });
    for (const [px, py, r] of [[-40, 14, 15], [-14, 32, 16], [14, 32, 16], [40, 14, 15]]) boya(ctx, elips(px, py, r * 0.9, r, 10), 503 + px, C.pembe, { kal: 2.5, golge: false });
    boya(ctx, elips(0, -14, 30, 22, 12), 510, C.pembe, { kal: 2.5, golge: false });
    tuyler(ctx, [[-66, -20, -1, 0.2, 12], [66, -20, 1, 0.2, 12], [-60, 20, -0.8, 0.6, 10], [60, 20, 0.8, 0.6, 10]], 511, C.kontur, 2);
    ctx.restore();
  }

  // ======================= İNSAN =======================
  function uyuyanYuz(ctx, x, y, s, p) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(p.egim ?? -0.25);
    boya(ctx, elips(-20, -40, 150, 140, 22), 601, C.sac, { isik: [40, -120, 160], kenar: 30 });
    const yz = [[-80, -60], [-30, -110], [50, -112], [112, -60], [124, 20], [98, 92], [40, 132], [-30, 126], [-80, 70], [-96, 10]];
    boya(ctx, yz, 602, C.ten, { isik: [40, -20, 150], kenar: 30, golgeRenk: 'rgba(190,110,80,0.4)' });
    boya(ctx, [[-110, 0], [-96, -100], [-20, -150], [80, -142], [140, -70], [130, -20], [80, -80], [10, -90], [-60, -60], [-90, 20]], 603, C.sac, { kenar: 20 });
    for (const [a, b, c, d] of [[-60, -110, 10, -60], [0, -130, 60, -80], [60, -130, 110, -60]]) cizgi(ctx, [[a, b], [(a + c) / 2 + 10, (b + d) / 2 - 10], [c, d]], 604 + a, 2.5, '#6a4a3a');
    const acik = clamp(p.goz || 0), kiz = p.kiz || 0;
    for (const [ex, ey, k] of [[-20, 6, 0.85], [62, 4, 1]]) {
      ctx.save(); ctx.translate(ex, ey); ctx.scale(k, 1);
      if (acik > 0.15) {
        const P2 = new Path2D(); P2.moveTo(-22, 0); P2.quadraticCurveTo(0, -12 * acik - 2, 22, -1); P2.quadraticCurveTo(0, 9 * acik + 2, -22, 0);
        ctx.fillStyle = '#f8f2ec'; ctx.fill(P2); ctx.save(); ctx.clip(P2); ctx.fillStyle = '#4a3020'; ctx.beginPath(); ctx.arc(4 + (p.bakX || 0) * 6, 0, 9, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(1, -3, 2.5, 0, TAU); ctx.fill(); ctx.restore();
        ctx.strokeStyle = C.kontur; ctx.lineWidth = 3.5; ctx.stroke(P2);
        cizgi(ctx, [[-22, -14 * acik - 6 + kiz * 6], [0, -16 * acik - 8 + kiz * 8], [22, -12 * acik - 6 - kiz * 4]], 610 + ex, 3);
      } else { cizgi(ctx, [[-22, 0], [-6, 8], [10, 7], [22, 0]], 611 + ex, 4); for (let i = 0; i < 4; i++) cizgi(ctx, [[-14 + i * 9, 6], [-17 + i * 9, 13]], 612 + ex + i, 2); }
      ctx.restore();
      cizgi(ctx, [[ex - 22, ey - 34 + kiz * 8], [ex, ey - 40 + kiz * 10], [ex + 24, ey - 34 - kiz * 4]], 615 + ex, 5, '#4a3226');
    }
    cizgi(ctx, [[34, 10], [44, 50], [30, 60]], 620, 3.5, 'rgba(120,70,50,0.8)');
    cizgi(ctx, [[10, 90], [30, 94 - kiz * 4], [50, 88]], 621, 3.5, 'rgba(150,70,60,0.85)');
    ctx.fillStyle = 'rgba(230,140,120,0.3)'; ctx.beginPath(); ctx.ellipse(90, 50, 22, 14, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function el(ctx, x, y, s, a, p = {}) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.scale(s, s);
    if (p.kol !== false) boya(ctx, [[-300, -50], [-40, -46], [-30, 46], [-300, 52]], 700, p.kolRenk || C.pijama, { kenar: 20 });
    const parm = p.parmak || 0;
    boya(ctx, [[-40, -40], [30, -46], [70, -40], [110 + Math.sin(parm) * 4, -30], [118, -14], [112 + Math.sin(parm + 1) * 4, 4], [116, 20], [104 + Math.sin(parm + 2) * 4, 34], [70, 44], [40, 70], [20, 60], [-40, 40]], 701, C.ten, { isik: [20, -20, 80], kenar: 16, golgeRenk: 'rgba(190,110,80,0.4)' });
    for (let i = 0; i < 3; i++) cizgi(ctx, [[70, -24 + i * 18], [104 + Math.sin(parm + i) * 4, -20 + i * 18]], 702 + i, 2.5, 'rgba(120,70,50,0.6)');
    ctx.restore();
  }

  // ======================= MEKÂNLAR =======================
  function duvarKagidi(ctx, renk1, renk2, isik = 1) {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, renk1); g.addColorStop(1, renk2); ctx.fillStyle = g; ctx.fillRect(-400, -400, W + 1200, H + 1200);
    ctx.save(); ctx.globalAlpha = 0.18; ctx.fillStyle = '#b07a4e';
    for (let i = -3; i < 16; i++) for (let j = -3; j < 22; j++) { const x = i * 110 + (j % 2) * 55, y = j * 110; ctx.beginPath(); ctx.ellipse(x, y, 7, 13, 0.5, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(x + 10, y + 6, 6, 11, -0.6, 0, TAU); ctx.fill(); }
    ctx.restore();
    if (isik < 1) { ctx.fillStyle = `rgba(24,28,58,${(1 - isik) * 0.7})`; ctx.fillRect(-400, -400, W + 1200, H + 1200); }
  }
  function cerceve(ctx, x, y, w, h, seed, ic) {
    boya(ctx, dik(x, y, w, h), seed, '#b98a5a', { kal: 4, kenar: 10 });
    ctx.save(); ctx.beginPath(); ctx.rect(x + 14, y + 14, w - 28, h - 28); ctx.clip(); ic(ctx, x + 14, y + 14, w - 28, h - 28); ctx.restore();
    ctx.strokeStyle = C.kontur; ctx.lineWidth = 3; ctx.strokeRect(x + 14, y + 14, w - 28, h - 28);
  }
  function bitki(ctx, x, y, s, t, seed) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 + (i - 4) * 0.28 + Math.sin(t * 0.8 + i) * 0.04, L = 150 + (i % 3) * 40; ctx.save(); ctx.rotate(a + Math.PI / 2); boya(ctx, [[0, 0], [-26, -L * 0.5], [0, -L], [26, -L * 0.5]], seed + i, i % 2 ? C.yesil : '#7a9a6a', { kal: 3, kenar: 10 }); cizgi(ctx, [[0, 0], [0, -L * 0.9]], seed + 20 + i, 2, 'rgba(60,80,50,0.6)'); ctx.restore(); }
    boya(ctx, [[-70, 0], [70, 0], [56, 110], [-56, 110]], seed + 40, '#c97a5a', { kal: 4 });
    ctx.restore();
  }
  function yatakOdasi(ctx, t, o = {}) {
    const gun = o.gundogumu, isik = o.isik ?? 1;
    duvarKagidi(ctx, gun ? '#efcdb6' : C.duvar, gun ? '#c9a59a' : C.duvarG, isik);
    const px = 700, py = 160, pw = 400, ph = 560;
    ctx.save(); ctx.beginPath(); ctx.rect(px, py, pw, ph); ctx.clip();
    const sg = ctx.createLinearGradient(0, py, 0, py + ph); if (gun) { sg.addColorStop(0, '#f6b896'); sg.addColorStop(1, '#fbe1b0'); } else { sg.addColorStop(0, '#bcd8e8'); sg.addColorStop(1, '#fbecd0'); }
    ctx.fillStyle = sg; ctx.fillRect(px, py, pw, ph);
    if (isik < 1) { ctx.fillStyle = `rgba(20,26,60,${(1 - isik) * 0.85})`; ctx.fillRect(px, py, pw, ph); }
    if (o.dis) o.dis(ctx, px, py, pw, ph);
    boya(ctx, [[px - 40, py + ph], [px + 60, py + 380], [px + 180, py + 420], [px + 280, py + 360], [px + pw + 40, py + 410], [px + pw + 40, py + ph + 40], [px - 40, py + ph + 40]], 801, '#9cb48c', { kal: 0, kontur: false, golge: false });
    ctx.restore();
    boya(ctx, dik(px - 20, py - 20, pw + 40, 24), 802, '#f6eee2', { kal: 3, golge: false }); boya(ctx, dik(px - 30, py + ph - 6, pw + 60, 30), 803, '#f6eee2', { kal: 3, golge: false });
    boya(ctx, dik(px + pw / 2 - 8, py, 16, ph), 804, '#f6eee2', { kal: 3, golge: false });
    const sal = Math.sin(t * 0.7) * 10;
    for (const [a, b, sd] of [[px - 110, px + 40, 805], [px + pw - 40, px + pw + 110, 806]]) boya(ctx, [[a, py - 60], [b, py - 60], [b - 10 + sal, py + ph + 80], [a - 10 + sal * 0.5, py + ph + 90]], sd, '#e8b8a4', { kal: 3.5, kenar: 30 });
    cizgi(ctx, [[px - 140, py - 62], [px + pw + 140, py - 62]], 807, 8, '#8a6040');
    huzme(ctx, px + pw / 2, py + 100, 400, 1500, 380, 0.42 * isik, gun ? '255,190,150' : '255,226,170');
    cerceve(ctx, 140, 330, 200, 250, 810, (c, x, y, w, h) => { c.fillStyle = '#cfe0d8'; c.fillRect(x, y, w, h); boya(c, [[x, y + h], [x + w * 0.3, y + h * 0.5], [x + w * 0.55, y + h * 0.7], [x + w * 0.8, y + h * 0.4], [x + w, y + h]], 811, '#9cb48c', { kal: 2 }); c.fillStyle = '#f6d38c'; c.beginPath(); c.arc(x + w * 0.7, y + h * 0.25, 18, 0, TAU); c.fill(); });
    cerceve(ctx, 380, 410, 150, 150, 812, (c, x, y, w, h) => { c.fillStyle = '#f2d6c4'; c.fillRect(x, y, w, h); boya(c, elips(x + w / 2, y + h / 2, 34, 34, 10), 813, '#e8956a', { kal: 2 }); });
    boya(ctx, [[60, 880], [80, 820], [620, 810], [660, 870], [660, 1260], [60, 1260]], 820, C.ahsap, { isik: [300, 860, 300], kal: 4 });
    boya(ctx, dik(-400, 1640, 2200, 1000), 821, C.ahsapK, { kal: 0, kontur: false, kenar: 0, golge: false });
    boya(ctx, dik(30, 1530, 1300, 260), 822, C.ahsap, { kal: 4 });
    boya(ctx, [[110, 1070], [190, 1000], [520, 990], [620, 1040], [640, 1160], [560, 1220], [160, 1220], [100, 1160]], 823, '#fbf6ee', { isik: [300, 1030, 260], kal: 4 });
    const orter = clamp(o.yorgan || 0);
    if (orter < 0.97) uyuyanYuz(ctx, 360, 1090, 0.95, o.yuz || {});
    const kalk = o.yorganKalk || 0;
    const ust = x => 1200 - 70 * Math.exp(-(((x - 760) / 230) ** 2)) - 30 * Math.exp(-(((x - 1050) / 150) ** 2)) + Math.sin(t * 1.1 + x * 0.01) * 3 * (o.nefes ?? 1);
    const kenarX = lerp(260, 120, orter), basY = lerp(1210, 960 - kalk * 40, orter);
    const yp = [[kenarX, 1700], [kenarX, lerp(1230, basY + 80, orter)], [lerp(340, 300, orter), lerp(1190, basY, orter)], [470, lerp(1180, basY - 10, orter)], [560, lerp(1190, 1080, orter)]];
    for (let x = 620; x <= 1360; x += 60) yp.push([x, ust(x)]);
    yp.push([1400, 1700]);
    const yP = boya(ctx, yp, 830, C.yorgan, { isik: [800, 1100, 500], kal: 4, kenar: 40, golgeRenk: 'rgba(170,140,110,0.4)' });
    ctx.save(); ctx.clip(yP); ctx.globalAlpha = 0.5;
    for (let i = 0; i < 6; i++) cizgi(ctx, [[400 + i * 160, ust(400 + i * 160) + 30], [440 + i * 160, 1400], [390 + i * 170, 1700]], 831 + i, 3, 'rgba(160,130,100,0.6)');
    ctx.fillStyle = '#e9c9a8'; for (let i = 0; i < 7; i++) for (let j = 0; j < 4; j++) { ctx.beginPath(); ctx.arc(420 + i * 140 + (j % 2) * 70, 1300 + j * 110, 8, 0, TAU); ctx.fill(); }
    ctx.restore();
    if (o.el) el(ctx, o.el.x, o.el.y, o.el.s || 0.85, o.el.a || 0.1, { parmak: o.el.parmak, kol: true });
    if (o.minder) {
      boya(ctx, elips(1000, 1236, 170, 58, 22), 840, '#c9a98c', { kal: 4, kenar: 26 });
      boya(ctx, elips(1000, 1230, 104, 30, 18), 841, '#ab8a70', { kal: 2.5, golge: false });
      ctx.strokeStyle = '#e9954c'; ctx.lineWidth = 2; for (const [a, b] of [[960, 1228], [1018, 1236], [990, 1240], [1040, 1226]]) { ctx.beginPath(); ctx.moveTo(a, b); ctx.quadraticCurveTo(a + 8, b - 5, a + 18, b + 1); ctx.stroke(); }
    }
    boya(ctx, dik(-260, 1180, 290, 560), 850, '#9c6a46', { isik: [-120, 1200, 200], kal: 4 });
    boya(ctx, dik(-280, 1150, 330, 40), 851, '#b07a52', { kal: 4 });
    fotoCerceve(ctx, -110, 1000, 0.36, t);
    boya(ctx, [[-30, 1150], [-30, 1090], [40, 1080], [70, 1150]], 852, '#e9e0d2', { kal: 3 });
    yazi(ctx, o.saat || '07:00', 22, 1122, { boyut: 26, agirlik: 700, renk: '#6a5040', golge: false });
    return { ust };
  }
  function fotoIcerik(ctx, w, h, t) {
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#f8d39a'); g.addColorStop(1, '#e8a274'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.save(); ctx.globalCompositeOperation = 'screen'; const sg = ctx.createRadialGradient(w * 0.85, h * 0.1, 10, w * 0.85, h * 0.1, w * 1.1); sg.addColorStop(0, 'rgba(255,244,210,0.95)'); sg.addColorStop(1, 'rgba(255,244,210,0)'); ctx.fillStyle = sg; ctx.fillRect(0, 0, w, h); ctx.restore();
    const k = w / 1000;
    ctx.save(); ctx.scale(k, k);
    bulanik(ctx, 14, () => { boya(ctx, dik(620, 80, 320, 420), 901, '#fbe8c4', { kal: 0, kontur: false }); bitki(ctx, 140, 640, 1.6, t, 902); });
    const hh = h / k;
    boya(ctx, [[-60, hh + 20], [-40, 980], [120, 860], [420, 820], [600, 900], [760, 1100], [800, hh + 20]], 910, '#7f9cb8', { kal: 4, kenar: 40 });
    boya(ctx, dik(260, 700, 120, 180), 911, C.tenG, { kal: 4 });
    boya(ctx, elips(330, 520, 175, 205, 24, 0.12), 912, C.ten, { isik: [260, 440, 220], kal: 4, kenar: 34, golgeRenk: 'rgba(190,110,80,0.4)' });
    boya(ctx, [[140, 560], [130, 380], [220, 290], [360, 270], [480, 320], [520, 420], [450, 380], [330, 370], [220, 420], [190, 580]], 913, C.sac, { kal: 4 });
    for (const ex of [280, 400]) cizgi(ctx, [[ex - 30, 520], [ex, 538], [ex + 30, 518]], 914 + ex, 5);
    cizgi(ctx, [[300, 630], [340, 656], [400, 626]], 916, 5, '#a4504a');
    ctx.fillStyle = 'rgba(230,130,110,0.3)'; ctx.beginPath(); ctx.ellipse(440, 590, 40, 24, 0, 0, TAU); ctx.fill();
    boya(ctx, elips(650, 930, 230, 250, 22), 920, C.tur, { isik: [560, 820, 260], kal: 4, kenar: 40 });
    boya(ctx, elips(650, 990, 140, 200, 18), 921, C.bey, { kal: 0, kontur: false });
    tuyler(ctx, elipsTuy(650, 930, 230, 250, Math.PI * 1.1, Math.PI * 1.9, 14, 16, 922), C.kontur, 2.4);
    kediBas(ctx, 640, 560, 1.15, { t, mutlu: 1, goz: 0, yan: 0 });
    el(ctx, 520, 1080, 1.4, -0.35, { parmak: 0.4, kolRenk: '#7f9cb8' });
    ctx.restore();
  }
  function fotoCerceve(ctx, x, y, s, t) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = 'rgba(60,30,15,0.25)'; ctx.fillRect(-150, -170, 330, 390);
    boya(ctx, dik(-175, -205, 350, 410), 950, '#c8975e', { kal: 4, kenar: 12 });
    ctx.fillStyle = '#fbf6ee'; ctx.fillRect(-150, -180, 300, 360);
    ctx.save(); ctx.translate(-130, -160); ctx.beginPath(); ctx.rect(0, 0, 260, 320); ctx.clip(); fotoIcerik(ctx, 260, 320, t); ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.beginPath(); ctx.moveTo(-150, -180); ctx.lineTo(40, -180); ctx.lineTo(-150, 60); ctx.fill();
    ctx.restore();
  }
  function mutfakZemin(ctx, t) {
    duvarKagidi(ctx, '#f1e2c8', '#e2cba8');
    boya(ctx, dik(-60, 380, 1200, 760), 1001, '#b88a62', { isik: [700, 500, 500], kal: 4 });
    for (const x of [240, 520, 800]) { cizgi(ctx, [[x, 420], [x, 1120]], 1002 + x, 3, 'rgba(90,55,30,0.5)'); boya(ctx, elips(x - 40, 760, 8, 30, 8), 1005 + x, '#e0c090', { kal: 2, golge: false }); }
    boya(ctx, dik(-60, 340, 1200, 50), 1010, '#efe6da', { kal: 4 });
    boya(ctx, dik(-60, 1130, 1200, 900), 1011, '#c9ad8a', { kal: 0, kontur: false, golge: false });
    ctx.strokeStyle = 'rgba(120,90,60,0.25)'; ctx.lineWidth = 3; for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.moveTo(-60, 1160 + i * 90); ctx.lineTo(1140, 1160 + i * 90); ctx.stroke(); }
    huzme(ctx, 1080, -50, 500, 1700, 420, 0.4);
  }
  function bacaklar(ctx, x, y, s, faz, adim, seed) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    for (const k of [-1, 1]) {
      const f = Math.sin(faz + (k > 0 ? Math.PI : 0)) * adim;
      ctx.save(); ctx.translate(k * 72 + f * 60, 0);
      boya(ctx, [[-62, -1000], [62, -1000], [58, -70], [-58, -70]], seed + k, C.pijama, { isik: [-30, -600, 400], kal: 4, kenar: 30 });
      for (let i = 0; i < 5; i++) cizgi(ctx, [[-50, -900 + i * 180], [50, -900 + i * 180]], seed + 10 + i, 2, 'rgba(255,255,255,0.4)');
      boya(ctx, dik(-38, -80, 76, 40), seed + 3 + k, C.tenG, { kal: 3 });
      boya(ctx, [[-60, -44], [40, -54], [120, -30], [116, 0], [-64, 0]], seed + 5 + k, '#d9b48e', { kal: 4 });
      ctx.restore();
    }
    ctx.restore();
  }

  // ======================= ÇEKİM YARDIMCISI =======================
  function cekimler(ctx, S, liste) {
    const t = S.t; let i = 0;
    for (let k = 0; k < liste.length; k++) if (t >= liste[k][0]) i = k;
    const [a, f] = liste[i];
    ctx.save(); f(ctx, t - a, t); ctx.restore();
    if (i > 0 && t - a < 0.45) {
      const u = (t - a) / 0.45;
      if (!A.gecici) A.gecici = tuval();
      const g = A.gecici.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.filter = 'none'; g.clearRect(0, 0, W, H);
      g.save(); liste[i - 1][1](g, t - liste[i - 1][0], t); g.restore();
      ctx.save(); ctx.globalAlpha = 1 - ease.inOut(u); ctx.drawImage(A.gecici, 0, 0); ctx.restore();
    }
  }

  // ======================= SAHNE 1: HER SABAH =======================
  VIDEO.sahne('sabah', {
    ciz(ctx, S) {
      KARE = Math.floor(S.gt * 6);
      const gt = S.gt;
      cekimler(ctx, S, [
        [0, (c, u, t) => {
          kamera(c, lerp(660, 600, clamp(u / 4)), 1080, lerp(1.0, 1.08, clamp(u / 4)));
          const o = yatakOdasi(c, gt, { yuz: { goz: 0 }, el: { x: 640, y: 1330, a: 0.1 } });
          const kx = lerp(1300, 760, ease.out(clamp(u / Math.max(0.5, S.at(1, 0) - 0.3))));
          kediYan(c, kx, o.ust(kx) + 10, 0.55, { t: gt, yon: -1, yuru: gt * 7, adim: kx > 770 ? 1 : 0, otur: kx > 770 ? 0 : 1, bak: 0.2 });
          bulanik(c, 18, () => bitki(c, 1250, 1900, 2.2, gt, 860));
          c.setTransform(1, 0, 0, 1, 0, 0); toz(c, gt, 40);
        }],
        [S.at(1, -0.05), (c, u, t) => {
          kamera(c, 470, 1080, lerp(2.0, 2.15, clamp(u / 3)));
          yatakOdasi(c, gt, { yuz: { goz: 0 } });
          kediYan(c, 590, 1185, 0.55, { t: gt, yon: -1, otur: 1, bak: 0.25, goz: 1 - pencere(u, 1.4, 1.65, 0.08), basEgim: -0.12, kuyrukSal: 0.4 });
          c.setTransform(1, 0, 0, 1, 0, 0); toz(c, gt, 30);
        }],
        [S.at(2, -0.05), (c, u, t) => {
          const pt = S.ci(2, 0.12, 0.92), d = Math.sin(clamp(pt) * Math.PI * 2) ** 2;
          c.save(); kamera(c, 400, 1080, 3.2); yatakOdasi(c, gt, { yuz: { goz: 0, kiz: d * 0.3 } }); c.restore();
          pati(c, lerp(930, 640, d), lerp(980, 1105, d), 1.1, lerp(1.25, 1.2, d));
          toz(c, gt, 20);
        }],
        [S.at(3, -0.1), (c, u, t) => {
          const miy = pencere(t, S.at(3, 0.05), S.at(3, 0.9), 0.12);
          bulanik(c, 10, () => { c.save(); kamera(c, 520, 1120, 1.6); yatakOdasi(c, gt, { yuz: { goz: 0 } }); c.restore(); });
          kediBas(c, 560, 980, 2.2, { t: gt, yan: 0.35, goz: 1, miyav: miy, bakX: -0.5, bakY: 0.4, bebek: 0.7 });
          toz(c, gt, 30);
        }],
      ]);
      kagit(ctx);
    },
  });

  // ======================= SAHNE 2: KÜÇÜK RUTİNİMİZ =======================
  VIDEO.sahne('rutin', {
    ciz(ctx, S) {
      KARE = Math.floor(S.gt * 6);
      const gt = S.gt;
      cekimler(ctx, S, [
        [0, (c, u, t) => {
          const ort = ramp(t, S.at(1, 0.0), S.at(1, 0.55));
          kamera(c, 560, 1100, 1.5);
          const o = yatakOdasi(c, gt, { yorgan: ort, yuz: { goz: 0, kiz: 0.4 }, el: { x: 640, y: 1330, a: 0.1 } });
          kediYan(c, 820, o.ust(820) + 10, 0.55, { t: gt, yon: -1, otur: 1, bak: 0.5, goz: 1 - pencere(u % 2.6, 2.2, 2.45, 0.08), kuyrukSal: 0.55, kulak: ort * 0.2 });
          c.setTransform(1, 0, 0, 1, 0, 0); toz(c, gt, 30);
        }],
        [S.at(2, -0.05), (c, u, t) => {
          const ac = ramp(u, 0.2, 0.9);
          kamera(c, 400, 1060, 3.4);
          yatakOdasi(c, gt, { yorgan: lerp(1, 0.62, ac), yorganKalk: ac, yuz: { goz: ac * 0.5, kiz: 1, bakX: 1 } });
          c.setTransform(1, 0, 0, 1, 0, 0); toz(c, gt, 16);
        }],
        [S.at(3, -0.05), (c, u, t) => {
          const s = Math.sin(u * 2.6) * 0.5 + 0.5;
          kamera(c, 600, 1260, 2.4);
          yatakOdasi(c, gt, { yorgan: 1, yuz: {}, el: { x: 600, y: 1300, a: 0.1, parmak: u * 3 } });
          kediYan(c, lerp(760, 730, s), 1235, 0.55, { t: gt, yon: -1, otur: 0.6, goz: 0.05, mutlu: 1, basEgim: 0.35 + s * 0.15, kuyrukSal: 0.6 });
          c.setTransform(1, 0, 0, 1, 0, 0); toz(c, gt, 20);
        }],
      ]);
      kagit(ctx);
    },
  });

  // ======================= SAHNE 3: KÜÇÜK ANLAR =======================
  VIDEO.sahne('kahve', {
    ciz(ctx, S) {
      KARE = Math.floor(S.gt * 6);
      const gt = S.gt;
      cekimler(ctx, S, [
        [0, (c, u, t) => {
          mutfakZemin(c, gt);
          boya(c, [[560, 250], [640, 250], [636, 340], [564, 340]], 1101, '#efe8de', { kal: 3 }); c.fillStyle = '#5a3a28'; c.fillRect(570, 262, 60, 14);
          c.save(); c.globalAlpha = 0.5; for (let k = 0; k < 3; k++) cizgi(c, Array.from({ length: 8 }, (_, i) => [590 + k * 14 + Math.sin(i * 0.9 + gt * 2 + k) * 12, 240 - i * 26]), 1102 + k, 5, '#fff'); c.restore();
          el(c, 470 + Math.sin(gt * 2) * 5, 320, 0.8, 0.1, { parmak: gt * 2 });
          const a = (u * 0.34) % 1 * TAU, kx = 520 + Math.sin(a) * 270, ky = 1520 + Math.sin(2 * a) * 46, yon = Math.cos(a) > 0 ? 1 : -1, arka = Math.sin(2 * a) < 0;
          const kd = () => kediYan(c, kx, ky, 0.62, { t: gt, yon, yuru: gt * 8, adim: 1, kuyrukSal: 0.7 });
          if (arka) { kd(); bacaklar(c, 520, 1540, 0.95, 0, 0, 1110); } else { bacaklar(c, 520, 1540, 0.95, 0, 0, 1110); kd(); }
        }],
        [S.at(0, 0.7), (c, u, t) => {
          const ok = Math.sin(u * 3) * 0.5 + 0.5;
          mutfakZemin(c, gt);
          bulanik(c, 8, () => bacaklar(c, 380, 1700, 1.6, 0, 0, 1120));
          kediBas(c, 560, 1180, 2.1, { t: gt, yan: 0.2, mutlu: 1, goz: 0, kulak: 0.25 + ok * 0.2 });
          el(c, 520 + ok * 30, 830 - ok * 20, 1.6, 1.25 + ok * 0.08, { parmak: u * 4 });
        }],
        [S.at(1, -0.05), (c, u, t) => {
          const yuru = clamp(u / 2.4), kapan = ramp(t, S.at(2, 0.0), S.at(2, 0.75)), acik = 1 - kapan;
          duvarKagidi(c, '#ecd8bc', '#d8c0a0');
          boya(c, dik(-60, 1500, 1200, 500), 1201, '#b99a78', { kal: 0, kontur: false, golge: false });
          const kx = 560, ky = 360, kw = 400, kh = 1140;
          c.fillStyle = '#fff6e2'; c.fillRect(kx, ky, kw * acik, kh);
          huzme(c, kx + kw * acik * 0.5, ky + kh * 0.5, kx - 200, 1950, 380, 0.7 * acik);
          if (yuru < 1 && kapan < 0.5) {
            c.save(); c.beginPath(); c.rect(kx, ky, kw * acik, kh); c.clip(); c.globalAlpha = 1 - kapan * 2;
            const sx = lerp(760, 960, yuru);
            boya(c, [[sx - 110, 800], [sx - 120, 560], [sx - 70, 480], [sx + 70, 480], [sx + 120, 560], [sx + 110, 800], [sx + 90, 1180], [sx - 90, 1180]], 1203, '#5a5468', { kal: 3, golge: false });
            boya(c, elips(sx, 400, 66, 76), 1204, '#4a4458', { kal: 3, golge: false });
            bacaklar(c, sx, 1500, 0.32, gt * 6, 0.8 * (1 - yuru), 1205);
            c.restore();
          }
          boya(c, dik(kx + kw * acik, ky, kw * (1 - acik) + 4, kh), 1210, '#a77d58', { kal: 4, kenar: 20 });
          boya(c, dik(kx - 30, ky - 30, 30, kh + 30), 1211, '#7c5638', { kal: 3 }); boya(c, dik(kx + kw, ky - 30, 30, kh + 30), 1212, '#7c5638', { kal: 3 }); boya(c, dik(kx - 30, ky - 30, kw + 60, 30), 1213, '#7c5638', { kal: 3 });
          if (kapan > 0.95) boya(c, elips(kx + 40, ky + 600, 14, 14), 1214, '#d8b878', { kal: 3 });
          kediYan(c, 280, 1640, 0.85, { t: gt, yon: 1, otur: 1, bak: 0, goz: 1 - pencere(u % 3.1, 2.8, 3.0, 0.08), kulak: kapan * 0.5, kuyrukSal: 0.25 * (1 - kapan), basEgim: -0.05 * kapan });
          bulanik(c, 20, () => boya(c, dik(-80, 1760, 600, 400), 1220, '#8a6a52', { kontur: false, golge: false }));
          const ka = ramp(t, S.at(2, 0.5), S.d); if (ka > 0) { c.fillStyle = `rgba(30,22,30,${ka * 0.35})`; c.fillRect(0, 0, W, H); }
        }],
      ]);
      kagit(ctx);
    },
  });

  // ======================= SAHNE 4: ZAMAN GEÇİYOR =======================
  VIDEO.sahne('zaman', {
    ciz(ctx, S) {
      KARE = Math.floor(S.gt * 6);
      const gt = S.gt;
      cekimler(ctx, S, [
        [0, (c, u, t) => {
          const lapse = clamp(u / Math.max(1, S.at(1, 0) - 0.1)), gf = lapse * 3.5, isik = 0.5 + 0.5 * Math.cos(gf * TAU);
          const dis = (d, px, py, pw, ph) => {
            const r = rng(4);
            for (let i = 0; i < 30; i++) { const x = px + ((r() * pw + u * 70) % pw), y = py + ((r() * ph + u * 240 * (0.6 + r())) % ph); d.fillStyle = lapse < 0.35 ? 'rgba(210,120,50,0.95)' : lapse < 0.7 ? 'rgba(255,255,255,0.95)' : 'rgba(250,190,205,0.95)'; d.beginPath(); d.ellipse(x, y, lapse < 0.35 ? 10 : 6, 6, r() * 3, 0, TAU); d.fill(); }
            d.fillStyle = `rgba(255,240,190,${clamp(Math.cos(gf * TAU))})`; d.beginPath(); d.arc(px + pw * (gf % 1), py + 140 - Math.sin((gf % 1) * Math.PI) * 80, 34, 0, TAU); d.fill();
          };
          kamera(c, 900, 760, 1.55);
          yatakOdasi(c, gt, { isik, dis, yuz: { goz: 0 } });
          kediYan(c, 900, 735, 0.42, { t: gt, yon: -1, otur: 1, yas: lapse, bak: 0.1, goz: 0.85, kuyrukSal: 0.2 });
        }],
        [S.at(1, -0.05), (c, u, t) => {
          c.save(); kamera(c, 640, 1500, 1.5);
          yatakOdasi(c, gt, { yuz: { goz: 0 } });
          const kx = lerp(980, 560, ease.inOut(clamp(u / Math.max(0.5, S.at(2, 0.3) - S.at(1, 0)))));
          kediYan(c, kx, 1760, 0.72, { t: gt * 0.7, yon: -1, yuru: gt * 3, adim: 0.55, yas: 1, goz: 0.8, bak: 0.25, kuyrukSal: 0.15 });
          bulanik(c, 16, () => bitki(c, 1300, 2100, 2.4, gt, 870));
          c.restore();
        }],
        [S.at(2, 0.3), (c, u, t) => {
          const tir = clamp(u / 1.6);
          kamera(c, 760, 1350, 1.4);
          const o = yatakOdasi(c, gt, { yuz: { goz: 0 }, el: { x: 640, y: 1330, a: 0.1 } });
          const kx = lerp(900, 840, tir), ky = lerp(1720, o.ust(840) + 10, ease.inOut(tir)) - Math.sin(Math.PI * tir) * 60;
          kediYan(c, kx, ky, 0.6, { t: gt * 0.7, yon: -1, yuru: gt * 2, adim: tir < 1 ? 0.5 : 0, yas: 1, goz: 0.8, bak: 0.2 });
        }],
        [S.at(3, -0.05), (c, u, t) => {
          const yt = ramp(u, 0, 1.2);
          kamera(c, 640, 1180, 1.9);
          const o = yatakOdasi(c, gt, { yuz: { goz: 0 }, el: { x: lerp(640, 700, yt), y: lerp(1330, 1190, yt), a: lerp(0.1, -0.15, yt), parmak: gt * yt } });
          kediYan(c, 760, o.ust(760) + 12, 0.55, { t: gt, yon: -1, otur: 1 - yt, yat: yt, yas: 1, goz: yt > 0.6 ? 0.05 : 0.8, mutlu: yt > 0.6 ? 1 : 0, kuyrukSal: 0.12 });
          c.setTransform(1, 0, 0, 1, 0, 0); toz(c, gt, 26);
        }],
      ]);
      kagit(ctx);
    },
  });

  // ======================= SAHNE 5: SESSİZ SABAH + FİNAL =======================
  VIDEO.sahne('sessiz', {
    ciz(ctx, S) {
      KARE = Math.floor(S.gt * 6);
      const gt = S.gt, t = S.t;
      const finalA = ramp(t, S.konusma.end + 0.3, S.konusma.end + 1.6);
      if (finalA < 1) {
        cekimler(ctx, S, [
          [0, (c, u) => {
            const uy = ramp(u, 1.0, 2.6);
            kamera(c, 640, 1120, lerp(1.25, 1.35, clamp(u / 4)));
            yatakOdasi(c, gt, { gundogumu: true, minder: true, saat: '06:41', nefes: 0.6, yuz: { goz: uy * 0.7, bakX: 1 }, el: { x: 640, y: 1330, a: 0.1 } });
            c.setTransform(1, 0, 0, 1, 0, 0); toz(c, gt, 36);
          }],
          [S.at(1, -0.05), (c, u) => {
            const uz = ramp(u, 0.2, 2.0);
            kamera(c, 900, 1250, 2.4);
            yatakOdasi(c, gt, { gundogumu: true, minder: true, yuz: { goz: 0.7 }, el: { x: lerp(700, 930, uz), y: lerp(1320, 1236, uz), a: lerp(0.1, -0.05, uz), parmak: uz } });
            c.setTransform(1, 0, 0, 1, 0, 0); toz(c, gt, 24);
          }],
          [S.at(2, -0.05), (c, u) => {
            kamera(c, 200, 1080, 2.6);
            yatakOdasi(c, gt, { gundogumu: true, minder: true, saat: '06:41', yuz: { goz: 0.75, bakX: -0.5 } });
            c.setTransform(1, 0, 0, 1, 0, 0); toz(c, gt, 20);
          }],
          [S.at(3, -0.1), (c, u) => {
            const f = ease.inOut(clamp(u / Math.max(1, S.konusma.end + 0.6 - S.at(3, -0.1))));
            kamera(c, lerp(300, -110, f), lerp(1100, 1010, f), lerp(1.6, 5.6, f));
            yatakOdasi(c, gt, { gundogumu: true, minder: true, saat: '06:41', yuz: { goz: 0.6 } });
            c.setTransform(1, 0, 0, 1, 0, 0); toz(c, gt, 24);
          }],
        ]);
        kagit(ctx, 0.8);
      }
      if (finalA > 0) {
        ctx.save(); ctx.globalAlpha = finalA;
        ctx.fillStyle = '#2a1a10'; ctx.fillRect(0, 0, W, H);
        const fz = lerp(1.0, 1.1, ease.inOut(clamp((t - S.konusma.end) / 8)));
        ctx.save(); ctx.translate(540, 900); ctx.scale(fz, fz); ctx.translate(-540, -900);
        ctx.fillStyle = '#fbf6ee'; ctx.fillRect(30, 100, 1020, 1600);
        ctx.save(); ctx.translate(70, 140); ctx.beginPath(); ctx.rect(0, 0, 940, 1440); ctx.clip(); fotoIcerik(ctx, 940, 1440, gt); ctx.restore();
        ctx.restore();
        kagit(ctx, 0.6);
        const vg = ctx.createLinearGradient(0, 1200, 0, H); vg.addColorStop(0, 'rgba(30,16,8,0)'); vg.addColorStop(1, 'rgba(30,16,8,0.82)');
        ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
        const ya = ramp(t, S.konusma.end + 1.6, S.konusma.end + 3.0);
        if (ya > 0) {
          ctx.globalAlpha = finalA * ya;
          yazi(ctx, 'Bazı seslerin kıymetini,', W / 2, 1610 - (1 - ya) * 14, { boyut: 64, agirlik: 600, renk: '#fff8ee', golgeRenk: 'rgba(0,0,0,0.65)', golgeBulanik: 26 });
          yazi(ctx, 'sustuklarında anlarız.', W / 2, 1700 - (1 - ya) * 14, { boyut: 64, agirlik: 600, renk: '#fff8ee', golgeRenk: 'rgba(0,0,0,0.65)', golgeBulanik: 26 });
        }
        ctx.restore();
        const son = ramp(t, S.d - 1.8, S.d);
        if (son > 0) { ctx.fillStyle = `rgba(0,0,0,${son})`; ctx.fillRect(0, 0, W, H); }
      }
    },
  });

  VIDEO.sahne('_ortak', {
    hazirla() {
      A.kagit = gurultuDokusu(270, 480, 5, 21, f => [255 - f * 30, 250 - f * 40, 240 - f * 50, 255], 3);
      A.sulu = gurultuDokusu(400, 400, 60, 13, f => [255 - f * 70, 250 - f * 80, 245 - f * 90, 255], 5);
    },
    ciz() { },
  });
})();
