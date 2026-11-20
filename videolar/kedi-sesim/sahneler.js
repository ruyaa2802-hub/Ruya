/* "Bir gün sesimi duymayacaksın" — kedinin gözünden kısa film.
 * Stil: yumuşak gölgeli, ışık huzmeli, tüylü dijital resim (kontur yok). Tek kedi: kabarık turuncu-beyaz, yeşil gözlü.
 * Kedi poz parametreleri sayısal olarak karışır (yürü ⇄ otur ⇄ yat), yaş (yas) parametresi tüyü kırlaştırır.
 */
(function () {
  const { W, H, clamp, lerp, ease, ramp, pencere, rng, tuval, gurultuDokusu, yazi, FONT } = STUDIO.R;
  const TAU = Math.PI * 2;
  const A = {};
  const SICAK = '255,214,160';

  // ======================= KEDİ =======================
  const POZ = {
    // gövde merkezi, dönüş, yarıçaplar, baş, ön/arka bacak (omuz → pati), kalça yuvarlağı, kuyruk kökü ve açısı
    ayakta: { gx: -10, gy: -150, gr: 0, grx: 165, gry: 78, bx: 170, by: -225, kalca: 64, kalx: -120, kaly: -140,
      on: [62, -130, 80, 0], arka: [-120, -120, -130, 0], kk: [-170, -160], ka: -2.2, kuyrukEgri: 0.9 },
    otur: { gx: -40, gy: -150, gr: -1.0, grx: 130, gry: 82, bx: 55, by: -300, kalca: 86, kalx: -75, kaly: -80,
      on: [30, -170, 45, 0], arka: [-70, -50, -10, -2], kk: [-120, -30], ka: 0.1, kuyrukEgri: -1.3 },
    yat: { gx: -10, gy: -62, gr: 0.05, grx: 175, gry: 62, bx: 150, by: -105, kalca: 70, kalx: -110, kaly: -66,
      on: [80, -50, 200, -8], arka: [-110, -40, -20, -6], kk: [-170, -60], ka: 0.4, kuyrukEgri: -1.6 },
  };
  function pozKaristir(a, b, u) {
    const o = {};
    for (const k in a) o[k] = Array.isArray(a[k]) ? a[k].map((v, i) => lerp(v, b[k][i], u)) : lerp(a[k], b[k], u);
    return o;
  }
  function renkler(yas) {
    const kir = c => c.map((v, i) => Math.round(lerp(v, [200, 190, 180][i], yas * 0.35)));
    const rgb = c => `rgb(${c.join(',')})`;
    return { tur: rgb(kir([232, 142, 62])), turK: rgb(kir([196, 104, 40])), turA: rgb(kir([248, 180, 110])), bey: '#f7f1e8', beyG: '#dccfc2', ic: '#e9a39c' };
  }
  // tüy dokusu ile doldurulmuş, yumuşak kenarlı şekil
  function tuyluDoldur(ctx, P, renk, doku, kenar = 'rgba(0,0,0,0)') {
    ctx.save(); ctx.fillStyle = renk; ctx.fill(P);
    ctx.clip(P); ctx.globalAlpha = 0.55; ctx.globalCompositeOperation = 'soft-light'; ctx.drawImage(doku, -400, -400, 800, 800);
    ctx.restore();
  }
  function kenarTuy(ctx, cx, cy, rx, ry, rot, renk, n, uz, a0 = 0, a1 = TAU, seed = 1, yon = 1) {
    ctx.save(); ctx.strokeStyle = renk; ctx.lineCap = 'round';
    const r = rng(seed);
    for (let i = 0; i < n; i++) {
      const a = lerp(a0, a1, i / n) + (r() - 0.5) * 0.05;
      const x = Math.cos(a) * rx, y = Math.sin(a) * ry;
      const px = cx + x * Math.cos(rot) - y * Math.sin(rot), py = cy + x * Math.sin(rot) + y * Math.cos(rot);
      const nx = Math.cos(a + rot), ny = Math.sin(a + rot), L = uz * (0.3 + r() * 0.45);
      ctx.lineWidth = 2.5 + r() * 3; ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.moveTo(px - nx * 4, py - ny * 4); ctx.quadraticCurveTo(px + nx * L * 0.6 + ny * 3 * yon, py + ny * L * 0.6 - nx * 3 * yon, px + nx * L + ny * 6 * yon, py + ny * L - nx * 6 * yon); ctx.stroke();
    }
    ctx.restore();
  }
  function elipsYol(cx, cy, rx, ry, rot = 0) { const P = new Path2D(); P.ellipse(cx, cy, rx, ry, rot, 0, TAU); return P; }

  /* kedi(ctx, x, y, s, p): (x,y) zemin; yon 1 sağa, -1 sola bakar.
   * p: t, poz {ayakta, otur, yat oranları via p.otur, p.yat}, yuru (adım fazı), adim 0..1, goz 0..1, bak 0..1 (kameraya dönüş),
   *    miyav 0..1, pati 0..1 + patiHedef [x,y] (yerel), basEgim, yas 0..1, kulak (geri yatma), kuyrukSal, nefes */
  function kedi(ctx, x, y, s, p) {
    const t = p.t || 0, yas = p.yas || 0, K = renkler(yas);
    let P = pozKaristir(POZ.ayakta, POZ.otur, clamp(p.otur || 0));
    if (p.yat) P = pozKaristir(P, POZ.yat, clamp(p.yat));
    const nef = Math.sin(t * (p.yat ? 1.4 : 2.0)) * (p.yat ? 4 : 2);
    const adim = p.adim || 0, fz = p.yuru || 0;
    const bob = Math.abs(Math.sin(fz)) * 6 * adim;
    ctx.save(); ctx.translate(x, y); ctx.scale(s * (p.yon || 1), s);
    // zemin gölgesi
    const gg = ctx.createRadialGradient(-10, 0, 10, -10, 0, 230); gg.addColorStop(0, 'rgba(40,20,10,0.35)'); gg.addColorStop(1, 'rgba(40,20,10,0)');
    ctx.fillStyle = gg; ctx.save(); ctx.scale(1, 0.12); ctx.beginPath(); ctx.arc(-10, 0, 230, 0, TAU); ctx.fill(); ctx.restore();
    ctx.translate(0, -bob);
    // --- kuyruk ---
    const sal = Math.sin(t * (1.2 - yas * 0.5) + 1) * (p.kuyrukSal ?? 0.35);
    const [kx, ky] = P.kk;
    const kuyrukNokta = u => {
      const a = P.ka + sal * u * 1.2 + P.kuyrukEgri * u * u;
      return [kx + Math.cos(P.ka + sal * 0.5) * 0 + u * 230 * Math.cos(a), ky + u * 230 * Math.sin(a)];
    };
    for (let i = 26; i >= 0; i--) {
      const u = i / 26, [qx, qy] = kuyrukNokta(u), r = lerp(30, 20, u) * (1 + 0.1 * Math.sin(i * 1.7));
      ctx.fillStyle = Math.floor(u * 7) % 2 ? K.turK : K.tur;
      ctx.beginPath(); ctx.arc(qx, qy, r, 0, TAU); ctx.fill();
    }
    { const [qx, qy] = kuyrukNokta(1); kenarTuy(ctx, qx, qy, 18, 18, 0, K.tur, 14, 12, 0, TAU, 5); }
    // --- uzak bacaklar (koyu) ---
    const bacak = (o, faz, uzak, on) => {
      const ofs = Math.sin(faz) * 46 * adim, kalk = Math.max(0, Math.cos(faz)) * 26 * adim;
      let [sx, sy, ex, ey] = o; ex += ofs; ey -= kalk;
      if (on && !uzak && p.pati) { ex = lerp(ex, p.patiHedef[0], ease.inOut(p.pati)); ey = lerp(ey, p.patiHedef[1], ease.inOut(p.pati)); }
      const dx = uzak ? -14 : 0;
      ctx.save(); ctx.lineCap = 'round';
      ctx.strokeStyle = uzak ? K.turK : K.tur; ctx.lineWidth = on ? 38 : 44;
      const mx = (sx + ex) / 2 + (on ? 8 : -14), my = (sy + ey) / 2;
      ctx.beginPath(); ctx.moveTo(sx + dx, sy); ctx.quadraticCurveTo(mx + dx, my, ex + dx, ey); ctx.stroke();
      // beyaz çorap + pati
      ctx.strokeStyle = uzak ? K.beyG : K.bey; ctx.lineWidth = on ? 34 : 38;
      ctx.beginPath(); ctx.moveTo(lerp(mx, ex, 0.3) + dx, lerp(my, ey, 0.3)); ctx.lineTo(ex + dx, ey); ctx.stroke();
      ctx.fillStyle = uzak ? K.beyG : K.bey; ctx.beginPath(); ctx.ellipse(ex + dx + 10, ey - 6, 26, 15, 0, 0, TAU); ctx.fill();
      ctx.restore();
    };
    bacak(P.on, fz + Math.PI, true, true); bacak(P.arka, fz, true, false);
    // --- gövde ---
    const govde = elipsYol(P.gx, P.gy + nef * 0.3, P.grx + nef, P.gry + nef * 0.5, P.gr);
    tuyluDoldur(ctx, govde, K.tur, A.tuyDoku);
    // sırt çizgileri
    ctx.save(); ctx.clip(govde); ctx.strokeStyle = K.turK; ctx.lineWidth = 16; ctx.globalAlpha = 0.55; ctx.lineCap = 'round';
    for (let i = -3; i <= 3; i++) { ctx.save(); ctx.translate(P.gx, P.gy); ctx.rotate(P.gr); ctx.beginPath(); ctx.moveTo(i * 40, -P.gry - 10); ctx.quadraticCurveTo(i * 40 + 18, -P.gry * 0.4, i * 40 + 6, -P.gry * 0.1); ctx.stroke(); ctx.restore(); }
    // beyaz göğüs/karın
    ctx.globalAlpha = 1; ctx.fillStyle = K.bey;
    ctx.save(); ctx.translate(P.gx, P.gy); ctx.rotate(P.gr); ctx.beginPath(); ctx.ellipse(P.grx * 0.35, P.gry * 0.62, P.grx * 0.75, P.gry * 0.55, 0, 0, TAU); ctx.fill(); ctx.restore();
    // ışık/gölge
    const lg = ctx.createLinearGradient(0, P.gy - P.gry, 0, P.gy + P.gry); lg.addColorStop(0, 'rgba(255,240,210,0.35)'); lg.addColorStop(0.6, 'rgba(0,0,0,0)'); lg.addColorStop(1, 'rgba(60,30,10,0.35)');
    ctx.fillStyle = lg; ctx.fillRect(-400, -400, 800, 800);
    ctx.restore();
    kenarTuy(ctx, P.gx, P.gy + nef * 0.3, P.grx + nef, P.gry + nef * 0.5, P.gr, K.tur, 70, 16, Math.PI * 1.0, Math.PI * 2.0, 3);
    kenarTuy(ctx, P.gx, P.gy + nef * 0.3, P.grx + nef, P.gry + nef * 0.5, P.gr, K.bey, 40, 14, Math.PI * 0.05, Math.PI * 0.95, 4);
    // kalça
    const kal = elipsYol(P.kalx, P.kaly, P.kalca, P.kalca * 0.92);
    tuyluDoldur(ctx, kal, K.tur, A.tuyDoku);
    kenarTuy(ctx, P.kalx, P.kaly, P.kalca, P.kalca * 0.92, 0, K.tur, 30, 12, Math.PI * 0.9, Math.PI * 2.1, 6);
    // yakın bacaklar
    bacak(P.arka, fz + Math.PI, false, false); bacak(P.on, fz, false, true);
    // --- baş ---
    const bak = clamp(p.bak || 0);
    ctx.save(); ctx.translate(P.bx, P.by + nef * 0.4); ctx.rotate((p.basEgim || 0) + (p.yat ? 0.12 : 0));
    // yanak kabarıklığı (yele)
    tuyluDoldur(ctx, elipsYol(-14, 18, 92, 80), K.tur, A.tuyDoku);
    kenarTuy(ctx, -14, 18, 92, 80, 0, K.tur, 46, 18, Math.PI * 0.2, Math.PI * 1.1, 7);
    kenarTuy(ctx, -14, 18, 92, 80, 0, K.bey, 30, 18, Math.PI * 0.25, Math.PI * 0.8, 8);
    // kulaklar
    const kulak = (bx, uzak) => {
      const geri = (p.kulak || 0) * 0.5;
      ctx.save(); ctx.translate(bx, -54); ctx.rotate(-0.15 + geri + (uzak ? -0.25 : 0.1));
      ctx.fillStyle = uzak ? K.turK : K.tur; ctx.beginPath(); ctx.moveTo(-36, 18); ctx.quadraticCurveTo(-10, -70, 6, -78); ctx.quadraticCurveTo(26, -40, 36, 14); ctx.closePath(); ctx.fill();
      ctx.fillStyle = K.ic; ctx.beginPath(); ctx.moveTo(-20, 12); ctx.quadraticCurveTo(-4, -46, 6, -56); ctx.quadraticCurveTo(18, -26, 22, 10); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = K.bey; ctx.lineWidth = 2; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-6 + i * 4, 8); ctx.lineTo(-10 + i * 5, -26 - i * 3); ctx.stroke(); }
      ctx.restore();
    };
    kulak(lerp(-50, -42, bak), true); kulak(lerp(22, 40, bak), false);
    // kafa
    const kafa = elipsYol(0, 0, 80, 72);
    tuyluDoldur(ctx, kafa, K.tur, A.tuyDoku);
    // beyaz burun-ağız bölgesi (alın çizgisi ile)
    ctx.save(); ctx.clip(kafa);
    ctx.fillStyle = K.bey; ctx.beginPath(); const mzx = lerp(46, 4, bak);
    ctx.moveTo(mzx - 6, -40); ctx.quadraticCurveTo(mzx + 18, -10, mzx + 60, 20); ctx.quadraticCurveTo(mzx + 30, 90, mzx - 40, 80); ctx.quadraticCurveTo(mzx - 50, 20, mzx - 6, -40); ctx.fill();
    ctx.strokeStyle = K.turK; ctx.lineWidth = 7; ctx.globalAlpha = 0.6;
    for (const k of [-1, 0, 1]) { ctx.beginPath(); ctx.moveTo(mzx - 30 + k * 16, -70); ctx.quadraticCurveTo(mzx - 26 + k * 14, -50, mzx - 20 + k * 10, -36); ctx.stroke(); }
    ctx.globalAlpha = 1;
    const kg = ctx.createRadialGradient(-30, -30, 10, 0, 0, 90); kg.addColorStop(0, 'rgba(255,240,215,0.35)'); kg.addColorStop(1, 'rgba(60,25,10,0.3)');
    ctx.fillStyle = kg; ctx.fillRect(-90, -80, 180, 160);
    // kırlaşma (yaş)
    if (yas > 0) { ctx.globalAlpha = yas * 0.45; ctx.fillStyle = '#d8d2cc'; ctx.beginPath(); ctx.ellipse(mzx + 10, 34, 46, 34, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
    ctx.restore();
    kenarTuy(ctx, 0, 0, 80, 72, 0, K.tur, 40, 10, Math.PI * 1.05, Math.PI * 1.95, 9);
    // gözler
    const goz = clamp(p.goz ?? 1) * (1 - yas * 0.12);
    const gozCiz = (gx, gy, olc) => {
      ctx.save(); ctx.translate(gx, gy); ctx.scale(olc, 1);
      if (goz < 0.15) { ctx.strokeStyle = '#4a2a14'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-15, 0); ctx.quadraticCurveTo(0, 7, 15, 0); ctx.stroke(); ctx.restore(); return; }
      const P2 = new Path2D(); P2.moveTo(-17, 0); P2.quadraticCurveTo(0, -17 * goz - 2, 17, -2); P2.quadraticCurveTo(0, 15 * goz + 2, -17, 0);
      ctx.fillStyle = '#2a1508'; ctx.fill(P2);
      ctx.save(); ctx.clip(P2);
      const ig = ctx.createRadialGradient(-2, 2, 2, 0, 0, 18); ig.addColorStop(0, '#d9f0a0'); ig.addColorStop(0.5, '#6fbf5a'); ig.addColorStop(1, '#2f6a32');
      ctx.fillStyle = ig; ctx.beginPath(); ctx.arc(lerp(2, 0, bak) + (p.gozX || 0), 0, 15, 0, TAU); ctx.fill();
      ctx.fillStyle = '#0a0806'; ctx.beginPath(); ctx.ellipse(lerp(2, 0, bak) + (p.gozX || 0), 0, 4 + (p.bebek || 0.4) * 7, 13, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.beginPath(); ctx.arc(-5, -6, 4, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(6, 5, 2, 0, TAU); ctx.fill();
      if (yas > 0) { ctx.fillStyle = `rgba(220,230,235,${yas * 0.18})`; ctx.fillRect(-20, -20, 40, 40); }
      ctx.restore();
      ctx.strokeStyle = '#3a1e0c'; ctx.lineWidth = 3; ctx.stroke(P2);
      ctx.restore();
    };
    gozCiz(lerp(2, -30, bak), -10, lerp(0.75, 1, bak)); gozCiz(lerp(48, 30, bak), -8, 1);
    // burun + ağız
    const nx = lerp(66, 0, bak), ny = 22;
    ctx.fillStyle = '#d98a8a'; ctx.beginPath(); ctx.moveTo(nx - 9, ny - 6); ctx.lineTo(nx + 9, ny - 6); ctx.lineTo(nx, ny + 4); ctx.closePath(); ctx.fill();
    const miy = clamp(p.miyav || 0);
    ctx.strokeStyle = '#7a4a40'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    if (miy > 0.05) {
      ctx.fillStyle = '#6a2a2a'; ctx.beginPath(); ctx.ellipse(nx, ny + 18 + miy * 6, 10 + miy * 4, 4 + miy * 12, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#e48a8a'; ctx.beginPath(); ctx.ellipse(nx, ny + 22 + miy * 10, 7, 4 + miy * 4, 0, 0, TAU); ctx.fill();
    } else { ctx.beginPath(); ctx.moveTo(nx, ny + 4); ctx.lineTo(nx, ny + 12); ctx.moveTo(nx - 12, ny + 16); ctx.quadraticCurveTo(nx - 4, ny + 18, nx, ny + 12); ctx.quadraticCurveTo(nx + 4, ny + 18, nx + 12, ny + 16); ctx.stroke(); }
    // bıyıklar
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.6;
    for (let i = 0; i < 4; i++) for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(nx + k * 14, ny + 10 + i * 4); ctx.quadraticCurveTo(nx + k * 60, ny + i * 8, nx + k * (100 + i * 6), ny + 10 + i * 14 + Math.sin(t + i) * 2); ctx.stroke(); }
    ctx.restore(); // baş
    ctx.restore();
    // yerel → dünya: burun konumu (pati hedefi için kullanılabilir)
    return { bas: [x + P.bx * s * (p.yon || 1), y + P.by * s] };
  }

  // ======================= İNSAN =======================
  const SAC = '#3b2a22', TENI = '#efc7a8', TENG = '#d9a483';
  function yatanYuz(ctx, x, y, s, p) {               // yastıkta, 3/4 kameraya dönük uyuyan yüz
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(-0.35);
    ctx.fillStyle = SAC; ctx.beginPath(); ctx.ellipse(-10, -20, 118, 108, 0, 0, TAU); ctx.fill();
    const g = ctx.createRadialGradient(-20, -10, 10, 10, 10, 120); g.addColorStop(0, '#f6d4b8'); g.addColorStop(1, TENG);
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(16, 18, 86, 100, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = SAC; ctx.beginPath(); ctx.moveTo(-90, 0); ctx.quadraticCurveTo(-40, -110, 60, -86); ctx.quadraticCurveTo(110, -60, 100, -20); ctx.quadraticCurveTo(40, -60, -20, -30); ctx.quadraticCurveTo(-60, -10, -90, 0); ctx.fill();
    const acik = clamp(p.goz || 0), kiz = p.kiz || 0;
    for (const [ex, ey] of [[-12, 10], [56, 14]]) {
      if (acik > 0.2) {
        ctx.fillStyle = '#f6efe8'; ctx.beginPath(); ctx.ellipse(ex, ey, 15, 7 * acik, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#3a2618'; ctx.beginPath(); ctx.arc(ex + (p.bakX || 0) * 5, ey, 6 * Math.min(1, acik + 0.2), 0, TAU); ctx.fill();
        ctx.strokeStyle = '#4a2e22'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(ex - 16, ey - 6 * acik + kiz * 3); ctx.lineTo(ex + 16, ey - 6 * acik - kiz * 2); ctx.stroke();
      } else { ctx.strokeStyle = '#5a3a2c'; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(ex - 15, ey); ctx.quadraticCurveTo(ex, ey + 6, ex + 15, ey); ctx.stroke(); }
      ctx.strokeStyle = '#4a3024'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(ex - 16, ey - 22 + kiz * 6 * (ex < 0 ? -1 : 1) * -1); ctx.quadraticCurveTo(ex, ey - 28 + kiz * 8, ex + 16, ey - 22 - kiz * 4); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(150,90,70,0.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(26, 22); ctx.quadraticCurveTo(34, 46, 24, 54); ctx.stroke();
    ctx.strokeStyle = 'rgba(160,80,70,0.7)'; ctx.beginPath(); ctx.moveTo(6, 78); ctx.quadraticCurveTo(24, 82 - kiz * 4, 42, 76); ctx.stroke();
    ctx.restore();
  }
  function el(ctx, x, y, s, a, parmak = 0) {        // rahat el (yumuşak gölgeli)
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.scale(s, s);
    const g = ctx.createLinearGradient(0, -40, 0, 40); g.addColorStop(0, '#f6d4b8'); g.addColorStop(1, TENG);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(0, 0, 58, 40, 0, 0, TAU); ctx.fill();
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(58 + Math.sin(parmak + i) * 4, -26 + i * 17, 34 - Math.abs(i - 1.5) * 4, 9, 0.05 * i, 0, TAU); ctx.fill(); }
    ctx.beginPath(); ctx.ellipse(20, 40, 30, 11, 0.7, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(150,90,70,0.35)'; ctx.lineWidth = 2; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(44, -18 + i * 17); ctx.lineTo(70, -18 + i * 17); ctx.stroke(); }
    ctx.restore();
  }

  // ======================= YATAK ODASI =======================
  function isikSeviye(saat) { return saat; }
  /* yatakOdasi(ctx, t, o): o.isik (0 gece..1 sabah), o.renk ('sabah'|'gundogumu'), o.yorgan (0 omuz, 1 baş örtülü), o.yuz {...},
   *   o.el {x,y,a,parmak}, o.minder (kedi minderi boş mu: 'bos'|'yok'), o.dis (pencere dışı mevsim fonksiyonu) */
  function yatakOdasi(ctx, t, o = {}) {
    const isik = o.isik ?? 1, gun = o.renk === 'gundogumu';
    // duvar
    const dg = ctx.createLinearGradient(0, 0, 0, H);
    dg.addColorStop(0, gun ? '#e9c9b4' : '#efdcc6'); dg.addColorStop(1, gun ? '#b59a95' : '#cdb79f');
    ctx.fillStyle = dg; ctx.fillRect(0, 0, W, H);
    if (isik < 1) { ctx.fillStyle = `rgba(20,24,48,${(1 - isik) * 0.75})`; ctx.fillRect(0, 0, W, H); }
    // pencere (sağ üst) + dışarısı
    const px = 640, py = 180, pw = 360, ph = 520;
    ctx.save(); ctx.beginPath(); ctx.rect(px, py, pw, ph); ctx.clip();
    const sg = ctx.createLinearGradient(0, py, 0, py + ph);
    if (gun) { sg.addColorStop(0, '#f7c9a4'); sg.addColorStop(1, '#f6e2b8'); } else { sg.addColorStop(0, '#cfe3ef'); sg.addColorStop(1, '#f8ead0'); }
    ctx.fillStyle = sg; ctx.fillRect(px, py, pw, ph);
    if (isik < 1) { ctx.fillStyle = `rgba(16,22,52,${(1 - isik) * 0.9})`; ctx.fillRect(px, py, pw, ph); }
    if (o.dis) o.dis(ctx, px, py, pw, ph);
    ctx.fillStyle = 'rgba(120,140,110,0.6)'; ctx.beginPath(); ctx.ellipse(px + 120, py + ph, 200, 120, 0, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#f4ece0'; for (const r of [[px - 14, py - 14, pw + 28, 18], [px - 14, py + ph - 4, pw + 28, 22], [px - 14, py - 14, 18, ph + 28], [px + pw - 4, py - 14, 18, ph + 28], [px + pw / 2 - 7, py, 14, ph]]) ctx.fillRect(...r);
    // perde
    const sal = Math.sin(t * 0.7) * 10;
    ctx.fillStyle = 'rgba(244,232,214,0.92)';
    ctx.beginPath(); ctx.moveTo(px - 70, py - 40); ctx.lineTo(px + 40, py - 40); ctx.quadraticCurveTo(px + 30 + sal, py + 300, px + 10 + sal, py + ph + 60); ctx.lineTo(px - 80, py + ph + 60); ctx.fill();
    // ışık huzmeleri
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.45 * isik;
    const hg = ctx.createLinearGradient(px, py, 200, 1500); hg.addColorStop(0, `rgba(${gun ? '255,190,140' : SICAK},0.8)`); hg.addColorStop(1, `rgba(${SICAK},0)`);
    ctx.fillStyle = hg; ctx.beginPath(); ctx.moveTo(px + 20, py); ctx.lineTo(px + pw, py); ctx.lineTo(500, 1700); ctx.lineTo(-200, 1500); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#5a3a28'; ctx.fillRect(-300, 1690, 1700, 900);                 // zemin (kamera yaklaşınca boşluk kalmasın)
    // başlık + komodin
    ctx.fillStyle = '#7a5038'; ctx.beginPath(); ctx.roundRect(-40, 860, 620, 360, 30); ctx.fill();
    ctx.fillStyle = 'rgba(255,220,180,0.15)'; ctx.fillRect(-40, 860, 620, 10);
    // komodin (sol, önde) — saat + çerçeveli fotoğraf
    ctx.fillStyle = '#8a5c40'; ctx.fillRect(-20, 1180, 210, 500);
    ctx.fillStyle = '#9c6a4a'; ctx.fillRect(-30, 1166, 230, 26);
    fotoCerceve(ctx, 100, 1040, 0.42, t);
    saatCiz(ctx, 30, 1130, o.saat || '07:00');
    // yatak gövdesi
    ctx.fillStyle = '#6e4630'; ctx.fillRect(160, 1560, 1000, 400);
    // yastık
    const yg = ctx.createRadialGradient(330, 1080, 30, 360, 1120, 300); yg.addColorStop(0, '#fbf7f1'); yg.addColorStop(1, '#d8cfc4');
    ctx.fillStyle = yg; ctx.beginPath(); ctx.ellipse(380, 1120, 250, 110, -0.05, 0, TAU); ctx.fill();
    // yüz
    const yz = o.yuz || {};
    const orter = clamp(o.yorgan || 0);
    if (orter < 0.98) yatanYuz(ctx, 360, 1080, 1.0, yz);
    // yorgan
    const yorg = ctx.createLinearGradient(0, 1100, 0, 1700); yorg.addColorStop(0, '#f6efe6'); yorg.addColorStop(1, '#cdbfae');
    ctx.fillStyle = yorg;
    const ust = x => 1200 - 60 * Math.exp(-(((x - 700) / 220) ** 2)) - 30 * Math.exp(-(((x - 950) / 160) ** 2)) + Math.sin(t * 1.1 + x * 0.01) * 3 * (o.nefes ?? 1);
    const kenarX = lerp(220, 120, orter), basUstY = lerp(1200, 1000, orter);
    ctx.beginPath(); ctx.moveTo(kenarX, 1700);
    ctx.lineTo(kenarX, lerp(1215, basUstY + 60, orter));
    ctx.quadraticCurveTo(lerp(330, 360, orter), lerp(1180, basUstY - 30 - (o.yorganKalk || 0) * 40, orter), lerp(470, 520, orter), lerp(1190, 1060 - (o.yorganKalk || 0) * 30, orter));
    for (let x = 520; x <= 1180; x += 30) ctx.lineTo(x, ust(x));
    ctx.lineTo(1180, 1700); ctx.closePath(); ctx.fill();
    // yorgan kıvrımları
    ctx.strokeStyle = 'rgba(150,130,110,0.35)'; ctx.lineWidth = 6;
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(420 + i * 150, ust(420 + i * 150) + 40); ctx.quadraticCurveTo(470 + i * 150, 1420, 400 + i * 160, 1680); ctx.stroke(); }
    // el (yorganın üstünde)
    if (o.el) el(ctx, o.el.x, o.el.y, o.el.s || 0.9, o.el.a || 0.2, o.el.parmak || 0);
    // boş kedi minderi
    if (o.minder) {
      const mg = ctx.createRadialGradient(860, 1230, 10, 860, 1240, 150); mg.addColorStop(0, '#c9b6a2'); mg.addColorStop(1, '#a88f7a');
      ctx.fillStyle = mg; ctx.beginPath(); ctx.ellipse(860, 1240, 150, 55, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(80,55,40,0.25)'; ctx.beginPath(); ctx.ellipse(860, 1236, 92, 28, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(232,142,62,0.8)'; ctx.lineWidth = 1.5;
      for (const [a, b] of [[830, 1232], [878, 1240], [852, 1246]]) { ctx.beginPath(); ctx.moveTo(a, b); ctx.quadraticCurveTo(a + 8, b - 4, a + 16, b + 1); ctx.stroke(); }
    }
    return { ust };
  }
  function saatCiz(ctx, x, y, saat) {
    ctx.fillStyle = '#e9e2d8'; ctx.beginPath(); ctx.roundRect(x, y, 120, 46, 12); ctx.fill();
    yazi(ctx, saat, x + 60, y + 24, { boyut: 30, agirlik: 700, renk: '#5a4a40', golge: false });
  }
  // fotoğraf içeriği (sahibi + kedi, sıcak an) — final ve çerçevede aynı çizim
  function fotoIcerik(ctx, w, h, t) {
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#f6c98e'); g.addColorStop(1, '#e09a6a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.save(); ctx.globalCompositeOperation = 'screen'; const sg = ctx.createRadialGradient(w * 0.85, h * 0.15, 10, w * 0.85, h * 0.15, w); sg.addColorStop(0, 'rgba(255,240,200,0.9)'); sg.addColorStop(1, 'rgba(255,240,200,0)'); ctx.fillStyle = sg; ctx.fillRect(0, 0, w, h); ctx.restore();
    // sahibi (yan profil, gülümseyen, gözler kapalı) — omuz + baş
    ctx.save(); ctx.translate(w * 0.36, h * 0.52); const k = w / 1000;
    ctx.scale(k, k);
    ctx.fillStyle = '#6f8fa8'; ctx.beginPath(); ctx.ellipse(-60, 520, 420, 330, 0, 0, TAU); ctx.fill();          // kazak
    ctx.fillStyle = TENG; ctx.fillRect(-90, 150, 120, 200);
    const yg = ctx.createRadialGradient(-40, -20, 20, 0, 20, 230); yg.addColorStop(0, '#f8d8bc'); yg.addColorStop(1, TENG);
    ctx.fillStyle = yg; ctx.beginPath(); ctx.ellipse(10, 20, 170, 205, 0.12, 0, TAU); ctx.fill();
    ctx.fillStyle = SAC; ctx.beginPath(); ctx.moveTo(-170, 60); ctx.quadraticCurveTo(-200, -190, 30, -200); ctx.quadraticCurveTo(200, -190, 190, -40); ctx.quadraticCurveTo(110, -120, 0, -110); ctx.quadraticCurveTo(-110, -100, -130, 80); ctx.fill();
    ctx.strokeStyle = '#5a3a2c'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    for (const ex of [-40, 70]) { ctx.beginPath(); ctx.moveTo(ex - 28, 10); ctx.quadraticCurveTo(ex, 26, ex + 28, 8); ctx.stroke(); }
    ctx.strokeStyle = '#a5504a'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(-10, 120); ctx.quadraticCurveTo(30, 150, 80, 112); ctx.stroke();
    ctx.fillStyle = 'rgba(230,130,110,0.3)'; ctx.beginPath(); ctx.ellipse(110, 80, 40, 24, 0, 0, TAU); ctx.fill();
    ctx.restore();
    // kedi: sahibinin omzunda/yanağında, önden (gözleri mutlu kısık)
    kediOn(ctx, w * 0.66, h * 0.5, w / 1000 * 1.25, t);
    // el kediyi sarıyor
    el(ctx, w * 0.6, h * 0.78, w / 1000 * 1.6, -0.5, 0.4);
  }
  function kediOn(ctx, x, y, s, t) {
    const K = renkler(0);
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    tuyluDoldur(ctx, elipsYol(0, 230, 190, 200), K.tur, A.tuyDoku);
    ctx.fillStyle = K.bey; ctx.beginPath(); ctx.ellipse(0, 260, 110, 170, 0, 0, TAU); ctx.fill();
    kenarTuy(ctx, 0, 230, 190, 200, 0, K.tur, 60, 18, Math.PI, TAU, 31);
    for (const k of [-1, 1]) {
      ctx.save(); ctx.translate(k * 82, -96); ctx.rotate(k * 0.35);
      ctx.fillStyle = K.tur; ctx.beginPath(); ctx.moveTo(-50, 40); ctx.quadraticCurveTo(-10, -90, 0, -100); ctx.quadraticCurveTo(20, -60, 50, 40); ctx.fill();
      ctx.fillStyle = K.ic; ctx.beginPath(); ctx.moveTo(-28, 30); ctx.quadraticCurveTo(-6, -60, 0, -70); ctx.quadraticCurveTo(14, -40, 28, 30); ctx.fill(); ctx.restore();
    }
    tuyluDoldur(ctx, elipsYol(0, 0, 150, 135), K.tur, A.tuyDoku);
    kenarTuy(ctx, 0, 10, 150, 128, 0, K.tur, 70, 16, Math.PI * 0.15, Math.PI * 0.85, 32);
    ctx.save(); ctx.clip(elipsYol(0, 0, 150, 135));
    ctx.fillStyle = K.bey; ctx.beginPath(); ctx.moveTo(-20, -60); ctx.quadraticCurveTo(0, -80, 20, -60); ctx.quadraticCurveTo(110, 40, 80, 140); ctx.lineTo(-80, 140); ctx.quadraticCurveTo(-110, 40, -20, -60); ctx.fill();
    ctx.strokeStyle = K.turK; ctx.lineWidth = 9; ctx.globalAlpha = 0.6; for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(k * 40, -130); ctx.quadraticCurveTo(k * 34, -100, k * 30, -76); ctx.stroke(); }
    ctx.restore();
    for (const k of [-1, 1]) { ctx.strokeStyle = '#4a2a14'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(k * 60 - 26, -12); ctx.quadraticCurveTo(k * 60, 4, k * 60 + 26, -12); ctx.stroke(); }
    ctx.fillStyle = '#d98a8a'; ctx.beginPath(); ctx.moveTo(-14, 30); ctx.lineTo(14, 30); ctx.lineTo(0, 46); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#7a4a40'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, 46); ctx.lineTo(0, 58); ctx.moveTo(-18, 64); ctx.quadraticCurveTo(-6, 68, 0, 58); ctx.quadraticCurveTo(6, 68, 18, 64); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(k * 22, 52 + i * 5); ctx.quadraticCurveTo(k * 90, 40 + i * 10, k * (170 + i * 8), 60 + i * 18); ctx.stroke(); }
    ctx.restore();
  }
  function fotoCerceve(ctx, x, y, s, t) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = 'rgba(40,20,10,0.3)'; ctx.fillRect(-150, -170, 320, 380);
    ctx.fillStyle = '#c8a070'; ctx.fillRect(-170, -200, 340, 400);
    ctx.fillStyle = '#fbf6ee'; ctx.fillRect(-148, -178, 296, 356);
    ctx.save(); ctx.translate(-128, -158); ctx.beginPath(); ctx.rect(0, 0, 256, 316); ctx.clip(); fotoIcerik(ctx, 256, 316, t); ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.moveTo(-148, -178); ctx.lineTo(40, -178); ctx.lineTo(-148, 60); ctx.fill();
    ctx.restore();
  }
  function tozlar(ctx, t, n, alfa = 0.5) {
    const r = rng(17);
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < n; i++) {
      const x = (r() * 1100 + Math.sin(t * 0.3 + i) * 30 + t * 6) % 1100, y = (r() * 1400 + 200 + Math.cos(t * 0.25 + i * 2) * 40 - t * 8 * r()) % 1700;
      ctx.fillStyle = `rgba(255,236,200,${alfa * (0.3 + 0.7 * Math.sin(t * 0.8 + i) ** 2)})`; ctx.beginPath(); ctx.arc(x, y, 1.5 + r() * 3, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  function kamera(ctx, cx, cy, z) { ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-cx, -cy); }
  function sonIslem(ctx, sicaklik = 1) {
    ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = 0.25 * sicaklik; ctx.fillStyle = '#ffb070'; ctx.fillRect(0, 0, W, H); ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.12; ctx.drawImage(A.kagit, 0, 0, W, H); ctx.restore();
  }

  // ======================= SAHNE 1: HER SABAH =======================
  VIDEO.sahne('sabah', {
    ciz(ctx, S) {
      const t = S.t;
      const gir = ramp(t, 0.6, S.at(1, 0.1), x => x);                     // kedi yatağın üstünde yürür
      const otur = ramp(t, S.at(1, 0.0), S.at(1, 0.4));
      const pt = S.ci(2, 0.25, 0.95), dokun = Math.sin(clamp(pt) * Math.PI * 2) ** 2 * (pt > 0 && pt < 1 ? 1 : 0);
      const miy = pencere(t, S.at(3, 0.05), S.at(3, 0.95), 0.12);
      const z = lerp(1.0, 1.45, ease.inOut(ramp(t, S.at(0, 0.6), S.at(2, 0.2))));
      ctx.save(); kamera(ctx, lerp(540, 470, ramp(t, S.at(0, 0.6), S.at(2, 0.2))), lerp(1000, 1060, ramp(t, S.at(0, 0.6), S.at(2, 0.2))), z);
      const o = yatakOdasi(ctx, S.gt, { yuz: { goz: 0 }, el: { x: 560, y: 1330, a: 0.15, parmak: 0 } });
      const kx = lerp(1150, 610, ease.out(gir));
      kedi(ctx, kx, o.ust(kx) + 10, 0.62, { t: S.gt, yon: -1, yuru: S.gt * 7, adim: gir < 1 ? 1 - otur : 0, otur, bak: 0.15 + 0.2 * otur, goz: 1 - pencere(t % 3.3, 2.9, 3.15, 0.08),
        pati: dokun, patiHedef: [330, -170], miyav: miy, basEgim: -0.08 * otur + dokun * 0.05, kuyrukSal: 0.4 });
      ctx.restore();
      tozlar(ctx, S.gt, 40, 0.6);
      sonIslem(ctx);
    },
  });

  // ======================= SAHNE 2: KÜÇÜK RUTİNİMİZ =======================
  VIDEO.sahne('rutin', {
    ciz(ctx, S) {
      const t = S.t;
      const ort = ramp(t, S.at(1, 0.0), S.at(1, 0.6)) * (1 - ramp(t, S.at(2, 0.0), S.at(2, 0.25)) * 0.35) ;
      const peek = pencere(t, S.at(2, 0.05), S.at(2, 1.0) + 0.2, 0.25);
      const surt = ramp(t, S.at(3, 0.0), S.at(3, 0.35));
      ctx.save(); kamera(ctx, 520, 1080, 1.35 + 0.04 * Math.sin(t * 0.3));
      const o = yatakOdasi(ctx, S.gt, { yorgan: Math.max(ort, peek > 0 ? 0.65 : 0), yorganKalk: peek, yuz: { goz: peek > 0.4 ? 0.55 : 0, kiz: peek, bakX: 1 },
        el: { x: lerp(560, 600, surt), y: 1330 - surt * 10, a: 0.15 - surt * 0.1, parmak: S.gt * 3 * surt } });
      const kx = lerp(700, 650, surt);
      kedi(ctx, kx, o.ust(kx) + 10, 0.62, { t: S.gt, yon: -1, otur: 1 - surt * 0.5, bak: lerp(0.2, 0.6, peek), goz: surt > 0.5 ? 0.05 : 1 - pencere(t % 2.7, 2.3, 2.6, 0.08),
        basEgim: surt * 0.35 + Math.sin(S.gt * 3) * 0.04 * surt, kulak: peek * 0.6, kuyrukSal: 0.5 });
      ctx.restore();
      tozlar(ctx, S.gt, 30, 0.5);
      sonIslem(ctx);
    },
  });

  // ======================= SAHNE 3: KÜÇÜK ANLAR (MUTFAK + KAPI) =======================
  function bacakInsan(ctx, x, y, s, faz, adim) {     // pijama + terlik (alçak açı)
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    for (const k of [-1, 1]) {
      const f = Math.sin(faz + (k > 0 ? Math.PI : 0)) * adim;
      ctx.save(); ctx.translate(k * 70 + f * 60, 0);
      const g = ctx.createLinearGradient(-60, 0, 60, 0); g.addColorStop(0, '#7f93a8'); g.addColorStop(1, '#5d6f84');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-58, -900); ctx.lineTo(58, -900); ctx.lineTo(56, -60); ctx.lineTo(-56, -60); ctx.fill();
      ctx.fillStyle = TENG; ctx.fillRect(-36, -70, 72, 40);
      ctx.fillStyle = '#d9c2a8'; ctx.beginPath(); ctx.ellipse(18, -18, 90, 34, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
  function mutfak(ctx, t) {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#f1e1c8'); g.addColorStop(1, '#d8c2a2'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.5; const hg = ctx.createLinearGradient(1000, 0, 300, 1500); hg.addColorStop(0, `rgba(${SICAK},0.9)`); hg.addColorStop(1, `rgba(${SICAK},0)`);
    ctx.fillStyle = hg; ctx.beginPath(); ctx.moveTo(800, 0); ctx.lineTo(1100, 0); ctx.lineTo(700, 1600); ctx.lineTo(200, 1600); ctx.fill(); ctx.restore();
    ctx.fillStyle = '#a77d5a'; ctx.fillRect(-20, 520, 1120, 700);                     // tezgâh dolabı
    ctx.fillStyle = '#e9e1d6'; ctx.fillRect(-20, 480, 1120, 50);                        // tezgâh üstü
    ctx.strokeStyle = 'rgba(70,40,20,0.35)'; ctx.lineWidth = 4; for (const x of [260, 540, 820]) { ctx.beginPath(); ctx.moveTo(x, 560); ctx.lineTo(x, 1180); ctx.stroke(); }
    ctx.fillStyle = '#c9b49a'; ctx.fillRect(-20, 1200, 1120, 720);                     // zemin
    ctx.strokeStyle = 'rgba(120,90,60,0.2)'; for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.moveTo(-20, 1230 + i * 90); ctx.lineTo(1100, 1230 + i * 90); ctx.stroke(); }
  }
  VIDEO.sahne('kahve', {
    ciz(ctx, S) {
      const t = S.t;
      const kapiBas = S.at(1, -0.1), kapiSahne = t > kapiBas;
      if (!kapiSahne) {
        mutfak(ctx, S.gt);
        // tezgâhta eller + kahve
        ctx.strokeStyle = '#6f8fa8'; ctx.lineWidth = 70; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(330, -80); ctx.quadraticCurveTo(360, 300, 420 + Math.sin(S.gt * 2) * 6, 460); ctx.stroke();
        el(ctx, 450 + Math.sin(S.gt * 2) * 6, 470, 0.9, -0.2, S.gt);
        ctx.fillStyle = '#efe8de'; ctx.beginPath(); ctx.roundRect(560, 400, 90, 90, 16); ctx.fill(); ctx.fillStyle = '#5a3a28'; ctx.fillRect(572, 412, 66, 18);
        ctx.save(); ctx.globalAlpha = 0.45; ctx.strokeStyle = '#fff'; ctx.lineWidth = 8; ctx.lineCap = 'round';
        for (let k = 0; k < 3; k++) { ctx.beginPath(); for (let i = 0; i <= 10; i++) { const u = i / 10; const x = 590 + k * 20 + Math.sin(u * 6 + S.gt * 2 + k) * 14, y = 390 - u * 200; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); }
        ctx.restore();
        bacakInsan(ctx, 520, 1500, 1.0, 0, 0);
        // kedi ayakların arasında 8 çizer
        const u = (t * 0.32) % 1, a = u * TAU;
        const kx = 520 + Math.sin(a) * 260, ky = 1560 + Math.sin(2 * a) * 50, yon = Math.cos(a) > 0 ? 1 : -1, arkada = Math.sin(2 * a) < 0;
        const sev = ramp(t, S.at(0, 0.75), S.at(0, 0.95));
        const kd = () => kedi(ctx, sev > 0 ? lerp(kx, 600, sev) : kx, ky, 0.75, { t: S.gt, yon: sev > 0.5 ? -1 : yon, yuru: S.gt * 8, adim: 1 - sev, otur: sev, bak: 0.3 * sev, goz: sev > 0.6 ? 0.1 : 1, basEgim: sev * 0.3, kuyrukSal: 0.6 });
        if (arkada && sev < 0.5) { kd(); bacakInsan(ctx, 520, 1500, 1.0, 0, 0); } else kd();
        // eğilip okşayan el
        if (sev > 0) el(ctx, lerp(700, 540, sev), lerp(600, 1290, ease.out(sev)), 1.0, 1.3, S.gt * 4);
        sonIslem(ctx);
        return;
      }
      // kapı: sahibi çıkar, kapı kapanır, kedi bakakalır
      const u = t - kapiBas;
      const yuru = clamp(u / 2.2), kapan = ramp(t, S.at(2, 0.0), S.at(2, 0.7));
      ctx.fillStyle = '#e8d6bc'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#c9b49a'; ctx.fillRect(0, 1450, W, 470);
      // kapı boşluğu (dışarısı aydınlık)
      const kx = 560, ky = 380, kw = 380, kh = 1070;
      const acik = 1 - kapan;
      ctx.fillStyle = '#fff3dc'; ctx.fillRect(kx, ky, kw * acik, kh);
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.6 * acik; const ig = ctx.createLinearGradient(kx, 0, kx - 300, 0); ig.addColorStop(0, `rgba(${SICAK},0.9)`); ig.addColorStop(1, `rgba(${SICAK},0)`);
      ctx.fillStyle = ig; ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(kx + kw * acik, ky); ctx.lineTo(kx + kw * acik - 200, 1920); ctx.lineTo(kx - 500, 1920); ctx.fill(); ctx.restore();
      // giden siluet
      if (yuru < 1 && kapan < 0.4) {
        ctx.save(); ctx.globalAlpha = 1 - kapan * 2; ctx.beginPath(); ctx.rect(kx, ky, kw * acik, kh); ctx.clip();
        bacakInsan(ctx, lerp(760, 1000, yuru), 1450, 0.55, S.gt * 6, 0.8 * (1 - yuru));
        ctx.fillStyle = '#3a3a48'; ctx.beginPath(); ctx.ellipse(lerp(760, 1000, yuru), 820, 110, 250, 0, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(lerp(760, 1000, yuru), 520, 70, 0, TAU); ctx.fill();
        ctx.restore();
      }
      // kapı kanadı
      ctx.fillStyle = '#9a7454'; ctx.fillRect(kx + kw * acik, ky, kw * (1 - acik) + 4, kh);
      ctx.fillStyle = '#7a5a40'; ctx.fillRect(kx - 20, ky - 20, 20, kh + 20); ctx.fillRect(kx + kw, ky - 20, 20, kh + 20); ctx.fillRect(kx - 20, ky - 20, kw + 40, 20);
      if (kapan > 0.95) { ctx.fillStyle = '#d8b878'; ctx.beginPath(); ctx.arc(kx + 40, ky + 560, 14, 0, TAU); ctx.fill(); }
      // kedi: kapıya bakan oturan siluet
      kedi(ctx, 300, 1560, 0.8, { t: S.gt, yon: 1, otur: 1, bak: 0, goz: 1 - pencere(u % 3.1, 2.8, 3.0, 0.08), kulak: kapan * 0.5, kuyrukSal: 0.2 * (1 - kapan), basEgim: -0.05 * kapan });
      const kar = ramp(t, S.at(2, 0.4), S.d);
      if (kar > 0) { ctx.fillStyle = `rgba(30,24,30,${kar * 0.35})`; ctx.fillRect(0, 0, W, H); }
      sonIslem(ctx, 1 - kapan * 0.5);
    },
  });

  // ======================= SAHNE 4: ZAMAN GEÇİYOR =======================
  VIDEO.sahne('zaman', {
    ciz(ctx, S) {
      const t = S.t;
      const lapse = ramp(t, 0, S.at(1, 0.0), x => x);                      // hızlı gün-gece döngüsü
      const gunFaz = lapse * 4;
      const isik = lapse < 1 ? 0.55 + 0.45 * Math.cos(gunFaz * TAU) : 1;
      const mevsim = lapse;
      const dis = (c, px, py, pw, ph) => {
        const r = rng(4);
        if (lapse < 1) for (let i = 0; i < 26; i++) {
          const x = px + ((r() * pw + t * 80) % pw), y = py + ((r() * ph + t * 260 * (0.6 + r())) % ph);
          c.fillStyle = mevsim < 0.4 ? 'rgba(200,110,50,0.9)' : mevsim < 0.7 ? 'rgba(255,255,255,0.9)' : 'rgba(250,190,200,0.9)';
          c.beginPath(); c.ellipse(x, y, mevsim < 0.4 ? 9 : 5, 5, r() * 3, 0, TAU); c.fill();
        }
        c.fillStyle = `rgba(255,240,200,${clamp(Math.cos(gunFaz * TAU)) * (lapse < 1 ? 1 : 0)})`; c.beginPath(); c.arc(px + pw * ((gunFaz % 1)), py + 100 + Math.sin((gunFaz % 1) * Math.PI) * -60 + 60, 30, 0, TAU); c.fill();
      };
      const yuru = ramp(t, S.at(1, 0.0), S.at(2, 0.4), x => x);
      const tirman = ramp(t, S.at(2, 0.35), S.at(2, 0.95));
      const yat = ramp(t, S.at(3, 0.0), S.at(3, 0.45));
      ctx.save(); kamera(ctx, 560, lerp(1150, 1100, tirman), lerp(1.1, 1.3, ramp(t, S.at(2, 0.3), S.d)));
      const o = yatakOdasi(ctx, S.gt, { isik, dis, yuz: { goz: 0 }, el: { x: lerp(560, 700, yat), y: lerp(1330, 1215, yat), a: lerp(0.15, -0.1, yat), parmak: S.gt * 0.8 * yat } });
      // yaşlı kedi: yerden yatağa yavaş gelir
      const zeminX = lerp(1250, 980, ease.inOut(yuru));
      let kx = zeminX, ky = 1760, ot = 0, yt = 0;
      if (tirman > 0) { kx = lerp(980, 820, tirman); ky = lerp(1760, o.ust(820) + 10, ease.inOut(tirman)) - Math.sin(Math.PI * tirman) * 80; }
      if (yat > 0) { kx = lerp(820, 760, yat); ky = o.ust(760) + 10; yt = yat; }
      const yasli = ramp(t, S.at(0, 0.3), S.at(1, 0.0));
      if (lapse < 1 && yuru === 0) {
        // zaman akarken pencere önünde oturan kedi, yaşlanıyor
        kedi(ctx, 900, o.ust(900) + 10, 0.6, { t: S.gt, yon: -1, otur: 1, yas: yasli, bak: 0.3, goz: 0.8, kuyrukSal: 0.2 });
      } else {
        kedi(ctx, kx, ky, 0.6, { t: S.gt * 0.7, yon: -1, yuru: S.gt * 3.2, adim: (yuru > 0 && yuru < 1) || (tirman > 0 && tirman < 1) ? 0.6 : 0, yat: yt, yas: 1,
          goz: yt > 0.6 ? 0.08 : 0.85, bak: 0.2, basEgim: yt * 0.1, kuyrukSal: 0.15 });
      }
      ctx.restore();
      tozlar(ctx, S.gt, 30, 0.45);
      sonIslem(ctx);
    },
  });

  // ======================= SAHNE 5: SESSİZ SABAH + FİNAL =======================
  VIDEO.sahne('sessiz', {
    ciz(ctx, S) {
      const t = S.t;
      const uyan = ramp(t, S.at(0, 0.3), S.at(0, 0.8));
      const uzan = pencere(t, S.at(1, 0.0), S.at(2, 0.4), 0.6);
      const fotoyaGit = ramp(t, S.at(3, 0.0), S.at(4, 0.9));
      const finalA = ramp(t, S.konusma.end + 0.2, S.konusma.end + 1.4);
      if (finalA < 1) {
        ctx.save();
        // kamera: yatak → komodindeki fotoğraf
        const cx = lerp(560, 100, ease.inOut(fotoyaGit)), cy = lerp(1120, 1040, ease.inOut(fotoyaGit)), z = lerp(1.1, 4.2, ease.in(fotoyaGit));
        kamera(ctx, cx, cy, z);
        yatakOdasi(ctx, S.gt, { renk: 'gundogumu', minder: true, saat: '06:41', nefes: 0.6, yuz: { goz: uyan * 0.75, bakX: 1 },
          el: { x: lerp(560, 780, uzan), y: lerp(1330, 1250, uzan), a: lerp(0.15, -0.05, uzan), parmak: 0 } });
        ctx.restore();
        tozlar(ctx, S.gt, 36, 0.5);
        sonIslem(ctx, 0.8);
      }
      if (finalA > 0) {
        ctx.save(); ctx.globalAlpha = finalA;
        ctx.fillStyle = '#1a120c'; ctx.fillRect(0, 0, W, H);
        const fz = lerp(1.0, 1.12, ease.inOut(clamp((t - S.konusma.end) / 7)));
        ctx.save(); ctx.translate(540, 900); ctx.scale(fz, fz); ctx.translate(-540, -900);
        ctx.fillStyle = '#fbf6ee'; ctx.fillRect(40, 120, 1000, 1560);
        ctx.save(); ctx.translate(80, 160); ctx.beginPath(); ctx.rect(0, 0, 920, 1380); ctx.clip(); fotoIcerik(ctx, 920, 1380, S.gt); ctx.restore();
        ctx.restore();
        // yumuşak vinyet ve yazı
        const vg = ctx.createLinearGradient(0, 1250, 0, H); vg.addColorStop(0, 'rgba(20,12,8,0)'); vg.addColorStop(1, 'rgba(20,12,8,0.75)');
        ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
        const ya = ramp(t, S.konusma.end + 1.4, S.konusma.end + 2.6);
        if (ya > 0) {
          ctx.globalAlpha = finalA * ya;
          yazi(ctx, 'Bazı seslerin kıymetini,', W / 2, 1600 - (1 - ya) * 12, { boyut: 62, agirlik: 600, renk: '#fff8ee', golgeRenk: 'rgba(0,0,0,0.6)', golgeBulanik: 24 });
          yazi(ctx, 'sustuklarında anlarız.', W / 2, 1690 - (1 - ya) * 12, { boyut: 62, agirlik: 600, renk: '#fff8ee', golgeRenk: 'rgba(0,0,0,0.6)', golgeBulanik: 24 });
        }
        ctx.restore();
        const son = ramp(t, S.d - 1.6, S.d);
        if (son > 0) { ctx.fillStyle = `rgba(0,0,0,${son})`; ctx.fillRect(0, 0, W, H); }
      }
    },
  });

  VIDEO.sahne('_ortak', {
    hazirla() {
      A.kagit = gurultuDokusu(270, 480, 5, 21, f => [255 - f * 30, 250 - f * 40, 240 - f * 50, 255], 3);
      // tüy dokusu: kısa kıvrık çizgiler (açık/koyu)
      const c = tuval(800, 800), x = c.getContext('2d'), r = rng(3);
      x.fillStyle = 'rgb(128,128,128)'; x.fillRect(0, 0, 800, 800);
      for (let i = 0; i < 9000; i++) {
        const px = r() * 800, py = r() * 800, a = 1.2 + (r() - 0.5) * 0.8, L = 6 + r() * 12;
        x.strokeStyle = r() < 0.5 ? `rgba(255,255,255,${0.15 + r() * 0.3})` : `rgba(0,0,0,${0.12 + r() * 0.25})`; x.lineWidth = 1 + r() * 1.5;
        x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + Math.cos(a) * L * 0.5 + 2, py + Math.sin(a) * L * 0.5, px + Math.cos(a) * L, py + Math.sin(a) * L); x.stroke();
      }
      A.tuyDoku = c;
    },
    ciz() { },
  });
})();
