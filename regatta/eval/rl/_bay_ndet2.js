// BAY NDET HUNT step 2: fine window. Per-frame per-boat digest + seeded-RNG
// draw counter in [F0,F1]. If rng count diverges first => stream desync (a
// conditionally-consuming call site); if positions diverge at equal rng counts
// => non-RNG input. node _bay_ndet2.js <seed> <f0> <f1> [venue]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const SEED = parseInt(process.argv[2]) || 90210;
const F0 = parseInt(process.argv[3]) || 2100;
const F1 = parseInt(process.argv[4]) || 2280;
const VENUE = process.argv[5] || 'bay';
const ROOT = path.resolve(__dirname, '..', '..', '..');

const runRace = async (page, seed, f0, f1) => page.evaluate(async ({ seed, f0, f1 }) => {
    window.evalHarness.seed = seed;
    // wrap the (already stubbed, seeded) Math.random with a counter
    const stub = Math.random; let rngN = 0;
    Math.random = () => { rngN++; return stub(); };
    window.resetGame(); window.startRace();
    const dt = 1 / 60;
    const frames = [];
    for (let it = 0; it <= f1; it++) {
        window.update(dt);
        if (it >= f0) {
            frames.push({
                it, rngN, st: state.race.status, timer: +state.race.timer.toFixed(4),
                b: state.boats.map(bt => [+bt.x.toFixed(3), +bt.y.toFixed(3), +bt.heading.toFixed(5), +bt.speed.toFixed(4)])
            });
        }
    }
    return frames;
}, { seed, f0, f1 });

const mkBrowserPage = async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    return { browser, page };
};

(async () => {
    const a = await mkBrowserPage(); const ra = await runRace(a.page, SEED, F0, F1); await a.browser.close();
    const b = await mkBrowserPage(); const rb = await runRace(b.page, SEED, F0, F1); await b.browser.close();
    for (let i = 0; i < Math.min(ra.length, rb.length); i++) {
        const fa = ra[i], fb = rb[i];
        if (fa.rngN !== fb.rngN) {
            console.log(`RNG COUNT DIVERGES at frame ${fa.it}: A=${fa.rngN} B=${fb.rngN} (status ${fa.st}/${fb.st} timer ${fa.timer}/${fb.timer})`);
            // print boat state equality at this frame
            const eq = JSON.stringify(fa.b) === JSON.stringify(fb.b);
            console.log(`  boats identical at this frame: ${eq}`);
            process.exit(0);
        }
        for (let j = 0; j < fa.b.length; j++) {
            if (JSON.stringify(fa.b[j]) !== JSON.stringify(fb.b[j])) {
                console.log(`BOAT ${j} DIVERGES at frame ${fa.it} (rngN A=${fa.rngN} B=${fb.rngN}, status ${fa.st}, timer ${fa.timer})`);
                console.log(`  A: ${JSON.stringify(fa.b[j])}`);
                console.log(`  B: ${JSON.stringify(fb.b[j])}`);
                if (i > 0) console.log(`  prev frame ${ra[i-1].it} boat ${j}: A=${JSON.stringify(ra[i-1].b[j])} same=${JSON.stringify(ra[i-1].b[j])===JSON.stringify(rb[i-1].b[j])}`);
                const others = [];
                for (let k = 0; k < fa.b.length; k++) if (k !== j && JSON.stringify(fa.b[k]) !== JSON.stringify(fb.b[k])) others.push(k);
                console.log(`  other divergent boats this frame: ${others.join(',') || 'none'}`);
                process.exit(0);
            }
        }
    }
    console.log(`no divergence in frames [${F0},${F1}] — rngN at end A=${ra[ra.length-1].rngN} B=${rb[rb.length-1].rngN}`);
})();
