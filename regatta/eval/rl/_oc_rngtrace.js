// OCEAN NONDETERMINISM, STAGE 2: the harness routes Math.random through the
// shared seeded stream, so one variable-draw-count caller shifts the stream
// under the physics. Log cumulative RNG draws + a boat-position hash once per
// sim-second in two fresh pages, same seed; print the first divergent second.
// node _oc_rngtrace.js <seed> [tree] [venue]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const SEED = parseInt(process.argv[2]) || 9300;
const ROOT = path.join(__dirname, process.argv[3] || 'treeFL1B');
const VENUE = process.argv[4] || 'ocean';
const runTraced = async (page, seed) => page.evaluate(async (seed) => {
    window.evalHarness.seed = seed;
    // draw counter shim (installed after ensureHooked replaced Math.random)
    window.resetGame(); window.startRace();
    let draws = 0;
    const rng = Math.random;
    Math.random = () => { draws++; return rng(); };
    state.course.cutoff = 900;
    const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
    const dt = 1 / 60;
    const log = [];
    for (let it = 0; it < 60 * 400; it++) {
        window.update(dt);
        if (it % 60 === 0) {
            let h = 0;
            for (const b of state.boats) if (!b.isPlayer) h += b.x * 1.7 + b.y * 0.3 + b.heading;
            log.push([Math.round(draws), +h.toFixed(2)]);
        }
        if (state.race.status === 'finished') break;
    }
    Math.random = rng;
    return log;
}, seed);
(async () => {
    const browser = await chromium.launch();
    const logs = [];
    for (let p = 0; p < 2; p++) {
        const page = await browser.newPage();
        page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
        await page.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
        await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
        await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
        if (process.env.WAIT_ASSETS) {
            await page.evaluate(async () => {
                await new Promise(r => document.readyState === 'complete' ? r() : window.addEventListener('load', r));
                await Promise.all(Array.from(document.images).map(i => i.decode ? i.decode().catch(() => {}) : 0));
                const imgs = [];
                const scan = (o, d) => { if (!o || d > 3) return; if (o instanceof Image) imgs.push(o); else if (typeof o === 'object') for (const k in o) scan(o[k], d + 1); };
                if (window.Assets) scan(window.Assets, 0);
                if (window.ART) scan(window.ART, 0);
                await Promise.all(imgs.map(i => i.complete ? 0 : new Promise(r => { i.onload = r; i.onerror = r; })));
                await new Promise(r => setTimeout(r, 1500));
            });
        }
        logs.push(await runTraced(page, SEED));
        await page.close();
    }
    const [a, b] = logs;
    let firstDraw = -1, firstPos = -1;
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
        if (firstDraw < 0 && a[i][0] !== b[i][0]) firstDraw = i;
        if (firstPos < 0 && a[i][1] !== b[i][1]) firstPos = i;
        if (firstDraw >= 0 && firstPos >= 0) break;
    }
    console.log(`draws@10s: ${a[10] && a[10][0]} vs ${b[10] && b[10][0]}   draws@60s: ${a[60] && a[60][0]} vs ${b[60] && b[60][0]}`);
    console.log(`first divergent second — RNG draw count: ${firstDraw}   boat positions: ${firstPos}`);
    if (firstDraw >= 0) console.log(`  at that second: draws ${a[firstDraw][0]} vs ${b[firstDraw][0]} (delta ${b[firstDraw][0] - a[firstDraw][0]})`);
    if (firstPos >= 0 && (firstDraw < 0 || firstPos < firstDraw))
        console.log('  POSITIONS diverged BEFORE the draw count — the leak is not (only) the RNG stream.');
    await browser.close();
})();
