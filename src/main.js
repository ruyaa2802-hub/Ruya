// Player + headless render API.
import { Film } from './film/film.js';
import episode from '../episodes/ep01_maas/episode.js';

const q = new URLSearchParams(location.search);
const renderMode = q.has('render');
const scale = +(q.get('scale') || (renderMode ? 1 : 0.5));
const W = Math.round(1080 * scale), H = Math.round(1920 * scale);

const film = new Film({ width: W, height: H, episode });
const canvas = film.fr.canvas;
(document.getElementById('stage') || document.body).appendChild(canvas);

// --- cue compilation: performance-time events -> film time through the EDL
function compileCues() {
  const ep = film.episode;
  const out = [];
  for (const s of ep.shots) {
    const len = s.film[1] - s.film[0];
    for (const c of ep.perfCues) {
      const dt = c.t - s.perf;
      const dur = c.dur || 0;
      if (dt + dur < 0 || dt >= len) continue;
      if (dt < 0 && !dur) continue;
      const start = Math.max(0, dt), offset = start - dt;
      out.push({ ...c, t: +(s.film[0] + start).toFixed(4), offset: +offset.toFixed(4), dur: dur ? Math.min(dur - offset, len - start) : 0, shot: s.name });
    }
  }
  for (const c of ep.filmCues) out.push({ ...c });
  return out.sort((a, b) => a.t - b.t);
}
// subtitles in film time by sampling what the evaluation shows
function compileSubtitles() {
  const ep = film.episode;
  const res = [];
  let cur = null;
  for (let F = 0; F <= film.duration; F += 1 / 48) {
    const s = film.shotAt(F);
    const P = film.perfTime(F, s);
    const sub = ep.subtitles.find((x) => P >= x.start && P <= x.end && !s.noSubs);
    const key = sub ? sub.text : null;
    if (key !== (cur && cur.text)) {
      if (cur) { cur.end = F; res.push(cur); }
      cur = key ? { text: key, style: sub.style, start: F } : null;
    }
  }
  if (cur) { cur.end = film.duration; res.push(cur); }
  return res.filter((r) => r.end - r.start > 0.2);
}

window.__api = {
  duration: film.duration,
  size: [W, H],
  shots: film.episode.shots.map((s) => ({ name: s.name, scene: s.scene, film: s.film, perf: s.perf })),
  beats: film.episode.beats,
  renderFrame(F, opts = {}) {
    const t0 = performance.now();
    const r = film.render(F, opts);
    film.fr.renderer.getContext().finish();
    return { ms: performance.now() - t0, scene: film.fr.stats.scene, post: film.fr.stats.post, shot: r.shot.name, P: r.Pt };
  },
  grab(quality = 0.95) { return canvas.toDataURL('image/jpeg', quality); },
  cues: compileCues,
  subtitles: compileSubtitles,
};
window.__film = film;
window.__ready = true;

// --- interactive player
if (!renderMode) {
  const scrub = document.getElementById('scrub'), play = document.getElementById('play'), info = document.getElementById('info');
  const marks = document.getElementById('marks');
  let lastScene = '';
  for (const s of film.episode.shots) {
    const m = document.createElement('span');
    m.style.left = (s.film[0] / film.duration) * 100 + '%';
    if (s.scene !== lastScene) m.className = 'scene';
    m.title = `${s.scene} · ${s.name}`;
    lastScene = s.scene;
    marks.appendChild(m);
  }
  let t = +(q.get('t') || 0), playing = false, last = performance.now();
  document.getElementById('q').value = String(scale);
  document.getElementById('q').onchange = (e) => { const u = new URL(location); u.searchParams.set('scale', e.target.value); u.searchParams.set('t', t.toFixed(2)); location = u; };
  play.onclick = () => { playing = !playing; play.textContent = playing ? '❚❚ Duraklat' : '▶ Oynat'; last = performance.now(); };
  scrub.oninput = () => { t = (scrub.value / 1000) * film.duration; draw(); };
  const mb = document.getElementById('mb');
  function draw() {
    const r = film.render(t, { subframes: mb.checked ? 4 : 1 });
    info.textContent = `${t.toFixed(2)} / ${film.duration.toFixed(2)} sn · ${r.shot.scene} · ${r.shot.name}`;
    scrub.value = Math.round((t / film.duration) * 1000);
  }
  function loop(now) {
    if (playing) {
      t += (now - last) / 1000;
      if (t >= film.duration) { t = 0; }
      draw();
    }
    last = now;
    requestAnimationFrame(loop);
  }
  draw();
  requestAnimationFrame(loop);
}
