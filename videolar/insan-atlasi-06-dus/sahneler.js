/* İnsan Atlası #06 — Neden en iyi cevapları duşta buluruz? (zihinsel gezinme)
 * Stil: minimalist 2D el çizimi, pastel renkler, temiz kontur, kağıt dokusu, sıcak banyo ışığı.
 * Karakter: İnsan Atlası #05'teki genç karakterin aynısı (kahverengi dalgalı saç + perçem, yuvarlak yüz).
 * Duşta çıplak omuzlar + köpüklü saç, sonda hardal bornoz.
 */
(function () {
  const { W, H, clamp, lerp, ease, ramp, pencere, rng, tuval, gurultuDokusu, yazi, FONT } = STUDIO.R;
  const TAU = Math.PI * 2;
  const A = {};
  const C = {
    kontur: '#3b2a26', ten: '#f2c9a8', tenG: '#e2a988', sac: '#6b4532', sacA: '#8a5c40', kazak: '#d9a441',
    krem: '#f7eee0', nane: '#bfe0d4', nane2: '#a5d0c3', mavi: '#9db4c8', suMavi: '#b9dcef', kiremit: '#cf8466', erik: '#9a7a9a',
    pembe: '#e9a7a0', altin: '#f0c66e', adacayi: '#a9bf9e', bornoz: '#e3b55a', rakip: '#8fa9c0',
  };

  // ---------------- el çizimi yardımcıları ----------------
  let KARE = 0;
  function titre(seed, i, g = 1.6) { const r = Math.sin(seed * 127.1 + i * 311.7 + KARE * 74.7) * 43758.5453; return ((r - Math.floor(r)) - 0.5) * 2 * g; }
  function yol(pts, seed, g = 1.6, kapali = true) {
    const p = pts.map(([x, y], i) => [x + titre(seed, i * 2, g), y + titre(seed, i * 2 + 1, g)]);
    const P = new Path2D();
    if (!kapali) {
      P.moveTo(...p[0]);
      for (let i = 1; i < p.length - 1; i++) P.quadraticCurveTo(p[i][0], p[i][1], (p[i][0] + p[i + 1][0]) / 2, (p[i][1] + p[i + 1][1]) / 2);
      P.lineTo(...p[p.length - 1]); return P;
    }
    const n = p.length, m = i => [(p[i % n][0] + p[(i + 1) % n][0]) / 2, (p[i % n][1] + p[(i + 1) % n][1]) / 2];
    P.moveTo(...m(0)); for (let i = 1; i <= n; i++) P.quadraticCurveTo(p[i % n][0], p[i % n][1], ...m(i)); P.closePath();
    return P;
  }
  function elips(cx, cy, rx, ry, n = 18, rot = 0) {
    return Array.from({ length: n }, (_, i) => { const a = i / n * TAU, x = Math.cos(a) * rx, y = Math.sin(a) * ry; return [cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]; });
  }
  function sekil(ctx, pts, seed, dolgu, o = {}) {
    const P = yol(pts, seed, o.g ?? 1.6, o.kapali !== false);
    if (dolgu) { ctx.fillStyle = dolgu; ctx.fill(P); }
    if (o.golge) { ctx.save(); ctx.clip(P); ctx.fillStyle = o.golge; ctx.translate(o.gx ?? 10, o.gy ?? 8); ctx.fill(yol(pts, seed + 99, 0)); ctx.restore(); }
    if (o.kontur !== false) { ctx.strokeStyle = o.renk || C.kontur; ctx.lineWidth = o.kal || 5; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(P); }
    return P;
  }
  function cizgi(ctx, pts, seed, kal = 5, renk = C.kontur) { ctx.strokeStyle = renk; ctx.lineWidth = kal; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(yol(pts, seed, 1.2, false)); }
  const dik = (x, y, w, h) => [[x, y], [x + w / 2, y], [x + w, y], [x + w, y + h / 2], [x + w, y + h], [x + w / 2, y + h], [x, y + h], [x, y + h / 2]];
  function yDik(x, y, w, h, r) {
    const p = [];
    for (const [cx, cy, a0] of [[x + w - r, y + r, -Math.PI / 2], [x + w - r, y + h - r, 0], [x + r, y + h - r, Math.PI / 2], [x + r, y + r, Math.PI]])
      for (let k = 0; k <= 3; k++) { const a = a0 + k / 3 * Math.PI / 2; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    return p;
  }
  function kolSekil(a, b, c, w) {
    const n = (p, q) => { const dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy) || 1; return [-dy / L * w, dx / L * w]; };
    const n1 = n(a, b), n2 = n(b, c);
    return [[a[0] + n1[0], a[1] + n1[1]], [b[0] + (n1[0] + n2[0]) / 2, b[1] + (n1[1] + n2[1]) / 2], [c[0] + n2[0] * 0.8, c[1] + n2[1] * 0.8],
      [c[0] - n2[0] * 0.8, c[1] - n2[1] * 0.8], [b[0] - (n1[0] + n2[0]) / 2, b[1] - (n1[1] + n2[1]) / 2], [a[0] - n1[0], a[1] - n1[1]]];
  }
  function kagit(ctx) { ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.22; ctx.drawImage(A.kagit, 0, 0, W, H); ctx.restore(); }

  // ---------------- KARAKTER ----------------
  /* kahraman(ctx, x, y, s, p): (x,y) boyun dibi.
   * p: t, goz 0..1, bak [x,y], gulus -1..1, ifade: 'normal' | 'kendinden' | 'sok' | 'huzur' | 'hulya',
   *    agiz 0..1 (konuşma), sagEl/solEl yerel [x,y], kiyafet: 'ciplak' | 'bornoz' | 'kazak', kopuk 0..1,
   *    ayakta (bacaklar), yuru (adım fazı), adim 0..1, egim, cocuk */
  function kahraman(ctx, x, y, s, p) {
    const t = p.t || 0, ck = p.cocuk ? 1 : 0, ifade = p.ifade || 'normal';
    const nef = Math.sin(t * 1.8) * 3 * (p.nefesGuc ?? 1);
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    const kiy = p.kiyafet || 'kazak';
    const renk = kiy === 'ciplak' ? C.ten : kiy === 'bornoz' ? C.bornoz : C.kazak;
    const omuzW = ck ? 120 : 170;
    const govdeH = p.ayakta ? 380 : 460;
    // bacaklar (ayakta, yürüyüş)
    if (p.ayakta) {
      for (const k of [-1, 1]) {
        const f = Math.sin((p.yuru || 0) + (k > 0 ? Math.PI : 0)) * (p.adim || 0);
        const kalca = [k * 60, govdeH - 20], ayak = [k * 62 + f * 60, govdeH + 330 - Math.max(0, -f) * 30];
        sekil(ctx, kolSekil(kalca, [lerp(kalca[0], ayak[0], 0.5) + f * 10, lerp(kalca[1], ayak[1], 0.5)], ayak, 34), 40 + k, C.ten, { kal: 5 });
        sekil(ctx, elips(ayak[0] + k * 14, ayak[1] + 10, 46, 20), 43 + k, '#f3d7c2', { kal: 4 });           // terlik
      }
    }
    // gövde
    const gov = [[-40, -8], [-omuzW + 20, 10 + nef], [-omuzW, 60 + nef], [-omuzW + 15, govdeH], [0, govdeH + 8], [omuzW - 15, govdeH], [omuzW, 60 + nef], [omuzW - 20, 10 + nef], [40, -8]];
    sekil(ctx, gov, 11, renk, { golge: kiy === 'ciplak' ? 'rgba(210,140,110,0.3)' : 'rgba(150,90,30,0.25)', gx: -16, gy: 0 });
    if (kiy === 'kazak') {
      ctx.save(); ctx.clip(yol(gov, 11, 0)); ctx.strokeStyle = 'rgba(120,80,30,0.25)'; ctx.lineWidth = 3;
      for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * 48, 60); for (let yy = 60; yy < govdeH; yy += 22) ctx.lineTo(i * 48 + (yy / 22 % 2 ? 7 : -7), yy); ctx.stroke(); }
      ctx.restore();
      sekil(ctx, [[-44, -10], [0, 26], [44, -10], [30, 8], [0, 40], [-30, 8]], 12, C.krem, { kal: 4 });
    } else if (kiy === 'bornoz') {
      sekil(ctx, [[-60, -10], [0, 170], [60, -10], [40, -14], [0, 120], [-40, -14]], 12, '#f2d38e', { kal: 4 });        // yaka
      sekil(ctx, [[-6, 0], [6, 0], [8, 160], [-8, 160]], 13, C.tenG, { kal: 0, kontur: false });
      cizgi(ctx, [[-omuzW + 20, 250], [0, 262], [omuzW - 20, 250]], 14, 12, '#c8923a');                                 // kuşak
      cizgi(ctx, [[10, 262], [30, 320]], 15, 8, '#c8923a');
    } else {
      // köprücük kemikleri
      cizgi(ctx, [[-110, 40], [-50, 30]], 12, 3, 'rgba(160,90,70,0.6)'); cizgi(ctx, [[110, 40], [50, 30]], 13, 3, 'rgba(160,90,70,0.6)');
    }
    // boyun + baş
    ctx.save(); ctx.translate(0, nef * 0.4); ctx.rotate(p.egim || 0);
    sekil(ctx, dik(-26, -60, 52, 66), 16, C.tenG, { kal: 4 });
    const hy = -170, rx = ck ? 112 : 108, ry = ck ? 112 : 124;
    const islak = kiy === 'ciplak';
    sekil(ctx, elips(0, hy - 18, rx + 18, ry + 6, 20), 17, islak ? '#5a3828' : C.sac, { kal: 5 });
    for (const k of [-1, 1]) sekil(ctx, elips(k * (rx - 2), hy + 10, 18, 26), 18 + k, C.tenG, { kal: 4 });
    sekil(ctx, elips(0, hy, rx, ry, 22), 20, C.ten, { golge: 'rgba(210,140,110,0.35)', gx: 14, gy: 10 });
    const sac = islak
      ? [[-rx - 10, hy - 4], [-rx - 4, hy - 70], [-60, hy - ry - 14], [10, hy - ry - 20], [80, hy - ry - 6], [rx + 8, hy - 50], [rx + 6, hy + 4], [rx - 18, hy - 40], [60, hy - 58], [20, hy - 46], [-20, hy - 66], [-60, hy - 40], [-rx + 16, hy - 30]]
      : [[-rx - 14, hy - 4], [-rx - 6, hy - 70], [-60, hy - ry - 22], [10, hy - ry - 30], [80, hy - ry - 12], [rx + 10, hy - 50], [rx + 8, hy + 6], [rx - 18, hy - 44], [70, hy - 70], [30, hy - 52], [-10, hy - 80], [-50, hy - 50], [-rx + 18, hy - 50]];
    sekil(ctx, sac, 21, islak ? '#5a3828' : C.sac, { golge: 'rgba(255,220,180,0.18)', gx: -10, gy: 12 });
    if (!islak) cizgi(ctx, [[-30, hy - ry - 10], [0, hy - ry - 48 + Math.sin(t * 2) * 3], [22, hy - ry - 26]], 22, 5);
    // şampuan köpüğü
    const kop = p.kopuk || 0;
    if (kop > 0) {
      for (let i = 0; i < 16; i++) {
        const a = Math.PI + i / 15 * Math.PI, r = (rx + 10) * (0.85 + 0.15 * Math.sin(i * 2.3)), b = 26 + (i * 37 % 20);
        const bx = Math.cos(a) * r + Math.sin(t * 2 + i) * 3, by = hy - 20 + Math.sin(a) * (ry + 6) + Math.cos(t * 2.4 + i) * 3;
        ctx.save(); ctx.globalAlpha = clamp(kop * 1.5 - i * 0.02);
        sekil(ctx, elips(bx, by, b * kop, b * kop, 12), 200 + i, '#fdfdfb', { kal: 3, renk: '#9fb7c4' });
        ctx.restore();
      }
    }
    // kaşlar
    const bak = p.bak || [0, 0];
    let gul = p.gulus ?? 0.4;
    const kas = { normal: [0, 0], kendinden: [-6, 12], sok: [-22, -22], huzur: [4, 4], hulya: [-4, -6] }[ifade];
    for (const k of [-1, 1]) {
      const kk = k === 1 ? kas[1] : kas[0];
      cizgi(ctx, [[k * 26, hy - 40 - gul * 2 + (ifade === 'sok' ? -14 : 0)], [k * 46, hy - 47 - gul * 3 + kk * 0.6 - (k === 1 && ifade === 'kendinden' ? 10 : 0)], [k * 66, hy - 42 + (ifade === 'sok' ? -18 : 0)]], 23 + k, 6);
    }
    // gözler
    let g = clamp(p.goz ?? 1);
    for (const k of [-1, 1]) {
      const ex = k * 44 + bak[0] * 5, ey = hy - 8 + bak[1] * 4;
      if (ifade === 'sok' && g > 0.25) {
        sekil(ctx, elips(ex, ey, 22, 24, 12), 25 + k, '#fff', { kal: 4 });
        ctx.fillStyle = C.kontur; ctx.beginPath(); ctx.arc(ex + bak[0] * 6, ey + bak[1] * 6, 8, 0, TAU); ctx.fill();
      } else if (g > 0.25) {
        const lid = ifade === 'kendinden' ? 0.55 : 1;
        ctx.fillStyle = C.kontur; ctx.beginPath(); ctx.ellipse(ex, ey, 11, 15 * g, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex - 3, ey - 5 * g, 4, 0, TAU); ctx.fill();
        if (lid < 1 || g < 0.8) { const h = 18 * Math.max(1 - g, 1 - lid) * 1.4; ctx.fillStyle = C.ten; ctx.fillRect(ex - 14, ey - 18, 28, h); cizgi(ctx, [[ex - 14, ey - 18 + h], [ex + 14, ey - 18 + h]], 27 + k, 4); }
      } else cizgi(ctx, [[ex - 15, ey - 2], [ex, ey + (ifade === 'huzur' ? 6 : 4)], [ex + 15, ey - 2]], 29 + k, 5);
    }
    // yanak + burun
    ctx.fillStyle = 'rgba(232,140,130,0.45)'; for (const k of [-1, 1]) { ctx.beginPath(); ctx.ellipse(k * 66, hy + 30, 20, 12, 0, 0, TAU); ctx.fill(); }
    cizgi(ctx, [[2, hy + 4], [-6, hy + 28], [6, hy + 32]], 31, 4);
    // ağız
    const ag = clamp(p.agiz || 0);
    if (ifade === 'sok') {
      sekil(ctx, elips(0, hy + 64, 16, 22, 12), 32, '#7a2e2e', { kal: 4 });
    } else if (ag > 0.08) {
      sekil(ctx, [[-28, hy + 52], [0, hy + 54], [28, hy + 50], [18, hy + 58 + ag * 26], [0, hy + 62 + ag * 30], [-18, hy + 58 + ag * 26]], 33, '#7a2e2e', { kal: 4 });
      ctx.fillStyle = '#fff'; ctx.fillRect(-18, hy + 53, 36, 7);
    } else if (ifade === 'kendinden') {
      cizgi(ctx, [[-28, hy + 52], [0, hy + 66], [30, hy + 46]], 34, 5);
    } else {
      cizgi(ctx, [[-24, hy + 56 - gul * 6], [0, hy + 60 + gul * 8], [24, hy + 56 - gul * 6]], 35, 5);
    }
    // su damlaları (ıslak)
    if (islak) for (let i = 0; i < 4; i++) { const u = ((t * 0.6 + i * 0.27) % 1); ctx.fillStyle = 'rgba(150,200,230,0.8)'; ctx.beginPath(); ctx.ellipse(-70 + i * 46, hy - 40 + u * 180, 4, 7, 0, 0, TAU); ctx.fill(); }
    ctx.restore();
    // kollar
    const kol = (k, el) => {
      const om = [k * (omuzW - 22), 40 + nef];
      const e = el || [k * (omuzW - 10), p.ayakta ? 330 : 420];
      const dirs = [lerp(om[0], e[0], 0.5) + k * 50, lerp(om[1], e[1], 0.5) + 30];
      sekil(ctx, kolSekil(om, dirs, e, ck ? 24 : 32), 36 + k, renk, { golge: kiy === 'ciplak' ? 'rgba(210,140,110,0.25)' : 'rgba(150,90,30,0.22)' });
      sekil(ctx, elips(e[0], e[1], 26, 25), 38 + k, C.ten, { kal: 4 });
      return e;
    };
    const sagE = kol(-1, p.sagEl), solE = kol(1, p.solEl);
    ctx.restore();
    const ek = e => [x + e[0] * s, y + e[1] * s];
    return { sagEl: ek(sagE), solEl: ek(solE), bas: [x, y - 170 * s], s };
  }

  // basit ikinci kişi (tartışma rakibi / dinleyici) — farklı saç ve renk
  function rakip(ctx, x, y, s, p) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    const kucul = p.kucul || 0;
    ctx.scale(1 - kucul * 0.15, 1 - kucul * 0.15);
    sekil(ctx, [[-120, 0], [-130, 300], [130, 300], [120, 0], [0, -10]], 300, p.renk || C.rakip);
    sekil(ctx, dik(-22, -50, 44, 52), 301, C.tenG, { kal: 4 });
    sekil(ctx, elips(0, -140, 92, 100, 18), 302, '#eec09c');
    sekil(ctx, [[-96, -150], [-80, -220], [0, -252], [80, -220], [96, -150], [60, -200], [0, -214], [-60, -200]], 303, p.sac || '#3d3a44');
    for (const k of [-1, 1]) { ctx.fillStyle = C.kontur; ctx.beginPath(); ctx.arc(k * 34, -142 + kucul * 4, 8, 0, TAU); ctx.fill(); }
    if (kucul > 0.3) {
      cizgi(ctx, [[-20, -82], [0, -90], [20, -82]], 304, 5);                        // üzgün ağız
      ctx.fillStyle = '#9fd0ee'; ctx.beginPath(); ctx.ellipse(70, -190, 10, 16, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = C.kontur; ctx.lineWidth = 3; ctx.stroke();  // ter damlası
    } else if (p.agiz) {
      sekil(ctx, elips(0, -86, 16, 6 + p.agiz * 12, 10), 305, '#7a2e2e', { kal: 4 });
    } else cizgi(ctx, [[-18, -86], [18, -86]], 306, 5);
    ctx.restore();
  }

  // düşünce balonu: bulut + izleyen küçük daireler; icerik(ctx) bulutun içine kırpılarak çizilir
  function balon(ctx, x, y, w, h, a, kaynak, seed, icerik, renk = '#fffaf0') {
    if (a <= 0) return;
    ctx.save();
    const sc = ease.outBack(clamp(a));
    ctx.globalAlpha = clamp(a * 1.4);
    // izleyen daireler
    if (kaynak) for (let k = 1; k <= 3; k++) {
      const u = k / 4, px = lerp(kaynak[0], x, u * 0.9), py = lerp(kaynak[1], y + h * 0.4, u * 0.9);
      sekil(ctx, elips(px, py, 10 + k * 6, 10 + k * 6, 10), seed + k, renk, { kal: 4 });
    }
    ctx.translate(x, y); ctx.scale(sc, sc);
    const pts = [];
    for (let i = 0; i < 24; i++) { const an = i / 24 * TAU; const r = 1 + 0.07 * Math.sin(an * 7 + seed); pts.push([Math.cos(an) * w / 2 * r, Math.sin(an) * h / 2 * r]); }
    const P = sekil(ctx, pts, seed, renk, { kal: 5 });
    ctx.save(); ctx.clip(P); icerik(ctx); ctx.restore();
    ctx.stroke(P);
    ctx.restore();
  }
  function hap(ctx, metin, x, y, renk, a, boyut = 54) {
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha = clamp(a); ctx.translate(x, y); const sc = lerp(0.7, 1, ease.outBack(clamp(a))); ctx.scale(sc, sc);
    ctx.font = `800 ${boyut}px ${FONT}`; const w = ctx.measureText(metin).width + 64;
    sekil(ctx, yDik(-w / 2, -boyut, w, boyut * 2, boyut * 0.8), metin.length + 7, '#fffaf0', { kal: 5, renk });
    yazi(ctx, metin, 0, 2, { boyut, agirlik: 800, renk: C.kontur, golge: false });
    ctx.restore();
  }
  function konusmaBalonu(ctx, x, y, s, icerik, renk = '#fff') {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    sekil(ctx, [[-60, -40], [60, -40], [70, 0], [60, 40], [-10, 40], [-40, 66], [-30, 40], [-60, 40], [-70, 0]], 400 + icerik.length, renk, { kal: 4 });
    yazi(ctx, icerik, 0, 2, { boyut: 46, agirlik: 800, renk: C.kontur, golge: false });
    ctx.restore();
  }

  // ---------------- banyo ----------------
  function dusArka(ctx, t, akis = 1, buhar = 1) {
    ctx.fillStyle = C.nane; ctx.fillRect(0, 0, W, H);
    // fayanslar
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 6;
    for (let y = 0; y < H; y += 150) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    for (let x = 0; x < W; x += 150) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    // sıcak lamba ışığı
    const g = ctx.createRadialGradient(540, 120, 40, 540, 300, 1100); g.addColorStop(0, 'rgba(255,226,170,0.55)'); g.addColorStop(1, 'rgba(255,226,170,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // duş başlığı + boru
    cizgi(ctx, [[980, -20], [980, 150], [860, 210]], 500, 18, '#c9ccd2');
    sekil(ctx, [[760, 200], [880, 180], [900, 230], [780, 262]], 501, '#d9dce2', { kal: 5 });
    // raf: şampuan şişeleri
    sekil(ctx, dik(40, 760, 200, 20), 502, '#f4efe6', { kal: 4 });
    [[60, C.pembe, 110], [120, C.altin, 140], [180, C.erik, 90]].forEach(([x, c, h], i) => sekil(ctx, yDik(x, 760 - h, 46, h, 14), 503 + i, c, { kal: 4 }));
    // su: başlıktan dökülen çizgiler
    if (akis > 0) {
      ctx.save(); ctx.globalAlpha = 0.75 * akis;
      const r = rng(3);
      for (let i = 0; i < 26; i++) {
        const x0 = 790 + r() * 100, x1 = x0 - 420 + r() * 300, ofs = (t * 1.6 + r()) % 1;
        const L = 140;
        for (let k = 0; k < 3; k++) {
          const u = (ofs + k / 3) % 1, u2 = Math.min(1, u + 0.08);
          ctx.strokeStyle = 'rgba(160,205,235,0.9)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(lerp(x0, x1, u), lerp(250, 1800, u)); ctx.lineTo(lerp(x0, x1, u2), lerp(250, 1800, u2)); ctx.stroke();
        }
      }
      ctx.restore();
    }
    // buhar
    ctx.save(); ctx.globalAlpha = 0.35 * buhar;
    for (let i = 0; i < 6; i++) { const bx = (i * 230 + t * 20) % 1300 - 100, by = 300 + (i * 290) % 900 - (t * 15) % 200; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(bx, by, 220, 90, 0, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  // buzlu cam duş kapısı (alt kısım): buğulu, damlalı
  function buzluCam(ctx, t, y0 = 1420) {
    ctx.save();
    const g = ctx.createLinearGradient(0, y0 - 60, 0, y0 + 200);
    g.addColorStop(0, 'rgba(236,246,248,0)'); g.addColorStop(0.3, 'rgba(236,246,248,0.9)'); g.addColorStop(1, 'rgba(226,240,244,0.97)');
    ctx.fillStyle = g; ctx.fillRect(0, y0 - 60, W, H - y0 + 60);
    sekil(ctx, [[-20, y0], [W / 2, y0 + 6], [W + 20, y0], [W + 20, H + 20], [-20, H + 20]], 590, null, { kal: 6, renk: 'rgba(140,170,180,0.6)' });
    const r = rng(12);
    for (let i = 0; i < 26; i++) {
      const x = r() * W, y = y0 + 40 + ((r() * 400 + t * 40 * r()) % 420), L = 20 + r() * 40;
      ctx.strokeStyle = 'rgba(170,200,215,0.55)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + L); ctx.stroke();
      ctx.fillStyle = 'rgba(170,200,215,0.7)'; ctx.beginPath(); ctx.arc(x, y + L, 6, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(80, y0 + 60, 18, 300);
    ctx.restore();
  }
  function onSu(ctx, t, akis = 1) {          // karakterin önünden geçen damlalar
    if (akis <= 0) return;
    ctx.save(); ctx.globalAlpha = 0.6 * akis; const r = rng(8);
    for (let i = 0; i < 14; i++) { const x = 300 + r() * 600, y = ((r() * H + t * 900 * (0.8 + r() * 0.4)) % H); ctx.fillStyle = 'rgba(190,225,245,0.9)'; ctx.beginPath(); ctx.ellipse(x, y, 4, 14, 0, 0, TAU); ctx.fill(); }
    ctx.restore();
  }

  // mini sahneler (balon içerikleri) — mini karakter aynı fonksiyon
  function miniTartisma(ctx, t, kazan) {
    ctx.fillStyle = '#fbefd9'; ctx.fillRect(-400, -300, 800, 600);
    kahraman(ctx, -110, 30, 0.42, { t, ifade: kazan > 0.5 ? 'kendinden' : 'normal', agiz: Math.abs(Math.sin(t * 9)) * 0.8, sagEl: [-150, 160], solEl: [230, -80 + Math.sin(t * 6) * 20], kiyafet: 'kazak' });
    rakip(ctx, 140, 60, 0.42, { kucul: kazan, t });
    konusmaBalonu(ctx, -60, -190, 0.9, '!!');
    if (kazan > 0.5) { ctx.save(); ctx.globalAlpha = (kazan - 0.5) * 2; konusmaBalonu(ctx, 150, -170, 0.7, '…'); ctx.restore(); }
  }
  function miniSavunma(ctx, t) {
    ctx.fillStyle = '#e4eef4'; ctx.fillRect(-400, -300, 800, 600);
    kahraman(ctx, -100, 40, 0.4, { t, ifade: 'kendinden', sagEl: [-200, 40], solEl: [160, 60] });
    sekil(ctx, [[60, -60], [150, -40], [140, 60], [80, 110], [40, 40]].map(([a, b]) => [a - 160, b + 20]), 410, C.mavi, { kal: 4 });      // kalkan
    rakip(ctx, 150, 60, 0.4, { agiz: Math.abs(Math.sin(t * 8)), renk: C.kiremit });
  }
  function miniKonusma(ctx, t) {
    ctx.fillStyle = '#f6e4ec'; ctx.fillRect(-400, -300, 800, 600);
    sekil(ctx, dik(-70, 60, 140, 120), 420, '#c99a6a', { kal: 4 });                                   // kürsü
    kahraman(ctx, 0, -20, 0.38, { t, ifade: 'kendinden', agiz: Math.abs(Math.sin(t * 8)) * 0.7, sagEl: [-200, -40 + Math.sin(t * 5) * 20], solEl: [140, 120] });
    for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + t; ctx.fillStyle = C.altin; ctx.save(); ctx.translate(Math.cos(a) * 200, -60 + Math.sin(a) * 90); ctx.rotate(t * 2); ctx.beginPath(); for (let k = 0; k < 10; k++) { const r = k % 2 ? 9 : 22; ctx.lineTo(Math.cos(k / 10 * TAU) * r, Math.sin(k / 10 * TAU) * r); } ctx.fill(); ctx.restore(); }
  }
  function miniGelecek(ctx, t) {
    ctx.fillStyle = '#e9f3e1'; ctx.fillRect(-400, -300, 800, 600);
    sekil(ctx, yDik(-210, -190, 130, 120, 16), 430, '#fff', { kal: 4 }); sekil(ctx, dik(-210, -190, 130, 34), 431, C.kiremit, { kal: 4 });
    yazi(ctx, 'YARIN', -145, -126, { boyut: 30, agirlik: 800, renk: C.kontur, golge: false });
    kahraman(ctx, -40, 60, 0.38, { t, ifade: 'normal', gulus: 0.8, agiz: Math.abs(Math.sin(t * 7)) * 0.6, sagEl: [-160, 120], solEl: [200, -20] });
    rakip(ctx, 170, 70, 0.38, { renk: C.adacayi, sac: '#6d5a3a', agiz: 0 });
    cizgi(ctx, [[-260, 200], [0, 200], [240, 200]], 432, 6, '#7fa58a'); sekil(ctx, [[240, 180], [280, 200], [240, 220]], 433, '#7fa58a', { kal: 4 });
  }

  // ======================= 1) KANCA =======================
  VIDEO.sahne('kanca', {
    ciz(ctx, S) {
      const t = S.t; KARE = Math.floor(S.gt * 6);
      ctx.save(); const z = lerp(1.0, 1.06, ease.inOut(clamp(t / S.d))); ctx.translate(540, 900); ctx.scale(z, z); ctx.translate(-540, -900);
      dusArka(ctx, t);
      const fikir = ramp(t, S.at(0, 0.22), S.at(0, 0.32)), kazan = ramp(t, S.at(0, 0.45), S.at(0, 0.65));
      const yika = Math.sin(t * 7) * 18 * (1 - fikir * 0.7);
      const k = kahraman(ctx, 540, 1230, 1.25, { t, kiyafet: 'ciplak', kopuk: ramp(t, 0, 0.8), goz: fikir > 0.2 ? 1 : 0, ifade: kazan > 0.4 ? 'kendinden' : 'huzur',
        gulus: lerp(0.3, 0.6, fikir), bak: [0.5 * fikir, -0.6 * fikir], egim: -0.08 * kazan + Math.sin(t * 1.2) * 0.02,
        sagEl: [-130 + yika, -250 + Math.cos(t * 7) * 12], solEl: [130 - yika, -260 + Math.sin(t * 7) * 12] });
      onSu(ctx, t);
      buzluCam(ctx, t, 1460);
      ctx.restore();
      balon(ctx, 540, 520, 820, 600, fikir, [k.bas[0] + 60, k.bas[1] - 220], 50, c => miniTartisma(c, S.gt, kazan));
      if (kazan > 0.6) { ctx.save(); ctx.globalAlpha = (kazan - 0.6) * 2.5; ctx.font = `800 70px ${FONT}`; yazi(ctx, '1 – 0', 880, 260, { boyut: 70, agirlik: 800, renk: C.kiremit, kontur: 10, konturRenk: '#fffaf0', golge: false }); ctx.restore(); }
      kagit(ctx);
    },
  });

  // ======================= 2) HAYALİ KONUŞMALAR =======================
  VIDEO.sahne('hayal', {
    ciz(ctx, S) {
      const t = S.t; KARE = Math.floor(S.gt * 6);
      dusArka(ctx, S.gt);
      const keske = ramp(t, S.at(0, 0.55), S.at(0, 0.75));
      const k = kahraman(ctx, 540, 1300, 1.15, { t: S.gt, kiyafet: 'ciplak', kopuk: 1 - ramp(t, 0, S.d), goz: 1, ifade: keske > 0.5 ? 'hulya' : 'kendinden', gulus: lerp(0.6, 0.1, keske),
        bak: [0, -0.8], egim: Math.sin(t * 1.3) * 0.03, sagEl: [-150, 120 - keske * 40], solEl: [150, 120] });
      onSu(ctx, S.gt);
      buzluCam(ctx, S.gt, 1420);
      const b = [
        [250, 470, ramp(t, S.at(0, 0.0), S.at(0, 0.08)), miniSavunma, 60],
        [830, 520, ramp(t, S.at(0, 0.18), S.at(0, 0.26)), miniKonusma, 61],
        [540, 860, ramp(t, S.at(0, 0.36), S.at(0, 0.44)), miniGelecek, 62],
      ];
      for (const [x, y, a, f, sd] of b) balon(ctx, x + Math.sin(S.gt + sd) * 8, y + Math.cos(S.gt * 0.8 + sd) * 8, 470, 360, a * (1 - keske * 0.55), [k.bas[0], k.bas[1] - 150], sd, c => { c.scale(0.62, 0.62); f(c, S.gt); });
      if (keske > 0) {   // "keşke": küçük iç çekiş — iç çekiş bulutu
        ctx.save(); ctx.globalAlpha = keske * 0.9; ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 3; i++) { const u = ((t - S.at(0, 0.6)) * 0.6 + i * 0.2); if (u < 0 || u > 1) continue; ctx.beginPath(); ctx.arc(k.bas[0] + 160 + u * 120, k.bas[1] + 60 - u * 80, 18 + u * 22, 0, TAU); ctx.fill(); }
        ctx.restore();
      }
      kagit(ctx);
    },
  });

  // ======================= 3) AÇIKLAMA: OTOMATİK İŞ, SERBEST ZİHİN =======================
  const DIKKAT = ['📱', '⏰', '✉️', '📋'];
  function ikon(ctx, tur, x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    if (tur === 'tel') { sekil(ctx, yDik(-30, -50, 60, 100, 12), 600, '#5a6178', { kal: 4 }); sekil(ctx, dik(-22, -40, 44, 70), 601, '#9fd0ee', { kal: 0, kontur: false }); ctx.fillStyle = C.kiremit; ctx.beginPath(); ctx.arc(28, -48, 14, 0, TAU); ctx.fill(); }
    else if (tur === 'saat') { sekil(ctx, elips(0, 0, 46, 46), 602, '#fff', { kal: 5 }); cizgi(ctx, [[0, 0], [0, -30]], 603, 5); cizgi(ctx, [[0, 0], [20, 8]], 604, 5); }
    else if (tur === 'zarf') { sekil(ctx, dik(-48, -32, 96, 64), 605, '#fff', { kal: 4 }); cizgi(ctx, [[-48, -32], [0, 6], [48, -32]], 606, 4); }
    else if (tur === 'liste') { sekil(ctx, dik(-36, -48, 72, 96), 607, '#fff8e6', { kal: 4 }); for (let i = 0; i < 3; i++) cizgi(ctx, [[-20, -24 + i * 24], [22, -24 + i * 24]], 608 + i, 4); }
    else if (tur === 'ampul') { sekil(ctx, elips(0, -10, 34, 38), 610, C.altin, { kal: 4 }); sekil(ctx, dik(-14, 26, 28, 18), 611, '#c9ccd2', { kal: 4 }); }
    else if (tur === 'kalp') { sekil(ctx, [[0, 30], [-36, -4], [-24, -30], [0, -14], [24, -30], [36, -4]], 612, C.pembe, { kal: 4 }); }
    else if (tur === 'foto') { sekil(ctx, dik(-44, -36, 88, 72), 613, '#fff', { kal: 4 }); sekil(ctx, [[-34, 26], [-8, -6], [10, 14], [22, 2], [34, 26]], 614, C.adacayi, { kal: 3 }); ctx.fillStyle = C.altin; ctx.beginPath(); ctx.arc(18, -16, 8, 0, TAU); ctx.fill(); }
    else if (tur === 'nota') { cizgi(ctx, [[10, 20], [10, -36], [34, -28]], 615, 6); sekil(ctx, elips(0, 22, 14, 10), 616, C.kontur, { kal: 0, kontur: false }); }
    else if (tur === 'yildiz') { ctx.fillStyle = C.altin; ctx.beginPath(); for (let k = 0; k < 10; k++) { const r = k % 2 ? 16 : 38; ctx.lineTo(Math.cos(k / 10 * TAU - Math.PI / 2) * r, Math.sin(k / 10 * TAU - Math.PI / 2) * r); } ctx.closePath(); ctx.fill(); ctx.strokeStyle = C.kontur; ctx.lineWidth = 4; ctx.stroke(); }
    else if (tur === 'soru') { sekil(ctx, elips(0, 0, 40, 40), 617, C.mavi, { kal: 4 }); yazi(ctx, '?', 0, 3, { boyut: 50, agirlik: 800, renk: '#fff', golge: false }); }
    ctx.restore();
  }
  VIDEO.sahne('aciklama', {
    ciz(ctx, S) {
      const t = S.t; KARE = Math.floor(S.gt * 6);
      dusArka(ctx, S.gt, 1, 1.3);
      const sakin = ramp(t, S.at(1, 0.1), S.at(1, 0.9)), serbest = ramp(t, S.at(2, 0.1), S.at(2, 0.5));
      // dış dikkat dağıtıcılar: önce çevrede, sonra tek tek söner
      const dis = [['tel', 160, 420], ['saat', 900, 360], ['zarf', 140, 1020], ['liste', 930, 980]];
      dis.forEach(([tur, x, y], i) => {
        const a = ramp(t, 0.1 + i * 0.15, 0.5 + i * 0.15) * (1 - ramp(sakin, i * 0.2, i * 0.2 + 0.3));
        if (a <= 0) return;
        ctx.save(); ctx.globalAlpha = a; const titr = (1 - sakin) * Math.sin(t * 20 + i) * 6;
        ikon(ctx, tur, x + titr, y + Math.sin(t * 2 + i) * 10, 1.4 * (0.6 + 0.4 * a)); ctx.restore();
      });
      const k = kahraman(ctx, 540, 1300, 1.15, { t: S.gt, kiyafet: 'ciplak', goz: lerp(1, 0, ramp(t, S.at(1, 0.3), S.at(1, 0.6))), ifade: 'huzur', gulus: lerp(0.2, 0.6, sakin),
        egim: Math.sin(S.gt * 0.9) * 0.03, sagEl: [-130 + Math.sin(S.gt * 3) * 10, -250], solEl: [150, 120] });
      onSu(ctx, S.gt);
      buzluCam(ctx, S.gt, 1420);
      // serbestçe dolaşan düşünce sembolleri
      const ic = ['ampul', 'kalp', 'foto', 'nota', 'yildiz', 'soru'];
      ic.forEach((tur, i) => {
        const a = ramp(serbest, i * 0.1, i * 0.1 + 0.4);
        if (a <= 0) return;
        const an = S.gt * (0.35 + i * 0.05) + i * TAU / 6, rx = 330 + 40 * Math.sin(S.gt * 0.7 + i), ry = 240 + 30 * Math.cos(S.gt * 0.5 + i);
        ikon(ctx, tur, k.bas[0] + Math.cos(an) * rx, k.bas[1] - 60 + Math.sin(an) * ry, 1.25 * ease.outBack(a));
      });
      kagit(ctx);
    },
  });

  // ======================= 4) ZİHİNSEL GEZİNME =======================
  VIDEO.sahne('beyin', {
    ciz(ctx, S) {
      const t = S.t; KARE = Math.floor(S.gt * 6);
      ctx.fillStyle = '#f3ead8'; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.globalAlpha = 0.35; dusArka(ctx, S.gt, 0.4, 0.5); ctx.restore();
      const baslik = ramp(t, S.at(0, 0.2), S.at(0, 0.5));
      const ga = ramp(t, S.at(1, 0.08), S.at(1, 0.2)), fa = ramp(t, S.at(1, 0.38), S.at(1, 0.5)), ka = ramp(t, S.at(1, 0.66), S.at(1, 0.78));
      const merkez = [540, 1210];
      const k = kahraman(ctx, merkez[0], merkez[1] + 110, 1.1, { t: S.gt, kiyafet: 'ciplak', goz: 0, ifade: 'huzur', gulus: 0.6, egim: Math.sin(S.gt * 0.8) * 0.03, sagEl: [-150, 200], solEl: [150, 200] });
      // balon düğümleri: geçmiş, gelecek, hayali konuşma
      const D = [
        { p: [260, 640], a: ga, ad: 'Geçmiş', renk: '#c58fb0', f: c => { c.scale(1.6, 1.6); ikon(c, 'foto', 0, -10, 1.1); } },
        { p: [820, 640], a: fa, ad: 'Gelecek', renk: '#7fa58a', f: c => { c.scale(0.55, 0.55); miniGelecek(c, S.gt); } },
        { p: [540, 330], a: ka, ad: 'Hayali konuşmalar', renk: C.kiremit, f: c => { c.scale(0.55, 0.55); miniTartisma(c, S.gt, 0.8); } },
      ];
      // bağlantılar (kafadan ve aralarında), üzerinde akan noktalar
      const baglan = (p, q, a, sd) => {
        if (a <= 0) return;
        ctx.save(); ctx.globalAlpha = a; ctx.setLineDash([14, 14]); ctx.lineDashOffset = -S.gt * 50;
        cizgi(ctx, [p, [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2 - 40], q], sd, 6, '#8a7a9a'); ctx.restore();
        const u = (S.gt * 0.5 + sd * 0.13) % 1;
        ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = C.altin; ctx.beginPath();
        const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2 - 40;
        ctx.arc(lerp(lerp(p[0], mx, u), lerp(mx, q[0], u), u), lerp(lerp(p[1], my, u), lerp(my, q[1], u), u), 10, 0, TAU); ctx.fill(); ctx.restore();
      };
      buzluCam(ctx, S.gt, 1470);
      const kafa = [k.bas[0], k.bas[1] - 100];
      D.forEach((d, i) => baglan(kafa, d.p, d.a, 700 + i));
      baglan(D[0].p, D[2].p, Math.min(ga, ka), 710); baglan(D[2].p, D[1].p, Math.min(fa, ka), 711); baglan(D[0].p, D[1].p, Math.min(ga, fa), 712);
      D.forEach((d, i) => {
        balon(ctx, d.p[0] + Math.sin(S.gt + i) * 8, d.p[1] + Math.cos(S.gt * 0.9 + i) * 8, i === 2 ? 420 : 340, i === 2 ? 300 : 280, d.a, null, 720 + i, d.f);
        hap(ctx, d.ad, d.p[0], d.p[1] + (i === 2 ? 190 : 175), d.renk, d.a, 44);
      });
      hap(ctx, 'Zihinsel gezinme', 540, 110, '#6a5a8a', baslik * (1 - ka * 0), 60);
      kagit(ctx);
    },
  });

  // ======================= 5) SON: DUŞTAN ÇIKIŞ VE UNUTULAN CEVAP =======================
  VIDEO.sahne('son', {
    ciz(ctx, S) {
      const t = S.t; KARE = Math.floor(S.gt * 6);
      const kapat = ramp(t, 0.2, 0.7), yuru = ramp(t, 0.9, S.at(0, 0.95), x => x), sok = ramp(t, S.at(1, -0.02), S.at(1, 0.08)), cevap = ramp(t, S.at(1, 0.25), S.at(1, 0.4));
      // banyo (geniş): duş kabini solda, ayna + havlu sağda
      ctx.fillStyle = '#f6e7d2'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,226,170,0.35)'; ctx.beginPath(); ctx.arc(540, 100, 700, 0, TAU); ctx.fill();
      sekil(ctx, dik(-40, 1500, 1160, 500), 800, '#e2cdb0');                                          // zemin
      ctx.strokeStyle = 'rgba(160,130,100,0.3)'; ctx.lineWidth = 4; for (let x = 0; x < W; x += 160) { ctx.beginPath(); ctx.moveTo(x, 1500); ctx.lineTo(x - 80, H); ctx.stroke(); }
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, 420, 1500); ctx.clip(); dusArka(ctx, S.gt, 1 - kapat, 1 - kapat * 0.6); ctx.restore();
      sekil(ctx, dik(400, 120, 26, 1390), 801, '#d9dce2', { kal: 4 });                                // kabin kenarı
      ctx.save(); ctx.globalAlpha = 0.35; sekil(ctx, dik(30, 120, 380, 1380), 802, '#cfe8f2', { kal: 4 }); ctx.restore();
      // damlayan son damlalar
      if (kapat > 0.5) for (let i = 0; i < 3; i++) { const u = ((S.gt * 0.8 + i * 0.33) % 1); ctx.fillStyle = 'rgba(150,200,230,0.9)'; ctx.beginPath(); ctx.ellipse(250 + i * 30, 300 + u * 1100, 6, 10, 0, 0, TAU); ctx.fill(); }
      // ayna + havlu
      sekil(ctx, yDik(640, 300, 340, 420, 60), 803, '#dcecf2', { kal: 6 }); ctx.save(); ctx.globalAlpha = 0.5; cizgi(ctx, [[700, 380], [780, 330]], 804, 10, '#fff'); ctx.restore();
      sekil(ctx, dik(860, 820, 140, 300), 805, C.pembe, { kal: 5 });
      // musluk kolu (kapanış hareketi)
      ctx.save(); ctx.translate(330, 700); ctx.rotate(lerp(-0.6, 0.6, kapat)); sekil(ctx, dik(-10, -60, 20, 60), 806, '#c9ccd2', { kal: 4 }); ctx.restore();
      sekil(ctx, elips(330, 700, 22, 22), 807, '#d9dce2', { kal: 4 });
      // karakter: kabinden çıkıp yürür (bornozlu), sonra şok
      const x = lerp(260, 600, ease.inOut(yuru)), adim = pencere(yuru, 0.02, 0.98, 0.1);
      const zip = Math.abs(Math.sin(yuru * Math.PI * 4)) * 14 * adim;
      const k = kahraman(ctx, x, 980 - zip - sok * 10, 0.8, { t: S.gt, kiyafet: 'bornoz', ayakta: true, yuru: yuru * Math.PI * 8, adim: adim * 0.7,
        ifade: sok > 0.3 ? 'sok' : 'kendinden', gulus: 0.7, goz: 1, bak: sok > 0.3 ? [-0.6, -0.5] : [1, 0], egim: sok > 0.3 ? -0.05 : 0.03,
        sagEl: sok > 0.3 ? [-120, -230] : null, solEl: sok > 0.3 ? [120, -230] : null });
      if (sok > 0) { ctx.save(); ctx.globalAlpha = sok; for (let i = 0; i < 3; i++) cizgi(ctx, [[k.bas[0] - 120 + i * 120, k.bas[1] - 190], [k.bas[0] - 140 + i * 140, k.bas[1] - 250]], 820 + i, 8); yazi(ctx, '!', k.bas[0] + 180, k.bas[1] - 150, { boyut: 110, agirlik: 800, renk: C.kiremit, golge: false }); ctx.restore(); }
      // unutulan mükemmel cevap
      balon(ctx, 540, 330 + Math.sin(S.gt * 1.4) * 8, 860, 500, cevap, [k.bas[0] + 40, k.bas[1] - 200], 830, c => {
        c.fillStyle = '#fbefd9'; c.fillRect(-500, -300, 1000, 600);
        kahraman(c, -200, 90, 0.36, { t: S.gt, ifade: 'kendinden', agiz: Math.abs(Math.sin(S.gt * 9)) * 0.7, sagEl: [-150, 160], solEl: [220, -90] });
        c.font = `800 46px ${FONT}`;
        sekil(c, yDik(-90, -150, 400, 210, 50), 831, '#fff', { kal: 5 });
        yazi(c, 'Asıl cevap', 110, -90, { boyut: 48, agirlik: 800, renk: C.kontur, golge: false });
        yazi(c, 'buydu işte!', 110, -20, { boyut: 48, agirlik: 800, renk: C.kiremit, golge: false });
        for (let i = 0; i < 3; i++) { const a = S.gt * 2 + i * 2; ikon(c, 'yildiz', 250 + Math.cos(a) * 40 - i * 160, 150 + Math.sin(a) * 20, 0.6); }
      });
      kagit(ctx);
    },
  });

  VIDEO.sahne('_ortak', {
    hazirla() { A.kagit = gurultuDokusu(270, 480, 6, 21, f => [255 - f * 40, 245 - f * 45, 230 - f * 55, 255], 3); },
    ciz() { },
  });
})();
