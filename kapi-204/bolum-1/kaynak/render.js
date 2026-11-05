// Kullanim: node render.js test 12,60,... | node render.js full
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const W = 720, H = 1280;
(async () => {
  const mode = process.argv[2];
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: W, height: H } });
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('PAGE', m.type(), m.text().slice(0, 300)); });
  p.on('pageerror', (e) => console.log('PAGEERR', e.message));
  await p.goto('http://127.0.0.1:8204/index.html');
  await p.waitForFunction(() => window.READY || window.ERR, null, { timeout: 300000 });
  const err = await p.evaluate(() => window.ERR); if (err) { console.log(err); process.exit(1); }
  const toPng = (b64, out) => new Promise((res) => {
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-i', '-', '-vf', 'vflip', out]);
    ff.on('close', res); ff.stdin.end(Buffer.from(b64, 'base64'));
  });
  if (mode === 'test') {
    const frames = process.argv[3].split(',').map(Number);
    fs.mkdirSync(__dirname + '/test', { recursive: true });
    for (const f of frames) {
      const t0 = Date.now();
      await p.evaluate((f) => window.renderAt(f), f);
      const b64 = await p.evaluate(() => window.grab());
      const sh = await p.evaluate(() => window.shot());
      await toPng(b64, `${__dirname}/test/f${String(f).padStart(3, '0')}_${sh}.png`);
      console.log(f, sh, Date.now() - t0, 'ms');
    }
  } else {
    const start = +(process.argv[3] || 0), end = +(process.argv[4] || 720);
    const out = process.argv[5] || __dirname + '/visual.mp4';
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', '24', '-i', '-', '-vf', 'vflip', '-c:v', 'libx264', '-preset', 'medium', '-crf', '12', '-pix_fmt', 'yuv420p', out]);
    const t0 = Date.now();
    for (let f = start; f < end; f++) {
      await p.evaluate((f) => window.renderAt(f), f);
      const b64 = await p.evaluate(() => window.grab());
      const buf = Buffer.from(b64, 'base64');
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
      if (f % 24 === 0) console.log('frame', f, ((Date.now() - t0) / (f - start + 1)).toFixed(0), 'ms/frame');
    }
    ff.stdin.end(); await new Promise((r) => ff.on('close', r));
  }
  await b.close();
})();
