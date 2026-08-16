// DO FAR PLUG STAMPS SURVIVE UNTIL ARRIVAL? The router prices soft (floe-
// plugged) cells at x2.5/x6 along the WHOLE route from today's snapshot; the
// edge-cost decomposition shows that is what buys the 1.2-1.5x detours. Ice
// drifts and is unpredictable past ~5 s — so: sample blocked/soft cells at
// plan-relevant distances from a solo boat, and check the SAME cell when the
// boat would arrive (distance / 110 u/s later). P(still unsailable | distance)
// is the number the far-field discount candidate stands or falls on.
//   node _arc_stale.js <tree> [seeds...]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, process.argv[2] || 'treeCMB');
const SEEDS = process.argv.slice(3).length ? process.argv.slice(3).map(Number) : [9400, 9401, 9402];
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await page.evaluate((v) => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), 'arctic');
    const agg = {};   // band -> {checks, stillBad, wasSoft, softStill}
    for (const seed of SEEDS) {
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const solo = bots[0];
            for (const o of state.boats) if (o !== solo) {
                o.x = 1e6; o.y = 1e6; o.raceState.finished = true; o.fadeTimer = 0;
            }
            const pend = [];   // {id, at, band, wasSoft}
            const bands = {};
            const SPEED = 110; // u/s assumed transit speed
            const dt = 1 / 60;
            let lastSample = -10;
            for (let it = 0; it < 60 * 940; it++) {
                window.update(dt);
                if (state.race.status === 'finished' || solo.raceState.finished) break;
                const t = state.race.status === 'racing' ? state.race.timer : -1;
                if (t < 0) continue;
                if (t > 900) break;
                const g = state.course.botGrid;
                if (!g) continue;
                // resolve due checks
                while (pend.length && pend[0].at <= t) {
                    const p = pend.shift();
                    const i = p.id % g.n, j = (p.id - i) / g.n;
                    const stillBad = !g.at(i, j);
                    const stillSoft = stillBad && g._soft && g._soft[p.id] > 0;
                    const k = p.band;
                    if (!bands[k]) bands[k] = { checks: 0, stillBad: 0, wasSoft: 0, softStill: 0 };
                    bands[k].checks++; if (stillBad) bands[k].stillBad++;
                    if (p.wasSoft) { bands[k].wasSoft++; if (stillBad) bands[k].softStill++; }
                }
                if (t - lastSample < 5 || solo.raceState.leg < 1) continue;
                lastSample = t;
                // sample up to 60 unsailable cells around the boat
                const [bi, bj] = g.cell(solo.x, solo.y);
                let n = 0;
                for (let tries = 0; tries < 600 && n < 60; tries++) {
                    const di = Math.floor((evalHarness.rand ? evalHarness.rand() : Math.random()) * 80) - 40;
                    const dj = Math.floor((evalHarness.rand ? evalHarness.rand() : Math.random()) * 80) - 40;
                    const i = bi + di, j = bj + dj;
                    if (i < 1 || j < 1 || i >= g.n - 1 || j >= g.n - 1) continue;
                    if (g.at(i, j)) continue;             // want unsailable now
                    const w = g.world(i, j);
                    const d = Math.hypot(w[0] - solo.x, w[1] - solo.y);
                    if (d < 150 || d > 2400) continue;
                    const id = j * g.n + i;
                    const wasSoft = !!(g._soft && g._soft[id] > 0);
                    const band = d < 500 ? '150-500' : d < 1000 ? '500-1000' : d < 1600 ? '1000-1600' : '1600-2400';
                    pend.push({ id, at: t + d / SPEED, band, wasSoft });
                    n++;
                }
                pend.sort((a, b) => a.at - b.at);
            }
            return bands;
        }, seed);
        console.log(`seed ${seed} done`);
        for (const k of Object.keys(r)) {
            if (!agg[k]) agg[k] = { checks: 0, stillBad: 0, wasSoft: 0, softStill: 0 };
            for (const f of Object.keys(r[k])) agg[k][f] += r[k][f];
        }
    }
    console.log('\ndistance band   n      P(still unsailable at ETA)   soft-subset n   P(soft still unsailable)');
    for (const k of ['150-500', '500-1000', '1000-1600', '1600-2400']) {
        const B = agg[k]; if (!B) continue;
        console.log(k.padEnd(14), String(B.checks).padStart(5),
            ((100 * B.stillBad / Math.max(1, B.checks)).toFixed(1) + '%').padStart(12),
            String(B.wasSoft).padStart(16),
            B.wasSoft ? ((100 * B.softStill / B.wasSoft).toFixed(1) + '%').padStart(12) : '        -');
    }
    await browser.close();
})();
