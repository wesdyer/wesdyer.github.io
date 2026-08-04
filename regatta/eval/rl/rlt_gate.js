// PHASE A FINAL GATE — fleet_leg2's exact protocol and output format, with the
// trained transit residual installed on every bot. The gate seeds (9100-9115)
// are disjoint from the 200-seed training pool AND from the 16 validation seeds,
// which is the three-way separation the corrected RL protocol calls for.
//   node rlt_gate.js <trials> <seed0> <label> <tree> <policy.json|classical>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 8;
const SEED0 = parseInt(process.argv[3]) || 9100;
const LABEL = process.argv[4] || 'x';
const ROOT = path.join(__dirname, process.argv[5] || 'treeF');
const POLICY = process.argv[6] || 'classical';
const { SHARED_SRC } = require('./rlt_shared.js');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' }));
    });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await page.addScriptTag({ content: SHARED_SRC });
    let P = null;
    if (POLICY !== 'classical') {
        const j = JSON.parse(fs.readFileSync(path.join(__dirname, POLICY), 'utf8'));
        P = (j.best && j.best.params) || j.mean;
        console.log(`policy ${POLICY}: ${P.length} params, best-by-validation from gen ${j.best ? j.best.gen : '?'}` +
                    `${j.best ? ' (validation ' + j.best.score.toFixed(1) + 's)' : ''}`);
    }
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
        const r = await page.evaluate(async ([seed, P]) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            if (P) window.__rltInstall(P); else window.__rltUninstall();
            for (const b of state.boats) { b.__rltT = null; b.__rltPsi = 0; b.__rltHint = null; }
            window.__cc = {}; window.__ccT = {};
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = -4500; pl.y = 4700;
            const nLegs = state.course.dmc.legs.length;
            const info = bots.map(b => ({ name: b.name, legT: {}, fin: null, prog: [], hint: null, tArm: null, tOut: null, pen: 0, ocs: 0 }));
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
                    if (inf.legT[lg] == null) inf.legT[lg] = Math.round(t);
                    if (inf.tArm == null && b.raceState.roundArmed) inf.tArm = Math.round(t);
                    if (inf.tOut == null && b.controller && b.controller._outbound) inf.tOut = Math.round(t);
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
            }
            return { nLegs, legLens: state.course.dmc.legs.map(l => Math.round(l.length)), info };
        }, [seed, P]);
        out.push({ seed, ...r });
        const fins = r.info.filter(f => f.fin != null).length;
        const rounders = r.info.filter(f => f.legT[2] != null).length;
        console.log(`seed ${seed}: rounders ${rounders}/${r.info.length} finishers ${fins} finT ${r.info.filter(f=>f.fin).map(f=>f.fin).join(',')}`);
    }
    fs.writeFileSync(path.join(__dirname, 'fleet_leg2_' + LABEL + '.json'), JSON.stringify(out));
    console.log('saved fleet_leg2.json  nLegs', out[0].nLegs, 'legLens', out[0].legLens.join(','));
    await browser.close();
})();
