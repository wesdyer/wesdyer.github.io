// OCEAN-BENCH NONDETERMINISM HUNT (fidelity push, E-carryover; infrastructure).
// Same tree, same seed: fl1 saw med 0.0 but p25 −11 / p75 +12 across runs —
// ocean byte-gates are suspended until the source is found. The suspect class
// is CROSS-TRIAL PAGE STATE (the camera-RNG class). Discriminate:
//   within-page: run the same seed 3x in one page — divergence here = state
//                carried across resetGame().
//   across-page: fresh browser page, same seed — divergence here too = deeper
//                (timing/float nondeterminism inside one race).
// node _oc_ndet.js <seed> [tree] [venue]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const SEED = parseInt(process.argv[2]) || 9300;
const ROOT = path.join(__dirname, process.argv[3] || 'treeFL1B');
const VENUE = process.argv[4] || 'ocean';
const runRace = async (page, seed) => page.evaluate(async (seed) => {
    window.evalHarness.seed = seed;
    window.resetGame(); window.startRace();
    state.course.cutoff = 900;
    const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
    const dt = 1 / 60;
    for (let it = 0; it < 60 * 900; it++) {
        window.update(dt);
        if (state.race.status === 'finished') break;
        if (state.race.status === 'racing' && state.race.timer > 880) break;
    }
    return state.boats.filter(b => !b.isPlayer).map(b => ({
        n: b.name, fin: b.raceState.finishTime || null,
        x: Math.round(b.x), y: Math.round(b.y)
    }));
}, seed);
const fmt = r => r.map(b => `${b.n}:${b.fin === null ? 'DNF' : b.fin.toFixed(1)}`).join(' ');
(async () => {
    const browser = await chromium.launch();
    const mkPage = async () => {
        const page = await browser.newPage();
        page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
        await page.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
        await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
        await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
        return page;
    };
    const p1 = await mkPage();
    const w1 = [];
    for (let k = 0; k < 3; k++) { w1.push(await runRace(p1, SEED)); console.log(`page1 trial${k + 1}: ${fmt(w1[k])}`); }
    await p1.close();
    const p2 = await mkPage();
    const f2 = await runRace(p2, SEED);
    console.log(`page2 trial1: ${fmt(f2)}`);
    const f2b = await runRace(p2, SEED);
    console.log(`page2 trial2: ${fmt(f2b)}`);
    await p2.close();
    const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    console.log(`\nwithin-page: t1==t2 ${eq(w1[0], w1[1])}  t2==t3 ${eq(w1[1], w1[2])}`);
    console.log(`across-page: page1t1==page2t1 ${eq(w1[0], f2)}`);
    console.log(`trial2 reproducible across pages: ${eq(w1[1], f2b)}  (true = deterministic carryover, false = wall-clock leak)`);
    await browser.close();
})();
