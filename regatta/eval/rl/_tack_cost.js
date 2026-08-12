// WHAT DOES ONE TACK ACTUALLY COST, AND HOW MUCH OF THE VENUE IS TACKS?
// (2026-08-11, arctic push)
//
// The tack-count attribution has never been priced. Everyone quotes "his leg-1
// tacks are 5, the fleet's 19-23" (and post-oscillator-merge the fleet's are far
// higher) but nobody has converted the count into SECONDS, so nobody knows
// whether the manoeuvre count is the whole 137.7 s/lap gap or a tenth of it.
//
// A TACK EPISODE = a change of `lastWindSide` (the engine's own tack flag),
// deduped so one manoeuvre counts once (rule 2). Around each episode:
//
//   v_ref  = median speed over the 4 s BEFORE the turn (settled, on the board)
//   loss   = integral of max(0, v_ref - v(t)) dt from the turn until speed
//            recovers to 0.97*v_ref (cap 12 s)  -> units of DISTANCE not made
//   cost_s = loss / v_ref                        -> seconds added to the lap
//
// That is the honest conversion: distance not made good at the boat's own settled
// speed, expressed as the time it will take to make it up. It counts ONLY the
// speed penalty of the manoeuvre. It does NOT count the extra distance of sailing
// a staircase instead of a long board — that is a separate (larger) term, so this
// is a LOWER BOUND on what the manoeuvre count costs.
//
// usage: node _tack_cost.js <venue> <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'arctic';
const TRIALS = parseInt(process.argv[3]) || 4;
const SEED0 = parseInt(process.argv[4]) || 9100;
const ROOT = path.join(__dirname, process.argv[5] || 'treeARCB');

