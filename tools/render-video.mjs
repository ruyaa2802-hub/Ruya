// studio.html'i arka planda açar, her kareyi deterministik olarak çizer ve
// ffmpeg ile 1080x1920, 30 fps H.264 MP4 üretir. Tamamen ücretsiz, çevrimdışı.
// Kullanım: node tools/render-video.mjs [bolum] [cikti.mp4] [fps]
// Gereken: Node 18+, `npm i -g playwright` (veya yerel), `npx playwright install chromium`, ffmpeg.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [bolum = 'kedi', out = `cikti/${bolum}-portresi.mp4`, fpsArg = '30'] = process.argv.slice(2);
const fps = +fpsArg;
await import('node:fs').then(fs => fs.mkdirSync(dirname(resolve(root, out)), { recursive: true }));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
page.on('pageerror', e => { console.error('Sayfa hatası:', e.message); process.exit(1); });
await page.goto(pathToFileURL(resolve(root, 'studio.html')).href + `?export=1&bolum=${bolum}`);
await page.waitForFunction(() => window.studio, null, { timeout: 120000 });
const duration = await page.evaluate(() => studio.ep.duration);
const frames = Math.round(duration * fps) + 1;

const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', resolve(root, out)], { stdio: ['pipe', 'inherit', 'inherit'] });

const t0 = Date.now();
for (let f = 0; f < frames; f++) {
  const b64 = await page.evaluate(([t, dt]) => { studio.renderAt(t, dt); return document.getElementById('screen').toDataURL('image/jpeg', 0.94).split(',')[1]; }, [f / fps, f ? 1 / fps : 0]);
  if (!ff.stdin.write(Buffer.from(b64, 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
  if (f % fps === 0) process.stdout.write(`\r${(f / fps).toFixed(0)} / ${duration} sn  (${((Date.now() - t0) / 1000).toFixed(0)} sn geçti)`);
}
ff.stdin.end();
await new Promise(r => ff.on('close', r));
await browser.close();
console.log(`\nHazır: ${out}  (${frames} kare, ${fps} fps)`);
