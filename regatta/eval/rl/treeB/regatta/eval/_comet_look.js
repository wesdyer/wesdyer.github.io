// Side-by-side look at the wind-comet layer: same seeded race, same frame, different
// weightings — and a forced-pressure mode so the hot end can be judged without sailing
// two minutes up the beat to reach it.
const { chromium } = require('playwright');
const path = require('path');
const OUT = '/private/tmp/claude-501/-Users-wesdyer-Documents-GitHub-wesdyer-github-io/d4fb1166-2abc-4e3b-a981-fea7ac01df07/scratchpad/';

const VARIANTS = {
  base: {},
  wide: { w0: 3.2, w1: 4.4, a0: 0.34, a1: 0.42 },
  bold: { w0: 3.0, w1: 4.2, a0: 0.34, a1: 0.52, dens1: 0.34 },
  dense: { dens0: 0.09, dens1: 0.42 }
};
// Ramp variants: hot end orange (as the LiveLine reference) vs pale gold (no clash with
// the orange inflatable marks).
const RAMPS = {
  amber: null,
  gold: [[0.00, [150, 196, 228]], [0.45, [226, 240, 252]], [0.78, [255, 231, 168]], [1.00, [255, 208, 110]]]
};

const jobs = [];
for (const v of (process.env.COMET_VARIANTS || 'base,wide,bold').split(','))
  for (const r of (process.env.COMET_RAMPS || 'amber').split(','))
    for (const t of (process.env.COMET_T || 'real,0.15,0.9').split(','))
      jobs.push({ v, r, t });

(async () => {
  const b = await chromium.launch();
  for (const job of jobs) {
    const p = await b.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 });
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' })));
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForTimeout(2500);
    await p.evaluate(({ cfg, ramp, forceT }) => {
      window.__COMET = cfg;
      if (ramp) {
        // Rebuild the LUT in place — same interpolation the renderer bakes with.
        const N = STREAK_LUT.length;
        for (let i = 0; i < N; i++) {
          const t = (i + 0.5) / N;
          let a = ramp[0], c = ramp[ramp.length - 1];
          for (let s = 0; s < ramp.length - 1; s++) if (t >= ramp[s][0] && t <= ramp[s + 1][0]) { a = ramp[s]; c = ramp[s + 1]; break; }
          const f = c[0] === a[0] ? 0 : (t - a[0]) / (c[0] - a[0]);
          STREAK_LUT[i] = [0, 1, 2].map(k => Math.round(a[1][k] + (c[1][k] - a[1][k]) * f));
        }
      }
      if (forceT !== null) { const real = window.pressureAt; window.pressureAt = () => forceT; window.__realPressureAt = real; }
      if (typeof startRace === 'function') startRace();
    }, { cfg: VARIANTS[job.v] || {}, ramp: RAMPS[job.r], forceT: job.t === 'real' ? null : +job.t });
    await p.waitForTimeout(9000);
    const n = await p.evaluate(() => state.particles.filter(q => q.type === 'wind').length);
    await p.screenshot({ path: `${OUT}look_${job.v}_${job.r}_${job.t}.png` });
    console.log(`${job.v}/${job.r}/t=${job.t}  streaks=${n}  ${errs.length ? 'ERR ' + errs[0] : ''}`);
    await p.close();
  }
  await b.close();
})();
