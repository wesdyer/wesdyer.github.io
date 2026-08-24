// THE CARROT-PIN COUNTERFACTUAL (2026-08-22, arctic router push, Phase 1.2 —
// pre-registered in regatta-arctic-router-push-plan: SIZE C1 BEFORE BUILDING).
//
// C1's mechanism: on an AGE-triggered rebuild whose corridor answer is
// unchanged, keep the OLD gridPath (the steering reference) instead of
// adopting the new one. This probe computes, at every replan frame, BOTH
// carrots from the boat's CURRENT position — one on the new path, one on the
// old path it would have kept — and asks:
//   * what triggered the rebuild (age >= ~12 / goal moved / blockage-or-lost)
//   * is the new path the SAME CORRIDOR as the old (max lateral offset of the
//     new path from the old polyline over the shared span <= BAND)
//   * did adopting the new path FLIP the carrot's wind side vs the old one
// C1's absorbable population = age-triggered AND same-corridor AND flipped.
// Everything else C1 leaves byte-identical by design.
//
// usage: node _carrot_pin_cf.js <venue> <trials> <seed0> <tree> [carrot] [band]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'arctic';
const TRIALS = parseInt(process.argv[3]) || 4;
const SEED0 = parseInt(process.argv[4]) || 9101;
const ROOT = path.join(__dirname, process.argv[5] || 'treeNP5');
const CARROT = parseFloat(process.argv[6]) || 420;
const BAND = parseFloat(process.argv[7]) || 80;

