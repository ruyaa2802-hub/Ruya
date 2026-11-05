/* İNSAN VÜCUDU HAKKINDA BİLİNMEYENLER #01 — "Yüzümüzde Bizimle Yaşayan Canlılar" (Demodex)
 * Uyuyan yüz → gözeneğe dalış → kıl kökünde Demodex → gece kirpik dipleri → yüze geri çekilme.
 * Demodex anatomisi: ağız parçaları (gnathosoma), 4 çift kısa bacaklı ön gövde (podosoma),
 * uzun, halkalı ve incelen arka gövde (opisthosoma); yaklaşık 0,1–0,4 mm.
 */
(function () {
  const { W, H, clamp, lerp, ease, ramp, pencere, rng, fbm, tuval, gurultuDokusu, etiket, yazi } = STUDIO.R;
  const { kamera, kf, parilti, bokeh, hap, TAU } = STUDIO.K;
  const { BAS, SAC } = STUDIO.KR;
  const A = {};

  // ---------- Demodex akarı ----------
  // (x,y) gövde merkezi, aci: başın baktığı yön, L: boy (px), t: zaman, faz: kişisel faz, renk: 'r,g,b'
  function akar(ctx, x, y, aci, L, t, faz = 0, isik = '235,225,205', alfa = 1) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(aci); ctx.globalAlpha *= alfa;
    const Wd = L * 0.125;
    // gövde ekseni: +x baş (ön), -x kuyruk
    const kuyruk = s => Math.sin(t * 2.2 + faz + s * 4) * L * 0.025 * s;   // hafif kuyruk dalgası
    const gen = s => {           // s: 0 (baş) .. 1 (kuyruk ucu) → yarı genişlik
      if (s < 0.05) return Wd * (0.5 + s * 8);
      if (s < 0.3) return Wd * (0.9 + 0.1 * Math.sin((s - 0.05) / 0.25 * Math.PI));
      return Wd * 0.9 * Math.pow(1 - (s - 0.3) / 0.7, 0.55) + L * 0.006;
    };
    const P = s => [L * 0.5 - s * L, kuyruk(s)];
    // bacaklar (4 çift, ön gövdede)
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = 0; i < 4; i++) {
      const s = 0.08 + i * 0.055, [bx, by] = P(s);
      for (const yon of [-1, 1]) {
        const sal = Math.sin(t * 9 + faz + i * 1.4 + (yon > 0 ? Math.PI : 0)) * 0.45;
        const a1 = yon * (Math.PI / 2 + 0.25) + sal * 0.6 - 0.2;
        const l1 = Wd * 0.42, l2 = Wd * 0.34;
        const kx = bx + Math.cos(a1) * l1 * 0.2, ky = by + Math.sin(a1) * gen(s) * 0.9;
        const dx = kx + Math.cos(a1) * l1, dy = ky + Math.sin(a1) * l1;
        const a2 = a1 + yon * 0.5 + sal * 0.4, ex = dx + Math.cos(a2) * l2, ey = dy + Math.sin(a2) * l2;
        ctx.strokeStyle = `rgba(${isik},0.9)`; ctx.lineWidth = Wd * 0.3;
        ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(dx, dy); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.strokeStyle = 'rgba(90,70,50,0.8)'; ctx.lineWidth = Wd * 0.07;      // pençeler
        ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex + Math.cos(a2 + 0.6) * Wd * 0.18, ey + Math.sin(a2 + 0.6) * Wd * 0.18);
        ctx.moveTo(ex, ey); ctx.lineTo(ex + Math.cos(a2 - 0.6) * Wd * 0.18, ey + Math.sin(a2 - 0.6) * Wd * 0.18); ctx.stroke();
      }
    }
    // gövde konturu
    const yol = new Path2D(), N = 40;
    for (let k = 0; k <= N; k++) { const s = k / N, [px, py] = P(s); const w = gen(s); k ? yol.lineTo(px, py - w) : yol.moveTo(px, py - w); }
    for (let k = N; k >= 0; k--) { const s = k / N, [px, py] = P(s); yol.lineTo(px, py + gen(s)); }
    yol.closePath();
    const g = ctx.createLinearGradient(0, -Wd, 0, Wd);
    g.addColorStop(0, `rgba(${isik},0.95)`); g.addColorStop(0.5, `rgba(${isik},0.6)`); g.addColorStop(1, 'rgba(120,95,70,0.85)');
    ctx.fillStyle = g; ctx.fill(yol);
    ctx.save(); ctx.clip(yol);
    // halkalı kuyruk (opisthosoma çizgileri)
    ctx.strokeStyle = 'rgba(110,85,60,0.45)'; ctx.lineWidth = Math.max(1, L * 0.006);
    for (let s = 0.32; s < 0.98; s += 0.016) { const [px, py] = P(s), w = gen(s); ctx.beginPath(); ctx.moveTo(px + w * 0.15, py - w); ctx.quadraticCurveTo(px - w * 0.1, py, px + w * 0.15, py + w); ctx.stroke(); }
    // iç tanecikler
    const r = rng(7 + Math.floor(faz * 100));
    for (let k = 0; k < 26; k++) { const s = 0.08 + r() * 0.5, [px, py] = P(s), w = gen(s); ctx.fillStyle = `rgba(150,110,70,${0.25 + r() * 0.3})`; ctx.beginPath(); ctx.arc(px + (r() - 0.5) * L * 0.02, py + (r() - 0.5) * w * 1.4, L * (0.006 + r() * 0.01), 0, TAU); ctx.fill(); }
    ctx.restore();
    ctx.strokeStyle = `rgba(255,250,235,0.55)`; ctx.lineWidth = Math.max(1, L * 0.006); ctx.stroke(yol);
    // ağız parçaları
    const [hx, hy] = P(0);
    ctx.fillStyle = 'rgba(120,90,60,0.9)'; ctx.beginPath(); ctx.ellipse(hx + L * 0.012, hy, L * 0.03, Wd * 0.35, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }

  VIDEO.sahne('_ortak', {
    hazirla() {
      const r = rng(5);
      // makro deri: gözenekler, deri çizgileri, ince tüyler
      const TW = 1600, TH = 1600;
      const c = tuval(TW, TH), x = c.getContext('2d');
      x.drawImage(gurultuDokusu(400, 400, 60, 13, (f, i, j) => { const g = fbm(i / 5, j / 5, 4, 3); const v = 0.78 + f * 0.32 + (g - 0.5) * 0.12; return [205 * v, 150 * v, 128 * v]; }, 5), 0, 0, TW, TH);
      x.lineCap = 'round';
      for (const aci of [0.5, -0.9]) for (let k = 0; k < 60; k++) {
        const ox = r() * TW, oy = r() * TH, L = 200 + r() * 500;
        x.beginPath(); for (let s = 0; s <= 1; s += 0.05) { const px = ox + Math.cos(aci) * L * s + Math.sin(s * 9 + k) * 6, py = oy + Math.sin(aci) * L * s; s ? x.lineTo(px, py) : x.moveTo(px, py); }
        x.strokeStyle = 'rgba(95,55,40,0.22)'; x.lineWidth = 2.5; x.stroke();
      }
      A.gozenek = [];
      for (let k = 0; k < 140; k++) A.gozenek.push([r() * TW, r() * TH, 7 + r() * 16, r()]);
      A.gozenek.push([800, 800, 34, 0.9]);   // kameranın dalacağı gözenek
      for (const [px, py, pr, h] of A.gozenek) {
        const g = x.createRadialGradient(px, py, 0, px, py, pr * 1.6);
        g.addColorStop(0, 'rgba(40,15,10,0.95)'); g.addColorStop(0.45, 'rgba(90,45,35,0.7)'); g.addColorStop(0.75, 'rgba(255,215,195,0.25)'); g.addColorStop(1, 'rgba(255,215,195,0)');
        x.fillStyle = g; x.beginPath(); x.ellipse(px, py, pr * 1.6, pr * 1.3, 0.3, 0, TAU); x.fill();
        if (h > 0.55) { x.strokeStyle = 'rgba(55,35,25,0.85)'; x.lineWidth = 2 + pr * 0.08; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + 30 + pr, py - 20, px + 70 + pr * 2, py - 50 - pr); x.stroke(); }
        x.fillStyle = 'rgba(255,255,255,0.35)'; x.beginPath(); x.ellipse(px - pr * 0.6, py - pr * 0.5, pr * 0.3, pr * 0.15, 0.4, 0, TAU); x.fill(); // yağ parlaması
      }
      A.makro = c;
      // kıl kökü duvar dokusu
      A.doku = gurultuDokusu(270, 480, 26, 31, (f, i, j) => { const v = 0.6 + f * 0.6; return [190 * v, 95 * v, 95 * v]; }, 4);
      A.hucre = Array.from({ length: 220 }, () => [r(), r(), 6 + r() * 14]);
      A.akarlar = Array.from({ length: 9 }, (_, i) => ({ x: r(), y: r(), a: r() * TAU, v: 0.4 + r() * 0.6, f: r() * 10 }));
    },
    ciz() { },
  });

  // ---------- Uyuyan yüz (gece, ay ışığı) ----------
  // kam: { K, ox, oy } — baş orijininin ekrandaki yeri; yatarken baş -1.25 rad döndürülür
  const YAT = -1.25;
  function yuz(ctx, t, kam, sabah = 0) {
    ctx.save();
    // yastık ve arka plan
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, sabah > 0.5 ? '#2a2230' : '#060a16'); g.addColorStop(1, sabah > 0.5 ? '#4a3a40' : '#0c1428');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.translate(kam.ox, kam.oy); ctx.rotate(YAT); ctx.scale(kam.K, kam.K);
    // yastık
    ctx.fillStyle = sabah > 0.5 ? 'rgba(235,220,215,0.9)' : 'rgba(150,170,210,0.35)';
    ctx.beginPath(); ctx.ellipse(-30, 10, 60, 120, 0, 0, TAU); ctx.fill();
    // nefesle hafif hareket
    const n = Math.sin(t * 1.3) * 0.4;
    ctx.translate(n * 0.3, 0);
    const ay = sabah > 0.5 ? '255,215,175' : '170,195,240';
    ctx.save(); ctx.translate(0.6, -0.4); ctx.fillStyle = `rgba(${ay},0.85)`; ctx.fill(BAS); ctx.restore();
    const cilt = ctx.createLinearGradient(52, -20, -30, 30);
    cilt.addColorStop(0, sabah > 0.5 ? '#e8b8a0' : '#8c93ad'); cilt.addColorStop(0.35, sabah > 0.5 ? '#c08670' : '#5a5c72'); cilt.addColorStop(1, sabah > 0.5 ? '#3a2420' : '#141724');
    ctx.fillStyle = cilt; ctx.fill(BAS);
    ctx.fillStyle = sabah > 0.5 ? '#1c1210' : '#07080d'; ctx.fill(SAC);
    // yanak ve burun ışıkları
    const yg = ctx.createRadialGradient(36, 4, 1, 36, 4, 14);
    yg.addColorStop(0, `rgba(${ay},0.35)`); yg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = yg; ctx.fill(BAS);
    // kapalı göz + kirpikler
    ctx.strokeStyle = 'rgba(30,20,25,0.9)'; ctx.lineWidth = 0.55;
    ctx.beginPath(); ctx.moveTo(27, -8.8); ctx.quadraticCurveTo(31, -6.8, 35, -8.2); ctx.stroke();
    ctx.lineWidth = 0.35;
    for (let k = 0; k < 9; k++) { const x0 = 27.6 + k * 0.85; ctx.beginPath(); ctx.moveTo(x0, -7.8 + Math.abs(k - 4) * 0.12); ctx.quadraticCurveTo(x0 + 0.6, -6.4, x0 + 1.2, -6.1 + Math.abs(k - 4) * 0.1); ctx.stroke(); }
    // kaş
    ctx.strokeStyle = 'rgba(20,14,16,0.7)'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(26, -15); ctx.quadraticCurveTo(32, -17.5, 39, -14.5); ctx.stroke();
    ctx.restore();
    // ay ışığı lekesi
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.25; ctx.drawImage(parilti(sabah > 0.5 ? '255,200,150' : '120,150,230'), W - 700, -300, 1100, 1100); ctx.restore();
  }
  // baş birimindeki noktanın ekran koordinatı
  function yuzNokta(kam, px, py) {
    const c = Math.cos(YAT), s = Math.sin(YAT);
    return [kam.ox + (px * c - py * s) * kam.K, kam.oy + (px * s + py * c) * kam.K];
  }

  // ================= 1) YÜZ → GÖZENEK =================
  VIDEO.sahne('yuz', {
    ciz(ctx, S) {
      const t = S.t;
      const hizli = S.at(1, 0.15);                            // "Üstelik…" ile hızlı zoom
      const zoom = ramp(t, hizli, S.d - 0.35, ease.inOut);
      const K = lerp(lerp(10, 12.5, ease.out(clamp(t / hizli))), 140, zoom);
      const hedef = [36, 6];                                  // yanak/burun kanadı
      // hedef noktayı ekranda sabit tutacak orijin
      const c = Math.cos(YAT), s = Math.sin(YAT);
      const ekr = [lerp(560, 540, zoom), lerp(1000, 900, zoom)];
      const kam = { K, ox: ekr[0] - (hedef[0] * c - hedef[1] * s) * K, oy: ekr[1] - (hedef[0] * s + hedef[1] * c) * K };
      const makroA = ramp(K, 28, 70);
      if (makroA < 1) yuz(ctx, t, kam);
      if (makroA > 0) {
        ctx.save(); ctx.globalAlpha = makroA;
        const z = lerp(0.7, 3.4, ramp(K, 28, 140, ease.in));
        kamera(ctx, 800, 800, z, 0.2);
        ctx.drawImage(A.makro, 0, 0);
        ctx.restore();
        // ay ışığı tonu
        ctx.save(); ctx.globalAlpha = makroA; ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgba(120,135,190,1)'; ctx.fillRect(0, 0, W, H); ctx.restore();
      }
      // hafif ürperti: titreşen kenar karartması
      ctx.save(); ctx.fillStyle = `rgba(0,0,0,${0.12 + 0.06 * Math.sin(t * 7)})`; ctx.fillRect(0, 0, W, H); ctx.restore();
      bokeh(ctx, t, 12, 2, '150,170,230', [2, 7], 0.15, 5);
    },
  });

  // ================= 2) KIL KÖKÜ: DEMODEX =================
  function kilKoku(ctx, t, kamY, karanlik = 0) {
    // derin doku arka planı
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#3a0f14'); g.addColorStop(1, '#14050a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.translate(0, -kamY);
    // folikül duvarları (sol/sağ, dalgalı)
    for (const yon of [-1, 1]) {
      ctx.save();
      ctx.beginPath();
      const x0 = yon < 0 ? 0 : W;
      ctx.moveTo(x0, kamY - 200);
      for (let y = kamY - 200; y <= kamY + H + 200; y += 20) ctx.lineTo(540 + yon * (300 + 40 * Math.sin(y / 140) + 20 * Math.sin(y / 53 + t * 0.6)), y);
      ctx.lineTo(x0, kamY + H + 200); ctx.closePath(); ctx.clip();
      ctx.drawImage(A.doku, 0, kamY - 200, W, H + 400);
      for (const [hx, hy, hr] of A.hucre) {
        const y = kamY - 200 + hy * (H + 400), x = yon < 0 ? hx * 300 : W - hx * 300;
        ctx.fillStyle = 'rgba(255,200,190,0.10)'; ctx.beginPath(); ctx.arc(x, y, hr * 2, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(90,20,30,0.35)'; ctx.beginPath(); ctx.arc(x, y, hr * 0.6, 0, TAU); ctx.fill();
      }
      const kg = ctx.createLinearGradient(yon < 0 ? 240 : 840, 0, yon < 0 ? 0 : W, 0);
      kg.addColorStop(0, 'rgba(255,170,160,0.35)'); kg.addColorStop(1, 'rgba(40,5,10,0.6)');
      ctx.fillStyle = kg; ctx.fillRect(0, kamY - 200, W, H + 400);
      ctx.restore();
    }
    // yağ bezi (sağda)
    const by = 1500;
    for (const [dx, dy, rr] of [[0, 0, 120], [80, 90, 95], [-30, 140, 90]]) {
      const gx = 860 + dx, gy = by + dy;
      const gg = ctx.createRadialGradient(gx - rr * 0.3, gy - rr * 0.3, rr * 0.1, gx, gy, rr);
      gg.addColorStop(0, 'rgba(255,240,170,0.95)'); gg.addColorStop(0.7, 'rgba(235,190,90,0.85)'); gg.addColorStop(1, 'rgba(150,100,40,0.8)');
      ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(gx, gy, rr, 0, TAU); ctx.fill();
    }
    // yağ damlacıkları
    const r = rng(11);
    for (let k = 0; k < 30; k++) { const x = 600 + r() * 260, y = (by - 400 + r() * 900 + t * 30 * r()) , rr = 6 + r() * 16; ctx.fillStyle = 'rgba(255,235,170,0.35)'; ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,240,0.6)'; ctx.beginPath(); ctx.arc(x - rr * 0.3, y - rr * 0.3, rr * 0.3, 0, TAU); ctx.fill(); }
    // kıl gövdesi (pullu kütikül)
    const kx = 500, kw = 120;
    const kg = ctx.createLinearGradient(kx - kw, 0, kx + kw, 0);
    kg.addColorStop(0, '#2a1a12'); kg.addColorStop(0.35, '#6a4a34'); kg.addColorStop(0.5, '#8a6448'); kg.addColorStop(1, '#1c120c');
    ctx.fillStyle = kg; ctx.fillRect(kx - kw, kamY - 200, kw * 2, H + 400);
    ctx.strokeStyle = 'rgba(20,10,5,0.45)'; ctx.lineWidth = 3;
    for (let y = Math.floor((kamY - 200) / 46) * 46; y < kamY + H + 200; y += 46) { ctx.beginPath(); ctx.moveTo(kx - kw, y + 14); ctx.quadraticCurveTo(kx, y - 10, kx + kw, y + 14); ctx.stroke(); }
    ctx.restore();
    if (karanlik > 0) { ctx.fillStyle = `rgba(4,8,20,${karanlik})`; ctx.fillRect(0, 0, W, H); }
  }

  VIDEO.sahne('demodex', {
    ciz(ctx, S) {
      const t = S.t;
      const kamY = t * 55;
      ctx.save();
      const z = lerp(1.25, 1.05, ease.out(clamp(t / 2))); ctx.translate(540, 900); ctx.scale(z, z); ctx.rotate(Math.sin(t * 0.3) * 0.03); ctx.translate(-540, -900);
      kilKoku(ctx, t, kamY);
      // kıl gövdesinde baş aşağı tutunan akarlar (ana karakter + ikincil)
      const kx = 500;
      akar(ctx, kx + 20 + Math.sin(t * 0.7) * 6, 980 + Math.sin(t * 0.5) * 20, Math.PI / 2 + 0.08 * Math.sin(t), 520, t, 0.3);
      akar(ctx, kx - 70, 1520 - kamY * 0.2, Math.PI / 2 - 0.15, 380, t, 2.1, '225,215,195', 0.85);
      ctx.save(); ctx.filter = 'blur(4px)';
      akar(ctx, kx + 110, 420 - kamY * 0.1, Math.PI / 2 + 0.25, 300, t, 4.2, '215,205,185', 0.7);
      ctx.restore();
      ctx.restore();
      // ön planda bulanık parçacıklar
      bokeh(ctx, t, 22, 9, '255,200,170', [6, 22], 0.25, 12);
      // etiketler
      const a1 = pencere(t, S.at(0, 0.0), S.at(1, 0.35), 0.35);
      hap(ctx, 'Demodex folliculorum', W / 2, 240, 'rgba(40,10,15,0.75)', '#FFD54A', a1, 44);
      // ölçek çubuğu
      const a2 = pencere(t, S.at(1, 0.0), S.d + 1, 0.4);
      if (a2 > 0) {
        ctx.save(); ctx.globalAlpha = a2; ctx.strokeStyle = '#fff'; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(110, 360); ctx.lineTo(410, 360); ctx.moveTo(110, 345); ctx.lineTo(110, 375); ctx.moveTo(410, 345); ctx.lineTo(410, 375); ctx.stroke();
        ctx.restore();
        yazi(ctx, '≈ 0,3 mm', 260, 315, { boyut: 40, agirlik: 800, alfa: a2 });
      }
      etiket(ctx, 560, 720, 760, 560, 'Kıl kökü', pencere(t, S.at(1, 0.45), S.d + 1, 0.4), {});
      etiket(ctx, 860, 1450 - t * 55 * 1.05 + 0, 860, 1200, 'Yağ bezi', pencere(t, S.at(1, 0.7), S.d + 1, 0.3), { renk: 'rgba(255,230,160,1)' });
    },
  });

  // ================= 3) GECE: DERİ YÜZEYİ VE KİRPİK DİPLERİ =================
  VIDEO.sahne('gece', {
    ciz(ctx, S) {
      const t = S.t;
      const kirpikBas = S.at(1, 0) - 0.4, kirpikU = ramp(t, kirpikBas, kirpikBas + 0.9);
      // a) gece deri yüzeyinde dolaşan akarlar
      if (kirpikU < 1) {
        ctx.save(); ctx.globalAlpha = 1 - kirpikU;
        ctx.save(); kamera(ctx, 800 + t * 25, 800 - t * 10, 1.9, 0.15 + t * 0.01); ctx.drawImage(A.makro, 0, 0); ctx.restore();
        ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgb(55,80,110)'; ctx.fillRect(0, 0, W, H); ctx.restore();
        for (const [i, a] of A.akarlar.entries()) {
          const yolA = a.a + Math.sin(t * 0.4 + a.f) * 0.5;
          const x = (a.x * W + Math.cos(yolA) * t * 60 * a.v + W) % W, y = (a.y * H + Math.sin(yolA) * t * 60 * a.v + H) % H;
          akar(ctx, x, y, yolA, 170 + a.v * 90, t, a.f, '200,215,210', 0.9);
        }
        // titrek mikroskop ışığı
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.18 + 0.08 * Math.sin(t * 11) * Math.sin(t * 3.7);
        ctx.drawImage(parilti('90,170,160'), 540 - 700, 900 - 700, 1400, 1400); ctx.restore();
        ctx.restore();
      }
      // b) kirpik dipleri
      if (kirpikU > 0) {
        const tt = t - kirpikBas;
        ctx.save(); ctx.globalAlpha = kirpikU;
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#05121a'); g.addColorStop(0.55, '#0c2230'); g.addColorStop(1, '#1a0e12');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        ctx.save(); kamera(ctx, 540 + tt * 15, 1000, 1.05 + tt * 0.03, -0.04);
        // göz kapağı kenarı (alt bölüm)
        ctx.fillStyle = '#4a2a2c';
        ctx.beginPath(); ctx.moveTo(-200, 1300); for (let x = -200; x <= 1300; x += 20) ctx.lineTo(x, 1230 + 30 * Math.sin(x / 260)); ctx.lineTo(1300, 2100); ctx.lineTo(-200, 2100); ctx.fill();
        ctx.save(); ctx.globalAlpha = 0.35; ctx.drawImage(A.doku, -200, 1230, 1500, 900); ctx.restore();
        // kirpikler (kalın, kıvrık)
        const r = rng(4);
        const kirpikler = [];
        for (let k = 0; k < 7; k++) kirpikler.push([-80 + k * 200 + r() * 60, 1240 + 30 * Math.sin((-80 + k * 200) / 260), -1.25 - r() * 0.35, 900 + r() * 400]);
        for (const [x0, y0, a, L] of kirpikler) {
          const lg = ctx.createLinearGradient(x0, y0, x0 + Math.cos(a) * L, y0 + Math.sin(a) * L);
          lg.addColorStop(0, '#2a1a14'); lg.addColorStop(1, '#0a0606');
          ctx.strokeStyle = lg; ctx.lineCap = 'round'; ctx.lineWidth = 46;
          ctx.beginPath(); ctx.moveTo(x0, y0 + 40); ctx.quadraticCurveTo(x0 + Math.cos(a) * L * 0.5 + 120, y0 + Math.sin(a) * L * 0.5, x0 + Math.cos(a) * L + 260, y0 + Math.sin(a) * L); ctx.stroke();
          ctx.strokeStyle = 'rgba(160,210,220,0.25)'; ctx.lineWidth = 8;
          ctx.beginPath(); ctx.moveTo(x0 - 10, y0 + 30); ctx.quadraticCurveTo(x0 + Math.cos(a) * L * 0.5 + 105, y0 + Math.sin(a) * L * 0.5, x0 + Math.cos(a) * L + 245, y0 + Math.sin(a) * L); ctx.stroke();
          // dipte kuyrukları dışarıda akarlar
          for (let m = 0; m < 2; m++) akar(ctx, x0 + (m ? 34 : -30), y0 - 10 - m * 20, Math.PI / 2 + (m ? -0.35 : 0.3), 150, t, x0 * 0.01 + m, '205,215,205', 0.95);
        }
        ctx.restore();
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.2 + 0.08 * Math.sin(t * 9); ctx.drawImage(parilti('90,170,160'), 540 - 800, 1100 - 800, 1600, 1600); ctx.restore();
        ctx.restore();
        etiket(ctx, 420, 1250, 300, 1050, 'Kirpik dibi', pencere(t, kirpikBas + 0.8, S.d + 1, 0.4), { renk: 'rgba(170,235,225,1)' });
      }
      bokeh(ctx, t, 18, 13, '120,200,190', [3, 10], 0.2, 7);
    },
  });

  // ================= 4) FİNAL: YÜZE GERİ ÇEKİLME =================
  VIDEO.sahne('final', {
    ciz(ctx, S) {
      const t = S.t;
      const geri = ramp(t, 0, S.at(0, 1.0) + 0.4, ease.out);          // "Ama korkma!" — hızla uzaklaş
      const sabah = ramp(t, S.at(1, 0.0), S.at(1, 0.8));
      const K = lerp(140, 10.5, geri);
      const hedef = [30, -7];                                      // kirpikler
      const c = Math.cos(YAT), s = Math.sin(YAT);
      const ekr = [lerp(540, 560, geri), lerp(900, 980, geri)];
      const kam = { K, ox: ekr[0] - (hedef[0] * c - hedef[1] * s) * K, oy: ekr[1] - (hedef[0] * s + hedef[1] * c) * K };
      const makroA = 1 - ramp(K, 45, 100);
      yuz(ctx, t + 30, kam, sabah);
      if (makroA > 0 && K > 30) {
        ctx.save(); ctx.globalAlpha = makroA; ctx.filter = `blur(${(geri * 20).toFixed(1)}px)`;
        ctx.fillStyle = '#0c2230'; ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
      if (sabah > 0) { ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = `rgba(255,190,130,${0.4 * sabah})`; ctx.fillRect(0, 0, W, H); ctx.restore(); }
      // bilgi kartı
      const ka = pencere(t, S.at(1, 0.2), S.at(2, 0.1), 0.4);
      hap(ctx, 'Çoğu yetişkinde bulunur', W / 2, 260, 'rgba(10,30,30,0.75)', 'rgba(150,240,220,1)', ka, 44);
      yazi(ctx, 'genellikle zararsızdır', W / 2, 340, { boyut: 36, agirlik: 600, alfa: ka });
      // kapanış
      const kb = ramp(t, S.konusma.end + 0.1, S.konusma.end + 0.8);
      if (kb > 0) {
        ctx.save(); ctx.fillStyle = `rgba(0,0,0,${0.5 * kb})`; ctx.fillRect(0, 0, W, H); ctx.restore();
        yazi(ctx, 'İNSAN VÜCUDU HAKKINDA', W / 2, 820, { boyut: 38, agirlik: 700, aralik: 8, renk: 'rgba(255,213,74,1)', alfa: kb });
        yazi(ctx, 'BİLİNMEYENLER', W / 2, 900, { boyut: 84, agirlik: 800, alfa: kb, golgeBulanik: 30 });
      }
      bokeh(ctx, t, 14, 21, sabah > 0.5 ? '255,210,160' : '150,170,230', [3, 9], 0.18, 5);
    },
  });
})();
