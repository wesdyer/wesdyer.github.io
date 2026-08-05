// WHAT MOVES THE BOAT OFF A SCRIPTED ARC?
//
// `_sweep_delivery_probe` showed the arctic 2.5-zone circle displaces the boat up to
// 1100 units in a single frame — which is not sailing, it is something repositioning
// her. That matters because the rounding accumulator measures the bearing change of
// her TRACK, and a teleport is not track: it is banked (or unbanked) sweep she never
// sailed. This says which mechanism does it.
//
// node _stray_cause_probe.js <tree> [venue] [radiusZones]
const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.join(__dirname, process.argv[2] || 'treeR1');
const VENUE = process.argv[3] || 'arctic';
const RZ = parseFloat(process.argv[4] || '2.5');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await page.addInitScript((v) => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.waitForFunction(() => window.state && window.state.course && window.state.course.marks);

    const r = await page.evaluate((radiusZones) => {
        window.resetGame(); window.startRace();
        for (let i = 0; i < 60 * 120 && state.race.status !== 'racing'; i++) window.update(1 / 60);
        const b = state.boats.find(x => !x.isPlayer);
        for (const o of state.boats) if (o !== b) { o.x = -99999; o.y = -99999; o.raceState.finished = true; }
        b.raceState.leg = 1; b.raceState.lastPos = { x: b.x, y: b.y };
        b.raceState.roundSweep = 0; b.raceState.roundArmed = false;
        const rm = legRoundMark(1) || state.course.roundMark;
        const need = rm.reqSweep, sgn = rm.side === 'port' ? -1 : 1;
        const R = rm.zone * radiusZones;
        const a0 = Math.atan2(b.y - rm.y, b.x - rm.x);
        const bnd = state.course.boundary || null;
        const events = {};
        const prevEv = window.onRaceEvent;
        window.onRaceEvent = (ty, d) => { events[ty] = (events[ty] || 0) + 1; if (prevEv) prevEv(ty, d); };
        const worst = [];
        const steps = 400;
        for (let i = 0; i <= steps; i++) {
            const a = a0 + sgn * need * (i / steps);
            const nx = rm.x + Math.cos(a) * R, ny = rm.y + Math.sin(a) * R;
            b.heading = Math.atan2(nx - b.x, -(ny - b.y));
            b.x = nx; b.y = ny; b.speed = 1.5;
            const sBefore = b.raceState.roundSweep || 0;
            window.update(1 / 60);
            const stray = Math.hypot(b.x - nx, b.y - ny);
            if (stray > 60) {
                worst.push({
                    i, stray: +stray.toFixed(0),
                    at: [Math.round(nx), Math.round(ny)],
                    to: [Math.round(b.x), Math.round(b.y)],
                    dSweep: +((b.raceState.roundSweep || 0) - sBefore).toFixed(4),
                    onLand: window.SailCheck && state.course._gridFixed
                        ? !!(state.course.botGrid && !state.course.botGrid.at(...state.course.botGrid.cell(nx, ny)))
                        : null,
                    speed: +b.speed.toFixed(1),
                    aground: !!b.raceState.aground,
                });
            }
        }
        window.onRaceEvent = prevEv;
        return {
            need, zone: rm.zone, R, mark: [Math.round(rm.x), Math.round(rm.y)],
            boundary: bnd ? { x: Math.round(bnd.x), y: Math.round(bnd.y), w: Math.round(bnd.width || bnd.w || 0), h: Math.round(bnd.height || bnd.h || 0), keys: Object.keys(bnd) } : null,
            events, nWorst: worst.length, worst: worst.slice(0, 12),
            finalSweep: b.raceState.roundSweep,
        };
    }, RZ);

    console.log(`\nSTRAY CAUSE — ${VENUE} @ ${RZ} zone radii, tree ${path.basename(ROOT)}`);
    console.log('  mark', r.mark, 'zone', r.zone.toFixed(0), 'arc radius', r.R.toFixed(0), 'reqSweep', r.need.toFixed(3));
    console.log('  boundary:', JSON.stringify(r.boundary));
    console.log('  race events during the arc:', JSON.stringify(r.events));
    console.log(`  frames displaced >60u: ${r.nWorst} of 401;  final sweep ${r.finalSweep.toFixed(3)}`);
    for (const w of r.worst) console.log('   ', JSON.stringify(w));
    await browser.close();
})();
