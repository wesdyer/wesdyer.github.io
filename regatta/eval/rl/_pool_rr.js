// POOLED REDROCK VERDICT over the six anchor sets (2026-08-08).
// Standing rule 12: 8-seed redrock benches cannot resolve an avoidance-class
// change — the same 8 seeds swung paired med +54 → −93 across two near-identical
// trees, and this session watched a candidate score +2.0 on set 9400 and −50.0 on
// set 9500. Judge on the POOLED per-boat deltas over all six sets, and print the
// per-set spread beside it so the noise is visible rather than assumed.
//   node _pool_rr.js <baseLabelPrefix> <candLabelPrefix> [sets...]
// e.g. node _pool_rr.js bp2rr cc1rr 9400 9500 9600 9700 9800 9900
const fs = require('fs'); const path = require('path');
const [BASE, CAND] = process.argv.slice(2, 4);
const SETS = process.argv.slice(4).length ? process.argv.slice(4)
    : ['9400', '9500', '9600', '9700', '9800', '9900'];
const load = (l) => {
    const f = path.join(__dirname, `ocean_bench_${l}.json`);
    return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
};
const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(p * (s.length - 1))] : NaN; };
const mean = a => a.reduce((x, y) => x + y, 0) / (a.length || 1);

const allD = [], finsB = [], finsC = [];
let nB = 0, nC = 0, fcB = 0, fcC = 0;
const col = { boat: 0, mark: 0, land: 0, floe: 0 }, colC = { boat: 0, mark: 0, land: 0, floe: 0 };
let penB = 0, penC = 0;
console.log(`set      base med  cand med   paired med   paired mean   n`);
for (const s of SETS) {
    const A = load(BASE + s), B = load(CAND + s);
    if (!A || !B) { console.log(`${s}     (missing ${!A ? BASE + s : CAND + s})`); continue; }
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
    console.log(`${s}    ${q(fa, 0.5).toFixed(0).padStart(7)}  ${q(fb, 0.5).toFixed(0).padStart(7)}` +
        `   ${q(d, 0.5).toFixed(1).padStart(9)}   ${mean(d).toFixed(1).padStart(10)}   ${String(d.length).padStart(3)}`);
}
console.log('');
console.log(`POOLED ${SETS.length} sets: base med ${q(finsB, 0.5).toFixed(1)} (fins ${fcB}/${nB})` +
    `  cand med ${q(finsC, 0.5).toFixed(1)} (fins ${fcC}/${nC})`);
console.log(`  PAIRED n=${allD.length}: med ${q(allD, 0.5).toFixed(1)}  mean ${mean(allD).toFixed(1)}` +
    `  p25 ${q(allD, 0.25).toFixed(1)}  p75 ${q(allD, 0.75).toFixed(1)}` +
    `  negative ${allD.filter(x => x < 0).length}/${allD.length}`);
console.log(`  dirt/boat  base b/m/l ${(col.boat / nB).toFixed(2)}/${(col.mark / nB).toFixed(2)}/${(col.land / nB).toFixed(2)} pen ${(penB / nB).toFixed(2)}`);
console.log(`             cand b/m/l ${(colC.boat / nC).toFixed(2)}/${(colC.mark / nC).toFixed(2)}/${(colC.land / nC).toFixed(2)} pen ${(penC / nC).toFixed(2)}`);
