// LIGHTHOUSE COVE — its wildlife and the feats its objectives read (js/wildlife.js,
// checkBowCrossing in js/sim/course.js). Headless, on the real page.
//
//   node regatta/eval/test_cove.js     (from the repo root, like every suite)
//
// Checks: the gull colony sits on shape-36 and clear of the props planted there; any boat
// puts it up but only the player earns 'bay:gulls', and only while racing; a bait boil with
// the pelicans feeding pays 'bay:bait-boil'; crossing a cargo ship's bow inside 3 boat
// lengths pays 'bay:bow-cross' and crossing 5 lengths ahead does not; and none of it draws
// from Math.random (the seeded sim stream).
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

    const r = await p.evaluate(async () => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'bay', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
        resetGame();
        const out = {};
        const feats = [];
        GameEvents.on('player-feat', (e) => feats.push(e.id));

        // ── the colony ──
        const col = Wildlife.debug().colonies[0];
        const rock = state.course.islands.find(s => s.id === 'shape-36');
        out.colonyCount = col ? col.birds.length : 0;
        out.allOnRock = !!col && col.birds.every(g => pointInPoly(g.hx, g.hy, rock.vertices));
        const kinds = VenueDoc.PROP_KINDS;
        out.clearOfProps = !!col && col.birds.every(g => state.course.props.every(pr =>
            Math.hypot(pr.x - g.hx, pr.y - g.hy) >= ((kinds[pr.kind] && kinds[pr.kind].world) || 40) * (pr.scale || 1) / 2));

        // Math.random must not be touched by wildlife.
        const real = Math.random; let calls = 0; Math.random = () => { calls++; return real(); };
        for (let i = 0; i < 300; i++) Wildlife.update(1 / 30);
        Math.random = real;
        out.randomCalls = calls;

        const me = state.boats[0], bot = state.boats[1];
        // ── harbour seals: heads up to look about, a gliding shape under the water between ──
        const seals = Wildlife.debug().poppers;
        out.seals = seals.length;
        out.sealsOnWater = seals.every(s => !pointOnLand(s.x, s.y));
        const parked = state.boats.map(b => [b.x, b.y]); for (const b of state.boats) { b.x = 1e5; b.y = 1e5; }   // the fleet sits by the start seals
        { const s = seals[0]; s.mode = 'up'; s.t = 20; s.vis = 1; s.h = 0;
          bot.x = s.x + 200; bot.y = s.y; for (let i = 0; i < 60; i++) Wildlife.update(1 / 30);
          out.sealLooks = Math.abs(normalizeAngle(s.h - Math.PI / 2)) < 0.3;          // facing the boat, due east
          bot.x = s.x + 40; Wildlife.update(1 / 30); out.sealDives = s.mode === 'sink';
          bot.x = 1e5; bot.y = 1e5;
          let up = false; for (let i = 0; i < 30 * 30 && !up; i++) { Wildlife.update(1 / 30); up = s.mode === 'up'; }
          out.sealResurfaces = up; }
        state.boats.forEach((b, i) => { b.x = parked[i][0]; b.y = parked[i][1]; });
        const g0 = col.birds[0];
        // A bot puts them up: no feat.
        state.race.status = 'racing';
        bot.x = g0.hx + 40; bot.y = g0.hy + 40;
        for (let i = 0; i < 10; i++) Wildlife.update(1 / 30);
        out.botFlushed = col.birds.some(g => g.mode !== 'perched');
        out.featAfterBot = feats.includes('bay:gulls');
        bot.x = 1e5; bot.y = 1e5;
        // The player, but not racing: no feat.
        state.race.status = 'prestart';
        me.x = g0.hx + 40; me.y = g0.hy + 40;
        for (let i = 0; i < 5; i++) Wildlife.update(1 / 30);
        out.featPrestart = feats.includes('bay:gulls');
        // The player, racing: the feat.
        state.race.status = 'racing';
        for (let i = 0; i < 5; i++) Wildlife.update(1 / 30);
        out.featRacing = feats.includes('bay:gulls');

        // ── the bait boil ──
        Wildlife.forceBoil(1700, 200);
        let feeding = false;
        for (let i = 0; i < 30 * 40 && !feeding; i++) { Wildlife.update(1 / 30); feeding = Wildlife.debug().flight.mode === 'feeding'; }
        out.pelicansArrive = feeding;
        me.x = 1700 + 300; me.y = 200;
        for (let i = 0; i < 5; i++) Wildlife.update(1 / 30);
        out.boilFeatOutside = feats.includes('bay:bait-boil');
        me.x = 1700 + 30; me.y = 200;
        for (let i = 0; i < 5; i++) Wildlife.update(1 / 30);
        out.boilFeatInside = feats.includes('bay:bait-boil');

        // ── the bow crossing: a synthetic moving ship, the player swept across its track ──
        const ship = { id: 'test-ship', kind: 'bay-cove-cargo-ship', active: true, knots: 4, heading: 0, x: 0, y: 0, hullLen: 700 };
        const cross = (ahead) => {
            const before = feats.filter(f => f === 'bay:bow-cross').length;
            // heading 0 is north (-y); the bow is at y = -350; "ahead" units further north
            for (let x = -120; x <= 120; x += 20) { me.x = x; me.y = -350 - ahead; checkBowCrossing([ship]); }
            return feats.filter(f => f === 'bay:bow-cross').length > before;
        };
        state.race.status = 'racing';
        out.cross5Lengths = cross(5 * 55);
        out.cross2Lengths = cross(2 * 55);
        out.crossAstern = (() => { const before = feats.length; for (let x = -120; x <= 120; x += 20) { me.x = x; me.y = 500; checkBowCrossing([ship]); } return feats.length > before; })();
        return out;
    });

    ok(r.seals === 5 && r.sealsOnWater, `five harbour seals, all in the water (${r.seals})`);
    ok(r.sealLooks, 'a seal with its head up turns to watch a passing boat');
    ok(r.sealDives, 'a boat too close puts it straight down');
    ok(r.sealResurfaces, 'and it comes up again somewhere nearby');
    ok(r.colonyCount === 18, `18 gulls on the rock (${r.colonyCount})`);
    ok(r.allOnRock, 'every gull perches inside shape-36');
    ok(r.clearOfProps, 'no gull sits under a planted prop');
    ok(r.randomCalls === 0, `wildlife never calls Math.random (${r.randomCalls})`);
    ok(r.botFlushed && !r.featAfterBot, 'a bot puts the gulls up, and earns nobody anything');
    ok(!r.featPrestart, 'no feat before the gun');
    ok(r.featRacing, 'the player racing past the rock earns bay:gulls');
    ok(r.pelicansArrive, 'the pelicans find the boil');
    ok(!r.boilFeatOutside && r.boilFeatInside, 'the boil pays only inside it');
    ok(!r.cross5Lengths, 'crossing 5 lengths ahead of the bow does not count');
    ok(r.cross2Lengths, 'crossing 2 lengths ahead of the bow counts');
    ok(!r.crossAstern, 'crossing astern does not count');
    ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
    await b.close();
    console.log(fails ? `\nFAIL — ${fails} failure(s)` : '\nPASS — 0 failure(s)');
    process.exit(fails ? 1 : 0);
})();
