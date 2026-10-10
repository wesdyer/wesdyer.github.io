// PT-051 — STARTS WITH WES IN THE PACK. The fleet's worst starts happened in Wes's own races (Jester
// 148 s, Crush never, Splash 112 s), never so badly in bot-only benches: the human is the missing piece.
// This replays one of his recorded trajectories as the player — his boat placed every frame where he
// was at that race clock (prestart counted down, racing counted up) — and lets nine bots start around
// him, for several seeds. Reports each bot's crossing time after the gun, and the late ones' flags.
//   node _pt051_wesstart.js <traj.json> <trials> <seed0> [tree]
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const TRAJ = process.argv[2], TRIALS = +process.argv[3] || 6, SEED0 = +process.argv[4] || 9400;
const ROOT = process.argv[5] ? path.join(__dirname, process.argv[5]) : path.resolve(__dirname, '../../..');
(async () => {
  const d = JSON.parse(fs.readFileSync(TRAJ, 'utf8'));
  // the player's track on one clock: prestart as negative time, racing as positive (phase 0 / 1)
  const track = d.samples.map(s => [s[1] >= 1 ? s[0] : -s[0], s[2], s[3], s[4], s[5]]).sort((a, b) => a[0] - b[0]);
  const b = await chromium.launch(); const page = await b.newPage();
  await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
  await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
  await page.evaluate((v) => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), d.venue);
  const out = [];
  for (let i = 0; i < TRIALS; i++) out.push(await page.evaluate(({ seed, track }) => {
    window.evalHarness.seed = seed; window.resetGame(); window.startRace(); state.course.cutoff = 900;
    const P = state.boats.find(bt => bt.isPlayer);
    let k = 0;
    const place = () => {
      const t = state.race.status === 'prestart' ? -state.race.timer : state.race.timer;
      while (k < track.length - 2 && track[k + 1][0] <= t) k++;
      const a = track[k], c = track[Math.min(k + 1, track.length - 1)], f = c[0] > a[0] ? Math.max(0, Math.min(1, (t - a[0]) / (c[0] - a[0]))) : 0;
      P.x = a[1] + (c[1] - a[1]) * f; P.y = a[2] + (c[2] - a[2]) * f; P.heading = a[3]; P.speed = a[4] / 4 || P.speed;
      const v = P.speed * 60 / 60; P.velocity = { x: Math.sin(P.heading) * P.speed, y: -Math.cos(P.heading) * P.speed };
    };
    const rot = new Map();
    for (let it = 0; it < 60 * 200; it++) {
      place(); window.update(1 / 60);
      if (state.race.status === 'racing') for (const bt of state.boats) { if (bt === P || bt.raceState.leg >= 1) continue; const R = rot.get(bt) || { h: bt.heading, net: 0, max: 0 }; R.net += normalizeAngle(bt.heading - R.h); R.max = Math.max(R.max, Math.abs(R.net)); R.h = bt.heading; rot.set(bt, R); }
      if (state.race.status === 'racing' && (state.race.timer > 160 || state.boats.every(bt => bt === P || bt.raceState.leg >= 1))) break;
    }
    const pen = new Set(), ocs = new Set();
    return state.boats.filter(bt => bt !== P).map(bt => ({ name: bt.name, cross: bt.raceState.leg >= 1 ? +(bt.raceState.startTimeDisplay || 0).toFixed(1) : null, pens: bt.raceState.totalPenalties || 0, turns: rot.get(bt) ? +(rot.get(bt).max / (2 * Math.PI)).toFixed(1) : 0 }));
  }, { seed: SEED0 + i, track }));
  const C = out.flat(), ts = C.map(c => c.cross == null ? 999 : c.cross).sort((x, y) => x - y);
  console.log(`${path.basename(TRAJ)} (${d.venue}) with Wes's track, ${TRIALS} seeds: n ${C.length} med ${ts[Math.floor(ts.length / 2)]} p90 ${ts[Math.floor(ts.length * 0.9)]} max ${ts[ts.length - 1] === 999 ? '>160' : ts[ts.length - 1]} >30s ${C.filter(c => c.cross == null || c.cross > 30).length} >60s ${C.filter(c => c.cross == null || c.cross > 60).length} pens ${C.reduce((a, c) => a + c.pens, 0)}`);
  console.log(`   circling: ${C.filter(c => c.turns >= 2).length} bots >= 2 net turns, max ${Math.max(0, ...C.map(c => c.turns))}` + C.filter(c => c.turns >= 2).map(c => ` | ${c.name} ${c.turns}t crossed ${c.cross ?? '>160'}`).join(''));
  for (const c of C.filter(c => c.cross == null || c.cross > 30)) console.log(`   late: ${c.name} ${c.cross ?? '>160'} pens ${c.pens}`);
  await b.close(); })();
