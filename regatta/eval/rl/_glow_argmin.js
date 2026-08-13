// WHY DOES THE FAN REFUSE TO SAIL STRAIGHT IN GLOWTIDE'S LEG-3 POCKET? (2026-08-12)
//
// `_glow_slow` --solo: with EVERY RIVAL PARKED the avoidance argmin still owns
// 68.0% of the helm in the pocket and holds the boat at 66 u/s — 75% of its own
// polar — while the 20% of ticks navigation owns run at 95. So the fan is
// deflecting against ROCKS, not boats, and the deflection is the venue's biggest
// single cost (leg 3 = 52.7 s/lap = 38% of glowtide's gap).
//
// This asks the argmin what defeats the 0-rung — sailing straight on. For every
// choice made inside the pocket it logs the 0-rung's own cost and flags against
// the winner's: boat collision, STATIC collision (the 15000 term for marks,
// boundary, land and now traffic), rule violation, proximity, and the deviation
// term. Solo, so `boatCollision` should be structurally 0 and whatever remains is
// the static field talking.
//   node _glow_argmin.js <trials> <seed0> [tree] [--solo]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 3;
const SEED0 = parseInt(process.argv[3]) || 9400;
const ROOT = path.join(__dirname, process.argv[4] || 'treeGTW');
const SOLO = process.argv.includes('--solo');
(async () => {
    const br = await chromium.launch(); const p = await br.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await p.addInitScript(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'glowtide' })); });
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const R = [];
    for (let t = 0; t < TRIALS; t++) {
        const rows = await p.evaluate(({ seed, SOLO }) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            if (SOLO) { const hero = state.boats.find(b => !b.isPlayer);
                for (const b of state.boats) if (b !== hero && !b.isPlayer) { b.x = 1e6; b.y = 1e6; } }
            window.__amLog = [];
            for (let it = 0; it < 60 * 900; it++) {
                window.update(1 / 60);
                if (state.race.status === 'finished') break;
                if (state.race.status === 'racing' && state.race.timer > 895) break;
            }
            return window.__amLog;
        }, { seed: SEED0 + t, SOLO });
        R.push(...rows);
        console.log(`seed ${SEED0 + t}: ${rows.length} argmin choices in the pocket`);
    }
    await br.close();
    const q = (a, pp) => { const s = a.filter(v => v != null).slice().sort((x, y) => x - y); return s.length ? s[Math.floor(pp * (s.length - 1))] : NaN; };
    const pc = (x, d) => `${x} (${(100 * x / (d || 1)).toFixed(1)}%)`;
    const V = R.filter(r => r.zero && r.chosen);
    const held = V.filter(r => r.chosen[0] === 0), defl = V.filter(r => r.chosen[0] !== 0);
    console.log(`\n=== GLOWTIDE LEG-3 POCKET: WHAT DEFEATS SAILING STRAIGHT?${SOLO ? '  [SOLO]' : ''} ===`);
    console.log(`argmin choices inside the pocket: ${V.length}`);
    console.log(`   held course (offset 0 won): ${pc(held.length, V.length)}`);
    console.log(`   DEFLECTED:                  ${pc(defl.length, V.length)}   med |offset| ${q(defl.map(r => Math.abs(r.chosen[0])), .5)} rad  p90 ${q(defl.map(r => Math.abs(r.chosen[0])), .9)}`);
    if (!defl.length) return;
    console.log(`\n   ON THE DEFLECTED CHOICES, what was wrong with the 0-rung?`);
    console.log(`      0-rung cost:  med ${q(defl.map(r => r.zero[1]), .5)}   p75 ${q(defl.map(r => r.zero[1]), .75)}`);
    console.log(`      winner cost:  med ${q(defl.map(r => r.chosen[1]), .5)}`);
    const f = (i, n) => console.log(`      0-rung ${n.padEnd(20)} ${pc(defl.filter(r => r.zero[i]).length, defl.length)}`);
    f(2, 'boatCollision');
    f(3, 'STATIC collision');
    f(4, 'ruleViolation');
    console.log(`      0-rung proximityCost   med ${q(defl.map(r => r.zero[5]), .5)}   p75 ${q(defl.map(r => r.zero[5]), .75)}   nonzero on ${(100 * defl.filter(r => r.zero[5] > 0).length / defl.length).toFixed(0)}%`);
    console.log(`      winner deviation term  med ${q(defl.map(r => r.chosen[6]), .5)}`);
    const clean = defl.filter(r => !r.zero[2] && !r.zero[3] && !r.zero[4]);
    console.log(`\n   ⭐ 0-rung had NO collision and NO rule flag on ${pc(clean.length, defl.length)} of deflections`);
    console.log(`      — on those it was beaten by proximity alone: 0-rung prox med ${q(clean.map(r => r.zero[5]), .5)} vs winner cost med ${q(clean.map(r => r.chosen[1]), .5)}`);
    console.log(`   boat speed at a deflection: med ${q(defl.map(r => r.spd), .5)} u/s`);
})();
