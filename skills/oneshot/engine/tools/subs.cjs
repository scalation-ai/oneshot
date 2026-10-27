// node subs.cjs <project> <film> <format> <out stem>   (film.sh <film> subs)   the film's words as caption files,
// <stem>.srt and <stem>.vtt, for a platform's own captions: most feed video plays muted. A film with a voice is
// captioned as it speaks (films/<film>.voice.json: each line from when its voice starts to when its words leave); one
// without, as its lines show (each BandLine and Say() from when its words appear to when they leave). The files sit
// next to the MP4; nothing is burned into the picture.
'use strict';
const fs = require('fs'), path = require('path');
const die = m => { console.error(m); process.exit(1); };
const [,, projA, id, fmt, stem] = process.argv;
const proj = path.resolve(projA), FILMS = path.join(proj, 'films');
const f = JSON.parse(fs.readFileSync(path.join(proj, 'films.json'), 'utf8'))[id];
if (!f) die(`Unknown film '${id}'.`);
// h:mm:ss with milliseconds after `sep` (SRT a comma, WebVTT a full stop)
const stamp = (s, sep) => { const ms = Math.round(s * 1000), p = (n, w = 2) => String(n).padStart(w, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)}${sep}${p(ms % 1000, 3)}`; };

(async () => {
  const vj = path.join(FILMS, id + '.voice.json');
  let cues, from;
  if (f.voice && fs.existsSync(vj)) {
    from = 'as it speaks';
    cues = JSON.parse(fs.readFileSync(vj, 'utf8')).lines.map(l => ({ text: l.text, a: l.at, b: Math.max(l.at + l.dur, l.until ?? 0) }));
  } else {
    from = f.voice ? 'as its lines show (no voice.json yet: film.sh ' + id + ' voice times them as spoken)' : 'as its lines show';
    const { chromium } = require('./pw.cjs'), { query, SIZE } = require('../meta.cjs'), said = require('./said.cjs');
    const b = await chromium.launch();
    const r = await said(b, path.join(FILMS, f.html || id + '.html'), query(f, fmt), ...SIZE[fmt]).catch(e => die(e.message));
    await b.close();
    cues = r.said.map(l => ({ text: l.text, a: l.tin ?? l.at ?? 0, b: l.until }));
  }
  // in order, one at a time: each ends where the next begins, and nothing runs past the film
  cues = cues.map(c => ({ ...c, text: String(c.text || '').replace(/\s+/g, ' ').trim(), a: Math.max(0, c.a) }))
    .filter(c => c.text).sort((x, y) => x.a - y.a);
  cues.forEach((c, i) => { const nx = cues[i + 1]; c.b = Math.min(c.b ?? (nx ? nx.a : f.dur), nx ? nx.a : f.dur, f.dur); });
  cues = cues.filter(c => c.b - c.a >= 0.2);
  // a caption over 42 characters goes on two lines, broken at the space nearest its middle
  for (const c of cues) if (c.text.length > 42) {
    const sp = [...c.text.matchAll(/ /g)].map(m => m.index), mid = c.text.length / 2;
    if (sp.length) { const i = sp.reduce((a, b) => Math.abs(b - mid) < Math.abs(a - mid) ? b : a); c.text = c.text.slice(0, i) + '\n' + c.text.slice(i + 1); }
  }
  if (!cues.length) { console.log(`${id}: no words on screen, so no captions`); return; }
  fs.writeFileSync(stem + '.srt', cues.map((c, i) => `${i + 1}\n${stamp(c.a, ',')} --> ${stamp(c.b, ',')}\n${c.text}\n`).join('\n'));
  fs.writeFileSync(stem + '.vtt', 'WEBVTT\n\n' + cues.map(c => `${stamp(c.a, '.')} --> ${stamp(c.b, '.')}\n${c.text}\n`).join('\n'));
  console.log(`captions ${from}: ${cues.length} lines in ${stem}.srt and .vtt`);
})().catch(e => die(e.stack || String(e)));
