// ARCTIC: IS THE EXCESS IN THE PLAN, OR IN THE CHURN? (2026-08-08 push P0, step 2)
// _arc_clr killed "the router refuses her leads" (it refuses 1-3 of 23-40 plans;
// its plans are ~1.4x the straight line) and the PAD-knee candidate made the solo
// odometer WORSE (51.1k vs 40.4k). _arc_why says the boat is mostly ON its plan
// (d0 med 52u, off-plan>100u only 26%) yet sails 1.6x her distance. Both cannot be
// true of a STABLE plan — so measure the plan's stability directly.
// Per leg, per solo race:
//   plan0     — length of the FIRST gridPath of the leg (what the router intended)
//   planMin   — the shortest plan the router ever offered on this leg
//   odo       — what actually got sailed
//   churn     — per replan, the lateral distance between the OLD plan and the NEW
//               plan measured at the same 400u-ahead arc-length point (a plan that
//               keeps its mind gives ~0; a plan flip-flopping between two sides of
//               a floe gives hundreds of units)
//   flips     — replans whose 400u-ahead point moved > 200u (side changes)
//   replans   — total replans on the leg
//   node _arc_churn.js <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 4;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeHD9');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' })); });
    // NEUTRAL BOT (owner-directed 2026-08-08). This probe promotes bots[0] to
    // hero, and bots[0] is a DIFFERENT CHARACTER per seed (9100 Fathom, 9101
    // Nimbus, 9102 Anvil...). Paired deltas are unaffected — the pair shares the
    // character — but every ABSOLUTE number this probe reports ("the solo bot
    // sails 1.6-2.5x her rhumb", "leg-1 tacks 21-23 against her 5") was a mixed
    // roster draw measured against her ONE unmodified boat. Strip the sailor:
    // identical stats and no archetype persona for every rival, at the shipped
    // difficulty (AI_STAT_BONUS still on — that is a separate knob, `bonusOff`).
    await page.addInitScript(() => { window.__CHAR = { neutral: 1 }; });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const races = [];
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const hero = bots[0];
            for (let k = 1; k < bots.length; k++) { bots[k].x = 1e6 + k * 500; bots[k].y = 1e6; bots[k].raceState.finished = true; }
            const legs = {};   // leg -> {plan0, planMin, odo, churn:[], flips, replans}
            const ptAt = (gp, from, s) => {          // point s units along the path
                if (!gp || !gp.length) return null;
                let px = from[0], py = from[1], acc = 0;
                for (const q of gp) {
                    const d = Math.hypot(q.x - px, q.y - py);
                    if (acc + d >= s) {
                        const t = d ? (s - acc) / d : 0;
                        return [px + (q.x - px) * t, py + (q.y - py) * t];
                    }
                    acc += d; px = q.x; py = q.y;
                }
                return [px, py];
            };
            const plen = (gp, from) => {
                if (!gp || !gp.length) return null;
                let L = 0, px = from[0], py = from[1];
                for (const q of gp) { L += Math.hypot(q.x - px, q.y - py); px = q.x; py = q.y; }
                return L;
            };
            const segD = (px2, py2, ax, ay, bx, by) => {
                const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
                const t = L2 ? Math.max(0, Math.min(1, ((px2 - ax) * dx + (py2 - ay) * dy) / L2)) : 0;
                return Math.hypot(px2 - (ax + t * dx), py2 - (ay + t * dy));
            };
            let px = hero.x, py = hero.y, prevPath = null, prevFrom = null, fin = null;
            const dt = 1 / 60; let fr = 0;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                const t = state.race.timer;
                if (t > 880) break;
                const leg = hero.raceState.leg;
                const L = legs[leg] = legs[leg] || { plan0: null, planMin: Infinity, odo: 0, churn: [], flips: 0, replans: 0,
                                                     tacks: 0, upOdo: 0, upNet: 0, ux: null, uy: null };
                const gp = hero.controller && hero.controller.gridPath;
                // a REPLAN is a new gridPath array object
                if (gp && gp !== prevPath) {
                    const pl2 = plen(gp, [hero.x, hero.y]);
                    if (pl2 != null) {
                        if (L.plan0 == null) L.plan0 = Math.round(pl2);
                        if (pl2 < L.planMin) L.planMin = Math.round(pl2);
                    }
                    // ⚠️ PROBE AUDIT ×2 (standing rule 18). Two artifacts had to come
                    // out before this number meant anything: (1) near a mark the plan
                    // is shorter than the 400u lookahead and ptAt returns its endpoint
                    // — require ≥600u; (2) the boat ADVANCES ~250u along its own path
                    // between replans, so comparing "400u ahead of me now" to "400u
                    // ahead of me then" scores a perfectly stable plan as ~250u of
                    // churn. The honest question is LATERAL: how far is the new plan's
                    // 400u-ahead point from the OLD PATH ITSELF? A plan that only
                    // advances scores ~0; one that switches sides of a floe scores the
                    // width of the detour.
                    const a400 = (pl2 != null && pl2 >= 600) ? ptAt(gp, [hero.x, hero.y], 400) : null;
                    if (prevPath && prevFrom && a400) {
                        let best = Infinity, ax = prevFrom[0], ay = prevFrom[1];
                        for (const q of prevPath) {
                            const d2 = segD(a400[0], a400[1], ax, ay, q.x, q.y);
                            if (d2 < best) best = d2;
                            ax = q.x; ay = q.y;
                        }
                        if (best < Infinity) {
                            L.churn.push(Math.round(best));
                            if (best > 200) L.flips++;
                            L.replans++;
                        }
                    }
                    prevPath = gp; prevFrom = [hero.x, hero.y];
                }
                fr = (fr + 1) % 6;
                if (fr !== 0) continue;
                const ds = Math.hypot(hero.x - px, hero.y - py);
                L.odo += ds;
                // TACKING EFFICIENCY, the other half of odo/plan0: on a beat the
                // sailed distance MUST exceed the route (the boat zig-zags along
                // it). Count tacks and the upwind odometer so the beat's own
                // 1.41x can be separated from wandering.
                const wv = getWindAt(hero.x, hero.y);
                const off = Math.abs(((hero.heading - wv.direction + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
                if (off < 1.2) {                       // beating (engine TWA: 0 = head-to-wind)
                    L.upOdo += ds;
                    const tk = Math.sign(((hero.heading - wv.direction + Math.PI * 3) % (Math.PI * 2)) - Math.PI) || 0;
                    if (L.ux != null && tk !== 0 && tk !== L.ux) L.tacks++;
                    if (tk !== 0) L.ux = tk;
                }
                px = hero.x; py = hero.y;
                if (hero.raceState.finished && fin == null) { fin = +t.toFixed(1); break; }
            }
            const pct = (v, p) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * p / 100))]; };
            const out = {};
            for (const [k, L] of Object.entries(legs)) {
                if (L.odo < 500) continue;
                out[k] = { plan0: L.plan0, planMin: L.planMin === Infinity ? null : L.planMin, odo: Math.round(L.odo),
                    ratio: L.plan0 ? +(L.odo / L.plan0).toFixed(2) : null,
                    churnMed: pct(L.churn, 50), churnP90: pct(L.churn, 90),
                    flips: L.flips, replans: L.replans,
                    flipPct: L.replans ? Math.round(100 * L.flips / L.replans) : 0,
                    tacks: L.tacks, upOdo: Math.round(L.upOdo),
                    upPct: L.odo ? Math.round(100 * L.upOdo / L.odo) : 0 };
            }
            return { seed, name: hero.name, fin, legs: out };
        }, seed);
        races.push(r);
        console.log('seed', r.seed, r.name, 'fin', r.fin);
        for (const [k, L] of Object.entries(r.legs)) {
            console.log(`   leg ${k}: plan0 ${L.plan0}  ODO ${L.odo}  odo/plan0 ${L.ratio}`,
                ` upwind ${L.upOdo} (${L.upPct}%) tacks ${L.tacks}`,
                ` churn med ${L.churnMed} p90 ${L.churnP90}  FLIPS ${L.flips}/${L.replans} (${L.flipPct}%)`);
        }
    }
    const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
    const allRatios = [], allFlip = [], allChurn = [];
    for (const r of races) for (const L of Object.values(r.legs)) {
        if (L.ratio) allRatios.push(L.ratio);
        allFlip.push(L.flipPct); if (L.churnMed != null) allChurn.push(L.churnMed);
    }
    console.log('\nPOOLED legs:', allRatios.length, ' odo/plan0 med', med(allRatios),
        ' churn med', med(allChurn), ' flip% med', med(allFlip));
    console.log('  READ: odo/plan0 ≈ 1 means the ROUTE is the excess; >> 1 means CHURN/wander is.');
    await browser.close();
})();
