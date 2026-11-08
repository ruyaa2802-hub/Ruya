// Prosedurel dokular (tamamen kodla uretilir, harici gorsel yok)
import * as THREE from 'three';

let seed = 2041;
export function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
export function setSeed(s) { seed = s; }

function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }

// deger gurultusu
function makeNoise(size, s) {
  const g = new Float32Array(size * size); setSeed(s);
  for (let i = 0; i < g.length; i++) g[i] = rnd();
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const a = g[((yi % size + size) % size) * size + ((xi % size + size) % size)];
    const b = g[((yi % size + size) % size) * size + (((xi + 1) % size + size) % size)];
    const c = g[(((yi + 1) % size + size) % size) * size + ((xi % size + size) % size)];
    const d = g[(((yi + 1) % size + size) % size) * size + (((xi + 1) % size + size) % size)];
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}
export function fbmFn(s, oct = 5) {
  const n = makeNoise(256, s);
  return (x, y) => { let v = 0, a = 0.5, f = 1; for (let o = 0; o < oct; o++) { v += a * n(x * f, y * f); f *= 2; a *= 0.5; } return v; };
}

function tex(c, srgb = true, rep = [1, 1]) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 4; t.needsUpdate = true; return t;
}

// gurultuyu pikseller uzerine uygula
function grime(ctx, w, h, s, amt, scale = 6, dark = [20, 18, 14]) {
  const f = fbmFn(s);
  const img = ctx.getImageData(0, 0, w, h); const d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const n = f(x / w * scale, y / h * scale);
    const k = Math.max(0, (n - 0.45)) * amt;
    const i = (y * w + x) * 4;
    d[i] = d[i] * (1 - k) + dark[0] * k; d[i + 1] = d[i + 1] * (1 - k) + dark[1] * k; d[i + 2] = d[i + 2] * (1 - k) + dark[2] * k;
    const fine = (rnd() - 0.5) * 10;
    d[i] += fine; d[i + 1] += fine; d[i + 2] += fine;
  }
  ctx.putImageData(img, 0, 0);
}

// Terrazzo / mozaik karo zemin (eski apartman koridoru)
export function terrazzo() {
  const W = 1024; const [c, x] = cv(W, W);
  x.fillStyle = '#7d786e'; x.fillRect(0, 0, W, W);
  setSeed(7);
  const cols = ['#d8d2c4', '#2b2925', '#8c4a3a', '#a49e90', '#5d5a53', '#bfb6a0'];
  for (let i = 0; i < 9000; i++) {
    x.fillStyle = cols[Math.floor(rnd() * cols.length)];
    const px = rnd() * W, py = rnd() * W, r = 1 + rnd() * rnd() * 7;
    x.beginPath();
    for (let k = 0; k < 5; k++) { const a = k / 5 * 6.28 + rnd(); x.lineTo(px + Math.cos(a) * r * (0.6 + rnd() * 0.6), py + Math.sin(a) * r * (0.6 + rnd() * 0.6)); }
    x.fill();
  }
  x.strokeStyle = 'rgba(30,28,24,0.8)'; x.lineWidth = 3;
  for (let i = 0; i <= 2; i++) { x.beginPath(); x.moveTo(i * W / 2, 0); x.lineTo(i * W / 2, W); x.stroke(); x.beginPath(); x.moveTo(0, i * W / 2); x.lineTo(W, i * W / 2); x.stroke(); }
  grime(x, W, W, 11, 0.9, 5, [35, 32, 26]);
  return tex(c, true);
}

