// THE STRING RULE — does a rounding that did not go round get counted?
//
// RRS, Sail the Course: "a string representing her track until she finishes, when
// drawn taut, (1) passes each mark of the course for the race on the required
// side and in the correct order ... (2) TOUCHES each mark designated in the
// sailing instructions to be a ROUNDING MARK". (1) applies to every mark; (2) is
// what makes a rounding a rounding, and it is the geometric definition — the
// taut string must TOUCH the mark, i.e. the track has to bend around it. Note
// what it does NOT say: there is no proximity requirement, so going all the way
// round at a distance is a legal rounding, merely slow. And there is no
// tolerance in either sentence. The engine completes a rounding at
// `roundSweep >= reqSweep * ROUND_SWEEP_TOL` with ROUND_SWEEP_TOL = 0.75, and the
// AI's own exit logic targets that same discounted number, so boats are not
// exploiting a gap they discovered — they are aimed at 75% of a rounding.
//
// Measured on the shipped build (`_rounding_truth_probe.js`):
//   bay     34% of completed roundings banked less than the full requirement,
//           28% NEVER ENTERED THE ZONE, minimum fraction 0.74
//   arctic  85% banked less than the full requirement, median 0.83, min 0.75
//
// ⚠️ These tests are written to FAIL on the current build. They are the safety net
// for changing rounding — a thing this campaign has got wrong several times — and
// they pin both directions: a corner-cut must not count, and a legitimate wide
// rounding must still count (the string rule has no proximity requirement either,
// so a boat that goes all the way round at distance HAS rounded).
//
// node regatta/eval/test_rounding_string.js
const { chromium } = require('playwright');
const path = require('path');

let fails = 0;
const check = (name, ok, detail) => {
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}${ok || !detail ? '' : ' — ' + detail}`);
    if (!ok) fails++;
};

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.addInitScript(() => localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' })));
    await page.goto('file://' + path.resolve('regatta/index.html'));
    await page.waitForFunction(() => window.state && window.state.course && window.state.course.marks);

    // Walk a boat along a scripted arc around this leg's rounding mark and report
    // whether the leg advanced. `frac` is the fraction of the FULL geometric
    // requirement swept; `radius` is in zone radii.
    const runArc = (frac, radiusZones) => page.evaluate(([frac, radiusZones]) => {
        window.resetGame(); window.startRace();
        // ⚠️ startRace leaves the race in PRESTART with the timer counting down,
        // and the rounding machinery only runs while racing — script the boat
        // before that and the sweep accumulator never turns over (it reads 0 and
        // every case looks like "did not round").
        for (let i = 0; i < 60 * 120 && state.race.status !== 'racing'; i++) window.update(1 / 60);
        const b = state.boats.find(x => !x.isPlayer);
        for (const o of state.boats) if (o !== b) { o.x = -99999; o.y = -99999; o.raceState.finished = true; }
        b.raceState.leg = 1; b.raceState.lastPos = { x: b.x, y: b.y };
        b.raceState.roundSweep = 0; b.raceState.roundArmed = false;
        const rm = (typeof legRoundMark === 'function' ? legRoundMark(1) : null) || state.course.roundMark;
        if (!rm || rm.reqSweep == null) return { skip: true };
        const need = rm.reqSweep, sgn = rm.side === 'port' ? -1 : 1;
        const R = rm.zone * radiusZones;
        const a0 = Math.atan2(b.y - rm.y, b.x - rm.x);
        const startLeg = b.raceState.leg;
        // ⚠️ advanceLeg RESETS roundSweep, so it must be captured on the frame
        // before the leg turns over or every completed case reads 0.
        let sweptAt = 0;
        const steps = 400;
        for (let i = 0; i <= steps; i++) {
            const a = a0 + sgn * (need * frac) * (i / steps);
            const nx = rm.x + Math.cos(a) * R, ny = rm.y + Math.sin(a) * R;
            b.heading = Math.atan2(nx - b.x, -(ny - b.y));
            b.x = nx; b.y = ny; b.speed = 1.5;
            sweptAt = b.raceState.roundSweep || sweptAt;
            window.update(1 / 60);
            if (b.raceState.leg !== startLeg) break;
        }
        // then sail away, which is what lets a completed rounding be recognised
        for (let i = 0; i < 240 && b.raceState.leg === startLeg; i++) {
            const a = a0 + sgn * need * frac;
            b.x += Math.cos(a) * 12; b.y += Math.sin(a) * 12;
            sweptAt = b.raceState.roundSweep || sweptAt;
            window.update(1 / 60);
        }
        return { advanced: b.raceState.leg !== startLeg, swept: sweptAt, need };
    }, [frac, radiusZones]);

    console.log('\nTHE STRING RULE — what counts as a rounding\n');

    const full = await runArc(1.0, 0.8);
    if (full.skip) { console.log('  (this venue has no rounding mark on leg 1 — skipped)'); await browser.close(); return; }
    check('a FULL rounding at the ring completes the leg', full.advanced === true,
          `swept ${full.swept && full.swept.toFixed(2)} of ${full.need.toFixed(2)}`);

    const cut80 = await runArc(0.80, 0.8);
    check('a rounding that sweeps only 80% must NOT complete', cut80.advanced === false,
          `advanced with ${cut80.swept && cut80.swept.toFixed(2)} of ${cut80.need.toFixed(2)} — the string does not pass the mark on the required side`);

    const cut60 = await runArc(0.60, 0.8);
    check('a rounding that sweeps only 60% must NOT complete', cut60.advanced === false,
          `advanced with ${cut60.swept && cut60.swept.toFixed(2)} of ${cut60.need.toFixed(2)}`);

    // The string rule has no proximity requirement: going all the way round at a
    // distance is legal, merely slow. Pin it so a fix does not over-correct into
    // "must enter the zone", which is NOT what the rule says.
    const wide = await runArc(1.0, 2.5);
    check('a FULL rounding well outside the zone still completes', wide.advanced === true,
          `did not advance despite sweeping ${wide.swept && wide.swept.toFixed(2)} of ${wide.need.toFixed(2)} at 2.5x zone`);

    const wideCut = await runArc(0.80, 2.5);
    check('a WIDE 80% pass must NOT complete either', wideCut.advanced === false,
          `advanced with ${wideCut.swept && wideCut.swept.toFixed(2)} of ${wideCut.need.toFixed(2)}`);

    if (errs.length) check('no page errors', false, errs[0]);
    console.log(`\n${fails ? 'FAIL' : 'PASS'} — ${fails} failure(s)\n`);
    await browser.close();
    process.exit(fails ? 1 : 0);
})();
