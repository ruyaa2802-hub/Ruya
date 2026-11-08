const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 720, height: 1280 } });
  await p.goto('http://127.0.0.1:8205/index.html'); await p.waitForFunction(() => window.READY || window.ERR, null, { timeout: 300000 });
  const ev = await p.evaluate(() => window.events());
  fs.writeFileSync(__dirname + '/events.json', JSON.stringify(ev)); console.log(ev.length, ev.filter((e) => e.vis).length); await b.close();
})();
