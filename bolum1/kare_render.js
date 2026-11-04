// SVG karelerini Chromium ile JPEG'e çevirip doğrudan ffmpeg'e aktarır.
// Kullanım: node kare_render.js <kare_klasörü> <ses.wav> <çıktı.mp4>
const {chromium} = require('playwright');
const {spawn} = require('child_process');
const fs = require('fs'), path = require('path');
const [dir, wav, out] = process.argv.slice(2);
(async () => {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.svg')).sort();
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '24', '-c:v', 'mjpeg', '-i', '-',
    '-i', wav, '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out], {stdio: ['pipe', 'inherit', 'inherit']});
  const b = await chromium.launch();
  const p = await b.newPage({viewport: {width: 1080, height: 1920}});
  for (let i = 0; i < files.length; i++) {
    await p.goto('file://' + path.resolve(dir, files[i]));
    const buf = await p.screenshot({type: 'jpeg', quality: 93});
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 48 === 0) console.log('kare', i, '/', files.length);
  }
  await b.close();
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  console.log('bitti:', out);
})();
