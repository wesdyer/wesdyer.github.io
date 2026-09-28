// SIX RUNGS AT EVERY VENUE (Sep 27 2026, Wes) — the Pond's raft (Pip), the Lake's islands (Barbel; Timber to
// Wildlife), the Lagoon's reef schools (Fizz), Sockeye Run's channels and bears (Pennant; Grizzle to Wildlife),
// Glowtide's manta shoal (Blink; Bloom to Wildlife). Headless, real page; the boat is placed by hand.
//
//   node regatta/eval/test_six_rungs.js     (from the repo root)
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
        const out = {}, feats = []; GameEvents.on('player-feat', e => feats.push(e.id));
        const L = { 'first-win': 0, mechanic: 1, explorer: 2, target: 3, 'four-stars': 4, wildlife: 5 };
        out.counts = VENUE_ORDER.map(k => k + ':' + Unlocks.forVenue(k).length).join(' ');
        out.order = VENUE_ORDER.every(k => { const rr = Unlocks.forVenue(k).map(a => L[a.rung]); return rr.join() === '0,1,2,3,4,5'; });
        out.pond = Unlocks.forVenue('pond').map(a => a.rung).join(',');
        const go = (venue) => { state.race.status = 'waiting'; resetGame(); selectVenue(venue); loadVenueWorld(); resetGame(); startRace(); state.race.status = 'racing'; feats.length = 0; const me = state.boats[0]; me.raceState.leg = 1; return me; };
        const walk = (me, pts, step) => { for (let i = 0; i < pts.length - 1; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (step || 20)));
            for (let k = 1; k <= n; k++) { me.x = x0 + (x1 - x0) * k / n; me.y = y0 + (y1 - y0) * k / n; step === 'wild' ? 0 : 0; checkLakeRun(); checkRiverSplits(); checkGlowRun(1 / 30); checkPondRaft(); } } };
        const circle = (cx, cy, R, n, from) => Array.from({ length: n + 1 }, (_, i) => { const a = (from || 0) + i / n * Math.PI * 2; return [cx + Math.cos(a) * R, cy + Math.sin(a) * R]; });
        const finish = (me) => { me.raceState.finished = true; me.raceState.resultStatus = null; checkLakeRun(); checkRiverSplits(); };
        // LAKE: a loop round everything vs a loop round the middle only
        me = go('lake'); const isl = _lakeIslands(); out.lakeN = isl.length;
        const xs = isl.map(q => q.x), ys = isl.map(q => q.y), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
        const Rbig = Math.max(...isl.map(q => Math.hypot(q.x - cx, q.y - cy))) + 400;
        walk(me, circle(cx, cy, Rbig, 80)); finish(me); out.lakeAll = feats.includes('lake:islands');
        me = go('lake'); walk(me, circle(cx, cy, 250, 40)); finish(me); out.lakeSome = !feats.includes('lake:islands') && feats.includes('lake:islands-n');
        // RIVER: pass each island keeping it on your LEFT → keep-right; the mirror → keep-left; mixed → neither
        const pass = (me, q, leftSide) => { // a straight run past the island, 300 u off, heading along +x then the island to one side
            const off = leftSide ? 1 : -1; // y grows downward: with heading +x, the LEFT of the boat is −y, so the island sits at −y of the path
            walk(me, [[q.x - q.r - 50, q.y + off * 0], [q.x - q.r - 50, q.y + off * 300], [q.x + q.r + 50, q.y + off * 300]]); };
        const I = RIVER_SPLITS.islands;
        me = go('river'); for (const q of I) pass(me, q, true); finish(me); out.right = feats.filter(f => /route/.test(f)).join(',');
        me = go('river'); for (const q of I) pass(me, q, false); finish(me); out.left = feats.filter(f => /route/.test(f)).join(',');
        me = go('river'); pass(me, I[0], true); pass(me, I[1], false); pass(me, I[2], true); finish(me); out.mixed = feats.filter(f => /route/.test(f)).join(',');
        // bears: one then both
        me = go('river'); const [b1, b2] = RIVER_SPLITS.bears; walk(me, [[b1[0] + 300, b1[1]], [b1[0] + 60, b1[1]]]); out.bear1 = feats.includes('river:bears');
        walk(me, [[b2[0] + 300, b2[1]], [b2[0] + 60, b2[1]]]); out.bear2 = feats.includes('river:bears');
        // GLOWTIDE: the manta shoal
        me = go('glowtide'); walk(me, [[GLOW_SW.x + 900, GLOW_SW.y], [GLOW_SW.x + 500, GLOW_SW.y]]); out.swFar = feats.includes('glowtide:mantas');
        walk(me, [[GLOW_SW.x + 500, GLOW_SW.y], [GLOW_SW.x + 200, GLOW_SW.y]]); out.swIn = feats.includes('glowtide:mantas');
        for (let k = 0; k < 3; k++) update(1 / 30); out.mantasSW = (Wildlife.debug().mantas || []).filter(m => Math.hypot(m.x - GLOW_SW.x, m.y - GLOW_SW.y) < 700).length;
        // LAGOON: scatter each school in turn (the wildlife update runs in update(); step a few frames at each)
        me = go('lagoon'); me.x = 99999; me.y = 99999; for (let k = 0; k < 3; k++) update(1 / 30); state.race.status = 'racing'; const S = Wildlife.debug().shoals; out.kinds = S.map(G => G.cfg.kind).join(',');
        S.forEach((G, i) => { if (i < S.length - 1) { me.x = G.cx + 60; me.y = G.cy; for (let k = 0; k < 3; k++) update(1 / 30); } });
        out.two = feats.includes('lagoon:shoals');
        me.x = S[S.length - 1].cx + 60; me.y = S[S.length - 1].cy; for (let k = 0; k < 3; k++) update(1 / 30);
        out.three = feats.includes('lagoon:shoals');
        // POND (Sailing School, section 2 on the pond itself): a full circle round the raft inside 260 u earns it;
        // three-quarters does not
        School.begin(); School.start(2); feats.length = 0; out.pondKey = state.course.venueKey;
        let pm = state.boats[0]; const raft = VenueDoc.get('pond').props.find(q => q.id === 'prop-44');
        const ring = (from, to) => { for (let i = from; i <= to; i++) { const a = i / 60 * Math.PI * 2; pm.x = raft.x + Math.cos(a) * 150; pm.y = raft.y + Math.sin(a) * 150; checkPondRaft(); } };
        ring(0, 44); out.raftPart = feats.includes('pond:raft');
        ring(45, 60); out.raftFull = feats.includes('pond:raft');
        out.raftSchool = Unlocks._schoolFeats.has('pond:raft');
        // ROWS
        const T = (ch, o, c) => Unlocks.ACHIEVEMENTS.find(a => a.char === ch).test(Object.assign({ finished: true, feats: [], vals: {} }, o), c || {});
        out.rows = T('Pip', { school: 'unit', sectionDone: true, feats: ['pond:raft'] }) && !T('Pip', { school: 'unit', sectionDone: true })
            && T('Barbel', { venue: 'lake', feats: ['lake:islands'] }) && T('Timber', { venue: 'lake', feats: ['lake:moose'] })
            && T('Fizz', { venue: 'lagoon', feats: ['lagoon:shoals'] }) && T('Grizzle', { venue: 'river', feats: ['river:bears'] })
            && T('Pennant', { venue: 'river' }, { venues: { river: { routes: ['keep-right', 'keep-left'] } } }) && !T('Pennant', { venue: 'river' }, { venues: { river: { routes: ['keep-right'] } } })
            && T('Blink', { venue: 'glowtide', feats: ['glowtide:mantas'] }) && T('Bloom', { venue: 'glowtide', feats: ['glowtide:bloom'] });
        out.rungs = ['Timber', 'Grizzle', 'Bloom'].every(n => Unlocks.achievementFor(n).rung === 'wildlife') && ['Barbel', 'Pennant', 'Blink'].every(n => Unlocks.achievementFor(n).rung === 'explorer');
        return out;
    });
    ok(r.order, `every venue reads First win · Mechanic · Explorer · Target · Four stars · Wildlife (${r.counts})`);
    ok(r.pond === 'first-win,lessons,start,explorer,wildlife,report', `the pond's six (${r.pond})`);
    ok(r.pondKey === 'pond' && !r.raftPart && r.raftFull && r.raftSchool, 'Pip: a full turn round the swim raft in Sailing School, not three-quarters');
    ok(r.lakeN === 7 && r.lakeAll && r.lakeSome, `Barbel: a loop round all ${r.lakeN} islands earns it; a loop round the middle does not`);
    ok(r.right === 'river:route:keep-right' && r.left === 'river:route:keep-left' && r.mixed === '', `Pennant: islands on your left = right channel (${r.right}); the mirror (${r.left}); mixed = neither (${r.mixed || 'none'})`);
    ok(!r.bear1 && r.bear2, 'Grizzle: both bears, not one');
    ok(!r.swFar && r.swIn && r.mantasSW === 3, `Blink: inside the manta shoal, not 500 u off; three mantas there (${r.mantasSW})`);
    ok(r.kinds === 'yellowtang,bluetang,goldie,chromis,humbug' && !r.two && r.three, `Fizz: all five schools (${r.kinds}), not four`);
    ok(r.rows && r.rungs, 'the rows read their feats; Timber, Grizzle, Bloom are Wildlife; Barbel, Pennant, Blink Explorer');
    ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
    await b.close();
    console.log(fails ? `\nFAIL — ${fails} failure(s)` : '\nPASS — 0 failure(s)');
    process.exit(fails ? 1 : 0);
})();
