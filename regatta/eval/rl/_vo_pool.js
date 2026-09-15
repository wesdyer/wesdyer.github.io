// VOLCANIC POOLED PAIRED A/B over ocean_bench sets (2026-09-13, the volcano push).
//   node _vo_pool.js <BASE prefix> <CAND prefix> [set ...]     default sets 9400 9500 9600
// Prefixes are label stems: `vo0vo` + set. Pairs boats by (seed, name).
// ⚠️ SIGN: prints CAND − BASE. NEGATIVE = candidate FASTER. (Standing rule 21: read the
// sign off the source; this header IS the source.)
const fs = require('fs'); const path = require('path');
const BASE = process.argv[2], CAND = process.argv[3];
const SETS = process.argv.length > 4 ? process.argv.slice(4) : ['9400', '9500', '9600'];
const load = (l) => { const f = path.join(__dirname, `ocean_bench_${l}.json`); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; };
const q = (a, p) => { const s = a.filter(x => x != null && !Number.isNaN(x)).sort((x, y) => x - y); return s.length ? +s[Math.floor(p * (s.length - 1))].toFixed(1) : NaN; };
const mean = a => { const s = a.filter(x => x != null && !Number.isNaN(x)); return s.length ? +(s.reduce((x, y) => x + y, 0) / s.length).toFixed(2) : NaN; };
const agg = (rows) => {
    const n = rows.length, fins = rows.map(r => r.fin).filter(x => x != null);
    const d = { n, fins: fins.length, med: q(fins, .5), mean: mean(fins), best: Math.min(...fins), worst: Math.max(...fins),
                land: 0, boat: 0, mark: 0, pen: 0, ocs: 0, colMed: q(rows.map(r => Object.values(r.col || {}).reduce((x, y) => x + y, 0)), .5) };
    for (const r of rows) { const c = r.col || {}; d.land += c.land || 0; d.boat += c.boat || 0; d.mark += c.mark || 0; d.pen += r.pen || 0; d.ocs += r.ocs ? 1 : 0; }
    for (const k of ['land', 'boat', 'mark', 'pen']) d[k] = +(d[k] / n).toFixed(2);
    d.ocs = +(100 * d.ocs / n).toFixed(1);
    return d;
};
let allB = [], allC = [], pairs = [], winB = [], winC = [];
for (const s of SETS) {
    const B = load(BASE + s), C = load(CAND + s);
    if (!B || !C) { console.log(`  set ${s}: MISSING ${!B ? BASE + s : ''} ${!C ? CAND + s : ''}`); continue; }
    const pb = [];
    for (let i = 0; i < Math.min(B.length, C.length); i++) {
        if (B[i].seed !== C[i].seed) { console.log('seed mismatch', B[i].seed, C[i].seed); continue; }
        const cm = {}; for (const b of C[i].info) cm[b.name] = b;
        for (const b of B[i].info) { const c = cm[b.name]; if (!c) continue; allB.push(b); allC.push(c); if (b.fin != null && c.fin != null) { pb.push(c.fin - b.fin); pairs.push(c.fin - b.fin); } }
        const fb = B[i].info.filter(x => x.fin != null).map(x => x.fin), fc = C[i].info.filter(x => x.fin != null).map(x => x.fin);
        if (fb.length) winB.push(Math.min(...fb)); if (fc.length) winC.push(Math.min(...fc));
    }
    const aB = agg([].concat(...B.map(r => r.info))), aC = agg([].concat(...C.map(r => r.info)));
    console.log(`  set ${s}: base med ${aB.med} mean ${aB.mean} fins ${aB.fins}/${aB.n} | cand med ${aC.med} mean ${aC.mean} fins ${aC.fins}/${aC.n} | paired med ${q(pb, .5)} mean ${mean(pb)} (n=${pb.length})`);
}
const aB = agg(allB), aC = agg(allC);
console.log(`\n${BASE} → ${CAND}  pooled ${SETS.join('/')}  n=${aB.n} boats;  CAND − BASE, NEGATIVE = candidate faster`);
console.log(`  finish  med ${aB.med} → ${aC.med} (${(aC.med - aB.med).toFixed(1)})   mean ${aB.mean} → ${aC.mean} (${(aC.mean - aB.mean).toFixed(1)})   best ${aB.best} → ${aC.best}   worst ${aB.worst} → ${aC.worst}   fins ${aB.fins}/${aB.n} → ${aC.fins}/${aC.n}`);
console.log(`  PAIRED per boat: med ${q(pairs, .5)}  mean ${mean(pairs)}  p25 ${q(pairs, .25)}  p75 ${q(pairs, .75)}  (n=${pairs.length}; boats faster ${pairs.filter(d => d < 0).length}, slower ${pairs.filter(d => d > 0).length}, same ${pairs.filter(d => d === 0).length})`);
console.log(`  per-seed WINNER med ${q(winB, .5)} → ${q(winC, .5)}   mean ${mean(winB)} → ${mean(winC)}`);
console.log(`  dirt mean/boat  land ${aB.land} → ${aC.land}   boat ${aB.boat} → ${aC.boat}   mark ${aB.mark} → ${aC.mark}   pen ${aB.pen} → ${aC.pen}   col med ${aB.colMed} → ${aC.colMed}   OCS-ever ${aB.ocs}% → ${aC.ocs}%`);
