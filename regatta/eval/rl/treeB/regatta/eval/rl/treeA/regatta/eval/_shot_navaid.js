// Where a ladder rung / layline meets the sailing limit — the layering the user asked for.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 850 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForTimeout(1200);
  const info = await p.evaluate(() => {
    localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'seatrials' }));
    let s = 90210;
    Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    resetGame();
    state.race.status = 'racing';
    for (const id of ['pre-race-overlay','results-overlay']) {
      const el = document.getElementById(id); if (el) el.classList.add('hidden');
    }
    // Put the player mid-beat so the ladder rungs and laylines are live...
    const pl = state.boats[0];
    pl.x = 0; pl.y = -2000; pl.heading = 0;
    state.camera.target = 'free';
    // ...and look at the eastern limit, level with him, where a rung must cross it.
    const bd = state.course.boundary;
    const east = Math.max(...bd.poly.map(q => q[0]));
    state.camera.x = east; state.camera.y = -2000;
    state.camera.rotation = 0;
    draw();
    return { east, legs: state.race.totalLegs, leg: pl.raceState && pl.raceState.leg };
  });
  await p.screenshot({ path: 'regatta/eval/_bnd_navaid.png' });
  console.log(JSON.stringify(info), 'errors:', errs.length ? errs.slice(0,3) : 'none');
  await b.close();
})();
