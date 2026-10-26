// Capture a still of a page: node tools/still.mjs "<path?query>" out.png [w h]
import { createRequire } from 'node:module';
import { startServer } from './serve.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const [, , url, out, w = 720, h = 1280] = process.argv;
const srv = await startServer(0);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=vulkan', '--enable-features=Vulkan', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text().slice(0, 400)); });
p.on('pageerror', (e) => console.log('[pageerror]', e.message));
const t0 = Date.now();
await p.goto(`http://127.0.0.1:${srv.address().port}/${url}`);
await p.waitForFunction('window.__ready === true', null, { timeout: 180000 });
await p.locator('canvas').first().screenshot({ path: out });
console.log('ok', out, (Date.now() - t0) + 'ms');
await b.close(); srv.close();
