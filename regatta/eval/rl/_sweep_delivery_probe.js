// HOW MUCH SWEEP DOES A SCRIPTED ARC ACTUALLY DELIVER?
//
// `test_rounding_string.js` walks a boat round a scripted arc of `reqSweep * frac`
// and asks whether the leg completes. That only pins the completion threshold if the
// arc DELIVERS what it scripts. It does not necessarily: `window.update()` runs the
// physics between teleports, and the engine measures the bearing sweep from the
// POST-physics position of the previous frame (updateBoat sets lastPos after
// updateBoatRaceState), so anything that moves the boat off the scripted circle —
// collision resolution against an island mark, most obviously — shows up as sweep
// that was never banked.
//
// This reports, for a grid of (frac, radius), the sweep the engine actually banked
// against the sweep the arc scripted, plus how far the boat strayed from the circle.
//
// node _sweep_delivery_probe.js <tree> [venue]
const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.join(__dirname, process.argv[2] || 'treeL');
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
        const rm = (typeof legRoundMark === 'function' ? legRoundMark(1) : null) || state.course.roundMark;
        if (!rm || rm.reqSweep == null) return { skip: true };
        const need = rm.reqSweep, sgn = rm.side === 'port' ? -1 : 1;
        const R = rm.zone * radiusZones;
        const a0 = Math.atan2(b.y - rm.y, b.x - rm.x);
        const startLeg = b.raceState.leg;
        let sweptAt = 0, maxStray = 0, sumStray = 0, n = 0, advancedAt = null;
        let peak = 0, peakAway = 0, minD = 1e9, maxD = 0;
        const steps = 400;
        for (let i = 0; i <= steps; i++) {
            const a = a0 + sgn * (need * frac) * (i / steps);
            const nx = rm.x + Math.cos(a) * R, ny = rm.y + Math.sin(a) * R;
            b.heading = Math.atan2(nx - b.x, -(ny - b.y));
            b.x = nx; b.y = ny; b.speed = 1.5;
            sweptAt = b.raceState.roundSweep || sweptAt;
            window.update(1 / 60);
            // how far the physics dragged the boat off the circle this frame
            const stray = Math.hypot(b.x - nx, b.y - ny);
            if (stray > maxStray) maxStray = stray;
            sumStray += stray; n++;
            if ((b.raceState.roundSweep || 0) > peak) peak = b.raceState.roundSweep;
            const dd = Math.hypot(b.x - rm.x, b.y - rm.y);
            if (dd < minD) minD = dd; if (dd > maxD) maxD = dd;
            if (b.raceState.leg !== startLeg) { advancedAt = 'arc'; break; }
        }
        const arcEnd = b.raceState.roundSweep || sweptAt;
        for (let i = 0; i < 240 && b.raceState.leg === startLeg; i++) {
            const a = a0 + sgn * need * frac;
            b.x += Math.cos(a) * 12; b.y += Math.sin(a) * 12;
            sweptAt = b.raceState.roundSweep || sweptAt;
            window.update(1 / 60);
            if ((b.raceState.roundSweep || 0) > peak) peak = b.raceState.roundSweep;
            if ((b.raceState.roundSweep || 0) > peakAway) peakAway = b.raceState.roundSweep;
        }
        if (advancedAt === null && b.raceState.leg !== startLeg) advancedAt = 'away';
        return {
            advanced: b.raceState.leg !== startLeg, swept: sweptAt, arcEnd, need, peak, peakAway,
            scripted: need * frac, zone: rm.zone, R, roundR: rm._roundR || null,
            maxStray, meanStray: sumStray / Math.max(1, n), advancedAt,
            markRadius: rm.radius || null, side: rm.side,
        };
    }, [frac, radiusZones]);

    console.log(`\nSWEEP DELIVERY — ${VENUE}, tree ${path.basename(ROOT)}`);
    let head = null;
    for (const rz of [0.8, 1.5, 2.5]) {
        for (const f of [0.6, 0.8, 1.0]) {
            const r = await runArc(f, rz);
            if (r.skip) { console.log('  (no rounding mark on leg 1)'); await browser.close(); return; }
            if (!head) {
                head = r;
                console.log(`  mark: zone ${r.zone.toFixed(0)}  radius ${r.markRadius}  side ${r.side}  reqSweep ${r.need.toFixed(3)} rad (${(r.need * 180 / Math.PI).toFixed(0)} deg)`);
                console.log('  radius  frac   scripted   PEAK     final    peak/scripted  advanced   stray max/mean');
            }
            console.log(`  ${rz.toFixed(1)}z    ${f.toFixed(2)}   ${r.scripted.toFixed(3)}      ${r.peak.toFixed(3)}    ${r.swept.toFixed(3)}    ${(r.peak / r.scripted).toFixed(4)}         ${String(r.advanced) + (r.advancedAt ? '/' + r.advancedAt : '')}\t${r.maxStray.toFixed(1)} / ${r.meanStray.toFixed(1)}`);
        }
    }
    await browser.close();
})();
