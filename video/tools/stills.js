// Kullanım: node stills.js out_dir t1 t2 ...
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => {
  const [out, ...ts] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + path.resolve(__dirname, '../index.html') + '?render=1'); await p.waitForFunction(() => window.READY);
  for (const t of ts) {
    const d = await p.evaluate(t => { render(+t); return document.getElementById('c').toDataURL('image/jpeg', .85); }, t);
    fs.writeFileSync(path.join(out, `t${(+t).toFixed(1).padStart(5, '0')}.jpg`), Buffer.from(d.split(',')[1], 'base64'));
  }
  if (errs.length) console.log('ERR', errs.slice(0, 5)); await b.close();
})();
