// Zamanlama: senaryodan (tahmini) ya da gerçek ses dosyasından (sessizlik analizi) zaman çizelgesi üretir.
// Harici API yok — yalnızca yerel ffmpeg/ffprobe.
import { execFileSync, spawnSync } from 'node:child_process';

// Türkçe anlatım için ortalama hız (ağırlık birimi/sn). Ölçüm: belgesel anlatıcısı, ~14.6 harf/sn.
const HIZ = 17.8;
const CUMLE_ARASI = 0.32;   // tahmini cümle arası duraklama (sn)
const BOLUM_ARASI = 0.55;   // tahmini bölüm (paragraf) arası duraklama (sn)

export const cumleler = m => m.replace(/\s+/g, ' ').trim().split(/(?<=[.!?…])\s+/).filter(Boolean);
const kelimeler = c => c.split(' ').filter(Boolean);
const agirlik = w => w.replace(/[^\p{L}\p{N}]/gu, '').length + 1.4 + (/[,;:]$/.test(w) ? 2.2 : 0);
const cumleAgirlik = c => kelimeler(c).reduce((s, w) => s + agirlik(w), 0);

export function sesSuresi(dosya) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', dosya]).toString();
  return parseFloat(out);
}

export function sessizlikler(dosya, esik = -38, minSure = 0.2) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', dosya, '-af', `silencedetect=n=${esik}dB:d=${minSure}`, '-f', 'null', '-'], { encoding: 'utf8' });
  const s = [], txt = r.stderr;
  let bas = null;
  for (const satir of txt.split('\n')) {
    let m = satir.match(/silence_start: ([\d.]+)/);
    if (m) bas = parseFloat(m[1]);
    m = satir.match(/silence_end: ([\d.]+)/);
    if (m && bas !== null) { s.push({ s: bas, e: parseFloat(m[1]) }); bas = null; }
  }
  if (bas !== null) s.push({ s: bas, e: Infinity });
  return s;
}

// Beklenen sınırlar için en uygun sessizlikleri sırayla seç
function sinirSec(beklenen, adaylar, bas, son, minAra) {
  const secilen = [];
  let onceki = bas;
  beklenen.forEach((b, i) => {
    const kalan = beklenen.length - i - 1;
    const uygun = adaylar.filter(a => (a.s + a.e) / 2 > onceki + minAra && (a.s + a.e) / 2 < son - minAra * (kalan + 1) && !secilen.includes(a));
    let en = null, enSkor = Infinity;
    for (const a of uygun) {
      const orta = (a.s + a.e) / 2;
      const skor = Math.abs(orta - b) - 0.8 * Math.min(a.e - a.s, 1.0);
      if (skor < enSkor) { enSkor = skor; en = a; }
    }
    if (en && enSkor < 2.5) { secilen.push(en); onceki = (en.s + en.e) / 2; }
    else { const sahte = { s: b - 0.05, e: b + 0.05, sahte: true }; secilen.push(sahte); onceki = b; }
  });
  return secilen;
}

function kelimeleriDagit(metin, bas, son) {
  const ks = kelimeler(metin), ag = ks.map(agirlik), top = ag.reduce((a, b) => a + b, 0);
  let t = bas;
  return ks.map((k, i) => { const d = (son - bas) * ag[i] / top; const o = { k, start: t, end: t + d }; t += d; return o; });
}

// Altyazı parçaları: en fazla ~3-4 kelime / 24 harf, cümle sınırını aşmaz
function altyaziParcala(kelimeListesi) {
  const parcalar = [];
  let p = [];
  const bitir = () => { if (p.length) parcalar.push(p); p = []; };
  for (const k of kelimeListesi) {
    const uzunluk = p.map(x => x.k).join(' ').length + k.k.length + 1;
    if (p.length && (p.length >= 4 || uzunluk > 24)) bitir();
    p.push(k);
    if (/[.!?…,]$/.test(k.k) && p.length >= 2) bitir();
  }
  bitir();
  return parcalar;
}

