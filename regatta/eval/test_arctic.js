// GLACIER SOUND — its wildlife and the feats its objectives read (js/wildlife.js orcas, penguins,
// leopard seals, terns; ARCTIC_RUN / checkArcticRun in js/sim/course.js). Headless, real page.
//
//   node regatta/eval/test_arctic.js     (from the repo root, like every suite)
//
// Checks: three orca pods, four fixed penguin colonies (emperor, two gentoo, macaroni) on their
// shapes, Adélies on floes, three leopard seals, tern flocks; no Math.random; orcas stay off
// fixed land and surface; Adélies slide in from a close boat; Four Colonies counts species once
// each, only racing; the glacier face only within 350 u; "iced" from ice but not granite.
const { chromium } = require('playwright');
const path = require('path');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  FAIL ' + m); } else console.log('  ok   ' + m); };
(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
    const r = await p.evaluate(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
        resetGame();
        const out = {}, feats = [];
        GameEvents.on('player-feat', (e) => feats.push(e));
        const d = Wildlife.debug();
        out.pods = d.orcaPods.map(W => W.members.length).join(',');
        out.colonies = d.penguinColonies.map(C => C.species + ':' + C.birds.length).join(',');
        out.onShape = d.penguinColonies.every(C => C.birds.every(bd => pointInPoly(bd.x, bd.y, C.isl.vertices)));
        out.floeGroups = d.floeGroups.filter(G => G.birds.length).length;
        out.seals = d.lseals.length; out.terns = d.ternFlocks.length;
        const me = state.boats[0], away = (bt) => { bt.x = 1e6; bt.y = 1e6; };
        for (const bt of state.boats) away(bt);
        const real = Math.random; let calls = 0; Math.random = () => { calls++; return real(); };
        let dry = 0, surf = 0, underIce = { orca: 0, orcaUp: 0, seal: 0, penguin: 0 }, shared = 0, seen = 0;
        const fixed = state.course.islands.filter(s => !s.isFloe && !(s.id || '').endsWith('.hit'));
        // every hard shape, floes included, at the moment of the test (floes drift)
        const solid = (x, y, ign, noFloes) => state.course.islands.some(s => s !== ign && !(noFloes && s.isFloe) && !s.awash && s.vertices && s.vertices.length > 2 && Math.hypot(x - s.x, y - s.y) <= (s.radius || 1e9) && pointInPoly(x, y, s.vertices));
        // an animal counts as under the ice if it stays there more than 0.3 s (a frame's contact
        // with a floe's sweeping rim before it slips clear can't be seen); floes move every frame
        const under = new Map(), longUnder = (o, is, kind) => { const t = is ? (under.get(o) || 0) + 1 / 30 : 0; under.set(o, t); if (t > 0.3) underIce[kind]++; };
        for (let i = 0; i < 30 * 600; i++) { Wildlife.update(1 / 30);
            if (typeof updateIceFloes === 'function') updateIceFloes(1 / 30);   // the pack drifts as in a race
            const D = Wildlife.debug();
            for (const W of D.orcaPods) for (const m of W.members) { if (fixed.some(s => pointInPoly(m.x, m.y, s.vertices))) dry++; if (m.up >= 0) surf++;
                const L = m.kind === 'orca' ? 38 : m.kind === 'orca-b' ? 30 : 16, fx = Math.sin(m.h), fy = -Math.cos(m.h);
                // whales dive under the floes (Wes) but never under rock or the fixed ice, and never surface under a floe
                if (solid(m.x, m.y, null, true) || solid(m.x + fx * L * 0.8, m.y + fy * L * 0.8, null, true) || solid(m.x - fx * L * 0.8, m.y - fy * L * 0.8, null, true)) underIce.orca++;   // rock or fixed ice: never, not even a frame
                longUnder(m, m.up >= 0.1 && m.up < 0.9 && solid(m.x, m.y), 'orcaUp'); }
            for (const S of D.lseals) longUnder(S, (S.mode === 'swim' || S.mode === 'toFloe' || (S.mode === 'dive' && S.depth < 0.25)) && solid(S.x, S.y, S.mode === 'toFloe' ? S.floe : null), 'seal');   // (deep, it may pass under floes like the whales)   // (climbing onto its floe is not under it)
            for (const S of D.swimmers) longUnder(S, solid(S.x, S.y, S.back && S.back.floe ? S.back.floe : S.home ? S.home.isl : null), 'penguin');
            if (i % 3) continue;
            const sealed = new Set(D.lseals.filter(q => q.mode === 'haul' || q.mode === 'launch').map(q => q.floe));
            for (const G of D.floeGroups) if (G.birds.length && sealed.has(G.floe)) shared++;
            seen++; }
        out.underIce = underIce; out.shared = shared; out.seen = seen;
        Math.random = real;
        out.randomCalls = calls; out.dry = dry; out.surf = surf;
        // Adélies slide in from a close boat
        { const G = d.floeGroups.find(g => g.birds.length), F = G.floe, n = G.birds.length, before = new Set(Wildlife.debug().swimmers);
          me.x = F.x + F.radius + 60; me.y = F.y; Wildlife.update(1 / 30); away(me);
          const tr = Wildlife.debug().treks.filter(T => T.floe === F && T.dir === 'out');
          out.tobogganing = tr.length === n && tr.every(T => T.slide) && new Set(tr.map(T => T.birds[0].delay.toFixed(2))).size === n;
          for (let i = 0; i < 30 * 10; i++) Wildlife.update(1 / 30);
          out.slid = !G.birds.length && Wildlife.debug().swimmers.some(S => !before.has(S) && S.species === 'adelie' && S.toFloe && S.birds.length === n); }   // their own group, in the water
        // species: every penguin party in ten minutes — walkers on rock, tobogganers on ice
        { const seenT = new Map(), seenS = new Set();
          for (let i = 0; i < 30 * 400; i++) { Wildlife.update(1 / 30);
            for (const T of Wildlife.debug().treks) if (!T.floe) seenT.set(T.species + ':' + T.dir, T.slide);
            for (const S of Wildlife.debug().swimmers) seenS.add(S.species); }
          out.treks = [...seenT].map(([k, v]) => k + (v ? '/slide' : '/walk')).sort().join(',');
          out.swimSp = [...seenS].sort().join(','); }
        // Four Colonies
        const n = (id) => feats.filter(e => e.id === id);
        const C = Wildlife.debug().penguinColonies;
        state.race.status = 'prestart'; me.x = C[0].home.x; me.y = C[0].home.y; Wildlife.update(1 / 30); out.colPre = n('arctic:colonies').length; away(me);
        state.race.status = 'racing'; me.raceState.finished = false;
        const bot = state.boats[1]; bot.x = C[0].home.x; bot.y = C[0].home.y; Wildlife.update(1 / 30); out.colBot = n('arctic:colonies').length; away(bot);
        me.x = C[0].home.x + 500; me.y = C[0].home.y; Wildlife.update(1 / 30); out.colFar = Wildlife.debug().visited.includes('emperor') ? 1 : 0;   // (a drifting Adélie floe may be near; the emperors must not count)
        for (const c of C) { me.x = c.home.x; me.y = c.home.y; Wildlife.update(1 / 30); }
        const G = Wildlife.debug().floeGroups.find(g => g.birds.length); me.x = G.floe.x; me.y = G.floe.y; Wildlife.update(1 / 30);
        out.colVals = n('arctic:colonies').map(e => e.value).join(','); away(me);
        // the glacier face
        const fresh = () => { state.race.status = 'finished'; checkArcticRun(); state.race.status = 'racing'; me.raceState.finished = false; };
        const f57 = state.course.props.find(q => q.id === 'prop-59');
        fresh(); me.x = f57.x - 400; me.y = f57.y + 250; checkArcticRun(); out.faceFar = n('arctic:face').length;
        fresh(); me.x = f57.x - 200; me.y = f57.y + 150; checkArcticRun(); out.faceNear = n('arctic:face').length;
        // ice contact
        fresh(); GameEvents.emit('player-contact', { leg: 1, isFloe: false, ice: false }); out.granite = n('arctic:iced').length;
        GameEvents.emit('player-contact', { leg: 1, isFloe: true, ice: true }); out.floe = n('arctic:iced').length;
        out.floeStyle = state.course.islands.filter(s => s.isFloe).every(s => s.style === 'ice') && state.course.islands.filter(s => /granite/.test(s.kind || '')).every(s => s.style !== 'ice');
        const A = Unlocks.ACHIEVEMENTS.filter(a => a.venue === 'arctic'); out.rows = A.map(a => a.char).join(',');
        const base = { venue: 'arctic', finished: true, feats: [], vals: {} }, T = (ch, o) => A.find(a => a.char === ch).test(Object.assign({}, base, o));
        out.tiny = T('Tiny', {}) && !T('Tiny', { feats: ['arctic:iced'] });
        out.grin = T('Grin', { vals: { 'arctic:colonies': 4 } }) && !T('Grin', { vals: { 'arctic:colonies': 3 } });
        out.spike = T('Spike', { feats: ['arctic:face'] }) && !T('Spike', {});
        return out;
    });
    ok(r.pods === '4,3,5', `three orca pods (${r.pods})`);
    ok(r.colonies === 'emperor:18,gentoo:7,gentoo:6,macaroni:18' && r.onShape, `four fixed colonies on their shapes (${r.colonies})`);
    ok(r.floeGroups >= 5 && r.seals === 4 && r.terns === 5, `Adélies on ${r.floeGroups} floes, ${r.seals} leopard seals, ${r.terns} tern flocks`);
    ok(r.randomCalls === 0, `wildlife never calls Math.random (${r.randomCalls})`);
    ok(r.dry === 0 && r.surf > 300, `orcas stay off land (${r.dry}) and surface (${r.surf} member-frames)`);
    ok(r.tobogganing, 'Adélies toboggan to the floe edge from a close boat, one after another');
    ok(r.slid, 'and are in the water swimming a few seconds later');
    ok(!r.underIce.orca && !r.underIce.orcaUp && r.underIce.seal === 0 && r.underIce.penguin === 0, `in ten minutes with the pack drifting: no orca under rock or fixed ice (${r.underIce.orca}) or surfacing under a floe (${r.underIce.orcaUp || 0}); no seal (${r.underIce.seal}) or penguin (${r.underIce.penguin}) under any ice, floes included — of ${r.seen} checks`);
    ok(r.shared === 0, `no penguin ever shares a floe with a leopard seal (${r.shared})`);
    ok(/emperor:out\/slide/.test(r.treks) && /gentoo:out\/walk/.test(r.treks) && /macaroni:out\/walk/.test(r.treks) && /:in\/walk/.test(r.treks), `parties go to sea and come back: emperors toboggan on the ice, gentoos and macaronis walk the rock (${r.treks})`);
    ok(['adelie', 'emperor', 'gentoo', 'macaroni'].every(x => r.swimSp.includes(x)), `all four species swim (${r.swimSp})`);
    ok(r.colPre === 0 && r.colBot === 0 && r.colFar === 0, 'Four Colonies: not before the gun, not a bot, not from 500 u');
    ok(r.colVals === '1,2,3,4', `each species counts once (${r.colVals})`);
    ok(r.faceFar === 0 && r.faceNear === 1, 'the glacier face: within 350 u only');
    ok(r.granite === 0 && r.floe === 1 && r.floeStyle, 'iced: ice contact counts, granite does not');
    ok(r.rows === 'Bluff,Tiny,Spike,Pebble,Fathom,Grin', `six Glacier Sound rows (${r.rows})`);
    ok(r.tiny && r.grin && r.spike, 'Tiny clean, Grin four colonies, Spike the face');
    ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
    await b.close();
    console.log(fails ? `\nFAIL — ${fails} failure(s)` : '\nPASS — 0 failure(s)');
    process.exit(fails ? 1 : 0);
})();
