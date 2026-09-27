// CLUBHOUSE POINT — the venue's objectives and its picture-only wildlife. Headless, real page.
//
//   node regatta/eval/test_seatrials.js     (from the repo root)
//
// The eval anchor: its course, wind and conditions never change, and the wildlife must not touch a race —
// the same seeded race with and without it is identical, boat for boat. Nothing sits on a mark (Wes). Checks the six rows; Every Can read
// off Wes's own laps (6 of 27 would have earned it); Same Every Week reads the last three Point results;
// Under the Birds under a working boil (not a bot, not before the gun); boils never at the bottom gate while
// the start is near; no Math.random.
const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  FAIL ' + m); } else console.log('  ok   ' + m); };
(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync('regatta/eval/eval_harness.js', 'utf8') }); await p.waitForTimeout(400);
    const trajs = fs.readdirSync('regatta/eval/rl/traj').filter(f => /^traj_seatrials_/.test(f)).map(f => JSON.parse(fs.readFileSync('regatta/eval/rl/traj/' + f, 'utf8')).samples.map(q => [q[0], q[2], q[3]]));
    // PICTURE ONLY: one seeded race with and without the wildlife
    const race = (withWild) => p.evaluate((withWild) => { const saved = Wildlife.WILDLIFE.seatrials; if (!withWild) delete Wildlife.WILDLIFE.seatrials;
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'seatrials' })); window.evalHarness.seed = 11; resetGame(); startRace();
        let h = 0; const hs = (v) => { h = (Math.imul(h ^ Math.round(v * 1000), 2654435761) >>> 0); };
        for (let it = 0; it < 60 * 120; it++) { update(1 / 60); if (it % 30) continue; for (const bt of state.boats) { hs(bt.x); hs(bt.y); hs(bt.heading); hs(bt.speed); } }
        Wildlife.WILDLIFE.seatrials = saved; return h; }, withWild);
    const hWith = await race(true), hWithout = await race(false);
    ok(hWith === hWithout, `the wildlife is picture only: a race with and without it is identical (${hWith} / ${hWithout})`);
    const r = await p.evaluate((trajs) => { delete window.evalHarness;
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'seatrials', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
        selectVenue('seatrials'); resetGame(); startRace();
        const out = {}, feats = []; GameEvents.on('player-feat', (e) => feats.push(e.id));
        const me = state.boats[0];
        for (let i = 0; i < 30 * 12; i++) update(1 / 30);
        const A = Unlocks.ACHIEVEMENTS.filter(a => a.venue === 'seatrials'); out.rows = A.map(a => a.char + ':' + a.rung).join(',');
        const base = { venue: 'seatrials', finished: true, feats: [], vals: {} }, T = (ch, o, c) => A.find(a => a.char === ch).test(Object.assign({}, base, o), c || { venues: {} });
        const cv = (q) => ({ venues: { seatrials: { recent: q } } });
        out.latch = T('Latch', {}, cv([190, 191.5, 192.9])) && !T('Latch', {}, cv([190, 191.5, 193.1])) && !T('Latch', {}, cv([190, null, 190.5])) && !T('Latch', {}, cv([190, 190.5]));
        out.lateen = T('Lateen', { feats: ['seatrials:everycan'] }) && !T('Lateen', {});
        out.flicker = T('Flicker', { feats: ['seatrials:birds'] }) && !T('Flicker', {});
        out.target = (VenueDoc.get('seatrials').records || {}).provisional;
        // EVERY CAN on Wes's laps
        out.wes = 0;
        for (const S of trajs) { feats.length = 0; state.race.status = 'finished'; checkSeaTrialsRun(); state.race.status = 'racing'; me.raceState.finished = false;
            for (const [t, x, y] of S) { if (t < 0) continue; me.x = x; me.y = y; checkSeaTrialsRun(); }
            if (feats.includes('seatrials:everycan')) out.wes++; }
        out.wesN = trajs.length;
        // one lap on the right only: no
        feats.length = 0; state.race.status = 'finished'; checkSeaTrialsRun(); state.race.status = 'racing';
        const path2 = [[300, 200], [300, -200], [400, -3800], [400, -4200], [700, -4200], [400, -3800], [300, -200], [300, 200], [400, -3800], [400, -4200], [700, -4200], [300, 200]];
        for (let k = 0; k < path2.length - 1; k++) for (let i = 0; i <= 20; i++) { me.x = path2[k][0] + (path2[k + 1][0] - path2[k][0]) * i / 20; me.y = path2[k][1] + (path2[k + 1][1] - path2[k][1]) * i / 20; checkSeaTrialsRun(); }
        out.oneSide = feats.includes('seatrials:everycan');
        // the WILDLIFE
        const W = Wildlife.debug(); for (const o of state.boats) { o.x = 1e6; o.y = 1e6; }
        out.cast = [W.clubCorms.length, W.velFleets.length, W.mackBoils.length, W.clubTerns.length, W.clubGulls.length].join(',');
        const marks = state.course.marks; let onMark = 0, lane = 0, dived = 0, flew = 0, ternMax = 0;
        const real = Math.random; let calls = 0, counting = false; Math.random = () => { if (counting) calls++; return real(); };
        // boils: sites while the start is near (timer < 90) never at the bottom gate
        let bottomEarly = 0, flankOrGate = 0, sites = 0;
        state.race.timer = 0;
        for (let i = 0; i < 30 * 240; i++) { counting = true; Wildlife.update(1 / 30); counting = false; state.race.timer += 1 / 30;
            for (const G of W.clubGulls) for (const gb of G.birds) if (gb.mode === 'float' && marks.some(m => Math.hypot(gb.x - m.x, gb.y - m.y) < 120)) onMark++;
            for (const cm of W.clubCorms) { if (cm.mode !== 'fly' && cm.mode !== 'takeoff' && marks.some(m => Math.hypot(cm.x - m.x, cm.y - m.y) < 120)) onMark++; if (cm.mode === 'under') dived++; if (cm.mode === 'fly') flew++; }
            for (const tb of W.clubTerns) { if (tb._px != null) ternMax = Math.max(ternMax, Math.hypot(tb.x - tb._px, tb.y - tb._py) * 30); tb._px = tb.x; tb._py = tb.y; }
            for (const B of W.mackBoils) if (B.mode === 'boil' && B._seen !== B.x) { B._seen = B.x; sites++; const bottom = Math.abs(B.x) < 400 && B.y > -300 && B.y < 600, gate = Math.abs(B.x) < 400 && B.y < -4000, flank = Math.abs(B.x) > 2500 && Math.abs(B.x) < 3150;
                if (bottom && state.race.timer < 90) bottomEarly++; if (bottom || gate || flank) flankOrGate++; } }
        Math.random = real; out.calls = calls; out.onMark = onMark; out.lane = lane; out.ternMax = Math.round(ternMax); out.dived = dived; out.flew = flew; out.bottomEarly = bottomEarly; out.sites = sites; out.flankOrGate = flankOrGate;
        // GULLS: a boat within five lengths (275 u) puts a raft up; one at 320 u does not; they settle on new water
        { const G = W.clubGulls[0]; for (const gb of G.birds) { gb.mode = 'float'; gb.x = G.cx + (gb.x - G.cx) * 0.2; gb.y = G.cy + (gb.y - G.cy) * 0.2; }
          const c0 = { x: G.cx, y: G.cy };
          me.x = c0.x + 320; me.y = c0.y; for (let i = 0; i < 30; i++) Wildlife.update(1 / 30); out.gullFar = G.birds.every(gb => gb.mode === 'float');
          me.x = c0.x + 240; for (let i = 0; i < 30; i++) Wildlife.update(1 / 30); out.gullUp = G.birds.some(gb => gb.mode !== 'float');
          me.x = 1e6; me.y = 1e6; for (let i = 0; i < 30 * 40; i++) Wildlife.update(1 / 30);
          out.gullDown = G.birds.every(gb => gb.mode === 'float'); out.gullMoved = Math.round(Math.hypot(G.cx - c0.x, G.cy - c0.y)); }
        // UNDER THE BIRDS: under a working boil, while racing — not before the gun, not a bot
        const under = (status, who) => { const B = W.mackBoils[0]; B.mode = 'boil'; B.k = 1; B.t = 30; B.x = 3000; B.y = -2000;
            for (const t of W.clubTerns) { t.x = B.x + 20; t.y = B.y; t.mode = 'hover'; t.t = 5; }
            state.race.status = status; me.raceState.finished = false; feats.length = 0;
            const bt = who === 'bot' ? state.boats[1] : me; bt.x = B.x + 30; bt.y = B.y; for (let i = 0; i < 30 * 2; i++) Wildlife.update(1 / 30); bt.x = 1e6; bt.y = 1e6; return feats.includes('seatrials:birds'); };
        out.birdsPre = under('prestart', 'me'); out.birdsBot = under('racing', 'bot'); out.birdsOk = under('racing', 'me');
        // ON SCREEN means the whole canvas, at any camera rotation: a point in each corner of a rotated wide view
        { const cv = canvas, oc = state.camera; state.camera = { x: 0, y: 0, rotation: 0.7 }; let miss = 0;
          for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const px = sx * cv.width / 2 * 0.97, py = sy * cv.height / 2 * 0.97, c = Math.cos(0.7), s2 = Math.sin(0.7);
            const wx = px * c - py * s2, wy = px * s2 + py * c; if (!Wildlife.art.onCam(wx, wy, 0)) miss++; }
          state.camera = oc; out.cornerMiss = miss; out.canvas = cv.width + 'x' + cv.height; }
        return out;
    }, trajs);
    ok(r.rows === 'Sable:first-win,Latch:mechanic,Lateen:explorer,Flash:target,Skerry:four-stars,Flicker:wildlife', `the six rows (${r.rows})`);
    ok(r.latch, 'Same Every Week: three Point finishes in a row within 3.0 s (not 3.1, not with a DNF between, not two)');
    ok(r.lateen && r.flicker, 'Every Can and Under the Birds read their feats');
    ok(r.target === 210, `the target is 3:30 (${r.target})`);
    ok(r.wes === 6, `Every Can: ${r.wes} of Wes's ${r.wesN} laps would have earned it (6 measured at design)`);
    ok(r.oneSide === false, 'both laps round the same top mark: not Every Can');
    ok(r.cast.split(',').every(x => +x > 0), `cormorants, velella fleets, mackerel boils, terns, gull rafts (${r.cast})`);
    ok(r.ternMax <= 60, `no tern ever moves faster than a tern flies, even when the boil moves (fastest ${r.ternMax} u/s; the hover used to slide at 1,000+)`);
    ok(r.onMark === 0, `no cormorant or gull ever sits on or by a mark (Wes: it hides them) (${r.onMark})`);
    ok(r.dived > 0 && r.flew > 0, `cormorants dive and fly (${r.dived} / ${r.flew} samples)`);
    ok(r.calls === 0, `the wildlife never calls Math.random (${r.calls})`);
    ok(r.sites > 4 && r.bottomEarly === 0, `no boil at the bottom gate while the start is near (${r.bottomEarly} of ${r.sites} boils)`);
    ok(r.flankOrGate === r.sites, `boils only on the flanks or just past a gate (${r.flankOrGate} of ${r.sites})`);
    ok(r.gullFar && r.gullUp, 'a boat within five boat lengths puts the gulls up; one at 320 u does not');
    ok(r.gullDown && r.gullMoved >= 300, `they settle again on new water (${r.gullMoved} u away)`);
    ok(r.birdsOk === true && r.birdsPre === false && r.birdsBot === false, 'Under the Birds: the player under a working boil while racing — not before the gun, not a bot');
    ok(r.cornerMiss === 0, `an animal in any corner of a rotated ${r.canvas} view counts as on screen — never culled while visible (Wes: 'the terns just disappear') (${r.cornerMiss} corners missed)`);
    ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
    await b.close();
    console.log(fails ? `\nFAIL — ${fails} failure(s)` : '\nPASS — 0 failure(s)');
    process.exit(fails ? 1 : 0);
})();
