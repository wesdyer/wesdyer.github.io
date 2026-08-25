// PAIRED VERDICT vs the n1 anchors (2026-08-24 night push).
// Compares candidate bench labels against the standing n1 sets, per venue:
// per-boat paired deltas on matching (seed, boat-index) — bench-vs-bench on
// the same sequence both sides (rule 34 safe) — plus fins and dirt columns.
// SIGN: delta = CAND - BASE, NEGATIVE = CANDIDATE FASTER (stated on every
// line; rule 21/21b — recompute one venue by hand before publishing).
//   node _pair_vs_n1.js <prefix>            (e.g. r1)
const fs = require('fs'); const path = require('path');
const PFX = process.argv[2] || 'r1';
const MAP = {
    redrock: ['rr9400','rr9500','rr9600','rr9700','rr9800','rr9900'],
    arctic: ['arc9100','arc9200','arc9400','arc9600'],
    river: ['riv9400','riv9408','riv9500'],
    swamp: ['sw9400','sw9500','sw9600'],
    glowtide: ['glow'], lagoon: ['lag'], ocean: ['oc'], seatrials: ['st'],
    bay: ['bay9400','bay9600'], lake: ['lk6100','lk6200'],
};
const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
const load = (l) => { const f = path.join(__dirname, `ocean_bench_${l}.json`); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; };
for (const [venue, sets] of Object.entries(MAP)) {
    const deltas = []; let bFin = 0, cFin = 0, n = 0;
    const dirt = { b: { land: 0, boat: 0, floe: 0, mark: 0, pen: 0 }, c: { land: 0, boat: 0, floe: 0, mark: 0, pen: 0 } };
    let missing = [], byteEq = true;
    for (const s of sets) {
        const B = load('n1' + s), C = load(PFX + s);
        if (!B || !C) { missing.push((B ? '' : 'n1' + s) + (C ? '' : ' ' + PFX + s)); continue; }
        const fB = path.join(__dirname, `ocean_bench_n1${s}.json`), fC = path.join(__dirname, `ocean_bench_${PFX}${s}.json`);
        if (fs.readFileSync(fB, 'utf8') !== fs.readFileSync(fC, 'utf8')) byteEq = false;
        for (let r = 0; r < Math.min(B.length, C.length); r++) {
            const bi = B[r].info, ci = C[r].info;
            for (let k = 0; k < Math.min(bi.length, ci.length); k++) {
                n++;
                if (bi[k].fin != null) bFin++;
                if (ci[k].fin != null) cFin++;
                if (bi[k].fin != null && ci[k].fin != null) deltas.push(ci[k].fin - bi[k].fin);
                for (const side of ['b', 'c']) {
                    const src = side === 'b' ? bi[k] : ci[k];
                    const cc = src.col || {};
                    dirt[side].land += cc.land || 0; dirt[side].boat += cc.boat || 0;
                    dirt[side].floe += cc.floe || 0; dirt[side].mark += cc.mark || 0;
                    dirt[side].pen += src.pen || 0;
                }
            }
        }
    }
    if (!n) { console.log(`${venue.padEnd(10)} MISSING: ${missing.join(',')}`); continue; }
    const f = (x) => (x / n).toFixed(2);
    console.log(`${venue.padEnd(10)} paired med ${med(deltas).toFixed(1).padStart(6)} / mean ${mean(deltas).toFixed(1).padStart(6)}  (CAND-BASE, NEG=cand faster)  fins ${bFin}->${cFin} of ${n}` +
        `  dirt l/b/f/m/pen ${f(dirt.b.land)}/${f(dirt.b.boat)}/${f(dirt.b.floe)}/${f(dirt.b.mark)}/${f(dirt.b.pen)} -> ${f(dirt.c.land)}/${f(dirt.c.boat)}/${f(dirt.c.floe)}/${f(dirt.c.mark)}/${f(dirt.c.pen)}` +
        (byteEq ? '  [BYTE-IDENTICAL]' : '') + (missing.length ? `  MISSING: ${missing.join(',')}` : ''));
}
