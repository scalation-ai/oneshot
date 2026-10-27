// node capture.cjs <url or file> <out.png> [width] [height]   a reference screenshot of a page or an HTML prototype:
// the screen a film is matched against (it never appears in the film). For a state that needs clicks, typing or a
// fixed clock, copy this file and script the page with Playwright before the screenshot (page.click, page.fill,
// page.clock.setFixedTime).
const { chromium } = require('./pw.cjs');
const { pathToFileURL } = require('url');
(async () => {
  const [,, src, out, W, H] = process.argv;
  if (!out) { console.log('usage: node capture.cjs <url or file> <out.png> [width] [height]'); process.exit(1); }
  const url = /^[a-z][a-z0-9+.-]*:\/\//i.test(src) ? src : pathToFileURL(src).href;
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: +W || 1440, height: +H || 900 } });
  await p.goto(url, { waitUntil: 'networkidle' }).catch(e => { console.log('could not load', url, e.message); process.exit(1); });
  await p.evaluate(() => document.fonts && document.fonts.ready);
  await p.waitForTimeout(500);
  await p.screenshot({ path: out });
  await b.close();
  console.log('captured', out);
})();
