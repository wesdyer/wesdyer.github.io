// PER-LEG COLLISION ATTRIBUTION (2026-08-09, owner table request). Same
// onRaceEvent hook + 0.5s per-boat:cat dedup as ocean_bench.js, but counts
// are keyed by the boat's CURRENT LEG at event time. Reports per-leg
// per-boat-race med/mean of boat rubs and land (hard island) contacts.
//   node _leg_col.js <venue> <trials> <seed0> [tree=treeB1]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'redrock';
const TRIALS = parseInt(process.argv[3]) || 8;
const SEED0 = parseInt(process.argv[4]) || 9400;
const ROOT = path.join(__dirname, process.argv[5] || 'treeB1');
(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await p.evaluate(() => {
        const inner = window.onRaceEvent;
        window.__lc = {}; window.__lcT = {};
        const mono = () => state.race.status === 'prestart' ? -state.race.timer : state.race.timer;
        window.onRaceEvent = (ty, d) => {
            try {
                if (d && d.boat && !d.boat.isPlayer && !d.boat.raceState.finished
                    && (ty === 'collision_boat' || ty === 'collision_island')) {
                    const cat = ty === 'collision_boat' ? 'boat' : (d.isFloe ? 'floe' : 'land');
                    if (cat !== 'floe') {
                        const k = d.boat.name + ':' + cat, t = mono();
                        if (window.__lcT[k] == null || t - window.__lcT[k] >= 0.5) {
                            window.__lcT[k] = t;
                            const leg = d.boat.raceState.leg;
                            const bk = d.boat.name + ':' + leg;
                            const c = window.__lc[bk] = window.__lc[bk] || { boat: 0, land: 0 };
                            c[cat] += 1;
                        }
                    }
                }
            } catch (e) {}
            return inner && inner(ty, d);
        };
    });
    // rows: one record per boat-race: {legStats: {leg: {boat, land}}}
    const rows = [];
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate(async (seed) => {
            window.__lc = {}; window.__lcT = {};
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const dt = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
            }
            const names = state.boats.filter(x => !x.isPlayer).map(x => x.name);
            return { lc: window.__lc, names };
        }, SEED0 + t);
        console.log(`seed ${SEED0 + t}: ${Object.keys(r.lc).length} boat-leg cells with contacts`);
        rows.push(r);
    }
    await b.close();
    // aggregate: per leg, one value per boat-race (0 if no contacts that leg)
    const NLEG = 7;
    const per = {};
    for (let l = 0; l < NLEG; l++) per[l] = { boat: [], land: [] };
    for (const r of rows) {
        for (const nm of r.names) {
            for (let l = 0; l < NLEG; l++) {
                const c = r.lc[nm + ':' + l] || { boat: 0, land: 0 };
                per[l].boat.push(c.boat); per[l].land.push(c.land);
            }
        }
    }
    const q = (a, pp) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(pp * (s.length - 1))]; };
    const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
    console.log(`\n=== ${VENUE} per-leg contacts, ${rows.length} races x ${rows[0].names.length} boats (per boat-race) ===`);
    console.log('leg   boat med / mean / p75      land med / mean / p75');
    for (let l = 0; l < NLEG; l++) {
        const B = per[l].boat, L = per[l].land;
        console.log(`  ${l}     ${q(B, .5)} / ${mean(B).toFixed(2)} / ${q(B, .75)}          ${q(L, .5)} / ${mean(L).toFixed(2)} / ${q(L, .75)}`);
    }
})();
