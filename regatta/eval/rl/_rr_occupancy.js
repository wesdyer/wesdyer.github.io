// P3 measurement — REDROCK congestion: where does the fleet queue, how much
// time does each boat lose parked, and how many boats share the lane at once?
// Per leg: duration per boat, time under 1 kt, and the spatial clusters of
// parked (<1 kt) time. Also max simultaneous occupancy of each parked cluster.
//   node _rr_occupancy.js <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 4;
const SEED0 = parseInt(process.argv[3]) || 9400;
const ROOT = path.join(__dirname, process.argv[4] || 'treePH0');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'redrock' }));
    });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const all = [];
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const legDur = {};      // name -> {leg: seconds}
            const parkT = {};       // name -> {leg: seconds under 1kt}
            const parkCells = {};   // "x,y" 200u bin -> parked seconds
            const occSamples = [];  // per 2s: parked count per bin (for max simultaneous)
            const dt = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                const t = state.race.timer;
                if (t > 880) break;
                if (it % 30 === 0) {
                    const snap = {};
                    for (const b of bots) {
                        if (b.raceState.finished) continue;
                        const lg = b.raceState.leg;
                        (legDur[b.name] = legDur[b.name] || {})[lg] = (legDur[b.name][lg] || 0) + 0.5;
                        if (b.speed * 4 < 1.0 && lg >= 1) {
                            (parkT[b.name] = parkT[b.name] || {})[lg] = (parkT[b.name][lg] || 0) + 0.5;
                            const k = (Math.round(b.x / 200) * 200) + ',' + (Math.round(b.y / 200) * 200);
                            parkCells[k] = (parkCells[k] || 0) + 0.5;
                            snap[k] = (snap[k] || 0) + 1;
                        }
                    }
                    if (it % 240 === 0) occSamples.push(snap);
                }
                if (bots.every(b => b.raceState.finished)) break;
            }
            const fins = bots.filter(b => b.raceState.finished).length;
            return { seed, legDur, parkT, parkCells, occSamples, fins, nBots: bots.length };
        }, seed);
        all.push(r);
        console.log(`seed ${seed}: finishers ${r.fins}/${r.nBots}`);
    }
    fs.writeFileSync(path.join(__dirname, 'rr_occupancy.json'), JSON.stringify(all));
    // aggregate
    const med = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return +s[Math.floor(s.length / 2)].toFixed(1); };
    const legAll = {}, parkAll = {};
    for (const r of all) {
        for (const nm of Object.keys(r.legDur)) for (const lg of Object.keys(r.legDur[nm]))
            (legAll[lg] = legAll[lg] || []).push(r.legDur[nm][lg]);
        for (const nm of Object.keys(r.parkT)) for (const lg of Object.keys(r.parkT[nm]))
            (parkAll[lg] = parkAll[lg] || []).push(r.parkT[nm][lg]);
    }
    console.log('\nleg duration med (s):', JSON.stringify(Object.fromEntries(Object.entries(legAll).map(([k, v]) => [k, med(v)]))));
    console.log('parked time per boat-leg med (s):', JSON.stringify(Object.fromEntries(Object.entries(parkAll).map(([k, v]) => [k, med(v)]))));
    console.log('parked time per boat-leg p90 (s):', JSON.stringify(Object.fromEntries(Object.entries(parkAll).map(([k, v]) => [k, +[...v].sort((a, b) => a - b)[Math.floor(v.length * 0.9)].toFixed(0)]))));
    const cells = {};
    for (const r of all) for (const k of Object.keys(r.parkCells)) cells[k] = (cells[k] || 0) + r.parkCells[k];
    const top = Object.entries(cells).sort((a, b) => b[1] - a[1]).slice(0, 10);
    console.log('top parked clusters (200u bins, total parked boat-seconds):', JSON.stringify(Object.fromEntries(top.map(([k, v]) => [k, +v.toFixed(0)]))));
    let maxOcc = {}, occN = 0;
    for (const r of all) for (const s of r.occSamples) for (const [k, v] of Object.entries(s)) if ((maxOcc[k] || 0) < v) maxOcc[k] = v;
    const topOcc = Object.entries(maxOcc).sort((a, b) => b[1] - a[1]).slice(0, 6);
    console.log('max simultaneous parked per bin:', JSON.stringify(Object.fromEntries(topOcc)));
    await browser.close();
})();
