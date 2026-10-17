// Every veg and reef sprite bake is pixel-identical between two trees (the indexed ring queries change no
// pixel): bake each venue's beds in both and compare the canvases byte for byte. Served over http so the
// canvases can be read.   OLD=<old repo root> node regatta/eval/_bake_equal_check.js
const { chromium } = require('playwright'); const http = require('http'); const fs = require('fs'); const path = require('path');
const roots = { old: process.env.OLD, new: path.resolve('.') };
const serve = (root) => new Promise(res => { const s = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.png') ? 'image/png' : f.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); r.end(d); }); }); s.listen(0, () => res(s)); });
(async () => {
  const b = await chromium.launch(); const hashes = {};
  for (const k of ['old', 'new']) {
    const srv = await serve(roots[k]); const p = await b.newPage();
    await p.goto(`http://localhost:${srv.address().port}/regatta/index.html`); await p.waitForFunction(() => window.VENUE_DOC && typeof bakeVegSprite === 'function');
    hashes[k] = await p.evaluate(async () => {
      const out = {};
      const h = (c) => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let x = 2166136261; for (let i = 0; i < d.length; i++) x = Math.imul(x ^ d[i], 16777619); return c.width + 'x' + c.height + ':' + (x >>> 0).toString(16); };
      for (const [v, doc] of Object.entries(window.VENUE_DOC)) {
        if (!doc.shapes || !doc.shapes.length) continue;
        settings.venue = v; try { selectVenue(v); resetGame(); } catch (e) { out[v] = 'ERR ' + e.message; continue; }
        for (const isl of state.course.islands || []) {
          let c = null;
          try {
            if (isl.reef) { bakeReefSprite(isl); c = isl._reefSprite; }
            else if (isl.veg && typeof VEG_STYLES !== 'undefined' && VEG_STYLES[isl.veg]) { bakeVegSprite(isl, VEG_STYLES[isl.veg]); c = isl._vegSprite; }
          } catch (e) { out[v + '/' + isl.id] = 'ERR ' + e.message; continue; }
          if (c && c.getContext) out[v + '/' + isl.id] = h(c); else if (c && c.canvas) out[v + '/' + isl.id] = h(c.canvas);
        }
      }
      return out;
    });
    await p.close(); srv.close();
  }
  const keys = Object.keys(hashes.new); let same = 0, diff = [];
  for (const k of keys) if (hashes.old[k] === hashes.new[k]) same++; else diff.push(k);
  console.log(`${keys.length} bakes: ${same} identical, ${diff.length} differ${diff.length ? ' — ' + diff.slice(0, 8).join(', ') : ''} — ${diff.length ? 'FAIL' : 'PASS'}`);
  await b.close(); })();
