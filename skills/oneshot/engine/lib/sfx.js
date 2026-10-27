/* The film sound kit: recorded element sounds (a real keyboard, swooshes, impacts, UI tones: sample(), typing()),
   synthesized instruments for the groove (pads, bass, drums and more), a two-bus mixer (dry + reverb send), a master and a
   48 kHz 16-bit stereo writer, and the sonic logo that closes every film of a series. A film with a
   voice adds its narrator's clips on their own bus, with the music ducked under them.
   A score requires it:  const { Mix, hz, kick, ... } = require('sfx');   (film.sh puts it on NODE_PATH)
   Signals are Float64Arrays at SR. Randomness is seeded, so a score always writes the same file. */
'use strict';
const fs = require('fs'), path = require('path');
const SR = 48000;
const PI2 = 2 * Math.PI;

// ---------------------------------------------------------------- seeded randomness
function rngOf(seed) {                       // xoshiro128**, seeded through splitmix32
  let s = seed >>> 0; const sm = () => { s = (s + 0x9e3779b9) >>> 0; let z = s; z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0; z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0; return (z ^ (z >>> 16)) >>> 0; };
  let a = sm(), b = sm(), c = sm(), d = sm(), spare = null;
  const u32 = () => { const r = Math.imul(((Math.imul(b, 5) << 7) | (Math.imul(b, 5) >>> 25)), 9) >>> 0; const t = (b << 9) >>> 0;
    c ^= a; d ^= b; b ^= c; a ^= d; c ^= t; d = ((d << 11) | (d >>> 21)) >>> 0; return r; };
  const uniform = (lo = 0, hi = 1) => lo + (hi - lo) * ((u32() + 0.5) / 4294967296);
  const normal = () => { if (spare !== null) { const v = spare; spare = null; return v; }
    const u = uniform(), v = uniform(), r = Math.sqrt(-2 * Math.log(u)); spare = r * Math.sin(PI2 * v); return r * Math.cos(PI2 * v); };
  return { uniform, normal };
}
let rng = rngOf(7);

// ---------------------------------------------------------------- arrays
const N_ = d => Math.floor(d * SR);
const zeros = n => new Float64Array(n);
const tvec = d => { const n = N_(d), t = zeros(n); for (let i = 0; i < n; i++) t[i] = i / SR; return t; };
const noise = d => { const n = N_(d), x = zeros(n); for (let i = 0; i < n; i++) x[i] = rng.normal(); return x; };
const map = (n, f) => { const y = zeros(n); for (let i = 0; i < n; i++) y[i] = f(i / SR, i); return y; };
const mul = (x, k) => { const y = zeros(x.length); for (let i = 0; i < x.length; i++) y[i] = x[i] * (typeof k === 'number' ? k : k[i]); return y; };
function mix(...xs) { const n = Math.max(...xs.map(x => x.length)), y = zeros(n); for (const x of xs) for (let i = 0; i < x.length; i++) y[i] += x[i]; return y; }
// the phase of a changing frequency: 2 pi times the running sum of f / SR (np.cumsum), for pitch sweeps
function phaseOf(f) { const p = zeros(f.length); let s = 0; for (let i = 0; i < f.length; i++) { s += f[i]; p[i] = PI2 * s / SR; } return p; }
const linspace = (a, b, n) => map(n, (_, i) => n === 1 ? a : a + (b - a) * i / (n - 1));

// ---------------------------------------------------------------- Butterworth filters, as scipy designs them
// butter(order, Wn, btype, fs) then sosfilt: the analog prototype, lp2lp/lp2hp/lp2bp, the bilinear transform,
// second-order sections run in direct form II transposed. The same numbers as scipy, so the same sound.
const C = { add: (a, b) => [a[0] + b[0], a[1] + b[1]], sub: (a, b) => [a[0] - b[0], a[1] - b[1]], mul: (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]],
  div: (a, b) => { const q = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / q, (a[1] * b[0] - a[0] * b[1]) / q]; },
  sqrt: a => { const r = Math.hypot(a[0], a[1]), re = Math.sqrt((r + a[0]) / 2), im = Math.sqrt(Math.max(0, (r - a[0]) / 2)); return [re, a[1] < 0 ? -im : im]; },
  sc: (a, k) => [a[0] * k, a[1] * k] };
