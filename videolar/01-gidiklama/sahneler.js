/* 01 · Neden kendimizi gıdıklayamayız?
   Tüm görseller kodla çizilir (SVG). Zamanlar cümle/kelime referanslıdır:
   M.c(id).bas/.son  ve  M.kz(cumleId, 'kelime')  ses değişince otomatik kayar. */
(function () {
  const M = Motor, S = M.svg, gec = M.gec, aralik = M.aralik, lerp = M.lerp, clamp = M.clamp;
  const CYAN = '#5ce1e6', BUZ = '#bff6ff', AMBER = '#ffb547', ALTIN = '#ffc847', MOR = '#7b5cff', PEMBE = '#ff8fb1';

  // ---------- ortak yardımcılar ----------
  const yazi = (p, x, y, metin, o = {}) => {
    const e = S('text', { x, y, fill: o.renk || '#fff', 'font-family': o.aile || 'Inter', 'font-weight': o.kalin || 700, 'font-size': o.boyut || 32,
      'text-anchor': o.hiza || 'start', 'letter-spacing': o.aralik || 0, opacity: o.op ?? 1 }, p);
    e.textContent = metin;
    if (o.parla) e.setAttribute('filter', 'url(#parla)');
    return e;
  };
  // Daktilo efektiyle açılan HUD etiketi
  const hud = (p, x, y, baslik, alt, renk = CYAN) => {
    const g = S('g', { transform: `translate(${x},${y})` }, p);
    const cizgi = S('path', { d: 'M0,0 L0,-46 M0,0 L46,0', stroke: renk, 'stroke-width': 4, fill: 'none' }, g);
    const b = yazi(g, 24, -16, '', { boyut: 42, renk, aralik: 5, parla: true });
    const a = yazi(g, 24, 32, '', { boyut: 32, renk: BUZ, kalin: 500, op: 0.9 });
    return {
      g,
      ciz(p) {
        g.setAttribute('opacity', clamp(p * 3));
        b.textContent = baslik.slice(0, Math.round(baslik.length * clamp(p * 1.6)));
        a.textContent = alt.slice(0, Math.round(alt.length * clamp(p * 1.6 - 0.35)));
        cizgi.setAttribute('opacity', clamp(p * 4));
      },
    };
  };
  // Arka plan: derin karanlık + spot ışık + hacimsel huzme
  const arkaPlan = (s, renk = 'url(#spot)', huzme = true) => {
    S('rect', { x: -600, y: -600, width: 2280, height: 3120, fill: '#03060d' }, s.kam);
    const spot = S('ellipse', { cx: 540, cy: 760, rx: 760, ry: 900, fill: renk }, s.kam);
    let h = null;
    if (huzme) {
      h = S('g', { opacity: 0.6 }, s.kam);
      S('polygon', { points: '380,-200 700,-200 1050,1500 -60,1500', fill: 'url(#isikHuzmesi)', filter: 'url(#bulanik)' }, h);
    }
    return { spot, h };
  };
  // Katmull-Rom ile kapalı yumuşak yol
  const yumusakYol = (nok, kapali = true) => {
    const n = nok.length, P = (i) => nok[(i + n) % n];
    let d = `M${P(0)[0]},${P(0)[1]}`;
    const son = kapali ? n : n - 1;
    for (let i = 0; i < son; i++) {
      const p0 = kapali ? P(i - 1) : nok[Math.max(0, i - 1)], p1 = P(i), p2 = P(i + 1), p3 = kapali ? P(i + 2) : nok[Math.min(n - 1, i + 2)];
      d += ` C${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]},${p2[1]}`;
    }
    return d + (kapali ? 'Z' : '');
  };
  // Bir yol üzerinde ilerleyen ışık darbesi
  const darbe = (p, yol, renk, r = 10) => {
    const L = yol.getTotalLength();
    const g = S('g', {}, p);
    const kuyruk = S('circle', { r: r * 2.4, fill: renk, opacity: 0.25, filter: 'url(#bulanikAz)' }, g);
    const bas = S('circle', { r, fill: '#fff', filter: 'url(#parla)' }, g);
    S('circle', { r: r * 0.6, fill: renk }, g);
    return {
      ciz(q, op = 1) {
        if (q <= 0 || q >= 1) { g.setAttribute('opacity', 0); return; }
        const pt = yol.getPointAtLength(L * q);
        g.setAttribute('transform', `translate(${pt.x},${pt.y})`);
        g.setAttribute('opacity', op * Math.min(1, q * 8, (1 - q) * 8));
      },
    };
  };

  // ---------- hologram gövde (sahne 1 ve 4) ----------
  function govde(p, renk = CYAN) {
    const g = S('g', {}, p);
    const dis = 'M500,598 C430,616 330,628 286,688 C262,722 262,780 272,832 C290,932 302,1030 330,1120 C345,1170 356,1230 360,1320 ' +
      'L720,1320 C724,1230 735,1170 750,1120 C778,1030 790,932 808,832 C818,780 818,722 794,688 C750,628 650,616 580,598 Z';
    S('path', { d: dis, fill: 'rgba(92,225,230,.07)', stroke: renk, 'stroke-width': 4, filter: 'url(#parla)' }, g);
    // baş + boyun
    S('ellipse', { cx: 540, cy: 432, rx: 92, ry: 112, fill: 'rgba(92,225,230,.08)', stroke: renk, 'stroke-width': 4, filter: 'url(#parla)' }, g);
    S('path', { d: 'M506,536 L500,600 M574,536 L580,600', stroke: renk, 'stroke-width': 4, fill: 'none' }, g);
    // omurga
    const om = S('g', { opacity: 0.25 }, g);
    for (let i = 0; i < 16; i++) S('rect', { x: 528, y: 610 + i * 42, width: 24, height: 30, rx: 8, fill: 'none', stroke: renk, 'stroke-width': 2 }, om);
    // köprücük kemikleri
    S('path', { d: 'M532,640 C480,628 410,640 352,668 M548,640 C600,628 670,640 728,668', stroke: renk, 'stroke-width': 3, fill: 'none', opacity: 0.7 }, g);
    // göğüs kemiği
    S('path', { d: 'M540,656 L540,900', stroke: renk, 'stroke-width': 10, 'stroke-linecap': 'round', opacity: 0.55 }, g);
    // kaburgalar
    const kaburgalar = [];
    for (let i = 0; i < 10; i++) {
      const y0 = 676 + i * 34, gen = 232 - i * 3 - (i > 7 ? 60 : 0), d = 70 + i * 7;
      for (const yon of [-1, 1]) {
        const k = S('path', {
          d: `M${540 + yon * 14},${y0} C${540 + yon * 150},${y0 - 26} ${540 + yon * (gen - 6)},${y0 + 12} ${540 + yon * (gen - 14)},${y0 + d}`,
          stroke: renk, 'stroke-width': 7 - i * 0.3, fill: 'none', 'stroke-linecap': 'round', opacity: 0.6,
        }, g);
        kaburgalar.push({ k, i, yon });
      }
    }
    // tarama çizgileri (hologram dokusu)
    const tarama = S('g', { opacity: 0.12 }, g);
    for (let y = 330; y < 1320; y += 14) S('line', { x1: 250, x2: 830, y1: y, y2: y, stroke: renk, 'stroke-width': 1 }, tarama);
    return { g, kaburgalar, tarama };
  }

  // =====================================================================
  // SAHNE 1 — Kanca: kendi elinle gıdıklama (cümle 1–3)
  // =====================================================================
  M.sahne({
    ad: 'kanca', cumleler: [1, 3],
    kur(s) {
      s.ap = arkaPlan(s);
      s.gv = govde(s.kam);
      // Kişinin kendi kolu (sağ omuzdan sol kaburgalara)
      s.kol = S('g', {}, s.kam);
      s.kolDis = S('path', { fill: 'none', stroke: CYAN, 'stroke-width': 78, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', filter: 'url(#parla)', opacity: 0.9 }, s.kol);
      s.kolIc = S('path', { fill: 'none', stroke: '#06121c', 'stroke-width': 68, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, s.kol);
      s.parmaklar = [0, 1, 2, 3].map(() => ({
        dis: S('path', { fill: 'none', stroke: CYAN, 'stroke-width': 26, 'stroke-linecap': 'round', filter: 'url(#parla)' }, s.kol),
        ic: S('path', { fill: 'none', stroke: '#06121c', 'stroke-width': 17, 'stroke-linecap': 'round' }, s.kol),
      }));
      s.temas = S('g', {}, s.kam);
      s.halka = [0, 1, 2].map(() => S('circle', { fill: 'none', stroke: CYAN, 'stroke-width': 3 }, s.temas));
      // Sinyal ölçer HUD
      s.olcer = S('g', { transform: 'translate(90,300)' }, s.svg);
      S('rect', { x: 0, y: 0, width: 400, height: 150, rx: 14, fill: 'rgba(3,10,20,.55)', stroke: 'rgba(92,225,230,.5)', 'stroke-width': 2 }, s.olcer);
      yazi(s.olcer, 24, 42, 'GIDIKLANMA SİNYALİ', { boyut: 24, renk: CYAN, aralik: 3 });
      s.osilo = S('path', { fill: 'none', stroke: CYAN, 'stroke-width': 4, filter: 'url(#parla)' }, s.olcer);
      s.yuzde = yazi(s.olcer, 376, 42, '%0', { boyut: 26, renk: '#fff', hiza: 'end' });
      // Soru işareti
      s.soru = S('g', { opacity: 0 }, s.svg);
      S('circle', { cx: 540, cy: 760, r: 300, fill: 'url(#spotAmber)' }, s.soru);
      s.soruYazi = yazi(s.soru, 540, 950, '?', { aile: 'InterDisplay', kalin: 800, boyut: 560, renk: ALTIN, hiza: 'middle', parla: true });
    },
    ciz(t, s) {
      const c1 = M.c(1), c2 = M.c(2), c3 = M.c(3);
      // kamera: yavaş içeri itme, sonra "Peki neden?" ile ani yaklaşma
      const it = gec(t, 0, c2.son, 'sin');
      const vur = gec(t, c3.bas - 0.15, c3.bas + 0.35, 'outExpo');
      const sallan = M.gurultu(t * 0.8, 3) * 6;
      M.kamera(s.kam, { cx: lerp(540, 470, it), cy: lerp(820, 860, it), s: lerp(1.0, 1.28, it) + vur * 0.25, r: sallan * 0.15, oy: 900 });
      s.ap.h.setAttribute('opacity', 0.45 + 0.15 * Math.sin(t * 2));

      // kol hareketi: dinlenme -> kaburgaya uzanma -> kıpırdayan parmaklar
      const uzan = gec(t, c1.bas + 0.2, c1.son + 0.3, 'inOut');
      const omuz = [790, 690], dirsek = [lerp(850, 830, uzan), lerp(1010, 995, uzan)];
      const bilek = [lerp(760, 470, uzan), lerp(1230, 905, uzan)];
      const d = `M${omuz[0]},${omuz[1]} Q${dirsek[0] + 20},${dirsek[1] - 140} ${dirsek[0]},${dirsek[1]} L${bilek[0]},${bilek[1]}`;
      s.kolDis.setAttribute('d', d); s.kolIc.setAttribute('d', d);
      const yon = Math.atan2(bilek[1] - dirsek[1], bilek[0] - dirsek[0]);
      const kipir = gec(t, c2.bas - 0.2, c2.bas + 0.3) * (1 - gec(t, c2.son, c2.son + 0.5));
      s.parmaklar.forEach((f, i) => {
        const yay = (i - 1.5) * 0.28;
        const oynat = Math.sin(t * 22 + i * 1.7) * 0.22 * kipir;
        const a = yon + yay + oynat, uz = 70 - Math.abs(i - 1.5) * 8;
        const kx = bilek[0] + Math.cos(yon + yay * 0.6) * 26, ky = bilek[1] + Math.sin(yon + yay * 0.6) * 26;
        const pd = `M${kx},${ky} L${kx + Math.cos(a) * uz},${ky + Math.sin(a) * uz}`;
        f.dis.setAttribute('d', pd); f.ic.setAttribute('d', pd);
      });
      // temas halkaları: soluk ve küçük (hiçbir şey olmuyor)
      const uc = [bilek[0] + Math.cos(yon) * 90, bilek[1] + Math.sin(yon) * 90];
      s.halka.forEach((h, i) => {
        const q = ((t * 1.4 + i / 3) % 1);
        M.ayarla(h, { cx: uc[0], cy: uc[1], r: 20 + q * 70, opacity: kipir * (1 - q) * 0.5 });
      });
      s.kol.setAttribute('opacity', 1 - vur * 0.75);
      s.gv.g.setAttribute('opacity', 1 - vur * 0.7);

      // osiloskop: neredeyse düz çizgi
      let od = '';
      for (let x = 0; x <= 352; x += 8) {
        const y = 100 + Math.sin(x * 0.2 + t * 9) * (2 + 3 * kipir) + M.gurultu(x * 0.15 + t * 6, 5) * 3 * kipir;
        od += (x ? ' L' : 'M') + (24 + x) + ',' + y.toFixed(1);
      }
      s.osilo.setAttribute('d', od);
      s.yuzde.textContent = '%' + Math.round(kipir * 3 + Math.abs(M.gurultu(t * 4, 2)) * 2 * kipir);
      s.olcer.setAttribute('opacity', gec(t, c1.son - 0.3, c2.bas + 0.2) * (1 - vur));

      // "Peki neden?"
      const sp = gec(t, c3.bas - 0.1, c3.bas + 0.3, 'outBack');
      s.soru.setAttribute('opacity', gec(t, c3.bas - 0.1, c3.bas + 0.15));
      s.soruYazi.setAttribute('transform', `translate(540,780) scale(${0.6 + 0.4 * sp + gec(t, c3.bas, s.son, 'lin') * 0.12}) translate(-540,-780)`);
    },
  });

  // =====================================================================
  // SAHNE 2 — İki tür gıdıklanma (cümle 4)
  // =====================================================================
  M.sahne({
    ad: 'iki-tur', cumleler: [4, 4],
    kur(s) {
      arkaPlan(s, 'url(#spot)', false);
      s.baslik = yazi(s.kam, 540, 470, 'İKİ TÜR GIDIKLANMA', { boyut: 54, hiza: 'middle', aralik: 10, renk: BUZ, parla: true });
      s.kartlar = [[300, CYAN, '1', 'KNİSMEZİS', 'hafif dokunuş'], [780, AMBER, '2', 'GARGALEZİS', 'derin baskı']].map(([x, renk, no, ad, alt]) => {
        const g = S('g', {}, s.kam);
        S('circle', { cx: x, cy: 780, r: 190, fill: renk, opacity: 0.06 }, g);
        const dis = S('circle', { cx: x, cy: 780, r: 180, fill: 'none', stroke: renk, 'stroke-width': 4, 'stroke-dasharray': '18 14', filter: 'url(#parla)' }, g);
        const ic = S('circle', { cx: x, cy: 780, r: 150, fill: 'none', stroke: renk, 'stroke-width': 2, opacity: 0.5, 'stroke-dasharray': '4 10' }, g);
        yazi(g, x, 840, no, { aile: 'InterDisplay', kalin: 800, boyut: 190, renk, hiza: 'middle', parla: true });
        yazi(g, x, 1040, ad, { boyut: 40, renk, hiza: 'middle', aralik: 5 });
        yazi(g, x, 1090, alt, { boyut: 32, renk: BUZ, kalin: 500, hiza: 'middle', op: 0.85 });
        return { g, dis, ic, x };
      });
    },
    ciz(t, s) {
      const c = M.c(4);
      M.kamera(s.kam, { cx: lerp(500, 580, gec(t, s.bas, s.son, 'lin')), cy: 790, s: lerp(1.08, 1.0, gec(t, s.bas, s.son, 'out')) });
      s.baslik.setAttribute('letter-spacing', lerp(30, 10, gec(t, s.bas, c.bas + 0.6, 'out')));
      s.baslik.setAttribute('opacity', gec(t, s.bas, c.bas + 0.3));
      s.kartlar.forEach((k, i) => {
        const p = gec(t, M.kz(4, 'iki') - 0.15 + i * 0.25, M.kz(4, 'iki') + 0.35 + i * 0.25, 'outBack');
        k.g.setAttribute('transform', `translate(${k.x},780) scale(${0.6 + 0.4 * p}) translate(${-k.x},-780)`);
        k.g.setAttribute('opacity', clamp(p));
        k.dis.setAttribute('transform', `rotate(${t * 25 * (i ? -1 : 1)} ${k.x} 780)`);
        k.ic.setAttribute('transform', `rotate(${-t * 40 * (i ? -1 : 1)} ${k.x} 780)`);
      });
    },
  });

  // =====================================================================
  // SAHNE 3 — Knismezis: makro deri kesiti + tüy (cümle 5)
  // =====================================================================
  const yuzey = (x) => 860 + 18 * Math.sin(x / 140) + 8 * Math.sin(x / 53);
  M.sahne({
    ad: 'knismezis', cumleler: [5, 5],
    kur(s) {
      S('rect', { x: -800, y: -400, width: 2700, height: 2800, fill: '#05070d' }, s.kam);
      const d = s.svg.querySelector('defs');
      d.insertAdjacentHTML('beforeend', `
        <linearGradient id="epiderm" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#f0b49a"/><stop offset=".35" stop-color="#d4877a"/><stop offset="1" stop-color="#8f4651"/>
        </linearGradient>
        <linearGradient id="derm" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#6e2a3c"/><stop offset=".5" stop-color="#3a1424"/><stop offset="1" stop-color="#12060c"/>
        </linearGradient>
        <radialGradient id="ustIsik" cx="50%" cy="0%" r="80%">
          <stop offset="0" stop-color="#ffe3d0" stop-opacity=".35"/><stop offset="1" stop-color="#ffe3d0" stop-opacity="0"/>
        </radialGradient>`);
      // üstten sıcak ışık
      S('ellipse', { cx: 540, cy: 600, rx: 1300, ry: 520, fill: 'url(#ustIsik)' }, s.kam);
      const X0 = -700, X1 = 1800;
      let ust = '', alt = '';
      for (let x = X0; x <= X1; x += 20) ust += (x === X0 ? 'M' : ' L') + x + ',' + yuzey(x).toFixed(1);
      for (let x = X1; x >= X0; x -= 20) alt += ' L' + x + ',' + (yuzey(x) + 95).toFixed(1);
      S('path', { d: `M${X0},${yuzey(X0) + 80} L${X1},${yuzey(X1) + 80} L${X1},2200 L${X0},2200 Z`, fill: 'url(#derm)' }, s.kam);
      S('path', { d: ust + alt + ' Z', fill: 'url(#epiderm)', opacity: 0.92 }, s.kam);
      // hücre dokusu
      const r = M.rng(5), hucre = S('g', { opacity: 0.18 }, s.kam);
      for (let i = 0; i < 240; i++) {
        const x = X0 + r() * (X1 - X0), y = yuzey(x) + 12 + r() * 75;
        S('ellipse', { cx: x, cy: y, rx: 9 + r() * 7, ry: 6 + r() * 4, fill: 'none', stroke: '#fff', 'stroke-width': 1.5 }, hucre);
      }
      // yüzey parıltısı
      S('path', { d: ust, fill: 'none', stroke: '#ffe0cc', 'stroke-width': 3, opacity: 0.8, filter: 'url(#parla)' }, s.kam);
      // sinir gövdesi (beyne giden)
      const govdeY = (x) => 1290 + 30 * Math.sin(x / 260);
      let gd = '';
      for (let x = X1; x >= X0; x -= 20) gd += (x === X1 ? 'M' : ' L') + x + ',' + govdeY(x).toFixed(1);
      s.sinir = S('path', { d: gd, fill: 'none', stroke: CYAN, 'stroke-width': 9, opacity: 0.75, filter: 'url(#parla)' }, s.kam);
      // kıl kökleri, kıllar ve sinir uçları
      s.killar = [];
      for (let x = -560; x < 1720; x += 140 + Math.round(r() * 40)) {
        const ys = yuzey(x), kok = ys + 210 + r() * 30;
        const kol = S('g', {}, s.kam);
        const dal = S('path', { d: `M${x + 18},${kok + 10} C${x + 40},${kok + 120} ${x - 30},${govdeY(x) - 120} ${x - 60},${govdeY(x - 60)}`, fill: 'none', stroke: CYAN, 'stroke-width': 4, opacity: 0.55 }, kol);
        S('ellipse', { cx: x, cy: kok, rx: 22, ry: 34, fill: '#2a0f19', stroke: '#e7a189', 'stroke-width': 3 }, kol);
        S('path', { d: `M${x - 14},${ys + 6} L${x - 10},${kok - 24} M${x + 14},${ys + 6} L${x + 10},${kok - 24}`, stroke: '#e7a189', 'stroke-width': 2.5, opacity: 0.7 }, kol);
        const uc = S('circle', { cx: x, cy: kok, r: 42, fill: 'none', stroke: CYAN, 'stroke-width': 3, 'stroke-dasharray': '6 6' }, kol);
        const kil = S('path', { fill: 'none', stroke: '#2b1712', 'stroke-width': 7, 'stroke-linecap': 'round' }, s.kam);
        const kilIsik = S('path', { fill: 'none', stroke: '#c9876c', 'stroke-width': 2, 'stroke-linecap': 'round', opacity: 0.9 }, s.kam);
        s.killar.push({ x, ys, kok, uz: 140 + r() * 70, egim: (r() - 0.5) * 0.3, dal, uc, kil, kilIsik, darbe: null });
      }
      s.killar.forEach((k) => { k.darbe = darbe(s.kam, k.dal, CYAN, 9); k.yolDarbe = darbe(s.kam, s.sinir, BUZ, 11); });
      // tüy
      s.tuy = S('g', { filter: 'url(#parla)' }, s.kam);
      S('path', { d: 'M-230,30 Q0,-18 250,-6', fill: 'none', stroke: '#fff', 'stroke-width': 6, 'stroke-linecap': 'round' }, s.tuy);
      for (let i = 0; i < 46; i++) {
        const q = i / 45, x = lerp(-200, 240, q), y = lerp(22, -8, q) - Math.sin(q * Math.PI) * 16;
        const boy = (1 - Math.pow(Math.abs(q - 0.45) * 1.8, 2)) * 120 + 20;
        for (const yon of [-1, 1]) {
          S('path', { d: `M${x},${y} Q${x + 30},${y + yon * boy * 0.55} ${x + 46},${y + yon * boy}`, fill: 'none', stroke: '#f4fbff', 'stroke-width': 2.2, opacity: 0.55 }, s.tuy);
        }
      }
      // ön plan bokeh (alan derinliği)
      s.on = S('g', { filter: 'url(#bulanik)', opacity: 0.5 }, s.svg);
      [[120, 1650, 90], [960, 1580, 70], [880, 260, 60]].forEach(([x, y, rr]) => S('circle', { cx: x, cy: y, r: rr, fill: '#ffd4c0', opacity: 0.25 }, s.on));
      s.hud = hud(s.svg, 90, 300, '1 · KNİSMEZİS', 'hafif dokunuş → kaşıntı', CYAN);
    },
    ciz(t, s) {
      const c = M.c(5);
      const ilerle = gec(t, s.bas, s.son, 'inOut');
      const tx = lerp(1450, -420, ilerle);                 // tüyün x konumu
      const ty = yuzey(tx) - 70 + Math.sin(t * 3) * 10;
      s.tuy.setAttribute('transform', `translate(${tx},${ty}) rotate(${-8 + Math.sin(t * 2.2) * 5}) scale(1.1)`);
      M.kamera(s.kam, { cx: lerp(760, 300, ilerle), cy: 1000 - gec(t, s.bas, s.son) * 40, s: lerp(1.35, 1.12, gec(t, s.bas, s.son)), r: M.gurultu(t * 0.5, 9) * 1.2, oy: 940 });
      s.killar.forEach((k) => {
        const mesafe = k.x - tx;
        const bukul = Math.exp(-(mesafe * mesafe) / (2 * 110 * 110));
        const aci = k.egim - bukul * 0.9 + Math.sin(t * 2 + k.x) * 0.03;
        const ux = k.x + Math.sin(aci) * k.uz, uy = k.ys - Math.cos(aci) * k.uz;
        const kx = k.x + Math.sin(aci * 0.5) * k.uz * 0.5, ky = k.ys - Math.cos(aci * 0.5) * k.uz * 0.55;
        const d = `M${k.x},${k.kok - 20} L${k.x},${k.ys} Q${kx},${ky} ${ux},${uy}`;
        k.kil.setAttribute('d', d); k.kilIsik.setAttribute('d', d);
        // tüy geçtiğinde sinir ucu yanar, darbe beyne doğru akar
        const gecis = (k.x - 1450) / (-420 - 1450);
        const tGecis = lerp(s.bas, s.son, gecis);
        k.uc.setAttribute('stroke', bukul > 0.4 ? BUZ : CYAN);
        k.uc.setAttribute('opacity', 0.35 + bukul * 0.65);
        k.uc.setAttribute('r', 42 + bukul * 10);
        k.darbe.ciz((t - tGecis) / 0.6);
        const dt = t - tGecis - 0.6;
        k.yolDarbe.ciz(dt > 0 ? (1800 - k.x) / 2500 + dt * 0.3 : -1, 0.9);
      });
      s.hud.ciz(aralik(t, c.bas - 0.1, c.bas + 1.4));
    },
  });

  // =====================================================================
  // SAHNE 4 — Gargalezis: kaburga + koltuk altı, kahkaha (cümle 6)
  // =====================================================================
  M.sahne({
    ad: 'gargalezis', cumleler: [6, 6],
    kur(s) {
      s.ap = arkaPlan(s, 'url(#spotAmber)');
      s.gv = govde(s.kam, CYAN);
      s.eller = [[-1, 330, 840], [1, 750, 760], [-1, 300, 700]].map(([yon, x, y], i) => {
        const g = S('g', { filter: 'url(#parla)' }, s.kam);
        const uclar = [0, 1, 2].map((j) => S('ellipse', { rx: 22, ry: 28, fill: 'rgba(255,181,71,.25)', stroke: AMBER, 'stroke-width': 4 }, g));
        const halkalar = [0, 1].map(() => S('ellipse', { fill: 'none', stroke: AMBER, 'stroke-width': 4 }, s.kam));
        return { g, uclar, halkalar, yon, x, y, faz: i * 0.7 };
      });
      s.kahkaha = S('g', {}, s.kam);
      s.yaylar = [0, 1, 2, 3].map(() => S('path', { fill: 'none', stroke: ALTIN, 'stroke-width': 6, 'stroke-linecap': 'round', filter: 'url(#parla)' }, s.kahkaha));
      s.ha = [[370, 400], [715, 380], [430, 300], [650, 285]].map(([x, y]) => ({ e: yazi(s.kahkaha, x, y, 'HA', { aile: 'InterDisplay', kalin: 800, boyut: 64, renk: ALTIN, hiza: 'middle', parla: true }), x, y }));
      s.agiz = S('path', { fill: 'rgba(255,200,71,.3)', stroke: ALTIN, 'stroke-width': 4 }, s.kam);
      s.hud = hud(s.svg, 90, 300, '2 · GARGALEZİS', 'derin baskı → kahkaha', AMBER);
    },
    ciz(t, s) {
      const c = M.c(6);
      const tKah = M.kz(6, 'kahkaha');
      const geri = gec(t, M.kz(6, 'koltuk'), tKah + 0.4, 'inOut');
      M.kamera(s.kam, { cx: lerp(380, 540, geri), cy: lerp(840, 720, geri), s: lerp(1.75, 1.05, geri) + M.gurultu(t * 3, 4) * 0.01 * geri, oy: 900 });
      s.ap.h.setAttribute('opacity', 0.5);
      const basla = gec(t, c.bas, c.bas + 0.5);
      s.eller.forEach((h, i) => {
        const bas = i === 1 ? M.kz(6, 'koltuk') : i === 2 ? M.kz(6, 'koltuk') + 0.3 : c.bas + 0.2;
        const gor = gec(t, bas - 0.2, bas + 0.3);
        const bas_ = Math.max(0, Math.sin((t + h.faz) * 11)); // dürtme ritmi
        const dx = h.yon * (40 + bas_ * 28);
        h.uclar.forEach((u, j) => M.ayarla(u, { cx: h.x + dx - h.yon * 8 * Math.abs(j - 1), cy: h.y + (j - 1) * 44, transform: `rotate(${h.yon * 70} ${h.x + dx} ${h.y + (j - 1) * 44})` }));
        h.g.setAttribute('opacity', gor);
        h.halkalar.forEach((hl, j) => {
          const q = ((t * 2.2 + j * 0.5 + h.faz) % 1);
          M.ayarla(hl, { cx: h.x + h.yon * 10, cy: h.y, rx: 20 + q * 90, ry: 30 + q * 120, opacity: gor * (1 - q) * 0.8 });
        });
      });
      // dürtülen kaburgalar parlıyor
      s.gv.kaburgalar.forEach(({ k, i, yon }) => {
        const yak = Math.max(0, Math.sin(t * 11 + i)) * basla * (yon < 0 ? 1 : 0.5);
        k.setAttribute('stroke', yak > 0.6 ? AMBER : CYAN);
        k.setAttribute('opacity', 0.45 + yak * 0.5);
      });
      // kahkaha dalgaları
      const kah = gec(t, tKah - 0.1, tKah + 0.3);
      s.yaylar.forEach((y, i) => {
        const q = ((t * 1.6 + i / 4) % 1), r = 120 + q * 330;
        y.setAttribute('d', `M${540 - r * 0.8},${470 - r * 0.45} A${r},${r} 0 0 1 ${540 + r * 0.8},${470 - r * 0.45}`);
        y.setAttribute('opacity', kah * (1 - q) * 0.8);
      });
      s.ha.forEach((h, i) => {
        const tt = tKah + i * 0.18, p = gec(t, tt, tt + 0.3, 'outBack');
        h.e.setAttribute('opacity', clamp(p) * (0.6 + 0.4 * Math.sin(t * 8 + i)));
        h.e.setAttribute('transform', `translate(${h.x},${h.y - (t - tt) * 30}) scale(${0.5 + 0.5 * p}) rotate(${(i % 2 ? 8 : -8)}) translate(${-h.x},${-h.y})`);
      });
      const ac = kah * (0.5 + 0.5 * Math.abs(Math.sin(t * 14)));
      s.agiz.setAttribute('d', `M500,478 Q540,${478 + 34 * ac} 580,478 Q540,${484 + 8 * ac} 500,478Z`);
      s.agiz.setAttribute('opacity', 0.3 + kah * 0.7);
      s.hud.ciz(aralik(t, c.bas, c.bas + 1.5));
    },
  });

  // =====================================================================
  // SAHNE 5 — Beyin ve beyincik: tahmin + bastırma (cümle 7)
  // =====================================================================
  M.sahne({
    ad: 'beyin', cumleler: [7, 7],
    kur(s) {
      s.ap = arkaPlan(s, 'url(#spot)', false);
      const CX = 540, CY = 720;
      const nok = [[-330, 60], [-362, -40], [-300, -180], [-170, -258], [-10, -282], [150, -258], [282, -180], [355, -60], [370, 40], [320, 112], [200, 130], [40, 150], [-120, 172], [-250, 150]]
        .map(([x, y]) => [CX + x, CY + y]);
      const beyinYol = yumusakYol(nok);
      const d = s.svg.querySelector('defs');
      const kirp = S('clipPath', { id: 'beyinKirp' }, d);
      S('path', { d: beyinYol }, kirp);
      s.beyin = S('g', {}, s.kam);
      s.beyinDolgu = S('path', { d: beyinYol, fill: 'rgba(92,225,230,.08)' }, s.beyin);
      // kıvrımlar (girus)
      const r = M.rng(21), kiv = S('g', { 'clip-path': 'url(#beyinKirp)', opacity: 0.45 }, s.beyin);
      for (let i = 0; i < 46; i++) {
        let x = CX - 360 + r() * 730, y = CY - 280 + r() * 450, a = r() * 6.28;
        const pts = [[x, y]];
        for (let j = 0; j < 9; j++) { a += (r() - 0.5) * 1.9; x += Math.cos(a) * 34; y += Math.sin(a) * 34; pts.push([x, y]); }
        S('path', { d: yumusakYol(pts, false), fill: 'none', stroke: CYAN, 'stroke-width': 3.2, 'stroke-linecap': 'round' }, kiv);
      }
      s.beyinCizgi = S('path', { d: beyinYol, fill: 'none', stroke: CYAN, 'stroke-width': 5, filter: 'url(#parla)' }, s.beyin);
      // ana yarıklar
      S('path', { d: yumusakYol([[CX - 10, CY - 280], [CX + 15, CY - 180], [CX - 5, CY - 80], [CX + 30, CY + 20]], false), fill: 'none', stroke: BUZ, 'stroke-width': 5, opacity: 0.8 }, s.beyin);
      S('path', { d: yumusakYol([[CX - 230, CY + 95], [CX - 90, CY + 40], [CX + 60, CY + 10], [CX + 150, CY - 40]], false), fill: 'none', stroke: BUZ, 'stroke-width': 5, opacity: 0.7 }, s.beyin);
      // motor ve duyusal korteks şeritleri
      s.motor = S('path', { d: yumusakYol([[CX - 40, CY - 278], [CX - 15, CY - 180], [CX - 35, CY - 80]], false), fill: 'none', stroke: AMBER, 'stroke-width': 22, 'stroke-linecap': 'round', opacity: 0, filter: 'url(#parla)' }, s.beyin);
      s.duyu = S('path', { d: yumusakYol([[CX + 40, CY - 270], [CX + 65, CY - 170], [CX + 45, CY - 70]], false), fill: 'none', stroke: PEMBE, 'stroke-width': 22, 'stroke-linecap': 'round', opacity: 0, filter: 'url(#parla)' }, s.beyin);
      // beyin sapı
      S('path', { d: `M${CX + 110},${CY + 120} C${CX + 120},${CY + 230} ${CX + 100},${CY + 330} ${CX + 80},${CY + 470} L${CX + 10},${CY + 470} C${CX + 30},${CY + 330} ${CX + 40},${CY + 230} ${CX + 30},${CY + 140} Z`, fill: 'rgba(92,225,230,.1)', stroke: CYAN, 'stroke-width': 4, filter: 'url(#parla)' }, s.beyin);
      // beyincik
      s.beyincik = S('g', { transform: `rotate(-8 ${CX + 255} ${CY + 215})` }, s.kam);
      s.byDolgu = S('ellipse', { cx: CX + 255, cy: CY + 215, rx: 150, ry: 92, fill: 'rgba(92,225,230,.1)', stroke: CYAN, 'stroke-width': 5, filter: 'url(#parla)' }, s.beyincik);
      s.folia = [];
      for (let k = -3; k <= 3; k++) {
        const y = CY + 215 + k * 22, gen = 140 * Math.sqrt(1 - (k / 4.2) ** 2);
        s.folia.push(S('path', { d: `M${CX + 255 - gen},${y} Q${CX + 255},${y + 18 - Math.abs(k) * 2} ${CX + 255 + gen},${y}`, fill: 'none', stroke: CYAN, 'stroke-width': 3, opacity: 0.6 }, s.beyincik));
      }
      s.byEtiket = S('g', { opacity: 0 }, s.kam);
      S('path', { d: `M${CX + 330},${CY + 290} L${CX + 360},${CY + 400} L${CX + 470},${CY + 400}`, fill: 'none', stroke: AMBER, 'stroke-width': 3 }, s.byEtiket);
      yazi(s.byEtiket, CX + 290, CY + 440, 'BEYİNCİK', { boyut: 40, renk: AMBER, aralik: 5, parla: true });
      // sinyal yolları
      s.kopyaYol = S('path', { d: `M${CX - 30},${CY - 200} C${CX + 160},${CY - 160} ${CX + 300},${CY} ${CX + 250},${CY + 190}`, fill: 'none', stroke: AMBER, 'stroke-width': 4, 'stroke-dasharray': '12 12', opacity: 0 }, s.kam);
      s.kopya = darbe(s.kam, s.kopyaYol, AMBER, 13);
      s.cikisYol = S('path', { d: `M${CX - 30},${CY - 200} C${CX - 10},${CY + 20} ${CX + 70},${CY + 200} ${CX + 45},${CY + 560}`, fill: 'none', stroke: AMBER, 'stroke-width': 3, opacity: 0 }, s.kam);
      s.cikis = darbe(s.kam, s.cikisYol, AMBER, 11);
      s.girisYol = S('path', { d: `M${CX + 45},${CY + 600} C${CX + 80},${CY + 250} ${CX + 120},${CY} ${CX + 55},${CY - 175}`, fill: 'none', stroke: PEMBE, 'stroke-width': 3, opacity: 0 }, s.kam);
      s.girisler = [0, 1, 2].map(() => darbe(s.kam, s.girisYol, PEMBE, 14));
      // tahmin HUD'u + his şiddeti göstergesi
      s.tahmin = S('g', { opacity: 0, transform: 'translate(70,250)' }, s.svg);
      S('rect', { width: 420, height: 150, rx: 14, fill: 'rgba(20,12,3,.6)', stroke: AMBER, 'stroke-width': 2 }, s.tahmin);
      yazi(s.tahmin, 24, 44, 'TAHMİN: KENDİ DOKUNUŞUN', { boyut: 22, renk: AMBER, aralik: 2 });
      s.tahminDalga = S('path', { fill: 'none', stroke: AMBER, 'stroke-width': 4 }, s.tahmin);
      s.siddet = S('g', { opacity: 0, transform: 'translate(590,250)' }, s.svg);
      S('rect', { width: 420, height: 150, rx: 14, fill: 'rgba(25,5,12,.6)', stroke: PEMBE, 'stroke-width': 2 }, s.siddet);
      yazi(s.siddet, 24, 44, 'HİS ŞİDDETİ', { boyut: 22, renk: PEMBE, aralik: 2 });
      S('rect', { x: 24, y: 80, width: 372, height: 30, rx: 15, fill: 'rgba(255,255,255,.08)' }, s.siddet);
      s.siddetBar = S('rect', { x: 24, y: 80, height: 30, rx: 15, fill: PEMBE, filter: 'url(#parla)' }, s.siddet);
      s.siddetYazi = yazi(s.siddet, 396, 44, '%100', { boyut: 26, hiza: 'end' });
    },
    ciz(t, s) {
      const c = M.c(7);
      const tBeyin = M.kz(7, 'beyniniz'), tBy = M.kz(7, 'beyincik'), tTah = M.kz(7, 'tahmin'), tAz = M.kz(7, 'azaltıyor');
      const odak = gec(t, tBy - 0.2, tBy + 0.6) * (1 - gec(t, tTah, tTah + 0.8));
      M.kamera(s.kam, {
        cx: lerp(560, 760, odak), cy: lerp(780, 900, odak),
        s: lerp(0.9, 1.05, gec(t, s.bas, tBy, 'out')) + odak * 0.45 + M.gurultu(t * 0.6, 2) * 0.01,
        r: lerp(-4, 0, gec(t, s.bas, tBy)), oy: 860,
      });
      const parlak = gec(t, tBeyin - 0.1, tBeyin + 0.3) * (1 - 0.6 * gec(t, tBeyin + 0.6, tBeyin + 1.2));
      s.beyinCizgi.setAttribute('stroke-width', 5 + parlak * 5);
      s.beyinDolgu.setAttribute('fill', `rgba(92,225,230,${0.08 + parlak * 0.12})`);
      s.beyin.setAttribute('opacity', gec(t, s.bas, s.bas + 0.6));
      // beyincik vurgusu
      const by = gec(t, tBy - 0.1, tBy + 0.4);
      s.byDolgu.setAttribute('stroke', by > 0.5 ? AMBER : CYAN);
      s.byDolgu.setAttribute('fill', `rgba(255,181,71,${by * 0.25})`);
      s.folia.forEach((f) => f.setAttribute('stroke', by > 0.5 ? AMBER : CYAN));
      s.byEtiket.setAttribute('opacity', by);
      // motor komutu + kopya sinyal (tahmin)
      const tah = gec(t, tTah - 0.5, tTah);
      s.motor.setAttribute('opacity', tah * 0.8);
      s.kopyaYol.setAttribute('opacity', tah * 0.7);
      s.cikisYol.setAttribute('opacity', tah * 0.4);
      s.kopya.ciz(aralik(t, tTah - 0.3, tTah + 0.7));
      s.cikis.ciz(aralik(t, tTah - 0.3, tTah + 0.8));
      s.tahmin.setAttribute('opacity', gec(t, tTah + 0.2, tTah + 0.6));
      let td = '';
      for (let x = 0; x <= 370; x += 6) td += (x ? ' L' : 'M') + (24 + x) + ',' + (105 + Math.sin(x * 0.06 - t * 6) * 22 * Math.exp(-(((x - 185) / 110) ** 2))).toFixed(1);
      s.tahminDalga.setAttribute('d', td);
      // gelen his sinyali bastırılır
      const tGir = tTah + 0.6;
      s.girisYol.setAttribute('opacity', gec(t, tGir - 0.2, tGir) * 0.5);
      s.girisler.forEach((g, i) => g.ciz(aralik(t, tGir + i * 0.45, tGir + i * 0.45 + 0.9), 1 - gec(t, tAz - 0.2, tAz + 0.4) * 0.75));
      const bastir = gec(t, tAz - 0.3, tAz + 0.6);
      s.duyu.setAttribute('opacity', gec(t, tGir + 0.6, tGir + 0.9) * (0.9 - bastir * 0.7));
      s.siddet.setAttribute('opacity', gec(t, tGir, tGir + 0.4));
      const deger = Math.round(lerp(100, 18, bastir));
      s.siddetBar.setAttribute('width', 372 * deger / 100);
      s.siddetYazi.textContent = '%' + deger;
    },
  });

  // =====================================================================
  // SAHNE 6 — Sürpriz yoksa gıdıklanma yok: sinyal karşılaştırması (cümle 8)
  // =====================================================================
  M.sahne({
    ad: 'surpriz', cumleler: [8, 8],
    kur(s) {
      arkaPlan(s, 'url(#spot)', false);
      const izgara = S('g', { opacity: 0.12 }, s.kam);
      for (let x = 90; x <= 990; x += 60) S('line', { x1: x, x2: x, y1: 420, y2: 1150, stroke: CYAN, 'stroke-width': 1 }, izgara);
      for (let y = 420; y <= 1150; y += 60) S('line', { x1: 90, x2: 990, y1: y, y2: y, stroke: CYAN, 'stroke-width': 1 }, izgara);
      yazi(s.kam, 540, 380, 'SİNİR SİNYALİ', { boyut: 34, renk: BUZ, hiza: 'middle', aralik: 8 });
      s.izler = [[600, AMBER, 'BAŞKASI DOKUNUNCA', 1, 'SÜRPRİZ'], [960, CYAN, 'KENDİN DOKUNUNCA', 0.16, 'TAHMİN EDİLDİ']].map(([y, renk, ad, guc, sonuc]) => {
        yazi(s.kam, 100, y - 120, ad, { boyut: 30, renk, aralik: 3 });
        const sonucY = yazi(s.kam, 980, y - 120, sonuc, { boyut: 26, renk, hiza: 'end', aralik: 3, op: 0 });
        const yol = S('path', { fill: 'none', stroke: renk, 'stroke-width': 5, filter: 'url(#parla)', 'stroke-linejoin': 'round' }, s.kam);
        const uc = S('circle', { r: 12, fill: '#fff', filter: 'url(#parlaGuclu)' }, s.kam);
        return { y, renk, guc, yol, uc, sonucY };
      });
    },
    ciz(t, s) {
      const c = M.c(8);
      M.kamera(s.kam, { cx: 540, cy: 780, s: lerp(1.08, 1.0, gec(t, s.bas, s.son, 'out')), r: M.gurultu(t * 0.4, 6) * 0.6 });
      const ilerle = gec(t, s.bas + 0.2, c.son - 0.2, 'lin');
      s.izler.forEach((iz, i) => {
        let d = '', sonX = 90, sonY = iz.y;
        for (let x = 0; x <= 900 * ilerle; x += 5) {
          const darbe = Math.exp(-(((x - 450) / 70) ** 2)) * 220 * iz.guc;
          const y = iz.y - Math.abs(Math.sin(x * 0.11)) * darbe - Math.sin(x * 0.4 + i) * 4;
          d += (x ? ' L' : 'M') + (90 + x) + ',' + y.toFixed(1);
          sonX = 90 + x; sonY = y;
        }
        iz.yol.setAttribute('d', d || 'M90,0');
        M.ayarla(iz.uc, { cx: sonX, cy: sonY, opacity: ilerle > 0 && ilerle < 1 ? 1 : 0 });
        iz.sonucY.setAttribute('opacity', gec(t, s.bas + 0.2 + (c.son - s.bas) * 0.55, s.bas + 0.6 + (c.son - s.bas) * 0.55));
      });
    },
  });

  // ---------- figürler (sahne 7–8) ----------
  const insan = (p, x, y, olcek, renk) => {
    const g = S('g', { transform: `translate(${x},${y}) scale(${olcek})` }, p);
    S('circle', { cx: 0, cy: -190, r: 62, fill: `${renk}22`, stroke: renk, 'stroke-width': 5, filter: 'url(#parla)' }, g);
    S('path', { d: 'M-110,190 L-110,-20 C-110,-90 -70,-112 0,-112 C70,-112 110,-90 110,-20 L110,190', fill: `${renk}14`, stroke: renk, 'stroke-width': 5, filter: 'url(#parla)' }, g);
    return g;
  };
  const sempanze = (p, x, y, olcek) => {
    const g = S('g', { transform: `translate(${x},${y}) scale(${olcek})` }, p);
    const r = AMBER, cz = { fill: 'none', stroke: r, 'stroke-width': 5 };
    S('circle', { cx: -150, cy: -10, r: 55, ...cz, fill: 'rgba(255,181,71,.08)' }, g);
    S('circle', { cx: 150, cy: -10, r: 55, ...cz, fill: 'rgba(255,181,71,.08)' }, g);
    S('circle', { cx: -150, cy: -10, r: 28, ...cz, opacity: 0.6 }, g);
    S('circle', { cx: 150, cy: -10, r: 28, ...cz, opacity: 0.6 }, g);
    S('ellipse', { cx: 0, cy: -30, rx: 138, ry: 140, ...cz, fill: 'rgba(255,181,71,.07)', filter: 'url(#parla)' }, g);
    S('path', { d: 'M-98,-28 C-98,-98 -12,-96 0,-58 C12,-96 98,-98 98,-28 C104,40 62,124 0,128 C-62,124 -104,40 -98,-28Z', fill: 'rgba(255,220,170,.12)', stroke: r, 'stroke-width': 4 }, g);
    S('path', { d: 'M-90,-62 Q-45,-92 0,-66 Q45,-92 90,-62', ...cz, 'stroke-width': 7 }, g);
    for (const sx of [-1, 1]) { S('circle', { cx: sx * 42, cy: -36, r: 13, fill: '#1a0d02', stroke: r, 'stroke-width': 3 }, g); S('circle', { cx: sx * 38, cy: -40, r: 4, fill: '#fff' }, g); }
    S('ellipse', { cx: -12, cy: 22, rx: 7, ry: 5, fill: r }, g); S('ellipse', { cx: 12, cy: 22, rx: 7, ry: 5, fill: r }, g);
    const agiz = S('path', { fill: 'rgba(40,10,0,.8)', stroke: r, 'stroke-width': 4 }, g);
    return { g, agiz };
  };
  const fare = (p, x, y, olcek) => {
    const g = S('g', { transform: `translate(${x},${y}) scale(${olcek})` }, p);
    const r = AMBER;
    const kuyruk = S('path', { fill: 'none', stroke: PEMBE, 'stroke-width': 7, 'stroke-linecap': 'round', opacity: 0.8 }, g);
    S('ellipse', { cx: 40, cy: 20, rx: 125, ry: 72, fill: 'rgba(255,181,71,.08)', stroke: r, 'stroke-width': 5, filter: 'url(#parla)' }, g);
    S('path', { d: 'M-60,-24 C-110,-38 -150,-10 -178,16 C-160,38 -110,48 -56,54Z', fill: 'rgba(255,181,71,.1)', stroke: r, 'stroke-width': 5, filter: 'url(#parla)' }, g);
    S('ellipse', { cx: -72, cy: -50, rx: 30, ry: 34, fill: 'rgba(255,143,177,.2)', stroke: r, 'stroke-width': 4 }, g);
    S('circle', { cx: -122, cy: 4, r: 8, fill: '#fff' }, g);
    S('circle', { cx: -180, cy: 16, r: 8, fill: PEMBE }, g);
    for (const [dx, dy] of [[-60, -14], [-64, 4], [-58, 22]]) S('line', { x1: -172, y1: 22, x2: -172 + dx, y2: 22 + dy, stroke: BUZ, 'stroke-width': 2, opacity: 0.7 }, g);
    for (const ax of [-20, 90]) S('path', { d: `M${ax},86 l-10,24 l26,0`, fill: 'none', stroke: r, 'stroke-width': 4 }, g);
    return { g, kuyruk };
  };
  const sesYaylari = (p, x, y, renk, yon = 1) => [0, 1, 2].map(() => S('path', { fill: 'none', stroke: renk, 'stroke-width': 6, 'stroke-linecap': 'round', filter: 'url(#parla)', 'data-x': x, 'data-y': y, 'data-yon': yon }, p));
  const yaylariCiz = (yaylar, t, guc) => yaylar.forEach((e, i) => {
    const x = +e.dataset.x, y = +e.dataset.y, yon = +e.dataset.yon, q = (t * 1.8 + i / 3) % 1, r = 50 + q * 150;
    e.setAttribute('d', `M${x + yon * r * 0.5},${y - r * 0.85} A${r},${r} 0 0 ${yon > 0 ? 1 : 0} ${x + yon * r * 0.5},${y + r * 0.85}`);
    e.setAttribute('opacity', guc * (1 - q) * 0.9);
  });

  // =====================================================================
  // SAHNE 7 — Oyun ve sosyal bağ (cümle 9)
  // =====================================================================
  M.sahne({
    ad: 'bag', cumleler: [9, 9],
    kur(s) {
      arkaPlan(s, 'url(#spot)');
      s.yetiskin = insan(s.kam, 320, 860, 1.0, CYAN);
      s.cocuk = insan(s.kam, 780, 960, 0.68, ALTIN);
      s.baglar = S('g', {}, s.kam);
      s.yollar = [-1, 0, 1].map((k) => S('path', { d: `M410,${760 + k * 40} C540,${640 + k * 90} 600,${700 + k * 90} 710,${840 + k * 30}`, fill: 'none', stroke: BUZ, 'stroke-width': 2, opacity: 0 }, s.baglar));
      s.parcalar = [];
      s.yollar.forEach((y, i) => { for (let j = 0; j < 6; j++) s.parcalar.push({ d: darbe(s.baglar, y, j % 2 ? CYAN : ALTIN, 7), i, j }); });
      s.kalp = S('g', { opacity: 0 }, s.kam);
      S('circle', { cx: 560, cy: 720, r: 140, fill: 'url(#spotAmber)' }, s.kalp);
      yazi(s.kalp, 560, 736, 'BAĞ', { aile: 'InterDisplay', kalin: 800, boyut: 64, renk: ALTIN, hiza: 'middle', aralik: 6, parla: true });
      s.hud = hud(s.svg, 90, 300, 'OYUN · GÜVEN · BAĞ', 'sosyal bir işlev olabilir', ALTIN);
    },
    ciz(t, s) {
      const c = M.c(9), tBag = M.kz(9, 'bağı');
      M.kamera(s.kam, { cx: lerp(470, 560, gec(t, s.bas, s.son)), cy: 840, s: lerp(1.15, 1.0, gec(t, s.bas, s.son, 'out')), r: M.gurultu(t * 0.5, 8) * 0.8 });
      const zipla = Math.abs(Math.sin(t * 5.5));
      s.cocuk.setAttribute('transform', `translate(780,${960 - zipla * 40}) scale(0.68) rotate(${Math.sin(t * 5.5) * 4})`);
      s.yetiskin.setAttribute('transform', `translate(320,${860 - Math.abs(Math.sin(t * 5.5 + 1)) * 10}) scale(1)`);
      const ac = gec(t, M.kz(9, 'oyun'), M.kz(9, 'oyun') + 0.8);
      s.yollar.forEach((y) => y.setAttribute('opacity', ac * 0.35));
      s.parcalar.forEach((p) => p.d.ciz(((t * 0.55 + p.j / 6 + p.i * 0.13) % 1), ac));
      const k = gec(t, tBag - 0.1, tBag + 0.4, 'outBack');
      s.kalp.setAttribute('opacity', clamp(k));
      s.kalp.setAttribute('transform', `translate(560,720) scale(${0.6 + 0.4 * k + Math.sin(t * 6) * 0.03 * k}) translate(-560,-720)`);
      s.hud.ciz(aralik(t, c.bas + 0.3, c.bas + 1.8));
    },
  });

  // =====================================================================
  // SAHNE 8 — Yalnızca biz değiliz: şempanze ve fare (cümle 10–11)
  // =====================================================================
  M.sahne({
    ad: 'hayvanlar', cumleler: [10, 11],
    kur(s) {
      arkaPlan(s, 'url(#spotAmber)', false);
      s.insan = insan(s.kam, 540, 820, 0.9, CYAN);
      s.semp = sempanze(s.kam, 540, 760, 1.0);
      s.fare = fare(s.kam, 560, 820, 1.25);
      s.sempYay = sesYaylari(s.kam, 720, 760, ALTIN, 1);
      s.fareYay = sesYaylari(s.kam, 300, 830, ALTIN, -1);
      s.sempAd = yazi(s.kam, 540, 1040, 'ŞEMPANZE', { boyut: 44, renk: AMBER, hiza: 'middle', aralik: 6, parla: true });
      s.fareAd = yazi(s.kam, 560, 1040, 'FARE', { boyut: 44, renk: AMBER, hiza: 'middle', aralik: 6, parla: true });
      s.insanAd = yazi(s.kam, 540, 1080, 'İNSAN', { boyut: 44, renk: CYAN, hiza: 'middle', aralik: 6, parla: true });
    },
    ciz(t, s) {
      const c10 = M.c(10), c11 = M.c(11);
      const tS = M.kz(11, 'şempanze'), tF = M.kz(11, 'fareler'), tG = M.kz(11, 'gülmeye');
      // insan: "bize özgü değil" ile kenara kayar ve söner
      const insanCik = gec(t, M.kz(10, 'değil') - 0.1, c11.bas + 0.2);
      s.insan.setAttribute('transform', `translate(${lerp(540, 540, insanCik)},${820}) scale(${lerp(0.9, 0.6, insanCik)})`);
      s.insan.setAttribute('opacity', 1 - insanCik);
      s.insanAd.setAttribute('opacity', (1 - insanCik) * gec(t, c10.bas, c10.bas + 0.4));
      // şempanze
      const sGir = gec(t, tS - 0.25, tS + 0.25, 'outBack'), sCik = gec(t, tF - 0.25, tF + 0.15);
      s.semp.g.setAttribute('transform', `translate(${540 - sCik * 600},${760 + Math.sin(t * 9) * 4 * sGir}) scale(${clamp(sGir) * (1 - sCik * 0.2)})`);
      s.semp.g.setAttribute('opacity', clamp(sGir) * (1 - sCik));
      s.sempAd.setAttribute('opacity', clamp(sGir) * (1 - sCik));
      const sGul = Math.abs(Math.sin(t * 12));
      s.semp.agiz.setAttribute('d', `M-58,60 Q0,${74 + sGul * 46} 58,60 Q0,${70 + sGul * 6} -58,60Z`);
      yaylariCiz(s.sempYay, t, clamp(sGir) * (1 - sCik));
      // fare
      const fGir = gec(t, tF - 0.15, tF + 0.35, 'outBack');
      const fx = lerp(1200, 560, clamp(fGir));
      s.fare.g.setAttribute('transform', `translate(${fx},${820 - Math.abs(Math.sin(t * 10)) * 8 * gec(t, tG, tG + 0.3)}) scale(1.25)`);
      s.fare.g.setAttribute('opacity', clamp(fGir * 1.5));
      s.fare.kuyruk.setAttribute('d', `M160,40 C240,${60 + Math.sin(t * 4) * 20} 260,${140 + Math.sin(t * 3) * 20} 340,${110 + Math.sin(t * 5) * 20}`);
      s.fareAd.setAttribute('opacity', clamp(fGir));
      yaylariCiz(s.fareYay, t, gec(t, tG - 0.1, tG + 0.3));
      M.kamera(s.kam, { cx: 540, cy: 820, s: 1.0 + gec(t, tS - 0.3, tS + 0.5) * 0.1 + M.gurultu(t * 0.7, 12) * 0.01, oy: 880 });
    },
  });

  // =====================================================================
  // SAHNE 9 — Ultrasonik: insan kulağı 20 kHz, fare kahkahası ~50 kHz (cümle 12)
  // =====================================================================
  const fx = (f) => 110 + 860 * (Math.log10(f) - Math.log10(20)) / (Math.log10(100000) - Math.log10(20));
  M.sahne({
    ad: 'ultrason', cumleler: [12, 12],
    kur(s) {
      arkaPlan(s, 'url(#spot)', false);
      const Y = 940;
      yazi(s.kam, 540, 380, 'SES FREKANSI', { boyut: 34, renk: BUZ, hiza: 'middle', aralik: 8 });
      s.bant = S('rect', { x: fx(20), y: Y - 300, width: 0, height: 300, fill: 'rgba(92,225,230,.16)', stroke: CYAN, 'stroke-width': 3 }, s.kam);
      s.bantAd = S('g', { opacity: 0 }, s.kam);
      yazi(s.bantAd, (fx(20) + fx(20000)) / 2, Y - 200, 'İNSAN KULAĞI', { boyut: 40, renk: CYAN, hiza: 'middle', aralik: 5, parla: true });
      yazi(s.bantAd, (fx(20) + fx(20000)) / 2, Y - 145, '20 Hz – 20 kHz', { boyut: 32, renk: BUZ, hiza: 'middle', kalin: 500 });
      S('line', { x1: 110, x2: 970, y1: Y, y2: Y, stroke: BUZ, 'stroke-width': 3 }, s.kam);
      [[20, '20 Hz'], [1000, '1 kHz'], [20000, '20 kHz'], [100000, '100 kHz']].forEach(([f, a]) => {
        S('line', { x1: fx(f), x2: fx(f), y1: Y, y2: Y + 18, stroke: BUZ, 'stroke-width': 3 }, s.kam);
        yazi(s.kam, fx(f), Y + 58, a, { boyut: 26, renk: BUZ, hiza: 'middle', kalin: 500, op: 0.8 });
      });
      s.fare = S('g', { opacity: 0 }, s.kam);
      s.fareCubuk = S('rect', { x: fx(50000) - 14, y: Y - 420, width: 28, height: 420, rx: 14, fill: AMBER, filter: 'url(#parlaGuclu)' }, s.fare);
      s.fareYay = sesYaylari(s.fare, fx(50000), Y - 300, ALTIN, 1);
      yazi(s.fare, fx(50000) - 30, Y - 470, 'FARE KAHKAHASI', { boyut: 30, renk: AMBER, hiza: 'end', aralik: 3 });
      yazi(s.fare, fx(50000) - 30, Y - 430, '~50 kHz', { boyut: 30, renk: '#fff', hiza: 'end' });
      // kulak + çarpı
      s.kulak = S('g', { opacity: 0 }, s.kam);
      S('path', { d: 'M-30,60 C-60,40 -60,-60 0,-70 C60,-70 70,-10 40,20 C20,40 20,60 0,70 C-10,76 -24,70 -30,60Z', fill: 'none', stroke: BUZ, 'stroke-width': 6 }, s.kulak);
      S('path', { d: 'M-10,-20 C10,-40 34,-20 20,0', fill: 'none', stroke: BUZ, 'stroke-width': 5 }, s.kulak);
      S('path', { d: 'M-80,-80 L80,80', stroke: PEMBE, 'stroke-width': 10, 'stroke-linecap': 'round', filter: 'url(#parla)' }, s.kulak);
      s.kapanis = S('g', { opacity: 0 }, s.svg);
      S('rect', { width: 1080, height: 1920, fill: 'rgba(3,6,13,.94)' }, s.kapanis);
      yazi(s.kapanis, 540, 860, 'NEDEN KENDİMİZİ', { aile: 'InterDisplay', kalin: 800, boyut: 76, hiza: 'middle', renk: '#fff' });
      yazi(s.kapanis, 540, 950, 'GIDIKLAYAMAYIZ?', { aile: 'InterDisplay', kalin: 800, boyut: 76, hiza: 'middle', renk: ALTIN, parla: true });
    },
    ciz(t, s) {
      const c = M.c(12), tKul = M.kz(12, 'kulağımız'), tDuy = M.kz(12, 'duyamıyor');
      M.kamera(s.kam, { cx: lerp(700, 560, gec(t, s.bas, tKul)), cy: 860, s: lerp(1.3, 1.0, gec(t, s.bas, tKul, 'inOut')) });
      s.fare.setAttribute('opacity', gec(t, s.bas, c.bas + 0.3));
      s.fareCubuk.setAttribute('height', 420 * (0.75 + 0.25 * Math.abs(Math.sin(t * 9))));
      s.fareCubuk.setAttribute('y', 940 - 420 * (0.75 + 0.25 * Math.abs(Math.sin(t * 9))));
      yaylariCiz(s.fareYay, t, gec(t, s.bas, c.bas + 0.4));
      const b = gec(t, tKul - 0.3, tKul + 0.4);
      s.bant.setAttribute('width', (fx(20000) - fx(20)) * b);
      s.bantAd.setAttribute('opacity', gec(t, tKul, tKul + 0.3));
      const k = gec(t, tDuy - 0.1, tDuy + 0.3, 'outBack');
      s.kulak.setAttribute('opacity', clamp(k));
      s.kulak.setAttribute('transform', `translate(${(fx(20) + fx(20000)) / 2},1100) scale(${0.5 + 0.3 * k})`);
      s.kapanis.setAttribute('opacity', gec(t, c.son + 0.05, c.son + 0.45));
    },
  });
})();
