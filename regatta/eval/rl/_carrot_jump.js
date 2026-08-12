// IS THE BEAT'S STEERING TARGET BEING MOVED BY THE REPLAN CLOCK? (2026-08-11)
//
// `_board_gap.js` just falsified the campaign's standing explanation for arctic's
// tack count: the gap the boat aims at is still clear on 98.6% of the boards she
// reaches, and she abandons 72.2% of boards a median 288u short with the aim
// STILL clear 97.4% of the time. The ice is not closing the door.
//
// The median board is 2.7s. `getNavigationTarget` rebuilds `gridPath` on
// `gridTimer = 2.0 + ((id * 0.37) % 1)` — every 2 to 3 seconds. Those two numbers
// being equal is the lead: if each replan moves the CARROT (the point ~420u down
// the plan that `_tk_probe` showed the tack scorer actually optimises), then the
// boat is not abandoning gaps tactically, it is chasing a target the router keeps
// relocating, and "tack count" is downstream of replan cadence.
//
// ⚠️ This is NOT the churn measurement that was already made and came back
// STABLE. That one (rule 19b) measured the lateral distance from the NEW plan's
// lookahead point to the OLD PATH — a plan can be re-drawn along the same
// corridor, scoring ~0 churn, while the carrot slides hundreds of units ALONG it.
// The carrot is what steers; measure the carrot.
//
// usage: node _carrot_jump.js <venue> <trials> <seed0> <tree> [carrot]
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

    const A = { jump: [], brg: [], n: 0, replans: 0, flips: 0, beatN: 0 };
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate(({ seed, CARROT }) => {
            const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            const S = { jump: [], brg: [], n: 0, replans: 0, flips: 0, beatN: 0 };
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
                    const c = bo.controller; if (!c || !c.gridPath) continue;
                    const wd = getWindAt(bo.x, bo.y).direction;
                    if (Math.abs(norm(bo.heading - wd)) >= 1.2) { prev[bo.name] = null; continue; }
                    S.beatN++;
                    const P = prev[bo.name];
                    // a REPLAN is a new gridPath array object
                    const isNew = !P || P.ref !== c.gridPath;
                    const car = carrotOf(bo, c);
                    if (!car) continue;
                    if (isNew && P && P.car) {
                        S.replans++;
                        // how far did the carrot move, beyond the boat's own advance?
                        const moved = Math.hypot(car.x - P.car.x, car.y - P.car.y);
                        const advanced = Math.hypot(bo.x - P.bx, bo.y - P.by);
                        S.jump.push(Math.max(0, moved - advanced));
                        const b0 = Math.atan2(P.car.x - bo.x, -(P.car.y - bo.y));
                        const b1 = Math.atan2(car.x - bo.x, -(car.y - bo.y));
                        const db = Math.abs(norm(b1 - b0));
                        S.brg.push(db);
                        // did the carrot move to the OTHER side of the wind axis?
                        const s0 = norm(b0 - wd) >= 0 ? 1 : -1, s1 = norm(b1 - wd) >= 0 ? 1 : -1;
                        if (s0 !== s1) S.flips++;
                        S.n++;
                    }
                    prev[bo.name] = { ref: c.gridPath, car, bx: bo.x, by: bo.y };
                }
                if (state.race.status === 'racing' && state.race.timer > 895) break;
            }
            return S;
        }, { seed: SEED0 + t, CARROT });
        for (const k in r) { if (Array.isArray(r[k])) A[k].push(...r[k]); else A[k] += r[k]; }
        console.log(`seed ${SEED0 + t}: ${r.replans} replans on the beat`);
    }
    await b.close();

    const q = (a, pp) => { if (!a.length) return NaN; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(pp * (s.length - 1))]; };
    const D = (r) => (r * 180 / Math.PI).toFixed(0);
    console.log(`\n=== ${VENUE.toUpperCase()}: HOW FAR DOES THE REPLAN MOVE THE CARROT? (${TRIALS} seeds, carrot ${CARROT}u) ===`);
    console.log(`beat frames ${A.beatN}  replans observed on the beat ${A.replans}  (one per boat per ~2-3s)`);
    console.log(`\n  carrot displacement beyond the boat's own advance:`);
    console.log(`     med ${q(A.jump, .5).toFixed(0)}u   p75 ${q(A.jump, .75).toFixed(0)}u   p90 ${q(A.jump, .9).toFixed(0)}u   max ${Math.max(...A.jump).toFixed(0)}u`);
    console.log(`  change in BEARING to the carrot across a replan:`);
    console.log(`     med ${D(q(A.brg, .5))}deg   p75 ${D(q(A.brg, .75))}deg   p90 ${D(q(A.brg, .9))}deg`);
    console.log(`  ⭐ the carrot crossed to the OTHER SIDE OF THE WIND: ${A.flips}/${A.n} (${(100 * A.flips / (A.n || 1)).toFixed(1)}%)`);
    console.log(`\n  A side flip is a tack invitation the boat did not ask for. Compare with`);
    console.log(`  his measured leg-1 tack count of 5 against the fleet's 19-23.`);
})();
