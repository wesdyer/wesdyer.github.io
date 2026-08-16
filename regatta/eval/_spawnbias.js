// WHAT SPAWN CHANCE DOES THE CODE COMPUTE INSIDE A PUFF vs OUTSIDE IT?
//
// Counting the living comet population conflates the spawn rule with drift, lifetime and the
// cell's own growth and decay — and on a venue where puffs cover 1% of the water the sample
// inside one is too small to divide by. This asks the rule directly: sample points, take the
// puff intensity and the spawn chance at each, and bin.
//
// ⚠️ IT RE-DERIVES `chance` FROM THE SAME PIECES drawGusts... no — from the same pieces the
// SPAWNER uses (`_streakRef`, `pressureAt`, `cometCfg`), all of which are live globals, so
// it cannot measure a formula the game stopped using. The one transcription is the ellipse
// test for puff intensity, which is checked against getWindAt's own speed below.
const { chromium } = require('playwright');
const path = require('path');
const VENUES = process.argv.slice(2).length ? process.argv.slice(2) : ['lake', 'redrock', 'ocean'];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForTimeout(1400);
  console.log('  venue     bin     n      wind kt   windiness   t(press)   chance   x clear');
  for (const v of VENUES) {
    const r = await p.evaluate((vv) => {
      state.paused = true; settings.venue = vv; resetGame(); startRace();
      for (let i = 0; i < 3000; i++) update(1 / 60);
      const puffAt = (x, y) => {
        let m = 0;
        for (const g of state.gusts) {
          const dx = x - g.x, dy = y - g.y;
          const c = Math.cos(-g.rotation), s2 = Math.sin(-g.rotation);
          const rx0 = dx * c - dy * s2, ry = dx * s2 + dy * c;
          const rx = rx0 >= 0 ? rx0 / 0.65 : rx0 / 1.35;
          const d2 = (rx * rx) / (g.radiusX * g.radiusX) + (ry * ry) / (g.radiusY * g.radiusY);
          if (d2 > 1) continue;
          const t = 1 - Math.sqrt(d2);
          const life = Math.min(g.age / 5, 1) * Math.min((g.duration - g.age) / 5, 1);
          const i2 = Math.max(0, t * t * (3 - 2 * t) * life) * (g.speedDelta >= 0 ? 1 : -1);
          if (Math.abs(i2) > Math.abs(m)) m = i2;
        }
        return m;
      };
      // ⚠️ SQUALLS ARE A THIRD SOURCE and on a trade-wind venue they are the ONLY one that
      // matters: Pearl Lagoon's regions are flat to a tenth of a knot and its cells cover 2%
      // of the water, so everything a player can read there is squall. Binning only by puff
      // would have reported that venue as having nothing to see.
      const inSquall = (x, y) => {
        for (const q of (state.squalls || [])) {
          const dx = x - q.x, dy = y - q.y;
          const ux = -Math.sin(q.course), uy = Math.cos(q.course);
          const along = dx * ux + dy * uy, across = dx * uy - dy * ux;
          if ((along * along) / (q.ry * q.ry) + (across * across) / (q.rx * q.rx) < 1) return true;
        }
        return false;
      };
      const bins = { puff: [], squall: [], clear: [], lull: [] };
      const world = (state.course.doc && state.course.doc.world) ? state.course.doc.world.size : 12000;
      for (let i = 0; i < 60000; i++) {
        const x = (Math.random() - 0.5) * world * 1.8, y = (Math.random() - 0.5) * world * 1.8;
        if (!Arena.contains(state.course.boundary, x, y, 0) || !inMaskWater(x, y)) continue;
        const spd = getWindAt(x, y).speed;
        const windiness = Math.max(0, Math.min(1, (spd - _streakRef.floor) / _streakRef.span));
        const t = pressureAt(spd);
        const c = cometCfg();
        const chance = windiness <= 0 ? 0
          : Math.min(STREAK_MAX_SPAWN, c.dens0 + c.dens1 * windiness * (0.18 + 0.82 * t * t));
        const v2 = puffAt(x, y);
        const bin = v2 > 0.25 ? bins.puff : v2 < -0.25 ? bins.lull
                  : inSquall(x, y) ? bins.squall : bins.clear;
        bin.push([spd, windiness, t, chance]);
      }
      const avg = (a, k) => a.length ? a.reduce((s, r) => s + r[k], 0) / a.length : 0;
      const out = {};
      for (const k of Object.keys(bins))
        out[k] = { n: bins[k].length, spd: +avg(bins[k], 0).toFixed(1), w: +avg(bins[k], 1).toFixed(2),
                   t: +avg(bins[k], 2).toFixed(2), c: +avg(bins[k], 3).toFixed(3) };
      return out;
    }, v);
    for (const k of ['puff', 'squall', 'clear', 'lull']) {
      const o = r[k];
      if (!o.n) { console.log(`  ${v.padEnd(9)} ${k.padEnd(6)} ${String(o.n).padEnd(6)} —`); continue; }
      const ratio = r.clear.c > 0 ? (o.c / r.clear.c).toFixed(2) : '—';
      console.log(`  ${v.padEnd(9)} ${k.padEnd(6)} ${String(o.n).padEnd(6)} ${String(o.spd).padStart(6)}   ${String(o.w).padStart(7)}   ${String(o.t).padStart(7)}   ${String(o.c).padStart(6)}   ${String(ratio).padStart(5)}`);
    }
  }
  console.log('errors', errs.length ? errs.slice(0, 3) : 'none');
  await b.close();
})();
