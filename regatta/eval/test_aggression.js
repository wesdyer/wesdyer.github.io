// LEGAL AGGRESSION — Frenzy (Feeding Frenzy), Spike (Makes His Own Right of Way), Corsair (Air Thief). Headless, real page.
//
//   node regatta/eval/test_aggression.js     (from the repo root)
//
// Checks the rows against race facts (every one void on a penalty), then drives sim/course.js checkAggression directly
// on a live race with the boats placed by hand: a pass held 4 s counts, a re-pass inside 10 s does not, being passed
// does not; a rival's give-way counts once per rival; a rival in the player's bad air for 30 s (a gap under 1 s
// forgiven) is 'air:<name>', one beside the cone is not; nothing before the player starts.
const { chromium } = require('playwright');
const path = require('path');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  FAIL ' + m); } else console.log('  ok   ' + m); };
(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForFunction(() => window.state && typeof resetGame === 'function');
    const r = await p.evaluate(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'seatrials', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
        const out = {}, A = Unlocks.ACHIEVEMENTS.filter(a => a.family === 'aggression');
        out.rows = A.map(a => a.char).join(',');
        const base = { finished: true, won: false, penalties: 0, feats: [], vals: {}, behind: [] }, T = (ch, o) => A.find(a => a.char === ch).test(Object.assign({}, base, o), {});
        out.frenzy = T('Frenzy', { vals: { 'pass:n': 15 } }) && !T('Frenzy', { vals: { 'pass:n': 14 } }) && !T('Frenzy', { vals: { 'pass:n': 20 }, penalties: 1 }) && !T('Frenzy', { vals: { 'pass:n': 20 }, finished: false });
        out.spike = T('Spike', { vals: { 'give:n': 5 } }) && !T('Spike', { vals: { 'give:n': 4 } }) && !T('Spike', { vals: { 'give:n': 6 }, penalties: 1 });
        out.razor = T('Razor', { vals: { 'pass:ambush': 'A|B|C' }, behind: ['A', 'B', 'C', 'D'] }) && !T('Razor', { vals: { 'pass:ambush': 'A|B|C' }, behind: ['A', 'B'] }) && T('Razor', { vals: { 'pass:ambush': 'X|Y|Z;A|B|C' }, behind: ['A', 'B', 'C'] }) && !T('Razor', {});
        out.corsair = T('Corsair', { feats: ['air:Bixby'], behind: ['Bixby'] }) && !T('Corsair', { feats: ['air:Bixby'], behind: ['Bruce'] }) && !T('Corsair', { feats: ['air:Bixby'], behind: ['Bixby'], penalties: 1 });
        out.arctic = Unlocks.ACHIEVEMENTS.filter(a => a.char === 'Spike').length === 1 && Unlocks.ACHIEVEMENTS.some(a => a.char === 'Chime' && a.venue === 'arctic');
        // THE LIVE CHECK, stepped by hand (no update(): the bots' own controllers would overwrite the give-way fields)
        selectVenue('seatrials'); resetGame(); startRace();
        const feats = []; GameEvents.on('player-feat', (e) => { if (/^(pass|give|air):/.test(e.id)) feats.push(e.value === undefined ? e.id : e.id + '=' + e.value); });
        const me = state.boats[0], bots = state.boats.slice(1), dt = 1 / 30, run = (s, f) => { for (let i = 0; i < Math.round(s * 30); i++) { if (f) f(i); checkAggression(dt); } };
        // before the start: nothing
        state.race.status = 'racing'; me.raceState.leg = 0; for (const o of bots) o.raceState.leg = 1; run(3);
        out.preStart = feats.length;
        // everyone on leg 1; bots[0] 100 u nearer the mark than the player, the rest far behind
        me.raceState.leg = 1; me.raceState.nextWaypoint.dist = 2000; for (const o of state.boats) { o.x = 0; o.y = 0; o.controller && (o.controller.threatBoat = null); }
        bots.forEach((o, k) => { o.raceState.nextWaypoint.dist = k === 0 ? 1900 : 5000 + k; o.x = 5000 + k * 300; });
        run(1);
        me.raceState.nextWaypoint.dist = 1800; run(1); const blip = feats.filter(f => /^pass/.test(f)).length;   // 1 s ahead: not yet
        run(3.5); out.pass1 = feats.filter(f => /^pass/.test(f)).join(' '); out.blip = blip;
        me.raceState.nextWaypoint.dist = 1950; run(4.5); me.raceState.nextWaypoint.dist = 1850; run(4.5);   // passed back, re-passed within 10 s
        out.repass = feats.filter(f => /^pass/.test(f)).length;
        me.raceState.nextWaypoint.dist = 1950; run(4.5); me.raceState.nextWaypoint.dist = 1850; run(4.5);   // and again, 18 s after the last counted
        out.pass2 = feats.filter(f => /^pass/.test(f)).join(' ');
        // GIVE WAY: bots[1] yields (GIVE_WAY vs the player, HIGH, 0.5 rad off) for 1 s; then again; then bots[2]
        bots.forEach(o => { if (!o.controller) o.controller = {}; });   // a fresh race has not built them yet
        const yieldIt = (o, s) => run(s, () => Object.assign(o.controller, { threatBoat: me, avoidanceRole: 'GIVE_WAY', riskState: 'HIGH', lastAvoidDeviation: 0.5 }));
        const calm = (o) => Object.assign(o.controller, { threatBoat: null, riskState: 'LOW', lastAvoidDeviation: 0 });
        yieldIt(bots[1], 0.5); calm(bots[1]); run(1); out.giveShort = feats.filter(f => /^give/.test(f)).length;
        yieldIt(bots[1], 1); calm(bots[1]); yieldIt(bots[1], 1); calm(bots[1]); yieldIt(bots[2], 1); calm(bots[2]);
        out.give = feats.filter(f => /^give/.test(f)).join(' ');
        // DIRTY AIR: bots[3] 150 u dead downwind of the player (the cone), bots[4] 150 u downwind and 120 u across (outside it)
        const place = (o, down, across) => { const w = getWindAt(me.x, me.y), wx = -Math.sin(w.direction), wy = Math.cos(w.direction); o.x = me.x + wx * down - wy * across; o.y = me.y + wy * down + wx * across; };
        me.x = 20000; me.y = 20000;
        run(20, () => { place(bots[3], 150, 0); place(bots[4], 150, 120); }); out.air20 = feats.filter(f => /^air/.test(f)).length;
        run(0.6, () => { place(bots[3], 150, 400); place(bots[4], 150, 120); });   // a 0.6 s gap — forgiven
        run(10.5, () => { place(bots[3], 150, 0); place(bots[4], 150, 120); });
        out.air = feats.filter(f => /^air/.test(f)).join(' '); out.airName = bots[3].name;
        return out;
    });
    ok(r.rows === 'Frenzy,Razor,Spike,Corsair', `the four Legal Aggression rows (${r.rows})`);
    ok(r.arctic, 'Spike has one row (aggression); Chime holds Glacier Sound\'s Calving Face');
    ok(r.frenzy, 'Feeding Frenzy: 15 passes, not 14, void on a penalty or a DNF');
    ok(r.spike, 'Makes His Own Right of Way: 5 give-ways, not 4, void on a penalty');
    ok(r.razor, 'Ambush: a burst of three passes, all three finishing behind you');
    ok(r.corsair, 'Air Thief: the air-thieved rival must finish behind; void on a penalty');
    ok(r.preStart === 0, `nothing before the player starts (${r.preStart})`);
    ok(r.blip === 0 && r.pass1 === 'pass:n=1', `a pass counts once held 4 s, not after 1 s (${r.pass1})`);
    ok(r.repass === 1, `passed back and re-passed inside 10 s: still one (${r.repass})`);
    ok(r.pass2 === 'pass:n=1 pass:n=2', `re-passed 18 s after the last counted: two (${r.pass2})`);
    ok(r.giveShort === 0, `a half-second flinch is not giving way (${r.giveShort})`);
    ok(r.give === 'give:n=1 give:n=2', `give-ways count different rivals: the same boat twice is one (${r.give})`);
    ok(r.air20 === 0 && r.air === 'air:' + r.airName, `30 s in the player's bad air, a 0.6 s gap forgiven, the boat beside the cone not (${r.air})`);
    ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
    await b.close();
    console.log(fails ? `\nFAIL — ${fails} failure(s)` : '\nPASS — 0 failure(s)');
    process.exit(fails ? 1 : 0);
})();
