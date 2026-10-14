// PT-084: whole Otter races, the fleet on its own AI and the player on the bot: finishers, the
// winner's time, the median, the slowest, and seconds spent in kelp across the fleet.
//   ROOT=<checkout's regatta dir> node eval/rl/_pt084_race.js seed...
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
      localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'otter', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
      selectVenue('otter'); resetGame(); startRace();
      const me = state.boats[0]; me.controller = new BotController(me);
      let kelpS = 0; const perBed = {};
      for (let i = 0; i < 30 * 600 && !state.boats.every(b => b.raceState.finished || b.raceState.resultStatus); i++) {
        me.controller.update(1 / 30); const dd = normalizeAngle(me.controller.targetHeading - me.heading); state.keys.ArrowLeft = dd < -0.02; state.keys.ArrowRight = dd > 0.02;
        update(1 / 30);
        if (state.race.status === 'racing') for (const bt of state.boats) if (!bt.raceState.finished && VenueDoc.shoalField(state.course.islands, bt.x, bt.y) < 0.9 && (VenueDoc.shoalGrab ? VenueDoc.shoalGrab() : 1) > 0) { kelpS += 1 / 30;
          const bed = state.course.islands.find(s2 => s2.awash && /^kelp/.test(s2.id) && Math.hypot(s2.x - bt.x, s2.y - bt.y) < s2.radius); const k = bed ? bed.id : '?'; perBed[k] = (perBed[k] || 0) + 1 / 30; }
      }
      const ts = state.boats.filter(b => b.raceState.finished).map(b => b.raceState.finishTime).sort((a, b) => a - b);
      return { fin: ts.length, n: state.boats.length, first: ts[0] && +ts[0].toFixed(1), median: ts.length && +ts[Math.floor(ts.length / 2)].toFixed(1), last: ts.length && +ts[ts.length - 1].toFixed(1), kelpS: +kelpS.toFixed(1), perBed: Object.entries(perBed).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => k + ' ' + v.toFixed(0) + 's').join(', '), dnf: state.boats.filter(b => !b.raceState.finished).map(b => b.name + ':' + (b.raceState.resultStatus || '?')) };
    }, seed);
    console.log(`seed ${seed}: ${r.fin}/${r.n} finished · first ${r.first}s median ${r.median}s last ${r.last}s · fleet in grabbing kelp ${r.kelpS}s [${r.perBed}] ${r.dnf.length ? '· DNF ' + r.dnf.join(' ') : ''}`);
  }
  console.log(errs.length ? 'errors: ' + errs.slice(0, 3).join(' | ') : 'no page errors'); await b.close(); })();
