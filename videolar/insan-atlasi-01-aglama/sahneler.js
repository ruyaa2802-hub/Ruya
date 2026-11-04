/* İNSAN ATLASI #01 — "İnsan neden bazen hiçbir sebep yokken ağlamak ister?"
 * Tüm görüntüler kodla çizilir. Aynı karakter (profil siluet) tüm sahnelerde kullanılır.
 * Renkler: lacivert / koyu mavi / gri + sıcak gün ışığı; marka vurgusu turkuaz.
 */
(function () {
  const { W, H, clamp, lerp, inv, ease, ramp, pencere, rng, fbm, tuval, gurultuDokusu, etiket, yazi, FONT } = STUDIO.R;
  const { kamera, kf, parilti, bokeh, kisi, hap, halkalar, TAU } = STUDIO.K;
  const A = {};
  const TURKUAZ = '47,211,198';

  // ---------- Karakter: profil baş (sağa bakar), birim koordinat ----------
  const BAS = new Path2D('M -38 -10 C -40 -45 -10 -62 18 -55 C 34 -50 40 -38 40 -24 C 41 -18 39 -14 42 -11 C 46 -4 50 4 52 10 C 53 13 50 15 45 15 C 46 18 46 21 44 22 C 45 25 44 28 41 29 C 42 34 40 40 33 43 C 25 46 12 44 4 38 L 7 62 L -17 62 C -19 40 -34 24 -38 -10 Z');
  const SAC = new Path2D('M -40 -6 C -49 -54 -4 -75 27 -59 C 39 -53 42 -43 39 -36 C 25 -46 -4 -43 -20 -25 C -28 -15 -34 -3 -40 -6 Z');
  const GOZ = [31, -8];
  const GOZYASI_YOLU = [[31.5, -6.5], [30.6, 0], [30.4, 7], [29.6, 15], [28.2, 23], [26, 31], [23.5, 38], [21, 44]];

  function yolNokta(pts, u) {
    if (!pts._L) { pts._L = [0]; for (let i = 1; i < pts.length; i++) pts._L.push(pts._L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); }
    const L = pts._L, h = clamp(u) * L[L.length - 1];
    for (let i = 1; i < pts.length; i++) if (h <= L[i]) { const k = (h - L[i - 1]) / Math.max(1e-6, L[i] - L[i - 1]); return [lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k)]; }
    return pts[pts.length - 1];
  }

  // gözyaşı damlası (yerel birimde, r yarıçap)
  function damla(ctx, x, y, r, alfa = 1, sicak = 0) {
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

  // yakın plan profil yüz. p: { dolu (göz ıslaklığı), kapali, yaslar:[u...], isik (0 gece,1 sabah), egim }
  function yakinYuz(ctx, t, p, kam) {
    const K = kam.K, ox = kam.ox, oy = kam.oy;
    ctx.save();
    ctx.translate(ox, oy); ctx.rotate(p.egim || 0); ctx.scale(K, K);
    const s = p.isik || 0;
    // kenar ışığı (pencere tarafı: sağ)
    ctx.save(); ctx.translate(0.55, -0.25);
    ctx.fillStyle = s > 0.5 ? `rgba(255,${200 + 30 * s},${140 + 40 * s},${0.7 + 0.3 * s})` : 'rgba(140,180,240,0.75)';
    ctx.fill(BAS); ctx.fill(SAC); ctx.restore();
    // yüz dolgusu (hacim için degrade)
    const g = ctx.createLinearGradient(50, 0, -40, 0);
    g.addColorStop(0, s > 0.5 ? `rgb(${lerp(40, 120, s - 0.5) | 0},${lerp(42, 82, s - 0.5) | 0},${lerp(56, 60, s - 0.5) | 0})` : '#1d2740');
    g.addColorStop(0.45, '#0d1220'); g.addColorStop(1, '#05070c');
    ctx.fillStyle = g; ctx.fill(BAS);
    ctx.fillStyle = '#04060a'; ctx.fill(SAC);
    // kulak
    ctx.strokeStyle = 'rgba(120,150,200,0.25)'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.ellipse(-6, 2, 4.5, 7.5, 0.1, -1.2, 1.9); ctx.stroke();
    // yanak ışığı
    const yg = ctx.createRadialGradient(34, 6, 1, 34, 6, 16);
    yg.addColorStop(0, s > 0.5 ? `rgba(255,190,130,${0.22 * s})` : 'rgba(120,160,230,0.10)'); yg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = yg; ctx.fill(BAS);
    // göz
    const [ex, ey] = GOZ;
    if (!p.kapali) {
      ctx.save();
      ctx.beginPath(); ctx.moveTo(ex - 4.2, ey - 0.6); ctx.quadraticCurveTo(ex, ey - 3.4, ex + 3.8, ey); ctx.quadraticCurveTo(ex, ey + 1.4, ex - 4.2, ey - 0.6); ctx.closePath();
      ctx.fillStyle = 'rgba(190,205,230,0.30)'; ctx.fill(); ctx.clip();
      ctx.fillStyle = '#05070b'; ctx.beginPath(); ctx.arc(ex + 1.6, ey - 0.8, 1.7, 0, TAU); ctx.fill();
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.beginPath(); ctx.arc(ex + 2.2, ey - 1.5, 0.45 + 0.25 * (p.dolu || 0), 0, TAU); ctx.fill();
      // ıslak alt kapak çizgisi
      ctx.strokeStyle = `rgba(200,225,255,${0.25 + 0.65 * (p.dolu || 0)})`; ctx.lineWidth = 0.35 + 0.5 * (p.dolu || 0);
      ctx.beginPath(); ctx.moveTo(ex - 3.6, ey - 0.2); ctx.quadraticCurveTo(ex, ey + 1.5, ex + 3.6, ey + 0.2); ctx.stroke();
      ctx.strokeStyle = 'rgba(10,12,18,0.9)'; ctx.lineWidth = 0.5;
      for (let k = 0; k < 5; k++) { const x = ex - 2 + k * 1.3; ctx.beginPath(); ctx.moveTo(x, ey - 2.6 + Math.abs(k - 2) * 0.2); ctx.lineTo(x + 1.1, ey - 3.9 + Math.abs(k - 2) * 0.3); ctx.stroke(); }
    } else {
      ctx.strokeStyle = s > 0.5 ? 'rgba(255,210,160,0.6)' : 'rgba(160,190,240,0.55)'; ctx.lineWidth = 0.45;
      ctx.beginPath(); ctx.moveTo(ex - 4, ey - 0.8); ctx.quadraticCurveTo(ex, ey + 1.4, ex + 3.8, ey - 0.2); ctx.stroke();
      ctx.strokeStyle = 'rgba(10,12,18,0.9)';
      for (let k = 0; k < 5; k++) { const x = ex - 2 + k * 1.3; ctx.beginPath(); ctx.moveTo(x, ey + 0.5); ctx.lineTo(x + 0.9, ey + 1.8); ctx.stroke(); }
    }
    // gözyaşları
    for (const u of p.yaslar || []) {
      if (u <= 0) continue;
      const iz = Math.min(1, u);
      ctx.save(); ctx.strokeStyle = s > 0.5 ? 'rgba(255,225,180,0.45)' : 'rgba(190,220,255,0.45)'; ctx.lineWidth = 0.55; ctx.lineCap = 'round';
      ctx.beginPath(); for (let q = 0; q <= iz; q += 0.04) { const [x, y] = yolNokta(GOZYASI_YOLU, q); q ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); ctx.restore();
      if (u < 1.05) { const [x, y] = yolNokta(GOZYASI_YOLU, iz); damla(ctx, x + 0.2, y, lerp(0.9, 1.6, clamp(u * 3)), u > 1 ? (1.05 - u) * 20 : 1, s > 0.5); }
    }
    ctx.restore();
  }

  // ---------- Oturan karakter (geniş plan), birim = baş birimi ----------
  function oturan(ctx, x, y, s, p, renk) {
    const e = p.egik ?? 0.6, n = p.nefes || 0;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = renk; ctx.strokeStyle = renk; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const om = [25 + e * 22, -258 + e * 28 - n * 7];
    // bacaklar
    ctx.lineWidth = 72; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(205, 18); ctx.stroke();
    ctx.lineWidth = 52; ctx.beginPath(); ctx.moveTo(205, 18); ctx.lineTo(222, 285); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(262, 300, 52, 18, 0.05, 0, TAU); ctx.fill();
    // gövde (öne eğik sırt)
    ctx.beginPath();
    ctx.moveTo(-34, 6); ctx.lineTo(48, 14);
    ctx.quadraticCurveTo(om[0] + 58, om[1] + 120, om[0] + 34, om[1] + 30);
    ctx.quadraticCurveTo(om[0] + 22, om[1] - 16, om[0] - 8, om[1] - 14);
    ctx.quadraticCurveTo(om[0] - 70, om[1] + 10, -44, -120);
    ctx.quadraticCurveTo(-52, -50, -34, 6); ctx.closePath(); ctx.fill();
    // boyun + baş
    const bas = [om[0] + 58 + e * 20, om[1] - 82 + e * 36];
    ctx.lineWidth = 34; ctx.beginPath(); ctx.moveTo(om[0] + 6, om[1] - 4); ctx.lineTo(bas[0] - 18, bas[1] + 40); ctx.stroke();
    ctx.save(); ctx.translate(bas[0], bas[1]); ctx.rotate(0.18 + e * 0.38 - n * 0.06); ctx.scale(0.92, 0.92);
    ctx.fill(BAS); ctx.fill(SAC); ctx.restore();
    // kol: omuz → dirsek → dizdeki eller
    ctx.lineWidth = 40; ctx.beginPath(); ctx.moveTo(om[0] + 4, om[1] + 8); ctx.lineTo(om[0] + 50, om[1] + 150); ctx.lineTo(178, -26); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(186, -30, 26, 20, 0.3, 0, TAU); ctx.fill();
    ctx.restore();
    return { bas: [x + bas[0] * s, y + bas[1] * s] };
  }

  // ---------- Oda ----------
  function odaHazirla() {
    const r = rng(41);
    const yap = (sabah) => {
      const c = tuval(), x = c.getContext('2d');
      let g = x.createLinearGradient(0, 0, 0, 1450);
      if (sabah) { g.addColorStop(0, '#2a2420'); g.addColorStop(1, '#4a3a30'); } else { g.addColorStop(0, '#070c18'); g.addColorStop(1, '#101a2e'); }
      x.fillStyle = g; x.fillRect(0, 0, W, 1450);
      const duvar = gurultuDokusu(270, 360, 30, sabah ? 3 : 4, f => [f * 255, f * 255, f * 255, 18], 4);
      x.globalCompositeOperation = 'overlay'; x.drawImage(duvar, 0, 0, W, 1450); x.globalCompositeOperation = 'source-over';
      // zemin
      g = x.createLinearGradient(0, 1450, 0, H);
      if (sabah) { g.addColorStop(0, '#3a2a20'); g.addColorStop(1, '#1a120e'); } else { g.addColorStop(0, '#0b1120'); g.addColorStop(1, '#04060c'); }
      x.fillStyle = g; x.fillRect(0, 1450, W, H - 1450);
      x.strokeStyle = sabah ? 'rgba(255,200,150,0.06)' : 'rgba(120,150,200,0.05)'; x.lineWidth = 3;
      for (let k = 0; k < 9; k++) { x.beginPath(); x.moveTo(0, 1470 + k * 52); x.lineTo(W, 1460 + k * 56); x.stroke(); }
      // süpürgelik
      x.fillStyle = sabah ? '#2a1e18' : '#060a14'; x.fillRect(0, 1430, W, 24);
      // pencere dışı
      g = x.createLinearGradient(0, 360, 0, 1060);
      if (sabah) { g.addColorStop(0, '#fff1d8'); g.addColorStop(0.6, '#ffd39a'); g.addColorStop(1, '#f2a868'); }
      else { g.addColorStop(0, '#0a1630'); g.addColorStop(1, '#1b2d52'); }
      x.fillStyle = g; x.fillRect(660, 370, 340, 680);
      if (!sabah) for (let k = 0; k < 26; k++) { const px = 670 + r() * 320, py = 820 + r() * 220; x.fillStyle = `rgba(255,${180 + r() * 60},120,${0.25 + r() * 0.4})`; x.beginPath(); x.arc(px, py, 2 + r() * 4, 0, TAU); x.fill(); }
      else { const gn = x.createRadialGradient(900, 520, 10, 900, 520, 260); gn.addColorStop(0, 'rgba(255,255,240,1)'); gn.addColorStop(1, 'rgba(255,230,180,0)'); x.fillStyle = gn; x.fillRect(660, 370, 340, 680); }
      // pencere çerçevesi
      x.strokeStyle = sabah ? '#3a2c22' : '#050810'; x.lineWidth = 22; x.strokeRect(660, 370, 340, 680);
      x.lineWidth = 12; x.beginPath(); x.moveTo(830, 370); x.lineTo(830, 1050); x.moveTo(660, 700); x.lineTo(1000, 700); x.stroke();
      x.fillStyle = sabah ? '#3a2c22' : '#050810'; x.fillRect(640, 1050, 380, 26);
      // perdeler
      for (const [x0, x1] of [[575, 690], [985, 1080]]) for (let k = x0; k < x1; k += 14) {
        const v = 0.5 + 0.5 * Math.sin(k * 0.45);
        x.fillStyle = sabah ? `rgba(${120 + 60 * v},${90 + 40 * v},${70 + 30 * v},0.95)` : `rgba(${18 + 18 * v},${26 + 22 * v},${46 + 30 * v},0.97)`;
        x.fillRect(k, 300, 15, 1150);
      }
      // aplik lamba (gece sıcak)
      x.fillStyle = sabah ? '#2a201a' : '#0a0e18'; x.fillRect(110, 740, 60, 70);
      // yatak
      x.fillStyle = sabah ? '#2a1d16' : '#060912'; x.fillRect(-10, 1290, 780, 130); x.fillRect(20, 1400, 26, 60); x.fillRect(720, 1400, 26, 60);
      x.fillRect(-10, 1000, 60, 420);
      g = x.createLinearGradient(0, 1170, 0, 1310);
      if (sabah) { g.addColorStop(0, '#c9b5a2'); g.addColorStop(1, '#6e5a4c'); } else { g.addColorStop(0, '#2a3756'); g.addColorStop(1, '#141c30'); }
      x.fillStyle = g;
      x.beginPath(); x.moveTo(40, 1175); x.lineTo(770, 1185);
      x.quadraticCurveTo(790, 1250, 770, 1350); for (let k = 770; k > 40; k -= 60) x.quadraticCurveTo(k - 30, 1365 + 12 * Math.sin(k), k - 60, 1350);
      x.closePath(); x.fill();
      x.fillStyle = sabah ? '#e8dccf' : '#33405e'; x.beginPath(); x.ellipse(170, 1160, 120, 40, -0.05, 0, TAU); x.fill();
      return c;
    };
    A.odaGece = yap(false); A.odaSabah = yap(true);
    A.toz = Array.from({ length: 90 }, () => ({ x: r() * W, y: r() * H, s: 1 + r() * 3, v: 4 + r() * 10, ph: r() * TAU }));
    A.yagmur = Array.from({ length: 60 }, () => ({ x: 665 + r() * 330, y: r() * 680, v: 500 + r() * 400, L: 20 + r() * 30 }));
  }

  // geniş oda planı. sabah: 0..1, kam {cx,cy,z}, p: karakter pozu, karart: anı sahnesi için koyulaştırma
  function oda(ctx, t, sabah, kam, p, karart = 0) {
    ctx.save();
    kamera(ctx, kam.cx, kam.cy, kam.z, kam.rot || 0);
    ctx.drawImage(A.odaGece, 0, 0);
    if (sabah > 0) { ctx.globalAlpha = sabah; ctx.drawImage(A.odaSabah, 0, 0); ctx.globalAlpha = 1; }
    // camda yağmur (gece)
    if (sabah < 1) {
      ctx.save(); ctx.beginPath(); ctx.rect(670, 380, 320, 660); ctx.clip();
      ctx.strokeStyle = `rgba(170,200,240,${0.25 * (1 - sabah)})`; ctx.lineWidth = 2;
      for (const d of A.yagmur) { const y = 380 + ((d.y + t * d.v) % 680); ctx.beginPath(); ctx.moveTo(d.x, y); ctx.lineTo(d.x - 3, y + d.L); ctx.stroke(); }
      ctx.restore();
    }
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    // aplik lamba (gece)
    if (sabah < 1) { const s = 260; ctx.globalAlpha = 0.45 * (1 - sabah) * (0.95 + 0.05 * Math.sin(t * 9)); ctx.drawImage(parilti('255,170,100'), 140 - s, 790 - s, s * 2, s * 2); }
    // pencereden giren ışık
    const gece = 1 - sabah;
    ctx.globalAlpha = 0.18 * gece + 0.55 * sabah;
    let g = ctx.createLinearGradient(1000, 700, 200, 1700);
    g.addColorStop(0, sabah > 0.5 ? 'rgba(255,210,150,0.9)' : 'rgba(120,160,230,0.7)'); g.addColorStop(1, 'rgba(255,200,140,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(660, 380); ctx.lineTo(1000, 380); ctx.lineTo(560, 1900); ctx.lineTo(-100, 1900); ctx.closePath(); ctx.fill();
    // tanrı ışınları (sabah)
    if (sabah > 0) {
      for (let k = 0; k < 6; k++) {
        const a = 0.10 * sabah * (0.6 + 0.4 * Math.sin(t * 0.7 + k * 1.7));
        ctx.globalAlpha = a; ctx.fillStyle = 'rgba(255,220,170,1)';
        const x0 = 690 + k * 55;
        ctx.beginPath(); ctx.moveTo(x0, 390); ctx.lineTo(x0 + 30, 390); ctx.lineTo(x0 - 520 + k * 20, 1900); ctx.lineTo(x0 - 640 + k * 20, 1900); ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha = sabah * 0.9;
      for (const d of A.toz) { const y = (d.y - t * d.v) % H; const yy = y < 0 ? y + H : y; ctx.globalAlpha = sabah * (0.3 + 0.5 * Math.sin(t + d.ph) ** 2); ctx.drawImage(parilti('255,225,180'), d.x + Math.sin(t * 0.4 + d.ph) * 20 - d.s * 3, yy - d.s * 3, d.s * 6, d.s * 6); }
    }
    ctx.restore();
    // karakter (yatağın kenarında)
    const sx = 600, sy = 1232, sc = 0.74;
    const kenar = sabah > 0.5 ? `rgba(255,${200 + 30 * sabah},150,0.95)` : 'rgba(140,180,240,0.85)';
    oturan(ctx, sx + 4, sy - 2, sc, p, kenar);
    oturan(ctx, sx - 3, sy, sc, p, sabah > 0.5 ? 'rgba(255,150,90,0.25)' : 'rgba(255,170,100,0.35)');
    const k = oturan(ctx, sx, sy, sc, p, sabah > 0.5 ? '#1a1410' : '#05070d');
    ctx.restore();
    if (karart > 0) { ctx.fillStyle = `rgba(3,6,14,${karart})`; ctx.fillRect(0, 0, W, H); }
    // renk düzeltmesi
    ctx.save(); ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = sabah > 0.5 ? `rgba(255,180,110,${0.35 * sabah})` : 'rgba(30,60,120,0.45)'; ctx.fillRect(0, 0, W, H); ctx.restore();
    const ex = (k.bas[0] - kam.cx) * kam.z + W / 2, ey = (k.bas[1] - kam.cy) * kam.z + H / 2;
    return { bas: [ex, ey] };
  }

  // ---------- Yakın plan arka planı ----------
  function yakinArka(ctx, t, sabah) {
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, sabah > 0.5 ? '#1a120e' : '#03060d'); g.addColorStop(1, sabah > 0.5 ? '#5a4030' : '#0e1a30');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const s = 900; ctx.globalAlpha = 0.35 + 0.5 * sabah;
    ctx.drawImage(parilti(sabah > 0.5 ? '255,200,140' : '90,130,210'), 1080 - s * 0.7, 600 - s, s * 2, s * 2);
    const r = rng(8);
    for (let k = 0; k < 14; k++) { const x = 760 + r() * 360, y = 300 + r() * 1200, z = 30 + r() * 60; ctx.globalAlpha = (0.15 + 0.2 * r()) * (1 - sabah * 0.5); ctx.drawImage(parilti(sabah > 0.5 ? '255,210,160' : '150,180,240'), x - z + Math.sin(t * 0.3 + k) * 10, y - z, z * 2, z * 2); }
    ctx.restore();
  }

  VIDEO.sahne('_ortak', {
    hazirla() {
      odaHazirla();
      // beyin (ayna: ön lob sağda, karakter de sağa bakıyor)
      const r = rng(23);
      const yol = new Path2D('M 240 905 C 200 760 250 600 380 548 C 500 492 690 500 800 572 C 900 640 925 760 880 870 C 860 925 800 960 720 975 C 620 995 520 1000 430 985 C 330 970 270 950 240 905 Z');
      const b = tuval(), x = b.getContext('2d');
      x.translate(W, 0); x.scale(-1, 1);
      let g = x.createRadialGradient(560, 720, 60, 560, 760, 480);
      g.addColorStop(0, 'rgba(120,150,190,0.55)'); g.addColorStop(0.7, 'rgba(60,80,120,0.5)'); g.addColorStop(1, 'rgba(30,40,70,0.55)');
      x.fillStyle = g; x.fill(yol);
      x.save(); x.clip(yol); x.lineCap = 'round';
      for (let k = 0; k < 95; k++) {
        let px = 220 + r() * 700, py = 500 + r() * 500, a = r() * TAU;
        x.beginPath(); x.moveTo(px, py);
        for (let s = 0; s < 14; s++) { a += (r() - 0.5) * 1.6; px += Math.cos(a) * 16; py += Math.sin(a) * 16; x.lineTo(px, py); }
        x.strokeStyle = 'rgba(10,18,36,0.55)'; x.lineWidth = 5; x.stroke();
        x.strokeStyle = 'rgba(170,200,235,0.20)'; x.lineWidth = 2; x.stroke();
      }
      x.restore();
      x.strokeStyle = `rgba(${TURKUAZ},0.55)`; x.lineWidth = 4; x.stroke(yol);
      x.beginPath(); x.ellipse(790, 1015, 150, 92, -0.12, 0, TAU);
      g = x.createRadialGradient(780, 1000, 20, 790, 1015, 160); g.addColorStop(0, 'rgba(110,140,185,0.6)'); g.addColorStop(1, 'rgba(40,55,90,0.6)');
      x.fillStyle = g; x.fill(); x.strokeStyle = `rgba(${TURKUAZ},0.35)`; x.lineWidth = 3; x.stroke();
      x.fillStyle = 'rgba(60,80,120,0.6)';
      x.beginPath(); x.moveTo(660, 960); x.quadraticCurveTo(700, 1100, 690, 1260); x.lineTo(730, 1260); x.quadraticCurveTo(745, 1090, 730, 960); x.fill();
      A.beyin = b;
      // sinir ağı düğümleri (beyin içinde)
      const tst = tuval(10, 10).getContext('2d');
      A.ag = [];
      while (A.ag.length < 130) { const px = 230 + r() * 700, py = 500 + r() * 500; if (tst.isPointInPath(yol, px, py)) A.ag.push([W - px, py]); }
      A.kenar = [];
      A.ag.forEach((p, i) => A.ag.forEach((q, j) => { if (j > i && Math.hypot(p[0] - q[0], p[1] - q[1]) < 95) A.kenar.push([i, j, r()]); }));
      // logo arka plan ağı
      A.logoAg = Array.from({ length: 70 }, () => [r() * W, r() * H, r() * TAU]);
    },
    ciz() { },
  });

  // ================= 1) KANCA =================
  VIDEO.sahne('kanca', {
    ciz(ctx, S) {
      const t = S.t;
      const yakinBas = S.at(1, 0) - 0.5, yu = ramp(t, yakinBas, yakinBas + 1.1);
      if (yu < 1) {
        const z = lerp(1.0, 1.22, ease.sine(clamp(t / (yakinBas + 1))));
        oda(ctx, t, 0, { cx: lerp(540, 640, clamp(t / 6)), cy: lerp(1000, 980, clamp(t / 6)), z }, { egik: 0.75 + 0.05 * Math.sin(t * 0.8), nefes: 0.5 + 0.5 * Math.sin(t * 1.3) });
      }
      if (yu > 0) {
        const tt = t - yakinBas;
        ctx.save(); ctx.globalAlpha = yu;
        yakinArka(ctx, t, 0);
        const yas = (S.t - S.at(2, 0.15)) / Math.max(1.5, S.at(2, 1) + 0.8 - S.at(2, 0.15));
        yakinYuz(ctx, t, { dolu: ramp(t, S.at(1, 0.2), S.at(2, 0.2)), yaslar: [yas], egim: 0.32 + 0.01 * Math.sin(t) }, { K: lerp(12.5, 14, clamp(tt / 6)), ox: 600 - 31 * 13, oy: 830 + 8 * 13 });
        ctx.restore();
      }
      bokeh(ctx, t, 14, 2, '150,180,240', [3, 9], 0.14, 5);
    },
  });

  // ================= 2) BİRİKEN DUYGULAR =================
  function panel(ctx, x, y, w, h, a, baslik, ic, t) {
    if (a <= 0.001) return;
    ctx.save(); ctx.globalAlpha = a * 0.92;
    ctx.translate(x, y); ctx.rotate(Math.sin(t * 0.3 + x) * 0.02);
    ctx.shadowColor = 'rgba(140,180,240,0.35)'; ctx.shadowBlur = 40;
    ctx.fillStyle = 'rgba(10,16,30,0.6)'; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 26); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.save(); ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 26); ctx.clip();
    ctx.translate(-w / 2, -h / 2); ic(ctx, w, h, t);
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,0.08)'); g.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.restore();
    ctx.strokeStyle = 'rgba(200,220,255,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 26); ctx.stroke();
    yazi(ctx, baslik, 0, h / 2 + 34, { boyut: 32, agirlik: 700, renk: 'rgba(220,232,255,0.95)' });
    ctx.restore();
  }
  const ANILAR = [
    { b: 'İş stresi', x: 280, y: 520, ic(c, w, h, t) {
      c.fillStyle = '#0c1526'; c.fillRect(0, 0, w, h);
      const g = c.createRadialGradient(w / 2, h * 0.55, 10, w / 2, h * 0.55, w * 0.6); g.addColorStop(0, 'rgba(150,190,255,0.55)'); g.addColorStop(1, 'rgba(150,190,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(190,215,255,0.85)'; c.fillRect(w * 0.22, h * 0.25, w * 0.56, h * 0.42);
      c.fillStyle = '#0c1526'; c.fillRect(w * 0.18, h * 0.67, w * 0.64, 10);
      for (let k = 0; k < 3; k++) { const yy = h * 0.3 + ((t * 30 + k * 34) % 110); c.fillStyle = 'rgba(255,255,255,0.95)'; c.beginPath(); c.roundRect(w * 0.27, yy, w * 0.46, 26, 8); c.fill(); c.fillStyle = '#e5484d'; c.beginPath(); c.arc(w * 0.7, yy + 4, 7, 0, TAU); c.fill(); }
      yazi(c, '18:47', w - 50, 30, { boyut: 24, agirlik: 700, renk: 'rgba(255,255,255,0.7)', golge: false });
    } },
    { b: 'Kalabalık', x: 800, y: 470, ic(c, w, h, t) {
      c.fillStyle = '#121a28'; c.fillRect(0, 0, w, h);
      const r = rng(4);
      for (let k = 0; k < 14; k++) { const d = r() < 0.5 ? 1 : -1, sp = 30 + r() * 30, x = ((r() * w + d * t * sp) % (w + 60) + w + 60) % (w + 60) - 30; kisi(c, x, h * (0.78 + r() * 0.16), 110 + r() * 50, { faz: t * 6 + k, yuru: 1 }, `rgba(${30 + r() * 30},${40 + r() * 30},${60 + r() * 30},0.95)`); }
      c.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 8; k++) { c.globalAlpha = 0.4; c.drawImage(parilti('255,200,140'), r() * w - 30, r() * h * 0.5 - 30, 60, 60); }
    } },
    { b: 'Yorgunluk', x: 260, y: 960, ic(c, w, h, t) {
      c.fillStyle = '#0e1422'; c.fillRect(0, 0, w, h);
      const dol = 0.75 - 0.6 * clamp((t % 6) / 4);
      c.strokeStyle = 'rgba(220,230,255,0.85)'; c.lineWidth = 6; c.beginPath(); c.roundRect(w * 0.25, h * 0.32, w * 0.46, h * 0.36, 14); c.stroke();
      c.fillStyle = 'rgba(220,230,255,0.85)'; c.fillRect(w * 0.71 + 4, h * 0.42, 12, h * 0.16);
      c.fillStyle = dol < 0.3 ? '#e5484d' : '#f5c451'; c.fillRect(w * 0.25 + 10, h * 0.32 + 10, (w * 0.46 - 20) * dol, h * 0.36 - 20);
      yazi(c, '%' + Math.round(dol * 100), w / 2, h * 0.82, { boyut: 30, agirlik: 800, renk: 'rgba(255,255,255,0.8)', golge: false });
    } },
    { b: 'Yalnızlık', x: 820, y: 900, ic(c, w, h, t) {
      c.fillStyle = '#070b16'; c.fillRect(0, 0, w, h);
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.7; c.drawImage(parilti('255,190,120'), w * 0.6 - 120, h * 0.2 - 60, 240, 240); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      c.fillStyle = '#04060c'; c.fillRect(w * 0.6 - 3, h * 0.2, 6, h * 0.8);
      kisi(c, w * 0.42, h * 0.92, 150, { basEgik: 1 }, '#02040a');
      c.strokeStyle = 'rgba(170,200,240,0.35)'; c.lineWidth = 1.5;
      const r = rng(2); for (let k = 0; k < 40; k++) { const x = r() * w, y = (r() * h + t * 380) % h; c.beginPath(); c.moveTo(x, y); c.lineTo(x - 3, y + 16); c.stroke(); }
    } },
  ];
  VIDEO.sahne('birikim', {
    ciz(ctx, S) {
      const t = S.t;
      const anBas = [S.at(0, 0.02), S.at(0, 0.38), S.at(0, 0.68), S.at(1, 0.05)];
      const akis = ramp(t, S.at(1, 0.5), S.at(1, 0.95));
      const z = lerp(1.08, 1.0, ease.out(clamp(t / 3))) + 0.12 * ease.in(ramp(t, S.at(1, 0.6), S.d + 0.6));
      const k = oda(ctx, t, 0, { cx: lerp(560, 620, akis), cy: lerp(1000, 980, akis), z }, { egik: 0.8, nefes: 0.5 + 0.5 * Math.sin(t * 1.2) }, 0.35);
      const hx = k.bas[0], hy = k.bas[1];
      // anılar
      ANILAR.forEach((an, i) => {
        const a = ramp(t, anBas[i], anBas[i] + 0.8) * (1 - akis);
        const yuz = Math.sin(t * 0.6 + i) * 12;
        panel(ctx, lerp(an.x, hx, akis * 0.6), lerp(an.y + yuz, hy, akis * 0.6), 400, 250, a, an.b, an.ic, t);
      });
      // anılardan başa akan ışık parçacıkları (birikim)
      if (akis > 0) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ANILAR.forEach((an, i) => {
          for (let n = 0; n < 40; n++) {
            const u = clamp(akis * 1.4 - n / 60);
            if (u <= 0 || u >= 1) continue;
            const cx = lerp(an.x, hx, u) + Math.sin(n * 7 + t * 2) * 60 * (1 - u), cy = lerp(an.y, hy, u) - Math.sin(Math.PI * u) * 120;
            ctx.globalAlpha = Math.sin(Math.PI * u) * 0.8;
            const s = 10 + 8 * (1 - u); ctx.drawImage(parilti(i % 2 ? '150,190,255' : TURKUAZ), cx - s, cy - s, s * 2, s * 2);
          }
        });
        const bg = 60 + 120 * akis; ctx.globalAlpha = akis * (0.6 + 0.2 * Math.sin(t * 5));
        ctx.drawImage(parilti('150,190,255'), hx - bg, hy - bg, bg * 2, bg * 2);
        ctx.restore();
      }
      bokeh(ctx, t, 16, 6, '150,180,240', [3, 10], 0.15, 5);
    },
  });

  // ================= 3) BEYİN =================
  const BOLGE = { prefrontal: [760, 700], amigdala: [628, 905], hipotalamus: [528, 892], bezi: [838, 1010] };
  const YAS_YOLU = [[528, 892], [430, 960], [390, 1040], [520, 1090], [700, 1075], [838, 1010]];
  function bolgeIsik(ctx, [x, y], renk, a, r = 90) {
    if (a <= 0) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a; ctx.drawImage(parilti(renk), x - r, y - r, r * 2, r * 2); ctx.restore();
  }
  VIDEO.sahne('beyin', {
    ciz(ctx, S) {
      const t = S.t;
      const c1 = S.cue(1);
      const kel = o => S.at(1, o);
      const [cx, cy, z] = kf(t, [[-0.6, [700, 900, 2.0]], [S.at(0, 0.5), [560, 860, 1.12]], [S.at(1, 0.6), [600, 880, 1.15]], [S.at(2, 0.3), [680, 800, 1.3]], [S.d + 1, [680, 800, 1.32]]]);
      // arka plan
      const g = ctx.createRadialGradient(540, 880, 100, 540, 900, 1100);
      g.addColorStop(0, '#0f1b34'); g.addColorStop(1, '#03060d');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.save();
      kamera(ctx, cx, cy, z);
      // hayalet profil (karakterin başı)
      ctx.save(); ctx.translate(500, 1110); ctx.scale(11, 11);
      ctx.strokeStyle = `rgba(${TURKUAZ},0.22)`; ctx.lineWidth = 0.25; ctx.stroke(BAS);
      ctx.fillStyle = 'rgba(20,35,60,0.25)'; ctx.fill(BAS);
      ctx.restore();
      ctx.drawImage(A.beyin, 0, 0);
      // sinir ağı ve akan ışıklar
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const agA = ramp(t, 0, 1.2);
      ctx.strokeStyle = `rgba(${TURKUAZ},${0.16 * agA})`; ctx.lineWidth = 1.5;
      ctx.beginPath(); for (const [i, j] of A.kenar) { ctx.moveTo(...A.ag[i]); ctx.lineTo(...A.ag[j]); } ctx.stroke();
      for (const [i, j, f] of A.kenar) {
        const u = ((t * (0.4 + f * 0.6) + f * 7) % 2.2);
        if (u > 1) continue;
        const p = A.ag[i], q = A.ag[j];
        ctx.globalAlpha = agA * Math.sin(Math.PI * u) * 0.9;
        ctx.drawImage(parilti(TURKUAZ), lerp(p[0], q[0], u) - 10, lerp(p[1], q[1], u) - 10, 20, 20);
      }
      ctx.restore();
      // bölgeler
      const stres = pencere(t, kel(0.0), kel(1.05), 0.3), yorg = pencere(t, kel(0.1), kel(1.05), 0.3);
      const hormon = pencere(t, kel(0.26), kel(1.05), 0.3), mutlu = pencere(t, kel(0.42), kel(1.05), 0.3);
      bolgeIsik(ctx, BOLGE.amigdala, '255,120,90', stres * (0.7 + 0.3 * Math.sin(t * 6)), 90);
      if (yorg > 0) { ctx.save(); ctx.globalAlpha = 0.25 * yorg * (0.5 + 0.5 * Math.sin(t * 2)); ctx.fillStyle = 'rgb(140,150,170)'; ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(parilti('140,160,200'), 560 - 420, 760 - 300, 840, 600); ctx.restore(); }
      bolgeIsik(ctx, BOLGE.hipotalamus, '190,140,255', hormon * (0.7 + 0.3 * Math.sin(t * 5 + 1)), 80);
      bolgeIsik(ctx, [560, 760], '255,200,120', mutlu * 0.6, 360);
      // gözyaşı bezine sinyal ve göz
      const gozA = ramp(t, kel(0.5), kel(0.68));
      ctx.save(); ctx.globalAlpha = gozA;
      ctx.strokeStyle = 'rgba(200,220,255,0.7)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(842, 1022, 34, 14, 0.05, 0, TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(200,220,255,0.6)'; ctx.beginPath(); ctx.arc(850, 1022, 9, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(120,200,255,0.55)'; ctx.beginPath(); ctx.ellipse(840, 1000, 20, 9, 0.4, 0, TAU); ctx.fill();
      ctx.restore();
      const su = clamp((t - kel(0.62)) / (kel(0.98) - kel(0.62)));
      if (su > 0) {
        ctx.save(); ctx.strokeStyle = `rgba(${TURKUAZ},0.4)`; ctx.lineWidth = 3; ctx.setLineDash([10, 8]);
        ctx.beginPath(); YAS_YOLU.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.stroke(); ctx.restore();
        if (su < 1) { const [x, y] = yolNokta(YAS_YOLU, ease.inOut(su)); bolgeIsik(ctx, [x, y], TURKUAZ, 1, 40); }
      }
      const yd = clamp((t - kel(0.98)) / 1.6);
      if (yd > 0) damla(ctx, 860, 1040 + ease.in(yd) * 120, 12, 1 - ramp(yd, 0.8, 1));
      // düzenleme: prefrontal
      const pf = ramp(t, S.at(2, 0.05), S.at(2, 0.4));
      if (pf > 0) {
        bolgeIsik(ctx, BOLGE.prefrontal, TURKUAZ, pf * (0.75 + 0.25 * Math.sin(t * 3)), 130);
        halkalar(ctx, ...BOLGE.prefrontal, t * 0.6, { renk: TURKUAZ, maxR: 260, alfa: 0.4 * pf, kalin: 3, n: 3 });
      }
      ctx.restore();
      const E = ([x, y]) => [(x - cx) * z + W / 2, (y - cy) * z + H / 2];
      // etiketler
      etiket(ctx, ...E(BOLGE.amigdala), 250, 1200, 'Amigdala', stres * (1 - pf), { alt: 'duygusal tepki', renk: 'rgba(255,190,170,1)' });
      etiket(ctx, ...E(BOLGE.hipotalamus), 560, 560, 'Hipotalamus', hormon * (1 - pf), { alt: 'stres ve hormonlar', renk: 'rgba(215,190,255,1)' });
      etiket(ctx, ...E(BOLGE.bezi), 660, 1250, 'Gözyaşı bezi', pencere(t, kel(0.62), S.at(2, 0.2), 0.3), { renk: 'rgba(170,225,255,1)' });
      etiket(ctx, ...E(BOLGE.prefrontal), 620, 360, 'Prefrontal korteks', pencere(t, S.at(2, 0.15), S.d + 2, 0.4), { boyut: 46, alt: 'duyguları düzenler', renk: `rgba(${TURKUAZ},1)` });
      // tetikleyiciler
      const cipler = [['Stres', 0.0, '255,140,110'], ['Yorgunluk', 0.1, '170,185,210'], ['Hormonlar', 0.26, '200,160,255'], ['Mutluluk', 0.42, '255,205,120']];
      const cipA = 1 - ramp(t, S.at(2, 0.0), S.at(2, 0.2));
      cipler.forEach(([m, o, r], i) => {
        const a = ramp(t, kel(o), kel(o) + 0.5, ease.outBack) * cipA;
        if (a <= 0) return;
        ctx.save(); ctx.globalAlpha = clamp(a);
        const x = 300 + (i % 2) * 480, y = 250 + Math.floor(i / 2) * 120;
        ctx.translate(x, y); ctx.scale(lerp(0.8, 1, clamp(a)), lerp(0.8, 1, clamp(a))); ctx.translate(-x, -y);
        hap(ctx, m, x, y, 'rgba(8,14,28,0.8)', `rgba(${r},1)`, 1, 44);
        ctx.restore();
      });
      bokeh(ctx, t, 18, 31, TURKUAZ, [3, 9], 0.2, 5);
    },
  });

  // ================= 4) DUYGUSAL FİNAL =================
  VIDEO.sahne('final', {
    ciz(ctx, S) {
      const t = S.t;
      const makroBas = S.at(1, 0) - 0.4, makroU = pencere(t, makroBas, S.at(2, 0) - 0.1, 0.7);
      const gunes = ramp(t, S.at(2, 0.0), S.at(2, 1.0));
      const genisBas = S.at(3, 0) - 0.5, genisU = ramp(t, genisBas, genisBas + 1.2);
      const yakinKam = { K: lerp(14, 13, clamp(t / 6)), ox: 600 - 31 * 13, oy: 830 + 8 * 13 };
      // yakın plan: gözler kapalı, yaşlar
      if (genisU < 1) {
        yakinArka(ctx, t, gunes);
        const u1 = (t - S.at(0, 0.1)) / 2.6, u2 = (t - S.at(0, 0.55)) / 2.8, u3 = (t - S.at(2, 0.2)) / 3.0;
        yakinYuz(ctx, t, { kapali: true, yaslar: [u1, u2, u3], isik: gunes, egim: lerp(0.3, 0.12, gunes) - 0.02 * Math.sin(t * 1.1) }, yakinKam);
        // sabah ışınları yüze
        if (gunes > 0) {
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          for (let k = 0; k < 5; k++) {
            ctx.globalAlpha = 0.07 * gunes * (0.6 + 0.4 * Math.sin(t * 0.8 + k * 1.3));
            ctx.fillStyle = 'rgba(255,215,160,1)';
            const y0 = 200 + k * 260; ctx.beginPath(); ctx.moveTo(W + 50, y0); ctx.lineTo(W + 50, y0 + 90); ctx.lineTo(-100, y0 + 520); ctx.lineTo(-100, y0 + 300); ctx.closePath(); ctx.fill();
          }
          ctx.restore();
        }
      }
      // makro gözyaşı (yansıma)
      if (makroU > 0) {
        ctx.save(); ctx.globalAlpha = makroU;
        const g = ctx.createRadialGradient(540, 900, 50, 540, 900, 1100);
        g.addColorStop(0, '#1a2338'); g.addColorStop(1, '#05070d'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        const tt = t - makroBas, y = 760 + tt * 26, R = 230;
        damla(ctx, 540, y, R, 1, 0);
        // damla içinde pencere yansıması (ters)
        ctx.save(); ctx.beginPath(); ctx.arc(540, y + R * 0.2, R * 0.92, 0, TAU); ctx.clip();
        ctx.fillStyle = 'rgba(255,225,180,0.55)'; ctx.fillRect(560, y - 60, 120, 170);
        ctx.strokeStyle = 'rgba(20,30,50,0.6)'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(620, y - 60); ctx.lineTo(620, y + 110); ctx.moveTo(560, y + 25); ctx.lineTo(680, y + 25); ctx.stroke();
        ctx.restore();
        ctx.restore();
      }
      // geniş plan: sabah ışığı, derin nefes, geri çekilme
      if (genisU > 0) {
        const tt = t - genisBas;
        ctx.save(); ctx.globalAlpha = genisU;
        if (genisU < 1) ctx.filter = `blur(${((1 - genisU) * 12).toFixed(1)}px)`;
        const nefes = 0.5 + 0.5 * Math.sin(tt * 1.2 - 1.2);
        oda(ctx, t, lerp(0.6, 1, clamp(tt / 3)), { cx: lerp(640, 540, ease.out(clamp(tt / 6))), cy: lerp(960, 1010, ease.out(clamp(tt / 6))), z: lerp(1.5, 1.0, ease.out(clamp(tt / 6))) }, { egik: lerp(0.5, 0.15, clamp(tt / 3)), nefes });
        ctx.restore();
      }
    },
  });

  // ================= 5) KAPANIŞ =================
  VIDEO.sahne('kapanis', {
    ciz(ctx, S) {
      const t = S.t;
      const g = ctx.createRadialGradient(540, 900, 50, 540, 900, 1200);
      g.addColorStop(0, '#0d1a36'); g.addColorStop(1, '#030612');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // sinir ağı
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const N = A.logoAg, P = N.map(([x, y, f]) => [x + Math.sin(t * 0.3 + f) * 20, y + Math.cos(t * 0.25 + f) * 20]);
      for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
        const d = Math.hypot(P[i][0] - P[j][0], P[i][1] - P[j][1]);
        if (d > 230) continue;
        ctx.strokeStyle = `rgba(${TURKUAZ},${0.12 * (1 - d / 230)})`; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(...P[i]); ctx.lineTo(...P[j]); ctx.stroke();
        const u = (t * 0.5 + (i * 7 + j) * 0.13) % 3;
        if (u < 1) { ctx.globalAlpha = Math.sin(Math.PI * u) * 0.8; ctx.drawImage(parilti(TURKUAZ), lerp(P[i][0], P[j][0], u) - 8, lerp(P[i][1], P[j][1], u) - 8, 16, 16); ctx.globalAlpha = 1; }
      }
      for (const p of P) { ctx.globalAlpha = 0.6; ctx.drawImage(parilti(TURKUAZ), p[0] - 10, p[1] - 10, 20, 20); }
      ctx.restore();
      // logo: küre (atlas) + içinde profil
      const lb = S.at(1, 0) - 0.6, la = ramp(t, lb, lb + 1.4);
      const cX = 540, cY = 820, R = 190;
      const ciz = ramp(t, 0.2, 2.2);
      ctx.save();
      ctx.strokeStyle = `rgba(${TURKUAZ},0.95)`; ctx.lineWidth = 6; ctx.shadowColor = `rgba(${TURKUAZ},0.8)`; ctx.shadowBlur = 24;
      ctx.beginPath(); ctx.arc(cX, cY, R, -Math.PI / 2, -Math.PI / 2 + TAU * ciz); ctx.stroke();
      ctx.lineWidth = 2.5; ctx.globalAlpha = ramp(t, 0.8, 2.2);
      for (const k of [0.35, 0.7]) { ctx.beginPath(); ctx.ellipse(cX, cY, R * k, R, 0, 0, TAU); ctx.stroke(); }
      for (const k of [-0.5, 0, 0.5]) { const yy = cY + k * R, rr = Math.sqrt(1 - k * k) * R; ctx.beginPath(); ctx.ellipse(cX, yy, rr, rr * 0.18, 0, 0, TAU); ctx.stroke(); }
      ctx.restore();
      ctx.save(); ctx.globalAlpha = ramp(t, 1.2, 2.6);
      ctx.translate(cX - 10, cY + 10); ctx.scale(2.6, 2.6);
      ctx.fillStyle = 'rgba(8,16,34,0.85)'; ctx.fill(BAS);
      ctx.strokeStyle = `rgba(${TURKUAZ},0.9)`; ctx.lineWidth = 1.2; ctx.stroke(BAS);
      ctx.restore();
      // yazı
      const ya = la;
      if (ya > 0) {
        ctx.save(); ctx.globalAlpha = ya;
        const harf = 'İNSAN ATLASI'.split('');
        ctx.font = `800 84px ${FONT}`; ctx.letterSpacing = '14px';
        const w = ctx.measureText(harf.join('')).width;
        let x = W / 2 - w / 2;
        harf.forEach((h, i) => {
          const a = ramp(t, lb + i * 0.06, lb + i * 0.06 + 0.5);
          yazi(ctx, h, x + ctx.measureText(h).width / 2, 1130 + (1 - a) * 20, { boyut: 84, agirlik: 800, alfa: a, golgeRenk: `rgba(${TURKUAZ},0.6)`, golgeBulanik: 26 });
          x += ctx.measureText(h).width + 14;
        });
        ctx.restore();
      }
    },
  });
})();
