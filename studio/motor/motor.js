/* Ücretsiz video motoru: her kare yalnızca t (saniye) değerinden hesaplanır.
   Böylece render deterministik olur; aynı t her zaman aynı görüntüyü verir. */
(function () {
  const M = (window.Motor = {});
  M.W = 1080; M.H = 1920; M.FPS = 30;

  // ---------- matematik ----------
  M.clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  M.lerp = (a, b, p) => a + (b - a) * p;
  M.aralik = (t, a, b) => (b === a ? (t >= a ? 1 : 0) : M.clamp((t - a) / (b - a)));
  M.ease = {
    lin: (p) => p,
    in: (p) => p * p * p,
    out: (p) => 1 - Math.pow(1 - p, 3),
    inOut: (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
    outExpo: (p) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p)),
    outBack: (p) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); },
    sin: (p) => 0.5 - Math.cos(Math.PI * p) / 2,
  };
  // t, [a,b] aralığında 0→1 (yumuşatılmış)
  M.gec = (t, a, b, e = 'inOut') => M.ease[e](M.aralik(t, a, b));
  // a'da girip b'de çıkan 0→1→0 zarfı
  M.zarf = (t, a, b, gir = 0.3, cik = 0.3) => Math.min(M.gec(t, a, a + gir, 'out'), 1 - M.gec(t, b - cik, b, 'in'));
  M.rng = (seed) => () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  // pürüzsüz gürültü (kamera titreşimi, el hareketi vb.)
  M.gurultu = (x, seed = 1) => {
    const i = Math.floor(x), f = x - i, h = (n) => { const s = Math.sin((n + seed * 57.13) * 127.1) * 43758.5453; return s - Math.floor(s); };
    const u = f * f * (3 - 2 * f);
    return M.lerp(h(i), h(i + 1), u) * 2 - 1;
  };

  // ---------- DOM / SVG yardımcıları ----------
  const NS = 'http://www.w3.org/2000/svg';
  M.svg = (tag, attrs = {}, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  M.el = (tag, attrs = {}, parent, html) => {
    const e = document.createElement(tag);
    for (const k in attrs) k === 'style' ? (e.style.cssText = attrs[k]) : e.setAttribute(k, attrs[k]);
    if (html != null) e.innerHTML = html;
    if (parent) parent.appendChild(e);
    return e;
  };
  M.ayarla = (e, attrs) => { for (const k in attrs) e.setAttribute(k, attrs[k]); };
  // SVG kamera: (cx,cy) noktası ekranın (ox,oy) noktasına gelir, s ölçek, r derece
  M.kamera = (g, { cx = 540, cy = 960, s = 1, r = 0, ox = 540, oy = 960 }) =>
    g.setAttribute('transform', `translate(${ox},${oy}) rotate(${r}) scale(${s}) translate(${-cx},${-cy})`);
  // Ortak filtre ve gradyanlar
  M.tanimlar = (svg) => {
    const d = M.svg('defs', {}, svg);
    d.innerHTML = `
      <filter id="parla" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="7" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="parlaGuclu" x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur stdDeviation="18" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="bulanik"><feGaussianBlur stdDeviation="14"/></filter>
      <filter id="bulanikAz"><feGaussianBlur stdDeviation="4"/></filter>
      <radialGradient id="spot" cx="50%" cy="50%" r="50%">
        <stop offset="0" stop-color="#5ce1e6" stop-opacity=".35"/>
        <stop offset=".5" stop-color="#2a6b9c" stop-opacity=".12"/>
        <stop offset="1" stop-color="#000" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="spotAmber" cx="50%" cy="50%" r="50%">
        <stop offset="0" stop-color="#ffb547" stop-opacity=".5"/>
        <stop offset=".45" stop-color="#ff7a2f" stop-opacity=".15"/>
        <stop offset="1" stop-color="#000" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="isikHuzmesi" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#bff6ff" stop-opacity=".28"/>
        <stop offset="1" stop-color="#bff6ff" stop-opacity="0"/>
      </linearGradient>`;
    return d;
  };

  // ---------- zamanlama ----------
  M.z = null;        // zamanlama.json
  M.ayar = {};       // ayarlar.json
  M.kelimeler = [];  // {cumle, i, metin, bas, son}
  M.c = (id) => M.z.cumleler.find((c) => c.id === id);
  // Bir cümledeki kelimenin (metin parçası ile) başlangıç zamanı
  M.kz = (cumleId, parca, sira = 0) => {
    const ks = M.kelimeler.filter((k) => k.cumle === cumleId && k.metin.toLocaleLowerCase('tr').includes(parca.toLocaleLowerCase('tr')));
    if (!ks.length) throw new Error(`Kelime bulunamadı: ${cumleId} / ${parca}`);
    return ks[Math.min(sira, ks.length - 1)].bas;
  };
  M.kzSon = (cumleId, parca, sira = 0) => {
    const ks = M.kelimeler.filter((k) => k.cumle === cumleId && k.metin.toLocaleLowerCase('tr').includes(parca.toLocaleLowerCase('tr')));
    return ks[Math.min(sira, ks.length - 1)].son;
  };

  // Kelime zamanları: cümle süresi kelime uzunluğuna (+sabit) göre paylaştırılır,
  // noktalama işaretlerinden sonra kısa duraklama payı bırakılır.
  function kelimeZamanla() {
    M.kelimeler = [];
    for (const c of M.z.cumleler) {
      const ks = c.metin.split(/\s+/).filter(Boolean);
      const agirlik = ks.map((k) => k.replace(/[^\p{L}\p{N}]/gu, '').length + 1.6 + (/[,;:]$/.test(k) ? 2.2 : 0));
      const top = agirlik.reduce((a, b) => a + b, 0);
      let t = c.bas;
      ks.forEach((k, i) => {
        const d = ((c.son - c.bas) * agirlik[i]) / top;
        M.kelimeler.push({ cumle: c.id, i, metin: k, bas: t, son: t + d - (/[,;:]$/.test(k) ? d * 0.35 : 0) });
        t += d;
      });
    }
  }

  // ---------- altyazı ----------
  let ifadeler = [];
  function ifadeKur() {
    ifadeler = [];
    for (const c of M.z.cumleler) {
      const ks = M.kelimeler.filter((k) => k.cumle === c.id);
      let grup = [];
      const kapat = () => { if (grup.length) ifadeler.push(grup); grup = []; };
      ks.forEach((k, i) => {
        grup.push(k);
        const uzunluk = grup.map((g) => g.metin).join(' ').length;
        const sonraki = ks[i + 1];
        if (/[,.!?;:]$/.test(k.metin) || grup.length >= 3 || uzunluk >= 17 || (sonraki && uzunluk + sonraki.metin.length > 22)) kapat();
      });
      kapat();
    }
    ifadeler.forEach((g, i) => {
      g.bas = g[0].bas - 0.06;
      const sonraki = ifadeler[i + 1];
      const cumleSonu = !sonraki || sonraki[0].cumle !== g[0].cumle;
      g.son = cumleSonu ? g[g.length - 1].son + 0.35 : sonraki[0].bas - 0.06;
    });
  }
  let altyaziKutu, aktifIfade = null, kelimeEls = [];
  function altyaziCiz(t) {
    const g = ifadeler.find((x) => t >= x.bas && t < x.son) || null;
    if (g !== aktifIfade) {
      altyaziKutu.innerHTML = '';
      kelimeEls = [];
      if (g) {
        const d = M.el('div', { class: 'ifade' }, altyaziKutu);
        kelimeEls = g.map((k) => M.el('span', { class: 'kelime' }, d, k.metin));
      }
      aktifIfade = g;
    }
    if (!g) return;
    const cik = M.gec(t, g.son - 0.12, g.son, 'in');
    g.forEach((k, i) => {
      const e = kelimeEls[i];
      const p = M.gec(t, k.bas - 0.05, k.bas + 0.13, 'outBack');
      const aktif = t >= k.bas && t < k.son + 0.05;
      e.classList.toggle('aktif', aktif);
      e.style.opacity = M.clamp(p * 1.6) * (1 - cik);
      e.style.transform = `translateY(${(1 - p) * 34}px) scale(${0.82 + 0.18 * p})`;
    });
  }

  // ---------- global efektler ----------
  let tozCtx, grenCtx, grenVeri, tozlar = [];
  function efektKur() {
    tozCtx = document.getElementById('toz').getContext('2d');
    grenCtx = document.getElementById('gren').getContext('2d');
    grenVeri = grenCtx.createImageData(540, 960);
    const r = M.rng(7);
    for (let i = 0; i < 90; i++) {
      const derinlik = r();
      tozlar.push({ x: r() * 1080, y: r() * 1920, vx: (r() - 0.5) * 18, vy: -6 - r() * 22, d: derinlik, faz: r() * 6.28 });
    }
  }
  function tozCiz(t) {
    tozCtx.clearRect(0, 0, 1080, 1920);
    for (const p of tozlar) {
      const x = (((p.x + p.vx * t) % 1180) + 1180) % 1180 - 50;
      const y = (((p.y + p.vy * t) % 2020) + 2020) % 2020 - 50;
      const yakin = p.d > 0.86; // ön plan: büyük, bulanık bokeh
      const rr = yakin ? 26 + p.d * 30 : 1.2 + p.d * 3.2;
      const a = (yakin ? 0.07 : 0.22 + 0.25 * p.d) * (0.6 + 0.4 * Math.sin(t * 1.3 + p.faz));
      const g = tozCtx.createRadialGradient(x, y, 0, x, y, rr);
      g.addColorStop(0, `rgba(191,246,255,${a})`);
      g.addColorStop(yakin ? 0.7 : 0.35, `rgba(120,200,255,${a * 0.5})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      tozCtx.fillStyle = g;
      tozCtx.beginPath(); tozCtx.arc(x, y, rr, 0, 6.283); tozCtx.fill();
    }
  }
  function grenCiz(t) {
    const r = M.rng(Math.floor(t * M.FPS) + 11), v = grenVeri.data;
    for (let i = 0; i < v.length; i += 4) { const c = (r() * 255) | 0; v[i] = v[i + 1] = v[i + 2] = c; v[i + 3] = 255; }
    grenCtx.putImageData(grenVeri, 0, 0);
  }
  function isikCiz(t) {
    // yavaşça süzülen ışık sızıntısı + üstten hacimsel ışık
    const a = 18 + 8 * Math.sin(t * 0.21), b = 30 + 10 * Math.cos(t * 0.17);
    document.getElementById('isik').style.background =
      `radial-gradient(ellipse 70% 40% at ${a}% ${b}%, rgba(92,225,230,.10), transparent 70%),` +
      `radial-gradient(ellipse 60% 45% at ${100 - a}% ${85 - b / 3}%, rgba(123,92,255,.10), transparent 70%)`;
  }

  // ---------- sahneler ----------
  M.sahneler = [];
  // tanim: { ad, cumleler:[ilk,son], kur(kok, svg, kam), ciz(t, s) }
  M.sahne = (tanim) => M.sahneler.push(tanim);

  function sahneZamanla() {
    const cs = M.z.cumleler;
    M.sahneler.forEach((s, i) => {
      const ilk = M.c(s.cumleler[0]);
      const onceki = cs[cs.indexOf(ilk) - 1];
      s.bas = s.bas ?? (i === 0 ? 0 : onceki ? (onceki.son + ilk.bas) / 2 : ilk.bas);
    });
    M.sahneler.forEach((s, i) => { s.son = s.son ?? (M.sahneler[i + 1] ? M.sahneler[i + 1].bas : M.z.sure); });
  }

  function sahneleriKur() {
    const kap = document.getElementById('sahneler');
    for (const s of M.sahneler) {
      s.kok = M.el('div', { class: 'sahne', 'data-ad': s.ad }, kap);
      s.svg = M.svg('svg', { viewBox: '0 0 1080 1920', width: 1080, height: 1920 }, s.kok);
      M.tanimlar(s.svg);
      s.kam = M.svg('g', {}, s.svg);
      s.kur(s);
    }
  }

  // Sinematik geçiş: giden sahne öne doğru büyür + bulanır, gelen sahne geriden netleşir.
  const GECIS = 0.55;
  function sahneleriCiz(t) {
    for (const s of M.sahneler) {
      const gorunur = t >= s.bas - GECIS / 2 && t < s.son + GECIS / 2;
      s.kok.style.display = gorunur ? 'block' : 'none';
      if (!gorunur) continue;
      const ilkMi = s === M.sahneler[0], sonMu = s === M.sahneler[M.sahneler.length - 1];
      const gir = ilkMi ? 1 : M.gec(t, s.bas - GECIS / 2, s.bas + GECIS / 2, 'inOut');
      const cik = sonMu ? 0 : M.gec(t, s.son - GECIS / 2, s.son + GECIS / 2, 'inOut');
      s.kok.style.opacity = Math.min(gir, 1 - cik);
      const olcek = (1 + (1 - gir) * 0.12) * (1 + cik * 0.1);
      const bulanik = (1 - gir) * 14 + cik * 16;
      s.kok.style.transform = `scale(${olcek})`;
      s.kok.style.filter = bulanik > 0.2 ? `blur(${bulanik.toFixed(1)}px)` : 'none';
      s.ciz(t, s, M.aralik(t, s.bas, s.son));
    }
  }

  // ---------- ana döngü ----------
  M.ciz = (t) => {
    sahneleriCiz(t);
    tozCiz(t);
    grenCiz(t);
    isikCiz(t);
    altyaziCiz(t);
    const et = document.getElementById('etiket');
    et.style.opacity = 0.9 * M.gec(t, 0.2, 1.0) * (1 - 0.55 * M.gec(t, 4, 6));
    // açılış ve kapanış karartması
    document.getElementById('karartma').style.opacity = Math.max(1 - M.gec(t, 0, 0.35, 'out'), M.gec(t, M.z.sure - 0.45, M.z.sure, 'in'));
  };

  async function json(yol) {
    const r = await fetch(yol, { cache: 'no-store' });
    if (!r.ok) throw new Error(`${yol} okunamadı (${r.status})`);
    return r.json();
  }
  function betik(yol) {
    return new Promise((ok, hata) => { const s = document.createElement('script'); s.src = yol; s.onload = ok; s.onerror = () => hata(new Error(`${yol} yüklenemedi`)); document.body.appendChild(s); });
  }

  M.baslat = async (video) => {
    try {
      const kok = `../../${video}`;
      M.z = await json(`${kok}/zamanlama.json`);
      M.ayar = await json(`${kok}/ayarlar.json`).catch(() => ({}));
      kelimeZamanla();
      ifadeKur();
      altyaziKutu = document.getElementById('altyazi');
      document.getElementById('etiket').textContent = M.ayar.etiket || '';
      efektKur();
      await betik(`${kok}/sahneler.js`);
      sahneZamanla();
      sahneleriKur();
      await document.fonts.ready;
      window.__sure = M.z.sure;
      window.__ciz = M.ciz;
      // Tarayıcıda açılırsa (önizleme), gerçek zamanlı oynat
      if (!navigator.webdriver) {
        const t0 = performance.now();
        const dongu = () => { M.ciz(((performance.now() - t0) / 1000) % M.z.sure); requestAnimationFrame(dongu); };
        dongu();
      } else M.ciz(0);
      window.__hazir = true;
    } catch (e) {
      window.__hata = String(e && e.stack || e);
      console.error(e);
    }
  };
})();
