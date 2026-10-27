// Belirli saniyelerdeki kareleri PNG olarak kaydeder (görsel kontrol için).
// Kullanım: node tools/snap.mjs <çıktı-klasörü> 5 14 30 42
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [out, ...times] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
page.on('console', m => console.log('[sayfa]', m.text()));
page.on('pageerror', e => console.log('[HATA]', e.message));
await page.goto(pathToFileURL(resolve(root, 'studio.html')).href + '?export=1');
await page.waitForFunction(() => window.studio, null, { timeout: 120000 });
console.log(await page.evaluate(() => ({ build: studio.buildMs, strokes: studio.strokeCount })));
// gerçek oynatmadaki gibi ileri doğru kare kare ilerle (kalem yumuşatması için)
let cur = 0;
for (const t of times.map(Number).sort((a, b) => a - b)) {
  const ms = await page.evaluate(([a, b]) => { const s = performance.now(); for (let x = a; x <= b; x += 1 / 30) studio.renderAt(x, 1 / 30); studio.renderAt(b, 1 / 30); return performance.now() - s; }, [cur, t]);
  cur = t;
  const data = await page.evaluate(() => document.getElementById('screen').toDataURL('image/png'));
  writeFileSync(`${out}/t${String(t).padStart(5, '0')}.png`, Buffer.from(data.split(',')[1], 'base64'));
  console.log('kare', t, Math.round(ms) + 'ms');
}
await browser.close();
