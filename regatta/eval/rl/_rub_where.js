// WHERE ARE RD7's SET-B BOAT RUBS? (2026-08-08, the arrival push's first
// instrumentation question.) RD7's arctic set B failed the dirt clause on boat
// rubs 9.70→11.55/boat while set A improved them 12.52→11.42 — and RD8's
// orbit-separation gamble proved the rubs are NOT (only) parallel-orbit
// contact. Before the next push designs around them, locate them: for every
// boat-boat contact episode (0.5s dedup), log position relative to the granite
// ring (distance to the round mark), race phase, both boats' speeds, and
// whether either was ARMED. Compare a hostile-B seed against a friendly-A seed
// on the same tree.
//   node _rub_where.js <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 2;
const SEED0 = parseInt(process.argv[3]) || 9201;
const ROOT = path.join(__dirname, process.argv[4] || 'treeRD7');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' })); });
    await page.addInitScript(() => { window.__CHAR = { neutral: 1 }; });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const rows = [];
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const RM = state.course.roundMark || { x: 138, y: -3095 };
            const rubs = [];
            const lastT = new Map();
            const inner = window.onRaceEvent;
            window.onRaceEvent = (ty, d) => {
                try {
                    if (ty === 'collision_boat' && d && d.boat && !d.boat.isPlayer) {
                        const t = state.race.timer;
                        const k = d.boat.name;
                        if (!lastT.has(k) || t - lastT.get(k) >= 0.5) {
                            lastT.set(k, t);
                            rubs.push({ t: +t.toFixed(0),
                                dRM: Math.round(Math.hypot(d.boat.x - RM.x, d.boat.y - RM.y)),
                                kt: +(d.boat.speed * 4).toFixed(1),
                                leg: d.boat.raceState.leg,
                                armed: d.boat.raceState.roundArmed ? 1 : 0 });
                        }
                    }
                } catch (e) {}
                return inner && inner(ty, d);
            };
            const dt = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status === 'racing' && state.race.timer > 880) break;
            }
            return rubs;
        }, seed);
        console.log('seed', seed, r.length, 'boat-rub episodes');
        rows.push(...r.map(x => ({ ...x, seed })));
    }
    const inRing = rows.filter(r => r.dRM < 900);
    const armed = rows.filter(r => r.armed);
    const slow = rows.filter(r => r.kt < 2.7);
    const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
    console.log(`\n${rows.length} episodes pooled:`);
    console.log(`  within 900u of the round mark: ${inRing.length} (${(100 * inRing.length / (rows.length || 1)).toFixed(0)}%)`);
    console.log(`  while ARMED: ${armed.length} (${(100 * armed.length / (rows.length || 1)).toFixed(0)}%)`);
    console.log(`  under 2.7kt at contact: ${slow.length} (${(100 * slow.length / (rows.length || 1)).toFixed(0)}%)`);
    console.log(`  dRM med ${med(rows.map(r => r.dRM))}  by leg:`,
        JSON.stringify(rows.reduce((a, r) => (a[r.leg] = (a[r.leg] || 0) + 1, a), {})));
    await browser.close();
})();
