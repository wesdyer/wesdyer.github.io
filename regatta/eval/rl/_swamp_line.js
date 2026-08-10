// CAN THE ROUTER EVEN PLAN THE LINE SHE SAILS? (2026-08-10, the swamp push.)
//
// The attribution says the bayou's gap is WEED: 75% of the fleet's slow time is
// spent in water with a drag multiplier under 0.7, the fleet's mean multiplier is
// 0.680 against her 0.921, and NO breeze-hole time at all (0 boat-s). She routes
// around the weed; they route through it.
//
// The suspected cause is not the shoal PRICE (the router already multiplies edge
// cost by 1/shoalField, `sailcheck.js:784`) but REACHABILITY. Gatorgrass emits
// 2051 hard prop colliders, and `buildGridRaw`'s `admitShape` refuses any point
// within CLEARANCE (= HULL_R 30 + 14 = 44u) of a shape EDGE. Around a 13u trunk
// that is a 57u no-go disc, and the sub-3 hotspot holds 101 trunks inside 900u.
// If that closes the clean corridor, the cheapest ADMISSIBLE path is the weed —
// and no amount of shoal pricing can help, because the good water is not on the
// graph at all.
//
// THE TEST: walk her recorded track and ask the bots' own grid whether each point
// is sailable. She sailed it, so every "no" is water the router cannot plan
// through but a boat demonstrably crosses. This is a REACHABILITY claim, which is
// an actions-not-prices question (rule 1) — the clearance-bar dose-response that
// killed the price version does not answer it.
//
//   node _swamp_line.js [tree] [venue]
//
// ⚠️ Reports drag exposure on her line vs the fleet's from the SAME grid and the
// same shoalField, so the two columns are commensurable.
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, process.argv[2] || 'treeHD11');
const VENUE = process.argv[3] || 'swamp';

const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(p * (s.length - 1))] : NaN; };

(async () => {
    // her track, racing frames only
    const dir = path.join(__dirname, 'traj');
    const laps = [];
    for (const f of fs.readdirSync(dir).filter(f => f.startsWith('traj_' + VENUE + '_')).sort()) {
        const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        const F = j.format, I = n => F.indexOf(n);
        laps.push({ file: f, pts: j.samples.filter(r => r[I('leg')] >= 1).map(r => [r[I('x')], r[I('y')]]) });
    }

    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    const out = await page.evaluate((laps) => {
        window.evalHarness.seed = 4300;
        window.resetGame(); window.startRace();
        for (let i = 0; i < 120; i++) window.update(1 / 60);
        const g = state.course.botGrid;
        const awash = (state.course.islands || []).filter(i => i.awash);
        const shoal = (x, y) => window.VenueDoc.shoalField(awash, x, y);
        // counterfactual grid with the prop forest removed
        const fixed = state.course._gridFixed || [];
        const gB = window.SailCheck.buildGrid(fixed.filter(s => !/\.hit$/.test(s.id || '')),
                                              state.course.boundary, null, null);
        const res = [];
        for (const L of laps) {
            let blocked = 0, blockedProps = 0, n = 0; const mul = [];
            for (const [x, y] of L.pts) {
                const c = g.cell(x, y);
                n++;
                const okA = g.at(c[0], c[1]);
                const okB = gB.at(c[0], c[1]);
                if (!okA) blocked++;
                if (!okA && okB) blockedProps++;   // blocked ONLY because of the forest
                mul.push(shoal(x, y));
            }
            res.push({ file: L.file, n, blocked, blockedProps, mul });
        }
        return res;
    }, laps);
    await browser.close();

    console.log(`\n=== ${VENUE.toUpperCase()}: IS HER LINE ON THE ROUTER'S GRAPH? (${path.basename(ROOT)}) ===`);
    let N = 0, B = 0, BP = 0, MUL = [];
    for (const r of out) {
        console.log(`  ${r.file.slice(5 + VENUE.length + 1, 5 + VENUE.length + 14)}  ${String(r.n).padStart(5)} racing samples` +
            `   on UNSAILABLE cells ${String(r.blocked).padStart(5)} (${(100 * r.blocked / r.n).toFixed(1)}%)` +
            `   of which the FOREST closed ${(100 * r.blockedProps / r.n).toFixed(1)}%` +
            `   median drag mul ${q(r.mul, 0.5).toFixed(3)}`);
        N += r.n; B += r.blocked; BP += r.blockedProps; MUL = MUL.concat(r.mul);
    }
    console.log(`\n  ⭐ POOLED: ${B}/${N} of her racing samples (${(100 * B / N).toFixed(1)}%) sit on cells the ROUTER CALLS UNSAILABLE`);
    console.log(`     of those, ${(100 * BP / N).toFixed(1)} points of the ${(100 * B / N).toFixed(1)}% are closed BY THE PROP FOREST alone`);
    console.log(`     her drag multiplier along the line: p10 ${q(MUL, 0.1).toFixed(3)}  med ${q(MUL, 0.5).toFixed(3)}  mean ${(MUL.reduce((a, b) => a + b, 0) / MUL.length).toFixed(3)}`);
    console.log(`\n  → a large blocked share means the fleet's route is not a worse CHOICE,`);
    console.log(`    it is the best of a smaller SET. Pricing cannot reach that; admission can.`);
})();