const sosCache = new Map();
function butterSOS(order, Wn, btype) {
  const key = order + btype + Wn; if (sosCache.has(key)) return sosCache.get(key);
  const fs2 = 4, warp = w => fs2 * Math.tan(Math.PI * (2 * w / SR) / 2);          // prewarped, as scipy with fs=2
  let p = []; for (let m = -order + 1; m < order; m += 2) { const a = Math.PI * m / (2 * order); p.push([-Math.cos(a), -Math.sin(a)]); }
  let z = [], k = 1;
  if (btype === 'low') { const wo = warp(Wn); p = p.map(q => C.sc(q, wo)); k = Math.pow(wo, order); }
  else if (btype === 'high') { const wo = warp(Wn); let prod = [1, 0]; p.forEach(q => { prod = C.mul(prod, C.sc(q, -1)); }); k = 1 / prod[0];
    p = p.map(q => C.div([wo, 0], q)); z = p.map(() => [0, 0]); }
  else { const w1 = warp(Wn[0]), w2 = warp(Wn[1]), bw = w2 - w1, wo = Math.sqrt(w1 * w2);
    const pl = p.map(q => C.sc(q, bw / 2)), r = pl.map(q => C.sqrt(C.sub(C.mul(q, q), [wo * wo, 0])));
    p = [...pl.map((q, i) => C.add(q, r[i])), ...pl.map((q, i) => C.sub(q, r[i]))]; z = pl.map(() => [0, 0]); k = Math.pow(bw, order); }
  // bilinear transform
  let num = [1, 0], den = [1, 0];
  z.forEach(q => { num = C.mul(num, C.sub([fs2, 0], q)); }); p.forEach(q => { den = C.mul(den, C.sub([fs2, 0], q)); });
  k = k * C.div(num, den)[0];
  const zd = z.map(q => C.div(C.add([fs2, 0], q), C.sub([fs2, 0], q))), pd = p.map(q => C.div(C.add([fs2, 0], q), C.sub([fs2, 0], q)));
  while (zd.length < pd.length) zd.push([-1, 0]);
  // pair the poles into conjugate pairs and the (real) zeros two by two
  const used = new Array(pd.length).fill(false), pairs = [];
  pd.forEach((q, i) => { if (used[i]) return; used[i] = true; let best = -1, bd = Infinity;
    pd.forEach((r, j) => { if (used[j]) return; const dd = Math.hypot(r[0] - q[0], r[1] + q[1]); if (dd < bd) { bd = dd; best = j; } });
    used[best] = true; pairs.push([q, pd[best]]); });
  const zr = zd.map(q => q[0]).sort((a, b) => a - b), zpairs = [];
  if (btype === 'band') { const neg = zr.filter(v => v < 0), pos = zr.filter(v => v >= 0); for (let i = 0; i < pairs.length; i++) zpairs.push([neg[i], pos[i]]); }
  else for (let i = 0; i < pairs.length; i++) zpairs.push([zr[2 * i], zr[2 * i + 1]]);
  const sos = pairs.map(([a, b], i) => { const [z1, z2] = zpairs[i];
    const bq = [1, -(z1 + z2), z1 * z2], aq = [1, -(a[0] + b[0]), C.mul(a, b)[0]];
    if (i === 0) for (let j = 0; j < 3; j++) bq[j] *= k; return [bq, aq]; });
  sosCache.set(key, sos); return sos;
}
function sosfilt(sos, x) {
  let y = Float64Array.from(x);
  for (const [b, a] of sos) { let z1 = 0, z2 = 0; const out = zeros(y.length);
    for (let i = 0; i < y.length; i++) { const xi = y[i], yi = b[0] * xi + z1; z1 = b[1] * xi - a[1] * yi + z2; z2 = b[2] * xi - a[2] * yi; out[i] = yi; }
    y = out; }
  return y;
}
const bp = (x, lo, hi, order = 2) => sosfilt(butterSOS(order, [lo, hi], 'band'), x);
const hp = (x, f, order = 2) => sosfilt(butterSOS(order, f, 'high'), x);
const lp = (x, f, order = 2) => sosfilt(butterSOS(order, f, 'low'), x);

// ---------------------------------------------------------------- notes, oscillators, envelopes
const NAMES = { C: -9, 'C#': -8, D: -7, 'D#': -6, E: -5, F: -4, 'F#': -3, G: -2, 'G#': -1, A: 0, 'A#': 1, B: 2, Bb: 1, Eb: -6, Ab: -1 };
function hz(note) { const n = note.slice(0, -1), o = +note.slice(-1); return 440 * Math.pow(2, (NAMES[n] + (o - 4) * 12) / 12); }
// a band-limited sawtooth: harmonics by the Chebyshev recurrence sin((k+1)x) = 2 cos x sin(kx) - sin((k-1)x)
function saw(f, d, detune_cents = 0, phase = null) {
  const n = N_(d), ff = f * Math.pow(2, detune_cents / 1200), out = zeros(n);
  const ph = phase === null ? rng.uniform(0, PI2) : phase, K = Math.floor(Math.min(40, (SR / 2 - 200) / ff));
  for (let i = 0; i < n; i++) { const x = PI2 * ff * (i / SR) + ph, c2 = 2 * Math.cos(x); let s0 = 0, s1 = Math.sin(x), acc = 0;
    for (let k = 1; k <= K; k++) { acc += s1 / k; const s2 = c2 * s1 - s0; s0 = s1; s1 = s2; } out[i] = acc * 0.55; }
  return out;
}
function env_adsr(n, a, d, sl, r, total) {
  return map(n, t => { let e = sl; if (t < a) e = t / Math.max(a, 1e-4); else if (t < a + d) e = 1 - (1 - sl) * (t - a) / Math.max(d, 1e-4);
    if (t > total - r) e *= Math.min(1, Math.max(0, (total - t) / Math.max(r, 1e-4))); return e; });
}
const sweepSin = (n, fOf) => { const f = map(n, fOf), p = phaseOf(f); return p.map(Math.sin); };

// ---------------------------------------------------------------- drums
function kick({ big = false, soft = false } = {}) {
  const d = big ? 0.5 : 0.34, n = N_(d);
  const f = map(n, t => 44 + ((soft ? 120 : 155) - 44) * Math.exp(-t / 0.028)), p = phaseOf(f);
  const body = map(n, (t, i) => Math.sin(p[i]) * Math.exp(-t / (big ? 0.32 : 0.2)));
  if (!soft) { const cl = hp(noise(0.004), 2500), m = cl.length; for (let i = 0; i < m; i++) body[i] += cl[i] * (m === 1 ? 1 : 1 - i / (m - 1)) * 0.35; }
  return body.map(v => Math.tanh(v * 1.6) * 0.9);
}
function clap() {
  const d = 0.35, n = N_(d), x = zeros(n), nz = noise(d);
  [0, 0.011, 0.022].forEach((off, k) => { for (let i = 0; i < n; i++) { const t = i / SR; if (t >= off) x[i] += nz[i] * Math.exp(-(t - off) / 0.007) * (k < 2 ? 0.8 : 1.0); } });
  for (let i = 0; i < n; i++) { const t = i / SR; if (t >= 0.022) x[i] += nz[i] * Math.exp(-(t - 0.022) / 0.09) * 0.55; }
  return mul(bp(x, 900, 3200), 1.3);
}
function hat({ open = false } = {}) {
  const d = open ? 0.22 : 0.06, y = lp(hp(noise(d), 7000, 4), 13000, 2);
  return y.map((v, i) => v * Math.exp(-(i / SR) / (open ? 0.09 : 0.018)) * 0.8);
}
function shaker(d = 0.09) { const y = bp(noise(d), 5000, 11000); return y.map((v, i) => v * Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, (i / SR) / d))), 2) * 0.7); }
function crash(d = 1.6) {
  const x = hp(noise(d), 3800, 2), ph = [3120, 4230, 5410, 6890, 8120].map(f0 => [f0, rng.uniform(0, 6)]);
  return x.map((v, i) => { const t = i / SR; let metal = 0; for (const [f0, u] of ph) metal += Math.sin(PI2 * f0 * t + u); metal *= 0.04;
    return (v * Math.exp(-t / 0.55) + metal * Math.exp(-t / 0.4)) * 0.6; });
}
function sub_boom(d = 1.3, f0 = 62, f1 = 30) { const n = N_(d), s = sweepSin(n, t => f1 + (f0 - f1) * Math.exp(-t / 0.35)); return s.map((v, i) => v * Math.exp(-(i / SR) / 0.55)); }

