// Minimap: is the active target the loudest thing on it, and are the inactive ones quiet?
const { chromium } = require('playwright');
const path = require('path');
const OUT = '/private/tmp/claude-501/-Users-wesdyer-Documents-GitHub-wesdyer-github-io/d4fb1166-2abc-4e3b-a981-fea7ac01df07/scratchpad/';
(async () => {
  const b = await chromium.launch();
  for (const v of (process.env.V || 'arctic,bay').split(',')) {
    const p = await b.newPage({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 3 });
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(vv => localStorage.setItem('regatta_settings', JSON.stringify({ venue: vv })), v);
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForTimeout(2500);
    await p.evaluate(() => { if (typeof startRace === 'function') startRace(); });
    await p.waitForTimeout(3000);
    // The player is human-driven, so it never leaves leg 0 unattended. Put it on the leg
    // we want to LOOK at — this is a rendering check, not a race.
    await p.evaluate(L => { state.boats[0].raceState.leg = L; }, +(process.env.LEG || 0));
    await p.waitForTimeout(600);
    const info = await p.evaluate(() => {
      const s = window.state, pl = s.boats[0], e = routeLeg(pl.raceState.leg);
      return { venue: settings.venue, leg: pl.raceState.leg, kind: e && e.kind,
               gateMarks: legMarks(pl.raceState.leg), hasRoundMark: !!(e && e.mark),
               status: s.race.status };
    });
    console.log(JSON.stringify(info), errs.slice(0, 2));
    const el = await p.$('#minimap');
    if (el) await el.screenshot({ path: OUT + 'mini_' + v + '_leg' + (process.env.LEG || 0) + '.png' });
    await p.close();
  }
  await b.close();
})();
