// WOULD A TURN-LIMITED ROLLOUT HAVE SEEN IT COMING? (2026-08-11, redrock)
//
// `_track_vs_ray.js` measured the defect: 16.3% of avoidance decisions whose
// chosen land ray reads CLEAR run the boat into land inside that ray's own
// length (47.8% inside the sw-inlet pocket), the realized track strays a median
// 62u / p90 186u from the graded ray, and the failure rate is monotone in the
// size of the turn the fan asked for — 4.6% / 9.8% / 16.8% / 25.3% / 42.8%
// across turn bins 0.15 / 0.35 / 0.70 / 1.20 / 1.20+ rad.
//
// ⚠️ THAT IS A CORRELATION AND IT HAS AN OBVIOUS CONFOUNDER: the fan asks for
// big turns in dangerous water, and boats in dangerous water ground. A dose
// response in "how hard did she swerve" is exactly what danger itself would
// produce. So the claim "the ray is the wrong shape" only survives if a probe
// of the RIGHT shape actually PREDICTS the groundings the ray misses.
//
// This computes, for every candidate on every tick, two verdicts over the same
// distance and the same grid:
//   RAY  — straight from the boat along the candidate heading (what ships)
//   ARC  — the boat's own achievable turn: heading slews toward the candidate at
//          getTurnSpeed()*60*(1+handling*0.03)*steerageFactor (x5 while the
//          contact reflex is latched, per ~11740), speed as the fan's own
//          `speed`, then straight once the slew completes
// ...and then follows the boat to see which verdict was right.
//
// This is rule 19c's own prescription — "curvature in a probe needs the boat's
// own achievable turn as its ceiling" — and the thing that rule killed was the
// PLAN's curvature, which is a different quantity.
//
// The number that decides whether to build: among decisions the ray calls clear
// and the arc calls blocked, how often does the boat actually ground, versus the
// base rate where both call it clear. If those are the same, the arc is adding
// noise and this is dead.
//
// usage: node _arc_predict.js <venue> <trials> <seed0> <tree> [cx cy r]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'redrock';
const TRIALS = parseInt(process.argv[3]) || 4;
const SEED0 = parseInt(process.argv[4]) || 9400;
const ROOT = path.join(__dirname, process.argv[5] || 'treeVETO');
const CX = process.argv[6] !== undefined ? parseFloat(process.argv[6]) : -1075;
const CY = process.argv[7] !== undefined ? parseFloat(process.argv[7]) : -1400;
const RR = process.argv[8] !== undefined ? parseFloat(process.argv[8]) : 250;

