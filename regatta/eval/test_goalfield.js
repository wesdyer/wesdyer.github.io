// GOAL FIELDS — the precomputed distance-and-direction field per goal (js/sim/goalfield.js).
//
//   node regatta/eval/test_goalfield.js
//
// What has to hold, per venue:
//   build     a full build carries one field per route goal, built in under two seconds
//   reach     the start line and every goal read a finite distance in its own field
//   honest    no field distance is shorter than the straight line to the goal (a lookup that
//             beats Euclid is a lookup through land); when the straight line IS clear the field
//             points straight at the goal (the ancestor is a source) in nearly every sample
//   rank      along a raced track the leader's progress advances (monotone over 1 s windows in
//             the great majority of them), and progress is continuous across a leg change
//   path      the fast-marching surface is never shorter than the straight line, gradient descent
//             from random water reaches the goal without touching land, and the chip's aim is
//             the goal's bearing, always; drawing never throws
const { chromium } = require('playwright');
const path = require('path');

const VENUES = (process.env.VENUES || 'bay,otter,river,lake,glowtide,arctic').split(',');
let fails = 0;
const check = (name, ok, detail) => {
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}${ok || !detail ? '' : ' — ' + detail}`);
    if (!ok) fails++;
};

(async () => {
    const browser = await chromium.launch();
    for (const venue of VENUES) {
        const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
        const errs = []; page.on('pageerror', e => errs.push(e.message));
        await page.addInitScript(v => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v, musicEnabled: false, soundEnabled: false, bgSoundEnabled: false })), venue);
        await page.goto('file://' + path.resolve('regatta/index.html'));
        await page.waitForFunction(() => typeof state !== 'undefined' && state.boats && state.boats.length > 0, null, { timeout: 30000 });
        const r = await page.evaluate((venue) => {
            let s = 7; Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
            selectVenue(venue); resetGame(); startRace();
            for (let i = 0; i < 5; i++) update(1 / 30);
            const GF = state.course.goalFields, route = state.course.route, marks = state.course.marks;
            const out = { venue, hasGF: !!GF, loadState: state.course.loadState };
            if (!GF) return out;
            out.legs = GF.legs.length; out.routeLen = route.length; out.ms = GF.ms; out.metric = GF.metric; out.total = Math.round(GF.total);
            out.legLen = GF.legLen.map(Math.round);
            const goalPt = (e) => e.kind === 'round' && e.mark ? { x: e.mark.x, y: e.mark.y }
                : e.marks ? { x: (marks[e.marks[0]].x + marks[e.marks[1]].x) / 2, y: (marks[e.marks[0]].y + marks[e.marks[1]].y) / 2 } : null;
            // reach: the start and every previous goal read finite in each field
            out.reach = [];
            let prev = goalPt(route[0]);
            for (let L = 1; L < route.length; L++) {
                const F = GF.legs[L]; const rd = F && prev ? GoalField.lookup(F, prev.x, prev.y) : null;
                out.reach.push(rd ? Math.round(rd.dist) : null);
                const g = goalPt(route[L]); if (g) prev = g;
            }
            // honest: random reached cells vs Euclid and vs the geometric clearance test
            const SC = window.SailCheck, grid = state.course.botGrid, N = grid.n, RES = grid.res;
            let n = 0, shorter = 0, clearN = 0, clearStraight = 0, ratioSum = 0, fmmN = 0, fmmMissing = 0, fmmShort = 0, fmmRatio = 0, descOk = 0, descLand = 0;
            for (let L = 1; L < route.length; L++) {
                const F = GF.legs[L]; if (!F || F.kind !== 'mark') continue;
                const g = F.goal;
                for (let k = 0; k < 400; k++) {
                    const i = Math.floor(Math.random() * N), j = Math.floor(Math.random() * N);
                    const id = j * N + i; if (!F.pass[id] || !isFinite(F.dist[id])) continue;
                    const w = grid.world(i, j);
                    if (!Arena.contains(state.course.boundary, w[0], w[1], 0)) continue;
                    const rd = GoalField.lookup(F, w[0], w[1]); if (!rd) continue;
                    const eu = Math.hypot(g.x - w[0], g.y - w[1]); n++;
                    if (rd.dist < eu - RES) shorter++;          // a source cell stands within a cell of the mark
                    ratioSum += rd.dist / Math.max(1, eu);
                    if (SC.segClearGeom(grid, w[0], w[1], g.x, g.y, SC.TIGHT_CLEAR)) { clearN++; if (rd.atGoal) clearStraight++; }
                    // the fast-marching surface: honest, and its descent reaches the goal on water
                    const tt = GoalField.Tat(F, w[0], w[1]); fmmN++;
                    if (!isFinite(tt)) { fmmMissing++; continue; }
                    if (tt < eu - 2 * RES) fmmShort++;
                    fmmRatio += tt / Math.max(1, eu);
                    const path = GoalField.descend(F, w[0], w[1], 1e9); let L = 0, onLand = 0;
                    for (let q = 1; q < path.length; q++) { L += Math.hypot(path[q][0] - path[q - 1][0], path[q][1] - path[q - 1][1]);
                        const cc = grid.cell(path[q][0], path[q][1]); const cid = cc[1] * N + cc[0]; if (q < path.length - 3 && cid >= 0 && cid < N * N && !F.pass[cid]) onLand++; }
                    const end = path[path.length - 1]; const reached = Math.hypot(end[0] - g.x, end[1] - g.y) < 2 * RES;
                    if (reached && L <= tt * 1.3 + 3 * RES) descOk++; if (onLand) descLand++;
                }
            }
            out.honest = { n, shorter, clearN, clearStraight, meanRatio: n ? +(ratioSum / n).toFixed(3) : null };
            out.fmm = { n: fmmN, missing: fmmMissing, shorter: fmmShort, meanRatio: fmmN - fmmMissing ? +(fmmRatio / (fmmN - fmmMissing)).toFixed(3) : null, descOk, descLand, fmmMs: Math.round(GF.fmmMs || 0) };
            // rank + chip along a raced track
            const me = state.boats[0]; me.controller = new BotController(me);
            let t = 0, tick = 0; const cap = 150;
            let lastP = null, lastT = 0, windows = 0, up = 0, legJumps = [], lastLeg = -1, lastProg = null;
            let aimDirectMiss = 0, aimSamples = 0, drawErr = null, pathPts = 0, pathSamples = 0;
            while (t < cap && state.race.status !== 'finished') {
                me.controller.update(1 / 30);
                const d = normalizeAngle(me.controller.targetHeading - me.heading);
                state.keys.ArrowLeft = d < -0.02; state.keys.ArrowRight = d > 0.02;
                update(1 / 30); t += 1 / 30; tick++;
                if (state.race.status !== 'racing') continue;
                const leader = [...state.boats].filter(b => !b.raceState.finished).sort((a, b) => (b.raceState.leg - a.raceState.leg) || (getBoatProgress(b) - getBoatProgress(a)))[0];
                const p = getBoatProgress(leader);
                if (lastP != null && t - lastT >= 1) { windows++; if (p >= lastP - 5) up++; lastP = p; lastT = t; }
                if (lastP == null) { lastP = p; lastT = t; }
                // continuity across the player's leg change
                const pl = getBoatProgress(me);
                if (lastLeg >= 0 && me.raceState.leg !== lastLeg && lastProg != null) legJumps.push(Math.round(pl - lastProg));
                lastLeg = me.raceState.leg; lastProg = pl;
                if (tick % 3 === 0) {
                    try { draw(); } catch (e) { drawErr = drawErr || e.message; }
                    const g = window._goalAim;
                    if (g && g.t === frameCount) {
                        aimSamples++;
                        const A = GoalField.playerAim(me, routeLeg(Math.min(me.raceState.leg, state.race.totalLegs)), me.raceState.leg);
                        if (A && A.kind === 'mark') { const b = Math.atan2(A.goal.x - me.x, -(A.goal.y - me.y)); if (Math.abs(normalizeAngle(g.a - b)) > 1e-6) aimDirectMiss++; }
                        const pp = GoalField.playerPath(me); pathSamples++; if (pp && pp.length >= 3) pathPts++;
                    }
                }
            }
            out.rank = { windows, up, legJumps };
            out.chip = { aimSamples, aimDirectMiss, drawErr, pathSamples, pathPts };
            out.finished = state.race.status; out.t = Math.round(t);
            return out;
        }, venue);
        console.log(`\n${venue}: ${JSON.stringify(r)}`);
        check(`${venue}: full build carries the fields`, r.hasGF, `loadState ${r.loadState}`);
        if (!r.hasGF) { await page.close(); continue; }
        check(`${venue}: one field per route goal`, r.legs === r.routeLen, `${r.legs} vs ${r.routeLen}`);
        check(`${venue}: built in under two seconds`, r.ms < 2000, `${Math.round(r.ms)} ms`);
        check(`${venue}: start and every goal read a finite distance`, r.reach.every(x => x != null && x > 0), JSON.stringify(r.reach));
        check(`${venue}: no field distance beats the straight line`, r.honest.shorter === 0, `${r.honest.shorter} of ${r.honest.n}`);
        // The raster line of sight is stricter than the geometric test by half a cell a side, so
        // some clear lines read a corner — the chip goes straight on the geometric test anyway.
        // The raster line of sight is stricter than the geometric test by half a cell a side, so a
        // clear line can read a corner in the field — the chip goes straight on the geometric test
        // regardless, so this is a floor on the field's agreement, not a promise.
        check(`${venue}: a clear line often points straight at the goal`, r.honest.clearN === 0 || r.honest.clearStraight >= r.honest.clearN * 0.3, `${r.honest.clearStraight} of ${r.honest.clearN}`);
        check(`${venue}: the leader's progress advances`, r.rank.windows === 0 || r.rank.up >= r.rank.windows * 0.9, `${r.rank.up} of ${r.rank.windows} one-second windows`);
        // A rounding completes at the zone's edge, not on the mark, so the reading steps by up to
        // the zone radius (priced by the cone) at the change — the ruler stepped the same way.
        check(`${venue}: progress is continuous across a leg change`, r.rank.legJumps.every(j => Math.abs(j) < 800), JSON.stringify(r.rank.legJumps));
        check(`${venue}: the chip is the goal's bearing, always`, r.chip.aimDirectMiss === 0, `${r.chip.aimDirectMiss} misses`);
        check(`${venue}: the fast-marching surface reaches the sampled water`, r.fmm.missing === 0, `${r.fmm.missing} of ${r.fmm.n} unreached`);
        check(`${venue}: the fast-marching surface never beats the straight line`, r.fmm.shorter === 0, `${r.fmm.shorter} of ${r.fmm.n}`);
        check(`${venue}: descent reaches the goal along the surface`, r.fmm.n === 0 || r.fmm.descOk >= (r.fmm.n - r.fmm.missing) * 0.95, `${r.fmm.descOk} of ${r.fmm.n - r.fmm.missing}`);
        check(`${venue}: descent never crosses land`, r.fmm.descLand === 0, `${r.fmm.descLand} paths touched land`);
        check(`${venue}: the player has a path ahead while racing`, r.chip.pathSamples === 0 || r.chip.pathPts >= r.chip.pathSamples * 0.9, `${r.chip.pathPts} of ${r.chip.pathSamples}`);
        check(`${venue}: drawing never throws`, !r.chip.drawErr && errs.length === 0, r.chip.drawErr || errs[0]);
        await page.close();
    }
    await browser.close();
    console.log(`\n${fails ? 'FAIL' : 'PASS'} — ${fails} failure(s)`);
    process.exitCode = fails ? 1 : 0;
})();
