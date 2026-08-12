// HOW MUCH DOES BAY'S NEW TRAFFIC COST A FLEET THAT CANNOT SEE IT? (2026-08-12)
//
// The merge added authored vessel traffic (`traffic.js`, ships on rails) and the
// collision handler says, in the owner's own words:
//
//     "NOTHING IS TOLD ABOUT THIS. No collisionData, so the planner is untouched —
//      bots cannot see the vessel and will sail into it, which is accepted (a
//      moving caster is planner work, and the planner is being changed elsewhere)."
//
// So the AI is structurally blind to a solid moving body that shoves it off course
// and multiplies its speed by TRAFFIC_GRIND on every frame of contact. This sizes
// that blindness before anything is built: episodes per boat, seconds in contact,
// and the speed a boat loses to each one, priced the way `_tack_cost` prices a
// manoeuvre — distance not made good at the boat's own settled speed.
//
//   node _bay_traffic.js <venue> <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'bay';
const TRIALS = parseInt(process.argv[3]) || 6;
const SEED0 = parseInt(process.argv[4]) || 9400;
const ROOT = path.join(__dirname, process.argv[5] || 'treeM');
(async () => {
    const br = await chromium.launch(); const p = await br.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const A = { ep: [], boats: 0, fins: [], nV: 0, contactT: 0 };
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate((seed) => {
            const hit = {};
            const inner = window.onRaceEvent;
            window.onRaceEvent = (ty, d) => {
                if (ty === 'collision_traffic' && d && d.boat && !d.boat.isPlayer) hit[d.boat.name] = 1;
                return inner && inner(ty, d);
            };
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const S = { ep: [], names: {}, fins: [], contactT: 0,
                        nV: (state.course.traffic && state.course.traffic.length) || 0 };
            const hist = {}, open = {};
            const DT = 1 / 60; let now = 0;
            for (let it = 0; it < 60 * 900; it++) {
                for (const k in hit) delete hit[k];
                window.update(DT);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                now += DT;
                for (const b of state.boats) {
                    if (b.isPlayer || b.raceState.finished) continue;
                    S.names[b.name] = 1;
                    const H = hist[b.name] = hist[b.name] || [];
                    H.push([now, b.speed * 60]);
                    if (H.length > 900) H.shift();
                    if (hit[b.name]) {
                        S.contactT += DT;
                        if (!open[b.name]) {
                            // settled speed over the 4 s before the touch
                            const pre = H.slice(Math.max(0, H.length - 241), Math.max(0, H.length - 1)).map(x => x[1]).sort((a, c) => a - c);
                            open[b.name] = { t0: now, vref: pre.length ? pre[Math.floor(pre.length / 2)] : 0, loss: 0, min: 1e9 };
                        }
                        open[b.name].last = now;
                    }
                    if (open[b.name]) {
                        const O = open[b.name];
                        O.loss += Math.max(0, O.vref - b.speed * 60) * DT;
                        O.min = Math.min(O.min, b.speed * 60);
                        // episode ends once she is back to 97% of settled speed and clear for 1 s
                        if (now - O.last > 1.0 && (b.speed * 60 >= 0.97 * O.vref || now - O.t0 > 20)) {
                            if (O.vref > 20) S.ep.push({ cost: O.loss / O.vref, dur: now - O.t0, vref: O.vref, min: O.min });
                            delete open[b.name];
                        }
                    }
                }
                if (state.race.timer > 895) break;
            }
            for (const b of state.boats) if (!b.isPlayer && b.raceState.finishTime) S.fins.push(b.raceState.finishTime);
            S.nBoats = Object.keys(S.names).length;
            return S;
        }, SEED0 + t);
        A.ep.push(...r.ep); A.boats += r.nBoats; A.fins.push(...r.fins); A.nV = r.nV; A.contactT += r.contactT;
        console.log(`seed ${SEED0 + t}: ${r.ep.length} traffic episodes over ${r.nBoats} boats (${r.nV} vessels authored)`);
    }
    await br.close();
    const q = (a, pp) => { if (!a.length) return NaN; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(pp * (s.length - 1))]; };
    const E = A.ep;
    console.log(`\n=== ${VENUE.toUpperCase()}: THE COST OF BEING BLIND TO TRAFFIC (${TRIALS} seeds, ${A.boats} boats) ===`);
    console.log(`authored vessels: ${A.nV}`);
    console.log(`traffic contact EPISODES: ${E.length} = ${(E.length / A.boats).toFixed(2)} per boat`);
    console.log(`seconds in contact: ${(A.contactT / A.boats).toFixed(2)} s/boat`);
    if (E.length) {
        console.log(`cost of ONE episode: med ${q(E.map(e => e.cost), .5).toFixed(2)}s  p75 ${q(E.map(e => e.cost), .75).toFixed(2)}s  p90 ${q(E.map(e => e.cost), .9).toFixed(2)}s  mean ${(E.reduce((a, e) => a + e.cost, 0) / E.length).toFixed(2)}s`);
        console.log(`speed at the bottom: med ${q(E.map(e => e.min), .5).toFixed(0)} u/s  (settled ${q(E.map(e => e.vref), .5).toFixed(0)} u/s)`);
        console.log(`⭐ TOTAL per boat: ${(E.reduce((a, e) => a + e.cost, 0) / A.boats).toFixed(1)} s`);
        console.log(`   against a fleet median finish of ${q(A.fins, .5).toFixed(0)}s and a human median of 241.3s (gap ${(q(A.fins, .5) - 241.3).toFixed(0)}s)`);
        console.log(`   ⇒ traffic blindness is ${(100 * (E.reduce((a, e) => a + e.cost, 0) / A.boats) / (q(A.fins, .5) - 241.3)).toFixed(0)}% of the venue's gap`);
    }
})();
