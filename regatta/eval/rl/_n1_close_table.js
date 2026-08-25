// N1 CLOSE TABLE — THE NEW-BENCHMARK ERA (2026-08-24, after THE GREAT SPLIT +
// the venue-doc promotion). Owner-spec format (same as _r3_close_table.js):
//   venue | human | pre med/mean/best | post med/mean/best | ratio | DNF% | colMed | penMed
// HUMAN = pooled MEDIAN of every lap valid on the CURRENT frozen docs (the
// 2026-08-24 corpus, 3 laps/venue; the four unchanged venues also keep their
// older valid laps — n listed beside each).
// PRE column: the n1 anchor sets — the standing pre-session baseline of the
// new-benchmark era. AT SESSION CLOSE: bench fresh labels on final HEAD, put
// them in `cand`, leave `base` as the n1 sets (or the previous session's
// anchors). Pre-promotion b3/r1carc JSONs live in _retired_benches/ — a stale
// label here reports MISSING rather than silently pooling a retired doc.
//   node _n1_close_table.js
const fs = require('fs'); const path = require('path');
// pooled medians over all benchmark-valid laps, 2026-08-24 (_traj_fp):
// arctic n=3, bay n=3, lagoon n=3, lake n=3, ocean n=3, river n=3,
// glowtide n=9, redrock n=9, seatrials n=10, swamp n=9
const HUMAN = { arctic: 209.4, bay: 239.0, lagoon: 174.7, lake: 194.8,
    ocean: 214.2, river: 187.4, glowtide: 199.1, redrock: 215.2,
    seatrials: 185.7, swamp: 234.1 };
// 2026-08-25 (the ROUNDING-CRAFT push): cand = r1* — the R1a exit-handoff
// landing benched at full n1 widths on treeR1 == the landed HEAD. Venues
// where the edit is structurally inert carry their byte-identity proof:
// arctic (all 4 sets cmp-identical — the _hasFloes gate), swamp + seatrials
// (no round legs; sw9400/st cmp-identical) keep the n1 labels.
const VENUES = {
    redrock: { base: ['n1rr9400','n1rr9500','n1rr9600','n1rr9700','n1rr9800','n1rr9900'], cand: ['r1rr9400','r1rr9500','r1rr9600','r1rr9700','r1rr9800','r1rr9900'] },
    arctic:  { base: ['n1arc9100','n1arc9200','n1arc9400','n1arc9600'], cand: ['n1arc9100','n1arc9200','n1arc9400','n1arc9600'] },
    river:   { base: ['n1riv9400','n1riv9408','n1riv9500'], cand: ['r1riv9400','r1riv9408','r1riv9500'] },
    swamp:   { base: ['n1sw9400','n1sw9500','n1sw9600'], cand: ['n1sw9400','n1sw9500','n1sw9600'] },
    glowtide:{ base: ['n1glow'], cand: ['r1glow'] },
    lagoon:  { base: ['n1lag'], cand: ['r1lag'] },
    bay:     { base: ['n1bay9400','n1bay9600'], cand: ['r1bay9400','r1bay9600'] },
    lake:    { base: ['n1lk6100','n1lk6200'], cand: ['r1lk6100','r1lk6200'] },
    ocean:   { base: ['n1oc'], cand: ['r1oc'] },
    seatrials:{ base: ['n1st'], cand: ['n1st'] },
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
    const preTag = '';
    console.log(`${r.v.padEnd(10)} | ${String(HUMAN[r.v]).padStart(6)} | ${(f(r.B) + preTag).padEnd(21)} | ${f(r.C).padEnd(21)} | ${r.ratio.toFixed(3)} | ${r.C.dnf.toFixed(1).padStart(5)} | ${String(r.C.colMed).padStart(6)} | ${String(r.C.penMed).padStart(6)}`);
    console.log(`           |        | dirt means l/b/f/m/pen: ${r.B.land.toFixed(2)}/${r.B.boat.toFixed(2)}/${r.B.floe.toFixed(2)}/${r.B.mark.toFixed(2)}/${r.B.pen.toFixed(2)} -> ${r.C.land.toFixed(2)}/${r.C.boat.toFixed(2)}/${r.C.floe.toFixed(2)}/${r.C.mark.toFixed(2)}/${r.C.pen.toFixed(2)}  fins ${r.B.fins}/${r.B.n} -> ${r.C.fins}/${r.C.n}`);
    if (r.B.missing.length || r.C.missing.length) console.log(`  MISSING: ${[...r.B.missing, ...r.C.missing].join(', ')}`);
}
