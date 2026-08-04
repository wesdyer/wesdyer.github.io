// ROUNDING A MARK — what counts, and what must not.
//
// RRS: a boat rounds a mark by leaving it on the required side on her way from the
// previous mark to the next one. Two things follow that the old test got wrong:
//
//   Passing NEAR a mark is not rounding it. Sailing straight past a mark sweeps ~180
//   degrees of bearing all by itself, so any small sweep threshold measures "came close"
//   rather than "went round".
//
//   Turning circles INSIDE the zone is not rounding it either. A penalty spin, or a boat
//   milling about waiting for a shift, must not bank credit toward the leg.
//
// The required sweep is a property of the COURSE, not a constant: it is the angle from the
// bearing you arrived on to the bearing you leave on, taken the required way round. An
// out-and-back needs the whole circle; a triangle corner needs a fraction of it.
const { chromium } = require('playwright');
const path = require('path');

let fails = 0;
const check = (name, ok, detail) => {
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}${ok || !detail ? '' : ' — ' + detail}`);
    if (!fails && !ok) {} if (!ok) fails++;
};

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.addInitScript(() => localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' })));
    await page.goto('file://' + path.resolve('regatta/index.html'));
    await page.waitForTimeout(2500);

    const r = await page.evaluate(() => {
        const o = {};
        startRace();
        while (state.race.status === 'prestart') update(1 / 60);
        const boat = state.boats.find(b => b.isPlayer) || state.boats[0];
        for (const b of state.boats) if (b !== boat) { b.x = 1e6; b.y = 1e6; b.speed = 0; }

        const entry = state.course.route[1];
        const m = entry.mark;
        o.mark = { x: Math.round(m.x), y: Math.round(m.y), zone: Math.round(m.zone), side: m.side };

        // Drive the boat along an explicit track, one small step at a time, exactly the way
        // the race loop does — position, heading, then the leg engine.
        const run = (pts) => {
            boat.raceState.leg = 1;
            boat.raceState.finished = false;
            boat.raceState.isRounding = false;
            boat.raceState.roundArmed = false;
            boat.raceState.roundSweep = 0;
            boat.raceState.roundWrong = 0;
            boat.x = pts[0].x; boat.y = pts[0].y;
            boat.raceState.lastPos = { x: boat.x, y: boat.y };
            for (let i = 1; i < pts.length; i++) {
                const a = { x: boat.x, y: boat.y }, b = pts[i];
                const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 12));
                for (let k = 1; k <= steps; k++) {
                    boat.raceState.lastPos = { x: boat.x, y: boat.y };
                    boat.x = a.x + (b.x - a.x) * k / steps;
                    boat.y = a.y + (b.y - a.y) * k / steps;
                    boat.heading = Math.atan2(boat.x - boat.raceState.lastPos.x, -(boat.y - boat.raceState.lastPos.y));
                    updateBoatRaceState(boat, 1 / 60);
                }
            }
            return { leg: boat.raceState.leg, sweepDeg: Math.round((boat.raceState.roundSweep || 0) * 180 / Math.PI) };
        };

        const R = m.zone;
        const at = (deg, rad) => ({ x: m.x + Math.cos(deg * Math.PI / 180) * rad, y: m.y + Math.sin(deg * Math.PI / 180) * rad });
        const sgn = m.side === 'port' ? -1 : 1;
        const far = R * 2.2;

        // 1. A PROPER ROUNDING: come in from 135, go the required way round, leave at 135.
        //    That is what Glacier Sound's out-and-back actually requires.
        const proper = [at(135, far)];
        for (let k = 0; k <= 24; k++) proper.push(at(135 + sgn * 360 * (k / 24), R * 0.75));
        proper.push(at(135, far));
        o.proper = run(proper);

        // 2. A FULL TURN INSIDE THE ZONE that does NOT enclose the mark, then leave the way
        //    it came. This is the reported bug: a spin is not a rounding.
        const spinC = at(135, R * 0.75);          // circle centre, inside the zone
        const spinR = R * 0.18;                   // small enough to not contain the mark
        const spin = [at(135, far), spinC];
        for (let k = 0; k <= 24; k++) {
            const a = sgn * 360 * (k / 24) * Math.PI / 180;
            spin.push({ x: spinC.x + Math.cos(a) * spinR, y: spinC.y + Math.sin(a) * spinR });
        }
        spin.push(at(135, far));
        o.spin = run(spin);
        o.spinEnclosesMark = Math.hypot(spinC.x - m.x, spinC.y - m.y) < spinR;

        // 3. IN AND STRAIGHT BACK OUT, no rounding at all.
        o.inOut = run([at(135, far), at(135, R * 0.6), at(135, far)]);

        // 4. PAST IT, close aboard, without going round — a straight line by the mark.
        //    Sweeps ~180 degrees of bearing all on its own.
        o.past = run([at(200, far), at(70, far)]);

        // 5. STRAIGHT THROUGH THE ZONE, close past the mark, and away. This sweeps well
        //    over 100 degrees of bearing without going ROUND anything — and on an
        //    out-and-back course it leaves the boat on the far side, nowhere near the next
        //    mark. The suspected report: "a full turn in the circle without rounding".
        o.chord = run([at(200, far), at(200, R * 0.5), at(70, R * 0.5), at(70, far)]);

        // 6. A PARTIAL SWEEP the right way, then away. Glacier Sound is an out-and-back:
        //    the boat has to come back toward the line it started from, so a 60-degree
        //    nibble at the mark is nowhere near a rounding. The engine's threshold was a
        //    flat 45 degrees, which this clears easily.
        const partial = [at(135, far)];
        for (let k = 0; k <= 8; k++) partial.push(at(135 + sgn * 60 * (k / 8), R * 0.7));
        partial.push(at(135 + sgn * 60, far));
        o.partial = run(partial);

        // 7. THE WRONG WAY ROUND.
        const wrong = [at(135, far)];
        for (let k = 0; k <= 24; k++) wrong.push(at(135 - sgn * 360 * (k / 24), R * 0.75));
        wrong.push(at(135, far));
        o.wrong = run(wrong);
        return o;
    });
    await browser.close();

    console.log(`rounding "${r.mark.side}" at zone ${r.mark.zone}\n`);
    check('a proper rounding completes the leg', r.proper.leg === 2, `leg ${r.proper.leg}, sweep ${r.proper.sweepDeg}°`);
    check('the spin circle really does not enclose the mark', r.spinEnclosesMark === false);
    check('a full turn INSIDE the zone does not count as rounding',
          r.spin.leg === 1, `leg ${r.spin.leg}, sweep ${r.spin.sweepDeg}°`);
    check('entering the zone and leaving again does not count',
          r.inOut.leg === 1, `leg ${r.inOut.leg}, sweep ${r.inOut.sweepDeg}°`);
    check('sailing PAST the mark does not count', r.past.leg === 1, `leg ${r.past.leg}, sweep ${r.past.sweepDeg}°`);
    check('sailing THROUGH the zone past the mark does not count on an out-and-back',
          r.chord.leg === 1, `leg ${r.chord.leg}, sweep ${r.chord.sweepDeg}°`);
    check('a 60-degree nibble does not round an out-and-back mark',
          r.partial.leg === 1, `leg ${r.partial.leg}, sweep ${r.partial.sweepDeg}°`);
    check('going the wrong way round does not count', r.wrong.leg === 1, `leg ${r.wrong.leg}, sweep ${r.wrong.sweepDeg}°`);
    check('no page errors', errs.length === 0, errs[0]);

    console.log(`\n${fails ? 'FAIL' : 'PASS'} — ${fails} failure(s)`);
    process.exit(fails ? 1 : 0);
})();