// ---------------------------------------------------------------- fx
function whoosh(d, f_lo = 300, f_hi = 5000, up = true, shape = 'bell') {
  const n = N_(d), x = noise(d), NC = 14, centers = Array.from({ length: NC }, (_, i) => f_lo * Math.pow(f_hi / f_lo, i / (NC - 1)));
  const B = centers.map(c => bp(x, c / 1.35, Math.min(c * 1.35, SR / 2 - 100)));
  return map(n, (_, i) => { const lin = n === 1 ? 0 : i / (n - 1), pos = up ? lin : 1 - lin, idx = pos * (NC - 1);
    const lo = Math.floor(idx), fr = idx - lo, hi = Math.min(lo + 1, NC - 1), y = B[lo][i] * (1 - fr) + B[hi][i] * fr;
    const e = shape === 'bell' ? Math.pow(Math.sin(Math.PI * lin), 1.6) : shape === 'rise' ? Math.pow(lin, 2.2) : Math.pow(1 - lin, 1.5);
    return y * e * 1.4; });
}
function riser(d, f0 = 180, f1 = 1400) {
  const n = N_(d), f = map(n, t => f0 * Math.pow(f1 / f0, Math.pow(t / d, 1.6))), p1 = phaseOf(f), p2 = phaseOf(f.map(v => v * 1.5)), w = whoosh(d, 400, 9000, true, 'rise');
  return map(n, (t, i) => (Math.sin(p1[i]) * 0.35 + Math.sin(p2[i]) * 0.15) * Math.pow(t / d, 2.4) + w[i] * 0.8);
}
function reverse_swell(d = 0.5) { const c = crash(d).reverse(), n = c.length; return c.map((v, i) => v * Math.pow(n === 1 ? 0 : i / (n - 1), 1.5)); }
function blip(f, d = 0.14, bright = 0.4) { return map(N_(d), t => Math.sin(PI2 * f * t + Math.sin(PI2 * f * 2 * t) * bright * Math.exp(-t / 0.03) * 3) * Math.exp(-t / 0.045) * 0.8); }
function tick(f = 2600, d = 0.02) { return bp(noise(d), f * 0.7, f * 1.4).map((v, i) => v * Math.exp(-(i / SR) / 0.004) * 1.6); }
function pop(f0 = 820, f1 = 260, d = 0.12) { return sweepSin(N_(d), t => f1 + (f0 - f1) * Math.exp(-t / 0.018)).map((v, i) => v * Math.exp(-(i / SR) / 0.05)); }
function bell(f, d = 1.8) {
  return map(N_(d), t => { const idx = 2.2 * Math.exp(-t / 0.35); let y = Math.sin(PI2 * f * t + idx * Math.sin(PI2 * f * 3.5 * t));
    y += 0.35 * Math.sin(PI2 * f * 2 * t) * Math.exp(-t / 0.3); return y * Math.exp(-t / 0.7) * 0.6; });
}
function thock(d = 0.18, f_lo = 120) { return sweepSin(N_(d), t => f_lo + 260 * Math.exp(-t / 0.012)).map((v, i) => v * Math.exp(-(i / SR) / 0.045)); }
function glide(f0, f1, d, amp = 0.3) { return sweepSin(N_(d), t => f0 * Math.pow(f1 / f0, t / d)).map((v, i) => v * Math.pow(Math.sin(Math.PI * (i / SR) / d), 0.8) * amp); }
// a clean sine ping with a slight downward bend and a long tail: a sonar, for scanning a list or a grid
function sonar(f = 1320, d = 1.6) {
  const n = N_(d), ff = map(n, t => f * (1 - 0.012 * (1 - Math.exp(-t / 0.08)))), p1 = phaseOf(ff), p2 = phaseOf(ff.map(v => v * 2.01));
  return map(n, (t, i) => (Math.sin(p1[i]) + 0.18 * Math.sin(p2[i]) * Math.exp(-t / 0.2)) * Math.min(1, t / 0.003) * Math.exp(-t / 0.38) * 0.7);
}
// a low, dry wooden thud for a hard state change (a cell flips, a row locks)
function thud(d = 0.5) {
  const n = N_(d), s = sweepSin(n, t => 58 + 90 * Math.exp(-t / 0.03)), kn = bp(noise(d), 180, 900);
  return map(n, (t, i) => Math.tanh((s[i] * Math.exp(-t / 0.13) + kn[i] * Math.exp(-t / 0.018) * 0.5) * 1.8) * 0.8);
}
// struck bar: fundamental plus the 4x and 9.9x modes, fast decay on the upper ones
function marimba(f, d = 0.9, bright = 1.0) {
  const tau = 0.32 * Math.pow(220 / Math.max(f, 110), 0.35);
  return map(N_(d), t => (Math.sin(PI2 * f * t) * Math.exp(-t / tau) + 0.35 * bright * Math.sin(PI2 * f * 3.99 * t) * Math.exp(-t / 0.05)
    + 0.10 * bright * Math.sin(PI2 * f * 9.9 * t) * Math.exp(-t / 0.012)) * Math.min(1, t / 0.0015) * 0.8);
}
// a wooden clack: the odometer landing
function clack(f = 1900, d = 0.08) {
  const nz = bp(noise(d), 1500, 5000);
  return map(N_(d), (t, i) => Math.sin(PI2 * f * t) * Math.exp(-t / 0.012) + 0.6 * Math.sin(PI2 * f * 1.52 * t) * Math.exp(-t / 0.008) + nz[i] * Math.exp(-t / 0.004) * 0.6);
}
// a soft phone key tap
function key(d = 0.05) { const nz = bp(noise(d), 1800, 6000); return map(N_(d), (t, i) => (nz[i] * Math.exp(-t / 0.006) + Math.sin(PI2 * 420 * t) * Math.exp(-t / 0.01) * 0.3) * 0.8); }
// a phone vibrating on a table: 170 Hz body gated at 32 Hz
function buzz(d = 0.55) {
  const n = N_(d), s = saw(85, d, 0, 0);
  const y = map(n, (t, i) => (Math.sin(PI2 * 170 * t) + 0.5 * Math.sin(PI2 * 340 * t) + 0.25 * s[i]) * ((0.5 + 0.5 * Math.sign(Math.sin(PI2 * 32 * t))) * 0.8 + 0.2));
  return lp(y, 1400).map((v, i) => { const t = i / SR; return v * Math.min(1, t / 0.01) * Math.min(1, (d - t) / 0.05) * 0.5; });
}
// accelerating then slowing ticks for a rolling number
function odometer(d, n = 14) {
  const out = zeros(N_(d) + N_(0.03));
  for (let i = 0; i < n; i++) { const u = Math.pow(i / (n - 1), 1.7), s = Math.floor(u * d * SR), tk = tick(3000 + 400 * (i % 3), 0.012);
    for (let j = 0; j < tk.length && s + j < out.length; j++) out[s + j] += tk[j] * (0.5 + 0.5 * (1 - u)); }
  return out;
}

