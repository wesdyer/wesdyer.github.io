// THE PENALTY TAX, IN SECONDS (2026-08-09 evening). Redrock's fleet carries 2.80
// penalties per boat against the human's ~0, and a penalty is not a scoreboard
// mark: the boat spins (`penaltySpin`, helm owned, ~1.2 rad/tick commanded) until
// the turns are paid, and any turns still OWED at the finish add 15s EACH to her
// finish time (script.js ~12140). Neither cost has ever been sized.
//
// Measures, per boat-race: penalties incurred, seconds actually spent spinning,
// turns left unpaid at the finish and the 15s-per-turn adder that follows, and
// WHICH rule the engine cited when the foul fired. The rule mix is the part that
// says whether this is an avoidance problem (fouls we could decline to commit) or
// a scoring artifact.
//   node _pen_tax.js <venue> <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'redrock';
const TRIALS = parseInt(process.argv[3]) || 6;
const SEED0 = parseInt(process.argv[4]) || 9400;
const ROOT = path.join(__dirname, process.argv[5] || 'treeA2');

(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const rows = [];
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate(async ({ seed }) => {
            const spin = {}, pen = {}, rules = {}, byLeg = {}, refire = {};
            const inner = window.onRaceEvent;
            window.onRaceEvent = (ty, d) => {
                if (ty === 'penalty' && d && d.boat && !d.boat.isPlayer && state.race.status === 'racing') {
                    const n = d.boat.name;
                    refire[n] = (refire[n] || 0) + 1;
                    // triggerPenalty fires this event BEFORE setting rs.penalty, and
                    // sustained grinding contact re-triggers every frame — so only the
                    // transition is a real foul. rule 18: the raw event count read 304
                    // penalties per boat against a true 2.8.
                    if (d.boat.raceState.penalty) return inner && inner(ty, d);
                    pen[n] = (pen[n] || 0) + 1;
                    const rl = d.rule || d.reason || '?';
                    rules[rl] = (rules[rl] || 0) + 1;
                    const lg = d.boat.raceState.leg;
                    byLeg[lg] = (byLeg[lg] || 0) + 1;
                }
                return inner && inner(ty, d);
            };
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const dt = 1 / 60;
            let prevT = 0;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (state.race.status !== 'racing') { if (state.race.status === 'finished') break; continue; }
                const now = state.race.timer, step = now - prevT; prevT = now;
                for (const bo of state.boats) {
                    if (bo.isPlayer || bo.raceState.finished) continue;
                    if (bo.controller && bo.controller.penaltySpin) spin[bo.name] = (spin[bo.name] || 0) + step;
                }
            }
            const out = [];
            for (const bo of state.boats) {
                if (bo.isPlayer) continue;
                const rs = bo.raceState;
                out.push({ name: bo.name, pen: pen[bo.name] || 0, tot: rs.totalPenalties || 0, refire: refire[bo.name] || 0, spin: spin[bo.name] || 0,
                           owed: rs.penalty ? Math.max(1, rs.penaltyTurnsOwed || 1) : 0,
                           fin: rs.finished ? rs.finishTime : null });
            }
            return { out, rules, byLeg };
        }, { seed: SEED0 + t });
        console.log(`seed ${SEED0 + t}: ${r.out.reduce((a, x) => a + x.pen, 0)} penalties`);
        rows.push(r);
    }
    await b.close();
    const q = (a, pr) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(pr * (s.length - 1))] : NaN; };
    const boats = [].concat(...rows.map(r => r.out));
    const n = boats.length;
    const rules = {}, byLeg = {};
    for (const r of rows) { for (const [k, v] of Object.entries(r.rules)) rules[k] = (rules[k] || 0) + v;
                            for (const [k, v] of Object.entries(r.byLeg)) byLeg[k] = (byLeg[k] || 0) + v; }
    const totPen = boats.reduce((a, x) => a + x.pen, 0);
    const totSpin = boats.reduce((a, x) => a + x.spin, 0);
    const totOwed = boats.reduce((a, x) => a + x.owed, 0);
    console.log(`\n=== ${VENUE} penalty tax — ${n} boat-races (${ROOT.split('/').pop()}) ===`);
    const totTot = boats.reduce((a, x) => a + x.tot, 0), totRef = boats.reduce((a, x) => a + x.refire, 0);
    console.log(`penalties/boat ${(totPen / n).toFixed(2)} (engine totalPenalties ${(totTot / n).toFixed(2)}) | boats with >=1: ${(100 * boats.filter(x => x.pen).length / n).toFixed(0)}%`);
    console.log(`⚠️ foul-detector RE-FIRES ${(totRef / n).toFixed(0)} times per boat-race — sustained grinding contact re-triggers it every frame`);
    console.log(`⭐ SPIN TIME: ${(totSpin / n).toFixed(1)} s/boat  (med ${q(boats.map(x => x.spin), .5).toFixed(1)}s p90 ${q(boats.map(x => x.spin), .9).toFixed(1)}s)`);
    console.log(`⭐ UNPAID AT FINISH: ${(totOwed / n).toFixed(2)} turns/boat = ${(15 * totOwed / n).toFixed(1)} s/boat added to finish time`);
    console.log(`   TOTAL PENALTY TAX ~ ${((totSpin + 15 * totOwed) / n).toFixed(1)} s/boat`);
    const withP = boats.filter(x => x.pen && x.fin != null), noP = boats.filter(x => !x.pen && x.fin != null);
    if (withP.length && noP.length)
        console.log(`   finish med: penalised ${q(withP.map(x => x.fin), .5).toFixed(0)} (n=${withP.length}) vs clean ${q(noP.map(x => x.fin), .5).toFixed(0)} (n=${noP.length})`);
    const rs = Object.entries(rules).sort((a, x) => x[1] - a[1]);
    console.log(`\nrule cited (${rs.reduce((a, x) => a + x[1], 0)} fouls):`);
    for (const [k, v] of rs) console.log(`   ${String(k).padEnd(22)} ${String(v).padStart(5)}  ${(100 * v / totPen).toFixed(0)}%`);
    console.log(`\nby leg: ` + Object.entries(byLeg).sort((a, x) => a[0] - x[0]).map(([k, v]) => `${k}:${(v / n).toFixed(2)}`).join('  '));
})();
