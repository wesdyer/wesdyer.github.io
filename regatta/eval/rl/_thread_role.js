// THREAD ROLE LEDGER (2026-08-09, Phase 0 of THE ROUNDING PUSH). The mark-5
// decomposition found the thread before the rounding is the money: bot 39-57
// u/s vs her 78-90, 81-161u off her line, 0% throttle/armed, "55% avoid-
// deviating". That 55% is a CORRELATION with `lastAvoidDeviation`, which is
// the boat's TOTAL deflection from every cause at once (land, marks, floes,
// every rival) — it cannot say whose water the boat gave up, and it was
// measured under the INVERTED rule 11 (fixed in 056dc2b).
//
// This probe answers the load-bearing question directly, off the argmin's own
// ledger (treeP0R instrumentation): of the deviation-radians spent in the
// thread box, WHAT SHARE IS THE BOAT YIELDING TO A RIVAL SHE HOLDS RIGHTS
// OVER, below IMMINENT — i.e. water the rules let her hold.
//
// Each logged tick carries the full candidate fan; the 0-rung is the plan/nav
// heading. Its defeat is attributed to exactly one term, cheapest-first in the
// order the cost function applies them, and traffic terms are split by OUR
// role against the specific rival that charged them (role is cached per tick;
// getRightOfWay reads current state, not the candidate heading).
//   node _thread_role.js <venue> <x0> <y0> <x1> <y1> <trials> <seed0> [tree] [leg]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'redrock';
const BOX = process.argv.slice(3, 7).map(Number);
const TRIALS = parseInt(process.argv[7]) || 4;
const SEED0 = parseInt(process.argv[8]) || 9400;
const ROOT = path.join(__dirname, process.argv[9] || 'treeP0R');
const LEG = process.argv[10] != null ? parseInt(process.argv[10]) : null;

