// WHEN EVERY CANDIDATE HITS THE WALL, WHAT DOES THE FAN CHOOSE? (2026-08-11)
//
// `applyAvoidance` prices a candidate whose land ray is blocked INSIDE the hard
// zone at a flat `cost += 500000` (~4168) plus a flat 15000 liveness term (~4343).
// Both are constants: a candidate that meets rock in 20 units and one that meets
// it in 139 units score EXACTLY THE SAME. So in water narrower than the ray is
// long — redrock's slots are 100-150u across against a 180-240u ray — the veto is
// a constant added to every candidate, it cancels out of the argmin, and the
// winner is decided by the deviation term, whose minimum is offset 0. The boat
// holds the heading it already had, which is the one driving it at the rock.
//
// That is the same defect `2cbf847` fixed one layer down in the contact reflex
// ("where nothing escapes it picks the least-bad instead of a confident wrong
// answer"), and the same defect class as the deviation term being three orders
// out: a term in the wrong SHAPE, not at the wrong knee.
//
// Before building anything, measure whether the degeneracy is real and whether
// there is anything to choose between (rule 1's own test: compute the ratio
// first; and the shoal lesson — measure the perturbation, do not argue it):
//   * how often is EVERY candidate blocked inside its hard zone?
//   * on those ticks, how far does the CHOSEN heading run before it meets rock,
//     against the best any candidate offered? That difference is the REGRET, and
//     if it is a few units there is no fix here.
//   * does the boat actually ground in the next two seconds?
//
// usage: node _veto_tie.js <venue> <trials> <seed0> <tree> [cx cy r]
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
            const S = { ticks: 0, pk: 0, allBlk: 0, pkAllBlk: 0, anyBlk: 0, pkAnyBlk: 0,
                        chosenBlk: 0, pkChosenBlk: 0,
                        regret: [], pkRegret: [], chosenD: [], bestD: [], pkChosenD: [], pkBestD: [],
                        offAll: {}, groundedAfter: 0, groundedAfterN: 0, spread: [] };
            const pend = [];                    // ticks awaiting the 2s ground check
            const hit = {}; const inner = window.onRaceEvent;
            window.onRaceEvent = (ty, d) => {
                if (ty === 'collision_island' && d && d.boat && !d.boat.isPlayer) hit[d.boat.name] = (hit[d.boat.name] || 0) + 1;
                return inner && inner(ty, d);
            };
            let NOW = 0;
            window.__VETODIAG = (ctl, vd, best, desired) => {
                const bo = ctl.boat; if (!bo || bo.isPlayer || bo.raceState.finished) return;
                if (state.race.status !== 'racing') return;
                const inPk = Math.hypot(bo.x - CX, bo.y - CY) <= RR;
                S.ticks++; if (inPk) S.pk++;
                const blocked = vd.filter(c => c.sc);
                const chosenOff = norm(best - desired);
                let ch = vd[0], bd = -1, bdOff = 0;
                for (const c of vd) {
                    if (Math.abs(c.off - chosenOff) < Math.abs(ch.off - chosenOff)) ch = c;
                    if (c.d > bd) { bd = c.d; bdOff = c.off; }
                }
                if (blocked.length === vd.length) {
                    S.allBlk++; if (inPk) S.pkAllBlk++;
                    const rg = bd - ch.d;
                    S.regret.push(rg); S.chosenD.push(ch.d); S.bestD.push(bd);
                    if (inPk) { S.pkRegret.push(rg); S.pkChosenD.push(ch.d); S.pkBestD.push(bd); }
                    const ds = vd.map(c => c.d);
                    S.spread.push(Math.max(...ds) - Math.min(...ds));
                    const key = String(Math.round(bdOff * 10) / 10);
                    S.offAll[key] = (S.offAll[key] || 0) + 1;
                    pend.push({ nm: bo.name, until: NOW + 2.0, base: hit[bo.name] || 0 });
                }
                if (blocked.length) { S.anyBlk++; if (inPk) S.pkAnyBlk++; }
                if (ch.sc) { S.chosenBlk++; if (inPk) S.pkChosenBlk++; }
            };
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const DT = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) {
                NOW += DT;
                window.update(DT);
                for (let i = pend.length - 1; i >= 0; i--) {
                    if (NOW < pend[i].until) continue;
                    S.groundedAfterN++;
                    if ((hit[pend[i].nm] || 0) > pend[i].base) S.groundedAfter++;
                    pend.splice(i, 1);
                }
                if (state.race.status === 'finished') break;
                if (state.race.status === 'racing' && state.race.timer > 895) break;
            }
            window.__VETODIAG = null;
            return S;
        }, { seed: SEED0 + t, CX, CY, RR });
        for (const k in r) {
            if (Array.isArray(r[k])) (A[k] || (A[k] = [])).push(...r[k]);
            else if (typeof r[k] === 'object') { A[k] = A[k] || {}; for (const q in r[k]) A[k][q] = (A[k][q] || 0) + r[k][q]; }
            else A[k] = (A[k] || 0) + r[k];
        }
        console.log(`seed ${SEED0 + t}: ${r.ticks} avoidance ticks, ${r.allBlk} fully vetoed`);
    }
    await b.close();

    const q = (a, pp) => { if (!a.length) return NaN; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(pp * (s.length - 1))]; };
    const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
    const P = (x, n) => `${x} (${(100 * x / n).toFixed(1)}%)`;
    console.log(`\n=== ${VENUE.toUpperCase()}: THE FAN'S BLIND TIE (${TRIALS} seeds) ===`);
    console.log(`avoidance ticks ${A.ticks}   in pocket (${CX},${CY}) r=${RR}: ${A.pk}`);
    console.log(`\n  at least one candidate vetoed   ${P(A.anyBlk, A.ticks)}      in pocket ${P(A.pkAnyBlk, A.pk)}`);
    console.log(`  the CHOSEN candidate vetoed     ${P(A.chosenBlk, A.ticks)}      in pocket ${P(A.pkChosenBlk, A.pk)}`);
    console.log(`  ⭐ EVERY candidate vetoed        ${P(A.allBlk, A.ticks)}      in pocket ${P(A.pkAllBlk, A.pk)}`);
    console.log(`\n  ON FULLY-VETOED TICKS — how far the ray runs before it meets rock:`);
    console.log(`     chosen   med ${q(A.chosenD, .5).toFixed(0)}u  mean ${mean(A.chosenD).toFixed(0)}u`);
    console.log(`     best     med ${q(A.bestD, .5).toFixed(0)}u  mean ${mean(A.bestD).toFixed(0)}u`);
    console.log(`     ⭐ REGRET med ${q(A.regret, .5).toFixed(0)}u  mean ${mean(A.regret).toFixed(0)}u  p75 ${q(A.regret, .75).toFixed(0)}u  p90 ${q(A.regret, .9).toFixed(0)}u`);
    console.log(`     spread across the fan  med ${q(A.spread, .5).toFixed(0)}u  p90 ${q(A.spread, .9).toFixed(0)}u`);
    if (A.pkRegret && A.pkRegret.length) {
        console.log(`     IN POCKET: chosen med ${q(A.pkChosenD, .5).toFixed(0)}u  best med ${q(A.pkBestD, .5).toFixed(0)}u  regret med ${q(A.pkRegret, .5).toFixed(0)}u mean ${mean(A.pkRegret).toFixed(0)}u`);
    }
    console.log(`\n  land contact within 2s of a fully-vetoed tick: ${A.groundedAfter}/${A.groundedAfterN} (${(100 * A.groundedAfter / (A.groundedAfterN || 1)).toFixed(1)}%)`);
    const offs = Object.entries(A.offAll).sort((a, c) => c[1] - a[1]).slice(0, 8);
    console.log(`  which offset had the LONGEST run on fully-vetoed ticks: ` +
        offs.map(([k, v]) => `${k}:${(100 * v / A.allBlk).toFixed(0)}%`).join('  '));
})();
