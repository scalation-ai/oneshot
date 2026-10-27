// How a soundtrack sounds, in numbers you can read without ears: node listen.cjs <film.wav|.mp4> [reference.wav|.mp4|.mov]
// hits a second   distinct sounds that start (spectral flux peaks, 60 ms apart at least): a busy track has many
// low end         the share of the energy under 150 Hz: a groove that carries a film puts most of it there
// mud             150 to 600 Hz, where a voice, pads and stacked notes pile up
// dings           frames where one narrow pitch above 1 kHz stands far over the rest (bells, pops, marimbas, ticks),
//                 the last 3 s (the end card's sonic logo) left out
// With a reference (a film whose sound the user likes), each number is printed beside the reference's, and the
// verdicts are judged against it; without one, against a launch film measured for the skill.
'use strict';
const { execFileSync } = require('child_process');
const SR = 48000, N = 1024, HOP = 480;
const BASE = { hits: 2.73, low: 67.6, mud: 17.6, dings: 8.1, name: 'a launch film measured for the skill' };

function load(file) {
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
  return new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
}
function fft(re, im) {   // in place, radix 2
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) { const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) { let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) { const p = i + k, q = p + len / 2, tr = re[q] * cr - im[q] * ci, ti = re[q] * ci + im[q] * cr;
        re[q] = re[p] - tr; im[q] = im[p] - ti; re[p] += tr; im[p] += ti; const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr; } } }
}
function measure(file) {
  const x = load(file), dur = x.length / SR, win = Float64Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1)));
  const H = N / 2 + 1, df = SR / N, band = new Float64Array(5), edges = [20, 150, 600, 2500, 8000, 20000];
  let prev = null, dingFrames = 0, frames = 0; const flux = [], dingAt = [];
  for (let s = 0; s + N <= x.length; s += HOP) {
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let i = 0; i < N; i++) re[i] = x[s + i] * win[i];
    fft(re, im);
    const mag = new Float64Array(H); for (let k = 0; k < H; k++) mag[k] = Math.hypot(re[k], im[k]);
    for (let k = 0; k < H; k++) { const f = k * df, e = mag[k] * mag[k]; for (let b = 0; b < 5; b++) if (f >= edges[b] && f < edges[b + 1]) band[b] += e; }
    const lg = mag.map(v => Math.log1p(v * 10));
    if (prev) { let fl = 0; for (let k = 0; k < H; k++) fl += Math.max(0, lg[k] - prev[k]); flux.push(fl); }
    prev = lg;
    let mx = 0, sum = 0, cnt = 0; for (let k = Math.ceil(1000 / df); k < H; k++) { mx = Math.max(mx, mag[k]); sum += mag[k]; cnt++; }
    // the end card's last 3 s are left out of the dings: the sonic logo's chime belongs there
    const body = s / SR < x.length / SR - 3;
    if (mx / (sum / cnt + 1e-9) > 40) { if (body) dingFrames++; dingAt.push(s / SR); }
    if (body) frames++;
  }
  const sorted = [...flux].sort((a, b) => a - b), med = sorted[sorted.length >> 1];
  const mean = flux.reduce((a, v) => a + v, 0) / flux.length, sd = Math.sqrt(flux.reduce((a, v) => a + (v - mean) ** 2, 0) / flux.length);
  const thr = med + 2.5 * sd, hits = [];
  for (let i = 1; i < flux.length - 1; i++) if (flux[i] > thr && flux[i] >= flux[i - 1] && flux[i] >= flux[i + 1]) {
    const t = (i + 1) * HOP / SR; if (!hits.length || t - hits[hits.length - 1] > 0.06) hits.push(t); }
  const tot = band.reduce((a, v) => a + v, 0), pct = v => 100 * v / tot;
  const per2 = Array.from({ length: Math.ceil(dur / 2) }, () => 0); hits.forEach(t => per2[Math.min(per2.length - 1, Math.floor(t / 2))]++);
  const ding2 = per2.map(() => 0); dingAt.forEach(t => ding2[Math.min(ding2.length - 1, Math.floor(t / 2))]++);
  return { dur, hits: hits.length / dur, low: pct(band[0]), mud: pct(band[1]), dings: 100 * dingFrames / frames, per2, ding2: ding2.map(n => Math.round(100 * n / (2 * SR / HOP))) };
}

const [file, ref] = process.argv.slice(2);
if (!file) { console.error('usage: node listen.cjs <film.wav|.mp4> [reference]'); process.exit(1); }
const A = measure(file), R = ref ? { ...measure(ref), name: require('path').basename(ref) } : BASE;
const f1 = v => v.toFixed(1).padStart(6), f2 = v => v.toFixed(2).padStart(6);
console.log(`${require('path').basename(file)}: ${A.dur.toFixed(1)} s, against ${R.name}`);
console.log(`              this   reference`);
console.log(`hits a second ${f2(A.hits)} ${f2(R.hits)}`);
console.log(`low end %     ${f1(A.low)} ${f1(R.low)}    under 150 Hz`);
console.log(`mud %         ${f1(A.mud)} ${f1(R.mud)}    150 to 600 Hz`);
console.log(`dings %       ${f1(A.dings)} ${f1(R.dings)}    frames with one narrow pitch over 1 kHz standing out`);
console.log(`hits per 2 s  ${A.per2.join(' ')}`);
console.log(`dings % per 2 s ${A.ding2.join(' ')}`);
const out = [];
if (A.hits > R.hits * 1.3) out.push(`BUSY: ${A.hits.toFixed(2)} hits a second against ${R.hits.toFixed(2)}. Cut sounds on top of the music; let the groove be the rhythm.`);
if (A.low < R.low - 15) out.push(`THIN: ${A.low.toFixed(0)}% of the energy is under 150 Hz against ${R.low.toFixed(0)}%. The kick and the bass carry a film: the drive mood, or raise them.`);
if (A.mud > R.mud + 12) out.push(`MUDDY: ${A.mud.toFixed(0)}% sits at 150 to 600 Hz against ${R.mud.toFixed(0)}%: a voice, pads and stacked notes on top of each other.`);
if (A.dings > Math.max(10, R.dings * 1.5)) out.push(`DINGY: ${A.dings.toFixed(0)}% of frames carry a bright pitched note against ${R.dings.toFixed(0)}%. Keep pitched hits (pop, bell, marimba, blip, tick) for the sonic logo.`);
console.log(out.length ? out.map(s => 'WARN ' + s).join('\n') : 'PASS: as clean as the reference');
