// node read.cjs <film.html> <W> <H> <query> <outDir> [--fps 20] [--fmt 9x16] [--title name] [--strict]
// (film.sh <film> read [format])   reads a film in numbers before anyone watches it, and says what reads as a slideshow.
// It seeks the film --fps times a second, asks the page what is on screen (tools/reader.js) and measures:
//   carry     every change of scene (most of the frame's content changing identity within 0.4 s) gets a verdict:
//             CARRIED  something survives it and visibly moves or scales into the next scene, or a thing that leaves
//                      hands over to one that grows out of the same place;
//             ANCHORED something large survives, but stands still while its contents swap;
//             BARE     nothing survives: one slide replaced by the next.
//             Hard cuts the film declares (window.__os.cuts: the punch style's downbeats) and bursts of three or more
//             changes inside 1.5 s are counted as cuts, not judged. score = (carried + anchored / 2) / changes judged.
//   rhythm    the shot lengths between changes (all the same length reads as slides), and how much of the film is
//             still (nothing moving, nothing fading, nothing arriving): a film that never rests has no landings.
//   speed     the fastest travel on screen, px per 60 fps frame: over ~40 strobes without motion blur (the final has it).
//   crossfade two interfaces overlapping, both half transparent: a double exposure.
//   legible   text that never reaches the format's minimum size on screen (9:16 and feed posts 22 px, 16:9 16 px).
//   safe      on 9:16, words under the feed's buttons (above y 220, outside x 60 to 1020, the right column by y 1000-1650).
//   framing   an element marked data-keep that leaves the frame while it is visible.
// Writes <outDir>/read.json and <outDir>/read.html (thumbnails either side of every change), prints a summary.
// --strict exits 1 when any leg fails.
'use strict';
const { chromium } = require('./pw.cjs');
const fs = require('fs'), path = require('path'), { pathToFileURL } = require('url');

const args = process.argv.slice(2), pos = [], opt = { fps: 20 };
for (let i = 0; i < args.length; i++) { const a = args[i]; if (a === '--strict') opt.strict = true;
  else if (a.startsWith('--')) opt[a.slice(2)] = args[++i]; else pos.push(a); }
const [file, WS, HS, Q, outDir] = pos;
if (!file || !outDir) { console.log('usage: node read.cjs <film.html> <W> <H> <query> <outDir> [--fps 20] [--fmt 9x16] [--title name] [--strict]'); process.exit(1); }
const W = +WS || 1920, H = +HS || 1080, FPS = +opt.fps || 20, FMT = opt.fmt || (W > H ? '16x9' : '9x16');

