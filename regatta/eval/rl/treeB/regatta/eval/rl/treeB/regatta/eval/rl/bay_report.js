// Per-leg analysis of a bay_bench JSON vs the human reference (7 traj, Aug 3).
// node bay_report.js <label> [labelB]  — with labelB, prints paired deltas (by seed+boat).
const fs = require('fs'); const path = require('path');
const HUMAN = { 1: 42, 2: 27, 3: 39, 4: 53, 5: 40, 6: 20, fin: 226 };
const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const load = l => JSON.parse(fs.readFileSync(path.join(__dirname, 'bay_bench_' + l + '.json')));
const A = load(process.argv[2] || 'base');
function legDurs(run, inf) {
    // legT[k] = first time raceState.leg === k. Duration of leg k = legT[k+1]-legT[k]; last leg ends at fin.
    const d = {};
    for (let lg = 1; lg <= 6; lg++) {
        const t0 = inf.legT[lg], t1 = lg < 6 ? inf.legT[lg + 1] : inf.fin;
        if (t0 != null && t1 != null) d[lg] = t1 - t0;
    }
    d.start = inf.legT[1] != null ? inf.legT[1] : null;   // time to cross the line
    return d;
}
const perLeg = {}; const fins = []; const starts = []; const pens = [];
const col = { boat: 0, land: 0, mark: 0, floe: 0, bounds: 0 }; let ocsN = 0, colInstr = false;
for (const run of A) for (const inf of run.info) {
    const d = legDurs(run, inf);
    for (let lg = 1; lg <= 6; lg++) if (d[lg] != null) (perLeg[lg] = perLeg[lg] || []).push(d[lg]);
    if (inf.fin != null) fins.push(inf.fin);
    if (d.start != null) starts.push(d.start);
    pens.push(inf.pen || 0);
    if (inf.ocs) ocsN++;
    if (inf.col) { colInstr = true; for (const c in col) col[c] += inf.col[c] || 0; }
}
const n = A.length * A[0].info.length;
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
console.log(`${process.argv[2] || 'base'}: ${A.length} seeds, ${fins.length}/${n} finishers, fin med ${med(fins)} mean ${mean(fins).toFixed(1)} min ${Math.min(...fins)} max ${Math.max(...fins)} | start-cross med ${med(starts)} mean ${mean(starts).toFixed(1)} min ${Math.min(...starts)} max ${Math.max(...starts)} | pens/boat ${mean(pens).toFixed(2)} | OCS ${(100 * ocsN / n).toFixed(1)}%`);
if (colInstr) console.log(`collisions/boat-race: boat ${(col.boat / n).toFixed(2)} land ${(col.land / n).toFixed(2)} mark ${(col.mark / n).toFixed(2)} floe ${(col.floe / n).toFixed(2)} bounds ${(col.bounds / n).toFixed(2)}  (0.5s dedup, prestart incl.)`);
console.log('leg   bot-med  bot-min  human   delta');
let sum = 0;
for (let lg = 1; lg <= 6; lg++) {
    const m = med(perLeg[lg]), mn = Math.min(...perLeg[lg]);
    sum += m - HUMAN[lg];
    console.log(`L${lg}     ${String(m).padStart(4)}     ${String(mn).padStart(4)}    ${String(HUMAN[lg]).padStart(3)}    +${(m - HUMAN[lg])}`);
}
console.log(`total per-leg delta vs human: +${sum}s (fin delta +${med(fins) - HUMAN.fin}s)`);

if (process.argv[3]) {
    const B = load(process.argv[3]);
    const key = (s, name) => s + ':' + name;
    const bFin = new Map(); const bLeg = new Map();
    for (const run of B) for (const inf of run.info) {
        bFin.set(key(run.seed, inf.name), inf.fin);
        bLeg.set(key(run.seed, inf.name), legDurs(run, inf));
    }
    const dFin = []; const dLeg = {};
    for (const run of A) for (const inf of run.info) {
        const k = key(run.seed, inf.name);
        if (inf.fin != null && bFin.get(k) != null) dFin.push(bFin.get(k) - inf.fin);
        const da = legDurs(run, inf), db = bLeg.get(k);
        if (db) for (let lg = 1; lg <= 6; lg++) if (da[lg] != null && db[lg] != null) (dLeg[lg] = dLeg[lg] || []).push(db[lg] - da[lg]);
    }
    console.log(`\nPAIRED vs ${process.argv[3]} (B - A, negative = A faster): fin med ${med(dFin)} mean ${(dFin.reduce((a, b) => a + b, 0) / dFin.length).toFixed(1)} n=${dFin.length}`);
    for (let lg = 1; lg <= 6; lg++) if (dLeg[lg]) console.log(`  L${lg} med ${med(dLeg[lg])}`);
}
