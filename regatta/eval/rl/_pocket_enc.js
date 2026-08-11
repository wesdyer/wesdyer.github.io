// WHO DEFLECTS WHOM INSIDE A POCKET? (2026-08-09 night, the bowl push.)
//
// `_pocket_split` established WHAT KIND of problem redrock's sw-mark bowl is: of
// 23.9 s/boat under 40 u/s, only 15% is land contact and 85% is slow-but-not-
// touching, with `deflected` 51% of pocket time. That names the term (AVOID_GW)
// but not the ENCOUNTER, and the bowl-pocket note is explicit that AV1 died once
// already for having no measured place and no measured state mix. So before any
// candidate: who is deflecting, in what role, at what range, against whom.
//
//   node _pocket_enc.js <venue> <trials> <seed0> <tree> <cx> <cy> <radius>
//
// THE FOUR QUESTIONS, and why each is here rather than a frame counter:
//
// 1. EPISODES, NOT FRAMES (standing rule 2). An encounter is a contiguous run of
//    frames against ONE dominant threat — `controller.threatBoat`, which the
//    threat assessment already latches for the foul detector (~2808). Counting
//    deflected FRAMES conflates one long hold with twenty flicks.
// 2. ENTRY vs TYPICAL (standing rule 28, which killed H1). Every episode statistic
//    is reported at ENTRY and as a time-weighted TYPICAL, because those differ by
//    an order of magnitude once a boat is stopped and the two answer different
//    design questions.
// 3. ⭐ WOULD IT HAVE CLEARED ANYWAY? The avoidance research already found 86% of
//    onsets needed zero deflection, and that boats deflected a median 11° against
//    rivals ALREADY clearing by 80u. Here that test is made local to the pocket:
//    project both boats 4 s on held course and speed (the same 240-frame lookahead
//    applyAvoidance itself uses) and record the closest approach. An episode whose
//    held-course CPA never breaches the hull-pair distance is one where the
//    deflection bought nothing — and in constrained water it is bought at the price
//    of the water it steers into.
// 4. ⭐ IS THIS AN ENCOUNTER OR A QUEUE? The arctic granite pile turned out to be
//    SERVICE TIME, not avoidance (RD6→RD7), and the arc-disable gate was re-scoped
//    on exactly that mistake. A threat whose own speed is near zero is not keeping
//    clear of anybody — she is an obstacle, and dodging her is a routing problem
//    upstream, not an avoidance-shape problem. Split every statistic on it.
//
// ⚠️ UNITS (standing rule 18): boat.speed is PER FRAME — u/s is speed*60, the same
// convention `_pocket_split` uses. lastAvoidDeviation is RADIANS. Heading convention
// is x + sin(h), y - cos(h), taken from the botGrid probes above.
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'redrock';
const TRIALS = parseInt(process.argv[3]) || 4;
const SEED0 = parseInt(process.argv[4]) || 9400;
const ROOT = path.join(__dirname, process.argv[5] || 'treeFIN');
const CX = parseFloat(process.argv[6]), CY = parseFloat(process.argv[7]);
const RAD = parseFloat(process.argv[8]) || 420;

const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(p * (s.length - 1))] : NaN; };
const med = a => q(a, 0.5);
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
const deg = r => (r * 180 / Math.PI);

