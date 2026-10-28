// How a soundtrack sounds, in numbers you can read without ears:
//   node listen.cjs <film.wav|.mp4> [reference.wav|.mp4|.mov] [--own]
// hits a second   distinct sounds that start (spectral flux peaks, 60 ms apart at least): a busy track has many
// low end         the share of the energy under 150 Hz: the kick and the bass
// mud             150 to 600 Hz, where a voice, pads and stacked notes pile up
// dings           frames where one narrow pitch above 1 kHz stands far over the rest (bells, pops, marimbas, ticks),
//                 the last 3 s (the end card's sonic logo) left out
// loudness       BS.1770 integrated loudness in LUFS and the true peak in dBTP (lib/sfx.js loudness), beside the other
//                 films of the series (the .wav files next to a film's .wav), so no film plays louder than the rest
// With a reference (a film whose sound the user likes), each number is printed beside the reference's, and the
// verdicts are judged against it. --own: the reference is the film's own track alone (film.sh listen writes it), so
// the verdicts judge what the score adds on top of the music: the track's own sound is the producer's choice. Without
// either (or with no music), against a launch film measured for the skill.
// ffmpeg comes from ffmpeg-static, or $FFMPEG.
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');
const { loudness } = require(path.join(__dirname, '..', 'lib', 'sfx.js'));
const SR = 48000, N = 1024, HOP = 480;
const BASE = { hits: 2.73, low: 67.6, mud: 17.6, dings: 8.1, name: 'a launch film measured for the skill' };
let FF = process.env.FFMPEG;
if (!FF) try { FF = require(path.join(__dirname, '..', 'node_modules', 'ffmpeg-static')); } catch (e) {}
if (!FF || !fs.existsSync(FF)) { console.error('ffmpeg not found. Run the engine setup once: bash setup.sh'); process.exit(1); }

function load(file, ch = 1) {
  const raw = execFileSync(FF, ['-v', 'error', '-i', file, '-ac', String(ch), '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
  return new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
}
function loud(file) {   // both channels, as the platforms measure them
  const x = load(file, 2), n = x.length >> 1, L = new Float64Array(n), R = new Float64Array(n);
  for (let i = 0; i < n; i++) { L[i] = x[2 * i]; R[i] = x[2 * i + 1]; }
  return loudness([L, R]);
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
  return { dur, hits: hits.length / dur, low: pct(band[0]), mud: pct(band[1]), dings: 100 * dingFrames / frames, per2, ding2: ding2.map(n => Math.round(100 * n / (2 * SR / HOP))), ...loud(file) };
}

const args = process.argv.slice(2), OWN = args.includes('--own'), [file, ref] = args.filter(a => a !== '--own');
if (!file) { console.error('usage: node listen.cjs <film.wav|.mp4> [reference] [--own]'); process.exit(1); }
const A = measure(file);
let R = ref ? { ...measure(ref), name: OWN ? "the film's own track alone" : path.basename(ref) } : BASE;
if (!isFinite(R.lufs)) R = BASE;   // a film with no music
const f1 = v => v.toFixed(1).padStart(6), f2 = v => v.toFixed(2).padStart(6);
console.log(`${path.basename(file)}: ${A.dur.toFixed(1)} s, against ${R.name}`);
console.log(`              this   reference`);
console.log(`hits a second ${f2(A.hits)} ${f2(R.hits)}`);
console.log(`low end %     ${f1(A.low)} ${f1(R.low)}    under 150 Hz`);
console.log(`mud %         ${f1(A.mud)} ${f1(R.mud)}    150 to 600 Hz`);
console.log(`dings %       ${f1(A.dings)} ${f1(R.dings)}    frames with one narrow pitch over 1 kHz standing out`);
console.log(`hits per 2 s  ${A.per2.join(' ')}`);
console.log(`dings % per 2 s ${A.ding2.join(' ')}`);
const db = v => v === undefined ? '     ' : v.toFixed(1).padStart(6);
console.log(`LUFS          ${db(A.lufs)} ${db(R.lufs)}    loudness: the platforms play everything at about -14`);
console.log(`true peak dBTP${db(A.tp)} ${db(R.tp)}    over -1, it clips once it is AAC`);
// the series: every other film's soundtrack next to this one, measured the same way
const series = /\.wav$/i.test(file) ? fs.readdirSync(path.dirname(path.resolve(file))).filter(f => /\.wav$/i.test(f) && f !== path.basename(file))
  .map(f => ({ f: f.slice(0, -4), lufs: loud(path.join(path.dirname(path.resolve(file)), f)).lufs })).filter(s => isFinite(s.lufs)) : [];
if (series.length) console.log(`the series    ${series.map(s => `${s.f} ${s.lufs.toFixed(1)}`).join(', ')}`);
const out = [];
if (A.hits > R.hits * 1.3) out.push(`BUSY: ${A.hits.toFixed(2)} hits a second against ${R.hits.toFixed(2)}. Cut sounds on top of the music; let the music be the rhythm.`);
if (A.low < R.low - 15) out.push(`THIN: ${A.low.toFixed(0)}% of the energy is under 150 Hz against ${R.low.toFixed(0)}%. Sounds on top are covering the music's low end: fewer, or lower.`);
if (A.mud > R.mud + 12) out.push(`MUDDY: ${A.mud.toFixed(0)}% sits at 150 to 600 Hz against ${R.mud.toFixed(0)}%: a voice, pads and stacked notes on top of each other.`);
if (A.dings > Math.max(10, R.dings * 1.5)) out.push(`DINGY: ${A.dings.toFixed(0)}% of frames carry a bright pitched note against ${R.dings.toFixed(0)}%. Keep pitched hits (pop, bell, marimba, blip, tick) for the sonic logo.`);
if (A.tp > -1) out.push(`PEAKS: ${A.tp.toFixed(2)} dBTP. Over -1 the AAC in the film clips: write the soundtrack again (the master holds -1.5), or lower a track.`);
if (A.lufs > -10) out.push(`LOUD: ${A.lufs.toFixed(1)} LUFS. The platforms turn it down to about -14 anyway: M.write(out, { lufs: -14 }) sets it there.`);
if (A.lufs < -18) out.push(`QUIET: ${A.lufs.toFixed(1)} LUFS. It plays under the feed around it, and not every platform turns it up: raise the music (music()'s gain).`);
const all = [A.lufs, ...series.map(s => s.lufs)], lo = Math.min(...all), hi = Math.max(...all);
if (series.length && hi - lo > 2) out.push(`SERIES: its films play from ${lo.toFixed(1)} to ${hi.toFixed(1)} LUFS, ${(hi - lo).toFixed(1)} apart. Give every film's score the same M.write(out, { lufs: ${Math.max(-16, Math.floor(lo))} }), which only turns a film down.`);
console.log(out.length ? out.map(s => 'WARN ' + s).join('\n') : 'PASS: as clean as the reference');
