// DJ Hamam karakter paketini üretir: dj-hamam.svg (dinlenme pozu), poses/*.svg ve sheet.html
import fs from "node:fs";
import { djHamam } from "./dj-hamam.mjs";
fs.mkdirSync("poses", { recursive: true });
const POSES = {
  "01-ukala":     { title: "Ukala gülüş", pose: { brow: -8, head: 3, antL: 8, antR: -10, armL: 24, armR: 22 } },
  "02-anons":     { title: "Anons (konuşma)", pose: { mouth: 0.9, armL: 150, armR: 150, foreL: 20, foreR: 20, head: -6, brow: 10, antL: -16, antR: 16, hp: 1.06 } },
  "03-sok":       { title: "Şok (gözlük kayar)", pose: { glassY: 34, browY: -14, brow: -10, mouth: 0.7, armL: 40, armR: 130, foreR: 30, legL: 14, shinL: -18, antL: 22, antR: -24, bodyRot: -4 } },
  "04-suclayici": { title: "Suçlayıcı", pose: { armR: 125, foreR: -10, armL: 30, brow: 22, mouth: 0.35, glassY: 10, head: -8, bodyRot: -3 } },
  "05-dans":      { title: "Dans", pose: { legL: 26, shinL: -34, armL: 165, armR: 70, foreR: 40, bodyRot: 7, head: -9, mouth: 0.3, chain: 14, antL: 18, antR: -18, hp: 1.06 } },
  "06-cool":      { title: "Havalı (kulaklık)", pose: { armL: 128, foreL: 70, armR: 18, head: 9, hp: 1.1, brow: -10, antL: 12, antR: -6, bodyRot: 2 } },
};
fs.writeFileSync("dj-hamam.svg", djHamam("dj", { w: 400 }, POSES["01-ukala"].pose));
let cells = "";
for (const [k, v] of Object.entries(POSES)) {
  const svg = djHamam("dj" + k.slice(0, 2), { w: 330 }, v.pose);
  fs.writeFileSync(`poses/${k}.svg`, svg);
  cells += `<div class="c">${svg}<div class="l">${v.title}</div></div>`;
}
const sw = [["#c07a42", "Kabuk açık"], ["#6a3418", "Kabuk orta"], ["#2a1008", "Kabuk koyu"], ["#e0a35a", "Karın"], ["#ff3fd0", "Neon pembe"], ["#34e0ff", "Neon camgöbeği"], ["#8d5bff", "Neon mor"], ["#ffd23f", "Altın"]]
  .map(([c, n]) => `<div class="sw"><i style="background:${c}"></i>${n}<br><b>${c}</b></div>`).join("");
fs.writeFileSync("sheet.html", `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:radial-gradient(ellipse at 50% 0,#3a1c6a,#0d0620);color:#fff;font-family:Nunito,"DejaVu Sans",sans-serif;width:1500px}
h1{margin:0;padding:30px 40px 0;font:900 64px "DejaVu Sans",sans-serif;letter-spacing:2px;background:none}
h1 span{color:#ff3fd0}.sub{padding:4px 40px 10px;color:#9ff0ff;font-weight:800;font-size:24px}
.g{display:grid;grid-template-columns:repeat(3,1fr);gap:0 10px;padding:10px 40px}
.c{text-align:center;padding:90px 0 30px}.c svg{height:560px;width:auto}.l{font-weight:900;font-size:28px;margin-top:6px;color:#ffd23f}
.p{display:flex;gap:14px;padding:6px 40px 30px;flex-wrap:wrap}.sw{font-size:16px;font-weight:700;width:150px}.sw i{display:block;height:36px;border-radius:10px;border:3px solid #fff3;margin-bottom:4px}
</style><h1>DJ <span>HAMAM</span></h1><div class="sub">Ana karakter · antropomorfik hamam böceği · gece vardiyasının DJ'i</div>
<div class="g">${cells}</div><div class="p">${sw}</div>`);
console.log("ok");
