// EMBERFALL ISLE — the venue's objectives (and, as they land, its wildlife). Headless, real page.
//
//   node regatta/eval/test_emberfall.js     (from the repo root, like every suite)
//
// Checks: Outrun the Bolt counts an aimed bolt landing 450 u+ from the racing player (not a near one,
// not one aimed at a bot, not before the gun); Round the Archipelago only for a loop outside every
// island (not the course's own inside line); the six rows read what they should.
const { chromium } = require('playwright');
const path = require('path');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  FAIL ' + m); } else console.log('  ok   ' + m); };
(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForFunction(() => window.state && window.Volcano && typeof resetGame === 'function');
    const r = await p.evaluate(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'volcanic', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
        selectVenue('volcanic'); resetGame(); startRace();
        const out = {}, feats = []; GameEvents.on('player-feat', (e) => feats.push(e));
        const me = state.boats[0], bot = state.boats[1], v = state.volcano;
        for (let i = 0; i < 30 * 12; i++) update(1 / 30);   // to the gun
        state.race.status = 'racing';
        const dodges = () => feats.filter(e => e.id === 'volcanic:dodge').map(e => e.value).join(',');
        // force the aimed striker to mark a point `d` from where the boat is, then fire
        const bolt = (boat, d) => { const S = v.strikers.find(s => s.aimed); S.pending = { ox: boat.x, oy: boat.y - 900, x: boat.x + d, y: boat.y, at: v.t, seed: 1, aimed: true, boat, px: boat.x, py: boat.y };
            S.next = 1e9; for (const s of v.strikers) if (!s.aimed) s.next = 1e9; Volcano.update(1 / 30); };
        bolt(me, 200); out.near = dodges();
        bolt(bot, 600); out.bot = dodges();
        bolt(me, 500); bolt(me, 700); out.two = dodges();
        state.race.status = 'prestart'; bolt(me, 800); out.pre = dodges(); state.race.status = 'racing';
        // the outside loop: a scripted circle well outside every gate, vs the course's own line
        const G = _volcOuterGates(); let cx = 0, cy = 0, R = 0; for (const g of G) { cx += g.a.x; cy += g.a.y; } cx /= G.length; cy /= G.length;
        for (const g of G) R = Math.max(R, Math.hypot(g.a.x - cx, g.a.y - cy));
        const sail = (pts) => { state.race.status = 'finished'; checkVolcanicRun(); state.race.status = 'racing'; me.raceState.finished = false; const n0 = feats.filter(e => e.id === 'volcanic:outer').length;
            for (let k = 0; k < pts.length - 1; k++) for (let i = 0; i <= 10; i++) { me.x = pts[k][0] + (pts[k + 1][0] - pts[k][0]) * i / 10; me.y = pts[k][1] + (pts[k + 1][1] - pts[k][1]) * i / 10; checkVolcanicRun(); }
            return feats.filter(e => e.id === 'volcanic:outer').length - n0; };
        const circle = (rad) => [...Array(73)].map((_, k) => [cx + Math.sin(k / 72 * 6.2832) * rad, cy - Math.cos(k / 72 * 6.2832) * rad]);
        out.gates = G.length; out.outer = sail(circle(R + 200)); out.inner = sail(circle(R * 0.55));
        out.marks = sail(state.course.marks.filter(m => /^mark-[345]$/.test(m.id)).map(m => [m.x, m.y]).concat([[state.course.marks[0].x, state.course.marks[0].y]]));
        // THE WILDLIFE
        const d = Wildlife.debug(); for (const o of state.boats) { o.x = 1e6; o.y = 1e6; }
        out.cast = [d.igHeaps.length, d.crabBeds.length, d.boobyFlocks.length, d.frigates.length, d.hammerSchools.length].join(',');
        const real = Math.random; let calls = 0; Math.random = () => { calls++; return real(); };
        // lava (Wes: "make sure animals don't move into lava"): nothing walks, sits, dips or swims inside a lava shape
        const lava = state.course.islands.filter(s => s.vertices && (VenueDoc.traits(s).lava || VenueDoc.traits(s).magma));
        const inLava = (x, y) => lava.some(s => pointInVerts(x, y, s.vertices)); out.lavaShapes = lava.length; let hot = 0;
        let wet = 0, dry = 0; state.race.status = 'prestart';
        for (let i = 0; i < 30 * 240; i++) { Wildlife.update(1 / 30); if (i % 15) continue;
            for (const G of d.igHeaps) for (const m of G.members) if (m.mode === 'bask' && !pointOnLand(m.x, m.y)) wet++;
            for (const B of d.crabBeds) for (const c of B.crabs) if (!pointOnLand(c.x, c.y)) wet++;
            for (const S of d.hammerSchools) for (const f of S.fish) if (pointOnLand(f.x, f.y)) dry++;
            for (const G of d.igHeaps) for (const m of G.members) if (inLava(m.x, m.y)) hot++;
            for (const B of d.crabBeds) for (const c of B.crabs) if (inLava(c.x, c.y)) hot++;
            for (const S of d.hammerSchools) for (const f of S.fish) if (inLava(f.x, f.y)) hot++;
            for (const F of d.boobyFlocks) for (const q of F.birds) if (q.mode === 'sit' && pointOnLand(q.x, q.y)) hot++;
            for (const F of d.ternFlocks) for (const q of F.birds) if (q.z < 3 && q.mode !== 'roost' && pointOnLand(q.x, q.y)) hot++; }
        out.hot = hot;
        Math.random = real; out.calls = calls; out.wet = wet; out.dry = dry;
        // Booby Shower: under a plunge while racing counts; before the gun, or 800 u off, not
        const boo = () => feats.filter(e => e.id === 'volcanic:boobies').length;
        const plunge = (dx, status) => { const F = d.boobyFlocks[0]; F.mode = 'circle'; F.t = 0.001; for (const b of F.birds) { b.mode = 'fly'; b.x = F.cx + (b.x - F.cx) * 0.3; b.y = F.cy + (b.y - F.cy) * 0.3; }
            state.race.status = status; me.raceState.finished = false; for (let i = 0; i < 30 * 8; i++) { me.x = F.cx + dx; me.y = F.cy; Wildlife.update(1 / 30); } me.x = 1e6; };
        plunge(0, 'prestart'); out.booPre = boo(); plunge(800, 'racing'); out.booFar = boo(); plunge(0, 'racing'); out.booIn = boo();
        // a boat over a hammerhead school sends it deeper; crabs run from a boat
        { const S = d.hammerSchools[0]; me.x = S.cx; me.y = S.cy; for (let i = 0; i < 90; i++) Wildlife.update(1 / 30); out.sink = +S.sink.toFixed(2); me.x = 1e6;
          const B = d.crabBeds[0], c0 = B.crabs[0]; me.x = c0.x + Math.sin(c0.out) * 150; me.y = c0.y - Math.cos(c0.out) * 150; const near = B.crabs.filter(c => Math.hypot(c.x - me.x, c.y - me.y) < 240);
          const before = near.map(c => [c.x, c.y]); for (let i = 0; i < 60; i++) Wildlife.update(1 / 30);
          // up the rock: moved against their way to the water (and still on the rock)
          out.run = near.filter((c, i) => c.flee > 0 && ((c.x - before[i][0]) * -Math.sin(c.out) + (c.y - before[i][1]) * Math.cos(c.out)) > 4).length; out.nearN = near.length;
          out.crabDry = B.crabs.every(c => pointOnLand(c.x, c.y)); me.x = 1e6; }
        const A = Unlocks.ACHIEVEMENTS.filter(a => a.venue === 'volcanic'); out.rows = A.map(a => a.char).join(',');
        const base = { venue: 'volcanic', finished: true, feats: [], vals: {} }, T = (ch, o) => A.find(a => a.char === ch).test(Object.assign({}, base, o));
        out.torch = T('Torch', { vals: { 'volcanic:dodge': 3 } }) && !T('Torch', { vals: { 'volcanic:dodge': 2 } });
        out.vent = T('Vent', { feats: ['volcanic:outer'] }) && !T('Vent', {});
        return out;
    });
    ok(r.near === '', `a bolt landing 200 u off is not a dodge (${r.near})`);
    ok(r.bot === '', 'a bolt aimed at a bot is not the player\'s dodge');
    ok(r.two === '1,2', `bolts landing 500 u and 700 u off count 1, 2 (${r.two})`);
    ok(r.pre === '1,2', 'nothing before the gun');
    ok(r.gates >= 20, `the outside loop has a gate for every island (${r.gates})`);
    ok(r.outer === 1, 'Round the Archipelago: a loop outside every island counts');
    ok(r.inner === 0 && r.marks === 0, 'not a loop inside the islands, not the marks\' own line');
    ok(r.cast === '5,5,4,2,4' || r.cast.split(',').every(x => +x > 0), `iguanas, crabs, boobies, frigatebirds, hammerheads (${r.cast})`);
    ok(r.calls === 0, `wildlife never calls Math.random (${r.calls})`);
    ok(r.lavaShapes > 0 && r.hot === 0, `no animal in the lava, no bird dipping onto rock (${r.hot} samples, ${r.lavaShapes} lava shapes)`);
    ok(r.wet === 0 && r.dry === 0, `basking iguanas and crabs on land, hammerheads in the water (${r.wet}/${r.dry})`);
    ok(r.booPre === 0 && r.booFar === 0, 'Booby Shower: not before the gun, not from 800 u off');
    ok(r.booIn === 1, `Booby Shower: under the plunge counts (${r.booIn})`);
    ok(r.sink > 0.5, `a boat over the hammerheads sends them deeper (${r.sink})`);
    ok(r.nearN >= 3 && r.run >= r.nearN * 0.6 && r.crabDry, `crabs scurry up the rock, away from the water, from a close boat (${r.run} of ${r.nearN})`);
    ok(r.rows === 'Ember,Torch,Vent,Basalt,Stomp,Soot', `six Emberfall rows (${r.rows})`);
    ok(r.torch && r.vent, 'Torch reads three dodges, Vent the outside loop');
    ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
    await b.close();
    console.log(fails ? `\nFAIL — ${fails} failure(s)` : '\nPASS — 0 failure(s)');
    process.exit(fails ? 1 : 0);
})();
