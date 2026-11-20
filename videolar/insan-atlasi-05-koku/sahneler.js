/* İnsan Atlası #05 — Bir koku neden bizi yıllar öncesine götürür?
 * Stil: düz (flat) 2D el çizimi illüstrasyon, yumuşak pastel renkler, temiz koyu kontur, "kaynayan" çizgi (6 fps titreme).
 * Tek karakter (genç yetişkin): kahverengi dalgalı saç + perçem, hardal kazak, kot. Çocukluğu aynı fonksiyonla (cocuk:1).
 */
(function () {
  const { W, H, clamp, lerp, ease, ramp, pencere, rng, tuval, gurultuDokusu, yazi, FONT } = STUDIO.R;
  const TAU = Math.PI * 2;
  const A = {};
  const C = {
    kontur: '#3b2a26', ten: '#f2c9a8', tenG: '#e2a988', sac: '#6b4532', sacA: '#8a5c40', kazak: '#d9a441', kazakG: '#bf8a2e',
    kot: '#7f97b3', krem: '#f4e8d4', adacayi: '#a9bf9e', mavi: '#9db4c8', kiremit: '#cf8466', erik: '#9a7a9a', pembe: '#e9a7a0',
    altin: '#f0c66e', kahve: '#8a6448', duvar1: '#efe0c6', duvar2: '#e7d3b4',
  };

  // ---------------- el çizimi yardımcıları ----------------
  let KARE = 0;                                   // titreme karesi (6 fps)
  function titre(seed, i, g = 1.6) {
    const r = Math.sin((seed * 127.1 + i * 311.7 + KARE * 74.7)) * 43758.5453;
    return ((r - Math.floor(r)) - 0.5) * 2 * g;
  }
  // kapalı yumuşak yol (noktalar arası orta nokta eğrileri) + titreme
  function yol(pts, seed, g = 1.6, kapali = true) {
    const p = pts.map(([x, y], i) => [x + titre(seed, i * 2, g), y + titre(seed, i * 2 + 1, g)]);
    const P = new Path2D();
    if (!kapali) {
      P.moveTo(...p[0]);
      for (let i = 1; i < p.length - 1; i++) P.quadraticCurveTo(p[i][0], p[i][1], (p[i][0] + p[i + 1][0]) / 2, (p[i][1] + p[i + 1][1]) / 2);
      P.lineTo(...p[p.length - 1]);
      return P;
    }
    const n = p.length, m = i => [(p[i % n][0] + p[(i + 1) % n][0]) / 2, (p[i % n][1] + p[(i + 1) % n][1]) / 2];
    P.moveTo(...m(0));
    for (let i = 1; i <= n; i++) P.quadraticCurveTo(p[i % n][0], p[i % n][1], ...m(i));
    P.closePath();
    return P;
  }
  function elips(cx, cy, rx, ry, n = 18, rot = 0) {
    return Array.from({ length: n }, (_, i) => { const a = i / n * TAU; const x = Math.cos(a) * rx, y = Math.sin(a) * ry; return [cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]; });
  }
  function sekil(ctx, pts, seed, dolgu, o = {}) {
    const P = yol(pts, seed, o.g ?? 1.6, o.kapali !== false);
    if (dolgu) { ctx.fillStyle = dolgu; ctx.fill(P); }
    if (o.golge) { ctx.save(); ctx.clip(P); ctx.fillStyle = o.golge; ctx.translate(o.gx ?? 10, o.gy ?? 8); ctx.fill(yol(pts, seed + 99, 0)); ctx.restore(); }
    if (o.kontur !== false) { ctx.strokeStyle = o.renk || C.kontur; ctx.lineWidth = o.kal || 5; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(P); }
    return P;
  }
  function cizgi(ctx, pts, seed, kal = 5, renk = C.kontur) {
    ctx.strokeStyle = renk; ctx.lineWidth = kal; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.stroke(yol(pts, seed, 1.2, false));
  }
  const dikdortgen = (x, y, w, h) => [[x, y], [x + w / 2, y], [x + w, y], [x + w, y + h / 2], [x + w, y + h], [x + w / 2, y + h], [x, y + h], [x, y + h / 2]];
  function yuvarlakDik(x, y, w, h, r) {
    const p = [];
    for (const [cx, cy, a0] of [[x + w - r, y + r, -Math.PI / 2], [x + w - r, y + h - r, 0], [x + r, y + h - r, Math.PI / 2], [x + r, y + r, Math.PI]])
      for (let k = 0; k <= 3; k++) { const a = a0 + k / 3 * Math.PI / 2; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    return p;
  }
  // koku dalgası (kıvrımlı, uçuşan çizgi)
  function kokuIzi(ctx, x0, y0, x1, y1, t, renk, alfa, seed = 1, kal = 6) {
    if (alfa <= 0) return;
    ctx.save(); ctx.globalAlpha *= alfa;
    for (let k = 0; k < 3; k++) {
      const pts = [];
      for (let i = 0; i <= 14; i++) {
        const u = i / 14, d = Math.sin(u * 9 + t * 3 + k * 2 + seed) * 18 * Math.sin(Math.PI * u);
        const nx = -(y1 - y0), ny = x1 - x0, L = Math.hypot(nx, ny);
        pts.push([lerp(x0, x1, u) + nx / L * (d + (k - 1) * 22), lerp(y0, y1, u) + ny / L * (d + (k - 1) * 22)]);
      }
      const ilk = clamp((t * 0.8 + k * 0.2) % 1.6);
      ctx.globalAlpha = alfa * (0.55 + 0.3 * Math.sin(t * 2 + k)) * (1 - ilk * 0.3);
      cizgi(ctx, pts, seed * 10 + k, kal - k, renk);
    }
    ctx.restore();
  }

  // ---------------- KARAKTER ----------------
  /* kahraman(ctx, x, y, s, p) — (x,y) boyun dibi. p: t, goz (0 kapalı..1 açık), bak [x,y], gulus 0..1, egim, nefes,
   *   sagEl: [x,y] (yerel; null = aşağıda), solEl, cocuk (0/1), oturan (bool: bacakları çiz), kazakRenk */
  function kahraman(ctx, x, y, s, p) {
    const t = p.t || 0, ck = p.cocuk ? 1 : 0;
    const nef = Math.sin(t * 1.8) * 3 * (p.nefesGuc ?? 1);
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    const kazak = p.kazakRenk || C.kazak;
    const omuzW = ck ? 120 : 170;
    // --- bacaklar (oturan) ---
    if (p.oturan) {
      for (const k of [-1, 1]) {
        sekil(ctx, [[k * 20, 300], [k * 115, 300], [k * 120, 360], [k * 105, 560], [k * 55, 560], [k * 50, 370], [k * 20, 360]], 40 + k, C.kot, { golge: 'rgba(60,70,100,0.25)' });
        sekil(ctx, elips(k * 80, 572, 44, 20), 44 + k, '#5b4a44');
      }
    }
    // --- gövde (kazak) ---
    const govdeH = p.oturan ? 330 : 460;
    const gov = [[-40, -8], [-omuzW + 20, 10 + nef], [-omuzW, 60 + nef], [-omuzW + 15, govdeH], [0, govdeH + 8], [omuzW - 15, govdeH], [omuzW, 60 + nef], [omuzW - 20, 10 + nef], [40, -8]];
    sekil(ctx, gov, 11, kazak, { golge: 'rgba(150,90,30,0.25)', gx: -16, gy: 0 });
    // örgü deseni
    ctx.save(); ctx.clip(yol(gov, 11, 0)); ctx.strokeStyle = 'rgba(120,80,30,0.25)'; ctx.lineWidth = 3;
    for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * 48, 60); for (let yy = 60; yy < govdeH; yy += 22) ctx.lineTo(i * 48 + (yy / 22 % 2 ? 7 : -7), yy); ctx.stroke(); }
    ctx.restore();
    // yaka
    sekil(ctx, [[-44, -10], [0, 26], [44, -10], [30, 8], [0, 40], [-30, 8]], 12, C.krem, { kal: 4 });
    // --- boyun + baş ---
    ctx.save(); ctx.translate(0, nef * 0.4); ctx.rotate(p.egim || 0);
    sekil(ctx, dikdortgen(-26, -60, 52, 66), 13, C.tenG, { kal: 4 });
    const hy = -170, rx = ck ? 112 : 108, ry = ck ? 112 : 124;
    // arka saç
    sekil(ctx, elips(0, hy - 18, rx + 18, ry + 6, 20), 14, C.sac, { kal: 5 });
    // kulaklar
    for (const k of [-1, 1]) sekil(ctx, elips(k * (rx - 2), hy + 10, 18, 26), 15 + k, C.tenG, { kal: 4 });
    // yüz
    sekil(ctx, elips(0, hy, rx, ry, 22), 16, C.ten, { golge: 'rgba(210,140,110,0.35)', gx: 14, gy: 10 });
    // ön saç (perçem + dalga)
    const sac = [[-rx - 14, hy - 4], [-rx - 6, hy - 70], [-60, hy - ry - 22], [10, hy - ry - 30], [80, hy - ry - 12], [rx + 10, hy - 50], [rx + 8, hy + 6],
      [rx - 18, hy - 44], [70, hy - 70], [30, hy - 52], [-10, hy - 80], [-50, hy - 50], [-rx + 18, hy - 50]];
    sekil(ctx, sac, 17, C.sac, { golge: 'rgba(255,220,180,0.18)', gx: -10, gy: 12 });
    cizgi(ctx, [[-30, hy - ry - 10], [0, hy - ry - 48 + Math.sin(t * 2) * 3], [22, hy - ry - 26]], 18, 5);   // tepe tutamı
    ctx.strokeStyle = C.sacA; ctx.lineWidth = 3; cizgi(ctx, [[-60, hy - 84], [-20, hy - 104], [30, hy - 98]], 19, 3, C.sacA);
    // kaşlar
    const bak = p.bak || [0, 0], gul = p.gulus ?? 0.4;
    for (const k of [-1, 1]) cizgi(ctx, [[k * 26, hy - 40 - gul * 2], [k * 46, hy - 47 - gul * 3], [k * 66, hy - 42]], 20 + k, 6);
    // gözler
    const g = clamp(p.goz ?? 1);
    for (const k of [-1, 1]) {
      const ex = k * 44 + bak[0] * 5, ey = hy - 8 + bak[1] * 4;
      if (g > 0.25) {
        ctx.fillStyle = C.kontur; ctx.beginPath(); ctx.ellipse(ex, ey, 11, 15 * g, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex - 3, ey - 5 * g, 4, 0, TAU); ctx.fill();
        if (g < 0.8) { ctx.fillStyle = C.ten; ctx.fillRect(ex - 14, ey - 18, 28, 18 * (1 - g) * 1.4); cizgi(ctx, [[ex - 14, ey - 18 + 18 * (1 - g) * 1.4], [ex + 14, ey - 18 + 18 * (1 - g) * 1.4]], 22 + k, 4); }
      } else cizgi(ctx, [[ex - 15, ey - 2], [ex, ey + 6], [ex + 15, ey - 2]], 23 + k, 5);
    }
    // yanaklar
    ctx.fillStyle = 'rgba(232,140,130,0.45)'; for (const k of [-1, 1]) { ctx.beginPath(); ctx.ellipse(k * 66, hy + 30, 20, 12, 0, 0, TAU); ctx.fill(); }
    // burun + ağız
    cizgi(ctx, [[2, hy + 4], [-6, hy + 28], [6, hy + 32]], 25, 4);
    cizgi(ctx, [[-24, hy + 56 - gul * 6], [0, hy + 60 + gul * 8], [24, hy + 56 - gul * 6]], 26, 5);
    ctx.restore();
    // --- kollar ---
    const kol = (k, el) => {
      const om = [k * (omuzW - 22), 40 + nef];
      const e = el || [k * (omuzW - 10), p.oturan ? 290 : 420];
      const dirs = [lerp(om[0], e[0], 0.5) + k * 40, lerp(om[1], e[1], 0.5) + 40];
      sekil(ctx, kolSekil(om, dirs, e, ck ? 24 : 32), 30 + k, kazak, { golge: 'rgba(150,90,30,0.22)' });
      sekil(ctx, elips(e[0], e[1], ck ? 20 : 26, ck ? 20 : 25), 33 + k, C.ten, { kal: 4 });
      return e;
    };
    const sagE = kol(-1, p.sagEl), solE = kol(1, p.solEl);
    ctx.restore();
    const ek = e => [x + e[0] * s, y + e[1] * s];
    return { sagEl: ek(sagE), solEl: ek(solE), bas: [x, y + (-170) * s], burun: [x + 0, y + (-140) * s] };
  }
  function kolSekil(a, b, c, w) {        // omuz-dirsek-el üzerinden kalın kol çokgeni
    const n = (p, q) => { const dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy) || 1; return [-dy / L * w, dx / L * w]; };
    const n1 = n(a, b), n2 = n(b, c);
    return [[a[0] + n1[0], a[1] + n1[1]], [b[0] + (n1[0] + n2[0]) / 2, b[1] + (n1[1] + n2[1]) / 2], [c[0] + n2[0] * 0.8, c[1] + n2[1] * 0.8],
      [c[0] - n2[0] * 0.8, c[1] - n2[1] * 0.8], [b[0] - (n1[0] + n2[0]) / 2, b[1] - (n1[1] + n2[1]) / 2], [a[0] - n1[0], a[1] - n1[1]]];
  }

  // ---------------- nesneler ----------------
  function parfum(ctx, x, y, s, t) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(-0.25);
    sekil(ctx, yuvarlakDik(-38, -10, 76, 90, 26), 50, 'rgba(201,160,200,0.9)', { golge: 'rgba(120,80,120,0.3)' });
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(-24, 4, 10, 52);
    sekil(ctx, dikdortgen(-12, -34, 24, 26), 51, C.altin, { kal: 4 });
    sekil(ctx, elips(0, -48, 20, 16), 52, C.erik, { kal: 4 });
    ctx.restore();
  }
  function cicek(ctx, x, y, s, t, seed = 0) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(Math.sin(t * 1.3 + seed) * 0.05);
    cizgi(ctx, [[0, 0], [-6, 90], [4, 200]], 60, 7, '#6f8f5e');
    sekil(ctx, [[-4, 110], [-60, 80], [-70, 110], [-10, 125]], 61, C.adacayi, { kal: 4 });
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + t * 0.1; sekil(ctx, elips(Math.cos(a) * 34, Math.sin(a) * 34, 30, 22, 12, a), 62 + i, i % 2 ? '#f2b3ac' : '#eda39b', { kal: 4 }); }
    sekil(ctx, elips(0, 0, 22, 22, 12), 70, C.altin, { kal: 4 });
    ctx.restore();
  }
  function kagit(ctx) { ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.22; ctx.drawImage(A.kagit, 0, 0, W, H); ctx.restore(); }
  function toz(ctx, t, n, renk, alfa = 0.5) {
    const r = rng(9);
    for (let i = 0; i < n; i++) {
      const x = (r() * W + Math.sin(t * 0.3 + i) * 40 + t * 12 * (r() - 0.3)) % W, y = (r() * H - t * 18 * (0.3 + r())) % H;
      ctx.fillStyle = `rgba(${renk},${alfa * (0.4 + 0.6 * Math.sin(t + i) ** 2)})`;
      ctx.beginPath(); ctx.arc(x < 0 ? x + W : x, y < 0 ? y + H : y, 3 + r() * 5, 0, TAU); ctx.fill();
    }
  }
  // ---------------- arka planlar ----------------
  function oda(ctx, t, sicak = 0) {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, C.duvar1); g.addColorStop(1, C.duvar2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // duvar kağıdı noktaları
    ctx.fillStyle = 'rgba(190,150,110,0.18)';
    for (let i = 0; i < 9; i++) for (let j = 0; j < 14; j++) { ctx.beginPath(); ctx.arc(60 + i * 120 + (j % 2) * 60, 60 + j * 120, 9, 0, TAU); ctx.fill(); }
    // raf + kitaplar + saksı
    sekil(ctx, dikdortgen(60, 560, 520, 26), 80, C.kahve);
    [[90, 70, C.kiremit], [165, 90, C.mavi], [255, 60, C.adacayi], [320, 80, C.erik]].forEach(([x, h, c], i) => sekil(ctx, dikdortgen(x, 560 - h * 2, 64, h * 2), 81 + i, c, { kal: 4 }));
    sekil(ctx, [[430, 470], [520, 470], [505, 560], [445, 560]], 86, C.kiremit, { kal: 4 });
    for (let k = 0; k < 4; k++) sekil(ctx, elips(475 + (k - 1.5) * 26, 430 - k % 2 * 20, 22, 40, 10, (k - 1.5) * 0.4 + Math.sin(t + k) * 0.05), 87 + k, C.adacayi, { kal: 4 });
    // lamba ışığı
    ctx.save(); ctx.globalCompositeOperation = 'soft-light'; const lg = ctx.createRadialGradient(900, 300, 30, 900, 300, 700); lg.addColorStop(0, `rgba(255,220,150,${0.7 + sicak * 0.3})`); lg.addColorStop(1, 'rgba(255,220,150,0)'); ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H); ctx.restore();
  }

  // ======================= SAHNE 1: PARFÜM ŞİŞESİ =======================
  VIDEO.sahne('koku', {
    ciz(ctx, S) {
      const t = S.t; KARE = Math.floor(S.gt * 6);
      const kok = ramp(t, 0.2, 1.1), dur = ramp(t, S.at(0, 0.5), S.at(0, 0.75));   // koklama, sonra duraklama
      ctx.save(); const z = lerp(1.0, 1.06, ease.inOut(clamp(t / S.d))); ctx.translate(540, 960); ctx.scale(z, z); ctx.translate(-540, -960);
      oda(ctx, t, dur);
            const k = kahraman(ctx, 540, 1120, 1.35, { t, goz: dur > 0.1 ? lerp(0.05, 0.75, dur) : 1 - kok * 0.95, bak: [dur * 0.6, -dur * 0.7], gulus: lerp(0.15, 0.7, dur),
        egim: lerp(0, -0.06, kok) + dur * 0.05, sagEl: [lerp(-150, -95, kok), lerp(80, -10, kok) + Math.sin(t * 1.5) * 3], solEl: null });
      parfum(ctx, k.sagEl[0] + 20, k.sagEl[1] - 55, 1.05, t);
      kokuIzi(ctx, k.sagEl[0] + 30, k.sagEl[1] - 115, k.burun[0] - 20, k.burun[1] + 10, t, '#b089b6', kok * (1 - dur * 0.6), 1);
      // anı parıltısı: duraklama anında sıcak ışık halkası
      if (dur > 0) {
        ctx.save(); ctx.globalAlpha = dur * 0.8;
        for (let i = 0; i < 3; i++) { const r = 120 + ((t * 60 + i * 90) % 270); ctx.strokeStyle = `rgba(240,198,110,${0.6 * (1 - r / 400)})`; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(k.bas[0], k.bas[1] - 20, r, 0, TAU); ctx.stroke(); }
        ctx.restore();
      }
      ctx.restore();
      toz(ctx, t, 18, '255,230,170', 0.35 + dur * 0.3);
      kagit(ctx);
    },
  });

  // ======================= SAHNE 2: ANNEANNENİN MUTFAĞI =======================
  function anneanne(ctx, x, y, s, t) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    const kar = Math.sin(t * 3) * 0.12;
    sekil(ctx, [[-120, 0], [-150, 80], [-160, 420], [160, 420], [150, 80], [120, 0], [40, -14], [-40, -14]], 100, C.erik, { golge: 'rgba(80,50,80,0.25)' });       // hırka
    sekil(ctx, [[-80, 40], [80, 40], [100, 420], [-100, 420]], 101, '#f0d8c0', { kal: 4 });                                                                       // önlük
    ctx.fillStyle = 'rgba(207,132,102,0.5)'; for (let i = 0; i < 5; i++) for (let j = 0; j < 7; j++) { ctx.beginPath(); ctx.arc(-60 + i * 30, 80 + j * 48, 5, 0, TAU); ctx.fill(); }
    sekil(ctx, dikdortgen(-24, -50, 48, 50), 102, C.tenG, { kal: 4 });
    sekil(ctx, elips(0, -140, 100, 108, 20), 103, C.ten, { golge: 'rgba(210,140,110,0.35)' });
    sekil(ctx, [[-104, -130], [-96, -200], [-30, -250], [40, -248], [100, -200], [104, -130], [70, -190], [0, -205], [-70, -190]], 104, '#d8d4d0');
    sekil(ctx, elips(0, -258, 46, 36), 105, '#d8d4d0');                                                                                                           // topuz
    for (const k of [-1, 1]) { ctx.strokeStyle = C.kontur; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(k * 38, -140, 24, 0, TAU); ctx.stroke(); cizgi(ctx, [[k * 30, -140], [k * 38, -134], [k * 46, -140]], 106 + k, 4); }
    cizgi(ctx, [[-14, -140], [14, -140]], 108, 4);
    cizgi(ctx, [[-22, -92], [0, -82], [22, -92]], 109, 5);
    ctx.fillStyle = 'rgba(232,140,130,0.5)'; for (const k of [-1, 1]) { ctx.beginPath(); ctx.ellipse(k * 62, -104, 18, 11, 0, 0, TAU); ctx.fill(); }
    // karıştıran kol + kaşık
    const el = [150 + Math.cos(t * 3) * 26, 150 + Math.sin(t * 3) * 10];
    sekil(ctx, kolSekil([110, 40], [170, 110], el, 30), 110, C.erik);
    sekil(ctx, elips(el[0], el[1], 24, 24), 111, C.ten, { kal: 4 });
    cizgi(ctx, [[el[0], el[1]], [el[0] + 30, el[1] + 120 + kar * 50]], 112, 9, C.kahve);
    ctx.restore();
  }
  VIDEO.sahne('mutfak', {
    ciz(ctx, S) {
      const t = S.t; KARE = Math.floor(S.gt * 6);
      ctx.save(); const z = lerp(1.08, 1.0, ease.out(clamp(t / 2.5))); ctx.translate(540, 960); ctx.scale(z, z); ctx.translate(-540 + Math.sin(t * 0.4) * 10, -960);
      ctx.fillStyle = '#f2dcb8'; ctx.fillRect(0, 0, W, H);
      // fayanslar
      ctx.strokeStyle = 'rgba(190,150,110,0.35)'; ctx.lineWidth = 3;
      for (let y = 700; y < 1250; y += 70) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      for (let x = 0; x < W; x += 70) { ctx.beginPath(); ctx.moveTo(x, 700); ctx.lineTo(x, 1250); ctx.stroke(); }
      // pencere + perde
      sekil(ctx, dikdortgen(120, 180, 400, 420), 120, '#bcd3d8', { kal: 6 });
      cizgi(ctx, [[320, 180], [320, 600]], 121, 6); cizgi(ctx, [[120, 390], [520, 390]], 122, 6);
      ctx.save(); ctx.globalAlpha = 0.9;
      for (const k of [0, 1]) { const sal = Math.sin(t * 1.2 + k) * 16; sekil(ctx, [[k ? 400 : 90, 160], [k ? 550 : 240, 160], [k ? 560 + sal : 230 + sal, 630], [k ? 440 + sal : 110 + sal, 640]], 123 + k, '#f3c3b6', { kal: 4 }); }
      ctx.restore();
      // asılı tavalar, raf
      for (let i = 0; i < 3; i++) { const sx = 650 + i * 120, sl = Math.sin(t * 1.5 + i) * 0.06; ctx.save(); ctx.translate(sx, 160); ctx.rotate(sl); cizgi(ctx, [[0, 0], [0, 60]], 125 + i, 4); sekil(ctx, elips(0, 110, 46, 46), 128 + i, i === 1 ? C.kiremit : '#a39a94'); cizgi(ctx, [[0, 64], [0, 30]], 131 + i, 10, C.kahve); ctx.restore(); }
      // tezgâh + ocak + tencere
      sekil(ctx, dikdortgen(-20, 1250, 1120, 60), 135, '#c9a27e');
      sekil(ctx, dikdortgen(-20, 1310, 1120, 700), 136, '#b88c64', { golge: 'rgba(90,60,40,0.2)' });
      sekil(ctx, yuvarlakDik(560, 1100, 320, 160, 40), 137, '#d4705a', { golge: 'rgba(120,40,30,0.3)' });
      sekil(ctx, elips(720, 1100, 165, 26), 138, '#b8604c');
      // buhar: kıvrılarak yükselen koku
      for (let k = 0; k < 4; k++) {
        const pts = []; for (let i = 0; i <= 10; i++) { const u = i / 10; pts.push([640 + k * 55 + Math.sin(u * 6 + t * 2 + k) * 30, 1080 - u * 520 - ((t * 60) % 40)]); }
        ctx.save(); ctx.globalAlpha = 0.5; cizgi(ctx, pts, 140 + k, 10, '#fff7ea'); ctx.restore();
      }
      anneanne(ctx, 820, 760, 1.05, t);
      // çocukluk: aynı karakter, küçük, masada bacak sallıyor
      sekil(ctx, dikdortgen(40, 1430, 420, 40), 150, C.kahve);
      sekil(ctx, yuvarlakDik(80, 1500, 70, 140, 10), 151, '#9a7458');
      const ck = kahraman(ctx, 230, 1200, 0.85, { t, cocuk: 1, goz: 1 - pencere(t % 3.2, 2.9, 3.1, 0.05), bak: [0.8, -0.4], gulus: 0.8, sagEl: [-60, 260], solEl: [120, 240], egim: Math.sin(t * 1.4) * 0.04 });
      sekil(ctx, yuvarlakDik(320, 1390, 60, 50, 10), 152, '#f6efe4', { kal: 4 });                 // çay bardağı/kase
      ctx.restore();
      // anı çerçevesi: sıcak sepya + bulutsu kenar
      ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgba(255,214,160,0.35)'; ctx.fillRect(0, 0, W, H); ctx.restore();
      ctx.drawImage(A.aniKenar, 0, 0);
      toz(ctx, t, 26, '255,240,200', 0.45);
      kagit(ctx);
    },
  });

  // ======================= SAHNE 3: BEYİN =======================
  function etiketHap(ctx, metin, alt, x, y, renk, a) {
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha = clamp(a); ctx.translate(x, y); const sc = lerp(0.8, 1, ease.outBack(clamp(a))); ctx.scale(sc, sc);
    ctx.font = `800 58px ${FONT}`; const w = Math.max(ctx.measureText(metin).width, 200) + 70;
    sekil(ctx, yuvarlakDik(-w / 2, -50, w, alt ? 120 : 92, 40), metin.length, '#fffaf0', { kal: 5, renk });
    yazi(ctx, metin, 0, -6, { boyut: 58, agirlik: 800, renk: C.kontur, golge: false });
    if (alt) yazi(ctx, alt, 0, 44, { boyut: 38, agirlik: 700, renk, golge: false });
    ctx.restore();
  }
  VIDEO.sahne('beyin', {
    ciz(ctx, S) {
      const t = S.t; KARE = Math.floor(S.gt * 6);
      ctx.fillStyle = '#e8eef0'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(157,180,200,0.25)'; for (let i = 0; i < 12; i++) for (let j = 0; j < 20; j++) { ctx.beginPath(); ctx.arc(45 + i * 90, 45 + j * 90, 4, 0, TAU); ctx.fill(); }
      ctx.save(); const z = lerp(1.0, 1.08, ease.inOut(clamp(t / S.d))); ctx.translate(540, 900); ctx.scale(z, z); ctx.translate(-540, -900);
      // baş silueti (yan profil, sola bakıyor) ve burun
      const bas = [[300, 1500], [250, 1300], [160, 1150], [150, 1080], [110, 1040], [150, 990], [170, 900], [190, 700], [330, 480], [560, 400], [800, 450], [940, 620], [970, 860], [920, 1060], [820, 1200], [760, 1350], [760, 1500]];
      sekil(ctx, bas, 200, '#f6dcc6', { kal: 6, golge: 'rgba(220,170,140,0.35)', gx: -20, gy: 0 });
      // beyin (yan görünüş)
      const by = [[260, 820], [270, 660], [380, 540], [560, 500], [740, 540], [860, 660], [880, 800], [820, 900], [720, 920], [660, 980], [560, 960], [420, 930], [300, 900]];
      sekil(ctx, by, 201, '#f1b3b8', { kal: 6, golge: 'rgba(200,110,130,0.3)', gx: 10, gy: 16 });
      ctx.save(); ctx.clip(yol(by, 201, 0)); ctx.globalAlpha = 0.55;
      [[[320, 640], [400, 600], [460, 660], [520, 590]], [[560, 560], [600, 640], [680, 600], [720, 660]], [[300, 780], [380, 730], [450, 790], [520, 740], [600, 800]], [[640, 720], [720, 760], [800, 700]], [[420, 860], [500, 830], [580, 880], [660, 850]], [[740, 820], [820, 860]]]
        .forEach((p, i) => cizgi(ctx, p, 210 + i, 5, '#c97f8a'));
      ctx.restore();
      // beyincik + beyin sapı
      sekil(ctx, elips(760, 960, 95, 60, 14), 220, '#e79aa2', { kal: 5 });
      sekil(ctx, [[640, 960], [690, 960], [700, 1120], [650, 1120]], 221, '#e7a6ac', { kal: 5 });
      // burun boşluğundan koku → koku soğancığı (beynin alt-önü)
      const bulb = [340, 905];
      const a0 = ramp(t, 0.2, 1.2);
      kokuIzi(ctx, 130, 1060, bulb[0] - 10, bulb[1] + 30, t, '#b089b6', a0, 3, 6);
      sekil(ctx, elips(bulb[0], bulb[1], 46, 16, 12, -0.1), 222, '#d69ac0', { kal: 4 });
      // derin yapılar: amigdala (badem) ve hipokampus (kıvrık)
      const amg = [520, 860], hip = [[560, 850], [610, 820], [670, 815], [720, 840], [740, 880]];
      const vurgu1 = ramp(t, S.at(0, 0.35), S.at(0, 0.6)), hipA = ramp(t, S.at(1, 0.12), S.at(1, 0.24)), amgA = ramp(t, S.at(1, 0.33), S.at(1, 0.45));
      const nab = k => 1 + 0.08 * Math.sin(t * 5 + k);
      // bağlantılar: soğancıktan iki merkeze akan ışık
      const bag = (hedef, renk, a, k) => {
        if (a <= 0) return;
        ctx.save(); ctx.globalAlpha = a; ctx.setLineDash([14, 14]); ctx.lineDashOffset = -t * 60;
        cizgi(ctx, [bulb, [(bulb[0] + hedef[0]) / 2, bulb[1] + 40], hedef], 230 + k, 7, renk); ctx.restore();
        const u = (t * 0.7 + k * 0.4) % 1, px = lerp(lerp(bulb[0], (bulb[0] + hedef[0]) / 2, u), lerp((bulb[0] + hedef[0]) / 2, hedef[0], u), u), py = lerp(lerp(bulb[1], bulb[1] + 40, u), lerp(bulb[1] + 40, hedef[1], u), u);
        ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = renk; ctx.beginPath(); ctx.arc(px, py, 10, 0, TAU); ctx.fill(); ctx.restore();
      };
      bag(amg, '#e08a4a', Math.max(vurgu1, amgA), 0);
      bag(hip[2], '#4f8fc0', Math.max(vurgu1, hipA), 1);
      // hipokampus
      ctx.save(); ctx.globalAlpha = 0.5 + 0.5 * Math.max(vurgu1, hipA);
      if (hipA > 0) { ctx.save(); ctx.globalAlpha = hipA * 0.5; ctx.fillStyle = '#9cc7e6'; ctx.beginPath(); ctx.arc(660, 845, 90 * nab(1), 0, TAU); ctx.fill(); ctx.restore(); }
      ctx.lineCap = 'round'; ctx.strokeStyle = C.kontur; ctx.lineWidth = 32; ctx.stroke(yol(hip, 240, 1, false));
      ctx.strokeStyle = '#5a9fd0'; ctx.lineWidth = 22; ctx.stroke(yol(hip, 240, 1, false));
      ctx.restore();
      // amigdala
      ctx.save(); ctx.globalAlpha = 0.5 + 0.5 * Math.max(vurgu1, amgA);
      if (amgA > 0) { ctx.save(); ctx.globalAlpha = amgA * 0.5; ctx.fillStyle = '#f6c08e'; ctx.beginPath(); ctx.arc(amg[0], amg[1], 70 * nab(2), 0, TAU); ctx.fill(); ctx.restore(); }
      sekil(ctx, elips(amg[0], amg[1], 30 * nab(2), 22 * nab(2), 12, -0.4), 241, '#e8894a', { kal: 5 });
      ctx.restore();
      // etiketler
      etiketHap(ctx, 'Koku soğancığı', null, 330, 1190, '#b06aa0', ramp(t, 0.6, 1.2) * (1 - ramp(t, S.at(1, 0.05), S.at(1, 0.15))));
      etiketHap(ctx, 'HAFIZA', null, 760, 330, '#4f8fc0', vurgu1 * (1 - ramp(t, S.at(1, 0.05), S.at(1, 0.15))));
      etiketHap(ctx, 'DUYGU', null, 330, 330, '#e08a4a', ramp(t, S.at(0, 0.45), S.at(0, 0.62)) * (1 - ramp(t, S.at(1, 0.05), S.at(1, 0.15))));
      etiketHap(ctx, 'Hipokampus', 'anılar', 760, 300, '#4f8fc0', hipA);
      etiketHap(ctx, 'Amigdala', 'duygular', 330, 300, '#e08a4a', amgA);
      if (hipA > 0) { ctx.save(); ctx.globalAlpha = hipA; ctx.setLineDash([6, 10]); cizgi(ctx, [[760, 400], [720, 600], [680, 800]], 250, 4, '#4f8fc0'); ctx.restore(); }
      if (amgA > 0) { ctx.save(); ctx.globalAlpha = amgA; ctx.setLineDash([6, 10]); cizgi(ctx, [[330, 400], [420, 640], [505, 840]], 251, 4, '#e08a4a'); ctx.restore(); }
      ctx.restore();
      kagit(ctx);
    },
  });

  // ======================= SAHNE 4: ÇİÇEK VE ANILAR =======================
  function aniIkon(ctx, tur, r) {
    ctx.lineWidth = 4;
    if (tur === 0) { // uçurtma
      sekil(ctx, [[0, -r * 0.6], [r * 0.4, 0], [0, r * 0.6], [-r * 0.4, 0]], 300, C.kiremit, { kal: 4 }); cizgi(ctx, [[0, r * 0.6], [10, r * 0.75], [-6, r * 0.9]], 301, 3);
    } else if (tur === 1) { // pasta
      sekil(ctx, dikdortgen(-r * 0.5, -r * 0.1, r, r * 0.5), 302, C.pembe, { kal: 4 }); sekil(ctx, dikdortgen(-4, -r * 0.45, 8, r * 0.33), 303, C.altin, { kal: 3 });
      ctx.fillStyle = '#f08a3a'; ctx.beginPath(); ctx.ellipse(0, -r * 0.52, 6, 10, 0, 0, TAU); ctx.fill();
    } else if (tur === 2) { // bisiklet
      for (const k of [-1, 1]) { ctx.strokeStyle = C.kontur; ctx.beginPath(); ctx.arc(k * r * 0.35, r * 0.15, r * 0.25, 0, TAU); ctx.stroke(); }
      cizgi(ctx, [[-r * 0.35, r * 0.15], [-r * 0.05, -r * 0.2], [r * 0.25, -r * 0.2], [r * 0.35, r * 0.15]], 304, 5, C.mavi); cizgi(ctx, [[-r * 0.05, -r * 0.2], [0, r * 0.15], [r * 0.25, -r * 0.2]], 305, 5, C.mavi);
    } else if (tur === 3) { // deniz + güneş
      ctx.fillStyle = C.altin; ctx.beginPath(); ctx.arc(r * 0.2, -r * 0.2, r * 0.22, 0, TAU); ctx.fill();
      sekil(ctx, [[-r * 0.6, r * 0.1], [-r * 0.3, 0], [0, r * 0.1], [r * 0.3, 0], [r * 0.6, r * 0.1], [r * 0.6, r * 0.6], [-r * 0.6, r * 0.6]], 306, C.mavi, { kal: 4 });
    } else if (tur === 4) { // kedi
      sekil(ctx, elips(0, r * 0.1, r * 0.38, r * 0.32), 307, '#e0b38a', { kal: 4 });
      for (const k of [-1, 1]) sekil(ctx, [[k * r * 0.32, -r * 0.05], [k * r * 0.3, -r * 0.42], [k * r * 0.08, -r * 0.18]], 308 + k, '#e0b38a', { kal: 4 });
      for (const k of [-1, 1]) { ctx.fillStyle = C.kontur; ctx.beginPath(); ctx.arc(k * r * 0.14, r * 0.06, 5, 0, TAU); ctx.fill(); }
    } else { // sarılma (iki figür + kalp)
      sekil(ctx, elips(-r * 0.18, -r * 0.1, r * 0.18, r * 0.18), 310, C.ten, { kal: 4 }); sekil(ctx, elips(r * 0.2, -r * 0.18, r * 0.2, r * 0.2), 311, C.ten, { kal: 4 });
      sekil(ctx, elips(r * 0.2, -r * 0.3, r * 0.2, r * 0.1), 312, '#d8d4d0', { kal: 3 });
      sekil(ctx, elips(0, r * 0.35, r * 0.48, r * 0.25), 313, C.erik, { kal: 4 });
    }
  }
  const ANILAR = [[-300, -470, 0, 1], [300, -500, 1, 2], [-360, -130, 2, 1], [370, -160, 3, 2], [-250, 230, 4, 1], [280, 200, 5, 2]];
  VIDEO.sahne('cicek', {
    ciz(ctx, S) {
      const t = S.t; KARE = Math.floor(S.gt * 6);
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#f4e3d3'); g.addColorStop(1, '#e9cfc0'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // yumuşak daireler (bokeh benzeri düz lekeler)
      for (let i = 0; i < 9; i++) { ctx.fillStyle = ['rgba(169,191,158,0.25)', 'rgba(233,167,160,0.25)', 'rgba(157,180,200,0.25)'][i % 3]; ctx.beginPath(); ctx.arc((i * 173 + t * 8) % 1200 - 60, 200 + (i * 331) % 1500, 60 + (i % 4) * 30, 0, TAU); ctx.fill(); }
      const kok = ramp(t, 0.1, 0.9), duygu = ramp(t, S.at(1, 0.0), S.at(1, 0.4));
      const cx = 540, cy = 1230;
      // anı balonları (karakterin çevresinde süzülür)
      ANILAR.forEach(([dx, dy, tur, grup], i) => {
        const bas = grup === 1 ? S.at(0, 0.15 + i * 0.08) : S.at(0, 0.6 + i * 0.05);
        const a = ramp(t, bas, bas + 0.5, ease.outBack);
        if (a <= 0) return;
        const sx = cx + dx + Math.sin(t * 0.9 + i) * 14, sy = cy - 250 + dy + Math.cos(t * 0.8 + i * 2) * 12, r = 105;
        ctx.save(); ctx.translate(sx, sy); ctx.scale(a, a);
        if (duygu > 0) { ctx.save(); ctx.globalAlpha = duygu * 0.5; ctx.fillStyle = '#ffd9a0'; ctx.beginPath(); ctx.arc(0, 0, r * (1.25 + 0.08 * Math.sin(t * 3 + i)), 0, TAU); ctx.fill(); ctx.restore(); }
        sekil(ctx, elips(0, 0, r, r, 18), 320 + i, '#fffaf0', { kal: 5 });
        aniIkon(ctx, tur, r);
        // karaktere uzanan küçük düşünce noktaları
        ctx.fillStyle = 'rgba(255,250,240,0.9)'; ctx.strokeStyle = C.kontur; ctx.lineWidth = 3;
        for (let k = 1; k <= 2; k++) { const px = -dx * 0.18 * k, py = (-dy + 120) * 0.14 * k; ctx.beginPath(); ctx.arc(px, py + r * 0.4, 12 - k * 3, 0, TAU); ctx.fill(); ctx.stroke(); }
        ctx.restore();
      });
      // duygu: küçük kalpler yükselir
      if (duygu > 0) for (let i = 0; i < 7; i++) {
        const u = ((t * 0.35 + i / 7) % 1), x = cx + (i - 3) * 110 + Math.sin(t * 2 + i) * 20, y = cy - 300 - u * 700;
        ctx.save(); ctx.globalAlpha = duygu * Math.sin(Math.PI * u); ctx.translate(x, y); ctx.scale(0.9, 0.9);
        sekil(ctx, [[0, 14], [-22, -6], [-14, -20], [0, -10], [14, -20], [22, -6]], 340 + i, '#e98a8a', { kal: 3 }); ctx.restore();
      }
      const k = kahraman(ctx, cx, cy, 1.2, { t, goz: lerp(1, 0, kok) + duygu * 0.0, gulus: lerp(0.3, 0.9, ramp(t, S.at(0, 0.3), S.at(0, 0.8))), egim: -0.05 * kok + Math.sin(t * 0.8) * 0.02,
        sagEl: [lerp(-150, -100, kok), lerp(380, 30, kok)], solEl: null });
      cicek(ctx, k.sagEl[0] + 40, k.sagEl[1] - 120, 0.9, t);
      kokuIzi(ctx, k.sagEl[0] + 40, k.sagEl[1] - 150, k.burun[0], k.burun[1] + 20, t, '#e9a7a0', kok * 0.8, 5, 5);
      toz(ctx, t, 20, '255,235,200', 0.4);
      kagit(ctx);
    },
  });

  // ======================= SAHNE 5: PENCERE KENARI =======================
  VIDEO.sahne('pencere', {
    ciz(ctx, S) {
      const t = S.t; KARE = Math.floor(S.gt * 6);
      ctx.save(); const z = lerp(1.0, 1.1, ease.inOut(clamp(t / S.d))); ctx.translate(560, 1000); ctx.scale(z, z); ctx.translate(-560, -1000);
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#e9d9c4'); g.addColorStop(1, '#dcc6a8'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // pencere (gün batımı manzarası)
      const pw = [520, 220, 480, 700];
      sekil(ctx, dikdortgen(pw[0] - 20, pw[1] - 20, pw[2] + 40, pw[3] + 40), 400, '#f6efe4', { kal: 6 });
      ctx.save(); ctx.beginPath(); ctx.rect(pw[0], pw[1], pw[2], pw[3]); ctx.clip();
      const gg = ctx.createLinearGradient(0, pw[1], 0, pw[1] + pw[3]); gg.addColorStop(0, '#f6c9a0'); gg.addColorStop(0.6, '#f3a98c'); gg.addColorStop(1, '#c69aa8'); ctx.fillStyle = gg; ctx.fillRect(pw[0], pw[1], pw[2], pw[3]);
      ctx.fillStyle = '#fbe1a8'; ctx.beginPath(); ctx.arc(820, 700 + Math.sin(t * 0.2) * 4, 80, 0, TAU); ctx.fill();
      sekil(ctx, [[480, 880], [620, 760], [760, 840], [900, 740], [1040, 860], [1040, 960], [480, 960]], 401, '#a98fa8', { kal: 4 });
      sekil(ctx, elips(650 + (t * 14) % 400, 360, 70, 26), 402, '#fff4ea', { kal: 4 });
      for (let i = 0; i < 3; i++) { const bx = 560 + ((t * 50 + i * 140) % 520), by = 420 + Math.sin(t * 2 + i) * 20 + i * 30, f = Math.sin(t * 10 + i) * 8; cizgi(ctx, [[bx - 16, by - f], [bx, by], [bx + 16, by - f]], 403 + i, 4); }
      ctx.restore();
      cizgi(ctx, [[pw[0] + pw[2] / 2, pw[1]], [pw[0] + pw[2] / 2, pw[1] + pw[3]]], 410, 8, '#f6efe4'); cizgi(ctx, [[pw[0], pw[1] + pw[3] / 2], [pw[0] + pw[2], pw[1] + pw[3] / 2]], 411, 8, '#f6efe4');
      // perde (dalgalanır)
      const sal = Math.sin(t * 1.1) * 18;
      sekil(ctx, [[440, 160], [600, 160], [590 + sal, 980], [470 + sal * 0.6, 1000]], 412, '#a9bf9e', { kal: 5, golge: 'rgba(90,120,80,0.2)' });
      // pencereden giren ışık
      ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = 0.8; ctx.fillStyle = '#fff1c8';
      ctx.beginPath(); ctx.moveTo(pw[0], pw[1]); ctx.lineTo(pw[0] + pw[2], pw[1]); ctx.lineTo(560, 1900); ctx.lineTo(-200, 1900); ctx.closePath(); ctx.fill(); ctx.restore();
      // pervaz + vazo
      sekil(ctx, dikdortgen(480, 960, 560, 40), 413, '#f6efe4', { kal: 5 });
      // sandalye
      sekil(ctx, yuvarlakDik(60, 900, 420, 470, 40), 414, '#c98f6a', { golge: 'rgba(120,70,40,0.25)' });
      sekil(ctx, yuvarlakDik(40, 1330, 460, 80, 30), 415, '#b97f5a');
      for (const xx of [80, 420]) sekil(ctx, dikdortgen(xx, 1400, 30, 300), 416 + xx, '#9a6a48', { kal: 4 });
      // karakter oturuyor, çiçeği kucağında tutuyor
      const gul = ramp(t, S.at(0, 0.5), S.konusma.end + 0.3), gozA = lerp(0.85, 0.55, gul);
      const kirp = pencere(t % 4.5, 3.6, 3.85, 0.08);
      const k = kahraman(ctx, 270, 1020, 0.95, { t, oturan: true, goz: gozA * (1 - kirp), bak: [0.9, -0.5], gulus: lerp(0.3, 0.85, gul), egim: 0.06 + Math.sin(t * 0.6) * 0.02,
        sagEl: [40, 240], solEl: [120, 230], nefesGuc: 0.7 });
      cicek(ctx, k.solEl[0] + 10, k.solEl[1] - 140, 0.8, t, 2);
      ctx.restore();
      toz(ctx, t, 30, '255,240,200', 0.55);
      kagit(ctx);
    },
  });

  VIDEO.sahne('_ortak', {
    hazirla() {
      A.kagit = gurultuDokusu(270, 480, 6, 21, f => [255 - f * 40, 245 - f * 45, 230 - f * 55, 255], 3);
      // anı kenarı: bulutsu, sıcak beyaz çerçeve
      const c = tuval(), x = c.getContext('2d');
      x.fillStyle = 'rgba(250,236,210,0.95)'; x.fillRect(0, 0, W, H);
      x.globalCompositeOperation = 'destination-out'; x.filter = 'blur(30px)';
      x.beginPath();
      for (let i = 0; i <= 40; i++) { const a = i / 40 * TAU, r = 1 + 0.05 * Math.sin(a * 7) + 0.03 * Math.sin(a * 13); const px = 540 + Math.cos(a) * 520 * r, py = 960 + Math.sin(a) * 900 * r; i ? x.lineTo(px, py) : x.moveTo(px, py); }
      x.fill(); A.aniKenar = c;
    },
    ciz() { },
  });
})();
