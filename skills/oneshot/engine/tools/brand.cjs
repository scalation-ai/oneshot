// node brand.cjs <folder to read> <project> [--write]   reads a product's own code for its brand and proposes brand.json:
// colours (CSS variables in hex, rgb, hsl or oklch, light and dark blocks told apart; Tailwind configs; Xcode colour
// sets; Android colors.xml), fonts (@font-face, next/font, Google Fonts links, @fontsource, font files), the theme,
// and the product's name. Prints where each value came from and marks guesses. Fonts a film needs as files are
// copied from the project or fetched from Google Fonts into the project's fonts/ (a film embeds its fonts).
// brand.found.json keeps the whole finding; brand.json is written only while it is still the template, or with --write.
'use strict';
const fs = require('fs'), path = require('path'), https = require('https');
const [,, SCAN_, PROJ_, ...FLAGS] = process.argv;
if (!SCAN_ || !PROJ_) { console.log('usage: node brand.cjs <folder to read> <project> [--write]'); process.exit(1); }
const SCAN = path.resolve(SCAN_), PROJ = path.resolve(PROJ_), WRITE = FLAGS.includes('--write');
const rel = f => path.relative(SCAN, f) || '.';
const read = f => { try { return fs.statSync(f).size > 1.5e6 ? '' : fs.readFileSync(f, 'utf8'); } catch (e) { return ''; } };
const lineOf = (s, i) => s.slice(0, i).split('\n').length;

/* ---------- the files: everything but dependencies, builds and hidden folders ---------- */
const SKIP = new Set(['node_modules', 'dist', 'build', 'out', 'coverage', 'vendor', 'Pods', 'DerivedData', 'venv', '__pycache__', 'target', 'oneshot-output', 'motion-clip-output']);
const FILES = [];
(function walk(d, depth) {
  if (depth > 9 || FILES.length > 30000) return;
  let ents; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
  for (const e of ents) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (!SKIP.has(e.name) && !e.name.startsWith('.')) walk(p, depth + 1); }
    else if (e.isFile()) FILES.push(p);
  }
})(SCAN, 0);
const byExt = (...ex) => FILES.filter(f => ex.includes(path.extname(f).toLowerCase()));

/* ---------- colours ---------- */
function hsl2rgb(h, s, l) { s /= 100; l /= 100; const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  return [0, 8, 4].map(n => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))))); }
function oklch2rgb(L, C, H) {
  const a = C * Math.cos(H * Math.PI / 180), b = C * Math.sin(H * Math.PI / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s]
    .map(x => { x = Math.max(0, Math.min(1, x)); return Math.round(255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055)); });
}
function parseColor(v) {
  v = String(v).trim().replace(/\s*!important$/, '').toLowerCase(); let m;
  if ((m = v.match(/^#([0-9a-f]{3,8})$/))) { let h = m[1]; if (h.length <= 4) h = h.split('').map(c => c + c).join('');
    return h.length >= 6 ? [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)) : null; }
  if ((m = v.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/))) return [m[1], m[2], m[3]].map(x => Math.round(+x));
  if ((m = v.match(/^hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%/))) return hsl2rgb(+m[1], +m[2], +m[3]);
  if ((m = v.match(/^([\d.]+)(?:deg)?\s+([\d.]+)%\s+([\d.]+)%$/))) return hsl2rgb(+m[1], +m[2], +m[3]);   // shadcn's bare hsl
  if ((m = v.match(/^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)/))) return oklch2rgb(m[2] ? +m[1] / 100 : +m[1], +m[3], +m[4]);
  return null;
}
const hex = c => '#' + c.map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
function hsl([r, g, b]) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  return { s: d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1)), l }; }

