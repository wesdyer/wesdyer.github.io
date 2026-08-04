// Fleet gate for the CREW policy: fleet_leg2-identical arctic profiler with
// window.__rlCrew driving EVERY bot's controls execution (the updateAI hook).
//   node crew_gate.js <policy.json> <trials> <seed0> <label> [tree]
// Compare paired vs fleet_leg2_instr16.json (same seeds, classical crew).
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const { CREW_SRC } = require('./crew_shared.js');
const POLICY = process.argv[2] || 'crew_policy.json';
const TRIALS = parseInt(process.argv[3]) || 16;
const SEED0 = parseInt(process.argv[4]) || 9100;
const LABEL = process.argv[5] || 'crewgate';
const ROOT = path.join(__dirname, process.argv[6] || 'treeA');
(async () => {
    const pol = JSON.parse(fs.readFileSync(path.join(__dirname, POLICY), 'utf8'));
    const P = pol.mean || pol;
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' }));
    });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await page.addScriptTag({ content: CREW_SRC });
    await page.evaluate((P) => {
        // Policy crews every bot: obs is built against the bot's OWN commanded
        // heading (controller.targetHeading), cached per sim-tick.
        window.__rlCrew = {
            actFor: (boat) => {
                if (!boat.controller || boat.controller.targetHeading == null) return null;
                if (boat.__crewT === state.race.timer) return boat.__crewA;
                boat.__crewT = state.race.timer;
                boat.__crewA = window.__crewAct(P, window.__crewObs(boat, boat.controller.targetHeading));
                return boat.__crewA;
            }
        };
    }, P);
    const out = [];
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = -4500; pl.y = 4700;
            const info = bots.map(b => ({ name: b.name, legT: {}, fin: null, tArm: null, tOut: null, pen: 0 }));
            const dt = 1 / 60;
            for (let it = 0; it < 60 * 940; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 900) break;
                const t = state.race.timer;
                for (let k = 0; k < bots.length; k++) {
                    const b = bots[k], inf = info[k];
                    if (inf.fin != null) continue;
                    if (b.raceState.finished) { inf.fin = Math.round(t); inf.pen = b.raceState.totalPenalties || 0; continue; }
                    const lg = b.raceState.leg;
                    if (inf.legT[lg] == null) inf.legT[lg] = Math.round(t);
                    if (inf.tArm == null && b.raceState.roundArmed) inf.tArm = Math.round(t);
                    if (inf.tOut == null && b.controller && b.controller._outbound) inf.tOut = Math.round(t);
                }
                if (info.every(f => f.fin != null)) break;
            }
            for (const [k, b] of bots.entries()) if (info[k].fin == null) info[k].pen = b.raceState.totalPenalties || 0;
            return { info };
        }, seed);
        out.push({ seed, ...r });
        const fins = r.info.filter(f => f.fin != null).length;
        const rounders = r.info.filter(f => f.legT[2] != null).length;
        console.log(`seed ${seed}: rounders ${rounders}/9 finishers ${fins} finT ${r.info.filter(f=>f.fin).map(f=>f.fin).join(',')}`);
    }
    fs.writeFileSync(path.join(__dirname, 'fleet_leg2_' + LABEL + '.json'), JSON.stringify(out));
    console.log('saved fleet_leg2_' + LABEL + '.json');
    await browser.close();
})();
