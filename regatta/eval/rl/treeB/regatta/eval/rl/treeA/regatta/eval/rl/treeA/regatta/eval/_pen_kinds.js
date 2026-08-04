// WHICH penalties. A count is not a diagnosis.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
  await p.addInitScript(v => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), process.env.V || 'ocean');
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForTimeout(2500);
  console.log(process.env.V || 'ocean', JSON.stringify(await p.evaluate(async () => {
    const tally = {};
    // Only count a penalty that actually LANDS. triggerPenalty fires its event on every
    // frame of grinding contact but flags the boat once, so counting events measures
    // contact-frames and not penalties — a 9x difference in one and not the other.
    window.onRaceEvent = (kind, info) => {
      if (kind !== 'penalty' || !info || !info.boat) return;
      if (info.boat.raceState.penalty) return;          // already flagged: same episode
      const k = info.rule || info.kind || 'unknown';
      tally[k] = (tally[k] || 0) + 1;
      // For a mark touch: how long since this boat's leg advanced? If the AI is turning
      // onto the next leg while still on the buoy, these cluster at ~0.
      if (k === 'Rule 31') {
        const dt2 = state.race.timer - (info.boat.raceState.legStartTime || 0);
        window.__sinceLeg = window.__sinceLeg || [];
        window.__sinceLeg.push(+dt2.toFixed(2));
      }
    };
    let legs = 0;
    for (let seed = 0; seed < 6; seed++) {
      let s = 90210 + seed;
      Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      resetGame(); startRace();
      for (let i = 0; i < 300 * 60 && !state.boats.every(x => x.raceState.finished); i++) update(1 / 60);
      legs += state.boats.reduce((a, x) => a + x.raceState.leg, 0);
    }
    const sl = (window.__sinceLeg || []).sort((a, b) => a - b);
    return { tally, totalLegsSailed: legs,
             markTouchSecondsAfterLegAdvance: sl.length
               ? { n: sl.length, p25: sl[(sl.length * .25) | 0], med: sl[sl.length >> 1], p75: sl[(sl.length * .75) | 0],
                   within3s: sl.filter(x => x < 3).length }
               : null };
  })));
  await b.close();
})();
