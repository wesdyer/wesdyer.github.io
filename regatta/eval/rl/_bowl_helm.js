// WHAT ACTUALLY HOLDS THE FLEET AT 36 u/s IN THE BOWL? (2026-08-10, redrock)
//
// leg3-sub0 is +26.5 s/boat — 57% of leg 3 and ~14% of redrock's whole gap — and
// the two obvious explanations are already dead:
//   * ADMISSION is not it. `_pocket_admit`: the grid accepts 96% of HER line
//     through the same water, which she crosses at 88 u/s.
//   * The land RAY is a statistic, not a shown cause: 86.6% of its alarms fire
//     while the boat's own plan ahead is clear, but its only consumer (`nosedIn`,
//     ~3104) ADDS bailout candidates rather than slowing anything.
// So the question is unanswered, and standing rule 27 says answer it by finding
// the LAST WRITER rather than by naming a plausible branch.
//
// TWO INDEPENDENT DECOMPOSITIONS OF EVERY SLOW FRAME (<40 u/s) IN THE POCKET:
//
// 1. THROTTLE vs TARGET. `controller.speedLimit` is the final speedRequest the
//    helm asked for (~1164). `boat.targetSpeed` is what physics says the boat
//    could do here (probe tree only). Three cases, and they want different fixes:
//      - speedLimit < 1        -> the AI is deliberately braking. Find which gate.
//      - speed << target       -> not braking, still RECOVERING. boat.speed lerps
//                                 to target on a ~5.5 s constant, and a contact
//                                 multiplies SPEED by 0.4 per overlapped frame, so
//                                 a knocked-down boat reads slow for seconds after
//                                 the cause has gone. That is a CONTACT problem
//                                 wearing a speed costume.
//      - speed ~= target, low  -> the target itself is low: bad TWA, or lee.
//
// 2. HELM OWNERSHIP, in true precedence order (rule 27 — `update()` writes nav
//    first, penaltySpin may `return` before avoidance at ~766, and applyAvoidance
//    OVERWRITES from the island reflex at ~896): spin > escape > contact-reflex >
//    wiggle > clearance > nav.
//
//   node _bowl_helm.js <venue> <trials> <seed0> <tree> <cx> <cy> <r>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'redrock';
const TRIALS = parseInt(process.argv[3]) || 4;
const SEED0 = parseInt(process.argv[4]) || 9400;
const ROOT = path.join(__dirname, process.argv[5] || 'treePROBE');
const CX = parseFloat(process.argv[6] !== undefined ? process.argv[6] : -747);
const CY = parseFloat(process.argv[7] !== undefined ? process.argv[7] : -1416);
const RR = parseFloat(process.argv[8] !== undefined ? process.argv[8] : 400);

(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    const A = {};
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate(({ seed, CX, CY, RR }) => {
            const hit = {}; const inner = window.onRaceEvent;
            window.onRaceEvent = (ty, d) => {
                if (ty === 'collision_island' && d && d.boat && !d.boat.isPlayer) hit[d.boat.name] = 1;
                return inner && inner(ty, d);
            };
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const o = { t: 0, slow: 0, brake: 0, recover: 0, targetLow: 0, contactNow: 0,
                        spin: 0, esc: 0, reflex: 0, wig: 0, nav: 0, irons: 0,
                        sumSpd: 0, sumTgt: 0, sumLim: 0, n: 0 };
            const DT = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) {
                for (const k in hit) delete hit[k];
                window.update(DT);
                if (state.race.status !== 'racing') { if (state.race.status === 'finished') break; continue; }
                for (const bo of state.boats) {
                    if (bo.isPlayer || bo.raceState.finished || bo.raceState.leg < 1) continue;
                    if (Math.hypot(bo.x - CX, bo.y - CY) > RR) continue;
                    const c = bo.controller; if (!c) continue;
                    const v = (bo.speed || 0) * 60;
                    o.t += DT;
                    if (v >= 40) continue;
                    o.slow += DT; o.n++;
                    const tgt = (bo.targetSpeed != null ? bo.targetSpeed : 0) * 60;
                    const lim = c.speedLimit != null ? c.speedLimit : 1;
                    o.sumSpd += v; o.sumTgt += tgt; o.sumLim += lim;
                    // 1. why is the boat slow?
                    if (hit[bo.name]) o.contactNow += DT;
                    if (lim < 0.95) o.brake += DT;
                    else if (tgt > 0 && v < 0.7 * tgt) o.recover += DT;
                    else o.targetLow += DT;
                    const w = getWindAt(bo.x, bo.y);
                    if (Math.abs(normalizeAngle(bo.heading - w.direction)) < 0.55) o.irons += DT;
                    // 2. who owns the helm, in TRUE precedence order (rule 27)
                    if (c.penaltySpin) o.spin += DT;
                    else if (c.escActive) o.esc += DT;
                    else if (c.iceEscapeTimer > 0) o.reflex += DT;
                    else if (c.wiggleActive) o.wig += DT;
                    else o.nav += DT;
                }
            }
            window.onRaceEvent = inner;
            return o;
        }, { seed: SEED0 + t, CX, CY, RR });
        for (const k of Object.keys(r)) A[k] = (A[k] || 0) + r[k];
        console.log(`seed ${SEED0 + t}: ${r.slow.toFixed(0)} slow boat-s of ${r.t.toFixed(0)} in the pocket`);
    }
    await b.close();
    const P = x => (100 * x / A.slow).toFixed(0) + '%';
    console.log(`\n=== ${VENUE.toUpperCase()} BOWL: WHAT HOLDS THE FLEET DOWN (${TRIALS} seeds, ${path.basename(ROOT)}) ===`);
    console.log(`pocket (${CX},${CY}) r=${RR}   pocket time ${A.t.toFixed(0)} boat-s   slow (<40 u/s) ${A.slow.toFixed(0)} (${(100 * A.slow / A.t).toFixed(0)}%)`);
    console.log(`on slow frames: mean speed ${(A.sumSpd / A.n).toFixed(1)} u/s   mean TARGET ${(A.sumTgt / A.n).toFixed(1)} u/s   mean throttle ${(A.sumLim / A.n).toFixed(2)}`);
    console.log(`\n  WHY SLOW`);
    console.log(`    AI is braking (speedLimit < 0.95)       ${P(A.brake)}`);
    console.log(`    ⭐ RECOVERING (speed < 70% of target)    ${P(A.recover)}`);
    console.log(`    target itself is low                    ${P(A.targetLow)}`);
    console.log(`    (in land contact this frame)            ${P(A.contactNow)}`);
    console.log(`    (in irons)                              ${P(A.irons)}`);
    console.log(`\n  WHO OWNS THE HELM (true precedence, rule 27)`);
    console.log(`    penaltySpin ${P(A.spin)}   escape ${P(A.esc)}   contact-reflex ${P(A.reflex)}   wiggle ${P(A.wig)}   navigation ${P(A.nav)}`);
    console.log(`\n  → RECOVERING dominant => the cost is knockdowns, not steering: fix CONTACT.`);
    console.log(`  → braking dominant    => a gate is throttling; find it and price it.`);
    console.log(`  → target low dominant => it is wind/lee/TWA, not the AI at all.`);
})();
