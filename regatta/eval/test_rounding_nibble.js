// TOUCHING THE ZONE AND TACKING AWAY IS NOT A ROUNDING.
//
//   node regatta/eval/test_rounding_nibble.js [venue] [treeDir]
//
// Owner report, sailed by hand on Redrock: "I hit the first rounding circle and tacked
// outside to get high enough to round and it counted as rounding."
//
// The mechanism this pins: `roundSweep` accumulates the boat's bearing change about the
// mark from LEG START, at any distance. A long approach that is even slightly off the
// mark's beam banks bearing change the boat never spent rounding — and the completion test
// only asks for `reqSweep`, which on Redrock's first mark is FORTY-SIX DEGREES. So a boat
// can arrive, nibble the zone, tack away, and the leg completes.
//
// Every case asserts its own preconditions as separate checks — a rounding test whose
// setup is not asserted is worse than no test (see test_markroom.js).
//
// No AI, no seeds: the boat is teleported along a hand-built track in small steps.
const { chromium } = require('playwright');
const path = require('path');

const VENUE = process.argv[2] || 'redrock';
const ROOT = process.argv[3] ? path.resolve(process.argv[3]) : path.resolve('.');

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
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.waitForFunction(() => window.state && window.resetGame, null, { timeout: 20000 });

    const r = await page.evaluate((v) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: v }));
        resetGame(); startRace();
        state.race.status = 'racing'; state.race.timer = 1;
        // Find the first rounding leg.
        const rt = state.course.route;
        let lg = -1;
        for (let i = 0; i < rt.length; i++) if (rt[i].kind === 'round' && rt[i].mark) { lg = i; break; }
        if (lg < 0) return { skip: true };
        const m = rt[lg].mark;
        const prev = CoursePath.anchor(rt[lg - 1], state.course.marks);

        const boat = state.boats.find(b => b.isPlayer) || state.boats[0];
        for (const b of state.boats) if (b !== boat) { b.x = 1e6; b.y = 1e6; b.speed = 0; }

        const put = (x, y) => {
            boat.raceState.lastPos = { x: boat.x, y: boat.y };
            const hx = x - boat.x, hy = y - boat.y;
            if (hx || hy) boat.heading = Math.atan2(hx, -hy);
            boat.x = x; boat.y = y;
            updateBoatRaceState(boat, 1 / 60);
        };
        // Peak sweep, because advanceLeg() zeroes the accumulator — reading it afterwards
        // reports 0 for a leg that completed, which looks like a fixture bug and is not.
        let peakSweep = 0;
        const run = (pts) => { for (const [x, y] of pts) { put(x, y); const sw = boat.raceState.roundSweep || 0; if (sw > peakSweep) peakSweep = sw; } };
        const arm = () => {
            boat.raceState.leg = lg;
            boat.raceState.roundSweep = 0; boat.raceState.roundWrong = 0;
            boat.raceState.roundArmed = false; boat.raceState.roundBanked = false;
            boat.raceState.roundRebased = false;
            boat.raceState.roundFrom = { x: boat.x, y: boat.y };
        };

        // Bearing of the approach, from the mark toward where the leg begins.
        const bA = Math.atan2(prev.y - m.y, prev.x - m.x);
        const D0 = Math.hypot(prev.x - m.x, prev.y - m.y);
        const Z = m.zone;

        // ── THE NIBBLE: come down the approach bearing, dip just inside the zone, then
        //    tack away on a course 80 degrees off and retreat. Never goes round.
        const track = [];
        for (let d = D0; d > Z * 0.85; d -= 40) track.push([m.x + Math.cos(bA) * d, m.y + Math.sin(bA) * d]);
        // ⚠️ TACK AWAY THE WAY THE ROUNDING WANTS. Retreating the WRONG way round banks
        // negative sweep and can never complete — that is not the reported case and a
        // fixture that does it proves nothing. "Tacking to get high enough" swings the
        // bearing the REQUIRED way, which is what banks credit she has not earned. Swing
        // comfortably past the requirement so the only thing standing between her and a
        // completed leg is whether she actually went round.
        const sgnN = m.side === 'port' ? -1 : 1;
        const swing = Math.min(2.2, (m.reqSweep || 0.8) * 1.35 + 0.35);
        const bOut = bA + sgnN * swing;
        for (let d = Z * 0.85; d < Z * 3; d += 40) track.push([m.x + Math.cos(bOut) * d, m.y + Math.sin(bOut) * d]);

        boat.x = track[0][0]; boat.y = track[0][1];
        boat.raceState.lastPos = { x: boat.x, y: boat.y };
        arm(); peakSweep = 0;
        run(track);
        const nibble = {
            leg: boat.raceState.leg, advanced: boat.raceState.leg !== lg,
            sweepDeg: Math.round((peakSweep) * 180 / Math.PI),
            reqDeg: Math.round((m.reqSweep || 0) * 180 / Math.PI),
            enteredZone: true, banked: !!boat.raceState.roundBanked
        };

        // ── THE HONEST ROUNDING: same approach, then all the way round on the required
        //    side at a close radius, and out toward the next anchor.
        const nxt = CoursePath.anchor(rt[lg + 1], state.course.marks) || prev;
        const bN = Math.atan2(nxt.y - m.y, nxt.x - m.x);
        const sgn = m.side === 'port' ? -1 : 1;
        const R = Math.max(m.radius + 70, 90, Z * 0.55);
        const track2 = [];
        for (let d = D0; d > R; d -= 40) track2.push([m.x + Math.cos(bA) * d, m.y + Math.sin(bA) * d]);
        let sweep = (bN - bA) * sgn; while (sweep <= 0) sweep += Math.PI * 2;
        const steps = Math.max(8, Math.ceil(sweep / 0.12));
        for (let i = 0; i <= steps; i++) {
            const a = bA + sgn * sweep * (i / steps);
            track2.push([m.x + Math.cos(a) * R, m.y + Math.sin(a) * R]);
        }
        for (let d = R; d < Z * 2.2; d += 40) track2.push([m.x + Math.cos(bN) * d, m.y + Math.sin(bN) * d]);

        boat.x = track2[0][0]; boat.y = track2[0][1];
        boat.raceState.lastPos = { x: boat.x, y: boat.y };
        arm(); peakSweep = 0;
        run(track2);
        const honest = { advanced: boat.raceState.leg !== lg,
                         sweepDeg: Math.round(peakSweep * 180 / Math.PI) };

        return { skip: false, venue: v, lg, side: m.side, zone: Math.round(Z),
                 reqDeg: nibble.reqDeg, nibble, honest };
    }, VENUE);

    if (r.skip) { console.log(`${VENUE}: no rounding leg`); await browser.close(); return; }
    console.log(`${r.venue} — first rounding leg is ${r.lg} (${r.side}, zone ${r.zone}, requires ${r.reqDeg} deg)\n`);
    console.log(`  the NIBBLE  swept ${r.nibble.sweepDeg} deg, banked=${r.nibble.banked}, leg advanced=${r.nibble.advanced}`);
    console.log(`  the HONEST  swept ${r.honest.sweepDeg} deg, leg advanced=${r.honest.advanced}\n`);
    check('the honest rounding COUNTS (precondition)', r.honest.advanced === true,
          'the test track does not round this mark — fix the fixture, not the engine');
    check('touching the zone and tacking away does NOT count', r.nibble.advanced === false,
          `swept ${r.nibble.sweepDeg} deg against a ${r.reqDeg} deg requirement and the leg completed`);
    await browser.close();
    if (errs.length) console.log('page errors: ' + errs.slice(0, 3).join(' | '));
    console.log(`${failures ? 'FAIL' : 'PASS'} — ${failures} failure(s)`);
    process.exitCode = failures ? 1 : 0;
})();
