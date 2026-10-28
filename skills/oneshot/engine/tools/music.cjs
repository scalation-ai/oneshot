// node music.cjs <track.mp3|wav> [out.json] [--bpm n]
// A music track in numbers, so a film can be cut to it: its tempo, the beat grid (where beat 0 falls), the bar lines
// (which beat of four is the downbeat), how loud each bar is, and where it changes: the bars the band comes in, thins
// out or drops. Printed as one line a bar, and written as JSON for the score (sfx.js, track's `cuts`).
// The tempo is the one whose beat grid the onsets (rises in loudness, low and high bands apart) fall on best, between 70
// and 180 BPM; --bpm n checks a known one instead. The downbeat is the beat of four where the low end hits hardest.
// ffmpeg comes from ffmpeg-static, or $FFMPEG.
'use strict';
const { execFileSync } = require('child_process'), fs = require('fs'), path = require('path');
const args = process.argv.slice(2), file = args[0];
const bpmAt = args.indexOf('--bpm'), FIXED = bpmAt >= 0 ? +args[bpmAt + 1] : 0;
const out = args.find((a, i) => i > 0 && a.endsWith('.json'));
if (!file || !fs.existsSync(file)) { console.error('usage: music.cjs <track.mp3|wav> [out.json] [--bpm n]'); process.exit(1); }
let FF = process.env.FFMPEG;
if (!FF) try { FF = require(path.join(__dirname, '..', 'node_modules', 'ffmpeg-static')); } catch (e) {}

const SR = 22050, HOP = 256, FR = SR / HOP;   // about 86 envelope frames a second
const raw = execFileSync(FF, ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
const x = new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4), DUR = x.length / SR;

// two bands by one-pole filters: low (kick, bass, under 150 Hz) and the rest; per hop, the energy of each
const N = Math.floor(x.length / HOP), lo = new Float64Array(N), hi = new Float64Array(N), all = new Float64Array(N);
{ const a = Math.exp(-2 * Math.PI * 150 / SR); let l = 0;
  for (let i = 0; i < N; i++) { let el = 0, eh = 0;
    for (let k = i * HOP; k < (i + 1) * HOP; k++) { l = a * l + (1 - a) * x[k]; el += l * l; eh += (x[k] - l) ** 2; }
    lo[i] = Math.sqrt(el / HOP); hi[i] = Math.sqrt(eh / HOP); all[i] = Math.sqrt((el + eh) / HOP); } }
// onset strength: the rise of each band's log energy, half-wave rectified, summed, minus its local mean
const flux = new Float64Array(N);
for (let i = 1; i < N; i++) flux[i] = Math.max(0, Math.log1p(1e3 * lo[i]) - Math.log1p(1e3 * lo[i - 1])) + Math.max(0, Math.log1p(1e3 * hi[i]) - Math.log1p(1e3 * hi[i - 1]));
const W = Math.round(FR / 2), on = new Float64Array(N);
{ let s = 0; for (let i = 0; i < N; i++) { s += flux[i]; if (i >= 2 * W) s -= flux[i - 2 * W]; on[i] = Math.max(0, flux[i] - s / Math.min(i + 1, 2 * W)); } }
const at = t => { const f = t * FR, i = Math.floor(f), u = f - i; return i + 1 >= N ? 0 : on[i] * (1 - u) + on[i + 1] * u; };

