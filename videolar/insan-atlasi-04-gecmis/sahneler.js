/* İNSAN ATLASI #04 — "Bazen neden geçmişteki kendimizi özleriz?"
 * Ayna (genç yansıma) → güneşli geçmiş sokak → aynı sokak bugün → anıların yeniden şekillendiği zihin → birleşme ve logo.
 * Karakter: STUDIO.KR (#01 ve #03 ile aynı profil); genç hâli = dolgun saç + gülümseme + sıcak ışık.
 */
(function () {
  const { W, H, clamp, lerp, ease, ramp, pencere, rng, tuval, yazi, FONT } = STUDIO.R;
  const { kamera, parilti, bokeh, TAU } = STUDIO.K;
  const { BAS, GOZ, yakinYuz, yanKisi } = STUDIO.KR;
  const A = {};
  const TRK = '47,211,198', ALTIN = '255,196,110', SOGUK = '150,180,230';
  const mix = (a, b, u) => a.split(',').map((v, i) => Math.round(lerp(+v, +b.split(',')[i], u))).join(',');

  // yakın yüz: göz belirli bir ekran noktasına gelecek şekilde
  function yuzGozde(ctx, t, p, gx, gy, K, ayna = false) {
    const eg = p.egim || 0, c = Math.cos(eg), s = Math.sin(eg);
    const ox = gx - (GOZ[0] * c - GOZ[1] * s) * K, oy = gy - (GOZ[0] * s + GOZ[1] * c) * K;
    if (!ayna) return yakinYuz(ctx, t, p, { K, ox, oy });
    ctx.save(); ctx.translate(gx, 0); ctx.scale(-1, 1); ctx.translate(-gx, 0);
    const r = yakinYuz(ctx, t, p, { K, ox, oy }); ctx.restore(); return r;
  }
  function ikiliKisi(ctx, x, y, h, p, kenar, kenar2, dolgu) {
    yanKisi(ctx, x + h * 0.006, y, h, p, `rgba(${kenar},0.9)`);
    yanKisi(ctx, x - h * 0.005, y, h, p, `rgba(${kenar2},0.5)`);
    return yanKisi(ctx, x, y, h, p, dolgu);
  }

  // ---------- Sokak (geçmiş: güneşli / bugün: soğuk) ----------
  function sokakHazirla() {
    const r = rng(12);
    A.binalar = [];
    for (let kat = 0; kat < 3; kat++) {
      let x = -200;
      while (x < 4200) { const w = 120 + r() * 220, h = 300 + r() * (500 - kat * 120); A.binalar.push({ kat, x, w, h, pen: Array.from({ length: 12 }, () => [r(), r()]) }); x += w + 10 + r() * 40; }
    }
    A.agaclar = Array.from({ length: 18 }, (_, i) => ({ x: i * 240 + r() * 120, r: 70 + r() * 50, h: 260 + r() * 80 }));
    A.direkler = Array.from({ length: 12 }, (_, i) => i * 380 + r() * 60);
  }
  function sokak(ctx, t, kaydir, sicak) {
    // gökyüzü
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, `rgb(${mix('40,52,74', '255,196,140', sicak)})`); g.addColorStop(0.5, `rgb(${mix('92,104,124', '255,170,110', sicak)})`); g.addColorStop(0.62, `rgb(${mix('118,126,140', '255,214,160', sicak)})`); g.addColorStop(1, `rgb(${mix('28,32,42', '96,58,40', sicak)})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (sicak > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = sicak; ctx.drawImage(parilti('255,220,160'), 760 - 520, 980 - 520, 1040, 1040); ctx.restore(); }
    // binalar (parallaks)
    for (const b of A.binalar) {
      const par = [0.25, 0.5, 0.8][b.kat], x = b.x - kaydir * par;
      if (x > W + 50 || x + b.w < -50) continue;
      const taban = 1220 + b.kat * 40;
      ctx.fillStyle = `rgba(${mix(['70,78,92', '52,58,72', '34,38,48'][b.kat], ['200,120,90', '150,85,70', '96,56,48'][b.kat], sicak)},1)`;
      ctx.fillRect(x, taban - b.h, b.w, b.h + 20);
      ctx.fillStyle = `rgba(${mix('180,195,220', '255,230,170', sicak)},${0.12 + 0.18 * sicak})`;
      for (const [px, py] of b.pen) ctx.fillRect(x + 12 + px * (b.w - 36), taban - b.h + 20 + py * (b.h - 60), 14, 20);
    }
    // ağaçlar ve direkler
    for (const a of A.agaclar) {
      const x = a.x - kaydir * 1.0;
      if (x < -150 || x > W + 150) continue;
      ctx.fillStyle = `rgb(${mix('30,34,40', '70,44,30', sicak)})`; ctx.fillRect(x - 10, 1300 - a.h, 20, a.h);
      ctx.fillStyle = `rgba(${mix('44,56,58', '120,110,50', sicak)},0.95)`; ctx.beginPath(); ctx.arc(x, 1300 - a.h, a.r, 0, TAU); ctx.arc(x + a.r * 0.6, 1300 - a.h + 20, a.r * 0.7, 0, TAU); ctx.arc(x - a.r * 0.6, 1300 - a.h + 25, a.r * 0.7, 0, TAU); ctx.fill();
    }
    // kaldırım
    const k = ctx.createLinearGradient(0, 1300, 0, H);
    k.addColorStop(0, `rgb(${mix('60,64,72', '190,130,90', sicak)})`); k.addColorStop(1, `rgb(${mix('20,22,28', '60,36,26', sicak)})`);
    ctx.fillStyle = k; ctx.fillRect(0, 1300, W, H - 1300);
    ctx.strokeStyle = `rgba(${mix('120,130,150', '255,210,160', sicak)},0.18)`; ctx.lineWidth = 3;
    for (let x = -((kaydir * 1.2) % 160); x < W; x += 160) { ctx.beginPath(); ctx.moveTo(x, 1300); ctx.lineTo(x - 260, H); ctx.stroke(); }
    // ışık sızıntısı / soğuk sis
    ctx.save(); ctx.globalCompositeOperation = sicak > 0.5 ? 'lighter' : 'source-over';
    ctx.globalAlpha = 0.25 * (sicak > 0.5 ? sicak : 1 - sicak);
    ctx.drawImage(parilti(sicak > 0.5 ? '255,180,110' : '160,175,200'), -300, 200, 900, 900);
    ctx.restore();
  }

  VIDEO.sahne('_ortak', {
    hazirla() {
      sokakHazirla();
      // zihin: anı görüntüsünden (geçmiş) yeni anlam görüntüsüne (bugün) parçacık dönüşümü
      const ciz = (sicak) => {
        const c = tuval(), x = c.getContext('2d');
        x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
        sokak(x, 0, 600, sicak);
        if (sicak > 0.5) ikiliKisi(x, 560, 1340, 520, { faz: 1, yuru: 1, genc: true }, ALTIN, '255,140,90', '#2a1610');
        else ikiliKisi(x, 560, 1340, 520, { faz: 0.3, yuru: 0.3, egim: 0.5 }, SOGUK, '90,110,150', '#10131a');
        return c;
      };
      const a = ciz(1), b = ciz(0);
      const ornek = (cv, seed) => {
        const d = cv.getContext('2d').getImageData(0, 0, W, H).data, r = rng(seed), out = [];
        const lum = (x, y) => { const k = (y * W + x) * 4; return d[k] * 0.3 + d[k + 1] * 0.59 + d[k + 2] * 0.11; };
        let deneme = 0;
        while (out.length < 4200 && deneme++ < 600000) {
          const x = 3 + Math.floor(r() * (W - 6)), y = Math.floor(220 + r() * 1290), k = (y * W + x) * 4;
          const kenar = Math.abs(lum(x + 3, y) - lum(x - 3, y)) + Math.abs(lum(x, y + 3) - lum(x, y - 3));
          if (kenar > 28 || r() < 0.05) out.push([x, y, d[k], d[k + 1], d[k + 2]]);
        }
        return out;
      };
      const pa = ornek(a, 3), pb = ornek(b, 4);
      A.morf = pa.map((p, i) => ({ a: p, b: pb[i], g: rng(i + 9)() }));
    },
    ciz() { },
  });

  // ================= 1) AYNA =================
  VIDEO.sahne('ayna', {
    ciz(ctx, S) {
      const t = S.t;
      const z = lerp(1.0, 1.08, ease.inOut(clamp(t / S.d)));
      const uzan = ramp(t, S.at(1, 0.0), S.at(1, 0.75));
      const gul = ramp(t, S.at(0, 0.1), S.at(0, 0.7));
      ctx.save(); kamera(ctx, 540, 880, z);
      // oda
      const g = ctx.createLinearGradient(0, 0, W, 0);
      g.addColorStop(0, '#05070d'); g.addColorStop(1, '#0d1424');
      ctx.fillStyle = g; ctx.fillRect(-100, -100, W + 200, H + 200);
      // ayna çerçevesi ve içi
      const AX = 610, AY = 260, AW = 440, AH = 1280;
      ctx.save();
      ctx.beginPath(); ctx.roundRect(AX, AY, AW, AH, 40); ctx.clip();
      const ig = ctx.createLinearGradient(AX, 0, AX + AW, 0);
      ig.addColorStop(0, '#3a2a22'); ig.addColorStop(1, '#6a4a34');
      ctx.fillStyle = ig; ctx.fillRect(AX, AY, AW, AH);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.7; ctx.drawImage(parilti('255,190,120'), AX + AW * 0.6 - 500, 700 - 500, 1000, 1000); ctx.restore();
      // genç yansıma (aynalanmış, gülümseyen)
      yuzGozde(ctx, t, { kenar: '255,210,150', on: '255,190,140', onGuc: 0.75, genc: true, gulumse: gul, egim: -0.05 }, 840, 820, 8.2, true);
      // yansıyan el
      if (uzan > 0) { ctx.save(); ctx.globalAlpha = uzan; ctx.fillStyle = '#2a1812'; ctx.strokeStyle = '#2a1812'; ctx.lineCap = 'round'; ctx.lineWidth = 64; ctx.beginPath(); ctx.moveTo(AX + 260, 1700); ctx.lineTo(lerp(AX + 230, AX + 40, uzan), lerp(1500, 1120, uzan)); ctx.stroke(); ctx.beginPath(); ctx.ellipse(lerp(AX + 230, AX + 30, uzan), lerp(1490, 1100, uzan), 46, 60, -0.3, 0, TAU); ctx.fill(); ctx.restore(); }
      // cam yansıması
      ctx.save(); ctx.globalAlpha = 0.12; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(AX + 80, AY); ctx.lineTo(AX + 200, AY); ctx.lineTo(AX + 40, AY + AH); ctx.lineTo(AX - 80, AY + AH); ctx.fill(); ctx.restore();
      ctx.restore();
      ctx.strokeStyle = '#1a1410'; ctx.lineWidth = 26; ctx.beginPath(); ctx.roundRect(AX, AY, AW, AH, 40); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,200,140,0.25)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(AX - 10, AY - 10, AW + 20, AH + 20, 46); ctx.stroke();
      // bugünkü karakter (soğuk, özlem dolu)
      yuzGozde(ctx, t, { kenar: SOGUK, on: '120,150,200', onGuc: 0.45, dolu: ramp(t, S.at(1, 0.2), S.at(1, 1)), egim: 0.04 }, 330, 820, 8.2);
      // uzanan el (aynaya)
      if (uzan > 0) {
        ctx.save(); ctx.fillStyle = '#06080e'; ctx.strokeStyle = '#06080e'; ctx.lineCap = 'round'; ctx.lineWidth = 70;
        const hx = lerp(380, 590, uzan), hy = lerp(1550, 1120, uzan);
        ctx.beginPath(); ctx.moveTo(250, 1950); ctx.quadraticCurveTo(300, 1500, hx, hy); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(hx + 10, hy - 8, 50, 64, 0.3, 0, TAU); ctx.fill();
        ctx.strokeStyle = `rgba(${SOGUK},0.5)`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(hx + 12, hy - 10, 50, 64, 0.3, -1.2, 1.2); ctx.stroke();
        ctx.restore();
        if (uzan > 0.9) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (uzan - 0.9) * 10 * 0.8; ctx.drawImage(parilti(ALTIN), 610 - 120, 1110 - 120, 240, 240); ctx.restore(); }
      }
      ctx.restore();
      bokeh(ctx, t, 10, 4, ALTIN, [2, 7], 0.12, 4);
    },
  });

  // ================= 2) GEÇMİŞ: GÜNEŞLİ SOKAK =================
  VIDEO.sahne('gecmis', {
    ciz(ctx, S) {
      const t = S.t;
      const yakinBas = S.at(1, 0.15), yakinU = ramp(t, yakinBas, yakinBas + 0.8);
      if (yakinU < 1) {
        sokak(ctx, t, 300 + t * 140, 1);
        ikiliKisi(ctx, 520, 1430, 640, { faz: t * 5.2, yuru: 1, genc: true }, ALTIN, '255,140,90', '#2a1610');
        // ışık sızıntısı
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35 + 0.1 * Math.sin(t * 1.3);
        ctx.drawImage(parilti('255,200,140'), W - 500 + Math.sin(t * 0.5) * 60, -200, 900, 900); ctx.restore();
      }
      if (yakinU > 0) {
        ctx.save(); ctx.globalAlpha = yakinU;
        sokak(ctx, t, 300 + t * 140, 1);
        ctx.save(); ctx.filter = 'blur(10px)'; ctx.globalAlpha = 0.6; ctx.drawImage(ctx.canvas, 0, 0); ctx.restore();
        yuzGozde(ctx, t, { kenar: '255,215,160', on: '255,200,150', onGuc: 0.85, genc: true, gulumse: 1, egim: -0.06 + 0.02 * Math.sin(t * 2) }, 620, 800, lerp(8.5, 9.5, clamp((t - yakinBas) / 3)));
        ctx.restore();
      }
      bokeh(ctx, t, 26, 7, ALTIN, [4, 16], 0.28, 10);
    },
  });

  // ================= 3) BUGÜN: AYNI SOKAK, SOĞUK =================
  VIDEO.sahne('bugun', {
    ciz(ctx, S) {
      const t = S.t;
      const yakinBas = S.at(0, 0.45), yakinU = ramp(t, yakinBas, yakinBas + 0.9);
      if (yakinU < 1) {
        sokak(ctx, t, 300 + t * 70, 0);
        ikiliKisi(ctx, 520, 1430, 640, { faz: t * 3.2, yuru: 0.55, egim: 0.45 }, SOGUK, '90,110,150', '#10131a');
      }
      if (yakinU > 0) {
        ctx.save(); ctx.globalAlpha = yakinU;
        const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#2a3242'); g.addColorStop(1, '#0c1018');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        const K = lerp(8.5, 10.5, clamp((t - yakinBas) / 3));
        // geçmişin gülümsemesi: soluk sıcak hayalet
        const hay = pencere(t, yakinBas + 0.3, S.d + 1, 0.6) * (0.4 + 0.1 * Math.sin(t * 2));
        if (hay > 0) { ctx.save(); ctx.globalAlpha = yakinU * hay; ctx.translate(-40, -20); yuzGozde(ctx, t, { kenar: '255,210,150', on: '255,190,140', onGuc: 0.8, genc: true, gulumse: 1, egim: -0.06 }, 620, 800, K); ctx.restore(); }
        yuzGozde(ctx, t, { kenar: SOGUK, on: '110,130,170', onGuc: 0.35, dolu: 0.6, egim: 0.1 }, 620, 800, K);
        ctx.restore();
      }
      ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = 'rgba(40,70,120,0.5)'; ctx.fillRect(0, 0, W, H); ctx.restore();
      bokeh(ctx, t, 12, 8, '170,190,220', [3, 9], 0.12, 5);
    },
  });

  // ================= 4) ZİHİN: ANILAR YENİDEN ŞEKİLLENİR =================
  VIDEO.sahne('zihin', {
    ciz(ctx, S) {
      const t = S.t;
      const olus = ramp(t, 0, S.at(0, 0.3), ease.out);                 // ışık parçacıkları anıyı oluşturur
      const yeni = ramp(t, S.at(0, 0.5), S.at(0, 0.9));                // "bugünkü duygularımızla yeniden…"
      const g = ctx.createRadialGradient(540, 900, 50, 540, 900, 1200);
      g.addColorStop(0, '#0f1a34'); g.addColorStop(1, '#02040a');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.save();
      const z = lerp(1.25, 0.95, ease.inOut(clamp(t / S.d)));
      ctx.translate(540, 900); ctx.scale(z, z); ctx.rotate(Math.sin(t * 0.3) * 0.02); ctx.translate(-540, -900);
      // anı çerçevesi
      ctx.strokeStyle = `rgba(${mix(ALTIN, TRK, yeni)},${0.5 * olus})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(60, 180, 960, 1360, 30); ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      for (const p of A.morf) {
        const dag = 1 - clamp((olus - p.g * 0.4) / 0.6);                          // önce dağınık
        const u = ease.inOut(clamp((yeni - p.g * 0.35) / 0.65));
        const sw = Math.sin(Math.PI * u) * 120 + dag * 600;
        const x = lerp(p.a[0], p.b[0], u) + Math.cos(p.g * 50 + t) * sw, y = lerp(p.a[1], p.b[1], u) + Math.sin(p.g * 50 + t * 0.8) * sw;
        const r = Math.round(lerp(p.a[2], p.b[2] * 0.6 + 47 * 0.4, u)), gg = Math.round(lerp(p.a[3], p.b[3] * 0.6 + 211 * 0.4, u)), b = Math.round(lerp(p.a[4], p.b[4] * 0.6 + 198 * 0.4, u));
        ctx.globalAlpha = (0.5 + 0.4 * Math.sin(t * 2 + p.g * 20)) * clamp(olus * 1.5);
        ctx.fillStyle = `rgb(${r},${gg},${b})`;
        const s = 6 + 3 * Math.sin(Math.PI * u);
        ctx.fillRect(x - s / 2, y - s / 2, s, s);
      }
      ctx.restore();
      // ince yankı halkaları
      if (yeni > 0 && yeni < 1) { ctx.save(); ctx.strokeStyle = `rgba(${TRK},${0.4 * Math.sin(Math.PI * yeni)})`; ctx.lineWidth = 3; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(540, 860, 200 + ((t * 260 + k * 200) % 700), 0, TAU); ctx.stroke(); } ctx.restore(); }
      bokeh(ctx, t, 20, 11, TRK, [2, 8], 0.2, 6);
    },
  });

  // ================= 5) BİRLEŞME VE LOGO =================
  function logo(ctx, t, a) {
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha = a;
    const cX = 540, cY = 820, R = 180, c = ramp(t, 0, 1.1);
    ctx.strokeStyle = `rgba(${TRK},0.95)`; ctx.lineWidth = 6; ctx.shadowColor = `rgba(${TRK},0.8)`; ctx.shadowBlur = 24;
    ctx.beginPath(); ctx.arc(cX, cY, R, -Math.PI / 2, -Math.PI / 2 + TAU * c); ctx.stroke();
    ctx.lineWidth = 2.5; ctx.globalAlpha = a * ramp(t, 0.4, 1.2);
    for (const k of [0.35, 0.7]) { ctx.beginPath(); ctx.ellipse(cX, cY, R * k, R, 0, 0, TAU); ctx.stroke(); }
    for (const k of [-0.5, 0, 0.5]) { const yy = cY + k * R, rr = Math.sqrt(1 - k * k) * R; ctx.beginPath(); ctx.ellipse(cX, yy, rr, rr * 0.18, 0, 0, TAU); ctx.stroke(); }
    ctx.shadowBlur = 0; ctx.globalAlpha = a * ramp(t, 0.6, 1.4);
    ctx.save(); ctx.translate(cX - 10, cY + 10); ctx.scale(2.45, 2.45); ctx.fillStyle = 'rgba(8,16,34,0.85)'; ctx.fill(BAS); ctx.strokeStyle = `rgba(${TRK},0.9)`; ctx.lineWidth = 1.2; ctx.stroke(BAS); ctx.restore();
    ctx.restore();
    const harf = 'İNSAN ATLASI'.split('');
    ctx.save(); ctx.font = `800 80px ${FONT}`; ctx.letterSpacing = '14px';
    const w = ctx.measureText(harf.join('')).width; let x = W / 2 - w / 2;
    harf.forEach((h, i) => { const ha = ramp(t, 0.5 + i * 0.05, 1.0 + i * 0.05) * a; yazi(ctx, h, x + ctx.measureText(h).width / 2, 1110 + (1 - ha) * 18, { boyut: 80, agirlik: 800, alfa: ha, golgeRenk: `rgba(${TRK},0.6)`, golgeBulanik: 26 }); x += ctx.measureText(h).width + 14; });
    ctx.restore();
  }
  VIDEO.sahne('birlesme', {
    ciz(ctx, S) {
      const t = S.t;
      const dokun = ramp(t, S.at(0, 0.15), S.at(0, 0.7));
      const birles = ramp(t, S.at(1, 0.1), S.at(1, 0.9));
      const sicak = ramp(t, S.at(0, 0.5), S.at(1, 1));
      const kb = S.konusma.end;
      // ortam: soğuktan sıcağa
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, `rgb(${mix('12,18,32', '80,50,40', sicak)})`); g.addColorStop(1, `rgb(${mix('4,6,12', '30,18,14', sicak)})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.2 + 0.6 * sicak; ctx.drawImage(parilti('255,190,120'), 600 - 800, 900 - 800, 1600, 1600); ctx.restore();
      const z = lerp(1.05, 1.15, ease.inOut(clamp(t / S.d)));
      ctx.save(); kamera(ctx, 560, 1000, z);
      // bugünkü karakter
      const bugunKenar = mix(SOGUK, ALTIN, sicak);
      ikiliKisi(ctx, 640, 1500, 760, { egim: lerp(0.45, 0.05, sicak) }, bugunKenar, '90,110,150', '#0c0e14');
      // genç karakter: arkadan gelir, omzuna dokunur, ışıkta birleşir
      if (birles < 1) {
        ctx.save(); ctx.globalAlpha = 1 - birles;
        const gx = lerp(lerp(260, 430, dokun), 640, ease.inOut(birles));
        const omuzHedef = [(640 - gx) / 7.6 + 2, 1.5];
        ikiliKisi(ctx, gx, 1500, 740, { faz: 0.6, yuru: 0.3 * (1 - dokun), genc: true, kol: dokun > 0.05 ? [lerp(10, omuzHedef[0], dokun), lerp(30, omuzHedef[1], dokun)] : null }, ALTIN, '255,140,90', '#2a1610');
        ctx.restore();
      }
      if (birles > 0) {
        const r = rng(2);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (let k = 0; k < 120; k++) { const u = clamp((birles - r() * 0.4) / 0.6), x = lerp(430 + (r() - 0.5) * 160, 640, ease.inOut(u)), y = 1500 - r() * 740; ctx.globalAlpha = Math.sin(Math.PI * u) * 0.8; ctx.drawImage(parilti(ALTIN), x - 9, y - 9, 18, 18); }
        ctx.globalAlpha = Math.sin(Math.PI * birles) * 0.6; ctx.drawImage(parilti('255,220,170'), 640 - 400, 1050 - 500, 800, 1000);
        ctx.restore();
      }
      ctx.restore();
      bokeh(ctx, t, 20, 15, mix(SOGUK, ALTIN, sicak), [3, 10], 0.22, 6);
      // kararma → logo
      const kar = ramp(t, kb - 0.2, kb + 0.6);
      if (kar > 0) { ctx.fillStyle = `rgba(2,4,10,${kar})`; ctx.fillRect(0, 0, W, H); }
      const la = ramp(t, kb + 0.3, kb + 0.9);
      if (la > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = la * 0.5; ctx.drawImage(parilti(TRK), 540 - 500, 820 - 500, 1000, 1000); ctx.restore(); logo(ctx, t - (kb + 0.3), la); }
    },
  });
})();
