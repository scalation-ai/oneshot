// node ref.cjs <video> <outDir>   (film.sh ref <video>)   reads a reference film in numbers, before a script is written
// against it: where it cuts, how long its shots are and how much they vary, how much of it is still, when it moves.
// Watching once does not tell you that a film is a third still, or that its cuts come in two bursts; these numbers do,
// and the film you make should land near them (or depart from them on purpose).
// It decodes the video small and grey (ffmpeg), measures how much each frame differs from the one before, and finds:
//   cuts      frames that differ from the last far more than their neighbours do (a hard cut, not a fast move)
//   shots     the lengths between cuts, and their variation (standard deviation over mean)
//   bursts    three or more cuts inside 1.5 s
//   still     the share of frames that barely differ from the last, and the longest still stretch
//   energy    the motion over time, in eighths of the film, so you can see where it rests and where it hits
// Writes <outDir>/ref.json, <outDir>/ref.html (the energy curve, the cuts, a frame every half second) and prints a summary.
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs'), path = require('path');
const [,, video, outDir] = process.argv;
if (!video || !outDir) { console.log('usage: node ref.cjs <video> <outDir>'); process.exit(1); }
let FF = process.env.FFMPEG;
if (!FF) try { FF = require(path.join(__dirname, '..', 'node_modules', 'ffmpeg-static')); } catch (e) {}
if (!FF || !fs.existsSync(FF)) { console.error('ffmpeg not found. Run the engine setup once: bash setup.sh'); process.exit(1); }
if (!fs.existsSync(video)) { console.error(`'${video}' is not a file`); process.exit(1); }
fs.mkdirSync(outDir, { recursive: true });

// the video's size, rate and length, from ffmpeg's own header
const info = spawnSync(FF, ['-hide_banner', '-i', video], { encoding: 'utf8' }).stderr;
const dm = info.match(/Duration: (\d+):(\d+):([\d.]+)/), vm = info.match(/Video:.*?(\d{2,5})x(\d{2,5})/), fm = info.match(/([\d.]+) fps/);
if (!dm || !vm) { console.error('ffmpeg could not read a video stream from it'); process.exit(1); }
const dur = +dm[1] * 3600 + +dm[2] * 60 + +dm[3], VW = +vm[1], VH = +vm[2], FPS = Math.min(60, Math.round(fm ? +fm[1] : 30));
const SW = 96, SH = Math.max(2, Math.round(SW * VH / VW / 2) * 2);
const raw = spawnSync(FF, ['-v', 'error', '-i', video, '-vf', `fps=${FPS},scale=${SW}:${SH}:flags=area,format=gray`, '-f', 'rawvideo', '-'],
  { maxBuffer: 1 << 30 }).stdout;
const px = SW * SH, N = Math.floor(raw.length / px);
if (N < 3) { console.error('too few frames decoded'); process.exit(1); }
const diff = new Float64Array(N);   // mean absolute change from the frame before, 0 to 255
for (let i = 1; i < N; i++) { let s = 0; const a = (i - 1) * px, b = i * px; for (let k = 0; k < px; k++) s += Math.abs(raw[b + k] - raw[a + k]); diff[i] = s / px; }

// a cut: a frame whose change is large on its own and several times the change of the frames around it
const cuts = [];
for (let i = 2; i < N - 1; i++) {
  const around = [diff[i - 2], diff[i - 1], diff[i + 1], i + 2 < N ? diff[i + 2] : diff[i + 1]].sort((x, y) => x - y)[1];
  if (diff[i] > 18 && diff[i] > 3 * Math.max(around, 1.5)) { if (!cuts.length || i - cuts[cuts.length - 1] > FPS * 0.12) cuts.push(i); }
}
const cutT = cuts.map(i => +(i / FPS).toFixed(3));
const marks = [0, ...cutT, dur], shots = marks.slice(1).map((m, i) => +(m - marks[i]).toFixed(3)).filter(x => x > 0.05);
const mean = shots.reduce((s, x) => s + x, 0) / shots.length;
const cv = shots.length > 1 ? Math.sqrt(shots.reduce((s, x) => s + (x - mean) ** 2, 0) / shots.length) / mean : null;
const bursts = []; for (let i = 0; i < cutT.length; i++) { let j = i; while (j + 1 < cutT.length && cutT[j + 1] - cutT[i] <= 1.5) j++;
  if (j - i + 1 >= 3) { bursts.push({ from: cutT[i], to: cutT[j], cuts: j - i + 1 }); i = j; } }
// still: under 0.1 of 255 per pixel, on average, at 96 px wide. Measured on two accepted films (Custom Reports, paylark):
// a quarter of their frames are exactly 0, a slow drift sits at 0.1 to 0.3, so 0.1 counts dead still and nothing else
const STILL = 0.1, still =Array.from(diff, (d, i) => i > 0 && d < STILL && !cuts.includes(i));
const stillShare = still.filter(Boolean).length / (N - 1);
let run = 0, longest = 0, longestEnd = 0; still.forEach((s, i) => { run = s ? run + 1 : 0; if (run > longest) { longest = run; longestEnd = i; } });
const motion = Array.from(diff, (d, i) => cuts.includes(i) ? 0 : d);
const eighths = Array.from({ length: 8 }, (_, k) => { const a = Math.floor(k * N / 8), b = Math.floor((k + 1) * N / 8);
  let s = 0; for (let i = a; i < b; i++) s += motion[i]; return +(s / Math.max(1, b - a)).toFixed(2); });

// a frame every half second, for the page
const sheet = path.join(outDir, 'frames'); fs.rmSync(sheet, { recursive: true, force: true }); fs.mkdirSync(sheet);
spawnSync(FF, ['-v', 'error', '-i', video, '-vf', `fps=2,scale=${VW >= VH ? 240 : 120}:-2`, '-q:v', '4', path.join(sheet, 'f%04d.jpg')]);
const frames = fs.readdirSync(sheet).filter(f => f.endsWith('.jpg')).sort();