// ---------------------------------------------------------------- tonal
function pad_chord(notes, d, { cutoff = 1800, att = 0.25, rel = 0.4 } = {}) {
  const n = N_(d), x = zeros(n);
  for (const f of notes) for (const dc of [-7, 0, 7]) { const s = saw(f, d, dc); for (let i = 0; i < n; i++) x[i] += s[i]; }
  const y = lp(x, cutoff, 2), e = env_adsr(n, att, 0.3, 0.8, rel, d), g = 2.2 / (notes.length * 3);
  return y.map((v, i) => v * g * e[i]);
}
function bass_note(f, d, cut = 420) {
  const n = N_(d), s = saw(f, d, 0, 0), x = lp(map(n, (t, i) => s[i] * 0.7 + Math.sin(PI2 * f * t) * 0.8), cut, 2);
  return x.map((v, i) => { const t = i / SR; return Math.tanh(v * Math.min(1, t / 0.004) * Math.exp(-t / 0.13) * 1.4) * 0.9; });
}
function sub_note(f, d) { const n = N_(d), e = env_adsr(n, 0.01, 0.1, 0.8, 0.08, d); return map(n, (t, i) => Math.sin(PI2 * f * t) * e[i] * 0.9); }

// ---------------------------------------------------------------- the mixer
function fft(re, im, inv) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
  for (let len = 2; len <= n; len <<= 1) { const ang = (inv ? 2 : -2) * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) { let cr = 1, ci = 0;
      for (let j = 0; j < len / 2; j++) { const a = i + j, b = a + len / 2, xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t; } } }
  if (inv) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}
// full linear convolution by FFT (scipy's fftconvolve), cut to the first `keep` samples
function fftconvolve(x, h, keep) {
  let n = 1; while (n < x.length + h.length - 1) n <<= 1;
  const ar = zeros(n), ai = zeros(n), br = zeros(n), bi = zeros(n); ar.set(x); br.set(h);
  fft(ar, ai, false); fft(br, bi, false);
  for (let i = 0; i < n; i++) { const r = ar[i] * br[i] - ai[i] * bi[i], m = ar[i] * bi[i] + ai[i] * br[i]; ar[i] = r; ai[i] = m; }
  fft(ar, ai, true); return ar.slice(0, keep);
}
const roundEven = x => { const r = Math.round(x); return (Math.abs(x - Math.trunc(x)) === 0.5 && r % 2 !== 0) ? r - 1 : r; };   // Python's round()

