// Deterministic frame renderer -> ffmpeg (H.264, 9:16).
// node tools/render.mjs --out out/ep01.mp4 [--scale 1] [--fps 24] [--sub 4]
//        [--from 0] [--to <dur>] [--quality 0.95] [--audio out/ep01.wav]
// Also writes <out>.cues.json, <out>.srt and <out>.log.json (timings).
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { startServer } from './serve.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]] : a), []));
const out = args.out || 'out/ep01.mp4';
const scale = +(args.scale || 1), fps = +(args.fps || 24), sub = +(args.sub ?? 0), quality = +(args.quality || 0.94);
fs.mkdirSync(path.dirname(out), { recursive: true });

const srv = await startServer(0);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=vulkan', '--enable-features=Vulkan', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('[pageerror]', e.message));
const tInit = Date.now();
await page.goto(`http://127.0.0.1:${srv.address().port}/player.html?render=1&scale=${scale}`);
await page.waitForFunction('window.__ready === true', null, { timeout: 600000 });
const meta = await page.evaluate(() => ({ duration: window.__api.duration, size: window.__api.size, shots: window.__api.shots }));
const initMs = Date.now() - tInit;
const from = +(args.from || 0), to = Math.min(+(args.to || meta.duration), meta.duration);
const n = Math.round((to - from) * fps);
console.log(`init ${initMs} ms · ${meta.size.join('x')} · ${n} frames @${fps} · subframes ${sub}`);

// side outputs
const base = out.replace(/\.mp4$/, '');
const cues = await page.evaluate(() => window.__api.cues());
fs.writeFileSync(base + '.cues.json', JSON.stringify({ duration: meta.duration, shots: meta.shots, cues }, null, 1));
const subs = await page.evaluate(() => window.__api.subtitles());
const ts = (x) => { const ms = Math.round(x * 1000); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
fs.writeFileSync(base + '.srt', subs.map((s, i) => `${i + 1}\n${ts(s.start)} --> ${ts(s.end)}\n${s.style === 'thought' ? '<i>' + s.text + '</i>' : s.text}\n`).join('\n'));

const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
  ...(args.upscale ? ['-vf', `scale=${args.upscale}:flags=lanczos`] : []),
  '-c:v', 'libx264', '-preset', 'slow', '-crf', scale >= 0.6 ? '17' : '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', base + '.video.mp4'], { stdio: ['pipe', 'inherit', 'inherit'] });

const times = [];
const t0 = Date.now();
for (let i = 0; i < n; i++) {
  const F = from + (i + 0.5) / fps;
  // per-shot motion blur: fast-action shots request sub-frames, others render one
  const r = await page.evaluate(([F, sub]) => { const s = window.__film.shotAt(F); return window.__api.renderFrame(F, { subframes: sub > 0 ? sub : s.subframes || 1 }); }, [F, sub]);
  const d = await page.evaluate((q) => window.__api.grab(q), quality);
  const buf = Buffer.from(d.slice(d.indexOf(',') + 1), 'base64');
  if (!ff.stdin.write(buf)) await new Promise((res) => ff.stdin.once('drain', res));
  times.push(r.ms);
  if (i % 24 === 0 || i === n - 1) {
    const el = (Date.now() - t0) / 1000;
    console.log(`frame ${i + 1}/${n} F=${F.toFixed(2)} ${r.shot} · ${r.ms.toFixed(0)} ms · elapsed ${el.toFixed(0)} s · eta ${((el / (i + 1)) * (n - i - 1)).toFixed(0)} s`);
  }
}
ff.stdin.end();
await new Promise((res) => ff.on('close', res));
const total = (Date.now() - t0) / 1000;
const avg = times.reduce((a, b) => a + b, 0) / times.length;
const log = { out, scale, fps, subframes: sub, frames: n, size: meta.size, initMs, totalSec: total, avgFrameMs: avg, maxFrameMs: Math.max(...times), perFrameWallMs: (total * 1000) / n };
fs.writeFileSync(base + '.log.json', JSON.stringify(log, null, 1));
console.log('render done', JSON.stringify(log));

// mux audio if provided, otherwise keep the silent video as the output
if (args.audio && fs.existsSync(args.audio)) {
  await new Promise((res) => spawn('ffmpeg', ['-y', '-loglevel', 'error', '-i', base + '.video.mp4', '-i', args.audio, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', out], { stdio: 'inherit' }).on('close', res));
} else fs.copyFileSync(base + '.video.mp4', out);
await browser.close();
srv.close();
