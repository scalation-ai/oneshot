// node new.cjs <project> <id> phone|desktop|app [seconds] [bpm] [--mood m[,m...]] [--style s] [--open o] [--voice [name]]
//   [--format f[,f]] [--music <track|file|none>]
// Starts a film from its kind's template and registers it in films.json. Whatever is not given is picked at random
// among what fits: the mood (from the list given, or any), the music (a catalogue track of that mood, never the last
// film's: tools/tracks.cjs), the edit style (one that suits the mood, the series' least used, never the last film's) and
// the opening (never the last film's). So no two films of a series are cut or scored the same way. films.json keeps the
// choice. The film is at its track's tempo: its seconds round to whole bars of it. --music <file>: the user's own track
// (it comes before the catalogue); --music none: no music (the bpm then sets the tempo: by default the one nearest
// 120 that gives the length whole bars).
// --voice gives the film a narrator who says each line as it appears: the brand's voice (brand.json), or af_heart,
// or the Kokoro voice named. --format: the cuts it is made in, the first the main one (9:16, 16:9, 1:1, 4:5 or all;
// by default 9:16 and 16:9 for a phone film, 16:9 for the others; a desktop or app film has no 9:16).
'use strict';
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const ENGINE = path.join(__dirname, '..'), proj = path.resolve(process.argv[2]), FILMS = path.join(proj, 'films');
const die = m => { console.error(m); process.exit(1); };
// Kokoro's English voices (a: American, b: British; f, m); its own grades: af_heart A, af_bella A-, af_nicole and
// bf_emma B-, am_fenrir, am_michael and am_puck C+, bm_george and bm_fable C, the rest lower
const VOICES = ['af_heart', 'af_alloy', 'af_aoede', 'af_bella', 'af_jessica', 'af_kore', 'af_nicole', 'af_nova', 'af_river', 'af_sarah',
  'af_sky', 'am_adam', 'am_echo', 'am_eric', 'am_fenrir', 'am_liam', 'am_michael', 'am_onyx', 'am_puck', 'am_santa',
  'bf_alice', 'bf_emma', 'bf_isabella', 'bf_lily', 'bm_daniel', 'bm_fable', 'bm_george', 'bm_lewis'];
const pos = [], opt = {};
for (let i = 3; i < process.argv.length; i++) { const a = process.argv[i];
  if (a === '--voice') { const nx = process.argv[i + 1]; opt.voice = nx && /^[a-z]{2}_[a-z]+$/.test(nx) ? (i++, nx) : true; }   // the name is optional
  else if (a.startsWith('--')) opt[a.slice(2)] = process.argv[++i] || ''; else pos.push(a); }
const [id, kind, secsA, bpmA] = pos;
if (!/^[a-z0-9]+$/.test(id || '') || !['phone', 'desktop', 'app'].includes(kind))
  die('usage: film.sh new <id, lowercase letters and digits> phone|desktop|app [seconds] [bpm] [--mood m[,m]] [--style s] [--open o] [--voice [name]] [--format f[,f]]');
const KINDF = kind === 'phone' ? ['9x16', '16x9', '1x1', '4x5'] : ['16x9', '1x1', '4x5'];
let formats = kind === 'phone' ? ['9x16', '16x9'] : ['16x9'];
if (opt.format) {
  formats = opt.format === 'all' ? KINDF : [...new Set(opt.format.split(',').map(s => s.trim().replace(':', 'x')))];
  const bad = formats.filter(x => !KINDF.includes(x));
  if (bad.length || !formats.length) die(`'${bad.join(', ') || opt.format}' is not a format for a ${kind} film: ${KINDF.map(x => x.replace('x', ':')).join(', ')} or all`);
}
const fj = path.join(proj, 'films.json'), F = JSON.parse(fs.readFileSync(fj, 'utf8'));
if (F[id] || fs.existsSync(path.join(FILMS, id + '.src.html'))) die(`'${id}' already exists: pick another id`);
let voiceName = null;
if (opt.voice) {
  const bp = path.join(proj, 'brand.json'), bv = (fs.existsSync(bp) ? JSON.parse(fs.readFileSync(bp, 'utf8')) : {}).voice || {};
  voiceName = opt.voice === true ? bv.name || 'af_heart' : opt.voice;
  if (!VOICES.includes(voiceName)) die(`'${voiceName}' is not a voice. The best: af_heart (the default), af_bella; British bf_emma; male am_michael, am_fenrir, am_puck; British male bm_george, bm_fable. All: ${VOICES.join(', ')}`);
}

