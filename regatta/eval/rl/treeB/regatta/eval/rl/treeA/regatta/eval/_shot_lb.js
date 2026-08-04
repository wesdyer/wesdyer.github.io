// The leaderboard, and a boat fading out after the finish.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 850 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForTimeout(1400);
  await p.evaluate(() => {
    localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'seatrials' }));
    let s = 90210;
    Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    resetGame();
    state.race.status = 'racing';
    for (const id of ['pre-race-overlay','results-overlay']) {
      const el = document.getElementById(id); if (el) el.classList.add('hidden');
    }
    // Driven the way the game drives it: the leaderboard refreshes on the DRAW cadence,
    // every 10 frames. Running the sim without it leaves prevRank/lbRank stale, so every
    // row looks as though it just changed places and sprouts a trend arrow.
    for (let i = 0; i < 6000; i++) { update(1/60); if (i % 10 === 0) updateLeaderboard(); }
    draw();
  });
  await p.waitForTimeout(400);
  await p.screenshot({ path: 'regatta/eval/_lb.png', clip: { x: 0, y: 60, width: 380, height: 600 } });

  // Fade: sample a finished boat's opacity over time.
  const fade = await p.evaluate(() => {
    const bt = state.boats[3];
    bt.raceState.finished = true;
    const out = [];
    for (let step = 0; step <= 5; step++) {
      out.push({ t: +(step * 0.5).toFixed(1), op: +bt.opacity.toFixed(2) });
      for (let i = 0; i < 30; i++) update(1/60);
    }
    return out;
  });
  console.log('finished boat opacity:', fade.map(f => `${f.t}s=${f.op}`).join('  '));
  console.log('errors:', errs.length ? errs.slice(0,3) : 'none');
  await b.close();
})();
