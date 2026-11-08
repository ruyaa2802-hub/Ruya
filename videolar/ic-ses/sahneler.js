/* "Beynin neden kendi kendine konuşur?" — İç ses
 * Göz → göz bebeğinden beyne dalış → beynin içinde yaşayan minyatür "iç ses" karakteri → nöronlarda kelimeler → dışarı çıkış → kameraya gülümseme.
 * Minyatür karakter = insanın küçük kopyası: aynı profil (STUDIO.KR), turkuaz ceket, sıcak ten.
 */
(function () {
  const { W, H, clamp, lerp, ease, ramp, pencere, rng, fbm, tuval, gurultuDokusu, yazi, FONT } = STUDIO.R;
  const { kamera, parilti, bokeh, hap, halkalar, TAU } = STUDIO.K;
  const { BAS, SAC, oturan, yanKisi, yakinYuz } = STUDIO.KR;
  const A = {};
  const TRK = '47,211,198', MOR = '160,110,255', ALTIN = '255,196,110';
  const CEKET = '#145a62', TEN0 = '#e9b89a', TEN1 = '#a8705a';

  // ---------- Minyatür karakter ----------
  function basBoya(ctx, olcek) {
    const g = ctx.createLinearGradient(50, -20, -35, 20);
    g.addColorStop(0, TEN0); g.addColorStop(0.6, TEN1); g.addColorStop(1, '#4a2a22');
    ctx.save(); ctx.translate(0.7, -0.3); ctx.fillStyle = `rgba(${TRK},0.9)`; ctx.fill(BAS); ctx.restore();
    ctx.fillStyle = g; ctx.fill(BAS);
    ctx.fillStyle = '#1a120e'; ctx.fill(SAC); ctx.save(); ctx.translate(-2, -1.5); ctx.scale(1.05, 1.07); ctx.fill(SAC); ctx.restore();
    ctx.fillStyle = '#1a120e'; ctx.beginPath(); ctx.ellipse(31.5, -8.5, 1.6, 1.2, 0, 0, TAU); ctx.fill();   // göz
    ctx.strokeStyle = '#1a120e'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(26, -15); ctx.quadraticCurveTo(32, -17.5, 38, -14.5); ctx.stroke();
  }
  function mini(ctx, x, y, h, p) {
    const r = yanKisi(ctx, x + h * 0.008, y, h, p, `rgba(${TRK},0.95)`);
    yanKisi(ctx, x - h * 0.005, y, h, p, 'rgba(160,110,255,0.5)');
    const k = yanKisi(ctx, x, y, h, p, CEKET);
    ctx.save(); ctx.translate(k.bas[0], k.bas[1]); ctx.rotate((p.egim || 0) * 0.3); ctx.scale(0.125 * k.u, 0.125 * k.u); basBoya(ctx); ctx.restore();
    // eller ten rengi
    ctx.fillStyle = TEN1; ctx.beginPath(); ctx.arc(k.el[0], k.el[1], 2.6 * k.u, 0, TAU); ctx.fill();
    return k;
  }
  function miniOturan(ctx, x, y, s, p) {
    oturan(ctx, x + 3, y - 2, s, p, `rgba(${TRK},0.9)`);
    const k = oturan(ctx, x, y, s, p, CEKET);
    const e = p.egik ?? 0.3, n = p.nefes || 0;
    ctx.save(); ctx.translate(k.bas[0], k.bas[1]); ctx.rotate(0.18 + e * 0.38 - n * 0.06); ctx.scale(0.92 * s, 0.92 * s); basBoya(ctx); ctx.restore();
    return k;
  }

  // ---------- Kameraya bakan yüz (final) ----------
  function onYuz(ctx, cx, cy, s, t, gul, kirp) {
    ctx.save(); ctx.translate(cx, cy); ctx.scale(s / 100, s / 100);
    // yaka ve boyun
    ctx.fillStyle = CEKET; ctx.beginPath(); ctx.moveTo(-90, 150); ctx.quadraticCurveTo(-40, 70, 0, 92); ctx.quadraticCurveTo(40, 70, 90, 150); ctx.lineTo(90, 220); ctx.lineTo(-90, 220); ctx.fill();
    ctx.strokeStyle = `rgba(${TRK},0.8)`; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = TEN1; ctx.fillRect(-18, 55, 36, 40);
    // kulaklar
    ctx.fillStyle = TEN1; for (const k of [-1, 1]) { ctx.beginPath(); ctx.ellipse(k * 47, 5, 9, 15, 0, 0, TAU); ctx.fill(); }
    // yüz
    const g = ctx.createRadialGradient(-12, -10, 8, 0, 5, 75);
    g.addColorStop(0, '#f3c9ad'); g.addColorStop(0.7, TEN0); g.addColorStop(1, TEN1);
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 4, 46, 60, 0, 0, TAU); ctx.fill();
    // turkuaz kenar ışığı
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, 4, 46, 60, 0, 0, TAU); ctx.clip();
    const kg = ctx.createLinearGradient(46, 0, 25, 0); kg.addColorStop(0, `rgba(${TRK},0.55)`); kg.addColorStop(1, `rgba(${TRK},0)`); ctx.fillStyle = kg; ctx.fillRect(0, -60, 50, 130);
    ctx.restore();
    // saç
    ctx.fillStyle = '#1a120e';
    ctx.beginPath(); ctx.moveTo(-50, 0); ctx.quadraticCurveTo(-58, -62, 0, -66); ctx.quadraticCurveTo(56, -64, 50, -6); ctx.quadraticCurveTo(44, -34, 18, -38); ctx.quadraticCurveTo(-8, -26, -32, -36); ctx.quadraticCurveTo(-44, -26, -50, 0); ctx.fill();
    // kaşlar
    ctx.strokeStyle = '#2a1a12'; ctx.lineWidth = 4.5; ctx.lineCap = 'round';
    for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(k * 8, -18 - gul * 2); ctx.quadraticCurveTo(k * 20, -24 - gul * 2, k * 32, -19); ctx.stroke(); }
    // gözler
    for (const k of [-1, 1]) {
      const ex = k * 19, ey = -4;
      ctx.fillStyle = '#f6f2ee'; ctx.beginPath(); ctx.ellipse(ex, ey, 10, 6.2 * (1 - kirp), 0, 0, TAU); ctx.fill();
      if (kirp < 0.8) {
        ctx.save(); ctx.beginPath(); ctx.ellipse(ex, ey, 10, 6.2 * (1 - kirp), 0, 0, TAU); ctx.clip();
        ctx.fillStyle = '#4a2c1c'; ctx.beginPath(); ctx.arc(ex, ey, 5.4, 0, TAU); ctx.fill();
        ctx.fillStyle = '#0c0806'; ctx.beginPath(); ctx.arc(ex, ey, 2.6, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + 1.8, ey - 1.8, 1.4, 0, TAU); ctx.fill();
        ctx.restore();
      }
      ctx.strokeStyle = '#2a1a12'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.ellipse(ex, ey, 10.5, 6.5 * (1 - kirp) + 0.3, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
      ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(80,40,30,0.5)'; ctx.beginPath(); ctx.ellipse(ex, ey + 1 + gul, 9, 4, 0, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
    }
    // burun
    ctx.strokeStyle = 'rgba(120,70,50,0.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(3, 2); ctx.quadraticCurveTo(7, 16, 2, 20); ctx.stroke();
    ctx.fillStyle = 'rgba(120,60,45,0.45)'; for (const k of [-1, 1]) { ctx.beginPath(); ctx.ellipse(k * 6, 21, 3, 1.6, 0, 0, TAU); ctx.fill(); }
    // ağız (gülümseme)
    ctx.strokeStyle = '#8a3c34'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-14, 36 - gul * 3); ctx.quadraticCurveTo(0, 38 + gul * 6, 14, 36 - gul * 3); ctx.stroke();
    ctx.fillStyle = 'rgba(190,90,80,0.35)'; ctx.beginPath(); ctx.ellipse(0, 39 + gul * 2, 10, 2.5, 0, 0, TAU); ctx.fill();
    // yanak allığı
    ctx.fillStyle = `rgba(230,120,110,${0.05 + 0.06 * gul})`; for (const k of [-1, 1]) { ctx.beginPath(); ctx.ellipse(k * 26, 20, 9, 6, 0, 0, TAU); ctx.fill(); }
    ctx.restore();
  }

  // ---------- Gerçekçi göz (kanca) ----------
  function gozCiz(ctx, cx, cy, R, t, kapak, bebek) {
    ctx.save(); ctx.translate(cx, cy);
    // ten
    const tg = ctx.createRadialGradient(0, 0, R * 0.4, 0, 0, R * 2.4);
    tg.addColorStop(0, '#b97d64'); tg.addColorStop(0.6, '#7a4a3a'); tg.addColorStop(1, '#1a0e0a');
    ctx.fillStyle = tg; ctx.fillRect(-W, -H, W * 2, H * 2);
    ctx.drawImage(A.ciltDoku, -W, -H, W * 2, H * 2);
    // göz akı (badem)
    const yol = new Path2D(), bw = R * 1.9, bh = R * 0.95 * (1 - kapak);
    yol.moveTo(-bw, 0); yol.bezierCurveTo(-bw * 0.5, -bh * 1.3, bw * 0.5, -bh * 1.3, bw, 0); yol.bezierCurveTo(bw * 0.5, bh * 1.15, -bw * 0.5, bh * 1.15, -bw, 0);
    ctx.save(); ctx.clip(yol);
    const sg = ctx.createRadialGradient(0, 0, R * 0.3, 0, 0, bw);
    sg.addColorStop(0, '#f4ede8'); sg.addColorStop(0.75, '#e2cfc8'); sg.addColorStop(1, '#b88a82');
    ctx.fillStyle = sg; ctx.fillRect(-bw, -R * 2, bw * 2, R * 4);
    ctx.drawImage(A.damarlar, -bw, -R, bw * 2, R * 2);
    // iris
    ctx.save(); ctx.translate(Math.sin(t * 0.7) * R * 0.04, 0);
    ctx.drawImage(A.iris, -R * 0.62, -R * 0.62, R * 1.24, R * 1.24);
    ctx.fillStyle = '#030303'; ctx.beginPath(); ctx.arc(0, 0, R * 0.62 * bebek, 0, TAU); ctx.fill();
    // ışık yansımaları
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.ellipse(R * 0.22, -R * 0.2, R * 0.09, R * 0.12, 0.3, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(160,230,240,0.5)'; ctx.beginPath(); ctx.ellipse(-R * 0.18, R * 0.24, R * 0.05, R * 0.03, 0, 0, TAU); ctx.fill();
    ctx.restore();
    // kapak gölgesi
    const kg = ctx.createLinearGradient(0, -bh * 1.2, 0, -bh * 0.3); kg.addColorStop(0, 'rgba(40,15,10,0.7)'); kg.addColorStop(1, 'rgba(40,15,10,0)');
    ctx.fillStyle = kg; ctx.fillRect(-bw, -bh * 1.3, bw * 2, bh);
    ctx.restore();
    // kirpikler
    ctx.strokeStyle = '#120a08'; ctx.lineCap = 'round';
    for (let k = 0; k <= 28; k++) {
      const u = k / 28, x = lerp(-bw * 0.95, bw * 0.95, u), y = -bh * 1.3 * 4 * u * (1 - u) * 0.75;
      const a = -Math.PI / 2 + (u - 0.5) * 1.6;
      ctx.lineWidth = R * 0.025; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a) * R * 0.2, y + Math.sin(a) * R * 0.2, x + Math.cos(a + 0.4) * R * 0.32, y + Math.sin(a + 0.4) * R * 0.32 - R * 0.05); ctx.stroke();
    }
    ctx.lineWidth = R * 0.05; ctx.strokeStyle = 'rgba(60,25,18,0.9)'; ctx.stroke(yol);
    ctx.restore();
  }

  // ---------- Beyin içi ortam ----------
  function beyinIci(ctx, t, camX, z = 1, isik = 1) {
    const g = ctx.createRadialGradient(540, 900, 50, 540, 900, 1300);
    g.addColorStop(0, '#2a1440'); g.addColorStop(0.6, '#120a24'); g.addColorStop(1, '#05030c');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.translate(540, 900); ctx.scale(z, z); ctx.translate(-540, -900);
    // beyin dokusu duvarları (parallaks, ortası derin ve karanlık)
    ctx.save(); ctx.globalAlpha = 0.6; ctx.filter = 'blur(1.5px)';
    const ox = -(((camX * 0.35) % 2160) + 2160) % 2160;
    for (let rep = 0; rep < 4; rep++) {
      ctx.save(); ctx.translate(ox + rep * 1080 + (rep % 2 ? 1080 : 0), 0); if (rep % 2) ctx.scale(-1, 1);
      ctx.drawImage(A.doku, 0, -60, 1080, 2040); ctx.restore();
    }
    ctx.restore();
    const tg = ctx.createRadialGradient(540, 860, 80, 540, 900, 900);
    tg.addColorStop(0, 'rgba(8,3,18,0.95)'); tg.addColorStop(0.5, 'rgba(14,6,30,0.7)'); tg.addColorStop(1, 'rgba(20,6,30,0.05)');
    ctx.fillStyle = tg; ctx.fillRect(-200, -200, W + 400, H + 400);
    // sinir ağı
    ctx.save(); ctx.translate(-camX * 0.6, 0); ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(${TRK},${0.12 * isik})`; ctx.lineWidth = 2;
    ctx.beginPath(); for (const [i, j] of A.kenar) { ctx.moveTo(...A.ag[i]); ctx.lineTo(...A.ag[j]); } ctx.stroke();
    for (const [i, j, f] of A.kenar) {
      const u = ((t * (0.35 + f * 0.6) + f * 9) % 1.8); if (u > 1) continue;
      const p = A.ag[i], q = A.ag[j]; ctx.globalAlpha = Math.sin(Math.PI * u) * 0.9 * isik;
      ctx.drawImage(parilti(f > 0.5 ? TRK : MOR), lerp(p[0], q[0], u) - 12, lerp(p[1], q[1], u) - 12, 24, 24);
    }
    ctx.globalAlpha = 0.6 * isik; for (const p of A.ag) ctx.drawImage(parilti(TRK), p[0] - 9, p[1] - 9, 18, 18);
    ctx.restore();
    ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.35; ctx.drawImage(A.sis, -200 - (t * 25) % 400, 1100, 1600, 700); ctx.restore();
  }
  // ışıklı sinir köprüsü (karakterin yürüdüğü yol)
  function kopru(ctx, t, camX, y) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 3; k++) {
      ctx.strokeStyle = `rgba(${k ? MOR : TRK},${0.5 - k * 0.12})`; ctx.lineWidth = 14 - k * 4;
      ctx.beginPath(); for (let x = -50; x <= W + 50; x += 20) { const yy = y + Math.sin((x + camX) / 180 + k) * (6 + k * 6); x < -40 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy); } ctx.stroke();
    }
    for (let k = 0; k < 14; k++) { const x = ((k * 97 - camX * 1.0 - t * 40) % (W + 100) + W + 100) % (W + 100) - 50; ctx.globalAlpha = 0.8; ctx.drawImage(parilti(TRK), x - 16, y - 16, 32, 32); }
    ctx.restore();
  }
  // konuşma balonu
  function balon(ctx, metin, x, y, a, s = 1) {
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha = clamp(a); ctx.translate(x, y); ctx.scale(s, s);
    ctx.font = `700 46px ${FONT}`;
    const w = ctx.measureText(metin).width + 70, h = 100;
    ctx.shadowColor = `rgba(${TRK},0.8)`; ctx.shadowBlur = 30;
    ctx.fillStyle = 'rgba(14,20,40,0.82)'; ctx.strokeStyle = `rgba(${TRK},0.95)`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 50); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.moveTo(-20, h / 2 - 2); ctx.lineTo(-38, h / 2 + 34); ctx.lineTo(8, h / 2 - 2); ctx.closePath(); ctx.fillStyle = 'rgba(14,20,40,0.82)'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(-20, h / 2); ctx.lineTo(-38, h / 2 + 34); ctx.lineTo(8, h / 2); ctx.stroke();
    yazi(ctx, metin, 0, 3, { boyut: 46, agirlik: 700, renk: '#f2fbff', golgeBulanik: 6 });
    ctx.restore();
  }

  VIDEO.sahne('_ortak', {
    hazirla() {
      const r = rng(19);
      // iris dokusu
      const ir = tuval(600, 600), ix = ir.getContext('2d');
      const ig = ix.createRadialGradient(300, 300, 40, 300, 300, 300);
      ig.addColorStop(0, '#3a2a12'); ig.addColorStop(0.35, '#7a6a2a'); ig.addColorStop(0.7, '#2f6a6a'); ig.addColorStop(0.95, '#173a44'); ig.addColorStop(1, '#0a1418');
      ix.fillStyle = ig; ix.beginPath(); ix.arc(300, 300, 300, 0, TAU); ix.fill();
      for (let k = 0; k < 900; k++) {
        const a = r() * TAU, r0 = 60 + r() * 40, r1 = 200 + r() * 95;
        ix.strokeStyle = r() < 0.5 ? `rgba(220,200,140,${0.15 + r() * 0.2})` : `rgba(10,30,30,${0.2 + r() * 0.3})`; ix.lineWidth = 1 + r() * 2.5;
        ix.beginPath(); ix.moveTo(300 + Math.cos(a) * r0, 300 + Math.sin(a) * r0); ix.quadraticCurveTo(300 + Math.cos(a + 0.05) * (r0 + r1) / 2, 300 + Math.sin(a + 0.05) * (r0 + r1) / 2, 300 + Math.cos(a) * r1, 300 + Math.sin(a) * r1); ix.stroke();
      }
      ix.strokeStyle = 'rgba(5,10,12,0.9)'; ix.lineWidth = 18; ix.beginPath(); ix.arc(300, 300, 292, 0, TAU); ix.stroke();
      A.iris = ir;
      const dm = tuval(800, 400), dx = dm.getContext('2d');
      dx.strokeStyle = 'rgba(190,60,60,0.25)'; dx.lineWidth = 1.5;
      for (let k = 0; k < 26; k++) { const kenar = r() < 0.5 ? 0 : 800, y = r() * 400; dx.beginPath(); dx.moveTo(kenar, y); let x = kenar, yy = y; for (let s = 0; s < 8; s++) { x += (kenar ? -1 : 1) * (20 + r() * 25); yy += (r() - 0.5) * 30; dx.lineTo(x, yy); } dx.stroke(); }
      A.damarlar = dm;
      A.ciltDoku = gurultuDokusu(270, 480, 18, 7, f => [255, 220, 200, (f - 0.5) * 60 + 10], 4);
      // gerçekçi beyin dokusu: gürültü eş-yükselti çizgilerinden kıvrım (girus/sulkus) deseni + ışıklandırma
      {
        const w = 540, h = 960, c = tuval(w, h), x = c.getContext('2d'), im = x.createImageData(w, h);
        const yuk = new Float32Array(w * h);
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
          const wx = fbm(i / 140, j / 140, 3, 3) * 3, wy = fbm(i / 140 + 9, j / 140, 4, 3) * 3;
          const n = fbm(i / 85 + wx, j / 85 + wy, 7, 4);
          yuk[j * w + i] = Math.pow(Math.abs(Math.sin(n * 26)), 0.55);
        }
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
          const k = j * w + i, v = yuk[k];
          const dx = yuk[k + (i < w - 1 ? 1 : 0)] - yuk[k - (i > 0 ? 1 : 0)], dy = yuk[k + (j < h - 1 ? w : 0)] - yuk[k - (j > 0 ? w : 0)];
          const isik = clamp(0.55 + (-dx * 0.6 - dy * 0.8) * 2.2), par = Math.pow(clamp(isik - 0.6) * 2.5, 3);
          const d = v * (0.35 + 0.65 * isik);
          im.data[k * 4] = clamp(d * 0.78 + par * 0.5) * 255;
          im.data[k * 4 + 1] = clamp(d * 0.42 + par * 0.45) * 255;
          im.data[k * 4 + 2] = clamp(d * 0.72 + par * 0.55) * 255;
          im.data[k * 4 + 3] = 255;
        }
        x.putImageData(im, 0, 0);
        A.doku = c;
      }
      A.sis = gurultuDokusu(600, 300, 100, 5, f => [190, 140, 230, clamp((f - 0.45) * 2.4) * 110], 5);
      A.ag = Array.from({ length: 70 }, () => [r() * 1800 - 300, 200 + r() * 1500]);
      A.kenar = []; A.ag.forEach((p, i) => A.ag.forEach((q, j) => { if (j > i && Math.hypot(p[0] - q[0], p[1] - q[1]) < 260) A.kenar.push([i, j, r()]); }));
      A.harfler = Array.from({ length: 60 }, () => ({ h: 'abcçdefgğhıijklmnoöprsştuüvyz'[Math.floor(r() * 29)], f: r(), y: r() }));
    },
    ciz() { },
  });

  // ================= 1) KANCA: GÖZ → BEYİN =================
  VIDEO.sahne('kanca', {
    ciz(ctx, S) {
      const t = S.t;
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      const gozA = ramp(t, 0.35, 0.9);
      const dal = ease.in(ramp(t, S.at(1, 0.15), S.d + 0.3, x => x));
      if (gozA > 0 && dal < 0.97) {
        const kirp = t > 1.1 && t < 1.35 ? Math.sin((t - 1.1) / 0.25 * Math.PI) : 0;
        const R = lerp(260, 260 * 30, dal);
        ctx.save(); ctx.globalAlpha = gozA;
        gozCiz(ctx, 540, lerp(900, 900, dal), R, t, kirp, lerp(0.42, 0.55, ramp(t, 0.6, S.at(1, 0.1))));
        ctx.restore();
      }
      // göz bebeğinin içinden: ışık tüneli
      if (dal > 0.55) {
        const u = ramp(dal, 0.55, 1);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const r = rng(4);
        for (let k = 0; k < 140; k++) {
          const a = r() * TAU, d = ((r() + t * (0.6 + r())) % 1), r0 = 30 + d * d * 1200, r1 = r0 + 40 + d * 300;
          ctx.strokeStyle = `rgba(${r() < 0.5 ? TRK : MOR},${0.7 * d * u})`; ctx.lineWidth = 1 + d * 4;
          ctx.beginPath(); ctx.moveTo(540 + Math.cos(a) * r0, 900 + Math.sin(a) * r0); ctx.lineTo(540 + Math.cos(a) * r1, 900 + Math.sin(a) * r1); ctx.stroke();
        }
        ctx.globalAlpha = u; ctx.drawImage(parilti('200,160,255'), 540 - 400 * u, 900 - 400 * u, 800 * u, 800 * u);
        ctx.restore();
      }
    },
  });

  // ================= 2) İÇ SES: BEYNİN İÇİNDE YÜRÜYEN KARAKTER =================
  const DUSUNCE = ['Acaba bugün ne olacak?', 'Dün neden öyle söyledim?', 'Ya yarın işler ters giderse?'];
  VIDEO.sahne('icses', {
    ciz(ctx, S) {
      const t = S.t;
      const oturma = 1 - ramp(t, 0.6, 1.4);             // önce oturuyor ve kendi kendine konuşuyor, sonra kalkıp yürüyor
      const camX = Math.max(0, t - 1.2) * 120;
      const z = lerp(1.2, 1.0, ease.out(clamp(t / 1.2)));
      beyinIci(ctx, t, camX, z);
      kopru(ctx, t, camX, 1290);
      if (oturma > 0.5) {
        miniOturan(ctx, 470, 1290 - 4, 0.62, { egik: 0.25, nefes: 0.5 + 0.5 * Math.sin(t * 6) });
      } else {
        mini(ctx, 520, 1292, 430, { faz: (t - 1.2) * 5.5, yuru: 1 });
      }
      // konuşma balonları (her düşünce kendi cümlesiyle)
      for (let k = 0; k < 3; k++) {
        const bas = S.at(k, 0) - 0.05, son = k < 2 ? S.at(k + 1, 0) - 0.02 : S.d + 1;
        const a = ramp(t, bas, bas + 0.25, ease.outBack) * (1 - ramp(t, son - 0.15, son));
        const yuk = ramp(t, son - 0.15, son) * 120;
        balon(ctx, DUSUNCE[k], 600 + (k - 1) * 40, 760 - yuk - k * 0, a, lerp(0.8, 1, clamp((t - bas) * 4)));
      }
      // başlık (kanca ekran yazısı)
      const ba = pencere(t, -0.2, S.at(1, 0.2), 0.35);
      if (ba > 0) {
        yazi(ctx, 'ZİHNİNDEKİ SESİN', W / 2, 300, { boyut: 64, agirlik: 800, alfa: ba, golgeRenk: `rgba(${TRK},0.8)`, golgeBulanik: 30 });
        yazi(ctx, 'SAHİBİ KİM?', W / 2, 385, { boyut: 82, agirlik: 800, alfa: ba, renk: '#FFD54A', golgeBulanik: 30 });
      }
      bokeh(ctx, t, 22, 5, TRK, [3, 10], 0.25, 8);
    },
  });

  // ================= 3) BİLİM: NÖRONLAR VE KELİMELER =================
  VIDEO.sahne('bilim', {
    ciz(ctx, S) {
      const t = S.t;
      const kelime = ramp(t, S.at(0, 0.35), S.at(0, 0.7));
      const kafa = ramp(t, S.at(1, 0.0) - 0.3, S.at(1, 0.0) + 0.5);
      // a) nöronlar yakın plan
      if (kafa < 1) {
        ctx.save(); ctx.globalAlpha = 1 - kafa;
        const g = ctx.createRadialGradient(540, 900, 50, 540, 900, 1200); g.addColorStop(0, '#1c0f34'); g.addColorStop(1, '#04020a');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        const z = lerp(1.0, 1.25, ease.inOut(clamp(t / S.d)));
        ctx.save(); kamera(ctx, 540, 900, z, Math.sin(t * 0.3) * 0.03);
        const somalar = [[300, 620], [800, 980], [380, 1320]];
        const akson = [[[300, 620], [520, 760], [800, 980]], [[800, 980], [620, 1180], [380, 1320]]];
        ctx.lineCap = 'round';
        // dendritler
        const r = rng(8);
        for (const [sx, sy] of somalar) for (let d = 0; d < 9; d++) {
          let x = sx, y = sy, a = r() * TAU; ctx.strokeStyle = 'rgba(150,110,220,0.55)'; ctx.lineWidth = 10;
          ctx.beginPath(); ctx.moveTo(x, y);
          for (let s = 0; s < 6; s++) { a += (r() - 0.5) * 0.8; x += Math.cos(a) * 45; y += Math.sin(a) * 45; ctx.lineTo(x, y); ctx.lineWidth *= 0.8; }
          ctx.stroke();
        }
        for (const yol of akson) { ctx.strokeStyle = 'rgba(170,130,240,0.7)'; ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(...yol[0]); ctx.quadraticCurveTo(...yol[1], ...yol[2]); ctx.stroke(); }
        for (const [sx, sy] of somalar) { const sg = ctx.createRadialGradient(sx - 15, sy - 15, 5, sx, sy, 70); sg.addColorStop(0, '#e7c6ff'); sg.addColorStop(1, '#5a3a9a'); ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, 60, 0, TAU); ctx.fill(); }
        // aksiyon potansiyeli: ışık dalgaları
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        akson.forEach((yol, i) => {
          const u = ((t * 0.7 + i * 0.5) % 1.3); if (u > 1) return;
          const v = 1 - u, px = v * v * yol[0][0] + 2 * v * u * yol[1][0] + u * u * yol[2][0], py = v * v * yol[0][1] + 2 * v * u * yol[1][1] + u * u * yol[2][1];
          ctx.drawImage(parilti(TRK), px - 70, py - 70, 140, 140);
          halkalar(ctx, px, py, t * 2 + i, { renk: TRK, maxR: 90, alfa: 0.5, n: 2, kalin: 3 });
        });
        for (const [sx, sy] of somalar) { ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 4 + sx); ctx.drawImage(parilti(MOR), sx - 110, sy - 110, 220, 220); }
        ctx.restore();
        ctx.restore();
        // düşünce → kelime: harfler akıp kelimelere dizilir
        if (kelime > 0) {
          const kelimeler = ['ACABA', 'NEDEN', 'YARIN'];
          kelimeler.forEach((k, i) => {
            const a = ramp(kelime, i * 0.25, i * 0.25 + 0.5);
            if (a <= 0) return;
            const x = 540, y = 360 + i * 120;
            [...k].forEach((h, j) => {
              const hx = x + (j - (k.length - 1) / 2) * 70, hy = y;
              const sx = 300 + i * 250, sy = 900 + j * 40;
              yazi(ctx, h, lerp(sx, hx, ease.out(a)), lerp(sy, hy, ease.out(a)), { boyut: 72, agirlik: 800, alfa: a, renk: '#eafcff', golgeRenk: `rgba(${TRK},0.9)`, golgeBulanik: 24 });
            });
          });
        }
        ctx.restore();
      }
      // b) sessiz konuşma: kapalı ağız, kafanın içinde dönen kelimeler
      if (kafa > 0) {
        ctx.save(); ctx.globalAlpha = kafa;
        const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#0a0d1c'); g.addColorStop(1, '#14082a');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        const K = 10, ox = 430, oy = 880;
        yakinYuz(ctx, t, { kenar: TRK, on: '160,120,230', onGuc: 0.35, egim: 0 }, { K, ox, oy });
        // kafatası içinde kelime halkası
        ctx.save(); ctx.translate(ox, oy); ctx.scale(K, K); ctx.clip(BAS); ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(parilti(MOR), ox - 380, oy - 560, 760, 760);
        const cumle = 'iç konuşma · kelimeler · düşünceler · ';
        ctx.font = `700 42px ${FONT}`; ctx.fillStyle = `rgba(${TRK},0.95)`; ctx.textAlign = 'center';
        for (let i = 0; i < cumle.length; i++) { const a = t * 0.8 + i * (TAU / cumle.length); ctx.save(); ctx.translate(ox + 20 + Math.cos(a) * 230, oy - 230 + Math.sin(a) * 160); ctx.rotate(a + Math.PI / 2); ctx.fillText(cumle[i], 0, 0); ctx.restore(); }
        ctx.restore();
        // ağzın önünde ses yok: sessizlik işareti
        const sa = ramp(t, S.at(1, 0.3), S.at(1, 0.6));
        if (sa > 0) {
          const mx = ox + 50 * K + 60, my = oy + 24 * K;
          ctx.save(); ctx.globalAlpha = kafa * sa; ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 6; ctx.setLineDash([10, 12]);
          for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.arc(mx, my, k * 40, -0.6, 0.6); ctx.stroke(); }
          ctx.setLineDash([]); ctx.strokeStyle = '#ff6b6b'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(mx + 10, my - 120); ctx.lineTo(mx + 120, my + 120); ctx.stroke();
          ctx.restore();
        }
        ctx.restore();
      }
      bokeh(ctx, t, 18, 12, MOR, [3, 9], 0.2, 6);
    },
  });

  // ================= 4) FİNAL: DIŞARI ÇIKIŞ, DÜŞÜNCE BALONLARI, GÜLÜMSEME =================
  function resimBalon(ctx, x, y, tur, a) {
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha = clamp(a); ctx.translate(x, y); ctx.scale(1.35, 1.35);
    ctx.shadowColor = `rgba(${ALTIN},0.7)`; ctx.shadowBlur = 24;
    ctx.fillStyle = 'rgba(20,16,30,0.85)'; ctx.strokeStyle = `rgba(${ALTIN},0.9)`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(-90, -70, 180, 140, 30); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
    ctx.save(); ctx.beginPath(); ctx.roundRect(-80, -60, 160, 120, 22); ctx.clip();
    if (tur === 0) { const g = ctx.createLinearGradient(0, -60, 0, 60); g.addColorStop(0, '#ffb070'); g.addColorStop(1, '#5a3a6a'); ctx.fillStyle = g; ctx.fillRect(-80, -60, 160, 120); ctx.fillStyle = '#ffe2a0'; ctx.beginPath(); ctx.arc(30, -10, 22, 0, TAU); ctx.fill(); ctx.fillStyle = '#2a1a30'; ctx.beginPath(); ctx.moveTo(-80, 60); ctx.lineTo(-30, 0); ctx.lineTo(10, 40); ctx.lineTo(50, 10); ctx.lineTo(80, 60); ctx.fill(); }
    else { ctx.fillStyle = '#1f4a5a'; ctx.fillRect(-80, -60, 160, 120); ctx.fillStyle = '#f2d39a'; ctx.beginPath(); ctx.moveTo(-40, 10); ctx.lineTo(0, -30); ctx.lineTo(40, 10); ctx.fill(); ctx.fillRect(-30, 10, 60, 40); ctx.fillStyle = '#1f4a5a'; ctx.fillRect(-8, 25, 16, 25); }
    ctx.restore(); ctx.restore();
  }
  VIDEO.sahne('final', {
    ciz(ctx, S) {
      const t = S.t;
      const cik = ease.out(ramp(t, 0, 1.4, x => x));                 // hızla dışarı
      const yuzBas = S.at(2, 0) - 0.4, yuzU = ramp(t, yuzBas, yuzBas + 0.8);
      if (yuzU < 1) {
        // oda + insan
        const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0a1020'); g.addColorStop(1, '#03050a');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        const z = lerp(6, 1.45, cik);
        ctx.save(); kamera(ctx, lerp(640, 520, cik), lerp(980, 1080, cik), z);
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5; ctx.drawImage(parilti('120,150,220'), 760 - 600, 700 - 600, 1200, 1200); ctx.restore();
        ctx.fillStyle = '#0d1424'; ctx.fillRect(-200, 1380, 1500, 200);
        oturan(ctx, 430 + 4, 1380 - 2, 0.85, { egik: 0.2, nefes: 0.5 + 0.5 * Math.sin(t * 1.3) }, `rgba(${TRK},0.75)`);
        const k = oturan(ctx, 430, 1380, 0.85, { egik: 0.2, nefes: 0.5 + 0.5 * Math.sin(t * 1.3) }, '#05070d');
        ctx.restore();
        // beyin parıltısı ve dışarı taşan ışık
        if (cik < 1) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1 - cik; ctx.drawImage(parilti(MOR), 540 - 700, 900 - 700, 1400, 1400); ctx.restore(); }
        // düşünce balonları: kelimeler ve görüntüler
        const hx = (k.bas[0] - lerp(640, 520, cik)) * z + W / 2, hy = (k.bas[1] - lerp(980, 1080, cik)) * z + H / 2;
        const kelimeA = ramp(t, S.at(1, 0.0), S.at(1, 0.35)), resimA = ramp(t, S.at(1, 0.5), S.at(1, 0.85));
        const sal = s => Math.sin(t * 1.5 + s) * 12;
        balon(ctx, 'Acaba…', hx - 220, hy - 330 + sal(1), ramp(t, 1.0, 1.4) * (1 - yuzU), 1.0);
        balon(ctx, 'Neden?', hx + 260, hy - 200 + sal(2), kelimeA * (1 - yuzU), 1.0);
        resimBalon(ctx, hx + 200, hy - 560 + sal(3), 0, resimA * (1 - yuzU));
        resimBalon(ctx, hx - 260, hy - 640 + sal(4), 1, ramp(t, S.at(1, 0.65), S.at(1, 0.95)) * (1 - yuzU));
        if (kelimeA > 0) yazi(ctx, 'KELİMELERLE', hx + 260, hy - 110, { boyut: 34, agirlik: 800, aralik: 4, renk: `rgba(${TRK},1)`, alfa: kelimeA * (1 - yuzU) });
        if (resimA > 0) yazi(ctx, 'GÖRÜNTÜLERLE', hx + 200, hy - 420, { boyut: 34, agirlik: 800, aralik: 4, renk: `rgba(${ALTIN},1)`, alfa: resimA * (1 - yuzU) });
      }
      // kameraya bakan minyatür karakter ve gülümseme
      if (yuzU > 0) {
        ctx.save(); ctx.globalAlpha = yuzU;
        beyinIci(ctx, t, 300 + t * 20, 1.1, 0.7);
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5; ctx.drawImage(parilti(TRK), 540 - 500, 860 - 500, 1000, 1000); ctx.restore();
        const gul = ramp(t, S.at(2, 0.75), S.konusma.end + 0.4);
        const kirp = (t > yuzBas + 1.6 && t < yuzBas + 1.8) ? Math.sin((t - yuzBas - 1.6) / 0.2 * Math.PI) : 0;
        onYuz(ctx, 540, 880, lerp(560, 600, clamp((t - yuzBas) / 3)), t, gul, kirp);
        ctx.restore();
      }
      bokeh(ctx, t, 18, 21, yuzU > 0.5 ? TRK : '150,170,230', [3, 9], 0.2, 5);
    },
  });
})();
