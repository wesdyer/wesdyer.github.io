// ARE THE NO-CONTACT PENALTIES CAUSED BY THE BOAT BEING PENALISED? (2026-08-13)
//
// OWNER: "penalties are sometimes erroneously assigned when collisions don't
// happen... because bots are not good yet at determining whether to stand on or
// not, we should be careful."
//
// The detector (script.js ~887) penalises the GIVE-WAY boat when the STAND-ON boat
// is at HIGH/IMMINENT risk, her proper-course CPA is inside FOUL_NEED_GAP, and
// `lastAvoidDeviation > 0.35 rad` (20 deg) accumulates for 0.8 s. But
// `lastAvoidDeviation` is her TOTAL deflection FROM EVERY CAUSE — the file's own
// comment says that was the original bug — and `_row_defer` measured the stand-on
// boat deflecting a median MAXIMUM of 69 deg on glowtide and 92 on redrock, driven
// by the clearance staircase, i.e. by ROCKS. 69 deg is 3.5x the foul threshold.
//
// So the guard tests that the rival WOULD have been close, never that the rival
// CAUSED the swerve. This measures the difference:
//   * how many penalties are no-contact, and did contact follow within 5 s
//   * at the trigger, the stand-on boat's deviation and her clearance to rock
//   * ⭐ THE COUNTERFACTUAL: how much of that deviation survives if the accused
//     boat is removed from the world for one tick — if the helm barely moves,
//     the rival did not cause it and the penalty is unearned
//   node _foul_cause.js <venue> <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'glowtide';
const TRIALS = parseInt(process.argv[3]) || 3;
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
            const pens = [], rub = {};
            const inner = window.onRaceEvent;
            window.onRaceEvent = (ty, d) => {
                // ⚠️ RULE 2: triggerPenalty emits this event BEFORE its own debounce, so
                // sustained contact fires it every frame. Count EPISODES — the rising edge
                // of raceState.penalty — and keep the kind from the frame that flagged it.
                if (ty === 'penalty' && d && d.boat && !d.boat.raceState.penalty)
                    pens.push({ name: d.boat.name, kind: String(d.kind || '?'), rule: d.rule || '?', t: state.race.timer });
                if (ty === 'collision_boat' && d && d.boat) rub[d.boat.name] = state.race.timer;
                return inner && inner(ty, d);
            };
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const clr = (x, y) => {
                const g = state.course.botGrid; if (!g) return -1;
                const R = g.res || 50;
                for (let ring = 0; ring <= 6; ring++)
                    for (let dx = -ring; dx <= ring; dx++) for (let dy = -ring; dy <= ring; dy++) {
                        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
                        const cc = g.cell(x + dx * R, y + dy * R);
                        if (!g.at(cc[0], cc[1])) return ring * R;
                    }
                return 6 * R;
            };
            const out = []; const seen = new Set();
            const DT = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) {
                const before = pens.length;
                window.update(DT);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                for (let i = before; i < pens.length; i++) {
                    const P = pens[i];
                    // ⚠️ TWO SPELLINGS IN THE SOURCE: 'no_contact' (the stand-on forced-
                    // avoidance detector, ~890) and 'no-contact' (Rule 19 denied room, ~20976).
                    const isNC = P.kind === 'no_contact' || P.kind === 'no-contact';
                    if (!isNC) { out.push({ kind: P.kind, noContact: 0 }); continue; }
                    // find the stand-on boat that just claimed this foul
                    const accused = state.boats.find(b => b.name === P.name);
                    let claimer = null;
                    for (const b of state.boats) {
                        if (b.isPlayer || !b.controller) continue;
                        if (b.controller.threatBoat === accused && b.controller.avoidanceRole === 'STAND_ON') { claimer = b; break; }
                    }
                    const rec = { kind: P.kind, noContact: 1, t: Math.round(P.t), rule: P.rule };
                    if (claimer) {
                        const c = claimer.controller;
                        rec.dev = +(c.lastAvoidDeviation || 0).toFixed(3);
                        rec.clr = clr(claimer.x, claimer.y);
                        rec.spd = Math.round(claimer.speed * 60);
                        rec.leg = claimer.raceState.leg;
                        // ⭐ COUNTERFACTUAL: re-run the fan with the accused removed
                        const sx = accused.x, sy = accused.y;
                        const nav = c._lastNav || { x: claimer.x, y: claimer.y - 500 };
                        let hWith = null, hWithout = null;
                        try { hWith = c.applyAvoidance(Math.atan2(nav.x - claimer.x, -(nav.y - claimer.y)), 1); } catch (e) { }
                        accused.x = 1e7; accused.y = 1e7;
                        try { hWithout = c.applyAvoidance(Math.atan2(nav.x - claimer.x, -(nav.y - claimer.y)), 1); } catch (e) { }
                        accused.x = sx; accused.y = sy;
                        if (hWith != null && hWithout != null) {
                            let d = hWith - hWithout;
                            while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
                            rec.causedBy = +Math.abs(d).toFixed(3);   // how much of the helm the ACCUSED explains
                        }
                    }
                    rec.rubAfter = 0;
                    out.push(rec);
                    seen.add(P.name + ':' + Math.round(P.t));
                }
                // did contact follow a no-contact claim within 5 s?
                for (const o of out) if (o.noContact && !o.rubAfter && o.t != null
                    && state.race.timer - o.t <= 5 && Object.keys(rub).length) {
                    for (const nm in rub) if (state.race.timer - rub[nm] < 0.2) o.rubAfter = 1;
                }
                if (state.race.timer > 895) break;
            }
            return out;
        }, SEED0 + t);
        A.push(...r);
        console.log(`seed ${SEED0 + t}: ${r.length} penalties (${r.filter(x => x.noContact).length} no-contact)`);
    }
    await br.close();
    const q = (a, pp) => { const s = a.filter(v => v != null).slice().sort((x, y) => x - y); return s.length ? s[Math.floor(pp * (s.length - 1))] : NaN; };
    const D = r => (r * 180 / Math.PI).toFixed(0);
    const NC = A.filter(x => x.noContact), withCF = NC.filter(x => x.causedBy != null);
    const pc = (x, d) => `${x} (${(100 * x / (d || 1)).toFixed(1)}%)`;
    console.log(`\n=== ${VENUE.toUpperCase()}: ARE THE NO-CONTACT PENALTIES EARNED? (${A.length} penalty EPISODES) ===`);
    const kinds = {}; for (const x of A) kinds[x.kind] = (kinds[x.kind] || 0) + 1;
    console.log(`   by kind: ` + Object.keys(kinds).sort((a, b) => kinds[b] - kinds[a]).map(k => `${k} ${kinds[k]} (${(100 * kinds[k] / A.length).toFixed(1)}%)`).join('   '));
    console.log(`   NO-CONTACT penalties: ${pc(NC.length, A.length)}`);
    if (!NC.length) return;
    console.log(`   contact followed within 5 s on: ${pc(NC.filter(x => x.rubAfter).length, NC.length)}`);
    console.log(`   at the trigger — claimer's deviation: med ${D(q(NC.map(x => x.dev), .5))}deg  (threshold is 20deg)`);
    console.log(`                    clearance to rock:   med ${q(NC.map(x => x.clr), .5)}u   under 100u on ${pc(NC.filter(x => x.clr >= 0 && x.clr < 100).length, NC.length)}`);
    console.log(`                    claimer speed:       med ${q(NC.map(x => x.spd), .5)} u/s   leg ${q(NC.map(x => x.leg), .5)}`);
    console.log(`\n⭐ COUNTERFACTUAL — how much of the claimer's helm does the ACCUSED actually explain? (n=${withCF.length})`);
    console.log(`   med ${D(q(withCF.map(x => x.causedBy), .5))}deg   p75 ${D(q(withCF.map(x => x.causedBy), .75))}deg   p90 ${D(q(withCF.map(x => x.causedBy), .9))}deg`);
    for (const th of [2, 5, 10, 20]) console.log(`   accused explains LESS than ${th}deg of it: ${pc(withCF.filter(x => x.causedBy * 180 / Math.PI < th).length, withCF.length)}`);
})();
