// node voice.cjs <project> <film>   (film.sh <film> voice)   the narrator of a film with a voice
// Reads what the film says from the built page, in every format (each BandLine says its own words, `say` respells
// them, Say() adds more), speaks each line with Kokoro in the film's voice, trims the silence around it, and writes
// films/<film>.voice.json: each clip, when it starts and when its words leave the screen. The score places the clips
// with voice(M, '<film>'). Clips are kept in films/voice/, named after their words and voice, so only a changed line
// is spoken again, and the same words always give the same clip.
// node voice.cjs --setup   loads the model (downloading it the first time) and speaks one test line
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const { createRequire } = require('module');
const ENGINE = path.join(__dirname, '..'), VOICE_DIR = path.join(ENGINE, 'voice');
const MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX', DTYPE = 'fp32', LEAD = 0.2;   // the voice starts 0.2 s after its words do
const PRE = 0.03, POST = 0.08;   // a clip keeps 30 ms before its first word and 80 ms after its last (Kokoro pads ~0.3 s)
// the model lives in a shared cache, like Playwright's Chrome, so an update of the skill does not fetch it again
// (a model already fetched under the skill's old name, motion-clip, is used where it is)
const cacheDir = n => process.platform === 'darwin' ? path.join(os.homedir(), 'Library', 'Caches', n)
  : path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache'), n);
const CACHE = process.env.ONESHOT_CACHE || process.env.MOTION_CLIP_CACHE
  || (!fs.existsSync(cacheDir('oneshot')) && fs.existsSync(cacheDir('motion-clip')) ? cacheDir('motion-clip') : cacheDir('oneshot'));
const die = (m, code = 1) => { console.error(m); process.exit(code); };
const s2 = x => x.toFixed(2).padStart(6);

let tts = null;
async function model() {
  if (tts) return tts;
  if (!fs.existsSync(path.join(VOICE_DIR, 'node_modules', 'kokoro-js')))
    die(`The voice is not set up yet. Run once: bash "${path.join(ENGINE, 'setup.sh')}" --voice\n` +
      '(about 410 MB of packages inside the engine, and a 320 MB voice model in a shared cache)', 2);
  const lock = f => { try { return fs.readFileSync(path.join(VOICE_DIR, f), 'utf8'); } catch (e) { return null; } };
  if (process.argv[2] !== '--setup' && lock('package-lock.json') !== lock('node_modules/.oneshot-setup'))   // setup.sh keeps the lock it installed
    die(`The skill was updated since the voice was set up. Run once: bash "${path.join(ENGINE, 'setup.sh')}" --voice`, 2);
  const req = createRequire(path.join(VOICE_DIR, 'package.json')), { KokoroTTS } = req('kokoro-js');
  req('@huggingface/transformers').env.cacheDir = CACHE;   // kokoro-js's own `env` is another object: it would not move the cache
  const seen = {};
  const progress_callback = e => {   // the first time only: the model is a 320 MB download
    if (e.status !== 'progress' || !e.total || e.total < 5e6) return;
    const p = Math.floor(e.progress / 10) * 10;
    if (p > (seen[e.file] ?? -10)) { seen[e.file] = p; console.log(`     downloading the voice model: ${p}% of ${(e.total / 1e6).toFixed(0)} MB`); }
  };
  tts = await KokoroTTS.from_pretrained(MODEL, { dtype: DTYPE, device: 'cpu', progress_callback });
  return tts;
}

// speak one line, trimmed to its words and the two margins
async function speak(text, voice, speed) {
  const a = await (await model()).generate(text, { voice, speed });
  const x = a.audio, sr = a.sampling_rate, fr = Math.round(sr / 100), rms = [];
  for (let i = 0; i + fr <= x.length; i += fr) { let s = 0; for (let j = i; j < i + fr; j++) s += x[j] * x[j]; rms.push(Math.sqrt(s / fr)); }
  const gate = Math.max(...rms) / 100;                                // 40 dB under the loudest 10 ms
  const on = rms.findIndex(v => v > gate), off = rms.length - 1 - [...rms].reverse().findIndex(v => v > gate);
  const i0 = Math.max(0, on * fr - Math.round(PRE * sr)), i1 = Math.min(x.length, (off + 1) * fr + Math.round(POST * sr));
  return { sr, x: x.subarray(i0, i1) };
}
function writeWav(file, { sr, x }) {                                  // 16-bit mono
  const b = Buffer.alloc(44 + x.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + x.length * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(x.length * 2, 40);
  for (let i = 0; i < x.length; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, x[i])) * 32767), 44 + i * 2);
  fs.writeFileSync(file, b);
}

