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
// 2026-08-25 (the SWAMP STALL-MACHINE push): cand = the composed final HEAD
// (S3a weed-aware wiggle side 9e267b3 + multi-boat overlap 736e105).
// f1sw/f1riv/f1lag are fresh composed benches on treeF1 == final HEAD (S3a
// acts only there); every other venue carries mr* (treeMR), valid on final
// HEAD because S3a is byte-inert off swamp/river/lagoon (cmp proofs: lake
// 2x20 x2 + bay 2x20 x2 vs r1 anchors, 3-seed cmp on the other five).
// PRE column: the r1*/n1* anchors (the post-R1a standing baseline).
const VENUES = {
    redrock: { base: ['r1rr9400','r1rr9500','r1rr9600','r1rr9700','r1rr9800','r1rr9900'], cand: ['mrrr9400','mrrr9500','mrrr9600','mrrr9700','mrrr9800','mrrr9900'] },
    arctic:  { base: ['n1arc9100','n1arc9200','n1arc9400','n1arc9600'], cand: ['mrarc9100','mrarc9200','mrarc9400','mrarc9600'] },
    river:   { base: ['r1riv9400','r1riv9408','r1riv9500'], cand: ['f1riv9400','f1riv9408','f1riv9500'] },
    swamp:   { base: ['n1sw9400','n1sw9500','n1sw9600'], cand: ['f1sw9400','f1sw9500','f1sw9600'] },
    glowtide:{ base: ['r1glow'], cand: ['mrglow'] },
    lagoon:  { base: ['r1lag'], cand: ['f1lag'] },
    bay:     { base: ['r1bay9400','r1bay9600'], cand: ['mrbay9400','mrbay9600'] },
    lake:    { base: ['r1lk6100','r1lk6200'], cand: ['mrlk6100','mrlk6200'] },
    ocean:   { base: ['r1oc'], cand: ['mroc'] },
    seatrials:{ base: ['n1st'], cand: ['mrst'] },
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
