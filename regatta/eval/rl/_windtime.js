// C sizing, bot side: per-bot wind-speed-at-boat samples (1Hz) over a fleet
// race — same statistic as the human corpus probe (time below 80%/60% of
// own-lap median wind).  node _windtime.js <trials> <seed0> <venue> [tree]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 2;
const SEED0 = parseInt(process.argv[3]) || 9100;
const VENUE = process.argv[4] || 'arctic';
const ROOT = path.join(__dirname, process.argv[5] || 'treeHD10');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    let tot = 0, low = 0, vlow = 0, dirty = 0;
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const per = new Map();
            const dt = 1 / 60;
            let lastS = -1;
            let dirtyN = 0, sampN = 0;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status === 'racing') {
                    const sNow = Math.floor(state.race.timer);
                    if (sNow !== lastS) {
                        lastS = sNow;
                        for (const b of state.boats) {
                            if (b.isPlayer || b.raceState.finished) continue;
                            const w = getWindAt(b.x, b.y).speed;
                            if (!per.has(b.name)) per.set(b.name, []);
                            per.get(b.name).push(w);
                            sampN++;
                            if (b.badAirIntensity > 0.15) dirtyN++;
                        }
                    }
                    if (state.race.timer > 880) break;
                }
            }
            const out = [];
            for (const [, ws] of per) out.push(ws);
            return { out, dirtyN, sampN };
        }, seed);
        for (const ws of r.out) {
            if (ws.length < 60) continue;
            const med = [...ws].sort((a, b) => a - b)[Math.floor(ws.length / 2)];
            for (const w of ws) { tot++; if (w < 0.8 * med) low++; if (w < 0.6 * med) vlow++; }
        }
        dirty += r.dirtyN; tot === 0 || null;
        console.log('seed', seed, 'done; running totals: low', low, 'of', tot, ' dirtyTicks', r.dirtyN, '/', r.sampN);
    }
    console.log('BOT', VENUE, ': time wind<80% lapMed', Math.round(100 * low / tot) + '%',
        ' <60%', Math.round(100 * vlow / tot) + '%');
    await browser.close();
})();
