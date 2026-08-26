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
// ⛔⛔ 2026-08-26 THE TEN-BOT ERA CUT (_tb_gates.md, owner-directed): tb* =
// 10-bot benches (the player boat converted to a full bot after startRace —
// his reference laps were always 10-hull races; benching bots against 8
// rivals under-dosed the traffic tax). NEVER compare tb* to ANY earlier
// anchor (rw*, mr*, f1*, and older are all 9-bot). The PRE column below is
// the 9-bot rw* era shown ONLY to display the density tax at the cut; from
// the next session on, base and cand are both tb*-era labels. The HUMAN
// column is unaffected — that parity is the point of the cut. (Arctic PRE =
// mrarc*, == rw-era HEAD by cmp proof.)
const VENUES = {
    redrock: { base: ['rwrr9400','rwrr9500','rwrr9600','rwrr9700','rwrr9800','rwrr9900'], cand: ['tbrr9400','tbrr9500','tbrr9600','tbrr9700','tbrr9800','tbrr9900'] },
    arctic:  { base: ['mrarc9100','mrarc9200','mrarc9400','mrarc9600'], cand: ['tbarc9100','tbarc9200','tbarc9400','tbarc9600'] },
    river:   { base: ['rwriv9400','rwriv9408','rwriv9500'], cand: ['tbriv9400','tbriv9408','tbriv9500'] },
    swamp:   { base: ['rwsw9400','rwsw9500','rwsw9600'], cand: ['tbsw9400','tbsw9500','tbsw9600'] },
    glowtide:{ base: ['rwglow'], cand: ['tbglow'] },
    lagoon:  { base: ['rwlag'], cand: ['tblag'] },
    bay:     { base: ['rwbay9400','rwbay9600'], cand: ['tbbay9400','tbbay9600'] },
    lake:    { base: ['rwlk6100','rwlk6200'], cand: ['tblk6100','tblk6200'] },
    ocean:   { base: ['rwoc'], cand: ['tboc'] },
    seatrials:{ base: ['rwst'], cand: ['tbst'] },
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
