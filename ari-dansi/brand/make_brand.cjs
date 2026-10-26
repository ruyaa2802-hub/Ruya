// Kanal görselleri: profil resmi + "Bunu biliyor muydunuz?" kapakları.
//   node brand/make_brand.cjs            → out/brand/*.png
//   node brand/make_brand.cjs --t 0.03   → profil için farklı kanat pozu
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.dirname(__dirname);
const OUT = path.join(ROOT, 'out/brand');
const argT = process.argv.includes('--t') ? process.argv[process.argv.indexOf('--t') + 1] : '0.012';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg' };

const srv = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});

(async () => {
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const shot = async (url, w, h, file, dsf = 1, prep) => {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dsf });
    page.on('pageerror', (e) => console.log('[pageerror]', e.message));
    await page.goto(base + url);
    await page.waitForFunction('window.READY === true', null, { timeout: 120000 });
    await page.evaluate(() => document.fonts.ready);
    if (prep) await page.evaluate(prep);
    await page.screenshot({ path: path.join(OUT, file), clip: { x: 0, y: 0, width: w, height: h } });
    await page.close();
    console.log('wrote', file);
  };

  // 1) profile picture (rendered at 2× → 1600 px master)
  await shot('/brand/profil_dunya.html', 1600, 1600, 'pirilumo_profil_1600.png', 1);
  await shot('/brand/profil_dunya.html?guide=1', 1600, 1600, 'onizleme_profil_daire.png', 1);
  require('child_process').execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(OUT, 'onizleme_profil_daire.png'), '-vf', 'scale=800:800:flags=lanczos', path.join(OUT, '_tmp.png')]);
  fs.renameSync(path.join(OUT, '_tmp.png'), path.join(OUT, 'onizleme_profil_daire.png'));
  {
    const page = await browser.newPage({ viewport: { width: 800, height: 800 }, deviceScaleFactor: 2 });
    await page.goto(`${base}/brand/profil.html?t=${argT}&cut=1`);
    await page.waitForFunction('window.READY === true', null, { timeout: 120000 });
    await page.screenshot({ path: path.join(OUT, 'pirilti_saydam.png'), omitBackground: true, clip: { x: 0, y: 0, width: 800, height: 800 } });
    await page.close();
    console.log('wrote pirilti_saydam.png');
  }

  // 2) clean 3D frames from the animation (graphics overlay hidden)
  const clean = () => { document.getElementById('ov').style.display = 'none'; };
  const frame = (fmt, t) => `/scene/index.html?render=1${fmt === 'v' ? '&format=vertical' : ''}`;
  for (const [fmt, t, w, h] of [['v', 15.0, 1080, 1920], ['h', 14.0, 1280, 720]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(base + frame(fmt, t));
    await page.waitForFunction('window.READY === true', null, { timeout: 120000 });
    await page.evaluate((t) => window.renderAt(t), t);
    await page.evaluate(clean);
    await page.screenshot({ path: path.join(OUT, `_bg_${fmt}.png`), clip: { x: 0, y: 0, width: w, height: h } });
    await page.close();
  }
  await browser.close();

  // downscale the profile master to 800 px for the cover logo / upload
  require('child_process').execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(OUT, 'pirilumo_profil_1600.png'), '-vf', 'scale=800:800:flags=lanczos', path.join(OUT, 'pirilumo_profil_800.png')]);

  const browser2 = await chromium.launch();
  const shot2 = async (url, w, h, file) => {
    const page = await browser2.newPage({ viewport: { width: w, height: h } });
    await page.goto(base + url);
    await page.waitForFunction('window.READY === true', null, { timeout: 60000 });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(OUT, file), clip: { x: 0, y: 0, width: w, height: h } });
    await page.close();
    console.log('wrote', file);
  };
  await shot2('/brand/kapak.html?f=v&bg=../out/brand/_bg_v.png', 1080, 1920, 'kapak_shorts_1080x1920.png');
  await shot2('/brand/kapak.html?f=h&bg=../out/brand/_bg_h.png', 1280, 720, 'kapak_yatay_1280x720.png');
  await browser2.close();
  srv.close();
})();
