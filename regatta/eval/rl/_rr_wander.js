// P0 anatomy — REDROCK legs 2/4 sail 2.2x the route length with avoidance
// active ~60% of the time (see _rr_leganat). WHOSE deflection is it — rivals
// (give-way / VO staleness) or land probes (canyon walls)? Per 10Hz sample on
// legs 2-4: deflection magnitude, nearest-rival distance, and heading-vs-route
// alignment; odometer split into deflected vs clean sailing.
//   node _rr_wander.js <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 4;
const SEED0 = parseInt(process.argv[3]) || 9400;
const ROOT = path.join(__dirname, process.argv[4] || 'treeP4H');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'redrock' }));
    });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const acc = {};
    const bump = (k, dt, odo) => { const a = acc[k] = acc[k] || { t: 0, odo: 0 }; a.t += dt; a.odo += odo; };
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const last = bots.map(b => ({ x: b.x, y: b.y }));
            const out = {};   // class -> {t, odo}
            const bump = (k, dt, odo) => { const a = out[k] = out[k] || { t: 0, odo: 0 }; a.t += dt; a.odo += odo; };
            const dt = 1 / 60; let fr = 0;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 880) break;
                fr = (fr + 1) % 6;
                if (fr !== 0) continue;
                const DS = 6 / 60;   // every-6th-frame sampling: 6 frames = 0.1s of world time
                for (let k = 0; k < bots.length; k++) {
                    const b = bots[k];
                    const step = Math.hypot(b.x - last[k].x, b.y - last[k].y);
                    last[k].x = b.x; last[k].y = b.y;
                    if (b.raceState.finished) continue;
                    const lg = b.raceState.leg;
                    if (lg < 2 || lg > 4) continue;
                    const c = b.controller;
                    const dev = (c && c.lastAvoidDeviation || 0) * 180 / Math.PI;
                    let rd = 1e9;
                    for (const o of bots) {
                        if (o === b || o.raceState.finished) continue;
                        const d = Math.hypot(o.x - b.x, o.y - b.y);
                        if (d < rd) rd = d;
                    }
                    const kt = b.speed * 4;
                    const spd = kt < 1 ? 'parked' : 'moving';
                    const defl = dev > 8 ? (rd < 250 ? 'defl-rival<250' : rd < 500 ? 'defl-rival250-500' : 'defl-solo') : 'clean';
                    bump(`L${lg} ${spd} ${defl}`, DS, step);
                }
            }
            return out;
        }, seed);
        for (const [k, v] of Object.entries(r)) bump(k, v.t, v.odo);
        console.log('seed', seed, 'done');
    }
    console.log('\nclass                                t(s)/boat-race   odo(u)/boat-race  u/s');
    const NB = 9 * TRIALS;
    for (const k of Object.keys(acc).sort()) {
        const a = acc[k];
        console.log(k.padEnd(34), String((a.t / NB).toFixed(1)).padStart(8),
            String(Math.round(a.odo / NB)).padStart(12), '   ', (a.odo / Math.max(1, a.t)).toFixed(1));
    }
    await browser.close();
})();
