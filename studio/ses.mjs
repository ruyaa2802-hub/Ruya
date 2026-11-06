// Müzik ve ses efekti yatağı — tamamen kodla sentezlenir (lisans/kredi derdi yok).
// Gizemli pad, korku "sting"i, kalp atışı, geçiş "whoosh"ları, sinir "zap"ı, rüzgâr ve kapanış darbesi.
import fs from 'node:fs';

const SR = 48000;

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

// Durum değişkenli filtre (Chamberlin): low/band/high
function svf() {
  let lo = 0, bp = 0;
  return (x, fc, q = 0.7) => {
    const f = 2 * Math.sin(Math.PI * Math.min(fc, SR / 6) / SR);
    lo += f * bp; const hi = x - lo - (1 / q) * bp; bp += f * hi;
    return { lo, bp, hi };
  };
}

export function sesYatagiUret(TL, dosya) {
  const N = Math.ceil(TL.toplam * SR) + SR;
  const L = new Float32Array(N), R = new Float32Array(N), rev = new Float32Array(N);
  const r = rng(7);
  const ekle = (i, l, rr, yank = 0) => { if (i >= 0 && i < N) { L[i] += l; R[i] += rr; rev[i] += (l + rr) * 0.5 * yank; } };
  const B = TL.bolumler;
  const bolumZaman = id => B.find(b => b.id === id);

  // ---- 1) Pad: bölüm başına akor (Hz), yumuşak geçişli ----
  const akorlar = {
    korku: [55.0, 82.41, 130.81, 155.56],      // A1 E2 C3 Eb3 — gerilimli
    deri: [73.42, 110.0, 174.61, 220.0],        // D minör, merak
    evrim: [87.31, 130.81, 220.0, 261.63],      // F major renkli, geniş
    sonuc: [110.0, 130.81, 164.81, 246.94],     // Am(add9) → huzurlu kapanış
  };
  const padSeviye = 0.05 * ((TL.ses && TL.ses.pad) ?? 1);
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    let l = 0, rr = 0;
    for (const b of B) {
      const ozel = TL.ses && TL.ses.akorlar && TL.ses.akorlar[b.sahne];
      const a = ozel || akorlar[b.sahne] || Object.values(akorlar)[B.indexOf(b) % 4];
      const w = clamp((t - (b.start - 1.2)) / 2.4) * (1 - clamp((t - (b.end - 1.2)) / 2.4));
      if (w <= 0) continue;
      a.forEach((f, k) => {
        const lfo = 0.6 + 0.4 * Math.sin(2 * Math.PI * (0.07 + k * 0.031) * t + k);
        const s1 = Math.sin(2 * Math.PI * f * t), s2 = Math.sin(2 * Math.PI * f * 1.004 * t + 1.3), s3 = Math.sin(2 * Math.PI * f * 2.003 * t) * 0.25;
        const v = (s1 + s2 * 0.8 + s3) * lfo * w * padSeviye / (k + 1.6);
        l += v * (k % 2 ? 0.75 : 1); rr += v * (k % 2 ? 1 : 0.75);
      });
    }
    const giris = clamp(t / 2.5), cikis = clamp((TL.toplam - t) / 2.0);
    ekle(i, l * giris * cikis, rr * giris * cikis, 0.5);
  }

  // ---- 2) Korku sting'i (giriş anında) ----
  const korkuT = Math.max(0.6, TL.giris - 0.8);
  if (!TL.ses || TL.ses.sting !== false) {
    const n0 = Math.floor(korkuT * SR), f = svf();
    for (let j = 0; j < SR * 3; j++) {
      const t = j / SR;
      const boom = Math.sin(2 * Math.PI * (30 + 50 * Math.exp(-t * 8)) * t) * Math.exp(-t * 2.2) * 0.55;
      const gur = f((r() * 2 - 1), 900 + 3000 * Math.exp(-t * 6), 0.9).bp * Math.exp(-t * 9) * 0.6;
      const metal = [523, 787, 1131, 1663].reduce((s, fr, k) => s + Math.sin(2 * Math.PI * fr * t + k) * Math.exp(-t * (3 + k)), 0) * 0.05;
      ekle(n0 + j, boom + gur + metal, boom + gur * 0.8 + metal, 0.9);
    }
  }

  // ---- 3) Kalp atışı (korku sahnesi boyunca, giderek azalan) ----
  const korku = bolumZaman('korku');
  if (korku) {
    for (let t = korkuT + 0.35; t < korku.end - 0.6; t += 0.82) {
      const sev = 0.42 * (1 - 0.6 * clamp((t - korkuT) / (korku.end - korkuT)));
      for (const [ofs, a] of [[0, 1], [0.17, 0.7]]) {
        const n0 = Math.floor((t + ofs) * SR);
        for (let j = 0; j < SR * 0.25; j++) {
          const tt = j / SR;
          const v = Math.sin(2 * Math.PI * (48 + 30 * Math.exp(-tt * 30)) * tt) * Math.exp(-tt * 18) * sev * a;
          ekle(n0 + j, v, v, 0.2);
        }
      }
    }
  }

  // ---- 4) Geçiş whoosh'ları ----
  for (let k = 0; k < B.length - 1; k++) {
    const merkez = B[k].end, d = (B[k].gecisSure || 1) + 0.6;
    const n0 = Math.floor((merkez - d * 0.6) * SR), f = svf();
    for (let j = 0; j < d * SR; j++) {
      const u = j / (d * SR);
      const zarf = Math.pow(Math.sin(Math.PI * Math.pow(u, 0.8)), 2);
      const fc = 250 + 4200 * Math.pow(Math.sin(Math.PI * u), 2);
      const v = f(r() * 2 - 1, fc, 1.2).bp * zarf * 0.32 * ((TL.ses && TL.ses.whoosh) ?? 1);
      const pan = 0.5 + 0.45 * Math.cos(Math.PI * u);
      ekle(n0 + j, v * (1 - pan) * 1.6, v * pan * 1.6, 0.6);
    }
  }

  // ---- 5) Sinir sinyali "zap"ı (deri sahnesi, 3. cümle) ----
  const deri = bolumZaman('deri');
  if (deri && deri.cumleler[2]) {
    const c = deri.cumleler[2];
    const t0 = c.start + 0.18 * (c.end - c.start);
    const n0 = Math.floor(t0 * SR);
    for (let j = 0; j < SR * 1.2; j++) {
      const t = j / SR;
      const fr = 300 + 1500 * t;
      const v = Math.sin(2 * Math.PI * fr * t + 3 * Math.sin(2 * Math.PI * 37 * t)) * Math.exp(-t * 2.5) * clamp(t * 30) * 0.08;
      ekle(n0 + j, v, v * 0.7, 0.8);
    }
    // kılların kalkması: yükselen parıltı
    const t1 = c.start + 0.55 * (c.end - c.start), n1 = Math.floor(t1 * SR);
    for (let j = 0; j < SR * 2; j++) {
      const t = j / SR, u = t / 2;
      const v = [880, 1320, 1760].reduce((s, fr, k) => s + Math.sin(2 * Math.PI * fr * (1 + u * 0.06) * t + k), 0) * Math.sin(Math.PI * u) * 0.022;
      ekle(n1 + j, v, v, 1);
    }
  }

  // ---- 6) Rüzgâr (evrim, soğuk bölüm) ----
  const evrim = bolumZaman('evrim');
  if (evrim && evrim.cumleler[2]) {
    const c = evrim.cumleler[2], a = c.start - 0.8, z = evrim.end + 0.4, f = svf();
    for (let i = Math.floor(a * SR); i < Math.min(N, z * SR); i++) {
      const t = i / SR, w = clamp((t - a) / 1.5) * clamp((z - t) / 1.2);
      const fc = 500 + 400 * Math.sin(2 * Math.PI * 0.23 * t) + 250 * Math.sin(2 * Math.PI * 0.61 * t);
      const v = f(r() * 2 - 1, fc, 2.5).bp * w * 0.16;
      ekle(i, v * (0.8 + 0.2 * Math.sin(t)), v * (0.8 - 0.2 * Math.sin(t)), 0.3);
    }
  }

  // ---- 6b) Senaryodaki genel ses işaretleri: pop / parilti / zap ----
  for (const is of (TL.ses && TL.ses.isaretler) || []) {
    const b = bolumZaman(is.bolum); if (!b) continue;
    const c = b.cumleler[Math.min(is.cumle || 0, b.cumleler.length - 1)];
    const t0 = c.start + (is.oran || 0) * (c.end - c.start), n0 = Math.floor(t0 * SR);
    const sev = is.seviye || 1;
    if (is.tip === 'pop') {
      for (let k = 0; k < (is.adet || 1); k++) for (let j = 0; j < SR * 0.18; j++) {
        const t = j / SR, f0 = 420 + k * 130;
        const v = Math.sin(2 * Math.PI * (f0 + 900 * Math.exp(-t * 40)) * t) * Math.exp(-t * 28) * 0.12 * sev;
        ekle(n0 + Math.floor(k * 0.11 * SR) + j, v * (k % 2 ? 0.7 : 1), v * (k % 2 ? 1 : 0.7), 0.5);
      }
    } else if (is.tip === 'parilti') {
      for (let j = 0; j < SR * 1.6; j++) {
        const t = j / SR;
        const v = [1046, 1318, 1568, 2093].reduce((s, fr, k) => s + Math.sin(2 * Math.PI * fr * t + k) * Math.exp(-Math.max(0, t - k * 0.09) * 3) * (t > k * 0.09 ? 1 : 0), 0) * 0.03 * sev;
        ekle(n0 + j, v, v, 1);
      }
    } else if (is.tip === 'titresim') {
      for (const ofs of [0, 0.32]) for (let j = 0; j < SR * 0.22; j++) {
        const t = j / SR, env = Math.sin(Math.PI * t / 0.22);
        const v = (Math.sin(2 * Math.PI * 155 * t) * 0.7 + Math.sin(2 * Math.PI * 310 * t) * 0.3) * (0.6 + 0.4 * Math.sign(Math.sin(2 * Math.PI * 28 * t))) * env * 0.22 * sev;
        ekle(n0 + Math.floor(ofs * SR) + j, v, v, 0.15);
      }
    } else if (is.tip === 'nefes') {
      const f = svf();
      for (let j = 0; j < SR * 1.8; j++) {
        const t = j / SR, env = Math.sin(Math.PI * t / 1.8) ** 2;
        const v = f(r() * 2 - 1, 700, 0.8).bp * env * 0.12 * sev;
        ekle(n0 + j, v, v, 0.3);
      }
    } else if (is.tip === 'kalp') {
      for (let k = 0; k < (is.adet || 4); k++) for (const [ofs, a] of [[0, 1], [0.17, 0.7]]) {
        const nk = n0 + Math.floor((k * (is.aralik || 0.85) + ofs) * SR);
        for (let j = 0; j < SR * 0.25; j++) { const t = j / SR, v = Math.sin(2 * Math.PI * (48 + 30 * Math.exp(-t * 30)) * t) * Math.exp(-t * 18) * 0.38 * a * sev * (1 - k * 0.12); ekle(nk + j, v, v, 0.2); }
      }
    } else if (is.tip === 'zap') {
      for (let j = 0; j < SR * 1.0; j++) {
        const t = j / SR;
        const v = Math.sin(2 * Math.PI * (300 + 1500 * t) * t + 3 * Math.sin(2 * Math.PI * 37 * t)) * Math.exp(-t * 2.5) * clamp(t * 30) * 0.08 * sev;
        ekle(n0 + j, v, v * 0.7, 0.8);
      }
    }
  }

  // ---- 6c) Ortam sesleri (senaryo.ses.ortam): oda, yagmur, saat, kus ----
  const araliK = (o) => {
    const b0 = bolumZaman(o.bas) || B[0], b1 = bolumZaman(o.son) || B[B.length - 1];
    return [b0.start + (o.basOfs || 0), b1.end + (o.sonOfs || 0)];
  };
  for (const o of (TL.ses && TL.ses.ortam) || []) {
    const [a, z] = araliK(o), sev = o.seviye ?? 1, rr = rng(11 + a * 100 | 0);
    const zarf = t => clamp((t - a) / 1.5) * clamp((z - t) / 1.5);
    if (o.tip === 'oda') {
      const f1 = svf(), f2 = svf();
      for (let i = Math.floor(a * SR); i < Math.min(N, z * SR); i++) {
        const t = i / SR, w = zarf(t);
        const v = f1(rr() * 2 - 1, 180, 0.7).lo * 0.10 * w * sev, u = f2(rr() * 2 - 1, 140, 0.7).lo * 0.10 * w * sev;
        ekle(i, v, u, 0);
      }
    } else if (o.tip === 'yagmur') {
      const f1 = svf(), f2 = svf();
      for (let i = Math.floor(a * SR); i < Math.min(N, z * SR); i++) {
        const t = i / SR, w = zarf(t);
        let v = f1(rr() * 2 - 1, 2400, 0.6).bp * 0.05, u = f2(rr() * 2 - 1, 2100, 0.6).bp * 0.05;
        if (rr() < 0.0009) { const d = 0.02 + rr() * 0.04; v += d; u += d * rr(); } // cama damlalar
        ekle(i, v * w * sev, u * w * sev, 0.1);
      }
    } else if (o.tip === 'saat') {
      for (let t0 = a + 0.3; t0 < z; t0 += 1.0) {
        const n0 = Math.floor(t0 * SR), tok = Math.round((t0 - a) % 2) === 0;
        for (let j = 0; j < SR * 0.03; j++) {
          const t = j / SR, v = Math.sin(2 * Math.PI * (tok ? 3200 : 2600) * t) * Math.exp(-t * 260) * 0.05 * sev * zarf(t0);
          ekle(n0 + j, v * 0.6, v, 0.4);
        }
      }
    } else if (o.tip === 'kipirti') {
      // mikroskobik kıpırtı: çok kısa, ince tıkırtılar ve sürtünmeler
      const f1 = svf();
      for (let t0 = a + 0.2; t0 < z - 0.2; t0 += 0.05 + rr() * 0.22) {
        const n0 = Math.floor(t0 * SR), pan = rr(), fr = 2500 + rr() * 4000, uz = 0.006 + rr() * 0.02;
        for (let j = 0; j < SR * uz; j++) {
          const t = j / SR, v = f1(rr() * 2 - 1, fr, 3).bp * Math.exp(-t * 300) * 0.09 * sev * zarf(t0);
          ekle(n0 + j, v * (1 - pan), v * pan, 0.2);
        }
      }
    } else if (o.tip === 'ruzgar') {
      const f1 = svf(), f2 = svf();
      for (let i = Math.floor(a * SR); i < Math.min(N, z * SR); i++) {
        const t = i / SR, w = zarf(t), fc = 450 + 300 * Math.sin(2 * Math.PI * 0.17 * t) + 150 * Math.sin(2 * Math.PI * 0.53 * t);
        ekle(i, f1(rr() * 2 - 1, fc, 2).bp * 0.10 * w * sev, f2(rr() * 2 - 1, fc * 1.1, 2).bp * 0.10 * w * sev, 0.2);
      }
    } else if (o.tip === 'sehir') {
      const f1 = svf(), f2 = svf();
      for (let i = Math.floor(a * SR); i < Math.min(N, z * SR); i++) {
        const t = i / SR, w = zarf(t);
        const ugul = f1(rr() * 2 - 1, 140 + 40 * Math.sin(t * 0.3), 0.7).lo * 0.12, uzak = f2(rr() * 2 - 1, 900, 1.2).bp * 0.025;
        ekle(i, (ugul + uzak) * w * sev, (ugul * 0.9 + uzak * 1.1) * w * sev, 0.4);
      }
      for (let t0 = a + 1.2; t0 < z - 1; t0 += 1.8 + rr() * 2.5) {           // uzak sesler (zil, kuş)
        const n0 = Math.floor(t0 * SR), f0 = 1800 + rr() * 1600, pan = rr();
        for (let j = 0; j < SR * 0.25; j++) { const t = j / SR, v = Math.sin(2 * Math.PI * f0 * t) * Math.exp(-t * 14) * 0.012 * sev * zarf(t0); ekle(n0 + j, v * (1 - pan), v * pan, 1); }
      }
    } else if (o.tip === 'kus') {
      for (let t0 = a + 0.8; t0 < z - 0.5; t0 += 0.9 + rr() * 1.6) {
        const n0 = Math.floor(t0 * SR), f0 = 2600 + rr() * 1800, adet = 2 + Math.floor(rr() * 4), pan = rr();
        for (let k = 0; k < adet; k++) for (let j = 0; j < SR * 0.09; j++) {
          const t = j / SR, u = t / 0.09;
          const v = Math.sin(2 * Math.PI * (f0 + 900 * Math.sin(Math.PI * u)) * t) * Math.sin(Math.PI * u) * 0.025 * sev * zarf(t0);
          ekle(n0 + Math.floor(k * 0.12 * SR) + j, v * (1 - pan), v * pan, 0.6);
        }
      }
    }
  }

  // ---- 6d) Yumuşak piyano (senaryo.ses.piyano): bölüm akorundan arpej ----
  if (TL.ses && TL.ses.piyano) {
    const pv = TL.ses.piyano === true ? 1 : TL.ses.piyano;
    for (const b of B) {
      const ozel = TL.ses.akorlar && TL.ses.akorlar[b.sahne];
      const a = (ozel || [110, 130.81, 164.81, 196]).map(f => f * 2);
      let k = 0;
      for (let t0 = b.start + 0.4; t0 < b.end - 0.3; t0 += 1.35, k++) {
        const f = a[[0, 2, 1, 3, 2, 1][k % 6]] * (k % 6 === 3 ? 2 : 1), n0 = Math.floor(t0 * SR);
        const ses0 = (k % 6 === 0 ? 1 : 0.7) * 0.06 * pv;
        for (let j = 0; j < SR * 3.5; j++) {
          const t = j / SR, env = Math.exp(-t * 1.4) * clamp(t * 200);
          const v = (Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(2 * Math.PI * f * 2.002 * t) * Math.exp(-t * 2) + 0.12 * Math.sin(2 * Math.PI * f * 3.01 * t) * Math.exp(-t * 4)) * env * ses0;
          ekle(n0 + j, v * 0.9, v, 0.9);
        }
      }
    }
  }

  // ---- 6e) Yaylı çalgı katmanı (senaryo.ses.yayli): akordan yavaş kabaran sıcak doku ----
  if (TL.ses && TL.ses.yayli) {
    const Y = TL.ses.yayli, sev0 = Y.seviye ?? 1;
    for (const b of B) {
      const ozel = TL.ses.akorlar && TL.ses.akorlar[b.sahne];
      if (!ozel) continue;
      const bs = ((Y.bolumler || {})[b.sahne] ?? 1) * sev0;
      if (bs <= 0) continue;
      const a = Math.max(0, b.start - 0.8), z = Math.min(TL.toplam, b.end + 1.2);
      const notalar = [ozel[1] * 2, ozel[2] * 2, ozel[3] * 2, ozel[0] * 4];
      const lp = notalar.map(() => 0);
      for (let i = Math.floor(a * SR); i < Math.min(N, z * SR); i++) {
        const t = i / SR;
        const env = clamp((t - a) / 2.2) * clamp((z - t) / 1.6) * (0.75 + 0.25 * Math.sin(2 * Math.PI * 0.11 * t));
        if (env <= 0) continue;
        let l = 0, rr = 0;
        notalar.forEach((f, k) => {
          const vib = 1 + 0.003 * Math.sin(2 * Math.PI * (5.1 + k * 0.3) * t + k);
          let v = 0;
          for (let h = 1; h <= 6; h++) v += Math.sin(2 * Math.PI * f * vib * h * t + h * k) / h;
          const c = 0.06 + 0.05 * env;
          lp[k] += c * (v - lp[k]);
          const o = lp[k] * env * 0.018 * bs;
          l += o * (k % 2 ? 0.7 : 1); rr += o * (k % 2 ? 1 : 0.7);
        });
        ekle(i, l, rr, 0.9);
      }
    }
  }

  // ---- 7) Kapanış darbesi ----
  {
    const t0 = TL.konusmaSon + 0.15, n0 = Math.floor(t0 * SR);
    for (let j = 0; j < SR * 4; j++) {
      const t = j / SR;
      const v = Math.sin(2 * Math.PI * (36 + 30 * Math.exp(-t * 5)) * t) * Math.exp(-t * 1.3) * 0.4
        + [220, 330, 440, 659].reduce((s, fr, k) => s + Math.sin(2 * Math.PI * fr * t + k), 0) * Math.exp(-t * 0.9) * 0.018 * clamp(t * 8);
      ekle(n0 + j, v, v, 1);
    }
  }

  // ---- Basit yankı (comb + allpass) ----
  const combs = [1557, 1617, 1491, 1422].map(d => ({ d: Math.floor(d * SR / 44100), buf: new Float32Array(Math.floor(d * SR / 44100)), i: 0 }));
  let onceki = 0;
  for (let i = 0; i < N; i++) {
    let s = 0;
    for (const c of combs) { const y = c.buf[c.i]; c.buf[c.i] = rev[i] * 0.5 + y * 0.84; c.i = (c.i + 1) % c.d; s += y; }
    s = s * 0.25; onceki = onceki * 0.6 + s * 0.4;
    L[i] += onceki * 0.45; R[i] += (s * 0.6 + onceki * 0.4) * 0.45;
  }

  // ---- WAV yaz (16 bit stereo) ----
  let tepe = 0;
  for (let i = 0; i < N; i++) tepe = Math.max(tepe, Math.abs(L[i]), Math.abs(R[i]));
  const kazanc = tepe > 0.89 ? 0.89 / tepe : 1;
  const buf = Buffer.alloc(44 + N * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
  for (let i = 0; i < N; i++) {
    buf.writeInt16LE(Math.round(clamp(L[i] * kazanc, -1, 1) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(clamp(R[i] * kazanc, -1, 1) * 32767), 46 + i * 4);
  }
  fs.writeFileSync(dosya, buf);
}