(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    const A = { replans: 0, trigAge: 0, trigGoal: 0, trigOther: 0,
        same80: 0, same120: 0, flips: 0, flipAge: 0, flipAgeSame80: 0, flipAgeSame120: 0,
        flipGoal: 0, flipOther: 0, sameAge80: 0, sameAge120: 0, latMax: [], boats: 0,
        flipSame80: 0, flipSame120: 0,
        // frame-level invitation census (0.5s-stable carrot side changes)
        invTot: 0, invAtReplan: 0, invBetween: 0, invConv: 0, invNoConv: 0,
        tacks: 0, tackAfterInv: 0, tackNoInv: 0 };
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate(({ seed, CARROT, BAND }) => {
            const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            const S = { replans: 0, trigAge: 0, trigGoal: 0, trigOther: 0,
                same80: 0, same120: 0, flips: 0, flipAge: 0, flipAgeSame80: 0, flipAgeSame120: 0,
                flipGoal: 0, flipOther: 0, sameAge80: 0, sameAge120: 0, latMax: [], boats: 0,
                flipSame80: 0, flipSame120: 0,
                invTot: 0, invAtReplan: 0, invBetween: 0, invConv: 0, invNoConv: 0,
                tacks: 0, tackAfterInv: 0, tackNoInv: 0 };
            // per-boat frame-level trackers: carrot side + hull side, 0.5s stability,
            // pending-invitation clock for the conversion census
            const trk = {};
            const carrotOf = (bo, gp) => {
                if (!gp || !gp.length) return null;
                let px = bo.x, py = bo.y, acc = 0;
                for (const q of gp) {
                    const d = Math.hypot(q.x - px, q.y - py);
                    if (acc + d >= CARROT) {
                        const f = (CARROT - acc) / (d || 1);
                        return { x: px + (q.x - px) * f, y: py + (q.y - py) * f };
                    }
                    acc += d; px = q.x; py = q.y;
                }
                return { x: px, y: py };
            };
            const segD = (px, py, ax, ay, bx, by) => {
                const dx = bx - ax, dy = by - ay; const L2 = dx * dx + dy * dy;
                let tt = L2 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0; tt = Math.max(0, Math.min(1, tt));
                return Math.hypot(px - (ax + tt * dx), py - (ay + tt * dy));
            };
            const distToPoly = (x, y, poly, ox, oy) => {
                let best = segD(x, y, ox, oy, poly[0].x, poly[0].y);
                for (let i = 0; i + 1 < poly.length; i++)
                    best = Math.min(best, segD(x, y, poly[i].x, poly[i].y, poly[i + 1].x, poly[i + 1].y));
                return best;
            };
            // max lateral offset of NEW path from OLD polyline, sampled every ~60u
            // over the shared span (up to 1200u ahead of the boat)
            const corridorOffset = (bo, newP, oldP) => {
                let px = bo.x, py = bo.y, acc = 0, next = 0, mx = 0;
                let oldLen = 0; { let ox = bo.x, oy = bo.y; for (const q of oldP) { oldLen += Math.hypot(q.x - ox, q.y - oy); ox = q.x; oy = q.y; } }
                const span = Math.min(1200, oldLen);
                for (const q of newP) {
                    const d = Math.hypot(q.x - px, q.y - py);
                    let s = 0;
                    while (acc + d >= next && next <= span) {
                        const f = d ? (next - acc) / d : 0;
                        const sx = px + (q.x - px) * f, sy = py + (q.y - py) * f;
                        mx = Math.max(mx, distToPoly(sx, sy, oldP, bo.x, bo.y));
                        next += 60; s++;
                        if (s > 40) break;
                    }
                    acc += d; px = q.x; py = q.y;
                    if (acc > span) break;
                }
                return mx;
            };
            const prev = {};
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const DT = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(DT);
                if (state.race.status !== 'racing') { if (state.race.status === 'finished') break; continue; }
                for (const bo of state.boats) {
                    if (bo.isPlayer || bo.raceState.finished) continue;
                    const c = bo.controller; if (!c || !c.gridPath) continue;
                    const wd = getWindAt(bo.x, bo.y).direction;
                    if (Math.abs(norm(bo.heading - wd)) >= 1.2) { prev[bo.name] = null; continue; }
                    const P = prev[bo.name];
                    const isNew = !P || P.ref !== c.gridPath;
                    if (isNew && P && P.snap && P.snap.length) {
                        S.replans++;
                        const trigAge = P.age >= 11.8;
                        const trigGoal = P.goal && c.gridGoal &&
                            Math.hypot(P.goal.x - c.gridGoal.x, P.goal.y - c.gridGoal.y) > 300;
                        if (trigGoal) S.trigGoal++; else if (trigAge) S.trigAge++; else S.trigOther++;
                        const carN = carrotOf(bo, c.gridPath), carO = carrotOf(bo, P.snap);
                        if (carN && carO) {
                            const lat = corridorOffset(bo, c.gridPath, P.snap);
                            S.latMax.push(lat);
                            const s80 = lat <= BAND, s120 = lat <= 120;
                            if (s80) S.same80++; if (s120) S.same120++;
                            if (trigAge && !trigGoal) { if (s80) S.sameAge80++; if (s120) S.sameAge120++; }
                            const bN = Math.atan2(carN.x - bo.x, -(carN.y - bo.y));
                            const bO = Math.atan2(carO.x - bo.x, -(carO.y - bo.y));
                            const flip = (norm(bN - wd) >= 0 ? 1 : -1) !== (norm(bO - wd) >= 0 ? 1 : -1);
                            if (flip) {
                                S.flips++;
                                if (s80) S.flipSame80++; if (s120) S.flipSame120++;
                                if (trigGoal) S.flipGoal++;
                                else if (trigAge) {
                                    S.flipAge++;
                                    if (s80) S.flipAgeSame80++; if (s120) S.flipAgeSame120++;
                                } else S.flipOther++;
                            }
                        }
                    }
                    // snapshot of the CURRENT path (copy — the array is spliced in place)
                    prev[bo.name] = { ref: c.gridPath, age: c.gridAge,
                        goal: c.gridGoal ? { x: c.gridGoal.x, y: c.gridGoal.y } : null,
                        snap: c.gridPath.map(q => ({ x: q.x, y: q.y })) };
                    // ---- frame-level invitation census (carrot side vs wind axis) ----
                    const carF = carrotOf(bo, c.gridPath);
                    if (carF) {
                        const t = it / 60;
                        const sideC = norm(Math.atan2(carF.x - bo.x, -(carF.y - bo.y)) - wd) >= 0 ? 1 : -1;
                        const sideH = norm(bo.heading - wd) >= 0 ? 1 : -1;
                        let T = trk[bo.name];
                        if (!T) T = trk[bo.name] = { c: sideC, cT: t, h: sideH, hT: t, pendInv: -1e9, lastInvT: -1e9 };
                        // carrot side change, previous side stable >= 0.5s
                        if (sideC !== T.c) {
                            if (t - T.cT >= 0.5) {
                                S.invTot++;
                                if (isNew) S.invAtReplan++; else S.invBetween++;
                                T.pendInv = t; T.lastInvT = t;
                            }
                            T.c = sideC; T.cT = t;
                        }
                        // invitation timeout BEFORE tack handling: 6s with no tack = no conversion
                        if (T.pendInv > -1e8 && t - T.pendInv > 6.0) { S.invNoConv++; T.pendInv = -1e9; }
                        // hull side change, previous side stable >= 0.5s
                        if (sideH !== T.h) {
                            if (t - T.hT >= 0.5) {
                                S.tacks++;
                                if (t - T.lastInvT <= 3.0) S.tackAfterInv++; else S.tackNoInv++;
                                if (T.pendInv > -1e8) { S.invConv++; T.pendInv = -1e9; }
                            }
                            T.h = sideH; T.hT = t;
                        }
                    }
                }
                if (state.race.status === 'racing' && state.race.timer > 895) break;
            }
            S.boats = state.boats.filter(x => !x.isPlayer).length;
            return S;
        }, { seed: SEED0 + t, CARROT, BAND });
        for (const k in r) { if (Array.isArray(r[k])) A[k].push(...r[k]); else A[k] += r[k]; }
        console.log(`seed ${SEED0 + t}: ${r.replans} beat replans (age ${r.trigAge} / goal ${r.trigGoal} / other ${r.trigOther})`);
    }
    await b.close();
    const q = (a, pp) => { if (!a.length) return NaN; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(pp * (s.length - 1))]; };
    const pc = (n, d) => `${n}/${d} (${(100 * n / (d || 1)).toFixed(1)}%)`;
    const races = TRIALS * (A.boats / TRIALS || 9);
    console.log(`\n=== ${VENUE.toUpperCase()}: THE CARROT-PIN COUNTERFACTUAL (${TRIALS} seeds, carrot ${CARROT}u, band ${BAND}u) ===`);
    console.log(`beat replans ${A.replans}   triggers: AGE ${pc(A.trigAge, A.replans)}  GOAL ${pc(A.trigGoal, A.replans)}  BLOCKED/LOST ${pc(A.trigOther, A.replans)}`);
    console.log(`\n  corridor lateral offset new-vs-old over shared span: med ${q(A.latMax, .5).toFixed(0)}u  p75 ${q(A.latMax, .75).toFixed(0)}u  p90 ${q(A.latMax, .9).toFixed(0)}u`);
    console.log(`  SAME CORRIDOR (<=${BAND}u): ${pc(A.same80, A.replans)}   (<=120u: ${pc(A.same120, A.replans)})`);
    console.log(`  age-triggered AND same-corridor: <=${BAND}u ${pc(A.sameAge80, A.replans)}  <=120u ${pc(A.sameAge120, A.replans)}  <- C1's retain population`);
    console.log(`\n  carrot WIND-SIDE FLIPS (new-path carrot vs kept-path carrot, same frame): ${pc(A.flips, A.replans)}`);
    console.log(`     by trigger: AGE ${A.flipAge}  GOAL ${A.flipGoal}  BLOCKED/LOST ${A.flipOther}`);
    console.log(`  ⭐ C1-ABSORBABLE (age-triggered, same corridor, flipped): <=${BAND}u ${pc(A.flipAgeSame80, A.replans)} of replans = ${pc(A.flipAgeSame80, A.flips)} of flips`);
    console.log(`     at <=120u: ${pc(A.flipAgeSame120, A.replans)} of replans = ${pc(A.flipAgeSame120, A.flips)} of flips`);
    console.log(`     absorbed tack invitations per boat-race: ${(A.flipAgeSame80 / races).toFixed(2)} (band ${BAND})  ${(A.flipAgeSame120 / races).toFixed(2)} (band 120)`);
    console.log(`  any-trigger same-corridor flips: <=${BAND}u ${pc(A.flipSame80, A.flips)} of flips  <=120u ${pc(A.flipSame120, A.flips)} of flips`);
    console.log(`\n=== FRAME-LEVEL INVITATION CENSUS (0.5s-stable carrot wind-side changes, beat only) ===`);
    console.log(`  invitations: ${A.invTot} total = ${(A.invTot / races).toFixed(1)}/boat-race   at-replan ${pc(A.invAtReplan, A.invTot)}  BETWEEN replans ${pc(A.invBetween, A.invTot)}`);
    console.log(`  conversion to a hull tack within 6s: ${pc(A.invConv, A.invConv + A.invNoConv)}`);
    console.log(`  hull tacks (0.5s-stable, beat): ${A.tacks} = ${(A.tacks / races).toFixed(1)}/boat-race`);
    console.log(`  ⭐ tacks preceded by an invitation within 3s: ${pc(A.tackAfterInv, A.tacks)}   without: ${pc(A.tackNoInv, A.tacks)}`);
})();
