// PA CLOSE TABLE — THE PATHS-DOC ERA (2026-08-30; derived from _n1_close_table.js)
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
//   node _pa_close_table.js
const fs = require('fs'); const path = require('path');
// pooled medians over all benchmark-valid laps, 2026-08-24 (_traj_fp):
// arctic n=3, bay n=3, lagoon n=3, lake n=3, ocean n=3, river n=3,
// glowtide n=9, redrock n=9, seatrials n=10, swamp n=9
// ⭐ 2026-08-28 GLOWTIDE + REDROCK RE-CUT (owner redesign: course/wind/current
// byte-identical, shapes/world/props moved — a collider-geometry cut, not an
// adjudicable boundary-only one). Both re-frozen; the earlier glowtide (n=9)
// and redrock (n=9) laps are RETIRED refs (rule 23). New owner laps on the
// re-cut docs: glowtide n=4 (189.5/194.4/214.3/215.2 -> med 204.4 = mean of
// the middle pair), redrock n=3 (203.6/204.2/219.1 -> med 204.2).
const HUMAN = { arctic: 209.4, bay: 239.0, lagoon: 174.7, lake: 194.8,
    ocean: 214.2, river: 187.4, glowtide: 204.4, redrock: 204.2,
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
    // ⭐ THE PATHS INTAKE (2026-08-30): all ten docs re-frozen with the editor's saved
    // course.paths (the only key that moved; polylines == the router's, maxΔ 0 u).
    // pa* = HEAD 6d8b7c4 js on the paths docs. np* (HEAD js on the OLD docs) is
    // cmp-IDENTICAL to re1* on 10/10 venues, so the owner's js is sim-inert and the
    // pa*−re1* delta is the 0.1 u save-rounding reshuffle — a doc cut, not an AI change.
    // PRE column = re1* (the C1 landing anchors), shown for the cut only.

    // ⭐ THE START PUSH (2026-08-27): the way-on pre-start hold arms ONLY in a foul
    // stream (setAlong <= -1.5 kt), which by _st_gate.js is river 10/10 and every
    // other venue 0/10. The nine unchanged venues were VERIFIED byte-identical at
    // the whole-race level against their tb* anchors (cmp, one set each at anchor
    // width), so their cand labels ARE the tb* labels — the table reports no change
    // because there is provably none, not because nothing was run.
    // ⛔ 2026-08-28: redrock/glowtide PRE = tb* on the RETIRED docs, shown for
    // the cut only (README PROMOTE: old baselines are retired, not compared);
    // nv* = the new-doc anchors (treeNV == HEAD 7f4a6da). nvst is the byte-
    // identity verification of the unchanged venues vs tbst (cmp-equal).
    // ⭐ THE RE-ENTRY PUSH (2026-08-29): C1 progress currency landed; re1* =
    // treeRE == the landed js on every venue (bay also has re0/re1 9100/9200
    // control+cand pairs for the rule-13 four-set bar; not in the table).
    // PRE column = the session-open anchors (nv* redrock/glowtide/seatrials,
    // sp* river, tb* elsewhere).
    redrock: { base: ['re1rr9400','re1rr9500','re1rr9600','re1rr9700','re1rr9800','re1rr9900'], cand: ['parr9400','parr9500','parr9600','parr9700','parr9800','parr9900'] },
    arctic:  { base: ['re1arc9100','re1arc9200','re1arc9400','re1arc9600'], cand: ['paarc9100','paarc9200','paarc9400','paarc9600'] },
    river:   { base: ['re1riv9400','re1riv9408','re1riv9500'], cand: ['pariv9400','pariv9408','pariv9500'] },
    swamp:   { base: ['re1sw9400','re1sw9500','re1sw9600'], cand: ['pasw9400','pasw9500','pasw9600'] },
    glowtide:{ base: ['re1glow'], cand: ['paglow'] },
    lagoon:  { base: ['re1lag'], cand: ['palag'] },
    bay:     { base: ['re1bay9400','re1bay9600'], cand: ['pabay9400','pabay9600'] },
    lake:    { base: ['re1lk6100','re1lk6200'], cand: ['palk6100','palk6200'] },
    ocean:   { base: ['re1oc'], cand: ['paoc'] },
    seatrials:{ base: ['re1st'], cand: ['past'] },
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
