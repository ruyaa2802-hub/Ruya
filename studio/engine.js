/* Ruya Studio — kod tabanlı video motoru (tarayıcı tarafı)
 * Her kare, zamana (saniye) bağlı saf bir fonksiyonla çizilir: aynı t → aynı görüntü.
 * Bu sayede render deterministiktir ve ses dosyası gelince sahneler sese göre esnetilebilir.
 */
(function () {
  'use strict';
  const W = 1080, H = 1920;

  // ---------- Matematik yardımcıları ----------
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const inv = (a, b, x) => clamp((x - a) / (b - a));
  const ease = {
    lin: t => t,
    in: t => t * t * t,
    out: t => 1 - Math.pow(1 - t, 3),
    inOut: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    sine: t => -(Math.cos(Math.PI * t) - 1) / 2,
    outBack: t => { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  };
  // a→b aralığında 0→1, yumuşatılmış
  const ramp = (x, a, b, e = ease.inOut) => e(inv(a, b, x));
  // a'da açılıp b'de kapanan pencere (yumuşak kenarlı)
  const pencere = (x, a, b, kenar = 0.3) => Math.min(ramp(x, a, a + kenar), 1 - ramp(x, b - kenar, b));

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- Gürültü (doku üretimi için) ----------
  function hash2(x, y, s) {
    let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function vnoise(x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  }
  function fbm(x, y, s, oct = 4) {
    let f = 0, amp = 0.5, fr = 1;
    for (let i = 0; i < oct; i++) { f += amp * vnoise(x * fr, y * fr, s + i * 17); amp *= 0.5; fr *= 2; }
    return f / (1 - Math.pow(0.5, oct));
  }

  function tuval(w = W, h = H) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  // Gürültüden doku: renk(f, x, y) → [r,g,b,a]
  function gurultuDokusu(w, h, olcek, seed, renk, oct = 4) {
    const c = tuval(w, h), x = c.getContext('2d');
    const img = x.createImageData(w, h), d = img.data;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const f = fbm(i / olcek, j / olcek, seed, oct);
      const r = renk(f, i, j), k = (j * w + i) * 4;
      d[k] = r[0]; d[k + 1] = r[1]; d[k + 2] = r[2]; d[k + 3] = r[3] === undefined ? 255 : r[3];
    }
    x.putImageData(img, 0, 0);
    return c;
  }

  // ---------- Sinematik son işlem ----------
  let grenler = [], vinyet = null;
  function sonIslemHazirla() {
    const r = rng(99);
    for (let n = 0; n < 4; n++) {
      const c = tuval(540, 960), x = c.getContext('2d');
      const img = x.createImageData(540, 960), d = img.data;
      for (let k = 0; k < d.length; k += 4) {
        const v = 128 + (r() - 0.5) * 255;
        d[k] = d[k + 1] = d[k + 2] = v; d[k + 3] = 255;
      }
      x.putImageData(img, 0, 0);
      grenler.push(c);
    }
    vinyet = tuval();
    const v = vinyet.getContext('2d');
    const g = v.createRadialGradient(W / 2, H * 0.48, H * 0.22, W / 2, H * 0.5, H * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.62)');
    v.fillStyle = g; v.fillRect(0, 0, W, H);
  }

  // ---------- Yazı yardımcıları ----------
  const FONT = '"Inter Studio", Inter, "DejaVu Sans", sans-serif';
  function yazi(ctx, metin, x, y, o = {}) {
    ctx.save();
    ctx.font = `${o.agirlik || 800} ${o.boyut || 60}px ${FONT}`;
    ctx.textAlign = o.hiza || 'center';
    ctx.textBaseline = o.taban || 'middle';
    ctx.globalAlpha *= o.alfa === undefined ? 1 : o.alfa;
    if (o.aralik) ctx.letterSpacing = o.aralik + 'px';
    if (o.golge !== false) {
      ctx.shadowColor = o.golgeRenk || 'rgba(0,0,0,0.85)';
      ctx.shadowBlur = o.golgeBulanik === undefined ? 18 : o.golgeBulanik;
      ctx.shadowOffsetY = 3;
    }
    if (o.kontur) { ctx.lineWidth = o.kontur; ctx.strokeStyle = o.konturRenk || 'rgba(0,0,0,0.6)'; ctx.lineJoin = 'round'; ctx.strokeText(metin, x, y); }
    ctx.fillStyle = o.renk || '#fff';
    ctx.fillText(metin, x, y);
    ctx.restore();
  }

  // Anatomik etiket: nokta + çizgi + yazı (ekran koordinatı)
  function etiket(ctx, px, py, lx, ly, metin, alfa, o = {}) {
    if (alfa <= 0.001) return;
    ctx.save();
    ctx.globalAlpha = alfa;
    const renk = o.renk || 'rgba(235,245,255,0.95)';
    ctx.strokeStyle = renk; ctx.fillStyle = renk; ctx.lineWidth = 2.5;
    ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 8;
    const ilerleme = ease.out(clamp(alfa * 1.4));
    ctx.beginPath(); ctx.arc(px, py, 7, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(lerp(px, lx, ilerleme), lerp(py, ly, ilerleme)); ctx.stroke();
    const sag = lx >= px;
    yazi(ctx, metin, lx + (sag ? 14 : -14), ly - 4, { boyut: o.boyut || 40, agirlik: 700, hiza: sag ? 'left' : 'right', golgeBulanik: 12 });
    if (o.alt) yazi(ctx, o.alt, lx + (sag ? 14 : -14), ly + 38, { boyut: 30, agirlik: 500, hiza: sag ? 'left' : 'right', renk: 'rgba(200,220,240,0.85)' });
    ctx.restore();
  }

  // ---------- Kayıt defteri ----------
  const VIDEO = { sahneler: {}, yardimci: {} };
  VIDEO.sahne = (id, tanim) => { VIDEO.sahneler[id] = tanim; };

  const R = { W, H, clamp, lerp, inv, ease, ramp, pencere, rng, fbm, vnoise, tuval, gurultuDokusu, yazi, etiket, FONT };

  // ---------- Altyazı ----------
  function altyaziCiz(ctx, TL, t) {
    const parcalar = TL.altyazi || [];
    let p = null;
    for (const a of parcalar) if (t >= a.start - 0.04 && t < a.end) { p = a; break; }
    if (!p) return;
    const giris = ease.outBack(clamp((t - p.start + 0.04) / 0.22));
    const cikis = p.devam ? 1 : 1 - clamp((t - (p.end - 0.12)) / 0.12);
    const y = TL.altyaziY || 1390;
    ctx.save();
    ctx.font = `800 62px ${FONT}`;
    // kelimeleri satırlara böl (max genişlik)
    const maxW = 960, bosluk = ctx.measureText(' ').width * 1.15 + 10;
    const satirlar = [[]]; let gen = 0;
    for (const k of p.kelimeler) {
      const w = ctx.measureText(k.k).width;
      if (gen > 0 && gen + bosluk + w > maxW) { satirlar.push([]); gen = 0; }
      satirlar[satirlar.length - 1].push({ ...k, w });
      gen += (gen > 0 ? bosluk : 0) + w;
    }
    const satirH = 84;
    const y0 = y - ((satirlar.length - 1) * satirH) / 2 + (1 - giris) * 26;
    ctx.globalAlpha = clamp(giris) * cikis;
    ctx.textBaseline = 'middle';
    satirlar.forEach((satir, si) => {
      const toplam = satir.reduce((s, k) => s + k.w, 0) + bosluk * (satir.length - 1);
      let x = W / 2 - toplam / 2;
      for (const k of satir) {
        const aktif = t >= k.start && t < k.end + 0.05;
        const gecti = t >= k.end;
        const sc = aktif ? 1 + 0.08 * Math.sin(Math.PI * clamp((t - k.start) / Math.max(0.12, k.end - k.start))) : 1;
        ctx.save();
        ctx.translate(x + k.w / 2, y0 + si * satirH);
        ctx.scale(sc, sc);
        ctx.lineJoin = 'round'; ctx.lineWidth = 12; ctx.strokeStyle = 'rgba(0,0,0,0.78)';
        ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 20;
        ctx.textAlign = 'center';
        ctx.strokeText(k.k, 0, 0);
        ctx.shadowBlur = 0;
        ctx.fillStyle = aktif ? '#FFD54A' : gecti ? '#FFFFFF' : 'rgba(255,255,255,0.62)';
        ctx.fillText(k.k, 0, 0);
        ctx.restore();
        x += k.w + bosluk;
      }
    });
    ctx.restore();
  }

  // ---------- Kare oluşturma ----------
  let ana, actx, katA, katB, gecici, TL, hazir = false;

  function bolumBul(t) {
    const b = TL.bolumler;
    for (let i = 0; i < b.length; i++) if (t < b[i].end || i === b.length - 1) return i;
    return b.length - 1;
  }

  function sahneDurumu(i, t) {
    const b = TL.bolumler[i];
    const local = t - b.start;
    return {
      t: local, d: b.end - b.start, gt: t, p: local / (b.end - b.start),
      bolum: b,
      cue: k => {
        const c = b.cumleler[clamp(k, 0, b.cumleler.length - 1)];
        return { start: c.start - b.start, end: c.end - b.start, d: c.end - c.start };
      },
      // k. cümlenin içindeki göreli ilerleme (0..1); cümle bitmeden önce/sonra kırpılır
      ci: (k, a = 0, z = 1) => {
        const c = b.cumleler[clamp(k, 0, b.cumleler.length - 1)];
        const s = c.start - b.start, e = c.end - b.start;
        return clamp((local - (s + a * (e - s))) / Math.max(0.01, (z - a) * (e - s)));
      },
      // cümle içindeki oranın yerel saniyesi
      at: (k, oran = 0) => {
        const c = b.cumleler[clamp(k, 0, b.cumleler.length - 1)];
        return c.start - b.start + oran * (c.end - c.start);
      },
      konusma: { start: b.konusma.start - b.start, end: b.konusma.end - b.start },
      R,
    };
  }

  function sahneCiz(i, t, hedef) {
    const b = TL.bolumler[i];
    const tanim = VIDEO.sahneler[b.sahne];
    const c = hedef.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.filter = 'none';
    c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
    if (tanim) tanim.ciz(c, sahneDurumu(i, t));
  }

  function katCiz(kat, alfa, olcek, bulanik) {
    if (alfa <= 0.001) return;
    actx.save();
    actx.globalAlpha = alfa;
    if (bulanik > 0.3) actx.filter = `blur(${bulanik.toFixed(1)}px)`;
    actx.translate(W / 2, H / 2); actx.scale(olcek, olcek); actx.translate(-W / 2, -H / 2);
    actx.drawImage(kat, 0, 0);
    actx.restore();
  }

  function kare(t) {
    const B = TL.bolumler;
    const i = bolumBul(t);
    actx.setTransform(1, 0, 0, 1, 0, 0);
    actx.globalAlpha = 1; actx.filter = 'none'; actx.globalCompositeOperation = 'source-over';
    actx.fillStyle = '#000'; actx.fillRect(0, 0, W, H);

    // Geçiş penceresi: sınırın iki yanına yayılır
    let gecisVar = false;
    for (let k = 0; k < B.length - 1; k++) {
      const sinir = B[k].end, yari = (B[k].gecisSure || 1.0) / 2;
      if (t >= sinir - yari && t < sinir + yari) {
        gecisVar = true;
        const u = (t - (sinir - yari)) / (2 * yari);
        sahneCiz(k, t, katA);
        sahneCiz(k + 1, t, katB);
        const tur = B[k].gecis || 'karart';
        if (tur === 'dalis') {
          const e = ease.inOut(u);
          katCiz(katA, 1 - ease.in(u), lerp(1, 2.4, ease.in(u)), 22 * Math.sin(Math.PI * u));
          katCiz(katB, ease.out(clamp(u * 1.4 - 0.2)), lerp(1.35, 1, e), 22 * Math.sin(Math.PI * u) * (1 - u));
        } else if (tur === 'capraz') {
          katCiz(katA, 1, 1, 0);
          katCiz(katB, ease.inOut(u), 1, 0);
        } else { // karart: karanlıktan geçerek
          katCiz(katA, 1 - ease.inOut(clamp(u * 2)), lerp(1, 1.06, u), 10 * u);
          katCiz(katB, ease.inOut(clamp(u * 2 - 1)), lerp(1.06, 1, u), 10 * (1 - u));
        }
        break;
      }
    }
    if (!gecisVar) { sahneCiz(i, t, katA); katCiz(katA, 1, 1, 0); }

    // Son işlem: vinyet + film greni
    actx.drawImage(vinyet, 0, 0);
    const gi = Math.floor(t * 30) % grenler.length;
    const r = rng(Math.floor(t * 30) + 7);
    actx.save();
    actx.globalCompositeOperation = 'overlay';
    actx.globalAlpha = 0.07;
    actx.drawImage(grenler[gi], -r() * 60, -r() * 60, W + 120, H + 120);
    actx.restore();

    // Kanca başlığı (ilk sahne)
    if (TL.kanca) {
      const k = TL.kanca, a = pencere(t, k.start, k.end, 0.45);
      if (a > 0) {
        actx.save();
        actx.globalAlpha = a;
        const dy = (1 - ease.out(clamp((t - k.start) / 0.8))) * 30;
        yazi(actx, k.ust, W / 2, 255 + dy, { boyut: 34, agirlik: 600, aralik: 8, renk: 'rgba(255,213,74,0.95)' });
        k.satirlar.forEach((s, n) => yazi(actx, s, W / 2, 330 + n * 82 + dy, { boyut: 70, agirlik: 800, golgeBulanik: 26 }));
        actx.restore();
      }
    }

    altyaziCiz(actx, TL, t);

    // Açılış/kapanış kararması
    const fade = Math.min(clamp(t / 0.6), clamp((TL.toplam - t) / 0.8));
    if (fade < 1) { actx.fillStyle = `rgba(0,0,0,${1 - fade})`; actx.fillRect(0, 0, W, H); }
  }

  async function baslat(timeline) {
    TL = timeline;
    ana = document.getElementById('sahne');
    ana.width = W; ana.height = H;
    actx = ana.getContext('2d');
    katA = tuval(); katB = tuval(); gecici = tuval();
    // yazı tiplerinin yüklenmesini bekle
    try { await document.fonts.load(`800 60px "Inter Studio"`); await document.fonts.load(`600 40px "Inter Studio"`); } catch (e) { }
    sonIslemHazirla();
    for (const id in VIDEO.sahneler) if (VIDEO.sahneler[id].hazirla) VIDEO.sahneler[id].hazirla(R);
    hazir = true;
  }

  window.VIDEO = VIDEO;
  window.STUDIO = {
    baslat, kare, R,
    get hazir() { return hazir; },
    get TL() { return TL; },
    // Render için: kareyi çiz ve JPEG olarak döndür
    kareJpeg(t, kalite = 0.93) { kare(t); return ana.toDataURL('image/jpeg', kalite); },
    karePng(t) { kare(t); return ana.toDataURL('image/png'); },
  };
})();
