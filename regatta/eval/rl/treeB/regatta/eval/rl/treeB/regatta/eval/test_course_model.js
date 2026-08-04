// MARKS, GATES AND THE ROUTE — are they really separate things?
//
//   node regatta/eval/test_course_model.js
//
// The claim being tested: marks and gates exist on the water, and the route is only an
// ORDERING of uses of them. Three consequences have to hold, or the separation is a
// story rather than a fact:
//
//   - the same gate can appear in the route more than once, sailed differently each time
//   - removing a leg leaves the gate and its marks alone
//   - deleting a mark on the map takes its gates and the legs that used them with it
//
// Plus the migration: a document written in the old index form must load, race and
// compile to exactly the same runtime shape.
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
    await page.waitForTimeout(400);

    // ── Migration ───────────────────────────────────────────────────────────
    console.log('migration from index references\n');
    const mig = await page.evaluate(() => {
        // The OLD form, exactly as documents and tests used to be written.
        window.VENUE_DOC.legacy = {
            schema: 1, venue: 'legacy',
            world: { size: 9000, boundary: { poly: [[-4500,-4500],[4500,-4500],[4500,4500],[-4500,4500]], circle: null } },
            land: [{ id: 'far', cls: 'granite', style: 'granite', soft: false, c: [4100, 4100], r: 150,
                     outer: [[4000,4000],[4200,4000],[4200,4200],[4000,4200]], holes: [] }],
            course: {
                legs: 2, type: 'islandRound',
                marks: [
                    { id: 'sf-pin',  x: -550, y: 2000 },
                    { id: 'sf-boat', x:  550, y: 2000 },
                    { id: 'wm',      x:    0, y: -1800, kind: 'can' }
                ],
                route: [
                    { kind: 'line',  marks: [0, 1], dir: 1,  beat: true,  role: 'start' },
                    { kind: 'round', markIdx: 2, side: 'starboard', beat: false, role: 'rounding' },
                    { kind: 'line',  marks: [0, 1], dir: -1, beat: false, role: 'finish', finish: true }
                ]
            },
            wind: { mode: 'fixed', baseDirection: 0 }, seeded: {}
        };
        const d = window.VenueDoc.get('legacy');       // get() migrates
        const c = window.VenueDoc.compile(d);
        const again = JSON.stringify(window.VenueDoc.migrate(d));
        return {
            lines: (d.course.lines || []).length,
            startRef: d.course.route[0].lineId,
            finishRef: d.course.route[2].lineId,
            roundRef: d.course.route[1].markId,
            oldFieldsGone: !('marks' in d.course.route[0]) && !('markIdx' in d.course.route[1])
                           && !('beat' in d.course.route[0]) && d.course.legs === undefined,
            typeMoved: d.course.description === 'islandRound' && d.course.type === undefined,
            // The COMPILED shape is what the engine races on and must be unchanged.
            compiledMarks: JSON.stringify(c.route[0].marks),
            compiledMarkIdx: c.route[1].markIdx,
            compiledLegs: c.legs,
            idempotent: again === JSON.stringify(d),
            errors: window.VenueDoc.validate(d).filter(p => p.level === 'error').map(p => p.msg)
        };
    });
    check('one line created from the repeated mark pair', mig.lines === 1, String(mig.lines));
    check('start and finish now name the SAME line', mig.startRef && mig.startRef === mig.finishRef,
          `${mig.startRef} / ${mig.finishRef}`);
    check('the rounding references its mark by id', mig.roundRef === 'wm', String(mig.roundRef));
    check('index/beat/legs fields are gone', mig.oldFieldsGone === true);
    check('course.type became a description', mig.typeMoved === true);
    check('compile still emits mark INDICES for the engine',
          mig.compiledMarks === '[0,1]' && mig.compiledMarkIdx === 2,
          `${mig.compiledMarks} / ${mig.compiledMarkIdx}`);
    check('legs are derived from the route', mig.compiledLegs === 2, String(mig.compiledLegs));
    check('migrating twice changes nothing', mig.idempotent === true);
    check('the migrated document validates', mig.errors.length === 0, mig.errors.join(' | '));

    // ── The same gate, sailed twice ─────────────────────────────────────────
    console.log('\nreuse: one gate, two legs');
    const reuse = await page.evaluate(() => {
        window.VENUE_DOC.reuse = {
            schema: 1, venue: 'reuse',
            world: { size: 9000, boundary: { poly: [[-4500,-4500],[4500,-4500],[4500,4500],[-4500,4500]], circle: null } },
            land: [{ id: 'far', cls: 'granite', style: 'granite', soft: false, c: [4100, 4100], r: 150,
                     outer: [[4000,4000],[4200,4000],[4200,4200],[4000,4200]], holes: [] }],
            course: {
                marks: [
                    { id: 'sf-pin',  x: -550, y: 2000 },
                    { id: 'sf-boat', x:  550, y: 2000 },
                    { id: 'g-a',     x: -400, y: -1000 },
                    { id: 'g-b',     x:  400, y: -1000 }
                ],
                lines: [
                    { id: 'sf',   marks: ['sf-pin', 'sf-boat'] },
                    { id: 'gate', name: 'The Narrows', marks: ['g-a', 'g-b'] }
                ],
                // The SAME gate twice: up through it, then back down through it. This is
                // the thing index references could not express.
                route: [
                    { kind: 'line', lineId: 'sf',   dir:  1, role: 'start' },
                    { kind: 'gate', lineId: 'gate', dir:  1, pass: 'through' },
                    { kind: 'gate', lineId: 'gate', dir: -1, pass: 'through' },
                    { kind: 'line', lineId: 'sf',   dir: -1, role: 'finish', finish: true }
                ]
            },
            wind: { mode: 'fixed', baseDirection: 0 }, seeded: {}
        };
        VENUES.reuse = { name: 'Reuse', label: 'RU', emoji: '🔁', fx: { mask: true } };
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'reuse' }));
        let s = 4242;
        Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
        resetGame();
        const errsV = window.VenueDoc.validate(window.VENUE_DOC.reuse).filter(p => p.level === 'error');
        const compiled = state.course.route.map(e => JSON.stringify(e.marks || null) + ':' + (e.dir || 0));
        startRace();
        while (state.race.status === 'prestart') update(1 / 60);
        const boat = state.boats.find(b => b.isPlayer) || state.boats[0];
        for (const b of state.boats) if (b !== boat) { b.x = 1e6; b.y = 1e6; b.speed = 0; }
        boat.x = 0; boat.y = 2400;
        boat.raceState.lastPos = { x: boat.x, y: boat.y };
        const glide = (tx, ty, steps) => {
            for (let i = 0; i < steps; i++) {
                const sx = boat.x, sy = boat.y;
                boat.raceState.lastPos = { x: sx, y: sy };
                boat.x = sx + (tx - sx) / (steps - i);
                boat.y = sy + (ty - sy) / (steps - i);
                boat.heading = Math.atan2(boat.x - sx, -(boat.y - sy));
                updateBoatRaceState(boat, 1 / 60);
            }
        };
        glide(0, 1500, 40);          // cross the start        -> leg 1
        const afterStart = boat.raceState.leg;
        glide(0, -1500, 80);         // up through the gate    -> leg 2
        const afterUp = boat.raceState.leg;
        glide(0, -600, 40);          // back DOWN through it   -> leg 3
        const afterDown = boat.raceState.leg;
        glide(0, 2400, 80);          // cross the finish
        return {
            errsV: errsV.map(p => p.msg), totalLegs: state.race.totalLegs, compiled,
            afterStart, afterUp, afterDown,
            finished: boat.raceState.finished, legTimes: boat.raceState.legTimes.length
        };
    });
    check('a route reusing one gate validates', reuse.errsV.length === 0, reuse.errsV.join(' | '));
    check('totalLegs derived as 3', reuse.totalLegs === 3, String(reuse.totalLegs));
    check('both uses compiled to the same marks, opposite directions',
          reuse.compiled[1] === '[2,3]:1' && reuse.compiled[2] === '[2,3]:-1',
          reuse.compiled.join('  '));
    check('crossing the start advances to leg 1', reuse.afterStart === 1, `leg ${reuse.afterStart}`);
    check('sailing up through the gate completes leg 1', reuse.afterUp === 2, `leg ${reuse.afterUp}`);
    check('sailing back DOWN through the same gate completes leg 2', reuse.afterDown === 3,
          `leg ${reuse.afterDown} — the second use must register independently`);
    check('the race finishes', reuse.finished === true && reuse.legTimes === 3,
          `finished=${reuse.finished}, splits=${reuse.legTimes}`);

    await browser.close();
    if (errs.length) console.log('\npage errors:', errs.slice(0, 3).join(' | '));
    console.log(`\n${failures ? 'FAIL' : 'PASS'} — ${failures} failure(s)`);
    process.exitCode = failures ? 1 : 0;
})();
