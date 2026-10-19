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
    // the iguanas (Oct 18 2026, Wes: "make sure when they are on land that they are positioned correctly"): every basker's
    // whole body — snout, four feet, its curled tail — on dry rock, off the props (boulders apart); and through two
    // minutes nobody walks on the water or swims on the rock, nobody heading home dives, the warm ones face the sun
    const ig = await p.evaluate(() => {
        selectVenue('volcanic'); resetGame(); for (const o of state.boats) { o.x = 1e6; o.y = 1e6; }
        const H = Wildlife.debug().igHeaps, K = VenueDoc.PROP_KINDS, foot = Wildlife.art.igFootprint;
        const rings = (state.course.props || []).filter(t => !/boulder|vent-underwater/.test(t.kind)).map(t => ({ t, R: VenueDoc.propHitRings(t).rings.map(r => r.map(([x, y]) => ({ x, y }))) }));
        const onProp = (x, y) => rings.some(q => Math.hypot(q.t.x - x, q.t.y - y) < ((K[q.t.kind] || {}).world || 100) * (q.t.scale || 1) && q.R.some(r => pointInPoly(x, y, r)));
        let n = 0, off = 0, prop = 0, walkWet = 0, swimDry = 0, homeDive = 0;
        for (const G of H) for (const m of G.members) { n++; const P = foot(m); if (P.some(([x, y]) => !pointOnLand(x, y))) off++; if (P.some(([x, y]) => onProp(x, y))) prop++; }
        const all = H.flatMap(G => G.members), prev = new Map(all.map(m => [m, m.mode]));
        for (let i = 0; i < 30 * 120; i++) { Wildlife.update(1 / 30);
            for (const m of all) { if (m.mode === 'walk' && !pointOnLand(m.x, m.y)) walkWet++; if (m.mode === 'swim' && pointOnLand(m.x, m.y)) swimDry++;
                if (prev.get(m) === 'swim' && m.home && m.mode === 'dive') homeDive++; prev.set(m, m.mode); } }
        const warm = all.filter(m => m.mode === 'bask' && m.warm > 0.6), aimed = warm.filter(m => Math.abs(Math.atan2(Math.sin(m.h + Math.PI / 4), Math.cos(m.h + Math.PI / 4))) < 0.45);
        return { n, off, prop, walkWet, swimDry, homeDive, warm: warm.length, aimed: aimed.length };
    });
    ok(ig.n > 150 && ig.off === 0 && ig.prop === 0, `every basking iguana's whole body on dry rock, off the crags (${ig.n}: ${ig.off} over water, ${ig.prop} on a prop)`);
    ok(ig.walkWet === 0 && ig.swimDry === 0 && ig.homeDive === 0, `iguanas swim from the waterline, walk only on rock, never dive heading home (${ig.walkWet}/${ig.swimDry}/${ig.homeDive})`);
    ok(ig.warm > 100 && ig.aimed >= ig.warm * 0.95, `warmed iguanas point at the sun (${ig.aimed}/${ig.warm})`);
    // the crabs (Oct 18 2026): two minutes on the rock — never off it — sprinting ~1.4 m/s when they bolt, and a forced wash
    // over the low rock makes the crabs under it cling
    const cr = await p.evaluate(() => {
        selectVenue('volcanic'); resetGame(); for (const o of state.boats) { o.x = 1e6; o.y = 1e6; }
        const beds = Wildlife.debug().crabBeds.filter(B => !B.cleaners), all = beds.flatMap(B => B.crabs), prev = new Map(all.map(c => [c, [c.x, c.y]]));
        let off = 0, fast = []; for (let i = 0; i < 30 * 120; i++) { Wildlife.update(1 / 30);
            for (const c of all) { const [x, y] = prev.get(c); if (c.flee > 0) { const v = Math.hypot(c.x - x, c.y - y) * 30; if (v > 1) fast.push(v); } if (!pointOnLand(c.x, c.y)) off++; prev.set(c, [c.x, c.y]); } }
        const atLow = (c) => (c.up || 0) < 16 && Math.hypot(c.x - c.hx, c.y - c.hy) < 8;   // (a low crab at its spot by the water, not one that has run up the rock)
        const B = beds.find(b => b.crabs.some(atLow)), low = B.crabs.find(atLow);
        for (const c of B.crabs) { c.flee = 0; c.duel = null; c.cling = 0; }
        B.sprayT = 0; B.washAt = { x: low.x, y: low.y }; Wildlife.update(1 / 30);
        fast.sort((a, b) => a - b);
        return { off, sprint: Math.round(fast[fast.length >> 1] || 0), wash: !!B.wash, cling: B.crabs.filter(c => c.cling > 0 || c.flee > 0).length };
    });
    ok(cr.off === 0, `crabs stay on the rock (${cr.off} frames off it)`);
    ok(cr.sprint >= 30 && cr.sprint <= 50, `crabs bolt at a grapsid sprint, ~1.4 m/s (median ${cr.sprint} u/s)`);
    ok(cr.wash && cr.cling >= 1, `a wave washes the low rock and the crabs under it cling or run (${cr.cling})`);
    // the boobies (Oct 18 2026): ten minutes — time under the water after each plunge as Zavalaga et al. 2007 measured
    // it (3.2 s on average, 1.7-5.7), the flock going in together (the spotter, the rest within ~1.5 s), never plunging onto rock
    const bo = await p.evaluate(() => {
        selectVenue('volcanic'); resetGame(); for (const o of state.boats) { o.x = 1e6; o.y = 1e6; }
        const Fs = Wildlife.debug().boobyFlocks, under = new Map(), spans = [], ut = []; let rock = 0; const start = new Map();
        for (let i = 0; i < 30 * 600; i++) { Wildlife.update(1 / 30); const t = i / 30;
            // (first bird into its fall to the last: the spotter's own tip-over doesn't count against the flock)
            for (const F of Fs) { if (F.mode === 'plunge' && !start.has(F)) start.set(F, { t0: null, last: null }); if (F.mode !== 'plunge' && start.has(F)) { const S0 = start.get(F); if (S0.t0 != null) spans.push(S0.last - S0.t0); start.delete(F); }
                for (const b of F.birds) { if (b.mode === 'dive' && b.dive < 0.05 && start.has(F)) { const S0 = start.get(F); if (S0.t0 == null) S0.t0 = t; S0.last = t; }
                    if (b.mode === 'under') { if (!under.has(b)) under.set(b, t); if (pointOnLand(b.x, b.y)) rock++; } else if (under.has(b)) { ut.push(t - under.get(b)); under.delete(b); } } } }
        ut.sort((x, y) => x - y); spans.sort((x, y) => x - y);
        return { n: ut.length, mean: ut.reduce((x, y) => x + y, 0) / (ut.length || 1), lo: ut[0], hi: ut[ut.length - 1], span: spans[spans.length >> 1], rock };
    });
    ok(bo.n > 30 && bo.mean > 2.6 && bo.mean < 3.8 && bo.lo >= 1.6 && bo.hi <= 5.8, `boobies stay under ~3 s after a plunge (${bo.n} dives, mean ${bo.mean.toFixed(2)} s, ${bo.lo && bo.lo.toFixed(1)}-${bo.hi && bo.hi.toFixed(1)})`);
    ok(bo.span != null && bo.span < 2.2 && bo.rock === 0, `the flock plunges together (first to last in ${bo.span && bo.span.toFixed(2)} s), never under rock (${bo.rock})`);
    // the frigatebirds (Oct 18 2026): fifteen minutes — soaring, they barely flap (Weimerskirch et al. 2003); most food
    // snatched from the surface on the wing; piracy rarely pays (Osorno et al. 1992: ~6% of chases, groups ~3x)
    const fg = await p.evaluate(() => {
        selectVenue('volcanic'); resetGame(); for (const o of state.boats) { o.x = 1e6; o.y = 1e6; }
        const Fr = Wildlife.debug().frigates, prev = new Map(Fr.map(f => [f, f.mode])), seen = new Set(), tg = new Set(); let fr = 0, flap = 0, dips = 0, landDip = 0;
        for (let i = 0; i < 30 * 900; i++) { Wildlife.update(1 / 30);
            for (const f of Fr) { fr++; if (f.beats > 0 && f.mode === 'soar') flap++; const pm = prev.get(f);
                if (pm === 'dip' && f.mode === 'climb' && f.dipRing > 0.9) { dips++; if (pointOnLand(f.rx, f.ry)) landDip++; }
                if (pm !== 'swoop' && f.mode === 'swoop' && f.tgt) tg.add(f.tgt); prev.set(f, f.mode); }
            for (const q of Wildlife.debug().frigFish) seen.add(q); }
        return { soarFlap: flap / fr, dips, landDip, chases: tg.size, drops: seen.size };
    });
    ok(fg.soarFlap < 0.08, `soaring frigatebirds barely flap (${(fg.soarFlap * 100).toFixed(1)}% of the time)`);
    ok(fg.dips >= 10 && fg.landDip === 0, `frigatebirds snatch from the sea surface, never off the rock (${fg.dips})`);
    ok(fg.chases >= 10 && fg.drops / fg.chases < 0.3, `piracy rarely pays (${fg.drops} fish dropped in ${fg.chases} chases)`);
    // the sooty terns (Oct 18 2026): ten minutes — they live on the wing (Birds of the World: plumage not water-repellent),
    // touching down on the sea only for a moment and never on rock; they feed by dipping, never a plunge
    const st = await p.evaluate(() => {
        selectVenue('volcanic'); resetGame(); for (const o of state.boats) { o.x = 1e6; o.y = 1e6; }
        const B = Wildlife.debug().ternFlocks.filter(F => F.sooty).flatMap(F => F.birds); let fr = 0, down = 0, rock = 0, dips = 0, longest = 0; const sat = new Map(), prev = new Map(B.map(b => [b, b.mode]));
        for (let i = 0; i < 30 * 600; i++) { Wildlife.update(1 / 30);
            for (const b of B) { fr++; if (b.mode === 'alight') { down++; sat.set(b, (sat.get(b) || 0) + 1 / 30); longest = Math.max(longest, sat.get(b)); if (pointOnLand(b.x, b.y)) rock++; } else sat.delete(b);
                if (prev.get(b) !== 'dip' && b.mode === 'dip') dips++; if (b.mode === 'dive' || b.mode === 'sit' || b.mode === 'hover') rock += 1000; prev.set(b, b.mode); } }
        return { n: B.length, down: down / fr, rock, dips, longest };
    });
    ok(st.n > 20 && st.dips > 100 && st.down < 0.02 && st.longest < 1.6 && st.rock === 0, `sooty terns live on the wing, dipping (${st.dips} dips), down on the sea ${(st.down * 100).toFixed(2)}% of the time, never > ${st.longest.toFixed(1)} s, never on rock, never a plunge`);
    // the hammerheads (Oct 18 2026, Wes: "make sure the sharks are not stacked on top of each other"; "slowly circled in a
    // wide radius"): three minutes — each shark as a capsule down its body, seen from above — few ever touch, and only in
    // passing (the corkscrew, as her neighbours give way); the schools turn
    const hm = await p.evaluate(() => {
        selectVenue('volcanic'); resetGame(); for (const o of state.boats) { o.x = 1e6; o.y = 1e6; }
        const Ss = Wildlife.debug().hammerSchools, L = 35, a0 = Ss.map(S => S.ang);
        const seg = (f) => { const len = L * f.size; return [f.x + Math.sin(f.h) * len * 0.43, f.y - Math.cos(f.h) * len * 0.43, f.x - Math.sin(f.h) * len * 0.45, f.y + Math.cos(f.h) * len * 0.45, 3.25 * f.size]; };
        const d = (px, py, ax, ay, bx, by) => { const vx = bx - ax, vy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy))); return Math.hypot(px - ax - vx * t, py - ay - vy * t); };
        let samples = 0, over = 0, longest = 0; const run = new Map();
        for (let i = 0; i < 30 * 180; i++) { Wildlife.update(1 / 30); if (i % 15) continue;
            for (const S of Ss) { const G = S.fish.map(seg), hit = new Set();
                for (let x = 0; x < G.length; x++) for (let y = x + 1; y < G.length; y++) { const A = G[x], B = G[y]; if (Math.hypot(A[0] - B[0], A[1] - B[1]) > 80) continue;
                    const m = Math.min(d(A[0], A[1], B[0], B[1], B[2], B[3]), d(A[2], A[3], B[0], B[1], B[2], B[3]), d(B[0], B[1], A[0], A[1], A[2], A[3]), d(B[2], B[3], A[0], A[1], A[2], A[3])), id = S.i + ':' + x + ':' + y;
                    if (m < A[4] + B[4]) { hit.add(x); hit.add(y); const n = (run.get(id) || 0) + 0.5; run.set(id, n); longest = Math.max(longest, n); } else run.delete(id); }
                samples += S.fish.length; over += hit.size; } }
        return { n: Ss.reduce((q, S) => q + S.fish.length, 0), share: over / samples, longest, turned: Ss.every((S, k) => Math.abs(S.ang - a0[k]) > 1) };
    });
    ok(hm.n > 250 && hm.share < 0.02 && hm.longest <= 5, `hammerheads never stacked: ${(hm.share * 100).toFixed(1)}% touching at a time, the longest ${hm.longest} s (${hm.n} sharks)`);
    ok(hm.turned, 'the hammerhead schools circle slowly over their vents');
    ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
    await b.close();
    console.log(fails ? `\nFAIL — ${fails} failure(s)` : '\nPASS — 0 failure(s)');
    process.exit(fails ? 1 : 0);
})();
