// PLAN OR EXECUTION? THE RIVER LEG-3 POCKETS (2026-08-08 night, SECTION PUSH P3b)
// _riv_where.js located two subsections of river leg 3 carrying 90% of that leg's
// slow time, and in BOTH the human sails a different side of the river from the one
// the bots stall on (bin 4: her x 557, bot slow x 128; bin 7: her x -370, bot 402).
// That is two different diagnoses with two different addresses, and the campaign has
// a standing trap for guessing between them (trap 17: route pricing provably cannot
// reach displacement-driven failures — fix the response, not the map).
//
// So ask the router directly. As each boat crosses the northing gate at the pocket's
// southern edge, sample:
//   planX  — where the boat's OWN current plan crosses the pocket's centre northing
//   sailX  — where the boat actually is when it reaches that northing
// planX ~ her line and sailX far from it  => DISPLACEMENT (execution layer)
// planX ~ sailX and both far from her line => ROUTE CHOICE (map layer)
// Also records the grid clearance along her line vs the plan's, so "is her water
// actually wider" is answered rather than assumed.
//   node _riv_line.js <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 4;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeCP1');
const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };
// pocket = [gate northing (south edge), centre northing, her x at centre]
const POCKETS = [{ name: 'bin4', gate: 1722, mid: 2368, herX: 557 }, { name: 'bin7', gate: 5599, mid: 6245, herX: -370 }];

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'river' })); });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const agg = {};
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (arg) => {
            const { seed, POCKETS } = arg;
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const out = {};
            for (const P of POCKETS) out[P.name] = { plan: [], sail: [], armedAt: 0, n: 0 };
            const armed = {};        // boat -> {pocket: {planX}}
            // Where a polyline crosses a northing, going north.
            const crossX = (pts, yTarget) => {
                if (!pts || pts.length < 2) return null;
                for (let i = 1; i < pts.length; i++) {
                    const a = pts[i - 1], b = pts[i];
                    const ay = a.y != null ? a.y : a[1], by = b.y != null ? b.y : b[1];
                    const ax = a.x != null ? a.x : a[0], bx = b.x != null ? b.x : b[0];
                    if ((ay - yTarget) * (by - yTarget) <= 0 && ay !== by)
                        return ax + (bx - ax) * (yTarget - ay) / (by - ay);
                }
                return null;
            };
            const dt = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (it % 6 === 0 && state.race.status === 'racing') {
                    for (const b of state.boats) {
                        if (b.isPlayer || b.raceState.finished) continue;
                        if (b.raceState.leg !== 3) continue;
                        const ct = b.controller;
                        for (const P of POCKETS) {
                            const key = b.name + ':' + P.name;
                            // At the gate: freeze what the plan SAYS it will do.
                            if (!armed[key] && b.y >= P.gate && b.y < P.gate + 120) {
                                const px = crossX(ct && ct.gridPath, P.mid);
                                armed[key] = { planX: px, done: false };
                                if (px != null) { out[P.name].plan.push(Math.round(px)); out[P.name].armedAt++; }
                            }
                            // At the centre: where the boat actually is.
                            if (armed[key] && !armed[key].done && b.y >= P.mid) {
                                armed[key].done = true;
                                out[P.name].sail.push(Math.round(b.x));
                                out[P.name].n++;
                            }
                        }
                    }
                }
                if (state.race.status === 'finished') break;
                if (state.race.status === 'racing' && state.race.timer > 880) break;
            }
            // Grid clearance (cells to nearest hard water) along each candidate line.
            const g = state.course.botGrid;
            const clAt = (x, y) => { const c = g.cell(x, y); return g._clear ? g._clear[c[1] * g.n + c[0]] : null; };
            out.clearance = {};
            for (const P of POCKETS) {
                const row = {};
                for (const x of [-600, -400, -200, 0, 200, 400, 600, 800, 1000, 1200, 1400, 1600]) row[x] = clAt(x, P.mid);
                out.clearance[P.name] = row;
            }
            return out;
        }, { seed, POCKETS });
        for (const P of POCKETS) {
            agg[P.name] = agg[P.name] || { plan: [], sail: [] };
            agg[P.name].plan.push(...r[P.name].plan);
            agg[P.name].sail.push(...r[P.name].sail);
        }
        agg.clearance = r.clearance;
        console.log(`seed ${seed}: ` + POCKETS.map(P => `${P.name} n=${r[P.name].n}`).join(' '));
    }
    await browser.close();
    console.log('\nRIVER LEG-3 POCKETS: WHAT THE PLAN SAID vs WHERE THE BOAT WENT');
    for (const P of POCKETS) {
        const a = agg[P.name];
        const pm = med(a.plan), sm = med(a.sail);
        console.log(`\n${P.name}  (northing ${P.mid}; SHE crosses at x=${P.herX})   n=${a.sail.length} boat-crossings`);
        console.log(`   plan says x = ${pm}   [${Math.min(...a.plan)}..${Math.max(...a.plan)}]   (n=${a.plan.length} plans read)`);
        console.log(`   boat sails x = ${sm}   [${Math.min(...a.sail)}..${Math.max(...a.sail)}]`);
        console.log(`   |plan - her| = ${Math.abs(pm - P.herX).toFixed(0)}   |sail - plan| = ${Math.abs(sm - pm).toFixed(0)}   |sail - her| = ${Math.abs(sm - P.herX).toFixed(0)}`);
        const verdict = Math.abs(pm - P.herX) < Math.abs(sm - pm)
            ? 'the PLAN is near her line and the BOAT is not  => DISPLACEMENT (execution layer)'
            : 'the PLAN itself is off her line               => ROUTE CHOICE (map layer)';
        console.log(`   ⇒ ${verdict}`);
        console.log(`   clearance across the river at that northing (cells to hard water):`);
        console.log(`     ` + Object.entries(agg.clearance[P.name]).map(([x, c]) => `${x}:${c}`).join('  '));
    }
})();
