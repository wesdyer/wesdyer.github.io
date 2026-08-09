// GRIDPATH LIFECYCLE in the pocket (treePR4 instrumentation): for slow boats
// in the box, log every replan (segNull? segLen?) and 1Hz carrot reads
// (carrot pos, xtk, gridAge, carrot-LOS-blocked). Answers: does the per-boat
// sailable route go stale/null for the loop boats, or does the LOOK carrot
// on a GOOD path aim through the wall?
//   node _rj_lifecycle.js <venue> <x0> <y0> <x1> <y1> <trials> <seed0> [tree]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'redrock';
const BOX = process.argv.slice(3, 7).map(Number);
const TRIALS = parseInt(process.argv[7]) || 3;
const SEED0 = parseInt(process.argv[8]) || 9400;
const ROOT = path.join(__dirname, process.argv[9] || 'treePR4');
(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const all = [];
    for (let t = 0; t < TRIALS; t++) {
        const rows = await p.evaluate(async ({ seed, BOX }) => {
            window.__rjCap = 1; window.__rjBox = BOX; window.__rjLog = [];
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const dt = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (window.__rjLog.length > 20000) break;
            }
            return window.__rjLog;
        }, { seed: SEED0 + t, BOX });
        console.log(`seed ${SEED0 + t}: ${rows.length} events`);
        for (const r of rows) { r.seed = SEED0 + t; all.push(r); }
    }
    await b.close();
    const rep = all.filter(r => r.ev === 'replan'), car = all.filter(r => r.ev === 'carrot');
    console.log(`\n=== ${VENUE} box [${BOX}] gridPath lifecycle ===`);
    console.log(`replans (slow, in box): ${rep.length}; segNull ${rep.filter(r => r.segNull).length} (${Math.round(100 * rep.filter(r => r.segNull).length / Math.max(1, rep.length))}%); segLen med ${med(rep.map(r => r.segLen))}`);
    console.log(`carrot reads (1Hz, slow): ${car.length}; carrot-LOS-BLOCKED ${car.filter(r => r.blocked).length} (${Math.round(100 * car.filter(r => r.blocked).length / Math.max(1, car.length))}%)`);
    console.log(`xtk: med ${med(car.map(r => r.xtk))} p90 ${q(car.map(r => r.xtk), 0.9)} | gridAge: med ${med(car.map(r => r.age))} p90 ${q(car.map(r => r.age), 0.9)} | pathLen med ${med(car.map(r => r.pLen))}`);
    const blk = car.filter(r => r.blocked);
    if (blk.length) {
        const cl = {};
        for (const r of blk) { const k = Math.round(r.x / 200) * 200 + ',' + Math.round(r.y / 200) * 200; cl[k] = (cl[k] || 0) + 1; }
        console.log('blocked-carrot boat clusters (200u):', Object.entries(cl).sort((a, c) => c[1] - a[1]).slice(0, 5).map(([k, v]) => `(${k}):${v}`).join(' '));
        console.log('sample blocked rows:', JSON.stringify(blk.slice(0, 4)));
    }
    function med(a) { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; }
    function q(a, p) { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(p * (s.length - 1))] : NaN; }
})();
