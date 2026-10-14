// PT-039: whole Stillwater races (fleet AI, player on the bot): finishers and times, and how many
// boat-seconds were spent pressed to a swim line (within 15 u of its rope) and stuck (< 1 kt).
//   ROOT=<checkout's regatta dir> node eval/rl/_pt039_race.js seed...
const { chromium } = require('playwright'); const path = require('path');
const ROOT = process.env.ROOT || path.resolve('.'), seeds = process.argv.slice(2).map(Number);
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForFunction(() => window.state && window.VenueDoc && typeof resetGame === 'function');
  for (const seed of seeds) {
    const r = await p.evaluate((seed) => { let s = seed;
      Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'lake', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
      selectVenue('lake'); resetGame(); startRace();
      const me = state.boats[0]; me.controller = new BotController(me);
      const segs = []; for (const pr of (state.course.props || []).filter(q => q.kind === 'lake-swim-line')) { const H = VenueDoc.propHitRings(pr); for (const ring of H.rings) for (let i = 0; i < ring.length; i++) segs.push([ring[i], ring[(i + 1) % ring.length]]); }
      const near = (x, y) => { for (const [a, c] of segs) { const ex = c[0] - a[0], ey = c[1] - a[1], l2 = ex * ex + ey * ey || 1, t = Math.max(0, Math.min(1, ((x - a[0]) * ex + (y - a[1]) * ey) / l2)); if (Math.hypot(x - a[0] - ex * t, y - a[1] - ey * t) < 15) return true; } return false; };
      let pressed = 0, stuck = 0;
      for (let i = 0; i < 30 * 600 && !state.boats.every(bt => bt.raceState.finished); i++) {
        me.controller.update(1 / 30); const dd = normalizeAngle(me.controller.targetHeading - me.heading); state.keys.ArrowLeft = dd < -0.02; state.keys.ArrowRight = dd > 0.02;
        update(1 / 30);
        if (i % 3 === 0) for (const bt of state.boats) if (!bt.raceState.finished && near(bt.x, bt.y)) { pressed += 0.1; if (bt.speed * 4 < 1) stuck += 0.1; }
      }
      const ts = state.boats.filter(bt => bt.raceState.finished).map(bt => bt.raceState.finishTime).sort((a, c) => a - c);
      return { fin: ts.length, n: state.boats.length, first: +ts[0].toFixed(1), median: +ts[Math.floor(ts.length / 2)].toFixed(1), last: +ts[ts.length - 1].toFixed(1), pressed: +pressed.toFixed(1), stuck: +stuck.toFixed(1), segs: segs.length };
    }, seed);
    console.log(`seed ${seed}: ${r.fin}/${r.n} finished · first ${r.first}s median ${r.median}s last ${r.last}s · fleet at a swim line ${r.pressed}s (stuck ${r.stuck}s)`);
  }
  console.log(errs.length ? 'errors: ' + errs.slice(0, 3).join(' | ') : 'no page errors'); await b.close(); })();
