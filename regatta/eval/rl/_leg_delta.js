// WHERE DID A CANDIDATE'S TIME COME FROM? — straight out of the bench JSON.
//
// `ocean_bench.js` already stores `legT[leg]` (the race clock when each boat entered
// each leg) for every boat of every seed, so a per-leg attribution costs nothing
// extra once two benches exist. ⚠️ RULE 26: MEDIANS DO NOT ADD — a per-leg median
// table cannot explain a lap median, because different boats occupy the tail on
// different legs. Shares are attributed on MEANS here, and the table prints its own
// leg-sum-vs-total reconciliation so a mismatch is visible rather than assumed.
//
//   node _leg_delta.js <baseLabel> <candLabel> [more label pairs...]
const fs = require('fs'); const path = require('path');
const load = (l) => {
    const f = path.join(__dirname, `ocean_bench_${l}.json`);
    if (!fs.existsSync(f)) { console.log(`  (missing ocean_bench_${l}.json)`); return null; }
    return JSON.parse(fs.readFileSync(f, 'utf8'));
};
const legTimes = (j) => {
    // per boat-race: seconds spent on each leg (entry of leg n+1 minus entry of leg n;
    // the last leg runs to the finish). Boats that never finish contribute only the
    // legs they completed, and the count per leg is printed so a shrinking denominator
    // cannot masquerade as a faster leg.
    const per = {};
    let laps = 0, finSum = 0, finN = 0;
    for (const e of j) {
        for (const b of e.info) {
            const keys = Object.keys(b.legT).map(Number).sort((a, c) => a - c);
            for (let i = 0; i < keys.length; i++) {
                const lg = keys[i];
                const end = (i + 1 < keys.length) ? b.legT[keys[i + 1]] : b.fin;
                if (end == null) continue;
                const d = end - b.legT[lg];
                if (d < 0) continue;
                (per[lg] = per[lg] || []).push(d);
            }
            laps++;
            if (b.fin != null) { finSum += b.fin; finN++; }
        }
    }
    return { per, laps, finMean: finN ? finSum / finN : NaN, finN };
};
const mean = a => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };

const args = process.argv.slice(2);
for (let i = 0; i + 1 < args.length; i += 2) {
    const B = load(args[i]), C = load(args[i + 1]);
    if (!B || !C) continue;
    const b = legTimes(B), c = legTimes(C);
    console.log(`\n=== ${args[i]}  ->  ${args[i + 1]} ===`);
    console.log(`  boat-races ${b.laps} -> ${c.laps}   finishers ${b.finN} -> ${c.finN}   MEAN finish ${b.finMean.toFixed(1)} -> ${c.finMean.toFixed(1)}  (${(c.finMean - b.finMean >= 0 ? '+' : '') + (c.finMean - b.finMean).toFixed(1)})`);
    console.log('  leg |    n  base mean   cand mean     delta |  base med   cand med');
    const legs = [...new Set([...Object.keys(b.per), ...Object.keys(c.per)])].map(Number).sort((x, y) => x - y);
    let sumB = 0, sumC = 0;
    for (const lg of legs) {
        const ab = b.per[lg] || [], ac = c.per[lg] || [];
        const mb = mean(ab), mc = mean(ac);
        if (ab.length) sumB += mb; if (ac.length) sumC += mc;
        const d = mc - mb;
        console.log(`  ${String(lg).padStart(3)} | ${String(ab.length).padStart(4)}/${String(ac.length).padEnd(4)} ${mb.toFixed(1).padStart(8)} ${mc.toFixed(1).padStart(11)} ${((d >= 0 ? '+' : '') + d.toFixed(1)).padStart(9)} | ${med(ab).toFixed(1).padStart(9)} ${med(ac).toFixed(1).padStart(10)}`);
    }
    console.log(`  sum of per-leg MEANS ${sumB.toFixed(1)} -> ${sumC.toFixed(1)}   (against mean finish ${b.finMean.toFixed(1)} -> ${c.finMean.toFixed(1)} — these reconcile only if every boat completed every leg)`);
    // dirt
    const dirt = (j) => {
        const acc = { land: 0, boat: 0, mark: 0, bounds: 0, floe: 0, pen: 0 }; let n = 0;
        for (const e of j) for (const bb of e.info) {
            n++; const col = bb.col || {};
            for (const k of ['land', 'boat', 'mark', 'bounds', 'floe']) acc[k] += col[k] || 0;
            acc.pen += bb.pen || 0;
        }
        for (const k in acc) acc[k] /= (n || 1);
        return acc;
    };
    const db = dirt(B), dc = dirt(C);
    console.log('  dirt/boat: ' + Object.keys(db).map(k => `${k} ${db[k].toFixed(2)}->${dc[k].toFixed(2)}`).join('  '));
}
