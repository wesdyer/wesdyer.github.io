// Look at a gust cell on the water: what does the current sprite actually paint?
const { chromium } = require('playwright');
const path = require('path');
const OUT = '/private/tmp/claude-501/-Users-wesdyer-Documents-GitHub-wesdyer-github-io/d4fb1166-2abc-4e3b-a981-fea7ac01df07/scratchpad/';
(async () => {
  const b = await chromium.launch();
  for (const v of (process.env.V || 'arctic').split(',')) {
    const p = await b.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 });
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(vv => localStorage.setItem('regatta_settings', JSON.stringify({ venue: vv })), v);
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForTimeout(2500);
    const info = await p.evaluate(() => {
      const regs = state.course.gustRegions || [];
      if (!regs.length) return { note: 'venue authors no gust source' };
      for (const r of regs) { r.count = 14; }
      if (typeof startRace === 'function') startRace();
      for (let i = 0; i < 60 * 30; i++) update(1 / 60);
      const inA = state.gusts.filter(g => Arena.contains(state.course.boundary, g.x, g.y, 0) && inMaskWater(g.x, g.y));
      const g = inA.sort((a, c) => (c.radiusX * c.radiusY) - (a.radiusX * a.radiusY))[0] || state.gusts[0];
      if (g) { state.camera.x = g.x; state.camera.y = g.y; state.camera.target = 'free'; }
      draw();
      return { cells: state.gusts.length, inArena: inA.length,
               type: g && g.type, rx: g && Math.round(g.radiusX), ry: g && Math.round(g.radiusY),
               dKt: g && +g.speedDelta.toFixed(1),
               snow: !!(typeof activeGustColors !== 'undefined' && activeGustColors.snow),
               gustColors: typeof activeGustColors !== 'undefined' ? activeGustColors : null };
    });
    console.log(v, JSON.stringify(info), errs.slice(0, 2));
    await p.screenshot({ path: OUT + 'gustlook_' + v + '.png' });
    await p.close();
  }
  await b.close();
})();