const STYLES = { phone: ['glide', 'punch', 'dive', 'type', 'deck'], desktop: ['glide', 'punch', 'dive', 'type', 'deck'], app: ['glide', 'punch', 'dive', 'type'] };
const MOODS = { calm: ['glide', 'dive', 'deck'], upbeat: ['glide', 'punch', 'dive', 'type', 'deck'], bold: ['punch', 'type', 'dive'],
  playful: ['punch', 'type', 'deck'], minimal: ['glide', 'dive', 'type', 'deck'], drive: ['glide', 'punch', 'dive', 'deck'] };
const OPENS = { glide: ['problem', 'closeup', 'result'], punch: ['problem', 'closeup', 'result'], dive: ['closeup', 'result'], type: ['problem'], deck: ['problem', 'result'] };
const CHANGE = { glide: 'push', punch: 'cut', dive: 'zoom', type: 'veil', deck: 'slide' };
const SAYS = { glide: 'one continuous shot, slow pushes, each screen pushes the last away, letters rise',
  punch: 'hard cuts on the downbeat between wide and close, a zoom punch on each event, words pop in',
  dive: 'close in the interface, zooming through into each next screen; the whole device only at the end',
  type: 'each scene opens on its line, large over a veil, then the product plays it out',
  deck: 'the screens as flat cards in a row, sliding from one to the next' };
const OPEN_SAYS = { problem: 'the product showing the problem, the hook under it', closeup: 'close on the detail the hook names, then the camera pulls back',
  result: 'the result first for a bar, then the story from its start' };
const rnd = a => a[Math.floor(Math.random() * a.length)];
const hist = Object.values(F), last = hist[hist.length - 1] || {};
const avoid = (c, prev) => { const d = c.filter(x => x !== prev); return d.length ? d : c; };

const secs = +(secsA || 30);
if (!(secs > 0)) die(`'${secsA}' is not a length in seconds`);
const minBars = s => s === 'type' ? 8 : 6;          // three scenes, the promise and the end card; the type style's scenes need two bars each

const moods = opt.mood ? opt.mood.split(',') : Object.keys(MOODS);
moods.forEach(m => { if (!MOODS[m]) die(`'${m}' is not a mood: drive, calm, upbeat, bold, playful or minimal`); });
const mood = rnd(avoid(moods, last.mood));

// the music, and with it the tempo: a track given, else a catalogue track of the mood the last film did not use
const { CAT } = require('./tracks.cjs');
let what = opt.music;
if (!what) { const c = Object.keys(CAT.tracks).filter(t => CAT.tracks[t].moods.includes(mood));
  what = rnd(avoid(c.length ? c : Object.keys(CAT.tracks), last.music && last.music.track)); }
let music = 'none', bpm = +(bpmA || 0), say = '';
if (what !== 'none') {
  const r = spawnSync(process.execPath, [path.join(__dirname, 'tracks.cjs'), 'prepare', proj, what], { encoding: 'utf8' });
  if (r.status) die(r.stderr || r.stdout);
  const lines = r.stdout.trim().split('\n'); music = JSON.parse(lines.pop()); say = lines.join('\n');
  if (bpm && Math.abs(bpm - music.bpm) > 0.01) die(`${music.track} is at ${music.bpm} BPM: its tempo is the film's. Leave the bpm out, or start with --music none.`);
  bpm = music.bpm;
} else if (!bpm) bpm = [120, 112, 128, 96, 144].find(b => Math.abs(secs * b / 240 - Math.round(secs * b / 240)) < 1e-9) || 120;   // whole bars, near 120
const bars = Math.round(secs * bpm / 240), dur = +(bars * 240 / bpm).toFixed(4);

let style = opt.style;
if (style) { if (!STYLES[kind].includes(style)) die(`'${style}' is not a style for ${kind}: ${STYLES[kind].join(', ')}`); }
else {
  let c = MOODS[mood].filter(s => STYLES[kind].includes(s) && bars >= minBars(s));
  if (!c.length) c = STYLES[kind].filter(s => bars >= minBars(s));
  if (!c.length) die(`${secs} s at ${bpm} BPM is ${bars} bars; a film needs 6 or more: make it longer.`);
  c = avoid(c, last.style);
  const used = s => hist.filter(f => f.style === s).length, least = Math.min(...c.map(used));
  style = rnd(c.filter(s => used(s) === least));
}
if (bars < minBars(style)) die(`${secs} s at ${bpm} BPM is ${bars} bars; the ${style} style needs ${minBars(style)} or more.`);

