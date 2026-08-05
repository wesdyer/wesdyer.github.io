// THE STRING RULE, ON ANY VENUE AT ANY RADIUS — the diagnostic behind
// `regatta/eval/test_rounding_string.js`.
//
// The shipped test hardcodes arctic and probes three radii, one of which (2.5 zone
// radii around Glacier Sound's rounding island = a 2126-unit circle) is NOT WATER: it
// crosses the shoreline and the course boundary, so the scripted boat is bounced and
// banks about 97% of the arc she was told to sail. That is a property of the fixture,
// not of the rule or of the engine, and it is worth being able to demonstrate rather
// than assert. This runs the same two assertions — a full rounding completes, a 80%
// pass does not — across a radius sweep on any venue, and reports how much of the
// scripted arc each radius actually delivered.
//
// node _string_rule_check.js <tree> [venue]
const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.join(__dirname, process.argv[2] || 'treeR2');
const VENUE = process.argv[3] || 'arctic';

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await page.addInitScript((v) => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.waitForFunction(() => window.state && window.state.course && window.state.course.marks);

    const runArc = (frac, radiusZones) => page.evaluate(([frac, radiusZones]) => {
        window.resetGame(); window.startRace();
        for (let i = 0; i < 60 * 120 && state.race.status !== 'racing'; i++) window.update(1 / 60);
        const b = state.boats.find(x => !x.isPlayer);
        for (const o of state.boats) if (o !== b) { o.x = -99999; o.y = -99999; o.raceState.finished = true; }
        b.raceState.leg = 1; b.raceState.lastPos = { x: b.x, y: b.y };
        b.raceState.roundSweep = 0; b.raceState.roundArmed = false;
        if ('roundBanked' in b.raceState) b.raceState.roundBanked = false;
        const rm = (typeof legRoundMark === 'function' ? legRoundMark(1) : null) || state.course.roundMark;
        if (!rm || rm.reqSweep == null) return { skip: true };
        const need = rm.reqSweep, sgn = rm.side === 'port' ? -1 : 1;
        const R = rm.zone * radiusZones;
        const a0 = Math.atan2(b.y - rm.y, b.x - rm.x);
        const startLeg = b.raceState.leg;
        // Is the circle she is being told to sail actually water? The grid the bots
        // route on is the authority: a cell that is not navigable is land.
        let offWater = 0, samples = 0;
        const g = state.course.botGrid;
        if (g) for (let k = 0; k < 180; k++) {
            const a = a0 + sgn * need * frac * (k / 179);
            const c = g.cell(rm.x + Math.cos(a) * R, rm.y + Math.sin(a) * R);
            samples++; if (!g.at(c[0], c[1])) offWater++;
        }
        let peak = 0;
        const steps = 400;
        for (let i = 0; i <= steps; i++) {
            const a = a0 + sgn * (need * frac) * (i / steps);
            const nx = rm.x + Math.cos(a) * R, ny = rm.y + Math.sin(a) * R;
            b.heading = Math.atan2(nx - b.x, -(ny - b.y));
            b.x = nx; b.y = ny; b.speed = 1.5;
            window.update(1 / 60);
            if ((b.raceState.roundSweep || 0) > peak) peak = b.raceState.roundSweep;
            if (b.raceState.leg !== startLeg) break;
        }
        for (let i = 0; i < 240 && b.raceState.leg === startLeg; i++) {
            const a = a0 + sgn * need * frac;
            b.x += Math.cos(a) * 12; b.y += Math.sin(a) * 12;
            window.update(1 / 60);
            if ((b.raceState.roundSweep || 0) > peak) peak = b.raceState.roundSweep;
        }
        return { advanced: b.raceState.leg !== startLeg, peak, need, scripted: need * frac,
                 zone: rm.zone, offWater: offWater / Math.max(1, samples) };
    }, [frac, radiusZones]);

    console.log(`\nSTRING RULE ACROSS RADII — ${VENUE}, tree ${path.basename(ROOT)}`);
    console.log('  radius   full-rounding completes?   80%-pass rejected?   arc delivered (peak/scripted)   circle off water');
    let bad = 0;
    for (const rz of [0.8, 1.0, 1.5, 2.0, 2.5, 3.0]) {
        const full = await runArc(1.0, rz);
        if (full.skip) { console.log('  (no rounding mark on leg 1)'); await browser.close(); return; }
        const cut = await runArc(0.80, rz);
        const okFull = full.advanced === true, okCut = cut.advanced === false;
        if (!okFull || !okCut) bad++;
        console.log(`  ${rz.toFixed(1)}z      ${okFull ? 'yes' : 'NO '}                        ${okCut ? 'yes' : 'NO '}                  ${(full.peak / full.scripted).toFixed(3)}                          ${(100 * full.offWater).toFixed(0)}%`);
    }
    console.log(`\n  ${bad ? bad + ' radius/radii disagree' : 'the rule holds at every radius tested'}`);
    await browser.close();
})();
