// HOW BIG IS THE PRIZE? — the deflection actually taken vs the MINIMAL one that
// would have cleared.
//
// The avoidance layer owns 42-45% of all excess distance on both venues, the
// twelve re-pricings and seven commitments have failed against it, and the
// soft-proximity band that triggers it is a knee on both sides. The remaining
// proposal is a different cost function — a velocity-obstacle/ORCA-style
// MINIMAL-ESCAPE formulation, which by construction takes the smallest heading
// change that clears the encounter instead of the argmin of a cost sum.
//
// Before anyone builds that, this measures the ceiling. At every avoidance
// onset with exactly one rival inside 250u (which the arity probe says is 87-93%
// of the deciding cases), it searches the heading circle for the SMALLEST
// deflection from the current heading whose predicted closest approach clears a
// safe distance, assuming the rival holds course — the same constant-velocity
// assumption ORCA makes. Then it compares that to the deflection the classical
// stack actually took.
//
// If minimal-escape is barely smaller, a VO underlay cannot pay and the bin is
// irreducible with current sensing. If it is much smaller, the gap is the prize.
//
// node _minimal_escape_probe.js <trials> <seed0> <tree> [venue] [safeDist]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 8;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeA');
const VENUE = process.argv[5] || 'bay';
const SAFE = parseFloat(process.argv[6] || '80');
const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const q = (a, f) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(f * (s.length - 1))] : NaN; };

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript((v) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: v }));
    }, VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    const all = []; let skippedTot = 0;
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async ([seed, venue, SAFE]) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer);
            if (pl) { pl.x = venue === 'arctic' ? -4500 : 5900; pl.y = venue === 'arctic' ? 4700 : -6100; }
            const wasOn = new Map();
            const out = [];
            let skipped = 0;
            const dt = 1 / 60;
            // Predicted closest approach if we sail heading h and the rival holds.
            const cpaFor = (b, o, h) => {
                const vx = Math.sin(h) * b.speed * 60, vy = -Math.cos(h) * b.speed * 60;
                const ovx = Math.sin(o.heading) * o.speed * 60, ovy = -Math.cos(o.heading) * o.speed * 60;
                const px = o.x - b.x, py = o.y - b.y;
                const rvx = ovx - vx, rvy = ovy - vy;
                const v2 = rvx * rvx + rvy * rvy;
                if (v2 < 1e-6) return Math.hypot(px, py);
                let t = -(px * rvx + py * rvy) / v2;
                if (t < 0) t = 0;
                if (t > 12) t = 12;                     // beyond 12s nothing here is predictive
                return Math.hypot(px + rvx * t, py + rvy * t);
            };
            for (let it = 0; it < 60 * 940; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 900) break;
                if (it % 6) continue;
                for (const b of bots) {
                    if (b.raceState.finished) continue;
                    const c = b.controller;
                    const dev = Math.abs((c && c.lastAvoidDeviation) || 0);
                    const on = dev > 0.12;
                    const prev = wasOn.get(b) || false;
                    wasOn.set(b, on);
                    if (!on || prev) continue;
                    // exactly one rival inside 250u — the pairwise case
                    let one = null, n = 0;
                    for (const o of state.boats) {
                        if (o === b || o.raceState.finished) continue;
                        if (Math.hypot(o.x - b.x, o.y - b.y) < 250) { n++; one = o; }
                    }
                    if (n !== 1) continue;
                    // ⚠️ ISOLATE THE BOAT-ON-BOAT CASE. A deflection at this frame
                    // could have been for a mark, the shore or a floe with a rival
                    // merely nearby — attributing that to the rival would overclaim.
                    // Require clear water: no mark, land or ice within 300u.
                    // ⚠️ NOT bounding-circle radii — a shoreline polygon's bounding
                    // circle covers the whole venue, so that test excluded 989 of 989.
                    // Clear water is what the navigation grid says it is.
                    let staticNear = false;
                    for (const m of (state.course.marks || [])) {
                        if (Math.hypot(m.x - b.x, m.y - b.y) < 300) { staticNear = true; break; }
                    }
                    if (!staticNear) {
                        const g = state.course.botGrid;
                        if (g && g._clear) {
                            const cc = g.cell(b.x, b.y);
                            if (!g.at(cc[0], cc[1]) || g._clear[cc[1] * g.n + cc[0]] < 4) staticNear = true;
                        }
                    }
                    if (staticNear) { skipped++; continue; }
                    const base = cpaFor(b, one, b.heading);
                    // smallest |delta| on a 1-degree grid that clears SAFE
                    let need = null;
                    for (let d = 0; d <= 90 && need == null; d++) {
                        for (const sgn of (d === 0 ? [1] : [1, -1])) {
                            const h = normalizeAngle(b.heading + sgn * d * Math.PI / 180);
                            if (cpaFor(b, one, h) >= SAFE) { need = d * Math.PI / 180; break; }
                        }
                    }
                    out.push({ took: +dev.toFixed(3), need: need == null ? null : +need.toFixed(3),
                               baseCPA: Math.round(base) });
                }
            }
            return { out, skipped };
        }, [seed, VENUE, SAFE]);
        all.push(...r.out); skippedTot += r.skipped;
        console.log(`seed ${seed}: ${r.out.length} clear-water pairwise onsets (${r.skipped} skipped: static obstacle within 300u)`);
    }
    await browser.close();

    const deg = r => r * 180 / Math.PI;
    const solvable = all.filter(r => r.need != null);
    const already = solvable.filter(r => r.baseCPA >= SAFE);
    console.log(`\nMINIMAL ESCAPE vs WHAT WAS TAKEN — ${VENUE}, ${TRIALS} seeds, ` +
        `${all.length} CLEAR-WATER pairwise onsets (safe distance ${SAFE}u; ${skippedTot} more excluded for a mark/land/ice within 300u)`);
    console.log(`  no heading within +/-90 deg clears: ${all.length - solvable.length}` +
        ` (${(100 * (all.length - solvable.length) / all.length).toFixed(0)}%)`);
    console.log(`  ALREADY CLEARING on the current heading: ${already.length}` +
        ` (${(100 * already.length / all.length).toFixed(0)}%) — these needed no deflection at all`);
    const took = solvable.map(r => deg(r.took)), need = solvable.map(r => deg(r.need));
    console.log(`  deflection TAKEN   p25 ${q(took, .25).toFixed(0)}  MED ${med(took).toFixed(0)}  p75 ${q(took, .75).toFixed(0)}  p90 ${q(took, .9).toFixed(0)}  degrees`);
    console.log(`  minimal NEEDED     p25 ${q(need, .25).toFixed(0)}  MED ${med(need).toFixed(0)}  p75 ${q(need, .75).toFixed(0)}  p90 ${q(need, .9).toFixed(0)}  degrees`);
    const excess = solvable.map(r => deg(r.took - r.need)).filter(x => x > 0);
    console.log(`  EXCESS over minimal (onsets where more was taken than needed): ` +
        `${excess.length}/${solvable.length} (${(100 * excess.length / solvable.length).toFixed(0)}%), ` +
        `med ${med(excess).toFixed(0)}°, mean ${(excess.reduce((a, b) => a + b, 0) / excess.length).toFixed(0)}°`);
    const under = solvable.filter(r => r.took < r.need).length;
    console.log(`  took LESS than the minimum (the encounter was not actually resolved): ` +
        `${under} (${(100 * under / solvable.length).toFixed(0)}%)`);
})();