class Mix {
  constructor(dur) { this.N = roundEven(dur * SR); this.dur = dur; this.L = zeros(this.N); this.R = zeros(this.N); this.RL = zeros(this.N); this.RR = zeros(this.N); this.duck = new Float64Array(this.N).fill(1); }
  // place a sound at t seconds: gain, pan -1 (left) to 1 (right), rev the reverb send 0 to 1
  add(sig, t, gain = 1.0, { pan = 0.0, rev = 0.0 } = {}) {
    let i = roundEven(t * SR); if (i >= this.N) return;
    const a = Math.sqrt(0.5 * (1 - pan)) * 1.4142, b = Math.sqrt(0.5 * (1 + pan)) * 1.4142;
    let off = 0; if (i < 0) { off = -i; i = 0; }
    const j = Math.min(this.N, i + sig.length - off);
    for (let k = i; k < j; k++) { const v = sig[k - i + off] * gain; this.L[k] += v * a; this.R[k] += v * b; if (rev) { this.RL[k] += v * rev * a; this.RR[k] += v * rev * b; } }
    // bed() marks its sounds, and a copy of them is kept: under a voice the groove ducks deeper than the film's events
    if (this.bus === 'bed') { const G = this.bed || (this.bed = { L: zeros(this.N), R: zeros(this.N), RL: zeros(this.N), RR: zeros(this.N) });
      for (let k = i; k < j; k++) { const v = sig[k - i + off] * gain; G.L[k] += v * a; G.R[k] += v * b; if (rev) { G.RL[k] += v * rev * a; G.RR[k] += v * rev * b; } } }
    // a break in the groove: its sounds are cut from a break's start to its end (bed's breaks)
    if (this.bus === 'bed' && this.gates) { const fade = N_(0.03);
      for (const [g0, g1] of this.gates) { const s = roundEven(g0 * SR), e = roundEven(g1 * SR);
        for (let k = Math.max(i, s - fade); k < Math.min(j, e); k++) { const w = k < s ? (s - k) / fade : 0, v = sig[k - i + off] * gain * (1 - w);
          for (const X of this.bed ? [this, this.bed] : [this]) { X.L[k] -= v * a; X.R[k] -= v * b; if (rev) { X.RL[k] -= v * rev * a; X.RR[k] -= v * rev * b; } } } } }
  }
  // duck the whole mix from t (the groove's breathing, or room for a hit)
  pump(t, depth = 0.4, tau = 0.09) { const i0 = roundEven(t * SR); if (i0 >= this.N) return;
    if (this.bus === 'bed' && this.gates && this.gates.some(([g0, g1]) => t >= g0 - 0.03 && t < g1)) return;   // no breathing in a break
    for (let k = i0; k < this.N; k++) this.duck[k] = Math.min(this.duck[k], 1 - depth * Math.exp(-((k - i0) / SR) / tau)); }
  write(out, { ir_d = 2.2, wet = 0.9 } = {}) {
    const r = rngOf(3), n = N_(ir_d), pre = N_(0.02), N = this.N;
    const ir = () => { const x = map(n, t => r.normal() * Math.exp(-t / 0.5)), y = zeros(pre + n); y.set(lp(x, 6000), pre); let s = 0; for (const v of y) s += v * v; s = Math.sqrt(s); return y.map(v => v / s); };
    const irl = ir(), irr = ir();
    const wl = fftconvolve(hp(this.RL, 250), irl, N), wr = fftconvolve(hp(this.RR, 250), irr, N);
    const V = process.env.NOVOICE ? null : this.voice;   // NOVOICE=1: the music alone (film.sh onsets)
    let dL = this.L.map((v, i) => v * (0.55 + 0.45 * this.duck[i]) + wl[i] * wet), dR = this.R.map((v, i) => v * (0.55 + 0.45 * this.duck[i]) + wr[i] * wet);
    let vo = null;
    if (V && V.clips.length) {
      // the music under the voice: the groove down `duck` dB, the events a third of that, around every clip
      const d = zeros(N), att = N_(0.12), rel = N_(0.35), gap = N_(0.6), spans = [];
      for (const c of V.clips) { const s = roundEven(c.t * SR), e = s + c.x.length, p = spans[spans.length - 1];
        if (p && s - p[1] < gap) p[1] = Math.max(p[1], e); else spans.push([s, e]); }
      for (const [s, e] of spans) for (let i = Math.max(0, s - att); i < Math.min(N, e + rel); i++)
        d[i] = Math.max(d[i], i < s ? 0.5 - 0.5 * Math.cos(Math.PI * (i - s + att) / att) : i < e ? 1 : 0.5 + 0.5 * Math.cos(Math.PI * (i - e) / rel));
      const kb = 1 - Math.pow(10, -V.duck / 20), ke = 1 - Math.pow(10, -V.duck / 60), G = this.bed;
      const gbl = G ? fftconvolve(hp(G.RL, 250), irl, N) : null, gbr = G ? fftconvolve(hp(G.RR, 250), irr, N) : null;
      const under = (x, gl, gw) => x.map((v, i) => { const b = G ? gw[i] * wet + gl[i] * (0.55 + 0.45 * this.duck[i]) : 0;
        return (v - b) * (1 - ke * d[i]) + b * (1 - kb * d[i]); });
      vo = { d, dL: under(dL, G && G.L, gbl), dR: under(dR, G && G.R, gbr) };
    }
    let mL = hp(dL, 28), mR = hp(dR, 28);
    const peak = () => { let p = 0; for (let i = 0; i < N; i++) p = Math.max(p, Math.abs(mL[i]), Math.abs(mR[i])); return p; };
    let pk = peak(); const dr = 1.15, td = Math.tanh(dr), fl = N_(0.3);
    const sat = (x, i) => Math.tanh(x / pk * dr) / td * (i >= N - fl ? Math.pow(1 - (i - (N - fl)) / (fl - 1), 1.5) : 1);
    let level = '';
    if (vo) {
      // the voice sits `over` dB above the music under it, measured over its clips (their pauses included)
      const vt = zeros(N), on = new Uint8Array(N), uL = hp(vo.dL, 28), uR = hp(vo.dR, 28);
      for (const c of V.clips) { const s = roundEven(c.t * SR); for (let k = 0; k < c.x.length; k++) if (s + k >= 0 && s + k < N) { vt[s + k] += c.x[k]; on[s + k] = 1; } }
      let sv = 0, su = 0;
      for (let i = 0; i < N; i++) if (on[i]) { sv += vt[i] * vt[i]; su += (sat(uL[i], i) ** 2 + sat(uR[i], i) ** 2) / 2; }
      const gv = Math.sqrt(su / sv) * Math.pow(10, V.over / 20);
      for (let i = 0; i < N; i++) { mL[i] = sat(uL[i], i) + vt[i] * gv; mR[i] = sat(uR[i], i) + vt[i] * gv; }
      level = `  voice ${V.over} dB over the music under it`;
    } else for (let i = 0; i < N; i++) { mL[i] = sat(mL[i], i); mR[i] = sat(mR[i], i); }
    pk = peak(); let ss = 0;
    for (let i = 0; i < N; i++) { mL[i] *= 0.89 / pk; mR[i] *= 0.89 / pk; ss += (mL[i] * mL[i] + mR[i] * mR[i]) / 2; }
    const buf = Buffer.alloc(44 + N * 4);
    buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
    buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
    for (let i = 0; i < N; i++) { buf.writeInt16LE(Math.trunc(Math.max(-1, Math.min(1, mL[i])) * 32767), 44 + i * 4); buf.writeInt16LE(Math.trunc(Math.max(-1, Math.min(1, mR[i])) * 32767), 46 + i * 4); }
    fs.writeFileSync(out, buf);
    const pk2 = peak(), rms = Math.sqrt(ss / N);
    console.log('wrote', out, +(N / SR).toFixed(3), 's  peak dBFS', +(20 * Math.log10(pk2)).toFixed(2), ' rms dBFS', +(20 * Math.log10(rms)).toFixed(2) + level);
  }
}

