// WHY DOES THE PLAN CHANGE? THE ICE, OR THE SEARCH? (2026-08-11, arctic)
//
// `_carrot_jump.js`: across 521 beat replans, the steering carrot moves a median
// 127u (p90 475u) beyond the boat's own advance, its bearing swings a median 15deg
// (p90 99deg), and on 19.6% of replans it crosses TO THE OTHER SIDE OF THE WIND —
// an unsolicited tack invitation, ~2.8 per boat per race, from the router
// re-picking rather than from tactics. And `_board_gap.js` has already shown the
// aimed-at gap is still clear on 98.6% of arrivals, so the ice is not what makes
// her give up.
//
// A replan can differ from its predecessor for two very different reasons:
//   THE WORLD MOVED — the boat advanced, or floes drifted and genuinely changed
//                     which gap is best. Re-picking is then correct.
//   THE SEARCH IS UNSTABLE — the same question, asked again, returns a different
//                     answer, because an A* over a near-tie picks whichever
//                     equal-cost cell it happened to pop first. Then the tack
//                     invitation is an artefact and the fix is in the search.
//
// Separate them by asking the CURRENT grid the OLD question: re-run
// `pathSailable` from the PREVIOUS replan's start point on the grid as it is NOW.
//   * if that reproduces the old path, the ice did not change the answer, and the
//     new plan differs only because the boat moved
//   * if it reproduces the NEW path's shape, the ice really did change it
// Reported as the carrot each variant implies, so the numbers are commensurable
// with `_carrot_jump`.
//
// usage: node _replan_why.js <venue> <trials> <seed0> <tree> [carrot]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'arctic';
const TRIALS = parseInt(process.argv[3]) || 4;
const SEED0 = parseInt(process.argv[4]) || 9101;
const ROOT = path.join(__dirname, process.argv[5] || 'treeHD12');
const CARROT = parseFloat(process.argv[6]) || 420;

(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    const A = { n: 0, sameOld: 0, movedIce: 0, flip: 0, flipSameOld: 0, dOld: [], dNew: [] };
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate(({ seed, CARROT }) => {
            const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            const S = { n: 0, sameOld: 0, movedIce: 0, flip: 0, flipSameOld: 0, dOld: [], dNew: [] };
            // carrot from an explicit start point along an explicit polyline
            const carrotFrom = (sx, sy, pts) => {
                if (!pts || !pts.length) return null;
                let px = sx, py = sy, acc = 0;
                for (const q of pts) {
                    const qx = q.x !== undefined ? q.x : q[0], qy = q.y !== undefined ? q.y : q[1];
                    const d = Math.hypot(qx - px, qy - py);
                    if (acc + d >= CARROT) {
                        const f = (CARROT - acc) / (d || 1);
                        return { x: px + (qx - px) * f, y: py + (qy - py) * f };
                    }
                    acc += d; px = qx; py = qy;
                }
                return { x: px, y: py };
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
                    const c = bo.controller; if (!c || !c.gridPath || !c.gridPath.length) continue;
                    const wd = getWindAt(bo.x, bo.y).direction;
                    if (Math.abs(norm(bo.heading - wd)) >= 1.2) { prev[bo.name] = null; continue; }
                    const P = prev[bo.name];
                    if (P && P.ref === c.gridPath) continue;          // no replan this frame
                    const dest = c.finalTarget || (c.gridPath[c.gridPath.length - 1]);
                    if (P && P.pts && dest && window.SailCheck && state.course.botGrid) {
                        // THE OLD QUESTION, ON TODAY'S GRID
                        const seg = window.SailCheck.pathSailable(state.course.botGrid,
                            [P.bx, P.by], [dest.x, dest.y]);
                        if (seg && seg.length > 1) {
                            const reask = seg.slice(1).map(q => ({ x: q[0], y: q[1] }));
                            const cOldNow = carrotFrom(P.bx, P.by, reask);
                            const cOldThen = P.car;                    // carrot when it was planned
                            const cNew = carrotFrom(bo.x, bo.y, c.gridPath);
                            if (cOldNow && cOldThen && cNew) {
                                S.n++;
                                const dO = Math.hypot(cOldNow.x - cOldThen.x, cOldNow.y - cOldThen.y);
                                S.dOld.push(dO);
                                const b0 = Math.atan2(cOldThen.x - bo.x, -(cOldThen.y - bo.y));
                                const b1 = Math.atan2(cNew.x - bo.x, -(cNew.y - bo.y));
                                const s0 = norm(b0 - wd) >= 0 ? 1 : -1, s1 = norm(b1 - wd) >= 0 ? 1 : -1;
                                const flipped = s0 !== s1;
                                if (flipped) S.flip++;
                                // did asking the OLD question today reproduce the OLD answer?
                                if (dO < 80) { S.sameOld++; if (flipped) S.flipSameOld++; }
                                else S.movedIce++;
                                S.dNew.push(Math.hypot(cNew.x - cOldThen.x, cNew.y - cOldThen.y));
                            }
                        }
                    }
                    prev[bo.name] = { ref: c.gridPath, pts: c.gridPath, bx: bo.x, by: bo.y,
                                      car: carrotFrom(bo.x, bo.y, c.gridPath) };
                }
                if (state.race.status === 'racing' && state.race.timer > 895) break;
            }
            return S;
        }, { seed: SEED0 + t, CARROT });
        for (const k in r) { if (Array.isArray(r[k])) A[k].push(...r[k]); else A[k] += r[k]; }
        console.log(`seed ${SEED0 + t}: ${r.n} replans re-asked`);
    }
    await b.close();

    const q = (a, pp) => { if (!a.length) return NaN; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(pp * (s.length - 1))]; };
    console.log(`\n=== ${VENUE.toUpperCase()}: DID THE ICE CHANGE THE ANSWER, OR THE SEARCH? (${TRIALS} seeds) ===`);
    console.log(`replans re-asked from the previous start point on TODAY's grid: ${A.n}`);
    console.log(`\n  carrot from the OLD question asked TODAY, vs the carrot it gave THEN:`);
    console.log(`     med ${q(A.dOld, .5).toFixed(0)}u  p75 ${q(A.dOld, .75).toFixed(0)}u  p90 ${q(A.dOld, .9).toFixed(0)}u`);
    console.log(`  ⭐ THE ICE DID NOT CHANGE THE ANSWER (same within 80u) on ${A.sameOld}/${A.n} (${(100 * A.sameOld / (A.n || 1)).toFixed(1)}%)`);
    console.log(`     the ice DID change it on ${A.movedIce}/${A.n} (${(100 * A.movedIce / (A.n || 1)).toFixed(1)}%)`);
    console.log(`\n  carrot moved by the replan overall: med ${q(A.dNew, .5).toFixed(0)}u  p90 ${q(A.dNew, .9).toFixed(0)}u`);
    console.log(`  side-of-wind flips: ${A.flip}/${A.n} (${(100 * A.flip / (A.n || 1)).toFixed(1)}%)`);
    console.log(`  ⭐ of those flips, ${A.flipSameOld} (${(100 * A.flipSameOld / (A.flip || 1)).toFixed(1)}%) happened while the ice had NOT`);
    console.log(`     changed the answer — those are the boat's own advance plus search tie-breaks,`);
    console.log(`     not new information about the pack.`);
})();
