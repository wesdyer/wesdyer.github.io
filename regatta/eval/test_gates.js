// Through gates versus round gates.
//
//   node regatta/eval/test_gates.js
//
// The distinction that matters: with a ROUND gate, sailing through and coming straight
// back down must NOT count — you have to leave it round an end. With a THROUGH gate,
// crossing it once in the required direction is the whole requirement, and coming back
// afterwards is nobody's business.
//
// A boat is driven along a known path, so a failure is the leg engine, not navigation.
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

    const r = await page.evaluate(() => {
        // Open water, wind blowing so up-course is -y, a start line at +y and one gate.
        const mk = (pass) => ({
            schema: 1, venue: 'gatetest',
            world: { size: 9000, boundary: { poly: [[-4500,-4500],[4500,-4500],[4500,4500],[-4500,4500]], circle: null } },
            land: [{ id: 'far', cls: 'granite', style: 'granite', soft: false, c: [4100, 4100], r: 150,
                     outer: [[4000,4000],[4200,4000],[4200,4200],[4000,4200]], holes: [] }],
            course: {
                legs: 2,
                marks: [
                    { id: 'sf-pin',  x: -550, y: 2000, kind: 'inflatable' },
                    { id: 'sf-boat', x:  550, y: 2000, kind: 'inflatable' },
                    { id: 'gate-a',  x: -400, y: -1000, kind: 'inflatable' },
                    { id: 'gate-b',  x:  400, y: -1000, kind: 'inflatable' }
                ],
                route: [
                    { kind: 'line', marks: [0, 1], dir: 1,  role: 'start' },
                    { kind: 'gate', marks: [2, 3], dir: 1,  role: 'gate', pass },
                    { kind: 'line', marks: [0, 1], dir: -1, role: 'finish', finish: true }
                ]
            },
            wind: { mode: 'fixed', baseDirection: 0 },
            seeded: {}
        });
        VENUES.gatetest = { name: 'Gate Test', label: 'GT', emoji: '🚪', fx: { mask: true } };

        // Sail up through the gate, then straight back DOWN through it — never round an end.
        const throughAndBack = (pass) => {
            window.VENUE_DOC.gatetest = mk(pass);
            localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'gatetest' }));
            let s = 4242;
            Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1);
                t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
            resetGame(); startRace();
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
            glide(0, 1500, 40);        // cross the START -> leg 1
            const afterStart = boat.raceState.leg;
            glide(0, -1400, 80);       // up THROUGH the gate
            const afterUp = boat.raceState.leg;
            const arming = boat.raceState.isRounding;
            glide(0, -600, 40);        // straight back DOWN through the same gate
            const afterBack = boat.raceState.leg;
            const armingAfter = boat.raceState.isRounding;
            // Now do it properly. After an abort the gate has to be crossed AGAIN to
            // re-arm — you cannot bail out and then claim the rounding — so go back up
            // through the segment first, then out past the left end and back down across
            // its extension.
            glide(0, -1400, 60);
            const rearmed = boat.raceState.isRounding;
            glide(-900, -1400, 40);
            glide(-900, -500, 40);
            const afterRound = boat.raceState.leg;
            return { afterStart, afterUp, arming, afterBack, armingAfter, rearmed, afterRound };
        };

        return { round: throughAndBack('round'), through: throughAndBack('through') };
    });
    await browser.close();

    console.log('through gates vs round gates\n');
    check('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));

    console.log('  ROUND gate');
    check('crossing the start advances to leg 1', r.round.afterStart === 1, `leg ${r.round.afterStart}`);
    check('sailing up through it does NOT complete the leg', r.round.afterUp === 1, `leg ${r.round.afterUp}`);
    check('...it arms the rounding instead', r.round.arming === true);
    check('coming back down through it does not complete it either', r.round.afterBack === 1, `leg ${r.round.afterBack}`);
    check('...and it disarms — the rounding is aborted', r.round.armingAfter === false);
    check('re-crossing the gate re-arms it', r.round.rearmed === true);
    check('then leaving it round an END does complete it', r.round.afterRound === 2, `leg ${r.round.afterRound}`);

    console.log('  THROUGH gate');
    check('crossing the start advances to leg 1', r.through.afterStart === 1, `leg ${r.through.afterStart}`);
    check('sailing through it completes the leg immediately', r.through.afterUp === 2, `leg ${r.through.afterUp}`);
    check('coming back down afterwards changes nothing', r.through.afterBack === 2, `leg ${r.through.afterBack}`);

    console.log(`\n${failures ? 'FAIL' : 'PASS'} — ${failures} failure(s)`);
    process.exitCode = failures ? 1 : 0;
})();
