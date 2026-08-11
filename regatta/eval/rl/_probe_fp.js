// IS THE LAND PROBE CRYING WOLF? (2026-08-10, redrock's bowl)
//
// leg3-sub0 is +26.5 s/boat — 57% of leg 3, ~14% of redrock's whole gap — and its
// dominant state is **landAhead 54% with armed only 7%**: unarmed transit, creeping
// at 36 u/s through water she crosses at 88. `_pocket_admit` has already ruled out
// admission (the grid accepts 96% of HER line there), so the creep is execution.
//
// The land probe is a STRAIGHT RAY: `nosedIn` samples the botGrid 90u and 180u dead
// ahead of the boat's heading and calls land if either cell is unsailable
// (script.js ~3104). Inside a pocket that is 39-46% blocked, a straight ray will hit
// something almost regardless of whether the boat's actual ROUTE is clear — the
// route bends around the rock, the ray does not.
//
// THE TEST: for every frame with a plan, compare
//   (a) the straight ray's verdict  — what the code believes, and
//   (b) whether the boat's own PLANNED PATH is clear over the same distance.
// A frame where the ray says land and the plan is clear is a FALSE POSITIVE: the
// boat is taxing candidates and creeping because of geometry it was never going to
// sail into. Reported inside the bowl and over the whole race, so the pocket's rate
// can be compared with the venue's.
//
//   node _probe_fp.js <venue> <trials> <seed0> <tree> [cx cy r]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'redrock';
const TRIALS = parseInt(process.argv[3]) || 4;
const SEED0 = parseInt(process.argv[4]) || 9400;
const ROOT = path.join(__dirname, process.argv[5] || 'treeDB3');
const CX = process.argv[6] !== undefined ? parseFloat(process.argv[6]) : -747;
const CY = process.argv[7] !== undefined ? parseFloat(process.argv[7]) : -1416;
const RR = process.argv[8] !== undefined ? parseFloat(process.argv[8]) : 400;

(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    const A = { all: { n: 0, ray: 0, fp: 0, slow: 0, slowRay: 0, slowFp: 0 },
                pk:  { n: 0, ray: 0, fp: 0, slow: 0, slowRay: 0, slowFp: 0 } };
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate(({ seed, CX, CY, RR }) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const o = { all: { n: 0, ray: 0, fp: 0, slow: 0, slowRay: 0, slowFp: 0 },
                        pk:  { n: 0, ray: 0, fp: 0, slow: 0, slowRay: 0, slowFp: 0 } };
            const DT = 1 / 60; let tick = 0;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(DT);
                if (state.race.status !== 'racing') { if (state.race.status === 'finished') break; continue; }
                if (++tick % 6) continue;                       // 10 Hz
                const g = state.course.botGrid; if (!g) continue;
                for (const bo of state.boats) {
                    if (bo.isPlayer || bo.raceState.finished || bo.raceState.leg < 1) continue;
                    const c = bo.controller; if (!c) continue;
                    // (a) the straight ray the code actually uses
                    let ray = false;
                    for (const d of [90, 180]) {
                        const cc = g.cell(bo.x + Math.sin(bo.heading) * d, bo.y - Math.cos(bo.heading) * d);
                        if (!g.at(cc[0], cc[1])) { ray = true; break; }
                    }
                    // (b) is the boat's own PLAN clear over the same 180u?
                    const gp = c.gridPath;
                    let planClear = null;
                    if (gp && gp.length) {
                        planClear = true;
                        let acc = 0, px = bo.x, py = bo.y;
                        for (let k = 0; k < gp.length && acc < 180; k++) {
                            const seg = Math.hypot(gp[k].x - px, gp[k].y - py);
                            const steps = Math.max(1, Math.ceil(seg / 25));
                            for (let s = 1; s <= steps && acc < 180; s++) {
                                const f = s / steps;
                                const wx = px + (gp[k].x - px) * f, wy = py + (gp[k].y - py) * f;
                                const cc = g.cell(wx, wy);
                                if (!g.at(cc[0], cc[1])) { planClear = false; break; }
                                acc += seg / steps;
                            }
                            if (!planClear) break;
                            px = gp[k].x; py = gp[k].y;
                        }
                    }
                    const v = (bo.speed || 0) * 60;
                    const inPk = Math.hypot(bo.x - CX, bo.y - CY) <= RR;
                    for (const key of inPk ? ['all', 'pk'] : ['all']) {
                        const q = o[key];
                        q.n++; if (ray) q.ray++;
                        if (ray && planClear === true) q.fp++;
                        if (v < 40) { q.slow++; if (ray) q.slowRay++; if (ray && planClear === true) q.slowFp++; }
                    }
                }
            }
            return o;
        }, { seed: SEED0 + t, CX, CY, RR });
        for (const k of ['all', 'pk']) for (const f of Object.keys(A[k])) A[k][f] += r[k][f];
        console.log(`seed ${SEED0 + t}: ${r.all.n} samples, ${r.pk.n} in the pocket`);
    }
    await b.close();
    const pct = (a, bb) => bb ? (100 * a / bb).toFixed(1) + '%' : '-';
    console.log(`\n=== ${VENUE.toUpperCase()} LAND-PROBE FALSE POSITIVES (${TRIALS} seeds, ${path.basename(ROOT)}) ===`);
    console.log(`pocket (${CX},${CY}) r=${RR}\n`);
    for (const [lbl, q] of [['WHOLE RACE', A.all], [`THE POCKET`, A.pk]]) {
        console.log(`${lbl}`);
        console.log(`  samples ${q.n}   ray says LAND ahead ${pct(q.ray, q.n)}`);
        console.log(`  ⭐ ray says land BUT THE PLAN IS CLEAR  ${pct(q.fp, q.n)} of all samples,` +
            `  ${pct(q.fp, q.ray)} of the ray's own alarms`);
        console.log(`  while slow (<40 u/s): ray ${pct(q.slowRay, q.slow)}   of which plan-clear ${pct(q.slowFp, q.slowRay)}\n`);
    }
    console.log(`  → a high plan-clear share means the probe is taxing water the boat was`);
    console.log(`    never going to sail into: the ray is straight, the route bends.`);
})();
