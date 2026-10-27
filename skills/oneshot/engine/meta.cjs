// node meta.cjs <project> [<film> [phone|wide|square|4x5]]  rewrites films/films.js (the list studio.html plays) from the
// project's films.json, so a film is registered once; with a film, also prints its settings as shell
// variables for film.sh.
//
// films.json, one entry per film:
//   title    output name stem, e.g. "01 Reminders 15s" (the format and PREVIEW are appended)
//   dur      seconds; bpm its tempo (dur must be a whole number of bars)
//   tag      a short label the studio shows next to the title (a plan, a product, an audience), or ""
//   formats  ["9x16","16x9"] for a phone film (16x9 is its wide cut), ["16x9"] for a desktop film; any film may add
//            "1x1" and "4x5", feed posts (the product above, the lines below)
//   score    the score that writes the soundtrack (films/<id>.score.cjs); wav the soundtrack it writes
//   out      output folder inside the project, "renders" by default; poster: the second used for the poster frame
//   script   where its script is, for people
//   voice    the narrator (a Kokoro voice, e.g. "af_heart") for a film with a voice; left out, the film has none
//   optional: html (built file, in films/), q (query per format)
'use strict';
const fs = require('fs'), path = require('path');
// the page query of a film's format: a phone film's 16:9 cut is ?w=1, a feed post ?f=1x1 or ?f=4x5
const SIZE = { '9x16': [1080, 1920], '16x9': [1920, 1080], '1x1': [1080, 1080], '4x5': [1080, 1350] };
const query = (f, fmt) => f.q ? (f.q[fmt] || '') : fmt === '1x1' || fmt === '4x5' ? '&f=' + fmt
  : (fmt === '16x9' && f.kind !== 'desktop' && f.kind !== 'app' && !(f.formats.length === 1 && f.formats[0] === '16x9') ? '&w=1' : '');
module.exports = { query, SIZE };
if (require.main !== module) return;
const proj = path.resolve(process.argv[2]);
const FILMS = JSON.parse(fs.readFileSync(path.join(proj, 'films.json'), 'utf8'));

const studio = Object.entries(FILMS).map(([k, f]) => ({ id: k, title: f.title, tag: f.tag || '', dur: f.dur, bpm: f.bpm,
  src: 'films/' + (f.html || k + '.html'), wav: 'films/' + f.wav, formats: f.formats,
  q: Object.fromEntries(f.formats.map(fm => [fm, query(f, fm).replace(/^&/, '')])), note: f.note || '' }));
fs.mkdirSync(path.join(proj, 'films'), { recursive: true });
fs.writeFileSync(path.join(proj, 'films', 'films.js'), '// written by meta.cjs from films.json; edit films.json instead\nwindow.MOTION_FILMS=' + JSON.stringify(studio, null, 1) + ';\n');

const k = process.argv[3];
if (!k) process.exit(0);
const die = m => { console.error(m); process.exit(1); };
if (!FILMS[k]) die(`Unknown film '${k}'. Films in films.json: ${Object.keys(FILMS).join(', ') || 'none yet'}. Start one with: film.sh new <id> phone|desktop`);
const f = FILMS[k], word = process.argv[4] || '';
const WORDS = { '': f.formats[0], wide: '16x9', phone: '9x16', square: '1x1', '16x9': '16x9', '9x16': '9x16', '1x1': '1x1', '4x5': '4x5' };
if (!Object.hasOwn(WORDS, word)) die(`'${word}' is not a format: use phone (9x16), wide (16x9), square (1x1) or 4x5, or nothing for the film's first.`);
const want = WORDS[word];
if (!f.formats.includes(want)) die(`'${k}' has no ${want} cut (it has ${f.formats.join(', ')}).`);
const [W, H] = SIZE[want];
const q = s => "'" + String(s).replace(/'/g, "'\\''") + "'";
const v = { ID: k, TITLE: f.title, DUR: f.dur, BPM: f.bpm, FR: Math.round(f.dur * 60), FMT: want, W, H, Q: query(f, want),
  HTML: f.html || k + '.html', SCORE: f.score, WAV: f.wav, OUTD: path.join(proj, f.out || 'renders'), POSTER: f.poster || 0,
  VOICE: f.voice || '' };
console.log(Object.entries(v).map(([a, b]) => `${a}=${q(b)}`).join('\n'));
