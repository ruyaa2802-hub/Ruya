#!/usr/bin/env node
// Ruya Studio render aracı — tamamen yerel: Chromium (Playwright) + FFmpeg. Kredi/API kullanmaz.
//
//   node studio/render.mjs <video>             → sessiz önizleme   (cikti/onizleme.mp4)
//   node studio/render.mjs <video> --final     → ses + altyazı + müzik (cikti/final.mp4)
//   node studio/render.mjs <video> --kare 3,12.5  → kontrol kareleri (cikti/kareler/*.png)
//   seçenekler: --isci 4  (paralel tarayıcı sayfası)   --hizli (540x960 taslak)
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { zamanlamaOlustur } from './zamanlama.mjs';
import { sesYatagiUret } from './ses.mjs';

const require = createRequire(import.meta.url);
const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const arg = process.argv.slice(2);
const video = arg.find(a => !a.startsWith('--') && !/^[\d.,]+$/.test(a));
const bayrak = (b) => arg.includes(b);
const deger = (b, v) => { const i = arg.indexOf(b); return i >= 0 ? arg[i + 1] : v; };
if (!video) { console.error('Kullanım: node studio/render.mjs <video-klasörü> [--final] [--kare 1,2] [--isci 4]'); process.exit(1); }

const VDIR = path.join(KOK, 'videolar', video);
const CIKTI = path.join(VDIR, 'cikti');
fs.mkdirSync(CIKTI, { recursive: true });
const senaryo = JSON.parse(fs.readFileSync(path.join(VDIR, 'senaryo.json'), 'utf8'));

function sesBul() {
  const d = path.join(VDIR, 'ses');
  if (!fs.existsSync(d)) return null;
  const f = fs.readdirSync(d).find(f => /^seslendirme\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(f));
  return f ? path.join(d, f) : null;
}

const final = bayrak('--final');
const ses = final ? sesBul() : null;
if (final && !ses) {
  console.error(`\n✋ Ses dosyası bulunamadı: videolar/${video}/ses/seslendirme.mp3\n   ElevenLabs'ten indirdiğin dosyayı bu ada/konuma yükle, sonra tekrar çalıştır.\n`);
  process.exit(2);
}

const TL = zamanlamaOlustur(senaryo, ses);
fs.writeFileSync(path.join(CIKTI, 'zamanlama.json'), JSON.stringify(TL, null, 1));
fs.writeFileSync(path.join(CIKTI, 'zamanlama.js'), 'window.__ZAMANLAMA__ = ' + JSON.stringify(TL) + ';\n');
console.log(`⏱  Zamanlama (${TL.kaynak}): toplam ${TL.toplam.toFixed(2)} sn`);
for (const b of TL.bolumler) console.log(`   ${b.id.padEnd(8)} ${b.start.toFixed(2)} → ${b.end.toFixed(2)}  (${b.cumleler.length} cümle)`);

const { chromium } = require('playwright');
const URL_ = pathToFileURL(path.join(KOK, 'studio', 'player.html')).href + `?v=${encodeURIComponent(video)}&render`;

async function sayfaAc(tarayici, olcek) {
  const sayfa = await tarayici.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  sayfa.on('pageerror', e => console.error('Sayfa hatası:', e.message));
  await sayfa.goto(URL_);
  await sayfa.waitForFunction(() => window.__hazir || window.__hata, null, { timeout: 120000 });
  const hata = await sayfa.evaluate(() => window.__hata);
  if (hata) throw new Error(hata);
  return sayfa;
}

const tarayici = await chromium.launch({ args: ['--disable-gpu-vsync', '--force-color-profile=srgb'] });

