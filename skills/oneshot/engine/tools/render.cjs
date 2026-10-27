// node render.cjs <html> <outdir> <dsf> <K> <workers> <f0> <f1> [W H query]
// captures every output frame through a 180 degree shutter, open from the frame's time for half a frame, as up to K
// captures (f000000_0, f000000_1, ...: frame f's k-th is f(f - f0)_k), and writes frames.json, how many each frame
// took, for encode.cjs to blend into motion blur.
// The shutter is planned per frame by the page itself (tools/reader.js, __osPlan): how far anything travels while it is
// open decides how many captures it takes (copies of the fastest thing at most GAP px apart, 2 to K of them, a power of
// two), a frame where nothing moves takes one, and a cut inside the shutter (declared, or found as one jump) keeps only
// the captures before it, so a cut is never blurred into a dissolve. K 1 is one capture a frame, at its time.
// GAP=6 by default (CSS px, which a 2x final scales back to); RENDER_FIXED=1 captures all K every frame.
// Each worker has its own browser (pages sharing one browser queue behind its one GPU process). A supersampled final
// captures JPEG at quality 95: blended and scaled down, it matches PNG within 0.02% of pixels, at a tenth of the disk
// and about 40% less time. A 1x preview keeps PNG.
const { chromium } = require('./pw.cjs');
const path = require('path'), fs = require('fs'), { pathToFileURL } = require('url');
(async () => {
  const [,, html, sub, dsfS, KS, workersS, f0S, f1S, WS, HS, QS] = process.argv;
  const dsf = +dsfS, K = +KS, workers = +workersS, f0 = +f0S, f1 = +f1S, W = +WS || 1920, H = +HS || 1080;
  const FPS = 60, SHUTTER = 0.5, GAP = +process.env.GAP || 6, FIXED = !!process.env.RENDER_FIXED;
  fs.mkdirSync(sub, { recursive: true });
  const JPG = dsf > 1, EXT = JPG ? 'jpg' : 'png';
  const shotOpts = JPG ? { format: 'jpeg', quality: 95, optimizeForSpeed: true } : { format: 'png', optimizeForSpeed: true };
  const name = (i, k) => path.join(sub, `f${String(i).padStart(6, '0')}_${k}.${EXT}`);
  const browsers = [];
  const frames = []; for (let f = f0; f < f1; f++) frames.push(f);
  const counts = new Array(frames.length).fill(0);
  let next = 0, done = 0, failed = false, captures = 0, holds = 0, cutFrames = 0; const t0 = Date.now();
  async function worker(id) {
    const b = await chromium.launch({ args: ['--disable-gpu-vsync', '--disable-frame-rate-limit'] }); browsers.push(b);
    const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: dsf });
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.goto(pathToFileURL(path.resolve(html)).href + '?capture=1' + (QS || ''));   // encoded: a '#' in a folder name
    await p.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
    if (K > 1 && !FIXED) await p.addScriptTag({ path: path.join(__dirname, 'reader.js') });
    const cuts = await p.evaluate(() => (window.__os && window.__os.cuts) || []);
    const c = await p.context().newCDPSession(p);
    while (true) {
      const i = next++; if (i >= frames.length) break;
      const f = frames[i], a = f / FPS, span = SHUTTER / FPS;
      const ts = K === 1 ? [a] : FIXED ? Array.from({ length: K }, (_, k) => a + (k + 0.5) / K * span)
        : await p.evaluate(([a, b, n, g, cu]) => window.__osPlan(a, b, n, g, cu), [a, a + span, K, GAP, cuts]);
      if (K > 1 && ts.length === 1) holds++;
      if (K > 1 && !FIXED && ts.length > 1 && ts.length & (ts.length - 1)) cutFrames++;   // not a power of two: cut short
      for (const [k, t] of ts.entries()) {
        await p.evaluate(t => window.__seek(t), t);
        // CDP ignores the device scale factor: the clip's scale gives the 2x frame
        const r = await c.send('Page.captureScreenshot', { ...shotOpts, clip: { x: 0, y: 0, width: W, height: H, scale: dsf } });
        fs.writeFileSync(name(i, k), Buffer.from(r.data, 'base64')); captures++;
      }
      counts[i] = ts.length;
      done++;
      if (done % 60 === 0) console.log(`${done}/${frames.length} frames, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    if (errs.length) { failed = true; console.log('worker', id, 'page errors:', errs.slice(0, 5).join(' | ')); }
    await p.close();
  }
  await Promise.all(Array.from({ length: workers }, (_, i) => worker(i)));
  await Promise.all(browsers.map(b => b.close()));
  fs.writeFileSync(path.join(sub, 'frames.json'), JSON.stringify({ ext: EXT, counts }));
  const shutter = K > 1 ? `, ${captures} captures (${holds} held frames, ${cutFrames} cut short)` : '';
  console.log('capture done', frames.length, 'frames in', ((Date.now() - t0) / 1000).toFixed(0) + 's' + shutter);
  if (failed) process.exit(2);
})().catch(e => { console.error(e.message); process.exit(1); });