const COLORS = [];   // {name, rgb, src, dark}
const CVARS = new Map();   // CSS variable -> {value, src, dark}, the light value first
const FONTVARS = new Map();   // --font-x -> family (from next/font's variable, or a font-family list)
const FACES = [];   // @font-face: {family, url, src}
const RULE_FONTS = [];   // font-family on body, html, h1...: {sel, family, src}
function cssScan(f, s0) {
  const s = s0.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
  const stack = []; let seg = 0, face = null;
  const flush = (a, b) => {
    const decl = s.slice(a, b), m = decl.match(/^\s*([\w-]+)\s*:\s*([\s\S]+?)\s*$/); if (!m) return;
    const ctx = stack.join(' '), dark = /\.dark\b|\[data-theme=["']?dark|prefers-color-scheme:\s*dark|\.theme-dark/i.test(ctx);
    const src = `${rel(f)}:${lineOf(s, a + decl.search(/\S/))}`, [, prop, val] = m;
    if (face) { if (prop === 'font-family') face.family = val.replace(/["']/g, '').trim(); if (prop === 'src') face.url = (val.match(/url\(\s*["']?([^"')]+)/) || [])[1]; face.src = face.src || src; return; }
    if (prop.startsWith('--')) { if (!CVARS.has(prop) || (CVARS.get(prop).dark && !dark)) CVARS.set(prop, { value: val, src, dark }); return; }
    if (prop === 'font-family' && /(^|[\s,])(html|body|:root|h1|h2|\.title|\.heading)\b/.test(stack[stack.length - 1] || '')) RULE_FONTS.push({ sel: stack[stack.length - 1], family: val, src });
  };
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '{') { const sel = s.slice(seg, i).trim(); stack.push(sel); if (/^@font-face$/i.test(sel)) face = { file: f }; seg = i + 1; }
    else if (ch === '}') { flush(seg, i); const sel = stack.pop(); if (face && /^@font-face$/i.test(sel || '')) { if (face.family) FACES.push(face); face = null; } seg = i + 1; }
    else if (ch === ';') { flush(seg, i); seg = i + 1; }
  }
}
for (const f of byExt('.css', '.scss', '.sass', '.less', '.pcss', '.postcss')) cssScan(f, read(f));
const resolveVar = v => { for (let k = 0; k < 6; k++) { const m = String(v).match(/^var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)$/); if (!m) break; v = CVARS.has(m[1]) ? CVARS.get(m[1]).value : (m[2] || v); } return v; };
for (const [name, o] of CVARS) { const rgb = parseColor(resolveVar(o.value)); if (rgb) COLORS.push({ name, rgb, src: o.src, dark: o.dark }); }

