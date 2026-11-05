/* İnsan Atlası ana karakteri (STUDIO.KR) — tüm bölümlerde aynı profil, saç ve beden.
 * Birim koordinat: baş yüksekliği ~105 birim, sağa bakar.
 */
(function () {
  const { clamp, lerp } = STUDIO.R;
  const TAU = Math.PI * 2;
  const BAS = new Path2D('M -38 -10 C -40 -45 -10 -62 18 -55 C 34 -50 40 -38 40 -24 C 41 -18 39 -14 42 -11 C 46 -4 50 4 52 10 C 53 13 50 15 45 15 C 46 18 46 21 44 22 C 45 25 44 28 41 29 C 42 34 40 40 33 43 C 25 46 12 44 4 38 L 7 62 L -17 62 C -19 40 -34 24 -38 -10 Z');
  const SAC = new Path2D('M -40 -6 C -49 -54 -4 -75 27 -59 C 39 -53 42 -43 39 -36 C 25 -46 -4 -43 -20 -25 C -28 -15 -34 -3 -40 -6 Z');
  const GOZ = [31, -8];
  const YAS_YOLU = [[31.5, -6.5], [30.6, 0], [30.4, 7], [29.6, 15], [28.2, 23], [26, 31], [23.5, 38], [21, 44]];

  function yolNokta(pts, u) {
    if (!pts._L) { pts._L = [0]; for (let i = 1; i < pts.length; i++) pts._L.push(pts._L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); }
    const L = pts._L, h = clamp(u) * L[L.length - 1];
    for (let i = 1; i < pts.length; i++) if (h <= L[i]) { const k = (h - L[i - 1]) / Math.max(1e-6, L[i] - L[i - 1]); return [lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k)]; }
    return pts[pts.length - 1];
  }

  function damla(ctx, x, y, r, alfa = 1, sicak = false) {
    if (alfa <= 0) return;
    ctx.save(); ctx.globalAlpha *= alfa; ctx.translate(x, y);
    ctx.beginPath(); ctx.moveTo(0, -r * 1.9);
    ctx.bezierCurveTo(r * 0.5, -r * 1.1, r, -r * 0.3, r, r * 0.2);
    ctx.arc(0, r * 0.2, r, 0, Math.PI);
    ctx.bezierCurveTo(-r, -r * 0.3, -r * 0.5, -r * 1.1, 0, -r * 1.9);
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.2, r * 0.1, 0, 0, r * 1.6);
    g.addColorStop(0, sicak ? 'rgba(255,240,210,0.95)' : 'rgba(220,240,255,0.95)');
    g.addColorStop(0.5, sicak ? 'rgba(255,190,120,0.45)' : 'rgba(140,190,240,0.45)');
    g.addColorStop(1, 'rgba(80,120,180,0.15)');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = r * 0.12; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.beginPath(); ctx.ellipse(-r * 0.35, -r * 0.1, r * 0.22, r * 0.38, -0.4, 0, TAU); ctx.fill();
    ctx.restore();
  }

  /* Yakın plan profil yüz.
   * p: { kenar: 'r,g,b' (kenar ışığı), on: 'r,g,b' (yüz önü dolgu ışığı), onGuc 0..1,
   *      dolu (göz ıslaklığı), kapali, yaslar:[u], egim, ekranYansima (0..1, gözde telefon ekranı) }
   * kam: { K (ölçek), ox, oy (baş orijininin ekrandaki yeri) }
   */
  function yakinYuz(ctx, t, p, kam) {
    const K = kam.K;
    ctx.save();
    ctx.translate(kam.ox, kam.oy); ctx.rotate(p.egim || 0); ctx.scale(K, K);
    const kenar = p.kenar || '140,180,240', on = p.on || '40,50,80', og = p.onGuc ?? 0.5;
    ctx.save(); ctx.translate(0.55, -0.25); ctx.fillStyle = `rgba(${kenar},0.8)`; ctx.fill(BAS); ctx.fill(SAC); ctx.restore();
    const g = ctx.createLinearGradient(52, 20, -40, -10);
    g.addColorStop(0, `rgba(${on},${0.35 + 0.6 * og})`); g.addColorStop(0.45, '#0d1220'); g.addColorStop(1, '#05070c');
    ctx.fillStyle = '#05070c'; ctx.fill(BAS);
    ctx.fillStyle = g; ctx.fill(BAS);
    ctx.fillStyle = '#04060a'; ctx.fill(SAC);
    ctx.strokeStyle = 'rgba(120,150,200,0.25)'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.ellipse(-6, 2, 4.5, 7.5, 0.1, -1.2, 1.9); ctx.stroke();
    // alttan gelen ışık (telefon) — çene altı ve burun ucu
    if (p.altIsik) {
      const ag = ctx.createRadialGradient(46, 30, 1, 46, 30, 30);
      ag.addColorStop(0, `rgba(${on},${0.45 * p.altIsik})`); ag.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save(); ctx.clip(BAS); ctx.fillStyle = ag; ctx.fillRect(-50, -70, 120, 140); ctx.restore();
    }
    const [ex, ey] = GOZ;
    if (!p.kapali) {
      ctx.save();
      ctx.beginPath(); ctx.moveTo(ex - 4.2, ey - 0.6); ctx.quadraticCurveTo(ex, ey - 3.4, ex + 3.8, ey); ctx.quadraticCurveTo(ex, ey + 1.4, ex - 4.2, ey - 0.6); ctx.closePath();
      ctx.fillStyle = 'rgba(190,205,230,0.30)'; ctx.fill(); ctx.clip();
      ctx.fillStyle = '#05070b'; ctx.beginPath(); ctx.arc(ex + 1.6, ey - 0.8, 1.7, 0, TAU); ctx.fill();
      if (p.ekranYansima) { ctx.fillStyle = `rgba(200,235,255,${0.9 * p.ekranYansima})`; ctx.fillRect(ex + 1.9, ey - 1.6, 0.9, 1.3); }
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.beginPath(); ctx.arc(ex + 2.2, ey - 1.5, 0.45 + 0.25 * (p.dolu || 0), 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(200,225,255,${0.25 + 0.65 * (p.dolu || 0)})`; ctx.lineWidth = 0.35 + 0.5 * (p.dolu || 0);
      ctx.beginPath(); ctx.moveTo(ex - 3.6, ey - 0.2); ctx.quadraticCurveTo(ex, ey + 1.5, ex + 3.6, ey + 0.2); ctx.stroke();
      ctx.strokeStyle = 'rgba(10,12,18,0.9)'; ctx.lineWidth = 0.5;
      for (let k = 0; k < 5; k++) { const x = ex - 2 + k * 1.3; ctx.beginPath(); ctx.moveTo(x, ey - 2.6 + Math.abs(k - 2) * 0.2); ctx.lineTo(x + 1.1, ey - 3.9 + Math.abs(k - 2) * 0.3); ctx.stroke(); }
    } else {
      ctx.strokeStyle = `rgba(${kenar},0.55)`; ctx.lineWidth = 0.45;
      ctx.beginPath(); ctx.moveTo(ex - 4, ey - 0.8); ctx.quadraticCurveTo(ex, ey + 1.4, ex + 3.8, ey - 0.2); ctx.stroke();
      ctx.strokeStyle = 'rgba(10,12,18,0.9)';
      for (let k = 0; k < 5; k++) { const x = ex - 2 + k * 1.3; ctx.beginPath(); ctx.moveTo(x, ey + 0.5); ctx.lineTo(x + 0.9, ey + 1.8); ctx.stroke(); }
    }
    for (const u of p.yaslar || []) {
      if (u <= 0) continue;
      const iz = Math.min(1, u);
      ctx.save(); ctx.strokeStyle = 'rgba(190,220,255,0.45)'; ctx.lineWidth = 0.55; ctx.lineCap = 'round';
      ctx.beginPath(); for (let q = 0; q <= iz; q += 0.04) { const [x, y] = yolNokta(YAS_YOLU, q); q ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); ctx.restore();
      if (u < 1.05) { const [x, y] = yolNokta(YAS_YOLU, iz); damla(ctx, x + 0.2, y, lerp(0.9, 1.6, clamp(u * 3)), u > 1 ? (1.05 - u) * 20 : 1); }
    }
    ctx.restore();
    // gözün ekrandaki konumu
    const c = Math.cos(p.egim || 0), s = Math.sin(p.egim || 0);
    return { goz: [kam.ox + (ex * c - ey * s) * K, kam.oy + (ex * s + ey * c) * K] };
  }

  // Oturan karakter (geniş plan). p: { egik 0..1, nefes 0..1, telefon 0..1 (ellerde telefon) }
  function oturan(ctx, x, y, s, p, renk) {
    const e = p.egik ?? 0.6, n = p.nefes || 0;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = renk; ctx.strokeStyle = renk; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const om = [25 + e * 22, -258 + e * 28 - n * 7];
    ctx.lineWidth = 72; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(205, 18); ctx.stroke();
    ctx.lineWidth = 52; ctx.beginPath(); ctx.moveTo(205, 18); ctx.lineTo(222, 285); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(262, 300, 52, 18, 0.05, 0, TAU); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-34, 6); ctx.lineTo(48, 14);
    ctx.quadraticCurveTo(om[0] + 58, om[1] + 120, om[0] + 34, om[1] + 30);
    ctx.quadraticCurveTo(om[0] + 22, om[1] - 16, om[0] - 8, om[1] - 14);
    ctx.quadraticCurveTo(om[0] - 70, om[1] + 10, -44, -120);
    ctx.quadraticCurveTo(-52, -50, -34, 6); ctx.closePath(); ctx.fill();
    const bas = [om[0] + 58 + e * 20, om[1] - 82 + e * 36];
    ctx.lineWidth = 34; ctx.beginPath(); ctx.moveTo(om[0] + 6, om[1] - 4); ctx.lineTo(bas[0] - 18, bas[1] + 40); ctx.stroke();
    ctx.save(); ctx.translate(bas[0], bas[1]); ctx.rotate(0.18 + e * 0.38 - n * 0.06); ctx.scale(0.92, 0.92);
    ctx.fill(BAS); ctx.fill(SAC); ctx.restore();
    const tel = p.telefon || 0;
    const el = [lerp(178, 196, tel), lerp(-26, -70, tel)];
    ctx.lineWidth = 40; ctx.beginPath(); ctx.moveTo(om[0] + 4, om[1] + 8); ctx.lineTo(om[0] + 50, om[1] + 150); ctx.lineTo(el[0], el[1]); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(el[0] + 8, el[1] - 4, 26, 20, 0.3, 0, TAU); ctx.fill();
    ctx.restore();
    return { bas: [x + bas[0] * s, y + bas[1] * s], el: [x + (el[0] + 20) * s, y + (el[1] - 18) * s] };
  }

  STUDIO.KR = { BAS, SAC, GOZ, damla, yakinYuz, oturan, yolNokta };
})();