// ---------------------------------------------------------------- moods: the groove under a film
// bed(M, mood, { bpm, bars, key, variant, from }) lays a mood's chords, bass and drums from bar `from` (0 by default) to the
// end card's bar, and a closing chord on the end card. A `from` after 0 leaves the bars before it silent, so the music
// can drop in on an event (the prompt sent), not on frame 1. mood: calm, upbeat, bold, playful, minimal or drive. key: semitones from C (-5 to 6), variant
// 0 or 1 (a second chord progression): film.sh new picks both, so two films of one mood differ. The film's own
// events go on top, louder than the groove.
const tr = (note, k) => hz(note) * Math.pow(2, (k || 0) / 12);
const PROG = {
  calm: [[['C3', 'G3', 'B3', 'E4'], ['A2', 'E3', 'G3', 'C4'], ['F2', 'C3', 'E3', 'A3'], ['G2', 'D3', 'G3', 'B3']],
         [['F2', 'C3', 'E3', 'A3'], ['E2', 'B2', 'D3', 'G3'], ['D2', 'A2', 'C3', 'F3'], ['G2', 'D3', 'F3', 'B3']]],
  upbeat: [[['C3', 'G3', 'C4', 'E4'], ['B2', 'G3', 'B3', 'D4'], ['A2', 'E3', 'G3', 'C4'], ['F2', 'C3', 'F3', 'A3']],
           [['A2', 'E3', 'A3', 'C4'], ['F2', 'C3', 'F3', 'A3'], ['C3', 'G3', 'C4', 'E4'], ['G2', 'D3', 'G3', 'B3']]],
  bold: [[['A2', 'E3', 'A3', 'C4'], ['F2', 'C3', 'F3', 'A3'], ['C3', 'G3', 'C4', 'E4'], ['G2', 'D3', 'G3', 'B3']],
         [['E2', 'B2', 'E3', 'G3'], ['C3', 'G3', 'C4', 'E4'], ['G2', 'D3', 'G3', 'B3'], ['D3', 'A3', 'D4', 'F#4']]],
  playful: [[['C3', 'E3', 'G3', 'A3'], ['F2', 'A2', 'C3', 'D3'], ['A2', 'C3', 'E3', 'G3'], ['G2', 'B2', 'D3', 'E3']],
            [['F2', 'A2', 'C3', 'E3'], ['G2', 'B2', 'D3', 'F3'], ['E2', 'G2', 'B2', 'D3'], ['A2', 'C3', 'E3', 'G3']]],
  minimal: [[['C3', 'G3', 'D4'], ['C3', 'G3', 'D4'], ['A2', 'E3', 'B3'], ['A2', 'E3', 'B3']],
            [['F2', 'C3', 'G3'], ['F2', 'C3', 'G3'], ['C3', 'G3', 'D4'], ['C3', 'G3', 'D4']]],
};
const CLOSE = { drive: ['C3', 'G3', 'C4', 'E4', 'G4'], calm: ['C3', 'G3', 'D4', 'E4', 'B4'], upbeat: ['C3', 'G3', 'C4', 'E4', 'G4'], bold: ['A2', 'E3', 'B3', 'C4', 'E4'],
  playful: ['C3', 'G3', 'A3', 'D4', 'E4'], minimal: ['C3', 'G3', 'D4'] };
const oct = (note, n) => note.slice(0, -1) + (+note.slice(-1) + n);
// breaks: [[t0, t1], ...] seconds where the groove stops dead (a 30 ms fade out, back on the beat at t1), so the event in
// the silence (a prompt typed, a send, the logo's landing) is heard alone and the drop after it lands. Tails ring on.
function bed(M, mood, opt = {}) { M.bus = 'bed'; M.gates = opt.breaks || null; try { layBed(M, mood, opt); } finally { M.bus = null; M.gates = null; } }
function layBed(M, mood, { bpm, bars, key = 0, variant = 0, from = 0 } = {}) {
  const P = PROG[mood === 'drive' ? 'upbeat' : mood]; if (!P) throw new Error(`bed: unknown mood "${mood}" (calm, upbeat, bold, playful, minimal or drive)`);
  const B = 60 / bpm, BAR = 4 * B, TB = n => n * BAR, last = bars - 1, prog = P[variant % 2], F = n => tr(n, key);
  for (let b = from; b < last; b++) {
    const ch = prog[b % 4], root = oct(ch[0], -1), t0 = TB(b);
    if (mood === 'calm') {
      M.add(pad_chord(ch.map(F), BAR, { cutoff: 1300, att: b ? 0.6 : 0.02, rel: 0.8 }), t0, 0.24, { rev: 0.5 });
      M.add(sub_note(F(root), BAR * 0.95), t0, 0.2);
      if (b > 0) { [0, 1.5, 2, 3].forEach((k, i) => M.add(marimba(F(oct(ch[(i + 1) % ch.length], 1)), 0.9, 0.6), t0 + k * B, 0.075, { pan: i % 2 ? 0.25 : -0.25, rev: 0.45 }));
        for (let k = 0; k < 8; k++) M.add(shaker(), t0 + k * B / 2, 0.022, { pan: -0.3 }); }
      if (b > 1) { M.add(kick({ soft: true }), t0, 0.3); M.pump(t0, 0.15); }
    } else if (mood === 'upbeat') {
      M.add(pad_chord(ch.map(F), BAR, { cutoff: 2300, att: b ? 0.05 : 0.02 }), t0, 0.2, { rev: 0.35 });
      if (b === 0) { M.add(bass_note(F(root), B * 0.9), t0, 0.24); continue; }
      for (let k = 0; k < 4; k++) { const tk = t0 + k * B;
        M.add(kick({ soft: true }), tk, 0.4); M.pump(tk, 0.3);
        M.add(hat({ open: k % 2 === 1 }), tk + B / 2, 0.1, { pan: 0.15 });
        for (let s = 0; s < 4; s++) M.add(shaker(), tk + s * B / 4, s % 2 ? 0.028 : 0.04, { pan: -0.3 });
        if (b > 1 && k % 2) M.add(clap(), tk, 0.07, { rev: 0.2 });
        M.add(bass_note(F(root), B * 0.42), tk, 0.24); M.add(bass_note(F(oct(root, 1)), B * 0.42), tk + B / 2, 0.16); }
    } else if (mood === 'bold') {
      M.add(pad_chord(ch.map(F), BAR, { cutoff: 1700, att: b ? 0.08 : 0.02 }), t0, 0.2, { rev: 0.3 });
      if (b === 0) { M.add(sub_boom(1.3, 62, 32), t0, 0.3); continue; }
      if (b % 4 === 0) { M.add(crash(1.4), t0, 0.07, { rev: 0.3 }); M.add(sub_boom(1.1, 60, 32), t0, 0.22); }
      if (b % 4 === 3 && b + 1 < last) M.add(reverse_swell(BAR / 2), t0 + BAR / 2, 0.1);
      for (let k = 0; k < 4; k++) { const tk = t0 + k * B;
        M.add(kick(), tk, 0.42); M.pump(tk, 0.4);
        if (k % 2) M.add(clap(), tk, 0.1, { rev: 0.25 });
        M.add(hat(), tk, 0.06, { pan: 0.2 }); M.add(hat(), tk + B / 2, 0.1, { pan: 0.2 });
        M.add(bass_note(F(root), B * 0.45, 700), tk, 0.28); M.add(bass_note(F(root), B * 0.45, 700), tk + B / 2, 0.22); }
    } else if (mood === 'playful') {
      M.add(pad_chord(ch.map(F), BAR, { cutoff: 1800, att: b ? 0.1 : 0.02 }), t0, 0.14, { rev: 0.4 });
      const run = [0, 2, 3, 1, 3, 2, 1, 2].map(i => oct(ch[i % ch.length], 2));
      run.forEach((nn, k) => M.add(marimba(F(nn), 0.5, 1), t0 + k * B / 2, b ? 0.075 : 0.05, { pan: k % 2 ? 0.3 : -0.3, rev: 0.3 }));
      M.add(bass_note(F(root), B * 0.8), t0, 0.24); M.add(bass_note(F(oct(ch[2], -1)), B * 0.8), t0 + 2 * B, 0.2);
      if (b === 0) continue;
      [0, 2].forEach(k => { M.add(kick({ soft: true }), t0 + k * B, 0.36); M.pump(t0 + k * B, 0.2); });
      for (let k = 0; k < 8; k++) M.add(shaker(), t0 + k * B / 2, 0.03, { pan: -0.25 });
      M.add(pop(900, 320, 0.1), t0 + 3.5 * B, 0.05, { pan: 0.3 });
      if (b > 1) M.add(clap(), t0 + 3 * B, 0.05, { rev: 0.3 });
    } else if (mood === 'drive') {   // the launch-film groove: the low end is the music, the top is quiet
      M.add(pad_chord(ch.map(F), BAR, { cutoff: 2200, att: 0.02, rel: 0.3 }), t0, 0.34, { rev: 0.3 });
      M.add(sub_note(F(root), BAR * 0.97), t0, 0.12);
      if (b % 4 === 0 && b > from) M.add(crash(1.4), t0, 0.05, { rev: 0.3 });
      for (let k = 0; k < 4; k++) { const tk = t0 + k * B;
        M.add(kick(), tk, 0.5); M.pump(tk, 0.4, 0.11);
        if (k % 2) { M.add(clap(), tk, 0.2, { rev: 0.18 }); M.add(lp(noise(0.16), 2400).map((v, i) => v * Math.exp(-(i / SR) / 0.05)), tk, 0.16); }
        M.add(hat(), tk + B / 2, 0.045, { pan: 0.15 });
        M.add(bass_note(F(root), B * 0.4, 700), tk + B / 2, 0.24); M.add(bass_note(F(oct(root, 1)), B * 0.3, 900), tk + 3 * B / 4, 0.12); }
    } else {   // minimal: no drums; a swell, a low note, a clock; the film's events carry the sound
      M.add(pad_chord(ch.map(F), BAR, { cutoff: 1000, att: b ? 1.0 : 0.3, rel: 1.0 }), t0, 0.12, { rev: 0.6 });
      M.add(sub_note(F(root), BAR * 0.9), t0, 0.16);
      if (b > 0) for (let k = 0; k < 4; k++) M.add(tick(2200, 0.015), t0 + k * B, k ? 0.02 : 0.03, { pan: 0.1 });
    }
  }
  M.add(pad_chord(CLOSE[mood].map(F), BAR, { cutoff: 2600, att: 0.08, rel: 0.5 }), TB(last), 0.34, { rev: 0.5 });
}

