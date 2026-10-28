// node gallery.cjs <outDir> [project]   (film.sh gallery)   the library's moves and the edit styles, to pick by looking.
// Each demo becomes a contact sheet, sheets/<name>.png: six frames across it and, under them, the fastest travel on
// screen per 60 fps frame (what the renderer sizes its motion blur by, tools/reader.js), the frames' times marked on it.
// index.html plays every demo live and links its sheet.
//   moves     templates/gallery.src.html: each move of moves.js on its own (springs, squash, kick, the operator, the
//             rig, chase, a shared element, the iris, the lattice), at the values references/moves.md gives a film
//   styles    a 15 s phone film from film.sh new in each edit style, around its first change of scene
//   openings  the same film in glide with each opening, over its first two bars
// With a project, everything is drawn in its brand (brand.json, its fonts/ and brand/ folders); without one, or when
// the brand will not build here, in the engine's defaults. The demos are built in <outDir>/project, a throwaway
// project of their own: the user's films.json is never touched.
'use strict';
const { chromium } = require('./pw.cjs');
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process'), { pathToFileURL } = require('url');
const ENGINE = path.join(__dirname, '..'), out = path.resolve(process.argv[2] || 'gallery'), from = process.argv[3] && path.resolve(process.argv[3]);
const P = path.join(out, 'project'), FILMS = path.join(P, 'films'), SHEETS = path.join(out, 'sheets');
const t0 = Date.now(), die = m => { console.error(m); process.exit(1); };
const run = (...a) => spawnSync(process.execPath, a, { cwd: FILMS, encoding: 'utf8', env: { ...process.env, NODE_PATH: path.join(ENGINE, 'lib') } });   // new.cjs runs the score: require('sfx')

for (const d of [P, SHEETS]) fs.rmSync(d, { recursive: true, force: true });
fs.mkdirSync(FILMS, { recursive: true }); fs.mkdirSync(SHEETS, { recursive: true });
fs.writeFileSync(path.join(P, 'films.json'), '{}');
fs.copyFileSync(path.join(ENGINE, 'templates', 'gallery.src.html'), path.join(FILMS, 'gallery.src.html'));
// the brand: its brand.json, and its fonts/ and brand/ folders linked, not copied
let brand = !!(from && fs.existsSync(path.join(from, 'brand.json')));
if (brand) { fs.copyFileSync(path.join(from, 'brand.json'), path.join(P, 'brand.json'));
  for (const d of ['fonts', 'brand']) if (fs.existsSync(path.join(from, d))) fs.symlinkSync(path.join(from, d), path.join(P, d)); }
let r = run(path.join(ENGINE, 'build.cjs'), P, 'gallery');
if (r.status && brand) { console.log('The brand does not build here (' + (r.stderr || r.stdout).trim() + '): drawing in the engine\'s defaults.');
  for (const f of ['brand.json', 'fonts', 'brand']) fs.rmSync(path.join(P, f), { recursive: true, force: true }); brand = false;
  r = run(path.join(ENGINE, 'build.cjs'), P, 'gallery'); }
if (r.status) die(r.stderr || r.stdout);

// the films: one per style, then glide with each opening; 15 s at 128 BPM, so a bar is 1.875 s and the first change
// of scene is on bar 2 (3.75 s) in every one
const BAR = 240 / 128, CH = 2 * BAR;
const STYLES = [['glide', 'calm'], ['punch', 'upbeat'], ['dive', 'calm'], ['type', 'bold'], ['deck', 'calm']];
const films = [...STYLES.map(([s, m]) => ({ id: 'style' + s, name: s, group: 'styles', style: s, open: s === 'dive' ? 'closeup' : 'problem', mood: m,
    a: CH - (s === 'type' ? .45 : .6), b: CH + (s === 'type' ? 2.55 : 1.4), call: `film.sh new <id> phone --style ${s}` })),
  ...['problem', 'closeup', 'result'].map(o => ({ id: 'open' + o, name: o, group: 'openings', style: 'glide', open: o, mood: 'calm',
    a: 0, b: CH, call: `film.sh new <id> phone --open ${o}` }))];
