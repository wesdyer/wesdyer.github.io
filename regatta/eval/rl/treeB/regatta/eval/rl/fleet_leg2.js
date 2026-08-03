// Fleet return-leg profiler: full fleet, cutoff raised to 900, per-boat leg
// timestamps + leg-2 progress sampling. node fleet_leg2.js <trials> <seed0>
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
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' }));
    });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const out = [];
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = -4500; pl.y = 4700;
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
        out.push({ seed, ...r });
        const fins = r.info.filter(f => f.fin != null).length;
        const rounders = r.info.filter(f => f.legT[2] != null).length;
        console.log(`seed ${seed}: rounders ${rounders}/${r.info.length} finishers ${fins} finT ${r.info.filter(f=>f.fin).map(f=>f.fin).join(',')}`);
    }
    fs.writeFileSync(path.join(__dirname, 'fleet_leg2_' + LABEL + '.json'), JSON.stringify(out));
    console.log('saved fleet_leg2.json  nLegs', out[0].nLegs, 'legLens', out[0].legLens.join(','));
    await browser.close();
})();