(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 240)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const all = []; let over = 0;
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate(async ({ seed, BOX, LEG }) => {
            window.__avCap = 1; window.__avLog = []; window.__avOver = 0;
            window.__avBox = BOX && BOX.length === 4 && !BOX.some(isNaN) ? BOX : null;
            window.__avLeg = LEG;
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const dt = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
            }
            return { rows: window.__avLog, over: window.__avOver };
        }, { seed: SEED0 + t, BOX, LEG });
        console.log(`seed ${SEED0 + t}: ${r.rows.length} ticks logged${r.over ? ` (CAP HIT, ${r.over} dropped)` : ''}`);
        over += r.over; all.push(...r.rows);
    }
    await b.close();
    if (over) console.log(`\n⚠️ BUFFER CAP DROPPED ${over} ticks — figures below are the first 20000/race only.`);
    if (!all.length) { console.log('no ticks in box'); return; }

    const q = (a, pr) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(pr * (s.length - 1))] : NaN; };
    const pct = (a, t) => t ? (100 * a / t).toFixed(1) + '%' : '-';

    // ---- 1. the deviation denominator, split by role x risk -----------------
    const DEVBAR = 0.05; // rad; below this the boat is on its line
    let devTot = 0, nTot = all.length, nDev = 0;
    const cell = {};
    for (const r of all) {
        devTot += r.dev;
        if (r.dev >= DEVBAR) nDev++;
        const k = r.role + '/' + r.risk;
        const c = cell[k] = cell[k] || { n: 0, dev: 0, nd: 0, spd: [] };
        c.n++; c.dev += r.dev; if (r.dev >= DEVBAR) c.nd++; c.spd.push(r.spd);
    }
    console.log(`\n=== ${VENUE} leg ${LEG == null ? 'all' : LEG} box [${BOX.join(',')}] — ${TRIALS} races, ${nTot} avoidance ticks ===`);
    console.log(`ticks deviating >=${DEVBAR} rad: ${nDev} (${pct(nDev, nTot)}) | total deviation ${devTot.toFixed(1)} rad`);
    console.log('\nrole/risk           ticks    %ticks   dev-rad   %dev    dev>=bar%   spd med');
    for (const [k, c] of Object.entries(cell).sort((a, x) => x[1].dev - a[1].dev)) {
        console.log(`  ${k.padEnd(18)} ${String(c.n).padStart(5)}   ${pct(c.n, nTot).padStart(6)}   ${c.dev.toFixed(1).padStart(7)}   ${pct(c.dev, devTot).padStart(6)}   ${pct(c.nd, c.n).padStart(8)}    ${q(c.spd, .5)}`);
    }

    // ---- 2. why the 0-rung (plan/nav heading) lost --------------------------
    // Attribution order mirrors the cost function's own magnitudes: hard vetoes
    // (static 15000 / boat 10000+500000/d2 / rule 20000) dominate the gradient
    // terms, so a rung defeated by a veto is attributed there; otherwise the
    // proximity delta is split into its rival and static halves and the larger
    // one is credited.
    const why = {}, whyDev = {};
    let nAttr = 0, devAttr = 0;
    const standOnPool = [];      // deviation the RULES LET HER HOLD
    const pcCPA = { standOn: [], all: [] };
    for (const r of all) {
        if (r.dev < DEVBAR) continue;
        const fan = r.fan; if (!fan || !fan.length) continue;
        const f0 = fan.find(c => c.off === 0); if (!f0) continue;
        const win = fan.reduce((a, c) => c.cost < a.cost ? c : a, fan[0]);
        if (win.off === 0) continue; // deviation came from downstream of the fan
        nAttr++; devAttr += r.dev;
        let k;
        if (f0.sc && !win.sc) k = 'STATIC_VETO';
        else if (f0.bc && !win.bc) k = 'BOAT_VETO/' + (f0.bcS && !f0.bcG ? 'standOn' : f0.bcG && !f0.bcS ? 'giveWay' : f0.bcS && f0.bcG ? 'mixed' : 'noRole');
        else if (f0.rv && !win.rv) k = 'RULE_VETO';
        else {
            const dRiv = (f0.pxr || 0) - (win.pxr || 0);
            const dSta = (f0.px - (f0.pxr || 0)) - (win.px - (win.pxr || 0));
            if (dRiv <= 0 && dSta <= 0) k = 'NO_TERM(tie/bonus)';
            else if (dRiv >= dSta) {
                const dS = (f0.pxS || 0) - (win.pxS || 0), dG = (f0.pxG || 0) - (win.pxG || 0);
                k = 'PROX_RIVAL/' + (dS > dG ? 'standOn' : dG > dS ? 'giveWay' : 'noRole');
            } else k = 'PROX_STATIC';
        }
        why[k] = (why[k] || 0) + 1; whyDev[k] = (whyDev[k] || 0) + r.dev;
        if (/standOn/.test(k) && r.risk !== 'IMMINENT') {
            standOnPool.push(r);
            if (r.pcCPA != null) pcCPA.standOn.push(r.pcCPA);
        }
        if (r.pcCPA != null) pcCPA.all.push(r.pcCPA);
    }
    console.log(`\n0-rung defeats attributed: ${nAttr} ticks / ${devAttr.toFixed(1)} rad (of ${nDev} deviating ticks; the rest are downstream of the fan)`);
    console.log('why the plan-aligned rung lost      ticks    %      dev-rad   %dev-attr');
    for (const [k, n] of Object.entries(why).sort((a, x) => whyDev[x[0]] - whyDev[a[0]])) {
        console.log(`  ${k.padEnd(32)} ${String(n).padStart(5)}  ${pct(n, nAttr).padStart(6)}  ${whyDev[k].toFixed(1).padStart(7)}   ${pct(whyDev[k], devAttr)}`);
    }

    // ---- 3. THE HEADLINE ---------------------------------------------------
    const soDev = standOnPool.reduce((a, r) => a + r.dev, 0);
    // Tick-weighting favours SLOW boats (a parked boat logs ticks and covers no
    // ground), and stand-on ticks run faster than give-way ones — so quote the
    // distance-weighted share beside it. rad*u/s ~ radian-metres of line given up.
    const devDist = all.reduce((a, r) => a + r.dev * r.spd, 0);
    const soDist = standOnPool.reduce((a, r) => a + r.dev * r.spd, 0);
    console.log(`\n⭐ YIELDED-WITH-RIGHTS (0-rung beaten by a rival we hold rights over, risk < IMMINENT):`);
    console.log(`   distance-weighted (dev x speed): ${pct(soDist, devDist)} of thread deviation`);
    console.log(`   ${standOnPool.length} ticks / ${soDev.toFixed(1)} rad = ${pct(soDev, devTot)} of ALL thread deviation, ${pct(soDev, devAttr)} of attributed`);
    if (standOnPool.length) {
        console.log(`   their speed med ${q(standOnPool.map(r => r.spd), .5)} u/s | dev med ${q(standOnPool.map(r => r.dev), .5).toFixed(2)} rad (${(q(standOnPool.map(r => r.dev), .5) * 57.3).toFixed(0)}deg) p75 ${(q(standOnPool.map(r => r.dev), .75) * 57.3).toFixed(0)}deg`);
        const rc = {}; for (const r of standOnPool) rc[r.risk] = (rc[r.risk] || 0) + 1;
        console.log(`   risk mix ${JSON.stringify(rc)} | armed ${pct(standOnPool.filter(r => r.arm).length, standOnPool.length)} | plan-aligned(al) ${pct(standOnPool.filter(r => r.al).length, standOnPool.length)}`);
    }
    if (pcCPA.all.length) console.log(`   properCourseCPA (dominant threat, STAND_ON ticks): med ${q(pcCPA.all, .5)}u p25 ${q(pcCPA.all, .25)}u — hull width ~30u`);

    // ---- 3a. WHICH static source defeats the line (treeP0S only) ----------
    // PROX_STATIC is nine different terms wearing one name. Sum each bucket's
    // 0-rung-minus-winner margin over the ticks it actually decided.
    const bTot = {}; let bN = 0;
    for (const r of all) {
        if (r.dev < DEVBAR) continue;
        const fan = r.fan; if (!fan) continue;
        const f0 = fan.find(c => c.off === 0); if (!f0 || !f0.pb) continue;
        const win = fan.reduce((a, c) => c.cost < a.cost ? c : a, fan[0]);
        if (win.off === 0) continue;
        bN++;
        const keys = new Set([...Object.keys(f0.pb || {}), ...Object.keys(win.pb || {})]);
        for (const k of keys) {
            const d = (f0.pb[k] || 0) - ((win.pb && win.pb[k]) || 0);
            if (d > 0) bTot[k] = (bTot[k] || 0) + d;
        }
    }
    if (bN) {
        const vet = Object.entries(bTot).filter(([k]) => k.startsWith('V_'));
        const grd = Object.entries(bTot).filter(([k]) => !k.startsWith('V_'));
        const gs = grd.reduce((a, x) => a + x[1], 0);
        console.log(`\nWHAT the 0-rung hit (${bN} deviating ticks with a bucket ledger):`);
        if (vet.length) {
            const vs = vet.reduce((a, x) => a + x[1], 0);
            console.log(`  HARD VETO source (ticks where the 0-rung was vetoed and the winner was not):`);
            for (const [k, v] of vet.sort((a, x) => x[1] - a[1]))
                console.log(`    ${k.padEnd(12)} ${String(Math.round(v)).padStart(6)} ticks  ${pct(v, vs)}`);
        }
        console.log(`  GRADIENT source (0-rung-minus-winner cost margin, total ${Math.round(gs)}):`);
        for (const [k, v] of grd.sort((a, x) => x[1] - a[1]))
            console.log(`    ${k.padEnd(12)} ${String(Math.round(v)).padStart(9)}   ${pct(v, gs)}`);
    }

    // ---- 3a3. does the 0-rung PASS the band-trust test? --------------------
    // The landed trust test (HZ3B) exempts a candidate from the clearance band
    // and shrinks its hard zone only if it is plan-aligned (<=0.3 rad of the
    // far-field plan heading), open water, no arc, not irons, <2kt stream. If
    // the thread's own plan-heading rung fails that test, the thread pays the
    // full lee-shore tax on the router's own line — which clause fails is the
    // whole Phase-A question.
    const tr = { n: 0, pass: 0, failPlan: 0, failIrons: 0, failArc: 0, failOther: 0, dPlan: [] };
    for (const r of all) {
        if (r.dev < DEVBAR) continue;
        const fan = r.fan; if (!fan) continue;
        const f0 = fan.find(c => c.off === 0); if (!f0 || f0.trust == null) continue;
        const win = fan.reduce((a, c) => c.cost < a.cost ? c : a, fan[0]);
        if (win.off === 0) continue;
        tr.n++;
        if (f0.trust) { tr.pass++; continue; }
        if (f0.dPlan != null) tr.dPlan.push(f0.dPlan);
        if (f0.arcK) tr.failArc++;
        else if (f0.dPlan == null || f0.dPlan > 0.3) tr.failPlan++;
        else if (f0.twa < 0.62) tr.failIrons++;
        else tr.failOther++;
    }
    if (tr.n) {
        console.log(`\nBAND-TRUST test on the 0-rung (${tr.n} deviating ticks):`);
        console.log(`   PASSES trust ${pct(tr.pass, tr.n)} — these already pay no clearance band and get the shrunk hard zone`);
        console.log(`   FAILS: not-plan-aligned ${pct(tr.failPlan, tr.n)} | in-irons ${pct(tr.failIrons, tr.n)} | armed-arc ${pct(tr.failArc, tr.n)} | other(current/floe) ${pct(tr.failOther, tr.n)}`);
        if (tr.dPlan.length) console.log(`   |desired - planHeading| on failing ticks: med ${q(tr.dPlan, .5)} rad (${(q(tr.dPlan, .5) * 57.3).toFixed(0)}deg) p25 ${q(tr.dPlan, .25)} p75 ${q(tr.dPlan, .75)} — the test's bar is 0.30`);
        const anyTrust = all.filter(r => r.fan && r.fan.some(c => c.trust));
        console.log(`   ticks where ANY candidate passes trust: ${pct(anyTrust.length, nTot)}`);
    }

    // ---- 3a4. does the deviation PINCH the boat toward irons? -------------
    // The thread's cost is speed, not just distance. Engine convention (rule
    // 19): TWA 0 = head to wind, so a WINNER with a smaller TWA than the 0-rung
    // is a heading deflected toward the no-go — the land terms buying a lateral
    // metre with a knot. The no-go tax is only 500*jamF and cannot outbid them.
    const pin = { n: 0, up: 0, down: 0, f0: [], win: [], dTwa: [] };
    for (const r of all) {
        if (r.dev < DEVBAR) continue;
        const fan = r.fan; if (!fan) continue;
        const f0 = fan.find(c => c.off === 0); if (!f0 || f0.twa == null) continue;
        const win = fan.reduce((a, c) => c.cost < a.cost ? c : a, fan[0]);
        if (win.off === 0) continue;
        pin.n++; pin.f0.push(f0.twa); pin.win.push(win.twa); pin.dTwa.push(win.twa - f0.twa);
        if (win.twa < f0.twa) pin.up++; else pin.down++;
    }
    if (pin.n) {
        console.log(`\nPINCH test (${pin.n} deviating ticks; TWA 0 = head to wind):`);
        console.log(`   0-rung TWA med ${q(pin.f0, .5)} rad (${(q(pin.f0, .5) * 57.3).toFixed(0)}deg) | winner TWA med ${q(pin.win, .5)} rad (${(q(pin.win, .5) * 57.3).toFixed(0)}deg)`);
        console.log(`   winner is CLOSER to the wind (pinched) ${pct(pin.up, pin.n)} | bore away ${pct(pin.down, pin.n)} | med delta ${q(pin.dTwa, .5)} rad (${(q(pin.dTwa, .5) * 57.3).toFixed(0)}deg)`);
        console.log(`   winner inside the no-go tax band (TWA<0.55) ${pct(pin.win.filter(t => t < 0.55).length, pin.n)} vs 0-rung ${pct(pin.f0.filter(t => t < 0.55).length, pin.n)}`);
    }

    // ---- 3a2. WHICH RULE decides the give-way calls ------------------------
    const ruleRows = all.filter(r => r.thrRule);
    if (ruleRows.length) {
        const rr = {};
        for (const r of ruleRows) {
            const sec = Math.abs(r.thrB) < 0.6 ? 'AHEAD' : Math.abs(r.thrB) < 2.2 ? 'ABEAM' : 'ASTERN';
            const k = r.thrRule + ' | ' + r.role + ' | ' + sec;
            rr[k] = (rr[k] || 0) + 1;
        }
        console.log(`\nrule deciding the dominant-threat pairing (${ruleRows.length} ticks):`);
        for (const [k, n] of Object.entries(rr).sort((a, x) => x[1] - a[1]).slice(0, 14))
            console.log(`  ${k.padEnd(38)} ${String(n).padStart(5)}  ${pct(n, ruleRows.length)}`);
    }

    // ---- 3b. is the traffic a QUEUE or a CROSSING? -------------------------
    // A boat in line-astern has no stand-on pool by construction (RRS 12): the
    // follower keeps clear, the leader has nothing to hold against. Split the
    // dominant-threat bearing to say which geometry the thread actually is.
    const withThr = all.filter(r => r.thrB != null);
    if (withThr.length) {
        const ahead = withThr.filter(r => Math.abs(r.thrB) < 0.6);
        const abeam = withThr.filter(r => Math.abs(r.thrB) >= 0.6 && Math.abs(r.thrB) < 2.2);
        const astern = withThr.filter(r => Math.abs(r.thrB) >= 2.2);
        console.log(`\nthreat geometry (${withThr.length} ticks with a dominant threat): AHEAD(<35deg) ${pct(ahead.length, withThr.length)} | ABEAM ${pct(abeam.length, withThr.length)} | ASTERN(>126deg) ${pct(astern.length, withThr.length)}`);
        console.log(`   threat dist med ${q(withThr.map(r => r.thrD), .5)}u | rivals within 200u med ${q(all.map(r => r.nRiv), .5)} p75 ${q(all.map(r => r.nRiv), .75)}`);
        for (const [lbl, set] of [['AHEAD', ahead], ['ABEAM', abeam], ['ASTERN', astern]]) {
            if (!set.length) continue;
            const rl = {}; for (const r of set) rl[r.role] = (rl[r.role] || 0) + 1;
            console.log(`   ${lbl.padEnd(7)} roles ${JSON.stringify(rl)} dev-rad ${set.reduce((a, r) => a + r.dev, 0).toFixed(1)}`);
        }
    }
    // AUDIT (rule 18): the fleet-wide pairwise role tally over EVERY rival
    // within 250u, independent of which rival the risk model elected as the
    // dominant threat. If pairwise roles are ~symmetric but dominant-threat
    // roles are lopsided, the asymmetry lives in the RISK model, not the rules.
    const pr = all.filter(r => r.pair);
    if (pr.length) {
        let S = 0, G = 0, N = 0;
        for (const r of pr) { S += r.pair.S; G += r.pair.G; N += r.pair.N; }
        const tp = S + G + N;
        console.log(`\nAUDIT — pairwise roles vs EVERY rival within 250u (${tp} pairings over ${pr.length} ticks):`);
        console.log(`   we hold rights ${pct(S, tp)} | we owe ${pct(G, tp)} | no rule ${pct(N, tp)}`);
        console.log(`   (dominant-threat role above reads STAND_ON ${pct(all.filter(r => r.role === 'STAND_ON').length, nTot)} — a gap here means the RISK model elects give-way pairings, not the rules)`);
    }

    const hp = all.filter(r => r.hp);
    console.log(`\nplan-heading availability: hPlanFF present ${pct(hp.length, nTot)} of ticks | desired heading plan-ALIGNED (<=0.3 rad) ${pct(all.filter(r => r.al).length, nTot)}`);

    // ---- 4. the hold-course bonus that already exists ----------------------
    const so = all.filter(r => r.role === 'STAND_ON');
    console.log(`\ncontext: STAND_ON ticks ${so.length} (${pct(so.length, nTot)}); of these MEDIUM ${pct(so.filter(r => r.risk === 'MEDIUM').length, so.length)} HIGH ${pct(so.filter(r => r.risk === 'HIGH').length, so.length)} IMMINENT ${pct(so.filter(r => r.risk === 'IMMINENT').length, so.length)}`);
    console.log(`         (the existing hold-course bonus pays |offset|*3000 at MEDIUM, *1000 at HIGH, 0 at IMMINENT — and only vs the ONE dominant threat)`);
})();
