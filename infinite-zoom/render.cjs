// Renders index.html frame by frame (deterministic render(t)) into an MP4 with ffmpeg.
// Usage: NODE_PATH=$(npm root -g) node render.cjs <out.mp4> [fps=30] [seconds=30]
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const path = require('node:path');

const here = __dirname;
const out = process.argv[2] ?? 'out.mp4';
const fps = Number(process.argv[3] ?? 30);
const seconds = Number(process.argv[4] ?? 30);
const frames = Math.round(fps * seconds);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.join(here, 'index.html'));

  const ff = spawn('ffmpeg', [
    '-y', '-v', 'error',
    '-f', 'image2pipe', '-c:v', 'png', '-framerate', String(fps), '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', '-r', String(fps), out,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });

  const started = Date.now();
  for (let i = 0; i < frames; i++) {
    await page.evaluate((tt) => window.render(tt), i / fps);
    const png = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1080, height: 1920 } });
    if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % 150 === 0) console.log(`frame ${i}/${frames} (${((Date.now() - started) / 1000).toFixed(1)} s)`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  await browser.close();
  console.log(`done -> ${out} in ${((Date.now() - started) / 1000).toFixed(1)} s`);
})().catch((e) => { console.error(e); process.exit(1); });
