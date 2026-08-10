// THE BOUNDS CLASS (redrock push P0, 2026-08-09): 37 bounds-contacts/boat on
// redrock, HUMAN-ZERO. Attribute: where (x,y cluster), which leg, what state
// (speed, wiggle, avoid, armed) at each collision_boundary EPISODE (0.5s
// dedup per boat — rule 2).
//   node _rr_bounds.js <trials> <seed0> [tree] [venue]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 4;
const SEED0 = parseInt(process.argv[3]) || 9400;
const ROOT = path.join(__dirname, process.argv[4] || 'treeHZ2');
const VENUE = process.argv[5] || 'redrock';
(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const all = [];
    for (let t = 0; t < TRIALS; t++) {
        const rows = await p.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const out = []; const lastT = {};
            const inner = window.onRaceEvent;
            window.onRaceEvent = (ty, d) => {
                try {
                    if (ty === 'collision_boundary' && d && d.boat && !d.boat.isPlayer && state.race.status === 'racing') {
                        const bt = d.boat, k = bt.id, now = state.race.timer;
                        if (lastT[k] === undefined || now - lastT[k] > 0.5) {
                            lastT[k] = now;
                            const c = bt.controller || {};
                            out.push({ t: +now.toFixed(1), x: Math.round(bt.x), y: Math.round(bt.y),
                                leg: bt.raceState.leg, spd: +((bt.speed || 0) * 60).toFixed(0),
                                wig: c.wiggleActive ? 1 : 0, av: (c.lastAvoidDeviation || 0) > 0.08 ? 1 : 0,
                                armed: bt.raceState.roundArmed ? 1 : 0 });
                        } else lastT[k] = now;
                    }
                } catch (e) {}
                if (inner) inner(ty, d);
            };
            const dt = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
            }
            return out;
        }, SEED0 + t);
        console.log(`seed ${SEED0 + t}: ${rows.length} boundary episodes`);
        all.push(...rows);
    }
    await b.close();
    const byLeg = {}, st = { wig: 0, av: 0, armed: 0, slow: 0 };
    for (const r of all) {
        byLeg[r.leg] = (byLeg[r.leg] || 0) + 1;
        st.wig += r.wig; st.av += r.av; st.armed += r.armed; if (r.spd < 40) st.slow++;
    }
    console.log(`\n=== ${VENUE} boundary episodes: ${all.length} total ===`);
    console.log('by leg:', JSON.stringify(byLeg));
    console.log(`state %: wiggle ${Math.round(100 * st.wig / all.length)} avoid ${Math.round(100 * st.av / all.length)} armed ${Math.round(100 * st.armed / all.length)} slow(<40) ${Math.round(100 * st.slow / all.length)}`);
    // top spatial clusters (400u grid)
    const cl = {};
    for (const r of all) { const k = Math.round(r.x / 400) * 400 + ',' + Math.round(r.y / 400) * 400; cl[k] = (cl[k] || 0) + 1; }
    console.log('top clusters (400u):', Object.entries(cl).sort((a, c) => c[1] - a[1]).slice(0, 6).map(([k, v]) => `(${k}):${v}`).join(' '));
})();