// cue(M, kind, t, gain): the sound of a change of scene at t, the edit style's own, from the recorded sounds. push (glide):
// a swoosh through the move; cut (punch): a dry thump and a click on the downbeat; zoom (dive): a breath in and a low boom
// out; veil (type): the swoosh in, then a soft impact as it covers; slide (deck): a low swoosh.
function cue(M, kind, t, gain = 1) {
  const g = gain, S = sample, rev = x => Float64Array.from(x).reverse();
  if (kind === 'push') M.add(S('motion/swoosh'), t - 0.05, 0.22 * g, { pan: 0.2 });
  else if (kind === 'cut') { M.add(S('impact/soft'), t, 0.3 * g); M.add(S('ui/click'), t, 0.1 * g); }
  else if (kind === 'zoom') { M.add(rev(S('motion/swoosh_long')), t - 1.85, 0.12 * g); M.add(S('impact/boom'), t, 0.22 * g); }
  else if (kind === 'veil') { M.add(S('motion/swoosh'), t - 0.3, 0.2 * g, { pan: -0.2 }); M.add(S('impact/soft'), t, 0.25 * g); }
  else if (kind === 'slide') M.add(S('motion/whoosh_low'), t - 0.1, 0.2 * g, { pan: -0.2 });
  else throw new Error(`cue: unknown change "${kind}" (push, cut, zoom, veil or slide)`);
}

// the series signature, identical in every film: a soft impact as the dot lands in the wordmark (t_land), then one clean
// ding (t_chime), recorded. Keep the ding for this alone, so the series ends on one sound and no event borrows it.
function sonic_logo(M, t_land, t_chime, gain = 1.0) {
  M.add(sample('impact/soft'), t_land, 0.42 * gain);
  M.add(sample('ui/ding'), t_chime, 0.38 * gain, { rev: 0.35 });
}

