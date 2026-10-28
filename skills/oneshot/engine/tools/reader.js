/* reader.js: runs inside a film's page and reports what is on screen right now, for read.cjs and gallery.cjs.
   window.__osRead() walks the page and returns every element that paints something of its own (an image, an SVG, a
   canvas, its own text, a background, a border or a shadow), with its box on screen (transforms included, cut to its
   clipping ancestors and to the frame), its effective opacity (its own times every ancestor's) and an identity that
   stays the same from one call to the next (the DOM node itself), so two reads at two times can be compared.
   A film marks what is not content with data-os on an element (it holds for everything inside it):
     ground   the stage under everything (the night, the aurora): never content, never a carry
     chrome   what stays on screen the whole film (the kicker, the wordmark): never a carry
     veil     a wipe or a dimming layer: never a carry, never one of the two screens of a cross-fade
   and data-keep on an element that must stay wholly inside the frame whenever it is visible. */
(() => {
  if (window.__osRead) return;
  const ids = new WeakMap(), rg = document.createRange(); let nextId = 1;
  const idOf = e => { let v = ids.get(e); if (!v) { v = nextId++; ids.set(e, v); } return v; };
  const alphaOf = c => { if (!c || c === 'transparent') return 0; const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return 1;
    const p = m[1].split(/[ ,/]+/).filter(Boolean); return p.length > 3 ? parseFloat(p[3]) : 1; };
  const ownText = e => { let s = ''; for (const n of e.childNodes) if (n.nodeType === 3) s += n.nodeValue; return s.replace(/\s+/g, ' ').trim(); };
  const name = e => {
    let s = e.tagName.toLowerCase();
    if (e.id) s += '#' + e.id;
    const c = typeof e.className === 'string' ? e.className.trim().split(/\s+/).filter(Boolean).slice(0, 2) : [];
    if (c.length) s += '.' + c.join('.');
    return s;
  };
  function paints(e, cs) {
    const t = e.tagName;
    if (t === 'IMG' || t === 'CANVAS' || t === 'VIDEO' || t === 'svg') return 'media';
    if (ownText(e)) return 'text';
    if (alphaOf(cs.backgroundColor) > 0.02 || cs.backgroundImage !== 'none') return 'box';
    if (cs.boxShadow !== 'none') return 'box';
    for (const s of ['Top', 'Right', 'Bottom', 'Left'])
      if (parseFloat(cs['border' + s + 'Width']) > 0 && cs['border' + s + 'Style'] !== 'none' && alphaOf(cs['border' + s + 'Color']) > 0.02) return 'box';
    return null;
  }
  // the label a person reads in a report: the element's own words, else its tag and classes
  const label = (e, kind) => { const w = kind === 'text' ? ownText(e) : e.getAttribute('aria-label') || '';
    return (w ? '"' + w.slice(0, 28) + (w.length > 28 ? '…' : '') + '" ' : '') + name(e); };
  window.__osRead = (opt = {}) => {
    const VW = innerWidth, VH = innerHeight, out = [];
    function walk(e, op, clip, mark, keep) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none') return 0;
      const o = op * parseFloat(cs.opacity);
      if (o < 0.01) return 0;
      const m = (e.dataset && e.dataset.os) || mark, k = keep || (e.dataset && e.dataset.keep != null);
      let r = null, c = clip;
      const kind = paints(e, cs);
      if (kind || cs.overflow !== 'visible') r = e.getBoundingClientRect();
      if (cs.overflowX !== 'visible' && cs.overflowY !== 'visible' && r)
        c = [Math.max(c[0], r.left), Math.max(c[1], r.top), Math.min(c[2], r.right), Math.min(c[3], r.bottom)];
      let n = 0;
      if (e.tagName !== 'svg') for (const ch of e.children) n += walk(ch, o, c, m, k);
      if (kind && cs.visibility !== 'hidden' && r && r.width > 0.5 && r.height > 0.5) {
        const x0 = Math.max(c[0], r.left), y0 = Math.max(c[1], r.top), x1 = Math.min(c[2], r.right), y1 = Math.min(c[3], r.bottom);
        const a = Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
        if (a > 1 || k) {
          const it = { id: idOf(e), x: r.left, y: r.top, w: r.width, h: r.height, a, op: +o.toFixed(4), kind, n };
          if (m) it.m = m;
          else if (kind === 'box' && a >= 0.98 * VW * VH) it.m = 'ground';   // a plain box filling the frame is the stage
          if (k) it.keep = 1;
          if (kind === 'text') { const oh = e.offsetHeight; it.px = +(parseFloat(cs.fontSize) * (oh > 0 ? r.height / oh : 1)).toFixed(1);
            // where the words themselves are (a centred line in a full-width box is not at the frame's edge)
            let tb = null; for (const tn of e.childNodes) { if (tn.nodeType !== 3 || !tn.nodeValue.trim()) continue; rg.selectNodeContents(tn);
              const q = rg.getBoundingClientRect(); if (q.width > 0) tb = tb ? [Math.min(tb[0], q.left), Math.min(tb[1], q.top), Math.max(tb[2], q.right), Math.max(tb[3], q.bottom)] : [q.left, q.top, q.right, q.bottom]; }
            if (tb) it.ink = tb.map(v => +v.toFixed(1)); }
          if (opt.labels) it.label = label(e, kind);
          out.push(it);
        }
        n++;
      }
      return n;
    }
    walk(document.body, 1, [0, 0, VW, VH], null, false);
    return out;
  };
  // how far anything visible travels on screen between two times (CSS px): the renderer sizes each frame's shutter from
  // it. A film can answer itself with window.__motion(t0, t1) (a canvas that moves, say); this is the fallback. It
  // leaves the page at t1. Opacity alone changing needs no motion blur, so it counts only boxes that move or resize.
  window.__osTravel = (t0, t1) => {
    if (typeof window.__motion === 'function') return window.__motion(t0, t1);
    window.__seek(t0); const A = new Map(window.__osRead().map(i => [i.id, i]));
    window.__seek(t1); let d = 0;
    for (const b of window.__osRead()) { const a = A.get(b.id); if (!a || a.m === 'ground' || Math.min(a.op, b.op) < 0.05) continue;
      d = Math.max(d, Math.abs(b.x - a.x), Math.abs(b.y - a.y), Math.abs(b.x + b.w - a.x - a.w), Math.abs(b.y + b.h - a.y - a.h)); }
    return d;
  };
})();
