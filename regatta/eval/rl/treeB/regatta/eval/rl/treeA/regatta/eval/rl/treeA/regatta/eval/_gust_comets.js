// A puff must show up in the COMET layer, because that is now its only wind cue: it
// modifies the field, and the comets read the field. Sample inside a cell vs clear water
// alongside it and compare every channel the comets vary.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  await p.addInitScript(() => localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' })));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForTimeout(2500);
  console.log(JSON.stringify(await p.evaluate(() => {
    for (const r of (state.course.gustRegions || [])) r.count = 14;
    startRace();
    for (let i = 0; i < 60 * 30; i++) update(1 / 60);
    const cells = state.gusts.filter(g => Arena.contains(state.course.boundary, g.x, g.y, 0) && inMaskWater(g.x, g.y));
    const out = [];
    for (const g of cells.slice(0, 6)) {
      // The puff's contribution AT THE SAME POINT: getWindAt includes cells, regionWindAt
      // is the mean field without them. Comparing against a point "alongside" is fragile —
      // an offset that lands outside a wind region reads 0 kt and every ratio explodes.
      const wIn = getWindAt(g.x, g.y), wOut = regionWindAt(g.x, g.y);
      const snap = (spd) => { const c = streakChannels(pressureAt(spd), 0.5, spd);
                              return { halfWidth: c.halfWidth, color: c.color.slice() }; };
      const chIn = snap(wIn.speed), chOut = snap(wOut.speed);
      const dens = (spd) => {
        const w = Math.max(0, Math.min(1, (spd - STREAK_MIN_WIND) / 9));
        const t = pressureAt(spd);
        return +(Math.min(STREAK_MAX_SPAWN, COMET.dens0 + COMET.dens1 * w * (0.3 + 0.7 * t * t))).toFixed(3);
      };
      out.push({
        type: g.type,
        kt: { withPuff: +wIn.speed.toFixed(1), meanField: +wOut.speed.toFixed(1) },
        pressureT: { withPuff: +pressureAt(wIn.speed).toFixed(2), meanField: +pressureAt(wOut.speed).toFixed(2) },
        halfWidth: { withPuff: +chIn.halfWidth.toFixed(2), meanField: +chOut.halfWidth.toFixed(2) },
        colour: { withPuff: chIn.color.join(','), meanField: chOut.color.join(',') },
        spawnChance: { withPuff: dens(wIn.speed), meanField: dens(wOut.speed) },
        cometLenRatio: +(wIn.speed / Math.max(0.1, wOut.speed)).toFixed(2)
      });
    }
    return out;
  }), null, 1));
  await b.close();
})();
