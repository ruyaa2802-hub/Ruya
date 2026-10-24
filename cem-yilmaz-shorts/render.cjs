// Renders index.html frame-by-frame (deterministic render(t)) into an MP4 with ffmpeg.
// Usage: node render.cjs <out.mp4> [fps=30] [seconds=60]
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const path = require('node:path');

const here = __dirname;
const out = process.argv[2] ?? 'out.mp4';
const fps = Number(process.argv[3] ?? 30);
const seconds = Number(process.argv[4] ?? 60);
const frames = Math.round(fps * seconds);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  // HOST_DIR: folder with the Blender host frames (host_0549.png ...); defaults to ./host
  const hostDir = process.env.HOST_DIR ? 'file://' + path.resolve(process.env.HOST_DIR) : 'host';
  await page.addInitScript((dir) => { window.HOST_DIR = dir; }, hostDir);
  await page.goto('file://' + path.join(here, 'index.html'));
  await page.evaluate(() => document.fonts.ready);

  const ff = spawn('ffmpeg', [
    '-y', '-v', 'error',
    '-f', 'image2pipe', '-c:v', 'png', '-framerate', String(fps), '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', '-r', String(fps), out,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });

  for (let i = 0; i < frames; i++) {
    const t = i / fps;
    await page.evaluate((tt) => window.render(tt), t);
    const png = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1080, height: 1920 } });
    if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % 300 === 0) console.log(`frame ${i}/${frames}`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  await browser.close();
  console.log('done ->', out);
})().catch((e) => { console.error(e); process.exit(1); });
