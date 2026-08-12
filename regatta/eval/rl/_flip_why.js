// LEAD A, THE MEASUREMENT BEFORE THE BUILD (2026-08-11, arctic push)
//
// `_carrot_jump` says the 12s staleness rebuild moves the steering carrot to the
// OTHER SIDE OF THE WIND on 19.6% of beat replans — ~2.8 unsolicited tack
// invitations per boat-race. `_replan_why` says asking the CURRENT grid the OLD
// question reproduces the old answer within 80u on 49.2% of replans, i.e. half of
// them learn nothing about static blockage. `treeAGE` proved you cannot just skip
// the rebuild (arctic −27 mean, finishers 575→545; redrock +13.2, 432→422).
//
// The plan's open question is the CROSS-TAB: of the flips, how many happen when
// the ice HAD changed the answer (the flip is then earned) and how many when it
// had not (the flip is gratuitous)?
//
// ⚠️ THE TWO PROBES' FLIP RATES ARE NOT COMPARABLE and the plan says so
// explicitly. `_carrot_jump` re-references EVERY FRAME so the boat's own advance
// is ~0 — that is the honest 19.6%. `_replan_why` re-references only on replan
// frames, so its baseline is 2-3s old and carries 200-300u of the boat's advance.
// THIS PROBE CARRIES BOTH REFERENCES AT ONCE: the per-frame one for the flip test
// (honest), the per-replan one for the re-ask (same question, same start point).
//
// It also asks the more direct static question: is the OLD PATH ITSELF still
// sailable on today's grid? A rebuild whose predecessor is still clear end to end
// has learned nothing about blockage no matter what the carrot did.
//
// usage: node _flip_why.js <venue> <trials> <seed0> <tree> [carrot]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'arctic';
const TRIALS = parseInt(process.argv[3]) || 4;
const SEED0 = parseInt(process.argv[4]) || 9100;
const ROOT = path.join(__dirname, process.argv[5] || 'treeARCB');
const CARROT = parseFloat(process.argv[6]) || 420;