(async () => {
  if (process.argv[2] === '--setup') {
    const t0 = Date.now(), c = await speak('Your voice is ready.', 'af_heart', 1);
    console.log(`     spoke a test line: ${(c.x.length / c.sr).toFixed(2)} s of speech in ${((Date.now() - t0) / 1000).toFixed(0)} s (model in ${CACHE})`);
    return;
  }
  const proj = path.resolve(process.argv[2]), id = process.argv[3], FILMS = path.join(proj, 'films');
  const F = JSON.parse(fs.readFileSync(path.join(proj, 'films.json'), 'utf8')), f = F[id];
  if (!f) die(`Unknown film '${id}'.`);
  if (!f.voice) die(`'${id}' has no voice. Give it one in films.json ("voice": "af_heart"), or start a film with film.sh new ... --voice.`);
  const brandF = path.join(proj, 'brand.json'), bv = (fs.existsSync(brandF) ? JSON.parse(fs.readFileSync(brandF, 'utf8')) : {}).voice || {};
  const speed = +bv.speed || 1, words = bv.words || {};
  // the brand's respellings, whole words only: {"paylark": "pay lark"}
  const respell = s => Object.entries(words).reduce((a, [w, r]) => a.replace(new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), r), s);

  const { chromium } = require('./pw.cjs'), { query, SIZE } = require('../meta.cjs'), said = require('./said.cjs');
  const html = path.join(FILMS, f.html || id + '.html'), browser = await chromium.launch();
  const per = [];
  for (const fmt of f.formats) per.push(await said(browser, html, query(f, fmt), ...SIZE[fmt]).catch(e => die(e.message)));
  await browser.close();
  const base = per[0].said, notes = [];
  if (per.some(r => r.said.length !== base.length)) notes.push('The formats say different lines: the voice follows the first format, ' + f.formats[0] + '.');
  // a line's words leave at its earliest exit across the formats (a 16:9 line may leave earlier, toutW)
  const lines = base.map((l, i) => { const u = per.map(r => (r.said[i] || l).until).filter(v => v != null);
    return { text: String(l.text).replace(/\s+/g, ' ').trim(), how: l.say ? String(l.say).trim() : null, tin: l.tin, at: l.at != null ? l.at : Math.max(l.tin ?? 0, 0) + LEAD,
      until: u.length ? Math.min(...u) : null }; }).filter(l => l.text);
  if (!lines.length) die(`'${id}' says nothing: it has no BandLine and no Say(). Nothing to speak.`);

  const ver = require(path.join(VOICE_DIR, 'package.json')).dependencies['kokoro-js'];
  const dir = path.join(FILMS, 'voice'); fs.mkdirSync(dir, { recursive: true });
  let spoken = 0;
  for (const l of lines) {
    const say = respell(l.how || l.text), key = crypto.createHash('sha1').update(JSON.stringify([ver, MODEL, DTYPE, f.voice, speed, say])).digest('hex').slice(0, 16);
    l.file = `voice/${key}.wav`;
    const p = path.join(FILMS, l.file);
    if (!fs.existsSync(p)) { writeWav(p, await speak(say, f.voice, speed)); spoken++; }
    const b = fs.readFileSync(p); l.dur = +((b.length - 44) / 2 / b.readUInt32LE(24) - PRE - POST).toFixed(3);   // the words alone
    l.pre = PRE;                                                      // the clip starts this long before `at`
    if (say !== l.text) l.say = say;
  }
  fs.writeFileSync(path.join(FILMS, id + '.voice.json'), JSON.stringify({ voice: f.voice, speed, lines: lines.map(({ tin, how, ...l }) => l) }, null, 1) + '\n');

  // the report: every clip must be over before its words leave the screen, and clear of the next one
  console.log(`${id}: ${lines.length} lines in the voice ${f.voice}${speed !== 1 ? ` at ${speed}x` : ''} (${spoken} spoken now, ${lines.length - spoken} kept)`);
  lines.forEach((l, i) => {
    const end = l.at + l.dur, nx = lines[i + 1], w = [];
    if (l.tin != null && l.at < l.tin - 0.05) w.push(`starts ${(l.tin - l.at).toFixed(2)} s before its words appear`);
    if (l.until != null && end > l.until + 0.1) w.push(`runs ${(end - l.until).toFixed(2)} s past its words leaving (${l.until.toFixed(2)} s): fewer words, or hold the line longer`);
    if (nx && end + 0.25 > nx.at) w.push(`runs into the next line's voice (${nx.at.toFixed(2)} s)`);
    if (end > f.dur) w.push('runs past the end of the film');
    console.log(`  ${s2(l.at)} to ${s2(end)}  "${l.text}"${l.say ? ` (says "${l.say}")` : ''}${w.length ? '\n          warning: ' + w.join('; ') : ''}`);
  });
  notes.forEach(n => console.log('  note: ' + n));
  console.log(`wrote films/${id}.voice.json; film.sh ${id} audio mixes it into the soundtrack`);
})().catch(e => die(e.stack || String(e)));
