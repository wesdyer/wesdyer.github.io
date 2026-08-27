// START-PUSH VERDICT TOOL — pools the _st_ledger2 JSONs for one tree, or diffs
// two trees venue by venue on the START statistics. n = 10 boats x races, so a
// 1-second move is resolvable here where a lap median at the same width is not
// (standing rules 3/12/13). ⚠️ This tool judges the START ONLY; a landing still
// needs the fleet benches at anchor widths.
//   node _st_pool.js <tree> [<treeCand>]
const fs = require('fs'), path = require('path');
const A = process.argv[2] || 'treeRW', B = process.argv[3] || null;
const VEN = ['river', 'swamp', 'bay', 'seatrials', 'lake', 'ocean', 'glowtide', 'lagoon', 'redrock', 'arctic'];
const HUM = { arctic: 3.3, bay: 2.1, lagoon: 1.1, lake: 1.9, ocean: 3.4, river: 2.2, glowtide: 2.8, redrock: 1.4, seatrials: 3.4, swamp: 2.8 };
const med = a => { const s = a.filter(x => x != null && !Number.isNaN(x)).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const mean = a => { const s = a.filter(x => x != null); return s.length ? s.reduce((x, y) => x + y, 0) / s.length : NaN; };
const load = (tree, v) => {
    const hits = fs.readdirSync(__dirname).filter(f => f.startsWith(`_st_ledger2_${tree}_${v}_`) && f.endsWith('.json'));
    const rows = [];
    for (const f of hits) for (const r of JSON.parse(fs.readFileSync(path.join(__dirname, f), 'utf8'))) rows.push(...r.rows);
    return rows;
};
const stat = rows => ({
    n: rows.length,
    cross: med(rows.map(r => r.cross)),
    crossMean: mean(rows.map(r => r.cross)),
    p90: (() => { const s = rows.map(r => r.cross).filter(x => x != null).sort((a, b) => a - b); return s.length ? s[Math.floor(0.9 * (s.length - 1))] : NaN; })(),
    gunBehind: med(rows.map(r => r.gunBehind)),
    gunKt: med(rows.map(r => r.gunSp)),
    commit: med(rows.map(r => r.commit)),
    stalled: mean(rows.map(r => r.preF ? 100 * r.stallF / r.preF : null)),
    ocs: 100 * rows.filter(r => r.gunOcs).length / (rows.length || 1),
    dip: 100 * rows.filter(r => r.everOcs).length / (rows.length || 1),
    scrum: mean(rows.map(r => r.scrum)),
});
const fmt = (x, d = 2) => (x == null || Number.isNaN(x)) ? '  -  ' : x.toFixed(d);
if (!B) {
    console.log(`\n${A} — pre-start ledger, all venues (him = his fp-verified leg-0 mean)`);
    console.log('venue      n   him   crossMed crossMean p90    behind@gun  kt@gun  commit  stalled%  OCS%   scrum');
    for (const v of VEN) {
        const r = load(A, v); if (!r.length) { console.log(v.padEnd(10), 'no data'); continue; }
        const s = stat(r);
        console.log(v.padEnd(10), String(s.n).padStart(3), fmt(HUM[v], 1).padStart(5),
            fmt(s.cross).padStart(9), fmt(s.crossMean).padStart(8), fmt(s.p90).padStart(7),
            fmt(s.gunBehind, 0).padStart(9), fmt(s.gunKt).padStart(8), fmt(s.commit).padStart(7),
            fmt(s.stalled, 0).padStart(8), fmt(s.ocs, 1).padStart(6), fmt(s.scrum).padStart(7));
    }
} else {
    console.log(`\nSTART DIFF   base ${A}  →  cand ${B}   (negative = candidate crosses sooner)`);
    console.log('venue      n(b/c)  crossMed b→c        Δ   | crossMean Δ | behind@gun b→c  | kt@gun b→c | OCS@gun b→c | dip% b→c | scrum b→c');
    let wins = 0, tot = 0, dsum = 0;
    for (const v of VEN) {
        const rb = load(A, v), rc = load(B, v);
        if (!rb.length || !rc.length) { console.log(v.padEnd(10), 'missing'); continue; }
        const a = stat(rb), c = stat(rc); tot++;
        const d = c.cross - a.cross; if (d < 0) wins++; dsum += d;
        console.log(v.padEnd(10), `${a.n}/${c.n}`.padStart(7),
            `${fmt(a.cross)} → ${fmt(c.cross)}`.padStart(16), fmt(d).padStart(8), '|',
            fmt(c.crossMean - a.crossMean).padStart(9), '|',
            `${fmt(a.gunBehind, 0)} → ${fmt(c.gunBehind, 0)}`.padStart(14), '|',
            `${fmt(a.gunKt, 1)} → ${fmt(c.gunKt, 1)}`.padStart(11), '|',
            `${fmt(a.ocs, 0)} → ${fmt(c.ocs, 0)}`.padStart(8), '|',
            `${fmt(a.dip, 0)} → ${fmt(c.dip, 0)}`.padStart(8), '|',
            `${fmt(a.scrum)} → ${fmt(c.scrum)}`);
    }
    console.log(`\n  venues where the candidate crosses sooner: ${wins}/${tot}   mean of the per-venue median deltas: ${(dsum / (tot || 1)).toFixed(2)} s`);
}
