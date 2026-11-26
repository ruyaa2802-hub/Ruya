// Tüm kareleri çizer ve FFmpeg ile sessiz video üretir. Kullanım: node render.js [çıktı.mp4] [paralel=3]
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const path = require('path'); const fs = require('fs');
const OUT = path.resolve(process.argv[2] || path.join(__dirname, '../build/video_sessiz.mp4')); const PAR = +(process.argv[3] || 3);
(async () => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const b = await chromium.launch(); const url = 'file://' + path.resolve(__dirname, '../index.html') + '?render=1';
  const pg = await b.newPage(); await pg.goto(url); const { DUR, FPS } = await pg.evaluate(() => ({ DUR, FPS })); await pg.close();
  const N = Math.round(DUR * FPS), per = Math.ceil(N / PAR); const parts = [];
  await Promise.all([...Array(PAR)].map(async (_, k) => {
    const part = OUT.replace(/\.mp4$/, `_p${k}.mp4`); parts[k] = part;
    const p = await b.newPage({ viewport: { width: 1080, height: 1920 } }); await p.goto(url); await p.waitForFunction(() => window.READY);
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS), part]);
    const done = new Promise(r => ff.on('close', r));
    for (let f = k * per; f < Math.min(N, (k + 1) * per); f++) {
      const d = await p.evaluate(t => { render(t); return document.getElementById('c').toDataURL('image/jpeg', .95); }, f / FPS);
      if (!ff.stdin.write(Buffer.from(d.split(',')[1], 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
      if (f % 150 === 0) console.log(`parça ${k}: kare ${f}/${N}`);
    }
    ff.stdin.end(); await done; await p.close();
  }));
  await b.close();
  const list = OUT + '.txt'; fs.writeFileSync(list, parts.map(p => `file '${p}'`).join('\n'));
  await new Promise(r => spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', OUT], { stdio: 'inherit' }).on('close', r));
  parts.forEach(p => fs.unlinkSync(p)); fs.unlinkSync(list); console.log('Bitti:', OUT);
})();
