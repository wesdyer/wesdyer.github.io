// PT-016 probe: the Cove's cargo-ship porpoises — the ship's speed and size, and how often a surfaced
// porpoise is under the hull (inside its length x beam) or behind the bow.   node eval/rl/_pt016_probe.js
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  const r = await p.evaluate(() => { let s = 5;
    Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'bay', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
    selectVenue('bay'); resetGame(); startRace();
    let firstGap = [], lastGap = [], up = 0, under = 0, behind = 0, gapSum = 0, ships = new Set(), spd = [];
    for (let i = 0; i < 300 * 30; i++) { update(1 / 30);
      for (const P of Wildlife.debug().pods) { const S = P.ship; ships.add(S); if (i % 30 === 0) { if (S._px != null) spd.push(Math.hypot(S.x - S._px, S.y - S._py)); S._px = S.x; S._py = S.y; }
        const fx = Math.sin(S.heading), fy = -Math.cos(S.heading);
        for (const m of P.members) { if (m.phase < 0) continue; up++;
          const dx = m.sx - S.x, dy = m.sy - S.y, along = dx * fx + dy * fy, across = Math.abs(-dx * fy + dy * fx);
          if (Math.abs(along) < S.hullLen / 2 && across < S.hullBeam / 2) under++;
          if (along < S.hullLen / 2 + 5 && across < S.hullBeam / 2 + 10) behind++;
          gapSum += along - S.hullLen / 2;
          if (m.phase < 0.03) firstGap.push(along - S.hullLen / 2); if (m.phase > 0.97) lastGap.push(along - S.hullLen / 2); } } }
    const S = [...ships][0];
    return { ships: ships.size, len: S && Math.round(S.hullLen), beam: S && Math.round(S.hullBeam), uPerSec: spd.length ? (spd.reduce((a, b) => a + b) / spd.length).toFixed(1) : '-', upFrames: up, underHull: (under / up * 100).toFixed(1) + '%', atOrBehindBow: (behind / up * 100).toFixed(1) + '%', meanGapAheadOfBow: (gapSum / up).toFixed(0), surfaceGap: (firstGap.reduce((a, b) => a + b, 0) / firstGap.length).toFixed(0), diveGap: (lastGap.reduce((a, b) => a + b, 0) / lastGap.length).toFixed(0) };
  });
  console.log(JSON.stringify(r)); console.log(errs.length ? 'errors: ' + errs.slice(0, 3).join(' | ') : 'no page errors'); await b.close(); })();