(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    const A = { n: 0, flip: 0, sameOld: 0, flipSame: 0, flipMoved: 0, oldClear: 0,
                flipOldClear: 0, noflipOldClear: 0, dOld: [], jump: [] };
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate(({ seed, CARROT }) => {
            const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            const S = { n: 0, flip: 0, sameOld: 0, flipSame: 0, flipMoved: 0, oldClear: 0,
                        flipOldClear: 0, noflipOldClear: 0, dOld: [], jump: [] };
            const carrotFrom = (sx, sy, pts) => {
                if (!pts || !pts.length) return null;
                let px = sx, py = sy, acc = 0;
                for (const q of pts) {
                    const qx = q.x !== undefined ? q.x : q[0], qy = q.y !== undefined ? q.y : q[1];
                    const d = Math.hypot(qx - px, qy - py);
                    if (acc + d >= CARROT) { const f = (CARROT - acc) / (d || 1); return { x: px + (qx - px) * f, y: py + (qy - py) * f }; }
                    acc += d; px = qx; py = qy;
                }
                return { x: px, y: py };
            };
            // is every cell along a polyline still navigable on TODAY's grid?
            const stillClear = (pts, sx, sy) => {
                const g = state.course.botGrid; if (!g) return null;
                let px = sx, py = sy;
                for (const q of pts) {
                    const qx = q.x !== undefined ? q.x : q[0], qy = q.y !== undefined ? q.y : q[1];
                    const L = Math.hypot(qx - px, qy - py), steps = Math.max(1, Math.ceil(L / 40));
                    for (let i = 1; i <= steps; i++) {
                        const cx = px + (qx - px) * i / steps, cy = py + (qy - py) * i / steps;
                        const cc = g.cell(cx, cy);
                        if (!g.at(cc[0], cc[1])) return 0;
                    }
                    px = qx; py = qy;
                }
                return 1;
            };
            const prevF = {}, prevR = {};
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const DT = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(DT);
                if (state.race.status !== 'racing') { if (state.race.status === 'finished') break; continue; }
                for (const bo of state.boats) {
                    if (bo.isPlayer || bo.raceState.finished) continue;
                    const c = bo.controller; if (!c || !c.gridPath || !c.gridPath.length) continue;
                    const wd = getWindAt(bo.x, bo.y).direction;
                    if (Math.abs(norm(bo.heading - wd)) >= 1.2) { prevF[bo.name] = null; prevR[bo.name] = null; continue; }
                    const F = prevF[bo.name], R = prevR[bo.name];
                    const isNew = !F || F.ref !== c.gridPath;
                    const cNew = carrotFrom(bo.x, bo.y, c.gridPath);
                    if (isNew && F && F.car && R && R.pts && cNew) {
                        S.n++;
                        // (1) HONEST FLIP TEST — reference is LAST FRAME's carrot
                        const b0 = Math.atan2(F.car.x - bo.x, -(F.car.y - bo.y));
                        const b1 = Math.atan2(cNew.x - bo.x, -(cNew.y - bo.y));
                        const s0 = norm(b0 - wd) >= 0 ? 1 : -1, s1 = norm(b1 - wd) >= 0 ? 1 : -1;
                        const flipped = s0 !== s1;
                        if (flipped) S.flip++;
                        S.jump.push(Math.max(0, Math.hypot(cNew.x - F.car.x, cNew.y - F.car.y) - Math.hypot(bo.x - F.bx, bo.y - F.by)));
                        // (2) THE OLD QUESTION, ON TODAY'S GRID — same start point
                        let same = null;
                        const dest = c.finalTarget || c.gridPath[c.gridPath.length - 1];
                        if (window.SailCheck && state.course.botGrid && dest) {
                            const seg = window.SailCheck.pathSailable(state.course.botGrid, [R.bx, R.by], [dest.x, dest.y]);
                            if (seg && seg.length > 1) {
                                const reask = seg.slice(1).map(q => ({ x: q[0], y: q[1] }));
                                const cOldNow = carrotFrom(R.bx, R.by, reask);
                                if (cOldNow && R.car) {
                                    const dO = Math.hypot(cOldNow.x - R.car.x, cOldNow.y - R.car.y);
                                    S.dOld.push(dO); same = dO < 80;
                                }
                            }
                        }
                        // (3) DIRECT STATIC TEST — is the superseded path itself still clear?
                        const clr = stillClear(F.pts, bo.x, bo.y);
                        if (clr === 1) { S.oldClear++; if (flipped) S.flipOldClear++; else S.noflipOldClear++; }
                        if (same !== null) {
                            if (same) { S.sameOld++; if (flipped) S.flipSame++; }
                            else if (flipped) S.flipMoved++;
                        }
                    }
                    if (isNew) prevR[bo.name] = { pts: c.gridPath, bx: bo.x, by: bo.y, car: cNew };
                    prevF[bo.name] = { ref: c.gridPath, pts: c.gridPath, car: cNew, bx: bo.x, by: bo.y };
                }
                if (state.race.status === 'racing' && state.race.timer > 895) break;
            }
            return S;
        }, { seed: SEED0 + t, CARROT });
        for (const k in r) { if (Array.isArray(r[k])) A[k].push(...r[k]); else A[k] += r[k]; }
        console.log(`seed ${SEED0 + t}: ${r.n} beat replans, ${r.flip} flips`);
    }
    await b.close();
    const q = (a, pp) => { if (!a.length) return NaN; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(pp * (s.length - 1))]; };
    const pc = (x, d) => `${x} (${(100 * x / (d || 1)).toFixed(1)}%)`;
    console.log(`\n=== ${VENUE.toUpperCase()}: ARE THE CARROT FLIPS EARNED? (${TRIALS} seeds, carrot ${CARROT}u) ===`);
    console.log(`beat replans ${A.n}`);
    console.log(`  carrot jump beyond the boat's advance: med ${q(A.jump, .5).toFixed(0)}u  p90 ${q(A.jump, .9).toFixed(0)}u`);
    console.log(`  ⭐ HONEST side flips (per-frame reference): ${pc(A.flip, A.n)}`);
    console.log(`\n  re-asking the OLD question on TODAY's grid (same start point):`);
    console.log(`     answer UNCHANGED (<80u): ${pc(A.sameOld, A.n)}   carrot-move med ${q(A.dOld, .5).toFixed(0)}u p90 ${q(A.dOld, .9).toFixed(0)}u`);
    console.log(`  ⭐⭐ CROSS-TAB — of the ${A.flip} flips:`);
    console.log(`     the ice HAD NOT changed the answer: ${pc(A.flipSame, A.flip)}   <- GRATUITOUS`);
    console.log(`     the ice HAD changed the answer:     ${pc(A.flipMoved, A.flip)}   <- earned`);
    console.log(`\n  DIRECT static test — the SUPERSEDED path is still fully clear on today's grid:`);
    console.log(`     ${pc(A.oldClear, A.n)} of all replans`);
    console.log(`     of the flips: ${pc(A.flipOldClear, A.flip)}   of the non-flips: ${pc(A.noflipOldClear, A.n - A.flip)}`);
})();