// the result opening takes the first bar, so the situation needs the next one to itself: 7 bars or more
const opens = OPENS[style].filter(o => o !== 'result' || Math.round((bars - 2) * 0.36) >= 2);
let open = opt.open;
if (open) { if (!opens.includes(open)) die(`'${open}' is not an opening for the ${style} style at ${bars} bars: ${opens.join(', ')}`); }
else open = rnd(avoid(opens, last.open));

// the template, with the blocks for this style, opening and kind (//IF a b ... //END keeps lines when any token fits)
const tokens = new Set([style, 'open:' + open, 'kind:' + kind, 'mood:' + mood, ...(voiceName ? ['voice'] : [])]);
function strip(src) {
  const out = []; let keep = true;
  for (const line of src.split('\n')) {
    const m = line.match(/^\s*\/\/IF (.+)$/);
    if (m) { keep = m[1].trim().split(/\s+/).some(alt => alt.split('+').every(t => tokens.has(t))); continue; }
    if (/^\s*\/\/END\s*$/.test(line)) { keep = true; continue; }
    if (keep) out.push(line);
  }
  return out.join('\n');
}
const V = { ID: id, SECS: secs, BPM: bpm, BARS: bars, STYLE: style, OPEN: open, MOOD: mood,
  CHANGE: CHANGE[style], VEIL: style === 'type' ? 1 : 0, KIND: kind };
const fill = s => strip(s).replace(/__([A-Z]+)__/g, (m, k) => k in V ? String(V[k]) : m)
  .replace(/const BPM=\d+,B=60\/BPM,BAR=4\*B,DUR=\d+\*BAR/, `const BPM=${bpm},B=60/BPM,BAR=4*B,DUR=${bars}*BAR`);
fs.mkdirSync(FILMS, { recursive: true });
fs.writeFileSync(path.join(FILMS, id + '.src.html'), fill(fs.readFileSync(path.join(ENGINE, 'templates', kind + '.src.html'), 'utf8')));
fs.writeFileSync(path.join(FILMS, id + '.score.cjs'), fill(fs.readFileSync(path.join(ENGINE, 'templates', 'score.cjs'), 'utf8')));

// the poster: the result scene once its number has landed (as the templates time it)
const BAR = 240 / bpm, PROM = bars - 2, SC2 = Math.round(PROM * 0.68), rollt = SC2 * BAR + (style === 'type' ? BAR : 0) + 2 * BAR / 4;
F[id] = { title: `${id} ${secs}s`, dur, bpm, tag: '', formats,
  score: `${id}.score.cjs`, wav: `${id}.wav`, out: 'renders', poster: +(rollt + 1.4).toFixed(2), script: '',
  kind, style, open, mood, music, ...(voiceName ? { voice: voiceName } : {}) };
fs.writeFileSync(fj, JSON.stringify(F, null, 1) + '\n');
const run = (...a) => { const r = spawnSync(process.execPath, a, { cwd: FILMS, encoding: 'utf8' }); if (r.status) die(r.stderr || r.stdout); };
run(path.join(ENGINE, 'meta.cjs'), proj); run(path.join(ENGINE, 'build.cjs'), proj, id);
if (!voiceName) run(id + '.score.cjs', id + '.wav');   // a film with a voice gets its soundtrack from film.sh <id> audio

const sc = [0, Math.round(PROM * 0.36), SC2];
console.log(`${say ? say + '\n' : ''}Started ${id} from the ${kind} template: ${dur} s at ${bpm} BPM, ${bars} bars.
  style    ${style}: ${SAYS[style]}
  opening  ${open}: ${OPEN_SAYS[open]}
  mood     ${mood}
  music    ${music === 'none' ? 'none (--music none)' : `${music.track} (${(CAT.tracks[music.track] || {}).title || 'the user\'s'}), its drop on bar ${sc[1]}: music() in the score; film.sh ${id} music shows its bars`}
${voiceName ? `  voice    ${voiceName}: every line says its own words as they appear (film.sh ${id} voice)\n` : ''}  formats  ${formats.map(x => x.replace('x', ':')).join(', ')}
  scenes   bars ${sc.join(', ')}; the promise on bar ${PROM}, the end card on bar ${bars - 1}
${opt.style && opt.open && opt.mood && opt.music ? '' : 'Picked at random among what fits, unlike the last film. To choose instead, start again with --style, --open, --mood or --music.\n'}Edit films/${id}.src.html and films/${id}.score.cjs; set its title and tag in films.json. Next: film.sh ${id} check`);
