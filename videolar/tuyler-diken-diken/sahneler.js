/* "Korktuğumuzda neden tüylerimiz diken diken olur?" — sahneler
 * Tüm görüntüler kodla (Canvas 2D) prosedürel olarak çizilir. Harici görsel/video yok.
 * Her sahne: ciz(ctx, S) — S.t yerel saniye, S.at(cümle, oran) cümleye göre zaman.
 */
(function () {
  const { W, H, clamp, lerp, inv, ease, ramp, pencere, rng, fbm, tuval, gurultuDokusu, etiket, yazi } = STUDIO.R;
  const A = {}; // ortak varlıklar
  const TAU = Math.PI * 2;

  function kamera(ctx, cx, cy, z, rot = 0) {
    ctx.translate(W / 2, H / 2); ctx.rotate(rot); ctx.scale(z, z); ctx.translate(-cx, -cy);
  }
  // anahtar kare enterpolasyonu: [[t, deger], ...] (değer sayı ya da dizi)
  function kf(t, anahtarlar, e = ease.inOut) {
    if (t <= anahtarlar[0][0]) return anahtarlar[0][1];
    for (let i = 0; i < anahtarlar.length - 1; i++) {
      const [t0, v0] = anahtarlar[i], [t1, v1] = anahtarlar[i + 1];
      if (t < t1) {
        const u = e(clamp((t - t0) / Math.max(1e-4, t1 - t0)));
        return Array.isArray(v0) ? v0.map((v, k) => lerp(v, v1[k], u)) : lerp(v0, v1, u);
      }
    }
    return anahtarlar[anahtarlar.length - 1][1];
  }
  const sprite = (r, ic) => {
    const c = tuval(r * 2, r * 2), x = c.getContext('2d');
    const g = x.createRadialGradient(r, r, 0, r, r, r);
    ic(g); x.fillStyle = g; x.fillRect(0, 0, r * 2, r * 2); return c;
  };

  // Alan derinliği: üst ve alt bantları bulanıklaştır
  function alanDerinligi(ctx, kaynak, guc = 14, odakY = 0.5, bant = 0.22) {
    const g = A.dof, gx = g.getContext('2d');
    gx.setTransform(1, 0, 0, 1, 0, 0); gx.globalCompositeOperation = 'source-over';
    gx.clearRect(0, 0, W, H);
    gx.filter = `blur(${guc}px)`; gx.drawImage(kaynak, 0, 0); gx.filter = 'none';
    gx.globalCompositeOperation = 'destination-in';
    const m = gx.createLinearGradient(0, 0, 0, H);
    const a = clamp(odakY - bant), b = clamp(odakY + bant);
    m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(a, 'rgba(0,0,0,0)'); m.addColorStop(b, 'rgba(0,0,0,0)'); m.addColorStop(1, 'rgba(0,0,0,1)');
    gx.fillStyle = m; gx.fillRect(0, 0, W, H);
    gx.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(g, 0, 0); ctx.restore();
  }

  // Toz / bokeh parçacıkları
  function bokeh(ctx, t, n, seed, renk, boyut = [3, 14], alfa = 0.35, hiz = 12) {
    const r = rng(seed);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const x0 = r() * W, y0 = r() * H, s = lerp(boyut[0], boyut[1], r()), ph = r() * TAU, v = (0.4 + r()) * hiz;
      const x = (x0 + Math.sin(t * 0.3 + ph) * 30 + t * v * 0.3) % (W + 40) - 20;
      const y = ((y0 - t * v) % (H + 40) + H + 40) % (H + 40) - 20;
      const a = alfa * (0.4 + 0.6 * Math.sin(t * 0.8 + ph) ** 2);
      ctx.globalAlpha = a;
      ctx.drawImage(renk === 'sicak' ? A.bokehSicak : A.bokehSoguk, x - s, y - s, s * 2, s * 2);
    }
    ctx.restore();
  }

  // ================= ORTAK HAZIRLIK =================
  VIDEO.sahne('_ortak', {
    hazirla() {
      A.dof = tuval();
      A.bokehSicak = sprite(32, g => { g.addColorStop(0, 'rgba(255,200,140,0.9)'); g.addColorStop(0.5, 'rgba(255,160,90,0.25)'); g.addColorStop(1, 'rgba(255,140,60,0)'); });
      A.bokehSoguk = sprite(32, g => { g.addColorStop(0, 'rgba(180,215,255,0.9)'); g.addColorStop(0.5, 'rgba(120,170,255,0.22)'); g.addColorStop(1, 'rgba(100,150,255,0)'); });
      A.parilti = sprite(64, g => { g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.2, 'rgba(255,230,180,0.6)'); g.addColorStop(1, 'rgba(255,180,90,0)'); });
      A.sis = gurultuDokusu(800, 450, 160, 11, (f) => { const a = clamp((f - 0.42) * 2.2); return [190, 205, 230, a * 150]; }, 5);
      sokakHazirla();
      deriMakroHazirla();
      kesitHazirla();
      evrimHazirla();
    },
    ciz() { },
  });

  // ================= SOKAK =================
  function sokakHazirla() {
    const r = rng(3);
    // Gökyüzü + uzak binalar
    const g = tuval(), x = g.getContext('2d');
    let gr = x.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#03050a'); gr.addColorStop(0.45, '#0a1322'); gr.addColorStop(0.62, '#1a2a40'); gr.addColorStop(1, '#0a0f18');
    x.fillStyle = gr; x.fillRect(0, 0, W, H);
    const ay = x.createRadialGradient(380, 520, 10, 380, 520, 520);
    ay.addColorStop(0, 'rgba(170,200,255,0.35)'); ay.addColorStop(1, 'rgba(170,200,255,0)');
    x.fillStyle = ay; x.fillRect(0, 0, W, H);
    for (let k = 0; k < 2; k++) {
      let bx = 300;
      while (bx < 800) {
        const bw = 40 + r() * 70, bh = 120 + r() * (k ? 260 : 380);
        const top = 1110 - bh;
        x.fillStyle = k ? '#0b1220' : '#111b2c';
        x.fillRect(bx, top, bw, bh + 20);
        x.fillStyle = 'rgba(255,190,120,0.55)';
        for (let wy = top + 10; wy < 1100; wy += 16) for (let wx = bx + 6; wx < bx + bw - 6; wx += 12) if (r() < 0.12) x.fillRect(wx, wy, 5, 7);
        bx += bw + r() * 10;
      }
    }
    A.sokakGok = g;

    // Duvarlar + zemin (perspektif) — ortası boş
    const s = tuval(), y = s.getContext('2d');
    const VPY = 1120;
    const duvarDoku = gurultuDokusu(540, 960, 40, 21, (f, i, j) => { const tugla = ((j % 22) < 2 || ((i + (Math.floor(j / 22) % 2) * 18) % 36) < 2) ? 0.7 : 1; const v = (14 + f * 22) * tugla; return [v * 0.8, v * 0.85, v * 1.1]; }, 3);
    const duvar = (pts, isik) => {
      y.save(); y.beginPath(); pts.forEach((p, i) => i ? y.lineTo(p[0], p[1]) : y.moveTo(p[0], p[1])); y.closePath(); y.clip();
      y.drawImage(duvarDoku, 0, 0, W, H);
      const lg = y.createLinearGradient(isik ? W : 0, 0, W / 2, 0);
      lg.addColorStop(0, 'rgba(0,0,0,0.75)'); lg.addColorStop(1, 'rgba(0,0,0,0.15)');
      y.fillStyle = lg; y.fillRect(0, 0, W, H);
      y.restore();
    };
    duvar([[0, 0], [455, 760], [470, VPY + 6], [0, H]], false);
    duvar([[W, 0], [625, 760], [610, VPY + 6], [W, H]], true);
    // pencereler / kapı (sol duvar)
    y.fillStyle = 'rgba(255,170,90,0.18)';
    y.beginPath(); y.moveTo(150, 520); y.lineTo(260, 610); y.lineTo(260, 760); y.lineTo(150, 700); y.fill();
    y.fillStyle = 'rgba(0,0,0,0.55)';
    y.beginPath(); y.moveTo(330, 960); y.lineTo(410, 1020); y.lineTo(410, 1170); y.lineTo(330, 1180); y.fill();
    // zemin: ıslak asfalt
    y.save();
    y.beginPath(); y.moveTo(0, H); y.lineTo(470, VPY); y.lineTo(610, VPY); y.lineTo(W, H); y.closePath(); y.clip();
    const zemin = gurultuDokusu(270, 480, 20, 31, f => { const v = 10 + f * 26; return [v * 0.85, v * 0.9, v * 1.15]; }, 4);
    y.drawImage(zemin, 0, VPY, W, H - VPY);
    gr = y.createLinearGradient(0, VPY, 0, H);
    gr.addColorStop(0, 'rgba(60,80,110,0.5)'); gr.addColorStop(0.3, 'rgba(0,0,0,0.1)'); gr.addColorStop(1, 'rgba(0,0,0,0.55)');
    y.fillStyle = gr; y.fillRect(0, VPY, W, H - VPY);
    // kaldırım çizgileri
    y.strokeStyle = 'rgba(140,160,190,0.18)'; y.lineWidth = 3;
    [[200, H], [880, H]].forEach(p => { y.beginPath(); y.moveTo(p[0], p[1]); y.lineTo(lerp(470, 610, p[0] / W), VPY); y.stroke(); });
    // su birikintileri
    for (let k = 0; k < 9; k++) {
      const py = lerp(VPY + 60, H - 80, r()), sc = (py - VPY) / (H - VPY), px = 540 + (r() - 0.5) * 700 * sc;
      y.fillStyle = 'rgba(120,150,200,0.10)';
      y.beginPath(); y.ellipse(px, py, 120 * sc + 20, 16 * sc + 4, 0, 0, TAU); y.fill();
    }
    y.restore();
    // sokak lambası direği (sağ duvar)
    y.strokeStyle = '#05070a'; y.lineWidth = 10;
    y.beginPath(); y.moveTo(842, 560); y.lineTo(842, 640); y.lineTo(770, 690); y.stroke();
    y.fillStyle = '#05070a'; y.beginPath(); y.moveTo(745, 690); y.lineTo(795, 690); y.lineTo(782, 712); y.lineTo(758, 712); y.fill();
    A.sokak = s;

    A.lambaHale = sprite(400, g => { g.addColorStop(0, 'rgba(255,214,150,0.95)'); g.addColorStop(0.08, 'rgba(255,180,100,0.55)'); g.addColorStop(0.35, 'rgba(255,150,70,0.16)'); g.addColorStop(1, 'rgba(255,140,60,0)'); });
    A.zeminIsik = sprite(300, g => { g.addColorStop(0, 'rgba(255,175,95,0.42)'); g.addColorStop(1, 'rgba(255,150,70,0)'); });
  }

  // Ön görünüş insan silueti
  function kisi(ctx, cx, ayakY, h, p, renk) {
    const u = h / 100;
    const faz = p.faz || 0, yur = p.yuru || 0;
    const bob = -Math.abs(Math.sin(faz)) * 1.1 * u * yur;
    const omuzKalk = (p.irkil || 0) * 2.2 * u;
    const kalcaY = ayakY - 47 * u + bob;
    const omuzY = ayakY - 82 * u + bob - omuzKalk;
    ctx.fillStyle = renk; ctx.strokeStyle = renk; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // bacaklar
    [[-1, Math.max(0, Math.sin(faz))], [1, Math.max(0, -Math.sin(faz))]].forEach(([s, kalk]) => {
      const kl = kalk * 3.2 * u * yur;
      const ax = cx + s * 4.6 * u, ay = ayakY - kl;
      ctx.beginPath();
      ctx.moveTo(cx + s * 0.6 * u, kalcaY); ctx.lineTo(cx + s * 9.6 * u, kalcaY);
      ctx.lineTo(ax + s * 3.4 * u, ay - 2 * u); ctx.lineTo(ax - s * 2.2 * u, ay - 2 * u); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.ellipse(ax + s * 0.6 * u, ay - 0.6 * u, 3.6 * u, 1.9 * u, 0, 0, TAU); ctx.fill();
    });
    // gövde (ceket)
    ctx.beginPath();
    ctx.moveTo(cx - 10.5 * u, kalcaY + 3 * u);
    ctx.lineTo(cx - 13.2 * u, omuzY + 5 * u);
    ctx.quadraticCurveTo(cx - 13 * u, omuzY, cx - 7 * u, omuzY - 1.2 * u);
    ctx.lineTo(cx + 7 * u, omuzY - 1.2 * u);
    ctx.quadraticCurveTo(cx + 13 * u, omuzY, cx + 13.2 * u, omuzY + 5 * u);
    ctx.lineTo(cx + 10.5 * u, kalcaY + 3 * u); ctx.closePath(); ctx.fill();
    // kollar
    const salin = Math.sin(faz) * 2.2 * u * yur;
    const kolK = p.kol || 0;
    ctx.lineWidth = 5.6 * u;
    // sol kol (izleyiciye göre sağ) — sallanır
    ctx.beginPath(); ctx.moveTo(cx + 11.6 * u, omuzY + 3 * u);
    ctx.lineTo(cx + 14.2 * u + salin * 0.3, omuzY + 19 * u); ctx.lineTo(cx + 13.4 * u + salin, omuzY + 35 * u); ctx.stroke();
    // sağ kol — kaldırılıp göğse doğru getirilir
    const dirsek = [lerp(cx - 14.2 * u - salin * 0.3, cx - 17 * u, kolK), lerp(omuzY + 19 * u, omuzY + 22 * u, kolK)];
    const el = [lerp(cx - 13.4 * u - salin, cx - 2 * u, kolK), lerp(omuzY + 35 * u, omuzY + 15 * u, kolK)];
    ctx.beginPath(); ctx.moveTo(cx - 11.6 * u, omuzY + 3 * u); ctx.lineTo(dirsek[0], dirsek[1]); ctx.lineTo(el[0], el[1]); ctx.stroke();
    ctx.beginPath(); ctx.arc(el[0], el[1], 3 * u, 0, TAU); ctx.fill();
    // boyun + baş
    const basX = cx + (p.basDon || 0) * 2.6 * u, basY = omuzY - 9.5 * u + (p.basEgik || 0) * 2.4 * u;
    ctx.fillRect(cx - 2.6 * u, omuzY - 5 * u, 5.2 * u, 5 * u);
    ctx.beginPath(); ctx.ellipse(basX, basY, 6.1 * u * (1 - Math.abs(p.basDon || 0) * 0.08), 7.4 * u, (p.basDon || 0) * 0.12, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(basX - 0.4 * u, basY - 4.2 * u, 6.6 * u, 4.4 * u, -0.1, Math.PI, TAU); ctx.fill();
  }

  // Sokak sahnesi çizimi (dünya = ekran koordinatı, kamera ile)
  function sokakCiz(ctx, t, kam, kisiP) {
    ctx.save();
    // gökyüzü (parallaks)
    ctx.save(); kamera(ctx, lerp(W / 2, kam.cx, 0.5), lerp(H / 2, kam.cy, 0.5), 1 + (kam.z - 1) * 0.5, kam.rot); ctx.drawImage(A.sokakGok, -60, -60, W + 120, H + 120); ctx.restore();
    kamera(ctx, kam.cx, kam.cy, kam.z, kam.rot);
    // uzak sis
    ctx.save(); ctx.globalAlpha = 0.55; ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(A.sis, -200 + (t * 18) % 400 - 200, 820, 1500, 520);
    ctx.restore();
    ctx.drawImage(A.sokak, 0, 0);
    // lamba ışığı (hafif titreme)
    const tit = 0.92 + 0.08 * Math.sin(t * 23) * Math.sin(t * 7.3);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.9 * tit; ctx.drawImage(A.lambaHale, 770 - 400, 712 - 400);
    // ışık konisi
    const kg = ctx.createLinearGradient(0, 712, 0, 1560);
    kg.addColorStop(0, `rgba(255,190,110,${0.20 * tit})`); kg.addColorStop(1, 'rgba(255,170,90,0)');
    ctx.fillStyle = kg; ctx.beginPath(); ctx.moveTo(752, 712); ctx.lineTo(788, 712); ctx.lineTo(1000, 1600); ctx.lineTo(420, 1600); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = tit; ctx.drawImage(A.zeminIsik, 690 - 300, 1470 - 120, 600, 240);
    // ıslak zemin yansıması
    ctx.globalAlpha = 0.35 * tit; ctx.filter = 'blur(6px)';
    ctx.drawImage(A.lambaHale, 740, 1300, 60, 520);
    ctx.filter = 'none';
    ctx.restore();
    // kişi
    if (kisiP) {
      const { x, y, h } = kisiP;
      ctx.save(); ctx.globalAlpha = 0.6; ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.beginPath(); ctx.ellipse(x, y, h * 0.16, h * 0.022, 0, 0, TAU); ctx.fill(); ctx.restore();
      kisi(ctx, x + h * 0.006, y, h, kisiP, 'rgba(255,170,95,0.85)');     // sıcak kenar ışığı (lamba)
      kisi(ctx, x - h * 0.005, y, h, kisiP, 'rgba(120,160,230,0.55)');    // soğuk kenar ışığı (ay)
      kisi(ctx, x, y, h, kisiP, '#06080c');
    }
    // ön sis
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.32;
    ctx.drawImage(A.sis, -300 - (t * 30) % 600, 1250, 1800, 700);
    ctx.restore();
    ctx.restore();
    // soğuk renk düzeltmesi
    ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = 'rgba(40,70,130,0.5)'; ctx.fillRect(0, 0, W, H); ctx.restore();
  }

  // ================= MAKRO DERİ =================
  function deriMakroHazirla() {
    const TW = 1500, TH = 2400, r = rng(5);
    const d = gurultuDokusu(TW / 2, TH / 2, 90, 41, (f, i, j) => {
      const g = fbm(i / 9, j / 9, 77, 3);
      const v = 0.82 + f * 0.3 + (g - 0.5) * 0.12;
      return [196 * v, 142 * v, 112 * v];
    }, 5);
    const c = tuval(TW, TH), x = c.getContext('2d');
    x.drawImage(d, 0, 0, TW, TH);
    // deri çizgileri (iki yönde ağ)
    x.lineCap = 'round';
    for (const aci of [0.62, -0.75]) {
      for (let k = 0; k < 70; k++) {
        const ox = r() * TW, oy = r() * TH, L = 300 + r() * 600;
        x.beginPath();
        for (let s = 0; s <= 1; s += 0.05) {
          const px = ox + Math.cos(aci) * L * s + Math.sin(s * 9 + k) * 6, py = oy + Math.sin(aci) * L * s;
          s ? x.lineTo(px, py) : x.moveTo(px, py);
        }
        x.strokeStyle = 'rgba(90,50,35,0.22)'; x.lineWidth = 2.2; x.stroke();
        x.translate(1.5, 1.5); x.strokeStyle = 'rgba(255,225,200,0.10)'; x.lineWidth = 1.2; x.stroke(); x.setTransform(1, 0, 0, 1, 0, 0);
      }
    }
    // gözenekler
    for (let k = 0; k < 2600; k++) {
      const px = r() * TW, py = r() * TH, rr = 0.8 + r() * 2.2;
      x.fillStyle = 'rgba(80,40,30,0.35)'; x.beginPath(); x.arc(px, py, rr, 0, TAU); x.fill();
      x.fillStyle = 'rgba(255,230,210,0.12)'; x.beginPath(); x.arc(px - 0.8, py - 0.8, rr * 0.7, 0, TAU); x.fill();
    }
    A.deriDoku = c; A.deriTW = TW; A.deriTH = TH;
    // kıllar
    A.killar = [];
    const adim = 78;
    for (let gy = 40; gy < TH - 40; gy += adim) for (let gx = 40; gx < TW - 40; gx += adim) {
      if (r() < 0.15) continue;
      A.killar.push({
        x: gx + (r() - 0.5) * adim * 0.95, y: gy + (r() - 0.5) * adim * 0.95,
        a: 0.5 + (r() - 0.5) * 1.3, L: 110 + r() * 90, k: 4 + r() * 3, kv: (r() - 0.5) * 1.2, gec: r(),
      });
    }
    A.kabarikIsik = sprite(24, g => { g.addColorStop(0, 'rgba(255,236,215,0.8)'); g.addColorStop(1, 'rgba(255,232,210,0)'); });
    A.kabarikGolge = sprite(24, g => { g.addColorStop(0, 'rgba(60,28,18,0.7)'); g.addColorStop(1, 'rgba(70,35,22,0)'); });
    A.makroTmp = tuval();
  }

  // e: tüylerin dikleşme oranı (0..1); kam: {cx,cy,z,rot} doku koordinatında
  function deriMakroCiz(ctx, t, e, kam, renk = 'gece') {
    const m = A.makroTmp, x = m.getContext('2d');
    x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
    x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
    x.save();
    kamera(x, kam.cx, kam.cy, kam.z, kam.rot || 0);
    x.drawImage(A.deriDoku, 0, 0);
    // görünür bölge
    const yaricap = (H / 2) / kam.z + 200;
    const titreme = e > 0.9 ? Math.sin(t * 9) * 0.02 : 0;
    x.lineCap = 'round';
    for (const k of A.killar) {
      if (Math.abs(k.x - kam.cx) > yaricap || Math.abs(k.y - kam.cy) > yaricap * 1.2) continue;
      const ek = ease.inOut(clamp((e - k.gec * 0.35) / 0.65));
      const th = lerp(0.08, 1.32, ek) + titreme;
      const ca = Math.cos(k.a), sa = Math.sin(k.a), ct = Math.cos(th), st = Math.sin(th);
      const dx = ca * ct * k.L, dy = sa * ct * k.L * 0.85 - st * k.L * 0.78;
      // kabarık (tüy dibi)
      if (ek > 0.02) {
        const s = 16 + 16 * ek;
        x.globalAlpha = ek; x.drawImage(A.kabarikGolge, k.x - s + 4, k.y - s + 5, s * 2, s * 2);
        x.drawImage(A.kabarikIsik, k.x - s - 3, k.y - s - 4, s * 2, s * 2);
        x.globalAlpha = 1;
      }
      // gölge
      const gx = ca * ct * k.L + st * k.L * 0.55, gy = sa * ct * k.L * 0.85 + st * k.L * 0.32;
      x.strokeStyle = 'rgba(60,30,20,0.22)'; x.lineWidth = k.k * 1.4;
      x.beginPath(); x.moveTo(k.x + 1, k.y + 1); x.quadraticCurveTo(k.x + gx * 0.5 + k.kv * 12, k.y + gy * 0.5, k.x + gx, k.y + gy); x.stroke();
      // kıl: incelen dolu şekil (kök kalın, uç ince)
      const qx = k.x + dx * 0.5 + k.kv * 26 * (1 - ek * 0.6), qy = k.y + dy * 0.5 + k.kv * 10;
      const sol = [], sag = [];
      for (let s = 0; s <= 1.0001; s += 0.2) {
        const v = 1 - s;
        const px = v * v * k.x + 2 * v * s * qx + s * s * (k.x + dx), py = v * v * k.y + 2 * v * s * qy + s * s * (k.y + dy);
        const tx = 2 * v * (qx - k.x) + 2 * s * (k.x + dx - qx), ty = 2 * v * (qy - k.y) + 2 * s * (k.y + dy - qy);
        const n = Math.hypot(tx, ty) || 1, w = k.k * (1 - 0.8 * s) * 0.5;
        sol.push([px - ty / n * w, py + tx / n * w]); sag.push([px + ty / n * w, py - tx / n * w]);
      }
      x.fillStyle = '#1e120c';
      x.beginPath(); sol.forEach((q, i) => i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1]));
      for (let i = sag.length - 1; i >= 0; i--) x.lineTo(sag[i][0], sag[i][1]);
      x.closePath(); x.fill();
      x.strokeStyle = 'rgba(255,215,170,0.45)'; x.lineWidth = Math.max(0.8, k.k * 0.22);
      x.beginPath(); x.moveTo(sol[1][0], sol[1][1]); for (let i = 2; i < sol.length - 1; i++) x.lineTo(sol[i][0], sol[i][1]); x.stroke();
    }
    x.restore();
    // ışık/renk
    if (renk === 'gece') {
      x.globalCompositeOperation = 'multiply'; x.fillStyle = 'rgba(70,92,140,1)'; x.globalAlpha = 0.82; x.fillRect(0, 0, W, H);
      x.globalAlpha = 1; const rk = x.createLinearGradient(W, 0, 0, H); rk.addColorStop(0, 'rgba(255,255,255,1)'); rk.addColorStop(0.55, 'rgba(150,150,160,1)'); rk.addColorStop(1, 'rgba(40,40,50,1)'); x.fillStyle = rk; x.fillRect(0, 0, W, H);
      x.globalCompositeOperation = 'screen'; x.globalAlpha = 1;
      const g = x.createRadialGradient(W * 0.85, H * 0.15, 50, W * 0.85, H * 0.15, H * 0.75);
      g.addColorStop(0, 'rgba(255,170,90,0.42)'); g.addColorStop(1, 'rgba(255,150,70,0)');
      x.fillStyle = g; x.fillRect(0, 0, W, H);
    } else {
      x.globalCompositeOperation = 'multiply'; x.fillStyle = 'rgba(175,130,110,1)'; x.globalAlpha = 0.6; x.fillRect(0, 0, W, H);
      x.globalAlpha = 1; const rk = x.createLinearGradient(0, 0, W, H); rk.addColorStop(0, 'rgba(255,255,255,1)'); rk.addColorStop(0.5, 'rgba(160,150,150,1)'); rk.addColorStop(1, 'rgba(45,35,35,1)'); x.fillStyle = rk; x.fillRect(0, 0, W, H);
      x.globalCompositeOperation = 'screen'; x.globalAlpha = 1;
      const g = x.createRadialGradient(W * 0.2, H * 0.1, 50, W * 0.2, H * 0.1, H * 0.8);
      g.addColorStop(0, 'rgba(255,200,140,0.40)'); g.addColorStop(1, 'rgba(255,170,90,0)');
      x.fillStyle = g; x.fillRect(0, 0, W, H);
    }
    x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
    ctx.drawImage(m, 0, 0);
    alanDerinligi(ctx, m, 16, 0.5, 0.2);
  }

  // ================= SAHNE 1: KORKU =================
  VIDEO.sahne('korku', {
    ciz(ctx, S) {
      const t = S.t;
      const korkuT = Math.max(0.6, S.R && STUDIO.TL.giris - 0.8);
      const makroBas = S.at(0, 0.40), makroGecis = 0.7;
      // ---- Sokak çekimi ----
      if (t < makroBas + makroGecis) {
        const yurume = clamp(t / korkuT);
        const dur = ramp(t, korkuT, korkuT + 0.3);
        const ayakY = lerp(1300, 1500, ease.out(yurume));
        const h = lerp(470, 640, ease.out(yurume));
        const s = t - korkuT;
        const irkil = s > 0 ? Math.exp(-s * 3) * Math.min(1, s * 12) : 0;
        const basDon = s > 0 ? pencere(s, 0.05, 1.5, 0.3) : 0;
        const kolK = ramp(t, S.at(0, 0.12), S.at(0, 0.34));
        const basEgik = ramp(t, S.at(0, 0.10), S.at(0, 0.30));
        const sars = s > 0 ? Math.exp(-s * 5) * 14 : 0;
        const sx = Math.sin(t * 61) * sars, sy = Math.cos(t * 53) * sars;
        let z = lerp(1.0, 1.06, clamp(t / korkuT)) + (s > 0 ? 0.08 * ease.out(clamp(s / 0.25)) : 0);
        z += 0.55 * ease.inOut(inv(S.at(0, 0.14), makroBas + makroGecis, t));
        const odak = [lerp(540, 520, kolK), lerp(1050, lerp(1080, 1180, kolK), clamp(z - 1))];
        sokakCiz(ctx, t, { cx: odak[0] + sx, cy: odak[1] + sy, z, rot: Math.sin(t * 0.5) * 0.004 },
          { x: 540, y: ayakY, h, faz: t * 7.5, yuru: 1 - dur, irkil, basDon: -basDon, basEgik, kol: kolK });
        // irkilme ışık patlaması
        if (s > 0 && s < 0.5) { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = `rgba(200,220,255,${0.22 * Math.exp(-s * 9)})`; ctx.fillRect(0, 0, W, H); ctx.restore(); }
      }
      // ---- Makro deri ----
      if (t > makroBas) {
        const u = ease.inOut(clamp((t - makroBas) / makroGecis));
        const e = ramp(t, S.at(0, 0.55), S.at(0, 0.93));
        const zt = clamp((t - makroBas) / (S.d - makroBas));
        const kam = { cx: lerp(760, 720, zt), cy: lerp(1260, 1180, zt), z: lerp(1.15, 1.75, ease.sine(zt)), rot: lerp(-0.05, 0.03, zt) };
        ctx.save();
        ctx.globalAlpha = u;
        if (u < 1) ctx.filter = `blur(${((1 - u) * 18).toFixed(1)}px)`;
        deriMakroCiz(ctx, t, e, kam, 'gece');
        ctx.restore();
        bokeh(ctx, t, 18, 4, 'soguk', [6, 20], 0.18 * u, 10);
      }
    },
  });

  // ================= SAHNE 2: DERİ KESİTİ =================
  const P = { x: 560, y: 566 };      // kılın deriden çıktığı nokta
  const YUZEY = 566, EPI = 76, DERMIS_SON = 1240;
  function yuzeyY(xx) { return YUZEY + 7 * Math.sin(xx / 95) + 4 * Math.sin(xx / 41 + 1); }

  function kesitHazirla() {
    const r = rng(9);
    const c = tuval(), x = c.getContext('2d');
    // arka plan (deri üstü: karanlık hava)
    let g = x.createLinearGradient(0, 0, 0, YUZEY);
    g.addColorStop(0, '#05070d'); g.addColorStop(1, '#141a28');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    const yol = (ust, alt) => {
      x.beginPath(); x.moveTo(0, ust(0));
      for (let xx = 0; xx <= W; xx += 10) x.lineTo(xx, ust(xx));
      for (let xx = W; xx >= 0; xx -= 10) x.lineTo(xx, alt(xx));
      x.closePath();
    };
    // yağ dokusu (hipodermis)
    yol(xx => DERMIS_SON + 18 * Math.sin(xx / 130), () => H + 10);
    g = x.createLinearGradient(0, DERMIS_SON, 0, H);
    g.addColorStop(0, '#d7a24f'); g.addColorStop(1, '#8a5a24');
    x.fillStyle = g; x.fill();
    x.save(); x.clip();
    for (let k = 0; k < 160; k++) {
      const px = r() * W, py = DERMIS_SON + r() * (H - DERMIS_SON), rr = 30 + r() * 46;
      const lg = x.createRadialGradient(px - rr * 0.3, py - rr * 0.3, rr * 0.1, px, py, rr);
      lg.addColorStop(0, 'rgba(255,236,170,0.95)'); lg.addColorStop(0.7, 'rgba(240,196,100,0.85)'); lg.addColorStop(1, 'rgba(170,100,50,0.9)');
      x.fillStyle = lg; x.beginPath(); x.arc(px, py, rr, 0, TAU); x.fill();
    }
    x.restore();
    // dermis
    yol(xx => yuzeyY(xx) + EPI, xx => DERMIS_SON + 18 * Math.sin(xx / 130));
    g = x.createLinearGradient(0, YUZEY, 0, DERMIS_SON);
    g.addColorStop(0, '#d98a7e'); g.addColorStop(1, '#a8505a');
    x.fillStyle = g; x.fill();
    x.save(); x.clip();
    // kolajen lifleri
    x.lineCap = 'round';
    for (let k = 0; k < 520; k++) {
      const px = r() * W, py = YUZEY + EPI + r() * (DERMIS_SON - YUZEY - EPI), L = 60 + r() * 160, a = (r() - 0.5) * 0.9;
      x.strokeStyle = `rgba(255,${200 + r() * 40},${190 + r() * 40},${0.08 + r() * 0.14})`; x.lineWidth = 2 + r() * 4;
      x.beginPath(); x.moveTo(px, py);
      x.bezierCurveTo(px + L * 0.33, py + Math.sin(k) * 14 + a * L * 0.3, px + L * 0.66, py - Math.cos(k) * 14 + a * L * 0.6, px + L, py + a * L);
      x.stroke();
    }
    // kan damarları
    const damar = (renk, yy, kalin) => {
      x.strokeStyle = renk; x.lineWidth = kalin; x.shadowColor = renk; x.shadowBlur = 16;
      x.beginPath(); x.moveTo(-20, yy);
      for (let xx = 0; xx <= W + 20; xx += 20) x.lineTo(xx, yy + 26 * Math.sin(xx / 140) + 12 * Math.sin(xx / 47));
      x.stroke(); x.shadowBlur = 0;
      x.strokeStyle = 'rgba(255,255,255,0.25)'; x.lineWidth = kalin * 0.25;
      x.beginPath(); x.moveTo(-20, yy - kalin * 0.25);
      for (let xx = 0; xx <= W + 20; xx += 20) x.lineTo(xx, yy - kalin * 0.25 + 26 * Math.sin(xx / 140) + 12 * Math.sin(xx / 47));
      x.stroke();
    };
    damar('#c41e2e', 1140, 18); damar('#3f5bb0', 1185, 15);
    // kılcal damar halkaları (papiller dermis)
    for (let xx = 40; xx < W; xx += 90) {
      x.strokeStyle = 'rgba(200,40,50,0.6)'; x.lineWidth = 4;
      const yy = yuzeyY(xx) + EPI;
      x.beginPath(); x.moveTo(xx - 14, yy + 70); x.quadraticCurveTo(xx - 16, yy - 6, xx, yy + 4); x.quadraticCurveTo(xx + 16, yy - 6, xx + 14, yy + 70); x.stroke();
    }
    x.restore();
    // epidermis (katmanlı hücreler)
    yol(yuzeyY, xx => yuzeyY(xx) + EPI);
    g = x.createLinearGradient(0, YUZEY - 10, 0, YUZEY + EPI);
    g.addColorStop(0, '#f2cdb5'); g.addColorStop(0.6, '#e2a993'); g.addColorStop(1, '#b8786c');
    x.fillStyle = g; x.fill();
    x.save(); x.clip();
    for (let row = 0; row < 6; row++) for (let xx = (row % 2) * 12; xx < W; xx += 24) {
      const yy = yuzeyY(xx) + 8 + row * 12;
      x.fillStyle = `rgba(${row > 3 ? '150,80,80' : '255,235,220'},${0.16 + row * 0.03})`;
      x.beginPath(); x.ellipse(xx, yy, 10, 5 + row * 0.6, 0, 0, TAU); x.fill();
    }
    x.restore();
    // yüzey parlaması
    x.strokeStyle = 'rgba(255,240,230,0.55)'; x.lineWidth = 3;
    x.beginPath(); for (let xx = 0; xx <= W; xx += 10) xx ? x.lineTo(xx, yuzeyY(xx)) : x.moveTo(xx, yuzeyY(xx)); x.stroke();
    A.kesit = c;
  }

  // folikül + kıl + yağ bezi + kas çizimi (dünya koordinatı)
  function folikul(ctx, px, e, olcek = 1, aktif = 0, ana = true) {
    const phi = lerp(0.62, 0.2, e);
    const ax = -Math.sin(phi), ay = Math.cos(phi);          // aşağı eksen
    const nx = Math.cos(phi), ny = Math.sin(phi);           // sağa normal
    const py = yuzeyY(px), L = 560 * olcek;
    const nokta = s => [px + ax * L * s, py + ay * L * s];
    const genis = s => (15 + 9 * s) * olcek;
    // kas (folikülün arkasında)
    const k0 = nokta(0.5), kas0 = [k0[0] + nx * genis(0.5), k0[1] + ny * genis(0.5)];
    const Q = [px + 215 * olcek, yuzeyY(px + 215 * olcek) + EPI + 6];
    const kalin = (24 + 16 * e) * olcek;
    const dx = Q[0] - kas0[0], dy = Q[1] - kas0[1], uz = Math.hypot(dx, dy), ux = dx / uz, uy = dy / uz, vx = -uy, vy = ux;
    ctx.save();
    if (aktif > 0) { ctx.shadowColor = `rgba(255,80,60,${0.9 * aktif})`; ctx.shadowBlur = 40 * aktif; }
    const kg = ctx.createLinearGradient(kas0[0], kas0[1], Q[0], Q[1]);
    kg.addColorStop(0, '#8e1f26'); kg.addColorStop(0.5, aktif > 0 ? `rgb(${200 + 55 * aktif},${60 + 40 * aktif},${55})` : '#c23a3a'); kg.addColorStop(1, '#8e1f26');
    ctx.fillStyle = kg;
    ctx.beginPath();
    ctx.moveTo(kas0[0], kas0[1]);
    ctx.quadraticCurveTo(kas0[0] + dx * 0.5 + vx * kalin, kas0[1] + dy * 0.5 + vy * kalin, Q[0], Q[1]);
    ctx.quadraticCurveTo(kas0[0] + dx * 0.5 - vx * kalin, kas0[1] + dy * 0.5 - vy * kalin, kas0[0], kas0[1]);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,200,190,0.28)'; ctx.lineWidth = 1.6 * olcek;
    for (let k = -2; k <= 2; k++) {
      ctx.beginPath(); ctx.moveTo(kas0[0] + ux * 10, kas0[1] + uy * 10);
      ctx.quadraticCurveTo(kas0[0] + dx * 0.5 + vx * kalin * k * 0.22, kas0[1] + dy * 0.5 + vy * kalin * k * 0.22, Q[0] - ux * 10, Q[1] - uy * 10); ctx.stroke();
    }
    ctx.restore();
    // kılın içerideki gövdesi + kılıf
    const uc = nokta(1);
    ctx.fillStyle = '#efc9a8'; ctx.strokeStyle = 'rgba(120,60,40,0.6)'; ctx.lineWidth = 3 * olcek;
    ctx.beginPath();
    for (let s = 0; s <= 1.0001; s += 0.05) { const q = nokta(s), w = genis(s); ctx.lineTo(q[0] + nx * w, q[1] + ny * w); }
    for (let s = 1; s >= -0.0001; s -= 0.05) { const q = nokta(s), w = genis(s); ctx.lineTo(q[0] - nx * w, q[1] - ny * w); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // soğan (bulbus) + papilla
    ctx.fillStyle = '#e6b08f'; ctx.beginPath(); ctx.arc(uc[0], uc[1], 40 * olcek, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#b5546a'; ctx.beginPath(); ctx.ellipse(uc[0] + ax * 16 * olcek, uc[1] + ay * 16 * olcek, 16 * olcek, 20 * olcek, phi, 0, TAU); ctx.fill();
    // yağ bezi
    const b0 = nokta(0.26);
    ctx.fillStyle = '#f0d27c'; ctx.strokeStyle = 'rgba(150,110,40,0.7)'; ctx.lineWidth = 2 * olcek;
    for (const [o, rr] of [[0.0, 30], [0.07, 26], [-0.07, 24]]) {
      const q = nokta(0.26 + o), cx = q[0] + nx * (genis(0.26) + rr * 0.9 * olcek), cy = q[1] + ny * (genis(0.26) + rr * 0.9 * olcek);
      ctx.beginPath(); ctx.arc(cx, cy, rr * olcek, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,230,0.5)'; ctx.beginPath(); ctx.arc(cx - 8 * olcek, cy - 8 * olcek, rr * 0.3 * olcek, 0, TAU); ctx.fill(); ctx.fillStyle = '#f0d27c';
    }
    // kıl (içeride → dışarıda)
    const psi = lerp(0.32, 1.22, e);
    const disX = Math.cos(psi), disY = -Math.sin(psi), disL = 360 * olcek;
    ctx.strokeStyle = '#2a1810'; ctx.lineCap = 'round'; ctx.lineWidth = 9 * olcek;
    ctx.beginPath(); ctx.moveTo(uc[0], uc[1]); ctx.lineTo(px, py);
    ctx.quadraticCurveTo(px + disX * disL * 0.5, py + disY * disL * 0.5 + 10 * olcek, px + disX * disL, py + disY * disL); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,210,170,0.35)'; ctx.lineWidth = 3 * olcek;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo(px + disX * disL * 0.5 - 2, py + disY * disL * 0.5 + 8 * olcek, px + disX * disL - 2, py + disY * disL); ctx.stroke();
    return { uc, bez: b0, kasOrta: [(kas0[0] + Q[0]) / 2, (kas0[1] + Q[1]) / 2], Q, kas0, kilUc: [px + disX * disL, py + disY * disL] };
  }

  function sinirYolu(M) {
    return [[W + 40, 1060], [880, 1080], [M[0] + 120, M[1] + 140], [M[0], M[1]]];
  }
  function bez(p, u) {
    const v = 1 - u;
    return [0, 1].map(k => v * v * v * p[0][k] + 3 * v * v * u * p[1][k] + 3 * v * u * u * p[2][k] + u * u * u * p[3][k]);
  }

  VIDEO.sahne('deri', {
    ciz(ctx, S) {
      const t = S.t;
      // zaman çizelgesi (cümlelere bağlı)
      const sinirBas = S.at(2, 0.12), sinirSon = S.at(2, 0.42);
      const kasilma = ramp(t, S.at(2, 0.40), S.at(2, 0.78));
      const e = kasilma;
      const aktif = pencere(t, S.at(2, 0.36), S.d + 1, 0.25) * (0.75 + 0.25 * Math.sin(t * 10));
      const M0 = [P.x + 150, 760];
      const kam = kf(t, [
        [-0.6, [P.x + 70, P.y - 20, 2.9]],
        [S.at(0, 0.10), [P.x + 50, P.y + 40, 2.3]],
        [S.at(0, 0.62), [540, 930, 1.0]],
        [S.at(1, 0.05), [540, 930, 1.0]],
        [S.at(1, 0.70), [M0[0] - 40, M0[1] - 10, 1.7]],
        [S.at(2, 0.30), [M0[0] - 30, M0[1] + 20, 1.55]],
        [S.at(2, 0.70), [P.x + 90, 600, 1.38]],
        [S.d + 1, [P.x + 90, 590, 1.30]],
      ]);
      const [cx, cy, z] = kam;
      const ekr = (wx, wy) => [(wx - cx) * z + W / 2, (wy - cy) * z + H / 2];

      ctx.save();
      kamera(ctx, cx, cy, z, Math.sin(t * 0.4) * 0.006);
      ctx.drawImage(A.kesit, 0, 0);
      // arka plandaki iki folikül (bulanık)
      ctx.save(); ctx.globalAlpha = 0.6; ctx.filter = 'blur(2.5px)';
      folikul(ctx, 150, e * 0.95, 0.72, aktif * 0.5, false);
      folikul(ctx, 900, e * 0.9, 0.62, aktif * 0.5, false);
      ctx.restore();
      const F = folikul(ctx, P.x, e, 1, aktif);
      // deri yüzeyinde kabarıklık (tüy dibinde)
      if (e > 0.01) {
        ctx.save();
        ctx.fillStyle = '#f0c8b0';
        ctx.beginPath(); ctx.moveTo(P.x - 140, yuzeyY(P.x - 140));
        for (let xx = P.x - 140; xx <= P.x + 140; xx += 6) ctx.lineTo(xx, yuzeyY(xx) - 30 * e * Math.exp(-Math.pow((xx - P.x - 12) / 60, 2)));
        ctx.lineTo(P.x + 140, yuzeyY(P.x + 140) + 2); ctx.lineTo(P.x - 140, yuzeyY(P.x - 140) + 2); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(255,240,230,0.6)'; ctx.lineWidth = 3; ctx.stroke();
        ctx.restore();
      }
      // sinir lifi + sinyal
      const yolS = sinirYolu(F.kasOrta);
      const sinirGor = ramp(t, S.at(1, 0.5), S.at(2, 0.1));
      if (sinirGor > 0) {
        ctx.save(); ctx.globalAlpha = sinirGor * 0.85;
        ctx.strokeStyle = '#f3e3a0'; ctx.lineWidth = 5; ctx.shadowColor = 'rgba(255,240,170,0.6)'; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.moveTo(...yolS[0]); ctx.bezierCurveTo(...yolS[1], ...yolS[2], ...yolS[3]); ctx.stroke();
        ctx.restore();
        const u = clamp((t - sinirBas) / (sinirSon - sinirBas));
        if (u > 0 && u < 1) {
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          for (let k = 0; k < 10; k++) {
            const uu = clamp(u - k * 0.025); const [bx, by] = bez(yolS, ease.inOut(uu));
            const s = (46 - k * 3.5);
            ctx.globalAlpha = 1 - k / 10; ctx.drawImage(A.parilti, bx - s, by - s, s * 2, s * 2);
          }
          ctx.restore();
        }
      }
      ctx.restore();

      // dokudaki ışık parçacıkları
      bokeh(ctx, t, 26, 12, 'sicak', [4, 16], 0.22, 8);

      // ---- Etiketler (ekran koordinatında) ----
      const a1 = pencere(t, S.at(0, 0.55), S.at(1, 0.15), 0.4);
      etiket(ctx, ...ekr(860, yuzeyY(860) + 40), 760, 430, 'Epidermis', a1, { alt: 'derinin dış katmanı' });
      etiket(ctx, ...ekr(880, 1000), 760, 900, 'Dermis', a1);
      etiket(ctx, ...ekr(250, 1330), 330, 1215, 'Yağ dokusu', a1);
      const a2 = pencere(t, S.at(0, 0.62), S.at(1, 0.25), 0.4);
      const kk = ekr(...F.uc); etiket(ctx, kk[0], kk[1], kk[0] - 20, kk[1] - 250, 'Kıl kökü', a2, {});
      const a3 = pencere(t, S.at(1, 0.15), S.at(2, 0.30), 0.4);
      const km = ekr(...F.kasOrta);
      etiket(ctx, km[0], km[1], 600, 330, 'Kıl dikleştirici kas', a3, { boyut: 46, alt: 'arrector pili', renk: 'rgba(255,215,200,0.98)' });
      const a4 = pencere(t, S.at(2, 0.10), S.at(2, 0.48), 0.25);
      const sn = ekr(...bez(yolS, 0.55));
      etiket(ctx, sn[0], sn[1], sn[0] - 60, sn[1] - 280, 'Sinir sinyali', a4, { renk: 'rgba(255,240,170,0.98)' });
      const a5 = pencere(t, S.at(2, 0.72), S.d + 2, 0.4);
      const ku = ekr(...F.kilUc);
      etiket(ctx, ku[0], ku[1], clamp(ku[0] - 120, 200, 900), Math.max(260, ku[1] - 120), 'Kıl dikleşir', a5, { renk: 'rgba(255,213,74,0.98)' });
    },
  });

  // ================= SAHNE 3: EVRİM =================
  const MO = { x: 520, y: 400 };   // memeli maskesi orijini
  function memeliSekil(x) {
    x.beginPath(); x.ellipse(MO.x + 0, MO.y + 0, 230, 122, 0.04, 0, TAU); x.fill();
    x.beginPath(); x.arc(MO.x - 252, MO.y - 58, 86, 0, TAU); x.fill();
    x.beginPath(); x.ellipse(MO.x - 330, MO.y - 36, 64, 38, 0.15, 0, TAU); x.fill();
    x.beginPath(); x.moveTo(MO.x - 280, MO.y - 120); x.lineTo(MO.x - 262, MO.y - 190); x.lineTo(MO.x - 232, MO.y - 128); x.fill();
    x.beginPath(); x.moveTo(MO.x - 228, MO.y - 128); x.lineTo(MO.x - 196, MO.y - 186); x.lineTo(MO.x - 186, MO.y - 112); x.fill();
    for (const lx of [-160, -110, 120, 170]) { x.beginPath(); x.roundRect(MO.x + lx - 20, MO.y + 40, 40, 150, 18); x.fill(); }
    x.lineCap = 'round'; x.lineWidth = 46; x.strokeStyle = x.fillStyle;
    x.beginPath(); x.moveTo(MO.x + 210, MO.y - 30); x.quadraticCurveTo(MO.x + 380, MO.y - 170, MO.x + 430, MO.y - 40); x.stroke();
  }

  function evrimHazirla() {
    const r = rng(17);
    // memeli maskesi ve kenar noktaları
    const MW = 1100, MH = 700;
    const m = tuval(MW, MH), mx = m.getContext('2d');
    mx.fillStyle = '#000'; memeliSekil(mx);
    const b = tuval(MW, MH), bx = b.getContext('2d');
    bx.filter = 'blur(7px)'; bx.drawImage(m, 0, 0); bx.filter = 'none';
    const bd = bx.getImageData(0, 0, MW, MH).data, md = mx.getImageData(0, 0, MW, MH).data;
    const al = (x, y) => (x < 1 || y < 1 || x >= MW - 1 || y >= MH - 1) ? 0 : bd[(y * MW + x) * 4 + 3] / 255;
    A.kurk = [];
    for (let k = 0; k < 90000 && A.kurk.length < 2400; k++) {
      const x = Math.floor(r() * MW), y = Math.floor(r() * MH), a = al(x, y);
      if (a < 0.38 || a > 0.62) continue;
      let gx = al(x + 1, y) - al(x - 1, y), gy = al(x, y + 1) - al(x, y - 1);
      const n = Math.hypot(gx, gy); if (n < 1e-3) continue;
      gx /= -n; gy /= -n;
      if (y > MO.y + 95 && !(x > MO.x + 200)) continue; // bacaklar/alt kısım kürksüz
      A.kurk.push({ x: x - MO.x, y: y - MO.y, nx: gx, ny: gy, L: 16 + r() * 26, ph: r() * TAU, k: 1.6 + r() * 1.8, sap: (r() - 0.5) * 0.7 });
    }
    // gövde içi kürk dokusu
    const ic = tuval(MW, MH), ix = ic.getContext('2d');
    ix.drawImage(m, 0, 0); ix.globalCompositeOperation = 'source-in';
    const gg = ix.createLinearGradient(0, MO.y - 200, 0, MO.y + 200);
    gg.addColorStop(0, '#3b322a'); gg.addColorStop(1, '#16110d');
    ix.fillStyle = gg; ix.fillRect(0, 0, MW, MH);
    ix.globalCompositeOperation = 'source-atop'; ix.lineCap = 'round';
    for (let k = 0; k < 5000; k++) {
      const x = r() * MW, y = r() * MH; if (md[(Math.floor(y) * MW + Math.floor(x)) * 4 + 3] < 10) continue;
      const L = 10 + r() * 18;
      ix.strokeStyle = r() < 0.5 ? 'rgba(120,100,80,0.35)' : 'rgba(10,8,6,0.4)'; ix.lineWidth = 1.5 + r() * 1.5;
      ix.beginPath(); ix.moveTo(x, y); ix.lineTo(x + L, y + L * 0.25 + (r() - 0.5) * 6); ix.stroke();
    }
    A.memeliIc = ic; A.memeliMaske = m; A.MW = MW; A.MH = MH;

    // orman (alacakaranlık)
    const f = tuval(), fx = f.getContext('2d');
    let g = fx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#120c22'); g.addColorStop(0.4, '#3d1d36'); g.addColorStop(0.58, '#a24a32'); g.addColorStop(0.66, '#5a2a2a'); g.addColorStop(1, '#0b0706');
    fx.fillStyle = g; fx.fillRect(0, 0, W, H);
    const gun = fx.createRadialGradient(760, 1090, 10, 760, 1090, 520);
    gun.addColorStop(0, 'rgba(255,190,110,0.85)'); gun.addColorStop(0.2, 'rgba(255,130,70,0.35)'); gun.addColorStop(1, 'rgba(255,100,60,0)');
    fx.fillStyle = gun; fx.fillRect(0, 0, W, H);
    for (let kat = 0; kat < 3; kat++) {
      const koyu = ['rgba(60,25,40,0.85)', 'rgba(30,14,22,0.92)', 'rgba(10,6,8,1)'][kat];
      fx.fillStyle = koyu;
      const n = 6 + kat * 3;
      for (let k = 0; k < n; k++) {
        const tx = r() * W, tw = 12 + kat * 14 + r() * 20, ust = 200 + r() * 500 - kat * 120;
        fx.fillRect(tx, ust, tw, 1300);
        for (let c = 0; c < 9; c++) { fx.beginPath(); fx.arc(tx + (r() - 0.5) * 260, ust + (r() - 0.3) * 260, 60 + r() * 90 + kat * 20, 0, TAU); fx.fill(); }
      }
      fx.fillStyle = `rgba(255,150,100,${0.08 - kat * 0.02})`;
      fx.fillRect(0, 900 + kat * 120, W, 160);
    }
    // kaya
    fx.fillStyle = '#0d0907';
    fx.beginPath(); fx.moveTo(-50, H); fx.lineTo(-50, 1330); fx.quadraticCurveTo(300, 1220, 560, 1240); fx.quadraticCurveTo(880, 1250, 1130, 1360); fx.lineTo(1130, H); fx.fill();
    fx.strokeStyle = 'rgba(255,150,90,0.35)'; fx.lineWidth = 4;
    fx.beginPath(); fx.moveTo(480, 1241); fx.quadraticCurveTo(880, 1250, 1130, 1360); fx.stroke();
    A.orman = f;

    // karlı manzara
    const s = tuval(), sx = s.getContext('2d');
    g = sx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0b1626'); g.addColorStop(0.45, '#22405c'); g.addColorStop(0.6, '#8fa9c0'); g.addColorStop(0.62, '#5c7590'); g.addColorStop(1, '#121c28');
    sx.fillStyle = g; sx.fillRect(0, 0, W, H);
    for (let kat = 0; kat < 2; kat++) {
      sx.fillStyle = kat ? 'rgba(25,42,60,0.95)' : 'rgba(70,95,120,0.7)';
      for (let k = 0; k < 14; k++) {
        const tx = r() * W, th = 220 + r() * 300 + kat * 120, by = 1170 + kat * 40;
        sx.beginPath(); sx.moveTo(tx, by - th); sx.lineTo(tx - th * 0.28, by); sx.lineTo(tx + th * 0.28, by); sx.fill();
      }
    }
    sx.fillStyle = '#c9d8e6';
    sx.beginPath(); sx.moveTo(-50, H); sx.lineTo(-50, 1330); sx.quadraticCurveTo(300, 1225, 560, 1240); sx.quadraticCurveTo(880, 1252, 1130, 1360); sx.lineTo(1130, H); sx.fill();
    g = sx.createLinearGradient(0, 1240, 0, H); g.addColorStop(0, 'rgba(255,255,255,0.0)'); g.addColorStop(1, 'rgba(20,40,70,0.75)');
    sx.fillStyle = g; sx.fillRect(0, 1220, W, H);
    A.kar = s;

    A.kar_par = Array.from({ length: 260 }, () => ({ x: r() * W, y: r() * H, s: 2 + r() * 6, v: 60 + r() * 140, ph: r() * TAU, d: r() }));
    A.buhar = sprite(80, g => { g.addColorStop(0, 'rgba(230,240,255,0.5)'); g.addColorStop(1, 'rgba(230,240,255,0)'); });
    A.cizgi = Array.from({ length: 420 }, () => ({ a: r() * TAU, d: r(), v: 0.4 + r() * 0.8, sicak: r() < 0.55 }));

    // insan silueti maskesi (yan değil, ön görünüş) — parçacık dönüşümü için
    const ins = tuval(MW, 1100), inx = ins.getContext('2d');
    kisi(inx, MW / 2, 1060, 1000, { kol: 0 }, '#000');
    const memNok = [], insNok = [];
    const ornekle = (cv, w, h, dizi, ox, oy, n, seed) => {
      const rr = rng(seed), d = cv.getContext('2d').getImageData(0, 0, w, h).data;
      let dene = 0;
      while (dizi.length < n && dene++ < 400000) {
        const x = Math.floor(rr() * w), y = Math.floor(rr() * h);
        if (d[(y * w + x) * 4 + 3] > 128) dizi.push([x + ox, y + oy]);
      }
    };
    ornekle(m, MW, MH, memNok, 540 - MO.x, 1000 - MO.y, 2600, 3);     // ekran: memeli merkezi ~ (540,1000)
    ornekle(ins, MW, 1100, insNok, 540 - MW / 2, 1460 - 1060, 2600, 4);
    const merkez = (d) => d.reduce((s, p) => [s[0] + p[0] / d.length, s[1] + p[1] / d.length], [0, 0]);
    const cm = merkez(memNok), ci = merkez(insNok);
    const sirala = (d, c) => d.sort((a, b) => Math.atan2(a[1] - c[1], a[0] - c[0]) - Math.atan2(b[1] - c[1], b[0] - c[0]));
    sirala(memNok, cm); sirala(insNok, ci);
    A.morf = memNok.map((p, i) => ({ a: p, b: insNok[i], gec: rng(i)() }));
    A.insanMaske = ins;
  }

  // memeli çizimi: kabarma (0..1), ışık yönü, renkler
  function memeliCiz(ctx, cx, cy, olcek, kabar, t, isik) {
    ctx.save();
    ctx.translate(cx, cy); ctx.scale(olcek, olcek);
    const nefes = 1 + 0.012 * Math.sin(t * 2.4);
    ctx.scale(nefes, 1 / nefes);
    ctx.drawImage(A.memeliIc, -MO.x, -MO.y);
    // kürk telleri — renk kutularına göre toplu çizim
    const kutular = Array.from({ length: 6 }, () => new Path2D());
    const lx = isik.x, ly = isik.y;
    for (const f of A.kurk) {
      const tx = f.ny, ty = -f.nx; // teğet
      const ts = tx > 0 ? 1 : -1;
      const yatik = [tx * ts * 0.9 + f.nx * 0.3, ty * ts * 0.9 + f.ny * 0.3];
      const dik = [f.nx + tx * ts * 0.12, f.ny + ty * ts * 0.12];
      let dx = lerp(yatik[0], dik[0], kabar) + f.sap * (0.4 + 0.6 * kabar) * tx, dy = lerp(yatik[1], dik[1], kabar) + f.sap * (0.4 + 0.6 * kabar) * ty;
      const n = Math.hypot(dx, dy); dx /= n; dy /= n;
      const L = f.L * (1 + 0.95 * kabar) * (1 + 0.06 * Math.sin(t * 3 + f.ph));
      const x0 = f.x - f.nx * 8, y0 = f.y - f.ny * 8;
      const parlak = clamp((f.nx * lx + f.ny * ly) * 0.5 + 0.5);
      const kb = Math.min(5, Math.floor(parlak * parlak * 6));
      const p = kutular[kb];
      p.moveTo(x0, y0);
      p.quadraticCurveTo(x0 + dx * L * 0.5 + Math.sin(f.ph + t) * 3, y0 + dy * L * 0.5, x0 + dx * L, y0 + dy * L);
    }
    ctx.lineCap = 'round';
    const renkler = isik.renkler;
    ctx.globalAlpha *= 0.9; kutular.forEach((p, i) => { ctx.strokeStyle = renkler[i]; ctx.lineWidth = 2.2; ctx.stroke(p); });
    // göz
    ctx.fillStyle = 'rgba(255,230,190,0.95)';
    ctx.beginPath(); ctx.arc(-282, -78, 7, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(-284, -80, 2.5, 0, TAU); ctx.fill();
    ctx.restore();
  }
  const ALACA = { x: 0.85, y: -0.4, renkler: ['#140f0b', '#241b14', '#3a2b1f', '#6b4630', '#c07a45', '#f2b070'] };
  const SOGUK = { x: -0.5, y: -0.85, renkler: ['#15120f', '#231d18', '#352c25', '#4f4a4a', '#7e8a98', '#b9c7d6'] };

  function karYagisi(ctx, t, on, alfa) {
    ctx.save(); ctx.fillStyle = '#eef5ff';
    for (const p of A.kar_par) {
      if ((p.d > 0.7) !== on) continue;
      const y = (p.y + t * p.v) % (H + 20) - 10, x = (p.x + Math.sin(t * 0.8 + p.ph) * 30 + t * 20) % W;
      ctx.globalAlpha = alfa * (on ? 0.9 : 0.55);
      ctx.beginPath(); ctx.arc(x, y, on ? p.s * 1.4 : p.s * 0.6, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  VIDEO.sahne('evrim', {
    ciz(ctx, S) {
      const t = S.t;
      const tunelSon = S.at(0, 0.62);
      // ---- 1) Zaman tüneli ----
      if (t < tunelSon + 0.8) {
        const a = 1 - ramp(t, tunelSon, tunelSon + 0.8);
        ctx.save(); ctx.globalAlpha = a;
        ctx.fillStyle = '#05040a'; ctx.fillRect(0, 0, W, H);
        const hiz = 0.35 + 1.4 * ease.in(clamp(t / tunelSon));
        ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
        for (const c of A.cizgi) {
          const d = ((c.d + t * c.v * hiz * 0.35) % 1);
          const r0 = 40 + Math.pow(d, 2.2) * 1400, r1 = r0 + 20 + d * 260 * hiz;
          ctx.strokeStyle = c.sicak ? `rgba(255,${150 + c.v * 60},90,${0.6 * d})` : `rgba(120,190,255,${0.5 * d})`;
          ctx.lineWidth = 1 + d * 4;
          ctx.beginPath(); ctx.moveTo(W / 2 + Math.cos(c.a) * r0, H * 0.45 + Math.sin(c.a) * r0); ctx.lineTo(W / 2 + Math.cos(c.a) * r1, H * 0.45 + Math.sin(c.a) * r1); ctx.stroke();
        }
        const pg = ctx.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H * 0.45, 500);
        pg.addColorStop(0, `rgba(255,220,170,${0.5 + 0.4 * ramp(t, tunelSon - 0.8, tunelSon)})`); pg.addColorStop(1, 'rgba(255,150,80,0)');
        ctx.fillStyle = pg; ctx.fillRect(0, 0, W, H);
        ctx.restore();
        if (a >= 0.999) return;
      }
      // ---- 2) Orman / tehdit ve 3) soğuk ----
      const sogukBas = S.at(2, 0.0) - 0.5, sogukU = ramp(t, sogukBas, sogukBas + 1.2);
      const yakinBas = S.at(2, 0.42), yakinU = ramp(t, yakinBas, yakinBas + 0.9);
      const kabar = Math.max(ramp(t, S.at(1, 0.22), S.at(1, 0.62), ease.out), sogukU);
      const sahneA = 1 - ramp(t, tunelSon - 0.1, tunelSon + 0.8) * 0;
      if (yakinU < 1) {
        const z = lerp(1.0, 1.12, ramp(t, tunelSon, S.at(1, 0.9))) + 0.05 * sogukU;
        ctx.save();
        kamera(ctx, 540, lerp(1020, 1060, sogukU), z, 0);
        ctx.drawImage(A.orman, 0, 0);
        if (sogukU > 0) { ctx.globalAlpha = sogukU; ctx.drawImage(A.kar, 0, 0); ctx.globalAlpha = 1; }
        // tehdit: karanlıkta gözler
        const goz = pencere(t, S.at(1, 0.05), S.at(1, 1.05), 0.4) * (1 - sogukU) * (Math.sin(t * 2.2) > -0.92 ? 1 : 0.1);
        if (goz > 0) {
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = goz;
          for (const [gx, gy] of [[96, 1160], [140, 1162]]) ctx.drawImage(A.parilti, gx - 18, gy - 12, 36, 24);
          ctx.restore();
        }
        memeliCiz(ctx, 560, 1040, 0.95, kabar, t, sogukU > 0.5 ? SOGUK : ALACA);
        // nefes buharı (soğukta)
        if (sogukU > 0) {
          ctx.save(); ctx.globalAlpha = sogukU;
          for (let k = 0; k < 4; k++) {
            const u = ((t * 0.5 + k / 4) % 1);
            ctx.globalAlpha = sogukU * (1 - u) * 0.8 * (Math.sin(t * 2.4 + k) > 0 ? 1 : 0.5);
            const s = 40 + u * 120; ctx.drawImage(A.buhar, 560 - 330 * 0.95 - 60 - u * 140 - s, 1040 - 40 - u * 60 - s, s * 2, s * 2);
          }
          ctx.restore();
        }
        ctx.restore();
        // boyut karşılaştırması
        const kars = pencere(t, S.at(1, 0.55), S.at(2, 0.05), 0.35);
        if (kars > 0) {
          ctx.save(); ctx.globalAlpha = kars;
          ctx.strokeStyle = 'rgba(255,213,74,0.95)'; ctx.lineWidth = 4; ctx.setLineDash([14, 10]);
          const ust0 = 830, ust1 = lerp(830, 770, kabar);
          ctx.beginPath(); ctx.moveTo(930, 1245); ctx.lineTo(930, ust1); ctx.stroke();
          ctx.setLineDash([]);
          ctx.beginPath(); ctx.moveTo(905, ust1); ctx.lineTo(955, ust1); ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.moveTo(910, ust0 + 40); ctx.lineTo(950, ust0 + 40); ctx.stroke();
          yazi(ctx, 'Daha büyük', 900, ust1 - 70, { boyut: 44, agirlik: 800, hiza: 'right', renk: '#FFD54A' });
          yazi(ctx, 've korkutucu görünür', 900, ust1 - 22, { boyut: 32, agirlik: 600, hiza: 'right' });
          ctx.restore();
        }
        karYagisi(ctx, t, false, sogukU);
        karYagisi(ctx, t, true, sogukU);
        if (sogukU > 0) { ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = sogukU; ctx.fillStyle = 'rgba(60,110,180,0.6)'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
        else bokeh(ctx, t, 20, 21, 'sicak', [4, 14], 0.25, 6);
      }
      // ---- 3b) Yalıtım yakın planı ----
      if (yakinU > 0) {
        ctx.save(); ctx.globalAlpha = yakinU;
        if (yakinU < 1) ctx.filter = `blur(${((1 - yakinU) * 14).toFixed(1)}px)`;
        yalitimCiz(ctx, t - yakinBas, S.d - yakinBas);
        ctx.restore();
      }
    },
  });

  function yalitimCiz(ctx, t, d) {
    const z = lerp(1.0, 1.1, clamp(t / Math.max(1, d)));
    ctx.save();
    kamera(ctx, 540, 960, z);
    let g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#081424'); g.addColorStop(0.6, '#13304d'); g.addColorStop(1, '#0a1220');
    ctx.fillStyle = g; ctx.fillRect(-100, -100, W + 200, H + 200);
    const deriY = xx => 1200 + 26 * Math.sin(xx / 260);
    const tepeY = xx => 760 + 30 * Math.sin(xx / 170 + 1);
    // sıcak hava tabakası
    const nabiz = 0.8 + 0.2 * Math.sin(t * 2.2);
    ctx.save();
    ctx.beginPath(); ctx.moveTo(-100, deriY(-100));
    for (let xx = -100; xx <= W + 100; xx += 20) ctx.lineTo(xx, deriY(xx));
    for (let xx = W + 100; xx >= -100; xx -= 20) ctx.lineTo(xx, tepeY(xx) + 20);
    ctx.closePath();
    g = ctx.createLinearGradient(0, 760, 0, 1200);
    g.addColorStop(0, `rgba(255,150,60,${0.12 * nabiz})`); g.addColorStop(0.5, `rgba(255,160,70,${0.5 * nabiz})`); g.addColorStop(1, `rgba(255,190,110,${0.78 * nabiz})`);
    ctx.fillStyle = g; ctx.shadowColor = 'rgba(255,150,60,0.8)'; ctx.shadowBlur = 50; ctx.fill();
    ctx.restore();
    // ısı dalgacıkları (içeride kalır)
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    for (let k = 0; k < 14; k++) {
      const x0 = 60 + k * 72, u = ((t * 0.35 + k * 0.17) % 1), y0 = lerp(1170, 860, u);
      ctx.strokeStyle = `rgba(255,170,80,${0.55 * Math.sin(Math.PI * u)})`;
      ctx.beginPath();
      for (let s = 0; s <= 1; s += 0.1) { const yy = y0 - s * 70; const xx = x0 + Math.sin(s * 8 + t * 3 + k) * 8; s ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); }
      ctx.stroke();
    }
    ctx.restore();
    // tüyler (dik)
    ctx.lineCap = 'round';
    for (let xx = -60; xx <= W + 60; xx += 26) {
      const r = rng(Math.floor(xx * 7 + 999)), y0 = deriY(xx), uz = y0 - tepeY(xx) + (r() - 0.5) * 60;
      const sal = Math.sin(t * 1.6 + xx * 0.03) * 10;
      ctx.strokeStyle = '#2a1d16'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(xx, y0); ctx.quadraticCurveTo(xx + sal * 0.5 + (r() - 0.5) * 16, y0 - uz * 0.5, xx + sal + (r() - 0.5) * 30, y0 - uz); ctx.stroke();
      ctx.strokeStyle = 'rgba(190,215,240,0.55)'; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(xx - 2, y0 - 10); ctx.quadraticCurveTo(xx + sal * 0.5 - 2, y0 - uz * 0.5, xx + sal - 2 + (r() - 0.5) * 30, y0 - uz); ctx.stroke();
    }
    // deri
    ctx.beginPath(); ctx.moveTo(-100, deriY(-100));
    for (let xx = -100; xx <= W + 100; xx += 20) ctx.lineTo(xx, deriY(xx));
    ctx.lineTo(W + 100, H + 100); ctx.lineTo(-100, H + 100); ctx.closePath();
    g = ctx.createLinearGradient(0, 1180, 0, H);
    g.addColorStop(0, '#d8a08a'); g.addColorStop(0.08, '#b9776a'); g.addColorStop(1, '#4a2228');
    ctx.fillStyle = g; ctx.fill();
    // soğuk hava okları
    ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let k = 0; k < 6; k++) {
      const x0 = 110 + k * 172, u = ((t * 0.45 + k * 0.37) % 1);
      const y = lerp(230, 690, ease.out(u)), a = Math.sin(Math.PI * u);
      const sap = u > 0.8 ? (u - 0.8) * 5 : 0;
      ctx.strokeStyle = `rgba(150,205,255,${0.9 * a})`;
      ctx.beginPath(); ctx.moveTo(x0, y - 90); ctx.lineTo(x0 + sap * 60 * (k % 2 ? 1 : -1), y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x0 - 26, y - 26); ctx.lineTo(x0 + sap * 60 * (k % 2 ? 1 : -1), y); ctx.lineTo(x0 + 26, y - 26); ctx.stroke();
    }
    ctx.restore();
    karYagisi(ctx, t + 10, false, 0.8);
    const a1 = clamp(t / 0.8), a2 = clamp((t - 0.5) / 0.8);
    hap(ctx, 'SOĞUK HAVA', W / 2, 200, 'rgba(20,50,90,0.75)', 'rgba(170,215,255,1)', a1);
    hap(ctx, 'Sıcak hava tabakası', W / 2, 990, 'rgba(90,40,10,0.72)', '#FFD54A', a2);
    yazi(ctx, 'ısı kaybı azalır', W / 2, 1062, { boyut: 38, agirlik: 700, alfa: a2 });
  }

  function hap(ctx, metin, x, y, zemin, renk, alfa) {
    if (alfa <= 0) return;
    ctx.save(); ctx.globalAlpha = alfa;
    ctx.font = `800 48px ${STUDIO.R.FONT}`;
    const w = ctx.measureText(metin).width + 56;
    ctx.fillStyle = zemin; ctx.beginPath(); ctx.roundRect(x - w / 2, y - 38, w, 76, 38); ctx.fill();
    ctx.restore();
    yazi(ctx, metin, x, y + 2, { boyut: 48, agirlik: 800, renk, alfa, golgeBulanik: 6 });
  }

  // ================= SAHNE 4: SONUÇ =================
  VIDEO.sahne('sonuc', {
    ciz(ctx, S) {
      const t = S.t;
      const makroBas = S.at(1, 0.0) - 0.4, makroU = ramp(t, makroBas, makroBas + 0.8);
      const sokakBas = S.at(2, 0.18), sokakU = ramp(t, sokakBas, sokakBas + 1.0);
      // ---- 1) Parçacık dönüşümü: memeli → insan ----
      if (makroU < 1) {
        const m0 = -0.5, m1 = Math.max(m0 + 2, makroBas - 0.3);
        const u = clamp((t - m0) / (m1 - m0));
        ctx.save();
        const g = ctx.createRadialGradient(540, 1000, 50, 540, 1000, 1100);
        g.addColorStop(0, '#1b1424'); g.addColorStop(1, '#040306');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        bokeh(ctx, t, 30, 33, 'sicak', [3, 12], 0.2, 10);
        // başlangıçta memeli silueti ve düşen tüyler
        const memA = 1 - ramp(u, 0.05, 0.3);
        if (memA > 0) {
          ctx.globalAlpha = memA;
          memeliCiz(ctx, 540 + (MO.x - 540) * 0, 1000, 1.0, 0.4, t, ALACA);
          ctx.globalAlpha = 1;
        }
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const insA = ramp(u, 0.82, 1);
        for (const p of A.morf) {
          const uu = ease.inOut(clamp((u - 0.1 - p.gec * 0.25) / 0.55));
          const sw = Math.sin(Math.PI * uu) * 140;
          const x = lerp(p.a[0], p.b[0], uu) + Math.cos(p.gec * 40 + t) * sw;
          const y = lerp(p.a[1], p.b[1], uu) + Math.sin(p.gec * 40 + t) * sw * 0.6;
          const s = 8 + 7 * Math.sin(Math.PI * uu);
          ctx.globalAlpha = (0.55 + 0.45 * Math.sin(Math.PI * uu)) * (1 - insA * 0.6) * clamp(u * 8);
          ctx.drawImage(uu > 0.6 ? A.bokehSoguk : A.bokehSicak, x - s, y - s, s * 2, s * 2);
        }
        ctx.restore();
        // düşen kürk telleri
        if (u > 0.05 && u < 0.7) {
          ctx.save(); ctx.strokeStyle = 'rgba(200,140,90,0.7)'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
          const r = rng(77);
          for (let k = 0; k < 120; k++) {
            const f = A.kurk[Math.floor(r() * A.kurk.length)];
            const du = clamp((u - 0.05 - r() * 0.2) / 0.45); if (du <= 0 || du >= 1) continue;
            const x = 540 + f.x + Math.sin(k + du * 6) * 40 * du, y = 1000 + f.y + du * du * 700;
            ctx.globalAlpha = 1 - du;
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(k + du * 4) * 22, y + Math.sin(k + du * 4) * 22); ctx.stroke();
          }
          ctx.restore();
        }
        if (insA > 0) {
          ctx.globalAlpha = insA;
          kisi(ctx, 540 + 3, 1460, 1000, { kol: 0 }, 'rgba(255,180,110,0.9)');
          kisi(ctx, 540 - 3, 1460, 1000, { kol: 0 }, 'rgba(120,170,255,0.7)');
          kisi(ctx, 540, 1460, 1000, { kol: 0 }, '#0a0a10');
          ctx.globalAlpha = 1;
        }
        ctx.restore();
        if (makroU <= 0) return;
      }
      // ---- 2) Makro deri (sıcak ton) ----
      if (sokakU < 1 && makroU > 0) {
        const tt = t - makroBas;
        const e = 0.35 + 0.65 * ramp(t, makroBas + 0.3, S.at(1, 0.9));
        ctx.save(); ctx.globalAlpha = makroU * (1 - 0);
        if (makroU < 1) ctx.filter = `blur(${((1 - makroU) * 16).toFixed(1)}px)`;
        deriMakroCiz(ctx, t, e, { cx: 700 + tt * 10, cy: 1150 - tt * 8, z: 1.5 - tt * 0.03, rot: 0.08 - tt * 0.01 }, 'sicak');
        ctx.restore();
        bokeh(ctx, t, 16, 44, 'sicak', [6, 22], 0.25 * makroU, 8);
      }
      // ---- 3) Sokağa geri çekilme + kapanış ----
      if (sokakU > 0) {
        const tt = Math.max(0, t - sokakBas);
        const z = lerp(2.6, 1.0, ease.out(clamp(tt / 5.0)));
        const cy = lerp(1170, 1000, ease.inOut(clamp(tt / 5.0)));
        ctx.save(); ctx.globalAlpha = sokakU;
        if (sokakU < 1) ctx.filter = `blur(${((1 - sokakU) * 16).toFixed(1)}px)`;
        sokakCiz(ctx, t + 20, { cx: 525, cy, z, rot: 0 }, { x: 540, y: 1500, h: 640, faz: 0, yuru: 0, irkil: 0, basDon: 0, basEgik: lerp(1, 0.2, ramp(tt, 2.0, 3.5)), kol: lerp(1, 0.75, ramp(tt, 2.0, 3.5)) });
        ctx.restore();
        // kapanış başlığı
        const kb = S.konusma.end + 0.15, ka = ramp(t, kb, kb + 0.9);
        if (ka > 0) {
          ctx.save();
          const dy = (1 - ease.out(ka)) * 30;
          ctx.globalAlpha = ka;
          yazi(ctx, 'MİLYONLARCA YILLIK', W / 2, 330 + dy, { boyut: 40, agirlik: 700, aralik: 10, renk: 'rgba(255,213,74,1)' });
          yazi(ctx, 'küçük bir iz.', W / 2, 420 + dy, { boyut: 96, agirlik: 800, golgeBulanik: 30 });
          yazi(ctx, 'Bilimsel adı: piloereksiyon', W / 2, 510 + dy, { boyut: 34, agirlik: 600, renk: 'rgba(210,225,245,0.9)' });
          ctx.restore();
        }
      }
    },
  });
})();
