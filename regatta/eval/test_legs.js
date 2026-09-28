// LEG & MARK CRAFT family — Flaunt, Vex, Needle, Saffron, Brine, Sovereign, Wick, Splash. Headless, real page.
//   node regatta/eval/test_legs.js     (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('  FAIL ' + m); } else console.log('  ok   ' + m); };
(async () => { const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html')); await p.waitForFunction(() => window.state && typeof resetGame === 'function');
  const r = await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'seatrials', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
    selectVenue('seatrials'); resetGame(); startRace(); const out = {}, A = Unlocks.ACHIEVEMENTS.filter(a => a.family === 'legs'); out.rows = A.map(a => a.char).join(',');
    const base = { finished: true, won: false, pos: 5, time: 200, legRanks: [], startRank: 0, fastestUp: false, fastestDown: false, feats: [], vals: {} }, T = (ch, o) => A.find(a => a.char === ch).test(Object.assign({}, base, o), {});
    out.flaunt = T('Flaunt', { won: true, pos: 1, legRanks: [1, 1, 1, 1] }) && !T('Flaunt', { won: true, pos: 1, legRanks: [1, 2, 1, 1] });
    out.vex = T('Vex', { won: true, pos: 1, legRanks: [1, 1, 3, 1] }) && !T('Vex', { won: true, pos: 1, legRanks: [3, 2, 1, 1] }) && !T('Vex', { legRanks: [4, 4, 3, 2] });
    out.needle = T('Needle', { startRank: 9, legRanks: [7, 5, 4, 2] }) && !T('Needle', { startRank: 9, legRanks: [7, 7, 4, 2] }) && !T('Needle', { startRank: 9, legRanks: [7, 5] });
    out.saffron = T('Saffron', { pos: 2, feats: ['mark:held'] }) && !T('Saffron', { pos: 2, feats: ['mark:held', 'mark:lost'] }) && !T('Saffron', { pos: 2 }) && !T('Saffron', { pos: 9, feats: ['mark:held'] });
    out.brine = T('Brine', { pos: 3 }) && !T('Brine', { pos: 4 }) && !T('Brine', { pos: 1, feats: ['pass:overtaken'] });
    out.sov = T('Sovereign', { pos: 2, fastestDown: true }) && !T('Sovereign', { pos: 4, fastestDown: true }) && !T('Sovereign', { pos: 1 });
    out.wick = T('Wick', { pos: 3, fastestUp: true }) && !T('Wick', { pos: 4, fastestUp: true }) && !T('Wick', { pos: 1, fastestDown: true });
    out.splash = T('Splash', { won: true, pos: 1, vals: { 'kite:secs': 101 } }) && !T('Splash', { won: true, pos: 1, vals: { 'kite:secs': 99 } }) && !T('Splash', { vals: { 'kite:secs': 150 } });
    // FASTEST LEGS: at the Point legs 1 and 3 are beats, 2 and 4 runs; give the player the fastest run, a bot the fastest beat
    const order = state.boats.slice(), me = order[0];
    order.forEach((bt, i) => { bt.raceState.legTimes = [60 + i, 40 + i, 61 + i, 41 + i]; });
    me.raceState.legTimes = [70, 38, 70, 45]; out.bests = JSON.stringify(Unlocks._legBests(order, me));
    me.raceState.legTimes = [58, 45, 70, 45]; out.bests2 = JSON.stringify(Unlocks._legBests(order, me));
    // THE EVENTS: rank changes, marks, the kite
    const feats = []; GameEvents.on('player-feat', e => { if (/^(mark|pass|kite):/.test(e.id)) feats.push(e.id); });
    for (let i = 0; i < 30 * 31; i++) update(1 / 30);
    state.race.status = 'racing'; me.raceState.finished = false; _legCraft = null;
    const setRank = (k, leg) => { leg = leg || 1; me.raceState.leg = leg; me.raceState.nextWaypoint.dist = 1000; order.slice(1).forEach((bt, i) => { bt.raceState.finished = false; bt.raceState.leg = leg; bt.raceState.nextWaypoint.dist = i < k - 1 ? 500 : 5000; }); };
    const run = (s) => { for (let i = 0; i < Math.round(s * 30); i++) checkLegCraft(1 / 30); };
    me.x = 0; me.y = -1500; setRank(1); run(1); setRank(2); run(1); setRank(1); run(1); out.flicker = feats.filter(f => f === 'pass:overtaken').length;
    setRank(2); run(2.5); out.passed = feats.filter(f => f === 'pass:overtaken').length;
    // a mark: approach the windward gate at rank 2, leave it at rank 3 -> lost; next one held
    feats.length = 0; _legCraft = null; setRank(2); run(0.1); const g = state.course.marks[2]; me.x = g.x + 50; me.y = g.y + 50; run(0.2);
    setRank(3, 2); me.x = g.x + 400; me.y = g.y + 400; run(0.2); out.lost = feats.includes('mark:lost');
    feats.length = 0; _legCraft = null; setRank(2); run(0.1); me.x = g.x + 50; me.y = g.y + 50; run(0.2); setRank(2, 2); me.x = g.x + 400; me.y = g.y + 400; run(0.2); out.held = feats.includes('mark:held') && !feats.includes('mark:lost');
    // the kite
    feats.length = 0; _legCraft = null; me.spinnaker = true; me.spinnakerDeployProgress = 1; run(3); out.kite = feats.filter(f => f === 'kite:secs').length;
    return out; });
  ok(r.rows === 'Flaunt,Vex,Needle,Saffron,Brine,Sovereign,Wick,Splash', `the eight rows (${r.rows})`);
  ok(r.flaunt && r.vex, 'Wire to Wire (first at every mark, won) and Daylight Robbery (behind at the last mark, won)');
  ok(r.needle, 'Threading: a place gained on every leg, 3+ legs (not a leg without a gain, not a 2-leg race)');
  ok(r.saffron && r.brine, 'Perfect Roundings and Never Passed read their events (Never Passed needs the top three)');
  ok(r.sov && r.wick && r.splash, 'Run Line, Beat Line (fastest leg, top three) and All Kite (kite up over half the race, won)');
  ok(r.bests === '{"fastestUp":false,"fastestDown":true}' && r.bests2 === '{"fastestUp":true,"fastestDown":false}', `fastest up/downwind legs by course direction (${r.bests} ${r.bests2})`);
  ok(r.flicker === 0 && r.passed === 1, `a place lost for 1 s is not a pass, for 2.5 s it is (${r.flicker}, ${r.passed})`);
  ok(r.lost && r.held, 'a place lost between approaching and leaving a mark is mark:lost; kept, mark:held');
  ok(r.kite >= 5, `kite time is counted (${r.kite} updates in 3 s)`);
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
  await b.close(); console.log(fails ? `\nFAIL — ${fails} failure(s)` : '\nPASS — 0 failure(s)'); process.exit(fails ? 1 : 0); })();
