// ⭐ PHASE 3 — WHY DOES THE CONTROLLER THINK IT IS GIVE_WAY WHEN IT HAS RIGHTS?
//
// `_row_argmin` measured the controller believing GIVE_WAY on 24.7-29.3% of
// encounters (42.2% of ticks) where the rules engine gives her rights, and the
// hold-course term is gated on `avoidanceRole === 'STAND_ON'`, so on those ticks she
// pays nothing to hold. The plan names two suspects. This separates them and adds a
// third the plan does not name, which turns out to be structural:
//
//   A  UNDETERMINED  `const myRole = (rowBoat === this.boat) ? 'STAND_ON' : 'GIVE_WAY'`
//      (script.js ~2907). `Rules.evaluate` starts `rowBoat: null` and leaves it null
//      when no rule fires (e.g. "Both Tacking", ~562), so "rights undetermined"
//      SILENTLY BECOMES "I give way".
//   B  STALE LATCH   `updateRiskAssessment` returns early while `avoidanceCommitTimer
//      > 0` and risk has dropped to LOW (~2947), so `avoidanceRole` can describe an
//      encounter that has moved on.
//   C  WRONG BOAT    `avoidanceRole` is a SINGLE role for the SINGLE highest-risk
//      threat. In a pack she can be correctly GIVE_WAY to A while holding rights over
//      B — and the hold-course term, being global, is off for B too. This is not a
//      bug in the same sense; it is a single-threat model, and it needs naming
//      before any "fix the role" work is scoped.
//
// Also counts the IMMINENT share of rights-ticks, where the hold-course term is zero
// by design.
//   node _role_audit.js <venue> <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'glowtide';
const TRIALS = parseInt(process.argv[3]) || 3;
const SEED0 = parseInt(process.argv[4]) || 9400;
const ROOT = path.join(__dirname, process.argv[5] || 'treeGLB');
(async () => {
    const br = await chromium.launch(); const p = await br.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 250)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const A = { ticks: 0, engRights: 0, agree: 0, disagree: 0, undet: 0, stale: 0, wrongBoat: 0,
                imminent: 0, imminentRights: 0, noThreat: 0, byRisk: {}, pairs: 0, pairRights: 0,
                pairDisagree: 0, latchAll: 0, latchAgree: 0 };
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate((seed) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            const pl = state.boats.find(b => b.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const A = { ticks: 0, engRights: 0, agree: 0, disagree: 0, undet: 0, stale: 0, wrongBoat: 0,
                        imminent: 0, imminentRights: 0, noThreat: 0, byRisk: {}, pairs: 0, pairRights: 0, pairDisagree: 0, latchAll: 0, latchAgree: 0 };
            let sample = 0;
            for (let i = 0; i < 60 * 940; i++) {
                window.update(1 / 60);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 900) break;
                if (++sample % 6) continue;                    // 10 Hz is plenty
                for (const b of bots) {
                    const c = b.controller;
                    if (!c || b.raceState.finished) continue;
                    if (c.riskState === 'LOW' || !c.riskState) continue;
                    A.ticks++;
                    A.byRisk[c.riskState] = (A.byRisk[c.riskState] || 0) + 1;
                    if (c.riskState === 'IMMINENT') A.imminent++;
                    const th = c.threatBoat;
                    if (!th || th.raceState.finished) { A.noThreat++; continue; }
                    let res = null;
                    try { res = window.Rules.getRightOfWay(b, th); } catch (e) { }
                    const row = res ? res.boat : undefined;
                    const engineSaysMine = row === b;
                    if (engineSaysMine) {
                        A.engRights++;
                        if (c.riskState === 'IMMINENT') A.imminentRights++;
                        // ⚠️ RULE 18 CONTROL: `avoidanceCommitTimer` is refreshed to 2.0 s on
                        // every HIGH/IMMINENT tick and on MEDIUM+GIVE_WAY, so "the latch was
                        // held" is only evidence if it is NOT also held on the ticks where the
                        // controller AGREES. Count both populations.
                        if ((c.avoidanceCommitTimer || 0) > 0) A.latchAll++;
                        if (c.avoidanceRole === 'STAND_ON') {
                            A.agree++;
                            if ((c.avoidanceCommitTimer || 0) > 0) A.latchAgree++;
                        }
                        else {
                            A.disagree++;
                            // A — the engine could not decide at all when the role was set
                            if (!row) A.undet++;
                            // B — the latch is holding a role from an encounter that has moved on
                            else if ((c.avoidanceCommitTimer || 0) > 0) A.stale++;
                        }
                    } else if (row == null) {
                        // the engine names nobody: whatever the role says, it was a guess
                        A.undet++;
                    }
                    // C — is she GIVE_WAY overall while holding rights over SOMEBODY ELSE?
                    for (const o of bots) {
                        if (o === b || o === th || o.raceState.finished) continue;
                        const d2 = (o.x - b.x) ** 2 + (o.y - b.y) ** 2;
                        if (d2 > 400 * 400) continue;
                        A.pairs++;
                        let r2 = null;
                        try { r2 = window.Rules.getRightOfWay(b, o); } catch (e) { }
                        if (r2 && r2.boat === b) {
                            A.pairRights++;
                            if (c.avoidanceRole !== 'STAND_ON') { A.pairDisagree++; A.wrongBoat++; }
                        }
                    }
                }
            }
            return A;
        }, SEED0 + t);
        for (const k of Object.keys(r)) {
            if (k === 'byRisk') { for (const q in r.byRisk) A.byRisk[q] = (A.byRisk[q] || 0) + r.byRisk[q]; }
            else A[k] += r[k];
        }
        console.log(`  seed ${SEED0 + t}: ${r.ticks} risk-ticks, ${r.engRights} with rights`);
    }
    await br.close();
    const pct = (n, d) => d ? (100 * n / d).toFixed(1) + '%' : '-';
    console.log(`\n=== ${VENUE}, ${TRIALS} seeds from ${SEED0} — THE ROLE ===`);
    console.log(`  MEDIUM+ risk ticks sampled at 10 Hz: ${A.ticks}   (risk mix ${JSON.stringify(A.byRisk)})`);
    console.log(`  no threat boat despite non-LOW risk: ${pct(A.noThreat, A.ticks)}`);
    console.log(`\n  AGAINST HER OWN NAMED THREAT`);
    console.log(`   the engine gives HER rights on        ${A.engRights}  (${pct(A.engRights, A.ticks)} of risk-ticks)`);
    console.log(`   ...and the controller agrees          ${pct(A.agree, A.engRights)}`);
    console.log(`   ...and the controller says GIVE_WAY   ${pct(A.disagree, A.engRights)}   ⬅ the defect`);
    console.log(`        of those, rights were UNDETERMINED at the tick   ${pct(A.undet, A.disagree)}`);
    console.log(`        of those, the commit latch was held              ${pct(A.stale, A.disagree)}`);
    console.log(`   ⚠️ CONTROL — the latch is held on ${pct(A.latchAgree, A.agree)} of the ticks where she AGREES,`);
    console.log(`      and on ${pct(A.latchAll, A.engRights)} of all her rights-ticks. If those match the line above, the`);
    console.log(`      latch is not a discriminator and the 'stale role' reading is an artifact (rule 4/18).`);
    console.log(`   IMMINENT share of her rights-ticks    ${pct(A.imminentRights, A.engRights)}  (hold-course term is ZERO there by design)`);
    console.log(`\n  AGAINST EVERY OTHER BOAT WITHIN 400u (the single-threat model)`);
    console.log(`   pairs examined                        ${A.pairs}`);
    console.log(`   she holds rights over that boat       ${pct(A.pairRights, A.pairs)}`);
    console.log(`   ...while her single role is not STAND_ON  ${pct(A.pairDisagree, A.pairRights)}  ⬅ structural, not a bug`);
})();
