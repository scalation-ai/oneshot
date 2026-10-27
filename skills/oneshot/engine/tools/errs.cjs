// node errs.cjs <file.html> [query] [W] [H]   loads a film: page errors, the engine's warnings, and whether render(t)
// is pure (eight frames rendered in reverse order must match the same frames rendered in order), and every character
// its own fonts cannot draw
const { chromium } = require('./pw.cjs');
const path = require('path');
const { PNG } = require(path.join(__dirname, '..', 'node_modules', 'pngjs'));
(async () => {
  const [,, file, q, W, H] = process.argv;
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: +W || 1920, height: +H || 1080 } });
  p.on('pageerror', e => console.log('pageerror:', e.message, (e.stack||'').split('\n').slice(0,3).join(' | ')));
  let probing = false;   // the font probe's inspector logs its own messages: not the film's
  p.on('console', m => {
    if (probing) return;
    if (m.type() === 'error') console.log('console:', m.text());
    if (m.type() === 'warning' && m.text().startsWith('film: ')) console.log('warning:', m.text().slice(6));
  });
  await p.goto('file://' + path.resolve(file) + '?capture=1' + (q || ''));
  await p.waitForTimeout(1500);
  const ready = await p.evaluate(() => window.__ready);
  console.log('ready', ready);
  if (ready) {
    const dur = await p.evaluate(() => window.__DUR);
    const ts = Array.from({ length: 8 }, (_, i) => Math.round((i + .5) * dur / 8 * 60) / 60);   // on the 60 fps grid
    const shot = async t => { await p.evaluate(t => window.__seek(t), t); return PNG.sync.read(await p.screenshot()); };
    const first = {}; for (const t of ts) first[t] = await shot(t);
    const bad = [];
    for (const t of [...ts].reverse()) {
      const A = first[t], B = await shot(t); let over = 0;
      for (let i = 0; i < A.data.length; i += 4)
        if (Math.max(Math.abs(A.data[i] - B.data[i]), Math.abs(A.data[i + 1] - B.data[i + 1]), Math.abs(A.data[i + 2] - B.data[i + 2])) > 8) over++;
      if (over / (A.width * A.height) > 0.0005) bad.push(`${t.toFixed(2)} s (${(over / (A.width * A.height) * 100).toFixed(2)}% of pixels)`);
    }
    console.log(bad.length ? `not pure: rendered after a later frame, these differ: ${bad.reverse().join(', ')}. render(t) must set everything it ever changes, on every call.`
      : `pure: ${ts.length} frames match when rendered out of order`);

    // characters the film's own fonts cannot draw (a name in Thai, an arrow, a currency sign): Chrome draws them in
    // another font, one the brand never chose. Every text of the page is set again in its font, one character to a
    // span, and Chrome says which fonts drew each (what DevTools lists as Rendered Fonts)
    await p.evaluate(() => document.fonts.ready);
    const probes = await p.evaluate(() => {
      const unq = s => s.trim().replace(/^["']|["']$/g, '').toLowerCase();
      const faces = new Set([...document.fonts].map(f => unq(f.family)));
      const seg = new Intl.Segmenter(), blank = /^[\s​-‍⁠﻿]*$/u, uses = new Map();
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let t; (t = w.nextNode());) {
        const e = t.parentElement; if (!e || /^(SCRIPT|STYLE|NOSCRIPT|TITLE)$/.test(e.tagName) || blank.test(t.data)) continue;
        const s = getComputedStyle(e), face = s.fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '');
        if (!faces.has(unq(face))) continue;   // a system font or a generic family: Chrome's choice, not the brand's
        const k = [face, s.fontWeight, s.fontStyle, s.textTransform].join('|');
        if (!uses.has(k)) uses.set(k, new Map());
        let line = e;   // where it is, for the report: a line set one letter to a span is named by its whole line
        while (line.parentElement && line.parentElement !== document.body && line.textContent.trim().length <= t.data.trim().length + 1) line = line.parentElement;
        for (const { segment: g } of seg.segment(t.data)) if (!blank.test(g) && !uses.get(k).has(g)) uses.get(k).set(g, line.textContent.replace(/\s+/g, ' ').trim());
      }
      const box = document.createElement('div'), out = [];
      box.id = '__glyphs'; box.style.cssText = 'position:absolute;left:0;top:0;white-space:pre;font-size:40px;visibility:visible';
      for (const [k, m] of uses) { const [face, weight, style, tt] = k.split('|');
        for (const [g, text] of m) { const s = document.createElement('span'); s.textContent = g;
          s.style.cssText = `display:inline-block;font-family:"${face}";font-weight:${weight};font-style:${style};text-transform:${tt}`;
          box.appendChild(s); out.push([face, g, text]); } }
      document.body.appendChild(box); return out;
    });
    const c = await p.context().newCDPSession(p);
    probing = true; await c.send('DOM.enable'); await c.send('CSS.enable');
    const { root } = await c.send('DOM.getDocument', { depth: 0 });
    const { nodeIds } = await c.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: '#__glyphs span' });
    const miss = new Map();
    for (const [i, id] of nodeIds.entries()) {
      const other = (await c.send('CSS.getPlatformFontsForNode', { nodeId: id })).fonts.filter(f => !f.isCustomFont);
      if (!other.length) continue;
      const [face, g, text] = probes[i];
      if (!miss.has(face)) miss.set(face, { chars: new Set(), by: new Set(), in: new Set() });
      const m = miss.get(face); m.chars.add(g); other.forEach(f => m.by.add(f.familyName)); m.in.add(text);
    }
    await c.send('CSS.disable'); await c.send('DOM.disable'); await p.evaluate(() => document.getElementById('__glyphs').remove()); probing = false;
    for (const [face, m] of miss) {
      const cs = [...m.chars], code = g => [...g].map(ch => 'U+' + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')).join(' ');
      const ins = [...m.in].slice(0, 3).map(s => `"${s.length > 40 ? s.slice(0, 39) + '…' : s}"`).join(', ');
      console.log(`warning: ${face} cannot draw ${cs.slice(0, 12).map(g => `${g} (${code(g)})`).join(', ')}${cs.length > 12 ? ` and ${cs.length - 12} more` : ''}:` +
        ` Chrome draws them in ${[...m.by].join(', ')} instead, in ${ins}${m.in.size > 3 ? ' and more' : ''}. Choose a font that has them (brand.json), or other words.`);
    }
  }
  await b.close();
})();
