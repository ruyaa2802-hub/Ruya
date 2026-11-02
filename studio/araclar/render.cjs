#!/usr/bin/env node
/* Sahneleri headless Chromium'da kare kare çizer, FFmpeg ile H.264 MP4 yapar.
   Ücretsizdir: hiçbir harici API çağrısı yapmaz, yalnızca yerel bir HTTP sunucusu açar.

   Kullanım:
     node studio/araclar/render.cjs <video-klasoru> <cikti.mp4> [--isci 4] [--bas 0] [--son 10] [--kare 12.5 kare.png]
*/
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

let chromium;
try { ({ chromium } = require('playwright')); } catch { console.error('playwright bulunamadı: npm install'); process.exit(1); }

const KOK = path.resolve(__dirname, '..', '..');
const arg = process.argv.slice(2);
const video = arg[0], cikti = arg[1];
const opt = (ad, vars) => { const i = arg.indexOf(`--${ad}`); return i >= 0 ? arg[i + 1] : vars; };
if (!video || !cikti) { console.error('Kullanım: render.cjs <video-klasoru> <cikti.mp4> [--isci N] [--bas s] [--son s] [--kare t dosya.png]'); process.exit(2); }

const FPS = 30;
const TIP = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.otf': 'font/otf', '.ttf': 'font/ttf', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };

function sunucu() {
  return new Promise((ok) => {
    const s = http.createServer((req, res) => {
      const p = path.join(KOK, decodeURIComponent(new URL(req.url, 'http://x').pathname));
      if (!p.startsWith(KOK) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': TIP[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(res);
    });
    s.listen(0, '127.0.0.1', () => ok(s));
  });
}

async function sayfaAc(tarayici, port) {
  const sayfa = await tarayici.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  sayfa.on('pageerror', (e) => console.error('[sayfa hatası]', e.message));
  await sayfa.goto(`http://127.0.0.1:${port}/studio/motor/sahne.html?video=${encodeURIComponent(video)}`);
  await sayfa.waitForFunction(() => window.__hazir || window.__hata, null, { timeout: 60000 });
  const hata = await sayfa.evaluate(() => window.__hata);
  if (hata) throw new Error(hata);
  return sayfa;
}

function ffmpegBaslat(dosya) {
  const f = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-maxrate', '7M', '-bufsize', '14M', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart', dosya], { stdio: ['pipe', 'inherit', 'inherit'] });
  const bitti = new Promise((ok, hata) => f.on('close', (k) => (k === 0 ? ok() : hata(new Error(`ffmpeg çıkış kodu ${k}`)))));
  return { f, bitti };
}

async function yaz(akis, veri) { if (!akis.write(veri)) await new Promise((ok) => akis.once('drain', ok)); }

(async () => {
  const srv = await sunucu();
  const port = srv.address().port;
  const tarayici = await chromium.launch({ args: ['--disable-gpu', '--font-render-hinting=none', '--force-color-profile=srgb'] });
  try {
    // Tek kare (hızlı kontrol)
    const kareT = opt('kare');
    if (kareT != null) {
      const s = await sayfaAc(tarayici, port);
      await s.evaluate((t) => window.__ciz(t), Number(kareT));
      await s.screenshot({ path: arg[arg.indexOf('--kare') + 2] || cikti, type: 'png' });
      console.log('kare yazıldı');
      return;
    }

    const ilk = await sayfaAc(tarayici, port);
    const sure = await ilk.evaluate(() => window.__sure);
    await ilk.close();
    const bas = Number(opt('bas', 0)), son = Math.min(Number(opt('son', sure)), sure);
    const kareSayisi = Math.round((son - bas) * FPS);
    const isci = Math.max(1, Math.min(Number(opt('isci', Math.min(os.cpus().length, 6))), kareSayisi));
    const gecici = fs.mkdtempSync(path.join(os.tmpdir(), 'render-'));
    const parca = Math.ceil(kareSayisi / isci);
    console.log(`${kareSayisi} kare (${(son - bas).toFixed(2)} sn), ${isci} işçi`);
    const t0 = Date.now();
    let biten = 0;

    const parcalar = await Promise.all(Array.from({ length: isci }, async (_, w) => {
      const a = w * parca, b = Math.min(kareSayisi, a + parca);
      const dosya = path.join(gecici, `p${String(w).padStart(2, '0')}.mp4`);
      if (a >= b) return null;
      const sayfa = await sayfaAc(tarayici, port);
      const { f, bitti } = ffmpegBaslat(dosya);
      for (let k = a; k < b; k++) {
        await sayfa.evaluate((t) => window.__ciz(t), bas + k / FPS);
        await yaz(f.stdin, await sayfa.screenshot({ type: 'jpeg', quality: 93 }));
        if (++biten % 60 === 0) process.stdout.write(`\r  ${biten}/${kareSayisi} kare  (${((Date.now() - t0) / 1000).toFixed(0)} sn)`);
      }
      f.stdin.end();
      await bitti;
      await sayfa.close();
      return dosya;
    }));

    const liste = path.join(gecici, 'liste.txt');
    fs.writeFileSync(liste, parcalar.filter(Boolean).map((p) => `file '${p}'`).join('\n'));
    fs.mkdirSync(path.dirname(path.resolve(cikti)), { recursive: true });
    await new Promise((ok, hata) => spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', liste, '-c', 'copy', '-movflags', '+faststart', cikti], { stdio: 'inherit' })
      .on('close', (k) => (k === 0 ? ok() : hata(new Error('birleştirme başarısız')))));
    fs.rmSync(gecici, { recursive: true, force: true });
    console.log(`\nTamam: ${cikti}  (${((Date.now() - t0) / 1000).toFixed(0)} sn)`);
  } finally {
    await tarayici.close();
    srv.close();
  }
})().catch((e) => { console.error('\nHATA:', e.message); process.exit(1); });
