// WHO AIMS THE BOAT IN THE LAST FIFTH OF LEG 1, AND CAN SHE SAIL THERE? (2026-08-11)
//
// `_leg1_where`: the last two bands of arctic's leg 1 carry 87.5 s of the leg's
// 142.7 s gap (61%), odometer 2.13-2.88x, and 23.0 of the leg's 41.0 s of
// head-to-wind time. `_arc_nogo`: 22.6% of leg 1's compiled ruler is INSIDE the
// no-go, and band 70-80 is 100% of it with a minimum |TWA| of 1 degree.
//
// The rounding machinery builds its targets from geometry and ice alone — the
// entrance sector hunt scores clearance/churn/crowding, the armed orbit aims a
// fixed 0.85 rad ahead in the rotation at a radius picked off the grid, the ruler
// carrot walks the compiled path. None of them asks where the wind is.
//
// This attributes every navigation tick on the rounding leg to the generator that
// produced it and records |TWA| OF THE BEARING TO THE TARGET, so "the boat is
// being aimed somewhere she cannot sail" becomes a number per generator and per
// sub-leg band rather than an inference.
//   node _nav_src.js <venue> <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'arctic';
const TRIALS = parseInt(process.argv[3]) || 3;
const SEED0 = parseInt(process.argv[4]) || 9100;
const ROOT = path.join(__dirname, process.argv[5] || 'treeTW');
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
            window.__navLog = [];
            for (let it = 0; it < 60 * 900; it++) {
                window.update(1 / 60);
                if (state.race.status === 'finished') break;
                if (state.race.status === 'racing' && state.race.timer > 895) break;
            }
            return window.__navLog;
        }, SEED0 + t);
        R.push(...rows);
        console.log(`seed ${SEED0 + t}: ${rows.length} nav ticks`);
    }
    await br.close();
    // cols: 0 leg 1 src 2 |TWA to target| 3 |TWA hull| 4 speed 5 dist 6 progFrac
    const q = (a, pp) => { if (!a.length) return NaN; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(pp * (s.length - 1))]; };
    const D = r => (r * 180 / Math.PI).toFixed(0);
    const L1 = R.filter(r => r[0] === 1);
    const late = L1.filter(r => r[6] >= 0.8);
    const show = (name, rows, den) => {
        if (!rows.length) return;
        const ng = rows.filter(r => r[2] < 0.62).length;
        console.log(`   ${name.padEnd(11)} ${String(rows.length).padStart(6)} ticks (${(100 * rows.length / den).toFixed(1)}%)  target |TWA| med ${D(q(rows.map(r => r[2]), .5))}deg  ⭐ INSIDE THE NO-GO ${(100 * ng / rows.length).toFixed(1)}%  dist med ${q(rows.map(r => r[5]), .5)}u  spd med ${q(rows.map(r => r[4]), .5)}`);
    };
    console.log(`\n=== ${VENUE.toUpperCase()}: WHO AIMS THE BOAT, AND CAN SHE SAIL THERE? (${TRIALS} seeds) ===`);
    console.log(`\nLEG 1 — ALL of it (${L1.length} nav ticks):`);
    for (const s of [...new Set(L1.map(r => r[1]))]) show(s, L1.filter(r => r[1] === s), L1.length);
    console.log(`\nLEG 1 — LAST FIFTH ONLY (progress >= 80%, ${late.length} ticks) — where 61% of the leg's gap is:`);
    for (const s of [...new Set(late.map(r => r[1]))]) show(s, late.filter(r => r[1] === s), late.length);
    const ironsLate = late.filter(r => r[3] < 0.62);
    console.log(`\n   hull head-to-wind on ${(100 * ironsLate.length / (late.length || 1)).toFixed(1)}% of last-fifth ticks;`);
    console.log(`   of those, the TARGET was also inside the no-go on ${(100 * ironsLate.filter(r => r[2] < 0.62).length / (ironsLate.length || 1)).toFixed(1)}%`);
})();
