// node onsets.cjs <soundtrack.wav> <bpm> [n] [<film>.voice.json]   the n strongest hits and the bar lines, to check
// sound lands on picture. Measured above 100 Hz, what a phone speaker plays (a sub's slow cycles would otherwise read
// as a string of hits), in 20 ms windows every 10 ms. A hit is a rise in loudness; rises within 60 ms of a stronger
// one are the same hit. With a voice's timings (film.sh passes them, and the music without the voice), its clips are
// listed too, and the hits that land under a word.
'use strict';
const fs = require('fs');
const { SR, hp } = require('../lib/sfx.js');
const [,, file, bpmS, nS, voiceF] = process.argv;
const b = fs.readFileSync(file);
let o = 12, sr = 48000, ch = 2, data = null;                  // walk the RIFF chunks for fmt and data
while (o < b.length - 8) { const id = b.toString('ascii', o, o + 4), sz = b.readUInt32LE(o + 4);
  if (id === 'fmt ') { ch = b.readUInt16LE(o + 10); sr = b.readUInt32LE(o + 12); }
  if (id === 'data') { data = b.subarray(o + 8, o + 8 + sz); break; } o += 8 + sz + (sz & 1); }
const n = data.length / 2 / ch, x = new Float64Array(n);
for (let i = 0; i < n; i++) { let s = 0; for (let c = 0; c < ch; c++) s += data.readInt16LE((i * ch + c) * 2); x[i] = s / ch / 32768; }
const y = hp(x, 100 * SR / sr);                               // the kit's filters are designed at its own rate
const bpm = +bpmS, top = +nS || 16, hop = Math.floor(sr / 100), win = 2 * hop, e = [];
for (let i = 0; i + win <= n; i += hop) { let s = 0; for (let j = i; j < i + win; j++) s += y[j] * y[j]; e.push(Math.sqrt(s / win)); }
const d = e.slice(1).map((v, i) => Math.max(0, v - e[i]));  // d[i]: the rise into window i+1
const picked = [];
for (const [v, i] of d.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0])) {
  if (!v || picked.length >= top) break;
  if (picked.every(k => Math.abs(k - i) >= 6)) picked.push(i); }
const at = i => ((i + 1) * hop + win / 2) / sr;               // the middle of the window the hit rises into
let pk = 0; for (const v of x) pk = Math.max(pk, Math.abs(v));
console.log(`${(n / sr).toFixed(2)} s, peak ${(20 * Math.log10(pk + 1e-9)).toFixed(1)} dBFS`);
console.log('strongest hits (s):', picked.sort((a, b) => a - b).map(i => at(i).toFixed(2)).join(', '));
const bar = 240 / bpm; console.log('bar lines (s):     ', Array.from({ length: Math.floor(n / sr / bar) + 1 }, (_, k) => (k * bar).toFixed(2)).join(', '));
if (voiceF && fs.existsSync(voiceF)) {
  const V = JSON.parse(fs.readFileSync(voiceF, 'utf8')).lines, under = picked.map(at).filter(t => V.some(l => t >= l.at && t <= l.at + l.dur));
  console.log('the voice (s):     ', V.map(l => `${l.at.toFixed(2)} to ${(l.at + l.dur).toFixed(2)}`).join(', '));
  console.log(under.length ? `hits under a word:  ${under.map(t => t.toFixed(2)).join(', ')} (the groove ducks 10 dB there, the events 3 dB)` : 'no strong hit lands under a word');
}
