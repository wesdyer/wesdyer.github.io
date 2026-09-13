// Paired A/B over the seeds two volcanic_bench labels share: starts, OCS, finishes, weather.
//   node regatta/eval/rl/volcanic_ab.js <labelA> <labelB>
const fs = require('fs'); const path = require('path');
const load = (l) => JSON.parse(fs.readFileSync(path.join(__dirname, 'volcanic_bench_' + l + '.json')));
const A = load(process.argv[2]), B = load(process.argv[3]);
const seeds = A.map(r => r.seed).filter(s => B.some(r => r.seed === s));
const med = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : NaN; };
const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
const f1 = (v) => isNaN(v) ? '—' : (Math.round(v * 10) / 10).toFixed(1);
const stats = (R) => {
    const boats = R.filter(r => seeds.includes(r.seed)).flatMap(r => r.info);
    const fin = boats.filter(b => b.fin != null).map(b => b.fin);
    return { n: boats.length, ocs: 100 * boats.filter(b => b.ocs).length / boats.length,
             startMed: med(boats.filter(b => b.legT[1] != null).map(b => b.legT[1])),
             finMed: med(fin), finMean: mean(fin), dnf: 100 * (boats.length - fin.length) / boats.length,
             fries: mean(boats.map(b => b.fries || 0)), friedS: mean(boats.map(b => b.friedS || 0)),
             boilS: mean(boats.map(b => b.boilS || 0)), deadS: mean(boats.map(b => b.deadS || 0)),
             pen: mean(boats.map(b => b.pen || 0)), boatC: mean(boats.map(b => (b.col && b.col.boat) || 0)),
             winner: med(R.filter(r => seeds.includes(r.seed)).map(r => Math.min(...r.info.filter(i => i.fin != null).map(i => i.fin)))) };
};
const a = stats(A), b = stats(B);
console.log(`paired over ${seeds.length} seeds (${seeds[0]}..${seeds[seeds.length - 1]}), ${a.n} boat-races each\n`);
console.log('| metric | ' + process.argv[2] + ' | ' + process.argv[3] + ' | delta |\n|---|---|---|---|');
for (const [k, label] of [['ocs', 'OCS %'], ['startMed', 'start median s'], ['finMed', 'finish median s'], ['finMean', 'finish mean s'], ['winner', 'per-seed winner median s'], ['dnf', 'DNF % @900'], ['pen', 'penalties/boat'], ['boatC', 'boat contacts/boat'], ['fries', 'fries/boat'], ['friedS', 's fried/boat'], ['boilS', 's in boil/boat'], ['deadS', 's dead air/boat']])
    console.log(`| ${label} | ${f1(a[k])} | ${f1(b[k])} | ${(b[k] - a[k] >= 0 ? '+' : '') + f1(b[k] - a[k])} |`);
