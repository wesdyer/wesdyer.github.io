// H1 per-episode autopsy: engagement geometry vs outcome, hits attributed
// to WHILE-ENGAGED vs WITHIN-2s-AFTER vs unrelated. treeH1 only (__H1DBG).
//   node _h1_ep.js <tree> <seed>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, process.argv[2] || 'treeH1');
const SEED = parseInt(process.argv[3]) || 9102;
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' })); });
    await page.addInitScript(() => { window.__CHAR = { neutral: 1 }; window.__H1DBG = 1; });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const r = await page.evaluate(async (seed) => {
        window.evalHarness.seed = seed;
        window.resetGame(); window.startRace();
        state.course.cutoff = 900;
        const bots = state.boats.filter(b => !b.isPlayer);
        const pl = state.boats.find(b => b.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
        const hero = bots[0];
        for (let k = 1; k < bots.length; k++) { bots[k].x = 1e6 + k * 500; bots[k].y = 1e6; bots[k].raceState.finished = true; }
        const dt = 1 / 60;
        const hitTs = [];
        const inner = window.onRaceEvent;
        window.onRaceEvent = (ty, d) => {
            try { if (d && d.boat === hero && ty === 'collision_island' && d.isFloe) hitTs.push(state.race.timer); } catch (e) { }
            if (inner) inner(ty, d);
        };
        window.__H1LOG = [];
        let engaged = []; // [t0,t1] spans (from controller state transitions)
        let lastOn = false, spanStart = 0;
        for (let it = 0; it < 60 * 900; it++) {
            window.update(dt);
            if (state.race.status === 'finished') break;
            if (state.race.status !== 'racing') continue;
            if (state.race.timer > 880) break;
            if (hero.raceState.finished) break;
            const on = !!(hero.controller && hero.controller._h1);
            const t = state.race.timer;
            if (on && !lastOn) spanStart = t;
            if (!on && lastOn) engaged.push([spanStart, t]);
            lastOn = on;
        }
        if (lastOn) engaged.push([spanStart, state.race.timer]);
        const heroLog = (window.__H1LOG || []).filter(e => e.bid === hero.id);
        return { seed, eps: heroLog, engaged, hitTs, fin: hero.raceState.finishTime || null };
    }, SEED);
    await browser.close();
    // attribute hits
    const inSpan = (t, s) => t >= s[0] - 0.1 && t <= s[1] + 0.05;
    const after = (t, s) => t > s[1] && t <= s[1] + 2.0;
    let dur = 0, hitsIn = 0, hitsAfter = 0;
    for (const t of r.hitTs) {
        if (r.engaged.some(s => inSpan(t, s))) hitsIn++;
        else if (r.engaged.some(s => after(t, s))) hitsAfter++;
    }
    for (const s of r.engaged) dur += s[1] - s[0];
    console.log(`seed ${r.seed}: fin ${r.fin && r.fin.toFixed(1)}  ${r.eps.length} episodes (${dur.toFixed(1)}s engaged)  raw hit events: ${r.hitTs.length} total, ${hitsIn} while-engaged, ${hitsAfter} within-2s-after`);
    for (const e of r.eps)
        console.log(`  t${e.t0.toFixed(1)}-${e.t1.toFixed(1)} (${(e.t1 - e.t0).toFixed(1)}s) why=${e.why.padEnd(7)} s=${e.s > 0 ? '+' : '-'} cEng=${e.cEng} minC=${e.minC} cEnd=${e.cEnd} ang=${e.angEng} om=${e.om} blkMax=${e.blkMax}`);
})();