(async () => {
    const br = await chromium.launch(); const p = await br.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    const ALL = { ep: [], boats: [], laps: 0 };
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate((seed) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const hist = {};           // name -> [{t,v,leg,side}]
            const DT = 1 / 60; let now = 0;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(DT);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                now += DT;
                if (it % 6) continue;                       // 10 Hz sampling
                for (const b of state.boats) {
                    if (b.isPlayer || b.raceState.finished) continue;
                    (hist[b.name] = hist[b.name] || []).push(
                        [+now.toFixed(2), +(b.speed * 60).toFixed(1), b.raceState.leg, b.lastWindSide === undefined ? 0 : b.lastWindSide]);
                }
                if (state.race.timer > 895) break;
            }
            const fin = {}, mans = {};
            for (const b of state.boats) if (!b.isPlayer) { fin[b.name] = b.raceState.finishTime || null; mans[b.name] = (b.raceState.legManeuvers || []).slice(); }
            return { hist, fin, mans, nLaps: state.course.laps || 1 };
        }, SEED0 + t);

        // --- offline episode extraction ---
        for (const name in r.hist) {
            const H = r.hist[name]; if (H.length < 60) continue;
            const perBoat = { name, seed: SEED0 + t, fin: r.fin[name], man: r.mans[name], n: 0, cost: 0, byLeg: {} };
            for (let i = 10; i < H.length - 5; i++) {
                if (H[i][3] === H[i - 1][3]) continue;                   // no side change
                // dedup: one episode per 2.0s
                if (perBoat._last != null && H[i][0] - perBoat._last < 2.0) { perBoat._last = H[i][0]; continue; }
                perBoat._last = H[i][0];
                const pre = H.slice(Math.max(0, i - 40), i).map(x => x[1]).sort((a, b) => a - b);
                if (!pre.length) continue;
                const vref = pre[Math.floor(pre.length / 2)];
                if (vref < 20) continue;                                  // already stopped: not a tack cost
                let loss = 0, j = i;
                for (; j < H.length && H[j][0] - H[i][0] < 12; j++) {
                    const dt = j > i ? H[j][0] - H[j - 1][0] : 0;
                    loss += Math.max(0, vref - H[j][1]) * dt;
                    if (H[j][0] - H[i][0] > 1.0 && H[j][1] >= 0.97 * vref) break;
                }
                const cost = loss / vref;
                perBoat.n++; perBoat.cost += cost;
                const lg = H[i][2];
                perBoat.byLeg[lg] = perBoat.byLeg[lg] || { n: 0, cost: 0 };
                perBoat.byLeg[lg].n++; perBoat.byLeg[lg].cost += cost;
                ALL.ep.push({ cost, dur: H[j] ? H[j][0] - H[i][0] : 0, vref, leg: lg });
            }
            delete perBoat._last;
            ALL.boats.push(perBoat);
        }
        console.log(`seed ${SEED0 + t}: ${Object.keys(r.hist).length} boats`);
    }
    await br.close();

    const q = (a, pp) => { if (!a.length) return NaN; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(pp * (s.length - 1))]; };
    const E = ALL.ep, B = ALL.boats.filter(b => b.fin);
    console.log(`\n=== ${VENUE.toUpperCase()}: THE PRICE OF THE MANOEUVRE COUNT (${TRIALS} seeds) ===`);
    console.log(`tack/gybe EPISODES ${E.length} over ${ALL.boats.length} boats (${B.length} finishers)`);
    console.log(`cost of ONE episode: med ${q(E.map(e => e.cost), .5).toFixed(2)}s  p75 ${q(E.map(e => e.cost), .75).toFixed(2)}s  p90 ${q(E.map(e => e.cost), .9).toFixed(2)}s  mean ${(E.reduce((a, e) => a + e.cost, 0) / (E.length || 1)).toFixed(2)}s`);
    console.log(`recovery duration:   med ${q(E.map(e => e.dur), .5).toFixed(2)}s  p90 ${q(E.map(e => e.dur), .9).toFixed(2)}s`);
    console.log(`\nPER FINISHING BOAT (a lap):`);
    console.log(`   episodes:  med ${q(B.map(b => b.n), .5)}   mean ${(B.reduce((a, b) => a + b.n, 0) / (B.length || 1)).toFixed(1)}`);
    console.log(`   TOTAL COST: med ${q(B.map(b => b.cost), .5).toFixed(1)}s   mean ${(B.reduce((a, b) => a + b.cost, 0) / (B.length || 1)).toFixed(1)}s   p90 ${q(B.map(b => b.cost), .9).toFixed(1)}s`);
    console.log(`   finish:     med ${q(B.map(b => b.fin), .5).toFixed(0)}s   ⇒ manoeuvre speed-loss is ${(100 * (B.reduce((a, b) => a + b.cost, 0) / (B.length || 1)) / (B.reduce((a, b) => a + b.fin, 0) / (B.length || 1))).toFixed(1)}% of the lap`);
    const legs = {};
    for (const b of B) for (const lg in b.byLeg) { legs[lg] = legs[lg] || { n: 0, cost: 0 }; legs[lg].n += b.byLeg[lg].n; legs[lg].cost += b.byLeg[lg].cost; }
    const eng = {};
    for (const b of B) (b.man || []).forEach((v, i) => { eng[i] = (eng[i] || 0) + v; });
    console.log(`\nENGINE's OWN legManeuvers counter (per finishing boat): ` +
        Object.keys(eng).sort().map(i => `leg${i} ${(eng[i] / B.length).toFixed(1)}`).join('  '));
    console.log(`\nBY LEG (per finishing boat):`);
    for (const lg of Object.keys(legs).sort())
        console.log(`   leg ${lg}: ${(legs[lg].n / B.length).toFixed(1)} episodes, ${(legs[lg].cost / B.length).toFixed(1)}s`);
    console.log(`\n⚠️ LOWER BOUND: this is the SPEED penalty of the manoeuvres only. The extra`);
    console.log(`   DISTANCE of a staircase vs a long board is a separate, larger term.`);
})();
