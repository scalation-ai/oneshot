// The film's music: a track the user brings, or one from the engine's catalogue of CC0 tracks (data/music.json).
//   node tracks.cjs list [mood]                       the catalogue: each track's tempo, moods and where it drops
//   node tracks.cjs show <project> <film>            the film's music bar by bar
//   node tracks.cjs use <project> <film> <id|file>    the film's music: fetched (or copied in), measured, its licence
//                                                     written beside it in <project>/music/, and set in films.json;
//                                                     a film at another tempo is moved to the track's
//   node tracks.cjs fetch <project> <id>              a catalogue track into <project>/music/ (sfx.js music() runs it
//                                                     when the file is gone, as on a fresh checkout)
//   node tracks.cjs prepare <project> <id|file>       fetched and measured, its films.json entry printed last (new.cjs)
// A catalogue track is fetched from its Free Music Archive file and kept only if every byte matches its sha256. Each
// track in music/ has <name>.json beside it (tools/music.cjs: tempo, bar lines, how loud each bar is) and
// <name>.LICENSE.txt. A file the user brings is theirs to have licensed: its licence file says so.
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), https = require('https');
const { spawnSync } = require('child_process');
const CAT = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'music.json'), 'utf8'));
const die = m => { console.error(m); process.exit(1); };

function get(url, hops = 5) {
  return new Promise((ok, no) => https.get(url, { headers: { 'User-Agent': 'oneshot' } }, r => {
    if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location && hops) { r.resume(); return ok(get(new URL(r.headers.location, url).href, hops - 1)); }
    if (r.statusCode !== 200) { r.resume(); return no(new Error(`${url}: HTTP ${r.statusCode}`)); }
    const parts = []; r.on('data', c => parts.push(c)); r.on('end', () => ok(Buffer.concat(parts))); r.on('error', no);
  }).on('error', no));
}
const sha = b => crypto.createHash('sha256').update(b).digest('hex');

// a catalogue track into <project>/music/<id>.mp3, with its licence; nothing is fetched when the file there matches
async function fetchTrack(proj, id) {
  const T = CAT.tracks[id]; if (!T) throw new Error(`'${id}' is not in the catalogue: ${Object.keys(CAT.tracks).join(', ')}`);
  const dir = path.join(proj, 'music'), f = path.join(dir, id + '.mp3');
  fs.mkdirSync(dir, { recursive: true });
  if (!(fs.existsSync(f) && sha(fs.readFileSync(f)) === T.sha256)) {
    const b = await get(T.file);
    if (b.length !== T.bytes || sha(b) !== T.sha256)
      throw new Error(`${T.file} is not the file the catalogue lists (${b.length} bytes, sha256 ${sha(b).slice(0, 12)}...): not used`);
    fs.writeFileSync(f, b);
  }
  fs.writeFileSync(path.join(dir, id + '.LICENSE.txt'), [
    `File:         ${id}.mp3`, `Title:        ${T.title}`, `Artist:       ${T.artist}`, `Album:        ${T.album}`,
    `Source page:  ${T.page}`, `Direct file:  ${T.file}`, `sha256:       ${T.sha256}`, `Licence:      ${CAT.licence}`,
    `Confirmed:    ${T.confirmed}`, `Credit line:  Not required. Optional courtesy: "Music: “${T.title}” by ${T.artist} (CC0), via Free Music Archive"`, ''].join('\n'));
  return f;
}

// the track measured into <name>.json (a catalogue track at its listed tempo), then the bars where it rises and drops
function measure(file, bpm) {
  const out = file.replace(/\.[^.]+$/, '.json');
  const r = spawnSync(process.execPath, [path.join(__dirname, 'music.cjs'), file, out, ...(bpm ? ['--bpm', String(bpm)] : [])], { encoding: 'utf8' });
  if (r.status) throw new Error(r.stderr || r.stdout);
  return { M: JSON.parse(fs.readFileSync(out, 'utf8')), text: r.stdout };
}

// a track ready for a film, without touching one: fetched or copied into music/, measured; its info for films.json
async function prepare(proj, what) {
  let id, file, info, say;
  if (CAT.tracks[what]) {
    id = what; file = await fetchTrack(proj, id);
    const T = CAT.tracks[id], { M, text } = measure(file, T.bpm);
    if (Math.abs(M.firstBar - T.firstBar) > 0.03) console.log(`WARN the first bar line measured at ${M.firstBar} s, the catalogue says ${T.firstBar} s: the catalogue's is used`);
    info = { track: id, file: `music/${id}.mp3`, bpm: T.bpm, bar: +(240 / T.bpm).toFixed(4), firstBar: T.firstBar, build: T.build, drop: T.drop };
    say = text.split('\n').filter(l => !/^\s+bar /.test(l) || / (up|down|drop)$/.test(l)).join('\n');
  } else {
    const src = path.resolve(process.env.ONESHOT_CALLER || '.', what); if (!fs.existsSync(src)) throw new Error(`'${what}' is neither a catalogue track (${Object.keys(CAT.tracks).join(', ')}) nor a file`);
    id = path.basename(src).replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'track';
    const dir = path.join(proj, 'music'); fs.mkdirSync(dir, { recursive: true });
    file = path.join(dir, id + path.extname(src).toLowerCase()); if (path.resolve(file) !== src) fs.copyFileSync(src, file);
    const lic = path.join(dir, id + '.LICENSE.txt');
    if (!fs.existsSync(lic)) fs.writeFileSync(lic, `File:     ${path.basename(file)}\nSource:   supplied by the user (${src}), ${new Date().toISOString().slice(0, 10)}\nLicence:  the user's to confirm: write here where it came from and the licence that lets this film use it.\n`);
    const { M, text } = measure(file);
    // where it lands hardest: the first bar marked a drop, else the biggest rise
    let drop = (M.bars.find(b => b.change === 'drop') || {}).bar;
    if (drop == null) { let top = -Infinity; drop = 0; M.bars.forEach((b, i) => { if (i && b.db - M.bars[i - 1].db > top) { top = b.db - M.bars[i - 1].db; drop = b.bar; } }); }
    info = { track: id, file: path.relative(proj, file), bpm: M.bpm, bar: M.bar, firstBar: M.firstBar, build: Math.max(0, drop - 4), drop };
    say = text.trimEnd() + '\n' + `Measured, not chosen: check the tempo (${M.bpm} BPM; a half or double is common) and the drop (bar ${drop}) by ear, or give the right ones in the score's music() cut.`;
  }
  return { info, say };
}

