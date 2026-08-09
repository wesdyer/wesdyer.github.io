// THE 96-SEED REDROCK PROTOCOL, pooled across BOTH halves (2026-08-08 → 09).
// _pool_rr.js pools sets that share one base/cand label prefix; the protocol's two
// halves were run on different trees (pre-merge op5rr↔rr4rr, merge-HEAD cp1rr↔rr4brr,
// dormancy byte-verified on seed 9400 both sides), so the grand pool needs explicit
// pairs. Same statistics, same per-set spread, so the noise stays visible.
//   node _pool_rr12.js base1:cand1:set1 base2:cand2:set2 ...
const fs = require('fs'); const path = require('path');
const PAIRS = process.argv.slice(2).map(s => s.split(':'));
const load = (l) => {
    const f = path.join(__dirname, `ocean_bench_${l}.json`);
    return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
};
const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(p * (s.length - 1))] : NaN; };
const mean = a => a.reduce((x, y) => x + y, 0) / (a.length || 1);

const allD = [], finsB = [], finsC = [], setMed = [];
let nB = 0, nC = 0, fcB = 0, fcC = 0;
const col = { boat: 0, mark: 0, land: 0 }, colC = { boat: 0, mark: 0, land: 0 };
let penB = 0, penC = 0;
console.log(`set        base med  cand med   paired med   paired mean   n`);
for (const [B0, C0, s] of PAIRS) {
    const A = load(B0 + s), B = load(C0 + s);
    if (!A || !B) { console.log(`${s}     (missing ${!A ? B0 + s : C0 + s})`); continue; }
    const bySeed = arr => Object.fromEntries(arr.map(t => [t.seed, t]));
    const bA = bySeed(A), bB = bySeed(B);
    const d = [], fa = [], fb = [];
    for (const seed of Object.keys(bA)) {
        if (!bB[seed]) continue;
        const mapB = Object.fromEntries(bB[seed].info.map(x => [x.name, x]));
        for (const a of bA[seed].info) {
            const b = mapB[a.name];
            if (!b) continue;
            nB++; nC++;
            penB += a.pen || 0; penC += b.pen || 0;
            for (const k of Object.keys(col)) { col[k] += (a.col && a.col[k]) || 0; colC[k] += (b.col && b.col[k]) || 0; }
            if (a.fin != null) { fa.push(a.fin); finsB.push(a.fin); fcB++; }
            if (b.fin != null) { fb.push(b.fin); finsC.push(b.fin); fcC++; }
            if (a.fin != null && b.fin != null) { d.push(b.fin - a.fin); allD.push(b.fin - a.fin); }
        }
    }
    setMed.push(q(d, 0.5));
    console.log(`${s}      ${q(fa, 0.5).toFixed(0).padStart(7)}  ${q(fb, 0.5).toFixed(0).padStart(7)}` +
        `   ${q(d, 0.5).toFixed(1).padStart(9)}   ${mean(d).toFixed(1).padStart(10)}   ${String(d.length).padStart(3)}`);
}
console.log('');
console.log(`POOLED ${PAIRS.length} SETS: base med ${q(finsB, 0.5).toFixed(1)} (fins ${fcB}/${nB})` +
    `  cand med ${q(finsC, 0.5).toFixed(1)} (fins ${fcC}/${nC})`);
console.log(`  PAIRED n=${allD.length}: med ${q(allD, 0.5).toFixed(1)}  mean ${mean(allD).toFixed(1)}` +
    `  p25 ${q(allD, 0.25).toFixed(1)}  p75 ${q(allD, 0.75).toFixed(1)}` +
    `  negative ${allD.filter(x => x < 0).length}/${allD.length} (${(100 * allD.filter(x => x < 0).length / allD.length).toFixed(1)}%)`);
console.log(`  PER-SET MEDIANS: ${setMed.map(x => x.toFixed(0)).join(', ')}`);
console.log(`     sets favouring candidate: ${setMed.filter(x => x < 0).length}/${setMed.length}` +
    `   spread ${Math.min(...setMed).toFixed(0)} .. ${Math.max(...setMed).toFixed(0)}`);
console.log(`  dirt/boat  base b/m/l ${(col.boat / nB).toFixed(2)}/${(col.mark / nB).toFixed(2)}/${(col.land / nB).toFixed(2)} pen ${(penB / nB).toFixed(2)}`);
console.log(`             cand b/m/l ${(colC.boat / nC).toFixed(2)}/${(colC.mark / nC).toFixed(2)}/${(colC.land / nC).toFixed(2)} pen ${(penC / nC).toFixed(2)}`);