(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    const eps = [], frames = [];
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate(async ({ seed, CX, CY, RAD }) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const DT = 1 / 60;
            const open = {};              // boat name -> live episode
            const done = [];              // closed episodes
            const fr = { t: 0, defl: 0, deflNoThreat: 0, spd: 0, spdEnc: 0, tEnc: 0, tFree: 0, spdFree: 0 };

            // Closest approach if BOTH boats hold current course and speed, over `hor`
            // seconds. Straight-line CPA: the minimum of |dp + dv*s| for s in [0,hor].
            const heldCPA = (a, c, hor) => {
                const va = (a.speed || 0) * 60, vc = (c.speed || 0) * 60;
                const dpx = c.x - a.x, dpy = c.y - a.y;
                const dvx = Math.sin(c.heading) * vc - Math.sin(a.heading) * va;
                const dvy = -Math.cos(c.heading) * vc + Math.cos(a.heading) * va;
                const vv = dvx * dvx + dvy * dvy;
                let s = vv > 1e-9 ? -(dpx * dvx + dpy * dvy) / vv : 0;
                s = Math.max(0, Math.min(hor, s));
                return Math.hypot(dpx + dvx * s, dpy + dvy * s);
            };

            for (let it = 0; it < 60 * 900; it++) {
                window.update(DT);
                if (state.race.status !== 'racing') { if (state.race.status === 'finished') break; continue; }
                const inPocket = new Set();
                for (const bo of state.boats) {
                    if (bo.isPlayer || bo.raceState.finished) continue;
                    if (Math.hypot(bo.x - CX, bo.y - CY) > RAD) continue;
                    inPocket.add(bo.name);
                    const c = bo.controller; if (!c) continue;
                    const v = (bo.speed || 0) * 60;
                    const defl = Math.abs(c.lastAvoidDeviation || 0);
                    const th = c.threatBoat;
                    const engaged = !!th && c.riskState && c.riskState !== 'LOW';

                    fr.t += DT; fr.spd += v * DT;
                    if (defl > 0.26) { fr.defl += DT; if (!engaged) fr.deflNoThreat += DT; }
                    if (engaged) { fr.tEnc += DT; fr.spdEnc += v * DT; } else { fr.tFree += DT; fr.spdFree += v * DT; }

                    const key = bo.name;
                    const cur = open[key];
                    if (!engaged) { if (cur) { done.push(cur); delete open[key]; } continue; }

                    const rng = Math.hypot(th.x - bo.x, th.y - bo.y);
                    const cpa = heldCPA(bo, th, 4);
                    const thV = (th.speed || 0) * 60;
                    // relative bearing of the threat off my bow, signed, radians
                    let rb = Math.atan2(th.x - bo.x, -(th.y - bo.y)) - bo.heading;
                    while (rb > Math.PI) rb -= 2 * Math.PI;
                    while (rb < -Math.PI) rb += 2 * Math.PI;

                    if (!cur || cur.threat !== th.name) {
                        if (cur) done.push(cur);
                        open[key] = {
                            boat: key, threat: th.name, dur: 0,
                            roleEntry: c.avoidanceRole, riskEntry: c.riskState,
                            rngEntry: rng, cpaEntry: cpa, thVEntry: thV, rbEntry: rb,
                            deflPeak: defl, deflT: 0, deflSum: 0, rngMin: rng, cpaMin: cpa,
                            spdSum: 0, giveT: 0, standT: 0, parkedT: 0, slowT: 0,
                            slowParkedT: 0, slowMovingT: 0, immT: 0, armedT: 0,
                            thSpinT: 0, thEscT: 0, thWigT: 0, thArmedT: 0, thOtherT: 0,
                        };
                    } else {
                        cur.dur += DT;
                        cur.deflPeak = Math.max(cur.deflPeak, defl);
                        if (defl > 0.26) cur.deflT += DT;
                        cur.rngMin = Math.min(cur.rngMin, rng);
                        cur.cpaMin = Math.min(cur.cpaMin, cpa);
                        cur.spdSum += v * DT;
                        cur.deflSum += defl * DT;          // rule 28: TYPICAL, not just peak
                        if (c.avoidanceRole === 'GIVE_WAY') cur.giveT += DT;
                        if (c.avoidanceRole === 'STAND_ON') cur.standT += DT;
                        const parkedNow = thV < 40;
                        if (parkedNow) cur.parkedT += DT;
                        if (v < 40) {
                            cur.slowT += DT;
                            // ⭐ THE DECIDING CROSS-TAB: is my slow time spent behind a
                            // STOPPED boat (service time — fix why SHE stopped) or against
                            // a moving one (a genuine avoidance-shape cost)?
                            if (parkedNow) cur.slowParkedT += DT; else cur.slowMovingT += DT;
                        }
                        if (c.riskState === 'IMMINENT') cur.immT += DT;
                        if (bo.raceState.roundArmed) cur.armedT += DT;
                        // WHY IS THE THREAT STOPPED? Naming the upstream cause is the whole
                        // point of the parked split — a queue behind a grounded boat and a
                        // queue behind a penalised one are different builds. Precedence per
                        // standing rule 27: spin > escape > wiggle.
                        if (parkedNow) {
                            const tc = th.controller;
                            if (tc && tc.penaltySpin) cur.thSpinT += DT;
                            else if (tc && tc.iceEscapeTimer > 0) cur.thEscT += DT;
                            else if (tc && tc.wiggleActive) cur.thWigT += DT;
                            else if (th.raceState && th.raceState.roundArmed) cur.thArmedT += DT;
                            else cur.thOtherT += DT;
                        }
                    }
                }
                for (const k in open) if (!inPocket.has(k)) { done.push(open[k]); delete open[k]; }
            }
            for (const k in open) done.push(open[k]);
            return { done, fr };
        }, { seed: SEED0 + t, CX, CY, RAD });
        console.log(`seed ${SEED0 + t}: ${r.done.length} encounter episodes in the pocket`);
        for (const e of r.done) eps.push(e);
        frames.push(r.fr);
    }
    await b.close();

    const F = k => frames.reduce((a, x) => a + (x[k] || 0), 0);
    const pct = (a, bb) => bb ? (100 * a / bb).toFixed(0) + '%' : '-';
    const T = F('t');
    console.log(`\n=== POCKET ENCOUNTERS (${CX},${CY}) r=${RAD} on ${VENUE}` +
        `  ${TRIALS} seeds from ${SEED0}, ${path.basename(ROOT)} ===`);
    console.log(`pocket time ${T.toFixed(1)} boat-s   mean speed ${(F('spd') / (T || 1)).toFixed(0)} u/s`);
    console.log(`  deflected (>15deg)   ${pct(F('defl'), T)} of pocket time` +
        `   of which NO engaged threat: ${pct(F('deflNoThreat'), F('defl'))}`);
    console.log(`  IN AN ENCOUNTER      ${pct(F('tEnc'), T)} of pocket time` +
        `   speed in ${(F('spdEnc') / (F('tEnc') || 1)).toFixed(0)} vs out ${(F('spdFree') / (F('tFree') || 1)).toFixed(0)} u/s`);

    // Episodes: keep only ones with real duration (a single-frame flick is a
    // pairing change, not an encounter).
    const E = eps.filter(e => e.dur >= 0.25);
    console.log(`\n${eps.length} raw pairings, ${E.length} episodes lasting >=0.25 s` +
        `   (${(E.length / (TRIALS || 1)).toFixed(1)} per seed)`);
    if (!E.length) { console.log('no episodes — nothing to report'); return; }

    const dur = E.map(e => e.dur);
    console.log(`  duration      med ${med(dur).toFixed(1)}s  mean ${mean(dur).toFixed(1)}s  p90 ${q(dur, 0.9).toFixed(1)}s   TOTAL ${dur.reduce((a, x) => a + x, 0).toFixed(0)} boat-s`);
    const roleOf = e => (e.giveT > e.standT ? 'GIVE_WAY' : e.standT > 0 ? 'STAND_ON' : e.roleEntry || 'NONE');
    const byRole = {};
    for (const e of E) { const r = roleOf(e); (byRole[r] = byRole[r] || []).push(e); }
    console.log(`\n  BY DOMINANT ROLE (time-weighted role over the episode):`);
    for (const [r, list] of Object.entries(byRole).sort((a, b2) => b2[1].length - a[1].length)) {
        const tt = list.reduce((a, x) => a + x.dur, 0);
        console.log(`    ${r.padEnd(9)} ${String(list.length).padStart(4)} eps  ${tt.toFixed(0).padStart(5)} boat-s (${pct(tt, dur.reduce((a, x) => a + x, 0))})` +
            `  peak defl med ${deg(med(list.map(x => x.deflPeak))).toFixed(0)}deg` +
            `  entry range med ${med(list.map(x => x.rngEntry)).toFixed(0)}u`);
    }

    // ⭐ the self-resolving test, at ENTRY and at the episode's tightest held-course CPA.
    const HULL = 40;   // hull-pair separation the avoidance bubble is built around
    const clearEntry = E.filter(e => e.cpaEntry > 80);
    const clearEver = E.filter(e => e.cpaMin > 80);
    const tSum = a => a.reduce((x, y) => x + y.dur, 0);
    console.log(`\n  ⭐ WOULD IT HAVE CLEARED ANYWAY? (both boats hold course + speed, 4 s)`);
    console.log(`    held-course CPA at entry   med ${med(E.map(e => e.cpaEntry)).toFixed(0)}u   p10 ${q(E.map(e => e.cpaEntry), 0.1).toFixed(0)}u`);
    console.log(`    entry CPA already > 80u    ${clearEntry.length}/${E.length} eps (${pct(clearEntry.length, E.length)})` +
        `   ${tSum(clearEntry).toFixed(0)} boat-s (${pct(tSum(clearEntry), tSum(E))})`);
    console.log(`    NEVER breaches 80u at all  ${clearEver.length}/${E.length} eps (${pct(clearEver.length, E.length)})` +
        `   ${tSum(clearEver).toFixed(0)} boat-s (${pct(tSum(clearEver), tSum(E))})` +
        `   peak defl med ${deg(med(clearEver.map(e => e.deflPeak))).toFixed(0)}deg`);
    console.log(`    breaches ${HULL}u (real contact risk) ${E.filter(e => e.cpaMin <= HULL).length}/${E.length} eps`);

    // ⭐ encounter or queue?
    const parked = E.filter(e => e.parkedT > 0.5 * e.dur);
    console.log(`\n  ⭐ ENCOUNTER OR QUEUE? threat's OWN speed under 40 u/s for most of the episode`);
    console.log(`    vs a PARKED threat   ${parked.length}/${E.length} eps (${pct(parked.length, E.length)})` +
        `   ${tSum(parked).toFixed(0)} boat-s (${pct(tSum(parked), tSum(E))})`);
    console.log(`    vs a MOVING threat   ${E.length - parked.length}/${E.length} eps` +
        `   ${(tSum(E) - tSum(parked)).toFixed(0)} boat-s`);
    console.log(`    entry threat speed   med ${med(E.map(e => e.thVEntry)).toFixed(0)} u/s`);

    // ⭐ WHY IS THE PARKED THREAT PARKED? A queue behind a grounded boat is a
    // different build from a queue behind a penalised one.
    const P = k => E.reduce((a, e) => a + e[k], 0);
    const parkT = P('parkedT');
    console.log(`\n  ⭐ WHY IS THE THREAT STOPPED? (share of time engaged with a parked threat)`);
    console.log(`    she is penalty-spinning   ${pct(P('thSpinT'), parkT)}`);
    console.log(`    she is in contact-escape  ${pct(P('thEscT'), parkT)}`);
    console.log(`    she is wiggling (stuck)   ${pct(P('thWigT'), parkT)}`);
    console.log(`    she is armed (rounding)   ${pct(P('thArmedT'), parkT)}`);
    console.log(`    none of the above         ${pct(P('thOtherT'), parkT)}`);

    // where the time actually goes
    const slowT = E.reduce((a, e) => a + e.slowT, 0);
    console.log(`\n  COST INSIDE ENCOUNTERS`);
    console.log(`    time under 40 u/s while engaged  ${slowT.toFixed(0)} boat-s (${pct(slowT, tSum(E))} of encounter time)`);
    console.log(`    ⭐ of that slow time: behind a PARKED threat ${P('slowParkedT').toFixed(0)} boat-s (${pct(P('slowParkedT'), slowT)})` +
        `   vs a MOVING threat ${P('slowMovingT').toFixed(0)} boat-s (${pct(P('slowMovingT'), slowT)})`);
    console.log(`    typical (time-weighted) deflection while engaged ${deg(P('deflSum') / (tSum(E) || 1)).toFixed(0)}deg` +
        `   vs peak-per-episode med ${deg(med(E.map(e => e.deflPeak))).toFixed(0)}deg  (rule 28)`);
    console.log(`    armed (rounding) while engaged   ${pct(E.reduce((a, e) => a + e.armedT, 0), tSum(E))}`);
    console.log(`    IMMINENT                         ${pct(E.reduce((a, e) => a + e.immT, 0), tSum(E))}`);
    console.log(`    deflected >15deg while engaged   ${pct(E.reduce((a, e) => a + e.deflT, 0), tSum(E))}`);
    console.log(`\n  → self-resolving + moving threat  = the AVOIDANCE SHAPE is the target.`);
    console.log(`  → parked threat                   = SERVICE TIME upstream, not avoidance (RD6->RD7).`);
    console.log(`  → deflected with no engaged threat = LAND terms, not the fleet.`);
})();
