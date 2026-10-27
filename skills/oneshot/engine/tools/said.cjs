// said(browser, file, query, W, H)   what a film says, as its page declares it (window.__said), in one format: each
// BandLine's words and each Say(), with when they appear (tin), when a voice would start (at) and when they leave
// (until). voice.cjs speaks them; subs.cjs writes them as caption files.
'use strict';
module.exports = async function said(browser, file, q, W, H) {
  const p = await browser.newPage({ viewport: { width: W, height: H } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + file + '?capture=1' + q);
  await p.waitForFunction(() => window.__ready === true, null, { timeout: 30000 }).catch(() => {});
  const r = await p.evaluate(() => ({ said: window.__said || [], dur: window.__DUR, ready: window.__ready === true }));
  await p.close();
  if (!r.ready) throw new Error(`The film did not load${errs.length ? ': ' + errs[0] : ''}. Run film.sh <film> check.`);
  return r;
};
