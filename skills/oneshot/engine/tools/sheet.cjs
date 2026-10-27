// node sheet.cjs <file.html> <out_prefix> <dur> [step] [W H query]
// contact sheets: the frame at every step (0.125 s by default, snapped to the 60 fps frame the MP4 shows),
// 10 across, 40 per sheet, each labelled with its time. Drawn by Chrome, so no image library is needed.
const { chromium } = require('./pw.cjs');
const path = require('path');
(async () => {
  const [,, file, pre, durS, stepS, WS, HS, QS] = process.argv;
  const dur = +durS, step = +stepS || 0.125, W = +WS || 1080, H = +HS || 1920, COLS = 10, PER = 40, TW = 200, TH = Math.round(TW * H / W);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: W, height: H } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve(file) + '?capture=1' + (QS || ''));
  await p.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
  const c = await p.context().newCDPSession(p);
  const ts = []; for (let i = 0; i < Math.floor(dur / step + 1e-6); i++) ts.push(+(i * step).toFixed(3));
  const shots = [];
  for (const t of ts) {
    const f = Math.min(Math.round(t * 60), Math.round(dur * 60) - 1);
    await p.evaluate(t => window.__seek(t), f / 60);
    const r = await c.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: W, height: H, scale: TW / W } });
    shots.push([t, r.data]);
  }
  const g = await b.newPage({ viewport: { width: COLS * (TW + 6) + 6, height: 400 } });
  for (let s = 0; s < shots.length; s += PER) {
    const chunk = shots.slice(s, s + PER);
    await g.setContent(`<body style="margin:0;padding:6px 0 0 6px;background:#282828;font:13px Menlo,Consolas,monospace;color:#e6e6e6;display:flex;flex-wrap:wrap;width:${COLS * (TW + 6)}px">` +
      chunk.map(([t, d]) => `<div style="width:${TW}px;margin:0 6px 6px 0"><div style="height:18px">${t.toFixed(3)}s</div><img style="display:block;width:${TW}px;height:${TH}px" src="data:image/png;base64,${d}"></div>`).join('') + '</body>');
    const h = await g.evaluate(() => document.body.scrollHeight);
    await g.setViewportSize({ width: COLS * (TW + 6) + 6, height: h });
    const out = `${pre}_${String(s / PER + 1).padStart(2, '0')}.png`;
    await g.screenshot({ path: out, fullPage: true }); console.log(out);
  }
  if (errs.length) console.log('page errors:', errs.slice(0, 5).join(' | '));
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