const R = { video: path.resolve(video), size: [VW, VH], fps: FPS, dur: +dur.toFixed(3), cuts: cutT, shots, cv: cv == null ? null : +cv.toFixed(2),
  bursts, still: +stillShare.toFixed(2), longestStill: +(longest / FPS).toFixed(2), longestStillEnds: +(longestEnd / FPS).toFixed(2), energyByEighth: eighths };
fs.writeFileSync(path.join(outDir, 'ref.json'), JSON.stringify(R, null, 1));
fs.writeFileSync(path.join(outDir, 'ref.html'), page(R, motion, frames));
const sh = shots.length ? `${Math.min(...shots).toFixed(2)} to ${Math.max(...shots).toFixed(2)} s` : '-';
console.log(`ref ${path.basename(video)}  ${VW}x${VH}, ${FPS} fps, ${dur.toFixed(2)} s`);
console.log(`  cuts     ${cutT.length}${cutT.length ? ' at ' + cutT.map(t => t.toFixed(2)).join(', ') : ''}`);
console.log(`  bursts   ${bursts.length ? bursts.map(b => `${b.cuts} cuts ${b.from.toFixed(2)}-${b.to.toFixed(2)} s`).join('; ') : 'none'}`);
console.log(`  shots    ${shots.length}, ${sh}${cv != null ? ', variation ' + cv.toFixed(2) : ''}`);
console.log(`  still    ${(stillShare * 100).toFixed(0)}% of the film, longest ${(longest / FPS).toFixed(2)} s (ending ${(longestEnd / FPS).toFixed(2)} s)`);
console.log(`  energy   by eighths of the film: ${eighths.join('  ')}`);
console.log('page:', path.join(outDir, 'ref.html'));

function page(R, motion, frames) {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const n = motion.length, top = Math.max(4, ...motion), X = i => i / (n - 1) * 1000;
  const d = Array.from(motion, (v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${(90 - Math.min(v, top) / top * 82).toFixed(1)}`).join('');
  const cl = R.cuts.map(t => `<line x1="${t / R.dur * 1000}" x2="${t / R.dur * 1000}" y1="0" y2="92"/>`).join('');
  const secs = Array.from({ length: Math.floor(R.dur) + 1 }, (_, s) => `<text x="${s / R.dur * 1000}" y="106">${s}</text>`).join('');
  const imgs = frames.map((f, i) => `<figure><img src="frames/${f}" alt=""><figcaption>${(i * 0.5).toFixed(1)} s</figcaption></figure>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reference: ${esc(path.basename(R.video))}</title><style>
:root{--bg:#f6f6f3;--surf:#fff;--ink:#17181c;--muted:#666a73;--line:#e3e3de;--cut:#c62f2f}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#111214;--surf:#1a1b1e;--ink:#ecedf0;--muted:#9a9ea7;--line:#2b2d31;--cut:#ef6a6a}}
:root[data-theme="dark"]{--bg:#111214;--surf:#1a1b1e;--ink:#ecedf0;--muted:#9a9ea7;--line:#2b2d31;--cut:#ef6a6a}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
main{max-width:1180px;margin:0 auto;padding:28px 16px 60px}h1{font-size:22px;margin:0}.sub{color:var(--muted);margin:2px 0 18px}
dl{display:grid;grid-template-columns:max-content 1fr;gap:6px 16px;background:var(--surf);border:1px solid var(--line);border-radius:10px;padding:14px 16px;margin:0}dt{font-weight:600}dd{margin:0}
.tl{background:var(--surf);border:1px solid var(--line);border-radius:10px;padding:12px;margin-top:16px}svg{width:100%;height:auto;display:block;overflow:visible}
path{fill:none;stroke:var(--ink);stroke-width:1.3}line{stroke:var(--cut);stroke-width:2}text{fill:var(--muted);font-size:10px;text-anchor:middle}
.grid{display:flex;flex-wrap:wrap;gap:6px;margin-top:16px}figure{margin:0}img{display:block;height:${R.size[0] >= R.size[1] ? 90 : 160}px;border-radius:4px;border:1px solid var(--line)}figcaption{font-size:12px;color:var(--muted);text-align:center}
</style></head><body><main><h1>${esc(path.basename(R.video))}</h1><p class="sub">${R.size.join(' x ')}, ${R.fps} fps, ${R.dur.toFixed(2)} s</p>
<dl><dt>cuts</dt><dd>${R.cuts.length}${R.cuts.length ? ': ' + R.cuts.map(t => t.toFixed(2)).join(', ') + ' s' : ''}</dd>
<dt>bursts</dt><dd>${R.bursts.length ? R.bursts.map(b => `${b.cuts} cuts, ${b.from.toFixed(2)}-${b.to.toFixed(2)} s`).join('; ') : 'none'}</dd>
<dt>shots</dt><dd>${R.shots.length}: ${R.shots.map(s => s.toFixed(2)).join(', ')} s${R.cv != null ? `, variation ${R.cv.toFixed(2)}` : ''}</dd>
<dt>still</dt><dd>${(R.still * 100).toFixed(0)}% of the film, longest ${R.longestStill.toFixed(2)} s, ending at ${R.longestStillEnds.toFixed(2)} s</dd>
<dt>energy</dt><dd>by eighths: ${R.energyByEighth.join(', ')}</dd></dl>
<div class="tl"><svg viewBox="-4 -4 1012 116">${cl}<path d="${d}"/>${secs}</svg></div><div class="grid">${imgs}</div></main></body></html>`;
}