// tempo and phase: the grid (period, offset) that collects the most onset strength across the whole track, in steps of
// 0.1 BPM (coarser ones drift off the beat over a long track and lose to a wrong tempo), leaning a little toward
// 120 BPM so a half or double tempo does not win on a tie; then to 0.005 BPM around the best. Autocorrelation was
// tried first and lost to syncopation (a kick on 1 and 3 with a push 3/4 of a beat later reads as 160 BPM)
const score = (bpm, o) => { const p = 60 / bpm; let s = 0, n = 0; for (let t = o; t < DUR; t += p) { s += at(t); n++; } return s / n; };
const best = (bpm, step = 0.004) => { const p = 60 / bpm; let bo = 0, bs = -1; for (let o = 0; o < p; o += step) { const s = score(bpm, o); if (s > bs) { bs = s; bo = o; } } return [bs, bo]; };
let BPM = FIXED, OFF = 0;
if (!BPM) { let bs = -1;
  for (let b = 70; b <= 180; b += 0.1) { const [s] = best(b, 0.008); const w = s * (1 + 0.15 * Math.exp(-((Math.log2(b / 120) / 0.6) ** 2))); if (w > bs) { bs = w; BPM = b; } }
  // a half tempo always fits at least as well as the true one when every other beat hits harder: the double is taken
  // when it fits three quarters as well and stays under 170 BPM
  if (2 * BPM <= 170 && best(2 * BPM, 0.008)[0] >= 0.75 * best(BPM, 0.008)[0]) BPM *= 2;
  let fs2 = -1, fb = BPM; for (let b = BPM - 0.1; b <= BPM + 0.1; b += 0.005) { const [s] = best(b); if (s > fs2) { fs2 = s; fb = b; } } BPM = fb; }
OFF = best(BPM)[1];
const B = 60 / BPM, BAR = 4 * B;
// the downbeat: of the four beats, the one whose low end hits hardest across the track
const lowAt = t => { const i = Math.round(t * FR); let m = 0; for (let k = i - 3; k <= i + 3; k++) if (k >= 0 && k < N) m = Math.max(m, lo[k]); return m; };
const phase = [0, 1, 2, 3].map(k => { let s = 0; for (let t = OFF + k * B; t < DUR; t += BAR) s += lowAt(t); return s; });
const DB = phase.indexOf(Math.max(...phase));
let first = OFF + DB * B; while (first - BAR > -B / 2) first -= BAR;   // the earliest bar line, which may sit before 0
const db = v => 20 * Math.log10(v + 1e-9);
const bars = [];
for (let k = 0, t = first; t + BAR <= DUR + B; k++, t += BAR) {
  const i0 = Math.max(0, Math.round(t * FR)), i1 = Math.min(N, Math.round((t + BAR) * FR)); if (i1 <= i0) continue;
  let e = 0, el = 0; for (let i = i0; i < i1; i++) { e += all[i] ** 2; el += lo[i] ** 2; }
  bars.push({ bar: k, t: +t.toFixed(3), db: +db(Math.sqrt(e / (i1 - i0))).toFixed(1), low: +db(Math.sqrt(el / (i1 - i0))).toFixed(1) });
}
// changes: a bar 4 dB or more louder than the one before (the band comes in, a drop), or 4 dB quieter (a break)
const peak = Math.max(...bars.map(b => b.db));
bars.forEach((b, i) => { const p = bars[i - 1]; if (!p) return;
  if (b.db - p.db >= 4) b.change = b.db >= peak - 3 ? 'drop' : 'up';
  else if (p.db - b.db >= 4) b.change = 'down'; });
const res = { file: path.basename(file), dur: +DUR.toFixed(3), bpm: +BPM.toFixed(2), beat: +B.toFixed(4), bar: +BAR.toFixed(4),
  firstBar: +first.toFixed(4), confidence: +(score(BPM, OFF) / (on.reduce((s, v) => s + v, 0) / N)).toFixed(2), bars };
console.log(`${res.file}  ${res.dur} s  ${res.bpm} BPM  beat ${res.beat} s  bar ${res.bar} s  first bar line ${res.firstBar} s  grid fit ${res.confidence}x`);
const lo_ = Math.min(...bars.map(b => b.db));
bars.forEach(b => console.log(`  bar ${String(b.bar).padStart(3)}  ${b.t.toFixed(2).padStart(7)} s  ${b.db.toFixed(1).padStart(6)} dB  ${'#'.repeat(Math.max(0, Math.round((b.db - lo_) / 1.5)))}${b.change ? '  ' + b.change : ''}`));
if (out) { fs.writeFileSync(out, JSON.stringify(res, null, 1)); console.log('wrote', out); }
