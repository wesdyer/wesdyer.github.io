// The nav grid's edge buckets change no answer: every venue's grid built bucketed and plain, cell for cell
// (nav and tight tiers), with its curves stripped and with them on.   node regatta/eval/_grid_bucket_check.js
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html')); await p.waitForFunction(() => window.SailCheck && window.VENUE_DOC);
  const out = await p.evaluate(() => {
    const lines = []; let bad = 0;
    for (const v of Object.keys(window.VENUE_DOC)) {
      const doc0 = window.VENUE_DOC[v]; if (!doc0.shapes || !doc0.shapes.length) continue;
      for (const curves of [false, true]) {
        const doc = curves ? doc0 : Object.assign({}, doc0, { shapes: doc0.shapes.map(s => { const o = Object.assign({}, s); delete o.smooth; return o; }) });
        const land = window.VenueDoc.raceShapes(doc).filter(sh => { const t = window.VenueDoc.traits(sh); return t.motion === 'fixed' && !t.awash; });
        const arena = window.VenueDoc.compile(doc, true).boundary || (state.course && state.course.boundary);
        let g1, g2, t1, t2;
        try {
          let t = performance.now(); g1 = SailCheck._buildGridRaw(land, arena, [], {}); t1 = performance.now() - t;
          t = performance.now(); g2 = SailCheck._buildGridRaw(land, arena, [], { noBuckets: true }); t2 = performance.now() - t;
        } catch (e) { lines.push(`${v} ${curves ? 'curves' : 'plain '}: ERROR ${e.message}`); bad++; continue; }
        let diff = 0; for (const k of ['nav', 'tight']) if (g1[k] && g2[k]) for (let i = 0; i < g1[k].length; i++) if (g1[k][i] !== g2[k][i]) diff++;
        if (diff) bad++;
        lines.push(`${v.padEnd(10)} ${curves ? 'curves' : 'plain '}  cells ${g1.nav.length}  differ ${diff}   bucketed ${t1.toFixed(0)} ms vs plain ${t2.toFixed(0)} ms`);
      }
    }
    return lines.join('\n') + `\n${bad ? 'FAIL' : 'PASS'} — ${bad} venue grids differ`;
  });
  console.log(out); await b.close(); })();
