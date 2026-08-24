// R3 PUSH CLOSE TABLE — OWNER SPEC 2026-08-23 (supersedes prior format):
//   venue | human | pre-session bot med/mean/best | post-session bot med/mean/best
//   | ratio | DNF% | collisions (MEDIAN per boat) | penalty (MEDIAN per boat)
// DNF% = 100 - finisher%. Collisions/penalty are per-boat MEDIANS (sum of all
// col types per boat), NOT the means the old dirt columns carried.
// Sorted by ratio (worst first). Accompanies EVERY status update to the owner.
// Pre-session = the session Phase-0 anchors; post-session = fresh benches on the
// final HEAD (edit CAND below at close). Per-type dirt means still printed as a
// second line for the session record / watches (floe & land watches live there).
//   node _r3_close_table.js
const fs = require('fs'); const path = require('path');
const HUMAN = { redrock: 216.7, arctic: 207.0, river: 167.8, swamp: 235.3,
    glowtide: 202.6, lagoon: 170.6, bay: 230.1, lake: 206.2, ocean: 213.9, seatrials: 185.6 };
const VENUES = {
    redrock: { base: ['b3rr9400','b3rr9500','b3rr9600','b3rr9700','b3rr9800','b3rr9900'], cand: ['b3rr9400','b3rr9500','b3rr9600','b3rr9700','b3rr9800','b3rr9900'] },
    arctic:  { base: ['r1carc9100','r1carc9200','r1carc9400','r1carc9600'], cand: ['r1carc9100','r1carc9200','r1carc9400','r1carc9600'] },
    river:   { base: ['b3riv9400','b3riv9408','b3riv9500'], cand: ['b3riv9400','b3riv9408','b3riv9500'] },
    swamp:   { base: ['b3sw9400','b3sw9500','b3sw9600'], cand: ['b3sw9400','b3sw9500','b3sw9600'] },
    glowtide:{ base: ['b3glow'], cand: ['b3glow'] },
    lagoon:  { base: ['b3lag'], cand: ['b3lag'] },
    bay:     { base: ['b3bay9400','b3bay9600'], cand: ['b3bay9400','b3bay9600'] },
    lake:    { base: ['b3lk6100','b3lk6200'], cand: ['b3lk6100','b3lk6200'] },
    ocean:   { base: ['b3oc'], cand: ['b3oc'] },
    seatrials:{ base: ['b3st'], cand: ['b3st'] },
};
const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
const stats = (labels) => {
    const fins = [], colPB = [], penPB = []; let n = 0, land = 0, boat = 0, floe = 0, mark = 0, pen = 0, missing = [];
    for (const l of labels) {
        const f = path.join(__dirname, `ocean_bench_${l}.json`);
        if (!fs.existsSync(f)) { missing.push(l); continue; }
        for (const r of JSON.parse(fs.readFileSync(f, 'utf8'))) {
            for (const b of r.info) {
                n++;
                if (b.fin != null) fins.push(b.fin);
                const c = b.col || {};
                colPB.push(Object.values(c).reduce((x, y) => x + y, 0));
                penPB.push(b.pen || 0);
                land += c.land || 0; boat += c.boat || 0; floe += c.floe || 0; mark += c.mark || 0;
                pen += b.pen || 0;
            }
        }
    }
    return { med: med(fins), mean: mean(fins), best: fins.length ? Math.min(...fins) : NaN,
             fins: fins.length, n, dnf: 100 * (1 - fins.length / n),
             colMed: med(colPB), penMed: med(penPB),
             land: land / n, boat: boat / n, floe: floe / n, mark: mark / n, pen: pen / n, missing };
};
const rows = [];
for (const [v, cfg] of Object.entries(VENUES)) {
    const B = stats(cfg.base), C = stats(cfg.cand);
    rows.push({ v, B, C, ratio: C.med / HUMAN[v], ratioB: B.med / HUMAN[v] });
}
rows.sort((a, b) => b.ratio - a.ratio);
console.log('venue      | human  | pre med/mean/best     | post med/mean/best    | ratio | DNF%  | colMed | penMed');
for (const r of rows) {
    const f = (s) => `${s.med}/${s.mean.toFixed(1)}/${s.best}`;
    console.log(`${r.v.padEnd(10)} | ${String(HUMAN[r.v]).padStart(6)} | ${f(r.B).padEnd(21)} | ${f(r.C).padEnd(21)} | ${r.ratio.toFixed(3)} | ${r.C.dnf.toFixed(1).padStart(5)} | ${String(r.C.colMed).padStart(6)} | ${String(r.C.penMed).padStart(6)}`);
    console.log(`           |        | dirt means l/b/f/m/pen: ${r.B.land.toFixed(2)}/${r.B.boat.toFixed(2)}/${r.B.floe.toFixed(2)}/${r.B.mark.toFixed(2)}/${r.B.pen.toFixed(2)} -> ${r.C.land.toFixed(2)}/${r.C.boat.toFixed(2)}/${r.C.floe.toFixed(2)}/${r.C.mark.toFixed(2)}/${r.C.pen.toFixed(2)}  fins ${r.B.fins}/${r.B.n} -> ${r.C.fins}/${r.C.n}`);
    if (r.B.missing.length || r.C.missing.length) console.log(`  MISSING: ${[...r.B.missing, ...r.C.missing].join(', ')}`);
}
