// IS THE ORBIT RING ON WATER?
//
// The AI orbits a rounding mark at `zone * 0.85` — a constant taken from recorded human
// roundings, where every mark is a buoy. The planner separately computes `_roundR`: the
// TIGHTEST circle round this mark whose whole circumference is navigable, chosen from a
// ladder because "on a mark planted on an island the real coastline is irregular, so a
// circle at radius+clearance can still clip the shore". If _roundR is larger than
// zone*0.85, the AI's orbit ring runs across the rock and the fleet grinds round the
// island bouncing off it — which is what a wander ratio of 4.56 looks like.
//
// node _orbit_radius_probe.js <tree> [venue]
const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.join(__dirname, process.argv[2] || 'treeL');
const VENUE = process.argv[3] || 'arctic';

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await page.addInitScript((v) => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.waitForFunction(() => window.state && window.state.course && window.state.course.marks);

    const r = await page.evaluate(() => {
        const g = state.course.botGrid;
        const out = [];
        for (let i = 0; i < state.course.route.length; i++) {
            const e = state.course.route[i];
            if (!e || e.kind !== 'round' || !e.mark) continue;
            const m = e.mark;
            const roundR = (typeof CoursePath !== 'undefined') ? CoursePath._roundR(m, g) : null;
            // What fraction of each candidate ring is water?
            const wet = (R) => {
                if (!g) return null;
                let w = 0;
                for (let k = 0; k < 72; k++) {
                    const a = k / 72 * Math.PI * 2;
                    const c = g.cell(m.x + Math.cos(a) * R, m.y + Math.sin(a) * R);
                    if (g.at(c[0], c[1])) w++;
                }
                return w / 72;
            };
            out.push({
                leg: i, radius: m.radius, zone: m.zone, roundR,
                reqSweep: m.reqSweep,
                orbit085: m.zone * 0.85,
                wetAtOrbit: wet(m.zone * 0.85),
                wetAtRoundR: roundR != null ? wet(roundR) : null,
                wetAt10: wet(m.zone), wetAt12: wet(m.zone * 1.2), wetAt14: wet(m.zone * 1.4),
                wetAt06: wet(m.zone * 0.6),
            });
        }
        return out;
    });

    console.log(`\nORBIT RING vs WATER — ${VENUE}, tree ${path.basename(ROOT)}`);
    for (const m of r) {
        console.log(`  leg ${m.leg}: mark radius ${m.radius.toFixed(0)}  zone ${m.zone.toFixed(0)}  planner _roundR ${m.roundR != null ? m.roundR.toFixed(0) : '-'}  reqSweep ${m.reqSweep ? m.reqSweep.toFixed(2) : '-'}`);
        console.log(`     fraction of the ring that is WATER:`);
        console.log(`       0.60z (${(m.zone * 0.6).toFixed(0)})  ${(100 * m.wetAt06).toFixed(0)}%`);
        console.log(`       0.85z (${m.orbit085.toFixed(0)})  ${(100 * m.wetAtOrbit).toFixed(0)}%   <-- the AI orbits here`);
        console.log(`       _roundR (${m.roundR != null ? m.roundR.toFixed(0) : '-'})  ${m.wetAtRoundR != null ? (100 * m.wetAtRoundR).toFixed(0) + '%' : '-'}   <-- the planner's own navigable ring`);
        console.log(`       1.00z (${m.zone.toFixed(0)})  ${(100 * m.wetAt10).toFixed(0)}%`);
        console.log(`       1.20z (${(m.zone * 1.2).toFixed(0)})  ${(100 * m.wetAt12).toFixed(0)}%`);
        console.log(`       1.40z (${(m.zone * 1.4).toFixed(0)})  ${(100 * m.wetAt14).toFixed(0)}%`);
    }
    await browser.close();
})();
