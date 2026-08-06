// DOES CROSSING THE START LINE REGISTER? — on every venue, both ways.
//
//   node regatta/eval/test_start_crossing.js [venue]
//
// A boat is driven by hand from the pre-start side, across the line, and the engine is
// asked whether she started. Then the same from the wrong side, and the OCS path: over
// early, back, and across again.
//
// Three things this pins down, each of which has been wrong:
//
//   - the crossing direction is authored per route entry (`dir`), and two venues author
//     -1. Anything that hardcodes +1 is inverted on those.
//   - `updateBoatRaceState` requires `legEntry.marks`; a start entry without one is never
//     tested at all and the boat can sail through the line for ever.
//   - OCS blocks the start until it is cleared, so "crossed and nothing happened" is the
//     correct behaviour for an over-early boat and a bug for anyone else.
//
// No AI, no physics, no seeds: the boat is teleported along a straight line in small steps
// so `lastPos` -> position always spans the line the way a real crossing would.
const { chromium } = require('playwright');
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
    await page.goto('file://' + path.resolve('regatta/index.html'));
    await page.waitForFunction(() => window.state && window.resetGame, null, { timeout: 20000 });

    const venues = await page.evaluate(() => Object.keys(window.VENUE_DOC || {}));
    const list = ONLY ? [ONLY] : venues;
    console.log(`Start-line crossing — ${list.length} venue(s)\n`);

    for (const venue of list) {
        const r = await page.evaluate((v) => {
            localStorage.setItem('regatta_settings', JSON.stringify({ venue: v }));
            resetGame(); startRace();
            const e0 = state.course.route[0];
            const out = { kind: e0.kind, role: e0.role || null, dir: e0.dir, hasMarks: !!e0.marks };
            if (!e0.marks) return out;                       // the fatal case, reported as-is
            const m0 = state.course.marks[e0.marks[0]], m1 = state.course.marks[e0.marks[1]];
            const mid = { x: (m0.x + m1.x) / 2, y: (m0.y + m1.y) / 2 };
            const dx = m1.x - m0.x, dy = m1.y - m0.y, L = Math.hypot(dx, dy) || 1;
            const s = (e0.dir < 0) ? -1 : 1;
            const nx = s * dy / L, ny = -s * dx / L;         // + = course side, per the route

            const boat = state.boats.find(b => b.isPlayer) || state.boats[0];
            for (const b of state.boats) if (b !== boat) { b.x = 1e6; b.y = 1e6; b.speed = 0; }

            // Drive from `from` to `to` in 6-unit steps, stepping the race state each time.
            const drive = (fromD, toD) => {
                const steps = Math.max(2, Math.ceil(Math.abs(toD - fromD) / 6));
                for (let i = 0; i <= steps; i++) {
                    const d = fromD + (toD - fromD) * (i / steps);
                    boat.raceState.lastPos = { x: boat.x, y: boat.y };
                    boat.x = mid.x + nx * d; boat.y = mid.y + ny * d;
                    boat.heading = Math.atan2(nx * Math.sign(toD - fromD), -(ny * Math.sign(toD - fromD)));
                    updateBoatRaceState(boat, 1 / 60);
                }
            };
            const reset = () => {
                boat.raceState.leg = 0; boat.raceState.ocs = false;
                boat.x = mid.x - nx * 300; boat.y = mid.y - ny * 300;
                boat.raceState.lastPos = { x: boat.x, y: boat.y };
            };

            // ── A. the ordinary start: racing, from behind, across ──────────
            state.race.status = 'racing'; state.race.timer = 1;
            reset(); drive(-300, 300);
            out.startedForward = boat.raceState.leg === 1;

            // ── B. the wrong way does NOT start her ─────────────────────────
            reset(); boat.x = mid.x + nx * 300; boat.y = mid.y + ny * 300;
            boat.raceState.lastPos = { x: boat.x, y: boat.y };
            drive(300, -300);
            out.startedBackward = boat.raceState.leg === 1;

            // ── C. over early in the prestart is FLAGGED ────────────────────
            state.race.status = 'prestart'; state.race.timer = 10;
            reset(); drive(-300, 300);
            out.ocsFlagged = !!boat.raceState.ocs;

            // ── D. ...and returning CLEARS it, and she can then start ───────
            drive(300, -300);
            out.ocsCleared = !boat.raceState.ocs;
            state.race.status = 'racing'; state.race.timer = 1;
            drive(-300, 300);
            out.startedAfterReturn = boat.raceState.leg === 1;
            return out;
        }, venue);

        console.log(`${venue}  (${r.kind}${r.role ? '/' + r.role : ''}, dir ${r.dir})`);
        check('the start entry carries its mark pair', r.hasMarks,
              'no `marks` on route[0] — updateBoatRaceState never tests the line at all');
        if (!r.hasMarks) { console.log(''); continue; }
        check('crossing from the pre-start side starts her', r.startedForward === true);
        check('crossing the other way does NOT start her', r.startedBackward === false);
        check('over early in the prestart is flagged OCS', r.ocsFlagged === true);
        check('returning clears OCS', r.ocsCleared === true);
        check('...and she can then start', r.startedAfterReturn === true);
        console.log('');
    }
    await browser.close();
    if (errs.length) console.log('page errors: ' + errs.slice(0, 3).join(' | '));
    console.log(`${failures ? 'FAIL' : 'PASS'} — ${failures} failure(s)`);
    process.exitCode = failures ? 1 : 0;
})();
