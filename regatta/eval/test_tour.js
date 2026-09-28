// THE GRAND TOUR — Cruz (win everywhere), Strut (2★), Breeze (3★), Muninn (4★) at every racing venue. Headless.
//   node regatta/eval/test_tour.js     (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('  FAIL ' + m); } else console.log('  ok   ' + m); };
(async () => { const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html')); await p.waitForFunction(() => window.state && typeof resetGame === 'function');
  const r = await p.evaluate(() => { const out = {}, A = Unlocks.ACHIEVEMENTS.filter(a => a.family === 'tour'); out.rows = A.map(a => a.char).join(',');
    const V = VENUE_ORDER.filter(v => v !== 'pond'); out.nVenues = V.length; out.hasPoint = V.includes('seatrials');
    const career = (starsFor) => ({ venues: Object.fromEntries(V.map((v, i) => [v, { stars: starsFor(v, i) }])) });
    const T = (ch, c) => A.find(a => a.char === ch).test({ finished: true }, c), P = (ch, c) => A.find(a => a.char === ch).progress(c).join('/');
    const all3 = career(() => 3), oneShort = career((v, i) => i === 5 ? 1 : 4);
    out.all3 = ['Cruz', 'Strut', 'Breeze', 'Muninn'].map(ch => T(ch, all3) ? 1 : 0).join('');
    out.short = ['Cruz', 'Strut', 'Breeze', 'Muninn'].map(ch => T(ch, oneShort) ? 1 : 0).join('');
    out.prog = P('Muninn', oneShort) + ' ' + P('Cruz', career(() => 0)) + ' ' + P('Strut', career((v, i) => i < 4 ? 2 : 1));
    out.pondIgnored = T('Cruz', { venues: Object.assign(career(() => 1).venues, { pond: { stars: 0 } }) });
    // the real counter keeps the BEST stars at a venue: 3 then 1 -> 3
    localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'lake', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
    selectVenue('lake'); resetGame(); startRace(); localStorage.removeItem('regatta_career');
    const me = state.boats[0], rf = Unlocks.raceFacts; let fake = 3; Unlocks.raceFacts = (o) => Object.assign(rf.call(Unlocks, o), { venue: 'lake', finished: true, stars: fake });
    me.raceState.finished = true; me.raceState.finishTime = 200; state.race.unlocks = { counted: false, feats: {}, vals: {} }; Unlocks._count([me], {});
    fake = 1; state.race.unlocks = { counted: false, feats: {}, vals: {} }; Unlocks._count([me], {}); Unlocks.raceFacts = rf;
    out.best = Unlocks.career().venues.lake.stars;
    return out; });
  ok(r.rows === 'Cruz,Strut,Breeze,Muninn', `the four rows (${r.rows})`);
  ok(r.nVenues === 13 && r.hasPoint, `every racing venue: ${r.nVenues}, Clubhouse Point included, not the Sailing School`);
  ok(r.all3 === '1110', `three stars everywhere earns Cruz, Strut and Breeze, not Muninn (${r.all3})`);
  ok(r.short === '1000', `one venue at a single star holds back the 2-, 3- and 4-star tours (${r.short})`);
  ok(r.prog === '12/13 0/13 4/13', `progress shows N of 13 (${r.prog})`);
  ok(r.pondIgnored, 'the Sailing School does not count');
  ok(r.best === 3, `a venue keeps its best stars, never goes down (${r.best})`);
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
  await b.close(); console.log(fails ? `\nFAIL — ${fails} failure(s)` : '\nPASS — 0 failure(s)'); process.exit(fails ? 1 : 0); })();
