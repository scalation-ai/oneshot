// node errs.cjs <file.html> [query] [W] [H]   loads a film: page errors, the engine's warnings, and whether render(t)
// is pure (eight frames rendered in reverse order must match the same frames rendered in order)
const { chromium } = require('./pw.cjs');
const path = require('path');
const { PNG } = require(path.join(__dirname, '..', 'node_modules', 'pngjs'));
(async () => {
  const [,, file, q, W, H] = process.argv;
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: +W || 1920, height: +H || 1080 } });
  p.on('pageerror', e => console.log('pageerror:', e.message, (e.stack||'').split('\n').slice(0,3).join(' | ')));
  p.on('console', m => {
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
  }
  await b.close();
})();
