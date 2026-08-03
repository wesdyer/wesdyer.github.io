// Fixed 12-seed solo benchmark: the statistically honest gate for arctic AI knobs.
// Reports mean/min/max leg-1 progress %, finishes, contacts. ~20 min.
// Usage: node solo_bench.js <label>
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ROOT = '/Users/wesdyer/Documents/GitHub/wesdyer.github.io';
const LABEL = process.argv[2] || 'bench';
const SEEDS = [4242,4243,4244,4245,4246,4247,4248,4249,4250,4251,4252,4253];
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0,200)));
    await page.addInitScript(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' })); });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const rows = [];
    for (const seed of SEEDS) {
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            const bots = state.boats.filter(b => !b.isPlayer);
            const hero = bots[0];
            bots.slice(1).forEach((b, i) => { b.x = -4000 + i * 150; b.y = 4500; b.raceState.finished = true; });
            const pl = state.boats.find(b => b.isPlayer); pl.x = -4500; pl.y = 4700;
            let ice = 0;
            const inner = window.onRaceEvent;
            window.onRaceEvent = (t, d) => { if (t === 'collision_island' && d.boat === hero) ice++; return inner && inner(t, d); };
            const dt = 1 / 60; let hint = null, sMax = 0, lastT = -999, fin = null, leg2 = null;
            const leg1 = state.course.dmc.legs[1];
            for (let i = 0; i < 60 * 450; i++) {
                window.update(dt);
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 430) break;
                if (state.race.timer - lastT >= 2 && hero.raceState.leg === 1) {
                    lastT = state.race.timer;
                    const s = CoursePath.project(leg1, hero.x, hero.y, hint); hint = s;
                    if (s > sMax) sMax = s;
                }
                if (leg2 === null && hero.raceState.leg >= 2) leg2 = Math.round(state.race.timer);
                if (hero.raceState.finished) { fin = Math.round(state.race.timer); break; }
            }
            return { pct: Math.round(sMax / leg1.length * 100), leg2, fin, ice };
        }, seed);
        rows.push({ seed, ...r });
        console.log(`  seed ${seed}: pct ${r.pct} leg2 ${r.leg2} fin ${r.fin} ice ${r.ice}`);
    }
    const pcts = rows.map(r => r.pct);
    const mean = pcts.reduce((a, b) => a + b, 0) / pcts.length;
    console.log(`\n=== ${LABEL}: mean ${mean.toFixed(1)}%  min ${Math.min(...pcts)}  max ${Math.max(...pcts)}  ` +
        `roundings ${rows.filter(r => r.leg2 != null).length}/12  finishes ${rows.filter(r => r.fin != null).length}/12  ` +
        `cleanRuns ${rows.filter(r => r.ice === 0).length}/12 ===`);
    await browser.close();
})();