// Tailwind 3 configs: colors: { primary: '#..', brand: { 500: '#..' } }
for (const f of FILES.filter(f => /tailwind\.config\.(c|m)?(j|t)s$/.test(f))) {
  const s = read(f);
  for (const m of s.matchAll(/\b(primary|brand|accent|foreground|background|muted)\s*:\s*(['"])([^'"]+)\2/g)) { const rgb = parseColor(m[3]); if (rgb) COLORS.push({ name: m[1], rgb, src: `${rel(f)}:${lineOf(s, m.index)}` }); }
  for (const m of s.matchAll(/\b(primary|brand|accent)\s*:\s*\{([^}]*)\}/g)) { const d = m[2].match(/\b(DEFAULT|500|600)\s*:\s*(['"])([^'"]+)\2/); const rgb = d && parseColor(d[3]); if (rgb) COLORS.push({ name: m[1], rgb, src: `${rel(f)}:${lineOf(s, m.index)}` }); }
}
// Xcode colour sets (AccentColor.colorset is the app's accent), Android colors.xml
const comp = v => { v = String(v); return v.startsWith('0x') ? parseInt(v, 16) : v.includes('.') ? Math.round(parseFloat(v) * 255) : Math.round(+v); };
for (const f of FILES.filter(f => /\.colorset[\\/]Contents\.json$/.test(f))) {
  try { const j = JSON.parse(read(f)), c = (j.colors || []).find(c => !c.appearances) || (j.colors || [])[0], k = c && c.color && c.color.components;
    if (k) COLORS.push({ name: path.basename(path.dirname(f), '.colorset'), rgb: [k.red, k.green, k.blue].map(comp), src: rel(f) }); } catch (e) {}
}
for (const f of FILES.filter(f => /[\\/]res[\\/]values[^\\/]*[\\/]colors\.xml$/.test(f))) {
  const s = read(f), dark = /values-night/.test(f);
  for (const m of s.matchAll(/<color\s+name="([^"]+)"\s*>\s*#([0-9a-fA-F]{6,8})\s*</g)) { const h = m[2].length === 8 ? m[2].slice(2) : m[2];
    COLORS.push({ name: m[1], rgb: [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)), src: `${rel(f)}:${lineOf(s, m.index)}`, dark }); }
}

const nm = c => c.name.toLowerCase().replace(/^--/, '').replace(/^colou?r-/, '');
const STATE = /(red|green|amber|orange|success|error|danger|warn|destructive|info|ok$|positive|negative|chart)/;
const light = COLORS.filter(c => !c.dark);
function pick(tests, want) { for (const re of tests) { const c = light.find(c => re.test(nm(c)) && want(c)); if (c) return c; } return null; }
const vivid = c => { const h = hsl(c.rgb); return h.s > .3 && h.l > .18 && h.l < .86 && !STATE.test(nm(c)); };
const notText = c => !/(foreground|-fg$|^fg$|text|border|shadow|offset)/.test(nm(c));
const found = { colors: {}, notes: [], sources: {} };
const take = (role, c, how) => { if (!c) return; found.colors[role] = hex(c.rgb); found.sources[role] = `${c.name} ${c.src}${how ? ' (' + how + ')' : ''}`; };
let acc = pick([/(^|-)brand(-|$)|^accentcolor$|^accent-color$/, /(^|-)primary(-|$)/, /(^|-)accent(-|$)/], c => vivid(c) && notText(c));
if (acc) take('accent', acc);
else if ((acc = pick([/(^|-)(link|highlight|ring|focus)(-|$)/], c => vivid(c) && notText(c)))) {
  take('accent', acc, 'guess: a link or focus colour; no brand, primary or accent colour is named');
  found.notes.push('accent is a guess: ask the user which colour their buttons or logo use'); }
else { acc = light.filter(vivid).sort((a, b) => hsl(b.rgb).s - hsl(a.rgb).s)[0]; if (acc) { take('accent', acc, 'guess: the most saturated colour; no brand, primary or accent colour is named'); found.notes.push('accent is a guess: ask the user which colour their buttons or logo use'); } }
take('ink', pick([/^(foreground|ink|text|fg|text-primary|body-text)$/, /(^|-)(foreground|ink)$/, /^text(-|$)/], c => hsl(c.rgb).l < .4 && !/(muted|soft|secondary|inverse|on-|primary-|accent-|destructive)/.test(nm(c))));
take('body', pick([/(ink-soft|text-secondary|secondary-foreground|body$)/], c => hsl(c.rgb).l < .55));
take('muted', pick([/(muted-foreground|text-muted|muted|label|faint|subtle|placeholder|tertiary)/], c => { const l = hsl(c.rgb).l; return l > .3 && l < .75; }));
take('border', pick([/(^|-)(border|divider|stroke|line)(-|$)/], c => hsl(c.rgb).l > .7));
const bg = pick([/^(background|bg|paper|surface|canvas|page|base)$/, /(^|-)(background|bg|paper|surface|canvas)(-|$)/], c => hsl(c.rgb).s < .35 && notText(c));
if (bg) { take('surface', bg); found.theme = hsl(bg.rgb).l > .6 ? 'light' : 'dark'; found.sources.theme = `${bg.name} is ${found.theme}`; }
else { found.theme = 'dark'; found.sources.theme = 'no background colour found: the default'; }
if (found.theme === 'light' && found.colors.accent && hsl(parseColor(found.colors.accent)).l > .7) {
  found.theme = 'dark'; found.sources.theme += '; dark instead: the accent is too pale to carry a light stage';
}
if (found.theme === 'light' && bg) { found.colors.stage = hex(bg.rgb); found.sources.stage = `the stage: the product's own background, ${bg.name}`; }
if (found.theme === 'dark' && bg && hsl(bg.rgb).l < .2) { found.colors.night = hex(bg.rgb); found.sources.night = `the stage: the product's own background, ${bg.name}`; }

/* ---------- fonts ---------- */
const SYSTEM = /^(-apple-system|blinkmacsystemfont|system-ui|ui-sans-serif|ui-serif|ui-monospace|sans-serif|serif|monospace|sf pro.*|segoe ui|roboto|helvetica.*|arial|inherit|initial)$/i;
const MONO = /mono|code|consol|courier/i;
const GOOGLE = new Set();   // families known to come from Google Fonts
const firstFamily = list => { for (let x of String(list).split(',')) { x = x.trim().replace(/^["']|["']$/g, '');
  const v = x.match(/^var\(\s*(--[\w-]+)/); if (v) { if (FONTVARS.has(v[1])) return FONTVARS.get(v[1]); const r = CVARS.get(v[1]); if (r) { const f = firstFamily(r.value); if (f) return f; } continue; }
  if (x && !SYSTEM.test(x)) return x; } return null; };
for (const f of byExt('.tsx', '.jsx', '.ts', '.js', '.mjs', '.vue', '.svelte', '.astro')) {
  const s = read(f); if (!/next\/font|fonts\.googleapis|localFont/.test(s)) continue;
  for (const m of s.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]next\/font\/google['"]/g))
    for (const part of m[1].split(',')) { const n = part.trim().split(/\s+as\s+/)[0]; if (n) GOOGLE.add(n.replace(/_/g, ' ')); }
  for (const m of s.matchAll(/(?:const|let|var)\s+\w+\s*=\s*([A-Z]\w*)\s*\(\s*\{([\s\S]*?)\}\s*\)/g)) {
    const v = (m[2].match(/variable\s*:\s*['"](--[\w-]+)['"]/) || [])[1]; if (!v) continue;
    if (m[1] === 'localFont') { const p = (m[2].match(/(?:src|path)\s*:\s*['"]([^'"]+)['"]/) || [])[1]; if (p) { const fam = path.basename(p).replace(/\.(woff2?|ttf|otf)$/i, '').replace(/[-_](regular|variable|vf).*$/i, '').replace(/\[.*\]/, ''); FONTVARS.set(v, fam); FACES.push({ family: fam, url: p, file: f, src: rel(f) }); } }
    else FONTVARS.set(v, m[1].replace(/_/g, ' '));
  }
}
for (const f of FILES.filter(f => /\.(html?|css|scss|tsx|jsx|vue|svelte|astro)$/i.test(f))) {
  const s = read(f); for (const m of s.matchAll(/fonts\.googleapis\.com\/css2?\?([^"'\s)>]+)/g))
    for (const q of m[1].split('&')) { const fam = q.match(/^family=([^:&]+)/); if (fam) GOOGLE.add(decodeURIComponent(fam[1]).replace(/\+/g, ' ')); }
}
for (const f of FILES.filter(f => path.basename(f) === 'package.json')) {
  try { const j = JSON.parse(read(f)); for (const k of Object.keys({ ...j.dependencies, ...j.devDependencies })) { const m = k.match(/^@fontsource(?:-variable)?\/(.+)$/);
    if (m) GOOGLE.add(m[1].split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')); } } catch (e) {}
}
const fontVar = re => { for (const [k, o] of CVARS) if (re.test(k)) { const f = firstFamily(o.value); if (f) return { family: f, src: `${k} ${o.src}` }; } return null; };
const ruleFont = re => { const r = RULE_FONTS.find(r => re.test(r.sel)); const f = r && firstFamily(r.family); return f ? { family: f, src: `${r.sel} ${r.src}` } : null; };
const pool = [...GOOGLE, ...FACES.map(f => f.family)].filter(f => !MONO.test(f) && !SYSTEM.test(f));
const bodyF = fontVar(/^--font-(sans|body|base|text|ui)$/) || ruleFont(/\bbody\b|\bhtml\b|:root/) || (pool[0] && { family: pool[0], src: 'the only font the project loads' });
const headF = fontVar(/^--font-(heading|headings|display|title|head)$/) || ruleFont(/\bh1\b|\.title|\.heading/) || bodyF;
const markF = fontVar(/^--font-(logo|brand|wordmark)$/);
const handF = fontVar(/^--font-(hand|script)$/);
if (handF) found.notes.push(`a hand or script face is set (${handF.family}, ${handF.src}): if the logo is drawn in it, use it as fonts.wordmark`);

const FONTFILES = FILES.filter(f => /\.(woff2|woff|ttf|otf)$/i.test(f));
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
function localFile(family) {
  const face = FACES.find(x => norm(x.family) === norm(family) && x.url && !/^https?:/.test(x.url));
  if (face) { for (const p of [path.resolve(path.dirname(face.file), face.url), path.join(SCAN, 'public', face.url), path.join(SCAN, face.url)]) if (fs.existsSync(p) && fs.statSync(p).isFile()) return p; }
  return FONTFILES.find(f => norm(path.basename(f)).startsWith(norm(family))) || null;
}
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
function get(url) { return new Promise((res, rej) => { https.get(url, { headers: { 'User-Agent': UA } }, r => {
  if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) { r.resume(); return get(r.headers.location).then(res, rej); }
  if (r.statusCode !== 200) { r.resume(); return rej(new Error('HTTP ' + r.statusCode)); }
  const ch = []; r.on('data', c => ch.push(c)); r.on('end', () => res(Buffer.concat(ch))); }).on('error', rej); }); }
async function google(family) {
  const q = family.trim().replace(/ /g, '+');
  for (const axis of [':wght@300..700', ':wght@400..700', ':wght@400;500;600;700', ':wght@400;700', '']) {
    let css; try { css = (await get(`https://fonts.googleapis.com/css2?family=${q}${axis}&display=block`)).toString(); } catch (e) { continue; }
    const blocks = [...css.matchAll(/\/\*\s*latin\s*\*\/\s*@font-face\s*\{([^}]*)\}/g)].map(m => m[1]);
    const got = [], seen = new Set();
    for (const b of blocks) { const url = (b.match(/url\((https:[^)]+)\)/) || [])[1], w = ((b.match(/font-weight:\s*([\d ]+);/) || [])[1] || '400').trim();
      if (!url || seen.has(w)) continue; seen.add(w);
      const file = `${family.replace(/\s+/g, '')}-${w.replace(/\s+/g, '-')}.woff2`;
      fs.mkdirSync(path.join(PROJ, 'fonts'), { recursive: true }); fs.writeFileSync(path.join(PROJ, 'fonts', file), await get(url)); got.push({ file, weight: w }); }
    if (got.length) return got;
  }
  return null;
}
async function fontRole(f, role) {
  if (!f) return null;
  const lf = localFile(f.family);
  if (lf) { fs.mkdirSync(path.join(PROJ, 'fonts'), { recursive: true }); const file = path.basename(lf); fs.copyFileSync(lf, path.join(PROJ, 'fonts', file));
    found.sources[`font ${role}`] = `${f.family}: ${f.src}; file ${rel(lf)}, copied to fonts/`;
    return { family: f.family, file, weight: /\[.*wght.*\]|variable|-vf\b/i.test(lf) ? '100 900' : '400 700' }; }
  const g = await google(f.family).catch(() => null);
  if (g) { found.sources[`font ${role}`] = `${f.family}: ${f.src}; fetched from Google Fonts into fonts/`;
    return g.length === 1 ? { family: f.family, file: g[0].file, weight: g[0].weight } : { family: f.family, files: g }; }
  found.notes.push(`${role} font ${f.family} (${f.src}) has no file here and is not on Google Fonts: put its file in fonts/ and set brand.json, or keep the default`);
  return null;
}

/* ---------- the name ---------- */
function productName() {
  const readme = FILES.find(f => /^readme\.md$/i.test(path.basename(f)) && path.dirname(f) === SCAN);
  const h1 = readme && (read(readme).match(/^#\s+([^\n#]+)/m) || [])[1]; if (h1) return { name: h1.trim().replace(/\s*[:(].*$/, ''), src: rel(readme) };
  for (const f of FILES.filter(f => path.basename(f) === 'Info.plist')) { const m = read(f).match(/<key>CFBundle(?:Display)?Name<\/key>\s*<string>([^<$]+)<\/string>/); if (m) return { name: m[1].trim(), src: rel(f) }; }
  const pj = path.join(SCAN, 'package.json'); try { const j = JSON.parse(read(pj)); const n = j.productName || (j.name || '').replace(/^@[^/]+\//, ''); if (n && !/^(web|app|frontend|root|monorepo|site)$/.test(n)) return { name: n, src: 'package.json' }; } catch (e) {}
  return null;
}

(async () => {
  const pn = productName(); if (pn) { found.name = found.wordmark = pn.name; found.sources.name = pn.src; }
  found.fonts = {};
  const hb = await fontRole(bodyF, 'body'); if (hb) found.fonts.body = hb;
  const same = headF && bodyF && headF.family === bodyF.family;
  const hh = same ? hb : await fontRole(headF, 'head'); if (hh) found.fonts.head = hh;
  if (same && hb) found.sources['font head'] = 'the same face as the body (no heading face is set)';
  const hm = await fontRole(markF, 'wordmark'); if (hm) found.fonts.wordmark = hm;
  if (!bodyF) found.notes.push('no font found (a native app on the system face?): the films keep the default faces for their lines');

  fs.writeFileSync(path.join(PROJ, 'brand.found.json'), JSON.stringify(found, null, 1) + '\n');
  console.log(`read ${FILES.length} files in ${SCAN}`);
  const show = (k, v, s) => console.log(`  ${k.padEnd(9)} ${String(v).padEnd(24)} ${s || ''}`);
  if (found.name) show('name', found.name, found.sources.name);
  for (const [k, v] of Object.entries(found.colors)) show(k, v, found.sources[k]);
  show('theme', found.theme, found.sources.theme);
  for (const r of ['head', 'body', 'wordmark']) if (found.fonts[r]) show(r + ' font', found.fonts[r].family, found.sources[`font ${r}`]);
  for (const n of found.notes) console.log('  note: ' + n);

  const bp = path.join(PROJ, 'brand.json'); let brand = {}; try { brand = JSON.parse(read(bp)); } catch (e) {}
  if (!WRITE && brand.wordmark && brand.wordmark !== 'yourbrand') { console.log('brand.json is already filled in: left as it is (see brand.found.json, or run with --write)'); return; }
  if (found.name) { brand.name = found.name; brand.wordmark = found.wordmark; }
  brand.theme = found.theme; brand.colors = { ...(brand.colors || {}), ...found.colors };
  brand.fonts = { ...(brand.fonts || {}), ...found.fonts };
  fs.writeFileSync(bp, JSON.stringify(brand, null, 1) + '\n');
  console.log('wrote brand.json: check it, and confirm every guess with the user');
})();
