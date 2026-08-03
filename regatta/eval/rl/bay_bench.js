// Lighthouse Cove (bay) fleet profiler: full fleet, cutoff raised to 900,
// per-boat leg timestamps + progress sampling. Mirrors fleet_leg2.js.
// node bay_bench.js <trials> <seed0> <label> <tree>
// Human reference (7 traj, Aug 3): fin med 226s; legs med L1 42 L2 27 L3 39 L4 53 L5 40 L6 20.
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 8;
const SEED0 = parseInt(process.argv[3]) || 9100;
const LABEL = process.argv[4] || 'x';
const ROOT = path.join(__dirname, process.argv[5] || 'treeA');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'bay' }));
    });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    // Per-boat contact counter, same convention as the human recorder: counted
    // from prestart through finish, one count per (boat, category) per 0.5s.
    // The prestart timer counts DOWN, so dedup runs on a monotonic clock.
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
            const pl = state.boats.find(b => b.isPlayer); pl.x = 5900; pl.y = -6100;
            const nLegs = state.course.dmc.legs.length;
            const info = bots.map(b => ({ name: b.name, legT: {}, fin: null, prog: [], hint: null, pen: 0, tArm: {}, ocs: 0 }));
            const dt = 1 / 60; let last = -999;
            for (let it = 0; it < 60 * 940; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 900) break;
                const t = state.race.timer;
                const snap = t - last >= 15;
                if (snap) last = t;
                for (let k = 0; k < bots.length; k++) {
                    const b = bots[k], inf = info[k];
                    if (inf.fin != null) continue;
                    if (b.raceState.finished) { inf.fin = Math.round(t); inf.pen = b.raceState.totalPenalties || 0; continue; }
                    if (b.raceState.ocs) inf.ocs = 1; // OCS while racing = penalized early start
                    const lg = b.raceState.leg;
                    // L1 tail diagnostics: dirty-air time, headed-tack time (by the
                    // boat's OWN wind tracker — the quantity scoreTack reasons with).
                    if (lg === 1) {
                        if (b.badAirIntensity > 0.15) inf._df = (inf._df || 0) + 1;
                        const c = b.controller;
                        if (c && c.windTracker && c.windTracker.initialized) {
                            const lw = getWindAt(b.x, b.y);
                            const rel = normalizeAngle(b.heading - lw.direction);
                            // Only close-hauled samples count (maneuvers excluded),
                            // same gate as the human-traj analysis.
                            if (Math.abs(rel) < Math.PI * 0.42) {
                                const shift = normalizeAngle(lw.direction - c.windTracker.meanDirection);
                                const tackSide = rel > 0 ? 1 : -1;
                                inf._uf = (inf._uf || 0) + 1;
                                if (-tackSide * shift < -0.052) inf._hf = (inf._hf || 0) + 1;
                            }
                        }
                    }
                    if (inf.legT[lg] == null) inf.legT[lg] = Math.round(t);
                    if (inf.tArm[lg] == null && b.raceState.roundArmed) inf.tArm[lg] = Math.round(t);
                    if (snap && lg >= 1 && state.course.dmc.legs[lg]) {
                        if (inf.hintLg !== lg) { inf.hint = null; inf.hintLg = lg; }
                        const s = CoursePath.project(state.course.dmc.legs[lg], b.x, b.y, inf.hint);
                        inf.hint = s;
                        inf.prog.push([Math.round(t), lg, Math.round(s), Math.round(b.x), Math.round(b.y), +b.speed.toFixed(2)]);
                    }
                }
                if (info.every(f => f.fin != null)) break;
            }
            for (const [k, b] of bots.entries()) {
                if (info[k].fin == null) info[k].pen = b.raceState.totalPenalties || 0;
                info[k].col = window.__cc[b.name] || {};
                info[k].l1tacks = b.raceState.legManeuvers[1] || 0;
                info[k].l1dirty = +((info[k]._df || 0) / 60).toFixed(1); delete info[k]._df;
                info[k].l1hdr = +((info[k]._hf || 0) / 60).toFixed(1); delete info[k]._hf;
                info[k].l1up = +((info[k]._uf || 0) / 60).toFixed(1); delete info[k]._uf;
            }
            return { nLegs, legLens: state.course.dmc.legs.map(l => Math.round(l.length)), info };
        }, seed);
        out.push({ seed, ...r });
        const fins = r.info.filter(f => f.fin != null).map(f => f.fin).sort((a, b) => a - b);
        const reached = {};
        for (let lg = 1; lg <= 6; lg++) reached[lg] = r.info.filter(f => f.legT[lg] != null || f.fin != null).length;
        console.log(`seed ${seed}: legs reached ${[1,2,3,4,5,6].map(l=>reached[l]).join('/')} finishers ${fins.length} finT ${fins.join(',')}`);
    }
    fs.writeFileSync(path.join(__dirname, 'bay_bench_' + LABEL + '.json'), JSON.stringify(out));
    console.log('saved bay_bench_' + LABEL + '.json  nLegs', out[0].nLegs, 'legLens', out[0].legLens.join(','));
    await browser.close();
})();
