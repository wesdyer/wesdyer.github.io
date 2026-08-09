// Frame-level divergence bisect: 600 frames, per-boat positions per frame.
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const SEED = parseInt(process.argv[2]) || 9300;
const ROOT = path.join(__dirname, process.argv[3] || 'treeFL1B');
const VENUE = process.argv[4] || 'ocean';
(async () => {
    const browser = await chromium.launch();
    const logs = [];
    for (let p = 0; p < 2; p++) {
        const page = await browser.newPage();
        await page.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
        await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
        await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
        logs.push(await page.evaluate((seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            const out = [];
            for (let f = 0; f < 600; f++) {
                window.update(1 / 60);
                out.push(state.boats.map(b => b.name + ':' + b.x.toFixed(6) + ',' + b.y.toFixed(6) + ',' + b.heading.toFixed(6) + ',' + (b.speed || 0).toFixed(6)).join(' | ') + ' §rng' + window.evalHarness.seed);
            }
            return out;
        }, SEED));
        await page.close();
    }
    const [a, b] = logs;
    let f0 = -1;
    for (let f = 0; f < 600; f++) if (a[f] !== b[f]) { f0 = f; break; }
    console.log('first divergent frame:', f0);
    if (f0 >= 0) {
        const pa = a[f0].split(' | '), pb = b[f0].split(' | ');
        for (let i = 0; i < pa.length; i++) if (pa[i] !== pb[i]) console.log('  boat/rng diff:', pa[i], 'VS', pb[i]);
    }
    await browser.close();
})();
