// One-turn penalty diagnostic: per flagged episode, measure time-to-clear,
// whether it cleared before the finish, and secondary fouls while spinning.
// Usage: node regatta/eval/_pen.js [trials] [baseSeed]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const A = process.argv.slice(2);
const NUM = parseInt(A[0]) || 6, BASE = parseInt(A[1]) || 100;
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.resolve('regatta/index.html'));
  await page.addScriptTag({ content: fs.readFileSync('regatta/eval/eval_harness.js', 'utf8') });
  const out = await page.evaluate(({ NUM, BASE }) => {
    const episodes = []; let uncleared = 0, cleared = 0;
    const kinds = { contact: 0, no_contact: 0, other: 0 };
    const hookKinds = (oh) => (t, d) => {
      if (t === 'penalty' && d && d.boat && !d.boat.isPlayer && !d.boat.raceState.penalty) {
        kinds[d.kind === 'no_contact' ? 'no_contact' : (d.kind === 'contact' ? 'contact' : 'other')]++;
      }
      if (oh) oh(t, d);
    };
    for (let i = 0; i < NUM; i++) {
      window.evalHarness.seed = BASE + i;
      window.resetGame(); window.startRace();
      const active = {}; // boatId -> {t0, fouls}
      const oh0 = window.onRaceEvent; window.onRaceEvent = hookKinds(oh0);
      const dt = 1 / 60; let it = 0;
      while (it < 600 * 60) {
        if (state.race.status === 'racing') {
          if (state.boats.every(b => b.isPlayer || b.raceState.finished)) break;
          if (it % 6 === 0) {
            state.boats.forEach(b => {
              if (b.isPlayer) return;
              const flagged = b.raceState.penalty && !b.raceState.finished;
              if (flagged && !active[b.id]) {
                active[b.id] = { t0: state.race.timer, fouls0: b.raceState.totalPenalties, spinSeen: false };
              } else if (active[b.id]) {
                if (b.controller && b.controller.penaltySpin) active[b.id].spinSeen = true;
                if (!flagged || b.raceState.finished) {
                  const ep = active[b.id];
                  const clearedNow = !b.raceState.penalty;
                  episodes.push({
                    dur: +(state.race.timer - ep.t0).toFixed(1),
                    cleared: clearedNow ? 1 : 0,
                    spinSeen: ep.spinSeen ? 1 : 0,
                    extraFouls: b.raceState.totalPenalties - ep.fouls0,
                  });
                  if (clearedNow) cleared++; else uncleared++;
                  delete active[b.id];
                }
              }
            });
          }
        }
        window.update(dt); it++;
      }
      window.onRaceEvent = oh0;
      // boats still flagged at race end (finished flagged)
      Object.keys(active).forEach(() => { uncleared++; });
    }
    return { episodes, cleared, uncleared, kinds };
  }, { NUM, BASE });

  const eps = out.episodes.filter(e => e.cleared);
  const durs = eps.map(e => e.dur).sort((a, b) => a - b);
  const q = p => durs.length ? durs[Math.floor(p * (durs.length - 1))] : 0;
  const extra = out.episodes.reduce((a, e) => a + e.extraFouls, 0);
  const spin = out.episodes.filter(e => e.spinSeen).length;
  console.log('kinds: contact=' + out.kinds.contact + ' no_contact=' + out.kinds.no_contact + ' other=' + out.kinds.other);
  console.log(`episodes=${out.episodes.length} cleared=${out.cleared} unclearedAtFinish=${out.uncleared}`);
  console.log(`time-to-clear: med=${q(0.5).toFixed(1)}s p75=${q(0.75).toFixed(1)}s p90=${q(0.9).toFixed(1)}s max=${durs[durs.length-1] || 0}s`);
  console.log(`spinSeen=${spin}/${out.episodes.length} secondaryFoulsDuringEpisodes=${extra}`);
  await browser.close();
})();