export function zamanlamaOlustur(senaryo, sesYolu = null) {
  const giris = senaryo.giris ?? 2.0;
  const kapanis = senaryo.kapanis ?? 2.0;
  const bolumler = senaryo.bolumler.map(b => ({ ...b, cumleListesi: cumleler(b.metin) }));
  const bolumAg = bolumler.map(b => b.cumleListesi.reduce((s, c) => s + cumleAgirlik(c), 0));

  let konusmaBas, konusmaSon, sesSure = null, kaynak;
  const bolumAraliklari = [];   // ses zamanında [bas, son] (konuşma)
  const cumleAraliklari = [];   // her bölüm için cümle [bas, son] listesi

  if (sesYolu) {
    kaynak = 'ses';
    sesSure = sesSuresi(sesYolu);
    const sil = sessizlikler(sesYolu);
    konusmaBas = 0; konusmaSon = sesSure;
    const ic = [];
    for (const s of sil) {
      if (s.s <= 0.05) { konusmaBas = s.e; continue; }
      if (s.e >= sesSure - 0.05 || s.e === Infinity) { konusmaSon = s.s; continue; }
      ic.push(s);
    }
    // bölüm sınırları
    const topAg = bolumAg.reduce((a, b) => a + b, 0);
    const beklenen = [];
    let kum = 0;
    for (let i = 0; i < bolumler.length - 1; i++) { kum += bolumAg[i]; beklenen.push(konusmaBas + (konusmaSon - konusmaBas) * kum / topAg); }
    const sinirlar = sinirSec(beklenen, ic, konusmaBas, konusmaSon, 2.0);
    bolumler.forEach((b, i) => {
      const bas = i === 0 ? konusmaBas : sinirlar[i - 1].e;
      const son = i === bolumler.length - 1 ? konusmaSon : sinirlar[i].s;
      bolumAraliklari.push([bas, son]);
      // cümle sınırları bu bölüm içindeki sessizliklerden
      const cl = b.cumleListesi, ag = cl.map(cumleAgirlik), top = ag.reduce((a, c) => a + c, 0);
      const bekl = []; let k = 0;
      for (let j = 0; j < cl.length - 1; j++) { k += ag[j]; bekl.push(bas + (son - bas) * k / top); }
      const icSil = ic.filter(s => s.s > bas + 0.3 && s.e < son - 0.3);
      const cs = sinirSec(bekl, icSil, bas, son, 0.8);
      cumleAraliklari.push(cl.map((_, j) => [j === 0 ? bas : cs[j - 1].e, j === cl.length - 1 ? son : cs[j].s]));
    });
  } else {
    kaynak = 'tahmin';
    konusmaBas = 0;
    let t = 0;
    bolumler.forEach((b, i) => {
      if (i > 0) t += BOLUM_ARASI;
      const bas = t, cl = [];
      b.cumleListesi.forEach((c, j) => {
        if (j > 0) t += CUMLE_ARASI;
        const d = cumleAgirlik(c) / HIZ;
        cl.push([t, t + d]); t += d;
      });
      bolumAraliklari.push([bas, t]);
      cumleAraliklari.push(cl);
    });
    konusmaSon = t;
  }

  // Video zamanına çevir (giriş kadar kaydır)
  const V = x => x + giris;
  const toplam = Math.max(V(konusmaSon) + kapanis, sesSure ? V(sesSure) + 0.3 : 0);
  const out = {
    kaynak, fps: senaryo.fps || 30, W: 1080, H: 1920,
    giris, toplam, konusmaBas: V(konusmaBas), konusmaSon: V(konusmaSon),
    altyaziY: senaryo.altyaziY || 1390,
    ses: senaryo.ses || {},
    bolumler: [], altyazi: [],
  };
  bolumler.forEach((b, i) => {
    const [kb, ks] = bolumAraliklari[i];
    const sonraki = bolumAraliklari[i + 1];
    const start = i === 0 ? 0 : out.bolumler[i - 1].end;
    const end = i === bolumler.length - 1 ? toplam : V((ks + sonraki[0]) / 2);
    const cumleListe = b.cumleListesi.map((c, j) => ({ metin: c, start: V(cumleAraliklari[i][j][0]), end: V(cumleAraliklari[i][j][1]) }));
    out.bolumler.push({
      id: b.id, sahne: b.sahne || b.id, gecis: b.gecis || 'karart', gecisSure: b.gecisSure || 1.0,
      start, end, konusma: { start: V(kb), end: V(ks) }, cumleler: cumleListe,
    });
    for (const c of cumleListe) {
      const ks2 = kelimeleriDagit(c.metin, c.start, c.end);
      for (const p of altyaziParcala(ks2)) out.altyazi.push({ start: p[0].start, end: p[p.length - 1].end, kelimeler: p });
    }
  });
  // altyazı boşluklarını kapat (kısa aralarda bir önceki parça ekranda kalsın)
  for (let i = 0; i < out.altyazi.length - 1; i++) {
    const a = out.altyazi[i], b = out.altyazi[i + 1];
    if (b.start - a.end < 0.45) { a.end = b.start; a.devam = true; }
    else a.end += 0.25;
  }
  if (out.altyazi.length) out.altyazi[out.altyazi.length - 1].end += 0.4;
  if (senaryo.kanca) {
    out.kanca = { ust: senaryo.kanca.ust, satirlar: senaryo.kanca.satirlar, start: senaryo.kanca.start ?? 0.4, end: out.bolumler[0].end - 0.3 };
  }
  return out;
}
