// Probe: replay Wes's recorded Flats races through checkFlatsRun (sim/course.js) and list the passages each one sailed.
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const b = await chromium.launch(); const p = await b.newPage();
 const errs = []; p.on('pageerror', e => errs.push(e.message));
 await p.goto('file://' + path.resolve('regatta/index.html'));
 await p.waitForFunction(() => window.state && typeof resetGame === 'function');
 const trajs = fs.readdirSync('regatta/eval/rl/traj').filter(f => /^traj_flats_/.test(f)).map(f => JSON.parse(fs.readFileSync('regatta/eval/rl/traj/' + f, 'utf8'))).map(j => ({ fin: j.finishTime, s: j.samples.map(q => [q[0], q[2], q[3]]) }));
 const r = await p.evaluate((trajs) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'flats', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
  selectVenue('flats'); resetGame(); startRace(); for (let i = 0; i < 30 * 12; i++) update(1 / 30);
  const feats = []; GameEvents.on('player-feat', e => feats.push(e.id));
  const me = state.boats[0]; const out = [];
  for (const T of trajs) { feats.length = 0; state.race.status = 'racing'; me.raceState.finished = false; checkFlatsRun(0); state.race.status = 'finished'; checkFlatsRun(0); state.race.status = 'racing';
   let last = T.s[0][0], flat = 0;
   for (const [t, x, y] of T.s) { me.x = x; me.y = y; state.race.timer = t; const dd = Math.max(0, t - last); if (Tide.groundAt(x, y) > _flatsZ() && t > 0) flat += dd; checkFlatsRun(dd); last = t; }
   out.push(Math.round(T.fin) + 's: flats ' + Math.round(flat) + 's  ' + feats.join(' ')); }
  return out; }, trajs);
 console.log(r.join('\n'), errs.length ? errs : ''); await b.close(); })();
