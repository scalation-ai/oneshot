// node still.cjs <outDir> "<t1,t2>" <file.html> <W> <H> [query]   full-size frames of a film at the given seconds
const { chromium } = require('./pw.cjs');
const path = require('path'), fs = require('fs');
(async () => {
  const [,, outDir, times, file, W, H, q] = process.argv;
  if (!file) { console.log('usage: node still.cjs <outDir> "<t1,t2>" <file.html> <W> <H> [query]'); process.exit(1); }
  fs.mkdirSync(outDir, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: +W || 1080, height: +H || 1920 } });
  p.on('pageerror', e => console.log('pageerror', e.message));
  await p.goto('file://' + path.resolve(file) + '?capture=1' + (q || ''));
  await p.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
  for (const t of times.split(',').map(Number)) {
    await p.evaluate(t => window.__seek(t), t);
    await p.screenshot({ path: path.join(outDir, `t_${t.toFixed(3).padStart(7, '0')}.png`) });
  }
  await b.close();
})();
