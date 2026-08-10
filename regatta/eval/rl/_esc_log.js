// ESCAPE EPISODE LOG (Phase B, redrock push cont. 2026-08-09): runs treeB1
// with __escLog set and reports every stuck-state maneuver episode — where it
// fired, how long it ran, terminal speed, and whether the boat was un-nosed
// on exit (success = the wedge broke). The mechanism gate's fine detail.
//   node _esc_log.js <venue> <trials> <seed0> [tree=treeB1]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'redrock';
const TRIALS = parseInt(process.argv[3]) || 4;
const SEED0 = parseInt(process.argv[4]) || 9400;
const ROOT = path.join(__dirname, process.argv[5] || 'treeB1');
(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const eps = [];
    for (let t = 0; t < TRIALS; t++) {
        const rows = await p.evaluate(async ({ seed }) => {
            window.__escLog = [];
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const dt = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
            }
            const fins = state.boats.filter(x => !x.isPlayer && x.raceState.finished).length;
            return { log: window.__escLog, fins, n: state.boats.length - 1 };
        }, { seed: SEED0 + t });
        console.log(`seed ${SEED0 + t}: ${rows.log.length} escape ticks, fins ${rows.fins}/${rows.n}`);
        for (const r of rows.log) { r.seed = SEED0 + t; }
        eps.push(...rows.log);
    }
    await b.close();
    // stitch ticks into episodes (same seed+boat, gap > 1.5s => new episode)
    const byBoat = {};
    for (const r of eps) (byBoat[r.seed + ':' + r.id] = byBoat[r.seed + ':' + r.id] || []).push(r);
    const episodes = [];
    for (const k of Object.keys(byBoat)) {
        const rs = byBoat[k].sort((a, c) => a.t - c.t);
        let cur = [rs[0]];
        for (let i = 1; i < rs.length; i++) {
            if (rs[i].t - rs[i - 1].t > 1.5) { episodes.push(cur); cur = []; }
            cur.push(rs[i]);
        }
        episodes.push(cur);
    }
    console.log(`\n=== ${VENUE}: ${episodes.length} escape episodes, ${Object.keys(byBoat).length} distinct boats ===`);
    for (const ep of episodes.sort((a, c) => c.length - a.length).slice(0, 20)) {
        const first = ep[0], last = ep[ep.length - 1];
        const dur = (last.t - first.t).toFixed(1);
        console.log(`  seed ${first.seed} boat ${first.id} @(${first.x},${first.y}) dur ${dur}s spd ${first.spd}→${last.spd} crumbs ${first.nCr}→${last.nCr}`);
    }
})();