// thresholds, each in one place (references/read.md says where each came from)
const T = {
  win: 0.4,            // s: a change of scene is judged over this window
  change: 0.5,         // share of the frame's content that changes identity across the window to call it a change
  gap: 0.5,            // s: two changes closer than this are one
  side: 0.3,           // s: before and after a change, where survivors are looked for
  minArea: 0.001,      // share of the frame: smaller content is ignored when weighing a change
  capArea: 0.04,       // no one element weighs more than this share of the frame: a device or a card that stays would
                       // otherwise outweigh everything changing inside it
  survArea: 0.003,     // share of the frame a survivor standing still must cover to anchor anything
  carryArea: 0.0001,   // a survivor that moves carries from this size up (about 14 px square on 9:16): a dot flying
                       // into the wordmark is a carry
  moved: 0.02,         // a survivor's centre moving this share of the frame's diagonal counts as moving
  scaled: 0.1,         // or its size changing by this much (log scale)
  anchorArea: 0.03,    // survivors standing still covering this share of the frame anchor a change
  handoff: [0.75, 12], // a thing leaving and a thing arriving hand over when their centres are within this many of the
                       // larger one's sizes and their areas within this ratio (the line's full stop becoming the end card's dot)
  follow: 1.0,         // s: how long the new one of a hand-off is followed to see it move or grow
  burst: [3, 1.5],     // this many changes inside this many seconds are a burst of cuts
  cutSnap: 0.2,        // s: a change this close to a declared cut is that cut
  stillPx: 0.5,        // px per 60 fps frame: below it nothing moves
  stillFade: 0.02,     // opacity per sample: below it nothing fades
  fastPx: 40,          // px per 60 fps frame: faster strobes without motion blur
  fadeOp: [0.12, 0.88], fadeArea: 0.08, fadeIoU: 0.3,   // a cross-fade: two interfaces this large, both this transparent
  legible: { '9x16': 22, '1x1': 22, '4x5': 22, '16x9': 16 },
  carry: [0.6, 0.4],   // pass at or above the first, warn down to the second, fail below
  still: [0.15, 0.08], // the share of the film at rest: pass, warn, fail
  cv: [0.3, 0.18],     // the shot lengths' variation (standard deviation over mean): pass, warn, fail
};

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: W, height: H } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(pathToFileURL(path.resolve(file)).href + '?capture=1' + (Q || ''));   // encoded: a '#' in a folder name
  // a page that throws while it boots never becomes ready: say so at once rather than after the timeout
  const failed = new Promise((_, no) => p.on('pageerror', e => no(new Error('the film threw while loading: ' + e.message + ' (film.sh <film> check shows where)'))));
  await Promise.race([p.waitForFunction(() => window.__ready === true, null, { timeout: 30000 }), failed]);
  failed.catch(() => {});
  await p.addScriptTag({ path: path.join(__dirname, 'reader.js') });
  const meta = await p.evaluate(() => ({ dur: window.__DUR, ...(window.__os || {}) }));
  const dur = meta.dur, N = Math.floor(dur * FPS) + 1, A = W * H, DIAG = Math.hypot(W, H);
  const labels = new Map(), S = [];
  for (let i = 0; i < N; i++) {
    const t = Math.min(i / FPS, dur - 1e-3);
    const items = await p.evaluate(t => { window.__seek(t); return window.__osRead({ labels: true }); }, t);
    for (const it of items) { if (!labels.has(it.id)) labels.set(it.id, it.label); delete it.label; }
    S.push({ t, items, by: new Map(items.map(it => [it.id, it])) });
  }
  const lab = id => labels.get(id) || '#' + id;
  const content = it => !it.m;
  const wgt = it => Math.min(it.a, T.capArea * A) * it.op;
  const at = t => S[Math.max(0, Math.min(N - 1, Math.round(t * FPS)))];

  // ---- changes of scene: the share of the content that changes identity across a window
  const turnover = (s1, s2) => {
    let shared = 0, total = 0; const seen = new Set();
    for (const a of s1.items) { if (!content(a) || a.a < T.minArea * A) continue; const b2 = s2.by.get(a.id);
      const wa = wgt(a), wb = b2 && content(b2) ? wgt(b2) : 0; shared += Math.min(wa, wb); total += Math.max(wa, wb); seen.add(a.id); }
    for (const b2 of s2.items) { if (!content(b2) || b2.a < T.minArea * A || seen.has(b2.id)) continue; total += wgt(b2); }
    return total > A * 1e-4 ? 1 - shared / total : 0;
  };
  const hw = Math.max(1, Math.round(T.win * FPS / 2)), turn = new Array(N).fill(0);
  for (let i = hw; i < N - hw; i++) turn[i] = turnover(S[i - hw], S[i + hw]);
  let peaks = [];
  for (let i = hw; i < N - hw; i++) {
    if (turn[i] < T.change) continue;
    let top = true; for (let j = Math.max(0, i - hw); j <= Math.min(N - 1, i + hw); j++) if (turn[j] > turn[i] || (turn[j] === turn[i] && j < i)) top = false;
    if (top) peaks.push(i);
  }
  peaks = peaks.reduce((o, i) => { const l = o[o.length - 1]; if (l != null && (i - l) / FPS < T.gap) { if (turn[i] > turn[l]) o[o.length - 1] = i; } else o.push(i); return o; }, []);

  const rectOf = it => [it.x, it.y, it.x + it.w, it.y + it.h];
  const iou = (r, q) => { const ix = Math.max(0, Math.min(r[2], q[2]) - Math.max(r[0], q[0])), iy = Math.max(0, Math.min(r[3], q[3]) - Math.max(r[1], q[1]));
    const I = ix * iy, U = (r[2] - r[0]) * (r[3] - r[1]) + (q[2] - q[0]) * (q[3] - q[1]) - I; return U > 0 ? I / U : 0; };
  const change = (a, b2) => ({ dc: Math.hypot(b2.x + b2.w / 2 - a.x - a.w / 2, b2.y + b2.h / 2 - a.y - a.h / 2) / DIAG,
    ds: Math.abs(Math.log(Math.sqrt((b2.w * b2.h) / Math.max(1, a.w * a.h)))) });
  const movedEnough = c => c.dc > T.moved || c.ds > T.scaled;
  const cuts = (meta.cuts || []).filter(c => c > 0 && c < dur);

  const changes = peaks.map(i => {
    const t = S[i].t, s1 = at(t - T.side), s2 = at(t + T.side);
    const seen = (it, k) => it && content(it) && it.op >= 0.25 && it.a >= k * A, big = it => seen(it, T.survArea), any = it => seen(it, T.carryArea);
    const surv = s1.items.filter(a => any(a) && any(s2.by.get(a.id))).map(a => ({ a, b: s2.by.get(a.id), c: change(a, s2.by.get(a.id)) }));
    const moving = surv.filter(s => movedEnough(s.c)).sort((x, y) => y.b.a - x.b.a);
    const r = { t: +t.toFixed(3), turnover: +turn[i].toFixed(2) };
    if (cuts.some(c => Math.abs(c - t) <= T.cutSnap)) { r.verdict = 'cut'; r.why = 'a hard cut the film declares'; return r; }
    if (moving.length) { const m = moving[0]; r.verdict = 'carried'; r.by = lab(m.a.id);
      r.why = `${lab(m.a.id)} ${m.c.ds > T.scaled ? (m.b.w * m.b.h > m.a.w * m.a.h ? 'grows' : 'shrinks') : 'moves'} across it`; return r; }
    // a hand-off: something leaves as something new arrives where it was, and the new one then moves or grows
    const i1 = Math.round((t - T.side) * FPS), i2 = Math.round((t + T.side) * FPS);
    const leaving = s1.items.filter(a => any(a) && !any(s2.by.get(a.id)));
    const near = (p, q) => { const d = Math.hypot(p.x + p.w / 2 - q.x - q.w / 2, p.y + p.h / 2 - q.y - q.h / 2), s = Math.max(p.w, p.h, q.w, q.h);
      const ra = Math.max(p.w * p.h, q.w * q.h) / Math.max(1, Math.min(p.w * p.h, q.w * q.h)); return d <= T.handoff[0] * s && ra <= T.handoff[1] || iou(rectOf(p), rectOf(q)) >= 0.35; };
    for (const a of leaving.sort((x, y) => y.a - x.a)) {
      let last = a; for (let k = i1; k <= i2 && k < N; k++) { const q = S[Math.max(0, k)].by.get(a.id); if (q && content(q) && q.op > 0.05) last = q; else if (k > i1) break; }
      // what arrives is a shape or a picture, never words: a line rising where the last one sank is one line replacing another
      for (const nb of s2.items.filter(x => any(x) && x.kind !== 'text' && !any(s1.by.get(x.id)))) {
        let first = null, fk = 0; for (let k = Math.max(0, i1); k <= i2 && k < N; k++) { const q = S[k].by.get(nb.id); if (q && content(q) && q.op > 0.05) { first = q; fk = k; break; } }
        // the new one is followed while it stays, up to a second: a stand-in that starts slowly still travels
        let grows = false; for (let k = fk; first && k < N && k <= fk + T.follow * FPS; k++) { const q = S[k].by.get(nb.id); if (!q) break; if (movedEnough(change(first, q))) { grows = true; break; } }
        if (first && near(last, first) && grows) {
          r.verdict = 'carried'; r.by = `${lab(a.id)} → ${lab(nb.id)}`; r.why = `${lab(a.id)} hands over to ${lab(nb.id)}, which grows out of its place`; return r; }
      }
    }
    // an anchor is something large standing still: small survivors (icons, dots) do not add up to one
    const anchors = surv.filter(x => big(x.a) && big(x.b)), still = anchors.reduce((s, x) => s + x.b.a, 0);
    if (still >= T.anchorArea * A) { const top = anchors.sort((x, y) => y.b.a - x.b.a)[0];
      r.verdict = 'anchored'; r.by = lab(top.a.id); r.why = `${lab(top.a.id)} stays, standing still, while what is in it changes`; return r; }
    r.verdict = 'bare'; r.why = 'nothing on screen survives it: one picture replaced by the next'; return r;
  });
  // bursts: three or more changes inside 1.5 s are hits, not scenes; every member of such a run is one
  const inBurst = new Set();
  for (let i = 0; i < changes.length; i++) { let j = i; while (j + 1 < changes.length && changes[j + 1].t - changes[i].t <= T.burst[1] + 1e-9) j++;
    if (j - i + 1 >= T.burst[0]) for (let k = i; k <= j; k++) inBurst.add(k); }
  changes.forEach((c, k) => { if (inBurst.has(k) && c.verdict !== 'carried' && c.verdict !== 'cut') { c.verdict = 'burst'; c.why = 'inside a burst of hits'; } });
  const judged = changes.filter(c => ['carried', 'anchored', 'bare'].includes(c.verdict));
  const count = v => changes.filter(c => c.verdict === v).length;
  const score = judged.length ? (count('carried') + count('anchored') / 2) / judged.length : null;

  // ---- motion, stillness, rhythm
  const per60 = 60 / FPS, move = new Array(N).fill(0), fade = new Array(N).fill(0), arrive = new Array(N).fill(false), mover = new Array(N).fill(null);
  for (let i = 1; i < N; i++) {
    for (const b2 of S[i].items) { if (!content(b2)) continue; const a = S[i - 1].by.get(b2.id);
      if (!a) { if (b2.a >= T.minArea * A && b2.op > 0.05) arrive[i] = true; continue; }
      if (Math.min(a.op, b2.op) >= 0.05) { const d = Math.max(Math.abs(b2.x - a.x), Math.abs(b2.y - a.y), Math.abs(b2.x + b2.w - a.x - a.w), Math.abs(b2.y + b2.h - a.y - a.h)) / per60;
        if (d > move[i]) { move[i] = d; mover[i] = b2.id; } }
      if (b2.a >= T.minArea * A) fade[i] = Math.max(fade[i], Math.abs(b2.op - a.op)); }
    for (const a of S[i - 1].items) if (content(a) && a.a >= T.minArea * A && a.op > 0.05 && !S[i].by.get(a.id)) arrive[i] = true;
  }
  const still = move.map((m, i) => i > 0 && m < T.stillPx && fade[i] < T.stillFade && !arrive[i]);
  const stillShare = still.filter(Boolean).length / Math.max(1, N - 1);
  let run = 0, longest = 0, longestAt = 0;
  still.forEach((s, i) => { run = s ? run + 1 : 0; if (run > longest) { longest = run; longestAt = i; } });
  const marks = [0, ...changes.map(c => c.t), dur].sort((a, b2) => a - b2);
  const shots = marks.slice(1).map((m, i) => m - marks[i]).filter(x => x >= 0.15);
  const mean = shots.reduce((s, x) => s + x, 0) / Math.max(1, shots.length);
  const cv = shots.length > 1 ? Math.sqrt(shots.reduce((s, x) => s + (x - mean) ** 2, 0) / shots.length) / mean : null;
  // a declared cut is a jump, not travel: the samples either side of one are left out of the peak speed
  const atCut = i => cuts.some(c => Math.abs(c - i / FPS) <= 1.5 / FPS);
  let peak = 0, peakAt = 0; move.forEach((m, i) => { if (m > peak && !atCut(i)) { peak = m; peakAt = i; } });

  // ---- cross-fades, legibility, safe zone, framing
  // a cross-fade: one interface fading in over another fading out (two parts of one device fading out together are not)
  const fades = [];
  S.forEach((s, si) => { if (!si) return; const prev = S[si - 1];
    const iface = s.items.filter(it => content(it) && it.n >= 3 && it.a >= T.fadeArea * A && it.op >= T.fadeOp[0] && it.op <= T.fadeOp[1])
      .map(it => { const q = prev.by.get(it.id); return { it, d: q ? it.op - q.op : it.op }; }).filter(x => Math.abs(x.d) > 0.005);
    let hit = null; for (let i = 0; i < iface.length && !hit; i++) for (let j = i + 1; j < iface.length; j++)
      if (Math.sign(iface[i].d) !== Math.sign(iface[j].d) && iou(rectOf(iface[i].it), rectOf(iface[j].it)) >= T.fadeIoU) { hit = [iface[i].it.id, iface[j].it.id]; break; }
    if (hit) { const l = fades[fades.length - 1]; if (l && s.t - l.to <= 1.5 / FPS) l.to = s.t; else fades.push({ from: s.t, to: s.t, a: lab(hit[0]), b: lab(hit[1]) }); } });
  const crossfades = fades.filter(f => f.to > f.from).map(f => ({ ...f, from: +f.from.toFixed(2), to: +f.to.toFixed(2) }));
  const minPx = T.legible[FMT] || 16, biggest = new Map();
  for (const s of S) for (const it of s.items) if (it.kind === 'text' && it.op >= 0.9 && it.a > 4) {
    const w = (labels.get(it.id) || '').match(/^"([^"]*)"/); if (!w || w[1].replace(/[^\p{L}\p{N}]/gu, '').length < 2) continue;
    const m = biggest.get(it.id); if (!m || it.px > m.px) biggest.set(it.id, { px: it.px, t: s.t }); }
  const small = [...biggest.entries()].filter(([, v]) => v.px < minPx).map(([id, v]) => ({ text: lab(id), px: v.px, t: +v.t.toFixed(2) })).sort((a, b2) => a.px - b2.px);
  // words that rest under the feed's buttons for half a second or more (passing through in a push is not resting there)
  const unsafe = [];
  if (FMT === '9x16') { const seen = new Set(), runs = new Map(), REST = Math.round(0.5 * FPS);
    for (const s of S) for (const it of s.items) { if (it.kind !== 'text' || it.m || it.op < 0.9 || it.a < 50 || seen.has(it.id)) continue;
      const [x0, y0, x1, y1] = it.ink || rectOf(it); let why = null;
      if (y0 < 220 && y1 > 0) why = 'above y 220, under the feed\'s top bar';
      else if ((x0 < 60 && x1 > 0) || (x1 > 1020 && x0 < W)) why = 'outside x 60 to 1020';
      else if (x1 > 950 && y1 > 1000 && y0 < 1650) why = 'in the right-hand column of buttons (x 950+, y 1000-1650)';
      if (!why) { runs.delete(it.id); continue; }
      const r = runs.get(it.id) || { n: 0, t: s.t, why }; r.n++; runs.set(it.id, r);
      if (r.n >= REST) { seen.add(it.id); unsafe.push({ text: lab(it.id), t: +r.t.toFixed(2), why: r.why }); } } }
  const framing = [], kept = new Set();
  for (const s of S) for (const it of s.items) { if (!it.keep) continue; kept.add(it.id);
    if (it.op >= 0.3 && (it.x < -0.5 || it.y < -0.5 || it.x + it.w > W + 0.5 || it.y + it.h > H + 0.5)) {
      const l = framing[framing.length - 1]; if (l && l.id === it.id && s.t - l.to <= 1.5 / FPS) l.to = s.t; else framing.push({ id: it.id, text: lab(it.id), from: s.t, to: s.t }); } }

  // ---- the legs
  const grade = (v, [pass, warn], hi = true) => v == null ? 'n/a' : hi ? (v >= pass ? 'PASS' : v >= warn ? 'WARN' : 'FAIL') : (v <= pass ? 'PASS' : v <= warn ? 'WARN' : 'FAIL');
  const cvGrade = shots.length >= 4 ? grade(cv, T.cv) : 'n/a';
  const stillGrade = grade(stillShare, T.still);
  const worst = (...g) => g.includes('FAIL') ? 'FAIL' : g.includes('WARN') ? 'WARN' : g.every(x => x === 'n/a') ? 'n/a' : 'PASS';
  const bars = s => meta.bpm ? ` (${(s / (240 / meta.bpm)).toFixed(1)} bars)` : '';
  const legs = {
    carry: { grade: grade(score, T.carry), score: score == null ? null : +score.toFixed(2),
      say: judged.length ? `${judged.length} change${judged.length > 1 ? 's' : ''} judged: ${count('carried')} carried, ${count('anchored')} anchored, ${count('bare')} bare` +
        (count('bare') ? ` (bare at ${changes.filter(c => c.verdict === 'bare').map(c => c.t.toFixed(2) + ' s').join(', ')})` : '') +
        (count('cut') + count('burst') ? `; ${count('cut')} declared cuts and ${count('burst')} in bursts not judged` : '') : 'no change of scene found: one continuous picture' },
    rhythm: { grade: worst(cvGrade, stillGrade), cv: cv == null ? null : +cv.toFixed(2), still: +stillShare.toFixed(2), longestStill: +(longest / FPS).toFixed(2),
      shots: shots.map(x => +x.toFixed(2)),
      say: `${shots.length} shots, ${shots.length ? Math.min(...shots).toFixed(2) + ' to ' + Math.max(...shots).toFixed(2) + ' s' : ''}` +
        (cv != null ? `, variation ${cv.toFixed(2)}${cvGrade === 'FAIL' ? ': all about the same length, which reads as slides' : ''}` : '') +
        `; still ${(stillShare * 100).toFixed(0)}% of the film, longest rest ${(longest / FPS).toFixed(2)} s` + (longest ? ` ending at ${(longestAt / FPS).toFixed(2)} s` : '') },
    speed: { grade: peak > T.fastPx ? 'WARN' : 'PASS', peak: +peak.toFixed(1), t: +(peakAt / FPS).toFixed(2), by: mover[peakAt] ? lab(mover[peakAt]) : null,
      say: `peak ${peak.toFixed(0)} px a frame at ${(peakAt / FPS).toFixed(2)} s` + (mover[peakAt] ? ` (${lab(mover[peakAt])})` : '') +
        (peak > T.fastPx ? ': strobes in a quick render, smears in the preview and the final (motion blur)' : '') },
    crossfade: { grade: crossfades.length ? 'FAIL' : 'PASS', list: crossfades,
      say: crossfades.length ? crossfades.map(f => `${f.from}-${f.to} s: ${f.a} over ${f.b}`).join('; ') : 'none' },
    legible: { grade: small.length ? 'WARN' : 'PASS', min: minPx, list: small,
      say: small.length ? `${small.length} text${small.length > 1 ? 's' : ''} never reach ${minPx} px: ${small.slice(0, 4).map(s => `${s.text} ${s.px} px`).join(', ')}${small.length > 4 ? ', ...' : ''}` : `every text reaches ${minPx} px` },
    safe: { grade: FMT !== '9x16' ? 'n/a' : unsafe.length ? 'WARN' : 'PASS', list: unsafe,
      say: FMT !== '9x16' ? 'only for 9:16' : unsafe.length ? unsafe.slice(0, 4).map(u => `${u.text} at ${u.t} s, ${u.why}`).join('; ') : 'every word clear of the feed\'s buttons' },
    framing: { grade: !kept.size ? 'n/a' : framing.length ? 'FAIL' : 'PASS', list: framing.map(f => ({ ...f, from: +f.from.toFixed(2), to: +f.to.toFixed(2) })),
      say: !kept.size ? 'nothing marked data-keep' : framing.length ? framing.map(f => `${f.text} leaves the frame ${f.from.toFixed(2)}-${f.to.toFixed(2)} s`).join('; ') : `${kept.size} kept element${kept.size > 1 ? 's' : ''} stay in frame` },
  };
  if (errs.length) legs.page = { grade: 'FAIL', say: errs.slice(0, 3).join(' | ') };

  // ---- thumbnails either side of each change, and a strip
  const c = await p.context().newCDPSession(p);
  const shot = async (t, k) => { await p.evaluate(t => window.__seek(t), Math.max(0, Math.min(dur - 1e-3, t)));
    const r = await c.send('Page.captureScreenshot', { format: 'jpeg', quality: 72, clip: { x: 0, y: 0, width: W, height: H, scale: k } }); return 'data:image/jpeg;base64,' + r.data; };
  const TK = (W > H ? 320 : 200) / W;
  for (const ch of changes) { ch.before = await shot(ch.t - T.side, TK); ch.after = await shot(ch.t + T.side, TK); }
  const strip = []; for (let t = 0; t < dur; t += Math.max(0.5, dur / 24)) strip.push({ t: +t.toFixed(2), src: await shot(t, (W > H ? 160 : 90) / W) });
  await b.close();

  const report = { film: opt.title || path.basename(file, '.html'), format: FMT, dur, bpm: meta.bpm || null, fps: FPS, legs,
    changes: changes.map(({ before, after, ...x }) => x), curves: { turn: turn.map(v => +v.toFixed(3)), move: move.map(v => +v.toFixed(1)), still } };
  fs.writeFileSync(path.join(outDir, 'read.json'), JSON.stringify(report, null, 1));
  fs.writeFileSync(path.join(outDir, 'read.html'), html(report, changes, strip));
  console.log(`read ${report.film} ${FMT.replace('x', ':')}  (${dur.toFixed(2)} s${meta.bpm ? ', ' + meta.bpm + ' BPM' : ''}, ${N} samples)`);
  for (const [k, v] of Object.entries(legs)) console.log(`  ${k.padEnd(9)} ${String(v.grade).padEnd(4)}  ${k === 'carry' && v.score != null ? v.score.toFixed(2) + '  ' : ''}${v.say}`);
  console.log('report:', path.join(outDir, 'read.html'));
  if (opt.strict && Object.values(legs).some(v => v.grade === 'FAIL')) process.exit(1);
})().catch(e => { console.error(e.stack || e.message); process.exit(1); });

