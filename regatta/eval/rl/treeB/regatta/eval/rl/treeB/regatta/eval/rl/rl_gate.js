// Fleet acceptance gate for the RL sweep policy: fleet_leg2's exact
// measurement, with the trained policy driving EVERY armed bot (via the
// window.__rl.actFor hook in script.js). Seeds run in parallel across pages.
//
//   node rl_gate.js <label> [--policy rl_policy_fleet.json] [--trials 8]
//                   [--seed0 9100] [--pages 4] [--baseline]
//
// --baseline: run with NO policy installed (hooks inert) — for byte-diffing
// against the stored accepted-stack JSON (fleet_leg2_gapfc.json).
// Output: fleet_leg2_<label>.json, same shape as fleet_leg2.js.
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const { SHARED_SRC } = require('./rl_shared.js');
const ROOT = path.join(__dirname, 'treeA');

function arg(name, dflt) {
    const i = process.argv.indexOf('--' + name);
    return i > 0 ? process.argv[i + 1] : dflt;
}
const LABEL = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'rl';
const TRIALS = parseInt(arg('trials', 8));
const SEED0 = parseInt(arg('seed0', 9100));
const PAGES = parseInt(arg('pages', 4));
const BASELINE = process.argv.includes('--baseline');
const POLICY_FILE = arg('policy', 'rl_policy_fleet.json');

(async () => {
    let params = null;
    if (!BASELINE) {
        const pol = JSON.parse(fs.readFileSync(path.join(__dirname, POLICY_FILE), 'utf8'));
        const use = arg('use', 'best'); // best | mean
        params = use === 'mean' ? pol.mean : (pol.bestEver ? pol.bestEver.params : pol.params);
        console.log(`policy: ${POLICY_FILE} use=${use}` +
            (use === 'best' && pol.bestEver ? ` (bestEver iter ${pol.bestEver.iter}, score ${pol.bestEver.score.toFixed(2)})` : ''));
    } else console.log('BASELINE run: hooks inert');

    const browser = await chromium.launch();
    const pages = [];
    for (let i = 0; i < PAGES; i++) {
        const page = await browser.newPage();
        page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
        await page.addInitScript(() => {
            localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' }));
        });
        await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
        await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
        if (!BASELINE) {
            await page.addScriptTag({ content: SHARED_SRC });
            await page.evaluate((P) => window.__rlInstallActFor(P), params);
        }
        pages.push(page);
    }

    const seeds = Array.from({ length: TRIALS }, (_, i) => SEED0 + i);
    const out = new Array(TRIALS);
    let next = 0;
    await Promise.all(pages.map(async (page) => {
        while (next < seeds.length) {
            const idx = next++;
            const seed = seeds[idx];
            // Measurement body identical to fleet_leg2.js.
            const r = await page.evaluate(async (seed) => {
                window.evalHarness.seed = seed;
                window.resetGame(); window.startRace();
                state.course.cutoff = 900;
                const bots = state.boats.filter(b => !b.isPlayer);
                const pl = state.boats.find(b => b.isPlayer); pl.x = -4500; pl.y = 4700;
                for (const b of state.boats) { b.__rlT0 = null; b.__rlActT = null; }
                const nLegs = state.course.dmc.legs.length;
                const info = bots.map(b => ({ name: b.name, legT: {}, fin: null, prog: [], hint: null, tArm: null, tOut: null }));
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
                        if (b.raceState.finished) { inf.fin = Math.round(t); continue; }
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
                return { nLegs, legLens: state.course.dmc.legs.map(l => Math.round(l.length)), info };
            }, seed);
            out[idx] = { seed, ...r };
            const fins = r.info.filter(f => f.fin != null).length;
            const rounders = r.info.filter(f => f.legT[2] != null).length;
            console.log(`seed ${seed}: rounders ${rounders}/${r.info.length} finishers ${fins} finT ${r.info.filter(f => f.fin).map(f => f.fin).join(',')}`);
        }
    }));
    fs.writeFileSync(path.join(__dirname, 'fleet_leg2_' + LABEL + '.json'), JSON.stringify(out));
    console.log('saved fleet_leg2_' + LABEL + '.json');
    await browser.close();
})();
