/* Ruya Studio — videolar arasında ortak çizim kütüphanesi (STUDIO.K)
 * kamera, anahtar kare, sprite, bokeh, alan derinliği, insan silueti, hap etiketi, ışık halkası.
 */
(function () {
  const { W, H, clamp, lerp, ease, rng, tuval, yazi, FONT } = STUDIO.R;
  const TAU = Math.PI * 2;
  const onbellek = {};

  function kamera(ctx, cx, cy, z, rot = 0) {
    ctx.translate(W / 2, H / 2); ctx.rotate(rot); ctx.scale(z, z); ctx.translate(-cx, -cy);
  }
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
  function sprite(r, ic) {
    const c = tuval(r * 2, r * 2), x = c.getContext('2d');
    const g = x.createRadialGradient(r, r, 0, r, r, r);
    ic(g); x.fillStyle = g; x.fillRect(0, 0, r * 2, r * 2); return c;
  }
  // renkli parıltı sprite'ı (önbellekli): renk "r,g,b"
  function parilti(renk) {
    if (!onbellek['p' + renk]) onbellek['p' + renk] = sprite(64, g => {
      g.addColorStop(0, `rgba(255,255,255,1)`); g.addColorStop(0.18, `rgba(${renk},0.85)`); g.addColorStop(1, `rgba(${renk},0)`);
    });
    return onbellek['p' + renk];
  }
  function bokeh(ctx, t, n, seed, renk = '255,190,130', boyut = [3, 14], alfa = 0.35, hiz = 12) {
    const r = rng(seed), sp = parilti(renk);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const x0 = r() * W, y0 = r() * H, s = lerp(boyut[0], boyut[1], r()), ph = r() * TAU, v = (0.4 + r()) * hiz;
      const x = (x0 + Math.sin(t * 0.3 + ph) * 30 + t * v * 0.3) % (W + 40) - 20;
      const y = ((y0 - t * v) % (H + 40) + H + 40) % (H + 40) - 20;
      ctx.globalAlpha = alfa * (0.4 + 0.6 * Math.sin(t * 0.8 + ph) ** 2);
      ctx.drawImage(sp, x - s, y - s, s * 2, s * 2);
    }
    ctx.restore();
  }
  function alanDerinligi(ctx, kaynak, guc = 14, odakY = 0.5, bant = 0.22) {
    if (!onbellek.dof) onbellek.dof = tuval();
    const gx = onbellek.dof.getContext('2d');
    gx.setTransform(1, 0, 0, 1, 0, 0); gx.globalCompositeOperation = 'source-over'; gx.clearRect(0, 0, W, H);
    gx.filter = `blur(${guc}px)`; gx.drawImage(kaynak, 0, 0); gx.filter = 'none';
    gx.globalCompositeOperation = 'destination-in';
    const m = gx.createLinearGradient(0, 0, 0, H), a = clamp(odakY - bant), b = clamp(odakY + bant);
    m.addColorStop(0, '#000'); m.addColorStop(a, 'rgba(0,0,0,0)'); m.addColorStop(b, 'rgba(0,0,0,0)'); m.addColorStop(1, '#000');
    gx.fillStyle = m; gx.fillRect(0, 0, W, H); gx.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(onbellek.dof, 0, 0); ctx.restore();
  }

  // Ön görünüş insan silueti. p: faz, yuru, irkil, basDon, basEgik, kol (0..1 göğse), elHedef [ux,uy] (omuza göre, u birimi)
  // döndürür: { el:[x,y], bas:[x,y], omuzY, u }
  function kisi(ctx, cx, ayakY, h, p, renk) {
    const u = h / 100, faz = p.faz || 0, yur = p.yuru || 0;
    const bob = -Math.abs(Math.sin(faz)) * 1.1 * u * yur + (p.zipla || 0) * -4 * u;
    const kalcaY = ayakY - 47 * u + bob;
    const omuzY = ayakY - 82 * u + bob - (p.irkil || 0) * 2.2 * u;
    ctx.fillStyle = renk; ctx.strokeStyle = renk; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    [[-1, Math.max(0, Math.sin(faz))], [1, Math.max(0, -Math.sin(faz))]].forEach(([s, kalk]) => {
      const kl = kalk * 3.2 * u * yur, ax = cx + s * 4.6 * u, ay = ayakY - kl;
      ctx.beginPath(); ctx.moveTo(cx + s * 0.6 * u, kalcaY); ctx.lineTo(cx + s * 9.6 * u, kalcaY);
      ctx.lineTo(ax + s * 3.4 * u, ay - 2 * u); ctx.lineTo(ax - s * 2.2 * u, ay - 2 * u); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.ellipse(ax + s * 0.6 * u, ay - 0.6 * u, 3.6 * u, 1.9 * u, 0, 0, TAU); ctx.fill();
    });
    ctx.beginPath();
    ctx.moveTo(cx - 10.5 * u, kalcaY + 3 * u); ctx.lineTo(cx - 13.2 * u, omuzY + 5 * u);
    ctx.quadraticCurveTo(cx - 13 * u, omuzY, cx - 7 * u, omuzY - 1.2 * u); ctx.lineTo(cx + 7 * u, omuzY - 1.2 * u);
    ctx.quadraticCurveTo(cx + 13 * u, omuzY, cx + 13.2 * u, omuzY + 5 * u); ctx.lineTo(cx + 10.5 * u, kalcaY + 3 * u); ctx.closePath(); ctx.fill();
    const salin = Math.sin(faz) * 2.2 * u * yur;
    ctx.lineWidth = 5.6 * u;
    const solEl = p.solElHedef ? [cx + p.solElHedef[0] * u, omuzY + p.solElHedef[1] * u] : [cx + 13.4 * u + salin, omuzY + 35 * u];
    const solDirsek = p.solElHedef ? [(cx + 11.6 * u + solEl[0]) / 2 + 5 * u, (omuzY + 3 * u + solEl[1]) / 2 + 3 * u] : [cx + 14.2 * u + salin * 0.3, omuzY + 19 * u];
    ctx.beginPath(); ctx.moveTo(cx + 11.6 * u, omuzY + 3 * u); ctx.lineTo(...solDirsek); ctx.lineTo(...solEl); ctx.stroke();
    let el, dirsek;
    if (p.elHedef) {
      el = [cx + p.elHedef[0] * u, omuzY + p.elHedef[1] * u];
      dirsek = [(cx - 11.6 * u + el[0]) / 2 - 5 * u, (omuzY + 3 * u + el[1]) / 2 + 3 * u];
    } else {
      const k = p.kol || 0;
      dirsek = [lerp(cx - 14.2 * u - salin * 0.3, cx - 17 * u, k), lerp(omuzY + 19 * u, omuzY + 22 * u, k)];
      el = [lerp(cx - 13.4 * u - salin, cx - 2 * u, k), lerp(omuzY + 35 * u, omuzY + 15 * u, k)];
    }
    ctx.beginPath(); ctx.moveTo(cx - 11.6 * u, omuzY + 3 * u); ctx.lineTo(...dirsek); ctx.lineTo(...el); ctx.stroke();
    ctx.beginPath(); ctx.arc(el[0], el[1], 3 * u, 0, TAU); ctx.fill();
    const basX = cx + (p.basDon || 0) * 2.6 * u, basY = omuzY - 9.5 * u + (p.basEgik || 0) * 2.4 * u;
    ctx.fillRect(cx - 2.6 * u, omuzY - 5 * u, 5.2 * u, 5 * u);
    ctx.beginPath(); ctx.ellipse(basX, basY, 6.1 * u, 7.4 * u, (p.basDon || 0) * 0.12 + (p.basEgim || 0), 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(basX - 0.4 * u, basY - 4.2 * u, 6.6 * u, 4.4 * u, -0.1 + (p.basEgim || 0), Math.PI, TAU); ctx.fill();
    return { el, bas: [basX, basY], omuzY, u };
  }
  // Kenar ışıklı siluet: sıcak + soğuk kenar, koyu dolgu
  function kisiIsikli(ctx, cx, ayakY, h, p, sicak = 'rgba(255,170,95,0.85)', soguk = 'rgba(120,160,230,0.6)', dolgu = '#07070c') {
    kisi(ctx, cx + h * 0.006, ayakY, h, p, sicak);
    kisi(ctx, cx - h * 0.005, ayakY, h, p, soguk);
    return kisi(ctx, cx, ayakY, h, p, dolgu);
  }

  function hap(ctx, metin, x, y, zemin, renk, alfa, boyut = 46) {
    if (alfa <= 0) return;
    ctx.save(); ctx.globalAlpha = alfa;
    ctx.font = `800 ${boyut}px ${FONT}`;
    const w = ctx.measureText(metin).width + boyut * 1.2;
    ctx.fillStyle = zemin; ctx.beginPath(); ctx.roundRect(x - w / 2, y - boyut * 0.8, w, boyut * 1.6, boyut * 0.8); ctx.fill();
    ctx.restore();
    yazi(ctx, metin, x, y + 2, { boyut, agirlik: 800, renk, alfa, golgeBulanik: 6 });
  }
  // Genişleyen ışık halkaları (dokunma / ses dalgası)
  function halkalar(ctx, x, y, t, o = {}) {
    const n = o.n || 3, hiz = o.hiz || 1, maxR = o.maxR || 160, renk = o.renk || '255,213,74', kalin = o.kalin || 5, alfa = o.alfa ?? 1;
    ctx.save();
    for (let k = 0; k < n; k++) {
      const u = (((t * hiz + k / n) % 1) + 1) % 1;
      ctx.strokeStyle = `rgba(${renk},${alfa * (1 - u)})`; ctx.lineWidth = kalin * (1 - u * 0.6);
      ctx.beginPath();
      if (o.yay) ctx.arc(x, y, 20 + u * maxR, o.yay[0], o.yay[1]); else ctx.arc(x, y, 20 + u * maxR, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }
  // Stüdyo arka planı: koyu degrade + spot ışığı
  function studyo(ctx, ust = '#0b0816', alt = '#030206', spot = '120,90,200', sx = W / 2, sy = H * 0.42, sr = 900, sa = 0.35) {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, ust); g.addColorStop(1, alt);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const s = ctx.createRadialGradient(sx, sy, 10, sx, sy, sr);
    s.addColorStop(0, `rgba(${spot},${sa})`); s.addColorStop(1, `rgba(${spot},0)`);
    ctx.fillStyle = s; ctx.fillRect(0, 0, W, H);
  }

  STUDIO.K = { kamera, kf, sprite, parilti, bokeh, alanDerinligi, kisi, kisiIsikli, hap, halkalar, studyo, TAU };
})();