// ---------- the report page: self-contained, light and dark
function html(R, changes, strip) {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const N = R.curves.turn.length, X = i => (i / Math.max(1, N - 1)) * 1000;
  const turnPath = R.curves.turn.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${(60 - v * 54).toFixed(1)}`).join('');
  const mmax = Math.max(40, ...R.curves.move);
  const movePath = R.curves.move.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${(130 - Math.min(v, mmax) / mmax * 54).toFixed(1)}`).join('');
  let rests = '', s0 = null;
  R.curves.still.forEach((s, i) => { if (s && s0 == null) s0 = i; if ((!s || i === N - 1) && s0 != null) { rests += `<rect x="${X(s0)}" y="74" width="${Math.max(1, X(i) - X(s0))}" height="58" class="rest"/>`; s0 = null; } });
  const tx = t => (t / R.dur) * 1000;
  const ticks = changes.map(c => `<line x1="${tx(c.t)}" x2="${tx(c.t)}" y1="0" y2="136" class="v-${c.verdict}"/>`).join('');
  const secs = Array.from({ length: Math.floor(R.dur) + 1 }, (_, s) => `<text x="${tx(s)}" y="150">${s}</text>`).join('');
  const legRows = Object.entries(R.legs).map(([k, v]) => `<tr><th>${esc(k)}</th><td><span class="g g-${esc(String(v.grade).replace('/', ''))}">${esc(v.grade)}</span></td><td>${k === 'carry' && v.score != null ? `<b>${v.score.toFixed(2)}</b>: ` : ''}${esc(v.say)}</td></tr>`).join('');
  const cards = changes.map(c => `<figure class="card v-${c.verdict}"><div class="pair"><img src="${c.before}" alt="before"><img src="${c.after}" alt="after"></div>
    <figcaption><span class="tag t-${c.verdict}">${esc(c.verdict)}</span> <b>${c.t.toFixed(2)} s</b><br>${esc(c.why)}</figcaption></figure>`).join('');
  const stripHtml = strip.map(s => `<figure class="st"><img src="${s.src}" alt=""><figcaption>${s.t} s</figcaption></figure>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Read: ${esc(R.film)}</title><style>
:root{--bg:#f6f6f3;--surf:#fff;--ink:#17181c;--muted:#666a73;--line:#e3e3de;--pass:#1f8a4c;--warn:#b26a00;--fail:#c62f2f;--na:#8a8d94;--carried:#1f8a4c;--anchored:#b26a00;--bare:#c62f2f;--cut:#5865c8;--burst:#8a5cc8;--rest:rgba(31,138,76,.12);--curve:#17181c}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#111214;--surf:#1a1b1e;--ink:#ecedf0;--muted:#9a9ea7;--line:#2b2d31;--pass:#4cc27f;--warn:#e0a03a;--fail:#ef6a6a;--carried:#4cc27f;--anchored:#e0a03a;--bare:#ef6a6a;--cut:#8f9bff;--burst:#b892ff;--rest:rgba(76,194,127,.14);--curve:#ecedf0}}
:root[data-theme="dark"]{--bg:#111214;--surf:#1a1b1e;--ink:#ecedf0;--muted:#9a9ea7;--line:#2b2d31;--pass:#4cc27f;--warn:#e0a03a;--fail:#ef6a6a;--carried:#4cc27f;--anchored:#e0a03a;--bare:#ef6a6a;--cut:#8f9bff;--burst:#b892ff;--rest:rgba(76,194,127,.14);--curve:#ecedf0}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
main{max-width:1180px;margin:0 auto;padding:28px 16px 60px}h1{font-size:22px;margin:0 0 2px}h2{font-size:15px;margin:28px 0 10px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.06em}
.sub{color:var(--muted);margin:0 0 18px}table{width:100%;border-collapse:collapse;background:var(--surf);border:1px solid var(--line);border-radius:10px;overflow:hidden}
th,td{text-align:left;padding:9px 12px;border-top:1px solid var(--line);vertical-align:top}tr:first-child th,tr:first-child td{border-top:0}th{width:96px;font-weight:600}td:nth-child(2){width:70px}
.g{font-weight:700;font-size:12px;padding:2px 7px;border-radius:6px;border:1px solid currentColor}.g-PASS{color:var(--pass)}.g-WARN{color:var(--warn)}.g-FAIL{color:var(--fail)}.g-na{color:var(--na)}
.tl{background:var(--surf);border:1px solid var(--line);border-radius:10px;padding:12px}.tl svg{width:100%;height:auto;display:block;overflow:visible}
.tl path{fill:none;stroke:var(--curve);stroke-width:1.4}.tl .rest{fill:var(--rest)}.tl text{fill:var(--muted);font-size:10px;text-anchor:middle}.tl .lbl{text-anchor:start;font-size:11px}
.tl line{stroke-width:2}.v-carried{stroke:var(--carried)}.v-anchored{stroke:var(--anchored)}.v-bare{stroke:var(--bare)}.v-cut{stroke:var(--cut);stroke-dasharray:3 3}.v-burst{stroke:var(--burst);stroke-dasharray:2 2}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(${R.format === '16x9' ? 330 : 220}px,1fr));gap:12px}
.card{margin:0;background:var(--surf);border:1px solid var(--line);border-radius:10px;padding:8px}.pair{display:flex;gap:4px}.pair img{width:50%;border-radius:4px;display:block;border:1px solid var(--line)}
figcaption{font-size:13px;margin-top:6px;color:var(--muted)}figcaption b{color:var(--ink)}
.tag{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}.t-carried{color:var(--carried)}.t-anchored{color:var(--anchored)}.t-bare{color:var(--bare)}.t-cut{color:var(--cut)}.t-burst{color:var(--burst)}
.strip{display:flex;gap:6px;overflow-x:auto;padding-bottom:6px}.st{margin:0;flex:0 0 auto}.st img{height:${R.format === '16x9' ? 90 : 160}px;border-radius:4px;display:block;border:1px solid var(--line)}.st figcaption{text-align:center;margin-top:2px}
.key{display:flex;flex-wrap:wrap;gap:14px;font-size:13px;color:var(--muted);margin-top:8px}.key i{display:inline-block;width:14px;height:3px;vertical-align:middle;margin-right:5px}
</style></head><body><main>
<h1>${esc(R.film)}</h1><p class="sub">${R.format.replace('x', ':')}, ${R.dur.toFixed(2)} s${R.bpm ? ', ' + R.bpm + ' BPM' : ''}, read at ${R.fps} samples a second</p>
<table>${legRows}</table>
<h2>The film over time</h2><div class="tl"><svg viewBox="-4 -12 1012 170"><text class="lbl" x="0" y="-2">how much of the picture is changing identity</text>${ticks}<path d="${turnPath}"/>
${rests}<text class="lbl" x="0" y="72">fastest travel on screen (green: at rest)</text><path d="${movePath}"/>${secs}</svg>
<div class="key"><span><i style="background:var(--carried)"></i>carried</span><span><i style="background:var(--anchored)"></i>anchored</span><span><i style="background:var(--bare)"></i>bare</span><span><i style="background:var(--cut)"></i>declared cut</span><span><i style="background:var(--burst)"></i>burst</span></div></div>
<h2>Every change of scene, 0.3 s either side</h2><div class="cards">${cards || '<p class="sub">No change of scene: one continuous picture.</p>'}</div>
<h2>The film every ${(strip[1] ? strip[1].t - strip[0].t : 1).toFixed(2)} s</h2><div class="strip">${stripHtml}</div>
</main></body></html>`;
}
