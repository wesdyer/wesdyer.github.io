// Results chart at the finish: VMC must not spike on the finish sample, and the gap line must run to
// your finish even when the reference boat's log stops at your finish (the fast-forward does not sample).
// Sea Trials, the player's boat sailed by the AI; the other boats' logs are cut at the player's finish.
const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.addInitScript(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'seatrials' })); });
  await p.goto('file://' + path.resolve('regatta/index.html')); await p.waitForFunction(() => window.state && state.boats.length > 0);
  console.log(await p.evaluate(() => {
    resetGame(); startRace(); state.paused = true;
    const me = state.boats.find(b => b.isPlayer); me.isPlayer = false; me.speedScale = 1.25;   // the AI sails it, fast enough to win
    let n = 0; while (!me.raceState.finished && n++ < 60 * 900) { me.isPlayer = false; update(1 / 60); }
    me.isPlayer = true;
    let m = 0; while (state.boats.some(b => !b.isPlayer && !b.raceState.finished) && m++ < 60 * 300) update(1 / 60);
    const L = { t0: RaceLog.t0, dt: RACELOG_DT, boats: RaceLog.boats.map(B => Object.assign({}, B)), events: RaceLog.events, legStart: RaceLog.legStart,
                me: RaceLog.boats.findIndex(B => B.boat === me), legs: me.raceState.legTimes.length, key: 'x' };
    const cut = Math.floor((me.raceState.finishTime - L.t0) / L.dt) + 1;
    L.boats.forEach((B, i) => { if (i !== L.me) B.s = B.s.slice(0, cut); });       // as the fast-forward leaves them
    const S = _rcSeries(L);
    const vmax = Math.max(...S.pts.map(p => p.vmcS || 0)), lastGap = [...S.pts].reverse().find(p => p.gapS != null);
    return `finished ${me.raceState.finishTime.toFixed(1)} s; chart ends ${S.tMax.toFixed(1)} s; VMC max ${vmax.toFixed(1)} kn; per-leg VMC ${S.legs.map(g => g.vmcAvg == null ? '-' : g.vmcAvg.toFixed(1)).join(' ')}; ` +
      `gap vs ${S.refName} runs to ${lastGap ? lastGap.t.toFixed(1) : '-'} s, last gap ${S.legs[S.legs.length - 1].gap != null ? S.legs[S.legs.length - 1].gap.toFixed(1) : '-'} s, ref finished ${(() => { const r = state.boats.find(b => b.name === S.refName); return r ? r.raceState.finishTime.toFixed(1) : '?'; })()} s`;
  }));
  console.log('page errors:', errs.length ? errs : 'none'); await b.close(); })();
