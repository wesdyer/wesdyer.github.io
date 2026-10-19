// Probe: how high each venue's flying animals fly (z, u) over two minutes, sampled live — the median and 90th percentile
// of every airborne one (z > 3) in each wildlife list — and so how much larger perspective draws them: zScale(z) =
// AIR_CAM / (AIR_CAM - z), AIR_CAM 600 (some birds use their own 1 + z/400 or 1 + z/500: within a few % of it here).
//   node regatta/eval/_air_heights.js [venue ...]
const { chromium } = require('playwright'); const path = require('path');
const VENUES = process.argv.slice(2).length ? process.argv.slice(2) : ['bay','lake','lagoon','swamp','river','ocean','redrock','glowtide','arctic','otter','flats','volcanic','seatrials'];
(async () => { const b = await chromium.launch();
  for (const v of VENUES) { const p = await b.newPage(); await p.goto('file://' + path.resolve('regatta/index.html')); await p.waitForFunction(() => window.state && typeof selectVenue === 'function');
    const r = await p.evaluate(v => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); settings.venue = v; selectVenue(v); resetGame(); for (const o of state.boats) { o.x = 1e6; o.y = 1e6; }
      const d0 = Wildlife.debug(), Z = {};
      const walk = (key, o, depth) => { if (!o || typeof o !== 'object' || depth > 3) return; if (Array.isArray(o)) { for (const q of o) walk(key, q, depth + 1); return; }
        for (const k of ['birds', 'members']) if (Array.isArray(o[k])) for (const q of o[k]) walk(key, q, depth + 1);
        if (typeof o.z === 'number' && typeof o.x === 'number' && o.z > 3) (Z[key] = Z[key] || []).push(o.z); };
      for (let i = 0; i < 30 * 120; i++) { Wildlife.update(1 / 30); if (i % 30) continue; const d = Wildlife.debug(); for (const k in d) if (Array.isArray(d[k]) || (d[k] && typeof d[k] === 'object' && Array.isArray(d[k].birds))) walk(k, d[k], 0); }
      const out = {}; for (const k in Z) { const a = Z[k].sort((x, y) => x - y), q = (f) => a[Math.min(a.length - 1, Math.floor(a.length * f))];
        out[k] = { n: a.length, zMed: Math.round(q(0.5)), z90: Math.round(q(0.9)), scaleMed: +(600 / (600 - Math.min(q(0.5), 480))).toFixed(2), scale90: +(600 / (600 - Math.min(q(0.9), 480))).toFixed(2) }; }
      return out; }, v);
    console.log(v.padEnd(10), JSON.stringify(r)); await p.close(); }
  await b.close(); })();
