// BOAT HANDLING & CONDITIONS — Frond, Bulkhead, Chroma, Crimson, Viper, Spin, Grip, Wink, Dab. Headless, real page.
//   node regatta/eval/test_handling.js     (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('  FAIL ' + m); } else console.log('  ok   ' + m); };
(async () => { const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html')); await p.waitForFunction(() => window.state && typeof resetGame === 'function');
  const r = await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'seatrials', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
    selectVenue('seatrials'); resetGame(); startRace(); const out = {}, A = Unlocks.ACHIEVEMENTS.filter(a => a.family === 'handling'); out.rows = A.map(a => a.char).join(',');
    const base = { finished: true, won: true, pos: 1, penalties: 0, behind: [], marginAhead: 0, feats: [], vals: {} }, T = (ch, o, c) => A.find(a => a.char === ch).test(Object.assign({}, base, o), c || {});
    out.wind = [T('Frond', { vals: { 'wind:avg': 6.9 } }), T('Frond', { vals: { 'wind:avg': 7.1 } }), T('Bulkhead', { vals: { 'wind:avg': 18 } }), T('Bulkhead', { vals: { 'wind:avg': 17.9 } }), T('Frond', { won: false, vals: { 'wind:avg': 5 } })].map(Number).join('');
    out.chroma = T('Chroma', {}, { windBands: ['light', 'medium', 'heavy'] }) && !T('Chroma', {}, { windBands: ['light', 'heavy'] });
    out.crimson = [T('Crimson', { marginAhead: 31 }), T('Crimson', { marginAhead: 29 }), T('Crimson', { marginAhead: null }), T('Crimson', { won: false, marginAhead: 40 })].map(String).join(',');
    out.tacks = T('Viper', { vals: { 'tack:n': 12 } }) && !T('Viper', { vals: { 'tack:n': 11 } }) && T('Spin', { vals: { 'gybe:n': 12 } }) && !T('Spin', { vals: { 'tack:n': 20 } });
    out.grip = T('Grip', { feats: ['grip:Stripes'], behind: ['Stripes'] }) && !T('Grip', { feats: ['grip:Stripes'], behind: ['Oar'] }) && !T('Grip', { feats: ['grip:Stripes'], behind: ['Stripes'], penalties: 1 });
    out.kite = T('Wink', {}) && !T('Wink', { feats: ['kite:hoisted'] }) && T('Dab', { feats: ['calm:30'] }) && !T('Dab', {});
    // THE EVENTS in a real race at the Point (a northerly: wind from 0)
    const feats = [], vals = {}; GameEvents.on('player-feat', e => { feats.push(e.id); if (e.value !== undefined) vals[e.id] = e.value; });
    for (let i = 0; i < 30 * 31; i++) update(1 / 30);
    const me = state.boats[0]; state.race.status = 'racing'; me.raceState.finished = false; _handling = null; me.speed = 2;
    const hold = (h, s) => { me.heading = h; for (let i = 0; i < Math.round(s * 30); i++) checkHandling(1 / 30); };
    hold(0.8, 2); hold(-0.8, 2); hold(0.8, 2); hold(-0.8, 0.5); hold(0.8, 2);   // two tacks; a flick back and forth for 0.5 s is not one
    out.tackN = vals['tack:n'] || 0;
    hold(2.6, 2); hold(-2.6, 2); out.gybeN = vals['gybe:n'] || 0;          // 0.8 -> 2.6 bears away (no crossing); 2.6 -> -2.6 is a gybe
    out.windAvg = vals['wind:avg'];
    // becalmed, the kite
    feats.length = 0; me.speed = 0.2; hold(0.8, 31); out.calm = feats.includes('calm:30'); me.speed = 2;
    me.spinnaker = true; hold(0.8, 0.1); out.hoisted = feats.includes('kite:hoisted'); me.spinnaker = false;
    // grip: a rival 80 u dead astern for 61 s; another alongside does not count
    feats.length = 0; _handling = null; me.x = 0; me.y = -2000; me.heading = 0; const o1 = state.boats[1], o2 = state.boats[2];
    o1.raceState.finished = false; o2.raceState.finished = false; for (const x of state.boats.slice(3)) { x.x = 1e5; x.y = 1e5; }
    o1.x = 0; o1.y = -2000 + 80; o2.x = 70; o2.y = -2000;
    for (let i = 0; i < 30 * 61; i++) checkHandling(1 / 30);
    out.gripEv = feats.filter(f => f.startsWith('grip:')).join(',').replace(o1.name, 'O1').replace(o2.name, 'O2');
    // the margin: won, second still sailing, the clock 10 s past -> null; 40 s past -> >= 30
    const order = state.boats.slice(); order[0].raceState.finished = true; order[0].raceState.finishTime = 100; order.slice(1).forEach(x => { x.raceState.finished = false; x.raceState.resultStatus = null; });
    state.race.timer = 110; out.m1 = Unlocks._margin(order, order[0]); state.race.timer = 140; out.m2 = Unlocks._margin(order, order[0]);
    order[1].raceState.finished = true; order[1].raceState.finishTime = 112; out.m3 = Unlocks._margin(order, order[0]);
    return out; });
  ok(r.rows === 'Frond,Bulkhead,Chroma,Crimson,Viper,Spin,Grip,Wink,Dab', `the nine rows (${r.rows})`);
  ok(r.wind === '10100', `Whisper Wind at 7 kn or less, Storm Wall at 18 or more, wins only (${r.wind})`);
  ok(r.chroma, 'Every Colour: all three wind bands won');
  ok(r.crimson === 'true,false,null,false', `Surgical: 30 s or more, undecided while it can't be known (${r.crimson})`);
  ok(r.tacks && r.grip && r.kite, 'Tacking Duel, Corkscrew, Never Let Go, One Sail Forever, Sunbather read their facts');
  ok(r.tackN === 2 && r.gybeN === 1, `tacks and gybes counted, a 0.5 s flick ignored (${r.tackN} tacks, ${r.gybeN} gybe)`);
  ok(r.windAvg > 5, `the average wind is sampled (${r.windAvg} kn)`);
  ok(r.calm && r.hoisted, 'becalmed for 30 s and the kite hoisted are noted');
  ok(r.gripEv === 'grip:O1', `a rival held 80 u astern for a minute counts; one alongside does not (${r.gripEv})`);
  ok(r.m1 === null && r.m2 >= 30 && Math.abs(r.m3 - 12) < 0.01, `the winning margin waits, then decides (${r.m1}, ${r.m2}, ${r.m3})`);
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
  await b.close(); console.log(fails ? `\nFAIL — ${fails} failure(s)` : '\nPASS — 0 failure(s)'); process.exit(fails ? 1 : 0); })();
