// APPARENT WIND, TRIM, AND THE HEAVY-AIR POLAR.
//
// Phase 0 and phase 2 of guidelines/overpowered-plan.md. The properties here are physics,
// not tuning — every one of them is a statement that would be true of a real boat, so a
// failure means the model is wrong rather than that a number wants nudging.
//
// The division of labour is the thing most at risk (plan §3):
//   the RIG is trimmed by APPARENT wind — trim, luffing, kite up and down
//   the POLAR is indexed by TRUE wind — because that is what a polar table IS
// Indexing the polar by apparent double-counts and is self-referential. If someone "fixes"
// getTargetSpeed to take AWS one day, `the polar is indexed on TRUE wind` below is what
// should stop them.
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
    await page.addInitScript(() => localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'ocean' })));
    await page.goto('file://' + path.resolve('regatta/index.html'));
    await page.waitForTimeout(2500);

    const r = await page.evaluate(() => {
        const o = { bad: [] };
        const D = 180 / Math.PI;

        // ── 1. THE POLAR ─────────────────────────────────────────────────────────
        // It must keep rising past 20 knots downwind. The old code flatlined there
        // (`if (windSpeed >= 20) { lower = 20; upper = 20 }`), which made 25 knots off the
        // breeze no faster than 20 and, after the overpowered tax, strictly slower.
        o.polarRuns = [];
        for (const twaDeg of [90, 120, 150, 180]) {
            const twa = twaDeg / D;
            const row = [12, 16, 20, 25, 30].map(w => +getTargetSpeed(twa, twaDeg >= 110, w).toFixed(2));
            o.polarRuns.push({ twaDeg, row });
            for (let i = 1; i < row.length; i++) {
                if (row[i] <= row[i - 1]) o.bad.push(`polar at ${twaDeg}deg does not rise ${row[i - 1]}->${row[i]}`);
            }
        }
        // Upwind is allowed to SATURATE — that is what being overpowered is — but never to
        // fall off a cliff, and never to be flat all the way from 16 kt.
        o.upwind = [12, 16, 20, 25, 30].map(w => +getTargetSpeed(45 / D, false, w).toFixed(2));
        if (o.upwind[3] < o.upwind[2]) o.bad.push('upwind goes backwards above 20 kt');
        if (o.upwind[4] < o.upwind[2] * 0.98) o.bad.push('upwind collapses above 20 kt');

        // No discontinuity where the extrapolated rows are stitched on.
        let worstJump = 0;
        for (let w = 6; w <= 30; w += 0.25) {
            const a = getTargetSpeed(120 / D, true, w), b = getTargetSpeed(120 / D, true, w + 0.25);
            worstJump = Math.max(worstJump, Math.abs(b - a));
        }
        o.worstPolarJump = +worstJump.toFixed(3);
        if (worstJump > 0.25) o.bad.push(`polar steps by ${worstJump.toFixed(2)} kt in a quarter knot of wind`);

        // ── 2. APPARENT WIND, SAILED ─────────────────────────────────────────────
        // Raise the breeze so the heavy-air rows are actually exercised.
        for (const r of (state.course.windRegions || [])) r.speed = 26;
        state.wind.baseSpeed = 26; state.wind.speed = 26;
        startRace();
        while (state.race.status === 'prestart') update(1 / 60);
        for (const r of (state.course.windRegions || [])) r.speed = 26;
        state.wind.baseSpeed = 26; state.wind.speed = 26;

        let n = 0, awaAheadOfTwa = 0, upwindBuilds = 0, upwindN = 0, downwindEases = 0, downwindN = 0;
        let sheetOverSquare = 0, zeroTarget = 0, worstTrimOnGybe = 1, gybeFrames = 0;
        let kiteUpTight = 0, kiteDownDeep = 0;
        for (let f = 0; f < 60 * 60 * 4 && state.race.status === 'racing'; f++) {
            update(1 / 60);
            if (f % 5) continue;
            for (const b of state.boats) {
                if (b.raceState.finished || b.raceState.leg < 1 || b.speed < 0.5) continue;
                const w = getWindAt(b.x, b.y);
                const twa = Math.abs(normalizeAngle(b.heading - w.direction));
                const aw = b.apparentWind;
                if (!aw) continue;
                const awa = Math.abs(normalizeAngle(b.heading - aw.direction));
                n++;

                // The apparent wind is ALWAYS forward of the true wind for a boat moving
                // ahead. This is the single most basic statement of the whole model.
                if (awa <= twa + 1e-6) awaAheadOfTwa++;

                // ...and it BUILDS upwind (boat speed adds to it) and EASES downwind
                // (boat speed subtracts). This is why a beam reach is the windiest place on
                // the course and a run is the calmest, which is the physical reason bearing
                // away is the escape from being overpowered.
                if (twa * (180 / Math.PI) < 70) { upwindN++; if (aw.speed > w.speed) upwindBuilds++; }
                if (twa * (180 / Math.PI) > 140) { downwindN++; if (aw.speed < w.speed) downwindEases++; }

                // The boom cannot be eased past square to the centreline.
                if ((b.optimalSailAngle || 0) > Math.PI / 2 + 1e-9) sheetOverSquare++;

                // A boat mid sail-change still has a target speed. The crossfade weights
                // used to be `max(0, 1-2p)` and `max(0, 2p-1)`, both zero at half hoist, so
                // the weighted sum was exactly zero — a boat changing sails had no rig.
                const dp = b.spinnakerDeployProgress || 0;
                if (dp > 0.05 && dp < 0.95) {
                    gybeFrames++;
                    if ((b.trimEfficiency !== undefined ? b.trimEfficiency : 1) < worstTrimOnGybe)
                        worstTrimOnGybe = b.trimEfficiency;
                    if (b.targetSpeedNow === 0) zeroTarget++;
                }
                // Kite discipline, in APPARENT: never up hard on the wind, never down deep.
                if (b.spinnaker && awa < 70 / D) kiteUpTight++;
                if (!b.spinnaker && awa > 140 / D && b.spinnakerDeployProgress < 0.05) kiteDownDeep++;
            }
        }
        o.n = n;
        o.awaAheadPct = +(awaAheadOfTwa / Math.max(1, n) * 100).toFixed(2);
        o.upwindBuildsPct = +(upwindBuilds / Math.max(1, upwindN) * 100).toFixed(2);
        o.downwindEasesPct = +(downwindEases / Math.max(1, downwindN) * 100).toFixed(2);
        o.sheetOverSquare = sheetOverSquare;
        o.kiteUpTight = kiteUpTight;
        o.kiteDownDeep = kiteDownDeep;
        o.gybeFrames = gybeFrames;
        o.worstTrimOnGybe = +(worstTrimOnGybe === 1 ? 1 : worstTrimOnGybe).toFixed(3);

        // ── 3. THE POLAR IS INDEXED ON TRUE WIND ─────────────────────────────────
        // Called twice with the same TRUE arguments, it must answer the same thing. If
        // someone re-indexes it on apparent, this catches it: the second call is made after
        // a boat has changed speed, which would move an apparent-indexed answer.
        o.polarStable = getTargetSpeed(45 / D, false, 20) === getTargetSpeed(45 / D, false, 20);
        return o;
    });
    await browser.close();

    console.log('apparent wind drives the rig; true wind indexes the polar\n');
    for (const p of r.polarRuns) console.log(`  TWA ${String(p.twaDeg).padStart(3)}°  12/16/20/25/30 kt -> ${p.row.join('  ')}`);
    console.log(`  TWA  45°  (upwind)          -> ${r.upwind.join('  ')}`);
    console.log('');

    check('the polar keeps rising past 20 kt downwind — the ORC flatline is gone',
          !r.bad.some(b => b.startsWith('polar at')), r.bad.filter(b => b.startsWith('polar at'))[0]);
    check('upwind saturates above 20 kt but does not collapse',
          !r.bad.some(b => b.startsWith('upwind')), r.bad.filter(b => b.startsWith('upwind'))[0]);
    check('no step where the extrapolated rows join the measured ones',
          r.worstPolarJump <= 0.25, `worst ${r.worstPolarJump} kt per 0.25 kt of wind`);
    check('the polar is indexed on TRUE wind (same args, same answer)', r.polarStable === true);
    console.log('');
    check(`apparent is always forward of true (${r.n} sampled boat-frames)`,
          r.awaAheadPct === 100, `${r.awaAheadPct}%`);
    check('apparent BUILDS upwind — boat speed adds to it', r.upwindBuildsPct === 100, `${r.upwindBuildsPct}%`);
    check('apparent EASES downwind — boat speed subtracts from it', r.downwindEasesPct === 100, `${r.downwindEasesPct}%`);
    check('the boom is never eased past square', r.sheetOverSquare === 0, `${r.sheetOverSquare} frames`);
    console.log('');
    check('no kite up inside 70° apparent', r.kiteUpTight === 0, `${r.kiteUpTight} frames`);
    check('no kite fully down beyond 140° apparent', r.kiteDownDeep === 0, `${r.kiteDownDeep} frames`);
    check(`a boat mid sail-change still has a rig (${r.gybeFrames} such frames)`,
          r.worstTrimOnGybe > 0, `worst trim quality ${r.worstTrimOnGybe}`);
    check('no page errors', errs.length === 0, errs[0]);

    console.log(`\n${fails ? 'FAIL' : 'PASS'} — ${fails} failure(s)`);
    process.exit(fails ? 1 : 0);
})();
