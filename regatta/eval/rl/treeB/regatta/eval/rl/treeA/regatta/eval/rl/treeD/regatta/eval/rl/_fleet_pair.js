// Paired per-boat comparison of two fleet_leg2 JSONs (same seeds).
// node _fleet_pair.js <labelA-experiment> <labelB-baseline>
// Positive delta = experiment faster (B.fin - A.fin), the bay_report convention.
const fs = require('fs'); const path = require('path');
const load = l => JSON.parse(fs.readFileSync(path.join(__dirname, 'fleet_leg2_' + l + '.json')));
const A = load(process.argv[2]); const B = load(process.argv[3]);
const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
const stat = D => {
    let rounders = 0, fins = [], intime = 0, n = 0;
    for (const run of D) for (const b of run.info) {
        n++;
        if ((b.legT && b.legT['2'] > 0) || b.fin) rounders++;
        if (b.fin) { fins.push(b.fin); if (b.fin <= 420) intime++; }
    }
    return { n, rounders, fins: fins.length, med: med(fins), mean: +mean(fins).toFixed(1), min: Math.min(...fins), intime };
};
const sa = stat(A), sb = stat(B);
console.log('A(exp) :', JSON.stringify(sa));
console.log('B(base):', JSON.stringify(sb));
const bf = new Map();
for (const run of B) for (const b of run.info) bf.set(run.seed + ':' + b.name, b);
const d = []; let aOnly = 0, bOnly = 0;
for (const run of A) for (const b of run.info) {
    const o = bf.get(run.seed + ':' + b.name);
    if (!o) continue;
    if (b.fin && o.fin) d.push(o.fin - b.fin);
    else if (b.fin && !o.fin) aOnly++;
    else if (!b.fin && o.fin) bOnly++;
}
console.log(`paired finishers n=${d.length} med ${med(d)} mean ${mean(d).toFixed(1)}`);
console.log(`finished-only-in-A ${aOnly} | finished-only-in-B ${bOnly}`);
const w = d.filter(x => x > 10).length, l = d.filter(x => x < -10).length;
console.log(`tails: winners>10s ${w} losers>10s ${l} | >40s ${d.filter(x => x > 40).length} vs ${d.filter(x => x < -40).length}`);
