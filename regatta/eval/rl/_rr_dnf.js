// Where do redrock non-finishers END? Furthest leg, final position, nearest
// mark, final speed — run on any tree, compare DNF anatomy across trees.
//   node _rr_dnf.js <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 8;
const SEED0 = parseInt(process.argv[3]) || 9400;
const ROOT = path.join(__dirname, process.argv[4] || 'treeP3');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'redrock' }));
    });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const dnfs = [];
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const dt = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 880) break;
                if (bots.every(b => b.raceState.finished)) break;
            }
            const out = [];
            for (const b of bots) {
                if (b.raceState.finished) continue;
                let nm = null, nd = 1e9;
                for (const m of state.course.marks) {
                    const d = Math.hypot(m.x - b.x, m.y - b.y);
                    if (d < nd) { nd = d; nm = m.id || (m.x.toFixed(0) + ',' + m.y.toFixed(0)); }
                }
                const c = b.controller || {};
                out.push({ seed, name: b.name, leg: b.raceState.leg,
                    x: +b.x.toFixed(0), y: +b.y.toFixed(0),
                    nearMark: nm, dMark: +nd.toFixed(0), kt: +(b.speed * 4).toFixed(2),
                    armed: !!b.raceState.roundArmed, live: c.livenessState || '?' });
            }
            return out;
        }, seed);
        dnfs.push(...r);
        console.log(`seed ${seed}: DNFs ${r.length}`);
    }
    console.log(`\nTOTAL DNFs ${dnfs.length}`);
    const byLeg = {}; for (const d of dnfs) byLeg[d.leg] = (byLeg[d.leg] || 0) + 1;
    console.log('by leg:', JSON.stringify(byLeg));
    const byMark = {}; for (const d of dnfs) byMark[d.nearMark] = (byMark[d.nearMark] || 0) + 1;
    console.log('nearest mark:', JSON.stringify(byMark));
    const med = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
    console.log('dMark med', med(dnfs.map(d => d.dMark)), ' kt med', med(dnfs.map(d => d.kt)),
        ' armed:', dnfs.filter(d => d.armed).length, ' liveness:', JSON.stringify(dnfs.reduce((a, e) => (a[e.live] = (a[e.live] || 0) + 1, a), {})));
    await browser.close();
})();
