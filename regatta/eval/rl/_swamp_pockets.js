// IS THE CLEAN LANE ON THE ROUTER'S GRAPH, POCKET BY POCKET? (2026-08-10)
//
// After the day-scaled stuck bars landed, swamp's leg-1 loss stopped being one
// hotspot and spread out: sub3 +35.2, sub4 +27.4, sub5 +23.1, sub1 +17.2 s/boat,
// with wiggle still 30% of the slow time. The two new pockets are dense forest —
// 48 and 63 hard prop colliders inside 700u — and BOTH have clean lanes on the
// drag map that she uses and the fleet does not: at sub4 she crosses in 3.4 s at
// 61 u/s while the fleet takes 30.8 s at 37 u/s, which is 5.5x her distance.
//
// `admitShape` refuses any point within CLEARANCE (HULL_R 30 + 14 = 44u) of a
// shape EDGE, so each 7-20u trunk claims a ~51-64u disc. Venue-wide that removed
// 18.84% of open water against a 4.39% true (hull-inflated) occupancy — a 4.3x
// over-claim. In a pocket holding 60 trunks it will be far worse, and if it severs
// the clean lane the fleet is not choosing badly, it is choosing from a smaller set.
//
//   node _swamp_pockets.js [tree]
//
// Reports per pocket: grid cells open/blocked, how many the FOREST claims (by
// counterfactual grid — never assume the sampling rule), and what share of HER
// track through that pocket sits on cells the router calls unsailable.
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, process.argv[2] || 'treeHD12');

// leg-1 subsections by her median position, from _leg_where on the landed HEAD
const POCKETS = [
    ['sub1', -2082, 1130, 17.2], ['sub3', 497, 888, 35.2],
    ['sub4', -1121, -314, 27.4], ['sub5', -1693, -937, 23.1],
    ['sub6', -1262, -1420, 12.6], ['sub8', 121, -2285, 12.2],
];
const R = 500;

(async () => {
    const dir = path.join(__dirname, 'traj');
    const laps = [];
    for (const f of fs.readdirSync(dir).filter(f => f.startsWith('traj_swamp_')).sort()) {
        const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        const F = j.format, I = n => F.indexOf(n);
        laps.push(j.samples.filter(r => r[I('leg')] >= 1).map(r => [r[I('x')], r[I('y')]]));
    }
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await page.addInitScript(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'swamp' })); });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    const out = await page.evaluate(({ POCKETS, R, laps }) => {
        window.evalHarness.seed = 4300; window.resetGame(); window.startRace();
        for (let i = 0; i < 120; i++) window.update(1 / 60);
        const g = state.course.botGrid;
        const fixed = state.course._gridFixed || [];
        const gB = window.SailCheck.buildGrid(fixed.filter(s => !/\.hit$/.test(s.id || '')),
                                              state.course.boundary, null, null);
        const res = [];
        for (const [nm, cx, cy, cost] of POCKETS) {
            let open = 0, closed = 0, byForest = 0;
            const c0 = g.cell(cx - R, cy - R), c1 = g.cell(cx + R, cy + R);
            for (let j = c0[1]; j <= c1[1]; j++) for (let i = c0[0]; i <= c1[0]; i++) {
                const [wx, wy] = g.world(i, j);
                if (Math.hypot(wx - cx, wy - cy) > R) continue;
                const a = g.at(i, j), b = gB.at(i, j);
                if (a) open++; else { closed++; if (b) byForest++; }
            }
            // her track through this pocket
            let hn = 0, hb = 0;
            for (const L of laps) for (const [x, y] of L) {
                if (Math.hypot(x - cx, y - cy) > R) continue;
                hn++; const c = g.cell(x, y); if (!g.at(c[0], c[1])) hb++;
            }
            res.push({ nm, cost, open, closed, byForest, hn, hb });
        }
        return res;
    }, { POCKETS, R, laps });
    await browser.close();

    console.log(`\n=== SWAMP LEG-1 POCKETS vs THE ROUTER GRID (r=${R}u, ${path.basename(ROOT)}) ===`);
    console.log(`pocket  cost s/boat   cells open/total   blocked   of which FOREST   HER track: on unsailable`);
    for (const r of out) {
        const tot = r.open + r.closed;
        console.log(`${r.nm.padEnd(7)} ${String(r.cost).padStart(9)}   ${String(r.open).padStart(5)}/${String(tot).padEnd(5)} ` +
            ` ${(100 * r.closed / tot).toFixed(0).padStart(4)}%   ${(100 * r.byForest / (r.closed || 1)).toFixed(0).padStart(6)}% of blocked` +
            `      ${r.hn ? (100 * r.hb / r.hn).toFixed(1) + '% of ' + r.hn : '(no track)'}`);
    }
    console.log(`\n  → a pocket where SHE sails on cells the router calls unsailable is one where`);
    console.log(`    the fleet's route is the best of a SMALLER SET. Pricing cannot reach that.`);
})();