// Koridor duvari: alt yari koyu yagli boya, ust yari kirli badana
export function corridorWall() {
  const W = 1024, H = 1024; const [c, x] = cv(W, H);
  const split = H * (1 - 1.15 / 2.7);
  x.fillStyle = '#b3ab97'; x.fillRect(0, 0, W, split);
  x.fillStyle = '#34443a'; x.fillRect(0, split, W, H - split);
  x.fillStyle = '#2a211b'; x.fillRect(0, split - 6, W, 10);
  // akintilar
  setSeed(19);
  for (let i = 0; i < 40; i++) {
    const px = rnd() * W, py = rnd() * split * 0.6, len = 60 + rnd() * 300;
    const g = x.createLinearGradient(px, py, px, py + len);
    g.addColorStop(0, 'rgba(70,60,40,0.18)'); g.addColorStop(1, 'rgba(70,60,40,0)');
    x.fillStyle = g; x.fillRect(px, py, 2 + rnd() * 5, len);
  }
  // catlaklar
  x.strokeStyle = 'rgba(40,35,28,0.5)'; x.lineWidth = 1.2;
  for (let i = 0; i < 6; i++) {
    let px = rnd() * W, py = rnd() * split; x.beginPath(); x.moveTo(px, py);
    for (let k = 0; k < 14; k++) { px += (rnd() - 0.5) * 30; py += rnd() * 22; x.lineTo(px, py); } x.stroke();
  }
  // asinmis alt bolge (ayak izleri, darbe izleri)
  for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(190,180,160,${0.05 + rnd() * 0.1})`; x.fillRect(rnd() * W, split + rnd() * (H - split), 3 + rnd() * 20, 2 + rnd() * 6); }
  grime(x, W, H, 23, 0.75, 4);
  return tex(c, true);
}

export function ceiling() {
  const W = 512; const [c, x] = cv(W, W);
  x.fillStyle = '#a39d8f'; x.fillRect(0, 0, W, W);
  grime(x, W, W, 31, 1.1, 3, [60, 52, 40]);
  return tex(c, true);
}

// Koyu ceviz kapi, panelli
export function doorWood(dark = '#3a2418', s = 41) {
  const W = 512, H = 1024; const [c, x] = cv(W, H);
  const f = fbmFn(s, 4);
  const img = x.createImageData(W, H); const d = img.data;
  const base = new THREE.Color(dark);
  for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) {
    const g = Math.sin((xx * 0.09 + f(xx / 60, yy / 300) * 9) * 1.0) * 0.5 + 0.5;
    const k = 0.75 + g * 0.35 + (f(xx / 20, yy / 20) - 0.5) * 0.15;
    const i = (yy * W + xx) * 4;
    d[i] = base.r * 255 * k; d[i + 1] = base.g * 255 * k; d[i + 2] = base.b * 255 * k; d[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  // paneller
  const panels = [[70, 80, 372, 360], [70, 540, 372, 400]];
  for (const [px, py, pw, ph] of panels) {
    x.strokeStyle = 'rgba(0,0,0,0.55)'; x.lineWidth = 10; x.strokeRect(px, py, pw, ph);
    x.strokeStyle = 'rgba(255,220,180,0.10)'; x.lineWidth = 3; x.strokeRect(px + 7, py + 7, pw - 14, ph - 14);
  }
  grime(x, W, H, s + 3, 0.4, 3, [10, 6, 4]);
  return tex(c, true);
}

// Pirinc numara plakasi
export function numberPlate(text) {
  const W = 256, H = 128; const [c, x] = cv(W, H);
  const g = x.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#8a6a2e'); g.addColorStop(0.45, '#d8b465'); g.addColorStop(0.55, '#b8913f'); g.addColorStop(1, '#6e5222');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.strokeStyle = '#4a3512'; x.lineWidth = 6; x.strokeRect(5, 5, W - 10, H - 10);
  x.font = '600 92px Oswald'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = 'rgba(255,240,200,0.35)'; x.fillText(text, W / 2 + 2, H / 2 + 6);
  x.fillStyle = '#1a1208'; x.fillText(text, W / 2, H / 2 + 4);
  grime(x, W, H, 5, 0.6, 4, [40, 30, 10]);
  return tex(c, true);
}

// Daire ici: soluk desenli duvar kagidi
export function wallpaper() {
  const W = 512, H = 1024; const [c, x] = cv(W, H);
  x.fillStyle = '#6b6252'; x.fillRect(0, 0, W, H);
  x.strokeStyle = 'rgba(40,34,26,0.25)'; x.lineWidth = 2;
  for (let i = 0; i < 8; i++) { x.beginPath(); x.moveTo(i * 64 + 32, 0); x.lineTo(i * 64 + 32, H); x.stroke(); }
  x.fillStyle = 'rgba(150,135,105,0.18)';
  for (let yy = 0; yy < H; yy += 96) for (let xx = 0; xx < W; xx += 64) {
    const ox = (yy / 96) % 2 ? 32 : 0;
    x.beginPath(); x.ellipse(xx + ox, yy, 9, 18, 0, 0, 6.28); x.fill();
  }
  grime(x, W, H, 61, 0.7, 4, [30, 26, 20]);
  return tex(c, true);
}

export function parquet() {
  const W = 1024; const [c, x] = cv(W, W);
  setSeed(71); const f = fbmFn(72, 3);
  const pw = 1024 / 8;
  for (let i = 0; i < 8; i++) {
    let yy = -rnd() * 400;
    while (yy < W) {
      const len = 300 + rnd() * 400; const tone = 0.75 + rnd() * 0.35;
      const img = x.createImageData(pw, Math.ceil(len));
      for (let a = 0; a < Math.ceil(len); a++) for (let b = 0; b < pw; b++) {
        const g = Math.sin(b * 0.25 + f(b / 30, (a + yy) / 200) * 12) * 0.5 + 0.5;
        const k = tone * (0.8 + 0.25 * g);
        const p = (a * pw + b) * 4;
        img.data[p] = 104 * k; img.data[p + 1] = 68 * k; img.data[p + 2] = 42 * k; img.data[p + 3] = 255;
      }
      x.putImageData(img, i * pw, yy);
      x.fillStyle = 'rgba(15,8,4,0.9)'; x.fillRect(i * pw, yy, pw, 3); x.fillRect(i * pw, yy, 3, len);
      yy += len;
    }
  }
  grime(x, W, W, 73, 0.5, 4, [20, 12, 8]);
  return tex(c, true);
}

export function rug() {
  const W = 512, H = 768; const [c, x] = cv(W, H);
  x.fillStyle = '#4a1716'; x.fillRect(0, 0, W, H);
  x.strokeStyle = '#1d0c0b'; x.lineWidth = 18; x.strokeRect(30, 30, W - 60, H - 60);
  x.strokeStyle = '#8a6a3a'; x.lineWidth = 5; x.strokeRect(52, 52, W - 104, H - 104);
  x.fillStyle = '#21304a';
  x.beginPath(); x.moveTo(W / 2, 140); x.lineTo(W - 120, H / 2); x.lineTo(W / 2, H - 140); x.lineTo(120, H / 2); x.closePath(); x.fill();
  x.fillStyle = '#7a2a20'; x.beginPath(); x.moveTo(W / 2, 230); x.lineTo(W - 190, H / 2); x.lineTo(W / 2, H - 230); x.lineTo(190, H / 2); x.closePath(); x.fill();
  setSeed(81);
  for (let i = 0; i < 300; i++) { x.fillStyle = `rgba(${200 * rnd()},${120 * rnd()},60,0.25)`; x.fillRect(60 + rnd() * (W - 120), 60 + rnd() * (H - 120), 6, 6); }
  grime(x, W, H, 82, 0.6, 5, [15, 6, 5]);
  return tex(c, true);
}

export function tableWood() { return doorWood('#4a2e1c', 91); }

// Hindistan cevizi lifi paspas
export function doormat() {
  const W = 256, H = 160; const [c, x] = cv(W, H);
  x.fillStyle = '#5a4128'; x.fillRect(0, 0, W, H);
  setSeed(101);
  for (let i = 0; i < 6000; i++) { x.fillStyle = `rgba(${120 + rnd() * 60},${80 + rnd() * 40},${40 + rnd() * 20},0.5)`; x.fillRect(rnd() * W, rnd() * H, 1, 2 + rnd() * 3); }
  x.strokeStyle = '#2a1d10'; x.lineWidth = 8; x.strokeRect(4, 4, W - 8, H - 8);
  return tex(c, true);
}

// jaluzi: ay isigi icin projeksiyon maskesi
export function blindsCookie() {
  const W = 256; const [c, x] = cv(W, W);
  x.fillStyle = '#000'; x.fillRect(0, 0, W, W);
  const g = x.createRadialGradient(W / 2, W / 2, 10, W / 2, W / 2, W / 2);
  g.addColorStop(0, '#fff'); g.addColorStop(0.8, '#bbb'); g.addColorStop(1, '#000');
  x.fillStyle = g; x.fillRect(0, 0, W, W);
  x.fillStyle = '#000';
  for (let i = 0; i < 16; i++) x.fillRect(0, i * 16, W, 7);
  x.fillRect(W / 2 - 3, 0, 6, W);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// goz: sklera + kahverengi iris + bebek
export function eyeTex() {
  const W = 512, H = 256; const [c, x] = cv(W, H);
  x.fillStyle = '#d9cfc4'; x.fillRect(0, 0, W, H);
  // kan damarlari
  setSeed(5); x.strokeStyle = 'rgba(150,40,40,0.35)'; x.lineWidth = 1;
  for (let i = 0; i < 40; i++) { let px = rnd() * W, py = rnd() * H; x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += (rnd() - 0.5) * 20; py += (rnd() - 0.5) * 20; x.lineTo(px, py); } x.stroke(); }
  const cx = W * 0.25, cy = H * 0.5, R = 38;
  const g = x.createRadialGradient(cx, cy, 4, cx, cy, R);
  g.addColorStop(0, '#2a1a10'); g.addColorStop(0.35, '#5b3a20'); g.addColorStop(0.8, '#3d2614'); g.addColorStop(1, '#120a06');
  x.fillStyle = g; x.beginPath(); x.arc(cx, cy, R, 0, 6.28); x.fill();
  x.strokeStyle = 'rgba(160,110,60,0.35)';
  for (let a = 0; a < 6.28; a += 0.12) { x.beginPath(); x.moveTo(cx + Math.cos(a) * 14, cy + Math.sin(a) * 14); x.lineTo(cx + Math.cos(a) * R * 0.9, cy + Math.sin(a) * R * 0.9); x.stroke(); }
  x.fillStyle = '#050302'; x.beginPath(); x.arc(cx, cy, 15, 0, 6.28); x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// kumas (kapusonlu) icin ince dokulu bump
export function fabricBump() {
  const W = 256; const [c, x] = cv(W, W);
  const img = x.createImageData(W, W); setSeed(9);
  for (let i = 0; i < W * W; i++) { const yy = Math.floor(i / W), xx = i % W; const v = 128 + 50 * Math.sin(xx * 1.6) * Math.sin(yy * 1.6) + (rnd() - 0.5) * 60; img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
  x.putImageData(img, 0, 0);
  return tex(c, false, [8, 8]);
}

export function hairBump() {
  const W = 256; const [c, x] = cv(W, W);
  x.fillStyle = '#808080'; x.fillRect(0, 0, W, W); setSeed(13);
  for (let i = 0; i < 2500; i++) { const v = Math.floor(rnd() * 255); x.strokeStyle = `rgb(${v},${v},${v})`; x.lineWidth = 1; const px = rnd() * W, py = rnd() * W; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (rnd() - 0.5) * 6, py + 10 + rnd() * 14); x.stroke(); }
  return tex(c, false, [3, 3]);
}

// karton paket uzerindeki etiket
export function labelTex() {
  const W = 256, H = 160; const [c, x] = cv(W, H);
  x.fillStyle = '#d8d0bd'; x.fillRect(0, 0, W, H);
  x.strokeStyle = 'rgba(0,0,0,0.25)'; x.lineWidth = 2;
  for (let i = 1; i < 4; i++) { x.beginPath(); x.moveTo(16, i * 38 + 10); x.lineTo(W - 16, i * 38 + 10); x.stroke(); }
  x.font = '700 64px Caveat'; x.fillStyle = '#1b1a22'; x.textAlign = 'center'; x.fillText('D. 204', W / 2, 98);
  grime(x, W, H, 3, 0.5, 4);
  return tex(c, true);
}

// Fotografin arkasi: el yazisi mesaj
export function photoBack() {
  const W = 640, H = 960; const [c, x] = cv(W, H);
  x.fillStyle = '#e9e3d6'; x.fillRect(0, 0, W, H);
  grime(x, W, H, 201, 0.35, 3, [150, 135, 110]);
  x.save(); x.translate(W / 2, H / 2); x.rotate(-0.06);
  const lines = ['BU GECE', 'YALNIZ', 'DEĞİLSİN.'];
  x.textAlign = 'center'; x.textBaseline = 'middle';
  setSeed(303);
  lines.forEach((l, i) => {
    x.font = `700 ${i === 2 ? 150 : 140}px Caveat`;
    const yy = (i - 1) * 175;
    for (let k = 0; k < 4; k++) { x.fillStyle = `rgba(18,16,30,${0.28 + rnd() * 0.15})`; x.fillText(l, (rnd() - 0.5) * 3, yy + (rnd() - 0.5) * 3); }
  });
  // murekkep lekesi
  x.fillStyle = 'rgba(18,16,30,0.75)'; x.beginPath(); x.arc(205, 255, 7, 0, 6.28); x.fill();
  x.restore();
  return tex(c, true);
}

// Gece manzarasi: koyu lacivert gok, ay, karanlik bina siluetleri, seyrek yanan pencereler
export function nightView(seedN = 404) {
  const W = 512, H = 640; const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#05070d'); g.addColorStop(0.55, '#0e1626'); g.addColorStop(1, '#1a1f2a');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  // ay + hale
  const mg = x.createRadialGradient(360, 120, 8, 360, 120, 110); mg.addColorStop(0, 'rgba(210,220,255,0.55)'); mg.addColorStop(1, 'rgba(210,220,255,0)');
  x.fillStyle = mg; x.fillRect(0, 0, W, H);
  x.fillStyle = '#e6ebff'; x.beginPath(); x.arc(360, 120, 26, 0, 6.28); x.fill();
  x.fillStyle = 'rgba(120,130,160,0.35)'; x.beginPath(); x.arc(352, 112, 6, 0, 6.28); x.fill(); x.beginPath(); x.arc(368, 128, 4, 0, 6.28); x.fill();
  // bulut seritleri
  x.fillStyle = 'rgba(20,28,45,0.7)'; x.fillRect(250, 135, 260, 10); x.fillRect(300, 98, 200, 6);
  // binalar
  setSeed(seedN); let bx = -10;
  while (bx < W) {
    const bw = 50 + rnd() * 90, bh = 180 + rnd() * 300, top = H - bh;
    x.fillStyle = '#040508'; x.fillRect(bx, top, bw, bh);
    for (let wy = top + 14; wy < H - 10; wy += 22) for (let wx = bx + 8; wx < bx + bw - 10; wx += 16)
      if (rnd() < 0.06) { x.fillStyle = rnd() < 0.7 ? 'rgba(255,190,110,0.85)' : 'rgba(170,200,255,0.7)'; x.fillRect(wx, wy, 7, 10); }
    bx += bw + 4 + rnd() * 10;
  }
  // uzaktan sokak lambasi turuncu isigi (alt kenar)
  const sg = x.createRadialGradient(140, H, 10, 140, H, 220); sg.addColorStop(0, 'rgba(255,140,50,0.35)'); sg.addColorStop(1, 'rgba(255,140,50,0)');
  x.fillStyle = sg; x.fillRect(0, 0, W, H);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
