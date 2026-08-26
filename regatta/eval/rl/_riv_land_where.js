// WHERE DOES R1 PUT RIVER'S EXTRA LAND CONTACTS? (2026-08-24 night)
// v1 fleet: river land 76->97/boat, clock neutral. This maps collision_island
// events (non-floe) by leg and northing bin for a tree, so the base/candidate
// diff localizes the damage: at the mark-3 handoff (immediate), the channel
// entrance (displacement), or diffuse downstream.
//   node _riv_land_where.js <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 3;
const SEED0 = parseInt(process.argv[3]) || 9400;
const TREE = process.argv[4] || 'treeN1';
const ROOT = path.join(__dirname, TREE);
(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await p.addInitScript(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'river' })); });
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const ALL = [];
    for (let t = 0; t < TRIALS; t++) {
        const seed = SEED0 + t;
        const r = await p.evaluate((seed) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const evs = [];
            const last = {};   // episode debounce per boat: 2s
            window.onRaceEvent = (ty, d) => {
                if (ty !== 'collision_island' || (d && d.isFloe)) return;
                const bo = d && d.boat ? d.boat : null;
                const nm = bo ? bo.name : '?';
                const tt = state.race.timer;
                if (last[nm] != null && tt - last[nm] < 2) { last[nm] = tt; return; }
                last[nm] = tt;
                evs.push({ nm, t: +tt.toFixed(1), leg: bo ? bo.raceState.leg : -1,
                    x: bo ? Math.round(bo.x) : 0, y: bo ? Math.round(bo.y) : 0 });
            };
            const DT = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(DT);
                if (state.race.status === 'finished') break;
                if (state.race.status === 'racing' && state.race.timer > 895) break;
            }
            const rm = state.course.route[1] && state.course.route[1].mark;
            return { evs, mark: rm ? { x: rm.x, y: rm.y, zone: rm.zone } : null };
        }, seed);
        for (const e of r.evs) ALL.push({ ...e, seed, mark: r.mark });
        console.log(`seed ${seed}: ${r.evs.length} land episodes`);
    }
    await b.close();
    const mark = ALL.length ? ALL[0].mark : null;
    const byLeg = {};
    for (const e of ALL) byLeg[e.leg] = (byLeg[e.leg] || 0) + 1;
    console.log(`\n=== RIVER LAND EPISODES (${TREE}, ${TRIALS} seeds, 2s debounce): ${ALL.length} ===`);
    console.log('by leg: ' + Object.entries(byLeg).sort().map(([k, v]) => `leg${k}:${v}`).join('  '));
    if (mark) {
        const near = ALL.filter(e => Math.hypot(e.x - mark.x, e.y - mark.y) < mark.zone * 2.5);
        console.log(`within 2.5 zones of mark-3 (the handoff neighborhood): ${near.length}`);
    }
    const bins = {};
    for (const e of ALL) { const bin = Math.floor(e.y / 800) * 800; bins[bin] = (bins[bin] || 0) + 1; }
    console.log('by northing bin (800u): ' + Object.entries(bins).sort((a, c) => c[1] - a[1]).slice(0, 8).map(([k, v]) => `${k}:${v}`).join('  '));
})();