// ---------------------------------------------------------------- the voice
// voice(M, id, { duck, over }) places a film's narrator: the clips in films/<id>.voice.json (film.sh <id> voice writes
// it from the lines on screen), each where its words appear. Centred and dry, every line at one loudness, its peaks
// held about 8 dB over it. duck: dB the groove drops under the voice (10; the film's events drop a third of that, so a
// tap still reads under a word); over: dB the voice then sits above the music under it (10).
function voice(M, id, { over = 10, duck = 10 } = {}) {
  if (process.env.NOVOICE) return;   // the music alone
  const dir = require.main ? path.dirname(require.main.filename) : process.cwd(), mf = path.join(dir, id + '.voice.json');
  if (!fs.existsSync(mf)) throw new Error(`voice: ${id}.voice.json is missing. film.sh ${id} audio writes it (so does film.sh ${id} voice).`);
  const V = JSON.parse(fs.readFileSync(mf, 'utf8'));
  M.voice = { over, duck, clips: V.lines.map(l => ({ t: l.at - (l.pre || 0), x: voiceClip(path.join(dir, l.file)) })) };
}
function readWav(file) {
  const b = fs.readFileSync(file); let o = 12, sr = SR, ch = 1, bits = 16, fmt = 1, data = null;
  while (o < b.length - 8) { const id = b.toString('ascii', o, o + 4), sz = b.readUInt32LE(o + 4);
    if (id === 'fmt ') { fmt = b.readUInt16LE(o + 8); ch = b.readUInt16LE(o + 10); sr = b.readUInt32LE(o + 12); bits = b.readUInt16LE(o + 22); }
    if (id === 'data') { data = b.subarray(o + 8, o + 8 + sz); break; } o += 8 + sz + (sz & 1); }
  const n = data.length / (bits / 8) / ch, x = zeros(n), f = fmt === 3 && bits === 32;
  for (let i = 0; i < n; i++) { let s = 0; for (let c = 0; c < ch; c++) { const j = (i * ch + c) * bits / 8; s += f ? data.readFloatLE(j) : data.readInt16LE(j) / 32768; } x[i] = s / ch; }
  return { sr, x };
}
const sinc = u => u === 0 ? 1 : Math.sin(Math.PI * u) / (Math.PI * u);
function resample(x, from, to) {                  // windowed sinc (Lanczos, 16 lobes)
  if (from === to) return x;
  const r = from / to, fc = Math.min(1, to / from), w = 16 / fc, y = zeros(Math.floor(x.length / r));
  for (let i = 0; i < y.length; i++) { const p = i * r; let s = 0;
    for (let k = Math.max(0, Math.ceil(p - w)); k <= Math.min(x.length - 1, Math.floor(p + w)); k++) s += x[k] * fc * sinc(fc * (p - k)) * sinc((p - k) / w);
    y[i] = s; }
  return y;
}
// ---------------------------------------------------------------- recorded sounds (engine/sounds/, CC0: sounds/LICENSE.md)
// The film's element sounds are recordings, not synthesis: a real keyboard, real swooshes, real impacts and short UI
// tones. sample('keys/key03') returns one at SR, its peak at 1, so a score sets its level with add's gain.
// sounds() lists the names. The synthesized hits above stay for the groove and for what no recording covers.
const SOUNDS = path.join(__dirname, '..', 'sounds'), _samples = {};
function sample(name) {
  if (!_samples[name]) {
    const f = path.join(SOUNDS, name + '.wav');
    if (!fs.existsSync(f)) throw new Error(`sample: no sound '${name}' (sounds() lists them)`);
    const { sr, x } = readWav(f), y = sr === SR ? x : resample(x, sr, SR);
    let p = 0; for (const v of y) p = Math.max(p, Math.abs(v));
    _samples[name] = y.map(v => v / (p || 1));
  }
  return _samples[name];
}
function sounds() {
  const out = [];
  for (const d of fs.readdirSync(SOUNDS)) { const dd = path.join(SOUNDS, d); if (fs.statSync(dd).isDirectory())
    for (const f of fs.readdirSync(dd)) if (f.endsWith('.wav')) out.push(d + '/' + f.slice(0, -4)); }
  return out.sort();
}
// a line typed: one recorded key per time (a different key each, never the same twice in a row), the space bar on a
// space when the text is given, each a little louder or softer and placed a little left or right, as a hand types
const KEYS = 14, hh = i => { const v = Math.sin(i * 91.7 + 13.3) * 43758.5453; return v - Math.floor(v); };
function typing(M, times, gain = 0.3, { text = null, pan = 0.3 } = {}) {
  let last = -1;
  times.forEach((t, i) => {
    let k = Math.floor(hh(i + times.length * 3) * KEYS); if (k === last) k = (k + 5) % KEYS; last = k;
    const s = text && text[i] === ' ' ? sample('keys/space') : sample('keys/key' + String(k + 1).padStart(2, '0'));
    M.add(s, t, gain * (0.75 + 0.5 * hh(i * 7 + 1)), { pan: (hh(i * 3 + 2) - 0.5) * pan });
  });
}

function voiceClip(file) {
  const { sr, x: raw } = readWav(file), x = hp(resample(raw, sr, SR), 80), fr = N_(0.01), ms = [];
  for (let i = 0; i + fr <= x.length; i += fr) { let s = 0; for (let j = i; j < i + fr; j++) s += x[j] * x[j]; ms.push(s / fr); }
  const gate = Math.max(...ms) / 1000, act = ms.filter(v => v > gate);   // the words, not the pauses: 30 dB under the loudest
  const k = 1 / Math.sqrt(act.reduce((a, v) => a + v, 0) / act.length);
  // a limiter: 5 ms look-ahead, 60 ms release, peaks held at 2.5 times the speech's loudness
  const T = 2.5, la = N_(0.005), g = new Float64Array(x.length).fill(1), rc = 1 - Math.exp(-1 / (0.06 * SR));
  for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i] * k); if (a > T) for (let j = Math.max(0, i - la); j <= i; j++) g[j] = Math.min(g[j], T / a); }
  for (let i = 1; i < g.length; i++) g[i] = Math.min(g[i], g[i - 1] + (1 - g[i - 1]) * rc);
  const y = zeros(x.length); let s = 0;
  for (let i = 0; i < x.length; i++) { s += g[i]; if (i >= la) s -= g[i - la]; y[i] = x[i] * k * s / Math.min(i + 1, la); }
  return y;
}

module.exports = { SR, tvec, noise, map, mul, mix, phaseOf, linspace, bp, hp, lp, hz, saw, env_adsr, rngOf,
  kick, clap, hat, shaker, crash, sub_boom, whoosh, riser, reverse_swell, blip, tick, pop, bell, thock, glide, sonar, thud, marimba,
  clack, key, buzz, odometer, pad_chord, bass_note, sub_note, fftconvolve, Mix, sonic_logo, bed, cue, tr, voice, readWav, resample,
  sample, sounds, typing,
  _reseed: s => { rng = rngOf(s); } };