async function use(proj, film, what) {
  const fj = path.join(proj, 'films.json'), F = JSON.parse(fs.readFileSync(fj, 'utf8'));
  if (!F[film]) throw new Error(`no film '${film}' in films.json`);
  if (what === 'none') { F[film].music = 'none'; fs.writeFileSync(fj, JSON.stringify(F, null, 1) + '\n'); console.log(`${film}: no music, only the film's own sounds`); return; }
  const { info, say } = await prepare(proj, what); console.log(say.trimEnd());
  // the film moves to the track's tempo: its bars stay, their length changes (its seconds round to whole bars)
  const f = F[film], bars = Math.max(1, Math.round(f.dur * f.bpm / 240)), was = f.bpm;
  if (Math.abs(info.bpm - f.bpm) > 1e-6) {
    const dur = +(bars * 240 / info.bpm).toFixed(4), rep = (p, re, s) => { const x = fs.readFileSync(p, 'utf8'); if (!re.test(x)) return false; fs.writeFileSync(p, x.replace(re, s)); return true; };
    const srcOk = rep(path.join(proj, 'films', film + '.src.html'), /const BPM=[\d.]+,B=60\/BPM,BAR=4\*B,DUR=(\d+)\*BAR/, (m, n) => `const BPM=${info.bpm},B=60/BPM,BAR=4*B,DUR=${n}*BAR`);
    const scOk = rep(path.join(proj, 'films', f.score || film + '.score.cjs'), /const BPM = [\d.]+,/, `const BPM = ${info.bpm},`);
    f.poster = +(f.poster * was / info.bpm).toFixed(2); f.bpm = info.bpm; f.dur = dur;
    console.log(`${film} moves from ${was} to ${info.bpm} BPM: ${bars} bars, ${dur} s.` + (srcOk && scOk ? '' :
      ` Set BPM to ${info.bpm} by hand in ${srcOk ? '' : `films/${film}.src.html `}${scOk ? '' : `films/${f.score}`}: the line was not the template's.`));
  }
  f.music = info; fs.writeFileSync(fj, JSON.stringify(F, null, 1) + '\n');
  console.log(`${film}: ${info.track}, ${info.bpm} BPM, a bar ${info.bar} s, first bar line ${info.firstBar} s; the build from bar ${info.build}, the drop on bar ${info.drop}. Licence: music/${info.track}.LICENSE.txt`);
}

// the film's music bar by bar, measured again (a catalogue track at its listed tempo)
function show(proj, film) {
  const F = JSON.parse(fs.readFileSync(path.join(proj, 'films.json'), 'utf8'))[film]; if (!F) throw new Error(`no film '${film}' in films.json`);
  const I = F.music; if (!I || I === 'none') { console.log(`${film} has no music. film.sh music lists the catalogue; film.sh ${film} music <track or file> sets one`); return; }
  const f = path.join(proj, I.file); if (!fs.existsSync(f)) throw new Error(`${I.file} is missing: film.sh ${film} music ${I.track} fetches it again`);
  console.log(measure(f, CAT.tracks[I.track] ? I.bpm : 0).text.trimEnd());
  console.log(`${film}: ${I.track}, ${I.bpm} BPM, a bar ${I.bar} s; its build from bar ${I.build}, its drop on bar ${I.drop}. In the score: music(M, '${film}', { drop: <film bar> }) or { cut: [[film bar, track bar, bars], ...] }`);
}

function list(mood) {
  for (const [id, T] of Object.entries(CAT.tracks)) {
    if (mood && !T.moods.includes(mood)) continue;
    console.log(`${id.padEnd(34)} ${String(T.bpm).padStart(3)} BPM  ${T.moods.join(', ').padEnd(22)} drop bar ${String(T.drop).padStart(2)}  ${T.title}, ${T.artist}`);
    console.log(`${''.padEnd(34)} ${T.says}`);
  }
  console.log('Every one CC0 1.0 (public domain): no credit needed. A track the user brings comes first: film.sh <film> music <file>.');
}

module.exports = { CAT, fetchTrack, measure, prepare, use };
if (require.main === module) {
  const [cmd, a, b, c] = process.argv.slice(2);
  const run = p => p.catch(e => die(e.message));
  if (cmd === 'list') list(a);
  else if (cmd === 'use' && c) run(use(path.resolve(a), b, c));
  else if (cmd === 'show' && b) { try { show(path.resolve(a), b); } catch (e) { die(e.message); } }
  else if (cmd === 'fetch' && b) run(fetchTrack(path.resolve(a), b).then(f => console.log('fetched', f)));
  else if (cmd === 'prepare' && b) run(prepare(path.resolve(a), b).then(r => console.log(r.say.trimEnd() + '\n' + JSON.stringify(r.info))));   // for new.cjs
  else die('usage: tracks.cjs list [mood] | use <project> <film> <id|file|none> | fetch <project> <id>');
}
