// Probe the wind-comet layer: does what is DRAWN match what getWindAt says, and does
// each channel (density / length / width / colour) actually vary with pressure?
const { chromium } = require('playwright');
const path = require('path');
const OUT = '/private/tmp/claude-501/-Users-wesdyer-Documents-GitHub-wesdyer-github-io/d4fb1166-2abc-4e3b-a981-fea7ac01df07/scratchpad/';
const VENUE = process.argv[2] || 'arctic';
const SHOT = process.argv[3] || VENUE;

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('C:' + m.text()); });

  await p.addInitScript(v => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForTimeout(3000);
  await p.evaluate(() => { if (typeof startRace === 'function') startRace(); });
  await p.waitForTimeout(9000);

  // Let the fleet actually sail up the course, so the heavy end is seen the way a player
  // sees it (camera, spawn box and all) rather than through a pinned camera that the game
  // fights back against every frame.
  const extra = +(process.env.COMET_WAIT || 0);
  if (extra > 0) await p.waitForTimeout(extra * 1000);

  const info = await p.evaluate(() => {
    const s = window.state;
    const cam = s.camera, cw = 1600, ch = 1000;
    const parts = s.particles.filter(q => q.type === 'wind');
    const onScreen = parts.filter(q => Math.abs(q.x - cam.x) < cw / 2 && Math.abs(q.y - cam.y) < ch / 2);

    // ── ACCURACY: does each drawn comet agree with the field it sits in? ──
    const dirErrDeg = [], lenErr = [], lens = [], widths = [], hues = [], press = [];
    let offWater = 0, belowMin = 0;
    for (const q of parts) {
      const truth = getWindAt(q.x, q.y);
      if (!Arena.contains(s.course.boundary, q.x, q.y, 0) || !inMaskWater(q.x, q.y)) offWater++;
      if (truth.speed < STREAK_MIN_WIND) belowMin++;
      if (!q.trail || q.trail.length < 2) continue;
      // Drawn heading = most recent history point -> head (the way the air is going).
      const hx = q.x - q.trail[0].x, hy = q.y - q.trail[0].y;
      if (Math.hypot(hx, hy) < 0.01) continue;
      const drawnDir = Math.atan2(-hx, hy);   // wind FROM convention, matching getWindAt
      const d = ((drawnDir - truth.direction + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      dirErrDeg.push(Math.abs(d) * 180 / Math.PI);

      const tail = q.trail[q.trail.length - 1];
      const L = Math.hypot(q.x - tail.x, q.y - tail.y);
      lens.push(L);
      const span = (q.trail.length - 1) * WIND_TAIL_STEP + q.trailT;
      const expect = truth.speed * 15 * q.drift * span;
      if (expect > 1) lenErr.push(L / expect);

      const t = pressureAt(q.spd || 0);
      press.push(t);
      // Straight off the renderer's own channel function — never a copy of the formula.
      const ch = streakChannels(t, q.jit || 0.5, q.spd || 0);
      widths.push(ch.halfWidth);
      hues.push(STREAK_LUT.indexOf(ch.color));
    }
    const agg = a => { a = a.slice().sort((x, y) => x - y); return a.length ? { min: +a[0].toFixed(3), p25: +a[(a.length * .25) | 0].toFixed(3), med: +a[(a.length / 2) | 0].toFixed(3), p75: +a[(a.length * .75) | 0].toFixed(3), max: +a[a.length - 1].toFixed(3) } : null; };

    const bins = [0, 0, 0, 0];
    for (const t of press) bins[Math.min(3, (t * 4) | 0)]++;

    // What the player actually sails through: wind + drawn pressure at each mark, and
    // across the visible box right now.
    const mk = s.course.marks;
    const marks = (Array.isArray(mk) ? mk : Object.values(mk || {})).filter(m => m && typeof m.x === 'number');
    const atMarks = marks.map(m => ({ n: m.name || m.kind || '?', kt: +getWindAt(m.x, m.y).speed.toFixed(1), t: +pressureAt(getWindAt(m.x, m.y).speed).toFixed(2) }));
    const view = [];
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
      const x = cam.x + (i / 4 - 0.5) * cw, y = cam.y + (j / 4 - 0.5) * ch;
      if (!Arena.contains(s.course.boundary, x, y, 0) || !inMaskWater(x, y)) continue;
      view.push(+pressureAt(getWindAt(x, y).speed).toFixed(2));
    }

    return {
      venue: settings.venue, status: s.race.status,
      pressureScale: s.wind.pressure,
      windParticles: parts.length, onScreen: onScreen.length, totalParticles: s.particles.length,
      accuracy: {
        dirErrorDeg: agg(dirErrDeg),
        lenRatioVsPhysics: agg(lenErr),
        streaksOffWater: offWater,
        streaksBelowMinWind: belowMin
      },
      variation: {
        pressureT: agg(press), lengthUnits: agg(lens), halfWidth: agg(widths),
        hueBucketsUsed: new Set(hues).size,
        countByPressureQuartile: bins
      },
      course: { atMarks, viewPressureSpread: agg(view) }
    };
  });
  console.log(JSON.stringify(info, null, 1));
  console.log('errors:', errs.slice(0, 5));
  await p.screenshot({ path: OUT + SHOT + '_comets.png' });
  await b.close();
})();