(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    const A = {};
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate(({ seed, CX, CY, RR }) => {
            const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            const S = { n: 0, cc: 0, cb: 0, bc: 0, bb: 0, ccG: 0, cbG: 0, bcG: 0, bbG: 0,
                        pkN: 0, pkCB: 0, pkCBG: 0, pkCC: 0, pkCCG: 0,
                        altN: 0, altHave: 0, arcBlkAll: 0, dArc: [] };
            const live = {};
            // turn-limited rollout: does the boat's own achievable track stay in water?
            const arcClear = (bo, ctl, h, len, g) => {
                const v = Math.max(2.0, (bo.speed || 0) * 60);
                let om = 0.015 * 60 * (1.0 + bo.stats.handling * 0.03);
                const kn = (bo.speed || 0) / 0.25;
                om *= Math.min(1.0, Math.max(0.6, 0.6 + 0.4 * (kn / 3.5)));
                if (ctl && (ctl.wiggleActive || ctl.escActive || (ctl.iceEscapeTimer > 0 && !ctl.penaltySpin))) {
                    om = 0.015 * 60 * (1.0 + bo.stats.handling * 0.03) * 5.0;
                }
                const perU = om / v;                       // radians per unit sailed
                const STEPS = 16, ds = len / STEPS;
                let hh = bo.heading, x = bo.x, y = bo.y;
                for (let i = 0; i < STEPS; i++) {
                    const dh = norm(h - hh);
                    hh = norm(hh + Math.sign(dh) * Math.min(Math.abs(dh), perU * ds));
                    x += Math.sin(hh) * ds; y += -Math.cos(hh) * ds;
                    const cc = g.cell(x, y);
                    if (!g.at(cc[0], cc[1])) return (i + 1) * ds;   // distance to first block
                }
                return null;                                        // clear
            };
            window.__VETODIAG = (ctl, vd, best, desired) => {
                const bo = ctl.boat; if (!bo || bo.isPlayer || bo.raceState.finished) return;
                if (state.race.status !== 'racing') return;
                const g = state.course.botGrid; if (!g) return;
                const chosenOff = norm(best - desired);
                let ch = vd[0];
                for (const c of vd) if (Math.abs(c.off - chosenOff) < Math.abs(ch.off - chosenOff)) ch = c;
                if (ch.sl == null) return;
                const rayClear = ch.d >= ch.sl - 0.5;
                const aBlk = arcClear(bo, ctl, best, ch.sl, g);
                const arcC = aBlk === null;
                const inPk = Math.hypot(bo.x - CX, bo.y - CY) <= RR;
                // is there ANY candidate that both verdicts like? (is a fix available?)
                if (rayClear && !arcC) {
                    S.altN++;
                    let have = 0;
                    for (const c of vd) {
                        if (c.sc || c.d < c.sl - 0.5) continue;
                        if (arcClear(bo, ctl, norm(desired + c.off), c.sl, g) === null) { have = 1; break; }
                    }
                    S.altHave += have;
                    if (!have) S.arcBlkAll++;
                    if (aBlk !== null) S.dArc.push(aBlk);
                }
                if (live[bo.name]) return;
                live[bo.name] = { rayClear, arcC, inPk, len: ch.sl, s: 0, lx: bo.x, ly: bo.y, hit: 0 };
            };
            const finish = (nm) => {
                const L = live[nm]; if (!L) return; delete live[nm];
                S.n++;
                const key = (L.rayClear ? 'c' : 'b') + (L.arcC ? 'c' : 'b');
                S[key]++; if (L.hit) S[key + 'G']++;
                if (L.inPk) {
                    S.pkN++;
                    if (L.rayClear && !L.arcC) { S.pkCB++; if (L.hit) S.pkCBG++; }
                    if (L.rayClear && L.arcC) { S.pkCC++; if (L.hit) S.pkCCG++; }
                }
            };
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const DT = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(DT);
                if (state.race.status !== 'racing') { if (state.race.status === 'finished') break; continue; }
                const g = state.course.botGrid;
                for (const bo of state.boats) {
                    const L = live[bo.name]; if (!L) continue;
                    if (bo.raceState.finished) { finish(bo.name); continue; }
                    L.s += Math.hypot(bo.x - L.lx, bo.y - L.ly); L.lx = bo.x; L.ly = bo.y;
                    if (g && !L.hit) { const cc = g.cell(bo.x, bo.y); if (!g.at(cc[0], cc[1])) L.hit = 1; }
                    if (L.s >= L.len) finish(bo.name);
                }
                if (state.race.status === 'racing' && state.race.timer > 895) break;
            }
            for (const nm in live) finish(nm);
            window.__VETODIAG = null;
            return S;
        }, { seed: SEED0 + t, CX, CY, RR });
        for (const k in r) { if (Array.isArray(r[k])) (A[k] || (A[k] = [])).push(...r[k]); else A[k] = (A[k] || 0) + r[k]; }
        console.log(`seed ${SEED0 + t}: ${r.n} followed; ray-clear/arc-blocked ${r.cb} of which grounded ${r.cbG}`);
    }
    await b.close();

    const pct = (a, n) => n ? (100 * a / n).toFixed(1) + '%' : '-';
    console.log(`\n=== ${VENUE.toUpperCase()}: DOES THE TURN-LIMITED ARC PREDICT THE GROUNDING? (${TRIALS} seeds) ===`);
    console.log(`followed decisions ${A.n}\n`);
    console.log(`  RAY      ARC        n        grounded within the probe's own length`);
    console.log(`  clear    clear   ${String(A.cc).padStart(6)}   ${String(A.ccG).padStart(5)}  ${pct(A.ccG, A.cc)}     <- base rate`);
    console.log(`  clear    BLOCKED ${String(A.cb).padStart(6)}   ${String(A.cbG).padStart(5)}  ${pct(A.cbG, A.cb)}     <- ⭐ what the ray misses`);
    console.log(`  BLOCKED  clear   ${String(A.bc).padStart(6)}   ${String(A.bcG).padStart(5)}  ${pct(A.bcG, A.bc)}`);
    console.log(`  BLOCKED  BLOCKED ${String(A.bb).padStart(6)}   ${String(A.bbG).padStart(5)}  ${pct(A.bbG, A.bb)}`);
    const lift = (A.cb ? A.cbG / A.cb : 0) / (A.cc ? A.ccG / A.cc : 1);
    console.log(`\n  ⭐ LIFT: a decision the ray likes and the arc rejects grounds ${lift.toFixed(2)}x as often as one both like.`);
    console.log(`  IN POCKET: ray-clear/arc-blocked ${A.pkCB} grounded ${pct(A.pkCBG, A.pkCB)}   |   both-clear ${A.pkCC} grounded ${pct(A.pkCCG, A.pkCC)}`);
    console.log(`\n  IS A FIX AVAILABLE? on ${A.altN} ray-clear/arc-blocked candidate evaluations,`);
    console.log(`     another candidate was clear on BOTH verdicts: ${A.altHave} (${pct(A.altHave, A.altN)})`);
    console.log(`     no candidate survived the arc at all:         ${A.arcBlkAll} (${pct(A.arcBlkAll, A.altN)})`);
    if (A.dArc && A.dArc.length) {
        const s = A.dArc.slice().sort((x, y) => x - y);
        console.log(`     where the arc meets rock: med ${s[Math.floor(s.length / 2)].toFixed(0)}u  p10 ${s[Math.floor(0.1 * s.length)].toFixed(0)}u`);
    }
})();
