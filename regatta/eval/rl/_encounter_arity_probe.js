// HOW MANY BOATS ARE IN A TYPICAL AVOIDANCE ENCOUNTER?
//
// The attributions on both venues agree that the avoidance layer owns 42-45% of
// all excess distance, and the handoff's recommendation is a STRUCTURAL
// replacement rather than another price. The obvious candidate from the
// literature is an ORCA/VO underlay — which is PAIRWISE by construction: it
// intersects one half-plane per neighbour. That is exact for a 1-on-1 crossing
// and progressively over-constrains as neighbours are added, so the arity of
// real encounters decides whether the structure fits before anyone builds it.
//
// At every frame where avoidance is actually bending the heading (>0.12 rad),
// count the rivals inside the risk radius (600u, the detection range in
// updateRiskAssessment) and inside a tight 250u. Reported as a distribution,
// split by whether the deflection is small (<69°) or in the hard tail (>=69°) —
// the tail is what a replacement has to move.
//
// node _encounter_arity_probe.js <trials> <seed0> <tree> [venue]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 8;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeA');
const VENUE = process.argv[5] || 'arctic';

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript((v) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: v }));
    }, VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    const tot = { near: {}, far: {}, tailNear: {}, tailFar: {}, n: 0, tail: 0, iceOnly: 0, tailIceOnly: 0 };
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async ([seed, venue]) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer);
            if (pl) { pl.x = venue === 'arctic' ? -4500 : 5900; pl.y = venue === 'arctic' ? 4700 : -6100; }
            const acc = { near: {}, far: {}, tailNear: {}, tailFar: {}, n: 0, tail: 0, iceOnly: 0, tailIceOnly: 0 };
            const dt = 1 / 60;
            for (let it = 0; it < 60 * 940; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 900) break;
                if (it % 6) continue;                       // 10Hz, the controller's own rate
                for (const b of bots) {
                    if (b.raceState.finished) continue;
                    const c = b.controller;
                    const dev = Math.abs((c && c.lastAvoidDeviation) || 0);
                    if (dev <= 0.12) continue;
                    let far = 0, near = 0;
                    for (const o of state.boats) {
                        if (o === b || o.raceState.finished) continue;
                        const d = Math.hypot(o.x - b.x, o.y - b.y);
                        if (d < 600) far++;
                        if (d < 250) near++;
                    }
                    const tail = dev >= 1.2;
                    acc.n++; if (tail) acc.tail++;
                    acc.far[far] = (acc.far[far] || 0) + 1;
                    acc.near[near] = (acc.near[near] || 0) + 1;
                    if (tail) {
                        acc.tailFar[far] = (acc.tailFar[far] || 0) + 1;
                        acc.tailNear[near] = (acc.tailNear[near] || 0) + 1;
                    }
                    // Deflecting with NO rival in range at all = the obstacle is ice
                    // or land, which no boat-to-boat structure can help with.
                    if (far === 0) { acc.iceOnly++; if (tail) acc.tailIceOnly++; }
                }
            }
            return acc;
        }, [seed, VENUE]);
        for (const k of ['near', 'far', 'tailNear', 'tailFar'])
            for (const b in r[k]) tot[k][b] = (tot[k][b] || 0) + r[k][b];
        tot.n += r.n; tot.tail += r.tail; tot.iceOnly += r.iceOnly; tot.tailIceOnly += r.tailIceOnly;
        console.log(`seed ${seed}: ${r.n} avoiding frames`);
    }
    await browser.close();

    const show = (m, total, label) => {
        const keys = Object.keys(m).map(Number).sort((a, b) => a - b);
        console.log(`  ${label}: ` + keys.map(k => `${k}:${(100 * m[k] / total).toFixed(0)}%`).join('  '));
    };
    console.log(`\nENCOUNTER ARITY — ${VENUE}, ${TRIALS} seeds, ${tot.n} avoiding frames ` +
                `(${tot.tail} in the >=69° tail)`);
    show(tot.far, tot.n, 'rivals within 600u, ALL avoiding frames ');
    show(tot.near, tot.n, 'rivals within 250u, ALL avoiding frames ');
    show(tot.tailFar, Math.max(1, tot.tail), 'rivals within 600u, TAIL (>=69°) only ');
    show(tot.tailNear, Math.max(1, tot.tail), 'rivals within 250u, TAIL (>=69°) only ');
    console.log(`  deflecting with NO rival inside 600u (ice/land only): ` +
        `${(100 * tot.iceOnly / tot.n).toFixed(0)}% of all, ` +
        `${(100 * tot.tailIceOnly / Math.max(1, tot.tail)).toFixed(0)}% of the tail`);
})();
