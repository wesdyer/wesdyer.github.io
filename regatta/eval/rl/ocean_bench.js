// Bluewater Bonanza (ocean) fleet bench, tree-parameterised like bay_bench/fleet_leg2.
//   node ocean_bench.js <trials> <seed0> <label> <tree>
// Records per boat: finish time, penalties, OCS, contacts, and the two quantities the
// sea decides — VMG made good upwind and downwind, and the share of downwind time spent
// on a wave face rather than climbing one.
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 8;
const SEED0 = parseInt(process.argv[3]) || 9300;
const LABEL = process.argv[4] || 'x';
const ROOT = path.join(__dirname, process.argv[5] || 'treeA');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'ocean' }));
    });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await page.evaluate(() => {
        const inner = window.onRaceEvent;
        window.__cc = {}; window.__ccT = {};
        const mono = () => state.race.status === 'prestart' ? -state.race.timer : state.race.timer;
        window.onRaceEvent = (ty, d) => {
            try {
                if (d && d.boat && !d.boat.isPlayer && !d.boat.raceState.finished
                    && (ty === 'collision_boat' || ty === 'collision_mark'
                        || ty === 'collision_island' || ty === 'collision_boundary')) {
                    const cat = ty === 'collision_boat' ? 'boat' : ty === 'collision_mark' ? 'mark'
                        : ty === 'collision_island' ? (d.isFloe ? 'floe' : 'land') : 'bounds';
                    const k = d.boat.name + ':' + cat, t = mono();
                    if (window.__ccT[k] == null || t - window.__ccT[k] >= 0.5) {
                        window.__ccT[k] = t;
                        const c = window.__cc[d.boat.name] = window.__cc[d.boat.name] || {};
                        c[cat] = (c[cat] || 0) + 1;
                    }
                }
            } catch (e) {}
            return inner && inner(ty, d);
        };
    });
    const out = [];
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            window.__cc = {}; window.__ccT = {};
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            const nLegs = state.course.dmc.legs.length;
            const info = bots.map(b => ({ name: b.name, legT: {}, fin: null, pen: 0, ocs: 0,
                                          upD: 0, upT: 0, dnD: 0, dnT: 0, face: 0, climb: 0, xtrk: 0, xN: 0 }));
            const dt = 1 / 60;
            for (let it = 0; it < 60 * 940; it++) {
                const prev = bots.map(b => ({ x: b.x, y: b.y }));
                const wd = bots.map(b => getWindAt(b.x, b.y).direction);
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                const t = state.race.timer;
                if (t > 900) break;
                for (let k = 0; k < bots.length; k++) {
                    const b = bots[k], f = info[k];
                    if (b.raceState.finished) { if (f.fin == null) { f.fin = Math.round(t); f.pen = b.raceState.totalPenalties || 0; f.ocs = b.raceState.wasOCS ? 1 : 0; } continue; }
                    const lg = b.raceState.leg;
                    if (f.legT[lg] == null) f.legT[lg] = Math.round(t);
                    const twa = Math.abs(norm(b.heading - wd[k])) * 180 / Math.PI;
                    const ux = Math.sin(wd[k]), uy = -Math.cos(wd[k]);
                    const vm = (b.x - prev[k].x) * ux + (b.y - prev[k].y) * uy;
                    if (twa < 75) { f.upD += vm; f.upT += dt; }
                    else if (twa > 105) {
                        f.dnD += -vm; f.dnT += dt;
                        if (b.swell) { if (b.swell.surfKt > 0) f.face++; else f.climb++; }
                    }
                    // How far off the straight line to the leg's target she is running —
                    // the quantity an uncompensated set moves and a compensated one does not.
                    const c = b.controller;
                    if (c && c.navTarget && it % 30 === 0) {
                        const tx = c.navTarget.x - b.x, ty = c.navTarget.y - b.y;
                        f.xtrk += Math.hypot(tx, ty); f.xN++;
                    }
                }
                if (info.every(f => f.fin != null)) break;
            }
            for (const [k, b] of bots.entries()) {
                if (info[k].fin == null) { info[k].pen = b.raceState.totalPenalties || 0; info[k].ocs = b.raceState.wasOCS ? 1 : 0; }
                info[k].col = window.__cc[b.name] || {};
            }
            return { nLegs, info };
        }, seed);
        out.push({ seed, ...r });
        const fins = r.info.filter(f => f.fin != null).map(f => f.fin).sort((a, b) => a - b);
        console.log(`seed ${seed}: finishers ${fins.length} finT ${fins.join(',')}`);
    }
    fs.writeFileSync(path.join(__dirname, 'ocean_bench_' + LABEL + '.json'), JSON.stringify(out));
    console.log('saved ocean_bench_' + LABEL + '.json  nLegs', out[0].nLegs);
    await browser.close();
})();
