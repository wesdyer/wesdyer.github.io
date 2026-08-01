// A windward gate mark, close enough to be on screen — the indicator should be gone and
// the rounding circle + arrow should remain.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 780 } });
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
    const me = state.boats.find(x => x.isPlayer);
    me.raceState.leg = 1;
    const idx = (typeof legMarks === 'function' && legMarks(1)) || [2, 3];
    const mk = state.course.marks[idx[0]];
    // Sit the player just short of the mark so it is comfortably on screen.
    me.x = mk.x + 120; me.y = mk.y + 420; me.heading = 0;
    state.camera.target = 'free';
    state.camera.x = mk.x; state.camera.y = mk.y + 150;
    state.camera.rotation = 0;
    draw();
    return { mark: idx[0], leg: me.raceState.leg };
  });
  await p.screenshot({ path: 'regatta/eval/_mark_onscreen.png' });
  // ...and far enough away that it is off screen, where the indicator is the point.
  await p.evaluate(() => {
    const me = state.boats.find(x => x.isPlayer);
    state.camera.x = me.x; state.camera.y = me.y + 2600;
    draw();
  });
  await p.screenshot({ path: 'regatta/eval/_mark_offscreen.png' });
  console.log(JSON.stringify(info), 'errors:', errs.length ? errs.slice(0,3) : 'none');
  await b.close();
})();
