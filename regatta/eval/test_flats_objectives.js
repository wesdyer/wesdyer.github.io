// SPOONBILL FLATS — the venue's objectives (and, as they land, its wildlife). Headless, real page.
//
//   node regatta/eval/test_flats_objectives.js     (from the repo root)
//
// (test_flats.js is the tide itself.) Checks: the six rows read what they should; the flats and
// the passages are read off the player's track (Wes's own Sep 16 laps: the wantij in all three,
// 35 s+ over the flats); a grounding is a feat, costs the clean star, and fires the banner it
// always meant to (window.GameEvents was never defined — GameEvents is a top-level const);
// a passage is named as you sail onto it; nothing before the gun; no feats for a bot.
const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  FAIL ' + m); } else console.log('  ok   ' + m); };
(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForFunction(() => window.state && window.Tide && typeof resetGame === 'function');
    const trajs = fs.readdirSync('regatta/eval/rl/traj').filter(f => /^traj_flats_/.test(f)).map(f => JSON.parse(fs.readFileSync('regatta/eval/rl/traj/' + f, 'utf8')).samples.map(q => [q[0], q[2], q[3]]));
    const r = await p.evaluate((trajs) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'flats', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
        selectVenue('flats'); resetGame(); startRace();
        const out = {}, feats = []; GameEvents.on('player-feat', (e) => feats.push(e));
        const me = state.boats[0];
        for (let i = 0; i < 30 * 12; i++) update(1 / 30);
        // THE ROWS
        const A = Unlocks.ACHIEVEMENTS.filter(a => a.venue === 'flats'); out.rows = A.map(a => a.char + ':' + a.rung).join(',');
        const base = { venue: 'flats', finished: true, feats: [], vals: {} }, T = (ch, o, c) => A.find(a => a.char === ch).test(Object.assign({}, base, o), c || { venues: {} });
        out.skitter = T('Skitter', { vals: { 'flats:mud': 50 } }) && !T('Skitter', { vals: { 'flats:mud': 49.5 } }) && !T('Skitter', { vals: { 'flats:mud': 70 }, feats: ['flats:aground'] });
        const six = ['wantij', 'gamble', 'neck', 'creek', 'headcut', 'delta'];
        out.scythe = T('Scythe', {}, { venues: { flats: { routes: six } } }) && !T('Scythe', {}, { venues: { flats: { routes: six.slice(1).concat(['pointbar']) } } });
        out.scytheProg = A.find(a => a.char === 'Scythe').progress({ venues: { flats: { routes: ['wantij', 'pointbar', 'neck'] } } }).join('/');
        out.zee = T('Zee', { feats: ['flats:seals'] }) && !T('Zee', {});
        out.target = (VenueDoc.get('flats').records || {}).provisional;
        // THE TRACK: Wes's laps replayed through the check
        out.wes = [];
        for (const S of trajs) {
            feats.length = 0; state.race.status = 'finished'; checkFlatsRun(0); state.race.status = 'racing'; me.raceState.finished = false;
            let last = S[0][0];
            for (const [t, x, y] of S) { me.x = x; me.y = y; me.aground = false; state.race.timer = t; checkFlatsRun(Math.max(0, t - last)); last = t; }
            const mud = feats.filter(e => e.id === 'flats:mud').map(e => e.value).pop() || 0;
            out.wes.push({ mud, routes: feats.filter(e => /^flats:route:/.test(e.id)).map(e => e.id.slice(12)) });
        }
        // the channel is not the flats: sit in the deep water, nothing
        feats.length = 0; state.race.status = 'finished'; checkFlatsRun(0); state.race.status = 'racing';
        { let best = null; for (let k = 0; k < 4000 && !best; k++) { const x = -2000 + (k * 97) % 4000, y = -9000 + ((k * 389) % 15000); if (Tide.groundAt(x, y) < -2.2 && !pointOnLand(x, y)) best = [x, y]; }
          me.x = best[0]; me.y = best[1]; for (let i = 0; i < 300; i++) checkFlatsRun(1 / 30); out.channel = feats.length; }
        // THE BANNER: onto a passage's flat, named
        hideRaceMessage(); state.race.status = 'finished'; checkFlatsRun(0); state.race.status = 'racing';
        { const P = state.course.doc.tide.passages.find(q => q.id === 'neck'); let hp = null, bz = -9;
          for (let i = 1; i < P.pts.length; i++) for (let u = 0; u <= 1; u += 0.05) { const x = P.pts[i - 1][0] + (P.pts[i][0] - P.pts[i - 1][0]) * u, y = P.pts[i - 1][1] + (P.pts[i][1] - P.pts[i - 1][1]) * u, z = Tide.groundAt(x, y); if (z > bz) { bz = z; hp = [x, y]; } }
          me.x = hp[0]; me.y = hp[1]; me.aground = false; checkFlatsRun(1 / 30); out.banner = UI.message && !UI.message.classList.contains('hidden') ? UI.message.textContent : ''; }
        // A GROUNDING: the feat, the touch, the clean star
        feats.length = 0; const t0 = Tide.touches(me.raceState);
        { let dry = null; for (let k = 0; k < 6000 && !dry; k++) { const x = -2400 + (k * 131) % 4800, y = -10000 + ((k * 577) % 16000); if (!pointOnLand(x, y) && Tide.groundAt(x, y) > Tide.level() - 0.2) dry = [x, y]; }
          me.aground = false; me.x = dry[0]; me.y = dry[1]; Tide.afterMove(me, dry[0], dry[1], 1 / 30); }
        out.touched = Tide.touches(me.raceState) - t0; out.agFeat = feats.some(e => e.id === 'flats:aground');
        const facts = Series.raceFacts(me.raceState, 1); out.clean = facts.clean; out.why = facts.missed && facts.missed.why;
        out.cleanElsewhere = Series.raceFacts({ totalPenalties: 0, legRanks: [1] }, 1).clean;
        // AFTER THE FINISH: no thump, no banner (the boat drifts on past the line behind the debrief)
        { let heard = 0; const off = GameEvents.on ? null : null; const h = () => heard++; GameEvents.on('player-aground', h);
          me.raceState.finished = true; me.aground = false; let dry = null; for (let k = 0; k < 6000 && !dry; k++) { const x = -2400 + (k * 131) % 4800, y = -10000 + ((k * 577) % 16000); if (!pointOnLand(x, y) && Tide.groundAt(x, y) > Tide.level() - 0.2) dry = [x, y]; }
          me.x = dry[0]; me.y = dry[1]; Tide.afterMove(me, dry[0], dry[1], 1 / 30); out.afterFinish = heard; me.raceState.finished = false; me.aground = false; }
        // BEFORE THE GUN, and a bot
        feats.length = 0; state.race.status = 'prestart'; me.aground = false; for (let i = 0; i < 60; i++) checkFlatsRun(1 / 30); out.pre = feats.length; state.race.status = 'racing';
        out.botTouch = (() => { const bot = state.boats[1]; const n0 = feats.length; bot.aground = false; const q = [me.x, me.y]; bot.x = q[0]; bot.y = q[1]; Tide.afterMove(bot, q[0], q[1], 1 / 30); return feats.length - n0; })();
        // THE CAREER: a finished race's passages join the venue's set (several a race)
        { state.race.unlocks = state.race.unlocks || {}; state.race.unlocks.feats = { 'flats:route:neck': 1, 'flats:route:delta': 1, 'flats:mud': 1 }; state.race.unlocks.vals = {};
          me.raceState.finished = true; me.raceState.finishTime = 200; me.raceState.resultStatus = null;
          Unlocks._count([me], {}); out.career = ((Unlocks.career().venues.flats || {}).routes || []).slice().sort().join(','); me.raceState.finished = false; }
        // THE WILDLIFE: grey seals, roseate spoonbills, pied avocets, shore crabs — all on the tide
        const W = Wildlife.debug(); for (const o of state.boats) if (!o.isPlayer) { o.x = 1e6; o.y = 1e6; }
        out.cast = [W.gsealCols.length, W.spoonFlocks.length, W.avoFlocks.length, W.scrabBeds.length].join(',');
        const real = Math.random; let calls = 0, counting = false; Math.random = () => { if (counting) calls++; return real(); };
        const wu = Wildlife.update; me.x = 1e6; me.y = 1e6;
        let jumpMax = 0, landBirds = 0, landCrabs = 0, lowHauled = 0, highHauled = 0, lowN = 0, highN = 0, sealsDry = 0;
        for (let i = 0; i < 30 * 70; i++) { counting = true; wu(1 / 30); counting = false; update(1 / 30); if (i % 10) continue;
            const L = Tide.level();
            for (const F of W.spoonFlocks.concat(W.avoFlocks)) if (!F.roosting && F.mode === 'feed') for (const bd of F.birds) if (bd.mode === 'wade' && pointOnLand(bd.x, bd.y)) landBirds++;
            for (const F of W.spoonFlocks.concat(W.avoFlocks)) for (const bd of F.birds) { if (bd._px != null) jumpMax = Math.max(jumpMax, Math.hypot(bd.x - bd._px, bd.y - bd._py) / 10); bd._px = bd.x; bd._py = bd.y; }
            for (const B of W.scrabBeds) for (const q of B.crabs) if (pointOnLand(q.x, q.y)) landCrabs++;
            const h = W.gsealCols.reduce((n, C) => n + C.seals.filter(sl => sl.mode === 'haul').length, 0);
            if (L < -0.7) { lowHauled += h; lowN++; } if (L > 0.7) { highHauled += h; highN++; }
            for (const C of W.gsealCols) for (const sl of C.seals) if (sl.mode === 'swim' && Tide.depthAt(sl.x, sl.y) < 0) sealsDry++; }
        Math.random = real; out.calls = calls;
        // NOTHING POPS: over a whole tide cycle, frame by frame, a crab's visibility (depth fade x burial) and a seal's
        // lying/swimming crossfade change smoothly
        { const vis = (q) => { const d = Tide.depthAt(q.x, q.y), u = Math.max(0, Math.min(1, (d - 0.02) / 0.83)); return (1 - u * u * (3 - 2 * u)) * (1 - (q.bur || 0)); };
          let crabJump = 0, sealJump = 0; const cr = W.scrabBeds.flatMap(B => B.crabs).slice(0, 120), sl = W.gsealCols.flatMap(C => C.seals);
          let pv = cr.map(vis), pb = sl.map(q => q.blend || 0);
          // (the crab beds only move while on camera: put the camera on each bed in turn)
          for (let i = 0; i < 30 * 62; i++) { const B = W.scrabBeds[Math.floor(i / 60) % W.scrabBeds.length]; state.camera = { x: B.cx, y: B.cy, rotation: 0 };
            wu(1 / 30); update(1 / 30);
            const v = cr.map(vis), bl = sl.map(q => q.blend || 0);
            v.forEach((x, k) => { crabJump = Math.max(crabJump, Math.abs(x - pv[k])); }); bl.forEach((x, k) => { sealJump = Math.max(sealJump, Math.abs(x - pb[k])); });
            pv = v; pb = bl; }
          out.crabJump = +crabJump.toFixed(3); out.sealJump = +sealJump.toFixed(3);
          out.crabsUnder = cr.filter(q => Tide.depthAt(q.x, q.y) > 0.1 && !q.stay).length; }
        out.landBirds = landBirds; out.jumpMax = +jumpMax.toFixed(1); out.landCrabs = landCrabs; out.sealsDry = sealsDry;
        out.lowHauled = lowN ? lowHauled / lowN : 0; out.highHauled = highN ? highHauled / highN : 0;
        out.sealTotal = W.gsealCols.reduce((n, C) => n + C.seals.length, 0);
        // KEEP YOUR DISTANCE: stand off a hauled colony in the channel, between the flush ring and the watch ring
        const sc = Wildlife.WILDLIFE.flats.greySeals, C0 = W.gsealCols[0];
        const watch = (dist, status) => {
            Tide.setOverride(-0.9); for (const sl of C0.seals) { sl.mode = 'haul'; sl.x = sl.hx; sl.y = sl.hy; }
            let spot = null;
            for (let k = 0; k < 72 && !spot; k++) { const a = k / 72 * 6.283, x = C0.cx + Math.cos(a) * dist, y = C0.cy + Math.sin(a) * dist;
                if (Tide.depthAt(x, y) > 0.8 && C0.seals.every(sl => Math.hypot(sl.x - x, sl.y - y) > sc.flushR + 5)) spot = [x, y]; }
            if (!spot && dist < sc.flushR) { const a = 0; spot = [C0.cx + dist, C0.cy]; }
            state.race.status = status; me.raceState.finished = false; me.x = 1e6; me.y = 1e6; for (let i = 0; i < 30; i++) Wildlife.update(1 / 30);
            const n0 = feats.filter(e => e.id === 'flats:seals').length;
            me.x = spot[0]; me.y = spot[1]; me.aground = false; for (let i = 0; i < 30 * 5; i++) Wildlife.update(1 / 30);
            me.x = 1e6; me.y = 1e6; Tide.setOverride(null);
            return feats.filter(e => e.id === 'flats:seals').length - n0; };
        out.sealPre = watch(360, 'prestart'); out.sealClose = watch(60, 'racing'); out.sealOk = watch(360, 'racing');
        state.race.status = 'racing';
        // the minimap labels draw
        try { const c = document.createElement('canvas'); c.width = 160; c.height = 160; Tide.drawMinimapLabels(c.getContext('2d'), state.boats[0].x, state.boats[0].y, 0.01, 160, 160); out.labels = true; } catch (e) { out.labels = e.message; }
        return out;
    }, trajs);
    ok(r.rows === 'Petal:first-win,Skitter:mechanic,Scythe:explorer,Curl:target,Rake:four-stars,Zee:wildlife', `the six rows (${r.rows})`);
    ok(r.skitter, 'Mud Runner: 50 s over the flats, never aground (not 49.5 s, not with a grounding)');
    ok(r.scythe, 'Chart the Flats: all six named passages across races (a point bar is not one of them)');
    ok(r.scytheProg === '2/6', `Chart the Flats shows its progress (${r.scytheProg})`);
    ok(r.zee, 'Keep Your Distance reads flats:seals');
    ok(r.target === 195, `the target is 3:15 (${r.target})`);
    ok(r.wes.every(w => w.routes.some(q => ['wantij', 'gamble', 'neck', 'creek', 'headcut', 'delta'].includes(q))), `each of Wes's laps sailed a named passage (${r.wes.map(w => w.routes.join('+')).join(' | ')})`);
    ok(r.wes.every(w => w.mud >= 35 && w.mud < 70), `...and 35-70 s over the flats (${r.wes.map(w => w.mud).join(', ')})`);
    ok(r.channel === 0, `the deep channel is not the flats (${r.channel} feats)`);
    ok(/NECK/.test(r.banner), `a passage is named as you sail onto it ("${r.banner}")`);
    ok(r.touched === 1 && r.agFeat, 'a grounding is counted and is a feat (flats:aground)');
    ok(r.clean === false && r.why === 'running aground', `...and costs the clean star (${r.why})`);
    ok(r.cleanElsewhere === true, 'a race with no penalty and no grounding is still clean');
    ok(r.pre === 0, 'nothing before the gun');
    ok(r.afterFinish === 0, `no aground thump or banner after you finish (${r.afterFinish})`);
    ok(r.botTouch === 0, 'a bot running aground is not the player\'s feat');
    ok(/delta/.test(r.career) && /neck/.test(r.career), `a finished race's passages join the career (${r.career})`);
    ok(r.cast.split(',').every(x => +x > 0), `grey seal colonies, spoonbill flocks, avocet flocks, crab beds (${r.cast})`);
    ok(r.calls === 0, `the Flats' wildlife never calls Math.random (${r.calls})`);
    ok(r.lowHauled > r.sealTotal * 0.6 && r.highHauled < r.sealTotal * 0.15, `seals haul out at low water and are in the sea at high (${r.lowHauled.toFixed(1)} vs ${r.highHauled.toFixed(1)} of ${r.sealTotal})`);
    ok(r.sealsDry === 0, `a swimming seal is always in the water (${r.sealsDry})`);
    ok(r.jumpMax < 8, `a wader never jumps — it flies, walks or hops (the most any moved in a frame: ${r.jumpMax} u; the loop steps the wildlife twice a frame, so top flight speed reads 5)`);
    ok(r.landBirds === 0, `feeding waders are never on the marsh (${r.landBirds} samples; they roost there only at high water)`);
    ok(r.landCrabs === 0, `crabs never on the marsh (${r.landCrabs})`);
    ok(r.crabJump < 0.12 && r.sealJump < 0.12, `nothing pops with the tide: the largest one-frame change in a crab's visibility ${r.crabJump}, a seal's crossfade ${r.sealJump}`);
    ok(r.sealOk === 1, 'Keep Your Distance: standing off a hauled colony, 360 u from its centre, earns it');
    ok(r.sealClose === 0, 'sailing into the colony (it flushes) does not');
    ok(r.sealPre === 0, 'nor before the gun');
    ok(r.labels === true, `the passages are labelled on the minimap (${r.labels})`);
    ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
    await b.close();
    console.log(fails ? `\nFAIL — ${fails} failure(s)` : '\nPASS — 0 failure(s)');
    process.exit(fails ? 1 : 0);
})();
