// POOLED REDROCK VERDICT, CENSORED AT THE CUTOFF (2026-08-09).
// `_pool_rr.js` pairs only boats that FINISHED in both trees, so a change that
// rescues a boat from the 900s cutoff makes the finisher median look WORSE (the
// rescued boat finishes at 700-850 and joins the median) while the fleet is
// strictly better off — the composition trap the ESCAPE landing walked into.
// This pooler censors every non-finisher at the cutoff and pairs over ALL boats,
// which is the honest whole-fleet clock. Quote it BESIDE the finisher median,
// never instead of it: censoring understates a real gain among the finishers.
//   node _pool_rr900.js <baseLabelPrefix> <candLabelPrefix> [sets...]
const fs = require('fs'); const path = require('path');
const [BASE, CAND] = process.argv.slice(2, 4);
const SETS = process.argv.slice(4).length ? process.argv.slice(4)
    : ['9400', '9500', '9600', '9700', '9800', '9900'];
const CUT = 900;
const load = (l) => {
    const f = path.join(__dirname, `ocean_bench_${l}.json`);
    return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
};
const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(p * (s.length - 1))] : NaN; };
const mean = a => a.reduce((x, y) => x + y, 0) / (a.length || 1);

const allD = [];
let dnfB = 0, dnfC = 0, n = 0;
console.log(`set      base med  cand med   paired med   paired mean   DNF base/cand   n`);
for (const s of SETS) {
    const A = load(BASE + s), B = load(CAND + s);
    if (!A || !B) { console.log(`${s}     (missing ${!A ? BASE + s : CAND + s})`); continue; }
    const bySeed = arr => Object.fromEntries(arr.map(t => [t.seed, t]));
    const bA = bySeed(A), bB = bySeed(B);
    const d = [], fa = [], fb = [];
    let da = 0, db = 0;
    for (const seed of Object.keys(bA)) {
        if (!bB[seed]) continue;
        const mapB = Object.fromEntries(bB[seed].info.map(x => [x.name, x]));
        for (const a of bA[seed].info) {
            const b = mapB[a.name];
            if (!b) continue;
            n++;
            const ta = a.fin != null ? a.fin : CUT, tb = b.fin != null ? b.fin : CUT;
            if (a.fin == null) { da++; dnfB++; }
            if (b.fin == null) { db++; dnfC++; }
            fa.push(ta); fb.push(tb); d.push(tb - ta); allD.push(tb - ta);
        }
    }
    console.log(`${s}    ${q(fa, 0.5).toFixed(0).padStart(7)}  ${q(fb, 0.5).toFixed(0).padStart(7)}` +
        `   ${q(d, 0.5).toFixed(1).padStart(9)}   ${mean(d).toFixed(1).padStart(10)}` +
        `   ${String(da).padStart(6)}/${String(db).padEnd(5)}  ${String(d.length).padStart(3)}`);
}
console.log('');
console.log(`POOLED-CENSORED ${SETS.length} sets, n=${allD.length}: med ${q(allD, 0.5).toFixed(1)}  mean ${mean(allD).toFixed(1)}` +
    `  p25 ${q(allD, 0.25).toFixed(1)}  p75 ${q(allD, 0.75).toFixed(1)}  negative ${allD.filter(x => x < 0).length}/${allD.length}`);
console.log(`  DNF-at-${CUT}: base ${dnfB}/${n} (${(100 * dnfB / n).toFixed(1)}%)  cand ${dnfC}/${n} (${(100 * dnfC / n).toFixed(1)}%)`);
