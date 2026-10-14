// PT-033: real races with unlocks on and a fresh profile — every character earned, and its story line.
//   node eval/rl/_pt033_race.js venue...
const { chromium } = require('playwright'); const path = require('path');
const venues = process.argv.slice(2).length ? process.argv.slice(2) : ['lake', 'seatrials'];
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('index.html') + '?unlocks=on');
  await p.waitForFunction(() => window.state && window.Unlocks && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.removeItem('regatta_unlocks'); localStorage.removeItem('regatta_career'); });
  for (const v of venues) {
    const got = await p.evaluate((v) => { let s = 21;
      Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      localStorage.setItem('regatta_settings', JSON.stringify({ venue: v, soundEnabled: false, musicEnabled: false, bgSoundEnabled: false })); selectVenue(v); resetGame(); startRace();
      const before = Object.keys(Unlocks.store().earned);
      const me = state.boats[0]; me.controller = new BotController(me);
      for (let i = 0; i < 30 * 600 && !state.boats.every(bt => bt.raceState.finished); i++) { me.controller.update(1 / 30); const dd = normalizeAngle(me.controller.targetHeading - me.heading); state.keys.ArrowLeft = dd < -0.02; state.keys.ArrowRight = dd > 0.02; update(1 / 30); }
      const order = state.boats.slice().sort((a, c) => (a.raceState.finishTime || 1e9) - (c.raceState.finishTime || 1e9));
      Unlocks.poll(order); Unlocks.flush(order);
      const now = Object.keys(Unlocks.store().earned).filter(n => !before.includes(n));
      return { v, place: order.indexOf(me) + 1, feats: Object.keys((state.race.unlocks && state.race.unlocks.featAt) || {}).length, earned: now.map(n => n + ': ' + Unlocks.storyLine(n)) };
    }, v);
    console.log(`${got.v}: placed ${got.place}, ${got.feats} feats timed`); for (const e of got.earned) console.log('   ' + e);
  }
  const old = await p.evaluate(() => { const s = Unlocks.store(); s.earned.Zz = { at: Date.parse('2026-09-30'), venue: 'otter' }; Unlocks._write('regatta_unlocks', s); return Unlocks.storyLine('Zz'); });
  console.log('an unlock from before stories:', old);
  console.log(errs.length ? 'errors: ' + errs.slice(0, 3).join(' | ') : 'no page errors'); await b.close(); })();
