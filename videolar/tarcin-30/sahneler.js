/* Tarçın — O benim ailemdi (30 sn). Kedi-sesim çizim kütüphanesi + yeni sahneler (yaramazlık, mama, oyun, kucak, veda).
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
  // ======================= KEDİ: ÖNDEN OTURAN (referans duruş) =======================
  /* kediOtur(ctx, x, y, s, p): (x,y) patilerin altı, s=1 → ~720 px boy. Armut gövde, göğüste krem şerit, düz ön bacaklar,
   * krem patiler, yerde kıvrılan çizgili kuyruk, iri baş. p: kediBas parametreleri + kuyrukSal, nefes, yas */
  function kediOtur(ctx, x, y, s, p) {
    const t = p.t || 0, yas = p.yas || 0, K = renk(yas), sd = 1500;
    const nef = Math.sin(t * 2) * 3, sal = Math.sin(t * (1.1 - yas * 0.5)) * (p.kuyrukSal ?? 0.3);
    ctx.save(); ctx.translate(x, y); ctx.scale(s * (p.yon || 1), s);
    ctx.fillStyle = 'rgba(70,40,20,0.22)'; ctx.beginPath(); ctx.ellipse(40, 4, 260, 26, 0, 0, TAU); ctx.fill();
    // kuyruk: arka sağdan çıkıp yerde kıvrılır
    const KN = [[90, -40]];
    for (let i = 1; i <= 40; i++) { const u = i / 40, a = -0.15 + u * 0.4 - (u > 0.7 ? (u - 0.7) * 9 : 0) + sal * u; const q = KN[i - 1]; KN.push([q[0] + Math.cos(a) * 300 / 40, q[1] + Math.sin(a) * 300 / 40 - (u > 0.7 ? 0 : 0)]); }
    const sol = [], sag = [];
    for (let i = 0; i <= 40; i += 2) { const q = KN[i], r2 = KN[Math.min(40, i + 1)], r0 = KN[Math.max(0, i - 1)], dx = r2[0] - r0[0], dy = r2[1] - r0[1], L = Math.hypot(dx, dy) || 1, w = lerp(30, 20, i / 40); sol.push([q[0] - dy / L * w, q[1] + dx / L * w]); sag.unshift([q[0] + dy / L * w, q[1] - dx / L * w]); }
    const kq = boya(ctx, [...sol, ...sag], sd + 1, K.tur, { kenar: 16 });
    ctx.save(); ctx.clip(kq); ctx.strokeStyle = K.turK; ctx.lineWidth = 16; for (let i = 6; i < 40; i += 6) { const [a, b] = KN[i]; ctx.beginPath(); ctx.moveTo(a - 6, b - 40); ctx.lineTo(a + 6, b + 40); ctx.stroke(); } ctx.restore();
    // arka bacak kalçaları (yanlarda yuvarlak)
    for (const k of [-1, 1]) boya(ctx, elips(k * 112, -110, 98, 110, 20), sd + 3 + k, K.tur, { isik: [k * 80, -170, 120], kenar: 26 });
    for (const k of [-1, 1]) boya(ctx, elips(k * 150, -18, 52, 26, 14), sd + 6 + k, K.bey, { kenar: 10 });
    // gövde (armut)
    const gov = [[-60, -470], [60, -470], [118, -380], [150, -250], [160, -120], [130, -30], [0, -10], [-130, -30], [-160, -120], [-150, -250], [-118, -380]];
    const gP = boya(ctx, gov.map(([a, b]) => [a * (1 + nef * 0.004), b]), sd + 10, K.tur, { isik: [-60, -340, 220], kenar: 34 });
    ctx.save(); ctx.clip(gP);
    ctx.strokeStyle = K.turK; ctx.lineCap = 'round';
    for (const k of [-1, 1]) for (let i = 0; i < 6; i++) { ctx.lineWidth = 14 - i; const yy = -410 + i * 66; ctx.beginPath(); ctx.moveTo(k * 170, yy); ctx.quadraticCurveTo(k * 120, yy + 20, k * 66, yy + 6); ctx.stroke(); }
    boya(ctx, [[-36, -470], [36, -470], [52, -340], [46, -200], [24, -90], [0, -60], [-24, -90], [-46, -200], [-52, -340]], sd + 11, K.bey, { kontur: false, kenar: 14 });
    ctx.restore();
    // yele/boyun tüyleri
    tuyler(ctx, [[-100, -420, -0.9, 0.3, 22], [-120, -390, -0.9, 0.4, 20], [100, -420, 0.9, 0.3, 22], [120, -390, 0.9, 0.4, 20]], sd + 12, C.kontur, 2.4);
    // ön bacaklar (düz) + krem patiler
    for (const k of [-1, 1]) {
      boya(ctx, [[k * 30, -300], [k * 92, -300], [k * 96, -40], [k * 26, -40]], sd + 14 + k, K.tur, { isik: [k * 50, -250, 90], kenar: 16 });
      ctx.save(); ctx.strokeStyle = K.turK; ctx.lineWidth = 11; ctx.lineCap = 'round';
      for (let i = 0; i < 4; i++) { const yy = -260 + i * 52; ctx.beginPath(); ctx.moveTo(k * 32, yy); ctx.lineTo(k * 92, yy + 10); ctx.stroke(); }
      ctx.restore();
      boya(ctx, elips(k * 62, -26, 52, 32, 16), sd + 17 + k, K.bey, { kenar: 10 });
      for (const d of [-16, 16]) cizgi(ctx, [[k * 62 + d, -40], [k * 62 + d, -6]], sd + 19 + d + k, 3);
    }
    // baş
    ctx.save(); ctx.translate(0, -590 + nef * 0.6); ctx.rotate(p.basEgim || 0);
    kediBas(ctx, 0, 0, 1.3, p);
    ctx.restore();
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

  // ======================= YAŞLI TARÇIN YAKIN PLAN (veda) =======================
  function yasliYakin(c, gt, o) {
    bulanik(c, 12, () => { c.save(); kamera(c, 640, 1150, 2.0); yatakOdasi(c, gt, { yuz: { goz: o.sahipGoz ?? 0.5 } }); c.restore(); });
    c.save(); c.globalCompositeOperation = 'soft-light'; c.globalAlpha = 0.5; c.fillStyle = '#ffc88a'; c.fillRect(0, 0, W, H); c.restore();
    const K = renk(1), nef = Math.sin(gt * 1.2) * 6 * (o.nefes ?? 1);
    // kıvrılmış gövde: başın arkasında sağa uzanır, kuyruk önden dolanır
    const g = boya(c, elips(720, 1500 + nef * 0.3, 360 + nef, 210 + nef * 0.5, 26, -0.08), 1601, K.tur, { isik: [640, 1380, 300], kenar: 40 });
    c.save(); c.clip(g); c.strokeStyle = K.turK; c.lineWidth = 18; c.lineCap = 'round';
    for (let i = -3; i <= 4; i++) { c.beginPath(); c.moveTo(720 + i * 80, 1300); c.quadraticCurveTo(740 + i * 84, 1440, 720 + i * 88, 1560); c.stroke(); }
    boya(c, elips(560, 1600, 200, 110, 18), 1608, K.bey, { kontur: false, kenar: 14 });
    c.restore();
    tuyler(c, elipsTuy(720, 1500, 360, 210, Math.PI * 1.15, Math.PI * 1.9, 16, 16, 1609), C.kontur, 2.4);
    // kuyruk önden dolanır
    const ky = [[1040, 1560], [980, 1680], [800, 1730], [600, 1720], [470, 1680]];
    c.save(); c.lineCap = 'round'; c.strokeStyle = C.kontur; c.lineWidth = 64; c.stroke(yol(ky, 1610, 1, false)); c.strokeStyle = K.tur; c.lineWidth = 56; c.stroke(yol(ky, 1610, 1, false));
    c.strokeStyle = K.turK; c.lineWidth = 14; for (const [x, y] of [[960, 1690], [860, 1724], [740, 1730], [620, 1716]]) { c.beginPath(); c.moveTo(x - 6, y - 26); c.lineTo(x + 6, y + 26); c.stroke(); }
    c.restore();
    // ön patiler (çenenin altında)
    for (const k of [-1, 1]) { boya(c, elips(470 + k * 95, 1560, 80, 44, 16), 1602 + k, K.bey, { kenar: 12 }); for (const d of [-22, 0, 22]) cizgi(c, [[470 + k * 95 + d, 1530], [470 + k * 95 + d, 1588]], 1605 + k * 5 + d, 3); }
    kediBas(c, 470, 1380 + (o.egim || 0) * 70, 1.45, { t: gt, yas: 1, goz: o.goz, mutlu: o.mutlu, bakX: o.bakX, bakY: o.bakY, bebek: 0.5, kulak: 0.15 });
    if (o.el) { const s = Math.sin(gt * 1.6) * 0.5 + 0.5; el(c, lerp(200, 270, s), lerp(1000, 1040, s), 1.5, 0.55 + s * 0.08, { parmak: gt * 1.5 }); }
    toz(c, gt, 30, 0.7);
  }

  // ======================= YENİ NESNELER: mama kabı, mama torbası, oyuncak, yumak =======================
  function mamaKabi(ctx, x, y, s, dolu) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    boya(ctx, [[-120, -40], [120, -40], [96, 30], [-96, 30]], 1701, '#d9707a', { isik: [-40, -40, 120], kal: 4 });
    boya(ctx, elips(0, -40, 120, 26, 18), 1702, '#b85a64', { kal: 4, golge: false });
    if (dolu > 0) { const r = rng(5); for (let i = 0; i < 40 * dolu; i++) { const a = r() * TAU, d = r() * 100; ctx.fillStyle = r() < 0.5 ? '#9a5a30' : '#b87440'; ctx.beginPath(); ctx.ellipse(Math.cos(a) * d, -42 + Math.sin(a) * d * 0.2 - dolu * 8, 10, 7, a, 0, TAU); ctx.fill(); } }
    yazi(ctx, 'TARÇIN', 0, 2, { boyut: 30, agirlik: 800, renk: '#fff3e8', golge: false });
    ctx.restore();
  }
  function tuyOyuncak(ctx, x, y, t) {                 // çubuk + ip + tüy
    ctx.save(); ctx.strokeStyle = C.kontur; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y - 320); ctx.quadraticCurveTo(x + Math.sin(t * 3) * 40, y - 160, x, y); ctx.stroke(); ctx.restore();
    for (let i = 0; i < 5; i++) { ctx.save(); ctx.translate(x, y); ctx.rotate(-0.8 + i * 0.4 + Math.sin(t * 6 + i) * 0.15); boya(ctx, [[0, 0], [-14, 40], [0, 90], [14, 40]], 1710 + i, ['#e86a6a', '#f0c66e', '#7fb0d8', '#9ed08a', '#e8a0c8'][i], { kal: 2.5, golge: false }); ctx.restore(); }
  }
  function yumak(ctx, x, y, s, seed) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    boya(ctx, elips(0, 0, 60, 56, 16), seed, '#d8505a', { kal: 4 });
    ctx.strokeStyle = '#a83a44'; ctx.lineWidth = 4; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(0, 0, 18 + i * 8, -1 + i * 0.5, 1 + i * 0.5); ctx.stroke(); }
    ctx.restore();
  }

  // ======================= 1) TANIŞMA + YARAMAZ ÇOCUK =======================
  VIDEO.sahne('tanisma', {
    ciz(ctx, S) {
      KARE = Math.floor(S.gt * 6);
      const gt = S.gt;
      cekimler(ctx, S, [
        [0, (c, u, t) => {
          bulanik(c, 9, () => { c.save(); kamera(c, 560, 1100, 1.5); yatakOdasi(c, gt, { yuz: { goz: 0 }, el: { x: 640, y: 1330, a: 0.1 } }); c.restore(); });
          const z = lerp(1.0, 1.08, ease.inOut(clamp(t / Math.max(1, S.at(2, 0)))));
          c.save(); c.translate(540, 1100); c.scale(z, z); c.translate(-540, -1100);
          const merhaba = pencere(t, S.at(0, 0.05), S.at(0, 0.9), 0.12), egil = pencere(t, S.at(1, 0), S.at(1, 1) + 0.3, 0.3);
          kediOtur(c, 540, 1560, 0.88, { t: gt, miyav: merhaba * 0.6, basEgim: egil * 0.14, goz: 1 - pencere(t, S.at(1, 0.5), S.at(1, 0.85), 0.08), kuyrukSal: 0.5 });
          c.restore(); toz(c, gt, 40);
        }],
        [S.at(2, -0.05), (c, u, t) => {                                         // yaramaz: tezgâhtaki fincanı patiyle iter, düşürür, masum bakar
          kamera(c, 560, lerp(420, 760, clamp((u - 1.0) / 0.8)), lerp(2.1, 1.15, clamp((u - 1.0) / 0.8)));
          mutfakZemin(c, gt);
          const it = ramp(u, 0.3, 1.0), dus = clamp((u - 1.0) / 0.6);
          const fx = lerp(620, 700, it), fy = dus > 0 ? 340 + dus * dus * 880 : 340;
          if (dus < 1) { c.save(); c.translate(fx, fy - 40); c.rotate(dus * 4); boya(c, [[-40, -40], [40, -40], [36, 40], [-36, 40]], 1720, '#7fb0d8', { kal: 4 }); c.restore(); }
          else { for (let i = 0; i < 6; i++) { const a = -Math.PI + i * 0.6; boya(c, [[0, 0], [24, -6], [30, 16], [6, 20]].map(([px, py]) => [px + 700 + Math.cos(a) * 60 * (1 + (u - 1.6)), py + 1190 + Math.sin(a) * 20]), 1730 + i, '#7fb0d8', { kal: 3 }); } }
          const masum = ramp(u, 1.3, 1.7);
          kediYan(c, 470, 340, 0.6, { t: gt, yon: 1, otur: 0.3, pati: pencere(u, 0.2, 1.1, 0.25), patiHedef: [260, -60], bak: masum, goz: 1, kuyrukSal: 0.6 + masum * 0.4 });
        }],
      ]);
      kagit(ctx);
    },
  });

  // ======================= 2) İLGİ: OKŞAMA, MAMA, OYUN =======================
  VIDEO.sahne('ilgi', {
    ciz(ctx, S) {
      KARE = Math.floor(S.gt * 6);
      const gt = S.gt;
      cekimler(ctx, S, [
        [0, (c, u, t) => {                                                       // "benimle hep ilgilendi": okşayan el
          const ok = Math.sin(u * 3) * 0.5 + 0.5;
          bulanik(c, 12, () => { c.save(); kamera(c, 600, 1150, 1.6); yatakOdasi(c, gt, { yuz: { goz: 0.6 } }); c.restore(); });
          kediBas(c, 560, 1180, 2.1, { t: gt, yan: 0.15, mutlu: 1, goz: 0, kulak: 0.25 + ok * 0.2 });
          el(c, 520 + ok * 30, 830 - ok * 20, 1.6, 1.25 + ok * 0.08, { parmak: u * 4 });
          toz(c, gt, 30);
        }],
        [S.at(1, -0.05), (c, u, t) => {                                          // mama: el kabı doldurur, Tarçın bekler sonra yer
          mutfakZemin(c, gt);
          const dol = ramp(u, 0.2, 1.0), ye = ramp(u, 1.1, 1.5);
          if (dol < 1) {
            c.save(); c.translate(lerp(760, 700, dol), lerp(900, 1180, dol)); c.rotate(lerp(0.2, 1.1, dol));
            boya(c, dik(-70, -110, 140, 220), 1740, '#e9c88a', { kal: 4 }); yazi(c, 'MAMA', 0, 0, { boyut: 34, agirlik: 800, renk: '#8a5a30', golge: false }); c.restore();
            const r = rng(7); for (let i = 0; i < 10; i++) { const yy = 1250 + ((u * 600 + i * 47) % 260); c.fillStyle = '#9a5a30'; c.beginPath(); c.ellipse(640 + r() * 40, yy, 8, 6, 0, 0, TAU); c.fill(); }
            el(c, lerp(900, 840, dol), lerp(800, 1060, dol), 1.0, 2.6, { parmak: u * 3 });
          }
          mamaKabi(c, 620, 1560, 1.2, dol);
          if (ye < 0.5) kediOtur(c, 380, 1640, 0.7, { t: gt, yan: 0.3, bakX: 0.8, bakY: 0.6, miyav: pencere(u, 0.3, 0.8, 0.1) * 0.5, kuyrukSal: 0.9 });
          else { const b = Math.abs(Math.sin(u * 8)) * 10; kediYan(c, 420, 1640, 0.75, { t: gt, yon: 1, otur: 0, basEgim: 0.75 + b * 0.01, goz: 0.1, mutlu: 1, kuyrukSal: 0.9 }); }
        }],
        [S.at(2, -0.05), (c, u, t) => {                                          // oyun: tüylü oyuncak, Tarçın arka ayaklarına kalkıp yakalamaya çalışır
          duvarKagidi(c, '#f0dfc4', '#e2c9a6');
          boya(c, dik(-60, 1450, 1200, 600), 1750, '#c9ad8a', { kal: 0, kontur: false, golge: false });
          boya(c, elips(540, 1560, 420, 90, 22), 1751, '#d9a3a0', { kal: 3, golge: false });       // halı
          huzme(c, 1000, -40, 500, 1700, 400, 0.35);
          const ox = 620 + Math.sin(u * 2.6) * 160, oy = 900 + Math.cos(u * 3.4) * 90;
          tuyOyuncak(c, ox, oy, gt);
          el(c, ox + 60, oy - 400, 0.9, 1.9, { parmak: 0 });
          const zipla = Math.max(0, Math.sin(u * 5.2)) * 140;
          kediYan(c, 480, 1560 - zipla, 0.72, { t: gt, yon: 1, otur: 0.15, pati: 1, patiHedef: [(ox - 480) / 0.72 * 0.8, (oy - 1560 + zipla) / 0.72 * 0.5], bak: 0.1, goz: 1, bebek: 1, kuyrukSal: 1.0, basEgim: -0.3 });
          toz(c, gt, 24);
        }],
      ]);
      kagit(ctx);
    },
  });

  // ======================= 3) YARAMAZLIK + HİÇ BIRAKMADI =======================
  VIDEO.sahne('yaramaz', {
    ciz(ctx, S) {
      KARE = Math.floor(S.gt * 6);
      const gt = S.gt;
      cekimler(ctx, S, [
        [0, (c, u, t) => {                                                       // yumak her yere dağılmış, suçlu ama sevimli Tarçın
          duvarKagidi(c, '#f0dfc4', '#e2c9a6');
          boya(c, dik(-60, 1300, 1200, 700), 1760, '#c9ad8a', { kal: 0, kontur: false, golge: false });
          c.save(); c.strokeStyle = '#d8505a'; c.lineWidth = 7; c.lineCap = 'round';
          c.beginPath(); c.moveTo(-40, 1500); c.bezierCurveTo(200, 1300, 300, 1800, 520, 1560); c.bezierCurveTo(700, 1380, 900, 1760, 1120, 1480); c.stroke();
          c.beginPath(); c.moveTo(300, 1400); c.bezierCurveTo(420, 1900, 640, 1300, 820, 1700); c.stroke(); c.restore();
          yumak(c, 860, 1640, 1.0, 1770);
          const s2 = 0.85 + 0.02 * Math.sin(u * 2);
          kediOtur(c, 520, 1640, s2, { t: gt, yan: 0.2, bakX: 0.2, bakY: 0.3, kulak: 0.6, goz: 1, bebek: 0.95, basEgim: 0.12, kuyrukSal: 0.3 });
          c.save(); c.strokeStyle = '#d8505a'; c.lineWidth = 7; c.beginPath(); c.moveTo(380, 1060); c.bezierCurveTo(500, 1000, 640, 1160, 700, 1080); c.stroke(); c.restore();   // başında ip
          toz(c, gt, 20);
        }],
        [S.at(1, -0.1), (c, u, t) => {                                           // "ama o beni hiç bırakmadı": kucakta, okşanan Tarçın
          const ok = Math.sin(u * 2.4) * 0.5 + 0.5;
          bulanik(c, 12, () => { c.save(); kamera(c, 560, 1150, 1.6); yatakOdasi(c, gt, { yuz: { goz: 0.6 } }); c.restore(); });
          c.save(); c.globalCompositeOperation = 'soft-light'; c.globalAlpha = 0.4; c.fillStyle = '#ffc88a'; c.fillRect(0, 0, W, H); c.restore();
          boya(c, [[-80, 2000], [-60, 1500], [200, 1380], [540, 1360], [900, 1420], [1160, 1560], [1160, 2000]], 1780, C.pijama, { kal: 4, kenar: 40 });   // kucak
          kediOtur(c, 540, 1700, 0.85, { t: gt, yan: 0.1, mutlu: 1, goz: 0, kuyrukSal: 0.4, basEgim: -0.05 + ok * 0.05 });
          el(c, 820 - ok * 40, 1050 + ok * 20, 1.4, 2.7, { parmak: u * 3 });
          toz(c, gt, 30);
        }],
      ]);
      kagit(ctx);
    },
  });

  // ======================= 4) VEDA + FİNAL =======================
  VIDEO.sahne('veda', {
    ciz(ctx, S) {
      KARE = Math.floor(S.gt * 6);
      const gt = S.gt, t = S.t;
      const finalA = ramp(t, S.konusma.end + 0.4, S.konusma.end + 1.6);
      if (finalA < 1) {
        cekimler(ctx, S, [
          [0, (c, u) => {                                                      // altın ışık: yaşlı Tarçın sahibinin yanında
            kamera(c, lerp(560, 620, clamp(u / 3)), 1160, lerp(1.5, 1.75, clamp(u / 3)));
            const o = yatakOdasi(c, gt, { yuz: { goz: 0.55, bakX: 1 }, el: { x: 700, y: 1195, a: -0.15, parmak: gt * 1.2 } });
            kediYan(c, 760, o.ust(760) + 12, 0.55, { t: gt, yon: -1, yat: 1, yas: 1, goz: 0.7, bak: 0.6, kuyrukSal: 0.1 });
            c.setTransform(1, 0, 0, 1, 0, 0);
            c.save(); c.globalCompositeOperation = 'soft-light'; c.globalAlpha = 0.45; c.fillStyle = '#ffc88a'; c.fillRect(0, 0, W, H); c.restore();
            toz(c, gt, 36, 0.7);
          }],
          [S.at(1, -0.1), (c, u) => {                                          // "ama onu hep çok seveceğim": sahibine bakar, okşanır
            yasliYakin(c, gt, { goz: 0.75 * (1 - pencere(u % 3.4, 2.9, 3.3, 0.1)), bakX: -0.5, bakY: -0.6, el: true });
          }],
          [S.at(3, -0.1), (c, u, t2) => {                                      // "çünkü o… benim ailemdi": gözler yavaşça kapanır
            const kapa = ramp(t2, S.at(3, 0.3), S.konusma.end + 0.2);
            yasliYakin(c, gt, { goz: lerp(0.6, 0.0, kapa), mutlu: 0, bakX: -0.3, bakY: -0.4, el: true, egim: kapa * 0.4, nefes: 1 - kapa * 0.6 });
            c.fillStyle = `rgba(255,240,210,${kapa * 0.3})`; c.fillRect(0, 0, W, H);
          }],
        ]);
        kagit(ctx, 0.8);
      }
      if (finalA > 0) {
        ctx.save(); ctx.globalAlpha = finalA;
        ctx.fillStyle = '#2a1a10'; ctx.fillRect(0, 0, W, H);
        const fz = lerp(1.0, 1.08, ease.inOut(clamp((t - S.konusma.end) / 5)));
        ctx.save(); ctx.translate(540, 900); ctx.scale(fz, fz); ctx.translate(-540, -900);
        ctx.fillStyle = '#fbf6ee'; ctx.fillRect(30, 100, 1020, 1600);
        ctx.save(); ctx.translate(70, 140); ctx.beginPath(); ctx.rect(0, 0, 940, 1440); ctx.clip(); fotoIcerik(ctx, 940, 1440, gt); ctx.restore();
        ctx.restore();
        kagit(ctx, 0.6);
        const vg = ctx.createLinearGradient(0, 1200, 0, H); vg.addColorStop(0, 'rgba(30,16,8,0)'); vg.addColorStop(1, 'rgba(30,16,8,0.82)');
        ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
        const ya = ramp(t, S.konusma.end + 1.4, S.konusma.end + 2.6);
        if (ya > 0) {
          ctx.globalAlpha = finalA * ya;
          yazi(ctx, 'Bazı seslerin kıymetini,', W / 2, 1610 - (1 - ya) * 14, { boyut: 64, agirlik: 600, renk: '#fff8ee', golgeRenk: 'rgba(0,0,0,0.65)', golgeBulanik: 26 });
          yazi(ctx, 'sustuklarında anlarız.', W / 2, 1700 - (1 - ya) * 14, { boyut: 64, agirlik: 600, renk: '#fff8ee', golgeRenk: 'rgba(0,0,0,0.65)', golgeBulanik: 26 });
        }
        ctx.restore();
        const son = ramp(t, S.d - 1.4, S.d);
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
