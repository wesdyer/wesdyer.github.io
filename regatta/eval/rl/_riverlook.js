// Visual check of the landed pre-start on river: fleet positions and speeds
// second by second, plus a frame at T-20/T-10/T-0 to eyeball the shape.
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const ROOT = '/Users/wesdyer/Documents/GitHub/wesdyer.github.io/regatta/eval/rl/' + (process.argv[2] || 'treeSPP');
(async () => {
    const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await p.evaluate(() => localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'river', character: AI_CONFIG[0].name })));
    const out = await p.evaluate(async () => {
        window.evalHarness.seed = 9400; window.resetGame(); window.startRace();
        const pl = state.boats.find(x => x.isPlayer);
        applyBoatIdentity(pl, playerCharacter(), false); pl.isPlayer = false; pl.manualTrim = false;
        const nine = state.boats.filter(x => x !== pl);
        pl.ai.startLinePct = Math.max(0.05, Math.min(0.90, nine.reduce((a, x) => a + x.ai.startLinePct, 0) / nine.length));
        pl.ai.setupDist = 300;
        const rows = []; let it = 0;
        while (state.race.status === 'prestart' && it < 60 * 60) {
            window.update(1 / 60); it++;
            if (it % 60) continue;
            const [m0, m1] = startLinePts();
            const kt = state.boats.map(x => +(x.speed * 4).toFixed(1));
            const be = state.boats.map(x => Math.round(-hullLineOffset(x, m0, m1, true)));
            rows.push({ t: +state.race.timer.toFixed(0), ktMed: kt.sort((a, c) => a - c)[5], beMed: be.sort((a, c) => a - c)[5],
                        beMin: Math.min(...be), beMax: Math.max(...be), ktMin: Math.min(...kt) });
        }
        return rows;
    });
    console.log('  T-   median kt   median behind   nearest   furthest   slowest kt');
    for (const r of out) console.log(`  ${String(r.t).padStart(3)}  ${String(r.ktMed).padStart(9)}  ${String(r.beMed).padStart(13)}  ${String(r.beMin).padStart(8)}  ${String(r.beMax).padStart(9)}  ${String(r.ktMin).padStart(10)}`);
    await b.close();
})();
