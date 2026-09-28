// THE ODOMETER PAIR — Dart (Beeline: shortest), Meridian (Longest Migration: longest). Headless, real page.
//   node regatta/eval/test_odometer.js     (from the repo root)
// The winner finishes first, so the answer is often not known yet: _odometer says null until it is.
const { chromium } = require('playwright'); const path = require('path');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('  FAIL ' + m); } else console.log('  ok   ' + m); };
(async () => { const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html')); await p.waitForFunction(() => window.state && typeof resetGame === 'function');
  const r = await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'seatrials', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
    selectVenue('seatrials'); resetGame(); startRace(); state.race.status = 'racing';
    const out = {}, A = Unlocks.ACHIEVEMENTS.filter(a => a.family === 'odometer'); out.rows = A.map(a => a.char).join(',');
    const order = state.boats.slice(0, 4), me = order[0]; state.boats = order;
    const set = (b, d, fin) => { b.raceState.legDistances = [d]; b.raceState.finished = fin; b.raceState.resultStatus = null; };
    const O = () => { const q = Unlocks._odometer(order, me); return [q.distShortest, q.distLongest].map(v => v === null ? 'n' : v ? 'T' : 'F').join(''); };
    set(me, 5000, true); set(order[1], 5200, false); set(order[2], 4000, false); set(order[3], 6000, false); out.early = O();    // one still short of mine, one already longer
    set(order[2], 5100, false); out.mid = O();                                                                                     // everyone out there has sailed more
    set(order[1], 5200, true); set(order[2], 5100, true); set(order[3], 6000, true); out.done = O();                                // all in: shortest, not longest
    set(me, 7000, true); out.longest = O();
    set(me, 5000, true); set(order[1], 4800, false); set(order[2], 4900, false); set(order[3], 4950, false); out.undecided = O(); state.race.status = 'finished'; out.over = O();
    const T = (ch, o) => A.find(a => a.char === ch).test(Object.assign({ finished: true, won: true }, o), {});
    out.rowsRead = [T('Dart', { distShortest: true }), T('Dart', { distShortest: null }), T('Dart', { won: false, distShortest: true }), T('Meridian', { distLongest: true }), T('Meridian', { distLongest: false })].map(String).join(',');
    return out; });
  ok(r.rows === 'Dart,Meridian', `the two rows (${r.rows})`);
  ok(r.early === 'nF', `a boat still sailing with less behind it: shortest undecided; one already further: not longest (${r.early})`);
  ok(r.mid === 'TF', `every boat still out there already sailed more: shortest is decided (${r.mid})`);
  ok(r.done === 'TF' && r.longest === 'FT', `all finished: decided either way (${r.done}, ${r.longest})`);
  ok(r.undecided === 'nn' && r.over === 'TT', `boats still sailing with less: both undecided — once the race is over, those boats don't count (${r.undecided}, ${r.over})`);
  ok(r.rowsRead === 'true,null,false,true,false', `rows: won and shortest/longest, null while undecided, a loss never (${r.rowsRead})`);
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
  await b.close(); console.log(fails ? `\nFAIL — ${fails} failure(s)` : '\nPASS — 0 failure(s)'); process.exit(fails ? 1 : 0); })();
