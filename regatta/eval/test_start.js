// THE START LINE family — Crush (Gun Fighter), Clutch (Line Boss), Skip (Trigger Happy). Headless, real page.
//
//   node regatta/eval/test_start.js     (from the repo root)
//
// Checks the rows against race facts, the Line Boss streak through Unlocks._count, and that the two feats fire in
// a real race at Clubhouse Point: 'start:ocs' for the player over the line at the gun (not a bot, not behind the
// line), 'start:first' for the player first of the fleet across (not second).
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
        const out = {}, A = Unlocks.ACHIEVEMENTS.filter(a => a.family === 'start');
        out.rows = A.map(a => a.char).join(',');
        const base = { finished: true, won: false, feats: [], vals: {}, startDelay: null }, T = (ch, o, c) => A.find(a => a.char === ch).test(Object.assign({}, base, o), c || {});
        out.crush = T('Crush', { startDelay: 0.8 }) && T('Crush', { startDelay: 1.0 }) && !T('Crush', { startDelay: 1.1 }) && !T('Crush', { startDelay: null }) && !T('Crush', { startDelay: 0.5, finished: false });
        out.skip = T('Skip', { won: true, feats: ['start:ocs'] }) && !T('Skip', { won: false, feats: ['start:ocs'] }) && !T('Skip', { won: true });
        out.clutch = T('Clutch', {}, { startStreak: 3 }) && !T('Clutch', {}, { startStreak: 2 });
        out.prog = A.find(a => a.char === 'Clutch').progress({ startStreak: 2 }).join('/');
        // THE STREAK through the real counter: first, first, (not), first, first, first
        selectVenue('seatrials'); resetGame(); startRace();
        localStorage.removeItem('regatta_career'); const seq = [1, 1, 0, 1, 1, 1], st = [];
        for (const f of seq) { const me0 = state.boats[0]; state.race.unlocks = { counted: false, feats: f ? { 'start:first': true } : {}, vals: {} };
            me0.raceState.finished = true; me0.raceState.finishTime = 200; me0.raceState.resultStatus = null;
            Unlocks._count(state.boats, {}); st.push(Unlocks.career().startStreak); }
        out.streakShape = st.join(',');
        // THE FEATS in a real race
        selectVenue('seatrials'); resetGame(); startRace();
        const feats = []; GameEvents.on('player-feat', (e) => { if (/^start:/.test(e.id)) feats.push(e.id); });
        let me = state.boats[0], bots = state.boats.slice(1);
        // (a) over the line at the gun: the player is flagged, a bot over the line is not the player's feat
        const [m0, m1] = startLinePts(), mx = (m0.x + m1.x) / 2, my = (m0.y + m1.y) / 2, ss = startCrossSign();
        const nx = ss * (m1.y - m0.y) / Math.hypot(m1.x - m0.x, m1.y - m0.y), ny = -ss * (m1.x - m0.x) / Math.hypot(m1.x - m0.x, m1.y - m0.y);   // toward the course side
        const put = (bt, d) => { bt.x = mx + nx * d; bt.y = my + ny * d; bt.speed = 0; };
        while (state.race.status === 'prestart') { put(me, 60); put(bots[0], 60); for (let k = 1; k < bots.length; k++) put(bots[k], -300 - k * 40); update(1 / 30); }
        out.ocsFeat = feats.filter(f => f === 'start:ocs').length;
        // (b) a clean second race: player well behind at the gun, then first across; everyone else held back
        selectVenue('seatrials'); resetGame(); startRace(); feats.length = 0; me = state.boats[0]; bots = state.boats.slice(1);
        while (state.race.status === 'prestart') { put(me, -30); for (let k = 0; k < bots.length; k++) put(state.boats[k + 1], -600 - k * 40); update(1 / 30); }
        for (let i = 0; i < 30 * 3 && !feats.includes('start:first'); i++) { put(me, -30 + i * 3); for (let k = 0; k < bots.length; k++) put(state.boats[k + 1], -600 - k * 40); update(1 / 30); }
        out.firstFeat = feats.filter(f => f === 'start:first').length; out.delay = state.boats[0].raceState.startLegDuration;
        // (c) a third race: a bot crosses first, then the player — no 'start:first'
        selectVenue('seatrials'); resetGame(); startRace(); feats.length = 0; me = state.boats[0]; bots = state.boats.slice(1);
        while (state.race.status === 'prestart') { put(me, -90); put(state.boats[1], -45); for (let k = 2; k < state.boats.length; k++) put(state.boats[k], -600 - k * 40); update(1 / 30); }
        for (let i = 0; i < 30 * 2; i++) { put(state.boats[1], -45 + i * 6); put(me, -90 + Math.max(0, i - 20) * 6); for (let k = 2; k < state.boats.length; k++) put(state.boats[k], -600 - k * 40); update(1 / 30); }
        out.second = feats.filter(f => f === 'start:first').length; out.meStarted = state.boats[0].raceState.leg > 0;
        return out;
    });
    ok(r.rows === 'Crush,Clutch,Skip', `the three start-line rows (${r.rows})`);
    ok(r.crush, 'Gun Fighter: across within 1.0 s of the gun and finished (not 1.1 s, not never, not a DNF)');
    ok(r.skip, 'Trigger Happy: over early at the gun and still won (not a loss, not without the OCS)');
    ok(r.clutch && r.prog === '2/3', `Line Boss: three starts in a row, with progress (${r.prog})`);
    ok(r.streakShape === '1,2,0,1,2,3', `the streak resets on a start that was not first (${r.streakShape})`);
    ok(r.ocsFeat === 1, `over the line at the gun: one 'start:ocs' for the player, none for the bot beside it (${r.ocsFeat})`);
    ok(r.firstFeat === 1, `first of the fleet across: 'start:first' (${r.firstFeat}, crossed ${r.delay != null ? r.delay.toFixed(2) : '-'} s after the gun)`);
    ok(r.meStarted && r.second === 0, `second across: no 'start:first' (${r.second})`);
    ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
    await b.close();
    console.log(fails ? `\nFAIL — ${fails} failure(s)` : '\nPASS — 0 failure(s)');
    process.exit(fails ? 1 : 0);
})();
