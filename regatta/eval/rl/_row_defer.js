// DOES THE BOAT WITH RIGHTS GIVE THEM UP — AND DOES IT COST HER? (2026-08-13)
//
// OWNER, on every course: "I still see boats with rights defer to boats without
// rights. They should only do this if they absolutely have to to avoid a
// collision and even then it's sometimes worse — for example if you tack and give
// up rights only to still have a collision and now you're at fault and get a
// penalty. Usually the right move is to have your rights and use them and let the
// boat without rights make the avoidance."
//
// The campaign has measured stand-on line-holding once, on redrock's thread, and
// filed it at a 4% pool. That measured the SHARE. This measures the OUTCOME, which
// is the owner's actual claim and has never been looked at:
//
//   for every encounter where this boat is the STAND-ON boat at MEDIUM+ risk:
//     did she deflect?  (lastAvoidDeviation past a real threshold)
//     did the pair collide anyway, within the next 6 s?
//     ⭐ and did SHE take the penalty?
//
// The damning cell is DEFLECTED AND COLLIDED ANYWAY — she paid the deviation, lost
// the rights, and still hit. The comparison cell is HELD AND COLLIDED, which the
// rules say should be the give-way boat's foul.
//
// ⚠️ `Rules.getRightOfWay(b1,b2).boat` is a BOAT OBJECT, not a name or an id
// (rule 18: a previous probe compared the object to a boat and read ROW at 0%).
//   node _row_defer.js <venue> <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'glowtide';
const TRIALS = parseInt(process.argv[3]) || 4;
const SEED0 = parseInt(process.argv[4]) || 9400;
const ROOT = path.join(__dirname, process.argv[5] || 'treeM');
(async () => {
    const br = await chromium.launch(); const p = await br.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const A = [];
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate((seed) => {
            const rub = {}, pen = {};
            const inner = window.onRaceEvent;
            window.onRaceEvent = (ty, d) => {
                if (d && d.boat && !d.boat.isPlayer) {
                    if (ty === 'collision_boat') rub[d.boat.name] = 1;
                    if (ty === 'penalty') pen[d.boat.name] = 1;
                }
                return inner && inner(ty, d);
            };
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const enc = {};      // key -> open encounter record
            const out = [];
            const DT = 1 / 60; let now = 0;
            for (let it = 0; it < 60 * 900; it++) {
                for (const k in rub) delete rub[k];
                for (const k in pen) delete pen[k];
                window.update(DT); now += DT;
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                for (const b of state.boats) {
                    if (b.isPlayer || b.raceState.finished) continue;
                    const c = b.controller; if (!c) continue;
                    const th = c.threatBoat;
                    const key = b.name;
                    const E = enc[key];
                    const engaged = th && !th.raceState.finished
                        && (c.riskState === 'MEDIUM' || c.riskState === 'HIGH' || c.riskState === 'IMMINENT');
                    if (engaged) {
                        // WHO ACTUALLY HAS RIGHTS, from the rules engine itself
                        let rowIsMe = null;
                        try {
                            const row = window.Rules.getRightOfWay(b, th);
                            if (row && row.boat) rowIsMe = (row.boat === b);   // OBJECT compare
                        } catch (e) { }
                        if (!E || E.other !== th.name) {
                            if (E) out.push(E);
                            enc[key] = { me: b.name, other: th.name, t0: now, rowIsMe,
                                         role: c.avoidanceRole, maxDev: 0, rubbed: 0, penalised: 0,
                                         otherRubbed: 0, minSpd: 1e9, risk: c.riskState };
                        }
                        const R = enc[key];
                        R.maxDev = Math.max(R.maxDev, c.lastAvoidDeviation || 0);
                        R.minSpd = Math.min(R.minSpd, b.speed * 60);
                        if (rowIsMe != null) R.rowIsMe = rowIsMe;
                        if (c.riskState === 'IMMINENT') R.risk = 'IMMINENT';
                        if (rub[b.name]) R.rubbed = 1;
                        if (rub[th.name]) R.otherRubbed = 1;
                        if (pen[b.name]) R.penalised = 1;
                        R.tEnd = now;
                    } else if (E) {
                        // let the outcome window run 6 s past disengagement
                        if (rub[b.name]) E.rubbed = 1;
                        if (pen[b.name]) E.penalised = 1;
                        if (now - E.tEnd > 6) { out.push(E); delete enc[key]; }
                    }
                }
                if (state.race.timer > 895) break;
            }
            for (const k in enc) out.push(enc[k]);
            return out;
        }, SEED0 + t);
        A.push(...r);
        console.log(`seed ${SEED0 + t}: ${r.length} engaged encounters`);
    }
    await br.close();
    const DEG = 8 * Math.PI / 180;          // a real deflection, not helm noise
    const V = A.filter(e => e.rowIsMe != null);
    const stand = V.filter(e => e.rowIsMe), give = V.filter(e => !e.rowIsMe);
    const pc = (x, d) => `${x} (${(100 * x / (d || 1)).toFixed(1)}%)`;
    console.log(`\n=== ${VENUE.toUpperCase()}: DOES THE RIGHT-OF-WAY BOAT GIVE UP HER RIGHTS? ===`);
    console.log(`engaged encounters (MEDIUM+ risk, rules-engine ROW known): ${V.length}`);
    console.log(`   she HAS rights on ${pc(stand.length, V.length)}   she owes keep-clear on ${pc(give.length, V.length)}`);
    const sDef = stand.filter(e => e.maxDev > DEG), gDef = give.filter(e => e.maxDev > DEG);
    console.log(`\n⭐ DEFLECTED MORE THAN 8 DEGREES:`);
    console.log(`   as the STAND-ON boat: ${pc(sDef.length, stand.length)}   med max deflection ${(180 / Math.PI * (stand.map(e => e.maxDev).sort((a, b) => a - b)[Math.floor(stand.length / 2)] || 0)).toFixed(0)}deg`);
    console.log(`   as the GIVE-WAY boat: ${pc(gDef.length, give.length)}`);
    console.log(`\n⭐⭐ THE OWNER'S CASE — SHE GAVE UP RIGHTS AND IT DID NOT EVEN WORK:`);
    const sDefRub = sDef.filter(e => e.rubbed), sHold = stand.filter(e => e.maxDev <= DEG);
    const sHoldRub = sHold.filter(e => e.rubbed);
    console.log(`   stand-on, DEFLECTED, collided anyway: ${pc(sDefRub.length, sDef.length)} of deflections`);
    console.log(`      ...and SHE took the penalty:       ${pc(sDefRub.filter(e => e.penalised).length, sDefRub.length || 1)}`);
    console.log(`   stand-on, HELD her course, collided:  ${pc(sHoldRub.length, sHold.length || 1)} of holds`);
    console.log(`      ...and SHE took the penalty:       ${pc(sHoldRub.filter(e => e.penalised).length, sHoldRub.length || 1)}`);
    console.log(`\n   (control) give-way, deflected, collided anyway: ${pc(gDef.filter(e => e.rubbed).length, gDef.length || 1)}`);
    console.log(`   penalties overall: stand-on ${pc(stand.filter(e => e.penalised).length, stand.length)}  give-way ${pc(give.filter(e => e.penalised).length, give.length)}`);
    console.log(`\n   what the CONTROLLER thought its role was, when the rules said it had rights:`);
    const roles = {}; for (const e of stand) roles[e.role] = (roles[e.role] || 0) + 1;
    for (const k of Object.keys(roles).sort((a, b) => roles[b] - roles[a])) console.log(`      ${String(k).padEnd(10)} ${pc(roles[k], stand.length)}`);
})();
