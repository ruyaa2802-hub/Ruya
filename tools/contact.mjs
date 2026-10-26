// Contact sheet: middle frame of every shot -> one image (quick review).
// node tools/contact.mjs out.jpg [scale] [which=mid|start|end]
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { startServer } from './serve.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const [, , out = 'contact.jpg', scale = '0.3', which = 'mid', only = ''] = process.argv;
const srv = await startServer(0);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=vulkan', '--enable-features=Vulkan', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage();
p.on('pageerror', (e) => console.log('[pageerror]', e.message));
await p.goto(`http://127.0.0.1:${srv.address().port}/player.html?render=1&scale=${scale}`);
await p.waitForFunction('window.__ready === true', null, { timeout: 300000 });
const shots = await p.evaluate(() => window.__api.shots);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'contact-'));
const files = [];
for (const [i, s] of shots.entries()) {
  if (only && !only.split(',').includes(String(i))) continue;
  const f = which === 'start' ? s.film[0] + 0.05 : which === 'end' ? s.film[1] - 0.05 : (s.film[0] + s.film[1]) / 2;
  await p.evaluate((f) => window.__api.renderFrame(f, { subframes: 1 }), f);
  const d = await p.evaluate(() => window.__api.grab(0.9));
  const fn = path.join(dir, `s${String(i).padStart(2, '0')}.jpg`);
  fs.writeFileSync(fn, Buffer.from(d.split(',')[1], 'base64'));
  files.push(fn);
}
execFileSync('montage', [...files, '-tile', '8x', '-geometry', '+4+4', '-background', '#222', out]);
console.log('wrote', out, files.length, 'shots');
await b.close(); srv.close();