for (const f of films) {
  const q = run(path.join(ENGINE, 'tools', 'new.cjs'), P, f.id, 'phone', '15', '128', '--style', f.style, '--open', f.open, '--mood', f.mood, '--music', 'none');
  if (q.status) die(q.stderr || q.stdout);
  // what film.sh new says the style or the opening is
  const m = q.stdout.match(new RegExp(`^\\s*${f.group === 'styles' ? 'style' : 'opening'}\\s+\\S+: (.+)$`, 'm'));
  Object.assign(f, { says: m ? m[1] : '', html: path.join(FILMS, f.id + '.html'), W: 1080, H: 1920, q: '' });
}

(async () => {
  const b = await chromium.launch();
  const page = async (html, q, W, H) => { const p = await b.newPage({ viewport: { width: W, height: H } }); const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.goto(pathToFileURL(html).href + '?capture=1' + q);
    await p.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
    await p.addScriptTag({ path: path.join(__dirname, 'reader.js') }); p.errs = errs; return p; };
  const G = path.join(FILMS, 'gallery.html');
  const g0 = await page(G, '', 1920, 1080), names = await g0.evaluate(() => window.__demos); await g0.close();
  const moves = [];
  for (const n of names) { const p = await page(G, '&demo=' + n, 1920, 1080), d = await p.evaluate(() => window.__demo); await p.close();
    moves.push({ id: n, name: n, group: 'moves', says: d.says, call: d.call, a: 0, b: d.dur, html: G, W: 1920, H: 1080, q: '&demo=' + n }); }
  const all = [...moves, ...films], sheet = await b.newPage({ viewport: { width: 1400, height: 400 } });
  for (const d of all) {
    const p = await page(d.html, d.q, d.W, d.H), c = await p.context().newCDPSession(p);
    // the speed: the fastest travel on screen from each 60 fps frame to the next
    const f0 = Math.round(d.a * 60), f1 = Math.round(d.b * 60);
    const v = await p.evaluate(([f0, f1]) => { const o = []; for (let f = f0; f < f1; f++) o.push(window.__osTravel(f / 60, (f + 1) / 60)); return o; }, [f0, f1]);
    // six frames, evenly in time across the span where anything moves (half a px a frame or more), so their spacing
    // shows the curve; the whole window when nothing does
    const mv = v.map((s, i) => s >= .5 ? i : -1).filter(i => i >= 0), m0 = mv.length ? Math.max(0, mv[0] - 3) : 0, m1 = mv.length ? Math.min(v.length - 1, mv[mv.length - 1] + 3) : v.length - 1;
    const TW = d.W > d.H ? 300 : 150, TH = Math.round(TW * d.H / d.W), ts = Array.from({ length: 6 }, (_, k) => (f0 + Math.round(lerp(m0, m1, k / 5))) / 60), shots = [];
    for (const t of ts) { await p.evaluate(t => window.__seek(t), t);
      shots.push((await c.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: d.W, height: d.H, scale: TW / d.W } })).data); }
    if (p.errs.length) console.log(`  ${d.name}: page errors: ${p.errs.slice(0, 3).join(' | ')}`);
    await p.close();
    const RW = 6 * (TW + 8) - 8, GH = 140, top = Math.max(48, ...v) * 1.1, X = t => (t - d.a) / (d.b - d.a) * RW, Y = s => GH - s / top * GH;
    const line = v.map((s, i) => `${X(d.a + (i + .5) / 60).toFixed(1)},${Y(s).toFixed(1)}`).join(' ');
    const svg = `<svg width="${RW}" height="${GH + 22}" style="display:block;overflow:visible">
      <rect width="${RW}" height="${GH}" fill="#222"/>
      <line x1="0" x2="${RW}" y1="${Y(40)}" y2="${Y(40)}" stroke="#d98a3a" stroke-dasharray="5 5"/>
      <text x="${RW - 6}" y="${Y(40) - 6}" fill="#d98a3a" text-anchor="end">40 px a frame: strobes without motion blur</text>
      ${ts.map(t => `<line x1="${X(t)}" x2="${X(t)}" y1="0" y2="${GH}" stroke="#555"/>`).join('')}
      <polyline points="${line}" fill="none" stroke="#8ab4ff" stroke-width="2"/>
      <text x="6" y="16" fill="#aaa">fastest travel on screen, px per frame (peak ${Math.max(...v).toFixed(0)})</text>
      <text x="0" y="${GH + 17}" fill="#888">${d.a.toFixed(2)} s</text><text x="${RW}" y="${GH + 17}" fill="#888" text-anchor="end">${d.b.toFixed(2)} s</text></svg>`;
    await sheet.setContent(`<body style="margin:0;padding:14px;background:#1a1a1a;font:14px Menlo,Consolas,monospace;color:#e6e6e6;width:${RW}px">
      <div style="font:700 20px sans-serif;margin-bottom:2px">${d.name} <span style="font:500 14px Menlo,monospace;color:#999">${d.group}</span></div>
      <div style="font:15px sans-serif;color:#ccc;margin-bottom:2px">${esc(d.says)}</div><div style="color:#8ab4ff;margin-bottom:10px">${esc(d.call)}</div>
      <div style="display:flex;gap:8px;margin-bottom:10px">${shots.map((s, i) => `<div><div style="height:18px">${ts[i].toFixed(2)}s</div><img style="display:block;width:${TW}px;height:${TH}px" src="data:image/png;base64,${s}"></div>`).join('')}</div>
      ${svg}</body>`);
    await sheet.setViewportSize({ width: RW + 28, height: await sheet.evaluate(() => document.body.scrollHeight) });
    d.sheet = path.join(SHEETS, d.id + '.png'); await sheet.screenshot({ path: d.sheet, fullPage: true });
    console.log(`  ${d.group.padEnd(8)} ${d.name.padEnd(9)} ${path.relative(out, d.sheet)}`);
  }
  await b.close();
  // the index: every demo playing live, beside the link to its sheet
  const rel = f => path.relative(out, f).split(path.sep).map(encodeURIComponent).join('/');
  const item = d => `<figure><iframe loading="lazy" src="${rel(d.html)}${d.q ? '?' + d.q.slice(1) : ''}" style="width:${d.W > d.H ? 384 : 162}px;height:${d.W > d.H ? 216 : 288}px"></iframe>
    <figcaption><b>${d.name}</b> <a href="${rel(d.sheet)}">sheet</a><br>${esc(d.says)}<br><code>${esc(d.call)}</code></figcaption></figure>`;
  const sec = (g, h) => `<h2>${h}</h2><div class="row">${all.filter(d => d.group === g).map(item).join('')}</div>`;
  fs.writeFileSync(path.join(out, 'index.html'), `<!doctype html><meta charset="utf-8"><title>oneshot gallery</title>
<style>body{margin:24px;background:#141414;color:#ddd;font:14px/1.45 system-ui,sans-serif}h1{font-size:22px}h2{font-size:17px;margin:28px 0 10px;color:#aaa}
.row{display:flex;flex-wrap:wrap;gap:18px}figure{margin:0;width:384px}iframe{border:0;display:block;background:#000;border-radius:6px}
figcaption{margin-top:6px;color:#bbb}a{color:#8ab4ff}code{color:#8ab4ff;font-size:12px}</style>
<h1>The library's moves and the edit styles${brand ? ', in the brand' : ''}</h1>
<p>Each plays live, on a loop. A sheet is six frames across the demo and the fastest travel on screen per frame under them.</p>
${sec('moves', 'Moves (references/moves.md)')}${sec('styles', 'Edit styles, around the first change of scene (references/styles.md)')}${sec('openings', 'Openings, over the first two bars')}`);
  console.log(`${all.length} demos in ${((Date.now() - t0) / 1000).toFixed(0)} s. Open ${path.join(out, 'index.html')}; the sheets are in ${SHEETS}`);
})().catch(e => die(e.stack || e.message));
function lerp(a, c, t) { return a + (c - a) * t; }
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
