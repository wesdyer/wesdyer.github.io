// Armed-phase EXECUTION deficit probe: during each bot's ARM->outbound window
// on arctic, split time into (a) irons/parked (speed<0.4), (b) rudder chasing
// (|targetHeading-heading|>0.5 while moving), (c) tracking fine. If (a)+(b) is
// small, the crew executor is exonerated and the 131s sweep wall is
// tactician/driver-level. node _armed_exec_probe.js <trials> <seed0> [tree]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 8;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeB');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' }));
    });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const rows = [];
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = -4500; pl.y = 4700;
            const st = bots.map(() => ({ frames: 0, irons: 0, chase: 0, wiggle: 0, done: false, sweepAtArm: null }));
            const dt = 1 / 60;
            for (let it = 0; it < 60 * 940; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 900) break;
                for (let k = 0; k < bots.length; k++) {
                    const b = bots[k], s = st[k];
                    if (s.done || b.raceState.finished) continue;
                    const c = b.controller;
                    if (!c) continue;
                    if (c._outbound || b.raceState.leg >= 2) { s.done = true; continue; }
                    if (!b.raceState.roundArmed) continue;
                    s.frames++;
                    if (b.speed < 0.4) s.irons++;
                    else if (c.targetHeading != null && Math.abs(normalizeAngle(c.targetHeading - b.heading)) > 0.5) s.chase++;
                    if (c.wiggleActive) s.wiggle++;
                }
            }
            return st.map((s, k) => ({ name: bots[k].name, armedT: +(s.frames / 60).toFixed(1), irons: +(s.irons / 60).toFixed(1), chase: +(s.chase / 60).toFixed(1), wiggle: +(s.wiggle / 60).toFixed(1), reachedOut: s.done }));
        }, seed);
        rows.push(...r.filter(x => x.armedT > 0).map(x => ({ seed, ...x })));
        console.log(`seed ${seed}: ${r.filter(x => x.armedT > 0).length} armed boats`);
    }
    const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
    const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
    const armed = rows;
    console.log(`\n${armed.length} armed-phase boat-windows (ARM->outbound, uncapped 900):`);
    console.log(`armedT  med ${med(armed.map(r => r.armedT))}  mean ${mean(armed.map(r => r.armedT)).toFixed(1)}`);
    console.log(`irons   med ${med(armed.map(r => r.irons))}  mean ${mean(armed.map(r => r.irons)).toFixed(1)}  (share ${(100 * mean(armed.map(r => r.irons)) / mean(armed.map(r => r.armedT))).toFixed(0)}%)`);
    console.log(`chase   med ${med(armed.map(r => r.chase))}  mean ${mean(armed.map(r => r.chase)).toFixed(1)}  (share ${(100 * mean(armed.map(r => r.chase)) / mean(armed.map(r => r.armedT))).toFixed(0)}%)`);
    console.log(`wiggle  med ${med(armed.map(r => r.wiggle))}  mean ${mean(armed.map(r => r.wiggle)).toFixed(1)}`);
    console.log('worst 10 by armedT:');
    armed.sort((a, b) => b.armedT - a.armedT).slice(0, 10).forEach(r =>
        console.log(`  seed ${r.seed} ${r.name.padEnd(10)} armed ${String(r.armedT).padStart(6)} irons ${String(r.irons).padStart(6)} chase ${String(r.chase).padStart(6)} wiggle ${String(r.wiggle).padStart(5)} out ${r.reachedOut}`));
    await browser.close();
})();
