// ARRIVAL-BAND TIME SIZE: per-bot leg-1 seconds (and slow seconds) in the
// 900-1800u annulus around the round mark, vs the human reference (15.4s
// transit, ~0s under 2.7kt, 26 laps). node _band_time.js <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 2;
const SEED0 = parseInt(process.argv[3]) || 9201;
const ROOT = path.join(__dirname, process.argv[4] || 'treeSWT');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' })); });
    await page.addInitScript(() => { window.__CHAR = { neutral: 1 }; });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const all = [];
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const rm = state.course.roundMark;
            const acc = {};
            const dt = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (it % 6 === 0) {
                    for (const b of state.boats) {
                        if (b.isPlayer || b.raceState.finished || b.raceState.leg !== 1) continue;
                        const d = Math.hypot(b.x - rm.x, b.y - rm.y);
                        if (d > 900 && d < 1800) {
                            const a = acc[b.name] = acc[b.name] || { t: 0, slow: 0 };
                            a.t += 0.1;
                            if (b.speed * 60 < 40) a.slow += 0.1;
                        }
                    }
                }
                if (state.race.status === 'finished') break;
                if (state.race.status === 'racing' && state.race.timer > 880) break;
            }
            return acc;
        }, seed);
        for (const [n, a] of Object.entries(r)) all.push(a);
        console.log('seed', seed, Object.entries(r).map(([n, a]) => `${n}:${a.t.toFixed(0)}s/${a.slow.toFixed(0)}slow`).join(' '));
    }
    const med = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
    console.log(`\nBOT in-band: n=${all.length}  time med ${med(all.map(a => a.t)).toFixed(1)}s  slow med ${med(all.map(a => a.slow)).toFixed(1)}s  slow mean ${(all.reduce((p, a) => p + a.slow, 0) / all.length).toFixed(1)}s`);
    console.log('HUMAN ref: 15.4s transit, 0.0s slow (26 laps)');
    await browser.close();
})();
