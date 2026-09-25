// STILLWATER LAKE — its wildlife and the feats its objectives read (js/wildlife.js,
// checkGlassPass in js/sim/course.js). Headless, on the real page.
//
//   node regatta/eval/test_lake.js     (from the repo root, like every suite)
const { chromium } = require('playwright');
const path = require('path');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  FAIL ' + m); } else console.log('  ok   ' + m); };

(async () => {
    const b = await chromium.launch();
    const p = await b.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
    const r = await p.evaluate(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'lake', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
        resetGame();
        const out = {}, feats = [];
        GameEvents.on('player-feat', (e) => feats.push(e.id));
        const d = Wildlife.debug();
        const moose = d.waders[0];
        const bed = state.course.islands.find(s => s.id === 'shape-39');
        out.mooseInBed = !!moose && pointInPoly(moose.cx, moose.cy, bed.vertices);
        out.groups = d.divers.map(G => G.cfg.kind + ':' + G.birds.length).join(',');
        out.allOnWater = d.divers.every(G => G.birds.every(g => !pointOnLand(g.x, g.y)));

        const real = Math.random; let calls = 0; Math.random = () => { calls++; return real(); };
        for (let i = 0; i < 900; i++) Wildlife.update(1 / 30);
        Math.random = real;
        out.randomCalls = calls;
        out.stillOnWater = d.divers.every(G => G.birds.every(g => g.mode !== 'swim' || !pointOnLand(g.x, g.y)));
        // Bass jump near the player now and then — always in open water, never on a boat.
        const seen = new Set(); const pl = state.boats.find(b => b.isPlayer);
        for (let i = 0; i < 1800; i++) { Wildlife.update(1 / 30); for (const L of Wildlife.debug().leaps) seen.add(L); }
        out.leaps = seen.size;
        out.leapsOnWater = [...seen].every(L => !pointOnLand(L.x, L.y));
        out.leapsNear = [...seen].every(L => Math.hypot(L.x - pl.x, L.y - pl.y) < 700);

        // A boat near a swimming loon puts it down.
        const me = state.boats[0], mate = state.boats[1];
        const loons = d.divers.find(G => G.cfg.kind === 'loon');
        const loon = loons.birds.find(g => g.mode === 'swim') || loons.birds[0];
        loon.mode = 'swim'; loon.t = 30;
        mate.x = loon.x + 60; mate.y = loon.y;
        Wildlife.update(1 / 30);
        out.loonDived = loon.mode === 'dive';
        mate.x = 1e5; mate.y = 1e5;

        // The moose: a classmate startles it and earns nothing; the player, racing, earns it.
        state.race.status = 'racing';
        mate.x = moose.cx + 80; mate.y = moose.cy;
        for (let i = 0; i < 10; i++) Wildlife.update(1 / 30);
        out.mooseUp = moose.mode !== 'graze';
        out.featAfterMate = feats.includes('lake:moose');
        mate.x = 1e5; mate.y = 1e5;
        me.x = moose.cx + 80; me.y = moose.cy;
        for (let i = 0; i < 5; i++) Wildlife.update(1 / 30);
        out.featPlayer = feats.includes('lake:moose');

        // Through the glass: inside the calm with mark 3 rounded during the pass.
        const poly = VenueDoc.get('lake').wind.regions.find(q => q.id === 'wind-shore-bay').poly.map(q => ({ x: q[0], y: q[1] }));
        let cx = 0, cy = 0; for (const q of poly) { cx += q.x; cy += q.y; } cx /= poly.length; cy /= poly.length;
        const pass = (kn, rounds) => {
            const before = feats.filter(f => f === 'lake:glass').length;
            const rs = me.raceState;
            me.x = 5000; me.y = 5000; rs.leg = 1; checkGlassPass();            // outside
            me.x = cx; me.y = cy; me.speed = kn * 0.25; checkGlassPass();      // in
            if (rounds) rs.leg = 2;
            checkGlassPass();
            me.x = 5000; me.y = 5000; checkGlassPass();                        // out
            return feats.filter(f => f === 'lake:glass').length > before;
        };
        out.glassFast = pass(4.8, true);
        out.glassSlow = pass(3.9, true);
        out.glassNoRound = pass(5.5, false);
        return out;
    });
    ok(r.mooseInBed, 'the moose stands in lily bed shape-39');
    ok(r.groups === 'loon:2,beaver:2', `two loons and two beavers (${r.groups})`);
    ok(r.allOnWater && r.stillOnWater, 'the swimmers start and stay on open water');
    ok(r.randomCalls === 0, `wildlife never calls Math.random (${r.randomCalls})`);
    ok(r.leaps >= 4, `bass jump every few seconds (${r.leaps} in a minute)`);
    ok(r.leapsOnWater && r.leapsNear, 'every jump is on open water, within sight of the player');
    ok(r.loonDived, 'a loon dives when a boat comes close');
    ok(r.mooseUp && !r.featAfterMate, 'a classmate startles the moose, and earns nothing');
    ok(r.featPlayer, 'the player racing past the lily bed earns lake:moose');
    ok(r.glassFast, 'rounding mark 3 at 4.8 kn through the calm earns lake:glass');
    ok(!r.glassSlow, 'dropping to 3.9 kn does not');
    ok(!r.glassNoRound, 'a fast pass without the rounding does not');
    ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
    await b.close();
    console.log(fails ? `\nFAIL — ${fails} failure(s)` : '\nPASS — 0 failure(s)');
    process.exit(fails ? 1 : 0);
})();
