// WHO PULLS THE FLEET OFF ITS OWN ROUTE INSIDE GLOWTIDE'S ROCK BOX? (2026-08-12)
//
// `_glow_clear`: the router's leg-1 plan is WIDER water than his line (med 350u of
// clearance against his 300u, 11% under 100u against his 14%), and the boats
// nevertheless sail at med 200u with **28% under 100u and 5% inside a blocked
// cell**. `_glow_entry`: they arrive at the box ON PLAN (0u off), at 103 u/s,
// undeflected, no wiggle, no escape. So the route is sound and something takes
// them off it once they are inside.
//
// This is the `_ring_motion` measurement that named the arctic landing, aimed at
// the box: per 10 Hz tick, the helm's LAST WRITER (rule 27's order) and the boat's
// distance from its OWN plan, sliced inside the box and outside it.
//   node _glow_box.js <venue> <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'glowtide';
const TRIALS = parseInt(process.argv[3]) || 4;
const SEED0 = parseInt(process.argv[4]) || 9400;
const ROOT = path.join(__dirname, process.argv[5] || 'treeGTW');
const BOX = { x0: -750, x1: 0, y0: -1750, y1: -500 };
(async () => {
    const br = await chromium.launch(); const p = await br.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const R = [];
    for (let t = 0; t < TRIALS; t++) {
        const rows = await p.evaluate((seed) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            window.__ownLog = [];
            for (let it = 0; it < 60 * 900; it++) {
                window.update(1 / 60);
                if (state.race.status === 'finished') break;
                if (state.race.status === 'racing' && state.race.timer > 895) break;
            }
            return window.__ownLog.filter((_, i) => i % 3 === 0);
        }, SEED0 + t);
        R.push(...rows);
        console.log(`seed ${SEED0 + t}: ${rows.length} helm samples`);
    }
    await br.close();
    // cols: 0 leg 1 x 2 y 3 owner 4 spd 5 offPlan
    const q = (a, pp) => { const s = a.filter(v => v != null && v >= 0).slice().sort((x, y) => x - y); return s.length ? s[Math.floor(pp * (s.length - 1))] : NaN; };
    const inBox = r => r[1] >= BOX.x0 && r[1] <= BOX.x1 && r[2] >= BOX.y0 && r[2] <= BOX.y1;
    const L1 = R.filter(r => r[0] === 1);
    const IN = L1.filter(inBox), OUT = L1.filter(r => !inBox(r));
    const pc = (x, d) => `${x} (${(100 * x / (d || 1)).toFixed(1)}%)`;
    const table = (name, rows) => {
        console.log(`\n${name} — ${rows.length} samples`);
        const own = {};
        for (const r of rows) (own[r[3]] = own[r[3]] || []).push(r);
        console.log(`   owner        share        med speed   med off-plan   off>150u   slow<40`);
        for (const o of Object.keys(own).sort((a, b) => own[b].length - own[a].length)) {
            const g = own[o];
            console.log(`   ${o.padEnd(10)} ${pc(g.length, rows.length).padEnd(14)} ${String(q(g.map(x => x[4]), .5)).padStart(7)}   ${String(q(g.map(x => x[5]), .5)).padStart(11)}   ${(100 * g.filter(x => x[5] > 150).length / g.length).toFixed(0).padStart(7)}%   ${(100 * g.filter(x => x[4] < 40).length / g.length).toFixed(0).padStart(6)}%`);
        }
    };
    console.log(`\n=== ${VENUE.toUpperCase()} LEG 1: THE HELM INSIDE THE ROCK BOX vs OUTSIDE IT ===`);
    table('INSIDE the box', IN);
    table('OUTSIDE it (the rest of leg 1)', OUT);
})();
