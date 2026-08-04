// Can the leg engine race a MIXED route — line, gate, rounding, line?
//
//   node regatta/eval/test_route.js
//
// This is the thing the refactor was for. Before it, `updateBoatRaceState` had two
// hardcoded course types: a windward-leeward that understood lines and gates, and an
// island course that understood one rounding at a fixed leg number. A route mixing
// them would have stored fine in a document and raced wrong, which is why building
// editor UI for gates and roundings had to wait.
//
// A boat is driven along a KNOWN path rather than left to the AI, so a failure here
// means the engine, not navigation. (Glacier Sound's AI cannot currently complete its
// own rounding — a separate, pre-existing problem.)
const { chromium } = require('playwright');
const path = require('path');

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
    await page.goto('file://' + path.resolve('regatta/index.html'));
    await page.evaluate(() => localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' })));

    const r = await page.evaluate(() => {
        // A deliberately plain venue: open water, one land shape parked far away so the
        // document is well-formed, and a four-entry route.
        //
        // Geometry follows the heading convention forward = (sin h, -cos h): with
        // wind.baseDirection 0, up-course is -y. So the start is at +y and everything
        // else is progressively upwind of it.
        window.VENUE_DOC.testroute = {
            schema: 1, venue: 'testroute',
            world: { size: 9000, boundary: { poly: [[-4500,-4500],[4500,-4500],[4500,4500],[-4500,4500]], circle: null } },
            land: [{ id: 'far-rock', cls: 'granite', style: 'granite', soft: false,
                     c: [3800, 3800], r: 200,
                     outer: [[3600,3600],[4000,3600],[4000,4000],[3600,4000]], holes: [] }],
            course: {
                legs: 3,
                marks: [
                    { id: 'sf-pin',  x: -550, y: 2000, kind: 'inflatable' },
                    { id: 'sf-boat', x:  550, y: 2000, kind: 'inflatable' },
                    { id: 'gate-a',  x: -400, y: -1000, kind: 'inflatable' },
                    { id: 'gate-b',  x:  400, y: -1000, kind: 'inflatable' },
                    { id: 'can',     x: 1200, y: -2200, kind: 'can' }
                ],
                route: [
                    { kind: 'line',  marks: [0, 1], dir: 1,  beat: true,  role: 'start' },
                    { kind: 'gate',  marks: [2, 3], dir: 1,  beat: true,  role: 'gate' },
                    { kind: 'round', markIdx: 4, side: 'starboard', zone: 400, beat: false, role: 'rounding' },
                    { kind: 'line',  marks: [0, 1], dir: -1, beat: false, role: 'finish', finish: true }
                ]
            },
            wind: { mode: 'fixed', baseDirection: 0 },
            seeded: {}
        };
        // (A `VENUES.testroute = {...}` registration stood here. That global was the
        // pre-document venue registry and no longer exists in the source — a venue IS
        // its document now — so this threw ReferenceError on clean HEAD and took the
        // whole `npm test` chain down with it. The VENUE_DOC entry is the registration.)
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'testroute' }));

        let s = 4242;
        Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

        const problems = [];
        resetGame();
        const errsV = window.VenueDoc.validate(window.VENUE_DOC.testroute).filter(p => p.level === 'error');
        if (errsV.length) problems.push('validate: ' + errsV.map(p => p.msg).join('; '));

        const compiledRoute = state.course.route.map(e => ({ kind: e.kind, hasMark: !!e.mark, dir: e.dir, side: e.side }));
        const totalLegs = state.race.totalLegs;

        startRace();
        // Skip the prestart so crossings count.
        while (state.race.status === 'prestart') update(1 / 60);

        const boat = state.boats.find(b => b.isPlayer) || state.boats[0];
        // Freeze every other boat well clear so collisions cannot perturb the path.
        for (const b of state.boats) if (b !== boat) { b.x = 4000; b.y = 4000; b.speed = 0; }

        const legAt = {};
        const note = () => { const l = boat.raceState.leg; if (legAt[l] === undefined) legAt[l] = Math.round(state.race.timer * 10) / 10; };
        note();

        // Move in small steps: the crossing test compares lastPos to the current
        // position, so a step must not jump over a line and out the other side.
        const glide = (tx, ty, steps) => {
            for (let i = 0; i < steps; i++) {
                const f = (i + 1) / steps;
                const sx = boat.x, sy = boat.y;
                boat.raceState.lastPos = { x: sx, y: sy };
                boat.x = sx + (tx - sx) * (1 / (steps - i));
                boat.y = sy + (ty - sy) * (1 / (steps - i));
                boat.heading = Math.atan2(boat.x - sx, -(boat.y - sy));
                updateBoatRaceState(boat, 1 / 60);
                note();
            }
        };

        glide(0, 2400, 20);        // settle behind the line
        glide(0, 1500, 40);        // cross the START going up-course  -> leg 1
        const afterStart = boat.raceState.leg;

        glide(0, -1500, 90);       // through the GATE going up-course -> arms the rounding
        const armed = boat.raceState.isRounding;
        glide(-900, -1500, 40);    // out past the gate's left end
        glide(-900, -500, 40);     // back across its EXTENSION -> leg 2
        const afterGate = boat.raceState.leg;

        // Sweep the can to STARBOARD: bearing from the mark must increase past ~160deg.
        // Round WIDE: dip inside the 400u zone to arm it, then sweep at 700u — outside
        // the zone but inside the 2.5x active radius. Before the split, sweep only
        // accumulated inside the zone, so this correct-but-wide rounding registered
        // nothing at all.
        const cx = 1200, cy = -2200, rr = 700, rDip = 280;
        // `arcSign` +1 sweeps the way a starboard rounding requires; -1 sweeps the
        // other way, which must NOT count. A completion test that fires on departure
        // regardless of side would pass the positive case and be worthless.
        const roundPass = (arcSign) => {
            // Teleport to the approach start WITHOUT a sweep contribution, and clear
            // the rounding state, so each pass is isolated. Otherwise repositioning the
            // boat drags it past the mark and banks a reverse sweep that is real
            // behaviour but has nothing to do with what is being tested.
            boat.x = cx + 1600; boat.y = cy;
            boat.raceState.lastPos = { x: boat.x, y: boat.y };
            boat.raceState.roundSweep = 0;
            boat.raceState.roundWrong = 0;
            boat.raceState.roundArmed = false;
            boat.raceState._wrongRound = false;
            let peak = 0;
        // Approach RADIALLY, from outside the zone straight in along the bearing the
        // arc starts at. Sweep accumulates from the moment the zone is entered, so an
        // approach that curls the wrong way round the mark banks negative credit the
        // rounding then has to undo — which is correct behaviour (it is a real
        // rounding requirement) but makes for a nonsense test path.
        glide(cx + 1600, cy, 40);      // well outside, on the arc's bearing
        glide(cx + rDip, cy, 30);      // dip INSIDE the zone: arms the rounding
        const armedByZone = boat.raceState.roundArmed;
        glide(cx + rr, cy, 20);        // back out to the wide sweep radius
        for (let k = 1; k <= 60; k++) {
            const a = arcSign * (k / 60) * 3.05;           // ~175 degrees, signed
            glide(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 3);
            // Peak, not final: completing the rounding resets the sweep, so reading it
            // afterwards always shows zero.
            peak = Math.max(peak, boat.raceState.roundSweep || 0);
        }
            // Completion fires on DEPARTURE — the boat has to leave the mark, which a
            // real course makes you do anyway on the way to the next one.
            glide(cx - 1800, cy + 400, 40);
            return { leg: boat.raceState.leg,
                     sweepDeg: Math.round(peak * 180 / Math.PI),
                     armed: armedByZone };
        };

        // WRONG side first, from the same starting state — it must not advance.
        const legBefore = boat.raceState.leg;
        const wrong = roundPass(-1);
        const right = roundPass(1);
        const afterRound = boat.raceState.leg;
        const sweepDeg = right.sweepDeg;

        glide(0, 1500, 60);        // back toward the line
        glide(0, 2400, 40);        // cross the FINISH going down-course -> finished
        const afterFinish = boat.raceState.leg;

        return {
            problems, compiledRoute, totalLegs,
            afterStart, armed, afterGate, afterRound, afterFinish,
            sweepDeg, armedByZone: right.armed, legBefore, wrongLeg: wrong.leg, wrongSweepDeg: wrong.sweepDeg,
            finished: boat.raceState.finished,
            finishTime: Math.round(boat.raceState.finishTime),
            legTimes: boat.raceState.legTimes.length,
            legAt
        };
    });
    await browser.close();

    console.log('mixed route: line -> gate -> rounding -> line\n');
    check('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
    check('document validates', r.problems.length === 0, r.problems.join(' | '));
    check('route compiled with 4 entries', r.compiledRoute.length === 4, JSON.stringify(r.compiledRoute));
    check('the rounding entry resolved a mark', r.compiledRoute[2] && r.compiledRoute[2].hasMark === true);
    check('totalLegs is 3', r.totalLegs === 3, String(r.totalLegs));

    check('crossing the start advanced to leg 1', r.afterStart === 1, `leg ${r.afterStart}`);
    check('crossing the gate armed the rounding', r.armed === true);
    check('leaving the gate advanced to leg 2', r.afterGate === 2, `leg ${r.afterGate}`);
    check('dipping inside the zone armed the rounding', r.armedByZone === true);
    check('a WIDE sweep outside the zone still advanced to leg 3', r.afterRound === 3,
          `leg ${r.afterRound}, sweep ${r.sweepDeg}deg`);
    check('rounding the WRONG side did not advance the leg',
          r.wrongLeg === r.legBefore, `leg ${r.legBefore} -> ${r.wrongLeg}, sweep ${r.wrongSweepDeg}deg`);
    check('the correct rounding had a positive net sweep (correct side)',
          r.sweepDeg > 0, `${r.sweepDeg}deg`);
    console.log(`         wide rounding swept only ${r.sweepDeg}deg — a fixed 160deg threshold would have rejected it`);
    check('crossing the finish ended the race', r.finished === true && r.afterFinish === 4,
          `leg ${r.afterFinish}, finished ${r.finished}`);
    check('three leg splits recorded', r.legTimes === 3, `${r.legTimes}`);
    console.log('         leg reached at:', JSON.stringify(r.legAt));

    console.log(`\n${failures ? 'FAIL' : 'PASS'} — ${failures} failure(s)`);
    process.exitCode = failures ? 1 : 0;
})();
