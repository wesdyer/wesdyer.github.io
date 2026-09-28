// CLEAN & DIRTY family — Grotto (Shake It Off), Bramble (Untouchable). Headless, real page.
//   node regatta/eval/test_clean.js     (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('  FAIL ' + m); } else console.log('  ok   ' + m); };
(async () => { const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html')); await p.waitForFunction(() => window.state && typeof resetGame === 'function');
  const r = await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'seatrials', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false, penaltiesEnabled: true }));
    selectVenue('seatrials'); resetGame(); startRace(); const out = {}, A = Unlocks.ACHIEVEMENTS.filter(a => a.family === 'clean'); out.rows = A.map(a => a.char).join(',');
    const base = { finished: true, won: false, rulesOn: true, penalties: 0, served: 0, rivalsPenalized: 0, feats: [], vals: {} }, T = (ch, o) => A.find(a => a.char === ch).test(Object.assign({}, base, o), {});
    out.grotto = T('Grotto', { won: true, served: 1 }) && !T('Grotto', { won: false, served: 1 }) && !T('Grotto', { won: true, served: 0 });
    out.bramble = T('Bramble', { rivalsPenalized: 5 }) && !T('Bramble', { rivalsPenalized: 4 }) && !T('Bramble', { rivalsPenalized: 6, penalties: 1 }) && !T('Bramble', { rivalsPenalized: 6, rulesOn: false }) && !T('Bramble', { rivalsPenalized: 6, finished: false });
    // the fact from a real finish order: five rivals with a penalty on the book
    const order = state.boats.slice(); order.slice(1, 6).forEach(x => { x.raceState.totalPenalties = 1; }); order[0].raceState.finished = true; order[0].raceState.finishTime = 190;
    out.count = Unlocks.raceFacts(order).rivalsPenalized; order[0].raceState.totalPenalties = 2; out.countMe = Unlocks.raceFacts(order).rivalsPenalized;
    return out; });
  ok(r.rows === 'Grotto,Bramble', `the two rows (${r.rows})`);
  ok(r.grotto, 'Shake It Off: a win with a penalty turn served (not a loss, not without one)');
  ok(r.bramble, 'Untouchable: clean, rules on, 5+ rivals penalized (not 4, not with your own, not rules off, not a DNF)');
  ok(r.count === 5 && r.countMe === 5, `rivals penalized is counted from the finish order, not counting you (${r.count}, ${r.countMe})`);
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
  await b.close(); console.log(fails ? `\nFAIL — ${fails} failure(s)` : '\nPASS — 0 failure(s)'); process.exit(fails ? 1 : 0); })();
