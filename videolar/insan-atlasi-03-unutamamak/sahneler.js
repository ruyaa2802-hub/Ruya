/* İNSAN ATLASI #03 — "Bizi görmezden gelen birini neden unutamayız?"
 * Kanca ilk kareden başlar: siyah → telefon ışığı → göze dalış → zihinsel evren → sonsuz koridor → fark ediş → kapı ve logo.
 * Karakter: STUDIO.KR (İnsan Atlası ana karakteri, #01 ile aynı).
 */
(function () {
  const { W, H, clamp, lerp, inv, ease, ramp, pencere, rng, tuval, gurultuDokusu, yazi, FONT } = STUDIO.R;
  const { kamera, kf, parilti, bokeh, kisi, kisiIsikli, halkalar, TAU } = STUDIO.K;
  const { BAS, SAC, GOZ, yakinYuz, oturan } = STUDIO.KR;
  const A = {};
  const TRK = '47,211,198', ALTIN = '255,196,110';
  const mix = (a, b, u) => a.split(',').map((v, i) => Math.round(lerp(+v, +b.split(',')[i], u))).join(',');

  VIDEO.sahne('_ortak', {
    hazirla() {
      const r = rng(77);
      A.sis = gurultuDokusu(600, 340, 120, 21, f => { const a = clamp((f - 0.45) * 2.4); return [120, 150, 210, a * 120]; }, 5);
      A.yildiz = Array.from({ length: 160 }, () => [r() * W, r() * H, r() * 2 + 0.5, r() * TAU]);
      // zihin evreni öğeleri (3B konum)
      const mesajlar = ['Görüldü', 'Yazıyor…', 'Sonra konuşuruz', 'İyi geceler', 'Neden cevap vermiyorsun?', 'Bir şey mi oldu?', '…', 'Tamam'];
      A.ogeler = [];
      for (let k = 0; k < 16; k++) {
        const foto = k % 4 === 3;
        A.ogeler.push({ foto, metin: mesajlar[k % mesajlar.length], giden: r() < 0.45, x: (r() - 0.5) * 1700, y: (r() - 0.5) * 2200 - 100, z0: 1.4 + r() * 4.8, ph: r() * TAU, tur: k % 3,
          par: Array.from({ length: 34 }, () => [(r() - 0.5) * 2, (r() - 0.5) * 2, r()]) });
      }
      A.koridorYazi = ['Neden?', 'Görüldü · 23:14', 'Ne yanlış yaptım?', 'Yazıyor…', 'Belki de…', 'Son konuşma', 'Bir bakış', 'Neden?'];
    },
    ciz() { },
  });

  // ---------- Telefon ekranı ----------
  function telefonEkrani(ctx, cx, cy, w, h, aci, parlak, t, detay = 1) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(aci);
    ctx.shadowColor = `rgba(170,220,255,${0.9 * parlak})`; ctx.shadowBlur = 60 * parlak;
    ctx.fillStyle = '#05070c'; ctx.beginPath(); ctx.roundRect(-w / 2 - w * 0.04, -h / 2 - w * 0.04, w * 1.08, h + w * 0.08, w * 0.14); ctx.fill();
    ctx.shadowBlur = 0;
    const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    g.addColorStop(0, `rgba(30,60,110,${parlak})`); g.addColorStop(1, `rgba(10,20,45,${parlak})`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, w * 0.11); ctx.fill();
    if (detay > 0 && parlak > 0.05) {
      ctx.globalAlpha = parlak * detay;
      yazi(ctx, '02:14', 0, -h * 0.28, { boyut: w * 0.26, agirlik: 600, golge: false, renk: 'rgba(235,245,255,0.95)' });
      yazi(ctx, 'Perşembe, 5 Kasım', 0, -h * 0.17, { boyut: w * 0.06, agirlik: 500, golge: false, renk: 'rgba(200,220,245,0.8)' });
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.roundRect(-w * 0.42, h * 0.02, w * 0.84, h * 0.11, w * 0.05); ctx.fill();
      yazi(ctx, 'Yeni mesaj yok', 0, h * 0.075, { boyut: w * 0.065, agirlik: 600, golge: false, renk: 'rgba(220,235,255,0.85)' });
    }
    ctx.restore();
  }

  // ================= 1) KANCA =================
  VIDEO.sahne('kanca', {
    ciz(ctx, S) {
      const t = S.t;
      const isik = t < 0.12 ? 0 : clamp(1.15 - 0.15 * ramp(t, 0.12, 0.5));   // sert açılış, hafif sönümle oturur
      const insertBas = S.at(0, 0.75), yakinBas = S.at(1, 0.15);
      const dalisBas = S.at(1, 0.78);
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      if (isik <= 0) return;
      // ---- A) karanlık oda, telefon ışığı ----
      if (t < insertBas + 0.4) {
        const u = ramp(t, insertBas - 0.1, insertBas + 0.4);
        ctx.save(); ctx.globalAlpha = 1 - u;
        const z = lerp(1.0, 1.55, ease.inOut(clamp(t / (insertBas + 0.4))));
        kamera(ctx, lerp(470, 560, clamp(t / 1.5)), lerp(1150, 1060, clamp(t / 1.5)), z);
        // pencere silueti (çok sönük ay ışığı)
        ctx.fillStyle = 'rgba(40,60,100,0.25)'; ctx.fillRect(720, 420, 300, 560);
        ctx.strokeStyle = 'rgba(5,8,14,1)'; ctx.lineWidth = 16; ctx.strokeRect(720, 420, 300, 560); ctx.beginPath(); ctx.moveTo(870, 420); ctx.lineTo(870, 980); ctx.stroke();
        // yatak kenarı
        ctx.fillStyle = '#0a0f1c'; ctx.fillRect(-100, 1310, 760, 140);
        const p = { egik: 0.55, nefes: 0.5 + 0.5 * Math.sin(t * 1.4), telefon: 1 };
        // önce telefonun oda üzerindeki ışığı, sonra siluet (ışık karakterin arkasından taşar)
        const el0 = [430 + 216 * 0.9, 1300 - 88 * 0.9];
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.6 * isik; ctx.drawImage(parilti('150,210,255'), el0[0] - 520, el0[1] - 620, 1040, 1040);
        ctx.restore();
        oturan(ctx, 430 + 4, 1300 - 2, 0.9, p, `rgba(160,215,255,${0.85 * isik})`);
        const k = oturan(ctx, 430, 1300, 0.9, p, '#04060b');
        const [px, py] = k.el;
        telefonEkrani(ctx, px, py, 46, 92, -0.9, isik, t, 0);
        ctx.restore();
        // ışık patlaması anı
        if (t > 0.12 && t < 0.45) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(170,220,255,${0.35 * (1 - (t - 0.12) / 0.33)})`; ctx.fillRect(0, 0, W, H); ctx.restore(); }
      }
      // ---- B) telefon ekranı yakın plan: yeni mesaj yok ----
      if (t > insertBas - 0.1 && t < yakinBas + 0.4) {
        const a = ramp(t, insertBas - 0.1, insertBas + 0.3) * (1 - ramp(t, yakinBas - 0.1, yakinBas + 0.4));
        ctx.save(); ctx.globalAlpha = a;
        ctx.fillStyle = '#02040a'; ctx.fillRect(0, 0, W, H);
        const tt = t - insertBas, z = 1 + tt * 0.06;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * 0.5; ctx.drawImage(parilti('120,180,255'), 540 - 700, 900 - 700, 1400, 1400); ctx.restore();
        telefonEkrani(ctx, 540, 900, 560 * z, 1120 * z, -0.04, 1, t, 1);
        ctx.restore();
      }
      // ---- C) yüz yakın plan, telefon ışığı, göze dalış ----
      if (t > yakinBas - 0.1) {
        const a = ramp(t, yakinBas - 0.1, yakinBas + 0.3);
        const d = ease.in(ramp(t, dalisBas, S.d + 0.5, x => x));
        const K = lerp(13, 15, clamp((t - yakinBas) / 2)) * (1 + d * 5);
        // göz ekranın merkezine gelsin diye orijin
        const eg = 0.3, gx = GOZ[0] * Math.cos(eg) - GOZ[1] * Math.sin(eg), gy = GOZ[0] * Math.sin(eg) + GOZ[1] * Math.cos(eg);
        const hedef = [lerp(600, 540, d), lerp(820, 900, d)];
        ctx.save(); ctx.globalAlpha = a;
        ctx.fillStyle = '#02040a'; ctx.fillRect(0, 0, W, H);
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * 0.35; ctx.drawImage(parilti('100,160,240'), 900 - 600, 1500 - 600, 1200, 1200); ctx.restore();
        yakinYuz(ctx, t, { kenar: '150,210,255', on: '130,185,240', onGuc: 0.55, altIsik: 0.8, dolu: ramp(t, yakinBas, dalisBas), ekranYansima: 1, egim: eg }, { K, ox: hedef[0] - gx * K, oy: hedef[1] - gy * K });
        ctx.restore();
        if (d > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = d * 0.8; ctx.drawImage(parilti('160,220,255'), 540 - 900 * d, 900 - 900 * d, 1800 * d, 1800 * d); ctx.restore(); }
      }
      bokeh(ctx, t, 10, 3, '150,200,255', [2, 7], 0.12 * isik, 4);
    },
  });

  // ================= 2) ZİHİNSEL EVREN =================
  function balon(ctx, metin, giden, s, a) {
    ctx.save(); ctx.globalAlpha *= a; ctx.scale(s, s);
    ctx.font = `600 44px ${FONT}`;
    const w = ctx.measureText(metin).width + 64, h = 92;
    ctx.fillStyle = giden ? `rgba(${TRK},0.28)` : 'rgba(200,215,240,0.16)';
    ctx.strokeStyle = giden ? `rgba(${TRK},0.75)` : 'rgba(210,225,250,0.5)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 40); ctx.fill(); ctx.stroke();
    yazi(ctx, metin, 0, 2, { boyut: 44, agirlik: 600, renk: 'rgba(235,245,255,0.95)', golgeBulanik: 8 });
    ctx.restore();
  }
  function fotograf(ctx, tur, s, a, t) {
    const w = 420, h = 300;
    ctx.save(); ctx.globalAlpha *= a; ctx.scale(s, s);
    ctx.save(); ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 18); ctx.clip();
    const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    if (tur === 0) { g.addColorStop(0, '#f2a25c'); g.addColorStop(0.6, '#7a3b4a'); g.addColorStop(1, '#1b1426'); }
    else if (tur === 1) { g.addColorStop(0, '#1a2440'); g.addColorStop(1, '#0a0e1a'); }
    else { g.addColorStop(0, '#2c3a58'); g.addColorStop(1, '#3b2a2a'); }
    ctx.fillStyle = g; ctx.fillRect(-w / 2, -h / 2, w, h);
    if (tur === 0) { kisi(ctx, -40, h / 2 - 10, 180, {}, '#120c14'); kisi(ctx, 40, h / 2 - 10, 170, { basDon: -0.6 }, '#120c14'); }
    else if (tur === 1) { const r = rng(9); ctx.globalCompositeOperation = 'lighter'; for (let k = 0; k < 14; k++) { const z = 20 + r() * 40; ctx.drawImage(parilti('255,190,120'), (r() - 0.5) * w - z, (r() - 0.5) * h - z, z * 2, z * 2); } }
    else { ctx.fillStyle = 'rgba(255,220,180,0.35)'; ctx.beginPath(); ctx.arc(40, -10, 60, 0, TAU); ctx.fill(); kisi(ctx, -60, h / 2, 200, { basEgik: 0.6 }, '#0d0a10'); }
    ctx.fillStyle = 'rgba(255,200,140,0.18)'; ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,230,200,0.55)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 18); ctx.stroke();
    ctx.restore();
  }
  // tamamlanamayan halka (yarım kalan hikâye)
  function yarimHalka(ctx, cx, cy, R, t, a) {
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha = a; ctx.lineCap = 'round';
    const bosluk = 0.55 + 0.18 * Math.sin(t * 1.7);
    const bas = -Math.PI / 2 + t * 0.25, son = bas + TAU - bosluk;
    for (const [lw, al] of [[26, 0.15], [12, 0.35], [5, 1]]) {
      ctx.strokeStyle = `rgba(${ALTIN},${al})`; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.arc(cx, cy, R, bas, son); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'lighter';
    for (const aci of [bas, son]) { const x = cx + Math.cos(aci) * R, y = cy + Math.sin(aci) * R; ctx.globalAlpha = a * (0.7 + 0.3 * Math.sin(t * 9)); ctx.drawImage(parilti(ALTIN), x - 40, y - 40, 80, 80); }
    ctx.restore();
  }
  VIDEO.sahne('zihin', {
    ciz(ctx, S) {
      const t = S.t;
      const kir = ramp(t, S.at(1, 0.0), S.at(1, 0.55));          // anılar ışık zerreciklerine dönüşür
      const halkaA = ramp(t, S.at(1, 0.25), S.at(1, 0.7));
      const g = ctx.createRadialGradient(540, 860, 50, 540, 900, 1200);
      g.addColorStop(0, '#101c3a'); g.addColorStop(1, '#02040a');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.translate(540, 900); ctx.rotate(Math.sin(t * 0.3) * 0.03 + t * 0.01); ctx.translate(-540, -900);
      // yıldız tozu + sis
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const [x, y, s, ph] of A.yildiz) { const z = 1 + t * 0.06; const px = 540 + (x - 540) * z, py = 900 + (y - 900) * z; ctx.globalAlpha = 0.25 + 0.35 * Math.sin(t * 2 + ph) ** 2; ctx.fillStyle = '#cfe6ff'; ctx.fillRect(px, py, s, s); }
      ctx.globalAlpha = 0.5; ctx.drawImage(A.sis, -300 + Math.sin(t * 0.2) * 80, 300, 1700, 900);
      ctx.globalAlpha = 0.35; ctx.drawImage(A.sis, -500 - t * 20, 1000, 1900, 1000);
      ctx.restore();
      // uzaktaki siluet
      const sa = ramp(t, S.at(0, 0.3), S.at(0, 0.8)) * (1 - kir * 0.6);
      if (sa > 0) {
        ctx.save(); ctx.globalAlpha = sa;
        ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(parilti(ALTIN), 540 - 160, 760 - 220, 320, 440); ctx.globalCompositeOperation = 'source-over';
        kisiIsikli(ctx, 540, 900, 300, { basDon: Math.sin(t * 0.4) * 0.3 }, `rgba(${ALTIN},0.9)`, 'rgba(120,170,255,0.4)', '#05060c');
        ctx.restore();
      }
      // anılar: mesaj parçaları ve fotoğraflar (3B, kameraya yaklaşır)
      const F = 700, ogeler = A.ogeler.map(o => ({ ...o, z: o.z0 - t * 0.38 })).filter(o => o.z > 0.35).sort((a, b) => b.z - a.z);
      for (const o of ogeler) {
        const s = F / o.z / 700, x = 540 + o.x * s, y = 900 + o.y * s + Math.sin(t + o.ph) * 20 * s;
        const sis = clamp(1.6 - o.z / 4), a = clamp((o.z - 0.35) * 3) * sis;
        if (a <= 0.01) continue;
        if (kir < 1) {
          ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 0.5 + o.ph) * 0.08);
          if (o.z > 4) ctx.filter = 'blur(3px)';
          if (o.foto) fotograf(ctx, o.tur, s * 0.9, a * (1 - kir), t); else balon(ctx, o.metin, o.giden, s * 0.9, a * (1 - kir));
          ctx.restore();
        }
        if (kir > 0) {
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          for (const [dx, dy, gec] of o.par) {
            const u = clamp((kir - gec * 0.3) / 0.7);
            const sx = x + dx * 160 * s, sy = y + dy * 60 * s;
            const aci = Math.atan2(sy - 820, sx - 540) + u * 2.2, R = lerp(Math.hypot(sx - 540, sy - 820), 230 + dy * 30, ease.inOut(u));
            const px = 540 + Math.cos(aci) * R, py = 820 + Math.sin(aci) * R;
            ctx.globalAlpha = a * (0.4 + 0.6 * Math.sin(Math.PI * clamp(u * 0.9 + 0.1)));
            const z = 10 + 6 * s;
            ctx.drawImage(parilti(o.giden ? TRK : ALTIN), px - z, py - z, z * 2, z * 2);
          }
          ctx.restore();
        }
      }
      yarimHalka(ctx, 540, 820, 230, t, halkaA);
      ctx.restore();
    },
  });

  // ================= Koridor (sahne 3, 4, 5) =================
  // o: { camX, roll, ileri, sicak (0..1), yazilar (0..1), kapi (0..1), F }
  function koridor(ctx, t, o) {
    const F = o.F || 900, VPY = 760, X = 560, Y0 = -1000, Y1 = 1000;
    const renk = mix(TRK, ALTIN, o.sicak || 0);
    const P = (x, y, z) => [540 + (x - o.camX) * F / (z * 1000), VPY + y * F / (z * 1000)];
    ctx.save();
    ctx.translate(540, VPY); ctx.rotate(o.roll || 0); ctx.translate(-540, -VPY);
    // derinlik: koridor sonu parıltısı
    const bg = ctx.createRadialGradient(540 - o.camX * F / 30000, VPY, 10, 540, VPY, 1400);
    bg.addColorStop(0, `rgba(${renk},${0.35 + 0.5 * (o.kapi || 0)})`); bg.addColorStop(0.12, `rgba(${mix('10,20,40', '60,40,20', o.sicak || 0)},1)`); bg.addColorStop(1, '#020308');
    ctx.fillStyle = bg; ctx.fillRect(-300, -300, W + 600, H + 600);
    // kapı (koridor sonu)
    if (o.kapi > 0) {
      const [a1, b1] = P(-200, -600, 22), [a2, b2] = P(200, Y1, 22);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = o.kapi;
      ctx.fillStyle = `rgba(255,230,190,1)`; ctx.fillRect(a1, b1, a2 - a1, b2 - b1);
      const s = 380 + 500 * o.kapi; ctx.drawImage(parilti(ALTIN), (a1 + a2) / 2 - s, (b1 + b2) / 2 - s, s * 2, s * 2);
      ctx.restore();
    }
    // zemin, tavan, duvarlar (sis degradeli)
    const zN = 0.9, zF = 30;
    const yuzey = (pts, c1, c2) => {
      const q = pts.map(p => P(...p));
      const g = ctx.createLinearGradient(q[0][0], q[0][1], q[3][0], q[3][1]);
      g.addColorStop(0, c1); g.addColorStop(1, c2);
      ctx.fillStyle = g; ctx.beginPath(); q.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.closePath(); ctx.fill();
    };
    const koyu = mix('8,14,28', '30,20,14', o.sicak || 0);
    yuzey([[-X, Y1, zN], [X, Y1, zN], [X, Y1, zF], [-X, Y1, zF]], `rgba(${koyu},1)`, `rgba(${renk},0.05)`);
    yuzey([[-X, Y0, zN], [X, Y0, zN], [X, Y0, zF], [-X, Y0, zF]], `rgba(${koyu},1)`, `rgba(${renk},0.06)`);
    yuzey([[-X, Y0, zN], [-X, Y1, zN], [-X, Y1, zF], [-X, Y0, zF]], `rgba(${koyu},1)`, `rgba(${renk},0.08)`);
    yuzey([[X, Y0, zN], [X, Y1, zN], [X, Y1, zF], [X, Y0, zF]], `rgba(${koyu},1)`, `rgba(${renk},0.08)`);
    // neon çerçeveler (uzaktan yakına)
    const ad = 1.7, faz = ((o.ileri % ad) + ad) % ad, temel = Math.floor(o.ileri / ad);
    const cer = [];
    for (let k = 14; k >= 0; k--) { const z = k * ad - faz + 0.6; if (z > 0.75) cer.push([z, k + temel]); }
    for (const [z, id] of cer) {
      const sis = clamp(1.25 - z / 18), [x1, y1] = P(-X, Y0, z), [x2, y2] = P(X, Y1, z);
      ctx.save();
      ctx.strokeStyle = `rgba(${renk},${0.85 * sis})`; ctx.lineWidth = Math.min(22, 10 * F / z / 900);
      ctx.shadowColor = `rgba(${renk},${sis})`; ctx.shadowBlur = Math.min(50, 60 / z);
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      ctx.restore();
      // zemindeki yansıma
      ctx.save(); ctx.globalAlpha = 0.25 * sis; ctx.strokeStyle = `rgba(${renk},1)`; ctx.lineWidth = Math.min(12, 5 * F / z / 900);
      const [r1x, r1y] = P(-X, Y1 + 40, z), [r2x] = P(X, Y1 + 40, z);
      ctx.beginPath(); ctx.moveTo(r1x, r1y); ctx.lineTo(r2x, r1y); ctx.stroke(); ctx.restore();
      // duvarda beliren mesaj parçaları (aynı sırayla tekrar eder → döngü)
      if (o.yazilar > 0 && z > 0.9 && z < 16) {
        const sol = id % 2 === 0, metin = A.koridorYazi[((id % A.koridorYazi.length) + A.koridorYazi.length) % A.koridorYazi.length];
        const [tx, ty] = P(sol ? -X + 40 : X - 40, -220 + (id % 3) * 160, z + ad * 0.5);
        const boy = Math.min(110, 120 * F / (z + ad * 0.5) / 900);
        const titr = 0.75 + 0.25 * Math.sin(t * 13 + id * 3) * Math.sin(t * 5.3 + id);
        yazi(ctx, metin, tx, ty, { boyut: boy, agirlik: 700, hiza: sol ? 'left' : 'right', renk: `rgba(${mix('200,240,255', '255,225,180', o.sicak || 0)},1)`, alfa: o.yazilar * clamp(1.2 - z / 14) * titr, golgeRenk: `rgba(${renk},0.9)`, golgeBulanik: 24 });
      }
    }
    ctx.restore();
    return { P, renk };
  }
  // koridordaki kişi (z derinliğinde)
  function koridorKisi(ctx, kor, x, z, p, isik, alfa = 1) {
    const [sx, sy] = kor.P(x, 1000, z), h = 1750 * 0.9 / z;
    ctx.save(); ctx.globalAlpha *= alfa;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.ellipse(sx, sy, h * 0.14, h * 0.02, 0, 0, TAU); ctx.fill();
    kisiIsikli(ctx, sx, sy, h, p, `rgba(${isik},0.9)`, `rgba(${isik},0.45)`, '#04050a');
    ctx.restore();
    return [sx, sy - h * 0.9];
  }

  // ================= 3) SONSUZ KORİDOR =================
  VIDEO.sahne('koridor', {
    ciz(ctx, S) {
      const t = S.t;
      const camX = Math.sin(t * 0.55) * 260, roll = Math.sin(t * 0.55 + 0.6) * 0.06;
      const kor = koridor(ctx, t, { camX, roll, ileri: t * 1.15, sicak: 0, yazilar: ramp(t, 0.2, 1.0) });
      ctx.save(); ctx.translate(540, 760); ctx.rotate(roll); ctx.translate(-540, -760);
      // döngü hissi: ikinci cümlede kişinin yankıları
      const yanki = ramp(t, S.at(1, 0.05), S.at(1, 0.4));
      if (yanki > 0) for (let k = 3; k >= 1; k--) koridorKisi(ctx, kor, (k % 2 ? 1 : -1) * 480, 3.0 + k * 2.2, { faz: t * 6 + k, yuru: 1 }, TRK, 0.3 * yanki);
      koridorKisi(ctx, kor, -60, 3.0, { faz: t * 6, yuru: 1 }, TRK, 1);
      ctx.restore();
      bokeh(ctx, t, 18, 14, TRK, [2, 8], 0.2, 8);
    },
  });

  // ================= 4) FARK EDİŞ =================
  VIDEO.sahne('fark', {
    ciz(ctx, S) {
      const t = S.t;
      const dur = ramp(t, 0, 0.6);
      const bakis = pencere(t, 0.3, S.at(0, 0.62), 0.35);
      const coz = ramp(t, S.at(0, 0.18), S.at(0, 0.6));
      const don = ramp(t, S.at(0, 0.6), S.at(0, 0.8));
      const sicak = ramp(t, S.at(0, 0.45), S.d + 0.4);
      const camX = lerp(Math.sin(t * 0.55) * 200, 0, dur), roll = lerp(0.04, 0, dur);
      const kor = koridor(ctx, t, { camX, roll, ileri: 0.6 + t * 1.15 * (1 - dur) + 1.15 * Math.min(t, 0.6) * 0.5, sicak, yazilar: 1 - ramp(t, 0.2, S.at(0, 0.5)) });
      // uzaktaki siluet ışık zerreciklerine dönüşür
      const sz = 11, [ux, uy] = kor.P(300, 1000, sz), uh = 1750 * 0.9 / sz;
      if (coz < 1) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.6 * (1 - coz); const [gx, gy] = kor.P(300, 300, sz); ctx.drawImage(parilti(ALTIN), gx - 120, gy - 160, 240, 320); ctx.restore(); koridorKisi(ctx, kor, 300, sz, {}, ALTIN, 1 - coz); }
      if (coz > 0 && coz < 1) {
        const r = rng(3);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (let k = 0; k < 140; k++) {
          const bx = ux + (r() - 0.5) * uh * 0.25, by = uy - r() * uh, u = clamp((coz - r() * 0.4) / 0.6);
          ctx.globalAlpha = Math.sin(Math.PI * u) * 0.9;
          ctx.drawImage(parilti(ALTIN), bx + (r() - 0.5) * 300 * u - 8, by - 380 * u * r() - 8, 16, 16);
        }
        ctx.restore();
      }
      // ana karakter: durur, geriye bakar, döner ve kameraya doğru yürür
      const z = lerp(2.8, 1.5, ease.in(clamp((t - S.at(0, 0.7)) / (S.d - S.at(0, 0.7) + 0.5))));
      const yuru = Math.max(1 - dur, don);
      koridorKisi(ctx, kor, lerp(-300, -60, don), z, { faz: t * 6, yuru, basDon: lerp(0, 0.9, bakis), basEgik: 0.3 * bakis }, mix(TRK, ALTIN, sicak), 1);
      // sıcak ışık kameranın arkasından yayılır
      if (sicak > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35 * sicak; ctx.drawImage(parilti(ALTIN), 540 - 900, H - 600, 1800, 1200); ctx.restore(); }
      bokeh(ctx, t, 20, 16, mix(TRK, ALTIN, sicak), [2, 9], 0.22, 6);
    },
  });

  // ================= 5) KAPI VE LOGO =================
  function logo(ctx, t, a) {
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha = a;
    const cX = 540, cY = 820, R = 180, ciz = ramp(t, 0, 1.1);
    ctx.strokeStyle = `rgba(${TRK},0.95)`; ctx.lineWidth = 6; ctx.shadowColor = `rgba(${TRK},0.8)`; ctx.shadowBlur = 24;
    ctx.beginPath(); ctx.arc(cX, cY, R, -Math.PI / 2, -Math.PI / 2 + TAU * ciz); ctx.stroke();
    ctx.lineWidth = 2.5; ctx.globalAlpha = a * ramp(t, 0.4, 1.2);
    for (const k of [0.35, 0.7]) { ctx.beginPath(); ctx.ellipse(cX, cY, R * k, R, 0, 0, TAU); ctx.stroke(); }
    for (const k of [-0.5, 0, 0.5]) { const yy = cY + k * R, rr = Math.sqrt(1 - k * k) * R; ctx.beginPath(); ctx.ellipse(cX, yy, rr, rr * 0.18, 0, 0, TAU); ctx.stroke(); }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = a * ramp(t, 0.6, 1.4);
    ctx.save(); ctx.translate(cX - 10, cY + 10); ctx.scale(2.45, 2.45);
    ctx.fillStyle = 'rgba(8,16,34,0.85)'; ctx.fill(BAS); ctx.strokeStyle = `rgba(${TRK},0.9)`; ctx.lineWidth = 1.2; ctx.stroke(BAS);
    ctx.restore();
    ctx.restore();
    const harf = 'İNSAN ATLASI'.split('');
    ctx.save(); ctx.font = `800 80px ${FONT}`; ctx.letterSpacing = '14px';
    const w = ctx.measureText(harf.join('')).width; let x = W / 2 - w / 2;
    harf.forEach((h, i) => {
      const ha = ramp(t, 0.5 + i * 0.05, 1.0 + i * 0.05) * a;
      yazi(ctx, h, x + ctx.measureText(h).width / 2, 1110 + (1 - ha) * 18, { boyut: 80, agirlik: 800, alfa: ha, golgeRenk: `rgba(${TRK},0.6)`, golgeBulanik: 26 });
      x += ctx.measureText(h).width + 14;
    });
    ctx.restore();
  }
  VIDEO.sahne('son', {
    ciz(ctx, S) {
      const t = S.t;
      const kb = S.konusma.end;
      const z = lerp(2.4, 9, ease.inOut(clamp(t / (kb + 0.6))));        // karakter kapıya yürür, kamera geri çekilir
      const F = lerp(900, 640, ease.inOut(clamp(t / (kb + 0.6))));
      const kor = koridor(ctx, t, { camX: Math.sin(t * 0.3) * 40, roll: 0, ileri: -t * 0.6, sicak: 1, yazilar: 0, kapi: ramp(t, 0, 1.4), F });
      const [sx, sy] = kor.P(0, 1000, z), h = 1750 * F / (1000 * z);
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(sx, sy, h * 0.14, h * 0.02, 0, 0, TAU); ctx.fill();
      kisiIsikli(ctx, sx, sy, h, { faz: t * 5.5, yuru: 1 }, `rgba(${ALTIN},0.95)`, 'rgba(255,170,90,0.5)', '#06040a');
      bokeh(ctx, t, 20, 18, ALTIN, [2, 9], 0.25, 6);
      // kararma → logo
      const kar = ramp(t, kb - 0.3, kb + 0.5);
      if (kar > 0) { ctx.fillStyle = `rgba(2,4,10,${kar})`; ctx.fillRect(0, 0, W, H); }
      const la = ramp(t, kb + 0.3, kb + 0.9);
      if (la > 0) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = la * 0.5; ctx.drawImage(parilti(TRK), 540 - 500, 820 - 500, 1000, 1000); ctx.restore();
        logo(ctx, t - (kb + 0.3), la);
      }
    },
  });
})();
