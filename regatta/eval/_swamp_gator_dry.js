// Probe: do Gatorgrass Bayou's alligators keep their whole bodies off the land? Steps the wildlife for N minutes (boats
// parked far off, so nothing scares them) and tests points along each gator's body — snout to tail tip down the spine
// (the tail at its sweep) and the four splayed legs — against the game's own land test, pointOnLand. Counts frames with
// any of the body over land, per gator, and lists the worst.
//   node regatta/eval/_swamp_gator_dry.js [minutes]      (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
(async () => { const mins = +(process.argv[2] || 5); const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'swamp' })); resetGame(); });
  await p.waitForTimeout(1000);
  console.log(await p.evaluate((mins) => { for (const b2 of state.boats) { b2.x = 1e6; b2.y = 1e6; }
    const D = Wildlife.debug(), S = 1.5;   // GATOR_SCALE
    // body points in the gator's frame (native units, head up): the spine from snout to tail tip, the legs
    // (legs as drawn: splayed afloat, folded back along the flanks swimming — g.fold)
    const spine = []; for (let y = -16; y <= 17; y += 2) spine.push([0, y]);
    const splayed = [[-5.2, -3], [5.2, -3], [-5.2, 5], [5.2, 5], [-4, 0.5], [4, 0.5]], folded = [[-3.8, 0], [3.8, 0], [-3.8, 3], [3.8, 3], [-3.4, 7], [3.4, 7]];
    const tally = D.lurkers.map(() => ({ n: 0, bad: 0, modes: {} }));
    for (let fr = 0; fr < mins * 60 * 30; fr++) { Wildlife.update(1 / 30); if (fr % 3) continue;
      D.lurkers.forEach((g, i) => { if (g.mode === 'under') return; const t = tally[i]; t.n++; const pts = spine.concat((g.fold || 0) > 0.5 ? folded : splayed);
        // the tail as wildlife.js's gatorWave draws it (Oct 15: a travelling wave, 3.2 at the tip swimming, 0.5 afloat)
        const swim = g.mode === 'swim', f = swim ? 0.9 : 0.25, A = swim ? 3.2 : 0.5, ph = (g.bob || 0) * Math.PI * 2 * f, ch = Math.cos(g.h), sh = Math.sin(g.h);
        const hit = pts.some(([x, y]) => { const s = Math.max(0, (y - 5) / 12), xs = y > 5 ? x + A * Math.pow(s, 1.5) * Math.sin(ph - s * Math.PI * 1.3) : x; const X = g.x + (xs * ch - y * sh) * S, Y = g.y + (xs * sh + y * ch) * S; return pointOnLand(X, Y); });
        if (hit) { t.bad++; t.modes[g.mode] = (t.modes[g.mode] || 0) + 1; } }); }
    const tot = tally.reduce((a, t) => a + t.bad, 0), n = tally.reduce((a, t) => a + t.n, 0);
    return `samples ${n}, any of the body over land ${tot} (${(100 * tot / n).toFixed(1)}%)\n` + tally.map((t, i) => t.bad ? `  gator ${i} at (${Math.round(D.lurkers[i].hx)}, ${Math.round(D.lurkers[i].hy)}): ${t.bad}/${t.n} ${JSON.stringify(t.modes)}` : '').filter(Boolean).join('\n'); }, mins));
  await b.close(); })();
