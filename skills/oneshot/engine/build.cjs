// Build a film: node build.cjs <project> <name>  ->  <project>/films/<name>.html
// Inlines the project's brand (brand.json), its fonts, lib.css, every //INCLUDE file and every /*INLINE path*/null
// data file, so a built film plays on its own anywhere (open it, mail it, drop it in a chat).
// //INCLUDE and /*INLINE*/ look in the project's films/ first, then in the engine (lib/ for code, the engine
// folder for data): a project can add its own screens (//INCLUDE screens.js) next to its films.
'use strict';
const fs = require('fs'), path = require('path');
const ENGINE = __dirname, LIB = path.join(ENGINE, 'lib');
const proj = path.resolve(process.argv[2]), name = process.argv[3];
const FILMS = path.join(proj, 'films');
const die = m => { console.error(m); process.exit(1); };
let src = fs.readFileSync(path.join(FILMS, name + '.src.html'), 'utf8');

// brand.json: colours, fonts, wordmark. Without one, lib.js falls back to neutral defaults.
const bp = path.join(proj, 'brand.json');
const brand = fs.existsSync(bp) ? JSON.parse(fs.readFileSync(bp, 'utf8')) : {};
const FONT_DIRS = [path.join(proj, 'fonts'), proj, FILMS, path.join(ENGINE, 'fonts')];
// "logo": {"light": "logo.svg", "dark": "logo-dark.svg"} (either alone is fine): the brand's own SVG files, looked for
// in the project's brand/ folder, the project and films/, pasted in as brand.logoSvg for lib.js's LogoParts
if (brand.logo) {
  const LOGO_DIRS = [path.join(proj, 'brand'), proj, FILMS];
  brand.logoSvg = {};
  for (const [theme, file] of Object.entries(typeof brand.logo === 'string' ? { light: brand.logo } : brand.logo)) {
    const dir = LOGO_DIRS.find(d => fs.existsSync(path.join(d, file)));
    if (!dir) die(`brand.json: the ${theme} logo '${file}' was not found. Put it in the project's brand/ folder.`);
    brand.logoSvg[theme] = fs.readFileSync(path.join(dir, file), 'utf8').replace(/<\?xml[^>]*>\s*/, '');
  }
}
const FORMATS = { '.ttf': ['ttf', 'truetype'], '.otf': ['otf', 'opentype'], '.woff2': ['woff2', 'woff2'], '.woff': ['woff', 'woff'] };
const DEFAULTS = { head: ['Space Grotesk', 'SpaceGrotesk.ttf', '300 700'], body: ['DM Sans', 'DMSans.ttf', '100 1000'] };

// a role is {family, file, weight} (one file: a variable font, or one weight), or {family, files: [{file, weight}, ...]}
// (a static font, one file per weight)
function face(role) {
  const f = (brand.fonts || {})[role] || {}, d = DEFAULTS[role] || [];
  const fam = f.family || d[0];
  const files = f.files || [{ file: f.file || d[1], weight: f.weight || d[2] || '400 700' }];
  if (!fam || !files.every(x => x.file)) die(`brand.json: the ${role} font needs a family and a file.`);
  return files.map(({ file, weight }) => {
    const dir = FONT_DIRS.find(d => fs.existsSync(path.join(d, file)));
    if (!dir) die(`brand.json: the ${role} font file '${file}' was not found. Put it in the project's fonts/ folder.`);
    const [mime, fmt] = FORMATS[path.extname(file).toLowerCase()] || ['ttf', 'truetype'];
    const data = fs.readFileSync(path.join(dir, file)).toString('base64');
    return `@font-face{font-family:"${fam}";src:url("data:font/${mime};base64,${data}") format("${fmt}");font-weight:${weight || '400 700'};font-display:block}`;
  }).join('\n');
}
function find(rel, dirs) {
  const d = dirs.find(d => fs.existsSync(path.join(d, rel)));
  if (!d) die(`${name}.src.html: '${rel}' was not found in ${dirs.join(' or ')}`);
  return fs.readFileSync(path.join(d, rel), 'utf8');
}

// functions as replacements, so a "$" in a pasted file is never read as a pattern
// the wordmark's own face is optional: a brand whose name is drawn in a third face (fonts.wordmark)
const mark = (brand.fonts || {}).wordmark ? '\n' + face('wordmark') : '';
src = src.replace('<!--FONTS-->', () => `<style>\n${face('head')}\n${face('body')}${mark}\n</style>`);
src = src.replace('/*CSS*/', () => fs.readFileSync(path.join(LIB, 'lib.css'), 'utf8'));
src = src.replace(/^\/\/INCLUDE (\S+)$/gm, (_, f) => find(f, [FILMS, LIB]));
src = src.replace('/*BRAND*/null', () => Object.keys(brand).length ? JSON.stringify(brand) : 'null');
// /*INLINE path*/null pastes a data file, e.g. the world map: /*INLINE data/countries-110m.json*/null
src = src.replace(/\/\*INLINE (\S+)\*\/null/g, (_, f) => find(f, [FILMS, ENGINE]));
const out = path.join(FILMS, name + '.html');
fs.writeFileSync(out, src);
console.log('wrote', out, src.length);
