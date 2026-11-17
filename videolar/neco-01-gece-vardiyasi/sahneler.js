/* NECO – Bölüm 1: İnsan beyninin gece vardiyası
 * Tek sürekli dünya, sese bağlı çekim listesi (yakın plan / geniş plan kesmeleri), dudak senkronu S.agiz().
 * Neco: iri kafalı, göbekli, parlak kahverengi kabuklu, bıyıklı erkek hamam böceği. Tüm çekimlerde aynı çizim fonksiyonu.
 */
(function () {
  const { W, H, clamp, lerp, ease, ramp, pencere, rng, fbm, tuval, gurultuDokusu, yazi, FONT } = STUDIO.R;
  const { kamera, parilti, bokeh, kf, TAU } = STUDIO.K;
  const { BAS, SAC } = STUDIO.KR;
  const A = {};
  const AY = '120,160,255', KIRMIZI = '255,60,40';
  const RP = i => STUDIO.TL.replikler[i];

  // ======================= NECO (karakter modeli) =======================
  const K = { koyu: '#2a1208', orta: '#6e3418', acik: '#b8692f', parla: 'rgba(255,232,200,0.85)', gobek0: '#c98e55', gobek1: '#8a5428', rim: '#9a6a3a' };

  function kabukDolgu(ctx, x, y, r) {
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.45, r * 0.05, x, y, r * 1.15);
    g.addColorStop(0, K.acik); g.addColorStop(0.45, K.orta); g.addColorStop(1, K.koyu);
    return g;
  }
  function parlama(ctx, x, y, rx, ry, a, alfa = 0.75) {
    ctx.save(); ctx.globalAlpha *= alfa; ctx.translate(x, y); ctx.rotate(a);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, 'rgba(255,240,215,0.95)'); g.addColorStop(1, 'rgba(255,240,215,0)');
    ctx.scale(1, ry / rx); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rx, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function kilcik(ctx, x0, y0, x1, y1, n, yon) {         // bacak/kol üzerindeki dikenler
    ctx.save(); ctx.strokeStyle = K.koyu; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), nx = -dy / L * yon, ny = dx / L * yon;
    for (let i = 1; i <= n; i++) { const u = i / (n + 1), px = x0 + dx * u, py = y0 + dy * u; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + nx * 9 + dx / L * 5, py + ny * 9 + dy / L * 5); ctx.stroke(); }
    ctx.restore();
  }
  function uzuv(ctx, pts, kal, renk) {                    // eklemli kalın uzuv
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = 0; i < pts.length - 1; i++) {
      const w = kal * (1 - i * 0.18);
      ctx.strokeStyle = K.koyu; ctx.lineWidth = w + 4; ctx.beginPath(); ctx.moveTo(...pts[i]); ctx.lineTo(...pts[i + 1]); ctx.stroke();
      ctx.strokeStyle = renk; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(...pts[i]); ctx.lineTo(...pts[i + 1]); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,220,180,0.35)'; ctx.lineWidth = w * 0.25; ctx.beginPath();
      ctx.moveTo(pts[i][0] - w * 0.18, pts[i][1] - w * 0.18); ctx.lineTo(pts[i + 1][0] - w * 0.18, pts[i + 1][1] - w * 0.18); ctx.stroke();
      ctx.fillStyle = K.koyu; ctx.beginPath(); ctx.arc(...pts[i + 1], w * 0.42, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  function ik(sx, sy, hx, hy, L1, L2, bukum) {           // iki parçalı kol: dirsek konumu
    let dx = hx - sx, dy = hy - sy, d = Math.hypot(dx, dy);
    const m = L1 + L2 - 0.5; if (d > m) { hx = sx + dx / d * m; hy = sy + dy / d * m; dx = hx - sx; dy = hy - sy; d = m; }
    const a = Math.atan2(dy, dx), b = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1)) * bukum;
    return [[sx, sy], [sx + Math.cos(a + b) * L1, sy + Math.sin(a + b) * L1], [hx, hy]];
  }
  function el(ctx, x, y, a, yumruk) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.fillStyle = kabukDolgu(ctx, 0, 0, 16); ctx.strokeStyle = K.koyu; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, 0, 15, 13, 0, 0, TAU); ctx.fill(); ctx.stroke();
    const parmak = yumruk ? 5 : 15;
    for (const [ang, uz] of [[-0.6, 1], [0, 1.1], [0.6, 0.95]]) {
      ctx.save(); ctx.rotate(ang); ctx.beginPath(); ctx.ellipse(12 + parmak * uz * 0.5, 0, parmak * uz * 0.6 + 4, 5.5, 0, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore();
    }
    ctx.restore();
  }
  function cekirdekCiz(ctx, x, y, a, s = 1, yarim = 0) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.scale(s, s);
    const kab = (yon) => {
      ctx.save(); if (yarim) { ctx.translate(yon * yarim * 6, 0); ctx.rotate(yon * yarim * 0.6); }
      ctx.beginPath(); ctx.moveTo(0, -13); ctx.quadraticCurveTo(yon * 9, -4, yon * 0.5, 13); ctx.lineTo(0, 13); ctx.closePath();
      ctx.fillStyle = '#141414'; ctx.fill();
      ctx.strokeStyle = 'rgba(235,235,225,0.9)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(yon * 3, -9); ctx.quadraticCurveTo(yon * 6, 0, yon * 2, 10); ctx.stroke();
      ctx.restore();
    };
    kab(-1); kab(1);
    ctx.restore();
  }

  /* neco(ctx, x, y, s, p) — ayak tabanı (x,y), s ölçek (s=1 → ~330 px boy)
   * p: t, ayakta 0..1, agiz 0..1, ofke 0..1, alay 0..1, kirp 0..1 (sol göz kırpma), bak [x,y] (-1..1),
   *    kolAc 0..1, isaret 0..1, sallama 0..1, yeme 0..1 (çekirdeği ağza götürme), cekirdek bool, kir 0..1,
   *    anten 0..1 (titreme), egim, zipla, basEgim, rim 'r,g,b' */
  function neco(ctx, x, y, s, p) {
    const t = p.t || 0, ay = p.ayakta ?? 0, rim = p.rim || AY;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    // zemin gölgesi
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(0, 2, 105, 13, 0, 0, TAU); ctx.fill();
    ctx.translate(0, -(p.zipla || 0)); ctx.rotate(p.egim || 0);
    const nefes = Math.sin(t * 2.3) * 2.2 + (p.agiz || 0) * 2;
    const gy = lerp(-88, -150, ay) + nefes * 0.3;          // göbek merkezi
    const hy = gy - 150 - nefes * 0.4;                     // baş merkezi
    // --- bacaklar ---
    for (const k of [-1, 1]) {
      const kalca = [k * 34, gy + 62];
      const pts = ay > 0.5
        ? [kalca, [k * 44, lerp(gy + 62, -60, 0.55)], [k * 40, -8], [k * 62, -4]]
        : [kalca, [k * 70, gy + 30 + 20], [k * 84, -12], [k * 104, -6]];
      uzuv(ctx, pts, 20, K.orta);
      kilcik(ctx, ...pts[1], ...pts[2], 3, k);
    }
    // --- orta bacaklar (yanlara açılan ince böcek bacakları) ---
    for (const k of [-1, 1]) {
      const b0 = [k * 62, gy + 10], b1 = [k * 112, gy - 6 + Math.sin(t * 3 + k) * 4], b2 = [k * 138, gy + 46];
      uzuv(ctx, [b0, b1, b2], 9, K.orta); kilcik(ctx, ...b1, ...b2, 3, -k);
    }
    // --- kanatlar (arkadan yanlara taşan parlak kabuk) ---
    ctx.save();
    ctx.fillStyle = `rgba(${rim},0.55)`; ctx.beginPath(); ctx.ellipse(4, gy - 18, 92, 118, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = kabukDolgu(ctx, -10, gy - 40, 120); ctx.beginPath(); ctx.ellipse(0, gy - 18, 90, 116, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = K.koyu; ctx.lineWidth = 3; ctx.stroke();
    parlama(ctx, -48, gy - 70, 34, 70, 0.25, 0.5);
    ctx.restore();
    // --- göbek ---
    ctx.save();
    const gg = ctx.createRadialGradient(-20, gy - 20, 10, 0, gy, 92);
    gg.addColorStop(0, K.gobek0); gg.addColorStop(1, K.gobek1);
    ctx.fillStyle = gg; ctx.beginPath(); ctx.ellipse(0, gy + 6, 66 + nefes, 78 + nefes * 0.6, 0, 0, TAU); ctx.fill();
    ctx.clip();
    ctx.strokeStyle = 'rgba(70,35,15,0.55)'; ctx.lineWidth = 3;
    for (let i = -3; i <= 4; i++) { ctx.beginPath(); ctx.ellipse(0, gy + i * 19 - 40, 80, 26, 0, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); }
    parlama(ctx, -24, gy - 20, 22, 30, 0, 0.45);
    ctx.restore();
    // --- kollar ---
    const omuz = k => [k * 64, gy - 70];
    const elHedef = k => {
      // k=-1: Neco'nun sağ eli (ekranın solu) — çekirdek eli
      let h = [k * 48, gy + 12];                                        // göbek üstünde dinlenme
      if (k === -1 && p.yeme) h = [lerp(h[0], -16, p.yeme), lerp(h[1], hy + 62, p.yeme)];
      if (p.kolAc) h = [lerp(h[0], k * 170, p.kolAc), lerp(h[1], gy - 120, p.kolAc)];
      if (p.isaret && k === (p.isaretYon || 1)) h = [lerp(h[0], k * 185, p.isaret), lerp(h[1], gy - 150, p.isaret)];
      if (p.sallama) h = [h[0] + Math.sin(t * 15 + k) * 18 * p.sallama, h[1] + Math.cos(t * 13 + k) * 14 * p.sallama];
      if (p.belde && k === 1) h = [lerp(h[0], 78, p.belde), lerp(h[1], gy + 18, p.belde)];
      return h;
    };
    const kolCiz = k => {
      const [o, d, e] = ik(...omuz(k), ...elHedef(k), 68, 68, -k);
      uzuv(ctx, [o, d, e], 15, K.orta); kilcik(ctx, ...d, ...e, 3, k);
      const a = Math.atan2(e[1] - d[1], e[0] - d[0]);
      el(ctx, e[0], e[1], a, (p.yumruk || 0) > 0.5);
      if (k === -1 && p.cekirdek) cekirdekCiz(ctx, e[0] + Math.cos(a) * 18, e[1] + Math.sin(a) * 18, a + 1.4, 1, p.kir || 0);
    };
    kolCiz(1);
    // --- pronotum (başın arkasındaki kalkan; açık renkli kenar) ---
    ctx.save();
    ctx.fillStyle = K.rim; ctx.beginPath(); ctx.ellipse(0, hy + 76, 104, 50, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = kabukDolgu(ctx, -10, hy + 60, 100); ctx.beginPath(); ctx.ellipse(0, hy + 79, 98, 45, 0, 0, TAU); ctx.fill();
    parlama(ctx, -40, hy + 58, 30, 12, 0, 0.6);
    ctx.restore();
    // --- baş ---
    ctx.save(); ctx.translate(0, hy); ctx.rotate(p.basEgim || 0); ctx.scale(1.2, 1.2);
    // antenler (başın arkasından)
    for (const k of [-1, 1]) {
      const tit = (p.anten || 0) * Math.sin(t * 22 + k * 2) * 0.25, sal = Math.sin(t * 1.7 + k) * 0.08 + tit;
      ctx.strokeStyle = K.koyu; ctx.lineCap = 'round';
      let px = k * 24, py = -58, a = -Math.PI / 2 + k * 0.32;
      for (let i = 0; i < 24; i++) {
        a += k * (0.035 + 0.012 * i) * (1 + sal * 3) + (p.anten || 0) * Math.sin(t * 30 + i * 0.6) * 0.03;
        const nx = px + Math.cos(a) * 12, ny = py + Math.sin(a) * 12;
        ctx.lineWidth = 6.5 - i * 0.22; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(nx, ny); ctx.stroke();
        if (i % 3 === 1) { ctx.strokeStyle = 'rgba(200,120,60,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(nx, ny, 3, 0, TAU); ctx.stroke(); ctx.strokeStyle = K.koyu; }
        px = nx; py = ny;
      }
    }
    // kafa
    ctx.fillStyle = `rgba(${rim},0.7)`; ctx.beginPath(); ctx.ellipse(4, -2, 86, 74, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = kabukDolgu(ctx, 0, -8, 86); ctx.beginPath(); ctx.ellipse(0, 0, 84, 72, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = K.koyu; ctx.lineWidth = 3; ctx.stroke();
    parlama(ctx, -34, -42, 30, 14, -0.3, 0.8);
    // ağız parçaları (palpler)
    for (const k of [-1, 1]) {
      const sl = Math.sin(t * 6 + k) * 3 + (p.agiz || 0) * 6;
      uzuv(ctx, [[k * 30, 48], [k * 42, 64 + sl], [k * 36, 80 + sl]], 7, K.orta);
    }
    // gözler
    const bak = p.bak || [0, 0];
    for (const k of [-1, 1]) {
      const ex = k * 34, ey = -10;
      const kapak = clamp(Math.max(p.ofke * 0.38, p.alay * 0.45, k === -1 ? (p.kirp || 0) : 0, p.uyku || 0, (p.gozKirp || 0)));
      ctx.save(); ctx.translate(ex, ey);
      ctx.fillStyle = '#fbf6ee'; ctx.beginPath(); ctx.ellipse(0, 0, 29, 35, k * 0.08, 0, TAU); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, 29, 35, k * 0.08, 0, TAU); ctx.clip();
      const sg = ctx.createRadialGradient(0, 8, 10, 0, 0, 40); sg.addColorStop(0, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(60,30,10,0.45)');
      ctx.fillStyle = sg; ctx.fillRect(-30, -36, 60, 72);
      const px = bak[0] * 11, py = bak[1] * 13 + 3;
      ctx.fillStyle = '#4a2a12'; ctx.beginPath(); ctx.arc(px, py, 15, 0, TAU); ctx.fill();
      ctx.fillStyle = '#060402'; ctx.beginPath(); ctx.arc(px, py, 10, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px - 4, py - 5, 4.2, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(px + 4, py + 4, 1.8, 0, TAU); ctx.fill();
      // üst göz kapağı (öfke: iç köşe aşağı)
      if (kapak > 0.01) {
        const lv = lerp(-37, 37, kapak), egik = (p.ofke || 0) * 14 * k * -1 + (p.alay || 0) * 4;
        ctx.fillStyle = kabukDolgu(ctx, 0, -20, 40);
        ctx.beginPath(); ctx.moveTo(-34, -40); ctx.lineTo(34, -40); ctx.lineTo(34, lv - egik); ctx.quadraticCurveTo(0, lv + 6, -34, lv + egik); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = K.koyu; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(34, lv - egik); ctx.quadraticCurveTo(0, lv + 6, -34, lv + egik); ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle = K.koyu; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 0, 29, 35, k * 0.08, 0, TAU); ctx.stroke();
      ctx.restore();
      // kaşlar
      const ofk = p.ofke || 0, kalk = k === 1 ? (p.alay || 0) * 10 : 0;
      ctx.save(); ctx.strokeStyle = '#140804'; ctx.lineWidth = 11; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(ex - k * 22, ey - 48 + ofk * 16 - kalk * 0.3); ctx.quadraticCurveTo(ex, ey - 58 - kalk, ex + k * 26, ey - 50 - ofk * 8 - kalk); ctx.stroke();
      ctx.restore();
    }
    // bıyık (gür, Anadolu bıyığı)
    const ag = clamp(p.agiz || 0), al = p.alay || 0;
    ctx.save(); ctx.translate(0, 36 - ag * 3);
    ctx.fillStyle = '#120703';
    for (const k of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(0, -4);
      ctx.bezierCurveTo(k * 18, -14, k * 40, -10, k * 52, 6 + (k === 1 ? -al * 6 : 0));
      ctx.bezierCurveTo(k * 40, 4, k * 22, 8, 0, 6); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(120,70,40,0.5)'; ctx.lineWidth = 1.5;
    for (let i = -6; i <= 6; i++) { if (!i) continue; ctx.beginPath(); ctx.moveTo(i * 6, -4); ctx.lineTo(i * 7.5, 5); ctx.stroke(); }
    ctx.restore();
    // ağız
    ctx.save(); ctx.translate(al * 6, 56);
    if (ag > 0.04) {
      const w = 24 + ag * 12, h = 5 + ag * 28;
      ctx.fillStyle = '#2a0606'; ctx.beginPath(); ctx.ellipse(0, h * 0.4, w, h, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#c24a4a'; ctx.beginPath(); ctx.ellipse(0, h * 1.0, w * 0.6, h * 0.45, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#f2ead8'; ctx.fillRect(-w * 0.6, h * 0.4 - h + 1, w * 1.2, Math.min(7, h * 0.35));
      ctx.strokeStyle = K.koyu; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, h * 0.4, w, h, 0, 0, TAU); ctx.stroke();
    } else {
      ctx.strokeStyle = '#1a0a04'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-18, 2 + al * 2); ctx.quadraticCurveTo(0, 6 - (p.ofke || 0) * 6, 18, 2 - al * 9); ctx.stroke();
    }
    ctx.restore();
    ctx.restore(); // baş
    kolCiz(-1);
    ctx.restore();
  }

  // ======================= İNSAN (önden yüz) =======================
  const TEN0 = '#e8b898', TEN1 = '#a7705a';
  function insanYuz(ctx, x, y, s, p) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s / 100, s / 100); ctx.rotate(p.egim || 0);
    const ay = p.ay ?? 1, kr = p.kirmizi ?? 0.6;
    // kulaklar
    ctx.fillStyle = TEN1; for (const k of [-1, 1]) { ctx.beginPath(); ctx.ellipse(k * 47, 6, 9, 15, 0, 0, TAU); ctx.fill(); }
    // yüz
    const g = ctx.createRadialGradient(-14, -8, 6, 0, 6, 80);
    g.addColorStop(0, '#f0c6a8'); g.addColorStop(0.6, TEN0); g.addColorStop(1, '#8a5848');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 6, 46, 61, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, 6, 46, 61, 0, 0, TAU); ctx.clip();
    // sakal gölgesi (uykusuz, tıraşsız)
    ctx.globalAlpha = 0.5; ctx.drawImage(A.sakal, -50, 10, 100, 62); ctx.globalAlpha = 1;
    // ay ışığı (sağ) ve saat kırmızısı (sol) kenar ışıkları
    let kg = ctx.createLinearGradient(46, 0, 18, 0); kg.addColorStop(0, `rgba(${AY},${0.55 * ay})`); kg.addColorStop(1, `rgba(${AY},0)`);
    ctx.fillStyle = kg; ctx.fillRect(0, -60, 50, 140);
    kg = ctx.createLinearGradient(-46, 0, -16, 0); kg.addColorStop(0, `rgba(${KIRMIZI},${0.45 * kr})`); kg.addColorStop(1, `rgba(${KIRMIZI},0)`);
    ctx.fillStyle = kg; ctx.fillRect(-50, -60, 40, 140);
    ctx.restore();
    // saç (dağınık)
    ctx.fillStyle = '#1b130f';
    ctx.beginPath(); ctx.moveTo(-50, 4); ctx.quadraticCurveTo(-60, -60, -4, -68); ctx.quadraticCurveTo(58, -66, 50, -2);
    ctx.quadraticCurveTo(44, -30, 28, -36); ctx.lineTo(30, -46); ctx.lineTo(14, -34); ctx.quadraticCurveTo(-4, -30, -12, -40); ctx.lineTo(-18, -30);
    ctx.quadraticCurveTo(-38, -32, -50, 4); ctx.fill();
    for (const [a, b, c, d] of [[-20, -66, -34, -86], [6, -68, 4, -90], [26, -62, 42, -80], [-38, -54, -58, -66]]) { ctx.beginPath(); ctx.moveTo(a - 8, b + 4); ctx.quadraticCurveTo(c, d, a + 8, b + 2); ctx.fill(); }
    // kaşlar (endişe: iç uçlar yukarı)
    const ger = p.gergin || 0;
    ctx.strokeStyle = '#24170f'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(k * 8, -19 - ger * 7); ctx.quadraticCurveTo(k * 20, -25 - ger * 3, k * 33, -18 + ger * 2); ctx.stroke(); }
    if (ger > 0.3) { ctx.strokeStyle = `rgba(110,60,45,${(ger - 0.3) * 0.8})`; ctx.lineWidth = 1.5; for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(k * 4, -26); ctx.lineTo(k * 6, -16); ctx.stroke(); } }
    // gözler
    const acik = clamp(p.goz ?? 1), bak = p.bak || [0, 0];
    for (const k of [-1, 1]) {
      const ex = k * 19, ey = -4;
      // göz altı torbaları
      ctx.fillStyle = 'rgba(90,50,60,0.35)'; ctx.beginPath(); ctx.ellipse(ex, ey + 9, 11, 4, 0, 0, Math.PI); ctx.fill();
      if (acik > 0.08) {
        const ry = 6.4 * acik;
        ctx.save(); ctx.fillStyle = '#efe6e0'; ctx.beginPath(); ctx.ellipse(ex, ey, 10.5, ry, 0, 0, TAU); ctx.fill(); ctx.clip();
        const px = ex + bak[0] * 4, py = ey + bak[1] * 3;
        ctx.fillStyle = '#3e2618'; ctx.beginPath(); ctx.arc(px, py, 5.6, 0, TAU); ctx.fill();
        ctx.fillStyle = '#080504'; ctx.beginPath(); ctx.arc(px, py, 2.8, 0, TAU); ctx.fill();
        ctx.fillStyle = `rgba(${AY},0.95)`; ctx.beginPath(); ctx.arc(px + 1.8, py - 1.8, 1.3, 0, TAU); ctx.fill();
        ctx.restore();
        ctx.strokeStyle = '#2a1a12'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.ellipse(ex, ey, 11, ry + 0.4, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
      } else {
        ctx.strokeStyle = '#2a1a12'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(ex - 10, ey); ctx.quadraticCurveTo(ex, ey + 3 + ger * 1.5, ex + 10, ey); ctx.stroke();
        if (ger > 0.3) { ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ex - 9, ey - 3); ctx.quadraticCurveTo(ex, ey - 1, ex + 9, ey - 3); ctx.stroke(); }
      }
    }
    // burun
    ctx.strokeStyle = 'rgba(120,70,50,0.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(3, 2); ctx.quadraticCurveTo(8, 16, 2, 21); ctx.stroke();
    ctx.fillStyle = 'rgba(110,55,45,0.45)'; for (const k of [-1, 1]) { ctx.beginPath(); ctx.ellipse(k * 6, 22, 3, 1.6, 0, 0, TAU); ctx.fill(); }
    // ağız (dudak senkronu)
    const ag = clamp(p.agiz || 0);
    if (ag > 0.04) {
      const w = 11 + ag * 3, h = 2 + ag * 9;
      ctx.fillStyle = '#3a0e0e'; ctx.beginPath(); ctx.ellipse(0, 38, w, h, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#efe4d8'; ctx.fillRect(-w * 0.6, 38 - h + 0.5, w * 1.2, Math.min(3.5, h * 0.4));
      ctx.strokeStyle = '#8a3c34'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(0, 38, w + 1, h + 1, 0, 0, TAU); ctx.stroke();
    } else {
      ctx.strokeStyle = '#8a3c34'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-13, 38); ctx.quadraticCurveTo(0, 36 - ger * 2, 13, 39); ctx.stroke();
    }
    ctx.restore();
  }

  // ======================= DÜNYA: durumlar (küresel zamana bağlı) =======================
  function insanDurum(gt) {
    const r = RP;
    const goz = gt < r(0).start - 0.75 ? 0 : gt < r(1).end + 0.7 ? 1 - pencere(gt, r(0).start + 1.2, r(0).start + 1.35, 0.06) : gt < r(3).end + 0.35 ? 0 : gt < r(6).end + 0.6 ? 1 - pencere(gt, r(5).start + 2, r(5).start + 2.15, 0.06) : 0;
    const oturus = kf(gt, [[r(3).end + 0.3, 0], [r(3).end + 0.7, 1], [r(6).end + 0.4, 1], [r(6).end + 1.0, 0]], ease.out);
    const yorgan = kf(gt, [[r(1).end + 0.75, 0], [r(1).end + 1.6, 1], [r(6).end + 0.6, 1], [r(6).end + 1.3, 2]]);
    const donme = pencere(gt, r(1).end + 0.45, r(2).start + 0.1, 0.25) * Math.sin((gt - r(1).end) * 9);
    const gergin = Math.max(pencere(gt, r(2).start - 0.4, r(2).end + 0.6, 0.3), 0.6 * pencere(gt, r(4).start - 0.2, r(4).end + 0.5, 0.2), 0.35 * pencere(gt, r(0).start, r(0).end + 0.4, 0.3));
    return { goz, oturus, yorgan, donme, gergin };
  }
  function necoDurum(gt) {
    const r = RP;
    const ziplaU = ramp(gt, r(5).end + 0.15, r(5).end + 0.75, x => x);
    const ayakta = kf(gt, [[r(2).end + 0.2, 0], [r(2).end + 0.55, 1], [r(5).end + 0.15, 1], [r(5).end + 0.2, 0.6], [r(5).end + 0.75, 0.6], [r(5).end + 0.9, 0]]);
    const yeme = Math.max(pencere(gt, r(0).end + 0.1, r(1).start + 0.05, 0.25) * 1, pencere(gt, r(6).start - 0.85, r(6).start - 0.05, 0.25));
    const kir = Math.max(ramp(gt, r(1).start - 0.32, r(1).start - 0.12), ramp(gt, r(6).start - 0.32, r(6).start - 0.12)) * (gt < r(1).start + 0.5 || gt > r(6).start - 0.4 ? 1 : 0);
    const cekirdek = gt < r(1).start + 0.25 || (gt > r(5).end + 0.8 && gt < r(6).start + 0.2);
    const ofke = Math.max(pencere(gt, r(1).start - 0.05, r(1).start + 1.0, 0.1), 0.55 * pencere(gt, r(1).start, r(1).end, 0.3), 0.6 * pencere(gt, r(3).start, r(3).end, 0.3), pencere(gt, r(5).start - 0.1, r(5).end + 0.2, 0.2));
    const alay = Math.max(0.7 * pencere(gt, r(6).start - 0.6, STUDIO.TL.toplam + 1, 0.3), 0.5 * pencere(gt, r(1).start + 1.4, r(1).end, 0.3));
    const kolAc = pencere(gt, r(3).start - 0.1, r(3).end + 0.15, 0.3);
    const sallama = pencere(gt, r(5).start, r(5).end, 0.25) * 0.8;
    const isaret = Math.max(pencere(gt, r(1).start + 1.2, r(1).end, 0.25), 0.8 * pencere(gt, r(6).start + 1.2, r(6).end, 0.2));
    const anten = Math.max(pencere(gt, r(5).start, r(5).end + 0.3, 0.2), 0.6 * pencere(gt, r(1).start, r(1).start + 1.2, 0.1));
    const kirp = pencere(gt, STUDIO.TL.toplam - 1.1, STUDIO.TL.toplam - 0.55, 0.08);
    return { ayakta, yeme, kir, cekirdek, ofke, alay, kolAc, sallama, isaret, anten, kirp, ziplaU };
  }

  // ======================= ORTAM ÇİZİMLERİ =======================
  function duvar(ctx, ox, oy, z) {
    ctx.fillStyle = '#0b1020'; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.translate(ox, oy); ctx.scale(z, z);
    ctx.globalCompositeOperation = 'screen'; ctx.drawImage(A.panjur, -300, -200); ctx.restore();
  }
  function saatCiz(ctx, x, y, s, gt) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    const g = ctx.createLinearGradient(0, -70, 0, 70); g.addColorStop(0, '#222830'); g.addColorStop(1, '#0c0f14');
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-130, -62, 260, 124, 26); ctx.fill();
    ctx.strokeStyle = 'rgba(160,180,220,0.25)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#05070a'; ctx.beginPath(); ctx.roundRect(-112, -46, 224, 92, 14); ctx.fill();
    const iki = Math.floor(gt * 1.0) % 2 === 0;
    yazi(ctx, iki ? '03:17' : '03 17', 0, 2, { boyut: 76, agirlik: 800, renk: '#ff3b2e', golgeRenk: 'rgba(255,40,20,0.95)', golgeBulanik: 26, aralik: 2 });
    ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35; ctx.drawImage(parilti(KIRMIZI), x - 260 * s, y - 220 * s, 520 * s, 440 * s); ctx.restore();
  }
  function komodin(ctx, x, y, w) {
    const g = ctx.createLinearGradient(0, y, 0, y + 600); g.addColorStop(0, '#3a2618'); g.addColorStop(1, '#120a06');
    ctx.fillStyle = g; ctx.fillRect(x, y, w, 900);
    ctx.fillStyle = '#5a3c26'; ctx.fillRect(x, y - 18, w, 22);
    ctx.fillStyle = 'rgba(255,200,150,0.18)'; ctx.fillRect(x, y - 18, w, 4);
    ctx.drawImage(A.ahsap, x, y - 18, w, 22);
  }

  // ---------- Çekim: insan yatıyor, yukarıdan yüz ----------
  function yuzYatik(ctx, u, gt, S) {
    const I = insanDurum(gt);
    ctx.fillStyle = '#0d1424'; ctx.fillRect(0, 0, W, H);
    const z = lerp(1.0, 1.22, ease.inOut(clamp(u / 6))) + (I.goz > 0.5 && gt < RP(0).start ? 0.0 : 0);
    ctx.save(); kamera(ctx, 540 + Math.sin(gt * 0.6) * 6, 820 + Math.cos(gt * 0.5) * 5, z, Math.sin(gt * 0.3) * 0.01);
    // çarşaf ve yastık
    ctx.drawImage(A.carsaf, -200, -200, W + 400, H + 400);
    const yg = ctx.createRadialGradient(470, 640, 40, 540, 700, 520);
    yg.addColorStop(0, '#c7d0e4'); yg.addColorStop(0.6, '#6f7a96'); yg.addColorStop(1, '#2a3048');
    ctx.fillStyle = yg; ctx.beginPath(); ctx.roundRect(110, 380, 860, 640, 180); ctx.fill();
    ctx.strokeStyle = 'rgba(20,24,40,0.35)'; ctx.lineWidth = 10;
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(200 + i * 160, 420); ctx.quadraticCurveTo(230 + i * 160, 640, 180 + i * 170, 980); ctx.stroke(); }
    ctx.fillStyle = 'rgba(10,14,30,0.4)'; ctx.beginPath(); ctx.ellipse(540, 900, 300, 120, 0, 0, TAU); ctx.fill();
    // boyun + omuz (tişört)
    ctx.fillStyle = '#26384a'; ctx.beginPath(); ctx.ellipse(540, 1330, 420, 260, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = TEN1; ctx.fillRect(490, 1000, 100, 180);
    // yüz
    const ag = S.agiz('insan');
    const don = I.donme * 0.12;
    insanYuz(ctx, 540 + I.donme * 20, 860, 520, { goz: I.goz, agiz: ag, gergin: I.gergin, bak: [0.1, -0.9 + I.goz * 0.2], egim: don });
    // yorgan (aşağıdan yukarı)
    const yy = lerp(1300, 1080, clamp(I.yorgan)) + Math.sin(gt * 1.4) * 4;
    const yo = ctx.createLinearGradient(0, yy, 0, yy + 600); yo.addColorStop(0, '#5a6a94'); yo.addColorStop(0.15, '#33406a'); yo.addColorStop(1, '#141a32');
    ctx.fillStyle = yo; ctx.beginPath(); ctx.moveTo(-200, yy + 40);
    for (let x = -200; x <= 1280; x += 60) ctx.lineTo(x, yy + Math.sin(x * 0.012 + gt * 0.8 + I.donme * 2) * 22 + (Math.abs(x - 540) < 260 ? -20 : 10));
    ctx.lineTo(1280, 2200); ctx.lineTo(-200, 2200); ctx.fill();
    ctx.drawImage(A.yorganDoku, -200, yy, 1480, 1000);
    ctx.restore();
    // ay ışığı panjur gölgesi üstten
    ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = 0.7; ctx.drawImage(A.panjur, -500, -300, 2200, 2400); ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.25; ctx.drawImage(parilti(KIRMIZI), -600, 300, 1100, 1100); ctx.restore();
  }

  // ---------- Çekim: insan oturmuş, önden ----------
  function yuzDik(ctx, u, gt, S) {
    const I = insanDurum(gt);
    duvar(ctx, -80 - u * 10, -100, 1.0);
    ctx.save(); ctx.filter = 'blur(10px)'; komodin(ctx, 820, 1250, 400); saatCiz(ctx, 960, 1170, 0.7, gt); ctx.restore();
    ctx.save(); kamera(ctx, 540, 900, lerp(1.0, 1.12, ease.out(clamp(u / 3))), Math.sin(gt * 0.4) * 0.012);
    ctx.fillStyle = '#26384a'; ctx.beginPath(); ctx.ellipse(540, 1720, 470, 420, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(${AY},0.45)`; ctx.lineWidth = 6; ctx.stroke();
    ctx.fillStyle = TEN1; ctx.fillRect(482, 1140, 116, 220);
    insanYuz(ctx, 540, 900, 560, { goz: I.goz, agiz: S.agiz('insan'), gergin: 0.8, bak: [-0.2, -0.5], kirmizi: 0.8 });
    ctx.restore();
  }

  // ---------- Çekim: Neco komodinin üstünde ----------
  function necoKomodin(ctx, u, gt, S) {
    const N = necoDurum(gt);
    const kx = Math.sin(gt * 0.35) * 30 + u * 8;
    duvar(ctx, -200 - kx * 0.4, -60, 1.1);
    const z = lerp(1.0, 1.1, ease.inOut(clamp(u / 5)));
    ctx.save(); kamera(ctx, 540 + kx * 0.3, 1000, z, Math.sin(gt * 0.5) * 0.008);
    ctx.save(); ctx.filter = 'blur(3px)'; saatCiz(ctx, 210, 1140, 1.05, gt); ctx.restore();
    komodin(ctx, -300, 1340, 1700);
    // kırmızı ışık komodinde
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.3; ctx.drawImage(parilti(KIRMIZI), -150, 1150, 800, 400); ctx.restore();
    const bakis = N.kolAc > 0.3 || N.kirp > 0 ? [0, 0.1] : [0.85, 0.05];
    neco(ctx, 600, 1335, 2.15, { t: gt, ayakta: N.ayakta, agiz: S.agiz('neco'), ofke: N.ofke, alay: N.alay, kolAc: N.kolAc, sallama: N.sallama, yumruk: N.sallama, isaret: N.isaret, isaretYon: 1,
      yeme: N.yeme, cekirdek: N.cekirdek, kir: N.kir, anten: N.anten, bak: bakis, zipla: Math.abs(Math.sin(gt * 9)) * 10 * N.sallama, rim: AY, basEgim: Math.sin(gt * 1.1) * 0.03 });
    // çıtlayan kabuklar
    kabukParca(ctx, gt, 600, 1335, 2.15);
    ctx.restore();
    // ön plan: bulanık yastık kenarı (derinlik)
    ctx.save(); ctx.filter = 'blur(26px)'; ctx.fillStyle = '#4a5578'; ctx.beginPath(); ctx.ellipse(1150 - kx * 0.8, 1750, 420, 260, -0.3, 0, TAU); ctx.fill(); ctx.restore();
  }
  function kabukParca(ctx, gt, x, y, s) {
    for (const t0 of [RP(1).start - 0.15, RP(6).start - 0.15]) {
      const u = gt - t0; if (u < 0 || u > 1.2) continue;
      for (let k = 0; k < 2; k++) {
        const vx = (k ? 1 : -1) * (140 + k * 60), vy = -380 - k * 80;
        const px = x - 60 * s + vx * u, py = y - 330 * s + vy * u + 900 * u * u;
        if (py > y) continue;
        ctx.save(); ctx.translate(px, py); ctx.rotate(u * 12 * (k ? 1 : -1)); ctx.scale(s, s);
        ctx.fillStyle = '#151515'; ctx.beginPath(); ctx.ellipse(0, 0, 4, 11, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(230,230,220,0.85)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(0, 8); ctx.stroke();
        ctx.restore();
      }
    }
  }

  // ---------- Çekim: Neco yatağın kenarında ----------
  function necoYatak(ctx, u, gt, S) {
    const N = necoDurum(gt), I = insanDurum(gt);
    const kx = Math.sin(gt * 0.4) * 20;
    duvar(ctx, -150, -100, 1.0);
    // arka planda bulanık oturan / yatan insan
    ctx.save(); ctx.filter = 'blur(14px)';
    const by = lerp(1250, 700, I.oturus);
    ctx.fillStyle = '#26384a'; ctx.beginPath(); ctx.ellipse(300 - kx, by + 300, 260, 330, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = TEN0; ctx.beginPath(); ctx.ellipse(300 - kx, by - 80, 120, 150, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1b130f'; ctx.beginPath(); ctx.ellipse(300 - kx, by - 170, 125, 80, 0, Math.PI, TAU); ctx.fill();
    // yorgan başını örttüyse
    if (I.yorgan > 1) { ctx.fillStyle = '#33406a'; ctx.globalAlpha = clamp(I.yorgan - 1); ctx.beginPath(); ctx.ellipse(300 - kx, 1150, 520, 420 * clamp(I.yorgan - 1), 0, 0, TAU); ctx.fill(); }
    ctx.restore();
    const z = lerp(1.05, 1.15, ease.inOut(clamp(u / 4)));
    ctx.save(); kamera(ctx, 560 + kx * 0.3, 1050, z, 0);
    // yorgan kenarı (Neco'nun oturduğu yer)
    const yo = ctx.createLinearGradient(0, 1350, 0, 2000); yo.addColorStop(0, '#5a6a94'); yo.addColorStop(0.1, '#33406a'); yo.addColorStop(1, '#10162a');
    ctx.fillStyle = yo; ctx.beginPath(); ctx.moveTo(-300, 1420);
    for (let x = -300; x <= 1400; x += 50) ctx.lineTo(x, 1370 + Math.sin(x * 0.01) * 26 + Math.sin(x * 0.031) * 10);
    ctx.lineTo(1400, 2300); ctx.lineTo(-300, 2300); ctx.fill();
    ctx.drawImage(A.yorganDoku, -300, 1360, 1700, 900);
    const bakis = N.kirp > 0 || u > 0 && gt > STUDIO.TL.toplam - 1.8 ? [0, 0.1] : [-0.9, -0.3];
    neco(ctx, 640, 1395, 2.05, { t: gt, ayakta: 0, agiz: S.agiz('neco'), ofke: N.ofke * 0.6, alay: N.alay, kirp: N.kirp, isaret: N.isaret, isaretYon: -1,
      yeme: N.yeme, cekirdek: N.cekirdek, kir: N.kir, anten: N.anten * 0.5, bak: bakis, rim: AY, basEgim: -0.04 + N.kirp * 0.08 });
    kabukParca(ctx, gt, 640, 1395, 2.05);
    ctx.restore();
    // göz kırpma parıltısı
    if (N.kirp > 0.3) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (N.kirp - 0.3) * 1.2; ctx.drawImage(parilti('255,230,160'), 470, 380, 120, 120); ctx.restore(); }
  }

  // ---------- Çekim: geniş plan, yan görünüş ----------
  function genis(ctx, u, gt, S) {
    const I = insanDurum(gt), N = necoDurum(gt);
    const kx = Math.sin(gt * 0.25) * 25 + u * 12;
    duvar(ctx, -200 - kx * 0.3, -150, 1.0);
    ctx.save(); kamera(ctx, 700 + kx, 1100, 0.88 + 0.03 * Math.sin(gt * 0.3), 0);
    // pencere silueti (sol üst)
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.25; ctx.drawImage(parilti(AY), -500, 100, 1000, 900); ctx.restore();
    // yatak başlığı + yatak
    const yatakY = 1290, basX = 820;
    ctx.fillStyle = '#20160f'; ctx.beginPath(); ctx.roundRect(basX + 120, 860, 70, 700, 18); ctx.fill();
    ctx.fillStyle = '#1a2236'; ctx.fillRect(-600, yatakY, 1600, 130);                         // şilte
    ctx.fillStyle = '#0d0a08'; ctx.fillRect(-600, yatakY + 130, 1600, 260);
    ctx.fillStyle = 'rgba(160,180,230,0.15)'; ctx.fillRect(-600, yatakY, 1600, 6);
    // yastık
    const yg = ctx.createLinearGradient(0, yatakY - 110, 0, yatakY); yg.addColorStop(0, '#a6b0cc'); yg.addColorStop(1, '#4a5474');
    ctx.fillStyle = yg; ctx.beginPath(); ctx.roundRect(basX - 160, yatakY - 105, 280, 112, 50); ctx.fill();
    // insan (yan görünüş): kalça ekseni etrafında doğrulma
    const kalca = [basX - 520, yatakY - 40];
    const aci = lerp(0, -Math.PI / 2 + 0.12, I.oturus) + I.donme * 0.04;
    const yon = [Math.cos(aci), Math.sin(aci)];
    const govdeL = 380, boyun = [kalca[0] + yon[0] * govdeL, kalca[1] + yon[1] * govdeL];
    // gövde (tişört)
    ctx.save(); ctx.translate(...kalca); ctx.rotate(aci);
    ctx.fillStyle = '#26384a'; ctx.beginPath(); ctx.roundRect(-60, -105, govdeL + 40, 165, 70); ctx.fill();
    ctx.strokeStyle = `rgba(${AY},0.45)`; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, -105); ctx.lineTo(govdeL - 30, -105); ctx.stroke();
    ctx.fillStyle = TEN1; ctx.fillRect(govdeL - 10, -40, 70, 56);
    ctx.restore();
    // kol (oturunca görünür): omuzdan dizlere
    if (I.oturus > 0.2) {
      const om = [kalca[0] + yon[0] * (govdeL - 50), kalca[1] + yon[1] * (govdeL - 50)];
      const dir = [kalca[0] + 120, kalca[1] - 60 - Math.sin(gt * 2) * 4];
      const [o, d, e] = ik(om[0], om[1], dir[0] + 90, dir[1] - 20, 150, 150, 1);
      ctx.save(); ctx.globalAlpha = clamp((I.oturus - 0.2) * 2); ctx.lineCap = 'round';
      ctx.strokeStyle = '#1f2f40'; ctx.lineWidth = 62; ctx.beginPath(); ctx.moveTo(...o); ctx.lineTo(...d); ctx.stroke();
      ctx.strokeStyle = TEN1; ctx.lineWidth = 44; ctx.beginPath(); ctx.moveTo(...d); ctx.lineTo(...e); ctx.stroke();
      ctx.restore();
    }
    // baş (profil, KR.BAS): yatarken yüz yukarı
    ctx.save(); ctx.translate(boyun[0] + yon[0] * 15, boyun[1] + yon[1] * 15 - 40 * (1 - I.oturus));
    ctx.rotate(lerp(Math.PI / 2, 0, I.oturus) + I.donme * 0.25); ctx.scale(I.oturus < 0.5 ? -1.9 : 1.9, 1.9); ctx.translate(5, -58);
    const tg = ctx.createLinearGradient(50, -30, -30, 30); tg.addColorStop(0, '#d9a588'); tg.addColorStop(1, '#5a3428');
    ctx.save(); ctx.translate(1.5, -1); ctx.fillStyle = `rgba(${AY},0.8)`; ctx.fill(BAS); ctx.restore();
    ctx.fillStyle = tg; ctx.fill(BAS); ctx.fillStyle = '#1b130f'; ctx.fill(SAC);
    ctx.save(); ctx.translate(-2, -1.5); ctx.scale(1.04, 1.06); ctx.fill(SAC); ctx.restore();
    if (I.goz > 0.5) { ctx.fillStyle = '#0c0806'; ctx.beginPath(); ctx.ellipse(31.5, -8, 1.8, 1.5, 0, 0, TAU); ctx.fill(); }
    else { ctx.strokeStyle = '#2a1a12'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(28, -8); ctx.quadraticCurveTo(31.5, -6, 35, -8); ctx.stroke(); }
    ctx.restore();
    // yorgan
    ctx.save();
    const yo = ctx.createLinearGradient(0, yatakY - 260, 0, yatakY + 60); yo.addColorStop(0, '#5a6a94'); yo.addColorStop(0.3, '#3a4774'); yo.addColorStop(1, '#161c36');
    ctx.fillStyle = yo; ctx.beginPath(); ctx.moveTo(-700, yatakY + 70);
    const ust = x => {
      const lieTop = yatakY - 150 - 40 * Math.exp(-(((x - (kalca[0] - 260)) / 120) ** 2)) - 30 * Math.exp(-(((x - kalca[0]) / 140) ** 2));
      const ortu = clamp(I.yorgan);                                   // göğüs → çene
      const ucX = lerp(boyun[0] - 120, boyun[0] + 10, ortu) + (I.yorgan > 1 ? (I.yorgan - 1) * 230 : 0);
      let y = x < ucX ? lieTop : yatakY + 40;
      if (I.yorgan > 1 && x < ucX && x > boyun[0] - 40) y -= 70 * clamp(I.yorgan - 1) * Math.exp(-(((x - (boyun[0] + 90)) / 110) ** 2));
      // oturunca yorgan bele kadar
      const oturY = yatakY - 120 - 30 * Math.exp(-(((x - (kalca[0] - 260)) / 120) ** 2));
      const oturUc = kalca[0] + 90;
      const yo2 = x < oturUc ? oturY : yatakY + 40;
      return lerp(y, yo2, I.oturus) + Math.sin(x * 0.02 + I.donme * 3) * 6 * (1 + Math.abs(I.donme) * 3);
    };
    for (let x = -700; x <= 1100; x += 20) ctx.lineTo(x, Math.min(yatakY + 40, ust(x)));
    ctx.lineTo(1100, yatakY + 70); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(170,190,240,0.35)'; ctx.lineWidth = 4; ctx.beginPath();
    for (let x = -700; x <= 1100; x += 20) { const y = ust(x); if (y < yatakY + 38) (x === -700 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)); else ctx.moveTo(x, y); }
    ctx.stroke();
    ctx.restore();
    // komodin + saat + Neco
    komodin(ctx, basX + 210, 1180, 520);
    saatCiz(ctx, basX + 420, 1120, 0.5, gt);
    const komodinYer = [basX + 290, 1162], yatakYer = [kalca[0] + 190, yatakY - 112];
    const zu = N.ziplaU, nx = lerp(komodinYer[0], yatakYer[0], ease.inOut(zu)), ny = lerp(komodinYer[1], yatakYer[1], zu) - Math.sin(Math.PI * zu) * 220;
    neco(ctx, nx, ny, 0.55, { t: gt, ayakta: N.ayakta, agiz: S.agiz('neco'), ofke: N.ofke, alay: N.alay, kolAc: Math.max(N.kolAc, zu > 0 && zu < 1 ? 0.7 : 0), yeme: N.yeme, cekirdek: N.cekirdek, kir: N.kir,
      bak: [-0.9, 0], rim: AY, egim: Math.sin(Math.PI * zu) * -0.5, sallama: N.sallama });
    ctx.restore();
  }

  // ======================= ÇEKİM LİSTESİ =======================
  let PLAN = null;
  function plan() {
    if (PLAN) return PLAN;
    const r = RP, T = STUDIO.TL.toplam;
    PLAN = [
      { f: yuzYatik, a: 0, b: r(0).end + 0.15 },
      { f: necoKomodin, a: r(0).end + 0.15, b: r(1).end + 0.35, whip: 1 },
      { f: genis, a: r(1).end + 0.35, b: r(2).start - 0.05 },
      { f: yuzYatik, a: r(2).start - 0.05, b: r(2).end + 0.15 },
      { f: necoKomodin, a: r(2).end + 0.15, b: r(3).end + 0.25, whip: 1 },
      { f: genis, a: r(3).end + 0.25, b: r(4).start + 0.05 },
      { f: yuzDik, a: r(4).start + 0.05, b: r(4).end + 0.15 },
      { f: necoKomodin, a: r(4).end + 0.15, b: r(5).end + 0.08, whip: -1 },
      { f: genis, a: r(5).end + 0.08, b: r(6).start - 0.35 },
      { f: necoYatak, a: r(6).start - 0.35, b: r(6).end + 0.3 },
      { f: genis, a: r(6).end + 0.3, b: r(6).end + 1.45 },
      { f: necoYatak, a: r(6).end + 1.45, b: T + 1, whip: 1 },
    ];
    return PLAN;
  }

  VIDEO.sahne('_ortak', {
    hazirla() {
      const r = rng(5);
      // panjurdan sızan ay ışığı (eğik şeritler)
      const p = tuval(1700, 2300), x = p.getContext('2d');
      x.save(); x.translate(850, 700); x.rotate(-0.35); x.filter = 'blur(14px)';
      for (let i = -9; i < 9; i++) { x.fillStyle = `rgba(${AY},${0.16 + r() * 0.04})`; x.fillRect(-500, i * 70, 1000, 36); }
      x.restore(); A.panjur = p;
      A.carsaf = gurultuDokusu(270, 480, 40, 3, f => [70, 85, 120, 60 + f * 80], 3);
      A.yorganDoku = gurultuDokusu(300, 200, 18, 9, f => [180, 200, 255, (f - 0.5) * 70 + 10], 3);
      A.ahsap = gurultuDokusu(400, 20, 6, 4, f => [255, 220, 170, f * 40], 2);
      // sakal gölgesi (nokta dokusu)
      const s = tuval(200, 124), sx = s.getContext('2d');
      for (let i = 0; i < 2600; i++) { const px = r() * 200, py = r() * 124; if (Math.hypot((px - 100) / 100, (py - 20) / 104) > 1.0 || py < 34 && Math.abs(px - 100) < 70) continue; sx.fillStyle = `rgba(40,25,20,${0.25 + r() * 0.35})`; sx.fillRect(px, py, 1.4, 1.4); }
      A.sakal = s;
    },
    ciz() { },
  });

  VIDEO.sahne('oda', {
    ciz(ctx, S) {
      const gt = S.gt, P = plan();
      const c = P.find(c => gt >= c.a && gt < c.b) || P[P.length - 1];
      const u = gt - c.a;
      const w = c.whip ? 1 - ease.out(clamp(u / 0.22)) : 0;
      ctx.save();
      if (w > 0.01) { ctx.translate(c.whip * w * 260, 0); ctx.filter = `blur(${(w * 18).toFixed(1)}px)`; }
      c.f(ctx, u, gt, S);
      ctx.restore();
      // giriş: siyahtan uyanış, kırmızı saat yansıması
      bokeh(ctx, gt, 12, 9, '150,170,230', [2, 6], 0.15, 4);
    },
  });
})();
