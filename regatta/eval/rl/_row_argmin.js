// WHAT MAKES THE RIGHT-OF-WAY BOAT SWERVE? (2026-08-13)
//
// `_row_defer`: the boat that HAS rights deflects more than 8 deg on 76.5% of
// engaged encounters on glowtide and 83.5% on redrock, by a median MAXIMUM of
// 69 and 92 degrees — against the human's measured 11-23 deg ROW profile — and it
// does not even work: deflecting is associated with 10.8%/6.7% collisions against
// 2.1%/0.0% when she holds.
//
// The fan already has a hold-course term for exactly this: STAND_ON pays
// |offset| * 3000 * jamF at MEDIUM risk and * 1000 at HIGH (and nothing at
// IMMINENT, by design). At a 69 deg swerve that is ~3600. `_glow_argmin` measured
// `proximityCost` at a median of 6667 in glowtide's rock water.
//
// So the hypothesis is that the owner's rights complaint and glowtide's leg-3
// speed loss are ONE root cause: a single soft term outweighing everything the
// cost function says about rights and about sailing straight. This tests it by
// slicing the argmin ledger by the rules engine's own verdict.
//   node _row_argmin.js <venue> <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'glowtide';
const TRIALS = parseInt(process.argv[3]) || 3;
const SEED0 = parseInt(process.argv[4]) || 9400;
const ROOT = path.join(__dirname, process.argv[5] || 'treeGTW');
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
            window.__amLog = []; window.__amAll = 1;      // whole course, not one box
            for (let it = 0; it < 60 * 900; it++) {
                window.update(1 / 60);
                if (state.race.status === 'finished') break;
                if (state.race.status === 'racing' && state.race.timer > 895) break;
            }
            return window.__amLog.filter(r => r.rowMine != null);
        }, SEED0 + t);
        R.push(...rows);
        console.log(`seed ${SEED0 + t}: ${rows.length} argmin choices with a rules verdict`);
    }
    await br.close();
    const q = (a, pp) => { const s = a.filter(v => v != null).slice().sort((x, y) => x - y); return s.length ? s[Math.floor(pp * (s.length - 1))] : NaN; };
    const pc = (x, d) => `${x} (${(100 * x / (d || 1)).toFixed(1)}%)`;
    const cut = (name, rows) => {
        if (!rows.length) return;
        const defl = rows.filter(r => r.chosen[0] !== 0);
        console.log(`\n${name} — ${rows.length} choices`);
        console.log(`   DEFLECTED on ${pc(defl.length, rows.length)}   med |offset| ${q(defl.map(r => Math.abs(r.chosen[0])), .5)} rad (${(180 / Math.PI * q(defl.map(r => Math.abs(r.chosen[0])), .5)).toFixed(0)} deg)`);
        if (!defl.length) return;
        const clean = defl.filter(r => !r.zero[2] && !r.zero[3] && !r.zero[4]);
        console.log(`   the 0-rung carried NO collision and NO rule flag on ${pc(clean.length, defl.length)}`);
        console.log(`      its proximityCost there: med ${q(clean.map(r => r.zero[5]), .5)}   p75 ${q(clean.map(r => r.zero[5]), .75)}`);
        console.log(`      the winner's cost:       med ${q(clean.map(r => r.chosen[1]), .5)}   its deviation term med ${q(clean.map(r => r.chosen[6]), .5)}`);
    };
    console.log(`\n=== ${VENUE.toUpperCase()}: WHAT MAKES HER SWERVE, BY WHO HAS RIGHTS ===`);
    cut('⭐ SHE HAS RIGHTS (rules engine)', R.filter(r => r.rowMine === true));
    cut('   she owes keep-clear', R.filter(r => r.rowMine === false));
    const so = R.filter(r => r.rowMine === true);
    console.log(`\n   of the choices where she HAS rights, the controller believed:`);
    const ro = {}; for (const r of so) ro[r.role] = (ro[r.role] || 0) + 1;
    for (const k of Object.keys(ro).sort((a, b) => ro[b] - ro[a])) console.log(`      ${String(k).padEnd(10)} ${pc(ro[k], so.length)}`);
    console.log(`   and its risk state was:`);
    const ri = {}; for (const r of so) ri[r.risk] = (ri[r.risk] || 0) + 1;
    for (const k of Object.keys(ri).sort((a, b) => ri[b] - ri[a])) console.log(`      ${String(k).padEnd(10)} ${pc(ri[k], so.length)}   (the hold-course term is 3000x|off| at MEDIUM, 1000x at HIGH, ZERO at IMMINENT)`);
})();
