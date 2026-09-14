// Emberfall Isle's weather (js/volcano.js): the eruption cycle, the plume's dead air, the
// vent boils, and lightning that fries a boat's electronics. Drives the real game in a
// headless page, the way test_render does, so the hooks in wind, physics, the bots and the
// HUD are exercised where they live.
//
// Usage: node regatta/eval/test_volcano.js   (from the repo root, like every suite)
const { chromium } = require('playwright');
const path = require('path');

let failures = 0;
const check = (name, cond, detail) => {
    console.log(`  ${cond ? 'ok   ' : 'FAIL '} ${name}${cond || !detail ? '' : ' — ' + detail}`);
    if (!cond) failures++;
};

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errs = [];
    page.on('pageerror', e => errs.push(e.message.split('\n')[0]));
    await page.goto('file://' + path.resolve('regatta/index.html'));
    await page.evaluate(() => localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'volcanic' })));
    await page.reload();
    await page.waitForTimeout(700);

    const r = await page.evaluate(() => {
        window.requestAnimationFrame = () => 0;
        let s = 90210;
        Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
        const out = { problems: [] };
        const attempt = (label) => { try { draw(); } catch (e) { out.problems.push(`${label}: ${e.message}`); } };
        resetGame();
        state.race.seed = 4242;
        // A seabed vent for the boil, whether or not the document places one.
        state.course.props.push({ id: 'test-vent', kind: 'volcanic-vent-underwater', x: state.boats[0].x + 600, y: state.boats[0].y,
                                  heading: 0, scale: 1, plane: 'seabed', motion: 'fixed', contact: 'none' });
        state.course._propGrid = null;
        // The front finder on a synthetic lava square (its own interior is not in the course,
        // so every stride finds water on one side or the other): about eight sources.
        const p0 = state.boats[0];
        const sq = 260, lx = p0.x - 900, ly = p0.y - 900;
        const fake = { id: 'test-lava', lava: true, x: lx, y: ly, radius: sq, awash: false,
            vertices: [{ x: lx - sq / 2, y: ly - sq / 2 }, { x: lx + sq / 2, y: ly - sq / 2 }, { x: lx + sq / 2, y: ly + sq / 2 }, { x: lx - sq / 2, y: ly + sq / 2 }] };
        out.frontsSynthetic = Volcano.lavaFronts({ islands: [fake] }).length;
        Volcano.init();
        const v = state.volcano;
        out.active = !!v;
        if (!v) return out;
        out.cones = v.cones.filter(c => !c.steam).length;
        out.vents = v.vents.length;
        out.fronts = v.fronts.length;
        // Determinism: the same seed deals the same cycle.
        const deal = v.cones.map(c => [c.period.toFixed(3), c.phase.toFixed(4)].join('/')).join(',');
        Volcano.init();
        out.sameDeal = deal === state.volcano.cones.map(c => [c.period.toFixed(3), c.phase.toFixed(4)].join('/')).join(',');
        const V = state.volcano;
        const cone = V.cones.find(c => !c.steam);
        const vent = V.vents[0];
        const player = state.boats[0];
        window.__p0 = { x: player.x, y: player.y };
        startRace();
        // Quiet: the wisp costs nothing.
        for (let i = 0; i < 180; i++) update(1 / 60);
        const q = VOLCANO;
        const quiet = cone.period - q.build - q.peak - q.wane;
        const inQuiet = (c) => ((V.t / c.period + c.phase) % 1) * c.period < quiet;
        settings.soundEnabled = true; settings.bgSoundEnabled = true;
        Sound._lastEruptionOnset = null;
        // Force this cone into its PEAK now, then run twelve seconds of eruption.
        cone.phase = (((quiet + q.build + 1) - V.t) / cone.period) % 1;
        if (cone.phase < 0) cone.phase += 1;
        for (let i = 0; i < 720; i++) update(1 / 60);
        out.intensity = cone.intensity;
        out.heat = cone.p.heat; out.activity = cone.p.activity;   // must stay untouched
        out.parcels = cone.parcels.length;
        out.laze = V.laze.length;
        out.lazeNearFront = V.laze.length ? Math.min(...V.laze.map(q => Math.min(...V.fronts.map(f => Math.hypot(q.x - f.x, q.y - f.y))))) : -1;
        out.onset = Sound._lastEruptionOnset;
        // The rumble bed follows the nearest erupting cone: stand beside it for a few frames.
        { const px = player.x, py = player.y; for (let i = 0; i < 30; i++) { player.x = cone.x + 300; player.y = cone.y; update(1 / 60); } out.rumble = Sound._eruptionLevel; player.x = px; player.y = py; }
        // Dead air: sample along the plume — its parcels — and take the deepest hole.
        let deepest = 1, tail = 1;
        for (const p of cone.parcels) deepest = Math.min(deepest, Volcano.windMul(p.x, p.y));
        const oldest = cone.parcels.reduce((a, b) => (a && a.age > b.age) ? a : b, null);
        if (oldest) tail = Volcano.windMul(oldest.x, oldest.y);
        out.deepest = deepest; out.tail = tail; out.oldestAge = oldest ? oldest.age : 0;
        // getWindAt sees it too — sampled a few seconds down the plume, where the parcel has
        // finished fading in (a newborn one is still thin by design).
        const young = cone.parcels.reduce((a, b) => (a && Math.abs(a.age - 3) < Math.abs(b.age - 3)) ? a : b, null);
        if (young) {
            const at = getWindAt(young.x, young.y).speed, mean = regionWindAt(young.x, young.y).speed;
            out.windUnder = at; out.windMean = mean;
        }
        out.farMul = Volcano.windMul(cone.x + 40000, cone.y + 40000);
        // The boil follows the lava: broken water on the axis, out past the ends, none across.
        out.boilCore = Volcano.boilAt(vent.x, vent.y);
        const vcs = Math.cos(vent.ang), vsn = Math.sin(vent.ang);
        out.boilAlong = Volcano.boilAt(vent.x + vcs * vent.a * 0.7, vent.y + vsn * vent.a * 0.7);
        out.boilOut = Volcano.boilAt(vent.x + vcs * (vent.a + 40), vent.y + vsn * (vent.a + 40));
        out.boilAcross = Volcano.boilAt(vent.x - vsn * (vent.b + 40), vent.y + vcs * (vent.b + 40));
        out.boilShape = [Math.round(vent.a), Math.round(vent.b)];
        // The choice: a boat crossing the boil at speed is scrubbed hard; the same boat in
        // clear water is not. Two seconds each, from the same speed, sails eased.
        const trial = (x, y) => {
            player.x = x; player.y = y; player.speed = 6; player.heading = vent.ang + Math.PI / 2;   // across the crack
            for (let i = 0; i < 120; i++) { player.x = x; player.y = y; update(1 / 60); }   // held in place: pure field effect
            return player.speed;
        };
        const s0 = trial(vent.x + 20000, vent.y + 20000), s1 = trial(vent.x, vent.y);
        out.speedClear = s0; out.speedBoil = s1;
        // The router prices it: the grid's cost field is > 1 inside the ellipse.
        const grid = state.course.botGrid;
        let costIn = 0, costOut = 0;
        if (grid && grid._shoal) {
            for (let j = 0; j < grid.n; j++) for (let i = 0; i < grid.n; i++) {
                const [wx, wy] = grid.world(i, j);
                const d = Math.hypot(wx - vent.x, wy - vent.y);
                if (d < vent.b * 0.5) costIn = Math.max(costIn, grid._shoal[j * grid.n + i]);
                else if (d > vent.a + 200 && d < vent.a + 400) costOut = Math.max(costOut, grid._shoal[j * grid.n + i]);
            }
        }
        out.costIn = costIn; out.costOut = costOut; out.hasGrid = !!(grid && grid._shoal);
        out.boilMulCore = Volcano.boilMul(vent.x, vent.y); out.boilMulClear = Volcano.boilMul(vent.x + 20000, vent.y);
        // Lightning: force a strike beside the player and read the outage.
        const bot = state.boats.find(b => !b.isPlayer);
        bot.x = player.x + 120; bot.y = player.y + 40;
        const far = state.boats.find(b => !b.isPlayer && b !== bot);
        far.x = player.x + 5000; far.y = player.y + 5000;
        const mid = state.boats.find(b => !b.isPlayer && b !== bot && b !== far);
        mid.x = player.x + 100; mid.y = player.y + 480;
        // AIM: with the player under the cloud, most strikes are dealt near a boat.
        // THE STRIKERS. The aimed one lands a few hull lengths off a boat's projected
        // position; the free ones land on the course's water. Forced by zeroing the waits.
        const aimed = V.strikers.find(s => s.aimed), frees = V.strikers.filter(s => !s.aimed);
        out.strikerCount = V.strikers.length;
        let near = 0, dealt = 0, playerHits = 0;
        for (let i = 0; i < 40; i++) {
            aimed.pending = null; aimed.next = 0;
            update(1 / 60);
            if (!aimed.pending) continue;
            dealt++;
            const pd = aimed.pending;
            if (Math.hypot(pd.x - pd.px, pd.y - pd.py) <= VOLCANO.aimLengths[1] * VOLCANO.hull + 1) near++;
            if (pd.boat === player) playerHits++;
        }
        out.aimDealt = dealt; out.aimNear = near; out.playerHits = playerHits;
        let freeDealt = 0, freeWater = 0, freeInField = 0;
        const fld = squallField();
        for (let i = 0; i < 30; i++) {
            const fr = frees[i % frees.length];
            fr.pending = null; fr.next = 0;
            update(1 / 60);
            if (!fr.pending) continue;
            freeDealt++;
            if (Volcano.onWater(fr.pending.x, fr.pending.y)) freeWater++;
            if (Math.hypot(fr.pending.x - fld.cx, fr.pending.y - fld.cy) <= fld.R + 1) freeInField++;
        }
        out.freeDealt = freeDealt; out.freeWater = freeWater; out.freeInField = freeInField;
        // A clean slate for the forced strike: no pending strikers, nobody already fried, and the
        // far boat beyond any free striker's field (three of them now roam the whole course).
        for (const st of V.strikers) { st.pending = null; st.next = 99; }
        for (const b of state.boats) { V.fry.delete(b); b.fried = null; }
        far.x = player.x + 30000; far.y = player.y + 30000;
        // Lightning: force a strike beside the player and read the outage.
        aimed.pending = { ox: cone.x, oy: cone.y, x: player.x + 100, y: player.y, at: V.t, seed: 7 };
        bot.x = player.x + 120; bot.y = player.y + 40;
        mid.x = player.x + 100; mid.y = player.y + 480;
        update(1 / 60);
        // Hold the storm for the recovery clock: a 15 s outage is long enough for the
        // strikers to deal again and re-fry someone mid-measurement.
        for (const st of V.strikers) { st.pending = null; st.next = 999; }
        out.strikes = V.strikes.length;
        out.thunder = Sound._lastThunder || null;
        out.playerFried = Volcano.isFried(player);
        out.botFried = Volcano.isFried(bot);
        out.farFried = Volcano.isFried(far);
        out.midDur = Volcano.fryOf(mid) ? Volcano.fryOf(mid).dur : 0;
        out.botDur = Volcano.fryOf(bot) ? Volcano.fryOf(bot).dur : 0;
        out.hud = ['rose', 'instruments', 'timer', 'minimap', 'nav', 'leaderboard'].map(s => Volcano.hudFried(s));
        out.glitch = Volcano.glitch();
        // Drawing through the strike, the flash and the fried HUD must not throw.
        for (const aids of [false, true]) { state.showNavAids = aids; attempt(`strike aids=${aids}`); }
        for (let i = 0; i < 12; i++) { update(1 / 60); attempt(`strike +${i}`); }
        out.lbClass = document.getElementById('leaderboard') && document.getElementById('leaderboard').classList.contains('fried');
        // A fried rim indicator wanders: the same rim point maps to different places over time,
        // stays on the rim band, and a point inside the screen is left alone.
        {
            const W = canvas.width, H = canvas.height;
            const a = Volcano.friedEdgePos(ctx, W - 40, H / 2, 5);
            for (let i = 0; i < 30; i++) update(1 / 60);
            const b = Volcano.friedEdgePos(ctx, W - 40, H / 2, 5);
            const onRim = (p) => Math.abs(p.x - W / 2) >= W / 2 - 41 || Math.abs(p.y - H / 2) >= H / 2 - 41;
            const inner = Volcano.friedEdgePos(ctx, W / 2 + 100, H / 2 + 50, 5);
            out.wander = { moved: Math.hypot(a.x - b.x, a.y - b.y), rimA: onRim(a), rimB: onRim(b), innerKept: inner.x === W / 2 + 100 && inner.y === H / 2 + 50 };
        }
        out.timerFried = !!(UI.timer && UI.timer.classList.contains('fried') && !/^-?\d\d:\d\d$/.test(UI.timer.textContent));
        // One outage: the rose and the leaderboard are both down at 62% and both back after.
        const f = Volcano.fryOf(player);
        const dur = f ? f.dur : 0;
        out.fryDur = dur;
        for (let i = 0; i < Math.ceil(dur * 0.62 * 60); i++) update(1 / 60);
        out.midway = ['rose', 'leaderboard'].map(s => Volcano.hudFried(s));
        for (let i = 0; i < Math.ceil(dur * 0.5 * 60); i++) update(1 / 60);
        out.after = Volcano.isFried(player) || Volcano.isFried(bot);
        attempt('after');
        // FRIED BOTS keep sailing on their held intent (the body runs; no plan, no wind read).
        {
            const ctrl = bot.controller;
            const tick = () => { for (let i = 0; i < 7; i++) update(1 / 60); };   // > one 10 Hz body tick
            // Open water, clear of the fleet, and a clean liveness state — so what steers the
            // bot is the held intent, not an avoidance or a stuck-boat wiggle.
            const p0 = window.__p0 || { x: player.x, y: player.y };
            let placed = false;
            for (let k = 1; k <= 12 && !placed; k++) for (const ang of [0, 1.57, 3.14, 4.71]) {
                const cx = p0.x + Math.cos(ang) * 900 * k, cy = p0.y + Math.sin(ang) * 900 * k;
                if (!Volcano.onWater(cx, cy)) continue;
                if (state.boats.some(b => b !== bot && Math.hypot(b.x - cx, b.y - cy) < 1500)) continue;
                bot.x = cx; bot.y = cy; placed = true; break;
            }
            bot.speed = 4; bot.heading = 1.0;
            ctrl.lowSpeedTimer = 0; ctrl.wiggleActive = false; ctrl.clearanceTimer = 0; ctrl.wiggleTimer = 0; ctrl.livenessState = 'normal';
            // The held intent is the RACING intent of the last live tick (bot.js F3, the
            // volcano push 2026-09-13), not last tick's final heading: a dodge or an
            // avoidance deflection in flight at the strike must not be held for the outage.
            // So the live intent says 1.0 and the bent final heading says 2.0 — 1.0 is held.
            ctrl._raceIntent = 1.0; ctrl._raceIntentTick = ctrl._tickN || 0;
            ctrl.prevDesired = 2.0;
            V.fry.set(bot, { t0: V.t, dur: 6 }); bot.fried = V.fry.get(bot);
            const wt0 = ctrl.windTracker.meanDirection;
            for (let i = 0; i < 6; i++) tick();
            out.friedTicks = ctrl._friedTicks || 0;
            out.friedHeld = Math.abs(normalizeAngle(ctrl.targetHeading - 1.0)) < 0.2;
            out.friedWindFrozen = ctrl.windTracker.meanDirection === wt0;
            V.fry.delete(bot); bot.fried = null;
        }
        // NO DODGE (owner, 2026-09-13): a marked strike beside a bot does NOT bend its helm.
        // The dodge was dropped — the outage holds the racing intent and costs a bot ~0.1 s,
        // while the detour cost the fleet 10 s/boat-race on Emberfall (treeVF3ND).
        {
            const ctrl = bot.controller;
            for (let i = 0; i < 12; i++) update(1 / 60);
            const th0 = ctrl.targetHeading;
            const sx = bot.x + 220, sy = bot.y;
            aimed.pending = { ox: sx, oy: sy - 300, x: sx, y: sy, at: V.t + 2.8, seed: 12345, aimed: true, boat: bot };
            for (let i = 0; i < 12; i++) update(1 / 60);
            out.noDodge = typeof ctrl.strikeDodge === 'undefined' && typeof ctrl.dodgeChance === 'undefined';
            out.dodgeTurn = Math.abs(normalizeAngle(ctrl.targetHeading - th0));
            aimed.pending = null;
        }
        // The cycle: over one full period the cone goes quiet and erupts once more.
        let sawQuiet = false, sawPeak = false;
        for (let i = 0; i < Math.ceil(cone.period * 60); i += 1) { update(1 / 60); if (cone.intensity === 0) sawQuiet = true; if (cone.intensity === 1) sawPeak = true; }
        out.cycle = sawQuiet && sawPeak;
        // Off the water the storm holds: with the briefing up, no striker deals and a tell does
        // not run down; when it closes, the storm resumes where it was.
        for (const st of V.strikers) { st.pending = null; st.next = 0; }
        UI.preRaceOverlay.classList.remove('hidden');
        for (let i = 0; i < 30; i++) update(1 / 60);
        out.heldDeals = V.strikers.filter(s => s.pending).length;
        UI.preRaceOverlay.classList.add('hidden');
        update(1 / 60);
        out.resumedDeals = V.strikers.filter(s => s.pending).length;
        const held = V.strikers.find(s => s.pending); const atBefore = held ? held.at || held.pending.at : 0;
        UI.preRaceOverlay.classList.remove('hidden');
        for (let i = 0; i < 60; i++) update(1 / 60);
        out.tellHeld = held ? (held.pending && held.pending.at - atBefore > 0.9) : false;
        UI.preRaceOverlay.classList.add('hidden');
        return out;
    });

    // The eruption takes decode in the browser: both files load and report their length.
    const takes = await page.evaluate(() => Promise.all([Sound.ERUPTION.onset, Sound.ERUPTION.loop, Sound.THUNDER.near, Sound.THUNDER.far].map(f => new Promise(res => {
        const el = new Audio(f); const done = (ok) => res({ f, ok, dur: el.duration });
        el.addEventListener('loadedmetadata', () => done(true)); el.addEventListener('error', () => done(false));
        setTimeout(() => done(false), 4000);
    }))));
    check(`audio takes decode: ${takes.map(t => t.f.split('/').pop() + ' ' + (t.ok ? t.dur.toFixed(1) + 's' : 'FAILED')).join(', ')}`, takes.every(t => t.ok && t.dur > 3));
    check('the venue has an eruption cycle', r.active, 'state.volcano is null');
    if (r.active) {
        check(`cones (${r.cones}) and vents (${r.vents}) found`, r.cones >= 1 && r.vents >= 1);
        check('the cycle is dealt from the seed', r.sameDeal);
        check(`forced peak: intensity ${r.intensity}; lava untouched (heat ${r.heat}, activity ${r.activity})`, r.intensity === 1 && r.heat == null && r.activity == null);
        check(`plume has parcels (${r.parcels})`, r.parcels >= 8);
        check(`laze: synthetic square gives ${r.frontsSynthetic} sources; the venue has ${r.fronts}, ${r.laze} steam parcels alive, nearest ${r.lazeNearFront.toFixed(0)} u from a front`, r.frontsSynthetic >= 6 && r.frontsSynthetic <= 10 && r.fronts >= 1 && r.laze >= 6 && r.lazeNearFront < 60);
        check(`eruption sound: onset boom ${r.onset ? 'at ' + r.onset.loud.toFixed(2) : 'MISSING'}, rumble level ${r.rumble.toFixed(2)} beside the cone`, !!r.onset && r.rumble > 0.8);
        check(`dead air under the plume: deepest x${r.deepest.toFixed(2)}, far x${r.farMul}`, r.deepest < 0.5 && r.farMul === 1);
        check(`dissipates downwind: tail x${r.tail.toFixed(2)} at ${r.oldestAge.toFixed(1)} s`, r.tail > r.deepest);
        check(`getWindAt reads it: ${r.windUnder.toFixed(2)} of ${r.windMean.toFixed(2)} kn`, r.windUnder < r.windMean * 0.6);
        check(`the boil scrubs speed: ${r.speedBoil.toFixed(2)} after 2 s in the crack vs ${r.speedClear.toFixed(2)} clear`, r.speedBoil < r.speedClear * 0.5);
        check(`the router prices it: cost ${r.costIn.toFixed(2)} on the crack, ${r.costOut.toFixed(2)} beside it; bots read x${r.boilMulCore.toFixed(2)} / x${r.boilMulClear}`, r.hasGrid && r.costIn > 1.5 && r.costOut <= 1.001 && r.boilMulCore < 0.6 && r.boilMulClear === 1);
        check(`boil follows the lava (${r.boilShape[0]}x${r.boilShape[1]} ellipse): ${r.boilCore.toFixed(2)} at the centre, ${r.boilAlong.toFixed(2)} along the crack, ${r.boilOut} past its end, ${r.boilAcross} across`, r.boilCore > 0.3 && r.boilAlong > 0.1 && r.boilOut === 0 && r.boilAcross === 0 && r.boilShape[0] > r.boilShape[1] * 2);
        check(`four strikers (${r.strikerCount}: three free, one aimed)`, r.strikerCount === 4);
        check(`the aimed striker leads a boat: ${r.aimNear} of ${r.aimDealt} within 6 hull lengths of the projected point, player drawn ${r.playerHits} times`, r.aimDealt >= 35 && r.aimNear === r.aimDealt && r.playerHits >= 4);
        check(`the free strikers land on the course's water: ${r.freeWater} of ${r.freeDealt} on water, ${r.freeInField} in the field`, r.freeDealt >= 25 && r.freeWater === r.freeDealt && r.freeInField === r.freeDealt);
        check(`strike fires (${r.strikes}) and fries player/near bot, not the far boat: ${r.playerFried}/${r.botFried}/${r.farFried}`,
              r.strikes === 1 && r.playerFried && r.botFried && !r.farFried);
        check(`thunder: ${r.thunder ? r.thunder.delay.toFixed(2) + ' s late, near ' + r.thunder.near.toFixed(2) + ' far ' + r.thunder.far.toFixed(2) : 'none'}`,
              !!r.thunder && r.thunder.delay < 0.1 && r.thunder.near > 0.8 && r.thunder.far > 0.2 && r.thunder.far < r.thunder.near);
        check(`outage scales with proximity from 15 s: ${r.botDur.toFixed(1)} s at 45 u, ${r.midDur.toFixed(1)} s at 480 u`, r.botDur > 13.5 && r.botDur < 15 && r.midDur > 3 && r.midDur < 4.5);
        check(`every HUD system down at the strike: ${r.hud.join(',')}, glitch ${r.glitch}`, r.hud.every(Boolean) && r.glitch >= 0.9);
        check('the leaderboard wears .fried', r.lbClass === true);
        check(`fried rim indicators wander the rim: moved ${r.wander.moved.toFixed(0)} px in 0.5 s, on the rim ${r.wander.rimA}/${r.wander.rimB}, inner chip kept ${r.wander.innerKept}`, r.wander.moved > 20 && r.wander.rimA && r.wander.rimB && r.wander.innerKept);
        check('the race clock is fried too', r.timerFried === true);
        check(`one outage, ${r.fryDur.toFixed(1)} s: at 62% rose ${r.midway[0]}, leaderboard ${r.midway[1]}`, r.midway[0] === true && r.midway[1] === true);
        check('everyone recovers', r.after === false);
        check(`fried bot keeps sailing its held RACING intent (not the bent final heading): ${r.friedTicks} body ticks, held ${r.friedHeld}, wind read frozen ${r.friedWindFrozen}`, r.friedTicks >= 4 && r.friedHeld && r.friedWindFrozen);
        check(`no dodge: a marked strike beside the bot leaves its helm alone (turned ${r.dodgeTurn.toFixed(2)} rad in 0.2 s; dodge methods gone ${r.noDodge})`, r.noDodge && r.dodgeTurn < 0.3);
        check('the cone goes quiet and erupts again over one period', r.cycle);
        check(`the storm holds behind the briefing: ${r.heldDeals} deals held, ${r.resumedDeals} on resume, tell held ${r.tellHeld}`, r.heldDeals === 0 && r.resumedDeals >= 3 && r.tellHeld === true);
        check('draw() survives the strike, the flash and the fried HUD', r.problems.length === 0, r.problems.slice(0, 3).join(' | '));
    }
    check('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));

    await browser.close();
    console.log(`\n${failures ? 'FAIL' : 'PASS'} — volcano: ${failures} problem(s)`);
    process.exitCode = failures ? 1 : 0;
})();
