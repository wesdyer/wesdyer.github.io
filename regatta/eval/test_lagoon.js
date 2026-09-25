// PEARL LAGOON — its wildlife and the feats its objectives read (js/wildlife.js CRUISERS;
// checkSquallRide / checkLandfall in js/sim/course.js; squallZoneAt in js/sim/wind.js).
// Headless, on the real page.
//
//   node regatta/eval/test_lagoon.js     (from the repo root, like every suite)
//
// Checks: the squalls carry Wes's Sep 25 size and speed; the turtles, the ray squadron and both
// shark groups are where they live and stay in the water; none of it draws from Math.random;
// a boat close by sends a cruiser off deeper; riding a gust front pays 'lagoon:squall-ride' at
// 15 s and not before, and not before the gun; rounding the cay (shape-5) reef to reef — 200
// degrees of its open lagoon side — pays 'lagoon:landfall', while a straight pass, 180
// degrees, or a rounding too wide of it does not.
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
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'lagoon', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
        resetGame();
        const out = {}, feats = [];
        GameEvents.on('player-feat', (e) => feats.push(e.id));
        const sq = state.course.doc.squalls;
        out.squalls = [sq.rx, sq.ry, sq.speedFactor].join('/');

        // ── the animals ──
        const d = Wildlife.debug();
        const byId = Object.fromEntries(d.cruisers.map(G => [G.cfg.id, G]));
        out.groups = d.cruisers.map(G => G.cfg.id + ':' + G.fish.length).join(',');
        const isl = (id) => state.course.islands.find(s => s.id === id).vertices;
        out.turtlesOnGrass = byId.turtles.fish.every(f => pointInPoly(f.x, f.y, isl('shape-33')) || pointInPoly(f.x, f.y, isl('shape-32')));
        const nearShoal = (f, id) => { const V = isl(id); if (pointInPoly(f.x, f.y, V)) return true;
            return V.some((a, i) => { const c = V[(i + 1) % V.length], q = getClosestPointOnSegment(f.x, f.y, a.x, a.y, c.x, c.y); return Math.hypot(q.x - f.x, q.y - f.y) < 130; }); };
        out.sharksHome = byId['sharks-3'].fish.every(f => nearShoal(f, 'shape-34')) && byId['sharks-45'].fish.every(f => nearShoal(f, 'shape-10'));

        const real = Math.random; let calls = 0; Math.random = () => { calls++; return real(); };
        for (let i = 0; i < 1800; i++) Wildlife.update(1 / 30);
        Math.random = real;
        out.randomCalls = calls;
        // In the water = off dry land (sand and scrub); a reef is water to a swimmer.
        out.allInWater = d.cruisers.every(G => G.fish.every(f => !G.dry(f.x, f.y)));
        { const V = isl('shape-5'); let x = 0, y = 0; for (const v of V) { x += v.x; y += v.y; } x /= V.length; y /= V.length;
          out.dryIsSand = pointInPoly(x, y, V) && d.cruisers[0].dry(x, y); }
        const L = byId.rays.fish[0];
        out.formationTight = byId.rays.fish.slice(1).every(f => Math.hypot(f.x - L.x, f.y - L.y) < 400);

        // A boat right beside a turtle sends it off, deeper.
        const me = state.boats[0], mate = state.boats[1];
        const t = byId.turtles.fish[0];
        t.mode = 'cruise'; t.flee = 0; t.depth = t.dT = 0.4;
        mate.x = t.x + 50; mate.y = t.y;
        for (let i = 0; i < 20; i++) Wildlife.update(1 / 30);
        out.turtleFled = t.flee > 0 && t.depth > 0.5;
        mate.x = 1e5; mate.y = 1e5;

        // ── Ride the Cell: a synthetic squall parked with the player on its front ──
        const q = { x: 0, y: 0, course: state.wind.baseDirection, rx: 1063, ry: 688, speedFactor: 0, blobs: [] };
        const ux = -Math.sin(q.course), uy = Math.cos(q.course);
        const onFront = () => { me.x = q.x + ux * 0.6 * q.ry; me.y = q.y + uy * 0.6 * q.ry; };
        state.squalls = [q];
        out.zoneFront = (onFront(), squallZoneAt(me.x, me.y));
        out.zoneWake = squallZoneAt(q.x - ux * 1.6 * q.ry, q.y - uy * 1.6 * q.ry);
        const ride = (secs, status) => {
            state.race.status = status;
            const t0 = state.time, n0 = feats.filter(f => f === 'lagoon:squall-ride').length;
            while (state.time - t0 < secs) { onFront(); state.time += 1 / 30; checkSquallRide(); }
            return feats.filter(f => f === 'lagoon:squall-ride').length > n0;
        };
        out.ridePrestart = ride(20, 'prestart');
        me.x = 1e5; checkSquallRide();
        out.ride12 = ride(12, 'racing');
        me.x = 1e5; state.time += 1; checkSquallRide();         // fall off the front: the count restarts
        out.ride16 = ride(16, 'racing');

        // The cay backs onto the barrier reef, so the rule is reef to reef: find the open arc of
        // water hugging it (clear of every wall — sand, scrub, reef — and inside the boundary).
        const V = isl('shape-5'); let cx = 0, cy = 0, rmax = 0; for (const v of V) { cx += v.x; cy += v.y; } cx /= V.length; cy /= V.length;
        for (const v of V) rmax = Math.max(rmax, Math.hypot(v.x - cx, v.y - cy));
        const walls = state.course.islands.filter(s => s.id !== 'shape-5' && (VenueDoc.traits(s).hard || VenueDoc.traits(s).reef));
        const RING = rmax + 40;
        const openAt = (deg) => { const a = deg * Math.PI / 180, px = cx + Math.cos(a) * RING, py = cy + Math.sin(a) * RING;
            return !walls.some(w => pointInPoly(px, py, w.vertices)) && Arena.contains(state.course.boundary, px, py, 0); };
        let run = 0, best = 0, bestEnd = 0;
        for (let k = 0; k < 720; k++) { if (openAt(k % 360)) { run++; if (run > best) { best = run; bestEnd = k; } } else run = 0; }
        out.openArc = Math.min(360, best);
        const arcStart = bestEnd - best + 1;
        const sail = (degs, R) => {   // along the open arc from its start
            const n0 = feats.filter(f => f === 'lagoon:landfall').length;
            me.x = 1e5; me.y = 1e5; checkLandfall();
            for (let k = 0; k <= degs; k += 2) { const a = (arcStart + 5 + k) * Math.PI / 180; me.x = cx + Math.cos(a) * R; me.y = cy + Math.sin(a) * R; checkLandfall(); }
            return feats.filter(f => f === 'lagoon:landfall').length > n0;
        };
        const straight = () => {       // a straight pass right along the cay's open side, ring distance off
            const n0 = feats.filter(f => f === 'lagoon:landfall').length;
            me.x = 1e5; checkLandfall();
            const mid = (arcStart + out.openArc / 2) * Math.PI / 180, nx = Math.cos(mid), ny = Math.sin(mid);
            for (let s = -900; s <= 900; s += 10) { me.x = cx + nx * RING - ny * s; me.y = cy + ny * RING + nx * s; checkLandfall(); }
            return feats.filter(f => f === 'lagoon:landfall').length > n0;
        };
        state.race.status = 'racing';
        out.straightPass = straight();
        out.arc180 = sail(180, RING);
        out.arcWide = sail(out.openArc - 10, 900);
        out.arc210 = sail(Math.min(out.openArc - 10, 215), RING);
        return out;
    });

    ok(r.squalls === '1063/688/0.55', `the squalls are 25% larger and half as fast (${r.squalls})`);
    ok(r.groups === 'turtles:4,rays:5,sharks-3:3,sharks-45:2', `turtles, a ray squadron and two shark groups (${r.groups})`);
    ok(r.turtlesOnGrass, 'the turtles start on their seagrass beds');
    ok(r.sharksHome, 'the sharks start on or beside their reef flats');
    ok(r.randomCalls === 0, `wildlife never calls Math.random (${r.randomCalls})`);
    ok(r.allInWater, 'a minute on, every cruiser is still in the water (off the sand; over reef is fine)');
    ok(r.dryIsSand, 'the swimmers\' dry-land test knows a sand cay is dry');
    ok(r.formationTight, 'the rays keep formation');
    ok(r.turtleFled, 'a boat alongside sends a turtle off, deeper');
    ok(r.zoneFront === 'front' && r.zoneWake === 'wake', `squallZoneAt names the front and the wake (${r.zoneFront}, ${r.zoneWake})`);
    ok(!r.ridePrestart, 'no ride counts before the gun');
    ok(!r.ride12, '12 s on the front is not enough');
    ok(r.ride16, '16 s on the front earns lagoon:squall-ride');
    ok(r.openArc >= 230, `the water hugging the cay is open for ${r.openArc} degrees, room for the 200 the rule asks`);
    ok(!r.straightPass, 'a straight pass along the cay does not count');
    ok(!r.arc180, '180 degrees round the cay is not enough');
    ok(!r.arcWide, 'a rounding too wide of the cay does not count');
    ok(r.arc210, 'reef to reef round the lagoon side (210 degrees) earns lagoon:landfall');
    ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
    await b.close();
    console.log(fails ? `\nFAIL — ${fails} failure(s)` : '\nPASS — 0 failure(s)');
    process.exit(fails ? 1 : 0);
})();
