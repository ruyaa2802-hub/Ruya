// Frame-accurate renderer: drives scene/index.html in headless Chromium,
// screenshots every frame and pipes it into ffmpeg (H.264).
//
//   node render.cjs --stills 2,10.5,19.5          → out/stills/t_<time>.png
//   node render.cjs --from 0 --to 42.5 --out out/video_noaudio.mp4
//   node render.cjs --from 0 --to 10 --part 0     → out/parts/part0.mp4 (+ cues)
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const ROOT = __dirname;
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => (a.startsWith('--') ? [...acc, [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]] : acc), [])
);
const FPS = 30;

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.wav': 'audio/wav', '.css': 'text/css' };
function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

(async () => {
  const srv = await serve();
  const port = srv.address().port;
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-vsync'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text()); });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto(`http://127.0.0.1:${port}/scene/index.html?render=1`);
  await page.waitForFunction('window.READY === true', null, { timeout: 120000 });
  await page.evaluate(() => document.fonts.ready);
  const clip = { x: 0, y: 0, width: 1280, height: 720 };

  if (args.stills) {
    fs.mkdirSync(path.join(ROOT, 'out/stills'), { recursive: true });
    for (const s of String(args.stills).split(',')) {
      const t = parseFloat(s);
      const t0 = Date.now();
      await page.evaluate((t) => window.renderAt(t), t);
      const file = path.join(ROOT, `out/stills/t_${t.toFixed(2)}.png`);
      await page.screenshot({ path: file, clip });
      console.log('still', t, file, `${Date.now() - t0}ms`);
    }
  } else {
    const from = parseFloat(args.from ?? 0);
    const to = parseFloat(args.to ?? (await page.evaluate(() => window.DURATION)));
    const out = path.join(ROOT, args.out ?? `out/parts/part${args.part ?? 0}.mp4`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const f0 = Math.round(from * FPS), f1 = Math.round(to * FPS);
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(FPS), out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const cues = [];
    const tStart = Date.now();
    for (let f = f0; f < f1; f++) {
      const t = f / FPS;
      const cue = await page.evaluate((t) => window.renderAt(t), t);
      cues.push(cue);
      const buf = await page.screenshot({ type: 'jpeg', quality: 95, clip });
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
      if ((f - f0) % 30 === 0) {
        const el = (Date.now() - tStart) / 1000, done = f - f0 + 1;
        console.log(`frame ${f}/${f1} t=${t.toFixed(2)}  ${(el / done).toFixed(2)}s/frame  eta ${((f1 - f - 1) * el / done / 60).toFixed(1)} min`);
      }
    }
    ff.stdin.end();
    await new Promise((r) => ff.on('close', r));
    fs.writeFileSync(out.replace(/\.mp4$/, '.cues.json'), JSON.stringify({ events: await page.evaluate(() => window.EVENTS), cues }));
    console.log('wrote', out);
  }
  await browser.close();
  srv.close();
})();
