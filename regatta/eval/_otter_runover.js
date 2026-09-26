// Probe: replays a recorded Otter Point race (the player's boat moved along the track at its real
// heading and speed) through the wildlife and counts the animals in the water the boat RAN OVER —
// came within 30 u of (hull half-length) — sea otters at the surface and swimming sea lions — and how
// many animals got out of the way (were inside 250 u of the boat's path ahead and cleared it).
//   node regatta/eval/_otter_runover.js <traj.json> [...]     (from the repo root)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const files = process.argv.slice(2);
(async () => { const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  for (const f of files) {
    const j = JSON.parse(fs.readFileSync(f, 'utf8')), tr = j.samples.filter(s => s[1] === 1).map(s => [s[0], s[2], s[3], s[4], s[5]]);
    const r = await p.evaluate((tr) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'otter', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
      resetGame(); state.race.status = 'racing';
      const me = state.boats[0]; me.opacity = 1; for (const o of state.boats.slice(1)) { o.x = 1e6; o.y = 1e6; }
      const hitO = new Set(), hitL = new Set(), nearO = new Set(), nearL = new Set(), modesO = {}, modesL = {}, dt = 1 / 30; let k = 0, oFrames = 0, lFrames = 0, near = 0;
      for (let t = tr[0][0]; t < tr[tr.length - 1][0]; t += dt) {
        while (k < tr.length - 2 && tr[k + 1][0] < t) k++;
        const [t0, x0, y0, h0, s0] = tr[k], [t1, x1, y1] = tr[k + 1], u = Math.max(0, Math.min(1, (t - t0) / ((t1 - t0) || 1)));
        me.x = x0 + (x1 - x0) * u; me.y = y0 + (y1 - y0) * u; me.heading = h0; me.speed = s0; me.velocity = { x: Math.sin(h0) * s0, y: -Math.cos(h0) * s0 }; me.raceState.finished = false;
        state.camera.x = me.x; state.camera.y = me.y;
        Wildlife.update(dt);
        const d = Wildlife.debug();
        // the hull: a 55 u stick along the heading; an animal within 14 u of it is under the boat
        const fx = Math.sin(me.heading), fy = -Math.cos(me.heading), under = (x, y) => { const dx = x - me.x, dy = y - me.y, a = Math.max(-27, Math.min(27, dx * fx + dy * fy)); return Math.hypot(dx - fx * a, dy - fy * a) < 14; };
        for (const G of d.seaOtterRafts) for (const m of G.members) { if (m.mode !== 'under' && m.mode !== 'dive' && under(m.x, m.y)) { oFrames++; hitO.add(m); }
            const dd = Math.hypot(m.x - me.x, m.y - me.y); if (m.mode !== 'under' && dd < 90) { nearO.add(m); (modesO[m.mode] = (modesO[m.mode] || 0) + 1); } }
        for (const G of d.slGroups) for (const q of G.members) { const dd = Math.hypot(q.x - me.x, q.y - me.y); if (!q.gone && dd < 90) { nearL.add(q); (modesL[G.mode] = (modesL[G.mode] || 0) + 1); } }
        for (const G of d.slGroups) for (const q of G.members) if (!q.gone && !(q.z > 0.15) && !(q.flung > 0) && under(q.x, q.y)) { lFrames++; hitL.add(q); }
      }
      return { otters: hitO.size, otterFrames: oFrames, lions: hitL.size, lionFrames: lFrames, near90: { otters: nearO.size, lions: nearL.size }, otterModesWhenNear: modesO, lionGroupModesWhenNear: modesL };
    }, tr);
    console.log(path.basename(f), JSON.stringify(r));
  }
  console.log(errs.length ? errs[0] : 'ok'); await b.close(); })();
