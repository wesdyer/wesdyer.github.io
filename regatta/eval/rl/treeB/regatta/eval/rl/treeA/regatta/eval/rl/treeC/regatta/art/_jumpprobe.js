const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const br = await chromium.launch();
  const p = await br.newPage({ viewport: { width: 1000, height: 700 }, deviceScaleFactor: 1 });
  await p.goto('file://' + path.resolve('/Users/wesdyer/Documents/GitHub/wesdyer.github.io/regatta', 'index.html'));
  await p.waitForTimeout(1200);
  await p.evaluate(() => { settings.venue = 'arctic'; resetGame(); startRace(); });
  await p.waitForTimeout(4000);
  const r = await p.evaluate(() => new Promise(res => {
    const cols = state.course.islands.filter(i => i.penguins);
    const prev = new Map();
    const ev = { headSnap: [], posJump: [], edgeStreak: [], offIce: 0, samples: 0 };
    const streak = new Map();
    let frames = 0;
    const tick = () => {
      for (const isl of cols) {
        const col = isl.penguins;
        for (const b of col.birds) {
          const key = b;
          const pv = prev.get(key);
          // BLOCKED = wants to walk, but the containment branch stopped it.
          // A bird merely standing near the rim is not stuck, it is standing.
          const wantsToWalk = b.walk > 0.05;
          const moved = pv ? (Math.abs(b.lx - pv.x) + Math.abs(b.ly - pv.y)) > 1e-6 : true;
          const blocked = wantsToWalk && (pv ? Math.hypot(b.lx-pv.x,b.ly-pv.y) < 1e-4 : false);
          streak.set(key, blocked ? (streak.get(key) || 0) + 1 : 0);
          const st = streak.get(key) || 0;
          if (st) ev.edgeStreak.push(st);
          // is the bird still on the floe's ice?
          const rr = outlineRadiusAt(isl.localArt, Math.atan2(b.ly, b.lx));
          if (Math.hypot(b.lx, b.ly) > rr) ev.offIce++;
          if (pv) {
            let dh = Math.abs(b.heading - pv.h) % (Math.PI * 2);
            if (dh > Math.PI) dh = Math.PI * 2 - dh;
            if (dh > 0.5) ev.headSnap.push(+dh.toFixed(2));
            const dp = Math.hypot(b.lx - pv.x, b.ly - pv.y);
            if (dp > 3) ev.posJump.push(+dp.toFixed(1));
          }
          prev.set(key, { h: b.heading, x: b.lx, y: b.ly });
          ev.samples++;
        }
      }
      if (++frames < 420) requestAnimationFrame(tick);
      else res({
        frames, birds: cols.reduce((s, i) => s + i.penguins.birds.length, 0),
        headSnaps: ev.headSnap.length, worstSnapRad: Math.max(0, ...ev.headSnap),
        posJumps: ev.posJump.length, worstJumpPx: Math.max(0, ...ev.posJump),
        longestBlockedFrames: Math.max(0, ...ev.edgeStreak),
        blockedFramesPct: +(ev.edgeStreak.length / ev.samples * 100).toFixed(1),
        offIceSamples: ev.offIce, samples: ev.samples,
      });
    };
    requestAnimationFrame(tick);
  }));
  console.log(JSON.stringify(r, null, 1));
  await br.close();
})();
