// DID THE GAP IT AIMED AT STILL EXIST WHEN IT GOT THERE? (2026-08-11, arctic)
//
// This is the measurement [[regatta-arctic-tackcount]] asked for and nobody ran.
// Eight shapes have died against arctic's beat (AC1, TK1, TK2, TK3, LANE1, LANE2
// and two clearance-extension kills). Every one of them moved the statistic it
// aimed at and none moved the clock, and the memory's own conclusion was: his 5
// tacks are not a smoothed 21, they are JUDGEMENT ABOUT WHICH GAPS WILL STILL BE
// THERE ON ARRIVAL, on a field `_drift_pred`/[[regatta-map-staleness]] showed is
// unpredictable past ~5s. "The next shape is about WHEN TO COMMIT, and it must
// start as a measurement."
//
// `_gap_grid` has since said the same thing from the other end: 75% of arctic's
// positive gap is water he NEVER ENTERS, against 25% on redrock — a distance
// venue, not an execution venue.
//
// A BOARD = a run between manoeuvres (the boat's tack side relative to the wind
// stays constant). For each board:
//   * where was she aiming at the START — the steering carrot, the point ~420u
//     down her own gridPath, which `_tk_probe` measured as the thing the tack
//     scorer actually optimises
//   * was that water OPEN then, on the floe-stamped grid the router uses
//   * when she gets there (or when the board ends), is it STILL open
//   * how long the board lasted, and whether it ended because she arrived or
//     because she tacked away
//
// The distinction that matters: if the aimed-at gap is nearly always still open,
// commitment timing is NOT the lever and the staircase is just longer than his
// line for some other reason. If it closes often, then re-deciding at the 5s
// cooldown floor is rational behaviour in a stale world and the fix has to be
// about picking gaps that PERSIST, not about tacking less.
//
// usage: node _board_gap.js <venue> <trials> <seed0> <tree> [carrot]
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

    const A = { boards: [], noPlan: 0 };
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate(({ seed, CARROT }) => {
            const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            const S = { boards: [], noPlan: 0 };
            const cur = {};
            // the point CARROT units down the boat's own plan, walked properly
            const carrotOf = (bo, c) => {
                const gp = c.gridPath; if (!gp || !gp.length) return null;
                let px = bo.x, py = bo.y, acc = 0;
                for (const q of gp) {
                    const d = Math.hypot(q.x - px, q.y - py);
                    if (acc + d >= CARROT) {
                        const f = (CARROT - acc) / (d || 1);
                        return { x: px + (q.x - px) * f, y: py + (q.y - py) * f };
                    }
                    acc += d; px = q.x; py = q.y;
                }
                return { x: px, y: py };     // plan shorter than the carrot
            };
            const openAt = (pt) => {
                const g = state.course.botGrid; if (!g || !pt) return null;
                const cc = g.cell(pt.x, pt.y);
                if (!g.at(cc[0], cc[1])) return 0;                 // blocked outright
                const id = cc[1] * g.n + cc[0];
                if (g._soft && g._soft[id]) return 1;              // plugged: grindable
                return 2;                                          // clear
            };
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const DT = 1 / 60; let now = 0;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(DT); now += DT;
                if (state.race.status !== 'racing') { if (state.race.status === 'finished') break; continue; }
                for (const bo of state.boats) {
                    if (bo.isPlayer || bo.raceState.finished) continue;
                    const c = bo.controller; if (!c) continue;
                    const wd = getWindAt(bo.x, bo.y).direction;
                    const twa = norm(bo.heading - wd);
                    const side = twa >= 0 ? 1 : -1;
                    const beating = Math.abs(twa) < 1.2;    // upwind-ish only
                    let B = cur[bo.name];
                    if (B && Math.abs(twa) < 0.62) B.sawIrons = 1;
                    if (B && ((B.side !== side && B.sawIrons) || !beating)) {
                        // board ended
                        B.dur = now - B.t0;
                        B.sailed = Math.hypot(bo.x - B.x0, bo.y - B.y0);
                        B.endOpen = openAt(B.aim);
                        B.arrived = B.aim ? (Math.hypot(bo.x - B.aim.x, bo.y - B.aim.y) < 80 ? 1 : 0) : 0;
                        B.closeAtEnd = B.aim ? Math.hypot(bo.x - B.aim.x, bo.y - B.aim.y) : null;
                        if (B.dur >= 1.0 && B.aim) S.boards.push(B);
                        B = null; delete cur[bo.name];
                    }
                    if (!B && beating) {
                        const aim = carrotOf(bo, c);
                        if (!aim) { S.noPlan++; continue; }
                        cur[bo.name] = { t0: now, x0: bo.x, y0: bo.y, side, aim, sawIrons: 0,
                                         startOpen: openAt(aim), reached: 0, reachOpen: null };
                        continue;
                    }
                    if (B && B.aim && !B.reached && Math.hypot(bo.x - B.aim.x, bo.y - B.aim.y) < 80) {
                        B.reached = now - B.t0; B.reachOpen = openAt(B.aim);
                    }
                }
                if (state.race.status === 'racing' && state.race.timer > 895) break;
            }
            return S;
        }, { seed: SEED0 + t, CARROT });
        A.boards.push(...r.boards); A.noPlan += r.noPlan;
        console.log(`seed ${SEED0 + t}: ${r.boards.length} boards`);
    }
    await b.close();

    const q = (a, pp) => { if (!a.length) return NaN; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(pp * (s.length - 1))]; };
    const B = A.boards, n = B.length || 1;
    const P = (x) => `${x} (${(100 * x / n).toFixed(1)}%)`;
    console.log(`\n=== ${VENUE.toUpperCase()}: DID THE AIMED-AT GAP SURVIVE? (${TRIALS} seeds, carrot ${CARROT}u) ===`);
    console.log(`boards on the beat: ${B.length}   dur med ${q(B.map(x => x.dur), .5).toFixed(1)}s  p90 ${q(B.map(x => x.dur), .9).toFixed(1)}s`);
    console.log(`distance made good per board: med ${q(B.map(x => x.sailed), .5).toFixed(0)}u  p90 ${q(B.map(x => x.sailed), .9).toFixed(0)}u   (carrot is ${CARROT}u out)`);
    const started = B.filter(x => x.startOpen === 2);
    console.log(`\n  AT THE START OF THE BOARD the aimed-at cell was: clear ${P(B.filter(x => x.startOpen === 2).length)}  plugged ${P(B.filter(x => x.startOpen === 1).length)}  blocked ${P(B.filter(x => x.startOpen === 0).length)}`);
    const reached = B.filter(x => x.reached);
    console.log(`  she REACHED that point on ${P(reached.length)} of boards (within 80u), after med ${q(reached.map(x => x.reached), .5).toFixed(1)}s`);
    if (reached.length) {
        const ok = reached.filter(x => x.reachOpen === 2).length;
        const st = reached.filter(x => x.startOpen === 2);
        const stOk = st.filter(x => x.reachOpen === 2).length;
        console.log(`  ⭐ of the boards she reached, the cell was still CLEAR on ${(100 * ok / reached.length).toFixed(1)}%`);
        console.log(`     restricted to boards that started CLEAR (n=${st.length}): still clear on ${(100 * stOk / (st.length || 1)).toFixed(1)}%  ⇒ CLOSED on ${(100 * (st.length - stOk) / (st.length || 1)).toFixed(1)}%`);
    }
    const bail = B.filter(x => !x.reached);
    console.log(`  she TACKED AWAY before arriving on ${P(bail.length)}, still med ${q(bail.map(x => x.closeAtEnd), .5).toFixed(0)}u short`);
    if (bail.length) {
        const st = bail.filter(x => x.startOpen === 2);
        const stillOk = st.filter(x => x.endOpen === 2).length;
        console.log(`     of those that started CLEAR (n=${st.length}), the aimed-at cell was STILL clear when she gave up: ${(100 * stillOk / (st.length || 1)).toFixed(1)}%`);
    }
    console.log(`\n  (frames with no plan at all: ${A.noPlan})`);
})();
