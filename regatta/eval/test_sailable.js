// Can the course be COMPLETED with the mechanics we have?
//
//   node regatta/eval/test_sailable.js [venue]
//
// Drives a boat along a correct path — best-case decisions by construction — and asks
// whether the system RECOGNISES it was sailed. Every leg must register: the start line
// crossed, each gate crossed and left round an end, each mark rounded the right way,
// the finish crossed.
//
// This is not about the AI and not about wind. By tacking, any bearing is reachable, so
// "could a boat get there" is nearly always yes and tells you nothing. What bites is
// whether the leg engine agrees that a correct rounding happened, and whether there is
// hull-width room to perform one at all.
//
// The path is built on LAND only. Drifting ice is excluded from the routing grid but
// still reported if it is hit, so "the course works" and "the ice is in the way" stay
// separate answers.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ONLY = process.argv[2] || null;

let failures = 0;
const check = (name, cond, detail) => {
    console.log(`  ${cond ? 'ok   ' : 'FAIL '} ${name}${cond || !detail ? '' : ' — ' + detail}`);
    if (!cond) failures++;
};

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    // The GAME page, not the editor: startRace() touches DOM the editor does not have,
    // and the point is to exercise the real race path. sailcheck.js is an authoring
    // tool so index.html does not load it — inject it.
    await page.goto('file://' + path.resolve('regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync('regatta/js/sailcheck.js', 'utf8') });
    await page.waitForTimeout(600);

    const venues = await page.evaluate(() => Object.keys(window.VENUE_DOC || {}));
    const list = ONLY ? [ONLY] : venues;
    console.log(`Sailability — ${list.length} document venue(s): ${list.join(', ')}\n`);

    for (const venue of list) {
        const r = await page.evaluate((v) => {
            localStorage.setItem('regatta_settings', JSON.stringify({ venue: v }));
            let s = 90210;
            Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1);
                t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
            resetGame();

            const doc = window.VENUE_DOC[v];
            const S = window.SailCheck;
            const grid = S.buildGrid(window.VenueDoc.shapes(doc).filter(sh => window.VenueDoc.traits(sh).motion === 'fixed'), state.course.boundary, null);
            const marks = state.course.marks, route = state.course.route;
            const wps = S.routeWaypoints(marks, route, grid);

            // Rounding room, before trying to sail it — a mark you cannot get round
            // explains a stall that would otherwise look like an engine bug.
            const arcs = route.map((e, i) => e.kind === 'round' && e.mark
                ? Object.assign({ leg: i }, S.roundingArc(grid, e.mark)) : null).filter(Boolean);

            // Stitch the waypoints into one hull-width path.
            const full = [];
            let broken = null;
            for (let k = 0; k + 1 < wps.length; k++) {
                const a = wps[k], b = wps[k + 1];
                if (Math.hypot(b.x - a.x, b.y - a.y) < 60) { full.push([b.x, b.y]); continue; }
                const seg = S.pathBetween(grid, [a.x, a.y], [b.x, b.y]);
                if (!seg) { broken = `${a.tag} -> ${b.tag}`; break; }
                for (const p of seg) full.push(p);
            }

            if (broken) return { broken, arcs, wps: wps.length, navCells: grid.nav.reduce((x,y)=>x+y,0) };

            // STEER, DON'T STAIR-STEP. pathBetween returns cell centres; through a
            // corridor barely wider than the clearance bar (redrock's north exit is
            // 46-65u of true rock-to-rock water, admitted by the grid's sub-point
            // sampling) a cell CENTRE can sit closer to rock than the hull is wide,
            // while the channel's centreline clears fine. A correct sailor holds the
            // middle of a narrow channel, so points that stand close to land are
            // nudged (within half a cell, so the path is the same path) to the
            // position of greatest land clearance. The hull-in-land standard below
            // is untouched — this is the driver steering, not the test bending.
            const landAll = state.course.landShapes || [];
            const landDistAt = (x, y) => {
                let best = 1e9;
                for (const isl of landAll) {
                    if (Math.hypot(x - isl.x, y - isl.y) > (isl.radius || 0) + 400) continue;
                    const v = isl.vertices;
                    for (let e = 0; e < v.length; e++) {
                        const a2 = v[e], b2 = v[(e + 1) % v.length];
                        const vx = b2.x - a2.x, vy = b2.y - a2.y;
                        let t = ((x - a2.x) * vx + (y - a2.y) * vy) / (vx * vx + vy * vy || 1);
                        t = t < 0 ? 0 : t > 1 ? 1 : t;
                        const d = Math.hypot(x - (a2.x + vx * t), y - (a2.y + vy * t));
                        if (d < best) best = d;
                    }
                }
                return best;
            };
            for (const p of full) {
                let bd = landDistAt(p[0], p[1]);
                if (bd >= 44) continue;
                for (const r of [12.5, 25]) {
                    for (let k8 = 0; k8 < 8; k8++) {
                        const a8 = k8 / 8 * Math.PI * 2;
                        const nx = p[0] + Math.cos(a8) * r, ny = p[1] + Math.sin(a8) * r;
                        const d8 = landDistAt(nx, ny);
                        if (d8 > bd) { bd = d8; p[0] = nx; p[1] = ny; }
                    }
                }
            }

            startRace();
            while (state.race.status === 'prestart') update(1 / 60);
            const boat = state.boats.find(b => b.isPlayer) || state.boats[0];
            for (const b of state.boats) if (b !== boat) { b.x = 1e6; b.y = 1e6; b.speed = 0; }

            // Start behind the line so the first crossing counts.
            boat.x = full[0][0]; boat.y = full[0][1];
            boat.raceState.lastPos = { x: boat.x, y: boat.y };

            const events = [];
            window.onRaceEvent = (t, d) => events.push({ t, leg: d.leg });
            let ground = 0, bound = 0, maxSweep = 0, minSweep = 0, zoneSteps = 0;
            const legAtStep = {};
            const totalLegs = state.race.totalLegs;

            // Step along the path. Sub-stepped so no leap skips a line: the crossing
            // test compares lastPos to the current position.
            for (let k = 1; k < full.length; k++) {
                const [tx, ty] = full[k];
                const sx = boat.x, sy = boat.y;
                const d = Math.hypot(tx - sx, ty - sy);
                const sub = Math.max(1, Math.ceil(d / 18));
                for (let q = 1; q <= sub; q++) {
                    boat.raceState.lastPos = { x: boat.x, y: boat.y };
                    boat.x = sx + (tx - sx) * (q / sub);
                    boat.y = sy + (ty - sy) * (q / sub);
                    boat.heading = Math.atan2(boat.x - boat.raceState.lastPos.x,
                                             -(boat.y - boat.raceState.lastPos.y));
                    updateBoatRaceState(boat, 1 / 60);
                    if (legAtStep[boat.raceState.leg] === undefined) legAtStep[boat.raceState.leg] = k;
                    // Is the hull in land, or outside the arena, at this point?
                    for (const isl of (state.course.landShapes || [])) {
                        if (circlePolyCollide(boat.x, boat.y, 30, isl.vertices)) { ground++; break; }
                    }
                    if (window.Arena.signedDist(state.course.boundary, boat.x, boat.y) < 0) bound++;
                    const sw = boat.raceState.roundSweep || 0;
                    if (sw > maxSweep) maxSweep = sw;
                    if (sw < minSweep) minSweep = sw;
                    if (boat.raceState.roundArmed) zoneSteps++;
                }
                if (boat.raceState.finished) break;
            }

            return {
                arcs, wps: wps.length, pathPts: full.length,
                navCells: grid.nav.reduce((x,y)=>x+y,0),
                totalLegs, legReached: boat.raceState.leg, finished: boat.raceState.finished,
                legAtStep, ground, bound, zoneSteps,
                maxSweepDeg: Math.round(maxSweep * 180 / Math.PI),
                minSweepDeg: Math.round(minSweep * 180 / Math.PI),
                legCompletes: events.filter(e => e.t === 'leg_complete').map(e => e.leg),
                finishEvents: events.filter(e => e.t === 'finish').length,
                routeKinds: route.map(e => e.kind + (e.role === 'start' ? '/start' : e.finish ? '/finish' : ''))
            };
        }, venue);

        console.log(`${venue}`);
        console.log(`  route: ${r.routeKinds ? r.routeKinds.join(' -> ') : '?'}`);
        for (const a of (r.arcs || [])) {
            check(`leg ${a.leg}: room to get all the way round (${a.arcDeg}deg open at ${a.radius}u)`,
                  a.arcDeg >= 200, `only ${a.arcDeg}deg of the circle is hull-width water`);
        }
        if (r.broken) {
            check('an ideal path exists through the whole route', false,
                  `no hull-width path for ${r.broken}`);
        } else {
            check('every leg registered', r.legReached === r.totalLegs + 1,
                  `reached leg ${r.legReached} of ${r.totalLegs + 1}; leg_complete events for ${JSON.stringify(r.legCompletes)}`);
            check('the system recognised the finish', r.finished === true && r.finishEvents === 1,
                  `finished=${r.finished}, finish events=${r.finishEvents}`);
            check('the ideal path never puts the hull in land', r.ground === 0, `${r.ground} sub-steps grounded`);
            check('the ideal path never leaves the arena', r.bound === 0, `${r.bound} sub-steps outside`);
            console.log(`         ${r.wps} waypoints, ${r.pathPts} path points, ${r.navCells} navigable cells`);
            console.log(`         leg first reached at path point: ${JSON.stringify(r.legAtStep)}`);
            if (r.zoneSteps !== undefined) console.log(`         rounding: ${r.zoneSteps} sub-steps armed, net sweep ranged ${r.minSweepDeg}..${r.maxSweepDeg} deg (sign decides the side)`);
        }
        console.log('');
    }

    await browser.close();
    if (errs.length) console.log('page errors:', errs.slice(0, 3).join(' | '));
    console.log(`${failures ? 'FAIL' : 'PASS'} — ${failures} failure(s)`);
    process.exitCode = failures ? 1 : 0;
})();
