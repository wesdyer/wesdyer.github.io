// The river lost its current. Did it keep its CONTAINMENT?
// The clamp is the net that catches a boat which tunnelled through the bank
// polygons; without it the fleet once ground along the wall to DNF.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  const r = await p.evaluate(() => {
    localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'river' }));
    let worstLat = 0, worstAlong = 0, clamps = 0, dnf = 0, races = 0, finished = 0;
    for (let race = 0; race < 6; race++) {
      let s = 700 + race * 4441;
      Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      resetGame();
      races++;
      const rc = state.course.riverCorridor;
      if (!rc) return { error: 'no riverCorridor on the river venue' };
      state.race.status = 'racing';
      let hits = 0;
      const realEvt = window.onRaceEvent;
      window.onRaceEvent = (k, d) => { if (k === 'collision_boundary') hits++; if (realEvt) realEvt(k, d); };
      for (let f = 0; f < 3600; f++) {
        update(1 / 60);
        for (const bt of state.boats) {
          const rx = bt.x - rc.cx, ry = bt.y - rc.cy;
          worstLat = Math.max(worstLat, Math.abs(rx * rc.rx + ry * rc.ry));
          worstAlong = Math.max(worstAlong, Math.abs(rx * rc.ux + ry * rc.uy));
        }
      }
      window.onRaceEvent = realEvt;
      clamps += hits;
      dnf += state.boats.filter(bt => bt.raceState.dnf).length;
      finished += state.boats.filter(bt => bt.raceState.finished).length;
    }
    return { races, worstLat: +worstLat.toFixed(0), worstAlong: +worstAlong.toFixed(0),
             clamps, dnf, finished, boats: state.boats.length };
  });
  if (r.error) { console.log('FAIL —', r.error); process.exit(1); }
  console.log(`river, ${r.races} races x 60s of sim, ${r.boats} boats each`);
  console.log(`  worst lateral excursion : ${r.worstLat}  (clamp limit 1120)`);
  console.log(`  worst along excursion   : ${r.worstAlong}`);
  console.log(`  clamp events            : ${r.clamps}`);
  console.log(`  finished ${r.finished}, DNF ${r.dnf}`);
  const ok = r.worstLat <= 1121 && r.dnf === 0;
  console.log(ok ? '\nPASS — boats stayed in the corridor and nobody DNFd'
                 : '\nFAIL — containment leaked');
  console.log('errors:', errs.length ? errs.slice(0,2) : 'none');
  await b.close();
  process.exit(ok ? 0 : 1);
})();
