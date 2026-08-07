// Paired comparison of two ocean_bench/bay_bench JSONs on the SAME seed set.
//   node _bench_pair.js <baseline.json> <candidate.json> [cutoff]
// Per-boat-seed paired fin deltas (finishers in both), finisher counts,
// in-time under an optional cutoff, dirt (contact classes), OCS, penalties.
const path = require('path');
const A = require(path.resolve(process.argv[2]));   // baseline
const B = require(path.resolve(process.argv[3]));   // candidate
const CUT = parseInt(process.argv[4] || '0');
const med = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const mean = a => a.length ? a.reduce((p, q) => p + q, 0) / a.length : 0;
const stat = (j, name) => {
    const boats = [].concat(...j.map(r => r.info));
    const fins = boats.filter(f => f.fin != null).map(f => f.fin);
    const cols = c => boats.map(f => (f.col && f.col[c]) || 0);
    console.log(`${name}: fins ${fins.length}/${boats.length} med ${med(fins)} mean ${mean(fins).toFixed(1)}` +
        (CUT ? ` in-${CUT} ${boats.filter(f => f.fin != null && f.fin <= CUT).length}` : '') +
        ` | land ${mean(cols('land')).toFixed(2)} boat ${mean(cols('boat')).toFixed(2)} mark ${mean(cols('mark')).toFixed(2)}` +
        ` pen ${mean(boats.map(f => f.pen)).toFixed(2)} OCS% ${(100 * mean(boats.map(f => f.ocs))).toFixed(1)}`);
    return boats;
};
const a = stat(A, 'BASE');
const b = stat(B, 'CAND');
const d = [], dLand = [];
let onlyA = 0, onlyB = 0;
for (let i = 0; i < Math.min(A.length, B.length); i++) {
    if (A[i].seed !== B[i].seed) { console.log('SEED MISMATCH at', i); process.exit(1); }
    const ia = A[i].info, ib = B[i].info;
    for (let k = 0; k < ia.length; k++) {
        const fa = ia[k], fb = ib[k];
        if (fa.name !== fb.name) { console.log('BOAT ORDER MISMATCH'); process.exit(1); }
        if (fa.fin != null && fb.fin != null) d.push(fb.fin - fa.fin);
        else if (fa.fin != null) onlyA++;
        else if (fb.fin != null) onlyB++;
        dLand.push(((fb.col && fb.col.land) || 0) - ((fa.col && fa.col.land) || 0));
    }
}
console.log(`\npaired fins n=${d.length}: med ${med(d)} mean ${mean(d).toFixed(2)}  (fin-in-base-only ${onlyA}, fin-in-cand-only ${onlyB})`);
console.log(`paired land delta: med ${med(dLand)} mean ${mean(dLand).toFixed(2)}`);