try {
  // --- Kontrol kareleri ---
  if (deger('--kare')) {
    const zamanlar = deger('--kare').split(',').map(Number);
    const kd = path.join(CIKTI, 'kareler'); fs.mkdirSync(kd, { recursive: true });
    const sayfa = await sayfaAc(tarayici);
    for (const t of zamanlar) {
      const url = await sayfa.evaluate(t => STUDIO.karePng(t), t);
      const f = path.join(kd, `kare-${t.toFixed(2).padStart(6, '0')}.png`);
      fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));
      console.log('🖼  ' + path.relative(KOK, f));
    }
    process.exit(0);
  }

  // --- Video render (paralel parçalar) ---
  const fps = TL.fps, N = Math.round(TL.toplam * fps);
  const isci = Math.max(1, parseInt(deger('--isci', '4'), 10));
  const hizli = bayrak('--hizli');
  const parcaBoy = 90; // küçük parçalar + iş kuyruğu = dengeli yük
  const parcaSayisi = Math.ceil(N / parcaBoy);
  const gecici = fs.mkdtempSync(path.join(CIKTI, '.parca-'));
  const basla = Date.now();
  let biten = 0, siradaki = 0;
  const sayfalar = await Promise.all(Array.from({ length: isci }, () => sayfaAc(tarayici)));

  async function parcaRender(sayfa, k) {
    const a = k * parcaBoy, b = Math.min(N, a + parcaBoy);
    const dosya = path.join(gecici, `p${String(k).padStart(4, '0')}.mp4`);
    const vf = hizli ? ['-vf', 'scale=540:960'] : [];
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
      ...vf, '-c:v', 'libx264', '-preset', hizli ? 'veryfast' : 'medium', '-crf', hizli ? '27' : '21',
      '-maxrate', hizli ? '3M' : '9M', '-bufsize', hizli ? '6M' : '18M', '-pix_fmt', 'yuv420p',
      '-profile:v', 'high', '-g', String(fps * 2), '-r', String(fps), dosya], { stdio: ['pipe', 'inherit', 'inherit'] });
    const bitti = new Promise((ok, hata) => ff.on('close', c => c === 0 ? ok() : hata(new Error('ffmpeg ' + c))));
    for (let f = a; f < b; f++) {
      const url = await sayfa.evaluate(t => STUDIO.kareJpeg(t, 0.94), f / fps);
      const buf = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      biten++;
      if (biten % 60 === 0) {
        const gecen = (Date.now() - basla) / 1000;
        process.stdout.write(`\r🎬 ${biten}/${N} kare  (${(biten / gecen).toFixed(1)} kare/sn, kalan ~${Math.round((N - biten) / (biten / gecen))} sn)   `);
      }
    }
    ff.stdin.end();
    await bitti;
    return dosya;
  }
  const dosyalar = new Array(parcaSayisi);
  await Promise.all(sayfalar.map(async sayfa => {
    while (siradaki < parcaSayisi) { const k = siradaki++; dosyalar[k] = await parcaRender(sayfa, k); }
  }));
  const parcalar = dosyalar;
  console.log(`\n✅ ${N} kare ${((Date.now() - basla) / 1000).toFixed(0)} sn'de çizildi`);
  const liste = path.join(gecici, 'liste.txt');
  fs.writeFileSync(liste, parcalar.map(p => `file '${p}'`).join('\n'));
  const sessiz = final ? path.join(gecici, 'goruntu.mp4') : path.join(CIKTI, hizli ? 'onizleme-taslak.mp4' : 'onizleme.mp4');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', liste, '-c', 'copy', '-movflags', '+faststart', sessiz]);

  if (final) {
    // Müzik + efekt yatağı (yerel sentez), anlatım üstüne sidechain ile alçaltılır
    const yatak = path.join(gecici, 'yatak.wav');
    sesYatagiUret(TL, yatak);
    const cikis = path.join(CIKTI, 'final.mp4');
    const gecikme = Math.round(TL.giris * 1000);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', sessiz, '-i', ses, '-i', yatak, '-filter_complex',
      `[1:a]aresample=48000,aformat=channel_layouts=stereo,${(TL.ses && TL.ses.anlatim) ? TL.ses.anlatim + ',' : ''}adelay=${gecikme}|${gecikme},apad,asplit=2[an][yan];` +
      `[2:a]aresample=48000,aformat=channel_layouts=stereo[ya];` +
      `[ya][yan]sidechaincompress=threshold=0.04:ratio=${(TL.ses && TL.ses.ducking) || 6}:attack=20:release=${(TL.ses && TL.ses.release) || 450}:makeup=1[yd];` +
      `[an][yd]amix=inputs=2:normalize=0:duration=longest,loudnorm=I=-14:TP=-1.5:LRA=11[a]`,
      '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
      '-t', TL.toplam.toFixed(3), '-movflags', '+faststart', cikis]);
    console.log('🎉 Final: ' + path.relative(KOK, cikis));
  } else {
    console.log('🎉 Sessiz önizleme: ' + path.relative(KOK, sessiz));
  }
  fs.rmSync(gecici, { recursive: true, force: true });
} finally {
  await tarayici.close();
}
