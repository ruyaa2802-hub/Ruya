// kullanım: node render.js <worker> <nworkers> <outdir> [w h fps start end]
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const [wi, nw, out] = [+process.argv[2], +process.argv[3], process.argv[4]];
  const W = +(process.argv[5] || 1080), H = +(process.argv[6] || 1920), FPS = +(process.argv[7] || 30);
  const F0 = +(process.argv[8] || 0), F1 = +(process.argv[9] || 30 * FPS);
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: W, height: H } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto(`http://localhost:8765/ep1.html?w=${W}&h=${H}`); await p.waitForFunction('window.ready===true', null, { timeout: 180000 });
  for (let f = F0 + wi; f < F1; f += nw) {
    const fn = `${out}/f${String(f).padStart(4, '0')}.jpg`; if (fs.existsSync(fn)) continue;
    const t0 = Date.now(); await p.evaluate(t => window.renderFrame(t), f / FPS);
    const d = await p.evaluate(() => window.grab(0.94)); fs.writeFileSync(fn, Buffer.from(d.split(',')[1], 'base64'));
    if (f % 40 === wi) console.log(`w${wi} f${f} ${Date.now() - t0}ms`);
  }
  await b.close();
})();
