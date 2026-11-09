// Kare kare render: headless Chromium (SwiftShader WebGL) + FFmpeg. Tamamen ücretsiz/yerel.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')));
const scene = args.scene || '1';
const W = +(args.w || 1080), H = +(args.h || 1920);
const start = +(args.start || 0), end = +(args.end || 0); // kare aralığı [start,end)
const out = args.out || `cikti/sahneler/sahne${scene}.mp4`;
const stills = args.stills; // virgülle ayrılmış kare numaraları -> png
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.glb': 'model/gltf-binary', '.png': 'image/png', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
}).listen(0);
const port = server.address().port;

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on('console', m => console.log('[page]', m.text()));
page.on('pageerror', e => console.error('[page error]', e));
await page.goto(`http://127.0.0.1:${port}/src/film.html?scene=${scene}&w=${W}&h=${H}&rt=${args.rt||0}&hide=${args.hide||0}&dbg=${args.dbg||0}`);
await page.waitForFunction(() => window.READY === true || window.FAILED, null, { timeout: 180000 });
const total = await page.evaluate(() => window.FRAMES);
const last = end || total;
const t0 = Date.now();

if (stills) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  for (const f of stills.split(',').map(Number)) {
    const b64 = await page.evaluate(f => window.renderFrame(f, 'image/png'), f);
    const fn = out.replace(/\.\w+$/, '') + `_${f}.png`;
    fs.writeFileSync(fn, Buffer.from(b64, 'base64'));
    console.log('still', fn, ((Date.now() - t0) / 1000).toFixed(1) + 's');
  }
} else {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-pix_fmt', 'yuv420p', '-r', '30', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = start; f < last; f++) {
    const b64 = await page.evaluate(f => window.renderFrame(f, 'image/jpeg'), f);
    const buf = Buffer.from(b64, 'base64');
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (f % 15 === 0) console.log(`sahne ${scene}: kare ${f}/${last}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  console.log('bitti', out, ((Date.now() - t0) / 1000).toFixed(0) + 's');
}
await browser.close();
server.close();
