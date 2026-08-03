// Solo hero 1Hz trace with dmc progress. node solo_trace.js <seed> [maxT]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const SEED = parseInt(process.argv[2]) || 4242;
const MAX_T = parseInt(process.argv[3]) || 420;
const ROOT = path.join(__dirname, 'treeA');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' }));
    });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const rows = await page.evaluate(async ({ seed, maxT }) => {
        window.evalHarness.seed = seed;
        window.resetGame(); window.startRace();
        state.course.cutoff = 900;
        const bots = state.boats.filter(b => !b.isPlayer);
        const hero = bots[0];
        bots.slice(1).forEach((b, i) => { b.x = -4000 + i * 150; b.y = 4500; b.raceState.finished = true; });
        const pl = state.boats.find(b => b.isPlayer); pl.x = -4500; pl.y = 4700;
        const rows = []; const dt = 1 / 60;
        let last = -999, hint = null;
        const leg1 = state.course.dmc.legs[1];
        for (let i = 0; i < 60 * (maxT + 40); i++) {
            window.update(dt);
            if (state.race.status !== 'racing') continue;
            if (state.race.timer > maxT || hero.raceState.finished) break;
            if (state.race.timer - last >= 1) {
                last = state.race.timer;
                const c = hero.controller;
                const s = hero.raceState.leg === 1 ? CoursePath.project(leg1, hero.x, hero.y, hint) : null;
                if (s != null) hint = s;
                const lw = getWindAt(hero.x, hero.y);
                const twa = ((hero.heading - lw.direction + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
                rows.push({
                    t: Math.round(state.race.timer),
                    x: Math.round(hero.x), y: Math.round(hero.y),
                    s: s == null ? null : Math.round(s),
                    leg: hero.raceState.leg,
                    spd: +(hero.speed).toFixed(2),
                    twa: Math.round(twa * 180 / Math.PI),
                    tgt: c.targetHeading != null ? +c.targetHeading.toFixed(2) : null,
                    hd: +hero.heading.toFixed(2),
                    wig: c.wiggleActive ? 1 : 0,
                    esc: c.iceEscapeT > 0 ? 1 : 0,
                    tf: c._trajFloe ? 1 : 0,
                    ob: c._outbound ? 1 : 0,
                    dev: c.lastAvoidDeviation != null ? +c.lastAvoidDeviation.toFixed(2) : 0,
                    col: hero.ai && hero.ai.collisionData ? (hero.ai.collisionData.isFloe ? 'floe' : hero.ai.collisionData.type) : null,
                });
            }
        }
        return rows;
    }, { seed: SEED, maxT: MAX_T });
    fs.writeFileSync(path.join(__dirname, `strace_${SEED}.json`), JSON.stringify(rows));
    console.log('rows', rows.length, '-> strace_' + SEED + '.json');
    await browser.close();
})();
