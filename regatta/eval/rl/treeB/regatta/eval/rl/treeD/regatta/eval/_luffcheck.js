// IS A CLOSE-HAULED BOAT LUFFING? — reported from play, checked two ways.
//
// `luffIntensity` is read only by drawBoat, where ANY non-zero value shears the sail into
// a visible flutter. So the mean is the wrong statistic entirely: a boat that luffs 8% of
// the time at intensity 0.4 averages 0.03 and looks like it is shaking constantly.
//
// Two measurements, because there are two populations and only one of them is a bug:
//   STEADY-STATE, swept analytically  — a correctly trimmed boat close-hauled must NEVER
//                                       luff, at any speed, in any breeze.
//   SAILED, distribution not mean     — and in a real race, how often and how hard, split
//                                       by whether the AI was deliberately spilling wind.
const { chromium } = require('playwright');
const path = require('path');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.addInitScript(() => localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'ocean' })));
    await page.goto('file://' + path.resolve('regatta/index.html'));
    await page.waitForTimeout(2500);

    const r = await page.evaluate(() => {
        const D = 180 / Math.PI, o = {};

        // ── A. THE SWEEP ─────────────────────────────────────────────────────────
        // Reproduce the trim maths for a perfectly trimmed boat over the whole plausible
        // range, and report the angle of attack it ends up with. Independent of the AI, of
        // traffic and of luck.
        const AWA_CH = AWA_CLOSE_HAULED * D;
        const rows = [];
        let worst = { aoa: 1e9 };
        for (const tws of [8, 12, 16, 20, 25, 32]) {
            for (const twaDeg of [32, 36, 40, 45, 50]) {
                // Only speeds the boat can actually REACH close-hauled. Sweeping 12 knots
                // of boat speed against 8 knots of breeze found a 12.7-degree angle of
                // attack, but no boat is ever in that state — an impossible corner is not
                // a finding, and reporting it as the worst case buries the real margin.
                const ceiling = getTargetSpeed(twaDeg / D, false, tws) * 1.15;
                for (const bkn of [2, 4, 6, 8, 10, 12]) {
                    if (bkn > ceiling) continue;
                    const twa = twaDeg / D;
                    // Apparent, exactly as updateBoat computes it.
                    const awx = -Math.sin(0) * tws - Math.sin(twa) * bkn;
                    const awy = Math.cos(0) * tws + Math.cos(twa) * bkn;
                    // AWA is measured from the BOAT'S HEADING, not from the wind direction.
                    // Differencing against the wind gave 11 degrees where the true answer is
                    // 29, and made AWA fall as the breeze rose — which is backwards.
                    const awa = Math.abs(Math.atan2(-awx, awy) - twa);
                    const sheet = Math.min(Math.PI / 2, Math.max(0, (awa - AWA_CLOSE_HAULED) * (2 / 3)));
                    const aoa = (awa - sheet) * D;
                    if (aoa < worst.aoa) worst = { aoa: +aoa.toFixed(2), tws, twaDeg, bkn, awa: +(awa * D).toFixed(1) };
                    if (bkn === 8 && twaDeg === 40) rows.push({ tws, awa: +(awa * D).toFixed(1), sheet: +(sheet * D).toFixed(1), aoa: +aoa.toFixed(1) });
                }
            }
        }
        o.sweep = rows; o.worstAoA = worst;
        o.luffThresholdDeg = null;   // filled below from the live value

        // ── B. THE RACE ──────────────────────────────────────────────────────────
        for (const rg of (state.course.windRegions || [])) rg.speed = 20;
        state.wind.baseSpeed = 20; state.wind.speed = 20;
        startRace();
        while (state.race.status === 'prestart') update(1 / 60);
        for (const rg of (state.course.windRegions || [])) rg.speed = 20;
        state.wind.baseSpeed = 20; state.wind.speed = 20;

        const beat = [], beatForced = [], tacking = [];
        for (let f = 0; f < 60 * 60 * 3 && state.race.status === 'racing'; f++) {
            update(1 / 60);
            if (f % 3) continue;
            for (const b of state.boats) {
                if (b.raceState.finished || b.raceState.leg < 1) continue;
                const w = getWindAt(b.x, b.y);
                const twa = Math.abs(normalizeAngle(b.heading - w.direction)) * D;
                if (twa < 30 || twa > 55) continue;          // close-hauled only
                const li = b.luffIntensity || 0;
                // Split off the two cases that SHOULD luff: a boat in the middle of a tack,
                // and a bot deliberately spilling wind to slow down.
                if (b.ai && b.ai.forcedLuff > 0.01) beatForced.push(li);
                else if (b.raceState.isTacking || b.tacking) tacking.push(li);
                else beat.push(li);
            }
        }
        const stat = (a) => {
            if (!a.length) return { n: 0 };
            const s = [...a].sort((x, y) => x - y);
            const q = f => +s[Math.min(s.length - 1, Math.floor(s.length * f))].toFixed(3);
            return { n: a.length, anyPct: +(a.filter(v => v > 0).length / a.length * 100).toFixed(1),
                     p50: q(.5), p90: q(.9), p99: q(.99), max: +s[s.length - 1].toFixed(3) };
        };
        o.cleanBeat = stat(beat);
        o.forcedLuff = stat(beatForced);
        o.tacking = stat(tacking);
        return o;
    });
    await browser.close();

    console.log('CLOSE-HAULED LUFF CHECK\n');
    console.log('A. Swept: a perfectly trimmed boat at TWA 40, 8 kt of boat speed');
    console.log('   TWS    AWA   sheet    AoA');
    for (const s of r.sweep) console.log(`   ${String(s.tws).padStart(3)}  ${String(s.awa).padStart(5)}  ${String(s.sheet).padStart(5)}  ${String(s.aoa).padStart(5)}`);
    const w = r.worstAoA;
    console.log(`\n   WORST angle of attack anywhere in the sweep: ${w.aoa}°`);
    console.log(`   (TWS ${w.tws}, TWA ${w.twaDeg}, boat ${w.bkn} kt -> AWA ${w.awa}°)`);
    console.log(`   The sail flutters below 14° — margin ${(w.aoa - 14).toFixed(1)}°\n`);

    console.log('B. Sailed, close-hauled (TWA 30-55) in 20 kt — DISTRIBUTION, not mean');
    const show = (name, s) => console.log(s.n
        ? `   ${name.padEnd(26)} n=${String(s.n).padStart(6)}  luffing ${String(s.anyPct).padStart(5)}% of frames  p90 ${s.p90}  p99 ${s.p99}  max ${s.max}`
        : `   ${name.padEnd(26)} (none)`);
    show('trimmed, steady', r.cleanBeat);
    show('bot spilling on purpose', r.forcedLuff);
    show('mid-tack', r.tacking);
    if (errs.length) console.log('\nPAGE ERRORS: ' + errs[0]);
})();
