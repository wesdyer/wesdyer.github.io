// EM CLOSE TABLE — THE EMBERFALL BASELINE (2026-09-13; derived from _wb_close_table.js).
// em* = the working tree at 5ef9d99 + the uncommitted Emberfall weather work (volcano.js,
// bot fried-as-information/dodge/plume-aware scoring, boil pricing) — ALL ELEVEN venues
// re-benched on this js because the previous anchors' JSONs are not on this machine.
// PRE = POST here (one era, one tree): this table is the standing baseline for the next
// session to A/B against, not a before/after. Volcanic joins the set: human = 5 laps
// 2026-09-13 (203.3/197.9/189.9/195.5/185.7 -> med 195.5), doc frozen b79ac315b9dfc104.
//   node _em_close_table.js
const fs = require('fs'); const path = require('path');
const HUMAN = { arctic: 209.4, bay: 239.0, lagoon: 174.7, lake: 194.8,
    ocean: 214.2, river: 187.4, glowtide: 204.4, redrock: 204.2,
    seatrials: 185.7, swamp: 173.3, volcanic: 195.5 };
const HUMAN_N = { arctic: 3, bay: 3, lagoon: 3, lake: 3, ocean: 3, river: 3, glowtide: 4, redrock: 3, seatrials: 10, swamp: 3, volcanic: 5 };
const VENUES = {
    redrock: { base: ['emrr9400','emrr9500','emrr9600','emrr9700','emrr9800','emrr9900'], cand: ['emrr9400','emrr9500','emrr9600','emrr9700','emrr9800','emrr9900'] },
    arctic:  { base: ['emarc9100','emarc9200','emarc9400','emarc9600'], cand: ['emarc9100','emarc9200','emarc9400','emarc9600'] },
    river:   { base: ['emriv9400','emriv9408','emriv9500'], cand: ['emriv9400','emriv9408','emriv9500'] },
    swamp:   { base: ['emsw9400','emsw9500','emsw9600'], cand: ['emsw9400','emsw9500','emsw9600'] },
    glowtide:{ base: ['emglow'], cand: ['emglow'] },
    lagoon:  { base: ['emlag'], cand: ['emlag'] },
    bay:     { base: ['embay9400','embay9600'], cand: ['embay9400','embay9600'] },
    lake:    { base: ['emlk6100','emlk6200'], cand: ['emlk6100','emlk6200'] },
    ocean:   { base: ['emoc'], cand: ['emoc'] },
    seatrials:{ base: ['emst'], cand: ['emst'] },
    volcanic:{ base: ['emvo9400','emvo9500','emvo9600'], cand: ['emvo9400','emvo9500','emvo9600'], note: 'NEW 2026-09-13: Emberfall Isle, first anchor; human = 5 laps on the frozen doc' },
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
const noteOf = (v) => (VENUES[v] && VENUES[v].note) || '';
const rows = [];
for (const [v, cfg] of Object.entries(VENUES)) {
    const B = stats(cfg.base), C = stats(cfg.cand);
    rows.push({ v, B, C, ratio: C.med / HUMAN[v], ratioB: B.med / HUMAN[v] });
}
rows.sort((a, b) => b.ratio - a.ratio);
console.log('| venue | human med (n) | bot med/mean/best | ratio | DNF% | col med/boat | pen med/boat | dirt l/b/f/m/pen (mean/boat) | fins |');
console.log('|---|---|---|---|---|---|---|---|---|');
for (const r of rows) {
    const C = r.C;
    console.log(`| ${r.v} | ${HUMAN[r.v]} (${HUMAN_N[r.v]}) | ${C.med}/${C.mean.toFixed(1)}/${C.best} | **${r.ratio.toFixed(3)}${r.ratio <= 1.05 ? ' ✅' : ''}** | ${C.dnf.toFixed(1)} | ${C.colMed} | ${C.penMed} | ${C.land.toFixed(2)}/${C.boat.toFixed(2)}/${C.floe.toFixed(2)}/${C.mark.toFixed(2)}/${C.pen.toFixed(2)} | ${C.fins}/${C.n} |${C.missing.length ? '  MISSING ' + C.missing.join(',') : ''}`);
}
console.log('');
console.log('venue      | human  | pre med/mean/best     | post med/mean/best    | ratio | DNF%  | colMed | penMed');
for (const r of rows) {
    const f = (s) => `${s.med}/${s.mean.toFixed(1)}/${s.best}`;
    const preTag = '';
    console.log(`${r.v.padEnd(10)} | ${String(HUMAN[r.v]).padStart(6)} | ${(f(r.B) + preTag).padEnd(21)} | ${f(r.C).padEnd(21)} | ${r.ratio.toFixed(3)} | ${r.C.dnf.toFixed(1).padStart(5)} | ${String(r.C.colMed).padStart(6)} | ${String(r.C.penMed).padStart(6)}`);
    if (noteOf(r.v)) console.log(`           |        | ${noteOf(r.v)}`);
    console.log(`           |        | dirt means l/b/f/m/pen: ${r.B.land.toFixed(2)}/${r.B.boat.toFixed(2)}/${r.B.floe.toFixed(2)}/${r.B.mark.toFixed(2)}/${r.B.pen.toFixed(2)} -> ${r.C.land.toFixed(2)}/${r.C.boat.toFixed(2)}/${r.C.floe.toFixed(2)}/${r.C.mark.toFixed(2)}/${r.C.pen.toFixed(2)}  fins ${r.B.fins}/${r.B.n} -> ${r.C.fins}/${r.C.n}`);
    if (r.B.missing.length || r.C.missing.length) console.log(`  MISSING: ${[...r.B.missing, ...r.C.missing].join(', ')}`);
}
