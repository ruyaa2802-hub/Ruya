// Kullanım: node render.mjs <başlangıçKaresi> <bitişKaresi> <çıktı.mp4> [ölçek]
//           node render.mjs --still <saniye,...> <klasör> [ölçek]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('/opt/node22/lib/node_modules/playwright');

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = path.join(ROOT, u === '/' ? 'src/' + (process.env.PAGE || 'index') + '.html' : u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, r));
const port = server.address().port;

const args = process.argv.slice(2);
const still = args[0] === '--still';
const scale = parseFloat((still ? args[3] : args[3]) || '1');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.error('[page]', m.text()); });
page.on('pageerror', e => { console.error('[pageerror]', e.stack); process.exit(1); });
await page.goto(`http://localhost:${port}/?scale=${scale}`, { timeout: 600000 });
await page.waitForFunction('window.READY === true', null, { timeout: 300000 });

if (process.env.NOCROWD) await page.evaluate(() => { window.DEBUG_NOCROWD = true; });
const grab = async (t) => Buffer.from((await page.evaluate(t => window.renderFrame(t), t)).split(',')[1], 'base64');

if (still) {
  fs.mkdirSync(args[2], { recursive: true });
  for (const s of args[1].split(',')) { const t0 = Date.now(); fs.writeFileSync(path.join(args[2], `t${s}.jpg`), await grab(parseFloat(s))); console.log(s, Date.now() - t0, 'ms'); }
} else {
  const [a, b, outFile] = [parseInt(args[0]), parseInt(args[1]), args[2]];
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', '-',
    '-vf', 'scale=1080:1920:flags=lanczos', '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', '30', outFile], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let f = a; f < b; f++) {
    const buf = await grab((f + 0.5) / 30);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if ((f - a) % 30 === 0) console.log(`kare ${f}/${b}  ${((Date.now() - t0) / (f - a + 1)).toFixed(0)} ms/kare`);
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r));
}
await browser.close(); server.close();
