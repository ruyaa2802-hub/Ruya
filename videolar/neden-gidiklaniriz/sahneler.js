/* "Neden gıdıklanırız?" — Bölüm 2 sahneleri (tamamı kodla çizilir) */
(function () {
  const { W, H, clamp, lerp, inv, ease, ramp, pencere, rng, fbm, tuval, gurultuDokusu, etiket, yazi } = STUDIO.R;
  const { kamera, kf, parilti, bokeh, kisiIsikli, kisi, hap, halkalar, studyo, TAU } = STUDIO.K;
  const A = {};

  // polilinin üzerinde u (0..1) konumu
  function yolNokta(pts, u) {
    if (!pts._L) { pts._L = [0]; for (let i = 1; i < pts.length; i++) pts._L.push(pts._L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); }
    const L = pts._L, hedef = clamp(u) * L[L.length - 1];
    for (let i = 1; i < pts.length; i++) if (hedef <= L[i]) {
      const k = (hedef - L[i - 1]) / Math.max(1e-6, L[i] - L[i - 1]);
      return [lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k)];
    }
    return pts[pts.length - 1];
  }
  function yolCiz(ctx, pts, renk, kalin, alfa = 1, kesik = null) {
    ctx.save(); ctx.globalAlpha *= alfa; ctx.strokeStyle = renk; ctx.lineWidth = kalin; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (kesik) ctx.setLineDash(kesik);
    ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke(); ctx.restore();
  }
  // yol üzerinde parlayan sinyal (kuyruklu)
  function sinyal(ctx, pts, u, renk, boyut = 50) {
    if (u <= 0 || u >= 1) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const sp = parilti(renk);
    for (let k = 0; k < 10; k++) {
      const [x, y] = yolNokta(pts, u - k * 0.018); const s = boyut * (1 - k / 12);
      ctx.globalAlpha = 1 - k / 10; ctx.drawImage(sp, x - s, y - s, s * 2, s * 2);
    }
    ctx.restore();
  }
  // tüy (kuş tüyü)
  function kusTuyu(ctx, x, y, aci, L, alfa = 1) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(aci); ctx.globalAlpha *= alfa;
    ctx.lineCap = 'round';
    for (let s = 0.08; s < 1; s += 0.025) {
      const uz = Math.sin(Math.PI * Math.min(1, s * 1.15)) * L * 0.22;
      const sx = s * L, egim = 0.5 + s * 0.4;
      for (const yon of [-1, 1]) {
        ctx.strokeStyle = `rgba(${235 - s * 30},${230 - s * 20},255,${0.55 + 0.3 * (1 - s)})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(sx, 0);
        ctx.quadraticCurveTo(sx + uz * 0.4, yon * uz * 0.5, sx + uz * egim, yon * uz); ctx.stroke();
      }
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-L * 0.15, 0); ctx.quadraticCurveTo(L * 0.5, -8, L, 0); ctx.stroke();
    ctx.restore();
  }

  VIDEO.sahne('_ortak', {
    hazirla() {
      const r = rng(31);
      // ten dokusu (yakın plan)
      A.ten = gurultuDokusu(540, 960, 70, 5, (f, i, j) => { const g = fbm(i / 6, j / 6, 9, 3); const v = 0.8 + f * 0.3 + (g - 0.5) * 0.1; return [214 * v, 160 * v, 132 * v]; }, 5);
      A.kil = Array.from({ length: 170 }, () => ({ x: r() * W, y: r() * H, a: 0.9 + (r() - 0.5) * 0.6, L: 50 + r() * 50 }));
      // deri altı sinir uçları (dallanan ağ)
      A.sinir = [];
      const dal = (x, y, a, L, d) => {
        if (d > 4 || L < 30) return;
        const x2 = x + Math.cos(a) * L, y2 = y + Math.sin(a) * L;
        A.sinir.push([x, y, x2, y2]);
        dal(x2, y2, a + 0.5 + r() * 0.3, L * 0.7, d + 1); dal(x2, y2, a - 0.5 - r() * 0.3, L * 0.7, d + 1);
      };
      for (let k = 0; k < 7; k++) dal(r() * W, H * 0.15 + r() * H * 0.75, r() * TAU, 170, 0);
      A.uclar = A.sinir.map(s => [s[2], s[3]]);
      // beyin dokusu (girus kıvrımları)
      const b = tuval(), bx = b.getContext('2d');
      const beyinYol = new Path2D('M 240 905 C 200 760 250 600 380 548 C 500 492 690 500 800 572 C 900 640 925 760 880 870 C 860 925 800 960 720 975 C 620 995 520 1000 430 985 C 330 970 270 950 240 905 Z');
      A.beyinYol = beyinYol;
      const g = bx.createRadialGradient(520, 700, 50, 560, 760, 480);
      g.addColorStop(0, '#d79bc8'); g.addColorStop(0.6, '#a5639f'); g.addColorStop(1, '#5d2f62');
      bx.fillStyle = g; bx.fill(beyinYol);
      bx.save(); bx.clip(beyinYol);
      bx.lineCap = 'round';
      for (let k = 0; k < 90; k++) {
        let x = 220 + r() * 700, y = 500 + r() * 500, a = r() * TAU;
        bx.beginPath(); bx.moveTo(x, y);
        for (let s = 0; s < 14; s++) { a += (r() - 0.5) * 1.6; x += Math.cos(a) * 16; y += Math.sin(a) * 16; bx.lineTo(x, y); }
        bx.strokeStyle = 'rgba(70,25,70,0.55)'; bx.lineWidth = 5; bx.stroke();
        bx.translate(-2, -2); bx.strokeStyle = 'rgba(255,220,250,0.22)'; bx.lineWidth = 2; bx.stroke(); bx.setTransform(1, 0, 0, 1, 0, 0);
      }
      bx.restore();
      bx.strokeStyle = 'rgba(255,210,245,0.55)'; bx.lineWidth = 4; bx.stroke(beyinYol);
      // beyincik
      bx.save();
      bx.beginPath(); bx.ellipse(790, 1015, 150, 92, -0.12, 0, TAU);
      const g2 = bx.createRadialGradient(780, 1000, 20, 790, 1015, 160);
      g2.addColorStop(0, '#c98fd0'); g2.addColorStop(1, '#6c3a78');
      bx.fillStyle = g2; bx.fill(); bx.clip();
      for (let k = -6; k <= 6; k++) { bx.strokeStyle = 'rgba(60,20,70,0.6)'; bx.lineWidth = 4; bx.beginPath(); bx.ellipse(790, 1015 + k * 15, 170, 40, -0.12, Math.PI * 0.05, Math.PI * 0.95); bx.stroke(); }
      bx.restore();
      // beyin sapı + omurilik
      bx.fillStyle = '#7c4a7e';
      bx.beginPath(); bx.moveTo(660, 960); bx.quadraticCurveTo(700, 1100, 690, 1250); bx.lineTo(730, 1250); bx.quadraticCurveTo(745, 1090, 730, 960); bx.fill();
      A.beyin = b;
    },
    ciz() { },
  });

  // ================= 1) KANCA =================
  VIDEO.sahne('kanca', {
    ciz(ctx, S) {
      const t = S.t;
      const zoom = ramp(t, S.at(2, 0.0) - 0.3, S.d + 0.6);
      ctx.save();
      kamera(ctx, 540, lerp(1100, 760, ease.inOut(zoom)), lerp(1, 2.3, ease.in(zoom)));
      studyo(ctx, '#0d0820', '#030208', '140,100,230', 540, 880, 980, 0.42);
      // zemin ışık havuzu
      const zh = ctx.createRadialGradient(540, 1740, 20, 540, 1740, 420);
      zh.addColorStop(0, 'rgba(170,130,255,0.35)'); zh.addColorStop(1, 'rgba(170,130,255,0)');
      ctx.fillStyle = zh; ctx.fillRect(0, 1500, W, 420);
      const dene = ramp(t, 0.8, 1.6);
      const kip = Math.sin(t * 19) * 0.9;
      const p = { elHedef: [lerp(-14, -9 + kip, dene), lerp(35, 24 + Math.cos(t * 17) * 0.7, dene)], basEgik: 0.4 * dene, basDon: 0.25 * Math.sin(t * 0.9) * dene };
      const k = kisiIsikli(ctx, 540, 1740, 1050, p, 'rgba(190,150,255,0.8)', 'rgba(120,200,255,0.55)');
      // parmak kıpırtısı + sönük halkalar (his bastırılıyor)
      if (dene > 0) {
        ctx.fillStyle = '#07070c';
        for (let f = 0; f < 4; f++) { ctx.beginPath(); ctx.arc(k.el[0] + 18 + f * 7, k.el[1] - 12 + f * 9 + Math.sin(t * 22 + f) * 5, 9, 0, TAU); ctx.fill(); }
        halkalar(ctx, k.el[0] + 30, k.el[1], t, { renk: '180,180,210', maxR: 70, alfa: 0.45 * dene, kalin: 4, hiz: 1.4 });
      }
      // beyin önizlemesi (son cümlede)
      const b = ramp(t, S.at(2, 0.0), S.at(2, 1) + 0.4);
      if (b > 0) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = b * (0.7 + 0.3 * Math.sin(t * 6));
        const s = 70 * k.u / 10.5 * 1.5; ctx.drawImage(parilti('200,120,255'), k.bas[0] - s, k.bas[1] - s * 0.9, s * 2, s * 2);
        ctx.restore();
      }
      ctx.restore();
      // kahkaha ölçer (boş kalır)
      const m = pencere(t, S.at(0, 0.5), S.at(2, 0.1), 0.4);
      if (m > 0) {
        ctx.save(); ctx.globalAlpha = m;
        const x = 930, y0 = 1180, y1 = 760;
        ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.roundRect(x - 26, y1, 52, y0 - y1, 26); ctx.fill(); ctx.stroke();
        const dolu = 0.05 + 0.03 * Math.abs(Math.sin(t * 7));
        ctx.fillStyle = '#FFD54A'; ctx.beginPath(); ctx.roundRect(x - 18, y0 - 8 - (y0 - y1 - 16) * dolu, 36, (y0 - y1 - 16) * dolu, 18); ctx.fill();
        yazi(ctx, 'KAHKAHA', x, y1 - 36, { boyut: 26, agirlik: 700, aralik: 3, renk: 'rgba(255,255,255,0.8)' });
        yazi(ctx, '%' + Math.round(dolu * 100), x, y0 + 40, { boyut: 34, agirlik: 800, renk: '#FFD54A' });
        ctx.restore();
      }
      bokeh(ctx, t, 22, 3, '170,140,255', [4, 14], 0.25, 8);
    },
  });

  // ================= 2) İKİ TÜR =================
  VIDEO.sahne('turler', {
    ciz(ctx, S) {
      const t = S.t;
      const tenBas = S.at(1, 0.0) - 0.4, tenU = ramp(t, tenBas, tenBas + 0.7);
      const kisiBas = S.at(2, 0.0) - 0.4, kisiU = ramp(t, kisiBas, kisiBas + 0.7);
      // ---- a) iki tür kartı ----
      if (tenU < 1) {
        ctx.save(); ctx.globalAlpha = 1 - tenU;
        studyo(ctx, '#140a24', '#05030a', '255,170,120', 540, 900, 900, 0.18);
        const k1 = ramp(t, 0.2, 0.8, ease.outBack), k2 = ramp(t, S.at(0, 0.45), S.at(0, 0.45) + 0.6, ease.outBack);
        [[k1, 760, '1', 'Hafif gıdıklanma', 'tüy değmiş gibi kaşıntı', '120,200,255'], [k2, 1080, '2', 'Kahkahalı gıdıklanma', 'kaburga, koltuk altı', '255,190,90']].forEach(([a, y, n, b, alt, renk]) => {
          if (a <= 0) return;
          ctx.save(); ctx.globalAlpha *= clamp(a); ctx.translate(540, y); ctx.scale(lerp(0.85, 1, a), lerp(0.85, 1, a)); ctx.translate(-540, -y);
          ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.strokeStyle = `rgba(${renk},0.6)`; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.roundRect(110, y - 120, 860, 240, 40); ctx.fill(); ctx.stroke();
          ctx.fillStyle = `rgba(${renk},1)`; ctx.beginPath(); ctx.arc(230, y, 64, 0, TAU); ctx.fill();
          yazi(ctx, n, 230, y + 4, { boyut: 76, agirlik: 800, renk: '#120a1e', golge: false });
          yazi(ctx, b, 330, y - 28, { boyut: 50, agirlik: 800, hiza: 'left' });
          yazi(ctx, alt, 330, y + 36, { boyut: 34, agirlik: 600, hiza: 'left', renk: `rgba(${renk},0.95)` });
          ctx.restore();
        });
        ctx.restore();
      }
      // ---- b) tüy ve ten ----
      if (tenU > 0 && kisiU < 1) {
        const tt = t - tenBas, d = Math.max(1, kisiBas - tenBas);
        ctx.save(); ctx.globalAlpha = tenU * (1 - kisiU);
        kamera(ctx, 540 + tt * 6, 960, 1.08 + tt * 0.01, -0.05);
        ctx.drawImage(A.ten, -60, -60, W + 120, H + 120);
        ctx.fillStyle = 'rgba(40,20,60,0.35)'; ctx.fillRect(-60, -60, W + 120, H + 120);
        // tüyün yolu
        const yol = u => [lerp(1150, -150, u) + Math.sin(u * 7) * 90, lerp(420, 1500, u) + Math.sin(u * 4) * 60];
        const u = clamp(tt / d);
        const [fx, fy] = yol(u);
        // sinir uçları: tüye yakın olanlar parlar
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < A.sinir.length; i++) {
          const s = A.sinir[i];
          let p = 0;
          for (let k = 0; k < 6; k++) { const [px, py] = yol(clamp(u - k * 0.03)); p = Math.max(p, Math.exp(-((s[2] - px) ** 2 + (s[3] - py) ** 2) / (2 * 150 ** 2)) * (1 - k / 7)); }
          ctx.strokeStyle = `rgba(120,200,255,${0.12 + 0.6 * p})`; ctx.lineWidth = 2 + 3 * p;
          ctx.beginPath(); ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]); ctx.stroke();
          if (p > 0.15) { const z = 30 * p; ctx.globalAlpha = p; ctx.drawImage(parilti('120,200,255'), s[2] - z, s[3] - z, z * 2, z * 2); ctx.globalAlpha = 1; }
        }
        ctx.restore();
        // kıllar eğilir
        ctx.lineCap = 'round';
        for (const k of A.kil) {
          const dd = Math.hypot(k.x - fx, k.y - fy), e = Math.exp(-dd * dd / (2 * 110 * 110));
          const a = k.a - e * 1.3;
          ctx.strokeStyle = 'rgba(60,35,25,0.8)'; ctx.lineWidth = 2.6;
          ctx.beginPath(); ctx.moveTo(k.x, k.y); ctx.quadraticCurveTo(k.x + Math.cos(a) * k.L * 0.5, k.y + Math.sin(a) * k.L * 0.5 - 6, k.x + Math.cos(a) * k.L, k.y + Math.sin(a) * k.L); ctx.stroke();
        }
        const [fx2, fy2] = yol(clamp(u + 0.01));
        ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 25;
        kusTuyu(ctx, fx, fy, Math.atan2(fy2 - fy, fx2 - fx) + Math.PI + 0.25 * Math.sin(tt * 3), 360);
        ctx.restore();
        ctx.restore();
        const ea = ramp(t, tenBas + 0.5, tenBas + 1.1) * (1 - kisiU);
        hap(ctx, 'Hafif gıdıklanma', W / 2, 250, 'rgba(15,40,80,0.75)', 'rgba(170,220,255,1)', ea);
        yazi(ctx, 'bilimsel adı: knismesis', W / 2, 330, { boyut: 34, agirlik: 600, alfa: ea });
      }
      // ---- c) kahkaha bölgeleri ----
      if (kisiU > 0) {
        const tt = t - kisiBas;
        ctx.save(); ctx.globalAlpha = kisiU;
        studyo(ctx, '#1a0c16', '#050206', '255,160,90', 540, 900, 950, 0.3);
        const zip = Math.abs(Math.sin(tt * 7)) * ramp(tt, 0.6, 1.2);
        const k = kisiIsikli(ctx, 540, 1720, 1000, { elHedef: [-17, -6 + Math.sin(tt * 7) * 1.5], solElHedef: [17, -6 + Math.cos(tt * 7) * 1.5], zipla: zip, basEgim: 0.12 * Math.sin(tt * 5) }, 'rgba(255,180,100,0.9)', 'rgba(255,120,160,0.5)');
        const u = k.u, cx = 540, oy = k.omuzY;
        const bolgeler = [[cx, oy - 3 * u, 0.0], [cx - 12 * u, oy + 7 * u, 0.15], [cx + 12 * u, oy + 7 * u, 0.25], [cx - 11 * u, oy + 22 * u, 0.35], [cx + 11 * u, oy + 22 * u, 0.45]];
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (const [x, y, gec] of bolgeler) {
          const a = ramp(tt, 0.2 + gec, 0.6 + gec);
          if (a <= 0) continue;
          const s = (50 + 14 * Math.sin(tt * 6 + gec * 20)) * a;
          ctx.globalAlpha = a; ctx.drawImage(parilti('255,170,80'), x - s, y - s, s * 2, s * 2);
          halkalar(ctx, x, y, tt + gec, { renk: '255,190,90', maxR: 110, alfa: 0.7 * a, kalin: 4, hiz: 1.2 });
        }
        ctx.restore();
        // "HA HA" balonları
        const r = rng(5);
        for (let n = 0; n < 9; n++) {
          const bas = 0.8 + n * 0.35 + r() * 0.2, uu = clamp((tt - bas) / 1.6);
          if (uu <= 0 || uu >= 1) continue;
          const x = k.bas[0] + (r() - 0.5) * 360, y = k.bas[1] - 80 - uu * 260;
          yazi(ctx, 'HA', x, y, { boyut: 46 + r() * 30, agirlik: 800, renk: '#FFD54A', alfa: Math.sin(Math.PI * uu) });
        }
        ctx.restore();
        const ea = ramp(tt, 0.4, 1.0);
        hap(ctx, 'Kahkahalı gıdıklanma', W / 2, 250, 'rgba(80,35,10,0.75)', '#FFD54A', ea);
        yazi(ctx, 'bilimsel adı: gargalesis', W / 2, 330, { boyut: 34, agirlik: 600, alfa: ea });
      }
      bokeh(ctx, t, 18, 8, '255,200,150', [4, 12], 0.2, 8);
    },
  });

  // ================= 3) BEYİN =================
  const KOMUT = [[560, 560], [600, 760], [650, 900], [705, 1080], [710, 1300], [700, 1950]];
  const KOPYA = [[650, 900], [720, 950], [790, 1010]];
  const HIS = [[740, 1950], [725, 1300], [718, 1080], [672, 900], [652, 740], [640, 575]];
  const TAHMIN = [[790, 1010], [800, 880], [740, 720], [650, 590]];
  VIDEO.sahne('beyin', {
    ciz(ctx, S) {
      const t = S.t;
      const a0 = S.at(0, 0), a1 = S.at(0, 1);
      const f = x => a0 + (a1 - a0) * x;     // 1. cümle içindeki oran → zaman
      const kom = clamp((t - f(0.05)) / (f(0.28) - f(0.05)));
      const kop = clamp((t - f(0.22)) / (f(0.42) - f(0.22)));
      const his = clamp((t - f(0.5)) / (f(0.82) - f(0.5)));
      const tah = clamp((t - f(0.45)) / (f(0.78) - f(0.45)));
      const bastir = ramp(t, f(0.78), f(0.92));
      const bar = ramp(t, S.at(1, 0.0) - 0.3, S.at(1, 0.0) + 0.4);
      const [cx, cy, z] = kf(t, [[-0.6, [560, 820, 1.35]], [f(0.15), [560, 900, 1.05]], [f(0.6), [580, 940, 1.0]], [S.d, [570, 980, 0.95]]]);
      studyo(ctx, '#0a0718', '#020105', '120,80,220', 540, 820, 1000, 0.3);
      ctx.save();
      kamera(ctx, cx, cy, z);
      // omurilik (aşağı uzanır)
      ctx.strokeStyle = '#5c3460'; ctx.lineWidth = 34; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(710, 1240); ctx.lineTo(715, 2000); ctx.stroke();
      ctx.drawImage(A.beyin, 0, 0);
      // yollar
      yolCiz(ctx, KOMUT, 'rgba(255,200,140,0.35)', 5, ramp(t, 0, 0.8));
      yolCiz(ctx, HIS, 'rgba(255,150,90,0.3)', 5, ramp(t, f(0.45), f(0.55)));
      yolCiz(ctx, KOPYA, 'rgba(120,220,255,0.45)', 5, ramp(t, f(0.2), f(0.3)), [12, 10]);
      yolCiz(ctx, TAHMIN, 'rgba(120,220,255,0.4)', 5, ramp(t, f(0.43), f(0.5)), [12, 10]);
      sinyal(ctx, KOMUT, kom, '255,220,170', 46);
      sinyal(ctx, KOPYA, kop, '120,220,255', 46);
      sinyal(ctx, TAHMIN, tah, '120,220,255', 40);
      sinyal(ctx, HIS, his, '255,150,80', lerp(56, 18, bastir));
      // beyincik parlaması
      const bp = pencere(t, f(0.38), S.d + 1, 0.4) * (0.7 + 0.3 * Math.sin(t * 5));
      if (bp > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = bp; ctx.drawImage(parilti('120,220,255'), 790 - 190, 1015 - 140, 380, 280); ctx.restore(); }
      // duyusal korteks: bastırılmış (sönük) tepki
      const dk = ramp(t, f(0.8), f(0.88)) * (1 - ramp(t, f(0.95), f(1.1)));
      if (dk > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = dk * 0.35; ctx.drawImage(parilti('255,150,80'), 640 - 70, 575 - 70, 140, 140); ctx.restore(); }
      ctx.restore();
      const E = (x, y) => [(x - cx) * z + W / 2, (y - cy) * z + H / 2];
      etiket(ctx, ...E(560, 560), 240, 360, 'Hareket komutu', pencere(t, f(0.06), f(0.45), 0.3), { renk: 'rgba(255,225,190,0.98)' });
      etiket(ctx, ...E(790, 1050), 760, 1230, 'Beyincik', pencere(t, f(0.3), S.at(1, 0.1), 0.3), { boyut: 48, alt: 'hissi önceden tahmin eder', renk: 'rgba(160,230,255,1)' });
      etiket(ctx, ...E(645, 585), 820, 380, 'His bastırılır', pencere(t, f(0.82), S.at(1, 0.05), 0.25), { renk: 'rgba(255,190,140,1)' });
      // karşılaştırma çubukları
      if (bar > 0) {
        ctx.save(); ctx.globalAlpha = bar;
        ctx.fillStyle = 'rgba(10,6,20,0.78)'; ctx.beginPath(); ctx.roundRect(70, 170, 940, 330, 36); ctx.fill();
        const satir = (y, metin, oran, renk) => {
          yazi(ctx, metin, 120, y - 34, { boyut: 36, agirlik: 700, hiza: 'left' });
          ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.beginPath(); ctx.roundRect(120, y, 840, 34, 17); ctx.fill();
          ctx.fillStyle = renk; ctx.beginPath(); ctx.roundRect(120, y, Math.max(34, 840 * oran), 34, 17); ctx.fill();
        };
        const dol = ramp(t, S.at(1, 0.0), S.at(1, 0.8), ease.out);
        satir(270, 'Kendi dokunuşun (tahmin edilir)', 0.12 * dol, 'rgba(120,220,255,0.95)');
        satir(410, 'Sürpriz dokunuş (tahmin edilemez)', 0.92 * dol, '#FFD54A');
        ctx.restore();
      }
      bokeh(ctx, t, 20, 12, '170,130,255', [3, 10], 0.25, 6);
    },
  });

  // ================= 4) SOSYAL =================
  function sempanze(ctx, cx, cy, s, renk, ic) {
    ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
    ctx.fillStyle = renk; ctx.strokeStyle = renk; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.ellipse(0, 60, 120, 140, 0, 0, TAU); ctx.fill();
    for (const k of [-1, 1]) {
      ctx.lineWidth = 50; ctx.beginPath(); ctx.moveTo(k * 95, -20); ctx.quadraticCurveTo(k * 175, 90, k * 150, 190); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(k * 70, 180, 70, 36, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(k * 82, -128, 32, 0, TAU); ctx.fill();
    }
    ctx.beginPath(); ctx.arc(0, -120, 80, 0, TAU); ctx.fill();
    ctx.fillStyle = ic; ctx.beginPath(); ctx.ellipse(0, -92, 54, 42, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-24, -140, 22, 16, 0, 0, TAU); ctx.ellipse(24, -140, 22, 16, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = renk; ctx.beginPath(); ctx.ellipse(0, -160, 66, 16, 0, Math.PI, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,240,220,0.9)'; ctx.beginPath(); ctx.arc(-24, -140, 4, 0, TAU); ctx.arc(24, -140, 4, 0, TAU); ctx.fill();
    ctx.strokeStyle = renk; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, -86, 26, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    ctx.restore();
  }
  function fare(ctx, cx, cy, s, renk, t) {
    ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
    ctx.fillStyle = renk; ctx.strokeStyle = renk; ctx.lineCap = 'round';
    ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(130, 30); ctx.bezierCurveTo(260, 80, 330, -20, 420, 10 + Math.sin(t * 2) * 15); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 0, 150, 82, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-150, -8, 88, 56, -0.15, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-210, -30); ctx.quadraticCurveTo(-260, 0, -238, 18); ctx.lineTo(-180, 30); ctx.fill();
    ctx.beginPath(); ctx.arc(-120, -66, 34, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,170,190,0.55)'; ctx.beginPath(); ctx.arc(-120, -66, 20, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(-180, -22, 5, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,170,190,0.9)'; ctx.beginPath(); ctx.arc(-240, 12, 7, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
    for (const k of [-1, 0, 1]) { ctx.beginPath(); ctx.moveTo(-232, 14); ctx.lineTo(-300, 14 + k * 20 + Math.sin(t * 8 + k) * 3); ctx.stroke(); }
    ctx.fillStyle = renk; for (const k of [-90, 60]) { ctx.beginPath(); ctx.ellipse(k, 76, 30, 14, 0, 0, TAU); ctx.fill(); }
    ctx.restore();
  }

  VIDEO.sahne('sosyal', {
    ciz(ctx, S) {
      const t = S.t;
      const hayvanBas = S.at(1, 0) - 0.4, hayvanU = ramp(t, hayvanBas, hayvanBas + 0.8);
      const frekBas = S.at(2, 0) - 0.2, frekU = ramp(t, frekBas, frekBas + 0.8);
      // ---- a) oyun ve bağ ----
      if (hayvanU < 1) {
        ctx.save(); ctx.globalAlpha = 1 - hayvanU;
        studyo(ctx, '#1d0f12', '#060304', '255,170,110', 540, 1100, 1000, 0.35);
        const zip = Math.abs(Math.sin(t * 6.5)) * ramp(t, 0.6, 1.2);
        // çocuk (önce çiz → kaburga noktası)
        const cu = 4.7, cOmuz = 1640 - 82 * cu - zip * 4 * cu;
        const kaburga = [760 - 11 * cu, cOmuz + 24 * cu];
        const au = 8.6, aOmuz = 1640 - 82 * au;
        const yetiskin = kisiIsikli(ctx, 380, 1640, 860, { elHedef: [(kaburga[0] - 380) / au, (kaburga[1] - aOmuz) / au + Math.sin(t * 13) * 0.6], basEgik: 0.6, basDon: 0.8 }, 'rgba(255,180,110,0.9)', 'rgba(120,170,255,0.5)');
        const cocuk = kisiIsikli(ctx, 760, 1640, 470, { elHedef: [-14, 8], solElHedef: [16, -6 + Math.sin(t * 9) * 2], zipla: zip, basEgim: 0.2 * Math.sin(t * 6), basDon: -0.6 }, 'rgba(255,190,120,0.95)', 'rgba(255,140,170,0.5)');
        halkalar(ctx, kaburga[0], kaburga[1], t, { renk: '255,200,110', maxR: 90, alfa: 0.8, kalin: 4, hiz: 1.5 });
        // bağ ışığı
        const ba = ramp(t, S.at(0, 0.45), S.at(0, 0.8));
        if (ba > 0) {
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
          for (let k = 0; k < 3; k++) {
            ctx.strokeStyle = `rgba(255,${170 + k * 25},${120 + k * 30},${0.35 * ba})`; ctx.lineWidth = 10 - k * 3;
            ctx.beginPath(); ctx.moveTo(...yetiskin.bas);
            ctx.bezierCurveTo(yetiskin.bas[0] + 120, yetiskin.bas[1] - 200 - k * 30 + Math.sin(t * 2 + k) * 20, cocuk.bas[0] - 60, cocuk.bas[1] - 220 - k * 20, cocuk.bas[0], cocuk.bas[1]);
            ctx.stroke();
          }
          const mx = (yetiskin.bas[0] + cocuk.bas[0]) / 2 + 30, my = Math.min(yetiskin.bas[1], cocuk.bas[1]) - 200;
          ctx.globalAlpha = ba * (0.7 + 0.3 * Math.sin(t * 4)); ctx.drawImage(parilti('255,190,120'), mx - 80, my - 80, 160, 160);
          ctx.restore();
          hap(ctx, 'Sosyal bağ', W / 2, 330, 'rgba(80,35,10,0.7)', '#FFD54A', ba);
        }
        ctx.restore();
      }
      // ---- b) şempanze ve fare ----
      if (hayvanU > 0) {
        const tt = t - hayvanBas;
        const z = lerp(1, 1.7, ease.inOut(frekU)), cx = lerp(540, 760, ease.inOut(frekU)), cy = lerp(1000, 1150, ease.inOut(frekU));
        ctx.save(); ctx.globalAlpha = hayvanU;
        studyo(ctx, '#0b1018', '#020304', '110,170,255', 540, 1000, 1000, 0.3);
        ctx.save();
        kamera(ctx, cx, cy, z);
        const sa = ramp(tt, 0.1, 0.7), fa = ramp(t, S.at(1, 0.45), S.at(1, 0.45) + 0.6);
        if (sa > 0) {
          ctx.save(); ctx.globalAlpha *= sa;
          const zip = Math.abs(Math.sin(tt * 6)) * 10;
          sempanze(ctx, 300 + 3, 1150 - zip, 1.05, 'rgba(255,180,110,0.85)', '#2a1a14');
          sempanze(ctx, 300, 1150 - zip, 1.04, '#0b0a0c', '#3a2a22');
          halkalar(ctx, 300, 1000 - zip, tt, { renk: '255,200,110', maxR: 160, alfa: 0.7, n: 3, yay: [-Math.PI * 0.85, -Math.PI * 0.15], hiz: 1.3 });
          ctx.restore();
        }
        if (fa > 0) {
          ctx.save(); ctx.globalAlpha *= fa;
          const ziplama = Math.abs(Math.sin(t * 7)) * 8;
          fare(ctx, 800 + 3, 1290 - ziplama, 0.75, 'rgba(140,200,255,0.8)', t);
          fare(ctx, 800, 1290 - ziplama, 0.745, '#0d0e12', t);
          // ultrasonik "kahkaha" dalgaları (sık ve ince)
          halkalar(ctx, 620, 1290, t, { renk: '120,220,255', maxR: 220, alfa: 0.85, n: 7, kalin: 3, hiz: 2.2, yay: [Math.PI * 0.7, Math.PI * 1.3] });
          ctx.restore();
        }
        ctx.restore();
        if (sa > 0) yazi(ctx, 'Şempanze', (300 - cx) * z + W / 2, (880 - cy) * z + H / 2 - 40, { boyut: 40, agirlik: 700, alfa: sa * (1 - frekU) });
        if (fa > 0) yazi(ctx, 'Fare', (800 - cx) * z + W / 2, (1150 - cy) * z + H / 2 - 30, { boyut: 40, agirlik: 700, alfa: fa * (1 - frekU) });
        // ---- c) frekans ölçeği: insan kulağı ~20 kHz'e kadar, fare kahkahası ~50 kHz ----
        if (frekU > 0) {
          ctx.save(); ctx.globalAlpha = frekU;
          ctx.fillStyle = 'rgba(5,10,20,0.8)'; ctx.beginPath(); ctx.roundRect(60, 170, 960, 460, 36); ctx.fill();
          yazi(ctx, 'Ses frekansı', 110, 230, { boyut: 34, agirlik: 700, hiza: 'left', renk: 'rgba(200,220,255,0.9)' });
          const x0 = 110, x1 = 970, y = 420, kx = khz => lerp(x0, x1, khz / 60);
          ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.roundRect(x0, y - 22, x1 - x0, 44, 22); ctx.fill();
          const dol = ramp(t, frekBas + 0.3, frekBas + 1.1, ease.out);
          ctx.fillStyle = 'rgba(120,230,160,0.9)'; ctx.beginPath(); ctx.roundRect(x0, y - 22, (kx(20) - x0) * dol, 44, 22); ctx.fill();
          yazi(ctx, 'İnsan kulağı', (x0 + kx(20)) / 2, y - 70, { boyut: 34, agirlik: 800, renk: 'rgba(150,240,180,1)', alfa: dol });
          yazi(ctx, '≈ 20 kHz\'e kadar', (x0 + kx(20)) / 2, y + 70, { boyut: 30, agirlik: 600, alfa: dol });
          [0, 20, 40, 60].forEach(k => yazi(ctx, k + '', kx(k), y + 130, { boyut: 26, agirlik: 600, renk: 'rgba(255,255,255,0.6)' }));
          const fz = ramp(t, frekBas + 1.0, frekBas + 1.6, ease.outBack);
          if (fz > 0) {
            const fx = kx(50);
            ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = clamp(fz) * (0.75 + 0.25 * Math.sin(t * 9));
            ctx.drawImage(parilti('120,220,255'), fx - 60, y - 60, 120, 120); ctx.restore();
            ctx.fillStyle = '#7fd8ff'; ctx.beginPath(); ctx.arc(fx, y, 16 * clamp(fz), 0, TAU); ctx.fill();
            yazi(ctx, 'Fare kahkahası', fx, y - 70, { boyut: 34, agirlik: 800, renk: '#9fe2ff', alfa: clamp(fz) });
            yazi(ctx, '≈ 50 kHz', fx, y + 70, { boyut: 30, agirlik: 600, alfa: clamp(fz) });
          }
          ctx.restore();
        }
        ctx.restore();
      }
      // kapanış başlığı
      const ka = ramp(t, S.konusma.end + 0.1, S.konusma.end + 0.9);
      if (ka > 0) {
        ctx.save(); ctx.fillStyle = `rgba(0,0,0,${0.55 * ka})`; ctx.fillRect(0, 0, W, H); ctx.restore();
        const dy = (1 - ease.out(ka)) * 30;
        yazi(ctx, 'SÜRPRİZ YOKSA', W / 2, 820 + dy, { boyut: 44, agirlik: 700, aralik: 10, renk: 'rgba(255,213,74,1)', alfa: ka });
        yazi(ctx, 'gıdıklanma da yok.', W / 2, 910 + dy, { boyut: 88, agirlik: 800, alfa: ka, golgeBulanik: 30 });
      }
      bokeh(ctx, t, 18, 21, '255,200,150', [3, 12], 0.2, 7);
    },
  });
})();
