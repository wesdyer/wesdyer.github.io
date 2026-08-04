// Every venue: does the streak layer produce a sane population, and does it cost anything?
const { chromium } = require('playwright');
const path = require('path');
const OUT = '/private/tmp/claude-501/-Users-wesdyer-Documents-GitHub-wesdyer-github-io/d4fb1166-2abc-4e3b-a981-fea7ac01df07/scratchpad/';
const VENUES = ['arctic','bay','lake','river','redrock','glowtide','lagoon','swamp','ocean','seatrials'];
(async () => {
  const b = await chromium.launch();
  const rows = [];
  for (const v of VENUES) {
    const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(vv => localStorage.setItem('regatta_settings', JSON.stringify({ venue: vv })), v);
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForTimeout(2500);
    await p.evaluate(() => { if (typeof startRace === 'function') startRace(); });
    await p.waitForTimeout(9000);
    rows.push(await p.evaluate(() => {
      const s = window.state, cam = s.camera;
      const parts = s.particles.filter(q => q.type === 'wind');
      const on = parts.filter(q => Math.abs(q.x - cam.x) < 700 && Math.abs(q.y - cam.y) < 450);
      let off = 0, ts = [], lens = [], wid = [], asp = [];
      for (const q of parts) {
        if (!Arena.contains(s.course.boundary, q.x, q.y, 0) || !inMaskWater(q.x, q.y)) off++;
        ts.push(pressureAt(q.spd || 0));
        const w = streakChannels(pressureAt(q.spd || 0), q.jit || 0.5, q.spd || 0).halfWidth;
        wid.push(w);
        if (q.trail && q.trail.length > 1) { const t = q.trail[q.trail.length - 1];
          const L = Math.hypot(q.x - t.x, q.y - t.y); lens.push(L); asp.push(L / (2 * w)); }
      }
      const med = a => { a = a.slice().sort((x, y) => x - y); return a.length ? +a[(a.length / 2) | 0].toFixed(2) : null; };
      return { venue: settings.venue,
        pressure: s.wind.pressure ? { lo: +s.wind.pressure.lo.toFixed(1), hi: +s.wind.pressure.hi.toFixed(1) } : null,
        baseKt: +s.wind.speed.toFixed(1),
        streaks: parts.length, onScreen: on.length, offWater: off,
        medT: med(ts), medLen: med(lens), medHalfW: med(wid), medAspect: med(asp) };
    }));
    if (errs.length) rows[rows.length - 1].err = errs[0];
    await p.screenshot({ path: OUT + 'venue_' + v + '.png' });
    await p.close();
  }
  console.table(rows);
  await b.close();
})();
