// HOW MUCH SHOAL DOES THE FLEET ACTUALLY EAT, AND FOR HOW LONG? (2026-08-10)
//
// Owner: "will this make drag too hard in swamp where it dominates?" — the right
// question, because swamp inverts every parameter that makes lagoon's shoals
// nearly free. The deciding quantity is TIME ON THE BAR relative to the ~9.25s
// speed constant, and it is set by boat speed, not by the multiplier:
//   * lagoon at ~100 u/s crosses a 150u bar in 1.5s  -> nowhere near equilibrium,
//     loses ~0%, and the router's steady-state price is ~4x too high.
//   * swamp at ~30 u/s crosses the SAME bar in 5s    -> most of the way to
//     equilibrium, so it feels close to the full multiplier and the steady-state
//     price is roughly right.
// If that is so, the two venues need opposite corrections and any fix must be a
// function of exposure time, not a constant.
//
// Measures, per venue, over real bot races:
//   * share of boat-time spent in shoal water, and the multiplier experienced
//   * the DURATION distribution of shoal crossings (the whole question)
//   * speed while in shoal vs the boat's own target there — i.e. how close to
//     equilibrium the fleet actually gets
//   * what fraction of the fleet's slow time (<40 u/s) is shoal-attributable
//
// usage: node _shoal_exposure.js <venue> [trials] [seed0] [tree]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'swamp';
const TRIALS = parseInt(process.argv[3]) || 4;
const SEED0 = parseInt(process.argv[4]) || 7300;
const ROOT = path.join(__dirname, process.argv[5] || 'treeHDP');

(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    const A = { t: 0, tShoal: 0, mSum: 0, n: 0, vSum: 0, vShoal: 0, nShoal: 0,
                slow: 0, slowShoal: 0, runs: [], eqSum: 0, eqN: 0, vAll: [] };
    for (let k = 0; k < TRIALS; k++) {
        const r = await p.evaluate(({ seed }) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const shoals = (state.course.islands || []).filter(i => i.awash);
            const mulAt = (x, y) => window.VenueDoc.shoalField(shoals, x, y);
            const o = { t: 0, tShoal: 0, mSum: 0, n: 0, vSum: 0, vShoal: 0, nShoal: 0,
                        slow: 0, slowShoal: 0, runs: [], eqSum: 0, eqN: 0 };
            const cur = {}; const DT = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(DT);
                if (state.race.status !== 'racing') { if (state.race.status === 'finished') break; continue; }
                if (it % 6) continue;
                for (const bo of state.boats) {
                    if (bo.isPlayer || bo.raceState.finished) continue;
                    const v = bo.speed * 60;
                    const m = mulAt(bo.x, bo.y);
                    o.t += 0.1; o.n++; o.vSum += v;
                    if (v < 40) o.slow += 0.1;
                    if (m < 0.99) {
                        o.tShoal += 0.1; o.mSum += m; o.nShoal++; o.vShoal += v;
                        if (v < 40) o.slowShoal += 0.1;
                        // how close to equilibrium? boat.shoalMul is what physics applied
                        const tgt = bo.targetSpeed != null ? bo.targetSpeed * 60 : null;
                        if (tgt && tgt > 1) { o.eqSum += Math.min(2, v / tgt); o.eqN++; }
                        const c = cur[bo.name] || (cur[bo.name] = { d: 0, t: 0, mMin: 1, x: bo.x, y: bo.y });
                        c.d += Math.hypot(bo.x - c.x, bo.y - c.y); c.x = bo.x; c.y = bo.y;
                        c.t += 0.1; if (m < c.mMin) c.mMin = m;
                    } else if (cur[bo.name]) {
                        if (cur[bo.name].t >= 0.2) o.runs.push([+cur[bo.name].t.toFixed(1), Math.round(cur[bo.name].d), +cur[bo.name].mMin.toFixed(2)]);
                        delete cur[bo.name];
                    }
                }
                if (state.race.status === 'racing' && state.race.timer > 880) break;
            }
            return o;
        }, { seed: SEED0 + k });
        for (const f of ['t', 'tShoal', 'mSum', 'n', 'vSum', 'vShoal', 'nShoal', 'slow', 'slowShoal', 'eqSum', 'eqN']) A[f] += r[f];
        for (const q of r.runs) A.runs.push(q);
    }
    await b.close();

    const q = (a, pp) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(pp * (s.length - 1))] : NaN; };
    const durs = A.runs.map(r => r[0]);
    const TAU = -1 / (60 * Math.log(0.9982));
    console.log(`\n=== ${VENUE.toUpperCase()}: FLEET SHOAL EXPOSURE (${TRIALS} seeds) ===`);
    console.log(`  fleet mean speed        ${(A.vSum / A.n).toFixed(0)} u/s   (${(A.vSum / A.n / 15).toFixed(1)} kt)`);
    console.log(`  boat-time in shoal      ${(100 * A.tShoal / A.t).toFixed(1)}%   (${A.tShoal.toFixed(0)} of ${A.t.toFixed(0)} boat-s)`);
    console.log(`  mean multiplier there   ${(A.mSum / Math.max(1, A.nShoal)).toFixed(2)}`);
    console.log(`  speed in shoal          ${(A.vShoal / Math.max(1, A.nShoal)).toFixed(0)} u/s`);
    console.log(`  v / its own target      ${(A.eqSum / Math.max(1, A.eqN)).toFixed(2)}   <- 1.0 means AT equilibrium (feeling the full drag)`);
    console.log(`  slow time that is shoal ${(100 * A.slowShoal / Math.max(0.01, A.slow)).toFixed(0)}%`);
    console.log(`\n  CROSSING DURATIONS (n=${A.runs.length})   tau = ${TAU.toFixed(1)}s`);
    console.log(`     median ${q(durs, 0.5).toFixed(1)}s   p75 ${q(durs, 0.75).toFixed(1)}s   p90 ${q(durs, 0.9).toFixed(1)}s   max ${q(durs, 1).toFixed(1)}s`);
    const longR = durs.filter(d => d >= TAU).length;
    console.log(`     crossings lasting >= tau (${TAU.toFixed(1)}s): ${longR}/${durs.length} = ${(100 * longR / Math.max(1, durs.length)).toFixed(0)}%`);
    console.log(`     => a HIGH share means the fleet reaches equilibrium and the steady-state`);
    console.log(`        price is roughly right here; a LOW share means it is fiction.`);
})();
